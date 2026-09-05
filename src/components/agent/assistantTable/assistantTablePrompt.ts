/**
 * AI 助手表格 —— 提示词纯函数层（无副作用，对齐 scriptBoxPrompts 形态，勿新造风格）。
 *
 * 职责：AI「生成整表 / 改单行」的**输出格式契约** + 与输出结构分两段的**风格系统提示词** +
 *   生成/改行的 user 拼装。措辞通用"表格/行"，不限定任何业务语义（不分镜/故事/产品页）。
 * 与已确认的 globalStyle 归属一致：globalStyle 走会话记忆 global_contract.unified_style_prompt，
 *   本文件只把它拼进 user 上下文，不在表内重复存。
 *
 * 说明：STORYBOARD 语义已废除（不分镜）——本文件统一用「表格」，输出契约照抄剧本盒
 *   SCRIPT_WRITER_FORMAT 的「只返回纯 JSON、顶层 {globalStyle, rows:[{列名:值}]}」形态。
 */

/** 输出格式契约（运行时强制追加，保证 LLM 返回可解析 JSON）：整表与改单行共用同一 schema */
export const ASSISTANT_TABLE_FORMAT = `

【输出格式】严格输出一个 JSON 对象（只返回纯 JSON，不要解释、不要 Markdown 代码块）：
{"globalStyle":"全局统一风格（整批一致基调，可填入视觉风格/配色/氛围等。若用户已给则照做不改，未给则补一个合理默认；没有可留空）","rows":[{"列名1":"该行该列内容","列名2":"该行该列内容",...},...]}
【要求】rows 是行数组，每行是一个对象，对象的键 = 列名（列名由你按用户需求设计，贴目录与需求理解：整表生成时各行列名一致；改单行时只输出被改的那一行、带列名，其余列保持原内容）。只输出这个 JSON，不要额外文字。`

/** 与输出格式分两段的"处理表格"系统提示词（可留作注入位；当前以 ASSISTANT_TABLE_FORMAT 为主即可） */
export const ASSISTANT_TABLE_SYSTEM = '你正在一个 AI 助手表格工作区里协作：内容以表格形式组织，可整表生成、也可只改某行。列与行完全由用户需求/粘贴决定，你不预设模板、不限定用途（可以是分镜、产品页、提示词集、任何结构化清单）。'

/** 生成整表 user 拼装：描述需求 → AI 设计列 + 填充初始内容 */
export function buildGenerateUser(idea: string): string {
  return `请根据下面的需求设计一张表格并填充初始内容（表格完全可定义：你来定列名/列数/分几行）。\n\n【需求描述】\n${String(idea ?? '').trim()}`
}

/** 改单行 user 拼装：当前该行（带列名）+ globalStyle + 用户修改意见。
 *  globalStyle 空就自然传空（AI 自会忽略/不硬改），不加"空则填/非空则守"这类刻意义务逻辑。 */
export function buildRefineRowUser(rowText: string, globalStyle: string, instruction: string): string {
  const parts = [`请针对下面这一行表格内容做修改（只改文字；列结构/其它行/顺序保持不变）：`, '', `【当前该行】\n${String(rowText ?? '').trim() || '（空行）'}`]
  if (globalStyle) parts.push(`【全局风格（整批统一基调，保持一致）】\n${globalStyle}`)
  parts.push(`【修改意见】\n${String(instruction ?? '').trim()}`)
  return parts.join('\n')
}

/** 表格模式下的"表格专注上下文"追加块（展开表格时随 system 注入，收起时移除；同对话不换 agentKey）。
 *  给 AI 当前列结构 + 让它在"对待表格 vs 画布"间不摇摆，但仍保留画布工具可生成某行。 */
export function buildTableModeContext(columns: string[], globalStyle: string): string {
  const cols = Array.isArray(columns) && columns.length ? columns.join(', ') : '（暂无）'
  const style = String(globalStyle ?? '').trim()
  return `<用户当前展开 AI 助手左侧表格工作区，是当前对话的结构化内容（随对话持久化）。列结构：${cols}${style ? `，全局风格：${style}` : ''}。你的任务：配合用户生成/填充/优化表格内容——整表生成或改单行走精简 JSON（顶层 {globalStyle, rows:[{列名:值}]}）；用户说"生成某行/这行去生成"时，把该行内容落到画布建节点并生成。返回表格内容前先给可读预览等确认，不直接改正式表。>`
}