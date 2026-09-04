import { useCallback, useRef, useEffect } from 'react'
import type { GenerationResult } from '@/types'
import {
  reportGenerate,
  registerTaskRetry,
  unregisterTaskRetry,
  claimNodeRun,
  releaseNodeRun,
} from '../components/base/store/taskStore.ts'
import { updateNodeRuntime, useNodeRuntime } from '../components/base/store/nodeRuntimeStore.ts'
import type { TaskController, NodeRunClaim } from '../components/base/store/taskStore.ts'
import { saveResultToTasks } from '../components/base/api/index.ts'
import { logger } from '../components/base/core/logger.ts'
import { subscribe } from '../components/base/core/eventBus.ts'
import { showToast } from '../components/base/core/toastStore.ts'
import { useNodeData } from './useNodeData.ts'
import { classifyError } from '../components/base/utils/genErrors.ts'
import { reportDegrade } from '../components/base/core/degrade.ts'

/**
 * 任务控制器：直接复用 taskStore 的权威定义（taskStore 已转 .ts，不再各写一份）。
 * 重新导出以保留本文件原有的对外导出面，调用方无需改动。
 */
export type { TaskController } from '../components/base/store/taskStore.ts'

/** 任务上报信息（节点类型 / 提示词 / 模型名） */
export interface GenerationTypeInfo {
  type: string
  prompt?: string
  modelName?: string
}

/** 传给 run 执行器的参数 */
export interface NodeGenerationRunArgs {
  progress: (percent: number, stage?: string) => void
  signal: AbortSignal
  taskId: string
}

/** run 执行器返回的结果信封 —— 别名对齐 GenerationResult（单一真源 src/types/provider.ts，L3c，禁另立 interface） */
export type NodeGenerationResult = GenerationResult

/** start() 的返回值（成功 / 失败 / 中止 / 并发在跑） */
export interface NodeGenerationStartResult {
  ok: boolean
  resultUrl?: string
  error?: string
  aborted?: boolean
  inFlight?: boolean
}

/** onRecover 收到的广播详情（agent:task-completed 载荷子集） */
export interface TaskCompletedDetail {
  taskId?: string
  nodeId?: string
  resultUrl?: string
  type?: string
  status?: string
}

/** validate() → 错误文案或空串 */
export type GenerationValidate = () => string | undefined | null
/** run(args) → 结果信封 */
export type GenerationRunner = (args: NodeGenerationRunArgs) => Promise<NodeGenerationResult | undefined>
export type GenerationOnSuccess = (result: NodeGenerationResult, taskCtl: TaskController) => void
export type GenerationOnRecover = (detail: TaskCompletedDetail) => void

export interface UseNodeGenerationOptions {
  nodeId: string
  /** 任务上报信息 */
  type: GenerationTypeInfo
  validate?: GenerationValidate
  run?: GenerationRunner
  onSuccess?: GenerationOnSuccess
  onRecover?: GenerationOnRecover
  /** 声明后成功时自动 patchData({ [resultKey]: url })，省去 onSuccess 手写写回 */
  resultKey?: string
  /** 声明后收到 task-completed 自动回填 node.data[resultKey] */
  recoverable?: boolean
}

export interface NodeGenerationApi {
  loading: boolean
  error: string
  start: () => Promise<NodeGenerationStartResult | boolean>
  stop: () => void
}

// 日志里的提示词只保留前 80 字：剧本盒子等场景的镜头提示词动辄上千字，
// 全量打进 localTool 终端会淹没其它全链路日志。完整原文仍可在节点 data /
// 任务中心（reportGenerate 上报）查到，日志侧只留可定位的摘要。
const LOG_PROMPT_MAX = 80
function promptPreview(p: string | undefined): string {
  const s = typeof p === 'string' ? p : String(p || '')
  return s.length > LOG_PROMPT_MAX ? `${s.slice(0, LOG_PROMPT_MAX)}…` : s
}

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
 * 【真相源契约（节点必守，P0）】任务中心为结果权威源，node.data 为渲染缓存副本：
 *  1. onSuccess 必须把结果写回 node.data（如 patchData({ imageUrl: r.url })），
 *     否则刷新后节点因 data 无持久 URL 而丢结果（结果只在任务中心）。
 *     对照样板：PromptNode / DiscountVideoNode.onSuccess 写 data.imageUrl / data.videoUrl。
 *  2. 异步可恢复的节点必须声明 onRecover（见下），收到 agent:task-completed 广播
 *     把持久 resultUrl 写回 node.data，刷新后自动恢复显示。
 *  3. 文本类节点（结果本体在 data.text、任务中心 resultUrl 为空）不适用 onRecover，
 *     由 data.text 随画布快照落盘恢复，无需传此回调。
 *  4. 方向单向：写只走本契约，刷新后任务中心 → 节点回填，节点不回写任务中心。
 *
 * 【瞬态收口·阶段二】loading/error（瞬态）归 nodeRuntimeStore（按 nodeId 内存 Map），
 *   不入 node.data / 画布快照 → 复制节点天然隔离，杜绝「半个 loading 被复制走」。
 *   本 hook 直接经 useNodeRuntime 读、updateNodeRuntime 写，对外接口 { loading, error }
 *   不变，各生成节点遮罩读取几乎不动；进度仍经 taskCtl.progress 走任务中心。
 *
 * 【用法】
 *   const gen = useNodeGeneration({
 *     nodeId: id,
 *     type: { type: 'image', prompt: p, modelName: modelId },  // 任务上报信息
 *     validate: () => (p.trim() ? '' : '请输入提示词'),          // 前置校验，返回错误文案或空串
 *     run: async ({ progress }) => generateImage({...}, progress),  // 真执行器
 *     onSuccess: (r, ctx) => { setImageUrl(r.url); setImgPrefs({...}); },  // 成功回写 node.data
 *     onRecover: ({ resultUrl }) => { setImageUrl(resultUrl); patchData({ imageUrl: resultUrl }) },  // 广播回填（异步可恢复节点必传）
 *     // ── P0-2-b 声明式写法（推荐，省去手写「写回 node.data」样板）──
 *     resultKey: 'imageUrl',   // 声明后成功时自动 patchData({[resultKey]: r.url})
 *     recoverable: true,       // 声明后收到 task-completed 自动回填 patchData({[resultKey]: resultUrl})
 *     // 声明了 resultKey/recoverable 即可省略 onSuccess 与 onRecover 里的写 node.data 部分、
 *     // 但 onSuccess 中 UI state 回写（如 setImageUrl）与业务逻辑仍需保留。
 *     // 文本类节点（结果在 data.text、任务中心 resultUrl 为空）不传 recoverable。如 onRecover 不适用此自动回填，可省略。
 *     // 注意：onRecover/onSuccess 与声明式并存时，若都写了同一字段会幂等双写（无害）。
 *   })
 *   // gen = { loading, error, start, stop }
 *
 * 【run 返回契约】
 *   { ok: true, url?, content? }            → 成功（url/content 给 onSuccess 回写与 node.data
 *                                              任务中心 resultUrl；doneUrl 悬空契约已删，统一用 r.url（B2））
 *   { ok: false, error: '原因' }            → 失败（自动 setError + taskCtl.fail）
 *
 * 【中止说明】
 *   stop() 目前只清 loading/error，不中断网络请求（真 API 的中断需 AbortController，
 *   待接真引擎时在 run 内用 AbortSignal 实现，start/stop 对外接口不变）。
 */
export function useNodeGeneration({
  nodeId,
  type,
  validate,
  run,
  onSuccess,
  onRecover,
  resultKey,
  recoverable,
}: UseNodeGenerationOptions): NodeGenerationApi {
  // P0-2-b：声明 resultKey/recoverable 后可省去节点手写「写回 node.data」样板（经 useNodeData 统一 patchData）
  const { patchData } = useNodeData(nodeId)
  const resultKeyRef = useRef<string | undefined>(resultKey)
  resultKeyRef.current = resultKey
  const recoverableRef = useRef(!!recoverable)
  recoverableRef.current = !!recoverable
  // 【瞬态收口·阶段二】loading/error 统一归 nodeRuntimeStore（内存级，按 nodeId 键，
  // 复制天然隔离）。对外接口不变：本 hook 仍返回 { loading, error }，节点代码几乎不动。
  const { loading, error } = useNodeRuntime(nodeId)
  // AbortController：stop() 真中断请求（Step C）。run 执行器接收 signal 并传给底层 API（Step A 已支持）。
  const abortRef = useRef<AbortController | null>(null)
  // 【R4 防重入】同步 runningRef 原子防重：start 入口立即置位、finally 复位。
  // 旧实现用闭包 `loading`（重渲染后才更新），快速双击时第二次仍读到旧 false → 并发生图。
  // ref 同步更新，第二次 start 立即被拒，根治并发浪费（TASK-016 #6）。
  const runningRef = useRef(false)

  const runRef = useRef<GenerationRunner | undefined>(run)
  runRef.current = run
  const onSuccessRef = useRef<GenerationOnSuccess | undefined>(onSuccess)
  onSuccessRef.current = onSuccess
  const onRecoverRef = useRef<GenerationOnRecover | undefined>(onRecover)
  onRecoverRef.current = onRecover
  const validateRef = useRef<GenerationValidate | undefined>(validate)
  validateRef.current = validate
  const typeRef = useRef<GenerationTypeInfo>(type)
  typeRef.current = type

  const start = useCallback(async (): Promise<NodeGenerationStartResult | boolean> => {
    // 【P1-E 跨发起方并发锁】先占单节点互斥锁（taskStore 层，任何发起方都经本 start 汇聚）。
    // 同节点已有进行中（Agent runNodeGeneration / 用户手动 / 再来一次）→ 明确返回「进行中」，不并发生成。
    const claim: NodeRunClaim = claimNodeRun(nodeId)
    if (!claim.ok) {
      logger.debug('生成', '[节点] 已在生成，跳过并发', { nodeId }, { module: 'image' })
      return { ok: false, inFlight: true }
    }
    // 【R4 防重入】同步 runningRef 原子防重（比闭包 loading 可靠，第二次立即被拒）
    if (loading || runningRef.current) { releaseNodeRun(nodeId); return false }
    runningRef.current = true
    const v = validateRef.current?.()
    if (v) { updateNodeRuntime(nodeId, { error: v }); runningRef.current = false; releaseNodeRun(nodeId); return false }

    updateNodeRuntime(nodeId, { loading: true, error: '' })
    // 每次 start 重建 AbortController（旧请求先取消，避免并发）
    abortRef.current?.abort()
    const ctl = new AbortController()
    abortRef.current = ctl
    // 缺省兜底用完整形状而非 `|| {}`，否则 t 退化为 `{}`、取 t.type/t.prompt 会报属性不存在
    const t: GenerationTypeInfo = typeRef.current || { type: '', prompt: '', modelName: '' }
    const taskCtl: TaskController = reportGenerate(nodeId, t.type, t.prompt, { modelName: t.modelName })
    taskCtl.progress(5, '准备中…')
    logger.info('生成', 'start', { nodeId, type: t.type, prompt: promptPreview(t.prompt) })
    // 【B层】节点生成入口：prompt 摘要 + 节点类型（定位是哪个节点、发的什么提示词触发生图）
    logger.debug('生成', '[节点] start', { nodeId, type: t.type, prompt: String(t.prompt || '').slice(0, 120), modelName: t.modelName }, { module: 'image' })
    try {
      // signal/taskId 传给 run 执行器（P0-A：taskId 请求级贯穿，节点透传给 generateImage/generateVideo opts）
      const r = await runRef.current({
        progress: (p, stage) => taskCtl.progress(p, stage),
        signal: ctl.signal,
        taskId: taskCtl.taskId || '',
      })
      // 【B层】run 执行器返回：ok + url（定位生成契约是否拿到结果）
      logger.debug('生成', '[节点] run返回', { nodeId, ok: r?.ok, urlHead: r?.url ? String(r.url).slice(0, 80) : '', error: r?.error || '' }, { module: 'image' })
      if (r?.ok) {
        // P0-2-b：声明 resultKey 后自动写回 node.data，省去各节点在 onSuccess 里手写 patchData({[xxx]: url})
        const resultKey = resultKeyRef.current
        const autoUrl = resultKey && r.url
        if (autoUrl) patchData({ [resultKey]: autoUrl })
        onSuccessRef.current?.(r, taskCtl)
        // 防御：done 只接收字符串结果 URL（B2：doneUrl 悬空契约已删，统一用 r.url；上游偶发返回对象会触发 .startsWith 崩）
        const rawUrl = r.url
        const strUrl = typeof rawUrl === 'string' ? rawUrl : ''
        // 【P0-C 单向落盘】落盘唯一出口在此：先落盘得持久 URL，再 done(persistedUrl) 回填最终 url（done 不再落盘）。
        // 落盘失败（saveResultToTasks 返回 null）回退上游原始 url。
        // 【失败可见】落盘失败不得静默吞掉：统一经 reportDegrade 留痕（logger.warn，全链路可查），
        //   但保留 P0-C 回退语义（persistedUrl || strUrl），不因落盘失败把整体生成判为失败。
        const persistedUrl = strUrl
          ? await saveResultToTasks(strUrl, t.type).catch((e) => {
              reportDegrade({ layer: 'useNodeGeneration', key: 'saveResultToTasks', e })
              return null
            })
          : null
        const finalUrl = persistedUrl || strUrl
        // 【S3 落盘唯一出口】resultKey 自动写回(L235)用的是原始 r.url；落盘拿到持久 URL 后，
        // 必须再覆盖写回 node.data[resultKey]，否则节点存的是会过期的外链而非 /files/ 持久 URL
        // (此前各节点在 onSuccess 里各自二次 saveResultToTasks 补这个洞 → 双落盘)。统一在此补。
        // 仅当落盘成功且持久 URL 与原始 URL 不同才覆盖(避免无谓写 + 幂等)；patchData 经 useSyncNodeData
        // 同步回节点本地 state，节点无需再手动二次落盘。
        if (resultKey && persistedUrl && persistedUrl !== strUrl) {
          patchData({ [resultKey]: persistedUrl })
        }
        taskCtl.done(finalUrl)
        logger.debug('生成', '[节点] 落盘', { nodeId, persisted: !!persistedUrl, urlHead: finalUrl.slice(0, 80) }, { module: 'image' })
        logger.info('生成', 'success', { nodeId, type: t.type })
        return { ok: true, resultUrl: finalUrl }
      } else {
        const msg = r?.error || '生成失败'
        // 【R7 错误分类记录】run 返回 { ok:false } 是契约业务失败（message 为字符串），
        // classifyError 归 business（非网络/超时，不自动重试）——分类结果记录进日志，供全链路排查。
        const cls = classifyError(msg)
        updateNodeRuntime(nodeId, { error: msg })
        taskCtl.fail(msg)
        // 生成失败：统一 logger + 全局 toast（节点内红字易忽略；logger 供全链路排查）
        logger.error('生成', 'fail', { nodeId, type: t.type, prompt: promptPreview(t.prompt), error: msg, errType: cls.type, retryable: cls.retryable })
        showToast(msg, { type: 'error' })
        return { ok: false, error: msg }
      }
    } catch (e) {
      // 【L3c】判定统一走 classifyError（唯一入口）：新判据是原 `e?.name === 'AbortError'` 的超集
      // （新增 err?.aborted 覆盖），只可能多判 abort、不可能少判 → 零回归。align :273/:293 同文件口径。
      if (classifyError(e).type === 'abort') {
        // 用户停止：不报错，返回取消标记，由调用方处理
        logger.debug('生成', '[节点] 用户停止', { nodeId }, { module: 'image' })
        updateNodeRuntime(nodeId, { error: '' })
        taskCtl.fail('已停止')
        return { ok: false, error: '已停止', aborted: true }
      }
      logger.error('useNodeGeneration', '生成异常', e?.message)
      const msg = e?.message || '生成失败'
      // 【R7 错误分类记录】异常对象经 classifyError 统一分类（abort/timeout/network/http/business），
      // 分类结果记录进日志：网络/超时（retryable）供「再来一次/自动重试」决策，业务失败不自动重试（防封号）。
      const cls = classifyError(e)
      updateNodeRuntime(nodeId, { error: msg })
      taskCtl.fail(msg)
      // 生成异常：统一 logger + 全局 toast（用户主动停止 AbortError 除外）
      logger.error('生成', 'fail', { nodeId, type: t.type, prompt: promptPreview(t.prompt), error: msg, errType: cls.type, retryable: cls.retryable })
      showToast(msg, { type: 'error' })
      return { ok: false, error: msg }
    } finally {
      updateNodeRuntime(nodeId, { loading: false })
      runningRef.current = false // 【R4】原子防重复位
      releaseNodeRun(nodeId) // 【P1-E】释放单节点互斥锁
    }
  }, [loading, nodeId])

  // stop：真中断底层请求（Step C）。请求经 signal 传到 imageApi/videoApi，abort 后 fetch/轮询中断。
  const stop = useCallback(() => {
    abortRef.current?.abort()
    updateNodeRuntime(nodeId, { loading: false })
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
    const handler = (payload: unknown) => {
      const d = payload as TaskCompletedDetail | undefined
      if (!d) return
      // 只认本节点 + 已完成 + 有结果 URL 的广播，其余忽略（精准）
      if (d.nodeId !== nodeId) return
      if (d.status !== 'completed' || !d.resultUrl) return
      // P0-2-b：声明 recoverable + resultKey 后自动回填 node.data[resultKey]，省去 onRecover 手写写回样板
      if (recoverableRef.current) {
        const resultKey = resultKeyRef.current
        if (resultKey) patchData({ [resultKey]: d.resultUrl })
      }
      onRecoverRef.current?.(d)
    }
    return subscribe('agent:task-completed', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId])

  return { loading, error, start, stop }
}
