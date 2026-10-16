import type { TextElement } from '@/components/videoEditor/types/timeline';
import { FONT_SIZE_SCALE_REFERENCE } from '@/components/videoEditor/constants/text-constants';
import { buildFontFamilyStack } from './font-stack';

/**
 * **文本排版的唯一实现** —— 渲染（`TextNode`）与几何（`getElementCanvasRect`，服务命中 / 框子 / 吸附）
 * 都从这里取。
 *
 * 【为什么必须唯一】同一段文字"占多宽多高、断在哪"曾被写三遍：
 *   ① 渲染 `text-node.ts`（`ctx.measureText` 真实测量）；
 *   ② 选中框 `selection-overlay.tsx`（复制了①的换行算法）；
 *   ③ 命中 `element-bounds.ts`（**估算公式** `字符数 × 字号 × 0.6` —— 0.6 em 是**西文**均宽，
 *      汉字是全角 ≈ 1.0 em）。
 * 三者一旦分叉，用户"点不中自己看到的字、框子套不住字"（本仓已实证：中文文本框子偏窄）。
 * 现：字体串 / 换行 / 量宽只有这一份，消费方只提供"用哪个上下文量"。
 */

/** 布局只需要这两项 —— 渲染上下文与离屏上下文都满足。 */
export interface TextMeasureContext {
  font: string;
  measureText(text: string): TextMetrics;
}

export interface TextLayout {
  /** 换行后的行（单行模式 = `[content]`）。 */
  lines: string[];
  /** 行高（画布像素，已按 `canvasHeight` 缩放）。 */
  lineHeight: number;
  /** 文本自身占的宽（**未乘** `transform.scale`；多行取最宽行）。 */
  width: number;
  /** 文本自身占的高（**未乘** `transform.scale`）。 */
  height: number;
  /** 字号（画布像素）。 */
  fontSize: number;
  /** 是否有固定框宽（决定单行 / 多行排版）。 */
  hasBoxWidth: boolean;
  /** 框宽（画布像素；无框宽时为 0）。 */
  boxWidth: number;
}

/** 行高倍率（渲染与量高共用同一个值）。 */
const LINE_HEIGHT_RATIO = 1.3;
/** 单行量不到 `actualBoundingBox*` 时的回落（em 倍率）。 */
const ASCENT_FALLBACK_EM = 0.8;
const DESCENT_FALLBACK_EM = 0.2;

/**
 * 字号 / 框宽的缩放系数（唯一实现）：`canvasHeight / FONT_SIZE_SCALE_REFERENCE`。
 * 渲染、几何、以及"拖框改框宽"的指针换算都经此 —— 否则同一件事会有四个内联副本。
 */
export function getFontScaleFactor({ canvasHeight }: { canvasHeight: number }): number {
  return canvasHeight / FONT_SIZE_SCALE_REFERENCE;
}

function getScaledFontSize({
  fontSize,
  canvasHeight,
}: {
  fontSize: number;
  canvasHeight: number;
}): number {
  return fontSize * getFontScaleFactor({ canvasHeight });
}

function getScaledBoxWidth({
  boxWidth,
  canvasHeight,
}: {
  boxWidth: number;
  canvasHeight: number;
}): number {
  return boxWidth * getFontScaleFactor({ canvasHeight });
}

/**
 * 把元素的字体写进测量上下文，返回画布像素字号。
 *
 * 字体族走 `buildFontFamilyStack` 拼完整回落链 —— **不要在这里直接插 fontFamily**：
 * 原样丢给浏览器时，不认识的字体名会被静默回落（画布无报错、用户以为"选了没生效"）。
 */
function applyFontToContext({
  element,
  canvasHeight,
  context,
}: {
  element: TextElement;
  canvasHeight: number;
  context: TextMeasureContext;
}): number {
  const fontSize = getScaledFontSize({ fontSize: element.fontSize, canvasHeight });
  const fontStyle = element.fontStyle === 'italic' ? 'italic' : 'normal';
  context.font = `${fontStyle} ${element.fontWeight} ${fontSize}px ${buildFontFamilyStack({ fontFamily: element.fontFamily })}`;
  return fontSize;
}

function wrapText({
  context,
  text,
  maxWidth,
}: {
  context: TextMeasureContext;
  text: string;
  maxWidth: number;
}): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    if (paragraph === '') {
      lines.push('');
      continue;
    }

    const chars = Array.from(paragraph);
    let currentLine = '';

    for (const char of chars) {
      const testLine = currentLine + char;
      const metrics = context.measureText(testLine);

      if (metrics.width > maxWidth && currentLine !== '') {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine !== '') {
      lines.push(currentLine);
    }
  }

  return lines.length > 0 ? lines : [''];
}

/**
 * 文本元素 → 排版结果（**设置字体 + 换行 + 量宽高**都在这里）。
 * 调用方若随后要绘制，直接复用同一个上下文即可（字体已被本函数设好）。
 */
export function layoutText({
  element,
  canvasHeight,
  context,
}: {
  element: TextElement;
  canvasHeight: number;
  context: TextMeasureContext;
}): TextLayout {
  const fontSize = applyFontToContext({ element, canvasHeight, context });
  const lineHeight = fontSize * LINE_HEIGHT_RATIO;

  const rawBoxWidth = element.boxWidth;
  const hasBoxWidth = rawBoxWidth !== undefined && rawBoxWidth > 0;
  const boxWidth = hasBoxWidth ? getScaledBoxWidth({ boxWidth: rawBoxWidth, canvasHeight }) : 0;

  if (hasBoxWidth) {
    const lines = wrapText({ context, text: element.content, maxWidth: boxWidth });
    let width = 0;
    for (const line of lines) {
      width = Math.max(width, context.measureText(line).width);
    }
    return {
      lines,
      lineHeight,
      width,
      height: lines.length * lineHeight,
      fontSize,
      hasBoxWidth: true,
      boxWidth,
    };
  }

  const metrics = context.measureText(element.content);
  const ascent = metrics.actualBoundingBoxAscent ?? fontSize * ASCENT_FALLBACK_EM;
  const descent = metrics.actualBoundingBoxDescent ?? fontSize * DESCENT_FALLBACK_EM;

  return {
    lines: [element.content],
    lineHeight,
    width: metrics.width,
    height: ascent + descent,
    fontSize,
    hasBoxWidth: false,
    boxWidth: 0,
  };
}

/**
 * 离屏测量上下文（**唯一获取方式**，进程内复用一份）。
 *
 * 拿不到 2D 上下文 ⇒ **抛错**（不静默兜底）：框子 / 命中用猜的尺寸 = 用户可见的错误结果，
 * 抛错由 ErrorBoundary 接住，比"框子悄悄错位"诚实。
 */
let cachedMeasureContext: TextMeasureContext | null = null;

export function getTextMeasureContext(): TextMeasureContext {
  if (cachedMeasureContext) return cachedMeasureContext;

  if (typeof document === 'undefined') {
    throw new Error('text-layout: 当前环境没有 document，无法创建文本测量上下文');
  }

  const context = document.createElement('canvas').getContext('2d');
  if (!context) {
    throw new Error('text-layout: 无法创建文本测量用的 2D 上下文');
  }

  cachedMeasureContext = context;
  return context;
}
