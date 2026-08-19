// TODO(全局, 无需 import): mode, strength, format, timeoutMs, color, l, u, f, s, p, n, i, r, o, dataUrl, width, height, faceCount, m
import { t, El, Dl, e, a, c, d, Ol, Pl, Al, Nl, kl, Ll } from './shared.js';
export default async function Rl(e, t = {}) {
  let {
    mode: n = `mosaic`,
    strength: r = 0.5,
    format: i = `image/png`,
    timeoutMs: a = 20000,
    color: o = `#000000`
  } = t;
  let s = await El();
  let c = await Dl(e, a);
  let l = c.naturalWidth || c.width;
  let u = c.naturalHeight || c.height;
  if (!l || !u) {
    throw Error(`无法获取图片尺寸`);
  }
  let d = document.createElement(`canvas`);
  d.width = l;
  d.height = u;
  let f = d.getContext(`2d`);
  if (!f) {
    throw Error(`Canvas 2D 不可用`);
  }
  f.drawImage(c, 0, 0, l, u);
  let p = s.detect(c).detections || [];
  let m = 0;
  for (let e of p) {
    if (n === `bar`) {
      let t = Ol(e, l, u);
      if (t) {
        let e = (t.lx + t.rx) / 2;
        let n = (t.ly + t.ry) / 2;
        let i = Math.atan2(t.ly - t.ry, t.lx - t.rx);
        Pl(f, e, n, t.dist * 2.3, t.dist * 0.85, i, r, o);
        m++;
      } else {
        let t = Al(e, l, u);
        if (!t) {
          continue;
        }
        Nl(f, t, r, o);
        m++;
      }
      continue;
    }
    let t = kl(e, l, u);
    if (t) {
      m++;
      Ll(f, c, t, n, r, n === `mosaic` || n === `blur` ? `ellipse` : `rect`, o);
    }
  }
  return {
    dataUrl: d.toDataURL(i, i === `image/png` ? undefined : 0.92),
    width: l,
    height: u,
    faceCount: m
  };
}