// TODO(全局, 无需 import): o, n, r, i, s, left, width, height, l, u, g, m, f, p, camera, context, frameRect, heightScale, labels, viewportHeight, viewportWidth, widthScale
import { e, wm, t, a, c, d, h, _g } from './shared.js';
import * as _shared from './shared.js';
export default function vg(e, t, n, r, i) {
  let a = e.clientWidth || e.width;
  let o = e.clientHeight || e.height;
  let s = wm(t, a, o, n, r);
  let c = i?.labels ?? [];
  if (!s && c.length === 0) {
    return e.toDataURL(`image/png`);
  }
  let l = s ?? {
    left: 0,
    top: 0,
    width: a,
    height: o
  };
  let u = e.width / Math.max(a, 1);
  let d = e.height / Math.max(o, 1);
  let f = Math.round(l.left * u);
  let p = Math.round(l.top * d);
  let m = Math.max(Math.round(l.width * u), 1);
  let h = Math.max(Math.round(l.height * d), 1);
  let g = document.createElement(`canvas`);
  g.width = m;
  g.height = h;
  let _ = null;
  try {
    _ = g.getContext(`2d`);
  } catch {
    return e.toDataURL(`image/png`);
  }
  if (_) {
    _.drawImage(e, f, p, m, h, 0, 0, m, h);
    if (i) {
      _g({
        camera: i.camera,
        context: _,
        frameRect: l,
        heightScale: d,
        labels: c,
        viewportHeight: o,
        viewportWidth: a,
        widthScale: u
      });
    }
    return g.toDataURL(`image/png`);
  } else {
    return e.toDataURL(`image/png`);
  }
}