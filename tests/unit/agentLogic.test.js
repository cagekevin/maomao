import { describe, it, expect } from 'vitest'
import { parseSSEChunk, buildRequestMessages, demoPlan } from '../../src/components/base/useAgentChat.js'

// §2.15 AI 助手前端逻辑：parseSSEChunk（SSE 流式解析） + buildRequestMessages（发 LLM 的消息组装）
// 这两个是 AI 助手多轮工具循环的核心纯函数（不依赖 React DOM），可直接单测。

describe('AI 助手 parseSSEChunk（SSE 解析）§2.15', () => {
  it('解析 content 增量', () => {
    const acc = { content: '', reasoning: '', toolCalls: [] }
    parseSSEChunk('data: {"choices":[{"delta":{"content":"你好"}}]}', acc)
    parseSSEChunk('data: {"choices":[{"delta":{"content":"世界"}}]}', acc)
    expect(acc.content).toBe('你好世界')
  })

  it('解析 reasoning_content（思考过程）', () => {
    const acc = { content: '', reasoning: '', toolCalls: [] }
    parseSSEChunk('data: {"choices":[{"delta":{"reasoning_content":"思考中"}}]}', acc)
    expect(acc.reasoning).toBe('思考中')
  })

  it('解析 tool_calls 增量（name + arguments 分段拼接）', () => {
    const acc = { content: '', reasoning: '', toolCalls: [] }
    parseSSEChunk('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call1","function":{"name":"create","arguments":"{\\"ty"}}]}}]}', acc)
    parseSSEChunk('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"pe\\":\\"promptNode\\"}"}}]}}]}', acc)
    expect(acc.toolCalls[0].id).toBe('call1')
    expect(acc.toolCalls[0].function.name).toBe('create')
    expect(acc.toolCalls[0].function.arguments).toBe('{"type":"promptNode"}')
  })

  it('忽略非 data: 前缀 / [DONE] / 空', () => {
    const acc = { content: '', reasoning: '', toolCalls: [] }
    parseSSEChunk('event: x', acc)
    parseSSEChunk('data: [DONE]', acc)
    parseSSEChunk('data:', acc)
    expect(acc.content).toBe('')
  })

  it('忽略解析失败的行（不抛错）', () => {
    const acc = { content: '', reasoning: '', toolCalls: [] }
    expect(() => parseSSEChunk('data: {bad json', acc)).not.toThrow()
    expect(acc.content).toBe('')
  })
})

describe('AI 助手 buildRequestMessages（发 LLM 消息组装）§2.15', () => {
  it('enhance 默认注入 CANVAS_AGENT_RULES 为 system', () => {
    const out = buildRequestMessages([{ role: 'user', content: 'hi' }], '', true, [], null)
    expect(out[0].role).toBe('system')
    expect(out[0].content).toContain('你是猫猫画布助手')
    expect(out[1]).toMatchObject({ role: 'user', content: 'hi' })
  })

  it('enhance=false 且无 systemPrompt 时不注入', () => {
    const out = buildRequestMessages([{ role: 'user', content: 'hi' }], '', false, [], null)
    expect(out.some((m) => m.role === 'system')).toBe(false)
  })

  it('systemPrompt 拼接在规则之后', () => {
    const out = buildRequestMessages([{ role: 'user', content: 'hi' }], '自定义准则', true, [], null)
    expect(out.filter((m) => m.role === 'system')).toHaveLength(2)
    expect(out[1].content).toBe('自定义准则')
  })

  it('启用的 Skill 无损注入（原文包成 Skill 文档标记）', () => {
    const skills = [{ name: '电商', content: '你是电商设计师' }]
    const out = buildRequestMessages([{ role: 'user', content: 'hi' }], '', true, skills, null)
    const skillMsg = out.find((m) => m.role === 'system' && m.content.includes('Skill 文档'))
    expect(skillMsg.content).toContain('你是电商设计师')
    expect(skillMsg.content).toContain('===== Skill 文档开始：电商 =====')
  })

  it('memory.lastPlan 注入最近策划', () => {
    const memory = { lastPlan: { plan_text: '规划说明', generations: [{ title: '主图', prompt: '描述' }] } }
    const out = buildRequestMessages([{ role: 'user', content: 'hi' }], '', true, [], memory)
    const memMsg = out.find((m) => m.role === 'system' && m.content.includes('最近策划'))
    expect(memMsg.content).toContain('规划说明')
    expect(memMsg.content).toContain('主图')
  })

  it('用户消息带附件 → 转 image_url 数组', () => {
    const out = buildRequestMessages([{ role: 'user', content: '看图', attachments: [{ url: '/files/a.png' }] }], '', false, [], null)
    const user = out.find((m) => m.role === 'user')
    expect(user.content).toEqual([{ type: 'image_url', image_url: { url: '/files/a.png' } }, { type: 'text', text: '看图' }])
  })

  it('已有 system 的历史消息 → 补注入画布准则 + systemPrompt，并保留历史 system', () => {
    const out = buildRequestMessages([{ role: 'system', content: '已有' }, { role: 'user', content: 'hi' }], '外部准则', true, [], null)
    // 【bug 修复】hasSystem 不再跳过准则注入：enhance=true 时注入 CANVAS_AGENT_RULES + systemPrompt，
    //   且历史 system 在遍历中保留（不再 continue 跳过）→ 共 3 条 system，画布准则不丢失。
    const sys = out.filter((m) => m.role === 'system')
    expect(sys).toHaveLength(3)
    expect(sys[0].content).toContain('猫猫画布助手') // 画布准则
    expect(sys[1].content).toBe('外部准则') // 传入的 systemPrompt
    expect(sys.some((m) => m.content === '已有')).toBe(true) // 历史 system 保留
    expect(out.some((m) => m.role === 'user' && m.content === 'hi')).toBe(true)
  })
})

// 复用 demoPlan 的补充断言（与 demoPlan.test.js 互补，验证与状态机无关的边界）
describe('AI 助手 demoPlan 边界 §2.15', () => {
  it('未匹配任何动作返回空数组', () => {
    expect(demoPlan('随便聊聊', () => ({}))).toEqual([])
  })
})
