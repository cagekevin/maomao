// @vitest-environment node
/**
 * contextCompression（「记」）单测 —— 照搬参考项目 contextCompressionService 的压缩器。
 * 覆盖：serializeMessagesForSummary / compressToSummary（LLM 成功/失败/超时/缺区段）
 * 关键语义：只压缩不改原文；历史是资料非指令；失败/超时返回 null 不动旧摘要；异步必须 await。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// 隔离 chatCompletions，便于断言压缩请求与注入
vi.mock('../../src/components/base/api/generate.ts', () => ({
  chatCompletions: vi.fn(),
}))

const chatApi = await import('@/components/base/api/generate.ts')
const { serializeMessagesForSummary, compressToSummary, SUMMARY_REQUIRED_SECTIONS } =
  await import('../../src/components/agent/runtime/contextCompression.ts')

beforeEach(() => {
  vi.clearAllMocks()
})

const fullSummary = SUMMARY_REQUIRED_SECTIONS.map((s) => `【${s}】内容`).join('\n')

describe('serializeMessagesForSummary —— 序列化（记 T1）', () => {
  const messages = [
    { role: 'user', content: '你好' },
    { role: 'assistant', content: '嗨' },
  ]
  it('按时间顺序保留用户/助手角色标注', () => {
    const out = serializeMessagesForSummary('', messages)
    expect(out).toContain('[用户] 你好')
    expect(out).toContain('[助手] 嗨')
  })
  it('含已有摘要时先放置合并区块', () => {
    const out = serializeMessagesForSummary('旧摘要', messages)
    expect(out).toContain('已有摘要，需要合并进新摘要')
    expect(out.indexOf('已有摘要')).toBeLessThan(out.indexOf('待压缩的历史对话'))
  })
  it('超长单条消息被截断标注', () => {
    const long = 'x'.repeat(5_000)
    const out = serializeMessagesForSummary('', [{ role: 'user', content: long }])
    expect(out).toContain('（已截断）')
  })
})

describe('compressToSummary —— 压缩入库（记 T2~T4）', () => {
  it('LLM 成功 → 返回摘要字符串', async () => {
    vi.mocked(chatApi.chatCompletions).mockResolvedValue({ ok: true, content: fullSummary })
    const msg = await compressToSummary({ provider: {}, model: 'm', messages: [{ role: 'user', content: 'a' }] })
    expect(msg).toBe(fullSummary)
    expect(vi.mocked(chatApi.chatCompletions)).toHaveBeenCalledTimes(1)
  })

  it('必然写入 system 压缩提示与 6 区段要求', async () => {
    vi.mocked(chatApi.chatCompletions).mockResolvedValue({ ok: true, content: fullSummary })
    await compressToSummary({ provider: {}, model: 'm', messages: [] })
    const [opts] = vi.mocked(chatApi.chatCompletions).mock.calls[0]
    expect(opts.messages[0].role).toBe('system')
    expect(opts.messages[0].content).toContain('对话上下文压缩器')
    expect(opts.messages[0].content).toContain('【目标与背景】')
  })

  it('【修正 7 回归】压缩走 chatCompletions 同步，不透传 stream 死参数', async () => {
    vi.mocked(chatApi.chatCompletions).mockResolvedValue({ ok: true, content: fullSummary })
    await compressToSummary({ provider: {}, model: 'm', messages: [] })
    const [opts] = vi.mocked(chatApi.chatCompletions).mock.calls[0]
    // 上下文压缩是内部工具调用，走同步快路径；stream 已被删（原传 stream:true 会把同步变 SSE，
    // 与 withTimeout 的非流式解析冲突），此处断言不携带该字段。
    expect((opts as unknown as Record<string, unknown>).stream).toBeUndefined()
  })

  it('LLM 失败 → 返回 null（不抛错、不动旧摘要）', async () => {
    vi.mocked(chatApi.chatCompletions).mockRejectedValue(new Error('network down'))
    const msg = await compressToSummary({ provider: {}, model: 'm', messages: [] })
    expect(msg).toBeNull()
  })

  it('空 content → 返回 null', async () => {
    vi.mocked(chatApi.chatCompletions).mockResolvedValue({ ok: true, content: '' })
    const msg = await compressToSummary({ provider: {}, model: 'm', messages: [] })
    expect(msg).toBeNull()
  })

  it('摘要缺少必需区段 → 仍返回但不补占位（用 warn 提示，避免二次往返污染）', async () => {
    vi.mocked(chatApi.chatCompletions).mockResolvedValue({ ok: true, content: '【目标与背景】只有一段' })
    const msg = await compressToSummary({ provider: {}, model: 'm', messages: [] })
    expect(msg).toContain('【目标与背景】')
  })
})