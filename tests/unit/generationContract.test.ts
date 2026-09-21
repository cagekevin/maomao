/**
 * generationContract 单测（TD-01-8）—— 任务中心编排序列的**唯一实现**。
 * 覆盖（R3 顺序 + R5 三分支）：
 *  - 成功：localize → settle(显示URL) → saveToTasks → onPersisted(持久URL) → done(最终)
 *  - 不落盘 / 落盘失败降级（reportDegrade，不判整体失败）/ localize 失败降级
 *  - 业务失败（含 aborted 不 toast）/ 抛 AbortError（分类中止）/ 抛普通异常 / run 返回 undefined
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const taskCtl = { taskId: 't-1', progress: vi.fn(), done: vi.fn(), fail: vi.fn() };
const reportGenerateMock = vi.fn((..._a: unknown[]) => taskCtl);
vi.mock('../../src/components/base/store/taskStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  reportGenerate: (...a: unknown[]) => reportGenerateMock(...a),
}));

const saveResultToTasksMock = vi.fn();
vi.mock('../../src/components/base/api/index.ts', () => ({
  saveResultToTasks: (...a: unknown[]) => saveResultToTasksMock(...a),
}));

const showToastMock = vi.fn();
const toastInfoMock = vi.fn();
vi.mock('../../src/components/base/core/event/toastStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  showToast: (...a: unknown[]) => showToastMock(...a),
  toastInfo: (...a: unknown[]) => toastInfoMock(...a),
}));

const reportDegradeMock = vi.fn();
vi.mock('../../src/components/base/core/log/degrade.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  reportDegrade: (...a: unknown[]) => reportDegradeMock(...a),
}));

vi.mock('../../src/components/base/core/log/logger.ts', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { runGenerationOrchestration } =
  await import('../../src/components/generate/lib/generationOrchestration.ts');

const sig = new AbortController().signal;
/** 记录关键步骤的顺序（验证 R3 的 persist 顺序固化） */
let order: string[] = [];

beforeEach(() => {
  order = [];
  reportGenerateMock.mockClear();
  saveResultToTasksMock.mockReset();
  showToastMock.mockClear();
  toastInfoMock.mockClear();
  reportDegradeMock.mockClear();
  taskCtl.progress.mockReset();
  taskCtl.done.mockReset().mockImplementation(() => order.push('done'));
  taskCtl.fail.mockReset();
});

describe('runGenerationContract', () => {
  it('成功：localize → settle(显示URL) → 落盘 → onPersisted(持久URL) → done(最终URL)', async () => {
    saveResultToTasksMock.mockImplementation(async () => {
      order.push('save');
      return { ok: true, url: '/files/tasks/x.png', skipped: false };
    });
    const settleCtx: Array<{ localized: boolean }> = [];
    const out = await runGenerationOrchestration({
      taskNodeId: 'n1',
      type: 'image',
      signal: sig,
      localize: async () => '/files/migrated/人物/x.png',
      settle: (_url, _r, _taskCtl, ctx) => {
        order.push('settle');
        settleCtx.push(ctx);
      },
      onPersisted: () => order.push('onPersisted'),
      run: async (a) => {
        expect(a.taskId).toBe('t-1');
        expect(a.signal).toBe(sig); // R1 signal 贯穿
        a.progress(50, '生成中');
        return { ok: true, url: 'https://up/x.png' };
      },
    });
    expect(order).toEqual(['settle', 'save', 'onPersisted', 'done']); // R3 顺序固化
    // 【TD-01-25 生产者给全】localize 成功 → settle 收到 localized:true（消费方据此定「已归档」状态位）
    expect(settleCtx).toEqual([{ localized: true }]);
    expect(taskCtl.progress).toHaveBeenCalledWith(5, '准备中…');
    expect(taskCtl.progress).toHaveBeenCalledWith(50, '生成中');
    expect(taskCtl.done).toHaveBeenCalledWith('/files/tasks/x.png');
    expect(out).toMatchObject({ ok: true, resultUrl: '/files/tasks/x.png' });
  });

  // 【已删用例：不落盘（saveToTasks:false）】2026-09-20 · ADR-0030（幽灵预留即假接缝）。
  //   该开关 3 个生产调用方**零处显式传它**（全吃默认 true）⇒ 从未接线；这个用例是它**唯一的消费者**
  //   （= ADR-0030 §裁决 所说"只被它自己的单测引用"的假消费证据）。开关与用例一并删除，
  //   落盘随之成为契约内**无条件一步**（写新生成路径不可能漏），见 generationOrchestration.ts:146-155。

  it('落盘失败（ok:false）→ 保留原 URL 降级 + **用户可见 toast**（TD-01-17 三态），不判整体失败', async () => {
    saveResultToTasksMock.mockResolvedValue({ ok: false, reason: 'exception', message: 'offline' });
    const out = await runGenerationOrchestration({
      taskNodeId: 'n1',
      type: 'image',
      signal: sig,
      run: async () => ({ ok: true, url: 'https://up/x.png' }),
    });
    // 分开报告：生成成功、保存失败 → reportDegrade 带 toast（用户可见），不再静默
    expect(reportDegradeMock).toHaveBeenCalledTimes(1);
    expect(reportDegradeMock.mock.calls[0][0]).toMatchObject({
      key: 'saveResultToTasks',
      toast: expect.stringContaining('未能保存'),
    });
    // 保留原始结果地址（ADR 0005），done 仍带可用 URL，不判整体失败
    expect(taskCtl.done).toHaveBeenCalledWith('https://up/x.png');
    expect(out.ok).toBe(true);
  });

  it('落盘无需（skipped:true，如 blob:/已是本机）→ 不报降级、不触发 onPersisted', async () => {
    saveResultToTasksMock.mockResolvedValue({ ok: true, url: 'https://up/x.png', skipped: true });
    const onPersisted = vi.fn();
    const out = await runGenerationOrchestration({
      taskNodeId: 'n1',
      type: 'image',
      signal: sig,
      onPersisted,
      run: async () => ({ ok: true, url: 'https://up/x.png' }),
    });
    expect(reportDegradeMock).not.toHaveBeenCalled(); // 无需落盘 ≠ 失败，不得误报降级
    expect(onPersisted).not.toHaveBeenCalled();
    expect(taskCtl.done).toHaveBeenCalledWith('https://up/x.png');
    expect(out.ok).toBe(true);
  });

  it('localize 抛错 → 降级保留原 URL（reportDegrade）+ 仍按成功处理', async () => {
    saveResultToTasksMock.mockResolvedValue({ ok: true, url: 'https://up/x.png', skipped: true });
    const settleArgs: Array<{ url: string; localized: boolean }> = [];
    const out = await runGenerationOrchestration({
      taskNodeId: 'n1',
      type: 'image',
      signal: sig,
      localize: async () => {
        throw new Error('localize 挂了');
      },
      settle: (url, _r, _taskCtl, ctx) => settleArgs.push({ url, localized: ctx.localized }),
      run: async () => ({ ok: true, url: 'https://up/x.png' }),
    });
    expect(reportDegradeMock).toHaveBeenCalledTimes(1);
    // 【TD-01-25】降级必须**如实**报 localized:false —— 消费方据此不标「已归档」（否则就是谎报）
    expect(settleArgs).toEqual([{ url: 'https://up/x.png', localized: false }]);
    expect(out.ok).toBe(true);
  });

  it('localize 返回空 → 保留原 URL', async () => {
    saveResultToTasksMock.mockResolvedValue({ ok: true, url: 'https://up/x.png', skipped: true });
    const settleArgs: Array<{ url: string; localized: boolean }> = [];
    await runGenerationOrchestration({
      taskNodeId: 'n1',
      type: 'image',
      signal: sig,
      localize: async () => null,
      settle: (url, _r, _taskCtl, ctx) => settleArgs.push({ url, localized: ctx.localized }),
      run: async () => ({ ok: true, url: 'https://up/x.png' }),
    });
    expect(settleArgs).toEqual([{ url: 'https://up/x.png', localized: false }]);
  });

  it('业务失败（ok:false）→ fail + onFail + toast + 返回 ok:false', async () => {
    const onFail = vi.fn();
    const out = await runGenerationOrchestration({
      taskNodeId: 'n1',
      type: 'image',
      signal: sig,
      onFail,
      run: async () => ({ ok: false, error: '上游拒绝' }),
    });
    expect(taskCtl.fail).toHaveBeenCalledWith('上游拒绝');
    expect(onFail).toHaveBeenCalledWith('上游拒绝');
    expect(showToastMock).toHaveBeenCalledTimes(1);
    expect(out).toMatchObject({ ok: false, error: '上游拒绝' });
  });

  it('pending（前端停止等待，任务仍 running）→ 不 fail / 不 onFail / 不弹红，只弹一次中性提示', async () => {
    const onFail = vi.fn();
    const out = await runGenerationOrchestration({
      taskNodeId: 'n1',
      type: 'image',
      signal: sig,
      onFail,
      run: async () => ({ ok: false, pending: true, error: '请求超时（超过 300 秒未返回）' }),
    });
    // 不替生产者下终态结论：**任务行零写入**（fail/done/progress 三个入口都不许碰）——
    // progress 会无条件把行写回 running 并落库，可能覆盖恢复轮询刚落的 completed（见实现注释）。
    expect(taskCtl.fail).not.toHaveBeenCalled();
    expect(taskCtl.done).not.toHaveBeenCalled();
    // 只保留原语开头那一次 progress(5)，pending 分支不再补写（补写会把行写回 running 并落库）
    expect(taskCtl.progress).toHaveBeenCalledTimes(1);
    expect(taskCtl.progress).toHaveBeenCalledWith(5, '准备中…');
    expect(onFail).not.toHaveBeenCalled();
    expect(showToastMock).not.toHaveBeenCalled(); // 无红色失败提示
    // 但「前端已停止等待」这件事对用户可见（一次中性提示）
    expect(toastInfoMock).toHaveBeenCalledTimes(1);
    expect(out).toMatchObject({ ok: false, pending: true });
  });

  it('业务失败但 aborted=true → 不弹 toast（用户主动停止不打扰）', async () => {
    const out = await runGenerationOrchestration({
      taskNodeId: 'n1',
      type: 'image',
      signal: sig,
      run: async () => ({ ok: false, error: '已停止', aborted: true }),
    });
    expect(showToastMock).not.toHaveBeenCalled();
    expect(out).toMatchObject({ ok: false, aborted: true });
  });

  it('run 返回 undefined → 按业务失败处理', async () => {
    const out = await runGenerationOrchestration({
      taskNodeId: 'n1',
      type: 'image',
      signal: sig,
      run: async () => undefined,
    });
    expect(taskCtl.fail).toHaveBeenCalled();
    expect(out.ok).toBe(false);
  });

  it('抛 AbortError → 分类中止：fail("已停止") + onAbort + 不弹 toast', async () => {
    const onAbort = vi.fn();
    const out = await runGenerationOrchestration({
      taskNodeId: 'n1',
      type: 'image',
      signal: sig,
      onAbort,
      run: async () => {
        throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
      },
    });
    expect(taskCtl.fail).toHaveBeenCalledWith('已停止');
    expect(onAbort).toHaveBeenCalledTimes(1);
    expect(showToastMock).not.toHaveBeenCalled();
    expect(out).toMatchObject({ ok: false, aborted: true });
  });

  it('抛普通异常 → fail(msg) + onFail + toast', async () => {
    const onFail = vi.fn();
    const out = await runGenerationOrchestration({
      taskNodeId: 'n1',
      type: 'image',
      signal: sig,
      onFail,
      run: async () => {
        throw new Error('boom');
      },
    });
    expect(taskCtl.fail).toHaveBeenCalledWith('boom');
    expect(onFail).toHaveBeenCalledWith('boom');
    expect(showToastMock).toHaveBeenCalledTimes(1);
    expect(out).toMatchObject({ ok: false, error: 'boom' });
  });
});
