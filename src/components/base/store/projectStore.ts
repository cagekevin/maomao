/**
 * 项目 store —— 后端化（对齐官方，项目列表 + 当前项目走 localTool /api/projects → SQLite）。
 *
 * 存储策略（双写，兼顾持久化与可用性）：
 *  - 内存 `projects`/`currentProjectId` 是唯一数据源（供 useProjects 实时订阅）。
 *  - 每次变更「同时写」localStorage（兜底，localTool 断开也能用）+ localTool /api/projects（持久化，跨端共享）。
 *  - 启动时 `initProjects()` 从后端加载，以后端为准（localTool 连上时项目跨端共享）。
 *  - 画布快照 canvas-state-v1-${projectId} 走 KV（跨端共享，见 kvStore）。
 */
import { useSyncExternalStore } from 'react';
import { useStoreSelector } from '../../../hooks/useStoreSelector.ts';
import { CANVAS_STATE_PREFIX } from '../storage/index.ts';
import { CANVAS_SCHEMA_VERSION } from '../core/contracts.ts';
import { fetchProjects, saveProjects, ApiEnvelope, ProjectsData } from '../api/localToolApi.ts';
import {
  contentGet,
  contentSet,
  contentGetAsync,
  contentSetAsync,
  contentDeleteAsync,
  createDebouncedPersist,
} from '../core/contentStore.ts';
import { logger } from '../core/logger.ts';

/** 项目结构（对齐官方，仅 id + name） */
export interface Project {
  id: string;
  name: string;
}

/** 后端 /api/projects 返回信封（含项目列表、整表版本号、上次打开与冲突标记） */
type ProjectBackendData = ApiEnvelope<ProjectsData>;

/** 画布快照（规范化读取结构；nodes 可能为 null=空/未存） */
interface CanvasSnapshot {
  nodes: Record<string, unknown>[] | null;
  edges: Record<string, unknown>[];
  schemaVersion: number;
  viewport: { x: number; y: number; zoom: number } | null;
  [k: string]: unknown;
}

/** 画布保存返回结果 */
interface SaveCanvasResult {
  success: boolean;
  skipped?: boolean;
  conflictVersion?: number;
}

const PROJECTS_KEY: string = 'projects';
const LAST_OPENED_KEY: string = 'lastOpenedProject';

let projects: Project[] = loadProjects();
let currentProjectId: string = loadLastOpened();
let loaded = false; // 是否已从后端加载过
let lastSavedVersion = 0; // 画布版本号单调递增保底（同毫秒连续保存时自增）
// 项目列表整体版本号（并发覆盖保护）：从后端 fetch 时更新，保存时带回后端，
// 后端检测旧版本拒绝覆盖（防双页面/旧数据覆盖丢新项目）。对齐画布快照版本冲突检测思路。
let projectVersion = 0;
const listeners: Set<() => void> = new Set();

function loadProjects(): Project[] {
  const list = contentGet(PROJECTS_KEY);
  if (Array.isArray(list) && list.length > 0) return list as Project[];
  const seeded: Project[] = [{ id: 'default', name: '默认项目' }];
  contentSet(PROJECTS_KEY, seeded);
  return seeded;
}

function loadLastOpened(): string {
  const v: unknown = contentGet(LAST_OPENED_KEY);
  const id = typeof v === 'string' && v ? v : 'default';
  return id;
}

// P4 落盘节流：项目切换/重命名等离散操作同步 stringify + 双写（localStorage + 后端）节流合并，
// 消除高频切换时的重复 JSON.stringify 与 saveProjects 网络请求。通知订阅者保持即时。
// write 是「读当前最新 projects/currentProjectId」的 thunk——flush 时才执行，合并窗口内最终态。
// 兜底：createDebouncedPersist 自动注册 pagehide flush，极端刷新/关闭不丢最后变更。
// 合并后端数据到本地（防覆盖）：以后端为基准，补充本地独有项目；更新版本号。
// 供 initProjects（启动加载）与保存冲突自愈（见 persistDebounced）复用。
function mergeFromBackend(data: ProjectBackendData): void {
  const list: Project[] = Array.isArray(data?.data?.projects)
    ? data.data.projects.map((p) => ({ id: p.id, name: p.name }))
    : [];
  const localList: Project[] = Array.isArray(projects) ? projects : [];
  const seen = new Set<string>();
  const merged: Project[] = [];
  for (const p of list) {
    if (p?.id && !seen.has(p.id)) {
      seen.add(p.id);
      merged.push({ id: p.id, name: p.name });
    }
  }
  for (const p of localList) {
    if (p?.id && !seen.has(p.id)) {
      seen.add(p.id);
      merged.push({ id: p.id, name: p.name });
    }
  }
  if (typeof data?.data?.version === 'number') projectVersion = data.data.version;
  if (merged.length === 0) return;
  projects = merged;
  currentProjectId =
    data?.data?.lastOpened && merged.some((p) => p.id === data.data.lastOpened)
      ? data.data.lastOpened
      : merged[0]?.id || 'default';
  notify();
}

// 后端保存返回冲突（旧版本被拒，说明另一窗口/更新数据先写了）→ 重新合并以获取最新项目与版本。
// 用 fetch（非 persist）避免「冲突→persist→再冲突」递归；合并后本地即拥有最新数据。
function handleSaveConflict(): void {
  fetchProjects()
    .then((data) => {
      mergeFromBackend(data);
      persist();
    })
    .catch((e) => logger.warn('projectStore', '保存冲突后重载项目失败', e?.message));
}

/** createDebouncedPersist（contentStore.js）返回的防抖持久化对象形状 */
interface DebouncedPersist {
  schedule(): void;
  flush(): void;
  cancel(): void;
}

const persistDebounced: DebouncedPersist = createDebouncedPersist(() => {
  contentSet(PROJECTS_KEY, projects);
  contentSet(LAST_OPENED_KEY, currentProjectId);
  // 【失败可见】后端保存失败不再空 catch 静默——否则后端缺项会在下次 initProjects 合并前
  // 被误判为「项目不存在」，掩盖「双页面/网络导致后端与本地不同步」的真实原因。
  // 记录 warn 让后端缺失可观测；本地 localStorage 仍已写入，后端下次 persist 会再同步。
  saveProjects(
    projects.map((p) => ({ id: p.id, name: p.name })),
    currentProjectId,
    projectVersion,
  )
    .then((r) => {
      if (r?.data?.conflict) {
        logger.warn('projectStore', '保存项目版本冲突（另一窗口已更新）→ 重新合并', {
          localVersion: projectVersion,
          remoteVersion: r.data.version,
        });
        handleSaveConflict();
      } else if (typeof r?.data?.version === 'number') {
        projectVersion = r.data.version;
      }
    })
    .catch((e) =>
      logger.warn('projectStore', '保存项目到后端失败（本地已保留，下次将重试）', {
        count: projects.length,
        currentId: currentProjectId,
        error: e?.message,
      }),
    );
}, 300);

function persist(): void {
  persistDebounced.schedule();
}

/** 强制立即落盘（页面卸载兜底 / 测试用） */
export function flushPersist(): void {
  persistDebounced.flush();
}

/**
 * 【测试专用】重置模块级内存状态到初始态（仅保留 default 项目）。
 *
 * 为什么需要（2026-09-02 修复 projectStore.test.ts 全量并发偶发红）：
 * 测试此前用「vi.resetModules() + 每例动态 import」隔离模块级单例，但 `deleteProject` 等用例
 * 偶发读到残留的 `projects=[p1,p2,default]` 且 `loaded=false`——证明动态 import 拿到的实例与
 * 源码 `deleteProject` 闭包捕获的实例在 vitest 并发/fork 下可能分裂，静态隔离不可靠。
 * 这里提供一个显式 reset 出口，让测试直接重置内存状态（等同重新 import 一份干净模块，但
 * 无实例分裂风险），也符合 `flushPersist` 已有的「测试出口」先例。
 *
 * 说明：不清 `localStorage`——那是存储层的事，由测试按需 clear；这里只把模块内存态归零，
 * 保证后续 `loadProjects()` 重新从存储读最新值。`lastSnapshot` 需同步重建，避免
 * `useSyncExternalStore` 持有 stale 快照。
 */
export function __resetForTest(): void {
  projects = loadProjects();
  currentProjectId = loadLastOpened();
  loaded = false;
  lastSavedVersion = 0;
  projectVersion = 0;
  listeners.clear();
  lastSnapshot = { projects, currentProjectId };
}

// 启动时从后端加载项目，与本地合并去重（防「后端缺项/双页面旧数据」覆盖掉本地独有项目）。
// 【根因修复】旧实现「以后端为准整体覆盖本地」+ saveProjects 全量覆盖语义：若后端某次缺项
// （saveProjects 失败静默 / 双页面旧列表覆盖后端），刷新时后端缺项会把本地独有新项目冲掉，
// 且 persist() 把缺失固化为持久态 → 项目永久消失。改为「合并去重」：
//   1) 以后端列表为基准；
//   2) 补充「本地有而后端缺」的项目（后端缺失不丢本地独有）；
//   3) 合并结果写回后端（把缺失补回，防下次再丢）。
// 反向（后端有本地没有）也保留——后端为准。合并后 lastOpened 逻辑不变。
export function initProjects(): void {
  if (loaded) return;
  loaded = true;
  fetchProjects()
    .then((data) => {
      mergeFromBackend(data);
      // 对齐官方 Vr.jsx L1104-1108：合并后落盘，让 localStorage 与后端 lastOpened 同步，
      // 避免「刷新后短暂闪 default 再跳到正确项目」；同时把「本地独有而后端缺失」的项目
      // 回写后端，从根源消除「后端缺项 → 下次刷新再次覆盖丢项目」。
      persist();
    })
    .catch((e) => logger.warn('projectStore', '加载项目失败（localTool 未连？）', e?.message));
}

// 缓存快照对象，保证 useSyncExternalStore 的 getSnapshot 返回稳定引用（避免无限重渲染）
let lastSnapshot: ProjectSnapshot = { projects, currentProjectId };

/** 项目 store 对外快照（useProjects/useCurrentProjectId 的读取面） */
export interface ProjectSnapshot {
  projects: Project[];
  currentProjectId: string;
}

function updateSnapshot(): void {
  lastSnapshot = { projects, currentProjectId };
}

function notify(): void {
  updateSnapshot();
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): ProjectSnapshot {
  return lastSnapshot;
}

// 项目 id 复刻官方 Vr.jsx L2303 `proj-${Date.now()}`
function genId(): string {
  return `proj-${Date.now()}`;
}

// 读写当前项目画布快照（走 KV，异步）。key 为 canvas-state-v1- 前缀 → 自动分流到 localTool KV。
export async function loadCanvasState(projectId: string): Promise<CanvasSnapshot | null> {
  try {
    const v = await contentGetAsync(CANVAS_STATE_PREFIX + (projectId || currentProjectId));
    if (!v || typeof v !== 'object') return null;
    // P0-4 兼容读取：旧快照无 schemaVersion（视为版本 1 + 缺字段），统一返回 { nodes, edges, schemaVersion }。
    // 缺省字段由 App 加载侧的 applyNodeTypeDefaults 补齐，读取端不在此改结构，保持最小差异。
    // P20 viewport：旧快照可能无 viewport（未存视窗），读取端归一为 null（App 侧回退 fitView 适配全图）。
    const vp = (v as CanvasSnapshot).viewport;
    const result: CanvasSnapshot = {
      ...(v as CanvasSnapshot),
      nodes: Array.isArray((v as CanvasSnapshot).nodes) ? (v as CanvasSnapshot).nodes : null,
      edges: Array.isArray((v as CanvasSnapshot).edges) ? (v as CanvasSnapshot).edges : [],
      schemaVersion:
        typeof (v as CanvasSnapshot).schemaVersion === 'number'
          ? (v as CanvasSnapshot).schemaVersion
          : 1,
      viewport:
        vp && typeof vp === 'object'
          ? { x: Number(vp.x) || 0, y: Number(vp.y) || 0, zoom: Number(vp.zoom) || 1 }
          : null,
    };
    // 【P0 埋点】快照加载成功（排查「刷新后画布空/丢节点」：记录读到的节点/边数，区分「没存」vs「读了但空」）
    logger.debug(
      '项目',
      '[加载快照]',
      {
        projectId: projectId || currentProjectId,
        nodeCount: result.nodes?.length ?? 0,
        edgeCount: result.edges?.length ?? 0,
        schemaVersion: result.schemaVersion,
      },
      { module: 'project' },
    );
    return result;
  } catch (e) {
    logger.warn('projectStore', '读取画布快照失败（KV 不可用？）', e?.message);
    return null;
  }
}

// 【④ 不存不该存的】画布快照落盘前清理 ReactFlow 运行时 UI 态。
// ReactFlow 的 nodes 在交互时会带 selected / dragging / measured / handles 等运行时字段，
// 这些是「会话态」不是「数据」，不该进 KV 快照（否则污染存储、加大体积）。
// 白名单：只保留恢复画布必需的字段。
// ⚠️ 必须保留 parentId 与 extent：编组后子节点以「相对父节点的坐标」存储，且带 parentId + extent:'parent'。
// 旧白名单漏掉这俩，落盘后子节点丢失父子关系、却仍带着相对坐标被当作绝对坐标渲染，
// 刷新后所有编组子节点跑到原点附近（位置全乱）；同时 React Flow 失去 extent 钳制约束。
// ⚠️ 还要保留 style / initialWidth / initialHeight：group 节点的面积存在 style.width/height（渲染用）
// 与 initialWidth/Height（React Flow getNodeDimensions fallback 用）。旧白名单漏掉它们，
// 刷新后 group 矩形面积塌成 0×0（视觉缩成点），且框选命中判定因尺寸缺失而错乱。
// edges 同理只保留 source/target/type/data 等必要字段。
const NODE_KEEP: string[] = [
  'id',
  'type',
  'position',
  'data',
  'width',
  'height',
  'parentId',
  'extent',
  'style',
  'initialWidth',
  'initialHeight',
];
const EDGE_KEEP: string[] = [
  'id',
  'source',
  'target',
  'sourceHandle',
  'targetHandle',
  'type',
  'data',
  'label',
];
function sanitizeNodes(nodes: Record<string, unknown>[] | null): Record<string, unknown>[] | null {
  if (!Array.isArray(nodes)) return nodes;
  return nodes.map((n) => {
    const out: Record<string, unknown> = {};
    for (const k of NODE_KEEP) {
      if (n[k] !== undefined && n[k] !== null) out[k] = n[k];
    }
    return out;
  });
}
function sanitizeEdges(edges: Record<string, unknown>[] | null): Record<string, unknown>[] | null {
  if (!Array.isArray(edges)) return edges;
  return edges.map((e) => {
    const out: Record<string, unknown> = {};
    for (const k of EDGE_KEEP) {
      if (e[k] !== undefined && e[k] !== null) out[k] = e[k];
    }
    return out;
  });
}
export async function saveCanvasState(
  projectId: string,
  nodes: Record<string, unknown>[] | null,
  edges: Record<string, unknown>[] | null,
  viewport?: { x?: number; y?: number; zoom?: number } | null,
): Promise<SaveCanvasResult> {
  const key = CANVAS_STATE_PREFIX + (projectId || currentProjectId);
  try {
    // 对齐官方 shared.js L1405：空画布跳过保存，防止空画布覆盖已有历史（误清空保护）。
    if (!nodes || nodes.length === 0) {
      // 【P0 埋点】空画布跳过保存（排查「画布被清空/不保存」：确认是主动跳过而非丢失）
      logger.debug(
        '项目',
        '[保存快照] 空画布跳过',
        { projectId: projectId || currentProjectId },
        { module: 'project' },
      );
      return { success: false, skipped: true };
    }
    // 对齐官方 shared.js L1416：版本冲突检测。每次保存用 Date.now() 作为版本号写入 <key>_version，
    // 若远程已有更高版本（另一窗口/设备先写了更新的画布），拒绝本次覆盖，防旧数据冲掉新数据。
    // 单调递增保底：同毫秒内连续保存时 Date.now() 不变，需保证严格递增（否则 v2 不 > v1）。
    const now = Date.now();
    const version = now > lastSavedVersion ? now : lastSavedVersion + 1;
    lastSavedVersion = version;
    const remoteRaw = await contentGetAsync(`${key}_version`);
    const remoteVer = remoteRaw ? parseInt(String(remoteRaw), 10) : 0;
    if (remoteVer > version) {
      logger.warn('projectStore', '画布版本冲突，拒绝覆盖', { key, remoteVer, version });
      return { success: false, skipped: true, conflictVersion: remoteVer };
    }
    // 【④】落盘前清理 ReactFlow 运行时 UI 态（selected/dragging/measured 等），只存必要字段
    // P20 viewport：视窗状态 { x, y, zoom }，仅当传入合法数值才存（否则留 undefined 不进 KV）。
    let savedViewport: { x: number; y: number; zoom: number } | undefined;
    if (viewport && typeof viewport === 'object' && Number.isFinite(viewport.zoom)) {
      savedViewport = {
        x: Number(viewport.x) || 0,
        y: Number(viewport.y) || 0,
        zoom: Number(viewport.zoom) || 1,
      };
    }
    const sanitizedNodes = sanitizeNodes(nodes);
    const sanitizedEdges = sanitizeEdges(edges);
    await contentSetAsync(key, {
      schemaVersion: CANVAS_SCHEMA_VERSION,
      nodes: sanitizedNodes,
      edges: sanitizedEdges,
      ...(savedViewport ? { viewport: savedViewport } : {}),
    });
    await contentSetAsync(`${key}_version`, version);
    // 【P0 埋点】快照保存成功（排查「刷新丢节点/丢字段」：记录保存前后节点数，区分「没存」vs「sanitize 裁剪」）
    logger.debug(
      '项目',
      '[保存快照]',
      {
        projectId: projectId || currentProjectId,
        version,
        nodeCount: nodes.length,
        savedNodeCount: sanitizedNodes.length,
        edgeCount: edges.length,
        savedEdgeCount: sanitizedEdges.length,
      },
      { module: 'project' },
    );
    return { success: true, skipped: false };
  } catch (e) {
    logger.warn('projectStore', '保存画布快照失败（KV 不可用？）', e?.message);
    return { success: false, skipped: false };
  }
}

// 当前项目信息
export function getCurrentProject(): Project {
  return (
    projects.find((p) => p.id === currentProjectId) ||
    projects[0] || { id: 'default', name: '默认项目' }
  );
}

// 新建项目：返回新项目；创建后切到该项目（不自动清空画布，由调用方决定）
export function createProject(name?: string): Project {
  const proj: Project = { id: genId(), name: (name && name.trim()) || '未命名项目' };
  projects = [...projects, proj];
  currentProjectId = proj.id;
  persist();
  notify();
  // 【P0 埋点】新建项目（排查项目丢失/切错项目：记录新建动作与总项目数）
  logger.debug(
    '项目',
    '[新建]',
    { id: proj.id, name: proj.name, total: projects.length },
    { module: 'project' },
  );
  return proj;
}

// 切换项目：返回目标项目
export function switchProject(id: string): Project {
  if (!projects.some((p) => p.id === id)) {
    logger.debug(
      '项目',
      '[切到] 目标不存在',
      { id, available: projects.map((p) => p.id) },
      { module: 'project' },
    );
    return getCurrentProject();
  }
  const from = currentProjectId;
  currentProjectId = id;
  persist();
  notify();
  // 【P0 埋点】切换项目（排查「刷新后项目错位/切错」：记录 from→to）
  logger.debug('项目', '[切到]', { from, to: id }, { module: 'project' });
  return getCurrentProject();
}

// 删除项目：至少保留一个；删除时移除画布快照（KV），切到第一个
export function deleteProject(id: string): boolean {
  if (projects.length <= 1) {
    logger.debug(
      '项目',
      '[删除] 被拒（至少保留一个）',
      { id, total: projects.length },
      { module: 'project' },
    );
    return false;
  }
  const before = projects.length;
  projects = projects.filter((p) => p.id !== id);
  // 异步删除画布快照（KV）及对应 _version 版本 key
  contentDeleteAsync(CANVAS_STATE_PREFIX + id).catch(() => {}); // fire-and-forget，KV 删除失败不影响主流程
  contentDeleteAsync(CANVAS_STATE_PREFIX + id + '_version').catch(() => {}); // fire-and-forget
  if (currentProjectId === id) currentProjectId = projects[0].id;
  persist();
  notify();
  // 【P0 埋点】删除项目（排查「项目莫名消失」：确认删除动作发生）
  logger.debug('项目', '[删除]', { id, before, after: projects.length }, { module: 'project' });
  return true;
}

// 重命名项目
export function renameProject(id: string, name?: string): void {
  const prev = getCurrentProject().id === id ? getCurrentProject().name : undefined;
  projects = projects.map((p) =>
    p.id === id ? { ...p, name: (name && name.trim()) || p.name } : p,
  );
  persist();
  notify();
  // 【P0 埋点】重命名项目
  logger.debug(
    '项目',
    '[重命名]',
    { id, name: (name && name.trim()) || prev },
    { module: 'project' },
  );
}

export function useProjects(): ProjectSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** 原子订阅：只订阅当前项目 id（P5）。App 等大组件只用 currentProjectId 时，
 *  避免 projects 列表变更（新建/重命名）连坐整组件重渲染。 */
export function useCurrentProjectId(): string {
  return useStoreSelector(subscribe, getSnapshot, (s) => s.currentProjectId);
}
