// TODO(全局, 无需 import): r, n, willReadFrequently, i
import { e, t } from './shared.js';
import * as _shared from './shared.js';
export default function kl(e, t, n) {
  let r = e === `a` ? _shared.Dl : _shared.Ol;
  if (!r) {
    r = document.createElement(`canvas`);
    if (e === `a`) {
      _shared.Dl = r;
    } else {
      _shared.Ol = r;
    }
  }
  if (r.width !== t) {
    r.width = t;
  }
  if (r.height !== n) {
    r.height = n;
  }
  let i = r.getContext(`2d`, {
    willReadFrequently: true
  });
  i.clearRect(0, 0, t, n);
  return i;
}