/**
 * lovart_attachments — 参考素材形态收口：把各种形态统一转成 Lovart 可用的 CDN URL（attachments）。
 *
 * 忠实对齐 apimart-gateway/main.py 的 TaskService.resolve_attachments（"跟 main 一模一样"）：
 *   - http(s) 公网 URL        → 直接透传（Lovart 服务器可访问，不打日志）
 *   - http(s) 本机回环地址     → 本机直连下载字节 → 上传 Lovart CDN（Lovart 访问不到用户本机端口）
 *   - data: base64           → 解析 header 得扩展名 → 解码 → 上传 CDN
 *   - 无前缀裸 base64（魔数）  → 识别魔数（JPEG/PNG/GIF/WebP/BMP/视频/音频）→ 解码 → 上传 CDN
 *   - 其余（blob: / 本地路径 / 未知格式）→ **计入 failed_count 并留痕**（2026-09-17 TD-08-40 改）：
 *     拿不到内容就转不出 CDN，而"prompt 声称有参考图、Lovart 却收不到"正是本文件头下方那条
 *     不部分成功原则要拦的事 —— 原实现在此**静默 drop 且不计失败**，三张参考图全为 blob: 时
 *     本函数返回 undefined，「图生图」**静默退化成文生图**且零报错（违反 docs/72 D-1
 *     「绝不静默降级为无参考图」）。
 * 真实失败（下载/上传失败 **或** 形态无法转 CDN）：计入 failed_count，只要有真实素材失败即 throw
 * 阻断整条请求（不部分成功继续，否则 prompt 声称有参考图而 Lovart 收不到，生成结果与用户意图偏差
 * 且无法察觉）。
 *
 * 输出：返回 string[] | undefined（无参考素材返回 undefined，调用方不挂 attachments 字段）。
 */
import { uploadLovartFile, type LovartClientDeps } from './lovart_client.js';
import { LovartError, LOVART_ERR_TYPES } from './lovart_errors.js';
import { mimeToExt } from '../../../utils/mime.js';

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

/**
 * 从裸 base64 魔数前缀推断扩展名。
 *
 * 【TD-08-22 修复 2026-09-16】`B64_MEDIA_MAGIC` 是**域专用魔数表**（base64 前缀 ≠ MIME，
 * 无法由 `mime.ts` 表达），保留原样；但原末尾 `return 'png'` 是**静默兜底** —— 表外魔数
 * 会被当 png 上传（Lovart 按 png 解析非 png 字节）。现改为 `null`（诚实「不认识」），
 * 由调用方丢弃该素材（与文件头「未知格式 → drop」的既定不变量一致）。
 *
 * 注：调用点前置 `looksLikeBase64Media`（要求命中某魔数前缀）⇒ 实际上恒有返回值；
 * `null` 分支是**契约兜底**（防未来有人绕过前置检查）。
 */
function extFromB64Magic(s: string): string | null {
  for (const pre of Object.keys(B64_MEDIA_MAGIC)) {
    if (s.startsWith(pre)) return B64_MEDIA_MAGIC[pre];
  }
  return null;
}

/**
 * MIME（data: header / Content-Type）→ 扩展名（无点）。**委托 mime.ts 唯一真源**。
 *
 * 【TD-08-22 修复 2026-09-16】原 `extFromDataHeader` / `extFromContentType` 各持一份
 * `includes()` 子串链，绕过后端 SSOT `utils/mime.ts`（2026-09-11 收口的 MIME↔ext 唯一实现），
 * 且子串匹配实测错判（走 `scripts/probe.mjs` 同款复核）：
 *   · `audio/aac`·`ogg`·`flac`·`wma`·`opus` → 全因 `includes('audio')` **错归 `.mp3`**；
 *   · `video/mpeg` → 因 `includes('mpeg')` **错归 `.mp3`**（视频错成音频）；
 *   · `image/avif`·`svg+xml` 等未列举型 → **静默兜底 `.png`**（上传错扩展名给 Lovart）。
 * 现统一走 `mimeToExt`（去 `;charset` 参数）—— 与 `files.ts` / `resources.ts` 同口径。
 *
 * 【与「照抄 main.py」的关系】文件头原写「照抄 main 1:1 镜像」。**镜像的是流程与分支**（哪些形态走哪条路），
 * 不是**照抄一个会错判扩展名的子串链** —— 输出扩展名是**本仓正确性责任**，且 main 那边的错判
 * 同样会让 Lovart 收错格式（属 upstream 缺陷，非「有意设计」）。故本函数不构成「外部对齐豁免」。
 */
function extFromMime(mime: string | null): string {
  if (!mime) return 'png';
  // 归一化：去 `data:` 前缀（本函数也收 data: URL 的 header 段，如 `data:image/jpeg`）、
  // 去 `;charset=…` 参数、去空白 —— 只留裸 MIME 再交真值源查表。
  const bare = mime
    .replace(/^data:/i, '')
    .split(';')[0]
    .trim();
  const ext = mimeToExt(bare); // 带点（'.png'）或 null
  return ext ? ext.slice(1) : 'png';
}

/** 解析 data: URL → 字节 + 扩展名。照 main 分支（header 得 ext，base64 解码）。 */
function bytesFromDataUrl(dataUrl: string): { bytes: Uint8Array; ext: string } {
  const comma = dataUrl.indexOf(',');
  const header = comma >= 0 ? dataUrl.slice(0, comma) : '';
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : '';
  const ext = extFromMime(header);
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
          const ext = extFromMime(resp.headers.get('content-type'));
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
      // 魔数表不认识的媒体型 → **不计静默**（同下方分支 4 口径，2026-09-17 TD-08-40）：
      // 拿不到正确的类型就不上传错格式（对），但**不能不吭声地丢** —— 那等于把这张参考图从
      // 用户以为自己发出的请求里删掉。计入失败 → 显式阻断 + 留痕。
      const b64Ext = extFromB64Magic(u);
      if (!b64Ext) {
        failedCount += 1;
        lastErr = `裸 base64 素材的魔数不在已知媒体表（无法判定格式），未上传：${u.slice(0, 24)}…`;
        console.warn('[lovart] 参考素材无法转 CDN，已计入失败', {
          kind: 'unknown-base64-magic',
          head: u.slice(0, 24),
        });
        continue;
      }
      try {
        const bytes = Buffer.from(u, 'base64');
        const cdn = await uploadLovartFile(deps, bytes, `_ref_${randHex()}.${b64Ext}`);
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

    // 4) 其余（blob: / 本地路径 / 未知格式）：拿不到内容 ⇒ 不能上传（避免无效素材原样透传给
    //    Lovart 造成图生图一直 running）。**但必须留痕 + 计入失败**（TD-08-40）：
    //    原实现此处连 continue 都没有、不计 failed_count ⇒ 全被 drop 时 out 为空 → 返回 undefined
    //    ⇒ 上游按"没有参考素材"发出去 = 图生图静默变文生图（docs/72 D-1 明令禁止的形态）。
    {
      const clip = u.slice(0, 40);
      const kind = u.startsWith('blob:')
        ? 'blob-url'
        : isLocalPathLike(u)
          ? 'local-path'
          : 'unknown-shape';
      const why =
        kind === 'blob-url'
          ? '前端临时预览地址（blob:），后端取不到内容 —— 请先保存/上传该图片再引用'
          : kind === 'local-path'
            ? `本机文件路径，未登记为素材也未转成回环 URL：${clip}`
            : `未知素材形态，无法转成 Lovart 可用 URL：${clip}`;
      failedCount += 1;
      lastErr = why;
      console.warn('[lovart] 参考素材无法转 CDN，已计入失败', { kind, reason: why });
    }
  }

  // 方案 A（对齐 main）：存在真实失败（下载/上传失败 **或** 形态无法转 CDN）且确有参考素材 →
  // 阻断整条请求。文案如实覆盖两类，不再只说"上传失败"（形态不支持时那句会误导排查方向）。
  if (urls.length > 0 && failedCount > 0) {
    throw new LovartError(
      `有 ${failedCount} 个参考素材无法用于本次生成（上传失败或形态不支持），已中止请求。` +
        `请确认已开启 VPN 或检查网络后重试。详情: ${lastErr ?? 'unknown'}`,
      -1,
      LOVART_ERR_TYPES.UPLOAD_FAILED,
    );
  }
  return out.length > 0 ? out : undefined;
}

/**
 * 是否"像本机路径"（`file:` / 盘符路径 / 以 `/` 开头的绝对路径）。
 *
 * 【为什么单独判一类（TD-08-40）】上游 `resolveImagesForEgress(v,'cdn')` 本应把本机 `/files/`
 * **补成回环 URL**（`http://127.0.0.1:18080/...`）再交到这里 —— 落到本分支说明它**没被转**。
 * 把它与"未知形态"分开留痕，是为了让这条日志能直接指向上游漏转（可 grep `kind:'local-path'`），
 * 而不是混在"未知素材形态"里看不出该修哪儿。
 */
function isLocalPathLike(u: string): boolean {
  return u.startsWith('file:') || /^([a-zA-Z]:[\\/]|\/)/.test(u);
}

/** 简短随机 hex（文件名后缀）。 */
function randHex(): string {
  return Math.random().toString(16).slice(2, 10);
}
