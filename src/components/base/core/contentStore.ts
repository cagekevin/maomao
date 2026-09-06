/**
 * Content 层：横切存储权威入口。
 *
 * 所有业务数据读写必须走 contentStore，禁止直调 storageAdapter/kvStore/原生 localStorage。
 * contentStore 根据 STORAGE_KEYS 登记的路由配置自动分流到后端。
 *
 * ── 设计原则 ──
 * 1. 键必须登记：未在 STORAGE_KEYS 登记的键会触发 warning，帮助在迁移期发现遗漏
 * 2. 自动路由：调用方不感知后端（local/KV/native），由 STORAGE_KEYS 决定
 * 3. 缓存优先：同步 API 读内存缓存（惰性加载），避免重复序列化/网络请求
 * 4. 变更通知：set/delete 自动通知订阅者，React 组件可响应式更新
 * 5. 不可变快照：getSnapshot() 返回冻结副本，用于撤销/恢复/历史追踪
 *
 * ── API 概览 ──
 *   同步（local/native 后端）    异步（通用，包含 KV）
 *   get(key)                    getAsync(key)
 *   set(key, value)             setAsync(key, value)
 *   delete(key)                 deleteAsync(key)
 *                               has(key)
 *
 *   订阅与快照
 *   subscribe(key, cb)          subscribeAll(cb)
 *   getSnapshot()               getKeySnapshot(key)
 *
 *   落盘节流
 *   createDebouncedPersist(write, delay)   高频变更合并落盘（见下方原语注释，P4）
 *
 * ── 迁移路径 ──
 *   1. 先在 STORAGE_KEYS 登记键
 *   2. 把 store 中 sGet/sSet → content.get/set
 *   3. 把 store 中 storageGet/storageSet → content.getAsync/setAsync
 *   4. 批量迁移结束后，删除旧直调代码
 *
 * 【2026-09-04 中间层折叠】kvStore 的 storageGet/Set/Delete + isKvKey + tryParse 已折叠进本模块
 * （转为内部 resolveBackend / writeKvWithFallback / readKvWithFallback / deleteKvWithFallback）。
 *   原因：实测该层在 src 侧唯一消费者就是本模块，是纯转发中间层；两套路由判定
 *   （本模块 getBackend + kvStore.isKvKey）互相兜底，属第二份真相。折叠后 Interface
 *   13 个导出签名逐字不变，391 处调用点零迁移。kvStore.ts 保留为 re-export 壳（CANVAS_STATE_PREFIX + kv 三件套）。
 *   ⚠️ 有意不收口的 2 处例外（保留裸调 sGet/sSet）：
 *   - conversationState.ts:406/410 —— 读旧 local 数据做 KV 迁移回读（键已登记 backend:'kv'，走本模块会读 KV → 语义即错）。
 *   - d3dPersistence.ts:140,154 —— 双通道形态（KV 主通道 + localStorage 降级副本 + 独立 KV_TIMEOUT），本模块无对应能力。
 *   本模块承载两组职责：缓存/订阅/节流 + KV 降级策略，现不拆。若未来新增第三后端（如 remote），
 *   建议在文件内另起 `backends/` 小节，而非继续往主流程塞（C3 遗留建议）。
 */
import { sGet, sSet, sRemove } from '../storage/index.ts';
import { kvGet, kvSet, kvDelete } from '../api/localToolApi.ts';
import { reportDegrade } from './degrade.ts';
import { STORAGE_KEYS } from './contracts.ts';
import type { StorageKeyMeta } from './contracts.ts';
import { logger } from './logger.ts';
import { compilePatternRegex } from './utils.ts';

/** 存储后端：local(localStorage) / kv(云端 KV) / native(原生桥) */
export type StorageBackend = 'local' | 'kv' | 'native';

/**
 * STORAGE_KEYS 中单条登记项。
 * 复用 contracts.ts 的 StorageKeyMeta（单一事实来源，2026-09-01 起 contracts 已转 .ts，
 * 原「待其转 .ts 后改为直接引用其类型」的收口约定就此兑现，不再本地重定义漂移）。
 */
export type StorageKeyEntry = StorageKeyMeta;

/** 缓存快照（contentGetSnapshot 的产物）：键名 → 值 */
export type ContentSnapshot = Record<string, unknown>;

/** 按 key 订阅的回调 */
export type ContentKeyListener = (value: unknown) => void;
/** 全局订阅的回调 */
export type ContentGlobalListener = (key: string, value: unknown) => void;

/** 落盘节流原语的返回值 */
export interface DebouncedPersist {
  /** 标记待落盘；窗口内多次调用只落盘 1 次（write 必须是「读当前最新状态」的 thunk） */
  schedule: () => void;
  /** 强制立即落盘（自动注册 pagehide 触发，防刷新丢数据） */
  flush: () => void;
  /** 取消未落盘写（测试/重置用） */
  cancel: () => void;
}

/** 缓存统计信息 */
export interface ContentStats {
  cachedKeys: number;
  listeners: number;
  globalListeners: number;
}

// ─────────────────────────────────────────────────────────────────
// 内部状态
// ─────────────────────────────────────────────────────────────────

/** 内存缓存 { [key]: value|undefined }。undefined 表示未加载。 */
const cache = new Map<string, unknown>();

/** 按 key 的订阅者：{ [key]: Set<callback> } */
const keyListeners = new Map<string, Set<ContentKeyListener>>();

/** 全局订阅者：Set<(key, value) => void> */
const globalListeners = new Set<ContentGlobalListener>();

/** 已 warning 的未登记键集合（防重复 warning） */
const warnedKeys = new Set<string>();

/** STORAGE_KEYS 登记表（单一事实来源，直接引用，供全文件复用） */
const KEYS = STORAGE_KEYS as Record<string, StorageKeyEntry>;

// P6：动态键模板 → 编译后正则，统一走 utils.compilePatternRegex（2026-08-30 收口，原本地副本已删）

// ─────────────────────────────────────────────────────────────────
// 内部工具
// ─────────────────────────────────────────────────────────────────

/** 尝试解析 JSON 字符串，失败返回原值 */
function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

/**
 * 检查 key 是否匹配 STORAGE_KEYS 中 pattern:true 的动态键模板。
 * 返回匹配的条目，无匹配返回 null。
 * 例如 key="canvas-state-v1-proj-123" 匹配模板 "canvas-state-v1-{projectId}"。
 */
function findPatternEntry(key: string): StorageKeyEntry | null {
  // 用缓存的收窄视图 KEYS（等价原 Object.entries(STORAGE_KEYS)，避免 each 处再 as 一次）
  for (const [k, v] of Object.entries(KEYS)) {
    if (!v.pattern) continue;
    try {
      if (compilePatternRegex(k).test(key)) return v;
    } catch {
      /* 忽略无效正则 */
    }
  }
  return null;
}

function isPatternMatch(key: string): boolean {
  return findPatternEntry(key) !== null;
}

/**
 * 检查 key 是否在 STORAGE_KEYS 中登记。
 * 支持动态键模板匹配（pattern:true）。
 *
 * 编译期拦截补强（2026-08-19 补充，对应架构文档 P0-1）：
 *   原设计仅 warning 一次，漏登记/拼写错的裸 key 只在运行时静默 undefined，
 *   无法在开发期暴露。现升级为——开发环境下「字符串字面量键」且确实未登记时
 *   直接 throw，让错误在改代码当轮就爆出来（等价于「改 key 编译报错」的运行时版）。
 *   - 动态拼接/变量键（非字面量）无法静态判定，仅 warning，不拦，避免误伤。
 *   - 生产环境保持原行为：仅 warning，不影响线上。
 *   - 新增存储键必须先在本文件 STORAGE_KEYS 登记（契约登记表单一事实来源）。
 */
function checkRegistered(key: string): boolean {
  if (key in KEYS) return true;
  if (isPatternMatch(key)) return true;
  const isLiteral = typeof key === 'string' && key.length > 0;
  // 编译期拦截补强（2026-08-19，对应架构 P0-1）：
  //   开发环境（非 production）下，裸字面量键未登记 = 拼写错/漏登记 → 直接抛错，
  //   让错误在改代码当轮暴露（等价于「改 key 编译报错」的运行时版）。每次误用都抛（硬拦截）。
  //   生产环境不抛，仅 warning，保持线上兼容。
  if (isLiteral && process.env.NODE_ENV !== 'production') {
    throw new Error(
      `[contentStore] 未登记的存储键: "${key}"。` +
        `请先在 src/components/base/contracts.ts 的 STORAGE_KEYS 登记（禁止裸字符串 key）。` +
        `动态拼接键请确认拼接结果已登记为 pattern 模板。`,
    );
  }
  // warning 去重（开发/生产都打，但只打一次，避免刷屏）
  if (warnedKeys.has(key)) return false;
  warnedKeys.add(key);
  // 【签名对齐】logger.warn 现签名为 (category, action, detail?)；此处原按「整句即 category」的旧
  // 用法传单参，转 .ts 后暴露。改为标准两参，日志输出从「整句」变为「contentStore | 整句」。
  if (isLiteral) {
    logger.warn(
      'contentStore',
      `未登记的存储键: "${key}"，请先在 contracts.ts 的 STORAGE_KEYS 登记`,
    );
  } else {
    logger.warn(
      'contentStore',
      `未登记的存储键(动态): "${key}"，请先在 contracts.ts 的 STORAGE_KEYS 登记`,
    );
  }
  return false;
}

/**
 * 键 → 后端路由（全库唯一判定入口，2026-09-04 折叠 kvStore.isKvKey 后）。
 * 三段式：精确键登记 → pattern 动态模板 → 未登记键启发式兜底。
 * native 与 local 当前共用本地落地路径（见 contracts.ts「仅 localStorage 直写」），但语义独立保留，勿合并。
 */
function resolveBackend(key: string): StorageBackend {
  const entry = KEYS[key];
  if (entry) return entry.backend;
  // 动态键：查找匹配的模式键（首匹配，不看 backend）
  const patternEntry = findPatternEntry(key);
  if (patternEntry) return patternEntry.backend;
  // 未登记键：按 isKvPatternKey 启发式判断（原 kvStore.isKvKey 的 pattern 部分）
  return isKvPatternKey(key) ? 'kv' : 'local';
}

/**
 * 未登记键的启发式兜底：命中任一 backend==='kv' 的 pattern 模板即走 KV。
 * 由 kvStore.isKvKey 折叠而来（其精确键分支在 KEYS[key] 已查过后必不命中，只剩 pattern 扫描，语义等价）。
 */
function isKvPatternKey(key: string): boolean {
  if (typeof key !== 'string' || !key) return false;
  for (const [k, v] of Object.entries(KEYS)) {
    if (!v.pattern || v.backend !== 'kv') continue;
    try {
      if (compilePatternRegex(k).test(key)) return true;
    } catch {
      /* 忽略无效正则模板 */
    }
  }
  return false;
}

/** 通知所有订阅者 */
function notify(key: string, value: unknown): void {
  keyListeners.get(key)?.forEach((cb) => cb(value));
  globalListeners.forEach((cb) => cb(key, value));
}

/** 从 localStorage 加载键到缓存（同步） */
function loadFromLocal(key: string): unknown {
  const raw = sGet(key);
  if (raw === null) {
    cache.set(key, undefined);
    return undefined;
  }
  const parsed = tryParse(raw);
  cache.set(key, parsed);
  return parsed;
}

/** 从 KV 加载键到缓存（异步） */
async function loadFromKv(key: string): Promise<unknown> {
  const value = await readKvWithFallback(key);
  cache.set(key, value);
  return value;
}

// ─────────────────────────────────────────────────────────────────
// KV 降级统一（2026-09-04 自 kvStore storageGet/Set/Delete 折叠而来，行为逐字保持）
// ─────────────────────────────────────────────────────────────────

/**
 * KV 读取 + 降级回读本地副本（自 kvStore.storageGet 折叠而来）。
 * - KV 失败降级读本地副本（storageSet 曾降级写过的副本读得回，修 R2）。
 */
async function readKvWithFallback(key: string): Promise<unknown> {
  try {
    return await kvGet(key);
  } catch (e) {
    reportDegrade({ layer: 'kvStore', key, e, toast: '本地引擎存储暂不可用，已回退读取本地缓存' });
    const raw = sGet(key);
    return raw === null ? null : tryParse(raw);
  }
}

/**
 * KV 写入 + 降级（自 kvStore.storageSet 折叠而来，行为逐字保持）。
 * - KV 成功后 sRemove 清历史降级副本（P2-F1）：否则 KV 再故障时旧副本"复活"覆盖新值。
 * - KV 失败降级写 localStorage 并 reportDegrade
 *   （layer 保留 'kvStore' 字面量：既有日志查询 task-inspect --logs 依赖，勿改）。
 */
async function writeKvWithFallback(key: string, value: unknown): Promise<void> {
  try {
    await kvSet(key, value);
    sRemove(key);
  } catch (e) {
    sSet(key, typeof value === 'string' ? value : JSON.stringify(value));
    reportDegrade({
      layer: 'kvStore',
      key,
      e,
      toast: '本地引擎存储暂不可用，数据已暂存本地（跨设备同步可能丢失）',
    });
  }
}

/**
 * KV 删除 + 降级（自 kvStore.storageDelete 折叠而来，行为逐字保持）。
 * ⚠️ 原语义（kvStore.ts:103-111）：KV 删除【成功即 return，不清本地副本】；
 *    只有 KV 失败才落到 sRemove 清残留降级副本。
 *    【禁止】写成 `await kvDelete(key); sRemove(key)` —— 那是无条件删副本，属行为变更（审计 A3 红）。
 */
async function deleteKvWithFallback(key: string): Promise<void> {
  try {
    await kvDelete(key);
  } catch {
    sRemove(key);
  }
}

// ─────────────────────────────────────────────────────────────────
// 同步 API（仅 local/native 后端，KV 键会返回缓存值或 undefined）
// ─────────────────────────────────────────────────────────────────

/**
 * 同步读取键值。
 * - local/native 键：惰性加载，首次读从 localStorage 加载到缓存，后续读缓存
 * - KV 键：返回缓存值（如果之前未加载过则返回 undefined，需用 getAsync）
 */
export function contentGet(key: string): unknown {
  checkRegistered(key);
  if (cache.has(key)) return cache.get(key);
  const backend = resolveBackend(key);
  if (backend === 'kv') {
    // KV 键同步读不到（本地缓存未命中时不做网络请求）
    return undefined;
  }
  return loadFromLocal(key);
}

/**
 * 同步写入键值。
 * - local/native 键：同步写缓存 + localStorage
 * - KV 键：同步写缓存 + 异步写 KV（fire-and-forget，失败仅 warning）
 */
export function contentSet(key: string, value: unknown): void {
  checkRegistered(key);
  cache.set(key, value);
  const backend = resolveBackend(key);
  if (backend === 'kv') {
    writeKvWithFallback(key, value).catch((e) => {
      logger.warn(`[contentStore] KV 写入失败 (fire-and-forget): ${key}`, e);
    });
  } else {
    sSet(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  notify(key, value);
}

/**
 * 同步删除键。
 * - local/native 键：同步删缓存 + localStorage
 * - KV 键：同步删缓存 + 异步删 KV（fire-and-forget）
 */
export function contentDelete(key: string): void {
  checkRegistered(key);
  cache.delete(key);
  const backend = resolveBackend(key);
  if (backend === 'kv') {
    deleteKvWithFallback(key).catch((e) => {
      logger.warn(`[contentStore] KV 删除失败 (fire-and-forget): ${key}`, e);
    });
  } else {
    sRemove(key);
  }
  notify(key, undefined);
}

/**
 * 同步检查键是否存在（缓存或后端）。
 * 注意：KV 键如果缓存未命中，会返回 false（即使后端存在），建议用 getAsync 确认。
 */
export function contentHas(key: string): boolean {
  checkRegistered(key);
  if (cache.has(key)) {
    const v = cache.get(key);
    return v !== undefined && v !== null;
  }
  const backend = resolveBackend(key);
  if (backend === 'kv') return false; // KV 键同步无法确认
  const raw = sGet(key);
  return raw !== null;
}

// ─────────────────────────────────────────────────────────────────
// 异步 API（通用，对所有后端有效）
// ─────────────────────────────────────────────────────────────────

/** 异步读取键值，总是从后端加载（同时更新缓存）。 */
export async function contentGetAsync(key: string): Promise<unknown> {
  checkRegistered(key);
  const backend = resolveBackend(key);
  if (backend === 'kv') {
    return loadFromKv(key);
  }
  return loadFromLocal(key);
}

/** 异步写入键值，等待持久化完成。 */
export async function contentSetAsync(key: string, value: unknown): Promise<void> {
  checkRegistered(key);
  cache.set(key, value);
  const backend = resolveBackend(key);
  if (backend === 'kv') {
    await writeKvWithFallback(key, value);
  } else {
    sSet(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  notify(key, value);
}

/** 异步删除键，等待删除完成。 */
export async function contentDeleteAsync(key: string): Promise<void> {
  checkRegistered(key);
  cache.delete(key);
  const backend = resolveBackend(key);
  if (backend === 'kv') {
    await deleteKvWithFallback(key);
  } else {
    sRemove(key);
  }
  notify(key, undefined);
}

// ─────────────────────────────────────────────────────────────────
// 跳过缓存直读底层（2026-09-04 折叠治理补 Interface 缺口）
// ─────────────────────────────────────────────────────────────────

/**
 * 跳过内存缓存，直读底层存储（按该键登记的后端路由）。
 * 用途：「落盘确认」等必须验证真实落盘值的场景 —— 经 contentGet 会命中刚写入的缓存，
 *       验证退化为自证式（恒真），失去意义。
 * ⚠️ 不更新缓存、不触发订阅通知；同步语义，kv 键无法同步读时返回 null。
 */
export function contentReadThrough(key: string): string | null {
  checkRegistered(key);
  if (resolveBackend(key) === 'kv') return null; // kv 键无法同步读
  return sGet(key);
}

// ─────────────────────────────────────────────────────────────────
// 订阅
// ─────────────────────────────────────────────────────────────────

/**
 * 订阅指定键的变更。
 * @param {string} key
 * @param {(value: any) => void} callback
 * @returns {() => void} 取消订阅函数
 */
export function contentSubscribe(key: string, callback: ContentKeyListener): () => void {
  if (!keyListeners.has(key)) keyListeners.set(key, new Set());
  keyListeners.get(key)!.add(callback);
  return () => {
    keyListeners.get(key)?.delete(callback);
  };
}

/**
 * 订阅所有键的变更。
 * @param {(key: string, value: any) => void} callback
 * @returns {() => void} 取消订阅函数
 */
export function contentSubscribeAll(callback: ContentGlobalListener): () => void {
  globalListeners.add(callback);
  return () => {
    globalListeners.delete(callback);
  };
}

// ─────────────────────────────────────────────────────────────────
// 快照
// ─────────────────────────────────────────────────────────────────

/**
 * 获取所有已登记键的不可变快照（冻结对象）。
 * 排除动态键（pattern: true）和未在缓存中的键。
 * 用于撤销/恢复/历史追踪。
 */
export function contentGetSnapshot(): ContentSnapshot {
  const snapshot: ContentSnapshot = {};
  for (const [key, entry] of Object.entries(KEYS)) {
    if (entry.pattern) continue; // 动态键跳过
    if (cache.has(key)) {
      const v = cache.get(key);
      if (v !== undefined) snapshot[key] = v;
    } else {
      const backend = resolveBackend(key);
      if (backend !== 'kv') {
        // 同步加载 local 键
        const v = loadFromLocal(key);
        if (v !== undefined) snapshot[key] = v;
      }
    }
  }
  return Object.freeze(snapshot);
}

/** 获取指定键的不可变快照值。 */
export function contentGetKeySnapshot(key: string): unknown {
  checkRegistered(key);
  const backend = resolveBackend(key);
  if (cache.has(key)) return Object.freeze(cache.get(key));
  if (backend !== 'kv') {
    const v = loadFromLocal(key);
    return Object.freeze(v);
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────
// 维护
// ─────────────────────────────────────────────────────────────────

/**
 * 落盘节流原语（P4）：高频变更时合并落盘，消除主线程长任务（整数组/整包 JSON.stringify）。
 * 用法（各 store）：
 *   const persistDebounced = createDebouncedPersist(() => contentSet(KEY, 最新状态))
 *   function notify() { persistDebounced.schedule(); listeners.forEach((l) => l()) }
 * 语义：
 *  - schedule()：标记待落盘；窗口（delay ms）内多次调用只落盘 1 次。
 *    write 必须是「读当前最新状态」的 thunk——flush 时才执行，天然把窗口内多次变更合并为最终态。
 *  - flush()：强制立即落盘（供组件卸载兜底；本原语自动注册 pagehide 触发 flush，防极端刷新丢数据）。
 *  - cancel()：取消未落盘写（测试/重置用）。
 * 注意：通知订阅者（notify）保持即时，只有「落盘」被节流——UI 响应性不受影响。
 */
export function createDebouncedPersist(write: () => void, delay = 300): DebouncedPersist {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending = false;
  function schedule(): void {
    pending = true;
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      pending = false;
      write();
    }, delay);
  }
  function flush(): void {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending) {
      pending = false;
      write();
    }
  }
  function cancel(): void {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    pending = false;
  }
  // 页面退出时强制落盘，避免防抖窗口内关闭/刷新丢最后变更
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush);
  }
  return { schedule, flush, cancel };
}

/**
 * 清除内容缓存（用于测试/重置）。
 * 注意：订阅者不受影响，后续 set/get 会重新加载。
 */
export function contentClearCache(): void {
  cache.clear();
  warnedKeys.clear();
}

/**
 * 获取缓存统计信息。
 * @returns {{ cachedKeys: number, listeners: number, globalListeners: number }}
 */
export function contentStats(): ContentStats {
  return {
    cachedKeys: cache.size,
    listeners: keyListeners.size,
    globalListeners: globalListeners.size,
  };
}
