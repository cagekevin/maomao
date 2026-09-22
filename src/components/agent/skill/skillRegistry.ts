/**
 * **「当前全部可用 Skill」的唯一组合点** —— 缓存里的用户 skill ∪ 内置常量（缓存优先）。
 *
 * 【为什么必须收成一处（TD-11-51）】此前有两个组合点：legacy 壳的 `getAllSkills()`（给 UI 列表）
 * 与 `freezeSkillTurn` 内部（给可注入集合）。两条独立代码路径 ⇒ 将来任一侧加来源
 * （比如"项目级 skill"）而另一侧漏改，就会出现「**UI 看得见、模型收不到**」（或反之），
 * 且没有任何闸能发现 —— 因为两边都是"对的"。
 * 【为什么组合属生产者】门面只给两个半边（`getBuiltinSkills` / `readUserSkills`）时，
 * "合起来"这一步就被推给每个消费者，那正是漂移的入口。
 * 【优先级】缓存优先：同一 id 在缓存与内置常量里都有时，以**缓存**为准
 * （用户落过盘的版本比代码常量新；这也是冻结时判 `origin` 的依据）。
 * 【失败必须一起给出去（TD-11-66）】组合层此前只返回数组 ⇒ 缓存读失败时**静默降级成"只剩内置"**：
 * 面板照旧渲染一份"没有我的技能"的列表、用户以为技能全丢了（实际是读不到）。故返回值是
 * `{ ok, list, error }` —— "读不到"与"本来就没有"必须分得开（黑话：不得用空清单否定真值）。
 */
import { getBuiltinSkills } from './skillBuiltins.ts';
import { readSkillList } from './skillRepository.ts';

/** 「当前全部可用 Skill」的最小形状（正文与落点都在这里，UI 与注入共用） */
export interface AllSkill {
  id: string;
  name: string;
  description: string;
  content: string;
  /** 内置（代码常量）⇒ **没有磁盘包**：`category`/`slug` 天然为空，不是"漏传" */
  builtin: boolean;
  category?: string;
  slug?: string;
  version?: string;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * 列出当前全部可用 Skill（缓存 ∪ 内置，缓存优先）。
 *
 * 【形状不全的条目怎么办】缺 `id` 的一律跳过（没有身份就无法启用/冻结/对账）；
 * 其余字段缺失按空串处理 —— 由调用方（视图层/冻结层）决定怎么呈现"没有正文/没有描述"。
 * 【`ok:false` 时 `list` 里是什么】仍然返回内置那批（调用方**可以**照常渲染），但 `ok/error` 一并给出，
 * 让调用方**能**如实说明"缓存读不到"—— 这就是 TD-11-66 的全部要求：不静默，而不是不许降级。
 */
export interface AllSkillsResult {
  ok: boolean;
  list: AllSkill[];
  /** `ok:false` 的原因（缓存键损坏 / 形状违约）—— 由 `readSkillList` 给，本层只转发 */
  error?: string;
}

export function listAllSkills(): AllSkillsResult {
  const cache = readSkillList();
  const out: AllSkill[] = [];
  const seen = new Set<string>();
  for (const raw of cache.ok ? cache.list : []) {
    const e = raw as {
      id?: unknown;
      name?: unknown;
      description?: unknown;
      content?: unknown;
      category?: unknown;
      slug?: unknown;
      version?: unknown;
    };
    if (typeof e?.id !== 'string' || !e.id || seen.has(e.id)) continue;
    seen.add(e.id);
    const category = str(e.category);
    const slug = str(e.slug);
    out.push({
      id: e.id,
      name: str(e.name),
      description: str(e.description),
      content: str(e.content),
      builtin: false,
      category: category || undefined,
      slug: slug || undefined,
      version: str(e.version) || undefined,
    });
  }
  for (const b of getBuiltinSkills()) {
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    out.push({
      id: b.id,
      name: b.name,
      description: b.description,
      content: b.content,
      builtin: true,
      version: b.version,
    });
  }
  // 缓存读失败 ⇒ 照实回报（`list` 仍是那批内置：调用方可渲染，但**不许**把它当成"用户的技能没了"）
  return cache.ok ? { ok: true, list: out } : { ok: false, list: out, error: cache.error };
}
