/**
 * 预设卡片的悬停标题 —— **唯一构造点**（TD-05-19）。
 *
 * 契约：`title` 必须**同时含名字与提示词正文**。名字用于「识别这个预设是什么」，
 * prompt 是「它到底会让画面变成什么样」—— 此前只给名字，用户悬停看不到正文（本债的原始症状）。
 *
 * 【为什么不放在组件里】标题构造是纯字符串判据，放在 `.tsx` 里只能靠渲染测试锁（本仓已禁，
 * 见 `AGENTS.md §2.3`）；抽成纯函数后由 `presetTitle.test.ts` 直接锁。
 *
 * 【为什么无 prompt 时不留尾随换行】`name + '\n' + ''` 会得到带空行的 title，
 * tooltip 表现为下方一片空白。数据上 prompt 已归一化齐备（`creativeCatalog` 285/285 全有值），
 * 空值是异常态，此时只显示名字比显示一个空行诚实。
 */
export function presetCardTitle(name: string, prompt?: string | undefined): string {
  const body = (prompt ?? '').trim();
  return body ? `${name}\n${body}` : name;
}
