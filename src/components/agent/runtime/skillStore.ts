/**
 * Skill 的 **legacy 兼容壳** —— 域内实现全在 `agent/skill`，本文件只做「符号转发 + 形状适配」。
 *
 * 【它现在还剩什么】
 *  · `findSkill`：按 id 查（内联到模块的 `listAllSkills().list`）；
 *  · `SKILLS_KEY` / `ENABLED_KEY`：订阅键转发；`isSkillEnabled`：转发模块的启用判据；
 *  · 使用计数 `markSkillUsed` / `getSkillUsage`：转发。
 *  · `getAllSkills` 已删（TD-11-66）：面板改用门面的 `listAllSkills()`（要 `ok/error` 才能如实提示读失败）。
 *
 * 【已经搬走的（不要再搬回来）】
 *  · 单文件导入白名单 `isSkillImportFile` / `skillNameFromFile` → `agent/skill/skillImport.ts`（TD-11-52）
 *  · 乱码修复 `repairMojibakeText` → `agent/skill/skillText.ts`（TD-11-52：域内实现不许住壳里）
 *  · 内置常量 → `agent/skill/skillBuiltins.ts`；**"全部可用 skill"的组合** → `agent/skill/skillRegistry.ts`
 *    （TD-11-51：组合是生产者职责，不许每个消费者各拼一遍）
 *  · 启用态判据「没记过 ⇒ 默认启用」→ `agent/skill/skillRepository.isSkillEnabledIn`（TD-11-50）
 *  · `setSkillEnabled`（单个）/ `getAllEnabledMap`：与门面的 `setSkillsEnabled` / `readSkillEnabledMap`
 *    是同一件事的两种写法 ⇒ 删（TD-11-44）
 *  · `readCustomSkills` / `getCustomSkills`：零生产消费者（组合与形状都已有更好的归属）⇒ 删
 *
 * 【纪律】域外**新代码直接 import 门面**（`@/components/agent/skill`）。本文件只为"不动既有消费方"存在，
 * 每搬走一段就在这里删一段；**不要在这里新增任何实现** —— 它连一行业务逻辑都不该有。
 */
import {
  ENABLED_KEY,
  SKILLS_KEY,
  getSkillUsage as readSkillUsage,
  isSkillEnabledIn,
  listAllSkills,
  markSkillUsed as countSkillUse,
  readSkillEnabledMap,
} from '../skill/index.ts';

/** legacy `Skill` 形状（AI 面板沿用；模块内部用 `AllSkill` / `UserSkill`） */
export interface Skill {
  id: string;
  name: string;
  description: string;
  content: string;
  createdAt?: number;
  updatedAt?: number;
  builtin?: boolean;
  /**
   * 所属分组 = 技能库一级目录（`agent/skill` 的 hydrate/迁移写入缓存）。
   * 仅用户 Skill 有；内置 Skill 无目录 ⇒ 走「官方」组。缺失（迁移前的旧条目）按「未分组」显示。
   */
  category?: string;
  /** 目录名（分组内的落点）；缺省表示这条还没落过盘 */
  slug?: string;
}

/**
 * 导出供消费方订阅（设置页改 Skill／开关启用态时，面板据此重读）：值 = contracts 真源，
 * 经 skill 门面转发（re-export 让既有消费方零改动）。
 */
export { SKILLS_KEY, ENABLED_KEY };

/**
 * 按 id 找 skill（legacy 形状）。
 *
 * 【组合与失败都由模块给】`listAllSkills()` 返回 `{ok, list, error}`（TD-11-66）。本处只要
 * "查到就返回、查不到就 `null`"：读失败时 `list` 只剩内置 ⇒ 用户技能查不到 ⇒ 调用方
 * （面板的 `skillNameOf`）退化成显示 id，**不会**假报一个错名字。
 *
 * 【`getAllSkills` 已删（TD-11-66）】它唯一的生产消费者是 AI 面板，而面板现在直接用门面的
 * `listAllSkills()` —— 因为它需要那个 `ok/error`（缓存读不到要**如实提示**，不许静默降级成
 * "只剩内置"）。形状适配层（`AllSkill` → `Skill`）随之没有存在的理由：面板要的字段模块形状都有。
 */
export function findSkill(id: string): Skill | null {
  return listAllSkills().list.find((s) => s.id === id) || null;
}

/* ── 写路径已全部迁走（2026-09-21 · ADR-0056 Q2）─────────────────────────────
 * 这里曾有 `upsertCustomSkill` / `deleteCustomSkill` / `saveCustomSkills`：它们**只写缓存、不碰磁盘**，
 * 于是"磁盘是内容唯一真相源"一旦成立，它们就成了**能绕过真相源的写入口**（谁接线谁制造
 * 「缓存里有、磁盘没有」的幽灵技能）。现已删除，写路径只剩 `agent/skill` 门面的：
 *   `saveSkillToDisk`（先落盘成功才回写缓存）· `deleteSkillEverywhere` · `importSkillText` / `importSkillPackages`
 * ⛔ 不要再在这里加回任何"只改缓存"的写函数 —— 那不是缺便利，而是缺一个不该存在的入口。
 * ─────────────────────────────────────────────────────────────────────────── */

/* ── Skill 使用次数（语义已归模块 `skillUsage.ts`；本处只转发，消费方零改动）── */
/** 记录一次 Skill 使用（+1），返回最新次数 */
export function markSkillUsed(id: string): number {
  return countSkillUse(id);
}
/** 读某 Skill 使用次数 */
export function getSkillUsage(id: string): number {
  return readSkillUsage(id);
}

/**
 * 判断某 skill 是否启用（默认启用）。
 * 【判据不在这里】它跟着 `agent_skill_enabled` 键走（`skillRepository.isSkillEnabledIn`）——
 * 见 TD-11-50：同一判据两份实现时，一处改"默认关"就会出现"列表显示已启用、注入时当没启用"。
 */
export function isSkillEnabled(id: string): boolean {
  return isSkillEnabledIn(readSkillEnabledMap(), id);
}
