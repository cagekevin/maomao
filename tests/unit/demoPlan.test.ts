import { describe, it, expect } from 'vitest'
import { demoPlan } from '../../src/components/agent/runtime/useAgentChat.ts'

// §2.15 AI 助手：demoPlan（Demo 规则引擎，VITE_AGENT_DEMO=1 时用）
// 把「自然语言一句话」映射成工具调用序列；不认识返回 []。
// 这是 AI 助手前端逻辑里可独立测的纯函数（不依赖 React DOM）。
describe('AI 助手 demoPlan 规则引擎 §2.15', () => {
  it('创建生图节点：识别 type=promptNode + 引号内 prompt', () => {
    const calls = demoPlan('帮我生成一张「赛博朋克猫咪」图', () => ({}))
    expect(calls[0]).toMatchObject({ name: 'create_node' })
    expect(calls[0].args.type).toBe('promptNode')
    expect(calls[0].args.prompt).toBe('赛博朋克猫咪')
  })

  it('创建视频节点：识别 discountVideoNode', () => {
    const calls = demoPlan('创建一个视频节点', () => ({}))
    expect(calls[0].args.type).toBe('discountVideoNode')
  })

  it('创建文本节点：识别 textNode', () => {
    const calls = demoPlan('创建一个文本节点', () => ({}))
    expect(calls[0].args.type).toBe('textNode')
  })

  it('连接两个节点：识别 source→target', () => {
    const calls = demoPlan('把 text-1 连接到 prompt-1', () => ({}))
    const conn = calls.find((c) => c.name === 'connect_nodes')
    expect(conn).toBeTruthy()
    expect(conn.args.source).toBe('text-1')
    expect(conn.args.target).toBe('prompt-1')
  })

  it('删除节点：识别 delete_node + 节点 id', () => {
    const calls = demoPlan('删除 text-1', () => ({}))
    const del = calls.find((c) => c.name === 'delete_node')
    expect(del).toBeTruthy()
    expect(del.args.nodeId).toBe('text-1')
  })

  it('查看画布：识别 read_canvas', () => {
    const calls = demoPlan('看看画布上有哪些节点', () => ({}))
    expect(calls.some((c) => c.name === 'read_canvas')).toBe(true)
  })

  it('适配视图：识别 fit_view', () => {
    const calls = demoPlan('适配一下视图', () => ({}))
    expect(calls.some((c) => c.name === 'fit_view')).toBe(true)
  })

  it('不认识的输入返回空数组（assistant 纯文字答复）', () => {
    const calls = demoPlan('你好，今天天气怎么样', () => ({}))
    expect(calls).toEqual([])
  })

  it('create_node 的 label 随类型变化（promptNode=生图节点）', () => {
    const calls = demoPlan('生成一张图', () => ({}))
    const create = calls.find((c) => c.name === 'create_node')
    expect(create.args.label).toBe('生图节点')
  })
})
