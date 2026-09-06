// 队列化 Toast hook —— 收敛 director3d 全部提示通知，从 App.jsx 剥离（原内联 41 处调用点）。
// 设计意图：
//   1. 解决单值「后一条覆盖前一条」、(D2) 相同文本不触发消失、(D3) 错误与成功视觉无差异、
//      (D4) 错误无级别区分 等缺陷（详见 横切关注点审计.md §一）。
//   2. 每条独立 1800ms 自动消失；level 支持 'info'/'success'/'warning'/'error'，
//      渲染层按档着色（对齐 maomao 统一通知的顶置四档样式）。
// 对外返回 { toasts, notify, setToast, dismiss }，其中 setToast 为 notify 别名，兼容既有调用签名。
import { useCallback, useState } from 'react';

/** 单条 toast 自动消失时长（毫秒）。 */
export const TOAST_DURATION_MS = 1800;

/**
 * 队列化 Toast 状态。渲染层消费 toasts；业务层 setToast(text[, level]) 入队；dismiss(id) 手动关闭。
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const notify = useCallback((text, level = 'info') => {
    if (text == null || text === '') return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((list) => [...list, { id, text, level }]);
    window.setTimeout(
      () => setToasts((list) => list.filter((item) => item.id !== id)),
      TOAST_DURATION_MS,
    );
  }, []);

  // 手动关闭某条（渲染层关闭按钮用）
  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((item) => item.id !== id));
  }, []);

  // 兼容既有调用签名：setToast(text) 即入队
  const setToast = notify;

  return { toasts, notify, setToast, dismiss };
}
