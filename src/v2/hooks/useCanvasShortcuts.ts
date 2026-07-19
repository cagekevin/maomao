/**
 * 画布快捷键系统
 * 对齐原版 App.js L36533-36597
 *
 * 支持：
 * - Q/W/E 快速创建节点（在视口中心）
 * - Ctrl+Z 撤销 / Ctrl+Y 或 Ctrl+Shift+Z 重做
 * - Ctrl+C 复制 / Ctrl+V 粘贴
 * - 输入框焦点时自动跳过所有快捷键
 */

import { useEffect, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';

interface UseCanvasShortcutsOptions {
  onAddNode?: (type: string, position: { x: number; y: number }) => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onDelete?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  enabled?: boolean;
}

export function useCanvasShortcuts(options: UseCanvasShortcutsOptions) {
  const { screenToFlowPosition } = useReactFlow();
  const { enabled = true } = options;

  // 输入框焦点检查（对齐原版 Ch() App.js L28171）
  const isInputFocused = useCallback((e: KeyboardEvent): boolean => {
    const target = e.target || document.activeElement;
    if (!target || !(target instanceof HTMLElement)) return false;
    return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
  }, []);

  // 获取视口中心对应的 flow 坐标
  const getViewportCenter = useCallback(() => {
    const rect = document.querySelector('.react-flow')?.getBoundingClientRect();
    if (!rect) return null;
    return screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  }, [screenToFlowPosition]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 输入框聚焦时跳过所有快捷键
      if (isInputFocused(e)) return;

      const ctrl = e.ctrlKey || e.metaKey;

      // Q/W/E 创建节点（无修饰键）
      if (!ctrl && !e.altKey && !e.shiftKey) {
        if (e.key === 'q' || e.key === 'Q') {
          e.preventDefault();
          const pos = getViewportCenter();
          if (pos) {
            options.onAddNode?.('textNode', pos);
          }
          return;
        }
        if (e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          const pos = getViewportCenter();
          if (pos) {
            options.onAddNode?.('promptNode', pos);
          }
          return;
        }
        if (e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          const pos = getViewportCenter();
          if (pos) {
            options.onAddNode?.('discountVideoNode', pos);
          }
          return;
        }
      }

      // Ctrl+Z 撤销
      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        options.onUndo?.();
        return;
      }

      // Ctrl+Y 或 Ctrl+Shift+Z 重做
      if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        options.onRedo?.();
        return;
      }

      // Ctrl+C 复制
      if (ctrl && e.key === 'c') {
        e.preventDefault();
        options.onCopy?.();
        return;
      }

      // Ctrl+V 粘贴
      if (ctrl && e.key === 'v') {
        e.preventDefault();
        options.onPaste?.();
        return;
      }

      // Delete / Backspace 删除（无修饰键时由 React Flow 处理，这里不重复）
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    enabled,
    isInputFocused,
    getViewportCenter,
    options.onAddNode,
    options.onCopy,
    options.onPaste,
    options.onDelete,
    options.onUndo,
    options.onRedo,
  ]);
}
