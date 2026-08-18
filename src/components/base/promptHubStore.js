/**
 * 提示词社区库 — 数据层（promptHubStore）。
 *
 * 搬运自 infinite-canvas 的 prompt-source-runtime.ts（normalizeItems / absoluteUrl /
 * runPromptSource）+ prompts.ts（缓存/聚合/搜索）。保持解析与原版一致，仅将存储从
 * localforage 换成我们的 contentStore（localStorage + 内存），并去掉定时轮询/
 * stale-while-revalidate（核心版不做，手动刷新替代）。
 *
 * ── 数据库影响 ──
 * 本模块只读网络 + 写 contentStore 的 local 键（yimao_prompt_hub_cache），
 * 完全不碰 localtool.db / SQL 表。对你近期升级数据库零影响。
 */

import { contentGet, contentSet } from './contentStore.js'

// ── 提示词社区库 — 数据源配置（原 promptSources.js，已合并至此） ──
const PROMPT_HUB_REGISTRY_BASE =
  'https://raw.githubusercontent.com/yukkcat/image-prompts/main/dist/sources'

/** 内置源（搬运原版，禁止为空 url） */
const DEFAULT_PROMPT_HUB_SOURCES = [
  { id: 'banana-prompt-quicker', name: 'Banana Prompt Quicker', url: `${PROMPT_HUB_REGISTRY_BASE}/banana-prompt-quicker.json`, homepage: 'https://glidea.github.io/banana-prompt-quicker/' },
  { id: 'davidwu-gpt-image2-prompts', name: 'DavidWu GPT Image 2', url: `${PROMPT_HUB_REGISTRY_BASE}/davidwu-gpt-image2-prompts.json`, homepage: 'https://github.com/davidwuw0811-boop/awesome-gpt-image2-prompts' },
  { id: 'awesome-gpt-image', name: 'Awesome GPT Image', url: `${PROMPT_HUB_REGISTRY_BASE}/awesome-gpt-image.json`, homepage: 'https://github.com/ZeroLu/awesome-gpt-image' },
  { id: 'awesome-gpt4o-image-prompts', name: 'Awesome GPT-4o', url: `${PROMPT_HUB_REGISTRY_BASE}/awesome-gpt4o-image-prompts.json`, homepage: 'https://github.com/ImgEdify/Awesome-GPT4o-Image-Prompts' },
  { id: 'youmind-gpt-image-2', name: 'YouMind GPT Image 2', url: `${PROMPT_HUB_REGISTRY_BASE}/youmind-gpt-image-2.json`, homepage: 'https://github.com/YouMind-OpenLab/awesome-gpt-image-2' },
  { id: 'youmind-nano-banana-pro', name: 'YouMind Nano Banana Pro', url: `${PROMPT_HUB_REGISTRY_BASE}/youmind-nano-banana-pro-prompts.json`, homepage: 'https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts' },
]

export function getPromptHubSources() {
  return DEFAULT_PROMPT_HUB_SOURCES
}

const CACHE_KEY = 'yimao_prompt_hub_cache'
const CACHE_TTL_MS = 1000 * 60 * 60 // 1 小时

/** 订阅者：{ [sourceId]: Set<cb> }（轻量，仅用于触发 UI 刷新） */
const listeners = new Map()

/**
 * @typedef {Object} RawPrompt
 * 原版字段（搬运），referenceImageUrls 保留以支持以后多图预览。
 */
function asRecord(value) {
  return value && typeof value === 'object' ? value : {}
}
function stringValue(value) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}
function stringArray(value) {
  return Array.isArray(value) ? value.map(stringValue).map((s) => s.trim()).filter(Boolean) : []
}
function optionalString(value) {
  const r = stringValue(value).trim()
  return r || undefined
}
function optionalNumber(value) {
  const r = Number(value)
  return Number.isFinite(r) && r > 0 ? r : undefined
}
function absoluteUrl(baseUrl, path) {
  if (!path) return ''
  try {
    return new URL(path, baseUrl).toString()
  } catch {
    return path
  }
}
function leftPad(n) {
  return String(n).padStart(4, '0')
}

/** 归一化单条记录：缺字段兜底、去重、自动补 id、封面兜底参考图第一张 */
function normalizeItems(values, source) {
  const seen = new Set()
  const items = []
  values.forEach((value, index) => {
    const rec = asRecord(value)
    const title = stringValue(rec.title).trim()
    const prompt = stringValue(rec.prompt).trim()
    if (!title || !prompt) return
    const id = stringValue(rec.id).trim() || `${source.id}-${leftPad(index + 1)}`
    if (seen.has(id)) return
    seen.add(id)
    const referenceImageUrls = stringArray(rec.referenceImageUrls).map((u) => absoluteUrl(source.url, u))
    const coverUrl = absoluteUrl(source.url, stringValue(rec.coverUrl)) || referenceImageUrls[0] || ''
    items.push({
      id,
      title,
      prompt,
      description: stringValue(rec.description),
      coverUrl,
      referenceImageUrls,
      tags: stringArray(rec.tags),
      preview: stringValue(rec.preview),
      createdAt: stringValue(rec.createdAt),
      updatedAt: stringValue(rec.updatedAt),
      author: optionalString(rec.author),
      sourceUrl: absoluteUrl(source.url, stringValue(rec.sourceUrl)),
      imageMode: optionalString(rec.imageMode),
      imageModel: optionalString(rec.imageModel),
      imageSize: optionalString(rec.imageSize),
      imageCount: optionalNumber(rec.imageCount),
      sourceId: source.id,
      category: source.name,
      githubUrl: absoluteUrl(source.url, stringValue(rec.sourceUrl)) || source.homepage,
    })
  })
  return items
}

async function fetchSource(source) {
  const res = await fetch(source.url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`请求失败（${res.status}）`)
  return res.json()
}

/** 拉取并归一化单个源 */
async function runPromptSource(source) {
  let data
  try {
    data = await fetchSource(source)
  } catch (err) {
    throw new Error(`「${source.name}」拉取失败：${err instanceof Error ? err.message : String(err)}`)
  }
  if (!Array.isArray(data)) throw new Error(`「${source.name}」格式错误：根节点必须是数组`)
  const items = normalizeItems(data, source)
  if (!items.length) throw new Error(`「${source.name}」未解析到有效提示词`)
  return items
}

function sourceSignature(source) {
  const v = `${source.name}\n${source.url}\n${source.homepage}`
  let hash = 0
  for (let i = 0; i < v.length; i += 1) hash = (hash * 31 + v.charCodeAt(i)) | 0
  return `${v.length}:${hash}`
}

/** 读整份缓存 { [sourceId]: { items, fetchedAt, signature, lastError } } */
function readCache() {
  const c = contentGet(CACHE_KEY)
  return c && typeof c === 'object' ? c : {}
}
function writeCache(all) {
  contentSet(CACHE_KEY, all)
  notifyAll()
}

/** 拉取（或读缓存）单个源，返回 Prompt[]；失败返回上次缓存或空，不抛 */
async function getSourcePrompts(source) {
  const all = readCache()
  const cached = all[source.id]
  const stale = !cached || cached.signature !== sourceSignature(source) || Date.now() - (cached.fetchedAt || 0) >= CACHE_TTL_MS
  if (!stale && cached.items?.length) return cached.items
  try {
    const items = await runPromptSource(source)
    const next = {
      ...all,
      [source.id]: { items, fetchedAt: Date.now(), signature: sourceSignature(source), lastError: '' },
    }
    writeCache(next)
    return items
  } catch (err) {
    const lastError = err instanceof Error ? err.message : String(err)
    const next = { ...all, [source.id]: { items: cached?.items || [], fetchedAt: cached?.fetchedAt || 0, signature: sourceSignature(source), lastError } }
    writeCache(next)
    // 有旧缓存就返旧，否则返回空数组（UI 显示错误提示）
    return cached?.items || []
  }
}

/** 聚合所有源 */
async function getAllPrompts() {
  const sources = getPromptHubSources()
  const settled = await Promise.all(
    sources.map(async (s) => {
      try {
        return await getSourcePrompts(s)
      } catch {
        return []
      }
    }),
  )
  return settled.flat()
}

export async function loadPromptHub() {
  const items = await getAllPrompts()
  const tags = Array.from(new Set(items.flatMap((i) => i.tags).filter(Boolean)))
  const categories = getPromptHubSources().map((s) => s.name)
  return { items, tags, categories }
}

/**
 * 同步读取已缓存的提示词（首屏秒显，避免每次进 tab 都闪「加载中」）。
 * 仅当某源缓存未过期（TTL 内）才返回其 items，否则该源返回 []。
 * 永不触发网络/写入，故不会自触发订阅循环。
 */
export function getCachedPromptHub() {
  const all = readCache()
  const sources = getPromptHubSources()
  const items = []
  sources.forEach((s) => {
    const c = all[s.id]
    if (c && c.items?.length && Date.now() - (c.fetchedAt || 0) < CACHE_TTL_MS) items.push(...c.items)
  })
  const tags = Array.from(new Set(items.flatMap((i) => i.tags).filter(Boolean)))
  const categories = sources.map((s) => s.name)
  return { items, tags, categories, hasCache: items.length > 0 }
}

/** 取各源最近一次的错误（用于 UI 顶部提示哪些源挂了） */
export function getPromptHubErrors() {
  const all = readCache()
  return getPromptHubSources()
    .map((s) => ({ id: s.id, name: s.name, error: all[s.id]?.lastError || '' }))
    .filter((x) => x.error)
}

// ── 轻量订阅（缓存变更 → 通知 UI） ──
function notifyAll() {
  listeners.forEach((set) => set.forEach((cb) => { try { cb() } catch { /* ignore */ } }))
}
export function subscribePromptHub(cb) {
  if (!listeners.has('all')) listeners.set('all', new Set())
  listeners.get('all').add(cb)
  return () => listeners.get('all')?.delete(cb)
}
