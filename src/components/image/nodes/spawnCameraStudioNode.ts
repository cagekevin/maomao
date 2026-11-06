import type { Node, Edge } from '@xyflow/react';
import type { CameraStudioResult } from '../editors/cameraParams/cameraStudio';
import {
  commitNewNodes,
  type CanvasCommitHandles,
} from '@/components/canvas/structure/deriveNodes';
import { injectNodePrefs } from '@/components/canvas/contract/nodePrefs';
import { generateId } from '@/components/base/core/idGen';

/**
 * 摄影棚生成回调的唯一实现（2026-11-06 · handleCameraStudioGenerate 两份 40 行手抄收口）。
 *
 * 【语义】用户在摄影棚面板点「生成」：以当前节点为源，右下偏移新建一个 imageGenerateNode
 * （预填摄影棚提示词、注入记忆参数），连一条 source→target 边提供垫图，并原子进 undo 栈。
 *
 * 【为什么存在】AssetNode.tsx 与 ImageGenerate.tsx 各抄一份逐字相同的 40 行体
 * （除一行注释措辞外完全一致）；TD-04-2 只收口了 commitNewNodes 提交段，本场景体未抽。
 *
 * 【【同步默认参数】】摄像机新建节点绕过 App.addNode，需手动注入上次记忆的参数
 * （模型/比例/尺寸，injectNodePrefs），否则新 imageGenerateNode 落到纯常量默认
 * （Auto/1K/空模型），与手动新建的生图节点默认不一致（记忆只影响新建，不污染存量）。
 *
 * 【modeLabel】节点标题按模式派生：camera=摄影机视角 / lighting=摄影棚打光 / dual=视角与打光。
 *
 * 【用法】（两个节点组件内）
 * ```
 * const handleCameraStudioGenerate = useCallback(
 *   (result: CameraStudioResult) => {
 *     const done = spawnCameraStudioNode(result, {
 *       sourceId: id, getNodes, setNodes, getEdges, setEdges, history: history ?? undefined,
 *     });
 *     if (done) setIsCameraStudioOpen(false);
 *   },
 *   [id, getNodes, getEdges, setNodes, setEdges, history],
 * );
 * ```
 *
 * @returns 是否已提交（源节点不存在时返回 false，调用方不关面板）。
 */
export function spawnCameraStudioNode(
  result: CameraStudioResult,
  ctx: {
    sourceId: string;
    getNodes: CanvasCommitHandles['getNodes'];
    getEdges: CanvasCommitHandles['getEdges'];
    setNodes: CanvasCommitHandles['setNodes'];
    setEdges: CanvasCommitHandles['setEdges'];
    history?: CanvasCommitHandles['history'];
  },
): boolean {
  const sourceNode = ctx.getNodes().find((n: Node) => n.id === ctx.sourceId);
  if (!sourceNode) return false;

  const { mode, prompt } = result;
  const modeLabel =
    mode === 'camera' ? '摄影机视角' : mode === 'lighting' ? '摄影棚打光' : '视角与打光';

  const newNodeId = generateId();
  // 新节点位置：右下偏移，避免重叠
  const newPos = {
    x: sourceNode.position.x + 340,
    y: sourceNode.position.y + 300,
  };

  const nodeData: Record<string, unknown> = {
    type: 'imageGenerateNode',
    label: modeLabel,
    prompt: prompt,
    role: 'generator',
    status: 'idle',
    promptState: 'completed',
  };
  injectNodePrefs('imageGenerateNode', nodeData);

  const newNode = {
    id: newNodeId,
    type: 'imageGenerateNode',
    position: newPos,
    data: nodeData,
  };

  const newEdge = {
    id: `e-${ctx.sourceId}-${newNodeId}`,
    source: ctx.sourceId,
    target: newNodeId,
  } satisfies Edge;

  // TD-04-2：自建子节点统一走 commitNewNodes（补结构默认 width/height/style + 原子写 + 进 undo 栈）。
  // 原裸 addNodes/addEdges 不补结构默认（手写 420 与 nodeDefaults 漂移）、不进 history（Ctrl+Z 撤不掉）。
  commitNewNodes(
    { nodes: [newNode], edges: [newEdge] },
    {
      getNodes: ctx.getNodes,
      getEdges: ctx.getEdges,
      setNodes: ctx.setNodes,
      setEdges: ctx.setEdges,
      history: ctx.history,
    },
  );
  return true;
}
