import React from 'react';
import { createPortal } from 'react-dom';
import { useFullscreenEditorKeys } from '../core/modalLayer.ts';

/**
 * 全屏层外壳 —— 盖住画布的整层 UI 统一从这里长出来。
 *
 * 【它替使用者挡掉的三件事】
 *  1. `createPortal(…, document.body)`：全屏层必须挂在 body 上，不能留在画布 DOM 里，
 *     否则会被 React Flow 的 transform / overflow 裁剪，事件也会串到画布；
 *  2. 登记为「全屏模态层」：让画布全局快捷键（⌘Z / ⌘D / Ctrl+G / Q/W/E…）整体让位。
 *     不登记的话，用户在本层按 ⌘Z 会撤掉画布上的节点、按 E 会凭空长出一个视频节点；
 *  3. Esc 关闭（传了 onClose 就自动接管）。
 *
 * 【为什么要做成组件而不是一个 hook】
 * hook 方案要求每个全屏层各自"记得调用 + 记得把 enabled 绑对"，靠自觉维持一致性。
 * 曾经出过真实事故：某层常驻挂载，却把 enabled 绑成了恒非空的数据字段，
 * 于是画布上每有一个该组件就永久登记一层，画布快捷键（Q/W/E）静默全废，
 * 而使用者只看到"按键没反应"，没有任何线索指向元凶。
 * 做成外壳后，**登记与 portal 由结构保证，不可能忘记、也不可能绑错**，
 * 写全屏层的人甚至不需要知道 modalLayer 的存在。
 *
 * 【它与 FullscreenModal 的分工】
 *  - FullscreenModal：视觉固定 —— 居中面板 + 标题栏 + 右下角拖拽改尺寸，只换 children；
 *  - FullscreenShell：视觉全空 —— 层级 / 布局 / 背景 / 内边距全由 className 决定，
 *    只负责"全屏层该有的行为"。铺满型编辑器（图片编辑、剧本盒、导演台）用它。
 *
 * 【用法】
 * ```tsx
 * <FullscreenShell
 *   open={open}
 *   onClose={onClose}
 *   className="fixed inset-0 z-ceiling flex flex-col bg-canvas"
 * >
 *   …
 * </FullscreenShell>
 * ```
 *
 * ⚠️ `open` 必须是**真实的可见状态**。唯一会犯的错就是拿"数据是否就绪"当可见性
 * （例如 `open={!!url}`），当该数据恒非空时会让本层永久登记。条件挂载的层
 * （父层 `{open && <X/>}`）传常量 `open` 即可，语义等价。
 */
export interface FullscreenShellProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * 外壳 div 的 ref。React 19 起 ref 就是普通 prop，这里直接接收再原样转发，
   * 无需 forwardRef。有的层需要拿外壳做命令式操作（例如导演台要屏蔽宿主指针事件）。
   */
  ref?: React.Ref<HTMLDivElement>;
  /** 是否打开。必须反映真实可见状态，不要用「数据是否就绪」代替 */
  open: boolean;
  /**
   * Esc 关闭回调，同时决定是否接管 Esc。
   * 不传 = 不接管 Esc（层内自成键位体系时用，例如全景漫游的 1/2/3/r/f、导演台的 D/Z/Y/V/F1-4）。
   * 注意：传了它，本层仍会登记（画布照常让位），只是不吃 Esc。
   */
  onClose?: () => void;
  /**
   * 本层独占的快捷键：键名（'mod+z' / 'mod+shift+z' / 'p' 等，ctrl 与 meta 统一写作 mod）
   * → 处理器。命中即 preventDefault，避免触发浏览器默认行为。
   */
  keyMap?: Record<string, () => void>;
}

export default function FullscreenShell({
  open,
  onClose,
  keyMap,
  className,
  children,
  ref,
  ...rest
}: FullscreenShellProps) {
  // 登记 + 独占键 + Esc，全在这里；使用者不需要知道这套机制存在。
  // escapeToClose 由「有没有传 onClose」推导，省掉一个容易传错的开关。
  useFullscreenEditorKeys({
    enabled: open,
    escapeToClose: !!onClose,
    onEscape: onClose,
    keyMap,
  });

  if (!open) return null;

  // 剩余 props（onWheel / onMouseDown / onClick 等）原样透传到外壳 div：
  // 各层的"阻止滚轮冒到画布""点遮罩关闭"等细节不同，不进本组件的职责范围。
  return createPortal(
    <div ref={ref} className={className} {...rest}>
      {children}
    </div>,
    document.body,
  );
}
