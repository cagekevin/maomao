/**
 * 剪贴板公共工具 —— 集中「复制 / 粘贴清洗」能力，供画布/节点/面板复用，消除各处重复实现。
 *
 * 覆盖：
 *  - copyImageToClipboard(url)：图片本身复制到剪贴板（image/png），可粘到其它软件
 *    对齐官方 Ei（H_.jsx:10044 canvas→toBlob）与 ImageBoxNode.copyImage。
 *  - copyText(text, opts?)：纯文本复制（clipboard.writeText）；传 opts.html 时写 text/plain + text/html 双 MIME（富文本，如表格）。
 *  - sanitizePastedText(raw)：粘贴文本清洗 —— 丢弃所有样式/富文本残留，只留干净纯文本。
 *  - downloadUrl(url, filename)：下载文件（fetch blob → a.download）
 *  - downloadBlob(blob, filename)：直接下载已有 Blob（备份 JSON / 文本导出等）
 *
 * 说明：复制「节点组」走 App.jsx 的 copySelectedNodes（含连线关系，独立于本模块）；
 * 复制「链接」用 copyText 即可。
 */

import type { Node, Edge } from '@xyflow/react';
import { tryParse } from './asyncGuard.ts';
import { logger } from '../core/logger.ts';
import { httpRequest } from '../api/httpClient.ts';
import { DOWNLOAD_TIMEOUT } from '../core/config.ts';
import { generateId } from '../core/idGen.ts';
import { canvasToBlob, deepClone, fileNameFromUrl } from '../core/utils.ts';
import { withTimeout, TimeoutError, setCrossOriginForReadable } from './asyncGuard.ts';

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
    // TD-16-2 / TD-22-55：canvas 回读必须走跨源裁决单点（同源不设 / 真跨源才 anonymous）。
    // 恒设 'anonymous' 会让同源 `/files/*` 走 CORS 模式 → 媒体 opaque → canvas 被污染 → toBlob 返 null。
    setCrossOriginForReadable(img, url);
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
    // 【TD-06-14】异步产出走唯一出口（产出即校验，失败根部抛出）—— 不再自写判据与文案。
    const blob = await canvasToBlob(canvas, 'image/png');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return { ok: true, msg: '图片已复制，可在画布或其它软件中粘贴' };
  } catch (e) {
    logger.warn('clipboard', '复制图片失败（canvas 跨域等）', (e as { message?: string })?.message);
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
    // 【TD-06-14】走唯一出口。原处把 `toBlob → null` **重分类**成「canvas 可能被跨域污染」
    // （无证据的因果结论，CLAUDE.md §5.1 禁）—— 判据与文案归一，不再由本层猜原因。
    const blob = await canvasToBlob(canvas, 'image/png');
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
 * 把单个节点 data 清洗为可序列化形态：去掉函数字段与运行时字段（loading/progress/
 * errorMessage/assetUrlRef 等），避免把这些不可 JSON 化的内容写进剪贴板。纯函数，单测友好。
 *
 * 【为什么不是 `export`】唯一消费者是同文件的 `copyNodesToClipboard`。
 * 摘 `export` 保实现：`check:dead-code` 曾报「基线外新增死导出」——
 * 那是「内部实现被写成了公共 API」，不是「有人在用」（7 步法 A8：接口不预支）。
 *
 * @param {Node} node React Flow 节点
 * @returns 清洗后的节点副本（不修改入参）
 */
function serializeNodeForClipboard(node: Node): Node {
  const data = { ...(node.data || {}) };
  Object.keys(data).forEach((k) => {
    if (typeof data[k] === 'function') delete data[k];
  });
  [
    'loading',
    'progress',
    'errorMessage',
    'assetUrlRef',
    'assetUrlThumbRef',
    'assetUrlUploaded',
  ].forEach((k) => delete data[k]);
  return { ...node, data };
}

/**
 * 复制一组节点到系统剪贴板（「复制节点」能力单源，对齐 App.copySelectedNodes）。
 * 格式 {type:'mutiwindow-nodes', nodes, edges, originalIds}，粘贴时由
 * buildNodesFromClipboard 解析重建（含内部连线）。用户自行 Ctrl+V 粘贴到画布。
 * 仅复制「组内互连」的边（两端都在复制集合内的边），避免粘出悬空连线。
 * @param {Node[]} nodes 要复制的节点（单选传 [node]）
 * @param {Edge[]} edges 画布全部边（函数内部筛出组内边）
 * @returns {ClipResult} { ok, msg }，调用方负责 toast
 */
export async function copyNodesToClipboard(nodes: Node[], edges: Edge[]): Promise<ClipResult> {
  if (!nodes || nodes.length === 0) return { ok: false, msg: '没有可复制的节点' };
  const ids = new Set(nodes.map((n) => String(n.id)));
  const innerEdges = (edges || []).filter(
    (e) => ids.has(String(e.source)) && ids.has(String(e.target)),
  );
  const payload = {
    type: 'mutiwindow-nodes',
    nodes: nodes.map(serializeNodeForClipboard),
    edges: innerEdges,
    originalIds: nodes.map((n) => n.id),
  };
  try {
    await navigator.clipboard.writeText(JSON.stringify(payload));
    return { ok: true, msg: `已复制 ${nodes.length} 个节点` };
  } catch {
    return { ok: false, msg: '复制失败，请检查浏览器权限' };
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

/** 粘贴解析用的宽松节点形状（含 measured 轨道测量，ClipboardNode 的可空超集） */
interface ParseClipNode {
  id?: string;
  type?: string;
  position?: { x: number; y: number };
  measured?: { width?: number; height?: number };
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export function buildNodesFromClipboard(
  jsonStr: string,
  pos: { x: number; y: number },
): { nodes: ClipboardNode[]; edges: ClipboardEdge[]; count: number } | null {
  // 解析走唯一原语；判别联合 ⇒ 必须判 ok（2026-09-17 契约收紧）。
  const r = tryParse<Record<string, unknown>>(() => JSON.parse(jsonStr));
  if (!r.ok || !r.value || r.value.type !== 'mutiwindow-nodes') return null;
  const t = r.value;
  // 【2026-09-17 禁止项规则 2】禁止 `as T` 硬转：`t.nodes` 是 `unknown`，直接赋给 `ParseClipNode[]`
  // TS 必判红 —— **那是对的**（缺运行时校验）。现补**守卫收窄**：形状不符的元素被过滤掉，
  // 而不是靠断言"我保证它是"。过滤后为空 = 这份剪贴板数据不可用（返回 null，由调用方判）。
  const e: ParseClipNode[] = Array.isArray(t.nodes)
    ? t.nodes.filter((x): x is ParseClipNode => !!x && typeof x === 'object' && 'id' in x)
    : [];
  if (e.length === 0) return null;
  const n: ClipboardEdge[] = Array.isArray(t.edges)
    ? t.edges.filter((x): x is ClipboardEdge => !!x && typeof x === 'object')
    : [];
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

/** execCommand 兜底复制（旧/受限环境，无 clipboard API 或权限被拒时）。返回是否成功。 */
function execCommandCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * 复制文本到剪贴板。纯文本，或带 `html` 时同时写 `text/html` 双 MIME（富文本，如表格）。
 * 返回 { ok, msg }，由调用方负责 toast / 降级决策。
 *
 * 降级策略（消除各处自造的 execCommand 兜底层，统一收口到本生产者）：
 *  - 无 clipboard API（非安全上下文 / 旧环境）→ 走 execCommand 兜底，不算失败；
 *  - 权限被拒 / 其它异常 → 先试 execCommand 兜底，再失败才返回 ok:false + 真实原因。
 */
export async function copyText(text: string, opts?: { html?: string }): Promise<ClipResult> {
  const plain = text ?? '';
  const html = opts?.html;
  const canRich =
    !!html &&
    typeof ClipboardItem !== 'undefined' &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.write === 'function';
  try {
    if (canRich) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([plain], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' }),
        }),
      ]);
      return { ok: true, msg: '已复制' };
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(plain);
      return { ok: true, msg: '已复制' };
    }
    // 无 clipboard API → 走下方 execCommand 兜底
  } catch (e) {
    if (execCommandCopy(plain)) return { ok: true, msg: '已复制' };
    return {
      ok: false,
      msg: `复制失败（${e instanceof Error ? e.message : '权限被拒或非安全上下文'}）`,
    };
  }
  // 非安全上下文 / 旧环境：execCommand 兜底（不算失败）
  return execCommandCopy(plain)
    ? { ok: true, msg: '已复制' }
    : { ok: false, msg: '系统剪贴板不可用（execCommand 亦失败）' };
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
    logger.warn('clipboard', '下载失败', (e as { message?: string })?.message);
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
    logger.warn('clipboard', '下载失败', (e as { message?: string })?.message);
    return { ok: false, msg: '下载失败' };
  }
}

/**
 * 下载文件名推导（ImageGenerate / VideoGenerate handleDownload 公共实现）：
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
  // TD-16-14：URL→文件名统一走 core/utils 唯一原语（URL 解析剥 ?# + decode 一次）
  const fromUrl = fileNameFromUrl(url);
  if (fromUrl && !/^blob:|^data:/.test(url)) filename = filename || fromUrl;
  // 先兜底再补扩展名：空 label + blob/data 等无来源名时用 fallback（原实现「先补扩展名后判空」使该兜底成为死代码，产生残缺文件名 'png'）
  if (!filename) filename = fallback;
  if (!/\.[a-z0-9]{2,5}$/i.test(filename)) filename += (filename ? '.' : '') + ext;
  return filename;
}
