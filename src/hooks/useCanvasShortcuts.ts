import { useEffect, useCallback } from 'react';
import { isEditableTarget } from '../components/base/core/uiHooks.ts';

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
  /** Q/W/E 快速添加节点，入参为节点类型（textNode/promptNode/discountVideoNode） */
  onAdd?: (nodeType: string) => void;
  /** Tab 一键折叠/展开 text/prompt/discountVideo 节点的 input 面板 */
  onToggleInputPanels?: () => void;
}

/**

 *
 * 守卫条件与源码一致：


 *
 * @param handlers
 *  - onUndo / onRedo          Ctrl+Z / Ctrl+Shift+Z 或 Ctrl+Y
 *  - onSelectAll              Ctrl+A
 *  - onDuplicate              Ctrl+D
 *  - onGroup                  Ctrl+G 编组选中节点
 *  - onUngroup                Ctrl+Shift+G 取消所选 group 编组

 *  - onAdd(type)              Q / W / E 快速添加文本/图片/视频
 *  - getPosition()            快速添加节点时的坐标（默认基于当前鼠标不可得时返回 0,0）
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

      // 输入框内一律跳过
      if (isEditableTarget(e)) return;

      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // 无修饰键快速添加：Q / W / E（选中文本时跳过，避免编辑文本误触）
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (hasSelectionText()) return;
        if (key === 'q') {
          e.preventDefault();
          onAdd?.('textNode');
          return;
        }
        if (key === 'w') {
          e.preventDefault();
          onAdd?.('promptNode');
          return;
        }
        if (key === 'e') {
          e.preventDefault();
          onAdd?.('discountVideoNode');
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
