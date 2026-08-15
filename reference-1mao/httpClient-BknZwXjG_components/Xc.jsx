// TODO(全局, 无需 import): maxSize, quality, format, targetKB, timeoutMs, o, s, n, l, u, i, f, r, p, blob, dataUrl, m, width, height, size, originalSize
import { Kc, e, Yc, d, qc, Jc, c } from './shared.js';
import * as _shared from './shared.js';
export default async function Xc(e, t = {}) {
  let {
    maxSize: n = 0,
    quality: r = 0.8,
    format: i = `image/jpeg`,
    targetKB: a,
    timeoutMs: o = 20000
  } = t;
  let s = await Kc(e, o);
  let c = await Yc(e);
  let l = s.naturalWidth || s.width;
  let u = s.naturalHeight || s.height;
  if (!l || !u) {
    throw Error(`无法获取图片尺寸`);
  }
  if (n && (l > n || u > n)) {
    if (l >= u) {
      u = Math.round(u * n / l);
      l = n;
    } else {
      l = Math.round(l * n / u);
      u = n;
    }
  }
  let d = document.createElement(`canvas`);
  d.width = l;
  d.height = u;
  let f = d.getContext(`2d`);
  if (!f) {
    throw Error(`Canvas 2D 不可用`);
  }
  if (i === `image/jpeg`) {
    f.fillStyle = `#ffffff`;
    f.fillRect(0, 0, l, u);
  }
  f.drawImage(s, 0, 0, l, u);
  let p;
  if (i !== `image/png` && a && a > 0) {
    let e = a * 1024;
    let t = 0.05;
    let n = 0.95;
    let r = await qc(d, i, n);
    if (r.size > e) {
      for (let a = 0; a < 8; a++) {
        let a = (t + n) / 2;
        let o = await qc(d, i, a);
        if (o.size > e) {
          n = a;
        } else {
          t = a;
          r = o;
        }
      }
      r = await qc(d, i, t);
    }
    p = r;
  } else {
    p = await qc(d, i, r);
  }
  let m = await Jc(p);
  return {
    blob: p,
    dataUrl: m,
    width: l,
    height: u,
    size: p.size,
    originalSize: c,
    format: i
  };
}