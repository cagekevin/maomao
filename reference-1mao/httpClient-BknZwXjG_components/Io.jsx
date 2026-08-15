// TODO(全局, 无需 import): r, i, n, s, o, f, u, p, l
import { t, e, Fo, a, d, c } from './shared.js';
var Io = async (e, t) => {
  return new Promise(n => {
    let r = new Image();
    r.crossOrigin = `anonymous`;
    r.onload = () => {
      return i();
    };
    r.onerror = () => {
      let t = new Image();
      t.src = e;
      t.onload = () => {
        return i(t);
      };
      t.onerror = () => {
        return n(null);
      };
    };
    r.src = e;
    function i(e) {
      let i = e || r;
      let a = i.naturalWidth || i.width;
      let o = i.naturalHeight || i.height;
      let s = Fo(t.points);
      let c = s.minX * a;
      let l = s.minY * o;
      let u = Math.max(1, (s.maxX - s.minX) * a);
      let d = Math.max(1, (s.maxY - s.minY) * o);
      let f = document.createElement(`canvas`);
      f.width = Math.round(u);
      f.height = Math.round(d);
      let p = f.getContext(`2d`);
      if (!p) {
        return n(null);
      }
      p.save();
      p.beginPath();
      t.points.forEach((e, t) => {
        let n = e.x * a - c;
        let r = e.y * o - l;
        if (t === 0) {
          p.moveTo(n, r);
        } else {
          p.lineTo(n, r);
        }
      });
      p.closePath();
      p.clip();
      p.drawImage(i, -c, -l, a, o);
      p.restore();
      n(f.toDataURL(`image/png`));
    }
  });
};
export default Io;