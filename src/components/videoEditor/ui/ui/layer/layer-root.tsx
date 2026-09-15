'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 编辑器层根基座 —— 弹层**唯一**的挂载点（docs/135 · 自研弹层的地基）
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 【为什么必须有它】此前所有弹层（菜单 / 对话框 / Popover / Tooltip）都
 * **Portal 到 `document.body`** —— 而 `.ve-scope`（编辑器主题作用域）在编辑器根节点上，
 * 于是弹层落在作用域**之外**：`--ve-*` 全取不到，背景/文字回落宿主画布值，色调错乱。
 * 当时的补丁是「编辑器打开期间把 `ve-scope dark` 挂到 `document.body`」（见 EditorShell）——
 * 那是**用附随复杂度补，而不是源头收敛**：宿主 body 被编辑器改了类，且每个弹层都活在
 * "靠 body 上有类"的隐式前提里。
 *
 * 【正确形态】弹层渲染进**编辑器自己的层根**（EditorShell 内），于是：
 *   · `.ve-scope` 天然命中（层根是它的后代）⇒ 可以删掉 body 补丁；
 *   · 与面板同处一个层叠上下文 ⇒ 层级由编辑器自己说了算，不再"必须比编辑器根还高"。
 *
 * 【层根的两条规格，缺一不可】
 *   ① `position: fixed; inset: 0` —— 占满视口，不给任何父级 flex 布局添一个尺寸未知的子项；
 *   ② `pointer-events: none` —— 它是**透明覆盖层**，若不关掉指针事件，它会在 10000 层
 *      吞掉编辑器里所有的点击。弹层自己要 `pointer-events: auto`（在各自基础类里给）。
 *   `z-modal-raise`(10000)：编辑器根是 `z-modal`(9999)，面板内部最高 `z-100` 档 ——
 *   层根取 `modal-raise`，即"编辑器之内、面板之上"。
 *
 * 【SSR 安全 / 为什么在 render 期解析而不是 effect 里】
 *   · 服务端没有 `document` ⇒ 返回 `null`；而弹层只在交互后出现，服务端**永远不会**渲染弹层内容
 *     ⇒ 不存在 hydration 不匹配。
 *   · 若改成"effect 里 setState"，会出现一个**只在真机才暴露**的死结：层根解析晚一帧 ⇒
 *     `LayerPortal` 首次渲染返回 `null` ⇒ 弹层内容根本没进 DOM ⇒ 弹层自己那次
 *     `useLayoutEffect`（测量尺寸）跑在"还没有 DOM"的时刻 ⇒ 测量回调早退，
 *     而 LayerPortal 随后那次 setState **不会**让已经 bail-out 的子元素重渲染
 *     ⇒ 弹层永远停在 `visibility:hidden`（只在 resize/scroll 时才自愈）。
 *     这正是本仓"靠最后一帧兜住"的典型坑 —— 一次性在 render 期解析掉。
 */
export const VE_LAYER_ROOT_ID = 've-layer-root';

/** 层根占位 —— 在 `EditorShell` 里挂**一个**（全编辑器只有一个层根）。 */
export function LayerRoot() {
  return <div id={VE_LAYER_ROOT_ID} className="pointer-events-none fixed inset-0 z-modal-raise" />;
}

function resolveLayerRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.getElementById(VE_LAYER_ROOT_ID) ?? document.body;
}

/** 取层根；编辑器还没挂层根时回落 `document.body`（测试环境 / 编辑器外的宿主里也能工作）。 */
export function useLayerRoot(): HTMLElement | null {
  const [root] = React.useState<HTMLElement | null>(resolveLayerRoot);
  return root;
}

/** 把弹层子树送进层根。`root` 未就绪时返回 `null`（见头注"SSR 安全"）。 */
export function LayerPortal({ children }: { children: React.ReactNode }) {
  const root = useLayerRoot();
  if (root === null) return null;
  return createPortal(children, root);
}
