/**
 * `confirmPersist` —— 落盘结果**自确认**原语（TD-24-4 阶段1）。
 *
 * 为什么单独锁它：阶段 1 之后，"落盘失败给谁看"是每个站点自己的职责（用户裁定：不许一个总的
 * 替它们兜底）。本原语是那份判据的**唯一实现** —— 它若判错（把 memory 当成功、把失败吞了），
 * 全部站点的失败处理会一起失效且无人知晓。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { showToastMock } = vi.hoisted(() => ({ showToastMock: vi.fn() }));
vi.mock('../../src/components/base/core/toastStore.ts', () => ({
  showToast: showToastMock,
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastWarning: vi.fn(),
  toastInfo: vi.fn(),
}));
vi.mock('../../src/components/base/core/logger.ts', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { confirmPersist } from '../../src/components/base/core/degrade.ts';
import { logger } from '../../src/components/base/core/logger.ts';

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
