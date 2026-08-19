// TODO(全局, 无需 import): n, r, i
import { t, e, a } from './shared.js';
var So = e => {
  try {
    let t = window.getSelection();
    if (!t || t.rangeCount === 0) {
      return null;
    }
    let n = t.getRangeAt(0).cloneRange();
    if (e && t.anchorNode && !e.contains(t.anchorNode)) {
      return null;
    }
    n.collapse(true);
    let r = n.getClientRects();
    if (r.length > 0) {
      return r[0];
    }
    let i = document.createElement(`span`);
    i.textContent = `​`;
    n.insertNode(i);
    let a = i.getBoundingClientRect();
    i.parentNode?.removeChild(i);
    t.removeAllRanges();
    t.addRange(n);
    if (a && (a.width > 0 || a.height > 0 || a.top > 0 || a.left > 0)) {
      return a;
    } else {
      return null;
    }
  } catch {
    return null;
  }
};
export default So;