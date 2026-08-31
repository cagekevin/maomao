// @vitest-environment node
/**
 * workflowState 单测（M2 收口）。
 * 覆盖 5 个纯函数迁移动作的 patch 输出：
 *   - wfStart：进 planning + 记 startedAt，支持覆盖 patch
 *   - wfSteer：向当前 workflow.steerQueue 追加 { text, attachments }；无 workflow 时以 running 起步
 *   - wfFinish：ok/aborted → completed/failed/stopped 终态推导
 *   - wfAwaitConfirm：status → awaiting_confirm
 *   - wfNextSteer：队列出队（FIFO），有下一条 → planning 续跑，无 → 维持终态
 * 策略：mock conversationStore.getCurrentWorkflow；patch 为纯返回值，不落盘。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../src/components/agent/conversation/conversationStore.js', () => ({
  getCurrentWorkflow: vi.fn(() => null),
  patchCurrentWorkflow: vi.fn(() => null),
}))

const convStore = await import('../../src/components/agent/conversation/conversationStore.js')
const { wfStart, wfSteer, wfFinish, wfAwaitConfirm, wfNextSteer, WORKFLOW_STATUS } = await import('../../src/components/agent/runtime/workflowState.ts')

beforeEach(() => { vi.clearAllMocks() })

describe('wfStart — 起步', () => {
  it('默认：进 planning、记 startedAt（数字时间戳）', () => {
    const patch = wfStart()
    expect(patch.status).toBe('planning')
    expect(typeof patch.startedAt).toBe('number')
  })

  it('支持覆盖字段（如 status: running）', () => {
    expect(wfStart({ status: 'running' }).status).toBe('running')
  })

  it('不携带 steerQueue——留由 patchCurrentWorkflow 保持既有队列', () => {
    expect('steerQueue' in wfStart()).toBe(false)
  })
})

describe('wfSteer — 补充指令入队', () => {
  it('向当前 workflow.steerQueue 追加；attachments 缺省为 []', () => {
    convStore.getCurrentWorkflow.mockReturnValue({ status: 'running', steerQueue: [{ text: 'a', attachments: [] }] })
    const patch = wfSteer('b', [{ type: 'image', url: 'x' }])
    expect(patch.steerQueue).toHaveLength(2)
    expect(patch.steerQueue[1]).toEqual({ text: 'b', attachments: [{ type: 'image', url: 'x' }] })
    expect(patch.status).toBeUndefined() // 已有 workflow，不额外盖状态
  })

  it('无 workflow 时以 running 起步（与 useAgentChat 原「无则建 running」语义等价）', () => {
    convStore.getCurrentWorkflow.mockReturnValue(null)
    const patch = wfSteer('补充')
    expect(patch.steerQueue).toHaveLength(1)
    expect(patch.steerQueue[0].text).toBe('补充')
    expect(patch.status).toBe('running')
  })

  it('不 mutate 原 workflow 的 steerQueue（基于副本追加）', () => {
    const orig = { steerQueue: [{ text: 'a', attachments: [] }] }
    convStore.getCurrentWorkflow.mockReturnValue(orig)
    wfSteer('b')
    expect(orig.steerQueue).toHaveLength(1)
  })
})

describe('wfFinish — 终态推导', () => {
  it('ok=true → completed', () => { expect(wfFinish(true).status).toBe('completed') })
  it('ok=false, aborted=false → failed', () => { expect(wfFinish(false).status).toBe('failed') })
  it('ok=false, aborted=true → stopped', () => { expect(wfFinish(false, true).status).toBe('stopped') })
})

describe('wfAwaitConfirm — 等待确认', () => {
  it('status → awaiting_confirm', () => { expect(wfAwaitConfirm().status).toBe('awaiting_confirm') })
})

describe('wfNextSteer — 队列出队', () => {
  it('有下一条：出队并置 planning，next 返回该条', () => {
    convStore.getCurrentWorkflow.mockReturnValue({ steerQueue: [{ text: '续', attachments: [] }, { text: '再', attachments: [] }] })
    const { next, patch } = wfNextSteer('completed')
    expect(next.text).toBe('续')
    expect(patch.steerQueue).toHaveLength(1)
    expect(patch.steerQueue[0].text).toBe('再')
    expect(patch.status).toBe('planning')
  })

  it('无下一条：next 为 undefined，维持终态', () => {
    convStore.getCurrentWorkflow.mockReturnValue({ steerQueue: [] })
    const { next, patch } = wfNextSteer('completed')
    expect(next).toBeUndefined()
    expect(patch.steerQueue).toHaveLength(0)
    expect(patch.status).toBe('completed')
  })

  it('无 workflow：按空队列处理，维持终态', () => {
    convStore.getCurrentWorkflow.mockReturnValue(null)
    const { next, patch } = wfNextSteer('failed')
    expect(next).toBeUndefined()
    expect(patch.status).toBe('failed')
  })
})

describe('WORKFLOW_STATUS 登记', () => {
  it('覆盖规划/运行/确认/终态全集', () => {
    expect(WORKFLOW_STATUS).toEqual(
      expect.arrayContaining(['planning', 'running', 'awaiting_confirm', 'stopped', 'completed', 'failed', 'completed_with_errors']),
    )
  })
})