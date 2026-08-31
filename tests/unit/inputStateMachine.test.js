/**
 * 阶段三（entry 组件）· 纯逻辑单测
 *
 * 对应 docs/10-测试覆盖补齐计划-2026-08-17.md §三「entry 组件」：
 *   - 输入状态机 inputStateMachine.js（纯逻辑、无 React 依赖、可独立单测）
 *
 * 注：ScriptBox 相关 hook（useScriptBoxData/Engine）强依赖 React + useReactFlow，
 * 与 scriptBoxEngine 的引擎回调（需 mock chatApi/imageApi）留待 React/集成测试，
 * 本文件先行补齐零依赖、最高价值的输入状态机逻辑。
 *
 * 运行：vitest run tests/unit/inputStateMachine.test.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InputStateMachine } from '../../src/components/agent/runtime/inputStateMachine.ts'

describe('InputStateMachine', () => {
  let sm
  let onChange
  beforeEach(() => {
    onChange = vi.fn()
    sm = new InputStateMachine({ onChange })
  })

  describe('action() 推导', () => {
    it('idle + 无内容 → idle', () => {
      sm.load('c1')
      expect(sm.action()).toBe('idle')
    })
    it('idle + 有草稿 → send', () => {
      sm.load('c1', { draft: '你好' })
      expect(sm.action()).toBe('send')
    })
    it('idle + 有附件 → send', () => {
      sm.load('c1', { attachments: [{ id: 'a1' }] })
      expect(sm.action()).toBe('send')
    })
    it('运行中(planning) + 无内容 → stop', () => {
      sm.load('c1', { status: 'planning' })
      expect(sm.action()).toBe('stop')
    })
    it('运行中(running) + 有内容 → steer', () => {
      sm.load('c1', { status: 'running', draft: '补充一下' })
      expect(sm.action()).toBe('steer')
    })
    it('stopping → stopping（按钮禁用）', () => {
      sm.load('c1', { status: 'stopping' })
      expect(sm.action()).toBe('stopping')
    })
    it('failed + 无内容 → idle', () => {
      sm.load('c1', { status: 'failed' })
      expect(sm.action()).toBe('idle')
    })
    it('failed + 有内容 → retry', () => {
      sm.load('c1', { status: 'failed', draft: '重试' })
      expect(sm.action()).toBe('retry')
    })
    it('created_nodes / ready 也属 RUNNING → stop', () => {
      sm.load('c1', { status: 'creating_nodes' })
      expect(sm.action()).toBe('stop')
      sm.load('c1', { status: 'ready' })
      expect(sm.action()).toBe('stop')
    })
  })

  describe('load() 按对话隔离', () => {
    it('不同 conversationId 互不影响', () => {
      const a = new InputStateMachine()
      const b = new InputStateMachine()
      a.load('c1', { draft: 'A草稿', status: 'running' })
      b.load('c2', { draft: 'B草稿', status: 'idle' })
      expect(a.snapshot().draft).toBe('A草稿')
      expect(b.snapshot().draft).toBe('B草稿')
      expect(a.action()).toBe('steer') // running + 有内容 → steer
      expect(b.action()).toBe('send') // idle + 有内容 → send
    })
    it('空 conversationId 落入 default', () => {
      sm.load('')
      expect(sm.conversationId).toBe('default')
    })
    it('draft/attachments 缺失时给默认值', () => {
      const snap = sm.load('c1', { status: 'running' })
      expect(snap.draft).toBe('')
      expect(snap.attachments).toEqual([])
    })
    it('attachments 非数组被规整为 []', () => {
      const snap = sm.load('c1', { attachments: 'bad' })
      expect(Array.isArray(snap.attachments)).toBe(true)
      expect(snap.attachments).toEqual([])
    })
  })

  describe('setStatus() 归一', () => {
    it('completed 归一为 idle', () => {
      sm.load('c1', { status: 'running' })
      sm.setStatus('completed')
      expect(sm.snapshot().status).toBe('idle')
    })
    it('stopped 归一为 idle', () => {
      sm.load('c1', { status: 'running' })
      sm.setStatus('stopped')
      expect(sm.snapshot().status).toBe('idle')
    })
    it('其他状态原样保留', () => {
      sm.setStatus('planning')
      expect(sm.snapshot().status).toBe('planning')
    })
    it('空/未定义状态回落 idle', () => {
      sm.setStatus()
      expect(sm.snapshot().status).toBe('idle')
    })
  })

  describe('consume() 清空并返回负载', () => {
    it('发送后草稿/附件清空', () => {
      sm.load('c1', { draft: ' 你好 ', attachments: [{ id: 'a1' }] })
      const payload = sm.consume()
      expect(payload.text).toBe('你好') // 去除首尾空白
      expect(payload.attachments).toEqual([{ id: 'a1' }])
      expect(sm.snapshot().draft).toBe('')
      expect(sm.snapshot().attachments).toEqual([])
    })
  })

  describe('emit() 回调', () => {
    it('setDraft 触发 onChange(snapshot, action)', () => {
      sm.load('c1')
      sm.setDraft('hi')
      expect(onChange).toHaveBeenCalled()
      const [snap, action] = onChange.mock.lastCall
      expect(snap.draft).toBe('hi')
      expect(action).toBe('send')
    })
    it('start(workflow) 设置 workflow.status', () => {
      sm.start({ status: 'planning', foo: 1 })
      expect(sm.snapshot().status).toBe('planning')
      expect(sm.snapshot().workflow).toMatchObject({ foo: 1 })
      expect(sm.action()).toBe('stop')
    })
    it('无 onChange 时不抛错', () => {
      const bare = new InputStateMachine()
      expect(() => bare.setDraft('x')).not.toThrow()
    })
  })
})
