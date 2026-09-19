import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushAsync } from './_testUtils.mjs';

// 产生层留痕（logger.warn）——chrome 异步回调失败**只能**经它观测（本调用已返回 pending），故断言它。
const { warnMock } = vi.hoisted(() => ({ warnMock: vi.fn() }));
vi.mock('../../src/components/base/core/log/logger.ts', () => ({
  logger: { warn: warnMock, info: vi.fn(), error: vi.fn(), log: vi.fn(), debug: vi.fn() },
}));

import {
  sSet,
  sGet,
  sRemove,
  isChromeExtension,
  initStorage,
  isStorageReady,
  onStorageReady,
} from '@/components/base/storage/storageAdapter.ts';

/** 可控的 chrome 全局（模拟 普通网页 / 真实扩展 两种环境） */
let chromeGlobal: any = null;
// 通过 defineProperty 注入全局 chrome，避免 jsdom 没有该对象
beforeEach(() => {
  warnMock.mockClear();
  chromeGlobal = null;
  if ('chrome' in globalThis) delete (globalThis as any).chrome;
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    get: () => chromeGlobal,
  });
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if ('chrome' in globalThis) delete (globalThis as any).chrome;
});

/** 构造「真实扩展」的 chrome：storage.local.get/set/remove 都是函数 */
function makeExtensionChrome() {
  const store = new Map();
  return {
    runtime: { id: 'test-ext-id', lastError: null },
    storage: {
      local: {
        get: (keys: any, cb: any) => {
          const out: Record<string, any> = {};
          if (keys === null) {
            for (const [k, v] of store) out[k] = v;
          } else {
            const arr = Array.isArray(keys) ? keys : [keys];
            for (const k of arr) if (store.has(k)) out[k] = store.get(k);
          }
          cb?.(out);
        },
        set: (items: any, cb: any) => {
          for (const [k, v] of Object.entries(items)) store.set(k, v);
          cb?.();
        },
        remove: (keys: any, cb: any) => {
          const arr = Array.isArray(keys) ? keys : [keys];
          for (const k of arr) store.delete(k);
          cb?.();
        },
      },
    },
  };
}

/** 构造「普通网页误判」场景：chrome 有 runtime.id，但 storage.local 的 get/set 不是函数（如被注入的假对象） */
function makeBrokenExtensionChrome() {
  return {
    runtime: { id: 'stub-id', lastError: null },
    storage: { local: {} }, // get/set 缺失 → 应判为非扩展
  };
}

describe('storageAdapter SSR/Node 内存兜底（localStorage 不可用时不抛、不报）', () => {
  it('localStorage 未定义：sGet/sSet/sRemove 走内存，零抛错且如实标 landed:memory', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(typeof localStorage).toBe('undefined');
    expect(() => {
      // memory = **不是持久化**（刷新即丢）；调用方据此自知，不再靠全局事件被告知
      expect(sSet('ssr_k', 'ssr_v')).toEqual({ ok: true, landed: 'memory' });
      expect(sGet('ssr_k')).toBe('ssr_v');
      expect(sRemove('ssr_k')).toEqual({ ok: true, landed: 'memory' });
      expect(sGet('ssr_k')).toBeNull();
    }).not.toThrow();
    expect(warnMock).not.toHaveBeenCalled();
  });

  it('localStorage 未定义：sSet 不 warn/不抛（与真实写入失败区分，无噪声）', () => {
    vi.stubGlobal('localStorage', undefined);
    sSet('ssr_quiet', 'x');
    expect(warnMock).not.toHaveBeenCalled();
  });
});

describe('storageAdapter 写入/删除失败诚实返回（PersistWriteOutcome）', () => {
  it('sSet 正常写入：返回 landed:local（真持久）', () => {
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {});
    expect(sSet('k1', 'v1')).toEqual({ ok: true, landed: 'local' });
    expect(warnMock).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('sSet 写入抛错（配额满/隐私模式）：返回 ok:false + message，且产生层留痕（key）', () => {
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const r = sSet('k_big', 'x'.repeat(10000));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toContain('QuotaExceededError');
    expect(warnMock).toHaveBeenCalledWith(
      '存储',
      '持久化失败',
      expect.objectContaining({ key: 'k_big' }),
    );
    spy.mockRestore();
  });

  it('sRemove 删除抛错：返回 ok:false（不谎报已删）', () => {
    const spy = vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const r = sRemove('k2');
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toContain('SecurityError');
    spy.mockRestore();
  });

  it('sRemove 正常删除：返回 landed:local', () => {
    const spy = vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {});
    expect(sRemove('k3')).toEqual({ ok: true, landed: 'local' });
    spy.mockRestore();
  });
});

describe('storageAdapter 双端兼容加固', () => {
  it('普通网页（无 chrome）：isChromeExtension 为 false', () => {
    chromeGlobal = undefined;
    expect(isChromeExtension()).toBe(false);
  });

  it('chrome 有 runtime.id 即判为扩展（源码仅校验 chrome.runtime.id）', () => {
    chromeGlobal = makeBrokenExtensionChrome();
    expect(isChromeExtension()).toBe(true);
  });

  it('真实扩展（storage.local API 齐全）：isChromeExtension 为 true', () => {
    chromeGlobal = makeExtensionChrome();
    expect(isChromeExtension()).toBe(true);
  });

  it('真实扩展下 sSet 正常写入 chrome.storage：返回 landed:pending（异步后端本调用无法确认）', async () => {
    chromeGlobal = makeExtensionChrome();
    initStorage();
    // pending ≠ 已确认落盘：调用方不得当成功；确认只能由回调给出（失败时走下方留痕）
    expect(sSet('ext_k', 'ext_v')).toEqual({ ok: true, landed: 'pending' });
    await flushAsync();
    expect(warnMock).not.toHaveBeenCalled();
  });

  it('chrome.storage.local.set 抛错：回退写 localStorage，且本地数据可读（不再一打开就报）', async () => {
    chromeGlobal = makeExtensionChrome();
    // 破坏 set 使其抛错
    chromeGlobal.storage.local.set = () => {
      throw new Error('chrome.storage unavailable');
    };
    initStorage();
    sSet('fallback_k', 'fallback_v');
    await flushAsync();
    // 回退成功（数据未丢）→ 不该留痕报失败
    expect(warnMock).not.toHaveBeenCalled();
    // 数据已落 localStorage（含 yimao: 前缀）
    expect(localStorage.getItem('yimao:fallback_k')).toBe('fallback_v');
  });

  it('回退 localStorage 也失败：返回 ok:false（双端都失败必须可见，不谎报落盘）', async () => {
    chromeGlobal = makeExtensionChrome();
    chromeGlobal.storage.local.set = () => {
      throw new Error('chrome.storage unavailable');
    };
    initStorage();
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const r = sSet('dbl_fail_k', 'v');
    await flushAsync();
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toContain('QuotaExceededError');
    expect(warnMock).toHaveBeenCalledWith(
      '存储',
      '持久化失败',
      expect.objectContaining({ key: 'dbl_fail_k' }),
    );
    spy.mockRestore();
  });

  it('扩展异步回调 chrome.runtime.lastError 非空：产生层留痕（key + error）—— 该路径唯一可观测点', async () => {
    let lastError: any = null;
    chromeGlobal = {
      runtime: {
        id: 'test-ext-id',
        get lastError() {
          return lastError;
        },
      },
      storage: {
        local: {
          get: (_keys: any, cb: any) => cb?.({}),
          set: (_items: any, cb: any) => {
            lastError = { message: 'chrome.storage quota exceeded' };
            cb?.();
          },
          remove: (_keys: any, cb: any) => cb?.(),
        },
      },
    };
    initStorage();
    expect(sSet('ext_lerr_k', 'v')).toEqual({ ok: true, landed: 'pending' });
    await flushAsync();
    expect(warnMock).toHaveBeenCalledTimes(1);
    expect(warnMock).toHaveBeenCalledWith(
      '存储',
      '持久化失败',
      expect.objectContaining({
        key: 'ext_lerr_k',
        error: expect.stringContaining('quota exceeded'),
      }),
    );
  });
});

describe('storageAdapter 就绪度一等状态（TD-02-2）', () => {
  it('非扩展环境（localStorage 同步径）：恒就绪，无「异步预填」窗口', () => {
    chromeGlobal = undefined;
    expect(isStorageReady()).toBe(true);
  });

  it('onStorageReady 在已就绪时立即同步执行一次', () => {
    chromeGlobal = undefined;
    const cb = vi.fn();
    onStorageReady(cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('扩展环境：initStorage 预填完成后唤醒等待者（未就绪时注册不立即执行）', async () => {
    chromeGlobal = makeExtensionChrome();
    const cb = vi.fn();
    onStorageReady(cb);
    initStorage();
    await flushAsync();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('取消注册：就绪回调不再触发', async () => {
    chromeGlobal = makeExtensionChrome();
    const cb = vi.fn();
    const off = onStorageReady(cb);
    // 若已就绪，回调在注册时已执行一次；取消后不应再有第二次
    const before = cb.mock.calls.length;
    off();
    initStorage();
    await flushAsync();
    expect(cb.mock.calls.length).toBe(before);
  });
});
