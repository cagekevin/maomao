/**
 * 存储适配层：Chrome 插件环境用 chrome.storage.local，普通环境回退 localStorage。
 *
 * 设计：为兼容现有同步调用（localStorage.getItem/setItem），本层提供「同步内存缓存」。
 *  - 启动时 initStorage() 从 chrome.storage.local 批量加载到内存 Map（异步）
 *  - 之后 sGet/sSet/sRemove 同步读写内存，sSet 同步更新内存 + 异步持久化到 chrome.storage.local
 *  - 非插件环境直接读写 localStorage（同步），与现有行为一致
 *
 * 使用：页面入口调用一次 initStorage()（**实为 main.tsx 模块体第 12 行**，早于 App 渲染；原注释写「App.tsx onMount」已过时），此后配置读写走 sGet/sSet。
 *
 * 【就绪度是一等状态（2026-09-12 / TD-02-2）】预填是**异步**的，而导出的读写是**同步**的 →
 * 天然存在「未就绪窗口」。本层暴露 `isStorageReady()`，并以 `onStorageReady(cb)` 让模块级 eager 读
 * 在就绪后重读一次。**上层必须区分「未就绪」与「不存在」**，禁止把前者缓存成后者（否则整会话粘成空）。
 *
 * 【失败可见性 · 2026-09-17 终局（TD-24-4 阶段 2）】写入失败由**产生它的这一层**给全：
 * `sSet/sRemove` 返回 `PersistWriteOutcome`（见下），各站点用 `core/degrade.ts::confirmPersist` 自确认。
 * 原 `persist:failed` 全局广播 + `usePersistFailureToast` 全局监听器**已删除** ——
 * 用户裁定：「持久化失败肯定是各个地方自己确认，凭什么让一个总的去给他们兜底？」
 * （全局总线还有三处盲区：同 key 节流合并 / memFallback 不 publish / 绕开 adapter 的链路全漏。）
 */
import { logger } from '../core/logger.ts';
// 非阻塞副作用统一走原语（`NON_BLOCKING` 的收口实现），不再逐处手写 catch-ok 标记（2026-09-17）。
import { attemptQuietly } from '../utils/asyncGuard.ts';

/** Chrome 扩展全局（宿主注入，本层仅用到 runtime/storage.local 最小子集）。type-check 需显式声明。 */
declare const chrome: {
  runtime: {
    id?: string;
    lastError?: { message: string };
  };
  storage: {
    local: {
      get(
        keys: string[] | string | Record<string, unknown> | null,
        callback: (items: Record<string, unknown>) => void,
      ): void;
      set(items: Record<string, unknown>, callback?: () => void): void;
      remove(keys: string | string[], callback?: () => void): void;
    };
  };
};

/** 是否运行在 Chrome 扩展环境 */
export function isChromeExtension(): boolean {
  try {
    return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
  } catch {
    // catch-ok: BROWSER_API
    // 本处即「宿主环境探测**原语**」本体（非扩展端时 chrome 未定义）；
    // 返回 false = 非扩展端，调用方据此走浏览器降级路径。属所有者定义失败语义，非消费者越权。
    return false;
  }
}

/**
 * localStorage 是否可用。
 *
 * 【SSR / Node 兜底】服务端渲染、Node 测试环境、或刻意剥离 DOM 的运行环境里
 * `localStorage` 是未定义标识符，直接访问会抛 ReferenceError。此时不抛、不 warn，
 * 所有读写回退到内存 Map（见下方的 memFallback），避免初始化期就炸掉；
 * 该路径返回值如实标 `landed:'memory'`（**不是持久化**），调用方因此不会误当成功。
 */
export function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    // catch-ok: BROWSER_API
    // 环境探测**原语**本体（SSR/Node 下 localStorage 是未定义标识符，直接访问会抛）。
    return false;
  }
}

/** 内存兜底缓存：仅当 localStorage 不可用时启用，保证 SSR/Node 下读写零抛错。 */
const memFallback = new Map<string, string>();

/**
 * 落盘结果（判别联合）—— **失败是返回值，不再"发个事件就算交代了"**。
 *
 * 【为什么必须有它（2026-09-17 · TD-24-4 阶段0 · 让生产者把失败给全）】
 * 原 `sSet/sRemove` 返回 `void`：失败只 `publish('persist:failed')`（全局总线）然后**照常返回**
 * ⇒ 任何调用方都**无法**自己确认成败，只能寄生那条总线；而总线的盲区（同 key 5s 节流 /
 * memFallback 路径不 publish / 绕开 adapter）就是静默丢数据的窗口 —— 这正是用户裁定
 * 「持久化失败必须由各处自己确认，不许一个总的替它们兜底」要消灭的东西。
 *
 * 【实证：消费者为此写过 3 处假处理】`conversationState` / `backupStore.writeLS` /
 * `tableWorkspaceState` 都拿 `try { contentSet } catch` 当"失败处理"——而 `contentSet` 同步路径
 * **从不为持久化失败抛错**，那段 catch 永远不触发（= 摆设，且 `writeLS` 因此恒返 `true`）。
 *
 * 【`landed` 状态，不拿 ok:true 一概而论】
 *  - `local`   已确认写进浏览器持久层；
 *  - `kv`      已确认写进 localTool KV（跨端真源；由 `contentStore.contentSetAsync` 产出）；
 *  - `memory`  localStorage 不可用（SSR/受限环境）→ 只进内存，**刷新即丢**（不是持久化）；
 *  - `pending` 异步后端（chrome 扩展路径）已提交，**本调用无法确认**（结果只能由回调上报）；
 *  - `ok:false` 确认失败（同步路径的事实由本返回值给出；另在产生层落一条 warn 供离线 grep）。
 */
export type PersistWriteOutcome =
  { ok: true; landed: 'local' | 'kv' | 'memory' | 'pending' } | { ok: false; message: string };

/**
 * 产生层失败留痕（**只落日志，不广播**）。
 *
 * 【为什么必须留着】chrome 扩展路径（`chrome.storage.local.set/remove` 的**异步回调**）的失败
 * 发生在本次调用返回**之后**，结构上无法经由 `PersistWriteOutcome` 回报（故该路径标
 * `landed:'pending'`）—— 这条 `logger.warn`（key + error.message）是它**唯一**的留痕，删掉即静默。
 * 同步失败路径的返回值已给出事实，此处日志是产生层的原始记录（供离线 grep 根因）。
 *
 * 【已删（2026-09-17 · TD-24-4 阶段 2）】原 `publish('persist:failed')` 全局广播 + 随之的
 * `RECURSION_GUARD` 空 catch：广播通道按用户裁定退役（失败由各站点自确认），空 catch 只是
 * 掩盖 logger 自身异常的兜底，一并删除（兜底净减）。
 */
function logPersistFailure(key: string, error: unknown): void {
  const message = (error as { message?: unknown } | null)?.message || String(error || '');
  logger.warn('存储', '持久化失败', { key, error: message });
}

/** 存储键统一前缀（对外导出：storageQuota 统计实际键剥前缀用，避免第二处硬编码 'yimao:'）。
 * 数据流：sGet/sSet/sRemove 读写 localStorage/chrome.storage 时自动拼此前缀；
 * storageQuota.enumerateLocalEntries 枚举到的是带此前缀的 rawKey，剥掉后才映射回 STORAGE_KEYS 逻辑键名。 */
export const KEY_PREFIX: string = 'yimao:';
const cache = new Map<string, unknown>();
let loaded = false;

/**
 * 预填完成监听者（TD-02-2）。模块级 eager 读在扩展环境拿不到数据，就绪后必须重读一次。
 * 定序：本模块被 import（评估）时 loaded 仍为 false，监听者只能靠 initStorage 的异步回调唤醒。
 */
const readyListeners = new Set<() => void>();

/**
 * 预填是否完成（TD-02-2）。
 * - 非插件环境（localStorage 同步读写）**恒就绪** —— 不存在「异步预填」这一步；
 * - 插件环境：chrome.storage 预填回调完成前 = **未就绪**。此时任何同步读都读不到真实数据，
 *   调用方必须区分「未就绪（还不知道）」与「确实不存在」，**禁止把前者缓存成后者**。
 */
export function isStorageReady(): boolean {
  return loaded || !isChromeExtension();
}

/**
 * 注册「预填完成」回调（已就绪则立即同步执行一次）。返回取消函数。
 * 用途：模块级 eager 读（projectStore / resourceStore / appSettings）在未就绪时只能拿到默认值，
 * 就绪后必须重读一次；否则整会话停留在默认值，且默认值/种子可能已回写覆盖真实存档。
 */
export function onStorageReady(cb: () => void): () => void {
  if (isStorageReady()) {
    cb();
    return () => {};
  }
  readyListeners.add(cb);
  return () => readyListeners.delete(cb);
}

/** 标记预填完成并唤醒监听者（仅由 initStorage 调用；幂等） */
function markReady(): void {
  if (loaded) return;
  loaded = true;
  const waiters = [...readyListeners];
  readyListeners.clear();
  for (const cb of waiters) {
    // 单个监听者失败不影响其余（就绪事件不该被下游异常吞掉）→ 走**唯一原语**，不再手写豁免标记。
    attemptQuietly(cb);
  }
}

/** 初始化：插件环境从 chrome.storage.local 批量加载到内存缓存（仅需调用一次） */
export function initStorage(): void {
  if (loaded || !isChromeExtension()) {
    markReady();
    return;
  }
  try {
    chrome.storage.local.get(null, (all) => {
      if (all && typeof all === 'object') {
        for (const k of Object.keys(all)) {
          if (k.startsWith(KEY_PREFIX)) cache.set(k.slice(KEY_PREFIX.length), all[k]);
        }
      }
      markReady();
    });
  } catch {
    markReady();
  }
}

/** 同步读取（字符串或 null，与 localStorage 一致） */
export function sGet(key: string): string | null {
  if (!isChromeExtension()) {
    // 【SSR/Node 兜底】localStorage 不可用时走内存，零抛错、不 warn
    if (!hasLocalStorage()) return memFallback.get(KEY_PREFIX + key) ?? null;
    try {
      return localStorage.getItem(KEY_PREFIX + key);
    } catch {
      // catch-ok: READ_FALLBACK
      // 本处即「存储读取**原语**」本体：localStorage 受限（隐私模式）读不到 → null。
      return null;
    }
  }
  const v = cache.get(key);
  return v === undefined ? null : typeof v === 'string' ? v : JSON.stringify(v);
}

/** 同步写（插件环境同步更新内存 + 异步持久化）—— 结果见 `PersistWriteOutcome`。 */
export function sSet(key: string, value: unknown): PersistWriteOutcome {
  const fullKey = KEY_PREFIX + key;
  if (!isChromeExtension()) {
    // 【SSR/Node】localStorage 不可用 → 只进内存：**不是持久化**，如实标 memory（调用方需自知）
    if (!hasLocalStorage()) {
      memFallback.set(fullKey, value as string);
      return { ok: true, landed: 'memory' };
    }
    try {
      localStorage.setItem(fullKey, value as string);
      return { ok: true, landed: 'local' };
    } catch (e) {
      logPersistFailure(key, e);
      return {
        ok: false,
        message: (e as { message?: string })?.message || 'localStorage 写入失败',
      };
    }
  }
  cache.set(key, value);
  try {
    // 【R1】接 chrome.storage.local.set 的 callback，异步失败也能感知（原裸 try/catch 覆盖不到异步错误）
    chrome.storage.local.set({ [fullKey]: value }, () => {
      if (chrome?.runtime?.lastError)
        logPersistFailure(key, new Error(chrome.runtime.lastError.message));
    });
    // 异步后端：本调用**无法确认**结果（不谎报 local，也不谎报失败）
    return { ok: true, landed: 'pending' };
  } catch (e) {
    // 同步抛错：先尝试回退 localStorage，回退成功（数据未丢）则是真落盘
    try {
      localStorage.setItem(fullKey, value as string);
      return { ok: true, landed: 'local' };
    } catch (localErr) {
      logPersistFailure(key, localErr);
      return {
        ok: false,
        message: (localErr as { message?: string })?.message || '持久化写入失败',
      };
    }
  }
}

/** 同步删（插件环境同步删内存 + 异步删存储）—— 结果同 `PersistWriteOutcome`。 */
export function sRemove(key: string): PersistWriteOutcome {
  const fullKey = KEY_PREFIX + key;
  if (!isChromeExtension()) {
    // 【SSR/Node】localStorage 不可用 → 只删内存（同写侧：非持久，如实标 memory）
    if (!hasLocalStorage()) {
      memFallback.delete(fullKey);
      return { ok: true, landed: 'memory' };
    }
    try {
      localStorage.removeItem(fullKey);
      return { ok: true, landed: 'local' };
    } catch (e) {
      logPersistFailure(key, e);
      return {
        ok: false,
        message: (e as { message?: string })?.message || 'localStorage 删除失败',
      };
    }
  }
  cache.delete(key);
  try {
    chrome.storage.local.remove(fullKey, () => {
      if (chrome?.runtime?.lastError)
        logPersistFailure(key, new Error(chrome.runtime.lastError.message));
    });
    return { ok: true, landed: 'pending' };
  } catch (e) {
    logPersistFailure(key, e);
    return { ok: false, message: (e as { message?: string })?.message || '持久化删除失败' };
  }
}
