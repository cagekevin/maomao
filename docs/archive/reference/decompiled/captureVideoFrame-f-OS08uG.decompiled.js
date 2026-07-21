function e(e, t = {}) {
  let {
    atTime: n = .1,
    quality: r = .85,
    timeoutMs: i = 15e3
  } = t;
  return new Promise((t, a) => {
    let o = document.createElement(`video`);
    o.crossOrigin = `anonymous`, o.preload = `auto`, o.muted = true, o.playsInline = true, o.src = e;
    let s = false,
      c = window.setTimeout(() => {
        u(Error(`captureVideoFrame: timeout`));
      }, i),
      l = () => {
        window.clearTimeout(c), o.removeAttribute(`src`);
        try {
          o.load();
        } catch {}
      },
      u = e => {
        s || (s = true, l(), a(e));
      },
      d = e => {
        s || (s = true, l(), t(e));
      },
      f = () => {
        try {
          let e = o.videoWidth,
            t = o.videoHeight;
          if (!e || !t) {
            u(Error(`captureVideoFrame: zero video dimensions`));
            return;
          }
          let n = document.createElement(`canvas`);
          n.width = e, n.height = t;
          let i = n.getContext(`2d`);
          if (!i) {
            u(Error(`captureVideoFrame: no 2d context`));
            return;
          }
          i.drawImage(o, 0, 0, e, t), n.toBlob(e => {
            e ? d(e) : u(Error(`captureVideoFrame: toBlob returned null (tainted canvas?)`));
          }, `image/jpeg`, r);
        } catch (e) {
          u(e instanceof Error ? e : Error(String(e)));
        }
      };
    o.onerror = () => u(Error(`captureVideoFrame: video load/decode error`)), o.onloadeddata = () => {
      let e = Math.min(n, Math.max(0, (o.duration || n) - .01));
      if (Math.abs(o.currentTime - e) < .001) f();else {
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
export { e as captureVideoFrameBlob };