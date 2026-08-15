// TODO(全局, 无需 import): atTime, quality, timeoutMs, o, u, i, l, n, r, f
import { t, e, c, a, d } from './shared.js';
export default function mc(e, t = {}) {
  let {
    atTime: n = 0.1,
    quality: r = 0.85,
    timeoutMs: i = 15000
  } = t;
  return new Promise((t, a) => {
    let o = document.createElement(`video`);
    o.crossOrigin = `anonymous`;
    o.preload = `auto`;
    o.muted = true;
    o.playsInline = true;
    o.src = e;
    let s = false;
    let c = window.setTimeout(() => {
      u(Error(`captureVideoFrame: timeout`));
    }, i);
    let l = () => {
      window.clearTimeout(c);
      o.removeAttribute(`src`);
      try {
        o.load();
      } catch {}
    };
    let u = e => {
      if (!s) {
        s = true;
        l();
        a(e);
      }
    };
    let d = e => {
      if (!s) {
        s = true;
        l();
        t(e);
      }
    };
    let f = () => {
      try {
        let e = o.videoWidth;
        let t = o.videoHeight;
        if (!e || !t) {
          u(Error(`captureVideoFrame: zero video dimensions`));
          return;
        }
        let n = document.createElement(`canvas`);
        n.width = e;
        n.height = t;
        let i = n.getContext(`2d`);
        if (!i) {
          u(Error(`captureVideoFrame: no 2d context`));
          return;
        }
        i.drawImage(o, 0, 0, e, t);
        n.toBlob(e => {
          if (e) {
            d(e);
          } else {
            u(Error(`captureVideoFrame: toBlob returned null (tainted canvas?)`));
          }
        }, `image/jpeg`, r);
      } catch (e) {
        u(e instanceof Error ? e : Error(String(e)));
      }
    };
    o.onerror = () => {
      return u(Error(`captureVideoFrame: video load/decode error`));
    };
    o.onloadeddata = () => {
      let e = Math.min(n, Math.max(0, (o.duration || n) - 0.01));
      if (Math.abs(o.currentTime - e) < 0.001) {
        f();
      } else {
        o.onseeked = f;
        try {
          o.currentTime = e;
        } catch {
          f();
        }
      }
    };
  });
}