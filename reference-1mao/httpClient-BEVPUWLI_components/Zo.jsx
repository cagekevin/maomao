// TODO(全局, 无需 import): i, n, r
import { Xo, e, t, a } from './shared.js';
var Zo = async e => {
  let t = await Xo(e.imageUrl);
  if (!t) {
    return null;
  }
  let n = t.naturalWidth || t.width;
  let r = t.naturalHeight || t.height;
  let i = document.createElement(`canvas`);
  i.width = n;
  i.height = r;
  let a = i.getContext(`2d`);
  if (!a) {
    return null;
  }
  a.drawImage(t, 0, 0, n, r);
  if (e.maskUrl) {
    let t = await Xo(e.maskUrl);
    if (t) {
      a.globalCompositeOperation = `destination-in`;
      a.drawImage(t, 0, 0, n, r);
      a.globalCompositeOperation = `source-over`;
    }
  }
  return i;
};
export default Zo;