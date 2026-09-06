// 回归测试：kvStore.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// kvGet/kvSet/kvDelete 经 localToolApi → httpClient，其内部 logger.debug 会 fire-and-forget 调
// fetch(/api/logs)，为不污染 fetch 断言，mock 掉 logger（接口须与真实 logger 对齐，含 debug，否则 httpClient 崩溃）。
vi.mock('../../src/components/base/core/logger.ts', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    debug: vi.fn(),
  },
}));

import { kvGet, kvSet, kvDelete } from '@/components/base/storage/kvStore.ts';

const API_BASE = 'http://127.0.0.1:18080';

// 可变 fetch mock，每个用例自行设置实现
let fetchImpl;
beforeEach(() => {
  fetchImpl = vi.fn();
  vi.stubGlobal('fetch', fetchImpl);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** 构造一个 ok 的 fetch 响应 */
function okJson(body) {
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
}
/** 构造一个非 ok 的 fetch 响应（无 json 方法也安全，因为 kv 层只判 res.ok） */
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

describe('kvStore kvGet', () => {
  it('构造正确的 URL（GET + encodeURIComponent）并解析返回值', async () => {
    const key = 'snap 1/2';
    fetchImpl.mockResolvedValue(okJson({ a: 1 }));
    const r = await kvGet(key);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(
      `${API_BASE}/api/kv/get?key=${encodeURIComponent(key)}`,
    );
    expect(r).toEqual({ a: 1 });
  });
  it('key 不存在时返回 null', async () => {
    fetchImpl.mockResolvedValue(okJson(null));
    const r = await kvGet('missing');
    expect(r).toBeNull();
  });
  it('非 ok 响应抛 HttpError（含 status，message 兜底空）', async () => {
    fetchImpl.mockResolvedValue(notOk(500));
    await expect(kvGet('x')).rejects.toMatchObject({ name: 'HttpError', status: 500, message: '' });
  });
  it('fetch 网络异常透传 reject', async () => {
    fetchImpl.mockRejectedValue(new Error('network down'));
    await expect(kvGet('x')).rejects.toThrow('network down');
  });
});

describe('kvStore kvSet', () => {
  it('构造正确的 URL/方法/body（POST + JSON.stringify({key,value})）', async () => {
    const key = 'k1';
    const value = { nodes: [], edges: [] };
    fetchImpl.mockResolvedValue(okJson({ ok: true }));
    const r = await kvSet(key, value);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, opt] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/kv/set`);
    expect(opt.method).toBe('POST');
    expect(opt.headers['Content-Type']).toBe('application/json');
    expect(opt.body).toBe(JSON.stringify({ key, value }));
    expect(r).toEqual({ ok: true });
  });
  it('非 ok 响应抛 HttpError', async () => {
    fetchImpl.mockResolvedValue(notOk(503));
    await expect(kvSet('k1', 1)).rejects.toMatchObject({
      name: 'HttpError',
      status: 503,
      message: '',
    });
  });
});

describe('kvStore kvDelete', () => {
  it('构造正确的删除 URL（GET + encodeURIComponent）', async () => {
    const key = 'del/me';
    fetchImpl.mockResolvedValue(okJson({ ok: true }));
    const r = await kvDelete(key);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(
      `${API_BASE}/api/kv/delete?key=${encodeURIComponent(key)}`,
    );
    expect(r).toEqual({ ok: true });
  });
  it('非 ok 响应抛 HttpError', async () => {
    fetchImpl.mockResolvedValue(notOk(500));
    await expect(kvDelete('k1')).rejects.toMatchObject({
      name: 'HttpError',
      status: 500,
      message: '',
    });
  });
  it('删不存在的 key 仍返回 ok（契约约定）', async () => {
    fetchImpl.mockResolvedValue(okJson({ ok: true }));
    const r = await kvDelete('not-exist');
    expect(r).toEqual({ ok: true });
  });
});

// storageGet / storageSet / storageDelete 中间层已折叠进 contentStore（2026-09-04 中间层折叠）。
// 其 KV 路由判定（原 isKvKey）归入 contentStore.resolveBackend、KV 降级（原 storageXxx）内联为
// writeKvWithFallback/readKvWithFallback/deleteKvWithFallback；行为覆盖由 tests/unit/contentStore.test.ts
// 的「KV 路由 / 降级行为 / 等价性回归」断言承接（见方案 §5.3）。本文件只保留 kv 三件套壳测试。
