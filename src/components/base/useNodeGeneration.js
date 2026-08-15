import { useCallback, useRef, useState, useEffect } from 'react'
import { reportGenerate, registerTaskRetry, unregisterTaskRetry, setCurrentTaskId } from './taskStore.js'
import { logger } from './logger.js'

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
 * 且 Agent 的 trigger_generation 工具是死桩（没接真实生成）。
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
    if (loading) return false
    const v = validateRef.current?.()
    if (v) { setError(v); return false }

    setLoading(true)
    setError('')
    const t = typeRef.current || {}
    const taskCtl = reportGenerate(nodeId, t.type, t.prompt, { modelName: t.modelName })
    // 把前端 task_id 设为「当前任务」，供 proxyRequest 加 X-Task-Id header 贯穿链路（关联 Lovart thread_id）
    setCurrentTaskId(taskCtl.taskId || '')
    taskCtl.progress(5, '准备中…')
    logger.info('生成', 'start', { nodeId, type: t.type, prompt: t.prompt })
    try {
      const r = await runRef.current({ progress: (p, stage) => taskCtl.progress(p, stage) })
      if (r?.ok) {
        onSuccessRef.current?.(r, taskCtl)
        // 防御：done 只接收字符串结果 URL（上游偶发返回对象会触发 taskStore.done 的 .startsWith 崩）
        const rawUrl = r.doneUrl || r.url
        taskCtl.done(typeof rawUrl === 'string' ? rawUrl : '')
        logger.info('生成', 'success', { nodeId, type: t.type })
      } else {
        setError(r?.error || '生成失败')
        taskCtl.fail(r?.error || '生成失败')
      }
    } catch (e) {
      console.error('[useNodeGeneration] 生成异常:', e?.message)
      setError(e?.message || '生成失败')
      taskCtl.fail(e?.message || '生成失败')
    } finally {
      setLoading(false)
    }
    return true
  }, [loading, nodeId])

  const stop = useCallback(() => setLoading(false), [])

  // 「再来一次」注册：让任务中心重试 / Agent trigger_generation 能驱动本节点
  const startRef = useRef(start)
  startRef.current = start
  useEffect(() => {
    if (!nodeId) return
    registerTaskRetry(nodeId, () => startRef.current())
    return () => unregisterTaskRetry(nodeId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId])

  // 【精准节点回填】监听异步任务恢复轮询的完成广播（pollTask.js 发 mutiwindow-task-completed）。
  // 只有「任务归属的节点」（detail.nodeId === 本 nodeId）才响应 → 精准：其他在跑的/不相关的节点忽略。
  // 收到后回调 onRecover(detail)，由各节点把 resultUrl 写回 node.data（刷新后节点卡片自动恢复显示结果）。
  // 用 ref 存最新 onRecover，监听只在挂载时注册一次，避免每次渲染重建。
  useEffect(() => {
    if (!nodeId) return
    const handler = (e) => {
      const d = e?.detail
      if (!d) return
      // 只认本节点 + 已完成 + 有结果 URL 的广播，其余忽略（精准）
      if (d.nodeId !== nodeId) return
      if (d.status !== 'completed' || !d.resultUrl) return
      onRecoverRef.current?.(d)
    }
    window.addEventListener('mutiwindow-task-completed', handler)
    return () => window.removeEventListener('mutiwindow-task-completed', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId])

  return { loading, error, start, stop }
}
