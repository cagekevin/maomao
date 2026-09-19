/**
 * 统一通知（toast）store —— 打地基：全项目所有交互提醒都走这一个入口。
 *
 * 【为什么用模块级发布订阅，而非 React Context】
 * 官方把所有节点的提醒都收敛到一个 `showToast`（H_.jsx k / onShowToast 回调）。原型若用
 * React Context + Provider，会要求「每个想弹提示的组件都包在 Provider 里」，深层节点很麻烦。
 * 模块级 store + 订阅：
 *  - 任何组件 `import { showToast } from './toastStore.ts'` 即可弹提示，无需包 Provider；
 *  - 渲染端（ToastContainer）只 subscribe 一次，把 store 里的 toast 列表画出来；
 *  - 之后接入官方 onShowToast 回调时，直接把它指向本 store 的 showToast 即可，全项目统一。
 *
 * 【接入约定（给后续所有交互提醒用）】
 * 弹提示：showToast('已复制 3 个节点', { type: 'success' })
 * type 取四档，对应状态色模板（doc39 §3.2）：success(绿) / error(红) / warning(黄) / info(蓝，默认)
 * 需要持久（不自动消失）：showToast('msg', { duration: 0 })
 */

// 单条 toast 结构：{ id, message, type, duration }
/** toast 状态档（对应状态色模板 doc39 §3.2：success绿 / error红 / warning黄 / info蓝） */
export type ToastType = 'success' | 'error' | 'warning' | 'info';
/** 单条 toast 结构（ToastContainer 渲染也用到，故导出） */
export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}
/** showToast 选项 */
interface ToastOptions {
  type?: ToastType;
  duration?: number;
  /**
   * 同一条文案的**合并窗口**（ms）：窗口内重复的同文案 toast **只保留一条**（不追加）。
   * 缺省 = 不合并（每次调用都弹）。
   *
   * 【为什么这份状态住在这里，而不在调用方】「用户看到什么、多频繁」是**展示层**的真相 ——
   * 状态归展示层持有，调用方只**声明**它允许被合并多久。2026-09-17 之前这份节流状态长在
   * `core/degrade.ts` 的**模块级全局单槽**里：一个转发原语替所有生产者决定用户可见性
   * = **消费者越权**（与已删的 `persist:failed` 全局吸收层同形态，只因粒度小未被发现）。
   */
  coalesceMs?: number;
}
/** `showToast` 返回值：该文案在合并窗口内**被合并**（未产生新 toast）。 */
export const TOAST_COALESCED = -1;
let toasts: Toast[] = [];
const listeners = new Set<() => void>();
let seq = 0;

/**
 * 同文案合并窗口的状态（**展示层 owner**）：key = `type\u0000message` → 上次弹出时间。
 * 有界性：只有声明了 `coalesceMs` 的调用方写它，全仓即 `reportDegrade` 一族（文案是有限固定集合），
 * 不会随用户数据增长。
 */
const lastShownAt = new Map<string, number>();

const DURATION = 3000; // 默认 3s 自动消失

// 分级默认时长：失败停留更久，让用户看清；中性 info 最短。
const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 2500,
  info: 2500,
  warning: 3500,
  error: 4000,
};

/**
 * 弹一条提示。
 * @param {string} message 提示内容
 * @param {Object} [opts]
 * @param {'success'|'error'|'warning'|'info'} [opts.type='info'] 状态档（决定配色）
 * @param {number} [opts.duration] 显示时长(ms)；0 = 不自动消失；缺省按分级取 DEFAULT_DURATION
 * @param {number} [opts.coalesceMs] 同文案合并窗口（ms）；窗口内重复同文案只保留一条
 * @returns {number} toast id（可用于手动关闭）；`TOAST_COALESCED`(-1) = 被合并，未产生新 toast
 */
export function showToast(
  message: string,
  { type = 'info' as ToastType, duration, coalesceMs }: ToastOptions = {},
): number {
  const text = String(message ?? '');
  if (coalesceMs && coalesceMs > 0) {
    const k = `${type}\u0000${text}`;
    const now = Date.now();
    const last = lastShownAt.get(k);
    if (last !== undefined && now - last < coalesceMs) return TOAST_COALESCED;
    lastShownAt.set(k, now);
  }
  const id = ++seq;
  const finalDuration = duration ?? DEFAULT_DURATION[type] ?? DURATION;
  toasts = [...toasts, { id, message: text, type, duration: finalDuration }];
  emit();
  return id;
}

/** 手动关闭某条 toast */
export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/** 关闭所有 toast（**连同合并窗口一起清**：用户清屏后同文案必须能再弹，否则「清空」变成新的静默） */
export function clearToasts(): void {
  lastShownAt.clear();
  if (toasts.length === 0) return;
  toasts = [];
  emit();
}

/** 订阅（返回取消函数）。ToastContainer 用它渲染。 */
export function subscribeToasts(listener: () => void): () => boolean {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 读当前快照 */
export function getToasts(): Toast[] {
  return toasts;
}

function emit(): void {
  listeners.forEach((l) => l());
}

/**
 * 语义化快捷出口。业务代码优先用这四个，无需记忆 type 字符串，分级默认时长自动生效。
 * 约定：仅当用户「无法直接从界面感知结果」时才弹——后台保存、跨域复制失败、云端推送、
 * 降级有损等；用户一眼能看出的结果（粘贴图片到画布、复制节点）不要弹，属于噪音。
 */
export const toastSuccess = (message: string, opts?: ToastOptions): number =>
  showToast(message, { ...opts, type: 'success' });
export const toastError = (message: string, opts?: ToastOptions): number =>
  showToast(message, { ...opts, type: 'error' });
export const toastWarning = (message: string, opts?: ToastOptions): number =>
  showToast(message, { ...opts, type: 'warning' });
export const toastInfo = (message: string, opts?: ToastOptions): number =>
  showToast(message, { ...opts, type: 'info' });
