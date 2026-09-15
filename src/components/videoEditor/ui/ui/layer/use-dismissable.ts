'use client';

import * as React from 'react';

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 弹层关闭协议 —— Escape + 点击外部（**唯一实现**，所有弹层共用）
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 【为什么收口在一处】"点外面关掉"若每个弹层各写一遍，必然漂移成
 * 「有的监听 mousedown、有的监听 click、有的忘了排除触发元素」—— 而**漏排除触发元素**
 * 的后果是经典的"点了触发器：先关闭（外部点击）再打开（点击切换）→ 看起来点了没反应"。
 * 本仓已定的单一规则原则（CLAUDE.md §5.4.9）：同一语义只允许一种实现。
 *
 * 【四条口径，每条都是踩出来的】
 *   ① **capture 阶段的 `pointerdown`**（不是 `click`）：要在目标元素自己的按下处理之前判定
 *      "这是外面"，否则菜单项/滑杆的按下处理会先把状态改了。
 *   ② **触发器自身不算"外面"**：命中的话直接 return —— 开合交给触发器的 onClick（它知道该开还是该关）。
 *   ③ **在任意已打开层里也不算"外面"**：子菜单/下拉与父层是**兄弟**（都挂在层根下），
 *      父层的 `contains()` 看不见子层 ⇒ 不加这条，"点进子菜单"会把整棵树关掉。
 *   ④ **只有最上层吃 Escape**：栈结构表达"谁在最上面"。没有它，对话框里的下拉按 Esc 会**两层一起关**
 *      （两个监听器都收到同一个 keydown），用户看到的是"Esc 把我的弹窗也关了"。
 *
 * 【`reason` 要透出去】`'escape'` 与 `'outside-pointer'` 对焦点归还是两种待遇 ——
 * 按 Escape 应当把焦点还给触发器；"点到别处去了"则焦点跟着用户点的那里走（抢回来是反人类）。
 */
export type DismissReason = 'escape' | 'outside-pointer';

/** 已打开层的登记项：既用于"点在外面"判定，也用于 Escape 的层级仲裁。 */
interface LayerEntry {
  node: HTMLElement | null;
  handleEscape: () => void;
}

/** 打开顺序即层级顺序（后进 = 更上层）。 */
const layerStack: LayerEntry[] = [];

function isInsideAnyLayer(target: Node): boolean {
  for (const entry of layerStack) {
    const node = entry.node;
    if (node !== null && node.isConnected && node.contains(target)) return true;
  }
  return false;
}

interface DismissableOptions {
  enabled: boolean;
  /** 弹层内容节点（命中它 = 点在层内，不关闭）。 */
  contentRef: React.RefObject<HTMLElement | null>;
  /** 触发器节点（命中它 = 交给触发器自己开合，不在这里关）。 */
  triggerRef?: React.RefObject<HTMLElement | null>;
  onDismiss: (reason: DismissReason) => void;
}

export function useDismissable({ enabled, contentRef, triggerRef, onDismiss }: DismissableOptions) {
  React.useEffect(() => {
    if (!enabled) return undefined;

    const entry: LayerEntry = {
      node: contentRef.current,
      handleEscape: () => onDismiss('escape'),
    };
    layerStack.push(entry);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      /* 只有最上层响应（④）：否则一次 Esc 会连带关掉底下所有层。 */
      if (layerStack[layerStack.length - 1] !== entry) return;
      onDismiss('escape');
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (contentRef.current?.contains(target)) return;
      if (triggerRef?.current?.contains(target)) return;
      if (isInsideAnyLayer(target)) return;
      onDismiss('outside-pointer');
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown, true);

    return () => {
      const index = layerStack.indexOf(entry);
      if (index >= 0) layerStack.splice(index, 1);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [enabled, contentRef, triggerRef, onDismiss]);
}
