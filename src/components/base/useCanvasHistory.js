import { useState, useRef, useCallback } from 'react'

/**
 * 画布撤销/重做历史栈 hook（复刻 H_.jsx:475-478,881-925 的 fn/hn/_n/vn 机制）。
 *
 * 机制要点（与源码一致）：
 *  - 历史最多保留 MAX=15 条
 *  - 每次「非撤销/重做」触发的画布变化都通过 record() 压栈，并截断被 redo 覆盖的分支
 *  - undo/redo 期间用 suppressRef 抑制重复记录（含 600ms 延迟窗口，复刻源码 setTimeout）
 *
 * @param getSnapshot 返回当前 { nodes, edges } 快照的函数
 * @param apply       应用 { nodes, edges } 到画布
 * @returns { canUndo, canRedo, record, undo, redo }
 */
export function useCanvasHistory(getSnapshot, apply) {
  const MAX = 15
  const [history, setHistory] = useState([])
  const [index, setIndex] = useState(-1)
  const suppressRef = useRef(false)
  const branchRef = useRef(-1)

  // 记录一次画布变化（复刻 H_.jsx:881-897）。
  // snapshot：可显式传入本次操作后的最新 { nodes, edges }。
  // 若不传，则回退用 getSnapshot() 取 ref 里的当前值。
  // 注意：React setState 是异步的，addNode 等「先 setNodes 再 record」的场景，
  // 必须显式传快照，否则 record 会拿到旧的 nodes 导致 undo 丢失新增节点。
  const record = useCallback(
    (snapshot) => {
      if (suppressRef.current) return
      setHistory((h) => {
        const next = h.slice(0, branchRef.current + 1)
        next.push(snapshot || getSnapshot())
        if (next.length > MAX) next.shift()
        return next
      })
      setIndex((i) => {
        const ni = Math.min(i + 1, MAX - 1)
        branchRef.current = ni
        return ni
      })
    },
    [getSnapshot]
  )

  // 撤销（复刻 Gn）
  const undo = useCallback(() => {
    if (index > 0) {
      suppressRef.current = true
      const snap = history[index - 1]
      apply(snap)
      setIndex(index - 1)
      branchRef.current = index - 1
      setTimeout(() => (suppressRef.current = false), 600)
    }
  }, [history, index, apply])

  // 重做（复刻 Kn）
  const redo = useCallback(() => {
    if (index < history.length - 1) {
      suppressRef.current = true
      const snap = history[index + 1]
      apply(snap)
      setIndex(index + 1)
      branchRef.current = index + 1
      setTimeout(() => (suppressRef.current = false), 600)
    }
  }, [history, index, apply])

  // 清空历史（切换/新建项目时调用，避免跨项目残留撤销栈）
  const clear = useCallback(() => {
    setHistory([])
    setIndex(-1)
    branchRef.current = -1
  }, [])

  return { canUndo: index > 0, canRedo: index < history.length - 1, record, undo, redo, clear }
}
