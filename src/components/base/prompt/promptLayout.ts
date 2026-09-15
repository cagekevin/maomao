/**
 * promptLayout —— 提示词编辑面板「内容统一内边距」的唯一真源（无 React / 无 DOM，纯常量）。
 *
 * 【为什么需要】素材引用条（ResourceStrip）、提示词正文（PromptInput）、底部参数区是三个独立
 * 组件，各自**不再带左侧偏移样式**（ResourceStrip 去掉过 mb-1；PromptInput 去掉过外层 flex gap-2
 * 与占位符的绝对定位偏移；prompt 芯片去掉过 margin: 0 2px）。
 * 左右边界一律由它们**共同的父容器**用本常量给出，于是
 * 「素材块左边缘 = 正文文字左边缘 = 底部按钮栏左边缘」必然在同一条基准线上。
 *
 * 【口径】
 *  1. 边界只由父容器的 padding 决定，不允许子组件再自带 margin / gap / paddingLeft，
 *     否则又会各自漂移出 1~2px 的视觉差（这正是本次要根治的问题）；
 *  2. **左右同值**（paddingLeft === paddingRight），避免内容贴右边缘时与左侧不对称。
 */
export const PROMPT_PANEL_PAD_X = 4;
