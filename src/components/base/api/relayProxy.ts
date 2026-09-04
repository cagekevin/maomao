/**
 * relayProxy — 前端「异步任务 relay 后端化」客户端（docs/90 R5 双轨的 client 半边）。
 *
 * 【角色】前端只发意图 + GET attach，不再自轮询/自落盘/自写 result_url：
 *   - relaySubmit：POST /api/generate 提交 → 后端 relay-poll 立即返 taskId（任务在 localTool 进程跑）
 *   - relayPoll：  GET  /api/generate/:frontTaskId attach 同一句柄 → running(progress) / completed(/files/ url) / failed
 *   - relayGenerate（组合）：submit 后低频 GET attach 直到终态，返回 {ok,url}（url 已是后端落盘 /files/）
 *
 * 【为什么 GET 也算轮询却安全】后端句柄生命周期 = localTool 进程且落库；前端刷新 = 重新 attach 到
 *   同一句柄，任务继续跑完落盘不丢。旧模型的「丢结果」根因（result_url 写库真源在前端一次性窗口）已消除——
 *   result_url 由后端写，前端 GET 只是读。
 *
 * 【唯一出口纪律】传输统一 httpClient；协议执行在 localTool（ai-relay kit + relay-poll），本文件无字段抽取。
 */

import { API_BASE, GEN_POLL_INTERVAL } from '../core/config.ts'
import { httpRequest } from './httpClient.ts'
import { logger } from '../core/logger.ts'

/** relay 能力（对齐 /api/generate 的 capability） */
export type RelayCapability = 'image' | 'video' | 'chat'

/** relay 提交意图（与 /api/generate body 对齐） */
export interface RelayIntent {
  /** 前端自造任务 id（taskStore task_id，贯穿链路主键） */
  frontTaskId: string
  /** 归属节点 id（任务行 node_id 由 taskStore.reportGenerate 写；此字段可省略） */
  nodeId?: string
  type: string
  providerId: string
  capability: RelayCapability
  model: string
  prompt?: string
  size?: string
  images?: string[]
  messages?: unknown[]
  /** video：清晰度（如 '1080p'） */
  resolution?: string
  /** video：时长（秒） */
  duration?: number | string
}

/** relay GET attach 返回（/api/generate/:id 的 data 子集） */
export interface RelayPollData {
  status: 'running' | 'completed' | 'failed'
  progress?: number
  url?: string
  error?: string
}

/** relay 生成最终结果信封（对齐 GenerationResult：ok/url/content/error/aborted） */
export interface RelayGenerationResult {
  ok: boolean
  url?: string
  content?: string
  error?: string
  aborted?: boolean
}

/** 信封解析：localTool 端点 { code, data } */
interface CodeData<T> {
  code?: number
  data?: T
}

/** 提交到 /api/generate（不等终态），后端立即返 taskId。 */
export async function relaySubmit(intent: RelayIntent): Promise<{ ok: boolean; taskId?: string; error?: string }> {
  try {
    const body = {
      frontTaskId: intent.frontTaskId,
      nodeId: intent.nodeId,
      type: intent.type,
      providerId: intent.providerId,
      capability: intent.capability,
      model: intent.model,
      ...(intent.prompt !== undefined ? { prompt: intent.prompt } : {}),
      ...(intent.size !== undefined ? { size: intent.size } : {}),
      ...(intent.images && intent.images.length > 0 ? { images: intent.images } : {}),
      ...(intent.messages ? { messages: intent.messages } : {}),
      ...(intent.resolution !== undefined ? { resolution: intent.resolution } : {}),
      ...(intent.duration !== undefined ? { duration: String(intent.duration) } : {}),
    }
    // httpRequest 默认 parseJson:true → 成功返纯 data 对象（无 .json()）；非 2xx 抛 HttpError 被下层 catch。
    // localTool 端点恒 200 + {code,data} 信封，故 res.ok 恒真；业务失败走 code:-1 + data.error。
    // 【根治·2026-09-04】POST 提交只负责「接受任务入队」，localTool 端已提交即返回（出站挪进后台句柄），
    // 响应近瞬回，无需默认 15s 掐点——去掉本层超时（timeoutMs:0=禁用），杜绝「已发到 lovart 却被 15s 误报超时」。
    const env = (await httpRequest(`${API_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      retries: 0,
      timeoutMs: 0,
      label: 'relaySubmit',
    })) as CodeData<{ taskId?: string }>
    if (env?.data?.taskId) return { ok: true, taskId: env.data.taskId }
    const msg = (env?.data as { error?: string } | undefined)?.error || `提交失败 (HTTP 200)`
    return { ok: false, error: msg }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '提交失败' }
  }
}

/** 单次 GET attach：查某 frontTaskId 当前进度/结果。 */
export async function relayPoll(frontTaskId: string): Promise<RelayPollData> {
  try {
    // parseJson:true 默认 → 返纯 data；非 2xx 抛 HttpError 进 catch → 返回 running 下轮续查
    // 【根治·2026-09-04】单次 GET attach 只读 localTool 内存/DB 句柄，近瞬回；
    // 真正的长等待由外层 relayAttachUntilDone 的 timeoutMs(GEN_TIMEOUT) 兜底，故去掉本层 15s 掐点，
    // 避免后端忙时单次 attach 误超时被降级为 running 空转。
    const env = (await httpRequest(`${API_BASE}/api/generate/${encodeURIComponent(frontTaskId)}`, {
      method: 'GET',
      retries: 0,
      timeoutMs: 0,
      label: 'relayPoll',
    })) as CodeData<RelayPollData>
    const d = env?.data
    if (d?.status === 'completed') return { status: 'completed', url: d.url, progress: 100 }
    if (d?.status === 'failed') return { status: 'failed', error: d.error || '生成失败' }
    return { status: 'running', progress: d?.progress ?? 0 }
  } catch (e) {
    return { status: 'running', error: e instanceof Error ? e.message : '查询异常' } // 网络抖动/HTTP错：下轮续查
  }
}

/** 取消：POST /api/generate/:frontTaskId/cancel（后端停句柄 → 置 failed）。 */
export async function relayCancel(frontTaskId: string): Promise<{ ok: boolean }> {
  try {
    // parseJson:true 默认 → 成功返纯 data（非 2xx 抛 HttpError 进 catch → ok:false）；无异常视为成功
    await httpRequest(`${API_BASE}/api/generate/${encodeURIComponent(frontTaskId)}/cancel`, {
      method: 'POST',
      retries: 0,
      label: 'relayCancel',
    })
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export interface RelayGenerateOptions {
  intent: RelayIntent
  /** 总超时 ms（对齐前端 GEN_TIMEOUT/VIDEO_TIMEOUT 语义，默认 10min） */
  timeoutMs?: number
  signal?: AbortSignal
  onProgress?: (percent: number, message?: string) => void
}

export interface RelayAttachOptions {
  frontTaskId: string
  /** 总超时 ms（默认 10min） */
  timeoutMs?: number
  signal?: AbortSignal
  onProgress?: (percent: number, message?: string) => void
  /** 起始进度（放弃初始 submit 后的 20；恢复时直接开始映射后端 progress） */
  startProgress?: number
  /** 是否在 abort 时通知后端 cancel（image/video in-flight 置 failed 停句柄；刷新恢复不 cancel） */
  cancelOnAbort?: boolean
}

/**
 * 统一「低频 GET attach 直到终态」循环（2026-09-03 收敛）。
 * 后端 relay-poll 常驻句柄在 localTool 进程，DB 是真相；本循环只是「重 attach 拿状态」。
 *  - 返回 { ok:true, url }（url = 后端已落盘 /files/，前端无需 saveResultToTasks）｜{ ok:false, error }；
 *  - signal abort：cancelOnAbort=true 时先通知后端 cancel（置 failed 停句柄）再抛 AbortError。
 * 供 relayGenerate（in-flight，cancelOnAbort=true）与刷新恢复（pollTask，不 cancel）复用，
 * 保证「唯一查询协议 = /api/generate/:id attach」，不再各写一套轮询。
 */
export async function relayAttachUntilDone(opts: RelayAttachOptions): Promise<RelayGenerationResult> {
  const { frontTaskId, signal } = opts
  const timeoutMs = opts.timeoutMs ?? 600_000
  const pollInterval = Math.max(1000, GEN_POLL_INTERVAL)
  const startedAt = Date.now()

  // 取消对齐：signal abort 时按需通知后端 cancel（置 failed 停句柄），否则后端句柄续跑到终态。
  // settled 守卫：终态返回后即使 signal 晚到 abort 也不再 cancel（不误杀已完成任务）。
  let settled = false
  const onAbort = () => {
    if (settled || !opts.cancelOnAbort) return
    settled = true
    void relayCancel(frontTaskId).catch(() => {})
  }
  signal?.addEventListener('abort', onAbort, { once: true })

  const finish = (r: RelayGenerationResult): RelayGenerationResult => {
    settled = true
    signal?.removeEventListener('abort', onAbort)
    return r
  }

  // 低频 GET attach（后端句柄在 localTool 进程，前端刷新=重 attach，不丢）
  let lastProgress = opts.startProgress ?? 30
  while (Date.now() - startedAt < timeoutMs) {
    if (signal?.aborted) {
      onAbort()
      const err = new Error('Aborted')
      err.name = 'AbortError'
      throw err
    }
    await new Promise((r) => setTimeout(r, pollInterval))
    const st = await relayPoll(frontTaskId)
    if (st.status === 'completed' && st.url) {
      opts.onProgress?.(100, '完成')
      logger.debug('生成', '[relay] 完成', { frontTaskId, urlHead: st.url.slice(0, 80) }, { module: 'image' })
      return finish({ ok: true, url: st.url })
    }
    if (st.status === 'failed') {
      logger.debug('生成', '[relay] 失败', { frontTaskId, error: st.error }, { module: 'image' })
      return finish({ ok: false, error: st.error || '生成失败' })
    }
    if (st.progress !== undefined && st.progress !== lastProgress) {
      lastProgress = st.progress
      opts.onProgress?.(30 + Math.min(60, Math.round(lastProgress)), '上游生成中…')
    }
  }
  return finish({ ok: false, error: '生成超时' })
}

/**
 * 组合：relaySubmit → 低频 GET attach 直到终态。
 * - 返回 { ok:true, url }（url = 后端已落盘 /files/，前端无需再 saveResultToTasks）；
 * - 失败返回 { ok:false, error }；取消抛 AbortError（调用方按既有契约处理）。
 */
export async function relayGenerate(opts: RelayGenerateOptions): Promise<RelayGenerationResult> {
  const { intent, signal } = opts
  opts.onProgress?.(10, '正在连接本地服务…')
  const sub = await relaySubmit(intent)
  if (!sub.ok || !sub.taskId) {
    return { ok: false, error: sub.error || '提交失败' }
  }
  opts.onProgress?.(20, '已提交到生成网关…')
  try {
    const r = await relayAttachUntilDone({
      frontTaskId: sub.taskId,
      timeoutMs: opts.timeoutMs,
      signal,
      onProgress: opts.onProgress,
      startProgress: 20,
      cancelOnAbort: true, // in-flight：用户停止 → 通知后端 cancel 停句柄
    })
    return r
  } catch (e) {
    // attach 阶段 AbortError（cancelOnAbort 已通知后端 cancel）——透传给调用方按既有契约处理
    if (e instanceof Error && e.name === 'AbortError') throw e
    return { ok: false, error: e instanceof Error ? e.message : '生成失败' }
  }
}

/**
 * chat：经统一入口 POST /api/generate（capability=chat）同步调用（后端 relayGenerate 出站）。返回 { ok, content? | error?, aborted? }。
 * 流式与否由后端按 config/providers 里该 provider 的 streaming 决定（前端不传 stream）。
 * 【2026-09-03 收口】统一生成入口，chat 与 image/video 同打 /api/generate（旧 /api/relay 已并入）；
 * frontTaskId 透传
 * 任务中心同一 task_id（聊天也贯穿任务中心，见 taskStore.reportGenerate），后端接收但不建轮询句柄。
 */
export async function relayChat(
  intent: RelayIntent,
  opts: { signal?: AbortSignal; timeoutMs?: number; temperature?: number; responseFormat?: string } = {}
): Promise<RelayGenerationResult> {
  const { signal } = opts
  const timeoutMs = opts.timeoutMs ?? 120_000 // 对齐 CHAT_TIMEOUT
  const body: Record<string, unknown> = {
    frontTaskId: intent.frontTaskId,
    providerId: intent.providerId,
    capability: 'chat',
    model: intent.model,
    ...(intent.messages ? { messages: intent.messages } : {}),
    ...(intent.prompt !== undefined ? { prompt: intent.prompt } : {}),
    ...(intent.images && intent.images.length > 0 ? { images: intent.images } : {}),
  }
  if (opts.temperature !== undefined) body.temperature = opts.temperature
  if (opts.responseFormat) body.response_format = opts.responseFormat
  try {
    // 统一入口：chat 走同步快路径，后端立即返 {code:0,data:{status:'completed',text}}。
    // httpRequest 默认 parseJson:true → 成功返纯 data 对象；非 2xx 抛 HttpError 进 catch。
    const env = (await httpRequest(`${API_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
      retries: 0,
      timeoutMs,
      label: 'relayChat',
    })) as CodeData<{ status?: string; text?: string; error?: string }>
    const d = env?.data
    if (d?.text) return { ok: true, content: d.text }
    if (d?.error) return { ok: false, error: d.error }
    return { ok: false, error: '上游未返回文本内容' }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError' || signal?.aborted) return { ok: false, aborted: true, error: '已停止' }
    return { ok: false, error: e instanceof Error ? e.message : '聊天失败' }
  }
}
