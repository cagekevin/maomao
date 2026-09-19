import type { TextElement, TextShadow } from '@/components/videoEditor/types/timeline';
import { TIMELINE_CONSTANTS } from './timeline-constants';

export const MIN_FONT_SIZE = 1;
export const MAX_FONT_SIZE = 38;

/**
 * 描边宽度为 0 = **没有描边**（用户口径：「你是 0 不就是没有启用吗？」）。
 * 故它是滑杆的下界，也是「未启用」的表示 —— **不是**"最小可见描边"，别改成 1。
 */
export const NO_STROKE_WIDTH = 0;
/** 描边宽度上界（滑杆 max）。 */
export const MAX_STROKE_WIDTH = 20;

/* ── 文字背景板的默认值 —— **各只有一份** ─────────────────────
 * `TextElement` 的背景字段全部可选（undefined = 未设过），
 * 属性面板读取时需要 `?? 默认值`。曾把 `1 / 4 / 8 / 0` 四个字面量
 * 各抄 3 份（滑杆初值 / 历史基线 / 数值显示三处），改默认要改 12 处、
 * 漏 1 处就是"滑杆显示 4、实际生效 6"式的静默错位（M3 SSOT）。
 * 改默认值只改这里。 */
export const DEFAULT_BG_OPACITY = 1;
export const DEFAULT_BG_PADDING_Y = 4;
export const DEFAULT_BG_PADDING_X = 8;
export const DEFAULT_BG_BORDER_RADIUS = 0;

/**
 * 「这段文字有没有描边」—— **唯一判据**（UI 与渲染器共用，勿各写一份）。
 *
 * 【判据 = `width > 0`，不是"有没有 `stroke` 对象"】
 * `TextElement.stroke` 是可选对象，`width` 才是决定"看不看得见"的量。
 * 于是存在三种数据形态，但只有两种视觉结果：
 *   · 无 `stroke` 对象          → 无描边
 *   · 有对象但 `width <= 0`     → **同样无描边**（画不出来）
 *   · 有对象且 `width > 0`      → 有描边
 * 用户口径（2026-09-15）：「默认是 0，就是没有描边。你自己往上加一点就有了」——
 * 即**宽度本身就是启用开关**，不需要额外的「启用」布尔。
 *
 * ⚠️ 渲染侧（`renderer/nodes/text-node.ts` 的 `stroke && stroke.width > 0`）
 * 一直是这个判据；UI 曾用 `!!element.stroke`（另一个判据）→ 两套判据会得出
 * 不同答案（UI 说"有"、画面却是空的）。收口到本函数即消除该分叉。
 */
export function hasTextStroke<S extends { width?: number } | undefined | null>(
  stroke: S,
): stroke is NonNullable<S> & { width: number } {
  return !!stroke && typeof stroke.width === 'number' && (stroke.width as number) > 0;
}

/**
 * 阴影的默认值 —— **单一来源**。
 * 「有没有阴影」的判据是"存不存在 `shadow` 对象"（`hasTextShadow`），
 * 所以凡是"补一个阴影出来"的地方（属性面板开关、"样式"节的默认展开判定）
 * 都必须用这一个对象，否则又会出现"N 个地方各写一份默认值、彼此悄悄漂移"。
 * （2026-09-15：收敛 `text-properties.tsx` 里散落的 3 处 `{2,2,4,#000}` 字面量。）
 */
export const DEFAULT_TEXT_SHADOW: TextShadow = {
  color: '#000000',
  offsetX: 2,
  offsetY: 2,
  blur: 4,
};

/** 阴影判据（与描边同一个收口位置：UI 与渲染器共用一份说法）。 */
export function hasTextShadow(shadow: TextShadow | undefined | null): shadow is TextShadow {
  return !!shadow;
}

/**
 * 「这段文字有没有背景板」—— 唯一判据：颜色非空且非 `transparent`。
 * `TextElement.backgroundColor` 的"没有"是用 `'transparent'` 字面量表示的（见 DEFAULT_TEXT_ELEMENT），
 * 不是 `undefined`；两处（开关状态 / 默认展开）都走这里，免得各判各的。
 */
export function hasTextBackground({ backgroundColor }: { backgroundColor?: string }): boolean {
  return !!backgroundColor && backgroundColor !== 'transparent';
}

/**
 * higher value: smaller font size
 * lower value: larger font size
 */
export const FONT_SIZE_SCALE_REFERENCE = 90;

export const DEFAULT_TEXT_ELEMENT: Omit<TextElement, 'id'> = {
  type: 'text',
  name: 'Text',
  content: 'Default text',
  fontSize: 15,
  fontFamily: 'Arial',
  color: '#ffffff',
  backgroundColor: 'transparent',
  textAlign: 'center',
  fontWeight: 400,
  fontStyle: 'normal',
  textDecoration: 'none',
  duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
  startTime: 0,
  trimStart: 0,
  transform: {
    scale: 1,
    position: {
      x: 0,
      y: 0,
    },
    rotate: 0,
  },
  opacity: 1,
};
