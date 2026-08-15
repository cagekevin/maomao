// TODO(全局, 无需 import): errorPromise, paused, constructor, TypeError, latencyMode, _start, timestamp, duration, type, trackId, track, write, signal, DOMException, once, pause, resume, _flushAndClose
import _cmp_xs from "./xs.jsx";
import { Df, Zs, n, E, Af, k, u, ot, c, Yf, l, Jf, Gf, st } from "./shared.js";
import * as _shared from "./shared.js";
var If = class extends Df {
  get errorPromise() {
    this._errorPromiseAccessed = true;
    return this._promiseWithResolvers.promise;
  }
  get paused() {
    return this._paused;
  }
  constructor(e, t, n = {}) {
    if (!(e instanceof MediaStreamTrack) || e.kind !== `video`) {
      throw TypeError(`track must be a video MediaStreamTrack.`);
    }
    Zs(t);
    if (typeof n != `object` || !n) {
      throw TypeError(`options must be an object.`);
    }
    if (n.frameRate != null && (typeof n.frameRate != `number` || n.frameRate <= 0)) {
      throw TypeError(`options.frameRate, when provided, must be either a positive number or null.`);
    }
    if (n.timestampBase !== undefined && n.timestampBase !== `synced-zero` && n.timestampBase !== `zero` && n.timestampBase !== `unix`) {
      throw TypeError(`options.timestampBase, when provided, must be one of 'synced-zero', 'zero', or 'unix'.`);
    }
    t = {
      ...t,
      latencyMode: `realtime`
    };
    super(t.codec);
    this._abortController = null;
    this._workerTrackId = null;
    this._workerListener = null;
    this._promiseWithResolvers = E();
    this._errorPromiseAccessed = false;
    this._paused = false;
    this._lastVideoFrame = null;
    this._timerHandle = null;
    this._videoElement = null;
    this._options = n;
    this._encoder = new Af(this, t);
    this._track = e;
  }
  async _start() {
    if (!this._errorPromiseAccessed) {
      k._warn('Make sure not to ignore the `errorPromise` field on MediaStreamVideoTrackSource, so that any internal errors get bubbled up properly.');
    }
    let e = this._options.frameRate === undefined ? this._track.getSettings().frameRate ?? null : this._options.frameRate;
    this._abortController = new AbortController();
    let t = null;
    let r = null;
    let i = 0;
    let a = false;
    let o = null;
    let s = 0;
    let c = () => {
      n(e !== null);
      if (!this._lastVideoFrame) {
        return;
      }
      n(r !== null);
      n(t !== null);
      let a = performance.now();
      while (a - r > 1000 / e) {
        r += 1000 / e;
        let n = t + i / e;
        u(new VideoFrame(this._videoElement ?? this._lastVideoFrame, {
          timestamp: n * 1000000,
          duration: 1000000 / e
        }), a);
      }
    };
    if (e !== null) {
      this._timerHandle = ot(c, 4);
    }
    let l = t => {
      if (e === null) {
        u(t);
      } else {
        let e = performance.now();
        if (this._lastVideoFrame) {
          c();
          this._lastVideoFrame?.close();
          this._lastVideoFrame = t;
        } else {
          u(t.clone(), e);
          r = e;
          this._lastVideoFrame = t;
        }
      }
    };
    let u = (e, n = performance.now()) => {
      if (a) {
        e.close();
        return;
      }
      i++;
      let r = e.timestamp / 1000000;
      if (this._paused) {
        if (t !== null) {
          if (o !== null && this._options.timestampBase !== `unix`) {
            let e = r - o;
            s -= e;
          }
          o = r;
        }
        e.close();
        return;
      }
      if (t === null) {
        t = r;
        let e;
        let i = this._options.timestampBase ?? `synced-zero`;
        if (i === `unix`) {
          e = Date.now() / 1000;
        } else if (i === `zero`) {
          e = 0;
        } else {
          let t = this._connectedTrack.output;
          if (t._firstMediaStreamTimestamp === null) {
            t._firstMediaStreamTimestamp = n / 1000;
            e = 0;
          } else {
            e = n / 1000 - t._firstMediaStreamTimestamp;
          }
        }
        s = e - t;
      }
      o = r;
      if (this._encoder.getQueueSize() >= 8) {
        e.close();
        return;
      }
      let c = new _cmp_xs(e, {
        timestamp: r + s
      });
      this._encoder.add(c, true).catch(e => {
        a = true;
        this._abortController?.abort();
        this._promiseWithResolvers.reject(e);
        if (this._workerTrackId !== null) {
          Yf({
            type: `stopTrack`,
            trackId: this._workerTrackId
          });
        }
      });
    };
    if (typeof MediaStreamTrackProcessor < `u`) {
      let e = new MediaStreamTrackProcessor({
        track: this._track
      });
      let t = new WritableStream({
        write: l
      });
      e.readable.pipeTo(t, {
        signal: this._abortController.signal
      }).catch(e => {
        if (!(e instanceof DOMException) || e.name !== `AbortError`) {
          this._promiseWithResolvers.reject(e);
        }
      });
    } else if (await Jf()) {
      this._workerTrackId = _shared.Wf++;
      Yf({
        type: `videoTrack`,
        trackId: this._workerTrackId,
        track: this._track
      });
      this._workerListener = e => {
        let t = e.data;
        if (t.type === `videoFrame` && t.trackId === this._workerTrackId) {
          l(t.videoFrame);
        } else if (t.type === `error` && t.trackId === this._workerTrackId) {
          this._promiseWithResolvers.reject(t.error);
        }
      };
      Gf.addEventListener(`message`, this._workerListener);
    } else if (e !== null) {
      let e = document.createElement(`video`);
      e.style.position = `fixed`;
      e.style.left = `-10000px`;
      e.style.top = `-10000px`;
      e.style.width = `1px`;
      e.style.height = `1px`;
      e.style.opacity = `0`;
      e.style.pointerEvents = `none`;
      e.muted = true;
      e.srcObject = new MediaStream([this._track]);
      document.body.appendChild(e);
      this._videoElement = e;
      e.addEventListener(`loadeddata`, () => {
        if (a || !this._videoElement) {
          return;
        }
        let t = new VideoFrame(e, {
          timestamp: performance.now() * 1000
        });
        l(t);
        t.close();
      }, {
        once: true
      });
      e.play().catch(e => {
        a = true;
        this._promiseWithResolvers.reject(e);
      });
    } else {
      throw Error(`When no explicit frame rate is set, MediaStreamTrackProcessor is required; but it's not supported by this browser.`);
    }
  }
  pause() {
    this._paused = true;
  }
  resume() {
    this._paused = false;
  }
  async _flushAndClose(e) {
    this._abortController.abort();
    this._abortController &&= null;
    if (this._timerHandle) {
      st(this._timerHandle);
    }
    this._lastVideoFrame?.close();
    this._videoElement.srcObject = null;
    this._videoElement.remove();
    this._videoElement &&= null;
    if (this._workerTrackId !== null) {
      n(this._workerListener);
      Yf({
        type: `stopTrack`,
        trackId: this._workerTrackId
      });
      await new Promise(e => {
        let t = r => {
          let i = r.data;
          if (i.type === `trackStopped` && i.trackId === this._workerTrackId) {
            n(this._workerListener);
            Gf.removeEventListener(`message`, this._workerListener);
            Gf.removeEventListener(`message`, t);
            e();
          }
        };
        Gf.addEventListener(`message`, t);
      });
    }
    await this._encoder.flushAndClose(e);
  }
};
export default If;