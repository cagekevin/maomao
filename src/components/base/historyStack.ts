/**
 * 画布撤销/重做历史栈（纯类，无 React 依赖）。
 *
 * 【为什么抽成纯类】原逻辑写死在 useCanvasHistory（React hook）里，无法脱离 React 单测、
 * 也难以复用。抽成纯类后：
 *  - 逻辑可独立单测（本目录 historyStack.test.js）
 *  - hook 用 ref 持有实例，仅做「状态变化 → setState」的 React 桥接
 *
 * 【机制】对齐 H_.jsx:475-478,881-925 的 fn/hn/_n/vn：
 *  - MAX=15：历史最多保留 15 条
 *  - push 时若正在 suppress（undo/redo 抑制期）则忽略
 *  - push 截断被 redo 覆盖的分支（branchRef 之后清空）
 *  - undo/redo 移动 index，并进入 suppress（600ms 窗口防重复记录）
 */
export class HistoryStack {
  max: number
  history: unknown[]
  index: number
  suppress: boolean
  branchRef: number

  constructor({ max = 15 }: { max?: number } = {}) {
    this.max = max
    this.history = []
    this.index = -1
    this.suppress = false
    this.branchRef = -1
  }

  get canUndo(): boolean {
    return this.index > 0
  }

  get canRedo(): boolean {
    return this.index < this.history.length - 1
  }

  /** 记录一次画布变化；suppress 期忽略；截断被 redo 覆盖的分支 */
  push(snapshot: unknown): void {
    if (this.suppress) return
    // 截断 branchRef 之后的分支（redo 覆盖后再改 → 新分支）
    const next = this.history.slice(0, this.branchRef + 1)
    next.push(snapshot)
    if (next.length > this.max) next.shift()
    this.history = next
    this.index = Math.min(this.index + 1, this.max - 1)
    this.branchRef = this.index
  }

  /** 撤销：返回应应用的快照（index 前移）并进入 suppress；无则返回 null */
  undo(): unknown | null {
    if (this.index <= 0) return null
    this.suppress = true
    const snap = this.history[this.index - 1]
    this.index -= 1
    this.branchRef = this.index
    return snap
  }

  /** 重做：返回应应用的快照（index 后移）并进入 suppress；无则返回 null */
  redo(): unknown | null {
    if (this.index >= this.history.length - 1) return null
    this.suppress = true
    const snap = this.history[this.index + 1]
    this.index += 1
    this.branchRef = this.index
    return snap
  }

  /** 退出 suppress（undo/redo 的 600ms 延迟窗口结束后调用） */
  releaseSuppress(): void {
    this.suppress = false
  }

  /** 清空（切换/新建项目时调用，避免跨项目残留撤销栈） */
  clear(): void {
    this.history = []
    this.index = -1
    this.branchRef = -1
    this.suppress = false
  }
}