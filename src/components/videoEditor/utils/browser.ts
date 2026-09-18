/**
 * 「这个元素**能不能真打字**」—— 剪辑器域内判据（`disabled` 元素算不能打字）。
 *
 * ⚠️ **与 `base/core/uiHooks.ts::isEditableTarget` 有意不合并**（ADR-0031 · 用户裁定 2026-09-18）：
 * 两者是**判据重复**而非探测重复 —— 本函数入参是 `{element}`（不绑事件）、判 `disabled`；
 * `isEditableTarget` 判 `ev.target` 的地盘、不看 `disabled`。差异均为域内必需，合并会改契约
 * （调用点 `stores/keybindings-store.ts:7,170,179`）。**别再把它登记成"可编辑判据的第二份"。**
 */
export function isTypableDOMElement({ element }: { element: HTMLElement }): boolean {
  if (element.isContentEditable) return true;

  if (element.tagName === 'INPUT') {
    return !(element as HTMLInputElement).disabled;
  }

  if (element.tagName === 'TEXTAREA') {
    return !(element as HTMLTextAreaElement).disabled;
  }

  return false;
}
