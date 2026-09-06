/**
 * localTool 后端端点统一封装（深模块）—— tasks / projects / resources / providers / kv。
 *
 * 【为什么存在】原 tasksApi / projectsApi / resourcesApi / settingsApi(providerApi) 四薄壳
 * 各自散落「拼 URL + httpRequest + label」，接口面 ≈ 实现体。合并为本模块后：
 *  - URL 契约（/api/tasks、/api/projects、/api/resources、/api/providers、/api/kv）集中到 1 处；
 *  - encodeURIComponent / JSON.stringify POST 样板收口；
 *  - 新增 localTool 端点只需在本文件加 1 个函数，不再开新薄壳文件。
 *
 * 【边界】filesApi 是本项目【全站文件域单点】（落盘 + move/mkdir/open/open-dir + 纯函数），
 *   候选 C（2026-09-04）已把本模块散落的文件域成员全部迁往 filesApi；本模块不再持有文件域
 *   （只剩 fileOpResult 这类返回类型已随迁），保证「文件域只在 filesApi」属实。
 *  kvStore.js 已折叠为纯 re-export 壳（2026-09-04）：storageGet/Set/Delete 分流外壳已收口进
 *  contentStore 的 writeKvWithFallback/readKvWithFallback/deleteKvWithFallback，不再存于 kvStore。
 *  本文件仍是 kv 三层件（kvGet/kvSet/kvDelete）的唯一实现来源，contentStore 直接 import 它们。
 *  本模块只收口「纯 /api/* 透传」的 CRUD + kv 底层。
 *
 * 【传输】一律经 httpClient.httpRequest，继承超时 / 取消 / 错误分类 / 受限重试。
 *  非 2xx 抛 HttpError，本模块不吞错误、不改写 message（CONTEXT 错误透传铁律）。
 */
import { httpRequest, httpPost } from './httpClient.ts';
import { API_BASE } from '../core/config.ts';

/**
 * GET /api/resources 返回的单条资源（后端报文，字段一律可选）。
 * 素材库 AssetLibrary / 生成 GeneratedView 两个面板共用同一形状，收口在此避免两处各写一份漂移。
 * 结构上可赋值给拖拽用的 AssetMoveItem（useAssetMoveToFolder）。
 */
export interface ResourceItem {
  id: string;
  name?: string;
  url?: string;
  type?: string;
  folder?: string;
  source?: string;
}

// ── 后端报文返回类型（基于各端点注释里记录的结构，收窄 Promise<any>）──
/** 统一信封：localTool 端点响应均包在 { data } 层（顶层另有 code/ok 等状态字段）。 */
export interface ApiEnvelope<T> {
  data: T;
  code?: number;
  ok?: boolean;
}
/** 分页列表内层（tasks/resources 共用形状）。items 元素结构由调用方按需断言。 */
export interface PagedResult<T> {
  items: T[];
  total: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  folder?: string;
}
/** { ok:true } 类简单确认响应（save/delete/rename/rescan 等，顶层 ok）。 */
export interface OkResult {
  ok: boolean;
  version?: number;
  conflict?: boolean;
}
/** { deleted:n } 类删除计数响应。 */
export interface DeletedResult {
  deleted: number;
}
/** GET /api/projects 响应内层（字段对齐 projectStore.ProjectBackendData）。 */
export interface ProjectsData {
  projects: { id: string; name: string }[];
  lastOpened: string | null;
  version?: number;
}
/** fetchTasks 列表项（Task 子集，供 PromptNode 等读 nodeId/status/resultUrl）。 */
export interface TaskListItem {
  id?: string;
  nodeId?: string;
  status?: string;
  resultUrl?: string;
  [key: string]: unknown;
}
/** 候选 C：文件域类型 OpenPathData/FileOpResult 已随文件域成员一并迁至 filesApi.ts（文件域单点）。 */
// ─────────────────────────── tasks ───────────────────────────
// GET /api/tasks?page&pageSize&keyword → { items, total }
export async function fetchTasks({
  page = 1,
  pageSize = 200,
  keyword = '',
}: { page?: number; pageSize?: number; keyword?: string } = {}): Promise<
  ApiEnvelope<PagedResult<TaskListItem>>
> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (keyword) params.set('keyword', keyword);
  return httpRequest(`${API_BASE}/api/tasks?${params}`, { label: 'fetchTasks' });
}

// POST /api/tasks/save { task } → { ok:true }（单条 upsert）
// silentSuccess: 任务回写是高频(每轮轮询/progress 都 saveTask)、可还原(任务中心内存态+后端重查可恢复)，
// 成功无排查增量 → 静默成功，仅失败/重试记录（日志降噪 80§十#3）。失败仍走 httpClient 失败日志可见。
export async function saveTask(task: unknown): Promise<OkResult> {
  return httpRequest(`${API_BASE}/api/tasks/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
    label: 'saveTask',
    silentSuccess: true,
  });
}

// POST /api/tasks/batch-save [ task, ... ] → { ok:true }；空数组短路
export async function batchSaveTasks(tasks: unknown[]): Promise<OkResult> {
  if (!tasks || tasks.length === 0) return { ok: true };
  return httpRequest(`${API_BASE}/api/tasks/batch-save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tasks),
    label: 'batchSaveTasks',
    silentSuccess: true,
  });
}

// POST /api/tasks/delete?id=... → { ok:true }
export async function deleteTask(id: string): Promise<OkResult> {
  return httpPost(`${API_BASE}/api/tasks/delete?id=${encodeURIComponent(id)}`, null, {
    label: 'deleteTask',
  });
}

// POST /api/tasks/batch-delete { ids:[...] } → { deleted:n }；空数组短路
export async function batchDeleteTasks(ids: unknown[]): Promise<DeletedResult> {
  if (!ids || ids.length === 0) return { deleted: 0 };
  return httpRequest(`${API_BASE}/api/tasks/batch-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
    label: 'batchDeleteTasks',
  });
}

// POST /api/tasks/clear → { deleted:n }
export async function clearAllTasksApi(): Promise<DeletedResult> {
  return httpPost(`${API_BASE}/api/tasks/clear`, null, { label: 'clearTasks' });
}

// ─────────────────────────── projects ───────────────────────────
// GET /api/projects → { projects, lastOpened }
export async function fetchProjects(): Promise<ApiEnvelope<ProjectsData>> {
  return httpRequest(`${API_BASE}/api/projects`, { label: 'fetchProjects' });
}

// POST /api/projects/save { projects, lastOpened, version } → { ok:true, version }（全量覆盖 + 并发版本保护）
// version：前端声明的项目列表版本号。后端检测 body.version < 库内最新 version → 拒绝（conflict:true），
// 防双页面/旧数据覆盖丢新项目。旧前端不传 version → 后端不拦截（向后兼容）。
export async function saveProjects(
  projects: unknown,
  lastOpened: unknown,
  version?: number,
): Promise<ApiEnvelope<{ conflict?: boolean; version?: number }>> {
  return httpRequest(`${API_BASE}/api/projects/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projects,
      lastOpened,
      version: typeof version === 'number' ? version : undefined,
    }),
    label: 'saveProjects',
  });
}

// ─────────────────────────── resources ───────────────────────────
// GET /api/resources?page&pageSize&filters=JSON → 分页资源列表
export async function fetchResources({
  folder,
  page = 1,
  pageSize = 60,
  type,
}: { folder?: string; page?: number; pageSize?: number; type?: string } = {}): Promise<
  ApiEnvelope<PagedResult<ResourceItem>>
> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const filters: Record<string, string> = {};
  if (folder) filters.folder = folder; // 精确等值匹配当前层级
  if (type) filters.type = type;
  if (Object.keys(filters).length) params.set('filters', JSON.stringify(filters));
  return httpRequest(`${API_BASE}/api/resources?${params.toString()}`, { label: 'fetchResources' }); // { items, total, page, pageSize, totalPages }
}

// POST /api/resources/rescan → 同步磁盘 upload 目录进 resources 表
export async function rescanResources(): Promise<ApiEnvelope<{ scanned: number }>> {
  return httpPost(`${API_BASE}/api/resources/rescan`, null, { label: 'rescanResources' });
}

// POST /api/resources/delete?id=... → { ok:true }
export async function deleteResource(id: string): Promise<ApiEnvelope<OkResult>> {
  return httpPost(`${API_BASE}/api/resources/delete?id=${encodeURIComponent(id)}`, null, {
    label: 'deleteResource',
  });
}

// POST /api/resources/save body 资源对象 → { ok:true }（upsert，含 isFavorite）
export async function saveResource(resource: unknown): Promise<ApiEnvelope<OkResult>> {
  return httpRequest(`${API_BASE}/api/resources/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(resource),
    label: 'saveResource',
  });
}

// GET /api/resources/rename?id=...&name=... → { data:{ id,url,name } }（重命名后回写资源）
export async function renameResource(id: string, name: string): Promise<ApiEnvelope<ResourceItem>> {
  return httpPost(
    `${API_BASE}/api/resources/rename?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`,
    null,
    { label: 'renameResource' },
  );
}

// ─────────────────────────── providers（供应商管理）───────────────────────────
// 保持对象式 Interface（providerStore / cloudSync 共 6 处调用零改造）
interface ProviderRequestOpts {
  method?: string;
  body?: unknown;
  label?: string;
}
const request = <T = unknown>(
  path: string,
  { method = 'GET', body, label }: ProviderRequestOpts = {},
): Promise<T> =>
  httpRequest(`${API_BASE}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    label,
  }) as Promise<T>;

export const providerApi = {
  getProviders: () =>
    request<ApiEnvelope<{ providers: unknown[] }>>('/api/providers', { label: 'getProviders' }),
  saveProviders: (providers: unknown) =>
    request<ApiEnvelope<{ providers: unknown[] }>>('/api/providers', {
      method: 'PUT',
      body: { providers },
      label: 'saveProviders',
    }),
  testConnection: (payload: unknown) =>
    request<OkResult & Record<string, unknown>>('/api/providers/test-connection', {
      method: 'POST',
      body: payload,
      label: 'testConnection',
    }),
  probeAsync: (payload: unknown) =>
    request<OkResult & Record<string, unknown>>('/api/providers/probe-async', {
      method: 'POST',
      body: payload,
      label: 'probeAsync',
    }),
  fetchModels: (id: string) =>
    request<
      ApiEnvelope<{
        image_models: unknown[];
        chat_models: unknown[];
        video_models: unknown[];
        warning?: string;
      }>
    >(`/api/providers/${encodeURIComponent(id)}/fetch-models`, {
      method: 'POST',
      label: 'fetchModels',
    }),
  syncConfigBase: (providers: unknown) =>
    request<ApiEnvelope<OkResult>>('/api/config/base', {
      method: 'PUT',
      body: { providers },
      label: 'syncConfigBase',
    }),
};

// ─────────────────────────── kv 底层（localTool KV，非 localStorage 分流）───────────────────────────
// GET /api/kv/get?key=... → 解析后的值或 null（key 不存在）
export async function kvGet<T = unknown>(key: string): Promise<T | null> {
  // 诚实标注（防假收窄）：泛型 T 由【调用方】单方面声明，本函数不对 T 做运行时校验——服务端已做 JSON.parse，
  // 返回的是「真实 JSON 原样」。若调用侧 T 与实际 JSON 形状不符会静默错位（读到 undefined）。
  // 需要强形状保证的 key：请在调用侧 normalize（形如 localStorage 读取处的 normalizeXxx），勿假定 kvGet 自证。
  const value: unknown = await httpRequest(
    `${API_BASE}/api/kv/get?key=${encodeURIComponent(key)}`,
    { label: 'kvGet' },
  );
  return value == null ? null : (value as T);
}

// POST /api/kv/set { key, value } → { ok:true }
export async function kvSet(key: string, value: unknown): Promise<OkResult> {
  return httpRequest(`${API_BASE}/api/kv/set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
    label: 'kvSet',
  });
}

// POST /api/kv/delete?key=... → { ok:true }（删不存在也 ok）
export async function kvDelete(key: string): Promise<OkResult> {
  return httpRequest(`${API_BASE}/api/kv/delete?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    label: 'kvDelete',
  });
}

// ─────────────────────────── files 域（候选 C 已移出 → filesApi）───────────────────────────
// 文件域成员（openLocalFolder/openFileDir/relativePathFromUrl/moveFile/canMoveAsset/
// resolveMovePaths/createFolder + OpenPathData/FileOpResult）已随候选 C 收口到 filesApi.ts
// （全站文件域单点）。本模块不再持有文件域逻辑，保持纯 CRUD + kv + providers。
