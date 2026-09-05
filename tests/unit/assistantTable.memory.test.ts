import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as contentStore from '../../src/components/base/core/contentStore.ts'
const { contentClearCache } = contentStore
import {
  resetConversationCache, ensureActiveConversation, applyConversation, setAgentKey,
  newConversation, switchConversation,
} from '../../src/components/agent/conversation/conversationStore.ts'
import {
  getCurrentAssistantTable, setCurrentAssistantTable,
  getCurrentGlobalContract, setCurrentGlobalContract,
} from '../../src/components/agent/conversation/conversationStore.ts'
import { parsePasted } from '../../src/components/agent/assistantTable/assistantTable.ts'

// 会话键已迁 KV：用 Map 兜底让 KV 确定性往返，避免走真实网络
const kvStore = new Map()
vi.mock('../../src/components/base/api/localToolApi.ts', async (importOriginal) => ({
  ...(await importOriginal()),
  kvGet: vi.fn(async (key) => (kvStore.has(key) ? kvStore.get(key) : null)),
  kvSet: vi.fn(async (key, value) => { kvStore.set(key, value); return { ok: true } }),
  kvDelete: vi.fn(async (key) => { kvStore.delete(key); return { ok: true } }),
}))

beforeEach(() => {
  localStorage.clear()
  kvStore.clear()
  contentClearCache()
  resetConversationCache()
})

describe('assistantTable 会话记忆字段', () => {
  it('读写走 per-conversation 隔离：写表A → 切会话读空 → 切回A仍在', () => {
    const id = ensureActiveConversation()
    applyConversation(id)
    const sb = parsePasted('景别\t画面\n中景\t人')
    setCurrentAssistantTable(sb!)
    expect(getCurrentAssistantTable().rows).toHaveLength(1)

    const { id: idB } = newConversation()
    applyConversation(idB)
    // 新对话 = 新空表
    expect(getCurrentAssistantTable().columns).toHaveLength(0)
    expect(getCurrentAssistantTable().rows).toHaveLength(0)

    switchConversation(id)
    // 切回 A → 表还在
    expect(getCurrentAssistantTable().rows).toHaveLength(1)
  })

  it('normalize 兜底：会话无表数据 → 空表（不抛）', () => {
    const id = ensureActiveConversation()
    applyConversation(id)
    setCurrentAssistantTable({ columns: [], rows: [] })
    expect(getCurrentAssistantTable().rows).toHaveLength(0)
  })

  it('globalStyle 复用 global_contract.unified_style_prompt：写全局风格可读回', () => {
    const id = ensureActiveConversation()
    applyConversation(id)
    setCurrentGlobalContract({ visual_positioning: '', unified_style_prompt: '写实电影感', unified_negative_prompt: '' })
    expect(getCurrentGlobalContract()?.unified_style_prompt).toBe('写实电影感')
  })
})