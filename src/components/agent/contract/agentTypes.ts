/**
 * agent 域共享类型（中立模块）。
 *
 * 把跨子域复用的基础类型收敛到这里，避免子域之间为复用单个类型而互相反向依赖
 * （典型坑：conversationInvariants ↔ assistantTable/tableInvariants 成环）。
 * 各子域只从这里 import 类型，不互相 import 类型。
 */
/** 一条违规：level=error 硬约束必须修；level=warn 可疑（如跨表 id 复用、同名列） */
export interface Violation {
  level: 'error' | 'warn';
  /** 不变量编号，如 'I4' / 'S2' / 'W1'（对应 spec 清单） */
  code: string;
  message: string;
}
