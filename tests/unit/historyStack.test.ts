import { describe, it, expect } from 'vitest'
import { HistoryStack } from '../../src/components/base/historyStack.ts'

// §2.3 画布历史栈（撤销/重做）：规划 §3.1 的 useCanvasHistory.test.js 遗漏项。
// 核心逻辑已从 React hook 下沉为纯类 HistoryStack，可直接单测。

function pushN(stack, n) {
  for (let i = 1; i <= n; i++) stack.push({ i })
}

describe('HistoryStack 基础 push/canUndo/canRedo', () => {
  it('初始：空栈，不能撤销/重做', () => {
    const s = new HistoryStack()
    expect(s.canUndo).toBe(false)
    expect(s.canRedo).toBe(false)
  })

  it('push 一条：index=0，可重做不可撤销（分支截断逻辑），再 push 后可见', () => {
    const s = new HistoryStack()
    s.push({ i: 1 })
    expect(s.canUndo).toBe(false) // 只有一条，无法撤到更早
    expect(s.history).toHaveLength(1)
  })

  it('连续 push：canUndo 变为 true，history 递增', () => {
    const s = new HistoryStack()
    pushN(s, 3)
    expect(s.canUndo).toBe(true)
    expect(s.history).toHaveLength(3)
  })
})

describe('HistoryStack MAX=15 上限', () => {
  it('push 超过 MAX 时移除最早一条，index 封顶', () => {
    const s = new HistoryStack({ max: 15 })
    pushN(s, 20)
    expect(s.history).toHaveLength(15)
    // 最早的 5 条被挤出
    expect(s.history[0].i).toBe(6)
    expect(s.history.at(-1).i).toBe(20)
  })
})

describe('HistoryStack undo/redo', () => {
  it('undo 返回上一步快照，index 前移', () => {
    const s = new HistoryStack()
    pushN(s, 3)
    const snap = s.undo()
    expect(snap.i).toBe(2)
    expect(s.canRedo).toBe(true)
  })

  it('redo 返回下一步快照，index 后移', () => {
    const s = new HistoryStack()
    pushN(s, 3)
    s.undo()
    s.undo()
    const snap = s.redo()
    expect(snap.i).toBe(2)
    expect(s.canUndo).toBe(true)
  })

  it('undo 到最前返回 null（不能再撤）', () => {
    const s = new HistoryStack()
    pushN(s, 2)
    s.undo()
    expect(s.undo()).toBeNull()
    expect(s.canUndo).toBe(false)
  })

  it('redo 到最后返回 null（不能再重做）', () => {
    const s = new HistoryStack()
    pushN(s, 2)
    s.undo()
    s.redo()
    expect(s.redo()).toBeNull()
    expect(s.canRedo).toBe(false)
  })
})

describe('HistoryStack 分支截断 + suppress', () => {
  it('undo 后 push 新分支 → 截断被覆盖的 redo 分支', () => {
    const s = new HistoryStack()
    pushN(s, 3) // 1,2,3
    s.undo() // index 指向 1
    s.releaseSuppress()
    s.push({ i: 'new' }) // 分支截断：清掉 3，新增 new
    expect(s.history).toEqual([{ i: 1 }, { i: 2 }, { i: 'new' }])
    expect(s.canRedo).toBe(false)
  })

  it('suppress 期间 push 被忽略（undo/redo 抑制窗口）', () => {
    const s = new HistoryStack()
    pushN(s, 3)
    s.undo() // 进入 suppress
    s.push({ i: 'ignored' })
    expect(s.history).toHaveLength(3)
    expect(s.history.at(-1).i).toBe(3)
  })

  it('releaseSuppress 后可正常 push', () => {
    const s = new HistoryStack()
    pushN(s, 3)
    s.undo()
    s.releaseSuppress()
    s.push({ i: 4 })
    expect(s.history.at(-1).i).toBe(4)
  })
})

describe('HistoryStack clear', () => {
  it('clear 重置为空栈', () => {
    const s = new HistoryStack()
    pushN(s, 5)
    s.clear()
    expect(s.history).toHaveLength(0)
    expect(s.canUndo).toBe(false)
    expect(s.canRedo).toBe(false)
  })
})
