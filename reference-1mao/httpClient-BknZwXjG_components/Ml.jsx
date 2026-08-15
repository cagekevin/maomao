// TODO(全局, 无需 import): r, o, i, n, drawDivider
import { w, h, El, e, t, a, Al } from './shared.js';
export default function Ml(e, t, n, r = 1920) {
  let {
    w: i,
    h: a
  } = El(e, t, r);
  let o = document.createElement(`canvas`);
  o.width = i;
  o.height = a;
  Al(o.getContext(`2d`), e, t, {
    ...n,
    drawDivider: n.drawDivider ?? true
  });
  return new Promise((e, t) => {
    o.toBlob(n => {
      if (n) {
        e(n);
      } else {
        t(Error(`导出失败（画布可能被跨域污染）`));
      }
    }, `image/png`);
  });
}