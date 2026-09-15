import { logger } from '@videoEditor/lib/logger';
import { i18next } from '@videoEditor/engine/lib/i18n';
import { create } from 'zustand';
import type { SoundEffect, SavedSound } from '@videoEditor/types/sounds';
import { storageService } from '@videoEditor/engine/services/storage/service';
import { toast } from '@videoEditor/lib/toast';
import { EditorCore } from '@videoEditor/engine/core';
import { buildLibraryAudioElement } from '@videoEditor/engine/timeline/element-utils';

/**
 * 剪辑器「已保存音效」store。
 *
 * 【2026-09-15 清理（TD-22-47）】此处原有 22 个成员服务于**第三方搜索 / 分页 / 授权过滤 /
 * 滚动位置**（`topSoundEffects` / `searchResults` / `showCommercialOnly` / `currentPage` /
 * `scrollPosition` …）。数据源改「自建本地库」后（见 `useSoundLibrary`）这些概念**全部不再存在**：
 * 库是一次性全量清单、过滤在前端内存里做。它们已成零引用死代码，故整体删除 ——
 * 留着会让后人以为"这里还能搜第三方"，正是本仓反复清理的"幽灵预留"。
 */
interface SoundsStore {
  savedSounds: SavedSound[];
  isSavedSoundsLoaded: boolean;
  isLoadingSavedSounds: boolean;
  savedSoundsError: string | null;

  addSoundToTimeline: ({ sound }: { sound: SoundEffect }) => Promise<boolean>;
  loadSavedSounds: () => Promise<void>;
  saveSoundEffect: ({ soundEffect }: { soundEffect: SoundEffect }) => Promise<void>;
  removeSavedSound: ({ soundId }: { soundId: number }) => Promise<void>;
  isSoundSaved: ({ soundId }: { soundId: number }) => boolean;
  toggleSavedSound: ({ soundEffect }: { soundEffect: SoundEffect }) => Promise<void>;
  clearSavedSounds: () => Promise<void>;
}

export const useSoundsStore = create<SoundsStore>((set, get) => ({
  savedSounds: [],
  isSavedSoundsLoaded: false,
  isLoadingSavedSounds: false,
  savedSoundsError: null,

  loadSavedSounds: async () => {
    if (get().isSavedSoundsLoaded) return;

    try {
      set({ isLoadingSavedSounds: true, savedSoundsError: null });
      const savedSoundsData = await storageService.loadSavedSounds();
      set({
        savedSounds: savedSoundsData.sounds,
        isSavedSoundsLoaded: true,
        isLoadingSavedSounds: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load saved sounds';
      set({
        savedSoundsError: errorMessage,
        isLoadingSavedSounds: false,
      });
      logger.error('Failed to load saved sounds:', error);
    }
  },

  saveSoundEffect: async ({ soundEffect }) => {
    try {
      await storageService.saveSoundEffect({ soundEffect });

      const savedSoundsData = await storageService.loadSavedSounds();
      set({ savedSounds: savedSoundsData.sounds });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save sound';
      set({ savedSoundsError: errorMessage });
      toast.error(i18next.t('Failed to save sound'));
      logger.error('Failed to save sound:', error);
    }
  },

  removeSavedSound: async ({ soundId }) => {
    try {
      await storageService.removeSavedSound({ soundId });

      set((state) => ({
        savedSounds: state.savedSounds.filter((sound) => sound.id !== soundId),
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove sound';
      set({ savedSoundsError: errorMessage });
      toast.error(i18next.t('Failed to remove sound'));
      logger.error('Failed to remove sound:', error);
    }
  },

  isSoundSaved: ({ soundId }) => {
    const { savedSounds } = get();
    return savedSounds.some((sound) => sound.id === soundId);
  },

  toggleSavedSound: async ({ soundEffect }) => {
    const { isSoundSaved, saveSoundEffect, removeSavedSound } = get();

    if (isSoundSaved({ soundId: soundEffect.id })) {
      await removeSavedSound({ soundId: soundEffect.id });
    } else {
      await saveSoundEffect({ soundEffect });
    }
  },

  clearSavedSounds: async () => {
    try {
      await storageService.clearSavedSounds();
      set({
        savedSounds: [],
        savedSoundsError: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to clear saved sounds';
      set({ savedSoundsError: errorMessage });
      toast.error(i18next.t('Failed to clear saved sounds'));
      logger.error('Failed to clear saved sounds:', error);
    }
  },

  addSoundToTimeline: async ({ sound }) => {
    const audioUrl = sound.previewUrl;
    if (!audioUrl) {
      toast.error(i18next.t('Sound file not available'));
      return false;
    }

    try {
      const editor = EditorCore.getInstance();
      const currentTime = editor.playback.getCurrentTime();

      const response = await fetch(audioUrl);
      if (!response.ok) throw new Error(`Failed to download audio: ${response.statusText}`);

      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new AudioContext();
      const buffer = await audioContext.decodeAudioData(arrayBuffer);

      const element = buildLibraryAudioElement({
        sourceUrl: audioUrl,
        name: sound.name,
        // 【时长真源 = 刚解码出来的 buffer（TD-22-47）】原用 `sound.duration`（第三方清单里的字段）；
        // 自建本地库的清单不含音频元数据（后端不读时长）→ 必须用解码结果的真实时长，
        // 否则入轨会得到一个 0 长的片段。此值对旧来源同样正确（解码结果即真相）。
        duration: buffer.duration,
        startTime: currentTime,
        buffer,
      });

      editor.timeline.insertElement({
        placement: { mode: 'auto', trackType: 'audio' },
        element,
      });
      return true;
    } catch (error) {
      logger.error('Failed to add sound to timeline:', error);
      toast.error(
        error instanceof Error ? error.message : i18next.t('Failed to add sound to timeline'),
        { id: `sound-${sound.id}` },
      );
      return false;
    }
  },
}));
