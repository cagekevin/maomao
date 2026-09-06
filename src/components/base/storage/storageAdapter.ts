/**
 * 存储适配层：Chrome 插件环境用 chrome.storage.local，普通环境回退 localStorage。
 *
 * 设计：为兼容现有同步调用（localStorage.getItem/setItem），本层提供「同步内存缓存」。
 *  - 启动时 initStorage() 从 chrome.storage.local 批量加载到内存 Map（异步）
 *  - 之后 sGet/sSet/sRemove 同步读写内存，sSet 同步更新内存 + 异步持久化到 chrome.storage.local
 *  - 非插件环境直接读写 localStorage（同步），与现有行为一致
 *
 * 使用：页面入口调用一次 initStorage()（App.tsx onMount），此后配置读写走 sGet/sSet。
 *
 * 【R1 系统性根因治理】写入失败不再静默吞掉：sSet/sRemove 任一持久化失败都发布
 * `persist:failed` 事件（含 key），由全局监听器节流上报 toast。调用方无需逐个改。
 */
import { publish } from '../core/eventBus.ts';
import { logger } from '../core/logger.ts';

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
    return false;
  }
}

/**
 * localStorage 是否可用。
 *
 * 【SSR / Node 兜底】服务端渲染、Node 测试环境、或刻意剥离 DOM 的运行环境里
 * `localStorage` 是未定义标识符，直接访问会抛 ReferenceError。此时不抛、不 warn，
 * 所有读写静默回退到内存 Map（见下方的 memFallback），避免初始化期就炸掉，
 * 也避免 persistFailureBus 收到无意义的 persist:failed 噪声。
 */
export function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

/** 内存兜底缓存：仅当 localStorage 不可用时启用，保证 SSR/Node 下读写零抛错。 */
const memFallback = new Map<string, string>();

/** 写入失败上报（统一事件，全局监听器节流 toast；测试可替换全局 publish）。
 * 【P0·M3 观测】失败落日志（warn），供离线 grep 探明根因（key + error.message），
 * 不改变事件链路——事件照常 publish，logger 仅旁路记录。 */
function reportPersistFailure(key: string, error: unknown) {
  try {
    const message = (error as { message?: unknown } | null)?.message || String(error || '');
    publish('persist:failed', { key, error: message });
    logger.warn('存储', '持久化失败', { key, error: message });
  } catch {
    /* 事件上报本身失败不阻断写入流程 */
  }
}

/** 存储键统一前缀（对外导出：storageQuota 统计实际键剥前缀用，避免第二处硬编码 'yimao:'）。
 * 数据流：sGet/sSet/sRemove 读写 localStorage/chrome.storage 时自动拼此前缀；
 * storageQuota.enumerateLocalEntries 枚举到的是带此前缀的 rawKey，剥掉后才映射回 STORAGE_KEYS 逻辑键名。 */
export const KEY_PREFIX: string = 'yimao:';
const cache = new Map<string, unknown>();
let loaded = false;

/** 初始化：插件环境从 chrome.storage.local 批量加载到内存缓存（仅需调用一次） */
export function initStorage(): void {
  if (loaded || !isChromeExtension()) {
    loaded = true;
    return;
  }
  try {
    chrome.storage.local.get(null, (all) => {
      if (all && typeof all === 'object') {
        for (const k of Object.keys(all)) {
          if (k.startsWith(KEY_PREFIX)) cache.set(k.slice(KEY_PREFIX.length), all[k]);
        }
      }
      loaded = true;
    });
  } catch {
    loaded = true;
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
      return null;
    }
  }
  const v = cache.get(key);
  return v === undefined ? null : typeof v === 'string' ? v : JSON.stringify(v);
}

/** 同步写（插件环境同步更新内存 + 异步持久化） */
export function sSet(key: string, value: unknown): void {
  const fullKey = KEY_PREFIX + key;
  if (!isChromeExtension()) {
    // 【SSR/Node 兜底】localStorage 不可用时写内存，不触发 persist:failed
    if (!hasLocalStorage()) {
      memFallback.set(fullKey, value as string);
      return;
    }
    try {
      localStorage.setItem(fullKey, value as string);
    } catch (e) {
      reportPersistFailure(key, e);
    }
    return;
  }
  cache.set(key, value);
  try {
    // 【R1】接 chrome.storage.local.set 的 callback，异步失败也能感知（原裸 try/catch 覆盖不到异步错误）
    chrome.storage.local.set({ [fullKey]: value }, () => {
      if (chrome?.runtime?.lastError)
        reportPersistFailure(key, new Error(chrome.runtime.lastError.message));
    });
  } catch (e) {
    // 同步抛错：先尝试回退 localStorage，回退成功（数据未丢）则不报失败
    try {
      localStorage.setItem(fullKey, value as string);
    } catch {
      reportPersistFailure(key, e);
    }
  }
}

/** 同步删（插件环境同步删内存 + 异步删存储） */
export function sRemove(key: string): void {
  const fullKey = KEY_PREFIX + key;
  if (!isChromeExtension()) {
    // 【SSR/Node 兜底】localStorage 不可用时从内存删，不触发 persist:failed
    if (!hasLocalStorage()) {
      memFallback.delete(fullKey);
      return;
    }
    try {
      localStorage.removeItem(fullKey);
    } catch (e) {
      reportPersistFailure(key, e);
    }
    return;
  }
  cache.delete(key);
  try {
    chrome.storage.local.remove(fullKey, () => {
      if (chrome?.runtime?.lastError)
        reportPersistFailure(key, new Error(chrome.runtime.lastError.message));
    });
  } catch (e) {
    reportPersistFailure(key, e);
  }
}
