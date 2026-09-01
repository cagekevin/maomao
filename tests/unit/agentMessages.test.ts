// @vitest-environment node
/**
 * agentMessages 单测（M3 下沉 2：消息构造/落盘层）。
 * 覆盖：appendMsg / setHistory / updateLastStreaming / endStreaming / stripStreaming
 * 保持「单源读 store」语义：内部一律经 getCurrentSnapshot() 读最新，经 patchCurrentMessages/setCurrentSnapshot 写。
 * 策略：mock conversationStore 三个落盘原语（getCurrentSnapshot / setCurrentSnapshot / patchCurrentMessages），
 *       用内存数组当 store 模拟单源读。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ChatMessage } from '../../src/components/agent/runtime/agentCore.ts'

// 测试用消息：在 ChatMessage 基础上扩展测试夹具需要的 id/streaming 字段
type TestChatMessage = ChatMessage & { id?: string; streaming?: boolean }

// 内存 store 夹具：消息用 TestChatMessage[]（src 侧真实类型 + 测试字段），保证 .id/.role/.content 等可读。
// .current 为最新消息数组，.set 整体替换（模拟 setCurrentSnapshot 写语义）。
interface MemStore {
  current: TestChatMessage[]
  set: (arr: TestChatMessage[]) => void
}
let store: MemStore = { current: [], set: (a) => { store.current = a } }

vi.mock('../../src/components/agent/conversation/conversationStore.ts', () => ({
  getCurrentSnapshot: vi.fn(),
  setCurrentSnapshot: vi.fn(),
  patchCurrentMessages: vi.fn(),
}))

const convStore = await import('../../src/components/agent/conversation/conversationStore.ts')
// vi.mock 工厂不改变静态导入类型，需用 vi.mocked 标注才能拿到 .mockImplementation/.mock
const getCurrentSnapshot = vi.mocked(convStore.getCurrentSnapshot)
const setCurrentSnapshot = vi.mocked(convStore.setCurrentSnapshot)
const patchCurrentMessages = vi.mocked(convStore.patchCurrentMessages)
const { appendMsg, setHistory, updateLastStreaming, endStreaming, stripStreaming } = await import('../../src/components/agent/runtime/agentMessages.ts')

beforeEach(() => {
  vi.clearAllMocks()
  // 内存 store：set 覆盖 current，get 返回 current
  store.current = []
  store.set = (arr) => { store.current = arr }
  getCurrentSnapshot.mockImplementation(() => ({
    messages: store.current,
    skills: [],
    attachments: [],
    draft: '',
    workflow: null,
    pending: null,
    memory: {},
  }))
  setCurrentSnapshot.mockImplementation((p) => { if (p.messages) store.set(p.messages as TestChatMessage[]) })
  patchCurrentMessages.mockImplementation((next) => store.set(next as TestChatMessage[]))
})

describe('appendMsg — 追加一条消息', () => {
  it('追加到尾部并补稳定 id', () => {
    store.set([{ id: 'm1', role: 'user', content: 'a' }])
    appendMsg({ role: 'assistant', content: 'b' })
    expect(store.current).toHaveLength(2)
    expect(store.current[1]).toMatchObject({ role: 'assistant', content: 'b' })
    expect(typeof store.current[1].id).toBe('string')
  })

  it('已有 id 的消息不重复补 id', () => {
    store.set([])
    appendMsg({ id: 'fixed', role: 'user', content: 'x' })
    expect(store.current[0].id).toBe('fixed')
  })
})

describe('setHistory — 整体替换', () => {
  it('替换为给定数组并为每条补 id', () => {
    store.set([{ id: 'old', role: 'user', content: 'gone' }])
    setHistory([{ role: 'assistant', content: 'c' }, { role: 'user', content: 'd' }])
    expect(store.current).toHaveLength(2)
    expect(store.current[0].role).toBe('assistant')
    expect(store.current.every((m) => typeof m.id === 'string')).toBe(true)
  })

  it('非数组入参 → 空历史', () => {
    store.set([{ id: 'x', role: 'user', content: 'y' }])
    setHistory(null)
    expect(store.current).toHaveLength(0)
  })
})

describe('updateLastStreaming — 流式增量（仅通知）', () => {
  it('更新最后一条 streaming assistant；走 patchCurrentMessages', () => {
    store.set([{ id: 'u', role: 'user', content: 'q' }, { id: 's', role: 'assistant', content: '', streaming: true, tool_calls: [] }])
    updateLastStreaming({ content: 'hi', toolCalls: [{ function: { name: 'f' } }] })
    const last = store.current[store.current.length - 1]
    expect(last.content).toBe('hi')
    expect(last.tool_calls[0].function.name).toBe('f')
    expect(patchCurrentMessages).toHaveBeenCalled()
  })

  it('空 toolCalls 不写 tool_calls 字段（杜绝 Empty tool_calls）', () => {
    store.set([{ id: 's', role: 'assistant', content: '', streaming: true }])
    updateLastStreaming({ content: 'txt', toolCalls: [{ function: { name: '' } }] })
    const last = store.current[0]
    expect(last.tool_calls).toBeUndefined()
  })

  it('只改最后一条；前面的消息不动', () => {
    store.set([{ id: 'a', role: 'user', content: 'keep' }, { id: 's', role: 'assistant', content: '', streaming: true }])
    updateLastStreaming({ content: 'hi', toolCalls: [] })
    expect(store.current[0].content).toBe('keep')
  })
})

describe('endStreaming — 结束流式', () => {
  it('保留占位 id 替换为完整 assistant', () => {
    store.set([{ id: 'uid', role: 'user', content: 'q' }, { id: 'sid', role: 'assistant', content: '', streaming: true }])
    endStreaming({ role: 'assistant', content: 'final' })
    const last = store.current[1]
    expect(last.id).toBe('sid')
    expect(last.streaming).toBe(false)
    expect(last.content).toBe('final')
  })
})

describe('stripStreaming — 清理残留', () => {
  it('移除所有 streaming 占位，保留正常消息', () => {
    store.set([
      { id: 'a', role: 'user', content: 'x' },
      { id: 'b', role: 'assistant', content: '', streaming: true },
      { id: 'c', role: 'user', content: 'y' },
    ])
    stripStreaming()
    expect(store.current).toHaveLength(2)
    expect(store.current.some((m) => m.streaming)).toBe(false)
  })
})