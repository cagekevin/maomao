/**
 * storageQuota 纯函数单测（node 环境）。
 * 遵循 TEST-GUIDE §六「值不值得写」：只锁「用户可感知的真实契约」，
 * 不写「真实流程不会发生」的假边界（缺字段/非法类型/未实现占位）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatBytes, formatBytesParts } from '../../src/components/base/core/utils.ts';
import {
  STORAGE_PRESSURE_RATIO,
  estimateBrowserStorage,
  estimateStoragePressure,
  estimateChromeStorage,
  mapKeyToDomain,
  analyzeStorageByKeys,
} from '@/components/base/storage/storageQuota.ts';

/** 可控的 chrome 全局（模拟 普通网页 / 真实扩展 两种环境） */
let chromeGlobal: any = null;
beforeEach(() => {
  chromeGlobal = null;
  if ('chrome' in globalThis) delete (globalThis as { chrome?: unknown }).chrome;
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    get: () => chromeGlobal,
  });
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if ('chrome' in globalThis) delete (globalThis as { chrome?: unknown }).chrome;
});

/** 构造「真实扩展」的 chrome：storage.local.get 是函数 */
function makeExtensionChrome(store: Record<string, any> = {}) {
  return {
    runtime: { id: 'test-ext-id', lastError: null },
    storage: {
      local: {
        get: (keys: any, cb: any) => {
          const out: Record<string, any> = {};
          if (keys === null) {
            for (const [k, v] of Object.entries(store)) out[k] = v;
          } else {
            const arr = Array.isArray(keys) ? keys : [keys];
            for (const k of arr) if (k in store) out[k] = store[k];
          }
          cb?.(out);
        },
      },
    },
  };
}

describe('storageQuota.estimateBrowserStorage', () => {
  it('navigator.storage.estimate 可用：返回 usage/quota/ratio', async () => {
    vi.stubGlobal('navigator', {
      storage: { estimate: async () => ({ usage: 1e6, quota: 10e9 }) },
    });
    const r = await estimateBrowserStorage();
    // 1e6 / 10e9 = 0.0001
    expect(r).toEqual({ usage: 1e6, quota: 10e9, ratio: 0.0001 });
  });

  it('navigator.storage 未定义：返回 null', async () => {
    vi.stubGlobal('navigator', undefined);
    expect(await estimateBrowserStorage()).toBeNull();
  });

  it('quota 为 0：ratio 为 0（防除零，真实边界）', async () => {
    vi.stubGlobal('navigator', { storage: { estimate: async () => ({ usage: 5, quota: 0 }) } });
    expect((await estimateBrowserStorage())!.ratio).toBe(0);
  });
});

describe('storageQuota.estimateStoragePressure', () => {
  it('ratio >= 阈值：underPressure 为 true', () => {
    expect(estimateStoragePressure(0.9).underPressure).toBe(true);
  });
  it('ratio 恰为阈值：underPressure 为 true', () => {
    expect(estimateStoragePressure(STORAGE_PRESSURE_RATIO).underPressure).toBe(true);
  });
  it('ratio < 阈值：underPressure 为 false', () => {
    expect(estimateStoragePressure(0.5).underPressure).toBe(false);
  });
});

describe('storageQuota.estimateChromeStorage', () => {
  it('扩展环境：遍历 chrome.storage.local 估算字节与键数', async () => {
    chromeGlobal = makeExtensionChrome({ 'yimao:a': 'hello', 'yimao:b': { x: 123 } });
    const r = await estimateChromeStorage();
    expect(r).not.toBeNull();
    expect(r!.keys).toBe(2);
    // 'yimao:a' 键 7 + 'hello' 5；'yimao:b' 键 7 + JSON.stringify({x:123}) '{"x":123}' 9
    expect(r!.bytes).toBe(7 + 5 + 7 + 9);
  });

  it('普通网页（无 chrome）：回退 localStorage 估算', async () => {
    localStorage.setItem('yimao:x', 'abc');
    const r = await estimateChromeStorage();
    expect(r).not.toBeNull();
    expect(r!.keys).toBe(1);
    expect(r!.bytes).toBe('yimao:x'.length + 'abc'.length);
  });

  it('chrome.storage.local.get 抛错：返回 null（降级不崩）', async () => {
    chromeGlobal = {
      runtime: { id: 'x' },
      storage: {
        local: {
          get: () => {
            throw new Error('denied');
          },
        },
      },
    };
    expect(await estimateChromeStorage()).toBeNull();
  });
});

describe('storageQuota.mapKeyToDomain（键→domain 映射）', () => {
  it('精确登记键：projects → project', () => {
    expect(mapKeyToDomain('projects')).toBe('project');
  });
  it('精确登记键：app_settings → settings', () => {
    expect(mapKeyToDomain('app_settings')).toBe('settings');
  });
  it('pattern 动态键：agent_conversations_canvas-x → agent', () => {
    expect(mapKeyToDomain('agent_conversations_canvas-assistant-proj-1')).toBe('agent');
  });
  it('pattern 动态键：canvas-state-v1-proj-x → project', () => {
    expect(mapKeyToDomain('canvas-state-v1-proj-abc')).toBe('project');
  });
  it('未登记键：no_such_key → unknown', () => {
    expect(mapKeyToDomain('no_such_key')).toBe('unknown');
  });
});

describe('storageQuota.analyzeStorageByKeys（按键画像）', () => {
  it('Web 环境：按 domain 汇总占用与键数（含精确 + 动态键）', async () => {
    localStorage.clear();
    localStorage.setItem('yimao:projects', '[{"id":"p1"}]'); // project
    localStorage.setItem('yimao:app_settings', '{"debugOn":false}'); // settings
    localStorage.setItem('yimao:agent_conversations_ca', '[{"m":1}]'); // agent（动态 pattern）
    const r = await analyzeStorageByKeys();
    expect(r).not.toBeNull();
    expect(r!.totalKeys).toBe(3);
    // 3 个 domain，按 bytes 降序（agent 键最长 → 最大，其次 settings、project）
    expect(r!.domains.map((d) => d.domain)).toEqual(['agent', 'settings', 'project']);
    expect(r!.domains.find((d) => d.domain === 'project')!.keys).toBe(1);
    expect(r!.domains.find((d) => d.domain === 'settings')!.label).toBe('应用设置');
  });

  it('非业务键（无 yimao: 前缀）也计入，归 unknown 或各自 domain', async () => {
    localStorage.clear();
    localStorage.setItem('yimao:projects', '[1]'); // project
    localStorage.setItem('other_key', 'xyz'); // 无前缀 → unknown
    const r = await analyzeStorageByKeys();
    expect(r).not.toBeNull();
    expect(r!.totalKeys).toBe(2);
    expect(r!.domains.find((d) => d.domain === 'unknown')).toBeTruthy();
  });

  it('chrome.storage.get 抛错：返回 null（降级不崩）', async () => {
    chromeGlobal = {
      runtime: { id: 'x' },
      storage: {
        local: {
          get: () => {
            throw new Error('denied');
          },
        },
      },
    };
    expect(await analyzeStorageByKeys()).toBeNull();
  });
});

// 更新(2026-09-12 / TD-02-8)：`analyzeAgentConversationPressure`（恒 null 的已弃用 API）已删除，
// 对应「已弃用」describe 一并移除——保留"恒 null 仍是正确行为"的用例，等于给死抽象续命。

describe('utils.formatBytes（存储专用）', () => {
  it('B 级：1536 → 1.5 KB', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });
  it('MB 级：5MB → 5.00 MB', () => {
    expect(formatBytes(5 * 1048576)).toBe('5.00 MB');
  });
  it('GB 级：2GB → 2.00 GB', () => {
    expect(formatBytes(2 * 1073741824)).toBe('2.00 GB');
  });
  it('小字节直接 B', () => {
    expect(formatBytes(512)).toBe('512 B');
  });
  it('真空 0 → 0 B；非法（负数 / NaN）→ 哨兵「—」（TD-18-8：非法不得伪装成真实的 0 字节）', () => {
    expect(formatBytes(0)).toBe('0 B'); // 真空：合法真实值
    expect(formatBytes(-1)).toBe('—');
    expect(formatBytes(NaN)).toBe('—');
  });
});

// 【ADR-0004】「数字 / 单位」分两行渲染必须走生产者的**结构化出口**，禁止从显示串 `.split(' ')` 反解析。
describe('utils.formatBytesParts（结构化出口 · ADR-0004）', () => {
  it('合法值 → { value, unit }', () => {
    expect(formatBytesParts(0)).toEqual({ value: '0', unit: 'B' });
    expect(formatBytesParts(512)).toEqual({ value: '512', unit: 'B' });
    expect(formatBytesParts(1536)).toEqual({ value: '1.5', unit: 'KB' });
    expect(formatBytesParts(5 * 1048576)).toEqual({ value: '5.00', unit: 'MB' });
    expect(formatBytesParts(2 * 1073741824)).toEqual({ value: '2.00', unit: 'GB' });
  });

  it('非法（NaN / 负数）→ null（无可用值，不伪装成 0）', () => {
    expect(formatBytesParts(NaN)).toBeNull();
    expect(formatBytesParts(-1)).toBeNull();
  });

  it('formatBytes = formatBytesParts 的渲染（单一真源，不可能漂移）', () => {
    for (const n of [0, 512, 1536, 5 * 1048576, 2 * 1073741824]) {
      const p = formatBytesParts(n);
      expect(p).not.toBeNull();
      if (!p) continue; // 上一行已断言非空；此处仅收窄类型（不用非空断言 !）
      expect(formatBytes(n)).toBe(`${p.value} ${p.unit}`);
    }
  });
});
