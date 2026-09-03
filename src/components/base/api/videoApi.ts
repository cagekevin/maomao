/**
 * 视频生成 API —— 「前端发意图 → localTool /api/generate（relay 后端化）」（docs/90 R5、docs/101）。
 *
 * 链路：本文件 → relayGenerate（relayProxy）→ POST /api/generate → relay-poll 常驻轮询
 *      → ai-relay 引擎按 providerId 出站 → saveRemoteUrl 落盘 /files/ → GET attach 返 {ok,url}。
 *
 * ⚠️ 视频强制异步：后端 relay 统一按异步句柄跑（提交 → 常驻轮询到终态 → 落盘），前端不再自轮询。
 *
 * 【新时代配置型（2026-09-03）】providerId = 13 个 config 厂商之一；model = 该厂商模型清单里的 id。
 * 出站形态由后端 preset 决定，前端只发意图。已随 proxyGenerate 退役移除 videoProxy/pollUntilDone。
 */
import { normalizeImageUrlsForSend } from '../utils/imageUrl.ts'
import { relayGenerate } from './relayProxy.ts'
import { VIDEO_TIMEOUT } from '../core/config.ts'
import type { GenerationProvider, GenerationResult } from '@/types'

/** generateVideo 入参（对外签名不变） */
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
 * 文生视频 / 图生视频 → 发意图给后端 relay，等待落盘终态。
 * @param onProgress 进度回调 (percent)
 * @param signal 可选取消信号
 * @returns {{ ok:boolean, url?:string, error?:string, aborted?:boolean }}
 */
export async function generateVideo({ provider, prompt, model, size, resolution, seconds, images, taskId }: GenerateVideoOptions, onProgress?: (percent: number, message?: string) => void, signal?: AbortSignal): Promise<GenerationResult> {
  // 发送统一出口守卫：参考图必经此归一。见 imageUrl.js thumbnailToOriginal
  const refImages = await normalizeImageUrlsForSend(images)

  try {
    const r = await relayGenerate({
      intent: {
        frontTaskId: taskId || '',
        type: 'video',
        providerId: provider.id,
        capability: 'video',
        model,
        prompt,
        size: (size && size !== 'Auto') ? size : undefined,
        resolution,
        duration: seconds ? String(seconds) : undefined,
        images: refImages,
      },
      timeoutMs: VIDEO_TIMEOUT,
      signal,
      onProgress,
    })
    if (r.ok && r.url) return { ok: true, url: r.url }
    return { ok: false, error: r.error || '生成失败', aborted: r.aborted }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return { ok: false, aborted: true, error: '已停止' }
    return { ok: false, error: e instanceof Error ? e.message : '生成失败' }
  }
}