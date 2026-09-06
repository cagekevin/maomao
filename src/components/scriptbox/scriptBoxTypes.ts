/**
 * 剧本盒子 · 共享纯类型（只含类型，无运行时导出）。
 *
 * 【为什么存在】scriptBoxPromptResolver / scriptBoxWorkflows / scriptBoxPlaybookIO 之间
 * 仅靠这几个类型互相引用，若不抽离会形成「纯类型环」——虽然 ESM 编译后 import type 被擦除、
 * 无运行时 TDZ 风险，但架构上仍是环（depcruise no-circular 会拦，违反 CLAUDE.md §5.4.2）。
 * 抽出后三者都单向依赖本文件，环解除。更新(2026-08-31)：解 download/REPORT 2 处 P0 循环。
 */

/** 生图模板条目 { label, sys } */
export interface ImageGenTemplate {
  label: string;
  sys: string;
}

/** 正向约束 { image, video }（§4.3 已砍 custom 位） */
export interface ScriptBoxConstraints {
  image: string;
  video: string;
}

/** 负面词 { common, image, video }（§4.4 新增 common 位） */
export interface ScriptBoxNegatives {
  common: string;
  image: string;
  video: string;
}
