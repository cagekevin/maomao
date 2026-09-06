// @vitest-environment node
/**
 * settingsApi 单测（批 2，API 封装层，settings 子目录）。
 * 覆盖：providerApi.getProviders/saveProviders/testConnection/fetchModels/syncConfigBase
 * 的成功路径与错误抛出（request 内部统一把非 2xx 转 Error）。
 * 策略：node + vi.stubGlobal('fetch')。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { jsonResp } from './_testUtils.mjs';

// setup.mjs 已把 globalThis.fetch 定义为共享 vi.fn；此处做类型对齐以启用 .mock* / mock.calls。
const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

const { providerApi } = await import('@/components/base/api/localToolApi.ts');

beforeEach(() => fetchMock.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe('settingsApi — providerApi 成功路径', () => {
  it('getProviders 走 GET', async () => {
    fetchMock.mockResolvedValue(jsonResp({ providers: [] }));
    await providerApi.getProviders();
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:18080/api/providers');
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
  });

  it('saveProviders 走 PUT，body 含 providers', async () => {
    fetchMock.mockResolvedValue(jsonResp({ ok: true }));
    await providerApi.saveProviders([{ id: 'p1' }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/providers');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ providers: [{ id: 'p1' }] });
  });

  it('testConnection 走 POST', async () => {
    fetchMock.mockResolvedValue(jsonResp({ ok: true }));
    await providerApi.testConnection({ id: 'p1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/providers/test-connection');
    expect(init.method).toBe('POST');
  });

  it('fetchModels 走 POST，含 encodeURIComponent 的 id', async () => {
    fetchMock.mockResolvedValue(jsonResp({ models: [] }));
    await providerApi.fetchModels('a/b');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/providers/a%2Fb/fetch-models');
    expect(init.method).toBe('POST');
  });

  it('syncConfigBase 走 PUT /api/config/base', async () => {
    fetchMock.mockResolvedValue(jsonResp({ ok: true }));
    await providerApi.syncConfigBase([{ id: 'p1' }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/config/base');
    expect(init.method).toBe('PUT');
  });
});

describe('settingsApi — 错误路径', () => {
  it('非 2xx 抛 error/detail 信息', async () => {
    fetchMock.mockResolvedValue(jsonResp({ detail: 'bad' }, false, 400));
    await expect(providerApi.getProviders()).rejects.toThrow('bad');
  });

  it('无 detail/error 时 message 为空，status 单独暴露', async () => {
    fetchMock.mockResolvedValue(jsonResp({}, false, 500));
    await expect(providerApi.getProviders()).rejects.toMatchObject({
      name: 'HttpError',
      status: 500,
      message: '',
    });
  });
});
