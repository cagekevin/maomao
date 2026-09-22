/**
 * 用例⑤「模型按需读附属资料」= 渐进披露**第三层**（元数据常驻 → 正文按需 → 附属文件按需）。
 *
 * 【安全边界：只读「本轮启用」的 Skill 的、「正文里显式写过」的文本文件】两道判据缺一不可：
 *  ① 该 Skill 必须在本轮**冻结绑定**里（用户明确启用了它）⇒ 模型翻不了整个技能库；
 *  ② 相对路径必须在该 Skill **正文**里以反引号 / markdown 链接写出（`extractResourcePaths`），
 *     并过 `assertSafeSkillRelativePath`（禁 `scripts/**`、禁上跳、只收文本）⇒ 不是"包内任意可读"。
 * 少了 ① 就是"模型能读用户没启用的技能"，少了 ② 就是"能枚举包内所有文件"——两条都是真攻击面。
 *
 * 【绑定从哪来】`setSkillTurnBindings` 由 `useAgentChat.send` 在**发送起点**写入（与冻结同源，
 * 见 `freezeSkillTurn`）、发送结束清空。与 `setCurrentReferenceImages` 同一形态：
 * 模块级"本轮上下文"，因为工具调用签名里没有上下文参数（`callTool(name, args)`）。
 *
 * 【失败怎么回】一律返回**可据以纠正**的话术（"本轮启用的是 A、B" / "可读的是 references/x.md"）——
 * 模型读到后能自己改对；只回"失败"会让它反复瞎试。
 */
import { logger } from '@/components/base/core/log/logger.ts';
import { readSkillPackage } from './skillApi.ts';
import { truncateSkillContent } from './skillBudget.ts';
import { assertSafeSkillRelativePath, extractResourcePaths } from './skillResourcePath.ts';
import { readSkillConfig } from './skillRepository.ts';
import type { SkillBinding } from './skillTypes.ts';

/** 本轮冻结的绑定（模块级；发送起点写、结束清） */
let turnBindings: SkillBinding[] = [];

/** 设置/清空「本轮启用的 Skill」（传 `null`/空数组即清空）。**只由发送链路调用**。 */
export function setSkillTurnBindings(bindings: SkillBinding[] | null): void {
  turnBindings = Array.isArray(bindings) ? bindings.slice() : [];
}

/** 本轮启用的 Skill 摘要（回报里用，便于模型/用户对上号） */
function describe(list: SkillBinding[]): string {
  return list.map((b) => (b.version ? `${b.name}（v${b.version}）` : b.name)).join('、');
}

export interface SkillResourceResult {
  ok: boolean;
  /** 读到的 Skill 名（回报用） */
  skill?: string;
  path?: string;
  content?: string;
  /** 内容超长被截断（**如实告知模型**，否则它会以为拿到的是全文） */
  truncated?: boolean;
  error?: string;
}

/**
 * 读一份 Skill 附属资料。
 * @param pathRef Skill 正文里写出的相对路径（如 `references/风格.md`）
 * @param skillRef 可选：本轮启用多个 Skill 时用**名字或 id** 指明读哪一个
 */
export async function readSkillResource(
  pathRef: unknown,
  skillRef?: unknown,
): Promise<SkillResourceResult> {
  const path = typeof pathRef === 'string' ? pathRef.trim() : '';
  const ref = typeof skillRef === 'string' ? skillRef.trim() : '';
  if (!path) {
    return {
      ok: false,
      error: '缺少 path：要读的是 Skill 正文里写出的相对路径，如 references/风格.md',
    };
  }
  if (!turnBindings.length) {
    return { ok: false, error: '本轮没有启用 Skill，读不了资料。请让用户先选用一个 Skill。' };
  }
  const pool = ref ? turnBindings.filter((b) => b.skillId === ref || b.name === ref) : turnBindings;
  if (!pool.length) {
    return { ok: false, error: `找不到 Skill「${ref}」。本轮启用的是：${describe(turnBindings)}` };
  }
  if (pool.length > 1) {
    // 歧义不许猜：猜错就是"读了另一个技能的同类文件"，内容还看着对（最难查的那种错）
    return { ok: false, error: `本轮有多个 Skill 匹配「${ref}」，请用 id 指明：${describe(pool)}` };
  }
  const b = pool[0];

  if (!assertSafeSkillRelativePath(path)) {
    return {
      ok: false,
      error: `路径不允许：${path}（只允许该 Skill 正文里写出的**文本**资料，禁 scripts/ 与上跳）`,
    };
  }
  const allowed = extractResourcePaths(b.content);
  if (!allowed.includes(path)) {
    return {
      ok: false,
      error: `「${b.name}」正文里没有引用这个文件。可读的是：${allowed.length ? allowed.join('、') : '（正文里没有引用任何资料）'}`,
    };
  }
  if (!b.category || !b.slug) {
    return {
      ok: false,
      error: `「${b.name}」不在磁盘上（没有分组/目录），读不了它的附属文件。`,
    };
  }

  const r = await readSkillPackage(b.category, b.slug, 'content');
  if (!r.ok) return { ok: false, error: `读取技能包失败：${r.message}` };
  const f = r.data.files.find((x) => x.relPath === path);
  if (!f) return { ok: false, error: `技能包里没有 ${path}（可能已被删除或改名）` };
  if (f.encoding !== 'utf8')
    return { ok: false, error: `${path} 是二进制文件，读不了（只支持文本资料）` };

  const t = truncateSkillContent(f.content, readSkillConfig().contentLimits.singleSkillChars);
  logger.info('skillResource', '模型读取 Skill 资料', {
    skill: b.name,
    path,
    truncated: t.truncated,
  });
  return { ok: true, skill: b.name, path, content: t.content, truncated: t.truncated };
}
