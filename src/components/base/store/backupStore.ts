/**
 * ════════════════════════════════════════════════════════════════
 * 完整导入/导出备份层（对齐官方 yimao 工作流备份）
 * ════════════════════════════════════════════════════════════════
 *
 * 【解决什么】官方有"导出所有内容/导入所有内容(JSON)"——把全局配置、项目、画布快照
 * 完整打包下载/恢复。我们此前分散在各 store，无统一备份清单。
 * 本模块提供「备份清单 + exportAll/importAll」，作为导入导出的地基。
 *
 * 【备份内容 = 三段，全部**派生**（不手写清单）】
 *  ① `ls`     —— localStorage 键：`contracts.getLocalKeys()`（登记即进备份）；
 *  ② `canvas` —— 各项目画布快照（canvas-state-v1-*，走 projectStore 写路径，保 sanitize 不变量）；
 *  ③ `kv`     —— **其余 KV 工程数据**：键集合 =「后端实际存在的键」∩「`getKvKeyPatterns()` 模板」，
 *                于是**新工程域只要在 STORAGE_KEYS 登记就自动进备份**（0 行接入，无需改本文件）。
 *                【TD-02-30】此前只收 ①②，剪辑工程（video_editor_*）与 3D 工程（director3d-project*）
 *                虽已登记 backend:'kv' 却**不进备份** → 换机导入后片子与 3D 场景全丢。
 *  （`accounts` 段保留 —— KV 后端账号环境，非空才含；历史字段，不再往 kv 段重复收录。）
 * ⚠️ 含用户数据（对话历史/账号环境/API key 等），导出文件需妥善保管（对齐官方语义）。
 *
 * 【导入后】各 store 的内存缓存不会自动更新（localStorage 直写），故 importAll 后
 * 调用方必须 window.location.reload() 刷新应用（对齐官方）。
 *
 * 【格式 v3】
 * {
 *   version: 3,
 *   type: 'yimao-backup',
 *   exportedAt: ISO,
 *   ls: { [localStorageKey]: value },           // getLocalKeys() 清单里的键
 *   canvas: { [projectId]: { nodes, edges } },  // 各项目画布快照
 *   kv: { [kvKey]: value },                     // 其余 KV 工程数据（剪辑/3D/供应商/会话/…）
 *   accounts: [...]                             // 账号环境（KV 后端，非空才含）
 * }
 * v2 → v3：新增 `kv` 段；AI 会话键随之从 `ls` 段移入 `kv` 段（同一键不再进两个段）。
 */
import {
  getLocalKeys,
  getKvKeyPatterns,
  CANVAS_STATE_PREFIX,
  KEY_YIMAO_ACCOUNTS,
} from '../core/contracts.ts';
import { compilePatternRegex } from '../core/utils.ts';
import { kvKeys } from '../api/localToolApi.ts';
import { contentGet, contentSet, contentGetAsync, contentSetAsync } from '../core/contentStore.ts';
import { isWriteBackOk } from '../core/degrade.ts';
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

/** KV 段键模板 → 正则（模块级一次编译；与 contentStore 的登记校验同一编译原语）。 */
const KV_TEMPLATES = getKvKeyPatterns().map(compilePatternRegex);

/**
 * KV 段收录判据 —— **导出与导入共用一份**（两端各写一份必然漂移）。
 * 排除项只有两个，且都是"已由专属段承载"：画布（canvas 段走 saveCanvasState 写路径，
 * 保 sanitize/空画布跳过不变量）与账号环境（accounts 段）。
 * **新增工程域不需要改这里** —— 判据只按登记表派生。
 */
function isKvSegmentKey(k: string): boolean {
  return (
    KV_TEMPLATES.some((re) => re.test(k)) &&
    !k.startsWith(CANVAS_STATE_PREFIX) &&
    k !== KEY_YIMAO_ACCOUNTS
  );
}

/** 备份格式版本：写出与导入守卫**共用**（禁两处写死，TD-15-3）。 */
const BACKUP_VERSION = 3;

/** 读 contentStore 某键。失败语义归 contentStore（**真相源**，仅对契约违约抛错、须 fail-fast）；
 *  **消费者不得越权**把它吞成 undefined（2026-09-17 删 catch）。 */
function readLS(k: string) {
  return contentGet(k);
}

/** 写 contentStore 某键（`ls` 段 = `getLocalKeys()`，必为 local 后端）；返回是否**真落盘**。 */
function writeLS(k: string, v: unknown): boolean {
  // 【2026-09-17 TD-24-4 阶段0】原来是 `try { contentSet } catch { return false }` —— **假成功**：
  // 那段 catch 永死（contentSet 当时从不为持久化失败抛错，失败只 publish 全局总线）⇒ 恒 `return true`
  // ⇒ `importAll` 会把"根本没写进去的键"计入成功（正是 TD-15-3 要禁的假成功，反而由它自己制造）。
  // 现按生产者给的**落盘事实**判：只有确认落进持久层才算成功（判据经 isWriteBackOk 收口，不与同族各写一份）。
  const outcome = contentSet(k, v);
  if (isWriteBackOk(outcome, 'local')) return true;
  logger.warn('备份', '写回未落盘', {
    key: k,
    landed: outcome.ok ? outcome.landed : 'failed',
    message: outcome.ok ? undefined : outcome.message,
  });
  return false;
}

/**
 * KV 段写回（`accounts` 段与 `kv` 段**共用一份**判据与汇总口径，2026-09-17 TD-24-4 收尾）。
 *
 * 【为什么 landed:'local' 也算失败】备份导入的目的是把包里的数据**写回真源**。
 * `contentSetAsync` 对 KV 键在引擎不可用时返回 `landed:'local'`（降级写本机副本）—— 该副本
 * 跨端/换机看不到，引擎恢复后也不会自动回灌 ⇒ 对本操作而言就是**没恢复**。
 * 原实现只看"有没有抛" ⇒ 降级被计成成功、`ok = failed.length===0` 报「导入成功」，真源其实空着。
 * 判据统一走 `isWriteBackOk(outcome, 'kv')`（禁止此处再写一份）。
 *
 * 失败**不抛**（与同族 `writeLS` 口径一致）：计入 `failed[]` 后继续导完其余键，由汇总如实呈现。
 */
async function writeKvSegment(
  key: string,
  value: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const outcome = await contentSetAsync(key, value);
    if (isWriteBackOk(outcome, 'kv')) return { ok: true };
    const why = outcome.ok ? '未写入 KV（引擎不可用，仅落了本机降级副本）' : outcome.message;
    logger.warn('备份', 'KV 段写回未进真源', {
      key,
      landed: outcome.ok ? outcome.landed : 'failed',
      why,
    });
    return { ok: false, error: why };
  } catch (e) {
    // 4xx 拒收等：日志留痕 + 计入 failed（不中断整包导入）
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn('备份', 'KV 段写回失败', { key, error: msg });
    return { ok: false, error: msg };
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
  // AI 会话键（agent_conversations_{agentKey}）不在此单独收集 —— 它是 KV 后端键，
  // 由下方 kv 段按登记表模板**派生**收录（v2 时靠 conversationKeys() 手写枚举，v3 起删除该第二份枚举）。
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
    const acc = await contentGetAsync(KEY_YIMAO_ACCOUNTS);
    if (Array.isArray(acc) && acc.length) accounts = acc;
  } catch {
    // 【P0 埋点】账号读取失败（排查「导出缺账号」：仍导出其余数据，不阻塞整体备份）
    logger.warn('backupStore', '导出时读取账号失败');
  }
  // KV 工程数据（剪辑/3D/供应商/会话…）：**派生式**收集（TD-02-30）——
  // 键集合 =「后端实际存在的键」∩「登记表 kv 模板」，不给任何域手写收集逻辑。
  // ⚠️ `kvKeys()` 失败**一律上抛**（不降级成空数组）：拿不到键清单 = 包会静默缺数据，
  //    比"整包导出失败"更危险（用户会以为备份是完整的）。调用方已有 catch → toast + logger。
  const kv: Record<string, unknown> = {};
  const kvCandidates = (await kvKeys()).filter(isKvSegmentKey);
  const kvPairs = await Promise.all(
    kvCandidates.map(async (k) => {
      try {
        return [k, await contentGetAsync(k)] as const;
      } catch (e) {
        // 与 canvas 段同口径：单键失败留痕 + 跳过，不阻断整体备份（禁静默：必留 logger）
        logger.warn('backupStore', '导出时读取 KV 工程键失败', {
          key: k,
          error: (e as Error)?.message,
        });
        return [k, undefined] as const;
      }
    }),
  );
  for (const [k, v] of kvPairs) if (v !== undefined && v !== null) kv[k] = v;
  logger.debug(
    '备份',
    '[导出]',
    {
      lsKeys: Object.keys(ls).length,
      canvasProjects: Object.keys(canvas).length,
      kvKeys: Object.keys(kv).length,
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
    kv,
    ...(accounts ? { accounts } : {}),
  };
}

/**
 * 导入备份：把备份对象写回 localStorage + KV 画布快照 + KV 工程数据。
 * ⚠️ 调用方需在成功后 window.location.reload() 刷新应用。
 * @param {object} backup 备份对象（exportAll 的返回）
 * @returns {{ ok:boolean, ls:number, canvas:number, kv:number, failed:{projectId,error}[], error?:string }}
 *   【TD-15-3 诚实失败】任一项写失败 → `ok=false` 且 `failed` 列明；**不再恒返 ok:true**（禁假成功）。
 */
export async function importAll(backup: unknown): Promise<{
  ok: boolean;
  ls: number;
  canvas: number;
  kv: number;
  failed: { projectId: string; error: string }[];
  error?: string;
}> {
  if (!backup || typeof backup !== 'object' || Array.isArray(backup))
    return { ok: false, ls: 0, canvas: 0, kv: 0, failed: [], error: '备份数据无效' };
  const b = backup as {
    type?: unknown;
    version?: unknown;
    ls?: Record<string, unknown>;
    canvas?: Record<
      string,
      { nodes?: Record<string, unknown>[]; edges?: Record<string, unknown>[] }
    >;
    kv?: Record<string, unknown>;
    accounts?: unknown;
  };
  // 【TD-15-3】格式/版本守卫（**宽松向后兼容**）：显式不符才拒；缺 type/version 视为旧包放行
  //（历史包与最小测试夹具可能不带这两字段，不能因"没写版本"就拒绝合法数据）。
  if (b.type !== undefined && b.type !== 'yimao-backup')
    return {
      ok: false,
      ls: 0,
      canvas: 0,
      kv: 0,
      failed: [],
      error: '不是 yimao 备份文件（type 不符）',
    };
  if (typeof b.version === 'number' && b.version > BACKUP_VERSION)
    return {
      ok: false,
      ls: 0,
      canvas: 0,
      kv: 0,
      failed: [],
      error: `备份版本 ${b.version} 高于当前支持的 ${BACKUP_VERSION}，请升级应用后再导入`,
    };

  let lsCount = 0;
  let canvasCount = 0;
  let kvCount = 0;
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
        // 【成功判据必须取结果事实 · 2026-09-17 TD-16-27】原 `if (!res?.skipped) canvasCount++`：
        // `saveCanvasState` 返 `{success:false}` 而 `skipped` 为 false 时（**真失败**）被计成功，
        // 且不进 failed ⇒ 汇总 `ok = failed.length===0` 为真 ⇒ 报「导入成功」而工程其实没写回。
        // 「没被跳过」≠「写成功」——判据只能是 `res.success`。
        if (res?.success) canvasCount++;
        else failed.push({ projectId, error: '画布快照未写成功' });
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
    const r = await writeKvSegment(KEY_YIMAO_ACCOUNTS, b.accounts);
    if (r.ok) lsCount++;
    else failed.push({ projectId: KEY_YIMAO_ACCOUNTS, error: r.error });
  }
  // KV 工程数据（v3 段）：逐键写回。**判据与导出共用 isKvSegmentKey** ——
  // 包里若混入 canvas-/accounts 键（手改包/跨版本包），在此被同一判据挡掉，
  // 不会绕过 canvas 段的 sanitize 写路径，也不会与 accounts 段重复写。
  if (b.kv && typeof b.kv === 'object') {
    for (const k of Object.keys(b.kv)) {
      if (!isKvSegmentKey(k)) continue;
      const r = await writeKvSegment(k, b.kv[k]);
      if (r.ok) kvCount++;
      else failed.push({ projectId: k, error: r.error });
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
    { ls: lsCount, canvas: canvasCount, kv: kvCount, failed: failed.length },
    { module: 'project' },
  );
  return {
    ok,
    ls: lsCount,
    canvas: canvasCount,
    kv: kvCount,
    failed,
    ...(error ? { error } : {}),
  };
}

/** 把备份对象转成可下载的 Blob */
export function backupToBlob(backup: unknown): Blob {
  return new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
}
