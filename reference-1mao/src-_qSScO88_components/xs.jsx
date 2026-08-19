// TODO(全局, 无需 import): codedWidth, codedHeight, displayWidth, displayHeight, microsecondTimestamp, microsecondDuration, hasAlpha, constructor, ArrayBuffer, SharedArrayBuffer, TypeError, primaries, transfer, matrix, fullRange, left, width, height, timestamp, duration, alpha, willReadFrequently, num, den, type, data, clone, rotation, encodeOptions, Uint8Array, format, layout, colorSpace, visibleRect, _doNotCopy, close, allocationSize, copyTo, stack, error, hasError, stride, offset, toVideoFrame, draw, CanvasRenderingContext2D, OffscreenCanvasRenderingContext2D, sx, sy, sWidth, sHeight, drawWithFit, _rotateSourceRegion, toCanvasImageSource, transform, fit, crop, canvas, age, setRotation, setTimestamp, setDuration, setEncodeOptions
import { we, bs, ys, Qe, Ms, Ds, a, Ne, vs, Ze, _s, Os, js, Ps, S, ps, ms, Ns, v, y, b, _, As, ks, _e, Ss, Ts, ws, Ye } from "./shared.js";
import * as _shared from "./shared.js";
var xs = class e {
  get codedWidth() {
    return this.visibleRect.width;
  }
  get codedHeight() {
    return this.visibleRect.height;
  }
  get displayWidth() {
    if (this.rotation % 180 == 0) {
      return this.squarePixelWidth;
    } else {
      return this.squarePixelHeight;
    }
  }
  get displayHeight() {
    if (this.rotation % 180 == 0) {
      return this.squarePixelHeight;
    } else {
      return this.squarePixelWidth;
    }
  }
  get microsecondTimestamp() {
    return Math.trunc(we * this.timestamp);
  }
  get microsecondDuration() {
    return Math.trunc(we * this.duration);
  }
  get hasAlpha() {
    return this.format && this.format.includes(`A`);
  }
  constructor(t, n) {
    this._closed = false;
    if (t instanceof ArrayBuffer || typeof SharedArrayBuffer < `u` && t instanceof SharedArrayBuffer || ArrayBuffer.isView(t)) {
      if (!n || typeof n != `object`) {
        throw TypeError(`init must be an object.`);
      }
      if (n.format === undefined || !bs.has(n.format)) {
        throw TypeError(`init.format must be one of: ${ys.join(`, `)}`);
      }
      if (!Number.isInteger(n.codedWidth) || n.codedWidth <= 0) {
        throw TypeError(`init.codedWidth must be a positive integer.`);
      }
      if (!Number.isInteger(n.codedHeight) || n.codedHeight <= 0) {
        throw TypeError(`init.codedHeight must be a positive integer.`);
      }
      if (n.rotation !== undefined && ![0, 90, 180, 270].includes(n.rotation)) {
        throw TypeError(`init.rotation, when provided, must be 0, 90, 180, or 270.`);
      }
      if (!Number.isFinite(n.timestamp)) {
        throw TypeError(`init.timestamp must be a number.`);
      }
      if (n.duration !== undefined && (!Number.isFinite(n.duration) || n.duration < 0)) {
        throw TypeError(`init.duration, when provided, must be a non-negative number.`);
      }
      if (n.layout !== undefined) {
        if (!Array.isArray(n.layout)) {
          throw TypeError(`init.layout, when provided, must be an array.`);
        }
        for (let e of n.layout) {
          if (!e || typeof e != `object` || Array.isArray(e)) {
            throw TypeError(`Each entry in init.layout must be an object.`);
          }
          if (!Number.isInteger(e.offset) || e.offset < 0) {
            throw TypeError(`plane.offset must be a non-negative integer.`);
          }
          if (!Number.isInteger(e.stride) || e.stride < 0) {
            throw TypeError(`plane.stride must be a non-negative integer.`);
          }
        }
      }
      if (n.visibleRect !== undefined) {
        Qe(n.visibleRect, `init.visibleRect`);
      }
      if (n.displayWidth !== undefined && (!Number.isInteger(n.displayWidth) || n.displayWidth <= 0)) {
        throw TypeError(`init.displayWidth, when provided, must be a positive integer.`);
      }
      if (n.displayHeight !== undefined && (!Number.isInteger(n.displayHeight) || n.displayHeight <= 0)) {
        throw TypeError(`init.displayHeight, when provided, must be a positive integer.`);
      }
      if (n.displayWidth !== undefined != (n.displayHeight !== undefined)) {
        throw TypeError(`init.displayWidth and init.displayHeight must be either both provided or both omitted.`);
      }
      this.format = n.format;
      this.rotation = n.rotation ?? 0;
      this.timestamp = n.timestamp;
      this.duration = n.duration ?? 0;
      let e = n.layout ?? Ms(n.format, n.codedWidth, n.codedHeight);
      let r = n.colorSpace ?? null;
      if (r === null) {
        if (this.format === `RGBA` || this.format === `RGBX` || this.format === `BGRA` || this.format === `BGRX`) {
          r = {
            primaries: `bt709`,
            transfer: `iec61966-2-1`,
            matrix: `rgb`,
            fullRange: true
          };
        } else {
          r = {
            primaries: `bt709`,
            transfer: `bt709`,
            matrix: `bt709`,
            fullRange: false
          };
        }
      }
      this.visibleRect = {
        left: n.visibleRect?.left ?? 0,
        top: n.visibleRect?.top ?? 0,
        width: n.visibleRect?.width ?? n.codedWidth,
        height: n.visibleRect?.height ?? n.codedHeight
      };
      if (n.displayWidth === undefined) {
        this.squarePixelWidth = this.visibleRect.width;
        this.squarePixelHeight = this.visibleRect.height;
      } else {
        if (this.rotation % 180 == 0) {
          this.squarePixelWidth = n.displayWidth;
        } else {
          this.squarePixelWidth = n.displayHeight;
        }
        if (this.rotation % 180 == 0) {
          this.squarePixelHeight = n.displayHeight;
        } else {
          this.squarePixelHeight = n.displayWidth;
        }
      }
      if (n._doNotCopy) {
        this._data = _shared.l(t);
      } else {
        this._data = _shared.l(t).slice();
      }
      this._layout = e;
      this.colorSpace = new Ds(r);
    } else if (typeof VideoFrame < `u` && t instanceof VideoFrame) {
      if (n?.rotation !== undefined && ![0, 90, 180, 270].includes(n.rotation)) {
        throw TypeError(`init.rotation, when provided, must be 0, 90, 180, or 270.`);
      }
      if (n?.timestamp !== undefined && !Number.isFinite(n?.timestamp)) {
        throw TypeError(`init.timestamp, when provided, must be a number.`);
      }
      if (n?.duration !== undefined && (!Number.isFinite(n.duration) || n.duration < 0)) {
        throw TypeError(`init.duration, when provided, must be a non-negative number.`);
      }
      if (n?.visibleRect !== undefined) {
        Qe(n.visibleRect, `init.visibleRect`);
      }
      this._data = t;
      this._layout = null;
      this.format = t.format;
      this.visibleRect = {
        left: t.visibleRect?.x ?? 0,
        top: t.visibleRect?.y ?? 0,
        width: t.visibleRect?.width ?? t.codedWidth,
        height: t.visibleRect?.height ?? t.codedHeight
      };
      this.rotation = n?.rotation ?? 0;
      this.squarePixelWidth = t.displayWidth;
      this.squarePixelHeight = t.displayHeight;
      this.timestamp = n?.timestamp ?? t.timestamp / 1000000;
      this.duration = n?.duration ?? (t.duration ?? 0) / 1000000;
      this.colorSpace = new Ds(t.colorSpace);
    } else if (typeof HTMLImageElement < `u` && t instanceof HTMLImageElement || typeof SVGImageElement < `u` && t instanceof SVGImageElement || typeof ImageBitmap < `u` && t instanceof ImageBitmap || typeof HTMLVideoElement < `u` && t instanceof HTMLVideoElement || typeof HTMLCanvasElement < `u` && t instanceof HTMLCanvasElement || typeof OffscreenCanvas < `u` && t instanceof OffscreenCanvas) {
      if (!n || typeof n != `object`) {
        throw TypeError(`init must be an object.`);
      }
      if (n.rotation !== undefined && ![0, 90, 180, 270].includes(n.rotation)) {
        throw TypeError(`init.rotation, when provided, must be 0, 90, 180, or 270.`);
      }
      if (!Number.isFinite(n.timestamp)) {
        throw TypeError(`init.timestamp must be a number.`);
      }
      if (n.duration !== undefined && (!Number.isFinite(n.duration) || n.duration < 0)) {
        throw TypeError(`init.duration, when provided, must be a non-negative number.`);
      }
      if (typeof VideoFrame < `u`) {
        return new e(new VideoFrame(t, {
          timestamp: Math.trunc(n.timestamp * we),
          duration: Math.trunc((n.duration ?? 0) * we) || undefined
        }), n);
      }
      let r = 0;
      let i = 0;
      if (`naturalWidth` in t) {
        r = t.naturalWidth;
        i = t.naturalHeight;
      } else if (`videoWidth` in t) {
        r = t.videoWidth;
        i = t.videoHeight;
      } else if (`width` in t) {
        r = Number(t.width);
        i = Number(t.height);
      }
      if (!r || !i) {
        throw TypeError(`Could not determine dimensions.`);
      }
      let a = new OffscreenCanvas(r, i);
      let o = a.getContext(`2d`, {
        alpha: Ne(),
        willReadFrequently: true
      });
      if (!o) {
        throw Error(`OffscreenCanvas must have support for the '2d' context in order to create a VideoSample from this data.`);
      }
      o.drawImage(t, 0, 0);
      this._data = a;
      this._layout = null;
      this.format = `RGBX`;
      this.visibleRect = {
        left: 0,
        top: 0,
        width: r,
        height: i
      };
      this.squarePixelWidth = r;
      this.squarePixelHeight = i;
      this.rotation = n.rotation ?? 0;
      this.timestamp = n.timestamp;
      this.duration = n.duration ?? 0;
      this.colorSpace = new Ds({
        matrix: `rgb`,
        primaries: `bt709`,
        transfer: `iec61966-2-1`,
        fullRange: true
      });
    } else if (t instanceof vs) {
      if (!n || typeof n != `object`) {
        throw TypeError(`init must be an object.`);
      }
      if (n.rotation !== undefined && ![0, 90, 180, 270].includes(n.rotation)) {
        throw TypeError(`init.rotation, when provided, must be 0, 90, 180, or 270.`);
      }
      if (!Number.isFinite(n.timestamp)) {
        throw TypeError(`init.timestamp must be a number.`);
      }
      if (n.duration !== undefined && (!Number.isFinite(n.duration) || n.duration < 0)) {
        throw TypeError(`init.duration, when provided, must be a non-negative number.`);
      }
      this._data = t;
      t._referenceCount++;
      this.format = t.getFormat();
      if (this.format !== null && !ys.includes(this.format)) {
        throw TypeError(`getFormat() must return a VideoSamplePixelFormat or null.`);
      }
      this.visibleRect = {
        left: 0,
        top: 0,
        width: t.getCodedWidth(),
        height: t.getCodedHeight()
      };
      if (!Number.isInteger(this.visibleRect.width) || this.visibleRect.width <= 0) {
        throw TypeError(`getCodedWidth() must return a positive integer.`);
      }
      if (!Number.isInteger(this.visibleRect.height) || this.visibleRect.height <= 0) {
        throw TypeError(`getCodedHeight() must return a positive integer.`);
      }
      this.squarePixelWidth = t.getSquarePixelWidth();
      if (!Number.isInteger(this.squarePixelWidth) || this.squarePixelWidth <= 0) {
        throw TypeError(`getSquarePixelWidth() must return a positive integer.`);
      }
      this.squarePixelHeight = t.getSquarePixelHeight();
      if (!Number.isInteger(this.squarePixelHeight) || this.squarePixelHeight <= 0) {
        throw TypeError(`getSquarePixelHeight() must return a positive integer.`);
      }
      this.rotation = n.rotation ?? 0;
      this.timestamp = n.timestamp;
      this.duration = n.duration ?? 0;
      this.colorSpace = t.getColorSpace();
    } else {
      throw TypeError(`Invalid data type: Must be a BufferSource, CanvasImageSource, or VideoSampleResource.`);
    }
    this.encodeOptions = n?.encodeOptions ?? {};
    this.pixelAspectRatio = Ze({
      num: this.squarePixelWidth * this.codedHeight,
      den: this.squarePixelHeight * this.codedWidth
    });
    _s?.register(this, {
      type: `video`,
      data: this._data
    }, this);
  }
  clone() {
    if (this._closed) {
      throw Error(`VideoSample is closed.`);
    }
    _shared.n(this._data !== null);
    if (this._data instanceof vs) {
      return new e(this._data, {
        timestamp: this.timestamp,
        duration: this.duration,
        rotation: this.rotation,
        encodeOptions: this.encodeOptions
      });
    } else if (Os(this._data)) {
      return new e(this._data.clone(), {
        timestamp: this.timestamp,
        duration: this.duration,
        rotation: this.rotation,
        encodeOptions: this.encodeOptions
      });
    } else if (this._data instanceof Uint8Array) {
      _shared.n(this._layout);
      return new e(this._data, {
        format: this.format,
        layout: this._layout,
        codedWidth: this.codedWidth,
        codedHeight: this.codedHeight,
        timestamp: this.timestamp,
        duration: this.duration,
        colorSpace: this.colorSpace,
        rotation: this.rotation,
        visibleRect: this.visibleRect,
        displayWidth: this.displayWidth,
        displayHeight: this.displayHeight,
        encodeOptions: this.encodeOptions,
        _doNotCopy: true
      });
    } else {
      return new e(this._data, {
        format: this.format,
        codedWidth: this.codedWidth,
        codedHeight: this.codedHeight,
        timestamp: this.timestamp,
        duration: this.duration,
        colorSpace: this.colorSpace,
        rotation: this.rotation,
        visibleRect: this.visibleRect,
        displayWidth: this.displayWidth,
        displayHeight: this.displayHeight,
        encodeOptions: this.encodeOptions
      });
    }
  }
  close() {
    _s?.unregister(this);
    this._data._referenceCount--;
    this._data instanceof vs ? this._data._referenceCount === 0 && this._data.close() : Os(this._data) ? this._data.close() : this._data = null;
    this._closed ||= true;
  }
  allocationSize(e = {}) {
    js(e);
    if (this._closed) {
      throw Error(`VideoSample is closed.`);
    }
    if ((e.format ?? this.format) == null) {
      throw Error(`Cannot get allocation size when format is null.`);
    }
    if (Os(this._data)) {
      return this._data.allocationSize(e);
    } else {
      return Ps(this, e).allocationSize;
    }
  }
  async copyTo(t, r = {}) {
    if (!S(t)) {
      throw TypeError(`destination must be an ArrayBuffer or an ArrayBuffer view.`);
    }
    js(r);
    if (this._closed) {
      throw Error(`VideoSample is closed.`);
    }
    if ((r.format ?? this.format) == null) {
      throw Error(`Cannot copy video sample data when format is null.`);
    }
    _shared.n(this._data !== null);
    if (Os(this._data)) {
      return this._data.copyTo(t, r);
    }
    if (r.format && ![`RGBA`, `RGBX`, `BGRA`, `BGRX`].includes(this.format) && [`RGBA`, `RGBX`, `BGRA`, `BGRX`].includes(r.format)) {
      if (this._data instanceof vs) {
        let n = {
          stack: [],
          error: undefined,
          hasError: false
        };
        try {
          let i = ps(n, await this._data.toRgbSample({
            timestamp: this.timestamp,
            duration: this.duration,
            rotation: this.rotation
          }, r.colorSpace ?? `srgb`), false);
          if (!(i instanceof e)) {
            throw TypeError(`toRgbSample() must return a VideoSample.`);
          }
          if (![`RGBA`, `RGBX`, `BGRA`, `BGRX`].includes(i.format)) {
            throw Error(`Sample returned by toRgbSample was expected to have an RGB format, got '${i.format}' instead.`);
          }
          return await i.copyTo(t, r);
        } catch (e) {
          n.error = e;
          n.hasError = true;
        } finally {
          ms(n);
        }
      } else {
        if (typeof VideoFrame > `u`) {
          throw Error(`For this sample, converting from a non-RGB to an RGB format requires VideoFrame to be defined.`);
        }
        let e = this.toVideoFrame();
        let n = await e.copyTo(t, r);
        e.close();
        return n;
      }
    }
    let i = Ps(this, r);
    _shared.n(this.format);
    let a = _shared.l(t);
    if (a.byteLength < i.allocationSize) {
      throw TypeError(`Destination buffer too small. Required: ${i.allocationSize}, Available: ${a.byteLength}`);
    }
    let o = Ns(this.format);
    let s;
    if (this._data instanceof vs) {
      let e = this._data.getDataPlanes();
      if (e instanceof Promise) {
        e = await e;
      }
      if (!Array.isArray(e) || e.some(e => {
        return !(e.data instanceof Uint8Array) || !Number.isInteger(e.stride) || e.stride < 0;
      })) {
        throw TypeError(`getDataPlanes() must return an array of objects with a Uint8Array "data" property and a non-negative integer "stride" property.`);
      }
      s = e;
    } else if (this._data instanceof Uint8Array) {
      _shared.n(this._layout);
      _shared.n(this._layout.length === o.length);
      s = this._layout.map((e, t) => {
        let n = Math.ceil(this.codedHeight / o[t].heightDivisor);
        return {
          data: this._data.subarray(e.offset, e.offset + e.stride * n),
          stride: e.stride
        };
      });
    } else {
      let e = this._data.getContext(`2d`);
      _shared.n(e);
      s = [{
        data: _shared.l(e.getImageData(0, 0, this.codedWidth, this.codedHeight).data),
        stride: this.codedWidth * 4
      }];
    }
    let c = [];
    let u = o.length;
    for (let e = 0; e < u; e++) {
      let t = i.computedLayouts[e];
      let n = s[e].stride;
      let r = s[e].data;
      let o = t.sourceTop * n;
      o += t.sourceLeftBytes;
      let l = t.destinationOffset;
      let u = t.sourceWidthBytes;
      let d = {
        offset: l,
        stride: t.destinationStride
      };
      for (let e = 0; e < t.sourceHeight; e++) {
        if (o + u > r.byteLength) {
          throw Error(`Source buffer OOB read.`);
        }
        if (l + u > a.byteLength) {
          throw Error(`Destination buffer OOB write.`);
        }
        let e = r.subarray(o, o + u);
        a.set(e, l);
        o += n;
        l += t.destinationStride;
      }
      c.push(d);
    }
    if (r.format !== undefined) {
      let e = this.format.startsWith(`RGB`) !== r.format.startsWith(`RGB`);
      let t = this.format.includes(`X`) && r.format.includes(`A`);
      if (e || t) {
        for (let n = 0; n < i.allocationSize; n += 4) {
          if (e) {
            let e = a[n];
            a[n] = a[n + 2];
            a[n + 2] = e;
          }
          if (t) {
            a[n + 3] = 255;
          }
        }
      }
    }
    return c;
  }
  toVideoFrame() {
    if (this._closed) {
      throw Error(`VideoSample is closed.`);
    }
    _shared.n(this._data !== null);
    if (this._data instanceof vs) {
      if (this.format === null) {
        throw Error(`Cannot convert a VideoSampleResource-backed VideoSample to VideoFrame if format is null.`);
      }
      let e = this._data.getDataPlanes();
      if (e instanceof Promise) {
        throw Error(`Cannot convert a VideoSampleResource-backed VideoSample to VideoFrame if getDataPlanes() returns a promise.`);
      }
      let t = e.reduce((e, t) => {
        return e + t.data.byteLength;
      }, 0);
      let n = new Uint8Array(t);
      let r = 0;
      let i = [];
      for (let t of e) {
        n.set(t.data, r);
        i.push(r);
        r += t.data.byteLength;
      }
      return new VideoFrame(n, {
        format: this.format,
        layout: e.map((e, t) => {
          return {
            offset: i[t],
            stride: e.stride
          };
        }),
        codedWidth: this.codedWidth,
        codedHeight: this.codedHeight,
        timestamp: this.microsecondTimestamp,
        duration: this.microsecondDuration,
        colorSpace: this.colorSpace,
        visibleRect: this.visibleRect,
        displayWidth: this.squarePixelWidth,
        displayHeight: this.squarePixelHeight
      });
    } else if (Os(this._data)) {
      return new VideoFrame(this._data, {
        timestamp: this.microsecondTimestamp,
        duration: this.microsecondDuration || undefined
      });
    } else if (this._data instanceof Uint8Array) {
      _shared.n(this._layout);
      return new VideoFrame(this._data, {
        format: this.format,
        codedWidth: this.codedWidth,
        codedHeight: this.codedHeight,
        layout: this._layout,
        timestamp: this.microsecondTimestamp,
        duration: this.microsecondDuration || undefined,
        colorSpace: this.colorSpace,
        visibleRect: this.visibleRect,
        displayWidth: this.squarePixelWidth,
        displayHeight: this.squarePixelHeight
      });
    } else {
      return new VideoFrame(this._data, {
        timestamp: this.microsecondTimestamp,
        duration: this.microsecondDuration || undefined
      });
    }
  }
  draw(e, t, n, r, i, a, o, s, c) {
    let l = 0;
    let u = 0;
    let d = this.displayWidth;
    let f = this.displayHeight;
    let p = 0;
    let m = 0;
    let h = this.displayWidth;
    let g = this.displayHeight;
    if (a === undefined) {
      p = t;
      m = n;
      if (r !== undefined) {
        h = r;
        g = i;
      }
    } else {
      l = t;
      u = n;
      d = r;
      f = i;
      p = a;
      m = o;
      if (s === undefined) {
        h = d;
        g = f;
      } else {
        h = s;
        g = c;
      }
    }
    if ((!(typeof CanvasRenderingContext2D < `u`) || !(e instanceof CanvasRenderingContext2D)) && (!(typeof OffscreenCanvasRenderingContext2D < `u`) || !(e instanceof OffscreenCanvasRenderingContext2D))) {
      throw TypeError(`context must be a CanvasRenderingContext2D or OffscreenCanvasRenderingContext2D.`);
    }
    if (!Number.isFinite(l)) {
      throw TypeError(`sx must be a number.`);
    }
    if (!Number.isFinite(u)) {
      throw TypeError(`sy must be a number.`);
    }
    if (!Number.isFinite(d) || d < 0) {
      throw TypeError(`sWidth must be a non-negative number.`);
    }
    if (!Number.isFinite(f) || f < 0) {
      throw TypeError(`sHeight must be a non-negative number.`);
    }
    if (!Number.isFinite(p)) {
      throw TypeError(`dx must be a number.`);
    }
    if (!Number.isFinite(m)) {
      throw TypeError(`dy must be a number.`);
    }
    if (!Number.isFinite(h) || h < 0) {
      throw TypeError(`dWidth must be a non-negative number.`);
    }
    if (!Number.isFinite(g) || g < 0) {
      throw TypeError(`dHeight must be a non-negative number.`);
    }
    if (this._closed) {
      throw Error(`VideoSample is closed.`);
    }
    ({
      sx: l,
      sy: u,
      sWidth: d,
      sHeight: f
    } = this._rotateSourceRegion(l, u, d, f, this.rotation));
    let _ = this.toCanvasImageSource();
    e.save();
    let v = p + h / 2;
    let y = m + g / 2;
    e.translate(v, y);
    e.rotate(this.rotation * Math.PI / 180);
    let b = this.rotation % 180 == 0 ? 1 : h / g;
    e.scale(1 / b, b);
    e.drawImage(_, l, u, d, f, -h / 2, -g / 2, h, g);
    e.restore();
  }
  drawWithFit(e, t) {
    if ((!(typeof CanvasRenderingContext2D < `u`) || !(e instanceof CanvasRenderingContext2D)) && (!(typeof OffscreenCanvasRenderingContext2D < `u`) || !(e instanceof OffscreenCanvasRenderingContext2D))) {
      throw TypeError(`context must be a CanvasRenderingContext2D or OffscreenCanvasRenderingContext2D.`);
    }
    if (!t || typeof t != `object`) {
      throw TypeError(`options must be an object.`);
    }
    if (![`fill`, `contain`, `cover`].includes(t.fit)) {
      throw TypeError(`options.fit must be 'fill', 'contain', or 'cover'.`);
    }
    if (t.rotation !== undefined && ![0, 90, 180, 270].includes(t.rotation)) {
      throw TypeError(`options.rotation, when provided, must be 0, 90, 180, or 270.`);
    }
    if (t.crop !== undefined) {
      As(t.crop, `options.`);
    }
    let n = e.canvas.width;
    let r = e.canvas.height;
    let i = t.rotation ?? this.rotation;
    let [a, o] = i % 180 == 0 ? [this.squarePixelWidth, this.squarePixelHeight] : [this.squarePixelHeight, this.squarePixelWidth];
    let s = t.crop;
    s &&= ks(s, a, o);
    let c;
    let l;
    let u;
    let d;
    let {
      sx: f,
      sy: p,
      sWidth: m,
      sHeight: h
    } = this._rotateSourceRegion(t.crop?.left ?? 0, t.crop?.top ?? 0, t.crop?.width ?? a, t.crop?.height ?? o, i);
    if (t.fit === `fill`) {
      c = 0;
      l = 0;
      u = n;
      d = r;
    } else {
      let [e, i] = t.crop ? [t.crop.width, t.crop.height] : [a, o];
      let s = t.fit === `contain` ? Math.min(n / e, r / i) : Math.max(n / e, r / i);
      u = e * s;
      d = i * s;
      c = (n - u) / 2;
      l = (r - d) / 2;
    }
    e.save();
    let g = i % 180 == 0 ? 1 : u / d;
    e.translate(n / 2, r / 2);
    e.rotate(i * Math.PI / 180);
    e.scale(1 / g, g);
    e.translate(-n / 2, -r / 2);
    e.drawImage(this.toCanvasImageSource(), f, p, m, h, c, l, u, d);
    e.restore();
  }
  _rotateSourceRegion(e, t, n, r, i) {
    if (i === 90) {
      [e, t, n, r] = [t, this.squarePixelHeight - e - n, r, n];
    } else if (i === 180) {
      [e, t] = [this.squarePixelWidth - e - n, this.squarePixelHeight - t - r];
    } else if (i === 270) {
      [e, t, n, r] = [this.squarePixelWidth - t - r, e, r, n];
    }
    return {
      sx: e,
      sy: t,
      sWidth: n,
      sHeight: r
    };
  }
  toCanvasImageSource() {
    if (this._closed) {
      throw Error(`VideoSample is closed.`);
    }
    _shared.n(this._data !== null);
    if (this._data instanceof vs || this._data instanceof Uint8Array) {
      let e = this.toVideoFrame();
      queueMicrotask(() => {
        return e.close();
      });
      return e;
    } else {
      return this._data;
    }
  }
  async transform(t) {
    if (!t || typeof t != `object`) {
      throw TypeError(`options must be an object.`);
    }
    if (t.width !== undefined && (!Number.isInteger(t.width) || t.width <= 0)) {
      throw TypeError(`options.width, when provided, must be a positive integer.`);
    }
    if (t.height !== undefined && (!Number.isInteger(t.height) || t.height <= 0)) {
      throw TypeError(`options.height, when provided, must be a positive integer.`);
    }
    if (t.roundDimensionsTo !== undefined && (!Number.isInteger(t.roundDimensionsTo) || t.roundDimensionsTo <= 0)) {
      throw TypeError(`options.roundDimensionsTo, when provided, must be a positive integer.`);
    }
    if (t.fit !== undefined && ![`fill`, `contain`, `cover`].includes(t.fit)) {
      throw TypeError(`options.fit, when provided, must be one of "fill", "contain", or "cover".`);
    }
    if (t.width !== undefined && t.height !== undefined && t.fit === undefined) {
      throw TypeError(`When both options.width and options.height are provided, options.fit must also be provided.`);
    }
    if (t.rotate !== undefined && ![0, 90, 180, 270].includes(t.rotate)) {
      throw TypeError(`options.rotate, when provided, must be 0, 90, 180 or 270.`);
    }
    if (t.crop !== undefined) {
      As(t.crop, `options.`);
    }
    if (t.alpha !== undefined && ![`keep`, `discard`].includes(t.alpha)) {
      throw TypeError(`options.alpha, when provided, must be 'keep' or 'discard'.`);
    }
    let n = _shared.r(this.rotation + (t.rotate ?? 0));
    let [i, a] = n % 180 == 0 ? [this.squarePixelWidth, this.squarePixelHeight] : [this.squarePixelHeight, this.squarePixelWidth];
    let o = t.crop;
    o &&= ks(o, i, a);
    let s = o ? o.width : i;
    let c = o ? o.height : a;
    let l = s / c;
    let u;
    let d;
    if (t.width !== undefined && t.height === undefined) {
      u = t.width;
      d = u / l;
    } else if (t.width === undefined && t.height !== undefined) {
      d = t.height;
      u = d * l;
    } else if (t.width !== undefined && t.height !== undefined) {
      u = t.width;
      d = t.height;
    } else {
      u = s;
      d = c;
    }
    u = _e(u, t.roundDimensionsTo ?? 1);
    d = _e(d, t.roundDimensionsTo ?? 1);
    let f = {
      width: u,
      height: d,
      fit: t.fit ?? `fill`,
      rotation: n,
      crop: o ?? {
        left: 0,
        top: 0,
        width: i,
        height: a
      },
      alpha: t.alpha ?? `keep`
    };
    for (let e of Ss) {
      let t = e(this, f);
      if (t instanceof Promise) {
        t = await t;
      }
      if (t !== null) {
        return t;
      }
    }
    let p = null;
    let m = false;
    for (let e of Ts) {
      if (e.canvas.width === f.width && e.canvas.height === f.height) {
        p = e.canvas;
        e.age = _shared.Es++;
        break;
      }
    }
    if (p === null) {
      if (typeof OffscreenCanvas < `u`) {
        p = new OffscreenCanvas(f.width, f.height);
      } else {
        if (typeof window > `u` || typeof document > `u`) {
          throw Error(`Cannot transform VideoSamples in this environment. Either run in an environment with OffscreenCanvas or HTMLCanvasElement, or supply a custom VideoSample transformer using registerVideoSampleTransformer().`);
        }
        p = document.createElement(`canvas`);
        p.width = f.width;
        p.height = f.height;
      }
      m = true;
      if (Ts.length >= ws) {
        Ts.splice(Ye(Ts, e => {
          return e.age;
        }), 1);
      }
      Ts.push({
        canvas: p,
        age: _shared.Es++
      });
    }
    let h = p.getContext(`2d`, {
      alpha: true
    });
    if (!h) {
      throw Error(`The '2d' canvas context is required to transform VideoSamples. Register a custom transformer using registerVideoSampleTransformer to work around this limitation.`);
    }
    if (f.alpha === `discard`) {
      h.fillStyle = `black`;
      h.fillRect(0, 0, f.width, f.height);
    } else if (!m) {
      h.clearRect(0, 0, f.width, f.height);
    }
    this.drawWithFit(h, {
      fit: f.fit,
      rotation: f.rotation,
      crop: f.crop
    });
    return new e(p, {
      timestamp: this.timestamp,
      duration: this.duration,
      rotation: 0
    });
  }
  setRotation(e) {
    if (![0, 90, 180, 270].includes(e)) {
      throw TypeError(`newRotation must be 0, 90, 180, or 270.`);
    }
    this.rotation = e;
  }
  setTimestamp(e) {
    if (!Number.isFinite(e)) {
      throw TypeError(`newTimestamp must be a number.`);
    }
    this.timestamp = e;
  }
  setDuration(e) {
    if (!Number.isFinite(e) || e < 0) {
      throw TypeError(`newDuration must be a non-negative number.`);
    }
    this.duration = e;
  }
  setEncodeOptions(e) {
    if (!e || typeof e != `object`) {
      throw TypeError(`newEncodeOptions must be an object.`);
    }
    this.encodeOptions = e;
  }
  [Symbol.dispose]() {
    this.close();
  }
};
export default xs;