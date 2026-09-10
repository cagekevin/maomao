import { useEffect, useRef } from 'react';
import { isEditableTarget } from './uiHooks.ts';

/**
 * 全屏模态层登记处 —— 画布全局快捷键的「让位」依据。
 *
 * 【要解决的真实事故】
 * 画布全局快捷键（useCanvasShortcuts）挂在 window 上，它不知道上面盖了全屏编辑器。
 * 于是用户在 ImageEditor 里按 ⌘Z 想撤一笔涂鸦，结果是：
 *   ImageEditor 没绑 → 事件漏到画布 → 画布 onUndo 执行 → **撤掉了画布上的节点操作**。
 * 同类还有 ImageEditor 里按 E（切橡皮）→ 画布 Q/W/E 快速建节点 → 凭空多出一个视频节点。
 * 这不是"点了没反应"，是静默破坏用户在画布上的工作。
 *
 * 【为什么必须是显式登记，不能用 DOM 检测】
 * 最容易想到的是「DOM 里有没有 z-ceiling 元素」。行不通：ToastContainer / ConfirmContainer /
 * RenameDialog 也用 z-ceiling，Toast 容器还可能常驻 DOM —— 一检测就永远为真，画布快捷键全废。
 * 也不能靠 stopImmediatePropagation：同一个 target(window) 上的多个 listener 会全部执行，
 * 且依赖注册顺序；preventDefault 只拦浏览器默认行为，拦不住别的 listener。
 * 唯一可靠的办法是**让画布自己不执行**，而它需要一个可靠的信号 —— 就是这里的登记表。
 *
 * 【用法】
 *  全屏编辑器内部调 useFullscreenEditorKeys() 即可（它会自动登记/注销），
 *  画布侧 useCanvasShortcuts 每次按键实时读 hasModalLayer() 决定是否让位。
 *  两层保险：漏登记的编辑器只是"自己的快捷键不工作"（功能缺失，可发现），
 *  不会退化成"误伤画布"（数据丢失，难发现）—— 这个失败方向是刻意选的。
 *
 * 【为什么用 Set 而不是计数器】
 * 支持嵌套（理论上弹窗之上再开编辑器的场景），且不会因为某次 cleanup 漏调导致计数永久失衡。
 */

const layers = new Set<symbol>();

/** 登记一层全屏模态；返回注销函数（务必交给 useEffect 的 cleanup）。 */
function registerLayer(): () => void {
  const id = Symbol('modal-layer');
  layers.add(id);
  return () => {
    layers.delete(id);
  };
}

/** 当前是否有全屏模态层打开（供画布快捷键实时查询，无需订阅）。 */
export function hasModalLayer(): boolean {
  return layers.size > 0;
}

/**
 * 归一化键名，供 keyMap 的键使用。
 *  - mod = Ctrl 或 Cmd（跨 Win/Mac 一致）
 *  - 修饰键顺序固定为 mod → shift → 主键，故 ⌘⇧Z 的键名是 'mod+shift+z'
 *  - 主键一律小写（'P' 与 'p' 同义）
 */
export function describeKey(e: KeyboardEvent): string {
  const key = e.key.toLowerCase();
  const parts: string[] = [];
  // ctrl / meta 有意合并成同一个 mod：⌘Z 与 Ctrl+Z 是同一个动作在两套系统上的写法，
  // 业务不该为它写两条分支。这是刻意的设计，不是漏 —— 真要区分（极罕见）自行查
  // e.ctrlKey / e.metaKey，不要在这里拆开。
  if (e.ctrlKey || e.metaKey) parts.push('mod');
  if (e.shiftKey) parts.push('shift');
  // alt 必须参与，否则 Alt+Z 与 Z 会生成同一个键名互相打架。
  if (e.altKey) parts.push('alt');
  parts.push(key);
  return parts.join('+');
}

export interface FullscreenEditorKeys {
  /**
   * 本编辑器独占的快捷键：键名（describeKey 格式）→ 处理器。
   * 命中即 preventDefault（挡住浏览器默认行为，如 ⌘Z 的文本撤销）。
   * 未列在这里的键不作处理，交给画布（此时画布已因本层登记而不响应）。
   */
  keyMap?: Record<string, () => void>;
  /**
   * 是否启用 Esc 关闭。默认 true —— 全屏编辑器里用户按 Esc 的预期就是退出，
   * 而这个动作没有任何别的入口能补（只能去点"取消"）。
   * 传 false 的场景：编辑器内部正在编辑文本/输入框，Esc 应先退出那层（由调用方在 keyMap 里
   * 自行处理 'escape'，此时本钩子不再抢）。
   */
  escapeToClose?: boolean;
  /** Esc 关闭时的回调，通常就是 onClose。 */
  onEscape?: () => void;
  /** 关掉本钩子（未打开 / 数据未就绪时不该抢键）。默认 true。 */
  enabled?: boolean;
}

/**
 * 全屏编辑器的统一快捷键钩子：登记模态层 + 独占指定按键 + Esc 关闭。
 *
 * 各全屏编辑器用它替代自己手写的 window keydown，顺带获得两件事：
 *  ① 自动登记，画布快捷键随之让位（不再误伤画布）；
 *  ② Esc 可关闭（此前 ImageEditor 之类压根没接 Esc，只能点"取消"）。
 *
 * 挂载期间才登记；卸载（含 StrictMode 的二次挂载）由 cleanup 精确注销，不会泄漏。
 */
export function useFullscreenEditorKeys({
  keyMap,
  escapeToClose = true,
  onEscape,
  enabled = true,
}: FullscreenEditorKeys): void {
  // 每次渲染都是新对象的入参（keyMap / onEscape 常内联书写），用 ref 持有最新值，
  // 让下面的 effect 只在 enabled 变化时重挂而不是每次渲染都重挂。
  const latest = useRef({ keyMap, escapeToClose, onEscape });
  latest.current = { keyMap, escapeToClose, onEscape };

  useEffect(() => {
    if (!enabled) return;
    const unregister = registerLayer();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      const { keyMap: km, escapeToClose: esc, onEscape: cb } = latest.current;

      // Esc 必须在 isEditableTarget 之前处理。
      // Esc 的语义是「退出当前语境」，它本身就是给输入框用的逃生键 —— 若在这里让
      // 输入框把它吃掉，用户在弹窗的输入框里按 Esc 就彻底出不来（只能去点取消）。
      // 用 e.key 而非 describeKey 比对：⌘Esc / ⇧Esc 也应关闭，
      // 带不带修饰键都改变不了用户想走的意思。
      if (esc && e.key === 'Escape') {
        e.preventDefault();
        cb?.();
        return;
      }

      // 其余按键：输入框内一律让行。全屏编辑器里也有输入框（文字工具浮层、各类文本域），
      // 在里头打字不能触发这里登记的快捷键，否则连退格都可能被劫走。
      if (isEditableTarget(e)) return;

      if (!km) return;
      const k = describeKey(e);
      if (Object.prototype.hasOwnProperty.call(km, k)) {
        e.preventDefault();
        km[k]?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      unregister();
    };
  }, [enabled]);
}

/**
 * 只登记模态层、不接管任何键。
 * 适用：不想改键盘行为的全屏浮层，但一样要让画布快捷键让位（否则用户在该浮层里按 ⌘Z 会撤画布）。
 */
export function useModalLayer(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    return registerLayer();
  }, [enabled]);
}
