'use client';

import { Textarea } from '@/components/videoEditor/ui/ui/textarea';
import { FontPicker } from '@/components/videoEditor/ui/ui/font-picker';

import type { FontFamily } from '@/components/videoEditor/constants/font-constants';
// 字重档位的**唯一真源**：随字体而异（见该文件内 `FontOption.weights` 的判据）。
import { getFontWeights } from '@/components/videoEditor/constants/font-constants';
import type {
  TextElement,
  TextStroke,
  TextShadow,
  Transform,
} from '@/components/videoEditor/types/timeline';
import { Switch } from '@/components/videoEditor/ui/ui/switch';
import { Slider } from '@/components/videoEditor/ui/ui/slider';
import { Input } from '@/components/videoEditor/ui/ui/input';
import { Button } from '@/components/videoEditor/ui/ui/button';
import { useRef } from 'react';
import { PanelBaseView } from '@/components/videoEditor/ui/editor/panels/panel-base-view';
import { PropertyGroup, PropertyItem, PropertyItemLabel, PropertyItemValue } from './property-item';
import { ColorPicker } from '@/components/videoEditor/ui/ui/color-picker';
import { clamp } from '@/components/base/core/utils.ts';
import { useEditor } from '@/components/videoEditor/hooks-cutia/use-editor';
import { DEFAULT_COLOR } from '@/components/videoEditor/constants/project-constants';
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
} from '@/components/videoEditor/constants/text-constants';
import { TextSpeechPanel } from './text-speech-panel';
import {
  TEXT_STYLE_PRESETS,
  type TextStylePreset,
} from '@/components/videoEditor/constants/text-style-presets';
import { cn } from '@/components/videoEditor/utils/ui';
import { useDraftCommit } from './use-draft-commit';

interface TextElementRef {
  element: TextElement;
  trackId: string;
}

export function TextProperties({ elements: elementRefs }: { elements: TextElementRef[] }) {
  const element = elementRefs[0].element;

  const editor = useEditor('timeline');
  const containerRef = useRef<HTMLDivElement>(null);

  const buildBatchUpdates = (updates: Partial<Record<string, unknown>>) =>
    elementRefs.map((ref) => ({
      trackId: ref.trackId,
      elementId: ref.element.id,
      updates,
    }));

  // 【TD-22-20 · 组①】字号：编辑中预览、落定时「先还原 initial、再提交」（共用实现见 use-draft-commit）。
  // Slider 与 Input 共用**同一个** hook 实例 ⇒ 共享同一个 initial ⇒
  // 「拖完滑杆接着在输入框微调」这类连续编辑，撤销仍是**一次**回到起点。
  const fontSizeField = useDraftCommit<number>({
    value: element.fontSize,
    format: (v) => v.toString(),
    parse: (raw) => {
      const parsed = parseInt(raw, 10);
      return Number.isNaN(parsed) ? null : clamp(parsed, MIN_FONT_SIZE, MAX_FONT_SIZE);
    },
    commit: (fontSize, pushHistory) =>
      editor.timeline.updateElements({ updates: buildBatchUpdates({ fontSize }), pushHistory }),
  });

  const lastSelectedColor = useRef(DEFAULT_COLOR);

  const scalePercent = Math.round(element.transform.scale * 100);

  // 【TD-22-20 · 组①】数字字段（Input + Slider 两条路径，共用同一个 initial）——
  // 统一走 `useDraftCommit`，不再逐处手抄 refs/handler。
  // 注：`commit` 闭包在**事件里**才求值，故此处引用后面才定义的 `updateTransform` 是安全的。
  /** 不透明度：显示/提交都在 **percent 域**（0~100），落库时 /100。 */
  const opacityField = useDraftCommit<number>({
    value: Math.round(element.opacity * 100),
    format: (v) => v.toString(),
    parse: (raw) => {
      const parsed = parseInt(raw, 10);
      return Number.isNaN(parsed) ? null : clamp(parsed, 0, 100);
    },
    commit: (percent, pushHistory) =>
      editor.timeline.updateElements({
        updates: buildBatchUpdates({ opacity: percent / 100 }),
        pushHistory,
      }),
  });

  /** 位置 X：`value` 存**未取整**的原始值（与手抄一致 —— initial 与回退值都是它），仅显示取整。 */
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

  /** 位置 Y：同位置 X。 */
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
      return Number.isNaN(parsed) ? null : clamp(parsed, 10, 500);
    },
    commit: (percent, pushHistory) =>
      updateTransform({ updates: { scale: percent / 100 }, pushHistory }),
  });

  /** 旋转：`value` 存**未取整**的原始值（同位置 X）。 */
  const rotationField = useDraftCommit<number>({
    value: element.transform.rotate,
    format: (v) => Math.round(v).toString(),
    parse: (raw) => {
      const parsed = Number.parseFloat(raw);
      return Number.isNaN(parsed) ? null : parsed;
    },
    commit: (rotate, pushHistory) => updateTransform({ updates: { rotate }, pushHistory }),
  });

  // 【TD-22-20 · 组②】文本 / 颜色 / 背景 —— 与组① 同一个 hook，只是入口不同：
  //  · `content` 走 Textarea（同 Input 的 draft 路径）；
  //  · 颜色走 ColorPicker 的 `onChange`/`onChangeEnd`（**值直传**，`#` 换算由调用方做）；
  //  · 背景三项走 Slider（**值直传**）。
  // 无 Input 路径的字段，`format`/`parse` 给**恒等**实现（明示"本字段没有输入框入口"，
  // 而不是把它们做成可选参数 —— 那等于藏一个不安全的默认值）。
  const contentField = useDraftCommit<string>({
    value: element.content,
    format: (v) => v,
    parse: (raw) => raw,
    commit: (content, pushHistory) =>
      editor.timeline.updateElements({ updates: buildBatchUpdates({ content }), pushHistory }),
  });

  /** 文字颜色：ColorPicker 传「无 `#` 的十六进制」⇒ 提交时补 `#`；`value` 取面板既有口径（空则 `#FFFFFF`）。 */
  const colorField = useDraftCommit<string>({
    value: element.color || '#FFFFFF',
    format: (v) => v,
    parse: (raw) => raw,
    commit: (color, pushHistory) =>
      editor.timeline.updateElements({ updates: buildBatchUpdates({ color }), pushHistory }),
  });

  const bgColorField = useDraftCommit<string>({
    value: element.backgroundColor,
    format: (v) => v,
    parse: (raw) => raw,
    commit: (backgroundColor, pushHistory) =>
      editor.timeline.updateElements({
        updates: buildBatchUpdates({ backgroundColor }),
        pushHistory,
      }),
  });

  /**
   * 背景不透明度：字段是 **0~1 域**（与组① 的 `opacity` 不同，后者面板用 percent 域）。
   * 滑杆报 percent ⇒ 调用方除以 100 再进来；`initial` 因此也落在 0~1 域（还原值正确）。
   */
  const bgOpacityField = useDraftCommit<number>({
    value: element.backgroundOpacity ?? DEFAULT_BG_OPACITY,
    format: (v) => v.toString(),
    parse: (raw) => {
      const parsed = Number.parseFloat(raw);
      return Number.isNaN(parsed) ? null : parsed;
    },
    commit: (backgroundOpacity, pushHistory) =>
      editor.timeline.updateElements({
        updates: buildBatchUpdates({ backgroundOpacity }),
        pushHistory,
      }),
  });

  /** 背景圆角 / 高度 / 宽度：值域原样（0~50），仅 Slider。 */
  const bgBorderRadiusField = useDraftCommit<number>({
    value: element.backgroundBorderRadius ?? DEFAULT_BG_BORDER_RADIUS,
    format: (v) => v.toString(),
    parse: (raw) => {
      const parsed = Number.parseFloat(raw);
      return Number.isNaN(parsed) ? null : parsed;
    },
    commit: (backgroundBorderRadius, pushHistory) =>
      editor.timeline.updateElements({
        updates: buildBatchUpdates({ backgroundBorderRadius }),
        pushHistory,
      }),
  });

  const bgPaddingYField = useDraftCommit<number>({
    value: element.backgroundPaddingY ?? DEFAULT_BG_PADDING_Y,
    format: (v) => v.toString(),
    parse: (raw) => {
      const parsed = Number.parseFloat(raw);
      return Number.isNaN(parsed) ? null : parsed;
    },
    commit: (backgroundPaddingY, pushHistory) =>
      editor.timeline.updateElements({
        updates: buildBatchUpdates({ backgroundPaddingY }),
        pushHistory,
      }),
  });

  const bgPaddingXField = useDraftCommit<number>({
    value: element.backgroundPaddingX ?? DEFAULT_BG_PADDING_X,
    format: (v) => v.toString(),
    parse: (raw) => {
      const parsed = Number.parseFloat(raw);
      return Number.isNaN(parsed) ? null : parsed;
    },
    commit: (backgroundPaddingX, pushHistory) =>
      editor.timeline.updateElements({
        updates: buildBatchUpdates({ backgroundPaddingX }),
        pushHistory,
      }),
  });

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

  /**
   * 【TD-22-20 · 组②c】描边 / 阴影是**对象字段**：它们的多个入口（宽度滑杆 · 颜色选择器 ·
   * X/Y 偏移 · 模糊）改的是**同一个对象** ⇒ 属于**同一次编辑会话**，撤销应当**一次**回到起点。
   * 故按「**对象字段**」实例化（stroke 一个、shadow 一个），而不是按控件。
   *
   * 【与迁移前的**形态**差异（**不是**行为差异）】迁移前 shadow 的 3 个滑杆共享一个 initial（一致），
   * 而 stroke 的 **color 与 width 各持一个** initial（不一致）。收口后统一为
   * 「一个对象字段 ⇔ 一个 initial」。
   * ⚠️ 我一度判定这是"行为修正"（认为跨入口撤销会从两次变一次）—— **该判断已被证伪**：
   * 每次落定都会**清空** initial，故两个入口不可能**同时**持有 ⇒ 两种形态**行为等价**。
   * 证据：「旧实现 + 20 例新测试」全绿（见轮次日志的等价性验证）。
   *
   * 本字段无输入框入口 ⇒ `format`/`parse` 给恒等/恒空（明示"没有 draft 路径"）。
   */
  const strokeField = useDraftCommit<TextStroke>({
    value: currentStroke,
    format: () => '',
    parse: () => null,
    commit: (stroke, pushHistory) => updateStroke({ stroke, pushHistory }),
  });

  const shadowField = useDraftCommit<TextShadow>({
    value: currentShadow,
    format: () => '',
    parse: () => null,
    commit: (shadow, pushHistory) => updateShadow({ shadow, pushHistory }),
  });

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

  return (
    /* 分区/滚动/tab 全部交给壳（`PanelBaseView`）—— 这里只给出两个 tab 的**内容**。
       （原先是自造 `<Tabs>` + 在每个 `TabsContent` 里再套一个 `PanelBaseView`：
        既绕过面板语言，又让 tab 内容里出现第二个壳 —— 高度链与"非激活不占位"两处都靠运气。）
       `ref` 仍传 `containerRef`：色板（ColorPicker）要靠这个容器做面板内定位。 */
    <PanelBaseView
      ref={containerRef}
      defaultTab="style"
      tabs={[
        {
          value: 'style',
          label: '样式',
          content: (
            <>
              <PropertyGroup hasBorderTop={false}>
                <Textarea
                  placeholder="输入文字"
                  value={contentField.display}
                  // 紧凑：80px → 56px（3 行仍够写；面板纵向空间留给下方真正要调的属性）。
                  className="min-h-14"
                  onFocus={contentField.onFocus}
                  onChange={(event) => contentField.onChange(event.target.value)}
                  onBlur={contentField.onBlur}
                />
              </PropertyGroup>
              <PropertyGroup hasBorderTop>
                <PropertyItem>
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
                <PropertyItem>
                  {/* 【2026-09-19】字重从「B 开关（两档）」改为**按当前字体给档位**的横向选择。
                      判据：字重可选范围**随字体而异**（Arial/微软雅黑只有 400/700；苹方/思源有 6~7 档），
                      而 `ctx.font` 对不存在的字重是**静默取最近档** ⇒ 列出该字体没有的档
                      等于制造"选了没反应"的幽灵项。故档位来源 = `getFontWeights(当前字体)`
                      （`constants/font-constants.ts` 的唯一真源），**不写全局固定清单**。
                      非浏览器可见文案：档位名由该真源给（常规 / 加粗…），此处只渲染。 */}
                  <PropertyItemLabel>{'字重'}</PropertyItemLabel>
                  <PropertyItemValue>
                    <div className="flex items-center gap-1">
                      {getFontWeights({ fontFamily: element.fontFamily }).map((weight) => (
                        <Button
                          key={weight.value}
                          variant={element.fontWeight === weight.value ? 'default' : 'outline'}
                          size="sm"
                          onClick={() =>
                            editor.timeline.updateElements({
                              updates: buildBatchUpdates({ fontWeight: weight.value }),
                            })
                          }
                          className="h-8 px-2.5"
                          style={{ fontWeight: weight.value }}
                        >
                          {weight.label}
                        </Button>
                      ))}
                    </div>
                  </PropertyItemValue>
                </PropertyItem>
                <PropertyItem>
                  <PropertyItemLabel>{'样式'}</PropertyItemLabel>
                  <PropertyItemValue>
                    <div className="flex items-center gap-2">
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
                <PropertyItem>
                  <PropertyItemLabel>{'字号'}</PropertyItemLabel>
                  <PropertyItemValue>
                    <div className="flex items-center gap-2">
                      <Slider
                        value={[element.fontSize]}
                        min={MIN_FONT_SIZE}
                        max={MAX_FONT_SIZE}
                        step={1}
                        onValueChange={([value]) => fontSizeField.onSliderChange(value)}
                        onValueCommit={([value]) => fontSizeField.onSliderCommit(value)}
                        className="w-full"
                      />
                      <Input
                        type="number"
                        value={fontSizeField.display}
                        min={MIN_FONT_SIZE}
                        max={MAX_FONT_SIZE}
                        onFocus={fontSizeField.onFocus}
                        onChange={(e) => fontSizeField.onChange(e.target.value)}
                        onBlur={fontSizeField.onBlur}
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
                <PropertyItem>
                  <PropertyItemLabel>{'颜色'}</PropertyItemLabel>
                  <PropertyItemValue>
                    <ColorPicker
                      value={element.color || 'FFFFFF'}
                      onChange={(color) => colorField.onSliderChange(`#${color}`)}
                      onChangeEnd={(color) => colorField.onSliderCommit(`#${color}`)}
                      containerRef={containerRef}
                    />
                  </PropertyItemValue>
                </PropertyItem>
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
              {/*
              样式 —— **背景 / 描边 / 阴影共用一个折叠头**（用户 2026-09-15："把描边、阴影和背景
              给它们设置成一个统一的折叠头，叫样式，而不是一人一个"）。
              · 原先是三个平级折叠头 → 面板被切成三块，用户要分别点开才知道里面有什么；
                它们本就是同一件事（文字的外观修饰）的三个字段，故收为一个组。
              · 组内三段各以一个**带顶边框的 `PropertyItem`**（分隔行）开头，一眼看出是三段。
              · 展开判据：三段**任一**有值就默认展开（沿用各段原有的"有值即展开"口径，
                收口在 `hasTextBackground` / `hasTextStroke` / `hasTextShadow`，
                不再各写一份表达式）。
            */}
              <PropertyGroup title={'样式'} defaultExpanded={hasStyleSection}>
                <PropertyItem className="border-t border-border/50 pt-2 mt-1">
                  <PropertyItemLabel>{'背景'}</PropertyItemLabel>
                  <PropertyItemValue>
                    <div className="flex items-center gap-2">
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
                      <ColorPicker
                        value={element.backgroundColor}
                        onChange={(color) => {
                          // 记住"用户最后选的实色"，供背景开关打开时复用（原 handleColorChange 的副作用，保留）。
                          if (color !== 'transparent') lastSelectedColor.current = color;
                          bgColorField.onSliderChange(`#${color}`);
                        }}
                        onChangeEnd={(color) => bgColorField.onSliderCommit(`#${color}`)}
                        containerRef={containerRef}
                      />
                    </div>
                  </PropertyItemValue>
                </PropertyItem>
                {backgroundEnabled && (
                  <>
                    <PropertyItem>
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
                            onValueChange={([value]) => bgOpacityField.onSliderChange(value / 100)}
                            onValueCommit={([value]) => bgOpacityField.onSliderCommit(value / 100)}
                            className="w-full"
                          />
                          <span className="text-muted-foreground w-8 text-center text-xs">
                            {Math.round((element.backgroundOpacity ?? DEFAULT_BG_OPACITY) * 100)}
                          </span>
                        </div>
                      </PropertyItemValue>
                    </PropertyItem>
                    <PropertyItem>
                      <PropertyItemLabel>{'圆角半径'}</PropertyItemLabel>
                      <PropertyItemValue>
                        <div className="flex items-center gap-2">
                          <Slider
                            value={[element.backgroundBorderRadius ?? DEFAULT_BG_BORDER_RADIUS]}
                            min={0}
                            max={50}
                            step={1}
                            onValueChange={([value]) => bgBorderRadiusField.onSliderChange(value)}
                            onValueCommit={([value]) => bgBorderRadiusField.onSliderCommit(value)}
                            className="w-full"
                          />
                          <span className="text-muted-foreground w-8 text-center text-xs">
                            {element.backgroundBorderRadius ?? DEFAULT_BG_BORDER_RADIUS}
                          </span>
                        </div>
                      </PropertyItemValue>
                    </PropertyItem>
                    <PropertyItem>
                      <PropertyItemLabel>{'高度'}</PropertyItemLabel>
                      <PropertyItemValue>
                        <div className="flex items-center gap-2">
                          <Slider
                            value={[element.backgroundPaddingY ?? DEFAULT_BG_PADDING_Y]}
                            min={0}
                            max={50}
                            step={1}
                            onValueChange={([value]) => bgPaddingYField.onSliderChange(value)}
                            onValueCommit={([value]) => bgPaddingYField.onSliderCommit(value)}
                            className="w-full"
                          />
                          <span className="text-muted-foreground w-8 text-center text-xs">
                            {element.backgroundPaddingY ?? DEFAULT_BG_PADDING_Y}
                          </span>
                        </div>
                      </PropertyItemValue>
                    </PropertyItem>
                    <PropertyItem>
                      <PropertyItemLabel>{'宽度'}</PropertyItemLabel>
                      <PropertyItemValue>
                        <div className="flex items-center gap-2">
                          <Slider
                            value={[element.backgroundPaddingX ?? DEFAULT_BG_PADDING_X]}
                            min={0}
                            max={50}
                            step={1}
                            onValueChange={([value]) => bgPaddingXField.onSliderChange(value)}
                            onValueCommit={([value]) => bgPaddingXField.onSliderCommit(value)}
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
                <PropertyItem className="border-t border-border/50 pt-2 mt-1">
                  <PropertyItemLabel>{'描边'}</PropertyItemLabel>
                  <PropertyItemValue>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={strokeEnabled}
                        onCheckedChange={(checked) => {
                          updateStroke({
                            stroke: {
                              ...currentStroke,
                              width: checked ? 1 : NO_STROKE_WIDTH,
                            },
                          });
                        }}
                      />
                      <ColorPicker
                        value={currentStroke.color}
                        onChange={(color) =>
                          strokeField.onSliderChange({ ...currentStroke, color: `#${color}` })
                        }
                        onChangeEnd={(color) =>
                          strokeField.onSliderCommit({ ...currentStroke, color: `#${color}` })
                        }
                        containerRef={containerRef}
                      />
                    </div>
                  </PropertyItemValue>
                </PropertyItem>
                {strokeEnabled && (
                  <PropertyItem>
                    <PropertyItemLabel>{'宽度'}</PropertyItemLabel>
                    <PropertyItemValue>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[currentStroke.width]}
                          min={1}
                          max={MAX_STROKE_WIDTH}
                          step={1}
                          onValueChange={([value]) =>
                            strokeField.onSliderChange({ ...currentStroke, width: value })
                          }
                          onValueCommit={([value]) =>
                            strokeField.onSliderCommit({ ...currentStroke, width: value })
                          }
                          className="w-full"
                        />
                        <span className="text-muted-foreground w-8 text-center text-xs">
                          {currentStroke.width}
                        </span>
                      </div>
                    </PropertyItemValue>
                  </PropertyItem>
                )}

                {/*
              阴影 —— 这里**保留**「启用」开关（与描边不同，不是口径不一致）：
              阴影的"没有"是 `shadow === undefined`，没有一个自然的 0 值能表达"关"——
              X/Y 偏移为 0 只是"正后方投影"，仍是有阴影。所以必须有个布尔来创建/移除对象。
            */}
                <PropertyItem className="border-t border-border/50 pt-2 mt-1">
                  <PropertyItemLabel>{'阴影'}</PropertyItemLabel>
                  <PropertyItemValue>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={shadowEnabled}
                        onCheckedChange={(checked) => {
                          updateShadow({
                            shadow: checked ? { ...DEFAULT_TEXT_SHADOW } : undefined,
                          });
                        }}
                      />
                      <ColorPicker
                        value={currentShadow.color}
                        onChange={(color) =>
                          shadowField.onSliderChange({ ...currentShadow, color: `#${color}` })
                        }
                        onChangeEnd={(color) =>
                          shadowField.onSliderCommit({ ...currentShadow, color: `#${color}` })
                        }
                        containerRef={containerRef}
                      />
                    </div>
                  </PropertyItemValue>
                </PropertyItem>
                {shadowEnabled && (
                  <>
                    <PropertyItem>
                      <PropertyItemLabel>{'X 偏移'}</PropertyItemLabel>
                      <PropertyItemValue>
                        <div className="flex items-center gap-2">
                          <Slider
                            value={[currentShadow.offsetX]}
                            min={-20}
                            max={20}
                            step={1}
                            onValueChange={([value]) =>
                              shadowField.onSliderChange({ ...currentShadow, offsetX: value })
                            }
                            onValueCommit={([value]) =>
                              shadowField.onSliderCommit({ ...currentShadow, offsetX: value })
                            }
                            className="w-full"
                          />
                          <span className="text-muted-foreground w-8 text-center text-xs">
                            {currentShadow.offsetX}
                          </span>
                        </div>
                      </PropertyItemValue>
                    </PropertyItem>
                    <PropertyItem>
                      <PropertyItemLabel>{'Y 偏移'}</PropertyItemLabel>
                      <PropertyItemValue>
                        <div className="flex items-center gap-2">
                          <Slider
                            value={[currentShadow.offsetY]}
                            min={-20}
                            max={20}
                            step={1}
                            onValueChange={([value]) =>
                              shadowField.onSliderChange({ ...currentShadow, offsetY: value })
                            }
                            onValueCommit={([value]) =>
                              shadowField.onSliderCommit({ ...currentShadow, offsetY: value })
                            }
                            className="w-full"
                          />
                          <span className="text-muted-foreground w-8 text-center text-xs">
                            {currentShadow.offsetY}
                          </span>
                        </div>
                      </PropertyItemValue>
                    </PropertyItem>
                    <PropertyItem>
                      <PropertyItemLabel>{'模糊'}</PropertyItemLabel>
                      <PropertyItemValue>
                        <div className="flex items-center gap-2">
                          <Slider
                            value={[currentShadow.blur]}
                            min={0}
                            max={30}
                            step={1}
                            onValueChange={([value]) =>
                              shadowField.onSliderChange({ ...currentShadow, blur: value })
                            }
                            onValueCommit={([value]) =>
                              shadowField.onSliderCommit({ ...currentShadow, blur: value })
                            }
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
            </>
          ),
        },
        {
          value: 'speech',
          label: '语音',
          content: (
            <>
              {/* 更新(2026-09-14)：TextSpeechPanel 已恢复（原误判为 AI 相关而删）。
                  ⚠️ 其 TTS 后端当前为**诚实占位**（localTool 尚无 /api/tts 端点，
                  调用即明确报错）—— 见 docs/133 §〇.4 与 engine/lib/tts/service.ts 注释。 */}
              <TextSpeechPanel elements={elementRefs} />
            </>
          ),
        },
      ]}
    />
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
        // 【2026-09-19】补 `?? 700` 的默认值说明：预设未声明字重时按"加粗"预览（与既有观感一致）。
        // 数字口径与 `TextElement.fontWeight` 统一 —— 不再混用 `'bold'` 字符串（避免两套写法）。
        fontWeight: preview.fontWeight ?? 700,
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
          <title>全部清除</title>
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
