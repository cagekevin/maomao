// TODO(全局, 无需 import): r, n, willReadFrequently, i
import { e, t } from './shared.js';
import * as _shared from './shared.js';
export default function Xl(e, t, n) {
  let r = e === `a` ? _shared.Jl : _shared.Yl;
  if (!r) {
    r = document.createElement(`canvas`);
    if (e === `a`) {
      _shared.Jl = r;
    } else {
      _shared.Yl = r;
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