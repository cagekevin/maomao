/**
 * AI 助手表格 —— 提示词纯函数层（无副作用）。
 *
 * 【2026-09-06 收敛】表格协作的「人格」与「输出 JSON 契约」已上移到 agentConfig.TABLE_RULES
 *   （随 buildRequestMessages 的 mode='table' 作为首条 system 注入，见 agentCore）。
 *   原 ASSISTANT_TABLE_FORMAT / ASSISTANT_TABLE_SYSTEM / buildTableModeContext / buildGenerateUser
 *   因不再被引用已删除；本文件只保留 AgentPanel 仍需要的「改单行 user 拼装」。
 *   globalStyle 归属不变：走会话记忆 global_contract.unified_style_prompt。
 */
/**
 * 改单行 user 拼装：当前该行（带列名）+ globalStyle + 用户修改意见。
 * 只负责给模型「要改的是哪一行、原值是什么、想怎么改」；列结构/其它行不动由 system TABLE_RULES 约束。
 *  globalStyle 空就自然传空（AI 自会忽略/不硬改），不加"空则填/非空则守"这类刻意义务逻辑。
 */
export function buildRefineRowUser(
  rowText: string,
  globalStyle: string,
  instruction: string,
): string {
  const parts = [
    `这是你当前【选中的行】。请只针对这一行做修改（只改文字；列结构/其它行/顺序保持不变），改完输出该行单行 JSON：`,
    '',
    `【选中的行】\n${String(rowText ?? '').trim() || '（空行）'}`,
  ];
  if (globalStyle) parts.push(`【全局风格（整批统一基调，保持一致）】\n${globalStyle}`);
  parts.push(`【修改意见】\n${String(instruction ?? '').trim()}`);
  return parts.join('\n');
}
