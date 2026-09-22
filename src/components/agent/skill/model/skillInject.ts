/**
 * 用例①「取本轮要发给模型的 Skill 文本」——把「设置态 + 取材」与「纯函数拼装」接起来。
 *
 * 【为什么单独一层】`skillInjectText` / `skillBudget` 是纯函数（可单测、零依赖）；「是否发清单」这个开关住在
 * `agent_skill_config`（存储）。把两者接起来需要读存储 ⇒ 不能进纯函数文件，也不该让 UI 各自读一遍
 * （两处读 = 两套判据）。故本层是**唯一**的组装点，UI 只调用它。
 *
 * 【块① / 块② 的判据都在这里收口】
 *  - 块①（可用清单）：`catalogToModel === false` ⇒ **返回空串**（不发）。默认关（D8）。
 *  - 块②（本次启用正文）：**发送起点冻结**（`freezeSkillTurn`）——一次发送内所有工具轮次共用同一份文本。
 */
import { contentFingerprint } from '@/components/base/core/utils.ts';
import { readSkillConfig } from '../store/skillRepository.ts';
import { listAllSkills } from './skillRegistry.ts';
import {
  buildBoundSkillBlocks,
  buildSkillIndexText,
  type SkillIndexItem,
} from './skillInjectText.ts';
import type { SkillBinding } from '../skillTypes.ts';

/**
 * 块①（可用 Skill 清单）文本。开关关闭 ⇒ `''`（调用方据此判断"本块不注入"）。
 * @param items 候选清单（调用方给「已启用」的 skill：id + 用途）。缺 description 的项由纯函数过滤掉。
 */
export function getSkillIndexText(items: SkillIndexItem[]): string {
  if (!readSkillConfig().catalogToModel) return '';
  return buildSkillIndexText(items || []);
}

export interface SkillTurn {
  /** 冻结绑定：写进本轮 user 消息（留痕 + 回看可判断"当时是哪一版"） */
  bindings: SkillBinding[];
  /** 块② 文本（按预算截断）。**与 `bindings` 同源产出** ⇒ "发出去的字"与"留的痕"永不背离 */
  docs: string;
  /** 前置失败（缓存损坏/读不到）：`bindings` 为空、一个 Skill 都不注入。**必须由调用方留痕**，不许静默 */
  error?: string;
  /** 给了 id、却在任何来源里都找不到（技能被删 / 换过 id）：如实回报，**不静默当"没选"** */
  missing?: string[];
}

/**
 * **发送起点冻结**本轮 Skill —— 一次发送内所有工具轮次共用这一个结果。
 *
 * 【为什么必须冻结（不每轮重读）】`makeContextMessages` 每轮都会重跑（工具循环允许多轮）。
 * 若每轮从存储现取，则在生成过程中发生的任何重选/重读都会让**同一轮对话的不同轮次拿到不同正文**
 * —— 用户以为发的是 A，实际第二轮变成 B，且事后无从对账。
 *
 * 【为什么入参是 **id 列表**（不是"技能对象"）】真相住在本模块能到达的两处：缓存（用户 skill，
 * 含磁盘落点）与内置常量。UI 只**指名**它选中了谁，**不许把正文/落点镜像着传进来** ——
 * 镜像就是第二份真相：字段一多必然漏传，而漏传（尤其 `category`/`slug`）会让"按需读附属资料"
 * 静默恒失败（TD-11-16 的根因，且单测测不出来）。**结构上不可能漏** = 消费者只给 id。
 *
 * 【留痕与截断的关系】`bindings[].content` 存**全文原文**（它是"当时那份"的证据，不可截断）；
 * 发给模型的 `docs` 才按 `contentLimits` 截断。两者同源但用途不同，**不许把截断版写进留痕**
 * （否则事后拿它去比对文件必然假不等）。
 *
 * 【口径与块② 一致】查不到 id、或正文为空白 ⇒ **不进绑定**（没有绑定的项也不会出现在 `docs` 里）；
 * 其中"查不到 id"要如实进 `missing`（技能被删了却还以为发过，是最难查的那类）。
 */
export function freezeSkillTurn(skillIds: string[]): SkillTurn {
  const ids = Array.isArray(skillIds)
    ? [...new Set(skillIds.filter((v): v is string => typeof v === 'string' && !!v))]
    : [];
  if (!ids.length) return { bindings: [], docs: '' };

  // 【唯一组合点】缓存 ∪ 内置（缓存优先）—— 见 `listAllSkills`（TD-11-51：组合不许有两个实现）。
  // 【为什么不再先单独读一次缓存】组合层现在**连读失败一起给**（TD-11-66）⇒ 那次"为了区分
  // '缓存损坏'与'缓存为空'"的预读成了重复读（同一次事实读两遍）。
  const all = listAllSkills();
  // 缓存读不到 ⇒ 本轮**一个都不注入**，并把原因交回调用方（不假装"没选 skill"）
  if (!all.ok) return { bindings: [], docs: '', error: all.error };
  const byId = new Map(all.list.map((s) => [s.id, s]));

  const limits = readSkillConfig().contentLimits;
  const bindings: SkillBinding[] = [];
  const missing: string[] = [];

  for (const id of ids) {
    const s = byId.get(id);
    if (!s) {
      missing.push(id);
      continue;
    }
    const content = typeof s.content === 'string' ? s.content : '';
    if (!content.trim()) continue; // 空正文：不占预算、也不进留痕
    bindings.push({
      skillId: id,
      name: s.name.trim() ? s.name : id,
      version: s.version,
      contentHash: contentFingerprint(content),
      content,
      // 内置与用户的分野由**组合层**给（`listAllSkills`），本层不猜
      origin: s.builtin ? 'builtin' : 'user',
      // 内置 skill 没有磁盘包 ⇒ 落点天然缺失（合法状态，不是"漏传"）
      category: s.category,
      slug: s.slug,
    });
  }

  return {
    bindings,
    docs: buildBoundSkillBlocks(
      bindings.map((b) => ({ name: b.name, content: b.content })),
      limits,
    ),
    ...(missing.length ? { missing } : {}),
  };
}
