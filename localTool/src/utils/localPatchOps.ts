/**
 * 局部提取与图像融合 · 图像算法纯函数（对齐插件 local_patch_ops.py 语义，Jimp 实现）
 * ----------------------------------------------------------------------------
 * 本模块只做「像素/文件」层面的纯计算与变换，不依赖 HTTP/路由层，便于 node --test 直测。
 * 语义来源：docs/19 §二（M4 后端算法）。核心工作流：
 *   提取选区 → 生成带 cropContext 的局部图 → 局部图经生成节点加工 → merge 拼回原图。
 *
 * 【错误契约】业务性失败统一抛 LocalPatchError（带 status）：
 *   - 470/409 语义 → status 409（源图内容/尺寸已变，拒绝覆盖）
 *   - 参数/尺寸/张数校验失败 → status 400
 *   - 其余不明异常由路由层兜底 500。错误信息真实透传，不吞错、不用泛化错误掩盖。
 *
 * 【性能】大图（默认上限 100MP）禁全图逐像素 scan。羽化/颜色匹配只对 paddedRect
 *   裁剪出的小区域处理再 composite，避免全图 O(W*H) 循环（docs/19 §2.1 注意）。
 */

import fs from 'node:fs';
import crypto from 'node:crypto';
import Jimp from 'jimp';

/** 像素上限默认值：100 百万像素（对齐插件 load_oriented_rgba）。可由 localPatch.ts 覆盖。 */
export const DEFAULT_MAX_PIXELS = 100_000_000;

/** 选区最小边长（像素），小于则拒绝（noise 级选区无意义，防脏上下文）。 */
export const MIN_SELECTION_SIDE = 32;

/** 颜色匹配单通道最大偏移（±24），防过冲产生色偏台阶。 */
export const COLOR_MATCH_LIMIT = 24;

/** 宽高比允许的最大相对偏差（1%，等比缩放可缩回）。 */
export const ASPECT_RATIO_TOLERANCE = 0.01;

/** 单个 merge 最多接受局部图张数。 */
export const MAX_MERGE_PATCHES = 16;

/** 业务错误：携带 HTTP status，路由层据此回 400/409，不吞栈。 */
export class LocalPatchError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'LocalPatchError';
    this.status = status;
  }
}

export interface Rect { x: number; y: number; w: number; h: number }

/** cropContext 契约（前端 localPatchContext.js 与之对齐，C1.1）。 */
export interface CropContext {
  version: number;
  contextId: string;
  source: { url: string; width: number; height: number; fingerprint: string };
  rect: Rect;
  paddedRect: Rect;
  paddingRatio: number;
  cropNodeId?: string;
}

/**
 * 流式 SHA-256 文件指纹（1MB 分块，避免整文件一次性读入内存）。
 * 同文件 → 同指纹；内容变更 → 指纹必变（用作「源图是否仍为原始文件」判据）。
 */
export function fileFingerprint(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * 载入并 EXIF 定向旋转 + 像素上限校验。
 * 返回的 { img, width, height } 中宽高为【EXIF 修正后】的自然尺寸（对齐 ImageOps.exif_transpose）。
 */
export async function loadOrientedRgba(
  filePath: string,
  maxPixels: number = DEFAULT_MAX_PIXELS
): Promise<{ img: Jimp; width: number; height: number }> {
  const img = await Jimp.read(filePath);
  // jimp 0.22 已在 Jimp.read 内自动应用 EXIF orientation（parseBitmap → exifRotate），
  // 无需再调 exifRotate（否则双重旋转）。width/height 已是修正后的自然尺寸。
  const width = img.getWidth();
  const height = img.getHeight();
  if (width * height > maxPixels) {
    throw new LocalPatchError(`图像尺寸 ${width}×${height} 超上限 ${maxPixels} 像素`, 400);
  }
  return { img, width, height };
}

function clampToInt(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/**
 * 选区外扩 ratio（默认 0.1），钳制在原图内。
 * 外部会先做选区是否越界/是否过小的校验，这里只做几何计算。
 */
export function computePaddedRect(rect: Rect, imageW: number, imageH: number, ratio = 0.1): Rect {
  const padX = Math.max(0, Math.round(rect.w * ratio));
  const padY = Math.max(0, Math.round(rect.h * ratio));
  const x = Math.max(0, rect.x - padX);
  const y = Math.max(0, rect.y - padY);
  const x2 = Math.min(imageW - 1, rect.x + rect.w - 1 + padX);
  const y2 = Math.min(imageH - 1, rect.y + rect.h - 1 + padY);
  const w = Math.max(1, x2 - x + 1);
  const h = Math.max(1, y2 - y + 1);
  return { x, y, w, h };
}

/** 取图像某区域的 RGB 均值（仅用于颜色匹配的环带/整块均值偏差，非精确统计）。 */
export function computeMeanRgb(img: Jimp): { r: number; g: number; b: number } {
  let r = 0, g = 0, b = 0;
  const w = img.getWidth();
  const h = img.getHeight();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const { r: R, g: G, b: B } = Jimp.intToRGBA(img.getPixelColor(x, y));
      r += R; g += G; b += B;
    }
  }
  const n = Math.max(1, w * h);
  return { r: r / n, g: g / n, b: b / n };
}

/**
 * 颜色匹配：patch 与环带（简化：整块 padded 区域）均值差，逐通道 ±COLOR_MATCH_LIMIT 限幅。
 * offset = clamp(origMu - patchMu, -limit, limit)，加到 patch 每像素并钳 0-255。
 */
export function applyLimitedColorMatch(
  patch: Jimp,
  origRegion: Jimp,
  limit: number = COLOR_MATCH_LIMIT
): void {
  const mPatch = computeMeanRgb(patch);
  const mOrig = computeMeanRgb(origRegion);
  const off = {
    r: clampToInt(clampOffset(mOrig.r - mPatch.r, limit)),
    g: clampToInt(clampOffset(mOrig.g - mPatch.g, limit)),
    b: clampToInt(clampOffset(mOrig.b - mPatch.b, limit)),
  };
  const w = patch.getWidth();
  const h = patch.getHeight();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const { r, g, b, a } = Jimp.intToRGBA(patch.getPixelColor(x, y));
      patch.setPixelColor(
        Jimp.rgbaToInt(clampToInt(r + off.r), clampToInt(g + off.g), clampToInt(b + off.b), a),
        x,
        y
      );
    }
  }
}

function clampOffset(v: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, v));
}

/**
 * 生成羽化 alpha（Jimp 单通道灰度，内部实心 255、边缘 smoothstep 渐变 + 高斯模糊）。
 * 返回值把 feather 值放在【alpha 通道】（RGB 置 255），供 applyFeather 直接乘到 patch 上。
 * interior 是相对 mask 尺寸的实心矩形（通常 = rect 相对 paddedRect 的偏移）。
 */
export function buildFeatherMask(width: number, height: number, interior: Rect): Jimp {
  const mask = new Jimp(width, height);
  const featherAlpha = (x: number, y: number): number => {
    const inside =
      x >= interior.x && x < interior.x + interior.w && y >= interior.y && y < interior.y + interior.h;
    if (inside) return 255;
    const dx = Math.max(0, interior.x - x, x - (interior.x + interior.w - 1));
    const dy = Math.max(0, interior.y - y, y - (interior.y + interior.h - 1));
    const d = Math.max(dx, dy);
    const ring = Math.max(
      interior.x,
      width - (interior.x + interior.w),
      interior.y,
      height - (interior.y + interior.h)
    );
    const t = ring > 0 ? Math.min(1, d / ring) : 1;
    const s = t * t * (3 - 2 * t); // smoothstep 0→1
    return Math.max(0, Math.round(255 * (1 - s)));
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      mask.setPixelColor(Jimp.rgbaToInt(255, 255, 255, featherAlpha(x, y)), x, y);
    }
  }
  mask.blur(1); // 对应高斯低通，抹平生硬接缝
  return mask;
}

/** 把羽化 mask 的 alpha 乘到 patch 上（确定性实现，不依赖 Jimp.mask 的灰度语义）。 */
export function applyFeather(patch: Jimp, mask: Jimp): void {
  const w = patch.getWidth();
  const h = patch.getHeight();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const mAlpha = Jimp.intToRGBA(mask.getPixelColor(x, y)).a;
      const { r, g, b, a } = Jimp.intToRGBA(patch.getPixelColor(x, y));
      patch.setPixelColor(
        Jimp.rgbaToInt(r, g, b, clampToInt((a * mAlpha) / 255)),
        x,
        y
      );
    }
  }
}

/** cropContext 契约版本，与前端 localPatchContext.js 的 CROP_CONTEXT_VERSION 对齐（C1.1）。 */
export const CROP_CONTEXT_VERSION = 2;

/**
 * 提取局部图（对齐 crop_local_patch）：
 *  校验选区(≥32px/越界) → paddedRect 外扩 → 裁出局部图 → 生成 cropContext（指纹只算一次）。
 * 返回 { img, cropContext }；img 为已裁 paddedRect 区域的 Jimp，落盘由路由层负责。
 */
export async function cropLocalPatch(
  filePath: string,
  rect: Rect,
  opts: { paddingRatio?: number; maxPixels?: number; cropNodeId?: string; sourceUrl?: string } = {}
): Promise<{ img: Jimp; cropContext: CropContext }> {
  const { paddingRatio = 0.1, maxPixels = DEFAULT_MAX_PIXELS, cropNodeId, sourceUrl } = opts;
  if (!rect || rect.w <= 0 || rect.h <= 0) {
    throw new LocalPatchError('无效的裁剪选区', 400);
  }
  if (Math.min(rect.w, rect.h) < MIN_SELECTION_SIDE) {
    throw new LocalPatchError(`选区过小（最小边 ${MIN_SELECTION_SIDE}px）`, 400);
  }
  const { img: origImg, width: imageW, height: imageH } = await loadOrientedRgba(filePath, maxPixels);
  if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > imageW || rect.y + rect.h > imageH) {
    throw new LocalPatchError('选区超出原图边界', 400);
  }

  const fingerprint = await fileFingerprint(filePath);
  const paddedRect = computePaddedRect(rect, imageW, imageH, paddingRatio);
  const img = origImg.clone().crop(paddedRect.x, paddedRect.y, paddedRect.w, paddedRect.h);

  const cropContext: CropContext = {
    version: CROP_CONTEXT_VERSION,
    contextId: crypto.randomBytes(8).toString('hex'),
    source: { url: sourceUrl || '', width: imageW, height: imageH, fingerprint },
    rect: { ...rect },
    paddedRect,
    paddingRatio,
    ...(cropNodeId ? { cropNodeId } : {}),
  };
  return { img, cropContext };
}

/** 归一化一批文件名同 X 尺的 URL（合并用）。 */
interface MergePatchArg {
  patchPath: string;
  cropContext: CropContext;
}

/**
 * 把局部图拼回原图（对齐 merge_local_patches）：
 *  1. 逐张校验：源指纹变更(409)、宽高比偏差(>1%,400)；
 *  2. 缩放回 cropContext.paddedRect 尺寸；
 *  3. 可选颜色匹配（环带均值差 ±24）；
 *  4. 羽化（smoothstep + 高斯）后 composite 到原图对应位置；
 *  5. 多图按序合成，后者覆盖前者。
 */
export async function mergeLocalPatches(
  originalPath: string,
  patches: MergePatchArg[],
  { colorMatch = true, maxPixels = DEFAULT_MAX_PIXELS }: { colorMatch?: boolean; maxPixels?: number }
): Promise<Jimp> {
  if (patches.length === 0) throw new LocalPatchError('缺少局部图（patches 为空）', 400);
  if (patches.length > MAX_MERGE_PATCHES) {
    throw new LocalPatchError(`局部图数量 ${patches.length} 超上限 ${MAX_MERGE_PATCHES}`, 400);
  }

  const { img: result } = await loadOrientedRgba(originalPath, maxPixels);
  const origFingerprint = await fileFingerprint(originalPath);

  for (const p of patches) {
    const c = p.cropContext;
    if (c?.source?.fingerprint && c.source.fingerprint !== origFingerprint) {
      throw new LocalPatchError('源图内容已变化，无法融合（请重新提取选区）', 409);
    }
    const pr = c?.paddedRect;
    if (!pr || !(pr.w > 0) || !(pr.h > 0)) {
      throw new LocalPatchError('局部图缺少有效的裁剪上下文（paddedRect）', 400);
    }
    const { img: patchImg } = await loadOrientedRgba(p.patchPath, maxPixels);

    // 宽高比偏差 ≤1%：允许 2× 等比放大缩回，拒绝不等比拉伸出的形变。
    const pa = patchImg.getWidth() / Math.max(1, patchImg.getHeight());
    const ra = pr.w / Math.max(1, pr.h);
    if (Math.abs(pa - ra) / Math.max(ra, 1e-6) > ASPECT_RATIO_TOLERANCE) {
      throw new LocalPatchError('局部图宽高比与原选区偏差过大，无法融合', 400);
    }

    patchImg.resize(pr.w, pr.h);

    // 颜色匹配：环带近似为整个 paddedRect 区域（文档允许先用整块，差异可接受）。
    if (colorMatch) {
      const origRegion = result.clone().crop(pr.x, pr.y, pr.w, pr.h);
      applyLimitedColorMatch(patchImg, origRegion);
    }

    // 羽化：interior = 原 rect 相对 padded 的偏移（即 rect 内实心、边缘渐隐）。
    const interior = {
      x: Math.max(0, c.rect.x - pr.x),
      y: Math.max(0, c.rect.y - pr.y),
      w: c.rect.w,
      h: c.rect.h,
    };
    const mask = buildFeatherMask(pr.w, pr.h, interior);
    applyFeather(patchImg, mask);

    result.composite(patchImg, pr.x, pr.y);
  }

  return result;
}