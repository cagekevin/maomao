// @vitest-environment node
/**
 * 守卫：**「输出 = 预览」的每条真源都只有一个产生方**。
 *
 * ════════════════════════════════════════════════════════════════
 * 母体：同一件事被预览链与导出链（或渲染 / 框子 / 命中三方）各写一遍 ⇒ 必然漂移。
 * 本文件锁住四条已收口的真源 + 几何：
 *
 *   ① 图层序：顺序 = `tracks` 数组序（下标 0 = 最上层，绘制序取反序）。
 *      曾按 `isMainTrack` 在读取期重推导 ⇒ 用户拖过的顺序在预览 / 导出 / 缩略图里失效。
 *   ② 可见性：`hidden` = 不参与输出（画面 **与声音**）。消费方一律经 `getOutputTracks`
 *      投影（拿不到隐藏项）⇒ 漏判无处发生；曾漏判音频路径 ⇒ 关眼睛后声音照播、成片带声音。
 *   ③ 音频：判据 `collectAudioSources`（纯函数）+ 取字节 `resolveAudioSourceBuffer`
 *      为预览与导出**共用**；曾各写一条采集链（`element.buffer` 只被导出读等）。
 *   ④ 帧时刻：`getFrameCount` / `getLastFrameTime` 唯一 —— 预览夹末帧与导出循环同数同刻。
 *   ⑤ 元素矩形：`getElementCanvasRect` 唯一，且**尺寸来源**（`MediaAsset.width/height`）
 *      与渲染节点的 `mediaSize` 同源；曾三份算式（渲染 / 框子 / 命中），口径各不相同。
 * ════════════════════════════════════════════════════════════════
 *
 * 【为什么用 video 元素而不是 image】`ImageNode` 构造即 `new Image()`（DOM），
 * node 环境下会抛未处理的 rejection；`VideoNode` 构造是同步的（取帧在 render 期）。
 */
import { must } from '../helpers/must';
import { describe, expect, it } from 'vitest';
import { at } from '../helpers/at';
import type { MediaAsset } from '../../src/components/videoEditor/types/mediaAssets';
import type {
  TimelineTrack,
  TimelineElement,
  TextElement,
  VideoElement,
} from '../../src/components/videoEditor/types/timeline';
import type { TextMeasureContext } from '../../src/components/videoEditor/engine/services/renderer/text-layout.ts';
import { getElementCanvasRect } from '../../src/components/videoEditor/engine/lib/preview/element-bounds.ts';
import {
  canSplitElementAtTime,
  getElementTimeRange,
  getElementsAtTime,
  isElementActiveAtTime,
  isElementMuted,
} from '../../src/components/videoEditor/engine/timeline/element-utils.ts';
import { isTrackMuted } from '../../src/components/videoEditor/engine/timeline/track-utils.ts';
import { probeMediaDimensions } from '../../src/components/videoEditor/engine/lib/media/processing.ts';
import { buildScene } from '../../src/components/videoEditor/engine/services/renderer/scene-builder.ts';
import { getSelectedVideoClip } from '../../src/components/videoEditor/engine/lib/export.ts';
import {
  collectAudioSources,
  createTimelineAudioBuffer,
} from '../../src/components/videoEditor/engine/lib/media/audio.ts';
import {
  getFrameCount,
  getLastFrameTime,
} from '../../src/components/videoEditor/engine/lib/time.ts';

const CANVAS = { width: 1920, height: 1080 };

function makeVideoAsset({ id }: { id: string }): MediaAsset {
  return {
    id,
    type: 'video',
    name: `${id}.mp4`,
    url: `https://example.test/${id}`,
    file: { arrayBuffer: async () => new ArrayBuffer(8) } as unknown as File,
  } as unknown as MediaAsset;
}

const VIDEO_ASSETS: MediaAsset[] = [
  makeVideoAsset({ id: 'm-main' }),
  makeVideoAsset({ id: 'm-overlay' }),
];

function makeVideoElement({
  id,
  mediaId,
  hidden,
}: {
  id: string;
  mediaId: string;
  hidden?: boolean | undefined;
}): VideoElement {
  return {
    id,
    name: id,
    type: 'video',
    mediaId,
    startTime: 0,
    duration: 1,
    trimStart: 0,
    hidden,
    muted: false,
    opacity: 1,
    reversed: false,
    transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
  } as unknown as VideoElement;
}

function makeVideoTrack({
  id,
  isMain,
  hidden,
  elementHidden,
  mediaId,
}: {
  id: string;
  isMain: boolean;
  hidden?: boolean | undefined;
  elementHidden?: boolean | undefined;
  mediaId: string;
}): TimelineTrack {
  return {
    id,
    name: id,
    type: 'video',
    isMain,
    muted: false,
    hidden: hidden ?? false,
    elements: [makeVideoElement({ id: `${id}-el`, mediaId, hidden: elementHidden })],
  } as unknown as TimelineTrack;
}

/** 渲染树的绘制序（子节点加入序 = 由底到顶；末位 = 最上层）。 */
function sceneDrawOrderUrls({ tracks }: { tracks: TimelineTrack[] }): Array<string | undefined> {
  const scene = buildScene({
    tracks,
    mediaAssets: VIDEO_ASSETS,
    duration: 1,
    // 适配基准由 `buildScene` 内部从 settings 派生（调用方拿不到 `fitCanvasSize` 参数）。
    settings: {
      canvasSize: CANVAS,
      originalCanvasSize: null,
      background: { type: 'color', color: 'transparent' },
    },
  });

  return scene.children.map((child) => (child.params as { url?: string }).url);
}

describe('图层序 = 轨道数组序（下标 0 = 最上层）', () => {
  it('主轨排在数组首位 ⇒ 它必须**画在最上层**（不因 isMain 被挪到末位）', () => {
    const tracks = [
      makeVideoTrack({ id: 't-main', isMain: true, mediaId: 'm-main' }),
      makeVideoTrack({ id: 't-overlay', isMain: false, mediaId: 'm-overlay' }),
    ];

    // 绘制序 = 数组反序 ⇒ [overlay, main]，末位（最上层）是主轨。
    expect(sceneDrawOrderUrls({ tracks })).toEqual([
      'https://example.test/m-overlay',
      'https://example.test/m-main',
    ]);
  });

  it('交换数组序 ⇒ 绘制序随之反转（顺序是用户的编排结果，不是可推导属性）', () => {
    const tracks = [
      makeVideoTrack({ id: 't-overlay', isMain: false, mediaId: 'm-overlay' }),
      makeVideoTrack({ id: 't-main', isMain: true, mediaId: 'm-main' }),
    ];

    expect(sceneDrawOrderUrls({ tracks })).toEqual([
      'https://example.test/m-main',
      'https://example.test/m-overlay',
    ]);
  });
});

describe('hidden = 不参与输出（画面）', () => {
  it('隐藏轨不进渲染树', () => {
    const tracks = [
      makeVideoTrack({ id: 't-main', isMain: true, hidden: true, mediaId: 'm-main' }),
      makeVideoTrack({ id: 't-overlay', isMain: false, mediaId: 'm-overlay' }),
    ];

    expect(sceneDrawOrderUrls({ tracks })).toEqual(['https://example.test/m-overlay']);
  });

  it('隐藏元素不进渲染树（轨仍在）', () => {
    const tracks = [
      makeVideoTrack({ id: 't-main', isMain: true, elementHidden: true, mediaId: 'm-main' }),
      makeVideoTrack({ id: 't-overlay', isMain: false, mediaId: 'm-overlay' }),
    ];

    expect(sceneDrawOrderUrls({ tracks })).toEqual(['https://example.test/m-overlay']);
  });
});

describe('hidden = 不参与输出（声音）', () => {
  const onlyMain = [{ id: 'm-main', type: 'video' } as unknown as MediaAsset];

  function track({
    hidden,
    elementHidden,
  }: {
    hidden?: boolean | undefined;
    elementHidden?: boolean | undefined;
  }): TimelineTrack {
    return makeVideoTrack({
      id: 't-video',
      isMain: false,
      hidden,
      elementHidden,
      mediaId: 'm-main',
    });
  }

  it('前置：未隐藏时该轨确实采集得到声音（证明下面的断言会红）', () => {
    const { items } = collectAudioSources({ tracks: [track({})], mediaAssets: onlyMain });

    expect(items).toHaveLength(1);
  });

  it('隐藏轨 ⇒ 采集不到它的声音（预览与导出**同一份判据**）', () => {
    const { items } = collectAudioSources({
      tracks: [track({ hidden: true })],
      mediaAssets: onlyMain,
    });

    expect(items).toEqual([]);
  });

  it('隐藏元素 ⇒ 采集不到它的声音', () => {
    const { items } = collectAudioSources({
      tracks: [track({ elementHidden: true })],
      mediaAssets: onlyMain,
    });

    expect(items).toEqual([]);
  });

  it('导出 / 字幕混音路径（createTimelineAudioBuffer）同样不出被隐藏轨的声音', async () => {
    const decoded = {
      numberOfChannels: 1,
      length: 8,
      sampleRate: 44100,
      duration: 8 / 44100,
      getChannelData: () => new Float32Array(8),
    } as unknown as AudioBuffer;

    const audioContext = {
      decodeAudioData: async () => decoded,
      createBuffer: () => decoded,
    } as unknown as AudioContext;
    const mediaWithFile = VIDEO_ASSETS.filter((asset) => asset.id === 'm-main');

    const audible = await createTimelineAudioBuffer({
      tracks: [track({})],
      mediaAssets: mediaWithFile,
      duration: 1,
      audioContext,
    });
    expect(audible).not.toBeNull();

    const silenced = await createTimelineAudioBuffer({
      tracks: [track({ hidden: true })],
      mediaAssets: mediaWithFile,
      duration: 1,
      audioContext,
    });
    expect(silenced).toBeNull();
  });

  it('全部音源解析失败 ⇒ 不产出音轨（null），而不是返回一条全零 buffer', async () => {
    const failingContext = {
      decodeAudioData: async () => {
        throw new Error('bad file');
      },
      createBuffer: () => ({}) as AudioBuffer,
    } as unknown as AudioContext;

    const result = await createTimelineAudioBuffer({
      tracks: [track({})],
      mediaAssets: VIDEO_ASSETS.filter((asset) => asset.id === 'm-main'),
      duration: 1,
      audioContext: failingContext,
    });

    // 判据：**有声音才出音轨**。返回全零 buffer 等于凭空多一条没内容的音轨，
    // 且把"全部解析失败"掩盖成"有音轨"。
    expect(result).toBeNull();
  });
});

describe('文本几何（与渲染同一份排版）', () => {
  // 画布高取 90（= `FONT_SIZE_SCALE_REFERENCE`）⇒ 缩放系数 = 1，字号 = `fontSize`，便于手算。
  const SETTINGS = { canvasSize: { width: 1000, height: 90 }, originalCanvasSize: null };

  // 假测量上下文：宽 10px/字符、ascent 8 / descent 2 ⇒ 单行高 = 10；行高 = 15 × 1.3 = 19.5。
  // 生产代码走 `getTextMeasureContext()`（离屏 canvas）；此注入点专为"文本几何原本没有机器判据"而留。
  const measure = {
    font: '',
    measureText: (text: string) =>
      ({
        width: text.length * 10,
        actualBoundingBoxAscent: 8,
        actualBoundingBoxDescent: 2,
      }) as TextMetrics,
  } as TextMeasureContext;

  function makeTextElement({
    name = 'Text',
    content = 'abc',
    textAlign = 'center',
    boxWidth,
  }: {
    name?: string;
    content?: string;
    textAlign?: 'left' | 'center' | 'right';
    boxWidth?: number;
  } = {}): TextElement {
    return {
      id: 'el-text',
      name,
      type: 'text',
      content,
      fontSize: 15,
      fontFamily: 'Arial',
      fontWeight: 400,
      fontStyle: 'normal',
      textAlign,
      boxWidth,
      color: '#ffffff',
      backgroundColor: 'transparent',
      startTime: 0,
      duration: 1,
      trimStart: 0,
      opacity: 1,
      transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
    } as unknown as TextElement;
  }

  function rectOf(element: TextElement) {
    return getElementCanvasRect({
      element,
      transform: element.transform,
      settings: SETTINGS,
      measureContext: measure,
    });
  }

  it('宽高来自实测排版（不是 `字符数 × 字号 × 0.6` 估算）', () => {
    const rect = rectOf(makeTextElement());

    expect(rect?.width).toBeCloseTo(30, 6); // 3 字符 × 10
    expect(rect?.height).toBeCloseTo(10, 6); // ascent 8 + descent 2
  });

  it('底部对齐字幕（`Caption N`）：中心 = 底边 − 高度/2', () => {
    // 画布高 90 ⇒ 锚点 y = 45；高 10 ⇒ 中心 = 40。
    // 曾误写成 `− height`（= 35，整体抬高半个字高）⇒ 字幕框上移、文字下半部分点不中。
    const rect = rectOf(makeTextElement({ name: 'Caption 1' }));

    expect(rect?.centerY).toBeCloseTo(40, 6);
    expect(rect?.centerY).not.toBeCloseTo(35, 6);
  });

  it('单行左 / 右对齐：锚点是**行首 / 行尾**，中心随之偏 ±W/2', () => {
    expect(rectOf(makeTextElement({ textAlign: 'center' }))?.centerX).toBeCloseTo(500, 6);
    // 左对齐 ⇒ 文字占 `[x, x+30]` ⇒ 中心 515
    expect(rectOf(makeTextElement({ textAlign: 'left' }))?.centerX).toBeCloseTo(515, 6);
    // 右对齐 ⇒ 文字占 `[x−30, x]` ⇒ 中心 485
    expect(rectOf(makeTextElement({ textAlign: 'right' }))?.centerX).toBeCloseTo(485, 6);
  });

  it('多行换行：行数与最宽行宽来自实测（`boxWidth` 只作换行上限）', () => {
    // 框宽 45、每字符 10 ⇒ 'abcd'(40) 放得下、'abcde'(50) 放不下 ⇒ 两行 ['abcd','ef']
    const rect = rectOf(makeTextElement({ content: 'abcdef', boxWidth: 45 }));

    expect(rect?.width).toBeCloseTo(40, 6); // 最宽行 'abcd'
    expect(rect?.height).toBeCloseTo(39, 6); // 2 行 × 19.5
  });

  it('多行左对齐：每行从 `−boxWidth/2` 起（与单行锚点**不同**，不得混用）', () => {
    // 框宽 45、最宽行 40 ⇒ 并集 `[−22.5, 17.5]` ⇒ 中心 = 500 + (−22.5 + 20) = 497.5
    const rect = rectOf(makeTextElement({ content: 'abcdef', boxWidth: 45, textAlign: 'left' }));
    expect(rect?.centerX).toBeCloseTo(497.5, 6);

    // 多行居中 ⇒ 中心仍 = 锚点
    const centered = rectOf(
      makeTextElement({ content: 'abcdef', boxWidth: 45, textAlign: 'center' }),
    );
    expect(centered?.centerX).toBeCloseTo(500, 6);
  });
});

describe('开关判据（每个开关一个谓词，消费方禁直读字段）', () => {
  const el = (fields: Record<string, unknown>) =>
    ({ id: 'el', startTime: 0, duration: 1, ...fields }) as unknown as TimelineElement;

  it('元素静音：只有能出声的元素（video／audio）才谈静音，`muted` 缺失 = 不静音', () => {
    expect(isElementMuted(el({ type: 'video' }))).toBe(false);
    expect(isElementMuted(el({ type: 'video', muted: true }))).toBe(true);
    expect(isElementMuted(el({ type: 'audio', muted: true }))).toBe(true);
    // 文本元素即便带 `muted: true` 也不算静音（它没有声音语义）——
    // 这条正是「`canElementHaveAudio` 判据」与「裸 `'muted' in element`」的**唯一实质差别**。
    expect(isElementMuted(el({ type: 'text', muted: true }))).toBe(false);
  });

  it('轨静音：只有能出声的轨（video／audio）才谈静音', () => {
    expect(isTrackMuted({ type: 'video', muted: true } as unknown as TimelineTrack)).toBe(true);
    expect(isTrackMuted({ type: 'audio', muted: true } as unknown as TimelineTrack)).toBe(true);
    expect(isTrackMuted({ type: 'text', muted: true } as unknown as TimelineTrack)).toBe(false);
  });
});

describe('元素时间区间（唯一定义 + 两个边界判据）', () => {
  const element = { id: 'el', startTime: 2, duration: 3 } as unknown as TimelineElement;
  const tracks = [
    { id: 't', type: 'video', muted: false, elements: [element] },
  ] as unknown as TimelineTrack[];

  it('区间 = `[startTime, startTime + duration)`（唯一定义）', () => {
    expect(getElementTimeRange({ element })).toEqual({ start: 2, end: 5 });
  });

  it('"该不该显示 / 命中" = 半开区间：起点算、终点不算', () => {
    expect(isElementActiveAtTime({ element, time: 1.999 })).toBe(false);
    expect(isElementActiveAtTime({ element, time: 2 })).toBe(true);
    expect(isElementActiveAtTime({ element, time: 4.999 })).toBe(true);
    expect(isElementActiveAtTime({ element, time: 5 })).toBe(false);
  });

  it('"能不能切" = 开区间：端点都不算（端点上切会产出 0 长度段）', () => {
    expect(canSplitElementAtTime({ element, time: 2 })).toBe(false);
    expect(canSplitElementAtTime({ element, time: 3.5 })).toBe(true);
    expect(canSplitElementAtTime({ element, time: 5 })).toBe(false);
  });

  it('分割的**选取侧**（`getElementsAtTime`）与**执行侧**（`SplitElementsCommand` 守卫）同判据', () => {
    // 起点不可切 ⇒ 选取侧必须也返回空，否则命令会空转一次 updateTracks + 压一条空历史记录
    // （用户按撤销时"什么都没变"）。两侧曾各写一份区间算式（一处开区间、一处半开）。
    expect(getElementsAtTime({ tracks, time: 2 })).toEqual([]);
    expect(getElementsAtTime({ tracks, time: 3.5 })).toHaveLength(1);
    expect(getElementsAtTime({ tracks, time: 5 })).toEqual([]);
  });
});

describe('「这一刻该不该显示 / 命中」唯一判据（半开区间）', () => {
  const element = { startTime: 2, duration: 3 } as unknown as TimelineElement;

  it('区间 = `[startTime, startTime + duration)`：起点算、终点不算', () => {
    expect(isElementActiveAtTime({ element, time: 1.999 })).toBe(false);
    expect(isElementActiveAtTime({ element, time: 2 })).toBe(true);
    expect(isElementActiveAtTime({ element, time: 4.999 })).toBe(true);
    // 终点必须**不算**：命中 / 框子 / 吸附 / 文本绘制共用此口径，
    // 谁改成闭区间就会在交界那一帧出现"框子画着却点不中"。
    expect(isElementActiveAtTime({ element, time: 5 })).toBe(false);
  });
});

describe('元素矩形唯一（画面 / 框子 / 命中同源）', () => {
  const SETTINGS = {
    canvasSize: CANVAS,
    originalCanvasSize: null,
    background: { type: 'color' as const, color: 'transparent' },
  };

  it('媒体矩形 = 素材元数据 × 适配基准（与渲染节点读同一个 `mediaSize`）', () => {
    const assets = [
      {
        ...makeVideoAsset({ id: 'm-main' }),
        width: 800,
        height: 600,
      } as unknown as MediaAsset,
    ];
    const element = makeVideoElement({ id: 'el', mediaId: 'm-main' });
    const scene = buildScene({
      tracks: [makeVideoTrack({ id: 't', isMain: false, mediaId: 'm-main' })],
      mediaAssets: assets,
      duration: 1,
      settings: SETTINGS,
    });

    // 渲染侧拿到的显示尺寸
    expect((at(scene.children, 0).params as { mediaSize?: unknown }).mediaSize).toEqual({
      width: 800,
      height: 600,
    });

    // 几何侧算出的矩形 = 同一尺寸 × contain（1920/800=2.4 · 1080/600=1.8 ⇒ 1.8）
    const rect = getElementCanvasRect({
      element,
      transform: element.transform,
      media: assets[0],
      settings: SETTINGS,
    });
    expect(rect?.width).toBeCloseTo(800 * 1.8, 6);
    expect(rect?.height).toBeCloseTo(600 * 1.8, 6);
  });

  it('素材缺尺寸 ⇒ 渲染与几何**同时**回落到画布尺寸（不再一处用真实尺寸、一处用画布）', () => {
    const assets = [makeVideoAsset({ id: 'm-main' })]; // 无 width / height
    const element = makeVideoElement({ id: 'el', mediaId: 'm-main' });
    const scene = buildScene({
      tracks: [makeVideoTrack({ id: 't', isMain: false, mediaId: 'm-main' })],
      mediaAssets: assets,
      duration: 1,
      settings: SETTINGS,
    });

    expect((at(scene.children, 0).params as { mediaSize?: unknown }).mediaSize).toEqual(CANVAS);

    const rect = getElementCanvasRect({
      element,
      transform: element.transform,
      media: assets[0],
      settings: SETTINGS,
    });
    expect(rect?.width).toBeCloseTo(CANVAS.width, 6);
    expect(rect?.height).toBeCloseTo(CANVAS.height, 6);
  });

  it('贴纸矩形用**适配基准**（与渲染同源），不是当前画布', () => {
    const settings = {
      canvasSize: { width: 1000, height: 1000 },
      originalCanvasSize: { width: 500, height: 500 },
      background: { type: 'color' as const, color: 'transparent' },
    };
    const element = {
      id: 'el-sticker',
      name: 's',
      type: 'sticker',
      iconName: 'mdi:star',
      startTime: 0,
      duration: 1,
      trimStart: 0,
      opacity: 1,
      transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
    } as unknown as TimelineElement;

    // 源边长 200：适配基准 500 ⇒ contain 2.5 ⇒ 500。
    // 旧实现用**当前画布** 1000 ⇒ 5 ⇒ 1000（框子是画面的两倍）。
    const rect = getElementCanvasRect({
      element,
      transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
      settings,
    });
    expect(rect?.width).toBeCloseTo(500, 6);
    expect(rect?.width).not.toBeCloseTo(1000, 6);
  });

  it('音频元素没有画布矩形（不参与叠加层 / 命中）', () => {
    const element = { id: 'el-audio', type: 'audio' } as unknown as TimelineElement;

    expect(
      getElementCanvasRect({
        element,
        transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
        settings: SETTINGS,
      }),
    ).toBeNull();
  });
});

describe('素材尺寸补全（登记唯一入口）', () => {
  it('音频没有尺寸概念 ⇒ null', async () => {
    expect(await probeMediaDimensions({ file: {} as File, type: 'audio' })).toBeNull();
  });

  it('探测失败 ⇒ null 且不抛（不阻断素材登记）', async () => {
    // node 环境没有 window.Image ⇒ 图片探测必然失败；此处锁的是"失败不阻断登记"的契约。
    expect(await probeMediaDimensions({ file: {} as File, type: 'image' })).toBeNull();
  });
});

describe('导出选中片段：显式选中优先于 hidden（不得出「全黑 + 报成功」）', () => {
  const SETTINGS = {
    canvasSize: CANVAS,
    originalCanvasSize: null,
    background: { type: 'color' as const, color: 'transparent' },
  };

  it('被隐藏的片段单独导出时仍进渲染树（否则渲染树为空 ⇒ 成片全黑却报成功）', () => {
    const tracks = [
      makeVideoTrack({
        id: 't-video',
        isMain: false,
        hidden: true,
        elementHidden: true,
        mediaId: 'm-main',
      }),
    ];

    const clip = getSelectedVideoClip({
      tracks,
      selection: { trackId: 't-video', elementId: 't-video-el' },
    });
    expect(clip).not.toBeNull();

    const scene = buildScene({
      tracks: must(clip, 'clip').tracks,
      mediaAssets: VIDEO_ASSETS,
      duration: must(clip, 'clip').duration,
      settings: SETTINGS,
    });

    // 旧实现（不清 hidden）：`getOutputTracks` 把轨与元素都滤掉 ⇒ children = 0（全黑）。
    expect(scene.children).toHaveLength(1);
  });
});

describe('帧数 / 末帧时刻唯一（预览与导出同数、同刻）', () => {
  it('时长非帧整数倍时，末帧时刻 = 导出最后一帧 `(getFrameCount - 1) / fps`', () => {
    const duration = 2.005;
    const fps = 30;

    expect(getFrameCount({ duration, fps })).toBe(61);
    // 旧口径 `duration - 1/fps`（= 1.9717）会让预览比成片**少渲染末帧**（2.0）。
    expect(getLastFrameTime({ duration, fps })).toBeCloseTo(2, 10);
  });

  it('时长为 0 / fps 非法 ⇒ 0 帧、末帧 0（不产生"渲染到 duration"的幽灵帧）', () => {
    expect(getFrameCount({ duration: 0, fps: 30 })).toBe(0);
    expect(getLastFrameTime({ duration: 0, fps: 30 })).toBe(0);
    expect(getFrameCount({ duration: 2, fps: 0 })).toBe(0);
    expect(getLastFrameTime({ duration: 2, fps: 0 })).toBe(0);
  });
});
