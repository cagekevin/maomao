import { useCallback, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { clamp } from '@/components/base/core/utils';

/**
 * 面板宽度「拖拽调宽」原语 —— **唯一实现**。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么存在（2026-09-21 收口）】「按下手柄 → document 上跟手 → 算新宽 → 钳到合法区间 → 松手卸载」
 * 这四步此前在本仓被**逐字内联了两处**：
 *   · `agent/panels/AgentPanel.tsx`（右缘 `agent-grip`，绝对式 `innerWidth - clientX`）
 *   · `agent/panels/TableWorkspacePanel.tsx`（左缘 `tw-grip`，增量式 `startW - delta`）
 * 而左侧面板也要加同一个能力 ⇒ 不收口就是第 3 份（M3 第二份，改一处必漂移）。
 * 现统一为「起点快照 + 有向增量」一种算法（两处旧写法在数学上等价，见下）。
 *
 * 【算法（唯一）】`next = clamp(startWidth + dir * (clientX - startX), min, max)`
 *   · `dir = +1`（anchor 'right'）：手柄在面板**右缘**，鼠标往右 → 变宽；
 *   · `dir = -1`（anchor 'left'）：手柄在面板**左缘**，鼠标往左 → 变宽。
 *   等价性核对：右缘旧写法 `innerWidth - clientX`，而 `startWidth = innerWidth - startX`
 *   ⇒ `startWidth - (clientX - startX) = innerWidth - clientX`，逐帧同值。
 *
 * 【职责边界（三铁律）】
 *  · 本 hook 只管**拖拽生命周期 + 钳制**（怎么算宽），并在 `onChange` 出口保证值已合法；
 *  · **宽度状态存哪、怎么持久化** 一律归调用方（各面板域差异：AgentPanel 用组件 state +
 *    `agent_panel_width`／表格工作区用共享态 + `agent_split_width`／左侧面板用自己的键）
 *    —— 收上来即越权。
 *  · `min`/`max` 的**值**归各宿主面板（各自的设计区间），本 hook 只接收、不预设。
 *
 * 【用法】
 * ```tsx
 * const { dragging, handleProps } = usePanelResize({
 *   width, onChange: setWidth, anchor: 'right', min: MIN_W, max: MAX_W,
 * });
 * <div className={`pk-grip${dragging ? ' is-dragging' : ''}`} {...handleProps} title="拖动调整宽度" />
 * ```
 * ════════════════════════════════════════════════════════════════
 */

/** 手柄所在边：右缘（往右拖变宽）/ 左缘（往左拖变宽）。 */
export type PanelResizeAnchor = 'left' | 'right';

export interface PanelResizeOptions {
  /** 当前宽度（受控）——拖拽起点以它为准。 */
  width: number;
  /** 拖拽中每帧回调；**入参已钳到 [min, max]**（调用方无需再钳）。 */
  onChange: (width: number) => void;
  anchor: PanelResizeAnchor;
  min: number;
  max: number;
}

export interface PanelResizeHandle {
  /** 是否正在拖拽（调用方据此加 `is-dragging` / 禁用文本选择等）。 */
  dragging: boolean;
  /** 挂到拖拽手柄元素上（含 `onMouseDown`）。 */
  handleProps: { onMouseDown: (e: ReactMouseEvent) => void };
}

export function usePanelResize({
  width,
  onChange,
  anchor,
  min,
  max,
}: PanelResizeOptions): PanelResizeHandle {
  const [dragging, setDragging] = useState(false);
  /** 起点快照（鼠标 x + 当时的宽度）。null = 未在拖拽。 */
  const startRef = useRef<{ x: number; from: number } | null>(null);
  /**
   * `onChange` 的最新引用。document 上的 mousemove 监听**只在 mousedown 时注册一次**、
   * 活到 mouseup —— 若闭包捕获 `onChange`，拖拽途中调用方换引用就会用上旧回调（静默不生效）。
   */
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      startRef.current = { x: e.clientX, from: width };
      setDragging(true);
      const dir = anchor === 'right' ? 1 : -1;
      const onMove = (ev: MouseEvent) => {
        const s = startRef.current;
        if (!s) return;
        onChangeRef.current(clamp(s.from + dir * (ev.clientX - s.x), min, max));
      };
      const onUp = () => {
        startRef.current = null;
        setDragging(false);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [anchor, width, min, max],
  );

  return { dragging, handleProps: { onMouseDown } };
}
