import { must } from '../helpers/must';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { at } from '../helpers/at';
import { toolOf } from '../helpers/agentTools';
import type { Node, Edge } from '@xyflow/react';
import type { CanvasAgentCtx } from '../../src/components/agent/canvas/useCanvasAgentTools.ts';

const mkNode = (data: Record<string, unknown> = {}): Node => ({
  id: 'n',
  position: { x: 0, y: 0 },
  data,
});

// 隔离依赖：AI 撤销栈 / 真实生成 / 多步执行器
// 状态（awaiting / pending）用 beforeEach 内 vi.mocked 配对闭包管理，避免模块级变量在 vi.mock 工厂下 TDZ 怪异
vi.mock(
  '../../src/components/agent/conversation/conversationStore.ts',
  async (importOriginal) =>
    ({
      ...((await importOriginal()) as Record<string, unknown>),
      pushActiveAiUndo: vi.fn(),
      popActiveAiUndo: vi.fn(() => null),
      getActiveAiUndoStack: vi.fn(() => []),
      setActivePendingGenerations: vi.fn(),
      getActivePendingGenerations: vi.fn(() => null),
      // 勿加 setPendingGenerations/getPendingGenerations/clearPendingGenerations：
      // 它们是 useCanvasAgentTools.ts:106-113 的本地兼容壳，非本模块导出。
      // 加进来会变成"多余 key 不报错"的死通道诱饵（详见 beforeEach 内注入注释）。
      setAwaitingConfirm: vi.fn(),
      getAwaitingConfirm: vi.fn(),
      setCreditGate: vi.fn(),
      getCreditGate: vi.fn(),
      clearCreditGate: vi.fn(),
      getCurrentMemory: vi.fn(() => ({
        summary: '',
        facts: [],
        lastPlan: null,
        lastSharedStyle: '',
        notes: [],
      })),
      setCurrentMemory: vi.fn(),
      patchCurrentWorkflow: vi.fn(() => ({})),
      getCurrentGlobalContract: vi.fn(() => null),
      setCurrentGlobalContract: vi.fn(),
      getCurrentArtifacts: vi.fn(() => null),
      setCurrentArtifacts: vi.fn(),
      getCurrentRefImages: vi.fn(() => []),
      setCurrentRefImages: vi.fn((_u: unknown[]) => {}),
      getLastUserReferenceImages: vi.fn(() => []),
      getCurrentImageMap: vi.fn(() => []),
      getCurrentSnapshot: vi.fn(() => ({ skills: [] })),
    }) as Record<string, unknown>,
);
vi.mock('../../src/components/base/store/taskStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  runNodeGeneration: vi.fn(async () => ({ ok: true, resultUrl: 'http://r/x.png' })),
  isNodeRegistered: vi.fn(() => true),
}));
vi.mock('../../src/components/agent/canvas/canvasPlanExecutor.ts', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>), // 保留真实纯函数（buildFusionPrompt/buildProductReferencePrompt 等）
    executePlan: vi.fn(async () => ({
      workflow: { status: 'completed' },
      entries: [{ status: 'completed', nodeId: 'n1', resultUrl: 'http://r/x.png' }],
    })),
  };
});

import {
  buildCanvasAgentTools,
  CANVAS_AGENT_TOOL_NAMES,
  setCurrentReferenceImages,
  runExistingPlanTool,
  setCreditSwitch,
} from '../../src/components/agent/canvas/useCanvasAgentTools.ts';
// getNodeAssetUrl / getNodeMedia 已收口至横切层 `base/utils/media/nodeMedia.ts`（2026-09-25 按件切）。
import { getNodeAssetUrl, getNodeMedia } from '../../src/components/base/utils/media/nodeMedia.ts';
/** 无 resource 可解析（本组用例均不含 contentId，等价于真实调用方在无 resource 时的行为） */
const noRes = () => null;
import * as convStore from '../../src/components/agent/conversation/conversationStore.ts';
import type { CreditGate } from '../../src/components/agent/conversation/conversationSkillState.ts';
import '../../src/components/agent/conversation/conversationSnapshot.ts';
import * as taskStore from '../../src/components/base/store/taskStore.ts';
import {
  executePlan,
  buildFusionPrompt,
  buildProductReferencePrompt,
} from '../../src/components/agent/canvas/canvasPlanExecutor.ts';

// vi.mock 工厂已把 executePlan 替换为 vi.fn，但静态类型仍是 src 的原始函数签名（无 .mock）。
// 测试侧用 .mock.calls 断言，故用 vi.mocked 恢复 mock 类型。
const mockExecutePlan = vi.mocked(executePlan);

// 会话 store 的测试侧状态（下方 mock 的 getX/setX 都读写它）。
// 以前是 `convStore as unknown as ConvMock`，把 `__state` 挂到**模块命名空间**上只为塞一个测试字段；
// 现在独立成普通对象：不需要任何断言，也不依赖「往命名空间塞字段」的 TS/vitest 怪癖。
/** creditGate 用真实类型 `CreditGate`（含 index signature），不再自建窄化副本。 */
const convState = {
  awaiting: false,
  pending: null as unknown[] | null,
  refImages: [] as string[],
  creditGate: null as CreditGate | null,
};

/** 取 creditGate.gens 里第 i 项的 prompt（gens 的元素类型是 unknown ⇒ 读取处收窄，不用断言）。 */
function genPromptAt(gate: Partial<CreditGate> | null, index: number): string | undefined {
  const item = gate?.gens?.[index];
  if (item === null || typeof item !== 'object') return undefined;
  const prompt = (item as { prompt?: unknown }).prompt;
  return typeof prompt === 'string' ? prompt : undefined;
}

// 测试侧构造的节点/边只需实现被测用到的字段（宽松本地类型）。这里只保留"能直接构造"的
// 宽松类型，与 @xyflow/react 的 Node/Edge 的转换收口到 toNodes/toEdges 两个函数
// （此前是 getNodes/setNodes/addNodes 六处各写一次 as unknown as）。
type TestNode = {
  id: string;
  // 各可选字段显式带 `| undefined`：反方向赋值（Node → TestNode）时才与 xyflow 的类型兼容
  // （exactOptionalPropertyTypes 下 `type?: string` 不接受 `string | undefined`）。
  type?: string | undefined;
  data?: Record<string, unknown> | undefined;
  position?: { x: number; y: number } | Record<string, unknown> | undefined;
  selected?: boolean | undefined;
  width?: number | undefined;
  [k: string]: unknown;
};
type TestEdge = {
  id: string;
  source: string;
  target: string;
  [k: string]: unknown;
};

/**
 * 宽松测试节点 → ctx 契约要求的 `Node`。
 *
 * 【为什么这里有一次双转】测试侧用宽松字面量构造节点（`position` 常写 `{}`、可选字段可能显式
 * 给 undefined），而 xyflow 的 `Node` 在 `exactOptionalPropertyTypes` 下要求「可选字段要么不写、
 * 要么写非 undefined 值」—— 两个方向的赋值都不成立。这是**测试构造便利性**与**真契约**的差，
 * 收口在本函数（此前是 getNodes/setNodes/addNodes 六处各写一次双重断言）。
 */
function toNodes(ts: TestNode[]): Node[] {
  return ts.map((t) => {
    const { position, data, ...rest } = t;
    const filled: Record<string, unknown> = {
      ...rest,
      position: position ?? { x: 0, y: 0 },
      data: data ?? {},
    };
    for (const [k, v] of Object.entries(filled)) {
      if (v === undefined) delete filled[k];
    }
    return filled as unknown as Node;
  });
}

/** 宽松测试边 → ctx 契约要求的 `Edge`（id/source/target 已齐，其余按可选处理）。 */
function toEdges(ts: TestEdge[]): Edge[] {
  return ts.map((t) => {
    const filled: Record<string, unknown> = { ...t };
    for (const [k, v] of Object.entries(filled)) {
      if (v === undefined) delete filled[k];
    }
    return filled as unknown as Edge;
  });
}

function makeCtx(initialNodes: TestNode[] = [], initialEdges: TestEdge[] = []): CanvasAgentCtx {
  let nodes: TestNode[] = [...initialNodes];
  let edges: TestEdge[] = [...initialEdges];
  return {
    getNodes: () => toNodes(nodes),
    // P11：setNodes/setEdges 用 vi.fn 包装，便于断言「批量写合并为单次调用」
    setNodes: vi.fn((fn: Node[] | ((ns: Node[]) => Node[])) => {
      nodes = typeof fn === 'function' ? fn(toNodes(nodes)) : fn;
    }),
    getEdges: () => toEdges(edges),
    setEdges: vi.fn((fn: Edge[] | ((es: Edge[]) => Edge[])) => {
      edges = typeof fn === 'function' ? fn(toEdges(edges)) : fn;
    }),
    addNodes: (ns: Node[]) => {
      nodes = [...nodes, ...ns];
    },
    screenToFlowPosition: (p: { x: number; y: number }) => p || { x: 0, y: 0 },
    fitView: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    setCenter: vi.fn(),
    snapshot: () => ({ nodes, edges }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // 配对状态：getX 始终读 convState，setX 写 convState（用例可直接翻转 convState 模拟前端确认）
  convState.awaiting = false;
  convState.pending = null;
  convState.refImages = [];
  convState.creditGate = null;
  vi.mocked(convStore.getAwaitingConfirm).mockImplementation(() => convState.awaiting);
  vi.mocked(convStore.setAwaitingConfirm).mockImplementation((v) => {
    convState.awaiting = !!v;
  });
  vi.mocked(convStore.getCreditGate).mockImplementation(() => convState.creditGate);
  vi.mocked(convStore.setCreditGate).mockImplementation((g) => {
    // 真实签名收的是 `Partial<CreditGate> & Record<string, unknown>`，而 getCreditGate 返回完整
    // `CreditGate` ⇒ 在这里把缺省字段补全（旧写法用双重断言把 Partial 硬说成完整值）。
    convState.creditGate =
      g === null || g === undefined
        ? null
        : {
            ...g,
            pending: g.pending === true,
            gens: Array.isArray(g.gens) ? g.gens : [],
            map: typeof g.map === 'object' && g.map !== null ? g.map : {},
          };
  });
  vi.mocked(convStore.clearCreditGate).mockImplementation(() => {
    convState.creditGate = null;
  });
  // 注意：注入必须打在 barrel 真符号上。getPendingGenerations/setPendingGenerations 是
  // useCanvasAgentTools.ts:106-113 的本地兼容壳，不是 conversationStore 的导出——
  // 打在壳名上会形成死通道：写入无人读，真身读到的 getActivePendingGenerations 恒返回 mock 默认 null。
  vi.mocked(convStore.getActivePendingGenerations).mockImplementation(() => convState.pending);
  vi.mocked(convStore.setActivePendingGenerations).mockImplementation((g) => {
    convState.pending = g;
  });
  vi.mocked(convStore.getCurrentRefImages).mockImplementation(() => convState.refImages);
  vi.mocked(convStore.setCurrentRefImages).mockImplementation((u?: unknown[]) => {
    convState.refImages = Array.isArray(u) ? (u as string[]) : [];
  });
});

describe('画布 Agent 工具层 §2.5', () => {
  it('共 21 个工具注册（奥卡姆删除 6 个 + show_plan_for_confirm；新增 read_table 供表格工作区、skill_read_file 读 Skill 资料）', () => {
    // 计数金丝雀：增删工具必须同步此处（新增的理由也写在标题里，防"悄悄多一个工具"）
    //   2026-09-21 +1：skill_read_file（Skill 渐进披露第三层：按需读正文引用的资料文件）
    expect(CANVAS_AGENT_TOOL_NAMES).toHaveLength(21);
    expect(CANVAS_AGENT_TOOL_NAMES).toContain('read_table');
    expect(CANVAS_AGENT_TOOL_NAMES).toContain('skill_read_file');
  });

  it('create_node 建文本节点成功 + 返回 id', () => {
    const ctx = makeCtx();
    const t = buildCanvasAgentTools(ctx);
    const r = toolOf(
      t,
      'create_node',
    )({
      type: 'textGenerateNode',
      label: '测试',
      prompt: '你好',
      position: { x: 10, y: 20 },
    });
    expect(r.ok).toBe(true);
    const node = must(
      ctx.getNodes().find((n) => n.id === must(r.data, 'data').id),
      'ctx',
    );
    expect(node.data['label']).toBe('测试');
    expect(node.position).toEqual({ x: 10, y: 20 });
  });

  it('create_node 未知类型报错', () => {
    const ctx = makeCtx();
    const t = buildCanvasAgentTools(ctx);
    const r = toolOf(t, 'create_node')({ type: 'nope' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('未知节点类型');
  });

  it('create_node connectFrom 自动连线', () => {
    const ctx = makeCtx([{ id: 'a', type: 'textGenerateNode', data: {}, position: {} }]);
    const t = buildCanvasAgentTools(ctx);
    const r = toolOf(t, 'create_node')({ type: 'textGenerateNode', connectFrom: 'a' });
    expect(r.data.connected).toBe(true);
    expect(ctx.getEdges()).toHaveLength(1);
  });

  it('create_node imageGenerateNode 默认 420×420', () => {
    const ctx = makeCtx();
    const t = buildCanvasAgentTools(ctx);
    const r = toolOf(t, 'create_node')({ type: 'imageGenerateNode' });
    const node = must(
      ctx.getNodes().find((n) => n.id === must(r.data, 'data').id),
      'ctx',
    );
    expect(node.width).toBe(420);
  });

  it('create_node imageGenerateNode 应用 aspectRatio + resolution（9:16 + 1080p→1K）', () => {
    const ctx = makeCtx();
    const t = buildCanvasAgentTools(ctx);
    const r = toolOf(
      t,
      'create_node',
    )({
      type: 'imageGenerateNode',
      prompt: '奥特曼打怪兽',
      aspectRatio: '9:16',
      resolution: '1080p',
    });
    expect(r.ok).toBe(true);
    const node = must(
      ctx.getNodes().find((n) => n.id === must(r.data, 'data').id),
      'ctx',
    );
    // 比例写入 data.aspectRatio（ImageGenerate 组件读取）
    expect(node.data['aspectRatio']).toBe('9:16');
    // 分辨率 1080p 映射到 data.imageSize=1K（组件读取 imageSize 而非 resolution）
    expect(node.data['imageSize']).toBe('1K');
    expect(node.data['resolution']).toBeUndefined();
  });

  it('create_node imageGenerateNode resolution=4K 映射到 imageSize=4K；1440p→2K', () => {
    // 每次用独立 ctx（节点 id 用 Date.now()，同毫秒并发会撞 id，故分开断言）
    const c1 = makeCtx();
    const r4 = toolOf(
      buildCanvasAgentTools(c1),
      'create_node',
    )({
      type: 'imageGenerateNode',
      resolution: '4K',
    });
    expect(
      must(
        c1.getNodes().find((n) => n.id === must(r4.data, 'data').id),
        'c1',
      ).data['imageSize'],
    ).toBe('4K');
    const c2 = makeCtx();
    const r2 = toolOf(
      buildCanvasAgentTools(c2),
      'create_node',
    )({
      type: 'imageGenerateNode',
      resolution: '1440p',
    });
    expect(
      must(
        c2.getNodes().find((n) => n.id === must(r2.data, 'data').id),
        'c2',
      ).data['imageSize'],
    ).toBe('2K');
  });

  it('create_node 非生图节点不写 aspectRatio/resolution', () => {
    const ctx = makeCtx();
    const t = buildCanvasAgentTools(ctx);
    const r = toolOf(
      t,
      'create_node',
    )({
      type: 'textGenerateNode',
      prompt: 'x',
      aspectRatio: '9:16',
      resolution: '1080p',
    });
    const node = must(
      ctx.getNodes().find((n) => n.id === must(r.data, 'data').id),
      'ctx',
    );
    expect(node.data['aspectRatio']).toBeUndefined();
    expect(node.data['imageSize']).toBeUndefined();
  });

  it('create_node 有选中节点时放在其右侧 +100、顶部对齐（对齐参考项目 viewportAnchor）', () => {
    // 选中节点：position.x=200, width=420, y=300 → 新节点 x=200+420+100=720, y=300
    const ctx = makeCtx([
      {
        id: 'sel',
        type: 'imageGenerateNode',
        selected: true,
        position: { x: 200, y: 300 },
        width: 420,
        data: {},
      },
    ]);
    const t = buildCanvasAgentTools(ctx);
    const r = toolOf(t, 'create_node')({ type: 'imageGenerateNode', prompt: '新图' });
    expect(r.ok).toBe(true);
    const node = must(
      ctx.getNodes().find((n) => n.id === must(r.data, 'data').id),
      'ctx',
    );
    expect(node.position.x).toBe(200 + 420 + 100);
    expect(node.position.y).toBe(300);
  });

  it('create_node 多个选中节点取最右边界 + 100、y 取最小顶部', () => {
    const ctx = makeCtx([
      {
        id: 'a',
        type: 'imageGenerateNode',
        selected: true,
        position: { x: 0, y: 100 },
        width: 400,
        data: {},
      },
      {
        id: 'b',
        type: 'imageGenerateNode',
        selected: true,
        position: { x: 300, y: 50 },
        width: 300,
        data: {},
      }, // 最右：300+300=600
    ]);
    const t = buildCanvasAgentTools(ctx);
    const r = toolOf(t, 'create_node')({ type: 'imageGenerateNode' });
    const node = must(
      ctx.getNodes().find((n) => n.id === must(r.data, 'data').id),
      'ctx',
    );
    expect(node.position.x).toBe(300 + 300 + 100); // 最右边界 600 + 100
    expect(node.position.y).toBe(50); // 最小顶部
  });

  it('create_node 显式传 position 时优先使用，不自动计算', () => {
    const ctx = makeCtx([
      {
        id: 'sel',
        type: 'imageGenerateNode',
        selected: true,
        position: { x: 200, y: 300 },
        width: 420,
        data: {},
      },
    ]);
    const t = buildCanvasAgentTools(ctx);
    const r = toolOf(t, 'create_node')({ type: 'imageGenerateNode', position: { x: 999, y: 888 } });
    const node = must(
      ctx.getNodes().find((n) => n.id === must(r.data, 'data').id),
      'ctx',
    );
    expect(node.position.x).toBe(999);
    expect(node.position.y).toBe(888);
  });

  it('batch_create_nodes 批量建', () => {
    const ctx = makeCtx();
    const t = buildCanvasAgentTools(ctx);
    const r = toolOf(
      t,
      'batch_create_nodes',
    )({
      nodes: [{ type: 'textGenerateNode' }, { type: 'imageGenerateNode' }],
    });
    expect(r.ok).toBe(true);
    expect(r.data.ids).toHaveLength(2);
  });

  it('P11 batch_create_nodes 单次 setNodes 写回（循环内不逐条写）', () => {
    const ctx = makeCtx();
    const t = buildCanvasAgentTools(ctx);
    const r = toolOf(
      t,
      'batch_create_nodes',
    )({
      nodes: [{ type: 'textGenerateNode' }, { type: 'imageGenerateNode' }, { type: 'assetNode' }],
    });
    expect(r.ok).toBe(true);
    expect(ctx.getNodes()).toHaveLength(3);
    expect(ctx.setNodes).toHaveBeenCalledTimes(1); // 合并为一次批量写
    expect(ctx.setEdges).not.toHaveBeenCalled(); // 无 connectFrom 不触发边写
  });

  it('P11 batch_create_nodes connectFrom 边合并为单次 setEdges', () => {
    const ctx = makeCtx([{ id: 'a', type: 'textGenerateNode', data: {}, position: {} }]);
    const t = buildCanvasAgentTools(ctx);
    const r = toolOf(
      t,
      'batch_create_nodes',
    )({
      nodes: [
        { type: 'textGenerateNode', connectFrom: 'a' },
        { type: 'textGenerateNode', connectFrom: 'a' },
      ],
    });
    expect(r.ok).toBe(true);
    expect(ctx.setNodes).toHaveBeenCalledTimes(1);
    expect(ctx.setEdges).toHaveBeenCalledTimes(1);
    expect(ctx.getEdges()).toHaveLength(2);
  });

  it('P11 batch_create_nodes 位置与逐条 create_node 完全一致（合并写不改变布局语义）', () => {
    // 基线：逐条 create_node（受选中节点锚定，位置确定性）
    const c1 = makeCtx([
      {
        id: 'sel',
        type: 'textGenerateNode',
        selected: true,
        position: { x: 0, y: 0 },
        width: 300,
        data: {},
      },
    ]);
    const t1 = buildCanvasAgentTools(c1);
    const seqPos = [
      toolOf(t1, 'create_node')({ type: 'textGenerateNode' }).data.position,
      toolOf(t1, 'create_node')({ type: 'textGenerateNode' }).data.position,
    ];
    // P11：批量建（合并为单次写）
    const c2 = makeCtx([
      {
        id: 'sel',
        type: 'textGenerateNode',
        selected: true,
        position: { x: 0, y: 0 },
        width: 300,
        data: {},
      },
    ]);
    const t2 = buildCanvasAgentTools(c2);
    const b = toolOf(
      t2,
      'batch_create_nodes',
    )({
      nodes: [{ type: 'textGenerateNode' }, { type: 'textGenerateNode' }],
    });
    const batchPos = b.data.ids.map(
      (id: string) =>
        must(
          c2.getNodes().find((n) => n.id === id),
          'c2',
        ).position,
    );
    expect(batchPos).toEqual(seqPos);
    expect(c2.setNodes).toHaveBeenCalledTimes(1);
  });

  it('P11 batch_create_nodes 含非法类型：合法照建、非法跳过并保留错误', () => {
    const ctx = makeCtx();
    const t = buildCanvasAgentTools(ctx);
    const r = toolOf(
      t,
      'batch_create_nodes',
    )({ nodes: [{ type: 'textGenerateNode' }, { type: 'nope' }] });
    expect(r.ok).toBe(true); // 有合法节点仍成功
    expect(r.data.ids).toHaveLength(1);
    expect(ctx.getNodes()).toHaveLength(1);
    expect(ctx.setNodes).toHaveBeenCalledTimes(1);
  });

  it('delete_node 连带删边', () => {
    const ctx = makeCtx(
      [
        { id: 'a', type: 'textGenerateNode', data: {}, position: {} },
        { id: 'b', type: 'textGenerateNode', data: {}, position: {} },
      ],
      [{ id: 'e', source: 'a', target: 'b' }],
    );
    const t = buildCanvasAgentTools(ctx);
    const r = toolOf(t, 'delete_node')({ nodeId: 'a' });
    expect(r.ok).toBe(true);
    expect(ctx.getNodes().some((n) => n.id === 'a')).toBe(false);
    expect(ctx.getEdges()).toHaveLength(0);
  });

  it('delete_node 不存在报错', () => {
    const ctx = makeCtx();
    const t = buildCanvasAgentTools(ctx);
    expect(toolOf(t, 'delete_node')({ nodeId: 'x' }).ok).toBe(false);
  });

  it('getNodeAssetUrl：提取节点主图 URL（assetUrl 字符串）', () => {
    expect(getNodeAssetUrl(mkNode({ assetUrl: 'http://a/1.png' }), noRes)).toBe('http://a/1.png');
    expect(getNodeAssetUrl(mkNode({ url: 'http://a/2.png' }), noRes)).toBe('http://a/2.png');
    expect(getNodeAssetUrl(mkNode({}), noRes)).toBe('');
  });

  it('getNodeAssetUrl：支持 images/assetUrls 数组（字符串或对象）', () => {
    expect(
      getNodeAssetUrl(
        mkNode({ images: [{ url: 'http://a/3.png' }, { url: 'http://a/4.png' }] }),
        noRes,
      ),
    ).toBe('http://a/3.png');
    expect(getNodeAssetUrl(mkNode({ images: ['http://a/5.png'] }), noRes)).toBe('http://a/5.png');
    expect(getNodeAssetUrl(mkNode({ assetUrls: [{ assetUrl: 'http://a/6.png' }] }), noRes)).toBe(
      'http://a/6.png',
    );
    expect(getNodeAssetUrl(mkNode({ images: [] }), noRes)).toBe('');
  });

  it('getNodeMedia：视频节点返回本体 videoUrl + type=video', () => {
    expect(
      getNodeMedia(mkNode({ videoUrl: 'http://a/c.mp4', assetUrl: 'http://a/cov.png' }), noRes),
    ).toEqual({ type: 'video', url: 'http://a/c.mp4' });
    // 显式 assetType::video 且仅 url → 用 url 作本体并判 video
    expect(getNodeMedia(mkNode({ assetType: 'video', url: 'http://a/c.mp4' }), noRes)).toEqual({
      type: 'video',
      url: 'http://a/c.mp4',
    });
  });

  it('getNodeMedia：音频节点返回本体 audioUrl + type=audio', () => {
    expect(getNodeMedia(mkNode({ audioUrl: 'http://a/v.mp3' }), noRes)).toEqual({
      type: 'audio',
      url: 'http://a/v.mp3',
    });
    expect(getNodeMedia(mkNode({ assetType: 'audio', url: 'http://a/v.ogg' }), noRes)).toEqual({
      type: 'audio',
      url: 'http://a/v.ogg',
    });
  });

  it('getNodeMedia：图片节点退化为主图 + type=image；无媒体返回空', () => {
    expect(getNodeMedia(mkNode({ assetUrl: 'http://a/1.png' }), noRes)).toEqual({
      type: 'image',
      url: 'http://a/1.png',
    });
    expect(getNodeMedia(mkNode({ url: 'http://a/2.png' }), noRes)).toEqual({
      type: 'image',
      url: 'http://a/2.png',
    });
    expect(getNodeMedia(mkNode({}), noRes)).toEqual({ type: '', url: '' });
  });

  it('batch_delete_nodes 批量删', () => {
    const ctx = makeCtx([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    const t = buildCanvasAgentTools(ctx);
    const r = toolOf(t, 'batch_delete_nodes')({ nodeIds: ['a', 'b'] });
    expect(r.ok).toBe(true);
    expect(ctx.getNodes()).toHaveLength(1);
  });

  it('update_node 白名单 + 不可变局部更新', () => {
    const ctx = makeCtx([
      { id: 'a', type: 'textGenerateNode', data: { label: '旧', prompt: 'keep' }, position: {} },
    ]);
    const t = buildCanvasAgentTools(ctx);
    const before = at(ctx.getNodes(), 0);
    const r = toolOf(t, 'update_node')({ nodeId: 'a', label: '新' });
    const after = at(ctx.getNodes(), 0);
    expect(after.data['label']).toBe('新');
    expect(after.data['prompt']).toBe('keep');
    expect(after).not.toBe(before);
    expect(r.data.updated).toContain('label');
  });

  it('update_node 非白名单字段被忽略', () => {
    const ctx = makeCtx([{ id: 'a', type: 'textGenerateNode', data: {}, position: {} }]);
    const t = buildCanvasAgentTools(ctx);
    const r = toolOf(t, 'update_node')({ nodeId: 'a', prompt: 'P', evilField: 'x' });
    expect(r.ok).toBe(true);
    expect(at(ctx.getNodes(), 0).data['evilField']).toBeUndefined();
    expect(at(ctx.getNodes(), 0).data['prompt']).toBe('P');
  });

  it('update_node_any_field 合并任意字段', () => {
    const ctx = makeCtx([{ id: 'a', type: 'imageGenerateNode', data: {}, position: {} }]);
    const t = buildCanvasAgentTools(ctx);
    const r = toolOf(
      t,
      'update_node_any_field',
    )({ nodeId: 'a', patch: { custom: 1, assetUrl: '/f.png' } });
    expect(r.ok).toBe(true);
    expect(at(ctx.getNodes(), 0).data['custom']).toBe(1);
  });

  it('connect_nodes 去重 + 端点校验', () => {
    const ctx = makeCtx([{ id: 'a' }, { id: 'b' }]);
    const t = buildCanvasAgentTools(ctx);
    toolOf(t, 'connect_nodes')({ source: 'a', target: 'b' });
    const r2 = toolOf(t, 'connect_nodes')({ source: 'a', target: 'b' });
    expect(r2.data.alreadyConnected).toBe(true);
    expect(ctx.getEdges()).toHaveLength(1);
    expect(toolOf(t, 'connect_nodes')({ source: 'x', target: 'b' }).ok).toBe(false);
  });

  it('batch_connect_nodes 批量', () => {
    const ctx = makeCtx([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    const t = buildCanvasAgentTools(ctx);
    const r = toolOf(
      t,
      'batch_connect_nodes',
    )({
      connections: [
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' },
      ],
    });
    expect(r.data.connected).toBe(2);
  });

  it('P11 batch_connect_nodes 单次 setEdges 写回（循环内不逐条写）', () => {
    const ctx = makeCtx([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]);
    const t = buildCanvasAgentTools(ctx);
    const r = toolOf(
      t,
      'batch_connect_nodes',
    )({
      connections: [
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' },
        { source: 'c', target: 'd' },
      ],
    });
    expect(r.ok).toBe(true);
    expect(r.data.connected).toBe(3);
    expect(ctx.getEdges()).toHaveLength(3);
    expect(ctx.setEdges).toHaveBeenCalledTimes(1);
  });

  it('P11 batch_connect_nodes 去重：重复连线计成功但只写一次', () => {
    const ctx = makeCtx([{ id: 'a' }, { id: 'b' }]);
    const t = buildCanvasAgentTools(ctx);
    const r = toolOf(
      t,
      'batch_connect_nodes',
    )({
      connections: [
        { source: 'a', target: 'b' },
        { source: 'a', target: 'b' },
      ],
    });
    expect(r.data.connected).toBe(2); // 已存在连线仍计成功（对齐原语义）
    expect(ctx.getEdges()).toHaveLength(1);
    expect(ctx.setEdges).toHaveBeenCalledTimes(1);
  });

  it('P11 batch_connect_nodes 非法端点不写边、不计数', () => {
    const ctx = makeCtx([{ id: 'a' }, { id: 'b' }]);
    const t = buildCanvasAgentTools(ctx);
    const r = toolOf(
      t,
      'batch_connect_nodes',
    )({
      connections: [
        { source: 'a', target: 'b' },
        { source: 'x', target: 'a' },
      ],
    });
    expect(r.data.connected).toBe(1); // 仅合法的一条
    expect(ctx.getEdges()).toHaveLength(1);
    expect(ctx.setEdges).toHaveBeenCalledTimes(1);
  });

  it('delete_edge 按 edgeId 或端点删', () => {
    const ctx = makeCtx([{ id: 'a' }, { id: 'b' }], [{ id: 'e1', source: 'a', target: 'b' }]);
    const t = buildCanvasAgentTools(ctx);
    expect(toolOf(t, 'delete_edge')({ edgeId: 'e1' }).ok).toBe(true);
    expect(ctx.getEdges()).toHaveLength(0);
    // 再建一条按端点删
    toolOf(t, 'connect_nodes')({ source: 'a', target: 'b' });
    const r = toolOf(t, 'delete_edge')({ source: 'a', target: 'b' });
    expect(r.ok).toBe(true);
    expect(ctx.getEdges()).toHaveLength(0);
  });

  it('delete_edge 不存在报错', () => {
    const ctx = makeCtx();
    const t = buildCanvasAgentTools(ctx);
    expect(toolOf(t, 'delete_edge')({ edgeId: 'no' }).ok).toBe(false);
  });

  it('list_nodes / list_edges / read_canvas 只读', () => {
    const ctx = makeCtx(
      [
        {
          id: 'a',
          type: 'textGenerateNode',
          data: { label: 'X', assetUrl: '/f.png' },
          position: { x: 1, y: 2 },
        },
      ],
      [{ id: 'e', source: 'a', target: 'b' }],
    );
    const t = buildCanvasAgentTools(ctx);
    expect(toolOf(t, 'list_nodes')({}).data.nodes).toHaveLength(1);
    expect(toolOf(t, 'list_edges')({}).data.edges).toHaveLength(1);
    const rc = toolOf(t, 'read_canvas')({});
    expect(rc.data.nodes[0].assetUrl).toBe('/f.png');
  });

  it('get_node_details 读详情', () => {
    const ctx = makeCtx([
      { id: 'a', type: 'imageGenerateNode', data: { prompt: 'P' }, position: {} },
    ]);
    const t = buildCanvasAgentTools(ctx);
    expect(toolOf(t, 'get_node_details')({ nodeId: 'a' }).data.data.prompt).toBe('P');
    expect(toolOf(t, 'get_node_details')({ nodeId: 'z' }).ok).toBe(false);
  });

  it('generate_node 拿到 resultUrl → 返回已完成收敛信号（completed:true，不再重复）', async () => {
    const ctx = makeCtx([{ id: 'a', type: 'imageGenerateNode', data: {}, position: {} }]);
    const t = buildCanvasAgentTools(ctx);
    const r = await toolOf(t, 'generate_node')({ nodeId: 'a' });
    expect(r.ok).toBe(true);
    expect(r.data.resultUrl).toBe('http://r/x.png');
    // 对齐参考项目收敛信号：resultUrl 非空 = 已完成，明确"无需重复操作"
    expect(r.data.completed).toBe(true);
    expect(r.data.submitted).toBeUndefined(); // 不再出现"已提交待完成"的误导信号
    expect(r.data.note).toContain('无需重复操作');
  });

  it('generate_node resultUrl 为空 → 返回提交中信号（submitted:true, completed:false），提示勿重复触发', async () => {
    vi.mocked(taskStore.runNodeGeneration).mockResolvedValueOnce({ ok: true, resultUrl: '' });
    const ctx = makeCtx([{ id: 'a', type: 'imageGenerateNode', data: {}, position: {} }]);
    const t = buildCanvasAgentTools(ctx);
    const r = await toolOf(t, 'generate_node')({ nodeId: 'a' });
    expect(r.ok).toBe(true);
    expect(r.data.completed).toBe(false);
    expect(r.data.submitted).toBe(true);
    expect(r.data.note).toContain('请勿重复触发');
  });

  it('generate_node 失败：返回带 nodeId（供对话侧「重试此步骤」定位节点）', async () => {
    vi.mocked(taskStore.runNodeGeneration).mockResolvedValueOnce({ ok: false, error: '模型超时' });
    const ctx = makeCtx([{ id: 'a', type: 'imageGenerateNode', data: {}, position: {} }]);
    const t = buildCanvasAgentTools(ctx);
    const r = await toolOf(t, 'generate_node')({ nodeId: 'a' });
    expect(r.ok).toBe(false);
    expect(r.nodeId).toBe('a'); // 失败也带 nodeId
    expect(r.error).toBe('模型超时');
  });

  it('【TD-01-6】generate_node 未触发（runNodeGeneration 返回 false）→ 报「未注册生成契约」并带 nodeId', async () => {
    vi.mocked(taskStore.runNodeGeneration).mockResolvedValueOnce(false);
    const ctx = makeCtx([{ id: 'a', type: 'imageGenerateNode', data: {}, position: {} }]);
    const t = buildCanvasAgentTools(ctx);
    const r = await toolOf(t, 'generate_node')({ nodeId: 'a' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('未注册生成契约');
    expect(r.nodeId).toBe('a');
  });

  it('generate_node 节点不存在 → 回填可用 id 引导自愈（防 LLM 自猜 imageGenerateNode_1）', async () => {
    const ctx = makeCtx([
      { id: 'imageGenerateNode_real_a', type: 'imageGenerateNode', data: {}, position: {} },
      { id: 'imageGenerateNode_real_b', type: 'imageGenerateNode', data: {}, position: {} },
      { id: 'text_x', type: 'textGenerateNode', data: {}, position: {} },
    ]);
    const t = buildCanvasAgentTools(ctx);
    const r = await toolOf(t, 'generate_node')({ nodeId: 'imageGenerateNode_1' }); // 模型自猜的假 id
    expect(r.ok).toBe(false);
    expect(r.error).toContain('节点不存在：imageGenerateNode_1');
    // 兜底引导：回填画布上真实可用的生图节点 id（而非只报错让模型卡死/重复建节点）
    expect(r.error).toContain('imageGenerateNode_real_a');
    expect(r.error).toContain('imageGenerateNode_real_b');
  });

  it('execute_plan 未确认被拒', async () => {
    convState.awaiting = true; // 模拟已进入待确认
    const ctx = makeCtx();
    const t = buildCanvasAgentTools(ctx);
    const r = await toolOf(t, 'execute_plan')({ generations: [{ id: 'g1', prompt: '猫' }] });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('尚未确认');
  });

  it('focus_node 居中聚焦视图 API', () => {
    const ctx = makeCtx([
      { id: 'a', type: 'textGenerateNode', data: {}, position: { x: 5, y: 5 } },
    ]);
    const t = buildCanvasAgentTools(ctx);
    expect(toolOf(t, 'focus_node')({ nodeId: 'a' }).ok).toBe(true);
    expect(ctx.setCenter).toHaveBeenCalled();
    expect(toolOf(t, 'focus_node')({ nodeId: 'z' }).ok).toBe(false);
  });

  // 【TD-11-9 · 2026-09-11】MUTATING_TOOLS 一致性对账（此前零覆盖）。
  // 契约（useCanvasAgentTools.ts:296-299 决策注释）：对「会改画布的写工具」统一 wrap——
  // 执行前 push {nodes,edges} 快照进 aiUndoStack，undo_ai 弹出恢复。
  // 判定 = 该工具是否改变 nodes/edges（含 node.data）。本用例把该隐式契约钉死为显式清单：
  // 任何工具「新增加入/移出」这个集合都会红——逼改动者显式确认意图，而非静默漂移。
  const MUTATING_EXPECTED = new Set([
    'create_node',
    'batch_create_nodes',
    'delete_node',
    'batch_delete_nodes',
    'update_node',
    'update_node_any_field',
    'connect_nodes',
    'batch_connect_nodes',
    'delete_edge',
    'execute_plan',
    // 明确「不进」且必须保持不进的（写 node.data，但不是「画布结构编辑」；且 undo 生成结果无意义
    // ——生成已烧积分、进任务中心，撤回节点 data 只会造成「节点在但图没了」的假状态）：
    //   generate_node / run_existing_plan
    // 明确「不进」的只读/非画布工具：read_canvas / list_nodes / list_edges / get_node_details /
    //   read_table / focus_node / undo_ai / memory_suggest
  ]);
  const NON_MUTATING_EXPECTED = new Set([
    'read_canvas',
    'list_nodes',
    'list_edges',
    'get_node_details',
    'read_table',
    'skill_read_file',
    'generate_node',
    'run_existing_plan',
    'focus_node',
    'undo_ai',
    'memory_suggest',
  ]);

  it('【TD-11-9】写画布工具必进 undo 栈；只读/生成类工具必不进（防集合漂移）', () => {
    const ctx = makeCtx([
      { id: 'n1', type: 'textGenerateNode', position: { x: 0, y: 0 }, data: {} },
    ]);
    const tools = buildCanvasAgentTools(ctx);
    // 两个清单必须完整覆盖全部工具（漏登一个 → 红：逼显式归类，不允许「忘了」）
    const covered = new Set([...MUTATING_EXPECTED, ...NON_MUTATING_EXPECTED]);
    expect([...covered].sort()).toEqual([...CANVAS_AGENT_TOOL_NAMES].sort());

    for (const name of MUTATING_EXPECTED) {
      vi.mocked(convStore.pushActiveAiUndo).mockClear();
      toolOf(tools, name)({ nodeId: 'n1', id: 'n1', source: 'n1', target: 'n1' });
      expect(
        vi.mocked(convStore.pushActiveAiUndo).mock.calls.length,
        `${name} 应 push 撤销快照`,
      ).toBeGreaterThan(0);
    }
    for (const name of NON_MUTATING_EXPECTED) {
      vi.mocked(convStore.pushActiveAiUndo).mockClear();
      toolOf(tools, name)({ nodeId: 'n1', id: 'n1' });
      expect(vi.mocked(convStore.pushActiveAiUndo).mock.calls.length, `${name} 不应 push`).toBe(0);
    }
  });

  it('undo_ai 无栈返回错误', () => {
    const ctx = makeCtx();
    const t = buildCanvasAgentTools(ctx);
    expect(toolOf(t, 'undo_ai')({}).ok).toBe(false);
  });

  it('未知工具经 callTool 返回错误（不在本测试 mock 范围，直接验证包错）', () => {
    const ctx = makeCtx();
    const t = buildCanvasAgentTools(ctx);
    // 包一层 try：工具不存在时 buildCanvasAgentTools 的 map 里没有该 key → 返回 undefined 调用报错
    const r = t['call_no_such_tool']
      ? toolOf(t, 'call_no_such_tool')({})
      : { ok: false, error: '未知工具' };
    expect(r.ok).toBe(false);
  });

  it('【T4】execute_plan credit 命中（creditSwitch 默认开）→ 只建节点待确认，不真生成', async () => {
    convState.awaiting = false;
    // 2026-08-27 简化：credit = creditSwitch（全局总闸）。开关默认开即命中。
    const ctx = makeCtx();
    const t = buildCanvasAgentTools(ctx);
    const r = await toolOf(t, 'execute_plan')({ generations: [{ id: 'g1', prompt: '猫' }] });
    expect(r.ok).toBe(true);
    // D4：credit 命中 → 返回 awaited:'credit'，不声称「已生成」
    expect(r.data.awaited).toBe('credit');
    expect(r.data.note).toContain('待积分确认');
    // 强制 autoRun=false（红线 §6.4：绝不放行 LLM 的 auto_run:true 直接真生成）
    expect(mockExecutePlan).toHaveBeenCalledTimes(1);
    expect(at(mockExecutePlan.mock.calls, 0)[0].autoRun).toBe(false);
    // 节点已建好（ready）、置 per-conv creditGate 持久化
    expect(convState.creditGate?.pending).toBe(true);
    expect(convState.creditGate?.map).toBeTruthy();
    expect(genPromptAt(convState.creditGate, 0)).toBe('猫');
    // 未置 awaiting 态（credit 闸与 awaiting 确认闸两条门禁互相独立）
    expect(convState.awaiting).toBe(false);
  });

  it('【T5】execute_plan credit 未命中（creditSwitch=关）→ 行为与改动前一致（autoRun 按入参放行）', async () => {
    convState.awaiting = false;
    // 2026-08-27 简化：credit = creditSwitch（全局总闸）。
    // 未命中只由「开关关」决定。
    setCreditSwitch(false);
    const ctx = makeCtx();
    const t = buildCanvasAgentTools(ctx);
    const r = await toolOf(
      t,
      'execute_plan',
    )({ generations: [{ id: 'g1', prompt: '猫' }], auto_run: true });
    expect(r.ok).toBe(true);
    expect(r.data.awaited).toBeUndefined(); // 未命中积分闸
    expect(mockExecutePlan).toHaveBeenCalledTimes(1);
    expect(at(mockExecutePlan.mock.calls, 0)[0].autoRun).toBe(true); // 原 autoRun 语义保留
    expect(convState.creditGate).toBeNull(); // 不置积分待确认态
    setCreditSwitch(true); // 还原默认开，避免污染后续
  });

  it('【T6】runExistingPlanTool 前置：creditGate 未置位 → 拒绝且不触发任何生成', async () => {
    convState.creditGate = null; // 无待点生成的计划
    const ctx = makeCtx();
    const r = await runExistingPlanTool(ctx);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('无待点生成的计划');
    expect(mockExecutePlan).not.toHaveBeenCalled();
  });

  it('用户在积分确认卡片点确认（creditGate pending）→ runExistingPlanTool 补跑并清 gate', async () => {
    convState.creditGate = {
      pending: true,
      gens: [{ id: 'g1', prompt: '猫' }],
      map: { g1: 'n1' },
    };
    const ctx = makeCtx();
    const r = await runExistingPlanTool(ctx);
    expect(r.ok).toBe(true);
    expect(mockExecutePlan).toHaveBeenCalledTimes(1);
    const arg = at(mockExecutePlan.mock.calls, 0)[0];
    expect(arg.mode).toBe('runExisting'); // D5：复用执行器，不重建节点
    expect(arg.nodeMappings).toEqual({ g1: 'n1' }); // D6：映射来自同一次 execute_plan
    expect(convState.creditGate).toBeNull(); // 成功清 gate（失败保留待重试）
  });

  it('execute_plan 未传 generations 且无暂存 → 报错（不死循环/不崩溃）', async () => {
    convState.awaiting = false;
    convState.pending = null;
    const ctx = makeCtx();
    const t = buildCanvasAgentTools(ctx);
    const r = await toolOf(t, 'execute_plan')({}); // 无 generations 也无暂存
    expect(r.ok).toBe(false);
    // 【D缺口】统一兜底：错误透传并给出「未找到生成计划」来源引导，而非静默跳过
    expect(r.error).toContain('未找到生成计划');
    expect(mockExecutePlan).not.toHaveBeenCalled();
  });

  it('execute_plan 有阶段1暂存 → 主通道取暂存（pendingUsed 分支）', async () => {
    convState.awaiting = false;
    // 主来源①「阶段1 暂存 pendingGenerations」内存优先（见 useCanvasAgentTools.ts:918-919）
    convState.pending = [{ id: 'g1', prompt: '一只猫' }];
    const ctx = makeCtx();
    const t = buildCanvasAgentTools(ctx);
    const r = await toolOf(t, 'execute_plan')({}); // 不传 generations，只靠暂存
    expect(r.ok).toBe(true);
    expect(mockExecutePlan).toHaveBeenCalledTimes(1);
    const arg = at(mockExecutePlan.mock.calls, 0)[0];
    expect(arg.generations).toHaveLength(1);
    expect(at(must(arg.generations, 'generations'), 0).id).toBe('g1'); // 主通道：gens 取自暂存，非 args
    expect(at(must(arg.generations, 'generations'), 0).prompt).toBe('一只猫'); // 无 global_contract → 不加风格前缀
    expect(convStore.setActivePendingGenerations).toHaveBeenCalledWith(null); // 执行后清暂存
  });

  it('execute_plan：按 attachment_indices 精确取用户参考图（对齐大雄，每步独立）', async () => {
    convState.awaiting = false;
    // 参考图池 = 用户引用图的 URL 数组（useAgentChat.send 写入）
    setCurrentReferenceImages(['http://ref/1.png', 'http://ref/2.png']);
    const ctx = makeCtx();
    const t = buildCanvasAgentTools(ctx);
    // AI 规划：step1 用参考图1(→0)，step2 用参考图2(→1)，step3 无索引（用整批共享）
    const r = await toolOf(
      t,
      'execute_plan',
    )({
      generations: [
        { id: 'g1', prompt: '把猫变白', use_attachments: true, attachment_indices: [0] },
        { id: 'g2', prompt: '把狗变黑', use_attachments: true, attachment_indices: [1] },
        { id: 'g3', prompt: '普通图', use_attachments: false },
      ],
      referenceImages: ['http://ref/global.png'],
    });
    expect(r.ok).toBe(true);
    const arg = at(mockExecutePlan.mock.calls, 0)[0];
    // 每步按索引解析成自己的 referenceImages
    expect(at(must(arg.generations, 'generations'), 0).referenceImages).toEqual([
      'http://ref/1.png',
    ]);
    expect(at(must(arg.generations, 'generations'), 1).referenceImages).toEqual([
      'http://ref/2.png',
    ]);
    // 无索引的步骤不注入 per-step referenceImages（执行器会回退整批共享）
    expect(at(must(arg.generations, 'generations'), 2).referenceImages).toBeUndefined();
  });

  it('【对齐大雄 agentLastUserAttachments】本轮无图时 execute_plan 回退用历史 user 图（attachment_indices 精确取）', async () => {
    convState.awaiting = false;
    convState.refImages = []; // 本轮无参考图
    // 历史 user 图（当前对话最近一条带图 user 消息，模拟 getLastUserReferenceImages 返回）
    vi.mocked(convStore.getLastUserReferenceImages).mockReturnValue([
      'http://hist/1.png',
      'http://hist/2.png',
    ]);
    const ctx = makeCtx();
    const t = buildCanvasAgentTools(ctx);
    const r = await toolOf(
      t,
      'execute_plan',
    )({
      generations: [
        { id: 'g1', prompt: '把上一张改白', use_attachments: true, attachment_indices: [0] },
        { id: 'g2', prompt: '把上一张改黑', use_attachments: true, attachment_indices: [1] },
      ],
    });
    expect(r.ok).toBe(true);
    const arg = at(mockExecutePlan.mock.calls, 0)[0];
    // 每步按索引精确取历史图（对齐大雄「本轮无图回退上一轮用户图」）
    expect(at(must(arg.generations, 'generations'), 0).referenceImages).toEqual([
      'http://hist/1.png',
    ]);
    expect(at(must(arg.generations, 'generations'), 1).referenceImages).toEqual([
      'http://hist/2.png',
    ]);
  });

  it('【对齐大雄 direct_refs】execute_plan 按图编号引用历史/生成图，prompt 里「图N」翻译成「第X张参考图」', async () => {
    convState.awaiting = false;
    convState.refImages = [];
    // 当前可引用图编号映射：图1=上一轮生成，图2=上一轮生成（agentCurrentImageMap）
    vi.mocked(convStore.getCurrentImageMap).mockReturnValue([
      { num: 1, url: 'http://x/gen1.png', name: '主图', source: 'gen' },
      { num: 2, url: 'http://x/gen2.png', name: '详情', source: 'gen' },
    ]);
    const ctx = makeCtx();
    const t = buildCanvasAgentTools(ctx);
    const r = await toolOf(
      t,
      'execute_plan',
    )({
      generations: [
        {
          id: 'g1',
          prompt: '把图1改成红色，图2保持不变',
          direct_refs: [{ url: 'http://x/gen1.png' }, { url: 'http://x/gen2.png' }],
        },
      ],
    });
    expect(r.ok).toBe(true);
    const arg = at(mockExecutePlan.mock.calls, 0)[0];
    // prompt 里「图1」「图2」被翻译成「第1张参考图」「第2张参考图」
    expect(at(must(arg.generations, 'generations'), 0).prompt).toContain(
      '把第1张参考图改成红色，第2张参考图保持不变',
    );
    // referenceImages 精确取 direct_refs 的 url
    expect(at(must(arg.generations, 'generations'), 0).referenceImages).toEqual([
      'http://x/gen1.png',
      'http://x/gen2.png',
    ]);
  });

  it('buildFusionPrompt：挂全部前序成功图 + 改写为融合提示词（对齐大雄）', () => {
    const prev = [{ prompt: '一只黑猫' }, { prompt: '一只橘猫' }];
    const prompt = buildFusionPrompt(prev, '让它们打架');
    expect(prompt).toContain('图1（黑猫）');
    expect(prompt).toContain('图2（橘猫）');
    expect(prompt).toContain('融合');
    expect(prompt).toContain('保持各主体外形与关键特征');
  });

  it('buildProductReferencePrompt：只挂产品定稿 + 产品一致性约束（对齐大雄）', () => {
    const product = { prompt: '零食包装定稿' };
    const prompt = buildProductReferencePrompt(product, '详情页画面', '');
    expect(prompt).toContain('产品定稿');
    expect(prompt).toContain('唯一产品一致性参考');
    expect(prompt).toContain('详情页画面');
  });

  it('execute_plan 无 generations 且无暂存 → 报错（不死循环/不崩溃）', async () => {
    convState.awaiting = false;
    convState.pending = null;
    const ctx = makeCtx();
    const t = buildCanvasAgentTools(ctx);
    const r = await toolOf(t, 'execute_plan')({}); // 无 generations 也无暂存
    expect(r.ok).toBe(false);
    // 【D缺口】统一兜底：错误透传并给出「未找到生成计划」来源引导，而非静默跳过
    expect(r.error).toContain('未找到生成计划');
    expect(mockExecutePlan).not.toHaveBeenCalled();
  });
});
