// TODO(全局, 无需 import): fps, maxSize, colors, startTime, endTime, speed, timeoutMs, onProgress, u, o, p, f, r, g, willReadFrequently, n, s, m, b, i, x, v, data, palette, delay, l, Uint8Array, type, blob, width, height, frameCount, size
import _cmp_nc from './nc.jsx';
import { t, c, d, a, _, y, tc, rc, C, w, S, T, E, D } from './shared.js';
import * as _shared from './shared.js';
export default async function ic(e, t = {}) {
  let {
    fps: n = 10,
    maxSize: r = 480,
    colors: i = 256,
    startTime: a = 0,
    endTime: o,
    speed: s = 1,
    timeoutMs: c = 30000,
    onProgress: l
  } = t;
  let u = await _cmp_nc(e, c);
  let d = u.duration;
  if (!d || isNaN(d) || d === Infinity) {
    throw Error(`无法获取视频时长`);
  }
  let f = Math.max(0, a);
  let p = Math.min(o ?? d, d);
  let m = Math.max(0.1, p - f);
  let h = u.videoWidth;
  let g = u.videoHeight;
  if (!h || !g) {
    throw Error(`无法获取视频尺寸`);
  }
  if (h > r || g > r) {
    if (h >= g) {
      g = Math.round(g * r / h);
      h = r;
    } else {
      h = Math.round(h * r / g);
      g = r;
    }
  }
  h = Math.max(2, h - h % 2);
  g = Math.max(2, g - g % 2);
  let _ = document.createElement(`canvas`);
  _.width = h;
  _.height = g;
  let v = _.getContext(`2d`, {
    willReadFrequently: true
  });
  if (!v) {
    throw Error(`Canvas 2D 不可用`);
  }
  let y = Math.max(0.5, Math.min(30, n));
  let b = Math.max(0.1, Math.min(8, s));
  let x = Math.max(1, Math.round(m * y));
  let S = Math.max(20, Math.round(1000 / y / b));
  let C = Math.max(2, Math.min(256, i));
  let w = tc.GIFEncoder();
  for (let e = 0; e < x; e++) {
    let t = f + e / y;
    await rc(u, Math.min(t, p));
    v.drawImage(u, 0, 0, h, g);
    let {
      data: n
    } = v.getImageData(0, 0, h, g);
    let r = tc.quantize(n, C);
    let i = tc.applyPalette(n, r);
    w.writeFrame(i, h, g, {
      palette: r,
      delay: S
    });
    l?.((e + 1) / x);
    await new Promise(e => {
      return setTimeout(e, 0);
    });
  }
  w.finish();
  u.removeAttribute(`src`);
  try {
    u.load();
  } catch {}
  let T = w.bytes();
  let E = new Uint8Array(T.length);
  E.set(T);
  let D = new Blob([E], {
    type: `image/gif`
  });
  return {
    blob: D,
    width: h,
    height: g,
    frameCount: x,
    size: D.size
  };
}