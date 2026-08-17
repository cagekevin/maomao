// 测试环境准备：为 node 环境注入内存版 localStorage / sessionStorage，
// 使 storageAdapter(sGet/sSet)、projectStore、conversationStore 等依赖 localStorage 的模块可测。
class MemStorage {
  constructor() { this.map = new Map() }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null }
  setItem(k, v) { this.map.set(k, String(v)) }
  removeItem(k) { this.map.delete(k) }
  clear() { this.map.clear() }
  key(i) { return Array.from(this.map.keys())[i] ?? null }
  get length() { return this.map.size }
}

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = new MemStorage()
}
if (typeof globalThis.sessionStorage === 'undefined') {
  globalThis.sessionStorage = new MemStorage()
}

// jsdom 环境缺 ResizeObserver / matchMedia / canvas.getContext，
// 部分组件（GridSplit/GridMerge 用 ResizeObserver 做自适应高度、节点面板用 matchMedia）会崩。
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub
}
if (typeof globalThis.matchMedia === 'undefined') {
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
}
if (typeof globalThis.HTMLCanvasElement !== 'undefined' && !globalThis.HTMLCanvasElement.prototype.getContext) {
  globalThis.HTMLCanvasElement.prototype.getContext = () => ({})
}
