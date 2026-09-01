import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * AI 助手运行模式注册表（runModeRegistry）单元测试 —— docs/64 §4 + docs/65 M1/M3。
 *
 * 覆盖：
 *   1. normalizeWorkMode 归一化与旧值迁移收敛（image→direct、semi→step-confirm）
 *   2. 派生映射 resolveInputMode / resolveConvRunMode / isAgentWorkMode / getSystemPromptForWorkMode
 *   3. getWorkMode / setWorkMode 读写 + setWorkMode 原子写三处（workMode + inputMode + 会话 runMode 钩子）
 *   4. 首次迁移：遗留 inputMode/runMode 推导初始 workMode 并回写
 */

// 可控 contentStore：内存 Map 模拟 localStorage 键值
const __store = new Map()
vi.mock('../../src/components/base/contentStore.ts', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    contentGet: vi.fn((k) => (__store.has(k) ? __store.get(k) : undefined)),
    contentSet: vi.fn((k, v) => { __store.set(k, v) }),
  }
})

import {
  RUN_MODE_IDS, DEFAULT_WORK_MODE, WORK_MODE_STORAGE_KEY, INPUT_MODE_STORAGE_KEY,
  normalizeWorkMode, resolveWorkMode, getSystemPromptForWorkMode, resolveInputMode,
  resolveConvRunMode, isAgentWorkMode,
  getWorkMode, setWorkMode, registerLegacyRunModeReader, registerRunModeSync,
} from '../../src/components/agent/runtime/runModeRegistry.ts'

beforeEach(() => {
  __store.clear()
  registerLegacyRunModeReader(null)
  registerRunModeSync(null)
})

describe('常量', () => {
  it('RUN_MODE_IDS 三态 + 默认 auto', () => {
    expect(RUN_MODE_IDS.DIRECT).toBe('direct')
    expect(RUN_MODE_IDS.STEP_CONFIRM).toBe('step-confirm')
    expect(RUN_MODE_IDS.AUTO).toBe('auto')
    expect(DEFAULT_WORK_MODE).toBe('auto')
  })
})

describe('normalizeWorkMode（含旧值迁移收敛）', () => {
  it('三态原值不变', () => {
    expect(normalizeWorkMode('direct')).toBe('direct')
    expect(normalizeWorkMode('step-confirm')).toBe('step-confirm')
    expect(normalizeWorkMode('auto')).toBe('auto')
  })
  it('旧值 image→direct、semi→step-confirm（L1/R4）', () => {
    expect(normalizeWorkMode('image')).toBe('direct')
    expect(normalizeWorkMode('semi')).toBe('step-confirm')
  })
  it('大小写不敏感', () => {
    expect(normalizeWorkMode('STEP-CONFIRM')).toBe('step-confirm')
    expect(resolveWorkMode('IMAGE')).toBe('direct')
  })
  it('非法/未知 → 默认 auto，绝不回流旧值', () => {
    expect(normalizeWorkMode(undefined)).toBe('auto')
    expect(normalizeWorkMode(null)).toBe('auto')
    expect(normalizeWorkMode('')).toBe('auto')
    expect(normalizeWorkMode('bogus')).toBe('auto')
    expect(normalizeWorkMode(123)).toBe('auto')
  })
})

describe('派生映射', () => {
  it('resolveInputMode：direct→image，其余→agent', () => {
    expect(resolveInputMode('direct')).toBe('image')
    expect(resolveInputMode('step-confirm')).toBe('agent')
    expect(resolveInputMode('auto')).toBe('agent')
  })
  it('resolveConvRunMode：direct→auto（不经 LLM 归 auto）', () => {
    expect(resolveConvRunMode('step-confirm')).toBe('step-confirm')
    expect(resolveConvRunMode('auto')).toBe('auto')
    expect(resolveConvRunMode('direct')).toBe('auto')
  })
  it('isAgentWorkMode：仅 direct 返回 false', () => {
    expect(isAgentWorkMode('direct')).toBe(false)
    expect(isAgentWorkMode('step-confirm')).toBe(true)
    expect(isAgentWorkMode('auto')).toBe(true)
  })
  it('getSystemPromptForWorkMode：direct 为空；step-confirm 强调等待确认；auto 强调可调 plan + 不阻塞（R2）', () => {
    expect(getSystemPromptForWorkMode('direct')).toBe('')
    expect(getSystemPromptForWorkMode('step-confirm')).toContain('show_plan_for_confirm')
    expect(getSystemPromptForWorkMode('step-confirm')).toContain('等待用户确认')
    const autoPrompt = getSystemPromptForWorkMode('auto')
    expect(autoPrompt).toContain('show_plan_for_confirm') // 可调 plan
    expect(autoPrompt).toContain('不阻塞') // 不卡确认
    expect(autoPrompt).not.toContain('等待用户确认')
  })
})

describe('getWorkMode / setWorkMode（M3 读写与原子同步）', () => {
  it('setWorkMode 归一写三处：workMode + inputMode + 会话 runMode 钩子', () => {
    const sync = vi.fn()
    registerRunModeSync(sync)
    expect(setWorkMode('image')).toBe('direct') // 旧值归一返回合法值
    expect(__store.get(WORK_MODE_STORAGE_KEY)).toBe('direct')
    expect(__store.get(INPUT_MODE_STORAGE_KEY)).toBe('image')
    expect(sync).toHaveBeenCalledWith('auto') // direct→runMode auto
  })
  it('setWorkMode(step-confirm)：inputMode=agent + runMode=step-confirm', () => {
    const sync = vi.fn()
    registerRunModeSync(sync)
    setWorkMode('step-confirm')
    expect(__store.get(WORK_MODE_STORAGE_KEY)).toBe('step-confirm')
    expect(__store.get(INPUT_MODE_STORAGE_KEY)).toBe('agent')
    expect(sync).toHaveBeenCalledWith('step-confirm')
  })
  it('getWorkMode 以存储为唯一真源（读 register 后返回存储值而非推导）', () => {
    setWorkMode('step-confirm')
    registerLegacyRunModeReader(() => 'auto') // 即使遗留读回 auto，存储值仍是 step-confirm
    expect(getWorkMode()).toBe('step-confirm')
  })
  it('首次迁移：遗留 inputMode=image → direct 并回写', () => {
    __store.set(INPUT_MODE_STORAGE_KEY, 'image')
    expect(getWorkMode()).toBe('direct')
    expect(__store.get(WORK_MODE_STORAGE_KEY)).toBe('direct')
  })
  it('首次迁移：读钩子 runMode=step-confirm → step-confirm 并回写', () => {
    registerLegacyRunModeReader(() => 'step-confirm')
    expect(getWorkMode()).toBe('step-confirm')
    expect(__store.get(WORK_MODE_STORAGE_KEY)).toBe('step-confirm')
  })
  it('首次迁移：无一遗留 → 默认 auto 并回写', () => {
    expect(getWorkMode()).toBe('auto')
    expect(__store.get(WORK_MODE_STORAGE_KEY)).toBe('auto')
  })
  it('setWorkMode 后再 getWorkMode 一致', () => {
    setWorkMode('auto')
    expect(getWorkMode()).toBe('auto')
    setWorkMode('step-confirm')
    expect(getWorkMode()).toBe('step-confirm')
    setWorkMode('direct')
    expect(getWorkMode()).toBe('direct')
  })
})