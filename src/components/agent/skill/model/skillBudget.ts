/**
 * Skill 的**注入预算**（唯一真源）：预算取值 · 建议上界 · 清单上限 · 截断（含固定提示）。
 *
 * 【本文件只管"给多少"】怎么把 skill 拼成**发给模型的文本**在 `skillInjectText.ts`；
 * 两者变更理由不同 ⇒ 分开住：调预算（一个产品/配置决定，且设置页要拿上界做校验）不该碰到块文案，
 * 改块文案（提示词工程）也不该顺手改预算。
 *
 * 【历史上它与另外四类一起住在 `skillCatalog.ts`（TD-11-60 六类混居）】—— 那个文件的头部
 * 自己写着"实际住着六类"，读者据此误判边界：想改预算的人要在一个装着路径安全/目录名/组措辞/
 * 块文案的文件里找。拆法是"按变更理由"，不是"按行数"。
 */
/**
 * 注入预算（中文 1 字≈1 token；默认值，`agent_skill_config.contentLimits` 可覆盖）
 */
export const SKILL_CONTENT_LIMITS = {
  /** 单个 skill 正文注入上限（字） */
  singleSkillChars: 12000,
  /** 一次展开（多个绑定合计）上限（字） */
  expansionTotalChars: 24000,
  /** 一次最多显式绑定几个 skill */
  maxExplicitBindings: 4,
} as const;

/**
 * 预算的**建议上界** —— 超过它，这项预算就等于"没设"（预算是用来防上下文被顶爆的）。
 *
 * 【为什么只给"建议"而不硬拦】上界是**经验值**，不是物理红线：确实需要很大预算的用户不该无路可走。
 * 但**不许静默**：UI 超界时必须把后果说出来（否则用户以为自己设了一道防线，其实形同关闭）。
 * 【为什么住这里】它就是预算语义的一部分 ⇒ 与 `SKILL_CONTENT_LIMITS` 同源，不许在 UI 里再抄一份。
 */
export const SKILL_LIMIT_SUGGESTED_MAX = {
  singleSkillChars: 40000,
  expansionTotalChars: 80000,
  maxExplicitBindings: 12,
} as const;

/** 元数据清单（块①）上限：条数与字数（≈500 token） */
export const SKILL_INDEX_LIMITS = { maxItems: 24, maxChars: 2000 } as const;

/** 截断提示（逐字固定：模型与用户看到同一句，避免两处各写一份） */
export const SKILL_TRUNCATION_NOTICE = '……（本 Skill 内容超出长度上限，已截断）';

/**
 * 正文截断（唯一实现）。
 * @returns 截断后正文与是否发生截断（**必须回传布尔**，否则调用方无从提示"被截断了"）
 */
export function truncateSkillContent(
  content: string,
  limit: number,
): { content: string; truncated: boolean } {
  const text = typeof content === 'string' ? content : '';
  if (!text) return { content: '', truncated: false };
  // 【`limit <= 0` = 一点都不给】不再是"不限"：那个反直觉约定已被实证咬过一次（预算耗尽反而整段注入），
  // 且逼得每个调用点都得先补一句额度判断。现在语义直白 —— 没额度 ⇒ 空内容 + `truncated:true`
  // （"有内容但一字没注入"，调用方据此点名告知用户，不静默）。
  if (limit <= 0) return { content: '', truncated: true };
  if (text.length <= limit) return { content: text, truncated: false };
  return { content: text.slice(0, limit) + SKILL_TRUNCATION_NOTICE, truncated: true };
}
