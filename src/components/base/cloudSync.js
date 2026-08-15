/**
 * 云端配置同步适配层（原型模拟版）。
 *
 * 【设计意图】把「配置同步到云端」的载体隔离在这里，TopNav 只调 upload/download，
 * 不关心云端到底是什么。
 *  - 当前【模拟】：用 localStorage 存一份「云端备份」`yimao_cloud_backup`，模拟上传/下载成功。
 *  - 将来【接真实云端】：只需改本模块 uploadToCloud/downloadFromCloud 两个函数
 *    （对接 WebDAV / OSS / 官方 /sync/* 等），TopNav 和同步逻辑零改动。
 *
 * 【要同步什么】用户确认：API 配置（providers）+ 预设提示词（presetPrompts）+ 项目（projects）。
 * 其余（账号 users、会员、设置等）本机单用户，暂不同步。
 */
import { providerApi } from './settings/settingsApi.js'
import { loadPresets, savePresets } from './promptManager.js'
import { fetchProjects, saveProjects } from './projectsApi.js'
import { sGet, sSet } from './storageAdapter.js'

// 模拟云端备份的 localStorage key
const CLOUD_KEY = 'yimao_cloud_backup'

/** 读取本地某个 key（容错） */
function readLS(k) {
  try { return sGet(k) } catch { return null }
}
/** 写本地某个 key（容错） */
function writeLS(k, v) {
  try { sSet(k, v) } catch { /* ignore */ }
}

/**
 * 收集本地要同步的配置 → 生成云端 JSON。
 * @returns {Promise<object|null>} { type:'cloud_config', version:1, updatedAt, data:{providers,presetPrompts,projects} }
 */
async function collectLocal() {
  const data = {}
  // 1) API 配置：从 localTool /api/providers 读（key 已脱敏，只同步配置结构）
  try {
    const { providers } = await providerApi.getProviders()
    if (Array.isArray(providers) && providers.length) data.providers = providers
  } catch { /* localTool 未连则跳过 API 配置 */ }
  // 2) 预设提示词：localStorage
  try {
    const presets = loadPresets()
    if (Array.isArray(presets) && presets.length) data.presetPrompts = presets
  } catch { /* ignore */ }
  // 3) 项目：从 localTool /api/projects 读（跨端权威源）
  try {
    const { projects } = await fetchProjects()
    if (Array.isArray(projects) && projects.length) data.projects = projects
  } catch { /* localTool 未连则跳过项目 */ }

  if (Object.keys(data).length === 0) return null
  return {
    type: 'cloud_config',
    version: 1,
    updatedAt: Date.now(),
    data,
  }
}

/** 把云端 JSON 覆盖写回本地配置。@returns {Promise<number>} 恢复的项数 */
async function restoreLocal(cloud) {
  const data = cloud?.data
  if (!data || typeof data !== 'object') return 0
  let written = 0
  // API 配置：全量保存到 localTool
  if (Array.isArray(data.providers)) {
    try {
      await providerApi.saveProviders(data.providers)
      // 回写 api.config.json 消除双源漂移（对齐 providerStore.save 的做法）
      providerApi.syncConfigBase(data.providers).catch(() => {})
      written++
    } catch { /* ignore */ }
  }
  // 预设提示词：覆盖 localStorage
  if (Array.isArray(data.presetPrompts)) {
    try { savePresets(data.presetPrompts); written++ } catch { /* ignore */ }
  }
  // 项目：全量保存到 localTool（后端权威源）+ localStorage 兜底由项目 store 刷新时读
  if (Array.isArray(data.projects)) {
    try {
      await saveProjects(data.projects, data.projects[0]?.id || '')
      written++
    } catch { /* ignore */ }
  }
  return written
}

/**
 * 上传云端：收集本地配置 → 同步到云端（当前模拟存 localStorage）。
 * @returns {{ ok:boolean, count:number, error?:string }}
 */
export async function uploadConfig() {
  const cloud = await collectLocal()
  if (!cloud) return { ok: false, count: 0, error: '本地没有可同步的配置数据' }
  try {
    writeLS(CLOUD_KEY, JSON.stringify(cloud))
    const n = Object.keys(cloud.data).length
    return { ok: true, count: n }
  } catch (e) {
    return { ok: false, count: 0, error: e?.message || '同步失败' }
  }
}

/**
 * 从云端下载：拉取云端 JSON → 覆盖恢复本地配置（当前模拟读 localStorage）。
 * @returns {{ ok:boolean, count:number, hasCloud:boolean, error?:string }}
 */
export async function downloadConfig() {
  const raw = readLS(CLOUD_KEY)
  if (!raw) return { ok: false, count: 0, hasCloud: false, error: '云端没有配置数据' }
  try {
    const cloud = JSON.parse(raw)
    const count = await restoreLocal(cloud)
    if (count === 0) return { ok: false, count: 0, hasCloud: true, error: '云端没有新的配置数据' }
    return { ok: true, count, hasCloud: true }
  } catch {
    return { ok: false, count: 0, hasCloud: true, error: '云端数据解析失败' }
  }
}
