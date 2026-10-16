import type {
  TimelineTrack,
  VideoElement,
  ImageElement,
  VideoTrack,
} from '@/components/videoEditor/types/timeline';
import type { MediaAsset } from '@/components/videoEditor/types/mediaAssets';
import { RootNode } from './nodes/root-node';
import { VideoNode } from './nodes/video-node';
import { ImageNode } from './nodes/image-node';
import { TextNode } from './nodes/text-node';
import { StickerNode } from './nodes/sticker-node';
import { ColorNode } from './nodes/color-node';
import { BlurBackgroundNode } from './nodes/blur-background-node';
import { TransitionNode } from './nodes/transition-node';
import type { BaseNode } from './nodes/base-node';
import type { TCanvasSize, TProjectSettings } from '@/components/videoEditor/types/project';
import { DEFAULT_BLUR_INTENSITY } from '@/components/videoEditor/constants/project-constants';
import { getOutputTracks } from '@/components/videoEditor/engine/timeline';
import { getElementTimeRange } from '@/components/videoEditor/engine/timeline/element-utils';
import { indexMediaAssets } from '@/components/videoEditor/engine/lib/media/media-utils';
import { isBottomAlignedSubtitleText } from '@/components/videoEditor/engine/timeline/text-utils';
import {
  getFitCanvasSize,
  getMediaDisplaySize,
} from '@/components/videoEditor/engine/lib/canvas-size';

/**
 * 【为什么收 `settings` 而不是 `canvasSize` + `fitCanvasSize`】适配基准
 * （`getFitCanvasSize`）曾由**每个调用方各自算一遍**（预览 / 导出 / 缩略图 / 命中四处），
 * 任一处口径写歪，画面 / 框子 / 命中三者立刻互相错位，且只在"改过画布尺寸"的作品上显形。
 * 现把派生收进本函数内部 ⇒ 调用方**拿不到** `fitCanvasSize` 这个参数，也就无从写歪。
 */
export type BuildSceneParams = {
  settings: Pick<TProjectSettings, 'canvasSize' | 'originalCanvasSize' | 'background'>;
  tracks: TimelineTrack[];
  mediaAssets: MediaAsset[];
  duration: number;
};

function buildVisualElementNode({
  element,
  mediaMap,
  fitCanvasSize,
  canvasSize,
}: {
  element: VideoElement | ImageElement;
  mediaMap: Map<string, MediaAsset>;
  fitCanvasSize: TCanvasSize;
  canvasSize: TCanvasSize;
}): BaseNode | null {
  const mediaAsset = mediaMap.get(element.mediaId);
  if (!mediaAsset?.file || !mediaAsset?.url) {
    return null;
  }

  // 【显示尺寸 = 几何原语读的同一个值】走 `getMediaDisplaySize`（缺失/非法尺寸的回落规则
  // 只有那一份）—— 否则渲染与框子/命中各按各的尺寸摆，用户"框子套不住画面"。
  const mediaSize = getMediaDisplaySize({ media: mediaAsset, canvasSize });

  if (mediaAsset.type === 'video') {
    const videoElement = element as VideoElement;
    return new VideoNode({
      mediaId: mediaAsset.id,
      url: mediaAsset.url,
      file: mediaAsset.file,
      duration: element.duration,
      timeOffset: element.startTime,
      trimStart: element.trimStart,
      transform: element.transform,
      opacity: element.opacity,
      fitCanvasSize,
      mediaSize,
      playbackRate: videoElement.playbackRate,
      reversed: videoElement.reversed,
    });
  }

  if (mediaAsset.type === 'image') {
    return new ImageNode({
      url: mediaAsset.url,
      duration: element.duration,
      timeOffset: element.startTime,
      trimStart: element.trimStart,
      transform: element.transform,
      opacity: element.opacity,
      fitCanvasSize,
      mediaSize,
    });
  }

  return null;
}

export function buildScene(params: BuildSceneParams) {
  const { tracks, mediaAssets, duration, settings } = params;
  const { canvasSize, background } = settings;
  const fitCanvasSize = getFitCanvasSize(settings);

  const rootNode = new RootNode({ duration });
  const mediaMap = indexMediaAssets({ mediaAssets });

  // 【图层序唯一真源 = `tracks` 数组序】下标 0 = 时间轴列表最上一行 = **最上层**；
  // `BaseNode` 按子节点加入顺序依次绘制、后加入者覆盖先加入者 ⇒ 绘制序取反序。
  // 此处曾按 `isMainTrack` 把主轨强制挪到末位再反序 —— 那是**读取期重推导**用户拖过的顺序，
  // 于是「时间轴上拖好的上下关系」在预览 / 导出 / 缩略图里全部失效（拖了等于没拖）。
  //
  // 【可见性】`getOutputTracks` 已把被隐藏的轨 / 元素滤掉 ⇒ 本处**看不到**它们，无从漏判。
  const orderedTracksBottomToTop = getOutputTracks(tracks).slice().reverse();

  const contentNodes: BaseNode[] = [];

  for (const track of orderedTracksBottomToTop) {
    const elements = track.elements.slice().sort((a, b) => {
      if (a.startTime !== b.startTime) return a.startTime - b.startTime;
      return a.id.localeCompare(b.id);
    });

    if (track.type === 'video') {
      const videoTrack = track as VideoTrack;
      const visualElements = elements as (VideoElement | ImageElement)[];
      const processedIds = new Set<string>();

      const trackTransitions = videoTrack.transitions ?? [];
      const transitionLookup = new Map<string, (typeof trackTransitions)[number]>();
      for (const transition of trackTransitions) {
        const key = `${transition.fromElementId}:${transition.toElementId}`;
        transitionLookup.set(key, transition);
      }

      for (let i = 0; i < visualElements.length; i++) {
        const element = visualElements[i];
        if (processedIds.has(element.id)) continue;

        // look ahead: check transition with next element
        if (i < visualElements.length - 1) {
          const nextElement = visualElements[i + 1];
          const pairKey = `${element.id}:${nextElement.id}`;
          const transition = transitionLookup.get(pairKey);

          if (transition) {
            const outgoingNode = buildVisualElementNode({
              element,
              mediaMap,
              fitCanvasSize,
              canvasSize,
            });
            const incomingNode = buildVisualElementNode({
              element: nextElement,
              mediaMap,
              fitCanvasSize,
              canvasSize,
            });

            if (outgoingNode && incomingNode) {
              processedIds.add(element.id);
              processedIds.add(nextElement.id);

              const junctionTime = nextElement.startTime;
              contentNodes.push(
                new TransitionNode({
                  type: transition.type,
                  duration: transition.duration,
                  transitionStart: junctionTime - transition.duration / 2,
                  outgoingNode,
                  incomingNode,
                  outgoingEndTime: getElementTimeRange({ element }).end,
                  incomingStartTime: nextElement.startTime,
                }),
              );
              continue;
            }
          }
        }

        const node = buildVisualElementNode({
          element,
          mediaMap,
          fitCanvasSize,
          canvasSize,
        });
        if (node) {
          processedIds.add(element.id);
          contentNodes.push(node);
        }
      }

      continue;
    }

    for (const element of elements) {
      if (element.type === 'text') {
        const textBaseline = isBottomAlignedSubtitleText({ element }) ? 'bottom' : 'middle';
        contentNodes.push(
          new TextNode({
            ...element,
            canvasCenter: {
              x: canvasSize.width / 2,
              y: canvasSize.height / 2,
            },
            canvasHeight: canvasSize.height,
            textBaseline,
          }),
        );
      }

      if (element.type === 'sticker') {
        contentNodes.push(
          new StickerNode({
            iconName: element.iconName,
            duration: element.duration,
            timeOffset: element.startTime,
            trimStart: element.trimStart,
            transform: element.transform,
            opacity: element.opacity,
            color: element.color,
            // 必须与几何（`getElementCanvasRect` 贴纸分支）同基准 —— 否则改过画布尺寸的作品
            // 上，框子按旧基准、画面按当前画布（`renderer.width/height` 回落），两者错位。
            fitCanvasSize,
          }),
        );
      }
    }
  }

  if (background.type === 'blur') {
    rootNode.add(
      new BlurBackgroundNode({
        blurIntensity: background.blurIntensity ?? DEFAULT_BLUR_INTENSITY,
        contentNodes,
      }),
    );
    for (const node of contentNodes) {
      rootNode.add(node);
    }
  } else {
    if (background.type === 'color' && background.color !== 'transparent') {
      rootNode.add(new ColorNode({ color: background.color }));
    }
    for (const node of contentNodes) {
      rootNode.add(node);
    }
  }

  return rootNode;
}
