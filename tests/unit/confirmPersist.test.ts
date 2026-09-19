/**
 * `confirmPersist` —— 落盘结果**自确认**原语（TD-24-4 阶段1）。
 *
 * 为什么单独锁它：阶段 1 之后，"落盘失败给谁看"是每个站点自己的职责（用户裁定：不许一个总的
 * 替它们兜底）。本原语是那份判据的**唯一实现** —— 它若判错（把 memory 当成功、把失败吞了），
 * 全部站点的失败处理会一起失效且无人知晓。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { showToastMock } = vi.hoisted(() => ({ showToastMock: vi.fn() }));
vi.mock('../../src/components/base/core/event/toastStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  showToast: showToastMock,
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastWarning: vi.fn(),
  toastInfo: vi.fn(),
}));
vi.mock('../../src/components/base/core/log/logger.ts', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { confirmPersist, tryParseOr } from '../../src/components/base/core/log/degrade.ts';
import { logger } from '../../src/components/base/core/log/logger.ts';

const layer = '测试层';

describe('confirmPersist：落盘结果自确认（唯一判据）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('确认失败（ok:false）→ reportDegrade：logger 留痕 + toast（合并窗口由**展示层**执行）', () => {
    const ok = confirmPersist(
      { ok: false, message: 'localStorage 写入失败' },
      { layer, key: 'k1', toast: 'T1：写入失败' },
    );

    expect(ok).toBe(false);
    expect(logger.warn).toHaveBeenCalled();
    // reportDegrade 只转发：把「允许合并多久」交给展示层（coalesceMs 由 toastStore 持有并执行）
    expect(showToastMock).toHaveBeenCalledWith('T1：写入失败', {
      type: 'warning',
      coalesceMs: expect.any(Number),
    });
  });

  it("landed:'memory'（只进内存，刷新即丢）→ 留痕但**不上报用户**，且不算持久", () => {
    const ok = confirmPersist({ ok: true, landed: 'memory' }, { layer, key: 'k2' });

    expect(ok).toBe(false);
    expect(logger.warn).toHaveBeenCalled();
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it("landed:'local' / 'kv' → 真持久：返回 true，无任何动作", () => {
    expect(confirmPersist({ ok: true, landed: 'local' }, { layer, key: 'k3' })).toBe(true);
    expect(confirmPersist({ ok: true, landed: 'kv' }, { layer, key: 'k4' })).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(showToastMock).not.toHaveBeenCalled();
  });
});

/**
 * `tryParseOr` —— 「压平即留痕」原语（TD-16-49）。
 * 为什么单独锁它：`tryParse` 契约收紧（TD-16-36）只改了生产者，12 个消费点仍在
 * `r.ok ? r.value : <空值>` 处把 `err` 蒸发掉。本原语是那份「压平 + 留痕」判据的**唯一实现** ——
 * 它若判错（成功也留痕 / 失败不留痕），全仓判别联合消费的失败可见性会一起失效且无人知晓。
 */
describe('tryParseOr：压平即留痕（判别联合消费的唯一出口）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('成功 → 返回解析值，不留痕、不提示', () => {
    const v = tryParseOr(() => JSON.parse('{"a":1}') as { a: number } | null, null, {
      layer,
      key: 'ok',
    });
    expect(v).toEqual({ a: 1 });
    expect(logger.warn).not.toHaveBeenCalled();
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it('失败 → 返回 fallback + logger 留痕（裸三元在此处会零留痕 = 静默吞）', () => {
    const v = tryParseOr(() => JSON.parse('{坏'), 'FB', { layer, key: 'bad' });
    expect(v).toBe('FB');
    expect(logger.warn).toHaveBeenCalled();
    expect(showToastMock).not.toHaveBeenCalled(); // 未给 toast → 不打扰用户
  });

  it('失败且给了 toast → 留痕 + 转发展示层（合并窗口归 toastStore，本层不留窗口状态）', () => {
    const v = tryParseOr(() => JSON.parse('{坏'), null, { layer, key: 'bad2', toast: '解析失败' });
    expect(v).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledWith('解析失败', {
      type: 'warning',
      coalesceMs: expect.any(Number),
    });
  });
});
