/**
 * lovart_attachments — 参考素材形态收口：把各种形态统一转成 Lovart 可用的 CDN URL（attachments）。
 *
 * 忠实对齐 apimart-gateway/main.py 的 TaskService.resolve_attachments（"跟 main 一模一样"）：
 *   - http(s) 公网 URL        → 直接透传（Lovart 服务器可访问，不打日志）
 *   - http(s) 本机回环地址     → 本机直连下载字节 → 上传 Lovart CDN（Lovart 访问不到用户本机端口）
 *   - data: base64           → 解析 header 得扩展名 → 解码 → 上传 CDN
 *   - 无前缀裸 base64（魔数）  → 识别魔数（JPEG/PNG/GIF/WebP/BMP/视频/音频）→ 解码 → 上传 CDN
 *   - 其余（blob: / 本地路径 / 未知格式）→ drop（不计 failed_count，不阻断；避免把无效素材原样透传给
 *     Lovart 造成图生图/图生视频一直 running）
 * 真实上传/下载失败：计入 failed_count，只要有真实素材失败即 throw 阻断整条请求（不部分成功继续，
 * 否则 prompt 声称有参考图而 Lovart 收不到，生成结果与用户意图偏差且无法察觉）。
 *
 * 输出：返回 string[] | undefined（无参考素材返回 undefined，调用方不挂 attachments 字段）。
 */
import { uploadLovartFile, type LovartClientDeps } from './lovart_client.js';
import { LovartError, LOVART_ERR_TYPES } from './lovart_errors.js';

/**
 * 常见媒体 base64 魔数前缀（无 data: 前缀的裸 base64）。照抄 main._B64_MEDIA_MAGIC。
 * 前缀 → 扩展名。覆盖图片 + 视频/音频（图生视频/多模态参考素材用）。
 */
const B64_MEDIA_MAGIC: Record<string, string> = {
  '/9j/': 'jpg', // JPEG FF D8
  iVBOR: 'png', // PNG 89 50 4E 47
  R0lGOD: 'gif', // GIF 47 49 46 38
  UklGR: 'webp', // WebP 52 49 46 46（RIFF）
  Qk02: 'bmp', // BMP 42 4D
  SUQz: 'mp3', // MP3 ID3
  SU5G: 'm4a', // M4A
  AAAA: 'mp4', // MP4/通用（辅助）
  GkXf: 'webm', // WebM/Matroska 1A 45 DF A3
  Zkxh: 'flac', // FLAC 66 4C 61 43
  '/e8/': 'mp3', // MP3 MPEG 帧 FF FB / FF F3
  TWFn: 'm4a', // M4A iTunes MP4 音频（ftyp 在 M4A 头）
};

/** 判断字符串是否可能是裸 base64 媒体数据（无 data: 前缀）。照抄 main.looks_like_base64_media。 */
function looksLikeBase64Media(s: string): boolean {
  if (!s || s.length < 64) return false;
  if (
    s.startsWith('http://') ||
    s.startsWith('https://') ||
    s.startsWith('data:') ||
    s.startsWith('blob:')
  )
    return false;
  return Object.keys(B64_MEDIA_MAGIC).some((pre) => s.startsWith(pre));
}

/** 从裸 base64 魔数前缀推断扩展名。照抄 main._ext_from_b64_magic。 */
function extFromB64Magic(s: string): string {
  for (const pre of Object.keys(B64_MEDIA_MAGIC)) {
    if (s.startsWith(pre)) return B64_MEDIA_MAGIC[pre];
  }
  return 'png';
}

/** 从 data: header（如 image/jpeg）推断扩展名。照抄 main._ext_from_data_header。 */
function extFromDataHeader(header: string): string {
  const h = header.toLowerCase();
  if (h.includes('jpeg') || h.includes('jpg')) return 'jpg';
  if (h.includes('png')) return 'png';
  if (h.includes('gif')) return 'gif';
  if (h.includes('webp')) return 'webp';
  if (h.includes('bmp')) return 'bmp';
  if (h.includes('mp4')) return 'mp4';
  if (h.includes('webm')) return 'webm';
  if (h.includes('mpeg') || h.includes('mp3') || h.includes('audio')) return 'mp3';
  return 'png';
}

/** 从 HTTP 响应的 Content-Type 推断扩展名（本机回环图下载用）。照抄 main._ext_from_content_type。 */
function extFromContentType(ct: string | null): string {
  if (!ct) return 'png';
  const h = ct.toLowerCase();
  if (h.includes('jpeg') || h.includes('jpg')) return 'jpg';
  if (h.includes('png')) return 'png';
  if (h.includes('gif')) return 'gif';
  if (h.includes('webp')) return 'webp';
  if (h.includes('bmp')) return 'bmp';
  if (h.includes('mp4')) return 'mp4';
  if (h.includes('webm')) return 'webm';
  if (h.includes('mpeg') || h.includes('mp3') || h.includes('audio')) return 'mp3';
  return 'png';
}

/** 解析 data: URL → 字节 + 扩展名。照 main 分支（header 得 ext，base64 解码）。 */
function bytesFromDataUrl(dataUrl: string): { bytes: Uint8Array; ext: string } {
  const comma = dataUrl.indexOf(',');
  const header = comma >= 0 ? dataUrl.slice(0, comma) : '';
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : '';
  const ext = extFromDataHeader(header);
  const bytes = Buffer.from(b64, 'base64'); // 非法 base64 在此静默截断，main 亦如此；上传失败会在上游兜底
  return { bytes, ext };
}

/** 是否本机回环 host（127.0.0.1 / localhost / 0.0.0.0 / [::1]）。照 main 语义。 */
function isLoopbackHostname(host: string | null): boolean {
  const h = (host || '').toLowerCase();
  return h === '127.0.0.1' || h === 'localhost' || h === '0.0.0.0' || h === '[::1]';
}

/** 从 http(s) URL 提取 hostname（含 IPv6 字面量）。Node URL 对无 scheme 不适用，此处仅用于已确认 http 的 URL。 */
function hostnameOf(u: string): string | null {
  try {
    return new URL(u).hostname;
  } catch {
    return null;
  }
}

/**
 * 参考素材统一收口入口。
 * @param urls 任意形态的参考素材列表（图生图 URL / messages image_url / 特惠视频 files 等）
 * @returns Lovart 可用的 URL 列表（公网透传或 CDN URL）；无参考素材返回 undefined。
 * @throws LovartError(UPLOAD_FAILED) 当存在真实下载/上传失败且确有参考素材时，阻断整条请求。
 */
export async function resolveLovartAttachments(
  deps: LovartClientDeps,
  urls?: string[],
): Promise<string[] | undefined> {
  if (!urls || urls.length === 0) return undefined;
  const fetchImpl: typeof fetch = deps.fetchImpl ?? fetch;
  const out: string[] = [];
  let failedCount = 0;
  let lastErr: string | null = null;

  for (const raw of urls) {
    if (!raw || typeof raw !== 'string' || !raw.trim()) {
      // 空 / 非字符串素材：跳过（main 语义）
      continue;
    }
    const u = raw.trim();

    // 1) http(s)
    if (u.startsWith('http://') || u.startsWith('https://')) {
      const host = hostnameOf(u);
      if (host && isLoopbackHostname(host)) {
        // 1a) 本机回环：Lovart 服务器访问不到用户本机端口，必须本地下载后转 CDN。
        //     注：main 用 trust_env=False 本地直连池绕过系统代理；localTool 直连用 fetchImpl（缺省全局 fetch），
        //     出站代理问题由 localTool 出站口 resolveLocalImages/代理配置在更上层统一解决，此处直接下载。
        try {
          const resp = await fetchImpl(u);
          if (!resp.ok) throw new Error(`下载本机回环参考图失败 (${resp.status})`);
          const bytes = new Uint8Array(await resp.arrayBuffer());
          const ext = extFromContentType(resp.headers.get('content-type'));
          const cdn = await uploadLovartFile(deps, bytes, `_local_${randHex()}.${ext}`);
          if (cdn) out.push(cdn);
          else {
            failedCount += 1;
            lastErr = '本机回环图上传 CDN 返回空';
          }
        } catch (e) {
          failedCount += 1;
          lastErr = (e as Error).message;
        }
        continue;
      }
      // 1b) 其余外网 URL：直接透传（main 语义，不打日志）
      out.push(u);
      continue;
    }

    // 2) data: base64 → 上传 CDN
    if (u.startsWith('data:')) {
      try {
        const { bytes, ext } = bytesFromDataUrl(u);
        const cdn = await uploadLovartFile(deps, bytes, `_ref_${randHex()}.${ext}`);
        if (cdn) out.push(cdn);
        else {
          failedCount += 1;
          lastErr = '上传 CDN 返回空';
        }
      } catch (e) {
        failedCount += 1;
        lastErr = (e as Error).message;
      }
      continue;
    }

    // 3) 无前缀裸 base64 → 识别魔数后上传 CDN
    if (looksLikeBase64Media(u)) {
      try {
        const ext = extFromB64Magic(u);
        const bytes = Buffer.from(u, 'base64');
        const cdn = await uploadLovartFile(deps, bytes, `_ref_${randHex()}.${ext}`);
        if (cdn) out.push(cdn);
        else {
          failedCount += 1;
          lastErr = '上传 CDN 返回空';
        }
      } catch (e) {
        failedCount += 1;
        lastErr = (e as Error).message;
      }
      continue;
    }

    // 4) 其余（blob: / 本地路径 / 未知格式）：拿不到内容，drop（不计 failed_count，不阻断）
    //    避免把无效素材原样透传给 Lovart 造成图生图一直 running。
  }

  // 方案 A（对齐 main）：存在真实上传/下载失败且确有参考素材 → 阻断整条请求。
  if (urls.length > 0 && failedCount > 0) {
    throw new LovartError(
      `有 ${failedCount} 个参考素材上传失败，无法进行图生图/图生视频。` +
        `请确认已开启 VPN 或检查网络后重试。详情: ${lastErr ?? 'unknown'}`,
      -1,
      LOVART_ERR_TYPES.UPLOAD_FAILED,
    );
  }
  return out.length > 0 ? out : undefined;
}

/** 简短随机 hex（文件名后缀）。 */
function randHex(): string {
  return Math.random().toString(16).slice(2, 10);
}
