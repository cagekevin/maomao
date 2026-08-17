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

  it('【fresh-task】历史消息（含 system）不进 LLM：只保留本轮 user + 前置注入的准则/systemPrompt', () => {
    // fresh-task 对齐大雄：历史消息整体丢弃（连历史 system 也不回传），只发本轮 user + 注入的准则/systemPrompt。
    const out = buildRequestMessages([{ role: 'system', content: '已有' }, { role: 'user', content: 'hi' }], '外部准则', true, [], null)
    const sys = out.filter((m) => m.role === 'system')
    expect(sys).toHaveLength(2) // 画布准则 + 外部准则（历史 system「已有」被丢弃）
    expect(sys[0].content).toContain('猫猫画布助手') // 画布准则
    expect(sys[1].content).toBe('外部准则') // 传入的 systemPrompt
    expect(sys.some((m) => m.content === '已有')).toBe(false) // 历史 system 不回传
    expect(out.some((m) => m.role === 'user' && m.content === 'hi')).toBe(true) // 本轮 user 保留
  })

  it('空 tool_calls 数组被过滤：不发给 LLM（防 Empty tool_calls 报错）', () => {
    // 历史里可能残留 tool_calls: [] 的脏数据（旧版本修复前存的），必须被过滤掉，
    // 否则原样发给 LLM → 触发 `Empty tool_calls is not supported in message`。
    const msgs = [
      { role: 'user', content: '建一个节点' },
      { role: 'assistant', content: '', tool_calls: [] },               // 空数组（脏数据）
      { role: 'assistant', content: '有真实调用', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'create_node', arguments: '{}' } }] },
      { role: 'tool', content: '{"ok":true}', tool_call_id: 'c1' },
    ]
    const out = buildRequestMessages(msgs, '', false)
    const assistant = out.filter((m) => m.role === 'assistant')
    // 空 tool_calls 的 assistant 不带该字段；真实 tool_calls 的 assistant 正常保留
    expect(assistant.find((m) => m.content === '')?.tool_calls).toBeUndefined()
    expect(assistant.find((m) => m.content === '有真实调用')?.tool_calls).toHaveLength(1)
    // 关键：任何发给 LLM 的消息都不含空数组 tool_calls
    for (const m of out) {
      if (m.tool_calls !== undefined) expect(m.tool_calls.length).toBeGreaterThan(0)
    }
    // tool_call_id 仍正常透传
    expect(out.find((m) => m.role === 'tool')?.tool_call_id).toBe('c1')
  })

  it('孤儿 tool 消息被过滤：无对应 tool_calls 的 tool 消息不发给 LLM', () => {
    // 场景：tool 消息的 tool_call_id 找不到任何 assistant 声明的 tool_calls（历史不完整/脏数据）
    const msgs = [
      { role: 'user', content: '生成' },
      { role: 'assistant', content: '', tool_calls: [] },               // 空 tool_calls，被过滤
      { role: 'tool', content: '{"ok":true}', tool_call_id: 'c_orphan' }, // 孤儿：c_orphan 无对应声明
    ]
    const out = buildRequestMessages(msgs, '', false)
    expect(out.filter((m) => m.role === 'tool')).toHaveLength(0) // 孤儿 tool 被丢弃
    // assistant 空 tool_calls 也被过滤，不带 tool_calls 字段
    expect(out.filter((m) => m.role === 'assistant')[0]?.tool_calls).toBeUndefined()
  })

  it('正常 assistant(tool_calls) + tool 配对透传，tool_call_id 匹配', () => {
    const msgs = [
      { role: 'user', content: '生成' },
      { role: 'assistant', content: '', tool_calls: [{ id: 'c_real', type: 'function', function: { name: 'create_node', arguments: '{}' } }] },
      { role: 'tool', content: '{"ok":true}', tool_call_id: 'c_real' },
    ]
    const out = buildRequestMessages(msgs, '', false)
    const tool = out.find((m) => m.role === 'tool')
    expect(tool).toBeTruthy()
    expect(tool.tool_call_id).toBe('c_real')
    expect(out.find((m) => m.role === 'assistant')?.tool_calls).toHaveLength(1)
  })

  it('配对后 tool_call_id 不重复消费：同 id 第二条 tool 消息被丢弃', () => {
    const msgs = [
      { role: 'assistant', content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'read_canvas', arguments: '{}' } }] },
      { role: 'tool', content: '{"ok":true}', tool_call_id: 'c1' },
      { role: 'tool', content: '{"ok":false}', tool_call_id: 'c1' }, // 重复：c1 已被消费
    ]
    const out = buildRequestMessages(msgs, '', false)
    const tools = out.filter((m) => m.role === 'tool')
    expect(tools).toHaveLength(1) // 只保留第一条
  })

  it('参考图附件带画布坐标 x/y 时，坐标以文本附给 LLM（对齐参考项目传 xy）', () => {
    const msgs = [{
      role: 'user',
      content: '按这张图改',
      attachments: [
        { type: 'image', url: '/files/a.png', nodeId: 'n1', x: 100, y: 200 },
      ],
    }]
    const out = buildRequestMessages(msgs, '', false)
    const user = out.find((m) => m.role === 'user')
    // 图片转 image_url
    expect(user.content[0].type).toBe('image_url')
    // 坐标文本附加在 content 里，LLM 能感知参考图来自画布哪个位置
    const text = user.content.find((c) => c.type === 'text')?.text || ''
    expect(text).toContain('画布坐标 x=100, y=200')
  })

  it('参考图附件无坐标时不附加坐标文本（不误写）', () => {
    const msgs = [{
      role: 'user',
      content: '生成一张图',
      attachments: [{ type: 'image', url: '/files/b.png' }], // 无 x/y
    }]
    const out = buildRequestMessages(msgs, '', false)
    const user = out.find((m) => m.role === 'user')
    const text = user.content.find((c) => c.type === 'text')?.text || ''
    expect(text).not.toContain('画布坐标')
    expect(text).toContain('生成一张图')
  })
})

// 复用 demoPlan 的补充断言（与 demoPlan.test.js 互补，验证与状态机无关的边界）
describe('AI 助手 demoPlan 边界 §2.15', () => {
  it('未匹配任何动作返回空数组', () => {
    expect(demoPlan('随便聊聊', () => ({}))).toEqual([])
  })
})
