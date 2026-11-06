/**
 * storageQuota 纯函数单测（node 环境）。
 * 遵循 TEST-GUIDE §六「值不值得写」：只锁「用户可感知的真实契约」，
 * 不写「真实流程不会发生」的假边界（缺字段/非法类型/未实现占位）。
 *
 * 【2026-11-06 B3】estimateChromeStorage / mapKeyToDomain / analyzeStorageByKeys 已随生产代码
 * 删除（StorageMonitor 两张卡被健康报表取代，符号生产零消费者），对应 describe 一并移除。
 * 保留：estimateBrowserStorage / estimateStoragePressure（活链路）+ formatBytes/formatBytesParts
 * （本文件顺带锁的 utils 契约，与 storageQuota 无关）。
 */
import { must } from '../helpers/must';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatBytes, formatBytesParts } from '../../src/components/base/core/utils.ts';
import {
  STORAGE_PRESSURE_RATIO,
  estimateBrowserStorage,
  estimateStoragePressure,
} from '@/components/base/storage/storageQuota.ts';

/** 可控的 chrome 全局（历史用例已删，保留桩位防其他用例误触真实 chrome） */
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
    expect(must(await estimateBrowserStorage(), 'estimateBrowserStorage()').ratio).toBe(0);
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

// 更新(2026-09-12 / TD-02-8)：`analyzeAgentConversationPressure`（恒 null 的已弃用 API）已删除，
// 对应「已弃用」describe 一并移除——保留"恒 null 仍是正确行为"的用例，等于给死抽象续命。
// 更新(2026-11-06 / B3)：estimateChromeStorage / mapKeyToDomain / analyzeStorageByKeys 已删除，
// 理由同 TD-02-8——生产调用方早已移除（StorageMonitor 换健康报表），留着只会被误认为画像仍在生效。

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
