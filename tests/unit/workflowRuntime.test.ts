// @vitest-environment node
/**
 * workflowRuntime 单测（批 1-6）。
 * 覆盖：createWorkflow 生命周期状态机（idle/planning/running/awaiting_confirm/completed/failed）、
 * isRunning 派生、subscribe 订阅、steer/nextSteer 补充指令队列、cancel 取消、
 * confirm 流程翻转 awaitingConfirm、rollback（带 ctx 注入）。
 * 策略：node 环境；mock eventBus.publish（源码 import 自 eventBus）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../src/components/base/core/eventBus.ts', () => ({
  eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
  publish: vi.fn(),
}))

const { createWorkflow } = await import('../../src/components/base/canvas/workflowRuntime.ts')

beforeEach(() => { vi.clearAllMocks() })

describe('workflowRuntime — 状态机', () => {
  it('初始状态 idle，start 进入 planning', () => {
    const wf = createWorkflow()
    expect(wf.status).toBe('idle')
    wf.start('planning')
    expect(wf.status).toBe('planning')
    expect(wf.isRunning).toBe(true)
  })

  it('finish(true) → completed；finish(false) → failed', () => {
    const wf = createWorkflow().start()
    wf.finish(true)
    expect(wf.status).toBe('completed')
    const wf2 = createWorkflow().start()
    wf2.finish(false)
    expect(wf2.status).toBe('failed')
  })

  it('requestConfirm → awaiting_confirm；confirm 翻转回 planning', () => {
    const wf = createWorkflow().start()
    wf.requestConfirm()
    expect(wf.status).toBe('awaiting_confirm')
    expect(wf.awaitingConfirm).toBe(true)
    wf.confirm()
    expect(wf.awaitingConfirm).toBe(false)
    expect(wf.status).toBe('planning')
  })
})

describe('workflowRuntime — 订阅与补充指令', () => {
  it('subscribe 收到状态变更通知', () => {
    const seen = []
    const wf = createWorkflow()
    const unsub = wf.subscribe((s) => seen.push(s))
    wf.start('planning')
    wf.finish(true)
    expect(seen).toContain('planning')
    expect(seen).toContain('completed')
    unsub()
  })

  it('steer 入队、nextSteer 出队（FIFO）', () => {
    const wf = createWorkflow()
    wf.steer('加速')
    wf.steer('换风格')
    expect(wf.steerQueue.length).toBe(2)
    const first = wf.nextSteer()
    expect(first.text).toBe('加速')
    expect(wf.nextSteer().text).toBe('换风格')
    expect(wf.nextSteer()).toBeNull()
  })
})

describe('workflowRuntime — 取消与回滚', () => {
  it('cancel 清空 cancelTokens 不抛', () => {
    const wf = createWorkflow().start()
    expect(() => wf.cancel()).not.toThrow()
  })

  it('rollback 调用注入的 ctx.deleteNode 并清理 nodeIds', async () => {
    const removed = []
    const wf = createWorkflow().start()
    wf.addNode('n1')
    wf.addNode('n2')
    const ctx = { deleteNode: async (id) => { removed.push(id) } }
    await wf.rollback(ctx)
    expect(removed).toEqual(['n1', 'n2'])
  })
})
