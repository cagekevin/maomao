/**
 * 分页列表读取 · **唯一实现**（全库只此一份）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么存在（2026-09-17 收口 · 用户报「导入面板生成只显示 100 条」）】
 * 「怎么读一个分页列表」此前被写成 **7 份**，各带自己的页大小与收敛判据：
 *   ① `panels/ResourceLibrary.tsx`（20/页，且**同文件内两套 hasMore 判据**）
 *   ② `panels/GeneratedView.tsx`（20/页）③ `scriptbox/ScriptBoxAssetPicker.tsx`（60/页，只取第 1 页）
 *   ④ `media/providers/librarySource.ts`（100/页，只取第 1 页）
 *   ⑤ `nodes/ImageGenerate.tsx`（**请求 1000**）⑥ `store/taskStore.ts`（**请求 500**）
 *   ⑦ 后端 `localTool/src/utils/helpers.ts::parsePagination`（把 pageSize 硬性 cap 到 100）
 *
 * 后果不是"少显示"，而是**静默不完整**：
 *  · ⑤⑥ 两处代码按"我拿到了全量"做判断（`items.find(...)` 找不到就认为没有）——实际只拿到 100 条
 *    ⇒ 节点刷新丢图 / 任务中心历史缺失；
 *  · ③④ 只给一部分且不告知"还有更多"（④ 甚至把 `hasMore` 算好放进 meta 却零消费）；
 *  · ① 的两套判据（`items.length < total` 与 `page < totalPages`）在同一文件里各写一遍。
 *
 * 【真相在谁那】后端 `/api/resources` `/api/tasks` 决定 `total` 与**实际**页大小。
 * 故本层**不抄任何上限数字** —— 收敛一律按响应里的 `totalPages`；后端把 cap 从 100 改成 200，
 * 本层与全部消费方**零改动**。`FETCH_PAGE_SIZE` 只是"每次要多少"的**性能参数**，不参与正确性判断
 * （它被 cap 到更小时，`totalPages` 会相应变大，循环照样取齐）。
 *
 * 【能力与用法（两条，各自唯一）】
 *  · `fetchXPage` —— 读一页。消费方自己持有页状态、自己翻页（"还有没有下一页"的呈现判据
 *    归翻页控件 `resource/PagedFooter.tsx`，由 `page`/`totalPages` 直接判定，本层不另立判据）。
 *  · `fetchAllXPages` —— 取全量。调用方**语义上就要全部**时用（如导入弹窗选素材、任务中心列历史）。
 *    ⚠️ 取全量有代价（1000 条 ≈ 10 次请求）：**能按条件精确查的就别取全量**
 *      （如"某节点的任务"走 `nodeId` 精确查 —— 用全量代替查询是上一轮静默不完整的根因之一）。
 *
 * 【失败语义（诚实契约）】
 *  · 任何一页失败 → **原样上抛**，由消费方决定错误态；**不返回"已拿到的部分"冒充完整**。
 *  · 后端响应缺 `items/total/totalPages` → **抛错**（契约违约 fail-fast）：这三个字段是
 *    「拿到了什么 / 总共多少 / 还有没有」的唯一判据，缺了就没法诚实判断，给默认值 = 假成功。
 *
 * 【快照语义】翻页期间后端新增的条目**不保证**包含（循环上界取第 1 页响应的 `totalPages`）——
 * "取全量"本质是一次快照，不是对移动靶的追逐。这样也保证循环**必然终止**（不会因数据持续增长而不返回）。
 * ════════════════════════════════════════════════════════════════
 */
import { fetchResources, fetchTasks } from './localToolApi.ts';
import type { ApiEnvelope, PagedResult, ResourceItem, TaskListItem } from './localToolApi.ts';

/**
 * 单页读取结果（字段**必有**，与后端可选字段区分）—— 消费方唯一的判据来源。
 * 由 `fetchXPage` 从后端信封收窄而来（缺失即抛，见文件头）。
 */
export interface PagedSlice<T> {
  items: T[];
  /** 满足当前查询条件的**总条数**（后端 COUNT(*)） */
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 每页请求量（**性能参数**：只影响往返次数，不参与"是否取齐"的判断）。 */
const FETCH_PAGE_SIZE = 100;

/** 素材库 / 生成列表的读取条件（与 `fetchResources` 参数同形，便于直接透传）。 */
export interface ResourceQuery {
  folder?: string;
  folderExact?: string;
  type?: string;
  projectId?: string;
  /** 关键词（走后端多列 LIKE；**不再**由前端"在已加载页内过滤"） */
  search?: string;
}

/** 任务列表的读取条件。 */
export interface TaskQuery {
  /** 按节点精确查（后端 filters 等值 → `node_id = ?`） */
  nodeId?: string;
  /** 关键词（后端多列 LIKE） */
  search?: string;
}

/** 后端信封 → PagedSlice（缺关键字段即抛：契约违约不许兜底成"就这些"）。 */
function toSlice<T>(
  envelope: ApiEnvelope<PagedResult<T>>,
  reqPage: number,
  reqPageSize: number,
  what: string,
): PagedSlice<T> {
  const d = envelope?.data;
  if (!d || !Array.isArray(d.items)) {
    throw new Error(`[pagedList] ${what} 响应缺 data.items（后端契约违约）`);
  }
  if (typeof d.total !== 'number' || typeof d.totalPages !== 'number') {
    throw new Error(
      `[pagedList] ${what} 响应缺 total/totalPages（后端契约违约：无法判断是否已取全，拒绝假装完整）`,
    );
  }
  return {
    items: d.items,
    total: d.total,
    totalPages: d.totalPages,
    // page/pageSize 是请求参数的回显，缺失时用请求值（不参与"是否取齐"的判断）
    page: typeof d.page === 'number' ? d.page : reqPage,
    pageSize: typeof d.pageSize === 'number' ? d.pageSize : reqPageSize,
  };
}

/** 读素材库/生成列表的**一页**（UI 自己翻页或无限滚动时用）。 */
export async function fetchResourcePage(
  query: ResourceQuery = {},
  page = 1,
  pageSize = FETCH_PAGE_SIZE,
): Promise<PagedSlice<ResourceItem>> {
  const envelope = await fetchResources({ ...query, page, pageSize });
  return toSlice(envelope, page, pageSize, 'fetchResources');
}

/** 读任务列表的**一页**。 */
export async function fetchTaskPage(
  query: TaskQuery = {},
  page = 1,
  pageSize = FETCH_PAGE_SIZE,
): Promise<PagedSlice<TaskListItem>> {
  const envelope = await fetchTasks({ ...query, page, pageSize });
  return toSlice(envelope, page, pageSize, 'fetchTasks');
}

/**
 * 取全量的**唯一实现**：按 `totalPages` 逐页取齐。
 *
 * 不猜上限（后端 cap 改了不用动这里）、不吞错、不静默截断。
 * 串行翻页（不是并发）：后端是单机 SQLite，并发多页只会互相排队，还平白抬高瞬时压力。
 */
async function fetchAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<PagedSlice<T>>,
  pageSize = FETCH_PAGE_SIZE,
): Promise<T[]> {
  const first = await fetchPage(1, pageSize);
  const all = [...first.items];
  const lastPage = Math.max(1, first.totalPages);
  for (let page = 2; page <= lastPage; page++) {
    const next = await fetchPage(page, pageSize);
    all.push(...next.items);
  }
  return all;
}

/** 取**全部**素材库/生成条目（导入弹窗、剧本盒选图等"要看到全部"的入口用）。 */
export async function fetchAllResourcePages(query: ResourceQuery = {}): Promise<ResourceItem[]> {
  return fetchAllPages((page, pageSize) => fetchResourcePage(query, page, pageSize));
}

/** 取**全部**任务（任务中心历史用）。 */
export async function fetchAllTaskPages(query: TaskQuery = {}): Promise<TaskListItem[]> {
  return fetchAllPages((page, pageSize) => fetchTaskPage(query, page, pageSize));
}
