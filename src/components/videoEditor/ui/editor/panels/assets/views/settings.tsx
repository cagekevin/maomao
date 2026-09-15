'use client';

import { memo, useCallback, useMemo, useState } from 'react';
import { PanelBaseView as BaseView } from '@videoEditor/ui/editor/panels/panel-base-view';
import { Input } from '@videoEditor/ui/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@videoEditor/ui/ui/select';
import {
  BLUR_INTENSITY_PRESETS,
  CANVAS_SIZE_PRESETS,
  DEFAULT_BLUR_INTENSITY,
  DEFAULT_COLOR,
  FPS_PRESETS,
} from '@videoEditor/constants/project-constants';
import { patternCraftGradients } from '@videoEditor/data/colors/pattern-craft';
import { colors } from '@videoEditor/data/colors/solid';
import { syntaxUIGradients } from '@videoEditor/data/colors/syntax-ui';
import { useEditor } from '@videoEditor/hooks-cutia/use-editor';
// 更新(2026-09-14)：AI providers 随 AI 域移除。
import { cn } from '@videoEditor/utils/ui';
import {
  PropertyGroup,
  PropertyItem,
  PropertyItemLabel,
  PropertyItemValue,
} from '@videoEditor/ui/editor/panels/properties/property-item';

export function SettingsView() {
  return <ProjectSettingsTabs />;
}

function ProjectSettingsTabs() {
  // 分区/滚动/内边距**全部**由壳（`PanelBaseView`）拥有 —— 这里只给出 tab 与其内容，
  // 不再包 `p-5` / `justify-between` / `flex-1`（那些是 2026-09-15 重写前"区块前空一截"的成因）。
  return (
    <BaseView
      defaultTab="project-info"
      tabs={[
        { value: 'project-info', label: '项目信息', content: <ProjectInfoView /> },
        { value: 'background', label: '背景', content: <BackgroundView /> },
        /* 更新(2026-09-14)：AI 设置 tab 随 AI 域移除（docs/130-cutia搬迁计划书）。 */
      ]}
    />
  );
}

const CANVAS_FIT_VALUE = 'fit';
const CANVAS_CUSTOM_VALUE = 'custom';

export function resolveCanvasSizePresetValue({
  width,
  height,
  originalCanvasSize,
  customSelected = false,
}: {
  width: number;
  height: number;
  originalCanvasSize: { width: number; height: number } | null;
  customSelected?: boolean;
}): string {
  if (customSelected) {
    return CANVAS_CUSTOM_VALUE;
  }

  const isOriginalMatch =
    originalCanvasSize &&
    originalCanvasSize.width === width &&
    originalCanvasSize.height === height;
  if (isOriginalMatch) {
    return CANVAS_FIT_VALUE;
  }

  for (const preset of CANVAS_SIZE_PRESETS) {
    if (preset.width === width && preset.height === height) {
      return preset.label;
    }
  }

  return CANVAS_CUSTOM_VALUE;
}

function ProjectInfoView() {
  const editor = useEditor();
  const activeProject = editor.project.getActive();

  const currentCanvasSize = activeProject.settings.canvasSize;
  const originalCanvasSize = activeProject.settings.originalCanvasSize ?? null;
  const [customSelected, setCustomSelected] = useState(false);

  const selectedValue = resolveCanvasSizePresetValue({
    width: currentCanvasSize.width,
    height: currentCanvasSize.height,
    originalCanvasSize,
    customSelected,
  });

  const isCustom = selectedValue === CANVAS_CUSTOM_VALUE;
  const [customWidth, setCustomWidth] = useState(currentCanvasSize.width);
  const [customHeight, setCustomHeight] = useState(currentCanvasSize.height);

  const handleCanvasSizeChange = ({ value }: { value: string }) => {
    setCustomSelected(value === CANVAS_CUSTOM_VALUE);

    if (value === CANVAS_FIT_VALUE) {
      const canvasSize = originalCanvasSize ?? currentCanvasSize;
      editor.project.updateSettings({ settings: { canvasSize } });
      return;
    }

    if (value === CANVAS_CUSTOM_VALUE) {
      setCustomWidth(currentCanvasSize.width);
      setCustomHeight(currentCanvasSize.height);
      return;
    }

    const matched = CANVAS_SIZE_PRESETS.find((preset) => preset.label === value);
    if (matched) {
      editor.project.updateSettings({
        settings: { canvasSize: { width: matched.width, height: matched.height } },
      });
    }
  };

  const applyCustomSize = ({ width, height }: { width: number; height: number }) => {
    const clampedWidth = Math.max(1, Math.round(width));
    const clampedHeight = Math.max(1, Math.round(height));
    editor.project.updateSettings({
      settings: { canvasSize: { width: clampedWidth, height: clampedHeight } },
    });
  };

  const handleFpsChange = (value: string) => {
    const fps = parseFloat(value);
    editor.project.updateSettings({ settings: { fps } });
  };

  return (
    <PropertyGroup>
      <PropertyItem direction="column">
        <PropertyItemLabel>{'名称'}</PropertyItemLabel>
        <PropertyItemValue>{activeProject.metadata.name}</PropertyItemValue>
      </PropertyItem>

      <PropertyItem direction="column">
        <PropertyItemLabel>{'画布尺寸'}</PropertyItemLabel>
        <PropertyItemValue>
          <Select
            value={selectedValue}
            onValueChange={(value) => handleCanvasSizeChange({ value })}
          >
            <SelectTrigger>
              <SelectValue placeholder={'选择画布尺寸'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CANVAS_FIT_VALUE}>
                {originalCanvasSize
                  ? `Fit (${originalCanvasSize.width}×${originalCanvasSize.height})`
                  : '适应'}
              </SelectItem>
              {CANVAS_SIZE_PRESETS.map((preset) => (
                <SelectItem key={preset.label} value={preset.label}>
                  {preset.label} ({preset.width}×{preset.height})
                </SelectItem>
              ))}
              <SelectItem value={CANVAS_CUSTOM_VALUE}>{'自定义'}</SelectItem>
            </SelectContent>
          </Select>
        </PropertyItemValue>
      </PropertyItem>

      {isCustom && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            value={customWidth}
            onChange={(event) => {
              const value = Number(event.target.value);
              setCustomWidth(value);
            }}
            onBlur={() => applyCustomSize({ width: customWidth, height: customHeight })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                applyCustomSize({ width: customWidth, height: customHeight });
              }
            }}
            className="w-0 flex-1"
            aria-label={'画布宽度'}
          />
          <span className="text-muted-foreground text-xs">×</span>
          <Input
            type="number"
            min={1}
            value={customHeight}
            onChange={(event) => {
              const value = Number(event.target.value);
              setCustomHeight(value);
            }}
            onBlur={() => applyCustomSize({ width: customWidth, height: customHeight })}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                applyCustomSize({ width: customWidth, height: customHeight });
              }
            }}
            className="w-0 flex-1"
            aria-label={'画布高度'}
          />
        </div>
      )}

      <PropertyItem direction="column">
        <PropertyItemLabel>{'帧率'}</PropertyItemLabel>
        <PropertyItemValue>
          <Select value={activeProject.settings.fps.toString()} onValueChange={handleFpsChange}>
            <SelectTrigger>
              <SelectValue placeholder={'选择帧率'} />
            </SelectTrigger>
            <SelectContent>
              {FPS_PRESETS.map((preset) => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PropertyItemValue>
      </PropertyItem>
    </PropertyGroup>
  );
}

const BlurPreview = memo(
  ({
    blur,
    isSelected,
    onSelect,
  }: {
    blur: { label: string; value: number };
    isSelected: boolean;
    onSelect: () => void;
  }) => (
    <button
      className={cn(
        'border-foreground/15 hover:border-primary relative aspect-square size-20 cursor-pointer overflow-hidden rounded-sm border',
        isSelected && 'border-primary border-2',
      )}
      onClick={onSelect}
      type="button"
      aria-label={`Select ${blur.label} blur`}
    >
      <img
        src="https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
        alt={`Blur preview ${blur.label}`}
        className="object-cover"
        style={{ filter: `blur(${blur.value}px)` }}
        loading="eager"
      />
      <div className="absolute right-1 bottom-1 left-1 text-center">
        <span className="ve-veil-badge text-[10px]">{blur.label}</span>
      </div>
    </button>
  ),
);

BlurPreview.displayName = 'BlurPreview';

const BackgroundPreviews = memo(
  ({
    backgrounds,
    currentBackgroundColor,
    isColorBackground,
    handleColorSelect,
    useBackgroundColor = false,
  }: {
    backgrounds: string[];
    currentBackgroundColor: string;
    isColorBackground: boolean;
    handleColorSelect: ({ bg }: { bg: string }) => void;
    useBackgroundColor?: boolean;
  }) => {
    return useMemo(
      () =>
        backgrounds.map((bg, index) => (
          <button
            key={`${index}-${bg}`}
            className={cn(
              'border-foreground/15 hover:border-primary aspect-square size-20 cursor-pointer rounded-sm border',
              isColorBackground && bg === currentBackgroundColor && 'border-primary border-2',
            )}
            style={
              useBackgroundColor
                ? { backgroundColor: bg }
                : {
                    background: bg,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                  }
            }
            onClick={() => handleColorSelect({ bg })}
            type="button"
            aria-label={`Select background ${useBackgroundColor ? bg : index + 1}`}
          />
        )),
      [
        backgrounds,
        isColorBackground,
        currentBackgroundColor,
        handleColorSelect,
        useBackgroundColor,
      ],
    );
  },
);

BackgroundPreviews.displayName = 'BackgroundPreviews';

function BackgroundView() {
  const editor = useEditor();
  const activeProject = editor.project.getActive();
  const blurLevels = useMemo(() => BLUR_INTENSITY_PRESETS, []);

  const handleBlurSelect = useCallback(
    async ({ blurIntensity }: { blurIntensity: number }) => {
      await editor.project.updateSettings({
        settings: { background: { type: 'blur', blurIntensity } },
      });
    },
    [editor.project],
  );

  const handleColorSelect = useCallback(
    async ({ color }: { color: string }) => {
      await editor.project.updateSettings({
        settings: { background: { type: 'color', color } },
      });
    },
    [editor.project],
  );

  const currentBlurIntensity =
    activeProject.settings.background.type === 'blur'
      ? activeProject.settings.background.blurIntensity
      : DEFAULT_BLUR_INTENSITY;

  const currentBackgroundColor =
    activeProject.settings.background.type === 'color'
      ? activeProject.settings.background.color
      : DEFAULT_COLOR;

  const isBlurBackground = activeProject.settings.background.type === 'blur';
  const isColorBackground = activeProject.settings.background.type === 'color';

  const blurPreviews = useMemo(
    () =>
      blurLevels.map((blur) => (
        <BlurPreview
          key={blur.value}
          blur={blur}
          isSelected={isBlurBackground && currentBlurIntensity === blur.value}
          onSelect={() => handleBlurSelect({ blurIntensity: blur.value })}
        />
      )),
    [blurLevels, isBlurBackground, currentBlurIntensity, handleBlurSelect],
  );

  const backgroundSections = [
    { title: '颜色', backgrounds: colors, useBackgroundColor: true },
    { title: '图案工坊', backgrounds: patternCraftGradients },
    { title: 'Syntax UI', backgrounds: syntaxUIGradients },
  ];

  return (
    <>
      <PropertyGroup title={'模糊'} hasBorderTop={false} defaultExpanded={false}>
        <div className="flex flex-wrap gap-2">{blurPreviews}</div>
      </PropertyGroup>

      {backgroundSections.map((section) => (
        <PropertyGroup key={section.title} title={section.title} defaultExpanded={false}>
          <div className="flex flex-wrap gap-2">
            <BackgroundPreviews
              backgrounds={section.backgrounds}
              currentBackgroundColor={currentBackgroundColor}
              isColorBackground={isColorBackground}
              handleColorSelect={({ bg }) => handleColorSelect({ color: bg })}
              useBackgroundColor={section.useBackgroundColor}
            />
          </div>
        </PropertyGroup>
      ))}
    </>
  );
}

/* 更新(2026-09-14)：AISettingsView（图片/视频服务商 + API Key 配置）随 AI 域整体移除，
   见 docs/130-cutia搬迁计划书。 */
