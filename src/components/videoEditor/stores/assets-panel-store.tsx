import type { ElementType } from 'react';
import { create } from 'zustand';
import {
  Folder,
  Headphones,
  Type,
  Smile,
  Wand2,
  ChevronsRight,
  Captions,
  Palette,
  SlidersHorizontal,
  Brain,
  Settings,
} from 'lucide-react';

export const TAB_KEYS = [
  'media',
  'sounds',
  'text',
  'stickers',
  'effects',
  'transitions',
  'captions',
  'filters',
  'adjustment',
  'ai',
  'settings',
] as const;

export type Tab = (typeof TAB_KEYS)[number];

const createIcon =
  (Icon: ElementType<{ className?: string }>) =>
  ({ className }: { className?: string }) => <Icon className={className} />;

const TAB_LABELS: Record<Tab, string> = {
  media: '素材',
  sounds: '音效',
  text: '文字',
  stickers: '贴纸',
  effects: '效果',
  transitions: '转场',
  captions: '字幕',
  filters: '滤镜',
  adjustment: '调整',
  ai: 'AI',
  settings: '设置',
};

export const tabs = {
  media: {
    icon: createIcon(Folder),
    label: TAB_LABELS.media,
  },
  sounds: {
    icon: createIcon(Headphones),
    label: TAB_LABELS.sounds,
  },
  text: {
    icon: createIcon(Type),
    label: TAB_LABELS.text,
  },
  stickers: {
    icon: createIcon(Smile),
    label: TAB_LABELS.stickers,
  },
  effects: {
    icon: createIcon(Wand2),
    label: TAB_LABELS.effects,
  },
  transitions: {
    icon: createIcon(ChevronsRight),
    label: TAB_LABELS.transitions,
  },
  captions: {
    icon: createIcon(Captions),
    label: TAB_LABELS.captions,
  },
  filters: {
    icon: createIcon(Palette),
    label: TAB_LABELS.filters,
  },
  adjustment: {
    icon: createIcon(SlidersHorizontal),
    label: TAB_LABELS.adjustment,
  },
  ai: {
    icon: createIcon(Brain),
    label: TAB_LABELS.ai,
  },
  settings: {
    icon: createIcon(Settings),
    label: TAB_LABELS.settings,
  },
} satisfies Record<Tab, { icon: ElementType<{ className?: string }>; label: string }>;

type MediaViewMode = 'grid' | 'list';

interface AssetsPanelStore {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  highlightMediaId: string | null;
  requestRevealMedia: (mediaId: string) => void;
  clearHighlight: () => void;

  /* Media */
  mediaViewMode: MediaViewMode;
  setMediaViewMode: (mode: MediaViewMode) => void;
}

export const useAssetsPanelStore = create<AssetsPanelStore>((set) => ({
  activeTab: 'media',
  setActiveTab: (tab) => set({ activeTab: tab }),
  highlightMediaId: null,
  requestRevealMedia: (mediaId) => set({ activeTab: 'media', highlightMediaId: mediaId }),
  clearHighlight: () => set({ highlightMediaId: null }),
  mediaViewMode: 'grid',
  setMediaViewMode: (mode) => set({ mediaViewMode: mode }),
}));
