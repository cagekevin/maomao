import { useCallback, useRef, useState, useEffect } from 'react'
import { reportGenerate, registerTaskRetry, unregisterTaskRetry, setCurrentTaskId } from './taskStore.js'
import { saveResultToTasks } from './filesApi.js'
import { logger } from './logger.js'
import { subscribe } from './eventBus.js'
import { showToast } from './toastStore.js'

/**
 * ════════════════════════════════════════════════════════════════
 * 统一「节点生成」契约（useNodeGeneration）—— P0 架构级
 * ════════════════════════════════════════════════════════════════
 *
 * 【为什么要有它（架构评审核心发现）】
 * 此前每个生成节点的 handleGenerate 都手写同一套样板：
 *   解析 provider → reportGenerate → taskCtl.progress → 调 API
 *   → 成功写 node.data + taskCtl.done / 失败 setError + taskCtl.fail
 *   → registerTaskRetry 注册「再来一次」
 * PromptNode / TextNode / DiscountVideoNode 各重复约 40 行，
 * 且 Agent 的 generate_node 工具是死桩（没接真实生成）。
 * 未来 28 个节点逐个接真引擎时，若没有统一契约，每个节点都要重复踩一遍坑，
 * 还容易「任务中心有结果、节点卡片没结果」或反之的不一致。
 *
 * 【它收敛什么】
 *  - 统一「提交任务 → 进度 → 成功双写(taskStore + node.data) / 失败」契约
 *  - 统一「再来一次」retry 注册
 *  - Agent / 测试 / 脚本通过 runNodeGeneration(nodeId) 驱动任意节点生成
 *
 * 【用法】
 *   const gen = useNodeGeneration({
 *     nodeId: id,
 *     type: { type: 'image', prompt: p, modelName: modelId },  // 任务上报信息
 *     validate: () => (p.trim() ? '' : '请输入提示词'),          // 前置校验，返回错误文案或空串
 *     run: async ({ progress }) => generateImage({...}, progress),  // 真执行器
 *     onSuccess: (r, ctx) => { setImageUrl(r.url); setImgPrefs({...}); },  // 成功回写 node.data
 *   })
 *   // gen = { loading, error, start, stop }
 *
 * 【run 返回契约】
 *   { ok: true, url?, content?, doneUrl? }  → 成功（url/content 给 onSuccess 回写；
 *                                               doneUrl 优先作为任务中心 resultUrl）
 *   { ok: false, error: '原因' }            → 失败（自动 setError + taskCtl.fail）
 *
 * 【中止说明】
 *   stop() 目前只清 loading/error，不中断网络请求（真 API 的中断需 AbortController，
 *   待接真引擎时在 run 内用 AbortSignal 实现，start/stop 对外接口不变）。
 */
export function useNodeGeneration({ nodeId, type, validate, run, onSuccess, onRecover }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // AbortController：stop() 真中断请求（Step C）。run 执行器接收 signal 并传给底层 API（Step A 已支持）。
  const abortRef = useRef(null)
  // 【R4 防重入】同步 runningRef 原子防重：start 入口立即置位、finally 复位。
  // 旧实现用闭包 `loading`（重渲染后才更新），快速双击时第二次仍读到旧 false → 并发生图。
  // ref 同步更新，第二次 start 立即被拒，根治并发浪费（TASK-016 #6）。
  const runningRef = useRef(false)

  const runRef = useRef(run)
  runRef.current = run
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  const onRecoverRef = useRef(onRecover)
  onRecoverRef.current = onRecover
  const validateRef = useRef(validate)
  validateRef.current = validate
  const typeRef = useRef(type)
  typeRef.current = type

  const start = useCallback(async () => {
    // 【R4 防重入】同步 runningRef 原子防重（比闭包 loading 可靠，第二次立即被拒）
    if (loading || runningRef.current) return false
    runningRef.current = true
    const v = validateRef.current?.()
    if (v) { setError(v); runningRef.current = false; return false }

    setLoading(true)
    setError('')
    // 每次 start 重建 AbortController（旧请求先取消，避免并发）
    abortRef.current?.abort()
    const ctl = new AbortController()
    abortRef.current = ctl
    const t = typeRef.current || {}
    const taskCtl = reportGenerate(nodeId, t.type, t.prompt, { modelName: t.modelName })
    // 把前端 task_id 设为「当前任务」，供 proxyRequest 加 X-Task-Id header 贯穿链路（关联 Lovart thread_id）
    setCurrentTaskId(taskCtl.taskId || '')
    taskCtl.progress(5, '准备中…')
    logger.info('生成', 'start', { nodeId, type: t.type, prompt: t.prompt })
    // 【B层】节点生成入口：prompt 摘要 + 节点类型（定位是哪个节点、发的什么提示词触发生图）
    logger.debug('生成', '[节点] start', { nodeId, type: t.type, prompt: String(t.prompt || '').slice(0, 120), modelName: t.modelName }, { module: 'image' })
    try {
      // signal 传给 run 执行器（各节点可透传给 generateImage/generateVideo 实现真取消）
      const r = await runRef.current({ progress: (p, stage) => taskCtl.progress(p, stage), signal: ctl.signal })
      // 【B层】run 执行器返回：ok + url（定位生成契约是否拿到结果）
      logger.debug('生成', '[节点] run返回', { nodeId, ok: r?.ok, urlHead: r?.url ? String(r.url).slice(0, 80) : '', error: r?.error || '' }, { module: 'image' })
      if (r?.ok) {
        onSuccessRef.current?.(r, taskCtl)
        // 防御：done 只接收字符串结果 URL（上游偶发返回对象会触发 taskStore.done 的 .startsWith 崩）
        const rawUrl = r.doneUrl || r.url
        taskCtl.done(typeof rawUrl === 'string' ? rawUrl : '')
        logger.info('生成', 'success', { nodeId, type: t.type })
        // 【异步执行器地基】start 返回已落盘的持久 URL，供 AI 助手的 generate_node /
        // 前序依赖 / 多图编排拿到结果（图生成完成即落盘到 uploads/tasks/，url 稳定可复用）。
        // 落盘失败（saveResultToTasks 返回 null）回退上游原始 url。
        if (typeof rawUrl === 'string' && rawUrl) {
          const persistedUrl = await saveResultToTasks(rawUrl, t.type).catch(() => null)
          // 【B层】结果落盘：持久 URL 是否成功（定位刷新后图片是否可恢复）
          logger.debug('生成', '[节点] 落盘', { nodeId, persisted: !!persistedUrl, urlHead: (persistedUrl || rawUrl).slice(0, 80) }, { module: 'image' })
          return { ok: true, resultUrl: persistedUrl || rawUrl }
        }
        return { ok: true, resultUrl: '' }
      } else {
        const msg = r?.error || '生成失败'
        setError(msg)
        taskCtl.fail(msg)
        // 生成失败：统一 logger + 全局 toast（节点内红字易忽略；logger 供全链路排查）
        logger.error('生成', 'fail', { nodeId, type: t.type, prompt: t.prompt, error: msg })
        showToast(msg, { type: 'error' })
        return { ok: false, error: msg }
      }
    } catch (e) {
      if (e?.name === 'AbortError') {
        // 用户停止：不报错，返回取消标记，由调用方处理
        logger.debug('生成', '[节点] 用户停止', { nodeId }, { module: 'image' })
        setError('')
        taskCtl.fail('已停止')
        return { ok: false, error: '已停止', aborted: true }
      }
      logger.error('useNodeGeneration', '生成异常', e?.message)
      const msg = e?.message || '生成失败'
      setError(msg)
      taskCtl.fail(msg)
      // 生成异常：统一 logger + 全局 toast（用户主动停止 AbortError 除外）
      logger.error('生成', 'fail', { nodeId, type: t.type, prompt: t.prompt, error: msg })
      showToast(msg, { type: 'error' })
      return { ok: false, error: msg }
    } finally {
      setLoading(false)
      runningRef.current = false // 【R4】原子防重复位
    }
  }, [loading, nodeId])

  // stop：真中断底层请求（Step C）。请求经 signal 传到 imageApi/videoApi，abort 后 fetch/轮询中断。
  const stop = useCallback(() => {
    abortRef.current?.abort()
    setLoading(false)
  }, [])

  // 「再来一次」注册：让任务中心重试 / Agent generate_node 能驱动本节点
  const startRef = useRef(start)
  startRef.current = start
  useEffect(() => {
    if (!nodeId) return
    registerTaskRetry(nodeId, () => startRef.current())
    return () => unregisterTaskRetry(nodeId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId])

  // 【精准节点回填】监听异步任务恢复轮询的完成广播（taskStore/pollTask 发 agent:task-completed，经 eventBus）。
  // 只有「任务归属的节点」（detail.nodeId === 本 nodeId）才响应 → 精准：其他在跑的/不相关的节点忽略。
  // 收到后回调 onRecover(detail)，由各节点把 resultUrl 写回 node.data（刷新后节点卡片自动恢复显示结果）。
  // 用 ref 存最新 onRecover，监听只在挂载时注册一次，避免每次渲染重建。
  useEffect(() => {
    if (!nodeId) return
    const handler = (d) => {
      if (!d) return
      // 只认本节点 + 已完成 + 有结果 URL 的广播，其余忽略（精准）
      if (d.nodeId !== nodeId) return
      if (d.status !== 'completed' || !d.resultUrl) return
      onRecoverRef.current?.(d)
    }
    return subscribe('agent:task-completed', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId])

  return { loading, error, start, stop }
}
