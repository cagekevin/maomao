/**
 * imagePixel — 图片比例 × 清晰度档位 → 精确像素 的查表工具。
 *
 * 【来源】自 base/api/imageApi.ts 迁出（L3 收口：imageApi 并入 generate 门面时，
 *  将这张复刻官方的查表拆成独立纯工具，供 generate.ts 与测试复用，避免散第二份表）。
 *
 * 【定位（2026-10-17 更新）】本表是**预设初值**，不是最终尺寸的唯一来源：
 * 生图节点的「尺寸」输入框会把用户手改的像素写进 `data.pixelSize`（'WxH'），
 * 该值以 `size` 直给 generate() 时**原样透传**（`parsePixelSize` 命中即不再查表）。
 * 所以表值不满意时用户可直接改像素，无需再反复校正表 —— 表只负责「选比例/档位那一刻」的初值。
 *
 * 【语义】
 *  - 比例 Auto / 空 → `resolveImagePixel` 返回 ''（告诉后端不指定 size）；
 *  - 档位查不到 → 回退该比例的 '1K'；比例也查不到 → 兜底 '1024x1024'。
 *
 * 【纪律】本模块只含纯函数与常量表，不允许出现副作用或 IO 依赖。
 */

/**
 * 比例 × 清晰度档位 → 精确像素 查表。
 *
 * 【纪律】表中每一档的 W:H 必须**严格等于**其比例标签（如 '9:16' 档的像素宽高比必为 9/16）。
 * 初版是「复刻官方 H_.jsx oe 表」，但核对发现多处像素比与标签不符（例：880x1776 实为 ≈1:2，
 * 而非 9:16）。此处已逐一校正为精确比，并尽量保留原长边量级，避免与上游尺寸量级偏离过大。
 * 注意：校正后这些字符串不再等同于官方原始桶值，若上游仅认原始桶，需与后端/上游确认接受度。
 *
 * 【1K 的 16:9 / 9:16】按**长边 720 档**取像素（`1280x720` / `720x1280`），不用 1920/1080
 * 那一档 —— 用户裁定（2026-10-16）。其余比例的 1K 档维持原量级。
 */
export const RATIO_PIXEL_TABLE: Record<string, Record<string, string>> = {
  '1:1': { '1K': '1024x1024', '2K': '2048x2048', '4K': '2880x2880' },
  '16:9': { '1K': '1280x720', '2K': '2048x1152', '4K': '3840x2160' },
  '9:16': { '1K': '720x1280', '2K': '1152x2048', '4K': '2160x3840' },
  '3:2': { '1K': '1536x1024', '2K': '2046x1364', '4K': '3504x2336' },
  '2:3': { '1K': '1024x1536', '2K': '1364x2046', '4K': '2336x3504' },
  '21:9': { '1K': '2058x882', '2K': '2058x882', '4K': '3843x1647' },
  '9:21': { '1K': '882x2058', '2K': '882x2058', '4K': '1647x3843' },
  '1:3': { '1K': '684x2052', '2K': '684x2052', '4K': '1280x3840' },
  '3:1': { '1K': '2052x684', '2K': '2052x684', '4K': '3840x1280' },
  '2:1': { '1K': '2048x1024', '2K': '2048x1024', '4K': '3840x1920' },
  '1:2': { '1K': '1024x2048', '2K': '1024x2048', '4K': '1920x3840' },
  '4:3': { '1K': '1024x768', '2K': '2304x1728', '4K': '2880x2160' },
  '3:4': { '1K': '768x1024', '2K': '1728x2304', '4K': '2160x2880' },
};
const DEFAULT_PIXEL = '1024x1024';

/** 像素边长合法区间（生图节点手改尺寸时的夹取边界，防 0 / 天文数字） */
export const MIN_PIXEL_SIDE = 64;
export const MAX_PIXEL_SIDE = 8192;

/** 像素尺寸对象（生图节点 data.pixelWidth/pixelHeight 的形态真源） */
export interface PixelSize {
  width: number;
  height: number;
}

/**
 * 比例 + 档位 → 精确像素（查表，复刻官方）。
 *  - 比例 Auto / 空 → 返回 ''（不指定 size）
 *  - 档位查不到 → 回退该比例的 '1K'；比例也查不到 → 兜底 DEFAULT_PIXEL
 */
export function resolveImagePixel(ratio: string, size: string): string {
  if (!ratio || ratio === 'Auto' || ratio === 'auto') return '';
  const byRatio = RATIO_PIXEL_TABLE[ratio] || {};
  return byRatio[size] || byRatio['1K'] || DEFAULT_PIXEL;
}

/** 把任意数值夹到 [MIN_PIXEL_SIDE, MAX_PIXEL_SIDE] 并取整 */
function clampSide(n: number): number {
  return Math.min(MAX_PIXEL_SIDE, Math.max(MIN_PIXEL_SIDE, Math.round(n)));
}

/**
 * 'WxH' → { width, height }；非法（非数字 / 非正）→ null。
 * 【为什么需要】生图节点的 size 有两种来源：档位（'1K'）与用户直给的像素（'888x1184'）。
 * 后者必须以像素为真源原样透传，不能再被查表覆盖。
 */
export function parsePixelSize(value: string | undefined | null): PixelSize | null {
  if (!value) return null;
  const m = /^\s*(\d+)\s*[xX×]\s*(\d+)\s*$/.exec(value);
  if (!m) return null;
  const width = Number(m[1]);
  const height = Number(m[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

/** { width, height } → 'WxH'（取整 + 夹边界；生成请求 size 的唯一格式化出口） */
export function formatPixelSize(width: number, height: number): string {
  return `${clampSide(width)}x${clampSide(height)}`;
}

/**
 * 比例 + 档位 → 像素对象（UI 显示 / 手改输入框的初值来源）。
 *  - Auto / 空 → 按 1:1 的档位取值。'Auto' 在生图节点 UI 上叫「自定义」：
 *    不锁比例标签，但尺寸仍必须有确定值（本函数的返回值就是那个起点，用户可再手改）
 *  - 查表失败 → 兜底 1024x1024
 */
export function resolvePixelSize(ratio: string, size: string): PixelSize {
  const isAuto = !ratio || ratio === 'Auto' || ratio === 'auto';
  const parsed = parsePixelSize(resolveImagePixel(isAuto ? '1:1' : ratio, size));
  return parsed ?? { width: 1024, height: 1024 };
}
