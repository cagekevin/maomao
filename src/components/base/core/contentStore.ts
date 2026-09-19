/**
 * Content 层：横切存储权威入口。
 *
 * 所有业务数据读写必须走 contentStore，禁止直调 storageAdapter 或原生 localStorage。
 * contentStore 根据 STORAGE_KEYS 登记的路由配置自动分流到后端。
 *
 * ── 设计原则 ──
 * 1. 键必须登记：未在 STORAGE_KEYS 登记的键会触发 warning，帮助在迁移期发现遗漏
 * 2. 自动路由：调用方不感知后端（local/KV/native），由 STORAGE_KEYS 决定
 * 3. 缓存优先：同步 API 读内存缓存（惰性加载），避免重复序列化/网络请求
 * 4. 变更通知：set/delete 自动通知订阅者，React 组件可响应式更新
 * 5. 不可变快照：getSnapshot() 返回冻结副本，用于撤销/恢复/历史追踪
 * 6. 失败分类（2026-09-12/TD-02-1）：KV 失败分两类——「引擎不可用」（网络/超时/5xx，可降级写本地副本）
 *    与「请求被拒」（4xx，业务结论，必须原样上抛）。分类唯一实现 = isEngineUnavailable；降级只服务前者。
 *    此前把两类压进一个 catch，导致严格族（画布快照 fail-closed）无法经本入口表达 → 被逼出直调 kvSet 旁路。
 * 7. 策略两族（2026-09-12/TD-02-1）：「尽力而为族」（contentSet/Get/Delete(+Async)，配置类，失败降级不阻断）
 *    与「严格族」（contentGetKvVersion / contentSetKvCas，用户主数据，失败 fail-closed 绝不写副本）。
 *    两族共用路由/缓存/订阅内核；**真分叉在「失败语义」，不在「后端」**（勿按 local/kv 划族）。
 * 8. 协议面与后端对齐：KV 后端有「版本读 + 条件写（CAS）」，入口必须一并暴露，否则消费者绕过入口直调 transport。
 * 9. 诚实结果契约（2026-09-12/TD-02-24；2026-09-13 按实现校正）：降级族一次 KV 操作**能返回即成功**，
 *    结果为 `{ value, source:'kv'|'local' }`（判别位 = **字符串** `source`，窄化在本仓 tsconfig 下正常）；
 *    **失败一律上抛**（4xx 拒收 = 业务结论，引擎不可用耗尽 = 降级也不可用），由调用方按
 *    `isEngineUnavailable` 语义处理。铁律：`source:'local'` **仅在引擎不可用**出现；KV 真空是
 *    `source:'kv'` + `value:null`（**非降级**）。`contentGetKvWithFallback` 另有自己的对外契约
 *    （`KvFallbackReadResult`，其 rejected 分支是**真接线**的，勿混）。读族与写族共用内核
 *    `kvReadOp`/`kvWriteOp`——此前读族漏接失败分类守卫（写族有 read 族无）即因缺此契约（TD-02-15）。
 *
 * 【2026-09-12 TD-02-15/19/22/24/25 修复记录】读族补齐 isEngineUnavailable 守卫、`from` 信号诚实化、
 * 抽 `kvReadOp`/`kvWriteOp`/`kvOpMeta`/`withKvTimeout` 消 4 处内核样板、remove keepFallback 本地副本防复活。
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
 *   13 个导出签名逐字不变，391 处调用点零迁移。kvStore.ts 的 re-export 壳已于 2026-09-19 删除（TD-18-36：仅剩 CANVAS_STATE_PREFIX 一个消费者，改由 contracts.ts 直供）。
 *   ⚠️ 有意不收口的 1 处例外（保留裸调 sGet/sSet）：
 *   - conversationState.ts:406/410 —— 读旧 local 数据做 KV 迁移回读（键已登记 backend:'kv'，走本模块会读 KV → 语义即错）。
 *   d3dPersistence 已于 TD-7 方案A 收编：其双通道形态（KV 主通道 + localStorage 降级副本 + 独立 KV_TIMEOUT）
 *   通过 STORAGE_KEYS 的 `fallback`/`timeout` per-key 选项 + 新增 contentSetKvWithFallback/contentGetKvWithFallback
 *   原语支持，不再裸调 kvGet/kvSet/sGet/sSet（消除「收口缺口」）。
 *   本模块承载两组职责：缓存/订阅/节流 + KV 降级策略，现不拆。若未来新增第三后端（如 remote），
 *   建议在文件内另起 `backends/` 小节，而非继续往主流程塞（C3 遗留建议）。
 */
import { sGet, sSet, sRemove, isStorageReady } from '../storage/index.ts';
// 落盘结果判别联合（生产者给全：失败/降级/未确认都是事实，不接受"发个事件就算交代了"）
import type { PersistWriteOutcome } from '../storage/storageAdapter.ts';
import { kvGet, kvSet, kvDelete, kvGetVersion } from '../api/localToolApi.ts';
import { reportDegrade } from './degrade.ts';
import { STORAGE_KEYS } from './contracts.ts';
import type { StorageKeyMeta } from './contracts.ts';
import { logger } from './logger.ts';
import { compilePatternRegex } from './utils.ts';
import { tryParse as tryParseSafe } from '../utils/asyncGuard.ts';
import { withTimeout } from '../utils/asyncGuard.ts';

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

/**
 * 契约加载时校验：所有 `pattern:true` 模板必须能编译为正则（TD-02-17，2026-09-13）。
 *
 * 【为什么在加载时做】坏正则原本被 `findPatternEntry`/`isKvPatternKey` 的**热路径 catch 静默吞**：
 * 模板坏了 → 该动态键永不匹配 → 键路由静默退化为启发式兜底，而**无人知道契约已损坏**。
 * 这与同文件 `checkRegistered` 对「未登记字面量键」dev 环境直接 throw 的 fail-loud 哲学**自相矛盾**
 * （对拼写错零容忍，却对正则坏了零感知）。
 *
 * 【修法】复杂度**前移到契约加载源头**：模块加载即校验，坏正则带键名抛错（dev 立即炸、
 * 生产也只炸一次于启动而非每次读写热路径）。热路径的 catch 退化为「不该发生的兜底」。
 */
function assertPatternRegExpsValid(): void {
  const broken: string[] = [];
  for (const [k, v] of Object.entries(KEYS)) {
    if (!v.pattern) continue;
    try {
      compilePatternRegex(k);
    } catch {
      broken.push(k);
    }
  }
  if (broken.length > 0) {
    throw new Error(
      `[contentStore] STORAGE_KEYS 中以下 pattern 模板无法编译为正则（键名含非法占位/字符）：` +
        broken.map((k) => `"${k}"`).join(', ') +
        `。请修正 contracts.ts 的模板（如 canvas-state-v1-{projectId}）。`,
    );
  }
}
assertPatternRegExpsValid();

// P6：动态键模板 → 编译后正则，统一走 utils.compilePatternRegex（2026-08-30 收口，原本地副本已删）

// ─────────────────────────────────────────────────────────────────
// 内部工具
// ─────────────────────────────────────────────────────────────────

/**
 * 解析 JSON 字符串；**不是合法 JSON** 时返回**原串**（存储里的裸字符串值）。
 *
 * ⚠️ **2026-09-17 改名（原 `tryParse`）**：与 `base/utils/asyncGuard.ts` 的 `tryParse` **同名不同义**
 *   —— 那个返回**判别联合** `{ok,value|error}`、这个返回「原串」；同名会让读者以为是同一能力
 *   （本仓 SSOT 第二份 + 语义漂移的典型诱因）。故按语义命名区分。
 */
function parseJsonOrRaw(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

/**
 * 动态键模板匹配**单一实现**（TD-02-21：原 `findPatternEntry` / `isKvPatternKey` 结构逐字重复，
 * 同遍历 KEYS + compilePatternRegex + 坏正则吞，仅差 `backend!=='kv'` 过滤 → 抽本函数，`predicate` 表差异）。
 *
 * 坏正则**不再在此静默吞**：`assertPatternRegExpsValid()`（模块加载时 fail-loud）已保证所有
 * `pattern:true` 模板可编译 → 此处 catch 是「不该发生的运行期兜底」（防炸主流程），
 * 而坏正则会在**加载时**带键名抛错（TD-02-17：复杂度前移到契约加载源头，而非散在热路径）。
 *
 * @param key 待匹配的存储键
 * @param predicate 可选额外过滤（如只认 `backend==='kv'` 的模板）
 */
function matchPatternEntry(
  key: string,
  predicate?: (entry: StorageKeyEntry) => boolean,
): StorageKeyEntry | null {
  // 用缓存的收窄视图 KEYS（等价原 Object.entries(STORAGE_KEYS)，避免 each 处再 as 一次）
  for (const [k, v] of Object.entries(KEYS)) {
    if (!v.pattern) continue;
    if (predicate && !predicate(v)) continue;
    const re = tryParseSafe(() => compilePatternRegex(k));
    // 【2026-09-17 禁止项规则 2】判别联合**必须先判 ok**：原写法 `re?.test(key)` 直接读 `.value`
    //（`ParseResult<RegExp>` 上没有 `test`，TS 已判红）。且"这条 pattern 键的正则编译不了"＝
    // 该键模板自己写错了（**契约违约**）—— 不能静默跳过：留痕 + 跳过该条（不中断其余键的匹配）。
    if (!re.ok) {
      logger.warn('contentStore', 'pattern 键正则编译失败（该模板条目已跳过）', {
        key: k,
        error: re.error,
      });
      continue;
    }
    if (re.value.test(key)) return v;
  }
  return null;
}

/**
 * 检查 key 是否匹配 STORAGE_KEYS 中 pattern:true 的动态键模板。
 * 返回匹配的条目，无匹配返回 null。
 * 例如 key="canvas-state-v1-proj-123" 匹配模板 "canvas-state-v1-{projectId}"。
 */
function findPatternEntry(key: string): StorageKeyEntry | null {
  return matchPatternEntry(key);
}

/** 解析 key 对应的 STORAGE_KEYS 登记项（精确键优先，其次 pattern 动态模板）。供 per-key 选项（fallback/timeout）读取。 */
function resolveMeta(key: string): StorageKeyMeta | null {
  return KEYS[key] ?? findPatternEntry(key);
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
 *   无法暴露。现升级为——「字符串字面量键」且确实未登记时直接 throw
 *  （不分环境一律硬拦，2026-09-18 移除 dev/生产分叉），让错误在改代码当轮就爆出来
 *  （等价于「改 key 编译报错」的运行时版）。
 *   - 动态拼接/变量键（非字面量）无法静态判定，仅 warning，不拦，避免误伤。
 *   - 新增存储键必须先在本文件 STORAGE_KEYS 登记（契约登记表单一事实来源）。
 */
function checkRegistered(key: string): boolean {
  if (key in KEYS) return true;
  if (isPatternMatch(key)) return true;
  const isLiteral = typeof key === 'string' && key.length > 0;
  // 运行时硬拦截（2026-08-19，对应架构 P0-1；2026-09-18 移除 dev/生产分叉）：
  //   裸字面量键未登记 = 拼写错/漏登记 = bug，不分环境一律抛错，
  //   让错误在改代码当轮暴露（等价于「改 key 编译报错」的运行时版）。每次误用都抛（硬拦截）。
  if (isLiteral) {
    throw new Error(
      `[contentStore] 未登记的存储键: "${key}"。` +
        `请先在 src/components/base/contracts.ts 的 STORAGE_KEYS 登记（禁止裸字符串 key）。` +
        `动态拼接键请确认拼接结果已登记为 pattern 模板。`,
    );
  }
  // 动态键（非字面量，无法静态判定）不拦：仅 warning，每键只 warn 一次避免刷屏
  if (warnedKeys.has(key)) return false;
  warnedKeys.add(key);
  // 【签名对齐】logger.warn 签名为 (category, action, detail?)，输出「contentStore | 整句」。
  logger.warn(
    'contentStore',
    `未登记的存储键(动态): "${key}"，请先在 contracts.ts 的 STORAGE_KEYS 登记`,
  );
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
 * TD-02-21：改复用 `matchPatternEntry` 单一实现（原为与 findPatternEntry 逐字重复的第二份）。
 */
function isKvPatternKey(key: string): boolean {
  if (typeof key !== 'string' || !key) return false;
  return matchPatternEntry(key, (v) => v.backend === 'kv') !== null;
}

/** 通知所有订阅者 */
function notify(key: string, value: unknown): void {
  keyListeners.get(key)?.forEach((cb) => cb(value));
  globalListeners.forEach((cb) => cb(key, value));
}

/**
 * 从 localStorage 加载键到缓存（同步）。
 *
 * 【未就绪 ≠ 不存在（2026-09-12 / TD-02-2）】扩展环境在 `initStorage()` 异步预填完成前，
 * `sGet` 必然返回 null —— 那是「还不知道」，不是「确实没有」。旧实现照常 `cache.set(key, undefined)`，
 * 而 `contentGet` 命中 `cache.has` 即返回 → 该键被**粘**成「不存在」直到整会话结束（cache 无失效机制）。
 * 现改为：未就绪时返回 undefined 但**不写缓存**，等就绪后自然重读到真值。
 */
function loadFromLocal(key: string): unknown {
  if (!isStorageReady()) return undefined;
  const raw = sGet(key);
  if (raw === null) {
    cache.set(key, undefined);
    return undefined;
  }
  const parsed = parseJsonOrRaw(raw);
  cache.set(key, parsed);
  return parsed;
}

/**
 * 从 KV 加载键到缓存（异步）。
 *
 * 【TD-02-20 修复·诚实标注，2026-09-13】降级副本入 cache 原是**无标记**的：
 * 同步读者 `contentGet` 先查 `cache.has`（先于 backend 判断）→ 会读到降级副本却「以为读到 KV 真值」。
 *
 * 修法取**最小正确形态**（而非「给 cache 值加 source 结构」——见下）：
 *  - 降级发生时**留痕**（warn），使「该键此刻读到的是本地副本」可观测；
 *  - **不给 cache 值加来源结构**：审计过消费方——**没有任何读者需要区分**（画布侧已改用
 *    `contentGetKvWithFallback` 的诚实 `vacated` 分支）。为不存在的消费方改 cache 结构 = 铁律 5 假抽象
 *    （且会破坏 `contentGet` 的 `unknown` 契约、波及全部同步读者）。
 *  - 诚实标注：`contentGet` 对 KV 键的 cache 命中**可能是降级副本**（有日志可查）。
 */
async function loadFromKv(key: string): Promise<unknown> {
  const res = await kvReadOp(key);
  const value = res.value;
  if (res.source === 'local') {
    logger.warn(
      'contentStore',
      `KV 引擎不可用，已回退本地降级副本（同步读者将读到副本而非 KV 真值）: ${key}`,
    );
  }
  cache.set(key, value);
  return value;
}

// ─────────────────────────────────────────────────────────────────
// KV 降级统一（2026-09-04 自 kvStore storageGet/Set/Delete 折叠而来，行为逐字保持）
// ─────────────────────────────────────────────────────────────────

/**
 * KV 失败分类（全库唯一实现，2026-09-12/TD-02-1）。
 * - `true`  = 引擎不可用：网络错误 / 超时 / 5xx / 无 HTTP 状态（序列化等）→ 允许降级读/写本地副本。
 * - `false` = 请求被拒：4xx（如 CAS 409 版本冲突、400 缺字段）→ 是**业务结论**，必须原样上抛，
 *   绝不能降级（否则「版本冲突被误报成引擎不可用」，冲突被静默吞掉）。
 * 判据用鸭子类型读 `status`（不 import HttpError）：测试/自定义桩抛带 status 的普通对象同样成立。
 */
function isEngineUnavailable(e: unknown): boolean {
  const status = (e as { status?: unknown } | null)?.status;
  if (typeof status === 'number') return status >= 500;
  return true;
}

/** 从错误对象提取 HTTP 状态码（无则 undefined）；与 isEngineUnavailable 同口径。 */
function statusOf(e: unknown): number | undefined {
  const status = (e as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : undefined;
}

/**
 * 一次 KV 降级族操作的结果 —— **能返回即成功**（失败一律上抛）。
 *
 * 【为什么需要它】此前 5 个 KV 函数各自发明返回形状（`unknown` / `'kv'|'local'` /
 * `{value,from}` / `{landed,version?}` / `void`），调用方必须重新推导「成没成功、降没降级、
 * 真源在哪」——复杂度从声称的「唯一内核」漏进散落 catch，读族因此漏接失败分类守卫
 * （writeKv 有守卫、readKv 无），并最终在下游 downgrade 信号被滥用（TD-02-25 数据正确性故障）。
 *
 * 【语义铁律】判别位是 `source`（**字符串**，本仓 tsconfig 下窄化正常）：
 * - `source:'kv'`    → KV 真值，权威（KV **真空**也是 kv + `value:null`：确定回答，非降级）。
 * - `source:'local'` → **仅「引擎不可用」**才会出现；KV 状态未知，本地副本仅为降级。
 *
 * 【TD-02-24 收口修正（2026-09-13 · 按实现校正）】原 `StorageOpResult<T>` 是 4 支判别联合，**与现实不符**：
 *  ① `ok:false` 两支（`error:'engine-unavailable' | 'rejected'`）**全仓零构造** —— 4xx 拒收与引擎不可用
 *     耗尽都走 **throw**（`kvReadOp`/`kvWriteOp` 内 `if (!isEngineUnavailable(e)) throw e`），从不由本类型承载；
 *  ② `ok` 因此恒 `true`、`degraded`/`error`/`status` **零读取** → 一并删除（`source:'local'` 已等价表达降级）；
 *  ③ 该类型本身是**未用导出**（在死代码基线内）→ 同时降为模块内私有。
 *  ⇒ 结论：**失败以 throw 表达是两族共识**（降级族尽力而为、严格族 fail-closed），类型不再声明失败分支。
 */
type KvOpOutcome<T> = {
  value: T;
  source: 'kv' | 'local';
  /**
   * **仅写内核**在降级时产出：降级副本是否**真落盘**（`false` = 数据仅在内存，刷新即丢）。
   * 读内核不产出（读无写入）。不带上它，上层就会把「KV+本地双失败」误当「已落本地」（假成功）。
   */
  localPersisted?: boolean;
};

/** KV op 的公共内核（TD-02-22：resolveMeta/timeout/keepFallback/sRemove 原在 4 处字面复制）。 */
interface KvOpMeta {
  timeout: number | undefined;
  keepFallback: boolean;
}

/** 解析 per-key 选项（timeout / fallback），供全部 KV op 复用。 */
function kvOpMeta(key: string): KvOpMeta {
  const meta = resolveMeta(key);
  return { timeout: meta?.timeout, keepFallback: meta?.fallback === true };
}

/** 按 per-key timeout 包装一次异步 op（无 timeout 则原样 await）。 */
function withKvTimeout<T>(op: Promise<T>, timeout: number | undefined, label: string): Promise<T> {
  return timeout ? withTimeout(op, timeout, label) : op;
}

/**
 * 降级族写入内核（read/write/内容族共用）。
 * 返回 KvOpOutcome：成功标 `source:'kv'`；引擎不可用回退本地并标 `source:'local'`；
 * 4xx 拒收**原样上抛**（不吞、不降级）——失败一律上抛，不进返回信封。
 */
async function kvWriteOp(key: string, value: unknown): Promise<KvOpOutcome<unknown>> {
  const { timeout, keepFallback } = kvOpMeta(key);
  try {
    await withKvTimeout(kvSet(key, value), timeout, `KV 写入超时 (key=${key})`);
    // 默认（keepFallback=false）：KV 成功后清历史降级副本，避免旧副本"复活"覆盖新值（P2-F1）；
    // keepFallback=true（如 d3d 双通道）：保留本地镜像，供 KV 不可达时回读。
    if (!keepFallback) sRemove(key);
    return { value, source: 'kv' };
  } catch (e) {
    // 请求被拒（4xx，如 CAS 409 版本冲突）= 业务结论，原样上抛；降级只服务「引擎不可用」。
    if (!isEngineUnavailable(e)) throw e;
    // 引擎不可用：写降级副本。
    // 【2026-09-17 修死代码（TD-24-4 阶段0）】原写法 `try { sSet(...) } catch { …双通道都失败… }`
    // 是**永远不触发的兜底**：`sSet` 内部自己吞错、从不为持久化失败抛错 ⇒ 那句"双通道均失败、
    // 数据仅在内存（刷新将丢失）"**从未被打印过** —— 最高危状态反而最静默。现按返回值判。
    const local = sSet(key, typeof value === 'string' ? value : JSON.stringify(value));
    const persistedLocally = local.ok && local.landed === 'local';
    if (!persistedLocally) {
      logger.warn(
        'contentStore',
        `KV 不可用且本地未持久（数据仅在内存，刷新将丢失）: ${key}`,
        local.ok ? `landed=${local.landed}` : local.message,
      );
    }
    reportDegrade({
      layer: 'kvStore',
      key,
      e: e as Error | undefined,
      // 文案必须与**事实**一致：本地真落盘了才说"已暂存本地"；否则如实说"只在内存、刷新会丢"。
      toast: persistedLocally
        ? '本地引擎存储暂不可用，数据已暂存本地（跨设备同步可能丢失）'
        : '本地引擎存储不可用，且本地也未能保存：本次改动只在内存，刷新会丢',
    });
    return { value, source: 'local', localPersisted: persistedLocally };
  }
}

/**
 * 降级族读取内核（read/内容族共用，含失败分类守卫——修 TD-02-15 读族漏接）。
 * KV 命中非空 → `{value, source:'kv'}`；KV **真空**（null/undefined）→ `{value:null, source:'kv'}`
 *   （区分：真空是 KV 的确定回答，不算降级）；
 * KV **引擎不可用** → 回退本地副本，`{value, source:'local'}`；
 * KV **4xx 拒收** → 抛出，由调用方语义决定（本族一律上抛，不静默回退本地）。
 */
async function kvReadOp(key: string): Promise<KvOpOutcome<unknown>> {
  const { timeout } = kvOpMeta(key);
  try {
    const value = await withKvTimeout(kvGet(key), timeout, `KV 读取超时 (key=${key})`);
    // KV 真空：确定回答"没有"，非降级（下游据 source:'kv' + value null 判迁移）
    return { value, source: 'kv' };
  } catch (e) {
    if (!isEngineUnavailable(e)) {
      // 4xx 业务拒收：不服务本地副本、不降级——原样上抛（TD-02-15/25 根因）
      throw e;
    }
    reportDegrade({
      layer: 'kvStore',
      key,
      e: e as Error | undefined,
      toast: '本地引擎存储暂不可用，已回退读取本地缓存',
    });
    const raw = sGet(key);
    return { value: raw === null ? null : parseJsonOrRaw(raw), source: 'local' };
  }
}

/**
 * KV 写入 + 降级（薄包装）：把内核结果映射为**落盘事实**（`PersistWriteOutcome`）。
 *  - KV 成功 → `{ok:true, landed:'kv'}`；
 *  - 引擎不可用 + 降级副本**真落盘** → `{ok:true, landed:'local'}`；
 *  - 引擎不可用 + 降级副本**也没落盘**（双通道全失）→ `{ok:false, message}`；
 *  - 4xx 拒收 → 原样上抛。
 *
 * 【2026-09-17 修契约级假成功（TD-24-4 / TD-16-33 收尾）】原返回 `'kv' | 'local'`，把上面后两支
 * **压成同一支** ⇒ `contentSetAsync` 对"双通道全失"也报 `{ok:true, landed:'local'}`，而 `landed:'local'`
 * 的字面契约是"**已确认写进浏览器持久层**" —— 数据其实只在内存（刷新即丢）。现按内核给的
 * `localPersisted` 如实分流，调用方第一次能分辨"降级成功"与"彻底没落盘"。
 */
async function writeKvWithFallback(key: string, value: unknown): Promise<PersistWriteOutcome> {
  const res = await kvWriteOp(key, value);
  if (res.source === 'kv') return { ok: true, landed: 'kv' };
  return res.localPersisted
    ? { ok: true, landed: 'local' }
    : {
        ok: false,
        message: 'KV 引擎不可用，且降级副本也未持久化（数据仅在内存，刷新将丢失）',
      };
}

/**
 * KV 删除 + 降级（自 kvStore.storageDelete 折叠而来）。
 * ⚠️ 原语义（kvStore.ts:103-111）：KV 删除【成功即 return】；只有 KV 失败才落到 sRemove 清残留降级副本。
 * 【TD-02-25 修正】删除成功后，keepFallback=true 的键（如 d3d）本地副本**也会残留** →
 * 后续 hydrate 读到"KV 真空 + 本地有"会**复活已删数据**。故删除成功时**必须清本地副本**
 * （删除语义要求"彻底消失"，与写入的 keepFallback 镜像策略不同——镜像服务的是"KV 不可达时能读回"，
 * 而删除是明确的用户意图，保留副本即违背意图）。
 */
async function deleteKvWithFallback(key: string): Promise<'kv' | 'unconfirmed'> {
  try {
    await kvDelete(key);
    // 删除成功后清本地降级副本（含 keepFallback 镜像），防 hydrate 复活。
    // 【2026-09-17】副本清理失败要留痕：副本残留会让已删数据在下次 hydrate 复活（TD-02-25）。
    const cleared = sRemove(key);
    if (!cleared.ok) {
      logger.warn(
        'contentStore',
        `删除已确认，但本地降级副本未清掉（有复活风险）: ${key}`,
        cleared.message,
      );
    }
    return 'kv';
  } catch (e) {
    // 4xx 拒收：删除**确定未成功**，原样上抛（不上抛会被误认为已删）
    if (!isEngineUnavailable(e)) throw e;
    // 【TD-02-18 修正】引擎不可用 = 删除**状态未知**（KV 键可能仍残留）：
    // 原来无条件 `sRemove(key)` 会删掉本地副本，制造「KV 残留真值 + 本地已清」的假删除态
    // —— 与 TD-02-25「已删复活」正相反（这是「没删却以为删了」）。
    // 正确：KV 状态未知时不谎报成功，**保留本地副本**（两边一致地"没删成功"）+ 留痕 + 如实上报。
    logger.warn('contentStore', `KV 引擎不可用，删除未确认（键可能仍残留）: ${key}`, e);
    return 'unconfirmed';
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
 * 同步写入键值（**仅 local/native 键**）。
 *
 * 【失败契约 · 2026-09-17 重写（TD-24-4 阶段0「让生产者把失败给全」）】
 * 返回 `PersistWriteOutcome`：**成败/落点由生产者如实给出**，调用方不需要（也禁止）自己猜。
 *  - local 键 → 透传 `storageAdapter.sSet` 的结果（`local` 真落盘 / `memory` 只进内存 / `ok:false` 失败）；
 *  - **KV 键 → 抛错（结构性禁止）**：同步 API 拿不到网络写结果，历史上只能 fire-and-forget
 *    ⇒ 调用方**永远无法确认**，只能寄生全局总线，并写出 3 处**假的** try/catch
 *    （`conversationState` / `backupStore.writeLS` / `tableWorkspaceState`，见 storageAdapter 注释）。
 *    要写 KV 键请用 `contentSetAsync` 并 `await`（那里失败可判：4xx 上抛、引擎不可用降级有返回值）。
 * 仅以下**契约违规**会抛错（属 bug，调用方**不应静默吞**，应 fail-fast 暴露）：
 *   ① 键未在 STORAGE_KEYS 登记（dev 下 `checkRegistered` 抛）；
 *   ② 值无法 `JSON.stringify`（如循环引用）；
 *   ③ **KV 键走同步 API**（本契约新增，见上）；
 *   ④ 订阅者回调（notify）抛错。
 */
export function contentSet(key: string, value: unknown): PersistWriteOutcome {
  checkRegistered(key);
  cache.set(key, value);
  const backend = resolveBackend(key);
  if (backend === 'kv') {
    throw new Error(
      `[contentStore] KV 键禁止走同步 contentSet（同步 API 拿不到网络写结果 = 静默失败）：${key}` +
        ' → 请改用 contentSetAsync 并 await 其返回值',
    );
  }
  const outcome = sSet(key, typeof value === 'string' ? value : JSON.stringify(value));
  notify(key, value);
  return outcome;
}

/**
 * 同步删除键（**仅 local/native 键**；KV 键同 `contentSet` 的 fail-fast 规则）。
 */
export function contentDelete(key: string): PersistWriteOutcome {
  checkRegistered(key);
  cache.delete(key);
  const backend = resolveBackend(key);
  if (backend === 'kv') {
    throw new Error(
      `[contentStore] KV 键禁止走同步 contentDelete（同步 API 拿不到网络删结果 = 静默失败）：${key}` +
        ' → 请改用 contentDeleteAsync 并 await 其返回值',
    );
  }
  const outcome = sRemove(key);
  notify(key, undefined);
  return outcome;
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

/**
 * 异步写入键值，等待持久化完成（**KV 键的唯一合法写路径**）。
 *
 * 【生产者给全（同 contentSet）】返回 `PersistWriteOutcome`，且 `landed` 说明**到底落到哪**：
 *  - KV 键：`'kv'` = 真进 KV；`'local'` = **引擎不可用，降级写本地副本且已确认落盘**
 *    （`kvWriteOp` 已 `reportDegrade` 提示"跨设备同步可能丢失"）；
 *    `ok:false` = 引擎不可用**且降级副本也没落盘**（数据仅在内存）——降级与真失败**分得开**，不必靠猜。
 *  - 4xx 拒收（如 CAS 409）**原样上抛**（不是 ok:false 返回值）：那是业务结论，调用方须显式处理。
 *  - local 键：透传 `storageAdapter.sSet` 的结果。
 */
export async function contentSetAsync(key: string, value: unknown): Promise<PersistWriteOutcome> {
  checkRegistered(key);
  cache.set(key, value);
  const backend = resolveBackend(key);
  let outcome: PersistWriteOutcome;
  if (backend === 'kv') {
    outcome = await writeKvWithFallback(key, value);
  } else {
    outcome = sSet(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  notify(key, value);
  return outcome;
}

/**
 * 异步删除键，等待删除完成（**KV 键的唯一合法删路径**）。
 *
 * 【删除的诚实语义（TD-02-25）】KV 引擎不可用时**删除状态未知**（键可能仍残留）：
 * 此时 **不谎报已删** —— 返回 `{ok:false, message:'删除未确认（…键可能仍残留）'}`，
 * 由调用方决定是否重试/提示。
 */
export async function contentDeleteAsync(key: string): Promise<PersistWriteOutcome> {
  checkRegistered(key);
  cache.delete(key);
  const backend = resolveBackend(key);
  let outcome: PersistWriteOutcome;
  if (backend === 'kv') {
    const r = await deleteKvWithFallback(key);
    outcome =
      r === 'kv'
        ? { ok: true, landed: 'kv' }
        : { ok: false, message: '删除未确认（KV 引擎不可用，键可能仍残留）' };
  } else {
    outcome = sRemove(key);
  }
  notify(key, undefined);
  return outcome;
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

/**
 * 读某键的**本地镜像**（localStorage 侧、带 `yimao:` 前缀）—— 与后端路由无关，同步可用。
 *
 * 【与三个邻居的区别（别混用）】
 *  - `contentGet`：按后端路由读（**kv 键会短路**返回缓存/undefined ⇒ 冷启动读不到真值）；
 *  - `contentReadThrough`：按后端路由**直读底层**（kv 键恒返 null）；
 *  - `contentGetAsync` / `contentGetKvWithFallback`：KV **权威**读（异步、诚实判别联合）；
 *  - **本函数**：只读**本地那一份**，明确「这不是 KV 真值」。
 *
 * 【存在理由（2026-09-16 · TD-02-42）】`fallback:true` 的双通道键（如 `director3d-project*`，见
 * `kvWriteOp`：仅 `keepFallback` 为真的键在 KV 成功后**保留**镜像；其余键写成功即被 `sRemove` 清掉）
 * 的镜像正是「KV 不可达时的降级源」。d3d 的**启动同步种子**（首帧渲染，不闪空白）要读的就是它 ——
 * 原实现读的是**裸键**（无前缀的历史位置）⇒ 恒空（新用户）/ 读到 pre-TD-7 陈旧工程（老用户）。
 *
 * ⚠️ **不写缓存**（刻意）：镜像若入 cache，`contentGet` 对 KV 键的 `cache.has` 会把它当 KV 值返回，
 *    正是 TD-02-20 批过的「降级副本冒充真值」。本函数**无副作用**，只回答"本地这一份是什么"。
 * @returns 镜像值（已解析）；无镜像 / 存储未就绪 / 解析失败 → `undefined`（**不区分「未就绪」与「没有」的谎报**：两者都不该当种子）。
 */
export function contentGetLocalMirror(key: string): unknown {
  checkRegistered(key);
  // 未就绪 ≠ 不存在（TD-02-2）：扩展环境预填完成前 `sGet` 必返 null，那是"还不知道"
  if (!isStorageReady()) return undefined;
  const raw = sGet(key);
  return raw === null ? undefined : parseJsonOrRaw(raw);
}

/**
 * KV 主通道 + 本地降级副本（双通道）写入原语 —— 供特殊形态键（如 d3d 工程）收编进 contentStore 使用。
 * 行为遵循 STORAGE_KEYS 登记表 per-key 的 `fallback` / `timeout` 选项：
 *  - timeout：KV 读写独立超时（ms），不可达快失败降级；
 *  - fallback=true：KV 成功后保留本地降级副本（双通道镜像），否则成功后清副本（默认）。
 * 写入返回**落盘事实**（`PersistWriteOutcome`），供调用方标记（如 d3d 跨窗口冲突提示）：
 * `landed:'kv'` 真进 KV；`landed:'local'` 已降级落本地；`ok:false` **双通道全失**（数据仅在内存）。
 * 普通 store 请勿直接调本原语——走 contentSet/contentSetAsync 即可（per-key 选项对它们同样生效）。
 */
export async function contentSetKvWithFallback(
  key: string,
  value: unknown,
): Promise<PersistWriteOutcome> {
  checkRegistered(key);
  return writeKvWithFallback(key, value);
}

/**
 * KV 主通道 + 本地降级副本（双通道）读取原语（含迁移许可信号）。
 *
 * 【信号诚实化（TD-02-19/25 修复·正确性）】旧实现把「KV 真空」「KV 读失败」都标 `from:'local'`，
 * 下游（d3d `hydrateProject`）据假信号**无条件写回 KV** → lost update + 已删数据复活。
 * 现返回诚实判别联合，并在「KV 真空」分支额外探测本地副本供一次性迁移：
 *  - KV 命中非空        → `{ ok:true, value, source:'kv' }`
 *  - KV 真空 + 本地有副本 → `{ ok:true, value:本地副本, source:'kv', vacated:true, fallback:本地副本 }`
 *      （`vacated:true` = **KV 确认为空**，`fallback` 是待迁移的本地副本 —— 这是唯一允许迁移的形态）
 *  - KV 真空 + 本地也空   → `{ ok:true, value:null, source:'kv', vacated:true }`
 *  - KV 引擎不可用        → `{ ok:true, value:本地副本, source:'local', degraded:true }`（**不可迁移**）
 *  - KV 4xx 拒收          → `{ ok:false, error:'rejected' }`（不服务本地副本、不可迁移）
 * **迁移判定铁律**：只认 `vacated === true`（KV 真空的确定回答）；`source:'local'` 或 `rejected`
 * 一律**禁止**写回 KV（KV 真值未知，写回即 clobber / 复活）。
 */
export interface KvFallbackReadResult {
  ok: boolean;
  value?: unknown;
  source?: 'kv' | 'local';
  degraded?: boolean;
  /** KV 确认为空（"确定没有"，非"读失败"）；仅此情形允许一次性迁移写回。 */
  vacated?: boolean;
  /** KV 真空时探测到的本地降级副本（待迁移源）；无则 undefined。 */
  fallback?: unknown;
  error?: 'rejected';
  status?: number;
}

export async function contentGetKvWithFallback(key: string): Promise<KvFallbackReadResult> {
  checkRegistered(key);
  try {
    const res = await kvReadOp(key);
    if (res.source === 'kv') {
      if (res.value != null) return { ok: true, value: res.value, source: 'kv' };
      // KV 真空：探测本地副本，供调用方决定一次性迁移（唯一许可迁移的形态）
      const raw = sGet(key);
      const fallback = raw === null ? null : parseJsonOrRaw(raw);
      return {
        ok: true,
        value: fallback,
        source: 'kv',
        vacated: true,
        fallback: fallback ?? undefined,
      };
    }
    // 引擎不可用降级（source:'local'）：KV 真值未知 → 不携带 vacated，禁迁移
    return { ok: true, value: res.value, source: 'local', degraded: true };
  } catch (e) {
    // 4xx 业务拒收：诚实返回 rejected（不吞、不降级），调用方据分支决定行为
    return { ok: false, error: 'rejected', status: statusOf(e) };
  }
}

// ─────────────────────────────────────────────────────────────────
// KV 协议原语：版本读 + 条件写（CAS）—— 严格族（用户主数据）专用
// ─────────────────────────────────────────────────────────────────
// 【为什么在这里】KV 后端的协议能力是「get / set / delete / version / 条件写」五件事。
// 入口只暴露前三件时，需要版本语义的消费者（画布快照）只能绕过入口直调 transport →
// 唯一入口红线名存实亡（TD-02-1）。故把后两件也收进本模块，接口面与后端能力对齐。
// 【为什么不降级】CAS 语义要求 fail-closed：写不进去宁可报失败，也不能偷偷写本地副本
// （否则两窗口各写一份本地副本 → 静默分叉，且 KV 恢复后本地副本永远不会被回读 → 数据陷阱）。
// 因此本族**不做任何降级**，失败一律上抛，由业务编排层（projectStore）决定如何呈现。
// ─────────────────────────────────────────────────────────────────

/**
 * 读 KV 键的服务端版本号（CAS 基线）。
 * - 非 KV 后端键返回 0（无版本概念）；键必须已登记（checkRegistered 守卫）。
 * - 读失败**原样上抛**（不吞成 0）：调用方据此 fail-closed，避免「读不到版本 → 当成版本 0 → 覆盖别人」。
 *   需要「读失败静默」的场景（如 3s 冲突轮询）由调用方自行 catch。
 */
export async function contentKvGetVersion(key: string): Promise<number> {
  checkRegistered(key);
  if (resolveBackend(key) !== 'kv') return 0;
  return kvGetVersion(key);
}

/** CAS 写入结果：landed 恒 'kv'（严格族不降级）；version = 服务端写入后的新版本（桩/异常态可能缺省）。 */
export interface KvCasWriteResult {
  landed: 'kv';
  version?: number;
}

/**
 * 「读内容 + 取配对版本」结果（`contentKvReadWithVersion` 返回）。
 *
 * `value === null` 是**合法状态**（键不存在），不是失败 —— 失败一律上抛。
 * 要 CAS 安全写入，必须持有本次读到的 `(value, version)` **配对**：
 * 版本 ≥ 内容版本（见下），最坏是【假冲突】（拒绝写 + 提示刷新）；
 * 反过来（先读内容后读版本）会出现「把别人的新写入当成自己的基线 → CAS 通过 → 覆盖别人」，
 * 那是【静默丢数据】。
 */
export interface KvVersionedRead<T> {
  value: T | null;
  /** 与服务端版本对齐的 CAS 基线（可安全用于下次 `contentKvSetCas({ifVersion})`）。 */
  version: number;
}

/**
 * KV「读内容 + 配对版本」原语（严格族 · fail-closed）—— CAS 读的半套协议。
 *
 * 【为什么存在（2026-09-14 收口 · TD-02-29）】本仓曾有 **3 份同构副本**各自手写这段读法：
 *   · `base/store/projectStore.ts` 画布快照（三段读，重试 ≤3）
 *   · `videoEditor/engine/services/storage/service.ts` 剪辑工程（重试 ≤2）
 *   · 自建 videoEditor 的一份（已随 `_legacy/` 整体删除，曾是上一份的口径来源）
 * 三者只在「重试次数」上不同 —— 那是**调用方判据**，不是协议本身。
 * 故把**协议**（怎么读才能拿到配对）收口到此处唯一一份；**判据**（重试几次、失败怎么办）留给调用方。
 *
 * 【读法】版本 → 内容 → 版本（三段）：期间被别人改过（v1 !== v2）→ 重读 `retries` 次；
 * 仍不稳则取**最新 v2**（宁假冲突，不假通过）。
 *
 * 【边界】只做探测，不做判据 ——
 *   · 不做任何降级（与严格族一致）：读失败原样上抛，调用方自行决定 fail-closed 呈现；
 *   · 不硬编码重试次数（`retries` 由调用方按场景给：单次加载 2 次、高频交互 3 次）；
 *   · 不解析业务结构（返回 unknown，归一化属各域自己的 `normalize*`）。
 */
export async function contentKvReadWithVersion<T = unknown>(
  key: string,
  { retries = 2 }: { retries?: number } = {},
): Promise<KvVersionedRead<T>> {
  checkRegistered(key);
  let version = await contentKvGetVersion(key);
  let value = (await contentGetAsync(key)) as T | null;
  for (let attempt = 0; attempt < retries; attempt++) {
    const after = await contentKvGetVersion(key);
    if (after === version) break;
    version = after;
    value = (await contentGetAsync(key)) as T | null;
  }
  return { value, version };
}

/**
 * KV 条件写（CAS）—— 严格族写入原语。
 * - `opts.ifVersion` 传入 = 乐观并发：服务端当前版本不符 → 抛 HttpError(409) 且**一个字节都不写**；
 *   缺省 = 无条件写（备份导入/强制覆盖，服务端仍会自增版本）。
 * - **绝不降级**：任何失败（4xx 拒绝 / 网络不可用）都原样上抛，不写本地副本、不 reportDegrade。
 * - 成功后按 STORAGE_KEYS 的 per-key `fallback` 清理历史降级副本（与 writeKvWithFallback 同口径）。
 */
export async function contentKvSetCas(
  key: string,
  value: unknown,
  opts: { ifVersion?: number } = {},
): Promise<KvCasWriteResult> {
  checkRegistered(key);
  const { timeout, keepFallback } = kvOpMeta(key);
  const res = await withKvTimeout(kvSet(key, value, opts), timeout, `KV 写入超时 (key=${key})`);
  if (!keepFallback) sRemove(key);
  const version = res?.data?.version;
  return { landed: 'kv', version: typeof version === 'number' ? version : undefined };
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
