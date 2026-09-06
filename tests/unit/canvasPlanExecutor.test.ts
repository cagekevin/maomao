import { describe, it, expect, vi, beforeEach } from 'vitest';

// 多步编排执行器：隔离 runNodeGeneration（真实生图 → 落盘 resultUrl）与 isNodeRegistered
vi.mock('../../src/components/base/store/taskStore.ts', () => ({
  runNodeGeneration: vi.fn(async () => ({ ok: true, resultUrl: 'http://r/ok.png' })),
  isNodeRegistered: vi.fn(() => true),
}));

import { executePlan } from '../../src/components/agent/canvas/canvasPlanExecutor.ts';
import { runNodeGeneration } from '../../src/components/base/store/taskStore.ts';

// vi.mock 工厂已把 runNodeGeneration 替换为 vi.fn，但静态类型仍是 src 的原始签名（无 .mock）。
// 测试侧用 .mockImplementationOnce/.mockReturnValueOnce 断言，故用 vi.mocked 恢复 mock 类型。
const runNodeGenerationMock = vi.mocked(runNodeGeneration);

// 最小 ctx：addNodes 记录、addEdges 记录、setNodes 写回 imageUrl、getNodes 反映最新
// P7：executor 的 live 检查用 ctx.getNode（O(1)），mock 需提供（返回当前节点或 undefined）
function makeCtx(initialNodes = []) {
  let nodes = [...initialNodes];
  let edges = [];
  return {
    nodes: () => nodes,
    edges: () => edges,
    getNodes: () => nodes,
    getNode: (id) => nodes.find((n) => n.id === id),
    getEdges: () => edges,
    addNodes: (ns) => {
      nodes = [...nodes, ...ns];
    },
    addEdges: (es) => {
      edges = [...edges, ...es];
    },
    setNodes: (fn) => {
      nodes = typeof fn === 'function' ? fn(nodes) : fn;
    },
    setEdges: (fn) => {
      edges = typeof fn === 'function' ? fn(edges) : fn;
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('多步编排执行器 executePlan §2.5/2.6', () => {
  it('空计划 → workflow 失败 + 空 entries', async () => {
    const ctx = makeCtx();
    const r = await executePlan({ ctx, generations: [] });
    expect(r.workflow.status).toBe('failed');
    expect(r.entries).toEqual([]);
    expect(runNodeGeneration).not.toHaveBeenCalled();
  });

  it('无 prompt/title 的步骤被过滤', async () => {
    const ctx = makeCtx();
    const r = await executePlan({ ctx, generations: [{ id: 'x' }, { id: 'y', prompt: '猫' }] });
    expect(r.entries).toHaveLength(1);
  });

  it('全局单飞锁：已有计划执行中，再次 executePlan 被拒绝（防重复计费/重复建节点）', async () => {
    // 让第一个 executePlan 挂起（runNodeGeneration 不 resolve），锁保持持有
    let release;
    const gate = new Promise((res) => {
      release = res;
    });
    runNodeGenerationMock.mockReturnValueOnce(
      gate.then(() => ({ ok: true, resultUrl: 'http://r/a.png' })),
    );
    const ctx = makeCtx();
    const p1 = executePlan({ ctx, generations: [{ id: 'g1', prompt: '猫' }] }); // 不 await，挂起中

    // 第二个 executePlan 应因单飞锁被拒
    const r2 = await executePlan({ ctx, generations: [{ id: 'g2', prompt: '狗' }] });
    expect(r2.workflow.status).toBe('failed');
    expect(r2.workflow.error).toContain('正在执行');

    // 释放第一个，await 完成以释放锁（避免污染后续测试）
    release();
    const r1 = await p1;
    expect(r1.workflow.status).toBe('completed');
  });

  it('独立批（Wave1）：并行建节点 + 触发 + 写回 imageUrl，status=completed', async () => {
    const ctx = makeCtx();
    const r = await executePlan({
      ctx,
      generations: [
        { id: 'g1', prompt: '猫', ratio: 'square' },
        { id: 'g2', prompt: '狗', ratio: 'story' },
      ],
    });
    expect(ctx.nodes()).toHaveLength(2);
    expect(ctx.nodes().every((n) => n.type === 'promptNode')).toBe(true);
    // 比例归一：square→1:1，story→9:16
    expect(ctx.nodes()[0].data.aspectRatio).toBe('1:1');
    expect(ctx.nodes()[1].data.aspectRatio).toBe('9:16');
    // 每个节点生成结果已写回 imageUrl
    expect(ctx.nodes().every((n) => n.data.imageUrl === 'http://r/ok.png')).toBe(true);
    expect(r.entries).toHaveLength(2);
    expect(
      r.entries.every((e) => e.status === 'completed' && e.resultUrl === 'http://r/ok.png'),
    ).toBe(true);
    expect(r.workflow.status).toBe('completed');
    expect(runNodeGeneration).toHaveBeenCalledTimes(2);
  });

  it('计划补种（原「无独立批→跳过」）：零独立步时首依赖步提升为独立种子并执行', async () => {
    const ctx = makeCtx();
    const r = await executePlan({
      ctx,
      generations: [{ id: 'g1', prompt: '主图', depends_on_previous: true }],
    });
    // 机制升级：单依赖步无独立前序 → 被提升为独立种子，正常执行而非跳过
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0].status).toBe('completed');
    expect(r.entries[0].resultUrl).toBe('http://r/ok.png');
    expect(runNodeGeneration).toHaveBeenCalledTimes(1);
    // 提升后不建任何连线（其自身是种子）
    expect(ctx.edges()).toHaveLength(0);
    const ctx2 = makeCtx();
    const r2 = await executePlan({
      ctx: ctx2,
      generations: [
        { id: 'base', prompt: '底图' },
        { id: 'dep', prompt: '变体', depends_on_previous: true },
      ],
    });
    expect(r2.entries[0].status).toBe('completed');
    expect(r2.entries[1].status).toBe('completed');
    // 建了 1 条连线：base → dep
    expect(ctx2.edges()).toHaveLength(1);
    expect(ctx2.edges()[0].source).toBe(r2.entries[0].nodeId);
    expect(ctx2.edges()[0].target).toBe(r2.entries[1].nodeId);
  });

  it('依赖批：前置任一步失败 → 整批跳过（不生成）', async () => {
    const ctx = makeCtx();
    // 强制第一个节点生成失败
    runNodeGenerationMock.mockImplementationOnce(async () => ({ ok: false, error: '生成失败' }));
    const r = await executePlan({
      ctx,
      generations: [
        { id: 'base', prompt: '底图' },
        { id: 'dep', prompt: '变体', depends_on_previous: true },
      ],
    });
    expect(r.entries[0].status).toBe('failed');
    expect(r.entries[1].status).toBe('failed');
    expect(r.entries[1].error).toContain('前置步骤未全部成功');
    // 没为 dep 建连线
    expect(ctx.edges()).toHaveLength(0);
  });

  it('autoRun=false：只建节点不触发，status=ready', async () => {
    const ctx = makeCtx();
    const r = await executePlan({
      ctx,
      autoRun: false,
      generations: [{ id: 'g1', prompt: '猫' }],
    });
    expect(ctx.nodes()).toHaveLength(1);
    expect(ctx.nodes()[0].data.imageUrl).toBeUndefined();
    expect(r.entries[0].status).toBe('ready');
    expect(r.workflow.status).toBe('ready');
    expect(runNodeGeneration).not.toHaveBeenCalled();
  });

  it('参考图：写进每个生图节点 data.images', async () => {
    const ctx = makeCtx();
    await executePlan({
      ctx,
      generations: [{ id: 'g1', prompt: '猫' }],
      referenceImages: ['http://r/ref.png'],
    });
    const imgs = ctx.nodes()[0].data.images;
    expect(imgs).toHaveLength(1);
    expect(imgs[0].url).toBe('http://r/ref.png');
  });

  it('模型/比例/分辨率：每步显式 > 面板 defaults > 内置默认', async () => {
    const ctx = makeCtx();
    const r = await executePlan({
      ctx,
      model: 'gpt-image-2',
      defaults: { model: 'default-model', ratio: 'landscape', resolution: '2K' },
      generations: [
        { id: 'explicit', prompt: '猫', ratio: 'portrait', resolution: '4K' }, // 显式优先
        { id: 'inherit', prompt: '狗' }, // 继承 defaults
      ],
    });
    const byId = Object.fromEntries(
      r.entries.map((e) => [e.id, ctx.nodes().find((n) => n.id === e.nodeId)]),
    );
    expect(byId.explicit.data.aspectRatio).toBe('3:4'); // portrait→3:4
    expect(byId.explicit.data.imageSize).toBe('4K');
    expect(byId.explicit.data.selectedModel).toBe('gpt-image-2');
    expect(byId.inherit.data.aspectRatio).toBe('16:9'); // landscape→16:9
    expect(byId.inherit.data.imageSize).toBe('2K');
  });
});

describe('TASK-009 逐步进度日志 onLog + 跳过文案带数字', () => {
  it('onLog 收集：计划开始 / 每步开始挂载参考图数 / 每步完成', async () => {
    const ctx = makeCtx();
    const logs = [];
    await executePlan({
      ctx,
      generations: [
        { id: 'g1', prompt: '猫' },
        { id: 'g2', prompt: '狗' },
      ],
      onLog: (l) => logs.push(l),
    });
    const messages = logs.map((l) => l.message);
    // 计划开始汇总（含独立批/依赖批数量）
    expect(messages.some((m) => m.includes('开始执行计划') && m.includes('独立批 2'))).toBe(true);
    // 每步开始：挂载参考图 0 张（无参考图）
    expect(
      messages.some(
        (m) => m.includes('第 1 步') && m.includes('开始生成') && m.includes('挂载参考图 0 张'),
      ),
    ).toBe(true);
    expect(messages.some((m) => m.includes('第 2 步') && m.includes('开始生成'))).toBe(true);
    // 每步完成：ok 级别
    expect(logs.some((l) => l.level === 'ok' && l.message.includes('完成'))).toBe(true);
    // 结尾汇总：全部成功
    expect(messages.some((m) => m.includes('执行完成') && m.includes('2 步全部成功'))).toBe(true);
  });

  it('带参考图时，每步开始日志标注挂载参考图数', async () => {
    const ctx = makeCtx();
    const logs = [];
    await executePlan({
      ctx,
      generations: [{ id: 'g1', prompt: '猫' }],
      referenceImages: ['http://r/ref1.png', 'http://r/ref2.png'],
      onLog: (l) => logs.push(l),
    });
    expect(logs.some((l) => l.message.includes('挂载参考图 2 张'))).toBe(true);
  });

  it('依赖批失败：跳过文案带「成功 X / 共 Y」且日志含 warn', async () => {
    const ctx = makeCtx();
    runNodeGenerationMock.mockImplementationOnce(async () => ({ ok: false, error: '生成失败' }));
    const logs = [];
    const r = await executePlan({
      ctx,
      generations: [
        { id: 'base', prompt: '底图' },
        { id: 'dep', prompt: '变体', depends_on_previous: true },
      ],
      onLog: (l) => logs.push(l),
    });
    // 跳过文案带成功/总数（独立批共 1，成功 0）
    expect(r.entries[1].error).toContain('前置步骤未全部成功');
    expect(r.entries[1].error).toContain('成功 0 / 共 1');
    // 有 warn 级别的跳过日志
    expect(logs.some((l) => l.level === 'warn' && l.message.includes('前置步骤未全部成功'))).toBe(
      true,
    );
    // 结尾汇总：base 失败 + dep 跳过 = 2 个 failed entry，全部失败 → error 级、无「可重试失败项」
    expect(
      logs.some((l) => l.message.includes('执行结束') && l.message.includes('失败 2 步')),
    ).toBe(true);
    expect(logs.some((l) => l.level === 'error' && l.message.includes('失败 2 步'))).toBe(true);
  });

  it('依赖批成功：记录连接前序节点数 + 完成日志', async () => {
    const ctx = makeCtx();
    const logs = [];
    const r = await executePlan({
      ctx,
      generations: [
        { id: 'base', prompt: '底图' },
        { id: 'dep', prompt: '变体', depends_on_previous: true },
      ],
      onLog: (l) => logs.push(l),
    });
    expect(r.entries[1].status).toBe('completed');
    // 依赖步开始：连接前序成功节点 1 个
    expect(
      logs.some(
        (l) => l.message.includes('依赖步 1') && l.message.includes('连接前序成功节点 1 个'),
      ),
    ).toBe(true);
    expect(
      logs.some(
        (l) => l.level === 'ok' && l.message.includes('依赖步 1') && l.message.includes('完成'),
      ),
    ).toBe(true);
  });

  it('autoRun=false：日志提示等待确认，不触发', async () => {
    const ctx = makeCtx();
    const logs = [];
    await executePlan({
      ctx,
      autoRun: false,
      generations: [{ id: 'g1', prompt: '猫' }],
      onLog: (l) => logs.push(l),
    });
    expect(runNodeGeneration).not.toHaveBeenCalled();
    expect(logs.some((l) => l.message.includes('等待确认'))).toBe(true);
  });

  it('部分成功 + 部分失败：结尾提示「可重试失败项」', async () => {
    const ctx = makeCtx();
    // 2 个独立批：第一个失败、第二个成功 → 无依赖批
    runNodeGenerationMock.mockImplementationOnce(async () => ({ ok: false, error: '生成失败' }));
    const logs = [];
    await executePlan({
      ctx,
      generations: [
        { id: 'a', prompt: '猫' },
        { id: 'b', prompt: '狗' },
      ],
      onLog: (l) => logs.push(l),
    });
    // 完成 1 步、失败 1 步 → warn 级 + 提示可重试失败项
    expect(
      logs.some(
        (l) =>
          l.message.includes('完成 1 步') &&
          l.message.includes('失败 1 步') &&
          l.message.includes('可重试失败项'),
      ),
    ).toBe(true);
    expect(logs.some((l) => l.level === 'warn')).toBe(true);
  });
});

describe('TASK-007 2.4 中文参数写法归一', () => {
  it('中文比例写法归一（9比16/横图/竖图/方图）', async () => {
    const ctx = makeCtx();
    await executePlan({
      ctx,
      generations: [
        { id: 'a', prompt: '猫', ratio: '9比16' },
        { id: 'b', prompt: '狗', ratio: '横图' },
        { id: 'c', prompt: '鸟', ratio: '方图' },
        { id: 'd', prompt: '鱼', ratio: '竖屏' },
      ],
    });
    const byId = Object.fromEntries(ctx.nodes().map((n) => [n.data.label, n]));
    expect(byId['步骤 1'].data.aspectRatio).toBe('9:16');
    expect(byId['步骤 2'].data.aspectRatio).toBe('16:9');
    expect(byId['步骤 3'].data.aspectRatio).toBe('1:1');
    expect(byId['步骤 4'].data.aspectRatio).toBe('9:16');
  });

  it('中文画质归一（高画质/中画质/低画质）', async () => {
    const ctx = makeCtx();
    await executePlan({
      ctx,
      generations: [
        { id: 'a', prompt: '猫', quality: '高画质' },
        { id: 'b', prompt: '狗', quality: '中画质' },
        { id: 'c', prompt: '鸟', quality: '低画质' },
      ],
    });
    const byId = Object.fromEntries(ctx.nodes().map((n) => [n.data.label, n]));
    expect(byId['步骤 1'].data.quality).toBe('high');
    expect(byId['步骤 2'].data.quality).toBe('medium');
    expect(byId['步骤 3'].data.quality).toBe('low');
  });

  it('英文/标准写法仍正确归一（回归）', async () => {
    const ctx = makeCtx();
    await executePlan({
      ctx,
      generations: [{ id: 'a', prompt: '猫', ratio: 'square', resolution: '2K', quality: 'high' }],
    });
    const n = ctx.nodes()[0].data;
    expect(n.aspectRatio).toBe('1:1');
    expect(n.imageSize).toBe('2K');
    expect(n.quality).toBe('high');
  });
});

describe('Gap B 依赖批 DAG 拓扑调度（兄弟依赖步并行）', () => {
  it('互不依赖的兄弟依赖步并行执行：最大并发 ≥ 2，各自只连独立步', async () => {
    const ctx = makeCtx();
    let concurrency = 0;
    let maxConcurrency = 0;
    runNodeGenerationMock.mockImplementation(async () => {
      concurrency++;
      maxConcurrency = Math.max(maxConcurrency, concurrency);
      await new Promise((r) => setTimeout(r, 5));
      concurrency--;
      return { ok: true, resultUrl: 'http://r/ok.png' };
    });
    const r = await executePlan({
      ctx,
      generations: [
        { id: 'base', prompt: '底图' },
        { id: 'a', prompt: '变体A', depends_on_previous: true, depends_on_steps: ['base'] },
        { id: 'b', prompt: '变体B', depends_on_previous: true, depends_on_steps: ['base'] },
      ],
    });
    expect(r.entries.every((e) => e.status === 'completed')).toBe(true);
    // 兄弟依赖步并行触发（替代旧的逐个串行）→ 最大并发 ≥ 2
    expect(maxConcurrency).toBeGreaterThanOrEqual(2);
    const baseNode = r.entries[0].nodeId;
    const edges = ctx.edges();
    // 变体之间不互连（互不依赖）
    const depNodes = r.entries.slice(1).map((e) => e.nodeId);
    const depToDep = edges.filter(
      (e) => depNodes.includes(e.source) && depNodes.includes(e.target),
    );
    expect(depToDep).toHaveLength(0);
    // 每个变体只连 base，各 1 条边
    for (const e of r.entries.slice(1)) {
      expect(edges.filter((ed) => ed.target === e.nodeId && ed.source === baseNode)).toHaveLength(
        1,
      );
    }
  });

  it('存在真实依赖链（b 依赖 a）时仍按拓扑序等待，不提前触发，b 只连 a', async () => {
    const ctx = makeCtx();
    const order = [];
    runNodeGenerationMock.mockImplementation(async (nodeId) => {
      order.push(nodeId);
      return { ok: true, resultUrl: 'http://r/ok.png' };
    });
    const r = await executePlan({
      ctx,
      generations: [
        { id: 'base', prompt: '底图' },
        { id: 'a', prompt: '中间件', depends_on_previous: true, depends_on_steps: ['base'] },
        { id: 'b', prompt: '终版', depends_on_previous: true, depends_on_steps: ['a'] },
      ],
    });
    expect(r.entries.every((e) => e.status === 'completed')).toBe(true);
    const aNode = r.entries[1].nodeId;
    const bNode = r.entries[2].nodeId;
    // b 严格在 a 之后触发
    expect(order.indexOf(aNode)).toBeLessThan(order.indexOf(bNode));
    // b 只连 a，不直接连 base
    const baseToB = ctx
      .edges()
      .filter((ed) => ed.target === bNode && ed.source === r.entries[0].nodeId);
    const aToB = ctx.edges().filter((ed) => ed.target === bNode && ed.source === aNode);
    expect(baseToB).toHaveLength(0);
    expect(aToB).toHaveLength(1);
  });
});
