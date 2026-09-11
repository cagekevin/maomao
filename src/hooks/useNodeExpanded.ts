import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useReactFlow } from '@xyflow/react';
import { patchNodeDataById } from './useNodeData.ts';

/**
 * 节点抽屉展开态：本地 state + 写回 data.expanded + 外部（Tab 快捷键 / Agent）同步，单一实现。
 *
 * 【为什么要有它】同一段「state 初始化 + toggle + 写回 effect + 外部同步 effect」在 4 个节点逐字重复
 *   （ImageGenerate / TextGenerate / VideoGenerate / TemplateNode）：
 *     const [expanded, setExpanded] = useState(data.expanded === undefined ? true : data.expanded);
 *     useEffect(() => { patchData({ expanded }); }, [expanded]);
 *     useEffect(() => { if (data.expanded !== undefined && data.expanded !== expanded) setExpanded(data.expanded); }, [data.expanded]);
 *
 * 【用法】
 *   const { expanded, toggleExpanded } = useNodeExpanded(id, data.expanded);
 *   // 需要自定义 toggle 语义（如 TextGenerate 的输入锁：锁着只许收起）时，用返回的 setExpanded 自写：
 *   const { expanded, setExpanded } = useNodeExpanded(id, data.expanded);
 *
 * 【两条反模式约束（原样保留，勿改）】
 *  - 写回不在 setState updater 里做：那会在渲染期间 setNodes → BatchProvider 警告。改由 effect 监听本地 state 落盘。
 *  - 外部同步 effect 依赖 data.expanded（非整个 data）：Agent/Tab 改 data 时才回写本地 state，避免与写回 effect 打架。
 *
 * 必须在 ReactFlowProvider 树内调用（经 useReactFlow 取 setNodes），节点天然满足。
 */
export function useNodeExpanded(
  id: string,
  dataExpanded: boolean | undefined,
): {
  expanded: boolean;
  setExpanded: Dispatch<SetStateAction<boolean>>;
  toggleExpanded: () => void;
} {
  const { setNodes } = useReactFlow();
  const [expanded, setExpanded] = useState(dataExpanded === undefined ? true : dataExpanded);

  // 本地 state 变化 → 写回 node.data（effect 内 setNodes 合法，不在渲染期）
  useEffect(() => {
    patchNodeDataById(setNodes, id, { expanded });
  }, [expanded]); // eslint-disable-line react-hooks/exhaustive-deps

  // 全局快捷键（Tab）/ Agent 改 data.expanded → 同步回本地 state
  useEffect(() => {
    if (dataExpanded !== undefined && dataExpanded !== expanded) setExpanded(dataExpanded);
  }, [dataExpanded]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpanded = useCallback(() => setExpanded((v) => !v), []);
  return { expanded, setExpanded, toggleExpanded };
}
