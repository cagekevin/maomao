/**
 * Skill 能力片 · **门面**（域外只准 `import { … } from '@/components/agent/skill'`，
 * 禁引模块内其他文件 —— 否则等于绕过用例编排，见 `README.md` §4）。
 *
 * 【导出面按用例定义】（ADR-0044 §8）当前承载七类用例 ——
 * ⚠️ **用例编号的唯一真源就是下面这份清单**（`README.md §2` 与 `docs/plan/140 §2.2` 只写指针、
 * 不各抄一份编号：抄了就是第二份真相，改一处必漂移 —— TD-11-73）：
 *   ① **渲染技能库与选用入口**（列表：**行 = 磁盘包 ∪ 索引状态** + 工具条 + 右栏编辑；下拉：选得动的那些）→
 *      `buildSkillLibraryView`（唯一判定中枢）· `buildSkillPickerGroups`（同一套组语义的另一入口）·
 *      `readSkillLibrary`（读盘）· `SkillRow` / `SkillLibrary` 等类型
 *   ② **管理 skill 与分组**（列表 / 存 / 删 / 恢复 / 丢弃 / 导入导出 / 换组 / 从磁盘重载 / 补齐 id）→
 *      `saveSkillToDisk` / `deleteSkillEverywhere` / `restoreSkillFromIndex` / `discardSkillFromIndex` /
 *      `importSkillText` / `importSkillPackages` / `isImportablePackageFile` / `skillMarkdownForExport` /
 *      `createSkillGroup` / `reloadSkillsFromDisk` / `backfillMissingIds` / `openSkillFolder`
 *   ③ **取本轮要发给模型的 Skill 文本**（块① 可用清单 · 块② 发送起点**冻结**）→
 *      `getSkillIndexText` / `freezeSkillTurn`
 *   ④ **Skill 设置与启用态**（清单开关 / 预算 / 组级批量开关）→
 *      `getSkillConfig` / `setSkillConfig` / `setSkillsEnabled`
 *   ⑤ **侦测磁盘被外部改动**（焦点变化时只读比对，提示用户"点此重载"）→ `detectSkillDrift`
 *   ⑥ **模型按需读附属资料**（渐进披露第三层；只读本轮启用、且正文显式引用的文本文件）→
 *      `setSkillTurnBindings`（发送起点写/结束清）· `readSkillResource(path, skill?)`
 *   ⑦ **云同步拉取后把正文写回磁盘**（D6：不让磁盘永久遮蔽云端更新）→ `applyCloudSkillsToDisk`
 *
 * ⑥⑦ 的实现已落地（导出就在本文件 :42/:43）⇒ 它们**是本清单的一部分**，不再有"等那一期再加入"的说法。
 * **未实现的用例仍然不许预置空壳**（ADR-0053）—— 那是"不预留"，不是"实现了也不写进清单"。
 * 另有两个**机制性**导出不属任何用例（如实留痕，不硬凑归类）：`migrateSkillsToDiskIfNeeded`
 * （技能设置页调的一次性迁移：旧 localStorage → 磁盘）· `repairMojibakeText`（导入侧的文本修复原语）。
 */
export {
  saveSkillToDisk,
  deleteSkillEverywhere,
  discardSkillFromIndex,
  restoreSkillFromIndex,
  skillMarkdownForExport,
} from './write/skillPersist.ts';
export {
  SKILL_IMPORT_ACCEPT,
  SKILL_MAX_FILE_BYTES,
  importSkillPackages,
  importSkillText,
  isImportablePackageFile,
  isSkillImportFile,
  skillNameFromFile,
} from './write/skillImport.ts';
export { repairMojibakeText } from './rules/skillText.ts';
export { listAllSkills } from './model/skillRegistry.ts';
export { readSkillResource, setSkillTurnBindings } from './model/skillResource.ts';
export { applyCloudSkillsToDisk } from './write/skillCloudSync.ts';
export { getSkillIndexText, freezeSkillTurn } from './model/skillInject.ts';
export { getBuiltinSkills } from './model/skillBuiltins.ts';
export { SKILL_LIMIT_SUGGESTED_MAX } from './model/skillBudget.ts';
export { UNTRUSTED_SKILL_TEXT_RULE } from './model/skillInjectText.ts';
export {
  createSkillGroup,
  openSkillFolder,
  readDiskSkillPackages,
  readSkillLibrary,
} from './store/skillApi.ts';
export {
  backfillMissingIds,
  detectSkillDrift,
  reloadSkillsFromDisk,
} from './store/skillHydrate.ts';
// 【两个组哨兵**不导出**（TD-11-62）】消费者读 `SkillGroupView.kind` / `SkillPickGroup.kind`（语义），
// 不是哨兵字符串；从前导出过 ⇒ 设置页直接比 `g.name === OFFICIAL_GROUP` 做渲染判定 ⇒ 改哨兵值即静默失效。
export { buildSkillLibraryView } from './view/skillLibraryView.ts';
export { buildSkillPickerGroups } from './view/skillPickerView.ts';
// 只导出**真被域外命名**的类型（`SkillGroupKind`/`SkillPick*` 由调用方靠推导使用 ⇒ 导出即幽灵，ADR-0053）
export type { SkillGroupView, SkillRow } from './view/skillLibraryView.ts';
export type { SkillLibrary } from './skillTypes.ts';
export { migrateSkillsToDiskIfNeeded } from './store/skillMigration.ts';
export {
  CONFIG_KEY as SKILL_CONFIG_KEY,
  readSkillConfig as getSkillConfig,
  writeSkillConfig as setSkillConfig,
  writeEnabledMany as setSkillsEnabled,
  // 读侧（「列表」与「启用态」两个用例）：域外要读缓存与启用态 —— 从前它们只能深引 repository
  isSkillEnabledIn,
  readSkillList as readUserSkills,
  readEnabledMap as readSkillEnabledMap,
  // 键常量（订阅用）：与读取入口配套，避免消费方再写一份字面量（TD-13-7）
  SKILLS_KEY,
  ENABLED_KEY,
} from './store/skillRepository.ts';
export type { SkillConfig } from './skillTypes.ts';
