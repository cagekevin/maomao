import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { EditorCore } from '@/components/videoEditor/engine/core';

/** `useEditor` 可订阅的**子 store** —— 即 `EditorCore` 上真正带 `subscribe` 的全部 7 个。 */
export type EditorStoreKey =
  'playback' | 'timeline' | 'scenes' | 'project' | 'media' | 'renderer' | 'selection';

/** 默认订阅面 = 全部 7 个（不传参时与原实现逐字等价）。 */
const ALL_STORES: readonly EditorStoreKey[] = [
  'playback',
  'timeline',
  'scenes',
  'project',
  'media',
  'renderer',
  'selection',
];

/**
 * 取编辑器实例，并按需订阅**指定的**子 store。
 *
 * 【为什么要有这个参数（TD-04-40）】原实现无条件合并订阅 **7 个** store ⇒ 任一 store 变更，
 * 全部 `useEditor()` 调用者**一起重渲**。而多数消费方只读其中 1–2 个（如只读 `timeline`）——
 * 播放期 `playback` **每帧**通知，这些组件就被**每帧**连坐重渲。
 * ⇒ 调用方声明自己读哪些 store，订阅面从 7 收窄到实际所需。
 *
 * 【怎么用（判据 · 取并集）】把该文件里出现的 `editor.<store>.*` 的 store **全部**列上 ——
 * 渲染期读的、回调 / effect 里读的**都算**。**多列是安全的（只是多订阅）；少列会静默不更新。**
 * 不传参 = 订阅全部 7 个（向后兼容）：新调用点若不确定该列哪些，**不传**即保持原行为。
 *
 * 【为什么 `command` / `save` / `audio` 不在可订阅之列】它们**没有自己的订阅面**，状态由上述 7 个
 * 派生（`save-manager` 订阅 scenes/timeline、`audio-manager` 订阅 playback/timeline/media）
 * ⇒ 订阅那 7 个即已覆盖它们的变更。
 *
 * 【引用稳定性】订阅面按**稳定字符串**入依赖（调用点传字面量 ⇒ 结果恒等），
 * 故不会每次渲染换 `subscribe` 引用而解绑重绑订阅（同 TD-04-45 的教训）。
 */
/**
 * 只取编辑器实例，**不订阅任何 store**。
 *
 * 【什么时候用它】调用方**只调命令**、或**自己另有更精确的订阅**时 —— 典型是
 * `use-element-selection`：它的选中态已由 `useSelectionSnapshot`（订阅 `selection`）提供，
 * 再走 `useEditor()` 会**重复订阅同一个 store**。**别拿它当"默认更省"用** ——
 * 渲染期读 store 状态的组件必须走 `useEditor(...stores)`，否则会**静默不更新**。
 */
export function useEditorInstance(): EditorCore {
  return useMemo(() => EditorCore.getInstance(), []);
}

export function useEditor(...stores: EditorStoreKey[]): EditorCore {
  const editor = useMemo(() => EditorCore.getInstance(), []);
  const versionRef = useRef(0);
  const storeKey = stores.length ? [...new Set(stores)].sort().join(',') : 'all';

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const handleStoreChange = () => {
        versionRef.current += 1;
        onStoreChange();
      };

      const keys = storeKey === 'all' ? ALL_STORES : (storeKey.split(',') as EditorStoreKey[]);
      const unsubscribers = keys.map((k) => editor[k].subscribe(handleStoreChange));

      return () => {
        for (const unsubscribe of unsubscribers) {
          unsubscribe();
        }
      };
    },
    [editor, storeKey],
  );

  const getSnapshot = useCallback(() => versionRef.current, []);

  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return editor;
}
