#!/usr/bin/env node
/**
 * API 供应商 config 同步脚本
 * ------------------------------------------------------------
 * 用途：把项目根 `api.config.json`（base config，人/AI 可编辑）同步到 localTool 后端
 *       `/api/providers`（落盘 ~/.maomao-localtool/providers.json）。
 *
 * 用法（项目根执行）：
 *   node scripts/sync-api-config.mjs           同步（读取 api.config.json）
 *   node scripts/sync-api-config.mjs --print   只打印将要合并的结果，不写后端（dry-run）
 *
 * 合并规则（关键）：
 *   - 按 provider.id 匹配后端已有 provider。
 *   - base config 里该 provider「出现的字段」会覆盖后端值（name/base_url/protocol/
 *     image_request_mode/image_mode/enabled/isPrimary）。
 *   - 模型清单（image_models/chat_models/video_models）为可选：config 里写了才覆盖，
 *     不写则保留后端现有（避免 fetch-models 拉到的完整模型被丢）。
 *   - API key 不在此文件也不在此脚本处理；key 只存 localTool/.env（API_PROVIDER_{ID}_KEY）。
 *   - 同步后保证「至少一个 isPrimary=true」，多主时取 config 里最后一个 isPrimary=true 胜出。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CONFIG_FILE = path.join(ROOT, 'api.config.json')
const API_BASE = process.env.LOCALTOOL_BASE || 'http://127.0.0.1:18080'

const DRY_RUN = process.argv.includes('--print') || process.argv.includes('--dry-run')

// ── 读取 base config ──
function loadBaseConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error(`未找到 base config：${CONFIG_FILE}`)
    process.exit(1)
  }
  const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
  if (!Array.isArray(cfg.providers)) {
    console.error('api.config.json 缺少 providers[] 数组')
    process.exit(1)
  }
  return cfg.providers
}

// ── 请求封装 ──
async function api(pathname, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = {}
  try { data = text ? JSON.parse(text) : {} } catch { /* ignore */ }
  if (!res.ok) {
    const msg = data?.detail || data?.error || data?.message || `HTTP ${res.status}`
    throw new Error(`GET/PUT ${pathname} 失败: ${msg}`)
  }
  return data
}

// ── 归一化模型数组（对齐后端 normalizeProvider 的 normModel）──
function normModels(arr) {
  if (!Array.isArray(arr)) return null
  const out = []
  for (const m of arr) {
    if (!m || typeof m.id !== 'string' || !m.id) continue
    out.push({
      id: m.id,
      label: typeof m.label === 'string' ? m.label : m.id,
      streaming: !!m.streaming,
      promptOnly: !!m.promptOnly,
    })
  }
  return out
}

// ── 合并：base config → 后端现有 ──
function mergeConfig(baseList, existingList) {
  const byId = new Map(existingList.map((p) => [p.id, { ...p }]))
  // isPrimary 唯一化：取 config 里最后一个 isPrimary=true 胜出
  let primaryId
  for (const bp of baseList) {
    if (bp.isPrimary) primaryId = bp.id
  }

  for (const bp of baseList) {
    if (!bp || typeof bp.id !== 'string' || !bp.id.trim()) continue
    const id = bp.id.trim()
    const prev = byId.get(id)
    const merged = { ...(prev || {}) }

    // 覆盖核心字段（仅当 base config 里提供了该字段）
    const scalarFields = ['name', 'base_url', 'protocol', 'image_request_mode', 'image_mode', 'enabled']
    for (const f of scalarFields) {
      if (bp[f] !== undefined) merged[f] = bp[f]
    }
    // isPrimary：未指定主供应商时保留后端原有；否则按 primaryId 设置
    merged.isPrimary = primaryId ? (id === primaryId) : (prev ? !!prev.isPrimary : false)

    // 模型：base config 里写了才覆盖
    const img = normModels(bp.image_models)
    const chat = normModels(bp.chat_models)
    const vid = normModels(bp.video_models)
    if (img) merged.image_models = img
    if (chat) merged.chat_models = chat
    if (vid) merged.video_models = vid

    // 兜底默认
    merged.protocol = merged.protocol === 'apimart' ? 'apimart' : 'openai'
    merged.image_request_mode = merged.image_request_mode || 'openai'
    merged.image_mode = merged.image_mode === 'async' ? 'async' : 'sync'
    merged.enabled = merged.enabled !== false
    merged.image_models = merged.image_models || []
    merged.chat_models = merged.chat_models || []
    merged.video_models = merged.video_models || []
    merged.model_names = merged.model_names || {}

    // 新增 provider 需要默认模型数组
    if (!prev) {
      merged.image_models = img || []
      merged.chat_models = chat || []
      merged.video_models = vid || []
    }

    byId.set(id, merged)
  }

  const mergedList = [...byId.values()]
  // 至少一个 primary
  if (!mergedList.some((p) => p.isPrimary) && mergedList.length > 0) {
    mergedList[0].isPrimary = true
  }
  return mergedList
}

// ── 主流程 ──
async function main() {
  const base = loadBaseConfig()
  const existing = (await api('/api/providers')).providers || []
  const merged = mergeConfig(base, existing)

  // 只保留后端 /api/providers 认识的字段，剔除脱敏字段（has_key/key_preview/key_env）
  const clean = merged.map(({ has_key, key_preview, key_env, ...p }) => p)

  console.log(`API base: ${API_BASE}`)
  console.log(`base config providers: ${base.length} | 后端现有: ${existing.length} | 合并后: ${clean.length}`)
  for (const p of clean) {
    console.log(`  - ${p.id} [${p.protocol}] enabled=${p.enabled} primary=${!!p.isPrimary} img=${p.image_models?.length ?? 0} chat=${p.chat_models?.length ?? 0} vid=${p.video_models?.length ?? 0} url=${p.base_url}`)
  }

  if (DRY_RUN) {
    console.log('\n[dry-run] 未写入后端。')
    return
  }

  const res = await api('/api/providers', { method: 'PUT', body: { providers: clean } })
  console.log(`\n同步完成，后端返回 ${(res.providers || []).length} 个 provider。`)
}

main().catch((e) => {
  console.error('同步失败：', e.message)
  process.exit(1)
})
