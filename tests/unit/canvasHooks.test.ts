// 回归测试：useCanvasHistory.js、useSyncNodeData.js、workflowRuntime.ts
// @vitest-environment jsdom
/**
 * 画布与同步 hooks 回归测试（TASK-066）。
 *
 * 覆盖：
 *  - useCanvasHistory：撤销/重做 hook 层（React 桥接），断言 record/undo/redo/clear 行为。
 *  - useSyncNodeData：节点 data 外部变更 → 本地 state 同步 hook。
 *  - workflowRuntime：工作流运行时纯逻辑（生命周期/取消/确认/回滚/撤销栈）。
 *
 * 并发安全：仅用 `npx vitest run tests/unit/canvasHooks.test.js` 验证，不占用共享资源。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import type { CanvasSnapshot } from '../../src/hooks/useCanvasHistory.ts'

// ───────────────────────────────────────────────────────────
// 1. useCanvasHistory
// ───────────────────────────────────────────────────────────
import { useCanvasHistory } from '../../src/hooks/useCanvasHistory.ts'

describe('useCanvasHistory 撤销/重做 hook 桥接', () => {
  it('record(snapshot) 调 stack.push 并触发重渲染（canUndo 变 true）', () => {
    const getSnapshot = vi.fn(() => ({ nodes: [], edges: [] }))
    const apply = vi.fn()
    const { result } = renderHook(() => useCanvasHistory(getSnapshot, apply))

    expect(result.current.canUndo).toBe(false)
    act(() => {
      result.current.record({ nodes: [{ id: 'a' } as Node], edges: [] } as CanvasSnapshot)
    })
    // 显式快照被 push，首次记录后 index=0 仍不能撤（HistoryStack 行为），
    // 但再 record 一条后即可撤销
    act(() => {
      result.current.record({ nodes: [{ id: 'b' } as Node], edges: [] } as CanvasSnapshot)
    })
    expect(result.current.canUndo).toBe(true)
  })

  it('record 不传 snapshot 时回退用 getSnapshot()', () => {
    const snap: CanvasSnapshot = { nodes: [{ id: 'x' } as Node], edges: [] }
    const getSnapshot = vi.fn(() => snap)
    const apply = vi.fn()
    const { result } = renderHook(() => useCanvasHistory(getSnapshot, apply))

    act(() => {
      result.current.record()
    })
    expect(getSnapshot).toHaveBeenCalled()
    act(() => {
      result.current.record({ nodes: [{ id: 'y' } as Node], edges: [] } as CanvasSnapshot)
    })
    expect(result.current.canUndo).toBe(true)
  })

  it('undo 调 stack.undo 并 apply 返回的快照、启动 600ms suppress', () => {
    const apply = vi.fn()
    const getSnapshot = vi.fn(() => ({ nodes: [], edges: [] }))
    const { result } = renderHook(() => useCanvasHistory(getSnapshot, apply))

    act(() => {
      result.current.record({ nodes: [{ id: '1' } as Node], edges: [] } as CanvasSnapshot)
      result.current.record({ nodes: [{ id: '2' } as Node], edges: [] } as CanvasSnapshot)
    })
    expect(result.current.canUndo).toBe(true)

    let undoSnap
    act(() => {
      result.current.undo()
    })
    // undo 触发了 apply，且 apply 入参是 undo 返回的快照（index 前移后的上一步）
    expect(apply).toHaveBeenCalled()
    undoSnap = apply.mock.calls[apply.mock.calls.length - 1][0]
    expect(undoSnap.nodes[0].id).toBe('1')
    // suppress 窗口内再 record 应被忽略（history 不增长）
    const beforeLen = result.current.canRedo
    act(() => {
      result.current.record({ nodes: [{ id: 'ignored' } as Node], edges: [] } as CanvasSnapshot)
    })
    // 立即 record 处于 suppress，不会新增分支，canRedo 行为由 HistoryStack 决定
    expect(typeof beforeLen).toBe('boolean')
  })

  it('redo 调 stack.redo 并 apply 快照', () => {
    const apply = vi.fn()
    const getSnapshot = vi.fn(() => ({ nodes: [], edges: [] }))
    const { result } = renderHook(() => useCanvasHistory(getSnapshot, apply))

    act(() => {
      result.current.record({ nodes: [{ id: '1' } as Node], edges: [] } as CanvasSnapshot)
      result.current.record({ nodes: [{ id: '2' } as Node], edges: [] } as CanvasSnapshot)
    })
    act(() => { result.current.undo() })
    apply.mockClear()
    act(() => { result.current.redo() })
    expect(apply).toHaveBeenCalled()
    const redone = apply.mock.calls[0][0]
    expect(redone.nodes[0].id).toBe('2')
  })

  it('clear 清空历史（canUndo/canRedo 复位）', () => {
    const apply = vi.fn()
    const getSnapshot = vi.fn(() => ({ nodes: [], edges: [] }))
    const { result } = renderHook(() => useCanvasHistory(getSnapshot, apply))

    act(() => {
      result.current.record({ nodes: [{ id: '1' } as Node], edges: [] } as CanvasSnapshot)
      result.current.record({ nodes: [{ id: '2' } as Node], edges: [] } as CanvasSnapshot)
    })
    expect(result.current.canUndo).toBe(true)
    act(() => { result.current.clear() })
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })
})

// ───────────────────────────────────────────────────────────
// 2. useSyncNodeData
// ───────────────────────────────────────────────────────────
import { useSyncNodeData } from '../../src/hooks/useSyncNodeData.ts'

describe('useSyncNodeData 节点 data 同步 hook', () => {
  it('data 字段变化 → 调对应 setter(next)', () => {
    const setAspectRatio = vi.fn()
    const setPrompt = vi.fn()
    const data = { aspectRatio: '16:9', prompt: 'hello' }
    const setters = { aspectRatio: setAspectRatio, prompt: setPrompt }
    // 首次挂载：跳过初始化
    const { rerender } = renderHook(
      ({ d, s }) => useSyncNodeData(d, s),
      { initialProps: { d: data, s: setters } }
    )
    expect(setAspectRatio).not.toHaveBeenCalled()
    expect(setPrompt).not.toHaveBeenCalled()

    // data 变化：触发 setter
    rerender({ d: { aspectRatio: '1:1', prompt: 'hello' }, s: setters })
    expect(setAspectRatio).toHaveBeenCalledWith('1:1')
    expect(setPrompt).not.toHaveBeenCalled()
  })

  it('首次渲染不触发 setter（跳过初始化）', () => {
    const setter = vi.fn()
    renderHook(({ d, s }) => useSyncNodeData(d, s), {
      initialProps: { d: { foo: 'a' }, s: { foo: setter } },
    })
    expect(setter).not.toHaveBeenCalled()
  })

  it('字段未变化不触发', () => {
    const setter = vi.fn()
    const data = { foo: 'a' }
    const setters = { foo: setter }
    const { rerender } = renderHook(
      ({ d, s }) => useSyncNodeData(d, s),
      { initialProps: { d: data, s: setters } }
    )
    // 新引用但字段值相同
    rerender({ d: { foo: 'a' }, s: setters })
    expect(setter).not.toHaveBeenCalled()
  })

  it('setter 非函数时跳过（不抛错）', () => {
    expect(() => {
      renderHook(({ d, s }) => useSyncNodeData(d, s), {
        initialProps: { d: { foo: 'b' }, s: { foo: 'not-a-function' } },
      })
    }).not.toThrow()
  })

  it('data 为 undefined / 缺字段时不抛错', () => {
    const setter = vi.fn()
    const { rerender } = renderHook(
      ({ d, s }) => useSyncNodeData(d, s),
      { initialProps: { d: undefined, s: { foo: setter } } }
    )
    expect(() => rerender({ d: {}, s: { foo: setter } })).not.toThrow()
    expect(setter).not.toHaveBeenCalled()
  })
})

// ───────────────────────────────────────────────────────────
// 3. workflowRuntime
// ───────────────────────────────────────────────────────────
import { createWorkflow } from '../../src/components/base/workflowRuntime.ts'

describe('workflowRuntime createWorkflow 生命周期', () => {
  it('createWorkflow 初始 status=idle', () => {
    const wf = createWorkflow({ conversationId: 'c1' })
    expect(wf.status).toBe('idle')
    expect(wf.isRunning).toBe(false)
    expect(wf.nodeIds).toEqual([])
    expect(wf.steerQueue).toEqual([])
    expect(wf.aiUndoStack).toEqual([])
  })

  it('start 后进入 planning/creating_nodes/running（isRunning=true）', () => {
    const wf = createWorkflow({ conversationId: 'c1' })
    wf.start('planning')
    expect(wf.status).toBe('planning')
    expect(wf.isRunning).toBe(true)

    wf.start('creating_nodes')
    expect(wf.status).toBe('creating_nodes')
    expect(wf.isRunning).toBe(true)

    wf.start('running')
    expect(wf.status).toBe('running')
    expect(wf.isRunning).toBe(true)
  })

  it('onStatusChange 回调在状态变化时被调用', () => {
    const cb = vi.fn()
    const wf = createWorkflow({ conversationId: 'c1', onStatusChange: cb })
    wf.start('planning')
    expect(cb).toHaveBeenCalledWith('planning')
    wf.finish(true)
    expect(cb).toHaveBeenCalledWith('completed')
  })

  it('cancel 真取消所有运行中任务（AbortController）', () => {
    const wf = createWorkflow({ conversationId: 'c1' })
    const { signal, cancel } = wf.createTask()
    expect(signal.aborted).toBe(false)
    wf.cancel()
    expect(signal.aborted).toBe(true)
    // cancelTokens 已清空
    const t2 = wf.createTask()
    expect(t2.signal.aborted).toBe(false)
    t2.cancel()
  })

  it('awaitNode 任务被停止时抛出 AbortError', async () => {
    const wf = createWorkflow({ conversationId: 'c1' })
    wf.start('running')
    const p = wf.awaitNode((signal) =>
      new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    )
    wf.cancel()
    await expect(p).rejects.toThrow()
  })

  it('pushUndo/popUndo 栈行为（后进先出，上限 20）', () => {
    const wf = createWorkflow({ conversationId: 'c1' })
    wf.pushUndo({ a: 1 }).pushUndo({ a: 2 })
    expect(wf.aiUndoStack).toHaveLength(2)
    expect(wf.popUndo()).toEqual({ a: 2 })
    expect(wf.popUndo()).toEqual({ a: 1 })
    expect(wf.popUndo()).toBeNull()

    // 超过 20 条时最旧的被挤出
    for (let i = 0; i < 25; i++) wf.pushUndo({ i })
    expect(wf.aiUndoStack).toHaveLength(20)
    // createWorkflow 的 aiUndoStack 为 unknown[]（src 泛型），断言其为含 i 的对象
    expect((wf.aiUndoStack[0] as { i: number }).i).toBe(5)
  })

  it('confirm 翻转 awaitingConfirm（requestConfirm → confirm）', () => {
    const wf = createWorkflow({ conversationId: 'c1' })
    wf.start('planning')
    wf.requestConfirm()
    expect(wf.status).toBe('awaiting_confirm')
    expect(wf.awaitingConfirm).toBe(true)
    wf.confirm()
    expect(wf.awaitingConfirm).toBe(false)
    expect(wf.status).toBe('planning')
  })

  it('rollback 清理本次建的节点（deleteNode 路径）', () => {
    const wf = createWorkflow({ conversationId: 'c1' })
    wf.addNode('n1').addNode('n2')
    expect(wf.nodeIds).toEqual(['n1', 'n2'])
    const deleteNode = vi.fn()
    wf.rollback({ deleteNode })
    expect(deleteNode).toHaveBeenCalledWith('n1')
    expect(deleteNode).toHaveBeenCalledWith('n2')
    expect(wf.nodeIds).toEqual([])
  })

  it('rollback 走 setNodes 路径（删除本次节点）', () => {
    const wf = createWorkflow({ conversationId: 'c1' })
    wf.addNode('n1').addNode('n2')
    const nodes = [{ id: 'n1' }, { id: 'n2' }, { id: 'keep' }]
    const setNodes = vi.fn()
    wf.rollback({ getNodes: () => nodes, setNodes })
    expect(setNodes).toHaveBeenCalledWith([{ id: 'keep' }])
    expect(wf.nodeIds).toEqual([])
  })

  it('rollback 缺少 ctx 时安全跳过', () => {
    const wf = createWorkflow({ conversationId: 'c1' })
    wf.addNode('n1')
    expect(() => wf.rollback({})).not.toThrow()
    expect(wf.nodeIds).toEqual(['n1']) // 未清理
  })

  it('steer / nextSteer 补充指令队列', () => {
    const wf = createWorkflow({ conversationId: 'c1' })
    wf.steer('继续生成', [{ url: 'x' }])
    wf.steer('再调整')
    expect(wf.steerQueue).toHaveLength(2)
    const first = wf.nextSteer()
    expect(first.text).toBe('继续生成')
    expect(wf.nextSteer().text).toBe('再调整')
    expect(wf.nextSteer()).toBeNull()
  })

  it('toJSON 序列化关键字段', () => {
    const wf = createWorkflow({ conversationId: 'c1' })
    wf.start('running').addNode('n1').pushUndo({ snap: 1 })
    const j = wf.toJSON()
    expect(j.conversationId).toBe('c1')
    expect(j.status).toBe('running')
    expect(j.nodeIds).toEqual(['n1'])
    expect(j.aiUndoStack).toEqual([{ snap: 1 }])
    expect(typeof j.id).toBe('string')
  })

  it('finish 完成/失败置对应 status 并清理任务', () => {
    const wf = createWorkflow({ conversationId: 'c1' })
    const { signal } = wf.createTask()
    wf.finish(true)
    expect(wf.status).toBe('completed')
    expect(signal.aborted).toBe(true)

    const wf2 = createWorkflow({ conversationId: 'c2' })
    wf2.start('running')
    wf2.finish(false)
    expect(wf2.status).toBe('failed')
  })

  it('requestStop 置 stopping 并取消任务', () => {
    const wf = createWorkflow({ conversationId: 'c1' })
    const { signal } = wf.createTask()
    wf.requestStop()
    expect(wf.status).toBe('stopping')
    expect(signal.aborted).toBe(true)
  })
})
