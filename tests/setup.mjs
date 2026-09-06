import { vi } from 'vitest';

/**
 * 浏览器 API 垫片的「有意放行」标注。
 *
 * 为什么需要：本文件补的都是 jsdom/Node 缺失的浏览器 API，但只实现【被测代码真正会调用】的
 * 那几个方法（如 matchMedia 只用 matches + addEventListener），与 lib.dom 的完整接口天然
 * 不对齐（MediaQueryList 还要求 media/onchange/dispatchEvent，RenderingContext 是一堆绘制方法）。
 * 开了 checkJs 后这些「部分垫片」会被 tsc 判为类型不符。
 *
 * 取舍：补齐全部接口既无断言价值（测试永远不会调 media/dispatchEvent），又会随 lib.dom 版本
 * 漂移而反复变红。故统一从这里放行——它唯一的价值是把「有意的部分垫片」与「无心漏实现」区分开：
 * 看到 shim(...) 就知道是刻意的，没有 shim 的同类报错就该真改。
 *
 * @type {(v: any) => any}
 */
const shim = (v) => v;

// 测试环境准备：为 node 环境注入内存版 localStorage / sessionStorage，
// 使 storageAdapter(sGet/sSet)、projectStore、conversationStore 等依赖 localStorage 的模块可测。
class MemStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(k) {
    return this.map.has(k) ? this.map.get(k) : null;
  }
  setItem(k, v) {
    this.map.set(k, String(v));
  }
  removeItem(k) {
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
  key(i) {
    return Array.from(this.map.keys())[i] ?? null;
  }
  get length() {
    return this.map.size;
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = new MemStorage();
}
if (typeof globalThis.sessionStorage === 'undefined') {
  globalThis.sessionStorage = new MemStorage();
}

// jsdom 环境缺 ResizeObserver / matchMedia / canvas.getContext，
// 部分组件（GridSplit/GridMerge 用 ResizeObserver 做自适应高度、节点面板用 matchMedia）会崩。
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub;
}
if (typeof globalThis.matchMedia === 'undefined') {
  // shim：被测代码只用到 matches + add/removeEventListener，不补 media/onchange/dispatchEvent
  globalThis.matchMedia = shim(() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }));
}
if (
  typeof globalThis.HTMLCanvasElement !== 'undefined' &&
  !globalThis.HTMLCanvasElement.prototype.getContext
) {
  // shim：仅满足「getContext 存在且返回对象」，不模拟任何绘制 API（无测试断言绘制结果）
  globalThis.HTMLCanvasElement.prototype.getContext = shim(() => ({}));
}

// jsdom 未实现 HTMLMediaElement（<video>/<audio>）的核心媒体方法（load/play/pause）。
// 注意：jsdom 的 load/play/pause 是「已定义但内部走 not-implemented 抛错」的实现（见
// not-implemented.js），不是完全缺失，因此必须无条件覆盖（不能用 if(!proto.x) 守卫）。
// useVideoPoster 等抓帧逻辑（v.load()）、VideoThumbnail/ImageZoomDialog 播放态（v.play()/pause()）
// 在 jsdom 里会抛 "Not implemented: HTMLMediaElement.prototype.load"。这是 jsdom 共性缺能力
// （与 Win/Mac 无关），统一在此覆盖，保证双平台测试行为一致。
if (typeof globalThis.HTMLMediaElement !== 'undefined') {
  const proto = globalThis.HTMLMediaElement.prototype;
  const mediaStub = () => {};
  proto.load = mediaStub;
  proto.play = () => Promise.resolve();
  proto.pause = mediaStub;
  proto.canPlayType = () => '';
  // 首帧抓取依赖 videoWidth/videoHeight 返回可绘制的尺寸（见 useVideoPoster）；jsdom 默认返回 0，
  // 给一个非 0 默认值使 canvas 绘制路径不因 0 尺寸而异常（getContext 已被 mock）。
  if (!Object.getOwnPropertyDescriptor(proto, 'videoWidth')) {
    Object.defineProperty(proto, 'videoWidth', { configurable: true, get: () => 320 });
  }
  if (!Object.getOwnPropertyDescriptor(proto, 'videoHeight')) {
    Object.defineProperty(proto, 'videoHeight', { configurable: true, get: () => 240 });
  }
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
    const url = typeof input === 'string' ? input : (input?.url ?? String(input));
    throw new Error(
      '[测试基建·响铃fetch] 该次 fetch 未配置任何 mock 响应即被调用。\n' +
        `  调用 URL: ${url}\n` +
        '  修正：在该调用前用 fetchMock.mockResolvedValue(...) / mockResolvedValueOnce(...)' +
        ' / mockImplementation(...) 设定响应；若该调用确无需响应，请显式 mockResolvedValue 兜底。',
    );
  });
  Object.defineProperty(globalThis, 'fetch', {
    value: __loudFetch,
    configurable: true,
    writable: true,
  });
}

// requestAnimationFrame / cancelAnimationFrame 统一垫片：jsdom 默认 rAF 不保证触发时效，
// 组件里用 rAF 做动画/自适应测量时（node 环境无 rAF，jsdom 的 rAF 又常滞后）回调可能永不执行。
// 统一用 setTimeout(cb,0) 可靠地立即触发，并回传时间戳。此前散落在 6 个 .jsx 测试文件里
// 重复手写同一份覆盖（TextNode/PromptNode/TemplateNode/DiscountVideoNode.upstream 等），现收口于此。
// shim：rAF 契约是「返回 number 句柄」，Node 的 setTimeout 返回 Timeout 对象。测试只做
//「注册→触发→取消」，无一处断言句柄类型，故放行返回值差异（cancelAnimationFrame 同侧消费）。
globalThis.requestAnimationFrame = shim((cb) => setTimeout(() => cb(Date.now()), 0));
globalThis.cancelAnimationFrame = shim((id) => clearTimeout(id));

// jsdom 不实现 Element.prototype.scrollTo / scrollIntoView，
// 聊天面板、节点面板等组件在 effect 里调用会抛 "not implemented" 导致测试崩。
if (typeof globalThis.Element !== 'undefined' && !globalThis.Element.prototype.scrollTo) {
  globalThis.Element.prototype.scrollTo = function () {};
}
if (
  typeof globalThis.HTMLElement !== 'undefined' &&
  !globalThis.HTMLElement.prototype.scrollIntoView
) {
  globalThis.HTMLElement.prototype.scrollIntoView = function () {};
}

// jsdom 对 <a download> 不支持导航：剪贴板下载（downloadUrl/downloadBlob）用
// createObjectURL + a.click() 触发，jsdom 会尝试导航并刷 "Not implemented: navigation"
// 栈噪音（clipboard.test.js）。把 a.click() 置空，保留<a>的创建/download/URL 释放断言，
// 从源头杜绝导航尝试。fireEvent.click 走事件派发而非原型 .click()，不受影响。
// shim：给原型方法挂 __stubbed 标记（防重复覆盖），函数类型上本无此属性。
const anchorClick = shim(globalThis.HTMLAnchorElement?.prototype?.click);
if (typeof globalThis.HTMLAnchorElement !== 'undefined' && !anchorClick?.__stubbed) {
  globalThis.HTMLAnchorElement.prototype.click = shim(() => {});
  shim(globalThis.HTMLAnchorElement.prototype.click).__stubbed = true;
}

// ── 测试态 logger 降噪（分层：滤噪音，保失败信号）──
// 生产 logger.js 对 log/info/warn/debug/error 无条件 console 输出（生成/同步/素材上传等
// 高频埋点）。全量跑会刷屏、淹没真实断言失败，故按「logger 专属前缀」过滤噪音级。
// 关键：只滤 log/info/warn/debug（高频刷屏），放行 error——error 是稀缺的高价值失败信号，
// 业务用 logger.error 记录「为何失败」的根因；若一并滤掉，出错时只能翻日志 grep 才找得到，
// 违反「失败可见」原则。断言失败由 vitest 单独捕获，且此处只动 console 不影响它。
// logger 前缀形如 `[info] 11:24:10 | 分类 | 动作 | {...}`（格式见 src/components/base/logger.js）。
const __isLoggerNoise = (args) =>
  typeof args?.[0] === 'string' && /^\[(log|info|warn|debug)\]\s+\d{2}:\d{2}:\d{2}/.test(args[0]);

// 已知良性测试噪音（jsdom / 测试隔离产物，非真实失败；断言失败由 vitest 单独捕获，
// 所以丢弃这些 console 行不影响失败可见性）：
// 1) React act 警告：异步媒体事件/外部 store 驱动的重渲染落在 act 窗口之外，测试已用
//    waitFor 或同步断言收口（VideoProcessNode 的 <video>、agentPersistRecovery 的 store 异步）。
// 2) jsdom 不识别 SVG 命名空间标签 <g>/<path>（CustomEdge/ConnectionLine/Comet）——React 渲染正确，仅 jsdom 日志噪音。
// 3) THREE.WARNING 多实例——vitest fork 每 worker 独立进程各载一份 three，隔离造成的假阳性。
const __isBenignNoise = (s) =>
  /was not wrapped in act\(/u.test(s) ||
  /is unrecognized in this browser/u.test(s) ||
  /THREE\.WARNING: Multiple instances of Three\.js/u.test(s);

const __consoleIO = { log: console.log, warn: console.warn, error: console.error };
const __pass = (level, ...a) => {
  const msg = a
    .map((x) => (typeof x === 'string' ? x : x instanceof Error ? x.message : String(x)))
    .join(' ');
  // 两层过滤，职责分离：
  //  1) __isBenignNoise：jsdom/测试隔离环境噪音，任何层级都滤（act/SVG/THREE 都走 console.error）。
  //  2) __isLoggerNoise：高频业务日志，只滤 log/info/warn/debug；error 放行（稀缺失败信号）。
  if (__isBenignNoise(msg) || (level !== 'error' && __isLoggerNoise(a))) return;
  __consoleIO[level](...a);
};
console.log = (...a) => __pass('log', ...a);
console.warn = (...a) => __pass('warn', ...a);
console.error = (...a) => __pass('error', ...a);
