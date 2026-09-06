/**
 * 剪贴板公共工具 —— 集中「复制 / 粘贴清洗」能力，供画布/节点/面板复用，消除各处重复实现。
 *
 * 覆盖：
 *  - copyImageToClipboard(url)：图片本身复制到剪贴板（image/png），可粘到其它软件
 *    对齐官方 Ei（H_.jsx:10044 canvas→toBlob）与 ImageBoxNode.copyImage。
 *  - copyText(text)：纯文本复制（clipboard.writeText）
 *  - sanitizePastedText(raw)：粘贴文本清洗 —— 丢弃所有样式/富文本残留，只留干净纯文本。
 *  - downloadUrl(url, filename)：下载文件（fetch blob → a.download）
 *  - downloadBlob(blob, filename)：直接下载已有 Blob（备份 JSON / 文本导出等）
 *
 * 说明：复制「节点组」走 App.jsx 的 copySelectedNodes（含连线关系，独立于本模块）；
 * 复制「链接」用 copyText 即可。
 */

import { logger } from '../core/logger.ts';
import { httpRequest } from '../api/httpClient.ts';
import { DOWNLOAD_TIMEOUT } from '../core/config.ts';
import { generateId } from '../core/idGen.ts';
import { deepClone } from '../core/utils.ts';
import { withTimeout, TimeoutError } from './asyncGuard.ts';

/** 剪贴板操作统一返回信封：{ ok, msg }，调用方负责 toast。 */
type ClipResult = { ok: boolean; msg: string };

/**
 * 粘贴文本清洗（纯文本化）：把从剪贴板/富文本带过来的「样式与格式残留」全部丢弃，只留干净纯文本。
 * 覆盖场景：粘贴网页/表格/Word 内容时常见的一类脏字符与格式。
 *  - 零宽 / 不可见字符（BOM、零宽空格、软连字符、LRM/RLM 等）
 *  - 控制字符（C0 控制区，保留换行符）
 *  - 统一换行（\r\n → \n）
 *  - 表格 Tab 分隔 → 单个空格；连续空格 → 单个空格
 *  - 压缩多余空行（3+ 个换行 → 2 个）
 * @param {string} raw 原始文本
 * @returns {string} 清洗后的纯文本
 */
export function sanitizePastedText(raw: string): string {
  if (!raw) return '';
  return (
    String(raw)
      // 去零宽 / 软连字符 / BOM / LRM / RLM 等不可见字符
      .replace(/[\u200b\ufeff\u00ad\u200e\u200f\u2060]/g, '')
      // 去 C0 控制字符（保留 \n 换行 0x0a 与 \t 由下一步统一处理）
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
      // 统一换行
      .replace(/\r\n?/g, '\n')
      // 表格 Tab 分隔 → 空格
      .replace(/\t+/g, ' ')
      // 连续空格（含全角空格）→ 单个半角空格
      .replace(/[ \u3000]+/g, ' ')
      // 行首/行尾多余空格
      .replace(/[ ]+\n/g, '\n')
      .replace(/\n[ ]+/g, '\n')
      // 压缩多余空行
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

/** 把图片 URL 复制成 image/png 到剪贴板。返回 { ok, msg }，调用方负责 toast。 */
export async function copyImageToClipboard(url: string): Promise<ClipResult> {
  if (!url) return { ok: false, msg: '没有图片可复制' };
  try {
    // 画布绘制 → toBlob PNG → 写剪贴板（对齐官方 Ei:10049-10079）
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    if (!blob) throw new Error('Could not get blob');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return { ok: true, msg: '图片已复制，可在画布或其它软件中粘贴' };
  } catch (e) {
    logger.warn('clipboard', '复制图片失败（canvas 跨域等）', e?.message);
    // 退化为复制链接（对齐官方 fallback 思路）
    try {
      await navigator.clipboard.writeText(url);
      return { ok: true, msg: '图片链接已复制（直接复制图片失败）' };
    } catch {
      return { ok: false, msg: '复制失败，可能因跨域或权限限制' };
    }
  }
}

/**
 * 把 <video> 当前（或尾帧）画面绘制到 canvas 并返回 canvas。
 * 纯函数（无副作用），供 copyVideoFrameToClipboard 复用，便于单测。
 * @param video 已加载的视频元素（videoWidth>0 才有效）
 * @param opts.last true=截尾帧（currentTime 跳到 duration-0.1，极短视频兜底到中段）；false=截当前帧
 * @returns 绘制好的 canvas
 * @throws 视频未加载 / seek 超时 / canvas 上下文缺失等真实错误（不静默吞）
 */
export async function drawVideoFrameToCanvas(
  video: HTMLVideoElement,
  opts: { last?: boolean } = {},
): Promise<HTMLCanvasElement> {
  if (!video || !(video.videoWidth > 0) || !(video.videoHeight > 0)) {
    throw new Error('视频尚未加载，无法截屏');
  }
  // 尾帧：定位到接近末尾；极端短视频（duration 很小）兜底到中段，避免越界取不到帧
  if (opts.last) {
    const wasPaused = video.paused;
    const dur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    const target = dur > 0 ? Math.max(0, Math.min(dur - 0.1, dur * 0.5)) : video.currentTime;
    if (target !== video.currentTime) {
      await withTimeout(
        new Promise<void>((resolve, reject) => {
          const onSeeked = () => {
            cleanup();
            resolve();
          };
          const onErr = () => {
            cleanup();
            reject(new Error('尾帧定位失败'));
          };
          const cleanup = () => {
            video.removeEventListener('seeked', onSeeked);
            video.removeEventListener('error', onErr);
          };
          video.addEventListener('seeked', onSeeked);
          video.addEventListener('error', onErr);
          video.pause(); // 暂停，避免 seek 后再被 playback 推进，确保停在尾帧
          video.currentTime = target;
        }),
        5000,
        '尾帧定位超时',
      );
    }
    // seeked 后渲染面未必立即更新到解码帧，等两帧 rAF 确保尾帧已上屏再 drawImage
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    if (!wasPaused) {
      /* 调用方预览框仍可继续播放，此处不强制恢复，避免干扰用户 */
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法获取 canvas 上下文');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * 截取视频帧并复制到系统剪贴板（image/png）。供统一视频预览框「截屏当前帧 / 截屏尾帧」按钮调用。
 * 复用 clipboard 统一信封 { ok, msg }，调用方负责 toast。
 * 失败（未加载 / 跨域污染 SecurityError / 超时 / 剪贴板权限）一律透传真实错误文案，不静默降级为复制链接
 * （视频帧无法靠链接兜底，故不沿用 copyImageToClipboard 的 fallback 思路）。
 * @param video 预览框内的 <video> 元素
 * @param opts.last true=尾帧，false/undefined=当前帧
 */
export async function copyVideoFrameToClipboard(
  video: HTMLVideoElement,
  opts: { last?: boolean } = {},
): Promise<ClipResult> {
  if (!video) return { ok: false, msg: '没有可截屏的视频' };
  try {
    const canvas = await drawVideoFrameToCanvas(video, opts);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    if (!blob) throw new Error('帧导出失败（canvas 可能被跨域污染）');
    await withTimeout(
      navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]),
      5000,
      '复制到剪贴板超时',
    );
    return { ok: true, msg: opts.last ? '尾帧已复制到剪贴板' : '当前帧已复制到剪贴板' };
  } catch (e) {
    const err = e as Error;
    // 超时 / 跨域 SecurityError 等真实原因原样透传，禁止用泛化错误掩盖
    const msg =
      err instanceof TimeoutError
        ? `截屏失败：${err.message}`
        : /SecurityError|tainted/i.test(err.message)
          ? '截屏失败：视频跨域，canvas 被污染，无法复制到剪贴板'
          : `截屏失败：${err.message || '未知错误'}`;
    logger.warn('clipboard', '复制视频帧失败', err?.message);
    return { ok: false, msg };
  }
}

/**
 * 从剪贴板 JSON 重建节点组（对齐官方 xi，H_.jsx:9635-9789）。
 * 从 App.jsx pasteNodeGroup 抽出的纯逻辑：解析 mutiwindow-nodes → 包围盒中心对齐 →
 * id 重映射 + 重建节点/边。只返回计算结果，写回 setNodes/setEdges/history/showToast
 * 由调用方编排。
 *
 * @param {string} jsonStr 剪贴板内容
 * @param {{x:number,y:number}} pos 粘贴落点（视图坐标，整组以该点为中心落下）
 * @returns {null|{nodes:Array, edges:Array, count:number}}
 *   非 mutiwindow-nodes 格式 / 空节点 → null；否则返回重建后的 nodes（新节点 selected:true、
 *   旧节点 selected:false）与 edges（id 已重映射）。
 */
/** 剪贴板还原的节点（字段宽松可空 + 索引签名，兼容跨平台画布快照） */
export interface ClipboardNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  selected?: boolean;
  [key: string]: unknown;
}

/** 剪贴板还原的边 */
export interface ClipboardEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  selected?: boolean;
  [key: string]: unknown;
}

export function buildNodesFromClipboard(
  jsonStr: string,
  pos: { x: number; y: number },
): { nodes: ClipboardNode[]; edges: ClipboardEdge[]; count: number } | null {
  let t;
  try {
    t = JSON.parse(jsonStr);
  } catch {
    return null;
  }
  if (!t || t.type !== 'mutiwindow-nodes') return null;
  const e = t.nodes || [];
  if (e.length === 0) return null;
  const n = t.edges || [];
  // 计算原节点组包围盒中心，使整组以粘贴点为中心落下（对齐官方 xi:9673-9686）
  const o = Math.min(...e.map((x) => x.position?.x ?? 0));
  const s = Math.min(...e.map((x) => x.position?.y ?? 0));
  const c = Math.max(...e.map((x) => (x.position?.x ?? 0) + (x.measured?.width || 300)));
  const l = Math.max(...e.map((x) => (x.position?.y ?? 0) + (x.measured?.height || 300)));
  const u = (o + c) / 2;
  const d = (s + l) / 2;
  const f = new Map();
  const p = e.map((x) => {
    const id = `${x.type}-${generateId('n')}`;
    f.set(x.id, id);
    const data = deepClone(x.data || {});
    return {
      ...x,
      id,
      position: { x: pos.x + (x.position?.x ?? 0) - u, y: pos.y + (x.position?.y ?? 0) - d },
      selected: true,
      data,
    };
  });
  const m = (n || []).map((x) => ({
    ...x,
    id: `e-${f.get(x.source)}-${f.get(x.target)}`,
    source: f.get(x.source),
    target: f.get(x.target),
    selected: true,
    type: 'default',
  }));
  return { nodes: p, edges: m, count: p.length };
}

/** 复制纯文本到剪贴板。返回 { ok, msg }。 */
export async function copyText(text: string): Promise<ClipResult> {
  try {
    await navigator.clipboard.writeText(text || '');
    return { ok: true, msg: '已复制' };
  } catch {
    return { ok: false, msg: '复制失败，请检查浏览器权限' };
  }
}

/** 下载已有 Blob（a.download）。返回 { ok, msg }。所有 a.download 下载统一走这里。 */
export async function downloadBlob(blob: Blob | null, filename?: string): Promise<ClipResult> {
  if (!blob) return { ok: false, msg: '没有可下载的内容' };
  try {
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objUrl);
    return { ok: true, msg: '已开始下载' };
  } catch (e) {
    logger.warn('clipboard', '下载失败', e?.message);
    return { ok: false, msg: '下载失败' };
  }
}

/** 下载文件（fetch blob → a.download）。返回 { ok, msg }。 */
export async function downloadUrl(url: string, filename?: string): Promise<ClipResult> {
  if (!url) return { ok: false, msg: '没有可下载的内容' };
  try {
    const res = await httpRequest(url, {
      timeoutMs: DOWNLOAD_TIMEOUT,
      retries: 0,
      parseJson: false,
    });
    const blob = await res.blob();
    return await downloadBlob(blob, filename);
  } catch (e) {
    logger.warn('clipboard', '下载失败', e?.message);
    return { ok: false, msg: '下载失败' };
  }
}

/**
 * 下载文件名推导（PromptNode / DiscountVideoNode handleDownload 公共实现）：
 *  - 优先用 label（已带扩展名则原样）；
 *  - 无 label → 用 URL 末尾文件名（仅 http/blob 以外/公网 URL，blob/data 不算）；
 *  - 仍无扩展名 → 补默认扩展名 ext；全空 → fallback。
 * @param {string} label 节点 label（可空）
 * @param {string} url 下载源 URL（必须非空）
 * @param {{ext?:string, fallback?:string}} [opts] 默认扩展名与兜底文件名
 */
export function resolveDownloadFilename(
  label: string,
  url: string,
  { ext = 'png', fallback = 'generated.png' }: { ext?: string; fallback?: string } = {},
): string {
  let filename = label || '';
  try {
    const fromUrl = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    if (fromUrl && !/^blob:|^data:/.test(url)) filename = filename || fromUrl;
  } catch {}
  // 先兜底再补扩展名：空 label + blob/data 等无来源名时用 fallback（原实现「先补扩展名后判空」使该兜底成为死代码，产生残缺文件名 'png'）
  if (!filename) filename = fallback;
  if (!/\.[a-z0-9]{2,5}$/i.test(filename)) filename += (filename ? '.' : '') + ext;
  return filename;
}
