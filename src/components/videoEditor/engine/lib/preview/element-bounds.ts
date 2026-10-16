import type { TimelineElement, Transform } from '@/components/videoEditor/types/timeline';
import type { MediaAsset } from '@/components/videoEditor/types/mediaAssets';
import type { TProjectSettings } from '@/components/videoEditor/types/project';
import {
  getFitCanvasSize,
  getContainScale,
  getMediaDisplaySize,
} from '@/components/videoEditor/engine/lib/canvas-size';
import {
  getTextMeasureContext,
  layoutText,
  type TextMeasureContext,
} from '@/components/videoEditor/engine/services/renderer/text-layout';
import { isBottomAlignedSubtitleText } from '@/components/videoEditor/engine/timeline/text-utils';

/** 贴纸图标的源边长（`buildIconSvgUrl` 固定出 200×200）。 */
const STICKER_SOURCE_SIZE = 200;

/**
 * **元素在画布上的矩形（唯一几何原语）** —— 中心 + 宽高 + 旋转，画布坐标系（左上为原点）。
 *
 * 【为什么必须唯一】同一件事曾被算三遍，且**三份的取值口径不同**：
 *   · 渲染 `visual-node.renderVisual`（用**解码后的真实尺寸**）
 *   · 选中框 `selection-overlay`（复制了一份算式；文本用真实测量）
 *   · 命中 / 吸附 `element-bounds`（文本用**估算公式**；贴纸用 `canvasWidth` 而不是适配基准）
 * ⇒ 用户"点不中自己看到的字、框子套不住画面"。现三处都从这里取，且**尺寸来源也统一**：
 *   媒体尺寸 = `MediaAsset.width/height`（导入时探测一次；缺省回落画布尺寸），
 *   适配基准 = `getFitCanvasSize`（与 `scene-builder` 同一份）。
 *
 * 【`transform` 为什么单独传】拖拽 / 缩放期间用的是**手势起始快照**的 transform（`initialTransform`），
 * 不是元素当前值 —— 两者必须能分开传。
 */
export interface ElementCanvasRect {
  centerX: number;
  centerY: number;
  /** 元素占的宽（已含 `transform.scale`）。 */
  width: number;
  /** 元素占的高（已含 `transform.scale`）。 */
  height: number;
  /** 旋转角（度）。 */
  rotate: number;
}

/** 命中 / 吸附只需半宽半高（由 `ElementCanvasRect` 派生，别处不必再算一遍）。 */
export interface ElementHalfSize {
  halfWidth: number;
  halfHeight: number;
}

export function getElementCanvasRect({
  element,
  transform,
  media,
  settings,
  measureContext,
}: {
  element: TimelineElement;
  transform: Transform;
  media?: MediaAsset;
  settings: Pick<TProjectSettings, 'canvasSize' | 'originalCanvasSize'>;
  /**
   * 文本测量上下文。缺省走 `getTextMeasureContext()`（进程内复用的离屏 canvas）。
   * **生产代码不要传** —— 这个口子只给测试用：文本几何依赖 canvas 2D，node/jsdom 拿不到，
   * 不给注入点就等于"文本几何没有任何机器判据"（实证：字幕中心算错半个字高，无测试报红）。
   */
  measureContext?: TextMeasureContext;
}): ElementCanvasRect | null {
  const canvasWidth = settings.canvasSize.width;
  const canvasHeight = settings.canvasSize.height;
  const fitCanvasSize = getFitCanvasSize(settings);
  const centerX = canvasWidth / 2 + transform.position.x;

  if (element.type === 'video' || element.type === 'image') {
    // 尺寸真源 = 素材元数据（导入时探测）；缺失/非法回落画布尺寸 —— 渲染侧（`scene-builder`
    // 的 `mediaSize`）读的是**同一个**函数，两者永远一致。
    const sourceSize = getMediaDisplaySize({ media, canvasSize: settings.canvasSize });
    const containScale = getContainScale({ sourceSize, fitCanvasSize });

    return {
      centerX,
      centerY: canvasHeight / 2 + transform.position.y,
      width: sourceSize.width * containScale * transform.scale,
      height: sourceSize.height * containScale * transform.scale,
      rotate: transform.rotate,
    };
  }

  if (element.type === 'text') {
    const layout = layoutText({
      element,
      canvasHeight,
      context: measureContext ?? getTextMeasureContext(),
    });
    const width = layout.width * transform.scale;
    const height = layout.height * transform.scale;

    // ── 垂直：`TextNode` 用 `textBaseline` 对齐锚点 `position.y` ──────────────
    // `middle` ⇒ 文字占 `[y − H/2, y + H/2]`（中心 = 锚点）；
    // `bottom` ⇒ 底边钉在 `y`，文字占 `[y − H, y]` ⇒ 中心 = 底边 − **H/2**
    //   （不是 H —— 减整段会把框子抬高一整个半高，且文字下半部分点不中）。
    const centerY =
      canvasHeight / 2 +
      transform.position.y -
      (isBottomAlignedSubtitleText({ element }) ? height / 2 : 0);

    // ── 水平：`TextNode` 按 `textAlign` 在锚点 `position.x` 处对齐，且**单行与多行锚点不同** ──
    //   单行：`fillText(content, 0, 0)` ⇒ left 占 `[x, x+W]` · right 占 `[x−W, x]` · center 居中
    //   多行：每行从 `textX` 起，而 `textX` 已先按框宽偏移（left ⇒ `−boxW/2`、right ⇒ `+boxW/2`），
    //         最宽行宽为 `W` ⇒ 并集 left `[−boxW/2, −boxW/2+W]` · right `[boxW/2−W, boxW/2]`
    // ⇒ 两套锚点必须分开算；混用会把多行的框子再偏 `boxW/2`（实证过）。
    const textAlignOffset = layout.hasBoxWidth
      ? element.textAlign === 'left'
        ? (layout.width - layout.boxWidth) / 2
        : element.textAlign === 'right'
          ? (layout.boxWidth - layout.width) / 2
          : 0
      : element.textAlign === 'left'
        ? layout.width / 2
        : element.textAlign === 'right'
          ? -layout.width / 2
          : 0;

    // 【口径：几何取**文字范围**，不含背景板】背景板另比文字宽 `2×padX`（单行还跟随 `textAlign`，
    // 多行却恒居中于锚点 —— 那是渲染自身的口径），纳入它会牵动几何与命中的整体尺寸；
    // 与旧版保持一致：框子贴合文字，底板允许溢出少许。
    return {
      centerX: centerX + textAlignOffset * transform.scale,
      centerY,
      width,
      height,
      rotate: transform.rotate,
    };
  }

  if (element.type === 'sticker') {
    const containScale = getContainScale({
      sourceSize: { width: STICKER_SOURCE_SIZE, height: STICKER_SOURCE_SIZE },
      fitCanvasSize,
    });
    const size = STICKER_SOURCE_SIZE * containScale * transform.scale;

    return {
      centerX,
      centerY: canvasHeight / 2 + transform.position.y,
      width: size,
      height: size,
      rotate: transform.rotate,
    };
  }

  return null;
}
