import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * AI 助手运行模式注册表（runModeRegistry）单元测试。
 *
 * 【2026-09-05 精简】执行模型收敛为恒 auto（direct/step-confirm 三态已删）。本组断言改为「恒 auto 归一」：
 *   - normalizeWorkMode / resolveWorkMode 任意入参恒 'auto'
 *   - getSystemPromptForWorkMode 恒返回 auto 定义指令
 *   - resolveConvRunMode 恒 'auto'；resolveInputMode / isAgentWorkMode 已随 direct 删除
 *   - getWorkMode / setWorkMode 读写恒 auto + 原子同步会话 runMode 归 auto
 *   - registerLegacyRunModeReader 保留但不再参与推导（读恒 auto）
 */

// 可控 contentStore：内存 Map 模拟 localStorage 键值
const __store = new Map();
vi.mock('../../src/components/base/core/contentStore.ts', async (importOriginal) => {
  const actual =
    (await importOriginal()) as unknown as typeof import('../../src/components/base/core/contentStore.ts');
  return {
    ...actual,
    contentGet: vi.fn((k) => (__store.has(k) ? __store.get(k) : undefined)),
    contentSet: vi.fn((k, v) => {
      __store.set(k, v);
    }),
  };
});

import {
  RUN_MODE_IDS,
  DEFAULT_WORK_MODE,
  WORK_MODE_STORAGE_KEY,
  INPUT_MODE_STORAGE_KEY,
  normalizeWorkMode,
  resolveWorkMode,
  getSystemPromptForWorkMode,
  resolveConvRunMode,
  getWorkMode,
  setWorkMode,
  registerLegacyRunModeReader,
  registerRunModeSync,
} from '../../src/components/agent/runtime/runModeRegistry.ts';

beforeEach(() => {
  __store.clear();
  registerLegacyRunModeReader(null);
  registerRunModeSync(null);
});

describe('常量', () => {
  it('RUN_MODE_IDS 仅 auto 且默认 auto', () => {
    expect(RUN_MODE_IDS.AUTO).toBe('auto');
    expect(Object.keys(RUN_MODE_IDS)).toEqual(['AUTO']); // 三态已删，只剩 auto
    expect(DEFAULT_WORK_MODE).toBe('auto');
  });
});

describe('normalizeWorkMode（收敛恒 auto）', () => {
  it('任意入参（含历史 direct/step-confirm/semi、大小写、非法/空）恒归 auto', () => {
    expect(normalizeWorkMode('auto')).toBe('auto');
    expect(normalizeWorkMode('direct')).toBe('auto'); // 已删模式旧值归一 auto
    expect(normalizeWorkMode('step-confirm')).toBe('auto');
    expect(normalizeWorkMode('semi')).toBe('auto');
    expect(resolveWorkMode('IMAGE')).toBe('auto');
    expect(normalizeWorkMode(undefined)).toBe('auto');
    expect(normalizeWorkMode(null)).toBe('auto');
    expect(normalizeWorkMode('')).toBe('auto');
    expect(normalizeWorkMode('bogus')).toBe('auto');
    expect(normalizeWorkMode(123)).toBe('auto');
  });
});

describe('派生映射（恒 auto）', () => {
  it('resolveConvRunMode 恒 auto', () => {
    expect(resolveConvRunMode('step-confirm')).toBe('auto');
    expect(resolveConvRunMode('auto')).toBe('auto');
  });
  it('getSystemPromptForWorkMode：任意入参恒返回 auto 定义（完全自主、无等待确认）', () => {
    const p = getSystemPromptForWorkMode('step-confirm');
    expect(p).toContain('完全自主');
    expect(p).not.toContain('等待用户确认');
    expect(getSystemPromptForWorkMode('auto')).toBe(p);
  });
});

describe('getWorkMode / setWorkMode（收敛恒 auto + 原子同步）', () => {
  it('setWorkMode 忽略入参恒写 auto，会话 runMode 钩子收 auto，不再写 input_mode', () => {
    const sync = vi.fn();
    registerRunModeSync(sync);
    expect(setWorkMode('image')).toBe('auto');
    setWorkMode('step-confirm');
    expect(__store.get(WORK_MODE_STORAGE_KEY)).toBe('auto');
    expect(sync).toHaveBeenLastCalledWith('auto');
    expect(__store.has(INPUT_MODE_STORAGE_KEY)).toBe(false); // inputMode 兼容字段随 direct 退役
  });
  it('getWorkMode 恒 auto；历史存储非 auto 时幂等回写 auto', () => {
    __store.set(WORK_MODE_STORAGE_KEY, 'step-confirm');
    expect(getWorkMode()).toBe('auto');
    expect(__store.get(WORK_MODE_STORAGE_KEY)).toBe('auto');
  });
  it('首次迁移：遗留 runMode=step-confirm 读仍恒 auto', () => {
    registerLegacyRunModeReader(() => 'step-confirm');
    expect(getWorkMode()).toBe('auto');
  });
});
