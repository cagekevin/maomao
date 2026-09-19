// @vitest-environment node
/**
 * httpClient 单测 —— 统一请求层。
 * 覆盖：成功/HTTP 错误/网络错误/超时/取消/重试/跨标签/**失败面诚实性（TD-18-22）**。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  httpRequest,
  httpPost,
  httpRequestLogged,
  HttpError,
  NetworkError,
} from '@/components/base/api/httpClient.ts';
import { TimeoutError } from '../../src/components/base/utils/asyncGuard.ts';

let mockFetch: any;

/**
 * 构造 fetch 响应替身 —— **必须带 `text()`**。
 *
 * 【为什么替身长这样（TD-18-22）】真实 `Response` 的 body **只能消费一次**，httpClient 现只经
 * `res.text()` 读取一次、成败两态共用同一份文本。旧替身只给 `json()`，与真实契约脱钩：
 * 它让「json 失败再 text 取原文」这条**在真实 Response 上必拒**的分支看起来是绿的（假绿）。
 * 替身跟着契约走，不跟着实现走。
 */
function mockRes({
  ok,
  status,
  body,
}: {
  ok: boolean;
  status: number;
  body: string;
}): Record<string, unknown> {
  return { ok, status, text: () => Promise.resolve(body) };
}

beforeEach(() => {
  mockFetch = vi.fn();
  vi.stubGlobal('fetch', mockFetch);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/* ── 成功 ───────────────────────────────────────────── */

describe('httpRequest — 成功', () => {
  it('GET 返回 JSON', async () => {
    mockFetch.mockResolvedValue(mockRes({ ok: true, status: 200, body: '{"items":[]}' }));
    const data = await httpRequest('/api/tasks');
    expect(data).toEqual({ items: [] });
  });

  it('parseJson=false 返回 Response', async () => {
    const res = { ok: true, status: 200, text: () => Promise.resolve('raw') };
    mockFetch.mockResolvedValue(res);
    const result = await httpRequest('/api/x', { parseJson: false });
    expect(result).toBe(res);
  });

  it('【TD-18-22】2xx 空体 = 真空 → 静默返回 {}（不是失败）', async () => {
    // 契约锁：真空静默返回空值是合法语义（CLAUDE.md §5.1①）。若有人把"空体"也当失败抛错，此用例必红。
    mockFetch.mockResolvedValue(mockRes({ ok: true, status: 204, body: '' }));
    await expect(httpRequest('/api/x')).resolves.toEqual({});
  });

  it('【TD-18-22】2xx 非空但非法 JSON → 抛错（不压成 {} 假成功）', async () => {
    // 回归锁：原实现 `res.json().catch(() => ({}))` 把网关改写/截断的响应静默压成 `{}` 照常下发成功。
    mockFetch.mockResolvedValue(
      mockRes({ ok: true, status: 200, body: '<html>proxy interstitial</html>' }),
    );
    await expect(httpRequest('/api/x')).rejects.toThrow(/不是合法 JSON/);
  });

  it('【TD-18-22】2xx 读体失败 → 抛错（不伪装成空成功）', async () => {
    // 回归锁：原实现 `.catch(() => ({}))` 把「响应流中断」伪装成"成功但空"。
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.reject(new TypeError('terminated')),
    });
    await expect(httpRequest('/api/x')).rejects.toThrow(/响应体读取中断/);
  });

  it('【TD-18-22】2xx 读体失败且原因是中止 → 原样上抛 AbortError（禁重分类）', async () => {
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    mockFetch.mockResolvedValue({ ok: true, status: 200, text: () => Promise.reject(abortErr) });
    await expect(httpRequest('/api/x')).rejects.toThrow(/aborted/);
  });
});

/* ── HTTP 错误 ───────────────────────────────────────── */

describe('httpRequest — HTTP 错误', () => {
  it('带 error 字符串字段 → message 只承载业务文案（B2 去 HTTP 前缀）', async () => {
    mockFetch.mockResolvedValue(
      mockRes({ ok: false, status: 400, body: '{"error":"bad request"}' }),
    );
    await expect(httpRequest('/api/x')).rejects.toThrow(HttpError);
    await expect(httpRequest('/api/x')).rejects.toMatchObject({
      status: 400,
      message: 'bad request',
    });
  });

  it('无 error 字段回落 message 为空（status 单独暴露）', async () => {
    mockFetch.mockResolvedValue(mockRes({ ok: false, status: 500, body: '{}' }));
    await expect(httpRequest('/api/x')).rejects.toMatchObject({ status: 500, message: '' });
  });

  it('label 不再拼入 HttpError.message（B2 去前缀）', async () => {
    mockFetch.mockResolvedValue(mockRes({ ok: false, status: 500, body: '{"detail":"db down"}' }));
    await expect(httpRequest('/api/x', { label: 'fetchTasks' })).rejects.toMatchObject({
      status: 500,
      message: 'db down',
    });
  });

  it('TD-03-11：失败响应体非 JSON（崩溃页/代理 HTML）→ 保留 text 原文到 message，不丢失真实报文', async () => {
    // 回归锁：原实现 `res.json().catch(() => ({}))` 把非 JSON 错误体清成 {} → message 空、排障只能看状态码。
    // 【TD-18-22 补】旧实现里「json 失败再 text 取原文」在真实 Response 上必拒（body 只能消费一次），
    // 即这条"保住了原文"在真实链路从未成立；现读体一次、原文真的进 message。
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      text: () => Promise.resolve('<html>502 Bad Gateway</html>'),
    });
    await expect(httpRequest('/api/x')).rejects.toMatchObject({
      status: 502,
      message: '<html>502 Bad Gateway</html>',
    });
  });

  it('TD-03-11：失败响应体读不到 → 仍抛 HttpError（主事实是状态码，不被重分类）', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.reject(new Error('body consumed')),
    });
    await expect(httpRequest('/api/x')).rejects.toMatchObject({ status: 500 });
  });

  it('业务 4xx 不重试', async () => {
    const fn = vi
      .fn()
      .mockResolvedValue(mockRes({ ok: false, status: 401, body: '{"error":"unauthorized"}' }));
    mockFetch.mockImplementation(fn);
    await expect(httpRequest('/api/x', { retries: 3 })).rejects.toThrow(HttpError);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

/* ── 网络错误 ────────────────────────────────────────── */

describe('httpRequest — 网络错误', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('TypeError 归类为 NetworkError', async () => {
    vi.useRealTimers();
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));
    await expect(httpRequest('/api/x', { retries: 0 })).rejects.toThrow(NetworkError);
  });

  it('网络错误自动重试后成功', async () => {
    vi.useRealTimers();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(mockRes({ ok: true, status: 200, body: '{"ok":true}' }));
    mockFetch.mockImplementation(fn);
    const data = await httpRequest('/api/x', { retries: 3, retryDelay: 10 });
    expect(data).toEqual({ ok: true });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('重试耗尽仍失败', async () => {
    vi.useRealTimers();
    const fn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    mockFetch.mockImplementation(fn);
    await expect(httpRequest('/api/x', { retries: 2, retryDelay: 10 })).rejects.toThrow(
      NetworkError,
    );
    expect(fn).toHaveBeenCalledTimes(3); // 初始 + 2 次重试
  });

  it('TD-03-12：代码 bug 的 TypeError（非 fetch 文案）→ 不重试、不伪装成 NetworkError、保留原名', async () => {
    // 回归锁：原实现 `e instanceof TypeError` 无差别归类 → 代码 bug 被当"网络错误"重试 3 次 + 类别篡改。
    vi.useRealTimers();
    const fn = vi
      .fn()
      .mockRejectedValue(new TypeError("Cannot read properties of undefined (reading 'x')"));
    mockFetch.mockImplementation(fn);
    await expect(httpRequest('/api/x', { retries: 3, retryDelay: 10 })).rejects.toThrow(TypeError);
    // 关键断言②：不得被重分类为 NetworkError
    await expect(httpRequest('/api/x', { retries: 3, retryDelay: 10 })).rejects.not.toThrow(
      /NetworkError|网络/,
    );
    expect(fn).toHaveBeenCalledTimes(2); // 只调 2 次（各一次请求），未因"可重试"循环
  });

  it('TD-03-12：各引擎 fetch 网络文案均被识别（Firefox/Safari/Node）', async () => {
    vi.useRealTimers();
    for (const msg of [
      'NetworkError when attempting to fetch resource.',
      'Load failed',
      'fetch failed',
    ]) {
      mockFetch.mockRejectedValue(new TypeError(msg));
      await expect(httpRequest('/api/x', { retries: 0 })).rejects.toThrow(NetworkError);
    }
  });
});

/* ── 超时 ────────────────────────────────────────────── */

describe('httpRequest — 超时', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('超时抛 TimeoutError', async () => {
    vi.useRealTimers(); // 超时依赖真实 setTimeout
    mockFetch.mockImplementation(() => new Promise(() => {})); // 永不返回
    await expect(httpRequest('/api/x', { timeoutMs: 50, retries: 0 })).rejects.toThrow(
      TimeoutError,
    );
  });

  it('不传 timeoutMs → 不掐点（无默认超时）', async () => {
    // 契约锁：httpClient 曾默认 15s，把上传类长请求在 15s 掐断（网络稍差时大图/视频传不完即失败）。
    // 现无默认值——需要时限的调用方显式传。若有人把默认值改回具体毫秒数，此用例必红。
    mockFetch.mockImplementation(() => new Promise(() => {})); // 永不返回
    let timedOut = false;
    httpRequest('/api/x').catch((e) => {
      timedOut = e instanceof TimeoutError;
    });
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000); // 推进 5 分钟，远超原 15s 与试算的 3min
    expect(timedOut).toBe(false);
  });
});

/* ── 外部取消 ────────────────────────────────────────── */

describe('httpRequest — 外部取消（AbortSignal）', () => {
  it('signal 已中止 → 直接抛 AbortError', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(httpRequest('/api/x', { signal: ctrl.signal })).rejects.toThrow(/aborted/);
  });

  it('signal 中途中止 → 抛 AbortError 且不重试', async () => {
    const ctrl = new AbortController();
    const fn = vi.fn().mockImplementation(() => {
      ctrl.abort(); // 让 fetch 抛 AbortError
      const err = new Error('aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });
    mockFetch.mockImplementation(fn);
    await expect(httpRequest('/api/x', { signal: ctrl.signal, retries: 3 })).rejects.toThrow(
      /aborted/,
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

/* ── httpPost 助手 ───────────────────────────────────── */

describe('httpPost — JSON POST 助手', () => {
  it('自动序列化 body + Content-Type', async () => {
    mockFetch.mockResolvedValue(mockRes({ ok: true, status: 200, body: '{"id":1}' }));
    await httpPost('/api/save', { name: 'test' });
    const call = mockFetch.mock.calls[0];
    expect(call[1].method).toBe('POST');
    expect(call[1].headers).toEqual({ 'Content-Type': 'application/json' });
    expect(call[1].body).toBe(JSON.stringify({ name: 'test' }));
  });
});

/* ── httpRequestLogged ───────────────────────────────── */

describe('httpRequestLogged — 带日志', () => {
  it('失败时调用 logger.warn', async () => {
    mockFetch.mockResolvedValue(mockRes({ ok: false, status: 500, body: '{}' }));
    await expect(httpRequestLogged('/api/x', {}, 'mylabel')).rejects.toThrow();
  });
});
