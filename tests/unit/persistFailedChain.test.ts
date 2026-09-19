/**
 * 【集成契约】KV 降级链的**失败/降级事实以返回值给全**（原 `persist:failed` 广播已删）。
 *
 * 背景：任何画布变化 → saveCanvasState → contentSetAsync(canvas-state-*  KV 键)
 *   → writeKvWithFallback → kvSet(/api/kv/set) 失败（引擎不可用）→ 降级 sSet 写 localStorage：
 *   ① 降级写成功 → `{ ok:true, landed:'local' }`（数据未丢，但**没进 KV** → 跨设备同步会丢，如实标 local）
 *   ② 降级写也失败 → `{ ok:false, message }`（数据仅在内存，调用方必须自己让用户知道）
 *
 * 【为什么不再订阅事件】`persist:failed` 全局总线已于 2026-09-17（TD-24-4 阶段 2 / TD-16-33）删除：
 * 持久化失败必须由**产生它的那层**以判别联合给全，消费者各自确认 —— 本测试据此断言返回值，
 * 不再断言"发了什么事件"（那条全局吸收层正是被消灭的对象）。
 *
 * 【2026-09-17 修假成功】② 原被压进 ① 的返回值（`{ok:true, landed:'local'}`，而 `landed:'local'`
 * 的字面契约是"已确认写进浏览器持久层"）—— 双通道全失被伪装成真持久。本测试锁死这两支必须分得开。
 *
 * 本测试用【真实 storageAdapter.sSet】（不 mock），模拟 localStorage.setItem 抛错，
 * 锁死上面两条返回事实（避免再靠猜 / 再靠总线）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 用真实 contentStore/storageAdapter；只替换最小外部依赖（fetch 可控、logger 静默）。
vi.mock('../../src/components/base/core/logger.ts', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), log: vi.fn(), debug: vi.fn() },
}));

import { contentSetAsync } from '@/components/base/core/contentStore.ts';
import { CANVAS_STATE_PREFIX } from '@/components/base/core/contracts.ts';

/** ok / 非ok 响应 */
function notOk(status = 500) {
  return {
    ok: false,
    status,
    json: async () => {
      throw new Error('parse fail');
    },
    text: async () => '',
  };
}

let fetchImpl: any;

const CONTENT_STATE_KEY = CANVAS_STATE_PREFIX + 'proj_1';

beforeEach(() => {
  vi.clearAllMocks();
  fetchImpl = vi.fn();
  vi.stubGlobal('fetch', fetchImpl);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('KV 降级链：降级与失败以返回值给全（原 persist:failed 总线已删）', () => {
  it('KV 失败但 localStorage 降级写成功 → landed:local（数据未丢，但没进 KV，如实标降级）', async () => {
    fetchImpl.mockResolvedValue(notOk(500)); // KV /api/kv/set 失败 → 触发降级分支写 local
    const outcome = await contentSetAsync(CONTENT_STATE_KEY, { nodes: [{ id: '1' }] });
    expect(outcome).toEqual({ ok: true, landed: 'local' });
    // storageAdapter.sSet 带 yimao: 前缀，故按拼接后的真实 key 读降级副本确实落盘
    expect(JSON.parse(localStorage.getItem('yimao:' + CONTENT_STATE_KEY)!)).toEqual({
      nodes: [{ id: '1' }],
    });
  });

  it('KV 失败 且 localStorage 降级写也失败 → ok:false（数据仅在内存，调用方必须自报）', async () => {
    fetchImpl.mockResolvedValue(notOk(500)); // KV 失败 → 触发降级分支
    // 降级写 localStorage 失败（模拟配额满/隐私禁用 localStorage.setItem 抛错）
    const setItemSpy = vi.spyOn(globalThis.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError: 存储空间不足');
    });
    try {
      const outcome = await contentSetAsync(CONTENT_STATE_KEY, { nodes: [{ id: '1' }] });
      // 关键断言：不再谎报 {ok:true, landed:'local'}（那等于说"已确认写进浏览器持久层"）
      expect(outcome.ok).toBe(false);
      expect(outcome.ok === false && outcome.message).toContain('降级副本也未持久化');
    } finally {
      setItemSpy.mockRestore();
    }
  });
});
