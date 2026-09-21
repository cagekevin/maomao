import { useCallback, useSyncExternalStore } from 'react';
import { useEditorInstance } from '@/components/videoEditor/hooks-cutia/use-editor';
import type { EditorCore } from '@/components/videoEditor/engine/core';

type ElementRef = { trackId: string; elementId: string };

/**
 * 「订阅选中元素」的**唯一 React 桥接**（内部实现，勿在别处再写一份）。
 *
 * 【为什么必须收口（TD-04-45）】此前同一件事在 `use-element-selection` /
 * `use-preview-interaction` / `selection-overlay` **三处逐字重复**，且都是内联箭头：
 * ① 三份判据（一归违反）；② 两个箭头**每次渲染新建引用** ⇒ `useSyncExternalStore`
 * 每次渲染都解绑重绑订阅（预览区按帧重渲时尤甚）。
 * ⇒ 收口成这一份，`subscribe` / `getSnapshot` 用 `useCallback` 按 `editor` 稳定。
 *
 * 返回数组的**引用稳定**由 `SelectionManager` 保证（状态未变时返回同一
 * `visibleElements`，见该类注释「引用必须稳定」）⇒ 不会因"每次新数组"而无限重渲。
 */
function useSelectionSnapshot(editor: EditorCore): ElementRef[] {
  const subscribe = useCallback(
    (listener: () => void) => editor.selection.subscribe(listener),
    [editor],
  );
  const getSnapshot = useCallback(() => editor.selection.getSelectedElements(), [editor]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * 只读订阅：当前选中的元素列表。
 * 消费方只读选择时用它（窄接口）；需要选择操作（增删/切换/清空）才用 `useElementSelection`。
 */
export function useSelectedElements(): ElementRef[] {
  return useSelectionSnapshot(useEditorInstance());
}

export function useElementSelection() {
  const editor = useEditorInstance();
  const selectedElements = useSelectionSnapshot(editor);

  const isElementSelected = useCallback(
    ({ trackId, elementId }: ElementRef) =>
      selectedElements.some(
        (element) => element.trackId === trackId && element.elementId === elementId,
      ),
    [selectedElements],
  );

  const selectElement = useCallback(
    ({ trackId, elementId }: ElementRef) => {
      editor.selection.setSelectedElements({ elements: [{ trackId, elementId }] });
    },
    [editor],
  );

  const addElementToSelection = useCallback(
    ({ trackId, elementId }: ElementRef) => {
      const alreadySelected = selectedElements.some(
        (element) => element.trackId === trackId && element.elementId === elementId,
      );
      if (alreadySelected) return;

      editor.selection.setSelectedElements({
        elements: [...selectedElements, { trackId, elementId }],
      });
    },
    [selectedElements, editor],
  );

  const removeElementFromSelection = useCallback(
    ({ trackId, elementId }: ElementRef) => {
      editor.selection.setSelectedElements({
        elements: selectedElements.filter(
          (element) => !(element.trackId === trackId && element.elementId === elementId),
        ),
      });
    },
    [selectedElements, editor],
  );

  const toggleElementSelection = useCallback(
    ({ trackId, elementId }: ElementRef) => {
      const alreadySelected = selectedElements.some(
        (element) => element.trackId === trackId && element.elementId === elementId,
      );

      if (alreadySelected) {
        removeElementFromSelection({ trackId, elementId });
      } else {
        addElementToSelection({ trackId, elementId });
      }
    },
    [selectedElements, addElementToSelection, removeElementFromSelection],
  );

  const clearElementSelection = useCallback(() => {
    editor.selection.clearSelection();
  }, [editor]);

  const setElementSelection = useCallback(
    ({ elements }: { elements: ElementRef[] }) => {
      editor.selection.setSelectedElements({ elements });
    },
    [editor],
  );

  /**
   * Handles click interaction on an element.
   * - Regular click: select only this element
   * - Multi-key click (Ctrl/Cmd): toggle this element in selection
   */
  const handleElementClick = useCallback(
    ({ trackId, elementId, isMultiKey }: ElementRef & { isMultiKey: boolean }) => {
      if (isMultiKey) {
        toggleElementSelection({ trackId, elementId });
      } else {
        selectElement({ trackId, elementId });
      }
    },
    [toggleElementSelection, selectElement],
  );

  return {
    selectedElements,
    isElementSelected,
    selectElement,
    setElementSelection,
    addElementToSelection,
    removeElementFromSelection,
    toggleElementSelection,
    clearElementSelection,
    handleElementClick,
  };
}
