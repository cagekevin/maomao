// TODO(全局, 无需 import): s, o, i, l, r, u, n
import { e, t } from './shared.js';
import * as _shared from './shared.js';
var Tr = async (e, t = 200, n = 0.6) => {
  return new Promise((r, i) => {
    let a;
    let o = false;
    if (e instanceof File || e instanceof Blob) {
      a = URL.createObjectURL(e);
      o = true;
    } else {
      a = e;
    }
    let s = new Image();
    s.crossOrigin = `anonymous`;
    s.onload = () => {
      if (o) {
        URL.revokeObjectURL(a);
      }
      let i = s.width;
      let c = s.height;
      if (i > c) {
        if (i > t) {
          c = Math.round(c * t / i);
          i = t;
        }
      } else if (c > t) {
        i = Math.round(i * t / c);
        c = t;
      }
      let l = document.createElement(`canvas`);
      l.width = i;
      l.height = c;
      let u = l.getContext(`2d`);
      if (!u) {
        r(typeof e == `string` ? e : ``);
        return;
      }
      u.drawImage(s, 0, 0, i, c);
      r(l.toDataURL(`image/jpeg`, n));
    };
    s.onerror = () => {
      if (o) {
        URL.revokeObjectURL(a);
      }
      if (typeof e == `string`) {
        r(e);
      } else {
        i(Error(`Failed to load image for thumbnail`));
      }
    };
    s.src = a;
  });
};
export default Tr;