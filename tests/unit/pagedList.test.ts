// @vitest-environment node
/**
 * 分页读取唯一实现（`api/pagedList.ts`）单测 —— 覆盖 2026-09-17 收口的**核心正确性**。
 *
 * 【为什么这几条必须有（不是"补覆盖率"）】
 * 本次修复的正确性主张有两条，都必须有**行为断言**兜住，否则回潮无人知晓：
 *  ① **按 totalPages 取齐** —— 此前 7 处各自"只取第一页 / 请求一个以为够大的数"，
 *     导致导入面板只显示 100 条、任务中心历史缺失、生图节点刷新丢图；
 *  ② **缺 total/totalPages 即抛** —— 不允许"不知道总数"被兜底成"就这些"（假成功）。
 *
 * 策略：node 环境 + `vi.stubGlobal('fetch')`（与 tasksApi.test.ts 同款）；
 * 按 URL 里的 `page` 动态返回分页响应，从而真正走到"循环翻页"这段代码。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { jsonResp } from './_testUtils.mjs';

// 全局 fetch 已在 tests/setup.mjs 强制 mock，此处取共享实例。
const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

const paged = await import('@/components/base/api/pagedList.ts');

beforeEach(() => fetchMock.mockReset());

describe('pagedList — 取全量（本次修复的核心）', () => {
  it('★按 totalPages 取齐：3 页 → 请求 3 次并合并（改前只取第 1 页 ⇒ 导入面板最多 100 条）', async () => {
    fetchMock.mockImplementation(async (url: unknown) => {
      // URL 用正则提取（httpClient 传的可能是相对路径，`new URL` 会抛 Invalid URL）
      const page = Number(/[?&]page=(\d+)/.exec(String(url))?.[1] ?? 1);
      return jsonResp({
        data: { items: [{ id: `r${page}` }], total: 3, page, pageSize: 100, totalPages: 3 },
      });
    });

    const all = await paged.fetchAllResourcePages({ folder: 'tasks' });

    expect(all.map((x) => x.id)).toEqual(['r1', 'r2', 'r3']);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('只有一页时只请求 1 次（不做无谓往返）', async () => {
    fetchMock.mockResolvedValue(
      jsonResp({
        data: { items: [{ id: 'r1' }], total: 1, page: 1, pageSize: 100, totalPages: 1 },
      }),
    );

    const all = await paged.fetchAllResourcePages();

    expect(all).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('★后端响应缺 total/totalPages → 抛错（绝不把"不知道总数"伪装成"就这些"）', async () => {
    fetchMock.mockResolvedValue(jsonResp({ data: { items: [{ id: 'r1' }] } }));

    await expect(paged.fetchAllResourcePages()).rejects.toThrow(/total\/totalPages/);
  });
});

describe('pagedList — 单页读取（参数透传）', () => {
  it('keyword 透传为后端 search（不再是"只在已加载页内过滤"）', async () => {
    fetchMock.mockResolvedValue(
      jsonResp({ data: { items: [], total: 0, page: 1, pageSize: 100, totalPages: 1 } }),
    );

    await paged.fetchResourcePage({ search: '猫' });

    const url = decodeURIComponent(String(fetchMock.mock.calls[0][0]));
    expect(url).toContain('search=猫');
  });

  it('nodeId 透传为后端 filters（按节点精确查，不靠"拉全量再筛"）', async () => {
    fetchMock.mockResolvedValue(
      jsonResp({ data: { items: [], total: 0, page: 1, pageSize: 100, totalPages: 1 } }),
    );

    await paged.fetchTaskPage({ nodeId: 'n1' });

    const url = decodeURIComponent(String(fetchMock.mock.calls[0][0]));
    expect(url).toContain('filters={"nodeId":"n1"}');
  });
});
