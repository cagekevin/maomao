import { describe, it, expect, vi, beforeEach } from 'vitest';

const { showToast, dismissToast, clearToasts, subscribeToasts, getToasts, TOAST_COALESCED } =
  await import('../../src/components/base/core/event/toastStore.ts');

beforeEach(() => {
  clearToasts();
});

describe('toastStore §基础设施 提示', () => {
  it('showToast 追加一条并返回自增 id', () => {
    const id = showToast('你好');
    expect(id).toBe(1);
    const list = getToasts();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 1, message: '你好', type: 'info', duration: 2500 });
  });

  it('showToast 默认 type=info，可指定 success/error/warning', () => {
    showToast('ok', { type: 'success' });
    showToast('err', { type: 'error' });
    const list = getToasts();
    expect(list[0].type).toBe('success');
    expect(list[1].type).toBe('error');
  });

  it('message 非字符串被转成字符串（防御 null/undefined）', () => {
    showToast(null as never);
    expect(getToasts()[0].message).toBe('');
  });

  it('dismissToast 按 id 删除', () => {
    const id1 = showToast('a');
    const id2 = showToast('b');
    dismissToast(id1);
    const list = getToasts();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(id2);
  });

  it('clearToasts 清空全部', () => {
    showToast('a');
    showToast('b');
    clearToasts();
    expect(getToasts()).toHaveLength(0);
  });

  it('clearToasts 空列表时不触发订阅通知（emit 短路）', () => {
    const fn = vi.fn();
    subscribeToasts(fn);
    clearToasts(); // 已空 → 不应 notify unnecessarily（行为：无 toast 时不 emit）
    expect(fn).not.toHaveBeenCalled();
  });

  it('subscribe 在 showToast 时被通知', () => {
    const fn = vi.fn();
    subscribeToasts(fn);
    showToast('hi');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

/**
 * 同文案合并窗口（`coalesceMs`）—— 2026-09-17 从 `core/degrade.ts` 的模块级全局单槽**下沉**到展示层：
 * 「用户看到什么、多频繁」是展示层的真相，转发方（degrade）只声明窗口、不留状态。
 * 本组锁死展示层自己的实现（此前状态长在转发原语里，属消费者越权）。
 */
describe('toastStore §合并窗口（coalesceMs，展示层 owner）', () => {
  it('窗口内同文案 + 同 type → 合并（返回 TOAST_COALESCED，不追加）；窗口过后恢复', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      const first = showToast('T', { type: 'warning', coalesceMs: 5000 });
      expect(first).toBeGreaterThan(0);
      expect(showToast('T', { type: 'warning', coalesceMs: 5000 })).toBe(TOAST_COALESCED);
      expect(getToasts()).toHaveLength(1);

      vi.setSystemTime(6000); // 出窗口
      expect(showToast('T', { type: 'warning', coalesceMs: 5000 })).toBeGreaterThan(0);
      expect(getToasts()).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('不同文案互不合并（各弹一条）', () => {
    showToast('A', { type: 'warning', coalesceMs: 5000 });
    expect(showToast('B', { type: 'warning', coalesceMs: 5000 })).toBeGreaterThan(0);
    expect(getToasts()).toHaveLength(2);
  });

  it('未声明 coalesceMs → 从不合并（既有调用方行为不变）', () => {
    showToast('dup');
    expect(showToast('dup')).toBeGreaterThan(0);
    expect(getToasts()).toHaveLength(2);
  });

  it('clearToasts 连合并窗口一起清（清屏后同文案必须能再弹，否则「清空」成了新的静默）', () => {
    showToast('T', { type: 'warning', coalesceMs: 5000 });
    expect(showToast('T', { type: 'warning', coalesceMs: 5000 })).toBe(TOAST_COALESCED);
    clearToasts();
    expect(showToast('T', { type: 'warning', coalesceMs: 5000 })).toBeGreaterThan(0);
  });
});
