/**
 * ── 唯一性/兄弟声明（2026-08-30）──
 * 运行模式声明表（WORK_MODE_DEFS 静态对象），与 settingRegistry.js（SETTING_DEFS）、contracts.ts
 * 各登记表同属「静态声明表」家族——兄弟。注意：registerRunModeSync / registerLegacyRunModeReader 是
 * 「状态同步回调注册」，非模式注册（模式本体是静态 WORK_MODE_DEFS）。新增此类先并入既有表，禁止另起新表。
 *
 * ════════════════════════════════════════════════════════════════
 * AI 助手运行模式注册表 —— 三态单一真源（docs/64 §4 + docs/65 M1/M3）
 * ════════════════════════════════════════════════════════════════
 *
 * 【三态轴】workMode ∈ { direct, step-confirm, auto }
 *   - direct        直接生图：不经 LLM，send 内部直连 execute_plan（auto_run）
 *   - step-confirm  分步确认：LLM 编排，调 show_plan_for_confirm 卡 awaiting 确认
 *   - auto          完全自主：LLM 编排，可调 show_plan_for_confirm 展示规划但不卡确认，直 execute_plan
 *
 * 正交性：Skill 轴 / 积分轴不进本模块分支判断；确认粒度永远由三态决定。
 * 兼容字段：inputMode(image/agent) 与 per-conversation runMode 均为 setWorkMode 原子同步的派生态，
 *           读一律以 workMode 为唯一真源（getWorkMode）。
 * 【迁移】旧值 image→direct（直接模式旧取值）、semi→step-confirm（半自动旧代号）在 normalizeWorkMode 收敛；
 *          首次启动（无 agent_work_mode 记录）由遗留 inputMode/runMode 推导初始值并回写。
 * ════════════════════════════════════════════════════════════════
 */
import { contentGet, contentSet } from '../../base/core/contentStore.ts'

export const WORK_MODE_STORAGE_KEY = 'agent_work_mode'
export const INPUT_MODE_STORAGE_KEY = 'agent_input_mode'

export const RUN_MODE_IDS = Object.freeze({
  DIRECT: 'direct',
  STEP_CONFIRM: 'step-confirm',
  AUTO: 'auto',
})

/** 合法 workMode（三态） */
export type WorkMode = typeof RUN_MODE_IDS[keyof typeof RUN_MODE_IDS]

/** 兼容字段 inputMode（image=直接模式 / agent=走 LLM 编排） */
export type InputMode = 'image' | 'agent'

export const DEFAULT_WORK_MODE = RUN_MODE_IDS.AUTO

/** 旧值 → 新值收敛（历史数据迁移：image=直接模式旧取值，semi=半自动旧代号） */
const LEGACY_WORK_MODE_MAP = Object.freeze({
  image: RUN_MODE_IDS.DIRECT,
  semi: RUN_MODE_IDS.STEP_CONFIRM,
}) as Record<string, WorkMode>

/** 三态定义表条目 */
export interface WorkModeDef {
  id: WorkMode
  label: string
  /** 注入 LLM 的分流指令片段；direct 不经 LLM 故为 null */
  systemPrompt: string | null
}

/** 三态定义：label（展示）+ systemPrompt 注入片段（direct 不经 LLM，systemPrompt 为 null） */
export const WORK_MODE_DEFS: Record<WorkMode, WorkModeDef> = Object.freeze({
  [RUN_MODE_IDS.DIRECT]: {
    id: RUN_MODE_IDS.DIRECT,
    label: '直接生图',
    systemPrompt: null,
  },
  [RUN_MODE_IDS.STEP_CONFIRM]: {
    id: RUN_MODE_IDS.STEP_CONFIRM,
    label: '分步确认',
    systemPrompt:
      '【生图确认粒度：分步确认】调用 show_plan_for_confirm 输出生图策划，等待用户确认后再调用 execute_plan 执行。',
  },
  [RUN_MODE_IDS.AUTO]: {
    id: RUN_MODE_IDS.AUTO,
    label: '完全自主',
    systemPrompt:
      '【生图确认粒度：完全自主】可用 show_plan_for_confirm 展示生图规划（仅供展示，不阻塞），然后直接调用 execute_plan 执行，无需用户确认。',
  },
})

/* ── 纯函数（可单测，无副作用）────────────────────────────── */

/** 归一化任意入参 → 合法 workMode（非法/未知 → 默认；旧值 image/semi 走迁移映射收敛） */
export function normalizeWorkMode(raw: unknown): WorkMode {
  const k = String(raw || '').toLowerCase()
  if (k === RUN_MODE_IDS.DIRECT) return RUN_MODE_IDS.DIRECT
  if (k === RUN_MODE_IDS.STEP_CONFIRM) return RUN_MODE_IDS.STEP_CONFIRM
  if (k === RUN_MODE_IDS.AUTO) return RUN_MODE_IDS.AUTO
  if (Object.prototype.hasOwnProperty.call(LEGACY_WORK_MODE_MAP, k)) return LEGACY_WORK_MODE_MAP[k]
  return DEFAULT_WORK_MODE
}

/** 归一（resolveWorkMode）——任意入参归一到合法 workMode */
export function resolveWorkMode(raw: unknown): WorkMode {
  return normalizeWorkMode(raw)
}

/** workMode → 注入 LLM 的分流指令片段（direct 返回 ''，不经 LLM） */
export function getSystemPromptForWorkMode(wm: unknown): string {
  return WORK_MODE_DEFS[normalizeWorkMode(wm)]?.systemPrompt || ''
}

/** workMode → 兼容字段 inputMode（image/agent），由 setWorkMode 原子同步用 */
export function resolveInputMode(wm: unknown): InputMode {
  return normalizeWorkMode(wm) === RUN_MODE_IDS.DIRECT ? 'image' : 'agent'
}

/** workMode → 兼容字段 runMode（step-confirm/auto；direct→auto），由 setWorkMode 原子同步用 */
export function resolveConvRunMode(wm: unknown): WorkMode {
  return normalizeWorkMode(wm) === RUN_MODE_IDS.STEP_CONFIRM
    ? RUN_MODE_IDS.STEP_CONFIRM
    : RUN_MODE_IDS.AUTO
}

/** workMode 是否走 LLM 编排（direct 为 false） */
export function isAgentWorkMode(wm: unknown): boolean {
  return normalizeWorkMode(wm) !== RUN_MODE_IDS.DIRECT
}

/* ── 读写层（M3）────────────────────────────────────────────
 * 依赖注入：per-conversation runMode 的「读当前会话」（首次迁移推导）与
 *          「写当前会话」（setWorkMode 原子同步）由 conversationAiState 注册，
 *          保持本模块与 conversation 层解耦、可独立单测。
 */

/** 注册「读当前会话 runMode」钩子，用于首次迁移派生初始 workMode */
let legacyRunModeReader: (() => unknown) | null = null
export function registerLegacyRunModeReader(fn: unknown): void {
  legacyRunModeReader = typeof fn === 'function' ? (fn as () => unknown) : null
}

/** 注册「写当前会话 runMode」钩子，setWorkMode 原子写三处时同步 per-conversation runMode */
let runModeSyncHook: ((mode: WorkMode) => void) | null = null
export function registerRunModeSync(fn: unknown): void {
  runModeSyncHook = typeof fn === 'function' ? (fn as (mode: WorkMode) => void) : null
}

function safeContentGet(key: string): unknown {
  try {
    const v = contentGet(key)
    if (v === undefined || v === null || v === '') return null
    return v
  } catch {
    return null
  }
}

function safeContentSet(key: string, value: unknown): void {
  try {
    contentSet(key, value)
  } catch {
    /* 持久化失败不阻断三态写入（非关键路径） */
  }
}

/** 由遗留 inputMode + 当前会话 runMode 推导初始 workMode（仅首次迁移用） */
function deriveFromLegacy(): WorkMode {
  const legacyInput = String(safeContentGet(INPUT_MODE_STORAGE_KEY) || 'agent').toLowerCase()
  if (legacyInput === 'image') return RUN_MODE_IDS.DIRECT
  // 读取对外钩子反射出的当前会话 runMode（未注册钩子时默认 auto）
  let convRunMode = 'auto'
  if (legacyRunModeReader) {
    try {
      const r = String(legacyRunModeReader() || 'auto').toLowerCase()
      if (r === RUN_MODE_IDS.STEP_CONFIRM || r === 'semi') convRunMode = RUN_MODE_IDS.STEP_CONFIRM
    } catch { /* 忽略，回退默认 */ }
  }
  return convRunMode === RUN_MODE_IDS.STEP_CONFIRM ? RUN_MODE_IDS.STEP_CONFIRM : RUN_MODE_IDS.AUTO
}

/** 读当前 workMode（唯一真源）；首次/缺省从遗留 inputMode/runMode 推导并回写迁移 */
export function getWorkMode(): WorkMode {
  const stored = safeContentGet(WORK_MODE_STORAGE_KEY)
  if (stored !== null) return normalizeWorkMode(stored)
  const derived = deriveFromLegacy()
  safeContentSet(WORK_MODE_STORAGE_KEY, derived) // 回写迁移，此后成为显式存储值
  return derived
}

/** 写 workMode：原子写三处（workMode + inputMode + 当前会话 runMode），返回归一后的 workMode */
export function setWorkMode(raw: unknown): WorkMode {
  const next = normalizeWorkMode(raw)
  safeContentSet(WORK_MODE_STORAGE_KEY, next)
  safeContentSet(INPUT_MODE_STORAGE_KEY, resolveInputMode(next))
  if (runModeSyncHook) {
    try {
      runModeSyncHook(resolveConvRunMode(next))
    } catch {
      /* 会话同步失败不阻断三态写入 */
    }
  }
  return next
}