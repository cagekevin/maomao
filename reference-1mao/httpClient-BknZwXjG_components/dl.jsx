// TODO(全局, 无需 import): r, n, o, s, l, i
import { a, c, t, e, ul } from './shared.js';
export default function dl(e, t, n, r = 0.5, i = `rect`) {
  let a = Math.max(3, Math.round(24 - r * 20));
  let o = Math.max(1, a);
  let s = Math.max(1, Math.round(n.h / n.w * a));
  let c = document.createElement(`canvas`);
  c.width = o;
  c.height = s;
  let l = c.getContext(`2d`);
  l.imageSmoothingEnabled = false;
  l.drawImage(t, n.x, n.y, n.w, n.h, 0, 0, o, s);
  e.save();
  ul(e, n, i);
  e.imageSmoothingEnabled = false;
  e.drawImage(c, 0, 0, o, s, n.x, n.y, n.w, n.h);
  e.imageSmoothingEnabled = true;
  e.restore();
}