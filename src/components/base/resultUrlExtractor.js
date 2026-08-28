/**
 * P1-B 统一 envelope/URL 解析器 —— 收口散落的图片/视频结果 URL 提取与类型判定（data 流交叉点 φ2）。
 *
 * 【收口什么】此前 ≥4 处独立、不共享的提取逻辑：
 *   - proxyGenerate.readSseUrl（SSE `evt.results[0].url ?? evt.result.images[0].url`）
 *   - proxyGenerate.extractImageUrl / extractVideoUrl（JSON 直返/轮询）
 *   - pollTask.extractResultUrl（网关 task_view 按 type 提 url）
 * 全部委托本模块，杜绝"同一响应样例各处解析结果不一致 / video 被当 image"。
 *
 * 【类型判定规则】与 useConnectedInputs.resolveMediaType 同源（本模块为唯一实现）：
 *   生产方 data.mediaType 优先，否则按扩展名 classifyUrl —— 消灭静默误分类。
 *
 * 【字段映射】统一按 type 取：
 *   video → result.videos[0].url / results[0].url / 顶层 video_url
 *   image → result.images[0].url / results[0].url / result.url
 *   audio → result.audios[0].url  / results[0].url / result.url
 * 数组可包时统一取 [0]。
 *
 * 注：纯函数单测见 tests/unit/resultUrlExtractor.test.js（若当前缺，补）。
 */

/** 按 mime / 扩展名把 url 分类（唯一实现，useConnectedInputs 同源，勿另起一套）。 */
export function classifyUrl(url) {
  if (url.startsWith('data:video/') || /\.(mp4|webm|mov|mkv|avi|m4v|ogg)($|\?)/i.test(url)) return 'video'
  if (url.startsWith('data:audio/') || /\.(mp3|wav|ogg|m4a|flac|aac)($|\?)/i.test(url)) return 'audio'
  return 'image'
}

/**
 * 产出类型判定：mediaType 优先（产出方自带，避免 blob/无扩展名被误分类；见 VideoProcessNode extractAudio 例），
 * 否则按 URL 扩展名 classifyUrl。
 * @returns {'image'|'video'|'audio'}
 */
export function resolveMediaType(url, mediaType) {
  if (mediaType === 'image' || mediaType === 'video' || mediaType === 'audio') return mediaType
  return classifyUrl(url || '')
}

// 各类型优先选取的字段路径（均取容器 [0]）
const SELECTORS = {
  video: ['result.videos[0].url', 'results[0].url', 'video_url'],
  audio: ['result.audios[0].url', 'results[0].url', 'result.url'],
  image: ['result.images[0].url', 'results[0].url', 'result.url'],
}

/** 简单路径取值：'result.images[0].url'；遇缺失返回 undefined。 */
function dig(obj, path) {
  return path.split('.').reduce((acc, seg) => {
    if (acc == null || typeof acc !== 'object') return undefined
    const m = seg.match(/^(\w+)\[(\d+)\]$/)
    if (m) return acc[m[1]]?.[Number(m[2])]
    return acc[seg]
  }, obj)
}

/** 数组可包时统一取 [0]，否则原值。 */
function unwrap(u) {
  return Array.isArray(u) ? (u[0] ?? undefined) : u
}

/**
 * 统一提取结果 URL。
 * @param {object} opts
 * @param {object} [opts.data] 响应体 data（通常 = json.data ?? json，优先）
 * @param {object} [opts.json] 完整响应
 * @param {('image'|'video'|'audio')} [opts.type] 任务类型，默认 image
 * @returns {string|undefined} 命中返回 url（可能已取 [0]），否则 undefined
 */
export function extractResultUrl({ data, json, type = 'image' }) {
  const typeKey = type === 'video' ? 'video' : type === 'audio' ? 'audio' : 'image'
  const paths = SELECTORS[typeKey]
  for (const holder of [data, json]) {
    if (!holder || typeof holder !== 'object') continue
    for (const p of paths) {
      const url = unwrap(dig(holder, p))
      if (url) return url
    }
  }
  return undefined
}