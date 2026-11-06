'use client';

import { Slider } from '@/components/videoEditor/ui/ui/slider';
import { Input } from '@/components/videoEditor/ui/ui/input';

import { PanelBaseView } from '@/components/videoEditor/ui/editor/panels/panel-base-view';
import { PropertyGroup, PropertyItem, PropertyItemLabel, PropertyItemValue } from './property-item';
import { ColorPicker } from '@/components/videoEditor/ui/ui/color-picker';
import { clamp } from '@/components/base/core/utils.ts';
import { useDraftCommit } from './use-draft-commit';
import { useElementUpdater } from './use-element-updater';
import { useTransformFields } from './use-transform-fields';
import type { StickerElement } from '@/components/videoEditor/types/timeline';

export function StickerProperties({
  _element: element,
  trackId,
}: {
  _element: StickerElement;
  trackId: string;
}) {
  const scalePercent = Math.round(element.transform.scale * 100);

  // 【2026-11-06】updateElement 10 行手抄体收口到 useElementUpdater（与 audio 面板共用）。
  const updateElement = useElementUpdater({ trackId, elementId: element.id });

  const updateTransform = ({
    updates,
    pushHistory = true,
  }: {
    updates: Partial<typeof element.transform>;
    pushHistory?: boolean;
  }) => {
    updateElement({
      updates: { transform: { ...element.transform, ...updates } },
      pushHistory,
    });
  };

  // 【TD-22-20 · 组④】位置 / 缩放 / 旋转 / 不透明度 / 颜色（6 个字段）——
  // 与 text / video 面板同一形态，统一走 `useDraftCommit`。
  // 原先这里的局部 `commitNumberField({draft, initial, apply})`：它只抽了"解析 + 清 initial"，
  // 两段提交仍写在**每个** `apply` 回调里（= 换了个写法的同一种手抄）⇒ 被 hook 取代后**删除**。
  //
  // 【2026-11-06 · 第三批字段工厂】变换四字段收口到 use-transform-fields.ts（三面板单源）；
  // 本面板保留 opacity / color 两字段（sticker 独有形态）。
  const { posXField, posYField, scaleField, rotationField } = useTransformFields({
    element,
    scalePercent,
    updateTransform: ({ updates, pushHistory = true }) =>
      updateTransform({ updates: updates as Partial<typeof element.transform>, pushHistory }),
  });

  /** 不透明度：percent 域（0~100），落库 /100（直接写 element 字段）。 */
  const opacityField = useDraftCommit<number>({
    value: Math.round(element.opacity * 100),
    format: (v) => v.toString(),
    parse: (raw) => {
      const parsed = parseInt(raw, 10);
      return Number.isNaN(parsed) ? null : clamp(parsed, 0, 100);
    },
    commit: (percent, pushHistory) =>
      updateElement({ updates: { opacity: percent / 100 }, pushHistory }),
  });

  const colorField = useDraftCommit<string>({
    value: element.color ?? '#000000',
    format: (v) => v,
    parse: (raw) => raw,
    commit: (color, pushHistory) => updateElement({ updates: { color }, pushHistory }),
  });

  return (
    <>
      <PanelBaseView>
        <PropertyGroup hasBorderTop={false}>
          {/*
            位置 X / Y —— **标签 + 窄框，横排在同一行**（与 text / video 面板同一形态）。
            `flex-1` + 撑满的输入框会把每个框做到 130px+ 去装 -20~20 的数字，
            宽度全空着，还和同面板的缩放/旋转（48px）成了两种尺寸。
          */}
          <div className="flex items-center gap-4">
            <PropertyItem className="flex-1">
              <PropertyItemLabel>{'位置 X'}</PropertyItemLabel>
              <PropertyItemValue>
                <Input
                  type="number"
                  value={posXField.display}
                  onFocus={posXField.onFocus}
                  onChange={(event) => posXField.onChange(event.target.value)}
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
                  onChange={(event) => posYField.onChange(event.target.value)}
                  onBlur={posYField.onBlur}
                  className="ve-num w-12"
                />
              </PropertyItemValue>
            </PropertyItem>
          </div>

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
                  onChange={(event) => scaleField.onChange(event.target.value)}
                  onBlur={scaleField.onBlur}
                  className="ve-num w-12"
                />
              </div>
            </PropertyItemValue>
          </PropertyItem>

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
                  onChange={(event) => rotationField.onChange(event.target.value)}
                  onBlur={rotationField.onBlur}
                  className="ve-num w-12"
                />
              </div>
            </PropertyItemValue>
          </PropertyItem>
        </PropertyGroup>

        <PropertyGroup hasBorderTop>
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
                  onChange={(event) => opacityField.onChange(event.target.value)}
                  onBlur={opacityField.onBlur}
                  className="ve-num w-12"
                />
              </div>
            </PropertyItemValue>
          </PropertyItem>

          <PropertyItem>
            <PropertyItemLabel>{'颜色'}</PropertyItemLabel>
            <PropertyItemValue>
              <ColorPicker
                value={element.color ?? '#000000'}
                // ⚠️ 写回必须补 `#`：ColorPicker 契约是不带 `#` 的 hex，
                // 而全仓颜色存储（text.color / stroke / shadow / background）一律带 `#`。
                // 曾原样写回 → sticker.color 变成 'ff0000'，同一字段两种格式
                // （渲染 URL 与存储脱节，靠显示端的 normalizeHex 容错掩盖）。
                onChange={(value) => colorField.onSliderChange(`#${value}`)}
                onChangeEnd={(value) => colorField.onSliderCommit(`#${value}`)}
              />
            </PropertyItemValue>
          </PropertyItem>
        </PropertyGroup>
      </PanelBaseView>
    </>
  );
}
