'use client';

import { Slider } from '@/components/videoEditor/ui/ui/slider';
import { Input } from '@/components/videoEditor/ui/ui/input';
import { Button } from '@/components/videoEditor/ui/ui/button';
import { Minus, Plus } from 'lucide-react';
import { useReducer, useRef } from 'react';

import { PanelBaseView } from '@/components/videoEditor/ui/editor/panels/panel-base-view';
import { PropertyGroup, PropertyItem, PropertyItemLabel, PropertyItemValue } from './property-item';
import { clamp } from '@/components/videoEditor/utils/math';
import { useEditor } from '@/components/videoEditor/hooks-cutia/use-editor';
import type { ImageElement, VideoElement } from '@/components/videoEditor/types/timeline';
import {
  MAX_PLAYBACK_RATE,
  MIN_PLAYBACK_RATE,
  PLAYBACK_RATE_STEP,
  clampPlaybackRate,
  formatSpeedLabel,
  stepPlaybackRate,
} from '@/components/videoEditor/engine/timeline/speed-utils';

export function VideoProperties({
  _element: element,
  trackId,
}: {
  _element: VideoElement | ImageElement;
  trackId: string;
}) {
  const editor = useEditor();
  const [, forceRender] = useReducer((x: number) => x + 1, 0);

  const isEditingScale = useRef(false);
  const isEditingPosX = useRef(false);
  const isEditingPosY = useRef(false);
  const isEditingRotation = useRef(false);
  const isEditingOpacity = useRef(false);
  const isEditingSpeed = useRef(false);

  const scaleDraft = useRef('');
  const posXDraft = useRef('');
  const posYDraft = useRef('');
  const rotationDraft = useRef('');
  const opacityDraft = useRef('');
  const speedDraft = useRef('');

  const initialScaleRef = useRef<number | null>(null);
  const initialPosXRef = useRef<number | null>(null);
  const initialPosYRef = useRef<number | null>(null);
  const initialRotationRef = useRef<number | null>(null);
  const initialOpacityRef = useRef<number | null>(null);
  const initialSpeedRef = useRef<number | null>(null);

  const scalePercent = Math.round(element.transform.scale * 100);
  const scaleDisplay = isEditingScale.current ? scaleDraft.current : scalePercent.toString();
  const posXDisplay = isEditingPosX.current
    ? posXDraft.current
    : Math.round(element.transform.position.x).toString();
  const posYDisplay = isEditingPosY.current
    ? posYDraft.current
    : Math.round(element.transform.position.y).toString();
  const rotationDisplay = isEditingRotation.current
    ? rotationDraft.current
    : Math.round(element.transform.rotate).toString();
  const opacityDisplay = isEditingOpacity.current
    ? opacityDraft.current
    : Math.round(element.opacity * 100).toString();

  const isVideoElement = element.type === 'video';
  const currentSpeed = isVideoElement ? ((element as VideoElement).playbackRate ?? 1) : 1;
  const speedDisplay = isEditingSpeed.current
    ? speedDraft.current
    : formatSpeedLabel({ rate: currentSpeed });

  const applySpeedChange = ({
    newRate,
    pushHistory,
  }: {
    newRate: number;
    pushHistory: boolean;
  }) => {
    if (!isVideoElement) return;
    const oldRate = currentSpeed;
    const newDuration = element.duration * (oldRate / newRate);

    editor.timeline.updateElements({
      updates: [
        {
          trackId,
          elementId: element.id,
          updates: {
            playbackRate: newRate,
            duration: newDuration,
          },
        },
      ],
      pushHistory,
    });
  };

  const updateTransform = ({
    updates,
    pushHistory = true,
  }: {
    updates: Partial<typeof element.transform>;
    pushHistory?: boolean;
  }) => {
    editor.timeline.updateElements({
      updates: [
        {
          trackId,
          elementId: element.id,
          updates: {
            transform: { ...element.transform, ...updates },
          },
        },
      ],
      pushHistory,
    });
  };

  const commitNumberField = ({
    draft,
    initial,
    apply,
  }: {
    draft: string;
    initial: React.RefObject<number | null>;
    apply: (value: number) => void;
  }) => {
    if (initial.current === null) return;
    const parsed = Number.parseFloat(draft);
    if (!Number.isNaN(parsed)) {
      apply(parsed);
    }
    initial.current = null;
  };

  return (
    <>
      <PanelBaseView>
        <PropertyGroup hasBorderTop={false}>
          {/*
            位置 X / Y —— **标签 + 窄框，横排在同一行**（与 text / sticker 面板同一形态）。
            【为什么不并排两个"撑满"的输入框】`flex-1` 会把每个框撑到 130px+，
            去装一个 -20~20 的数字 —— 宽度全是空的；而且它和同面板的缩放/旋转（48px）
            成了两种尺寸：同一类控件、同一个面板，尺寸不一致说不过去。
          */}
          <div className="flex items-center gap-4">
            <PropertyItem className="flex-1">
              <PropertyItemLabel>{'位置 X'}</PropertyItemLabel>
              <PropertyItemValue>
                <Input
                  type="number"
                  value={posXDisplay}
                  onFocus={() => {
                    isEditingPosX.current = true;
                    posXDraft.current = Math.round(element.transform.position.x).toString();
                    forceRender();
                  }}
                  onChange={(e) => {
                    posXDraft.current = e.target.value;
                    forceRender();
                    if (initialPosXRef.current === null) {
                      initialPosXRef.current = element.transform.position.x;
                    }
                    const parsed = Number.parseFloat(e.target.value);
                    if (!Number.isNaN(parsed)) {
                      updateTransform({
                        updates: { position: { ...element.transform.position, x: parsed } },
                        pushHistory: false,
                      });
                    }
                  }}
                  onBlur={() => {
                    commitNumberField({
                      draft: posXDraft.current,
                      initial: initialPosXRef,
                      apply: (value) => {
                        updateTransform({
                          updates: {
                            position: {
                              ...element.transform.position,
                              x: initialPosXRef.current ?? 0,
                            },
                          },
                          pushHistory: false,
                        });
                        updateTransform({
                          updates: { position: { ...element.transform.position, x: value } },
                          pushHistory: true,
                        });
                      },
                    });
                    isEditingPosX.current = false;
                    posXDraft.current = '';
                    forceRender();
                  }}
                  className="ve-num w-12"
                />
              </PropertyItemValue>
            </PropertyItem>
            <PropertyItem className="flex-1">
              <PropertyItemLabel>{'位置 Y'}</PropertyItemLabel>
              <PropertyItemValue>
                <Input
                  type="number"
                  value={posYDisplay}
                  onFocus={() => {
                    isEditingPosY.current = true;
                    posYDraft.current = Math.round(element.transform.position.y).toString();
                    forceRender();
                  }}
                  onChange={(e) => {
                    posYDraft.current = e.target.value;
                    forceRender();
                    if (initialPosYRef.current === null) {
                      initialPosYRef.current = element.transform.position.y;
                    }
                    const parsed = Number.parseFloat(e.target.value);
                    if (!Number.isNaN(parsed)) {
                      updateTransform({
                        updates: { position: { ...element.transform.position, y: parsed } },
                        pushHistory: false,
                      });
                    }
                  }}
                  onBlur={() => {
                    commitNumberField({
                      draft: posYDraft.current,
                      initial: initialPosYRef,
                      apply: (value) => {
                        updateTransform({
                          updates: {
                            position: {
                              ...element.transform.position,
                              y: initialPosYRef.current ?? 0,
                            },
                          },
                          pushHistory: false,
                        });
                        updateTransform({
                          updates: { position: { ...element.transform.position, y: value } },
                          pushHistory: true,
                        });
                      },
                    });
                    isEditingPosY.current = false;
                    posYDraft.current = '';
                    forceRender();
                  }}
                  className="ve-num w-12"
                />
              </PropertyItemValue>
            </PropertyItem>
          </div>

          {/* Scale */}
          <PropertyItem>
            <PropertyItemLabel>{'缩放'}</PropertyItemLabel>
            <PropertyItemValue>
              <div className="flex items-center gap-2">
                <Slider
                  value={[scalePercent]}
                  min={10}
                  max={500}
                  step={1}
                  onValueChange={([value]) => {
                    if (initialScaleRef.current === null) {
                      initialScaleRef.current = element.transform.scale;
                    }
                    updateTransform({
                      updates: { scale: value / 100 },
                      pushHistory: false,
                    });
                  }}
                  onValueCommit={([value]) => {
                    if (initialScaleRef.current !== null) {
                      updateTransform({
                        updates: { scale: initialScaleRef.current },
                        pushHistory: false,
                      });
                      updateTransform({
                        updates: { scale: value / 100 },
                        pushHistory: true,
                      });
                      initialScaleRef.current = null;
                    }
                  }}
                  className="w-full"
                />
                <Input
                  type="number"
                  value={scaleDisplay}
                  min={10}
                  max={500}
                  onFocus={() => {
                    isEditingScale.current = true;
                    scaleDraft.current = scalePercent.toString();
                    forceRender();
                  }}
                  onChange={(e) => {
                    scaleDraft.current = e.target.value;
                    forceRender();
                    if (initialScaleRef.current === null) {
                      initialScaleRef.current = element.transform.scale;
                    }
                    const parsed = parseInt(e.target.value, 10);
                    if (!Number.isNaN(parsed)) {
                      const clamped = clamp({ value: parsed, min: 10, max: 500 });
                      updateTransform({
                        updates: { scale: clamped / 100 },
                        pushHistory: false,
                      });
                    }
                  }}
                  onBlur={() => {
                    if (initialScaleRef.current !== null) {
                      const parsed = parseInt(scaleDraft.current, 10);
                      const clamped = Number.isNaN(parsed)
                        ? scalePercent
                        : clamp({ value: parsed, min: 10, max: 500 });
                      updateTransform({
                        updates: { scale: initialScaleRef.current },
                        pushHistory: false,
                      });
                      updateTransform({
                        updates: { scale: clamped / 100 },
                        pushHistory: true,
                      });
                      initialScaleRef.current = null;
                    }
                    isEditingScale.current = false;
                    scaleDraft.current = '';
                    forceRender();
                  }}
                  className="ve-num w-12"
                />
              </div>
            </PropertyItemValue>
          </PropertyItem>

          {/* Rotation */}
          <PropertyItem>
            <PropertyItemLabel>{'旋转'}</PropertyItemLabel>
            <PropertyItemValue>
              <div className="flex items-center gap-2">
                <Slider
                  value={[element.transform.rotate]}
                  min={-180}
                  max={180}
                  step={1}
                  onValueChange={([value]) => {
                    if (initialRotationRef.current === null) {
                      initialRotationRef.current = element.transform.rotate;
                    }
                    updateTransform({
                      updates: { rotate: value },
                      pushHistory: false,
                    });
                  }}
                  onValueCommit={([value]) => {
                    if (initialRotationRef.current !== null) {
                      updateTransform({
                        updates: { rotate: initialRotationRef.current },
                        pushHistory: false,
                      });
                      updateTransform({
                        updates: { rotate: value },
                        pushHistory: true,
                      });
                      initialRotationRef.current = null;
                    }
                  }}
                  className="w-full"
                />
                <Input
                  type="number"
                  value={rotationDisplay}
                  min={-360}
                  max={360}
                  onFocus={() => {
                    isEditingRotation.current = true;
                    rotationDraft.current = Math.round(element.transform.rotate).toString();
                    forceRender();
                  }}
                  onChange={(e) => {
                    rotationDraft.current = e.target.value;
                    forceRender();
                    if (initialRotationRef.current === null) {
                      initialRotationRef.current = element.transform.rotate;
                    }
                    const parsed = Number.parseFloat(e.target.value);
                    if (!Number.isNaN(parsed)) {
                      updateTransform({
                        updates: { rotate: parsed },
                        pushHistory: false,
                      });
                    }
                  }}
                  onBlur={() => {
                    commitNumberField({
                      draft: rotationDraft.current,
                      initial: initialRotationRef,
                      apply: (value) => {
                        updateTransform({
                          updates: { rotate: initialRotationRef.current ?? 0 },
                          pushHistory: false,
                        });
                        updateTransform({
                          updates: { rotate: value },
                          pushHistory: true,
                        });
                      },
                    });
                    isEditingRotation.current = false;
                    rotationDraft.current = '';
                    forceRender();
                  }}
                  className="ve-num w-12"
                />
              </div>
            </PropertyItemValue>
          </PropertyItem>
        </PropertyGroup>

        <PropertyGroup hasBorderTop>
          {/* Opacity */}
          <PropertyItem>
            <PropertyItemLabel>{'不透明度'}</PropertyItemLabel>
            <PropertyItemValue>
              <div className="flex items-center gap-2">
                <Slider
                  value={[element.opacity * 100]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([value]) => {
                    if (initialOpacityRef.current === null) {
                      initialOpacityRef.current = element.opacity;
                    }
                    editor.timeline.updateElements({
                      updates: [
                        {
                          trackId,
                          elementId: element.id,
                          updates: { opacity: value / 100 },
                        },
                      ],
                      pushHistory: false,
                    });
                  }}
                  onValueCommit={([value]) => {
                    if (initialOpacityRef.current !== null) {
                      editor.timeline.updateElements({
                        updates: [
                          {
                            trackId,
                            elementId: element.id,
                            updates: { opacity: initialOpacityRef.current },
                          },
                        ],
                        pushHistory: false,
                      });
                      editor.timeline.updateElements({
                        updates: [
                          {
                            trackId,
                            elementId: element.id,
                            updates: { opacity: value / 100 },
                          },
                        ],
                        pushHistory: true,
                      });
                      initialOpacityRef.current = null;
                    }
                  }}
                  className="w-full"
                />
                <Input
                  type="number"
                  value={opacityDisplay}
                  min={0}
                  max={100}
                  onFocus={() => {
                    isEditingOpacity.current = true;
                    opacityDraft.current = Math.round(element.opacity * 100).toString();
                    forceRender();
                  }}
                  onChange={(e) => {
                    opacityDraft.current = e.target.value;
                    forceRender();
                    if (initialOpacityRef.current === null) {
                      initialOpacityRef.current = element.opacity;
                    }
                    const parsed = parseInt(e.target.value, 10);
                    if (!Number.isNaN(parsed)) {
                      const opacityPercent = clamp({ value: parsed, min: 0, max: 100 });
                      editor.timeline.updateElements({
                        updates: [
                          {
                            trackId,
                            elementId: element.id,
                            updates: { opacity: opacityPercent / 100 },
                          },
                        ],
                        pushHistory: false,
                      });
                    }
                  }}
                  onBlur={() => {
                    if (initialOpacityRef.current !== null) {
                      const parsed = parseInt(opacityDraft.current, 10);
                      const opacityPercent = Number.isNaN(parsed)
                        ? Math.round(element.opacity * 100)
                        : clamp({ value: parsed, min: 0, max: 100 });
                      editor.timeline.updateElements({
                        updates: [
                          {
                            trackId,
                            elementId: element.id,
                            updates: { opacity: initialOpacityRef.current },
                          },
                        ],
                        pushHistory: false,
                      });
                      editor.timeline.updateElements({
                        updates: [
                          {
                            trackId,
                            elementId: element.id,
                            updates: { opacity: opacityPercent / 100 },
                          },
                        ],
                        pushHistory: true,
                      });
                      initialOpacityRef.current = null;
                    }
                    isEditingOpacity.current = false;
                    opacityDraft.current = '';
                    forceRender();
                  }}
                  className="ve-num w-12"
                />
              </div>
            </PropertyItemValue>
          </PropertyItem>
        </PropertyGroup>

        {isVideoElement && (
          <PropertyGroup hasBorderTop>
            {/*
                【播放速度（2026-09-15 用户裁定）】
                · 删掉原来那一排预设按钮（0.25x / 0.5x / … / 4x）——用户："不要那些 0.25、0.5、1 倍之类的东西"；
                · 滑杆改为**直接绑速度值**（`min/max/step` = 0.25 / 4 / 0.1），
                  弃用旧的 log₂ 位置映射 —— 那个映射让步进不均匀（低速 0.01 / 高速 0.1），
                  与用户"每一次调整的幅度都是 0.1"的要求冲突；
                · 加 ± 两个按钮，每次正好一步（`PLAYBACK_RATE_STEP`，不在组件里写 0.1 字面量）；
                · 数字输入框保留（能直接键入精确值），步进同步为 0.1。
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
                  {/* 数字输入框与滑杆**同一行**（原来它在下面单独一行、label 叫「自定义」——
                        现在滑杆与输入框表达同一件事，拆两行反而割裂）。 */}
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
        )}
      </PanelBaseView>
    </>
  );
}
