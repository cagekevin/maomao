// TODO(全局, 无需 import): n, r, i
import _cmp_Er from './Er.jsx';
import { e, t, a } from './shared.js';
export default async function wo(e, t) {
  let n = document.createElement(`canvas`);
  let r = e.naturalWidth / e.width;
  let i = e.naturalHeight / e.height;
  n.width = t.width * r;
  n.height = t.height * i;
  let a = n.getContext(`2d`);
  if (!a) {
    throw Error(`No 2d context`);
  }
  a.drawImage(e, t.x * r, t.y * i, t.width * r, t.height * i, 0, 0, t.width * r, t.height * i);
  return new Promise((e, t) => {
    n.toBlob(async n => {
      if (!n) {
        t(Error(`Canvas is empty`));
        return;
      }
      try {
        e(await _cmp_Er(n, 2048, 0.85));
      } catch (e) {
        t(e);
      }
    }, `image/jpeg`, 0.9);
  });
}