import { describe, it, expect, beforeEach, vi } from 'vitest'

// 模块级单例 + sGet/sSet 依赖内存 localStorage（tests/setup.mjs 已注入）。
// 用 resetModules 隔离每次导入，beforeEach 清空 localStorage 保证独立。
describe('agentModelStore §4 读取/保存 AI 聊天模型偏好', () => {
  beforeEach(() => {
    try { localStorage.clear() } catch { /* ignore */ }
    vi.resetModules()
  })

  it('loadAgentChatModel 无数据返回 null', async () => {
    const { loadAgentChatModel } = await import('../../src/components/base/settings/agentModelStore.ts')
    expect(loadAgentChatModel()).toBeNull()
  })

  it('saveAgentChatModel 写入后可被 load 读回（含 stream 默认）', async () => {
    const { loadAgentChatModel, saveAgentChatModel } = await import('../../src/components/base/settings/agentModelStore.ts')
    saveAgentChatModel({ providerId: 'p1', modelId: 'm1' })
    const cfg = loadAgentChatModel()
    expect(cfg).toEqual({ providerId: 'p1', modelId: 'm1', streamMode: 'stream' })
  })

  it('saveAgentChatModel 显式 non-stream 生效', async () => {
    const { loadAgentChatModel, saveAgentChatModel } = await import('../../src/components/base/settings/agentModelStore.ts')
    saveAgentChatModel({ providerId: 'p1', modelId: 'm1', streamMode: 'non-stream' })
    expect(loadAgentChatModel().streamMode).toBe('non-stream')
  })

  it('streamMode 非 "non-stream" 一律回落 stream（向后兼容旧配置）', async () => {
    const { loadAgentChatModel, saveAgentChatModel } = await import('../../src/components/base/settings/agentModelStore.ts')
    saveAgentChatModel({ providerId: 'p1', modelId: 'm1', streamMode: 'whatever' })
    expect(loadAgentChatModel().streamMode).toBe('stream')
  })

  it('缺失 providerId 或 modelId 视为损坏，load 返回 null', async () => {
    const { loadAgentChatModel, saveAgentChatModel } = await import('../../src/components/base/settings/agentModelStore.ts')
    saveAgentChatModel({ providerId: '', modelId: '' })
    expect(loadAgentChatModel()).toBeNull()
  })

  it('saveAgentChatModel 部分字段用现存配置兜底（providerId 缺失沿用旧值）', async () => {
    const { loadAgentChatModel, saveAgentChatModel } = await import('../../src/components/base/settings/agentModelStore.ts')
    saveAgentChatModel({ providerId: 'p-old', modelId: 'm-old', streamMode: 'non-stream' })
    // 只更新 modelId，不传 providerId/streamMode → 沿用旧值
    saveAgentChatModel({ modelId: 'm-new' })
    const cfg = loadAgentChatModel()
    expect(cfg.providerId).toBe('p-old')
    expect(cfg.modelId).toBe('m-new')
    expect(cfg.streamMode).toBe('non-stream')
  })

  it('损坏的 JSON 不崩，load 返回 null', async () => {
    const { loadAgentChatModel } = await import('../../src/components/base/settings/agentModelStore.ts')
    // AGENT_CHAT_MODEL_KEY = StorageKeys.AGENT_CHAT_MODEL = 'agent_chat_model'，前缀 yimao:
    localStorage.setItem('yimao:agent_chat_model', '{not-json')
    expect(loadAgentChatModel()).toBeNull()
  })
})

// 【过渡方案·2026-08-18】历史回传轮数配置（0=不回传 / 1=上一轮 / 任意大≈不限）
describe('agentModelStore §4.5 历史回传轮数 load/save', () => {
  beforeEach(() => {
    try { localStorage.clear() } catch { /* ignore */ }
    vi.resetModules()
  })

  it('未设置时默认返回 6', async () => {
    const { loadAgentHistoryTurns } = await import('../../src/components/base/settings/agentModelStore.ts')
    expect(loadAgentHistoryTurns()).toBe(6)
  })

  it('save 后 load 读回（支持 0）', async () => {
    const m = await import('../../src/components/base/settings/agentModelStore.ts')
    m.saveAgentHistoryTurns(0)
    expect(m.loadAgentHistoryTurns()).toBe(0)
  })

  it('save 1 → 读回 1（只上一轮）', async () => {
    const m = await import('../../src/components/base/settings/agentModelStore.ts')
    m.saveAgentHistoryTurns(1)
    expect(m.loadAgentHistoryTurns()).toBe(1)
  })

  it('大值（如 1000000）≈不限，读回原值', async () => {
    const m = await import('../../src/components/base/settings/agentModelStore.ts')
    m.saveAgentHistoryTurns(1000000)
    expect(m.loadAgentHistoryTurns()).toBe(1000000)
  })

  it('负数非法：不保存，保持原值', async () => {
    const m = await import('../../src/components/base/settings/agentModelStore.ts')
    m.saveAgentHistoryTurns(5)
    m.saveAgentHistoryTurns(-3)
    expect(m.loadAgentHistoryTurns()).toBe(5)
  })

  it('非数字非法：不保存', async () => {
    const m = await import('../../src/components/base/settings/agentModelStore.ts')
    m.saveAgentHistoryTurns(5)
    m.saveAgentHistoryTurns('abc')
    expect(m.loadAgentHistoryTurns()).toBe(5)
  })

  it('小数向下取整（输入 2.7 → 存 2）', async () => {
    const m = await import('../../src/components/base/settings/agentModelStore.ts')
    m.saveAgentHistoryTurns(2.7)
    expect(m.loadAgentHistoryTurns()).toBe(2)
  })
})
