import { buildTextElement } from '@/components/videoEditor/engine/timeline/element-utils';
import type { CreateTextElement, TextElement } from '@/components/videoEditor/types/timeline';

/**
 * 字幕模板可覆盖的样式字段 —— **相对 `DEFAULT_TEXT_ELEMENT` 的覆盖差**。
 *
 * 【为什么是覆盖差而不是完整形状（TD-22-30）】原定义是
 * `Omit<TextElement, 'id' | 'startTime' | 'trimStart' | 'trimEnd' | 'duration'>`，
 * 即模板必须**手抄 `TextElement` 的其余全部字段**：新增一个文本字段，8 个模板全要改；
 * 且 `createSubtitleFromTemplate` 直接把模板字段展开（不经 `buildTextElement`），
 * **绕过了唯一文本构造路径**（它才是 `DEFAULT_TEXT_ELEMENT` 单源的消费方）。
 *
 * 现在模板只写「样式覆盖差」，由 `buildTextElement` 合入默认值 —— 与同目录
 * `text-style-presets.ts` 的 `Partial<Pick<TextElement, …>>` 同一手法（正向样本）。
 * 身份/时间字段（id / type / name / content / startTime / trim*）由工厂决定，不在覆盖面内。
 */
type SubtitleTemplateStyles = Partial<
  Omit<TextElement, 'id' | 'type' | 'name' | 'content' | 'startTime' | 'trimStart' | 'duration'>
>;

export interface SubtitleTemplate {
  templateId: string;
  templateName: string;
  styles: SubtitleTemplateStyles;
}

/** 字幕元素的默认名字与占位文案（模板只定义样式，这两项由工厂给）。 */
const SUBTITLE_DEFAULT_NAME = 'Subtitle';
const SUBTITLE_DEFAULT_CONTENT = 'Your subtitle here';

export const SUBTITLE_TEMPLATES: SubtitleTemplate[] = [
  {
    templateId: 'classic',
    templateName: 'Classic',
    styles: {
      fontSize: 5,
      fontFamily: 'Arial',
      color: '#ffffff',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      textAlign: 'center',
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      opacity: 1,
      transform: { scale: 1, position: { x: 0, y: 300 }, rotate: 0 },
    },
  },
  {
    templateId: 'modern',
    templateName: 'Modern',
    styles: {
      fontSize: 5,
      fontFamily: 'Inter',
      color: '#ffffff',
      backgroundColor: 'transparent',
      textAlign: 'center',
      fontWeight: 'bold',
      fontStyle: 'normal',
      textDecoration: 'none',
      opacity: 1,
      transform: { scale: 1, position: { x: 0, y: 300 }, rotate: 0 },
    },
  },
  {
    templateId: 'minimal',
    templateName: 'Minimal',
    styles: {
      fontSize: 5,
      fontFamily: 'Helvetica',
      color: '#ffffff',
      backgroundColor: 'transparent',
      textAlign: 'center',
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      opacity: 0.9,
      transform: { scale: 1, position: { x: 0, y: 280 }, rotate: 0 },
    },
  },
  {
    templateId: 'highContrast',
    templateName: 'High Contrast',
    styles: {
      fontSize: 5,
      fontFamily: 'Arial',
      color: '#ffff00',
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      textAlign: 'center',
      fontWeight: 'bold',
      fontStyle: 'normal',
      textDecoration: 'none',
      opacity: 1,
      transform: { scale: 1, position: { x: 0, y: 300 }, rotate: 0 },
    },
  },
  {
    templateId: 'news',
    templateName: 'News Style',
    styles: {
      fontSize: 5,
      fontFamily: 'Arial',
      color: '#ffffff',
      backgroundColor: 'rgba(0, 100, 200, 0.9)',
      textAlign: 'center',
      fontWeight: 'bold',
      fontStyle: 'normal',
      textDecoration: 'none',
      opacity: 1,
      transform: { scale: 1, position: { x: 0, y: 320 }, rotate: 0 },
    },
  },
  {
    templateId: 'karaoke',
    templateName: 'Karaoke',
    styles: {
      fontSize: 6,
      fontFamily: 'Impact',
      color: '#00ffff',
      backgroundColor: 'transparent',
      textAlign: 'center',
      fontWeight: 'bold',
      fontStyle: 'normal',
      textDecoration: 'none',
      opacity: 1,
      transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
    },
  },
  {
    templateId: 'cinematic',
    templateName: 'Cinematic',
    styles: {
      fontSize: 5,
      fontFamily: 'Georgia',
      color: '#ffffff',
      backgroundColor: 'transparent',
      textAlign: 'center',
      fontWeight: 'normal',
      fontStyle: 'italic',
      textDecoration: 'none',
      opacity: 0.95,
      transform: { scale: 1, position: { x: 0, y: 280 }, rotate: 0 },
    },
  },
  {
    templateId: 'topTitle',
    templateName: 'Top Title',
    styles: {
      fontSize: 5,
      fontFamily: 'Arial',
      color: '#ffffff',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      textAlign: 'center',
      fontWeight: 'bold',
      fontStyle: 'normal',
      textDecoration: 'none',
      opacity: 1,
      transform: { scale: 1, position: { x: 0, y: -300 }, rotate: 0 },
    },
  },
];

/**
 * 由模板建一个字幕元素 —— 走**唯一文本构造路径** `buildTextElement`。
 *
 * 【为什么必须走它】`buildTextElement` 是「文本元素怎么造」的唯一实现（`DEFAULT_TEXT_ELEMENT`
 * 单源的消费方）。此前本函数直接展开模板字段 = **第二条构造路径**：默认值一旦新增/调整，
 * 就要同时改两处 —— 这正是 TD-22-30 的母体（同一形状的第二份）。
 */
export function createSubtitleFromTemplate({
  template,
  startTime = 0,
}: {
  template: SubtitleTemplate;
  startTime?: number;
}): CreateTextElement {
  return buildTextElement({
    raw: {
      ...template.styles,
      name: SUBTITLE_DEFAULT_NAME,
      content: SUBTITLE_DEFAULT_CONTENT,
    },
    startTime,
  });
}
