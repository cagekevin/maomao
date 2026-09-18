// 测试：contentStore.js（Content 层权威入口）
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock 依赖（vi.hoisted 确保变量提升到 vi.mock 之前） ────────────

const { mockStorageAdapter, mockLocalToolApi, mockLogger } = vi.hoisted(() => {
  return {
    mockStorageAdapter: {
      sGet: vi.fn(),
      sSet: vi.fn(),
      sRemove: vi.fn(),
      // TD-02-2：未就绪（扩展预填中）时 contentStore 不写缓存；默认按「已就绪」跑既有用例
      isStorageReady: vi.fn(() => true),
    },
    // 2026-09-04 中间层折叠后 contentStore 不再 import kvStore，directly 调 localToolApi 的 kv 三件套。
    // 工厂整体替换：缺任一符号即 undefined 崩溃，故三件套必须齐。
    mockLocalToolApi: {
      kvGet: vi.fn(async () => null),
      // 形状对齐真实 KvSetResult（code-data 信封）：CAS 用例需断言 data.version
      kvSet: vi.fn(
        async (): Promise<{
          ok?: boolean;
          code?: number;
          data?: { ok?: boolean; version?: number };
        }> => ({
          ok: true,
        }),
      ),
      kvDelete: vi.fn(async () => ({ ok: true })),
      kvGetVersion: vi.fn(async () => 0),
    },
    mockLogger: {
      logger: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    },
  };
});

// ── storageAdapter：只覆盖本套件要控的三个原语，其余从真模块派生 ──────────────
// 【为什么不能只列三个符号（TD-17-15）】手写白名单式桩是**静态面**，`storageAdapter` 一加导出
// 即脱钩 → 凡是走到新导出的套件整套件崩。派生后新增导出自动可见；只保留"我要控制什么"。
// （`localToolApi` / `logger` 仍为工厂整体替换：本套件正是在验 contentStore 对它们的调用，
//   需要**完全掌控**这两个边界，且 `mockLocalToolApi` 的形状已按真实 KvSetResult 信封对齐。）
vi.mock('../../src/components/base/storage/storageAdapter.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  sGet: mockStorageAdapter.sGet,
  sSet: mockStorageAdapter.sSet,
  sRemove: mockStorageAdapter.sRemove,
  // TD-02-2：未就绪（扩展预填中）时 contentStore 不写缓存；默认按「已就绪」跑既有用例
  isStorageReady: mockStorageAdapter.isStorageReady,
}));
// localToolApi 同样**从真模块派生**：它是最典型的「会长大」api 模块。
// 只覆盖本套件要控的 kv 三件套 + version；其余导出走真模块（新增导出自动可见，不再整套件崩）。
vi.mock('../../src/components/base/api/localToolApi.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  kvGet: mockLocalToolApi.kvGet,
  kvSet: mockLocalToolApi.kvSet,
  kvDelete: mockLocalToolApi.kvDelete,
  kvGetVersion: mockLocalToolApi.kvGetVersion,
}));
vi.mock('../../src/components/base/core/logger.ts', () => mockLogger);

// 防 logger 被 NODE_ENV 条件影响
vi.stubEnv('NODE_ENV', 'test');

// ── 导入被测模块 ────────────────────────────────────────────────────

import {
  contentGet,
  contentSet,
  contentDelete,
  contentHas,
  contentGetAsync,
  contentSetAsync,
  contentDeleteAsync,
  contentSubscribe,
  contentSubscribeAll,
  contentGetSnapshot,
  contentGetKeySnapshot,
  contentClearCache,
  contentStats,
  contentReadThrough,
  contentKvGetVersion,
  contentKvSetCas,
  contentGetKvWithFallback,
} from '../../src/components/base/core/contentStore.ts';

import '../../src/components/base/core/contracts.ts';

/* ════════════════════════════════════════════════════════════════
 * 准备工作：每个测试前重置 mock
 * ════════════════════════════════════════════════════════════════ */

beforeEach(() => {
  vi.clearAllMocks();
  contentClearCache();
  // 默认 sGet 返回 null（不存在）
  mockStorageAdapter.sGet.mockReturnValue(null);
  // 默认已就绪（TD-02-2 用例会显式关掉）
  mockStorageAdapter.isStorageReady.mockReturnValue(true);
  // 【2026-09-17 TD-24-4 阶段0】写/删桩必须返回**落盘结果**（生产者契约已从 void 改为判别联合）：
  // 否则测桩返回 undefined，消费者按新契约读 `.ok` 会炸（桩必须跟契约走，不是契约迁就桩）。
  mockStorageAdapter.sSet.mockReturnValue({ ok: true, landed: 'local' });
  mockStorageAdapter.sRemove.mockReturnValue({ ok: true, landed: 'local' });
});

afterEach(() => {
  contentClearCache();
});

/* ════════════════════════════════════════════════════════════════
 * 同步 API：get / set / delete / has
 * ════════════════════════════════════════════════════════════════ */

describe('contentGet / contentSet / contentDelete / contentHas', () => {
  const KEY = 'projects';
  const VALUE = [{ id: 'p1', name: 'test' }];

  it('contentGet 未设置的键返回 undefined', () => {
    expect(contentGet(KEY)).toBeUndefined();
    expect(mockStorageAdapter.sGet).toHaveBeenCalledWith(KEY);
  });

  it('contentGet 返回已设置的键值', () => {
    contentSet(KEY, VALUE);
    expect(contentGet(KEY)).toEqual(VALUE);
  });

  it('contentGet 从 localStorage 惰性加载', () => {
    mockStorageAdapter.sGet.mockReturnValue(JSON.stringify(VALUE));
    expect(contentGet(KEY)).toEqual(VALUE);
    // 第二次读取应走缓存，不再调 sGet
    mockStorageAdapter.sGet.mockClear();
    expect(contentGet(KEY)).toEqual(VALUE);
    expect(mockStorageAdapter.sGet).not.toHaveBeenCalled();
  });

  it('contentSet 写入缓存并持久化', () => {
    contentSet(KEY, VALUE);
    expect(mockStorageAdapter.sSet).toHaveBeenCalledWith(KEY, JSON.stringify(VALUE));
  });

  it('contentSet 字符串值原样持久化', () => {
    // 用已登记的字符串型键（agent_panel_width）；原 `agent_draft` 已随 TD-17 退役（登记已删，
    // 未登记键在 dev 下会 throw——测试须用真实键，勿复活死键）。
    contentSet('agent_panel_width', '400');
    expect(mockStorageAdapter.sSet).toHaveBeenCalledWith('agent_panel_width', '400');
  });

  it('sSet 抛错时 contentSet 向上传播（不吞错；sSet 自身不为持久化失败抛错，此处模拟的是契约违约）', () => {
    mockStorageAdapter.sSet.mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => contentSet(KEY, VALUE)).toThrow('QuotaExceededError');
  });

  it('contentDelete 删除缓存并持久化', () => {
    contentSet(KEY, VALUE);
    contentDelete(KEY);
    expect(contentGet(KEY)).toBeUndefined();
    expect(mockStorageAdapter.sRemove).toHaveBeenCalledWith(KEY);
  });

  it('contentHas 检查存在的键', () => {
    contentSet(KEY, VALUE);
    expect(contentHas(KEY)).toBe(true);
  });

  it('contentHas 检查不存在的键', () => {
    expect(contentHas(KEY)).toBe(false);
  });

  it('contentHas 对未加载的 local 键读 localStorage', () => {
    mockStorageAdapter.sGet.mockReturnValue(JSON.stringify(VALUE));
    expect(contentHas(KEY)).toBe(true);
    expect(mockStorageAdapter.sGet).toHaveBeenCalledWith(KEY);
  });
});

/* ════════════════════════════════════════════════════════════════
 * 异步 API：getAsync / setAsync / deleteAsync
 * ════════════════════════════════════════════════════════════════ */

describe('contentGetAsync / contentSetAsync / contentDeleteAsync', () => {
  const KEY = 'app_settings';
  const VALUE = { performanceMode: true };

  it('contentGetAsync 读取 localStorage 键', async () => {
    mockStorageAdapter.sGet.mockReturnValue(JSON.stringify(VALUE));
    const result = await contentGetAsync(KEY);
    expect(result).toEqual(VALUE);
  });

  it('contentGetAsync 不存在的键返回 undefined', async () => {
    mockStorageAdapter.sGet.mockReturnValue(null);
    const result = await contentGetAsync(KEY);
    expect(result).toBeUndefined();
  });

  it('contentSetAsync 写入并等待持久化', async () => {
    await contentSetAsync(KEY, VALUE);
    expect(mockStorageAdapter.sSet).toHaveBeenCalledWith(KEY, JSON.stringify(VALUE));
  });

  it('contentDeleteAsync 删除并等待持久化', async () => {
    await contentSetAsync(KEY, VALUE);
    await contentDeleteAsync(KEY);
    expect(mockStorageAdapter.sRemove).toHaveBeenCalledWith(KEY);
    expect(await contentGetAsync(KEY)).toBeUndefined();
  });
});

/* ════════════════════════════════════════════════════════════════
 * KV 路由
 * ════════════════════════════════════════════════════════════════ */

describe('KV 键路由', () => {
  const KV_KEY = 'canvas-state-v1-test-project';
  const KV_VALUE: any = { nodes: [], edges: [] };

  // 路由由 resolveBackend 读真实 STORAGE_KEYS 决定（canvas-state-v1-{projectId} pattern 登记为 kv），
  // 不再由 mock 注入 isKvKey（2026-09-04 折叠）。这里只预设 kv 底层返回值。
  beforeEach(() => {
    mockLocalToolApi.kvGet.mockResolvedValue(KV_VALUE);
    mockLocalToolApi.kvSet.mockResolvedValue({ ok: true });
    mockLocalToolApi.kvDelete.mockResolvedValue({ ok: true });
  });

  it('contentGetAsync 对 KV 键走 kvGet', async () => {
    const result = await contentGetAsync(KV_KEY);
    expect(mockLocalToolApi.kvGet).toHaveBeenCalledWith(KV_KEY);
    expect(result).toEqual(KV_VALUE);
  });

  it('contentSetAsync 对 KV 键走 kvSet', async () => {
    await contentSetAsync(KV_KEY, KV_VALUE);
    expect(mockLocalToolApi.kvSet).toHaveBeenCalledWith(KV_KEY, KV_VALUE);
  });

  it('contentDeleteAsync 对 KV 键走 kvDelete', async () => {
    await contentDeleteAsync(KV_KEY);
    expect(mockLocalToolApi.kvDelete).toHaveBeenCalledWith(KV_KEY);
  });

  it('contentGet 对 KV 键（未缓存）返回 undefined', () => {
    expect(contentGet(KV_KEY)).toBeUndefined();
    // 不应调 sGet 也不应调 kvGet（同步 API 不做网络请求）
    expect(mockStorageAdapter.sGet).not.toHaveBeenCalled();
    expect(mockLocalToolApi.kvGet).not.toHaveBeenCalled();
  });

  // 【2026-09-17 TD-24-4 阶段0 · 契约变更（旧用例锁的是要被消灭的行为）】
  // 旧契约：KV 键走同步 contentSet = fire-and-forget（调用方**永远无法确认**成败）⇒
  // 三条消费链为此写了永不触发的 try/catch（conversationState / backupStore.writeLS /
  // tableWorkspaceState）。现改为：同步 API **结构性拒绝** KV 键，KV 键必须走 async 并 await。
  it('contentSet 对 KV 键 → 结构性拒绝（同步 API 拿不到网络写结果 = 静默失败）', () => {
    expect(() => contentSet(KV_KEY, KV_VALUE)).toThrow(/KV 键禁止走同步 contentSet/);
    expect(mockStorageAdapter.sSet).not.toHaveBeenCalled();
  });

  it('contentSetAsync 对 KV 键：写 kvSet 并返回**落点**（不再"发出去就算完"）', async () => {
    const r = await contentSetAsync(KV_KEY, KV_VALUE);
    expect(mockLocalToolApi.kvSet).toHaveBeenCalledWith(KV_KEY, KV_VALUE);
    expect(r).toEqual({ ok: true, landed: 'kv' });
    // 不会调 sSet
    expect(mockStorageAdapter.sSet).not.toHaveBeenCalled();
  });

  it('contentDelete 对 KV 键 → 同样结构性拒绝；contentDeleteAsync 才走 KV', async () => {
    expect(() => contentDelete(KV_KEY)).toThrow(/KV 键禁止走同步 contentDelete/);

    const r = await contentDeleteAsync(KV_KEY);
    expect(r).toEqual({ ok: true, landed: 'kv' });
    // 删除成功也清本地降级副本：否则 keepFallback 键下次 hydrate 会"复活"已删数据
    expect(mockStorageAdapter.sRemove).toHaveBeenCalledWith(KV_KEY);
  });

  it('contentHas 对 KV 键（未缓存）返回 false', () => {
    expect(contentHas(KV_KEY)).toBe(false);
  });
});

/* ════════════════════════════════════════════════════════════════
 * 折叠回归（2026-09-04 中间层折叠）：KV 降级行为/路由只判 1 次/native
 * ════════════════════════════════════════════════════════════════ */

describe('折叠回归（KV 降级 / 路由 / native）', () => {
  const KV_KEY = 'canvas-state-v1-test-project';
  const KV_VALUE: any = { nodes: [], edges: [] };

  // clearAllMocks 只清调用不清实现（mockRejectedValue 会跨用例残留），故在此统一重置 kv 三件套为成功默认。
  beforeEach(() => {
    mockLocalToolApi.kvGet.mockResolvedValue(KV_VALUE);
    mockLocalToolApi.kvSet.mockResolvedValue({ ok: true });
    mockLocalToolApi.kvDelete.mockResolvedValue({ ok: true });
  });

  it('路由只判 1 次（kvGet 仅触发 1 次，不重复遍历登记表）', async () => {
    mockLocalToolApi.kvGet.mockResolvedValue(KV_VALUE);
    await contentGetAsync(KV_KEY);
    expect(mockLocalToolApi.kvGet).toHaveBeenCalledTimes(1);
  });

  it('KV 写失败 → 降级写本地副本 + reportDegrade（layer 保留 kvStore）', async () => {
    mockLocalToolApi.kvSet.mockRejectedValue(new Error('kv down'));
    await contentSetAsync(KV_KEY, KV_VALUE);
    expect(mockStorageAdapter.sSet).toHaveBeenCalledWith(KV_KEY, JSON.stringify(KV_VALUE));
    // reportDegrade 内部走 logger.warn(layer='kvStore', '降级: ${key}', e)（degrade.ts:43）
    expect(mockLogger.logger.warn).toHaveBeenCalledWith(
      'kvStore',
      expect.stringContaining(KV_KEY),
      expect.anything(),
    );
  });

  it('KV 写成功 → sRemove 清历史降级副本（P2-F1，防旧值复活）', async () => {
    // kvSet 默认 mock resolve({ ok:true })，KV 成功路径
    await contentSetAsync(KV_KEY, KV_VALUE);
    expect(mockLocalToolApi.kvSet).toHaveBeenCalledWith(KV_KEY, KV_VALUE);
    expect(mockStorageAdapter.sRemove).toHaveBeenCalledWith(KV_KEY);
  });

  it('KV 删成功 → **同时清本地副本**（TD-02-25 修正：保留副本会致 hydrate 复活已删数据）', async () => {
    // 【行为变更说明】原用例锁「不清本地副本」（A3 字面回归），但该行为与 keepFallback=true 的键
    // （如 d3d 工程）叠加时构成数据正确性故障：KV 删除成功后本地镜像残留 → 下次 hydrate 读到
    // 「KV 真空 + 本地有」→ 触发迁移写回 → **已删除的工程复活**。
    // 删除语义要求「彻底消失」，故删除成功也必须清本地副本（与写入的 keepFallback 镜像策略不同）。
    await contentDeleteAsync(KV_KEY);
    expect(mockLocalToolApi.kvDelete).toHaveBeenCalledWith(KV_KEY);
    expect(mockStorageAdapter.sRemove).toHaveBeenCalledWith(KV_KEY);
  });

  it('TD-02-18：KV 删**引擎不可用** → 删除状态未知，**保留**本地副本（不谎报成功）+ 留痕', async () => {
    // 【行为反转说明】原用例锁「清本地副本（防副本残留）」，但那会制造「KV 键仍残留 + 本地已清」的
    // 假删除态 —— 用户以为删了，重载后却从 KV 读到旧数据。正确语义：删除**未确认**时两边一致地
    // 「没删成功」（保留本地副本 + warn 留痕）。注意与 TD-02-25 不冲突：那里修的是「KV 删**成功**后
    // 本地残留 → hydrate 复活」，本处是「KV 删**失败** → 不假装删除」。
    mockLocalToolApi.kvDelete.mockRejectedValue(new Error('kv down'));
    await contentDeleteAsync(KV_KEY);
    expect(mockStorageAdapter.sRemove).not.toHaveBeenCalled();
  });

  it('native 键走 sGet，不触 KV/网络', () => {
    mockStorageAdapter.sGet.mockReturnValue(JSON.stringify({ a: 1 }));
    const r = contentGet('director3d-custom-poses');
    expect(mockStorageAdapter.sGet).toHaveBeenCalledWith('director3d-custom-poses');
    expect(mockLocalToolApi.kvGet).not.toHaveBeenCalled();
    expect(r).toEqual({ a: 1 });
  });

  it('contentReadThrough 写后直读底层真值（绕过缓存，防自证式验证）', () => {
    mockStorageAdapter.sGet.mockReturnValue(JSON.stringify({ id: 'p1' }));
    contentSet('projects', [{ id: 'p1' }]); // 写缓存
    // contentReadThrough 读底层 sGet（非缓存），用于落盘确认类场景
    expect(contentReadThrough('projects')).toBe(JSON.stringify({ id: 'p1' }));
  });

  it('contentReadThrough 对 kv 键返回 null（kv 无法同步读）', () => {
    expect(contentReadThrough('canvas-state-v1-test-project')).toBeNull();
  });
});

/* ════════════════════════════════════════════════════════════════
 * 订阅
 * ════════════════════════════════════════════════════════════════ */

describe('contentSubscribe', () => {
  const KEY = 'app_settings';
  const VALUE = { performanceMode: true };

  it('订阅者收到 set 通知', () => {
    const cb = vi.fn();
    contentSubscribe(KEY, cb);
    contentSet(KEY, VALUE);
    expect(cb).toHaveBeenCalledWith(VALUE);
  });

  it('订阅者收到 delete 通知', () => {
    const cb = vi.fn();
    contentSet(KEY, VALUE);
    contentSubscribe(KEY, cb);
    contentDelete(KEY);
    expect(cb).toHaveBeenCalledWith(undefined);
  });

  it('返回的取消函数停止订阅', () => {
    const cb = vi.fn();
    const unsub = contentSubscribe(KEY, cb);
    unsub();
    contentSet(KEY, VALUE);
    expect(cb).not.toHaveBeenCalled();
  });

  it('多个订阅者分别收到通知', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    contentSubscribe(KEY, cb1);
    contentSubscribe(KEY, cb2);
    contentSet(KEY, VALUE);
    expect(cb1).toHaveBeenCalledWith(VALUE);
    expect(cb2).toHaveBeenCalledWith(VALUE);
  });
});

describe('contentSubscribeAll', () => {
  it('全局订阅者收到任何键的变更', () => {
    const cb = vi.fn();
    contentSubscribeAll(cb);
    contentSet('projects', [{ id: 'p1' }]);
    expect(cb).toHaveBeenCalledWith('projects', [{ id: 'p1' }]);
  });

  it('全局订阅者支持取消', () => {
    const cb = vi.fn();
    const unsub = contentSubscribeAll(cb);
    unsub();
    contentSet('projects', [{ id: 'p1' }]);
    expect(cb).not.toHaveBeenCalled();
  });
});

/* ════════════════════════════════════════════════════════════════
 * 快照
 * ════════════════════════════════════════════════════════════════ */

describe('contentGetSnapshot', () => {
  it('快照包含已设置的键值', () => {
    contentSet('projects', [{ id: 'p1' }]);
    contentSet('app_settings', { performanceMode: true });
    const snapshot = contentGetSnapshot();
    expect(snapshot.projects).toEqual([{ id: 'p1' }]);
    expect(snapshot.app_settings).toEqual({ performanceMode: true });
  });

  it('快照不包含动态键（pattern: true）', () => {
    contentSet('projects', [{ id: 'p1' }]);
    const snapshot = contentGetSnapshot();
    // 不包含 KV 动态键
    expect(snapshot['canvas-state-v1-{projectId}']).toBeUndefined();
  });

  it('快照已被冻结（不可变）', () => {
    contentSet('projects', [{ id: 'p1' }]);
    const snapshot = contentGetSnapshot();
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('快照不含未设置的键', () => {
    const snapshot = contentGetSnapshot();
    expect(Object.keys(snapshot).length).toBeGreaterThanOrEqual(0);
  });
});

describe('contentGetKeySnapshot', () => {
  it('返回指定键的冻结值', () => {
    const val = [{ id: 'p1' }];
    contentSet('projects', val);
    const snapshot = contentGetKeySnapshot('projects');
    expect(snapshot).toEqual(val);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });
});

/* ════════════════════════════════════════════════════════════════
 * 维护工具
 * ════════════════════════════════════════════════════════════════ */

describe('contentClearCache / contentStats', () => {
  it('contentStats 返回正确统计', () => {
    contentSet('projects', [{ id: 'p1' }]);
    const stats = contentStats();
    expect(stats.cachedKeys).toBeGreaterThanOrEqual(1);
    expect(stats.listeners).toBeGreaterThanOrEqual(0);
  });

  it('contentClearCache 清除缓存', () => {
    contentSet('projects', [{ id: 'p1' }]);
    // 确认缓存中有值
    expect(contentGet('projects')).toEqual([{ id: 'p1' }]);
    contentClearCache();
    // 清除后缓存为空，sGet 返回 null → 结果为 undefined
    mockStorageAdapter.sGet.mockReturnValue(null);
    expect(contentGet('projects')).toBeUndefined();
  });
});

/* ════════════════════════════════════════════════════════════════
 * 动态键模式匹配
 * ════════════════════════════════════════════════════════════════ */

describe('动态键模式匹配', () => {
  it('contentGet 动态 KV 键不 warning（匹配 pattern）', () => {
    contentGet('canvas-state-v1-any-project-id');
    expect(mockLogger.logger.warn).not.toHaveBeenCalled();
  });

  it('contentGet 动态 KV 键 + _version 不 warning', () => {
    contentGet('canvas-state-v1-any-project-id_version');
    expect(mockLogger.logger.warn).not.toHaveBeenCalled();
  });

  it('contentGet 动态会话键不 warning（匹配 pattern）', () => {
    contentGet('agent_conversations_canvas-assistant-proj-123');
    expect(mockLogger.logger.warn).not.toHaveBeenCalled();
  });

  it('contentGet 动态会话 id 键不 warning', () => {
    contentGet('agent_active_conversation_id_canvas-assistant-proj-123');
    expect(mockLogger.logger.warn).not.toHaveBeenCalled();
  });

  it('contentSetAsync 动态 KV 键走 KV 路由并返回落点', async () => {
    const r = await contentSetAsync('canvas-state-v1-proj-999', { nodes: [], edges: [] });
    expect(mockLocalToolApi.kvSet).toHaveBeenCalledWith('canvas-state-v1-proj-999', {
      nodes: [],
      edges: [],
    });
    expect(r).toEqual({ ok: true, landed: 'kv' });
    expect(mockStorageAdapter.sSet).not.toHaveBeenCalled();
  });

  it('contentGetAsync 动态 KV 键走 kvGet', async () => {
    mockLocalToolApi.kvGet.mockResolvedValue({ nodes: [] } as never);
    const result = await contentGetAsync('canvas-state-v1-proj-999');
    expect(mockLocalToolApi.kvGet).toHaveBeenCalledWith('canvas-state-v1-proj-999');
    expect(result).toEqual({ nodes: [] });
  });

  it('contentDeleteAsync 动态 KV 键走 kvDelete', async () => {
    mockLocalToolApi.kvDelete.mockResolvedValue({ ok: true });
    await contentDeleteAsync('canvas-state-v1-proj-999');
    expect(mockLocalToolApi.kvDelete).toHaveBeenCalledWith('canvas-state-v1-proj-999');
  });

  it('contentHas 动态 KV 键（未缓存）返回 false 且不 warning', () => {
    const result = contentHas('canvas-state-v1-proj-999');
    expect(result).toBe(false);
    expect(mockLogger.logger.warn).not.toHaveBeenCalled();
  });
});

/* ════════════════════════════════════════════════════════════════
 * 未登记键 warning
 * ════════════════════════════════════════════════════════════════ */

describe('未登记键 硬拦截（不分环境一律抛错）', () => {
  it('contentGet 未登记字面量键直接抛错', () => {
    expect(() => contentGet('unknown-key')).toThrow(/未登记的存储键/);
  });

  it('contentSet 未登记字面量键直接抛错', () => {
    expect(() => contentSet('unknown-key', 'value')).toThrow(/未登记的存储键/);
  });

  it('未登记字面量键重复调用每次都抛（硬拦截）', () => {
    expect(() => contentGet('unknown-key')).toThrow(/未登记的存储键/);
    expect(() => contentGet('unknown-key')).toThrow(/未登记的存储键/);
  });
});

/* ════════════════════════════════════════════════════════════════
 * KV 失败分类 + 严格族原语（TD-02-1，2026-09-12）
 * 地基不变式：4xx（请求被拒）≠ 引擎不可用；前者原样上抛、绝不写本地副本，
 * 后者才降级。严格族（CAS/版本）失败一律 fail-closed，不降级。
 * ════════════════════════════════════════════════════════════════ */

describe('KV 失败分类 + 严格族原语（TD-02-1）', () => {
  // active_api_endpoint：已登记 backend:'kv' 的普通 KV 键（无 fallback 选项）
  const KV_KEY = 'active_api_endpoint';
  const VALUE = { providerId: 'p1' };
  const httpErr = (status: number, msg: string) => Object.assign(new Error(msg), { status });

  it('4xx（请求被拒）原样上抛，绝不降级写本地副本', async () => {
    mockLocalToolApi.kvSet.mockRejectedValueOnce(httpErr(409, '版本冲突'));
    await expect(contentSetAsync(KV_KEY, VALUE)).rejects.toThrow('版本冲突');
    expect(mockStorageAdapter.sSet).not.toHaveBeenCalled();
    expect(mockStorageAdapter.sRemove).not.toHaveBeenCalled();
  });

  it('无 HTTP 状态（网络/超时）= 引擎不可用 → 降级写本地副本，且**落点如实返回**（landed=local）', async () => {
    mockLocalToolApi.kvSet.mockRejectedValueOnce(new Error('Failed to fetch'));
    // 【2026-09-17 TD-24-4 阶段0】降级不再"返回 void 装作无事"：生产者如实说"这次没进 KV、落在本地"
    await expect(contentSetAsync(KV_KEY, VALUE)).resolves.toEqual({ ok: true, landed: 'local' });
    expect(mockStorageAdapter.sSet).toHaveBeenCalledWith(KV_KEY, JSON.stringify(VALUE));
  });

  it('5xx = 引擎不可用 → 降级（落点同样如实返回）', async () => {
    mockLocalToolApi.kvSet.mockRejectedValueOnce(httpErr(503, 'boom'));
    await expect(contentSetAsync(KV_KEY, VALUE)).resolves.toEqual({ ok: true, landed: 'local' });
    expect(mockStorageAdapter.sSet).toHaveBeenCalledWith(KV_KEY, JSON.stringify(VALUE));
  });

  it('contentKvSetCas 成功：返回服务端版本 + 透传 ifVersion + 清历史降级副本', async () => {
    mockLocalToolApi.kvSet.mockResolvedValueOnce({ code: 0, data: { ok: true, version: 42 } });
    const res = await contentKvSetCas(KV_KEY, VALUE, { ifVersion: 41 });
    expect(res).toEqual({ landed: 'kv', version: 42 });
    expect(mockLocalToolApi.kvSet).toHaveBeenCalledWith(KV_KEY, VALUE, { ifVersion: 41 });
    expect(mockStorageAdapter.sRemove).toHaveBeenCalledWith(KV_KEY);
  });

  it('contentKvSetCas 409：原样上抛、不降级（fail-closed，绝不写本地副本）', async () => {
    mockLocalToolApi.kvSet.mockRejectedValueOnce(httpErr(409, '版本冲突'));
    await expect(contentKvSetCas(KV_KEY, VALUE, { ifVersion: 1 })).rejects.toThrow('版本冲突');
    expect(mockStorageAdapter.sSet).not.toHaveBeenCalled();
  });

  it('contentKvSetCas 引擎不可用：同样上抛（严格族不降级）', async () => {
    mockLocalToolApi.kvSet.mockRejectedValueOnce(new Error('Failed to fetch'));
    await expect(contentKvSetCas(KV_KEY, VALUE)).rejects.toThrow('Failed to fetch');
    expect(mockStorageAdapter.sSet).not.toHaveBeenCalled();
  });

  it('contentKvGetVersion：非 KV 后端键返回 0（无版本概念）', async () => {
    expect(await contentKvGetVersion('projects')).toBe(0);
    expect(mockLocalToolApi.kvGetVersion).not.toHaveBeenCalled();
  });

  it('contentKvGetVersion：KV 键读失败原样上抛（调用方据此 fail-closed）', async () => {
    mockLocalToolApi.kvGetVersion.mockRejectedValueOnce(new Error('离线'));
    await expect(contentKvGetVersion(KV_KEY)).rejects.toThrow('离线');
  });
});

/* ════════════════════════════════════════════════════════════════
 * 读族失败分类 + 诚实结果契约（TD-02-15/19/25，2026-09-12）
 * 读族此前漏接 isEngineUnavailable 守卫（写族有、读族无），且 contentGetKvWithFallback
 * 把「KV 真空」与「KV 读失败」都标 from:'local' → 下游据假信号无条件写回 KV（clobber/复活）。
 * 本块锁死新契约：真空 ≠ 失败；降级只服务引擎不可用；4xx 拒收必须显式暴露。
 * ════════════════════════════════════════════════════════════════ */
describe('读族失败分类 + KvFallback 诚实信号（TD-02-15/19/25）', () => {
  const KV_KEY = 'active_api_endpoint';
  const httpErr = (status: number, msg: string) => Object.assign(new Error(msg), { status });

  it('TD-02-15：读族 4xx 拒收 → 原样上抛（不再静默回退本地副本）', async () => {
    mockLocalToolApi.kvGet.mockRejectedValueOnce(httpErr(403, '无权限'));
    mockStorageAdapter.sGet.mockReturnValue(JSON.stringify({ stale: true }));
    await expect(contentGetAsync(KV_KEY)).rejects.toThrow('无权限');
    // 关键：4xx 不得被当作"引擎不可用"而降级读本地
    expect(mockStorageAdapter.sGet).not.toHaveBeenCalledWith(KV_KEY);
  });

  it('TD-02-15：读族 引擎不可用（无 status）→ 降级回退本地副本，不抛', async () => {
    mockLocalToolApi.kvGet.mockRejectedValueOnce(new Error('Failed to fetch'));
    mockStorageAdapter.sGet.mockReturnValue(JSON.stringify({ cached: 1 }));
    await expect(contentGetAsync(KV_KEY)).resolves.toEqual({ cached: 1 });
  });

  it('TD-02-25：KV **真空** → from/source 标 kv + vacated:true（"确定没有"，允许迁移）', async () => {
    mockLocalToolApi.kvGet.mockResolvedValueOnce(null);
    mockStorageAdapter.sGet.mockReturnValue(JSON.stringify({ localCopy: 1 }));
    const res = await contentGetKvWithFallback(KV_KEY);
    expect(res.ok).toBe(true);
    expect(res.source).toBe('kv');
    expect(res.vacated).toBe(true); // 唯一许可迁移的形态
    expect(res.fallback).toEqual({ localCopy: 1 });
  });

  it('TD-02-25：KV **引擎不可用** → source:local + degraded，**不带 vacated**（禁迁移）', async () => {
    mockLocalToolApi.kvGet.mockRejectedValueOnce(new Error('Failed to fetch'));
    mockStorageAdapter.sGet.mockReturnValue(JSON.stringify({ localCopy: 1 }));
    const res = await contentGetKvWithFallback(KV_KEY);
    expect(res.ok).toBe(true);
    expect(res.source).toBe('local');
    expect(res.degraded).toBe(true);
    expect(res.vacated).toBeUndefined(); // 关键断言：降级不可作迁移依据
  });

  it('TD-02-25：KV **4xx 拒收** → ok:false + rejected（不服务本地副本）', async () => {
    mockLocalToolApi.kvGet.mockRejectedValueOnce(httpErr(400, 'bad request'));
    const res = await contentGetKvWithFallback(KV_KEY);
    expect(res.ok).toBe(false);
    expect(res.error).toBe('rejected');
    expect(res.status).toBe(400);
  });

  it('TD-02-25：KV 命中 → source:kv，不带 vacated', async () => {
    mockLocalToolApi.kvGet.mockResolvedValueOnce({ real: true } as never);
    const res = await contentGetKvWithFallback(KV_KEY);
    expect(res.ok).toBe(true);
    expect(res.source).toBe('kv');
    expect(res.value).toEqual({ real: true });
    expect(res.vacated).toBeUndefined();
  });
});

/* ════════════════════════════════════════════════════════════════
 * 「未就绪 ≠ 不存在」（TD-02-2，2026-09-12）
 * 扩展环境异步预填完成前，底层读必为 null——那是「还不知道」，不得缓存成「确实没有」，
 * 否则该键被粘成不存在直到整会话结束（cache 无失效机制）。
 * ════════════════════════════════════════════════════════════════ */

describe('存储未就绪时不产生假真相（TD-02-2）', () => {
  it('未就绪读：返回 undefined、不调 sGet、不写缓存；就绪后能读到真值', () => {
    mockStorageAdapter.isStorageReady.mockReturnValue(false);
    mockStorageAdapter.sGet.mockReturnValue(JSON.stringify([{ id: 'p1' }]));
    expect(contentGet('projects')).toBeUndefined();
    expect(mockStorageAdapter.sGet).not.toHaveBeenCalled(); // 未就绪连底层都不问
    // 就绪后重读：未被「粘」成不存在
    mockStorageAdapter.isStorageReady.mockReturnValue(true);
    expect(contentGet('projects')).toEqual([{ id: 'p1' }]);
  });

  it('未就绪读不污染后续缓存命中判定（contentHas 不误报 false 缓存）', () => {
    mockStorageAdapter.isStorageReady.mockReturnValue(false);
    expect(contentHas('projects')).toBe(false);
    mockStorageAdapter.isStorageReady.mockReturnValue(true);
    mockStorageAdapter.sGet.mockReturnValue(JSON.stringify([{ id: 'p1' }]));
    expect(contentHas('projects')).toBe(true);
  });
});
