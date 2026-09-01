import { describe, it, expect } from 'vitest'
// 前端镜像层纯函数单测（规则唯一真相在后端 requestModes.ts；两端规则一致，此处锁定前端消费契约）
import {
  imageModePath, isResponsesMode, buildResponsesInput, buildResponsesImageBody,
  parseResponsesImage, extractMarkdownImage, parseResponsesJson, normalizeToolCalls,
  resolveChatMode, buildResponsesChatBody, parseResponsesChatJson, parseResponsesSSEChunk,
} from '../../src/components/base/requestModes.ts'

describe('请求形态层（前端镜像）', () => {
  it('imageModePath：四形态端点映射，未知回退 openai', () => {
    expect(imageModePath('openai')).toBe('images/generations')
    expect(imageModePath('openai-json')).toBe('images/generations')
    expect(imageModePath('openai-responses')).toBe('responses')
    expect(imageModePath('openai-video-proxy')).toBe('videos')
    expect(imageModePath('whatever')).toBe('images/generations')
    expect(imageModePath(undefined)).toBe('images/generations')
  })

  it('isResponsesMode：仅认 responses 系', () => {
    expect(isResponsesMode('openai-responses')).toBe(true)
    expect(isResponsesMode('responses')).toBe(true)
    expect(isResponsesMode('openai')).toBe(false)
    expect(isResponsesMode(undefined)).toBe(false)
  })

  it('buildResponsesImageBody：input_text/input_image + tool 内 size', () => {
    const body = buildResponsesImageBody({
      model: 'gpt-5.6', prompt: '画猫', images: ['data:image/png;base64,xx'], size: '1024x1024',
    })
    expect(body.model).toBe('gpt-5.6')
    expect(body.tools).toEqual([{ type: 'image_generation', size: '1024x1024' }])
    expect(body.input).toEqual([
      { type: 'input_text', text: '画猫' },
      { type: 'input_image', image_url: 'data:image/png;base64,xx' },
    ])
  })

  it('parseResponsesJson：image_generation_call → markdown 兜底', () => {
    expect(parseResponsesJson({ output: [{ type: 'image_generation_call', status: 'completed', result: 'https://cdn/x.png' }] })).toBe('https://cdn/x.png')
    expect(parseResponsesJson({ output: [{ type: 'output_text', text: '![图](https://cdn/f.png)' }] })).toBe('https://cdn/f.png')
    expect(parseResponsesJson({ output: [] })).toBeUndefined()
  })

  it('extractMarkdownImage：markdown 优先，裸 URL 兜底', () => {
    expect(extractMarkdownImage('![a](https://cdn/a.png) 后')).toBe('https://cdn/a.png')
    expect(extractMarkdownImage('https://cdn.abc.com/b.png 后')).toBe('https://cdn.abc.com/b.png')
    expect(extractMarkdownImage('无图')).toBeUndefined()
  })

  it('normalizeToolCalls：responses function_call 归一成统一 tool_calls', () => {
    const u = normalizeToolCalls({ output: [{ type: 'function_call', name: 'create_node', arguments: '{"x":1}', call_id: 'c1' }] })
    expect(u[0]).toMatchObject({ id: 'c1', function: { name: 'create_node', arguments: '{"x":1}' } })
  })

  it('resolveChatMode：默认 chat，responses 系归 responses，gpt-5.6 自动归 responses（M2-5 保守）', () => {
    expect(resolveChatMode(undefined)).toBe('chat')
    expect(resolveChatMode('chat')).toBe('chat')
    expect(resolveChatMode('responses')).toBe('responses')
    expect(resolveChatMode('openai-responses')).toBe('responses')
    // 未配置时按模型自动判断：gpt-5.6 系 → responses，其余 → chat
    expect(resolveChatMode(undefined, 'gpt-5.6-luna')).toBe('responses')
    expect(resolveChatMode(undefined, 'gpt-5.6-terra')).toBe('responses')
    expect(resolveChatMode(undefined, 'deepseek-v4-flash')).toBe('chat')
    expect(resolveChatMode(undefined, 'gpt-5.5')).toBe('chat')
  })

  it('buildResponsesChatBody：messages 映射 input + tool name 顶层（M2-2）', () => {
    const body = buildResponsesChatBody({
      model: 'gpt-5.6',
      messages: [
        { role: 'system', content: '你是助手' },
        { role: 'user', content: [{ type: 'text', text: 'hi' }] },
        { role: 'tool', tool_call_id: 'c1', content: '{"ok":true}' },
      ],
      toolSchemas: [{ function: { name: 'create_node', description: '建节点', parameters: { type: 'object' } } }],
      temperature: 0.6,
    })
    expect(body.model).toBe('gpt-5.6')
    // tools 顶层 name（非 function 嵌套）
    expect(body.tools).toEqual([{ type: 'function', name: 'create_node', description: '建节点', parameters: { type: 'object' } }])
    expect(body.tool_choice).toBe('auto')
    // tool 结果 → function_call_output
    expect(body.input).toContainEqual({ type: 'function_call_output', call_id: 'c1', output: '{"ok":true}' })
    // 系统/用户文本 → input_text
    expect(body.input[0]).toEqual({ role: 'system', content: [{ type: 'input_text', text: '你是助手' }] })
    expect(body.input[1]).toEqual({ role: 'user', content: [{ type: 'input_text', text: 'hi' }] })
  })

  it('buildResponsesChatBody：assistant 历史 tool_calls → function_call 项（M2-4 历史回传）', () => {
    const body = buildResponsesChatBody({
      model: 'm',
      messages: [
        { role: 'user', content: '看图' },
        { role: 'assistant', content: '', tool_calls: [{ id: 'c_1', type: 'function', function: { name: 'create_node', arguments: '{"x":1}' } }] },
      ],
    })
    expect(body.input).toContainEqual({ type: 'function_call', call_id: 'c_1', name: 'create_node', arguments: '{"x":1}' })
  })

  it('parseResponsesChatJson：output[] 拼 content + 归一 tool_calls（M2-2/M2-4）', () => {
    const r = parseResponsesChatJson({
      output: [
        { type: 'message', content: [{ type: 'output_text', text: '已处理' }] },
        { type: 'function_call', name: 'execute_plan', arguments: '{"p":1}', call_id: 'c9' },
      ],
    })
    expect(r.content).toBe('已处理')
    expect(r.toolCalls[0]).toMatchObject({ id: 'c9', function: { name: 'execute_plan', arguments: '{"p":1}' } })
  })

  it('parseResponsesSSEChunk：流式事件并入 acc（M2-3）', () => {
    const acc = { content: '', reasoning: '', toolCalls: [] }
    parseResponsesSSEChunk('data: {"type":"response.output_text.delta","delta":"你好"}', acc)
    parseResponsesSSEChunk('data: {"type":"response.function_call_arguments.delta","name":"create_node","call_id":"c7","delta":"{\\"x\\""}', acc)
    parseResponsesSSEChunk('data: {"type":"response.function_call_arguments.delta","delta":":1}"}', acc)
    expect(acc.content).toBe('你好')
    expect(acc.toolCalls[0]).toMatchObject({ id: 'c7', function: { name: 'create_node', arguments: '{"x":1}' } })
    expect(buildResponsesInput).toBeTypeOf('function')
  })
})