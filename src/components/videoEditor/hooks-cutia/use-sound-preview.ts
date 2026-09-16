import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/components/videoEditor/lib/logger';
import type { SoundEffect } from '@/components/videoEditor/types/sounds';

type PreviewableSound = Pick<SoundEffect, 'id' | 'previewUrl'>;

export interface SoundPreview {
  /** 正在试听的音效 id（`null` = 没有）。 */
  playingId: number | null;
  /** 点同一条 = 停止；点别的 = 换一条（原语义）。 */
  toggle: (params: { sound: PreviewableSound }) => void;
}

/**
 * 音效试听 —— **唯一拥有者**：创建 / 替换 / 停止 / **卸载释放**。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么必须收口（TD-22-42）】`sounds.tsx` 原先在 `SoundEffectsView` 与 `SavedSoundsView`
 * 里各抄了一份**逐字相同**的 `playSound`（`new Audio` + `ended`/`error` 监听 + `play().catch`），
 * 且**两份都漏了卸载清理** —— 后果：
 *   · 切 Tab / 关素材面板 / 退出编辑器时试听音**继续播到自然结束**；
 *   · `audioElement` 随组件销毁，引用丢失 → 用户**永远停不掉**（只能等它播完或静音系统）。
 * 抄两份不是巧合：**「谁拥有这个 audio」这件事没有落点**，于是每处各建一个、各忘一次。
 * 本 hook 就是那个落点：从「创建」到「释放」全部在一个生命周期里闭环。
 * ════════════════════════════════════════════════════════════════
 *
 * 【两处细节，都是行为契约，勿简化】
 *   ① 卸载 cleanup **只 pause、不 setState** —— 组件已卸载，setState 无意义；
 *   ② `ended`/`error`/失败回调**按 id 判等再清**：快速切歌时旧元素的回调不得清掉
 *      **新**元素的播放态（原实现无条件 `setPlayingId(null)`，存在这个时序窗口）。
 */
export function useSoundPreview(): SoundPreview {
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** 与 `playingId` 同值的 ref：回调里判等用（state 在闭包里会过期）。 */
  const playingIdRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    playingIdRef.current = null;
    setPlayingId(null);
  }, []);

  // ── 卸载即释放（TD-22-42 的正面）：切 Tab / 关面板 / 退出编辑器都会走到这里。
  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
      playingIdRef.current = null;
    },
    [],
  );

  const toggle = useCallback(
    ({ sound }: { sound: PreviewableSound }) => {
      // 再点同一条 = 停止。
      if (playingIdRef.current === sound.id) {
        stop();
        return;
      }

      stop();
      if (!sound.previewUrl) return;

      const soundId = sound.id;
      const audio = new Audio(sound.previewUrl);
      const settle = () => {
        // 判等：这条音频已经不是我当前在播的那条 → 不动状态（否则会清掉新歌的播放态）。
        if (playingIdRef.current !== soundId) return;
        audioRef.current = null;
        playingIdRef.current = null;
        setPlayingId(null);
      };
      audio.addEventListener('ended', settle);
      audio.addEventListener('error', settle);
      audio.play().catch((error: DOMException) => {
        // 用户切歌/停止造成的正常中断，不是错误（保持原口径）。
        if (error.name === 'AbortError') return;
        logger.error('Failed to play sound preview:', error);
        settle();
      });

      audioRef.current = audio;
      playingIdRef.current = soundId;
      setPlayingId(soundId);
    },
    [stop],
  );

  return { playingId, toggle };
}
