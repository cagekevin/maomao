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
// 用 defineProperty 强制覆盖为一个共享「响铃 fetch」mock（见下）。各测试文件通过
// globalThis.fetch 取用，并在 beforeEach 用 mockClear() / 在用例内 mockResolvedValue(-Once)
// / mockImplementation 设定行为。
// 注意：此前尝试 passthrough（默认调真实 fetch）会破坏 imageApi/imageCompress 等（真实 URL
// 解析报错），故保持默认无真实实现。依赖真实网络的既有测试若失败属其自身问题（与 fetch mock 无关）。
//
// 【响铃设计】默认实现为「漏 stub 即抛错」：若某次 fetch 调用没有对应 mock 响应（既没
// mockResolvedValue(-Once) 配置且队列已空），立即抛出带 URL 与用法的错误，替代原先「静默
// 返回 undefined → 断言糊死、真因（漏 stub）不可见」。这让遗漏 stub 的失败"响亮"暴露，
// 而不是把开发者引向一边翻日志一边猜。已显式 mockResolvedValue 的测试不受影响。
if (typeof globalThis.fetch === 'function' || globalThis.fetch === undefined) {
  const __loudFetch = vi.fn((input, _init) => {
    const url = typeof input === 'string' ? input : (input?.url ?? String(input))
    throw new Error(
      '[测试基建·响铃fetch] 该次 fetch 未配置任何 mock 响应即被调用。\n' +
        `  调用 URL: ${url}\n` +
        '  修正：在该调用前用 fetchMock.mockResolvedValue(...) / mockResolvedValueOnce(...)' +
        ' / mockImplementation(...) 设定响应；若该调用确无需响应，请显式 mockResolvedValue 兜底。'
    )
  })
  Object.defineProperty(globalThis, 'fetch', {
    value: __loudFetch,
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

// jsdom 对 <a download> 不支持导航：剪贴板下载（downloadUrl/downloadBlob）用
// createObjectURL + a.click() 触发，jsdom 会尝试导航并刷 "Not implemented: navigation"
// 栈噪音（clipboard.test.js）。把 a.click() 置空，保留<a>的创建/download/URL 释放断言，
// 从源头杜绝导航尝试。fireEvent.click 走事件派发而非原型 .click()，不受影响。
if (typeof globalThis.HTMLAnchorElement !== 'undefined' && !globalThis.HTMLAnchorElement.prototype.click.__stubbed) {
  globalThis.HTMLAnchorElement.prototype.click = () => {}
  globalThis.HTMLAnchorElement.prototype.click.__stubbed = true
}

// ── 测试态 logger 降噪（分层：滤噪音，保失败信号）──
// 生产 logger.js 对 log/info/warn/debug/error 无条件 console 输出（生成/同步/素材上传等
// 高频埋点）。全量跑会刷屏、淹没真实断言失败，故按「logger 专属前缀」过滤噪音级。
// 关键：只滤 log/info/warn/debug（高频刷屏），放行 error——error 是稀缺的高价值失败信号，
// 业务用 logger.error 记录「为何失败」的根因；若一并滤掉，出错时只能翻日志 grep 才找得到，
// 违反「失败可见」原则。断言失败由 vitest 单独捕获，且此处只动 console 不影响它。
// logger 前缀形如 `[info] 11:24:10 | 分类 | 动作 | {...}`（格式见 src/components/base/logger.js）。
const __isLoggerNoise = (args) =>
  typeof args?.[0] === 'string' && /^\[(log|info|warn|debug)\]\s+\d{2}:\d{2}:\d{2}/.test(args[0])

// 已知良性测试噪音（jsdom / 测试隔离产物，非真实失败；断言失败由 vitest 单独捕获，
// 所以丢弃这些 console 行不影响失败可见性）：
// 1) React act 警告：异步媒体事件/外部 store 驱动的重渲染落在 act 窗口之外，测试已用
//    waitFor 或同步断言收口（VideoProcessNode 的 <video>、agentPersistRecovery 的 store 异步）。
// 2) jsdom 不识别 SVG 命名空间标签 <g>/<path>（CustomEdge/ConnectionLine/Comet）——React 渲染正确，仅 jsdom 日志噪音。
// 3) THREE.WARNING 多实例——vitest fork 每 worker 独立进程各载一份 three，隔离造成的假阳性。
const __isBenignNoise = (s) =>
  /was not wrapped in act\(/u.test(s) ||
  /is unrecognized in this browser/u.test(s) ||
  /THREE\.WARNING: Multiple instances of Three\.js/u.test(s)

const __consoleIO = { log: console.log, warn: console.warn, error: console.error }
const __pass = (level, ...a) => {
  const msg = a.map((x) => (typeof x === 'string' ? x : x instanceof Error ? x.message : String(x))).join(' ')
  // 两层过滤，职责分离：
  //  1) __isBenignNoise：jsdom/测试隔离环境噪音，任何层级都滤（act/SVG/THREE 都走 console.error）。
  //  2) __isLoggerNoise：高频业务日志，只滤 log/info/warn/debug；error 放行（稀缺失败信号）。
  if (__isBenignNoise(msg) || (level !== 'error' && __isLoggerNoise(a))) return
  __consoleIO[level](...a)
}
console.log = (...a) => __pass('log', ...a)
console.warn = (...a) => __pass('warn', ...a)
console.error = (...a) => __pass('error', ...a)
