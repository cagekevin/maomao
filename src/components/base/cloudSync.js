/**
 * 云端全量同步适配层（对接标准同步引擎 CloudSyncEngine）。
 *
 * 【设计意图】把「数据同步到云端」的载体隔离在这里，TopNav 只调 upload/download，
 * 不关心云端到底是什么。
 *  - 载体：CloudSyncEngine（Google Apps Script，见下方引擎代码）。
 *  - 之前是 localStorage 模拟假数据；现直接替换为真实云端收发（引擎代码原样保留）。
 *
 * 【同步内容】全量配置/用户数据同步（用户确认体积小，全部进云端）：
 *  - localStorage 用户数据/配置：由 contracts.js STORAGE_KEYS 权威登记生成
 *    （getLocalKeys() 减去下方 SYNC_EXCLUDE 不同步清单；项目、应用设置、自定义 Skill、预设、节点偏好、账号环境等）
 *  - API 配置（providers）：走 localTool /api/providers（独立于 localStorage）
 *
 * 【不同步】画布/会话性/本机临时数据：
 *  - 所有项目画布快照（canvas-state-v1-*）：画布内容属业务数据，仅留在本机 localTool，不同步。
 *  - AI 对话历史（agent_conversations）与当前对话 id（agent_active_conversation_id）：含隐私。
 *  - lastOpenedProject（上次打开哪个项目）：本机会话偏好。
 *  - yimao_asset_library（素材库）：存的是本地 URL 引用（http://127.0.0.1:18080/files/...），
 *    指向本机 localTool 磁盘文件，跨设备无意义，不同步。
 *  - agent_draft / mutiwindow-clipboard：临时数据（输入草稿 / 跨窗口剪贴板），不同步。
 *
 * ⚠️ 含用户数据（账号环境/API key 等），同步到云端需注意保密。
 */
import { getLocalKeys } from './contracts.js'
import { providerApi } from './settings/settingsApi.js'
import { fetchProjects, saveProjects } from './projectsApi.js'
import { contentGet, contentSet } from './contentStore.js'
import { logger } from './logger.js'

/* ======================================================================
 * 【标准同步引擎】原样保留，勿改动内部通讯逻辑。
 * 仅需在 config.gasUrl 填入你的 GAS 部署 URL。
 * ====================================================================== */
const CloudSyncEngine = {
config: {
gasUrl: "https://script.google.com/macros/s/AKfycbwI6PvC1v8Bv1E-0aKGx1PQ3AIH5SIUUKjTeDHtq5UxxF3qFFHj8DCr1QvflPDqFdI5/exec" // 请保持原样，我后续会自己填
},
isSyncing: false,

async callGateway(action, data = null) {
if (!this.config.gasUrl || this.config.gasUrl.includes("填入")) throw new Error("未配置有效的 GAS URL");
if (this.isSyncing) throw new Error("系统正在通信中，请勿频繁操作");

this.isSyncing = true;
try {
const res = await fetch(this.config.gasUrl, {
method: 'POST',
redirect: 'follow',
headers: { 'Content-Type': 'text/plain;charset=utf-8' },
body: JSON.stringify({ action: action, data: data })
});

const text = await res.text();
if (text.includes("<html")) {
throw new Error("权限拦截，请确保 GAS 设为了【所有人】访问");
}

const jsonRes = JSON.parse(text);
if (jsonRes.error) throw new Error(jsonRes.error);
return jsonRes;
} catch (err) {
throw new Error(err.message);
} finally {
this.isSyncing = false;
}
},

async push(dataObj, onProgress, onSuccess, onError) {
if(onProgress) onProgress("正在同步至云端...");
try {
const res = await this.callGateway("push_data", dataObj);
if(onSuccess) onSuccess(res.msg || "同步成功");
return true;
} catch(e) {
if(onError) onError(e.message);
return false;
}
},

async pull(onProgress, onSuccess, onError) {
if(onProgress) onProgress("正在从云端读取数据...");
try {
const res = await this.callGateway("pull_data");
if(onSuccess) onSuccess("拉取成功");
return res.data;
} catch(e) {
if(onError) onError(e.message);
return null;
}
}
};
/* ===================== 引擎代码结束（勿改动以上内容） ===================== */

/** 读取本地某个 key（容错，contentGet 已内置 JSON 解析） */
function readLS(k) {
  try {
    const v = contentGet(k)
    if (v === null || v === undefined) return undefined
    return v
  } catch { return undefined }
}
/** 写本地某个 key（容错，contentSet 已内置 JSON 序列化） */
function writeLS(k, v) {
  try { contentSet(k, v) } catch { /* ignore */ }
}

/** 当前项目 id（从项目列表取当前，优先 lastOpenedProject） */
function getCurrentProjectId() {
  try {
    const projects = readLS('projects')
    if (Array.isArray(projects) && projects.length) {
      const last = readLS('lastOpenedProject')
      if (last && projects.some((p) => p.id === last)) return last
      return projects[0].id
    }
  } catch { /* ignore */ }
  return 'default'
}

/**
 * 收集本地全部要同步的数据 → 生成云端 JSON。
 * @returns {Promise<object|null>}
 *  { type:'cloud_config', version:4, updatedAt, data:{ [lsKey]: value, providers } }
 */
async function collectLocal() {
  const ls = {}
  // 1) localStorage 全量用户数据/配置：复用 backupStore 权威清单
  for (const k of LS_KEYS) {
    const v = readLS(k)
    if (v !== undefined) ls[k] = v
  }
  // 2) API 配置：从 localTool /api/providers 读（key 已脱敏，同步配置结构）
  try {
    const { providers } = await providerApi.getProviders()
    if (Array.isArray(providers) && providers.length) ls.providers = providers
  } catch { /* localTool 未连则跳过 API 配置 */ }

  if (Object.keys(ls).length === 0) return null
  return {
    type: 'cloud_config',
    version: 4,
    updatedAt: Date.now(),
    data: ls,
  }
}

/**
 * 把云端 JSON 覆盖写回本地。@returns {Promise<number>} 恢复的条目数
 */
async function restoreLocal(cloud) {
  const ls = cloud?.data
  if (!ls || typeof ls !== 'object') return 0
  let written = 0
  // 1) localStorage 全量覆盖（只写我们备份清单里的键，避免误写未知键）
  for (const k of LS_KEYS) {
    if (ls[k] !== undefined) {
      try { writeLS(k, ls[k]); written++ } catch { /* ignore */ }
    }
  }
  // 2) API 配置：全量保存到 localTool
  if (Array.isArray(ls.providers)) {
    try {
      await providerApi.saveProviders(ls.providers)
      providerApi.syncConfigBase(ls.providers).catch((e) => logger.warn('sync', 'config-sync-fail', { error: e?.message }))
      written++
    } catch { /* ignore */ }
  }
  // 3) 项目列表同步到 localTool（后端权威源，localStorage 兜底由项目 store 刷新时读）
  if (Array.isArray(ls.projects)) {
    try {
      await saveProjects(ls.projects.map((p) => ({ id: p.id, name: p.name })), getCurrentProjectId())
      written++
    } catch { /* ignore */ }
  }
  return written
}

/**
 * 上传云端：收集本地全量配置/用户数据 → 通过 CloudSyncEngine.push 同步到云端。
 * @param {Function} [onProgress] 进度回调（showToast 用）
 * @returns {Promise<{ ok:boolean, count:number, error?:string }>}
 */
export async function uploadConfig(onProgress) {
  const cloud = await collectLocal()
  if (!cloud) return { ok: false, count: 0, error: '本地没有可同步的数据' }
  try {
    const ok = await CloudSyncEngine.push(
      cloud,
      onProgress,
      () => {},
      (msg) => { throw new Error(msg) }
    )
    if (!ok) return { ok: false, count: 0, error: '同步失败（引擎返回失败）' }
    const n = Object.keys(cloud.data || {}).length
    return { ok: true, count: n }
  } catch (e) {
    return { ok: false, count: 0, error: e?.message || '同步失败' }
  }
}

/**
 * 从云端拉取：CloudSyncEngine.pull → 解析 → 覆盖恢复本地配置/用户数据。
 * @param {Function} [onProgress] 进度回调（showToast 用）
 * @returns {Promise<{ ok:boolean, count:number, hasCloud:boolean, error?:string }>}
 */
export async function downloadConfig(onProgress) {
  let cloud
  try {
    cloud = await CloudSyncEngine.pull(
      onProgress,
      () => {},
      (msg) => { throw new Error(msg) }
    )
  } catch (e) {
    return { ok: false, count: 0, hasCloud: false, error: e?.message || '拉取失败' }
  }
  if (cloud == null) return { ok: false, count: 0, hasCloud: false, error: '云端没有数据' }
  try {
    const count = await restoreLocal(cloud)
    if (count === 0) return { ok: false, count: 0, hasCloud: true, error: '云端没有新的数据' }
    return { ok: true, count, hasCloud: true }
  } catch {
    return { ok: false, count: 0, hasCloud: true, error: '云端数据解析失败' }
  }
}

// 保留引擎导出（供需要直接调用引擎的调用方用），但日常同步请走 uploadConfig/downloadConfig。
export { CloudSyncEngine }

/* ── localStorage 同步清单：由 contracts.js STORAGE_KEYS 权威登记生成（getLocalKeys()），
 * 显式排除不适合跨设备同步的键（与文件头【不同步】原则一致）：
 *  - lastOpenedProject / agent_draft：本机/临时偏好（不同步）
 *  - yimao_asset_library：本地 URL 引用，跨设备无意义（不同步）
 *  - mutiwindow-clipboard：跨窗口临时剪贴板（不同步）
 *  AI 会话键（agent_conversations_*）含隐私，本就为 pattern 键不在 getLocalKeys() 内。 */
const SYNC_EXCLUDE = new Set(['lastOpenedProject', 'yimao_asset_library', 'agent_draft', 'mutiwindow-clipboard'])
const LS_KEYS = getLocalKeys().filter((k) => !SYNC_EXCLUDE.has(k))
