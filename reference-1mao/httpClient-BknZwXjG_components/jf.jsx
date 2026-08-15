// TODO(全局, 无需 import): n
import { e, t } from './shared.js';
export default function jf(e, t) {
  let n = document.createElement(`a`);
  n.href = e;
  n.download = t;
  n.rel = `noopener`;
  n.click();
}