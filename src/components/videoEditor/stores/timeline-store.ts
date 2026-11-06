/**
 * UI state for the timeline
 * For core logic, use EditorCore instead.
 *
 * 【2026-11-06 · V1】删除 rippleEditingEnabled / toggleRippleEditing（波纹编辑死开关）：
 * 工具栏按钮可点亮但全链路零行为（delete-elements 等命令无任何按 ripple 位移后继元素的重排逻辑，
 * docs/plan/123 记上游 relayoutSequential/settle/magneticOf 未搬入 ⇒ 只搬了开关没搬行为）。
 * 后续若补齐波纹重排行为，再连按钮一起恢复（git 历史可找回）。
 */

import { create } from 'zustand';
import type { ClipboardItem } from '@/components/videoEditor/types/timeline';

interface TimelineStore {
  snappingEnabled: boolean;
  toggleSnapping: () => void;
  clipboard: {
    items: ClipboardItem[];
  } | null;
  setClipboard: (
    clipboard: {
      items: ClipboardItem[];
    } | null,
  ) => void;
}

export const useTimelineStore = create<TimelineStore>((set) => ({
  snappingEnabled: true,

  toggleSnapping: () => {
    set((state) => ({ snappingEnabled: !state.snappingEnabled }));
  },

  clipboard: null,

  setClipboard: (clipboard) => {
    set({ clipboard });
  },
}));
