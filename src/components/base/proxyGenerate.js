/**
 * 生成/聊天代理请求深模块 —— 收口 chatApi / imageApi / videoApi 透传 localTool /api/proxy 的
 * 全部重复脚手架（buildTargetUrl ×3、proxyRequest ×3、generateAsync 轮询 ×2、readSseImageUrl、
 * 嵌套错误解析、AbortError 治理）。三 *Api 退化为仅组 body 的薄壳，委托本模块的语义化三函数。
 *
 * 架构依据（State 2 不变量 + State 3 方案 B）：
 *  - 依赖分类：Remote but owned (Ports & Adapters) —— localTool:18080 为本仓库自有跨网络服务。
 *  - Port（Seam）= 内部私有 `__proxyFetch`；生产 adapter = 真实 fetch，测试 adapter = in-memory（canned Response）。
 *  - 逻辑（url 拼装 / SSE 解析 / 轮询调度 / 错误分类 / envelope）归本深模块，transport 仅管字节传输。
 *  - 外层 facade 用三个语义化函数（chatProxy/imageProxy/videoProxy），差异点（envelope/throw、sse/poll）
 *    固化在各自函数内，不靠 mode/stream 标志位 —— 避免歧义开关。
 *
 * 平台扩展自由点（将来对接不同平台只动这里，不牵动 facade）：
 *  - buildTargetUrl 的 provider.protocol 分支（openai 伪协议 vs apimart base_url）。
 *  - extractUrl 参数化（image 取 result.images[].url，video 取 result.videos[].url）。
 *  - __proxyFetch 的 transport —— 生产=真实 fetch，测试=in-memory，换传输层只动 adapter。
 */

import { API_BASE } from './config.js'
import { getCurrentTaskId, setTaskPollId } from './taskStore.js'
import { GEN_TIMEOUT, GEN_POLL_INTERVAL, VIDEO_TIMEOUT, VIDEO_POLL_INTERVAL, CHAT_TIMEOUT } from './config.js'
import { withTimeout, isTimeoutError } from './asyncGuard.js'
import { classifyError } from './genErrors.js'
import { logger } from './logger.js'
// 【出口回收】所有 /api/proxy 出口经统一 httpRequest（B5），不再裸写 fetch
import { httpRequest } from './httpClient.js'
// 可插拔协议适配器：统一 buildTargetUrl（openai 伪协议 / apimart base_url 拼装）
import { buildTargetUrl } from './providerProtocols.js'
// 请求形态层：image_request_mode 驱动端点/响应解析（消灭死字段，PRD 翻车点 1）
import { imageModePath, isResponsesMode, parseResponsesJson, resolveChatMode, parseResponsesChatJson } from './requestModes.js'

// ── 内部共享原语（调用方不可见）──────────────────────────────────────

/** 统一响应信封（生成类）：成功 {ok:true, url}，失败 {ok:false, error}。 */
function ok(url) { return { ok: true, url } }
function fail(error) { return { ok: false, error } }

/**
 * 组装发往 /api/proxy 的负载（url/method/body + providerId + 贯穿 task_id）。
 * 供 __proxyFetch 与 chatProxy 共享（chat 需要原始 Response 决定信封，故拆出）。
 */
function __buildProxyPayload({ provider, target, method = 'POST', body }) {
  const payload = { url: target, method }
  if (body !== undefined) payload.body = JSON.stringify(body)
  if (provider?.id) payload.providerId = provider.id
  // 贯穿链路：把前端 task_id 带给 localTool/网关，关联 Lovart thread_id（见 taskStore.currentTaskId）
  const frontTaskId = getCurrentTaskId()
  if (frontTaskId) payload.taskId = frontTaskId
  return payload
}

/**
 * 经 localTool /api/proxy 转发（GET/POST）。失败抛错（由各 facade 按 envelope 策略兜底）。
 * 注意：HTTP 非 2xx 抛错（供 image/video 走 classifyError 归类）；chat 语义不同，不走本函数。
 * @param {{url:string, method?:string, body?:any}} target 已 buildTargetUrl 好的目标
 * @param {object} provider
 * @param {AbortSignal} [signal]
 */
async function __proxyFetch({ provider, target, method = 'POST', body }, signal) {
  // 【B层】生图/视频/聊天 → 本地代理的真实请求发出：目标 + 方法 + body 摘要（定位请求是否发出/发到哪）
  logger.debug('生图', '[请求] 发出', { target, method, bodyHead: body && typeof body === 'object' ? JSON.stringify(body).slice(0, 120) : String(body).slice(0, 120), taskId: getCurrentTaskId() }, { module: 'image' })
  const payload = __buildProxyPayload({ provider, target, method, body })
  // 【出口回收】经 httpRequest 出站。同步生图走 SSE 流 / 异步轮询读完整 JSON，均需拿到未消费的
  // 原始 Response → parseJson:false；timeoutMs:0 保证流式/长生成不被 15s 掐断；retries:0（代理不自动重试）。
  // 非 2xx 由 httpRequest 抛 HttpError（已携带上游错误体），此处重建业务 Error 供 classifyError 归类 business。
  try {
    const res = await httpRequest(`${API_BASE}/api/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      ...(signal ? { signal } : {}),
      timeoutMs: 0,
      retries: 0,
      parseJson: false,
      label: 'proxyFetch',
    })
    return res
  } catch (e) {
    if (e?.name === 'HttpError') {
      const msg = e.message || `HTTP ${e.status}`
      // 【B层】HTTP 非 2xx：响应码 + 后端错误信息（定位网关拒绝/超时）
      logger.debug('生图', '[请求] HTTP失败', { target, status: e.status, msg }, { module: 'image' })
      throw new Error(msg)
    }
    // 网络/超时/取消：原样上抛，由调用方 classifyError 归类
    throw e
  }
}

/**
 * 从 SSE 响应流中提取第一个成功 url（兼容 {results[].url} 与 {result.images[].url}）。
 * 上游 progress(0-100) 归一化映射到 [30,90]（避免覆盖阶段基准），单调递增兜底保证进度只进不退。
 */
async function readSseUrl(res, onProgress, signal) {
  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let urlFound = ''
  let reached = 0
  let _sseBytes = 0 // 【B层】累计收到的 SSE 字节数（定位流式是否缓冲/断流）
  const stageProgress = (p) => {
    const mapped = 30 + Math.round(Math.min(100, Math.max(0, p || 0)) * 0.6)
    if (mapped > reached) reached = mapped
    onProgress?.(reached, '上游生成中…')
  }
  try {
    while (true) {
      if (signal?.aborted) {
        const err = new Error('Aborted')
        err.name = 'AbortError'
        throw err
      }
      const { done, value } = await reader.read()
      if (done) break
      if (value && value.byteLength) _sseBytes += value.byteLength
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const raw = line.trim().startsWith('data:') ? line.trim().slice(5).trim() : ''
        if (!raw || raw === '[DONE]') continue
        try {
          const evt = JSON.parse(raw)
          if (typeof evt.progress === 'number') stageProgress(evt.progress)
          const rawUrl = evt?.results?.[0]?.url ?? evt?.result?.images?.[0]?.url
          const imgUrl = Array.isArray(rawUrl) ? rawUrl[0] : rawUrl
          if (evt.status === 'succeeded' && imgUrl) urlFound = imgUrl
          if (evt.status === 'failed' || evt.error) throw new Error(evt.error || evt.failure_reason || '生成失败')
        } catch (e) { /* 忽略单条 JSON 解析失败 */ }
      }
    }
  } finally {
    reader.releaseLock()
  }
  // 【B层】SSE 流结束：字节数 + 是否找到图片 url（定位同步生图是否拿到结果/中途断流）
  logger.debug('生图', '[SSE] 完成', { bytes: _sseBytes, found: !!urlFound, urlHead: urlFound ? String(urlFound).slice(0, 80) : '' }, { module: 'image' })
  return urlFound
}

/**
 * 异步模式通用轮询：提交拿 task_id → 轮询 /v1/tasks/{id} 到 completed。
 * image 与 video 共享本引擎，仅 extractUrl 参数化差。
 */
async function pollUntilDone({ provider, url, genBody, extractUrl, pollInterval, timeoutMs }, onProgress, signal) {
  let taskId
  try {
    onProgress?.(10, '正在连接本地服务…')
    const res = await __proxyFetch({ provider, target: url, method: 'POST', body: genBody }, signal)
    onProgress?.(20, '已提交到生成网关…')
    const json = await res.json()
    const data = json?.data ?? json
    // 网关提交响应有两种形态（见 localTool system.ts extractAndPersistThreadId）：
    //  - 图片/普通：data 为数组 [{ status, task_id }]
    //  - 视频：data 为单个对象 { id, status, task_id }
    // 统一归一成数组再找 task_id，否则视频对象形态会被当成空数组 → 误判「上游未返回任务 id」。
    const tasks = Array.isArray(data) ? data : Array.isArray(json) ? json : (data && typeof data === 'object' ? [data] : [])
    const submitted = tasks.find((t) => t && (t.status === 'submitted' || t.task_id))
    taskId = submitted?.task_id
    const direct = extractUrl({ data, json })
    // 【B层】异步模式提交：拿到网关 task_id（定位是否成功提交、有无直返结果）
    logger.debug('生成', '[异步] 提交', { taskId, direct: !!direct }, { module: 'image' })
    if (!taskId && direct) return ok(direct)
  } catch (e) {
    if (e?.name === 'AbortError') throw e // 取消：原样抛出，由调用方处理
    const c = classifyError(e)
    return c.type === 'network' ? fail(c.message) : fail(`提交失败：${c.message || '提交异常'}`)
  }
  if (!taskId) return fail(`上游未返回任务 id`)

  // 【取舍】把网关返回的可查询 task_id 回填到当前任务记录（前端 task_id 主键）。
  // 刷新网页后恢复轮询（pollTask.js）能靠它查 /api/v1/gateway/task/{id} 继续拿结果。
  setTaskPollId(getCurrentTaskId(), taskId)

  const pollUrl = buildTargetUrl(provider, `tasks/${taskId}`)
  const start = Date.now()
  let _polls = 0 // 【B层】轮询次数
  while (Date.now() - start < timeoutMs) {
    _polls++
    await new Promise((r) => setTimeout(r, pollInterval))
    if (signal?.aborted) {
      const err = new Error('Aborted')
      err.name = 'AbortError'
      throw err
    }
    try {
      const pr = await __proxyFetch({ provider, target: pollUrl, method: 'GET' }, signal)
      const pj = await pr.json()
      const pd = pj?.data ?? pj
      const url = extractUrl({ data: pd, json: pj })
      if (url) {
        // 【B层】轮询拿到结果：次数 + 耗时
        logger.debug('生成', '[异步] 拿到结果', { taskId, polls: _polls, elapsedMs: Date.now() - start, urlHead: String(url).slice(0, 80) }, { module: 'image' })
        return ok(url)
      }
      if (pd?.status === 'failed' || pd?.status === 'error') {
        logger.debug('生成', '[异步] 上游失败', { taskId, polls: _polls, elapsedMs: Date.now() - start, err: pd?.error?.message || pd?.error }, { module: 'image' })
        return fail(pd?.error?.message || pd?.error || '上游任务失败')
      }
      onProgress?.(30 + Math.min(60, Math.round((Date.now() - start) / pollInterval) * 10), '上游生成中…')
    } catch (e) {
      if (e?.name === 'AbortError') throw e // 取消：原样抛出
      const c = classifyError(e)
      return c.type === 'network' ? fail(c.message) : fail(`轮询失败：${c.message || '轮询异常'}`)
    }
  }
  logger.debug('生成', '[异步] 轮询超时', { taskId, polls: _polls, elapsedMs: Date.now() - start }, { module: 'image' })
  return fail('轮询超时')
}

// ── 语义化 facade（对外契约，调用方零改动）────────────────────────────

/** 提取图片 url（兼容 image 提交直返 / 轮询结果：result.images[].url 可能是数组）。 */
function extractImageUrl({ data, json }) {
  const raw = data?.result?.images?.[0]?.url ?? data?.results?.[0]?.url ?? json?.result?.images?.[0]?.url ?? json?.results?.[0]?.url
  return raw ? (Array.isArray(raw) ? raw[0] : raw) : undefined
}

/** 提取视频 url（兼容视频提交直返 / 轮询结果：result.videos[].url）。 */
function extractVideoUrl({ data, json }) {
  return data?.result?.videos?.[0]?.url || data?.results?.[0]?.url || json?.result?.videos?.[0]?.url || json?.results?.[0]?.url
}

/**
 * 聊天代理 —— 契约是「信封，永不抛错」。
 * HTTP 非 2xx 属业务错误（取上游嵌套 message），网络/AbortError 才是异常分支；
 * 故不走 __proxyFetch（它对 HTTP 抛错，会给业务错误误加「网络错误」前缀）。
 * @returns {{ ok:boolean, content?:string, error?:string, aborted?:boolean }}
 */
export async function chatProxy({ provider, body, signal }) {
  // 请求形态：responses 走 /v1/responses 端点 + output[] 解析；默认 chat/completions（M2-2）
  const responses = resolveChatMode(provider?.chat_request_mode, body?.model) === 'responses'
  const target = buildTargetUrl(provider, responses ? 'responses' : 'chat/completions')
  const payload = __buildProxyPayload({ provider, target, method: 'POST', body })
  // 【出口回收】走 /api/proxy 经 httpRequest 出站。LLM 生成较慢，正常不走 httpClient 默认 15s 掐断；
  // 但也不能无限挂起（否则剧本盒第三步生成动画永远停不下来），故包 withTimeout 设 2 分钟总超时：
  // 超时后 abort 内部 controller + 返回「生成超时」，上层据此复位 loading。
  // parseJson:false 拿原始 Response 读完整 JSON；retries:0（业务语义不重试），维持「信封永不抛错」契约。
  const internalCtrl = new AbortController()
  const onExternalAbort = () => internalCtrl.abort()
  if (signal?.aborted) return { ok: false, aborted: true, error: '已停止' }
  signal?.addEventListener?.('abort', onExternalAbort)
  let res
  try {
    res = await withTimeout(
      httpRequest(`${API_BASE}/api/proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: internalCtrl.signal,
        timeoutMs: 0,
        retries: 0,
        parseJson: false,
        label: 'chatProxy',
      }),
      CHAT_TIMEOUT,
      `生成超时（超过 ${Math.round(CHAT_TIMEOUT / 1000)} 秒未返回）`,
      internalCtrl.signal,
    )
  } catch (e) {
    if (e?.name === 'AbortError') {
      // 底层请求被中止（外部 signal 取消 / 内部超时 abort）：统一视为「未完成/已停止」
      return { ok: false, aborted: true, error: '已停止' }
    }
    if (e?.name === 'TimeoutError' || isTimeoutError(e)) {
      // withTimeout 达到 2 分钟总超时：返回明确错误，上层据此复位 loading、停止动画
      return { ok: false, error: '生成超时' }
    }
    if (e?.name === 'HttpError') {
      // 业务错误（HTTP 非 2xx）：取上游嵌套 message（HttpError 已带错误体），不误加「网络错误」前缀
      const msg = parseNestedError(e?.data || {}) || `HTTP ${e.status}`
      return { ok: false, error: msg }
    }
    return { ok: false, error: `网络错误：${e.message}` }
  } finally {
    signal?.removeEventListener?.('abort', onExternalAbort)
  }
  let json
  try {
    json = await res.json()
  } catch {
    return { ok: false, error: `响应解析失败 (HTTP ${res.status})` }
  }
  if (!res.ok) {
    const msg = parseNestedError(json) || `HTTP ${res.status}`
    return { ok: false, error: msg }
  }
  if (responses) {
    const content = parseResponsesChatJson(json || {}).content
    if (typeof content === 'string' && content.trim()) return { ok: true, content }
    return { ok: false, error: '上游未返回文本内容' }
  }
  const content = (json?.data ?? json)?.choices?.[0]?.message?.content
  if (typeof content === 'string' && content.trim()) return { ok: true, content }
  return { ok: false, error: '上游未返回文本内容' }
}

function parseNestedError(j) {
  return j?.error?.message || j?.message || j?.detail || ''
}

/**
 * 生图代理 —— SSE 同步（默认）或 async 轮询（provider.image_mode==='async'）。失败抛错由调用方兜底。
 * @returns {{ ok:boolean, url?:string, error?:string }}
 */
export async function imageProxy({ provider, genBody, onProgress, signal }) {
  const mode = provider?.image_request_mode

  // responses 形态：POST /v1/responses，非流式 JSON 直返 → 从 output[] / markdown 兜底提取图片 URL。
  if (isResponsesMode(mode)) {
    const url = buildTargetUrl(provider, imageModePath(mode))
    try {
      onProgress?.(10, '正在连接本地服务…')
      const res = await __proxyFetch({ provider, target: url, method: 'POST', body: genBody }, signal)
      onProgress?.(20, '已转发到生成网关…')
      const imgUrl = parseResponsesJson(await res.json())
      return imgUrl ? ok(imgUrl) : fail('上游未返回图片')
    } catch (e) {
      if (e?.name === 'AbortError') throw e // 取消信号：原样抛出
      const c = classifyError(e)
      return c.type === 'network' ? fail(c.message) : fail(`生图失败：${c.message || 'responses 请求异常'}`)
    }
  }

  // 其余形态（openai / openai-json / 默认）：端点由形态决定（默认 images/generations，C1 零改动）。
  const url = buildTargetUrl(provider, imageModePath(mode))
  if (provider?.image_mode === 'async') {
    return pollUntilDone(
      { provider, url, genBody, extractUrl: extractImageUrl, pollInterval: GEN_POLL_INTERVAL, timeoutMs: GEN_TIMEOUT },
      onProgress,
      signal,
    )
  }
  // 同步：URL 带 ?wait=1，读 SSE 流拿图片 url。
  let waitUrl = url
  try {
    const u = new URL(url)
    u.searchParams.set('wait', '1')
    waitUrl = u.toString()
  } catch { /* 解析失败则原样 */ }
  try {
    onProgress?.(10, '正在连接本地服务…')
    const res = await __proxyFetch({ provider, target: waitUrl, method: 'POST', body: genBody }, signal)
    onProgress?.(20, '已转发到生成网关…')
    // 同步 SSE 生图也带总超时（GEN_TIMEOUT=5min）：SSE 流若不结束会永久挂起（readSseUrl 无自身超时），
    // 超时 abort 内部 signal + 抛 TimeoutError，上层据此复位 loading、停止动画。
    const imgUrl = await withTimeout(readSseUrl(res, onProgress, signal), GEN_TIMEOUT, `生图超时（超过 ${Math.round(GEN_TIMEOUT / 1000)} 秒未返回）`)
    return imgUrl ? ok(imgUrl) : fail('上游未返回图片')
  } catch (e) {
    if (e?.name === 'AbortError') throw e // 取消信号：原样抛出，由调用方处理
    if (e?.name === 'TimeoutError' || isTimeoutError(e)) return fail('生图超时')
    const c = classifyError(e)
    return c.type === 'network' ? fail(c.message) : fail(`生图失败：${c.message || '同步请求异常'}`)
  }
}

/**
 * 视频代理 —— 强制 async 轮询（视频比生图慢很多，不适合 SSE 同步等待）。失败抛错由调用方兜底。
 * @returns {{ ok:boolean, url?:string, error?:string }}
 */
export async function videoProxy({ provider, genBody, onProgress, signal }) {
  const url = buildTargetUrl(provider, 'videos/generations')
  // 【B层】视频代理开始：prompt 摘要 + 目标（定位视频提交是否进入轮询）
  logger.debug('视频', '[视频] 开始', { prompt: String(genBody?.prompt || '').slice(0, 100), model: genBody?.model, size: genBody?.size, refCount: (genBody?.image_urls || []).length, taskId: getCurrentTaskId() }, { module: 'image' })
  return pollUntilDone(
    { provider, url, genBody, extractUrl: extractVideoUrl, pollInterval: VIDEO_POLL_INTERVAL, timeoutMs: VIDEO_TIMEOUT },
    onProgress,
    signal,
  )
}
