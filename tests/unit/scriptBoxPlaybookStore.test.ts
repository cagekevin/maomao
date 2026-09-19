// @vitest-environment node
/**
 * scriptBoxPlaybookStore —— 落盘结果**如实返回**（TD-24-4 收尾锁）
 *
 * 【为什么锁它】`saveCustomPlaybook` / `deleteCustomPlaybook` 曾**无条件 `return true`** ——
 *   即便 `contentSet` 落盘失败也宣布成功（**返回值粉饰**）。现返回 `confirmPersist` 的真实结果：
 *   仅当 `landed ∈ {local, kv}` 才 true，其余（失败 / 只在内存）一律 false。
 *
 * 【为什么必须机器判据】失败提示（toast）由 `confirmPersist` 承担，**返回值**这条面没人看 ——
 *   一旦有人改回 `return true`，用户侧的"已保存"就会再次说谎，而没有任何测试会红。
 *
 * 【桩为什么从真模块派生】见 `17-跨区-mock桩脱钩收口-2026-09-18.md`：手抄导出面会在模块加导出时整套件崩。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/components/base/core/contentStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  contentGet: vi.fn(() => ({})),
  contentSet: vi.fn(),
}));

import { contentGet, contentSet } from '../../src/components/base/core/contentStore.ts';
import {
  saveCustomPlaybook,
  deleteCustomPlaybook,
} from '../../src/components/scriptbox/scriptBoxPlaybookStore.ts';

const mockGet = vi.mocked(contentGet);
const mockSet = vi.mocked(contentSet);

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockReturnValue({});
});

describe('playbook 落盘结果如实返回（TD-24-4 锁）', () => {
  it('落盘成功（landed=local）⇒ 返回 true', () => {
    mockSet.mockReturnValue({ ok: true, landed: 'local' } as never);
    expect(saveCustomPlaybook({ id: 'pb-1', label: '我的剧本' } as never)).toBe(true);
  });

  it('落盘失败（ok:false）⇒ 返回 false，不得宣布成功', () => {
    mockSet.mockReturnValue({ ok: false, landed: 'memory', message: '双通道全失' } as never);
    expect(saveCustomPlaybook({ id: 'pb-1', label: '我的剧本' } as never)).toBe(false);
  });

  it('只在内存（ok 但 landed=memory）⇒ 视为未持久，返回 false', () => {
    mockSet.mockReturnValue({ ok: true, landed: 'memory' } as never);
    expect(saveCustomPlaybook({ id: 'pb-1', label: '我的剧本' } as never)).toBe(false);
  });

  it('deleteCustomPlaybook 同样如实：落盘失败 ⇒ false', () => {
    mockGet.mockReturnValue({ 'pb-1': { id: 'pb-1', label: 'x', builtin: false } });
    mockSet.mockReturnValue({
      ok: false,
      landed: 'memory',
      message: 'localStorage 不可用',
    } as never);
    expect(deleteCustomPlaybook('pb-1')).toBe(false);
  });

  it('deleteCustomPlaybook 落盘成功 ⇒ true', () => {
    mockGet.mockReturnValue({ 'pb-1': { id: 'pb-1', label: 'x', builtin: false } });
    mockSet.mockReturnValue({ ok: true, landed: 'local' } as never);
    expect(deleteCustomPlaybook('pb-1')).toBe(true);
  });
});
