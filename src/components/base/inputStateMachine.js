/**
 * ════════════════════════════════════════════════════════════════
 * 输入状态机（对齐大雄 input-state-machine.js）
 * ════════════════════════════════════════════════════════════════
 *
 * 【解决什么问题】
 * 之前输入区只有 sending boolean：无法表达"运行中可补充指令（steer）"、
 * "失败可重试（retry）"、"停止中（stopping）"等语义。用状态机统一管理，
 * 并根据"当前状态 + 输入框是否有内容"推导出用户现在该按什么按钮。
 *
 * 【状态】
 *  status ∈ idle | planning | creating_nodes | ready | running | stopping | failed | completed
 *  - idle：空闲可发送
 *  - planning/creating_nodes/ready/running：任务运行中（RUNNING 集合）
 *  - stopping：正在停止
 *  - failed：上次失败（可重试）
 *  - completed：完成（归一为 idle）
 *
 * 【action() 推导（核心）】
 *  - stopping            → 'stopping'   （正在停止，按钮禁用）
 *  - failed              → 有内容 ? 'retry' : 'idle'
 *  - 运行中(RUNNING)     → 有内容 ? 'steer' : 'stop'   （有补充则 steer，否则可停止）
 *  - 否则                → 有内容 ? 'send' : 'idle'
 *
 * 【每对话隔离】
 *  load(conversationId, saved) 按对话加载状态，切换对话时互不影响（对齐大雄）。
 *  状态里保存 draft/attachments（输入内容），配合会话隔离每对话独立。
 *
 * 纯逻辑、无 React 依赖，可独立单测。
 * ════════════════════════════════════════════════════════════════
 */

/** 运行中状态集合（RUNNING，对齐大雄） */
const RUNNING = new Set(['planning', 'creating_nodes', 'ready', 'running'])

export class InputStateMachine {
  constructor(options = {}) {
    this.conversationId = ''
    this.state = { status: 'idle', draft: '', attachments: [], workflow: null, submitLocked: false }
    // 状态变化回调：onChange(snapshot, action)（对齐大雄 options.onChange）
    this.onChange = typeof options.onChange === 'function' ? options.onChange : null
  }

  /** 按对话加载状态（切换对话时调用，隔离各对话状态） */
  load(conversationId, saved = {}) {
    this.conversationId = conversationId || 'default'
    this.state = {
      status: saved.status || 'idle',
      draft: String(saved.draft || ''),
      attachments: Array.isArray(saved.attachments) ? saved.attachments.slice() : [],
      workflow: saved.workflow || null,
      submitLocked: false,
    }
    return this.snapshot()
  }

  /** 当前状态快照 */
  snapshot() {
    return {
      status: this.state.status,
      draft: this.state.draft,
      attachments: this.state.attachments.slice(),
      workflow: this.state.workflow,
    }
  }

  /** 是否运行中 */
  isRunning() {
    return RUNNING.has(this.state.status)
  }

  /** 输入框是否有内容（草稿或附件） */
  hasContent() {
    return Boolean(this.state.draft.trim() || this.state.attachments.length)
  }

  /** 推导用户当前该按什么按钮（send/stop/steer/retry/idle/stopping） */
  action() {
    if (this.state.status === 'stopping') return 'stopping'
    if (this.state.status === 'failed') return this.hasContent() ? 'retry' : 'idle'
    if (this.isRunning()) return this.hasContent() ? 'steer' : 'stop'
    return this.hasContent() ? 'send' : 'idle'
  }

  /** 更新草稿 */
  setDraft(value) {
    this.state.draft = String(value || '')
    this.emit()
  }

  /** 更新附件 */
  setAttachments(items) {
    this.state.attachments = Array.isArray(items) ? items.slice() : []
    this.emit()
  }

  /** 任务开始（状态置为 planning 或给定 status） */
  start(workflow) {
    this.state.workflow = workflow || this.state.workflow
    this.state.status = workflow?.status || 'planning'
    this.emit()
  }

  /** 设置状态；completed/stopped 归一为 idle（对齐大雄 setStatus） */
  setStatus(status) {
    this.state.status = status || 'idle'
    if (['completed', 'stopped'].includes(status)) this.state.status = 'idle'
    this.emit()
  }

  /** 发送后清空草稿和附件，返回 { text, attachments } 供调用方使用 */
  consume() {
    const payload = { text: this.state.draft.trim(), attachments: this.state.attachments.slice() }
    this.state.draft = ''
    this.state.attachments = []
    this.emit()
    return payload
  }

  /** 触发 onChange(snapshot, action)，驱动 UI 更新 */
  emit() {
    if (typeof this.onChange === 'function') this.onChange(this.snapshot(), this.action())
  }
}
