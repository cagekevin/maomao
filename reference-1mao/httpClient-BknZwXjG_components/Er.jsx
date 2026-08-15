// TODO(全局, 无需 import): o, i, l, r, s, u, n
import { c, t } from './shared.js';
import * as _shared from './shared.js';
var Er = async (e, t = 2048, n = 0.85) => {
  return new Promise((r, i) => {
    let a;
    let o = false;
    let s = `image/jpeg`;
    if (e instanceof File || e instanceof Blob) {
      a = URL.createObjectURL(e);
      o = true;
      if (e.type === `image/png`) {
        s = `image/png`;
      } else if (e.type === `image/webp`) {
        s = `image/webp`;
      }
    } else {
      a = e;
      if (a.startsWith(`data:image/png`)) {
        s = `image/png`;
      } else if (a.startsWith(`data:image/webp`)) {
        s = `image/webp`;
      }
    }
    let c = new Image();
    c.crossOrigin = `anonymous`;
    c.onload = () => {
      if (o) {
        URL.revokeObjectURL(a);
      }
      let e = c.width;
      let i = c.height;
      if (e > t || i > t) {
        if (e > i) {
          i = Math.round(i * t / e);
          e = t;
        } else {
          e = Math.round(e * t / i);
          i = t;
        }
      }
      let l = document.createElement(`canvas`);
      l.width = e;
      l.height = i;
      let u = l.getContext(`2d`);
      if (!u) {
        r(a);
        return;
      }
      if (s === `image/jpeg`) {
        u.fillStyle = `#FFFFFF`;
        u.fillRect(0, 0, e, i);
      }
      u.drawImage(c, 0, 0, e, i);
      r(l.toDataURL(s, n));
    };
    c.onerror = () => {
      if (o) {
        URL.revokeObjectURL(a);
      }
      if (typeof e == `string`) {
        r(e);
      } else {
        i(Error(`Failed to load image for resizing`));
      }
    };
    c.src = a;
  });
};
export default Er;