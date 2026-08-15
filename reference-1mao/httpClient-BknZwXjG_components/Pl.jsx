// TODO(全局, 无需 import): b, mode, orientation, diffStrength, durationMs, fps, maxSize, onProgress, n, f, u, willReadFrequently, r, mime, ext, s, MediaRecorder, g, m, mimeType, v, o, p, i, split, drawDivider, l, blob, type, width, height
import { a, e, w, h, El, t, c, d, Nl, _, y, Al } from './shared.js';
export default async function Pl(e) {
  let {
    a: t,
    b: n,
    mode: r,
    orientation: i,
    diffStrength: a,
    durationMs: o = 4000,
    fps: s = 30,
    maxSize: c = 1280,
    onProgress: l
  } = e;
  let {
    w: u,
    h: d
  } = El(t, n, c);
  let f = document.createElement(`canvas`);
  f.width = u;
  f.height = d;
  let p = f.getContext(`2d`, {
    willReadFrequently: r === `diff`
  });
  let {
    mime: m,
    ext: h
  } = Nl();
  let g = f.captureStream(s);
  let _ = new MediaRecorder(g, m ? {
    mimeType: m
  } : undefined);
  let v = [];
  _.ondataavailable = e => {
    if (e.data && e.data.size > 0) {
      v.push(e.data);
    }
  };
  let y = [t, n].filter(e => {
    return e instanceof HTMLVideoElement;
  });
  y.forEach(e => {
    e.muted = true;
    try {
      e.currentTime = 0;
    } catch {}
  });
  await Promise.all(y.map(e => {
    return e.play().catch(() => {});
  }));
  return new Promise((e, s) => {
    let c = performance.now();
    let f = 0;
    let g = () => {
      let e = performance.now() - c;
      let s = Math.min(1, e / o);
      Al(p, t, n, {
        mode: r,
        orientation: i,
        split: r === `slider` ? 0.5 - Math.cos(s * Math.PI * 2) * 0.5 : 0.5,
        diffStrength: a,
        drawDivider: r === `slider`
      });
      l?.(s);
      if (e >= o) {
        _.stop();
        y.forEach(e => {
          return e.pause();
        });
        cancelAnimationFrame(f);
        return;
      }
      f = requestAnimationFrame(g);
    };
    _.onstop = () => {
      e({
        blob: new Blob(v, {
          type: m || `video/webm`
        }),
        ext: h,
        width: u,
        height: d
      });
    };
    _.onerror = () => {
      return s(Error(`录制失败`));
    };
    _.start();
    f = requestAnimationFrame(g);
  });
}