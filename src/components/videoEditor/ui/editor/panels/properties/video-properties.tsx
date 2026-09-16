'use client';

import { Slider } from '@/components/videoEditor/ui/ui/slider';
import { Input } from '@/components/videoEditor/ui/ui/input';
import { Button } from '@/components/videoEditor/ui/ui/button';
import { Minus, Plus } from 'lucide-react';

import { PanelBaseView } from '@/components/videoEditor/ui/editor/panels/panel-base-view';
import { PropertyGroup, PropertyItem, PropertyItemLabel, PropertyItemValue } from './property-item';
import { clamp } from '@/components/videoEditor/utils/math';
import { useEditor } from '@/components/videoEditor/hooks-cutia/use-editor';
import { useDraftCommit } from './use-draft-commit';
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

  const scalePercent = Math.round(element.transform.scale * 100);

  const isVideoElement = element.type === 'video';
  const currentSpeed = isVideoElement ? ((element as VideoElement).playbackRate ?? 1) : 1;

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

  // 【TD-22-20 · 组③】位置 / 缩放 / 旋转 / 不透明度（5 个字段）——
  // 与 text 面板同一形态，统一走 `useDraftCommit`，不再逐处手抄 refs/handler。
  // 原先这里有个局部 `commitNumberField({draft, initial, apply})`（把"解析 + 清 initial"
  // 抽成小函数、两段提交仍写在每个 `apply` 回调里）—— 现已被 hook 取代并**删除**。
  //
  // 注：`commit` 闭包在**事件里**才求值，故此处引用上面刚定义的 `updateTransform` 是安全的。
  /** 位置 X：`value` 存**未取整**原始值（与手抄一致），仅显示取整。 */
  const posXField = useDraftCommit<number>({
    value: element.transform.position.x,
    format: (v) => Math.round(v).toString(),
    parse: (raw) => {
      const parsed = Number.parseFloat(raw);
      return Number.isNaN(parsed) ? null : parsed;
    },
    commit: (x, pushHistory) =>
      updateTransform({
        updates: { position: { ...element.transform.position, x } },
        pushHistory,
      }),
  });

  const posYField = useDraftCommit<number>({
    value: element.transform.position.y,
    format: (v) => Math.round(v).toString(),
    parse: (raw) => {
      const parsed = Number.parseFloat(raw);
      return Number.isNaN(parsed) ? null : parsed;
    },
    commit: (y, pushHistory) =>
      updateTransform({
        updates: { position: { ...element.transform.position, y } },
        pushHistory,
      }),
  });

  /** 缩放：percent 域（10~500），落库 /100。 */
  const scaleField = useDraftCommit<number>({
    value: scalePercent,
    format: (v) => v.toString(),
    parse: (raw) => {
      const parsed = parseInt(raw, 10);
      return Number.isNaN(parsed) ? null : clamp({ value: parsed, min: 10, max: 500 });
    },
    commit: (percent, pushHistory) =>
      updateTransform({ updates: { scale: percent / 100 }, pushHistory }),
  });

  /** 旋转：`value` 存未取整原始值。 */
  const rotationField = useDraftCommit<number>({
    value: element.transform.rotate,
    format: (v) => Math.round(v).toString(),
    parse: (raw) => {
      const parsed = Number.parseFloat(raw);
      return Number.isNaN(parsed) ? null : parsed;
    },
    commit: (rotate, pushHistory) => updateTransform({ updates: { rotate }, pushHistory }),
  });

  /** 不透明度：percent 域（0~100），落库 /100（本面板直接写 element 字段，不经 transform）。 */
  const opacityField = useDraftCommit<number>({
    value: Math.round(element.opacity * 100),
    format: (v) => v.toString(),
    parse: (raw) => {
      const parsed = parseInt(raw, 10);
      return Number.isNaN(parsed) ? null : clamp({ value: parsed, min: 0, max: 100 });
    },
    commit: (percent, pushHistory) =>
      editor.timeline.updateElements({
        updates: [{ trackId, elementId: element.id, updates: { opacity: percent / 100 } }],
        pushHistory,
      }),
  });

  /**
   * 变速（video 专属）：`value` 是倍率域（0.25~4），解析后经 `clampPlaybackRate` 夹取；
   * 落库走 `applySpeedChange`（它同时按倍率换算 `duration`）。
   * 「±」按钮是**立即生效的一步变速**（不走本 hook 的编辑会话）—— 它们原先在点击时
   * 写 `initialSpeedRef.current = …` 又立刻清空，但 `applySpeedChange` **根本不读**那个 ref
   * ⇒ 那两行是**无操作**（死代码），随本次迁移一并删除。
   */
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
                  value={posXField.display}
                  onFocus={posXField.onFocus}
                  onChange={(e) => posXField.onChange(e.target.value)}
                  onBlur={posXField.onBlur}
                  className="ve-num w-12"
                />
              </PropertyItemValue>
            </PropertyItem>
            <PropertyItem className="flex-1">
              <PropertyItemLabel>{'位置 Y'}</PropertyItemLabel>
              <PropertyItemValue>
                <Input
                  type="number"
                  value={posYField.display}
                  onFocus={posYField.onFocus}
                  onChange={(e) => posYField.onChange(e.target.value)}
                  onBlur={posYField.onBlur}
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
                  onValueChange={([value]) => scaleField.onSliderChange(value)}
                  onValueCommit={([value]) => scaleField.onSliderCommit(value)}
                  className="w-full"
                />
                <Input
                  type="number"
                  value={scaleField.display}
                  min={10}
                  max={500}
                  onFocus={scaleField.onFocus}
                  onChange={(e) => scaleField.onChange(e.target.value)}
                  onBlur={scaleField.onBlur}
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
                  onValueChange={([value]) => rotationField.onSliderChange(value)}
                  onValueCommit={([value]) => rotationField.onSliderCommit(value)}
                  className="w-full"
                />
                <Input
                  type="number"
                  value={rotationField.display}
                  min={-360}
                  max={360}
                  onFocus={rotationField.onFocus}
                  onChange={(e) => rotationField.onChange(e.target.value)}
                  onBlur={rotationField.onBlur}
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
                  onValueChange={([value]) => opacityField.onSliderChange(value)}
                  onValueCommit={([value]) => opacityField.onSliderCommit(value)}
                  className="w-full"
                />
                <Input
                  type="number"
                  value={opacityField.display}
                  min={0}
                  max={100}
                  onFocus={opacityField.onFocus}
                  onChange={(e) => opacityField.onChange(e.target.value)}
                  onBlur={opacityField.onBlur}
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
                  {/* 数字输入框与滑杆**同一行**（原来它在下面单独一行、label 叫「自定义」——
                        现在滑杆与输入框表达同一件事，拆两行反而割裂）。 */}
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
        )}
      </PanelBaseView>
    </>
  );
}
