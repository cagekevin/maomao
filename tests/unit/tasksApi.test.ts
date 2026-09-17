// @vitest-environment node
/**
 * tasksApi 单测（批 2，API 封装层）。
 * 覆盖：fetchTasks/saveTask/batchSaveTasks/deleteTask/batchDeleteTasks/clearAllTasksApi
 * 的成功路径与 HTTP 错误抛出。策略：node + vi.stubGlobal('fetch')。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { jsonResp } from './_testUtils.mjs';

// 全局 fetch 已在 tests/setup.mjs 强制 mock 为 vi.fn()，此处取共享实例。
// 类型对齐：TS 默认把 globalThis.fetch 当 typeof fetch，cast 为 vi.fn 类型以启用 .mock* / mock.calls。
const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

const api = await import('@/components/base/api/localToolApi.ts');

beforeEach(() => fetchMock.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe('tasksApi — 成功路径', () => {
  it('fetchTasks 解析分页响应', async () => {
    fetchMock.mockResolvedValue(jsonResp({ data: { items: [{ id: 't1' }], total: 1 } }));
    // 【2026-09-17 修正】原传 `keyword` —— 后端 `parsePagination` 读的是 `search`，
    // 两边名字不一致 ⇒ 搜索静默失效。现统一为 search（断言 URL 里也必须是真的 search）。
    const res = await api.fetchTasks({ search: '视频' });
    expect(res.data.items).toHaveLength(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/api/tasks?');
    expect(fetchMock.mock.calls[0][0]).toContain('search=%E8%A7%86%E9%A2%91');
  });

  it('fetchTasks 按 nodeId 精确查（filters 等值，后端 camelToSnake → node_id）', async () => {
    fetchMock.mockResolvedValue(jsonResp({ data: { items: [{ id: 't1' }], total: 1 } }));
    await api.fetchTasks({ nodeId: 'n1' });
    const url = decodeURIComponent(String(fetchMock.mock.calls[0][0]));
    expect(url).toContain('filters={"nodeId":"n1"}');
  });

  it('saveTask 发送 POST JSON', async () => {
    fetchMock.mockResolvedValue(jsonResp({ ok: true }));
    const task = { task_id: 't1', prompt: 'x' };
    await api.saveTask(task);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(task);
  });

  it('batchSaveTasks 空数组直接返回 ok 不请求', async () => {
    const res = await api.batchSaveTasks([]);
    expect(res).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deleteTask 带 encodeURIComponent 的 id', async () => {
    fetchMock.mockResolvedValue(jsonResp({ ok: true }));
    await api.deleteTask('a/b');
    expect(fetchMock.mock.calls[0][0]).toContain('delete?id=a%2Fb');
  });

  it('batchDeleteTasks 空数组返回 deleted:0', async () => {
    const res = await api.batchDeleteTasks([]);
    expect(res).toEqual({ deleted: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clearAllTasksApi 发送 POST', async () => {
    fetchMock.mockResolvedValue(jsonResp({ deleted: 3 }));
    const res = await api.clearAllTasksApi();
    expect(res.deleted).toBe(3);
    expect(fetchMock.mock.calls[0][0]).toContain('/api/tasks/clear');
  });
});

describe('tasksApi — 错误路径', () => {
  it('fetchTasks 非 2xx 抛 HttpError，status 单独暴露', async () => {
    fetchMock.mockResolvedValue(jsonResp({}, false, 500));
    await expect(api.fetchTasks()).rejects.toMatchObject({
      name: 'HttpError',
      status: 500,
      message: '',
    });
  });

  it('saveTask 非 2xx 抛错', async () => {
    fetchMock.mockResolvedValue(jsonResp({}, false, 400));
    await expect(api.saveTask({})).rejects.toMatchObject({
      name: 'HttpError',
      status: 400,
      message: '',
    });
  });

  it('batchSaveTasks 非空数组但失败抛错', async () => {
    fetchMock.mockResolvedValue(jsonResp({}, false, 500));
    await expect(api.batchSaveTasks([{ task_id: 'a' }])).rejects.toMatchObject({
      name: 'HttpError',
      status: 500,
      message: '',
    });
  });

  it('deleteTask 非 2xx 抛错', async () => {
    fetchMock.mockResolvedValue(jsonResp({}, false, 500));
    await expect(api.deleteTask('t1')).rejects.toMatchObject({
      name: 'HttpError',
      status: 500,
      message: '',
    });
  });

  it('batchDeleteTasks 非空 ids 但失败抛错', async () => {
    fetchMock.mockResolvedValue(jsonResp({}, false, 500));
    await expect(api.batchDeleteTasks(['a'])).rejects.toMatchObject({
      name: 'HttpError',
      status: 500,
      message: '',
    });
  });

  it('clearAllTasksApi 非 2xx 抛错', async () => {
    fetchMock.mockResolvedValue(jsonResp({}, false, 500));
    await expect(api.clearAllTasksApi()).rejects.toMatchObject({
      name: 'HttpError',
      status: 500,
      message: '',
    });
  });
});
