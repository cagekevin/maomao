import { useSyncExternalStore } from 'react';

/**
 * ════════════════════════════════════════════════════════════════
 * 节点瞬态运行态 store（nodeRuntimeStore）—— 阶段二收口
 * ════════════════════════════════════════════════════════════════
 *
 * 【为什么有它（节点动画控制收口 · 阶段二）】
 * 此前同一语义「loading/processing」两种存法：
 *   - 生成节点（PromptNode/TextNode/…）loading = 组件内 useState
 *   - VideoProcessNode loading = node.data.loading
 * 复制带 data.loading 的节点时，半个「进行中标记」被复制走，造成「复制后互相干扰」。
 * 收口本质：给这些「持续渲染 / 需互斥的瞬态」一个统一的、可被复制安全隔离的拥有者。
 *
 * 【为什么内存 map 而非 node.data】
 *  - loading/error/progress 是纯瞬态，落盘无意义、被复制会造成新干扰。
 *  - 内存 map 天然规避「复制复制走 loading」：瞬态不进画布快照，副本是干净副本。
 *
 * 【数据流】
 *   写：各节点经 updateNodeRuntime(nodeId, patch) 统一写入（禁散写 useState / data.loading）
 *   读：useNodeRuntime(nodeId) 用 useSyncExternalStore 订阅，返回 { loading, error, progress }
 *   清理：节点卸载/删除时 clearNodeRuntime(nodeId)，防内存残留
 *   不落盘：仅内存级，与画布快照 / 任务中心无关
 *
 * 【失败可见】Map 条目懒创建（缺省默认态），无任何吞错路径。
 * 【幂等】set 整对象替换，非原地 mutate，天然幂等。
 */
export interface NodeRuntimeState {
  loading: boolean;
  error: string;
  progress: number;
}

/** 缺省瞬态（未初始化条目也返回此形状，避免上层读 undefined） */
const DEFAULT_STATE: Readonly<NodeRuntimeState> = { loading: false, error: '', progress: 0 };

const stateMap = new Map<string, NodeRuntimeState>();
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** 非 React 环境读取某节点瞬态（供脚本 / 模块级逻辑用）。 */
export function getNodeRuntime(nodeId: string): NodeRuntimeState {
  return stateMap.get(nodeId) ?? DEFAULT_STATE;
}

/**
 * 统一写入口：整对象替换该节点瞬态（loading/error/progress）。
 * 任何新增瞬态字段在此扩展 NodeRuntimeState 即可，调用方按需传 patch。
 */
export function updateNodeRuntime(nodeId: string, patch: Partial<NodeRuntimeState>): void {
  stateMap.set(nodeId, { ...getNodeRuntime(nodeId), ...patch });
  notify();
}

/** 节点卸载 / 删除时清理其瞬态条目，防内存残留。 */
export function clearNodeRuntime(nodeId: string): void {
  if (!stateMap.delete(nodeId)) return;
  notify();
}

/**
 * React 订阅钩子：节点组件读自身瞬态，返回 { loading, error, progress }。
 * 用 useSyncExternalStore，任何字段变更都会触发重渲（瞬态高频，量小可接受）。
 */
export function useNodeRuntime(nodeId: string): NodeRuntimeState {
  const getSnapshot = () => getNodeRuntime(nodeId);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
