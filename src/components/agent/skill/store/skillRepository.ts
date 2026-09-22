/**
 * Skill 的**存储唯一入口** —— `agent_skills` / `agent_skill_enabled` /
 * `agent_skill_config` 三个键**只允许本文件读写**（`ADR-0056` Q2：唯一可写处即真相源）。
 *
 * 【更新(2026-09-22 · 142 §3.10)】原第四个键 `agent_skill_usage` 连同 `skillUsage.ts` 一并删除：
 * `getSkillUsage` 全仓**零显示点**（不是"暂时没显示"，是没有任何消费者）⇒ 写进去就是死数据。
 * 删的是**读写通道**；历史残留值自然失效，不做迁移（ADR-0053：零消费的实现不许预留）。
 *
 * 【为什么必须收口】此前四个键的直读写散在 `agent/runtime/skillStore.ts`。P1 起磁盘 `SKILL.md` 成为
 * 内容真相源 ⇒「网页保存 → 落盘 → 回写缓存」与「磁盘 → 缓存（hydrate）」**都会写 `agent_skills`**；
 * 不收口就是两个写者，必然漂移（本仓对"同一语义两种实现"有实证：媒体判型曾 5 处各写一份，漂出三类不一致）。
 *
 * 【失败契约】写 = `{ ok, error? }`，判据来自 `confirmPersist` 的**落盘事实**（不吞、不谎报）；
 * 读 = 把「确实没数据（真空）」与「形状违约 / 读取抛错」**分开** ——
 * 损坏时必须让 UI 知道，否则用户一保存就把残缺列表覆盖写回（真删数据；本仓已有实证）。
 *
 * 【本文件不做什么】不做形状升级（legacy `Skill` → 模块的 `UserSkill`）与磁盘 hydrate —— 那是
 * `skillHydrate.ts` / `skillMigration.ts` 的职责。此处只保证"把键读对 / 写对"。
 */
import { contentGet, contentSet, contentReadThrough } from '@/components/base/core/contentStore';
import { confirmPersist } from '@/components/base/core/log/degrade';
import { logger } from '@/components/base/core/log/logger';
// 键名真源 = contracts.ts（TD-13-7：本模块不自持第二份字面量）
import {
  KEY_AGENT_SKILLS,
  KEY_AGENT_SKILL_ENABLED,
  KEY_AGENT_SKILL_CONFIG,
} from '@/components/base/core/contracts';
import type { SkillConfig } from '../skillTypes.ts';

/** 键名转发（消费方订阅用；值 = contracts 真源，避免各处再写一份字面量） */
export const SKILLS_KEY: string = KEY_AGENT_SKILLS;
export const ENABLED_KEY: string = KEY_AGENT_SKILL_ENABLED;
export const CONFIG_KEY: string = KEY_AGENT_SKILL_CONFIG;

/** 默认设置真源。`catalogToModel=false` = 「可用 Skill 清单」默认**不发**（只有手动选中才发，D8） */
export const DEFAULT_SKILL_CONFIG: SkillConfig = {
  catalogToModel: false,
  contentLimits: { singleSkillChars: 12000, expansionTotalChars: 24000, maxExplicitBindings: 4 },
};

function msgOf(e: unknown): string {
  return (e as { message?: string })?.message || String(e);
}

/* ────────────────────────── agent_skills（列表，含正文）────────────────────────── */

/** 读结果：`ok=false` = 数据损坏或读取失败，**区别于「确无数据」**（调用方必须区别对待） */
export interface SkillListReadResult {
  ok: boolean;
  list: unknown[];
  error: string;
}

/**
 * 读 Skill 列表（原始形状）。
 * 三形态处置（与 CLAUDE §5.1「失败不得伪装成空」同口径）：
 *  ① 真空（键不存在）⇒ 静默返回空列表（合法状态）；
 *  ② 形状违约（有值但非 array，多为写一半被打断 / 跨版本结构变更 / 人工改过存储）⇒ `logger.warn` + `ok:false`；
 *  ③ 读取抛错 ⇒ 原样上抛的 message 进 `error`（由拥有 UI 的那层决定呈现）。
 */
export function readSkillList(): SkillListReadResult {
  let raw: unknown;
  try {
    raw = contentGet(SKILLS_KEY);
  } catch (e) {
    return { ok: false, list: [], error: msgOf(e) };
  }
  if (Array.isArray(raw)) return { ok: true, list: raw, error: '' };
  if (raw === undefined || raw === null) return { ok: true, list: [], error: '' };
  const actual = typeof raw;
  logger.warn('skillRepository', 'Skill 列表形状违约（期望 array）', actual);
  return {
    ok: false,
    list: [],
    error: `自定义 Skill 数据损坏（期望 array，实际 ${actual}），未加载以免覆盖写入`,
  };
}

/**
 * 写 Skill 列表 + **落盘自确认**。
 *
 * 【为什么不能用 try/catch 判失败】落盘失败是**返回值**不是异常：`contentSet` 返回
 * `PersistWriteOutcome`，local 后端写失败只如实标 `ok:false`、**不抛**（历史上三处假兜底即此坑）。
 * 【为什么回读必须绕缓存】`contentSet` 会先写 cache，若用 `contentGet` 回读将**恒等于新值**
 * （实测：写失败时回读仍返回新值，清缓存后才读到旧值）⇒ 必须 `contentReadThrough` 直读底层。
 */
export function writeSkillList(list: unknown[]): { ok: boolean; error?: string } {
  const payload = Array.isArray(list) ? list : [];
  // 【TD-24-4 阶段1】自确认：自定义 Skill 是用户资产，写不进去必须让用户知道
  if (
    !confirmPersist(contentSet(SKILLS_KEY, payload), {
      layer: 'skillRepository',
      key: SKILLS_KEY,
      toast: '自定义 Skill 未能保存（本地存储不可用）',
    })
  ) {
    return { ok: false, error: '未落盘（本地存储写入失败）' };
  }
  const raw = contentReadThrough(SKILLS_KEY);
  if (raw === null) {
    // 空列表且未存过时属于正常（无数据可存）
    if (payload.length === 0) return { ok: true };
    return { ok: false, error: '写入后未能读回数据，可能未真正保存（检查存储空间/权限）' };
  }
  // 比对【内容】而非仅长度：删除/新增都可能产生长度相同的不同列表，只比长度会把「写入未生效」误判为成功
  const expected = JSON.stringify(payload);
  if (raw === expected) return { ok: true };
  let persisted: unknown;
  try {
    persisted = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: `写入后回读数据损坏：${msgOf(e)}` };
  }
  if (!Array.isArray(persisted)) {
    return { ok: false, error: `写入未生效（回读非数组，实际 ${typeof persisted}）` };
  }
  if (JSON.stringify(persisted) === expected) return { ok: true };
  return {
    ok: false,
    error: `写入未生效：期望 ${payload.length} 项，落盘回读为 ${persisted.length} 项（数据可能未保存，请检查存储空间/权限）`,
  };
}

/* ────────────────────── 键值小对象：enabled / config ────────────────────── */

/** 读「键 → 值」小对象（三形态处置同 `readSkillList`） */
function readMap<T>(key: string, layer: string): Record<string, T> {
  let raw: unknown;
  try {
    raw = contentGet(key);
  } catch (e) {
    logger.warn(layer, `读取失败（${key}）`, msgOf(e));
    return {};
  }
  if (raw === undefined || raw === null) return {}; // 真空：合法，静默
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    // 形状违约：留痕 + 如实返回空（不改写、不猜）
    logger.warn(layer, `形状违约（期望 object）：${key}`, typeof raw);
    return {};
  }
  return raw as Record<string, T>;
}

/** 读启用态 map（返回**新对象**，断引用共享：共享引用会让 React 判"无变化"不重渲） */
export function readEnabledMap(): Record<string, boolean> {
  return { ...readMap<boolean>(ENABLED_KEY, 'skillRepository') };
}

/**
 * 「某个 Skill 是否启用」的**唯一判据**：索引里没记过 ⇒ **默认启用**。
 *
 * 【为什么住本文件（TD-11-50）】启用态是 `agent_skill_enabled` 这个键的**语义**，而键的唯一读写口在这里
 * ⇒ 判据跟着键走（"语义跟键走"是本模块的门面纪律）。此前 legacy 壳里一份、视图层又抄一份：
 * 两处独立演化 ⇒ 一处改成"默认关"另一处不改，就会出现「列表显示已启用、注入时当没启用」这类跨面不一致。
 * @param enabledMap 已读出的启用态 map（**复用同一次读取**：组件里别按 id 逐个 `readEnabledMap()`）
 */
export function isSkillEnabledIn(enabledMap: Record<string, boolean>, id: string): boolean {
  return id in (enabledMap || {}) ? !!enabledMap[id] : true;
}

/** 写启用态 map（偏好类：失败留痕，不阻断） */
export function writeEnabledMap(map: Record<string, boolean>): void {
  confirmPersist(contentSet(ENABLED_KEY, map), { layer: 'skillRepository', key: ENABLED_KEY });
}

/**
 * 批量设置启用态（**组级开关**的唯一实现）。
 * 【为什么批量而不是循环调单键】单键写 N 次 = N 次 `contentSet` + N 次订阅通知 ⇒ 列表重渲 N 次
 * （组里有 20 个 skill 就是 20 次）。这里**读一次、写一次**，通知也只有一次。
 * 【组自身不存状态】组头显示态（全开/全关/部分）由成员派生 —— 不新增"组的状态"，也就没有
 * "组说开着、成员全关"这种需要立优先级规则的形态（见 docs/plan/140 §1.6）。
 */
export function writeEnabledMany(ids: string[], enabled: boolean): void {
  const m = readEnabledMap(); // readEnabledMap 已返回新对象，可安全就地改
  for (const id of ids) if (id) m[id] = !!enabled;
  writeEnabledMap(m);
}

/** 读 Skill 设置（缺省 / 非法值一律回落默认值 —— 设置项是偏好，坏值不该让功能瘫掉） */
export function readSkillConfig(): SkillConfig {
  const raw = readMap<unknown>(CONFIG_KEY, 'skillRepository');
  const limits = (raw['contentLimits'] ?? {}) as Partial<SkillConfig['contentLimits']>;
  const num = (v: unknown, d: number) =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : d;
  return {
    catalogToModel: raw['catalogToModel'] === true,
    contentLimits: {
      singleSkillChars: num(
        limits.singleSkillChars,
        DEFAULT_SKILL_CONFIG.contentLimits.singleSkillChars,
      ),
      expansionTotalChars: num(
        limits.expansionTotalChars,
        DEFAULT_SKILL_CONFIG.contentLimits.expansionTotalChars,
      ),
      maxExplicitBindings: num(
        limits.maxExplicitBindings,
        DEFAULT_SKILL_CONFIG.contentLimits.maxExplicitBindings,
      ),
    },
  };
}

/**
 * 合并写 Skill 设置（先读现值再合并，避免局部更新把别的字段抹掉）；返回合并后的值。
 * 【为什么 patch 用 `Partial<contentLimits>` 而不是 `Partial<SkillConfig>`】后者在类型上要求
 * contentLimits 的**三个字段齐全** ⇒ 调用方只想改一个预算时被迫把另外两个也读出来传一遍
 * （多一处可能漂移的复制）。合并语义本来就是这个形状，类型应与实现一致。
 */
export function writeSkillConfig(patch: {
  catalogToModel?: boolean;
  contentLimits?: Partial<SkillConfig['contentLimits']>;
}): SkillConfig {
  const cur = readSkillConfig();
  const next: SkillConfig = {
    catalogToModel: patch.catalogToModel ?? cur.catalogToModel,
    contentLimits: { ...cur.contentLimits, ...(patch.contentLimits ?? {}) },
  };
  confirmPersist(contentSet(CONFIG_KEY, next), { layer: 'skillRepository', key: CONFIG_KEY });
  return next;
}
