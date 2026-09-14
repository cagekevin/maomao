import type { ElementType } from 'react';
import { create } from 'zustand';
import {
  AiBrain01Icon,
  ArrowRightDoubleIcon,
  ClosedCaptionIcon,
  Folder03Icon,
  Happy01Icon,
  HeadphonesIcon,
  MagicWand05Icon,
  TextIcon,
  Settings01Icon,
  SlidersHorizontalIcon,
  ColorsIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';

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

const createHugeiconsIcon =
  ({ icon }: { icon: IconSvgElement }) =>
  ({ className }: { className?: string }) => <HugeiconsIcon icon={icon} className={className} />;

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
    icon: createHugeiconsIcon({ icon: Folder03Icon }),
    label: TAB_LABELS.media,
  },
  sounds: {
    icon: createHugeiconsIcon({ icon: HeadphonesIcon }),
    label: TAB_LABELS.sounds,
  },
  text: {
    icon: createHugeiconsIcon({ icon: TextIcon }),
    label: TAB_LABELS.text,
  },
  stickers: {
    icon: createHugeiconsIcon({ icon: Happy01Icon }),
    label: TAB_LABELS.stickers,
  },
  effects: {
    icon: createHugeiconsIcon({ icon: MagicWand05Icon }),
    label: TAB_LABELS.effects,
  },
  transitions: {
    icon: createHugeiconsIcon({ icon: ArrowRightDoubleIcon }),
    label: TAB_LABELS.transitions,
  },
  captions: {
    icon: createHugeiconsIcon({ icon: ClosedCaptionIcon }),
    label: TAB_LABELS.captions,
  },
  filters: {
    icon: createHugeiconsIcon({ icon: ColorsIcon }),
    label: TAB_LABELS.filters,
  },
  adjustment: {
    icon: createHugeiconsIcon({ icon: SlidersHorizontalIcon }),
    label: TAB_LABELS.adjustment,
  },
  ai: {
    icon: createHugeiconsIcon({ icon: AiBrain01Icon }),
    label: TAB_LABELS.ai,
  },
  settings: {
    icon: createHugeiconsIcon({ icon: Settings01Icon }),
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
