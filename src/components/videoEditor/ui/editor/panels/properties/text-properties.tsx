'use client';

import { Textarea } from '@videoEditor/ui/ui/textarea';
import { FontPicker } from '@videoEditor/ui/ui/font-picker';

import type { FontFamily } from '@videoEditor/constants/font-constants';
import type { TextElement, TextStroke, TextShadow, Transform } from '@videoEditor/types/timeline';
import { Switch } from '@videoEditor/ui/ui/switch';
import { Slider } from '@videoEditor/ui/ui/slider';
import { Input } from '@videoEditor/ui/ui/input';
import { Button } from '@videoEditor/ui/ui/button';
import { useReducer, useRef } from 'react';
import { PanelBaseView } from '@videoEditor/ui/editor/panels/panel-base-view';
import {
  PropertyGroup,
  PropertyItem,
  PropertyItemLabel,
  PropertyItemValue,
  PropertySubsection,
} from './property-item';
import { ColorPicker } from '@videoEditor/ui/ui/color-picker';
import { clamp } from '@videoEditor/utils/math';
import { useEditor } from '@videoEditor/hooks-cutia/use-editor';
import { DEFAULT_COLOR } from '@videoEditor/constants/project-constants';
import {
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  MAX_STROKE_WIDTH,
  NO_STROKE_WIDTH,
  DEFAULT_BG_OPACITY,
  DEFAULT_BG_PADDING_Y,
  DEFAULT_BG_PADDING_X,
  DEFAULT_BG_BORDER_RADIUS,
  DEFAULT_TEXT_SHADOW,
  hasTextStroke,
  hasTextShadow,
  hasTextBackground,
} from '@videoEditor/constants/text-constants';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@videoEditor/ui/ui/tabs';
import { TextSpeechPanel } from './text-speech-panel';
import {
  TEXT_STYLE_PRESETS,
  type TextStylePreset,
} from '@videoEditor/constants/text-style-presets';
import { cn } from '@videoEditor/utils/ui';

interface TextElementRef {
  element: TextElement;
  trackId: string;
}

export function TextProperties({ elements: elementRefs }: { elements: TextElementRef[] }) {
  const element = elementRefs[0].element;

  const editor = useEditor();
  const containerRef = useRef<HTMLDivElement>(null);
  const [, forceRender] = useReducer((x: number) => x + 1, 0);
  const isEditingFontSize = useRef(false);
  const isEditingOpacity = useRef(false);
  const isEditingContent = useRef(false);
  const isEditingPosX = useRef(false);
  const isEditingPosY = useRef(false);
  const isEditingScale = useRef(false);
  const isEditingRotation = useRef(false);
  const fontSizeDraft = useRef('');
  const opacityDraft = useRef('');
  const contentDraft = useRef('');
  const posXDraft = useRef('');
  const posYDraft = useRef('');
  const scaleDraft = useRef('');
  const rotationDraft = useRef('');

  const buildBatchUpdates = (updates: Partial<Record<string, unknown>>) =>
    elementRefs.map((ref) => ({
      trackId: ref.trackId,
      elementId: ref.element.id,
      updates,
    }));

  const fontSizeDisplay = isEditingFontSize.current
    ? fontSizeDraft.current
    : element.fontSize.toString();
  const opacityDisplay = isEditingOpacity.current
    ? opacityDraft.current
    : Math.round(element.opacity * 100).toString();
  const contentDisplay = isEditingContent.current ? contentDraft.current : element.content;

  const lastSelectedColor = useRef(DEFAULT_COLOR);
  const initialFontSizeRef = useRef<number | null>(null);
  const initialOpacityRef = useRef<number | null>(null);
  const initialContentRef = useRef<string | null>(null);
  const initialColorRef = useRef<string | null>(null);
  const initialBgColorRef = useRef<string | null>(null);
  const initialPosXRef = useRef<number | null>(null);
  const initialPosYRef = useRef<number | null>(null);
  const initialScaleRef = useRef<number | null>(null);
  const initialRotationRef = useRef<number | null>(null);
  const initialStrokeRef = useRef<TextStroke | null>(null);
  const initialShadowRef = useRef<TextShadow | null>(null);
  const initialStrokeColorRef = useRef<string | null>(null);
  const initialShadowColorRef = useRef<string | null>(null);
  const initialBgOpacityRef = useRef<number | null>(null);
  const initialBgBorderRadiusRef = useRef<number | null>(null);
  const initialBgPaddingXRef = useRef<number | null>(null);
  const initialBgPaddingYRef = useRef<number | null>(null);

  const scalePercent = Math.round(element.transform.scale * 100);
  const posXDisplay = isEditingPosX.current
    ? posXDraft.current
    : Math.round(element.transform.position.x).toString();
  const posYDisplay = isEditingPosY.current
    ? posYDraft.current
    : Math.round(element.transform.position.y).toString();
  const scaleDisplay = isEditingScale.current ? scaleDraft.current : scalePercent.toString();
  const rotationDisplay = isEditingRotation.current
    ? rotationDraft.current
    : Math.round(element.transform.rotate).toString();

  const updateTransform = ({
    updates: transformUpdates,
    pushHistory = true,
  }: {
    updates: Partial<Transform>;
    pushHistory?: boolean;
  }) => {
    editor.timeline.updateElements({
      updates: elementRefs.map((ref) => ({
        trackId: ref.trackId,
        elementId: ref.element.id,
        updates: {
          transform: { ...ref.element.transform, ...transformUpdates },
        },
      })),
      pushHistory,
    });
  };

  // 判据收口：`width > 0` 才算有描边（与渲染侧同源）。"有没有 stroke 对象"不是判据 ——
  // 见 `hasTextStroke` 的注释（两套判据会让 UI 与画面说法不一）。
  const strokeEnabled = hasTextStroke(element.stroke);
  const currentStroke: TextStroke = element.stroke ?? {
    color: '#000000',
    // 默认 = 没有描边（用户口径：宽度本身就是开关，不需要额外的"启用"布尔）。
    width: NO_STROKE_WIDTH,
  };
  const shadowEnabled = hasTextShadow(element.shadow);
  const currentShadow: TextShadow = element.shadow ?? DEFAULT_TEXT_SHADOW;
  const backgroundEnabled = hasTextBackground({ backgroundColor: element.backgroundColor });
  // 「样式」组（背景 / 描边 / 阴影）的默认展开：三段任一有值即展开。
  // 三段各自的判据都在 `text-constants.ts` 里收口，这里只做"或"。
  const hasStyleSection = backgroundEnabled || strokeEnabled || shadowEnabled;

  const updateStroke = ({
    stroke,
    pushHistory = true,
  }: {
    stroke: TextStroke | undefined;
    pushHistory?: boolean;
  }) => {
    editor.timeline.updateElements({
      updates: buildBatchUpdates({ stroke }),
      pushHistory,
    });
  };

  const updateShadow = ({
    shadow,
    pushHistory = true,
  }: {
    shadow: TextShadow | undefined;
    pushHistory?: boolean;
  }) => {
    editor.timeline.updateElements({
      updates: buildBatchUpdates({ shadow }),
      pushHistory,
    });
  };

  const handleFontSizeChange = ({ value }: { value: string }) => {
    fontSizeDraft.current = value;
    forceRender();

    if (value.trim() !== '') {
      if (initialFontSizeRef.current === null) {
        initialFontSizeRef.current = element.fontSize;
      }
      const parsed = parseInt(value, 10);
      const fontSize = Number.isNaN(parsed)
        ? element.fontSize
        : clamp({ value: parsed, min: MIN_FONT_SIZE, max: MAX_FONT_SIZE });
      editor.timeline.updateElements({
        updates: buildBatchUpdates({ fontSize }),
        pushHistory: false,
      });
    }
  };

  const handleFontSizeBlur = () => {
    if (initialFontSizeRef.current !== null) {
      const parsed = parseInt(fontSizeDraft.current, 10);
      const fontSize = Number.isNaN(parsed)
        ? element.fontSize
        : clamp({ value: parsed, min: MIN_FONT_SIZE, max: MAX_FONT_SIZE });
      editor.timeline.updateElements({
        updates: buildBatchUpdates({ fontSize: initialFontSizeRef.current }),
        pushHistory: false,
      });
      editor.timeline.updateElements({
        updates: buildBatchUpdates({ fontSize }),
        pushHistory: true,
      });
      initialFontSizeRef.current = null;
    }
    isEditingFontSize.current = false;
    fontSizeDraft.current = '';
    forceRender();
  };

  const handleOpacityChange = ({ value }: { value: string }) => {
    opacityDraft.current = value;
    forceRender();

    if (value.trim() !== '') {
      if (initialOpacityRef.current === null) {
        initialOpacityRef.current = element.opacity;
      }
      const parsed = parseInt(value, 10);
      const opacityPercent = Number.isNaN(parsed)
        ? Math.round(element.opacity * 100)
        : clamp({ value: parsed, min: 0, max: 100 });
      editor.timeline.updateElements({
        updates: buildBatchUpdates({ opacity: opacityPercent / 100 }),
        pushHistory: false,
      });
    }
  };

  const handleOpacityBlur = () => {
    if (initialOpacityRef.current !== null) {
      const parsed = parseInt(opacityDraft.current, 10);
      const opacityPercent = Number.isNaN(parsed)
        ? Math.round(element.opacity * 100)
        : clamp({ value: parsed, min: 0, max: 100 });
      editor.timeline.updateElements({
        updates: buildBatchUpdates({ opacity: initialOpacityRef.current }),
        pushHistory: false,
      });
      editor.timeline.updateElements({
        updates: buildBatchUpdates({ opacity: opacityPercent / 100 }),
        pushHistory: true,
      });
      initialOpacityRef.current = null;
    }
    isEditingOpacity.current = false;
    opacityDraft.current = '';
    forceRender();
  };

  const handleColorChange = ({ color }: { color: string }) => {
    if (color !== 'transparent') {
      lastSelectedColor.current = color;
    }
    if (initialBgColorRef.current === null) {
      initialBgColorRef.current = element.backgroundColor;
    }
    if (initialBgColorRef.current !== null) {
      editor.timeline.updateElements({
        updates: buildBatchUpdates({ backgroundColor: color }),
        pushHistory: false,
      });
    } else {
      editor.timeline.updateElements({
        updates: buildBatchUpdates({ backgroundColor: color }),
      });
    }
  };

  const handleColorChangeEnd = ({ color }: { color: string }) => {
    if (initialBgColorRef.current !== null) {
      editor.timeline.updateElements({
        updates: buildBatchUpdates({
          backgroundColor: initialBgColorRef.current,
        }),
        pushHistory: false,
      });
      editor.timeline.updateElements({
        updates: buildBatchUpdates({ backgroundColor: `#${color}` }),
        pushHistory: true,
      });
      initialBgColorRef.current = null;
    }
  };

  return (
    <div className="flex h-full flex-col" ref={containerRef}>
      <Tabs defaultValue="style" className="flex h-full flex-col">
        <TabsList className="border-b px-3 py-2">
          <TabsTrigger value="style">{'样式'}</TabsTrigger>
          <TabsTrigger value="speech">{'语音'}</TabsTrigger>
        </TabsList>
        <TabsContent value="style" className="mt-0 flex-1 overflow-auto">
          <PanelBaseView className="p-0">
            <PropertyGroup hasBorderTop={false}>
              <Textarea
                placeholder="输入文字"
                value={contentDisplay}
                // 紧凑：80px → 56px（3 行仍够写；面板纵向空间留给下方真正要调的属性）。
                className="min-h-14"
                onFocus={() => {
                  isEditingContent.current = true;
                  contentDraft.current = element.content;
                  initialContentRef.current = element.content;
                  forceRender();
                }}
                onChange={(event) => {
                  contentDraft.current = event.target.value;
                  forceRender();
                  if (initialContentRef.current === null) {
                    initialContentRef.current = element.content;
                  }
                  editor.timeline.updateElements({
                    updates: buildBatchUpdates({
                      content: event.target.value,
                    }),
                    pushHistory: false,
                  });
                }}
                onBlur={() => {
                  if (initialContentRef.current !== null) {
                    const finalContent = contentDraft.current;
                    editor.timeline.updateElements({
                      updates: buildBatchUpdates({
                        content: initialContentRef.current,
                      }),
                      pushHistory: false,
                    });
                    editor.timeline.updateElements({
                      updates: buildBatchUpdates({
                        content: finalContent,
                      }),
                      pushHistory: true,
                    });
                    initialContentRef.current = null;
                  }
                  isEditingContent.current = false;
                  contentDraft.current = '';
                  forceRender();
                }}
              />
            </PropertyGroup>
            <PropertyGroup hasBorderTop>
              <PropertyItem direction="column">
                <PropertyItemLabel>{'字体'}</PropertyItemLabel>
                <PropertyItemValue>
                  <FontPicker
                    value={element.fontFamily}
                    onValueChange={(value: FontFamily) =>
                      editor.timeline.updateElements({
                        updates: buildBatchUpdates({
                          fontFamily: value,
                        }),
                      })
                    }
                  />
                </PropertyItemValue>
              </PropertyItem>
              <PropertyItem direction="column">
                <PropertyItemLabel>{'样式'}</PropertyItemLabel>
                <PropertyItemValue>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={element.fontWeight === 'bold' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() =>
                        editor.timeline.updateElements({
                          updates: buildBatchUpdates({
                            fontWeight: element.fontWeight === 'bold' ? 'normal' : 'bold',
                          }),
                        })
                      }
                      className="h-8 px-3 font-bold"
                    >
                      B
                    </Button>
                    <Button
                      variant={element.fontStyle === 'italic' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() =>
                        editor.timeline.updateElements({
                          updates: buildBatchUpdates({
                            fontStyle: element.fontStyle === 'italic' ? 'normal' : 'italic',
                          }),
                        })
                      }
                      className="h-8 px-3 italic"
                    >
                      I
                    </Button>
                    <Button
                      variant={element.textDecoration === 'underline' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() =>
                        editor.timeline.updateElements({
                          updates: buildBatchUpdates({
                            textDecoration:
                              element.textDecoration === 'underline' ? 'none' : 'underline',
                          }),
                        })
                      }
                      className="h-8 px-3 underline"
                    >
                      U
                    </Button>
                    <Button
                      variant={element.textDecoration === 'line-through' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() =>
                        editor.timeline.updateElements({
                          updates: buildBatchUpdates({
                            textDecoration:
                              element.textDecoration === 'line-through' ? 'none' : 'line-through',
                          }),
                        })
                      }
                      className="h-8 px-3 line-through"
                    >
                      S
                    </Button>
                  </div>
                </PropertyItemValue>
              </PropertyItem>
              <PropertyItem direction="column">
                <PropertyItemLabel>{'字号'}</PropertyItemLabel>
                <PropertyItemValue>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[element.fontSize]}
                      min={MIN_FONT_SIZE}
                      max={MAX_FONT_SIZE}
                      step={1}
                      onValueChange={([value]) => {
                        if (initialFontSizeRef.current === null) {
                          initialFontSizeRef.current = element.fontSize;
                        }
                        editor.timeline.updateElements({
                          updates: buildBatchUpdates({ fontSize: value }),
                          pushHistory: false,
                        });
                      }}
                      onValueCommit={([value]) => {
                        if (initialFontSizeRef.current !== null) {
                          editor.timeline.updateElements({
                            updates: buildBatchUpdates({
                              fontSize: initialFontSizeRef.current,
                            }),
                            pushHistory: false,
                          });
                          editor.timeline.updateElements({
                            updates: buildBatchUpdates({ fontSize: value }),
                            pushHistory: true,
                          });
                          initialFontSizeRef.current = null;
                        }
                      }}
                      className="w-full"
                    />
                    <Input
                      type="number"
                      value={fontSizeDisplay}
                      min={MIN_FONT_SIZE}
                      max={MAX_FONT_SIZE}
                      onFocus={() => {
                        isEditingFontSize.current = true;
                        fontSizeDraft.current = element.fontSize.toString();
                        forceRender();
                      }}
                      onChange={(e) => handleFontSizeChange({ value: e.target.value })}
                      onBlur={handleFontSizeBlur}
                      className="ve-num w-12"
                    />
                  </div>
                </PropertyItemValue>
              </PropertyItem>
            </PropertyGroup>
            <PropertyGroup>
              <div className="flex flex-wrap gap-1.5">
                {TEXT_STYLE_PRESETS.map((preset) => (
                  <PresetButton
                    key={preset.id}
                    preset={preset}
                    onClick={() => {
                      editor.timeline.updateElements({
                        updates: buildBatchUpdates(preset.styles),
                      });
                    }}
                  />
                ))}
              </div>
            </PropertyGroup>
            <PropertyGroup hasBorderTop>
              <PropertyItem direction="column">
                <PropertyItemLabel>{'颜色'}</PropertyItemLabel>
                <PropertyItemValue>
                  <ColorPicker
                    value={element.color || 'FFFFFF'}
                    onChange={(color) => {
                      if (initialColorRef.current === null) {
                        initialColorRef.current = element.color || '#FFFFFF';
                      }
                      if (initialColorRef.current !== null) {
                        editor.timeline.updateElements({
                          updates: buildBatchUpdates({
                            color: `#${color}`,
                          }),
                          pushHistory: false,
                        });
                      } else {
                        editor.timeline.updateElements({
                          updates: buildBatchUpdates({
                            color: `#${color}`,
                          }),
                        });
                      }
                    }}
                    onChangeEnd={(color) => {
                      if (initialColorRef.current !== null) {
                        editor.timeline.updateElements({
                          updates: buildBatchUpdates({
                            color: initialColorRef.current,
                          }),
                          pushHistory: false,
                        });
                        editor.timeline.updateElements({
                          updates: buildBatchUpdates({
                            color: `#${color}`,
                          }),
                          pushHistory: true,
                        });
                        initialColorRef.current = null;
                      }
                    }}
                    containerRef={containerRef}
                  />
                </PropertyItemValue>
              </PropertyItem>
              <PropertyItem direction="column">
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
                          updates: buildBatchUpdates({
                            opacity: value / 100,
                          }),
                          pushHistory: false,
                        });
                      }}
                      onValueCommit={([value]) => {
                        if (initialOpacityRef.current !== null) {
                          editor.timeline.updateElements({
                            updates: buildBatchUpdates({
                              opacity: initialOpacityRef.current,
                            }),
                            pushHistory: false,
                          });
                          editor.timeline.updateElements({
                            updates: buildBatchUpdates({
                              opacity: value / 100,
                            }),
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
                      onChange={(e) => handleOpacityChange({ value: e.target.value })}
                      onBlur={handleOpacityBlur}
                      className="ve-num w-12"
                    />
                  </div>
                </PropertyItemValue>
              </PropertyItem>
            </PropertyGroup>
            {/*
              样式 —— **背景 / 描边 / 阴影共用一个折叠头**（用户 2026-09-15："把描边、阴影和背景
              给它们设置成一个统一的折叠头，叫样式，而不是一人一个"）。
              · 原先是三个平级折叠头 → 面板被切成三块，用户要分别点开才知道里面有什么；
                它们本就是同一件事（文字的外观修饰）的三个字段，故收为一个组。
              · 组内三段用 `PropertySubsection`（不可折叠的小节标题）区分，一眼看出是三段。
              · 展开判据：三段**任一**有值就默认展开（沿用各段原有的"有值即展开"口径，
                收口在 `hasTextBackground` / `hasTextStroke` / `hasTextShadow`，
                不再各写一份表达式）。
            */}
            <PropertyGroup title={'样式'} defaultExpanded={hasStyleSection}>
              <PropertySubsection label={'背景'} />
              <PropertyItem>
                <PropertyItemLabel>{'启用'}</PropertyItemLabel>
                <PropertyItemValue>
                  <Switch
                    checked={backgroundEnabled}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        editor.timeline.updateElements({
                          updates: buildBatchUpdates({
                            backgroundColor: lastSelectedColor.current,
                          }),
                        });
                      } else {
                        editor.timeline.updateElements({
                          updates: buildBatchUpdates({
                            backgroundColor: 'transparent',
                          }),
                        });
                      }
                    }}
                  />
                </PropertyItemValue>
              </PropertyItem>
              {backgroundEnabled && (
                <>
                  <PropertyItem direction="column">
                    <PropertyItemLabel>{'颜色'}</PropertyItemLabel>
                    <PropertyItemValue>
                      <ColorPicker
                        value={element.backgroundColor}
                        onChange={(color) => handleColorChange({ color: `#${color}` })}
                        onChangeEnd={(color) => handleColorChangeEnd({ color })}
                        containerRef={containerRef}
                      />
                    </PropertyItemValue>
                  </PropertyItem>
                  <PropertyItem direction="column">
                    <PropertyItemLabel>{'不透明度'}</PropertyItemLabel>
                    <PropertyItemValue>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[
                            Math.round((element.backgroundOpacity ?? DEFAULT_BG_OPACITY) * 100),
                          ]}
                          min={0}
                          max={100}
                          step={1}
                          onValueChange={([value]) => {
                            if (initialBgOpacityRef.current === null) {
                              initialBgOpacityRef.current =
                                element.backgroundOpacity ?? DEFAULT_BG_OPACITY;
                            }
                            editor.timeline.updateElements({
                              updates: buildBatchUpdates({
                                backgroundOpacity: value / 100,
                              }),
                              pushHistory: false,
                            });
                          }}
                          onValueCommit={([value]) => {
                            if (initialBgOpacityRef.current !== null) {
                              editor.timeline.updateElements({
                                updates: buildBatchUpdates({
                                  backgroundOpacity: initialBgOpacityRef.current,
                                }),
                                pushHistory: false,
                              });
                              editor.timeline.updateElements({
                                updates: buildBatchUpdates({
                                  backgroundOpacity: value / 100,
                                }),
                                pushHistory: true,
                              });
                              initialBgOpacityRef.current = null;
                            }
                          }}
                          className="w-full"
                        />
                        <span className="text-muted-foreground w-8 text-center text-xs">
                          {Math.round((element.backgroundOpacity ?? DEFAULT_BG_OPACITY) * 100)}
                        </span>
                      </div>
                    </PropertyItemValue>
                  </PropertyItem>
                  <PropertyItem direction="column">
                    <PropertyItemLabel>{'圆角半径'}</PropertyItemLabel>
                    <PropertyItemValue>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[element.backgroundBorderRadius ?? DEFAULT_BG_BORDER_RADIUS]}
                          min={0}
                          max={50}
                          step={1}
                          onValueChange={([value]) => {
                            if (initialBgBorderRadiusRef.current === null) {
                              initialBgBorderRadiusRef.current =
                                element.backgroundBorderRadius ?? DEFAULT_BG_BORDER_RADIUS;
                            }
                            editor.timeline.updateElements({
                              updates: buildBatchUpdates({
                                backgroundBorderRadius: value,
                              }),
                              pushHistory: false,
                            });
                          }}
                          onValueCommit={([value]) => {
                            if (initialBgBorderRadiusRef.current !== null) {
                              editor.timeline.updateElements({
                                updates: buildBatchUpdates({
                                  backgroundBorderRadius: initialBgBorderRadiusRef.current,
                                }),
                                pushHistory: false,
                              });
                              editor.timeline.updateElements({
                                updates: buildBatchUpdates({
                                  backgroundBorderRadius: value,
                                }),
                                pushHistory: true,
                              });
                              initialBgBorderRadiusRef.current = null;
                            }
                          }}
                          className="w-full"
                        />
                        <span className="text-muted-foreground w-8 text-center text-xs">
                          {element.backgroundBorderRadius ?? DEFAULT_BG_BORDER_RADIUS}
                        </span>
                      </div>
                    </PropertyItemValue>
                  </PropertyItem>
                  <PropertyItem direction="column">
                    <PropertyItemLabel>{'高度'}</PropertyItemLabel>
                    <PropertyItemValue>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[element.backgroundPaddingY ?? DEFAULT_BG_PADDING_Y]}
                          min={0}
                          max={50}
                          step={1}
                          onValueChange={([value]) => {
                            if (initialBgPaddingYRef.current === null) {
                              initialBgPaddingYRef.current =
                                element.backgroundPaddingY ?? DEFAULT_BG_PADDING_Y;
                            }
                            editor.timeline.updateElements({
                              updates: buildBatchUpdates({
                                backgroundPaddingY: value,
                              }),
                              pushHistory: false,
                            });
                          }}
                          onValueCommit={([value]) => {
                            if (initialBgPaddingYRef.current !== null) {
                              editor.timeline.updateElements({
                                updates: buildBatchUpdates({
                                  backgroundPaddingY: initialBgPaddingYRef.current,
                                }),
                                pushHistory: false,
                              });
                              editor.timeline.updateElements({
                                updates: buildBatchUpdates({
                                  backgroundPaddingY: value,
                                }),
                                pushHistory: true,
                              });
                              initialBgPaddingYRef.current = null;
                            }
                          }}
                          className="w-full"
                        />
                        <span className="text-muted-foreground w-8 text-center text-xs">
                          {element.backgroundPaddingY ?? DEFAULT_BG_PADDING_Y}
                        </span>
                      </div>
                    </PropertyItemValue>
                  </PropertyItem>
                  <PropertyItem direction="column">
                    <PropertyItemLabel>{'宽度'}</PropertyItemLabel>
                    <PropertyItemValue>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[element.backgroundPaddingX ?? DEFAULT_BG_PADDING_X]}
                          min={0}
                          max={50}
                          step={1}
                          onValueChange={([value]) => {
                            if (initialBgPaddingXRef.current === null) {
                              initialBgPaddingXRef.current =
                                element.backgroundPaddingX ?? DEFAULT_BG_PADDING_X;
                            }
                            editor.timeline.updateElements({
                              updates: buildBatchUpdates({
                                backgroundPaddingX: value,
                              }),
                              pushHistory: false,
                            });
                          }}
                          onValueCommit={([value]) => {
                            if (initialBgPaddingXRef.current !== null) {
                              editor.timeline.updateElements({
                                updates: buildBatchUpdates({
                                  backgroundPaddingX: initialBgPaddingXRef.current,
                                }),
                                pushHistory: false,
                              });
                              editor.timeline.updateElements({
                                updates: buildBatchUpdates({
                                  backgroundPaddingX: value,
                                }),
                                pushHistory: true,
                              });
                              initialBgPaddingXRef.current = null;
                            }
                          }}
                          className="w-full"
                        />
                        <span className="text-muted-foreground w-8 text-center text-xs">
                          {element.backgroundPaddingX ?? DEFAULT_BG_PADDING_X}
                        </span>
                      </div>
                    </PropertyItemValue>
                  </PropertyItem>
                </>
              )}
              {/*
              描边 —— **没有「启用」开关**：宽度本身就是开关（用户 2026-09-15：「你是 0 不就是没有启用吗？」）。
              滑杆 `0` = 无描边（与渲染侧 `width > 0` 判据同源，见 `hasTextStroke`）。
              颜色始终可编辑 —— 先配色、再拖宽度，顺序由用户定，不必先"启用"。
            */}
              <PropertySubsection label={'描边'} />
              <PropertyItem direction="column">
                <PropertyItemLabel>{'颜色'}</PropertyItemLabel>
                <PropertyItemValue>
                  <ColorPicker
                    value={currentStroke.color}
                    onChange={(color) => {
                      if (initialStrokeColorRef.current === null) {
                        initialStrokeColorRef.current = currentStroke.color;
                      }
                      updateStroke({
                        stroke: { ...currentStroke, color: `#${color}` },
                        pushHistory: false,
                      });
                    }}
                    onChangeEnd={(color) => {
                      if (initialStrokeColorRef.current !== null) {
                        updateStroke({
                          stroke: {
                            ...currentStroke,
                            color: initialStrokeColorRef.current,
                          },
                          pushHistory: false,
                        });
                        updateStroke({
                          stroke: {
                            ...currentStroke,
                            color: `#${color}`,
                          },
                        });
                        initialStrokeColorRef.current = null;
                      }
                    }}
                    containerRef={containerRef}
                  />
                </PropertyItemValue>
              </PropertyItem>
              <PropertyItem direction="column">
                <PropertyItemLabel>{'宽度'}</PropertyItemLabel>
                <PropertyItemValue>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[currentStroke.width]}
                      min={NO_STROKE_WIDTH}
                      max={MAX_STROKE_WIDTH}
                      step={1}
                      onValueChange={([value]) => {
                        if (initialStrokeRef.current === null) {
                          initialStrokeRef.current = { ...currentStroke };
                        }
                        updateStroke({
                          stroke: { ...currentStroke, width: value },
                          pushHistory: false,
                        });
                      }}
                      onValueCommit={([value]) => {
                        if (initialStrokeRef.current !== null) {
                          updateStroke({
                            stroke: initialStrokeRef.current,
                            pushHistory: false,
                          });
                          updateStroke({
                            stroke: { ...currentStroke, width: value },
                          });
                          initialStrokeRef.current = null;
                        }
                      }}
                      className="w-full"
                    />
                    <span className="text-muted-foreground w-8 text-center text-xs">
                      {currentStroke.width}
                    </span>
                  </div>
                </PropertyItemValue>
              </PropertyItem>

              {/*
              阴影 —— 这里**保留**「启用」开关（与描边不同，不是口径不一致）：
              阴影的"没有"是 `shadow === undefined`，没有一个自然的 0 值能表达"关"——
              X/Y 偏移为 0 只是"正后方投影"，仍是有阴影。所以必须有个布尔来创建/移除对象。
            */}
              <PropertySubsection label={'阴影'} />
              <PropertyItem>
                <PropertyItemLabel>{'启用'}</PropertyItemLabel>
                <PropertyItemValue>
                  <Switch
                    checked={shadowEnabled}
                    onCheckedChange={(checked) => {
                      updateShadow({
                        shadow: checked ? { ...DEFAULT_TEXT_SHADOW } : undefined,
                      });
                    }}
                  />
                </PropertyItemValue>
              </PropertyItem>
              {shadowEnabled && (
                <>
                  <PropertyItem direction="column">
                    <PropertyItemLabel>{'颜色'}</PropertyItemLabel>
                    <PropertyItemValue>
                      <ColorPicker
                        value={currentShadow.color}
                        onChange={(color) => {
                          if (initialShadowColorRef.current === null) {
                            initialShadowColorRef.current = currentShadow.color;
                          }
                          updateShadow({
                            shadow: { ...currentShadow, color: `#${color}` },
                            pushHistory: false,
                          });
                        }}
                        onChangeEnd={(color) => {
                          if (initialShadowColorRef.current !== null) {
                            updateShadow({
                              shadow: {
                                ...currentShadow,
                                color: initialShadowColorRef.current,
                              },
                              pushHistory: false,
                            });
                            updateShadow({
                              shadow: {
                                ...currentShadow,
                                color: `#${color}`,
                              },
                            });
                            initialShadowColorRef.current = null;
                          }
                        }}
                        containerRef={containerRef}
                      />
                    </PropertyItemValue>
                  </PropertyItem>
                  <PropertyItem direction="column">
                    <PropertyItemLabel>{'X 偏移'}</PropertyItemLabel>
                    <PropertyItemValue>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[currentShadow.offsetX]}
                          min={-20}
                          max={20}
                          step={1}
                          onValueChange={([value]) => {
                            if (initialShadowRef.current === null) {
                              initialShadowRef.current = { ...currentShadow };
                            }
                            updateShadow({
                              shadow: { ...currentShadow, offsetX: value },
                              pushHistory: false,
                            });
                          }}
                          onValueCommit={([value]) => {
                            if (initialShadowRef.current !== null) {
                              updateShadow({
                                shadow: initialShadowRef.current,
                                pushHistory: false,
                              });
                              updateShadow({
                                shadow: { ...currentShadow, offsetX: value },
                              });
                              initialShadowRef.current = null;
                            }
                          }}
                          className="w-full"
                        />
                        <span className="text-muted-foreground w-8 text-center text-xs">
                          {currentShadow.offsetX}
                        </span>
                      </div>
                    </PropertyItemValue>
                  </PropertyItem>
                  <PropertyItem direction="column">
                    <PropertyItemLabel>{'Y 偏移'}</PropertyItemLabel>
                    <PropertyItemValue>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[currentShadow.offsetY]}
                          min={-20}
                          max={20}
                          step={1}
                          onValueChange={([value]) => {
                            if (initialShadowRef.current === null) {
                              initialShadowRef.current = { ...currentShadow };
                            }
                            updateShadow({
                              shadow: { ...currentShadow, offsetY: value },
                              pushHistory: false,
                            });
                          }}
                          onValueCommit={([value]) => {
                            if (initialShadowRef.current !== null) {
                              updateShadow({
                                shadow: initialShadowRef.current,
                                pushHistory: false,
                              });
                              updateShadow({
                                shadow: { ...currentShadow, offsetY: value },
                              });
                              initialShadowRef.current = null;
                            }
                          }}
                          className="w-full"
                        />
                        <span className="text-muted-foreground w-8 text-center text-xs">
                          {currentShadow.offsetY}
                        </span>
                      </div>
                    </PropertyItemValue>
                  </PropertyItem>
                  <PropertyItem direction="column">
                    <PropertyItemLabel>{'模糊'}</PropertyItemLabel>
                    <PropertyItemValue>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[currentShadow.blur]}
                          min={0}
                          max={30}
                          step={1}
                          onValueChange={([value]) => {
                            if (initialShadowRef.current === null) {
                              initialShadowRef.current = { ...currentShadow };
                            }
                            updateShadow({
                              shadow: { ...currentShadow, blur: value },
                              pushHistory: false,
                            });
                          }}
                          onValueCommit={([value]) => {
                            if (initialShadowRef.current !== null) {
                              updateShadow({
                                shadow: initialShadowRef.current,
                                pushHistory: false,
                              });
                              updateShadow({
                                shadow: { ...currentShadow, blur: value },
                              });
                              initialShadowRef.current = null;
                            }
                          }}
                          className="w-full"
                        />
                        <span className="text-muted-foreground w-8 text-center text-xs">
                          {currentShadow.blur}
                        </span>
                      </div>
                    </PropertyItemValue>
                  </PropertyItem>
                </>
              )}
            </PropertyGroup>
            <PropertyGroup hasBorderTop>
              {/*
                位置 X / Y —— **标签 + 窄框，横排在同一行**。
                【为什么不并排两个"撑满"的输入框】上一版是两个 `flex-1` 竖排格并排，
                每个输入框被撑到 130px+ 去装一个 -20~20 的数字 ——
                既没有用（宽度全是空的），又和同一个面板里 48px 宽的字号/不透明度/缩放/旋转
                **成了两种尺寸**：同一类控件、同一个面板，尺寸不一致本身就说不通。
                现在按"数值字段都是窄字段"收口：标签 + 48px 框，X 与 Y 各占半行。
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
                            updates: {
                              position: {
                                ...element.transform.position,
                                x: parsed,
                              },
                            },
                            pushHistory: false,
                          });
                        }
                      }}
                      onBlur={() => {
                        if (initialPosXRef.current !== null) {
                          const parsed = Number.parseFloat(posXDraft.current);
                          const value = Number.isNaN(parsed)
                            ? element.transform.position.x
                            : parsed;
                          updateTransform({
                            updates: {
                              position: {
                                ...element.transform.position,
                                x: initialPosXRef.current,
                              },
                            },
                            pushHistory: false,
                          });
                          updateTransform({
                            updates: {
                              position: {
                                ...element.transform.position,
                                x: value,
                              },
                            },
                            pushHistory: true,
                          });
                          initialPosXRef.current = null;
                        }
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
                            updates: {
                              position: {
                                ...element.transform.position,
                                y: parsed,
                              },
                            },
                            pushHistory: false,
                          });
                        }
                      }}
                      onBlur={() => {
                        if (initialPosYRef.current !== null) {
                          const parsed = Number.parseFloat(posYDraft.current);
                          const value = Number.isNaN(parsed)
                            ? element.transform.position.y
                            : parsed;
                          updateTransform({
                            updates: {
                              position: {
                                ...element.transform.position,
                                y: initialPosYRef.current,
                              },
                            },
                            pushHistory: false,
                          });
                          updateTransform({
                            updates: {
                              position: {
                                ...element.transform.position,
                                y: value,
                              },
                            },
                            pushHistory: true,
                          });
                          initialPosYRef.current = null;
                        }
                        isEditingPosY.current = false;
                        posYDraft.current = '';
                        forceRender();
                      }}
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
                          const clamped = clamp({
                            value: parsed,
                            min: 10,
                            max: 500,
                          });
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
                            updates: {
                              rotate: initialRotationRef.current,
                            },
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
                        if (initialRotationRef.current !== null) {
                          const parsed = Number.parseFloat(rotationDraft.current);
                          const value = Number.isNaN(parsed) ? element.transform.rotate : parsed;
                          updateTransform({
                            updates: {
                              rotate: initialRotationRef.current,
                            },
                            pushHistory: false,
                          });
                          updateTransform({
                            updates: { rotate: value },
                            pushHistory: true,
                          });
                          initialRotationRef.current = null;
                        }
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
          </PanelBaseView>
        </TabsContent>
        <TabsContent value="speech" className="mt-0 flex-1 overflow-auto">
          {/* 更新(2026-09-14)：TextSpeechPanel 已恢复（原误判为 AI 相关而删）。
					    ⚠️ 其 TTS 后端当前为**诚实占位**（localTool 尚无 /api/tts 端点，
					    调用即明确报错）—— 见 docs/133 §〇.4 与 engine/lib/tts/service.ts 注释。 */}
          <TextSpeechPanel elements={elementRefs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PresetButton({ preset, onClick }: { preset: TextStylePreset; onClick: () => void }) {
  const { preview } = preset;
  const isClearAll = preset.id === 'clear-all';

  const previewStyle: React.CSSProperties = isClearAll
    ? {}
    : {
        color: preview.color,
        backgroundColor: preview.backgroundColor,
        fontWeight: preview.fontWeight ?? 'bold',
        // 与画布渲染同判据（`width > 0`）：`width: 0` 的预设不该画出 0.5px 的"假描边"。
        WebkitTextStroke: hasTextStroke(preview.stroke)
          ? `${Math.max(preview.stroke.width * 0.5, 0.5)}px ${preview.stroke.color}`
          : undefined,
        textShadow: preview.shadow
          ? `${preview.shadow.offsetX}px ${preview.shadow.offsetY}px ${preview.shadow.blur}px ${preview.shadow.color}`
          : undefined,
      };

  const hasBg = !isClearAll && !!preview.backgroundColor;

  return (
    <button
      type="button"
      title={preset.name}
      className={cn(
        'flex size-10 cursor-pointer items-center justify-center rounded-md border text-lg font-bold transition-colors select-none',
        'hover:border-primary/50 hover:bg-accent/80',
        isClearAll && 'relative overflow-hidden',
      )}
      style={{
        backgroundColor: hasBg ? undefined : 'rgba(0,0,0,0.6)',
      }}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          onClick();
        }
      }}
    >
      {isClearAll ? (
        <svg
          width="22"
          height="22"
          viewBox="0 0 22 22"
          fill="none"
          className="text-muted-foreground"
        >
          <title>Clear All</title>
          <circle cx="11" cy="11" r="9" stroke="currentColor" strokeWidth="1.5" />
          <line x1="4.5" y1="17.5" x2="17.5" y2="4.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ) : (
        <span style={previewStyle} className={cn('leading-none', hasBg && 'rounded px-1 py-0.5')}>
          T
        </span>
      )}
    </button>
  );
}
