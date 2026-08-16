import { describe, it, expect } from 'vitest'
import { InputStateMachine } from '../../src/components/base/inputStateMachine.js'

describe('输入状态机 §2.15', () => {
  it('初始状态 idle，无内容', () => {
    const m = new InputStateMachine()
    expect(m.snapshot().status).toBe('idle')
    expect(m.hasContent()).toBe(false)
    expect(m.action()).toBe('idle')
  })

  it('有内容 → idle 推导 send', () => {
    const m = new InputStateMachine()
    m.setDraft('帮我生图')
    expect(m.hasContent()).toBe(true)
    expect(m.action()).toBe('send')
  })

  it('RUNNING 集合：planning/creating_nodes/ready/running 推导 stop（无内容）', () => {
    for (const st of ['planning', 'creating_nodes', 'ready', 'running']) {
      const m = new InputStateMachine()
      m.setStatus(st)
      expect(m.isRunning()).toBe(true)
      expect(m.action()).toBe('stop')
    }
  })

  it('RUNNING + 有内容 → steer', () => {
    const m = new InputStateMachine()
    m.setStatus('running')
    m.setDraft('改一下颜色')
    expect(m.action()).toBe('steer')
  })

  it('stopping 状态 → stopping（禁用）', () => {
    const m = new InputStateMachine()
    m.setStatus('stopping')
    expect(m.action()).toBe('stopping')
  })

  it('failed + 无内容 → idle；failed + 有内容 → retry', () => {
    const m1 = new InputStateMachine()
    m1.setStatus('failed')
    expect(m1.action()).toBe('idle')
    const m2 = new InputStateMachine()
    m2.setStatus('failed')
    m2.setDraft('重试')
    expect(m2.action()).toBe('retry')
  })

  it('completed/stopped 归一为 idle', () => {
    const m = new InputStateMachine()
    m.setStatus('completed')
    expect(m.snapshot().status).toBe('idle')
    m.setStatus('stopped')
    expect(m.snapshot().status).toBe('idle')
  })

  it('load 每对话隔离：不同 conversationId 状态独立', () => {
    const m = new InputStateMachine()
    m.load('convA', { status: 'running', draft: 'AAA' })
    expect(m.snapshot().status).toBe('running')
    m.load('convB', { status: 'idle', draft: '' })
    expect(m.snapshot().status).toBe('idle')
    expect(m.snapshot().draft).toBe('')
  })

  it('consume 清空草稿与附件并返回 payload', () => {
    const m = new InputStateMachine()
    m.setDraft('  生成猫咪  ')
    m.setAttachments([{ url: '/files/cat.png' }])
    const p = m.consume()
    expect(p.text).toBe('生成猫咪')
    expect(p.attachments).toHaveLength(1)
    expect(m.hasContent()).toBe(false)
  })

  it('onChange 回调收到 snapshot 与 action', () => {
    const events = []
    const m = new InputStateMachine({ onChange: (s, a) => events.push([s.status, a]) })
    m.setDraft('hi')
    expect(events.at(-1)).toEqual(['idle', 'send'])
  })
})
