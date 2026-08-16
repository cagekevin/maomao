/**
 * ════════════════════════════════════════════════════════════════
 * 工作流运行时（Workflow Runtime）—— 统一管理"一个 AI 工作流"的生命周期
 * ════════════════════════════════════════════════════════════════
 *
 * 【解决什么】见 docs/12。把「任务如何开始/并行/停止/回滚/确认/归属」收拢成一份权威实现，
 * 各模块不再各自为政（loading boolean、模块级变量、手动 await 散落）。
 *
 * 【核心】Workflow 对象 + 生命周期 API：
 *  - status:          idle|planning|running|stopping|stopped|completed|failed|awaiting_confirm
 *  - nodeIds:         本次工作流建的节点（rollback 用）
 *  - steerQueue:      补充指令队列
 *  - awaitingConfirm: Skill 阶段2 确认态（confirm() 翻转）
 *  - aiUndoStack:     AI 撤销栈（绑定本工作流，不模块级）
 *  - cancelTokens:    每个运行中任务的 AbortController（cancel() 真取消）
 *
 * 【纯逻辑、无 React 依赖】画布操作通过注入的 ctx（对齐工具层），可独立单测。
 *
 * 【用法】
 *   const wf = createWorkflow({ conversationId })
 *   wf.start()
 *   const result = await wf.awaitNode(runFn)   // runFn(signal) 可取消
 *   await wf.runParallel(list, async (item, signal) => {...})
 *   wf.cancel()   // 真取消所有运行中任务
 *   wf.pushUndo(snapshot) / wf.popUndo()
 *   wf.confirm()  // 确认策划
 *   wf.rollback(ctx)  // 清理本次建的节点
 * ════════════════════════════════════════════════════════════════
 */
import { publish } from './eventBus.js'

/** 运行中状态集合（对齐 InputStateMachine RUNNING） */
const RUNNING = new Set(['planning', 'creating_nodes', 'ready', 'running'])

/** 创建 AbortError */
function abortError() {
  const e = new Error('Aborted')
  e.name = 'AbortError'
  return e
}

/**
 * 创建一个工作流实例。
 * @param {object} opts
 *  - conversationId: 归属的对话 id（绑定 per-conversation 状态）
 *  - onStatusChange?: (status) => void  状态变化回调（UI 订阅）
 */
export function createWorkflow({ conversationId = '', onStatusChange = null } = {}) {
  let status = 'idle'
  let awaitingConfirm = false
  const nodeIds = []
  const steerQueue = []
  const aiUndoStack = []
  const cancelTokens = new Set()
  const listeners = new Set()

  function setStatus(next) {
    if (status === next) return
    status = next
    onStatusChange?.(status)
    listeners.forEach((l) => l(status))
    // 【预留广播】publish('agent:workflow-status') 是对齐大雄的对外事件广播，供未来非 React 模块订阅。
    // ⚠️ 当前没有 eventBus.subscribe('agent:workflow-status') 的消费方，这不是 bug、不要删！
    //    工作流状态的真正消费走本行上面的 onStatusChange 回调和 wf.subscribe(listeners)（工作流实例内聚）。
    //    若未来要用全局广播，请从 eventBus.subscribe 订阅，避免与 wf.subscribe 两套并存造成混乱。
    publish('agent:workflow-status', { workflowId: wf.id, conversationId, status })
  }

  const wf = {
    conversationId,
    get status() { return status },
    get isRunning() { return RUNNING.has(status) },
    get awaitingConfirm() { return awaitingConfirm },
    get nodeIds() { return [...nodeIds] },
    get steerQueue() { return [...steerQueue] },
    get aiUndoStack() { return [...aiUndoStack] },

    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },

    /** 开始：置 planning/running */
    start(initStatus = 'planning') {
      setStatus(initStatus)
      return wf
    },

    /** 停止请求：置 stopping（真正取消由 cancel() 做） */
    requestStop() {
      setStatus('stopping')
      wf.cancel()
      return wf
    },

    /** 真取消所有运行中任务（abort 每个 AbortController） */
    cancel() {
      cancelTokens.forEach((ctl) => ctl.abort())
      cancelTokens.clear()
      return wf
    },

    /** 结束：completed / failed */
    finish(ok = true) {
      wf.cancel()
      setStatus(ok ? 'completed' : 'failed')
      return wf
    },

    /** Skill 阶段2：进入确认态 */
    requestConfirm() {
      awaitingConfirm = true
      setStatus('awaiting_confirm')
      return wf
    },

    /** 用户确认：退出确认态（仅此翻转；不做语义消息识别） */
    confirm() {
      awaitingConfirm = false
      setStatus('planning') // 确认后回到可执行态
      // 【预留广播】同 agent:workflow-status：当前无 eventBus 订阅方，不是 bug、不要删。
      // 确认动作的实际消费由调用方在 confirm() 返回后处理；如需全局广播请经 eventBus.subscribe 订阅。
      publish('agent:workflow-confirmed', { workflowId: wf.id, conversationId })
      return wf
    },

    /** 补充指令入队（不打断主任务） */
    steer(text, attachments = []) {
      steerQueue.push({ text, attachments, ts: Date.now() })
      return wf
    },

    /** 取下一条待执行补充指令 */
    nextSteer() {
      return steerQueue.shift() || null
    },

    /** 记录本次工作流建的节点（rollback 用） */
    addNode(id) {
      if (id) nodeIds.push(id)
      return wf
    },

    /** 创建并注册一个可取消任务。返回 { signal, cancel } */
    createTask() {
      const ctl = new AbortController()
      cancelTokens.add(ctl)
      return {
        signal: ctl.signal,
        cancel: () => { ctl.abort(); cancelTokens.delete(ctl) },
      }
    },

    /** 移除一个运行中任务（不 abort，仅注销；供任务正常完成时调用） */
    releaseTask(signal) {
      for (const ctl of cancelTokens) {
        if (ctl.signal === signal) { cancelTokens.delete(ctl); break }
      }
      return wf
    },

    /** 真 await 一个生成任务：runFn(signal) 返回结果；workflow 停止时任务被取消。 */
    async awaitNode(runFn, onAbort = null) {
      const task = wf.createTask()
      try {
        return await runFn(task.signal)
      } catch (e) {
        if (e?.name === 'AbortError') {
          onAbort?.()
          throw abortError()
        }
        throw e
      } finally {
        task.cancel() // cancel 内部已把 controller 从 cancelTokens 移除
      }
    },

    /** 并发执行：runParallel(items, fn) —— fn(item, signal) 并发跑，支持整体取消。 */
    async runParallel(items, fn, { concurrency = items.length, onAbort = null } = {}) {
      const list = Array.isArray(items) ? items : []
      if (list.length === 0) return []
      const results = new Array(list.length)
      let aborted = false
      let i = 0
      const next = async () => {
        while (i < list.length) {
          const idx = i++
          const task = wf.createTask()
          try {
            results[idx] = await fn(list[idx], task.signal, idx)
          } catch (e) {
            if (e?.name === 'AbortError') { aborted = true; onAbort?.(list[idx], idx) }
            else results[idx] = { ok: false, error: e?.message || '执行异常' }
          } finally {
            task.cancel()
          }
        }
      }
      const workers = []
      for (let w = 0; w < Math.min(concurrency, list.length); w++) workers.push(next())
      await Promise.all(workers)
      if (aborted) throw abortError()
      return results
    },

    /** 回滚：清理本次工作流建的节点（注入画布 ctx.deleteNode 等） */
    rollback(ctx) {
      if (!ctx?.deleteNode && !ctx?.setNodes) return wf
      if (ctx.deleteNode) {
        nodeIds.slice().forEach((id) => { try { ctx.deleteNode(id) } catch { /* 忽略 */ } })
      } else {
        const remaining = (ctx.getNodes?.() || []).filter((n) => !nodeIds.includes(n.id))
        ctx.setNodes(remaining)
      }
      nodeIds.length = 0
      return wf
    },

    /** 压入 AI 撤销快照（绑定本工作流，多对话不串话） */
    pushUndo(snapshot) {
      aiUndoStack.push(snapshot)
      if (aiUndoStack.length > 20) aiUndoStack.shift() // 上限 20（对齐 MAX_AI_UNDO）
      return wf
    },

    /** 弹出最近 AI 撤销快照 */
    popUndo() {
      return aiUndoStack.pop() || null
    },

    /** 序列化（供持久化到 conversation） */
    toJSON() {
      return {
        id: wf.id,
        conversationId,
        status,
        awaitingConfirm,
        nodeIds: [...nodeIds],
        steerQueue: [...steerQueue],
        aiUndoStack: [...aiUndoStack],
      }
    },
  }

  // 唯一 id
  wf.id = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

  return wf
}
