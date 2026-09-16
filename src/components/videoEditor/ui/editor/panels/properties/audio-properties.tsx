'use client';

import { Slider } from '@/components/videoEditor/ui/ui/slider';
import { Input } from '@/components/videoEditor/ui/ui/input';
import { Button } from '@/components/videoEditor/ui/ui/button';
import { Minus, Plus } from 'lucide-react';

import { PanelBaseView } from '@/components/videoEditor/ui/editor/panels/panel-base-view';
import { PropertyGroup, PropertyItem, PropertyItemLabel, PropertyItemValue } from './property-item';
import { clamp } from '@/components/base/core/utils.ts';
import { useEditor } from '@/components/videoEditor/hooks-cutia/use-editor';
import { useDraftCommit } from './use-draft-commit';
import type { AudioElement } from '@/components/videoEditor/types/timeline';
import {
  MAX_PLAYBACK_RATE,
  MIN_PLAYBACK_RATE,
  PLAYBACK_RATE_STEP,
  clampPlaybackRate,
  formatSpeedLabel,
  stepPlaybackRate,
} from '@/components/videoEditor/engine/timeline/speed-utils';

export function AudioProperties({
  _element: element,
  trackId,
}: {
  _element: AudioElement;
  trackId: string;
}) {
  const editor = useEditor();

  const volumePercent = Math.round(element.volume * 100);

  const currentSpeed = element.playbackRate ?? 1;

  const updateElement = ({
    updates,
    pushHistory = true,
  }: {
    updates: Partial<Record<string, unknown>>;
    pushHistory?: boolean;
  }) => {
    editor.timeline.updateElements({
      updates: [{ trackId, elementId: element.id, updates }],
      pushHistory,
    });
  };

  const applySpeedChange = ({
    newRate,
    pushHistory,
  }: {
    newRate: number;
    pushHistory: boolean;
  }) => {
    const oldRate = currentSpeed;
    const newDuration = element.duration * (oldRate / newRate);

    updateElement({
      updates: { playbackRate: newRate, duration: newDuration },
      pushHistory,
    });
  };

  // 【TD-22-20 · 组④】音量 / 变速 —— 与 video 面板同一形态，统一走 `useDraftCommit`。
  /** 音量：percent 域（0~200），落库 /100。 */
  const volumeField = useDraftCommit<number>({
    value: volumePercent,
    format: (v) => v.toString(),
    parse: (raw) => {
      const parsed = parseInt(raw, 10);
      return Number.isNaN(parsed) ? null : clamp(parsed, 0, 200);
    },
    commit: (percent, pushHistory) =>
      updateElement({ updates: { volume: percent / 100 }, pushHistory }),
  });

  /** 变速：倍率域（0.25~4）；「±」按钮是**立即生效的一步变速**，不走本编辑会话。 */
  const speedField = useDraftCommit<number>({
    value: currentSpeed,
    format: (v) => formatSpeedLabel({ rate: v }),
    parse: (raw) => {
      const parsed = Number.parseFloat(raw);
      return Number.isNaN(parsed) ? null : clampPlaybackRate({ value: parsed });
    },
    commit: (newRate, pushHistory) => applySpeedChange({ newRate, pushHistory }),
  });

  return (
    <>
      <PanelBaseView>
        <PropertyGroup hasBorderTop={false}>
          <PropertyItem>
            <PropertyItemLabel>{'音量'}</PropertyItemLabel>
            <PropertyItemValue>
              <div className="flex items-center gap-2">
                <Slider
                  value={[volumePercent]}
                  min={0}
                  max={200}
                  step={1}
                  onValueChange={([value]) => volumeField.onSliderChange(value)}
                  onValueCommit={([value]) => volumeField.onSliderCommit(value)}
                  className="w-full"
                />
                <Input
                  type="number"
                  value={volumeField.display}
                  min={0}
                  max={200}
                  onFocus={volumeField.onFocus}
                  onChange={(event) => volumeField.onChange(event.target.value)}
                  onBlur={volumeField.onBlur}
                  className="ve-num w-12"
                />
              </div>
            </PropertyItemValue>
          </PropertyItem>
        </PropertyGroup>

        <PropertyGroup hasBorderTop>
          {/*
              【播放速度（2026-09-15 用户裁定）—— 与 `video-properties.tsx` 同一套】
              · 删掉预设按钮那一排（0.25x/0.5x/…/4x）；
              · 滑杆直接绑速度值（0.25 / 4 / step 0.1），弃用 log₂ 位置映射（它让步进不均匀）；
              · 加 ± 按钮，每次一步；数字输入框与滑杆同行。
              两处属性面板必须保持一致 —— 改动其一请同步另一个（判据/常量都在 `speed-utils.ts`）。
            */}
          <PropertyItem>
            <PropertyItemLabel>{'变速'}</PropertyItemLabel>
            <PropertyItemValue>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="text"
                  size="icon"
                  aria-label={'减小播放速度'}
                  title={`-${PLAYBACK_RATE_STEP}`}
                  disabled={currentSpeed <= MIN_PLAYBACK_RATE}
                  onClick={() => {
                    applySpeedChange({
                      newRate: stepPlaybackRate({ rate: currentSpeed, delta: -1 }),
                      pushHistory: true,
                    });
                  }}
                  className="ve-act-btn"
                >
                  <Minus />
                </Button>
                <Slider
                  value={[currentSpeed]}
                  min={MIN_PLAYBACK_RATE}
                  max={MAX_PLAYBACK_RATE}
                  step={PLAYBACK_RATE_STEP}
                  onValueChange={([value]) =>
                    speedField.onSliderChange(clampPlaybackRate({ value }))
                  }
                  onValueCommit={([value]) =>
                    speedField.onSliderCommit(clampPlaybackRate({ value }))
                  }
                  className="w-full"
                />
                <Button
                  type="button"
                  variant="text"
                  size="icon"
                  aria-label={'增大播放速度'}
                  title={`+${PLAYBACK_RATE_STEP}`}
                  disabled={currentSpeed >= MAX_PLAYBACK_RATE}
                  onClick={() => {
                    applySpeedChange({
                      newRate: stepPlaybackRate({ rate: currentSpeed, delta: 1 }),
                      pushHistory: true,
                    });
                  }}
                  className="ve-act-btn"
                >
                  <Plus />
                </Button>
                <Input
                  type="number"
                  value={speedField.display}
                  min={MIN_PLAYBACK_RATE}
                  max={MAX_PLAYBACK_RATE}
                  step={PLAYBACK_RATE_STEP}
                  onFocus={speedField.onFocus}
                  onChange={(event) => speedField.onChange(event.target.value)}
                  onBlur={speedField.onBlur}
                  className="ve-num w-12"
                />
                <span className="text-muted-foreground text-xs">x</span>
              </div>
            </PropertyItemValue>
          </PropertyItem>
        </PropertyGroup>
      </PanelBaseView>
    </>
  );
}
