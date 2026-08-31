/**
 * AI 助手消息构造 / 落盘层（M3 下沉 2）。
 *
 * 定位：把 useAgentChat 里 appendMsg / setHistory / updateLastStreaming / endStreaming / stripStreaming
 * 五个「操作 store 的消息函数」抽成独立模块，hook 只 import 调用，不再内联实现。
 *
 * 约束（关键）：
 * - 【单源读 store】这些函数一律用 getCurrentSnapshot() 读最新 stores.messages，不引入第二份可变数组，
 *   杜绝并发下读到过期历史。
 * - 落盘语义保持与 useAgentChat 原实现完全一致：
 *   - appendMsg / setHistory / stripStreaming：低频，走 setCurrentSnapshot（内部合并 300ms 落盘节流）。
 *   - updateLastStreaming / endStreaming：高频流式热路径，只 patchCurrentMessages（仅通知不落盘，
 *     最终态由 send finally 统一落盘），避免每次流式 chunk 触发落盘 IO。
 * - 消息 id：统一补稳定 id（P15），保证 AgentPanel 列表 key 稳定。
 *
 * 依赖方向（单向）：useAgentChat → agentMessages → conversationStore。无环。
 */

import { patchCurrentMessages, setCurrentSnapshot, getCurrentSnapshot } from '../conversation/conversationStore.js'
import { generateId } from '../../base/idGen.ts'

/** 流式增量（模型逐 chunk 回传的 content/reasoning/toolCalls） */
export interface StreamDelta {
  content?: string
  reasoning?: string
  toolCalls?: Array<{ function?: { name?: string } }>
}

/** 给无 id 的消息补稳定 id（P15：列表 key 稳定） */
const withMsgId = (m: any) => (m && typeof m === 'object' && m.id ? m : { ...m, id: generateId('msg') })

/** 追加一条消息（低频；落盘）。单源：读 store 当前消息 + 追加 → setCurrentSnapshot。 */
export function appendMsg(msg: Record<string, unknown>): void {
  setCurrentSnapshot({ messages: [...getCurrentSnapshot().messages, withMsgId(msg)] })
}

/** 整体替换历史（低频；落盘）。统一补稳定消息 id。 */
export function setHistory(next: unknown[] | null): void {
  const normalized = (Array.isArray(next) ? next : []).map(withMsgId)
  setCurrentSnapshot({ messages: normalized })
}

/** 更新最后一条 streaming assistant 的增量（高频流式热路径；仅通知不落盘，最终态由 send finally 统一落盘） */
export function updateLastStreaming(delta: StreamDelta): void {
  // 同步性：patchCurrentMessages 内部 commit 同步更新 store 并 notify，
  //   调用后立即 getCurrentSnapshot() 即是最新 —— 杜绝异步回调读到空 streaming 占位。
  const cur = getCurrentSnapshot().messages
  const next = cur.map((m, i) => {
    if (i !== cur.length - 1 || m.role !== 'assistant' || !m.streaming) return m
    // 只保留真实 tool_calls（name 非空）；为空则不设该字段，杜绝空数组进历史 → LLM 报 Empty tool_calls
    const realCalls = delta.toolCalls.filter((t) => t.function?.name)
    return {
      ...m,
      content: delta.content,
      reasoning: delta.reasoning || undefined,
      ...(realCalls.length > 0 ? { tool_calls: realCalls } : {})
    }
  })
  patchCurrentMessages(next)
}

/** 结束流式：把最后一条 streaming 占位替换为完整 assistant（高频流式末拍；仅通知不落盘，finally 统一落盘） */
export function endStreaming(assistant: Record<string, unknown>): void {
  // 【key 稳定修复】替换时必须保留原占位消息的 id（assistant 对象可能无 id）——
  //   否则 key={m.id} 变 undefined，AI 发消息（流式结束）时触发 React「列表缺 key」警告。
  const cur = getCurrentSnapshot().messages
  const next = cur.map((m, i) =>
    i === cur.length - 1 ? { ...assistant, id: m.id, streaming: false } : m
  )
  patchCurrentMessages(next)
}

/** 清理所有 streaming 残留占位（循环中途出错可能残留多轮 streaming:true 占位；低频；落盘） */
export function stripStreaming(): void {
  setCurrentSnapshot({ messages: getCurrentSnapshot().messages.filter((m) => !m.streaming) })
}