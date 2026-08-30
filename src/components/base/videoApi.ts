/**
 * 视频生成 API —— 经 localTool /api/proxy 转发到供应商的 /v1/videos/generations。
 *
 * 链路：本文件 → localTool:18080/api/proxy → 按 providerId 分派 → 供应商 /v1/videos/generations
 *  - apimart(Lovart)：url 原样透传；openai：url=openai://videos/generations，localTool 拼 base+key
 *
 * ⚠️ 视频强制异步（比生图慢很多，不适合 SSE 同步等待）：
 * 提交返回 task_id → 轮询 GET /v1/tasks/{id} 到 completed → 取 result.videos[].url。
 * 不走 provider.image_mode，也不用 sync。
 *
 * 网关契约：body { model, prompt, size(如 16:9), image_urls(参考图可选) }。
 *
 * 【薄壳】代理请求脚手架（buildTargetUrl / proxyFetch / 轮询 / 错误分类 / envelope）已收口到
 * proxyGenerate.js 深模块；本文件仅负责「业务参数 → genBody + 委托 videoProxy」。
 *
 * ⚠️【为何不走 httpClient.js（SSE 豁免红线）】本模块强制异步（提交 → 轮询 /v1/tasks/{id}），
 * 结果经「任务轮询 + envelope」而非「非 2xx 抛 HttpError」交付；轮询节奏与手动退避语义和
 * httpClient 的「网络/超时自动重试」冲突，自动重试会打乱轮询时序或误判。故保持独立 proxyGenerate
 * 链路，并在模块内部自行处理 AbortSignal。禁止把它迁移到 httpClient.js。
 */
import { normalizeImageUrlsForSend } from './imageUrl.ts'
import { videoProxy } from './proxyGenerate.ts'
import { logger } from './logger.ts'
import type { GenerationProvider, GenerationResult } from '@/types'

/** generateVideo 入参 */
export interface GenerateVideoOptions {
  provider: GenerationProvider
  prompt: string
  model: string
  /** 比例（如 '16:9'） */
  size?: string
  /** 清晰度（如 '1080p'） */
  resolution?: string
  /** 时长（秒） */
  seconds?: number
  /** 参考图（图生视频，可选） */
  images?: string[]
  /** 请求级前端 task_id（P0-A） */
  taskId?: string
}

/**
 * 文生视频 / 图生视频。
 * @param onProgress 进度回调 (percent)
 * @param signal 可选取消信号（Step A；不传向后兼容）
 * @returns {{ ok:boolean, url?:string, error?:string }}
 */
export async function generateVideo({ provider, prompt, model, size, resolution, seconds, images, taskId }: GenerateVideoOptions, onProgress?: (percent: number, message?: string) => void, signal?: AbortSignal): Promise<GenerationResult> {
  const genBody: Record<string, unknown> = { prompt, model }
  if (size && size !== 'Auto') genBody.size = size
  if (resolution) genBody.resolution = resolution
  if (seconds) genBody.duration = String(seconds)
  // 发送统一出口守卫：参考图必经此归一（含缩略图端点自动还原原图），禁止绕过。见 imageUrl.js thumbnailToOriginal
  // refFormat:'base64' 的 provider（只认 base64 的后端）→ 参考图统一转 base64 再发
  const refImages = await normalizeImageUrlsForSend(images, { preferBase64: provider?.refFormat === 'base64' })
  if (refImages.length > 0) genBody.image_urls = refImages

  // 【B层】视频 genBody 组装结果：尺寸/清晰度/时长/参考图（定位发给网关的视频参数是否正确拼装）
  logger.debug('视频', '[参数] genBody', {
    model, prompt: String(prompt).slice(0, 100), size: genBody.size, resolution: genBody.resolution,
    duration: genBody.duration, refCount: refImages.length, refFormat: provider?.refFormat || 'url',
  }, { module: 'image' })
  return videoProxy({ provider, genBody, onProgress, signal, taskId })
}
