/**
 * `DataTransfer` 替身（拖拽用例）。
 *
 * 【为什么这里允许"一次双转"】jsdom 的 `DataTransfer` 不完整（`types` 由 `setData` 派生、
 * 不能预设；`items`/`files` 也不能直接赋值），而拖拽用例恰恰需要**预设** `types`/`files`
 * 来表达「外部文件拖入」「内部素材拖拽」等场景。属 jsdom 能力缺口（同 `helpers/dom.ts`）。
 *
 * 调用点只描述差异（types / files / 初始 store），不再各自拼形状 + 断言。
 */
export function fakeDataTransfer(
  init: {
    types?: string[];
    files?: File[];
    /** 内部拖拽的载荷存储（`setData`/`getData` 共用） */
    store?: Record<string, string>;
    /** 额外成员（如 `_store`、自定义 `getData`），原样合并 */
    extra?: Record<string, unknown>;
  } = {},
): DataTransfer {
  const store = init.store ?? {};
  return {
    types: init.types ?? [],
    files: init.files ?? [],
    setData: (k: string, v: string) => {
      store[k] = v;
    },
    getData: (k: string) => store[k] ?? '',
    setDragImage: () => {},
    effectAllowed: 'all',
    dropEffect: 'none',
    ...init.extra,
  } as unknown as DataTransfer;
}
