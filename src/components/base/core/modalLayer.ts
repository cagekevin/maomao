import { useEffect, useRef } from 'react';
import { isEditableTarget } from './uiHooks.ts';

/**
 * 全屏模态层登记处 —— 画布全局快捷键的「让位」依据。
 *
 * ⚠️ **不要直接调用本文件的 hook。** 新写全屏层请用
 * `components/base/panels/FullscreenShell.tsx`，它内部已经接好这里的一切。
 * 本文件是那个外壳的底层实现，直接调用会让"登记"重新变成每个组件各自要记得做的事
 * —— 那正是下面这起事故的成因。
 *
 * 【当前仅剩两个直接使用者，且都是结构上的例外】
 *  - `ImageZoomDialog`：原生 `<dialog showModal()>`，不用 createPortal，套不进外壳；
 *  - `OverlayEditor`：节点内嵌编辑器，全屏只是它的一种显示模式，主体不走 portal。
 *  这两个都有注释说明为何例外。除它们之外不应再有新增调用点。
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
 * 【为什么用 Map 而不是计数器】
 * 支持嵌套（理论上弹窗之上再开编辑器的场景），且不会因为某次 cleanup 漏调导致计数永久失衡。
 * Map 额外存了登记时刻与调用栈 —— 常驻误登记时那是唯一能指向元凶的线索（见 STUCK_WARN_MS）。
 */

interface LayerInfo {
  /** 登记时刻 */
  at: number;
  /** 登记时的调用栈 —— 常驻误登记时，这是唯一能指向元凶的线索 */
  stack: string | undefined;
}

const layers = new Map<symbol, LayerInfo>();

/**
 * 常驻登记的告警阈值。
 * 选 60s 的权衡：正常编辑（ImageEditor 里涂鸦、扩图调参）很容易超过 1 分钟，
 * 低于这个值会天天误报、最后被人忽略；而「误登记」的特征是从挂载那刻起永不注销，
 * 60s 足够在它造成困惑前喊出来，又不至于在正常使用中刷屏。
 */
const STUCK_WARN_MS = 60_000;

/** 登记一层全屏模态；返回注销函数（务必交给 useEffect 的 cleanup）。 */
function registerLayer(): () => void {
  const id = Symbol('modal-layer');
  layers.set(id, { at: Date.now(), stack: new Error().stack });

  // 【为什么要有这个告警】本机制是「信任型」的：谁登记，画布就整体让位。
  // 代价是一旦有层错误地常驻登记，画布全局快捷键会【静默全废】—— 用户只会看到
  // 「Q/W/E 没反应」，而没有任何线索指向元凶（2026-09-10 真实事故：ImageZoomDialog
  // 把 enabled 绑成了恒非空的 url，画布上每有一个 AssetNode 就永久登记一层）。
  // 这是唯一一种能让全局快捷键静默失效的失败模式，必须在开发期就喊出来。
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (import.meta.env?.DEV) {
    timer = setTimeout(() => {
      const info = layers.get(id);
      if (!info) return;
      console.warn(
        `[modalLayer] 某层已连续登记 ${Math.round(STUCK_WARN_MS / 1000)}s 未注销。` +
          `若并非真的全屏打开，说明 enabled 绑错了（常见：常驻挂载却用「数据是否就绪」判定可见性），` +
          `它将导致画布快捷键永久失效。登记处调用栈：`,
        info.stack,
      );
    }, STUCK_WARN_MS);
  }

  return () => {
    if (timer) clearTimeout(timer);
    layers.delete(id);
  };
}

/** 当前是否有全屏模态层打开（供画布快捷键实时查询，无需订阅）。 */
export function hasModalLayer(): boolean {
  return layers.size > 0;
}

/** 调试用：列出当前所有已登记的层（含登记时长与调用栈）。控制台可直接调用排查。 */
export function debugModalLayers(): Array<{ openSec: number; stack?: string }> {
  const now = Date.now();
  return [...layers.values()].map((l) => ({
    openSec: Math.round((now - l.at) / 1000),
    stack: l.stack,
  }));
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
 * ⚠️ 正常业务代码不该直接用这个钩子 —— 请用 `panels/FullscreenShell.tsx`。
 * 本钩子是外壳的内部实现，直接调用等于把「记得登记、记得绑对 enabled」的责任
 * 又交回给每个组件，而那正是出过事故的地方（见文件头说明）。
 * 目前仅 `ImageZoomDialog`（原生 dialog）与 `OverlayEditor`（非 portal 结构）
 * 因结构无法套进外壳而直接使用。
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
