import type { TransitionType } from '@videoEditor/types/timeline';

export interface TransitionPreset {
  type: TransitionType;
  label: string;
  category: 'fade' | 'wipe' | 'slide' | 'zoom';
}

export const TRANSITION_PRESETS: TransitionPreset[] = [
  { type: 'fade', label: '淡入淡出', category: 'fade' },
  { type: 'dissolve', label: '溶解', category: 'fade' },
  { type: 'wipe-left', label: '左擦除', category: 'wipe' },
  { type: 'wipe-right', label: '右擦除', category: 'wipe' },
  { type: 'wipe-up', label: '上擦除', category: 'wipe' },
  { type: 'wipe-down', label: '下擦除', category: 'wipe' },
  { type: 'slide-left', label: '左滑', category: 'slide' },
  { type: 'slide-right', label: '右滑', category: 'slide' },
  { type: 'slide-up', label: '上滑', category: 'slide' },
  { type: 'slide-down', label: '下滑', category: 'slide' },
  { type: 'zoom-in', label: '放大', category: 'zoom' },
  { type: 'zoom-out', label: '缩小', category: 'zoom' },
];

export const DEFAULT_TRANSITION_DURATION = 0.5;

export const TRANSITION_CATEGORIES = ['fade', 'wipe', 'slide', 'zoom'] as const;

export const TRANSITION_CATEGORY_LABELS: Record<(typeof TRANSITION_CATEGORIES)[number], string> = {
  fade: '淡入淡出',
  wipe: '擦除',
  slide: '滑动',
  zoom: '缩放',
};
