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
 * 素材库 ResourceLibrary / 生成 GeneratedView 两个面板共用同一形状，收口在此避免两处各写一份漂移。
 * 结构上可赋值给拖拽用的 ResourceMoveItem（useResourceMoveToFolder）。
 */
export interface ResourceItem {
  id: string;
  name?: string;
  url?: string;
  type?: string;
  folder?: string;
  source?: string;
  /** docs/122 #4：稳定 contentId（后端 sha1 去重身份列别名；folder/url 无关），供 asset 引用 */
  contentId?: string;
  /** 字节大小（后端 resources.size）；并入 resourceStore 供 AssetNode 解析时回填 */
  size?: number;
  /** 时间戳（后端 resources.timestamp）；回填空默认 now */
  timestamp?: number;
  /** 项目隔离标识（后端 resources.project_id）；legacy NULL 全项目可见 */
  projectId?: string;
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
/** fetchTasks 列表项（Task 子集，供 ImageGenerate 等读 nodeId/status/resultUrl）。 */
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
// GET /api/resources?page&pageSize&filters=JSON&projectId= → 分页资源列表
// projectId（可选，docs/122 #2/#3）：后端按 `(project_id IS NULL OR project_id=?)` 过滤，
// legacy(project_id NULL)全项目可见、显式 projectId 的行只对其可见；不传 = 全量(向后兼容)。
export async function fetchResources({
  folder,
  folderExact,
  page = 1,
  pageSize = 60,
  type,
  projectId,
}: {
  folder?: string;
  /**
   * 文件夹**精确匹配**（`folder = ?`，不含子目录）。
   *
   * 【与 `folder` 的区别（2026-09-17）】
   *  · `folder` 走 `{eqOrPrefix}`（精确 + 前缀）—— 用于「含子目录」的浏览（如进入某分类看其下全部）。
   *  · `folderExact` 走标量等值（后端 `buildPaginatedQuery` 的普通值分支）—— 用于
   *    **只看该目录本身**（`migrated` 根 = 尚未归类的素材 + 其下子文件夹卡片）。
   * 二者是**不同的查询语义，不是同义的两种写法**，故并存（勿合并）。
   */
  folderExact?: string;
  page?: number;
  pageSize?: number;
  type?: string;
  projectId?: string;
} = {}): Promise<ApiEnvelope<PagedResult<ResourceItem>>> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  // folder 默认用 `{eqOrPrefix}`（精确 + 前缀）而不是等值：原 pill「全部」以 `migrated` 为根，
  // 等值查询不返回 `migrated/人物|场景|道具` 等子目录行 → 归类进子目录的素材会消失
  // （TD-12-13 实测：等值时 migrated 仅 5 条；前端 `matchesFolder` 本就是前缀语义，两套判据必漂移）。
  // ⚠️ `folderExact` 是**有意**的相反语义（只要该目录本身），故显式独立参数，不走上面的前缀分支。
  const filters: Record<string, string | { eqOrPrefix: string }> = {};
  if (folder) filters.folder = { eqOrPrefix: folder };
  if (folderExact) filters.folder = folderExact;
  if (type) filters.type = type;
  if (Object.keys(filters).length) params.set('filters', JSON.stringify(filters));
  if (projectId) params.set('projectId', projectId);
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

// GET /api/resources/rename?id=...&name=... → { data:{ id,url,name } }（重命名后回写资源）
export async function renameResource(id: string, name: string): Promise<ApiEnvelope<ResourceItem>> {
  return httpPost(
    `${API_BASE}/api/resources/rename?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`,
    null,
    { label: 'renameResource' },
  );
}

// ─────────────────────────── 声音库（剪辑器「音效 / 音乐」· 自建本地库）───────────────────────────
/**
 * 声音库条目（后端 `GET /api/sounds/library` 的 `data.items` 元素）。
 *
 * 【为什么是自建库（TD-22-47）】cutia 原版打第三方代理端点 `/api/sounds/search`（上游 Freesound），
 * 本仓后端从未实现 → 请求落到 catch-all 透传 → 前端 `response.ok` 为假 → **静默空面板**。
 * 现改为扫描本地目录（见 `localTool/src/routes/sounds.ts`），零第三方依赖。
 */
export interface SoundLibraryItem {
  /** 稳定数字 id（后端按路径做 FNV-1a）—— 前端 `SoundEffect.id` 是 number，存档也用它做键。 */
  id: number;
  name: string;
  kind: 'effect' | 'music';
  /** 可直接喂 `<audio>` / 入轨的 `/files/...` URL。 */
  url: string;
  ext: string;
  size: number;
}

/**
 * GET /api/sounds/library?kind=effect|music → 本地声音库清单（自建）。
 * `data.dir` = 该 kind 对应的磁盘相对目录；**空库时前端据此引导用户放文件**（空库是合法状态，不是错误）。
 */
export async function fetchSoundLibrary({
  kind,
}: {
  kind: 'effect' | 'music';
}): Promise<ApiEnvelope<{ kind: string; dir: string; items: SoundLibraryItem[] }>> {
  return httpRequest(`${API_BASE}/api/sounds/library?kind=${encodeURIComponent(kind)}`, {
    label: 'fetchSoundLibrary',
  });
}

// ─────────────────────────── 存储健康（管理端报表 + 安全删除）───────────────────────────
/**
 * GET /api/admin/storage-health — 存储健康总报表（只读）。
 * 返回 code-data 信封：{ totalBytes, fileCount, byCategory, projects[], orphans[], duplicates[], orphanBytes, reclaimableBytes, scannedAt }。
 * byCategory{ 图片/视频/音频/文本/其他:{count,size} }；projects{ projectId,projectName,kvBytes,fileBytes,fileCount }；
 * orphans{ path,name,size,category }；duplicates{ name,size,count,files[]{path,size,referenced},reclaimable }。
 */
export async function fetchStorageHealth(): Promise<
  ApiEnvelope<{
    totalBytes: number;
    fileCount: number;
    byCategory: Record<string, { count: number; size: number }>;
    projects: Array<{
      projectId: string;
      projectName: string;
      kvBytes: number;
      fileBytes: number;
      fileCount: number;
    }>;
    orphans: Array<{ path: string; name: string; size: number; category: string }>;
    duplicates: Array<{
      name: string;
      size: number;
      count: number;
      files: Array<{ path: string; size: number; referenced: boolean }>;
      reclaimable: number;
    }>;
    orphanBytes: number;
    reclaimableBytes: number;
    scannedAt: number;
  }>
> {
  return httpRequest(`${API_BASE}/api/admin/storage-health`, { label: 'fetchStorageHealth' });
}

/**
 * POST /api/admin/delete-file — 安全删除单个 uploads 文件（孤儿/重复副本共用）。
 * body { path: 相对 uploads 的路径 }。后端仅删全库无引用文件；被引用 → { ok:false, skipped:'referenced' }。
 */
export async function deleteStorageFile(
  path: string,
): Promise<
  ApiEnvelope<{ ok: boolean; path?: string; skipped?: 'referenced' | 'protected' | 'missing' }>
> {
  return httpRequest(`${API_BASE}/api/admin/delete-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
    label: 'deleteStorageFile',
  });
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

/** kv 写入结果（信封 code-data；version = 服务端写入后的快照版本） */
export interface KvSetResult {
  code?: number;
  data?: { ok?: boolean; version?: number };
}

// POST /api/kv/set { key, value, ifVersion? }
// ifVersion 传入 = 乐观并发写入（CAS）：服务端版本不等于它时返回 409 且不写任何内容
// （调用点用 httpClient 已导出的 HttpError.status === 409 识别；4xx 不重试是现状行为）。
export async function kvSet(
  key: string,
  value: unknown,
  opts: { ifVersion?: number } = {},
): Promise<KvSetResult> {
  return httpRequest(`${API_BASE}/api/kv/set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key,
      value,
      ...(opts.ifVersion !== undefined ? { ifVersion: opts.ifVersion } : {}),
    }),
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

// GET /api/kv/version?key=… → 版本号（读不到按 0；轻量端点，别用 kvGet 拉整包做心跳）
export async function kvGetVersion(key: string): Promise<number> {
  const res = await httpRequest<{ data?: { version?: number } }>(
    `${API_BASE}/api/kv/version?key=${encodeURIComponent(key)}`,
    { label: 'kvGetVersion' },
  );
  const v = res?.data?.version;
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

// GET /api/kv/keys → 实际存在的 KV 键名（**已由后端排除** CAS 内部元数据 `<key>_version`）
//
// 【TD-02-30 · 为什么需要它】前端只持有**键模板**（`contracts.getKvKeyPatterns()`），
// 「哪些实例真的存在」只有后端知道。备份（backupStore.exportAll）靠它才能做到
// 「新工程域在 STORAGE_KEYS 登记 → 自动进备份」，而不给每个域手写一套收集逻辑
// （那正是 M3「手写清单必漂移」母体：backupStore 收不到剪辑/3D 工程就是这个成因）。
//
// 【失败语义 = 上抛，不归零】拿不到键清单 → 备份会**静默缺数据**（比整包失败更危险），
// 故形状不符一律抛（httpRequest 已保证非 2xx 抛 HttpError）；调用方（exportAll）据此
// 让本次备份失败可见，而不是产出一个"看起来成功"的残缺包。
export async function kvKeys(): Promise<string[]> {
  const res = await httpRequest<{ data?: { keys?: unknown } }>(`${API_BASE}/api/kv/keys`, {
    label: 'kvKeys',
  });
  const keys = res?.data?.keys;
  if (!Array.isArray(keys)) throw new Error('kvKeys：响应缺少 data.keys 数组（契约不符）');
  return keys as string[];
}

// ─────────────────────────── files 域（候选 C 已移出 → filesApi）───────────────────────────
// 文件域成员（openLocalFolder/openFileDir/relativePathFromUrl/moveFile/canMoveAsset/
// resolveMovePaths/createFolder + OpenPathData/FileOpResult）已随候选 C 收口到 filesApi.ts
// （全站文件域单点）。本模块不再持有文件域逻辑，保持纯 CRUD + kv + providers。
