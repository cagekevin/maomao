'use client';

import { Slider } from '@videoEditor/ui/ui/slider';
import { Input } from '@videoEditor/ui/ui/input';
import { Button } from '@videoEditor/ui/ui/button';
import { Minus, Plus } from 'lucide-react';
import { useReducer, useRef } from 'react';

import { PanelBaseView } from '@videoEditor/ui/editor/panels/panel-base-view';
import { PropertyGroup, PropertyItem, PropertyItemLabel, PropertyItemValue } from './property-item';
import { clamp } from '@videoEditor/utils/math';
import { useEditor } from '@videoEditor/hooks-cutia/use-editor';
import type { AudioElement } from '@videoEditor/types/timeline';
import {
  MAX_PLAYBACK_RATE,
  MIN_PLAYBACK_RATE,
  PLAYBACK_RATE_STEP,
  clampPlaybackRate,
  formatSpeedLabel,
  stepPlaybackRate,
} from '@videoEditor/engine/timeline/speed-utils';

export function AudioProperties({
  _element: element,
  trackId,
}: {
  _element: AudioElement;
  trackId: string;
}) {
  const editor = useEditor();
  const [, forceRender] = useReducer((x: number) => x + 1, 0);

  const isEditingVolume = useRef(false);
  const isEditingSpeed = useRef(false);

  const volumeDraft = useRef('');
  const speedDraft = useRef('');

  const initialVolumeRef = useRef<number | null>(null);
  const initialSpeedRef = useRef<number | null>(null);

  const volumePercent = Math.round(element.volume * 100);
  const volumeDisplay = isEditingVolume.current ? volumeDraft.current : volumePercent.toString();

  const currentSpeed = element.playbackRate ?? 1;
  const speedDisplay = isEditingSpeed.current
    ? speedDraft.current
    : formatSpeedLabel({ rate: currentSpeed });

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

  return (
    <div className="flex h-full flex-col">
      <PanelBaseView className="p-0">
        <PropertyGroup hasBorderTop={false}>
          <PropertyItem direction="column">
            <PropertyItemLabel>{'音量'}</PropertyItemLabel>
            <PropertyItemValue>
              <div className="flex items-center gap-2">
                <Slider
                  value={[volumePercent]}
                  min={0}
                  max={200}
                  step={1}
                  onValueChange={([value]) => {
                    if (initialVolumeRef.current === null) {
                      initialVolumeRef.current = element.volume;
                    }
                    updateElement({
                      updates: { volume: value / 100 },
                      pushHistory: false,
                    });
                  }}
                  onValueCommit={([value]) => {
                    if (initialVolumeRef.current !== null) {
                      updateElement({
                        updates: { volume: initialVolumeRef.current },
                        pushHistory: false,
                      });
                      updateElement({
                        updates: { volume: value / 100 },
                        pushHistory: true,
                      });
                      initialVolumeRef.current = null;
                    }
                  }}
                  className="w-full"
                />
                <Input
                  type="number"
                  value={volumeDisplay}
                  min={0}
                  max={200}
                  onFocus={() => {
                    isEditingVolume.current = true;
                    volumeDraft.current = volumePercent.toString();
                    forceRender();
                  }}
                  onChange={(event) => {
                    volumeDraft.current = event.target.value;
                    forceRender();
                    if (initialVolumeRef.current === null) {
                      initialVolumeRef.current = element.volume;
                    }
                    const parsed = Number.parseInt(event.target.value, 10);
                    if (!Number.isNaN(parsed)) {
                      const clamped = clamp({ value: parsed, min: 0, max: 200 });
                      updateElement({
                        updates: { volume: clamped / 100 },
                        pushHistory: false,
                      });
                    }
                  }}
                  onBlur={() => {
                    if (initialVolumeRef.current !== null) {
                      const parsed = Number.parseInt(volumeDraft.current, 10);
                      const clamped = Number.isNaN(parsed)
                        ? volumePercent
                        : clamp({ value: parsed, min: 0, max: 200 });
                      updateElement({
                        updates: { volume: initialVolumeRef.current },
                        pushHistory: false,
                      });
                      updateElement({
                        updates: { volume: clamped / 100 },
                        pushHistory: true,
                      });
                      initialVolumeRef.current = null;
                    }
                    isEditingVolume.current = false;
                    volumeDraft.current = '';
                    forceRender();
                  }}
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
                    initialSpeedRef.current = currentSpeed;
                    applySpeedChange({
                      newRate: stepPlaybackRate({ rate: currentSpeed, delta: -1 }),
                      pushHistory: true,
                    });
                    initialSpeedRef.current = null;
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
                  onValueChange={([value]) => {
                    if (initialSpeedRef.current === null) {
                      initialSpeedRef.current = currentSpeed;
                    }
                    applySpeedChange({
                      newRate: clampPlaybackRate({ value }),
                      pushHistory: false,
                    });
                  }}
                  onValueCommit={([value]) => {
                    if (initialSpeedRef.current !== null) {
                      applySpeedChange({
                        newRate: initialSpeedRef.current,
                        pushHistory: false,
                      });
                      applySpeedChange({
                        newRate: clampPlaybackRate({ value }),
                        pushHistory: true,
                      });
                      initialSpeedRef.current = null;
                    }
                  }}
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
                    initialSpeedRef.current = currentSpeed;
                    applySpeedChange({
                      newRate: stepPlaybackRate({ rate: currentSpeed, delta: 1 }),
                      pushHistory: true,
                    });
                    initialSpeedRef.current = null;
                  }}
                  className="ve-act-btn"
                >
                  <Plus />
                </Button>
                <Input
                  type="number"
                  value={speedDisplay}
                  min={MIN_PLAYBACK_RATE}
                  max={MAX_PLAYBACK_RATE}
                  step={PLAYBACK_RATE_STEP}
                  onFocus={() => {
                    isEditingSpeed.current = true;
                    speedDraft.current = formatSpeedLabel({ rate: currentSpeed });
                    forceRender();
                  }}
                  onChange={(event) => {
                    speedDraft.current = event.target.value;
                    forceRender();
                    if (initialSpeedRef.current === null) {
                      initialSpeedRef.current = currentSpeed;
                    }
                    const parsed = Number.parseFloat(event.target.value);
                    if (!Number.isNaN(parsed)) {
                      applySpeedChange({
                        newRate: clampPlaybackRate({ value: parsed }),
                        pushHistory: false,
                      });
                    }
                  }}
                  onBlur={() => {
                    if (initialSpeedRef.current !== null) {
                      const parsed = Number.parseFloat(speedDraft.current);
                      const next = Number.isNaN(parsed)
                        ? currentSpeed
                        : clampPlaybackRate({ value: parsed });
                      applySpeedChange({
                        newRate: initialSpeedRef.current,
                        pushHistory: false,
                      });
                      applySpeedChange({
                        newRate: next,
                        pushHistory: true,
                      });
                      initialSpeedRef.current = null;
                    }
                    isEditingSpeed.current = false;
                    speedDraft.current = '';
                    forceRender();
                  }}
                  className="ve-num w-12"
                />
                <span className="text-muted-foreground text-xs">x</span>
              </div>
            </PropertyItemValue>
          </PropertyItem>
        </PropertyGroup>
      </PanelBaseView>
    </div>
  );
}
