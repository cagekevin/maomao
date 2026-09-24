/**
 * AI 抠图 —— 纯逻辑层（与 DOM / React / ORT 解耦，可单元测试）。
 *
 * 【职责边界】本文件只做「数据 → 数据」的纯计算（对齐 `depthVideo/engine.ts` 的角色）：
 *  - 缩放系数推导（原图 → 1024 模型空间）
 *  - 坐标三段换算（显示坐标 → 原图坐标 → 模型空间坐标）
 *  - mask logits 阈值化（>0 即前景）
 *
 * **不触碰** `document` / `canvas` / `Image` / ORT 会话 —— 这些都留在 loader 与组件层。
 * 这样"怎么算"可以被单测钉死，而"怎么取像素"不用。
 *
 * 【数学来源】演示页 `localTool/runtime-models/matting/index.html` 的预处理段
 * （`modelScale = TARGET / Math.max(imgW, imgH)`；`coords = 原图坐标 * modelScale`），
 * 此处**原样搬运**并加类型与可测性。
 */

import { MATTING_INPUT_SIZE, MATTING_MEAN, MATTING_STD } from './mattingConfig.ts';

/**
 * 原图 → 模型空间的缩放系数：**等比缩放到最长边 = 1024**（`TARGET / max(w,h)`）。
 *
 * 【为什么是 max 而不是分别缩】模型输入是正方形 1024×1024；官方做法是
 * 「等比缩放 + 左上对齐 + 右下补零」，故缩放系数由**较长边**决定，短边留空。
 *
 * @returns 缩放系数（>0）；尺寸非法时抛错（**编程错误，不是运行时失败**）
 */
export function scaleForSize(width: number, height: number): number {
  if (!(width > 0) || !(height > 0)) {
    throw new Error(`抠图：图片尺寸非法（${width}×${height}）`);
  }
  return MATTING_INPUT_SIZE / Math.max(width, height);
}

/** 二维点（坐标语义由调用方与函数名界定）。 */
export interface Pt {
  readonly x: number;
  readonly y: number;
}

/**
 * 显示坐标 → 原图坐标。
 *
 * 三位坐标链：**显示坐标**（canvas 上的 CSS px）→ **原图坐标**（除以显示缩放）
 * → **模型坐标**（乘 `scale`）。本函数负责第一段；第二段在门面 `cutout()` 内换算
 * （`p.x * scale`，一行内联，故不单独出函数）。
 *
 * @param pt 相对 canvas 显示区域的坐标（CSS px）
 * @param displayScale canvas 显示尺寸 / 图片原始尺寸（**≤1 时是缩小显示**）
 */
export function toImageCoords(pt: Pt, displayScale: number): Pt {
  if (!(displayScale > 0)) throw new Error(`抠图：显示缩放非法（${displayScale}）`);
  return { x: pt.x / displayScale, y: pt.y / displayScale };
}

/**
 * 把原图绘制参数算出来（等比 + 左上对齐到 1024 画布）。
 *
 * 返回 `drawW/drawH` 供 `encodeImage` 定循环边界；`scale` 供门面做原图→模型坐标换算。
 */
export function drawParamsFor(
  width: number,
  height: number,
): { drawW: number; drawH: number; scale: number } {
  const scale = scaleForSize(width, height);
  return {
    drawW: Math.round(width * scale),
    drawH: Math.round(height * scale),
    scale,
  };
}

/**
 * 归一化：`(px - mean) / std`，写入 CHW 排布的 Float32Array。
 *
 * 【为什么必须是函数、不许内联】`encodeImage` 的预处理循环**曾内联这段数学**
 * （写成 `(px - 123.675) / 58.395`）⇒ `MEAN`/`STD` 变成**两份真相**
 * （`mattingConfig` 一份、内联一份）。改训练参数时只改一处、另一处静默不改 = 结果错而不报。
 * ⇒ 归一化收在本函数，常量只从 `mattingConfig` 来（`ADR-0057` 单一真源）。
 *
 * 【性能不构成内联理由】这是**每张图一次**的预处理（非热循环），且 JIT 会内联此等小函数。
 */
export function normalizeInto(
  arr: Float32Array,
  plane: number,
  index: number,
  r: number,
  g: number,
  b: number,
): void {
  arr[index] = (r - MATTING_MEAN[0]) / MATTING_STD[0];
  arr[plane + index] = (g - MATTING_MEAN[1]) / MATTING_STD[1];
  arr[2 * plane + index] = (b - MATTING_MEAN[2]) / MATTING_STD[2];
}

/**
 * mask logits → 布尔前景判定（**阈值就是 0**，不是 0.5）。
 *
 * 【为什么阈值是 0】decoder 输出的是 **logits**（未过 sigmoid），
 * `> 0` 即 sigmoid > 0.5。演示页用法一致（`data[i] > 0 ? 255 : 0`）。
 * 若误当概率用 0.5 阈值，mask 会**大幅收缩**（这是本仓最容易踩的隐式契约）。
 */
export function isForeground(logit: number): boolean {
  return logit > 0;
}

/**
 * logits → 透明 PNG 的 alpha（前景 255 / 背景 0）。
 *
 * @param logits decoder 输出的原始 logits（长度 = width*height）
 */
export function alphaFromLogits(logits: ArrayLike<number>): Uint8ClampedArray {
  const out = new Uint8ClampedArray(logits.length);
  for (let i = 0; i < logits.length; i += 1) {
    out[i] = isForeground(logits[i]) ? 255 : 0;
  }
  return out;
}
