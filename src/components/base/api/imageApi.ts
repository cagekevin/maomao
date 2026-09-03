/**
 * 生图 API —— 「前端发意图 → localTool /api/generate（relay 后端化）」（docs/90 R5、docs/101）。
 *
 * 链路：本文件 → relayGenerate（relayProxy）→ POST /api/generate → relay-poll 常驻轮询
 *      → ai-relay 引擎按 providerId( config/providers/<id>.json ) 出站 → 远端结果 saveRemoteUrl 落盘
 *      → GET attach 返回 {ok, url}（url 已是后端落盘 /files/，前端无需再自落盘/自写 result_url）。
 *
 * 【新时代配置型（2026-09-03）】providerId = 13 个 config 厂商之一；model = 该厂商模型清单里的 id。
 * 出站形态（sync/async/responses）由后端 preset 决定，前端只发意图，不再拼 genBody / 判 request_mode。
 *  —— 已随 proxyGenerate 退役移除：isResponsesMode/buildResponsesImageBody/imageProxy 分支。
 */
import { normalizeImageUrlsForSend } from '../imageUrl.ts'
import { relayGenerate } from './relayProxy.ts'
import { GEN_TIMEOUT } from '../config.ts'
import type { GenerationProvider, GenerationResult } from '@/types'

/** 比例 × 清晰度档位 → 精确像素 查表（复刻官方 H_.jsx oe 表）。 */
const RATIO_PIXEL_TABLE: Record<string, Record<string, string>> = {
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
 */
export function resolveImagePixel(ratio: string, size: string): string {
  if (!ratio || ratio === 'Auto' || ratio === 'auto') return ''
  const byRatio = RATIO_PIXEL_TABLE[ratio] || {}
  return byRatio[size] || byRatio['1K'] || DEFAULT_PIXEL
}

/** generateImage 入参（对外签名不变） */
export interface GenerateImageOptions {
  provider: GenerationProvider
  prompt: string
  model: string
  /** 清晰度档位（1K/2K），查表转像素用 */
  size?: string
  n?: number
  /** 比例（如 '9:16'），Auto 不指定 size */
  aspectRatio?: string
  quality?: string
  /** 参考图（图生图，可选） */
  images?: string[]
  /** 请求级前端 task_id（P0-A） */
  taskId?: string
}

/**
 * 生图（文生图 / 图生图）→ 发意图给后端 relay，等待落盘终态。
 * @param onProgress 进度回调 (percent)
 * @param signal 可选取消信号
 * @returns {{ ok:boolean, url?:string, error?:string, aborted?:boolean }}
 */
export async function generateImage({ provider, prompt, model, size, aspectRatio, images, taskId }: GenerateImageOptions, onProgress?: (percent: number, message?: string) => void, signal?: AbortSignal): Promise<GenerationResult> {
  const hasRatio = aspectRatio && aspectRatio !== 'Auto' && aspectRatio !== 'auto'
  // 发送统一出口守卫：参考图必经此归一（含缩略图端点自动还原原图），禁止绕过。见 imageUrl.js thumbnailToOriginal
  const refImages = await normalizeImageUrlsForSend(images)
  const pixel = hasRatio ? resolveImagePixel(aspectRatio, size || '1K') : (size || '')

  try {
    const r = await relayGenerate({
      intent: {
        frontTaskId: taskId || '',
        type: 'image',
        providerId: provider.id,
        capability: 'image',
        model,
        prompt,
        size: hasRatio ? pixel : undefined,
        images: refImages,
      },
      timeoutMs: GEN_TIMEOUT,
      signal,
      onProgress,
    })
    if (r.ok && r.url) return { ok: true, url: r.url }
    return { ok: false, error: r.error || '生成失败', aborted: r.aborted }
  } catch (e) {
    // relayGenerate 取消时抛 AbortError，转成既有 aborted 信封
    if (e instanceof Error && e.name === 'AbortError') return { ok: false, aborted: true, error: '已停止' }
    return { ok: false, error: e instanceof Error ? e.message : '生成失败' }
  }
}