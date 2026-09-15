import { useEffect, useRef } from 'react';
import { isCanvasSuppressed } from './modalLayer.ts';

export interface CanvasKeydownOptions {
  /**
   * 关掉本监听（如节点当前不在该模式、弹层未打开时不该抢键）。默认 true。
   * 用它代替「在调用处 if 一下再挂监听」—— hook 数量必须恒定。
   */
  enabled?: boolean;
}

/**
 * 画布内组件注册 window 键盘监听的**唯一入口**。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么必须走它】画布有一条铁律：**画布被压制时（全屏层 / 视频剪辑器打开）画布侧一律不响应**。
 * 违反它的失败模式是**静默破坏**：用户在剪辑器里按 Delete 想删片段，实际删掉的是被盖住的画布节点
 * （TD-22-19）；在图片编辑器里按 ⌘Z 想撤一笔涂鸦，实际撤掉的是画布上的节点操作。
 *
 * 此前各组件自己 `window.addEventListener('keydown', …)`，**要不要查这个判据由各自决定** ——
 * 查了的（`AssistantTablePanel`）对，没查的（`VideoProcessNode` / `PanoramaNode`）漏，
 * 而且这是一张"新增组件要记得加"的清单，必然继续漏。
 * 收口到本 hook 后，「查判据」不再是调用方的责任，而是**入口本身的行为**（删不掉的正确性）。
 *
 * 【与 modalLayer 的分工】`modalLayer` 提供**判据**（`isCanvasSuppressed`）；
 * 本模块提供画布侧的**注册入口**，是那个判据在"画布内组件"这一类宿主上的强制消费方。
 * 判据仍然单点 —— 本文件不得自己判断"有没有层打开"。
 *
 * 【已知不迁移的一处】`AssistantTablePanel` 仍自己挂监听并自查 `isCanvasSuppressed()`：
 * 它在**捕获阶段**注册且会对 Delete 调 `stopPropagation`，且自带 `isEditableTarget` 等
 * 域内守卫。它调的是同一个判据函数（单点未破），没有"漏让位"的风险，故不强迁。
 * ════════════════════════════════════════════════════════════════
 *
 * handler 每次渲染换引用**不会**导致监听重挂（内部 ref 取最新值），调用方不必包 useCallback。
 */
export function useCanvasKeydown(
  handler: (e: KeyboardEvent) => void,
  { enabled = true }: CanvasKeydownOptions = {},
): void {
  const latest = useRef(handler);
  latest.current = handler;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // 画布被全屏层 / 剪辑器压制 → 画布内组件整体让位（判据单点，勿在此另写条件）。
      if (isCanvasSuppressed()) return;
      latest.current(e);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
