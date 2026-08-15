// TODO(全局, 无需 import): layers, canvasWidth, canvasHeight, bgColor, n, r, i, s, o
import _cmp_Bo_1 from './Bo_1.jsx';
import { e, a, t, c } from './shared.js';
var Vo = async e => {
  let {
    layers: t,
    canvasWidth: n,
    canvasHeight: r,
    bgColor: i
  } = e;
  if (n <= 0 || r <= 0) {
    return null;
  }
  let a = document.createElement(`canvas`);
  a.width = n;
  a.height = r;
  let o = a.getContext(`2d`);
  if (!o) {
    return null;
  }
  let s = i ?? `#000000`;
  if (s !== `transparent`) {
    o.fillStyle = s;
    o.fillRect(0, 0, n, r);
  }
  let c = [...t].filter(e => {
    return e.visible !== false;
  }).sort((e, t) => {
    return e.zIndex - t.zIndex;
  });
  for (let e of c) {
    let t = await _cmp_Bo_1(e);
    if (!t) {
      continue;
    }
    o.save();
    o.globalAlpha = e.opacity;
    let n = e.x + t.width * e.scale / 2;
    let r = e.y + t.height * e.scale / 2;
    o.translate(n, r);
    o.rotate(e.rotation * Math.PI / 180);
    o.translate(-n, -r);
    o.drawImage(t, e.x, e.y, t.width * e.scale, t.height * e.scale);
    o.restore();
  }
  return a.toDataURL(`image/png`);
};
export default Vo;