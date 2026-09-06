import { describe, it, expect, vi } from 'vitest';
import { createThrottledPersistHandler } from '@/components/base/storage/persistFailureBus.ts';

describe('createThrottledPersistHandler（App 持清单点分发，原零覆盖，现抽纯函数可测）', () => {
  it('首次事件弹 Toast 且上报日志（suppressed=false）', () => {
    const onToast = vi.fn();
    const onLog = vi.fn();
    const handler = createThrottledPersistHandler({ now: () => 0, onToast, onLog });
    handler({ key: 'k1', error: 'QuotaExceededError: x' });
    expect(onToast).toHaveBeenCalledTimes(1);
    expect(onToast).toHaveBeenCalledWith('k1', 'QuotaExceededError: x');
    expect(onLog).toHaveBeenCalledWith('k1', 'QuotaExceededError: x', false);
  });

  it('同一 key 在节流窗口内重复 → 仅上报日志，不重复弹 Toast', () => {
    const onToast = vi.fn();
    const onLog = vi.fn();
    const handler = createThrottledPersistHandler({
      now: () => 0,
      throttleMs: 5000,
      onToast,
      onLog,
    });
    handler({ key: 'k1', error: 'e1' });
    handler({ key: 'k1', error: 'e2' }); // 仍在窗口内
    expect(onToast).toHaveBeenCalledTimes(1);
    expect(onLog).toHaveBeenCalledTimes(2);
    expect(onLog.mock.calls[1]).toEqual(['k1', 'e2', true]); // 第二次被节流但仍上报
  });

  it('窗口时间过后，同一 key 再次触发 → 重新弹 Toast', () => {
    let t = 0;
    const onToast = vi.fn();
    const handler = createThrottledPersistHandler({ now: () => t, throttleMs: 5000, onToast });
    handler({ key: 'k1' });
    t = 6000; // 过窗口
    handler({ key: 'k1' });
    expect(onToast).toHaveBeenCalledTimes(2);
  });

  it('不同 key 各自弹 Toast，不漏报（互不节流）', () => {
    const onToast = vi.fn();
    const handler = createThrottledPersistHandler({ now: () => 0, throttleMs: 5000, onToast });
    handler({ key: 'k1', error: 'a' });
    handler({ key: 'k2', error: 'b' });
    expect(onToast).toHaveBeenCalledTimes(2);
    expect(onToast.mock.calls.map((c) => c[0])).toEqual(['k1', 'k2']);
  });

  it('payload 缺失 key → 兜底为 (未知键)，缺失 error → 空字符串（未知同名 key 同样被节流）', () => {
    const onToast = vi.fn();
    const handler = createThrottledPersistHandler({ now: () => 0, onToast });
    handler({});
    handler(null);
    // 两者都归一为同一 '(未知键)'，同窗口内被节流 → 只弹 1 次
    expect(onToast).toHaveBeenCalledTimes(1);
    expect(onToast.mock.calls[0]).toEqual(['(未知键)', '']);
  });
});
