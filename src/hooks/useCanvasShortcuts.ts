import { useEffect, useCallback, useRef } from 'react';
import { isEditableTarget } from '../components/base/core/interaction/uiHooks.ts';
import { isCanvasSuppressed } from '../components/base/core/interaction/modalLayer.ts';

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
 *  - `isCanvasSuppressed()`：画布被压制时**整体**让位 —— 含全屏模态层**与视频剪辑器**
 *    （剪辑器 2026-09-15 起是全屏层；判据真源见 `modalLayer.ts`，勿在此另写条件）
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
  // 【TD-04-43】用 ref 承接**最新** handlers —— **订阅的生命周期不该由"回调身份"决定**。
  // 旧实现把 9 个回调全塞进 effect deps ⇒ 调用方传内联箭头（App 的 `onAdd`）时，
  // 宿主每次重渲都「解绑 + 重绑」window keydown（拖拽期间 = **每帧一次**）。
  // 语义等价：旧 = 回调变就重绑以取用新回调；新 = 不重绑、但每次事件读最新 ⇒ 两者都"总是用最新回调"。
  // （渲染期赋值是必需的：effect 里赋值会让"绑定后、首次事件前"的那次读取拿到旧值。）
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const hasSelectionText = useCallback(() => {
    try {
      const sel = window.getSelection();
      return !!sel && sel.toString().length > 0;
    } catch {
      // catch-ok: BROWSER_API
      // 极老/受限环境 `getSelection` 不可用属环境预期，判「无选区」不阻断快捷键。
      // 【TD-18-14 判非债（2026-09-18）· 判据见 ADR-0031】**探测语义**：失败与"没有选区"对调用方是同一答案
      // ⇒ 不留痕（留痕只会把正常路径刷成噪音，判据见 `core/degrade.ts` 头注）。
      return false;
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // 长按连发防护：keydown 在按住时会以系统速率重复触发，
      // Q/W/E 快速建节点若不加 e.repeat 守卫会爆发式生成大量重叠节点。
      if (e.repeat) return;

      // 画布被压制时整体让位（见 modalLayer.ts 的事故说明）——**含全屏层与视频剪辑器**。
      // 这是本守卫的关键：上面盖着全屏编辑器/剪辑器时，⌘Z / Q/W/E 必须不能落到画布 ——
      // 否则用户在编辑器里撤销或切工具，实际动的是画布上的节点。
      // 不能用 stopImmediatePropagation 代替：同一 target 上多个 listener 全部执行、
      // 且依赖注册顺序；只有"画布自己不执行"才是确定性的。
      if (isCanvasSuppressed()) return;

      // 输入框内一律跳过
      if (isEditableTarget(e)) return;

      const h = handlersRef.current; // TD-04-43：每次事件读最新回调
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // 无修饰键快速添加：Q / W / E（选中文本时跳过，避免编辑文本误触）
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (hasSelectionText()) return;
        if (key === 'q') {
          e.preventDefault();
          h.onAdd?.('textGenerateNode');
          return;
        }
        if (key === 'w') {
          e.preventDefault();
          h.onAdd?.('imageGenerateNode');
          return;
        }
        if (key === 'e') {
          e.preventDefault();
          h.onAdd?.('videoGenerateNode');
          return;
        }
        if (key === 'tab') {
          e.preventDefault();
          h.onToggleInputPanels?.();
          return;
        }
      }

      if (!mod) return;
      if (e.shiftKey && key === 'z') {
        e.preventDefault();
        h.onRedo?.();
        return;
      }
      if (key === 'z') {
        e.preventDefault();
        h.onUndo?.();
        return;
      }
      if (key === 'y') {
        e.preventDefault();
        h.onRedo?.();
        return;
      }

      // 编组 / 取消编组（Ctrl+G / Ctrl+Shift+G）：
      // 提前处理、不因「有文本选中」跳过 —— 编组是画布操作，任意时刻都应可触发
      if (key === 'g' && e.shiftKey) {
        e.preventDefault();
        h.onUngroup?.();
        return;
      }
      if (key === 'g') {
        e.preventDefault();
        h.onGroup?.();
        return;
      }

      // 选中文本时跳过（复刻 H_.jsx:11493-11517）
      if (hasSelectionText()) return;

      if (key === 'a') {
        e.preventDefault();
        h.onSelectAll?.();
      } else if (key === 'd') {
        e.preventDefault();
        h.onDuplicate?.();
      } else if (key === 'l') {
        e.preventDefault();
        h.onArrange?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // 【TD-04-43】deps 只留**真正影响订阅本身**的项：回调一律走 handlersRef 读最新，
    // 故不再入 deps ⇒ 内联箭头不再触发每帧「解绑+重绑」。
  }, [hasSelectionText]);
}
