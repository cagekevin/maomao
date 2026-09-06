// @vitest-environment node
/**
 * taskStore · ensurePolling 轮询调度注册表测试（S2-a 纯新增地基）
 *
 * 覆盖：
 *  - 同一 taskId 重复 ensurePolling → 只起一个 poller（register 不被重复驱动）
 *  - register 单轮回调：返回 true(终态) → poller 自停并清注册
 *  - 总超时：到点强停，防无限挂起
 *  - stopPolling 显式中止：清定时器 + 释放注册，同 taskId 可重新注册
 *  - pollingCount/isPolling 诊断
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 隔离 taskStore 的 IO 依赖，确保 ensurePolling 纯逻辑可测
vi.mock('../../src/components/base/api/localToolApi.ts', () => ({
  fetchTasks: vi.fn(async () => ({ items: [] })),
  saveTask: vi.fn(async () => {}),
  deleteTask: vi.fn(async () => {}),
  batchDeleteTasks: vi.fn(async () => {}),
  clearAllTasksApi: vi.fn(async () => {}),
}));

import {
  ensurePolling,
  stopPolling,
  isPolling,
  pollingCount,
  type EnsurePollingOptions,
} from '../../src/components/base/store/taskStore.ts';

beforeEach(() => {
  vi.useFakeTimers();
  // 清残留 poller（模块级 Map 跨用例累积）
  // 无法直接遍历 Map，用 ensurePolling 返回句柄测试后统一 stopPolling；
  // 兜底：清空 module 内注册需在每用例用到的 taskId 上 stop（见各用例清理）
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ensurePolling · 注册表去重（一个 taskId 只有一个 poller）', () => {
  it('重复 ensurePolling 同 taskId → 返回同一句柄，register 不被驱动两次', async () => {
    const registered = vi.fn(async () => false); // 永不终态，靠 stop 停
    const opts: EnsurePollingOptions = {
      register: registered,
      pollIntervalMs: 100,
      timeoutMs: 10000,
    };

    const h1 = ensurePolling('dup-task', opts);
    const h2 = ensurePolling('dup-task', opts);

    // 同 taskId 返回同一个 poller 语义：句柄能 stop；注册表不因二次调用复制条目
    expect(h1).not.toBeUndefined();
    expect(h2).not.toBeUndefined();
    // 推进一个间隔 → register 首轮立即被调 1 次（第二个 ensurePolling 复用，不再调首轮）
    await vi.advanceTimersByTimeAsync(50);
    expect(registered.mock.calls.length).toBeGreaterThanOrEqual(1);

    // 二次 ensurePolling 不应多注册：两句柄都指向同一条目，stop 任一即释放注册
    h2.stop();
    expect(isPolling('dup-task')).toBe(false);
  });

  it('register 返回 true(终态) → poller 自停并释放注册', async () => {
    // 首轮即到终态：register 只应被调 1 次左右，之后注册释放
    const registered = vi.fn(async () => true);
    ensurePolling('term-task', {
      register: registered,
      pollIntervalMs: 100,
      timeoutMs: 10000,
    });
    await vi.advanceTimersByTimeAsync(10); // 让首轮微任务完成
    expect(registered).toHaveBeenCalledWith('term-task');
    // 首轮返回 true → stop 被调 → 注册释放（即使定时器还没触发，终态即清）
    await vi.advanceTimersByTimeAsync(300);
    expect(isPolling('term-task')).toBe(false);
    expect(pollingCount()).toBe(0);
  });
});

describe('ensurePolling · 总超时强停', () => {
  it('register 永不终态 → 超时后 poller 自停释放（防无限挂起）', async () => {
    const registered = vi.fn(async () => false);
    ensurePolling('timeout-task', {
      register: registered,
      pollIntervalMs: 20,
      timeoutMs: 100,
    });
    expect(isPolling('timeout-task')).toBe(true);
    // 推进超过总超时(100ms)
    await vi.advanceTimersByTimeAsync(200);
    expect(isPolling('timeout-task')).toBe(false); // 超时后应释放注册
  });
});

describe('ensurePolling · stopPolling 显式中止与重注册', () => {
  it('stopPolling 清注册，同 taskId 可重新 ensurePolling', async () => {
    const reg1 = vi.fn(async () => false);
    ensurePolling('stop-task', { register: reg1, pollIntervalMs: 100, timeoutMs: 10000 });
    expect(isPolling('stop-task')).toBe(true);
    stopPolling('stop-task');
    expect(isPolling('stop-task')).toBe(false);

    // 释放后同 taskId 可再注册新 poller
    const reg2 = vi.fn(async () => true);
    ensurePolling('stop-task', { register: reg2, pollIntervalMs: 100, timeoutMs: 10000 });
    expect(isPolling('stop-task')).toBe(true);
    await vi.advanceTimersByTimeAsync(10);
    expect(reg2).toHaveBeenCalledWith('stop-task');
  });
});

describe('ensurePolling · 单轮驱动节奏', () => {
  it('未到终态时按 pollIntervalMs 周期驱动 register', async () => {
    let calls = 0;
    const registered = vi.fn(async () => {
      calls++;
      return calls >= 3;
    }); // 第 3 轮才终态
    ensurePolling('cadence-task', { register: registered, pollIntervalMs: 50, timeoutMs: 10000 });
    await vi.advanceTimersByTimeAsync(200); // 首轮 + 若干定时轮
    // 首轮立即 + 到第 3 轮(true)后停
    expect(calls).toBeGreaterThanOrEqual(3);
    expect(isPolling('cadence-task')).toBe(false); // 第 3 轮终态后应停
  });

  it('单轮 register 抛错(网络抖动) → 不误判失败，下轮继续', async () => {
    let calls = 0;
    const registered = vi.fn(async () => {
      calls++;
      if (calls === 1) throw new Error('network down'); // 首轮异常
      return true; // 下轮终态
    });
    ensurePolling('err-task', { register: registered, pollIntervalMs: 30, timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(100);
    expect(calls).toBeGreaterThanOrEqual(2); // 异常后应下轮重试
    expect(isPolling('err-task')).toBe(false); // 第 2 轮 true 后应停
  });
});

// ══════════════════════════════════════════════════════════════
// S2-c：occupyOnly 纯占位（in-flight 自驱动轮询用）—— 消双轮询的互斥机制
// ══════════════════════════════════════════════════════════════
describe('ensurePolling · occupyOnly 纯占位（in-flight 防恢复重复接管）', () => {
  it('occupyOnly 注册后 isPolling=true（恢复扫描据此跳过），且不起定时器/不驱动 register', async () => {
    const registered = vi.fn(async () => false);
    ensurePolling('inflight-task', {
      register: registered,
      occupyOnly: true,
      pollIntervalMs: 10,
      timeoutMs: 10000,
    });
    expect(isPolling('inflight-task')).toBe(true); // 占位后应标记已被接管
    // occupyOnly 不应驱动 register（in-flight 自己 while 驱动）
    await vi.advanceTimersByTimeAsync(100);
    expect(registered).not.toHaveBeenCalled();
  });

  it('occupyOnly 占位与驱动 poller 互斥：占位期间 ensurePolling(驱动) 复用占位，不重复起', async () => {
    const occupyReg = vi.fn(async () => false);
    ensurePolling('mix-task', {
      register: occupyReg,
      occupyOnly: true,
      pollIntervalMs: 10,
      timeoutMs: 10000,
    });
    // 恢复扫描想对同一 taskId 驱动 → 见已有占位(isPolling)，应跳过（不重复注册驱动）
    const driven = vi.fn(async () => true);
    const h2 = ensurePolling('mix-task', {
      register: driven,
      pollIntervalMs: 10,
      timeoutMs: 10000,
    });
    await vi.advanceTimersByTimeAsync(50);
    expect(driven).not.toHaveBeenCalled(); // 占位存在时不应再驱动新 poller
    // 释放占位后可正常驱动
    h2.stop();
    expect(isPolling('mix-task')).toBe(false);
  });

  it('stopPolling 释放占位后，isPolling 恢复 false，同 taskId 可被恢复 poller 重新接管', async () => {
    ensurePolling('release-task', { register: async () => false, occupyOnly: true });
    expect(isPolling('release-task')).toBe(true);
    stopPolling('release-task');
    expect(isPolling('release-task')).toBe(false); // in-flight 结束后释放占位，允许恢复/重试接管
  });
});
