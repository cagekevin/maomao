/**
 * promptMention —— @提及 候选弹层的纯函数逻辑（无 DOM，可单测）。
 *
 * 职责：该不该弹（detectMentionQuery）+ 弹在哪（computeMentionPlacement）。
 * 与 promptChips.js 同范式：纯逻辑层，组件只做 DOM/事件。唯一入口，禁止在组件里另写 lastIndexOf('@')。
 */

export const MENTION_MAX_QUERY: number = 20       // query 超过即判为「不是在 @ 人」，自动关闭
export const MENTION_PANEL_W: number = 280
export const MENTION_PANEL_MAX_H: number = 300
export const MENTION_FLIP_MIN_H: number = 160     // 上方空间不足此值 → 翻转到下方

/** query 内出现即终止（含全角空格/常见中文标点/英文点，URL 邮箱天然被拦） */
const BREAK: Set<string> = new Set([' ', '\n', '\t', '\u3000', ',', '.', ';', '!', '?',
  '，', '。', '；', '、', '！', '？', '：', '{', '}', '(', ')', '（', '）'])

/** detectMentionQuery 返回值 */
export interface MentionQuery {
  active: boolean
  query: string
  atIndex: number
}

/** computeMentionPlacement 返回值 */
export interface MentionPlacement {
  placement: 'up' | 'down'
  left: number
  top?: number
  bottom?: number
  height: number
}

/** computeMentionPlacement 的 anchor 入参 */
export interface MentionAnchor {
  top: number
  bottom: number
  left: number
}

/** computeMentionPlacement 的可选选项 */
export interface MentionPlacementOpts {
  panelW?: number
  panelMaxH?: number
  flipMinH?: number
  gap?: number
  margin?: number
  viewportW?: number
  viewportH?: number
}

/**
 * @提及 触发判定（唯一入口）。
 * 跟随主流编辑器（Notion/飞书）语义：光标前最近的 @，其后到光标无断字符、长度不超限即弹。
 * 不看 @ 前面是什么——用户输入「小猫吃鱼@」这类中文后紧跟 @ 时应直接弹候选，无需先打空格。
 * URL/邮箱（hello@world.com）由 query 内的 `.` 触发 BREAK 自然拦截。
 * @param {string} before 光标之前的纯文本片段
 * @returns {{active:boolean, query:string, atIndex:number}}
 */
export function detectMentionQuery(before: string): MentionQuery {
  const at = String(before || '').lastIndexOf('@')
  if (at < 0) return { active: false, query: '', atIndex: -1 }
  const query = before.slice(at + 1)
  if (query.length > MENTION_MAX_QUERY) return { active: false, query: '', atIndex: -1 }
  for (const ch of query) if (BREAK.has(ch)) return { active: false, query: '', atIndex: -1 }
  return { active: true, query, atIndex: at }
}

/**
 * 底对齐定位：默认向上展开，弹层底边 = @ 行顶边 - gap（不遮挡已输入文本）。
 * 输入/输出均为视口坐标（配合 position: fixed 使用）。
 * @param {{top:number, bottom:number, left:number}} anchor @ 字符矩形
 * @param {{panelW?:number, panelMaxH?:number, flipMinH?:number, gap?:number, margin?:number, viewportW?:number, viewportH?:number}} opts
 * @returns {{placement:'up'|'down', left:number, top?:number, bottom?:number, height:number}}
 */
export function computeMentionPlacement(anchor: MentionAnchor, opts: MentionPlacementOpts = {}): MentionPlacement {
  const { panelW = MENTION_PANEL_W, panelMaxH = MENTION_PANEL_MAX_H,
          flipMinH = MENTION_FLIP_MIN_H, gap = 4, margin = 8 } = opts
  const vw = opts.viewportW ?? window.innerWidth
  const vh = opts.viewportH ?? window.innerHeight
  const spaceAbove = anchor.top - margin
  const spaceBelow = vh - anchor.bottom - margin
  const placement = (spaceAbove >= flipMinH || spaceAbove >= spaceBelow) ? ('up' as const) : ('down' as const)
  const room = placement === 'up' ? spaceAbove : spaceBelow
  const height = Math.max(96, Math.min(panelMaxH, room))
  const left = Math.min(Math.max(margin, anchor.left), Math.max(margin, vw - panelW - margin))
  return placement === 'up'
    ? { placement, left, top: undefined, bottom: vh - anchor.top + gap, height }
    : { placement, left, top: anchor.bottom + gap, bottom: undefined, height }
}