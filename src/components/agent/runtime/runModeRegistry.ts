/**
 * ════════════════════════════════════════════════════════════════
 * AI 助手运行模式注册表 —— 收敛为恒 auto（2026-09-05 精简）
 * ════════════════════════════════════════════════════════════════
 *
 * 【2026-09-05 决策 · 执行模型精简】AI 助手只保留 auto（完全自主）+ credit 积分闸一种模式：
 *  - 删除三态中的 direct（直接生图，bypass LLM 直连 execute_plan）与 step-confirm（分步确认弹卡）
 *    两条运行模式；三态选择器 UI、Skill 三阶段批量、AI 自规划多 generation 批量等高层编排移除（由将来表格承接）。
 *  - 本模块仅剩「恒 auto」的归一封装：getWorkMode/setWorkMode 恒返回/写入 'auto'。
 *  - registerRunModeSync 仍把当前会话 runMode 兼容字段归一为 auto（保留历史数据归 auto 的幂等收发）。
 *  - 确认粒度：需确认的只有 credit 积分闸（execute_plan 内 getCreditSwitch 决定），与本注册表正交。
 *  - STORAGE_KEYS 登记的 agent_work_mode / agent_input_mode 保留（getWorkMode 幂等回写 auto；inputMode
 *    兼容字段随 direct 移除后不再产出 image 值）。
 * ════════════════════════════════════════════════════════════════
 */
import { contentGet, contentSet } from '../../base/core/contentStore.ts';

export const WORK_MODE_STORAGE_KEY = 'agent_work_mode';
export const INPUT_MODE_STORAGE_KEY = 'agent_input_mode';

export const RUN_MODE_IDS = Object.freeze({
  AUTO: 'auto',
});

/** 合法 workMode：恒 'auto'（2026-09-05 去三态，仅剩完全自主） */
export type WorkMode = (typeof RUN_MODE_IDS)[keyof typeof RUN_MODE_IDS];

export const DEFAULT_WORK_MODE = RUN_MODE_IDS.AUTO;

/** 模式定义表条目 */
export interface WorkModeDef {
  id: WorkMode;
  label: string;
  /** 注入 LLM 的执行指令片段（恒为 auto 定义） */
  systemPrompt: string;
}

/** 唯一模式定义：auto（完全自主）。direct/step-confirm 已随执行模型精简删除 */
export const WORK_MODE_DEFS: Record<WorkMode, WorkModeDef> = Object.freeze({
  [RUN_MODE_IDS.AUTO]: {
    id: RUN_MODE_IDS.AUTO,
    label: '完全自主',
    systemPrompt:
      '【生图执行粒度：完全自主】你完全自主地建节点/生成/操作画布，直接执行，无需用户确认。需要烧积分时有积分确认闸在必要处拦一下。',
  },
});

/* ── 纯函数（可单测，无副作用）────────────────────────────── */

/** 归一化任意入参 → 恒 'auto'（去三态后无其它合法值） */
export function normalizeWorkMode(_raw: unknown): WorkMode {
  return RUN_MODE_IDS.AUTO;
}

export function resolveWorkMode(_raw: unknown): WorkMode {
  return RUN_MODE_IDS.AUTO;
}

/** workMode → 注入 LLM 的执行指令片段（恒为 auto 定义） */
export function getSystemPromptForWorkMode(_wm: unknown): string {
  return WORK_MODE_DEFS[RUN_MODE_IDS.AUTO].systemPrompt;
}

/** workMode → 兼容字段 runMode：恒 'auto'（setWorkMode 原子同步用，direct/step-confirm 已删） */
export function resolveConvRunMode(_wm: unknown): WorkMode {
  return RUN_MODE_IDS.AUTO;
}

/* ── 读写层────────────────────────────────────────────────
 * getWorkMode/setWorkMode 恒 auto：写幂等回写 storage（旧值归一 auto），
 * 兼容字段（inputMode/runMode）随 direct/step-confirm 移除后不再产出非 auto 值。
 * registerLegacyRunModeReader 保留为兼容注册点（conversationAiState 依赖），实际不再被读取。
 */

/** 注册「读当前会话 runMode」钩子（兼容保留；去三态后 getWorkMode 恒 auto，不再读取） */
// `_` 前缀 = 官方认可的「有意不用」标记：字段仅为兼容注册点存在，无读取方
let _legacyRunModeReader: (() => unknown) | null = null;
export function registerLegacyRunModeReader(fn: unknown): void {
  _legacyRunModeReader = typeof fn === 'function' ? (fn as () => unknown) : null;
}

/** 注册「写当前会话 runMode」钩子，setWorkMode 原子写时同步 per-conversation runMode（恒 auto） */
let runModeSyncHook: ((mode: WorkMode) => void) | null = null;
export function registerRunModeSync(fn: unknown): void {
  runModeSyncHook = typeof fn === 'function' ? (fn as (mode: WorkMode) => void) : null;
}

function safeContentGet(key: string): unknown {
  try {
    const v = contentGet(key);
    if (v === undefined || v === null || v === '') return null;
    return v;
  } catch {
    return null;
  }
}

function safeContentSet(key: string, value: unknown): void {
  try {
    contentSet(key, value);
  } catch {
    /* 持久化失败不阻断写入（非关键路径） */
  }
}

/** 读当前 workMode：恒 'auto'；历史旧值（direct/step-confirm 三态遗产）幂等回写为 auto */
export function getWorkMode(): WorkMode {
  const stored = safeContentGet(WORK_MODE_STORAGE_KEY);
  if (stored !== null && String(stored) !== RUN_MODE_IDS.AUTO) {
    safeContentSet(WORK_MODE_STORAGE_KEY, RUN_MODE_IDS.AUTO);
  }
  return RUN_MODE_IDS.AUTO;
}

/** 写 workMode：恒 auto（忽略入参）；同步当前会话 runMode 归 auto，返回归一后的 workMode */
export function setWorkMode(raw: unknown): WorkMode {
  void raw; // 恒 auto，忽略入参（兼容旧三态调用方）
  safeContentSet(WORK_MODE_STORAGE_KEY, RUN_MODE_IDS.AUTO);
  if (runModeSyncHook) {
    try {
      runModeSyncHook(resolveConvRunMode(RUN_MODE_IDS.AUTO));
    } catch {
      /* 会话同步失败不阻断写入 */
    }
  }
  return RUN_MODE_IDS.AUTO;
}
