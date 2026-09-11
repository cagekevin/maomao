import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

/**
 * 节点「本地 state ↔ node.data 字段」落盘：一个可编辑字段一行搞定的统一实现。
 *
 * 【为什么要有它】此前每个可编辑字段（prompt / text / autoSplit / inputLocked …）在每个节点里
 * 都要手写三段样板：
 *   const [x, setX] = useState(data.x || '');
 *   const setXPersist = useCallback((v) => setX((prev) => (typeof v === 'function' ? v(prev) : v)), []);
 *   useEffect(() => { patchDebounced({ x }); }, [x]);
 * 三段在 ImageGenerate / TextGenerate / VideoGenerate / TemplateNode 逐字重复；其中 setXPersist
 * 纯属多余 —— useState 的 setter 本就支持函数式更新，只是类型标注需要显式写成 SetStateAction。
 *
 * 【用法】
 *   const { patchData, patchDebounced } = useNodeData(id);
 *   const [prompt, setPrompt] = useNodeField('prompt', data.prompt || '', patchDebounced); // 高频输入 → 防抖
 *   const [autoSplit, setAutoSplit] = useNodeField('autoSplit', data.autoSplit || false, patchData); // 低频 → 即时
 *
 * 【说明】
 *  - 写回不在 setState updater 里做（渲染期 setNodes → BatchProvider 警告），统一由 effect 落盘；
 *    因此必须在 useNodeData(id) 之后调用本 hook（writer 需先就位）。
 *  - 只负责本地 state → node.data；外部（Agent update_node / Tab 快捷键）改 data → 本地 state 的同步
 *    由 useGenerateNode 的 sync 参数 / useSyncNodeData 负责，两处不重叠、不打架。
 *  - 防抖实例与卸载 flush 由 useNodeData 的 patchDebounced 承接，本 hook 不重复注册。
 */
export function useNodeField<T>(
  field: string,
  initial: T,
  write: (patch: Record<string, unknown>) => void,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial);
  // write 由 useNodeData 记忆化（引用稳定）；ref 兜底，防止调用方每渲染传新函数导致 effect 反复重跑
  const writeRef = useRef(write);
  writeRef.current = write;
  useEffect(() => {
    writeRef.current({ [field]: value });
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return [value, setValue];
}
