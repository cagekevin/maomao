import { useEffect, useCallback } from 'react';
import { isEditableTarget } from '../components/base/core/uiHooks.ts';
import { hasModalLayer } from '../components/base/core/modalLayer.ts';

/** 快捷键回调集合；未提供的快捷键自动不响应 */
export interface CanvasShortcutHandlers {
  /** Ctrl+Z */
  onUndo?: () => void;
  /** Ctrl+Shift+Z / Ctrl+Y */
  onRedo?: () => void;
  /** Ctrl+A */
  onSelectAll?: () => void;
  /** Ctrl+D */
  onDuplicate?: () => void;
  /** Ctrl+G 编组选中节点 */
  onGroup?: () => void;
  /** Ctrl+Shift+G 取消编组 */
  onUngroup?: () => void;
  /** Ctrl+L 自动排版（dagre） */
  onArrange?: () => void;
  /** Q/W/E 快速添加节点，入参为节点类型（textGenerateNode/imageGenerateNode/videoGenerateNode） */
  onAdd?: (nodeType: string) => void;
  /** Tab 一键折叠/展开「有输入面板」节点（INPUT_PANEL_NODE_TYPES）的 input 面板 */
  onToggleInputPanels?: () => void;
}

/**
 * 画布键盘快捷键（撤销/重做/全选/复制/编组/整理/快捷建节点/折叠面板）。
 *
 * 守卫条件与源码一致：
 *  - `e.repeat`：长按连发直接忽略（防 Q/W/E 爆发式建节点）
 *  - `hasModalLayer()`：全屏模态层打开时整体让位（⌘Z / Q/W/E 不得落到画布）
 *  - `isEditableTarget(e)`：焦点在 INPUT/TEXTAREA/contenteditable 内一律跳过
 *  - `hasSelectionText()`：无修饰键（Q/W/E）与 Ctrl+A/D/L 在有文本选中时跳过
 *    （Ctrl+G / Ctrl+Shift+G 编组除外——画布操作任意时刻可触发）
 *
 * @param handlers
 *  - onUndo / onRedo          Ctrl+Z / Ctrl+Shift+Z 或 Ctrl+Y
 *  - onSelectAll              Ctrl+A
 *  - onDuplicate              Ctrl+D
 *  - onGroup                  Ctrl+G 编组选中节点
 *  - onUngroup                Ctrl+Shift+G 取消所选 group 编组
 *  - onArrange                Ctrl+L 自动排版（dagre）
 *  - onAdd(type)              Q / W / E 快速添加文本/图片/视频
 *  - onToggleInputPanels      Tab 一键折叠/展开输入面板
 */
export function useCanvasShortcuts(handlers: CanvasShortcutHandlers = {}) {
  const {
    onUndo,
    onRedo,
    onSelectAll,
    onDuplicate,
    onGroup,
    onUngroup,
    onArrange,
    onAdd,
    onToggleInputPanels,
  } = handlers;

  const hasSelectionText = useCallback(() => {
    try {
      const sel = window.getSelection();
      return !!sel && sel.toString().length > 0;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // 长按连发防护：keydown 在按住时会以系统速率重复触发，
      // Q/W/E 快速建节点若不加 e.repeat 守卫会爆发式生成大量重叠节点。
      if (e.repeat) return;

      // 全屏模态层打开时整体让位（见 modalLayer.ts 的事故说明）。
      // 这是本守卫的关键：上面盖着全屏编辑器时，⌘Z / Q/W/E 必须不能落到画布 ——
      // 否则用户在编辑器里撤销或切工具，实际动的是画布上的节点。
      // 不能用 stopImmediatePropagation 代替：同一 target 上多个 listener 全部执行、
      // 且依赖注册顺序；只有"画布自己不执行"才是确定性的。
      if (hasModalLayer()) return;

      // 输入框内一律跳过
      if (isEditableTarget(e)) return;

      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // 无修饰键快速添加：Q / W / E（选中文本时跳过，避免编辑文本误触）
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (hasSelectionText()) return;
        if (key === 'q') {
          e.preventDefault();
          onAdd?.('textGenerateNode');
          return;
        }
        if (key === 'w') {
          e.preventDefault();
          onAdd?.('imageGenerateNode');
          return;
        }
        if (key === 'e') {
          e.preventDefault();
          onAdd?.('videoGenerateNode');
          return;
        }
        if (key === 'tab') {
          e.preventDefault();
          onToggleInputPanels?.();
          return;
        }
      }

      if (!mod) return;
      if (e.shiftKey && key === 'z') {
        e.preventDefault();
        onRedo?.();
        return;
      }
      if (key === 'z') {
        e.preventDefault();
        onUndo?.();
        return;
      }
      if (key === 'y') {
        e.preventDefault();
        onRedo?.();
        return;
      }

      // 编组 / 取消编组（Ctrl+G / Ctrl+Shift+G）：
      // 提前处理、不因「有文本选中」跳过 —— 编组是画布操作，任意时刻都应可触发
      if (key === 'g' && e.shiftKey) {
        e.preventDefault();
        onUngroup?.();
        return;
      }
      if (key === 'g') {
        e.preventDefault();
        onGroup?.();
        return;
      }

      // 选中文本时跳过（复刻 H_.jsx:11493-11517）
      if (hasSelectionText()) return;

      if (key === 'a') {
        e.preventDefault();
        onSelectAll?.();
      } else if (key === 'd') {
        e.preventDefault();
        onDuplicate?.();
      } else if (key === 'l') {
        e.preventDefault();
        onArrange?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    hasSelectionText,
    onUndo,
    onRedo,
    onSelectAll,
    onDuplicate,
    onGroup,
    onUngroup,
    onArrange,
    onAdd,
    onToggleInputPanels,
  ]);
}
