import { generateId } from './idGen.ts'
import type { Node, Edge } from '@xyflow/react'

/**
 * 节点派生统一契约 —— 「建子节点 + 自动连线」的原子快照构造器。
 *
 * 背景：画布上多个节点（TextNode/VideoProcessNode/GridSplitNode 等）都需要「新建子节点并自动连一条
 * 边」。此前各节点用裸 setNodes/setEdges 拼接，且均未进 undo 栈（useCanvasHistory 未 record）。
 * 本工具把「读当前快照 → 构造 nextNodes/nextEdges」这层同构骨架收敛为纯函数，可单测；子节点的
 * data 构造（每处业务不同）由调用方提供 childSpecs。
 *
 * 用法：
 *   const spawned = buildSpawnNodes(parentNode, childSpecs, edgeOpts)
 *   调用方统一走 spawnAndCommit(spawned, { getNodes, getEdges, setNodes, setEdges, history })
 *   原子提交（提交三连已收口，禁止调用方再手写 setNodes/setEdges/history.record）。
 *
 * 注意：必须「先基于 getNodes()/getEdges() 当前值计算 next 快照，再 setState 再 record(显式快照)」，
 * 否则 undo 会丢新增节点（见 useCanvasHistory 的 record 语义）。该顺序已固化在 spawnAndCommit 内。
 */

export interface CanvasXY { x: number; y: number }

/** 子节点规格（buildSpawnNodes 入参；position 缺省时基于父节点偏移） */
export interface SpawnChildSpec {
  id?: string
  type: string
  data?: Record<string, unknown>
  position?: CanvasXY
  style?: object
  label?: string
}

/** 边的附加选项（默认 source=父, target=子） */
export interface SpawnEdgeOpts {
  id?: string
  sourceHandle?: string
  targetHandle?: string
  type?: string
  animated?: boolean
}

/** buildSpawnNodes 的产物（待提交的新节点与边，不含旧状态） */
export interface SpawnResult { childNodes: Node[]; edges: Edge[] }

/**
 * 生成一个子节点的 id（保留语义前缀 + 唯一后缀）。
 * @param prefix 语义前缀（如 'text-split'/'box'/'split'）
 */
export function makeChildId(prefix: string): string {
  return `${prefix}-${generateId('n')}`
}

/**
 * 构造「建子节点 + 连线」的原子快照。
 */
export function buildSpawnNodes(
  parentNode: { id?: string; position?: CanvasXY } | null | undefined,
  childSpecs: SpawnChildSpec[],
  edgeOpts: SpawnEdgeOpts = {}
): SpawnResult {
  const parentId = parentNode?.id
  const base = parentNode?.position || { x: 0, y: 0 }

  const childNodes: Node[] = childSpecs.map((spec, i) => ({
    id: spec.id || makeChildId('derived'),
    type: spec.type,
    position: spec.position || { x: base.x + 40, y: base.y + i * 200 + 40 },
    data: spec.data || {},
    ...(spec.style ? { style: spec.style } : {}),
  }))

  const edges: Edge[] = childNodes.map((c) => ({
    id: edgeOpts.id ? `${edgeOpts.id}-${c.id}` : `e-${parentId}-${c.id}`,
    source: parentId,
    target: c.id,
    ...(edgeOpts.sourceHandle !== undefined ? { sourceHandle: edgeOpts.sourceHandle } : {}),
    ...(edgeOpts.targetHandle !== undefined ? { targetHandle: edgeOpts.targetHandle } : {}),
    ...(edgeOpts.type ? { type: edgeOpts.type } : {}),
    ...(edgeOpts.animated !== undefined ? { animated: edgeOpts.animated } : {}),
  }))

  return { childNodes, edges }
}

/**
 * 基于当前画布状态计算「追加子节点+边」后的完整 next 快照（用于 record）。
 */
export function applySpawnSnapshot(
  currentNodes: Node[],
  currentEdges: Edge[],
  spawned: SpawnResult
): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: currentNodes.concat(spawned.childNodes),
    edges: currentEdges.concat(spawned.edges),
  }
}

/**
 * 「建子节点 + 连线」的原子提交：把调用方重复的「applySpawnSnapshot → setNodes → setEdges → history.record」
 * 三连收口为单点（消除 9 处复制）。
 *
 * 为什么收口：此前每处调用方各写一遍提交三连，且必须「先基于 getNodes()/getEdges() 当前值算快照，
 * 再 setNodes/setEdges，再 history.record(显式快照)」——顺序错了 undo 会丢新增节点（useCanvasHistory 红线）。
 * 收口后顺序唯一正确，调用方只需传 spawned 与画布句柄，零机会写错。
 *
 * @returns spawned.childNodes（供调用方需拿新建节点 id 时用，如 GridSplit）
 */
export interface CanvasCommitHandles {
  getNodes(): Node[]
  getEdges(): Edge[]
  setNodes(fn: (ns: Node[]) => Node[]): void
  setEdges(fn: (es: Edge[]) => Edge[]): void
  /** useCanvasHistory 实例（可选，缺则跳过 record） */
  history?: { record(snapshot: { nodes: Node[]; edges: Edge[] }): void }
}

export function spawnAndCommit(spawned: SpawnResult, handles: CanvasCommitHandles): Node[] {
  const snapshot = applySpawnSnapshot(handles.getNodes(), handles.getEdges(), spawned)
  handles.setNodes((ns) => ns.concat(spawned.childNodes))
  handles.setEdges((es) => es.concat(spawned.edges))
  handles.history?.record(snapshot)
  return spawned.childNodes
}