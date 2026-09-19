import { videoEditorLogger } from '@/components/videoEditor/lib/videoEditorLogger';
import { create } from 'zustand';
import {
  getCollections,
  getCollection,
  searchIcons,
  type IconSet,
  type CollectionInfo,
  type IconSearchResult,
} from '@/components/videoEditor/engine/lib/iconify-api';
import { EditorCore } from '@/components/videoEditor/engine/core';
import { buildStickerElement } from '@/components/videoEditor/engine/timeline/element-utils';
import { STICKER_CATEGORY_CONFIG } from '@/components/videoEditor/constants/stickers-constants';
import type { StickerCategory } from '@/components/videoEditor/types/stickers';

type ViewMode = 'search' | 'browse' | 'collection';

interface StickersStore {
  searchQuery: string;
  selectedCategory: StickerCategory;
  selectedCollection: string | null;
  viewMode: ViewMode;
  collections: Record<string, IconSet>;
  /** 【2026-09-17】**失败的可见落点**（＝生产者给的判词，UI 直接渲染，store **不加工**）。
   *  此前"拉取失败"与"确实没有图标"共用同一个空 `collections` ⇒ 用户与开发者都看不出区别。 */
  collectionsError: string | null;
  currentCollection: CollectionInfo | null;
  /** 同上（单集合详情） */
  collectionError: string | null;
  searchResults: IconSearchResult | null;
  /** 同上（搜索结果）。【2026-09-17】原实现失败返回**假空结果**（字段齐全的 `{icons:[],total:0,…}`）
   *  ⇒ "搜不到图标"与"搜索接口挂了"不可区分；且本 store 那个 `catch` **永不触发**（`searchIcons` 从不抛）= 死代码。 */
  searchError: string | null;
  recentStickers: string[];
  isLoadingCollections: boolean;
  isLoadingCollection: boolean;
  isSearching: boolean;
  addingSticker: string | null;

  setSearchQuery: ({ query }: { query: string }) => void;
  setSelectedCategory: ({ category }: { category: StickerCategory }) => void;
  setSelectedCollection: ({ collection }: { collection: string | null }) => void;
  setViewMode: ({ mode }: { mode: ViewMode }) => void;
  loadCollections: () => Promise<void>;
  loadCollection: ({ prefix }: { prefix: string }) => Promise<void>;
  searchStickers: ({ query }: { query: string }) => Promise<void>;
  addStickerToTimeline: ({ iconName }: { iconName: string }) => void;
  addToRecentStickers: ({ iconName }: { iconName: string }) => void;
  clearRecentStickers: () => void;
}

const MAX_RECENT_STICKERS = 50;

export const useStickersStore = create<StickersStore>((set, get) => ({
  searchQuery: '',
  selectedCategory: 'all',
  selectedCollection: null,
  viewMode: 'browse',

  collections: {},
  collectionsError: null,
  currentCollection: null,
  collectionError: null,
  searchResults: null,
  searchError: null,
  recentStickers: [],

  isLoadingCollections: false,
  isLoadingCollection: false,
  isSearching: false,
  addingSticker: null,

  setSearchQuery: ({ query }) => set({ searchQuery: query }),

  setSelectedCategory: ({ category }) =>
    set({
      selectedCategory: category,
      viewMode: 'browse',
      selectedCollection: null,
      currentCollection: null,
    }),

  setSelectedCollection: ({ collection }) => {
    set({
      selectedCollection: collection,
      viewMode: collection ? 'collection' : 'browse',
      currentCollection: null,
    });

    if (collection) {
      get().loadCollection({ prefix: collection });
    }
  },

  setViewMode: ({ mode }) => set({ viewMode: mode }),

  loadCollections: async () => {
    set({ isLoadingCollections: true });
    try {
      const r = await getCollections();
      // 【2026-09-17 消费者只转发】判别联合：成功取 `r.data`；失败把**生产者判词**转发到
      // `collectionsError`（UI 直接渲染）—— 不再把"拉取失败"与"该分类为空"混成同一个空集合。
      if (r.ok) {
        set({ collections: r.data, collectionsError: null });
      } else {
        videoEditorLogger.warn('贴纸库', '图标集合加载失败（转发生产者判词）', {
          message: r.message,
        });
        set({ collections: {}, collectionsError: r.message });
      }
    } finally {
      set({ isLoadingCollections: false });
    }
  },

  loadCollection: async ({ prefix }: { prefix: string }) => {
    set({ isLoadingCollection: true });
    try {
      const r = await getCollection(prefix);
      // 【2026-09-17 消费者只转发】同上：失败把生产者判词放进 `collectionError`，UI 直接渲染。
      if (r.ok) {
        set({ currentCollection: r.data, collectionError: null });
      } else {
        videoEditorLogger.warn('贴纸库', '图标集合详情加载失败（转发生产者判词）', {
          message: r.message,
        });
        set({ currentCollection: null, collectionError: r.message });
      }
    } finally {
      set({ isLoadingCollection: false });
    }
  },

  searchStickers: async ({ query }: { query: string }) => {
    if (!query.trim()) {
      set({ searchResults: null, viewMode: 'browse' });
      return;
    }

    const { selectedCategory } = get();

    set({ isSearching: true, viewMode: 'search' });
    try {
      const category = STICKER_CATEGORY_CONFIG[selectedCategory];
      const r = await searchIcons(query, 100, undefined, category);
      // 【2026-09-17 消费者只转发】判别联合：成功取 `r.data`；失败把**生产者判词**写进
      // `searchError`（UI 直接渲染）—— store **不加工**（不自己编"搜索失败/请重试"）。
      // 注：原来的 `catch (error) { logger.error; set({searchResults:null}) }` 是**死代码**
      //（`searchIcons` 内部已 catch、从不抛），随契约收口一并删除。
      if (r.ok) {
        set({ searchResults: r.data, searchError: null });
      } else {
        videoEditorLogger.warn('贴纸库', '图标搜索失败（转发生产者判词）', { message: r.message });
        set({ searchResults: null, searchError: r.message });
      }
    } finally {
      set({ isSearching: false });
    }
  },

  addStickerToTimeline: ({ iconName }: { iconName: string }) => {
    set({ addingSticker: iconName });
    try {
      const editor = EditorCore.getInstance();
      const currentTime = editor.playback.getCurrentTime();
      const tracks = editor.timeline.getTracks();

      const stickerTrack = tracks.find((t) => t.type === 'sticker');
      let trackId: string;

      if (stickerTrack) {
        trackId = stickerTrack.id;
      } else {
        trackId = editor.timeline.addTrack({ type: 'sticker' });
      }

      const element = buildStickerElement({ iconName, startTime: currentTime });
      editor.timeline.insertElement({
        placement: { mode: 'explicit', trackId },
        element,
      });

      get().addToRecentStickers({ iconName });
    } finally {
      set({ addingSticker: null });
    }
  },

  addToRecentStickers: ({ iconName }: { iconName: string }) => {
    set((state) => {
      const recent = [iconName, ...state.recentStickers.filter((s) => s !== iconName)];
      return {
        recentStickers: recent.slice(0, MAX_RECENT_STICKERS),
      };
    });
  },

  clearRecentStickers: () => set({ recentStickers: [] }),
}));
