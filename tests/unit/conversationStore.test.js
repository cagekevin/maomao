import { describe, it, expect, beforeEach, vi } from 'vitest'
import { contentClearCache } from '../../src/components/base/contentStore.ts'
import {
  resetConversationCache, ensureActiveConversation, newConversation, switchConversation,
  deleteConversation, applyConversation, importLegacy, getCurrentSnapshot, setCurrentSnapshot,
  getCurrentMemory, setCurrentMemory, patchCurrentWorkflow, getCurrentWorkflow,
  setCurrentPending, getCurrentPending, getActiveAiUndoStack, pushActiveAiUndo, popActiveAiUndo,
  normalizeConversation, setAgentKey, getActiveConversationId, getConversations,
  getLastUserReferenceImages, getLastGeneratedImages, getCurrentImageMap,
  getCurrentRunMode, setCurrentRunMode, flushPersist, waitHydrated,
} from '../../src/components/agent/conversation/conversationStore.js'

// 会话键已迁 KV（backend:'kv'）：写走 kvSet、读走 kvGet。用 Map 兜底让 KV 确定性往返，
// 避免走真实 localToolApi 网络（响铃 fetch 抛错 + 误导性降级告警 + 异步时序不稳定）。
const kvStore = new Map()
vi.mock('../../src/components/base/localToolApi.ts', async (importOriginal) => ({
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

/** 在每个项目（agentKey）之间切换前，重置内存缓存，模拟「从未初始化该项目」的干净状态。
 * 会话键已迁 KV，水化为异步：切后等水化完成再返回，确保读到的是一次性重新水化的真实数据。 */
async function switchToProject(projectId) {
  flushPersist() // P4 落盘节流：切项目前先把上一个项目的待落盘变更刷下去
  resetConversationCache()
  setAgentKey(`canvas-assistant-${projectId}`)
  await waitHydrated(`canvas-assistant-${projectId}`)
}

describe('会话隔离数据层 §2.15', () => {
  it('ensureActiveConversation 在没有对话时建空对话并设为当前', () => {
    const id = ensureActiveConversation()
    expect(id).toBeTruthy()
    // 激活 hydrated 才能落盘
    applyConversation(id)
    expect(getCurrentSnapshot().messages).toEqual([])
  })

  it('newConversation 新建并把当前切换过去', () => {
    const id1 = ensureActiveConversation()
    applyConversation(id1)
    const { id: id2 } = newConversation()
    expect(id2).not.toBe(id1)
    expect(getCurrentSnapshot().messages).toEqual([])
  })

  it('switchConversation 切换对话且状态隔离', () => {
    const id1 = ensureActiveConversation()
    applyConversation(id1)
    setCurrentSnapshot({ messages: [{ role: 'user', content: 'AAA' }] })
    const { id: id2 } = newConversation()
    applyConversation(id2)
    expect(getCurrentSnapshot().messages).toEqual([])
    switchConversation(id1)
    expect(getCurrentSnapshot().messages).toHaveLength(1)
    expect(getCurrentSnapshot().messages[0].content).toBe('AAA')
  })

  it('deleteConversation 删除并保留至少 1 个（删空则新建）', () => {
    const id1 = ensureActiveConversation()
    applyConversation(id1)
    const { id: id2 } = newConversation()
    deleteConversation(id2)
    // 只剩 id1
    deleteConversation(id1)
    // 删空后自动新建一个
    expect(getCurrentSnapshot()).toBeTruthy()
  })

  it('importLegacy 旧单会话迁移（幂等：已有对话不迁移）', () => {
    const s = importLegacy({ messages: [{ role: 'user', content: '历史消息' }], skills: [] })
    expect(s).toBeTruthy()
    expect(getCurrentSnapshot().messages[0].content).toBe('历史消息')
    // 再次 import 应返回 null（已有对话）
    expect(importLegacy({ messages: [{ role: 'user', content: 'X' }] })).toBeNull()
  })

  it('AGENT_MSG_MAX=60 上限截断（保留最近 60 条）', () => {
    const id = ensureActiveConversation()
    applyConversation(id)
    const many = Array.from({ length: 100 }, (_, i) => ({ role: 'user', content: `m${i}` }))
    setCurrentSnapshot({ messages: many })
    expect(getCurrentSnapshot().messages).toHaveLength(60)
    expect(getCurrentSnapshot().messages.at(-1).content).toBe('m99')
  })

  it('memory 读写：setCurrentMemory / getCurrentMemory', () => {
    const id = ensureActiveConversation()
    applyConversation(id)
    setCurrentMemory({ summary: '测试摘要', lastPlan: { id: 'p1' }, lastSharedStyle: '皮克斯' })
    const m = getCurrentMemory()
    expect(m.summary).toBe('测试摘要')
    expect(m.lastSharedStyle).toBe('皮克斯')
    expect(m.facts).toEqual([])
  })

  it('patchCurrentWorkflow 补丁 workflow（归一 status/steerQueue）', () => {
    const id = ensureActiveConversation()
    applyConversation(id)
    const wf = patchCurrentWorkflow({ status: 'running', nodeIds: ['n1'] })
    expect(wf.status).toBe('running')
    expect(wf.steerQueue).toEqual([])
    const cur = getCurrentWorkflow()
    expect(cur.nodeIds).toEqual(['n1'])
  })

  it('pending 暂存恢复：setCurrentPending / getCurrentPending', () => {
    const id = ensureActiveConversation()
    applyConversation(id)
    setCurrentPending({ conversationId: id, text: '待恢复任务', attachments: [] })
    const p = getCurrentPending()
    expect(p.text).toBe('待恢复任务')
  })

  it('AI 撤销栈：push/pop，上限 20', () => {
    const id = ensureActiveConversation()
    applyConversation(id)
    for (let i = 0; i < 25; i++) pushActiveAiUndo({ i })
    const stack = getActiveAiUndoStack()
    expect(stack).toHaveLength(20)
    expect(stack.at(-1).i).toBe(24)
    const popped = popActiveAiUndo()
    expect(popped.i).toBe(24)
    expect(getActiveAiUndoStack()).toHaveLength(19)
  })

  it('normalizeConversation 补齐全字段', () => {
    const c = normalizeConversation({ title: 'X' })
    expect(c.id).toBeTruthy()
    expect(c.messages).toEqual([])
    expect(c.memory.summary).toBe('')
    expect(c.aiUndoStack).toEqual([])
    expect(c.workflow).toBeNull()
  })

  it('normalizeConversation 给无 id 消息补稳定唯一 id，已有 id 保留（P15 列表 key 锚点）', () => {
    const c = normalizeConversation({
      title: 'X',
      messages: [
        { role: 'user', content: 'a' },
        { role: 'assistant', content: 'b', id: 'keep-me' },
      ],
    })
    // 无 id 的消息被补上唯一 id；已有 id 的消息保留
    expect(c.messages[0].id).toBeTruthy()
    expect(c.messages[1].id).toBe('keep-me')
    expect(c.messages[0].id).not.toBe(c.messages[1].id)
    // 幂等：二次归一化不改变已补的 id（保证列表 key 稳定）
    const again = normalizeConversation(c)
    expect(again.messages[0].id).toBe(c.messages[0].id)
    expect(again.messages[1].id).toBe('keep-me')
  })

  it('hydrated 守卫：未 apply 前 setCurrentSnapshot 不落盘（内存可改，但不写 KV）', () => {
    const id = ensureActiveConversation()
    // 未 apply（hydrated=false）：内存可写入，但不落盘（不写 KV）
    setCurrentSnapshot({ messages: [{ role: 'user', content: '临时' }] })
    expect(getCurrentSnapshot().messages).toHaveLength(1) // 内存已更新
    expect(kvStore.has('agent_conversations_canvas-assistant')).toBe(false) // 关键：未 hydrated 前不落盘，防挂载覆盖
    applyConversation(id)
    setCurrentSnapshot({ messages: [{ role: 'user', content: '正式' }] })
    flushPersist() // P4 落盘节流：主动刷盘，立即读到最终落盘态
    expect(kvStore.has('agent_conversations_canvas-assistant')).toBe(true) // 已 hydrated，落 KV
    expect(getCurrentSnapshot().messages).toHaveLength(1)
  })
})

describe('按项目隔离会话（project 作为最顶层）', () => {
  it('不同项目（agentKey）的会话互相独立，不串话', async () => {
    // 项目 A：建对话 + 存一条消息
    await switchToProject('projA')
    const aId = ensureActiveConversation()
    applyConversation(aId)
    setCurrentSnapshot({ messages: [{ role: 'user', content: '项目A的绘画' }] })

    // 切到项目 B：会话全新（新项目 = 空会话），不继承 A 的消息
    await switchToProject('projB')
    expect(getActiveConversationId()).toBe('') // 未建对话，无 active
    expect(getConversations()).toHaveLength(0) // 项目 B 无任何对话
    const bId = ensureActiveConversation()
    applyConversation(bId)
    expect(getCurrentSnapshot().messages).toEqual([]) // 全新空会话
    setCurrentSnapshot({ messages: [{ role: 'user', content: '项目B的绘画' }] })

    // 切回项目 A：会话恢复为 A 自己的内容
    await switchToProject('projA')
    expect(getCurrentSnapshot().messages[0].content).toBe('项目A的绘画')
    // B 的内容不影响 A
    expect(getCurrentSnapshot().messages).toHaveLength(1)
  })

  it('新建项目 = 新 agentKey → 该项目绘画全新（无历史）', async () => {
    // 项目 A 有会话
    await switchToProject('projA')
    const aId = ensureActiveConversation()
    applyConversation(aId)
    setCurrentSnapshot({ messages: [{ role: 'user', content: '旧项目内容' }] })

    // 模拟「新建项目 C」：全新 agentKey，无任何历史会话
    await switchToProject('projC')
    expect(getConversations()).toHaveLength(0)
    const cId = ensureActiveConversation()
    applyConversation(cId)
    expect(getCurrentSnapshot().messages).toEqual([]) // 全新，不含旧项目内容
  })

  it('setAgentKey 相同 key 时幂等（不重置已有会话）', async () => {
    await switchToProject('projD')
    const dId = ensureActiveConversation()
    applyConversation(dId)
    setCurrentSnapshot({ messages: [{ role: 'user', content: 'D 内容' }] })

    // 再次 setAgentKey 同一项目：不重置，会话保留
    flushPersist() // P4 落盘节流：重置缓存前先刷盘，确保重读时能取到已落盘数据
    resetConversationCache()
    setAgentKey('canvas-assistant-projD')
    await waitHydrated('canvas-assistant-projD') // 会话键迁 KV，水化为异步：等重水化完成
    expect(getCurrentSnapshot().messages[0].content).toBe('D 内容')
  })

  it('不同项目的对话列表互不影响', async () => {
    await switchToProject('projE')
    const e1 = ensureActiveConversation()
    applyConversation(e1)
    newConversation() // E 有 2 个对话
    expect(getConversations().length).toBe(2)

    await switchToProject('projF')
    const f1 = ensureActiveConversation()
    applyConversation(f1)
    expect(getConversations().length).toBe(1) // F 只有 1 个

    await switchToProject('projE')
    expect(getConversations().length).toBe(2) // E 仍是 2 个
  })
})

describe('跨轮图引用数据源（对齐大雄 agentLastUserAttachments / agentLastResults / agentCurrentImageMap）', () => {
  function setup(msgs) {
    const id = ensureActiveConversation()
    applyConversation(id)
    setCurrentSnapshot({ messages: msgs })
    return id
  }

  it('getLastUserReferenceImages：向前找最近带图 user 消息，返回其参考图 url', () => {
    setup([
      { role: 'user', content: '轮1', attachments: [{ url: 'http://x/a.png' }] },
      { role: 'assistant', content: 'ok1' },
      { role: 'user', content: '轮2', attachments: [{ url: 'http://x/b.png' }, { url: 'http://x/c.png' }] },
    ])
    expect(getLastUserReferenceImages()).toEqual(['http://x/b.png', 'http://x/c.png'])
  })

  it('getLastGeneratedImages：向前找最近带生成结果图的 assistant 消息（lastResults）', () => {
    setup([
      { role: 'assistant', content: '旧', lastResults: [{ url: 'http://x/old.png' }] },
      { role: 'user', content: '轮' },
      { role: 'assistant', content: '新', lastResults: [{ url: 'http://x/new1.png' }, { url: 'http://x/new2.png' }] },
    ])
    const r = getLastGeneratedImages()
    expect(r).toHaveLength(2)
    expect(r[0].url).toBe('http://x/new1.png')
  })

  it('getCurrentImageMap：上一轮生成图(图1~M) + 当前附件(图M+1~N) 统一编号', () => {
    const id = setup([
      { role: 'assistant', content: '生成', lastResults: [{ url: 'http://x/gen1.png', name: '主图' }] },
    ])
    // 设置当前附件（画布选中/上传的参考图）
    setCurrentSnapshot({ messages: getCurrentSnapshot().messages, attachments: [{ url: 'http://x/att.png', label: '参考' }] })
    const map = getCurrentImageMap()
    expect(map).toEqual([
      { num: 1, url: 'http://x/gen1.png', name: '主图', source: 'gen' },
      { num: 2, url: 'http://x/att.png', name: '参考', source: 'att' },
    ])
    expect(map[0].num).toBe(1)
    expect(map[1].num).toBe(2)
  })

  it('runMode 分级：默认 auto（完全自主），setCurrentRunMode 可切 step-confirm，normalizeConversation 归一非法值', () => {
    setup([])
    expect(getCurrentRunMode()).toBe('auto') // 默认完全自主
    setCurrentRunMode('step-confirm')
    expect(getCurrentRunMode()).toBe('step-confirm')
    setCurrentRunMode('auto')
    expect(getCurrentRunMode()).toBe('auto')
    setCurrentRunMode('garbage') // 非法值归一为 step-confirm（非 auto）
    expect(getCurrentRunMode()).toBe('step-confirm')
    setCurrentRunMode('semi') // 旧值 'semi' 兼容迁移为 step-confirm
    expect(getCurrentRunMode()).toBe('step-confirm')
  })
})
