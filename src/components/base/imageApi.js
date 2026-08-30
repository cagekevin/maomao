/**
 * 生图 API —— 经 localTool /api/proxy 转发到供应商的 /v1/images/generations。
 *
 * 链路：本文件 → localTool:18080/api/proxy → 按 providerId 分派 → 供应商 /v1/images/generations
 *  - apimart(Lovart)：url 原样透传；openai：url=openai://images/generations，localTool 拼 base+key
 *
 * 同步/异步由 provider.image_mode 决定（API 设置页「图片生成模式」）：
 *  - sync ：URL 带 ?wait=1 → 网关同步 SSE 返回（progress + status:succeeded + results[].url）
 *  - async：提交返回 [{status:"submitted", task_id}] → 轮询 GET /v1/tasks/{id} 到 completed
 *
 * 【薄壳】代理请求脚手架（buildTargetUrl / proxyFetch / SSE 流 / 轮询 / 错误分类 / envelope）已
 * 收口到 proxyGenerate.js 深模块；本文件仅负责「业务参数 → genBody + 委托 imageProxy」。
 *
 * ⚠️【为何不走 httpClient.js（SSE 豁免红线）】本模块支持同步 SSE（?wait=1，需逐块消费
 * progress/status/results 增量）与异步轮询双模式，流式增量与「业务失败走 envelope 而非抛 HttpError」
 * 的语义与 httpClient 的「非 2xx 抛 HttpError + 自动重试」冲突；httpClient 自动重试会破坏流式/轮询节奏。
 * 故保持独立 proxyGenerate 链路，并在模块内部自行处理 AbortSignal。禁止把它迁移到 httpClient.js。
 */
import { normalizeImageUrlsForSend } from './imageUrl.ts'
import { imageProxy } from './proxyGenerate.js'
import { logger } from './logger.ts'
// 请求形态层：responses 形态按 input[] + tools 构造请求体（PRD 翻车点 1，消灭死字段）
import { buildResponsesImageBody, isResponsesMode } from './requestModes.ts'

/** 比例 × 清晰度档位 → 精确像素 查表（复刻官方 H_.jsx oe 表）。 */
const RATIO_PIXEL_TABLE = {
  '1:1': { '1K': '1024x1024', '2K': '2048x2048', '4K': '2880x2880' },
  '16:9': { '1K': '1776x880', '2K': '2048x1152', '4K': '3840x2160' },
  '9:16': { '1K': '880x1776', '2K': '1152x2048', '4K': '2160x3840' },
  '3:2': { '1K': '1536x1024', '2K': '2048x1360', '4K': '3504x2336' },
  '2:3': { '1K': '1024x1536', '2K': '1360x2048', '4K': '2336x3504' },
  '21:9': { '1K': '2048x880', '2K': '2048x880', '4K': '3840x1648' },
  '9:21': { '1K': '880x2048', '2K': '880x2048', '4K': '1648x3840' },
  '1:3': { '1K': '688x2048', '2K': '688x2048', '4K': '1280x3840' },
  '3:1': { '1K': '2048x688', '2K': '2048x688', '4K': '3840x1280' },
  '2:1': { '1K': '2048x1024', '2K': '2048x1024', '4K': '3840x1920' },
  '1:2': { '1K': '1024x2048', '2K': '1024x2048', '4K': '1920x3840' },
  '4:3': { '1K': '1024x768', '2K': '2304x1728', '4K': '2880x2160' },
  '3:4': { '1K': '768x1024', '2K': '1728x2304', '4K': '2160x2880' },
}
const DEFAULT_PIXEL = '1024x1024'

/**
 * 比例 + 档位 → 精确像素（查表，复刻官方）。
 *  - 比例 Auto / 空 → 返回 ''（不指定 size）
 *  - 档位查不到 → 回退该比例的 '1K'；比例也查不到 → 兜底 DEFAULT_PIXEL
 * @param {string} ratio  比例，如 '9:16' / 'Auto'
 * @param {string} size   档位，如 '1K' / '2K' / '4K'
 * @returns {string} 像素字符串（'880x1776'）或 ''（Auto 不指定）
 */
export function resolveImagePixel(ratio, size) {
  if (!ratio || ratio === 'Auto' || ratio === 'auto') return ''
  const byRatio = RATIO_PIXEL_TABLE[ratio] || {}
  return byRatio[size] || byRatio['1K'] || DEFAULT_PIXEL
}

/**
 * 生图（文生图 / 图生图）。
 * 尺寸处理对齐官方：把「比例 + 档位」查表转成精确像素 size（避免不同 AI 理解错位），
 * 同时保留 image_size（档位）与 resolution 供网关/apimart 使用。
 * 参考图（图生图）：网关 /v1/images/generations 认 image_urls 字段，blob: 由 imageUrl.js 先转 data base64。
 * @param {object} opts
 *   - provider, prompt, model, size(档位 1K/2K), n, aspectRatio(比例), quality, images?
 *   - taskId?: 请求级前端 task_id（P0-A，从 useNodeGeneration/scriptBox 的 run ctx 透传；缺省=日志可见，不回退全局单例）
 * @param {function} [onProgress] (percent)
 * @param {AbortSignal} [signal] 可选取消信号（Step A；不传向后兼容）
 * @returns {{ ok:boolean, url?:string, error?:string }}
 */
export async function generateImage({ provider, prompt, model, size, n, aspectRatio, quality, images, taskId }, onProgress, signal) {
  const hasRatio = aspectRatio && aspectRatio !== 'Auto' && aspectRatio !== 'auto'
  // 发送统一出口守卫：参考图必经此归一（含缩略图端点自动还原原图），禁止绕过。见 imageUrl.js thumbnailToOriginal
  const refImages = await normalizeImageUrlsForSend(images, { preferBase64: provider?.refFormat === 'base64' })

  // responses 形态：按 input[] + tools 构造请求体（PROD 关键：消灭死字段，image_request_mode 真正生效）
  if (isResponsesMode(provider?.image_request_mode)) {
    const pixel = hasRatio ? resolveImagePixel(aspectRatio, size || '1K') : (size || '')
    const genBody = buildResponsesImageBody({ model, prompt, images: refImages, size: pixel || undefined })
    logger.debug('生图', '[参数] responses genBody', { model, prompt: String(prompt).slice(0, 100), refCount: refImages.length }, { module: 'image' })
    return imageProxy({ provider, genBody, onProgress, signal, taskId })
  }

  const genBody = { prompt, model, n: n || 1 }
  // 比例非 Auto → 查表转精确像素作 size；否则用传入的档位/默认
  genBody.size = hasRatio ? resolveImagePixel(aspectRatio, size || '1K') : (size || '')
  if (size && hasRatio) genBody.resolution = size
  if (size) genBody.image_size = String(size).toUpperCase()
  if (quality && quality !== 'auto') genBody.quality = quality
  // refFormat:'base64' 的 provider（只认 base64 的后端）→ 参考图统一转 base64 再发；
  // 否则走默认（URL，网关 resolve_attachments 统一转 CDN）。
  if (refImages.length > 0) genBody.image_urls = refImages

  // 【B层】genBody 组装结果：尺寸/参考图/质量（定位发给网关的生图参数是否正确拼装）
  logger.debug('生图', '[参数] genBody', {
    model, prompt: String(prompt).slice(0, 100), size: genBody.size, resolution: genBody.resolution,
    image_size: genBody.image_size, quality: genBody.quality, refCount: refImages.length,
    refFormat: provider?.refFormat || 'url',
  }, { module: 'image' })
  return imageProxy({ provider, genBody, onProgress, signal, taskId })
}
