import { vi } from 'vitest'

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

// Node 原生 fetch 在 globalThis 上可能为不可配置属性，vi.stubGlobal 会静默失败。
// 用 defineProperty 强制覆盖为一个共享 mock（默认无实现，返回 undefined）。
// 各测试文件通过 globalThis.fetch 取用，并在 beforeEach 用 mockClear() / 在用例内
// mockResolvedValue / mockRejectedValue / mockImplementation 设定行为。
// 注意：此前尝试 passthrough（默认调真实 fetch）会破坏 imageApi/imageCompress 等（真实 URL
// 解析报错），故保持默认无实现。依赖真实网络的既有测试若失败属其自身问题（与 fetch mock 无关）。
if (typeof globalThis.fetch === 'function' || globalThis.fetch === undefined) {
  Object.defineProperty(globalThis, 'fetch', {
    value: vi.fn(),
    configurable: true,
    writable: true,
  })
}

// jsdom 不实现 Element.prototype.scrollTo / scrollIntoView，
// 聊天面板、节点面板等组件在 effect 里调用会抛 "not implemented" 导致测试崩。
if (typeof globalThis.Element !== 'undefined' && !globalThis.Element.prototype.scrollTo) {
  globalThis.Element.prototype.scrollTo = function () {}
}
if (typeof globalThis.HTMLElement !== 'undefined' && !globalThis.HTMLElement.prototype.scrollIntoView) {
  globalThis.HTMLElement.prototype.scrollIntoView = function () {}
}

// ── 测试态 logger 安静化 ──
// 生产 logger.js 对 info/warn/error 无条件 console 输出（生成/同步/素材上传等高频埋点），
// 全量跑会刷屏、淹没真实断言失败。这里在测试态按「logger 专属前缀」精确过滤掉这些行，
// 保留其余 console 输出与 React/Vitest 的真实 warning/error，不影响失败可见性。
// logger 前缀形如 `[info] 11:24:10 | 分类 | 动作 | {...}`（格式见 src/components/base/logger.js）。
const __isLoggerLine = (args) =>
  typeof args?.[0] === 'string' && /^\[(log|info|warn|error|debug)\]\s+\d{2}:\d{2}:\d{2}/.test(args[0])
const __consoleIO = { log: console.log, warn: console.warn, error: console.error }
console.log = (...a) => { if (!__isLoggerLine(a)) __consoleIO.log(...a) }
console.warn = (...a) => { if (!__isLoggerLine(a)) __consoleIO.warn(...a) }
console.error = (...a) => { if (!__isLoggerLine(a)) __consoleIO.error(...a) }
