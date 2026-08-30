/**
 * prompts 逐条确认流程（对齐大雄 agentPrompts 状态机 + confirm/edit/save-edit/reopen/confirm-all）。
 *
 * ══ ★ 重要：这个通道在大雄当前版本里是「已废弃」功能，为什么我们还要保留？请读下面 ★ ══
 * 大雄历史上曾有「思维模式」（thinkingModeOn）走 prompts 逐条确认：LLM 出 prompts 数组 → 用户逐条
 * 确认/编辑/重新生成 → 全确认后转 generations 生图（confirmAgentPrompt 8500 / editAgentPrompt 8508 /
 * regenerateAgentPrompts 8587 / confirmAllAgentPrompts 8549 / _triggerGenerationsIfAllDone 8447）。
 * 但**当前大雄版本已彻底移除思维模式**：
 *   - `thinkingModeOn = false`（canvas-agent.js 5262 / 7302），且 9723 强制 `agentState.thinkingMode = false`；
 *   - 注释「思维模式 UI 已移除：执行层固定走快速执行路径」（9721）；
 *   - 7410-7525 的 prompts 构建块在 thinkingModeOn=false 下**永不执行**；
 *   - 主要路径把 `assistantMsg.prompts = []` 强制清空（7690/7725/7784）。
 * 因此 prompts 逐条确认的 confirm/edit/regenerate 卡片在**当前大雄是死代码**，大雄实际走的是
 * **generations 快速执行通道**：LLM 直接输出 generations JSON → auto 模式直接 execute /
 * semi 模式用门禁一次性确认（agentPushStageGateMessage 7774，等价我们的 show_plan_for_confirm）。
 *
 * 【结论】大雄当前实际使用的主路径 = generations 快速执行，我们**已经完整对齐**（工具循环 +
 *   show_plan_for_confirm 一次性确认 + execute_plan，见 useAgentChat.send / useCanvasAgentTools.execute_plan）。
 *   prompts 逐条确认通道是大雄已废弃的历史能力，**我们当前不在主路径触发它**（assistant 消息默认
 *   不带 prompts，走 generations 通道）。
 *
 * 【那为什么还保留本模块 + PromptConfirmCard？】作为一个「可选增强」留在代码里：
 *   1. 若未来要恢复「逐条确认提示词」的精细交互，本模块的状态机 + 纯逻辑可直接复用（不依赖 UI，可单测）；
 *   2. 保持与大雄历史代码的对应关系，便于审计「我们抄了大雄什么」；
 *   3. 当前不激活 = 不走该路径，不会影响 generations 主通道。
 *   → 若你不想要这个保留能力，可删除 promptFlow.js / PromptConfirmCard.jsx / AgentMessage 里的接入块。
 *
 * ⚠️ 【追加：保留决策已确认，2026-08-18】人类 CEO 明确决策：**不删除，原样保留**，本段以下为追加说明：
 *   - 人类确认：删掉无实质价值（功能完好但无数据触发），保留可避免"若未来要恢复逐条确认"时需从 git 找回；
 *     且删改死代码改坏了更麻烦。故**维持保留**，此前的"可删除"提示不再作为动作依据。
 *   - 本通道**当前是死代码**（assistant 消息默认不带 prompts，0 活跃调用）——这是**已知、已确认**的状态，
 *     **不要尝试"补全/激活/接入"它**，也不要再为此立项重构。
 *   - 后续 AI 读到本模块：**直接跳过**，它是"决策保留的已废弃历史能力"，不是待办、不是待开发、不是 bug。
 *     主路径是 generations 快速执行通道（见 useAgentChat 文件头路径表），与此无关。
 *
 * ── prompts 状态机（对齐大雄 8500-8577 + ensureCurrentPrompt 982 + _triggerGenerationsIfAllDone 8447）──
 *   status 取值：pending(待处理) → current(当前待确认) → confirmed(已确认) / editing(内联编辑中) / skipped(跳过)。
 *   推进规则：
 *   - ensureCurrentPrompt：无 current/editing 时，把第一个 pending 置为 current。
 *   - confirmPrompt：把 current/editing 置为 confirmed，推进到下一个 pending（置 current）；无 pending 则触发转 generations。
 *   - editPrompt：把 current 置为 editing（进入内联编辑，不推进）。
 *   - savePromptEdit：更新文本，置 confirmed，推进。
 *   - cancelPromptEdit：editing 回 current。
 *   - reopenPrompt：已 confirmed/skipped 项反悔（大雄要求无 current/editing 时才允许）→ 置 current。
 *   - confirmAllPrompts：全部 pending/current/editing 置 confirmed（保留 skipped），触发转 generations。
 */

import { generateId } from './idGen.ts'

/** prompts 逐条确认的 status 取值（对齐 PROMPT_STATUS 各键） */
export type PromptStatus = 'pending' | 'current' | 'confirmed' | 'editing' | 'skipped'

/** 规范化后的单条 prompt */
export interface PromptItem {
  prompt: string
  count: number
  use_attachments: boolean
  use_last_outputs?: boolean
  attachment_indices?: number[]
  status: string
  title?: string
  ratio?: string
  resolution?: string
}

/** 全确认后转生图用的 generation（对齐 execute_plan 输入形状） */
interface Generation {
  id: string
  title: string
  prompt: string
  count: number
  ratio: string
  resolution: string
  use_attachments: boolean
  attachment_indices: number[]
  depends_on_previous: boolean
  dependency_mode: string
}

/** 各推进函数返回结构：done=false 未全确认；done=true 带 generations 可触发生图 */
interface PromptFlowResult {
  prompts: PromptItem[]
  done: boolean
  generations?: Generation[]
  error?: string
}

/** normalizePrompts 的输入项：string 或对象（兼容大雄 normalizePrompts 语义） */
type RawPrompt =
  | string
  | null
  | {
      prompt?: string
      count?: number | string
      use_attachments?: unknown
      use_last_outputs?: unknown
      status?: string
      attachment_indices?: unknown
      title?: string
      ratio?: string
      resolution?: string
    }

/** prompts 状态常量（对齐大雄 normalizePrompts 的 status 语义） */
export const PROMPT_STATUS: Record<'PENDING' | 'CURRENT' | 'CONFIRMED' | 'EDITING' | 'SKIPPED', PromptStatus> = {
  PENDING: 'pending',
  CURRENT: 'current',
  CONFIRMED: 'confirmed',
  EDITING: 'editing',
  SKIPPED: 'skipped',
}

/** 规范化 prompts 数组（兼容 string[] 与对象数组；对齐大雄 normalizePrompts 954）。 */
export function normalizePrompts(prompts: RawPrompt[] | undefined | null): PromptItem[] {
  if (!Array.isArray(prompts)) return []
  return prompts
    .map((p) => {
      if (typeof p === 'string') {
        const t = p.trim()
        return t ? { prompt: t, count: 1, use_attachments: false, attachment_indices: [], status: PROMPT_STATUS.PENDING } : null
      }
      if (p && typeof p === 'object' && typeof p.prompt === 'string' && p.prompt.trim()) {
        const normalized: {
          prompt: string
          count: number
          use_attachments: boolean
          use_last_outputs: boolean
          status: string
          attachment_indices?: number[]
        } = {
          prompt: p.prompt.trim(),
          count: Math.max(1, Math.min(8, Number(p.count) || 1)),
          use_attachments: !!p.use_attachments,
          use_last_outputs: !!p.use_last_outputs,
          status: p.status || PROMPT_STATUS.PENDING,
        }
        if (Array.isArray(p.attachment_indices)) {
          normalized.attachment_indices = p.attachment_indices
            .filter((i: number) => Number.isFinite(Number(i)) && Number(i) >= 0)
            .map((i) => Math.floor(Number(i)))
        }
        return normalized
      }
      return null
    })
    .filter(Boolean)
}

/** 确保有一项为 current/editing；否则把第一个 pending 置为 current（对齐大雄 ensureCurrentPrompt 982）。
 *  @param {Array} prompts 规范化后的 prompts
 *  @returns {Array} 新数组（不可变，返回副本） */
export function ensureCurrentPrompt(prompts: PromptItem[]): PromptItem[] {
  const next = prompts.map((p) => ({ ...p }))
  if (!next.some((p) => p.status === PROMPT_STATUS.CURRENT || p.status === PROMPT_STATUS.EDITING)) {
    const firstPending = next.findIndex((p) => !p.status || p.status === PROMPT_STATUS.PENDING)
    if (firstPending >= 0) next[firstPending].status = PROMPT_STATUS.CURRENT
  }
  return next
}

/** 确认当前项并推进；全确认后返回 { done:true, generations } 触发转生图，否则 { done:false }。
 *  对齐大雄 confirmAgentPrompt 8500 + _advanceToNextOrGenerate 8483 + _triggerGenerationsIfAllDone 8447。
 *  @param {Array} prompts
 *  @returns {{prompts:Array, done:boolean, generations?:Array}} */
export function confirmPrompt(prompts: PromptItem[]): PromptFlowResult {
  let next = prompts.map((p) => ({ ...p }))
  const idx = next.findIndex((p) => p.status === PROMPT_STATUS.CURRENT || p.status === PROMPT_STATUS.EDITING)
  if (idx < 0) return { prompts: next, done: false }
  next[idx].status = PROMPT_STATUS.CONFIRMED
  return advanceToNextOrGenerate(next)
}

/** 把当前项置为 editing（进入内联编辑，不推进；对齐大雄 editAgentPrompt 8508）。 */
export function editPrompt(prompts: PromptItem[], idx?: number): PromptItem[] {
  const next = prompts.map((p) => ({ ...p }))
  const target = idx >= 0 ? idx : next.findIndex((p) => p.status === PROMPT_STATUS.CURRENT)
  if (target < 0 || target >= next.length) return next
  next[target].status = PROMPT_STATUS.EDITING
  return next
}

/** 保存内联编辑：更新文本 + 置 confirmed + 推进（对齐大雄 saveAgentPromptEdit 8525）。 */
export function savePromptEdit(prompts: PromptItem[], idx: number | undefined, newText?: string): PromptFlowResult {
  const text = String(newText || '').trim()
  if (!text) return { prompts, done: false, error: '提示词不能为空' }
  let next = prompts.map((p) => ({ ...p }))
  const target = idx >= 0 ? idx : next.findIndex((p) => p.status === PROMPT_STATUS.EDITING)
  if (target < 0 || target >= next.length) return { prompts: next, done: false }
  next[target].prompt = text
  next[target].status = PROMPT_STATUS.CONFIRMED
  return advanceToNextOrGenerate(next)
}

/** 取消内联编辑：editing 回 current（对齐大雄 cancelAgentPromptEdit 8540）。 */
export function cancelPromptEdit(prompts: PromptItem[], idx?: number): PromptItem[] {
  const next = prompts.map((p) => ({ ...p }))
  const target = idx >= 0 ? idx : next.findIndex((p) => p.status === PROMPT_STATUS.EDITING)
  if (target >= 0 && target < next.length) next[target].status = PROMPT_STATUS.CURRENT
  return next
}

/** 已确认/已跳过项反悔：直接置为 current（对齐大雄 reopenAgentPrompt 8573）。
 *  前置条件：无 editing/current 时才允许反悔（大雄 toast「请先完成当前提示词的确认或修改」）；
 *  否则返回原数组不反悔。 */
export function reopenPrompt(prompts: PromptItem[], idx: number): PromptItem[] {
  const next = prompts.map((p) => ({ ...p }))
  if (idx < 0 || idx >= next.length) return next
  // 有 editing/current 时禁止反悔（避免状态混乱，对齐大雄 8577-8580）
  if (next.some((p) => p.status === PROMPT_STATUS.EDITING || p.status === PROMPT_STATUS.CURRENT)) return next
  next[idx].status = PROMPT_STATUS.CURRENT
  return next
}

/** 全部确认并生成：把 pending/current/editing 置 confirmed（保留 skipped），触发转 generations（对齐大雄 confirmAllAgentPrompts 8549）。 */
export function confirmAllPrompts(prompts: PromptItem[]): PromptFlowResult {
  let next = prompts.map((p) => ({ ...p }))
  next = next.map((p) => (p.status === PROMPT_STATUS.PENDING || p.status === PROMPT_STATUS.CURRENT || p.status === PROMPT_STATUS.EDITING
    ? { ...p, status: PROMPT_STATUS.CONFIRMED }
    : p))
  return advanceToNextOrGenerate(next)
}

/** 推进到下一个 pending；全 confirmed 则构建 generations（对齐大雄 _advanceToNextOrGenerate 8483 + _triggerGenerationsIfAllDone 8447）。
 *  @param {Array} prompts
 *  @returns {{prompts:Array, done:boolean, generations?:Array}} done=true 表示已全部确认、返回 generations 可触发生图 */
export function advanceToNextOrGenerate(prompts: PromptItem[]): PromptFlowResult {
  const next = prompts.map((p) => ({ ...p }))
  const nextPending = next.findIndex((p) => p.status === PROMPT_STATUS.PENDING)
  if (nextPending >= 0) {
    next[nextPending].status = PROMPT_STATUS.CURRENT
    return { prompts: next, done: false }
  }
  // 全部处理完（无 pending/current/editing）：收集 confirmed 转 generations
  if (!next.some((p) => p.status === PROMPT_STATUS.PENDING || p.status === PROMPT_STATUS.CURRENT || p.status === PROMPT_STATUS.EDITING)) {
    const confirmed = next.filter((p) => p.status === PROMPT_STATUS.CONFIRMED)
    const generations: Generation[] = confirmed.map((p) => ({
      id: generateId('prompt'),
      title: p.title || p.prompt?.slice(0, 30) || '生成',
      prompt: p.prompt,
      count: p.count || 1,
      ratio: p.ratio || 'Auto',
      resolution: p.resolution || '1K',
      use_attachments: !!p.use_attachments,
      attachment_indices: Array.isArray(p.attachment_indices) ? p.attachment_indices : [],
      depends_on_previous: false,
      dependency_mode: 'none',
    }))
    return { prompts: next, done: true, generations }
  }
  return { prompts: next, done: false }
}