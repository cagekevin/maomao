/**
 * 视频编辑器（cutia 外部接入）toast 兼容壳。
 *
 * 【为什么存在】
 * cutia 原用第三方 `sonner` 的 `toast` API（toast.error/success/warning/info/loading + { description, id }）。
 * 接入后不应自带一套 toast 实现，统一走 `base/core/toastStore`（ToastContainer 顶部统一渲染、
 * 与全站同一处）。但统一 store 原生只支持 { type, duration }，缺 cutia 在用的两样能力：
 *   · `description`（副文案）
 *   · `id`（按 id 原地更新：loading → success/error 进度反馈）
 * 故在此做一层**纯转发适配**：实现 100% 落在统一 toastStore，这里只补齐上述语义，
 * 让原有 13 处调用点只改 import 即可，零行为回归。
 */
import { showToast, dismissToast } from '@/components/base/core/event/toastStore';

export interface ToastOptions {
  description?: string;
  id?: string;
  duration?: number;
}

type ToastType = 'success' | 'error' | 'warning' | 'info';

// sonner 风格 id → 统一 toast id，用于按 id 原地更新（loading→success）。
const idMap = new Map<string, number>();

function emit(type: ToastType, message: string, opts?: ToastOptions): number {
  const text = opts?.description ? `${message}：${opts.description}` : message;
  if (opts?.id !== undefined) {
    const prev = idMap.get(opts.id);
    if (prev !== undefined) dismissToast(prev);
  }
  const id = showToast(text, { type, duration: opts?.duration });
  if (opts?.id !== undefined) idMap.set(opts.id, id);
  return id;
}

export const toast = {
  error: (message: string, opts?: ToastOptions) => emit('error', message, opts),
  success: (message: string, opts?: ToastOptions) => emit('success', message, opts),
  warning: (message: string, opts?: ToastOptions) => emit('warning', message, opts),
  info: (message: string, opts?: ToastOptions) => emit('info', message, opts),
  // 统一 store 无 loading 档；以 info 档近似（进度文案照常展示，loading→success 由 id 原地替换）。
  loading: (message: string, opts?: ToastOptions) => emit('info', message, opts),
};
