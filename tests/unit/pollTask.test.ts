// @vitest-environment node
/**
 * pollTask 恢复轮询契约测试（2026-09-21「停止等待 ≠ 失败」）。
 *
 * 覆盖：
 *  - **pending**（本轮等待预算用尽、终态未定）→ **不得** failTask：任务保持 running、占位释放，
 *    交给下一轮补扫继续 attach，直到后端写出真终态（越权判死会把"后端仍在跑"钉成失败）。
 *  - **真失败**（ok:false 且无 pending）→ 仍 failTask + 错误 toast（「失败可见」不被本次改动改坏）。
 *
 * mock：relayProxy（attach 结果可控）+ taskStore（终态原语取证）+ toastStore。
 * 模块级 `timer` 有「只启动一次」守卫 → 每个用例先 resetModules 再 import，拿全新模块实例。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const m = vi.hoisted(() => ({
  attach: vi.fn(),
  getTasks: vi.fn(),
  patchTask: vi.fn(),
  completeTask: vi.fn(),
  failTask: vi.fn(),
  stopPolling: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('../../src/components/generate/lib/relayProxy.ts', () => ({
  relayAttachUntilDone: (...a: unknown[]) => m.attach(...a),
}));
// 【TD-17-15】「会长大」类模块的桩必须从真模块派生（只覆盖要控的那几个）—— 防模块加导出后本套件整套崩
vi.mock('../../src/components/base/store/taskStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  getTasks: () => m.getTasks(),
  patchTask: (...a: unknown[]) => m.patchTask(...a),
  ensurePolling: () => true,
  isPolling: () => false,
  stopPolling: (...a: unknown[]) => m.stopPolling(...a),
  completeTask: (...a: unknown[]) => m.completeTask(...a),
  failTask: (...a: unknown[]) => m.failTask(...a),
}));
vi.mock('../../src/components/base/core/event/toastStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  showToast: (...a: unknown[]) => m.showToast(...a),
}));
vi.mock('../../src/components/base/core/log/logger.ts', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/** 取全新模块实例的 initTaskRecovery（绕过模块级「只启动一次」守卫） */
async function loadInitTaskRecovery(): Promise<() => void> {
  vi.resetModules();
  const mod = await import('../../src/components/generate/lib/pollTask.ts');
  return mod.initTaskRecovery;
}

const runningTask = { id: 't-1', nodeId: 'n1', type: 'image', status: 'running' };

describe('pollTask · 恢复轮询（停止等待 ≠ 失败）', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    m.attach.mockReset();
    m.getTasks.mockReset().mockReturnValue([runningTask]);
    m.patchTask.mockReset();
    m.completeTask.mockReset();
    m.failTask.mockReset();
    m.stopPolling.mockReset();
    m.showToast.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('attach 返回 pending → 不 failTask（保持 running，交下一轮 attach）', async () => {
    m.attach.mockResolvedValue({
      ok: false,
      pending: true,
      error: '请求超时（超过 600 秒未返回）',
    });
    const initTaskRecovery = await loadInitTaskRecovery();
    initTaskRecovery();
    await vi.advanceTimersByTimeAsync(100);

    expect(m.attach).toHaveBeenCalledTimes(1);
    expect(m.failTask).not.toHaveBeenCalled();
    expect(m.completeTask).not.toHaveBeenCalled();
    expect(m.showToast).not.toHaveBeenCalled(); // 不弹红：这不是失败
    // 占位已释放 → 下一轮补扫能重新接管同一任务（isPolling 去重不会把它永久挡在门外）
    expect(m.stopPolling).toHaveBeenCalledWith('t-1');
  });

  it('真失败（ok:false 且无 pending）→ 仍 failTask + 错误 toast（失败可见未被改坏）', async () => {
    m.attach.mockResolvedValue({ ok: false, error: '上游拒绝' });
    const initTaskRecovery = await loadInitTaskRecovery();
    initTaskRecovery();
    await vi.advanceTimersByTimeAsync(100);

    expect(m.failTask).toHaveBeenCalledWith('t-1', '上游拒绝');
    expect(m.showToast).toHaveBeenCalledWith('上游拒绝', { type: 'error' });
  });
});
