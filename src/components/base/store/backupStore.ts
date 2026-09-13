/**
 * ════════════════════════════════════════════════════════════════
 * 完整导入/导出备份层（对齐官方 yimao 工作流备份）
 * ════════════════════════════════════════════════════════════════
 *
 * 【解决什么】官方有"导出所有内容/导入所有内容(JSON)"——把全局配置、项目、画布快照
 * 完整打包下载/恢复。我们此前分散在各 store，无统一备份清单。
 * 本模块提供「备份清单 + exportAll/importAll」，作为导入导出的地基。
 *
 * 【备份内容】见 LS_KEYS（localStorage 配置）+ KV 画布快照（canvas-state-v1-*，遍历 projects）
 * + KV 账号环境（accounts，走 localTool KV）。
 * ⚠️ 含用户数据（对话历史/账号环境/API key 等），导出文件需妥善保管（对齐官方语义）。
 *
 * 【导入后】各 store 的内存缓存不会自动更新（localStorage 直写），故 importAll 后
 * 调用方必须 window.location.reload() 刷新应用（对齐官方）。
 *
 * 【格式】
 * {
 *   version: 2,
 *   type: 'yimao-backup',
 *   exportedAt: ISO,
 *   ls: { [localStorageKey]: value },          // 所有备份清单里的 localStorage 键
 *   canvas: { [projectId]: { nodes, edges } }   // 各项目画布快照
 *   accounts: [...]                             // 账号环境（KV 后端，非空才含）
 * }
 */
import { getLocalKeys } from '../core/contracts.ts';
// 【TD-15-1】agentKey 前缀 / 会话键构造收口到 base/core 单一真源（禁本地再拼字面量）
import {
  agentKeyForProject,
  agentConversationsKey,
  agentActiveConversationKey,
} from '../core/agentKeys.ts';
import { contentGet, contentSet, contentGetAsync, contentSetAsync } from '../core/contentStore.ts';
import {
  getCurrentProject,
  getAllProjects,
  loadCanvasState,
  saveCanvasState,
} from './projectStore.ts';
import { logger } from '../core/logger.ts';

/** localStorage 备份清单 —— 由 contracts.ts STORAGE_KEYS 权威登记生成（getLocalKeys()）。
 *  新增存储键先在 contracts.ts 登记即自动进备份，禁止再手写清单（防漂移漏备份）。 */
const LS_KEYS = getLocalKeys();

/** 备份格式版本：写出与导入守卫**共用**（禁两处写死，TD-15-3）。 */
const BACKUP_VERSION = 2;

/**
 * AI 会话键（conversationStore 按 agentKey=项目隔离）：每项目一套会话存储。
 * 键形如 agent_conversations_canvas-assistant-<projectId>；构造单源在 `core/agentKeys`（TD-15-1）。
 * @param {Array} projects 项目列表（{id}）
 * @returns {string[]} 所有项目的会话键
 */
function conversationKeys(projects: unknown): string[] {
  const keys = [];
  const list = Array.isArray(projects) ? projects : [];
  const ids = new Set(list.map((p) => p && p.id).filter(Boolean));
  ids.add(getCurrentProjectId());
  for (const id of ids) {
    const agentKey = agentKeyForProject(String(id));
    keys.push(agentConversationsKey(agentKey));
    keys.push(agentActiveConversationKey(agentKey));
  }
  return keys;
}

/** 读 contentStore 某键（容错） */
function readLS(k: string) {
  try {
    const v = contentGet(k);
    return v !== undefined ? v : undefined;
  } catch {
    return undefined;
  }
}

/** 写 contentStore 某键（容错）；返回是否成功（供 importAll 汇总失败，TD-15-3 禁假成功）。 */
function writeLS(k: string, v: unknown): boolean {
  try {
    contentSet(k, v);
    return true;
  } catch {
    // catch-ok: 单键写入失败不阻断其余导入；失败由 importAll 计入 failed 清单（不静默吞）
    return false;
  }
}

/**
 * 异步读 contentStore 某键（容错）——会话键已迁 KV，同步 contentGet 对 KV 键缓存未命中返回 undefined
 * （会漏备份非活动项目的会话），故读会话键必须走异步 contentGetAsync（见 AI助手会话存储迁移-KV收口事实记录.md）。
 */
async function readLSAsync(k: string) {
  try {
    return await contentGetAsync(k);
  } catch {
    return undefined;
  }
}

/**
 * 当前项目 id —— **委托 `projectStore.getCurrentProject()` 内存真相**（TD-02-4）。
 * 原先本地从存储重推导（读 projects + lastOpenedProject）是同一语义的**第二实现**，
 * 且会落后 projectStore 的内存态（写盘有 300ms 防抖）→ 导出可能把「刚切换的项目」漏掉。
 * getCurrentProject 自带 `{id:'default'}` 兜底，故无项目时行为不变。
 */
function getCurrentProjectId(): string {
  return getCurrentProject().id;
}

/**
 * 导出全部备份 → 打包对象（不触发下载）。
 * @returns {Promise<object>} 备份对象（含 ls + canvas）
 */
export async function exportAll() {
  const ls: Record<string, unknown> = {};
  for (const k of LS_KEYS) {
    const v = readLS(k);
    if (v !== undefined) ls[k] = v;
  }
  // 【TD-15-2】项目集合以 projectStore **内存真相**为准（并集存储副本兜底）：
  // 存储副本落盘有 300ms 防抖滞后 → 只读它会漏备窗口内新建的项目。内存项优先（改名/新建即时生效）。
  const storedProjects = Array.isArray(ls.projects) ? (ls.projects as { id?: unknown }[]) : [];
  const byId = new Map<string, { id?: unknown }>();
  for (const p of [...getAllProjects(), ...storedProjects]) {
    const id = p && typeof p === 'object' ? (p as { id?: unknown }).id : undefined;
    if (typeof id === 'string' && id && !byId.has(id)) byId.set(id, p as { id?: unknown });
  }
  const projectList = [...byId.values()];
  if (projectList.length) ls.projects = projectList; // 备份包内项目列表与枚举同源，保证导入自洽
  // AI 会话（按项目隔离）：动态收集所有项目的会话键（键为 KV 后端 → 异步读，见 readLSAsync）
  for (const k of conversationKeys(projectList)) {
    const v = await readLSAsync(k);
    if (v !== undefined && v !== null) ls[k] = v;
  }
  // 画布快照：遍历所有项目逐个读 KV
  const canvas: Record<string, unknown> = {};
  const ids = new Set(projectList.map((p) => String(p.id)));
  ids.add(getCurrentProjectId());
  for (const id of ids) {
    try {
      const state = await loadCanvasState(id);
      if (state && (state.nodes || state.edges))
        canvas[id] = { nodes: state.nodes || [], edges: state.edges || [] };
    } catch {
      // 【P0 埋点】单个项目快照读失败（排查「导出缺某个项目画布」：标记具体项目）
      logger.warn('backupStore', '导出时读取项目画布失败', { projectId: id });
    }
  }
  // 账号环境：走 KV 后端（backend:'kv'，不在 LS_KEYS），单独收集；非空才入包（防写空覆盖）
  let accounts;
  try {
    const acc = await contentGetAsync('yimao_accounts');
    if (Array.isArray(acc) && acc.length) accounts = acc;
  } catch {
    // 【P0 埋点】账号读取失败（排查「导出缺账号」：仍导出其余数据，不阻塞整体备份）
    logger.warn('backupStore', '导出时读取账号失败');
  }
  logger.debug(
    '备份',
    '[导出]',
    {
      lsKeys: Object.keys(ls).length,
      canvasProjects: Object.keys(canvas).length,
      hasAccounts: !!accounts && accounts.length > 0,
      projectIds: [...ids],
    },
    { module: 'project' },
  );
  return {
    version: BACKUP_VERSION,
    type: 'yimao-backup',
    exportedAt: new Date().toISOString(),
    ls,
    canvas,
    ...(accounts ? { accounts } : {}),
  };
}

/**
 * 导入备份：把备份对象写回 localStorage + KV 画布快照。
 * ⚠️ 调用方需在成功后 window.location.reload() 刷新应用。
 * @param {object} backup 备份对象（exportAll 的返回）
 * @returns {{ ok:boolean, ls:number, canvas:number, failed:{projectId,error}[], error?:string }}
 *   【TD-15-3 诚实失败】任一项写失败 → `ok=false` 且 `failed` 列明；**不再恒返 ok:true**（禁假成功）。
 */
export async function importAll(backup: unknown): Promise<{
  ok: boolean;
  ls: number;
  canvas: number;
  failed: { projectId: string; error: string }[];
  error?: string;
}> {
  if (!backup || typeof backup !== 'object' || Array.isArray(backup))
    return { ok: false, ls: 0, canvas: 0, failed: [], error: '备份数据无效' };
  const b = backup as {
    type?: unknown;
    version?: unknown;
    ls?: Record<string, unknown>;
    canvas?: Record<
      string,
      { nodes?: Record<string, unknown>[]; edges?: Record<string, unknown>[] }
    >;
    accounts?: unknown;
  };
  // 【TD-15-3】格式/版本守卫（**宽松向后兼容**）：显式不符才拒；缺 type/version 视为旧包放行
  //（历史包与最小测试夹具可能不带这两字段，不能因"没写版本"就拒绝合法数据）。
  if (b.type !== undefined && b.type !== 'yimao-backup')
    return { ok: false, ls: 0, canvas: 0, failed: [], error: '不是 yimao 备份文件（type 不符）' };
  if (typeof b.version === 'number' && b.version > BACKUP_VERSION)
    return {
      ok: false,
      ls: 0,
      canvas: 0,
      failed: [],
      error: `备份版本 ${b.version} 高于当前支持的 ${BACKUP_VERSION}，请升级应用后再导入`,
    };

  let lsCount = 0;
  let canvasCount = 0;
  // 【TD-15-3】失败明细：任一写失败 → 不再伪装成导入成功（禁假成功）。
  const failed: { projectId: string; error: string }[] = [];
  // 配置键：逐个写回（writeLS 返回 false 计入失败，不静默）
  if (b.ls && typeof b.ls === 'object') {
    for (const k of Object.keys(b.ls)) {
      if (writeLS(k, b.ls[k])) lsCount++;
      else failed.push({ projectId: k, error: '写入配置失败' });
    }
  }
  // 画布快照：逐个写回 KV
  if (b.canvas && typeof b.canvas === 'object') {
    for (const projectId of Object.keys(b.canvas)) {
      const c = b.canvas[projectId];
      try {
        // ★ force: true —— 备份导入本来就该整包覆盖（不受 CAS 基线约束；服务端仍会把版本自增）。
        const res = await saveCanvasState(projectId, c?.nodes || [], c?.edges || [], undefined, {
          force: true,
        });
        if (!res?.skipped) canvasCount++;
      } catch (e) {
        // 【P0 埋点 + TD-15-3】单个快照写失败：日志留痕 + 计入 failed（不再静默吞成"成功"）
        const msg = e instanceof Error ? e.message : String(e);
        logger.warn('backupStore', '导入时写回项目画布失败', { projectId, error: msg });
        failed.push({ projectId, error: msg });
      }
    }
  }
  // 账号环境（走 KV 后端）：备份包内的 accounts 写回 KV；非空数组才写（防写空覆盖丢历史）
  if (Array.isArray(b.accounts)) {
    try {
      await contentSetAsync('yimao_accounts', b.accounts);
      lsCount++;
    } catch (e) {
      // 【P0 埋点 + TD-15-3】账号写回失败：计入 failed
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn('backupStore', '导入时写回账号失败', { error: msg });
      failed.push({ projectId: 'yimao_accounts', error: msg });
    }
  }
  const ok = failed.length === 0;
  const error = ok
    ? undefined
    : `${failed.length} 项导入失败（${failed
        .slice(0, 3)
        .map((f) => f.projectId)
        .join('、')}${failed.length > 3 ? ' 等' : ''}）`;
  logger.debug(
    '备份',
    '[导入]',
    { ls: lsCount, canvas: canvasCount, failed: failed.length },
    { module: 'project' },
  );
  return { ok, ls: lsCount, canvas: canvasCount, failed, ...(error ? { error } : {}) };
}

/** 把备份对象转成可下载的 Blob */
export function backupToBlob(backup: unknown): Blob {
  return new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
}
