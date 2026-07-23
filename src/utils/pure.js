// 纯工具函数 — 从 App.js 提取，无任何项目依赖
// 2026-07-24: 第1批 — clamp / genId / normalize / bbox / segments

// 数值钳制 [min, max]
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// 归一化分割线位置，去重排序
export function normalizeAxisValues(vals) {
  return Array.from(new Set(
    vals.map(v => clamp(v, 0.01, 0.99)).map(v => Math.round(v * 1e4) / 1e4)
  )).sort((a, b) => a - b);
}

// 分割点 → 相邻区间段 [[0..e],[e..1]...]
export function buildSegments(vals) {
  let pts = [0, ...vals, 1], segs = [];
  for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1]]);
  return segs;
}

// 点集包围盒
export function pointsBoundingBox(points) {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (let p of points) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

// 图层/套索 id 生成
export function makeLayerId() { return `layer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
export function makeLassoId()  { return `lasso-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

// 图片尺寸获取
export function getImageDimensions(src) {
  return new Promise((resolve, reject) => {
    let url = src instanceof File || src instanceof Blob ? URL.createObjectURL(src) : src;
    let cleanup = src instanceof File || src instanceof Blob;
    let img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); if (cleanup) URL.revokeObjectURL(url); };
    img.onerror = () => { reject(new Error('Failed to load image')); if (cleanup) URL.revokeObjectURL(url); };
    img.src = url;
  });
}
