import type { TextElement, TextStroke, TextShadow } from '@/components/videoEditor/types/timeline';

/**
 * 预设 patch：允许**显式 undefined**（表示「清空该样式」）。
 * `Partial<T>` 在 `exactOptionalPropertyTypes` 下不接受显式 undefined，而 `clear-all` 预设正是靠
 * `stroke: undefined` / `shadow: undefined` 清空，故用映射类型把 undefined 显式写进值域。
 */
type TextStylePatch = {
  [K in 'color' | 'backgroundColor' | 'stroke' | 'shadow' | 'fontWeight']?:
    | TextElement[K]
    | undefined;
};

export interface TextStylePreset {
  id: string;
  name: string;
  styles: TextStylePatch;
  preview: {
    color: string;
    backgroundColor?: string;
    stroke?: TextStroke;
    shadow?: TextShadow;
    /** 预览字重（数字，与 `TextElement.fontWeight` 同口径）。 */
    fontWeight?: number;
  };
}

export const TEXT_STYLE_PRESETS: TextStylePreset[] = [
  {
    id: 'clear-all',
    name: 'Clear All',
    styles: {
      color: '#ffffff',
      backgroundColor: 'transparent',
      stroke: undefined,
      shadow: undefined,
    },
    preview: {
      color: '#ffffff',
    },
  },
  {
    id: 'white-black-stroke',
    name: 'White + Black Stroke',
    styles: {
      color: '#ffffff',
      stroke: { color: '#000000', width: 3 },
      shadow: undefined,
    },
    preview: {
      color: '#ffffff',
      stroke: { color: '#000000', width: 3 },
    },
  },
  {
    id: 'black-white-stroke',
    name: 'Black + White Stroke',
    styles: {
      color: '#000000',
      stroke: { color: '#ffffff', width: 3 },
      shadow: undefined,
    },
    preview: {
      color: '#000000',
      stroke: { color: '#ffffff', width: 3 },
    },
  },
  {
    id: 'yellow-black-stroke',
    name: 'Yellow + Black Stroke',
    styles: {
      color: '#ffff00',
      stroke: { color: '#000000', width: 3 },
      shadow: undefined,
    },
    preview: {
      color: '#ffff00',
      stroke: { color: '#000000', width: 3 },
    },
  },
  {
    id: 'white-pink-stroke',
    name: 'White + Pink Stroke',
    styles: {
      color: '#ffffff',
      stroke: { color: '#ff69b4', width: 3 },
      shadow: undefined,
    },
    preview: {
      color: '#ffffff',
      stroke: { color: '#ff69b4', width: 3 },
    },
  },
  {
    id: 'black-bg-white-text',
    name: 'Black BG + White Text',
    styles: {
      color: '#ffffff',
      backgroundColor: '#000000',
      stroke: undefined,
      shadow: undefined,
    },
    preview: {
      color: '#ffffff',
      backgroundColor: '#000000',
    },
  },
  {
    id: 'white-bg-black-text',
    name: 'White BG + Black Text',
    styles: {
      color: '#000000',
      backgroundColor: '#ffffff',
      stroke: undefined,
      shadow: undefined,
    },
    preview: {
      color: '#000000',
      backgroundColor: '#ffffff',
    },
  },
  {
    id: 'white-blue-shadow',
    name: 'White + Blue Shadow',
    styles: {
      color: '#ffffff',
      stroke: undefined,
      shadow: { color: '#0066ff', offsetX: 2, offsetY: 2, blur: 6 },
    },
    preview: {
      color: '#ffffff',
      shadow: { color: '#0066ff', offsetX: 2, offsetY: 2, blur: 6 },
    },
  },
];
