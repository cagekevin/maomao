import { generateId } from '../core/idGen.ts';
import { applyNodeTypeDefaults } from './nodeDefaults.ts';
import type { Node, Edge } from '@xyflow/react';

/**
 * 节点派生统一契约 —— 「建子节点 + 自动连线」的原子快照构造器。
 *
 * 背景：画布上多个节点（TextGenerate/VideoProcessNode/GridSplitNode 等）都需要「新建子节点并自动连一条
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

export interface CanvasXY {
  x: number;
  y: number;
}

/** 子节点规格（buildSpawnNodes 入参；position 缺省时基于父节点偏移） */
export interface SpawnChildSpec {
  id?: string;
  type: string;
  data?: Record<string, unknown>;
  position?: CanvasXY;
  style?: object;
  label?: string;
}

/** 边的附加选项（默认 source=父, target=子） */
export interface SpawnEdgeOpts {
  id?: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
  animated?: boolean;
}

/** buildSpawnNodes 的产物（待提交的新节点与边，不含旧状态） */
export interface SpawnResult {
  childNodes: Node[];
  edges: Edge[];
}

/**
 * 生成一个子节点的 id（保留语义前缀 + 唯一后缀）。
 * @param prefix 语义前缀（如 'text-split'/'box'/'split'）
 */
export function makeChildId(prefix: string): string {
  return `${prefix}-${generateId('n')}`;
}

/**
 * 构造「建子节点 + 连线」的原子快照。
 */
export function buildSpawnNodes(
  parentNode: { id?: string; position?: CanvasXY } | null | undefined,
  childSpecs: SpawnChildSpec[],
  edgeOpts: SpawnEdgeOpts = {},
): SpawnResult {
  const parentId = parentNode?.id;
  const base = parentNode?.position || { x: 0, y: 0 };

  const childNodes: Node[] = childSpecs.map((spec, i) => ({
    id: spec.id || makeChildId('derived'),
    type: spec.type,
    position: spec.position || { x: base.x + 40, y: base.y + i * 200 + 40 },
    data: spec.data || {},
    ...(spec.style ? { style: spec.style } : {}),
  }));

  const edges: Edge[] = childNodes.map((c) => ({
    id: edgeOpts.id ? `${edgeOpts.id}-${c.id}` : `e-${parentId}-${c.id}`,
    source: parentId,
    target: c.id,
    ...(edgeOpts.sourceHandle !== undefined ? { sourceHandle: edgeOpts.sourceHandle } : {}),
    ...(edgeOpts.targetHandle !== undefined ? { targetHandle: edgeOpts.targetHandle } : {}),
    ...(edgeOpts.type ? { type: edgeOpts.type } : {}),
    ...(edgeOpts.animated !== undefined ? { animated: edgeOpts.animated } : {}),
  }));

  return { childNodes, edges };
}

/**
 * 「建子节点 + 连线」的原子提交：把调用方重复的「算快照 → setNodes → setEdges → history.record」
 * 三连收口为单点（消除 9 处复制）。
 *
 * 【TD-04-11（2026-09-11）】原 `applySpawnSnapshot` 帮助函数已删——Director3DNode 是最后一个手写
 * 「applySpawnSnapshot + setNodes/setEdges/record」的调用方，收口到 spawnAndCommit 后它再无生产消费者
 * （仅自证单测），属死代码。快照计算已内联进 commitNewNodes。
 *
 * 为什么收口：此前每处调用方各写一遍提交三连，且必须「先基于 getNodes()/getEdges() 当前值算快照，
 * 再 setNodes/setEdges，再 history.record(显式快照)」——顺序错了 undo 会丢新增节点（useCanvasHistory 红线）。
 * 收口后顺序唯一正确，调用方只需传 spawned 与画布句柄，零机会写错。
 *
 * @returns spawned.childNodes（供调用方需拿新建节点 id 时用，如 GridSplit）
 */
export interface CanvasCommitHandles {
  getNodes(): Node[];
  getEdges(): Edge[];
  setNodes(fn: (ns: Node[]) => Node[]): void;
  setEdges(fn: (es: Edge[]) => Edge[]): void;
  /** useCanvasHistory 实例（可选，缺则跳过 record） */
  history?: { record(snapshot: { nodes: Node[]; edges: Edge[] }): void };
}

/**
 * 「提交一批新建节点到画布」的**唯一原子原语**（TD-04-2 收口）——所有自建子节点的宿主共用。
 *
 * 【为什么抽】画布上有两类「自建子节点」场景，此前各写一遍提交逻辑、且**行为不一致**：
 *   - A 类（node 内 spawn，经 spawnAndCommit）：applySpawnSnapshot + setNodes/setEdges + history.record ✅
 *   - B 类（AssetNode 相机工作室 / ImageGenerate / useScriptBoxEngine 内联建节点）：
 *     裸 addNodes/addEdges（或 setEdges），**不补结构默认、不进 undo 栈** ❌
 * 本原语把「建子节点」的唯一正确语义固化为三段：**① 补结构默认 → ② 原子写 → ③ 记历史**，
 * 两类场景统一走它。B 类只需补 history 句柄（useCanvasEdges）与形状对齐。
 *
 * 【为什么不变量如此】结构默认（width/style/className…）不补齐会导致「新建 vs 快照还原」字段漂移
 * （nodeDefaults 单源表就是为此存在）；不进 history 会让 Ctrl+Z 撤不掉刚建的节点（用户可感 bug）。
 *
 * 【顺序红线】必须「先基于 getNodes()/getEdges() 当前值算 next 快照，再 setState，再 record(显式快照)」——
 * 否则 undo 丢新增节点（见 useCanvasHistory record 语义）。本原语已固化该顺序，调用方零机会写错。
 *
 * @param payload.nodes 待追加节点（会被 applyNodeTypeDefaults 补齐结构默认，不覆盖已有字段）
 * @param payload.edges 随节点一并追加的边（可为空，如剧本盒子的边由引擎另行写入）
 * @returns 补齐结构默认后的节点数组（供调用方需拿 id/实测尺寸时用）
 */
export function commitNewNodes(
  payload: { nodes?: Node[]; edges?: Edge[] },
  handles: CanvasCommitHandles,
): Node[] {
  const nodes = (payload.nodes || []).map((n) => applyNodeTypeDefaults(n) as unknown as Node);
  const edges = payload.edges || [];
  // 仅在需要记历史时才读 getEdges（无 history 的宿主/最小 mock 不必提供 getEdges）。
  const snapshot = handles.history
    ? { nodes: handles.getNodes().concat(nodes), edges: handles.getEdges().concat(edges) }
    : null;
  handles.setNodes((ns) => ns.concat(nodes));
  if (edges.length) handles.setEdges((es) => es.concat(edges));
  if (snapshot) handles.history?.record(snapshot);
  return nodes;
}

/** spawnAndCommit = buildSpawnNodes 产物 → commitNewNodes 的薄包装（保持既有 8 处调用签名不变）。 */
export function spawnAndCommit(spawned: SpawnResult, handles: CanvasCommitHandles): Node[] {
  return commitNewNodes({ nodes: spawned.childNodes, edges: spawned.edges }, handles);
}
