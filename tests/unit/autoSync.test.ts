// @vitest-environment jsdom
/**
 * autoSync 单测（批 4 调度层）—— 只测「调度/门控/退避/冲突三选一」，不测 cloudSync。
 * 策略：jsdom + fake timers；vi.mock 掉 cloudSync 模块，用可控返回驱动调度器，
 * 可观察断言全部落到「是否调用 uploadConfig / 调用次数 / 是否被退避挡住」。
 * 冲突处理（autoResolveConflict 内部 askChoice）用 confirmStore.resolveChoice 从外部结算，
 * 模拟「用户点了稍后/上传/下载」。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const FIRST_MS = 30_000;
const INTERVAL_MS = 30 * 60_000;

const mocks = vi.hoisted(() => {
  const uploadConfig = vi.fn(
    async (
      _onProgress: unknown,
      _opts: { onConfirm?: never; onAutoConflict?: AutoConflictHandler },
    ): Promise<UploadResult> => ({ ok: true, count: 0, skipped: true }),
  );
  const downloadConfig = vi.fn(async () => ({ ok: false, count: 0, cancelled: true }));
  const isCloudSyncReady = vi.fn(() => true);
  return { uploadConfig, downloadConfig, isCloudSyncReady };
});

// 隔离 cloudSync：调度器只关心「是否跑了 uploadConfig/downloadConfig/是否就绪」，不掺真实网络。
vi.mock('../../src/components/base/store/cloudSync.ts', () => ({
  uploadConfig: mocks.uploadConfig,
  downloadConfig: mocks.downloadConfig,
  isCloudSyncReady: mocks.isCloudSyncReady,
}));

import type {
  AutoConflictHandler,
  UploadResult,
} from '../../src/components/base/store/cloudSync.ts';

const { startAutoSync, stopAutoSync } = await import('../../src/components/base/store/autoSync.ts');
const { setSetting } = await import('../../src/components/base/store/appSettings.ts');
const { resolveChoice, getConfirm } =
  await import('../../src/components/base/core/confirmStore.ts');

/** 让 uploadConfig 触发冲突三选一（模拟现实冲突，交由 autoResolveConflict 处理） */
function makeConflictUploadImpl() {
  mocks.uploadConfig.mockImplementation(async (_onProgress, opts) => {
    if (opts?.onAutoConflict) {
      const copy = { title: '云端有更新', confirmText: '下载云端', danger: true };
      const decision = {
        kind: 'both-changed' as const,
        cloudRev: 2,
        cloudUpdatedAt: 0,
        ledgerRev: 1,
        localDirty: true,
        inSync: false,
      };
      const r = await opts.onAutoConflict(copy, decision);
      if (r === 'cancel') return { ok: false, count: 0, cancelled: true };
      if (r === 'download') return { ok: false, count: 0, action: 'download-needed' as const };
      return { ok: true, count: 3 };
    }
    return { ok: true, count: 0, skipped: true };
  });
}

/** 手动点开一个 tick，并用 resolveChoice 结算冲突（模拟用户点按钮） */
async function runMockTick(key: 'cancel' | 'confirm' | 'download') {
  const pending = vi.advanceTimersByTimeAsync(INTERVAL_MS);
  resolveChoice(key);
  await pending;
}

/** 首轮（延迟 30s）同样走冲突结算：makeConflictUploadImpl 的 askChoice 会挂起，必须从外部结算 */
async function runFirstTick(key: 'cancel' | 'confirm' | 'download') {
  const pending = vi.advanceTimersByTimeAsync(FIRST_MS);
  resolveChoice(key);
  await pending;
}

beforeEach(() => {
  vi.useFakeTimers();
  stopAutoSync(); // 复位 started/计数/退避
  if (getConfirm()) resolveChoice('cancel'); // confirmStore 是模块级单例，跨测试清掉挂起的 pending，防串扰
  mocks.uploadConfig.mockReset();
  mocks.downloadConfig.mockReset();
  mocks.isCloudSyncReady.mockClear();
  mocks.isCloudSyncReady.mockReturnValue(true);
  setSetting('autoSyncEnabled', true);
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
});
afterEach(() => {
  stopAutoSync();
  vi.useRealTimers();
  setSetting('autoSyncEnabled', true);
});

describe('autoSync — 调度节奏', () => {
  it('首轮 30s 触发，之后每 30min 递归；静默跳过时无冲突回调', async () => {
    mocks.uploadConfig.mockResolvedValue({ ok: true, count: 0, skipped: true });
    startAutoSync();
    await vi.advanceTimersByTimeAsync(FIRST_MS);
    expect(mocks.uploadConfig).toHaveBeenCalledTimes(1);
    // 首轮入参：不传 onProgress（静默）
    const [onProgress, opts] = mocks.uploadConfig.mock.calls[0];
    expect(onProgress).toBeUndefined();
    expect(opts?.onAutoConflict).toBeDefined();
    // 30min 后递归第 2 次
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(mocks.uploadConfig).toHaveBeenCalledTimes(2);
    // 再 30min 第 3 次
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(mocks.uploadConfig).toHaveBeenCalledTimes(3);
  });

  it('卸载 stopAutoSync 后不再调 uploadConfig', async () => {
    startAutoSync();
    stopAutoSync();
    await vi.advanceTimersByTimeAsync(FIRST_MS + INTERVAL_MS);
    expect(mocks.uploadConfig).not.toHaveBeenCalled();
  });
});

describe('autoSync — 门控（每轮现读，短路即不起请求）', () => {
  it('autoSyncEnabled=false → 不调 uploadConfig', async () => {
    setSetting('autoSyncEnabled', false);
    startAutoSync();
    await vi.advanceTimersByTimeAsync(FIRST_MS + INTERVAL_MS);
    expect(mocks.uploadConfig).not.toHaveBeenCalled();
  });

  it('离线（navigator.onLine=false）→ 不调 uploadConfig', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    startAutoSync();
    await vi.advanceTimersByTimeAsync(FIRST_MS + INTERVAL_MS);
    expect(mocks.uploadConfig).not.toHaveBeenCalled();
  });

  it('isCloudSyncReady=false（GAS 未配置/在同步）→ 不调 uploadConfig', async () => {
    mocks.isCloudSyncReady.mockReturnValue(false);
    startAutoSync();
    await vi.advanceTimersByTimeAsync(FIRST_MS + INTERVAL_MS);
    expect(mocks.uploadConfig).not.toHaveBeenCalled();
  });
});

describe('autoSync — 冲突三选一与退避', () => {
  it('后台标签（document.hidden=true）冲突 → 返回 cancel 且不计退避（仍持续轮询）', async () => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    makeConflictUploadImpl();
    startAutoSync();
    await vi.advanceTimersByTimeAsync(FIRST_MS); // 首 tick：hidden → cancel
    expect(mocks.uploadConfig).toHaveBeenCalledTimes(1);
    // 不点按钮（无 resolveChoice）；下一轮仍照常跑（未被退避挡）→ 证明未计退避
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(mocks.uploadConfig).toHaveBeenCalledTimes(2);
  });

  it('cloud-unknown 冲突 → 返回 cancel 且不计退避', async () => {
    mocks.uploadConfig.mockImplementation(async (_onProgress, opts) => {
      const copy = { title: '无法确认云端是否有更新', confirmText: '下载云端', danger: true };
      const decision = {
        kind: 'cloud-unknown' as const,
        cloudRev: 0,
        cloudUpdatedAt: 0,
        ledgerRev: 1,
        localDirty: true,
        inSync: false,
      };
      const r = await opts.onAutoConflict(copy, decision);
      return r === 'download'
        ? { ok: false, count: 0, action: 'download-needed' as const }
        : { ok: false, count: 0, cancelled: true };
    });
    startAutoSync();
    await vi.advanceTimersByTimeAsync(FIRST_MS);
    expect(mocks.uploadConfig).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(INTERVAL_MS); // 未被退避挡住
    expect(mocks.uploadConfig).toHaveBeenCalledTimes(2);
  });

  it('选中途一次成功（confirm/upload）→ 不触发退避（计数清零）', async () => {
    const { isBackedOff } = await import('../../src/components/base/store/autoSync.ts');
    makeConflictUploadImpl();
    startAutoSync();
    await runFirstTick('confirm'); // 成功 → clearCancelCountOnSuccess
    expect(mocks.uploadConfig).toHaveBeenCalledTimes(1);
    expect(isBackedOff(), '成功推送不应触发退避').toBe(false);
  });

  it('连续 3 次「稍后」→ 触发当日退避；任一次成功清零计数（纯逻辑可测）', async () => {
    const { registerCancel, clearCancelCountOnSuccess, isBackedOff } =
      await import('../../src/components/base/store/autoSync.ts');
    stopAutoSync(); // 复位模块状态，从 0 开始
    expect(registerCancel()).toBe(false); // 稍后(1)
    expect(registerCancel()).toBe(false); // 稍后(2)
    expect(registerCancel()).toBe(true); // 稍后(3) → 触发退避
    expect(isBackedOff()).toBe(true);
    // 重来一组：两次稍后 + 一次成功 → 计数清零，未触发退避
    stopAutoSync();
    expect(registerCancel()).toBe(false); // 稍后(1)
    expect(registerCancel()).toBe(false); // 稍后(2)
    clearCancelCountOnSuccess(); // 成功 → 清零
    expect(registerCancel()).toBe(false); // 稍后(新1)
    expect(registerCancel()).toBe(false); // 稍后(新2)
    expect(isBackedOff(), '成功清零后，2 次稍后不足以触发退避').toBe(false);
  });
});

describe('autoSync — 异常兜底', () => {
  it('uploadConfig 抛异常 → 不阻塞调度（finally 排下一轮）', async () => {
    mocks.uploadConfig.mockRejectedValue(new Error('boom'));
    startAutoSync();
    await vi.advanceTimersByTimeAsync(FIRST_MS); // 首 tick：异常被 catch
    expect(mocks.uploadConfig).toHaveBeenCalledTimes(1);
    mocks.uploadConfig.mockResolvedValue({ ok: true, count: 0, skipped: true });
    await vi.advanceTimersByTimeAsync(INTERVAL_MS); // 下一轮照常
    expect(mocks.uploadConfig).toHaveBeenCalledTimes(2);
  });
});
