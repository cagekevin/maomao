import { describe, it, expect, vi, beforeEach } from 'vitest';

const { showToast, dismissToast, clearToasts, subscribe, getToasts } =
  await import('../../src/components/base/core/toastStore.ts');

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
    showToast(null);
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
    subscribe(fn);
    clearToasts(); // 已空 → 不应 notify unnecessarily（行为：无 toast 时不 emit）
    expect(fn).not.toHaveBeenCalled();
  });

  it('subscribe 在 showToast 时被通知', () => {
    const fn = vi.fn();
    subscribe(fn);
    showToast('hi');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
