// TODO(全局, 无需 import): constructor, TypeError, length, _ensureInit, _videoSampleToWrappedCanvas, alpha, fit, rotation, crop, canvas, timestamp, duration, getCanvas, canvases, canvasesAtTimestamps
import { e, el, t, As, Gc, Kc, n, r, ks, o, u, Ne, Fc, he } from "./shared.js";
import * as _shared from "./shared.js";
var qc = class {
  constructor(e, t = {}) {
    this._rotation = 0;
    this._initPromise = null;
    this._nextCanvasIndex = 0;
    if (!(e instanceof el)) {
      throw TypeError(`videoTrack must be an InputVideoTrack.`);
    }
    if (t && typeof t != `object`) {
      throw TypeError(`options must be an object.`);
    }
    if (t.alpha !== undefined && typeof t.alpha != `boolean`) {
      throw TypeError(`options.alpha, when provided, must be a boolean.`);
    }
    if (t.width !== undefined && (!Number.isInteger(t.width) || t.width <= 0)) {
      throw TypeError(`options.width, when defined, must be a positive integer.`);
    }
    if (t.height !== undefined && (!Number.isInteger(t.height) || t.height <= 0)) {
      throw TypeError(`options.height, when defined, must be a positive integer.`);
    }
    if (t.fit !== undefined && ![`fill`, `contain`, `cover`].includes(t.fit)) {
      throw TypeError(`options.fit, when provided, must be one of "fill", "contain", or "cover".`);
    }
    if (t.width !== undefined && t.height !== undefined && t.fit === undefined) {
      throw TypeError(`When both options.width and options.height are provided, options.fit must also be provided.`);
    }
    if (t.rotation !== undefined && ![0, 90, 180, 270].includes(t.rotation)) {
      throw TypeError(`options.rotation, when provided, must be 0, 90, 180 or 270.`);
    }
    if (t.crop !== undefined) {
      As(t.crop, `options.`);
    }
    if (t.poolSize !== undefined && (typeof t.poolSize != `number` || !Number.isInteger(t.poolSize) || t.poolSize < 0)) {
      throw TypeError(`poolSize must be a non-negative integer.`);
    }
    if (t.decoderOptions !== undefined) {
      Gc(t.decoderOptions);
    }
    this._videoTrack = e;
    this._alpha = t.alpha ?? false;
    this._options = t;
    this._fit = t.fit ?? `fill`;
    this._videoSampleSink = new Kc(e, t.decoderOptions);
    this._canvasPool = Array.from({
      length: t.poolSize ?? 0
    }, () => {
      return null;
    });
  }
  _ensureInit() {
    return this._initPromise ??= (async () => {
      let e = this._options;
      let t = this._videoTrack;
      let n = e.rotation ?? (await t.getRotation());
      let r = await t.getSquarePixelWidth();
      let i = await t.getSquarePixelHeight();
      let [a, o] = n % 180 == 0 ? [r, i] : [i, r];
      let s = e.crop;
      s &&= ks(s, a, o);
      let [c, l] = s ? [s.width, s.height] : [a, o];
      let u = c / l;
      if (e.width !== undefined && e.height === undefined) {
        c = e.width;
        l = Math.round(c / u);
      } else if (e.width === undefined && e.height !== undefined) {
        l = e.height;
        c = Math.round(l * u);
      } else if (e.width !== undefined && e.height !== undefined) {
        c = e.width;
        l = e.height;
      }
      this._width = c;
      this._height = l;
      this._rotation = n;
      this._crop = s;
    })();
  }
  _videoSampleToWrappedCanvas(e) {
    let t = this._width;
    let r = this._height;
    let i = this._canvasPool[this._nextCanvasIndex];
    let a = false;
    if (!i) {
      if (typeof document < `u`) {
        i = document.createElement(`canvas`);
        i.width = t;
        i.height = r;
      } else {
        i = new OffscreenCanvas(t, r);
      }
      if (this._canvasPool.length > 0) {
        this._canvasPool[this._nextCanvasIndex] = i;
      }
      a = true;
    }
    if (this._canvasPool.length > 0) {
      this._nextCanvasIndex = (this._nextCanvasIndex + 1) % this._canvasPool.length;
    }
    let o = i.getContext(`2d`, {
      alpha: this._alpha || Ne()
    });
    n(o);
    o.resetTransform();
    if (!a) {
      if (!this._alpha && Ne()) {
        o.fillStyle = `black`;
        o.fillRect(0, 0, t, r);
      } else {
        o.clearRect(0, 0, t, r);
      }
    }
    e.drawWithFit(o, {
      fit: this._fit,
      rotation: this._rotation,
      crop: this._crop
    });
    let s = {
      canvas: i,
      timestamp: e.timestamp,
      duration: e.duration
    };
    e.close();
    return s;
  }
  async getCanvas(e, t) {
    Fc(e);
    await this._ensureInit();
    let n = await this._videoSampleSink.getSample(e, t);
    return n && this._videoSampleToWrappedCanvas(n);
  }
  async *canvases(e, t, n) {
    await this._ensureInit();
    yield* he(this._videoSampleSink.samples(e, t, n), e => {
      return this._videoSampleToWrappedCanvas(e);
    });
  }
  async *canvasesAtTimestamps(e, t) {
    await this._ensureInit();
    yield* he(this._videoSampleSink.samplesAtTimestamps(e, t), e => {
      return e && this._videoSampleToWrappedCanvas(e);
    });
  }
};
export default qc;