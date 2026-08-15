import _cmp_xs from "./xs.jsx";
import { i as e, t } from '../rolldown-runtime-aKtaBQYM.js';
function n(e) {
  if (!e) {
    throw Error(`Assertion failed.`);
  }
}
var r = e => {
  let t = (e % 360 + 360) % 360;
  if (t === 0 || t === 90 || t === 180 || t === 270) {
    return t;
  }
  throw Error(`Invalid rotation ${e}.`);
};
var i = e => {
  return e && e[e.length - 1];
};
var a = e => {
  return e >= 0 && e < 4294967296;
};
var o = e => {
  let t = 0;
  while (e.readBits(1) === 0 && t < 32) {
    t++;
  }
  if (t >= 32) {
    throw Error(`Invalid exponential-Golomb code.`);
  }
  return (1 << t) - 1 + e.readBits(t);
};
var s = e => {
  let t = o(e);
  if (t & 1) {
    return t + 1 >> 1;
  } else {
    return -(t >> 1);
  }
};
var c = (e, t, n, r) => {
  for (let i = t; i < n; i++) {
    let t = Math.floor(i / 8);
    let a = e[t];
    let o = 7 - (i & 7);
    a &= ~(1 << o);
    a |= (r & 1 << n - i - 1) >> n - i - 1 << o;
    e[t] = a;
  }
};
var l = e => {
  if (e.constructor === Uint8Array) {
    return e;
  } else {
    if (ArrayBuffer.isView(e)) {
      return new Uint8Array(e.buffer, e.byteOffset, e.byteLength);
    } else {
      return new Uint8Array(e);
    }
  }
};
var u = e => {
  if (e.constructor === DataView) {
    return e;
  } else {
    if (ArrayBuffer.isView(e)) {
      return new DataView(e.buffer, e.byteOffset, e.byteLength);
    } else {
      return new DataView(e);
    }
  }
};
var d = new TextDecoder();
var f = new TextEncoder();
var p = e => {
  for (let t = 0; t < e.length; t++) {
    if (e.charCodeAt(t) > 255) {
      return false;
    }
  }
  return true;
};
var m = e => {
  return Object.fromEntries(Object.entries(e).map(([e, t]) => {
    return [t, e];
  }));
};
var h = {
  bt709: 1,
  bt470bg: 5,
  smpte170m: 6,
  bt2020: 9,
  smpte432: 12
};
var g = m(h);
var _ = {
  bt709: 1,
  smpte170m: 6,
  linear: 8,
  'iec61966-2-1': 13,
  pq: 16,
  hlg: 18
};
var v = m(_);
var y = {
  rgb: 0,
  bt709: 1,
  bt470bg: 5,
  smpte170m: 6,
  'bt2020-ncl': 9
};
var b = m(y);
var x = e => {
  return !!e && !!e.primaries && !!e.transfer && !!e.matrix && e.fullRange !== undefined;
};
var S = e => {
  return e instanceof ArrayBuffer || typeof SharedArrayBuffer < `u` && e instanceof SharedArrayBuffer || ArrayBuffer.isView(e);
};
var C = class {
  constructor() {
    this.currentPromise = Promise.resolve();
    this.pending = 0;
  }
  async acquire() {
    let e;
    let t = new Promise(t => {
      let n = false;
      e = () => {
        t();
        this.pending--;
        n ||= true;
      };
    });
    let n = this.currentPromise;
    this.currentPromise = t;
    this.pending++;
    await n;
    return e;
  }
};
var ee = /^[0-9a-fA-F]+$/;
var w = e => {
  return [...e].map(e => {
    return e.toString(16).padStart(2, `0`);
  }).join(``);
};
var te = e => {
  n(e.length % 2 == 0);
  let t = new Uint8Array(e.length / 2);
  for (let n = 0; n < e.length; n += 2) {
    t[n / 2] = parseInt(e.slice(n, n + 2), 16);
  }
  return t;
};
var ne = e => {
  e = e >> 1 & 1431655765 | (e & 1431655765) << 1;
  e = e >> 2 & 858993459 | (e & 858993459) << 2;
  e = e >> 4 & 252645135 | (e & 252645135) << 4;
  e = e >> 8 & 16711935 | (e & 16711935) << 8;
  e = e >> 16 & 65535 | (e & 65535) << 16;
  return e >>> 0;
};
var re = (e, t, n) => {
  let r = 0;
  let i = e.length - 1;
  let a = -1;
  while (r <= i) {
    let o = r + i >> 1;
    let s = n(e[o]);
    if (s === t) {
      a = o;
      i = o - 1;
    } else if (s < t) {
      r = o + 1;
    } else {
      i = o - 1;
    }
  }
  return a;
};
var T = (e, t, n) => {
  let r = 0;
  let i = e.length - 1;
  let a = -1;
  while (r <= i) {
    let o = r + (i - r + 1) / 2 | 0;
    if (n(e[o]) <= t) {
      a = o;
      r = o + 1;
    } else {
      i = o - 1;
    }
  }
  return a;
};
var ie = (e, t, n) => {
  let r = T(e, n(t), n);
  e.splice(r + 1, 0, t);
};
var E = () => {
  let e;
  let t;
  return {
    promise: new Promise((n, r) => {
      e = n;
      t = r;
    }),
    resolve: e,
    reject: t
  };
};
var ae = (e, t) => {
  let n = e.indexOf(t);
  if (n !== -1) {
    e.splice(n, 1);
  }
};
var oe = (e, t) => {
  for (let n = e.length - 1; n >= 0; n--) {
    if (t(e[n])) {
      return e[n];
    }
  }
};
var se = (e, t) => {
  for (let n = e.length - 1; n >= 0; n--) {
    if (t(e[n])) {
      return n;
    }
  }
  return -1;
};
async function* ce(e) {
  if (Symbol.iterator in e) {
    yield* e[Symbol.iterator]();
  } else {
    yield* e[Symbol.asyncIterator]();
  }
}
var le = e => {
  if (!(Symbol.iterator in e) && !(Symbol.asyncIterator in e)) {
    throw TypeError(`Argument must be an iterable or async iterable.`);
  }
};
var D = e => {
  throw Error(`Unexpected value: ${e}`);
};
var ue = (e, t, n) => {
  let r = e.getUint8(t);
  let i = e.getUint8(t + 1);
  let a = e.getUint8(t + 2);
  if (n) {
    return r | i << 8 | a << 16;
  } else {
    return r << 16 | i << 8 | a;
  }
};
var de = (e, t, n) => {
  return ue(e, t, n) << 8 >> 8;
};
var fe = (e, t, n, r) => {
  n >>>= 0;
  n &= 16777215;
  if (r) {
    e.setUint8(t, n & 255);
    e.setUint8(t + 1, n >>> 8 & 255);
    e.setUint8(t + 2, n >>> 16 & 255);
  } else {
    e.setUint8(t, n >>> 16 & 255);
    e.setUint8(t + 1, n >>> 8 & 255);
    e.setUint8(t + 2, n & 255);
  }
};
var pe = (e, t, n, r) => {
  n = O(n, -8388608, 8388607);
  if (n < 0) {
    n = n + 16777216 & 16777215;
  }
  fe(e, t, n, r);
};
var me = (e, t, n, r) => {
  if (r) {
    e.setUint32(t + 0, n, true);
    e.setInt32(t + 4, Math.floor(n / 4294967296), true);
  } else {
    e.setInt32(t + 0, Math.floor(n / 4294967296), true);
    e.setUint32(t + 4, n, true);
  }
};
var he = (e, t) => {
  return {
    async next() {
      let n = await e.next();
      if (n.done) {
        return {
          value: undefined,
          done: true
        };
      } else {
        return {
          value: t(n.value),
          done: false
        };
      }
    },
    return() {
      return e.return();
    },
    throw(t) {
      return e.throw(t);
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
};
var O = (e, t, n) => {
  return Math.max(t, Math.min(n, e));
};
var ge = e => {
  let t = Math.round(e);
  if (Math.abs(e / t - 1) < 2.220446049250313e-15) {
    return t;
  } else {
    return e;
  }
};
var _e = (e, t) => {
  return Math.round(e / t) * t;
};
var ve = (e, t) => {
  return Math.round(e * t) / t;
};
var ye = (e, t) => {
  return Math.floor(e / t) * t;
};
var be = (e, t) => {
  return Math.floor(e * t) / t;
};
var xe = e => {
  let t = 0;
  while (e) {
    t++;
    e >>= 1;
  }
  return t;
};
var Se = /^[a-z]{3}$/;
var Ce = e => {
  return Se.test(e);
};
var we = 1000000.0000000002;
var Te = (e, t) => {
  let n = {
    ...e,
    ...t
  };
  if (e.headers || t.headers) {
    let r = e.headers ? Ee(e.headers) : {};
    let i = t.headers ? Ee(t.headers) : {};
    let a = {
      ...r
    };
    Object.entries(i).forEach(([e, t]) => {
      let n = Object.keys(a).find(t => {
        return t.toLowerCase() === e.toLowerCase();
      });
      if (n) {
        delete a[n];
      }
      a[e] = t;
    });
    n.headers = a;
  }
  return n;
};
var Ee = e => {
  if (e instanceof Headers) {
    let t = {};
    e.forEach((e, n) => {
      t[n] = e;
    });
    return t;
  }
  if (Array.isArray(e)) {
    let t = {};
    e.forEach(([e, n]) => {
      t[e] = n;
    });
    return t;
  }
  return e;
};
var De = async (e, t, n, r, i) => {
  let a = 0;
  while (true) {
    try {
      return await e(t, n);
    } catch (e) {
      if (i()) {
        throw e;
      }
      a++;
      let n = r(a, e, t);
      if (n === null) {
        throw e;
      }
      k._error(`Retrying failed fetch. Error:`, e);
      if (!Number.isFinite(n) || n < 0) {
        throw TypeError(`Retry delay must be a non-negative finite number.`);
      }
      if (n > 0) {
        await ct(n * 1000);
      }
      if (i()) {
        throw e;
      }
    }
  }
};
var Oe = (e, t) => {
  let n = e < 0 ? -1 : 1;
  e = Math.abs(e);
  let r = 0;
  let i = 1;
  let a = 1;
  let o = 0;
  let s = e;
  while (true) {
    let e = Math.floor(s);
    let c = e * a + r;
    let l = e * o + i;
    if (l > t) {
      return {
        num: n * a,
        den: o
      };
    }
    r = a;
    i = o;
    a = c;
    o = l;
    s = 1 / (s - e);
    if (!isFinite(s)) {
      break;
    }
  }
  return {
    num: n * a,
    den: o
  };
};
var ke = class {
  constructor() {
    this.currentPromise = Promise.resolve();
  }
  call(e) {
    return this.currentPromise = this.currentPromise.then(e);
  }
};
var Ae = null;
var je = () => {
  if (Ae === null) {
    return Ae = !!(typeof navigator < `u`) && (!!navigator.vendor?.match(/apple/i) || !!/AppleWebKit/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent) || !!/\b(iPad|iPhone|iPod)\b/.test(navigator.userAgent));
  } else {
    return Ae;
  }
};
var Me = null;
var Ne = () => {
  if (Me === null) {
    return Me = typeof navigator < `u` && navigator.userAgent?.includes(`Firefox`);
  } else {
    return Me;
  }
};
var Pe = null;
var Fe = () => {
  if (Pe === null) {
    return Pe = !!(typeof navigator < `u`) && (!!navigator.vendor?.includes(`Google Inc`) || !!/Chrome/.test(navigator.userAgent));
  } else {
    return Pe;
  }
};
var Ie = null;
var Le = () => {
  if (Ie !== null) {
    return Ie;
  }
  if (typeof navigator > `u`) {
    return null;
  }
  let e = /\bChrome\/(\d+)/.exec(navigator.userAgent);
  if (e) {
    return Ie = Number(e[1]);
  } else {
    return null;
  }
};
var Re = (e, t) => {
  if (e === -1) {
    return t;
  } else {
    return e;
  }
};
var ze = (e, t, n, r) => {
  return e <= r && n <= t;
};
function* Be(e) {
  for (let t in e) {
    let n = e[t];
    if (n !== undefined) {
      yield {
        key: t,
        value: n
      };
    }
  }
}
var Ve = e => {
  switch (e.toLowerCase()) {
    case `image/jpeg`:
    case `image/jpg`:
      {
        return `.jpg`;
      }
    case `image/png`:
      {
        return `.png`;
      }
    case `image/gif`:
      {
        return `.gif`;
      }
    case `image/webp`:
      {
        return `.webp`;
      }
    case `image/bmp`:
      {
        return `.bmp`;
      }
    case `image/svg+xml`:
      {
        return `.svg`;
      }
    case `image/tiff`:
      {
        return `.tiff`;
      }
    case `image/avif`:
      {
        return `.avif`;
      }
    case `image/x-icon`:
    case `image/vnd.microsoft.icon`:
      {
        return `.ico`;
      }
    default:
      {
        return null;
      }
  }
};
var He = e => {
  let t = atob(e);
  let n = new Uint8Array(t.length);
  for (let e = 0; e < t.length; e++) {
    n[e] = t.charCodeAt(e);
  }
  return n;
};
var Ue = e => {
  let t = ``;
  for (let n = 0; n < e.length; n++) {
    t += String.fromCharCode(e[n]);
  }
  return btoa(t);
};
var We = (e, t) => {
  if (e.length !== t.length) {
    return false;
  }
  for (let n = 0; n < e.length; n++) {
    if (e[n] !== t[n]) {
      return false;
    }
  }
  return true;
};
var Ge = () => {
  Symbol.dispose ??= Symbol(`Symbol.dispose`);
};
var Ke = e => {
  return typeof e == `number` && !Number.isNaN(e);
};
var qe = (e, t) => {
  if (t.includes(`://`)) {
    return t;
  }
  if (e.includes(`://`)) {
    let t = e.indexOf(`?`);
    if (t !== -1) {
      e = e.slice(0, t);
    }
  }
  let n;
  if (t.startsWith(`/`)) {
    let r = e.indexOf(`://`);
    if (r === -1) {
      n = t;
    } else {
      let i = e.indexOf(`/`, r + 3);
      if (i === -1) {
        n = e + t;
      } else {
        n = e.slice(0, i) + t;
      }
    }
  } else {
    let r = e.lastIndexOf(`/`);
    if (r === -1) {
      n = t;
    } else {
      n = e.slice(0, r + 1) + t;
    }
  }
  let r = ``;
  let i = n.indexOf(`://`);
  if (i !== -1) {
    let e = n.indexOf(`/`, i + 3);
    if (e !== -1) {
      r = n.slice(0, e);
      n = n.slice(e);
    }
  }
  let a = n.split(`/`);
  let o = [];
  for (let e of a) {
    if (e === `..`) {
      o.pop();
    } else if (e !== `.`) {
      o.push(e);
    }
  }
  return r + o.join(`/`);
};
var Je = (e, t) => {
  let n = 0;
  for (let r = 0; r < e.length; r++) {
    if (t(e[r])) {
      n++;
    }
  }
  return n;
};
var Ye = (e, t) => {
  let n = -1;
  let r = Infinity;
  for (let i = 0; i < e.length; i++) {
    let a = t(e[i]);
    if (a < r) {
      r = a;
      n = i;
    }
  }
  return n;
};
var Xe = (e, t) => {
  let n = -1;
  let r = -Infinity;
  for (let i = 0; i < e.length; i++) {
    let a = t(e[i]);
    if (a > r) {
      r = a;
      n = i;
    }
  }
  return n;
};
var Ze = e => {
  n(Number.isInteger(e.num));
  n(Number.isInteger(e.den));
  n(e.den !== 0);
  let t = Math.abs(e.num);
  let r = Math.abs(e.den);
  while (r !== 0) {
    let e = t % r;
    t = r;
    r = e;
  }
  let i = t || 1;
  return {
    num: e.num / i,
    den: e.den / i
  };
};
var Qe = (e, t) => {
  if (typeof e != `object` || !e) {
    throw TypeError(`${t} must be an object.`);
  }
  if (!Number.isInteger(e.left) || e.left < 0) {
    throw TypeError(`${t}.left must be a non-negative integer.`);
  }
  if (!Number.isInteger(e.top) || e.top < 0) {
    throw TypeError(`${t}.top must be a non-negative integer.`);
  }
  if (!Number.isInteger(e.width) || e.width < 0) {
    throw TypeError(`${t}.width must be a non-negative integer.`);
  }
  if (!Number.isInteger(e.height) || e.height < 0) {
    throw TypeError(`${t}.height must be a non-negative integer.`);
  }
};
var $e;
var et = 1;
var tt = new Map();
var nt = new Map();
var rt = () => {
  return typeof window > `u`;
};
var it = () => {
  let e = new Map();
  let t = new Map();
  self.onmessage = n => {
    let r = n.data;
    switch (r.type) {
      case `set-timeout`:
        {
          let t = setTimeout(() => {
            e.delete(r.timerId);
            self.postMessage({
              type: `fire`,
              timerId: r.timerId
            });
          }, r.delay);
          e.set(r.timerId, t);
        }
        break;
      case `set-interval`:
        {
          let e = setInterval(() => {
            self.postMessage({
              type: `fire`,
              timerId: r.timerId
            });
          }, r.delay);
          t.set(r.timerId, e);
        }
        break;
      case `clear-timeout`:
        {
          let t = e.get(r.timerId);
          if (t !== undefined) {
            clearTimeout(t);
            e.delete(r.timerId);
          }
        }
        break;
      case `clear-interval`:
        {
          let e = t.get(r.timerId);
          if (e !== undefined) {
            clearInterval(e);
            t.delete(r.timerId);
          }
        }
        break;
    }
  };
};
var at = () => {
  if ($e) {
    return $e;
  }
  let e = `(${it.toString()})();`;
  let t = URL.createObjectURL(new Blob([e], {
    type: `text/javascript`
  }));
  $e = new Worker(t);
  URL.revokeObjectURL(t);
  $e.onmessage = e => {
    let t = e.data;
    let n = tt.get(t.timerId);
    if (n) {
      tt.delete(t.timerId);
      n();
      return;
    }
    let r = nt.get(t.timerId);
    if (r) {
      r();
    }
  };
  return $e;
};
var ot = (e, t) => {
  if (rt()) {
    return {
      id: setInterval(e, t)
    };
  }
  let n = et++;
  nt.set(n, () => {
    e();
  });
  at().postMessage({
    type: `set-interval`,
    timerId: n,
    delay: t
  });
  return {
    id: n
  };
};
var st = e => {
  if (rt()) {
    clearInterval(e.id);
    return;
  }
  n(typeof e.id == `number`);
  nt.delete(e.id);
  at().postMessage({
    type: `clear-interval`,
    timerId: e.id
  });
};
var ct = e => {
  return new Promise(t => {
    return setTimeout(t, e);
  });
};
var lt = e => {
  if (Array.isArray(e)) {
    return e;
  } else {
    return [e];
  }
};
var ut = class {
  constructor() {
    this._listeners = new Map();
  }
  on(e, t, n) {
    if (!this._listeners.has(e)) {
      this._listeners.set(e, new Set());
    }
    let r = {
      fn: t,
      once: n?.once ?? false
    };
    this._listeners.get(e).add(r);
    return () => {
      this._listeners.get(e)?.delete(r);
    };
  }
  _emit(...e) {
    let [t, n] = e;
    let r = this._listeners.get(t);
    if (r) {
      for (let e of r) {
        try {
          e.fn(n);
        } catch (e) {
          console.error(e);
        }
        if (e.once) {
          r.delete(e);
        }
      }
    }
  }
};
var dt = e => {
  return Math.ceil(e / 2) * 2;
};
var ft = class {
  constructor(e) {
    this._queue = [];
    this._errored = false;
    this.parallelism = e;
  }
  get errored() {
    return this._errored;
  }
  get inFlightCount() {
    return this._queue.length;
  }
  async run(e) {
    for (this._errored && (await Promise.race(this._queue)); this._queue.length >= this.parallelism;) {
      await Promise.race(this._queue);
    }
    let t = e();
    this._queue.push(t);
    t.then(() => {
      return ae(this._queue, t);
    }).catch(() => {
      return this._errored = true;
    });
  }
  async flush() {
    await Promise.all(this._queue);
  }
};
var pt = e => {
  return typeof e == `object` && !!e && Object.getPrototypeOf(e) === Object.prototype && Object.values(e).every(e => {
    return typeof e == `string`;
  });
};
var mt;
(function (e) {
  e[e.Silent = 0] = `Silent`;
  e[e.Errors = 1] = `Errors`;
  e[e.Warnings = 2] = `Warnings`;
  e[e.Info = 3] = `Info`;
})(mt ||= {});
var k = class e {
  constructor() {}
  static get level() {
    return e._level;
  }
  static set level(t) {
    if (t !== mt.Silent && t !== mt.Errors && t !== mt.Warnings && t !== mt.Info) {
      throw TypeError(`Invalid log level. Use one of the values of the LogLevel enum.`);
    }
    e._level = t;
  }
  static get _emitter() {
    return e._emitterInstance ??= new ut();
  }
  static on(t, n, r) {
    return e._emitter.on(t, n, r);
  }
  static _error(...t) {
    e._emitter._emit(`error`, t);
    if (e._level >= mt.Errors) {
      console.error(...t);
    }
  }
  static _warn(...t) {
    e._emitter._emit(`warn`, t);
    if (e._level >= mt.Warnings) {
      console.warn(...t);
    }
  }
  static _info(...t) {
    e._emitter._emit(`info`, t);
    if (e._level >= mt.Info) {
      console.info(...t);
    }
  }
};
k._level = mt.Info;
k._emitterInstance = null;
var ht = class {
  constructor(e, t) {
    this.data = e;
    this.mimeType = t;
    if (!(e instanceof Uint8Array)) {
      throw TypeError(`data must be a Uint8Array.`);
    }
    if (typeof t != `string`) {
      throw TypeError(`mimeType must be a string.`);
    }
  }
};
var gt = class {
  constructor(e, t, n, r) {
    this.data = e;
    this.mimeType = t;
    this.name = n;
    this.description = r;
    if (!(e instanceof Uint8Array)) {
      throw TypeError(`data must be a Uint8Array.`);
    }
    if (t !== undefined && typeof t != `string`) {
      throw TypeError(`mimeType, when provided, must be a string.`);
    }
    if (n !== undefined && typeof n != `string`) {
      throw TypeError(`name, when provided, must be a string.`);
    }
    if (r !== undefined && typeof r != `string`) {
      throw TypeError(`description, when provided, must be a string.`);
    }
  }
};
var _t = e => {
  if (!e || typeof e != `object`) {
    throw TypeError(`tags must be an object.`);
  }
  if (e.title !== undefined && typeof e.title != `string`) {
    throw TypeError(`tags.title, when provided, must be a string.`);
  }
  if (e.description !== undefined && typeof e.description != `string`) {
    throw TypeError(`tags.description, when provided, must be a string.`);
  }
  if (e.artist !== undefined && typeof e.artist != `string`) {
    throw TypeError(`tags.artist, when provided, must be a string.`);
  }
  if (e.album !== undefined && typeof e.album != `string`) {
    throw TypeError(`tags.album, when provided, must be a string.`);
  }
  if (e.albumArtist !== undefined && typeof e.albumArtist != `string`) {
    throw TypeError(`tags.albumArtist, when provided, must be a string.`);
  }
  if (e.trackNumber !== undefined && (!Number.isInteger(e.trackNumber) || e.trackNumber <= 0)) {
    throw TypeError(`tags.trackNumber, when provided, must be a positive integer.`);
  }
  if (e.tracksTotal !== undefined && (!Number.isInteger(e.tracksTotal) || e.tracksTotal <= 0)) {
    throw TypeError(`tags.tracksTotal, when provided, must be a positive integer.`);
  }
  if (e.discNumber !== undefined && (!Number.isInteger(e.discNumber) || e.discNumber <= 0)) {
    throw TypeError(`tags.discNumber, when provided, must be a positive integer.`);
  }
  if (e.discsTotal !== undefined && (!Number.isInteger(e.discsTotal) || e.discsTotal <= 0)) {
    throw TypeError(`tags.discsTotal, when provided, must be a positive integer.`);
  }
  if (e.genre !== undefined && typeof e.genre != `string`) {
    throw TypeError(`tags.genre, when provided, must be a string.`);
  }
  if (e.date !== undefined && (!(e.date instanceof Date) || Number.isNaN(e.date.getTime()))) {
    throw TypeError(`tags.date, when provided, must be a valid Date.`);
  }
  if (e.lyrics !== undefined && typeof e.lyrics != `string`) {
    throw TypeError(`tags.lyrics, when provided, must be a string.`);
  }
  if (e.images !== undefined) {
    if (!Array.isArray(e.images)) {
      throw TypeError(`tags.images, when provided, must be an array.`);
    }
    for (let t of e.images) {
      if (!t || typeof t != `object`) {
        throw TypeError(`Each image in tags.images must be an object.`);
      }
      if (!(t.data instanceof Uint8Array)) {
        throw TypeError(`Each image.data must be a Uint8Array.`);
      }
      if (typeof t.mimeType != `string`) {
        throw TypeError(`Each image.mimeType must be a string.`);
      }
      if (![`coverFront`, `coverBack`, `unknown`].includes(t.kind)) {
        throw TypeError(`Each image.kind must be 'coverFront', 'coverBack', or 'unknown'.`);
      }
    }
  }
  if (e.comment !== undefined && typeof e.comment != `string`) {
    throw TypeError(`tags.comment, when provided, must be a string.`);
  }
  if (e.raw !== undefined) {
    if (!e.raw || typeof e.raw != `object`) {
      throw TypeError(`tags.raw, when provided, must be an object.`);
    }
    for (let t of Object.values(e.raw)) {
      if (t !== null && typeof t != `string` && !(t instanceof Uint8Array) && !(t instanceof ht) && !(t instanceof gt) && !pt(t)) {
        throw TypeError(`Each value in tags.raw must be a string, Uint8Array, RichImageData, AttachedFile, Record<string, string>, or null.`);
      }
    }
  }
};
var vt = e => {
  return e.title === undefined && e.description === undefined && e.artist === undefined && e.album === undefined && e.albumArtist === undefined && e.trackNumber === undefined && e.tracksTotal === undefined && e.discNumber === undefined && e.discsTotal === undefined && e.genre === undefined && e.date === undefined && e.lyrics === undefined && (!e.images || e.images.length === 0) && e.comment === undefined && (e.raw === undefined || Object.keys(e.raw).length === 0);
};
var yt = {
  default: true,
  primary: true,
  forced: false,
  original: false,
  commentary: false,
  hearingImpaired: false,
  visuallyImpaired: false
};
var bt = e => {
  if (!e || typeof e != `object`) {
    throw TypeError(`disposition must be an object.`);
  }
  if (e.default !== undefined && typeof e.default != `boolean`) {
    throw TypeError(`disposition.default must be a boolean.`);
  }
  if (e.primary !== undefined && typeof e.primary != `boolean`) {
    throw TypeError(`disposition.primary must be a boolean.`);
  }
  if (e.forced !== undefined && typeof e.forced != `boolean`) {
    throw TypeError(`disposition.forced must be a boolean.`);
  }
  if (e.original !== undefined && typeof e.original != `boolean`) {
    throw TypeError(`disposition.original must be a boolean.`);
  }
  if (e.commentary !== undefined && typeof e.commentary != `boolean`) {
    throw TypeError(`disposition.commentary must be a boolean.`);
  }
  if (e.hearingImpaired !== undefined && typeof e.hearingImpaired != `boolean`) {
    throw TypeError(`disposition.hearingImpaired must be a boolean.`);
  }
  if (e.visuallyImpaired !== undefined && typeof e.visuallyImpaired != `boolean`) {
    throw TypeError(`disposition.visuallyImpaired must be a boolean.`);
  }
};
var A = class e {
  constructor(e) {
    this.bytes = e;
    this.pos = 0;
  }
  seekToByte(e) {
    this.pos = e * 8;
  }
  readBit() {
    let e = Math.floor(this.pos / 8);
    let t = this.bytes[e] ?? 0;
    let n = 7 - (this.pos & 7);
    let r = (t & 1 << n) >> n;
    this.pos++;
    return r;
  }
  readBits(e) {
    if (e === 1) {
      return this.readBit();
    }
    let t = 0;
    for (let n = 0; n < e; n++) {
      t <<= 1;
      t |= this.readBit();
    }
    return t;
  }
  writeBits(e, t) {
    let n = this.pos + e;
    for (let e = this.pos; e < n; e++) {
      let r = Math.floor(e / 8);
      let i = this.bytes[r];
      let a = 7 - (e & 7);
      i &= ~(1 << a);
      i |= (t & 1 << n - e - 1) >> n - e - 1 << a;
      this.bytes[r] = i;
    }
    this.pos = n;
  }
  readAlignedByte() {
    if (this.pos % 8 != 0) {
      throw Error(`Bitstream is not byte-aligned.`);
    }
    let e = this.pos / 8;
    let t = this.bytes[e] ?? 0;
    this.pos += 8;
    return t;
  }
  skipBits(e) {
    this.pos += e;
  }
  getBitsLeft() {
    return this.bytes.length * 8 - this.pos;
  }
  clone() {
    let t = new e(this.bytes);
    t.pos = this.pos;
    return t;
  }
};
var xt = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
var St = [-1, 1, 2, 3, 4, 5, 6, 8];
var Ct = e => {
  if (!e || e.byteLength < 2) {
    throw TypeError(`AAC description must be at least 2 bytes long.`);
  }
  let t = new A(e);
  let n = t.readBits(5);
  if (n === 31) {
    n = 32 + t.readBits(6);
  }
  let r = t.readBits(4);
  let i = null;
  if (r === 15) {
    i = t.readBits(24);
  } else if (r < xt.length) {
    i = xt[r];
  }
  let a = t.readBits(4);
  let o = null;
  if (a >= 1 && a <= 7) {
    o = St[a];
  }
  return {
    objectType: n,
    frequencyIndex: r,
    sampleRate: i,
    channelConfiguration: a,
    numberOfChannels: o
  };
};
var wt = e => {
  let t = xt.indexOf(e.sampleRate);
  let n = null;
  if (t === -1) {
    t = 15;
    n = e.sampleRate;
  }
  let r = St.indexOf(e.numberOfChannels);
  if (r === -1) {
    throw TypeError(`Unsupported number of channels: ${e.numberOfChannels}`);
  }
  let i = 13;
  if (e.objectType >= 32) {
    i += 6;
  }
  if (t === 15) {
    i += 24;
  }
  let a = Math.ceil(i / 8);
  let o = new Uint8Array(a);
  let s = new A(o);
  if (e.objectType < 32) {
    s.writeBits(5, e.objectType);
  } else {
    s.writeBits(5, 31);
    s.writeBits(6, e.objectType - 32);
  }
  s.writeBits(4, t);
  if (t === 15) {
    s.writeBits(24, n);
  }
  s.writeBits(4, r);
  return o;
};
var Tt = e => {
  let t = new Uint8Array(7);
  let n = new A(t);
  let {
    objectType: r,
    frequencyIndex: i,
    channelConfiguration: a
  } = e;
  let o = r - 1;
  n.writeBits(12, 4095);
  n.writeBits(1, 0);
  n.writeBits(2, 0);
  n.writeBits(1, 1);
  n.writeBits(2, o);
  n.writeBits(4, i);
  n.writeBits(1, 0);
  n.writeBits(3, a);
  n.writeBits(1, 0);
  n.writeBits(1, 0);
  n.writeBits(1, 0);
  n.writeBits(1, 0);
  n.skipBits(13);
  n.writeBits(11, 2047);
  n.writeBits(2, 0);
  return {
    header: t,
    bitstream: n
  };
};
var Et = (e, t) => {
  e.pos = 30;
  e.writeBits(13, t);
};
var j = [`avc`, `hevc`, `vp9`, `av1`, `vp8`, `prores`];
var M = [`pcm-s16`, `pcm-s16be`, `pcm-s24`, `pcm-s24be`, `pcm-s32`, `pcm-s32be`, `pcm-f32`, `pcm-f32be`, `pcm-f64`, `pcm-f64be`, `pcm-u8`, `pcm-s8`, `ulaw`, `alaw`];
var Dt = [`aac`, `opus`, `mp3`, `vorbis`, `flac`, `ac3`, `eac3`];
var N = [...Dt, ...M];
var Ot = [`webvtt`];
var kt = [{
  maxMacroblocks: 99,
  maxBitrate: 64000,
  maxDpbMbs: 396,
  level: 10
}, {
  maxMacroblocks: 396,
  maxBitrate: 192000,
  maxDpbMbs: 900,
  level: 11
}, {
  maxMacroblocks: 396,
  maxBitrate: 384000,
  maxDpbMbs: 2376,
  level: 12
}, {
  maxMacroblocks: 396,
  maxBitrate: 768000,
  maxDpbMbs: 2376,
  level: 13
}, {
  maxMacroblocks: 396,
  maxBitrate: 2000000,
  maxDpbMbs: 2376,
  level: 20
}, {
  maxMacroblocks: 792,
  maxBitrate: 4000000,
  maxDpbMbs: 4752,
  level: 21
}, {
  maxMacroblocks: 1620,
  maxBitrate: 4000000,
  maxDpbMbs: 8100,
  level: 22
}, {
  maxMacroblocks: 1620,
  maxBitrate: 10000000,
  maxDpbMbs: 8100,
  level: 30
}, {
  maxMacroblocks: 3600,
  maxBitrate: 14000000,
  maxDpbMbs: 18000,
  level: 31
}, {
  maxMacroblocks: 5120,
  maxBitrate: 20000000,
  maxDpbMbs: 20480,
  level: 32
}, {
  maxMacroblocks: 8192,
  maxBitrate: 20000000,
  maxDpbMbs: 32768,
  level: 40
}, {
  maxMacroblocks: 8192,
  maxBitrate: 50000000,
  maxDpbMbs: 32768,
  level: 41
}, {
  maxMacroblocks: 8704,
  maxBitrate: 50000000,
  maxDpbMbs: 34816,
  level: 42
}, {
  maxMacroblocks: 22080,
  maxBitrate: 135000000,
  maxDpbMbs: 110400,
  level: 50
}, {
  maxMacroblocks: 36864,
  maxBitrate: 240000000,
  maxDpbMbs: 184320,
  level: 51
}, {
  maxMacroblocks: 36864,
  maxBitrate: 240000000,
  maxDpbMbs: 184320,
  level: 52
}, {
  maxMacroblocks: 139264,
  maxBitrate: 240000000,
  maxDpbMbs: 696320,
  level: 60
}, {
  maxMacroblocks: 139264,
  maxBitrate: 480000000,
  maxDpbMbs: 696320,
  level: 61
}, {
  maxMacroblocks: 139264,
  maxBitrate: 800000000,
  maxDpbMbs: 696320,
  level: 62
}];
var At = [{
  maxPictureSize: 36864,
  maxBitrate: 128000,
  tier: `L`,
  level: 30
}, {
  maxPictureSize: 122880,
  maxBitrate: 1500000,
  tier: `L`,
  level: 60
}, {
  maxPictureSize: 245760,
  maxBitrate: 3000000,
  tier: `L`,
  level: 63
}, {
  maxPictureSize: 552960,
  maxBitrate: 6000000,
  tier: `L`,
  level: 90
}, {
  maxPictureSize: 983040,
  maxBitrate: 10000000,
  tier: `L`,
  level: 93
}, {
  maxPictureSize: 2228224,
  maxBitrate: 12000000,
  tier: `L`,
  level: 120
}, {
  maxPictureSize: 2228224,
  maxBitrate: 30000000,
  tier: `H`,
  level: 120
}, {
  maxPictureSize: 2228224,
  maxBitrate: 20000000,
  tier: `L`,
  level: 123
}, {
  maxPictureSize: 2228224,
  maxBitrate: 50000000,
  tier: `H`,
  level: 123
}, {
  maxPictureSize: 8912896,
  maxBitrate: 25000000,
  tier: `L`,
  level: 150
}, {
  maxPictureSize: 8912896,
  maxBitrate: 100000000,
  tier: `H`,
  level: 150
}, {
  maxPictureSize: 8912896,
  maxBitrate: 40000000,
  tier: `L`,
  level: 153
}, {
  maxPictureSize: 8912896,
  maxBitrate: 160000000,
  tier: `H`,
  level: 153
}, {
  maxPictureSize: 8912896,
  maxBitrate: 60000000,
  tier: `L`,
  level: 156
}, {
  maxPictureSize: 8912896,
  maxBitrate: 240000000,
  tier: `H`,
  level: 156
}, {
  maxPictureSize: 35651584,
  maxBitrate: 60000000,
  tier: `L`,
  level: 180
}, {
  maxPictureSize: 35651584,
  maxBitrate: 240000000,
  tier: `H`,
  level: 180
}, {
  maxPictureSize: 35651584,
  maxBitrate: 120000000,
  tier: `L`,
  level: 183
}, {
  maxPictureSize: 35651584,
  maxBitrate: 480000000,
  tier: `H`,
  level: 183
}, {
  maxPictureSize: 35651584,
  maxBitrate: 240000000,
  tier: `L`,
  level: 186
}, {
  maxPictureSize: 35651584,
  maxBitrate: 800000000,
  tier: `H`,
  level: 186
}];
var jt = [{
  maxPictureSize: 36864,
  maxBitrate: 200000,
  level: 10
}, {
  maxPictureSize: 73728,
  maxBitrate: 800000,
  level: 11
}, {
  maxPictureSize: 122880,
  maxBitrate: 1800000,
  level: 20
}, {
  maxPictureSize: 245760,
  maxBitrate: 3600000,
  level: 21
}, {
  maxPictureSize: 552960,
  maxBitrate: 7200000,
  level: 30
}, {
  maxPictureSize: 983040,
  maxBitrate: 12000000,
  level: 31
}, {
  maxPictureSize: 2228224,
  maxBitrate: 18000000,
  level: 40
}, {
  maxPictureSize: 2228224,
  maxBitrate: 30000000,
  level: 41
}, {
  maxPictureSize: 8912896,
  maxBitrate: 60000000,
  level: 50
}, {
  maxPictureSize: 8912896,
  maxBitrate: 120000000,
  level: 51
}, {
  maxPictureSize: 8912896,
  maxBitrate: 180000000,
  level: 52
}, {
  maxPictureSize: 35651584,
  maxBitrate: 180000000,
  level: 60
}, {
  maxPictureSize: 35651584,
  maxBitrate: 240000000,
  level: 61
}, {
  maxPictureSize: 35651584,
  maxBitrate: 480000000,
  level: 62
}];
var Mt = [{
  maxPictureSize: 147456,
  maxBitrate: 1500000,
  tier: `M`,
  level: 0
}, {
  maxPictureSize: 278784,
  maxBitrate: 3000000,
  tier: `M`,
  level: 1
}, {
  maxPictureSize: 665856,
  maxBitrate: 6000000,
  tier: `M`,
  level: 4
}, {
  maxPictureSize: 1065024,
  maxBitrate: 10000000,
  tier: `M`,
  level: 5
}, {
  maxPictureSize: 2359296,
  maxBitrate: 12000000,
  tier: `M`,
  level: 8
}, {
  maxPictureSize: 2359296,
  maxBitrate: 30000000,
  tier: `H`,
  level: 8
}, {
  maxPictureSize: 2359296,
  maxBitrate: 20000000,
  tier: `M`,
  level: 9
}, {
  maxPictureSize: 2359296,
  maxBitrate: 50000000,
  tier: `H`,
  level: 9
}, {
  maxPictureSize: 8912896,
  maxBitrate: 30000000,
  tier: `M`,
  level: 12
}, {
  maxPictureSize: 8912896,
  maxBitrate: 100000000,
  tier: `H`,
  level: 12
}, {
  maxPictureSize: 8912896,
  maxBitrate: 40000000,
  tier: `M`,
  level: 13
}, {
  maxPictureSize: 8912896,
  maxBitrate: 160000000,
  tier: `H`,
  level: 13
}, {
  maxPictureSize: 8912896,
  maxBitrate: 60000000,
  tier: `M`,
  level: 14
}, {
  maxPictureSize: 8912896,
  maxBitrate: 240000000,
  tier: `H`,
  level: 14
}, {
  maxPictureSize: 35651584,
  maxBitrate: 60000000,
  tier: `M`,
  level: 15
}, {
  maxPictureSize: 35651584,
  maxBitrate: 240000000,
  tier: `H`,
  level: 15
}, {
  maxPictureSize: 35651584,
  maxBitrate: 60000000,
  tier: `M`,
  level: 16
}, {
  maxPictureSize: 35651584,
  maxBitrate: 240000000,
  tier: `H`,
  level: 16
}, {
  maxPictureSize: 35651584,
  maxBitrate: 100000000,
  tier: `M`,
  level: 17
}, {
  maxPictureSize: 35651584,
  maxBitrate: 480000000,
  tier: `H`,
  level: 17
}, {
  maxPictureSize: 35651584,
  maxBitrate: 160000000,
  tier: `M`,
  level: 18
}, {
  maxPictureSize: 35651584,
  maxBitrate: 800000000,
  tier: `H`,
  level: 18
}, {
  maxPictureSize: 35651584,
  maxBitrate: 160000000,
  tier: `M`,
  level: 19
}, {
  maxPictureSize: 35651584,
  maxBitrate: 800000000,
  tier: `H`,
  level: 19
}];
var Nt = `.01.01.01.01.00`;
var Pt = `.0.110.01.01.01.0`;
var Ft = [`ap4x`, `ap4h`, `apch`, `apcn`, `apcs`, `apco`];
var It = [{
  fourCc: `apco`,
  bitrate: 45000000,
  alpha: false
}, {
  fourCc: `apcs`,
  bitrate: 102000000,
  alpha: false
}, {
  fourCc: `apcn`,
  bitrate: 147000000,
  alpha: false
}, {
  fourCc: `apch`,
  bitrate: 220000000,
  alpha: false
}, {
  fourCc: `ap4h`,
  bitrate: 330000000,
  alpha: true
}, {
  fourCc: `ap4x`,
  bitrate: 500000000,
  alpha: true
}];
var Lt = (e, t, n, r, a) => {
  if (e === `avc`) {
    let e = Math.ceil(t / 16) * Math.ceil(n / 16);
    let a = kt.find(t => {
      return e <= t.maxMacroblocks && r <= t.maxBitrate;
    }) ?? i(kt);
    let o = a ? a.level : 0;
    return `avc1.${`64`.padStart(2, `0`)}00${o.toString(16).padStart(2, `0`)}`;
  } else if (e === `hevc`) {
    let e = t * n;
    let a = At.find(t => {
      return e <= t.maxPictureSize && r <= t.maxBitrate;
    }) ?? i(At);
    return `hev1.1.6.${a.tier}${a.level}.B0`;
  } else if (e === `vp8`) {
    return `vp8`;
  } else if (e === `vp9`) {
    let e = t * n;
    return `vp09.00.${(jt.find(t => {
      return e <= t.maxPictureSize && r <= t.maxBitrate;
    }) ?? i(jt)).level.toString().padStart(2, `0`)}.08`;
  } else if (e === `av1`) {
    let e = t * n;
    let a = Mt.find(t => {
      return e <= t.maxPictureSize && r <= t.maxBitrate;
    }) ?? i(Mt);
    return `av01.0.${a.level.toString().padStart(2, `0`)}${a.tier}.08`;
  } else if (e === `prores`) {
    let e = (t * n / 2073600) ** 0.95;
    let i = It.filter(e => {
      return e.alpha === a;
    });
    let o = i[0].fourCc;
    let s = Infinity;
    for (let {
      fourCc: t,
      bitrate: n
    } of i) {
      let i = Math.abs(n * e - r);
      if (i < s) {
        s = i;
        o = t;
      }
    }
    return o;
  } else {
    D(e);
  }
  throw TypeError(`Unhandled codec '${String(e)}'.`);
};
var Rt = e => {
  let t = e.split(`.`);
  return [1, 1, Number(t[1]), 2, 1, Number(t[2]), 3, 1, Number(t[3]), 4, 1, t[4] ? Number(t[4]) : 1];
};
var zt = e => {
  let t = e.split(`.`);
  let n = Number(t[1]);
  let r = t[2];
  let i = Number(r.slice(0, -1));
  let a = (n << 5) + i;
  let o = +(r.slice(-1) === `H`);
  let s = Number(t[3]) === 8 ? 0 : 1;
  let c = t[4] ? Number(t[4]) : 0;
  let l = t[5] ? Number(t[5][0]) : 1;
  let u = t[5] ? Number(t[5][1]) : 1;
  let d = t[5] ? Number(t[5][2]) : 0;
  return [129, a, (o << 7) + (s << 6) + 0 + (c << 4) + (l << 3) + (u << 2) + d, 0];
};
var Bt = e => {
  let {
    codec: t,
    codecDescription: r,
    colorSpace: a,
    avcCodecInfo: o,
    hevcCodecInfo: s,
    vp9CodecInfo: c,
    av1CodecInfo: l,
    proresFormat: d
  } = e;
  if (t === `avc`) {
    n(e.avcType !== null);
    if (o) {
      let t = new Uint8Array([o.avcProfileIndication, o.profileCompatibility, o.avcLevelIndication]);
      return `avc${e.avcType}.${w(t)}`;
    }
    if (!r || r.byteLength < 4) {
      throw TypeError(`AVC decoder description is not provided or is not at least 4 bytes long.`);
    }
    return `avc${e.avcType}.${w(r.subarray(1, 4))}`;
  } else if (t === `hevc`) {
    let e;
    let t;
    let n;
    let i;
    let a;
    let o;
    if (s) {
      e = s.generalProfileSpace;
      t = s.generalProfileIdc;
      n = ne(s.generalProfileCompatibilityFlags);
      i = s.generalTierFlag;
      a = s.generalLevelIdc;
      o = [...s.generalConstraintIndicatorFlags];
    } else {
      if (!r || r.byteLength < 23) {
        throw TypeError(`HEVC decoder description is not provided or is not at least 23 bytes long.`);
      }
      let s = u(r);
      let c = s.getUint8(1);
      e = c >> 6 & 3;
      t = c & 31;
      n = ne(s.getUint32(2));
      i = c >> 5 & 1;
      a = s.getUint8(12);
      o = [];
      for (let e = 0; e < 6; e++) {
        o.push(s.getUint8(6 + e));
      }
    }
    let c = `hev1.`;
    c += [``, `A`, `B`, `C`][e] + t;
    c += `.`;
    c += n.toString(16).toUpperCase();
    c += `.`;
    if (i === 0) {
      c += `L`;
    } else {
      c += `H`;
    }
    c += a;
    while (o.length > 0 && o[o.length - 1] === 0) {
      o.pop();
    }
    if (o.length > 0) {
      c += `.`;
      c += o.map(e => {
        return e.toString(16).toUpperCase();
      }).join(`.`);
    }
    return c;
  } else if (t === `vp8`) {
    return `vp8`;
  } else if (t === `vp9`) {
    if (!c) {
      let t = e.width * e.height;
      let n = i(jt).level;
      for (let e of jt) {
        if (t <= e.maxPictureSize) {
          n = e.level;
          break;
        }
      }
      return `vp09.00.${n.toString().padStart(2, `0`)}.08`;
    }
    let t = c.profile.toString().padStart(2, `0`);
    let n = c.level.toString().padStart(2, `0`);
    let r = c.bitDepth.toString().padStart(2, `0`);
    let a = c.chromaSubsampling.toString().padStart(2, `0`);
    let o = c.colourPrimaries.toString().padStart(2, `0`);
    let s = c.transferCharacteristics.toString().padStart(2, `0`);
    let l = c.matrixCoefficients.toString().padStart(2, `0`);
    let u = c.videoFullRangeFlag.toString().padStart(2, `0`);
    let d = `vp09.${t}.${n}.${r}.${a}`;
    d += `.${o}.${s}.${l}.${u}`;
    if (d.endsWith(Nt)) {
      d = d.slice(0, -15);
    }
    return d;
  } else if (t === `av1`) {
    if (!l) {
      let t = e.width * e.height;
      let n = i(jt).level;
      for (let e of jt) {
        if (t <= e.maxPictureSize) {
          n = e.level;
          break;
        }
      }
      return `av01.0.${n.toString().padStart(2, `0`)}M.08`;
    }
    let t = l.profile;
    let n = l.level.toString().padStart(2, `0`);
    let r = l.tier ? `H` : `M`;
    let o = l.bitDepth.toString().padStart(2, `0`);
    let s = l.monochrome ? `1` : `0`;
    let c = l.chromaSubsamplingX * 100 + l.chromaSubsamplingY * 10 + (l.chromaSubsamplingX && l.chromaSubsamplingY ? l.chromaSamplePosition : 0) * 1;
    let u = a?.primaries ? h[a.primaries] : 1;
    let d = a?.transfer ? _[a.transfer] : 1;
    let f = a?.matrix ? y[a.matrix] : 1;
    let p = +!!a?.fullRange;
    let m = `av01.${t}.${n}${r}.${o}`;
    m += `.${s}.${c.toString().padStart(3, `0`)}`;
    m += `.${u.toString().padStart(2, `0`)}`;
    m += `.${d.toString().padStart(2, `0`)}`;
    m += `.${f.toString().padStart(2, `0`)}`;
    m += `.${p}`;
    if (m.endsWith(Pt)) {
      m = m.slice(0, -17);
    }
    return m;
  } else if (t === `prores`) {
    return d ?? `apch`;
  } else if (t !== null) {
    D(t);
  }
  throw TypeError(`Unhandled codec '${t}'.`);
};
var Vt = (e, t, n) => {
  if (e === `aac`) {
    if (t >= 2 && n <= 24000) {
      return `mp4a.40.29`;
    } else if (n <= 24000) {
      return `mp4a.40.5`;
    } else {
      return `mp4a.40.2`;
    }
  }
  if (e === `mp3`) {
    return `mp3`;
  }
  if (e === `opus`) {
    return `opus`;
  }
  if (e === `vorbis`) {
    return `vorbis`;
  }
  if (e === `flac`) {
    return `flac`;
  }
  if (e === `ac3`) {
    return `ac-3`;
  }
  if (e === `eac3`) {
    return `ec-3`;
  }
  if (M.includes(e)) {
    return e;
  }
  throw TypeError(`Unhandled codec '${e}'.`);
};
var Ht = e => {
  let {
    codec: t,
    codecDescription: n,
    aacCodecInfo: r
  } = e;
  if (t === `aac`) {
    if (!r) {
      throw TypeError(`AAC codec info must be provided.`);
    }
    if (r.isMpeg2) {
      return `mp4a.67`;
    }
    {
      let e;
      if (r.objectType === null) {
        e = Ct(n).objectType;
      } else {
        e = r.objectType;
      }
      return `mp4a.40.${e}`;
    }
  } else if (t === `mp3`) {
    return `mp3`;
  } else if (t === `opus`) {
    return `opus`;
  } else if (t === `vorbis`) {
    return `vorbis`;
  } else if (t === `flac`) {
    return `flac`;
  } else if (t === `ac3`) {
    return `ac-3`;
  } else if (t === `eac3`) {
    return `ec-3`;
  } else if (t && M.includes(t)) {
    return t;
  }
  throw TypeError(`Unhandled codec '${t}'.`);
};
var Ut = e => {
  switch (e.codec) {
    case `flac`:
      {
        let t = He(`ZkxhQ4AAACIQABAAAAYtACWtCsRC8AANRBhVFucAcYu5ASE2m1Dxv8tw`);
        if (e.sampleRate >= 1048576 || e.numberOfChannels > 8) {
          return false;
        } else {
          t[18] = e.sampleRate >>> 12;
          t[19] = e.sampleRate >>> 4;
          t[20] = (e.sampleRate & 15) << 4 | e.numberOfChannels - 1 << 1;
          return t;
        }
      }
    case `vorbis`:
      {
        let t = He(`Ah7/AgF2b3JiaXMAAAAAAoC7AAAAAAAAgLUBAAAAAAC4AQN2b3JiaXMNAAAATGF2ZjU4Ljc2LjEwMAgAAAAMAAAAbGFuZ3VhZ2U9dW5kGQAAAGhhbmRsZXJfbmFtZT1Tb3VuZEhhbmRsZXIWAAAAdmVuZG9yX2lkPVswXVswXVswXVswXSAAAABlbmNvZGVyPUxhdmM1OC4xMzQuMTAwIGxpYnZvcmJpcxAAAABtYWpvcl9icmFuZD1pc29tEQAAAG1pbm9yX3ZlcnNpb249NTEyIgAAAGNvbXBhdGlibGVfYnJhbmRzPWlzb21pc28yYXZjMW1wNDEmAAAAREVTQ1JJUFRJT049TWFkZSB3aXRoIFJlbW90aW9uIDQuMC4yNzgBBXZvcmJpcyVCQ1YBAEAAACRzGCpGpXMWhBAaQlAZ4xxCzmvsGUJMEYIcMkxbyyVzkCGkoEKIWyiB0JBVAABAAACHQXgUhIpBCCGEJT1YkoMnPQghhIg5eBSEaUEIIYQQQgghhBBCCCGERTlokoMnQQgdhOMwOAyD5Tj4HIRFOVgQgydB6CCED0K4moOsOQghhCQ1SFCDBjnoHITCLCiKgsQwuBaEBDUojILkMMjUgwtCiJqDSTX4GoRnQXgWhGlBCCGEJEFIkIMGQcgYhEZBWJKDBjm4FITLQagahCo5CB+EIDRkFQCQAACgoiiKoigKEBqyCgDIAAAQQFEUx3EcyZEcybEcCwgNWQUAAAEACAAAoEiKpEiO5EiSJFmSJVmSJVmS5omqLMuyLMuyLMsyEBqyCgBIAABQUQxFcRQHCA1ZBQBkAAAIoDiKpViKpWiK54iOCISGrAIAgAAABAAAEDRDUzxHlETPVFXXtm3btm3btm3btm3btm1blmUZCA1ZBQBAAAAQ0mlmqQaIMAMZBkJDVgEACAAAgBGKMMSA0JBVAABAAACAGEoOogmtOd+c46BZDppKsTkdnEi1eZKbirk555xzzsnmnDHOOeecopxZDJoJrTnnnMSgWQqaCa0555wnsXnQmiqtOeeccc7pYJwRxjnnnCateZCajbU555wFrWmOmkuxOeecSLl5UptLtTnnnHPOOeecc84555zqxekcnBPOOeecqL25lpvQxTnnnE/G6d6cEM4555xzzjnnnHPOOeecIDRkFQAABABAEIaNYdwpCNLnaCBGEWIaMulB9+gwCRqDnELq0ehopJQ6CCWVcVJKJwgNWQUAAAIAQAghhRRSSCGFFFJIIYUUYoghhhhyyimnoIJKKqmooowyyyyzzDLLLLPMOuyssw47DDHEEEMrrcRSU2011lhr7jnnmoO0VlprrbVSSimllFIKQkNWAQAgAAAEQgYZZJBRSCGFFGKIKaeccgoqqIDQkFUAACAAgAAAAABP8hzRER3RER3RER3RER3R8RzPESVREiVREi3TMjXTU0VVdWXXlnVZt31b2IVd933d933d+HVhWJZlWZZlWZZlWZZlWZZlWZYgNGQVAAACAAAghBBCSCGFFFJIKcYYc8w56CSUEAgNWQUAAAIACAAAAHAUR3EcyZEcSbIkS9IkzdIsT/M0TxM9URRF0zRV0RVdUTdtUTZl0zVdUzZdVVZtV5ZtW7Z125dl2/d93/d93/d93/d93/d9XQdCQ1YBABIAADqSIymSIimS4ziOJElAaMgqAEAGAEAAAIriKI7jOJIkSZIlaZJneZaomZrpmZ4qqkBoyCoAABAAQAAAAAAAAIqmeIqpeIqoeI7oiJJomZaoqZoryqbsuq7ruq7ruq7ruq7ruq7ruq7ruq7ruq7ruq7ruq7ruq7ruq4LhIasAgAkAAB0JEdyJEdSJEVSJEdygNCQVQCADACAAAAcwzEkRXIsy9I0T/M0TxM90RM901NFV3SB0JBVAAAgAIAAAAAAAAAMybAUy9EcTRIl1VItVVMt1VJF1VNVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVN0zRNEwgNWQkAkAEAkBBTLS3GmgmLJGLSaqugYwxS7KWxSCpntbfKMYUYtV4ah5RREHupJGOKQcwtpNApJq3WVEKFFKSYYyoVUg5SIDRkhQAQmgHgcBxAsixAsiwAAAAAAAAAkDQN0DwPsDQPAAAAAAAAACRNAyxPAzTPAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABA0jRA8zxA8zwAAAAAAAAA0DwP8DwR8EQRAAAAAAAAACzPAzTRAzxRBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABA0jRA8zxA8zwAAAAAAAAAsDwP8EQR0DwRAAAAAAAAACzPAzxRBDzRAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAEOAAABBgIRQasiIAiBMAcEgSJAmSBM0DSJYFTYOmwTQBkmVB06BpME0AAAAAAAAAAAAAJE2DpkHTIIoASdOgadA0iCIAAAAAAAAAAAAAkqZB06BpEEWApGnQNGgaRBEAAAAAAAAAAAAAzzQhihBFmCbAM02IIkQRpgkAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAGHAAAAgwoQwUGrIiAIgTAHA4imUBAIDjOJYFAACO41gWAABYliWKAABgWZooAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAYcAAACDChDBQashIAiAIAcCiKZQHHsSzgOJYFJMmyAJYF0DyApgFEEQAIAAAocAAACLBBU2JxgEJDVgIAUQAABsWxLE0TRZKkaZoniiRJ0zxPFGma53meacLzPM80IYqiaJoQRVE0TZimaaoqME1VFQAAUOAAABBgg6bE4gCFhqwEAEICAByKYlma5nmeJ4qmqZokSdM8TxRF0TRNU1VJkqZ5niiKommapqqyLE3zPFEURdNUVVWFpnmeKIqiaaqq6sLzPE8URdE0VdV14XmeJ4qiaJqq6roQRVE0TdNUTVV1XSCKpmmaqqqqrgtETxRNU1Vd13WB54miaaqqq7ouEE3TVFVVdV1ZBpimaaqq68oyQFVV1XVdV5YBqqqqruu6sgxQVdd1XVmWZQCu67qyLMsCAAAOHAAAAoygk4wqi7DRhAsPQKEhKwKAKAAAwBimFFPKMCYhpBAaxiSEFEImJaXSUqogpFJSKRWEVEoqJaOUUmopVRBSKamUCkIqJZVSAADYgQMA2IGFUGjISgAgDwCAMEYpxhhzTiKkFGPOOScRUoox55yTSjHmnHPOSSkZc8w556SUzjnnnHNSSuacc845KaVzzjnnnJRSSuecc05KKSWEzkEnpZTSOeecEwAAVOAAABBgo8jmBCNBhYasBABSAQAMjmNZmuZ5omialiRpmud5niiapiZJmuZ5nieKqsnzPE8URdE0VZXneZ4oiqJpqirXFUXTNE1VVV2yLIqmaZqq6rowTdNUVdd1XZimaaqq67oubFtVVdV1ZRm2raqq6rqyDFzXdWXZloEsu67s2rIAAPAEBwCgAhtWRzgpGgssNGQlAJABAEAYg5BCCCFlEEIKIYSUUggJAAAYcAAACDChDBQashIASAUAAIyx1lprrbXWQGettdZaa62AzFprrbXWWmuttdZaa6211lJrrbXWWmuttdZaa6211lprrbXWWmuttdZaa6211lprrbXWWmuttdZaa6211lprrbXWWmstpZRSSimllFJKKaWUUkoppZRSSgUA+lU4APg/2LA6wknRWGChISsBgHAAAMAYpRhzDEIppVQIMeacdFRai7FCiDHnJKTUWmzFc85BKCGV1mIsnnMOQikpxVZjUSmEUlJKLbZYi0qho5JSSq3VWIwxqaTWWoutxmKMSSm01FqLMRYjbE2ptdhqq7EYY2sqLbQYY4zFCF9kbC2m2moNxggjWywt1VprMMYY3VuLpbaaizE++NpSLDHWXAAAd4MDAESCjTOsJJ0VjgYXGrISAAgJACAQUooxxhhzzjnnpFKMOeaccw5CCKFUijHGnHMOQgghlIwx5pxzEEIIIYRSSsaccxBCCCGEkFLqnHMQQgghhBBKKZ1zDkIIIYQQQimlgxBCCCGEEEoopaQUQgghhBBCCKmklEIIIYRSQighlZRSCCGEEEIpJaSUUgohhFJCCKGElFJKKYUQQgillJJSSimlEkoJJYQSUikppRRKCCGUUkpKKaVUSgmhhBJKKSWllFJKIYQQSikFAAAcOAAABBhBJxlVFmGjCRcegEJDVgIAZAAAkKKUUiktRYIipRikGEtGFXNQWoqocgxSzalSziDmJJaIMYSUk1Qy5hRCDELqHHVMKQYtlRhCxhik2HJLoXMOAAAAQQCAgJAAAAMEBTMAwOAA4XMQdAIERxsAgCBEZohEw0JweFAJEBFTAUBigkIuAFRYXKRdXECXAS7o4q4DIQQhCEEsDqCABByccMMTb3jCDU7QKSp1IAAAAAAADADwAACQXAAREdHMYWRobHB0eHyAhIiMkAgAAAAAABcAfAAAJCVAREQ0cxgZGhscHR4fICEiIyQBAIAAAgAAAAAggAAEBAQAAAAAAAIAAAAEBA==`);
        let n = u(t);
        n.setUint8(15, e.numberOfChannels);
        n.setUint32(16, e.sampleRate, true);
        return t;
      }
    default:
      {
        return;
      }
  }
};
var Wt = 48000;
var Gt = /^pcm-([usf])(\d+)(be)?$/;
var Kt = e => {
  n(M.includes(e));
  if (e === `ulaw`) {
    return {
      dataType: `ulaw`,
      sampleSize: 1,
      littleEndian: true,
      silentValue: 255
    };
  }
  if (e === `alaw`) {
    return {
      dataType: `alaw`,
      sampleSize: 1,
      littleEndian: true,
      silentValue: 213
    };
  }
  let t = Gt.exec(e);
  n(t);
  let r;
  if (t[1] === `u`) {
    r = `unsigned`;
  } else {
    if (t[1] === `s`) {
      r = `signed`;
    } else {
      r = `float`;
    }
  }
  let i = Number(t[2]) / 8;
  let a = t[3] !== `be`;
  return {
    dataType: r,
    sampleSize: i,
    littleEndian: a,
    silentValue: e === `pcm-u8` ? 128 : 0
  };
};
var qt = e => {
  if (e.startsWith(`avc1`) || e.startsWith(`avc3`)) {
    return `avc`;
  } else {
    if (e.startsWith(`hev1`) || e.startsWith(`hvc1`)) {
      return `hevc`;
    } else {
      if (e === `vp8`) {
        return `vp8`;
      } else {
        if (e.startsWith(`vp09`)) {
          return `vp9`;
        } else {
          if (e.startsWith(`av01`)) {
            return `av1`;
          } else {
            if (Ft.includes(e)) {
              return `prores`;
            } else {
              if (e === `mp3` || e === `mp4a.69` || e === `mp4a.6B` || e === `mp4a.6b` || e === `mp4a.40.34`) {
                return `mp3`;
              } else {
                if (e.startsWith(`mp4a.40.`) || e === `mp4a.67`) {
                  return `aac`;
                } else {
                  if (e === `opus`) {
                    return `opus`;
                  } else {
                    if (e === `vorbis`) {
                      return `vorbis`;
                    } else {
                      if (e === `flac`) {
                        return `flac`;
                      } else {
                        if (e === `ac-3` || e === `ac3`) {
                          return `ac3`;
                        } else {
                          if (e === `ec-3` || e === `eac3`) {
                            return `eac3`;
                          } else {
                            if (e === `ulaw`) {
                              return `ulaw`;
                            } else {
                              if (e === `alaw`) {
                                return `alaw`;
                              } else {
                                if (Gt.test(e)) {
                                  return e;
                                } else {
                                  if (e === `webvtt`) {
                                    return `webvtt`;
                                  } else {
                                    return null;
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};
var Jt = e => {
  if (e === `avc`) {
    return {
      avc: {
        format: `avc`
      }
    };
  } else {
    if (e === `hevc`) {
      return {
        hevc: {
          format: `hevc`
        }
      };
    } else {
      return {};
    }
  }
};
var Yt = e => {
  if (e === `aac`) {
    return {
      aac: {
        format: `aac`
      }
    };
  } else {
    if (e === `opus`) {
      return {
        opus: {
          format: `opus`
        }
      };
    } else {
      return {};
    }
  }
};
var Xt = [`avc1`, `avc3`, `hev1`, `hvc1`, `vp8`, `vp09`, `av01`, ...Ft];
var Zt = /^(avc1|avc3)\.[0-9a-fA-F]{6}$/;
var Qt = /^(hev1|hvc1)\.(?:[ABC]?\d+)\.[0-9a-fA-F]{1,8}\.[LH]\d+(?:\.[0-9a-fA-F]{1,2}){0,6}$/;
var $t = /^vp09(?:\.\d{2}){3}(?:(?:\.\d{2}){5})?$/;
var en = /^av01\.\d\.\d{2}[MH]\.\d{2}(?:\.\d\.\d{3}\.\d{2}\.\d{2}\.\d{2}\.\d)?$/;
var tn = e => {
  if (!e) {
    throw TypeError(`Video chunk metadata must be provided.`);
  }
  if (typeof e != `object`) {
    throw TypeError(`Video chunk metadata must be an object.`);
  }
  if (!e.decoderConfig) {
    throw TypeError(`Video chunk metadata must include a decoder configuration.`);
  }
  if (typeof e.decoderConfig != `object`) {
    throw TypeError(`Video chunk metadata decoder configuration must be an object.`);
  }
  if (typeof e.decoderConfig.codec != `string`) {
    throw TypeError(`Video chunk metadata decoder configuration must specify a codec string.`);
  }
  if (!Xt.some(t => {
    return e.decoderConfig.codec.startsWith(t);
  })) {
    throw TypeError(`Video chunk metadata decoder configuration codec string must be a valid video codec string as specified in the Mediabunny Codec Registry.`);
  }
  if (!Number.isInteger(e.decoderConfig.codedWidth) || e.decoderConfig.codedWidth <= 0) {
    throw TypeError(`Video chunk metadata decoder configuration must specify a valid codedWidth (positive integer).`);
  }
  if (!Number.isInteger(e.decoderConfig.codedHeight) || e.decoderConfig.codedHeight <= 0) {
    throw TypeError(`Video chunk metadata decoder configuration must specify a valid codedHeight (positive integer).`);
  }
  if (e.decoderConfig.displayAspectWidth !== undefined && (!Number.isInteger(e.decoderConfig.displayAspectWidth) || e.decoderConfig.displayAspectWidth <= 0)) {
    throw TypeError(`Video chunk metadata decoder configuration displayAspectWidth, when defined, must be a positive integer.`);
  }
  if (e.decoderConfig.displayAspectHeight !== undefined && (!Number.isInteger(e.decoderConfig.displayAspectHeight) || e.decoderConfig.displayAspectHeight <= 0)) {
    throw TypeError(`Video chunk metadata decoder configuration displayAspectHeight, when defined, must be a positive integer.`);
  }
  if (e.decoderConfig.displayAspectWidth !== undefined != (e.decoderConfig.displayAspectHeight !== undefined)) {
    throw TypeError(`Video chunk metadata decoder configuration must specify both displayAspectWidth and displayAspectHeight, or neither.`);
  }
  if (e.decoderConfig.description !== undefined && !S(e.decoderConfig.description)) {
    throw TypeError(`Video chunk metadata decoder configuration description, when defined, must be an ArrayBuffer or an ArrayBuffer view.`);
  }
  if (e.decoderConfig.colorSpace !== undefined) {
    let {
      colorSpace: t
    } = e.decoderConfig;
    if (typeof t != `object`) {
      throw TypeError(`Video chunk metadata decoder configuration colorSpace, when provided, must be an object.`);
    }
    let n = Object.keys(h);
    if (t.primaries != null && !n.includes(t.primaries)) {
      throw TypeError(`Video chunk metadata decoder configuration colorSpace primaries, when defined, must be one of ${n.join(`, `)}.`);
    }
    let r = Object.keys(_);
    if (t.transfer != null && !r.includes(t.transfer)) {
      throw TypeError(`Video chunk metadata decoder configuration colorSpace transfer, when defined, must be one of ${r.join(`, `)}.`);
    }
    let i = Object.keys(y);
    if (t.matrix != null && !i.includes(t.matrix)) {
      throw TypeError(`Video chunk metadata decoder configuration colorSpace matrix, when defined, must be one of ${i.join(`, `)}.`);
    }
    if (t.fullRange != null && typeof t.fullRange != `boolean`) {
      throw TypeError(`Video chunk metadata decoder configuration colorSpace fullRange, when defined, must be a boolean.`);
    }
  }
  if (e.decoderConfig.codec.startsWith(`avc1`) || e.decoderConfig.codec.startsWith(`avc3`)) {
    if (!Zt.test(e.decoderConfig.codec)) {
      throw TypeError(`Video chunk metadata decoder configuration codec string for AVC must be a valid AVC codec string as specified in Section 3.4 of RFC 6381.`);
    }
  } else if (e.decoderConfig.codec.startsWith(`hev1`) || e.decoderConfig.codec.startsWith(`hvc1`)) {
    if (!Qt.test(e.decoderConfig.codec)) {
      throw TypeError(`Video chunk metadata decoder configuration codec string for HEVC must be a valid HEVC codec string as specified in Section E.3 of ISO 14496-15.`);
    }
  } else if (e.decoderConfig.codec.startsWith(`vp8`)) {
    if (e.decoderConfig.codec !== `vp8`) {
      throw TypeError(`Video chunk metadata decoder configuration codec string for VP8 must be "vp8".`);
    }
  } else if (e.decoderConfig.codec.startsWith(`vp09`)) {
    if (!$t.test(e.decoderConfig.codec)) {
      throw TypeError(`Video chunk metadata decoder configuration codec string for VP9 must be a valid VP9 codec string as specified in Section "Codecs Parameter String" of https://www.webmproject.org/vp9/mp4/.`);
    }
  } else if (e.decoderConfig.codec.startsWith(`av01`)) {
    if (!en.test(e.decoderConfig.codec)) {
      throw TypeError(`Video chunk metadata decoder configuration codec string for AV1 must be a valid AV1 codec string as specified in Section "Codecs Parameter String" of https://aomediacodec.github.io/av1-isobmff/.`);
    }
  } else if (Ft.some(t => {
    return e.decoderConfig.codec.startsWith(t);
  }) && !Ft.some(t => {
    return e.decoderConfig.codec === t;
  })) {
    throw TypeError(`Video chunk metadata decoder configuration codec string for ProRes must be one of the valid ProRes four-character codes: ${Ft.join(`, `)}.`);
  }
};
var nn = [`mp4a`, `mp3`, `opus`, `vorbis`, `flac`, `ulaw`, `alaw`, `pcm`, `ac-3`, `ec-3`];
var rn = e => {
  if (!e) {
    throw TypeError(`Audio chunk metadata must be provided.`);
  }
  if (typeof e != `object`) {
    throw TypeError(`Audio chunk metadata must be an object.`);
  }
  if (!e.decoderConfig) {
    throw TypeError(`Audio chunk metadata must include a decoder configuration.`);
  }
  if (typeof e.decoderConfig != `object`) {
    throw TypeError(`Audio chunk metadata decoder configuration must be an object.`);
  }
  if (typeof e.decoderConfig.codec != `string`) {
    throw TypeError(`Audio chunk metadata decoder configuration must specify a codec string.`);
  }
  if (!nn.some(t => {
    return e.decoderConfig.codec.startsWith(t);
  })) {
    throw TypeError(`Audio chunk metadata decoder configuration codec string must be a valid audio codec string as specified in the Mediabunny Codec Registry.`);
  }
  if (!Number.isInteger(e.decoderConfig.sampleRate) || e.decoderConfig.sampleRate <= 0) {
    throw TypeError(`Audio chunk metadata decoder configuration must specify a valid sampleRate (positive integer).`);
  }
  if (!Number.isInteger(e.decoderConfig.numberOfChannels) || e.decoderConfig.numberOfChannels <= 0) {
    throw TypeError(`Audio chunk metadata decoder configuration must specify a valid numberOfChannels (positive integer).`);
  }
  if (e.decoderConfig.description !== undefined && !S(e.decoderConfig.description)) {
    throw TypeError(`Audio chunk metadata decoder configuration description, when defined, must be an ArrayBuffer or an ArrayBuffer view.`);
  }
  if (e.decoderConfig.codec.startsWith(`mp4a`) && e.decoderConfig.codec !== `mp4a.69` && e.decoderConfig.codec !== `mp4a.6B` && e.decoderConfig.codec !== `mp4a.6b`) {
    if (![`mp4a.40.2`, `mp4a.40.02`, `mp4a.40.5`, `mp4a.40.05`, `mp4a.40.29`, `mp4a.67`].includes(e.decoderConfig.codec)) {
      throw TypeError(`Audio chunk metadata decoder configuration codec string for AAC must be a valid AAC codec string as specified in https://www.w3.org/TR/webcodecs-aac-codec-registration/.`);
    }
  } else if (e.decoderConfig.codec.startsWith(`mp3`) || e.decoderConfig.codec.startsWith(`mp4a`)) {
    if (e.decoderConfig.codec !== `mp3` && e.decoderConfig.codec !== `mp4a.69` && e.decoderConfig.codec !== `mp4a.6B` && e.decoderConfig.codec !== `mp4a.6b`) {
      throw TypeError(`Audio chunk metadata decoder configuration codec string for MP3 must be "mp3", "mp4a.69" or "mp4a.6B".`);
    }
  } else if (e.decoderConfig.codec.startsWith(`opus`)) {
    if (e.decoderConfig.codec !== `opus`) {
      throw TypeError(`Audio chunk metadata decoder configuration codec string for Opus must be "opus".`);
    }
    if (e.decoderConfig.description && e.decoderConfig.description.byteLength < 18) {
      throw TypeError(`Audio chunk metadata decoder configuration description, when specified, is expected to be an Identification Header as specified in Section 5.1 of RFC 7845.`);
    }
  } else if (e.decoderConfig.codec.startsWith(`vorbis`)) {
    if (e.decoderConfig.codec !== `vorbis`) {
      throw TypeError(`Audio chunk metadata decoder configuration codec string for Vorbis must be "vorbis".`);
    }
    if (!e.decoderConfig.description) {
      throw TypeError(`Audio chunk metadata decoder configuration for Vorbis must include a description, which is expected to adhere to the format described in https://www.w3.org/TR/webcodecs-vorbis-codec-registration/.`);
    }
  } else if (e.decoderConfig.codec.startsWith(`flac`)) {
    if (e.decoderConfig.codec !== `flac`) {
      throw TypeError(`Audio chunk metadata decoder configuration codec string for FLAC must be "flac".`);
    }
    if (!e.decoderConfig.description || e.decoderConfig.description.byteLength < 42) {
      throw TypeError(`Audio chunk metadata decoder configuration for FLAC must include a description, which is expected to adhere to the format described in https://www.w3.org/TR/webcodecs-flac-codec-registration/.`);
    }
  } else if (e.decoderConfig.codec.startsWith(`ac-3`) || e.decoderConfig.codec.startsWith(`ac3`)) {
    if (e.decoderConfig.codec !== `ac-3`) {
      throw TypeError(`Audio chunk metadata decoder configuration codec string for AC-3 must be "ac-3".`);
    }
  } else if (e.decoderConfig.codec.startsWith(`ec-3`) || e.decoderConfig.codec.startsWith(`eac3`)) {
    if (e.decoderConfig.codec !== `ec-3`) {
      throw TypeError(`Audio chunk metadata decoder configuration codec string for EC-3 must be "ec-3".`);
    }
  } else if ((e.decoderConfig.codec.startsWith(`pcm`) || e.decoderConfig.codec.startsWith(`ulaw`) || e.decoderConfig.codec.startsWith(`alaw`)) && !M.includes(e.decoderConfig.codec)) {
    throw TypeError(`Audio chunk metadata decoder configuration codec string for PCM must be one of the supported PCM codecs (${M.join(`, `)}).`);
  }
};
var an = e => {
  if (!e) {
    throw TypeError(`Subtitle metadata must be provided.`);
  }
  if (typeof e != `object`) {
    throw TypeError(`Subtitle metadata must be an object.`);
  }
  if (!e.config) {
    throw TypeError(`Subtitle metadata must include a config object.`);
  }
  if (typeof e.config != `object`) {
    throw TypeError(`Subtitle metadata config must be an object.`);
  }
  if (typeof e.config.description != `string`) {
    throw TypeError(`Subtitle metadata config description must be a string.`);
  }
};
var on = [44100, 48000, 32000];
var sn = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, -1, -1, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, -1, -1, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, -1, -1, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, -1, -1, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, -1];
var cn = 1483304551;
var ln = (e, t, n, r, i) => {
  if (t === 0) {
    return 0;
  } else {
    if (t === 1) {
      return Math.floor(n * 144 / (r << e)) + i;
    } else {
      if (t === 2) {
        return Math.floor(n * 144 / r) + i;
      } else {
        return (Math.floor(n * 12 / r) + i) * 4;
      }
    }
  }
};
var un = (e, t, n, r) => {
  if (t === 0) {
    return 0;
  } else {
    if (t === 1) {
      return n * 144 / (r << e);
    } else {
      if (t === 2) {
        return n * 144 / r;
      } else {
        return n * 12 / r * 4;
      }
    }
  }
};
var dn = (e, t) => {
  if (e === 3) {
    if (t === 3) {
      return 21;
    } else {
      return 36;
    }
  } else {
    if (t === 3) {
      return 13;
    } else {
      return 21;
    }
  }
};
var fn = (e, t) => {
  let n = e >>> 24;
  let r = e >>> 16 & 255;
  let i = e >>> 8 & 255;
  let a = e & 255;
  if (n !== 255 && r !== 255 && i !== 255 && a !== 255) {
    return {
      header: null,
      bytesAdvanced: 4
    };
  }
  if (n !== 255 || (r & 224) != 224) {
    return {
      header: null,
      bytesAdvanced: 1
    };
  }
  let o = 0;
  let s = 0;
  if (r & 16) {
    if (r & 8) {
      o = 0;
    } else {
      o = 1;
    }
  } else {
    o = 1;
    s = 1;
  }
  let c = r >> 3 & 3;
  let l = r >> 1 & 3;
  let u = i >> 4 & 15;
  let d = (i >> 2 & 3) % 3;
  let f = i >> 1 & 1;
  let p = a >> 6 & 3;
  let m = a >> 4 & 3;
  let h = a >> 3 & 1;
  let g = a >> 2 & 1;
  let _ = a & 3;
  let v = sn[o * 16 * 4 + l * 16 + u];
  if (v === -1) {
    return {
      header: null,
      bytesAdvanced: 1
    };
  }
  let y = v * 1000;
  let b = on[d] >> o + s;
  let x = ln(o, l, y, b, f);
  if (t !== null && t < x) {
    return {
      header: null,
      bytesAdvanced: 1
    };
  }
  let S;
  if (c === 3) {
    if (l === 3) {
      S = 384;
    } else {
      S = 1152;
    }
  } else {
    if (l === 3) {
      S = 384;
    } else {
      if (l === 2) {
        S = 1152;
      } else {
        S = 576;
      }
    }
  }
  return {
    header: {
      totalSize: x,
      mpegVersionId: c,
      lowSamplingFrequency: o,
      layer: l,
      bitrate: y,
      frequencyIndex: d,
      sampleRate: b,
      channel: p,
      modeExtension: m,
      copyright: h,
      original: g,
      emphasis: _,
      audioSamplesInFrame: S
    },
    bytesAdvanced: 1
  };
};
var pn = e => {
  let t = 127;
  let n = 0;
  let r = e;
  while (t ^ 2147483647) {
    n = r & ~t;
    n <<= 1;
    n |= r & t;
    t = (t + 1 << 8) - 1;
    r = n;
  }
  return n;
};
var mn = e => {
  let t = 2130706432;
  let n = 0;
  while (t !== 0) {
    n >>= 1;
    n |= e & t;
    t >>= 8;
  }
  return n;
};
var hn;
(function (e) {
  e[e.FrameCount = 1] = `FrameCount`;
  e[e.FileSize = 2] = `FileSize`;
  e[e.Toc = 4] = `Toc`;
})(hn ||= {});
var gn = e => {
  if (e === 3) {
    return 1;
  } else {
    return 2;
  }
};
var _n = [48000, 44100, 32000];
var vn = [24000, 22050, 16000];
var P;
(function (e) {
  e[e.NON_IDR_SLICE = 1] = `NON_IDR_SLICE`;
  e[e.SLICE_DPA = 2] = `SLICE_DPA`;
  e[e.SLICE_DPB = 3] = `SLICE_DPB`;
  e[e.SLICE_DPC = 4] = `SLICE_DPC`;
  e[e.IDR = 5] = `IDR`;
  e[e.SEI = 6] = `SEI`;
  e[e.SPS = 7] = `SPS`;
  e[e.PPS = 8] = `PPS`;
  e[e.AUD = 9] = `AUD`;
  e[e.SPS_EXT = 13] = `SPS_EXT`;
})(P ||= {});
var F;
(function (e) {
  e[e.RASL_N = 8] = `RASL_N`;
  e[e.RASL_R = 9] = `RASL_R`;
  e[e.BLA_W_LP = 16] = `BLA_W_LP`;
  e[e.RSV_IRAP_VCL23 = 23] = `RSV_IRAP_VCL23`;
  e[e.VPS_NUT = 32] = `VPS_NUT`;
  e[e.SPS_NUT = 33] = `SPS_NUT`;
  e[e.PPS_NUT = 34] = `PPS_NUT`;
  e[e.AUD_NUT = 35] = `AUD_NUT`;
  e[e.PREFIX_SEI_NUT = 39] = `PREFIX_SEI_NUT`;
  e[e.SUFFIX_SEI_NUT = 40] = `SUFFIX_SEI_NUT`;
})(F ||= {});
function* yn(e) {
  let t = 0;
  let n = -1;
  while (t < e.length - 2) {
    let r = e.indexOf(0, t);
    if (r === -1 || r >= e.length - 2) {
      break;
    }
    t = r;
    let i = 0;
    if (t + 3 < e.length && e[t + 1] === 0 && e[t + 2] === 0 && e[t + 3] === 1) {
      i = 4;
    } else if (e[t + 1] === 0 && e[t + 2] === 1) {
      i = 3;
    }
    if (i === 0) {
      t++;
      continue;
    }
    if (n !== -1 && t > n) {
      yield {
        offset: n,
        length: t - n
      };
    }
    n = t + i;
    t = n;
  }
  if (n !== -1 && n < e.length) {
    yield {
      offset: n,
      length: e.length - n
    };
  }
}
function* bn(e, t) {
  let r = 0;
  let i = new DataView(e.buffer, e.byteOffset, e.byteLength);
  while (r + t <= e.length) {
    let e;
    if (t === 1) {
      e = i.getUint8(r);
    } else if (t === 2) {
      e = i.getUint16(r, false);
    } else if (t === 3) {
      e = ue(i, r, false);
    } else {
      n(t === 4);
      e = i.getUint32(r, false);
    }
    r += t;
    yield {
      offset: r,
      length: e
    };
    r += e;
  }
}
var xn = (e, t) => {
  if (t.description) {
    return bn(e, (l(t.description)[4] & 3) + 1);
  } else {
    return yn(e);
  }
};
var Sn = e => {
  return e & 31;
};
var Cn = e => {
  let t = [];
  let n = e.length;
  for (let r = 0; r < n; r++) {
    if (r + 2 < n && e[r] === 0 && e[r + 1] === 0 && e[r + 2] === 3) {
      t.push(0, 0);
      r += 2;
    } else {
      t.push(e[r]);
    }
  }
  return new Uint8Array(t);
};
var wn = new Uint8Array([0, 0, 0, 1]);
var Tn = e => {
  let t = e.reduce((e, t) => {
    return e + wn.byteLength + t.byteLength;
  }, 0);
  let n = new Uint8Array(t);
  let r = 0;
  for (let t of e) {
    n.set(wn, r);
    r += wn.byteLength;
    n.set(t, r);
    r += t.byteLength;
  }
  return n;
};
var En = (e, t) => {
  let n = e.reduce((e, n) => {
    return e + t + n.byteLength;
  }, 0);
  let r = new Uint8Array(n);
  let i = 0;
  for (let n of e) {
    let e = new DataView(r.buffer, r.byteOffset, r.byteLength);
    switch (t) {
      case 1:
        {
          e.setUint8(i, n.byteLength);
          break;
        }
      case 2:
        {
          e.setUint16(i, n.byteLength, false);
          break;
        }
      case 3:
        {
          fe(e, i, n.byteLength, false);
          break;
        }
      case 4:
        {
          e.setUint32(i, n.byteLength, false);
          break;
        }
    }
    i += t;
    r.set(n, i);
    i += n.byteLength;
  }
  return r;
};
var Dn = (e, t) => {
  if (t.description) {
    return En(e, (l(t.description)[4] & 3) + 1);
  } else {
    return Tn(e);
  }
};
var On = e => {
  try {
    let t = [];
    let r = [];
    let i = [];
    for (let n of yn(e)) {
      let a = e.subarray(n.offset, n.offset + n.length);
      let o = Sn(a[0]);
      if (o === P.SPS) {
        t.push(a);
      } else if (o === P.PPS) {
        r.push(a);
      } else if (o === P.SPS_EXT) {
        i.push(a);
      }
    }
    if (t.length === 0 || r.length === 0) {
      return null;
    }
    let a = t[0];
    let o = Mn(a);
    n(o !== null);
    let s = o.profileIdc === 100 || o.profileIdc === 110 || o.profileIdc === 122 || o.profileIdc === 144;
    return {
      configurationVersion: 1,
      avcProfileIndication: o.profileIdc,
      profileCompatibility: o.constraintFlags,
      avcLevelIndication: o.levelIdc,
      lengthSizeMinusOne: 3,
      sequenceParameterSets: t,
      pictureParameterSets: r,
      chromaFormat: s ? o.chromaFormatIdc : null,
      bitDepthLumaMinus8: s ? o.bitDepthLumaMinus8 : null,
      bitDepthChromaMinus8: s ? o.bitDepthChromaMinus8 : null,
      sequenceParameterSetExt: s ? i : null
    };
  } catch (e) {
    k._error(`Error building AVC Decoder Configuration Record:`, e);
    return null;
  }
};
var kn = e => {
  let t = [];
  t.push(e.configurationVersion);
  t.push(e.avcProfileIndication);
  t.push(e.profileCompatibility);
  t.push(e.avcLevelIndication);
  t.push(e.lengthSizeMinusOne & 3 | 252);
  t.push(e.sequenceParameterSets.length & 31 | 224);
  for (let n of e.sequenceParameterSets) {
    let e = n.byteLength;
    t.push(e >> 8);
    t.push(e & 255);
    for (let r = 0; r < e; r++) {
      t.push(n[r]);
    }
  }
  t.push(e.pictureParameterSets.length);
  for (let n of e.pictureParameterSets) {
    let e = n.byteLength;
    t.push(e >> 8);
    t.push(e & 255);
    for (let r = 0; r < e; r++) {
      t.push(n[r]);
    }
  }
  if (e.avcProfileIndication === 100 || e.avcProfileIndication === 110 || e.avcProfileIndication === 122 || e.avcProfileIndication === 144) {
    n(e.chromaFormat !== null);
    n(e.bitDepthLumaMinus8 !== null);
    n(e.bitDepthChromaMinus8 !== null);
    n(e.sequenceParameterSetExt !== null);
    t.push(e.chromaFormat & 3 | 252);
    t.push(e.bitDepthLumaMinus8 & 7 | 248);
    t.push(e.bitDepthChromaMinus8 & 7 | 248);
    t.push(e.sequenceParameterSetExt.length);
    for (let n of e.sequenceParameterSetExt) {
      let e = n.byteLength;
      t.push(e >> 8);
      t.push(e & 255);
      for (let r = 0; r < e; r++) {
        t.push(n[r]);
      }
    }
  }
  return new Uint8Array(t);
};
var An = e => {
  try {
    let t = u(e);
    let n = 0;
    let r = t.getUint8(n++);
    let i = t.getUint8(n++);
    let a = t.getUint8(n++);
    let o = t.getUint8(n++);
    let s = t.getUint8(n++) & 3;
    let c = t.getUint8(n++) & 31;
    let l = [];
    for (let r = 0; r < c; r++) {
      let r = t.getUint16(n, false);
      n += 2;
      l.push(e.subarray(n, n + r));
      n += r;
    }
    let d = t.getUint8(n++);
    let f = [];
    for (let r = 0; r < d; r++) {
      let r = t.getUint16(n, false);
      n += 2;
      f.push(e.subarray(n, n + r));
      n += r;
    }
    let p = {
      configurationVersion: r,
      avcProfileIndication: i,
      profileCompatibility: a,
      avcLevelIndication: o,
      lengthSizeMinusOne: s,
      sequenceParameterSets: l,
      pictureParameterSets: f,
      chromaFormat: null,
      bitDepthLumaMinus8: null,
      bitDepthChromaMinus8: null,
      sequenceParameterSetExt: null
    };
    if ((i === 100 || i === 110 || i === 122 || i === 144) && n + 4 <= e.length) {
      let r = t.getUint8(n++) & 3;
      let i = t.getUint8(n++) & 7;
      let a = t.getUint8(n++) & 7;
      let o = t.getUint8(n++);
      p.chromaFormat = r;
      p.bitDepthLumaMinus8 = i;
      p.bitDepthChromaMinus8 = a;
      let s = [];
      for (let r = 0; r < o; r++) {
        let r = t.getUint16(n, false);
        n += 2;
        s.push(e.subarray(n, n + r));
        n += r;
      }
      p.sequenceParameterSetExt = s;
    }
    return p;
  } catch (e) {
    k._error(`Error deserializing AVC Decoder Configuration Record:`, e);
    return null;
  }
};
var jn = {
  1: {
    num: 1,
    den: 1
  },
  2: {
    num: 12,
    den: 11
  },
  3: {
    num: 10,
    den: 11
  },
  4: {
    num: 16,
    den: 11
  },
  5: {
    num: 40,
    den: 33
  },
  6: {
    num: 24,
    den: 11
  },
  7: {
    num: 20,
    den: 11
  },
  8: {
    num: 32,
    den: 11
  },
  9: {
    num: 80,
    den: 33
  },
  10: {
    num: 18,
    den: 11
  },
  11: {
    num: 15,
    den: 11
  },
  12: {
    num: 64,
    den: 33
  },
  13: {
    num: 160,
    den: 99
  },
  14: {
    num: 4,
    den: 3
  },
  15: {
    num: 3,
    den: 2
  },
  16: {
    num: 2,
    den: 1
  }
};
var Mn = e => {
  try {
    let t = new A(Cn(e));
    t.skipBits(1);
    t.skipBits(2);
    if (t.readBits(5) !== 7) {
      return null;
    }
    let r = t.readAlignedByte();
    let a = t.readAlignedByte();
    let c = t.readAlignedByte();
    o(t);
    let l = 1;
    let u = 0;
    let d = 0;
    let f = 0;
    l = o(t);
    if (l === 3) {
      f = t.readBits(1);
    }
    u = o(t);
    d = o(t);
    t.skipBits(1);
    if ((r === 100 || r === 110 || r === 122 || r === 244 || r === 44 || r === 83 || r === 86 || r === 118 || r === 128) && t.readBits(1)) {
      for (let e = 0; e < (l === 3 ? 12 : 8); e++) {
        if (t.readBits(1)) {
          let n = e < 6 ? 16 : 64;
          let r = 8;
          let i = 8;
          for (let e = 0; e < n; e++) {
            if (i !== 0) {
              let e = s(t);
              i = (r + e + 256) % 256;
            }
            if (i === 0) {
              r = r;
            } else {
              r = i;
            }
          }
        }
      }
    }
    o(t);
    let p = o(t);
    if (p === 0) {
      o(t);
    } else if (p === 1) {
      t.skipBits(1);
      s(t);
      s(t);
      let e = o(t);
      for (let n = 0; n < e; n++) {
        s(t);
      }
    }
    o(t);
    t.skipBits(1);
    let m = o(t);
    let h = o(t);
    let g = (m + 1) * 16;
    let _ = (h + 1) * 16;
    let v = g;
    let y = _;
    let b = t.readBits(1);
    if (!b) {
      t.skipBits(1);
    }
    t.skipBits(1);
    if (t.readBits(1)) {
      let e = o(t);
      let n = o(t);
      let r = o(t);
      let i = o(t);
      let a;
      let s;
      if ((f === 0 ? l : 0) === 0) {
        a = 1;
        s = 2 - b;
      } else {
        let e = l === 3 ? 1 : 2;
        let t = l === 1 ? 2 : 1;
        a = e;
        s = t * (2 - b);
      }
      v -= a * (e + n);
      y -= s * (r + i);
    }
    let x = 2;
    let S = 2;
    let C = 2;
    let ee = 0;
    let w = {
      num: 1,
      den: 1
    };
    let te = null;
    let ne = null;
    if (t.readBits(1)) {
      if (t.readBits(1)) {
        let e = t.readBits(8);
        if (e === 255) {
          w = {
            num: t.readBits(16),
            den: t.readBits(16)
          };
        } else {
          let t = jn[e];
          if (t) {
            w = t;
          }
        }
      }
      if (t.readBits(1)) {
        t.skipBits(1);
      }
      if (t.readBits(1)) {
        t.skipBits(3);
        ee = t.readBits(1);
        if (t.readBits(1)) {
          x = t.readBits(8);
          S = t.readBits(8);
          C = t.readBits(8);
        }
      }
      if (t.readBits(1)) {
        o(t);
        o(t);
      }
      if (t.readBits(1)) {
        t.skipBits(32);
        t.skipBits(32);
        t.skipBits(1);
      }
      let e = t.readBits(1);
      if (e) {
        Nn(t);
      }
      let n = t.readBits(1);
      if (n) {
        Nn(t);
      }
      if (e || n) {
        t.skipBits(1);
      }
      t.skipBits(1);
      if (t.readBits(1)) {
        t.skipBits(1);
        o(t);
        o(t);
        o(t);
        o(t);
        te = o(t);
        ne = o(t);
      }
    }
    if (te === null) {
      n(ne === null);
      let e = a & 16;
      if ((r === 44 || r === 86 || r === 100 || r === 110 || r === 122 || r === 244) && e) {
        te = 0;
        ne = 0;
      } else {
        let e = m + 1;
        let t = h + 1;
        let n = (2 - b) * t;
        let r = kt.find(e => {
          return e.level >= c;
        }) ?? i(kt);
        let a = Math.min(Math.floor(r.maxDpbMbs / (e * n)), 16);
        te = a;
        ne = a;
      }
    }
    n(ne !== null);
    return {
      profileIdc: r,
      constraintFlags: a,
      levelIdc: c,
      frameMbsOnlyFlag: b,
      chromaFormatIdc: l,
      bitDepthLumaMinus8: u,
      bitDepthChromaMinus8: d,
      codedWidth: g,
      codedHeight: _,
      displayWidth: v,
      displayHeight: y,
      pixelAspectRatio: w,
      colourPrimaries: x,
      matrixCoefficients: C,
      transferCharacteristics: S,
      fullRangeFlag: ee,
      numReorderFrames: te,
      maxDecFrameBuffering: ne
    };
  } catch (e) {
    k._error(`Error parsing AVC SPS:`, e);
    return null;
  }
};
var Nn = e => {
  let t = o(e);
  e.skipBits(4);
  e.skipBits(4);
  for (let n = 0; n <= t; n++) {
    o(e);
    o(e);
    e.skipBits(1);
  }
  e.skipBits(5);
  e.skipBits(5);
  e.skipBits(5);
  e.skipBits(5);
};
var Pn = (e, t) => {
  if (t.description) {
    return En(e, (l(t.description)[21] & 3) + 1);
  } else {
    return Tn(e);
  }
};
var Fn = (e, t) => {
  if (t.description) {
    return bn(e, (l(t.description)[21] & 3) + 1);
  } else {
    return yn(e);
  }
};
var In = e => {
  return e >> 1 & 63;
};
var Ln = e => {
  try {
    let t = new A(Cn(e));
    t.skipBits(16);
    t.readBits(4);
    let n = t.readBits(3);
    let r = t.readBits(1);
    let {
      general_profile_space: i,
      general_tier_flag: a,
      general_profile_idc: s,
      general_profile_compatibility_flags: c,
      general_constraint_indicator_flags: l,
      general_level_idc: u
    } = zn(t, n);
    o(t);
    let d = o(t);
    let f = 0;
    if (d === 3) {
      f = t.readBits(1);
    }
    let p = o(t);
    let m = o(t);
    let h = p;
    let g = m;
    if (t.readBits(1)) {
      let e = o(t);
      let n = o(t);
      let r = o(t);
      let i = o(t);
      let a = 1;
      let s = 1;
      let c = f === 0 ? d : 0;
      if (c === 1) {
        a = 2;
        s = 2;
      } else if (c === 2) {
        a = 2;
        s = 1;
      }
      h -= (e + n) * a;
      g -= (r + i) * s;
    }
    let _ = o(t);
    let v = o(t);
    o(t);
    let y = t.readBits(1) ? 0 : n;
    let b = 0;
    for (let e = y; e <= n; e++) {
      o(t);
      b = o(t);
      o(t);
    }
    o(t);
    o(t);
    o(t);
    o(t);
    o(t);
    o(t);
    if (t.readBits(1) && t.readBits(1)) {
      Bn(t);
    }
    t.skipBits(1);
    t.skipBits(1);
    if (t.readBits(1)) {
      t.skipBits(4);
      t.skipBits(4);
      o(t);
      o(t);
      t.skipBits(1);
    }
    Vn(t, o(t));
    if (t.readBits(1)) {
      let e = o(t);
      for (let n = 0; n < e; n++) {
        o(t);
        t.skipBits(1);
      }
    }
    t.skipBits(1);
    t.skipBits(1);
    let x = 2;
    let S = 2;
    let C = 2;
    let ee = 0;
    let w = 0;
    let te = {
      num: 1,
      den: 1
    };
    if (t.readBits(1)) {
      let e = Un(t, n);
      te = e.pixelAspectRatio;
      x = e.colourPrimaries;
      S = e.transferCharacteristics;
      C = e.matrixCoefficients;
      ee = e.fullRangeFlag;
      w = e.minSpatialSegmentationIdc;
    }
    return {
      displayWidth: h,
      displayHeight: g,
      pixelAspectRatio: te,
      colourPrimaries: x,
      transferCharacteristics: S,
      matrixCoefficients: C,
      fullRangeFlag: ee,
      maxDecFrameBuffering: b + 1,
      spsMaxSubLayersMinus1: n,
      spsTemporalIdNestingFlag: r,
      generalProfileSpace: i,
      generalTierFlag: a,
      generalProfileIdc: s,
      generalProfileCompatibilityFlags: c,
      generalConstraintIndicatorFlags: l,
      generalLevelIdc: u,
      chromaFormatIdc: d,
      bitDepthLumaMinus8: _,
      bitDepthChromaMinus8: v,
      minSpatialSegmentationIdc: w
    };
  } catch (e) {
    k._error(`Error parsing HEVC SPS:`, e);
    return null;
  }
};
var Rn = e => {
  try {
    let t = [];
    let n = [];
    let r = [];
    let i = [];
    for (let a of yn(e)) {
      let o = e.subarray(a.offset, a.offset + a.length);
      let s = In(o[0]);
      if (s === F.VPS_NUT) {
        t.push(o);
      } else if (s === F.SPS_NUT) {
        n.push(o);
      } else if (s === F.PPS_NUT) {
        r.push(o);
      } else if (s === F.PREFIX_SEI_NUT || s === F.SUFFIX_SEI_NUT) {
        i.push(o);
      }
    }
    if (n.length === 0 || r.length === 0) {
      return null;
    }
    let a = Ln(n[0]);
    if (!a) {
      return null;
    }
    let c = 0;
    if (r.length > 0) {
      let e = r[0];
      let t = new A(Cn(e));
      t.skipBits(16);
      o(t);
      o(t);
      t.skipBits(1);
      t.skipBits(1);
      t.skipBits(3);
      t.skipBits(1);
      t.skipBits(1);
      o(t);
      o(t);
      s(t);
      t.skipBits(1);
      t.skipBits(1);
      if (t.readBits(1)) {
        o(t);
      }
      s(t);
      s(t);
      t.skipBits(1);
      t.skipBits(1);
      t.skipBits(1);
      t.skipBits(1);
      let n = t.readBits(1);
      let i = t.readBits(1);
      if (!n && !i) {
        c = 0;
      } else {
        if (n && !i) {
          c = 2;
        } else {
          if (!n && i) {
            c = 3;
          } else {
            c = 0;
          }
        }
      }
    }
    let l = [...(t.length ? [{
      arrayCompleteness: 1,
      nalUnitType: F.VPS_NUT,
      nalUnits: t
    }] : []), ...(n.length ? [{
      arrayCompleteness: 1,
      nalUnitType: F.SPS_NUT,
      nalUnits: n
    }] : []), ...(r.length ? [{
      arrayCompleteness: 1,
      nalUnitType: F.PPS_NUT,
      nalUnits: r
    }] : []), ...(i.length ? [{
      arrayCompleteness: 1,
      nalUnitType: In(i[0][0]),
      nalUnits: i
    }] : [])];
    return {
      configurationVersion: 1,
      generalProfileSpace: a.generalProfileSpace,
      generalTierFlag: a.generalTierFlag,
      generalProfileIdc: a.generalProfileIdc,
      generalProfileCompatibilityFlags: a.generalProfileCompatibilityFlags,
      generalConstraintIndicatorFlags: a.generalConstraintIndicatorFlags,
      generalLevelIdc: a.generalLevelIdc,
      minSpatialSegmentationIdc: a.minSpatialSegmentationIdc,
      parallelismType: c,
      chromaFormatIdc: a.chromaFormatIdc,
      bitDepthLumaMinus8: a.bitDepthLumaMinus8,
      bitDepthChromaMinus8: a.bitDepthChromaMinus8,
      avgFrameRate: 0,
      constantFrameRate: 0,
      numTemporalLayers: a.spsMaxSubLayersMinus1 + 1,
      temporalIdNested: a.spsTemporalIdNestingFlag,
      lengthSizeMinusOne: 3,
      arrays: l
    };
  } catch (e) {
    k._error(`Error building HEVC Decoder Configuration Record:`, e);
    return null;
  }
};
var zn = (e, t) => {
  let n = e.readBits(2);
  let r = e.readBits(1);
  let i = e.readBits(5);
  let a = 0;
  for (let t = 0; t < 32; t++) {
    a = a << 1 | e.readBits(1);
  }
  let o = new Uint8Array(6);
  for (let t = 0; t < 6; t++) {
    o[t] = e.readBits(8);
  }
  let s = e.readBits(8);
  let c = [];
  let l = [];
  for (let n = 0; n < t; n++) {
    c.push(e.readBits(1));
    l.push(e.readBits(1));
  }
  if (t > 0) {
    for (let n = t; n < 8; n++) {
      e.skipBits(2);
    }
  }
  for (let n = 0; n < t; n++) {
    if (c[n]) {
      e.skipBits(88);
    }
    if (l[n]) {
      e.skipBits(8);
    }
  }
  return {
    general_profile_space: n,
    general_tier_flag: r,
    general_profile_idc: i,
    general_profile_compatibility_flags: a,
    general_constraint_indicator_flags: o,
    general_level_idc: s
  };
};
var Bn = e => {
  for (let t = 0; t < 4; t++) {
    for (let n = 0; n < (t === 3 ? 2 : 6); n++) {
      if (!e.readBits(1)) {
        o(e);
      } else {
        let n = Math.min(64, 1 << 4 + (t << 1));
        if (t > 1) {
          s(e);
        }
        for (let t = 0; t < n; t++) {
          s(e);
        }
      }
    }
  }
};
var Vn = (e, t) => {
  let n = [];
  for (let r = 0; r < t; r++) {
    n[r] = Hn(e, r, t, n);
  }
};
var Hn = (e, t, n, r) => {
  let i = 0;
  let a = 0;
  let s = 0;
  if (t !== 0) {
    a = e.readBits(1);
  }
  if (a) {
    if (t === n) {
      s = t - (o(e) + 1);
    } else {
      s = t - 1;
    }
    e.readBits(1);
    o(e);
    let a = r[s] ?? 0;
    for (let t = 0; t <= a; t++) {
      if (!e.readBits(1)) {
        e.readBits(1);
      }
    }
    i = r[s];
  } else {
    let t = o(e);
    let n = o(e);
    for (let n = 0; n < t; n++) {
      o(e);
      e.readBits(1);
    }
    for (let t = 0; t < n; t++) {
      o(e);
      e.readBits(1);
    }
    i = t + n;
  }
  return i;
};
var Un = (e, t) => {
  let n = 2;
  let r = 2;
  let i = 2;
  let a = 0;
  let s = 0;
  let c = {
    num: 1,
    den: 1
  };
  if (e.readBits(1)) {
    let t = e.readBits(8);
    if (t === 255) {
      c = {
        num: e.readBits(16),
        den: e.readBits(16)
      };
    } else {
      let e = jn[t];
      if (e) {
        c = e;
      }
    }
  }
  if (e.readBits(1)) {
    e.readBits(1);
  }
  if (e.readBits(1)) {
    e.readBits(3);
    a = e.readBits(1);
    if (e.readBits(1)) {
      n = e.readBits(8);
      r = e.readBits(8);
      i = e.readBits(8);
    }
  }
  if (e.readBits(1)) {
    o(e);
    o(e);
  }
  e.readBits(1);
  e.readBits(1);
  e.readBits(1);
  if (e.readBits(1)) {
    o(e);
    o(e);
    o(e);
    o(e);
  }
  if (e.readBits(1)) {
    e.readBits(32);
    e.readBits(32);
    if (e.readBits(1)) {
      o(e);
    }
    if (e.readBits(1)) {
      Wn(e, true, t);
    }
  }
  if (e.readBits(1)) {
    e.readBits(1);
    e.readBits(1);
    e.readBits(1);
    s = o(e);
    o(e);
    o(e);
    o(e);
    o(e);
  }
  return {
    pixelAspectRatio: c,
    colourPrimaries: n,
    transferCharacteristics: r,
    matrixCoefficients: i,
    fullRangeFlag: a,
    minSpatialSegmentationIdc: s
  };
};
var Wn = (e, t, n) => {
  let r = false;
  let i = false;
  let a = false;
  if (t) {
    r = e.readBits(1) === 1;
    i = e.readBits(1) === 1;
    if (r || i) {
      a = e.readBits(1) === 1;
      if (a) {
        e.readBits(8);
        e.readBits(5);
        e.readBits(1);
        e.readBits(5);
      }
      e.readBits(4);
      e.readBits(4);
      if (a) {
        e.readBits(4);
      }
      e.readBits(5);
      e.readBits(5);
      e.readBits(5);
    }
  }
  for (let t = 0; t <= n; t++) {
    let t = e.readBits(1) === 1;
    let n = true;
    if (!t) {
      n = e.readBits(1) === 1;
    }
    let s = false;
    if (n) {
      o(e);
    } else {
      s = e.readBits(1) === 1;
    }
    let c = 1;
    if (!s) {
      c = o(e) + 1;
    }
    if (r) {
      Gn(e, c, a);
    }
    if (i) {
      Gn(e, c, a);
    }
  }
};
var Gn = (e, t, n) => {
  for (let r = 0; r < t; r++) {
    o(e);
    o(e);
    if (n) {
      o(e);
      o(e);
    }
    e.readBits(1);
  }
};
var Kn = e => {
  let t = [];
  t.push(e.configurationVersion);
  t.push((e.generalProfileSpace & 3) << 6 | (e.generalTierFlag & 1) << 5 | e.generalProfileIdc & 31);
  t.push(e.generalProfileCompatibilityFlags >>> 24 & 255);
  t.push(e.generalProfileCompatibilityFlags >>> 16 & 255);
  t.push(e.generalProfileCompatibilityFlags >>> 8 & 255);
  t.push(e.generalProfileCompatibilityFlags & 255);
  t.push(...e.generalConstraintIndicatorFlags);
  t.push(e.generalLevelIdc & 255);
  t.push(e.minSpatialSegmentationIdc >> 8 & 15 | 240);
  t.push(e.minSpatialSegmentationIdc & 255);
  t.push(e.parallelismType & 3 | 252);
  t.push(e.chromaFormatIdc & 3 | 252);
  t.push(e.bitDepthLumaMinus8 & 7 | 248);
  t.push(e.bitDepthChromaMinus8 & 7 | 248);
  t.push(e.avgFrameRate >> 8 & 255);
  t.push(e.avgFrameRate & 255);
  t.push((e.constantFrameRate & 3) << 6 | (e.numTemporalLayers & 7) << 3 | (e.temporalIdNested & 1) << 2 | e.lengthSizeMinusOne & 3);
  t.push(e.arrays.length & 255);
  for (let n of e.arrays) {
    t.push((n.arrayCompleteness & 1) << 7 | 0 | n.nalUnitType & 63);
    t.push(n.nalUnits.length >> 8 & 255);
    t.push(n.nalUnits.length & 255);
    for (let e of n.nalUnits) {
      t.push(e.length >> 8 & 255);
      t.push(e.length & 255);
      for (let n = 0; n < e.length; n++) {
        t.push(e[n]);
      }
    }
  }
  return new Uint8Array(t);
};
var qn = e => {
  try {
    let t = u(e);
    let n = 0;
    let r = t.getUint8(n++);
    let i = t.getUint8(n++);
    let a = i >> 6 & 3;
    let o = i >> 5 & 1;
    let s = i & 31;
    let c = t.getUint32(n, false);
    n += 4;
    let l = e.subarray(n, n + 6);
    n += 6;
    let d = t.getUint8(n++);
    let f = (t.getUint8(n++) & 15) << 8 | t.getUint8(n++);
    let p = t.getUint8(n++) & 3;
    let m = t.getUint8(n++) & 3;
    let h = t.getUint8(n++) & 7;
    let g = t.getUint8(n++) & 7;
    let _ = t.getUint16(n, false);
    n += 2;
    let v = t.getUint8(n++);
    let y = v >> 6 & 3;
    let b = v >> 3 & 7;
    let x = v >> 2 & 1;
    let S = v & 3;
    let C = t.getUint8(n++);
    let ee = [];
    for (let r = 0; r < C; r++) {
      let r = t.getUint8(n++);
      let i = r >> 7 & 1;
      let a = r & 63;
      let o = t.getUint16(n, false);
      n += 2;
      let s = [];
      for (let r = 0; r < o; r++) {
        let r = t.getUint16(n, false);
        n += 2;
        s.push(e.subarray(n, n + r));
        n += r;
      }
      ee.push({
        arrayCompleteness: i,
        nalUnitType: a,
        nalUnits: s
      });
    }
    return {
      configurationVersion: r,
      generalProfileSpace: a,
      generalTierFlag: o,
      generalProfileIdc: s,
      generalProfileCompatibilityFlags: c,
      generalConstraintIndicatorFlags: l,
      generalLevelIdc: d,
      minSpatialSegmentationIdc: f,
      parallelismType: p,
      chromaFormatIdc: m,
      bitDepthLumaMinus8: h,
      bitDepthChromaMinus8: g,
      avgFrameRate: _,
      constantFrameRate: y,
      numTemporalLayers: b,
      temporalIdNested: x,
      lengthSizeMinusOne: S,
      arrays: ee
    };
  } catch (e) {
    k._error(`Error deserializing HEVC Decoder Configuration Record:`, e);
    return null;
  }
};
var Jn;
(function (e) {
  e[e.audAllowed = 0] = `audAllowed`;
  e[e.beforeFirstVcl = 1] = `beforeFirstVcl`;
  e[e.afterFirstVcl = 2] = `afterFirstVcl`;
  e[e.eoBitstreamAllowed = 3] = `eoBitstreamAllowed`;
  e[e.noMoreDataAllowed = 4] = `noMoreDataAllowed`;
})(Jn ||= {});
var Yn = (e, t) => {
  let n = new Set();
  let r = Jn.audAllowed;
  for (let i of Fn(e, t)) {
    if (r === Jn.noMoreDataAllowed) {
      n.add(i.offset);
      continue;
    }
    let t = In(e[i.offset]);
    if (r === Jn.eoBitstreamAllowed && t !== 37) {
      n.add(i.offset);
      continue;
    }
    let a = false;
    if (t === 35) {
      if (r > Jn.audAllowed) {
        a = true;
      } else {
        r = Jn.beforeFirstVcl;
      }
    } else if (t <= 31) {
      if (r > Jn.afterFirstVcl) {
        a = true;
      } else {
        r = Jn.afterFirstVcl;
      }
    } else if (t === 36) {
      if (r === Jn.afterFirstVcl) {
        r = Jn.eoBitstreamAllowed;
      } else {
        a = true;
      }
    } else if (t === 37) {
      if (r < Jn.afterFirstVcl) {
        a = true;
      } else {
        r = Jn.noMoreDataAllowed;
      }
    } else if (t === 32 || t === 33 || t === 34 || t === 39 || t >= 41 && t <= 44 || t >= 48 && t <= 55) {
      if (r > Jn.beforeFirstVcl) {
        a = true;
      } else {
        r = Jn.beforeFirstVcl;
      }
    } else if ((t === 38 || t === 40 || t >= 45 && t <= 47 || t >= 56 && t <= 63) && r < Jn.afterFirstVcl) {
      a = true;
    }
    if (a) {
      n.add(i.offset);
    }
  }
  if (n.size === 0) {
    return null;
  }
  let i = [];
  for (let r of Fn(e, t)) {
    if (!n.has(r.offset)) {
      i.push(e.subarray(r.offset, r.offset + r.length));
    }
  }
  return Pn(i, t);
};
var Xn = e => {
  let t = new A(e);
  if (t.readBits(2) !== 2) {
    return null;
  }
  let n = t.readBits(1);
  let r = (t.readBits(1) << 1) + n;
  if (r === 3) {
    t.skipBits(1);
  }
  t.skipBits(2);
  if (t.readBits(1) === 1 || t.readBits(1) !== 0 || t.readBits(24) !== 4817730) {
    return null;
  }
  let a = 8;
  if (r >= 2) {
    if (t.readBits(1)) {
      a = 12;
    } else {
      a = 10;
    }
  }
  let o = t.readBits(3);
  let s = 0;
  let c = 0;
  if (o !== 7) {
    c = t.readBits(1);
    if (r === 1 || r === 3) {
      let e = t.readBits(1);
      let n = t.readBits(1);
      if (!e && !n) {
        s = 3;
      } else {
        if (e && !n) {
          s = 2;
        } else {
          s = 1;
        }
      }
      t.skipBits(1);
    } else {
      s = 1;
    }
  } else {
    s = 3;
    c = 1;
  }
  let l = t.readBits(16);
  let u = t.readBits(16);
  let d = (l + 1) * (u + 1);
  let f = i(jt).level;
  for (let e of jt) {
    if (d <= e.maxPictureSize) {
      f = e.level;
      break;
    }
  }
  return {
    profile: r,
    level: f,
    bitDepth: a,
    chromaSubsampling: s,
    videoFullRangeFlag: c,
    colourPrimaries: o === 2 ? 1 : o === 1 ? 6 : 2,
    transferCharacteristics: o === 2 ? 1 : o === 1 ? 6 : 2,
    matrixCoefficients: o === 7 ? 0 : o === 2 ? 1 : o === 1 ? 6 : 2
  };
};
function* Zn(e) {
  let t = new A(e);
  let r = () => {
    let e = 0;
    for (let n = 0; n < 8; n++) {
      let r = t.readAlignedByte();
      e |= (r & 127) << n * 7;
      if (!(r & 128)) {
        break;
      }
      if (n === 7 && r & 128) {
        return null;
      }
    }
    if (e >= 4294967295) {
      return null;
    } else {
      return e;
    }
  };
  while (t.getBitsLeft() >= 8) {
    t.skipBits(1);
    let i = t.readBits(4);
    let a = t.readBits(1);
    let o = t.readBits(1);
    t.skipBits(1);
    if (a) {
      t.skipBits(8);
    }
    let s;
    if (o) {
      let e = r();
      if (e === null) {
        return;
      }
      s = e;
    } else {
      s = Math.floor(t.getBitsLeft() / 8);
    }
    n(t.pos % 8 == 0);
    yield {
      type: i,
      data: e.subarray(t.pos / 8, t.pos / 8 + s)
    };
    t.skipBits(s * 8);
  }
}
var Qn = e => {
  for (let {
    type: t,
    data: n
  } of Zn(e)) {
    if (t !== 1) {
      continue;
    }
    let e = new A(n);
    let r = e.readBits(3);
    e.readBits(1);
    let i = e.readBits(1);
    let a = 0;
    let o = 0;
    let s = 0;
    if (i) {
      a = e.readBits(5);
    } else {
      e.skipBits(32);
      e.skipBits(32);
      if (e.readBits(1) && e.readBits(1)) {
        return null;
      }
      let t = e.readBits(1);
      if (t) {
        s = e.readBits(5);
        e.skipBits(32);
        e.skipBits(5);
        e.skipBits(5);
      }
      let n = e.readBits(5);
      for (let r = 0; r <= n; r++) {
        e.skipBits(12);
        let n = e.readBits(5);
        if (r === 0) {
          a = n;
        }
        if (n > 7) {
          let t = e.readBits(1);
          if (r === 0) {
            o = t;
          }
        }
        if (t && e.readBits(1)) {
          let t = s + 1;
          e.skipBits(t);
          e.skipBits(t);
          e.skipBits(1);
        }
        if (e.readBits(1)) {
          e.skipBits(4);
        }
      }
    }
    let c = e.readBits(4);
    let l = e.readBits(4);
    let u = c + 1;
    e.skipBits(u);
    let d = l + 1;
    e.skipBits(d);
    let f = 0;
    if (i) {
      f = 0;
    } else {
      f = e.readBits(1);
    }
    if (f) {
      e.skipBits(4);
      e.skipBits(3);
    }
    e.skipBits(1);
    e.skipBits(1);
    e.skipBits(1);
    if (!i) {
      e.skipBits(1);
      e.skipBits(1);
      e.skipBits(1);
      e.skipBits(1);
      let t = e.readBits(1);
      if (t) {
        e.skipBits(1);
        e.skipBits(1);
      }
      let n = e.readBits(1);
      let r = 0;
      if (n) {
        r = 2;
      } else {
        r = e.readBits(1);
      }
      if (r > 0) {
        if (!e.readBits(1)) {
          e.skipBits(1);
        }
      }
      if (t) {
        e.skipBits(3);
      }
    }
    e.skipBits(1);
    e.skipBits(1);
    e.skipBits(1);
    let p = e.readBits(1);
    let m = 8;
    if (r === 2 && p) {
      if (e.readBits(1)) {
        m = 12;
      } else {
        m = 10;
      }
    } else if (r <= 2) {
      if (p) {
        m = 10;
      } else {
        m = 8;
      }
    }
    let h = 0;
    if (r !== 1) {
      h = e.readBits(1);
    }
    let g = 1;
    let _ = 1;
    let v = 0;
    if (!h) {
      if (r === 0) {
        g = 1;
        _ = 1;
      } else if (r === 1) {
        g = 0;
        _ = 0;
      } else if (m === 12) {
        g = e.readBits(1);
        if (g) {
          _ = e.readBits(1);
        }
      }
      if (g && _) {
        v = e.readBits(2);
      }
    }
    return {
      profile: r,
      level: a,
      tier: o,
      bitDepth: m,
      monochrome: h,
      chromaSubsamplingX: g,
      chromaSubsamplingY: _,
      chromaSamplePosition: v
    };
  }
  return null;
};
var $n = e => {
  let t = u(e);
  let n = t.getUint8(9);
  let r = t.getUint16(10, true);
  let i = t.getUint32(12, true);
  let a = t.getInt16(16, true);
  let o = t.getUint8(18);
  let s = null;
  if (o) {
    s = e.subarray(19, 21 + n);
  }
  return {
    outputChannelCount: n,
    preSkip: r,
    inputSampleRate: i,
    outputGain: a,
    channelMappingFamily: o,
    channelMappingTable: s
  };
};
var er = [480, 960, 1920, 2880, 480, 960, 1920, 2880, 480, 960, 1920, 2880, 480, 960, 480, 960, 120, 240, 480, 960, 120, 240, 480, 960, 120, 240, 480, 960, 120, 240, 480, 960];
var tr = e => {
  return {
    durationInSamples: er[e[0] >> 3]
  };
};
var nr = e => {
  if (e.length < 7) {
    throw Error(`Setup header is too short.`);
  }
  if (e[0] !== 5) {
    throw Error(`Wrong packet type in Setup header.`);
  }
  if (String.fromCharCode(...e.slice(1, 7)) !== `vorbis`) {
    throw Error(`Invalid packet signature in Setup header.`);
  }
  let t = e.length;
  let n = new Uint8Array(t);
  for (let r = 0; r < t; r++) {
    n[r] = e[t - 1 - r];
  }
  let r = new A(n);
  let i = 0;
  while (r.getBitsLeft() > 97) {
    if (r.readBits(1) === 1) {
      i = r.pos;
      break;
    }
  }
  if (i === 0) {
    throw Error(`Invalid Setup header: framing bit not found.`);
  }
  let a = 0;
  let o = false;
  let s = 0;
  while (r.getBitsLeft() >= 97) {
    let e = r.pos;
    let t = r.readBits(8);
    let n = r.readBits(16);
    let i = r.readBits(16);
    if (t > 63 || n !== 0 || i !== 0) {
      r.pos = e;
      break;
    }
    r.skipBits(1);
    a++;
    if (a > 64) {
      break;
    }
    if (r.clone().readBits(6) + 1 === a) {
      o = true;
      s = a;
    }
  }
  if (!o) {
    throw Error(`Invalid Setup header: mode header not found.`);
  }
  if (s > 63) {
    throw Error(`Unsupported mode count: ${s}.`);
  }
  let c = s;
  r.pos = 0;
  r.skipBits(i);
  let l = Array(c).fill(0);
  for (let e = c - 1; e >= 0; e--) {
    r.skipBits(40);
    l[e] = r.readBits(1);
  }
  return {
    modeBlockflags: l
  };
};
var rr = (e, t, r) => {
  switch (e) {
    case `avc`:
      {
        for (let e of xn(r, t)) {
          let t = r[e.offset];
          let n = Sn(t);
          if (n >= P.NON_IDR_SLICE && n <= P.SLICE_DPC) {
            return `delta`;
          }
          if (n === P.IDR) {
            return `key`;
          }
          if (n === P.SEI && (!Fe() || Le() >= 144)) {
            let t = Cn(r.subarray(e.offset, e.offset + e.length));
            let n = 1;
            do {
              let e = 0;
              while (true) {
                let r = t[n++];
                e += r;
                if (r === undefined || r < 255) {
                  break;
                }
              }
              let r = 0;
              while (true) {
                let e = t[n++];
                r += e;
                if (e === undefined || e < 255) {
                  break;
                }
              }
              if (e === 6) {
                let e = new A(t);
                e.pos = n * 8;
                let r = o(e);
                let i = e.readBits(1);
                if (r === 0 && i === 1) {
                  return `key`;
                }
              }
              n += r;
            } while (n < t.length - 1);
          }
        }
        return `delta`;
      }
    case `hevc`:
      {
        for (let e of Fn(r, t)) {
          let t = In(r[e.offset]);
          if (t < F.BLA_W_LP) {
            return `delta`;
          }
          if (t <= F.RSV_IRAP_VCL23) {
            return `key`;
          }
        }
        return `delta`;
      }
    case `vp8`:
      {
        if (r[0] & 1) {
          return `delta`;
        } else {
          return `key`;
        }
      }
    case `vp9`:
      {
        let e = new A(r);
        if (e.readBits(2) !== 2) {
          return null;
        }
        let t = e.readBits(1);
        if ((e.readBits(1) << 1) + t === 3) {
          e.skipBits(1);
        }
        if (e.readBits(1)) {
          return null;
        } else if (e.readBits(1) === 0) {
          return `key`;
        } else {
          return `delta`;
        }
      }
    case `av1`:
      {
        let e = false;
        for (let {
          type: t,
          data: n
        } of Zn(r)) {
          if (t === 1) {
            let t = new A(n);
            t.skipBits(4);
            e = !!t.readBits(1);
          } else if (t === 3 || t === 6 || t === 7) {
            if (e) {
              return `key`;
            }
            let t = new A(n);
            if (t.readBits(1)) {
              return null;
            } else if (t.readBits(2) === 0) {
              return `key`;
            } else {
              return `delta`;
            }
          }
        }
        return null;
      }
    case `prores`:
      {
        return `key`;
      }
    default:
      {
        D(e);
        n(false);
      }
  }
};
var ir;
(function (e) {
  e[e.STREAMINFO = 0] = `STREAMINFO`;
  e[e.VORBIS_COMMENT = 4] = `VORBIS_COMMENT`;
  e[e.PICTURE = 6] = `PICTURE`;
})(ir ||= {});
var ar = (e, t) => {
  let n = u(e);
  let r = 0;
  let i = n.getUint32(r, true);
  r += 4;
  let a = d.decode(e.subarray(r, r + i));
  r += i;
  if (i > 0) {
    t.raw ??= {};
    t.raw.vendor ??= a;
  }
  let o = n.getUint32(r, true);
  r += 4;
  for (let i = 0; i < o; i++) {
    let i = n.getUint32(r, true);
    r += 4;
    let a = d.decode(e.subarray(r, r + i));
    r += i;
    let o = a.indexOf(`=`);
    if (o === -1) {
      continue;
    }
    let s = a.slice(0, o).toUpperCase();
    let c = a.slice(o + 1);
    t.raw ??= {};
    t.raw[s] ??= c;
    switch (s) {
      case `TITLE`:
        {
          t.title ??= c;
          break;
        }
      case `DESCRIPTION`:
        {
          t.description ??= c;
          break;
        }
      case `ARTIST`:
        {
          t.artist ??= c;
          break;
        }
      case `ALBUM`:
        {
          t.album ??= c;
          break;
        }
      case `ALBUMARTIST`:
        {
          t.albumArtist ??= c;
          break;
        }
      case `COMMENT`:
        {
          t.comment ??= c;
          break;
        }
      case `LYRICS`:
        {
          t.lyrics ??= c;
          break;
        }
      case `TRACKNUMBER`:
        {
          let e = c.split(`/`);
          let n = Number.parseInt(e[0], 10);
          let r = e[1] && Number.parseInt(e[1], 10);
          if (Number.isInteger(n) && n > 0) {
            t.trackNumber ??= n;
          }
          if (r && Number.isInteger(r) && r > 0) {
            t.tracksTotal ??= r;
          }
        }
        break;
      case `TRACKTOTAL`:
        {
          let e = Number.parseInt(c, 10);
          if (Number.isInteger(e) && e > 0) {
            t.tracksTotal ??= e;
          }
        }
        break;
      case `DISCNUMBER`:
        {
          let e = c.split(`/`);
          let n = Number.parseInt(e[0], 10);
          let r = e[1] && Number.parseInt(e[1], 10);
          if (Number.isInteger(n) && n > 0) {
            t.discNumber ??= n;
          }
          if (r && Number.isInteger(r) && r > 0) {
            t.discsTotal ??= r;
          }
        }
        break;
      case `DISCTOTAL`:
        {
          let e = Number.parseInt(c, 10);
          if (Number.isInteger(e) && e > 0) {
            t.discsTotal ??= e;
          }
        }
        break;
      case `DATE`:
        {
          let e = new Date(c);
          if (!Number.isNaN(e.getTime())) {
            t.date ??= e;
          }
        }
        break;
      case `GENRE`:
        {
          t.genre ??= c;
          break;
        }
      case `METADATA_BLOCK_PICTURE`:
        {
          let e = He(c);
          let n = u(e);
          let r = n.getUint32(0, false);
          let i = n.getUint32(4, false);
          let a = String.fromCharCode(...e.subarray(8, 8 + i));
          let o = n.getUint32(8 + i, false);
          let s = d.decode(e.subarray(12 + i, 12 + i + o));
          let l = n.getUint32(i + o + 28);
          let f = e.subarray(i + o + 32, i + o + 32 + l);
          t.images ??= [];
          t.images.push({
            data: f,
            mimeType: a,
            kind: r === 3 ? `coverFront` : r === 4 ? `coverBack` : `unknown`,
            name: undefined,
            description: s || undefined
          });
        }
        break;
    }
  }
};
var or = (e, t, n) => {
  let r = [e];
  let i = f.encode(`Mediabunny`);
  let a = new Uint8Array(4 + i.length);
  let o = new DataView(a.buffer);
  o.setUint32(0, i.length, true);
  a.set(i, 4);
  r.push(a);
  let s = new Set();
  let c = (e, t) => {
    let n = `${e}=${t}`;
    let i = f.encode(n);
    a = new Uint8Array(4 + i.length);
    o = new DataView(a.buffer);
    o.setUint32(0, i.length, true);
    a.set(i, 4);
    r.push(a);
    s.add(e);
  };
  for (let {
    key: e,
    value: r
  } of Be(t)) {
    switch (e) {
      case `title`:
        {
          c(`TITLE`, r);
          break;
        }
      case `description`:
        {
          c(`DESCRIPTION`, r);
          break;
        }
      case `artist`:
        {
          c(`ARTIST`, r);
          break;
        }
      case `album`:
        {
          c(`ALBUM`, r);
          break;
        }
      case `albumArtist`:
        {
          c(`ALBUMARTIST`, r);
          break;
        }
      case `genre`:
        {
          c(`GENRE`, r);
          break;
        }
      case `date`:
        {
          let e = t.raw?.DATE ?? t.raw?.date;
          if (e && typeof e == `string`) {
            c(`DATE`, e);
          } else {
            c(`DATE`, r.toISOString().slice(0, 10));
          }
        }
        break;
      case `comment`:
        {
          c(`COMMENT`, r);
          break;
        }
      case `lyrics`:
        {
          c(`LYRICS`, r);
          break;
        }
      case `trackNumber`:
        {
          c(`TRACKNUMBER`, r.toString());
          break;
        }
      case `tracksTotal`:
        {
          c(`TRACKTOTAL`, r.toString());
          break;
        }
      case `discNumber`:
        {
          c(`DISCNUMBER`, r.toString());
          break;
        }
      case `discsTotal`:
        {
          c(`DISCTOTAL`, r.toString());
          break;
        }
      case `images`:
        {
          if (!n) {
            break;
          }
          for (let e of r) {
            let t = e.kind === `coverFront` ? 3 : e.kind === `coverBack` ? 4 : 0;
            let n = new Uint8Array(e.mimeType.length);
            for (let t = 0; t < e.mimeType.length; t++) {
              n[t] = e.mimeType.charCodeAt(t);
            }
            let r = f.encode(e.description ?? ``);
            let i = new Uint8Array(8 + n.length + 4 + r.length + 16 + 4 + e.data.length);
            let a = u(i);
            a.setUint32(0, t, false);
            a.setUint32(4, n.length, false);
            i.set(n, 8);
            a.setUint32(8 + n.length, r.length, false);
            i.set(r, 12 + n.length);
            a.setUint32(28 + n.length + r.length, e.data.length, false);
            i.set(e.data, 32 + n.length + r.length);
            c(`METADATA_BLOCK_PICTURE`, Ue(i));
          }
          break;
        }
      case `raw`:
        {
          break;
        }
      default:
        {
          D(e);
        }
    }
  }
  if (t.raw) {
    for (let e in t.raw) {
      let n = t.raw[e] ?? t.raw[e.toLowerCase()];
      if (e !== `vendor` && n != null && !s.has(e)) {
        if (typeof n == `string`) {
          c(e, n);
        }
      }
    }
  }
  let l = new Uint8Array(4);
  u(l).setUint32(0, s.size, true);
  r.splice(2, 0, l);
  let d = r.reduce((e, t) => {
    return e + t.length;
  }, 0);
  let p = new Uint8Array(d);
  let m = 0;
  for (let e of r) {
    p.set(e, m);
    m += e.length;
  }
  return p;
};
var sr = [2, 1, 2, 3, 3, 4, 4, 5];
var cr = e => {
  if (e.length < 7 || e[0] !== 11 || e[1] !== 119) {
    return null;
  }
  let t = new A(e);
  t.skipBits(16);
  t.skipBits(16);
  let n = t.readBits(2);
  if (n === 3) {
    return null;
  }
  let r = t.readBits(6);
  let i = t.readBits(5);
  if (i > 8) {
    return null;
  }
  let a = t.readBits(3);
  let o = t.readBits(3);
  if (o & 1 && o !== 1) {
    t.skipBits(2);
  }
  if (o & 4) {
    t.skipBits(2);
  }
  if (o === 2) {
    t.skipBits(2);
  }
  return {
    fscod: n,
    bsid: i,
    bsmod: a,
    acmod: o,
    lfeon: t.readBits(1),
    bitRateCode: Math.floor(r / 2)
  };
};
var lr = [128, 138, 192, 128, 140, 192, 160, 174, 240, 160, 176, 240, 192, 208, 288, 192, 210, 288, 224, 242, 336, 224, 244, 336, 256, 278, 384, 256, 280, 384, 320, 348, 480, 320, 350, 480, 384, 416, 576, 384, 418, 576, 448, 486, 672, 448, 488, 672, 512, 556, 768, 512, 558, 768, 640, 696, 960, 640, 698, 960, 768, 834, 1152, 768, 836, 1152, 896, 974, 1344, 896, 976, 1344, 1024, 1114, 1536, 1024, 1116, 1536, 1280, 1392, 1920, 1280, 1394, 1920, 1536, 1670, 2304, 1536, 1672, 2304, 1792, 1950, 2688, 1792, 1952, 2688, 2048, 2228, 3072, 2048, 2230, 3072, 2304, 2506, 3456, 2304, 2508, 3456, 2560, 2786, 3840, 2560, 2788, 3840];
var ur = 1536;
var dr = new Uint8Array([5, 4, 65, 67, 45, 51]);
var fr = new Uint8Array([5, 4, 69, 65, 67, 51]);
var pr = [1, 2, 3, 6];
var mr = e => {
  if (e.length < 6 || e[0] !== 11 || e[1] !== 119) {
    return null;
  }
  let t = new A(e);
  t.skipBits(16);
  let n = t.readBits(2);
  t.skipBits(3);
  if (n !== 0 && n !== 2) {
    return null;
  }
  let r = t.readBits(11);
  let i = t.readBits(2);
  let a = 0;
  let o;
  if (i === 3) {
    a = t.readBits(2);
    o = 3;
  } else {
    o = t.readBits(2);
  }
  let s = t.readBits(3);
  let c = t.readBits(1);
  let l = t.readBits(5);
  if (l < 11 || l > 16) {
    return null;
  }
  let u = pr[o];
  let d;
  if (i < 3) {
    d = _n[i] / 1000;
  } else {
    d = vn[a] / 1000;
  }
  return {
    dataRate: Math.round((r + 1) * d / (u * 16)),
    substreams: [{
      fscod: i,
      fscod2: a,
      bsid: l,
      bsmod: 0,
      acmod: s,
      lfeon: c,
      numDepSub: 0,
      chanLoc: 0
    }]
  };
};
var hr = e => {
  if (e.length < 2) {
    return null;
  }
  let t = new A(e);
  let n = t.readBits(13);
  let r = t.readBits(3);
  let i = [];
  for (let n = 0; n <= r && !(Math.ceil(t.pos / 8) + 3 > e.length); n++) {
    let e = t.readBits(2);
    let n = t.readBits(5);
    t.skipBits(1);
    t.skipBits(1);
    let r = t.readBits(3);
    let a = t.readBits(3);
    let o = t.readBits(1);
    t.skipBits(3);
    let s = t.readBits(4);
    let c = 0;
    if (s > 0) {
      c = t.readBits(9);
    } else {
      t.skipBits(1);
    }
    i.push({
      fscod: e,
      fscod2: null,
      bsid: n,
      bsmod: r,
      acmod: a,
      lfeon: o,
      numDepSub: s,
      chanLoc: c
    });
  }
  if (i.length === 0) {
    return null;
  } else {
    return {
      dataRate: n,
      substreams: i
    };
  }
};
var gr = e => {
  let t = e.substreams[0];
  n(t);
  if (t.fscod < 3) {
    return _n[t.fscod];
  } else if (t.fscod2 !== null && t.fscod2 < 3) {
    return vn[t.fscod2];
  } else {
    return null;
  }
};
var _r = e => {
  let t = e.substreams[0];
  n(t);
  let r = sr[t.acmod] + t.lfeon;
  if (t.numDepSub > 0) {
    let e = [2, 2, 1, 1, 2, 2, 2, 1, 1];
    for (let n = 0; n < 9; n++) {
      if (t.chanLoc & 1 << 8 - n) {
        r += e[n];
      }
    }
  }
  return r;
};
var vr = class {
  constructor(e) {
    this.input = e;
  }
  dispose() {}
};
var yr = new Uint8Array();
var I = class e {
  constructor(e, t, n, r, i = -1, a, o) {
    this.data = e;
    this.type = t;
    this.timestamp = n;
    this.duration = r;
    this.sequenceNumber = i;
    if (e === yr && a === undefined) {
      throw Error(`Internal error: byteLength must be explicitly provided when constructing metadata-only packets.`);
    }
    if (a === undefined) {
      a = e.byteLength;
    }
    if (!(e instanceof Uint8Array)) {
      throw TypeError(`data must be a Uint8Array.`);
    }
    if (t !== `key` && t !== `delta`) {
      throw TypeError(`type must be either "key" or "delta".`);
    }
    if (!Number.isFinite(n)) {
      throw TypeError(`timestamp must be a number.`);
    }
    if (!Number.isFinite(r) || r < 0) {
      throw TypeError(`duration must be a non-negative number.`);
    }
    if (!Number.isFinite(i)) {
      throw TypeError(`sequenceNumber must be a number.`);
    }
    if (!Number.isInteger(a) || a < 0) {
      throw TypeError(`byteLength must be a non-negative integer.`);
    }
    if (o !== undefined && (typeof o != `object` || !o)) {
      throw TypeError(`sideData, when provided, must be an object.`);
    }
    if (o?.alpha !== undefined && !(o.alpha instanceof Uint8Array)) {
      throw TypeError(`sideData.alpha, when provided, must be a Uint8Array.`);
    }
    if (o?.alphaByteLength !== undefined && (!Number.isInteger(o.alphaByteLength) || o.alphaByteLength < 0)) {
      throw TypeError(`sideData.alphaByteLength, when provided, must be a non-negative integer.`);
    }
    this.byteLength = a;
    this.sideData = o ?? {};
    if (this.sideData.alpha && this.sideData.alphaByteLength === undefined) {
      this.sideData.alphaByteLength = this.sideData.alpha.byteLength;
    }
  }
  get isMetadataOnly() {
    return this.data === yr;
  }
  get microsecondTimestamp() {
    return Math.trunc(we * this.timestamp);
  }
  get microsecondDuration() {
    return Math.trunc(we * this.duration);
  }
  toEncodedVideoChunk() {
    if (this.isMetadataOnly) {
      throw TypeError(`Metadata-only packets cannot be converted to a video chunk.`);
    }
    if (typeof EncodedVideoChunk > `u`) {
      throw Error(`Your browser does not support EncodedVideoChunk.`);
    }
    return new EncodedVideoChunk({
      data: this.data,
      type: this.type,
      timestamp: this.microsecondTimestamp,
      duration: this.microsecondDuration
    });
  }
  alphaToEncodedVideoChunk(e = this.type) {
    if (!this.sideData.alpha) {
      throw TypeError(`This packet does not contain alpha side data.`);
    }
    if (this.isMetadataOnly) {
      throw TypeError(`Metadata-only packets cannot be converted to a video chunk.`);
    }
    if (typeof EncodedVideoChunk > `u`) {
      throw Error(`Your browser does not support EncodedVideoChunk.`);
    }
    return new EncodedVideoChunk({
      data: this.sideData.alpha,
      type: e,
      timestamp: this.microsecondTimestamp,
      duration: this.microsecondDuration
    });
  }
  toEncodedAudioChunk() {
    if (this.isMetadataOnly) {
      throw TypeError(`Metadata-only packets cannot be converted to an audio chunk.`);
    }
    if (typeof EncodedAudioChunk > `u`) {
      throw Error(`Your browser does not support EncodedAudioChunk.`);
    }
    return new EncodedAudioChunk({
      data: this.data,
      type: this.type,
      timestamp: this.microsecondTimestamp,
      duration: this.microsecondDuration
    });
  }
  static fromEncodedChunk(t, n) {
    if (!(t instanceof EncodedVideoChunk) && !(t instanceof EncodedAudioChunk)) {
      throw TypeError(`chunk must be an EncodedVideoChunk or EncodedAudioChunk.`);
    }
    let r = new Uint8Array(t.byteLength);
    t.copyTo(r);
    return new e(r, t.type, t.timestamp / 1000000, (t.duration ?? 0) / 1000000, undefined, undefined, n);
  }
  clone(t) {
    if (t !== undefined && (typeof t != `object` || !t)) {
      throw TypeError(`options, when provided, must be an object.`);
    }
    if (t?.data !== undefined && !(t.data instanceof Uint8Array)) {
      throw TypeError(`options.data, when provided, must be a Uint8Array.`);
    }
    if (t?.type !== undefined && t.type !== `key` && t.type !== `delta`) {
      throw TypeError(`options.type, when provided, must be either "key" or "delta".`);
    }
    if (t?.timestamp !== undefined && !Number.isFinite(t.timestamp)) {
      throw TypeError(`options.timestamp, when provided, must be a number.`);
    }
    if (t?.duration !== undefined && !Number.isFinite(t.duration)) {
      throw TypeError(`options.duration, when provided, must be a number.`);
    }
    if (t?.sequenceNumber !== undefined && !Number.isFinite(t.sequenceNumber)) {
      throw TypeError(`options.sequenceNumber, when provided, must be a number.`);
    }
    if (t?.sideData !== undefined && (typeof t.sideData != `object` || t.sideData === null)) {
      throw TypeError(`options.sideData, when provided, must be an object.`);
    }
    return new e(t?.data ?? this.data, t?.type ?? this.type, t?.timestamp ?? this.timestamp, t?.duration ?? this.duration, t?.sequenceNumber ?? this.sequenceNumber, this.byteLength, t?.sideData ?? this.sideData);
  }
};
var br = e => {
  let t = (e.hasVideo ? `video/` : e.hasAudio ? `audio/` : `application/`) + (e.isQuickTime ? `quicktime` : `mp4`);
  if (e.codecStrings.length > 0) {
    let n = [...new Set(e.codecStrings)];
    t += `; codecs="${n.join(`, `)}"`;
  }
  return t;
};
var xr = e => {
  let t = u(e);
  let n = 0;
  let r = t.getUint8(n);
  n += 1;
  n += 3;
  let i = w(e.subarray(n, n + 16));
  n += 16;
  let a = null;
  if (r > 0) {
    let r = t.getUint32(n);
    n += 4;
    if (r > 0) {
      a = [];
      for (let t = 0; t < r; t++) {
        a.push(w(e.subarray(n, n + 16)));
        n += 16;
      }
    }
  }
  let o = t.getUint32(n);
  n += 4;
  return {
    systemId: i,
    keyIds: a,
    data: e.slice(n, n + o)
  };
};
var Sr = (e, t) => {
  return e.systemId === t.systemId && We(e.data, t.data);
};
var Cr = e => {
  let t = U(e);
  let n = W(e, 4);
  let r = 8;
  if (t === 1) {
    t = Sl(e);
    r = 16;
  }
  let i = t - r;
  if (i < 0) {
    return null;
  } else {
    return {
      name: n,
      totalSize: t,
      headerSize: r,
      contentSize: i
    };
  }
};
var wr = e => {
  return yl(e) / 65536;
};
var Tr = e => {
  return yl(e) / 1073741824;
};
var Er = e => {
  let t = 0;
  for (let n = 0; n < 4; n++) {
    t <<= 7;
    let n = V(e);
    t |= n & 127;
    if (!(n & 128)) {
      break;
    }
  }
  return t;
};
var Dr = e => {
  let t = H(e);
  e.skip(2);
  t = Math.min(t, e.remainingLength);
  return d.decode(B(e, t));
};
var Or = e => {
  let t = Cr(e);
  if (!t || t.name !== `data` || e.remainingLength < 8) {
    return null;
  }
  let n = U(e);
  e.skip(4);
  let r = B(e, t.contentSize - 8);
  switch (n) {
    case 1:
      {
        return d.decode(r);
      }
    case 2:
      {
        return new TextDecoder(`utf-16be`).decode(r);
      }
    case 13:
      {
        return new ht(r, `image/jpeg`);
      }
    case 14:
      {
        return new ht(r, `image/png`);
      }
    case 27:
      {
        return new ht(r, `image/bmp`);
      }
    default:
      {
        return r;
      }
  }
};
var kr = new Uint32Array(256);
var Ar = new Uint32Array(256);
var jr = new Uint32Array(256);
var Mr = new Uint32Array(256);
var Nr = new Uint32Array(256);
var Pr = new Uint32Array(256);
var Fr = new Uint32Array(10);
var Ir = false;
var Lr = () => {
  let e = new Uint8Array(256);
  let t = new Uint8Array(256);
  let n = new Uint8Array(256);
  for (let e = 0, r = 1; e < 256; e++) {
    n[e] = r;
    t[r] = e;
    r = r ^ r << 1 ^ (r & 128 ? 283 : 0);
  }
  let r = (e, r) => {
    if (e && r) {
      return n[(t[e] + t[r]) % 255];
    } else {
      return 0;
    }
  };
  e[0] = 99;
  for (let r = 1; r < 256; r++) {
    let i = n[255 - t[r]];
    let a = i ^ i << 1 ^ i << 2 ^ i << 3 ^ i << 4;
    a = a >>> 8 ^ a & 255 ^ 99;
    e[r] = a;
  }
  for (let t = 0; t < 256; t++) {
    let n = e[t];
    let i = e.indexOf(t);
    kr[t] = n << 24 | n << 16 | n << 8 | n;
    Pr[t] = i << 24 | i << 16 | i << 8 | i;
    let a = r(i, 14);
    let o = r(i, 9);
    let s = r(i, 13);
    let c = r(i, 11);
    let l = a << 24 | o << 16 | s << 8 | c;
    Ar[t] = l;
    jr[t] = l >>> 8 | l << 24;
    Mr[t] = l >>> 16 | l << 16;
    Nr[t] = l >>> 24 | l << 8;
  }
  let i = 1;
  for (let e = 0; e < 10; e++) {
    Fr[e] = i << 24;
    i = i << 1 ^ (i & 128 ? 283 : 0);
  }
  Ir = true;
};
var Rr = class {
  constructor() {
    this.roundkey = new Uint32Array(44);
    this.iv = new Uint32Array(16 / Uint32Array.BYTES_PER_ELEMENT);
    this.in = new Uint8Array(16);
    this.out = new Uint8Array(16);
    this.inView = new DataView(this.in.buffer);
    this.outView = new DataView(this.out.buffer);
  }
  init({
    key: e,
    iv: t
  }) {
    n(e.byteLength === 16);
    n(t.byteLength === 16);
    if (!Ir) {
      Lr();
    }
    let r = new DataView(e.buffer, e.byteOffset, e.byteLength);
    let i = new DataView(t.buffer, t.byteOffset, t.byteLength);
    this.roundkey[0] = r.getUint32(0, false);
    this.roundkey[1] = r.getUint32(4, false);
    this.roundkey[2] = r.getUint32(8, false);
    this.roundkey[3] = r.getUint32(12, false);
    this.iv[0] = i.getUint32(0, false);
    this.iv[1] = i.getUint32(4, false);
    this.iv[2] = i.getUint32(8, false);
    this.iv[3] = i.getUint32(12, false);
    for (let e = 4; e < 44; e += 4) {
      let t = this.roundkey[e - 1];
      this.roundkey[e] = this.roundkey[e - 4] ^ kr[t >>> 16 & 255] & -16777216 ^ kr[t >>> 8 & 255] & 16711680 ^ kr[t >>> 0 & 255] & 65280 ^ kr[t >>> 24 & 255] & 255 ^ Fr[e / 4 - 1];
      this.roundkey[e + 1] = this.roundkey[e - 3] ^ this.roundkey[e];
      this.roundkey[e + 2] = this.roundkey[e - 2] ^ this.roundkey[e + 1];
      this.roundkey[e + 3] = this.roundkey[e - 1] ^ this.roundkey[e + 2];
    }
    e += 4;
    for (let e = 0, t = 40; e < t; t -= 4) {
      for (let n = 0; n < 4; n++) {
        let r = this.roundkey[e + n];
        this.roundkey[e + n] = this.roundkey[t + n];
        this.roundkey[t + n] = r;
      }
    }
    for (let e = 4; e < 40; e += 4) {
      for (let t = 0; t < 4; t++) {
        let n = this.roundkey[e + t];
        this.roundkey[e + t] = Ar[kr[n >>> 24 & 255] & 255] ^ jr[kr[n >>> 16 & 255] & 255] ^ Mr[kr[n >>> 8 & 255] & 255] ^ Nr[kr[n >>> 0 & 255] & 255];
      }
    }
  }
  decrypt() {
    let e = this.inView.getUint32(0, false) ^ this.roundkey[0];
    let t = this.inView.getUint32(4, false) ^ this.roundkey[1];
    let n = this.inView.getUint32(8, false) ^ this.roundkey[2];
    let r = this.inView.getUint32(12, false) ^ this.roundkey[3];
    let i = this.inView.getUint32(0, false);
    let a = this.inView.getUint32(4, false);
    let o = this.inView.getUint32(8, false);
    let s = this.inView.getUint32(12, false);
    let c;
    let l;
    let u;
    let d;
    for (let i = 1; i < 10; i++) {
      let a = i * 4;
      c = Ar[e >>> 24] ^ jr[r >>> 16 & 255] ^ Mr[n >>> 8 & 255] ^ Nr[t & 255] ^ this.roundkey[a];
      l = Ar[t >>> 24] ^ jr[e >>> 16 & 255] ^ Mr[r >>> 8 & 255] ^ Nr[n & 255] ^ this.roundkey[a + 1];
      u = Ar[n >>> 24] ^ jr[t >>> 16 & 255] ^ Mr[e >>> 8 & 255] ^ Nr[r & 255] ^ this.roundkey[a + 2];
      d = Ar[r >>> 24] ^ jr[n >>> 16 & 255] ^ Mr[t >>> 8 & 255] ^ Nr[e & 255] ^ this.roundkey[a + 3];
      e = c;
      t = l;
      n = u;
      r = d;
    }
    let f = Pr[e >>> 24 & 255] & -16777216 ^ Pr[r >>> 16 & 255] & 16711680 ^ Pr[n >>> 8 & 255] & 65280 ^ Pr[t >>> 0 & 255] & 255 ^ this.roundkey[40];
    let p = Pr[t >>> 24 & 255] & -16777216 ^ Pr[e >>> 16 & 255] & 16711680 ^ Pr[r >>> 8 & 255] & 65280 ^ Pr[n >>> 0 & 255] & 255 ^ this.roundkey[41];
    let m = Pr[n >>> 24 & 255] & -16777216 ^ Pr[t >>> 16 & 255] & 16711680 ^ Pr[e >>> 8 & 255] & 65280 ^ Pr[r >>> 0 & 255] & 255 ^ this.roundkey[42];
    let h = Pr[r >>> 24 & 255] & -16777216 ^ Pr[n >>> 16 & 255] & 16711680 ^ Pr[t >>> 8 & 255] & 65280 ^ Pr[e >>> 0 & 255] & 255 ^ this.roundkey[43];
    this.outView.setUint32(0, f ^ this.iv[0], false);
    this.outView.setUint32(4, p ^ this.iv[1], false);
    this.outView.setUint32(8, m ^ this.iv[2], false);
    this.outView.setUint32(12, h ^ this.iv[3], false);
    this.iv[0] = i;
    this.iv[1] = a;
    this.iv[2] = o;
    this.iv[3] = s;
  }
};
var zr = (e, t, n) => {
  let r = false;
  let i = 0;
  let a = 65536;
  let o = new Rr();
  return new ReadableStream({
    pull: async s => {
      o.init(await t());
      r ||= true;
      let c = a + 16;
      let l = e.requestSliceRange(i, 0, c);
      if (l instanceof Promise) {
        l = await l;
      }
      if (!l || l.length === 0) {
        throw Error(`Invalid ciphertext.`);
      }
      let u = l.length;
      if (u % 16 != 0) {
        throw Error(`Invalid ciphertext.`);
      }
      let d = u === c ? u - 16 : u;
      let f = B(l, d);
      let p = new Uint8Array(d);
      for (let e = 0; e < d; e += 16) {
        o.in.set(f.subarray(e, e + 16));
        o.decrypt();
        p.set(o.out, e);
      }
      if (d < u) {
        s.enqueue(p);
        i += d;
      } else {
        let e = p[d - 1];
        if (e === 0 || e > 16) {
          throw Error(`Invalid PKCS#7 padding. Incorrect key or corrupted data.`);
        }
        let t = p.subarray(0, d - e);
        s.enqueue(t);
        s.close();
        n();
      }
    },
    cancel: () => {
      n();
    }
  });
};
var Br = class e extends vr {
  constructor(e) {
    super(e);
    this.moovSlice = null;
    this.currentTrack = null;
    this.tracks = [];
    this.metadataPromise = null;
    this.movieTimescale = -1;
    this.movieDurationInTimescale = -1;
    this.isQuickTime = false;
    this.metadataTags = {};
    this.currentMetadataKeys = null;
    this.isFragmented = false;
    this.fragmentTrackDefaults = [];
    this.psshBoxes = [];
    this.currentFragment = null;
    this.lastReadFragment = null;
    this.decryptionKeyCache = new Map();
    this.reader = e._reader;
  }
  async getTrackBackings() {
    await this.readMetadata();
    return this.tracks.map(e => {
      return e.trackBacking;
    });
  }
  async getMimeType() {
    await this.readMetadata();
    let e = await this.getTrackBackings();
    let t = await Promise.all(e.map(e => {
      return e.getDecoderConfig().then(e => {
        return e?.codec ?? null;
      });
    }));
    return br({
      isQuickTime: this.isQuickTime,
      hasVideo: this.tracks.some(e => {
        return e.info?.type === `video`;
      }),
      hasAudio: this.tracks.some(e => {
        return e.info?.type === `audio`;
      }),
      codecStrings: t.filter(Boolean)
    });
  }
  async getMetadataTags() {
    await this.readMetadata();
    return this.metadataTags;
  }
  readMetadata() {
    return this.metadataPromise ??= (async () => {
      let t = 0;
      let r = false;
      while (true) {
        let i = this.reader.requestSliceRange(t, 8, 16);
        if (i instanceof Promise) {
          i = await i;
        }
        if (!i) {
          break;
        }
        let a = t;
        let o = Cr(i);
        if (!o) {
          break;
        }
        if (o.name === `ftyp` || o.name === `styp`) {
          let e = W(i, 4);
          this.isQuickTime = e === `qt  `;
        } else if (o.name === `moov`) {
          let e = this.reader.requestSlice(i.filePos, o.contentSize);
          if (e instanceof Promise) {
            e = await e;
          }
          if (!e) {
            break;
          }
          this.moovSlice = e;
          this.readContiguousBoxes(this.moovSlice);
          for (let e of this.tracks) {
            let t = e.editListPreviousSegmentDurations / this.movieTimescale;
            e.editListOffset -= Math.round(t * e.timescale);
          }
          r = this.isFragmented && this.reader.fileSize !== null && this.reader.fileSize > a + o.totalSize;
          break;
        } else if (o.name === `moof`) {
          if (!this.input._initInput) {
            throw Error(`"moof" box encountered with no "moov" box present; this file is likely a Segment as described in ISO/IEC 14496-12 Section 8.16. A separate init file that contains a "moov" box is required to read this file, please provide it using InputOptions.initInput.`);
          }
          let t = await this.input._initInput._getDemuxer();
          if (t.constructor !== e) {
            throw Error(`Init input must match the input's format.`);
          }
          await t.readMetadata();
          this.movieTimescale = t.movieTimescale;
          this.movieDurationInTimescale = t.movieDurationInTimescale;
          this.metadataTags = t.metadataTags;
          this.isFragmented = true;
          this.fragmentTrackDefaults = t.fragmentTrackDefaults;
          this.psshBoxes = t.psshBoxes;
          for (let e of t.tracks) {
            let t = {
              id: e.id,
              demuxer: this,
              trackBacking: null,
              disposition: e.disposition,
              timescale: e.timescale,
              durationInMediaTimescale: e.durationInMediaTimescale,
              durationInMovieTimescale: e.durationInMovieTimescale,
              rotation: e.rotation,
              internalCodecId: e.internalCodecId,
              name: e.name,
              languageCode: e.languageCode,
              sampleTableByteOffset: null,
              sampleTable: null,
              fragmentLookupTable: [],
              currentFragmentState: null,
              fragmentPositionCache: [],
              editListPreviousSegmentDurations: e.editListPreviousSegmentDurations,
              editListOffset: e.editListOffset,
              encryptionInfo: e.encryptionInfo,
              encryptionAuxInfo: null,
              frmaCodecString: null,
              info: e.info
            };
            if (e.trackBacking) {
              n(t.info);
              if (t.info.type === `video` && t.info.width !== -1) {
                t.trackBacking = new Hr(t);
                this.tracks.push(t);
              } else if (t.info.type === `audio` && t.info.numberOfChannels !== -1) {
                t.trackBacking = new Ur(t);
                this.tracks.push(t);
              }
            }
          }
          r = false;
          break;
        }
        t = a + o.totalSize;
      }
      if (r) {
        n(this.reader.fileSize !== null);
        let e = this.reader.requestSlice(this.reader.fileSize - 4, 4);
        if (e instanceof Promise) {
          e = await e;
        }
        n(e);
        let t = U(e);
        let r = this.reader.fileSize - t;
        if (r >= 0 && r <= this.reader.fileSize - 16) {
          let e = this.reader.requestSliceRange(r, 8, 16);
          if (e instanceof Promise) {
            e = await e;
          }
          if (e) {
            let t = Cr(e);
            if (t && t.name === `mfra`) {
              let n = this.reader.requestSlice(e.filePos, t.contentSize);
              if (n instanceof Promise) {
                n = await n;
              }
              if (n) {
                this.readContiguousBoxes(n);
              }
            }
          }
        }
      }
    })();
  }
  getSampleTableForTrack(e) {
    if (e.sampleTable) {
      return e.sampleTable;
    }
    let t = {
      sampleTimingEntries: [],
      sampleCompositionTimeOffsets: [],
      sampleSizes: [],
      keySampleIndices: null,
      chunkOffsets: [],
      sampleToChunk: [],
      presentationTimestamps: null,
      presentationTimestampIndexMap: null
    };
    e.sampleTable = t;
    if (e.sampleTableByteOffset === null) {
      return t;
    }
    n(this.moovSlice);
    let r = this.moovSlice.slice(e.sampleTableByteOffset);
    this.currentTrack = e;
    this.traverseBox(r);
    this.currentTrack = null;
    if (e.info?.type === `audio` && e.info.codec && M.includes(e.info.codec) && t.sampleCompositionTimeOffsets.length === 0) {
      n(e.info?.type === `audio`);
      let r = Kt(e.info.codec);
      let a = [];
      let o = [];
      for (let n = 0; n < t.sampleToChunk.length; n++) {
        let s = t.sampleToChunk[n];
        let c = t.sampleToChunk[n + 1];
        let l = (c ? c.startChunkIndex : t.chunkOffsets.length) - s.startChunkIndex;
        for (let n = 0; n < l; n++) {
          let c = s.startSampleIndex + n * s.samplesPerChunk;
          let l = c + s.samplesPerChunk;
          let u = T(t.sampleTimingEntries, c, e => {
            return e.startIndex;
          });
          let d = t.sampleTimingEntries[u];
          let f = T(t.sampleTimingEntries, l, e => {
            return e.startIndex;
          });
          let p = t.sampleTimingEntries[f];
          let m = d.startDecodeTimestamp + (c - d.startIndex) * d.delta;
          let h = p.startDecodeTimestamp + (l - p.startIndex) * p.delta - m;
          let g = i(a);
          if (g && g.delta === h) {
            g.count++;
          } else {
            a.push({
              startIndex: s.startChunkIndex + n,
              startDecodeTimestamp: m,
              count: 1,
              delta: h
            });
          }
          let _ = s.samplesPerChunk * r.sampleSize * e.info.numberOfChannels;
          o.push(_);
        }
        s.startSampleIndex = s.startChunkIndex;
        s.samplesPerChunk = 1;
      }
      t.sampleTimingEntries = a;
      t.sampleSizes = o;
    }
    if (t.sampleCompositionTimeOffsets.length > 0) {
      t.presentationTimestamps = [];
      for (let e of t.sampleTimingEntries) {
        for (let n = 0; n < e.count; n++) {
          t.presentationTimestamps.push({
            presentationTimestamp: e.startDecodeTimestamp + n * e.delta,
            sampleIndex: e.startIndex + n
          });
        }
      }
      for (let e of t.sampleCompositionTimeOffsets) {
        for (let n = 0; n < e.count; n++) {
          let r = e.startIndex + n;
          let i = t.presentationTimestamps[r];
          if (i) {
            i.presentationTimestamp += e.offset;
          }
        }
      }
      t.presentationTimestamps.sort((e, t) => {
        return e.presentationTimestamp - t.presentationTimestamp;
      });
      t.presentationTimestampIndexMap = Array(t.presentationTimestamps.length).fill(-1);
      for (let e = 0; e < t.presentationTimestamps.length; e++) {
        t.presentationTimestampIndexMap[t.presentationTimestamps[e].sampleIndex] = e;
      }
    }
    return t;
  }
  async readFragment(e) {
    if (this.lastReadFragment?.moofOffset === e) {
      return this.lastReadFragment;
    }
    let t = this.reader.requestSliceRange(e, 8, 16);
    if (t instanceof Promise) {
      t = await t;
    }
    n(t);
    let r = Cr(t);
    n(r?.name === `moof`);
    let i = this.reader.requestSlice(e, r.totalSize);
    if (i instanceof Promise) {
      i = await i;
    }
    n(i);
    this.traverseBox(i);
    let a = this.lastReadFragment;
    n(a && a.moofOffset === e);
    for (let [, e] of a.trackData) {
      let t = e.track;
      let {
        fragmentPositionCache: n
      } = t;
      if (!e.startTimestampIsFinal) {
        let r = t.fragmentLookupTable.find(e => {
          return e.moofOffset === a.moofOffset;
        });
        if (r) {
          Jr(e, r.timestamp);
        } else {
          let t = T(n, a.moofOffset - 1, e => {
            return e.moofOffset;
          });
          if (t !== -1) {
            let r = n[t];
            Jr(e, r.endTimestamp);
          }
        }
        e.startTimestampIsFinal = true;
      }
      let r = T(n, e.startTimestamp, e => {
        return e.startTimestamp;
      });
      if (r === -1 || n[r].moofOffset !== a.moofOffset) {
        n.splice(r + 1, 0, {
          moofOffset: a.moofOffset,
          startTimestamp: e.startTimestamp,
          endTimestamp: e.endTimestamp
        });
      }
      if (e.encryptionAuxInfo && t.encryptionInfo) {
        let n = await Qr(this.reader, t.encryptionInfo, e.encryptionAuxInfo);
        for (let t = 0; t < Math.min(e.samples.length, n.length); t++) {
          let r = n[t];
          e.samples[t].encryption = r;
        }
      }
    }
    return a;
  }
  readContiguousBoxes(e) {
    let t = e.filePos;
    while (e.filePos - t <= e.length - 8 && this.traverseBox(e)) {}
  }
  *iterateContiguousBoxes(e) {
    let t = e.filePos;
    while (e.filePos - t <= e.length - 8) {
      let t = e.filePos;
      let n = Cr(e);
      if (!n) {
        break;
      }
      yield {
        boxInfo: n,
        slice: e
      };
      e.filePos = t + n.totalSize;
    }
  }
  traverseBox(e) {
    let t = e.filePos;
    let a = Cr(e);
    if (!a) {
      return false;
    }
    let o = e.filePos;
    let s = t + a.totalSize;
    switch (a.name) {
      case `mdia`:
      case `minf`:
      case `dinf`:
      case `mfra`:
      case `edts`:
      case `sinf`:
      case `schi`:
        {
          this.readContiguousBoxes(e.slice(o, a.contentSize));
          break;
        }
      case `mvhd`:
        {
          let t = V(e);
          e.skip(3);
          if (t === 1) {
            e.skip(16);
            this.movieTimescale = U(e);
            this.movieDurationInTimescale = Sl(e);
          } else {
            e.skip(8);
            this.movieTimescale = U(e);
            this.movieDurationInTimescale = U(e);
          }
        }
        break;
      case `trak`:
        {
          let t = {
            id: -1,
            demuxer: this,
            trackBacking: null,
            disposition: {
              ...yt,
              primary: false
            },
            info: null,
            timescale: -1,
            durationInMovieTimescale: -1,
            durationInMediaTimescale: -1,
            rotation: 0,
            internalCodecId: null,
            name: null,
            languageCode: `und`,
            sampleTableByteOffset: -1,
            sampleTable: null,
            fragmentLookupTable: [],
            currentFragmentState: null,
            fragmentPositionCache: [],
            editListPreviousSegmentDurations: 0,
            editListOffset: 0,
            encryptionInfo: null,
            encryptionAuxInfo: null,
            frmaCodecString: null
          };
          this.currentTrack = t;
          this.readContiguousBoxes(e.slice(o, a.contentSize));
          if (t.id !== -1 && t.timescale !== -1 && t.info !== null) {
            if (t.info.type === `video` && t.info.width !== -1) {
              t.trackBacking = new Hr(t);
              this.tracks.push(t);
            } else if (t.info.type === `audio` && t.info.numberOfChannels !== -1) {
              t.trackBacking = new Ur(t);
              this.tracks.push(t);
            }
          }
          this.currentTrack = null;
        }
        break;
      case `tkhd`:
        {
          let t = this.currentTrack;
          if (!t) {
            break;
          }
          let i = V(e);
          let a = !!(hl(e) & 1);
          t.disposition.default = a;
          if (i === 0) {
            e.skip(8);
            t.id = U(e);
            e.skip(4);
            t.durationInMovieTimescale = U(e);
          } else if (i === 1) {
            e.skip(16);
            t.id = U(e);
            e.skip(4);
            t.durationInMovieTimescale = Sl(e);
          } else {
            throw Error(`Incorrect track header version ${i}.`);
          }
          e.skip(16);
          let o = r(_e(Yr([wr(e), wr(e), Tr(e), wr(e), wr(e), Tr(e), wr(e), wr(e), Tr(e)]), 90));
          n(o === 0 || o === 90 || o === 180 || o === 270);
          t.rotation = o;
        }
        break;
      case `elst`:
        {
          let t = this.currentTrack;
          if (!t) {
            break;
          }
          let n = V(e);
          e.skip(3);
          let r = false;
          let i = 0;
          let a = U(e);
          for (let o = 0; o < a; o++) {
            let a = n === 1 ? Sl(e) : U(e);
            let o = n === 1 ? Cl(e) : yl(e);
            let s = wr(e);
            if (a !== 0) {
              if (r) {
                k._warn(`Unsupported edit list: multiple edits are not currently supported. Only using first edit.`);
                break;
              }
              if (o === -1) {
                i += a;
                continue;
              }
              if (s !== 1) {
                k._warn(`Unsupported edit list entry: media rate must be 1.`);
                break;
              }
              t.editListPreviousSegmentDurations = i;
              t.editListOffset = o;
              r = true;
            }
          }
        }
        break;
      case `mdhd`:
        {
          let t = this.currentTrack;
          if (!t) {
            break;
          }
          let n = V(e);
          e.skip(3);
          if (n === 0) {
            e.skip(8);
            t.timescale = U(e);
            t.durationInMediaTimescale = U(e);
          } else if (n === 1) {
            e.skip(16);
            t.timescale = U(e);
            t.durationInMediaTimescale = Sl(e);
          }
          let r = H(e);
          if (r > 0) {
            t.languageCode = ``;
            for (let e = 0; e < 3; e++) {
              t.languageCode = String.fromCharCode(96 + (r & 31)) + t.languageCode;
              r >>= 5;
            }
            if (!Ce(t.languageCode)) {
              t.languageCode = `und`;
            }
          }
        }
        break;
      case `hdlr`:
        {
          let t = this.currentTrack;
          if (!t) {
            break;
          }
          e.skip(8);
          let n = W(e, 4);
          if (n === `vide`) {
            t.info = {
              type: `video`,
              width: -1,
              height: -1,
              squarePixelWidth: -1,
              squarePixelHeight: -1,
              codec: null,
              codecDescription: null,
              colorSpace: null,
              avcType: null,
              avcCodecInfo: null,
              hevcCodecInfo: null,
              vp9CodecInfo: null,
              av1CodecInfo: null,
              proresFormat: null
            };
          } else if (n === `soun`) {
            t.info = {
              type: `audio`,
              numberOfChannels: -1,
              sampleRate: -1,
              codec: null,
              codecDescription: null,
              aacCodecInfo: null,
              pcmLittleEndian: false,
              pcmSampleSize: null
            };
          }
        }
        break;
      case `stbl`:
        {
          let n = this.currentTrack;
          if (!n) {
            break;
          }
          n.sampleTableByteOffset = t;
          this.readContiguousBoxes(e.slice(o, a.contentSize));
        }
        break;
      case `stsd`:
        {
          let t = this.currentTrack;
          if (!t || t.info === null || t.sampleTable) {
            break;
          }
          let n = V(e);
          e.skip(3);
          let r = U(e);
          for (let i = 0; i < r; i++) {
            let r = e.filePos;
            let i = Cr(e);
            if (!i) {
              break;
            }
            t.internalCodecId = i.name;
            let a = i.name.toLowerCase();
            if (t.info.type === `video`) {
              e.skip(24);
              t.info.width = H(e);
              t.info.height = H(e);
              t.info.squarePixelWidth = t.info.width;
              t.info.squarePixelHeight = t.info.height;
              e.skip(50);
              t.frmaCodecString = null;
              this.readContiguousBoxes(e.slice(e.filePos, r + i.totalSize - e.filePos));
              let n = a === `encv` ? t.frmaCodecString : a;
              t.frmaCodecString = null;
              if (n === `avc1` || n === `avc3`) {
                t.info.codec = `avc`;
                if (n === `avc1`) {
                  t.info.avcType = 1;
                } else {
                  t.info.avcType = 3;
                }
              } else if (n === `hvc1` || n === `hev1`) {
                t.info.codec = `hevc`;
              } else if (n === `vp08`) {
                t.info.codec = `vp8`;
              } else if (n === `vp09`) {
                t.info.codec = `vp9`;
              } else if (n === `av01`) {
                t.info.codec = `av1`;
              } else if (Ft.includes(a)) {
                t.info.codec = `prores`;
                t.info.proresFormat = a;
              } else if (n === null) {
                k._warn(`Unknown encrypted video codec due to missing frma box.`);
              } else {
                k._warn(`Unsupported video codec (sample entry type '${i.name}').`);
              }
            } else {
              e.skip(8);
              let o = H(e);
              e.skip(6);
              let s = H(e);
              let c = H(e);
              e.skip(4);
              let l = U(e) / 65536;
              let u = null;
              if (n === 0 && o > 0) {
                if (o === 1) {
                  e.skip(4);
                  c = U(e) * 8;
                  e.skip(8);
                } else if (o === 2) {
                  e.skip(4);
                  l = El(e);
                  s = U(e);
                  e.skip(4);
                  c = U(e);
                  u = U(e);
                  e.skip(8);
                }
              }
              t.info.numberOfChannels = s;
              t.info.sampleRate = l;
              t.frmaCodecString = null;
              this.readContiguousBoxes(e.slice(e.filePos, r + i.totalSize - e.filePos));
              let d = a === `enca` ? t.frmaCodecString : a;
              t.frmaCodecString = null;
              if (d !== `mp4a`) {
                if (d === `opus`) {
                  t.info.codec = `opus`;
                  t.info.sampleRate = Wt;
                } else if (d === `flac`) {
                  t.info.codec = `flac`;
                } else if (d === `ulaw`) {
                  t.info.codec = `ulaw`;
                } else if (d === `alaw`) {
                  t.info.codec = `alaw`;
                } else if (d === `ac-3`) {
                  t.info.codec = `ac3`;
                } else if (d === `ec-3`) {
                  t.info.codec = `eac3`;
                } else if (d === `twos`) {
                  if (c === 8) {
                    t.info.codec = `pcm-s8`;
                  } else if (c === 16) {
                    if (t.info.pcmLittleEndian) {
                      t.info.codec = `pcm-s16`;
                    } else {
                      t.info.codec = `pcm-s16be`;
                    }
                  } else {
                    k._warn(`Unsupported sample size ${c} for codec 'twos'.`);
                    t.info.codec = null;
                  }
                } else if (d === `sowt`) {
                  if (c === 8) {
                    t.info.codec = `pcm-s8`;
                  } else if (c === 16) {
                    t.info.codec = `pcm-s16`;
                  } else {
                    k._warn(`Unsupported sample size ${c} for codec 'sowt'.`);
                    t.info.codec = null;
                  }
                } else if (d === `raw `) {
                  t.info.codec = `pcm-u8`;
                } else if (d === `in24`) {
                  if (t.info.pcmLittleEndian) {
                    t.info.codec = `pcm-s24`;
                  } else {
                    t.info.codec = `pcm-s24be`;
                  }
                } else if (d === `in32`) {
                  if (t.info.pcmLittleEndian) {
                    t.info.codec = `pcm-s32`;
                  } else {
                    t.info.codec = `pcm-s32be`;
                  }
                } else if (d === `fl32`) {
                  if (t.info.pcmLittleEndian) {
                    t.info.codec = `pcm-f32`;
                  } else {
                    t.info.codec = `pcm-f32be`;
                  }
                } else if (d === `fl64`) {
                  if (t.info.pcmLittleEndian) {
                    t.info.codec = `pcm-f64`;
                  } else {
                    t.info.codec = `pcm-f64be`;
                  }
                } else if (d === `ipcm`) {
                  let e = t.info.pcmSampleSize;
                  if (t.info.pcmLittleEndian) {
                    if (e === 16) {
                      t.info.codec = `pcm-s16`;
                    } else if (e === 24) {
                      t.info.codec = `pcm-s24`;
                    } else if (e === 32) {
                      t.info.codec = `pcm-s32`;
                    } else {
                      k._warn(`Invalid ipcm sample size ${e}.`);
                      t.info.codec = null;
                    }
                  } else if (e === 16) {
                    t.info.codec = `pcm-s16be`;
                  } else if (e === 24) {
                    t.info.codec = `pcm-s24be`;
                  } else if (e === 32) {
                    t.info.codec = `pcm-s32be`;
                  } else {
                    k._warn(`Invalid ipcm sample size ${e}.`);
                    t.info.codec = null;
                  }
                } else if (d === `fpcm`) {
                  let e = t.info.pcmSampleSize;
                  if (t.info.pcmLittleEndian) {
                    if (e === 32) {
                      t.info.codec = `pcm-f32`;
                    } else if (e === 64) {
                      t.info.codec = `pcm-f64`;
                    } else {
                      k._warn(`Invalid fpcm sample size ${e}.`);
                      t.info.codec = null;
                    }
                  } else if (e === 32) {
                    t.info.codec = `pcm-f32be`;
                  } else if (e === 64) {
                    t.info.codec = `pcm-f64be`;
                  } else {
                    k._warn(`Invalid fpcm sample size ${e}.`);
                    t.info.codec = null;
                  }
                } else if (d === `lpcm` && u !== null) {
                  let e = c + 7 >> 3;
                  let n = !!(u & 1);
                  let r = !!(u & 2);
                  let i = u & 4 ? -1 : 0;
                  if (c > 0 && c <= 64) {
                    if (n) {
                      if (c === 32) {
                        if (r) {
                          t.info.codec = `pcm-f32be`;
                        } else {
                          t.info.codec = `pcm-f32`;
                        }
                      }
                    } else if (i & 1 << e - 1) {
                      if (e === 1) {
                        t.info.codec = `pcm-s8`;
                      } else if (e === 2) {
                        if (r) {
                          t.info.codec = `pcm-s16be`;
                        } else {
                          t.info.codec = `pcm-s16`;
                        }
                      } else if (e === 3) {
                        if (r) {
                          t.info.codec = `pcm-s24be`;
                        } else {
                          t.info.codec = `pcm-s24`;
                        }
                      } else if (e === 4) {
                        if (r) {
                          t.info.codec = `pcm-s32be`;
                        } else {
                          t.info.codec = `pcm-s32`;
                        }
                      }
                    } else if (e === 1) {
                      t.info.codec = `pcm-u8`;
                    }
                  }
                  if (t.info.codec === null) {
                    k._warn(`Unsupported PCM format.`);
                  }
                } else if (d === null) {
                  k._warn(`Unknown encrypted audio codec due to missing frma box.`);
                } else {
                  k._warn(`Unsupported audio codec (sample entry type '${i.name}').`);
                }
              }
            }
            e.filePos = r + i.totalSize;
          }
        }
        break;
      case `frma`:
        {
          let t = this.currentTrack;
          if (!t) {
            break;
          }
          t.frmaCodecString = W(e, 4).toLowerCase();
        }
        break;
      case `schm`:
        {
          let t = this.currentTrack;
          if (!t) {
            break;
          }
          e.skip(4);
          let n = W(e, 4);
          if (n === `cenc` || n === `cens` || n === `cbcs`) {
            t.encryptionInfo = {
              scheme: n,
              defaultKid: null,
              defaultIsProtected: null,
              defaultPerSampleIvSize: null,
              defaultConstantIv: null,
              defaultCryptByteBlock: null,
              defaultSkipByteBlock: null
            };
          } else {
            k._warn(`Unsupported encryption scheme '${n}'.`);
          }
        }
        break;
      case `tenc`:
        {
          let t = this.currentTrack;
          if (!t || !t.encryptionInfo) {
            break;
          }
          let n = V(e);
          e.skip(3);
          e.skip(1);
          let r = V(e);
          if (n > 0) {
            t.encryptionInfo.defaultCryptByteBlock = r >> 4;
            t.encryptionInfo.defaultSkipByteBlock = r & 15;
          } else {
            t.encryptionInfo.defaultCryptByteBlock = 0;
            t.encryptionInfo.defaultSkipByteBlock = 0;
          }
          t.encryptionInfo.defaultIsProtected = V(e) !== 0;
          t.encryptionInfo.defaultPerSampleIvSize = V(e);
          t.encryptionInfo.defaultKid = w(B(e, 16));
          if (t.encryptionInfo.defaultIsProtected && t.encryptionInfo.defaultPerSampleIvSize === 0) {
            let n = V(e);
            let r = new Uint8Array(16);
            r.set(B(e, n), 0);
            t.encryptionInfo.defaultConstantIv = r;
          }
        }
        break;
      case `avcC`:
        {
          let t = this.currentTrack;
          if (!t) {
            break;
          }
          n(t.info);
          t.info.codecDescription = B(e, a.contentSize);
        }
        break;
      case `hvcC`:
        {
          let t = this.currentTrack;
          if (!t) {
            break;
          }
          n(t.info);
          t.info.codecDescription = B(e, a.contentSize);
        }
        break;
      case `vpcC`:
        {
          let t = this.currentTrack;
          if (!t) {
            break;
          }
          n(t.info?.type === `video`);
          e.skip(4);
          let r = V(e);
          let i = V(e);
          let a = V(e);
          let o = a >> 4;
          let s = a >> 1 & 7;
          let c = a & 1;
          let l = V(e);
          let u = V(e);
          let d = V(e);
          t.info.vp9CodecInfo = {
            profile: r,
            level: i,
            bitDepth: o,
            chromaSubsampling: s,
            videoFullRangeFlag: c,
            colourPrimaries: l,
            transferCharacteristics: u,
            matrixCoefficients: d
          };
        }
        break;
      case `av1C`:
        {
          let t = this.currentTrack;
          if (!t) {
            break;
          }
          n(t.info?.type === `video`);
          e.skip(1);
          let r = V(e);
          let i = r >> 5;
          let a = r & 31;
          let o = V(e);
          let s = o >> 7;
          let c = o >> 6 & 1;
          let l = o >> 5 & 1;
          let u = o >> 4 & 1;
          let d = o >> 3 & 1;
          let f = o >> 2 & 1;
          let p = o & 3;
          let m = i === 2 && c ? l ? 12 : 10 : c ? 10 : 8;
          t.info.av1CodecInfo = {
            profile: i,
            level: a,
            tier: s,
            bitDepth: m,
            monochrome: u,
            chromaSubsamplingX: d,
            chromaSubsamplingY: f,
            chromaSamplePosition: p
          };
        }
        break;
      case `colr`:
        {
          let t = this.currentTrack;
          if (!t) {
            break;
          }
          n(t.info?.type === `video`);
          let r = W(e, 4);
          if (r !== `nclx` && r !== `nclc`) {
            break;
          }
          let i = H(e);
          let a = H(e);
          let o = H(e);
          let s;
          if (r === `nclx`) {
            s = !!(V(e) & 128);
          }
          t.info.colorSpace = {
            primaries: g[i],
            transfer: v[a],
            matrix: b[o],
            fullRange: s
          };
        }
        break;
      case `pasp`:
        {
          let t = this.currentTrack;
          if (!t) {
            break;
          }
          n(t.info?.type === `video`);
          let r = U(e);
          let i = U(e);
          if (r > 0 && i > 0) {
            if (r > i) {
              t.info.squarePixelWidth = Math.round(t.info.width * r / i);
            } else {
              t.info.squarePixelHeight = Math.round(t.info.height * i / r);
            }
          }
        }
        break;
      case `wave`:
        {
          this.readContiguousBoxes(e.slice(o, a.contentSize));
          break;
        }
      case `esds`:
        {
          let t = this.currentTrack;
          if (!t) {
            break;
          }
          n(t.info?.type === `audio`);
          e.skip(4);
          n(V(e) === 3);
          Er(e);
          e.skip(2);
          let r = V(e);
          let i = (r & 128) != 0;
          let a = (r & 64) != 0;
          let o = (r & 32) != 0;
          if (i) {
            e.skip(2);
          }
          if (a) {
            let t = V(e);
            e.skip(t);
          }
          if (o) {
            e.skip(2);
          }
          n(V(e) === 4);
          let s = Er(e);
          let c = e.filePos;
          let l = V(e);
          if (l === 64 || l === 103) {
            t.info.codec = `aac`;
            t.info.aacCodecInfo = {
              isMpeg2: l === 103,
              objectType: null
            };
          } else if (l === 105 || l === 107) {
            t.info.codec = `mp3`;
          } else if (l === 221) {
            t.info.codec = `vorbis`;
          } else {
            k._warn(`Unsupported audio codec (objectTypeIndication ${l}) - discarding track.`);
          }
          e.skip(12);
          if (s > e.filePos - c) {
            n(V(e) === 5);
            let r = Er(e);
            t.info.codecDescription = B(e, r);
            if (t.info.codec === `aac`) {
              let e = Ct(t.info.codecDescription);
              if (e.numberOfChannels !== null) {
                t.info.numberOfChannels = e.numberOfChannels;
              }
              if (e.sampleRate !== null) {
                t.info.sampleRate = e.sampleRate;
              }
            }
          }
        }
        break;
      case `enda`:
        {
          let t = this.currentTrack;
          if (!t) {
            break;
          }
          n(t.info?.type === `audio`);
          t.info.pcmLittleEndian = !!(H(e) & 255);
        }
        break;
      case `pcmC`:
        {
          let t = this.currentTrack;
          if (!t) {
            break;
          }
          n(t.info?.type === `audio`);
          e.skip(4);
          let r = V(e);
          t.info.pcmLittleEndian = !!(r & 1);
          t.info.pcmSampleSize = V(e);
        }
        break;
      case `dOps`:
        {
          let t = this.currentTrack;
          if (!t) {
            break;
          }
          n(t.info?.type === `audio`);
          e.skip(1);
          let r = V(e);
          let i = H(e);
          let a = U(e);
          let o = gl(e);
          let s = V(e);
          let c;
          if (s === 0) {
            c = new Uint8Array();
          } else {
            c = B(e, 2 + r);
          }
          let l = new Uint8Array(19 + c.byteLength);
          let u = new DataView(l.buffer);
          u.setUint32(0, 1332770163, false);
          u.setUint32(4, 1214603620, false);
          u.setUint8(8, 1);
          u.setUint8(9, r);
          u.setUint16(10, i, true);
          u.setUint32(12, a, true);
          u.setInt16(16, o, true);
          u.setUint8(18, s);
          l.set(c, 19);
          t.info.codecDescription = l;
          t.info.numberOfChannels = r;
        }
        break;
      case `dfLa`:
        {
          let t = this.currentTrack;
          if (!t) {
            break;
          }
          n(t.info?.type === `audio`);
          e.skip(4);
          let r = e.filePos;
          while (e.filePos < s) {
            let n = V(e);
            let r = hl(e);
            if ((n & 127) === ir.STREAMINFO) {
              e.skip(10);
              let n = U(e);
              let r = n >>> 12;
              let i = (n >> 9 & 7) + 1;
              t.info.sampleRate = r;
              t.info.numberOfChannels = i;
              e.skip(20);
            } else {
              e.skip(r);
            }
            if (n & 128) {
              break;
            }
          }
          let i = e.filePos;
          e.filePos = r;
          let a = B(e, i - r);
          let o = new Uint8Array(4 + a.byteLength);
          new DataView(o.buffer).setUint32(0, 1716281667, false);
          o.set(a, 4);
          t.info.codecDescription = o;
        }
        break;
      case `dac3`:
        {
          let t = this.currentTrack;
          if (!t) {
            break;
          }
          n(t.info?.type === `audio`);
          let r = new A(B(e, 3));
          let i = r.readBits(2);
          r.skipBits(8);
          let a = r.readBits(3);
          let o = r.readBits(1);
          if (i < 3) {
            t.info.sampleRate = _n[i];
          }
          t.info.numberOfChannels = sr[a] + o;
        }
        break;
      case `dec3`:
        {
          let t = this.currentTrack;
          if (!t) {
            break;
          }
          n(t.info?.type === `audio`);
          let r = hr(B(e, a.contentSize));
          if (!r) {
            k._warn(`Invalid dec3 box contents, ignoring.`);
            break;
          }
          let i = gr(r);
          if (i !== null) {
            t.info.sampleRate = i;
          }
          t.info.numberOfChannels = _r(r);
        }
        break;
      case `stts`:
        {
          let t = this.currentTrack;
          if (!t || !t.sampleTable) {
            break;
          }
          e.skip(4);
          let n = U(e);
          let r = 0;
          let i = 0;
          for (let a = 0; a < n; a++) {
            let n = U(e);
            let a = U(e);
            t.sampleTable.sampleTimingEntries.push({
              startIndex: r,
              startDecodeTimestamp: i,
              count: n,
              delta: a
            });
            r += n;
            i += n * a;
          }
        }
        break;
      case `ctts`:
        {
          let t = this.currentTrack;
          if (!t || !t.sampleTable) {
            break;
          }
          e.skip(4);
          let n = U(e);
          let r = 0;
          for (let i = 0; i < n; i++) {
            let n = U(e);
            let i = yl(e);
            t.sampleTable.sampleCompositionTimeOffsets.push({
              startIndex: r,
              count: n,
              offset: i
            });
            r += n;
          }
        }
        break;
      case `stsz`:
        {
          let t = this.currentTrack;
          if (!t || !t.sampleTable) {
            break;
          }
          e.skip(4);
          let n = U(e);
          let r = U(e);
          if (n === 0) {
            for (let n = 0; n < r; n++) {
              let n = U(e);
              t.sampleTable.sampleSizes.push(n);
            }
          } else {
            t.sampleTable.sampleSizes.push(n);
          }
        }
        break;
      case `stz2`:
        {
          let t = this.currentTrack;
          if (!t || !t.sampleTable) {
            break;
          }
          e.skip(4);
          e.skip(3);
          let n = V(e);
          let r = U(e);
          let i = new A(B(e, Math.ceil(r * n / 8)));
          for (let e = 0; e < r; e++) {
            let e = i.readBits(n);
            t.sampleTable.sampleSizes.push(e);
          }
        }
        break;
      case `stss`:
        {
          let t = this.currentTrack;
          if (!t || !t.sampleTable) {
            break;
          }
          e.skip(4);
          t.sampleTable.keySampleIndices = [];
          let n = U(e);
          for (let r = 0; r < n; r++) {
            let n = U(e) - 1;
            t.sampleTable.keySampleIndices.push(n);
          }
          if (t.sampleTable.keySampleIndices[0] !== 0) {
            t.sampleTable.keySampleIndices.unshift(0);
          }
        }
        break;
      case `stsc`:
        {
          let t = this.currentTrack;
          if (!t || !t.sampleTable) {
            break;
          }
          e.skip(4);
          let n = U(e);
          for (let r = 0; r < n; r++) {
            let n = U(e) - 1;
            let r = U(e);
            let i = U(e);
            t.sampleTable.sampleToChunk.push({
              startSampleIndex: -1,
              startChunkIndex: n,
              samplesPerChunk: r,
              sampleDescriptionIndex: i
            });
          }
          let r = 0;
          for (let e = 0; e < t.sampleTable.sampleToChunk.length; e++) {
            t.sampleTable.sampleToChunk[e].startSampleIndex = r;
            if (e < t.sampleTable.sampleToChunk.length - 1) {
              let n = t.sampleTable.sampleToChunk[e + 1].startChunkIndex - t.sampleTable.sampleToChunk[e].startChunkIndex;
              r += n * t.sampleTable.sampleToChunk[e].samplesPerChunk;
            }
          }
        }
        break;
      case `stco`:
        {
          let t = this.currentTrack;
          if (!t || !t.sampleTable) {
            break;
          }
          e.skip(4);
          let n = U(e);
          for (let r = 0; r < n; r++) {
            let n = U(e);
            t.sampleTable.chunkOffsets.push(n);
          }
        }
        break;
      case `co64`:
        {
          let t = this.currentTrack;
          if (!t || !t.sampleTable) {
            break;
          }
          e.skip(4);
          let n = U(e);
          for (let r = 0; r < n; r++) {
            let n = Sl(e);
            t.sampleTable.chunkOffsets.push(n);
          }
        }
        break;
      case `mvex`:
        {
          this.isFragmented = true;
          this.readContiguousBoxes(e.slice(o, a.contentSize));
          break;
        }
      case `mehd`:
        {
          let t = V(e);
          e.skip(3);
          let n = t === 1 ? Sl(e) : U(e);
          this.movieDurationInTimescale = n;
        }
        break;
      case `trex`:
        {
          e.skip(4);
          let t = U(e);
          let n = U(e);
          let r = U(e);
          let i = U(e);
          let a = U(e);
          this.fragmentTrackDefaults.push({
            trackId: t,
            defaultSampleDescriptionIndex: n,
            defaultSampleDuration: r,
            defaultSampleSize: i,
            defaultSampleFlags: a
          });
        }
        break;
      case `tfra`:
        {
          let t = V(e);
          e.skip(3);
          let n = U(e);
          let r = this.tracks.find(e => {
            return e.id === n;
          });
          if (!r) {
            break;
          }
          let i = U(e);
          let a = (i & 48) >> 4;
          let o = (i & 12) >> 2;
          let s = i & 3;
          let c = [V, H, hl, U];
          let l = c[a];
          let u = c[o];
          let d = c[s];
          let f = U(e);
          for (let n = 0; n < f; n++) {
            let n = t === 1 ? Sl(e) : U(e);
            let i = t === 1 ? Sl(e) : U(e);
            l(e);
            u(e);
            d(e);
            r.fragmentLookupTable.push({
              timestamp: n,
              moofOffset: i
            });
          }
          r.fragmentLookupTable.sort((e, t) => {
            return e.timestamp - t.timestamp;
          });
          for (let e = 0; e < r.fragmentLookupTable.length - 1; e++) {
            let t = r.fragmentLookupTable[e];
            let n = r.fragmentLookupTable[e + 1];
            if (t.timestamp === n.timestamp) {
              r.fragmentLookupTable.splice(e + 1, 1);
              e--;
            }
          }
        }
        break;
      case `moof`:
        {
          this.currentFragment = {
            moofOffset: t,
            moofSize: a.totalSize,
            implicitBaseDataOffset: t,
            trackData: new Map(),
            psshBoxes: []
          };
          this.readContiguousBoxes(e.slice(o, a.contentSize));
          this.lastReadFragment = this.currentFragment;
          this.currentFragment = null;
          break;
        }
      case `traf`:
        {
          n(this.currentFragment);
          this.readContiguousBoxes(e.slice(o, a.contentSize));
          if (this.currentTrack) {
            let e = this.currentFragment.trackData.get(this.currentTrack.id);
            cond: if (e) {
              if (e.samples.length === 0) {
                this.currentFragment.trackData.delete(this.currentTrack.id);
                break cond;
              }
              e.presentationTimestamps = e.samples.map((e, t) => {
                return {
                  presentationTimestamp: e.presentationTimestamp,
                  sampleIndex: t
                };
              }).sort((e, t) => {
                return e.presentationTimestamp - t.presentationTimestamp;
              });
              for (let t = 0; t < e.presentationTimestamps.length; t++) {
                let n = e.presentationTimestamps[t];
                let r = e.samples[n.sampleIndex];
                if (e.firstKeyFrameTimestamp === null && r.isKeyFrame) {
                  e.firstKeyFrameTimestamp = r.presentationTimestamp;
                }
                if (t < e.presentationTimestamps.length - 1) {
                  r.duration = e.presentationTimestamps[t + 1].presentationTimestamp - n.presentationTimestamp;
                }
              }
              let t = e.samples[e.presentationTimestamps[0].sampleIndex];
              let r = e.samples[i(e.presentationTimestamps).sampleIndex];
              e.startTimestamp = t.presentationTimestamp;
              e.endTimestamp = r.presentationTimestamp + r.duration;
              let {
                currentFragmentState: a
              } = this.currentTrack;
              n(a);
              if (a.startTimestamp !== null) {
                Jr(e, a.startTimestamp);
                e.startTimestampIsFinal = true;
              }
              if (a.encryptionAuxInfo && !e.samples[0].encryption) {
                e.encryptionAuxInfo = a.encryptionAuxInfo;
              }
            }
            this.currentTrack.currentFragmentState = null;
            this.currentTrack = null;
          }
          break;
        }
      case `pssh`:
        {
          if (this.input._formatOptions.isobmff?._suppressPsshParsing) {
            break;
          }
          let t = xr(B(e, a.contentSize));
          if (this.currentFragment) {
            this.currentFragment.psshBoxes.push(t);
          } else if (!this.currentTrack) {
            this.psshBoxes.push(t);
          }
        }
        break;
      case `tfhd`:
        {
          n(this.currentFragment);
          e.skip(1);
          let t = hl(e);
          let r = !!(t & 1);
          let i = !!(t & 2);
          let a = !!(t & 8);
          let o = !!(t & 16);
          let s = !!(t & 32);
          let c = !!(t & 65536);
          let l = !!(t & 131072);
          let u = U(e);
          let d = this.tracks.find(e => {
            return e.id === u;
          });
          if (!d) {
            break;
          }
          let f = this.fragmentTrackDefaults.find(e => {
            return e.trackId === u;
          });
          this.currentTrack = d;
          d.currentFragmentState = {
            baseDataOffset: this.currentFragment.implicitBaseDataOffset,
            sampleDescriptionIndex: f?.defaultSampleDescriptionIndex ?? null,
            defaultSampleDuration: f?.defaultSampleDuration ?? null,
            defaultSampleSize: f?.defaultSampleSize ?? null,
            defaultSampleFlags: f?.defaultSampleFlags ?? null,
            startTimestamp: null,
            encryptionAuxInfo: null
          };
          if (r) {
            d.currentFragmentState.baseDataOffset = Sl(e);
          } else if (l) {
            d.currentFragmentState.baseDataOffset = this.currentFragment.moofOffset;
          }
          if (i) {
            d.currentFragmentState.sampleDescriptionIndex = U(e);
          }
          if (a) {
            d.currentFragmentState.defaultSampleDuration = U(e);
          }
          if (o) {
            d.currentFragmentState.defaultSampleSize = U(e);
          }
          if (s) {
            d.currentFragmentState.defaultSampleFlags = U(e);
          }
          if (c) {
            d.currentFragmentState.defaultSampleDuration = 0;
          }
        }
        break;
      case `tfdt`:
        {
          let t = this.currentTrack;
          if (!t) {
            break;
          }
          n(t.currentFragmentState);
          let r = V(e);
          e.skip(3);
          let i = r === 0 ? U(e) : Sl(e);
          t.currentFragmentState.startTimestamp = i;
        }
        break;
      case `trun`:
        {
          let t = this.currentTrack;
          if (!t) {
            break;
          }
          n(this.currentFragment);
          n(t.currentFragmentState);
          let r = V(e);
          let i = hl(e);
          let a = !!(i & 1);
          let o = !!(i & 4);
          let s = !!(i & 256);
          let c = !!(i & 512);
          let l = !!(i & 1024);
          let u = !!(i & 2048);
          let d = U(e);
          let f = null;
          if (a) {
            f = yl(e);
          }
          let p = null;
          if (o) {
            p = U(e);
          }
          let m;
          if (this.currentFragment.trackData.has(t.id)) {
            m = this.currentFragment.trackData.get(t.id);
            if (f !== null) {
              m.currentOffset = t.currentFragmentState.baseDataOffset + f;
            }
          } else {
            m = {
              track: t,
              currentTimestamp: 0,
              currentOffset: t.currentFragmentState.baseDataOffset + (f ?? 0),
              startTimestamp: 0,
              endTimestamp: 0,
              firstKeyFrameTimestamp: null,
              samples: [],
              presentationTimestamps: [],
              startTimestampIsFinal: false,
              encryptionAuxInfo: null
            };
            this.currentFragment.trackData.set(t.id, m);
          }
          for (let i = 0; i < d; i++) {
            let a;
            if (s) {
              a = U(e);
            } else {
              n(t.currentFragmentState.defaultSampleDuration !== null);
              a = t.currentFragmentState.defaultSampleDuration;
            }
            let o;
            if (c) {
              o = U(e);
            } else {
              n(t.currentFragmentState.defaultSampleSize !== null);
              o = t.currentFragmentState.defaultSampleSize;
            }
            let d;
            if (l) {
              d = U(e);
            } else {
              n(t.currentFragmentState.defaultSampleFlags !== null);
              d = t.currentFragmentState.defaultSampleFlags;
            }
            if (i === 0 && p !== null) {
              d = p;
            }
            let f = 0;
            if (u) {
              if (r === 0) {
                f = U(e);
              } else {
                f = yl(e);
              }
            }
            let h = !(d & 65536);
            m.samples.push({
              presentationTimestamp: m.currentTimestamp + f,
              duration: a,
              byteOffset: m.currentOffset,
              byteSize: o,
              isKeyFrame: h,
              encryption: null
            });
            m.currentOffset += o;
            m.currentTimestamp += a;
          }
          this.currentFragment.implicitBaseDataOffset = m.currentOffset;
        }
        break;
      case `saiz`:
        {
          let t = this.currentTrack;
          if (!t || !t.encryptionInfo) {
            break;
          }
          e.skip(1);
          if (hl(e) & 1) {
            let n = W(e, 4);
            let r = U(e);
            if (n !== t.encryptionInfo.scheme || r !== 0) {
              break;
            }
          }
          let n = V(e);
          let r = U(e);
          let i = null;
          if (n === 0 && r > 0) {
            i = B(e, r);
          }
          let a = Zr(t);
          a.defaultSampleInfoSize = n;
          a.sampleSizes = i;
          a.sampleCount = r;
        }
        break;
      case `saio`:
        {
          let t = this.currentTrack;
          if (!t || !t.encryptionInfo) {
            break;
          }
          let n = V(e);
          if (hl(e) & 1) {
            let n = W(e, 4);
            let r = U(e);
            if (n !== t.encryptionInfo.scheme || r !== 0) {
              break;
            }
          }
          let r = U(e);
          if (r === 0) {
            break;
          }
          if (r > 1) {
            k._warn(`Multiple saio entries are not supported; using the first offset only.`);
          }
          let i = n === 0 ? U(e) : Number(Sl(e));
          if (this.currentFragment) {
            i += this.currentFragment.moofOffset;
          }
          let a = Zr(t);
          a.offset = i;
        }
        break;
      case `senc`:
        {
          let t = this.currentTrack;
          if (!t || !t.encryptionInfo) {
            break;
          }
          n(this.currentFragment);
          let r = this.currentFragment.trackData.get(t.id);
          if (!r) {
            break;
          }
          e.skip(1);
          let i = !!(hl(e) & 2);
          let a = U(e);
          let o = t.encryptionInfo.defaultPerSampleIvSize;
          n(o !== null);
          for (let n = 0; n < Math.min(a, r.samples.length); n++) {
            let a = new Uint8Array(16);
            if (o > 0) {
              a.set(B(e, o), 0);
            } else {
              a.set(t.encryptionInfo.defaultConstantIv, 0);
            }
            let s = null;
            if (i) {
              let t = H(e);
              s = [];
              for (let n = 0; n < t; n++) {
                let t = H(e);
                let n = U(e);
                s.push({
                  clearLen: t,
                  protectedLen: n
                });
              }
            }
            let c = r.samples[n];
            c.encryption = {
              iv: a,
              subsamples: s
            };
          }
        }
        break;
      case `udta`:
        {
          let t = this.iterateContiguousBoxes(e.slice(o, a.contentSize));
          for (let {
            boxInfo: e,
            slice: n
          } of t) {
            if (e.name !== `meta` && !this.currentTrack) {
              let t = n.filePos;
              this.metadataTags.raw ??= {};
              if (e.name[0] === `©`) {
                this.metadataTags.raw[e.name] ??= Dr(n);
              } else {
                this.metadataTags.raw[e.name] ??= B(n, e.contentSize);
              }
              n.filePos = t;
            }
            switch (e.name) {
              case `meta`:
                {
                  n.skip(-e.headerSize);
                  this.traverseBox(n);
                  break;
                }
              case `©nam`:
              case `name`:
                {
                  if (this.currentTrack) {
                    this.currentTrack.name = d.decode(B(n, e.contentSize));
                  } else {
                    this.metadataTags.title ??= Dr(n);
                  }
                  break;
                }
              case `©des`:
                {
                  if (!this.currentTrack) {
                    this.metadataTags.description ??= Dr(n);
                  }
                  break;
                }
              case `©ART`:
                {
                  if (!this.currentTrack) {
                    this.metadataTags.artist ??= Dr(n);
                  }
                  break;
                }
              case `©alb`:
                {
                  if (!this.currentTrack) {
                    this.metadataTags.album ??= Dr(n);
                  }
                  break;
                }
              case `albr`:
                {
                  if (!this.currentTrack) {
                    this.metadataTags.albumArtist ??= Dr(n);
                  }
                  break;
                }
              case `©gen`:
                {
                  if (!this.currentTrack) {
                    this.metadataTags.genre ??= Dr(n);
                  }
                  break;
                }
              case `©day`:
                {
                  if (!this.currentTrack) {
                    let e = new Date(Dr(n));
                    if (!Number.isNaN(e.getTime())) {
                      this.metadataTags.date ??= e;
                    }
                  }
                  break;
                }
              case `©cmt`:
                {
                  if (!this.currentTrack) {
                    this.metadataTags.comment ??= Dr(n);
                  }
                  break;
                }
              case `©lyr`:
                {
                  if (!this.currentTrack) {
                    this.metadataTags.lyrics ??= Dr(n);
                  }
                  break;
                }
            }
          }
        }
        break;
      case `meta`:
        {
          if (this.currentTrack) {
            break;
          }
          let t = U(e) !== 0;
          this.currentMetadataKeys = new Map();
          if (t) {
            this.readContiguousBoxes(e.slice(o, a.contentSize));
          } else {
            this.readContiguousBoxes(e.slice(o + 4, a.contentSize - 4));
          }
          this.currentMetadataKeys = null;
        }
        break;
      case `keys`:
        {
          if (!this.currentMetadataKeys) {
            break;
          }
          e.skip(4);
          let t = U(e);
          for (let n = 0; n < t; n++) {
            let t = U(e);
            e.skip(4);
            let r = d.decode(B(e, t - 8));
            this.currentMetadataKeys.set(n + 1, r);
          }
        }
        break;
      case `ilst`:
        {
          if (!this.currentMetadataKeys) {
            break;
          }
          let t = this.iterateContiguousBoxes(e.slice(o, a.contentSize));
          for (let {
            boxInfo: e,
            slice: n
          } of t) {
            let t = e.name;
            let r = (t.charCodeAt(0) << 24) + (t.charCodeAt(1) << 16) + (t.charCodeAt(2) << 8) + t.charCodeAt(3);
            if (this.currentMetadataKeys.has(r)) {
              t = this.currentMetadataKeys.get(r);
            }
            let i = Or(n);
            this.metadataTags.raw ??= {};
            this.metadataTags.raw[t] ??= i;
            switch (t) {
              case `©nam`:
              case `titl`:
              case `com.apple.quicktime.title`:
              case `title`:
                {
                  if (typeof i == `string`) {
                    this.metadataTags.title ??= i;
                  }
                  break;
                }
              case `©des`:
              case `desc`:
              case `dscp`:
              case `com.apple.quicktime.description`:
              case `description`:
                {
                  if (typeof i == `string`) {
                    this.metadataTags.description ??= i;
                  }
                  break;
                }
              case `©ART`:
              case `com.apple.quicktime.artist`:
              case `artist`:
                {
                  if (typeof i == `string`) {
                    this.metadataTags.artist ??= i;
                  }
                  break;
                }
              case `©alb`:
              case `albm`:
              case `com.apple.quicktime.album`:
              case `album`:
                {
                  if (typeof i == `string`) {
                    this.metadataTags.album ??= i;
                  }
                  break;
                }
              case `aART`:
              case `album_artist`:
                {
                  if (typeof i == `string`) {
                    this.metadataTags.albumArtist ??= i;
                  }
                  break;
                }
              case `©cmt`:
              case `com.apple.quicktime.comment`:
              case `comment`:
                {
                  if (typeof i == `string`) {
                    this.metadataTags.comment ??= i;
                  }
                  break;
                }
              case `©gen`:
              case `gnre`:
              case `com.apple.quicktime.genre`:
              case `genre`:
                {
                  if (typeof i == `string`) {
                    this.metadataTags.genre ??= i;
                  }
                  break;
                }
              case `©lyr`:
              case `lyrics`:
                {
                  if (typeof i == `string`) {
                    this.metadataTags.lyrics ??= i;
                  }
                  break;
                }
              case `©day`:
              case `rldt`:
              case `com.apple.quicktime.creationdate`:
              case `date`:
                {
                  if (typeof i == `string`) {
                    let e = new Date(i);
                    if (!Number.isNaN(e.getTime())) {
                      this.metadataTags.date ??= e;
                    }
                  }
                  break;
                }
              case `covr`:
              case `com.apple.quicktime.artwork`:
                {
                  if (i instanceof ht) {
                    this.metadataTags.images ??= [];
                    this.metadataTags.images.push({
                      data: i.data,
                      kind: `coverFront`,
                      mimeType: i.mimeType
                    });
                  } else if (i instanceof Uint8Array) {
                    this.metadataTags.images ??= [];
                    this.metadataTags.images.push({
                      data: i,
                      kind: `coverFront`,
                      mimeType: `image/*`
                    });
                  }
                  break;
                }
              case `track`:
                {
                  if (typeof i == `string`) {
                    let e = i.split(`/`);
                    let t = Number.parseInt(e[0], 10);
                    let n = e[1] && Number.parseInt(e[1], 10);
                    if (Number.isInteger(t) && t > 0) {
                      this.metadataTags.trackNumber ??= t;
                    }
                    if (n && Number.isInteger(n) && n > 0) {
                      this.metadataTags.tracksTotal ??= n;
                    }
                  }
                  break;
                }
              case `trkn`:
                {
                  if (i instanceof Uint8Array && i.length >= 6) {
                    let e = u(i);
                    let t = e.getUint16(2, false);
                    let n = e.getUint16(4, false);
                    if (t > 0) {
                      this.metadataTags.trackNumber ??= t;
                    }
                    if (n > 0) {
                      this.metadataTags.tracksTotal ??= n;
                    }
                  }
                  break;
                }
              case `disc`:
              case `disk`:
                {
                  if (i instanceof Uint8Array && i.length >= 6) {
                    let e = u(i);
                    let t = e.getUint16(2, false);
                    let n = e.getUint16(4, false);
                    if (t > 0) {
                      this.metadataTags.discNumber ??= t;
                    }
                    if (n > 0) {
                      this.metadataTags.discsTotal ??= n;
                    }
                  }
                  break;
                }
            }
          }
        }
        break;
    }
    e.filePos = s;
    return true;
  }
};
var Vr = class {
  constructor(e) {
    this.internalTrack = e;
    this.packetToSampleIndex = new WeakMap();
    this.packetToFragmentLocation = new WeakMap();
  }
  getId() {
    return this.internalTrack.id;
  }
  getNumber() {
    let e = this.internalTrack.demuxer;
    let t = this.internalTrack.trackBacking.getType();
    let n = 0;
    for (let r of e.tracks) {
      if (r.trackBacking.getType() === t) {
        n++;
      }
      if (r === this.internalTrack) {
        break;
      }
    }
    return n;
  }
  getCodec() {
    throw Error(`Not implemented on base class.`);
  }
  getInternalCodecId() {
    return this.internalTrack.internalCodecId;
  }
  getName() {
    return this.internalTrack.name;
  }
  getLanguageCode() {
    return this.internalTrack.languageCode;
  }
  getTimeResolution() {
    return this.internalTrack.timescale;
  }
  isRelativeToUnixEpoch() {
    return false;
  }
  getUnixTimeForTimestamp() {
    return null;
  }
  getDisposition() {
    return this.internalTrack.disposition;
  }
  getPairingMask() {
    return 1n;
  }
  getBitrate() {
    return null;
  }
  getAverageBitrate() {
    return null;
  }
  async getDurationFromMetadata() {
    let e = this.internalTrack;
    if (e.durationInMediaTimescale <= 0) {
      return null;
    } else {
      n(e.trackBacking);
      return ((await e.trackBacking.getFirstPacket({
        metadataOnly: true
      }))?.timestamp ?? 0) + e.durationInMediaTimescale / e.timescale;
    }
  }
  async getLiveRefreshInterval() {
    return null;
  }
  async getFirstPacket(e) {
    let t = await this.fetchPacketForSampleIndex(0, e);
    if (t || !this.internalTrack.demuxer.isFragmented) {
      return t;
    } else {
      return this.performFragmentedLookup(null, e => {
        if (e.trackData.get(this.internalTrack.id)) {
          return {
            sampleIndex: 0,
            correctSampleFound: true
          };
        } else {
          return {
            sampleIndex: -1,
            correctSampleFound: false
          };
        }
      }, -Infinity, Infinity, e);
    }
  }
  mapTimestampIntoTimescale(e) {
    return ge(e * this.internalTrack.timescale) + this.internalTrack.editListOffset;
  }
  async getPacket(e, t) {
    let n = this.mapTimestampIntoTimescale(e);
    let r = this.internalTrack.demuxer.getSampleTableForTrack(this.internalTrack);
    let i = Wr(r, n);
    let a = await this.fetchPacketForSampleIndex(i, t);
    if (!Xr(r) || !this.internalTrack.demuxer.isFragmented) {
      return a;
    } else {
      return this.performFragmentedLookup(null, e => {
        let t = e.trackData.get(this.internalTrack.id);
        if (!t) {
          return {
            sampleIndex: -1,
            correctSampleFound: false
          };
        }
        let r = T(t.presentationTimestamps, n, e => {
          return e.presentationTimestamp;
        });
        return {
          sampleIndex: r === -1 ? -1 : t.presentationTimestamps[r].sampleIndex,
          correctSampleFound: r !== -1 && n < t.endTimestamp
        };
      }, n, n, t);
    }
  }
  async getNextPacket(e, t) {
    let n = this.packetToSampleIndex.get(e);
    if (n !== undefined) {
      return this.fetchPacketForSampleIndex(n + 1, t);
    }
    let r = this.packetToFragmentLocation.get(e);
    if (r === undefined) {
      throw Error(`Packet was not created from this track.`);
    }
    return this.performFragmentedLookup(r.fragment, e => {
      if (e === r.fragment) {
        let t = e.trackData.get(this.internalTrack.id);
        if (r.sampleIndex + 1 < t.samples.length) {
          return {
            sampleIndex: r.sampleIndex + 1,
            correctSampleFound: true
          };
        }
      } else if (e.trackData.get(this.internalTrack.id)) {
        return {
          sampleIndex: 0,
          correctSampleFound: true
        };
      }
      return {
        sampleIndex: -1,
        correctSampleFound: false
      };
    }, -Infinity, Infinity, t);
  }
  async getKeyPacket(e, t) {
    let n = this.mapTimestampIntoTimescale(e);
    let r = this.internalTrack.demuxer.getSampleTableForTrack(this.internalTrack);
    let i = Gr(r, n);
    let a = await this.fetchPacketForSampleIndex(i, t);
    if (!Xr(r) || !this.internalTrack.demuxer.isFragmented) {
      return a;
    } else {
      return this.performFragmentedLookup(null, e => {
        let t = e.trackData.get(this.internalTrack.id);
        if (!t) {
          return {
            sampleIndex: -1,
            correctSampleFound: false
          };
        }
        let r = se(t.presentationTimestamps, e => {
          return t.samples[e.sampleIndex].isKeyFrame && e.presentationTimestamp <= n;
        });
        return {
          sampleIndex: r === -1 ? -1 : t.presentationTimestamps[r].sampleIndex,
          correctSampleFound: r !== -1 && n < t.endTimestamp
        };
      }, n, n, t);
    }
  }
  async getNextKeyPacket(e, t) {
    let r = this.packetToSampleIndex.get(e);
    if (r !== undefined) {
      let e = qr(this.internalTrack.demuxer.getSampleTableForTrack(this.internalTrack), r);
      return this.fetchPacketForSampleIndex(e, t);
    }
    let i = this.packetToFragmentLocation.get(e);
    if (i === undefined) {
      throw Error(`Packet was not created from this track.`);
    }
    return this.performFragmentedLookup(i.fragment, e => {
      if (e === i.fragment) {
        let t = e.trackData.get(this.internalTrack.id).samples.findIndex((e, t) => {
          return e.isKeyFrame && t > i.sampleIndex;
        });
        if (t !== -1) {
          return {
            sampleIndex: t,
            correctSampleFound: true
          };
        }
      } else {
        let t = e.trackData.get(this.internalTrack.id);
        if (t && t.firstKeyFrameTimestamp !== null) {
          let e = t.samples.findIndex(e => {
            return e.isKeyFrame;
          });
          n(e !== -1);
          return {
            sampleIndex: e,
            correctSampleFound: true
          };
        }
      }
      return {
        sampleIndex: -1,
        correctSampleFound: false
      };
    }, -Infinity, Infinity, t);
  }
  async fetchPacketForSampleIndex(e, t) {
    if (e === -1) {
      return null;
    }
    let r = Kr(this.internalTrack.demuxer.getSampleTableForTrack(this.internalTrack), e);
    if (!r) {
      return null;
    }
    let i;
    if (t.metadataOnly) {
      i = yr;
    } else {
      let t = this.internalTrack.demuxer.reader.requestSlice(r.sampleOffset, r.sampleSize);
      if (t instanceof Promise) {
        t = await t;
      }
      if (!t) {
        return null;
      }
      i = B(t, r.sampleSize);
      if (this.internalTrack.encryptionAuxInfo) {
        n(this.internalTrack.encryptionInfo);
        let t = await Qr(this.internalTrack.demuxer.reader, this.internalTrack.encryptionInfo, this.internalTrack.encryptionAuxInfo);
        if (e < t.length) {
          i = await $r(this.internalTrack, t[e], i, null);
        }
      }
    }
    let a = (r.presentationTimestamp - this.internalTrack.editListOffset) / this.internalTrack.timescale;
    let o = r.duration / this.internalTrack.timescale;
    let s = new I(i, r.isKeyFrame ? `key` : `delta`, a, o, e, r.sampleSize);
    this.packetToSampleIndex.set(s, e);
    return s;
  }
  async fetchPacketInFragment(e, t, r) {
    if (t === -1) {
      return null;
    }
    let i = e.trackData.get(this.internalTrack.id).samples[t];
    n(i);
    let a;
    if (r.metadataOnly) {
      a = yr;
    } else {
      let t = this.internalTrack.demuxer.reader.requestSlice(i.byteOffset, i.byteSize);
      if (t instanceof Promise) {
        t = await t;
      }
      if (!t) {
        return null;
      }
      a = B(t, i.byteSize);
      if (i.encryption) {
        a = await $r(this.internalTrack, i.encryption, a, e);
      }
    }
    let o = (i.presentationTimestamp - this.internalTrack.editListOffset) / this.internalTrack.timescale;
    let s = i.duration / this.internalTrack.timescale;
    let c = new I(a, i.isKeyFrame ? `key` : `delta`, o, s, e.moofOffset + t, i.byteSize);
    this.packetToFragmentLocation.set(c, {
      fragment: e,
      sampleIndex: t
    });
    return c;
  }
  async performFragmentedLookup(e, t, r, i, a) {
    let o = this.internalTrack.demuxer;
    let s = null;
    let c = null;
    let l = -1;
    if (e) {
      let {
        sampleIndex: n,
        correctSampleFound: r
      } = t(e);
      if (r) {
        return this.fetchPacketInFragment(e, n, a);
      }
      if (n !== -1) {
        c = e;
        l = n;
      }
    }
    let u = T(this.internalTrack.fragmentLookupTable, r, e => {
      return e.timestamp;
    });
    let d = u === -1 ? null : this.internalTrack.fragmentLookupTable[u];
    let f = T(this.internalTrack.fragmentPositionCache, r, e => {
      return e.startTimestamp;
    });
    let p = f === -1 ? null : this.internalTrack.fragmentPositionCache[f];
    let m = Math.max(d?.moofOffset ?? 0, p?.moofOffset ?? 0) || null;
    let h;
    h = e.moofOffset + e.moofSize;
    for (e ? m === null || e.moofOffset >= m ? s = e : h = m : h = m ?? 0;;) {
      if (s) {
        let e = s.trackData.get(this.internalTrack.id);
        if (e && e.startTimestamp > i) {
          break;
        }
      }
      let e = o.reader.requestSliceRange(h, 8, 16);
      if (e instanceof Promise) {
        e = await e;
      }
      if (!e) {
        break;
      }
      let n = h;
      let r = Cr(e);
      if (!r) {
        break;
      }
      if (r.name === `moof`) {
        s = await o.readFragment(n);
        let {
          sampleIndex: e,
          correctSampleFound: r
        } = t(s);
        if (r) {
          return this.fetchPacketInFragment(s, e, a);
        }
        if (e !== -1) {
          c = s;
          l = e;
        }
      }
      h = n + r.totalSize;
    }
    if (d && (!c || c.moofOffset < d.moofOffset)) {
      let e = this.internalTrack.fragmentLookupTable[u - 1];
      n(!e || e.timestamp < d.timestamp);
      let r = e?.timestamp ?? -Infinity;
      return this.performFragmentedLookup(null, t, r, i, a);
    }
    if (c) {
      return this.fetchPacketInFragment(c, l, a);
    } else {
      return null;
    }
  }
};
var Hr = class extends Vr {
  constructor(e) {
    super(e);
    this.decoderConfigPromise = null;
    this.internalTrack = e;
  }
  getType() {
    return `video`;
  }
  getCodec() {
    return this.internalTrack.info.codec;
  }
  getCodedWidth() {
    return this.internalTrack.info.width;
  }
  getCodedHeight() {
    return this.internalTrack.info.height;
  }
  getSquarePixelWidth() {
    return this.internalTrack.info.squarePixelWidth;
  }
  getSquarePixelHeight() {
    return this.internalTrack.info.squarePixelHeight;
  }
  getRotation() {
    return this.internalTrack.rotation;
  }
  async getColorSpace() {
    return {
      primaries: this.internalTrack.info.colorSpace?.primaries,
      transfer: this.internalTrack.info.colorSpace?.transfer,
      matrix: this.internalTrack.info.colorSpace?.matrix,
      fullRange: this.internalTrack.info.colorSpace?.fullRange
    };
  }
  async canBeTransparent() {
    return this.internalTrack.info.codec === `prores` && (this.internalTrack.info.proresFormat === `ap4h` || this.internalTrack.info.proresFormat === `ap4x`);
  }
  async getDecoderConfig() {
    if (this.internalTrack.info.codec) {
      return this.decoderConfigPromise ??= (async () => {
        if (this.internalTrack.info.codec === `vp9` && !this.internalTrack.info.vp9CodecInfo) {
          let e = await this.getFirstPacket({});
          this.internalTrack.info.vp9CodecInfo = e && Xn(e.data);
        } else if (this.internalTrack.info.codec === `av1` && !this.internalTrack.info.av1CodecInfo) {
          let e = await this.getFirstPacket({});
          this.internalTrack.info.av1CodecInfo = e && Qn(e.data);
        }
        let e = {
          codec: Bt(this.internalTrack.info),
          codedWidth: this.internalTrack.info.width,
          codedHeight: this.internalTrack.info.height,
          description: this.internalTrack.info.codecDescription ?? undefined,
          colorSpace: this.internalTrack.info.colorSpace ?? undefined
        };
        if (this.internalTrack.info.width !== this.internalTrack.info.squarePixelWidth || this.internalTrack.info.height !== this.internalTrack.info.squarePixelHeight) {
          e.displayAspectWidth = this.internalTrack.info.squarePixelWidth;
          e.displayAspectHeight = this.internalTrack.info.squarePixelHeight;
        }
        return e;
      })();
    } else {
      return null;
    }
  }
};
var Ur = class extends Vr {
  constructor(e) {
    super(e);
    this.decoderConfig = null;
    this.internalTrack = e;
  }
  getType() {
    return `audio`;
  }
  getCodec() {
    return this.internalTrack.info.codec;
  }
  getNumberOfChannels() {
    return this.internalTrack.info.numberOfChannels;
  }
  getSampleRate() {
    return this.internalTrack.info.sampleRate;
  }
  async getDecoderConfig() {
    if (this.internalTrack.info.codec) {
      return this.decoderConfig ??= {
        codec: Ht(this.internalTrack.info),
        numberOfChannels: this.internalTrack.info.numberOfChannels,
        sampleRate: this.internalTrack.info.sampleRate,
        description: this.internalTrack.info.codecDescription ?? undefined
      };
    } else {
      return null;
    }
  }
};
var Wr = (e, t) => {
  if (e.presentationTimestamps) {
    let n = T(e.presentationTimestamps, t, e => {
      return e.presentationTimestamp;
    });
    if (n === -1) {
      return -1;
    } else {
      return e.presentationTimestamps[n].sampleIndex;
    }
  } else {
    let n = T(e.sampleTimingEntries, t, e => {
      return e.startDecodeTimestamp;
    });
    if (n === -1) {
      return -1;
    }
    let r = e.sampleTimingEntries[n];
    return r.startIndex + Math.min(Math.floor((t - r.startDecodeTimestamp) / r.delta), r.count - 1);
  }
};
var Gr = (e, t) => {
  if (!e.keySampleIndices) {
    return Wr(e, t);
  }
  if (e.presentationTimestamps) {
    let n = T(e.presentationTimestamps, t, e => {
      return e.presentationTimestamp;
    });
    if (n === -1) {
      return -1;
    }
    for (let t = n; t >= 0; t--) {
      let n = e.presentationTimestamps[t].sampleIndex;
      if (re(e.keySampleIndices, n, e => {
        return e;
      }) !== -1) {
        return n;
      }
    }
    return -1;
  } else {
    let n = Wr(e, t);
    let r = T(e.keySampleIndices, n, e => {
      return e;
    });
    return e.keySampleIndices[r] ?? -1;
  }
};
var Kr = (e, t) => {
  let r = T(e.sampleTimingEntries, t, e => {
    return e.startIndex;
  });
  let i = e.sampleTimingEntries[r];
  if (!i || i.startIndex + i.count <= t) {
    return null;
  }
  let a = i.startDecodeTimestamp + (t - i.startIndex) * i.delta;
  let o = T(e.sampleCompositionTimeOffsets, t, e => {
    return e.startIndex;
  });
  let s = e.sampleCompositionTimeOffsets[o];
  if (s && t - s.startIndex < s.count) {
    a += s.offset;
  }
  let c = e.sampleSizes[Math.min(t, e.sampleSizes.length - 1)];
  let l = T(e.sampleToChunk, t, e => {
    return e.startSampleIndex;
  });
  let u = e.sampleToChunk[l];
  n(u);
  let d = u.startChunkIndex + Math.floor((t - u.startSampleIndex) / u.samplesPerChunk);
  let f = e.chunkOffsets[d];
  let p = u.startSampleIndex + (d - u.startChunkIndex) * u.samplesPerChunk;
  let m = 0;
  let h = f;
  if (e.sampleSizes.length === 1) {
    h += c * (t - p);
    m += c * u.samplesPerChunk;
  } else {
    for (let n = p; n < p + u.samplesPerChunk; n++) {
      let r = e.sampleSizes[n];
      if (n < t) {
        h += r;
      }
      m += r;
    }
  }
  let g = i.delta;
  if (e.presentationTimestamps) {
    let r = e.presentationTimestampIndexMap[t];
    n(r !== undefined);
    if (r < e.presentationTimestamps.length - 1) {
      g = e.presentationTimestamps[r + 1].presentationTimestamp - a;
    }
  }
  return {
    presentationTimestamp: a,
    duration: g,
    sampleOffset: h,
    sampleSize: c,
    chunkOffset: f,
    chunkSize: m,
    isKeyFrame: e.keySampleIndices ? re(e.keySampleIndices, t, e => {
      return e;
    }) !== -1 : true
  };
};
var qr = (e, t) => {
  if (!e.keySampleIndices) {
    return t + 1;
  }
  let n = T(e.keySampleIndices, t, e => {
    return e;
  });
  return e.keySampleIndices[n + 1] ?? -1;
};
var Jr = (e, t) => {
  e.startTimestamp += t;
  e.endTimestamp += t;
  for (let n of e.samples) {
    n.presentationTimestamp += t;
  }
  for (let n of e.presentationTimestamps) {
    n.presentationTimestamp += t;
  }
};
var Yr = e => {
  let [t, n] = e;
  let r = Math.atan2(n, t);
  if (Number.isFinite(r)) {
    return 180 / Math.PI * r;
  } else {
    return 0;
  }
};
var Xr = e => {
  return e.sampleSizes.length === 0;
};
var Zr = e => {
  if (e.currentFragmentState) {
    return e.currentFragmentState.encryptionAuxInfo ??= {
      defaultSampleInfoSize: 0,
      sampleSizes: null,
      sampleCount: 0,
      offset: null,
      resolved: null
    };
  } else {
    return e.encryptionAuxInfo ??= {
      defaultSampleInfoSize: 0,
      sampleSizes: null,
      sampleCount: 0,
      offset: null,
      resolved: null
    };
  }
};
var Qr = async (e, t, r) => {
  if (r.resolved) {
    return r.resolved;
  }
  if (r.offset === null || r.sampleCount === 0) {
    throw Error(`Incomplete saiz/saio info; cannot resolve encryption data.`);
  }
  let i = 0;
  if (r.defaultSampleInfoSize > 0) {
    i = r.defaultSampleInfoSize * r.sampleCount;
  } else {
    n(r.sampleSizes);
    for (let e = 0; e < r.sampleCount; e++) {
      i += r.sampleSizes[e];
    }
  }
  let a = e.requestSlice(r.offset, i);
  if (a instanceof Promise) {
    a = await a;
  }
  if (!a) {
    throw Error(`Failed to read auxiliary encryption info.`);
  }
  let o = t.defaultPerSampleIvSize;
  n(o !== null);
  let s = [];
  for (let e = 0; e < r.sampleCount; e++) {
    let n = r.defaultSampleInfoSize > 0 ? r.defaultSampleInfoSize : r.sampleSizes[e];
    let i = new Uint8Array(16);
    if (o > 0) {
      i.set(B(a, o), 0);
    } else {
      i.set(t.defaultConstantIv, 0);
    }
    let c = null;
    if (n > o) {
      let e = H(a);
      c = [];
      for (let t = 0; t < e; t++) {
        let e = H(a);
        let t = U(a);
        c.push({
          clearLen: e,
          protectedLen: t
        });
      }
    }
    s.push({
      iv: i,
      subsamples: c
    });
  }
  r.resolved = s;
  return s;
};
var $r = async (e, t, r, i) => {
  n(e.encryptionInfo);
  let a = e.encryptionInfo;
  n(a.defaultKid !== null);
  let o = a.defaultKid;
  let s;
  let c = e.demuxer.decryptionKeyCache.get(o);
  if (c) {
    s = await c;
  } else {
    if (!e.demuxer.input._formatOptions.isobmff?.resolveKeyId) {
      throw Error(`Encrypted media samples encountered. To decrypt them, please provide a callback for InputOptions.formatOptions.isobmff.resolveKeyId.`);
    }
    let t = (async () => {
      let t = e.demuxer.psshBoxes;
      if (i) {
        t = [...t, ...i.psshBoxes].filter(e => {
          return e.keyIds === null || e.keyIds.includes(o);
        });
        for (let e = 0; e < t.length - 1; e++) {
          for (let n = e + 1; n < t.length; n++) {
            if (Sr(t[e], t[n])) {
              t.splice(n, 1);
              n--;
            }
          }
        }
      }
      let n = await e.demuxer.input._formatOptions.isobmff.resolveKeyId({
        keyId: o,
        psshBoxes: t
      });
      if ((typeof n != `string` || n.length !== 32 || !ee.test(n)) && (!(n instanceof Uint8Array) || n.byteLength !== 16)) {
        throw TypeError(`resolveKeyId must return a 32-character hex string or a 16-byte Uint8Array containing the decryption key.`);
      }
      if (n instanceof Uint8Array) {
        return n;
      } else {
        return te(n);
      }
    })();
    e.demuxer.decryptionKeyCache.set(o, t);
    s = await t;
  }
  if (a.scheme === `cenc` || a.scheme === `cens`) {
    return ei(s, a, t, r);
  } else {
    return ti(s, a, t, r);
  }
};
var ei = async (e, t, r, i) => {
  let a = new Uint8Array(16);
  a.set(r.iv, 0);
  let o = await crypto.subtle.importKey(`raw`, e, {
    name: `AES-CTR`
  }, false, [`decrypt`]);
  let s = async e => {
    let t = await crypto.subtle.decrypt({
      name: `AES-CTR`,
      counter: a,
      length: 64
    }, o, e);
    return new Uint8Array(t);
  };
  if (!r.subsamples) {
    return s(i);
  }
  n(t.defaultCryptByteBlock !== null && t.defaultSkipByteBlock !== null);
  let c = ni(r.subsamples, t.defaultCryptByteBlock, t.defaultSkipByteBlock);
  let l = 0;
  for (let e of c) {
    for (let t of e.perSubsample) {
      l += t.length;
    }
  }
  let u = new Uint8Array(l);
  let d = 0;
  for (let e of c) {
    for (let t of e.perSubsample) {
      u.set(i.subarray(t.offset, t.offset + t.length), d);
      d += t.length;
    }
  }
  let f = await s(u);
  let p = new Uint8Array(i);
  let m = 0;
  for (let e of c) {
    for (let t of e.perSubsample) {
      p.set(f.subarray(m, m + t.length), t.offset);
      m += t.length;
    }
  }
  return p;
};
var ti = (e, t, r, i) => {
  let a = new Rr();
  a.init({
    key: e,
    iv: r.iv
  });
  let o = t.defaultCryptByteBlock;
  let s = t.defaultSkipByteBlock;
  n(o !== null && s !== null);
  if (!r.subsamples) {
    let e = new Uint8Array(i);
    let t = Math.floor(i.length / 16);
    for (let n = 0; n < t; n++) {
      let t = n * 16;
      a.in.set(i.subarray(t, t + 16));
      a.decrypt();
      e.set(a.out, t);
    }
    return e;
  }
  if (o === 0 && s === 0) {
    throw Error(`cbcs with subsamples requires pattern encryption.`);
  }
  let c = new Uint8Array(i);
  let l = ni(r.subsamples, o, s);
  let u = new DataView(r.iv.buffer, r.iv.byteOffset, 16);
  for (let e of l) {
    a.iv[0] = u.getUint32(0, false);
    a.iv[1] = u.getUint32(4, false);
    a.iv[2] = u.getUint32(8, false);
    a.iv[3] = u.getUint32(12, false);
    for (let t of e.perSubsample) {
      let e = t.length / 16;
      for (let n = 0; n < e; n++) {
        let e = t.offset + n * 16;
        a.in.set(i.subarray(e, e + 16));
        a.decrypt();
        c.set(a.out, e);
      }
    }
  }
  return c;
};
var ni = (e, t, n) => {
  let r = [];
  let i = t !== 0 || n !== 0;
  let a = 0;
  for (let o of e) {
    a += o.clearLen;
    let e = [];
    if (!i) {
      if (o.protectedLen > 0) {
        e.push({
          offset: a,
          length: o.protectedLen
        });
      }
      a += o.protectedLen;
    } else {
      let r = o.protectedLen;
      let i = a;
      while (r > 0 && !(r < t * 16)) {
        let a = t * 16;
        e.push({
          offset: i,
          length: a
        });
        i += a;
        r -= a;
        let o = Math.min(n * 16, r);
        i += o;
        r -= o;
      }
      a += o.protectedLen;
    }
    r.push({
      perSubsample: e
    });
  }
  return r;
};
var ri = class {
  constructor(e) {
    this.value = e;
  }
};
var ii = class {
  constructor(e) {
    this.value = e;
  }
};
var ai = class {
  constructor(e) {
    this.value = e;
  }
};
var oi = class {
  constructor(e) {
    this.value = e;
  }
};
var L;
(function (e) {
  e[e.EBML = 440786851] = `EBML`;
  e[e.EBMLVersion = 17030] = `EBMLVersion`;
  e[e.EBMLReadVersion = 17143] = `EBMLReadVersion`;
  e[e.EBMLMaxIDLength = 17138] = `EBMLMaxIDLength`;
  e[e.EBMLMaxSizeLength = 17139] = `EBMLMaxSizeLength`;
  e[e.DocType = 17026] = `DocType`;
  e[e.DocTypeVersion = 17031] = `DocTypeVersion`;
  e[e.DocTypeReadVersion = 17029] = `DocTypeReadVersion`;
  e[e.Void = 236] = `Void`;
  e[e.Segment = 408125543] = `Segment`;
  e[e.SeekHead = 290298740] = `SeekHead`;
  e[e.Seek = 19899] = `Seek`;
  e[e.SeekID = 21419] = `SeekID`;
  e[e.SeekPosition = 21420] = `SeekPosition`;
  e[e.Duration = 17545] = `Duration`;
  e[e.Info = 357149030] = `Info`;
  e[e.TimestampScale = 2807729] = `TimestampScale`;
  e[e.MuxingApp = 19840] = `MuxingApp`;
  e[e.WritingApp = 22337] = `WritingApp`;
  e[e.Tracks = 374648427] = `Tracks`;
  e[e.TrackEntry = 174] = `TrackEntry`;
  e[e.TrackNumber = 215] = `TrackNumber`;
  e[e.TrackUID = 29637] = `TrackUID`;
  e[e.TrackType = 131] = `TrackType`;
  e[e.FlagEnabled = 185] = `FlagEnabled`;
  e[e.FlagDefault = 136] = `FlagDefault`;
  e[e.FlagForced = 21930] = `FlagForced`;
  e[e.FlagOriginal = 21934] = `FlagOriginal`;
  e[e.FlagHearingImpaired = 21931] = `FlagHearingImpaired`;
  e[e.FlagVisualImpaired = 21932] = `FlagVisualImpaired`;
  e[e.FlagCommentary = 21935] = `FlagCommentary`;
  e[e.FlagLacing = 156] = `FlagLacing`;
  e[e.Name = 21358] = `Name`;
  e[e.Language = 2274716] = `Language`;
  e[e.LanguageBCP47 = 2274717] = `LanguageBCP47`;
  e[e.CodecID = 134] = `CodecID`;
  e[e.CodecPrivate = 25506] = `CodecPrivate`;
  e[e.CodecDelay = 22186] = `CodecDelay`;
  e[e.SeekPreRoll = 22203] = `SeekPreRoll`;
  e[e.DefaultDuration = 2352003] = `DefaultDuration`;
  e[e.Video = 224] = `Video`;
  e[e.PixelWidth = 176] = `PixelWidth`;
  e[e.PixelHeight = 186] = `PixelHeight`;
  e[e.DisplayWidth = 21680] = `DisplayWidth`;
  e[e.DisplayHeight = 21690] = `DisplayHeight`;
  e[e.DisplayUnit = 21682] = `DisplayUnit`;
  e[e.AlphaMode = 21440] = `AlphaMode`;
  e[e.Audio = 225] = `Audio`;
  e[e.SamplingFrequency = 181] = `SamplingFrequency`;
  e[e.Channels = 159] = `Channels`;
  e[e.BitDepth = 25188] = `BitDepth`;
  e[e.SimpleBlock = 163] = `SimpleBlock`;
  e[e.BlockGroup = 160] = `BlockGroup`;
  e[e.Block = 161] = `Block`;
  e[e.BlockAdditions = 30113] = `BlockAdditions`;
  e[e.BlockMore = 166] = `BlockMore`;
  e[e.BlockAdditional = 165] = `BlockAdditional`;
  e[e.BlockAddID = 238] = `BlockAddID`;
  e[e.BlockDuration = 155] = `BlockDuration`;
  e[e.ReferenceBlock = 251] = `ReferenceBlock`;
  e[e.Cluster = 524531317] = `Cluster`;
  e[e.Timestamp = 231] = `Timestamp`;
  e[e.Cues = 475249515] = `Cues`;
  e[e.CuePoint = 187] = `CuePoint`;
  e[e.CueTime = 179] = `CueTime`;
  e[e.CueTrackPositions = 183] = `CueTrackPositions`;
  e[e.CueTrack = 247] = `CueTrack`;
  e[e.CueClusterPosition = 241] = `CueClusterPosition`;
  e[e.Colour = 21936] = `Colour`;
  e[e.MatrixCoefficients = 21937] = `MatrixCoefficients`;
  e[e.TransferCharacteristics = 21946] = `TransferCharacteristics`;
  e[e.Primaries = 21947] = `Primaries`;
  e[e.Range = 21945] = `Range`;
  e[e.Projection = 30320] = `Projection`;
  e[e.ProjectionType = 30321] = `ProjectionType`;
  e[e.ProjectionPoseRoll = 30325] = `ProjectionPoseRoll`;
  e[e.Attachments = 423732329] = `Attachments`;
  e[e.AttachedFile = 24999] = `AttachedFile`;
  e[e.FileDescription = 18046] = `FileDescription`;
  e[e.FileName = 18030] = `FileName`;
  e[e.FileMediaType = 18016] = `FileMediaType`;
  e[e.FileData = 18012] = `FileData`;
  e[e.FileUID = 18094] = `FileUID`;
  e[e.Chapters = 272869232] = `Chapters`;
  e[e.Tags = 307544935] = `Tags`;
  e[e.Tag = 29555] = `Tag`;
  e[e.Targets = 25536] = `Targets`;
  e[e.TargetTypeValue = 26826] = `TargetTypeValue`;
  e[e.TargetType = 25546] = `TargetType`;
  e[e.TagTrackUID = 25541] = `TagTrackUID`;
  e[e.TagEditionUID = 25545] = `TagEditionUID`;
  e[e.TagChapterUID = 25540] = `TagChapterUID`;
  e[e.TagAttachmentUID = 25542] = `TagAttachmentUID`;
  e[e.SimpleTag = 26568] = `SimpleTag`;
  e[e.TagName = 17827] = `TagName`;
  e[e.TagLanguage = 17530] = `TagLanguage`;
  e[e.TagString = 17543] = `TagString`;
  e[e.TagBinary = 17541] = `TagBinary`;
  e[e.ContentEncodings = 28032] = `ContentEncodings`;
  e[e.ContentEncoding = 25152] = `ContentEncoding`;
  e[e.ContentEncodingOrder = 20529] = `ContentEncodingOrder`;
  e[e.ContentEncodingScope = 20530] = `ContentEncodingScope`;
  e[e.ContentCompression = 20532] = `ContentCompression`;
  e[e.ContentCompAlgo = 16980] = `ContentCompAlgo`;
  e[e.ContentCompSettings = 16981] = `ContentCompSettings`;
  e[e.ContentEncryption = 20533] = `ContentEncryption`;
})(L ||= {});
var si = [L.EBML, L.Segment];
var ci = [L.SeekHead, L.Info, L.Cluster, L.Tracks, L.Cues, L.Attachments, L.Chapters, L.Tags];
var li = [...si, ...ci];
var ui = e => {
  if (e < 256) {
    return 1;
  } else {
    if (e < 65536) {
      return 2;
    } else {
      if (e < 16777216) {
        return 3;
      } else {
        if (e < 4294967296) {
          return 4;
        } else {
          if (e < 1099511627776) {
            return 5;
          } else {
            return 6;
          }
        }
      }
    }
  }
};
var di = e => {
  if (e < 1n << 8n) {
    return 1;
  } else {
    if (e < 1n << 16n) {
      return 2;
    } else {
      if (e < 1n << 24n) {
        return 3;
      } else {
        if (e < 1n << 32n) {
          return 4;
        } else {
          if (e < 1n << 40n) {
            return 5;
          } else {
            if (e < 1n << 48n) {
              return 6;
            } else {
              if (e < 1n << 56n) {
                return 7;
              } else {
                return 8;
              }
            }
          }
        }
      }
    }
  }
};
var fi = e => {
  if (e >= -64 && e < 64) {
    return 1;
  } else {
    if (e >= -8192 && e < 8192) {
      return 2;
    } else {
      if (e >= -1048576 && e < 1048576) {
        return 3;
      } else {
        if (e >= -134217728 && e < 134217728) {
          return 4;
        } else {
          if (e >= -17179869184 && e < 17179869184) {
            return 5;
          } else {
            return 6;
          }
        }
      }
    }
  }
};
var pi = e => {
  if (e < 127) {
    return 1;
  }
  if (e < 16383) {
    return 2;
  }
  if (e < 2097151) {
    return 3;
  }
  if (e < 268435455) {
    return 4;
  }
  if (e < 34359738367) {
    return 5;
  }
  if (e < 4398046511103) {
    return 6;
  }
  throw Error(`EBML varint size not supported ${e}`);
};
var mi = class {
  constructor(e) {
    this.writer = e;
    this.helper = new Uint8Array(8);
    this.helperView = new DataView(this.helper.buffer);
    this.offsets = new WeakMap();
    this.dataOffsets = new WeakMap();
  }
  writeByte(e) {
    this.helperView.setUint8(0, e);
    this.writer.write(this.helper.subarray(0, 1));
  }
  writeFloat32(e) {
    this.helperView.setFloat32(0, e, false);
    this.writer.write(this.helper.subarray(0, 4));
  }
  writeFloat64(e) {
    this.helperView.setFloat64(0, e, false);
    this.writer.write(this.helper);
  }
  writeUnsignedInt(e, t = ui(e)) {
    let n = 0;
    switch (t) {
      case 6:
        {
          this.helperView.setUint8(n++, e / 1099511627776 | 0);
        }
      case 5:
        {
          this.helperView.setUint8(n++, e / 4294967296 | 0);
        }
      case 4:
        {
          this.helperView.setUint8(n++, e >> 24);
        }
      case 3:
        {
          this.helperView.setUint8(n++, e >> 16);
        }
      case 2:
        {
          this.helperView.setUint8(n++, e >> 8);
        }
      case 1:
        {
          this.helperView.setUint8(n++, e);
          break;
        }
      default:
        {
          throw Error(`Bad unsigned int size ${t}`);
        }
    }
    this.writer.write(this.helper.subarray(0, n));
  }
  writeUnsignedBigInt(e, t = di(e)) {
    let n = 0;
    for (let r = t - 1; r >= 0; r--) {
      this.helperView.setUint8(n++, Number(e >> BigInt(r * 8) & 255n));
    }
    this.writer.write(this.helper.subarray(0, n));
  }
  writeSignedInt(e, t = fi(e)) {
    if (e < 0) {
      e += 2 ** (t * 8);
    }
    this.writeUnsignedInt(e, t);
  }
  writeVarInt(e, t = pi(e)) {
    let n = 0;
    switch (t) {
      case 1:
        {
          this.helperView.setUint8(n++, e | 128);
          break;
        }
      case 2:
        {
          this.helperView.setUint8(n++, e >> 8 | 64);
          this.helperView.setUint8(n++, e);
          break;
        }
      case 3:
        {
          this.helperView.setUint8(n++, e >> 16 | 32);
          this.helperView.setUint8(n++, e >> 8);
          this.helperView.setUint8(n++, e);
          break;
        }
      case 4:
        {
          this.helperView.setUint8(n++, e >> 24 | 16);
          this.helperView.setUint8(n++, e >> 16);
          this.helperView.setUint8(n++, e >> 8);
          this.helperView.setUint8(n++, e);
          break;
        }
      case 5:
        {
          this.helperView.setUint8(n++, e / 4294967296 & 7 | 8);
          this.helperView.setUint8(n++, e >> 24);
          this.helperView.setUint8(n++, e >> 16);
          this.helperView.setUint8(n++, e >> 8);
          this.helperView.setUint8(n++, e);
          break;
        }
      case 6:
        {
          this.helperView.setUint8(n++, e / 1099511627776 & 3 | 4);
          this.helperView.setUint8(n++, e / 4294967296 | 0);
          this.helperView.setUint8(n++, e >> 24);
          this.helperView.setUint8(n++, e >> 16);
          this.helperView.setUint8(n++, e >> 8);
          this.helperView.setUint8(n++, e);
          break;
        }
      default:
        {
          throw Error(`Bad EBML varint size ${t}`);
        }
    }
    this.writer.write(this.helper.subarray(0, n));
  }
  writeAsciiString(e) {
    this.writer.write(new Uint8Array(e.split(``).map(e => {
      return e.charCodeAt(0);
    })));
  }
  writeEBML(e) {
    if (e !== null) {
      if (e instanceof Uint8Array) {
        this.writer.write(e);
      } else if (Array.isArray(e)) {
        for (let t of e) {
          this.writeEBML(t);
        }
      } else {
        this.offsets.set(e, this.writer.getPos());
        this.writeUnsignedInt(e.id);
        if (Array.isArray(e.data)) {
          let t = this.writer.getPos();
          let n = e.size === -1 ? 1 : e.size ?? 4;
          if (e.size === -1) {
            this.writeByte(255);
          } else {
            this.writer.seek(this.writer.getPos() + n);
          }
          let r = this.writer.getPos();
          this.dataOffsets.set(e, r);
          this.writeEBML(e.data);
          if (e.size !== -1) {
            let e = this.writer.getPos() - r;
            let i = this.writer.getPos();
            this.writer.seek(t);
            this.writeVarInt(e, n);
            this.writer.seek(i);
          }
        } else if (typeof e.data == `number`) {
          let t = e.size ?? ui(e.data);
          this.writeVarInt(t);
          this.writeUnsignedInt(e.data, t);
        } else if (typeof e.data == `bigint`) {
          let t = e.size ?? di(e.data);
          this.writeVarInt(t);
          this.writeUnsignedBigInt(e.data, t);
        } else if (typeof e.data == `string`) {
          this.writeVarInt(e.data.length);
          this.writeAsciiString(e.data);
        } else if (e.data instanceof Uint8Array) {
          this.writeVarInt(e.data.byteLength, e.size);
          this.writer.write(e.data);
        } else if (e.data instanceof ri) {
          this.writeVarInt(4);
          this.writeFloat32(e.data.value);
        } else if (e.data instanceof ii) {
          this.writeVarInt(8);
          this.writeFloat64(e.data.value);
        } else if (e.data instanceof ai) {
          let t = e.size ?? fi(e.data.value);
          this.writeVarInt(t);
          this.writeSignedInt(e.data.value, t);
        } else if (e.data instanceof oi) {
          let t = f.encode(e.data.value);
          this.writeVarInt(t.length);
          this.writer.write(t);
        } else {
          D(e.data);
        }
      }
    }
  }
};
var hi = e => {
  if (e.remainingLength < 1) {
    return null;
  }
  let t = V(e);
  e.skip(-1);
  if (t === 0) {
    return null;
  }
  let n = 1;
  let r = 128;
  while ((t & r) === 0) {
    n++;
    r >>= 1;
  }
  if (e.remainingLength < n) {
    return null;
  } else {
    return n;
  }
};
var gi = e => {
  if (e.remainingLength < 1) {
    return null;
  }
  let t = V(e);
  if (t === 0) {
    return null;
  }
  let n = 1;
  let r = 128;
  while ((t & r) === 0) {
    n++;
    r >>= 1;
  }
  if (e.remainingLength < n - 1) {
    return null;
  }
  let i = t & r - 1;
  for (let t = 1; t < n; t++) {
    i *= 256;
    i += V(e);
  }
  return i;
};
var R = (e, t) => {
  if (t < 1 || t > 8) {
    throw Error(`Bad unsigned int size ${t}`);
  }
  let n = 0;
  for (let r = 0; r < t; r++) {
    n *= 256;
    n += V(e);
  }
  return n;
};
var _i = (e, t) => {
  if (t < 1) {
    throw Error(`Bad unsigned int size ${t}`);
  }
  let n = 0n;
  for (let r = 0; r < t; r++) {
    n <<= 8n;
    n += BigInt(V(e));
  }
  return n;
};
var vi = e => {
  let t = hi(e);
  if (t === null || e.remainingLength < t) {
    return null;
  } else {
    return R(e, t);
  }
};
var yi = e => {
  if (e.remainingLength < 1) {
    return null;
  }
  if (V(e) === 255) {
    return;
  }
  e.skip(-1);
  let t = gi(e);
  if (t === null) {
    return null;
  }
  if (t !== 72057594037927940) {
    return t;
  }
};
var bi = e => {
  n(e.remainingLength >= 2);
  let t = vi(e);
  if (t === null) {
    return null;
  }
  let r = yi(e);
  if (r === null) {
    return null;
  } else {
    return {
      id: t,
      size: r
    };
  }
};
var xi = (e, t) => {
  let n = B(e, t);
  let r = 0;
  while (r < t && n[r] !== 0) {
    r += 1;
  }
  return String.fromCharCode(...n.subarray(0, r));
};
var Si = (e, t) => {
  let n = B(e, t);
  let r = 0;
  while (r < t && n[r] !== 0) {
    r += 1;
  }
  return d.decode(n.subarray(0, r));
};
var Ci = (e, t) => {
  if (t === 0) {
    return 0;
  }
  if (t !== 4 && t !== 8) {
    throw Error(`Bad float size ${t}`);
  }
  if (t === 4) {
    return Tl(e);
  } else {
    return El(e);
  }
};
var wi = async (e, t, n, r) => {
  let i = new Set(n);
  let a = t;
  while (r === null || a < r) {
    let t = e.requestSliceRange(a, 2, 16);
    if (t instanceof Promise) {
      t = await t;
    }
    if (!t) {
      break;
    }
    let n = bi(t);
    if (!n) {
      break;
    }
    if (i.has(n.id)) {
      return {
        pos: a,
        found: true
      };
    }
    Di(n.size);
    a = t.filePos + n.size;
  }
  return {
    pos: r !== null && r > a ? r : a,
    found: false
  };
};
var Ti = async (e, t, n, r) => {
  let i = 65536;
  let a = new Set(n);
  let o = t;
  while (o < r) {
    let t = e.requestSliceRange(o, 0, Math.min(i, r - o));
    if (t instanceof Promise) {
      t = await t;
    }
    if (!t || t.length < 8) {
      break;
    }
    for (let e = 0; e < t.length - 8; e++) {
      t.filePos = o;
      let e = vi(t);
      if (e !== null && a.has(e)) {
        return o;
      }
      o++;
    }
  }
  return null;
};
var Ei = {
  avc: `V_MPEG4/ISO/AVC`,
  hevc: `V_MPEGH/ISO/HEVC`,
  vp8: `V_VP8`,
  vp9: `V_VP9`,
  av1: `V_AV1`,
  prores: `V_PRORES`,
  aac: `A_AAC`,
  mp3: `A_MPEG/L3`,
  opus: `A_OPUS`,
  vorbis: `A_VORBIS`,
  flac: `A_FLAC`,
  ac3: `A_AC3`,
  eac3: `A_EAC3`,
  'pcm-u8': `A_PCM/INT/LIT`,
  'pcm-s16': `A_PCM/INT/LIT`,
  'pcm-s16be': `A_PCM/INT/BIG`,
  'pcm-s24': `A_PCM/INT/LIT`,
  'pcm-s24be': `A_PCM/INT/BIG`,
  'pcm-s32': `A_PCM/INT/LIT`,
  'pcm-s32be': `A_PCM/INT/BIG`,
  'pcm-f32': `A_PCM/FLOAT/IEEE`,
  'pcm-f64': `A_PCM/FLOAT/IEEE`,
  webvtt: `S_TEXT/WEBVTT`
};
function Di(e) {
  if (e === undefined) {
    throw Error(`Undefined element size is used in a place where it is not supported.`);
  }
}
var Oi = e => {
  let t = (e.hasVideo ? `video/` : e.hasAudio ? `audio/` : `application/`) + (e.isWebM ? `webm` : `x-matroska`);
  if (e.codecStrings.length > 0) {
    let n = [...new Set(e.codecStrings.filter(Boolean))];
    t += `; codecs="${n.join(`, `)}"`;
  }
  return t;
};
var ki;
(function (e) {
  e[e.None = 0] = `None`;
  e[e.Xiph = 1] = `Xiph`;
  e[e.FixedSize = 2] = `FixedSize`;
  e[e.Ebml = 3] = `Ebml`;
})(ki ||= {});
var Ai;
(function (e) {
  e[e.Block = 1] = `Block`;
  e[e.Private = 2] = `Private`;
  e[e.Next = 4] = `Next`;
})(Ai ||= {});
var ji;
(function (e) {
  e[e.Zlib = 0] = `Zlib`;
  e[e.Bzlib = 1] = `Bzlib`;
  e[e.lzo1x = 2] = `lzo1x`;
  e[e.HeaderStripping = 3] = `HeaderStripping`;
})(ji ||= {});
var Mi = [{
  id: L.SeekHead,
  flag: `seekHeadSeen`
}, {
  id: L.Info,
  flag: `infoSeen`
}, {
  id: L.Tracks,
  flag: `tracksSeen`
}, {
  id: L.Cues,
  flag: `cuesSeen`
}];
var Ni = 10485760;
var Pi = class extends vr {
  constructor(e) {
    super(e);
    this.readMetadataPromise = null;
    this.segments = [];
    this.currentSegment = null;
    this.currentTrack = null;
    this.currentCluster = null;
    this.currentBlock = null;
    this.currentBlockAdditional = null;
    this.currentCueTime = null;
    this.currentDecodingInstruction = null;
    this.currentTagTargetIsMovie = true;
    this.currentSimpleTagName = null;
    this.currentAttachedFile = null;
    this.isWebM = false;
    this.reader = e._reader;
  }
  async getTrackBackings() {
    await this.readMetadata();
    return this.segments.flatMap(e => {
      return e.tracks.map(e => {
        return e.trackBacking;
      });
    });
  }
  async getMimeType() {
    await this.readMetadata();
    let e = await this.getTrackBackings();
    let t = await Promise.all(e.map(e => {
      return e.getDecoderConfig().then(e => {
        return e?.codec ?? null;
      });
    }));
    return Oi({
      isWebM: this.isWebM,
      hasVideo: this.segments.some(e => {
        return e.tracks.some(e => {
          return e.info?.type === `video`;
        });
      }),
      hasAudio: this.segments.some(e => {
        return e.tracks.some(e => {
          return e.info?.type === `audio`;
        });
      }),
      codecStrings: t.filter(Boolean)
    });
  }
  async getMetadataTags() {
    await this.readMetadata();
    for (let e of this.segments) {
      if (this.reader.fileSize !== null) {
        await this.loadSegmentMetadata(e);
      }
      e.metadataTagsCollected ||= true;
    }
    let e = {};
    for (let t of this.segments) {
      e = {
        ...e,
        ...t.metadataTags
      };
    }
    return e;
  }
  readMetadata() {
    return this.readMetadataPromise ??= (async () => {
      let e = 0;
      while (true) {
        let t = this.reader.requestSliceRange(e, 2, 16);
        if (t instanceof Promise) {
          t = await t;
        }
        if (!t) {
          break;
        }
        let n = bi(t);
        if (!n) {
          break;
        }
        let r = n.id;
        let a = n.size;
        let o = t.filePos;
        if (r === L.EBML) {
          Di(a);
          let e = this.reader.requestSlice(o, a);
          if (e instanceof Promise) {
            e = await e;
          }
          if (!e) {
            break;
          }
          this.readContiguousElements(e);
        } else if (r === L.Segment) {
          await this.readSegment(o, a);
          if (a === undefined || this.reader.fileSize === null) {
            break;
          }
        } else if (r === L.Cluster) {
          if (this.reader.fileSize === null) {
            break;
          }
          if (a === undefined) {
            a = (await wi(this.reader, o, li, this.reader.fileSize)).pos - o;
          }
          let e = i(this.segments);
          if (e) {
            e.elementEndPos = o + a;
          }
        }
        Di(a);
        e = o + a;
      }
    })();
  }
  async readSegment(e, t) {
    this.currentSegment = {
      seekHeadSeen: false,
      infoSeen: false,
      tracksSeen: false,
      cuesSeen: false,
      tagsSeen: false,
      attachmentsSeen: false,
      timestampScale: -1,
      timestampFactor: -1,
      duration: -1,
      seekEntries: [],
      tracks: [],
      cuePoints: [],
      dataStartPos: e,
      elementEndPos: t === undefined ? null : e + t,
      clusterSeekStartPos: e,
      lastReadCluster: null,
      metadataTags: {},
      metadataTagsCollected: false
    };
    this.segments.push(this.currentSegment);
    let n = e;
    while (this.currentSegment.elementEndPos === null || n < this.currentSegment.elementEndPos) {
      let e = this.reader.requestSliceRange(n, 2, 16);
      if (e instanceof Promise) {
        e = await e;
      }
      if (!e) {
        break;
      }
      let t = n;
      let r = bi(e);
      if (!r || !ci.includes(r.id) && r.id !== L.Void) {
        let e = await Ti(this.reader, t, ci, Math.min(this.currentSegment.elementEndPos ?? Infinity, t + Ni));
        if (e) {
          n = e;
          continue;
        } else {
          break;
        }
      }
      let {
        id: i,
        size: a
      } = r;
      let o = e.filePos;
      let s = Mi.findIndex(e => {
        return e.id === i;
      });
      if (s !== -1) {
        let e = Mi[s].flag;
        this.currentSegment[e] = true;
        Di(a);
        let t = this.reader.requestSlice(o, a);
        if (t instanceof Promise) {
          t = await t;
        }
        if (t) {
          this.readContiguousElements(t);
        }
      } else if (i === L.Tags || i === L.Attachments) {
        if (i === L.Tags) {
          this.currentSegment.tagsSeen = true;
        } else {
          this.currentSegment.attachmentsSeen = true;
        }
        Di(a);
        let e = this.reader.requestSlice(o, a);
        if (e instanceof Promise) {
          e = await e;
        }
        if (e) {
          this.readContiguousElements(e);
        }
      } else if (i === L.Cluster) {
        this.currentSegment.clusterSeekStartPos = t;
        break;
      }
      if (a === undefined) {
        break;
      }
      n = o + a;
    }
    this.currentSegment.seekEntries.sort((e, t) => {
      return e.segmentPosition - t.segmentPosition;
    });
    if (this.reader.fileSize !== null) {
      for (let t of this.currentSegment.seekEntries) {
        let n = Mi.find(e => {
          return e.id === t.id;
        });
        if (!n || this.currentSegment[n.flag]) {
          continue;
        }
        let r = this.reader.requestSliceRange(e + t.segmentPosition, 2, 16);
        if (r instanceof Promise) {
          r = await r;
        }
        if (!r) {
          continue;
        }
        let i = bi(r);
        if (!i) {
          continue;
        }
        let {
          id: a,
          size: o
        } = i;
        if (a !== n.id) {
          continue;
        }
        Di(o);
        this.currentSegment[n.flag] = true;
        let s = this.reader.requestSlice(r.filePos, o);
        if (s instanceof Promise) {
          s = await s;
        }
        if (s) {
          this.readContiguousElements(s);
        }
      }
    }
    if (this.currentSegment.timestampScale === -1) {
      this.currentSegment.timestampScale = 1000000;
      this.currentSegment.timestampFactor = 1000;
    }
    for (let e of this.currentSegment.tracks) {
      if (e.defaultDurationNs !== null) {
        e.defaultDuration = this.currentSegment.timestampFactor * e.defaultDurationNs / 1000000000;
      }
    }
    let r = new Map(this.currentSegment.tracks.map(e => {
      return [e.id, e];
    }));
    for (let e of this.currentSegment.cuePoints) {
      let t = r.get(e.trackId);
      if (t) {
        t.cuePoints.push(e);
      }
    }
    for (let e of this.currentSegment.tracks) {
      e.cuePoints.sort((e, t) => {
        return e.time - t.time;
      });
      for (let t = 0; t < e.cuePoints.length - 1; t++) {
        let n = e.cuePoints[t];
        let r = e.cuePoints[t + 1];
        if (n.time === r.time) {
          e.cuePoints.splice(t + 1, 1);
          t--;
        }
      }
    }
    let i = null;
    let a = -Infinity;
    for (let e of this.currentSegment.tracks) {
      if (e.cuePoints.length > a) {
        a = e.cuePoints.length;
        i = e;
      }
    }
    for (let e of this.currentSegment.tracks) {
      if (e.cuePoints.length === 0) {
        e.cuePoints = i.cuePoints;
      }
    }
    this.currentSegment = null;
  }
  async readCluster(e, t) {
    if (t.lastReadCluster?.elementStartPos === e) {
      return t.lastReadCluster;
    }
    let r = this.reader.requestSliceRange(e, 2, 16);
    if (r instanceof Promise) {
      r = await r;
    }
    n(r);
    let a = e;
    let o = bi(r);
    n(o);
    let s = o.id;
    n(s === L.Cluster);
    let c = o.size;
    let l = r.filePos;
    if (c === undefined) {
      c = (await wi(this.reader, l, li, t.elementEndPos)).pos - l;
    }
    let u = this.reader.requestSlice(l, c);
    if (u instanceof Promise) {
      u = await u;
    }
    let d = {
      segment: t,
      elementStartPos: a,
      elementEndPos: l + c,
      dataStartPos: l,
      timestamp: -1,
      trackData: new Map()
    };
    this.currentCluster = d;
    if (u) {
      d.elementEndPos = this.readContiguousElements(u, li);
    }
    for (let [, e] of d.trackData) {
      let t = e.track;
      n(e.blocks.length > 0);
      let r = false;
      for (let t = 0; t < e.blocks.length; t++) {
        let n = e.blocks[t];
        n.timestamp += d.timestamp;
        r ||= n.lacing !== ki.None;
      }
      e.presentationTimestamps = e.blocks.map((e, t) => {
        return {
          timestamp: e.timestamp,
          blockIndex: t
        };
      }).sort((e, t) => {
        return e.timestamp - t.timestamp;
      });
      for (let n = 0; n < e.presentationTimestamps.length; n++) {
        let r = e.presentationTimestamps[n];
        let i = e.blocks[r.blockIndex];
        if (e.firstKeyFrameTimestamp === null && i.isKeyFrame) {
          e.firstKeyFrameTimestamp = i.timestamp;
        }
        if (n < e.presentationTimestamps.length - 1) {
          i.duration = e.presentationTimestamps[n + 1].timestamp - i.timestamp;
        } else if (i.duration === 0 && t.defaultDuration != null && i.lacing === ki.None) {
          i.duration = t.defaultDuration;
        }
      }
      if (r) {
        this.expandLacedBlocks(e.blocks, t);
        e.presentationTimestamps = e.blocks.map((e, t) => {
          return {
            timestamp: e.timestamp,
            blockIndex: t
          };
        }).sort((e, t) => {
          return e.timestamp - t.timestamp;
        });
      }
      let o = e.blocks[e.presentationTimestamps[0].blockIndex];
      let s = e.blocks[i(e.presentationTimestamps).blockIndex];
      e.startTimestamp = o.timestamp;
      e.endTimestamp = s.timestamp + s.duration;
      let c = T(t.clusterPositionCache, e.startTimestamp, e => {
        return e.startTimestamp;
      });
      if (c === -1 || t.clusterPositionCache[c].elementStartPos !== a) {
        t.clusterPositionCache.splice(c + 1, 0, {
          elementStartPos: d.elementStartPos,
          startTimestamp: e.startTimestamp
        });
      }
    }
    t.lastReadCluster = d;
    return d;
  }
  getTrackDataInCluster(e, t) {
    let n = e.trackData.get(t);
    if (!n) {
      let r = e.segment.tracks.find(e => {
        return e.id === t;
      });
      if (!r) {
        return null;
      }
      n = {
        track: r,
        startTimestamp: 0,
        endTimestamp: 0,
        firstKeyFrameTimestamp: null,
        blocks: [],
        presentationTimestamps: []
      };
      e.trackData.set(t, n);
    }
    return n;
  }
  expandLacedBlocks(e, t) {
    for (let r = 0; r < e.length; r++) {
      let i = e[r];
      if (i.lacing === ki.None) {
        continue;
      }
      i.data = this.decodeBlockData(t, i.data);
      i.decoded ||= true;
      let a = fl.tempFromBytes(i.data);
      let o = [];
      let s = V(a) + 1;
      switch (i.lacing) {
        case ki.Xiph:
          {
            let e = 0;
            for (let t = 0; t < s - 1; t++) {
              let t = 0;
              while (a.bufferPos < a.length) {
                let n = V(a);
                t += n;
                if (n < 255) {
                  o.push(t);
                  e += t;
                  break;
                }
              }
            }
            o.push(a.length - (a.bufferPos + e));
          }
          break;
        case ki.FixedSize:
          {
            let e = a.length - 1;
            let t = Math.floor(e / s);
            for (let e = 0; e < s; e++) {
              o.push(t);
            }
          }
          break;
        case ki.Ebml:
          {
            let e = gi(a);
            n(e !== null);
            let t = e;
            o.push(t);
            let r = t;
            for (let e = 1; e < s - 1; e++) {
              let e = a.bufferPos;
              let i = gi(a);
              n(i !== null);
              let s = i - ((1 << (a.bufferPos - e) * 7 - 1) - 1);
              t += s;
              o.push(t);
              r += t;
            }
            o.push(a.length - (a.bufferPos + r));
          }
          break;
        default:
          {
            n(false);
          }
      }
      n(o.length === s);
      e.splice(r, 1);
      let c = i.duration || s * (t.defaultDuration ?? 0);
      for (let t = 0; t < s; t++) {
        let n = o[t];
        let l = B(a, n);
        let u = i.timestamp + c * t / s;
        let d = c / s;
        e.splice(r + t, 0, {
          timestamp: u,
          duration: d,
          isKeyFrame: i.isKeyFrame,
          data: l,
          lacing: ki.None,
          decoded: true,
          postProcessed: false,
          mainAdditional: i.mainAdditional
        });
      }
      r += s;
      r--;
    }
  }
  async loadSegmentMetadata(e) {
    for (let t of e.seekEntries) {
      if ((t.id !== L.Tags || !!e.tagsSeen) && (t.id !== L.Attachments || !!e.attachmentsSeen)) {
        continue;
      }
      let r = this.reader.requestSliceRange(e.dataStartPos + t.segmentPosition, 2, 16);
      if (r instanceof Promise) {
        r = await r;
      }
      if (!r) {
        continue;
      }
      let i = bi(r);
      if (!i || i.id !== t.id) {
        continue;
      }
      let {
        size: a
      } = i;
      Di(a);
      n(!this.currentSegment);
      this.currentSegment = e;
      let o = this.reader.requestSlice(r.filePos, a);
      if (o instanceof Promise) {
        o = await o;
      }
      if (o) {
        this.readContiguousElements(o);
      }
      this.currentSegment = null;
      if (t.id === L.Tags) {
        e.tagsSeen = true;
      } else if (t.id === L.Attachments) {
        e.attachmentsSeen = true;
      }
    }
  }
  readContiguousElements(e, t) {
    while (e.remainingLength >= 2) {
      let n = e.filePos;
      if (!this.traverseElement(e, t)) {
        return n;
      }
    }
    return e.filePos;
  }
  traverseElement(e, t) {
    let i = bi(e);
    if (!i || t && t.includes(i.id)) {
      return false;
    }
    let {
      id: a,
      size: o
    } = i;
    let s = e.filePos;
    Di(o);
    switch (a) {
      case L.DocType:
        {
          this.isWebM = xi(e, o) === `webm`;
          break;
        }
      case L.Seek:
        {
          if (!this.currentSegment) {
            break;
          }
          let t = {
            id: -1,
            segmentPosition: -1
          };
          this.currentSegment.seekEntries.push(t);
          this.readContiguousElements(e.slice(s, o));
          if (t.id === -1 || t.segmentPosition === -1) {
            this.currentSegment.seekEntries.pop();
          }
        }
        break;
      case L.SeekID:
        {
          let t = this.currentSegment?.seekEntries[this.currentSegment.seekEntries.length - 1];
          if (!t) {
            break;
          }
          t.id = R(e, o);
        }
        break;
      case L.SeekPosition:
        {
          let t = this.currentSegment?.seekEntries[this.currentSegment.seekEntries.length - 1];
          if (!t) {
            break;
          }
          t.segmentPosition = R(e, o);
        }
        break;
      case L.TimestampScale:
        {
          if (!this.currentSegment) {
            break;
          }
          this.currentSegment.timestampScale = R(e, o);
          this.currentSegment.timestampFactor = 1000000000 / this.currentSegment.timestampScale;
          break;
        }
      case L.Duration:
        {
          if (!this.currentSegment) {
            break;
          }
          this.currentSegment.duration = Ci(e, o);
          break;
        }
      case L.TrackEntry:
        {
          this.currentTrack = {
            id: -1,
            segment: this.currentSegment,
            demuxer: this,
            clusterPositionCache: [],
            cuePoints: [],
            disposition: {
              ...yt,
              primary: false
            },
            trackBacking: null,
            codecId: null,
            codecPrivate: null,
            defaultDuration: null,
            defaultDurationNs: null,
            name: null,
            languageCode: `eng`,
            hasLanguageBcp47: false,
            decodingInstructions: [],
            info: null
          };
          this.readContiguousElements(e.slice(s, o));
          if (!this.currentSegment || !this.currentTrack) {
            break;
          }
          if (this.currentTrack.decodingInstructions.some(e => {
            return e.data?.type !== `decompress` || e.scope !== Ai.Block || e.data.algorithm !== ji.HeaderStripping;
          })) {
            k._warn(`Track #${this.currentTrack.id} has an unsupported content encoding; dropping.`);
            this.currentTrack = null;
          }
          if (this.currentTrack && this.currentTrack.id !== -1 && this.currentTrack.codecId && this.currentTrack.info) {
            let e = this.currentTrack.codecId.indexOf(`/`);
            let t = e === -1 ? this.currentTrack.codecId : this.currentTrack.codecId.slice(0, e);
            if (this.currentTrack.info.type === `video` && this.currentTrack.info.width !== -1 && this.currentTrack.info.height !== -1) {
              this.currentTrack.info.squarePixelWidth = this.currentTrack.info.width;
              this.currentTrack.info.squarePixelHeight = this.currentTrack.info.height;
              if (this.currentTrack.info.displayWidth !== null && this.currentTrack.info.displayHeight !== null) {
                let e = this.currentTrack.info.displayWidth * this.currentTrack.info.height;
                let t = this.currentTrack.info.displayHeight * this.currentTrack.info.width;
                if (e > 0 && t > 0) {
                  if (e > t) {
                    this.currentTrack.info.squarePixelWidth = Math.round(this.currentTrack.info.width * e / t);
                  } else {
                    this.currentTrack.info.squarePixelHeight = Math.round(this.currentTrack.info.height * t / e);
                  }
                }
              }
              if (this.currentTrack.codecId === Ei.avc) {
                this.currentTrack.info.codec = `avc`;
                this.currentTrack.info.codecDescription = this.currentTrack.codecPrivate;
              } else if (this.currentTrack.codecId === Ei.hevc) {
                this.currentTrack.info.codec = `hevc`;
                this.currentTrack.info.codecDescription = this.currentTrack.codecPrivate;
              } else if (t === Ei.vp8) {
                this.currentTrack.info.codec = `vp8`;
              } else if (t === Ei.vp9) {
                this.currentTrack.info.codec = `vp9`;
              } else if (t === Ei.av1) {
                this.currentTrack.info.codec = `av1`;
              } else if (t === Ei.prores) {
                let e = this.currentTrack.codecPrivate ? d.decode(this.currentTrack.codecPrivate) : ``;
                if (Ft.includes(e)) {
                  this.currentTrack.info.codec = `prores`;
                  this.currentTrack.info.proresFormat = e;
                }
              }
              let e = this.currentTrack;
              this.currentTrack.trackBacking = new Ii(e);
              this.currentSegment.tracks.push(this.currentTrack);
            } else if (this.currentTrack.info.type === `audio`) {
              if (t === Ei.aac) {
                this.currentTrack.info.codec = `aac`;
                this.currentTrack.info.aacCodecInfo = {
                  isMpeg2: this.currentTrack.codecId.includes(`MPEG2`),
                  objectType: null
                };
                this.currentTrack.info.codecDescription = this.currentTrack.codecPrivate;
              } else if (this.currentTrack.codecId === Ei.mp3) {
                this.currentTrack.info.codec = `mp3`;
              } else if (t === Ei.opus) {
                this.currentTrack.info.codec = `opus`;
                this.currentTrack.info.codecDescription = this.currentTrack.codecPrivate;
                this.currentTrack.info.sampleRate = Wt;
              } else if (t === Ei.vorbis) {
                this.currentTrack.info.codec = `vorbis`;
                this.currentTrack.info.codecDescription = this.currentTrack.codecPrivate;
              } else if (t === Ei.flac) {
                this.currentTrack.info.codec = `flac`;
                this.currentTrack.info.codecDescription = this.currentTrack.codecPrivate;
              } else if (t === Ei.ac3) {
                this.currentTrack.info.codec = `ac3`;
                this.currentTrack.info.codecDescription = this.currentTrack.codecPrivate;
              } else if (t === Ei.eac3) {
                this.currentTrack.info.codec = `eac3`;
                this.currentTrack.info.codecDescription = this.currentTrack.codecPrivate;
              } else if (this.currentTrack.codecId === `A_PCM/INT/LIT`) {
                if (this.currentTrack.info.bitDepth === 8) {
                  this.currentTrack.info.codec = `pcm-u8`;
                } else if (this.currentTrack.info.bitDepth === 16) {
                  this.currentTrack.info.codec = `pcm-s16`;
                } else if (this.currentTrack.info.bitDepth === 24) {
                  this.currentTrack.info.codec = `pcm-s24`;
                } else if (this.currentTrack.info.bitDepth === 32) {
                  this.currentTrack.info.codec = `pcm-s32`;
                }
              } else if (this.currentTrack.codecId === `A_PCM/INT/BIG`) {
                if (this.currentTrack.info.bitDepth === 8) {
                  this.currentTrack.info.codec = `pcm-u8`;
                } else if (this.currentTrack.info.bitDepth === 16) {
                  this.currentTrack.info.codec = `pcm-s16be`;
                } else if (this.currentTrack.info.bitDepth === 24) {
                  this.currentTrack.info.codec = `pcm-s24be`;
                } else if (this.currentTrack.info.bitDepth === 32) {
                  this.currentTrack.info.codec = `pcm-s32be`;
                }
              } else if (this.currentTrack.codecId === `A_PCM/FLOAT/IEEE`) {
                if (this.currentTrack.info.bitDepth === 32) {
                  this.currentTrack.info.codec = `pcm-f32`;
                } else if (this.currentTrack.info.bitDepth === 64) {
                  this.currentTrack.info.codec = `pcm-f64`;
                }
              }
              let e = this.currentTrack;
              this.currentTrack.trackBacking = new Li(e);
              this.currentSegment.tracks.push(this.currentTrack);
            }
          }
          this.currentTrack = null;
          break;
        }
      case L.TrackNumber:
        {
          if (!this.currentTrack) {
            break;
          }
          this.currentTrack.id = R(e, o);
          break;
        }
      case L.TrackType:
        {
          if (!this.currentTrack) {
            break;
          }
          let t = R(e, o);
          if (t === 1) {
            this.currentTrack.info = {
              type: `video`,
              width: -1,
              height: -1,
              displayWidth: null,
              displayHeight: null,
              displayUnit: null,
              squarePixelWidth: -1,
              squarePixelHeight: -1,
              rotation: 0,
              codec: null,
              codecDescription: null,
              colorSpace: null,
              alphaMode: false,
              proresFormat: null
            };
          } else if (t === 2) {
            this.currentTrack.info = {
              type: `audio`,
              numberOfChannels: 1,
              sampleRate: 8000,
              bitDepth: -1,
              codec: null,
              codecDescription: null,
              aacCodecInfo: null
            };
          }
        }
        break;
      case L.FlagEnabled:
        {
          if (!this.currentTrack) {
            break;
          }
          if (!R(e, o)) {
            this.currentTrack = null;
          }
          break;
        }
      case L.FlagDefault:
        {
          if (!this.currentTrack) {
            break;
          }
          this.currentTrack.disposition.default = !!R(e, o);
          break;
        }
      case L.FlagForced:
        {
          if (!this.currentTrack) {
            break;
          }
          this.currentTrack.disposition.forced = !!R(e, o);
          break;
        }
      case L.FlagOriginal:
        {
          if (!this.currentTrack) {
            break;
          }
          this.currentTrack.disposition.original = !!R(e, o);
          break;
        }
      case L.FlagHearingImpaired:
        {
          if (!this.currentTrack) {
            break;
          }
          this.currentTrack.disposition.hearingImpaired = !!R(e, o);
          break;
        }
      case L.FlagVisualImpaired:
        {
          if (!this.currentTrack) {
            break;
          }
          this.currentTrack.disposition.visuallyImpaired = !!R(e, o);
          break;
        }
      case L.FlagCommentary:
        {
          if (!this.currentTrack) {
            break;
          }
          this.currentTrack.disposition.commentary = !!R(e, o);
          break;
        }
      case L.CodecID:
        {
          if (!this.currentTrack) {
            break;
          }
          this.currentTrack.codecId = xi(e, o);
          break;
        }
      case L.CodecPrivate:
        {
          if (!this.currentTrack) {
            break;
          }
          this.currentTrack.codecPrivate = B(e, o);
          break;
        }
      case L.DefaultDuration:
        {
          if (!this.currentTrack) {
            break;
          }
          this.currentTrack.defaultDurationNs = R(e, o);
          break;
        }
      case L.Name:
        {
          if (!this.currentTrack) {
            break;
          }
          this.currentTrack.name = Si(e, o);
          break;
        }
      case L.Language:
        {
          if (!this.currentTrack || this.currentTrack.hasLanguageBcp47) {
            break;
          }
          this.currentTrack.languageCode = xi(e, o);
          if (!Ce(this.currentTrack.languageCode)) {
            this.currentTrack.languageCode = `und`;
          }
          break;
        }
      case L.LanguageBCP47:
        {
          if (!this.currentTrack) {
            break;
          }
          let t = xi(e, o).split(`-`)[0];
          if (t) {
            this.currentTrack.languageCode = t;
          } else {
            this.currentTrack.languageCode = `und`;
          }
          this.currentTrack.hasLanguageBcp47 = true;
        }
        break;
      case L.Video:
        {
          if (this.currentTrack?.info?.type !== `video`) {
            break;
          }
          this.readContiguousElements(e.slice(s, o));
          break;
        }
      case L.PixelWidth:
        {
          if (this.currentTrack?.info?.type !== `video`) {
            break;
          }
          this.currentTrack.info.width = R(e, o);
          break;
        }
      case L.PixelHeight:
        {
          if (this.currentTrack?.info?.type !== `video`) {
            break;
          }
          this.currentTrack.info.height = R(e, o);
          break;
        }
      case L.DisplayWidth:
        {
          if (this.currentTrack?.info?.type !== `video`) {
            break;
          }
          this.currentTrack.info.displayWidth = R(e, o);
          break;
        }
      case L.DisplayHeight:
        {
          if (this.currentTrack?.info?.type !== `video`) {
            break;
          }
          this.currentTrack.info.displayHeight = R(e, o);
          break;
        }
      case L.DisplayUnit:
        {
          if (this.currentTrack?.info?.type !== `video`) {
            break;
          }
          this.currentTrack.info.displayUnit = R(e, o);
          break;
        }
      case L.AlphaMode:
        {
          if (this.currentTrack?.info?.type !== `video`) {
            break;
          }
          this.currentTrack.info.alphaMode = R(e, o) === 1;
          break;
        }
      case L.Colour:
        {
          if (this.currentTrack?.info?.type !== `video`) {
            break;
          }
          this.currentTrack.info.colorSpace = {};
          this.readContiguousElements(e.slice(s, o));
          break;
        }
      case L.MatrixCoefficients:
        {
          if (this.currentTrack?.info?.type !== `video` || !this.currentTrack.info.colorSpace) {
            break;
          }
          let t = b[R(e, o)] ?? null;
          this.currentTrack.info.colorSpace.matrix = t;
        }
        break;
      case L.Range:
        {
          if (this.currentTrack?.info?.type !== `video` || !this.currentTrack.info.colorSpace) {
            break;
          }
          this.currentTrack.info.colorSpace.fullRange = R(e, o) === 2;
          break;
        }
      case L.TransferCharacteristics:
        {
          if (this.currentTrack?.info?.type !== `video` || !this.currentTrack.info.colorSpace) {
            break;
          }
          let t = v[R(e, o)] ?? null;
          this.currentTrack.info.colorSpace.transfer = t;
        }
        break;
      case L.Primaries:
        {
          if (this.currentTrack?.info?.type !== `video` || !this.currentTrack.info.colorSpace) {
            break;
          }
          let t = g[R(e, o)] ?? null;
          this.currentTrack.info.colorSpace.primaries = t;
        }
        break;
      case L.Projection:
        {
          if (this.currentTrack?.info?.type !== `video`) {
            break;
          }
          this.readContiguousElements(e.slice(s, o));
          break;
        }
      case L.ProjectionPoseRoll:
        {
          if (this.currentTrack?.info?.type !== `video`) {
            break;
          }
          let t = -Ci(e, o);
          try {
            this.currentTrack.info.rotation = r(t);
          } catch {}
        }
        break;
      case L.Audio:
        {
          if (this.currentTrack?.info?.type !== `audio`) {
            break;
          }
          this.readContiguousElements(e.slice(s, o));
          break;
        }
      case L.SamplingFrequency:
        {
          if (this.currentTrack?.info?.type !== `audio`) {
            break;
          }
          this.currentTrack.info.sampleRate = Ci(e, o);
          break;
        }
      case L.Channels:
        {
          if (this.currentTrack?.info?.type !== `audio`) {
            break;
          }
          this.currentTrack.info.numberOfChannels = R(e, o);
          break;
        }
      case L.BitDepth:
        {
          if (this.currentTrack?.info?.type !== `audio`) {
            break;
          }
          this.currentTrack.info.bitDepth = R(e, o);
          break;
        }
      case L.CuePoint:
        {
          if (!this.currentSegment) {
            break;
          }
          this.readContiguousElements(e.slice(s, o));
          this.currentCueTime = null;
          break;
        }
      case L.CueTime:
        {
          this.currentCueTime = R(e, o);
          break;
        }
      case L.CueTrackPositions:
        {
          if (this.currentCueTime === null) {
            break;
          }
          n(this.currentSegment);
          let t = {
            time: this.currentCueTime,
            trackId: -1,
            clusterPosition: -1
          };
          this.currentSegment.cuePoints.push(t);
          this.readContiguousElements(e.slice(s, o));
          if (t.trackId === -1 || t.clusterPosition === -1) {
            this.currentSegment.cuePoints.pop();
          }
        }
        break;
      case L.CueTrack:
        {
          let t = this.currentSegment?.cuePoints[this.currentSegment.cuePoints.length - 1];
          if (!t) {
            break;
          }
          t.trackId = R(e, o);
        }
        break;
      case L.CueClusterPosition:
        {
          let t = this.currentSegment?.cuePoints[this.currentSegment.cuePoints.length - 1];
          if (!t) {
            break;
          }
          n(this.currentSegment);
          t.clusterPosition = this.currentSegment.dataStartPos + R(e, o);
        }
        break;
      case L.Timestamp:
        {
          if (!this.currentCluster) {
            break;
          }
          this.currentCluster.timestamp = R(e, o);
          break;
        }
      case L.SimpleBlock:
        {
          if (!this.currentCluster) {
            break;
          }
          let t = gi(e);
          if (t === null) {
            break;
          }
          let n = this.getTrackDataInCluster(this.currentCluster, t);
          if (!n) {
            break;
          }
          let r = gl(e);
          let i = V(e);
          let a = i >> 1 & 3;
          let c = !!(i & 128);
          if (n.track.info?.type === `audio` && n.track.info.codec) {
            c = true;
          }
          let l = B(e, o - (e.filePos - s));
          let u = n.track.decodingInstructions.length > 0;
          n.blocks.push({
            timestamp: r,
            duration: 0,
            isKeyFrame: c,
            data: l,
            lacing: a,
            decoded: !u,
            postProcessed: false,
            mainAdditional: null
          });
        }
        break;
      case L.BlockGroup:
        {
          if (!this.currentCluster) {
            break;
          }
          this.readContiguousElements(e.slice(s, o));
          this.currentBlock = null;
          break;
        }
      case L.Block:
        {
          if (!this.currentCluster) {
            break;
          }
          let t = gi(e);
          if (t === null) {
            break;
          }
          let n = this.getTrackDataInCluster(this.currentCluster, t);
          if (!n) {
            break;
          }
          let r = gl(e);
          let i = V(e) >> 1 & 3;
          let a = B(e, o - (e.filePos - s));
          let c = n.track.decodingInstructions.length > 0;
          this.currentBlock = {
            timestamp: r,
            duration: 0,
            isKeyFrame: true,
            data: a,
            lacing: i,
            decoded: !c,
            postProcessed: false,
            mainAdditional: null
          };
          n.blocks.push(this.currentBlock);
        }
        break;
      case L.BlockAdditions:
        {
          this.readContiguousElements(e.slice(s, o));
          break;
        }
      case L.BlockMore:
        {
          if (!this.currentBlock) {
            break;
          }
          this.currentBlockAdditional = {
            addId: 1,
            data: null
          };
          this.readContiguousElements(e.slice(s, o));
          if (this.currentBlockAdditional.data && this.currentBlockAdditional.addId === 1) {
            this.currentBlock.mainAdditional = this.currentBlockAdditional.data;
          }
          this.currentBlockAdditional = null;
          break;
        }
      case L.BlockAdditional:
        {
          if (!this.currentBlockAdditional) {
            break;
          }
          this.currentBlockAdditional.data = B(e, o);
          break;
        }
      case L.BlockAddID:
        {
          if (!this.currentBlockAdditional) {
            break;
          }
          this.currentBlockAdditional.addId = R(e, o);
          break;
        }
      case L.BlockDuration:
        {
          if (!this.currentBlock) {
            break;
          }
          this.currentBlock.duration = R(e, o);
          break;
        }
      case L.ReferenceBlock:
        {
          if (!this.currentBlock) {
            break;
          }
          this.currentBlock.isKeyFrame = false;
          break;
        }
      case L.Tag:
        {
          this.currentTagTargetIsMovie = true;
          this.readContiguousElements(e.slice(s, o));
          break;
        }
      case L.Targets:
        {
          this.readContiguousElements(e.slice(s, o));
          break;
        }
      case L.TargetTypeValue:
        {
          if (R(e, o) !== 50) {
            this.currentTagTargetIsMovie = false;
          }
          break;
        }
      case L.TagTrackUID:
      case L.TagEditionUID:
      case L.TagChapterUID:
      case L.TagAttachmentUID:
        {
          this.currentTagTargetIsMovie = false;
          break;
        }
      case L.SimpleTag:
        {
          if (!this.currentTagTargetIsMovie) {
            break;
          }
          this.currentSimpleTagName = null;
          this.readContiguousElements(e.slice(s, o));
          break;
        }
      case L.TagName:
        {
          this.currentSimpleTagName = Si(e, o);
          break;
        }
      case L.TagString:
        {
          if (!this.currentSimpleTagName) {
            break;
          }
          let t = Si(e, o);
          this.processTagValue(this.currentSimpleTagName, t);
        }
        break;
      case L.TagBinary:
        {
          if (!this.currentSimpleTagName) {
            break;
          }
          let t = B(e, o);
          this.processTagValue(this.currentSimpleTagName, t);
        }
        break;
      case L.AttachedFile:
        {
          if (!this.currentSegment) {
            break;
          }
          this.currentAttachedFile = {
            fileUid: null,
            fileName: null,
            fileMediaType: null,
            fileData: null,
            fileDescription: null
          };
          this.readContiguousElements(e.slice(s, o));
          let t = this.currentSegment.metadataTags;
          if (this.currentAttachedFile.fileUid && this.currentAttachedFile.fileData) {
            t.raw ??= {};
            t.raw[this.currentAttachedFile.fileUid.toString()] = new gt(this.currentAttachedFile.fileData, this.currentAttachedFile.fileMediaType ?? undefined, this.currentAttachedFile.fileName ?? undefined, this.currentAttachedFile.fileDescription ?? undefined);
          }
          if (this.currentAttachedFile.fileMediaType?.startsWith(`image/`) && this.currentAttachedFile.fileData) {
            let e = this.currentAttachedFile.fileName;
            let n = `unknown`;
            if (e) {
              let t = e.toLowerCase();
              if (t.startsWith(`cover.`)) {
                n = `coverFront`;
              } else if (t.startsWith(`back.`)) {
                n = `coverBack`;
              }
            }
            t.images ??= [];
            t.images.push({
              data: this.currentAttachedFile.fileData,
              mimeType: this.currentAttachedFile.fileMediaType,
              kind: n,
              name: this.currentAttachedFile.fileName ?? undefined,
              description: this.currentAttachedFile.fileDescription ?? undefined
            });
          }
          this.currentAttachedFile = null;
        }
        break;
      case L.FileUID:
        {
          if (!this.currentAttachedFile) {
            break;
          }
          this.currentAttachedFile.fileUid = _i(e, o);
          break;
        }
      case L.FileName:
        {
          if (!this.currentAttachedFile) {
            break;
          }
          this.currentAttachedFile.fileName = Si(e, o);
          break;
        }
      case L.FileMediaType:
        {
          if (!this.currentAttachedFile) {
            break;
          }
          this.currentAttachedFile.fileMediaType = xi(e, o);
          break;
        }
      case L.FileData:
        {
          if (!this.currentAttachedFile) {
            break;
          }
          this.currentAttachedFile.fileData = B(e, o);
          break;
        }
      case L.FileDescription:
        {
          if (!this.currentAttachedFile) {
            break;
          }
          this.currentAttachedFile.fileDescription = Si(e, o);
          break;
        }
      case L.ContentEncodings:
        {
          if (!this.currentTrack) {
            break;
          }
          this.readContiguousElements(e.slice(s, o));
          this.currentTrack.decodingInstructions.sort((e, t) => {
            return t.order - e.order;
          });
          break;
        }
      case L.ContentEncoding:
        {
          this.currentDecodingInstruction = {
            order: 0,
            scope: Ai.Block,
            data: null
          };
          this.readContiguousElements(e.slice(s, o));
          if (this.currentDecodingInstruction.data) {
            this.currentTrack.decodingInstructions.push(this.currentDecodingInstruction);
          }
          this.currentDecodingInstruction = null;
          break;
        }
      case L.ContentEncodingOrder:
        {
          if (!this.currentDecodingInstruction) {
            break;
          }
          this.currentDecodingInstruction.order = R(e, o);
          break;
        }
      case L.ContentEncodingScope:
        {
          if (!this.currentDecodingInstruction) {
            break;
          }
          this.currentDecodingInstruction.scope = R(e, o);
          break;
        }
      case L.ContentCompression:
        {
          if (!this.currentDecodingInstruction) {
            break;
          }
          this.currentDecodingInstruction.data = {
            type: `decompress`,
            algorithm: ji.Zlib,
            settings: null
          };
          this.readContiguousElements(e.slice(s, o));
          break;
        }
      case L.ContentCompAlgo:
        {
          if (this.currentDecodingInstruction?.data?.type !== `decompress`) {
            break;
          }
          this.currentDecodingInstruction.data.algorithm = R(e, o);
          break;
        }
      case L.ContentCompSettings:
        {
          if (this.currentDecodingInstruction?.data?.type !== `decompress`) {
            break;
          }
          this.currentDecodingInstruction.data.settings = B(e, o);
          break;
        }
      case L.ContentEncryption:
        {
          if (!this.currentDecodingInstruction) {
            break;
          }
          this.currentDecodingInstruction.data = {
            type: `decrypt`
          };
          break;
        }
    }
    e.filePos = s + o;
    return true;
  }
  decodeBlockData(e, t) {
    n(e.decodingInstructions.length > 0);
    let r = t;
    for (let t of e.decodingInstructions) {
      n(t.data);
      switch (t.data.type) {
        case `decompress`:
          {
            switch (t.data.algorithm) {
              case ji.HeaderStripping:
                {
                  if (t.data.settings && t.data.settings.length > 0) {
                    let e = t.data.settings;
                    let n = new Uint8Array(e.length + r.length);
                    n.set(e, 0);
                    n.set(r, e.length);
                    r = n;
                  }
                  break;
                }
              default:
            }
            break;
          }
        default:
      }
    }
    return r;
  }
  processTagValue(e, t) {
    if (!this.currentSegment?.metadataTags) {
      return;
    }
    let n = this.currentSegment.metadataTags;
    n.raw ??= {};
    n.raw[e] ??= t;
    if (typeof t == `string`) {
      switch (e.toLowerCase()) {
        case `title`:
          {
            n.title ??= t;
            break;
          }
        case `description`:
          {
            n.description ??= t;
            break;
          }
        case `artist`:
          {
            n.artist ??= t;
            break;
          }
        case `album`:
          {
            n.album ??= t;
            break;
          }
        case `album_artist`:
          {
            n.albumArtist ??= t;
            break;
          }
        case `genre`:
          {
            n.genre ??= t;
            break;
          }
        case `comment`:
          {
            n.comment ??= t;
            break;
          }
        case `lyrics`:
          {
            n.lyrics ??= t;
            break;
          }
        case `date`:
          {
            let e = new Date(t);
            if (!Number.isNaN(e.getTime())) {
              n.date ??= e;
            }
          }
          break;
        case `track_number`:
        case `part_number`:
          {
            let e = t.split(`/`);
            let r = Number.parseInt(e[0], 10);
            let i = e[1] && Number.parseInt(e[1], 10);
            if (Number.isInteger(r) && r > 0) {
              n.trackNumber ??= r;
            }
            if (i && Number.isInteger(i) && i > 0) {
              n.tracksTotal ??= i;
            }
          }
          break;
        case `disc_number`:
        case `disc`:
          {
            let e = t.split(`/`);
            let r = Number.parseInt(e[0], 10);
            let i = e[1] && Number.parseInt(e[1], 10);
            if (Number.isInteger(r) && r > 0) {
              n.discNumber ??= r;
            }
            if (i && Number.isInteger(i) && i > 0) {
              n.discsTotal ??= i;
            }
          }
          break;
      }
    }
  }
};
var Fi = class {
  constructor(e) {
    this.internalTrack = e;
    this.packetToClusterLocation = new WeakMap();
  }
  getId() {
    return this.internalTrack.id;
  }
  getNumber() {
    let e = this.internalTrack.demuxer;
    let t = this.internalTrack.trackBacking.getType();
    let n = 0;
    for (let r of e.segments) {
      for (let e of r.tracks) {
        if (e.trackBacking.getType() === t) {
          n++;
        }
        if (e === this.internalTrack) {
          break;
        }
      }
    }
    return n;
  }
  getCodec() {
    throw Error(`Not implemented on base class.`);
  }
  getInternalCodecId() {
    return this.internalTrack.codecId;
  }
  getName() {
    return this.internalTrack.name;
  }
  getLanguageCode() {
    return this.internalTrack.languageCode;
  }
  getTimeResolution() {
    return this.internalTrack.segment.timestampFactor;
  }
  isRelativeToUnixEpoch() {
    return false;
  }
  getUnixTimeForTimestamp() {
    return null;
  }
  getDisposition() {
    return this.internalTrack.disposition;
  }
  getPairingMask() {
    return 1n;
  }
  getBitrate() {
    return null;
  }
  getAverageBitrate() {
    return null;
  }
  async getDurationFromMetadata() {
    let e = this.internalTrack.segment;
    if (e.duration <= 0) {
      return null;
    }
    let t = e.duration / e.timestampFactor;
    let n = await this.getFirstPacket({
      metadataOnly: true
    });
    t += n?.timestamp ?? 0;
    return t;
  }
  async getLiveRefreshInterval() {
    return null;
  }
  async getFirstPacket(e) {
    return this.performClusterLookup(null, e => {
      if (e.trackData.get(this.internalTrack.id)) {
        return {
          blockIndex: 0,
          correctBlockFound: true
        };
      } else {
        return {
          blockIndex: -1,
          correctBlockFound: false
        };
      }
    }, -Infinity, Infinity, e);
  }
  intoTimescale(e) {
    return ge(e * this.internalTrack.segment.timestampFactor);
  }
  async getPacket(e, t) {
    let n = this.intoTimescale(e);
    return this.performClusterLookup(null, e => {
      let t = e.trackData.get(this.internalTrack.id);
      if (!t) {
        return {
          blockIndex: -1,
          correctBlockFound: false
        };
      }
      let r = T(t.presentationTimestamps, n, e => {
        return e.timestamp;
      });
      return {
        blockIndex: r === -1 ? -1 : t.presentationTimestamps[r].blockIndex,
        correctBlockFound: r !== -1 && n < t.endTimestamp
      };
    }, n, n, t);
  }
  async getNextPacket(e, t) {
    let n = this.packetToClusterLocation.get(e);
    if (n === undefined) {
      throw Error(`Packet was not created from this track.`);
    }
    return this.performClusterLookup(n.cluster, e => {
      if (e === n.cluster) {
        let t = e.trackData.get(this.internalTrack.id);
        if (n.blockIndex + 1 < t.blocks.length) {
          return {
            blockIndex: n.blockIndex + 1,
            correctBlockFound: true
          };
        }
      } else if (e.trackData.get(this.internalTrack.id)) {
        return {
          blockIndex: 0,
          correctBlockFound: true
        };
      }
      return {
        blockIndex: -1,
        correctBlockFound: false
      };
    }, -Infinity, Infinity, t);
  }
  async getKeyPacket(e, t) {
    let n = this.intoTimescale(e);
    return this.performClusterLookup(null, e => {
      let t = e.trackData.get(this.internalTrack.id);
      if (!t) {
        return {
          blockIndex: -1,
          correctBlockFound: false
        };
      }
      let r = se(t.presentationTimestamps, e => {
        return t.blocks[e.blockIndex].isKeyFrame && e.timestamp <= n;
      });
      return {
        blockIndex: r === -1 ? -1 : t.presentationTimestamps[r].blockIndex,
        correctBlockFound: r !== -1 && n < t.endTimestamp
      };
    }, n, n, t);
  }
  async getNextKeyPacket(e, t) {
    let r = this.packetToClusterLocation.get(e);
    if (r === undefined) {
      throw Error(`Packet was not created from this track.`);
    }
    return this.performClusterLookup(r.cluster, e => {
      if (e === r.cluster) {
        let t = e.trackData.get(this.internalTrack.id).blocks.findIndex((e, t) => {
          return e.isKeyFrame && t > r.blockIndex;
        });
        if (t !== -1) {
          return {
            blockIndex: t,
            correctBlockFound: true
          };
        }
      } else {
        let t = e.trackData.get(this.internalTrack.id);
        if (t && t.firstKeyFrameTimestamp !== null) {
          let e = t.blocks.findIndex(e => {
            return e.isKeyFrame;
          });
          n(e !== -1);
          return {
            blockIndex: e,
            correctBlockFound: true
          };
        }
      }
      return {
        blockIndex: -1,
        correctBlockFound: false
      };
    }, -Infinity, Infinity, t);
  }
  async fetchPacketInCluster(e, t, r) {
    if (t === -1) {
      return null;
    }
    let i = e.trackData.get(this.internalTrack.id).blocks[t];
    n(i);
    i.data = this.internalTrack.demuxer.decodeBlockData(this.internalTrack, i.data);
    i.decoded ||= true;
    if (!i.postProcessed) {
      if (this.internalTrack.info?.codec === `prores` && (!(i.data.length >= 8) || i.data[4] !== 105 || i.data[5] !== 99 || i.data[6] !== 112 || i.data[7] !== 102)) {
        let e = new Uint8Array(i.data.length + 8);
        u(e).setUint32(0, e.length, false);
        e[4] = 105;
        e[5] = 99;
        e[6] = 112;
        e[7] = 102;
        e.set(i.data, 8);
        i.data = e;
      }
      i.postProcessed = true;
    }
    let a = r.metadataOnly ? yr : i.data;
    let o = i.timestamp / this.internalTrack.segment.timestampFactor;
    let s = i.duration / this.internalTrack.segment.timestampFactor;
    let c = {};
    if (i.mainAdditional && this.internalTrack.info?.type === `video` && this.internalTrack.info.alphaMode) {
      if (r.metadataOnly) {
        c.alpha = yr;
      } else {
        c.alpha = i.mainAdditional;
      }
      c.alphaByteLength = i.mainAdditional.byteLength;
    }
    let l = new I(a, i.isKeyFrame ? `key` : `delta`, o, s, e.dataStartPos + t, i.data.byteLength, c);
    this.packetToClusterLocation.set(l, {
      cluster: e,
      blockIndex: t
    });
    return l;
  }
  async performClusterLookup(e, t, r, i, a) {
    let {
      demuxer: o,
      segment: s
    } = this.internalTrack;
    let c = null;
    let l = null;
    let u = -1;
    if (e) {
      let {
        blockIndex: n,
        correctBlockFound: r
      } = t(e);
      if (r) {
        return this.fetchPacketInCluster(e, n, a);
      }
      if (n !== -1) {
        l = e;
        u = n;
      }
    }
    let d = T(this.internalTrack.cuePoints, r, e => {
      return e.time;
    });
    let f = d === -1 ? null : this.internalTrack.cuePoints[d];
    let p = T(this.internalTrack.clusterPositionCache, r, e => {
      return e.startTimestamp;
    });
    let m = p === -1 ? null : this.internalTrack.clusterPositionCache[p];
    let h = Math.max(f?.clusterPosition ?? 0, m?.elementStartPos ?? 0) || null;
    let g;
    g = e.elementEndPos;
    for (e ? h === null || e.elementStartPos >= h ? c = e : g = h : g = h ?? s.clusterSeekStartPos; s.elementEndPos === null || g <= s.elementEndPos - 2;) {
      if (c) {
        let e = c.trackData.get(this.internalTrack.id);
        if (e && e.startTimestamp > i) {
          break;
        }
      }
      let e = o.reader.requestSliceRange(g, 2, 16);
      if (e instanceof Promise) {
        e = await e;
      }
      if (!e) {
        break;
      }
      let r = g;
      let d = bi(e);
      if (!d || !ci.includes(d.id) && d.id !== L.Void) {
        let e = await Ti(o.reader, r, ci, Math.min(s.elementEndPos ?? Infinity, r + Ni));
        if (e) {
          g = e;
          continue;
        } else {
          break;
        }
      }
      let f = d.id;
      let p = d.size;
      let m = e.filePos;
      if (f === L.Cluster) {
        c = await o.readCluster(r, s);
        p = c.elementEndPos - m;
        let {
          blockIndex: e,
          correctBlockFound: n
        } = t(c);
        if (n) {
          return this.fetchPacketInCluster(c, e, a);
        }
        if (e !== -1) {
          l = c;
          u = e;
        }
      }
      if (p === undefined) {
        n(f !== L.Cluster);
        p = (await wi(o.reader, m, li, s.elementEndPos)).pos - m;
      }
      let h = m + p;
      if (s.elementEndPos === null) {
        let e = o.reader.requestSliceRange(h, 2, 16);
        if (e instanceof Promise) {
          e = await e;
        }
        if (!e) {
          break;
        }
        if (vi(e) === L.Segment) {
          s.elementEndPos = h;
          break;
        }
      }
      g = h;
    }
    if (f && (!l || l.elementStartPos < f.clusterPosition)) {
      let e = this.internalTrack.cuePoints[d - 1];
      n(!e || e.time < f.time);
      let r = e?.time ?? -Infinity;
      return this.performClusterLookup(null, t, r, i, a);
    }
    if (l) {
      return this.fetchPacketInCluster(l, u, a);
    } else {
      return null;
    }
  }
};
var Ii = class extends Fi {
  constructor(e) {
    super(e);
    this.decoderConfigPromise = null;
    this.internalTrack = e;
  }
  getType() {
    return `video`;
  }
  getCodec() {
    return this.internalTrack.info.codec;
  }
  getCodedWidth() {
    return this.internalTrack.info.width;
  }
  getCodedHeight() {
    return this.internalTrack.info.height;
  }
  getSquarePixelWidth() {
    return this.internalTrack.info.squarePixelWidth;
  }
  getSquarePixelHeight() {
    return this.internalTrack.info.squarePixelHeight;
  }
  getRotation() {
    return this.internalTrack.info.rotation;
  }
  async getColorSpace() {
    return {
      primaries: this.internalTrack.info.colorSpace?.primaries,
      transfer: this.internalTrack.info.colorSpace?.transfer,
      matrix: this.internalTrack.info.colorSpace?.matrix,
      fullRange: this.internalTrack.info.colorSpace?.fullRange
    };
  }
  async canBeTransparent() {
    return this.internalTrack.info.alphaMode || this.internalTrack.info.codec === `prores` && (this.internalTrack.info.proresFormat === `ap4h` || this.internalTrack.info.proresFormat === `ap4x`);
  }
  async getDecoderConfig() {
    if (this.internalTrack.info.codec) {
      return this.decoderConfigPromise ??= (async () => {
        let e = null;
        if (this.internalTrack.info.codec === `vp9` || this.internalTrack.info.codec === `av1` || this.internalTrack.info.codec === `avc` && !this.internalTrack.info.codecDescription || this.internalTrack.info.codec === `hevc` && !this.internalTrack.info.codecDescription) {
          e = await this.getFirstPacket({});
        }
        let t = {
          codec: Bt({
            width: this.internalTrack.info.width,
            height: this.internalTrack.info.height,
            codec: this.internalTrack.info.codec,
            codecDescription: this.internalTrack.info.codecDescription,
            colorSpace: this.internalTrack.info.colorSpace,
            avcType: 1,
            avcCodecInfo: this.internalTrack.info.codec === `avc` && e ? On(e.data) : null,
            hevcCodecInfo: this.internalTrack.info.codec === `hevc` && e ? Rn(e.data) : null,
            vp9CodecInfo: this.internalTrack.info.codec === `vp9` && e ? Xn(e.data) : null,
            av1CodecInfo: this.internalTrack.info.codec === `av1` && e ? Qn(e.data) : null,
            proresFormat: this.internalTrack.info.proresFormat
          }),
          codedWidth: this.internalTrack.info.width,
          codedHeight: this.internalTrack.info.height,
          description: this.internalTrack.info.codecDescription ?? undefined,
          colorSpace: this.internalTrack.info.colorSpace ?? undefined
        };
        if (this.internalTrack.info.width !== this.internalTrack.info.squarePixelWidth || this.internalTrack.info.height !== this.internalTrack.info.squarePixelHeight) {
          t.displayAspectWidth = this.internalTrack.info.squarePixelWidth;
          t.displayAspectHeight = this.internalTrack.info.squarePixelHeight;
        }
        return t;
      })();
    } else {
      return null;
    }
  }
};
var Li = class extends Fi {
  constructor(e) {
    super(e);
    this.decoderConfig = null;
    this.internalTrack = e;
  }
  getType() {
    return `audio`;
  }
  getCodec() {
    return this.internalTrack.info.codec;
  }
  getNumberOfChannels() {
    return this.internalTrack.info.numberOfChannels;
  }
  getSampleRate() {
    return this.internalTrack.info.sampleRate;
  }
  async getDecoderConfig() {
    if (this.internalTrack.info.codec) {
      return this.decoderConfig ??= {
        codec: Ht({
          codec: this.internalTrack.info.codec,
          codecDescription: this.internalTrack.info.codecDescription,
          aacCodecInfo: this.internalTrack.info.aacCodecInfo
        }),
        numberOfChannels: this.internalTrack.info.numberOfChannels,
        sampleRate: this.internalTrack.info.sampleRate,
        description: this.internalTrack.info.codecDescription ?? undefined
      };
    } else {
      return null;
    }
  }
};
var Ri = async (e, t, n, r = null) => {
  let i = 65536;
  let a = t;
  while (n === null || a < n) {
    let t = n === null ? i : Math.min(i, n - a);
    let o = e.requestSliceRange(a, 4, t);
    if (o instanceof Promise) {
      o = await o;
    }
    if (!o || o.length < 4) {
      break;
    }
    while (o.remainingLength >= 4) {
      let t = o.filePos;
      let n = fn(U(o), e.fileSize === null ? null : e.fileSize - a);
      if (n.header && (!r || n.header.sampleRate === r.sampleRate && n.header.mpegVersionId === r.mpegVersionId && n.header.layer === r.layer && gn(n.header.channel) === gn(r.channel))) {
        return {
          header: n.header,
          startPos: a
        };
      }
      o.filePos = t + n.bytesAdvanced;
      a = o.filePos;
    }
  }
  return null;
};
var zi = class extends vr {
  constructor(e) {
    super(e);
    this.metadataPromise = null;
    this.firstFrameHeader = null;
    this.firstFrameHeaderPos = null;
    this.loadedSamples = [];
    this.metadataTags = null;
    this.xingData = null;
    this.trackBackings = [];
    this.readingMutex = new C();
    this.lastSampleLoaded = false;
    this.lastLoadedPos = 0;
    this.nextTimestampInSamples = 0;
    this.reader = e._reader;
  }
  async readMetadata() {
    return this.metadataPromise ??= (async () => {
      while (!this.firstFrameHeader && !this.lastSampleLoaded) {
        await this.advanceReader();
      }
      if (!this.firstFrameHeader) {
        throw Error(`No valid MP3 frame found.`);
      }
      this.trackBackings = [new Bi(this)];
    })();
  }
  async advanceReader() {
    if (this.lastLoadedPos === 0) {
      while (true) {
        let e = this.reader.requestSlice(this.lastLoadedPos, 10);
        if (e instanceof Promise) {
          e = await e;
        }
        if (!e) {
          this.lastSampleLoaded = true;
          return;
        }
        let t = Ml(e);
        if (!t) {
          break;
        }
        this.lastLoadedPos = e.filePos + t.size;
      }
    }
    let e = await Ri(this.reader, this.lastLoadedPos, this.reader.fileSize, this.firstFrameHeader);
    if (!e) {
      this.lastSampleLoaded = true;
      return;
    }
    let t = e.header;
    this.lastLoadedPos = e.startPos + t.totalSize - 1;
    let n = dn(t.mpegVersionId, t.channel);
    let r = this.reader.requestSlice(e.startPos + n, 4);
    if (r instanceof Promise) {
      r = await r;
    }
    if (r) {
      let t = U(r);
      if (t === 1483304551 || t === 1231971951) {
        if (!this.xingData) {
          let t = this.reader.requestSlice(e.startPos + n + 4, 12);
          if (t instanceof Promise) {
            t = await t;
          }
          if (t) {
            let e = u(B(t, 12));
            let n = e.getUint32(0, false);
            this.xingData = {
              frameCount: n & hn.FrameCount ? e.getUint32(4, false) : null,
              fileSize: n & hn.FileSize ? e.getUint32(8, false) : null
            };
          }
        }
        return;
      }
    }
    if (!this.firstFrameHeader) {
      this.firstFrameHeader = t;
      this.firstFrameHeaderPos = e.startPos;
    }
    let i = t.audioSamplesInFrame / this.firstFrameHeader.sampleRate;
    let a = {
      timestamp: this.nextTimestampInSamples / this.firstFrameHeader.sampleRate,
      duration: i,
      dataStart: e.startPos,
      dataSize: t.totalSize
    };
    this.loadedSamples.push(a);
    this.nextTimestampInSamples += t.audioSamplesInFrame;
  }
  async getMimeType() {
    return `audio/mpeg`;
  }
  async getTrackBackings() {
    await this.readMetadata();
    return this.trackBackings;
  }
  async getMetadataTags() {
    let e = await this.readingMutex.acquire();
    try {
      await this.readMetadata();
      if (this.metadataTags) {
        return this.metadataTags;
      }
      this.metadataTags = {};
      let e = 0;
      let t = false;
      while (true) {
        let n = this.reader.requestSlice(e, 10);
        if (n instanceof Promise) {
          n = await n;
        }
        if (!n) {
          break;
        }
        let r = Ml(n);
        if (!r) {
          break;
        }
        t = true;
        let i = this.reader.requestSlice(n.filePos, r.size);
        if (i instanceof Promise) {
          i = await i;
        }
        if (!i) {
          break;
        }
        Nl(i, r, this.metadataTags);
        e = n.filePos + r.size;
      }
      if (!t && this.reader.fileSize !== null && this.reader.fileSize >= 128) {
        let e = this.reader.requestSlice(this.reader.fileSize - 128, 128);
        if (e instanceof Promise) {
          e = await e;
        }
        n(e);
        if (W(e, 3) === `TAG`) {
          Al(e, this.metadataTags);
        }
      }
      return this.metadataTags;
    } finally {
      e();
    }
  }
};
var Bi = class {
  constructor(e) {
    this.demuxer = e;
  }
  getType() {
    return `audio`;
  }
  getId() {
    return 1;
  }
  getNumber() {
    return 1;
  }
  getTimeResolution() {
    n(this.demuxer.firstFrameHeader);
    return this.demuxer.firstFrameHeader.sampleRate / this.demuxer.firstFrameHeader.audioSamplesInFrame;
  }
  isRelativeToUnixEpoch() {
    return false;
  }
  getUnixTimeForTimestamp() {
    return null;
  }
  getPairingMask() {
    return 1n;
  }
  getBitrate() {
    return null;
  }
  getAverageBitrate() {
    return null;
  }
  async getDurationFromMetadata() {
    let e = this.demuxer;
    n(e.firstFrameHeader !== null);
    n(e.firstFrameHeaderPos !== null);
    if (e.xingData) {
      if (e.xingData.frameCount !== null) {
        return e.xingData.frameCount * e.firstFrameHeader.audioSamplesInFrame / e.firstFrameHeader.sampleRate;
      }
    } else if (e.reader.fileSize !== null) {
      let t = un(e.firstFrameHeader.lowSamplingFrequency, e.firstFrameHeader.layer, e.firstFrameHeader.bitrate, e.firstFrameHeader.sampleRate);
      let n = (e.reader.fileSize - e.firstFrameHeaderPos) / t;
      return Math.round(n) * e.firstFrameHeader.audioSamplesInFrame / e.firstFrameHeader.sampleRate;
    }
    return null;
  }
  async getLiveRefreshInterval() {
    return null;
  }
  getName() {
    return null;
  }
  getLanguageCode() {
    return `und`;
  }
  getCodec() {
    return `mp3`;
  }
  getInternalCodecId() {
    return null;
  }
  getNumberOfChannels() {
    n(this.demuxer.firstFrameHeader);
    return gn(this.demuxer.firstFrameHeader.channel);
  }
  getSampleRate() {
    n(this.demuxer.firstFrameHeader);
    return this.demuxer.firstFrameHeader.sampleRate;
  }
  getDisposition() {
    return {
      ...yt
    };
  }
  async getDecoderConfig() {
    n(this.demuxer.firstFrameHeader);
    return {
      codec: `mp3`,
      numberOfChannels: gn(this.demuxer.firstFrameHeader.channel),
      sampleRate: this.demuxer.firstFrameHeader.sampleRate
    };
  }
  async getPacketAtIndex(e, t) {
    if (e === -1) {
      return null;
    }
    let n = this.demuxer.loadedSamples[e];
    if (!n) {
      return null;
    }
    let r;
    if (t.metadataOnly) {
      r = yr;
    } else {
      let e = this.demuxer.reader.requestSlice(n.dataStart, n.dataSize);
      if (e instanceof Promise) {
        e = await e;
      }
      if (!e) {
        return null;
      }
      r = B(e, n.dataSize);
    }
    return new I(r, `key`, n.timestamp, n.duration, e, n.dataSize);
  }
  getFirstPacket(e) {
    return this.getPacketAtIndex(0, e);
  }
  async getNextPacket(e, t) {
    let n = await this.demuxer.readingMutex.acquire();
    try {
      let n = re(this.demuxer.loadedSamples, e.timestamp, e => {
        return e.timestamp;
      });
      if (n === -1) {
        throw Error(`Packet was not created from this track.`);
      }
      let r = n + 1;
      while (r >= this.demuxer.loadedSamples.length && !this.demuxer.lastSampleLoaded) {
        await this.demuxer.advanceReader();
      }
      return this.getPacketAtIndex(r, t);
    } finally {
      n();
    }
  }
  async getPacket(e, t) {
    let n = await this.demuxer.readingMutex.acquire();
    try {
      while (true) {
        let n = T(this.demuxer.loadedSamples, e, e => {
          return e.timestamp;
        });
        if (n === -1 && this.demuxer.loadedSamples.length > 0) {
          return null;
        }
        if (this.demuxer.lastSampleLoaded || n >= 0 && n + 1 < this.demuxer.loadedSamples.length) {
          return this.getPacketAtIndex(n, t);
        }
        await this.demuxer.advanceReader();
      }
    } finally {
      n();
    }
  }
  getKeyPacket(e, t) {
    return this.getPacket(e, t);
  }
  getNextKeyPacket(e, t) {
    return this.getNextPacket(e, t);
  }
};
var Vi = 1399285583;
var Hi = 79764919;
var Ui = new Uint32Array(256);
for (let e = 0; e < 256; e++) {
  let t = e << 24;
  for (let e = 0; e < 8; e++) {
    if (t & -2147483648) {
      t = t << 1 ^ Hi;
    } else {
      t = t << 1;
    }
  }
  Ui[e] = t >>> 0 & -1;
}
var Wi = e => {
  let t = u(e);
  let n = t.getUint32(22, true);
  t.setUint32(22, 0, true);
  let r = 0;
  for (let t = 0; t < e.length; t++) {
    let n = e[t];
    r = (r << 8 ^ Ui[r >>> 24 ^ n]) >>> 0;
  }
  t.setUint32(22, n, true);
  return r;
};
var Gi = (e, t, r) => {
  let i = 0;
  let a = null;
  if (e.length > 0) {
    if (t.codec === `vorbis`) {
      n(t.vorbisInfo);
      let o = t.vorbisInfo.modeBlockflags.length;
      let s = (1 << xe(o - 1)) - 1 << 1;
      let c = (e[0] & s) >> 1;
      if (c >= t.vorbisInfo.modeBlockflags.length) {
        throw Error(`Invalid mode number.`);
      }
      let l = r;
      let u = t.vorbisInfo.modeBlockflags[c];
      a = t.vorbisInfo.blocksizes[u];
      if (u === 1) {
        let n = (s | 1) + 1;
        let r = e[0] & n ? 1 : 0;
        l = t.vorbisInfo.blocksizes[r];
      }
      if (l === null) {
        i = 0;
      } else {
        i = l + a >> 2;
      }
    } else if (t.codec === `opus`) {
      i = tr(e).durationInSamples;
    }
  }
  return {
    durationInSamples: i,
    vorbisBlockSize: a
  };
};
var Ki = e => {
  let t = `audio/ogg`;
  if (e.codecStrings) {
    let n = [...new Set(e.codecStrings)];
    t += `; codecs="${n.join(`, `)}"`;
  }
  return t;
};
var qi = 65307;
var Ji = e => {
  let t = e.filePos;
  if (vl(e) !== 1399285583) {
    return null;
  }
  e.skip(1);
  let n = V(e);
  let r = wl(e);
  let i = vl(e);
  let a = vl(e);
  let o = vl(e);
  let s = V(e);
  let c = new Uint8Array(s);
  for (let t = 0; t < s; t++) {
    c[t] = V(e);
  }
  let l = 27 + s;
  let u = c.reduce((e, t) => {
    return e + t;
  }, 0);
  return {
    headerStartPos: t,
    totalSize: l + u,
    dataStartPos: t + l,
    dataSize: u,
    headerType: n,
    granulePosition: r,
    serialNumber: i,
    sequenceNumber: a,
    checksum: o,
    lacingValues: c
  };
};
var Yi = (e, t) => {
  while (e.filePos < t - 3) {
    let t = vl(e);
    let n = t & 255;
    let r = t >>> 8 & 255;
    let i = t >>> 16 & 255;
    let a = t >>> 24 & 255;
    if (n === 79 || r === 79 || i === 79 || a === 79) {
      e.skip(-4);
      if (t === 1399285583) {
        return true;
      }
      e.skip(1);
    }
  }
  return false;
};
var Xi = class extends vr {
  constructor(e) {
    super(e);
    this.metadataPromise = null;
    this.bitstreams = [];
    this.trackBackings = [];
    this.metadataTags = {};
    this.reader = e._reader;
  }
  async readMetadata() {
    return this.metadataPromise ??= (async () => {
      let e = 0;
      while (true) {
        let t = this.reader.requestSliceRange(e, 27, 282);
        if (t instanceof Promise) {
          t = await t;
        }
        if (!t) {
          break;
        }
        let n = Ji(t);
        if (!n || !(n.headerType & 2)) {
          break;
        }
        this.bitstreams.push({
          serialNumber: n.serialNumber,
          bosPage: n,
          description: null,
          numberOfChannels: -1,
          sampleRate: -1,
          codecInfo: {
            codec: null,
            vorbisInfo: null,
            opusInfo: null
          },
          lastMetadataPacket: null
        });
        e = n.headerStartPos + n.totalSize;
      }
      for (let e of this.bitstreams) {
        let t = await this.readPacket(e.bosPage, 0);
        if (t) {
          if (t.data.byteLength >= 7 && t.data[0] === 1 && t.data[1] === 118 && t.data[2] === 111 && t.data[3] === 114 && t.data[4] === 98 && t.data[5] === 105 && t.data[6] === 115) {
            await this.readVorbisMetadata(t, e);
          } else if (t.data.byteLength >= 8 && t.data[0] === 79 && t.data[1] === 112 && t.data[2] === 117 && t.data[3] === 115 && t.data[4] === 72 && t.data[5] === 101 && t.data[6] === 97 && t.data[7] === 100) {
            await this.readOpusMetadata(t, e);
          }
          if (e.codecInfo.codec !== null) {
            this.trackBackings.push(new Zi(e, this));
          }
        }
      }
    })();
  }
  async readVorbisMetadata(e, t) {
    let n = await this.findNextPacketStart(e);
    if (!n) {
      return;
    }
    let r = await this.readPacket(n.startPage, n.startSegmentIndex);
    n = await this.findNextPacketStart(r);
    if (!r || !n) {
      return;
    }
    let i = await this.readPacket(n.startPage, n.startSegmentIndex);
    if (!i || r.data[0] !== 3 || i.data[0] !== 5) {
      return;
    }
    let a = [];
    let o = e => {
      a.push(Math.min(255, e));
      while (!(e < 255)) {
        e -= 255;
      }
    };
    o(e.data.length);
    o(r.data.length);
    let s = new Uint8Array(1 + a.length + e.data.length + r.data.length + i.data.length);
    s[0] = 2;
    s.set(a, 1);
    s.set(e.data, 1 + a.length);
    s.set(r.data, 1 + a.length + e.data.length);
    s.set(i.data, 1 + a.length + e.data.length + r.data.length);
    t.codecInfo.codec = `vorbis`;
    t.description = s;
    t.lastMetadataPacket = i;
    let c = u(e.data);
    t.numberOfChannels = c.getUint8(11);
    t.sampleRate = c.getUint32(12, true);
    let l = c.getUint8(28);
    t.codecInfo.vorbisInfo = {
      blocksizes: [1 << (l & 15), 1 << (l >> 4)],
      modeBlockflags: nr(i.data).modeBlockflags
    };
    ar(r.data.subarray(7), this.metadataTags);
  }
  async readOpusMetadata(e, t) {
    let n = await this.findNextPacketStart(e);
    if (!n) {
      return;
    }
    let r = await this.readPacket(n.startPage, n.startSegmentIndex);
    if (!r) {
      return;
    }
    t.codecInfo.codec = `opus`;
    t.description = e.data;
    t.lastMetadataPacket = r;
    let i = $n(e.data);
    t.numberOfChannels = i.outputChannelCount;
    t.sampleRate = Wt;
    t.codecInfo.opusInfo = {
      preSkip: i.preSkip
    };
    ar(r.data.subarray(8), this.metadataTags);
  }
  async readPacket(e, t) {
    n(t < e.lacingValues.length);
    let r = 0;
    for (let n = 0; n < t; n++) {
      r += e.lacingValues[n];
    }
    let i = e;
    let a = r;
    let o = t;
    let s = [];
    outer: while (true) {
      let t = this.reader.requestSlice(i.dataStartPos, i.dataSize);
      if (t instanceof Promise) {
        t = await t;
      }
      n(t);
      let c = B(t, i.dataSize);
      while (true) {
        if (o === i.lacingValues.length) {
          s.push(c.subarray(r, a));
          break;
        }
        let e = i.lacingValues[o];
        a += e;
        if (e < 255) {
          s.push(c.subarray(r, a));
          break outer;
        }
        o++;
      }
      let l = i.headerStartPos + i.totalSize;
      while (true) {
        let t = this.reader.requestSliceRange(l, 27, 282);
        if (t instanceof Promise) {
          t = await t;
        }
        if (!t) {
          return null;
        }
        let n = Ji(t);
        if (!n) {
          return null;
        }
        i = n;
        if (i.serialNumber === e.serialNumber) {
          break;
        }
        l = i.headerStartPos + i.totalSize;
      }
      r = 0;
      a = 0;
      o = 0;
    }
    let c = s.reduce((e, t) => {
      return e + t.length;
    }, 0);
    if (c === 0) {
      return null;
    }
    let l = new Uint8Array(c);
    let u = 0;
    for (let e = 0; e < s.length; e++) {
      let t = s[e];
      l.set(t, u);
      u += t.length;
    }
    return {
      data: l,
      endPage: i,
      endSegmentIndex: o
    };
  }
  async findNextPacketStart(e) {
    if (e.endSegmentIndex < e.endPage.lacingValues.length - 1) {
      return {
        startPage: e.endPage,
        startSegmentIndex: e.endSegmentIndex + 1
      };
    }
    if (e.endPage.headerType & 4) {
      return null;
    }
    let t = e.endPage.headerStartPos + e.endPage.totalSize;
    while (true) {
      let n = this.reader.requestSliceRange(t, 27, 282);
      if (n instanceof Promise) {
        n = await n;
      }
      if (!n) {
        return null;
      }
      let r = Ji(n);
      if (!r) {
        return null;
      }
      if (r.serialNumber === e.endPage.serialNumber) {
        return {
          startPage: r,
          startSegmentIndex: 0
        };
      }
      t = r.headerStartPos + r.totalSize;
    }
  }
  async getMimeType() {
    await this.readMetadata();
    return Ki({
      codecStrings: (await Promise.all(this.trackBackings.map(e => {
        return e.getDecoderConfig().then(e => {
          return e?.codec ?? null;
        });
      }))).filter(Boolean)
    });
  }
  async getTrackBackings() {
    await this.readMetadata();
    return this.trackBackings;
  }
  async getMetadataTags() {
    await this.readMetadata();
    return this.metadataTags;
  }
};
var Zi = class {
  constructor(e, t) {
    this.bitstream = e;
    this.demuxer = t;
    this.encodedPacketToMetadata = new WeakMap();
    this.sequentialScanCache = [];
    this.sequentialScanMutex = new C();
    if (e.codecInfo.codec === `opus`) {
      this.internalSampleRate = Wt;
    } else {
      this.internalSampleRate = e.sampleRate;
    }
  }
  getType() {
    return `audio`;
  }
  getId() {
    return this.bitstream.serialNumber;
  }
  getNumber() {
    let e = this.demuxer.trackBackings.findIndex(e => {
      return e.bitstream === this.bitstream;
    });
    n(e !== -1);
    return e + 1;
  }
  getNumberOfChannels() {
    return this.bitstream.numberOfChannels;
  }
  getSampleRate() {
    return this.bitstream.sampleRate;
  }
  getTimeResolution() {
    return this.bitstream.sampleRate;
  }
  isRelativeToUnixEpoch() {
    return false;
  }
  getUnixTimeForTimestamp() {
    return null;
  }
  getPairingMask() {
    return 1n;
  }
  getBitrate() {
    return null;
  }
  getAverageBitrate() {
    return null;
  }
  async getDurationFromMetadata() {
    return null;
  }
  async getLiveRefreshInterval() {
    return null;
  }
  getCodec() {
    return this.bitstream.codecInfo.codec;
  }
  getInternalCodecId() {
    return null;
  }
  async getDecoderConfig() {
    n(this.bitstream.codecInfo.codec);
    return {
      codec: this.bitstream.codecInfo.codec,
      numberOfChannels: this.bitstream.numberOfChannels,
      sampleRate: this.bitstream.sampleRate,
      description: this.bitstream.description ?? undefined
    };
  }
  getName() {
    return null;
  }
  getLanguageCode() {
    return `und`;
  }
  getDisposition() {
    return {
      ...yt,
      primary: false
    };
  }
  granulePositionToTimestampInSamples(e) {
    if (this.bitstream.codecInfo.codec === `opus`) {
      n(this.bitstream.codecInfo.opusInfo);
      return e - this.bitstream.codecInfo.opusInfo.preSkip;
    } else {
      return e;
    }
  }
  createEncodedPacketFromOggPacket(e, t, n) {
    if (!e) {
      return null;
    }
    let {
      durationInSamples: r,
      vorbisBlockSize: i
    } = Gi(e.data, this.bitstream.codecInfo, t.vorbisLastBlocksize);
    let a = new I(n.metadataOnly ? yr : e.data, `key`, Math.max(0, t.timestampInSamples) / this.internalSampleRate, r / this.internalSampleRate, e.endPage.headerStartPos + e.endSegmentIndex, e.data.byteLength);
    this.encodedPacketToMetadata.set(a, {
      packet: e,
      timestampInSamples: t.timestampInSamples,
      durationInSamples: r,
      vorbisLastBlockSize: t.vorbisLastBlocksize,
      vorbisBlockSize: i
    });
    return a;
  }
  async getFirstPacket(e) {
    n(this.bitstream.lastMetadataPacket);
    let t = await this.demuxer.findNextPacketStart(this.bitstream.lastMetadataPacket);
    if (!t) {
      return null;
    }
    let r = 0;
    if (this.bitstream.codecInfo.codec === `opus`) {
      n(this.bitstream.codecInfo.opusInfo);
      r -= this.bitstream.codecInfo.opusInfo.preSkip;
    }
    let i = await this.demuxer.readPacket(t.startPage, t.startSegmentIndex);
    return this.createEncodedPacketFromOggPacket(i, {
      timestampInSamples: r,
      vorbisLastBlocksize: null
    }, e);
  }
  async getNextPacket(e, t) {
    let n = this.encodedPacketToMetadata.get(e);
    if (!n) {
      throw Error(`Packet was not created from this track.`);
    }
    let r = await this.demuxer.findNextPacketStart(n.packet);
    if (!r) {
      return null;
    }
    let i = n.timestampInSamples + n.durationInSamples;
    let a = await this.demuxer.readPacket(r.startPage, r.startSegmentIndex);
    return this.createEncodedPacketFromOggPacket(a, {
      timestampInSamples: i,
      vorbisLastBlocksize: n.vorbisBlockSize
    }, t);
  }
  async getPacket(e, t) {
    if (this.demuxer.reader.fileSize === null) {
      return this.getPacketSequential(e, t);
    }
    let r = ge(e * this.internalSampleRate);
    if (r === 0) {
      return this.getFirstPacket(t);
    }
    if (r < 0) {
      return null;
    }
    n(this.bitstream.lastMetadataPacket);
    let i = await this.demuxer.findNextPacketStart(this.bitstream.lastMetadataPacket);
    if (!i) {
      return null;
    }
    let a = i.startPage;
    let o = this.demuxer.reader.fileSize;
    let s = [a];
    outer: while (a.headerStartPos + a.totalSize < o) {
      let e = a.headerStartPos;
      let t = Math.floor((e + o) / 2);
      let i = t;
      while (true) {
        let e = Math.min(i + qi, o - 27);
        let c = this.demuxer.reader.requestSlice(i, e - i);
        if (c instanceof Promise) {
          c = await c;
        }
        n(c);
        if (!Yi(c, e)) {
          o = t + 27;
          continue outer;
        }
        let l = this.demuxer.reader.requestSliceRange(c.filePos, 27, 282);
        if (l instanceof Promise) {
          l = await l;
        }
        n(l);
        let u = Ji(l);
        n(u);
        let d = false;
        if (u.serialNumber === this.bitstream.serialNumber) {
          d = true;
        } else {
          let e = this.demuxer.reader.requestSlice(u.headerStartPos, u.totalSize);
          if (e instanceof Promise) {
            e = await e;
          }
          n(e);
          d = Wi(B(e, u.totalSize)) === u.checksum;
        }
        if (!d) {
          i = u.headerStartPos + 4;
          continue;
        }
        if (d && u.serialNumber !== this.bitstream.serialNumber) {
          i = u.headerStartPos + u.totalSize;
          continue;
        }
        if (u.granulePosition === -1) {
          i = u.headerStartPos + u.totalSize;
          continue;
        }
        if (this.granulePositionToTimestampInSamples(u.granulePosition) > r) {
          o = u.headerStartPos;
        } else {
          a = u;
          s.push(u);
        }
        continue outer;
      }
    }
    let c = i.startPage;
    for (let e of s) {
      if (e.granulePosition === a.granulePosition) {
        break;
      }
      if (!c || e.headerStartPos > c.headerStartPos) {
        c = e;
      }
    }
    let l = c;
    let u = [l];
    while (l.serialNumber !== this.bitstream.serialNumber || l.granulePosition !== a.granulePosition) {
      let e = l.headerStartPos + l.totalSize;
      let t = this.demuxer.reader.requestSliceRange(e, 27, 282);
      if (t instanceof Promise) {
        t = await t;
      }
      n(t);
      let r = Ji(t);
      n(r);
      l = r;
      if (l.serialNumber === this.bitstream.serialNumber) {
        u.push(l);
      }
    }
    n(l.granulePosition !== -1);
    let d = null;
    let f;
    let p;
    let m = l;
    let h = 0;
    if (l.headerStartPos === i.startPage.headerStartPos) {
      f = this.granulePositionToTimestampInSamples(0);
      p = true;
      d = 0;
    } else {
      f = 0;
      p = false;
      for (let e = l.lacingValues.length - 1; e >= 0; e--) {
        if (l.lacingValues[e] < 255) {
          d = e + 1;
          break;
        }
      }
      if (d === null) {
        throw Error(`Invalid page with granule position: no packets end on this page.`);
      }
      h = d - 1;
      let e = {
        data: yr,
        endPage: m,
        endSegmentIndex: h
      };
      if (await this.demuxer.findNextPacketStart(e)) {
        let e = $i(u, l, d);
        n(e);
        let t = Qi(u, e.page, e.segmentIndex);
        if (t) {
          l = t.page;
          d = t.segmentIndex;
        }
      } else {
        while (true) {
          let e = $i(u, l, d);
          if (!e) {
            break;
          }
          let t = Qi(u, e.page, e.segmentIndex);
          if (!t) {
            break;
          }
          l = t.page;
          d = t.segmentIndex;
          if (e.page.headerStartPos !== m.headerStartPos) {
            m = e.page;
            h = e.segmentIndex;
            break;
          }
        }
      }
    }
    let g = null;
    let _ = null;
    while (l !== null) {
      n(d !== null);
      let e = await this.demuxer.readPacket(l, d);
      if (!e) {
        break;
      }
      if (l.headerStartPos !== i.startPage.headerStartPos || !(d < i.startSegmentIndex)) {
        let i = this.createEncodedPacketFromOggPacket(e, {
          timestampInSamples: f,
          vorbisLastBlocksize: _?.vorbisBlockSize ?? null
        }, t);
        n(i);
        let a = this.encodedPacketToMetadata.get(i);
        n(a);
        if (!p && e.endPage.headerStartPos === m.headerStartPos && e.endSegmentIndex === h) {
          f = this.granulePositionToTimestampInSamples(l.granulePosition);
          p = true;
          i = this.createEncodedPacketFromOggPacket(e, {
            timestampInSamples: f - a.durationInSamples,
            vorbisLastBlocksize: _?.vorbisBlockSize ?? null
          }, t);
          n(i);
          a = this.encodedPacketToMetadata.get(i);
          n(a);
        } else {
          f += a.durationInSamples;
        }
        g = i;
        _ = a;
        if (p && (Math.max(f, 0) > r || Math.max(a.timestampInSamples, 0) === r)) {
          break;
        }
      }
      let a = await this.demuxer.findNextPacketStart(e);
      if (!a) {
        break;
      }
      l = a.startPage;
      d = a.startSegmentIndex;
    }
    return g;
  }
  async getPacketSequential(e, t) {
    let r = await this.sequentialScanMutex.acquire();
    try {
      let r = ge(e * this.internalSampleRate);
      e = r / this.internalSampleRate;
      let a = T(this.sequentialScanCache, r, e => {
        return e.timestampInSamples;
      });
      let o;
      if (a !== -1) {
        let e = this.sequentialScanCache[a];
        o = this.createEncodedPacketFromOggPacket(e.packet, {
          timestampInSamples: e.timestampInSamples,
          vorbisLastBlocksize: e.vorbisLastBlockSize
        }, t);
      } else {
        o = await this.getFirstPacket(t);
      }
      let s = 0;
      while (o && o.timestamp < e) {
        let r = await this.getNextPacket(o, t);
        if (!r || r.timestamp > e) {
          break;
        }
        o = r;
        s++;
        if (s === 100) {
          s = 0;
          let e = this.encodedPacketToMetadata.get(o);
          n(e);
          if (this.sequentialScanCache.length > 0) {
            n(i(this.sequentialScanCache).timestampInSamples <= e.timestampInSamples);
          }
          this.sequentialScanCache.push(e);
        }
      }
      return o;
    } finally {
      r();
    }
  }
  getKeyPacket(e, t) {
    return this.getPacket(e, t);
  }
  getNextKeyPacket(e, t) {
    return this.getNextPacket(e, t);
  }
};
var Qi = (e, t, r) => {
  let i = t;
  let a = r;
  outer: while (true) {
    for (a--; a >= 0; a--) {
      if (i.lacingValues[a] < 255) {
        a++;
        break outer;
      }
    }
    n(a === -1);
    if (!(i.headerType & 1)) {
      a = 0;
      break;
    }
    let t = oe(e, e => {
      return e.headerStartPos < i.headerStartPos;
    });
    if (!t) {
      return null;
    }
    i = t;
    a = i.lacingValues.length;
  }
  n(a !== -1);
  if (a === i.lacingValues.length) {
    let t = e[e.indexOf(i) + 1];
    n(t);
    i = t;
    a = 0;
  }
  return {
    page: i,
    segmentIndex: a
  };
};
var $i = (e, t, n) => {
  if (n > 0) {
    return {
      page: t,
      segmentIndex: n - 1
    };
  }
  let r = oe(e, e => {
    return e.headerStartPos < t.headerStartPos;
  });
  if (r) {
    return {
      page: r,
      segmentIndex: r.lacingValues.length - 1
    };
  } else {
    return null;
  }
};
var ea;
(function (e) {
  e[e.PCM = 1] = `PCM`;
  e[e.IEEE_FLOAT = 3] = `IEEE_FLOAT`;
  e[e.ALAW = 6] = `ALAW`;
  e[e.MULAW = 7] = `MULAW`;
  e[e.EXTENSIBLE = 65534] = `EXTENSIBLE`;
})(ea ||= {});
var ta = class extends vr {
  constructor(e) {
    super(e);
    this.metadataPromise = null;
    this.dataStart = -1;
    this.dataSize = -1;
    this.audioInfo = null;
    this.trackBackings = [];
    this.lastKnownPacketIndex = 0;
    this.metadataTags = {};
    this.reader = e._reader;
  }
  async readMetadata() {
    return this.metadataPromise ??= (async () => {
      let e = this.reader.requestSlice(0, 12);
      if (e instanceof Promise) {
        e = await e;
      }
      n(e);
      let t = W(e, 4);
      let r = t !== `RIFX`;
      let i = t === `RF64`;
      let a = _l(e, r);
      let o = i ? this.reader.fileSize : Math.min(a + 8, this.reader.fileSize ?? Infinity);
      if (W(e, 4) !== `WAVE`) {
        throw Error(`Invalid WAVE file - wrong format`);
      }
      let s = 0;
      let c = null;
      let l = e.filePos;
      while (o === null || l < o) {
        let e = this.reader.requestSlice(l, 8);
        if (e instanceof Promise) {
          e = await e;
        }
        if (!e) {
          break;
        }
        let t = W(e, 4);
        let n = _l(e, r);
        let a = e.filePos;
        if (i && s === 0 && t !== `ds64`) {
          throw Error(`Invalid RF64 file: First chunk must be "ds64".`);
        }
        if (t === `fmt `) {
          await this.parseFmtChunk(a, n, r);
        } else if (t === `data`) {
          c ??= n;
          this.dataStart = e.filePos;
          this.dataSize = Math.min(c, (o ?? Infinity) - this.dataStart);
          if (this.reader.fileSize === null) {
            break;
          }
        } else if (t === `ds64`) {
          let e = this.reader.requestSlice(a, n);
          if (e instanceof Promise) {
            e = await e;
          }
          if (!e) {
            break;
          }
          let t = xl(e, r);
          c = xl(e, r);
          o = Math.min(t + 8, this.reader.fileSize ?? Infinity);
        } else if (t === `LIST`) {
          await this.parseListChunk(a, n, r);
        } else if (t === `ID3 ` || t === `id3 `) {
          await this.parseId3Chunk(a, n);
        }
        l = a + n + (n & 1);
        s++;
      }
      if (!this.audioInfo) {
        throw Error(`Invalid WAVE file - missing "fmt " chunk`);
      }
      if (this.dataStart === -1) {
        throw Error(`Invalid WAVE file - missing "data" chunk`);
      }
      let u = this.audioInfo.blockSizeInBytes;
      this.dataSize = Math.floor(this.dataSize / u) * u;
      this.trackBackings.push(new ra(this));
    })();
  }
  async parseFmtChunk(e, t, n) {
    let r = this.reader.requestSlice(e, t);
    if (r instanceof Promise) {
      r = await r;
    }
    if (!r) {
      return;
    }
    let i = ml(r, n);
    let a = ml(r, n);
    let o = _l(r, n);
    r.skip(4);
    let s = ml(r, n);
    let c;
    if (t === 14) {
      c = 8;
    } else {
      c = ml(r, n);
    }
    if (t >= 18 && i !== 357) {
      let e = ml(r, n);
      let a = t - 18;
      if (Math.min(a, e) >= 22 && i === ea.EXTENSIBLE) {
        r.skip(6);
        let e = B(r, 16);
        i = e[0] | e[1] << 8;
      }
    }
    if (i === ea.MULAW || i === ea.ALAW) {
      c = 8;
    }
    this.audioInfo = {
      format: i,
      numberOfChannels: a,
      sampleRate: o,
      sampleSizeInBytes: Math.ceil(c / 8),
      blockSizeInBytes: s
    };
  }
  async parseListChunk(e, t, n) {
    let r = this.reader.requestSlice(e, t);
    if (r instanceof Promise) {
      r = await r;
    }
    if (!r) {
      return;
    }
    let i = W(r, 4);
    if (i !== `INFO` && i !== `INF0`) {
      return;
    }
    let a = r.filePos;
    while (a <= e + t - 8) {
      r.filePos = a;
      let e = W(r, 4);
      let t = _l(r, n);
      let i = B(r, t);
      let o = 0;
      for (let e = 0; e < i.length && i[e] !== 0; e++) {
        o++;
      }
      let s = String.fromCharCode(...i.subarray(0, o));
      this.metadataTags.raw ??= {};
      this.metadataTags.raw[e] = s;
      switch (e) {
        case `INAM`:
        case `TITL`:
          {
            this.metadataTags.title ??= s;
            break;
          }
        case `TIT3`:
          {
            this.metadataTags.description ??= s;
            break;
          }
        case `IART`:
          {
            this.metadataTags.artist ??= s;
            break;
          }
        case `IPRD`:
          {
            this.metadataTags.album ??= s;
            break;
          }
        case `IPRT`:
        case `ITRK`:
        case `TRCK`:
          {
            let e = s.split(`/`);
            let t = Number.parseInt(e[0], 10);
            let n = e[1] && Number.parseInt(e[1], 10);
            if (Number.isInteger(t) && t > 0) {
              this.metadataTags.trackNumber ??= t;
            }
            if (n && Number.isInteger(n) && n > 0) {
              this.metadataTags.tracksTotal ??= n;
            }
          }
          break;
        case `ICRD`:
        case `IDIT`:
          {
            let e = new Date(s);
            if (!Number.isNaN(e.getTime())) {
              this.metadataTags.date ??= e;
            }
          }
          break;
        case `YEAR`:
          {
            let e = Number.parseInt(s, 10);
            if (Number.isInteger(e) && e > 0) {
              this.metadataTags.date ??= new Date(e, 0, 1);
            }
          }
          break;
        case `IGNR`:
        case `GENR`:
          {
            this.metadataTags.genre ??= s;
            break;
          }
        case `ICMT`:
        case `CMNT`:
        case `COMM`:
          {
            this.metadataTags.comment ??= s;
            break;
          }
      }
      a += 8 + t + (t & 1);
    }
  }
  async parseId3Chunk(e, t) {
    let n = this.reader.requestSlice(e, t);
    if (n instanceof Promise) {
      n = await n;
    }
    if (!n) {
      return;
    }
    let r = Ml(n);
    if (r) {
      let i = t - 10;
      r.size = Math.min(r.size, i);
      if (r.size > 0) {
        Nl(n.slice(e + 10, r.size), r, this.metadataTags);
      }
    }
  }
  getCodec() {
    n(this.audioInfo);
    if (this.audioInfo.format === ea.MULAW) {
      return `ulaw`;
    }
    if (this.audioInfo.format === ea.ALAW) {
      return `alaw`;
    }
    if (this.audioInfo.format === ea.PCM) {
      if (this.audioInfo.sampleSizeInBytes === 1) {
        return `pcm-u8`;
      }
      if (this.audioInfo.sampleSizeInBytes === 2) {
        return `pcm-s16`;
      }
      if (this.audioInfo.sampleSizeInBytes === 3) {
        return `pcm-s24`;
      }
      if (this.audioInfo.sampleSizeInBytes === 4) {
        return `pcm-s32`;
      }
    }
    if (this.audioInfo.format === ea.IEEE_FLOAT && this.audioInfo.sampleSizeInBytes === 4) {
      return `pcm-f32`;
    } else {
      return null;
    }
  }
  async getMimeType() {
    return `audio/wav`;
  }
  async getTrackBackings() {
    await this.readMetadata();
    return this.trackBackings;
  }
  async getMetadataTags() {
    await this.readMetadata();
    return this.metadataTags;
  }
};
var na = 2048;
var ra = class {
  constructor(e) {
    this.demuxer = e;
  }
  getType() {
    return `audio`;
  }
  getId() {
    return 1;
  }
  getNumber() {
    return 1;
  }
  getCodec() {
    return this.demuxer.getCodec();
  }
  getInternalCodecId() {
    n(this.demuxer.audioInfo);
    return this.demuxer.audioInfo.format;
  }
  async getDecoderConfig() {
    let e = this.demuxer.getCodec();
    if (e) {
      n(this.demuxer.audioInfo);
      return {
        codec: e,
        numberOfChannels: this.demuxer.audioInfo.numberOfChannels,
        sampleRate: this.demuxer.audioInfo.sampleRate
      };
    } else {
      return null;
    }
  }
  getNumberOfChannels() {
    n(this.demuxer.audioInfo);
    return this.demuxer.audioInfo.numberOfChannels;
  }
  getSampleRate() {
    n(this.demuxer.audioInfo);
    return this.demuxer.audioInfo.sampleRate;
  }
  getTimeResolution() {
    n(this.demuxer.audioInfo);
    return this.demuxer.audioInfo.sampleRate;
  }
  isRelativeToUnixEpoch() {
    return false;
  }
  getUnixTimeForTimestamp() {
    return null;
  }
  getPairingMask() {
    return 1n;
  }
  getBitrate() {
    return null;
  }
  getAverageBitrate() {
    return null;
  }
  async getDurationFromMetadata() {
    n(this.demuxer.dataSize !== -1);
    return this.demuxer.dataSize / this.demuxer.audioInfo.blockSizeInBytes / this.demuxer.audioInfo.sampleRate;
  }
  async getLiveRefreshInterval() {
    return null;
  }
  getName() {
    return null;
  }
  getLanguageCode() {
    return `und`;
  }
  getDisposition() {
    return {
      ...yt
    };
  }
  async getPacketAtIndex(e, t) {
    n(e >= 0);
    n(this.demuxer.audioInfo);
    let r = e * na * this.demuxer.audioInfo.blockSizeInBytes;
    if (r >= this.demuxer.dataSize) {
      return null;
    }
    let i = Math.min(na * this.demuxer.audioInfo.blockSizeInBytes, this.demuxer.dataSize - r);
    if (this.demuxer.reader.fileSize === null) {
      let e = this.demuxer.reader.requestSlice(this.demuxer.dataStart + r, i);
      if (e instanceof Promise) {
        e = await e;
      }
      if (!e) {
        return null;
      }
    }
    let a;
    if (t.metadataOnly) {
      a = yr;
    } else {
      let e = this.demuxer.reader.requestSlice(this.demuxer.dataStart + r, i);
      if (e instanceof Promise) {
        e = await e;
      }
      n(e);
      a = B(e, i);
    }
    let o = e * na / this.demuxer.audioInfo.sampleRate;
    let s = i / this.demuxer.audioInfo.blockSizeInBytes / this.demuxer.audioInfo.sampleRate;
    this.demuxer.lastKnownPacketIndex = Math.max(e, this.demuxer.lastKnownPacketIndex);
    return new I(a, `key`, o, s, e, i);
  }
  getFirstPacket(e) {
    return this.getPacketAtIndex(0, e);
  }
  async getPacket(e, t) {
    n(this.demuxer.audioInfo);
    let r = Math.floor(Math.min(e * this.demuxer.audioInfo.sampleRate / na, (this.demuxer.dataSize - 1) / (na * this.demuxer.audioInfo.blockSizeInBytes)));
    if (r < 0) {
      return null;
    }
    let i = await this.getPacketAtIndex(r, t);
    if (i) {
      return i;
    }
    if (r === 0) {
      return null;
    }
    n(this.demuxer.reader.fileSize === null);
    let a = await this.getPacketAtIndex(this.demuxer.lastKnownPacketIndex, t);
    while (a) {
      let e = await this.getNextPacket(a, t);
      if (!e) {
        break;
      }
      a = e;
    }
    return a;
  }
  getNextPacket(e, t) {
    n(this.demuxer.audioInfo);
    let r = Math.round(e.timestamp * this.demuxer.audioInfo.sampleRate / na);
    return this.getPacketAtIndex(r + 1, t);
  }
  getKeyPacket(e, t) {
    return this.getPacket(e, t);
  }
  getNextKeyPacket(e, t) {
    return this.getNextPacket(e, t);
  }
};
var ia = e => {
  let t = e.filePos;
  let n = new A(B(e, 9));
  n.skipBits(1);
  if (n.readBits(12) !== 4095 || n.readBits(2) !== 0) {
    return null;
  }
  let r = n.readBits(1);
  let i = n.readBits(2) + 1;
  let a = n.readBits(4);
  if (a === 15) {
    return null;
  }
  n.skipBits(1);
  let o = n.readBits(3);
  if (o === 0) {
    throw Error(`ADTS frames with channel configuration 0 are not supported.`);
  }
  n.skipBits(1);
  n.skipBits(1);
  n.skipBits(1);
  n.skipBits(1);
  let s = n.readBits(13);
  n.skipBits(11);
  let c = n.readBits(2) + 1;
  if (c !== 1) {
    throw Error(`ADTS frames with more than one AAC frame are not supported.`);
  }
  let l = null;
  if (r === 1) {
    e.filePos -= 2;
  } else {
    l = n.readBits(16);
  }
  return {
    objectType: i,
    samplingFrequencyIndex: a,
    channelConfiguration: o,
    frameLength: s,
    numberOfAacFrames: c,
    crcCheck: l,
    startPos: t
  };
};
var aa = 1024;
var oa = class extends vr {
  constructor(e) {
    super(e);
    this.metadataPromise = null;
    this.firstFrameHeader = null;
    this.loadedSamples = [];
    this.metadataTags = null;
    this.trackBackings = [];
    this.readingMutex = new C();
    this.lastSampleLoaded = false;
    this.lastLoadedPos = 0;
    this.nextTimestampInSamples = 0;
    this.reader = e._reader;
  }
  async readMetadata() {
    return this.metadataPromise ??= (async () => {
      while (!this.firstFrameHeader && !this.lastSampleLoaded) {
        await this.advanceReader();
      }
      n(this.firstFrameHeader);
      this.trackBackings = [new sa(this)];
    })();
  }
  async advanceReader() {
    if (this.lastLoadedPos === 0) {
      while (true) {
        let e = this.reader.requestSlice(this.lastLoadedPos, 10);
        if (e instanceof Promise) {
          e = await e;
        }
        if (!e) {
          this.lastSampleLoaded = true;
          return;
        }
        let t = Ml(e);
        if (!t) {
          break;
        }
        this.lastLoadedPos = e.filePos + t.size;
      }
    }
    let e = this.reader.requestSliceRange(this.lastLoadedPos, 7, 9);
    if (e instanceof Promise) {
      e = await e;
    }
    if (!e) {
      this.lastSampleLoaded = true;
      return;
    }
    let t = ia(e);
    if (!t) {
      this.lastSampleLoaded = true;
      return;
    }
    if (this.reader.fileSize !== null && t.startPos + t.frameLength > this.reader.fileSize) {
      this.lastSampleLoaded = true;
      return;
    }
    this.firstFrameHeader ||= t;
    let r = xt[t.samplingFrequencyIndex];
    n(r !== undefined);
    let i = aa / r;
    let a = {
      timestamp: this.nextTimestampInSamples / r,
      duration: i,
      dataStart: t.startPos,
      dataSize: t.frameLength
    };
    this.loadedSamples.push(a);
    this.nextTimestampInSamples += aa;
    this.lastLoadedPos = t.startPos + t.frameLength;
  }
  async getMimeType() {
    return `audio/aac`;
  }
  async getTrackBackings() {
    await this.readMetadata();
    return this.trackBackings;
  }
  async getMetadataTags() {
    let e = await this.readingMutex.acquire();
    try {
      await this.readMetadata();
      if (this.metadataTags) {
        return this.metadataTags;
      }
      this.metadataTags = {};
      let e = 0;
      while (true) {
        let t = this.reader.requestSlice(e, 10);
        if (t instanceof Promise) {
          t = await t;
        }
        if (!t) {
          break;
        }
        let n = Ml(t);
        if (!n) {
          break;
        }
        let r = this.reader.requestSlice(t.filePos, n.size);
        if (r instanceof Promise) {
          r = await r;
        }
        if (!r) {
          break;
        }
        Nl(r, n, this.metadataTags);
        e = t.filePos + n.size;
      }
      return this.metadataTags;
    } finally {
      e();
    }
  }
};
var sa = class {
  constructor(e) {
    this.demuxer = e;
  }
  getType() {
    return `audio`;
  }
  getId() {
    return 1;
  }
  getNumber() {
    return 1;
  }
  getTimeResolution() {
    return this.getSampleRate() / aa;
  }
  isRelativeToUnixEpoch() {
    return false;
  }
  getUnixTimeForTimestamp() {
    return null;
  }
  getPairingMask() {
    return 1n;
  }
  getBitrate() {
    return null;
  }
  getAverageBitrate() {
    return null;
  }
  async getDurationFromMetadata() {
    return null;
  }
  async getLiveRefreshInterval() {
    return null;
  }
  getName() {
    return null;
  }
  getLanguageCode() {
    return `und`;
  }
  getCodec() {
    return `aac`;
  }
  getInternalCodecId() {
    n(this.demuxer.firstFrameHeader);
    return this.demuxer.firstFrameHeader.objectType;
  }
  getNumberOfChannels() {
    n(this.demuxer.firstFrameHeader);
    let e = St[this.demuxer.firstFrameHeader.channelConfiguration];
    n(e !== undefined);
    return e;
  }
  getSampleRate() {
    n(this.demuxer.firstFrameHeader);
    let e = xt[this.demuxer.firstFrameHeader.samplingFrequencyIndex];
    n(e !== undefined);
    return e;
  }
  getDisposition() {
    return {
      ...yt
    };
  }
  async getDecoderConfig() {
    n(this.demuxer.firstFrameHeader);
    return {
      codec: `mp4a.40.${this.demuxer.firstFrameHeader.objectType}`,
      numberOfChannels: this.getNumberOfChannels(),
      sampleRate: this.getSampleRate()
    };
  }
  async getPacketAtIndex(e, t) {
    if (e === -1) {
      return null;
    }
    let n = this.demuxer.loadedSamples[e];
    if (!n) {
      return null;
    }
    let r;
    if (t.metadataOnly) {
      r = yr;
    } else {
      let e = this.demuxer.reader.requestSlice(n.dataStart, n.dataSize);
      if (e instanceof Promise) {
        e = await e;
      }
      if (!e) {
        return null;
      }
      r = B(e, n.dataSize);
    }
    return new I(r, `key`, n.timestamp, n.duration, e, n.dataSize);
  }
  getFirstPacket(e) {
    return this.getPacketAtIndex(0, e);
  }
  async getNextPacket(e, t) {
    let n = await this.demuxer.readingMutex.acquire();
    try {
      let n = re(this.demuxer.loadedSamples, e.timestamp, e => {
        return e.timestamp;
      });
      if (n === -1) {
        throw Error(`Packet was not created from this track.`);
      }
      let r = n + 1;
      while (r >= this.demuxer.loadedSamples.length && !this.demuxer.lastSampleLoaded) {
        await this.demuxer.advanceReader();
      }
      return this.getPacketAtIndex(r, t);
    } finally {
      n();
    }
  }
  async getPacket(e, t) {
    let n = await this.demuxer.readingMutex.acquire();
    try {
      while (true) {
        let n = T(this.demuxer.loadedSamples, e, e => {
          return e.timestamp;
        });
        if (n === -1 && this.demuxer.loadedSamples.length > 0) {
          return null;
        }
        if (this.demuxer.lastSampleLoaded || n >= 0 && n + 1 < this.demuxer.loadedSamples.length) {
          return this.getPacketAtIndex(n, t);
        }
        await this.demuxer.advanceReader();
      }
    } finally {
      n();
    }
  }
  getKeyPacket(e, t) {
    return this.getPacket(e, t);
  }
  getNextKeyPacket(e, t) {
    return this.getNextPacket(e, t);
  }
};
var ca = e => {
  if (e === 0) {
    return null;
  } else {
    if (e === 1) {
      return 192;
    } else {
      if (e >= 2 && e <= 5) {
        return 2 ** e * 144;
      } else {
        if (e === 6) {
          return `uncommon-u8`;
        } else {
          if (e === 7) {
            return `uncommon-u16`;
          } else {
            if (e >= 8 && e <= 15) {
              return 2 ** e;
            } else {
              return null;
            }
          }
        }
      }
    }
  }
};
var la = (e, t) => {
  switch (e) {
    case 0:
      {
        return t;
      }
    case 1:
      {
        return 88200;
      }
    case 2:
      {
        return 176400;
      }
    case 3:
      {
        return 192000;
      }
    case 4:
      {
        return 8000;
      }
    case 5:
      {
        return 16000;
      }
    case 6:
      {
        return 22050;
      }
    case 7:
      {
        return 24000;
      }
    case 8:
      {
        return 32000;
      }
    case 9:
      {
        return 44100;
      }
    case 10:
      {
        return 48000;
      }
    case 11:
      {
        return 96000;
      }
    case 12:
      {
        return `uncommon-u8`;
      }
    case 13:
      {
        return `uncommon-u16`;
      }
    case 14:
      {
        return `uncommon-u16-10`;
      }
    default:
      {
        return null;
      }
  }
};
var ua = e => {
  let t = 0;
  let n = new A(B(e, 1));
  while (n.readBits(1) === 1) {
    t++;
  }
  if (t === 0) {
    return n.readBits(7);
  }
  let r = [];
  let i = t - 1;
  let a = new A(B(e, i));
  let o = 8 - t - 1;
  for (let e = 0; e < o; e++) {
    r.unshift(n.readBits(1));
  }
  for (let e = 0; e < i; e++) {
    for (let e = 0; e < 8; e++) {
      let t = a.readBits(1);
      if (!(e < 2)) {
        r.unshift(t);
      }
    }
  }
  return r.reduce((e, t, n) => {
    return e | t << n;
  }, 0);
};
var da = (e, t) => {
  if (t === `uncommon-u16`) {
    return H(e) + 1;
  }
  if (t === `uncommon-u8`) {
    return V(e) + 1;
  }
  if (typeof t == `number`) {
    return t;
  }
  D(t);
  n(false);
};
var fa = (e, t) => {
  if (t === `uncommon-u16`) {
    return H(e);
  } else {
    if (t === `uncommon-u16-10`) {
      return H(e) * 10;
    } else {
      if (t === `uncommon-u8`) {
        return V(e);
      } else {
        if (typeof t == `number`) {
          return t;
        } else {
          return null;
        }
      }
    }
  }
};
var pa = e => {
  let t = 0;
  for (let n of e) {
    t ^= n;
    for (let e = 0; e < 8; e++) {
      if (t & 128) {
        t = t << 1 ^ 7;
      } else {
        t <<= 1;
      }
      t &= 255;
    }
  }
  return t;
};
var ma = class extends vr {
  constructor(e) {
    super(e);
    this.loadedSamples = [];
    this.metadataPromise = null;
    this.trackBacking = null;
    this.metadataTags = {};
    this.audioInfo = null;
    this.lastLoadedPos = null;
    this.blockingBit = null;
    this.readingMutex = new C();
    this.lastSampleLoaded = false;
    this.reader = e._reader;
  }
  async getMetadataTags() {
    await this.readMetadata();
    return this.metadataTags;
  }
  async getTrackBackings() {
    await this.readMetadata();
    n(this.trackBacking);
    return [this.trackBacking];
  }
  async getMimeType() {
    return `audio/flac`;
  }
  async readMetadata() {
    return this.metadataPromise ??= (async () => {
      let e = 0;
      while (true) {
        let t = this.reader.requestSlice(e, 10);
        if (t instanceof Promise) {
          t = await t;
        }
        if (!t) {
          this.lastSampleLoaded = true;
          return;
        }
        let r = Ml(t);
        if (!r) {
          break;
        }
        let i = this.reader.requestSlice(t.filePos, r.size);
        if (i instanceof Promise) {
          i = await i;
        }
        n(i);
        Nl(i, r, this.metadataTags);
        e = t.filePos + r.size;
      }
      for (e += 4; this.reader.fileSize === null || e < this.reader.fileSize;) {
        let t = this.reader.requestSlice(e, 4);
        if (t instanceof Promise) {
          t = await t;
        }
        e += 4;
        if (t === null) {
          throw Error(`Metadata block at position ${e} is too small! Corrupted file.`);
        }
        n(t);
        let r = V(t);
        let i = hl(t);
        let a = (r & 128) != 0;
        switch (r & 127) {
          case ir.STREAMINFO:
            {
              let t = this.reader.requestSlice(e, i);
              if (t instanceof Promise) {
                t = await t;
              }
              n(t);
              if (t === null) {
                throw Error(`StreamInfo block at position ${e} is too small! Corrupted file.`);
              }
              let r = B(t, 34);
              let a = new A(r);
              let o = a.readBits(16);
              let s = a.readBits(16);
              let c = a.readBits(24);
              let l = a.readBits(24);
              let u = a.readBits(20);
              let d = a.readBits(3) + 1;
              a.readBits(5);
              let f = a.readBits(36);
              a.skipBits(128);
              let p = new Uint8Array(42);
              p.set(new Uint8Array([102, 76, 97, 67]), 0);
              p.set(new Uint8Array([128, 0, 0, 34]), 4);
              p.set(r, 8);
              this.audioInfo = {
                numberOfChannels: d,
                sampleRate: u,
                totalSamples: f,
                minimumBlockSize: o,
                maximumBlockSize: s,
                minimumFrameSize: c,
                maximumFrameSize: l,
                description: p
              };
              this.trackBacking = new ha(this);
              break;
            }
          case ir.VORBIS_COMMENT:
            {
              let t = this.reader.requestSlice(e, i);
              if (t instanceof Promise) {
                t = await t;
              }
              n(t);
              ar(B(t, i), this.metadataTags);
              break;
            }
          case ir.PICTURE:
            {
              let t = this.reader.requestSlice(e, i);
              if (t instanceof Promise) {
                t = await t;
              }
              n(t);
              let r = U(t);
              let a = U(t);
              let o = d.decode(B(t, a));
              let s = U(t);
              let c = d.decode(B(t, s));
              t.skip(16);
              let l = U(t);
              let u = B(t, l);
              this.metadataTags.images ??= [];
              this.metadataTags.images.push({
                data: u,
                mimeType: o,
                kind: r === 3 ? `coverFront` : r === 4 ? `coverBack` : `unknown`,
                description: c
              });
              break;
            }
          default:
            {
              break;
            }
        }
        e += i;
        if (a) {
          this.lastLoadedPos = e;
          break;
        }
      }
      if (!this.audioInfo) {
        throw Error(`Missing STREAMINFO metadata block! Corrupted FLAC file.`);
      }
    })();
  }
  async readNextFlacFrame({
    startPos: e,
    isFirstPacket: t
  }) {
    n(this.audioInfo);
    let r = this.audioInfo.maximumBlockSize * this.audioInfo.numberOfChannels * 4 + 16 + 2;
    let i = this.audioInfo.minimumFrameSize || 10;
    let a = (this.audioInfo.maximumFrameSize || r) + 16;
    let o = await this.reader.requestSliceRange(e, 16, a);
    if (!o) {
      return null;
    }
    let s = this.readFlacFrameHeader({
      slice: o,
      isFirstPacket: t
    });
    if (!s) {
      return null;
    }
    for (o.filePos = e + i;;) {
      if (o.filePos > o.end - 6) {
        return {
          num: s.num,
          blockSize: s.blockSize,
          sampleRate: s.sampleRate,
          size: o.end - e,
          isLastFrame: true
        };
      }
      if (V(o) === 255) {
        let t = o.filePos;
        if (V(o) !== (this.blockingBit === 1 ? 249 : 248)) {
          o.filePos = t;
          continue;
        }
        o.skip(-2);
        let n = o.filePos - e;
        let r = this.readFlacFrameHeader({
          slice: o,
          isFirstPacket: false
        });
        if (!r) {
          o.filePos = t;
          continue;
        }
        if (this.blockingBit === 0) {
          if (r.num - s.num !== 1) {
            o.filePos = t;
            continue;
          }
        } else if (r.num - s.num !== s.blockSize) {
          o.filePos = t;
          continue;
        }
        return {
          num: s.num,
          blockSize: s.blockSize,
          sampleRate: s.sampleRate,
          size: n,
          isLastFrame: false
        };
      }
    }
  }
  readFlacFrameHeader({
    slice: e,
    isFirstPacket: t
  }) {
    let r = e.filePos;
    let i = new A(B(e, 4));
    if (i.readBits(15) !== 32764) {
      return null;
    }
    if (this.blockingBit === null) {
      n(t);
      let e = i.readBits(1);
      this.blockingBit = e;
    } else if (this.blockingBit === 1) {
      n(!t);
      if (i.readBits(1) !== 1) {
        return null;
      }
    } else if (this.blockingBit === 0) {
      n(!t);
      if (i.readBits(1) !== 0) {
        return null;
      }
    } else {
      throw Error(`Invalid blocking bit`);
    }
    let a = ca(i.readBits(4));
    if (!a) {
      return null;
    }
    n(this.audioInfo);
    let o = la(i.readBits(4), this.audioInfo.sampleRate);
    i.readBits(4);
    i.readBits(3);
    if (!o || i.readBits(1) !== 0) {
      return null;
    }
    let s = ua(e);
    let c = da(e, a);
    let l = fa(e, o);
    if (l === null || l !== this.audioInfo.sampleRate) {
      return null;
    }
    let u = e.filePos - r;
    let d = V(e);
    e.skip(-u);
    e.skip(-1);
    if (d === pa(B(e, u))) {
      return {
        num: s,
        blockSize: c,
        sampleRate: l
      };
    } else {
      return null;
    }
  }
  async advanceReader() {
    await this.readMetadata();
    n(this.lastLoadedPos !== null);
    n(this.audioInfo);
    let e = this.lastLoadedPos;
    let t = await this.readNextFlacFrame({
      startPos: e,
      isFirstPacket: this.loadedSamples.length === 0
    });
    if (!t) {
      this.lastSampleLoaded = true;
      return;
    }
    let r = this.loadedSamples[this.loadedSamples.length - 1];
    let i = {
      blockOffset: r ? r.blockOffset + r.blockSize : 0,
      blockSize: t.blockSize,
      byteOffset: e,
      byteSize: t.size
    };
    this.lastLoadedPos += t.size;
    this.loadedSamples.push(i);
    if (t.isLastFrame) {
      this.lastSampleLoaded = true;
      return;
    }
  }
};
var ha = class {
  constructor(e) {
    this.demuxer = e;
  }
  getType() {
    return `audio`;
  }
  getId() {
    return 1;
  }
  getNumber() {
    return 1;
  }
  getCodec() {
    return `flac`;
  }
  getInternalCodecId() {
    return null;
  }
  getNumberOfChannels() {
    n(this.demuxer.audioInfo);
    return this.demuxer.audioInfo.numberOfChannels;
  }
  getSampleRate() {
    n(this.demuxer.audioInfo);
    return this.demuxer.audioInfo.sampleRate;
  }
  getName() {
    return null;
  }
  getLanguageCode() {
    return `und`;
  }
  getTimeResolution() {
    n(this.demuxer.audioInfo);
    return this.demuxer.audioInfo.sampleRate;
  }
  isRelativeToUnixEpoch() {
    return false;
  }
  getUnixTimeForTimestamp() {
    return null;
  }
  getPairingMask() {
    return 1n;
  }
  getBitrate() {
    return null;
  }
  getAverageBitrate() {
    return null;
  }
  async getDurationFromMetadata() {
    n(this.demuxer.audioInfo);
    if (this.demuxer.audioInfo.totalSamples === 0) {
      return null;
    } else {
      return this.demuxer.audioInfo.totalSamples / this.demuxer.audioInfo.sampleRate;
    }
  }
  async getLiveRefreshInterval() {
    return null;
  }
  getDisposition() {
    return {
      ...yt
    };
  }
  async getDecoderConfig() {
    n(this.demuxer.audioInfo);
    return {
      codec: `flac`,
      numberOfChannels: this.demuxer.audioInfo.numberOfChannels,
      sampleRate: this.demuxer.audioInfo.sampleRate,
      description: this.demuxer.audioInfo.description
    };
  }
  async getPacket(e, t) {
    n(this.demuxer.audioInfo);
    if (e < 0) {
      return null;
    }
    let r = await this.demuxer.readingMutex.acquire();
    try {
      while (true) {
        let n = T(this.demuxer.loadedSamples, e, e => {
          return e.blockOffset / this.demuxer.audioInfo.sampleRate;
        });
        if (n === -1) {
          await this.demuxer.advanceReader();
          continue;
        }
        let r = this.demuxer.loadedSamples[n];
        if (r.blockOffset / this.demuxer.audioInfo.sampleRate + r.blockSize / this.demuxer.audioInfo.sampleRate <= e) {
          if (this.demuxer.lastSampleLoaded) {
            return this.getPacketAtIndex(this.demuxer.loadedSamples.length - 1, t);
          }
          await this.demuxer.advanceReader();
          continue;
        }
        return this.getPacketAtIndex(n, t);
      }
    } finally {
      r();
    }
  }
  async getNextPacket(e, t) {
    let n = await this.demuxer.readingMutex.acquire();
    try {
      let n = e.sequenceNumber + 1;
      if (this.demuxer.lastSampleLoaded && n >= this.demuxer.loadedSamples.length) {
        return null;
      }
      while (n >= this.demuxer.loadedSamples.length && !this.demuxer.lastSampleLoaded) {
        await this.demuxer.advanceReader();
      }
      return this.getPacketAtIndex(n, t);
    } finally {
      n();
    }
  }
  getKeyPacket(e, t) {
    return this.getPacket(e, t);
  }
  getNextKeyPacket(e, t) {
    return this.getNextPacket(e, t);
  }
  async getPacketAtIndex(e, t) {
    let r = this.demuxer.loadedSamples[e];
    if (!r) {
      return null;
    }
    let i;
    if (t.metadataOnly) {
      i = yr;
    } else {
      let e = this.demuxer.reader.requestSlice(r.byteOffset, r.byteSize);
      if (e instanceof Promise) {
        e = await e;
      }
      if (!e) {
        return null;
      }
      i = B(e, r.byteSize);
    }
    n(this.demuxer.audioInfo);
    let a = r.blockOffset / this.demuxer.audioInfo.sampleRate;
    let o = r.blockSize / this.demuxer.audioInfo.sampleRate;
    return new I(i, `key`, a, o, e, r.byteSize);
  }
  async getFirstPacket(e) {
    while (this.demuxer.loadedSamples.length === 0 && !this.demuxer.lastSampleLoaded) {
      await this.demuxer.advanceReader();
    }
    return this.getPacketAtIndex(0, e);
  }
};
var ga = 90000;
var _a = e => {
  let t = `video/MP2T`;
  let n = [...new Set(e.filter(Boolean))];
  if (n.length > 0) {
    t += `; codecs="${n.join(`, `)}"`;
  }
  return t;
};
var va = `PES packet is missing PTS where it was expected. PES packets without PTS are not currently supported. If you think this file should be supported, please report it.`;
var ya = new Set();
var ba = class extends vr {
  constructor(e) {
    super(e);
    this.metadataPromise = null;
    this.elementaryStreams = [];
    this.trackBackingEntries = [];
    this.packetOffset = 0;
    this.packetStride = -1;
    this.sectionEndPositions = [];
    this.seekChunkSize = 5242880;
    this.minReferencePointByteDistance = -1;
    this.reader = e._reader;
  }
  async readMetadata() {
    return this.metadataPromise ??= (async () => {
      let e = this.reader.requestSlice(0, 205);
      if (e instanceof Promise) {
        e = await e;
      }
      n(e);
      let t = B(e, 205);
      if (t[0] === 71 && t[188] === 71) {
        this.packetOffset = 0;
        this.packetStride = 188;
      } else if (t[0] === 71 && t[204] === 71) {
        this.packetOffset = 0;
        this.packetStride = 204;
      } else if (t[4] === 71 && t[196] === 71) {
        this.packetOffset = 4;
        this.packetStride = 192;
      } else {
        throw Error(`Unreachable.`);
      }
      this.minReferencePointByteDistance = this.packetStride * 256;
      let r = this.packetOffset;
      let i = null;
      let a = false;
      let o = false;
      while (true) {
        let e = await this.readPacketHeader(r);
        if (!e) {
          break;
        }
        if (e.payloadUnitStartIndicator === 0) {
          r += this.packetStride;
          continue;
        }
        if (o && !this.elementaryStreams.some(t => {
          return t.pid === e.pid;
        })) {
          r += this.packetStride;
          continue;
        }
        let t = await this.readSection(r, true, !o);
        if (!t) {
          break;
        }
        let s = false;
        if (!o && t.pid !== 0 && (t.payload[0] !== 0 || t.payload[1] !== 0 || t.payload[2] !== 1)) {
          let e = new A(t.payload);
          let n = e.readAlignedByte();
          e.skipBits(n * 8);
          s = e.readBits(8) === 2;
        }
        if (t.pid === 0 && !a) {
          let e = new A(t.payload);
          let n = e.readAlignedByte();
          e.skipBits(n * 8);
          e.skipBits(14);
          let r = e.readBits(10);
          for (e.skipBits(40); (r + 3) * 8 - e.pos > 32;) {
            let t = e.readBits(16);
            e.skipBits(3);
            let n = e.readBits(13);
            if (t !== 0) {
              if (i !== null) {
                throw Error(`Only files with a single program are supported.`);
              }
              i = n;
            }
          }
          if (i === null) {
            throw Error(`Program Association Table must link to a Program Map Table.`);
          }
          a = true;
        } else if ((t.pid === i || s) && !o) {
          let e = new A(t.payload);
          let n = e.readAlignedByte();
          e.skipBits(n * 8);
          e.skipBits(12);
          let r = e.readBits(12);
          e.skipBits(43);
          e.readBits(13);
          e.skipBits(6);
          let i = e.readBits(10);
          for (e.skipBits(i * 8); (r + 3) * 8 - e.pos > 32;) {
            let t = e.readBits(8);
            e.skipBits(3);
            let n = e.readBits(13);
            e.skipBits(6);
            let r = e.readBits(10);
            let i = e.pos + r * 8;
            let a = false;
            let o = false;
            while (e.pos < i) {
              let t = e.readBits(8);
              let n = e.readBits(8);
              if (t === 106) {
                a = true;
              } else if (t === 122 || t === 204) {
                o = true;
              }
              e.skipBits(n * 8);
            }
            let s = null;
            switch (t) {
              case 27:
              case 36:
                {
                  s = {
                    type: `video`,
                    codec: t === 27 ? `avc` : `hevc`,
                    decoderConfig: null,
                    avcCodecInfo: null,
                    hevcCodecInfo: null,
                    colorSpace: {
                      primaries: null,
                      transfer: null,
                      matrix: null,
                      fullRange: null
                    },
                    width: -1,
                    height: -1,
                    squarePixelWidth: -1,
                    squarePixelHeight: -1,
                    reorderSize: -1
                  };
                  break;
                }
              case 3:
              case 4:
              case 15:
              case 129:
              case 135:
                {
                  let e;
                  if (t === 3 || t === 4) {
                    e = `mp3`;
                  } else if (t === 15) {
                    e = `aac`;
                  } else if (t === 129) {
                    e = `ac3`;
                  } else if (t === 135) {
                    e = `eac3`;
                  } else {
                    throw Error(`Unreachable.`);
                  }
                  s = {
                    type: `audio`,
                    codec: e,
                    decoderConfig: null,
                    aacCodecInfo: null,
                    numberOfChannels: -1,
                    sampleRate: -1
                  };
                }
                break;
              case 6:
                {
                  if (o) {
                    s = {
                      type: `audio`,
                      codec: `eac3`,
                      decoderConfig: null,
                      aacCodecInfo: null,
                      numberOfChannels: -1,
                      sampleRate: -1
                    };
                  } else if (a) {
                    s = {
                      type: `audio`,
                      codec: `ac3`,
                      decoderConfig: null,
                      aacCodecInfo: null,
                      numberOfChannels: -1,
                      sampleRate: -1
                    };
                  }
                  break;
                }
              default:
                {
                  if (!ya.has(t)) {
                    k._warn(`Note: MPEG-TS streams with stream_type 0x${t.toString(16)} are not currently supported.`);
                    ya.add(t);
                  }
                }
            }
            if (s) {
              this.elementaryStreams.push({
                demuxer: this,
                pid: n,
                streamType: t,
                initialized: false,
                firstSection: null,
                canBeTrustedWithKeyPackets: false,
                info: s,
                referencePesPackets: []
              });
            }
          }
          o = true;
        } else {
          let e = this.elementaryStreams.find(e => {
            return e.pid === t.pid;
          });
          outer: if (e && !e.initialized) {
            let r = Sa(t, true);
            if (!r) {
              throw Error(`Couldn't read first PES packet for Elementary Stream with PID ${e.pid}`);
            }
            e.firstSection = t;
            e.canBeTrustedWithKeyPackets = t.randomAccessIndicator === 1;
            if (this.input._initInput) {
              let n = (await this.input._initInput._getDemuxer()).elementaryStreams.find(n => {
                return n.pid === t.pid && n.info.codec === e.info.codec;
              });
              if (n) {
                e.info = n.info;
                e.initialized = true;
                break outer;
              }
            }
            let i = new Da(e, r);
            if (e.info.type === `video`) {
              while (true) {
                let t = i;
                t.suppliedPacket = null;
                await i.markNextPacket();
                if (e.info.codec === `avc`) {
                  if (!i.suppliedPacket) {
                    throw Error(`Invalid AVC video stream; could not extract AVCDecoderConfigurationRecord from any packet.`);
                  }
                  e.info.avcCodecInfo = On(i.suppliedPacket.data);
                  if (!e.info.avcCodecInfo) {
                    continue;
                  }
                  let t = e.info.avcCodecInfo.sequenceParameterSets[0];
                  n(t);
                  let r = Mn(t);
                  e.info.width = r.displayWidth;
                  e.info.height = r.displayHeight;
                  let a = r.pixelAspectRatio.num;
                  let o = r.pixelAspectRatio.den;
                  if (a > 0 && o > 0) {
                    if (a > o) {
                      e.info.squarePixelWidth = Math.round(e.info.width * a / o);
                      e.info.squarePixelHeight = e.info.height;
                    } else {
                      e.info.squarePixelWidth = e.info.width;
                      e.info.squarePixelHeight = Math.round(e.info.height * o / a);
                    }
                  }
                  e.info.colorSpace = {
                    primaries: g[r.colourPrimaries],
                    transfer: v[r.transferCharacteristics],
                    matrix: b[r.matrixCoefficients],
                    fullRange: !!r.fullRangeFlag
                  };
                  e.info.reorderSize = r.maxDecFrameBuffering;
                  break;
                } else if (e.info.codec === `hevc`) {
                  if (!i.suppliedPacket) {
                    throw Error(`Invalid HEVC video stream; could not extract HVCDecoderConfigurationRecord from first packet.`);
                  }
                  e.info.hevcCodecInfo = Rn(i.suppliedPacket.data);
                  if (!e.info.hevcCodecInfo) {
                    continue;
                  }
                  let t = e.info.hevcCodecInfo.arrays.find(e => {
                    return e.nalUnitType === F.SPS_NUT;
                  }).nalUnits[0];
                  n(t);
                  let r = Ln(t);
                  e.info.width = r.displayWidth;
                  e.info.height = r.displayHeight;
                  if (r.pixelAspectRatio.num > r.pixelAspectRatio.den) {
                    e.info.squarePixelWidth = Math.round(e.info.width * r.pixelAspectRatio.num / r.pixelAspectRatio.den);
                    e.info.squarePixelHeight = e.info.height;
                  } else {
                    e.info.squarePixelWidth = e.info.width;
                    e.info.squarePixelHeight = Math.round(e.info.height * r.pixelAspectRatio.den / r.pixelAspectRatio.num);
                  }
                  e.info.colorSpace = {
                    primaries: g[r.colourPrimaries],
                    transfer: v[r.transferCharacteristics],
                    matrix: b[r.matrixCoefficients],
                    fullRange: !!r.fullRangeFlag
                  };
                  e.info.reorderSize = r.maxDecFrameBuffering;
                  break;
                } else {
                  throw Error(`Unhandled.`);
                }
              }
              e.info.decoderConfig = {
                codec: Bt({
                  width: e.info.width,
                  height: e.info.height,
                  codec: e.info.codec,
                  codecDescription: null,
                  colorSpace: e.info.colorSpace,
                  avcType: 1,
                  avcCodecInfo: e.info.avcCodecInfo,
                  hevcCodecInfo: e.info.hevcCodecInfo,
                  vp9CodecInfo: null,
                  av1CodecInfo: null,
                  proresFormat: null
                }),
                codedWidth: e.info.width,
                codedHeight: e.info.height,
                colorSpace: e.info.colorSpace
              };
              if (e.info.width !== e.info.squarePixelWidth || e.info.height !== e.info.squarePixelHeight) {
                e.info.decoderConfig.displayAspectWidth = e.info.squarePixelWidth;
                e.info.decoderConfig.displayAspectHeight = e.info.squarePixelHeight;
              }
              e.initialized = true;
            } else {
              await i.markNextPacket();
              if (!i.suppliedPacket) {
                throw Error(`Couldn't parse first media packet for Elementary Stream with PID ${e.pid}`);
              }
              if (e.info.codec === `aac`) {
                let t = ia(fl.tempFromBytes(i.suppliedPacket.data));
                if (!t) {
                  throw Error(`Invalid AAC audio stream; could not read ADTS frame header from first packet.`);
                }
                e.info.aacCodecInfo = {
                  isMpeg2: false,
                  objectType: t.objectType
                };
                e.info.numberOfChannels = St[t.channelConfiguration];
                e.info.sampleRate = xt[t.samplingFrequencyIndex];
              } else if (e.info.codec === `mp3`) {
                let t = fn(U(fl.tempFromBytes(i.suppliedPacket.data)), i.suppliedPacket.data.byteLength);
                if (!t.header) {
                  throw Error(`Invalid MP3 audio stream; could not read frame header from first packet.`);
                }
                e.info.numberOfChannels = gn(t.header.channel);
                e.info.sampleRate = t.header.sampleRate;
              } else if (e.info.codec === `ac3`) {
                let t = cr(i.suppliedPacket.data);
                if (!t) {
                  throw Error(`Invalid AC-3 audio stream; could not read sync frame from first packet.`);
                }
                if (t.fscod === 3) {
                  throw Error(`Invalid AC-3 audio stream; reserved sample rate code found in first packet.`);
                }
                e.info.numberOfChannels = sr[t.acmod] + t.lfeon;
                e.info.sampleRate = _n[t.fscod];
              } else if (e.info.codec === `eac3`) {
                let t = mr(i.suppliedPacket.data);
                if (!t) {
                  throw Error(`Invalid E-AC-3 audio stream; could not read sync frame from first packet.`);
                }
                let n = gr(t);
                if (n === null) {
                  throw Error(`Invalid E-AC-3 audio stream; reserved sample rate code found in first packet.`);
                }
                e.info.numberOfChannels = _r(t);
                e.info.sampleRate = n;
              } else {
                throw Error(`Unhandled.`);
              }
              e.info.decoderConfig = {
                codec: Ht({
                  codec: e.info.codec,
                  codecDescription: null,
                  aacCodecInfo: e.info.aacCodecInfo
                }),
                numberOfChannels: e.info.numberOfChannels,
                sampleRate: e.info.sampleRate
              };
              e.initialized = true;
            }
          }
        }
        if (o && this.elementaryStreams.every(e => {
          return e.initialized;
        })) {
          break;
        }
        r += this.packetStride;
      }
      if (!o) {
        throw Error(a ? `No Program Map Table found in the file.` : `No Program Association Table found in the file.`);
      }
      for (let e of this.elementaryStreams) {
        if (e.info.type === `video`) {
          this.trackBackingEntries.push(new wa(e));
        } else {
          this.trackBackingEntries.push(new Ta(e));
        }
      }
    })();
  }
  async getTrackBackings() {
    await this.readMetadata();
    return this.trackBackingEntries;
  }
  async getMetadataTags() {
    return {};
  }
  async getMimeType() {
    await this.readMetadata();
    return _a(await Promise.all(this.trackBackingEntries.map(e => {
      return e.getDecoderConfig().then(e => {
        return e?.codec ?? null;
      });
    })));
  }
  async readSection(e, t, n = false) {
    let r = e;
    let i = e;
    let a = [];
    let o = 0;
    let s = null;
    let c = true;
    let l = 0;
    while (true) {
      let e = await this.readPacket(i);
      i += this.packetStride;
      if (!e) {
        break;
      }
      if (s) {
        if (e.pid !== s.pid) {
          if (n) {
            break;
          }
          continue;
        }
        if (e.payloadUnitStartIndicator === 1) {
          break;
        }
      } else {
        if (e.payloadUnitStartIndicator === 0) {
          break;
        }
        s = e;
      }
      let u = !!(e.adaptationFieldControl & 2);
      let d = !!(e.adaptationFieldControl & 1);
      let f = 0;
      if (u) {
        f = 1 + e.body[0];
        if (e === s && f > 1) {
          l = e.body[1] >> 6 & 1;
        }
      }
      if (d) {
        if (f === 0) {
          a.push(e.body);
          o += e.body.byteLength;
        } else {
          a.push(e.body.subarray(f));
          o += e.body.byteLength - f;
        }
      }
      r = i;
      if (!t && o >= 64) {
        c = false;
        break;
      }
      if (re(this.sectionEndPositions, r, e => {
        return e;
      }) !== -1) {
        c = false;
        break;
      }
    }
    if (c) {
      let e = T(this.sectionEndPositions, r, e => {
        return e;
      });
      this.sectionEndPositions.splice(e + 1, 0, r);
    }
    if (!s) {
      return null;
    }
    let u;
    if (a.length === 1) {
      u = a[0];
    } else {
      let e = a.reduce((e, t) => {
        return e + t.length;
      }, 0);
      u = new Uint8Array(e);
      let t = 0;
      for (let e of a) {
        u.set(e, t);
        t += e.length;
      }
    }
    return {
      startPos: e,
      endPos: t ? r : null,
      pid: s.pid,
      payload: u,
      randomAccessIndicator: l
    };
  }
  async readPacketHeader(e) {
    let t = this.reader.requestSlice(e, 4);
    if (t instanceof Promise) {
      t = await t;
    }
    if (!t) {
      return null;
    }
    if (V(t) !== 71) {
      throw Error(`Invalid TS packet sync byte. Likely an internal bug, please report this file.`);
    }
    let n = H(t);
    n >> 15;
    let r = n >> 14 & 1;
    n >> 13 & 1;
    let i = n & 8191;
    let a = V(t);
    a >> 6;
    let o = a >> 4 & 3;
    a & 15;
    return {
      payloadUnitStartIndicator: r,
      pid: i,
      adaptationFieldControl: o
    };
  }
  async readPacket(e) {
    let t = this.reader.requestSlice(e, 188);
    if (t instanceof Promise) {
      t = await t;
    }
    if (!t) {
      return null;
    }
    let n = B(t, 188);
    if (n[0] !== 71) {
      throw Error(`Invalid TS packet sync byte. Likely an internal bug, please report this file.`);
    }
    let r = (n[1] << 8) + n[2];
    r >> 15;
    let i = r >> 14 & 1;
    r >> 13 & 1;
    let a = r & 8191;
    let o = n[3];
    o >> 6;
    let s = o >> 4 & 3;
    o & 15;
    return {
      payloadUnitStartIndicator: i,
      pid: a,
      adaptationFieldControl: s,
      body: n.subarray(4)
    };
  }
};
var xa = (e, t) => {
  if (e.payload.byteLength < 3) {
    return null;
  }
  let n = new A(e.payload);
  if (n.readBits(24) !== 1) {
    return null;
  }
  let r = n.readBits(8);
  n.skipBits(16);
  if (r === 188 || r === 190 || r === 191 || r === 240 || r === 241 || r === 255 || r === 242 || r === 248) {
    return null;
  }
  n.skipBits(8);
  let i = n.readBits(2);
  n.skipBits(14);
  let a = null;
  if (i === 2 || i === 3) {
    a = 0;
    n.skipBits(4);
    a += n.readBits(3) * 1073741824;
    n.skipBits(1);
    a += n.readBits(15) * 32768;
    n.skipBits(1);
    a += n.readBits(15);
  } else if (t) {
    throw Error(va);
  }
  return {
    sectionStartPos: e.startPos,
    sectionEndPos: e.endPos,
    pts: a,
    randomAccessIndicator: e.randomAccessIndicator
  };
};
var Sa = (e, t) => {
  n(e.endPos !== null);
  let r = xa(e, t);
  if (!r) {
    return null;
  }
  let i = new A(e.payload);
  i.skipBits(32);
  let a = i.readBits(16);
  i.skipBits(16);
  let o = i.readBits(8);
  let s = i.pos + o * 8;
  i.pos = s;
  let c = s / 8;
  n(Number.isInteger(c));
  let l = e.payload.subarray(c, a > 0 ? 6 + a : e.payload.byteLength);
  return {
    ...r,
    data: l
  };
};
var Ca = class e {
  constructor(e) {
    this.elementaryStream = e;
    this.packetBuffers = new WeakMap();
    this.packetSectionStarts = new WeakMap();
  }
  getId() {
    return this.elementaryStream.pid;
  }
  getNumber() {
    let t = this.elementaryStream.demuxer;
    let r = this.elementaryStream.info.type;
    let i = 0;
    for (let a of t.trackBackingEntries) {
      if (a.getType() === r) {
        i++;
      }
      n(a instanceof e);
      if (a.elementaryStream === this.elementaryStream) {
        break;
      }
    }
    return i;
  }
  getCodec() {
    throw Error(`Not implemented on base class.`);
  }
  getInternalCodecId() {
    return this.elementaryStream.streamType;
  }
  getName() {
    return null;
  }
  getLanguageCode() {
    return `und`;
  }
  getDisposition() {
    return {
      ...yt,
      primary: false
    };
  }
  getTimeResolution() {
    return ga;
  }
  isRelativeToUnixEpoch() {
    return false;
  }
  getUnixTimeForTimestamp() {
    return null;
  }
  getPairingMask() {
    return 1n;
  }
  getBitrate() {
    return null;
  }
  getAverageBitrate() {
    return null;
  }
  async getDurationFromMetadata() {
    return null;
  }
  async getLiveRefreshInterval() {
    return null;
  }
  createEncodedPacket(e, t, n) {
    let r;
    if (this.allPacketsAreKeyPackets() || e.randomAccessIndicator === 1) {
      r = `key`;
    } else {
      r = `delta`;
    }
    return new I(n.metadataOnly ? yr : e.data, r, e.pts / ga, Math.max(t / ga, 0), e.sequenceNumber, e.data.byteLength);
  }
  async getFirstPacket(e) {
    let t = this.elementaryStream.firstSection;
    n(t);
    let r = Sa(t, true);
    n(r);
    let i = new Da(this.elementaryStream, r);
    let a = new Oa(this, i);
    let o = await a.readNext();
    if (!o) {
      return null;
    }
    let s = this.createEncodedPacket(o.packet, o.duration, e);
    this.packetBuffers.set(s, a);
    this.packetSectionStarts.set(s, o.packet.sectionStartPos);
    return s;
  }
  async getNextPacket(e, t) {
    let r = this.packetBuffers.get(e);
    if (r) {
      let n = await r.readNext();
      if (!n) {
        return null;
      }
      this.packetBuffers.delete(e);
      let i = this.createEncodedPacket(n.packet, n.duration, t);
      this.packetBuffers.set(i, r);
      this.packetSectionStarts.set(i, n.packet.sectionStartPos);
      return i;
    }
    let i = this.packetSectionStarts.get(e);
    if (i === undefined) {
      throw Error(`Packet was not created from this track.`);
    }
    let a = await this.elementaryStream.demuxer.readSection(i, true);
    n(a);
    let o = Sa(a, true);
    n(o);
    let s = new Da(this.elementaryStream, o);
    r = new Oa(this, s);
    let c = e.sequenceNumber;
    while (true) {
      let e = await r.readNext();
      if (!e) {
        return null;
      }
      if (e.packet.sequenceNumber > c) {
        let n = this.createEncodedPacket(e.packet, e.duration, t);
        this.packetBuffers.set(n, r);
        this.packetSectionStarts.set(n, e.packet.sectionStartPos);
        return n;
      }
    }
  }
  async getNextKeyPacket(e, t) {
    let n = e;
    while (true) {
      n = await this.getNextPacket(n, t);
      if (!n) {
        return null;
      }
      if (n.type === `key`) {
        return n;
      }
    }
  }
  getPacket(e, t) {
    return this.doPacketLookup(e, false, t);
  }
  getKeyPacket(e, t) {
    return this.doPacketLookup(e, true, t);
  }
  async doPacketLookup(e, t, r) {
    let a = ge(e * ga);
    let o = this.elementaryStream.demuxer;
    let {
      reader: s,
      seekChunkSize: c
    } = o;
    let l = this.elementaryStream.pid;
    let u = async (e, t, n) => {
      let r = e;
      while (r < t) {
        let e = await o.readPacketHeader(r);
        if (!e) {
          return null;
        }
        if (e.pid === l && e.payloadUnitStartIndicator === 1) {
          let e = await o.readSection(r, n);
          if (!e) {
            return null;
          }
          let t = xa(e, false);
          if (t && t.pts !== null) {
            return {
              pesPacketHeader: t,
              section: e
            };
          }
        }
        r += o.packetStride;
      }
      return null;
    };
    let d = this.elementaryStream.firstSection;
    n(d);
    let f = xa(d, true);
    n(f);
    if (a < f.pts) {
      return null;
    }
    let p;
    let m = this.elementaryStream.referencePesPackets;
    let h = T(m, a, e => {
      return e.pts;
    });
    let g = h === -1 ? null : m[h];
    if (g && a - g.pts < 45000) {
      p = g.sectionStartPos;
    } else {
      let e = 0;
      if (s.fileSize !== null) {
        let t = Math.ceil(s.fileSize / c);
        if (t > 1) {
          let n = 0;
          let r = t - 1;
          for (e = n; n <= r;) {
            let t = Math.floor((n + r) / 2);
            let i = ye(t * c, o.packetStride) + f.sectionStartPos;
            let s = await u(i, i + c, false);
            if (!s) {
              r = t - 1;
              continue;
            }
            if (s.pesPacketHeader.pts <= a) {
              e = t;
              n = t + 1;
            } else {
              r = t - 1;
            }
          }
        }
      }
      p = ye(e * c, o.packetStride) + f.sectionStartPos;
    }
    let _ = (await u(p, s.fileSize ?? Infinity, false))?.pesPacketHeader ?? null;
    _ ||= f;
    let v = this.getReorderSize();
    let y = async (e, t) => {
      let s = await o.readSection(e, true);
      n(s);
      let c = Sa(s, true);
      n(c);
      let l = new Da(this.elementaryStream, c);
      let u = new Oa(this, l);
      while (!((i(u.presentationOrderPackets)?.pts ?? -Infinity) >= a) && !!(await u.readNextPacket())) {}
      let d = se(u.presentationOrderPackets, t);
      if (d === -1) {
        return null;
      }
      let f = u.presentationOrderPackets[d];
      let p = d === 0 ? 0 : f.pts - u.presentationOrderPackets[d - 1].pts;
      while (u.decodeOrderPackets[0] !== f) {
        u.decodeOrderPackets.shift();
      }
      u.lastDuration = p;
      let m = await u.readNext();
      n(m);
      let h = this.createEncodedPacket(m.packet, m.duration, r);
      this.packetBuffers.set(h, u);
      this.packetSectionStarts.set(h, m.packet.sectionStartPos);
      return h;
    };
    if (!t || this.allPacketsAreKeyPackets()) {
      outer: while (true) {
        let e = _.sectionStartPos + o.packetStride;
        while (true) {
          let t = await o.readPacketHeader(e);
          if (!t) {
            break outer;
          }
          if (t.pid === l && t.payloadUnitStartIndicator === 1) {
            let t = await o.readSection(e, false);
            if (t) {
              let e = xa(t, false);
              if (e && e.pts !== null) {
                if (e.pts > a) {
                  break outer;
                }
                _ = e;
                Ea(this.elementaryStream, _);
                break;
              }
            }
          }
          e += o.packetStride;
        }
      }
      outer: for (let e = 0; e < v + 1; e++) {
        let e = _.sectionStartPos - o.packetStride;
        while (e >= o.packetOffset) {
          let t = await o.readPacketHeader(e);
          if (!t) {
            break outer;
          }
          if (t.pid === l && t.payloadUnitStartIndicator === 1) {
            let t = await o.readSection(e, false);
            if (t) {
              let e = xa(t, false);
              if (e && e.pts !== null) {
                _ = e;
                break;
              }
            }
          }
          e -= o.packetStride;
        }
      }
      return y(_.sectionStartPos, e => {
        return e.pts <= a;
      });
    } else {
      let e = p;
      let t = null;
      let r = !this.elementaryStream.canBeTrustedWithKeyPackets;
      while (true) {
        let i = null;
        let p = e <= f.sectionStartPos;
        let m;
        let h = null;
        if (p) {
          m = f;
          h = d;
        } else {
          let t = await u(e, s.fileSize ?? Infinity, r);
          m = t?.pesPacketHeader ?? null;
          h = t?.section ?? null;
        }
        let g = false;
        let _ = 0;
        outer: while (m && (t === null || !(m.sectionStartPos >= t))) {
          if (m.pts <= a) {
            let e;
            if (this.elementaryStream.canBeTrustedWithKeyPackets) {
              e = m.randomAccessIndicator === 1;
            } else {
              n(h);
              let t = Sa(h, true);
              n(t);
              let r = new Da(this.elementaryStream, t);
              await r.markNextPacket();
              e = r.suppliedPacket?.randomAccessIndicator === 1;
            }
            if (e) {
              i = m;
            }
          }
          if (m.pts > a) {
            g = true;
          }
          _++;
          if (g && _ > v) {
            break;
          }
          let e = m.sectionStartPos + o.packetStride;
          while (true) {
            let t = await o.readPacketHeader(e);
            if (!t) {
              break outer;
            }
            if (t.pid === l && t.payloadUnitStartIndicator === 1) {
              let t = await o.readSection(e, r);
              if (t) {
                let e = xa(t, false);
                if (e && e.pts !== null) {
                  m = e;
                  h = t;
                  Ea(this.elementaryStream, m);
                  break;
                }
              }
            }
            e += o.packetStride;
          }
        }
        if (i) {
          let e = i;
          if (_ === 0) {
            outer: for (let t = 0; t < v; t++) {
              let t = e.sectionStartPos - o.packetStride;
              while (t >= o.packetOffset) {
                let n = await o.readPacketHeader(t);
                if (!n) {
                  break outer;
                }
                if (n.pid === l && n.payloadUnitStartIndicator === 1) {
                  let n = await o.readSection(t, r);
                  if (n) {
                    let t = xa(n, false);
                    if (t && t.pts !== null) {
                      e = t;
                      break;
                    }
                  }
                }
                t -= o.packetStride;
              }
            }
          }
          let t = await y(e.sectionStartPos, e => {
            return e.pts <= a && e.randomAccessIndicator === 1;
          });
          n(t);
          return t;
        }
        if (p) {
          return null;
        }
        t = e;
        e = Math.max(ye(e - f.sectionStartPos - c, o.packetStride) + f.sectionStartPos, f.sectionStartPos);
      }
    }
  }
};
var wa = class extends Ca {
  getType() {
    return `video`;
  }
  getCodec() {
    return this.elementaryStream.info.codec;
  }
  getCodedWidth() {
    return this.elementaryStream.info.width;
  }
  getCodedHeight() {
    return this.elementaryStream.info.height;
  }
  getSquarePixelWidth() {
    return this.elementaryStream.info.squarePixelWidth;
  }
  getSquarePixelHeight() {
    return this.elementaryStream.info.squarePixelHeight;
  }
  getRotation() {
    return 0;
  }
  async getColorSpace() {
    return this.elementaryStream.info.colorSpace;
  }
  async canBeTransparent() {
    return false;
  }
  async getDecoderConfig() {
    n(this.elementaryStream.info.decoderConfig);
    return this.elementaryStream.info.decoderConfig;
  }
  allPacketsAreKeyPackets() {
    return false;
  }
  getReorderSize() {
    return this.elementaryStream.info.reorderSize;
  }
};
var Ta = class extends Ca {
  getType() {
    return `audio`;
  }
  getCodec() {
    return this.elementaryStream.info.codec;
  }
  getNumberOfChannels() {
    return this.elementaryStream.info.numberOfChannels;
  }
  getSampleRate() {
    return this.elementaryStream.info.sampleRate;
  }
  async getDecoderConfig() {
    n(this.elementaryStream.info.decoderConfig);
    return this.elementaryStream.info.decoderConfig;
  }
  allPacketsAreKeyPackets() {
    return true;
  }
  getReorderSize() {
    return 0;
  }
};
var Ea = (e, t) => {
  let n = e.referencePesPackets;
  let r = T(n, t.sectionStartPos, e => {
    return e.sectionStartPos;
  });
  if (r >= 0) {
    let i = n[r];
    if (t.pts <= i.pts) {
      return false;
    }
    let a = e.demuxer.minReferencePointByteDistance;
    if (t.sectionStartPos - i.sectionStartPos < a) {
      return false;
    }
    if (r < n.length - 1) {
      let e = n[r + 1];
      if (e.pts < t.pts || e.sectionStartPos - t.sectionStartPos < a) {
        return false;
      }
    }
  }
  n.splice(r + 1, 0, t);
  return true;
};
var Da = class {
  constructor(e, t) {
    this.currentPos = 0;
    this.pesPackets = [];
    this.currentPesPacketIndex = 0;
    this.currentPesPacketPos = 0;
    this.endPos = 0;
    this.lastSuppliedPesPacket = null;
    this.nextPts = null;
    this.suppliedPacket = null;
    this.elementaryStream = e;
    this.pid = e.pid;
    this.demuxer = e.demuxer;
    this.startingPesPacket = t;
  }
  ensureBuffered(e) {
    let t = this.endPos - this.currentPos;
    if (t >= e) {
      return e;
    } else {
      return this.bufferData(e - t).then(() => {
        return Math.min(this.endPos - this.currentPos, e);
      });
    }
  }
  getCurrentPesPacket() {
    let e = this.pesPackets[this.currentPesPacketIndex];
    n(e);
    return e;
  }
  async bufferData(e) {
    let t = this.endPos + e;
    while (this.endPos < t) {
      let e;
      if (this.pesPackets.length === 0) {
        e = this.startingPesPacket;
      } else {
        let t = i(this.pesPackets).sectionEndPos;
        for (n(t !== null);;) {
          let n = await this.demuxer.readPacketHeader(t);
          if (!n) {
            return;
          }
          if (n.pid === this.pid) {
            let n = await this.demuxer.readSection(t, true);
            if (!n) {
              return;
            }
            let r = Sa(n, false);
            if (r) {
              e = r;
              break;
            }
          }
          t += this.demuxer.packetStride;
        }
      }
      this.pesPackets.push(e);
      this.endPos += e.data.byteLength;
    }
  }
  readBytes(e) {
    let t = this.getCurrentPesPacket();
    let n = this.currentPos - this.currentPesPacketPos;
    let r = n + e;
    this.currentPos += e;
    if (r <= t.data.byteLength) {
      return t.data.subarray(n, r);
    }
    let i = new Uint8Array(e);
    i.set(t.data.subarray(n));
    let a = t.data.byteLength - n;
    while (true) {
      this.advanceCurrentPacket();
      let t = this.getCurrentPesPacket();
      let n = e - a;
      if (n <= t.data.byteLength) {
        i.set(t.data.subarray(0, n), a);
        break;
      }
      i.set(t.data, a);
      a += t.data.byteLength;
    }
    return i;
  }
  readU8() {
    let e = this.getCurrentPesPacket();
    let t = this.currentPos - this.currentPesPacketPos;
    this.currentPos++;
    if (t < e.data.byteLength) {
      return e.data[t];
    } else {
      this.advanceCurrentPacket();
      e = this.getCurrentPesPacket();
      return e.data[0];
    }
  }
  seekTo(e) {
    if (e !== this.currentPos) {
      if (e < this.currentPos) {
        while (e < this.currentPesPacketPos) {
          this.currentPesPacketIndex--;
          let e = this.getCurrentPesPacket();
          this.currentPesPacketPos -= e.data.byteLength;
        }
      } else {
        while (true) {
          let t = this.getCurrentPesPacket();
          if (e < this.currentPesPacketPos + t.data.byteLength) {
            break;
          }
          this.currentPesPacketPos += t.data.byteLength;
          this.currentPesPacketIndex++;
        }
      }
      this.currentPos = e;
    }
  }
  skip(e) {
    this.seekTo(this.currentPos + e);
  }
  advanceCurrentPacket() {
    this.currentPesPacketPos += this.getCurrentPesPacket().data.byteLength;
    this.currentPesPacketIndex++;
  }
  async markNextPacket() {
    n(!this.suppliedPacket);
    let e = this.elementaryStream;
    if (e.info.type === `video`) {
      let t = e.info.codec;
      let n = 1024;
      if (t !== `avc` && t !== `hevc`) {
        throw Error(`Unhandled.`);
      }
      let r = t === `avc` ? 1 : 2;
      let i = null;
      let a = false;
      let s = 0;
      while (true) {
        let e = this.ensureBuffered(n);
        if (e instanceof Promise) {
          e = await e;
        }
        if (e === 0) {
          break;
        }
        let c = this.currentPos;
        let l = this.readBytes(e);
        let u = l.byteLength;
        let d = 0;
        while (d < u) {
          let e = l.indexOf(0, d);
          if (e === -1 || e >= u) {
            break;
          }
          d = e;
          let n = c + d;
          if (d + 3 >= u) {
            this.seekTo(n);
            break;
          }
          let f = l[d + 1];
          let p = l[d + 2];
          let m = l[d + 3];
          let h = 0;
          if (f === 0 && p === 0 && m === 1) {
            h = 4;
          } else if (f === 0 && p === 1) {
            h = 3;
          }
          if (h === 0) {
            d++;
            continue;
          }
          let g = n;
          i ??= g;
          let _ = d + h;
          let v = _ + r;
          if (v + (t === `avc` ? 6 : 1) > u) {
            this.seekTo(n);
            break;
          }
          let y = l[_];
          let b;
          let x;
          let S;
          if (t === `avc`) {
            b = Sn(y);
            x = b === P.NON_IDR_SLICE || b === P.SLICE_DPA || b === P.IDR;
            S = b === P.SEI || b === P.SPS || b === P.PPS || b === P.AUD;
          } else {
            b = In(y);
            if (((y & 1) << 5 | l[_ + 1] >> 3) > 0) {
              d += h;
              continue;
            }
            x = b <= F.RASL_R || b >= F.BLA_W_LP && b <= 21;
            S = b >= F.VPS_NUT && b <= 37 || b === F.PREFIX_SEI_NUT || b >= 41 && b <= 44 || b >= 48 && b <= 55;
          }
          let C = false;
          if (x) {
            let e;
            if (t === `avc`) {
              let t = o(new A(l.subarray(v, v + 6)));
              e = !a || t <= s;
              s = t;
            } else {
              e = l[v] >> 7 == 1;
            }
            if (e) {
              if (a) {
                C = true;
              } else {
                a = true;
              }
            }
          } else if (S && a) {
            C = true;
          }
          if (C) {
            let e = g - i;
            this.seekTo(i);
            return this.supplyPacket(e, 0);
          }
          d += h;
        }
        if (e < n) {
          break;
        }
      }
      if (i !== null && this.endPos > i) {
        let e = this.endPos - i;
        this.seekTo(i);
        return this.supplyPacket(e, 0);
      }
    } else {
      let t = e.info.codec;
      while (true) {
        let r = this.ensureBuffered(128);
        if (r instanceof Promise) {
          r = await r;
        }
        let i = this.currentPos;
        while (this.currentPos - i < r) {
          let r = this.readU8();
          if (t === `aac`) {
            if (r !== 255) {
              continue;
            }
            this.skip(-1);
            let t = this.currentPos;
            let n = this.ensureBuffered(9);
            if (n instanceof Promise) {
              n = await n;
            }
            if (n < 9) {
              return;
            }
            let i = this.readBytes(9);
            let a = ia(fl.tempFromBytes(i));
            if (a) {
              this.seekTo(t);
              let n = this.ensureBuffered(a.frameLength);
              if (n instanceof Promise) {
                n = await n;
              }
              return this.supplyPacket(n, Math.round(aa * ga / e.info.sampleRate));
            } else {
              this.seekTo(t + 1);
            }
          } else if (t === `mp3`) {
            if (r !== 255) {
              continue;
            }
            this.skip(-1);
            let t = this.currentPos;
            let n = this.ensureBuffered(4);
            if (n instanceof Promise) {
              n = await n;
            }
            if (n < 4) {
              return;
            }
            let i = fn(u(this.readBytes(4)).getUint32(0), null);
            if (i.header) {
              this.seekTo(t);
              let n = this.ensureBuffered(i.header.totalSize);
              if (n instanceof Promise) {
                n = await n;
              }
              let r = i.header.audioSamplesInFrame * ga / e.info.sampleRate;
              return this.supplyPacket(n, Math.round(r));
            } else {
              this.seekTo(t + 1);
            }
          } else if (t === `ac3`) {
            if (r !== 11) {
              continue;
            }
            this.skip(-1);
            let t = this.currentPos;
            let i = this.ensureBuffered(5);
            if (i instanceof Promise) {
              i = await i;
            }
            if (i < 5) {
              return;
            }
            let a = this.readBytes(5);
            if (a[0] !== 11 || a[1] !== 119) {
              this.seekTo(t + 1);
              continue;
            }
            let o = a[4] >> 6;
            let s = a[4] & 63;
            if (o === 3 || s > 37) {
              this.seekTo(t + 1);
              continue;
            }
            let c = lr[s * 3 + o];
            n(c !== undefined);
            this.seekTo(t);
            i = this.ensureBuffered(c);
            if (i instanceof Promise) {
              i = await i;
            }
            let l = Math.round(ur * ga / e.info.sampleRate);
            return this.supplyPacket(i, l);
          } else if (t === `eac3`) {
            if (r !== 11) {
              continue;
            }
            this.skip(-1);
            let t = this.currentPos;
            let n = this.ensureBuffered(5);
            if (n instanceof Promise) {
              n = await n;
            }
            if (n < 5) {
              return;
            }
            let i = this.readBytes(5);
            if (i[0] !== 11 || i[1] !== 119) {
              this.seekTo(t + 1);
              continue;
            }
            let a = (((i[2] & 7) << 8 | i[3]) + 1) * 2;
            let o = pr[i[4] >> 6 == 3 ? 3 : i[4] >> 4 & 3];
            this.seekTo(t);
            n = this.ensureBuffered(a);
            if (n instanceof Promise) {
              n = await n;
            }
            let s = o * 256;
            let c = Math.round(s * ga / e.info.sampleRate);
            return this.supplyPacket(n, c);
          } else {
            throw Error(`Unhandled.`);
          }
        }
        if (r < 128) {
          break;
        }
      }
    }
  }
  supplyPacket(e, t) {
    let r = this.getCurrentPesPacket();
    let i;
    if (this.lastSuppliedPesPacket === r) {
      n(this.nextPts !== null);
      i = this.nextPts;
    } else {
      if (r.pts === null) {
        throw Error(va);
      }
      i = r.pts;
      Ea(this.elementaryStream, r);
    }
    this.lastSuppliedPesPacket = r;
    this.nextPts = i + t;
    let a = r.sectionStartPos;
    let o = a + (this.currentPos - this.currentPesPacketPos);
    let s = this.readBytes(e);
    let c = r.randomAccessIndicator;
    if (c === 0 && !this.elementaryStream.canBeTrustedWithKeyPackets) {
      if (this.elementaryStream.info.type === `audio`) {
        c = 1;
      } else if (this.elementaryStream.info.decoderConfig) {
        let e = rr(this.elementaryStream.info.codec, this.elementaryStream.info.decoderConfig, s) === `key`;
        c = Number(e);
      }
    }
    this.suppliedPacket = {
      pts: i,
      data: s,
      sequenceNumber: o,
      sectionStartPos: a,
      randomAccessIndicator: c
    };
    this.pesPackets.splice(0, this.currentPesPacketIndex);
    this.currentPesPacketIndex = 0;
  }
};
var Oa = class {
  constructor(e, t) {
    this.decodeOrderPackets = [];
    this.reorderBuffer = [];
    this.presentationOrderPackets = [];
    this.reachedEnd = false;
    this.lastDuration = 0;
    this.backing = e;
    this.context = t;
    this.reorderSize = e.getReorderSize();
    n(this.reorderSize >= 0);
  }
  async readNext() {
    if (this.decodeOrderPackets.length === 0 && !(await this.readNextPacket())) {
      return null;
    }
    await this.ensureCurrentPacketHasNext();
    let e = this.decodeOrderPackets[0];
    let t = this.presentationOrderPackets.indexOf(e);
    n(t !== -1);
    let r;
    if (t === this.presentationOrderPackets.length - 1) {
      r = this.lastDuration;
    } else {
      r = this.presentationOrderPackets[t + 1].pts - e.pts;
      this.lastDuration = r;
    }
    this.decodeOrderPackets.shift();
    while (this.presentationOrderPackets.length > 0) {
      let e = this.presentationOrderPackets[0];
      if (this.decodeOrderPackets.includes(e)) {
        break;
      }
      this.presentationOrderPackets.shift();
    }
    return {
      packet: e,
      duration: r
    };
  }
  async readNextPacket() {
    if (this.reachedEnd) {
      return false;
    }
    let e;
    if (!this.context.suppliedPacket) {
      await this.context.markNextPacket();
    }
    e = this.context.suppliedPacket;
    this.context.suppliedPacket = null;
    if (e) {
      this.decodeOrderPackets.push(e);
      this.processPacketThroughReorderBuffer(e);
      return true;
    } else {
      this.reachedEnd = true;
      this.flushReorderBuffer();
      return false;
    }
  }
  async ensureCurrentPacketHasNext() {
    let e = this.decodeOrderPackets[0];
    for (n(e);;) {
      let t = this.presentationOrderPackets.indexOf(e);
      if (t !== -1 && t <= this.presentationOrderPackets.length - 2 || !(await this.readNextPacket())) {
        break;
      }
    }
  }
  processPacketThroughReorderBuffer(e) {
    this.reorderBuffer.push(e);
    if (this.reorderBuffer.length > this.reorderSize) {
      let e = 0;
      for (let t = 1; t < this.reorderBuffer.length; t++) {
        if (this.reorderBuffer[t].pts < this.reorderBuffer[e].pts) {
          e = t;
        }
      }
      let t = this.reorderBuffer[e];
      this.presentationOrderPackets.push(t);
      this.reorderBuffer.splice(e, 1);
    }
  }
  flushReorderBuffer() {
    this.reorderBuffer.sort((e, t) => {
      return e.pts - t.pts;
    });
    this.presentationOrderPackets.push(...this.reorderBuffer);
    this.reorderBuffer.length = 0;
  }
};
var ka = `application/vnd.apple.mpegurl`;
var Aa = `#EXT-X-STREAM-INF:`;
var ja = `#EXT-X-I-FRAME-STREAM-INF:`;
var Ma = `#EXT-X-MEDIA:`;
var Na = `#EXTINF:`;
var Pa = `#EXT-X-MAP:`;
var Fa = `#EXT-X-KEY:`;
var Ia = `#EXT-X-MEDIA-SEQUENCE:`;
var La = `#EXT-X-BYTERANGE:`;
var Ra = `#EXT-X-PROGRAM-DATE-TIME:`;
var za = `#EXT-X-TARGETDURATION:`;
var Ba = e => {
  return e.length === 0 || e.startsWith(`#`) && !e.startsWith(`#EXT`);
};
var Va = class {
  constructor(e) {
    this._attributes = {};
    let t = ``;
    let n = ``;
    let r = false;
    let i = false;
    for (let a = 0; a < e.length; a++) {
      let o = e[a];
      if (o === `"`) {
        i = !i;
      } else if (o === `=` && !r && !i) {
        r = true;
      } else if (o === `,` && !i) {
        if (t) {
          this._attributes[t.trim().toLowerCase()] = n;
        }
        t = ``;
        n = ``;
        r = false;
      } else if (r) {
        n += o;
      } else {
        t += o;
      }
    }
    if (t) {
      this._attributes[t.trim().toLowerCase()] = n;
    }
  }
  get(e) {
    return this._attributes[e.toLowerCase()] ?? null;
  }
  getAsNumber(e) {
    let t = this.get(e);
    if (t === null) {
      return null;
    }
    let n = Number(t);
    if (Number.isFinite(n)) {
      return n;
    } else {
      return null;
    }
  }
  merge(e) {
    Object.assign(this._attributes, e._attributes);
  }
};
var Ha = class {
  constructor(e, t, n) {
    this.nextInputCacheAge = 0;
    this.inputCache = [];
    this.trackBackingsPromise = null;
    this.firstSegment = null;
    this.firstSegmentFirstTimestamps = new WeakMap();
    this.firstTimestampCache = new WeakMap();
    this.input = e;
    this.path = t;
    this.trackDeclarations = n;
  }
  async getDurationFromMetadata(e) {
    let t = await this.getSegmentAt(Infinity, {
      skipLiveWait: e.skipLiveWait
    });
    if (t) {
      return t.timestamp + t.duration;
    } else {
      return null;
    }
  }
  async getUnixTimeForTimestamp(e) {
    let t = await this.getSegmentAt(e, {});
    t ??= await this.getFirstSegment({});
    if (!t || t.unixEpochTimestamp === null) {
      return null;
    }
    let n = e - t.timestamp;
    return t.unixEpochTimestamp + n;
  }
  async getTrackBackings() {
    return this.trackBackingsPromise ??= (async () => {
      let e = [];
      if (this.trackDeclarations) {
        for (let t of this.trackDeclarations) {
          if (t.type === `video`) {
            let n = Je(e, e => {
              return e.getType() === `video`;
            }) + 1;
            e.push(new Wa(this, t, n));
          } else if (t.type === `audio`) {
            let n = Je(e, e => {
              return e.getType() === `audio`;
            }) + 1;
            e.push(new Ga(this, t, n));
          }
        }
      } else {
        this.firstSegment = await this.getFirstSegment({});
        if (!this.firstSegment) {
          return [];
        }
        let t = await this.getInputForSegment(this.firstSegment).getTracks();
        for (let n of t) {
          if (n.type === `video`) {
            let t = Je(e, e => {
              return e.getType() === `video`;
            }) + 1;
            e.push(new Wa(this, {
              id: e.length + 1,
              type: `video`
            }, t));
          } else if (n.type === `audio`) {
            let t = Je(e, e => {
              return e.getType() === `audio`;
            }) + 1;
            e.push(new Ga(this, {
              id: e.length + 1,
              type: `audio`
            }, t));
          }
        }
      }
      return e;
    })();
  }
  async getFirstTimestampForInput(e) {
    let t = this.firstTimestampCache.get(e);
    if (t !== undefined) {
      return t;
    }
    let n = await e.getFirstTimestamp();
    this.firstTimestampCache.set(e, n);
    return n;
  }
  async getMediaOffset(e, t) {
    let n = e.firstSegment ?? e;
    let r;
    if (this.firstSegmentFirstTimestamps.has(n)) {
      r = this.firstSegmentFirstTimestamps.get(n);
    } else {
      let e = this.getInputForSegment(n);
      r = await this.getFirstTimestampForInput(e);
      this.firstSegmentFirstTimestamps.set(n, r);
    }
    if (n === e) {
      return n.timestamp - r;
    }
    let i = await this.getFirstTimestampForInput(t);
    let a = e.timestamp - n.timestamp;
    let o = i - r - a;
    if (Math.abs(o) <= Math.min(0.25, a)) {
      return n.timestamp - r;
    } else {
      return e.timestamp - i;
    }
  }
  dispose() {
    for (let e of this.inputCache) {
      e.input.dispose();
    }
    this.inputCache.length = 0;
  }
};
var Ua = class {
  constructor(e, t, n) {
    this.packetInfos = new WeakMap();
    this.hydrationPromise = null;
    this.firstInputTrack = null;
    this.segmentedInput = e;
    this.decl = t;
    this.number = n;
  }
  hydrate() {
    return this.hydrationPromise ??= (async () => {
      this.segmentedInput.firstSegment ??= await this.segmentedInput.getFirstSegment({});
      if (!this.segmentedInput.firstSegment) {
        throw Error(`Missing first segment, can't retrieve track.`);
      }
      let e = (await this.segmentedInput.getInputForSegment(this.segmentedInput.firstSegment).getTracks()).find(e => {
        return e.type === this.decl.type && e.number === this.number;
      });
      if (!e) {
        throw Error(`No matching track found in underlying media data.`);
      }
      this.firstInputTrack = e;
    })();
  }
  getId() {
    return this.decl.id;
  }
  getType() {
    return this.decl.type;
  }
  getNumber() {
    return this.number;
  }
  delegate(e) {
    if (this.firstInputTrack) {
      return e();
    } else {
      return this.hydrate().then(e);
    }
  }
  async getDecoderConfig() {
    return this.delegate(() => {
      return this.firstInputTrack._backing.getDecoderConfig();
    });
  }
  getHasOnlyKeyPackets() {
    return this.delegate(() => {
      return this.firstInputTrack._backing.getHasOnlyKeyPackets?.() ?? null;
    });
  }
  getPairingMask() {
    return 1n;
  }
  getCodec() {
    return this.delegate(() => {
      return this.firstInputTrack._backing.getCodec();
    });
  }
  getInternalCodecId() {
    return this.delegate(() => {
      return this.firstInputTrack._backing.getInternalCodecId();
    });
  }
  getDisposition() {
    return this.delegate(() => {
      return this.firstInputTrack._backing.getDisposition();
    });
  }
  getLanguageCode() {
    return this.delegate(() => {
      return this.firstInputTrack._backing.getLanguageCode();
    });
  }
  getName() {
    return this.delegate(() => {
      return this.firstInputTrack._backing.getName();
    });
  }
  getTimeResolution() {
    return this.delegate(() => {
      return this.firstInputTrack._backing.getTimeResolution();
    });
  }
  async isRelativeToUnixEpoch() {
    await this.hydrate();
    n(this.segmentedInput.firstSegment);
    return this.segmentedInput.firstSegment.unixEpochTimestamp === this.segmentedInput.firstSegment.timestamp;
  }
  getUnixTimeForTimestamp(e) {
    return this.segmentedInput.getUnixTimeForTimestamp(e);
  }
  getBitrate() {
    return this.delegate(() => {
      return this.firstInputTrack._backing.getBitrate();
    });
  }
  getAverageBitrate() {
    return this.delegate(() => {
      return this.firstInputTrack._backing.getAverageBitrate();
    });
  }
  getDurationFromMetadata(e) {
    return this.segmentedInput.getDurationFromMetadata(e);
  }
  getLiveRefreshInterval() {
    return this.segmentedInput.getLiveRefreshInterval();
  }
  async createAdjustedPacket(e, t, r) {
    n(e.sequenceNumber >= 0);
    n(this.segmentedInput.firstSegment);
    let i = await this.segmentedInput.getMediaOffset(t, r.input);
    let a = t.timestamp - this.segmentedInput.firstSegment.timestamp;
    let o = e.clone({
      timestamp: ve(e.timestamp + i, await r.getTimeResolution()),
      sequenceNumber: Math.floor(a * 100000000) + e.sequenceNumber
    });
    this.packetInfos.set(o, {
      segment: t,
      track: r,
      sourcePacket: e
    });
    return o;
  }
  async getFirstPacket(e) {
    await this.hydrate();
    n(this.segmentedInput.firstSegment);
    n(this.firstInputTrack);
    let t = await this.firstInputTrack._backing.getFirstPacket(e);
    if (t) {
      return this.createAdjustedPacket(t, this.segmentedInput.firstSegment, this.firstInputTrack);
    } else {
      return null;
    }
  }
  getNextPacket(e, t) {
    return this._getNextInternal(e, t, false);
  }
  getNextKeyPacket(e, t) {
    return this._getNextInternal(e, t, true);
  }
  async _getNextInternal(e, t, n) {
    let r = this.packetInfos.get(e);
    if (!r) {
      throw Error(`Packet was not created from this track.`);
    }
    let i = n ? await r.track._backing.getNextKeyPacket(r.sourcePacket, t) : await r.track._backing.getNextPacket(r.sourcePacket, t);
    if (i) {
      return this.createAdjustedPacket(i, r.segment, r.track);
    }
    let a = r.segment;
    while (true) {
      let e = await this.segmentedInput.getNextSegment(a, {
        skipLiveWait: t.skipLiveWait
      });
      if (!e) {
        return null;
      }
      let n = (await this.segmentedInput.getInputForSegment(e).getTracks()).find(e => {
        return e.type === r.track.type && e.number === r.track.number;
      });
      if (!n) {
        a = e;
        continue;
      }
      let i = await n._backing.getFirstPacket(t);
      if (i) {
        return this.createAdjustedPacket(i, e, n);
      } else {
        return null;
      }
    }
  }
  getPacket(e, t) {
    return this._getPacketInternal(e, t, false);
  }
  getKeyPacket(e, t) {
    return this._getPacketInternal(e, t, true);
  }
  async _getPacketInternal(e, t, n) {
    let r = await this.segmentedInput.getSegmentAt(e, {
      skipLiveWait: t.skipLiveWait
    });
    if (!r) {
      return null;
    }
    for (await this.hydrate(); r;) {
      let i = this.segmentedInput.getInputForSegment(r);
      let a = (await i.getTracks()).find(e => {
        return e.type === this.firstInputTrack.type && e.number === this.firstInputTrack.number;
      });
      if (!a) {
        r = await this.segmentedInput.getPreviousSegment(r, {
          skipLiveWait: t.skipLiveWait
        });
        continue;
      }
      let o = e - (await this.segmentedInput.getMediaOffset(r, i));
      let s = n ? await a._backing.getKeyPacket(o, t) : await a._backing.getPacket(o, t);
      if (!s) {
        r = await this.segmentedInput.getPreviousSegment(r, {
          skipLiveWait: t.skipLiveWait
        });
        continue;
      }
      return this.createAdjustedPacket(s, r, a);
    }
    return null;
  }
};
var Wa = class extends Ua {
  getType() {
    return `video`;
  }
  getCodec() {
    return this.delegate(() => {
      return this.firstInputTrack._backing.getCodec();
    });
  }
  getCodedWidth() {
    return this.delegate(() => {
      return this.firstInputTrack._backing.getCodedWidth();
    });
  }
  getCodedHeight() {
    return this.delegate(() => {
      return this.firstInputTrack._backing.getCodedHeight();
    });
  }
  getSquarePixelWidth() {
    return this.delegate(() => {
      return this.firstInputTrack._backing.getSquarePixelWidth();
    });
  }
  getSquarePixelHeight() {
    return this.delegate(() => {
      return this.firstInputTrack._backing.getSquarePixelHeight();
    });
  }
  getRotation() {
    return this.delegate(() => {
      return this.firstInputTrack._backing.getRotation();
    });
  }
  async getColorSpace() {
    return this.delegate(() => {
      return this.firstInputTrack._backing.getColorSpace();
    });
  }
  async canBeTransparent() {
    return this.delegate(() => {
      return this.firstInputTrack._backing.canBeTransparent();
    });
  }
  async getDecoderConfig() {
    return this.delegate(() => {
      return this.firstInputTrack._backing.getDecoderConfig();
    });
  }
};
var Ga = class extends Ua {
  getType() {
    return `audio`;
  }
  getCodec() {
    return this.delegate(() => {
      return this.firstInputTrack._backing.getCodec();
    });
  }
  getNumberOfChannels() {
    return this.delegate(() => {
      return this.firstInputTrack._backing.getNumberOfChannels();
    });
  }
  getSampleRate() {
    return this.delegate(() => {
      return this.firstInputTrack._backing.getSampleRate();
    });
  }
  async getDecoderConfig() {
    return this.delegate(() => {
      return this.firstInputTrack._backing.getDecoderConfig();
    });
  }
};
var Ka = t((e, t) => {
  t.exports = {};
});
var qa = e(Ka(), 1);
Ge();
var Ja = qa === undefined ? undefined : qa;
var Ya = Infinity;
var Xa = null;
if (typeof FinalizationRegistry < `u`) {
  Xa = new FinalizationRegistry(e => {
    e();
  });
}
var Za = class extends ut {
  constructor() {
    super();
    this._disposed = false;
    this._refCount = 0;
    this._usedForHls = false;
    this._refFinalizationRegistry = null;
    this._sizePromise = null;
    this.onread = null;
    if (typeof FinalizationRegistry < `u`) {
      this._refFinalizationRegistry = new FinalizationRegistry(e => {
        e._decrementRefCount();
      });
    }
  }
  async getSizeOrNull() {
    if (this._disposed) {
      throw new ul();
    }
    return this._sizePromise ??= (async () => {
      let e = this._getFileSize();
      if (e === undefined) {
        await this._read(0, 1, 0, Ya);
        e = this._getFileSize();
        n(e !== undefined);
        return e;
      } else {
        return e;
      }
    })();
  }
  async getSize() {
    if (this._disposed) {
      throw new ul();
    }
    let e = await this.getSizeOrNull();
    if (e === null) {
      throw Error(`Cannot determine the size of an unsized source.`);
    }
    return e;
  }
  slice(e, t) {
    if (!Number.isInteger(e) || e < 0) {
      throw TypeError(`offset must be a non-negative integer.`);
    }
    if (t !== undefined && (!Number.isInteger(t) || t < 0)) {
      throw TypeError(`length, when provided, must be a non-negative integer.`);
    }
    return new _o(this, e, t);
  }
  _dispatchRead(e, t) {
    this.onread?.(e, t);
    this._emit(`read`, {
      start: e,
      end: t
    });
  }
  ref() {
    return new Qa(this);
  }
  _incrementRefCount() {
    this._refCount++;
  }
  _decrementRefCount() {
    this._refCount--;
    if (this._refCount === 0) {
      this._dispose();
      this._disposed = true;
    }
  }
};
var Qa = class {
  constructor(e) {
    this._freed = false;
    if (e._disposed) {
      throw Error(`Cannot ref a disposed source.`);
    }
    e._incrementRefCount();
    e._refFinalizationRegistry?.register(this, e, this);
    this._source = e;
  }
  get source() {
    if (!this._source) {
      throw Error(`Can't get source; ref has already been freed.`);
    }
    return this._source;
  }
  get freed() {
    return this._freed;
  }
  free() {
    if (this._freed) {
      throw Error(`Illegal operation: double free on SourceRef.`);
    }
    let e = this.source;
    n(e._refCount > 0);
    e._decrementRefCount();
    e._refFinalizationRegistry?.unregister(this);
    this._freed = true;
    this._source = null;
  }
  [Symbol.dispose]() {
    if (!this.freed) {
      this.free();
    }
  }
};
var $a = class extends Za {
  constructor(e, t) {
    if (typeof e != `string`) {
      throw TypeError(`rootPath must be a string.`);
    }
    if (typeof t != `function`) {
      throw TypeError(`requestHandler must be a function.`);
    }
    super();
    this.rootPath = e;
    this.requestHandler = t;
  }
  _resolveRequest(e) {
    let t = this.requestHandler(e);
    let n = e => {
      if (!(e instanceof Za) && !(e instanceof Qa)) {
        throw TypeError(`requestHandler must return or resolve to a Source or SourceRef.`);
      }
      let t = e instanceof Za ? e.ref() : e;
      t.source._usedForHls ||= this._usedForHls;
      return t;
    };
    if (t instanceof Promise) {
      return t.then(n);
    } else {
      return n(t);
    }
  }
};
var eo = (e, t) => {
  return e.path === t.path;
};
var to = class extends $a {
  constructor() {
    super(...arguments);
    this._root = null;
    this._rootRequest = null;
  }
  _read(e, t, r, i) {
    if (!this._root) {
      if (!this._rootRequest) {
        let e = this._resolveRequest({
          path: this.rootPath,
          isRoot: true
        });
        let t = e => {
          let t = e instanceof Za ? e.ref() : e;
          this._root = t;
          this._rootRequest = null;
          return t;
        };
        if (e instanceof Promise) {
          this._rootRequest = e.then(t);
        } else {
          t(e);
          n(this._root);
        }
      }
      if (this._rootRequest) {
        return this._rootRequest.then(n => {
          return n.source._read(e, t, r, i);
        });
      }
    }
    return this._root.source._read(e, t, r, i);
  }
  _getFileSize() {
    if (this._root) {
      return this._root.source._getFileSize();
    }
  }
  _dispose() {
    if (this._root) {
      this._root.free();
    } else if (this._rootRequest) {
      this._rootRequest.then(e => {
        return e.free();
      });
    }
  }
};
var no = class extends Za {
  constructor(e) {
    if (!(e instanceof ArrayBuffer) && (!(typeof SharedArrayBuffer < `u`) || !(e instanceof SharedArrayBuffer)) && !ArrayBuffer.isView(e)) {
      throw TypeError(`buffer must be an ArrayBuffer, SharedArrayBuffer, or ArrayBufferView.`);
    }
    super();
    this._onreadCalled = false;
    this._bytes = l(e);
    this._view = u(e);
  }
  _getFileSize() {
    return this._bytes.byteLength;
  }
  _read() {
    this._dispatchRead(0, this._bytes.byteLength);
    this._onreadCalled ||= true;
    return {
      bytes: this._bytes,
      view: this._view,
      offset: 0
    };
  }
  _dispose() {}
};
var ro = class extends Za {
  constructor(e, t = {}) {
    if (!(e instanceof Blob)) {
      throw TypeError(`blob must be a Blob.`);
    }
    if (!t || typeof t != `object`) {
      throw TypeError(`options must be an object.`);
    }
    if (t.maxCacheSize !== undefined && (!Ke(t.maxCacheSize) || t.maxCacheSize < 0)) {
      throw TypeError(`options.maxCacheSize, when provided, must be a non-negative number.`);
    }
    if (t.useStreamReader !== undefined && typeof t.useStreamReader != `boolean`) {
      throw TypeError(`options.useStreamReader, when provided, must be a boolean.`);
    }
    super();
    this._readers = new WeakMap();
    this._blob = e;
    this._options = t;
    this._orchestrator = new go({
      maxCacheSize: t.maxCacheSize ?? 8388608,
      maxWorkerCount: 4,
      runWorker: this._runWorker.bind(this),
      prefetchProfile: ho.fileSystem
    });
    this._orchestrator.fileSize = e.size;
  }
  _getFileSize() {
    return this._orchestrator.fileSize;
  }
  _read(e, t, n, r) {
    return this._orchestrator.read(e, t, n, r);
  }
  async _runWorker(e) {
    n(e.strictTarget);
    let t = this._readers.get(e);
    if (`stream` in this._blob && !je() && this._options.useStreamReader !== false) {
      t = this._blob.slice(e.currentPos).stream().getReader();
    } else {
      t = null;
    }
    for (t === undefined && this._readers.set(e, t); e.currentPos < e.targetPos && !e.aborted;) {
      if (t) {
        let {
          done: n,
          value: r
        } = await t.read();
        if (n) {
          this._orchestrator.onWorkerFinished(e);
          throw Error(`Blob reader stopped unexpectedly before all requested data was read.`);
        }
        if (e.aborted) {
          break;
        }
        this._dispatchRead(e.currentPos, e.currentPos + r.length);
        this._orchestrator.supplyWorkerData(e, r);
      } else {
        let t = await this._blob.slice(e.currentPos, e.targetPos).arrayBuffer();
        if (e.aborted) {
          break;
        }
        this._dispatchRead(e.currentPos, e.currentPos + t.byteLength);
        this._orchestrator.supplyWorkerData(e, new Uint8Array(t));
      }
    }
    this._orchestrator.signalWorkerStoppedRunning(e);
    if (e.aborted) {
      await t?.cancel();
    }
  }
  _dispose() {
    this._orchestrator.dispose();
  }
};
var io = 524288;
var ao = (e, t, n) => {
  if (t instanceof Error && (t.message.includes(`Failed to fetch`) || t.message.includes(`Load failed`) || t.message.includes(`NetworkError when attempting to fetch resource`)) && typeof window < `u`) {
    let e = null;
    try {
      if (typeof window < `u` && window.location !== undefined) {
        e = new URL(n instanceof Request ? n.url : n, window.location.href).origin;
      }
    } catch {}
    if ((!(typeof navigator < `u`) || typeof navigator.onLine != `boolean` || navigator.onLine) && e !== null && e !== window.location.origin) {
      k._warn(`Request will not be retried because a CORS error was suspected due to different origins. You can modify this behavior by providing your own function for the 'getRetryDelay' option.`);
      return null;
    }
  }
  return Math.min(2 ** (e - 2), 16);
};
var oo = new Set();
var so = class e extends $a {
  constructor(t, n = {}) {
    if (typeof t != `string` && !(t instanceof URL) && (!(typeof Request < `u`) || !(t instanceof Request))) {
      throw TypeError(`url must be a string, URL or Request.`);
    }
    if (!n || typeof n != `object`) {
      throw TypeError(`options must be an object.`);
    }
    if (n.requestInit !== undefined && (!n.requestInit || typeof n.requestInit != `object`)) {
      throw TypeError(`options.requestInit, when provided, must be an object.`);
    }
    if (n.getRetryDelay !== undefined && typeof n.getRetryDelay != `function`) {
      throw TypeError(`options.getRetryDelay, when provided, must be a function.`);
    }
    if (n.maxCacheSize !== undefined && (!Ke(n.maxCacheSize) || n.maxCacheSize < 0)) {
      throw TypeError(`options.maxCacheSize, when provided, must be a non-negative number.`);
    }
    if (n.parallelism !== undefined && (!Number.isInteger(n.parallelism) || n.parallelism < 1)) {
      throw TypeError(`options.parallelism, when provided, must be a positive number.`);
    }
    if (n.fetchFn !== undefined && typeof n.fetchFn != `function`) {
      throw TypeError(`options.fetchFn, when provided, must be a function.`);
    }
    let r = t instanceof Request ? t.url : t instanceof URL ? t.href : t;
    super(r, t => {
      return new e(t.path, this._options);
    });
    this._offset = 0;
    this._length = null;
    this._fileSizeDetermined = false;
    this._url = t;
    this._options = n;
    this._getRetryDelay = n.getRetryDelay ?? ao;
    this._requestInit = {
      ...n.requestInit
    };
    let i = null;
    if (n.requestInit?.headers) {
      let e = {
        ...Ee(n.requestInit.headers)
      };
      let t = Object.keys(e).find(e => {
        return e.toLowerCase() === `range`;
      });
      if (t !== undefined) {
        i = e[t];
        delete e[t];
        this._requestInit.headers = e;
      }
    }
    if (t instanceof Request) {
      let e = t.headers.get(`Range`);
      if (e !== null) {
        i ??= e;
        let n = new Request(t);
        n.headers.delete(`Range`);
        this._url = n;
      }
    }
    if (i !== null) {
      let e = lo(i);
      if (e) {
        this._offset = e.offset;
        this._length = e.length;
      }
    }
    this._orchestrator = new go({
      maxCacheSize: n.maxCacheSize ?? 67108864,
      maxWorkerCount: n.parallelism ?? 2,
      runWorker: this._runWorker.bind(this),
      prefetchProfile: ho.network
    });
  }
  _getFileSize() {
    if (!this._fileSizeDetermined) {
      if (this._length === null) {
        return undefined;
      } else {
        return this._length;
      }
    }
    let e = this._orchestrator.fileSize;
    if (e === null) {
      if (this._length === null) {
        return null;
      } else {
        return this._length;
      }
    } else {
      return O(e - this._offset, 0, this._length ?? Infinity);
    }
  }
  _read(e, t, n, r) {
    if (this._length !== null && t > this._length) {
      return null;
    }
    let i = this._offset;
    let a = this._orchestrator.read(i + e, i + t, Math.max(i + n, i), i + Math.min(r, this._length ?? Infinity));
    let o = e => {
      if (e) {
        e.offset -= this._offset;
        return e;
      } else {
        return null;
      }
    };
    if (a instanceof Promise) {
      return a.then(o);
    } else {
      return o(a);
    }
  }
  async _runWorker(e) {
    while (true) {
      let t = new AbortController();
      let n = await De(this._options.fetchFn ?? fetch, this._url, Te(this._requestInit, {
        headers: {
          Range: `bytes=${e.currentPos}-`
        },
        signal: t.signal
      }), this._getRetryDelay, () => {
        return this._disposed;
      });
      if (!n.ok) {
        throw Error(`Error fetching ${String(this._url)}: ${n.status} ${n.statusText}`);
      }
      if (n.redirected) {
        this.rootPath = n.url;
      }
      outer: if (this._orchestrator.fileSize === null) {
        let t = n.headers.get(`Content-Range`);
        if (t) {
          let e = /\/(\d+)/.exec(t);
          if (e) {
            this._orchestrator.supplyFileSize(Number(e[1]));
            break outer;
          }
        }
        let r = n.headers.get(`Content-Length`);
        if (r) {
          this._orchestrator.supplyFileSize(e.currentPos + Number(r));
        }
      }
      this._fileSizeDetermined = true;
      if (n.status !== 206) {
        if (!this._usedForHls) {
          let e = new URL(this._url instanceof Request ? this._url.url : this._url, typeof window < `u` ? window.location.href : undefined);
          if (e.origin !== `null` && !e.pathname.endsWith(`.m3u8`) && !e.pathname.endsWith(`.m3u`)) {
            if (!oo.has(e.origin)) {
              k._warn(`HTTP server (origin ${e.origin}) did not respond to a range request with 206 Partial Content, meaning the entire resource will now be downloaded. To enable efficient media file streaming across a network, please make sure your server supports range requests.`);
              oo.add(e.origin);
            }
          }
        }
        e.currentPos = 0;
        this._orchestrator.options.maxCacheSize = Infinity;
        if (this._orchestrator.fileSize === null) {
          e.targetPos = Infinity;
          e.strictTarget = false;
        } else {
          e.targetPos = this._orchestrator.fileSize;
        }
        this._orchestrator.consolidateEverythingIntoOneWorker(e);
      }
      if (!n.body) {
        throw Error(`Missing HTTP response body stream. The used fetch function must provide the response body as a ReadableStream.`);
      }
      let r = n.body.getReader();
      while (true) {
        if (e.currentPos >= e.targetPos || e.aborted) {
          t.abort();
          this._orchestrator.signalWorkerStoppedRunning(e);
          return;
        }
        let n;
        try {
          n = await r.read();
        } catch (e) {
          if (this._disposed) {
            throw e;
          }
          let t = this._getRetryDelay(1, e, this._url);
          if (t !== null) {
            k._error(`Error while reading response stream. Attempting to resume.`, e);
            await ct(t * 1000);
            break;
          } else {
            throw e;
          }
        }
        if (e.aborted) {
          continue;
        }
        let {
          done: i,
          value: a
        } = n;
        if (i) {
          if (e.currentPos >= e.targetPos) {
            this._orchestrator.onWorkerFinished(e);
            return;
          }
          if (e.strictTarget) {
            break;
          }
          this._orchestrator.onWorkerFinished(e);
          return;
        }
        this._dispatchRead(e.currentPos, e.currentPos + a.length);
        this._orchestrator.supplyWorkerData(e, a);
      }
    }
  }
  _dispose() {
    this._orchestrator.dispose();
  }
};
var co = /^bytes=(\d+)-(\d*)$/;
var lo = e => {
  let t = co.exec(e.trim());
  if (!t) {
    return null;
  }
  let n = Number(t[1]);
  let r = t[2] === `` ? null : Number(t[2]);
  if (r !== null && r < n) {
    return null;
  } else {
    return {
      offset: n,
      length: r === null ? null : r - n + 1
    };
  }
};
var uo = class e extends $a {
  constructor(t, r = {}) {
    if (typeof t != `string`) {
      throw TypeError(`filePath must be a string.`);
    }
    if (!r || typeof r != `object`) {
      throw TypeError(`options must be an object.`);
    }
    if (r.maxCacheSize !== undefined && (!Ke(r.maxCacheSize) || r.maxCacheSize < 0)) {
      throw TypeError(`options.maxCacheSize, when provided, must be a non-negative number.`);
    }
    if (!Ja.fs) {
      throw Error(`FilePathSource is only available in server-side environments (Node.js, Bun, Deno).`);
    }
    super(t, t => {
      return new e(t.path, r);
    });
    this._fileHandle = null;
    this._customSource = new fo({
      getSize: async () => {
        let e = await Ja.fs.open(t, `r`);
        this._fileHandle = e;
        Xa?.register(this, () => {
          e.close();
        }, this);
        return (await e.stat()).size;
      },
      read: async (e, t) => {
        n(this._fileHandle);
        let r = new Uint8Array(t - e);
        await this._fileHandle.read(r, 0, t - e, e);
        return r;
      },
      maxCacheSize: r.maxCacheSize,
      prefetchProfile: `fileSystem`
    });
  }
  _read(e, t, n, r) {
    return this._customSource._read(e, t, n, r);
  }
  _getFileSize() {
    return this._customSource._getFileSize();
  }
  _dispose() {
    this._customSource._dispose();
    if (this._fileHandle) {
      this._fileHandle.close();
      this._fileHandle = null;
      Xa?.unregister(this);
    }
  }
};
var fo = class extends Za {
  constructor(e) {
    if (!e || typeof e != `object`) {
      throw TypeError(`options must be an object.`);
    }
    if (typeof e.getSize != `function`) {
      throw TypeError(`options.getSize must be a function.`);
    }
    if (typeof e.read != `function`) {
      throw TypeError(`options.read must be a function.`);
    }
    if (e.dispose !== undefined && typeof e.dispose != `function`) {
      throw TypeError(`options.dispose, when provided, must be a function.`);
    }
    if (e.maxCacheSize !== undefined && (!Ke(e.maxCacheSize) || e.maxCacheSize < 0)) {
      throw TypeError(`options.maxCacheSize, when provided, must be a non-negative number.`);
    }
    if (e.prefetchProfile && ![`none`, `fileSystem`, `network`].includes(e.prefetchProfile)) {
      throw TypeError(`options.prefetchProfile, when provided, must be one of 'none', 'fileSystem' or 'network'.`);
    }
    super();
    this._options = e;
    this._orchestrator = new go({
      maxCacheSize: e.maxCacheSize ?? 8388608,
      maxWorkerCount: 2,
      prefetchProfile: ho[e.prefetchProfile ?? `none`],
      runWorker: this._runWorker.bind(this)
    });
  }
  _getFileSize() {
    return this._orchestrator.fileSize ?? undefined;
  }
  _read(e, t, n, r) {
    if (this._orchestrator.fileSize !== null) {
      return this._orchestrator.read(e, t, n, r);
    }
    let i = this._options.getSize();
    if (i instanceof Promise) {
      return i.then(i => {
        if (!Number.isInteger(i) || i < 0) {
          throw TypeError(`options.getSize must return or resolve to a non-negative integer.`);
        }
        this._orchestrator.fileSize = i;
        return this._orchestrator.read(e, t, n, r);
      });
    }
    if (!Number.isInteger(i) || i < 0) {
      throw TypeError(`options.getSize must return or resolve to a non-negative integer.`);
    }
    this._orchestrator.fileSize = i;
    return this._orchestrator.read(e, t, n, r);
  }
  async _runWorker(e) {
    while (e.currentPos < e.targetPos && !e.aborted) {
      let t = e.currentPos;
      let n = e.targetPos;
      let r = this._options.read(e.currentPos, n);
      if (r instanceof Promise) {
        r = await r;
      }
      if (e.aborted) {
        break;
      }
      if (r instanceof Uint8Array) {
        r = l(r);
        if (r.length !== n - e.currentPos) {
          throw Error(`options.read returned a Uint8Array with unexpected length: Requested ${n - e.currentPos} bytes, but got ${r.length}.`);
        }
        this._dispatchRead(e.currentPos, e.currentPos + r.length);
        this._orchestrator.supplyWorkerData(e, r);
      } else if (r instanceof ReadableStream) {
        let i = r.getReader();
        while (e.currentPos < n && !e.aborted) {
          let {
            done: r,
            value: a
          } = await i.read();
          if (r) {
            if (e.currentPos < n) {
              throw Error(`ReadableStream returned by options.read ended before supplying enough data. Requested ${n - t} bytes, but got ${e.currentPos - t}`);
            }
            break;
          }
          if (!(a instanceof Uint8Array)) {
            throw TypeError(`ReadableStream returned by options.read must yield Uint8Array chunks.`);
          }
          if (e.aborted) {
            break;
          }
          let o = l(a);
          this._dispatchRead(e.currentPos, e.currentPos + o.length);
          this._orchestrator.supplyWorkerData(e, o);
        }
      } else {
        throw TypeError(`options.read must return or resolve to a Uint8Array or a ReadableStream.`);
      }
    }
    this._orchestrator.signalWorkerStoppedRunning(e);
  }
  _dispose() {
    this._orchestrator.dispose();
    this._options.dispose?.();
  }
};
var po = fo;
var mo = class extends Za {
  constructor(e, t = {}) {
    if (!(e instanceof ReadableStream)) {
      throw TypeError(`stream must be a ReadableStream.`);
    }
    if (!t || typeof t != `object`) {
      throw TypeError(`options must be an object.`);
    }
    if (t.maxCacheSize !== undefined && (!Ke(t.maxCacheSize) || t.maxCacheSize < 0)) {
      throw TypeError(`options.maxCacheSize, when provided, must be a non-negative number.`);
    }
    super();
    this._reader = null;
    this._cache = [];
    this._pendingSlices = [];
    this._currentIndex = 0;
    this._targetIndex = 0;
    this._maxRequestedIndex = 0;
    this._endIndex = null;
    this._pulling = false;
    this._stream = e;
    this._maxCacheSize = t.maxCacheSize ?? 33554432;
  }
  _getFileSize() {
    return this._endIndex;
  }
  _read(e, t) {
    if (this._endIndex !== null && t > this._endIndex) {
      return null;
    }
    this._maxRequestedIndex = Math.max(this._maxRequestedIndex, t);
    let n = T(this._cache, e, e => {
      return e.start;
    });
    let r = n === -1 ? null : this._cache[n];
    if (r && r.start <= e && t <= r.end) {
      return {
        bytes: r.bytes,
        view: r.view,
        offset: r.start
      };
    }
    let i = e;
    let a = new Uint8Array(t - e);
    if (n !== -1) {
      for (let r = n; r < this._cache.length; r++) {
        let n = this._cache[r];
        if (n.start >= t) {
          break;
        }
        let o = Math.max(e, n.start);
        if (o > i) {
          this._throwDueToCacheMiss();
        }
        let s = Math.min(t, n.end);
        if (o < s) {
          a.set(n.bytes.subarray(o - n.start, s - n.start), o - e);
          i = s;
        }
      }
    }
    if (i === t) {
      return {
        bytes: a,
        view: u(a),
        offset: e
      };
    }
    if (this._currentIndex > i) {
      this._throwDueToCacheMiss();
    }
    let {
      promise: o,
      resolve: s,
      reject: c
    } = E();
    this._pendingSlices.push({
      start: e,
      end: t,
      bytes: a,
      resolve: s,
      reject: c
    });
    this._targetIndex = Math.max(this._targetIndex, t);
    if (!this._pulling) {
      this._pulling = true;
      this._pull().catch(e => {
        this._pulling = false;
        if (this._pendingSlices.length > 0) {
          this._pendingSlices.forEach(t => {
            return t.reject(e);
          });
          this._pendingSlices.length = 0;
        } else {
          throw e;
        }
      });
    }
    return o;
  }
  _throwDueToCacheMiss() {
    throw Error(`Read is before the cached region. With ReadableStreamSource, you must access the data more sequentially or increase the size of its cache.`);
  }
  async _pull() {
    for (this._reader ??= this._stream.getReader(); this._currentIndex < this._targetIndex && !this._disposed;) {
      let {
        done: e,
        value: t
      } = await this._reader.read();
      if (e) {
        for (let e of this._pendingSlices) {
          e.resolve(null);
        }
        this._pendingSlices.length = 0;
        this._endIndex = this._currentIndex;
        break;
      }
      let n = this._currentIndex;
      let r = this._currentIndex + t.byteLength;
      this._dispatchRead(n, r);
      for (let e = 0; e < this._pendingSlices.length; e++) {
        let i = this._pendingSlices[e];
        let a = Math.max(n, i.start);
        let o = Math.min(r, i.end);
        if (a < o) {
          i.bytes.set(t.subarray(a - n, o - n), a - i.start);
          if (o === i.end) {
            i.resolve({
              bytes: i.bytes,
              view: u(i.bytes),
              offset: i.start
            });
            this._pendingSlices.splice(e, 1);
            e--;
          }
        }
      }
      for (this._cache.push({
        start: n,
        end: r,
        bytes: t,
        view: u(t),
        age: 0
      }); this._cache.length > 0;) {
        let e = this._cache[0];
        if (this._maxRequestedIndex - e.end <= this._maxCacheSize) {
          break;
        }
        this._cache.shift();
      }
      this._currentIndex += t.byteLength;
    }
    this._pulling = false;
  }
  _dispose() {
    this._pendingSlices.length = 0;
    this._cache.length = 0;
    this._reader?.cancel();
  }
};
var ho = {
  none: (e, t) => {
    return {
      start: e,
      end: t
    };
  },
  fileSystem: (e, t) => {
    let n = 65536;
    e = Math.floor((e - n) / n) * n;
    t = Math.ceil((t + n) / n) * n;
    return {
      start: e,
      end: t
    };
  },
  network: (e, t, n) => {
    let r = 65536;
    e = Math.max(0, Math.floor((e - r) / r) * r);
    for (let r of n) {
      let n = 8388608;
      let i = Math.max((r.startPos + r.targetPos) / 2, r.targetPos - n);
      if (ze(e, t, i, r.targetPos)) {
        let e = r.targetPos - r.startPos;
        let i = Math.ceil((e + 1) / n) * n;
        let a = 2 ** Math.ceil(Math.log2(e + 1));
        let o = Math.min(a, i);
        t = Math.max(t, r.startPos + o);
      }
    }
    t = Math.max(t, e + io);
    return {
      start: e,
      end: t
    };
  }
};
var go = class {
  constructor(e) {
    this.options = e;
    this.fileSize = null;
    this.nextAge = 0;
    this.workers = [];
    this.cache = [];
    this.currentCacheSize = 0;
    this.disposed = false;
    this.queuedReads = [];
  }
  read(e, t, r, i) {
    n(!this.disposed);
    let a = this.options.prefetchProfile(e, t, this.workers);
    let o = Math.max(a.start, r);
    let s = Math.min(a.end, this.fileSize ?? Infinity, i);
    n(o <= e && t <= s);
    let c = null;
    let l = T(this.cache, e, e => {
      return e.start;
    });
    let d = l === -1 ? null : this.cache[l];
    if (d && d.start <= e && t <= d.end) {
      d.age = this.nextAge++;
      c = {
        bytes: d.bytes,
        view: d.view,
        offset: d.start
      };
    }
    let f = T(this.cache, o, e => {
      return e.start;
    });
    let p = c ? null : new Uint8Array(t - e);
    let m = 0;
    let h = o;
    let g = [];
    if (f !== -1) {
      for (let r = f; r < this.cache.length; r++) {
        let i = this.cache[r];
        if (i.start >= s) {
          break;
        }
        if (i.end <= o) {
          continue;
        }
        let a = Math.max(o, i.start);
        let c = Math.min(s, i.end);
        n(a <= c);
        if (h < a) {
          g.push({
            start: h,
            end: a
          });
        }
        h = c;
        if (p) {
          let n = Math.max(e, i.start);
          let r = Math.min(t, i.end);
          if (n < r) {
            let t = n - e;
            p.set(i.bytes.subarray(n - i.start, r - i.start), t);
            if (t === m) {
              m = r - e;
            }
          }
        }
        i.age = this.nextAge++;
      }
      if (h < s) {
        g.push({
          start: h,
          end: s
        });
      }
    } else {
      g.push({
        start: o,
        end: s
      });
    }
    if (p && m >= p.length) {
      c = {
        bytes: p,
        view: u(p),
        offset: e
      };
    }
    if (g.length === 0) {
      n(c);
      return c;
    }
    let {
      promise: _,
      resolve: v,
      reject: y
    } = E();
    let b = [];
    for (let n of g) {
      let r = Math.max(e, n.start);
      let i = Math.min(t, n.end);
      if (r === n.start && i === n.end) {
        b.push(n);
      } else if (r < i) {
        b.push({
          start: r,
          end: i
        });
      }
    }
    let x = p && {
      start: e,
      bytes: p,
      holes: b,
      resolve: v,
      reject: y
    };
    outer: for (let e of g) {
      for (let t of this.workers) {
        if (this.checkHoleAgainstWorker(t, e, x ? [x] : [])) {
          this.checkQueuedReadsAgainstWorker(t);
          continue outer;
        }
      }
      let t = e.end < s || this.fileSize !== null;
      let n = this.createWorker(e.start, e.end, t);
      if (n) {
        if (x) {
          n.pendingSlices = [x];
        }
        this.runWorker(n);
      } else {
        let n = T(this.queuedReads, e.start, e => {
          return e.hole.start;
        });
        let r = n === -1 ? null : this.queuedReads[n];
        r.hole.end = Math.max(r.hole.end, e.end);
        r.strictTarget &&= t;
        n++;
        r = {
          hole: {
            start: e.start,
            end: e.end
          },
          strictTarget: t,
          pendingSlices: x ? [x] : [],
          age: this.nextAge++
        };
        for (r && e.start <= r.hole.end ? x && r.pendingSlices.push(x) : this.queuedReads.splice(n, 0, r); n + 1 < this.queuedReads.length;) {
          let e = this.queuedReads[n + 1];
          if (e.hole.start > r.hole.end) {
            break;
          }
          r.hole.end = Math.max(r.hole.end, e.hole.end);
          r.pendingSlices.push(...e.pendingSlices);
          r.strictTarget &&= e.strictTarget;
          r.age = Math.min(r.age, e.age);
          this.queuedReads.splice(n + 1, 1);
        }
      }
    }
    if (c) {
      _.catch(e => {
        if (!this.disposed) {
          throw e;
        }
      });
    } else {
      n(p);
      c = _.then(t => {
        return t && {
          bytes: t,
          view: u(t),
          offset: e
        };
      });
    }
    return c;
  }
  checkHoleAgainstWorker(e, t, n) {
    if (ze(t.start - 131072, t.start, e.currentPos, e.targetPos)) {
      e.targetPos = Math.max(e.targetPos, t.end);
      for (let t = 0; t < n.length; t++) {
        let r = n[t];
        if (!e.pendingSlices.includes(r)) {
          e.pendingSlices.push(r);
        }
      }
      if (!e.running) {
        this.runWorker(e);
      }
      return true;
    }
    return false;
  }
  checkQueuedReadsAgainstWorker(e) {
    let t = false;
    for (let n = 0; n < this.queuedReads.length; n++) {
      let r = this.queuedReads[n];
      if (this.checkHoleAgainstWorker(e, r.hole, r.pendingSlices)) {
        this.queuedReads.splice(n, 1);
        n--;
        t = true;
      } else if (t) {
        break;
      }
    }
  }
  createWorker(e, t, r) {
    if (this.workers.length >= this.options.maxWorkerCount) {
      let e = null;
      let t = null;
      for (let n = 0; n < this.workers.length; n++) {
        let r = this.workers[n];
        if (!r.running && r.pendingSlices.length === 0 && (!e || r.age < e.age)) {
          t = n;
          e = r;
        }
      }
      if (e) {
        n(t !== null);
        n(e.pendingSlices.length === 0);
        this.workers.splice(t, 1);
      } else {
        return null;
      }
    }
    let i = {
      startPos: e,
      currentPos: e,
      targetPos: t,
      strictTarget: r,
      running: false,
      aborted: this.disposed,
      pendingSlices: [],
      age: this.nextAge++
    };
    this.workers.push(i);
    return i;
  }
  runWorker(e) {
    n(!e.running);
    n(e.currentPos < e.targetPos);
    e.running = true;
    e.age = this.nextAge++;
    this.options.runWorker(e).catch(t => {
      e.running = false;
      if (e.pendingSlices.length > 0) {
        e.pendingSlices.forEach(e => {
          return e.reject(t);
        });
        e.pendingSlices.length = 0;
      } else if (!e.aborted && !this.disposed) {
        throw t;
      }
    }).finally(() => {
      if (!e.running && this.queuedReads.length > 0) {
        let e = 0;
        for (let t = 1; t < this.queuedReads.length; t++) {
          if (this.queuedReads[t].age < this.queuedReads[e].age) {
            e = t;
          }
        }
        let t = this.queuedReads[e];
        let n = this.createWorker(t.hole.start, t.hole.end, t.strictTarget);
        if (!n) {
          return;
        }
        this.queuedReads.splice(e, 1);
        n.pendingSlices = t.pendingSlices;
        this.runWorker(n);
      }
    });
  }
  consolidateEverythingIntoOneWorker(e) {
    let t = new Set(e.pendingSlices);
    for (let n = 0; n < this.workers.length; n++) {
      let r = this.workers[n];
      if (r !== e) {
        for (let e of r.pendingSlices) {
          t.add(e);
        }
        r.aborted = true;
        r.pendingSlices.length = 0;
        this.workers.splice(n, 1);
        n--;
      }
    }
    for (let e = 0; e < this.queuedReads.length; e++) {
      let n = this.queuedReads[e];
      for (let e of n.pendingSlices) {
        t.add(e);
      }
    }
    e.pendingSlices = [...t];
    this.queuedReads.length = 0;
  }
  supplyWorkerData(e, t) {
    n(!e.aborted);
    let r = e.currentPos;
    let i = r + t.length;
    this.insertIntoCache({
      start: r,
      end: i,
      bytes: t,
      view: u(t),
      age: this.nextAge++
    });
    e.currentPos += t.length;
    if (e.currentPos > e.targetPos) {
      e.targetPos = e.currentPos;
      this.checkQueuedReadsAgainstWorker(e);
    }
    for (let n = 0; n < e.pendingSlices.length; n++) {
      let a = e.pendingSlices[n];
      let o = Math.max(r, a.start);
      let s = Math.min(i, a.start + a.bytes.length);
      if (o < s) {
        a.bytes.set(t.subarray(o - r, s - r), o - a.start);
      }
      for (let e = 0; e < a.holes.length; e++) {
        let t = a.holes[e];
        if (r <= t.start && i > t.start) {
          t.start = i;
        }
        if (t.end <= t.start) {
          a.holes.splice(e, 1);
          e--;
        }
      }
      if (a.holes.length === 0) {
        a.resolve(a.bytes);
        e.pendingSlices.splice(n, 1);
        n--;
      }
    }
    for (let t = 0; t < this.workers.length; t++) {
      let n = this.workers[t];
      if (e !== n && !n.running) {
        if (ze(r, i, n.currentPos, n.targetPos)) {
          this.workers.splice(t, 1);
          t--;
        }
      }
    }
  }
  supplyFileSize(e) {
    n(this.fileSize === null);
    this.fileSize = e;
    for (let t of this.workers) {
      t.targetPos = Math.min(t.targetPos, e);
      t.strictTarget = true;
      for (let n = 0; n < t.pendingSlices.length; n++) {
        let r = t.pendingSlices[n];
        for (let i of r.holes) {
          if (i.end > e) {
            r.resolve(null);
            t.pendingSlices.splice(n, 1);
            n--;
            break;
          }
        }
      }
    }
    for (let t = 0; t < this.queuedReads.length; t++) {
      let n = this.queuedReads[t];
      if (n.hole.start >= e) {
        for (let e of n.pendingSlices) {
          e.resolve(null);
        }
        this.queuedReads.splice(t, 1);
        t--;
      } else if (n.hole.end > e) {
        n.hole.end = e;
        n.strictTarget = true;
        for (let t = 0; t < n.pendingSlices.length; t++) {
          let r = n.pendingSlices[t];
          if (r.start >= e) {
            r.resolve(null);
            n.pendingSlices.splice(t, 1);
            t--;
          }
        }
      }
    }
  }
  signalWorkerStoppedRunning(e) {
    e.running = false;
    e.pendingSlices.length = 0;
  }
  onWorkerFinished(e) {
    let t = this.workers.indexOf(e);
    n(t !== -1);
    e.running = false;
    this.workers.splice(t, 1);
    if (this.fileSize === null) {
      this.supplyFileSize(e.currentPos);
    }
    for (let t of e.pendingSlices) {
      t.resolve(null);
    }
  }
  insertIntoCache(e) {
    if (this.options.maxCacheSize === 0) {
      return;
    }
    let t = T(this.cache, e.start, e => {
      return e.start;
    }) + 1;
    if (t > 0) {
      let n = this.cache[t - 1];
      if (n.end >= e.end) {
        return;
      }
      if (n.end > e.start) {
        let r = new Uint8Array(e.end - n.start);
        r.set(n.bytes, 0);
        r.set(e.bytes, e.start - n.start);
        this.currentCacheSize += e.end - n.end;
        n.bytes = r;
        n.view = u(r);
        n.end = e.end;
        t--;
        e = n;
      } else {
        this.cache.splice(t, 0, e);
        this.currentCacheSize += e.bytes.length;
      }
    } else {
      this.cache.splice(t, 0, e);
      this.currentCacheSize += e.bytes.length;
    }
    for (let n = t + 1; n < this.cache.length; n++) {
      let t = this.cache[n];
      if (e.end <= t.start) {
        break;
      }
      if (e.end >= t.end) {
        this.cache.splice(n, 1);
        this.currentCacheSize -= t.bytes.length;
        n--;
        continue;
      }
      let r = new Uint8Array(t.end - e.start);
      r.set(e.bytes, 0);
      r.set(t.bytes, t.start - e.start);
      this.currentCacheSize -= e.end - t.start;
      e.bytes = r;
      e.view = u(r);
      e.end = t.end;
      this.cache.splice(n, 1);
      break;
    }
    while (this.currentCacheSize > this.options.maxCacheSize) {
      let e = 0;
      let t = this.cache[0];
      for (let n = 1; n < this.cache.length; n++) {
        let r = this.cache[n];
        if (r.age < t.age) {
          e = n;
          t = r;
        }
      }
      if (this.currentCacheSize - t.bytes.length <= this.options.maxCacheSize) {
        break;
      }
      this.cache.splice(e, 1);
      this.currentCacheSize -= t.bytes.length;
    }
  }
  dispose() {
    for (let e of this.workers) {
      e.aborted = true;
    }
    this.workers.length = 0;
    this.cache.length = 0;
    this.disposed = true;
  }
};
var _o = class extends Za {
  constructor(e, t, n) {
    super();
    this._ref = null;
    if (e._disposed) {
      throw Error(`Cannot create a slice of a disposed source.`);
    }
    this._baseSource = e;
    this._offset = t;
    this._length = n ?? null;
  }
  _getFileSize() {
    let e = this._baseSource._getFileSize();
    if (e === undefined) {
      if (this._length === null) {
        return undefined;
      } else {
        return this._length;
      }
    } else if (e === null) {
      if (this._length === null) {
        return null;
      } else {
        return this._length;
      }
    } else {
      return O(e - this._offset, 0, this._length ?? Infinity);
    }
  }
  _read(e, t, n, r) {
    if (this._length !== null && t > this._length) {
      return null;
    }
    let i = this._baseSource._read(this._offset + e, this._offset + t, this._offset + n, this._offset + r);
    let a = e => {
      if (e) {
        e.offset -= this._offset;
        return e;
      } else {
        return null;
      }
    };
    if (i instanceof Promise) {
      return i.then(a);
    } else {
      return a(i);
    }
  }
  _dispose() {
    this._ref?.free();
  }
  ref() {
    this._ref ??= this._baseSource.ref();
    return super.ref();
  }
};
function vo(e, t, n) {
  if (t != null) {
    if (typeof t != `object` && typeof t != `function`) {
      throw TypeError(`Object expected.`);
    }
    var r;
    var i;
    if (n) {
      if (!Symbol.asyncDispose) {
        throw TypeError(`Symbol.asyncDispose is not defined.`);
      }
      r = t[Symbol.asyncDispose];
    }
    if (r === undefined) {
      if (!Symbol.dispose) {
        throw TypeError(`Symbol.dispose is not defined.`);
      }
      r = t[Symbol.dispose];
      if (n) {
        i = r;
      }
    }
    if (typeof r != `function`) {
      throw TypeError(`Object not disposable.`);
    }
    if (i) {
      r = function () {
        try {
          i.call(this);
        } catch (e) {
          return Promise.reject(e);
        }
      };
    }
    e.stack.push({
      value: t,
      dispose: r,
      async: n
    });
  } else if (n) {
    e.stack.push({
      async: true
    });
  }
  return t;
}
var yo = function (e) {
  return function (t) {
    function n(n) {
      if (t.hasError) {
        t.error = new e(n, t.error, `An error was suppressed during disposal.`);
      } else {
        t.error = n;
      }
      t.hasError = true;
    }
    var r;
    var i = 0;
    function a() {
      while (r = t.stack.pop()) {
        try {
          if (!r.async && i === 1) {
            i = 0;
            t.stack.push(r);
            return Promise.resolve().then(a);
          }
          if (r.dispose) {
            var e = r.dispose.call(r.value);
            if (r.async) {
              i |= 2;
              return Promise.resolve(e).then(a, function (e) {
                n(e);
                return a();
              });
            }
          } else {
            i |= 1;
          }
        } catch (e) {
          n(e);
        }
      }
      if (i === 1) {
        if (t.hasError) {
          return Promise.reject(t.error);
        } else {
          return Promise.resolve();
        }
      }
      if (t.hasError) {
        throw t.error;
      }
    }
    return a();
  };
}(typeof SuppressedError == `function` ? SuppressedError : function (e, t, n) {
  var r = Error(n);
  r.name = `SuppressedError`;
  r.error = e;
  r.suppressed = t;
  return r;
});
var bo = /^0[xX][0-9a-fA-F]+$/;
var xo = /^data:.*;base64,/i;
var So = class extends Ha {
  constructor(e, t, n, r) {
    super(e.input, t, n);
    this.segments = [];
    this.nextLines = null;
    this.currentUpdateSegmentsPromise = null;
    this.streamHasEnded = false;
    this.lastSegmentUpdateTime = -Infinity;
    this.refreshInterval = 5;
    this.rootPath = t;
    this.demuxer = e;
    this.nextLines = r;
  }
  runUpdateSegments() {
    return this.currentUpdateSegmentsPromise ??= (async () => {
      try {
        let e = this.getRemainingWaitTimeMs();
        if (e > 0) {
          await ct(e);
        }
        this.lastSegmentUpdateTime = performance.now();
        await this.updateSegments();
      } finally {
        this.currentUpdateSegmentsPromise = null;
      }
    })();
  }
  getRemainingWaitTimeMs() {
    let e = performance.now() - this.lastSegmentUpdateTime;
    let t = Math.max(0, this.refreshInterval * 1000 - e);
    if (t <= 50) {
      return 0;
    } else {
      return t;
    }
  }
  async updateSegments() {
    let e = this.nextLines;
    this.nextLines = null;
    if (!e) {
      let t = {
        stack: [],
        error: undefined,
        hasError: false
      };
      try {
        let r = vo(t, await this.demuxer.input._getSourceUncached({
          path: this.rootPath,
          isRoot: false
        }), false);
        let i = await new dl(r.source).requestEntireFile();
        n(i);
        e = Dl(i, i.length, {
          ignore: Ba
        });
        if (r.source instanceof $a) {
          this.rootPath = r.source.rootPath;
        }
      } catch (e) {
        t.error = e;
        t.hasError = true;
      } finally {
        yo(t);
      }
    }
    let t = this.input._formatOptions.hls?.offsetTimestampsByDateTime !== false;
    let r = false;
    let a = 0;
    let o = null;
    let s = null;
    let c = null;
    let l = 0;
    let d = null;
    let f = null;
    let p = null;
    let m = null;
    let h = null;
    let g = null;
    let _ = false;
    let v = i(this.segments) ?? null;
    let y = e => {
      let t = e.indexOf(`@`);
      let n = Number(t === -1 ? e : e.slice(0, t));
      if (!Number.isInteger(n) || n < 0) {
        throw Error(`Invalid #EXT-X-BYTERANGE length '${e}'.`);
      }
      let r = null;
      r = Number(e.slice(t + 1));
      if (t !== -1 && (!Number.isInteger(r) || r < 0)) {
        throw Error(`Invalid #EXT-X-BYTERANGE offset '${e}'.`);
      }
      return {
        length: n,
        offset: r
      };
    };
    let b = e => {
      l = e;
      if (v) {
        n(v.sequenceNumber !== null);
        if (v.sequenceNumber < e) {
          a = v.timestamp + v.duration;
          d = v.firstSegment;
          f = v.initSegment;
          h = v.lastProgramDateTimeSeconds;
          if (v.unixEpochTimestamp === null) {
            o = null;
          } else {
            o = v.unixEpochTimestamp + v.duration;
          }
          v = null;
        }
      }
    };
    for (let n = 0; n < e.length; n++) {
      let x = e[n];
      if (!r) {
        if (x !== `#EXTM3U`) {
          throw Error(`Invalid M3U8 file; expected first line to be #EXTM3U.`);
        }
        r = true;
        continue;
      }
      if (!x.startsWith(`#`)) {
        if (!v) {
          if (s === null) {
            throw Error(`Invalid M3U8 file; a segment must be preceded by an #EXTINF tag.`);
          }
          let e = c;
          if (e && e.method === `AES-128` && !e.iv) {
            let t = new Uint8Array(16);
            let n = u(t);
            n.setUint32(8, Math.floor(l / 4294967296));
            n.setUint32(12, l);
            e = {
              ...e,
              iv: t
            };
          }
          let t = {
            path: qe(this.rootPath, x),
            offset: m?.offset ?? 0,
            length: m?.length ?? null
          };
          let n = {
            timestamp: a,
            unixEpochTimestamp: o,
            firstSegment: d,
            sequenceNumber: l,
            location: t,
            duration: s,
            encryption: e,
            initSegment: f,
            lastProgramDateTimeSeconds: h
          };
          d ??= n;
          a += s;
          if (o !== null) {
            o += s;
          }
          this.segments.push(n);
        }
        s = null;
        if (m === null) {
          p = null;
        } else {
          m = null;
        }
        b(l + 1);
      }
      if (x.startsWith(`#EXTINF:`)) {
        if (v) {
          _ = true;
          continue;
        }
        if (h === null && l > 0 && g !== null) {
          a = l * g;
        }
        _ ||= true;
        let e = x.slice(Na.length);
        let t = e.indexOf(`,`);
        let n = t === -1 ? e : e.slice(0, t);
        let r = Number(n);
        if (!Number.isFinite(r) || r < 0) {
          throw Error(`Invalid #EXTINF tag duration '${n}'.`);
        }
        s = r;
      } else if (x.startsWith(`#EXT-X-MAP:`)) {
        let e = new Va(x.slice(Pa.length));
        let t = e.get(`uri`);
        if (!t) {
          throw Error(`Invalid #EXT-X-MAP tag; missing URI attribute.`);
        }
        let n = e.get(`byterange`);
        let r = null;
        if (n !== null) {
          r = y(n);
        }
        if (r && r.offset === null) {
          throw Error(`Invalid #EXT-X-MAP tag; BYTERANGE attribute must have a specified offset.`);
        }
        if (!v) {
          let e = {
            path: qe(this.rootPath, t),
            offset: r?.offset ?? 0,
            length: r?.length ?? null
          };
          if (c?.method === `AES-128` && !c.iv) {
            throw Error(`IV attribute must be set on #EXT-X-KEY tag preceding the #EXT-X-MAP tag.`);
          }
          f = {
            timestamp: a,
            unixEpochTimestamp: o,
            firstSegment: null,
            sequenceNumber: null,
            location: e,
            duration: 0,
            encryption: c,
            initSegment: null,
            lastProgramDateTimeSeconds: h
          };
        }
        s = null;
        if (m === null) {
          p = null;
        } else {
          m = null;
        }
      } else if (x.startsWith(`#EXT-X-KEY:`)) {
        let e = new Va(x.slice(Fa.length));
        let t = e.get(`method`);
        if (t === `NONE`) {
          c = null;
        } else if (t === `AES-128`) {
          let t = e.get(`uri`);
          if (!t) {
            throw Error(`Invalid #EXT-X-KEY: AES-128 requires a URI attribute.`);
          }
          let n = null;
          let r = e.get(`iv`);
          if (r) {
            if (!bo.test(r)) {
              throw Error(`Unsupported IV format '${r}'.`);
            }
            let e = r.slice(2);
            e = e.padStart(32, `0`);
            n = new Uint8Array(16);
            for (let t = 0; t < 16; t++) {
              let r = -32 + t;
              n[t] = parseInt(e.slice(r, r + 2), 16);
            }
          }
          let i = e.get(`keyformat`) ?? `identity`;
          if (i !== `identity`) {
            throw Error(`For AES-128 encryption, only the 'identity' KEYFORMAT is currently supported. If you think other formats should be supported, please raise an issue.`);
          }
          c = {
            method: `AES-128`,
            keyUri: qe(this.rootPath, t),
            iv: n,
            keyFormat: i
          };
        } else if (t === `SAMPLE-AES` || t === `SAMPLE-AES-CTR`) {
          let n = e.get(`uri`);
          if (!n) {
            throw Error(`Invalid #EXT-X-KEY: ${t} requires a URI attribute.`);
          }
          if ((e.get(`keyformat`) ?? `identity`) === `identity`) {
            throw Error(`For SAMPLE-AES and SAMPLE-AES-CTR encryption, the 'identity' KEYFORMAT is not supported. If you think this format should be supported, please raise an issue.`);
          }
          let r = null;
          if (xo.test(n)) {
            let e = n.indexOf(`,`);
            let t = He(n.slice(e + 1));
            if (t.length >= 8 && t[4] === 112 && t[5] === 115 && t[6] === 115 && t[7] === 104) {
              let e = u(t).getUint32(0);
              r = xr(t.subarray(8, Math.min(e, t.length)));
            }
          }
          c = {
            method: t,
            psshBox: r
          };
        } else {
          throw Error(`Unsupported encryption method '${t}'. If you think this method should be supported, please raise an issue.`);
        }
      } else if (x.startsWith(`#EXT-X-MEDIA-SEQUENCE:`)) {
        let e = x.slice(Ia.length);
        let t = Number(e);
        if (!Number.isInteger(t) || t < 0) {
          throw Error(`Invalid EXT-X-MEDIA-SEQUENCE value '${e}'.`);
        }
        b(t);
      } else if (x.startsWith(`#EXT-X-BYTERANGE:`)) {
        let e = y(x.slice(La.length));
        if (e.offset === null) {
          if (p === null) {
            throw Error(`Invalid M3U8 file; #EXT-X-BYTERANGE without offset requires a previous byte range.`);
          }
          e.offset = p;
        }
        m = e;
        p = e.offset + e.length;
      } else if (x.startsWith(`#EXT-X-PROGRAM-DATE-TIME:`)) {
        if (v) {
          continue;
        }
        let e = x.slice(Ra.length);
        let n = Date.parse(e);
        if (!Number.isFinite(n)) {
          continue;
        }
        let r = n / 1000;
        if (h === r) {
          continue;
        }
        if (h === null && this.segments.length > 0) {
          let e = i(this.segments);
          let n = r - (e.timestamp + e.duration);
          for (let e of this.segments) {
            e.unixEpochTimestamp = e.timestamp + n;
            if (t) {
              e.timestamp = e.unixEpochTimestamp;
            }
          }
        }
        h = r;
        o = r;
        if (t) {
          a = r;
        }
      } else if (x === `#EXT-X-DISCONTINUITY`) {
        d = null;
      } else if (x.startsWith(`#EXT-X-TARGETDURATION:`)) {
        let e = x.slice(za.length);
        let t = Number(e);
        if (!Number.isFinite(t) || t < 0) {
          throw Error(`Invalid EXT-X-TARGETDURATION value '${e}'.`);
        }
        this.refreshInterval = t;
        g = t;
      } else if (x === `#EXT-X-ENDLIST`) {
        this.streamHasEnded = true;
        break;
      } else if (x.startsWith(`#EXT-X-PLAYLIST-TYPE:`) && x.slice(21).toLowerCase() === `vod`) {
        this.streamHasEnded = true;
      }
    }
    if (!r) {
      throw Error(`Invalid M3U8 file; no #EXTM3U header.`);
    }
  }
  async getFirstSegment() {
    if (this.segments.length === 0) {
      await this.runUpdateSegments();
    }
    return this.segments[0] ?? null;
  }
  async getSegmentAt(e, t) {
    if (this.segments.length === 0) {
      await this.runUpdateSegments();
    }
    let n = !!t.skipLiveWait && this.getRemainingWaitTimeMs() > 0;
    while (true) {
      let r = T(this.segments, e, e => {
        return e.timestamp;
      });
      if (r === -1) {
        return null;
      }
      if (r < this.segments.length - 1 || this.streamHasEnded || n) {
        return this.segments[r];
      }
      let i = this.segments[r];
      if (e < i.timestamp + i.duration) {
        return i;
      }
      await this.runUpdateSegments();
      if (t.skipLiveWait) {
        n = true;
      }
    }
  }
  async getNextSegment(e, t) {
    let r = this.segments.indexOf(e);
    n(r !== -1);
    let i = r + 1;
    let a = !!t.skipLiveWait && this.getRemainingWaitTimeMs() > 0;
    while (true) {
      if (i < this.segments.length) {
        return this.segments[i];
      }
      if (this.streamHasEnded || a) {
        return null;
      }
      await this.runUpdateSegments();
      if (t.skipLiveWait) {
        a = true;
      }
    }
  }
  async getPreviousSegment(e) {
    let t = this.segments.indexOf(e);
    n(t !== -1);
    return this.segments[t - 1] ?? null;
  }
  getInputForSegment(e) {
    let t = e;
    let r = this.inputCache.find(e => {
      return e.segment === t;
    });
    if (r) {
      r.age = this.nextInputCacheAge++;
      return r.input;
    }
    let i = null;
    if (t.initSegment || t.firstSegment) {
      i = this.getInputForSegment(t.initSegment ?? t.firstSegment);
    }
    let a = {
      ...this.input._formatOptions,
      isobmff: {
        ...this.input._formatOptions.isobmff,
        resolveKeyId: this.input._formatOptions.isobmff?.resolveKeyId && (e => {
          if (!t.encryption || t.encryption.method !== `SAMPLE-AES` && t.encryption.method !== `SAMPLE-AES-CTR` || !t.encryption.psshBox) {
            return this.input._formatOptions.isobmff.resolveKeyId(e);
          }
          let n = e.psshBoxes;
          let {
            psshBox: r
          } = t.encryption;
          if ((r.keyIds === null || r.keyIds.includes(e.keyId)) && !n.some(e => {
            return Sr(e, r);
          })) {
            n = [...n, r];
          }
          return this.input._formatOptions.isobmff.resolveKeyId({
            ...e,
            psshBoxes: n
          });
        })
      }
    };
    let o = new cl({
      source: new to(t.location.path, async e => {
        n(e.isRoot);
        let r = {
          ...e,
          isRoot: false
        };
        let i;
        let a = t.location.offset > 0 || t.location.length !== null;
        if (!t.encryption || t.encryption.method === `SAMPLE-AES` || t.encryption.method === `SAMPLE-AES-CTR`) {
          i = await this.input._getSourceCached(r);
          if (a) {
            let e = i.source.slice(t.location.offset, t.location.length ?? undefined).ref();
            i.free();
            i = e;
          }
        } else if (t.encryption.method === `AES-128`) {
          let e = t.encryption;
          n(e.iv);
          let o = await this.input._getSourceCached(r);
          if (a) {
            let e = o.source.slice(t.location.offset, t.location.length ?? undefined).ref();
            o.free();
            o = e;
          }
          i = new mo(zr(new dl(o.source), async () => {
            let t = {
              stack: [],
              error: undefined,
              hasError: false
            };
            try {
              let n = await new dl(vo(t, await this.input._getSourceCached({
                path: e.keyUri,
                isRoot: false
              }, 2), false).source).requestSlice(0, 16);
              if (!n) {
                throw Error(`Invalid AES-128 key; expected at least 16 bytes of data.`);
              }
              return {
                key: B(n, 16),
                iv: e.iv
              };
            } catch (e) {
              t.error = e;
              t.hasError = true;
            } finally {
              yo(t);
            }
          }, () => {
            o.free();
          })).ref();
        } else {
          n(false);
        }
        return i;
      }),
      formats: this.input._formats.filter(e => {
        return !(e instanceof Ho);
      }),
      initInput: i ?? undefined,
      formatOptions: a
    });
    o._onFormatDetermined = e => {
      if ((t.encryption?.method === `SAMPLE-AES` || t.encryption?.method === `SAMPLE-AES-CTR`) && !e._isIsobmff) {
        throw Error(`The SAMPLE-AES and SAMPLE-AES-CTR encryption methods are currently only supported for ISOBMFF files.`);
      }
    };
    this.inputCache.push({
      segment: t,
      input: o,
      age: this.nextInputCacheAge++
    });
    if (this.inputCache.length > 4) {
      let e = Ye(this.inputCache, e => {
        return e.age;
      });
      n(e !== -1);
      this.inputCache.splice(e, 1);
    }
    return o;
  }
  async getLiveRefreshInterval() {
    if (this.getRemainingWaitTimeMs() === 0) {
      await this.runUpdateSegments();
    }
    if (this.streamHasEnded) {
      return null;
    } else {
      return this.refreshInterval;
    }
  }
};
var Co = class extends vr {
  constructor(e) {
    super(e);
    this.metadataPromise = null;
    this.trackBackings = null;
    this.internalTracks = null;
    this.segmentedInputs = [];
    this.hasMasterPlaylist = true;
  }
  readMetadata() {
    return this.metadataPromise ??= (async () => {
      n(this.input._rootSource instanceof $a);
      let e = await this.input._reader.requestEntireFile();
      n(e);
      let t = Dl(e, e.length, {
        ignore: Ba
      });
      let {
        rootPath: r
      } = this.input._rootSource;
      let i = [];
      let a = [];
      for (let e = 1; e < t.length; e++) {
        let n = t[e];
        if (n.startsWith(`#EXT-X-STREAM-INF:`)) {
          let a = e;
          let o = t[++e];
          if (o === undefined) {
            throw Error(`Incorrect M3U8 file; a line must follow the #EXT-X-STREAM-INF tag.`);
          }
          let s = qe(r, o);
          let c = new Va(n.slice(Aa.length));
          if (c.getAsNumber(`bandwidth`) === null) {
            throw Error(`Invalid M3U8 file; #EXT-X-STREAM-INF tag requires a BANDWIDTH attribute with a valid numerical value.`);
          }
          i.push({
            fullPath: s,
            attributes: c,
            lineNumber: a,
            hasOnlyKeyPackets: false
          });
        } else if (n.startsWith(`#EXT-X-I-FRAME-STREAM-INF:`)) {
          let t = new Va(n.slice(ja.length));
          let a = t.get(`uri`);
          if (a === null) {
            throw Error(`Invalid M3U8 file; #EXT-X-I-FRAME-STREAM-INF tag requires a URI attribute.`);
          }
          if (t.getAsNumber(`bandwidth`) === null) {
            throw Error(`Invalid M3U8 file; #EXT-X-I-FRAME-STREAM-INF tag requires a BANDWIDTH attribute with a valid numerical value.`);
          }
          let o = qe(r, a);
          i.push({
            fullPath: o,
            attributes: t,
            lineNumber: e,
            hasOnlyKeyPackets: true
          });
        } else if (n.startsWith(`#EXT-X-MEDIA:`)) {
          let t = new Va(n.slice(Ma.length));
          if (t.get(`type`) === null) {
            throw Error(`Invalid M3U8 file; #EXT-X-MEDIA tag requires a TYPE attribute.`);
          }
          if (t.get(`group-id`) === null) {
            throw Error(`Invalid M3U8 file; #EXT-X-MEDIA tag requires a GROUP-ID attribute.`);
          }
          let i = null;
          let o = t.get(`uri`);
          if (o !== null) {
            i = qe(r, o);
          }
          a.push({
            fullPath: i,
            attributes: t,
            lineNumber: e
          });
        } else if (n !== `#EXT-X-I-FRAMES-ONLY` && n.startsWith(`#EXTINF:`)) {
          let e = new So(this, r, null, t);
          this.segmentedInputs = [e];
          this.hasMasterPlaylist = false;
          this.trackBackings = await e.getTrackBackings();
          return;
        }
      }
      let o = [...new Set(a.filter(e => {
        return e.attributes.get(`type`).toLowerCase() === `video`;
      }).map(e => {
        return e.attributes.get(`group-id`);
      }))];
      let s = [...new Set(a.filter(e => {
        return e.attributes.get(`type`).toLowerCase() === `audio`;
      }).map(e => {
        return e.attributes.get(`group-id`);
      }))];
      let c = await Promise.all(i.map(async (e, t) => {
        let i = [];
        let c = e.attributes.get(`codecs`);
        let l;
        if (c) {
          l = c.split(`,`).map(e => {
            return e.trim();
          });
        } else {
          let t = await this.getSegmentedInputForPath(e.fullPath).getTrackBackings();
          let n = await Promise.all(t.map(async e => {
            return {
              track: e,
              codec: await e.getCodec()
            };
          }));
          l = await Promise.all(n.filter(e => {
            return e.codec !== null;
          }).map(e => {
            return e.track.getDecoderConfig().then(e => {
              return e.codec;
            });
          }));
        }
        let u = e.attributes.get(`video`);
        let d = e.attributes.get(`audio`);
        let f = l.some(e => {
          return j.includes(qt(e));
        });
        let p = l.some(e => {
          return N.includes(qt(e));
        });
        if (u !== null && !f) {
          if (!o.includes(u)) {
            throw Error(`Invalid M3U8 file; variant stream references video group "${u}" which is not defined in any #EXT-X-MEDIA tags.`);
          }
          let e = a.find(e => {
            let t = e.attributes.get(`group-id`);
            let n = e.attributes.get(`type`);
            return t === u && n.toLowerCase() === `video`;
          });
          outer: if (e) {
            let t = e.attributes.get(`uri`);
            if (t === null) {
              break outer;
            }
            let i = qe(r, t);
            let a = (await this.getSegmentedInputForPath(i).getTrackBackings()).find(e => {
              return e.getType() === `video`;
            });
            if (!a || (await a.getCodec()) === null) {
              break outer;
            }
            let o = await a.getDecoderConfig().then(e => {
              return e?.codec ?? null;
            });
            n(o !== null);
            l.push(o);
          }
        }
        if (d !== null && !p) {
          if (!s.includes(d)) {
            throw Error(`Invalid M3U8 file; variant stream references audio group "${d}" which is not defined in any #EXT-X-MEDIA tags.`);
          }
          let e = a.find(e => {
            let t = e.attributes.get(`group-id`);
            let n = e.attributes.get(`type`);
            return t === d && n.toLowerCase() === `audio`;
          });
          outer: if (e) {
            let t = e.attributes.get(`uri`);
            if (t === null) {
              break outer;
            }
            let i = qe(r, t);
            let a = (await this.getSegmentedInputForPath(i).getTrackBackings()).find(e => {
              return e.getType() === `audio`;
            });
            if (!a || (await a.getCodec()) === null) {
              break outer;
            }
            let o = await a.getDecoderConfig().then(e => {
              return e?.codec ?? null;
            });
            n(o !== null);
            l.push(o);
          }
        }
        l = [...new Set(l)];
        let m = null;
        let h = null;
        let g = e.attributes.getAsNumber(`bandwidth`);
        n(g !== null);
        let _ = e.attributes.getAsNumber(`average-bandwidth`);
        let v = e.attributes.get(`name`);
        for (let n of l) {
          let r = qt(n);
          if (r !== null) {
            if (j.includes(r)) {
              if (m !== null) {
                throw Error(`Unsupported M3U8 file; multiple video codecs found in the CODECS attribute of a variant stream.`);
              }
              m = n;
              let r = e.attributes.get(`video`);
              if (r === null) {
                let n = e.attributes.get(`resolution`);
                let r = null;
                let a = null;
                if (n) {
                  let e = n.match(/^(\d+)x(\d+)$/);
                  if (e) {
                    r = Number(e[1]);
                    a = Number(e[2]);
                  }
                }
                i.push({
                  id: -1,
                  demuxer: this,
                  backingTrack: null,
                  default: true,
                  autoselect: true,
                  languageCode: `und`,
                  lineNumber: e.lineNumber,
                  fullPath: e.fullPath,
                  fullCodecString: m,
                  pairingMask: 1n << BigInt(t),
                  peakBitrate: g,
                  averageBitrate: _,
                  name: v,
                  hasOnlyKeyPackets: e.hasOnlyKeyPackets,
                  info: {
                    type: `video`,
                    width: r,
                    height: a
                  }
                });
              } else {
                if (!o.includes(r)) {
                  throw Error(`Invalid M3U8 file; variant stream references video group "${r}" which is not defined in any #EXT-X-MEDIA tags.`);
                }
                for (let n of a) {
                  let a = n.attributes.get(`group-id`);
                  let o = n.attributes.get(`type`);
                  if (a !== r || o.toLowerCase() !== `video`) {
                    continue;
                  }
                  let s = n.attributes.get(`resolution`) ?? e.attributes.get(`resolution`);
                  let c = null;
                  let l = null;
                  if (s) {
                    let e = s.match(/^(\d+)x(\d+)$/);
                    if (e) {
                      c = Number(e[1]);
                      l = Number(e[2]);
                    }
                  }
                  i.push({
                    id: -1,
                    demuxer: this,
                    backingTrack: null,
                    default: Do(n.attributes),
                    autoselect: Do(n.attributes) || Oo(n.attributes),
                    languageCode: ko(n.attributes.get(`language`)),
                    lineNumber: n.lineNumber,
                    fullPath: n.fullPath ?? e.fullPath,
                    fullCodecString: m,
                    pairingMask: 1n << BigInt(t),
                    peakBitrate: null,
                    averageBitrate: null,
                    name: n.attributes.get(`name`),
                    hasOnlyKeyPackets: e.hasOnlyKeyPackets,
                    info: {
                      type: `video`,
                      width: c,
                      height: l
                    }
                  });
                }
              }
            } else if (N.includes(r)) {
              if (h !== null) {
                throw Error(`Unsupported M3U8 file; multiple audio codecs found in the CODECS attribute of a variant stream.`);
              }
              h = n;
              let r = e.attributes.get(`audio`);
              if (r === null) {
                let n = e.attributes.get(`channels`);
                let r = n === null ? null : Number(n.split(`/`)[0]);
                i.push({
                  id: -1,
                  demuxer: this,
                  backingTrack: null,
                  default: true,
                  autoselect: true,
                  languageCode: `und`,
                  lineNumber: e.lineNumber,
                  fullPath: e.fullPath,
                  fullCodecString: h,
                  pairingMask: 1n << BigInt(t),
                  peakBitrate: g,
                  averageBitrate: _,
                  name: v,
                  hasOnlyKeyPackets: e.hasOnlyKeyPackets,
                  info: {
                    type: `audio`,
                    numberOfChannels: r !== null && Number.isInteger(r) && r > 0 ? r : null
                  }
                });
              } else {
                if (!s.includes(r)) {
                  throw Error(`Invalid M3U8 file; variant stream references audio group "${r}" which is not defined in any #EXT-X-MEDIA tags.`);
                }
                for (let n of a) {
                  let a = n.attributes.get(`group-id`);
                  let o = n.attributes.get(`type`);
                  if (a !== r || o.toLowerCase() !== `audio`) {
                    continue;
                  }
                  let s = n.attributes.get(`channels`) ?? e.attributes.get(`channels`);
                  let c = s === null ? null : Number(s.split(`/`)[0]);
                  i.push({
                    id: -1,
                    demuxer: this,
                    backingTrack: null,
                    default: Do(n.attributes),
                    autoselect: Do(n.attributes) || Oo(n.attributes),
                    languageCode: ko(n.attributes.get(`language`)),
                    lineNumber: n.lineNumber,
                    fullPath: n.fullPath ?? e.fullPath,
                    fullCodecString: h,
                    pairingMask: 1n << BigInt(t),
                    peakBitrate: null,
                    averageBitrate: null,
                    name: n.attributes.get(`name`),
                    hasOnlyKeyPackets: e.hasOnlyKeyPackets,
                    info: {
                      type: `audio`,
                      numberOfChannels: c !== null && Number.isInteger(c) && c > 0 ? c : null
                    }
                  });
                }
              }
            }
          }
        }
        return i;
      }));
      let l = [];
      let u = e => {
        let t = l.find(t => {
          return t.fullPath === e.fullPath && t.info.type === e.info.type;
        });
        if (t) {
          t.pairingMask |= e.pairingMask;
          t.default ||= e.default;
          t.autoselect ||= e.autoselect;
          t.lineNumber = Math.min(t.lineNumber, e.lineNumber);
          if (e.peakBitrate !== null) {
            t.peakBitrate = Math.max(t.peakBitrate ?? -Infinity, e.peakBitrate);
          }
          if (e.averageBitrate !== null) {
            t.averageBitrate = Math.max(t.averageBitrate ?? -Infinity, e.averageBitrate);
          }
          if (t.languageCode === `und`) {
            t.languageCode = e.languageCode;
          }
        } else {
          e.id = l.length + 1;
          l.push(e);
        }
      };
      for (let e of c) {
        for (let t of e) {
          u(t);
        }
      }
      l.sort((e, t) => {
        return e.lineNumber - t.lineNumber;
      });
      this.trackBackings = [];
      for (let e of l) {
        if (e.info.type === `video`) {
          this.trackBackings.push(new To(e));
        } else {
          this.trackBackings.push(new Eo(e));
        }
      }
      this.internalTracks = l;
    })();
  }
  async getTrackBackings() {
    await this.readMetadata();
    n(this.trackBackings);
    return this.trackBackings;
  }
  getSegmentedInputForPath(e) {
    let t = this.segmentedInputs.find(t => {
      return t.path === e;
    });
    if (t) {
      return t;
    }
    let n = null;
    if (this.internalTracks) {
      n = this.internalTracks.filter(t => {
        return t.fullPath === e;
      }).map(e => {
        return {
          id: e.id,
          type: e.info.type
        };
      });
    }
    t = new So(this, e, n, null);
    this.segmentedInputs.push(t);
    return t;
  }
  async getMetadataTags() {
    return {};
  }
  async getMimeType() {
    return ka;
  }
  dispose() {
    if (this.segmentedInputs) {
      for (let e of this.segmentedInputs) {
        e.dispose();
      }
      this.segmentedInputs.length = 0;
    }
  }
};
var wo = class {
  constructor(e) {
    this.internalTrack = e;
    this.hydrationPromise = null;
  }
  hydrate() {
    return this.hydrationPromise ??= (async () => {
      let e = this.internalTrack.demuxer.getSegmentedInputForPath(this.internalTrack.fullPath);
      let t = null;
      let r = (await e.getTrackBackings()).filter(e => {
        return e.getType() === this.getType();
      });
      if (r.length === 1) {
        t = r[0];
      } else if (this instanceof To) {
        for (let e of r) {
          if ((await e.getCodec()) === this.getCodec()) {
            t = e;
            break;
          }
        }
      } else {
        n(this instanceof Eo);
        for (let e of r) {
          if ((await e.getCodec()) === this.getCodec()) {
            t = e;
            break;
          }
        }
      }
      if (!t) {
        throw Error(`Could not find matching track in underlying media data.`);
      }
      this.internalTrack.backingTrack = t;
    })();
  }
  delegate(e) {
    if (this.internalTrack.backingTrack) {
      return e();
    } else {
      return this.hydrate().then(e);
    }
  }
  getCodec() {
    throw Error(`Not implemented on base class.`);
  }
  getDisposition() {
    return {
      ...yt,
      default: this.internalTrack.autoselect,
      primary: this.internalTrack.default
    };
  }
  getId() {
    return this.internalTrack.id;
  }
  getPairingMask() {
    return this.internalTrack.pairingMask;
  }
  getInternalCodecId() {
    return null;
  }
  getLanguageCode() {
    return this.internalTrack.languageCode;
  }
  getName() {
    return this.internalTrack.name;
  }
  getNumber() {
    n(this.internalTrack.demuxer.internalTracks);
    let e = this.internalTrack.info.type;
    let t = 0;
    for (let n of this.internalTrack.demuxer.internalTracks) {
      if (n.info.type === e) {
        t++;
      }
      if (n === this.internalTrack) {
        break;
      }
    }
    return t;
  }
  getTimeResolution() {
    return this.delegate(() => {
      return this.internalTrack.backingTrack.getTimeResolution();
    });
  }
  isRelativeToUnixEpoch() {
    return this.delegate(() => {
      return this.internalTrack.backingTrack.isRelativeToUnixEpoch();
    });
  }
  getUnixTimeForTimestamp(e) {
    return this.delegate(() => {
      return this.internalTrack.backingTrack.getUnixTimeForTimestamp(e);
    });
  }
  getBitrate() {
    return this.internalTrack.peakBitrate;
  }
  getAverageBitrate() {
    return this.internalTrack.averageBitrate;
  }
  async getDurationFromMetadata(e) {
    await this.hydrate();
    return this.internalTrack.backingTrack.getDurationFromMetadata(e);
  }
  async getLiveRefreshInterval() {
    await this.hydrate();
    return this.internalTrack.backingTrack.getLiveRefreshInterval();
  }
  getHasOnlyKeyPackets() {
    return this.internalTrack.hasOnlyKeyPackets || null;
  }
  async getFirstPacket(e) {
    await this.hydrate();
    return this.internalTrack.backingTrack.getFirstPacket(e);
  }
  async getPacket(e, t) {
    await this.hydrate();
    return this.internalTrack.backingTrack.getPacket(e, t);
  }
  async getKeyPacket(e, t) {
    await this.hydrate();
    return this.internalTrack.backingTrack.getKeyPacket(e, t);
  }
  async getNextPacket(e, t) {
    await this.hydrate();
    return this.internalTrack.backingTrack.getNextPacket(e, t);
  }
  async getNextKeyPacket(e, t) {
    await this.hydrate();
    return this.internalTrack.backingTrack.getNextKeyPacket(e, t);
  }
};
var To = class extends wo {
  constructor(e) {
    super(e);
  }
  get backingVideoTrack() {
    return this.internalTrack.backingTrack;
  }
  getType() {
    return `video`;
  }
  getCodec() {
    return qt(this.internalTrack.fullCodecString);
  }
  getCodedWidth() {
    return this.delegate(() => {
      return this.backingVideoTrack.getCodedWidth();
    });
  }
  getCodedHeight() {
    return this.delegate(() => {
      return this.backingVideoTrack.getCodedHeight();
    });
  }
  getSquarePixelWidth() {
    return this.delegate(() => {
      return this.backingVideoTrack.getSquarePixelWidth();
    });
  }
  getSquarePixelHeight() {
    return this.delegate(() => {
      return this.backingVideoTrack.getSquarePixelHeight();
    });
  }
  getMetadataDisplayWidth() {
    if (this.backingVideoTrack) {
      return null;
    } else {
      return this.internalTrack.info.width;
    }
  }
  getMetadataDisplayHeight() {
    if (this.backingVideoTrack) {
      return null;
    } else {
      return this.internalTrack.info.height;
    }
  }
  getRotation() {
    return this.delegate(() => {
      return this.backingVideoTrack.getRotation();
    });
  }
  async getColorSpace() {
    await this.hydrate();
    return this.backingVideoTrack.getColorSpace();
  }
  async canBeTransparent() {
    await this.hydrate();
    return this.backingVideoTrack.canBeTransparent();
  }
  getMetadataCodecParameterString() {
    if (this.backingVideoTrack) {
      return null;
    } else {
      return this.internalTrack.fullCodecString;
    }
  }
  async getDecoderConfig() {
    await this.hydrate();
    return this.backingVideoTrack.getDecoderConfig();
  }
};
var Eo = class extends wo {
  constructor(e) {
    super(e);
  }
  get backingAudioTrack() {
    return this.internalTrack.backingTrack;
  }
  getType() {
    return `audio`;
  }
  getCodec() {
    return qt(this.internalTrack.fullCodecString);
  }
  getNumberOfChannels() {
    if (this.internalTrack.info.numberOfChannels === null) {
      return this.delegate(() => {
        return this.backingAudioTrack.getNumberOfChannels();
      });
    } else {
      return this.internalTrack.info.numberOfChannels;
    }
  }
  getSampleRate() {
    return this.delegate(() => {
      return this.backingAudioTrack.getSampleRate();
    });
  }
  getMetadataCodecParameterString() {
    if (this.backingAudioTrack) {
      return null;
    } else {
      return this.internalTrack.fullCodecString;
    }
  }
  async getDecoderConfig() {
    await this.hydrate();
    return this.backingAudioTrack.getDecoderConfig();
  }
};
var Do = e => {
  let t = e.get(`default`);
  if (t === null) {
    return false;
  }
  let n = t.toUpperCase();
  if (n === `YES`) {
    return true;
  }
  if (n === `NO`) {
    return false;
  }
  throw Error(`Invalid M3U8 file; #EXT-X-MEDIA DEFAULT attribute must be YES or NO, got "${t}".`);
};
var Oo = e => {
  let t = e.get(`autoselect`);
  if (t === null) {
    return false;
  }
  let n = t.toUpperCase();
  if (n === `YES`) {
    return true;
  }
  if (n === `NO`) {
    return false;
  }
  throw Error(`Invalid M3U8 file; #EXT-X-MEDIA AUTOSELECT attribute must be YES or NO, got "${t}".`);
};
var ko = e => {
  if (e === null) {
    return `und`;
  } else {
    return e.split(`-`)[0] || `und`;
  }
};
var Ao = class {
  constructor() {
    this._isIsobmff = false;
  }
};
var jo = class extends Ao {
  constructor() {
    super(...arguments);
    this._isIsobmff = true;
  }
  async _getMajorBrand(e) {
    let t = e._reader.requestSlice(0, 12);
    if (t instanceof Promise) {
      t = await t;
    }
    if (!t) {
      return null;
    }
    t.skip(4);
    let n = W(t, 4);
    if (n !== `ftyp` && n !== `styp`) {
      return null;
    } else {
      return W(t, 4);
    }
  }
  _createDemuxer(e) {
    return new Br(e);
  }
};
var Mo = class extends jo {
  async _canReadInput(e) {
    let t = await this._getMajorBrand(e);
    if (t !== null) {
      return t !== `qt  `;
    }
    let n = e._reader.requestSlice(4, 4);
    if (n instanceof Promise) {
      n = await n;
    }
    if (!n) {
      return false;
    }
    let r = W(n, 4);
    return r === `moof` || r === `sidx`;
  }
  get name() {
    return `MP4`;
  }
  get mimeType() {
    return `video/mp4`;
  }
};
var No = class extends jo {
  async _canReadInput(e) {
    return (await this._getMajorBrand(e)) === `qt  `;
  }
  get name() {
    return `QuickTime File Format`;
  }
  get mimeType() {
    return `video/quicktime`;
  }
};
var Po = class extends Ao {
  async isSupportedEBMLOfDocType(e, t) {
    let n = e._reader.requestSlice(0, 16);
    if (n instanceof Promise) {
      n = await n;
    }
    if (!n) {
      return false;
    }
    let r = hi(n);
    if (r === null || r < 1 || r > 8 || R(n, r) !== L.EBML) {
      return false;
    }
    let i = yi(n);
    if (typeof i != `number`) {
      return false;
    }
    let a = e._reader.requestSlice(n.filePos, i);
    if (a instanceof Promise) {
      a = await a;
    }
    if (!a) {
      return false;
    }
    let o = n.filePos;
    while (a.filePos <= o + i - 2) {
      let e = bi(a);
      if (!e) {
        break;
      }
      let {
        id: n,
        size: r
      } = e;
      let i = a.filePos;
      if (r === undefined) {
        return false;
      }
      switch (n) {
        case L.EBMLVersion:
          {
            if (R(a, r) !== 1) {
              return false;
            }
            break;
          }
        case L.EBMLReadVersion:
          {
            if (R(a, r) !== 1) {
              return false;
            }
            break;
          }
        case L.DocType:
          {
            if (xi(a, r) !== t) {
              return false;
            }
            break;
          }
        case L.DocTypeVersion:
          {
            if (R(a, r) > 4) {
              return false;
            }
            break;
          }
      }
      a.filePos = i + r;
    }
    return true;
  }
  _canReadInput(e) {
    return this.isSupportedEBMLOfDocType(e, `matroska`);
  }
  _createDemuxer(e) {
    return new Pi(e);
  }
  get name() {
    return `Matroska`;
  }
  get mimeType() {
    return `video/x-matroska`;
  }
};
var Fo = class extends Po {
  _canReadInput(e) {
    return this.isSupportedEBMLOfDocType(e, `webm`);
  }
  get name() {
    return `WebM`;
  }
  get mimeType() {
    return `video/webm`;
  }
};
var Io = class extends Ao {
  async _canReadInput(e) {
    let t = 0;
    while (true) {
      let n = e._reader.requestSlice(t, 10);
      if (n instanceof Promise) {
        n = await n;
      }
      if (!n) {
        break;
      }
      let r = Ml(n);
      if (!r) {
        break;
      }
      t = n.filePos + r.size;
    }
    let n = await Ri(e._reader, t, t + 4096);
    if (!n) {
      return false;
    }
    let r = n.header;
    let i = dn(r.mpegVersionId, r.channel);
    let a = e._reader.requestSlice(n.startPos + i, 4);
    if (a instanceof Promise) {
      a = await a;
    }
    if (!a) {
      return false;
    }
    let o = U(a);
    if (o === 1483304551 || o === 1231971951) {
      return true;
    }
    t = n.startPos + n.header.totalSize;
    let s = await Ri(e._reader, t, t + 4);
    if (!s) {
      return false;
    }
    let c = s.header;
    return r.channel === c.channel && r.sampleRate === c.sampleRate;
  }
  _createDemuxer(e) {
    return new zi(e);
  }
  get name() {
    return `MP3`;
  }
  get mimeType() {
    return `audio/mpeg`;
  }
};
var Lo = class extends Ao {
  async _canReadInput(e) {
    let t = e._reader.requestSlice(0, 12);
    if (t instanceof Promise) {
      t = await t;
    }
    if (!t) {
      return false;
    }
    let n = W(t, 4);
    if (n !== `RIFF` && n !== `RIFX` && n !== `RF64`) {
      return false;
    } else {
      t.skip(4);
      return W(t, 4) === `WAVE`;
    }
  }
  _createDemuxer(e) {
    return new ta(e);
  }
  get name() {
    return `WAVE`;
  }
  get mimeType() {
    return `audio/wav`;
  }
};
var Ro = class extends Ao {
  async _canReadInput(e) {
    let t = e._reader.requestSlice(0, 4);
    if (t instanceof Promise) {
      t = await t;
    }
    if (t) {
      return W(t, 4) === `OggS`;
    } else {
      return false;
    }
  }
  _createDemuxer(e) {
    return new Xi(e);
  }
  get name() {
    return `Ogg`;
  }
  get mimeType() {
    return `application/ogg`;
  }
};
var zo = class extends Ao {
  async _canReadInput(e) {
    let t = 0;
    while (true) {
      let n = e._reader.requestSlice(t, 10);
      if (n instanceof Promise) {
        n = await n;
      }
      if (!n) {
        break;
      }
      let r = Ml(n);
      if (!r) {
        break;
      }
      t = n.filePos + r.size;
    }
    let n = e._reader.requestSlice(t, 4);
    if (n instanceof Promise) {
      n = await n;
    }
    if (n) {
      return W(n, 4) === `fLaC`;
    } else {
      return false;
    }
  }
  get name() {
    return `FLAC`;
  }
  get mimeType() {
    return `audio/flac`;
  }
  _createDemuxer(e) {
    return new ma(e);
  }
};
var Bo = class extends Ao {
  async _canReadInput(e) {
    let t = 0;
    while (true) {
      let n = e._reader.requestSlice(t, 10);
      if (n instanceof Promise) {
        n = await n;
      }
      if (!n) {
        break;
      }
      let r = Ml(n);
      if (!r) {
        break;
      }
      t = n.filePos + r.size;
    }
    let n = e._reader.requestSliceRange(t, 7, 9);
    if (n instanceof Promise) {
      n = await n;
    }
    if (!n) {
      return false;
    }
    let r = ia(n);
    t += r.frameLength;
    n = e._reader.requestSliceRange(t, 7, 9);
    if (n instanceof Promise) {
      n = await n;
    }
    if (!r || !n) {
      return false;
    }
    let i = ia(n);
    if (i) {
      return r.objectType === i.objectType && r.samplingFrequencyIndex === i.samplingFrequencyIndex && r.channelConfiguration === i.channelConfiguration;
    } else {
      return false;
    }
  }
  _createDemuxer(e) {
    return new oa(e);
  }
  get name() {
    return `ADTS`;
  }
  get mimeType() {
    return `audio/aac`;
  }
};
var Vo = class extends Ao {
  async _canReadInput(e) {
    let t = e._reader.requestSlice(0, 205);
    if (t instanceof Promise) {
      t = await t;
    }
    if (!t) {
      return false;
    }
    let n = B(t, 205);
    if (n[0] === 71 && n[188] === 71 || n[0] === 71 && n[204] === 71) {
      return true;
    } else {
      return n[4] === 71 && n[196] === 71;
    }
  }
  _createDemuxer(e) {
    return new ba(e);
  }
  get name() {
    return `MPEG Transport Stream`;
  }
  get mimeType() {
    return `video/MP2T`;
  }
};
var Ho = class extends Ao {
  async _canReadInput(e) {
    let t = e._reader.requestSlice(0, 7);
    if (t instanceof Promise) {
      t = await t;
    }
    if (!t || W(t, 7) !== `#EXTM3U`) {
      return false;
    }
    if (!(e._rootSource instanceof $a)) {
      throw TypeError('HLS inputs require `InputOptions.source` to be a PathedSource or a ref to one.');
    }
    e._rootSource._usedForHls = true;
    return true;
  }
  _createDemuxer(e) {
    return new Co(e);
  }
  get name() {
    return `HTTP Live Streaming (HLS)`;
  }
  get mimeType() {
    return ka;
  }
};
var Uo = new Mo();
var Wo = new No();
var Go = new Po();
var Ko = new Fo();
var qo = new Io();
var Jo = new Lo();
var Yo = new Ro();
var Xo = new Bo();
var Zo = new zo();
var Qo = new Vo();
var $o = new Ho();
var es = [$o, Uo, Wo, Go, Ko, Jo, Yo, Zo, qo, Xo, Qo];
var ts = [$o, Uo, Wo, qo, Xo, Qo];
var ns = (e, t) => {
  if (!e || typeof e != `object`) {
    throw TypeError(`${t}, when provided, must be an object.`);
  }
  if (e.isobmff !== undefined) {
    if (!e.isobmff || typeof e.isobmff != `object`) {
      throw TypeError(`${t}.isobmff, when provided, must be an object.`);
    }
    if (e.isobmff.resolveKeyId !== undefined && typeof e.isobmff.resolveKeyId != `function`) {
      throw TypeError(`${t}.isobmff.resolveKeyId, when provided, must be a function.`);
    }
  }
  if (e.hls !== undefined) {
    if (!e.hls || typeof e.hls != `object`) {
      throw TypeError(`${t}.hls, when provided, must be an object.`);
    }
    if (e.hls.offsetTimestampsByDateTime !== undefined && typeof e.hls.offsetTimestampsByDateTime != `boolean`) {
      throw TypeError(`${t}.hls.offsetTimestampsByDateTime, when provided, must be a boolean.`);
    }
  }
};
var rs = new Map();
var is = new Map();
var as = (e, t) => {
  if (!t || typeof t != `object`) {
    throw TypeError(`options must be an object.`);
  }
  if (t.codec !== undefined && typeof t.codec != `string`) {
    throw TypeError(`options.codec, when provided, must be a string.`);
  }
  if (t.codec !== undefined && qt(t.codec) !== e) {
    throw TypeError(`options.codec, when provided, must match the specified codec (${e}).`);
  }
  if (t.codedWidth !== undefined && (!Number.isInteger(t.codedWidth) || t.codedWidth <= 0)) {
    throw TypeError(`options.codedWidth, when provided, must be a positive integer.`);
  }
  if (t.codedHeight !== undefined && (!Number.isInteger(t.codedHeight) || t.codedHeight <= 0)) {
    throw TypeError(`options.codedHeight, when provided, must be a positive integer.`);
  }
  if (t.displayAspectWidth !== undefined && (!Number.isInteger(t.displayAspectWidth) || t.displayAspectWidth <= 0)) {
    throw TypeError(`options.displayAspectWidth, when provided, must be a positive integer.`);
  }
  if (t.displayAspectHeight !== undefined && (!Number.isInteger(t.displayAspectHeight) || t.displayAspectHeight <= 0)) {
    throw TypeError(`options.displayAspectHeight, when provided, must be a positive integer.`);
  }
  if (t.description !== undefined && !S(t.description)) {
    throw TypeError(`options.description, when provided, must be a buffer source.`);
  }
  if (t.hardwareAcceleration !== undefined && ![`no-preference`, `prefer-hardware`, `prefer-software`].includes(t.hardwareAcceleration)) {
    throw TypeError(`options.hardwareAcceleration, when provided, must be 'no-preference', 'prefer-hardware' or 'prefer-software'.`);
  }
  if (t.optimizeForLatency !== undefined && typeof t.optimizeForLatency != `boolean`) {
    throw TypeError(`options.optimizeForLatency, when provided, must be a boolean.`);
  }
};
var os = (e, t) => {
  if (!t || typeof t != `object`) {
    throw TypeError(`options must be an object.`);
  }
  if (t.codec !== undefined && typeof t.codec != `string`) {
    throw TypeError(`options.codec, when provided, must be a string.`);
  }
  if (t.codec !== undefined && qt(t.codec) !== e) {
    throw TypeError(`options.codec, when provided, must match the specified codec (${e}).`);
  }
  if (t.numberOfChannels !== undefined && (!Number.isInteger(t.numberOfChannels) || t.numberOfChannels <= 0)) {
    throw TypeError(`options.numberOfChannels, when provided, must be a positive integer.`);
  }
  if (t.sampleRate !== undefined && (!Number.isInteger(t.sampleRate) || t.sampleRate <= 0)) {
    throw TypeError(`options.sampleRate, when provided, must be a positive integer.`);
  }
  if (t.description !== undefined && !S(t.description)) {
    throw TypeError(`options.description, when provided, must be a buffer source.`);
  }
};
var ss = e => {
  if (j.includes(e)) {
    return cs(e);
  } else {
    if (N.includes(e)) {
      return ls(e);
    } else {
      return false;
    }
  }
};
var cs = async (e, t = {}) => {
  if (!j.includes(e)) {
    return false;
  }
  as(e, t);
  let n = {
    ...t,
    codedWidth: t.codedWidth ?? 1280,
    codedHeight: t.codedHeight ?? 720,
    codec: t.codec ?? Lt(e, 1280, 720, 1000000, false)
  };
  n.description ??= undefined;
  let r = JSON.stringify(n);
  let i = rs.get(r);
  if (i) {
    return i;
  }
  let a = (async () => {
    if (wc.some(t => {
      return t.supports(e, n);
    })) {
      return true;
    } else {
      if (typeof VideoDecoder > `u`) {
        return false;
      } else {
        return (await VideoDecoder.isConfigSupported(n)).supported === true;
      }
    }
  })();
  rs.set(r, a);
  return a;
};
var ls = async (e, t = {}) => {
  if (!N.includes(e)) {
    return false;
  }
  os(e, t);
  let n = {
    ...t,
    numberOfChannels: t.numberOfChannels ?? 2,
    sampleRate: t.sampleRate ?? 48000,
    codec: t.codec ?? Vt(e, 2, 48000)
  };
  if (n.description === undefined) {
    let e = Ut(n);
    if (e === false) {
      return false;
    }
    n.description = e;
  }
  let r = JSON.stringify(n);
  let i = is.get(r);
  if (i) {
    return i;
  }
  let a = (async () => {
    if (Tc.some(t => {
      return t.supports(e, n);
    }) || M.includes(e)) {
      return true;
    } else {
      if (typeof AudioDecoder > `u`) {
        return false;
      } else {
        return (await AudioDecoder.isConfigSupported(n)).supported === true;
      }
    }
  })();
  is.set(r, a);
  return a;
};
var us = async () => {
  let [e, t] = await Promise.all([ds(), fs()]);
  return [...e, ...t];
};
var ds = async (e = j, t) => {
  let n = await Promise.all(e.map(e => {
    return cs(e, t);
  }));
  return e.filter((e, t) => {
    return n[t];
  });
};
var fs = async (e = N, t) => {
  let n = await Promise.all(e.map(e => {
    return ls(e, t);
  }));
  return e.filter((e, t) => {
    return n[t];
  });
};
function ps(e, t, n) {
  if (t != null) {
    if (typeof t != `object` && typeof t != `function`) {
      throw TypeError(`Object expected.`);
    }
    var r;
    var i;
    if (n) {
      if (!Symbol.asyncDispose) {
        throw TypeError(`Symbol.asyncDispose is not defined.`);
      }
      r = t[Symbol.asyncDispose];
    }
    if (r === undefined) {
      if (!Symbol.dispose) {
        throw TypeError(`Symbol.dispose is not defined.`);
      }
      r = t[Symbol.dispose];
      if (n) {
        i = r;
      }
    }
    if (typeof r != `function`) {
      throw TypeError(`Object not disposable.`);
    }
    if (i) {
      r = function () {
        try {
          i.call(this);
        } catch (e) {
          return Promise.reject(e);
        }
      };
    }
    e.stack.push({
      value: t,
      dispose: r,
      async: n
    });
  } else if (n) {
    e.stack.push({
      async: true
    });
  }
  return t;
}
var ms = function (e) {
  return function (t) {
    function n(n) {
      if (t.hasError) {
        t.error = new e(n, t.error, `An error was suppressed during disposal.`);
      } else {
        t.error = n;
      }
      t.hasError = true;
    }
    var r;
    var i = 0;
    function a() {
      while (r = t.stack.pop()) {
        try {
          if (!r.async && i === 1) {
            i = 0;
            t.stack.push(r);
            return Promise.resolve().then(a);
          }
          if (r.dispose) {
            var e = r.dispose.call(r.value);
            if (r.async) {
              i |= 2;
              return Promise.resolve(e).then(a, function (e) {
                n(e);
                return a();
              });
            }
          } else {
            i |= 1;
          }
        } catch (e) {
          n(e);
        }
      }
      if (i === 1) {
        if (t.hasError) {
          return Promise.reject(t.error);
        } else {
          return Promise.resolve();
        }
      }
      if (t.hasError) {
        throw t.error;
      }
    }
    return a();
  };
}(typeof SuppressedError == `function` ? SuppressedError : function (e, t, n) {
  var r = Error(n);
  r.name = `SuppressedError`;
  r.error = e;
  r.suppressed = t;
  return r;
});
Ge();
var hs = -Infinity;
var gs = -Infinity;
var _s = null;
if (typeof FinalizationRegistry < `u`) {
  _s = new FinalizationRegistry(e => {
    let t = performance.now();
    if (e.type === `video`) {
      if (t - hs >= 1000) {
        k._error(`A VideoSample was garbage collected without first being closed. For proper resource management, make sure to call close() on all your VideoSamples as soon as you're done using them.`);
        hs = t;
      }
      if (typeof VideoFrame < `u` && e.data instanceof VideoFrame) {
        e.data.close();
      }
    } else {
      if (t - gs >= 1000) {
        k._error(`An AudioSample was garbage collected without first being closed. For proper resource management, make sure to call close() on all your AudioSamples as soon as you're done using them.`);
        gs = t;
      }
      if (typeof AudioData < `u` && e.data instanceof AudioData) {
        e.data.close();
      }
    }
  });
}
var vs = class {
  constructor() {
    this._referenceCount = 0;
    this._lastAllocationBuffer = null;
  }
};
var ys = [`I420`, `I420P10`, `I420P12`, `I420A`, `I420AP10`, `I420AP12`, `I422`, `I422P10`, `I422P12`, `I422A`, `I422AP10`, `I422AP12`, `I444`, `I444P10`, `I444P12`, `I444A`, `I444AP10`, `I444AP12`, `NV12`, `RGBA`, `RGBX`, `BGRA`, `BGRX`];
var bs = new Set(ys);
var Ss = [];
var Cs = e => {
  if (!Ss.includes(e)) {
    Ss.push(e);
  }
};
var ws = 3;
var Ts = [];
var Es = 0;
var Ds = class {
  constructor(e) {
    if (e !== undefined) {
      if (!e || typeof e != `object`) {
        throw TypeError(`init.colorSpace, when provided, must be an object.`);
      }
      let t = Object.keys(h);
      if (e.primaries != null && !t.includes(e.primaries)) {
        throw TypeError(`init.colorSpace.primaries, when provided, must be one of ${t.join(`, `)}.`);
      }
      let n = Object.keys(_);
      if (e.transfer != null && !n.includes(e.transfer)) {
        throw TypeError(`init.colorSpace.transfer, when provided, must be one of ${n.join(`, `)}.`);
      }
      let r = Object.keys(y);
      if (e.matrix != null && !r.includes(e.matrix)) {
        throw TypeError(`init.colorSpace.matrix, when provided, must be one of ${r.join(`, `)}.`);
      }
      if (e.fullRange != null && typeof e.fullRange != `boolean`) {
        throw TypeError(`init.colorSpace.fullRange, when provided, must be a boolean.`);
      }
    }
    this.primaries = e?.primaries ?? null;
    this.transfer = e?.transfer ?? null;
    this.matrix = e?.matrix ?? null;
    this.fullRange = e?.fullRange ?? null;
  }
  toJSON() {
    return {
      primaries: this.primaries,
      transfer: this.transfer,
      matrix: this.matrix,
      fullRange: this.fullRange
    };
  }
};
var Os = e => {
  return typeof VideoFrame < `u` && e instanceof VideoFrame;
};
var ks = (e, t, r) => {
  let i = Math.min(e.left, t);
  let a = Math.min(e.top, r);
  let o = Math.min(e.width, t - i);
  let s = Math.min(e.height, r - a);
  n(o >= 0);
  n(s >= 0);
  return {
    left: i,
    top: a,
    width: o,
    height: s
  };
};
var As = (e, t) => {
  if (!e || typeof e != `object`) {
    throw TypeError(`${t}crop, when provided, must be an object.`);
  }
  if (!Number.isInteger(e.left) || e.left < 0) {
    throw TypeError(`${t}crop.left must be a non-negative integer.`);
  }
  if (!Number.isInteger(e.top) || e.top < 0) {
    throw TypeError(`${t}crop.top must be a non-negative integer.`);
  }
  if (!Number.isInteger(e.width) || e.width < 0) {
    throw TypeError(`${t}crop.width must be a non-negative integer.`);
  }
  if (!Number.isInteger(e.height) || e.height < 0) {
    throw TypeError(`${t}crop.height must be a non-negative integer.`);
  }
};
var js = e => {
  if (!e || typeof e != `object`) {
    throw TypeError(`options must be an object.`);
  }
  if (e.colorSpace !== undefined && ![`display-p3`, `srgb`].includes(e.colorSpace)) {
    throw TypeError(`options.colorSpace, when provided, must be 'display-p3' or 'srgb'.`);
  }
  if (e.format !== undefined && typeof e.format != `string`) {
    throw TypeError(`options.format, when provided, must be a string.`);
  }
  if (e.layout !== undefined) {
    if (!Array.isArray(e.layout)) {
      throw TypeError(`options.layout, when provided, must be an array.`);
    }
    for (let t of e.layout) {
      if (!t || typeof t != `object`) {
        throw TypeError(`Each entry in options.layout must be an object.`);
      }
      if (!Number.isInteger(t.offset) || t.offset < 0) {
        throw TypeError(`plane.offset must be a non-negative integer.`);
      }
      if (!Number.isInteger(t.stride) || t.stride < 0) {
        throw TypeError(`plane.stride must be a non-negative integer.`);
      }
    }
  }
  if (e.rect !== undefined) {
    if (!e.rect || typeof e.rect != `object`) {
      throw TypeError(`options.rect, when provided, must be an object.`);
    }
    if (e.rect.x !== undefined && (!Number.isInteger(e.rect.x) || e.rect.x < 0)) {
      throw TypeError(`options.rect.x, when provided, must be a non-negative integer.`);
    }
    if (e.rect.y !== undefined && (!Number.isInteger(e.rect.y) || e.rect.y < 0)) {
      throw TypeError(`options.rect.y, when provided, must be a non-negative integer.`);
    }
    if (e.rect.width !== undefined && (!Number.isInteger(e.rect.width) || e.rect.width < 0)) {
      throw TypeError(`options.rect.width, when provided, must be a non-negative integer.`);
    }
    if (e.rect.height !== undefined && (!Number.isInteger(e.rect.height) || e.rect.height < 0)) {
      throw TypeError(`options.rect.height, when provided, must be a non-negative integer.`);
    }
  }
};
var Ms = (e, t, n) => {
  let r = Ns(e);
  let i = [];
  let a = 0;
  for (let e of r) {
    let r = Math.ceil(t / e.widthDivisor);
    let o = Math.ceil(n / e.heightDivisor);
    let s = r * e.sampleBytes;
    let c = s * o;
    i.push({
      offset: a,
      stride: s
    });
    a += c;
  }
  return i;
};
var Ns = e => {
  let t = (e, t, n, r, i) => {
    let a = [{
      sampleBytes: e,
      widthDivisor: 1,
      heightDivisor: 1
    }, {
      sampleBytes: t,
      widthDivisor: n,
      heightDivisor: r
    }, {
      sampleBytes: t,
      widthDivisor: n,
      heightDivisor: r
    }];
    if (i) {
      a.push({
        sampleBytes: e,
        widthDivisor: 1,
        heightDivisor: 1
      });
    }
    return a;
  };
  switch (e) {
    case `I420`:
      {
        return t(1, 1, 2, 2, false);
      }
    case `I420P10`:
    case `I420P12`:
      {
        return t(2, 2, 2, 2, false);
      }
    case `I420A`:
      {
        return t(1, 1, 2, 2, true);
      }
    case `I420AP10`:
    case `I420AP12`:
      {
        return t(2, 2, 2, 2, true);
      }
    case `I422`:
      {
        return t(1, 1, 2, 1, false);
      }
    case `I422P10`:
    case `I422P12`:
      {
        return t(2, 2, 2, 1, false);
      }
    case `I422A`:
      {
        return t(1, 1, 2, 1, true);
      }
    case `I422AP10`:
    case `I422AP12`:
      {
        return t(2, 2, 2, 1, true);
      }
    case `I444`:
      {
        return t(1, 1, 1, 1, false);
      }
    case `I444P10`:
    case `I444P12`:
      {
        return t(2, 2, 1, 1, false);
      }
    case `I444A`:
      {
        return t(1, 1, 1, 1, true);
      }
    case `I444AP10`:
    case `I444AP12`:
      {
        return t(2, 2, 1, 1, true);
      }
    case `NV12`:
      {
        return [{
          sampleBytes: 1,
          widthDivisor: 1,
          heightDivisor: 1
        }, {
          sampleBytes: 2,
          widthDivisor: 2,
          heightDivisor: 2
        }];
      }
    case `RGBA`:
    case `RGBX`:
    case `BGRA`:
    case `BGRX`:
      {
        return [{
          sampleBytes: 4,
          widthDivisor: 1,
          heightDivisor: 1
        }];
      }
    default:
      {
        D(e);
        n(false);
      }
  }
};
var Ps = (e, t) => {
  let n = {
    left: 0,
    top: 0,
    width: e.codedWidth,
    height: e.codedHeight
  };
  let r = t.rect;
  let i = Fs(n, r, e.codedWidth, e.codedHeight, e.format);
  let a = t.layout;
  let o;
  if (!t.format || t.format === e.format) {
    o = e.format;
  } else if ([`RGBA`, `RGBX`, `BGRA`, `BGRX`].includes(t.format)) {
    o = t.format;
  } else {
    throw Error(`NotSupportedError: Invalid destination format.`);
  }
  return Ls(i, o, a);
};
var Fs = (e, t, n, r, i) => {
  let a = {
    ...e
  };
  if (t !== undefined) {
    if (t.width === 0 || t.height === 0) {
      throw TypeError(`visibleRect dimensions cannot be zero.`);
    }
    if ((t.x || 0) + (t.width || 0) > n) {
      throw TypeError(`visibleRect exceeds codedWidth.`);
    }
    if ((t.y || 0) + (t.height || 0) > r) {
      throw TypeError(`visibleRect exceeds codedHeight.`);
    }
    a.x = t.x || 0;
    a.y = t.y || 0;
    a.width = t.width || 0;
    a.height = t.height || 0;
  }
  if (!Is(i, a)) {
    throw TypeError(`visibleRect alignment is invalid for the format.`);
  }
  return a;
};
var Is = (e, t) => {
  if (e === null) {
    return true;
  }
  let n = Ns(e);
  for (let e = 0; e < n.length; e++) {
    let r = n[e];
    let i = r.widthDivisor;
    let a = r.heightDivisor;
    if ((t.x || 0) % i !== 0 || (t.y || 0) % a !== 0) {
      return false;
    }
  }
  return true;
};
var Ls = (e, t, n) => {
  let r = Ns(t);
  let i = r.length;
  if (n !== undefined && n.length !== i) {
    throw TypeError(`Layout must have ${i} planes.`);
  }
  let a = 0;
  let o = [];
  let s = [];
  for (let t = 0; t < i; t++) {
    let i = r[t];
    let c = i.sampleBytes;
    let l = i.widthDivisor;
    let u = i.heightDivisor;
    let d = {
      destinationOffset: 0,
      destinationStride: 0,
      sourceTop: 0,
      sourceHeight: 0,
      sourceLeftBytes: 0,
      sourceWidthBytes: 0
    };
    d.sourceTop = Math.ceil(Math.trunc(e.y || 0) / u);
    d.sourceHeight = Math.ceil(Math.trunc(e.height || 0) / u);
    d.sourceLeftBytes = Math.floor(Math.trunc(e.x || 0) / l) * c;
    d.sourceWidthBytes = Math.floor(Math.trunc(e.width || 0) / l) * c;
    if (n !== undefined) {
      let e = n[t];
      if (e.stride < d.sourceWidthBytes) {
        throw TypeError(`Stride for plane ${t} is too small.`);
      }
      d.destinationOffset = e.offset;
      d.destinationStride = e.stride;
    } else {
      d.destinationOffset = a;
      d.destinationStride = d.sourceWidthBytes;
    }
    let f = d.destinationStride * d.sourceHeight + d.destinationOffset;
    if (f > 4294967295) {
      throw TypeError(`Allocation size exceeds limit.`);
    }
    s.push(f);
    a = Math.max(a, f);
    for (let e = 0; e < t; e++) {
      let n = o[e];
      if (!(s[t] <= n.destinationOffset) && !(s[e] <= d.destinationOffset)) {
        throw TypeError(`Planes overlap.`);
      }
    }
    o.push(d);
  }
  return {
    allocationSize: a,
    computedLayouts: o
  };
};
var Rs = new Set([`f32`, `f32-planar`, `s16`, `s16-planar`, `s32`, `s32-planar`, `u8`, `u8-planar`]);
var zs = class {
  constructor() {
    this._referenceCount = 0;
  }
};
var Bs = class e {
  get microsecondTimestamp() {
    return Math.trunc(we * this.timestamp);
  }
  get microsecondDuration() {
    return Math.trunc(we * this.duration);
  }
  constructor(e) {
    this._closed = false;
    if (Gs(e)) {
      if (e.format === null) {
        throw TypeError(`AudioData with null format is not supported.`);
      }
      this._data = e;
      this.format = e.format;
      this.sampleRate = e.sampleRate;
      this.numberOfFrames = e.numberOfFrames;
      this.numberOfChannels = e.numberOfChannels;
      this.timestamp = e.timestamp / 1000000;
      this.duration = e.numberOfFrames / e.sampleRate;
    } else if (e instanceof zs) {
      this._data = e;
      e._referenceCount++;
      this.format = e.getFormat();
      if (!Rs.has(this.format)) {
        throw TypeError(`getFormat() must return an AudioSampleFormat.`);
      }
      this.sampleRate = e.getSampleRate();
      if (!Number.isInteger(this.sampleRate) || this.sampleRate <= 0) {
        throw TypeError(`getSampleRate() must return a positive integer.`);
      }
      this.numberOfFrames = e.getNumberOfFrames();
      if (!Number.isInteger(this.numberOfFrames) || this.numberOfFrames < 0) {
        throw TypeError(`getNumberOfFrames() must return a non-negative integer.`);
      }
      this.numberOfChannels = e.getNumberOfChannels();
      if (!Number.isInteger(this.numberOfChannels) || this.numberOfChannels <= 0) {
        throw TypeError(`getNumberOfChannels() must return a positive integer.`);
      }
      this.timestamp = e.getTimestamp();
      if (!Number.isFinite(this.timestamp)) {
        throw TypeError(`getTimestamp() must return a finite number.`);
      }
      this.duration = this.numberOfFrames / this.sampleRate;
    } else {
      if (!e || typeof e != `object`) {
        throw TypeError(`Invalid AudioDataInit: must be an object.`);
      }
      if (!Rs.has(e.format)) {
        throw TypeError(`Invalid AudioDataInit: invalid format.`);
      }
      if (!Number.isFinite(e.sampleRate) || e.sampleRate <= 0) {
        throw TypeError(`Invalid AudioDataInit: sampleRate must be > 0.`);
      }
      if (!Number.isInteger(e.numberOfChannels) || e.numberOfChannels === 0) {
        throw TypeError(`Invalid AudioDataInit: numberOfChannels must be an integer > 0.`);
      }
      if (!Number.isFinite(e?.timestamp)) {
        throw TypeError(`init.timestamp must be a number.`);
      }
      let t = e.data.byteLength / (Vs(e.format) * e.numberOfChannels);
      if (!Number.isInteger(t)) {
        throw TypeError(`Invalid AudioDataInit: data size is not a multiple of frame size.`);
      }
      this.format = e.format;
      this.sampleRate = e.sampleRate;
      this.numberOfFrames = t;
      this.numberOfChannels = e.numberOfChannels;
      this.timestamp = e.timestamp;
      this.duration = t / e.sampleRate;
      let n;
      if (e.data instanceof ArrayBuffer) {
        n = new Uint8Array(e.data);
      } else if (ArrayBuffer.isView(e.data)) {
        n = new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength);
      } else {
        throw TypeError(`Invalid AudioDataInit: data is not a BufferSource.`);
      }
      let r = this.numberOfFrames * this.numberOfChannels * Vs(this.format);
      if (n.byteLength < r) {
        throw TypeError(`Invalid AudioDataInit: insufficient data size.`);
      }
      this._data = n;
    }
    _s?.register(this, {
      type: `audio`,
      data: this._data
    }, this);
  }
  allocationSize(e) {
    if (!e || typeof e != `object`) {
      throw TypeError(`options must be an object.`);
    }
    if (!Number.isInteger(e.planeIndex) || e.planeIndex < 0) {
      throw TypeError(`planeIndex must be a non-negative integer.`);
    }
    if (e.format !== undefined && !Rs.has(e.format)) {
      throw TypeError(`Invalid format.`);
    }
    if (e.frameOffset !== undefined && (!Number.isInteger(e.frameOffset) || e.frameOffset < 0)) {
      throw TypeError(`frameOffset must be a non-negative integer.`);
    }
    if (e.frameCount !== undefined && (!Number.isInteger(e.frameCount) || e.frameCount < 0)) {
      throw TypeError(`frameCount must be a non-negative integer.`);
    }
    if (this._closed) {
      throw Error(`AudioSample is closed.`);
    }
    let t = e.format ?? this.format;
    let n = e.frameOffset ?? 0;
    if (n >= this.numberOfFrames) {
      throw RangeError(`frameOffset out of range`);
    }
    let r = e.frameCount === undefined ? this.numberOfFrames - n : e.frameCount;
    if (r > this.numberOfFrames - n) {
      throw RangeError(`frameCount out of range`);
    }
    let i = Vs(t);
    let a = Hs(t);
    if (a && e.planeIndex >= this.numberOfChannels || !a && e.planeIndex !== 0) {
      throw RangeError(`planeIndex out of range`);
    }
    return (a ? r : r * this.numberOfChannels) * i;
  }
  copyTo(e, t) {
    if (!S(e)) {
      throw TypeError(`destination must be an ArrayBuffer or an ArrayBuffer view.`);
    }
    if (!t || typeof t != `object`) {
      throw TypeError(`options must be an object.`);
    }
    if (!Number.isInteger(t.planeIndex) || t.planeIndex < 0) {
      throw TypeError(`planeIndex must be a non-negative integer.`);
    }
    if (t.format !== undefined && !Rs.has(t.format)) {
      throw TypeError(`Invalid format.`);
    }
    if (t.frameOffset !== undefined && (!Number.isInteger(t.frameOffset) || t.frameOffset < 0)) {
      throw TypeError(`frameOffset must be a non-negative integer.`);
    }
    if (t.frameCount !== undefined && (!Number.isInteger(t.frameCount) || t.frameCount < 0)) {
      throw TypeError(`frameCount must be a non-negative integer.`);
    }
    if (this._closed) {
      throw Error(`AudioSample is closed.`);
    }
    let {
      format: n,
      frameCount: r,
      frameOffset: i
    } = t;
    let {
      planeIndex: a
    } = t;
    let o = this.format;
    let s = n ?? this.format;
    if (!s) {
      throw Error(`Destination format not determined`);
    }
    let c = this.numberOfFrames;
    let l = this.numberOfChannels;
    let d = i ?? 0;
    if (d >= c) {
      throw RangeError(`frameOffset out of range`);
    }
    let f = r === undefined ? c - d : r;
    if (f > c - d) {
      throw RangeError(`frameCount out of range`);
    }
    let p = Vs(s);
    let m = Hs(s);
    if (m && a >= l || !m && a !== 0) {
      throw RangeError(`planeIndex out of range`);
    }
    let h = (m ? f : f * l) * p;
    if (e.byteLength < h) {
      throw RangeError(`Destination buffer is too small`);
    }
    let g = u(e);
    let _ = Ws(s);
    if (Gs(this._data)) {
      if (je() && l > 2 && s !== o) {
        qs(this._data, g, o, s, l, a, d, f);
      } else {
        this._data.copyTo(e, {
          planeIndex: a,
          frameOffset: d,
          frameCount: f,
          format: s
        });
      }
    } else {
      let e = Us(o);
      let t = Vs(o);
      let n = Hs(o);
      let r;
      if (this._data instanceof zs) {
        let e = e => {
          let r = this._data.getDataPlane(e);
          if (!(r instanceof Uint8Array)) {
            throw TypeError(`getDataPlane() must return a Uint8Array.`);
          }
          let i = c * t * (n ? 1 : l);
          if (r.byteLength !== i) {
            throw TypeError(`Data plane ${e} has invalid size. Expected exactly ${i} bytes, got ${r.byteLength} bytes.`);
          }
          return r;
        };
        if (n) {
          if (m) {
            r = e(a);
            a = 0;
          } else {
            r = new Uint8Array(c * t * l);
            for (let n = 0; n < l; n++) {
              let i = e(n);
              r.set(i, n * c * t);
            }
          }
        } else {
          r = e(0);
        }
      } else {
        r = this._data;
      }
      let i = u(r);
      for (let r = 0; r < f; r++) {
        if (m) {
          let o = r * p;
          let s;
          if (n) {
            s = (a * c + (r + d)) * t;
          } else {
            s = ((r + d) * l + a) * t;
          }
          _(g, o, e(i, s));
        } else {
          for (let a = 0; a < l; a++) {
            let o = (r * l + a) * p;
            let s;
            if (n) {
              s = (a * c + (r + d)) * t;
            } else {
              s = ((r + d) * l + a) * t;
            }
            _(g, o, e(i, s));
          }
        }
      }
    }
  }
  clone() {
    if (this._closed) {
      throw Error(`AudioSample is closed.`);
    }
    if (this._data instanceof zs) {
      let t = new e(this._data);
      t.setTimestamp(this.timestamp);
      return t;
    } else if (Gs(this._data)) {
      let t = new e(this._data.clone());
      t.setTimestamp(this.timestamp);
      return t;
    } else {
      return new e({
        format: this.format,
        sampleRate: this.sampleRate,
        numberOfFrames: this.numberOfFrames,
        numberOfChannels: this.numberOfChannels,
        timestamp: this.timestamp,
        data: this._data
      });
    }
  }
  trim(t, n = this.numberOfFrames) {
    if (!Number.isInteger(t) || t < 0) {
      throw TypeError(`startSample must be a non-negative integer.`);
    }
    if (!Number.isInteger(n) || n < 0) {
      throw TypeError(`endSample must be a non-negative integer.`);
    }
    if (t > this.numberOfFrames) {
      throw RangeError(`startSample out of range.`);
    }
    if (n > this.numberOfFrames) {
      throw RangeError(`endSample out of range.`);
    }
    if (n < t) {
      throw RangeError(`endSample must not be less than startSample.`);
    }
    if (this._closed) {
      throw Error(`AudioSample is closed.`);
    }
    let r = n - t;
    let i = Vs(this.format);
    let a;
    if (Hs(this.format)) {
      let e = r * i;
      a = new Uint8Array(e * this.numberOfChannels);
      if (r > 0) {
        for (let n = 0; n < this.numberOfChannels; n++) {
          this.copyTo(a.subarray(n * e, (n + 1) * e), {
            planeIndex: n,
            format: this.format,
            frameOffset: t,
            frameCount: r
          });
        }
      }
    } else {
      a = new Uint8Array(r * this.numberOfChannels * i);
      if (r > 0) {
        this.copyTo(a, {
          planeIndex: 0,
          format: this.format,
          frameOffset: t,
          frameCount: r
        });
      }
    }
    return new e({
      data: a,
      format: this.format,
      sampleRate: this.sampleRate,
      numberOfChannels: this.numberOfChannels,
      timestamp: this.timestamp + t / this.sampleRate
    });
  }
  close() {
    _s?.unregister(this);
    this._data._referenceCount--;
    this._data instanceof zs ? this._data._referenceCount === 0 && this._data.close() : Gs(this._data) ? this._data.close() : this._data = new Uint8Array();
    this._closed ||= true;
  }
  toAudioData() {
    if (this._closed) {
      throw Error(`AudioSample is closed.`);
    }
    if (this._data instanceof zs) {
      return this._createAudioDataFromData();
    } else if (Gs(this._data)) {
      if (this._data.timestamp === this.microsecondTimestamp) {
        return this._data.clone();
      } else {
        return this._createAudioDataFromData();
      }
    } else {
      return new AudioData({
        format: this.format,
        sampleRate: this.sampleRate,
        numberOfFrames: this.numberOfFrames,
        numberOfChannels: this.numberOfChannels,
        timestamp: this.microsecondTimestamp,
        data: this._data.buffer instanceof ArrayBuffer ? this._data.buffer : this._data.slice()
      });
    }
  }
  _createAudioDataFromData() {
    if (Hs(this.format)) {
      let e = this.allocationSize({
        planeIndex: 0,
        format: this.format
      });
      let t = new ArrayBuffer(e * this.numberOfChannels);
      for (let n = 0; n < this.numberOfChannels; n++) {
        this.copyTo(new Uint8Array(t, n * e, e), {
          planeIndex: n,
          format: this.format
        });
      }
      return new AudioData({
        format: this.format,
        sampleRate: this.sampleRate,
        numberOfFrames: this.numberOfFrames,
        numberOfChannels: this.numberOfChannels,
        timestamp: this.microsecondTimestamp,
        data: t
      });
    } else {
      let e = new ArrayBuffer(this.allocationSize({
        planeIndex: 0,
        format: this.format
      }));
      this.copyTo(e, {
        planeIndex: 0,
        format: this.format
      });
      return new AudioData({
        format: this.format,
        sampleRate: this.sampleRate,
        numberOfFrames: this.numberOfFrames,
        numberOfChannels: this.numberOfChannels,
        timestamp: this.microsecondTimestamp,
        data: e
      });
    }
  }
  toAudioBuffer() {
    if (this._closed) {
      throw Error(`AudioSample is closed.`);
    }
    let e = new AudioBuffer({
      numberOfChannels: this.numberOfChannels,
      length: this.numberOfFrames,
      sampleRate: this.sampleRate
    });
    let t = new Float32Array(this.allocationSize({
      planeIndex: 0,
      format: `f32-planar`
    }) / 4);
    for (let n = 0; n < this.numberOfChannels; n++) {
      this.copyTo(t, {
        planeIndex: n,
        format: `f32-planar`
      });
      e.copyToChannel(t, n);
    }
    return e;
  }
  setTimestamp(e) {
    if (!Number.isFinite(e)) {
      throw TypeError(`newTimestamp must be a number.`);
    }
    this.timestamp = e;
  }
  [Symbol.dispose]() {
    this.close();
  }
  static *_fromAudioBuffer(t, n) {
    if (!(t instanceof AudioBuffer)) {
      throw TypeError(`audioBuffer must be an AudioBuffer.`);
    }
    let r = t.numberOfChannels;
    let i = t.sampleRate;
    let a = t.length;
    let o = Math.floor(240000 / r);
    let s = 0;
    let c = a;
    while (c > 0) {
      let a = Math.min(o, c);
      let l = new Float32Array(r * a);
      for (let e = 0; e < r; e++) {
        t.copyFromChannel(l.subarray(e * a, (e + 1) * a), e, s);
      }
      yield new e({
        format: `f32-planar`,
        sampleRate: i,
        numberOfFrames: a,
        numberOfChannels: r,
        timestamp: n + s / i,
        data: l
      });
      s += a;
      c -= a;
    }
  }
  static fromAudioBuffer(t, n) {
    if (!(t instanceof AudioBuffer)) {
      throw TypeError(`audioBuffer must be an AudioBuffer.`);
    }
    let r = t.numberOfChannels;
    let i = t.sampleRate;
    let a = t.length;
    let o = Math.floor(240000 / r);
    let s = 0;
    let c = a;
    let l = [];
    while (c > 0) {
      let a = Math.min(o, c);
      let u = new Float32Array(r * a);
      for (let e = 0; e < r; e++) {
        t.copyFromChannel(u.subarray(e * a, (e + 1) * a), e, s);
      }
      let d = new e({
        format: `f32-planar`,
        sampleRate: i,
        numberOfFrames: a,
        numberOfChannels: r,
        timestamp: n + s / i,
        data: u
      });
      l.push(d);
      s += a;
      c -= a;
    }
    return l;
  }
};
var Vs = e => {
  switch (e) {
    case `u8`:
    case `u8-planar`:
      {
        return 1;
      }
    case `s16`:
    case `s16-planar`:
      {
        return 2;
      }
    case `s32`:
    case `s32-planar`:
      {
        return 4;
      }
    case `f32`:
    case `f32-planar`:
      {
        return 4;
      }
    default:
      {
        throw Error(`Unknown AudioSampleFormat`);
      }
  }
};
var Hs = e => {
  switch (e) {
    case `u8-planar`:
    case `s16-planar`:
    case `s32-planar`:
    case `f32-planar`:
      {
        return true;
      }
    default:
      {
        return false;
      }
  }
};
var Us = e => {
  switch (e) {
    case `u8`:
    case `u8-planar`:
      {
        return (e, t) => {
          return (e.getUint8(t) - 128) / 128;
        };
      }
    case `s16`:
    case `s16-planar`:
      {
        return (e, t) => {
          return e.getInt16(t, true) / 32768;
        };
      }
    case `s32`:
    case `s32-planar`:
      {
        return (e, t) => {
          return e.getInt32(t, true) / 2147483648;
        };
      }
    case `f32`:
    case `f32-planar`:
      {
        return (e, t) => {
          return e.getFloat32(t, true);
        };
      }
  }
};
var Ws = e => {
  switch (e) {
    case `u8`:
    case `u8-planar`:
      {
        return (e, t, n) => {
          return e.setUint8(t, O((n + 1) * 127.5, 0, 255));
        };
      }
    case `s16`:
    case `s16-planar`:
      {
        return (e, t, n) => {
          return e.setInt16(t, O(Math.round(n * 32767), -32768, 32767), true);
        };
      }
    case `s32`:
    case `s32-planar`:
      {
        return (e, t, n) => {
          return e.setInt32(t, O(Math.round(n * 2147483647), -2147483648, 2147483647), true);
        };
      }
    case `f32`:
    case `f32-planar`:
      {
        return (e, t, n) => {
          return e.setFloat32(t, n, true);
        };
      }
  }
};
var Gs = e => {
  return typeof AudioData < `u` && e instanceof AudioData;
};
var Ks = e => {
  switch (e) {
    case `u8-planar`:
      {
        return `u8`;
      }
    case `s16-planar`:
      {
        return `s16`;
      }
    case `s32-planar`:
      {
        return `s32`;
      }
    case `f32-planar`:
      {
        return `f32`;
      }
    default:
      {
        return e;
      }
  }
};
var qs = (e, t, n, r, i, a, o, s) => {
  let c = Us(n);
  let l = Ws(r);
  let d = Vs(n);
  let f = Vs(r);
  let p = Hs(n);
  if (Hs(r)) {
    if (p) {
      let r = new ArrayBuffer(s * d);
      let i = u(r);
      e.copyTo(r, {
        planeIndex: a,
        frameOffset: o,
        frameCount: s,
        format: n
      });
      for (let e = 0; e < s; e++) {
        let n = e * d;
        l(t, e * f, c(i, n));
      }
    } else {
      let r = new ArrayBuffer(s * i * d);
      let p = u(r);
      e.copyTo(r, {
        planeIndex: 0,
        frameOffset: o,
        frameCount: s,
        format: n
      });
      for (let e = 0; e < s; e++) {
        let n = (e * i + a) * d;
        l(t, e * f, c(p, n));
      }
    }
  } else if (p) {
    let r = s * d;
    let a = new ArrayBuffer(r);
    let p = u(a);
    for (let r = 0; r < i; r++) {
      e.copyTo(a, {
        planeIndex: r,
        frameOffset: o,
        frameCount: s,
        format: n
      });
      for (let e = 0; e < s; e++) {
        let n = e * d;
        l(t, (e * i + r) * f, c(p, n));
      }
    }
  } else {
    let r = new ArrayBuffer(s * i * d);
    let a = u(r);
    e.copyTo(r, {
      planeIndex: 0,
      frameOffset: o,
      frameCount: s,
      format: n
    });
    for (let e = 0; e < s; e++) {
      for (let n = 0; n < i; n++) {
        let r = e * i + n;
        let o = r * d;
        l(t, r * f, c(a, o));
      }
    }
  }
};
var Js = (e, t) => {
  let n = e.allocationSize({
    format: t,
    planeIndex: 0
  });
  let r = new ArrayBuffer(n);
  e.copyTo(r, {
    format: t,
    planeIndex: 0
  });
  return new Bs({
    data: r,
    format: t,
    numberOfChannels: e.numberOfChannels,
    sampleRate: e.sampleRate,
    timestamp: e.timestamp,
    duration: e.duration
  });
};
var Ys = new Map();
var Xs = new Map();
var Zs = e => {
  if (!e || typeof e != `object`) {
    throw TypeError(`Encoding config must be an object.`);
  }
  if (!j.includes(e.codec)) {
    throw TypeError(`Invalid video codec '${e.codec}'. Must be one of: ${j.join(`, `)}.`);
  }
  if (!(e.bitrate instanceof rc) && (!Number.isInteger(e.bitrate) || e.bitrate <= 0)) {
    throw TypeError(`config.bitrate must be a positive integer or a quality.`);
  }
  if (e.keyFrameInterval !== undefined && (!Number.isFinite(e.keyFrameInterval) || e.keyFrameInterval < 0)) {
    throw TypeError(`config.keyFrameInterval, when provided, must be a non-negative number.`);
  }
  if (e.sizeChangeBehavior !== undefined && ![`deny`, `passThrough`, `fill`, `contain`, `cover`].includes(e.sizeChangeBehavior)) {
    throw TypeError(`config.sizeChangeBehavior, when provided, must be 'deny', 'passThrough', 'fill', 'contain' or 'cover'.`);
  }
  if (e.transform !== undefined) {
    if (typeof e.transform != `object` || !e.transform) {
      throw TypeError(`config.transform, when provided, must be an object.`);
    }
    if (e.transform.width !== undefined && (!Number.isInteger(e.transform.width) || e.transform.width <= 0)) {
      throw TypeError(`config.transform.width, when provided, must be a positive integer.`);
    }
    if (e.transform.height !== undefined && (!Number.isInteger(e.transform.height) || e.transform.height <= 0)) {
      throw TypeError(`config.transform.height, when provided, must be a positive integer.`);
    }
    if (e.transform.fit !== undefined && ![`fill`, `contain`, `cover`].includes(e.transform.fit)) {
      throw TypeError(`config.transform.fit, when provided, must be one of "fill", "contain", or "cover".`);
    }
    if (e.transform.width !== undefined && e.transform.height !== undefined && e.transform.fit === undefined && ![`fill`, `contain`, `cover`].includes(e.sizeChangeBehavior)) {
      throw TypeError(`When both config.transform.width and config.transform.height are provided, config.transform.fit must also be provided.`);
    }
    if (e.transform.fit !== undefined && [`fill`, `contain`, `cover`].includes(e.sizeChangeBehavior) && e.transform.fit !== e.sizeChangeBehavior) {
      throw TypeError(`config.transform.fit, when provided, cannot differ from config.sizeChangeBehavior when config.sizeChangeBehavior is 'fill', 'contain' or 'cover', as sizeChangeBehavior already determines the fitting algorithm.`);
    }
    if (e.transform.rotate !== undefined && ![0, 90, 180, 270].includes(e.transform.rotate)) {
      throw TypeError(`config.transform.rotate, when provided, must be 0, 90, 180 or 270.`);
    }
    if (e.transform.crop !== undefined) {
      As(e.transform.crop, `config.transform.`);
    }
    if (e.transform.process !== undefined && typeof e.transform.process != `function`) {
      throw TypeError(`config.transform.process, when provided, must be a function.`);
    }
    if (e.transform.frameRate !== undefined && (!Number.isFinite(e.transform.frameRate) || e.transform.frameRate <= 0)) {
      throw TypeError(`config.transform.frameRate, when provided, must be a finite positive number.`);
    }
    if (e.transform.force !== undefined && typeof e.transform.force != `boolean`) {
      throw TypeError(`config.transform.force, when provided, must be a boolean.`);
    }
  }
  if (e.onEncodedPacket !== undefined && typeof e.onEncodedPacket != `function`) {
    throw TypeError(`config.onEncodedPacket, when provided, must be a function.`);
  }
  if (e.onEncoderConfig !== undefined && typeof e.onEncoderConfig != `function`) {
    throw TypeError(`config.onEncoderConfig, when provided, must be a function.`);
  }
  if (e.onEncodedSample !== undefined && typeof e.onEncodedSample != `function`) {
    throw TypeError(`config.onEncodedSample, when provided, must be a function.`);
  }
  Qs(e.codec, e);
};
var Qs = (e, t) => {
  if (!t || typeof t != `object`) {
    throw TypeError(`Encoding options must be an object.`);
  }
  if (t.alpha !== undefined && ![`discard`, `keep`].includes(t.alpha)) {
    throw TypeError(`options.alpha, when provided, must be 'discard' or 'keep'.`);
  }
  if (t.bitrateMode !== undefined && ![`constant`, `variable`].includes(t.bitrateMode)) {
    throw TypeError(`bitrateMode, when provided, must be 'constant' or 'variable'.`);
  }
  if (t.latencyMode !== undefined && ![`quality`, `realtime`].includes(t.latencyMode)) {
    throw TypeError(`latencyMode, when provided, must be 'quality' or 'realtime'.`);
  }
  if (t.fullCodecString !== undefined && typeof t.fullCodecString != `string`) {
    throw TypeError(`fullCodecString, when provided, must be a string.`);
  }
  if (t.fullCodecString !== undefined && qt(t.fullCodecString) !== e) {
    throw TypeError(`fullCodecString, when provided, must be a string that matches the specified codec (${e}).`);
  }
  if (t.hardwareAcceleration !== undefined && ![`no-preference`, `prefer-hardware`, `prefer-software`].includes(t.hardwareAcceleration)) {
    throw TypeError(`hardwareAcceleration, when provided, must be 'no-preference', 'prefer-hardware' or 'prefer-software'.`);
  }
  if (t.scalabilityMode !== undefined && typeof t.scalabilityMode != `string`) {
    throw TypeError(`scalabilityMode, when provided, must be a string.`);
  }
  if (t.contentHint !== undefined && typeof t.contentHint != `string`) {
    throw TypeError(`contentHint, when provided, must be a string.`);
  }
};
var $s = e => {
  let t = e.bitrate instanceof rc ? e.bitrate._toVideoBitrate(e.codec, e.width, e.height) : e.bitrate;
  return {
    codec: e.fullCodecString ?? Lt(e.codec, e.width, e.height, t, e.alpha === `keep`),
    width: e.width,
    height: e.height,
    displayWidth: e.squarePixelWidth,
    displayHeight: e.squarePixelHeight,
    bitrate: t,
    bitrateMode: e.bitrateMode,
    alpha: e.alpha ?? `discard`,
    framerate: e.framerate,
    latencyMode: e.latencyMode,
    hardwareAcceleration: e.hardwareAcceleration,
    scalabilityMode: e.scalabilityMode,
    contentHint: e.contentHint,
    ...Jt(e.codec)
  };
};
var ec = e => {
  if (!e || typeof e != `object`) {
    throw TypeError(`Encoding config must be an object.`);
  }
  if (!N.includes(e.codec)) {
    throw TypeError(`Invalid audio codec '${e.codec}'. Must be one of: ${N.join(`, `)}.`);
  }
  if (e.bitrate === undefined && !M.includes(e.codec) && e.codec !== `flac`) {
    throw TypeError(`config.bitrate must be provided for compressed audio codecs.`);
  }
  if (e.bitrate !== undefined && !(e.bitrate instanceof rc) && (!Number.isInteger(e.bitrate) || e.bitrate <= 0)) {
    throw TypeError(`config.bitrate, when provided, must be a positive integer or a quality.`);
  }
  if (e.transform !== undefined) {
    if (typeof e.transform != `object` || !e.transform) {
      throw TypeError(`config.transform, when provided, must be an object.`);
    }
    if (e.transform.numberOfChannels !== undefined && (!Number.isInteger(e.transform.numberOfChannels) || e.transform.numberOfChannels <= 0)) {
      throw TypeError(`config.transform.numberOfChannels, when provided, must be a positive integer.`);
    }
    if (e.transform.sampleRate !== undefined && (!Number.isInteger(e.transform.sampleRate) || e.transform.sampleRate <= 0)) {
      throw TypeError(`config.transform.sampleRate, when provided, must be a positive integer.`);
    }
    if (e.transform.sampleFormat !== undefined && ![`u8`, `s16`, `s32`, `f32`].includes(e.transform.sampleFormat)) {
      throw TypeError(`config.transform.sampleFormat, when provided, must be one of: u8, s16, s32, f32.`);
    }
    if (e.transform.process !== undefined && typeof e.transform.process != `function`) {
      throw TypeError(`config.transform.process, when provided, must be a function.`);
    }
  }
  if (e.onEncodedPacket !== undefined && typeof e.onEncodedPacket != `function`) {
    throw TypeError(`config.onEncodedPacket, when provided, must be a function.`);
  }
  if (e.onEncoderConfig !== undefined && typeof e.onEncoderConfig != `function`) {
    throw TypeError(`config.onEncoderConfig, when provided, must be a function.`);
  }
  if (e.onEncodedSample !== undefined && typeof e.onEncodedSample != `function`) {
    throw TypeError(`config.onEncodedSample, when provided, must be a function.`);
  }
  tc(e.codec, e);
};
var tc = (e, t) => {
  if (!t || typeof t != `object`) {
    throw TypeError(`Encoding options must be an object.`);
  }
  if (t.bitrateMode !== undefined && ![`constant`, `variable`].includes(t.bitrateMode)) {
    throw TypeError(`bitrateMode, when provided, must be 'constant' or 'variable'.`);
  }
  if (t.fullCodecString !== undefined && typeof t.fullCodecString != `string`) {
    throw TypeError(`fullCodecString, when provided, must be a string.`);
  }
  if (t.fullCodecString !== undefined && qt(t.fullCodecString) !== e) {
    throw TypeError(`fullCodecString, when provided, must be a string that matches the specified codec (${e}).`);
  }
};
var nc = e => {
  let t = e.bitrate instanceof rc ? e.bitrate._toAudioBitrate(e.codec) : e.bitrate;
  return {
    codec: e.fullCodecString ?? Vt(e.codec, e.numberOfChannels, e.sampleRate),
    numberOfChannels: e.numberOfChannels,
    sampleRate: e.sampleRate,
    bitrate: t,
    bitrateMode: e.bitrateMode,
    ...Yt(e.codec)
  };
};
var rc = class {
  constructor(e) {
    this._factor = e;
  }
  _toVideoBitrate(e, t, n) {
    let r = t * n;
    let i = 3000000;
    let a = i * (r / 2073600) ** 0.95 * {
      avc: 1,
      hevc: 0.6,
      vp9: 0.6,
      av1: 0.4,
      vp8: 1.2,
      prores: 220000000 / i
    }[e] * this._factor;
    return Math.ceil(a / 1000) * 1000;
  }
  _toAudioBitrate(e) {
    if (M.includes(e) || e === `flac`) {
      return;
    }
    let t = {
      aac: 128000,
      opus: 64000,
      mp3: 160000,
      vorbis: 64000,
      ac3: 384000,
      eac3: 192000
    }[e];
    if (!t) {
      throw Error(`Unhandled codec: ${e}`);
    }
    let n = t * this._factor;
    if (e === `aac`) {
      n = [96000, 128000, 160000, 192000].reduce((e, t) => {
        if (Math.abs(t - n) < Math.abs(e - n)) {
          return t;
        } else {
          return e;
        }
      });
    } else if (e === `opus` || e === `vorbis`) {
      n = Math.max(6000, n);
    } else if (e === `mp3`) {
      n = [8000, 16000, 24000, 32000, 40000, 48000, 64000, 80000, 96000, 112000, 128000, 160000, 192000, 224000, 256000, 320000].reduce((e, t) => {
        if (Math.abs(t - n) < Math.abs(e - n)) {
          return t;
        } else {
          return e;
        }
      });
    }
    return Math.round(n / 1000) * 1000;
  }
};
var ic = new rc(0.3);
var ac = new rc(0.6);
var oc = new rc(1);
var sc = new rc(2);
var cc = new rc(4);
var lc = e => {
  if (j.includes(e)) {
    return uc(e);
  }
  if (N.includes(e)) {
    return dc(e);
  }
  if (Ot.includes(e)) {
    return fc(e);
  }
  throw TypeError(`Unknown codec '${e}'.`);
};
var uc = async (e, t = {}) => {
  let {
    width: n = 1280,
    height: r = 720,
    bitrate: i = 1000000,
    ...a
  } = t;
  if (!j.includes(e)) {
    return false;
  }
  if (!Number.isInteger(n) || n <= 0) {
    throw TypeError(`width must be a positive integer.`);
  }
  if (!Number.isInteger(r) || r <= 0) {
    throw TypeError(`height must be a positive integer.`);
  }
  if (!(i instanceof rc) && (!Number.isInteger(i) || i <= 0)) {
    throw TypeError(`bitrate must be a positive integer or a quality.`);
  }
  Qs(e, a);
  let o = $s({
    codec: e,
    width: n,
    height: r,
    bitrate: i,
    framerate: undefined,
    ...a,
    alpha: `discard`
  });
  let s = JSON.stringify(o);
  let c = Ys.get(s);
  if (c) {
    return c;
  }
  let l = (async () => {
    if (Ec.some(t => {
      return t.supports(e, o);
    })) {
      return true;
    } else {
      if (typeof VideoEncoder > `u` || (n % 2 == 1 || r % 2 == 1) && (e === `avc` || e === `hevc`) || !(await VideoEncoder.isConfigSupported(o)).supported) {
        return false;
      } else {
        if (Ne()) {
          return new Promise(async e => {
            try {
              let t = new VideoEncoder({
                output: () => {},
                error: () => {
                  return e(false);
                }
              });
              t.configure(o);
              let i = new Uint8Array(n * r * 4);
              let a = new VideoFrame(i, {
                format: `RGBA`,
                codedWidth: n,
                codedHeight: r,
                timestamp: 0
              });
              t.encode(a);
              a.close();
              await t.flush();
              e(true);
            } catch {
              e(false);
            }
          });
        } else {
          return true;
        }
      }
    }
  })();
  Ys.set(s, l);
  return l;
};
var dc = async (e, t = {}) => {
  let {
    numberOfChannels: n = 2,
    sampleRate: r = 48000,
    bitrate: i = 128000,
    ...a
  } = t;
  if (!N.includes(e)) {
    return false;
  }
  if (!Number.isInteger(n) || n <= 0) {
    throw TypeError(`numberOfChannels must be a positive integer.`);
  }
  if (!Number.isInteger(r) || r <= 0) {
    throw TypeError(`sampleRate must be a positive integer.`);
  }
  if (!(i instanceof rc) && (!Number.isInteger(i) || i <= 0)) {
    throw TypeError(`bitrate must be a positive integer.`);
  }
  tc(e, a);
  let o = nc({
    codec: e,
    numberOfChannels: n,
    sampleRate: r,
    bitrate: i,
    ...a
  });
  let s = JSON.stringify(o);
  let c = Xs.get(s);
  if (c) {
    return c;
  }
  let l = (async () => {
    if (Dc.some(t => {
      return t.supports(e, o);
    }) || M.includes(e)) {
      return true;
    } else {
      if (typeof AudioEncoder > `u`) {
        return false;
      } else {
        return (await AudioEncoder.isConfigSupported(o)).supported === true;
      }
    }
  })();
  Xs.set(s, l);
  return l;
};
var fc = async e => {
  return !!Ot.includes(e);
};
var pc = async () => {
  let [e, t, n] = await Promise.all([mc(), hc(), gc()]);
  return [...e, ...t, ...n];
};
var mc = async (e = j, t) => {
  let n = await Promise.all(e.map(e => {
    return uc(e, t);
  }));
  return e.filter((e, t) => {
    return n[t];
  });
};
var hc = async (e = N, t) => {
  let n = await Promise.all(e.map(e => {
    return dc(e, t);
  }));
  return e.filter((e, t) => {
    return n[t];
  });
};
var gc = async (e = Ot) => {
  let t = await Promise.all(e.map(fc));
  return e.filter((e, n) => {
    return t[n];
  });
};
var _c = async (e, t) => {
  for (let n of e) {
    if (await uc(n, t)) {
      return n;
    }
  }
  return null;
};
var vc = async (e, t) => {
  for (let n of e) {
    if (await dc(n, t)) {
      return n;
    }
  }
  return null;
};
var yc = async e => {
  for (let t of e) {
    if (await fc(t)) {
      return t;
    }
  }
  return null;
};
var bc = class {
  static supports(e, t) {
    return false;
  }
};
var xc = class {
  static supports(e, t) {
    return false;
  }
};
var Sc = class {
  static supports(e, t) {
    return false;
  }
};
var Cc = class {
  static supports(e, t) {
    return false;
  }
};
var wc = [];
var Tc = [];
var Ec = [];
var Dc = [];
var Oc = e => {
  if (e.prototype instanceof bc) {
    let t = e;
    if (wc.includes(t)) {
      k._warn(`Video decoder already registered.`);
      return;
    }
    wc.push(t);
    rs.clear();
  } else if (e.prototype instanceof xc) {
    let t = e;
    if (Tc.includes(t)) {
      k._warn(`Audio decoder already registered.`);
      return;
    }
    Tc.push(t);
    is.clear();
  } else {
    throw TypeError(`Decoder must be a CustomVideoDecoder or CustomAudioDecoder.`);
  }
};
var kc = e => {
  if (e.prototype instanceof Sc) {
    let t = e;
    if (Ec.includes(t)) {
      k._warn(`Video encoder already registered.`);
      return;
    }
    Ec.push(t);
    Ys.clear();
  } else if (e.prototype instanceof Cc) {
    let t = e;
    if (Dc.includes(t)) {
      k._warn(`Audio encoder already registered.`);
      return;
    }
    Dc.push(t);
    Xs.clear();
  } else {
    throw TypeError(`Encoder must be a CustomVideoEncoder or CustomAudioEncoder.`);
  }
};
var Ac = e => {
  let t = 8191;
  let n = e;
  let r = 4096;
  let i = 0;
  let a = 12;
  let o = 0;
  if (n < 0) {
    n = -n;
    i = 128;
  }
  n += 33;
  if (n > t) {
    n = t;
  }
  while ((n & r) !== r && a >= 5) {
    r >>= 1;
    a--;
  }
  o = n >> a - 4 & 15;
  return ~(i | a - 5 << 4 | o) & 255;
};
var jc = e => {
  let t = 0;
  let n = 0;
  let r = ~e;
  if (r & 128) {
    r &= -129;
    t = -1;
  }
  n = ((r & 240) >> 4) + 5;
  let i = (1 << n | (r & 15) << n - 4 | 1 << n - 5) - 33;
  if (t === 0) {
    return i;
  } else {
    return -i;
  }
};
var Mc = e => {
  let t = 4095;
  let n = 2048;
  let r = 0;
  let i = 11;
  let a = 0;
  let o = e;
  if (o < 0) {
    o = -o;
    r = 128;
  }
  if (o > t) {
    o = t;
  }
  while ((o & n) !== n && i >= 5) {
    n >>= 1;
    i--;
  }
  a = o >> (i === 4 ? 1 : i - 4) & 15;
  return (r | i - 4 << 4 | a) ^ 85;
};
var Nc = e => {
  let t = 0;
  let n = 0;
  let r = e ^ 85;
  if (r & 128) {
    r &= -129;
    t = -1;
  }
  n = ((r & 240) >> 4) + 4;
  let i = 0;
  if (n === 4) {
    i = r << 1 | 1;
  } else {
    i = 1 << n | (r & 15) << n - 4 | 1 << n - 5;
  }
  if (t === 0) {
    return i;
  } else {
    return -i;
  }
};
var Pc = e => {
  if (!e || typeof e != `object`) {
    throw TypeError(`options must be an object.`);
  }
  if (e.metadataOnly !== undefined && typeof e.metadataOnly != `boolean`) {
    throw TypeError(`options.metadataOnly, when defined, must be a boolean.`);
  }
  if (e.verifyKeyPackets !== undefined && typeof e.verifyKeyPackets != `boolean`) {
    throw TypeError(`options.verifyKeyPackets, when defined, must be a boolean.`);
  }
  if (e.verifyKeyPackets && e.metadataOnly) {
    throw TypeError(`options.verifyKeyPackets and options.metadataOnly cannot be enabled together.`);
  }
  if (e.skipLiveWait !== undefined && typeof e.skipLiveWait != `boolean`) {
    throw TypeError(`options.skipLiveWait, when defined, must be a boolean.`);
  }
};
var Fc = e => {
  if (!Ke(e)) {
    throw TypeError(`timestamp must be a number.`);
  }
};
var Ic = (e, t, n) => {
  if (n.verifyKeyPackets) {
    return t.then(async t => {
      if (!t || t.type === `delta`) {
        return t;
      }
      let n = await e.determinePacketType(t);
      if (n) {
        t.type = n;
      }
      return t;
    });
  } else {
    return t;
  }
};
var Lc = class {
  constructor(e) {
    if (!(e instanceof Qc)) {
      throw TypeError(`track must be an InputTrack.`);
    }
    this._track = e;
  }
  async getFirstPacket(e = {}) {
    Pc(e);
    if (this._track.input._disposed) {
      throw new ul();
    }
    return Ic(this._track, this._track._backing.getFirstPacket(e), e);
  }
  async getFirstKeyPacket(e = {}) {
    Pc(e);
    let t = await this.getFirstPacket(e);
    if (t) {
      if (t.type === `key`) {
        return t;
      } else {
        return this.getNextKeyPacket(t, e);
      }
    } else {
      return null;
    }
  }
  async getPacket(e, t = {}) {
    Fc(e);
    Pc(t);
    if (this._track.input._disposed) {
      throw new ul();
    }
    return Ic(this._track, this._track._backing.getPacket(e, t), t);
  }
  async getNextPacket(e, t = {}) {
    if (!(e instanceof I)) {
      throw TypeError(`packet must be an EncodedPacket.`);
    }
    Pc(t);
    if (this._track.input._disposed) {
      throw new ul();
    }
    return Ic(this._track, this._track._backing.getNextPacket(e, t), t);
  }
  async getKeyPacket(e, t = {}) {
    Fc(e);
    Pc(t);
    if (this._track.input._disposed) {
      throw new ul();
    }
    if (!t.verifyKeyPackets) {
      return this._track._backing.getKeyPacket(e, t);
    }
    let r = await this._track._backing.getKeyPacket(e, t);
    n(r.type === `key`);
    return r && ((await this._track.determinePacketType(r)) === `delta` ? this.getKeyPacket(r.timestamp - 1 / (await this._track.getTimeResolution()), t) : r);
  }
  async getNextKeyPacket(e, t = {}) {
    if (!(e instanceof I)) {
      throw TypeError(`packet must be an EncodedPacket.`);
    }
    Pc(t);
    if (this._track.input._disposed) {
      throw new ul();
    }
    if (!t.verifyKeyPackets) {
      return this._track._backing.getNextKeyPacket(e, t);
    }
    let r = await this._track._backing.getNextKeyPacket(e, t);
    n(r.type === `key`);
    return r && ((await this._track.determinePacketType(r)) === `delta` ? this.getNextKeyPacket(r, t) : r);
  }
  packets(e, t, n = {}) {
    if (e !== undefined && !(e instanceof I)) {
      throw TypeError(`startPacket must be an EncodedPacket.`);
    }
    if (e !== undefined && e.isMetadataOnly && !n?.metadataOnly) {
      throw TypeError(`startPacket can only be metadata-only if options.metadataOnly is enabled.`);
    }
    if (t !== undefined && !(t instanceof I)) {
      throw TypeError(`endPacket must be an EncodedPacket.`);
    }
    Pc(n);
    if (this._track.input._disposed) {
      throw new ul();
    }
    let r = [];
    let {
      promise: i,
      resolve: a
    } = E();
    let {
      promise: o,
      resolve: s
    } = E();
    let c = false;
    let l = false;
    let u = null;
    let d = false;
    let f = [];
    let p = () => {
      return Math.max(2, f.length);
    };
    (async () => {
      let u = e ?? (await this.getFirstPacket(n));
      while (u && !l && !this._track.input._disposed && (!t || !(u.sequenceNumber >= t?.sequenceNumber))) {
        if (r.length > p()) {
          ({
            promise: o,
            resolve: s
          } = E());
          await o;
          continue;
        }
        r.push(u);
        a();
        ({
          promise: i,
          resolve: a
        } = E());
        u = await this.getNextPacket(u, n);
      }
      c = true;
      a();
    })().catch(e => {
      if (!d) {
        u = e;
        d = true;
        a();
      }
    });
    let m = this._track;
    return {
      async next() {
        while (true) {
          if (m.input._disposed) {
            throw new ul();
          } else if (l) {
            return {
              value: undefined,
              done: true
            };
          } else if (d) {
            throw u;
          } else if (r.length > 0) {
            let e = r.shift();
            let t = performance.now();
            for (f.push(t); f.length > 0 && t - f[0] >= 1000;) {
              f.shift();
            }
            s();
            return {
              value: e,
              done: false
            };
          } else if (c) {
            return {
              value: undefined,
              done: true
            };
          } else {
            await i;
          }
        }
      },
      async return() {
        l = true;
        s();
        a();
        return {
          value: undefined,
          done: true
        };
      },
      async throw(e) {
        throw e;
      },
      [Symbol.asyncIterator]() {
        return this;
      }
    };
  }
};
var Rc = class {
  constructor(e, t) {
    this.onSample = e;
    this.onError = t;
  }
};
var zc = class {
  mediaSamplesInRange(e = -Infinity, t = Infinity, n) {
    Fc(e);
    Fc(t);
    let r = [];
    let i = false;
    let a = null;
    let {
      promise: o,
      resolve: s
    } = E();
    let {
      promise: c,
      resolve: l
    } = E();
    let u = false;
    let d = false;
    let f = false;
    let p = null;
    let m = false;
    let h = {
      ...n,
      verifyKeyPackets: true,
      metadataOnly: false
    };
    (async () => {
      let n = await this._createDecoder(n => {
        l();
        if (n.timestamp >= t) {
          d = true;
        }
        if (d) {
          n.close();
          return;
        }
        if (a) {
          if (n.timestamp > e) {
            r.push(a);
            i = true;
          } else {
            a.close();
          }
        }
        if (n.timestamp >= e) {
          r.push(n);
          i = true;
        }
        if (i) {
          a = null;
        } else {
          a = n;
        }
        if (r.length > 0) {
          s();
          ({
            promise: o,
            resolve: s
          } = E());
        }
      }, e => {
        if (!m) {
          p = e;
          m = true;
          s();
        }
      });
      let g = this._createPacketSink();
      let _ = (await g.getKeyPacket(e, h)) ?? (await g.getFirstKeyPacket(h));
      let v = _;
      let y = g.packets(_ ?? undefined, undefined, h);
      for (await y.next(); v && !d && !this._track.input._disposed;) {
        let e = Bc(r.length);
        if (r.length + n.getDecodeQueueSize() > e) {
          ({
            promise: c,
            resolve: l
          } = E());
          await c;
          continue;
        }
        n.decode(v);
        let t = await y.next();
        if (t.done) {
          break;
        }
        v = t.value;
      }
      await y.return();
      if (!f && !this._track.input._disposed) {
        await n.flush();
      }
      n.close();
      if (!i && a) {
        r.push(a);
      }
      u = true;
      s();
    })().catch(e => {
      if (!m) {
        p = e;
        m = true;
        s();
      }
    });
    let g = this._track;
    let _ = () => {
      a?.close();
      for (let e of r) {
        e.close();
      }
    };
    return {
      async next() {
        while (true) {
          if (g.input._disposed) {
            _();
            throw new ul();
          } else if (f) {
            return {
              value: undefined,
              done: true
            };
          } else if (m) {
            _();
            throw p;
          } else if (r.length > 0) {
            let e = r.shift();
            l();
            return {
              value: e,
              done: false
            };
          } else if (!u) {
            await o;
          } else {
            return {
              value: undefined,
              done: true
            };
          }
        }
      },
      async return() {
        f = true;
        d = true;
        l();
        s();
        _();
        return {
          value: undefined,
          done: true
        };
      },
      async throw(e) {
        throw e;
      },
      [Symbol.asyncIterator]() {
        return this;
      }
    };
  }
  mediaSamplesAtTimestamps(e, t) {
    le(e);
    let r = ce(e);
    let i = [];
    let a = [];
    let {
      promise: o,
      resolve: s
    } = E();
    let {
      promise: c,
      resolve: l
    } = E();
    let u = false;
    let d = false;
    let f = null;
    let p = false;
    let m = e => {
      a.push(e);
      s();
      ({
        promise: o,
        resolve: s
      } = E());
    };
    let h = {
      ...t,
      verifyKeyPackets: true,
      metadataOnly: false
    };
    (async () => {
      let e = await this._createDecoder(e => {
        l();
        if (d) {
          e.close();
          return;
        }
        let t = 0;
        while (i.length > 0 && e.timestamp - i[0] > -1e-10) {
          t++;
          i.shift();
        }
        if (t > 0) {
          for (let n = 0; n < t; n++) {
            m(n < t - 1 ? e.clone() : e);
          }
        } else {
          e.close();
        }
      }, e => {
        if (!p) {
          f = e;
          p = true;
          s();
        }
      });
      let t = this._createPacketSink();
      let o = null;
      let g = null;
      let _ = -1;
      let v = async () => {
        n(g);
        let r = g;
        for (e.decode(r); r.sequenceNumber < _;) {
          let i = Bc(a.length);
          while (a.length + e.getDecodeQueueSize() > i && !d) {
            ({
              promise: c,
              resolve: l
            } = E());
            await c;
          }
          if (d) {
            break;
          }
          let o = await t.getNextPacket(r, h);
          n(o);
          e.decode(o);
          r = o;
        }
        _ = -1;
      };
      let y = async () => {
        await e.flush();
        for (let e = 0; e < i.length; e++) {
          m(null);
        }
        i.length = 0;
      };
      for await (let e of r) {
        Fc(e);
        if (d || this._track.input._disposed) {
          break;
        }
        let n = await t.getPacket(e, h);
        let r = n && (await t.getKeyPacket(e, h));
        if (!r) {
          if (_ !== -1) {
            await v();
            await y();
          }
          m(null);
          o = null;
          continue;
        }
        if (o && (r.sequenceNumber !== g.sequenceNumber || n.timestamp < o.timestamp)) {
          await v();
          await y();
        }
        i.push(n.timestamp);
        _ = Math.max(n.sequenceNumber, _);
        o = n;
        g = r;
      }
      if (!d && !this._track.input._disposed) {
        if (_ !== -1) {
          await v();
        }
        await y();
      }
      e.close();
      u = true;
      s();
    })().catch(e => {
      if (!p) {
        f = e;
        p = true;
        s();
      }
    });
    let g = this._track;
    let _ = () => {
      for (let e of a) {
        e?.close();
      }
    };
    return {
      async next() {
        while (true) {
          if (g.input._disposed) {
            _();
            throw new ul();
          } else if (d) {
            return {
              value: undefined,
              done: true
            };
          } else if (p) {
            _();
            throw f;
          } else if (a.length > 0) {
            let e = a.shift();
            n(e !== undefined);
            l();
            return {
              value: e,
              done: false
            };
          } else if (!u) {
            await o;
          } else {
            return {
              value: undefined,
              done: true
            };
          }
        }
      },
      async return() {
        d = true;
        l();
        s();
        _();
        return {
          value: undefined,
          done: true
        };
      },
      async throw(e) {
        throw e;
      },
      [Symbol.asyncIterator]() {
        return this;
      }
    };
  }
};
var Bc = e => {
  if (e === 0) {
    return 40;
  } else {
    return 8;
  }
};
var Vc = class extends Rc {
  constructor(e, t, r, i, a, o) {
    super(e, t);
    this.codec = r;
    this.decoderConfig = i;
    this.rotation = a;
    this.timeResolution = o;
    this.decoder = null;
    this.customDecoder = null;
    this.customDecoderCallSerializer = new ke();
    this.customDecoderQueueSize = 0;
    this.inputTimestamps = [];
    this.sampleQueue = [];
    this.currentPacketIndex = 0;
    this.raslSkipped = false;
    this.alphaDecoder = null;
    this.alphaHadKeyframe = false;
    this.colorQueue = [];
    this.alphaQueue = [];
    this.merger = null;
    this.decodedAlphaChunkCount = 0;
    this.alphaDecoderQueueSize = 0;
    this.nullAlphaFrameQueue = [];
    this.currentAlphaPacketIndex = 0;
    this.alphaRaslSkipped = false;
    this.finalSamples = [];
    this.mergeAlphaPromises = [];
    let s = wc.find(e => {
      return e.supports(r, i);
    });
    if (s) {
      this.customDecoder = new s();
      this.customDecoder.codec = r;
      this.customDecoder.config = i;
      this.customDecoder.onSample = e => {
        if (!(e instanceof _cmp_xs)) {
          throw TypeError(`The argument passed to onSample must be a VideoSample.`);
        }
        this.finalizeAndEmitSample(e);
      };
      this.customDecoder.onError = e => {
        t(e);
      };
      this.customDecoderCallSerializer.call(() => {
        return this.customDecoder.init();
      }).catch(e => {
        return t(e);
      });
    } else {
      let e = e => {
        if (this.alphaQueue.length > 0) {
          let t = this.alphaQueue.shift();
          n(t !== undefined);
          this.mergeAlpha(e, t);
        } else {
          this.colorQueue.push(e);
        }
      };
      if (r === `avc` && this.decoderConfig.description && Fe()) {
        let e = An(l(this.decoderConfig.description));
        if (e && e.sequenceParameterSets.length > 0) {
          let t = Mn(e.sequenceParameterSets[0]);
          if (t && t.frameMbsOnlyFlag === 0) {
            this.decoderConfig = {
              ...this.decoderConfig,
              hardwareAcceleration: `prefer-software`
            };
          }
        }
      }
      let t = Error(`Decoding error`).stack;
      this.decoder = new VideoDecoder({
        output: t => {
          try {
            e(t);
          } catch (e) {
            this.onError(e);
          }
        },
        error: e => {
          e.stack = t;
          this.onError(e);
        }
      });
      this.decoder.configure(this.decoderConfig);
    }
  }
  getDecodeQueueSize() {
    if (this.customDecoder) {
      return this.customDecoderQueueSize;
    } else {
      n(this.decoder);
      return Math.max(this.decoder.decodeQueueSize, this.alphaDecoder?.decodeQueueSize ?? 0);
    }
  }
  decode(e) {
    if (this.codec === `hevc` && this.currentPacketIndex > 0 && !this.raslSkipped) {
      if (this.hasHevcRaslPicture(e.data)) {
        return;
      }
      this.raslSkipped = true;
    }
    if (this.customDecoder) {
      this.customDecoderQueueSize++;
      this.customDecoderCallSerializer.call(() => {
        return this.customDecoder.decode(e);
      }).catch(e => {
        return this.onError(e);
      }).finally(() => {
        return this.customDecoderQueueSize--;
      });
    } else {
      n(this.decoder);
      if (!je()) {
        ie(this.inputTimestamps, e.timestamp, e => {
          return e;
        });
      }
      if (Fe() && this.currentPacketIndex === 0) {
        if (this.codec === `avc`) {
          let t = [];
          let n = false;
          for (let r of xn(e.data, this.decoderConfig)) {
            let i = Sn(e.data[r.offset]);
            n ||= i >= 1 && i <= 5;
            if (i === P.AUD) {
              if (n) {
                break;
              }
              t.length = 0;
            }
            if (!(i >= 20) || !(i <= 31)) {
              t.push(e.data.subarray(r.offset, r.offset + r.length));
            }
          }
          e = new I(Dn(t, this.decoderConfig), e.type, e.timestamp, e.duration);
        } else if (this.codec === `hevc`) {
          let t = Yn(e.data, this.decoderConfig);
          if (t) {
            e = new I(t, e.type, e.timestamp, e.duration);
          }
        }
      }
      this.decoder.decode(e.toEncodedVideoChunk());
      this.decodeAlphaData(e);
    }
    this.currentPacketIndex++;
  }
  decodeAlphaData(e) {
    if (!e.sideData.alpha) {
      this.pushNullAlphaFrame();
      return;
    }
    this.merger ||= new Uc();
    if (!this.alphaDecoder) {
      let e = e => {
        if (this.colorQueue.length > 0) {
          let t = this.colorQueue.shift();
          n(t !== undefined);
          this.mergeAlpha(t, e);
        } else {
          this.alphaQueue.push(e);
        }
        for (this.decodedAlphaChunkCount++; this.nullAlphaFrameQueue.length > 0 && this.nullAlphaFrameQueue[0] === this.decodedAlphaChunkCount;) {
          this.nullAlphaFrameQueue.shift();
          if (this.colorQueue.length > 0) {
            let e = this.colorQueue.shift();
            n(e !== undefined);
            this.mergeAlpha(e, null);
          } else {
            this.alphaQueue.push(null);
          }
        }
        this.alphaDecoderQueueSize--;
      };
      let t = Error(`Decoding error`).stack;
      this.alphaDecoder = new VideoDecoder({
        output: t => {
          try {
            e(t);
          } catch (e) {
            this.onError(e);
          }
        },
        error: e => {
          e.stack = t;
          this.onError(e);
        }
      });
      this.alphaDecoder.configure(this.decoderConfig);
    }
    let t = rr(this.codec, this.decoderConfig, e.sideData.alpha);
    this.alphaHadKeyframe ||= t === `key`;
    if (this.alphaHadKeyframe) {
      if (this.codec === `hevc` && this.currentAlphaPacketIndex > 0 && !this.alphaRaslSkipped) {
        if (this.hasHevcRaslPicture(e.sideData.alpha)) {
          this.pushNullAlphaFrame();
          return;
        }
        this.alphaRaslSkipped = true;
      }
      this.currentAlphaPacketIndex++;
      this.alphaDecoder.decode(e.alphaToEncodedVideoChunk(t ?? e.type));
      this.alphaDecoderQueueSize++;
    } else {
      this.pushNullAlphaFrame();
    }
  }
  pushNullAlphaFrame() {
    if (this.alphaDecoderQueueSize === 0) {
      this.alphaQueue.push(null);
    } else {
      this.nullAlphaFrameQueue.push(this.decodedAlphaChunkCount + this.alphaDecoderQueueSize);
    }
  }
  hasHevcRaslPicture(e) {
    for (let t of Fn(e, this.decoderConfig)) {
      let n = In(e[t.offset]);
      if (n === F.RASL_N || n === F.RASL_R) {
        return true;
      }
    }
    return false;
  }
  sampleHandler(e) {
    if (je()) {
      if (this.sampleQueue.length > 0 && e.timestamp >= i(this.sampleQueue).timestamp) {
        for (let e of this.sampleQueue) {
          this.finalizeAndEmitSample(e);
        }
        this.sampleQueue.length = 0;
      }
      ie(this.sampleQueue, e, e => {
        return e.timestamp;
      });
    } else {
      let t = this.inputTimestamps.shift();
      n(t !== undefined);
      e.setTimestamp(t);
      this.finalizeAndEmitSample(e);
    }
  }
  finalizeAndEmitSample(e) {
    e.setTimestamp(Math.round(e.timestamp * this.timeResolution) / this.timeResolution);
    e.setDuration(Math.round(e.duration * this.timeResolution) / this.timeResolution);
    e.setRotation(this.rotation);
    this.onSample(e);
  }
  async mergeAlpha(e, t) {
    let r = E();
    this.mergeAlphaPromises.push(r.promise);
    let i = {
      sample: null
    };
    this.finalSamples.push(i);
    try {
      n(this.merger);
      for (t ? i.sample = new _cmp_xs(await this.merger.merge(e, t)) : i.sample = new _cmp_xs(e); this.finalSamples.length > 0 && this.finalSamples[0].sample !== null;) {
        let e = this.finalSamples.shift();
        this.sampleHandler(e.sample);
      }
    } catch (e) {
      ae(this.finalSamples, i);
      this.onError(e);
    } finally {
      ae(this.mergeAlphaPromises, r.promise);
      r.resolve();
    }
  }
  async flush() {
    if (this.customDecoder) {
      await this.customDecoderCallSerializer.call(() => {
        return this.customDecoder.flush();
      });
    } else {
      n(this.decoder);
      await Promise.all([this.decoder.flush(), this.alphaDecoder?.flush()]);
      await Promise.all(this.mergeAlphaPromises);
      this.colorQueue.forEach(e => {
        return e.close();
      });
      this.colorQueue.length = 0;
      this.alphaQueue.forEach(e => {
        return e?.close();
      });
      this.alphaQueue.length = 0;
      this.alphaHadKeyframe = false;
      this.decodedAlphaChunkCount = 0;
      this.alphaDecoderQueueSize = 0;
      this.nullAlphaFrameQueue.length = 0;
      this.currentAlphaPacketIndex = 0;
      this.alphaRaslSkipped = false;
    }
    if (je()) {
      for (let e of this.sampleQueue) {
        this.finalizeAndEmitSample(e);
      }
      this.sampleQueue.length = 0;
    }
    this.currentPacketIndex = 0;
    this.raslSkipped = false;
  }
  close() {
    if (this.customDecoder) {
      this.customDecoderCallSerializer.call(() => {
        return this.customDecoder.close();
      });
    } else {
      n(this.decoder);
      this.decoder.close();
      this.alphaDecoder?.close();
      this.colorQueue.forEach(e => {
        return e.close();
      });
      this.colorQueue.length = 0;
      this.alphaQueue.forEach(e => {
        return e?.close();
      });
      this.alphaQueue.length = 0;
      this.merger?.close();
    }
    for (let e of this.sampleQueue) {
      e.close();
    }
    this.sampleQueue.length = 0;
  }
};
var Hc = null;
var Uc = class {
  constructor() {
    this.workers = [];
    this.nextWorkerIndex = 0;
    this.pendingRequests = new Map();
    this.nextRequestId = 0;
  }
  merge(e, t) {
    if (this.workers.length === 0) {
      if (!Hc) {
        let e = new Blob([`(${Wc.toString()})()`], {
          type: `application/javascript`
        });
        Hc = URL.createObjectURL(e);
      }
      let e = O(navigator.hardwareConcurrency, 1, 4);
      for (let t = 0; t < e; t++) {
        let e = new Worker(Hc);
        e.addEventListener(`message`, e => {
          let t = e.data;
          let n = this.pendingRequests.get(t.id);
          if (n) {
            this.pendingRequests.delete(t.id);
            if (`error` in t) {
              n.reject(Error(t.error));
            } else {
              n.resolve(t.frame);
            }
          }
        });
        e.addEventListener(`error`, e => {
          let t = Error(e.message || `Color/alpha merge worker error.`);
          for (let e of this.pendingRequests.values()) {
            e.reject(t);
          }
          this.pendingRequests.clear();
        });
        this.workers.push(e);
      }
    }
    let n = this.nextRequestId++;
    let r = E();
    this.pendingRequests.set(n, r);
    let i = this.workers[this.nextWorkerIndex];
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
    i.postMessage({
      id: n,
      color: e,
      alpha: t
    }, {
      transfer: [e, t]
    });
    return r.promise;
  }
  close() {
    for (let e of this.workers) {
      e.terminate();
    }
    this.workers.length = 0;
    let e = Error(`Color/alpha merger closed.`);
    for (let t of this.pendingRequests.values()) {
      t.reject(e);
    }
    this.pendingRequests.clear();
  }
};
var Wc = () => {
  let e = null;
  let t = null;
  let n = Promise.resolve();
  self.addEventListener(`message`, e => {
    let {
      id: t,
      color: i,
      alpha: a
    } = e.data;
    n = n.then(async () => {
      try {
        let e = await r(i, a);
        self.postMessage({
          id: t,
          frame: e
        }, {
          transfer: [e]
        });
      } catch (e) {
        self.postMessage({
          id: t,
          error: e.message
        });
      } finally {
        i.close();
        a.close();
      }
    });
  });
  let r = async (e, t) => {
    let n = e.format;
    let r = t.format;
    if (!n || !r) {
      throw Error(`CPU color/alpha merging requires a known VideoFrame format.`);
    }
    let s = n.includes(`P10`);
    let c = n.includes(`P12`);
    let l = r.includes(`P10`);
    let u = r.includes(`P12`);
    if (l !== s || u !== c) {
      throw Error(`CPU color/alpha merging requires the alpha frame to have the same bit depth as the color frame (color: '${n}', alpha: '${r}').`);
    }
    if (n === `RGBX` || n === `RGBA` || n === `BGRX` || n === `BGRA`) {
      return await i(e, t, n);
    }
    if (n === `I420` || n === `I420P10` || n === `I420P12` || n === `I422` || n === `I422P10` || n === `I422P12` || n === `I444` || n === `I444P10` || n === `I444P12`) {
      return await a(e, t, n);
    }
    if (n === `NV12`) {
      return await o(e, t);
    }
    throw Error(`CPU color/alpha merging does not support format '${n}'.`);
  };
  let i = async (e, t, n) => {
    let r = e.visibleRect?.width ?? e.codedWidth;
    let i = e.visibleRect?.height ?? e.codedHeight;
    let a = r * i;
    let o = new Uint8Array(a * 4);
    await e.copyTo(o);
    let c = await s(t, r, i, 1);
    e++;
    for (let e = 0, t = 3; e < a; t += 4) {
      o[t] = c[e];
    }
    let l = {
      format: n === `RGBX` || n === `RGBA` ? `RGBA` : `BGRA`,
      codedWidth: r,
      codedHeight: i,
      timestamp: e.timestamp,
      duration: e.duration ?? undefined,
      transfer: [o.buffer]
    };
    return new VideoFrame(o, l);
  };
  let a = async (e, t, n) => {
    let r = e.visibleRect?.width ?? e.codedWidth;
    let i = e.visibleRect?.height ?? e.codedHeight;
    let a = n.includes(`P10`);
    let o = n.includes(`P12`);
    let c = a || o ? 2 : 1;
    let l;
    let u;
    if (n.startsWith(`I420`)) {
      l = Math.ceil(r / 2);
      u = Math.ceil(i / 2);
    } else if (n.startsWith(`I422`)) {
      l = Math.ceil(r / 2);
      u = i;
    } else {
      l = r;
      u = i;
    }
    let d = r * i;
    let f = l * u;
    let p = d * c;
    let m = f * c;
    let h = d * c;
    let g = p + m * 2 + h;
    let _ = new Uint8Array(g);
    await e.copyTo(_);
    let v = await s(t, r, i, c);
    let y = p + m * 2;
    _.set(v, y);
    let b = {
      format: `${n.slice(0, 4)}A${n.slice(4)}`,
      codedWidth: r,
      codedHeight: i,
      timestamp: e.timestamp,
      duration: e.duration ?? undefined,
      transfer: [_.buffer]
    };
    return new VideoFrame(_, b);
  };
  let o = async (e, n) => {
    let r = e.visibleRect?.width ?? e.codedWidth;
    let i = e.visibleRect?.height ?? e.codedHeight;
    let a = r * i;
    let o = Math.ceil(r / 2) * Math.ceil(i / 2);
    let c = e.allocationSize();
    if (!t || t.byteLength !== c) {
      t = new Uint8Array(c);
    }
    await e.copyTo(t);
    let l = new Uint8Array(a + o * 2 + a);
    l.set(t.subarray(0, a), 0);
    let u = a;
    let d = a + o;
    let f = a;
    for (let e = 0; e < o; e++) {
      l[u + e] = t[f + e * 2];
      l[d + e] = t[f + e * 2 + 1];
    }
    let p = await s(n, r, i, 1);
    l.set(p, a + o * 2);
    let m = {
      format: `I420A`,
      codedWidth: r,
      codedHeight: i,
      timestamp: e.timestamp,
      duration: e.duration ?? undefined,
      transfer: [l.buffer]
    };
    return new VideoFrame(l, m);
  };
  let s = async (t, n, r, i) => {
    let a = t.allocationSize();
    if (!e || e.byteLength !== a) {
      e = new Uint8Array(a);
    }
    await t.copyTo(e);
    let o = t.format;
    if (o === `RGBA` || o === `BGRA` || o === `RGBX` || o === `BGRX`) {
      let t = o === `RGBA` || o === `RGBX` ? 0 : 2;
      let i = n * r;
      for (let n = 0; n < i; n++) {
        e[n] = e[n * 4 + t];
      }
      return e.subarray(0, i);
    } else {
      return e.subarray(0, n * r * i);
    }
  };
};
var Gc = e => {
  if (!e || typeof e != `object`) {
    throw TypeError(`decoderOptions must be an object.`);
  }
  if (e.hardwareAcceleration !== undefined && ![`no-preference`, `prefer-hardware`, `prefer-software`].includes(e.hardwareAcceleration)) {
    throw TypeError(`decoderOptions.hardwareAcceleration, when provided, must be 'no-preference', 'prefer-hardware' or 'prefer-software'.`);
  }
  if (e.optimizeForLatency !== undefined && typeof e.optimizeForLatency != `boolean`) {
    throw TypeError(`decoderOptions.optimizeForLatency, when provided, must be a boolean.`);
  }
};
var Kc = class extends zc {
  constructor(e, t = {}) {
    if (!(e instanceof el)) {
      throw TypeError(`videoTrack must be an InputVideoTrack.`);
    }
    Gc(t);
    super();
    this._track = e;
    this._decoderOptions = t;
  }
  async _createDecoder(e, t) {
    if (!(await this._track.canDecode())) {
      throw Error(`This video track cannot be decoded by this browser. Make sure to check decodability before using a track.`);
    }
    let r = await this._track.getCodec();
    let i = await this._track.getRotation();
    let a = await this._track.getDecoderConfig();
    let o = await this._track.getTimeResolution();
    n(r && a);
    a = {
      ...a,
      hardwareAcceleration: this._decoderOptions.hardwareAcceleration,
      optimizeForLatency: this._decoderOptions.optimizeForLatency
    };
    return new Vc(e, t, r, a, i, o);
  }
  _createPacketSink() {
    return new Lc(this._track);
  }
  async getSample(e, t = {}) {
    Fc(e);
    for await (let n of this.mediaSamplesAtTimestamps([e], t)) {
      return n;
    }
    throw Error(`Internal error: Iterator returned nothing.`);
  }
  samples(e, t, n = {}) {
    return this.mediaSamplesInRange(e, t, n);
  }
  samplesAtTimestamps(e, t = {}) {
    return this.mediaSamplesAtTimestamps(e, t);
  }
};
var Jc = class extends Rc {
  constructor(e, t, n, r) {
    super(e, t);
    this.decoder = null;
    this.customDecoder = null;
    this.customDecoderCallSerializer = new ke();
    this.customDecoderQueueSize = 0;
    this.currentTimestamp = null;
    this.expectedFirstTimestamp = null;
    this.timestampOffset = 0;
    let i = t => {
      let n = t.timestamp;
      if (this.expectedFirstTimestamp && this.currentTimestamp === null) {
        this.timestampOffset = this.expectedFirstTimestamp - n;
      }
      n += this.timestampOffset;
      if (this.currentTimestamp === null || Math.abs(n - this.currentTimestamp) >= t.duration) {
        this.currentTimestamp = n;
      }
      let i = this.currentTimestamp;
      this.currentTimestamp += t.duration;
      if (t.numberOfFrames === 0) {
        t.close();
        return;
      }
      let a = r.sampleRate;
      t.setTimestamp(Math.round(i * a) / a);
      e(t);
    };
    let a = Tc.find(e => {
      return e.supports(n, r);
    });
    if (a) {
      this.customDecoder = new a();
      this.customDecoder.codec = n;
      this.customDecoder.config = r;
      this.customDecoder.onSample = e => {
        if (!(e instanceof Bs)) {
          throw TypeError(`The argument passed to onSample must be an AudioSample.`);
        }
        i(e);
      };
      this.customDecoder.onError = e => {
        t(e);
      };
      this.customDecoderCallSerializer.call(() => {
        return this.customDecoder.init();
      }).catch(e => {
        return t(e);
      });
    } else {
      let e = Error(`Decoding error`).stack;
      this.decoder = new AudioDecoder({
        output: e => {
          try {
            i(new Bs(e));
          } catch (e) {
            this.onError(e);
          }
        },
        error: t => {
          t.stack = e;
          this.onError(t);
        }
      });
      this.decoder.configure(r);
    }
  }
  getDecodeQueueSize() {
    if (this.customDecoder) {
      return this.customDecoderQueueSize;
    } else {
      n(this.decoder);
      return this.decoder.decodeQueueSize;
    }
  }
  decode(e) {
    if (this.customDecoder) {
      this.customDecoderQueueSize++;
      this.customDecoderCallSerializer.call(() => {
        return this.customDecoder.decode(e);
      }).catch(e => {
        return this.onError(e);
      }).finally(() => {
        return this.customDecoderQueueSize--;
      });
    } else {
      n(this.decoder);
      this.expectedFirstTimestamp ??= e.timestamp;
      this.decoder.decode(e.toEncodedAudioChunk());
    }
  }
  async flush() {
    if (this.customDecoder) {
      await this.customDecoderCallSerializer.call(() => {
        return this.customDecoder.flush();
      });
    } else {
      n(this.decoder);
      await this.decoder.flush();
    }
    this.currentTimestamp = null;
    this.expectedFirstTimestamp = null;
    this.timestampOffset = 0;
  }
  close() {
    if (this.customDecoder) {
      this.customDecoderCallSerializer.call(() => {
        return this.customDecoder.close();
      });
    } else {
      n(this.decoder);
      this.decoder.close();
    }
  }
};
var Yc = class extends Rc {
  constructor(e, t, r) {
    super(e, t);
    this.decoderConfig = r;
    this.currentTimestamp = null;
    n(M.includes(r.codec));
    this.codec = r.codec;
    let {
      dataType: i,
      sampleSize: a,
      littleEndian: o
    } = Kt(this.codec);
    this.inputSampleSize = a;
    switch (a) {
      case 1:
        {
          if (i === `unsigned`) {
            this.readInputValue = (e, t) => {
              return e.getUint8(t) - 128;
            };
          } else if (i === `signed`) {
            this.readInputValue = (e, t) => {
              return e.getInt8(t);
            };
          } else if (i === `ulaw`) {
            this.readInputValue = (e, t) => {
              return jc(e.getUint8(t));
            };
          } else if (i === `alaw`) {
            this.readInputValue = (e, t) => {
              return Nc(e.getUint8(t));
            };
          } else {
            n(false);
          }
          break;
        }
      case 2:
        {
          if (i === `unsigned`) {
            this.readInputValue = (e, t) => {
              return e.getUint16(t, o) - 32768;
            };
          } else if (i === `signed`) {
            this.readInputValue = (e, t) => {
              return e.getInt16(t, o);
            };
          } else {
            n(false);
          }
          break;
        }
      case 3:
        {
          if (i === `unsigned`) {
            this.readInputValue = (e, t) => {
              return ue(e, t, o) - 8388608;
            };
          } else if (i === `signed`) {
            this.readInputValue = (e, t) => {
              return de(e, t, o);
            };
          } else {
            n(false);
          }
          break;
        }
      case 4:
        {
          if (i === `unsigned`) {
            this.readInputValue = (e, t) => {
              return e.getUint32(t, o) - 2147483648;
            };
          } else if (i === `signed`) {
            this.readInputValue = (e, t) => {
              return e.getInt32(t, o);
            };
          } else if (i === `float`) {
            this.readInputValue = (e, t) => {
              return e.getFloat32(t, o);
            };
          } else {
            n(false);
          }
          break;
        }
      case 8:
        {
          if (i === `float`) {
            this.readInputValue = (e, t) => {
              return e.getFloat64(t, o);
            };
          } else {
            n(false);
          }
          break;
        }
      default:
        {
          D(a);
          n(false);
        }
    }
    switch (a) {
      case 1:
        {
          if (i === `ulaw` || i === `alaw`) {
            this.outputSampleSize = 2;
            this.outputFormat = `s16`;
            this.writeOutputValue = (e, t, n) => {
              return e.setInt16(t, n, true);
            };
          } else {
            this.outputSampleSize = 1;
            this.outputFormat = `u8`;
            this.writeOutputValue = (e, t, n) => {
              return e.setUint8(t, n + 128);
            };
          }
          break;
        }
      case 2:
        {
          this.outputSampleSize = 2;
          this.outputFormat = `s16`;
          this.writeOutputValue = (e, t, n) => {
            return e.setInt16(t, n, true);
          };
          break;
        }
      case 3:
        {
          this.outputSampleSize = 4;
          this.outputFormat = `s32`;
          this.writeOutputValue = (e, t, n) => {
            return e.setInt32(t, n << 8, true);
          };
          break;
        }
      case 4:
        {
          this.outputSampleSize = 4;
          if (i === `float`) {
            this.outputFormat = `f32`;
            this.writeOutputValue = (e, t, n) => {
              return e.setFloat32(t, n, true);
            };
          } else {
            this.outputFormat = `s32`;
            this.writeOutputValue = (e, t, n) => {
              return e.setInt32(t, n, true);
            };
          }
          break;
        }
      case 8:
        {
          this.outputSampleSize = 4;
          this.outputFormat = `f32`;
          this.writeOutputValue = (e, t, n) => {
            return e.setFloat32(t, n, true);
          };
          break;
        }
      default:
        {
          D(a);
          n(false);
        }
    }
  }
  getDecodeQueueSize() {
    return 0;
  }
  decode(e) {
    let t = u(e.data);
    let n = e.byteLength / this.decoderConfig.numberOfChannels / this.inputSampleSize;
    let r = n * this.decoderConfig.numberOfChannels * this.outputSampleSize;
    let i = new ArrayBuffer(r);
    let a = new DataView(i);
    for (let e = 0; e < n * this.decoderConfig.numberOfChannels; e++) {
      let n = e * this.inputSampleSize;
      let r = e * this.outputSampleSize;
      let i = this.readInputValue(t, n);
      this.writeOutputValue(a, r, i);
    }
    let o = n / this.decoderConfig.sampleRate;
    if (this.currentTimestamp === null || Math.abs(e.timestamp - this.currentTimestamp) >= o) {
      this.currentTimestamp = e.timestamp;
    }
    let s = this.currentTimestamp;
    this.currentTimestamp += o;
    let c = new Bs({
      format: this.outputFormat,
      data: i,
      numberOfChannels: this.decoderConfig.numberOfChannels,
      sampleRate: this.decoderConfig.sampleRate,
      numberOfFrames: n,
      timestamp: s
    });
    this.onSample(c);
  }
  async flush() {}
  close() {}
};
var Xc = class extends zc {
  constructor(e) {
    if (!(e instanceof tl)) {
      throw TypeError(`audioTrack must be an InputAudioTrack.`);
    }
    super();
    this._track = e;
  }
  async _createDecoder(e, t) {
    if (!(await this._track.canDecode())) {
      throw Error(`This audio track cannot be decoded by this browser. Make sure to check decodability before using a track.`);
    }
    let r = await this._track.getCodec();
    let i = await this._track.getDecoderConfig();
    n(r && i);
    if (M.includes(i.codec)) {
      return new Yc(e, t, i);
    } else {
      return new Jc(e, t, r, i);
    }
  }
  _createPacketSink() {
    return new Lc(this._track);
  }
  async getSample(e, t = {}) {
    Fc(e);
    for await (let n of this.mediaSamplesAtTimestamps([e], t)) {
      return n;
    }
    throw Error(`Internal error: Iterator returned nothing.`);
  }
  samples(e, t, n = {}) {
    return this.mediaSamplesInRange(e, t, n);
  }
  samplesAtTimestamps(e, t = {}) {
    return this.mediaSamplesAtTimestamps(e, t);
  }
};
var Zc = class {
  constructor(e) {
    if (!(e instanceof tl)) {
      throw TypeError(`audioTrack must be an InputAudioTrack.`);
    }
    this._audioSampleSink = new Xc(e);
  }
  _audioSampleToWrappedArrayBuffer(e) {
    let t = {
      buffer: e.toAudioBuffer(),
      timestamp: e.timestamp,
      duration: e.duration
    };
    e.close();
    return t;
  }
  async getBuffer(e, t) {
    Fc(e);
    let n = await this._audioSampleSink.getSample(e, t);
    return n && this._audioSampleToWrappedArrayBuffer(n);
  }
  buffers(e, t, n) {
    return he(this._audioSampleSink.samples(e, t, n), e => {
      return this._audioSampleToWrappedArrayBuffer(e);
    });
  }
  buffersAtTimestamps(e, t) {
    return he(this._audioSampleSink.samplesAtTimestamps(e, t), e => {
      return e && this._audioSampleToWrappedArrayBuffer(e);
    });
  }
};
var Qc = class e {
  constructor(e, t) {
    this.input = e;
    this._backing = t;
  }
  isVideoTrack() {
    return this instanceof el;
  }
  isAudioTrack() {
    return this instanceof tl;
  }
  get id() {
    return this._backing.getId();
  }
  get number() {
    return this._backing.getNumber();
  }
  async getInternalCodecId() {
    return this._backing.getInternalCodecId();
  }
  get internalCodecId() {
    return z(this._backing.getInternalCodecId(), `internalCodecId`, `getInternalCodecId`);
  }
  async getLanguageCode() {
    return this._backing.getLanguageCode();
  }
  get languageCode() {
    return z(this._backing.getLanguageCode(), `languageCode`, `getLanguageCode`);
  }
  async getName() {
    return this._backing.getName();
  }
  get name() {
    return z(this._backing.getName(), `name`, `getName`);
  }
  async getTimeResolution() {
    return this._backing.getTimeResolution();
  }
  get timeResolution() {
    return z(this._backing.getTimeResolution(), `timeResolution`, `getTimeResolution`);
  }
  async isRelativeToUnixEpoch() {
    return this._backing.isRelativeToUnixEpoch();
  }
  async getUnixTimeForTimestamp(e) {
    return this._backing.getUnixTimeForTimestamp(e);
  }
  async hasUnixTimeMapping() {
    return (await this._backing.getUnixTimeForTimestamp(await this.getFirstTimestamp())) !== null;
  }
  async getDisposition() {
    return this._backing.getDisposition();
  }
  get disposition() {
    return z(this._backing.getDisposition(), `disposition`, `getDisposition`);
  }
  async getBitrate() {
    return this._backing.getBitrate();
  }
  async getAverageBitrate() {
    return this._backing.getAverageBitrate();
  }
  async getFirstTimestamp() {
    return (await this._backing.getFirstPacket({
      metadataOnly: true
    }))?.timestamp ?? 0;
  }
  async computeDuration(e) {
    let t = await this._backing.getPacket(Infinity, {
      metadataOnly: true,
      ...e
    });
    return ve((t?.timestamp ?? 0) + (t?.duration ?? 0), await this.getTimeResolution());
  }
  async getDurationFromMetadata(e = {}) {
    return this._backing.getDurationFromMetadata(e);
  }
  async computePacketStats(e = Infinity, t) {
    let n = new Lc(this);
    let r = Infinity;
    let i = -Infinity;
    let a = 0;
    let o = 0;
    for await (let s of n.packets(undefined, undefined, {
      metadataOnly: true,
      ...t
    })) {
      if (a >= e && s.timestamp >= i) {
        break;
      }
      r = Math.min(r, s.timestamp);
      i = Math.max(i, s.timestamp + s.duration);
      a++;
      o += s.byteLength;
    }
    return {
      packetCount: a,
      averagePacketRate: a ? Number((a / (i - r)).toPrecision(16)) : 0,
      averageBitrate: a ? Number((o * 8 / (i - r)).toPrecision(16)) : 0
    };
  }
  async isLive() {
    return (await this._backing.getLiveRefreshInterval()) !== null;
  }
  async getLiveRefreshInterval() {
    return this._backing.getLiveRefreshInterval();
  }
  canBePairedWith(t) {
    if (!(t instanceof e)) {
      throw TypeError(`other must be an InputTrack.`);
    }
    if (this.input !== t.input || this === t) {
      return false;
    } else {
      return (this._backing.getPairingMask() & t._backing.getPairingMask()) !== 0n;
    }
  }
  async getPairableTracks(e) {
    return this.input.getTracks(ol({
      filter: e => {
        return e.canBePairedWith(this);
      }
    }, e));
  }
  async getPairableVideoTracks(e) {
    return this.input.getVideoTracks(ol({
      filter: e => {
        return e.canBePairedWith(this);
      }
    }, e));
  }
  async getPairableAudioTracks(e) {
    return this.input.getAudioTracks(ol({
      filter: e => {
        return e.canBePairedWith(this);
      }
    }, e));
  }
  async getPrimaryPairableVideoTrack(e) {
    return this.input.getPrimaryVideoTrack(ol({
      filter: e => {
        return e.canBePairedWith(this);
      }
    }, e));
  }
  async getPrimaryPairableAudioTrack(e) {
    return this.input.getPrimaryAudioTrack(ol({
      filter: e => {
        return e.canBePairedWith(this);
      }
    }, e));
  }
  async hasPairableTrack(e) {
    e &&= $c(e);
    let t = await this.input.getTracks();
    for (let n of t) {
      if (this.canBePairedWith(n) && (!e || (await e(n)))) {
        return true;
      }
    }
    return false;
  }
  hasPairableVideoTrack(e) {
    e &&= $c(e);
    return this.hasPairableTrack(async t => {
      return t.isVideoTrack() && (!e || (await e(t)));
    });
  }
  hasPairableAudioTrack(e) {
    e &&= $c(e);
    return this.hasPairableTrack(async t => {
      return t.isAudioTrack() && (!e || (await e(t)));
    });
  }
};
var z = (e, t, n) => {
  if (e instanceof Promise) {
    throw Error(`'${t}' is deprecated and not available synchronously for this track. Use the preferred '${n}()' instead.`);
  }
  return e;
};
var $c = e => {
  if (e !== undefined && typeof e != `function`) {
    throw TypeError(`predicate, when provided, must be a function.`);
  }
  if (e) {
    return t => {
      let n = e => {
        if (typeof e != `boolean`) {
          throw TypeError(`predicate must return or resolve to a boolean value.`);
        }
        return e;
      };
      let r = e(t);
      if (r instanceof Promise) {
        return r.then(n);
      } else {
        return n(r);
      }
    };
  } else {
    return undefined;
  }
};
var el = class extends Qc {
  constructor(e, t) {
    super(e, t);
    this._pixelAspectRatioCache = null;
    this._backing = t;
  }
  get type() {
    return `video`;
  }
  async getCodec() {
    return this._backing.getCodec();
  }
  get codec() {
    return z(this._backing.getCodec(), `codec`, `getCodec`);
  }
  async hasOnlyKeyPackets() {
    return (await this._backing.getHasOnlyKeyPackets?.()) ?? (await this._backing.getCodec()) === `prores`;
  }
  async getCodedWidth() {
    return this._backing.getCodedWidth();
  }
  get codedWidth() {
    return z(this._backing.getCodedWidth(), `codedWidth`, `getCodedWidth`);
  }
  async getCodedHeight() {
    return this._backing.getCodedHeight();
  }
  get codedHeight() {
    return z(this._backing.getCodedHeight(), `codedHeight`, `getCodedHeight`);
  }
  async getRotation() {
    return this._backing.getRotation();
  }
  get rotation() {
    return z(this._backing.getRotation(), `rotation`, `getRotation`);
  }
  async getSquarePixelWidth() {
    return this._backing.getSquarePixelWidth();
  }
  get squarePixelWidth() {
    return z(this._backing.getSquarePixelWidth(), `squarePixelWidth`, `getSquarePixelWidth`);
  }
  async getSquarePixelHeight() {
    return this._backing.getSquarePixelHeight();
  }
  get squarePixelHeight() {
    return z(this._backing.getSquarePixelHeight(), `squarePixelHeight`, `getSquarePixelHeight`);
  }
  async getPixelAspectRatio() {
    return this._pixelAspectRatioCache ??= Ze({
      num: (await this.getSquarePixelWidth()) * (await this.getCodedHeight()),
      den: (await this.getSquarePixelHeight()) * (await this.getCodedWidth())
    });
  }
  get pixelAspectRatio() {
    return this._pixelAspectRatioCache ??= Ze({
      num: z(this._backing.getSquarePixelWidth(), `pixelAspectRatio`, `getPixelAspectRatio`) * z(this._backing.getCodedHeight(), `pixelAspectRatio`, `getPixelAspectRatio`),
      den: z(this._backing.getSquarePixelHeight(), `pixelAspectRatio`, `getPixelAspectRatio`) * z(this._backing.getCodedWidth(), `pixelAspectRatio`, `getPixelAspectRatio`)
    });
  }
  async getDisplayWidth() {
    return (await this._backing.getMetadataDisplayWidth?.()) ?? ((await this.getRotation()) % 180 == 0 ? this.getSquarePixelWidth() : this.getSquarePixelHeight());
  }
  get displayWidth() {
    let e = this._backing.getMetadataDisplayWidth?.();
    if (e !== undefined) {
      let t = z(e, `displayWidth`, `getDisplayWidth`);
      if (t !== null) {
        return t;
      }
    }
    return z(z(this._backing.getRotation(), `displayWidth`, `getDisplayWidth`) % 180 == 0 ? this._backing.getSquarePixelWidth() : this._backing.getSquarePixelHeight(), `displayWidth`, `getDisplayWidth`);
  }
  async getDisplayHeight() {
    return (await this._backing.getMetadataDisplayHeight?.()) ?? ((await this.getRotation()) % 180 == 0 ? this.getSquarePixelHeight() : this.getSquarePixelWidth());
  }
  get displayHeight() {
    let e = this._backing.getMetadataDisplayHeight?.();
    if (e !== undefined) {
      let t = z(e, `displayHeight`, `getDisplayHeight`);
      if (t !== null) {
        return t;
      }
    }
    return z(z(this._backing.getRotation(), `displayHeight`, `getDisplayHeight`) % 180 == 0 ? this._backing.getSquarePixelHeight() : this._backing.getSquarePixelWidth(), `displayHeight`, `getDisplayHeight`);
  }
  async getColorSpace() {
    return this._backing.getColorSpace();
  }
  async hasHighDynamicRange() {
    let e = await this._backing.getColorSpace();
    return e.primaries === `bt2020` || e.primaries === `smpte432` || e.transfer === `pq` || e.transfer === `hlg` || e.matrix === `bt2020-ncl`;
  }
  async canBeTransparent() {
    return this._backing.canBeTransparent();
  }
  async getDecoderConfig() {
    return this._backing.getDecoderConfig();
  }
  async getCodecParameterString() {
    return (await this._backing.getMetadataCodecParameterString?.()) ?? (await this._backing.getDecoderConfig())?.codec ?? null;
  }
  async canDecode() {
    try {
      let e = await this._backing.getDecoderConfig();
      if (!e) {
        return false;
      }
      let t = await this._backing.getCodec();
      n(t !== null);
      if (wc.some(n => {
        return n.supports(t, e);
      })) {
        return true;
      } else if (typeof VideoDecoder > `u`) {
        return false;
      } else {
        return (await VideoDecoder.isConfigSupported(e)).supported === true;
      }
    } catch (e) {
      k._error(`Error during decodability check:`, e);
      return false;
    }
  }
  async determinePacketType(e) {
    if (!(e instanceof I)) {
      throw TypeError(`packet must be an EncodedPacket.`);
    }
    if (e.isMetadataOnly) {
      throw TypeError(`packet must not be metadata-only to determine its type.`);
    }
    let t = await this.getCodec();
    if (t === null) {
      return null;
    }
    let r = await this.getDecoderConfig();
    n(r);
    return rr(t, r, e.data);
  }
};
var tl = class extends Qc {
  constructor(e, t) {
    super(e, t);
    this._backing = t;
  }
  get type() {
    return `audio`;
  }
  async getCodec() {
    return this._backing.getCodec();
  }
  get codec() {
    return z(this._backing.getCodec(), `codec`, `getCodec`);
  }
  async hasOnlyKeyPackets() {
    return (await this._backing.getHasOnlyKeyPackets?.()) ?? true;
  }
  async getNumberOfChannels() {
    return this._backing.getNumberOfChannels();
  }
  get numberOfChannels() {
    return z(this._backing.getNumberOfChannels(), `numberOfChannels`, `getNumberOfChannels`);
  }
  async getSampleRate() {
    return this._backing.getSampleRate();
  }
  get sampleRate() {
    return z(this._backing.getSampleRate(), `sampleRate`, `getSampleRate`);
  }
  async getDecoderConfig() {
    return this._backing.getDecoderConfig();
  }
  async getCodecParameterString() {
    return (await this._backing.getMetadataCodecParameterString?.()) ?? (await this._backing.getDecoderConfig())?.codec ?? null;
  }
  async canDecode() {
    try {
      let e = await this._backing.getDecoderConfig();
      if (!e) {
        return false;
      }
      let t = await this._backing.getCodec();
      n(t !== null);
      if (Tc.some(n => {
        return n.supports(t, e);
      }) || e.codec.startsWith(`pcm-`)) {
        return true;
      } else if (typeof AudioDecoder > `u`) {
        return false;
      } else {
        return (await AudioDecoder.isConfigSupported(e)).supported === true;
      }
    } catch (e) {
      k._error(`Error during decodability check:`, e);
      return false;
    }
  }
  async determinePacketType(e) {
    if (!(e instanceof I)) {
      throw TypeError(`packet must be an EncodedPacket.`);
    }
    if ((await this.getCodec()) === null) {
      return null;
    } else {
      return `key`;
    }
  }
};
var nl = e => {
  return e ?? Infinity;
};
var rl = e => {
  return -(e ?? -Infinity);
};
var il = e => {
  return -e;
};
var al = e => {
  if (typeof e != `object` || !e) {
    throw TypeError(`query must be an object.`);
  }
  if (e.filter !== undefined && typeof e.filter != `function`) {
    throw TypeError(`query.filter, when provided, must be a function.`);
  }
  if (e.sortBy !== undefined && typeof e.sortBy != `function`) {
    throw TypeError(`query.sortBy, when provided, must be a function.`);
  }
  return {
    filter: e.filter ? t => {
      let n = e => {
        if (typeof e != `boolean`) {
          throw TypeError(`query.filter must return or resolve to a boolean.`);
        }
        return e;
      };
      let r = e.filter(t);
      if (r instanceof Promise) {
        return r.then(n);
      } else {
        return n(r);
      }
    } : undefined,
    sortBy: e.sortBy ? t => {
      let n = e => {
        if (typeof e != `number` && (!Array.isArray(e) || !e.every(e => {
          return typeof e == `number`;
        }))) {
          throw TypeError(`query.sortBy must return or resolve to a number or an array of numbers.`);
        }
        return e;
      };
      let r = e.sortBy(t);
      if (r instanceof Promise) {
        return r.then(n);
      } else {
        return n(r);
      }
    } : undefined
  };
};
var ol = (e, t) => {
  return {
    filter: e?.filter || t?.filter ? n => {
      let r = e?.filter?.(n) ?? true;
      let i = e => {
        if (e === false) {
          return false;
        } else {
          return t?.filter?.(n) ?? true;
        }
      };
      if (r instanceof Promise) {
        return r.then(i);
      } else {
        return i(r);
      }
    } : undefined,
    sortBy: e?.sortBy || t?.sortBy ? n => {
      let r = e?.sortBy?.(n) ?? [];
      let i = t?.sortBy?.(n) ?? [];
      let a = (e, t) => {
        return [...(Array.isArray(e) ? e : [e]), ...(Array.isArray(t) ? t : [t])];
      };
      if (r instanceof Promise || i instanceof Promise) {
        return Promise.all([r, i]).then(([e, t]) => {
          return a(e, t);
        });
      } else {
        return a(r, i);
      }
    } : undefined
  };
};
var sl = async (e, t) => {
  let n = e;
  if (t?.filter) {
    let r = e.map(e => {
      return t.filter(e);
    });
    if (r.some(e => {
      return e instanceof Promise;
    })) {
      let t = await Promise.all(r);
      n = e.filter((e, n) => {
        return t[n];
      });
    } else {
      n = e.filter((e, t) => {
        return r[t];
      });
    }
  }
  if (!t?.sortBy) {
    return n;
  }
  let r = n.map(e => {
    return t.sortBy(e);
  });
  let i = r.some(e => {
    return e instanceof Promise;
  }) ? await Promise.all(r) : r;
  return n.map((e, t) => {
    return {
      track: e,
      sortValue: i[t]
    };
  }).sort((e, t) => {
    let n = Array.isArray(e.sortValue) ? e.sortValue : [e.sortValue];
    let r = Array.isArray(t.sortValue) ? t.sortValue : [t.sortValue];
    let i = Math.max(n.length, r.length);
    for (let e = 0; e < i; e++) {
      let t = n[e] ?? 0;
      let i = r[e] ?? 0;
      if (t !== i) {
        return t - i;
      }
    }
    return 0;
  }).map(e => {
    return e.track;
  });
};
Ge();
var cl = class e extends ut {
  get disposed() {
    return this._disposed;
  }
  constructor(t) {
    super();
    this._demuxerPromise = null;
    this._format = null;
    this._trackBackingsCache = null;
    this._backingToTrack = new Map();
    this._disposed = false;
    this._nextSourceCacheAge = 0;
    this._sourceRefs = [];
    this._sourceCache = [];
    this._sourceCachePromises = [];
    this._onFormatDetermined = null;
    if (!t || typeof t != `object`) {
      throw TypeError(`options must be an object.`);
    }
    if (!Array.isArray(t.formats) || t.formats.some(e => {
      return !(e instanceof Ao);
    })) {
      throw TypeError(`options.formats must be an array of InputFormat.`);
    }
    if (!(t.source instanceof Za) && !(t.source instanceof Qa)) {
      throw TypeError(`options.source must be a Source or SourceRef.`);
    }
    if (t.source instanceof Za && t.source._disposed) {
      throw TypeError(`options.source must not be a disposed Source.`);
    }
    if (t.initInput !== undefined && !(t.initInput instanceof e)) {
      throw TypeError(`options.initInput, when provided, must be an Input.`);
    }
    if (t.formatOptions !== undefined) {
      ns(t.formatOptions, `formatOptions`);
    }
    this._formats = t.formats;
    this._initInput = t.initInput ?? null;
    this._formatOptions = t.formatOptions ?? {};
    if (t.source instanceof Za) {
      this._rootRef = t.source.ref();
    } else {
      this._rootRef = t.source;
    }
    this._sourceRefs.push(this._rootRef);
  }
  get _rootSource() {
    return this._rootRef.source;
  }
  async _getSourceUncached(e) {
    n(this._rootSource instanceof $a);
    let t = await this._rootSource._resolveRequest(e);
    this._emit(`source`, {
      source: t.source,
      request: e,
      isRoot: e.isRoot
    });
    return t;
  }
  _getSourceCached(e, t = 1) {
    let r = this._sourceCache.find(n => {
      return n.cacheGroup === t && eo(n.request, e);
    });
    if (r) {
      r.age++;
      return Promise.resolve(r.sourceRef.source.ref());
    }
    let i = this._sourceCachePromises.find(n => {
      return n.cacheGroup === t && eo(n.request, e);
    });
    if (i) {
      return i.promise.then(e => {
        return e.sourceRef.source.ref();
      });
    }
    let a = (async () => {
      let r = await this._getSourceUncached(e);
      if (Je(this._sourceCache, e => {
        return e.cacheGroup === t && e.sourceRef.source._refCount === 1;
      }) >= 4) {
        let e = Ye(this._sourceCache, e => {
          if (e.cacheGroup === t && e.sourceRef.source._refCount === 1) {
            return e.age;
          } else {
            return Infinity;
          }
        });
        n(e !== -1);
        let r = this._sourceCache[e];
        this._sourceCache.splice(e, 1);
        r.sourceRef.free();
        ae(this._sourceRefs, r.sourceRef);
      }
      this._sourceRefs.push(r);
      let i = this._sourceCachePromises.findIndex(t => {
        return t.request === e;
      });
      n(i !== -1);
      this._sourceCachePromises.splice(i, 1);
      return {
        request: e,
        sourceRef: r,
        age: this._nextSourceCacheAge++,
        cacheGroup: t
      };
    })();
    this._sourceCachePromises.push({
      request: e,
      cacheGroup: t,
      promise: a
    });
    return a.then(e => {
      let t = e.sourceRef.source.ref();
      this._sourceCache.push(e);
      return t;
    });
  }
  _getDemuxer() {
    return this._demuxerPromise ??= (async () => {
      this._reader = new dl(this._rootSource);
      this._emit(`source`, {
        source: this._rootSource,
        request: null,
        isRoot: true
      });
      for (let e of this._formats) {
        if (await e._canReadInput(this)) {
          this._format = e;
          this._onFormatDetermined?.(e);
          return e._createDemuxer(this);
        }
      }
      throw new ll();
    })();
  }
  get source() {
    return this._rootSource;
  }
  async getFormat() {
    await this._getDemuxer();
    n(this._format);
    return this._format;
  }
  async canRead() {
    try {
      await this._getDemuxer();
      return true;
    } catch (e) {
      if (e instanceof ll) {
        return false;
      }
      throw e;
    }
  }
  async getFirstTimestamp(e) {
    e ??= await this.getTracks();
    let t = e.filter(e => {
      return e !== null;
    });
    if (t.length === 0) {
      return 0;
    }
    let n = await Promise.all(t.map(e => {
      return e.getFirstTimestamp();
    }));
    return Math.min(...n);
  }
  async computeDuration(e, t) {
    e ??= await this.getTracks();
    let n = e.filter(e => {
      return e !== null;
    });
    if (n.length === 0) {
      return 0;
    }
    let r = await Promise.all(n.map(e => {
      return e.computeDuration(t);
    }));
    return Math.max(...r);
  }
  async getDurationFromMetadata(e, t) {
    e ??= await this.getTracks();
    let n = e.filter(e => {
      return e !== null;
    });
    let r = (await Promise.all(n.map(e => {
      return e.getDurationFromMetadata(t);
    }))).filter(e => {
      return e !== null;
    });
    if (r.length === 0) {
      return null;
    } else {
      return Math.max(...r);
    }
  }
  async getTracks(e) {
    e &&= al(e);
    return sl((await this._getTrackBackings()).map(e => {
      return this._wrapBackingAsTrack(e);
    }), e);
  }
  async getVideoTracks(e) {
    e &&= al(e);
    return sl((await this.getTracks()).filter(e => {
      return e.isVideoTrack();
    }), e);
  }
  async getAudioTracks(e) {
    e &&= al(e);
    return sl((await this.getTracks()).filter(e => {
      return e.isAudioTrack();
    }), e);
  }
  async getPrimaryVideoTrack(e) {
    e &&= al(e);
    let t = ol(e, {
      sortBy: async e => {
        return [il((await e.getDisposition()).default), il(await e.hasPairableAudioTrack()), il(!(await e.hasOnlyKeyPackets())), rl(await e.getBitrate())];
      }
    });
    return (await this.getVideoTracks(t))[0] ?? null;
  }
  async getPrimaryAudioTrack(e) {
    e &&= al(e);
    let t = await this.getPrimaryVideoTrack();
    let n = ol(e, {
      sortBy: async e => {
        return [il(!t || e.canBePairedWith(t)), il((await e.getDisposition()).default), rl(await e.getBitrate())];
      }
    });
    return (await this.getAudioTracks(n))[0] ?? null;
  }
  async _getTrackBackings() {
    let e = await this._getDemuxer();
    return this._trackBackingsCache ??= await e.getTrackBackings();
  }
  _wrapBackingAsTrack(e) {
    let t = this._backingToTrack.get(e);
    if (t) {
      return t;
    }
    let n = e.getType() === `video` ? new el(this, e) : new tl(this, e);
    this._backingToTrack.set(e, n);
    return n;
  }
  async getMimeType() {
    return (await this._getDemuxer()).getMimeType();
  }
  async getMetadataTags() {
    return (await this._getDemuxer()).getMetadataTags();
  }
  dispose() {
    if (!this._disposed) {
      this._disposed = true;
      for (let e of this._sourceRefs) {
        e.free();
      }
      this._sourceRefs.length = 0;
      if (this._demuxerPromise) {
        this._demuxerPromise.then(e => {
          return e.dispose();
        }).catch(() => {});
      }
    }
  }
  [Symbol.dispose]() {
    this.dispose();
  }
};
var ll = class extends Error {
  constructor(e = `Input has an unsupported or unrecognizable format.`) {
    super(e);
    this.name = `UnsupportedInputFormatError`;
  }
};
var ul = class extends Error {
  constructor(e = `Input has been disposed.`) {
    super(e);
    this.name = `InputDisposedError`;
  }
};
var dl = class {
  constructor(e) {
    this.source = e;
  }
  get fileSize() {
    let e = this.source._getFileSize();
    if (e === undefined) {
      throw Error(`Reading file size too early; read required first.`);
    }
    return e;
  }
  get fileSizeNonStrict() {
    return this.source._getFileSize() ?? null;
  }
  requestSlice(e, t) {
    if (this.source._disposed) {
      throw new ul();
    }
    if (e < 0 || this.fileSizeNonStrict !== null && e + t > this.fileSizeNonStrict) {
      return null;
    }
    if (t === 0) {
      let t = new Uint8Array();
      return new fl(t, u(t), 0, e, e);
    }
    let n = e + t;
    let r = this.source._read(e, n, 0, Ya);
    if (r instanceof Promise) {
      return r.then(t => {
        if (t) {
          return new fl(t.bytes, t.view, t.offset, e, n);
        } else {
          return null;
        }
      });
    } else if (r) {
      return new fl(r.bytes, r.view, r.offset, e, n);
    } else {
      return null;
    }
  }
  requestSliceRange(e, t, r) {
    if (this.source._disposed) {
      throw new ul();
    }
    if (e < 0) {
      return null;
    }
    if (this.fileSizeNonStrict !== null) {
      return this.requestSlice(e, O(this.fileSizeNonStrict - e, t, r));
    }
    {
      let i = this.requestSlice(e, r);
      let a = i => {
        n(this.fileSizeNonStrict !== null);
        return i || this.requestSlice(e, O(this.fileSizeNonStrict - e, t, r));
      };
      if (i instanceof Promise) {
        return i.then(a);
      } else {
        return a(i);
      }
    }
  }
  requestEntireFile() {
    if (this.fileSizeNonStrict === null) {
      return (async () => {
        let e = [];
        let t = 0;
        while (true) {
          if (e.length === 1 && this.fileSizeNonStrict !== null) {
            return this.requestSlice(0, this.fileSizeNonStrict);
          }
          let n = this.requestSliceRange(t, 0, 1024);
          if (n instanceof Promise) {
            n = await n;
          }
          if (!n || n.length === 0) {
            break;
          }
          let r = B(n, n.length);
          e.push(r);
          t += n.length;
        }
        let n = new Uint8Array(t);
        let r = 0;
        for (let t of e) {
          n.set(t, r);
          r += t.length;
        }
        return new fl(n, u(n), 0, 0, t);
      })();
    } else {
      return this.requestSlice(0, this.fileSizeNonStrict);
    }
  }
};
var fl = class e {
  constructor(e, t, n, r, i) {
    this.bytes = e;
    this.view = t;
    this.offset = n;
    this.start = r;
    this.end = i;
    this.bufferPos = r - n;
  }
  static tempFromBytes(t) {
    return new e(t, u(t), 0, 0, t.length);
  }
  get length() {
    return this.end - this.start;
  }
  get filePos() {
    return this.offset + this.bufferPos;
  }
  set filePos(e) {
    this.bufferPos = e - this.offset;
  }
  get remainingLength() {
    return Math.max(this.end - this.filePos, 0);
  }
  skip(e) {
    this.bufferPos += e;
  }
  slice(t, n = this.end - t) {
    if (t < this.start || t + n > this.end) {
      throw RangeError(`Slicing outside of original slice.`);
    }
    return new e(this.bytes, this.view, this.offset, t, t + n);
  }
};
var pl = (e, t) => {
  if (e.filePos < e.start || e.filePos + t > e.end) {
    throw RangeError(`Tried reading [${e.filePos}, ${e.filePos + t}), but slice is [${e.start}, ${e.end}). This is likely an internal error, please report it alongside the file that caused it.`);
  }
};
var B = (e, t) => {
  pl(e, t);
  let n = e.bytes.subarray(e.bufferPos, e.bufferPos + t);
  e.bufferPos += t;
  return n;
};
var V = e => {
  pl(e, 1);
  return e.view.getUint8(e.bufferPos++);
};
var ml = (e, t) => {
  pl(e, 2);
  let n = e.view.getUint16(e.bufferPos, t);
  e.bufferPos += 2;
  return n;
};
var H = e => {
  pl(e, 2);
  let t = e.view.getUint16(e.bufferPos, false);
  e.bufferPos += 2;
  return t;
};
var hl = e => {
  pl(e, 3);
  let t = ue(e.view, e.bufferPos, false);
  e.bufferPos += 3;
  return t;
};
var gl = e => {
  pl(e, 2);
  let t = e.view.getInt16(e.bufferPos, false);
  e.bufferPos += 2;
  return t;
};
var _l = (e, t) => {
  pl(e, 4);
  let n = e.view.getUint32(e.bufferPos, t);
  e.bufferPos += 4;
  return n;
};
var U = e => {
  pl(e, 4);
  let t = e.view.getUint32(e.bufferPos, false);
  e.bufferPos += 4;
  return t;
};
var vl = e => {
  pl(e, 4);
  let t = e.view.getUint32(e.bufferPos, true);
  e.bufferPos += 4;
  return t;
};
var yl = e => {
  pl(e, 4);
  let t = e.view.getInt32(e.bufferPos, false);
  e.bufferPos += 4;
  return t;
};
var bl = e => {
  pl(e, 4);
  let t = e.view.getInt32(e.bufferPos, true);
  e.bufferPos += 4;
  return t;
};
var xl = (e, t) => {
  let n;
  let r;
  if (t) {
    n = _l(e, true);
    r = _l(e, true);
  } else {
    r = _l(e, false);
    n = _l(e, false);
  }
  return r * 4294967296 + n;
};
var Sl = e => {
  let t = U(e);
  let n = U(e);
  return t * 4294967296 + n;
};
var Cl = e => {
  let t = yl(e);
  let n = U(e);
  return t * 4294967296 + n;
};
var wl = e => {
  let t = vl(e);
  return bl(e) * 4294967296 + t;
};
var Tl = e => {
  pl(e, 4);
  let t = e.view.getFloat32(e.bufferPos, false);
  e.bufferPos += 4;
  return t;
};
var El = e => {
  pl(e, 8);
  let t = e.view.getFloat64(e.bufferPos, false);
  e.bufferPos += 8;
  return t;
};
var W = (e, t) => {
  pl(e, t);
  let n = ``;
  for (let r = 0; r < t; r++) {
    n += String.fromCharCode(e.bytes[e.bufferPos++]);
  }
  return n;
};
var Dl = (e, t, n) => {
  return d.decode(B(e, t)).split(`
`).map(e => {
    return e.trim();
  }).filter(e => {
    return e.length > 0 && !n?.ignore?.(e);
  });
};
var Ol;
(function (e) {
  e[e.Unsynchronisation = 128] = `Unsynchronisation`;
  e[e.ExtendedHeader = 64] = `ExtendedHeader`;
  e[e.ExperimentalIndicator = 32] = `ExperimentalIndicator`;
  e[e.Footer = 16] = `Footer`;
})(Ol ||= {});
var G;
(function (e) {
  e[e.ISO_8859_1 = 0] = `ISO_8859_1`;
  e[e.UTF_16_WITH_BOM = 1] = `UTF_16_WITH_BOM`;
  e[e.UTF_16_BE_NO_BOM = 2] = `UTF_16_BE_NO_BOM`;
  e[e.UTF_8 = 3] = `UTF_8`;
})(G ||= {});
var kl = `Blues.Classic rock.Country.Dance.Disco.Funk.Grunge.Hip-hop.Jazz.Metal.New age.Oldies.Other.Pop.Rhythm and blues.Rap.Reggae.Rock.Techno.Industrial.Alternative.Ska.Death metal.Pranks.Soundtrack.Euro-techno.Ambient.Trip-hop.Vocal.Jazz & funk.Fusion.Trance.Classical.Instrumental.Acid.House.Game.Sound clip.Gospel.Noise.Alternative rock.Bass.Soul.Punk.Space.Meditative.Instrumental pop.Instrumental rock.Ethnic.Gothic.Darkwave.Techno-industrial.Electronic.Pop-folk.Eurodance.Dream.Southern rock.Comedy.Cult.Gangsta.Top 40.Christian rap.Pop/funk.Jungle music.Native US.Cabaret.New wave.Psychedelic.Rave.Showtunes.Trailer.Lo-fi.Tribal.Acid punk.Acid jazz.Polka.Retro.Musical.Rock 'n' roll.Hard rock.Folk.Folk rock.National folk.Swing.Fast fusion.Bebop.Latin.Revival.Celtic.Bluegrass.Avantgarde.Gothic rock.Progressive rock.Psychedelic rock.Symphonic rock.Slow rock.Big band.Chorus.Easy listening.Acoustic.Humour.Speech.Chanson.Opera.Chamber music.Sonata.Symphony.Booty bass.Primus.Porn groove.Satire.Slow jam.Club.Tango.Samba.Folklore.Ballad.Power ballad.Rhythmic Soul.Freestyle.Duet.Punk rock.Drum solo.A cappella.Euro-house.Dance hall.Goa music.Drum & bass.Club-house.Hardcore techno.Terror.Indie.Britpop.Negerpunk.Polsk punk.Beat.Christian gangsta rap.Heavy metal.Black metal.Crossover.Contemporary Christian.Christian rock.Merengue.Salsa.Thrash metal.Anime.Jpop.Synthpop.Christmas.Art rock.Baroque.Bhangra.Big beat.Breakbeat.Chillout.Downtempo.Dub.EBM.Eclectic.Electro.Electroclash.Emo.Experimental.Garage.Global.IDM.Illbient.Industro-Goth.Jam Band.Krautrock.Leftfield.Lounge.Math rock.New romantic.Nu-breakz.Post-punk.Post-rock.Psytrance.Shoegaze.Space rock.Trop rock.World music.Neoclassical.Audiobook.Audio theatre.Neue Deutsche Welle.Podcast.Indie rock.G-Funk.Dubstep.Garage rock.Psybient`.split(`.`);
var Al = (e, t) => {
  let n = e.filePos;
  t.raw ??= {};
  t.raw.TAG ??= B(e, 125);
  e.filePos = n;
  let r = jl(e, 30);
  if (r) {
    t.title ??= r;
  }
  let i = jl(e, 30);
  if (i) {
    t.artist ??= i;
  }
  let a = jl(e, 30);
  if (a) {
    t.album ??= a;
  }
  let o = jl(e, 4);
  let s = Number.parseInt(o, 10);
  if (Number.isInteger(s) && s > 0) {
    t.date ??= new Date(String(s));
  }
  let c = B(e, 30);
  let l;
  if (c[28] === 0 && c[29] !== 0) {
    let n = c[29];
    if (n > 0) {
      t.trackNumber ??= n;
    }
    e.skip(-30);
    l = jl(e, 28);
    e.skip(2);
  } else {
    e.skip(-30);
    l = jl(e, 30);
  }
  if (l) {
    t.comment ??= l;
  }
  let u = V(e);
  if (u < kl.length) {
    t.genre ??= kl[u];
  }
};
var jl = (e, t) => {
  let n = B(e, t);
  let r = Re(n.indexOf(0), n.length);
  let i = n.subarray(0, r);
  let a = ``;
  for (let e = 0; e < i.length; e++) {
    a += String.fromCharCode(i[e]);
  }
  return a.trimEnd();
};
var Ml = e => {
  let t = e.filePos;
  let n = W(e, 3);
  let r = V(e);
  let i = V(e);
  let a = V(e);
  let o = U(e);
  if (n !== `ID3` || r === 255 || i === 255 || o & -2139062144) {
    e.filePos = t;
    return null;
  }
  let s = mn(o);
  if (a & Ol.Footer) {
    s += 10;
  }
  return {
    majorVersion: r,
    revision: i,
    flags: a,
    size: s
  };
};
var Nl = (e, t, n) => {
  if (![2, 3, 4].includes(t.majorVersion)) {
    k._warn(`Unsupported ID3v2 major version: ${t.majorVersion}`);
    return;
  }
  let r = new Pl(t, B(e, t.flags & Ol.Footer ? t.size - 10 : t.size));
  if (t.flags & Ol.Unsynchronisation && t.majorVersion === 3) {
    r.ununsynchronizeAll();
  }
  if (t.flags & Ol.ExtendedHeader) {
    let e = r.readU32();
    if (t.majorVersion === 3) {
      r.pos += e;
    } else {
      r.pos += e - 4;
    }
  }
  while (r.pos <= r.bytes.length - r.frameHeaderSize()) {
    let e = r.readId3V2Frame();
    if (!e) {
      break;
    }
    let i = r.pos;
    let a = r.pos + e.size;
    let o = false;
    let s = false;
    let c = false;
    if (t.majorVersion === 3) {
      o = !!(e.flags & 64);
      s = !!(e.flags & 128);
    } else if (t.majorVersion === 4) {
      o = !!(e.flags & 4);
      s = !!(e.flags & 8);
      c = !!(e.flags & 2) || !!(t.flags & Ol.Unsynchronisation);
    }
    if (o) {
      k._warn(`Skipping encrypted ID3v2 frame ${e.id}`);
      r.pos = a;
      continue;
    }
    if (s) {
      k._warn(`Skipping compressed ID3v2 frame ${e.id}`);
      r.pos = a;
      continue;
    }
    if (c) {
      r.ununsynchronizeRegion(r.pos, a);
    }
    n.raw ??= {};
    if (e.id === `TXXX`) {
      let e = n.raw.TXXX ??= {};
      let t = r.readId3V2TextEncoding();
      let i = r.readId3V2Text(t, a);
      let o = r.readId3V2Text(t, a);
      e[i] ??= o;
    } else if (e.id[0] === `T`) {
      n.raw[e.id] ??= r.readId3V2EncodingAndText(a);
    } else {
      n.raw[e.id] ??= r.readBytes(e.size);
    }
    r.pos = i;
    switch (e.id) {
      case `TIT2`:
      case `TT2`:
        {
          n.title ??= r.readId3V2EncodingAndText(a);
          break;
        }
      case `TIT3`:
      case `TT3`:
        {
          n.description ??= r.readId3V2EncodingAndText(a);
          break;
        }
      case `TPE1`:
      case `TP1`:
        {
          n.artist ??= r.readId3V2EncodingAndText(a);
          break;
        }
      case `TALB`:
      case `TAL`:
        {
          n.album ??= r.readId3V2EncodingAndText(a);
          break;
        }
      case `TPE2`:
      case `TP2`:
        {
          n.albumArtist ??= r.readId3V2EncodingAndText(a);
          break;
        }
      case `TRCK`:
      case `TRK`:
        {
          let e = r.readId3V2EncodingAndText(a).split(`/`);
          let t = Number.parseInt(e[0], 10);
          let i = e[1] && Number.parseInt(e[1], 10);
          if (Number.isInteger(t) && t > 0) {
            n.trackNumber ??= t;
          }
          if (i && Number.isInteger(i) && i > 0) {
            n.tracksTotal ??= i;
          }
        }
        break;
      case `TPOS`:
      case `TPA`:
        {
          let e = r.readId3V2EncodingAndText(a).split(`/`);
          let t = Number.parseInt(e[0], 10);
          let i = e[1] && Number.parseInt(e[1], 10);
          if (Number.isInteger(t) && t > 0) {
            n.discNumber ??= t;
          }
          if (i && Number.isInteger(i) && i > 0) {
            n.discsTotal ??= i;
          }
        }
        break;
      case `TCON`:
      case `TCO`:
        {
          let e = r.readId3V2EncodingAndText(a);
          let t = /^\((\d+)\)/.exec(e);
          if (t) {
            let e = Number.parseInt(t[1]);
            if (kl[e] !== undefined) {
              n.genre ??= kl[e];
              break;
            }
          }
          t = /^\d+$/.exec(e);
          if (t) {
            let e = Number.parseInt(t[0]);
            if (kl[e] !== undefined) {
              n.genre ??= kl[e];
              break;
            }
          }
          n.genre ??= e;
        }
        break;
      case `TDRC`:
      case `TDAT`:
        {
          let e = r.readId3V2EncodingAndText(a);
          let t = new Date(e);
          if (!Number.isNaN(t.getTime())) {
            n.date ??= t;
          }
        }
        break;
      case `TYER`:
      case `TYE`:
        {
          let e = r.readId3V2EncodingAndText(a);
          let t = Number.parseInt(e, 10);
          if (Number.isInteger(t)) {
            n.date ??= new Date(String(t));
          }
        }
        break;
      case `USLT`:
      case `ULT`:
        {
          let e = r.readU8();
          r.pos += 3;
          r.readId3V2Text(e, a);
          n.lyrics ??= r.readId3V2Text(e, a);
        }
        break;
      case `COMM`:
      case `COM`:
        {
          let e = r.readU8();
          r.pos += 3;
          r.readId3V2Text(e, a);
          n.comment ??= r.readId3V2Text(e, a);
        }
        break;
      case `APIC`:
      case `PIC`:
        {
          let e = r.readId3V2TextEncoding();
          let i;
          if (t.majorVersion === 2) {
            let e = r.readAscii(3);
            if (e === `PNG`) {
              i = `image/png`;
            } else {
              if (e === `JPG`) {
                i = `image/jpeg`;
              } else {
                i = `image/*`;
              }
            }
          } else {
            i = r.readId3V2Text(e, a);
          }
          let o = r.readU8();
          let s = r.readId3V2Text(e, a).trimEnd();
          let c = a - r.pos;
          if (c >= 0) {
            let e = r.readBytes(c);
            n.images ||= [];
            n.images.push({
              data: e,
              mimeType: i,
              kind: o === 3 ? `coverFront` : o === 4 ? `coverBack` : `unknown`,
              description: s
            });
          }
        }
        break;
      default:
        {
          r.pos += e.size;
          break;
        }
    }
    r.pos = a;
  }
};
var Pl = class {
  constructor(e, t) {
    this.header = e;
    this.bytes = t;
    this.pos = 0;
    this.view = new DataView(t.buffer, t.byteOffset, t.byteLength);
  }
  frameHeaderSize() {
    if (this.header.majorVersion === 2) {
      return 6;
    } else {
      return 10;
    }
  }
  ununsynchronizeAll() {
    let e = [];
    for (let t = 0; t < this.bytes.length; t++) {
      let n = this.bytes[t];
      e.push(n);
      if (n === 255 && t !== this.bytes.length - 1 && this.bytes[t] === 0) {
        t++;
      }
    }
    this.bytes = new Uint8Array(e);
    this.view = new DataView(this.bytes.buffer);
  }
  ununsynchronizeRegion(e, t) {
    let n = [];
    for (let r = e; r < t; r++) {
      let e = this.bytes[r];
      n.push(e);
      if (e === 255 && r !== t - 1 && this.bytes[r + 1] === 0) {
        r++;
      }
    }
    let r = this.bytes.subarray(0, e);
    let i = this.bytes.subarray(t);
    this.bytes = new Uint8Array(r.length + n.length + i.length);
    this.bytes.set(r, 0);
    this.bytes.set(n, r.length);
    this.bytes.set(i, r.length + n.length);
    this.view = new DataView(this.bytes.buffer);
  }
  readBytes(e) {
    let t = this.bytes.subarray(this.pos, this.pos + e);
    this.pos += e;
    return t;
  }
  readU8() {
    let e = this.view.getUint8(this.pos);
    this.pos += 1;
    return e;
  }
  readU16() {
    let e = this.view.getUint16(this.pos, false);
    this.pos += 2;
    return e;
  }
  readU24() {
    let e = this.view.getUint16(this.pos, false);
    let t = this.view.getUint8(this.pos + 2);
    this.pos += 3;
    return e * 256 + t;
  }
  readU32() {
    let e = this.view.getUint32(this.pos, false);
    this.pos += 4;
    return e;
  }
  readAscii(e) {
    let t = ``;
    for (let n = 0; n < e; n++) {
      t += String.fromCharCode(this.view.getUint8(this.pos + n));
    }
    this.pos += e;
    return t;
  }
  readId3V2Frame() {
    if (this.header.majorVersion === 2) {
      let e = this.readAscii(3);
      if (e === `\0\0\0`) {
        return null;
      } else {
        return {
          id: e,
          size: this.readU24(),
          flags: 0
        };
      }
    } else {
      let e = this.readAscii(4);
      if (e === `\0\0\0\0`) {
        return null;
      }
      let t = this.readU32();
      let n = this.header.majorVersion === 4 ? mn(t) : t;
      let r = this.readU16();
      let i = this.pos;
      let a = e => {
        let t = this.pos + e;
        if (t > this.bytes.length) {
          return false;
        }
        if (t <= this.bytes.length - this.frameHeaderSize()) {
          this.pos += e;
          let t = this.readAscii(4);
          if (t !== `\0\0\0\0` && !/[0-9A-Z]{4}/.test(t)) {
            return false;
          }
        }
        return true;
      };
      if (!a(n)) {
        let e = this.header.majorVersion === 4 ? t : mn(t);
        if (a(e)) {
          n = e;
        }
      }
      this.pos = i;
      return {
        id: e,
        size: n,
        flags: r
      };
    }
  }
  readId3V2TextEncoding() {
    let e = this.readU8();
    if (e > 3) {
      throw Error(`Unsupported text encoding: ${e}`);
    }
    return e;
  }
  readId3V2Text(e, t) {
    let n = this.pos;
    let r = this.readBytes(t - this.pos);
    switch (e) {
      case G.ISO_8859_1:
        {
          let e = ``;
          for (let t = 0; t < r.length; t++) {
            let i = r[t];
            if (i === 0) {
              this.pos = n + t + 1;
              break;
            }
            e += String.fromCharCode(i);
          }
          return e;
        }
      case G.UTF_16_WITH_BOM:
        {
          if (r[0] === 255 && r[1] === 254) {
            let e = new TextDecoder(`utf-16le`);
            let t = Re(r.findIndex((e, t) => {
              return e === 0 && r[t + 1] === 0 && t % 2 == 0;
            }), r.length);
            this.pos = n + Math.min(t + 2, r.length);
            return e.decode(r.subarray(2, t));
          } else if (r[0] === 254 && r[1] === 255) {
            let e = new TextDecoder(`utf-16be`);
            let t = Re(r.findIndex((e, t) => {
              return e === 0 && r[t + 1] === 0 && t % 2 == 0;
            }), r.length);
            this.pos = n + Math.min(t + 2, r.length);
            return e.decode(r.subarray(2, t));
          } else {
            let e = Re(r.findIndex(e => {
              return e === 0;
            }), r.length);
            this.pos = n + Math.min(e + 1, r.length);
            return d.decode(r.subarray(0, e));
          }
        }
      case G.UTF_16_BE_NO_BOM:
        {
          let e = new TextDecoder(`utf-16be`);
          let t = Re(r.findIndex((e, t) => {
            return e === 0 && r[t + 1] === 0 && t % 2 == 0;
          }), r.length);
          this.pos = n + Math.min(t + 2, r.length);
          return e.decode(r.subarray(0, t));
        }
      case G.UTF_8:
        {
          let e = Re(r.findIndex(e => {
            return e === 0;
          }), r.length);
          this.pos = n + Math.min(e + 1, r.length);
          return d.decode(r.subarray(0, e));
        }
    }
  }
  readId3V2EncodingAndText(e) {
    if (this.pos >= e) {
      return ``;
    }
    let t = this.readId3V2TextEncoding();
    return this.readId3V2Text(t, e);
  }
};
var Fl = class {
  constructor(e) {
    this.helper = new Uint8Array(8);
    this.helperView = u(this.helper);
    this.writer = e;
  }
  writeId3V2Tag(e) {
    let t = this.writer.getPos();
    this.writeAscii(`ID3`);
    this.writeU8(4);
    this.writeU8(0);
    this.writeU8(0);
    this.writeSynchsafeU32(0);
    let n = this.writer.getPos();
    let r = new Set();
    for (let {
      key: t,
      value: n
    } of Be(e)) {
      switch (t) {
        case `title`:
          {
            this.writeId3V2TextFrame(`TIT2`, n);
            r.add(`TIT2`);
            break;
          }
        case `description`:
          {
            this.writeId3V2TextFrame(`TIT3`, n);
            r.add(`TIT3`);
            break;
          }
        case `artist`:
          {
            this.writeId3V2TextFrame(`TPE1`, n);
            r.add(`TPE1`);
            break;
          }
        case `album`:
          {
            this.writeId3V2TextFrame(`TALB`, n);
            r.add(`TALB`);
            break;
          }
        case `albumArtist`:
          {
            this.writeId3V2TextFrame(`TPE2`, n);
            r.add(`TPE2`);
            break;
          }
        case `trackNumber`:
          {
            let t = e.tracksTotal === undefined ? n.toString() : `${n}/${e.tracksTotal}`;
            this.writeId3V2TextFrame(`TRCK`, t);
            r.add(`TRCK`);
          }
          break;
        case `discNumber`:
          {
            let t = e.discsTotal === undefined ? n.toString() : `${n}/${e.discsTotal}`;
            this.writeId3V2TextFrame(`TPOS`, t);
            r.add(`TPOS`);
          }
          break;
        case `genre`:
          {
            this.writeId3V2TextFrame(`TCON`, n);
            r.add(`TCON`);
            break;
          }
        case `date`:
          {
            this.writeId3V2TextFrame(`TDRC`, n.toISOString().slice(0, 10));
            r.add(`TDRC`);
            break;
          }
        case `lyrics`:
          {
            this.writeId3V2LyricsFrame(n);
            r.add(`USLT`);
            break;
          }
        case `comment`:
          {
            this.writeId3V2CommentFrame(n);
            r.add(`COMM`);
            break;
          }
        case `images`:
          {
            let e = {
              coverFront: 3,
              coverBack: 4,
              unknown: 0
            };
            for (let t of n) {
              let n = e[t.kind] ?? 0;
              let r = t.description ?? ``;
              this.writeId3V2ApicFrame(t.mimeType, n, r, t.data);
            }
          }
          break;
        case `tracksTotal`:
        case `discsTotal`:
          {
            break;
          }
        case `raw`:
          {
            break;
          }
        default:
          {
            D(t);
          }
      }
    }
    if (e.raw) {
      for (let t in e.raw) {
        let n = e.raw[t];
        if (n == null || t.length !== 4 || r.has(t)) {
          continue;
        }
        let i;
        if (typeof n == `string`) {
          if (p(n)) {
            i = new Uint8Array(n.length + 2);
            i[0] = G.ISO_8859_1;
            for (let e = 0; e < n.length; e++) {
              i[e + 1] = n.charCodeAt(e);
            }
          } else {
            let e = f.encode(n);
            i = new Uint8Array(e.byteLength + 2);
            i[0] = G.UTF_8;
            i.set(e, 1);
          }
        } else if (n instanceof Uint8Array) {
          i = n;
        } else if (t === `TXXX` && pt(n)) {
          for (let e in n) {
            let t = n[e];
            let r = p(e) && p(t);
            let i = r ? null : f.encode(e);
            let a = r ? null : f.encode(t);
            let o = r ? e.length : i.byteLength;
            let s = r ? t.length : a.byteLength;
            let c = 1 + o + 1 + s + 1;
            this.writeAscii(`TXXX`);
            this.writeSynchsafeU32(c);
            this.writeU16(0);
            this.writeU8(r ? G.ISO_8859_1 : G.UTF_8);
            if (r) {
              this.writeIsoString(e);
              this.writeIsoString(t);
            } else {
              this.writer.write(i);
              this.writeU8(0);
              this.writer.write(a);
              this.writeU8(0);
            }
          }
          continue;
        } else {
          continue;
        }
        this.writeAscii(t);
        this.writeSynchsafeU32(i.byteLength);
        this.writeU16(0);
        this.writer.write(i);
      }
    }
    let i = this.writer.getPos();
    let a = i - n;
    this.writer.seek(t + 6);
    this.writeSynchsafeU32(a);
    this.writer.seek(i);
    return a + 10;
  }
  writeU8(e) {
    this.helper[0] = e;
    this.writer.write(this.helper.subarray(0, 1));
  }
  writeU16(e) {
    this.helperView.setUint16(0, e, false);
    this.writer.write(this.helper.subarray(0, 2));
  }
  writeU32(e) {
    this.helperView.setUint32(0, e, false);
    this.writer.write(this.helper.subarray(0, 4));
  }
  writeAscii(e) {
    for (let t = 0; t < e.length; t++) {
      this.helper[t] = e.charCodeAt(t);
    }
    this.writer.write(this.helper.subarray(0, e.length));
  }
  writeSynchsafeU32(e) {
    this.writeU32(pn(e));
  }
  writeIsoString(e) {
    let t = new Uint8Array(e.length + 1);
    for (let n = 0; n < e.length; n++) {
      t[n] = e.charCodeAt(n);
    }
    this.writer.write(t);
  }
  writeUtf8String(e) {
    let t = f.encode(e);
    this.writer.write(t);
    this.writeU8(0);
  }
  writeId3V2TextFrame(e, t) {
    let n = p(t);
    let r = 1 + (n ? t.length : f.encode(t).byteLength) + 1;
    this.writeAscii(e);
    this.writeSynchsafeU32(r);
    this.writeU16(0);
    this.writeU8(n ? G.ISO_8859_1 : G.UTF_8);
    if (n) {
      this.writeIsoString(t);
    } else {
      this.writeUtf8String(t);
    }
  }
  writeId3V2LyricsFrame(e) {
    let t = p(e);
    let n = 5 + e.length + 1;
    this.writeAscii(`USLT`);
    this.writeSynchsafeU32(n);
    this.writeU16(0);
    this.writeU8(t ? G.ISO_8859_1 : G.UTF_8);
    this.writeAscii(`und`);
    if (t) {
      this.writeIsoString(``);
      this.writeIsoString(e);
    } else {
      this.writeUtf8String(``);
      this.writeUtf8String(e);
    }
  }
  writeId3V2CommentFrame(e) {
    let t = p(e);
    let n = 5 + (t ? e.length : f.encode(e).byteLength) + 1;
    this.writeAscii(`COMM`);
    this.writeSynchsafeU32(n);
    this.writeU16(0);
    this.writeU8(t ? G.ISO_8859_1 : G.UTF_8);
    this.writeU8(117);
    this.writeU8(110);
    this.writeU8(100);
    if (t) {
      this.writeIsoString(``);
      this.writeIsoString(e);
    } else {
      this.writeUtf8String(``);
      this.writeUtf8String(e);
    }
  }
  writeId3V2ApicFrame(e, t, n, r) {
    let i = p(e) && p(n);
    let a = i ? n.length : f.encode(n).byteLength;
    let o = 1 + e.length + 1 + 1 + a + 1 + r.byteLength;
    this.writeAscii(`APIC`);
    this.writeSynchsafeU32(o);
    this.writeU16(0);
    this.writeU8(i ? G.ISO_8859_1 : G.UTF_8);
    if (i) {
      this.writeIsoString(e);
    } else {
      this.writeUtf8String(e);
    }
    this.writeU8(t);
    if (i) {
      this.writeIsoString(n);
    } else {
      this.writeUtf8String(n);
    }
    this.writer.write(r);
  }
};
var Il = class {
  constructor(e) {
    this.mutex = new C();
    this.trackTimestampInfo = new WeakMap();
    this.output = e;
  }
  onTrackClose(e) {}
  validateTimestamp(e, t, n) {
    if (t < 0) {
      throw Error(`Timestamps must be non-negative (got ${t}s).`);
    }
    let r = this.trackTimestampInfo.get(e);
    if (r) {
      if (n) {
        r.maxTimestampBeforeLastKeyPacket = r.maxTimestamp;
      }
      if (r.maxTimestampBeforeLastKeyPacket !== null && t < r.maxTimestampBeforeLastKeyPacket) {
        throw Error(`Timestamps cannot be smaller than the largest timestamp of the previous GOP (a GOP begins with a key packet and ends right before the next key packet). Got ${t}s, but largest timestamp is ${r.maxTimestampBeforeLastKeyPacket}s.`);
      }
      r.maxTimestamp = Math.max(r.maxTimestamp, t);
    } else {
      if (!n) {
        throw Error(`First packet must be a key packet.`);
      }
      r = {
        maxTimestamp: t,
        maxTimestampBeforeLastKeyPacket: null
      };
      this.trackTimestampInfo.set(e, r);
    }
  }
};
var Ll = class extends Il {
  constructor(e, t) {
    super(e);
    this.header = null;
    this.headerBitstream = null;
    this.inputIsAdts = null;
    this.format = t;
  }
  async start() {
    let e = await this.mutex.acquire();
    this.writer = await this.output._getRootWriter(true);
    if (!vt(this.output._metadataTags)) {
      new Fl(this.writer).writeId3V2Tag(this.output._metadataTags);
    }
    e();
  }
  async getMimeType() {
    return `audio/aac`;
  }
  async addEncodedVideoPacket() {
    throw Error(`ADTS does not support video.`);
  }
  async addEncodedAudioPacket(e, t, r) {
    let i = await this.mutex.acquire();
    try {
      this.validateTimestamp(e, t.timestamp, t.type === `key`);
      if (this.inputIsAdts === null) {
        rn(r);
        let e = r?.decoderConfig?.description;
        this.inputIsAdts = !e;
        if (!this.inputIsAdts) {
          let t = Tt(Ct(l(e)));
          this.header = t.header;
          this.headerBitstream = t.bitstream;
        }
      }
      if (this.inputIsAdts) {
        let e = this.writer.getPos();
        this.writer.write(t.data);
        if (this.format._options.onFrame) {
          this.format._options.onFrame(t.data, e);
        }
      } else {
        n(this.header);
        let e = t.data.byteLength + this.header.byteLength;
        Et(this.headerBitstream, e);
        let r = this.writer.getPos();
        this.writer.write(this.header);
        this.writer.write(t.data);
        if (this.format._options.onFrame) {
          let n = new Uint8Array(e);
          n.set(this.header, 0);
          n.set(t.data, this.header.byteLength);
          this.format._options.onFrame(n, r);
        }
      }
      await this.writer.flush();
    } finally {
      i();
    }
  }
  async addSubtitleCue() {
    throw Error(`ADTS does not support subtitles.`);
  }
  async finalize() {
    (await this.mutex.acquire())();
  }
};
var Rl = new Uint8Array([102, 76, 97, 67]);
var zl = 38;
var Bl = 34;
var Vl = class extends Il {
  constructor(e, t) {
    super(e);
    this.metadataWritten = false;
    this.blockSizes = [];
    this.frameSizes = [];
    this.sampleRate = null;
    this.channels = null;
    this.bitsPerSample = null;
    this.format = t;
  }
  async start() {
    let e = await this.mutex.acquire();
    this.writer = await this.output._getRootWriter(!!this.format._options.appendOnly);
    this.writer.write(Rl);
    e();
  }
  writeHeader({
    bitsPerSample: e,
    minimumBlockSize: t,
    maximumBlockSize: r,
    minimumFrameSize: i,
    maximumFrameSize: a,
    sampleRate: o,
    channels: s,
    totalSamples: c
  }) {
    n(this.writer.getPos() === 4);
    let l = !vt(this.output._metadataTags);
    let u = new A(new Uint8Array(4));
    u.writeBits(1, Number(!l));
    u.writeBits(7, ir.STREAMINFO);
    u.writeBits(24, Bl);
    this.writer.write(u.bytes);
    let d = new A(new Uint8Array(18));
    d.writeBits(16, t);
    d.writeBits(16, r);
    d.writeBits(24, i);
    d.writeBits(24, a);
    d.writeBits(20, o);
    d.writeBits(3, s - 1);
    d.writeBits(5, e - 1);
    if (c >= 4294967296) {
      throw Error(`This muxer only supports writing up to 2 ** 32 samples`);
    }
    d.writeBits(4, 0);
    d.writeBits(32, c);
    this.writer.write(d.bytes);
    this.writer.write(new Uint8Array(16));
  }
  writePictureBlock(e) {
    let t = 32 + e.mimeType.length + (e.description?.length ?? 0) + e.data.length;
    let r = new Uint8Array(t);
    let i = 0;
    let a = u(r);
    a.setUint32(i, e.kind === `coverFront` ? 3 : e.kind === `coverBack` ? 4 : 0);
    i += 4;
    a.setUint32(i, e.mimeType.length);
    i += 4;
    r.set(f.encode(e.mimeType), 8);
    i += e.mimeType.length;
    a.setUint32(i, e.description?.length ?? 0);
    i += 4;
    r.set(f.encode(e.description ?? ``), i);
    i += e.description?.length ?? 0;
    i += 16;
    a.setUint32(i, e.data.length);
    i += 4;
    r.set(e.data, i);
    i += e.data.length;
    n(i === t);
    let o = new A(new Uint8Array(4));
    o.writeBits(1, 0);
    o.writeBits(7, ir.PICTURE);
    o.writeBits(24, t);
    this.writer.write(o.bytes);
    this.writer.write(r);
  }
  writeVorbisCommentAndPictureBlock() {
    if (!this.format._options.appendOnly) {
      this.writer.seek(zl + Rl.byteLength);
    }
    if (vt(this.output._metadataTags)) {
      this.metadataWritten = true;
      return;
    }
    let e = this.output._metadataTags.images ?? [];
    for (let t of e) {
      this.writePictureBlock(t);
    }
    let t = or(new Uint8Array(), this.output._metadataTags, false);
    let n = new A(new Uint8Array(4));
    n.writeBits(1, 1);
    n.writeBits(7, ir.VORBIS_COMMENT);
    n.writeBits(24, t.length);
    this.writer.write(n.bytes);
    this.writer.write(t);
    this.metadataWritten = true;
  }
  async getMimeType() {
    return `audio/flac`;
  }
  async addEncodedVideoPacket() {
    throw Error(`FLAC does not support video.`);
  }
  async addEncodedAudioPacket(e, t, r) {
    let i = await this.mutex.acquire();
    try {
      this.validateTimestamp(e, t.timestamp, t.type === `key`);
      if (this.sampleRate === null) {
        rn(r);
        n(r);
        n(r.decoderConfig);
        n(r.decoderConfig.description);
        this.sampleRate = r.decoderConfig.sampleRate;
        this.channels = r.decoderConfig.numberOfChannels;
        let e = new A(l(r.decoderConfig.description));
        e.skipBits(167);
        let t = e.readBits(5) + 1;
        this.bitsPerSample = t;
        if (this.format._options.appendOnly) {
          this.writeHeader({
            minimumBlockSize: 16,
            maximumBlockSize: 65535,
            minimumFrameSize: 0,
            maximumFrameSize: 0,
            sampleRate: this.sampleRate,
            channels: this.channels,
            bitsPerSample: this.bitsPerSample,
            totalSamples: 0
          });
        }
      }
      if (!this.metadataWritten) {
        this.writeVorbisCommentAndPictureBlock();
      }
      let i = fl.tempFromBytes(t.data);
      i.skip(2);
      let a = ca(new A(B(i, 2)).readBits(4));
      if (a === null) {
        throw Error(`Invalid FLAC frame: Invalid block size.`);
      }
      ua(i);
      let o = da(i, a);
      if (!this.format._options.appendOnly) {
        this.blockSizes.push(o);
        this.frameSizes.push(t.data.length);
      }
      let s = this.writer.getPos();
      this.writer.write(t.data);
      if (this.format._options.onFrame) {
        this.format._options.onFrame(t.data, s);
      }
      await this.writer.flush();
    } finally {
      i();
    }
  }
  addSubtitleCue() {
    throw Error(`FLAC does not support subtitles.`);
  }
  async finalize() {
    let e = await this.mutex.acquire();
    if (!this.format._options.appendOnly) {
      let e = Infinity;
      let t = 0;
      let r = Infinity;
      let i = 0;
      let a = 0;
      for (let n = 0; n < this.blockSizes.length; n++) {
        r = Math.min(r, this.frameSizes[n]);
        i = Math.max(i, this.frameSizes[n]);
        t = Math.max(t, this.blockSizes[n]);
        a += this.blockSizes[n];
        if (n !== this.blockSizes.length - 1) {
          e = Math.min(e, this.blockSizes[n]);
        }
      }
      n(this.sampleRate !== null);
      n(this.channels !== null);
      n(this.bitsPerSample !== null);
      this.writer.seek(4);
      this.writeHeader({
        minimumBlockSize: e,
        maximumBlockSize: t,
        minimumFrameSize: r,
        maximumFrameSize: i,
        sampleRate: this.sampleRate,
        channels: this.channels,
        bitsPerSample: this.bitsPerSample,
        totalSamples: a
      });
    }
    e();
  }
};
var Hl = /(?:(.+?)\n)?((?:\d{2}:)?\d{2}:\d{2}.\d{3})\s+-->\s+((?:\d{2}:)?\d{2}:\d{2}.\d{3})/g;
var Ul = /^WEBVTT(.|\n)*?\n{2}/;
var Wl = /<(?:(\d{2}):)?(\d{2}):(\d{2}).(\d{3})>/g;
var Gl = class {
  constructor(e) {
    this.preambleText = null;
    this.preambleEmitted = false;
    this.options = e;
  }
  parse(e) {
    e = e.replaceAll(`\r
`, `
`).replaceAll(`\r`, `
`);
    Hl.lastIndex = 0;
    let t;
    if (!this.preambleText) {
      if (!Ul.test(e)) {
        throw Error(`WebVTT preamble incorrect.`);
      }
      t = Hl.exec(e);
      let n = e.slice(0, t?.index ?? e.length).trimEnd();
      if (!n) {
        throw Error(`No WebVTT preamble provided.`);
      }
      this.preambleText = n;
      if (t) {
        e = e.slice(t.index);
        Hl.lastIndex = 0;
      }
    }
    while (t = Hl.exec(e)) {
      let n = e.slice(0, t.index);
      let r = t[1];
      let i = t.index + t[0].length;
      let a = e.indexOf(`
`, i) + 1;
      let o = e.slice(i, a).trim();
      let s = e.indexOf(`

`, i);
      if (s === -1) {
        s = e.length;
      }
      let c = ql(t[2]);
      let l = ql(t[3]) - c;
      let u = e.slice(a, s).trim();
      e = e.slice(s).trimStart();
      Hl.lastIndex = 0;
      let d = {
        timestamp: c / 1000,
        duration: l / 1000,
        text: u,
        identifier: r,
        settings: o,
        notes: n
      };
      let f = {};
      f.config = {
        description: this.preambleText
      };
      this.preambleEmitted ||= true;
      this.options.output(d, f);
    }
  }
};
var Kl = /(?:(\d{2}):)?(\d{2}):(\d{2}).(\d{3})/;
var ql = e => {
  let t = Kl.exec(e);
  if (!t) {
    throw Error(`Expected match.`);
  }
  return Number(t[1] || `0`) * 3600000 + Number(t[2]) * 60000 + Number(t[3]) * 1000 + Number(t[4]);
};
var Jl = e => {
  let t = Math.floor(e / 3600000);
  let n = Math.floor(e % 3600000 / 60000);
  let r = Math.floor(e % 60000 / 1000);
  let i = e % 1000;
  return `${t.toString().padStart(2, `0`)}:${n.toString().padStart(2, `0`)}:${r.toString().padStart(2, `0`)}.${i.toString().padStart(3, `0`)}`;
};
var Yl = class {
  constructor(e) {
    this.writer = e;
    this.helper = new Uint8Array(8);
    this.helperView = new DataView(this.helper.buffer);
    this.offsets = new WeakMap();
  }
  writeU32(e) {
    this.helperView.setUint32(0, e, false);
    this.writer.write(this.helper.subarray(0, 4));
  }
  writeU64(e) {
    this.helperView.setUint32(0, Math.floor(e / 4294967296), false);
    this.helperView.setUint32(4, e, false);
    this.writer.write(this.helper.subarray(0, 8));
  }
  writeAscii(e) {
    for (let t = 0; t < e.length; t++) {
      this.helperView.setUint8(t % 8, e.charCodeAt(t));
      if (t % 8 == 7) {
        this.writer.write(this.helper);
      }
    }
    if (e.length % 8 != 0) {
      this.writer.write(this.helper.subarray(0, e.length % 8));
    }
  }
  writeBox(e) {
    this.offsets.set(e, this.writer.getPos());
    if (e.contents && !e.children) {
      this.writeBoxHeader(e, e.size ?? e.contents.byteLength + 8);
      this.writer.write(e.contents);
    } else {
      let t = this.writer.getPos();
      this.writeBoxHeader(e, 0);
      if (e.contents) {
        this.writer.write(e.contents);
      }
      if (e.children) {
        for (let t of e.children) {
          if (t) {
            this.writeBox(t);
          }
        }
      }
      let n = this.writer.getPos();
      let r = e.size ?? n - t;
      this.writer.seek(t);
      this.writeBoxHeader(e, r);
      this.writer.seek(n);
    }
  }
  writeBoxHeader(e, t) {
    this.writeU32(e.largeSize ? 1 : t);
    this.writeAscii(e.type);
    if (e.largeSize) {
      this.writeU64(t);
    }
  }
  measureBoxHeader(e) {
    return 8 + (e.largeSize ? 8 : 0);
  }
  patchBox(e) {
    let t = this.offsets.get(e);
    n(t !== undefined);
    let r = this.writer.getPos();
    this.writer.seek(t);
    this.writeBox(e);
    this.writer.seek(r);
  }
  measureBox(e) {
    if (e.contents && !e.children) {
      return this.measureBoxHeader(e) + e.contents.byteLength;
    }
    {
      let t = this.measureBoxHeader(e);
      if (e.contents) {
        t += e.contents.byteLength;
      }
      if (e.children) {
        for (let n of e.children) {
          if (n) {
            t += this.measureBox(n);
          }
        }
      }
      return t;
    }
  }
};
var K = new Uint8Array(8);
var Xl = new DataView(K.buffer);
var q = e => {
  return [(e % 256 + 256) % 256];
};
var J = e => {
  Xl.setUint16(0, e, false);
  return [K[0], K[1]];
};
var Zl = e => {
  Xl.setInt16(0, e, false);
  return [K[0], K[1]];
};
var Ql = e => {
  Xl.setUint32(0, e, false);
  return [K[1], K[2], K[3]];
};
var Y = e => {
  Xl.setUint32(0, e, false);
  return [K[0], K[1], K[2], K[3]];
};
var $l = e => {
  Xl.setInt32(0, e, false);
  return [K[0], K[1], K[2], K[3]];
};
var eu = e => {
  Xl.setUint32(0, Math.floor(e / 4294967296), false);
  Xl.setUint32(4, e, false);
  return [K[0], K[1], K[2], K[3], K[4], K[5], K[6], K[7]];
};
var tu = e => {
  Xl.setInt32(0, Math.floor(e / 4294967296), false);
  Xl.setUint32(4, e, false);
  return [K[0], K[1], K[2], K[3], K[4], K[5], K[6], K[7]];
};
var nu = e => {
  Xl.setInt16(0, e * 256, false);
  return [K[0], K[1]];
};
var ru = e => {
  Xl.setInt32(0, e * 65536, false);
  return [K[0], K[1], K[2], K[3]];
};
var iu = e => {
  Xl.setInt32(0, e * 1073741824, false);
  return [K[0], K[1], K[2], K[3]];
};
var au = (e, t) => {
  let n = [];
  let r = e;
  do {
    let e = r & 127;
    r >>= 7;
    if (n.length > 0) {
      e |= 128;
    }
    n.push(e);
    if (t !== undefined) {
      t--;
    }
  } while (r > 0 || t);
  return n.reverse();
};
var X = (e, t = false) => {
  let n = Array(e.length).fill(null).map((t, n) => {
    return e.charCodeAt(n);
  });
  if (t) {
    n.push(0);
  }
  return n;
};
var ou = e => {
  let t = Math.PI / 180 * e;
  let n = Math.round(Math.cos(t));
  let r = Math.round(Math.sin(t));
  return [n, r, 0, -r, n, 0, 0, 0, 1];
};
var su = ou(0);
var cu = e => {
  return [ru(e[0]), ru(e[1]), iu(e[2]), ru(e[3]), ru(e[4]), iu(e[5]), ru(e[6]), ru(e[7]), iu(e[8])];
};
var Z = (e, t, n) => {
  return {
    type: e,
    contents: t && new Uint8Array(t.flat(10)),
    children: n
  };
};
var Q = (e, t, n, r, i) => {
  return Z(e, [q(t), Ql(n), r ?? []], i);
};
var lu = e => {
  if (e.isQuickTime) {
    return Z(`ftyp`, [X(`qt  `), Y(512), X(`qt  `)]);
  } else {
    if (e.fragmented) {
      if (e.cmaf) {
        return Z(`ftyp`, [X(`iso5`), Y(512), X(`iso5`), X(`iso6`), X(`mp41`), X(`cmfc`), X(`dash`)]);
      } else {
        return Z(`ftyp`, [X(`iso5`), Y(512), X(`iso5`), X(`iso6`), X(`mp41`)]);
      }
    } else {
      return Z(`ftyp`, [X(`isom`), Y(512), X(`isom`), e.holdsAvc ? X(`avc1`) : [], X(`mp41`)]);
    }
  }
};
var uu = () => {
  return Z(`styp`, [X(`iso5`), Y(0), X(`iso5`), X(`iso6`), X(`mp41`), X(`cmfc`), X(`dash`)]);
};
var du = (e, t) => {
  let n = e.maxWrittenEndTimestamp - e.minWrittenTimestamp;
  if (!Number.isFinite(n)) {
    n = 0;
  }
  return Q(`sidx`, 1, 0, [Y(1), Y(Jd), eu($(e.minWrittenTimestamp, Jd)), eu(0), J(0), J(1), Y(t & 2147483647), Y($(n, Jd)), Y(0)]);
};
var fu = e => {
  return {
    type: `mdat`,
    largeSize: e
  };
};
var pu = e => {
  return {
    type: `free`,
    size: e
  };
};
var mu = e => {
  return Z(`moov`, undefined, [hu(e.creationTime, e.trackDatas), ...e.trackDatas.map(t => {
    return _u(t, e.creationTime);
  }), e.isFragmented ? id(e.trackDatas) : null, yd(e)]);
};
var hu = (e, t) => {
  let n = Math.max(0, ...t.map(e => {
    return $(gu(e), Jd) + $(e.startTimestampOffset ?? 0, Jd);
  }));
  let r = Math.max(0, ...t.map(e => {
    return e.track.id;
  })) + 1;
  let i = !a(e) || !a(n);
  let o = i ? eu : Y;
  return Q(`mvhd`, +i, 0, [o(e), o(e), Y(Jd), o(n), ru(1), nu(1), Array(10).fill(0), cu(su), Array(24).fill(0), Y(r)]);
};
var gu = e => {
  if (e.samples.length === 0) {
    return 0;
  }
  let t = Infinity;
  let n = -Infinity;
  for (let r = 0; r < e.samples.length; r++) {
    let i = e.samples[r];
    if (i.timestamp < t) {
      t = i.timestamp;
    }
    if (i.timestamp + i.duration > n) {
      n = i.timestamp + i.duration;
    }
  }
  if (t === Infinity) {
    return 0;
  } else {
    return n - t;
  }
};
var _u = (e, t) => {
  let n = Xd(e);
  let r = e.startTimestampOffset !== null && e.startTimestampOffset > 0;
  return Z(`trak`, undefined, [vu(e, t), r ? yu(e, e.startTimestampOffset) : null, bu(e, t), n.name === undefined ? null : Z(`udta`, undefined, [Z(`name`, [...f.encode(n.name)])])]);
};
var vu = (e, t) => {
  let n = $(gu(e), Jd) + $(e.startTimestampOffset ?? 0, Jd);
  let r = !a(t) || !a(n);
  let i = r ? eu : Y;
  let o;
  if (e.type === `video`) {
    let t = e.track.metadata.rotation;
    o = ou(t ?? 0);
  } else {
    o = su;
  }
  let s = 2;
  if (e.track.metadata.disposition?.default !== false) {
    s |= 1;
  }
  return Q(`tkhd`, +r, s, [i(t), i(t), Y(e.track.id), Y(0), i(n), Array(8).fill(0), J(0), J(e.track.id), nu(+(e.type === `audio`)), J(0), cu(o), ru(e.type === `video` ? e.info.width : 0), ru(e.type === `video` ? e.info.height : 0)]);
};
var yu = (e, t) => {
  let n = $(t, Jd);
  let r = $(gu(e), Jd);
  let i = !a(n) || !a(r);
  let o = i ? eu : Y;
  let s = i ? tu : $l;
  return Z(`edts`, undefined, [Q(`elst`, +!!i, 0, [Y(2), o(n), s(-1), ru(1), o(r), s(0), ru(1)])]);
};
var bu = (e, t) => {
  return Z(`mdia`, undefined, [xu(e, t), wu(true, Su[e.type], Cu[e.type]), Tu(e)]);
};
var xu = (e, t) => {
  let n = $(gu(e), e.timescale);
  let r = !a(t) || !a(n);
  let i = r ? eu : Y;
  return Q(`mdhd`, +r, 0, [i(t), i(t), Y(e.timescale), i(n), J(Nd(e.track.metadata.languageCode ?? `und`)), J(0)]);
};
var Su = {
  video: `vide`,
  audio: `soun`,
  subtitle: `text`
};
var Cu = {
  video: `MediabunnyVideoHandler`,
  audio: `MediabunnySoundHandler`,
  subtitle: `MediabunnyTextHandler`
};
var wu = (e, t, n, r = `\0\0\0\0`) => {
  return Q(`hdlr`, 0, 0, [e ? X(`mhlr`) : Y(0), X(t), X(r), Y(0), Y(0), X(n, true)]);
};
var Tu = e => {
  return Z(`minf`, undefined, [Eu[e.type](), Du(), Au(e)]);
};
var Eu = {
  video: () => {
    return Q(`vmhd`, 0, 1, [J(0), J(0), J(0), J(0)]);
  },
  audio: () => {
    return Q(`smhd`, 0, 0, [J(0), J(0)]);
  },
  subtitle: () => {
    return Q(`nmhd`, 0, 0);
  }
};
var Du = () => {
  return Z(`dinf`, undefined, [Ou()]);
};
var Ou = () => {
  return Q(`dref`, 0, 0, [Y(1)], [ku()]);
};
var ku = () => {
  return Q(`url `, 0, 1);
};
var Au = e => {
  let t = e.compositionTimeOffsetTable.length > 1 || e.compositionTimeOffsetTable.some(e => {
    return e.sampleCompositionTimeOffset !== 0;
  });
  return Z(`stbl`, undefined, [ju(e), Zu(e), t ? nd(e) : null, t ? rd(e) : null, $u(e), ed(e), td(e), Qu(e)]);
};
var ju = e => {
  let t;
  if (e.type === `video`) {
    t = Mu(Dd(e.track.source._codec, e.info.decoderConfig.codec), e);
  } else if (e.type === `audio`) {
    let r = kd(e.track.source._codec, e.muxer.isQuickTime);
    n(r);
    t = zu(r, e);
  } else if (e.type === `subtitle`) {
    t = Yu(jd[e.track.source._codec], e);
  }
  n(t);
  return Q(`stsd`, 0, 0, [Y(1)], [t]);
};
var Mu = (e, t) => {
  return Z(e, [[,,,,,,].fill(0), J(1), J(0), J(0), Array(12).fill(0), J(t.info.width), J(t.info.height), Y(4718592), Y(4718592), Y(0), J(1), Array(32).fill(0), J(24), Zl(65535)], [Od[t.track.source._codec]?.(t) ?? null, Nu(t), x(t.info.decoderConfig.colorSpace) ? Pu(t) : null]);
};
var Nu = e => {
  if (e.info.pixelAspectRatio.num === e.info.pixelAspectRatio.den) {
    return null;
  } else {
    return Z(`pasp`, [Y(e.info.pixelAspectRatio.num), Y(e.info.pixelAspectRatio.den)]);
  }
};
var Pu = e => {
  return Z(`colr`, [X(e.muxer.isQuickTime ? `nclc` : `nclx`), J(h[e.info.decoderConfig.colorSpace.primaries]), J(_[e.info.decoderConfig.colorSpace.transfer]), J(y[e.info.decoderConfig.colorSpace.matrix]), e.muxer.isQuickTime ? [] : q(!!e.info.decoderConfig.colorSpace.fullRange << 7)]);
};
var Fu = e => {
  return e.info.decoderConfig && Z(`avcC`, [...l(e.info.decoderConfig.description)]);
};
var Iu = e => {
  return e.info.decoderConfig && Z(`hvcC`, [...l(e.info.decoderConfig.description)]);
};
var Lu = e => {
  if (!e.info.decoderConfig) {
    return null;
  }
  let t = e.info.decoderConfig;
  let n = t.codec.split(`.`);
  let r = Number(n[1]);
  let i = Number(n[2]);
  let a = Number(n[3]);
  let o = n[4] ? Number(n[4]) : 1;
  let s = n[8] ? Number(n[8]) : Number(t.colorSpace?.fullRange ?? 0);
  let c = (a << 4) + (o << 1) + s;
  let l = n[5] ? Number(n[5]) : t.colorSpace?.primaries ? h[t.colorSpace.primaries] : 2;
  let u = n[6] ? Number(n[6]) : t.colorSpace?.transfer ? _[t.colorSpace.transfer] : 2;
  let d = n[7] ? Number(n[7]) : t.colorSpace?.matrix ? y[t.colorSpace.matrix] : 2;
  return Q(`vpcC`, 1, 0, [q(r), q(i), q(c), q(l), q(u), q(d), J(0)]);
};
var Ru = e => {
  return Z(`av1C`, zt(e.info.decoderConfig.codec));
};
var zu = (e, t) => {
  let n = 0;
  let r;
  let i = 16;
  let a = M.includes(t.track.source._codec);
  if (a) {
    let e = t.track.source._codec;
    let {
      sampleSize: r
    } = Kt(e);
    i = r * 8;
    if (i > 16) {
      n = 1;
    }
  }
  if (t.muxer.isQuickTime) {
    n = 1;
  }
  if (n === 0) {
    r = [[,,,,,,].fill(0), J(1), J(n), J(0), Y(0), J(t.info.numberOfChannels), J(i), J(0), J(0), J(t.info.sampleRate < 65536 ? t.info.sampleRate : 0), J(0)];
  } else {
    let e = a ? 0 : -2;
    r = [[,,,,,,].fill(0), J(1), J(n), J(0), Y(0), J(t.info.numberOfChannels), J(Math.min(i, 16)), Zl(e), J(0), J(t.info.sampleRate < 65536 ? t.info.sampleRate : 0), J(0), a ? [Y(1), Y(i / 8), Y(t.info.numberOfChannels * i / 8)] : [Y(0), Y(0), Y(0)], Y(2)];
  }
  return Z(e, r, [Ad(t.track.source._codec, t.muxer.isQuickTime)?.(t) ?? null]);
};
var Bu = e => {
  let t;
  switch (e.track.source._codec) {
    case `aac`:
      {
        t = 64;
        break;
      }
    case `mp3`:
      {
        t = 107;
        break;
      }
    case `vorbis`:
      {
        t = 221;
        break;
      }
    default:
      {
        throw Error(`Unhandled audio codec: ${e.track.source._codec}`);
      }
  }
  let n = [...q(t), ...q(21), ...Ql(0), ...Y(0), ...Y(0)];
  if (e.info.decoderConfig.description) {
    let t = l(e.info.decoderConfig.description);
    n = [...n, ...q(5), ...au(t.byteLength), ...t];
  }
  n = [...J(1), ...q(0), ...q(4), ...au(n.length), ...n, ...q(6), ...q(1), ...q(2)];
  n = [...q(3), ...au(n.length), ...n];
  return Q(`esds`, 0, 0, n);
};
var Vu = e => {
  return Z(`wave`, undefined, [Hu(e), Uu(e), Z(`\0\0\0\0`)]);
};
var Hu = e => {
  return Z(`frma`, [X(kd(e.track.source._codec, e.muxer.isQuickTime))]);
};
var Uu = e => {
  let {
    littleEndian: t
  } = Kt(e.track.source._codec);
  return Z(`enda`, [J(+t)]);
};
var Wu = e => {
  let t = e.info.numberOfChannels;
  let r = 3840;
  let i = e.info.sampleRate;
  let a = 0;
  let o = 0;
  let s = new Uint8Array();
  let c = e.info.decoderConfig?.description;
  if (c) {
    n(c.byteLength >= 18);
    let e = $n(l(c));
    t = e.outputChannelCount;
    r = e.preSkip;
    i = e.inputSampleRate;
    a = e.outputGain;
    o = e.channelMappingFamily;
    if (e.channelMappingTable) {
      s = e.channelMappingTable;
    }
  }
  return Z(`dOps`, [q(0), q(t), J(r), Y(i), Zl(a), q(o), ...s]);
};
var Gu = e => {
  let t = e.info.decoderConfig?.description;
  n(t);
  return Q(`dfLa`, 0, 0, [...l(t).subarray(4)]);
};
var Ku = e => {
  let {
    littleEndian: t,
    sampleSize: n
  } = Kt(e.track.source._codec);
  return Q(`pcmC`, 0, 0, [q(+t), q(n * 8)]);
};
var qu = e => {
  let t = cr(e.info.firstPacket.data);
  if (!t) {
    throw Error(`Couldn't extract AC-3 frame info from the audio packet. Ensure the packets contain valid AC-3 sync frames (as specified in ETSI TS 102 366).`);
  }
  let n = new Uint8Array(3);
  let r = new A(n);
  r.writeBits(2, t.fscod);
  r.writeBits(5, t.bsid);
  r.writeBits(3, t.bsmod);
  r.writeBits(3, t.acmod);
  r.writeBits(1, t.lfeon);
  r.writeBits(5, t.bitRateCode);
  r.writeBits(5, 0);
  return Z(`dac3`, [...n]);
};
var Ju = e => {
  let t = mr(e.info.firstPacket.data);
  if (!t) {
    throw Error(`Couldn't extract E-AC-3 frame info from the audio packet. Ensure the packets contain valid E-AC-3 sync frames (as specified in ETSI TS 102 366).`);
  }
  let n = 16;
  for (let e of t.substreams) {
    n += 23;
    if (e.numDepSub > 0) {
      n += 9;
    } else {
      n += 1;
    }
  }
  let r = Math.ceil(n / 8);
  let i = new Uint8Array(r);
  let a = new A(i);
  a.writeBits(13, t.dataRate);
  a.writeBits(3, t.substreams.length - 1);
  for (let e of t.substreams) {
    a.writeBits(2, e.fscod);
    a.writeBits(5, e.bsid);
    a.writeBits(1, 0);
    a.writeBits(1, 0);
    a.writeBits(3, e.bsmod);
    a.writeBits(3, e.acmod);
    a.writeBits(1, e.lfeon);
    a.writeBits(3, 0);
    a.writeBits(4, e.numDepSub);
    if (e.numDepSub > 0) {
      a.writeBits(9, e.chanLoc);
    } else {
      a.writeBits(1, 0);
    }
  }
  return Z(`dec3`, [...i]);
};
var Yu = (e, t) => {
  return Z(e, [[,,,,,,].fill(0), J(1)], [Md[t.track.source._codec](t)]);
};
var Xu = e => {
  return Z(`vttC`, [...f.encode(e.info.config.description)]);
};
var Zu = e => {
  return Q(`stts`, 0, 0, [Y(e.timeToSampleTable.length), e.timeToSampleTable.map(e => {
    return [Y(e.sampleCount), Y(e.sampleDelta)];
  })]);
};
var Qu = e => {
  if (e.samples.every(e => {
    return e.type === `key`;
  })) {
    return null;
  }
  let t = [...e.samples.entries()].filter(([, e]) => {
    return e.type === `key`;
  });
  return Q(`stss`, 0, 0, [Y(t.length), t.map(([e]) => {
    return Y(e + 1);
  })]);
};
var $u = e => {
  return Q(`stsc`, 0, 0, [Y(e.compactlyCodedChunkTable.length), e.compactlyCodedChunkTable.map(e => {
    return [Y(e.firstChunk), Y(e.samplesPerChunk), Y(1)];
  })]);
};
var ed = e => {
  if (e.type === `audio` && e.info.requiresPcmTransformation) {
    let {
      sampleSize: t
    } = Kt(e.track.source._codec);
    return Q(`stsz`, 0, 0, [Y(t * e.info.numberOfChannels), Y(e.samples.reduce((t, n) => {
      return t + $(n.duration, e.timescale);
    }, 0))]);
  }
  return Q(`stsz`, 0, 0, [Y(0), Y(e.samples.length), e.samples.map(e => {
    return Y(e.size);
  })]);
};
var td = e => {
  if (e.finalizedChunks.length > 0 && i(e.finalizedChunks).offset >= 4294967296) {
    return Q(`co64`, 0, 0, [Y(e.finalizedChunks.length), e.finalizedChunks.map(e => {
      return eu(e.offset);
    })]);
  } else {
    return Q(`stco`, 0, 0, [Y(e.finalizedChunks.length), e.finalizedChunks.map(e => {
      return Y(e.offset);
    })]);
  }
};
var nd = e => {
  return Q(`ctts`, 1, 0, [Y(e.compositionTimeOffsetTable.length), e.compositionTimeOffsetTable.map(e => {
    return [Y(e.sampleCount), $l(e.sampleCompositionTimeOffset)];
  })]);
};
var rd = e => {
  let t = Infinity;
  let r = -Infinity;
  let i = Infinity;
  let a = -Infinity;
  n(e.compositionTimeOffsetTable.length > 0);
  n(e.samples.length > 0);
  for (let n = 0; n < e.compositionTimeOffsetTable.length; n++) {
    let i = e.compositionTimeOffsetTable[n];
    t = Math.min(t, i.sampleCompositionTimeOffset);
    r = Math.max(r, i.sampleCompositionTimeOffset);
  }
  for (let t = 0; t < e.samples.length; t++) {
    let n = e.samples[t];
    i = Math.min(i, $(n.timestamp, e.timescale));
    a = Math.max(a, $(n.timestamp + n.duration, e.timescale));
  }
  let o = Math.max(-t, 0);
  if (a >= 2147483648) {
    return null;
  } else {
    return Q(`cslg`, 0, 0, [$l(o), $l(t), $l(r), $l(i), $l(a)]);
  }
};
var id = e => {
  return Z(`mvex`, undefined, e.map(ad));
};
var ad = e => {
  return Q(`trex`, 0, 0, [Y(e.track.id), Y(1), Y(0), Y(0), Y(0)]);
};
var od = (e, t) => {
  return Z(`moof`, undefined, [sd(e), ...t.map(ld)]);
};
var sd = e => {
  return Q(`mfhd`, 0, 0, [Y(e)]);
};
var cd = e => {
  let t = 0;
  let n = 0;
  let r = e.type === `delta`;
  n |= +r;
  if (r) {
    t |= 1;
  } else {
    t |= 2;
  }
  return t << 24 | n << 16 | 0;
};
var ld = e => {
  return Z(`traf`, undefined, [ud(e), dd(e), fd(e)]);
};
var ud = e => {
  n(e.currentChunk);
  let t = 0;
  t |= 8;
  t |= 16;
  t |= 32;
  t |= 131072;
  let r = e.currentChunk.samples[1] ?? e.currentChunk.samples[0];
  let i = {
    duration: r.timescaleUnitsToNextSample,
    size: r.size,
    flags: cd(r)
  };
  return Q(`tfhd`, 0, t, [Y(e.track.id), Y(i.duration), Y(i.size), Y(i.flags)]);
};
var dd = e => {
  n(e.currentChunk);
  return Q(`tfdt`, 1, 0, [eu($(e.currentChunk.startTimestamp, e.timescale))]);
};
var fd = e => {
  n(e.currentChunk);
  let t = e.currentChunk.samples.map(e => {
    return e.timescaleUnitsToNextSample;
  });
  let r = e.currentChunk.samples.map(e => {
    return e.size;
  });
  let i = e.currentChunk.samples.map(cd);
  let a = e.currentChunk.samples.map(t => {
    return $(t.timestamp - t.decodeTimestamp, e.timescale);
  });
  let o = new Set(t);
  let s = new Set(r);
  let c = new Set(i);
  let l = new Set(a);
  let u = c.size === 2 && i[0] !== i[1];
  let d = o.size > 1;
  let f = s.size > 1;
  let p = !u && c.size > 1;
  let m = l.size > 1 || [...l].some(e => {
    return e !== 0;
  });
  let h = 0;
  h |= 1;
  h |= u * 4;
  h |= d * 256;
  h |= f * 512;
  h |= p * 1024;
  h |= m * 2048;
  return Q(`trun`, 1, h, [Y(e.currentChunk.samples.length), Y(e.currentChunk.offset - e.currentChunk.moofOffset || 0), u ? Y(i[0]) : [], e.currentChunk.samples.map((e, n) => {
    return [d ? Y(t[n]) : [], f ? Y(r[n]) : [], p ? Y(i[n]) : [], m ? $l(a[n]) : []];
  })]);
};
var pd = e => {
  return Z(`mfra`, undefined, [...e.map(md), hd()]);
};
var md = (e, t) => {
  return Q(`tfra`, 1, 0, [Y(e.track.id), Y(63), Y(e.finalizedChunks.length), e.finalizedChunks.map(n => {
    return [eu($(n.samples[0].timestamp, e.timescale)), eu(n.moofOffset), Y(t + 1), Y(1), Y(1)];
  })]);
};
var hd = () => {
  return Q(`mfro`, 0, 0, [Y(0)]);
};
var gd = () => {
  return Z(`vtte`);
};
var _d = (e, t, n, r, i) => {
  return Z(`vttc`, undefined, [i === null ? null : Z(`vsid`, [$l(i)]), n === null ? null : Z(`iden`, [...f.encode(n)]), t === null ? null : Z(`ctim`, [...f.encode(Jl(t))]), r === null ? null : Z(`sttg`, [...f.encode(r)]), Z(`payl`, [...f.encode(e)])]);
};
var vd = e => {
  return Z(`vtta`, [...f.encode(e)]);
};
var yd = e => {
  let t = [];
  let n = e.format._options.metadataFormat ?? `auto`;
  let r = e.output._metadataTags;
  if (n === `mdir` || n === `auto` && !e.isQuickTime) {
    let e = wd(r);
    if (e) {
      t.push(e);
    }
  } else if (n === `mdta`) {
    let e = Td(r);
    if (e) {
      t.push(e);
    }
  } else if (n === `udta` || n === `auto` && e.isQuickTime) {
    bd(t, e.output._metadataTags);
  }
  if (t.length === 0) {
    return null;
  } else {
    return Z(`udta`, undefined, t);
  }
};
var bd = (e, t) => {
  for (let {
    key: n,
    value: r
  } of Be(t)) {
    switch (n) {
      case `title`:
        {
          e.push(xd(`©nam`, r));
          break;
        }
      case `description`:
        {
          e.push(xd(`©des`, r));
          break;
        }
      case `artist`:
        {
          e.push(xd(`©ART`, r));
          break;
        }
      case `album`:
        {
          e.push(xd(`©alb`, r));
          break;
        }
      case `albumArtist`:
        {
          e.push(xd(`albr`, r));
          break;
        }
      case `genre`:
        {
          e.push(xd(`©gen`, r));
          break;
        }
      case `date`:
        {
          e.push(xd(`©day`, r.toISOString().slice(0, 10)));
          break;
        }
      case `comment`:
        {
          e.push(xd(`©cmt`, r));
          break;
        }
      case `lyrics`:
        {
          e.push(xd(`©lyr`, r));
          break;
        }
      case `raw`:
        {
          break;
        }
      case `discNumber`:
      case `discsTotal`:
      case `trackNumber`:
      case `tracksTotal`:
      case `images`:
        {
          break;
        }
      default:
        {
          D(n);
        }
    }
  }
  if (t.raw) {
    for (let n in t.raw) {
      let r = t.raw[n];
      if (r != null && n.length === 4 && !e.some(e => {
        return e.type === n;
      })) {
        if (typeof r == `string`) {
          e.push(xd(n, r));
        } else if (r instanceof Uint8Array) {
          e.push(Z(n, Array.from(r)));
        }
      }
    }
  }
};
var xd = (e, t) => {
  let n = f.encode(t);
  return Z(e, [J(n.length), J(Nd(`und`)), Array.from(n)]);
};
var Sd = {
  'image/jpeg': 13,
  'image/png': 14,
  'image/bmp': 27
};
var Cd = (e, t) => {
  let n = [];
  for (let {
    key: r,
    value: i
  } of Be(e)) {
    switch (r) {
      case `title`:
        {
          n.push({
            key: t ? `title` : `©nam`,
            value: Ed(i)
          });
          break;
        }
      case `description`:
        {
          n.push({
            key: t ? `description` : `©des`,
            value: Ed(i)
          });
          break;
        }
      case `artist`:
        {
          n.push({
            key: t ? `artist` : `©ART`,
            value: Ed(i)
          });
          break;
        }
      case `album`:
        {
          n.push({
            key: t ? `album` : `©alb`,
            value: Ed(i)
          });
          break;
        }
      case `albumArtist`:
        {
          n.push({
            key: t ? `album_artist` : `aART`,
            value: Ed(i)
          });
          break;
        }
      case `comment`:
        {
          n.push({
            key: t ? `comment` : `©cmt`,
            value: Ed(i)
          });
          break;
        }
      case `genre`:
        {
          n.push({
            key: t ? `genre` : `©gen`,
            value: Ed(i)
          });
          break;
        }
      case `lyrics`:
        {
          n.push({
            key: t ? `lyrics` : `©lyr`,
            value: Ed(i)
          });
          break;
        }
      case `date`:
        {
          n.push({
            key: t ? `date` : `©day`,
            value: Ed(i.toISOString().slice(0, 10))
          });
          break;
        }
      case `images`:
        {
          for (let e of i) {
            if (e.kind === `coverFront`) {
              n.push({
                key: `covr`,
                value: Z(`data`, [Y(Sd[e.mimeType] ?? 0), Y(0), Array.from(e.data)])
              });
            }
          }
          break;
        }
      case `trackNumber`:
        {
          if (t) {
            let t = e.tracksTotal === undefined ? i.toString() : `${i}/${e.tracksTotal}`;
            n.push({
              key: `track`,
              value: Ed(t)
            });
          } else {
            n.push({
              key: `trkn`,
              value: Z(`data`, [Y(0), Y(0), J(0), J(i), J(e.tracksTotal ?? 0), J(0)])
            });
          }
          break;
        }
      case `discNumber`:
        {
          if (!t) {
            n.push({
              key: `disc`,
              value: Z(`data`, [Y(0), Y(0), J(0), J(i), J(e.discsTotal ?? 0), J(0)])
            });
          }
          break;
        }
      case `tracksTotal`:
      case `discsTotal`:
        {
          break;
        }
      case `raw`:
        {
          break;
        }
      default:
        {
          D(r);
        }
    }
  }
  if (e.raw) {
    for (let r in e.raw) {
      let i = e.raw[r];
      if (i != null && (!!t || r.length === 4) && !n.some(e => {
        return e.key === r;
      })) {
        if (typeof i == `string`) {
          n.push({
            key: r,
            value: Ed(i)
          });
        } else if (i instanceof Uint8Array) {
          n.push({
            key: r,
            value: Z(`data`, [Y(0), Y(0), Array.from(i)])
          });
        } else if (i instanceof ht) {
          n.push({
            key: r,
            value: Z(`data`, [Y(Sd[i.mimeType] ?? 0), Y(0), Array.from(i.data)])
          });
        }
      }
    }
  }
  return n;
};
var wd = e => {
  let t = Cd(e, false);
  if (t.length === 0) {
    return null;
  } else {
    return Q(`meta`, 0, 0, undefined, [wu(false, `mdir`, ``, `appl`), Z(`ilst`, undefined, t.map(e => {
      return Z(e.key, undefined, [e.value]);
    }))]);
  }
};
var Td = e => {
  let t = Cd(e, true);
  if (t.length === 0) {
    return null;
  } else {
    return Z(`meta`, undefined, [wu(false, `mdta`, ``), Q(`keys`, 0, 0, [Y(t.length)], t.map(e => {
      return Z(`mdta`, [...f.encode(e.key)]);
    })), Z(`ilst`, undefined, t.map((e, t) => {
      return Z(String.fromCharCode(...Y(t + 1)), undefined, [e.value]);
    }))]);
  }
};
var Ed = e => {
  return Z(`data`, [Y(1), Y(0), ...f.encode(e)]);
};
var Dd = (e, t) => {
  switch (e) {
    case `avc`:
      {
        if (t.startsWith(`avc3`)) {
          return `avc3`;
        } else {
          return `avc1`;
        }
      }
    case `hevc`:
      {
        return `hvc1`;
      }
    case `vp8`:
      {
        return `vp08`;
      }
    case `vp9`:
      {
        return `vp09`;
      }
    case `av1`:
      {
        return `av01`;
      }
    case `prores`:
      {
        return t;
      }
  }
};
var Od = {
  avc: Fu,
  hevc: Iu,
  vp8: Lu,
  vp9: Lu,
  av1: Ru,
  prores: null
};
var kd = (e, t) => {
  switch (e) {
    case `aac`:
      {
        return `mp4a`;
      }
    case `mp3`:
      {
        return `mp4a`;
      }
    case `opus`:
      {
        return `Opus`;
      }
    case `vorbis`:
      {
        return `mp4a`;
      }
    case `flac`:
      {
        return `fLaC`;
      }
    case `ulaw`:
      {
        return `ulaw`;
      }
    case `alaw`:
      {
        return `alaw`;
      }
    case `pcm-u8`:
      {
        return `raw `;
      }
    case `pcm-s8`:
      {
        return `sowt`;
      }
    case `ac3`:
      {
        return `ac-3`;
      }
    case `eac3`:
      {
        return `ec-3`;
      }
  }
  if (t) {
    switch (e) {
      case `pcm-s16`:
        {
          return `sowt`;
        }
      case `pcm-s16be`:
        {
          return `twos`;
        }
      case `pcm-s24`:
        {
          return `in24`;
        }
      case `pcm-s24be`:
        {
          return `in24`;
        }
      case `pcm-s32`:
        {
          return `in32`;
        }
      case `pcm-s32be`:
        {
          return `in32`;
        }
      case `pcm-f32`:
        {
          return `fl32`;
        }
      case `pcm-f32be`:
        {
          return `fl32`;
        }
      case `pcm-f64`:
        {
          return `fl64`;
        }
      case `pcm-f64be`:
        {
          return `fl64`;
        }
    }
  } else {
    switch (e) {
      case `pcm-s16`:
        {
          return `ipcm`;
        }
      case `pcm-s16be`:
        {
          return `ipcm`;
        }
      case `pcm-s24`:
        {
          return `ipcm`;
        }
      case `pcm-s24be`:
        {
          return `ipcm`;
        }
      case `pcm-s32`:
        {
          return `ipcm`;
        }
      case `pcm-s32be`:
        {
          return `ipcm`;
        }
      case `pcm-f32`:
        {
          return `fpcm`;
        }
      case `pcm-f32be`:
        {
          return `fpcm`;
        }
      case `pcm-f64`:
        {
          return `fpcm`;
        }
      case `pcm-f64be`:
        {
          return `fpcm`;
        }
    }
  }
};
var Ad = (e, t) => {
  switch (e) {
    case `aac`:
      {
        return Bu;
      }
    case `mp3`:
      {
        return Bu;
      }
    case `opus`:
      {
        return Wu;
      }
    case `vorbis`:
      {
        return Bu;
      }
    case `flac`:
      {
        return Gu;
      }
    case `ac3`:
      {
        return qu;
      }
    case `eac3`:
      {
        return Ju;
      }
  }
  if (t) {
    switch (e) {
      case `pcm-s24`:
        {
          return Vu;
        }
      case `pcm-s24be`:
        {
          return Vu;
        }
      case `pcm-s32`:
        {
          return Vu;
        }
      case `pcm-s32be`:
        {
          return Vu;
        }
      case `pcm-f32`:
        {
          return Vu;
        }
      case `pcm-f32be`:
        {
          return Vu;
        }
      case `pcm-f64`:
        {
          return Vu;
        }
      case `pcm-f64be`:
        {
          return Vu;
        }
    }
  } else {
    switch (e) {
      case `pcm-s16`:
        {
          return Ku;
        }
      case `pcm-s16be`:
        {
          return Ku;
        }
      case `pcm-s24`:
        {
          return Ku;
        }
      case `pcm-s24be`:
        {
          return Ku;
        }
      case `pcm-s32`:
        {
          return Ku;
        }
      case `pcm-s32be`:
        {
          return Ku;
        }
      case `pcm-f32`:
        {
          return Ku;
        }
      case `pcm-f32be`:
        {
          return Ku;
        }
      case `pcm-f64`:
        {
          return Ku;
        }
      case `pcm-f64be`:
        {
          return Ku;
        }
    }
  }
  return null;
};
var jd = {
  webvtt: `wvtt`
};
var Md = {
  webvtt: Xu
};
var Nd = e => {
  n(e.length === 3);
  let t = 0;
  for (let n = 0; n < 3; n++) {
    t <<= 5;
    t += e.charCodeAt(n) - 96;
  }
  return t;
};
var Pd = class {
  constructor(e, t) {
    this.finalized = false;
    this.started = false;
    this.pos = 0;
    this.trackedWrites = null;
    this.trackedStart = -1;
    this.trackedEnd = -1;
    if (e._writerAcquired) {
      throw Error(`Can't have multiple Writers for the same Target.`);
    }
    this.target = e;
    e._setMonotonicity(t);
    e._writerAcquired = true;
  }
  start() {
    n(!this.started);
    this.target._start();
    this.started = true;
  }
  write(e) {
    n(this.started && !this.finalized);
    this.maybeTrackWrites(e);
    this.target._write(e, this.pos);
    this.pos += e.byteLength;
  }
  seek(e) {
    this.pos = e;
  }
  getPos() {
    return this.pos;
  }
  async flush() {
    n(this.started && !this.finalized);
    return this.target._flush();
  }
  async finalize() {
    n(this.started && !this.finalized);
    await this.target._finalize();
    this.finalized = true;
  }
  maybeTrackWrites(e) {
    if (!this.trackedWrites) {
      return;
    }
    let t = this.getPos();
    if (t < this.trackedStart) {
      if (t + e.byteLength <= this.trackedStart) {
        return;
      }
      e = e.subarray(this.trackedStart - t);
      t = 0;
    }
    let n = t + e.byteLength - this.trackedStart;
    let r = this.trackedWrites.byteLength;
    while (r < n) {
      r *= 2;
    }
    if (r !== this.trackedWrites.byteLength) {
      let e = new Uint8Array(r);
      e.set(this.trackedWrites, 0);
      this.trackedWrites = e;
    }
    this.trackedWrites.set(e, t - this.trackedStart);
    this.trackedEnd = Math.max(this.trackedEnd, t + e.byteLength);
  }
  startTrackingWrites() {
    this.trackedWrites = new Uint8Array(1024);
    this.trackedStart = this.getPos();
    this.trackedEnd = this.trackedStart;
  }
  stopTrackingWrites() {
    if (!this.trackedWrites) {
      throw Error(`Internal error: Can't get tracked writes since nothing was tracked.`);
    }
    let e = {
      data: this.trackedWrites.subarray(0, this.trackedEnd - this.trackedStart),
      start: this.trackedStart,
      end: this.trackedEnd
    };
    this.trackedWrites = null;
    return e;
  }
};
var Fd = qa === undefined ? undefined : qa;
var Id = class extends ut {
  constructor() {
    super(...arguments);
    this._writerAcquired = false;
    this._monotonicity = null;
    this.onwrite = null;
  }
  _setMonotonicity(e) {
    if (this._monotonicity !== false) {
      this._monotonicity = e;
    }
  }
  _dispatchWrite(e, t) {
    this.onwrite?.(e, t);
    this._emit(`write`, {
      start: e,
      end: t
    });
  }
  slice(e) {
    if (!Number.isInteger(e) || e < 0) {
      throw TypeError(`offset must be a non-negative integer.`);
    }
    return new Kd(this, e);
  }
};
var Ld = 65536;
var Rd = 4294967296;
var zd = class extends Id {
  constructor(e = {}) {
    super();
    this.buffer = null;
    this._maxPos = 0;
    if (!e || typeof e != `object`) {
      throw TypeError(`BufferTarget options, when provided, must be an object.`);
    }
    if (e.onFinalize !== undefined && typeof e.onFinalize != `function`) {
      throw TypeError(`options.onFinalize, when provided, must be a function.`);
    }
    this._options = e;
    this._supportsResize = `resize` in new ArrayBuffer(0);
    if (this._supportsResize) {
      try {
        this._buffer = new ArrayBuffer(Ld, {
          maxByteLength: Rd
        });
      } catch {
        this._buffer = new ArrayBuffer(Ld);
        this._supportsResize = false;
      }
    } else {
      this._buffer = new ArrayBuffer(Ld);
    }
    this._bytes = new Uint8Array(this._buffer);
  }
  _ensureSize(e) {
    let t = this._buffer.byteLength;
    while (t < e) {
      t *= 2;
    }
    if (t !== this._buffer.byteLength) {
      if (t > Rd) {
        throw Error(`ArrayBuffer exceeded maximum size of ${Rd} bytes. Please consider using another target.`);
      }
      if (this._supportsResize) {
        this._buffer.resize(t);
      } else {
        let e = new ArrayBuffer(t);
        let n = new Uint8Array(e);
        n.set(this._bytes, 0);
        this._buffer = e;
        this._bytes = n;
      }
    }
  }
  _start() {}
  _write(e, t) {
    this._ensureSize(t + e.byteLength);
    this._bytes.set(e, t);
    this._maxPos = Math.max(this._maxPos, t + e.byteLength);
    this._dispatchWrite(t, t + e.byteLength);
  }
  async _flush() {}
  async _finalize() {
    this.buffer = this._buffer.slice(0, this._maxPos);
    if (this._options.onFinalize) {
      await this._options.onFinalize(this.buffer);
    }
    this._emit(`finalized`);
  }
  async _close() {}
  _getSlice(e, t) {
    return this._bytes.slice(e, t);
  }
};
var Bd = 16777216;
var Vd = 2;
var Hd = class extends Id {
  constructor(e, t = {}) {
    super();
    this._sections = [];
    this._lastWriteEnd = 0;
    this._lastFlushEnd = 0;
    this._streamWriter = null;
    this._writeError = null;
    this._chunks = [];
    if (!(e instanceof WritableStream)) {
      throw TypeError(`StreamTarget requires a WritableStream instance.`);
    }
    if (t != null && typeof t != `object`) {
      throw TypeError(`StreamTarget options, when provided, must be an object.`);
    }
    if (t.chunked !== undefined && typeof t.chunked != `boolean`) {
      throw TypeError(`options.chunked, when provided, must be a boolean.`);
    }
    if (t.chunkSize !== undefined && (!Number.isInteger(t.chunkSize) || t.chunkSize < 1024)) {
      throw TypeError(`options.chunkSize, when provided, must be an integer and not smaller than 1024.`);
    }
    this._writable = e;
    this._options = t;
    this._chunked = t.chunked ?? false;
    this._chunkSize = t.chunkSize ?? Bd;
  }
  _start() {
    this._streamWriter = this._writable.getWriter();
  }
  _write(e, t) {
    if (t > this._lastWriteEnd) {
      let e = t - this._lastWriteEnd;
      this._write(new Uint8Array(e), this._lastWriteEnd);
    }
    this._sections.push({
      data: e.slice(),
      start: t
    });
    this._lastWriteEnd = Math.max(this._lastWriteEnd, t + e.byteLength);
    this._dispatchWrite(t, t + e.byteLength);
  }
  async _flush() {
    if (this._writeError !== null) {
      throw this._writeError;
    }
    n(this._streamWriter);
    if (this._sections.length === 0) {
      return;
    }
    let e = [];
    let t = [...this._sections].sort((e, t) => {
      return e.start - t.start;
    });
    e.push({
      start: t[0].start,
      size: t[0].data.byteLength
    });
    for (let n = 1; n < t.length; n++) {
      let r = e[e.length - 1];
      let i = t[n];
      if (i.start <= r.start + r.size) {
        r.size = Math.max(r.size, i.start + i.data.byteLength - r.start);
      } else {
        e.push({
          start: i.start,
          size: i.data.byteLength
        });
      }
    }
    for (let t of e) {
      t.data = new Uint8Array(t.size);
      for (let e of this._sections) {
        if (t.start <= e.start && e.start < t.start + t.size) {
          t.data.set(e.data, e.start - t.start);
        }
      }
      if (this._streamWriter.desiredSize !== null && this._streamWriter.desiredSize <= 0) {
        await this._streamWriter.ready;
      }
      if (this._chunked) {
        this._writeDataIntoChunks(t.data, t.start);
        this._tryToFlushChunks();
      } else {
        if (this._monotonicity === true && t.start !== this._lastFlushEnd) {
          throw Error(`Internal error: Monotonicity violation.`);
        }
        this._streamWriter.write({
          type: `write`,
          data: t.data,
          position: t.start
        }).catch(e => {
          this._writeError ??= e;
        });
        this._lastFlushEnd = t.start + t.data.byteLength;
      }
    }
    this._sections.length = 0;
  }
  _writeDataIntoChunks(e, t) {
    let n = this._chunks.findIndex(e => {
      return e.start <= t && t < e.start + this._chunkSize;
    });
    if (n === -1) {
      n = this._createChunk(t);
    }
    let r = this._chunks[n];
    let i = t - r.start;
    let a = e.subarray(0, Math.min(this._chunkSize - i, e.byteLength));
    r.data.set(a, i);
    let o = {
      start: i,
      end: i + a.byteLength
    };
    this._insertSectionIntoChunk(r, o);
    if (r.written[0].start === 0 && r.written[0].end === this._chunkSize) {
      r.shouldFlush = true;
    }
    if (this._chunks.length > Vd) {
      for (let e = 0; e < this._chunks.length - 1; e++) {
        this._chunks[e].shouldFlush = true;
      }
      this._tryToFlushChunks();
    }
    if (a.byteLength < e.byteLength) {
      this._writeDataIntoChunks(e.subarray(a.byteLength), t + a.byteLength);
    }
  }
  _insertSectionIntoChunk(e, t) {
    let n = 0;
    let r = e.written.length - 1;
    let i = -1;
    while (n <= r) {
      let a = Math.floor(n + (r - n + 1) / 2);
      if (e.written[a].start <= t.start) {
        n = a + 1;
        i = a;
      } else {
        r = a - 1;
      }
    }
    e.written.splice(i + 1, 0, t);
    if (i === -1 || e.written[i].end < t.start) {
      i++;
    }
    while (i < e.written.length - 1 && e.written[i].end >= e.written[i + 1].start) {
      e.written[i].end = Math.max(e.written[i].end, e.written[i + 1].end);
      e.written.splice(i + 1, 1);
    }
  }
  _createChunk(e) {
    let t = {
      start: Math.floor(e / this._chunkSize) * this._chunkSize,
      data: new Uint8Array(this._chunkSize),
      written: [],
      shouldFlush: false
    };
    this._chunks.push(t);
    this._chunks.sort((e, t) => {
      return e.start - t.start;
    });
    return this._chunks.indexOf(t);
  }
  _tryToFlushChunks(e = false) {
    n(this._streamWriter);
    for (let t = 0; t < this._chunks.length; t++) {
      let n = this._chunks[t];
      if (!!n.shouldFlush || !!e) {
        for (let e of n.written) {
          let t = n.start + e.start;
          if (this._monotonicity === true && t !== this._lastFlushEnd) {
            throw Error(`Internal error: Monotonicity violation.`);
          }
          this._streamWriter.write({
            type: `write`,
            data: n.data.subarray(e.start, e.end),
            position: t
          }).catch(e => {
            this._writeError ??= e;
          });
          this._lastFlushEnd = n.start + e.end;
        }
        this._chunks.splice(t--, 1);
      }
    }
  }
  async _finalize() {
    if (this._chunked) {
      this._tryToFlushChunks(true);
    }
    if (this._writeError !== null) {
      throw this._writeError;
    }
    n(this._streamWriter);
    await this._streamWriter.ready;
    await this._streamWriter.close();
    this._emit(`finalized`);
  }
  async _close() {
    return this._streamWriter?.close();
  }
};
var Ud = class extends Id {
  constructor(e) {
    super();
    this._writer = null;
    this._nextWritePos = 0;
    this._writable = e;
    this._streamTarget = new Hd(new WritableStream({
      start: () => {
        this._writer = this._writable.getWriter();
      },
      write: e => {
        if (this._monotonicity !== true) {
          throw Error(`AppendOnlyStreamTarget requires that data be written monotonically (always appended to the end). You must use a format that guarantees this behavior.`);
        }
        n(e.position === this._nextWritePos);
        this._nextWritePos += e.data.byteLength;
        n(this._writer);
        return this._writer.write(e.data);
      },
      close: () => {
        return this._writer?.close();
      }
    }));
  }
  _start() {
    this._streamTarget._start();
  }
  _write(e, t) {
    this._streamTarget._write(e, t);
  }
  _flush() {
    return this._streamTarget._flush();
  }
  _finalize() {
    return this._streamTarget._finalize();
  }
  _close() {
    return this._streamTarget._close();
  }
  _setMonotonicity(e) {
    super._setMonotonicity(e);
    this._streamTarget._setMonotonicity(e);
  }
};
var Wd = class extends Id {
  constructor(e, t = {}) {
    if (typeof e != `string`) {
      throw TypeError(`filePath must be a string.`);
    }
    if (!t || typeof t != `object`) {
      throw TypeError(`options must be an object.`);
    }
    if (!Fd.fs) {
      throw Error(`FilePathTarget is only available in server-side environments (Node.js, Bun, Deno).`);
    }
    super();
    this._fileHandle = null;
    let r = new WritableStream({
      start: async () => {
        this._fileHandle = await Fd.fs.open(e, `w`);
      },
      write: async e => {
        n(this._fileHandle);
        await this._fileHandle.write(e.data, 0, e.data.byteLength, e.position);
      },
      close: async () => {
        await this._fileHandle.close();
        this._fileHandle &&= null;
      }
    });
    this._streamTarget = new Hd(r, {
      chunked: true,
      ...t
    });
  }
  _start() {
    this._streamTarget._start();
  }
  _write(e, t) {
    this._streamTarget._write(e, t);
    this._dispatchWrite(t, t + e.byteLength);
  }
  async _flush() {
    return this._streamTarget._flush();
  }
  async _finalize() {
    await this._streamTarget._finalize();
    this._emit(`finalized`);
  }
  async _close() {
    return this._streamTarget._close();
  }
  _setMonotonicity(e) {
    super._setMonotonicity(e);
    this._streamTarget._setMonotonicity(e);
  }
};
var Gd = class extends Id {
  _start() {}
  _write(e, t) {
    this._dispatchWrite(t, t + e.byteLength);
  }
  async _flush() {}
  async _finalize() {
    this._emit(`finalized`);
  }
  async _close() {}
};
var Kd = class extends Id {
  constructor(e, t) {
    super();
    this._baseTarget = e;
    this._offset = t;
  }
  _start() {}
  _write(e, t) {
    this._baseTarget._write(e, this._offset + t);
    this._dispatchWrite(t, t + e.byteLength);
  }
  _flush() {
    return this._baseTarget._flush();
  }
  async _finalize() {
    this._emit(`finalized`);
  }
  async _close() {}
  _setMonotonicity(e) {
    super._setMonotonicity(e);
    this._baseTarget._setMonotonicity(e);
  }
};
var qd = class {
  constructor(e, t) {
    this.rootPath = e;
    this.getTarget = t;
    if (typeof e != `string`) {
      throw TypeError(`rootPath must be a string.`);
    }
    if (typeof t != `function`) {
      throw TypeError(`getTarget must be a function.`);
    }
  }
};
var Jd = 57600;
var Yd = 2082844800;
var Xd = e => {
  let t = {};
  let n = e.track;
  if (n.metadata.name !== undefined) {
    t.name = n.metadata.name;
  }
  return t;
};
var $ = (e, t, n = true) => {
  let r = e * t;
  if (n) {
    return Math.round(r);
  } else {
    return r;
  }
};
var Zd = class extends Il {
  constructor(e, t) {
    super(e);
    this.writer = null;
    this.boxWriter = null;
    this.initWriter = null;
    this.initBoxWriter = null;
    this.auxTarget = new zd();
    this.auxWriter = new Pd(this.auxTarget, false);
    this.auxBoxWriter = new Yl(this.auxWriter);
    this.mdat = null;
    this.ftypSize = null;
    this.trackDatas = [];
    this.allTracksKnown = E();
    this.creationTime = Math.floor(Date.now() / 1000) + Yd;
    this.finalizedChunks = [];
    this.nextFragmentNumber = 1;
    this.maxWrittenTimestamp = -Infinity;
    this.minWrittenTimestamp = Infinity;
    this.maxWrittenEndTimestamp = -Infinity;
    this.segmentHeaderSize = null;
    this.format = t;
    this.isQuickTime = t instanceof sp;
    this.isCmaf = t instanceof op;
    this.minimumFragmentDuration = t._options.minimumFragmentDuration ?? (t instanceof op ? Infinity : 1);
  }
  async start() {
    let e = await this.mutex.acquire();
    if (this.isCmaf) {
      this.fastStart = `fragmented`;
      this.isFragmented = true;
    } else {
      this.writer = await this.output._getRootWriter(e => {
        if (this.format._options.fastStart === undefined) {
          return e instanceof zd;
        } else {
          return this.format._options.fastStart === `fragmented`;
        }
      });
      this.boxWriter = new Yl(this.writer);
      this.fastStart = this.format._options.fastStart ?? (this.writer.target instanceof zd ? `in-memory` : false);
      this.isFragmented = this.fastStart === `fragmented`;
    }
    if (this.isCmaf) {
      if (!this.output._hasInitTarget()) {
        throw Error(`CMAF outputs require the initTarget field in OutputOptions to be set; the init segment will be written to it.`);
      }
      let e = new Pd(await this.output._getInitTarget(), true);
      e.start();
      this.initWriter = e;
      this.initBoxWriter = new Yl(e);
    }
    let t = this.output._tracks.some(e => {
      return e.isVideoTrack() && e.source._codec === `avc`;
    });
    {
      let e = this.initBoxWriter ?? this.boxWriter;
      n(e);
      if (this.format._options.onFtyp) {
        e.writer.startTrackingWrites();
      }
      e.writeBox(lu({
        isQuickTime: this.isQuickTime,
        holdsAvc: t,
        fragmented: this.isFragmented,
        cmaf: this.isCmaf
      }));
      if (this.format._options.onFtyp) {
        let {
          data: t,
          start: n
        } = e.writer.stopTrackingWrites();
        this.format._options.onFtyp(t, n);
      }
      this.ftypSize = e.writer.getPos();
      if (this.isCmaf) {
        await this.initWriter.flush();
      }
    }
    if (this.fastStart !== `in-memory`) {
      if (this.fastStart === `reserve`) {
        for (let e of this.output._tracks) {
          if (e.metadata.maximumPacketCount === undefined) {
            throw Error(`All tracks must specify maximumPacketCount in their metadata when using fastStart: 'reserve'.`);
          }
        }
      } else if (!this.isFragmented) {
        n(this.writer);
        n(this.boxWriter);
        if (this.format._options.onMdat) {
          this.writer.startTrackingWrites();
        }
        this.mdat = fu(true);
        this.boxWriter.writeBox(this.mdat);
      }
    }
    await this.writer?.flush();
    e();
  }
  allTracksAreKnown() {
    for (let e of this.output._tracks) {
      if (!e.source._closed && !this.trackDatas.some(t => {
        return t.track === e;
      })) {
        return false;
      }
    }
    return true;
  }
  async getMimeType() {
    await this.allTracksKnown.promise;
    let e = this.trackDatas.map(e => {
      if (e.type === `video` || e.type === `audio`) {
        return e.info.decoderConfig.codec;
      } else {
        return {
          webvtt: `wvtt`
        }[e.track.source._codec];
      }
    });
    return br({
      isQuickTime: this.isQuickTime,
      hasVideo: this.trackDatas.some(e => {
        return e.type === `video`;
      }),
      hasAudio: this.trackDatas.some(e => {
        return e.type === `audio`;
      }),
      codecStrings: e
    });
  }
  getVideoTrackData(e, t, r) {
    let i = this.trackDatas.find(t => {
      return t.track === e;
    });
    if (i) {
      return i;
    }
    tn(r);
    n(r);
    n(r.decoderConfig);
    let a = {
      ...r.decoderConfig
    };
    n(a.codedWidth !== undefined);
    n(a.codedHeight !== undefined);
    let o = false;
    if (e.source._codec === `avc` && !a.description) {
      let e = On(t.data);
      if (!e) {
        throw Error(`Couldn't extract an AVCDecoderConfigurationRecord from the AVC packet. Make sure the packets are in Annex B format (as specified in ITU-T-REC-H.264) when not providing a description, or provide a description (must be an AVCDecoderConfigurationRecord as specified in ISO 14496-15) and ensure the packets are in AVCC format.`);
      }
      a.description = kn(e);
      o = true;
    } else if (e.source._codec === `hevc` && !a.description) {
      let e = Rn(t.data);
      if (!e) {
        throw Error(`Couldn't extract an HEVCDecoderConfigurationRecord from the HEVC packet. Make sure the packets are in Annex B format (as specified in ITU-T-REC-H.265) when not providing a description, or provide a description (must be an HEVCDecoderConfigurationRecord as specified in ISO 14496-15) and ensure the packets are in HEVC format.`);
      }
      a.description = Kn(e);
      o = true;
    }
    let s = Oe(1 / (e.metadata.frameRate ?? 57600), 1000000).den;
    let c = a.displayAspectWidth;
    let l = a.displayAspectHeight;
    let u = c === undefined || l === undefined ? {
      num: 1,
      den: 1
    } : Ze({
      num: c * a.codedHeight,
      den: l * a.codedWidth
    });
    let d = {
      muxer: this,
      track: e,
      type: `video`,
      info: {
        width: a.codedWidth,
        height: a.codedHeight,
        pixelAspectRatio: u,
        decoderConfig: a,
        requiresAnnexBTransformation: o
      },
      timescale: s,
      samples: [],
      sampleQueue: [],
      timestampProcessingQueue: [],
      timeToSampleTable: [],
      compositionTimeOffsetTable: [],
      lastTimescaleUnits: null,
      lastSample: null,
      startTimestampOffset: null,
      finalizedChunks: [],
      currentChunk: null,
      compactlyCodedChunkTable: [],
      closed: false
    };
    this.trackDatas.push(d);
    this.trackDatas.sort((e, t) => {
      return e.track.id - t.track.id;
    });
    if (this.allTracksAreKnown()) {
      this.allTracksKnown.resolve();
    }
    return d;
  }
  getAudioTrackData(e, t, r) {
    let i = this.trackDatas.find(t => {
      return t.track === e;
    });
    if (i) {
      return i;
    }
    rn(r);
    n(r);
    n(r.decoderConfig);
    let a = {
      ...r.decoderConfig
    };
    let o = false;
    if (e.source._codec === `aac` && !a.description) {
      let e = ia(fl.tempFromBytes(t.data));
      if (!e) {
        throw Error(`Couldn't parse ADTS header from the AAC packet. Make sure the packets are in ADTS format (as specified in ISO 13818-7) when not providing a description, or provide a description (must be an AudioSpecificConfig as specified in ISO 14496-3) and ensure the packets are raw AAC data.`);
      }
      let n = xt[e.samplingFrequencyIndex];
      let r = St[e.channelConfiguration];
      if (n === undefined || r === undefined) {
        throw Error(`Invalid ADTS frame header.`);
      }
      a.description = wt({
        objectType: e.objectType,
        sampleRate: n,
        numberOfChannels: r
      });
      o = true;
    }
    let s = {
      muxer: this,
      track: e,
      type: `audio`,
      info: {
        numberOfChannels: r.decoderConfig.numberOfChannels,
        sampleRate: r.decoderConfig.sampleRate,
        decoderConfig: a,
        requiresPcmTransformation: !this.isFragmented && M.includes(e.source._codec),
        expectedNextPcmPacketTimestamp: null,
        requiresAdtsStripping: o,
        firstPacket: t
      },
      timescale: a.sampleRate,
      samples: [],
      sampleQueue: [],
      timestampProcessingQueue: [],
      timeToSampleTable: [],
      compositionTimeOffsetTable: [],
      lastTimescaleUnits: null,
      lastSample: null,
      startTimestampOffset: null,
      finalizedChunks: [],
      currentChunk: null,
      compactlyCodedChunkTable: [],
      closed: false
    };
    this.trackDatas.push(s);
    this.trackDatas.sort((e, t) => {
      return e.track.id - t.track.id;
    });
    if (this.allTracksAreKnown()) {
      this.allTracksKnown.resolve();
    }
    return s;
  }
  getSubtitleTrackData(e, t) {
    let r = this.trackDatas.find(t => {
      return t.track === e;
    });
    if (r) {
      return r;
    }
    an(t);
    n(t);
    n(t.config);
    let i = {
      muxer: this,
      track: e,
      type: `subtitle`,
      info: {
        config: t.config
      },
      timescale: 1000,
      samples: [],
      sampleQueue: [],
      timestampProcessingQueue: [],
      timeToSampleTable: [],
      compositionTimeOffsetTable: [],
      lastTimescaleUnits: null,
      lastSample: null,
      startTimestampOffset: null,
      finalizedChunks: [],
      currentChunk: null,
      compactlyCodedChunkTable: [],
      closed: false,
      lastCueEndTimestamp: 0,
      cueQueue: [],
      nextSourceId: 0,
      cueToSourceId: new WeakMap()
    };
    this.trackDatas.push(i);
    this.trackDatas.sort((e, t) => {
      return e.track.id - t.track.id;
    });
    if (this.allTracksAreKnown()) {
      this.allTracksKnown.resolve();
    }
    return i;
  }
  async addEncodedVideoPacket(e, t, n) {
    let r = await this.mutex.acquire();
    try {
      let r = this.getVideoTrackData(e, t, n);
      let i = t.data;
      if (r.info.requiresAnnexBTransformation) {
        let e = [...yn(i)].map(e => {
          return i.subarray(e.offset, e.offset + e.length);
        });
        if (e.length === 0) {
          throw Error(`Failed to transform packet data. Make sure all packets are provided in Annex B format, as specified in ITU-T-REC-H.264 and ITU-T-REC-H.265.`);
        }
        i = En(e, 4);
      }
      this.validateTimestamp(r.track, t.timestamp, t.type === `key`);
      let a = this.createSampleForTrack(r, i, t.timestamp, t.duration, t.type);
      await this.registerSample(r, a);
    } finally {
      r();
    }
  }
  async addEncodedAudioPacket(e, t, n) {
    let r = await this.mutex.acquire();
    try {
      let r = this.getAudioTrackData(e, t, n);
      let i = t.data;
      if (r.info.requiresAdtsStripping) {
        let e = ia(fl.tempFromBytes(i));
        if (!e) {
          throw Error(`Expected ADTS frame, didn't get one.`);
        }
        let t = e.crcCheck === null ? 7 : 9;
        i = i.subarray(t);
      }
      this.validateTimestamp(r.track, t.timestamp, t.type === `key`);
      let a = t.timestamp;
      let o = t.duration;
      if (r.info.requiresPcmTransformation) {
        let e = Kt(r.info.decoderConfig.codec).sampleSize * r.info.numberOfChannels;
        o = i.byteLength / e / r.info.sampleRate;
        if (r.info.expectedNextPcmPacketTimestamp !== null) {
          let e = a - r.info.expectedNextPcmPacketTimestamp;
          if (e < 0.01) {
            a = r.info.expectedNextPcmPacketTimestamp;
          } else {
            let t = await this.padWithSilence(r, r.info.expectedNextPcmPacketTimestamp, e);
            a = r.info.expectedNextPcmPacketTimestamp + t;
          }
        }
        r.info.expectedNextPcmPacketTimestamp = a + o;
      }
      let s = this.createSampleForTrack(r, i, a, o, t.type);
      await this.registerSample(r, s);
    } finally {
      r();
    }
  }
  async padWithSilence(e, t, n) {
    let r = $(n, e.timescale);
    n = r / e.timescale;
    if (r > 0) {
      let {
        sampleSize: i,
        silentValue: a
      } = Kt(e.info.decoderConfig.codec);
      let o = r * e.info.numberOfChannels;
      let s = new Uint8Array(i * o).fill(a);
      let c = this.createSampleForTrack(e, new Uint8Array(s.buffer), t, n, `key`);
      await this.registerSample(e, c);
    }
    return n;
  }
  async addSubtitleCue(e, t, n) {
    let r = await this.mutex.acquire();
    try {
      let r = this.getSubtitleTrackData(e, n);
      this.validateTimestamp(r.track, t.timestamp, true);
      if (e.source._codec === `webvtt`) {
        r.cueQueue.push(t);
        await this.processWebVTTCues(r, t.timestamp);
      }
    } finally {
      r();
    }
  }
  async processWebVTTCues(e, t) {
    while (e.cueQueue.length > 0) {
      let r = new Set([]);
      for (let i of e.cueQueue) {
        n(i.timestamp <= t);
        n(e.lastCueEndTimestamp <= i.timestamp + i.duration);
        r.add(Math.max(i.timestamp, e.lastCueEndTimestamp));
        r.add(i.timestamp + i.duration);
      }
      let i = [...r].sort((e, t) => {
        return e - t;
      });
      let a = i[0];
      let o = i[1] ?? a;
      if (t < o) {
        break;
      }
      if (e.lastCueEndTimestamp < a) {
        this.auxWriter.seek(0);
        let t = gd();
        this.auxBoxWriter.writeBox(t);
        let n = this.auxTarget._getSlice(0, this.auxWriter.getPos());
        let r = this.createSampleForTrack(e, n, e.lastCueEndTimestamp, a - e.lastCueEndTimestamp, `key`);
        await this.registerSample(e, r);
        e.lastCueEndTimestamp = a;
      }
      this.auxWriter.seek(0);
      for (let t = 0; t < e.cueQueue.length; t++) {
        let n = e.cueQueue[t];
        if (n.timestamp >= o) {
          break;
        }
        Wl.lastIndex = 0;
        let r = Wl.test(n.text);
        let i = n.timestamp + n.duration;
        let s = e.cueToSourceId.get(n);
        if (s === undefined && o < i) {
          s = e.nextSourceId++;
          e.cueToSourceId.set(n, s);
        }
        if (n.notes) {
          let e = vd(n.notes);
          this.auxBoxWriter.writeBox(e);
        }
        let c = _d(n.text, r ? a : null, n.identifier ?? null, n.settings ?? null, s ?? null);
        this.auxBoxWriter.writeBox(c);
        if (i === o) {
          e.cueQueue.splice(t--, 1);
        }
      }
      let s = this.auxTarget._getSlice(0, this.auxWriter.getPos());
      let c = this.createSampleForTrack(e, s, a, o - a, `key`);
      await this.registerSample(e, c);
      e.lastCueEndTimestamp = o;
    }
  }
  createSampleForTrack(e, t, n, r, i) {
    return {
      timestamp: n,
      decodeTimestamp: n,
      duration: r,
      data: t,
      size: t.byteLength,
      type: i,
      timescaleUnitsToNextSample: $(r, e.timescale)
    };
  }
  processTimestamps(e, t) {
    if (e.timestampProcessingQueue.length === 0) {
      return;
    }
    if (e.type === `audio` && e.info.requiresPcmTransformation) {
      if (!this.isFragmented) {
        e.startTimestampOffset ??= e.timestampProcessingQueue[0].timestamp;
      }
      let t = 0;
      for (let n = 0; n < e.timestampProcessingQueue.length; n++) {
        let r = e.timestampProcessingQueue[n];
        let i = $(r.duration, e.timescale);
        t += i;
      }
      if (e.timeToSampleTable.length === 0) {
        e.timeToSampleTable.push({
          sampleCount: t,
          sampleDelta: 1
        });
      } else {
        let n = i(e.timeToSampleTable);
        n.sampleCount += t;
      }
      e.timestampProcessingQueue.length = 0;
      return;
    }
    let r = e.timestampProcessingQueue.map(e => {
      return e.timestamp;
    }).sort((e, t) => {
      return e - t;
    });
    if (!this.isFragmented) {
      e.startTimestampOffset ??= r[0];
    }
    for (let t = 0; t < e.timestampProcessingQueue.length; t++) {
      let a = e.timestampProcessingQueue[t];
      a.decodeTimestamp = r[t];
      let o = $(a.timestamp - a.decodeTimestamp, e.timescale);
      let s = $(a.duration, e.timescale);
      if (e.lastTimescaleUnits !== null) {
        n(e.lastSample);
        let t = $(a.decodeTimestamp, e.timescale, false);
        let r = Math.round(t - e.lastTimescaleUnits);
        n(r >= 0);
        e.lastTimescaleUnits += r;
        e.lastSample.timescaleUnitsToNextSample = r;
        if (!this.isFragmented) {
          let t = i(e.timeToSampleTable);
          n(t);
          if (t.sampleCount === 1) {
            t.sampleDelta = r;
            let n = e.timeToSampleTable[e.timeToSampleTable.length - 2];
            if (n && n.sampleDelta === r) {
              n.sampleCount++;
              e.timeToSampleTable.pop();
              t = n;
            }
          } else if (t.sampleDelta !== r) {
            t.sampleCount--;
            e.timeToSampleTable.push(t = {
              sampleCount: 1,
              sampleDelta: r
            });
          }
          if (t.sampleDelta === s) {
            t.sampleCount++;
          } else {
            e.timeToSampleTable.push({
              sampleCount: 1,
              sampleDelta: s
            });
          }
          let a = i(e.compositionTimeOffsetTable);
          n(a);
          if (a.sampleCompositionTimeOffset === o) {
            a.sampleCount++;
          } else {
            e.compositionTimeOffsetTable.push({
              sampleCount: 1,
              sampleCompositionTimeOffset: o
            });
          }
        }
      } else {
        e.lastTimescaleUnits = $(a.decodeTimestamp, e.timescale, false);
        if (!this.isFragmented) {
          e.timeToSampleTable.push({
            sampleCount: 1,
            sampleDelta: s
          });
          e.compositionTimeOffsetTable.push({
            sampleCount: 1,
            sampleCompositionTimeOffset: o
          });
        }
      }
      e.lastSample = a;
    }
    e.timestampProcessingQueue.length = 0;
    n(e.lastSample);
    n(e.lastTimescaleUnits !== null);
    if (t !== undefined && e.lastSample.timescaleUnitsToNextSample === 0) {
      n(t.type === `key`);
      let r = $(t.timestamp, e.timescale, false);
      let i = Math.round(r - e.lastTimescaleUnits);
      e.lastSample.timescaleUnitsToNextSample = i;
    }
  }
  async registerSample(e, t) {
    if (t.type === `key`) {
      this.processTimestamps(e, t);
    }
    e.timestampProcessingQueue.push(t);
    if (this.isFragmented) {
      e.sampleQueue.push(t);
      await this.interleaveSamples();
    } else if (this.fastStart === `reserve`) {
      await this.registerSampleFastStartReserve(e, t);
    } else {
      await this.addSampleToTrack(e, t);
    }
  }
  async addSampleToTrack(e, t) {
    e.samples.push(t);
    if (!this.isFragmented && this.fastStart === `reserve`) {
      let t = e.track.metadata.maximumPacketCount;
      n(t !== undefined);
      if (e.samples.length > t) {
        throw Error(`Track #${e.track.id} has already reached the maximum packet count (${t}). Either add less packets or increase the maximum packet count.`);
      }
    }
    let r = false;
    if (!e.currentChunk) {
      r = true;
    } else {
      e.currentChunk.startTimestamp = Math.min(e.currentChunk.startTimestamp, t.timestamp);
      let n = t.timestamp - e.currentChunk.startTimestamp;
      if (this.isFragmented) {
        let i = this.trackDatas.every(n => {
          if (e === n) {
            return t.type === `key`;
          }
          let r = n.sampleQueue[0];
          if (r) {
            return r.type === `key`;
          } else {
            return n.closed;
          }
        });
        if (n >= this.minimumFragmentDuration && i && t.timestamp > this.maxWrittenTimestamp) {
          r = true;
          await this.finalizeFragment();
        }
      } else {
        r = n >= 0.5;
      }
    }
    if (r) {
      if (e.currentChunk) {
        await this.finalizeCurrentChunk(e);
      }
      e.currentChunk = {
        startTimestamp: t.timestamp,
        samples: [],
        offset: null,
        moofOffset: null
      };
    }
    n(e.currentChunk);
    e.currentChunk.samples.push(t);
    if (this.isFragmented) {
      this.maxWrittenTimestamp = Math.max(this.maxWrittenTimestamp, t.timestamp);
      this.maxWrittenEndTimestamp = Math.max(this.maxWrittenEndTimestamp, t.timestamp + t.duration);
      this.minWrittenTimestamp = Math.min(this.minWrittenTimestamp, t.timestamp);
    }
  }
  async finalizeCurrentChunk(e) {
    n(!this.isFragmented);
    n(this.writer);
    if (!e.currentChunk) {
      return;
    }
    e.finalizedChunks.push(e.currentChunk);
    this.finalizedChunks.push(e.currentChunk);
    let t = e.currentChunk.samples.length;
    if (e.type === `audio` && e.info.requiresPcmTransformation) {
      t = e.currentChunk.samples.reduce((t, n) => {
        return t + $(n.duration, e.timescale);
      }, 0);
    }
    if (e.compactlyCodedChunkTable.length === 0 || i(e.compactlyCodedChunkTable).samplesPerChunk !== t) {
      e.compactlyCodedChunkTable.push({
        firstChunk: e.finalizedChunks.length,
        samplesPerChunk: t
      });
    }
    if (this.fastStart === `in-memory`) {
      e.currentChunk.offset = 0;
      return;
    }
    e.currentChunk.offset = this.writer.getPos();
    for (let t of e.currentChunk.samples) {
      n(t.data);
      this.writer.write(t.data);
      t.data = null;
    }
    await this.writer.flush();
  }
  async interleaveSamples(e = false) {
    n(this.isFragmented);
    if (!!e || !!this.allTracksAreKnown()) {
      outer: while (true) {
        let t = null;
        let n = Infinity;
        for (let r of this.trackDatas) {
          if (!e && r.sampleQueue.length === 0 && !r.closed) {
            break outer;
          }
          if (r.sampleQueue.length > 0 && r.sampleQueue[0].timestamp < n) {
            t = r;
            n = r.sampleQueue[0].timestamp;
          }
        }
        if (!t) {
          break;
        }
        let r = t.sampleQueue.shift();
        await this.addSampleToTrack(t, r);
      }
    }
  }
  async finalizeFragment(e = !this.isCmaf) {
    n(this.isFragmented);
    let t = this.nextFragmentNumber++;
    if (t === 1) {
      let e = this.initBoxWriter ?? this.boxWriter;
      n(e);
      if (this.format._options.onMoov) {
        e.writer.startTrackingWrites();
      }
      this.ensureOneEnabledTrack();
      let t = mu(this);
      e.writeBox(t);
      if (this.format._options.onMoov) {
        let {
          data: t,
          start: n
        } = e.writer.stopTrackingWrites();
        this.format._options.onMoov(t, n);
      }
      if (this.isCmaf) {
        n(this.initWriter);
        await this.initWriter.flush();
        await this.initWriter.finalize();
        this.writer = await this.output._getRootWriter(true);
        this.boxWriter = new Yl(this.writer);
        let e = this.boxWriter.measureBox(uu());
        let t = this.boxWriter.measureBox(du(this, 0));
        this.segmentHeaderSize = e + t;
        this.writer.seek(this.segmentHeaderSize);
      }
    }
    n(this.writer);
    n(this.boxWriter);
    let r = this.trackDatas.filter(e => {
      return e.currentChunk;
    });
    let i = od(t, r);
    let a = this.writer.getPos();
    let o = a + this.boxWriter.measureBox(i);
    let s = o + 8;
    let c = Infinity;
    for (let e of r) {
      e.currentChunk.offset = s;
      e.currentChunk.moofOffset = a;
      for (let t of e.currentChunk.samples) {
        s += t.size;
      }
      c = Math.min(c, e.currentChunk.startTimestamp);
    }
    let l = s - o;
    let u = l >= 4294967296;
    if (u) {
      for (let e of r) {
        e.currentChunk.offset += 8;
      }
    }
    if (this.format._options.onMoof) {
      this.writer.startTrackingWrites();
    }
    let d = od(t, r);
    this.boxWriter.writeBox(d);
    if (this.format._options.onMoof) {
      let {
        data: e,
        start: t
      } = this.writer.stopTrackingWrites();
      this.format._options.onMoof(e, t, c);
    }
    n(this.writer.getPos() === o);
    if (this.format._options.onMdat) {
      this.writer.startTrackingWrites();
    }
    let f = fu(u);
    f.size = l;
    this.boxWriter.writeBox(f);
    this.writer.seek(o + (u ? 16 : 8));
    for (let e of r) {
      for (let t of e.currentChunk.samples) {
        this.writer.write(t.data);
        t.data = null;
      }
    }
    if (this.format._options.onMdat) {
      let {
        data: e,
        start: t
      } = this.writer.stopTrackingWrites();
      this.format._options.onMdat(e, t);
    }
    for (let e of r) {
      e.finalizedChunks.push(e.currentChunk);
      this.finalizedChunks.push(e.currentChunk);
      e.currentChunk = null;
    }
    if (e) {
      await this.writer.flush();
    }
  }
  async registerSampleFastStartReserve(e, t) {
    n(this.writer);
    n(this.boxWriter);
    if (this.allTracksAreKnown()) {
      if (!this.mdat) {
        this.ensureOneEnabledTrack();
        let e = mu(this);
        let t = this.boxWriter.measureBox(e) + this.computeSampleTableSizeUpperBound() + 4096;
        n(this.ftypSize !== null);
        this.writer.seek(this.ftypSize + t);
        if (this.format._options.onMdat) {
          this.writer.startTrackingWrites();
        }
        this.mdat = fu(true);
        this.boxWriter.writeBox(this.mdat);
        for (let e of this.trackDatas) {
          for (let t of e.sampleQueue) {
            await this.addSampleToTrack(e, t);
          }
          e.sampleQueue.length = 0;
        }
      }
      await this.addSampleToTrack(e, t);
    } else {
      e.sampleQueue.push(t);
    }
  }
  computeSampleTableSizeUpperBound() {
    n(this.fastStart === `reserve`);
    let e = 0;
    for (let t of this.trackDatas) {
      let r = t.track.metadata.maximumPacketCount;
      n(r !== undefined);
      e += Math.ceil(2 / 3 * r) * 8;
      e += r * 4;
      e += Math.ceil(2 / 3 * r) * 8;
      e += Math.ceil(2 / 3 * r) * 12;
      e += r * 4;
      e += r * 8;
    }
    return e;
  }
  async onTrackClose(e) {
    let t = await this.mutex.acquire();
    let n = this.trackDatas.find(t => {
      return t.track === e;
    });
    if (n) {
      n.closed = true;
      if (n.type === `subtitle` && e.source._codec === `webvtt`) {
        await this.processWebVTTCues(n, Infinity);
      }
      this.processTimestamps(n);
    }
    if (this.allTracksAreKnown()) {
      this.allTracksKnown.resolve();
    }
    if (this.isFragmented) {
      await this.interleaveSamples();
    }
    t();
  }
  ensureOneEnabledTrack() {
    for (let e of [`video`, `audio`, `subtitle`]) {
      let t = this.trackDatas.filter(t => {
        return t.type === e;
      });
      if (t.length !== 0 && !t.some(e => {
        return e.track.metadata.disposition?.default !== false;
      })) {
        let e = t[0];
        e.track.metadata.disposition = {
          ...e.track.metadata.disposition,
          default: true
        };
      }
    }
  }
  async finalize() {
    let e = await this.mutex.acquire();
    this.allTracksKnown.resolve();
    this.ensureOneEnabledTrack();
    for (let e of this.trackDatas) {
      e.closed = true;
      if (e.type === `subtitle` && e.track.source._codec === `webvtt`) {
        await this.processWebVTTCues(e, Infinity);
      }
      this.processTimestamps(e);
    }
    if (this.isFragmented) {
      await this.interleaveSamples(true);
      await this.finalizeFragment(false);
    } else {
      for (let e of this.trackDatas) {
        await this.finalizeCurrentChunk(e);
        n(e.startTimestampOffset !== null);
        for (let t = 0; t < e.samples.length; t++) {
          let n = e.samples[t];
          n.timestamp -= e.startTimestampOffset;
          n.decodeTimestamp -= e.startTimestampOffset;
        }
      }
    }
    n(this.writer);
    n(this.boxWriter);
    if (this.fastStart === `in-memory`) {
      this.mdat = fu(false);
      let e;
      for (let t = 0; t < 2; t++) {
        let t = mu(this);
        let r = this.boxWriter.measureBox(t);
        e = this.boxWriter.measureBox(this.mdat);
        let i = this.writer.getPos() + r + e;
        for (let t of this.finalizedChunks) {
          t.offset = i;
          for (let {
            data: r
          } of t.samples) {
            n(r);
            i += r.byteLength;
            e += r.byteLength;
          }
        }
        if (i < 4294967296) {
          break;
        }
        if (e >= 4294967296) {
          this.mdat.largeSize = true;
        }
      }
      if (this.format._options.onMoov) {
        this.writer.startTrackingWrites();
      }
      let t = mu(this);
      this.boxWriter.writeBox(t);
      if (this.format._options.onMoov) {
        let {
          data: e,
          start: t
        } = this.writer.stopTrackingWrites();
        this.format._options.onMoov(e, t);
      }
      if (this.format._options.onMdat) {
        this.writer.startTrackingWrites();
      }
      this.mdat.size = e;
      this.boxWriter.writeBox(this.mdat);
      for (let e of this.finalizedChunks) {
        for (let t of e.samples) {
          n(t.data);
          this.writer.write(t.data);
          t.data = null;
        }
      }
      if (this.format._options.onMdat) {
        let {
          data: e,
          start: t
        } = this.writer.stopTrackingWrites();
        this.format._options.onMdat(e, t);
      }
    } else if (this.isFragmented) {
      if (this.isCmaf) {
        let e = this.segmentHeaderSize === null ? 0 : this.writer.getPos() - this.segmentHeaderSize;
        this.writer.seek(0);
        this.boxWriter.writeBox(uu());
        this.boxWriter.writeBox(du(this, e));
      } else {
        let e = this.writer.getPos();
        let t = pd(this.trackDatas);
        this.boxWriter.writeBox(t);
        let n = this.writer.getPos() - e;
        this.writer.seek(this.writer.getPos() - 4);
        this.boxWriter.writeU32(n);
      }
    } else {
      n(this.mdat);
      let e = this.boxWriter.offsets.get(this.mdat);
      n(e !== undefined);
      let t = this.writer.getPos() - e;
      this.mdat.size = t;
      this.mdat.largeSize = t >= 4294967296;
      this.boxWriter.patchBox(this.mdat);
      if (this.format._options.onMdat) {
        let {
          data: e,
          start: t
        } = this.writer.stopTrackingWrites();
        this.format._options.onMdat(e, t);
      }
      let r = mu(this);
      if (this.fastStart === `reserve`) {
        n(this.ftypSize !== null);
        this.writer.seek(this.ftypSize);
        if (this.format._options.onMoov) {
          this.writer.startTrackingWrites();
        }
        this.boxWriter.writeBox(r);
        let e = this.boxWriter.offsets.get(this.mdat) - this.writer.getPos();
        this.boxWriter.writeBox(pu(e));
      } else {
        if (this.format._options.onMoov) {
          this.writer.startTrackingWrites();
        }
        this.boxWriter.writeBox(r);
      }
      if (this.format._options.onMoov) {
        let {
          data: e,
          start: t
        } = this.writer.stopTrackingWrites();
        this.format._options.onMoov(e, t);
      }
    }
    e();
  }
};
var Qd = -32768;
var $d = 32767;
var ef = `Mediabunny`;
var tf = 6;
var nf = 5;
var rf = {
  video: 1,
  audio: 2,
  subtitle: 17
};
var af = class extends Il {
  constructor(e, t) {
    super(e);
    this.trackDatas = [];
    this.allTracksKnown = E();
    this.segment = null;
    this.segmentInfo = null;
    this.seekHead = null;
    this.tracksElement = null;
    this.tagsElement = null;
    this.attachmentsElement = null;
    this.segmentDuration = null;
    this.cues = null;
    this.currentCluster = null;
    this.currentClusterStartMsTimestamp = null;
    this.currentClusterMaxMsTimestamp = null;
    this.trackDatasInCurrentCluster = new Map();
    this.startTimestamp = Infinity;
    this.endTimestamp = -Infinity;
    this.format = t;
  }
  async start() {
    let e = await this.mutex.acquire();
    this.writer = await this.output._getRootWriter(!!this.format._options.appendOnly);
    this.ebmlWriter = new mi(this.writer);
    this.writeEBMLHeader();
    this.createSegmentInfo();
    this.createCues();
    await this.writer.flush();
    e();
  }
  writeEBMLHeader() {
    if (this.format._options.onEbmlHeader) {
      this.writer.startTrackingWrites();
    }
    let e = {
      id: L.EBML,
      data: [{
        id: L.EBMLVersion,
        data: 1
      }, {
        id: L.EBMLReadVersion,
        data: 1
      }, {
        id: L.EBMLMaxIDLength,
        data: 4
      }, {
        id: L.EBMLMaxSizeLength,
        data: 8
      }, {
        id: L.DocType,
        data: this.format instanceof lp ? `webm` : `matroska`
      }, {
        id: L.DocTypeVersion,
        data: 2
      }, {
        id: L.DocTypeReadVersion,
        data: 2
      }]
    };
    this.ebmlWriter.writeEBML(e);
    if (this.format._options.onEbmlHeader) {
      let {
        data: e,
        start: t
      } = this.writer.stopTrackingWrites();
      this.format._options.onEbmlHeader(e, t);
    }
  }
  maybeCreateSeekHead(e) {
    if (this.format._options.appendOnly) {
      return;
    }
    let t = new Uint8Array([28, 83, 187, 107]);
    let n = new Uint8Array([21, 73, 169, 102]);
    let r = new Uint8Array([22, 84, 174, 107]);
    let i = new Uint8Array([25, 65, 164, 105]);
    let a = new Uint8Array([18, 84, 195, 103]);
    let o = {
      id: L.SeekHead,
      data: [{
        id: L.Seek,
        data: [{
          id: L.SeekID,
          data: t
        }, {
          id: L.SeekPosition,
          size: 5,
          data: e ? this.ebmlWriter.offsets.get(this.cues) - this.segmentDataOffset : 0
        }]
      }, {
        id: L.Seek,
        data: [{
          id: L.SeekID,
          data: n
        }, {
          id: L.SeekPosition,
          size: 5,
          data: e ? this.ebmlWriter.offsets.get(this.segmentInfo) - this.segmentDataOffset : 0
        }]
      }, {
        id: L.Seek,
        data: [{
          id: L.SeekID,
          data: r
        }, {
          id: L.SeekPosition,
          size: 5,
          data: e ? this.ebmlWriter.offsets.get(this.tracksElement) - this.segmentDataOffset : 0
        }]
      }, this.attachmentsElement ? {
        id: L.Seek,
        data: [{
          id: L.SeekID,
          data: i
        }, {
          id: L.SeekPosition,
          size: 5,
          data: e ? this.ebmlWriter.offsets.get(this.attachmentsElement) - this.segmentDataOffset : 0
        }]
      } : null, this.tagsElement ? {
        id: L.Seek,
        data: [{
          id: L.SeekID,
          data: a
        }, {
          id: L.SeekPosition,
          size: 5,
          data: e ? this.ebmlWriter.offsets.get(this.tagsElement) - this.segmentDataOffset : 0
        }]
      } : null]
    };
    this.seekHead = o;
  }
  createSegmentInfo() {
    let e = {
      id: L.Duration,
      data: new ii(0)
    };
    this.segmentDuration = e;
    let t = {
      id: L.Info,
      data: [{
        id: L.TimestampScale,
        data: 1000000
      }, {
        id: L.MuxingApp,
        data: ef
      }, {
        id: L.WritingApp,
        data: ef
      }, this.format._options.appendOnly ? null : e]
    };
    this.segmentInfo = t;
  }
  createTracks() {
    let e = {
      id: L.Tracks,
      data: []
    };
    this.tracksElement = e;
    for (let t of this.trackDatas) {
      let r = Ei[t.track.source._codec];
      n(r);
      let i = 0;
      if (t.type === `audio` && t.track.source._codec === `opus`) {
        i = 80000000;
        let e = t.info.decoderConfig.description;
        if (e) {
          let t = $n(l(e));
          i = Math.round(t.preSkip / Wt * 1000000000);
        }
      }
      e.data.push({
        id: L.TrackEntry,
        data: [{
          id: L.TrackNumber,
          data: t.track.id
        }, {
          id: L.TrackUID,
          data: t.track.id
        }, {
          id: L.TrackType,
          data: rf[t.type]
        }, t.track.metadata.disposition?.default === false ? {
          id: L.FlagDefault,
          data: 0
        } : null, t.track.metadata.disposition?.forced ? {
          id: L.FlagForced,
          data: 1
        } : null, t.track.metadata.disposition?.hearingImpaired ? {
          id: L.FlagHearingImpaired,
          data: 1
        } : null, t.track.metadata.disposition?.visuallyImpaired ? {
          id: L.FlagVisualImpaired,
          data: 1
        } : null, t.track.metadata.disposition?.original ? {
          id: L.FlagOriginal,
          data: 1
        } : null, t.track.metadata.disposition?.commentary ? {
          id: L.FlagCommentary,
          data: 1
        } : null, {
          id: L.FlagLacing,
          data: 0
        }, {
          id: L.Language,
          data: t.track.metadata.languageCode ?? `und`
        }, {
          id: L.CodecID,
          data: r
        }, t.codecPrivate ? {
          id: L.CodecPrivate,
          data: l(t.codecPrivate)
        } : null, {
          id: L.CodecDelay,
          data: 0
        }, {
          id: L.SeekPreRoll,
          data: i
        }, t.track.metadata.name === undefined ? null : {
          id: L.Name,
          data: new oi(t.track.metadata.name)
        }, t.type === `video` ? this.videoSpecificTrackInfo(t) : null, t.type === `audio` ? this.audioSpecificTrackInfo(t) : null, t.type === `subtitle` ? this.subtitleSpecificTrackInfo(t) : null]
      });
    }
  }
  videoSpecificTrackInfo(e) {
    let {
      frameRate: t,
      rotation: n
    } = e.track.metadata;
    let i = [t ? {
      id: L.DefaultDuration,
      data: 1000000000 / t
    } : null];
    let a = n ? r(-n) : 0;
    let o = !!e.info.aspectRatio && e.info.aspectRatio.num * e.info.height !== e.info.aspectRatio.den * e.info.width;
    let s = e.info.decoderConfig.colorSpace;
    let c = {
      id: L.Video,
      data: [{
        id: L.PixelWidth,
        data: e.info.width
      }, {
        id: L.PixelHeight,
        data: e.info.height
      }, o ? {
        id: L.DisplayWidth,
        data: e.info.aspectRatio.num
      } : null, o ? {
        id: L.DisplayHeight,
        data: e.info.aspectRatio.den
      } : null, o ? {
        id: L.DisplayUnit,
        data: 3
      } : null, e.info.alphaMode ? {
        id: L.AlphaMode,
        data: 1
      } : null, x(s) ? {
        id: L.Colour,
        data: [{
          id: L.MatrixCoefficients,
          data: y[s.matrix]
        }, {
          id: L.TransferCharacteristics,
          data: _[s.transfer]
        }, {
          id: L.Primaries,
          data: h[s.primaries]
        }, {
          id: L.Range,
          data: s.fullRange ? 2 : 1
        }]
      } : null, a ? {
        id: L.Projection,
        data: [{
          id: L.ProjectionType,
          data: 0
        }, {
          id: L.ProjectionPoseRoll,
          data: new ri((a + 180) % 360 - 180)
        }]
      } : null]
    };
    i.push(c);
    return i;
  }
  audioSpecificTrackInfo(e) {
    let t = M.includes(e.track.source._codec) ? Kt(e.track.source._codec) : null;
    return [{
      id: L.Audio,
      data: [{
        id: L.SamplingFrequency,
        data: new ri(e.info.sampleRate)
      }, {
        id: L.Channels,
        data: e.info.numberOfChannels
      }, t ? {
        id: L.BitDepth,
        data: t.sampleSize * 8
      } : null]
    }];
  }
  subtitleSpecificTrackInfo(e) {
    return [];
  }
  maybeCreateTags() {
    let e = [];
    let t = (t, n) => {
      e.push({
        id: L.SimpleTag,
        data: [{
          id: L.TagName,
          data: new oi(t)
        }, typeof n == `string` ? {
          id: L.TagString,
          data: new oi(n)
        } : {
          id: L.TagBinary,
          data: n
        }]
      });
    };
    let n = this.output._metadataTags;
    let r = new Set();
    for (let {
      key: e,
      value: i
    } of Be(n)) {
      switch (e) {
        case `title`:
          {
            t(`TITLE`, i);
            r.add(`TITLE`);
            break;
          }
        case `description`:
          {
            t(`DESCRIPTION`, i);
            r.add(`DESCRIPTION`);
            break;
          }
        case `artist`:
          {
            t(`ARTIST`, i);
            r.add(`ARTIST`);
            break;
          }
        case `album`:
          {
            t(`ALBUM`, i);
            r.add(`ALBUM`);
            break;
          }
        case `albumArtist`:
          {
            t(`ALBUM_ARTIST`, i);
            r.add(`ALBUM_ARTIST`);
            break;
          }
        case `genre`:
          {
            t(`GENRE`, i);
            r.add(`GENRE`);
            break;
          }
        case `comment`:
          {
            t(`COMMENT`, i);
            r.add(`COMMENT`);
            break;
          }
        case `lyrics`:
          {
            t(`LYRICS`, i);
            r.add(`LYRICS`);
            break;
          }
        case `date`:
          {
            t(`DATE`, i.toISOString().slice(0, 10));
            r.add(`DATE`);
            break;
          }
        case `trackNumber`:
          {
            t(`PART_NUMBER`, n.tracksTotal === undefined ? i.toString() : `${i}/${n.tracksTotal}`);
            r.add(`PART_NUMBER`);
            break;
          }
        case `discNumber`:
          {
            t(`DISC`, n.discsTotal === undefined ? i.toString() : `${i}/${n.discsTotal}`);
            r.add(`DISC`);
            break;
          }
        case `tracksTotal`:
        case `discsTotal`:
          {
            break;
          }
        case `images`:
        case `raw`:
          {
            break;
          }
        default:
          {
            D(e);
          }
      }
    }
    if (n.raw) {
      for (let e in n.raw) {
        let i = n.raw[e];
        if (i != null && !r.has(e)) {
          if (typeof i == `string` || i instanceof Uint8Array) {
            t(e, i);
          }
        }
      }
    }
    if (e.length !== 0) {
      this.tagsElement = {
        id: L.Tags,
        data: [{
          id: L.Tag,
          data: [{
            id: L.Targets,
            data: [{
              id: L.TargetTypeValue,
              data: 50
            }, {
              id: L.TargetType,
              data: `MOVIE`
            }]
          }, ...e]
        }]
      };
    }
  }
  maybeCreateAttachments() {
    let e = this.output._metadataTags;
    let t = [];
    let n = new Set();
    let r = e.images ?? [];
    for (let e of r) {
      let r = e.name;
      if (r === undefined) {
        r = (e.kind === `coverFront` ? `cover` : e.kind === `coverBack` ? `back` : `image`) + (Ve(e.mimeType) ?? ``);
      }
      let i;
      while (true) {
        i = 0n;
        for (let e = 0; e < 8; e++) {
          i <<= 8n;
          i |= BigInt(Math.floor(Math.random() * 256));
        }
        if (i !== 0n && !n.has(i)) {
          break;
        }
      }
      n.add(i);
      t.push({
        id: L.AttachedFile,
        data: [e.description === undefined ? null : {
          id: L.FileDescription,
          data: new oi(e.description)
        }, {
          id: L.FileName,
          data: new oi(r)
        }, {
          id: L.FileMediaType,
          data: e.mimeType
        }, {
          id: L.FileData,
          data: e.data
        }, {
          id: L.FileUID,
          data: i
        }]
      });
    }
    for (let [n, i] of Object.entries(e.raw ?? {})) {
      if (i instanceof gt && /^\d+$/.test(n)) {
        if (!r.find(e => {
          return e.mimeType === i.mimeType && We(e.data, i.data);
        })) {
          t.push({
            id: L.AttachedFile,
            data: [i.description === undefined ? null : {
              id: L.FileDescription,
              data: new oi(i.description)
            }, {
              id: L.FileName,
              data: new oi(i.name ?? ``)
            }, {
              id: L.FileMediaType,
              data: i.mimeType ?? ``
            }, {
              id: L.FileData,
              data: i.data
            }, {
              id: L.FileUID,
              data: BigInt(n)
            }]
          });
        }
      }
    }
    if (t.length !== 0) {
      this.attachmentsElement = {
        id: L.Attachments,
        data: t
      };
    }
  }
  createSegment() {
    this.createTracks();
    this.maybeCreateTags();
    this.maybeCreateAttachments();
    this.maybeCreateSeekHead(false);
    let e = {
      id: L.Segment,
      size: this.format._options.appendOnly ? -1 : tf,
      data: [this.seekHead, this.segmentInfo, this.tracksElement, this.attachmentsElement, this.tagsElement]
    };
    this.segment = e;
    if (this.format._options.onSegmentHeader) {
      this.writer.startTrackingWrites();
    }
    this.ebmlWriter.writeEBML(e);
    if (this.format._options.onSegmentHeader) {
      let {
        data: e,
        start: t
      } = this.writer.stopTrackingWrites();
      this.format._options.onSegmentHeader(e, t);
    }
  }
  createCues() {
    this.cues = {
      id: L.Cues,
      data: []
    };
  }
  get segmentDataOffset() {
    n(this.segment);
    return this.ebmlWriter.dataOffsets.get(this.segment);
  }
  allTracksAreKnown() {
    for (let e of this.output._tracks) {
      if (!e.source._closed && !this.trackDatas.some(t => {
        return t.track === e;
      })) {
        return false;
      }
    }
    return true;
  }
  async getMimeType() {
    await this.allTracksKnown.promise;
    let e = this.trackDatas.map(e => {
      if (e.type === `video` || e.type === `audio`) {
        return e.info.decoderConfig.codec;
      } else {
        return {
          webvtt: `wvtt`
        }[e.track.source._codec];
      }
    });
    return Oi({
      isWebM: this.format instanceof lp,
      hasVideo: this.trackDatas.some(e => {
        return e.type === `video`;
      }),
      hasAudio: this.trackDatas.some(e => {
        return e.type === `audio`;
      }),
      codecStrings: e
    });
  }
  getVideoTrackData(e, t, r) {
    let i = this.trackDatas.find(t => {
      return t.track === e;
    });
    if (i) {
      return i;
    }
    tn(r);
    n(r);
    n(r.decoderConfig);
    n(r.decoderConfig.codedWidth !== undefined);
    n(r.decoderConfig.codedHeight !== undefined);
    let a = r.decoderConfig.displayAspectWidth;
    let o = r.decoderConfig.displayAspectHeight;
    let s = a === undefined || o === undefined ? null : Ze({
      num: a,
      den: o
    });
    let c = {
      track: e,
      type: `video`,
      info: {
        width: r.decoderConfig.codedWidth,
        height: r.decoderConfig.codedHeight,
        aspectRatio: s,
        decoderConfig: r.decoderConfig,
        alphaMode: !!t.sideData.alpha
      },
      chunkQueue: [],
      lastWrittenMsTimestamp: null,
      codecPrivate: r.decoderConfig.description ?? null,
      closed: false
    };
    if (e.source._codec === `vp9`) {
      c.codecPrivate = new Uint8Array(Rt(c.info.decoderConfig.codec));
    } else if (e.source._codec === `av1`) {
      c.codecPrivate = new Uint8Array(zt(c.info.decoderConfig.codec));
    } else if (e.source._codec === `prores`) {
      c.codecPrivate = f.encode(r.decoderConfig.codec);
    }
    this.trackDatas.push(c);
    this.trackDatas.sort((e, t) => {
      return e.track.id - t.track.id;
    });
    if (this.allTracksAreKnown()) {
      this.allTracksKnown.resolve();
    }
    return c;
  }
  getAudioTrackData(e, t, r) {
    let i = this.trackDatas.find(t => {
      return t.track === e;
    });
    if (i) {
      return i;
    }
    rn(r);
    n(r);
    n(r.decoderConfig);
    let a = {
      ...r.decoderConfig
    };
    let o = false;
    if (e.source._codec === `aac` && !a.description) {
      let e = ia(fl.tempFromBytes(t.data));
      if (!e) {
        throw Error(`Couldn't parse ADTS header from the AAC packet. Make sure the packets are in ADTS format (as specified in ISO 13818-7) when not providing a description, or provide a description (must be an AudioSpecificConfig as specified in ISO 14496-3) and ensure the packets are raw AAC data.`);
      }
      let n = xt[e.samplingFrequencyIndex];
      let r = St[e.channelConfiguration];
      if (n === undefined || r === undefined) {
        throw Error(`Invalid ADTS frame header.`);
      }
      a.description = wt({
        objectType: e.objectType,
        sampleRate: n,
        numberOfChannels: r
      });
      o = true;
    }
    let s = {
      track: e,
      type: `audio`,
      info: {
        numberOfChannels: r.decoderConfig.numberOfChannels,
        sampleRate: r.decoderConfig.sampleRate,
        decoderConfig: a,
        requiresAdtsStripping: o
      },
      chunkQueue: [],
      lastWrittenMsTimestamp: null,
      codecPrivate: a.description ?? null,
      closed: false
    };
    this.trackDatas.push(s);
    this.trackDatas.sort((e, t) => {
      return e.track.id - t.track.id;
    });
    if (this.allTracksAreKnown()) {
      this.allTracksKnown.resolve();
    }
    return s;
  }
  getSubtitleTrackData(e, t) {
    let r = this.trackDatas.find(t => {
      return t.track === e;
    });
    if (r) {
      return r;
    }
    an(t);
    n(t);
    n(t.config);
    let i = {
      track: e,
      type: `subtitle`,
      info: {
        config: t.config
      },
      chunkQueue: [],
      lastWrittenMsTimestamp: null,
      codecPrivate: f.encode(t.config.description),
      closed: false
    };
    this.trackDatas.push(i);
    this.trackDatas.sort((e, t) => {
      return e.track.id - t.track.id;
    });
    if (this.allTracksAreKnown()) {
      this.allTracksKnown.resolve();
    }
    return i;
  }
  async addEncodedVideoPacket(e, t, n) {
    let r = await this.mutex.acquire();
    try {
      let r = this.getVideoTrackData(e, t, n);
      let i = t.data;
      if (e.source._codec === `prores`) {
        if (i.byteLength < 8) {
          throw Error(`ProRes packet too small, expected at least 8 bytes.`);
        }
        i = i.subarray(8);
      }
      let a = t.type === `key`;
      this.validateTimestamp(r.track, t.timestamp, a);
      let o = t.timestamp;
      let s = t.duration;
      if (e.metadata.frameRate !== undefined) {
        o = ve(o, e.metadata.frameRate);
        s = ve(s, e.metadata.frameRate);
      }
      let c = r.info.alphaMode ? t.sideData.alpha ?? null : null;
      let l = this.createInternalChunk(i, o, s, t.type, c);
      if (e.source._codec === `vp9`) {
        this.fixVP9ColorSpace(r, l);
      }
      r.chunkQueue.push(l);
      await this.interleaveChunks();
    } finally {
      r();
    }
  }
  async addEncodedAudioPacket(e, t, n) {
    let r = await this.mutex.acquire();
    try {
      let r = this.getAudioTrackData(e, t, n);
      let i = t.data;
      if (r.info.requiresAdtsStripping) {
        let e = ia(fl.tempFromBytes(i));
        if (!e) {
          throw Error(`Expected ADTS frame, didn't get one.`);
        }
        let t = e.crcCheck === null ? 7 : 9;
        i = i.subarray(t);
      }
      let a = t.type === `key`;
      this.validateTimestamp(r.track, t.timestamp, a);
      let o = this.createInternalChunk(i, t.timestamp, t.duration, t.type);
      r.chunkQueue.push(o);
      await this.interleaveChunks();
    } finally {
      r();
    }
  }
  async addSubtitleCue(e, t, n) {
    let r = await this.mutex.acquire();
    try {
      let r = this.getSubtitleTrackData(e, n);
      this.validateTimestamp(r.track, t.timestamp, true);
      let i = t.text;
      let a = Math.round(t.timestamp * 1000);
      Wl.lastIndex = 0;
      i = i.replace(Wl, e => {
        return `<${Jl(ql(e.slice(1, -1)) - a)}>`;
      });
      let o = f.encode(i);
      let s = `${t.settings ?? ``}\n${t.identifier ?? ``}\n${t.notes ?? ``}`;
      let c = this.createInternalChunk(o, t.timestamp, t.duration, `key`, s.trim() ? f.encode(s) : null);
      r.chunkQueue.push(c);
      await this.interleaveChunks();
    } finally {
      r();
    }
  }
  async interleaveChunks(e = false) {
    if (!!e || !!this.allTracksAreKnown()) {
      outer: while (true) {
        let t = null;
        let n = Infinity;
        for (let r of this.trackDatas) {
          if (!e && r.chunkQueue.length === 0 && !r.closed) {
            break outer;
          }
          if (r.chunkQueue.length > 0 && r.chunkQueue[0].timestamp < n) {
            t = r;
            n = r.chunkQueue[0].timestamp;
          }
        }
        if (!t) {
          break;
        }
        let r = t.chunkQueue.shift();
        this.writeBlock(t, r);
      }
      if (!e) {
        await this.writer.flush();
      }
    }
  }
  fixVP9ColorSpace(e, t) {
    if (t.type !== `key` || !e.info.decoderConfig.colorSpace || !e.info.decoderConfig.colorSpace.matrix) {
      return;
    }
    let n = new A(t.data);
    n.skipBits(2);
    let r = n.readBits(1);
    let i = (n.readBits(1) << 1) + r;
    if (i === 3) {
      n.skipBits(1);
    }
    n.skipBits(2);
    if (n.readBits(1) || n.readBits(1) !== 0 || n.readBits(24) !== 4817730) {
      return;
    }
    if (i >= 2) {
      n.skipBits(1);
    }
    let a = {
      rgb: 7,
      bt709: 2,
      bt470bg: 1,
      smpte170m: 3
    }[e.info.decoderConfig.colorSpace.matrix];
    c(t.data, n.pos, n.pos + 3, a);
  }
  createInternalChunk(e, t, n, r, i = null) {
    return {
      data: e,
      type: r,
      timestamp: t,
      duration: n,
      additions: i
    };
  }
  writeBlock(e, t) {
    if (!this.segment) {
      this.createSegment();
    }
    let r = Math.round(t.timestamp * 1000);
    let i = this.trackDatas.every(n => {
      if (e === n) {
        return t.type === `key`;
      }
      let r = n.chunkQueue[0];
      if (r) {
        return r.type === `key`;
      } else {
        return n.closed;
      }
    });
    let a = false;
    if (!this.currentCluster) {
      a = true;
    } else {
      n(this.currentClusterStartMsTimestamp !== null);
      n(this.currentClusterMaxMsTimestamp !== null);
      let e = r - this.currentClusterStartMsTimestamp;
      a = i && r > this.currentClusterMaxMsTimestamp && e >= (this.format._options.minimumClusterDuration ?? 1) * 1000 || e > $d;
    }
    if (a) {
      this.createNewCluster(r);
    }
    let o = r - this.currentClusterStartMsTimestamp;
    if (o < Qd) {
      return;
    }
    let s = new Uint8Array(4);
    let c = new DataView(s.buffer);
    c.setUint8(0, e.track.id | 128);
    c.setInt16(1, o, false);
    let l = Math.round(t.duration * 1000);
    if (t.additions) {
      let n = {
        id: L.BlockGroup,
        data: [{
          id: L.Block,
          data: [s, t.data]
        }, t.type === `delta` ? {
          id: L.ReferenceBlock,
          data: new ai(e.lastWrittenMsTimestamp - r)
        } : null, t.additions ? {
          id: L.BlockAdditions,
          data: [{
            id: L.BlockMore,
            data: [{
              id: L.BlockAddID,
              data: 1
            }, {
              id: L.BlockAdditional,
              data: t.additions
            }]
          }]
        } : null, l > 0 ? {
          id: L.BlockDuration,
          data: l
        } : null]
      };
      this.ebmlWriter.writeEBML(n);
    } else {
      c.setUint8(3, Number(t.type === `key`) << 7);
      let e = {
        id: L.SimpleBlock,
        data: [s, t.data]
      };
      this.ebmlWriter.writeEBML(e);
    }
    this.startTimestamp = Math.min(this.startTimestamp, r);
    this.endTimestamp = Math.max(this.endTimestamp, r + l);
    e.lastWrittenMsTimestamp = r;
    if (!this.trackDatasInCurrentCluster.has(e)) {
      this.trackDatasInCurrentCluster.set(e, {
        firstMsTimestamp: r
      });
    }
    this.currentClusterMaxMsTimestamp = Math.max(this.currentClusterMaxMsTimestamp, r);
  }
  createNewCluster(e) {
    if (this.currentCluster) {
      this.finalizeCurrentCluster();
    }
    if (this.format._options.onCluster) {
      this.writer.startTrackingWrites();
    }
    this.currentCluster = {
      id: L.Cluster,
      size: this.format._options.appendOnly ? -1 : nf,
      data: [{
        id: L.Timestamp,
        data: e
      }]
    };
    this.ebmlWriter.writeEBML(this.currentCluster);
    this.currentClusterStartMsTimestamp = e;
    this.currentClusterMaxMsTimestamp = e;
    this.trackDatasInCurrentCluster.clear();
  }
  finalizeCurrentCluster() {
    n(this.currentCluster);
    if (!this.format._options.appendOnly) {
      let e = this.writer.getPos() - this.ebmlWriter.dataOffsets.get(this.currentCluster);
      let t = this.writer.getPos();
      this.writer.seek(this.ebmlWriter.offsets.get(this.currentCluster) + 4);
      this.ebmlWriter.writeVarInt(e, nf);
      this.writer.seek(t);
    }
    if (this.format._options.onCluster) {
      n(this.currentClusterStartMsTimestamp !== null);
      let {
        data: e,
        start: t
      } = this.writer.stopTrackingWrites();
      this.format._options.onCluster(e, t, this.currentClusterStartMsTimestamp / 1000);
    }
    let e = this.ebmlWriter.offsets.get(this.currentCluster) - this.segmentDataOffset;
    let t = new Map();
    for (let [e, {
      firstMsTimestamp: n
    }] of this.trackDatasInCurrentCluster) {
      if (!t.has(n)) {
        t.set(n, []);
      }
      t.get(n).push(e);
    }
    let r = [...t.entries()].sort((e, t) => {
      return e[0] - t[0];
    });
    for (let [t, i] of r) {
      n(this.cues);
      this.cues.data.push({
        id: L.CuePoint,
        data: [{
          id: L.CueTime,
          data: t
        }, ...i.map(t => {
          return {
            id: L.CueTrackPositions,
            data: [{
              id: L.CueTrack,
              data: t.track.id
            }, {
              id: L.CueClusterPosition,
              data: e
            }]
          };
        })]
      });
    }
  }
  async onTrackClose(e) {
    let t = await this.mutex.acquire();
    let n = this.trackDatas.find(t => {
      return t.track === e;
    });
    if (n) {
      n.closed = true;
    }
    if (this.allTracksAreKnown()) {
      this.allTracksKnown.resolve();
    }
    await this.interleaveChunks();
    t();
  }
  async finalize() {
    let e = await this.mutex.acquire();
    this.allTracksKnown.resolve();
    for (let e of this.trackDatas) {
      e.closed = true;
    }
    if (!this.segment) {
      this.createSegment();
    }
    await this.interleaveChunks(true);
    if (this.currentCluster) {
      this.finalizeCurrentCluster();
    }
    n(this.cues);
    this.ebmlWriter.writeEBML(this.cues);
    if (!this.format._options.appendOnly) {
      let e = this.writer.getPos() - this.segmentDataOffset;
      this.writer.seek(this.ebmlWriter.offsets.get(this.segment) + 4);
      this.ebmlWriter.writeVarInt(e, tf);
      let t = this.startTimestamp === Infinity ? 0 : this.endTimestamp - this.startTimestamp;
      this.segmentDuration.data = new ii(t);
      this.writer.seek(this.ebmlWriter.offsets.get(this.segmentDuration));
      this.ebmlWriter.writeEBML(this.segmentDuration);
      n(this.seekHead);
      this.writer.seek(this.ebmlWriter.offsets.get(this.seekHead));
      this.maybeCreateSeekHead(true);
      this.ebmlWriter.writeEBML(this.seekHead);
    }
    e();
  }
};
var of = class {
  constructor(e) {
    this.writer = e;
    this.helper = new Uint8Array(8);
    this.helperView = new DataView(this.helper.buffer);
  }
  writeU32(e) {
    this.helperView.setUint32(0, e, false);
    this.writer.write(this.helper.subarray(0, 4));
  }
  writeXingFrame(e) {
    let t = this.writer.getPos();
    let n = e.mpegVersionId << 3 | 224 | e.layer << 1;
    let r;
    if (e.mpegVersionId & 2 && e.mpegVersionId & 1) {
      r = 0;
    } else {
      r = 1;
    }
    let i = -1;
    let a = r * 16 * 4 + e.layer * 16;
    for (let t = 0; t < 16; t++) {
      let n = sn[a + t];
      if (ln(r, e.layer, n * 1000, e.sampleRate, 0) >= 155) {
        i = t;
        break;
      }
    }
    if (i === -1) {
      throw Error(`No suitable bitrate found.`);
    }
    let o = i << 4 | e.frequencyIndex << 2 | 0;
    let s = e.channel << 6 | e.modeExtension << 4 | e.copyright << 3 | e.original << 2 | e.emphasis;
    this.helper[0] = 255;
    this.helper[1] = n;
    this.helper[2] = o;
    this.helper[3] = s;
    this.writer.write(this.helper.subarray(0, 4));
    let c = dn(e.mpegVersionId, e.channel);
    this.writer.seek(t + c);
    this.writeU32(cn);
    let l = 0;
    if (e.frameCount !== null) {
      l |= hn.FrameCount;
    }
    if (e.fileSize !== null) {
      l |= hn.FileSize;
    }
    if (e.toc !== null) {
      l |= hn.Toc;
    }
    this.writeU32(l);
    this.writeU32(e.frameCount ?? 0);
    this.writeU32(e.fileSize ?? 0);
    this.writer.write(e.toc ?? new Uint8Array(100));
    let u = sn[a + i];
    let d = ln(r, e.layer, u * 1000, e.sampleRate, 0);
    this.writer.seek(t + d);
  }
};
var sf = class extends Il {
  constructor(e, t) {
    super(e);
    this.xingFrameData = null;
    this.frameCount = 0;
    this.framePositions = [];
    this.xingFramePos = null;
    this.format = t;
  }
  async start() {
    let e = await this.mutex.acquire();
    this.writer = await this.output._getRootWriter(this.format._options.xingHeader === false);
    this.mp3Writer = new of(this.writer);
    if (!vt(this.output._metadataTags)) {
      new Fl(this.writer).writeId3V2Tag(this.output._metadataTags);
    }
    e();
  }
  async getMimeType() {
    return `audio/mpeg`;
  }
  async addEncodedVideoPacket() {
    throw Error(`MP3 does not support video.`);
  }
  async addEncodedAudioPacket(e, t) {
    let n = await this.mutex.acquire();
    try {
      let n = this.format._options.xingHeader !== false;
      if (!this.xingFrameData && n) {
        let e = u(t.data);
        if (e.byteLength < 4) {
          throw Error(`Invalid MP3 header in sample.`);
        }
        let n = fn(e.getUint32(0, false), null).header;
        if (!n) {
          throw Error(`Invalid MP3 header in sample.`);
        }
        let r = dn(n.mpegVersionId, n.channel);
        if (e.byteLength >= r + 4) {
          let t = e.getUint32(r, false);
          if (t === 1483304551 || t === 1231971951) {
            return;
          }
        }
        this.xingFrameData = {
          mpegVersionId: n.mpegVersionId,
          layer: n.layer,
          frequencyIndex: n.frequencyIndex,
          sampleRate: n.sampleRate,
          channel: n.channel,
          modeExtension: n.modeExtension,
          copyright: n.copyright,
          original: n.original,
          emphasis: n.emphasis,
          frameCount: null,
          fileSize: null,
          toc: null
        };
        this.xingFramePos = this.writer.getPos();
        this.mp3Writer.writeXingFrame(this.xingFrameData);
        this.frameCount++;
      }
      this.validateTimestamp(e, t.timestamp, t.type === `key`);
      if (n) {
        this.framePositions.push(this.writer.getPos());
      }
      this.writer.write(t.data);
      this.frameCount++;
      await this.writer.flush();
    } finally {
      n();
    }
  }
  async addSubtitleCue() {
    throw Error(`MP3 does not support subtitles.`);
  }
  async finalize() {
    if (!this.xingFrameData || this.xingFramePos === null) {
      return;
    }
    let e = await this.mutex.acquire();
    let t = this.writer.getPos() - this.xingFramePos;
    this.writer.seek(this.xingFramePos);
    let n = new Uint8Array(100);
    for (let e = 0; e < 100; e++) {
      let r = Math.floor(this.framePositions.length * (e / 100));
      n[e] = (this.framePositions[r] - this.xingFramePos) / t * 256;
    }
    this.xingFrameData.frameCount = this.frameCount;
    this.xingFrameData.fileSize = t;
    this.xingFrameData.toc = n;
    if (this.format._options.onXingFrame) {
      this.writer.startTrackingWrites();
    }
    this.mp3Writer.writeXingFrame(this.xingFrameData);
    if (this.format._options.onXingFrame) {
      let {
        data: e,
        start: t
      } = this.writer.stopTrackingWrites();
      this.format._options.onXingFrame(e, t);
    }
    e();
  }
};
var cf = 8192;
var lf = class extends Il {
  constructor(e, t) {
    super(e);
    this.trackDatas = [];
    this.bosPagesWritten = false;
    this.allTracksKnown = E();
    this.pageBytes = new Uint8Array(qi);
    this.pageView = new DataView(this.pageBytes.buffer);
    this.format = t;
  }
  async start() {
    let e = await this.mutex.acquire();
    this.writer = await this.output._getRootWriter(true);
    e();
  }
  async getMimeType() {
    await this.allTracksKnown.promise;
    return Ki({
      codecStrings: this.trackDatas.map(e => {
        return e.codecInfo.codec;
      })
    });
  }
  addEncodedVideoPacket() {
    throw Error(`Video tracks are not supported.`);
  }
  getTrackData(e, t) {
    let r = this.trackDatas.find(t => {
      return t.track === e;
    });
    if (r) {
      return r;
    }
    let i;
    do {
      i = Math.floor(Math.random() * 4294967296);
    } while (this.trackDatas.some(e => {
      return e.serialNumber === i;
    }));
    n(e.source._codec === `vorbis` || e.source._codec === `opus`);
    rn(t);
    n(t);
    n(t.decoderConfig);
    let a = {
      track: e,
      serialNumber: i,
      internalSampleRate: e.source._codec === `opus` ? Wt : t.decoderConfig.sampleRate,
      codecInfo: {
        codec: e.source._codec,
        vorbisInfo: null,
        opusInfo: null
      },
      vorbisLastBlocksize: null,
      packetQueue: [],
      currentTimestampInSamples: 0,
      pagesWritten: 0,
      currentGranulePosition: 0,
      currentLacingValues: [],
      currentPageData: [],
      currentPageSize: 27,
      currentPageStartsWithFreshPacket: true,
      currentPageStartTimestampInSamples: 0,
      closed: false
    };
    this.queueHeaderPackets(a, t);
    this.trackDatas.push(a);
    if (this.allTracksAreKnown()) {
      this.allTracksKnown.resolve();
    }
    return a;
  }
  queueHeaderPackets(e, t) {
    n(t.decoderConfig);
    if (e.track.source._codec === `vorbis`) {
      n(t.decoderConfig.description);
      let r = l(t.decoderConfig.description);
      if (r[0] !== 2) {
        throw TypeError(`First byte of Vorbis decoder description must be 2.`);
      }
      let i = 1;
      let a = () => {
        let e = 0;
        while (true) {
          let t = r[i++];
          if (t === undefined) {
            throw TypeError(`Vorbis decoder description is too short.`);
          }
          e += t;
          if (t < 255) {
            return e;
          }
        }
      };
      let o = a();
      let s = a();
      if (r.length - i <= 0) {
        throw TypeError(`Vorbis decoder description is too short.`);
      }
      let c = r.subarray(i, i += o);
      i += s;
      let d = r.subarray(i);
      let f = new Uint8Array(7);
      f[0] = 3;
      f[1] = 118;
      f[2] = 111;
      f[3] = 114;
      f[4] = 98;
      f[5] = 105;
      f[6] = 115;
      let p = or(f, this.output._metadataTags, true);
      e.packetQueue.push({
        data: c,
        timestampInSamples: 0,
        durationInSamples: 0,
        forcePageFlush: true
      }, {
        data: p,
        timestampInSamples: 0,
        durationInSamples: 0,
        forcePageFlush: false
      }, {
        data: d,
        timestampInSamples: 0,
        durationInSamples: 0,
        forcePageFlush: true
      });
      let m = u(c).getUint8(28);
      e.codecInfo.vorbisInfo = {
        blocksizes: [1 << (m & 15), 1 << (m >> 4)],
        modeBlockflags: nr(d).modeBlockflags
      };
    } else if (e.track.source._codec === `opus`) {
      if (!t.decoderConfig.description) {
        throw TypeError(`For Ogg, Opus decoder description is required.`);
      }
      let n = l(t.decoderConfig.description);
      let r = new Uint8Array(8);
      let i = u(r);
      i.setUint32(0, 1332770163, false);
      i.setUint32(4, 1415669619, false);
      let a = or(r, this.output._metadataTags, true);
      e.packetQueue.push({
        data: n,
        timestampInSamples: 0,
        durationInSamples: 0,
        forcePageFlush: true
      }, {
        data: a,
        timestampInSamples: 0,
        durationInSamples: 0,
        forcePageFlush: true
      });
      e.codecInfo.opusInfo = {
        preSkip: $n(n).preSkip
      };
    }
  }
  async addEncodedAudioPacket(e, t, n) {
    let r = await this.mutex.acquire();
    try {
      let r = this.getTrackData(e, n);
      this.validateTimestamp(r.track, t.timestamp, t.type === `key`);
      let i = r.currentTimestampInSamples;
      let {
        durationInSamples: a,
        vorbisBlockSize: o
      } = Gi(t.data, r.codecInfo, r.vorbisLastBlocksize);
      r.currentTimestampInSamples += a;
      r.vorbisLastBlocksize = o;
      r.packetQueue.push({
        data: t.data,
        timestampInSamples: i,
        durationInSamples: a,
        forcePageFlush: false
      });
      await this.interleavePages();
    } finally {
      r();
    }
  }
  addSubtitleCue() {
    throw Error(`Subtitle tracks are not supported.`);
  }
  allTracksAreKnown() {
    for (let e of this.output._tracks) {
      if (!e.source._closed && !this.trackDatas.some(t => {
        return t.track === e;
      })) {
        return false;
      }
    }
    return true;
  }
  async interleavePages(e = false) {
    if (!this.bosPagesWritten) {
      if (!this.allTracksAreKnown() && !e) {
        return;
      }
      for (let e of this.trackDatas) {
        while (e.packetQueue.length > 0) {
          let t = e.packetQueue.shift();
          this.writePacket(e, t, false);
          if (t.forcePageFlush) {
            break;
          }
        }
      }
      this.bosPagesWritten = true;
    }
    outer: while (true) {
      let t = null;
      let n = Infinity;
      for (let r of this.trackDatas) {
        if (!e && r.packetQueue.length <= 1 && !r.closed) {
          break outer;
        }
        if (r.packetQueue.length > 0 && r.packetQueue[0].timestampInSamples < n) {
          t = r;
          n = r.packetQueue[0].timestampInSamples;
        }
      }
      if (!t) {
        break;
      }
      let r = t.packetQueue.shift();
      let i = t.packetQueue.length === 0;
      this.writePacket(t, r, i);
    }
    if (!e) {
      await this.writer.flush();
    }
  }
  writePacket(e, t, n) {
    let r = t.timestampInSamples + t.durationInSamples;
    if (this.format._options.maximumPageDuration !== undefined) {
      let t = this.format._options.maximumPageDuration * e.internalSampleRate;
      if (e.currentLacingValues.length > 0 && r - e.currentPageStartTimestampInSamples > t) {
        this.writePage(e, false);
      }
    }
    let i = t.data.length;
    let a = 0;
    let o = 0;
    while (true) {
      if (e.currentLacingValues.length === 0 && a > 0) {
        e.currentPageStartsWithFreshPacket = false;
      }
      let r = Math.min(255, i);
      e.currentLacingValues.push(r);
      e.currentPageSize++;
      o += r;
      let s = i < 255;
      if (e.currentLacingValues.length === 255) {
        let r = t.data.subarray(a, o);
        a = o;
        e.currentPageData.push(r);
        e.currentPageSize += r.length;
        this.writePage(e, n && s);
        if (s) {
          return;
        }
      }
      if (s) {
        break;
      }
      i -= 255;
    }
    let s = t.data.subarray(a);
    e.currentPageData.push(s);
    e.currentPageSize += s.length;
    e.currentGranulePosition = r;
    if (e.currentPageSize >= cf || t.forcePageFlush) {
      this.writePage(e, n);
    }
  }
  writePage(e, t) {
    this.pageView.setUint32(0, Vi, true);
    this.pageView.setUint8(4, 0);
    let n = 0;
    if (!e.currentPageStartsWithFreshPacket) {
      n |= 1;
    }
    if (e.pagesWritten === 0) {
      n |= 2;
    }
    if (t) {
      n |= 4;
    }
    this.pageView.setUint8(5, n);
    let r = e.currentLacingValues.every(e => {
      return e === 255;
    }) ? -1 : e.currentGranulePosition;
    me(this.pageView, 6, r, true);
    this.pageView.setUint32(14, e.serialNumber, true);
    this.pageView.setUint32(18, e.pagesWritten, true);
    this.pageView.setUint32(22, 0, true);
    this.pageView.setUint8(26, e.currentLacingValues.length);
    this.pageBytes.set(e.currentLacingValues, 27);
    let i = 27 + e.currentLacingValues.length;
    for (let t of e.currentPageData) {
      this.pageBytes.set(t, i);
      i += t.length;
    }
    let a = this.pageBytes.subarray(0, i);
    let o = Wi(a);
    this.pageView.setUint32(22, o, true);
    e.pagesWritten++;
    e.currentLacingValues.length = 0;
    e.currentPageData.length = 0;
    e.currentPageSize = 27;
    e.currentPageStartsWithFreshPacket = true;
    e.currentPageStartTimestampInSamples = e.currentGranulePosition;
    if (this.format._options.onPage) {
      this.writer.startTrackingWrites();
    }
    this.writer.write(a);
    if (this.format._options.onPage) {
      let {
        data: t,
        start: n
      } = this.writer.stopTrackingWrites();
      this.format._options.onPage(t, n, e.track.source);
    }
  }
  async onTrackClose(e) {
    let t = await this.mutex.acquire();
    let n = this.trackDatas.find(t => {
      return t.track === e;
    });
    if (n) {
      n.closed = true;
    }
    if (this.allTracksAreKnown()) {
      this.allTracksKnown.resolve();
    }
    await this.interleavePages();
    t();
  }
  async finalize() {
    let e = await this.mutex.acquire();
    this.allTracksKnown.resolve();
    for (let e of this.trackDatas) {
      e.closed = true;
    }
    await this.interleavePages(true);
    for (let e of this.trackDatas) {
      if (e.currentLacingValues.length > 0) {
        this.writePage(e, true);
      }
    }
    e();
  }
};
var uf = 0;
var df = 4096;
var ff = 256;
var pf = 224;
var mf = 192;
var hf = new Uint8Array([9, 240]);
var gf = new Uint8Array([70, 1]);
var _f = class extends Il {
  constructor(e, t) {
    super(e);
    this.trackDatas = [];
    this.tablesWritten = false;
    this.continuityCounters = new Map();
    this.packetBuffer = new Uint8Array(188);
    this.packetView = u(this.packetBuffer);
    this.allTracksKnown = E();
    this.videoTrackIndex = 0;
    this.audioTrackIndex = 0;
    this.adaptationFieldBuffer = new Uint8Array(184);
    this.payloadBuffer = new Uint8Array(184);
    this.format = t;
  }
  async start() {
    let e = await this.mutex.acquire();
    this.writer = await this.output._getRootWriter(true);
    e();
  }
  async getMimeType() {
    await this.allTracksKnown.promise;
    return _a(this.trackDatas.map(e => {
      return e.codecString;
    }));
  }
  getVideoTrackData(e, t) {
    let r = this.trackDatas.find(t => {
      return t.track === e;
    });
    if (r) {
      return r;
    }
    tn(t);
    n(t?.decoderConfig);
    let i = e.source._codec;
    n(i === `avc` || i === `hevc`);
    let a = i === `avc` ? 27 : 36;
    let o = {
      track: e,
      pid: ff + this.trackDatas.length,
      streamType: a,
      streamId: pf + this.videoTrackIndex++,
      codecString: t.decoderConfig.codec,
      timestampProcessingQueue: [],
      packetQueue: [],
      inputIsAnnexB: null,
      inputIsAdts: null,
      avcDecoderConfig: null,
      hevcDecoderConfig: null,
      adtsHeader: null,
      adtsHeaderBitstream: null,
      firstPacketWritten: false,
      closed: false
    };
    this.trackDatas.push(o);
    if (this.allTracksAreKnown()) {
      this.allTracksKnown.resolve();
    }
    return o;
  }
  getAudioTrackData(e, t) {
    let r = this.trackDatas.find(t => {
      return t.track === e;
    });
    if (r) {
      return r;
    }
    rn(t);
    n(t?.decoderConfig);
    let i = e.source._codec;
    n(i === `aac` || i === `mp3` || i === `ac3` || i === `eac3`);
    let a;
    let o;
    switch (i) {
      case `aac`:
        {
          a = 15;
          o = mf + this.audioTrackIndex++;
          break;
        }
      case `mp3`:
        {
          a = 3;
          o = mf + this.audioTrackIndex++;
          break;
        }
      case `ac3`:
        {
          a = 129;
          o = 189;
          break;
        }
      case `eac3`:
        {
          a = 135;
          o = 189;
          break;
        }
    }
    let s = {
      track: e,
      pid: ff + this.trackDatas.length,
      streamType: a,
      streamId: o,
      codecString: t.decoderConfig.codec,
      timestampProcessingQueue: [],
      packetQueue: [],
      inputIsAnnexB: null,
      inputIsAdts: null,
      avcDecoderConfig: null,
      hevcDecoderConfig: null,
      adtsHeader: null,
      adtsHeaderBitstream: null,
      firstPacketWritten: false,
      closed: false
    };
    this.trackDatas.push(s);
    if (this.allTracksAreKnown()) {
      this.allTracksKnown.resolve();
    }
    return s;
  }
  async addEncodedVideoPacket(e, t, n) {
    let r = await this.mutex.acquire();
    try {
      let r = this.getVideoTrackData(e, n);
      this.validateTimestamp(r.track, t.timestamp, t.type === `key`);
      let i = this.prepareVideoPacket(r, t, n);
      if (t.type === `key`) {
        await this.flushTimestampQueue(r);
      }
      r.timestampProcessingQueue.push({
        data: i,
        presentationTimestamp: t.timestamp,
        decodeTimestamp: null,
        isKeyframe: t.type === `key`
      });
    } finally {
      r();
    }
  }
  async addEncodedAudioPacket(e, t, n) {
    let r = await this.mutex.acquire();
    try {
      let r = this.getAudioTrackData(e, n);
      this.validateTimestamp(r.track, t.timestamp, t.type === `key`);
      let i = this.prepareAudioPacket(r, t, n);
      if (t.type === `key`) {
        await this.flushTimestampQueue(r);
      }
      r.timestampProcessingQueue.push({
        data: i,
        presentationTimestamp: t.timestamp,
        decodeTimestamp: null,
        isKeyframe: t.type === `key`
      });
    } finally {
      r();
    }
  }
  async addSubtitleCue() {
    throw Error(`MPEG-TS does not support subtitles.`);
  }
  prepareVideoPacket(e, t, n) {
    let r = e.track.source._codec;
    if (e.inputIsAnnexB === null) {
      let t = n?.decoderConfig?.description;
      e.inputIsAnnexB = !t;
      if (!e.inputIsAnnexB) {
        let n = l(t);
        if (r === `avc`) {
          e.avcDecoderConfig = An(n);
        } else {
          e.hevcDecoderConfig = qn(n);
        }
      }
    }
    if (e.inputIsAnnexB) {
      return this.prepareAnnexBVideoPacket(t.data, r);
    } else {
      return this.prepareLengthPrefixedVideoPacket(e, t, r);
    }
  }
  prepareAnnexBVideoPacket(e, t) {
    let n = [];
    for (let r of yn(e)) {
      let i = e.subarray(r.offset, r.offset + r.length);
      if (!(t === `avc` ? Sn(i[0]) === P.AUD : In(i[0]) === F.AUD_NUT)) {
        n.push(i);
      }
    }
    let r = t === `avc` ? hf : gf;
    n.unshift(r);
    return Tn(n);
  }
  prepareLengthPrefixedVideoPacket(e, t, n) {
    let r = t.data;
    let i = n === `avc` ? e.avcDecoderConfig.lengthSizeMinusOne + 1 : e.hevcDecoderConfig.lengthSizeMinusOne + 1;
    let a = [];
    for (let e of bn(r, i)) {
      let t = r.subarray(e.offset, e.offset + e.length);
      if (!(n === `avc` ? Sn(t[0]) === P.AUD : In(t[0]) === F.AUD_NUT)) {
        a.push(t);
      }
    }
    if (t.type === `key`) {
      if (n === `avc`) {
        let t = e.avcDecoderConfig;
        for (let e of t.pictureParameterSets) {
          a.unshift(e);
        }
        for (let e of t.sequenceParameterSets) {
          a.unshift(e);
        }
      } else {
        let t = e.hevcDecoderConfig;
        for (let e of t.arrays) {
          if (e.nalUnitType === F.PPS_NUT) {
            for (let t of e.nalUnits) {
              a.unshift(t);
            }
          }
        }
        for (let e of t.arrays) {
          if (e.nalUnitType === F.SPS_NUT) {
            for (let t of e.nalUnits) {
              a.unshift(t);
            }
          }
        }
        for (let e of t.arrays) {
          if (e.nalUnitType === F.VPS_NUT) {
            for (let t of e.nalUnits) {
              a.unshift(t);
            }
          }
        }
      }
    }
    let o = n === `avc` ? hf : gf;
    a.unshift(o);
    return Tn(a);
  }
  prepareAudioPacket(e, t, r) {
    let i = e.track.source._codec;
    if (i === `mp3` || i === `ac3` || i === `eac3`) {
      return t.data;
    }
    if (e.inputIsAdts === null) {
      let t = r?.decoderConfig?.description;
      e.inputIsAdts = !t;
      if (!e.inputIsAdts) {
        let n = Tt(Ct(l(t)));
        e.adtsHeader = n.header;
        e.adtsHeaderBitstream = n.bitstream;
      }
    }
    if (e.inputIsAdts) {
      return t.data;
    }
    n(e.adtsHeader);
    n(e.adtsHeaderBitstream);
    let a = e.adtsHeader;
    let o = t.data.byteLength + a.byteLength;
    Et(e.adtsHeaderBitstream, o);
    let s = new Uint8Array(o);
    s.set(a, 0);
    s.set(t.data, a.byteLength);
    return s;
  }
  allTracksAreKnown() {
    for (let e of this.output._tracks) {
      if (!e.source._closed && !this.trackDatas.some(t => {
        return t.track === e;
      })) {
        return false;
      }
    }
    return true;
  }
  async flushTimestampQueue(e, t = true) {
    if (e.timestampProcessingQueue.length === 0) {
      return;
    }
    let n = e.timestampProcessingQueue.map(e => {
      return e.presentationTimestamp;
    }).sort((e, t) => {
      return e - t;
    });
    for (let t = 0; t < e.timestampProcessingQueue.length; t++) {
      let r = e.timestampProcessingQueue[t];
      r.decodeTimestamp = n[t];
      e.packetQueue.push(r);
    }
    e.timestampProcessingQueue.length = 0;
    if (t) {
      await this.interleavePackets();
    }
  }
  async interleavePackets(e = false) {
    if (!this.tablesWritten) {
      if (!this.allTracksAreKnown() && !e) {
        return;
      }
      this.writeTables();
    }
    outer: while (true) {
      let t = null;
      let n = Infinity;
      for (let r of this.trackDatas) {
        if (!e && r.packetQueue.length === 0 && !r.closed) {
          break outer;
        }
        if (r.packetQueue.length > 0 && r.packetQueue[0].presentationTimestamp < n) {
          t = r;
          n = r.packetQueue[0].presentationTimestamp;
        }
      }
      if (!t) {
        break;
      }
      let r = t.packetQueue.shift();
      this.writePesPacket(t, r);
    }
    if (!e) {
      await this.writer.flush();
    }
  }
  writeTables() {
    n(!this.tablesWritten);
    this.writePsiSection(uf, xf);
    this.writePsiSection(df, Sf(this.trackDatas));
    this.tablesWritten = true;
  }
  writePsiSection(e, t) {
    let n = 0;
    let r = true;
    while (n < t.length) {
      let i = 184 - !!r;
      let a = t.length - n;
      let o = Math.min(i, a);
      let s;
      if (r) {
        s = this.payloadBuffer.subarray(0, 1 + o);
        s[0] = 0;
        s.set(t.subarray(n, n + o), 1);
      } else {
        s = t.subarray(n, n + o);
      }
      this.writeTsPacket(e, r, null, s);
      n += o;
      r = false;
    }
  }
  writePesPacket(e, t) {
    let r = e.track.type === `video`;
    let i = r ? 10 : 5;
    let a = new Uint8Array(9 + i);
    let o = u(a);
    let s = new A(a.subarray(9));
    fe(o, 0, 1, false);
    a[3] = e.streamId;
    let c = e.track.type === `video` ? 0 : Math.min(8 + t.data.length, 65535);
    o.setUint16(4, c, false);
    o.setUint8(6, 132);
    o.setUint8(7, r ? 192 : 128);
    o.setUint8(8, i);
    let l = Math.round(t.presentationTimestamp * ga);
    s.pos = 0;
    s.writeBits(4, r ? 3 : 2);
    s.writeBits(3, l >>> 30 & 7);
    s.writeBits(1, 1);
    s.writeBits(15, l >>> 15 & 32767);
    s.writeBits(1, 1);
    s.writeBits(15, l & 32767);
    s.writeBits(1, 1);
    if (r) {
      n(t.decodeTimestamp !== null);
      let e = Math.round(t.decodeTimestamp * ga);
      s.writeBits(4, 1);
      s.writeBits(3, e >>> 30 & 7);
      s.writeBits(1, 1);
      s.writeBits(15, e >>> 15 & 32767);
      s.writeBits(1, 1);
      s.writeBits(15, e & 32767);
      s.writeBits(1, 1);
    }
    let d = a.length + t.data.length;
    let f = 0;
    let p = true;
    while (f < d) {
      let n = p;
      let r = d - f;
      let i = p && t.isKeyframe;
      let o = p && !e.firstPacketWritten;
      let s = Math.max(0, 184 - r);
      let c;
      if (i || o) {
        c = Math.max(2, s);
      } else {
        c = s;
      }
      let l = null;
      if (c > 0) {
        let e = this.adaptationFieldBuffer;
        if (c === 1) {
          e[0] = 0;
        } else {
          e[0] = c - 1;
          e[1] = Number(o) << 7 | Number(i) << 6;
          e.fill(255, 2, c);
        }
        l = e.subarray(0, c);
      }
      let u = Math.min(184 - c, r);
      let m = this.payloadBuffer.subarray(0, u);
      let h = 0;
      if (f < a.length) {
        let e = Math.min(a.length - f, u);
        m.set(a.subarray(f, f + e), 0);
        h = e;
      }
      let g = Math.max(0, f - a.length);
      let _ = g + (u - h);
      if (h < u) {
        m.set(t.data.subarray(g, _), h);
      }
      this.writeTsPacket(e.pid, n, l, m);
      f += u;
      p = false;
    }
    e.firstPacketWritten = true;
  }
  writeTsPacket(e, t, n, r) {
    let i = this.continuityCounters.get(e) ?? 0;
    let a = r.length > 0;
    let o = n ? a ? 3 : 2 : +!!a;
    this.packetBuffer[0] = 71;
    this.packetView.setUint16(1, (t ? 16384 : 0) | e & 8191, false);
    this.packetBuffer[3] = o << 4 | i & 15;
    if (a) {
      this.continuityCounters.set(e, i + 1 & 15);
    }
    let s = 4;
    if (n) {
      this.packetBuffer.set(n, s);
      s += n.length;
    }
    this.packetBuffer.set(r, s);
    s += r.length;
    if (s < 188) {
      this.packetBuffer.fill(255, s);
    }
    let c = this.writer.getPos();
    this.writer.write(this.packetBuffer);
    if (this.format._options.onPacket) {
      this.format._options.onPacket(this.packetBuffer.slice(), c);
    }
  }
  async onTrackClose(e) {
    let t = await this.mutex.acquire();
    let n = this.trackDatas.find(t => {
      return t.track === e;
    });
    if (n) {
      n.closed = true;
      await this.flushTimestampQueue(n, false);
    }
    if (this.allTracksAreKnown()) {
      this.allTracksKnown.resolve();
    }
    await this.interleavePackets();
    t();
  }
  async finalize() {
    let e = await this.mutex.acquire();
    this.allTracksKnown.resolve();
    for (let e of this.trackDatas) {
      e.closed = true;
      await this.flushTimestampQueue(e, false);
    }
    await this.interleavePackets(true);
    e();
  }
};
var vf = 79764919;
var yf = new Uint32Array(256);
for (let e = 0; e < 256; e++) {
  let t = e << 24;
  for (let e = 0; e < 8; e++) {
    if (t & -2147483648) {
      t = t << 1 ^ vf;
    } else {
      t = t << 1;
    }
  }
  yf[e] = t >>> 0 & -1;
}
var bf = e => {
  let t = 4294967295;
  for (let n = 0; n < e.length; n++) {
    let r = e[n];
    t = (t << 8 ^ yf[t >>> 24 ^ r]) >>> 0;
  }
  return t;
};
var xf = new Uint8Array(16);
{
  let e = u(xf);
  xf[0] = 0;
  e.setUint16(1, 45069, false);
  e.setUint16(3, 1, false);
  xf[5] = 193;
  xf[6] = 0;
  xf[7] = 0;
  e.setUint16(8, 1, false);
  e.setUint16(10, 61440, false);
  e.setUint32(12, bf(xf.subarray(0, 12)), false);
}
var Sf = e => {
  let t = 0;
  for (let n of e) {
    t += 5;
    if (n.streamType === 129) {
      t += dr.length;
    } else if (n.streamType === 135) {
      t += fr.length;
    }
  }
  let n = 9 + t + 4;
  let r = new Uint8Array(3 + n - 4);
  let i = u(r);
  r[0] = 2;
  i.setUint16(1, n & 4095 | 45056, false);
  i.setUint16(3, 1, false);
  r[5] = 193;
  r[6] = 0;
  r[7] = 0;
  i.setUint16(8, 65535, false);
  i.setUint16(10, 61440, false);
  let a = 12;
  for (let t of e) {
    r[a++] = t.streamType;
    i.setUint16(a, t.pid & 8191 | 57344, false);
    a += 2;
    if (t.streamType === 129) {
      i.setUint16(a, dr.length | 61440, false);
      a += 2;
      r.set(dr, a);
      a += dr.length;
    } else if (t.streamType === 135) {
      i.setUint16(a, fr.length | 61440, false);
      a += 2;
      r.set(fr, a);
      a += fr.length;
    } else {
      i.setUint16(a, 61440, false);
      a += 2;
    }
  }
  let o = bf(r);
  let s = new Uint8Array(r.length + 4);
  s.set(r, 0);
  u(s).setUint32(r.length, o, false);
  return s;
};
var Cf = class {
  constructor(e) {
    this.writer = e;
    this.helper = new Uint8Array(8);
    this.helperView = new DataView(this.helper.buffer);
  }
  writeU16(e) {
    this.helperView.setUint16(0, e, true);
    this.writer.write(this.helper.subarray(0, 2));
  }
  writeU32(e) {
    this.helperView.setUint32(0, e, true);
    this.writer.write(this.helper.subarray(0, 4));
  }
  writeU64(e) {
    this.helperView.setUint32(0, e, true);
    this.helperView.setUint32(4, Math.floor(e / 4294967296), true);
    this.writer.write(this.helper);
  }
  writeAscii(e) {
    this.writer.write(new TextEncoder().encode(e));
  }
};
var wf = class extends Il {
  constructor(e, t) {
    super(e);
    this.headerWritten = false;
    this.dataSize = 0;
    this.sampleRate = null;
    this.sampleCount = 0;
    this.riffSizePos = null;
    this.dataSizePos = null;
    this.ds64RiffSizePos = null;
    this.ds64DataSizePos = null;
    this.ds64SampleCountPos = null;
    this.format = t;
    this.isRf64 = !!t._options.large;
  }
  async start() {
    let e = await this.mutex.acquire();
    this.writer = await this.output._getRootWriter(false);
    this.riffWriter = new Cf(this.writer);
    e();
  }
  async getMimeType() {
    return `audio/wav`;
  }
  async addEncodedVideoPacket() {
    throw Error(`WAVE does not support video.`);
  }
  async addEncodedAudioPacket(e, t, r) {
    let i = await this.mutex.acquire();
    try {
      rn(r);
      n(r);
      n(r.decoderConfig);
      this.writeHeader(e, r.decoderConfig);
      this.sampleRate = r.decoderConfig.sampleRate;
      this.headerWritten ||= true;
      this.validateTimestamp(e, t.timestamp, t.type === `key`);
      if (!this.isRf64 && this.writer.getPos() + t.data.byteLength >= 4294967296) {
        throw Error('Adding more audio data would exceed the maximum RIFF size of 4 GiB. To write larger files, use RF64 by setting `large: true` in the WavOutputFormatOptions.');
      }
      this.writer.write(t.data);
      this.dataSize += t.data.byteLength;
      this.sampleCount += Math.round(t.duration * this.sampleRate);
      await this.writer.flush();
    } finally {
      i();
    }
  }
  async addSubtitleCue() {
    throw Error(`WAVE does not support subtitles.`);
  }
  writeHeader(e, t) {
    if (this.format._options.onHeader) {
      this.writer.startTrackingWrites();
    }
    let n;
    let r = e.source._codec;
    let i = Kt(r);
    if (i.dataType === `ulaw`) {
      n = ea.MULAW;
    } else {
      if (i.dataType === `alaw`) {
        n = ea.ALAW;
      } else {
        if (i.dataType === `float`) {
          n = ea.IEEE_FLOAT;
        } else {
          n = ea.PCM;
        }
      }
    }
    let a = t.numberOfChannels;
    let o = t.sampleRate;
    let s = i.sampleSize * a;
    this.riffWriter.writeAscii(this.isRf64 ? `RF64` : `RIFF`);
    if (this.isRf64) {
      this.riffWriter.writeU32(4294967295);
    } else {
      this.riffSizePos = this.writer.getPos();
      this.riffWriter.writeU32(0);
    }
    this.riffWriter.writeAscii(`WAVE`);
    if (this.isRf64) {
      this.riffWriter.writeAscii(`ds64`);
      this.riffWriter.writeU32(28);
      this.ds64RiffSizePos = this.writer.getPos();
      this.riffWriter.writeU64(0);
      this.ds64DataSizePos = this.writer.getPos();
      this.riffWriter.writeU64(0);
      this.ds64SampleCountPos = this.writer.getPos();
      this.riffWriter.writeU64(0);
      this.riffWriter.writeU32(0);
    }
    this.riffWriter.writeAscii(`fmt `);
    this.riffWriter.writeU32(16);
    this.riffWriter.writeU16(n);
    this.riffWriter.writeU16(a);
    this.riffWriter.writeU32(o);
    this.riffWriter.writeU32(o * s);
    this.riffWriter.writeU16(s);
    this.riffWriter.writeU16(i.sampleSize * 8);
    if (!vt(this.output._metadataTags)) {
      let e = this.format._options.metadataFormat ?? `info`;
      if (e === `info`) {
        this.writeInfoChunk(this.output._metadataTags);
      } else if (e === `id3`) {
        this.writeId3Chunk(this.output._metadataTags);
      } else {
        D(e);
      }
    }
    this.riffWriter.writeAscii(`data`);
    if (this.isRf64) {
      this.riffWriter.writeU32(4294967295);
    } else {
      this.dataSizePos = this.writer.getPos();
      this.riffWriter.writeU32(0);
    }
    if (this.format._options.onHeader) {
      let {
        data: e,
        start: t
      } = this.writer.stopTrackingWrites();
      this.format._options.onHeader(e, t);
    }
  }
  writeInfoChunk(e) {
    let t = this.writer.getPos();
    this.riffWriter.writeAscii(`LIST`);
    this.riffWriter.writeU32(0);
    this.riffWriter.writeAscii(`INFO`);
    let n = new Set();
    let r = (e, t) => {
      if (!p(t)) {
        k._warn(`Didn't write tag '${e}' because '${t}' is not ISO 8859-1-compatible.`);
        return;
      }
      let r = t.length + 1;
      let i = new Uint8Array(r);
      for (let e = 0; e < t.length; e++) {
        i[e] = t.charCodeAt(e);
      }
      this.riffWriter.writeAscii(e);
      this.riffWriter.writeU32(r);
      this.writer.write(i);
      if (r & 1) {
        this.writer.write(new Uint8Array(1));
      }
      n.add(e);
    };
    for (let {
      key: t,
      value: i
    } of Be(e)) {
      switch (t) {
        case `title`:
          {
            r(`INAM`, i);
            n.add(`INAM`);
            break;
          }
        case `artist`:
          {
            r(`IART`, i);
            n.add(`IART`);
            break;
          }
        case `album`:
          {
            r(`IPRD`, i);
            n.add(`IPRD`);
            break;
          }
        case `trackNumber`:
          {
            r(`ITRK`, e.tracksTotal === undefined ? i.toString() : `${i}/${e.tracksTotal}`);
            n.add(`ITRK`);
            break;
          }
        case `genre`:
          {
            r(`IGNR`, i);
            n.add(`IGNR`);
            break;
          }
        case `date`:
          {
            r(`ICRD`, i.toISOString().slice(0, 10));
            n.add(`ICRD`);
            break;
          }
        case `comment`:
          {
            r(`ICMT`, i);
            n.add(`ICMT`);
            break;
          }
        case `albumArtist`:
        case `discNumber`:
        case `tracksTotal`:
        case `discsTotal`:
        case `description`:
        case `lyrics`:
        case `images`:
          {
            break;
          }
        case `raw`:
          {
            break;
          }
        default:
          {
            D(t);
          }
      }
    }
    if (e.raw) {
      for (let t in e.raw) {
        let i = e.raw[t];
        if (i != null && t.length === 4 && !n.has(t)) {
          if (typeof i == `string`) {
            r(t, i);
          }
        }
      }
    }
    let i = this.writer.getPos();
    let a = i - t - 8;
    this.writer.seek(t + 4);
    this.riffWriter.writeU32(a);
    this.writer.seek(i);
    if (a & 1) {
      this.writer.write(new Uint8Array(1));
    }
  }
  writeId3Chunk(e) {
    let t = this.writer.getPos();
    this.riffWriter.writeAscii(`ID3 `);
    this.riffWriter.writeU32(0);
    let n = new Fl(this.writer).writeId3V2Tag(e);
    let r = this.writer.getPos();
    this.writer.seek(t + 4);
    this.riffWriter.writeU32(n);
    this.writer.seek(r);
    if (n & 1) {
      this.writer.write(new Uint8Array(1));
    }
  }
  async finalize() {
    let e = await this.mutex.acquire();
    let t = this.writer.getPos();
    if (this.isRf64) {
      n(this.ds64RiffSizePos !== null);
      this.writer.seek(this.ds64RiffSizePos);
      this.riffWriter.writeU64(t - 8);
      n(this.ds64DataSizePos !== null);
      this.writer.seek(this.ds64DataSizePos);
      this.riffWriter.writeU64(this.dataSize);
      n(this.ds64SampleCountPos !== null);
      this.writer.seek(this.ds64SampleCountPos);
      this.riffWriter.writeU64(this.sampleCount);
    } else {
      n(this.riffSizePos !== null);
      this.writer.seek(this.riffSizePos);
      this.riffWriter.writeU32(t - 8);
      n(this.dataSizePos !== null);
      this.writer.seek(this.dataSizePos);
      this.riffWriter.writeU32(this.dataSize);
    }
    e();
  }
};
var Tf = class {
  constructor(e) {
    this.sourceSampleRate = null;
    this.sourceNumberOfChannels = null;
    this.startTime = null;
    this.bufferStartFrame = 0;
    this.maxWrittenFrame = null;
    this.targetSampleRate = e.targetSampleRate;
    this.targetNumberOfChannels = e.targetNumberOfChannels;
    this.onSample = e.onSample;
    this.bufferSizeInFrames = Math.floor(this.targetSampleRate * 5);
    this.bufferSizeInSamples = this.bufferSizeInFrames * this.targetNumberOfChannels;
    this.outputBuffer = new Float32Array(this.bufferSizeInSamples);
  }
  doChannelMixerSetup() {
    n(this.sourceNumberOfChannels !== null);
    let e = this.sourceNumberOfChannels;
    let t = this.targetNumberOfChannels;
    if (e === 1 && t === 2) {
      this.channelMixer = (t, n) => {
        return t[n * e];
      };
    } else if (e === 1 && t === 4) {
      this.channelMixer = (t, n, r) => {
        return t[n * e] * +(r < 2);
      };
    } else if (e === 1 && t === 6) {
      this.channelMixer = (t, n, r) => {
        return t[n * e] * +(r === 2);
      };
    } else if (e === 2 && t === 1) {
      this.channelMixer = (t, n) => {
        let r = n * e;
        return (t[r] + t[r + 1]) * 0.5;
      };
    } else if (e === 2 && t === 4 || e === 2 && t === 6) {
      this.channelMixer = (t, n, r) => {
        return t[n * e + r] * +(r < 2);
      };
    } else if (e === 4 && t === 1) {
      this.channelMixer = (t, n) => {
        let r = n * e;
        return (t[r] + t[r + 1] + t[r + 2] + t[r + 3]) * 0.25;
      };
    } else if (e === 4 && t === 2) {
      this.channelMixer = (t, n, r) => {
        let i = n * e;
        return (t[i + r] + t[i + r + 2]) * 0.5;
      };
    } else if (e === 4 && t === 6) {
      this.channelMixer = (t, n, r) => {
        let i = n * e;
        if (r < 2) {
          return t[i + r];
        } else if (r === 2 || r === 3) {
          return 0;
        } else {
          return t[i + r - 2];
        }
      };
    } else if (e === 6 && t === 1) {
      this.channelMixer = (t, n) => {
        let r = n * e;
        return Math.SQRT1_2 * (t[r] + t[r + 1]) + t[r + 2] + (t[r + 4] + t[r + 5]) * 0.5;
      };
    } else if (e === 6 && t === 2) {
      this.channelMixer = (t, n, r) => {
        let i = n * e;
        return t[i + r] + Math.SQRT1_2 * (t[i + 2] + t[i + r + 4]);
      };
    } else if (e === 6 && t === 4) {
      this.channelMixer = (t, n, r) => {
        let i = n * e;
        if (r < 2) {
          return t[i + r] + Math.SQRT1_2 * t[i + 2];
        } else {
          return t[i + r + 2];
        }
      };
    } else {
      this.channelMixer = (t, n, r) => {
        if (r < e) {
          return t[n * e + r];
        } else {
          return 0;
        }
      };
    }
  }
  ensureTempBufferSize(e) {
    let t = this.tempSourceBuffer.length;
    while (t < e) {
      t *= 2;
    }
    if (t !== this.tempSourceBuffer.length) {
      let e = new Float32Array(t);
      e.set(this.tempSourceBuffer);
      this.tempSourceBuffer = e;
    }
  }
  async add(e) {
    if (this.sourceSampleRate === null) {
      this.sourceSampleRate = e.sampleRate;
      this.sourceNumberOfChannels = e.numberOfChannels;
      this.startTime = e.timestamp;
      this.tempSourceBuffer = new Float32Array(this.sourceSampleRate * this.sourceNumberOfChannels);
      this.doChannelMixerSetup();
    }
    n(this.startTime !== null);
    let t = e.numberOfFrames * e.numberOfChannels;
    this.ensureTempBufferSize(t);
    let r = e.allocationSize({
      planeIndex: 0,
      format: `f32`
    });
    let i = new Float32Array(this.tempSourceBuffer.buffer, 0, r / 4);
    e.copyTo(i, {
      planeIndex: 0,
      format: `f32`
    });
    let a = e.timestamp - this.startTime;
    let o = a + e.duration;
    let s = Math.floor((a - 1 / this.sourceSampleRate) * this.targetSampleRate) + 1;
    let c = Math.ceil(o * this.targetSampleRate);
    for (let t = s; t < c; t++) {
      if (t < this.bufferStartFrame) {
        continue;
      }
      while (t >= this.bufferStartFrame + this.bufferSizeInFrames) {
        await this.finalizeCurrentBuffer();
        this.bufferStartFrame += this.bufferSizeInFrames;
      }
      let r = t - this.bufferStartFrame;
      n(r < this.bufferSizeInFrames);
      let o = (t / this.targetSampleRate - a) * this.sourceSampleRate;
      let s = Math.floor(o);
      let c = Math.ceil(o);
      let l = o - s;
      for (let t = 0; t < this.targetNumberOfChannels; t++) {
        let n = 0;
        let a = 0;
        if (s >= 0 && s < e.numberOfFrames) {
          n = this.channelMixer(i, s, t);
        }
        if (c >= 0 && c < e.numberOfFrames) {
          a = this.channelMixer(i, c, t);
        }
        let o = n + l * (a - n);
        let u = r * this.targetNumberOfChannels + t;
        this.outputBuffer[u] += o;
      }
      if (this.maxWrittenFrame === null) {
        this.maxWrittenFrame = r;
      } else {
        this.maxWrittenFrame = Math.max(this.maxWrittenFrame, r);
      }
    }
  }
  async finalizeCurrentBuffer() {
    if (this.maxWrittenFrame === null) {
      return;
    }
    n(this.startTime !== null);
    let e = (this.maxWrittenFrame + 1) * this.targetNumberOfChannels;
    let t = new Float32Array(e);
    t.set(this.outputBuffer.subarray(0, e));
    let r = new Bs({
      format: `f32`,
      sampleRate: this.targetSampleRate,
      numberOfChannels: this.targetNumberOfChannels,
      timestamp: this.startTime + this.bufferStartFrame / this.targetSampleRate,
      data: t
    });
    await this.onSample(r);
    this.outputBuffer.fill(0);
    this.maxWrittenFrame = null;
  }
  finalize() {
    return this.finalizeCurrentBuffer();
  }
};
var Ef = class {
  constructor() {
    this._connectedTrack = null;
    this._closingPromise = null;
    this._closed = false;
  }
  _ensureValidAdd() {
    if (!this._connectedTrack) {
      throw Error(`Source is not connected to an output track.`);
    }
    if (this._connectedTrack.output.state === `canceled`) {
      throw Error(`Output has been canceled.`);
    }
    if (this._connectedTrack.output.state === `finalizing` || this._connectedTrack.output.state === `finalized`) {
      throw Error(`Output has been finalized.`);
    }
    if (this._connectedTrack.output.state === `pending`) {
      throw Error(`Output has not started.`);
    }
    if (this._closed) {
      throw Error(`Source is closed.`);
    }
  }
  async _start() {}
  async _flushAndClose(e) {}
  close() {
    if (this._closingPromise) {
      return;
    }
    let e = this._connectedTrack;
    if (!e) {
      throw Error(`Cannot call close without connecting the source to an output track.`);
    }
    if (e.output.state === `pending`) {
      throw Error(`Cannot call close before output has been started.`);
    }
    this._closingPromise = (async () => {
      await this._flushAndClose(false);
      this._closed = true;
      if (e.output.state !== `finalizing` && e.output.state !== `finalized`) {
        e.output._muxer.onTrackClose(e);
      }
    })();
  }
  async _flushOrWaitForOngoingClose(e) {
    return this._closingPromise ??= (async () => {
      await this._flushAndClose(e);
      this._closed = true;
    })();
  }
};
var Df = class extends Ef {
  constructor(e) {
    super();
    this._connectedTrack = null;
    if (!j.includes(e)) {
      throw TypeError(`Invalid video codec '${e}'. Must be one of: ${j.join(`, `)}.`);
    }
    this._codec = e;
  }
};
var Of = (e, t) => {
  if (e.metadata.hasOnlyKeyPackets && t.type !== `key`) {
    throw Error(`Cannot add non-key packets to a hasOnlyKeyPackets video track.`);
  }
};
var kf = class extends Df {
  constructor(e) {
    super(e);
  }
  add(e, t) {
    if (!(e instanceof I)) {
      throw TypeError(`packet must be an EncodedPacket.`);
    }
    if (e.isMetadataOnly) {
      throw TypeError(`Metadata-only packets cannot be added.`);
    }
    if (t !== undefined && (!t || typeof t != `object`)) {
      throw TypeError(`meta, when provided, must be an object.`);
    }
    this._ensureValidAdd();
    Of(this._connectedTrack, e);
    return this._connectedTrack.output._muxer.addEncodedVideoPacket(this._connectedTrack, e, t);
  }
};
var Af = class {
  setError(e) {
    this.error = e;
    this.errorSet ||= true;
  }
  constructor(e, t) {
    this.source = e;
    this.encodingConfig = t;
    this.ensureEncoderPromise = null;
    this.encoderInitialized = false;
    this.encoder = null;
    this.muxer = null;
    this.lastMultipleOfKeyFrameInterval = -1;
    this.emittedEncoderPackets = 0;
    this.codedWidth = null;
    this.codedHeight = null;
    this.outputWidth = null;
    this.outputHeight = null;
    this.frameRateLastSample = null;
    this.frameRateLastTimestamp = null;
    this.frameRateLastEndTimestamp = null;
    this.preciseTimings = [];
    this.customEncoder = null;
    this.customEncoderCallSerializer = new ke();
    this.customEncoderQueueSize = 0;
    this.alphaEncoder = null;
    this.splitter = null;
    this.splitterCreationFailed = false;
    this.alphaFrameQueue = [];
    this.error = null;
    this.errorSet = false;
    this.lastMuxerPromise = Promise.resolve();
    this.closed = false;
  }
  async add(e, t, r) {
    let i = e;
    try {
      this.checkForEncoderError();
      this.source._ensureValidAdd();
      let a = this.encodingConfig;
      let o = a.sizeChangeBehavior ?? `deny`;
      let s = false;
      if (this.codedWidth !== null && this.codedHeight !== null) {
        s = true;
        if ((e.codedWidth !== this.codedWidth || e.codedHeight !== this.codedHeight) && o === `deny`) {
          throw Error(`Video sample size must remain constant. Expected ${this.codedWidth}x${this.codedHeight}, got ${e.codedWidth}x${e.codedHeight}. To allow the sample size to change over time, set \`sizeChangeBehavior\` to a value other than 'deny' in the encoding options.`);
        }
      } else {
        this.codedWidth = e.codedWidth;
        this.codedHeight = e.codedHeight;
      }
      if (a.transform?.width !== undefined || a.transform?.height !== undefined || a.transform?.rotate !== undefined || a.transform?.crop !== undefined || a.transform?.force === true || s && o !== `passThrough`) {
        let r = a.transform?.width;
        let i = a.transform?.height;
        let c = a.transform?.fit ?? `fill`;
        if (s && o !== `passThrough`) {
          n(this.outputWidth);
          n(this.outputHeight);
          n(o !== `deny`);
          r = this.outputWidth;
          i = this.outputHeight;
          c = o;
        }
        let l = await e.transform({
          width: r,
          height: i,
          roundDimensionsTo: 2,
          crop: a.transform?.crop,
          rotate: a.transform?.rotate,
          fit: c,
          alpha: a.alpha
        });
        if (this.outputWidth === null || this.outputHeight === null) {
          this.outputWidth = l.displayWidth;
          this.outputHeight = l.displayHeight;
        }
        if (t) {
          e.close();
        }
        e = l;
        t = true;
      } else if (this.outputWidth === null || this.outputHeight === null) {
        this.outputWidth = e.codedWidth;
        this.outputHeight = e.codedHeight;
      }
      let c = a.transform?.frameRate;
      if (c !== undefined) {
        let n = e.timestamp + e.duration;
        let a = be(e.timestamp, c);
        if (this.frameRateLastSample !== null) {
          if (a <= this.frameRateLastTimestamp) {
            this.frameRateLastSample.close();
            this.frameRateLastSample = e.clone();
            this.frameRateLastEndTimestamp = n;
            return;
          } else {
            await this.padFrameRate(a, r);
          }
        }
        if (e === i) {
          e = e.clone();
          t = true;
        }
        e.setTimestamp(a);
        e.setDuration(1 / c);
        this.frameRateLastSample?.close();
        this.frameRateLastSample = e.clone();
        this.frameRateLastTimestamp = a;
        this.frameRateLastEndTimestamp = n;
      }
      await this.processAndEncode(e, r);
    } finally {
      if (t) {
        e.close();
      }
    }
  }
  async processAndEncode(e, t) {
    let r = this.encodingConfig;
    let i;
    if (r.transform?.process) {
      let t = r.transform.process(e);
      if (t instanceof Promise) {
        t = await t;
      }
      if (t === null) {
        return;
      }
      if (!Array.isArray(t)) {
        t = [t];
      }
      i = t.map(t => {
        if (t instanceof _cmp_xs) {
          return t;
        } else {
          if (typeof VideoFrame < `u` && t instanceof VideoFrame) {
            return new _cmp_xs(t);
          } else {
            return new _cmp_xs(t, {
              timestamp: e.timestamp,
              duration: e.duration
            });
          }
        }
      });
    } else {
      i = [e];
    }
    try {
      for (let e of i) {
        if (!this.encoderInitialized) {
          if (!this.ensureEncoderPromise) {
            this.ensureEncoder(e);
          }
          if (!this.encoderInitialized) {
            await this.ensureEncoderPromise;
          }
        }
        n(this.encoderInitialized);
        if (this.closed) {
          break;
        }
        let r = this.encodingConfig.keyFrameInterval ?? 2;
        let i = Math.floor(e.timestamp / r);
        let a = {
          ...e.encodeOptions,
          ...t
        };
        let o = {
          ...a,
          keyFrame: a.keyFrame === undefined ? r === 0 || i !== this.lastMultipleOfKeyFrameInterval : a.keyFrame
        };
        this.lastMultipleOfKeyFrameInterval = i;
        this.encodingConfig.onEncodedSample?.(e);
        if (this.customEncoder) {
          this.customEncoderQueueSize++;
          let t = e.clone();
          let n = this.customEncoderCallSerializer.call(() => {
            return this.customEncoder.encode(t, o);
          }).catch(e => {
            return this.setError(e);
          }).finally(() => {
            this.customEncoderQueueSize--;
            t.close();
          });
          if (this.customEncoderQueueSize >= 4) {
            await n;
          }
        } else {
          n(this.encoder);
          let t = e.toVideoFrame();
          let r = T(this.preciseTimings, t.timestamp, e => {
            return e.microsecondTimestamp;
          });
          let i = r === -1 ? null : this.preciseTimings[r];
          if (i && i.microsecondTimestamp === t.timestamp) {
            if (i.timestamp !== e.timestamp) {
              i.timestampIsValid = false;
            }
            if (i.duration !== e.duration) {
              i.durationIsValid = false;
            }
          } else {
            this.preciseTimings.splice(r + 1, 0, {
              microsecondTimestamp: t.timestamp,
              timestamp: e.timestamp,
              duration: e.duration,
              timestampIsValid: true,
              durationIsValid: true
            });
            if (this.preciseTimings.length > 128) {
              this.preciseTimings.shift();
            }
          }
          if (!this.alphaEncoder) {
            this.encoder.encode(t, o);
            t.close();
          } else if (t.format && !t.format.includes(`A`) || this.splitterCreationFailed) {
            this.alphaFrameQueue.push(null);
            this.encoder.encode(t, o);
            t.close();
          } else {
            this.splitter ||= new Mf();
            let {
              colorFrame: e,
              alphaFrame: n
            } = await this.splitter.split(t);
            this.alphaFrameQueue.push(n);
            this.encoder.encode(e, o);
            e.close();
          }
          if (this.encoder.encodeQueueSize >= 4) {
            await new Promise(e => {
              return this.encoder.addEventListener(`dequeue`, e, {
                once: true
              });
            });
          }
        }
        await this.lastMuxerPromise;
      }
    } finally {
      for (let t of i) {
        if (t !== e) {
          t.close();
        }
      }
    }
  }
  async padFrameRate(e, t) {
    let r = this.encodingConfig.transform.frameRate;
    n(this.frameRateLastSample);
    let i = Math.round((e - this.frameRateLastTimestamp) * r);
    for (let e = 1; e < i; e++) {
      let n = this.frameRateLastSample.clone();
      n.setTimestamp(this.frameRateLastTimestamp + e / r);
      n.setDuration(1 / r);
      await this.processAndEncode(n, t);
      n.close();
    }
  }
  ensureEncoder(e) {
    this.ensureEncoderPromise = (async () => {
      let t = $s({
        ...this.encodingConfig,
        width: e.codedWidth,
        height: e.codedHeight,
        squarePixelWidth: e.squarePixelWidth,
        squarePixelHeight: e.squarePixelHeight,
        framerate: this.source._connectedTrack?.metadata.frameRate
      });
      this.encodingConfig.onEncoderConfig?.(t);
      let r = Ec.find(e => {
        return e.supports(this.encodingConfig.codec, t);
      });
      if (r) {
        this.customEncoder = new r();
        this.customEncoder.codec = this.encodingConfig.codec;
        this.customEncoder.config = t;
        this.customEncoder.onPacket = (e, t) => {
          if (!(e instanceof I)) {
            throw TypeError(`The first argument passed to onPacket must be an EncodedPacket.`);
          }
          if (t !== undefined && (!t || typeof t != `object`)) {
            throw TypeError(`The second argument passed to onPacket must be an object or undefined.`);
          }
          Of(this.source._connectedTrack, e);
          this.encodingConfig.onEncodedPacket?.(e, t);
          this.lastMuxerPromise = this.muxer.addEncodedVideoPacket(this.source._connectedTrack, e, t).catch(e => {
            this.setError(e);
          });
        };
        this.customEncoder.onError = e => {
          this.setError(e);
        };
        await this.customEncoder.init();
      } else {
        if (typeof VideoEncoder > `u`) {
          throw Error(`VideoEncoder is not supported by this browser.`);
        }
        t.alpha = `discard`;
        if (this.encodingConfig.alpha === `keep`) {
          t.latencyMode = `quality`;
        }
        if ((t.width % 2 == 1 || t.height % 2 == 1) && (this.encodingConfig.codec === `avc` || this.encodingConfig.codec === `hevc`)) {
          throw Error(`The dimensions ${t.width}x${t.height} are not supported for codec '${this.encodingConfig.codec}'; both width and height must be even numbers. Make sure to round your dimensions to the nearest even number.`);
        }
        if (!(await VideoEncoder.isConfigSupported(t)).supported) {
          throw Error(`This specific encoder configuration (${t.codec}, ${t.bitrate} bps, ${t.width}x${t.height}, hardware acceleration: ${t.hardwareAcceleration ?? `no-preference`}) is not supported by this browser. Consider using another codec or changing your video parameters.`);
        }
        let e = [];
        let r = [];
        let i = 0;
        let a = 0;
        let o = (e, t, n) => {
          let r = {};
          if (t) {
            let e = new Uint8Array(t.byteLength);
            t.copyTo(e);
            r.alpha = e;
          }
          let i = I.fromEncodedChunk(e, r);
          let a = T(this.preciseTimings, e.timestamp, e => {
            return e.microsecondTimestamp;
          });
          let o = a === -1 ? null : this.preciseTimings[a];
          let s = null;
          if (this.emittedEncoderPackets === 0 && i.type === `delta` && n?.decoderConfig) {
            s = rr(this.encodingConfig.codec, n.decoderConfig, i.data);
          }
          if (o && o.microsecondTimestamp === e.timestamp || s !== null) {
            i = i.clone({
              timestamp: o?.timestampIsValid ? o.timestamp : undefined,
              duration: o?.durationIsValid ? o.duration : undefined,
              type: s ?? undefined
            });
          }
          Of(this.source._connectedTrack, i);
          this.encodingConfig.onEncodedPacket?.(i, n);
          this.lastMuxerPromise = this.muxer.addEncodedVideoPacket(this.source._connectedTrack, i, n).catch(e => {
            this.setError(e);
          });
          this.emittedEncoderPackets++;
        };
        let s = Error(`Encoding error`).stack;
        this.encoder = new VideoEncoder({
          output: (t, s) => {
            if (!this.alphaEncoder) {
              o(t, null, s);
              return;
            }
            let c = this.alphaFrameQueue.shift();
            n(c !== undefined);
            if (c) {
              this.alphaEncoder.encode(c, {
                keyFrame: t.type === `key`
              });
              a++;
              c.close();
              e.push({
                chunk: t,
                meta: s
              });
            } else if (a === 0) {
              o(t, null, s);
            } else {
              r.push(i + a);
              e.push({
                chunk: t,
                meta: s
              });
            }
          },
          error: e => {
            e.stack = s;
            this.setError(e);
          }
        });
        this.encoder.configure(t);
        if (this.encodingConfig.alpha === `keep`) {
          let s = Error(`Encoding error`).stack;
          this.alphaEncoder = new VideoEncoder({
            output: (t, s) => {
              a--;
              let c = e.shift();
              n(c !== undefined);
              o(c.chunk, t, c.meta);
              i++;
              while (r.length > 0 && r[0] === i) {
                r.shift();
                let t = e.shift();
                n(t !== undefined);
                o(t.chunk, null, t.meta);
              }
            },
            error: e => {
              e.stack = s;
              this.setError(e);
            }
          });
          this.alphaEncoder.configure(t);
        }
      }
      n(this.source._connectedTrack);
      this.muxer = this.source._connectedTrack.output._muxer;
      this.encoderInitialized = true;
    })();
  }
  async flushAndClose(e) {
    if (!e) {
      this.checkForEncoderError();
    }
    if (!e && this.frameRateLastSample) {
      let e = this.encodingConfig.transform.frameRate;
      let t = be(this.frameRateLastEndTimestamp, e);
      await this.padFrameRate(t);
    }
    this.closed = true;
    this.frameRateLastSample?.close();
    this.frameRateLastSample = null;
    if (this.customEncoder) {
      if (!e) {
        this.customEncoderCallSerializer.call(() => {
          return this.customEncoder.flush();
        });
      }
      await this.customEncoderCallSerializer.call(() => {
        return this.customEncoder.close();
      });
    } else if (this.encoder) {
      if (!e) {
        await this.encoder.flush();
        await this.alphaEncoder?.flush();
        await ct(25);
      }
      if (this.encoder.state !== `closed`) {
        this.encoder.close();
      }
      if (this.alphaEncoder && this.alphaEncoder.state !== `closed`) {
        this.alphaEncoder.close();
      }
      this.alphaFrameQueue.forEach(e => {
        return e?.close();
      });
      this.splitter?.close();
    }
    if (!e) {
      this.checkForEncoderError();
    }
  }
  getQueueSize() {
    if (this.customEncoder) {
      return this.customEncoderQueueSize;
    } else {
      return this.encoder?.encodeQueueSize ?? 0;
    }
  }
  checkForEncoderError() {
    if (this.errorSet) {
      throw this.error;
    }
  }
};
var jf = null;
var Mf = class {
  constructor() {
    this.worker = null;
    this.pendingRequests = new Map();
    this.nextRequestId = 0;
  }
  split(e) {
    if (!this.worker) {
      if (!jf) {
        let e = new Blob([`(${Nf.toString()})()`], {
          type: `application/javascript`
        });
        jf = URL.createObjectURL(e);
      }
      this.worker = new Worker(jf);
      this.worker.addEventListener(`message`, e => {
        let t = e.data;
        let n = this.pendingRequests.get(t.id);
        if (n) {
          this.pendingRequests.delete(t.id);
          if (`error` in t) {
            n.reject(Error(t.error));
          } else {
            n.resolve({
              colorFrame: t.colorFrame,
              alphaFrame: t.alphaFrame
            });
          }
        }
      });
      this.worker.addEventListener(`error`, e => {
        let t = Error(e.message || `Color/alpha splitter worker error.`);
        for (let e of this.pendingRequests.values()) {
          e.reject(t);
        }
        this.pendingRequests.clear();
      });
    }
    let t = this.nextRequestId++;
    let n = E();
    this.pendingRequests.set(t, n);
    this.worker.postMessage({
      id: t,
      sourceFrame: e
    }, {
      transfer: [e]
    });
    return n.promise;
  }
  close() {
    this.worker?.terminate();
    this.worker = null;
    let e = Error(`Color/alpha splitter closed.`);
    for (let t of this.pendingRequests.values()) {
      t.reject(e);
    }
    this.pendingRequests.clear();
  }
};
var Nf = () => {
  let e = null;
  let t = Promise.resolve();
  self.addEventListener(`message`, e => {
    let {
      id: r,
      sourceFrame: i
    } = e.data;
    t = t.then(async () => {
      try {
        let {
          colorFrame: e,
          alphaFrame: t
        } = await n(i);
        self.postMessage({
          id: r,
          colorFrame: e,
          alphaFrame: t
        }, {
          transfer: [e, t]
        });
      } catch (e) {
        self.postMessage({
          id: r,
          error: e.message
        });
      } finally {
        i.close();
      }
    });
  });
  let n = async t => {
    let n = t.format;
    if (!n) {
      throw Error(`CPU color/alpha splitting requires a known VideoFrame format.`);
    }
    let a = t.allocationSize();
    if (!e || e.byteLength !== a) {
      e = new Uint8Array(a);
    }
    await t.copyTo(e);
    if (n === `RGBA` || n === `BGRA`) {
      return r(e, n, t);
    }
    if (n === `I420A` || n === `I420AP10` || n === `I420AP12` || n === `I422A` || n === `I422AP10` || n === `I422AP12` || n === `I444A` || n === `I444AP10` || n === `I444AP12`) {
      return i(e, n, t);
    }
    throw Error(`CPU color/alpha splitting does not support format '${n}'.`);
  };
  let r = (e, t, n) => {
    let r = n.visibleRect?.width ?? n.codedWidth;
    let i = n.visibleRect?.height ?? n.codedHeight;
    let a = r * i;
    let o = a + Math.ceil(r / 2) * Math.ceil(i / 2) * 2;
    let s = new Uint8Array(o);
    t++;
    for (let t = 0, n = 3; t < a; n += 4) {
      s[t] = e[n];
    }
    s.fill(128, a);
    let c = new VideoFrame(e, {
      format: t === `RGBA` ? `RGBX` : `BGRX`,
      codedWidth: r,
      codedHeight: i,
      timestamp: n.timestamp,
      duration: n.duration ?? undefined
    });
    let l = {
      format: `I420`,
      codedWidth: r,
      codedHeight: i,
      timestamp: n.timestamp,
      duration: n.duration ?? undefined,
      transfer: [s.buffer]
    };
    return {
      colorFrame: c,
      alphaFrame: new VideoFrame(s, l)
    };
  };
  let i = (e, t, n) => {
    let r = n.visibleRect?.width ?? n.codedWidth;
    let i = n.visibleRect?.height ?? n.codedHeight;
    let a = t.includes(`P10`);
    let o = t.includes(`P12`);
    let s = a || o ? 2 : 1;
    let c;
    let l;
    if (t.startsWith(`I420`)) {
      c = Math.ceil(r / 2);
      l = Math.ceil(i / 2);
    } else if (t.startsWith(`I422`)) {
      c = Math.ceil(r / 2);
      l = i;
    } else {
      c = r;
      l = i;
    }
    let u = r * i;
    let d = c * l;
    let f = u * s;
    let p = d * s;
    let m = u * s;
    let h = f + p * 2;
    let g = t.replace(`A`, ``);
    let _ = Math.ceil(r / 2) * Math.ceil(i / 2);
    let v = m + _ * s * 2;
    let y = new Uint8Array(v);
    let b = h;
    y.set(e.subarray(b, b + m), 0);
    let x = m;
    let S = a ? 512 : o ? 2048 : 128;
    if (s === 1) {
      y.fill(S, x);
    } else {
      new Uint16Array(y.buffer, x, _ * 2).fill(S);
    }
    let C = a ? `I420P10` : o ? `I420P12` : `I420`;
    let ee = new VideoFrame(e.subarray(0, h), {
      format: g,
      codedWidth: r,
      codedHeight: i,
      timestamp: n.timestamp,
      duration: n.duration ?? undefined
    });
    let w = {
      format: C,
      codedWidth: r,
      codedHeight: i,
      timestamp: n.timestamp,
      duration: n.duration ?? undefined,
      transfer: [y.buffer]
    };
    return {
      colorFrame: ee,
      alphaFrame: new VideoFrame(y, w)
    };
  };
};
var Pf = class extends Df {
  constructor(e) {
    Zs(e);
    super(e.codec);
    this._encoder = new Af(this, e);
  }
  add(e, t) {
    if (!(e instanceof _cmp_xs)) {
      throw TypeError(`videoSample must be a VideoSample.`);
    }
    return this._encoder.add(e, false, t);
  }
  _flushAndClose(e) {
    return this._encoder.flushAndClose(e);
  }
};
var Ff = class extends Df {
  constructor(e, t) {
    if ((!(typeof HTMLCanvasElement < `u`) || !(e instanceof HTMLCanvasElement)) && (!(typeof OffscreenCanvas < `u`) || !(e instanceof OffscreenCanvas))) {
      throw TypeError(`canvas must be an HTMLCanvasElement or OffscreenCanvas.`);
    }
    Zs(t);
    super(t.codec);
    this._encoder = new Af(this, t);
    this._canvas = e;
  }
  add(e, t = 0, n) {
    if (!Number.isFinite(e) || e < 0) {
      throw TypeError(`timestamp must be a non-negative number.`);
    }
    if (!Number.isFinite(t) || t < 0) {
      throw TypeError(`duration must be a non-negative number.`);
    }
    let r = new _cmp_xs(this._canvas, {
      timestamp: e,
      duration: t
    });
    return this._encoder.add(r, true, n);
  }
  _flushAndClose(e) {
    return this._encoder.flushAndClose(e);
  }
};
var Lf = class extends Ef {
  constructor(e) {
    super();
    this._connectedTrack = null;
    if (!N.includes(e)) {
      throw TypeError(`Invalid audio codec '${e}'. Must be one of: ${N.join(`, `)}.`);
    }
    this._codec = e;
  }
};
var Rf = class extends Lf {
  constructor(e) {
    super(e);
  }
  add(e, t) {
    if (!(e instanceof I)) {
      throw TypeError(`packet must be an EncodedPacket.`);
    }
    if (e.isMetadataOnly) {
      throw TypeError(`Metadata-only packets cannot be added.`);
    }
    if (t !== undefined && (!t || typeof t != `object`)) {
      throw TypeError(`meta, when provided, must be an object.`);
    }
    this._ensureValidAdd();
    return this._connectedTrack.output._muxer.addEncodedAudioPacket(this._connectedTrack, e, t);
  }
};
var zf = class {
  setError(e) {
    this.error = e;
    this.errorSet ||= true;
  }
  constructor(e, t) {
    this.source = e;
    this.encodingConfig = t;
    this.ensureEncoderPromise = null;
    this.encoderInitialized = false;
    this.encoder = null;
    this.muxer = null;
    this.lastNumberOfChannels = null;
    this.lastSampleRate = null;
    this.isPcmEncoder = false;
    this.outputSampleSize = null;
    this.writeOutputValue = null;
    this.customEncoder = null;
    this.customEncoderCallSerializer = new ke();
    this.customEncoderQueueSize = 0;
    this.lastEndSampleIndex = null;
    this.resampler = null;
    this.error = null;
    this.errorSet = false;
    this.lastMuxerPromise = Promise.resolve();
    this.closed = false;
  }
  async add(e, t) {
    try {
      this.checkForEncoderError();
      this.source._ensureValidAdd();
      if (this.lastNumberOfChannels !== null && this.lastSampleRate !== null) {
        if (e.numberOfChannels !== this.lastNumberOfChannels || e.sampleRate !== this.lastSampleRate) {
          throw Error(`Audio parameters must remain constant. Expected ${this.lastNumberOfChannels} channels at ${this.lastSampleRate} Hz, got ${e.numberOfChannels} channels at ${e.sampleRate} Hz.`);
        }
      } else {
        this.lastNumberOfChannels = e.numberOfChannels;
        this.lastSampleRate = e.sampleRate;
      }
      let n = this.encodingConfig;
      if (n.transform?.numberOfChannels !== undefined || n.transform?.sampleRate !== undefined) {
        this.resampler ||= new Tf({
          targetNumberOfChannels: n.transform.numberOfChannels ?? e.numberOfChannels,
          targetSampleRate: n.transform.sampleRate ?? e.sampleRate,
          onSample: async e => {
            await this.processAndEncode(e, true);
          }
        });
        await this.resampler.add(e);
      } else {
        await this.processAndEncode(e, t);
      }
    } finally {
      if (t) {
        e.close();
      }
    }
  }
  async processAndEncode(e, t) {
    let n = this.encodingConfig;
    if (n.transform?.sampleFormat !== undefined && Ks(e.format) !== n.transform.sampleFormat) {
      let r = Js(e, n.transform.sampleFormat);
      if (t) {
        e.close();
      }
      e = r;
      t = true;
    }
    if (n.transform?.process) {
      let r = n.transform.process(e);
      if (r instanceof Promise) {
        r = await r;
      }
      if (r === null) {
        return;
      }
      if (!Array.isArray(r)) {
        r = [r];
      }
      for (let e of r) {
        if (!(e instanceof Bs)) {
          throw TypeError(`The audio process function must return an AudioSample, null, or an array of AudioSamples.`);
        }
        await this.encodeSample(e, true);
      }
      if (t) {
        e.close();
      }
    } else {
      await this.encodeSample(e, t);
    }
  }
  async encodeSample(e, t) {
    try {
      if (!this.encoderInitialized) {
        if (!this.ensureEncoderPromise) {
          this.ensureEncoder(e);
        }
        if (!this.encoderInitialized) {
          await this.ensureEncoderPromise;
        }
      }
      n(this.encoderInitialized);
      if (this.closed) {
        return;
      }
      {
        let t = Math.round(e.timestamp * e.sampleRate);
        let n = Math.round((e.timestamp + e.duration) * e.sampleRate);
        if (this.lastEndSampleIndex === null) {
          this.lastEndSampleIndex = n;
        } else {
          let n = t - this.lastEndSampleIndex;
          if (n >= 64) {
            let t = new Bs({
              data: new Float32Array(n * e.numberOfChannels),
              format: `f32-planar`,
              sampleRate: e.sampleRate,
              numberOfChannels: e.numberOfChannels,
              numberOfFrames: n,
              timestamp: this.lastEndSampleIndex / e.sampleRate
            });
            await this.encodeSample(t, true);
          }
          this.lastEndSampleIndex += e.numberOfFrames;
        }
      }
      this.encodingConfig.onEncodedSample?.(e);
      if (this.customEncoder) {
        this.customEncoderQueueSize++;
        let t = e.clone();
        let n = this.customEncoderCallSerializer.call(() => {
          return this.customEncoder.encode(t);
        }).catch(e => {
          return this.setError(e);
        }).finally(() => {
          this.customEncoderQueueSize--;
          t.close();
        });
        if (this.customEncoderQueueSize >= 4) {
          await n;
        }
        await this.lastMuxerPromise;
      } else if (this.isPcmEncoder) {
        await this.doPcmEncoding(e, t);
      } else {
        n(this.encoder);
        let r = e.toAudioData();
        this.encoder.encode(r);
        r.close();
        if (t) {
          e.close();
        }
        if (this.encoder.encodeQueueSize >= 4) {
          await new Promise(e => {
            return this.encoder.addEventListener(`dequeue`, e, {
              once: true
            });
          });
        }
        await this.lastMuxerPromise;
      }
    } finally {
      if (t) {
        e.close();
      }
    }
  }
  async doPcmEncoding(e, t) {
    n(this.outputSampleSize);
    n(this.writeOutputValue);
    let {
      numberOfChannels: r,
      numberOfFrames: i,
      sampleRate: a,
      timestamp: o
    } = e;
    let s = 2048;
    let c = [];
    for (let t = 0; t < i; t += s) {
      let n = Math.min(s, e.numberOfFrames - t);
      let i = n * r * this.outputSampleSize;
      let a = new ArrayBuffer(i);
      let o = new DataView(a);
      c.push({
        frameCount: n,
        view: o
      });
    }
    let l = e.allocationSize({
      planeIndex: 0,
      format: `f32-planar`
    });
    let u = new Float32Array(l / Float32Array.BYTES_PER_ELEMENT);
    for (let t = 0; t < r; t++) {
      e.copyTo(u, {
        planeIndex: t,
        format: `f32-planar`
      });
      for (let e = 0; e < c.length; e++) {
        let {
          frameCount: n,
          view: i
        } = c[e];
        for (let a = 0; a < n; a++) {
          this.writeOutputValue(i, (a * r + t) * this.outputSampleSize, u[e * s + a]);
        }
      }
    }
    if (t) {
      e.close();
    }
    let d = {
      decoderConfig: {
        codec: this.encodingConfig.codec,
        numberOfChannels: r,
        sampleRate: a
      }
    };
    for (let e = 0; e < c.length; e++) {
      let {
        frameCount: t,
        view: n
      } = c[e];
      let r = n.buffer;
      let i = e * s;
      let l = new I(new Uint8Array(r), `key`, o + i / a, t / a);
      this.encodingConfig.onEncodedPacket?.(l, d);
      await this.muxer.addEncodedAudioPacket(this.source._connectedTrack, l, d);
    }
  }
  ensureEncoder(e) {
    this.ensureEncoderPromise = (async () => {
      let {
        numberOfChannels: t,
        sampleRate: r
      } = e;
      let a = nc({
        numberOfChannels: t,
        sampleRate: r,
        ...this.encodingConfig
      });
      this.encodingConfig.onEncoderConfig?.(a);
      let o = Dc.find(e => {
        return e.supports(this.encodingConfig.codec, a);
      });
      if (o) {
        this.customEncoder = new o();
        this.customEncoder.codec = this.encodingConfig.codec;
        this.customEncoder.config = a;
        this.customEncoder.onPacket = (e, t) => {
          if (!(e instanceof I)) {
            throw TypeError(`The first argument passed to onPacket must be an EncodedPacket.`);
          }
          if (t !== undefined && (!t || typeof t != `object`)) {
            throw TypeError(`The second argument passed to onPacket must be an object or undefined.`);
          }
          this.encodingConfig.onEncodedPacket?.(e, t);
          this.lastMuxerPromise = this.muxer.addEncodedAudioPacket(this.source._connectedTrack, e, t).catch(e => {
            this.setError(e);
          });
        };
        this.customEncoder.onError = e => {
          this.setError(e);
        };
        await this.customEncoder.init();
      } else if (M.includes(this.encodingConfig.codec)) {
        this.initPcmEncoder();
      } else {
        if (typeof AudioEncoder > `u`) {
          throw Error(`AudioEncoder is not supported by this browser.`);
        }
        if (!(await AudioEncoder.isConfigSupported(a)).supported) {
          throw Error(`This specific encoder configuration (${a.codec}, ${a.bitrate} bps, ${a.numberOfChannels} channels, ${a.sampleRate} Hz) is not supported by this browser. Consider using another codec or changing your audio parameters.`);
        }
        let e = Error(`Encoding error`).stack;
        this.encoder = new AudioEncoder({
          output: (e, t) => {
            if (this.encodingConfig.codec === `aac` && t?.decoderConfig) {
              let e = false;
              if (!t.decoderConfig.description || t.decoderConfig.description.byteLength < 2) {
                e = true;
              } else {
                e = Ct(l(t.decoderConfig.description)).objectType === 0;
              }
              if (e) {
                let e = Number(i(a.codec.split(`.`)));
                t.decoderConfig.description = wt({
                  objectType: e,
                  numberOfChannels: t.decoderConfig.numberOfChannels,
                  sampleRate: t.decoderConfig.sampleRate
                });
              }
            }
            let n = I.fromEncodedChunk(e);
            n = n.clone({
              timestamp: ve(n.timestamp, a.sampleRate),
              duration: e.duration == null ? undefined : ve(n.duration, a.sampleRate)
            });
            this.encodingConfig.onEncodedPacket?.(n, t);
            this.lastMuxerPromise = this.muxer.addEncodedAudioPacket(this.source._connectedTrack, n, t).catch(e => {
              this.setError(e);
            });
          },
          error: t => {
            t.stack = e;
            this.setError(t);
          }
        });
        this.encoder.configure(a);
      }
      n(this.source._connectedTrack);
      this.muxer = this.source._connectedTrack.output._muxer;
      this.encoderInitialized = true;
    })();
  }
  initPcmEncoder() {
    this.isPcmEncoder = true;
    let e = this.encodingConfig.codec;
    let {
      dataType: t,
      sampleSize: r,
      littleEndian: i
    } = Kt(e);
    this.outputSampleSize = r;
    switch (r) {
      case 1:
        {
          if (t === `unsigned`) {
            this.writeOutputValue = (e, t, n) => {
              return e.setUint8(t, O((n + 1) * 127.5, 0, 255));
            };
          } else if (t === `signed`) {
            this.writeOutputValue = (e, t, n) => {
              e.setInt8(t, O(Math.round(n * 128), -128, 127));
            };
          } else if (t === `ulaw`) {
            this.writeOutputValue = (e, t, n) => {
              let r = O(Math.floor(n * 32767), -32768, 32767);
              e.setUint8(t, Ac(r));
            };
          } else if (t === `alaw`) {
            this.writeOutputValue = (e, t, n) => {
              let r = O(Math.floor(n * 32767), -32768, 32767);
              e.setUint8(t, Mc(r));
            };
          } else {
            n(false);
          }
          break;
        }
      case 2:
        {
          if (t === `unsigned`) {
            this.writeOutputValue = (e, t, n) => {
              return e.setUint16(t, O((n + 1) * 32767.5, 0, 65535), i);
            };
          } else if (t === `signed`) {
            this.writeOutputValue = (e, t, n) => {
              return e.setInt16(t, O(Math.round(n * 32767), -32768, 32767), i);
            };
          } else {
            n(false);
          }
          break;
        }
      case 3:
        {
          if (t === `unsigned`) {
            this.writeOutputValue = (e, t, n) => {
              return fe(e, t, O((n + 1) * 8388607.5, 0, 16777215), i);
            };
          } else if (t === `signed`) {
            this.writeOutputValue = (e, t, n) => {
              return pe(e, t, O(Math.round(n * 8388607), -8388608, 8388607), i);
            };
          } else {
            n(false);
          }
          break;
        }
      case 4:
        {
          if (t === `unsigned`) {
            this.writeOutputValue = (e, t, n) => {
              return e.setUint32(t, O((n + 1) * 2147483647.5, 0, 4294967295), i);
            };
          } else if (t === `signed`) {
            this.writeOutputValue = (e, t, n) => {
              return e.setInt32(t, O(Math.round(n * 2147483647), -2147483648, 2147483647), i);
            };
          } else if (t === `float`) {
            this.writeOutputValue = (e, t, n) => {
              return e.setFloat32(t, n, i);
            };
          } else {
            n(false);
          }
          break;
        }
      case 8:
        {
          if (t === `float`) {
            this.writeOutputValue = (e, t, n) => {
              return e.setFloat64(t, n, i);
            };
          } else {
            n(false);
          }
          break;
        }
      default:
        {
          D(r);
          n(false);
        }
    }
  }
  async flushAndClose(e) {
    if (!e) {
      this.checkForEncoderError();
    }
    if (!e && this.resampler) {
      await this.resampler.finalize();
    }
    this.resampler = null;
    this.closed = true;
    if (this.customEncoder) {
      if (!e) {
        this.customEncoderCallSerializer.call(() => {
          return this.customEncoder.flush();
        });
      }
      await this.customEncoderCallSerializer.call(() => {
        return this.customEncoder.close();
      });
    } else if (this.encoder) {
      if (!e) {
        await this.encoder.flush();
      }
      if (this.encoder.state !== `closed`) {
        this.encoder.close();
      }
    }
    if (!e) {
      this.checkForEncoderError();
    }
  }
  getQueueSize() {
    if (this.customEncoder) {
      return this.customEncoderQueueSize;
    } else if (this.isPcmEncoder) {
      return 0;
    } else {
      return this.encoder?.encodeQueueSize ?? 0;
    }
  }
  checkForEncoderError() {
    if (this.errorSet) {
      throw this.error;
    }
  }
};
var Bf = class extends Lf {
  constructor(e) {
    ec(e);
    super(e.codec);
    this._encoder = new zf(this, e);
  }
  add(e) {
    if (!(e instanceof Bs)) {
      throw TypeError(`audioSample must be an AudioSample.`);
    }
    return this._encoder.add(e, false);
  }
  _flushAndClose(e) {
    return this._encoder.flushAndClose(e);
  }
};
var Vf = class extends Lf {
  constructor(e) {
    ec(e);
    super(e.codec);
    this._accumulatedTime = 0;
    this._encoder = new zf(this, e);
  }
  async add(e) {
    if (!(e instanceof AudioBuffer)) {
      throw TypeError(`audioBuffer must be an AudioBuffer.`);
    }
    let t = Bs._fromAudioBuffer(e, this._accumulatedTime);
    this._accumulatedTime += e.duration;
    for (let e of t) {
      await this._encoder.add(e, true);
    }
  }
  _flushAndClose(e) {
    return this._encoder.flushAndClose(e);
  }
};
var Hf = class extends Lf {
  get errorPromise() {
    this._errorPromiseAccessed = true;
    return this._promiseWithResolvers.promise;
  }
  get paused() {
    return this._paused;
  }
  constructor(e, t, n = {}) {
    if (!(e instanceof MediaStreamTrack) || e.kind !== `audio`) {
      throw TypeError(`track must be an audio MediaStreamTrack.`);
    }
    ec(t);
    if (typeof n != `object` || !n) {
      throw TypeError(`options must be an object.`);
    }
    if (n.timestampBase !== undefined && n.timestampBase !== `synced-zero` && n.timestampBase !== `zero` && n.timestampBase !== `unix`) {
      throw TypeError(`options.timestampBase, when provided, must be one of 'synced-zero', 'zero', or 'unix'.`);
    }
    super(t.codec);
    this._abortController = null;
    this._audioContext = null;
    this._scriptProcessorNode = null;
    this._promiseWithResolvers = E();
    this._errorPromiseAccessed = false;
    this._paused = false;
    this._options = n;
    this._encoder = new zf(this, t);
    this._track = e;
  }
  async _start() {
    if (!this._errorPromiseAccessed) {
      k._warn('Make sure not to ignore the `errorPromise` field on MediaStreamAudioTrackSource, so that any internal errors get bubbled up properly.');
    }
    this._abortController = new AbortController();
    let e = null;
    let t = false;
    let n = null;
    let r = 0;
    let i = i => {
      if (t) {
        i.close();
        return;
      }
      let a = i.timestamp;
      if (this._paused) {
        if (e !== null) {
          if (n !== null && this._options.timestampBase !== `unix`) {
            let e = a - n;
            r -= e;
          }
          n = a;
        }
        i.close();
        return;
      }
      if (e === null) {
        e = i.timestamp;
        let t;
        let n = this._options.timestampBase ?? `synced-zero`;
        if (n === `unix`) {
          t = Date.now() / 1000;
        } else if (n === `zero`) {
          t = 0;
        } else {
          let e = this._connectedTrack.output;
          if (e._firstMediaStreamTimestamp === null) {
            e._firstMediaStreamTimestamp = performance.now() / 1000;
            t = 0;
          } else {
            t = performance.now() / 1000 - e._firstMediaStreamTimestamp;
          }
        }
        r = t - e;
      }
      n = a;
      if (this._encoder.getQueueSize() >= 8) {
        i.close();
        return;
      }
      i.setTimestamp(a + r);
      this._encoder.add(i, true).catch(e => {
        t = true;
        this._abortController?.abort();
        this._promiseWithResolvers.reject(e);
        this._audioContext?.suspend();
      });
    };
    if (typeof MediaStreamTrackProcessor < `u`) {
      let e = new MediaStreamTrackProcessor({
        track: this._track
      });
      let t = new WritableStream({
        write: e => {
          return i(new Bs(e));
        }
      });
      e.readable.pipeTo(t, {
        signal: this._abortController.signal
      }).catch(e => {
        if (!(e instanceof DOMException) || e.name !== `AbortError`) {
          this._promiseWithResolvers.reject(e);
        }
      });
    } else {
      let e = window.AudioContext || window.webkitAudioContext;
      this._audioContext = new e({
        sampleRate: this._track.getSettings().sampleRate
      });
      let t = this._audioContext.createMediaStreamSource(new MediaStream([this._track]));
      this._scriptProcessorNode = this._audioContext.createScriptProcessor(4096);
      if (this._audioContext.state === `suspended`) {
        await this._audioContext.resume();
      }
      t.connect(this._scriptProcessorNode);
      this._scriptProcessorNode.connect(this._audioContext.destination);
      let n = 0;
      this._scriptProcessorNode.onaudioprocess = e => {
        let t = Bs._fromAudioBuffer(e.inputBuffer, n);
        n += e.inputBuffer.duration;
        for (let e of t) {
          i(e);
        }
      };
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
    if (this._audioContext) {
      n(this._scriptProcessorNode);
      this._scriptProcessorNode.disconnect();
      await this._audioContext.suspend();
    }
    await this._encoder.flushAndClose(e);
  }
};
var Uf = () => {
  let e = (e, t) => {
    if (t) {
      self.postMessage(e, {
        transfer: t
      });
    } else {
      self.postMessage(e);
    }
  };
  e({
    type: `support`,
    supported: typeof MediaStreamTrackProcessor < `u`
  });
  let t = new Map();
  let n = new Map();
  self.addEventListener(`message`, r => {
    let i = r.data;
    switch (i.type) {
      case `videoTrack`:
        {
          n.set(i.trackId, i.track);
          let r = new MediaStreamTrackProcessor({
            track: i.track
          });
          let a = new WritableStream({
            write: t => {
              if (!n.has(i.trackId)) {
                t.close();
                return;
              }
              e({
                type: `videoFrame`,
                trackId: i.trackId,
                videoFrame: t
              }, [t]);
            }
          });
          let o = new AbortController();
          t.set(i.trackId, o);
          r.readable.pipeTo(a, {
            signal: o.signal
          }).catch(t => {
            if (!(t instanceof DOMException) || t.name !== `AbortError`) {
              e({
                type: `error`,
                trackId: i.trackId,
                error: t
              });
            }
          });
        }
        break;
      case `stopTrack`:
        {
          let r = t.get(i.trackId);
          if (r) {
            r.abort();
            t.delete(i.trackId);
          }
          n.get(i.trackId)?.stop();
          n.delete(i.trackId);
          e({
            type: `trackStopped`,
            trackId: i.trackId
          });
        }
        break;
      default:
        {
          D(i);
        }
    }
  });
};
var Wf = 0;
var Gf = null;
var Kf = () => {
  let e = new Blob([`(${Uf.toString()})()`], {
    type: `application/javascript`
  });
  let t = URL.createObjectURL(e);
  Gf = new Worker(t);
};
var qf = null;
var Jf = async () => {
  if (qf === null) {
    if (!Gf) {
      Kf();
    }
    return new Promise(e => {
      n(Gf);
      let t = n => {
        let r = n.data;
        if (r.type === `support`) {
          qf = r.supported;
          Gf.removeEventListener(`message`, t);
          e(r.supported);
        }
      };
      Gf.addEventListener(`message`, t);
    });
  } else {
    return qf;
  }
};
var Yf = (e, t) => {
  n(Gf);
  if (t) {
    Gf.postMessage(e, t);
  } else {
    Gf.postMessage(e);
  }
};
var Xf = class extends Ef {
  constructor(e) {
    super();
    this._connectedTrack = null;
    if (!Ot.includes(e)) {
      throw TypeError(`Invalid subtitle codec '${e}'. Must be one of: ${Ot.join(`, `)}.`);
    }
    this._codec = e;
  }
};
var Zf = class extends Xf {
  constructor(e) {
    super(e);
    this._error = null;
    this._errorSet = false;
    this._lastMuxerPromise = Promise.resolve();
    this._parser = new Gl({
      codec: e,
      output: (e, t) => {
        this._lastMuxerPromise = this._connectedTrack.output._muxer.addSubtitleCue(this._connectedTrack, e, t).catch(e => {
          this._setError(e);
        });
      }
    });
  }
  add(e) {
    if (typeof e != `string`) {
      throw TypeError(`text must be a string.`);
    }
    this._checkForError();
    this._ensureValidAdd();
    this._parser.parse(e);
    return this._lastMuxerPromise;
  }
  _setError(e) {
    this._error = e;
    this._errorSet ||= true;
  }
  _checkForError() {
    if (this._errorSet) {
      throw this._error;
    }
  }
  async _flushAndClose(e) {
    if (!e) {
      this._checkForError();
    }
  }
};
var Qf = class extends Il {
  constructor(e, t) {
    if (!(e._target instanceof qd)) {
      throw TypeError('HLS outputs require `OutputOptions.target` to be a PathedTarget.');
    }
    super(e);
    this.trackDatas = [];
    this.isRelativeToUnixEpoch = false;
    this.numWrittenMasterPlaylists = 0;
    this.playlists = [];
    this.playlistDeclarations = [];
    this.format = t;
    this.targetSegmentDuration = t._options.targetDuration ?? 2;
    this.singleFilePerPlaylist = t._options.singleFilePerPlaylist ?? false;
    this.isLive = t._options.live ?? false;
    this.maxLiveSegmentCount = t._options.maxLiveSegmentCount ?? Infinity;
    this.globalTargetDuration = this.targetSegmentDuration;
    this.getPlaylistPath = t._options.getPlaylistPath ?? (({
      n: e
    }) => {
      return `playlist-${e}.m3u8`;
    });
    this.getSegmentPath = t._options.getSegmentPath ?? (e => {
      if (e.isSingleFile) {
        return `segments-${e.playlist.n}${e.format.fileExtension}`;
      } else {
        return `segment-${e.playlist.n}-${e.n}${e.format.fileExtension}`;
      }
    });
    this.getInitPath = t._options.getInitPath ?? (e => {
      return `init-${e.n}${e.segmentFormat.fileExtension}`;
    });
  }
  async start() {
    let e = await this.mutex.acquire();
    let t = this.output._tracks.some(e => {
      return e.metadata.isRelativeToUnixEpoch;
    });
    let r = this.output._tracks.some(e => {
      return !e.metadata.isRelativeToUnixEpoch;
    });
    if (t && r) {
      throw Error('All tracks must agree on `relativeToUnixEpoch`: some tracks are relative to the Unix epoch and some are not.');
    }
    this.isRelativeToUnixEpoch = t;
    let i = new Map();
    let a = [];
    let o = false;
    let s = false;
    let c = false;
    for (let e of this.output._tracks) {
      if (e.type === `video`) {
        o = true;
      }
      let t = new Map();
      for (let n of this.output._tracks) {
        if (e === n || !e.canBePairedWith(n)) {
          continue;
        }
        if (e.type === n.type) {
          k._warn(`Illegal pairing of two ${e.type} tracks detected, which is not possible in HLS; treating them as unpaired.`);
          s ||= true;
          continue;
        }
        if (e.isVideoTrack() && e.metadata.hasOnlyKeyPackets || n.isVideoTrack() && n.metadata.hasOnlyKeyPackets) {
          k._warn(`A key-packets-only video track is pairable with another track, which is not possible in HLS; treating them as unpaired.`);
          c ||= true;
          continue;
        }
        let r = t.get(n.source._codec);
        if (!r) {
          t.set(n.source._codec, r = []);
        }
        r.push(n);
      }
      for (let [, n] of t) {
        let t = n.map(e => {
          return e.id;
        }).join(`-`);
        if (!a.find(e => {
          return e.key === t;
        })) {
          a.push({
            name: `${n[0].type}-${a.length + 1}`,
            key: t,
            tracks: n,
            needsEmit: false,
            firstNoUri: false
          });
        }
        let r = i.get(e);
        if (!r) {
          i.set(e, r = []);
        }
        r.push(t);
      }
    }
    let l = o ? `video` : `audio`;
    let u = [];
    let d = [];
    let f = [];
    for (let e of this.output._tracks) {
      let t = i.get(e);
      if (t) {
        n(t.length > 0);
        if (e.type !== l) {
          continue;
        }
        for (let r of t) {
          let o = a.find(e => {
            return e.key === r;
          });
          n(o);
          if (t.length === 1 && o.tracks.length === 1) {
            let t = i.get(o.tracks[0]);
            n(t !== undefined);
            if (t.length === 1) {
              let r = a.find(e => {
                return e.key === t[0];
              });
              if (r.tracks.length === 1) {
                n(r.tracks[0] === e);
                u.push({
                  tracks: [e, o.tracks[0]],
                  linkedGroup: null
                });
                continue;
              }
            }
          }
          u.push({
            tracks: [e],
            linkedGroup: o
          });
          o.needsEmit = true;
        }
      } else if (e.type === `video`) {
        d.push(e);
      } else if (e.type === `audio`) {
        f.push(e);
      }
    }
    let p = ({
      metadata: e
    }) => {
      let t = ``;
      t += `${e.languageCode ?? `und`}-`;
      t += `${e.name ?? ``}-`;
      t += `${e.disposition?.default ?? true}-`;
      t += `${e.disposition?.primary ?? false}-`;
      t += `${e.disposition?.forced ?? false}-`;
      return t;
    };
    if (d.length > 0) {
      if (new Set(d.map(p)).size > 1) {
        let e = {
          key: d.map(e => {
            return e.id;
          }).join(`-`),
          name: `video-${a.length + 1}`,
          tracks: d,
          needsEmit: true,
          firstNoUri: true
        };
        a.push(e);
        u.push({
          tracks: [d[0]],
          linkedGroup: e
        });
      } else {
        for (let e of d) {
          u.push({
            tracks: [e],
            linkedGroup: null
          });
        }
      }
    }
    if (f.length > 0) {
      if (new Set(f.map(p)).size > 1) {
        let e = {
          key: f.map(e => {
            return e.id;
          }).join(`-`),
          name: `audio-${a.length + 1}`,
          tracks: f,
          needsEmit: true,
          firstNoUri: true
        };
        a.push(e);
        u.push({
          tracks: [f[0]],
          linkedGroup: e
        });
      } else {
        for (let e of f) {
          u.push({
            tracks: [e],
            linkedGroup: null
          });
        }
      }
    }
    let m = e => {
      let t = [];
      let r = 0;
      let i = 0;
      let a = false;
      let o = null;
      let s = -Infinity;
      for (let n of e) {
        if (n.isVideoTrack()) {
          r++;
          a ||= (n.metadata.rotation ?? 0) !== 0;
        } else if (n.isAudioTrack()) {
          i++;
        }
        t.push(n.source._codec);
      }
      for (let e of lt(this.format._options.segmentFormat)) {
        let n = e.getSupportedCodecs();
        let c = e.getSupportedTrackCounts();
        if (t.some(e => {
          return !n.includes(e);
        }) || r < c.video.min || r > c.video.max || i < c.audio.min || i > c.audio.max) {
          continue;
        }
        let l = 0;
        if (a && e.supportsVideoRotationMetadata) {
          l++;
        }
        if (l > s) {
          o = e;
          s = l;
        }
      }
      n(o);
      return o;
    };
    let h = async e => {
      if (e.some(e => {
        return this.playlists.some(t => {
          return t.tracks.includes(e);
        });
      })) {
        throw Error(`Internal error: track is already registered in a playlist.`);
      }
      let t = m(e);
      let n = this.playlists.length + 1;
      let r = await this.getPlaylistPath({
        n,
        tracks: e,
        segmentFormat: t
      });
      $f(r);
      let i = {
        id: this.playlists.length + 1,
        path: r,
        tracks: e,
        segmentFormat: t,
        currentSegmentStartTimestamp: null,
        currentSegmentStartTimestampIsFixed: false,
        nextSegmentId: 1,
        initSegment: null,
        writtenSegments: [],
        peakBitrate: null,
        averageBitrate: null,
        mediaSequence: 0,
        done: false,
        singleFile: null,
        mutex: new C()
      };
      this.playlists.push(i);
      return i;
    };
    for (let e of a) {
      if (e.needsEmit) {
        for (let t = 0; t < e.tracks.length; t++) {
          let n = e.tracks[t];
          let r = this.playlists.find(e => {
            return e.tracks[0].id === n.id;
          });
          r ??= await h([n]);
          this.playlistDeclarations.push({
            playlist: r,
            groupId: e.name,
            noUri: e.firstNoUri && t === 0,
            references: []
          });
        }
      }
    }
    for (let e of u) {
      let t = this.playlists.find(t => {
        return t.tracks[0].id === e.tracks[0].id;
      });
      t ??= await h(e.tracks);
      this.playlistDeclarations.push({
        playlist: t,
        groupId: null,
        noUri: false,
        references: e.linkedGroup ? this.playlistDeclarations.filter(t => {
          return t.groupId === e.linkedGroup.name;
        }) : []
      });
    }
    e();
  }
  async getMimeType() {
    return ka;
  }
  allTracksAreKnown(e) {
    for (let t of e.tracks) {
      if (!t.source._closed && !this.trackDatas.some(e => {
        return e.track === t;
      })) {
        return false;
      }
    }
    return true;
  }
  async onTrackClose(e) {
    let t = this.trackDatas.find(t => {
      return t.track === e;
    });
    if (t) {
      t.closed = true;
    }
    let r = this.playlists.find(t => {
      return t.tracks.includes(e);
    });
    n(r);
    let i = await r.mutex.acquire();
    try {
      await this.advancePlaylist(r);
    } finally {
      i();
    }
  }
  getVideoTrackData(e, t) {
    let r = this.trackDatas.find(t => {
      return t.track === e;
    });
    if (r) {
      return r;
    }
    tn(t);
    n(t);
    n(t?.decoderConfig);
    let i = this.playlists.filter(t => {
      return t.tracks.includes(e);
    });
    n(i.length === 1);
    r = {
      track: e,
      packets: [],
      playlist: i[0],
      closed: false,
      info: {
        type: `video`,
        decoderConfig: t.decoderConfig
      }
    };
    this.trackDatas.push(r);
    return r;
  }
  getAudioTrackData(e, t) {
    let r = this.trackDatas.find(t => {
      return t.track === e;
    });
    if (r) {
      return r;
    }
    rn(t);
    n(t);
    n(t?.decoderConfig);
    let i = this.playlists.filter(t => {
      return t.tracks.includes(e);
    });
    n(i.length === 1);
    r = {
      track: e,
      packets: [],
      playlist: i[0],
      closed: false,
      info: {
        type: `audio`,
        decoderConfig: t.decoderConfig
      }
    };
    this.trackDatas.push(r);
    return r;
  }
  async addEncodedVideoPacket(e, t, n) {
    let r = this.getVideoTrackData(e, n);
    let i = r.playlist;
    let a = await i.mutex.acquire();
    try {
      this.validateTimestamp(e, t.timestamp, t.type === `key`);
      r.packets.push(t);
      if (i.currentSegmentStartTimestamp === null) {
        i.currentSegmentStartTimestamp = t.timestamp;
      } else if (!i.currentSegmentStartTimestampIsFixed) {
        i.currentSegmentStartTimestamp = Math.min(i.currentSegmentStartTimestamp, t.timestamp);
      }
      await this.advancePlaylist(i);
    } finally {
      a();
    }
  }
  async addEncodedAudioPacket(e, t, n) {
    let r = this.getAudioTrackData(e, n);
    let i = r.playlist;
    let a = await i.mutex.acquire();
    try {
      this.validateTimestamp(e, t.timestamp, t.type === `key`);
      r.packets.push(t);
      if (i.currentSegmentStartTimestamp === null) {
        i.currentSegmentStartTimestamp = t.timestamp;
      } else if (!i.currentSegmentStartTimestampIsFixed) {
        i.currentSegmentStartTimestamp = Math.min(i.currentSegmentStartTimestamp, t.timestamp);
      }
      await this.advancePlaylist(i);
    } finally {
      a();
    }
  }
  async addSubtitleCue(e, t, n) {
    throw Error(`Unreachable.`);
  }
  async advancePlaylist(e) {
    n(!e.done);
    if (!this.allTracksAreKnown(e)) {
      return;
    }
    if (e.currentSegmentStartTimestamp === null) {
      await this.onPlaylistDone(e);
      return;
    }
    let t = this.trackDatas.filter(t => {
      return e.tracks.includes(t.track);
    });
    let r = t.find(e => {
      return e.info.type === `video`;
    });
    let i = t.find(e => {
      return e.info.type === `audio`;
    });
    while (true) {
      let a = e.currentSegmentStartTimestamp + this.targetSegmentDuration;
      let o = 0;
      let s = 0;
      if (r && (!r.closed || r.packets.length > 0)) {
        let e = r.packets.every(e => {
          return e.timestamp < a;
        });
        let t = null;
        let c = null;
        if (e) {
          if (!r.closed) {
            return;
          }
        } else {
          for (let e = 0; e < r.packets.length; e++) {
            let n = r.packets[e];
            if (t !== null && n.timestamp > a) {
              break;
            }
            if (e > 0 && n.type === `key`) {
              t = n;
              c = e;
            }
          }
        }
        if (c !== null) {
          o = c;
          if (i) {
            let e = i.packets.findIndex(e => {
              return e.timestamp >= t.timestamp;
            });
            if (e !== -1) {
              s = e;
            } else if (i.closed) {
              s = i.packets.length;
            } else {
              return;
            }
          }
        } else {
          if (!r.closed) {
            return;
          }
          o = r.packets.length;
          let e = Xe(r.packets, e => {
            return e.timestamp;
          });
          let t = r.packets[e];
          n(t);
          if (i) {
            if (t.timestamp < a) {
              let e = i.packets.findIndex(e => {
                return e.timestamp >= a;
              });
              if (e !== -1) {
                s = e;
              } else if (i.closed) {
                s = i.packets.length;
              } else {
                return;
              }
            } else {
              let e = i.packets.findIndex(e => {
                return e.timestamp > t.timestamp;
              });
              if (e !== -1) {
                s = e;
              } else if (i.closed) {
                s = i.packets.length;
              } else {
                return;
              }
            }
          }
        }
      } else if (i && (!i.closed || i.packets.length > 0)) {
        if (i.packets.every(e => {
          return e.timestamp < a;
        })) {
          if (i.closed) {
            s = i.packets.length;
          } else {
            return;
          }
        } else {
          let e = se(i.packets, e => {
            return e.timestamp <= a;
          });
          s = Math.max(e, 1);
        }
      }
      if (o === 0 && s === 0) {
        if (t.every(e => {
          return e.closed;
        })) {
          await this.onPlaylistDone(e);
        }
        return;
      }
      let c = null;
      let l;
      let u;
      n(this.output._target instanceof qd);
      let d = this.output._target;
      if (this.singleFilePerPlaylist) {
        if (e.singleFile === null) {
          let t = {
            n: e.nextSegmentId,
            format: e.segmentFormat,
            isSingleFile: true,
            playlist: np(e)
          };
          l = await this.getSegmentPath(t);
          ep(l);
          u = qe(qe(d.rootPath, e.path), l);
          let n = await this.output._getTarget({
            path: u,
            isRoot: false,
            mimeType: e.segmentFormat.mimeType
          });
          n._start();
          e.singleFile = {
            target: n,
            path: l,
            nextOffset: 0,
            info: t
          };
        } else {
          l = e.singleFile.path;
          u = qe(qe(d.rootPath, e.path), l);
        }
      } else {
        c = {
          n: e.nextSegmentId,
          format: e.segmentFormat,
          isSingleFile: false,
          playlist: np(e)
        };
        l = await this.getSegmentPath(c);
        ep(l);
        u = qe(qe(d.rootPath, e.path), l);
        e.nextSegmentId++;
      }
      let f = 0;
      let p = null;
      let m = new wp({
        format: e.segmentFormat,
        target: new qd(u, async t => {
          let n = {
            ...t,
            isRoot: false
          };
          if (t.isRoot) {
            if (e.singleFile) {
              let t = e.singleFile.target.slice(e.singleFile.nextOffset);
              t.on(`write`, ({
                end: e
              }) => {
                return f = Math.max(f, e);
              });
              return t;
            } else {
              let e = await this.output._getTarget(n);
              p = e;
              e.on(`write`, ({
                end: e
              }) => {
                return f = Math.max(f, e);
              });
              return e;
            }
          }
          return this.output._getTarget(n);
        }),
        initTarget: async () => {
          if (e.initSegment) {
            return new Gd();
          }
          if (e.singleFile) {
            e.initSegment = {
              path: e.singleFile.path,
              duration: 0,
              timestamp: 0,
              byteSize: 0,
              byteOffset: 0,
              info: null
            };
            let t = e.singleFile.target.slice(e.singleFile.nextOffset);
            t.on(`write`, ({
              end: t
            }) => {
              e.initSegment.byteSize = Math.max(e.initSegment.byteSize, t);
            });
            t.on(`finalized`, () => {
              e.singleFile.nextOffset = e.initSegment.byteSize;
            });
            return t;
          } else {
            let t = np(e);
            let n = await this.getInitPath(t);
            tp(n);
            e.initSegment = {
              path: n,
              duration: 0,
              timestamp: 0,
              byteSize: 0,
              byteOffset: null,
              info: null
            };
            let r = qe(qe(d.rootPath, e.path), n);
            let i = await this.output._getTarget({
              path: r,
              isRoot: false,
              mimeType: e.segmentFormat.mimeType
            });
            i.on(`write`, ({
              end: t
            }) => {
              e.initSegment.byteSize = Math.max(e.initSegment.byteSize, t);
            });
            i.on(`finalized`, () => {
              this.format._options.onInit?.(i, t);
            });
            return i;
          }
        }
      });
      let h = -Infinity;
      try {
        let e = null;
        let t = null;
        if (r) {
          e = new kf(r.track.source._codec);
          m.addVideoTrack(e, r.track.metadata);
        }
        if (i) {
          t = new Rf(i.track.source._codec);
          m.addAudioTrack(t, i.track.metadata);
        }
        await m.start();
        if (r) {
          n(e);
          let t = {
            decoderConfig: r.info.decoderConfig
          };
          for (let n = 0; n < o; n++) {
            let i = r.packets[n];
            await e.add(i, t);
            h = Math.max(h, i.timestamp + i.duration);
          }
        }
        if (i) {
          n(t);
          let e = {
            decoderConfig: i.info.decoderConfig
          };
          for (let n = 0; n < s; n++) {
            let r = i.packets[n];
            await t.add(r, e);
            h = Math.max(h, r.timestamp + r.duration);
          }
        }
        await m.finalize();
      } catch (e) {
        await m.cancel();
        throw e;
      }
      if (c) {
        n(p);
        this.format._options.onSegment?.(p, c);
      }
      if (o > 0) {
        n(r);
        r.packets.splice(0, o);
      }
      if (s > 0) {
        n(i);
        i.packets.splice(0, s);
      }
      let g = Infinity;
      if (r && r.packets.length > 0) {
        g = r.packets[0].timestamp;
      }
      if (i && i.packets.length > 0) {
        g = Math.min(g, i.packets[0].timestamp);
      }
      let _ = g < Infinity ? g : h;
      n(Number.isFinite(_));
      let v = _ - e.currentSegmentStartTimestamp;
      n(v >= 0);
      e.writtenSegments.push({
        path: l,
        duration: v,
        timestamp: e.currentSegmentStartTimestamp,
        byteSize: f,
        byteOffset: e.singleFile ? e.singleFile.nextOffset : null,
        info: c ?? null
      });
      this.globalTargetDuration = Math.max(this.globalTargetDuration, v);
      e.currentSegmentStartTimestamp = _;
      e.currentSegmentStartTimestampIsFixed = true;
      if (e.singleFile) {
        e.singleFile.nextOffset += f;
      }
      if (this.isLive) {
        while (e.writtenSegments.length > this.maxLiveSegmentCount) {
          let t = e.writtenSegments.shift();
          e.mediaSequence++;
          if (!this.singleFilePerPlaylist) {
            n(t.info);
            this.format._options.onSegmentPopped?.(t.path, t.info);
          }
        }
        await this.writePlaylist(e);
        await this.tryWriteMasterPlaylist();
      }
    }
  }
  async onPlaylistDone(e) {
    n(!e.done);
    e.done = true;
    if (e.singleFile) {
      await e.singleFile.target._flush();
      await e.singleFile.target._finalize();
      this.format._options.onSegment?.(e.singleFile.target, e.singleFile.info);
    }
    await this.writePlaylist(e);
    if (this.isLive && e.writtenSegments.length === 0) {
      await this.tryWriteMasterPlaylist();
    }
  }
  updatePlaylistBitrates(e) {
    let t = e.writtenSegments;
    let n = 0;
    let r = 0;
    let i = 0;
    for (let e = 0; e < t.length; e++) {
      i += t[e].duration;
      let r = 0;
      let a = 0;
      r += t[i].byteSize;
      a += t[i].duration;
      if (a >= this.globalTargetDuration * 0.5 && a <= this.globalTargetDuration * 1.5) {
        n = Math.max(n, r * 8 / a);
      }
      for (let i = e; i < t.length && !(a > this.globalTargetDuration * 1.5); i++) {}
    }
    if (n === 0) {
      for (let e of t) {
        let t = e.duration || 1;
        n = Math.max(n, e.byteSize * 8 / t);
      }
    }
    for (let e of t) {
      r += e.byteSize * 8;
    }
    e.peakBitrate = n;
    e.averageBitrate = r / (i || 1);
  }
  async writePlaylist(e) {
    n(this.output._target instanceof qd);
    let t = this.output._target;
    this.updatePlaylistBitrates(e);
    let r = false;
    for (let t of e.writtenSegments) {
      r ||= t.byteOffset !== null;
    }
    let i = e.tracks[0].isVideoTrack() && e.tracks[0].metadata.hasOnlyKeyPackets;
    let a = 3;
    if (i || r) {
      a = 4;
    }
    if (e.initSegment) {
      a = 5;
    }
    if (e.initSegment && !i) {
      a = 6;
    }
    let o = this.isLive ? this.targetSegmentDuration : this.globalTargetDuration;
    let s = qe(t.rootPath, e.path);
    let c = `#EXTM3U
#EXT-X-VERSION:${a}\n${this.isLive ? `` : `#EXT-X-PLAYLIST-TYPE:VOD
`}#EXT-X-TARGETDURATION:${Math.ceil(o)}\n${Number.isFinite(this.maxLiveSegmentCount) ? `#EXT-X-MEDIA-SEQUENCE:${e.mediaSequence}\n` : ``}#EXT-X-INDEPENDENT-SEGMENTS
${i ? `#EXT-X-I-FRAMES-ONLY
` : ``}${e.initSegment ? `#EXT-X-MAP:URI="${e.initSegment.path}"${e.initSegment.byteOffset === null ? `` : `,BYTERANGE="${e.initSegment.byteSize}@${e.initSegment.byteOffset}"`}
` : ``}
${e.writtenSegments.map(e => {
      return `#EXTINF:${+e.duration.toFixed(12)},\n${this.isRelativeToUnixEpoch ? `#EXT-X-PROGRAM-DATE-TIME:${new Date(e.timestamp * 1000).toISOString()}\n` : ``}${e.byteOffset === null ? `` : `#EXT-X-BYTERANGE:${e.byteSize}@${e.byteOffset}\n`}${e.path}\n`;
    }).join(``)}${e.done ? `${e.writtenSegments.length > 0 ? `
` : ``}#EXT-X-ENDLIST
` : ``}`;
    this.format._options.onPlaylist?.(c, np(e));
    let l = new Pd(await this.output._getTarget({
      path: s,
      isRoot: false,
      mimeType: ka
    }), true);
    l.start();
    l.write(f.encode(c));
    await l.flush();
    await l.finalize();
  }
  async writeMasterPlaylist() {
    n(this.output._target instanceof qd);
    let e = this.output._target;
    let t = `#EXTM3U
`;
    let r = false;
    let i = null;
    let a = 0;
    let o = false;
    for (let e of this.playlistDeclarations) {
      if (e.groupId === null) {
        let i = e.playlist.tracks[0].isVideoTrack() && e.playlist.tracks[0].metadata.hasOnlyKeyPackets;
        let a = [];
        for (let t of e.playlist.tracks) {
          let e = this.trackDatas.find(e => {
            return e.track === t;
          })?.info.decoderConfig.codec ?? t.source._codec;
          a.push(e);
        }
        let o = 0;
        let s = 0;
        if (e.references.length > 0) {
          let t = e.references[0].playlist.tracks[0];
          let r = this.trackDatas.find(e => {
            return e.track === t;
          })?.info.decoderConfig.codec ?? t.source._codec;
          a.push(r);
          for (let t of e.references) {
            n(t.playlist.peakBitrate !== null);
            o = Math.max(o, t.playlist.peakBitrate);
            s = Math.max(s, t.playlist.averageBitrate ?? 0);
          }
        }
        n(e.playlist.peakBitrate !== null);
        let c = e.playlist.peakBitrate + o;
        let l = (e.playlist.averageBitrate ?? 0) + s;
        t += `
`;
        r ||= true;
        if (i) {
          t += `#EXT-X-I-FRAME-STREAM-INF:`;
        } else {
          t += `#EXT-X-STREAM-INF:`;
        }
        t += `BANDWIDTH=${Math.ceil(c)}`;
        if (l > 0) {
          t += `,AVERAGE-BANDWIDTH=${Math.ceil(l)}`;
        }
        t += `,CODECS="${a.join(`,`)}"`;
        let u = e.playlist.tracks.find(e => {
          return e.isVideoTrack();
        });
        if (u?.isVideoTrack()) {
          let e = this.trackDatas.find(e => {
            return e.track === u;
          })?.info.decoderConfig;
          if (e) {
            let n = e.displayAspectWidth ?? e.codedWidth;
            let r = e.displayAspectHeight ?? e.codedHeight;
            if (n !== undefined && r !== undefined) {
              if (u.metadata.rotation !== undefined && u.metadata.rotation % 180 == 90) {
                [n, r] = [r, n];
              }
              t += `,RESOLUTION=${n}x${r}`;
            }
          }
          if (!i && u.metadata.frameRate !== undefined) {
            t += `,FRAME-RATE=${+u.metadata.frameRate.toFixed(3)}`;
          }
        }
        if (!i) {
          let r = new Map();
          for (let t of e.references) {
            n(t.groupId !== null);
            let e = t.playlist.tracks[0].type;
            r.set(e, t.groupId);
          }
          for (let [e, n] of r) {
            t += `,${e.toUpperCase()}="${n}"`;
          }
        }
        if (i) {
          t += `,URI="${e.playlist.path}"`;
          t += `
`;
        } else {
          t += `
`;
          t += `${e.playlist.path}\n`;
        }
      } else {
        n(e.playlist.tracks.length === 1);
        let r = e.playlist.tracks[0];
        let s = r.type;
        let c = r.metadata.name ?? null;
        let l = r.metadata.languageCode;
        let u = r.metadata.disposition;
        if (i === null || e.groupId !== i) {
          a = 0;
          t += `
`;
          o = false;
        }
        i = e.groupId;
        a++;
        t += `#EXT-X-MEDIA:TYPE=${s.toUpperCase()},GROUP-ID="${e.groupId}"`;
        if (c !== null && /[\n\r"]/.test(c)) {
          k._warn(`Dropping track name since it includes a line feed, carriage return, or double quote character, which are not allowed in HLS playlist attributes.`);
          c = null;
        }
        c ??= `${l ?? e.groupId}-${a}`;
        t += `,NAME="${c}"`;
        if (l !== undefined) {
          t += `,LANGUAGE="${l}"`;
        }
        let d = u?.primary ?? false;
        let f = u?.default ?? true;
        let p = u?.forced ?? false;
        if (d && !o) {
          t += `,DEFAULT=YES`;
          o = true;
        }
        if (d || f) {
          t += `,AUTOSELECT=YES`;
        }
        if (p) {
          t += `,FORCED=YES`;
        }
        if (s === `audio`) {
          let e = this.trackDatas.find(e => {
            return e.track === r;
          })?.info.decoderConfig;
          if (e) {
            t += `,CHANNELS="${e.numberOfChannels}"`;
          }
        }
        if (!e.noUri) {
          t += `,URI="${e.playlist.path}"`;
        }
        t += `
`;
      }
    }
    this.format._options.onMaster?.(t);
    let s = await this.mutex.acquire();
    try {
      let n;
      if (this.numWrittenMasterPlaylists === 0) {
        n = await this.output._getRootWriter(true);
      } else {
        n = new Pd(await this.output._getTarget({
          path: e.rootPath,
          isRoot: true,
          mimeType: ka
        }), true);
        n.start();
      }
      n.write(f.encode(t));
      await n.flush();
      await n.finalize();
      this.numWrittenMasterPlaylists++;
    } finally {
      s();
    }
  }
  async tryWriteMasterPlaylist() {
    n(this.isLive);
    for (let e of this.playlists) {
      if (e.writtenSegments.length === 0 && !e.done) {
        return;
      }
    }
    await this.writeMasterPlaylist();
  }
  async finalize() {
    (await Promise.all(this.playlists.map(e => {
      return e.mutex.acquire();
    }))).forEach(e => {
      return e();
    });
    for (let e of this.trackDatas) {
      e.closed = true;
    }
    await Promise.all(this.playlists.map(e => {
      if (e.done) {
        return Promise.resolve();
      } else {
        return this.advancePlaylist(e);
      }
    }));
    if (!this.isLive) {
      await this.writeMasterPlaylist();
    }
  }
};
var $f = e => {
  if (typeof e != `string`) {
    throw TypeError(`options.getPlaylistPath must return or resolve to a string`);
  }
  if (/[\n\r"]/.test(e)) {
    throw TypeError(`Playlist paths cannot contain line feed, carriage return, or double quote characters.`);
  }
};
var ep = e => {
  if (typeof e != `string`) {
    throw TypeError(`options.getSegmentPath must return or resolve to a string`);
  }
  if (/[\n\r"]/.test(e)) {
    throw TypeError(`Segment paths cannot contain line feed or carriage return characters.`);
  }
};
var tp = e => {
  if (typeof e != `string`) {
    throw TypeError(`options.getInitPath must return or resolve to a string`);
  }
  if (/[\n\r"]/.test(e)) {
    throw TypeError(`Init paths cannot contain line feed, carriage return, or double quote characters.`);
  }
};
var np = e => {
  return {
    n: e.id,
    tracks: e.tracks,
    segmentFormat: e.segmentFormat
  };
};
var rp = class {
  getSupportedVideoCodecs() {
    return this.getSupportedCodecs().filter(e => {
      return j.includes(e);
    });
  }
  getSupportedAudioCodecs() {
    return this.getSupportedCodecs().filter(e => {
      return N.includes(e);
    });
  }
  getSupportedSubtitleCodecs() {
    return this.getSupportedCodecs().filter(e => {
      return Ot.includes(e);
    });
  }
  _codecUnsupportedHint(e) {
    return ``;
  }
};
var ip = class extends rp {
  constructor(e = {}) {
    if (!e || typeof e != `object`) {
      throw TypeError(`options must be an object.`);
    }
    if (e.fastStart !== undefined && ![false, `in-memory`, `reserve`, `fragmented`].includes(e.fastStart)) {
      throw TypeError(`options.fastStart, when provided, must be false, 'in-memory', 'reserve', or 'fragmented'.`);
    }
    if (e.minimumFragmentDuration !== undefined && (!Number.isFinite(e.minimumFragmentDuration) || e.minimumFragmentDuration < 0)) {
      throw TypeError(`options.minimumFragmentDuration, when provided, must be a non-negative number.`);
    }
    if (e.onFtyp !== undefined && typeof e.onFtyp != `function`) {
      throw TypeError(`options.onFtyp, when provided, must be a function.`);
    }
    if (e.onMoov !== undefined && typeof e.onMoov != `function`) {
      throw TypeError(`options.onMoov, when provided, must be a function.`);
    }
    if (e.onMdat !== undefined && typeof e.onMdat != `function`) {
      throw TypeError(`options.onMdat, when provided, must be a function.`);
    }
    if (e.onMoof !== undefined && typeof e.onMoof != `function`) {
      throw TypeError(`options.onMoof, when provided, must be a function.`);
    }
    if (e.metadataFormat !== undefined && ![`mdir`, `mdta`, `udta`, `auto`].includes(e.metadataFormat)) {
      throw TypeError(`options.metadataFormat, when provided, must be either 'auto', 'mdir', 'mdta', or 'udta'.`);
    }
    super();
    this._options = e;
  }
  getSupportedTrackCounts() {
    let e = 4294967295;
    return {
      video: {
        min: 0,
        max: e
      },
      audio: {
        min: 0,
        max: e
      },
      subtitle: {
        min: 0,
        max: e
      },
      total: {
        min: 1,
        max: e
      }
    };
  }
  get supportsVideoRotationMetadata() {
    return true;
  }
  get supportsTimestampedMediaData() {
    return true;
  }
  _createMuxer(e) {
    return new Zd(e, this);
  }
};
var ap = class extends ip {
  constructor(e) {
    super(e);
  }
  get _name() {
    return `MP4`;
  }
  get fileExtension() {
    return `.mp4`;
  }
  get mimeType() {
    return `video/mp4`;
  }
  getSupportedCodecs() {
    return [...j, ...Dt, `pcm-s16`, `pcm-s16be`, `pcm-s24`, `pcm-s24be`, `pcm-s32`, `pcm-s32be`, `pcm-f32`, `pcm-f32be`, `pcm-f64`, `pcm-f64be`, ...Ot];
  }
  _codecUnsupportedHint(e) {
    if (new sp().getSupportedCodecs().includes(e)) {
      return ` Switching to MOV will grant support for this codec.`;
    } else {
      return ``;
    }
  }
};
var op = class extends ip {
  constructor(e) {
    super(e);
  }
  get _name() {
    return `CMAF`;
  }
  get fileExtension() {
    return `.m4s`;
  }
  get mimeType() {
    return `video/mp4`;
  }
  getSupportedCodecs() {
    return [...j, ...Dt, `pcm-s16`, `pcm-s16be`, `pcm-s24`, `pcm-s24be`, `pcm-s32`, `pcm-s32be`, `pcm-f32`, `pcm-f32be`, `pcm-f64`, `pcm-f64be`, ...Ot];
  }
};
var sp = class extends ip {
  constructor(e) {
    super(e);
  }
  get _name() {
    return `MOV`;
  }
  get fileExtension() {
    return `.mov`;
  }
  get mimeType() {
    return `video/quicktime`;
  }
  getSupportedCodecs() {
    return [...j, ...N];
  }
  _codecUnsupportedHint(e) {
    if (new ap().getSupportedCodecs().includes(e)) {
      return ` Switching to MP4 will grant support for this codec.`;
    } else {
      return ``;
    }
  }
};
var cp = class extends rp {
  constructor(e = {}) {
    if (!e || typeof e != `object`) {
      throw TypeError(`options must be an object.`);
    }
    if (e.appendOnly !== undefined && typeof e.appendOnly != `boolean`) {
      throw TypeError(`options.appendOnly, when provided, must be a boolean.`);
    }
    if (e.minimumClusterDuration !== undefined && (!Number.isFinite(e.minimumClusterDuration) || e.minimumClusterDuration < 0)) {
      throw TypeError(`options.minimumClusterDuration, when provided, must be a non-negative number.`);
    }
    if (e.onEbmlHeader !== undefined && typeof e.onEbmlHeader != `function`) {
      throw TypeError(`options.onEbmlHeader, when provided, must be a function.`);
    }
    if (e.onSegmentHeader !== undefined && typeof e.onSegmentHeader != `function`) {
      throw TypeError(`options.onHeader, when provided, must be a function.`);
    }
    if (e.onCluster !== undefined && typeof e.onCluster != `function`) {
      throw TypeError(`options.onCluster, when provided, must be a function.`);
    }
    super();
    this._options = e;
  }
  _createMuxer(e) {
    return new af(e, this);
  }
  get _name() {
    return `Matroska`;
  }
  getSupportedTrackCounts() {
    return {
      video: {
        min: 0,
        max: 127
      },
      audio: {
        min: 0,
        max: 127
      },
      subtitle: {
        min: 0,
        max: 127
      },
      total: {
        min: 1,
        max: 127
      }
    };
  }
  get fileExtension() {
    return `.mkv`;
  }
  get mimeType() {
    return `video/x-matroska`;
  }
  getSupportedCodecs() {
    return [...j, ...Dt, ...M.filter(e => {
      return ![`pcm-s8`, `pcm-f32be`, `pcm-f64be`, `ulaw`, `alaw`].includes(e);
    }), ...Ot];
  }
  get supportsVideoRotationMetadata() {
    return false;
  }
  get supportsTimestampedMediaData() {
    return true;
  }
};
var lp = class extends cp {
  constructor(e) {
    super(e);
  }
  getSupportedCodecs() {
    return [...j.filter(e => {
      return [`vp8`, `vp9`, `av1`].includes(e);
    }), ...N.filter(e => {
      return [`opus`, `vorbis`].includes(e);
    }), ...Ot];
  }
  get _name() {
    return `WebM`;
  }
  get fileExtension() {
    return `.webm`;
  }
  get mimeType() {
    return `video/webm`;
  }
  _codecUnsupportedHint(e) {
    if (new cp().getSupportedCodecs().includes(e)) {
      return ` Switching to MKV will grant support for this codec.`;
    } else {
      return ``;
    }
  }
};
var up = class extends rp {
  constructor(e = {}) {
    if (!e || typeof e != `object`) {
      throw TypeError(`options must be an object.`);
    }
    if (e.xingHeader !== undefined && typeof e.xingHeader != `boolean`) {
      throw TypeError(`options.xingHeader, when provided, must be a boolean.`);
    }
    if (e.onXingFrame !== undefined && typeof e.onXingFrame != `function`) {
      throw TypeError(`options.onXingFrame, when provided, must be a function.`);
    }
    super();
    this._options = e;
  }
  _createMuxer(e) {
    return new sf(e, this);
  }
  get _name() {
    return `MP3`;
  }
  getSupportedTrackCounts() {
    return {
      video: {
        min: 0,
        max: 0
      },
      audio: {
        min: 1,
        max: 1
      },
      subtitle: {
        min: 0,
        max: 0
      },
      total: {
        min: 1,
        max: 1
      }
    };
  }
  get fileExtension() {
    return `.mp3`;
  }
  get mimeType() {
    return `audio/mpeg`;
  }
  getSupportedCodecs() {
    return [`mp3`];
  }
  get supportsVideoRotationMetadata() {
    return false;
  }
  get supportsTimestampedMediaData() {
    return false;
  }
};
var dp = class extends rp {
  constructor(e = {}) {
    if (!e || typeof e != `object`) {
      throw TypeError(`options must be an object.`);
    }
    if (e.large !== undefined && typeof e.large != `boolean`) {
      throw TypeError(`options.large, when provided, must be a boolean.`);
    }
    if (e.metadataFormat !== undefined && ![`info`, `id3`].includes(e.metadataFormat)) {
      throw TypeError(`options.metadataFormat, when provided, must be either 'info' or 'id3'.`);
    }
    if (e.onHeader !== undefined && typeof e.onHeader != `function`) {
      throw TypeError(`options.onHeader, when provided, must be a function.`);
    }
    super();
    this._options = e;
  }
  _createMuxer(e) {
    return new wf(e, this);
  }
  get _name() {
    return `WAVE`;
  }
  getSupportedTrackCounts() {
    return {
      video: {
        min: 0,
        max: 0
      },
      audio: {
        min: 1,
        max: 1
      },
      subtitle: {
        min: 0,
        max: 0
      },
      total: {
        min: 1,
        max: 1
      }
    };
  }
  get fileExtension() {
    return `.wav`;
  }
  get mimeType() {
    return `audio/wav`;
  }
  getSupportedCodecs() {
    return [...M.filter(e => {
      return [`pcm-s16`, `pcm-s24`, `pcm-s32`, `pcm-f32`, `pcm-u8`, `ulaw`, `alaw`].includes(e);
    })];
  }
  get supportsVideoRotationMetadata() {
    return false;
  }
  get supportsTimestampedMediaData() {
    return false;
  }
};
var fp = class extends rp {
  constructor(e = {}) {
    if (!e || typeof e != `object`) {
      throw TypeError(`options must be an object.`);
    }
    if (e.maximumPageDuration !== undefined && (!Number.isFinite(e.maximumPageDuration) || e.maximumPageDuration <= 0)) {
      throw TypeError(`options.maximumPageDuration, when provided, must be a positive number.`);
    }
    if (e.onPage !== undefined && typeof e.onPage != `function`) {
      throw TypeError(`options.onPage, when provided, must be a function.`);
    }
    super();
    this._options = e;
  }
  _createMuxer(e) {
    return new lf(e, this);
  }
  get _name() {
    return `Ogg`;
  }
  getSupportedTrackCounts() {
    let e = 4294967296;
    return {
      video: {
        min: 0,
        max: 0
      },
      audio: {
        min: 0,
        max: e
      },
      subtitle: {
        min: 0,
        max: 0
      },
      total: {
        min: 1,
        max: e
      }
    };
  }
  get fileExtension() {
    return `.ogg`;
  }
  get mimeType() {
    return `application/ogg`;
  }
  getSupportedCodecs() {
    return [...N.filter(e => {
      return [`vorbis`, `opus`].includes(e);
    })];
  }
  get supportsVideoRotationMetadata() {
    return false;
  }
  get supportsTimestampedMediaData() {
    return false;
  }
};
var pp = class extends rp {
  constructor(e = {}) {
    if (!e || typeof e != `object`) {
      throw TypeError(`options must be an object.`);
    }
    if (e.onFrame !== undefined && typeof e.onFrame != `function`) {
      throw TypeError(`options.onFrame, when provided, must be a function.`);
    }
    super();
    this._options = e;
  }
  _createMuxer(e) {
    return new Ll(e, this);
  }
  get _name() {
    return `ADTS`;
  }
  getSupportedTrackCounts() {
    return {
      video: {
        min: 0,
        max: 0
      },
      audio: {
        min: 1,
        max: 1
      },
      subtitle: {
        min: 0,
        max: 0
      },
      total: {
        min: 1,
        max: 1
      }
    };
  }
  get fileExtension() {
    return `.aac`;
  }
  get mimeType() {
    return `audio/aac`;
  }
  getSupportedCodecs() {
    return [`aac`];
  }
  get supportsVideoRotationMetadata() {
    return false;
  }
  get supportsTimestampedMediaData() {
    return false;
  }
};
var mp = class extends rp {
  constructor(e = {}) {
    if (!e || typeof e != `object`) {
      throw TypeError(`options must be an object.`);
    }
    if (e.appendOnly !== undefined && typeof e.appendOnly != `boolean`) {
      throw TypeError(`options.appendOnly, when provided, must be a boolean.`);
    }
    super();
    this._options = e;
  }
  _createMuxer(e) {
    return new Vl(e, this);
  }
  get _name() {
    return `FLAC`;
  }
  getSupportedTrackCounts() {
    return {
      video: {
        min: 0,
        max: 0
      },
      audio: {
        min: 1,
        max: 1
      },
      subtitle: {
        min: 0,
        max: 0
      },
      total: {
        min: 1,
        max: 1
      }
    };
  }
  get fileExtension() {
    return `.flac`;
  }
  get mimeType() {
    return `audio/flac`;
  }
  getSupportedCodecs() {
    return [`flac`];
  }
  get supportsVideoRotationMetadata() {
    return false;
  }
  get supportsTimestampedMediaData() {
    return false;
  }
};
var hp = class extends rp {
  constructor(e = {}) {
    if (!e || typeof e != `object`) {
      throw TypeError(`options must be an object.`);
    }
    if (e.onPacket !== undefined && typeof e.onPacket != `function`) {
      throw TypeError(`options.onPacket, when provided, must be a function.`);
    }
    super();
    this._options = e;
  }
  _createMuxer(e) {
    return new _f(e, this);
  }
  get _name() {
    return `MPEG-TS`;
  }
  getSupportedTrackCounts() {
    return {
      video: {
        min: 0,
        max: 16
      },
      audio: {
        min: 0,
        max: 32
      },
      subtitle: {
        min: 0,
        max: 0
      },
      total: {
        min: 1,
        max: 48
      }
    };
  }
  get fileExtension() {
    return `.ts`;
  }
  get mimeType() {
    return `video/MP2T`;
  }
  getSupportedCodecs() {
    return [...j.filter(e => {
      return [`avc`, `hevc`].includes(e);
    }), ...N.filter(e => {
      return [`aac`, `mp3`, `ac3`, `eac3`].includes(e);
    })];
  }
  get supportsVideoRotationMetadata() {
    return false;
  }
  get supportsTimestampedMediaData() {
    return true;
  }
};
var gp = class extends rp {
  constructor(e) {
    if (!e || typeof e != `object`) {
      throw TypeError(`options must be an object.`);
    }
    if (!(e.segmentFormat instanceof rp) && (!Array.isArray(e.segmentFormat) || e.segmentFormat.length === 0 || !e.segmentFormat.every(e => {
      return e instanceof rp;
    }))) {
      throw TypeError(`options.segmentFormat must be an OutputFormat or a non-empty array of OutputFormat instances.`);
    }
    if (e.targetDuration !== undefined && (typeof e.targetDuration != `number` || e.targetDuration <= 0)) {
      throw TypeError(`options.targetDuration, when provided, must be a positive number.`);
    }
    if (e.singleFilePerPlaylist !== undefined && typeof e.singleFilePerPlaylist != `boolean`) {
      throw TypeError(`options.singleFilePerPlaylist, when provided, must be a boolean.`);
    }
    if (e.live !== undefined && typeof e.live != `boolean`) {
      throw TypeError(`options.live, when provided, must be a boolean.`);
    }
    if (e.maxLiveSegmentCount !== undefined && (typeof e.maxLiveSegmentCount != `number` || e.maxLiveSegmentCount < 1 || Number.isFinite(e.maxLiveSegmentCount) && !Number.isInteger(e.maxLiveSegmentCount))) {
      throw TypeError(`options.maxLiveSegmentCount, when provided, must be a positive integer or Infinity.`);
    }
    if (e.getPlaylistPath !== undefined && typeof e.getPlaylistPath != `function`) {
      throw TypeError(`options.getPlaylistPath, when provided, must be a function.`);
    }
    if (e.getSegmentPath !== undefined && typeof e.getSegmentPath != `function`) {
      throw TypeError(`options.getSegmentPath, when provided, must be a function.`);
    }
    if (e.getInitPath !== undefined && typeof e.getInitPath != `function`) {
      throw TypeError(`options.getInitPath, when provided, must be a function.`);
    }
    if (e.onMaster !== undefined && typeof e.onMaster != `function`) {
      throw TypeError(`options.onMaster, when provided, must be a function.`);
    }
    if (e.onPlaylist !== undefined && typeof e.onPlaylist != `function`) {
      throw TypeError(`options.onPlaylist, when provided, must be a function.`);
    }
    if (e.onSegment !== undefined && typeof e.onSegment != `function`) {
      throw TypeError(`options.onSegment, when provided, must be a function.`);
    }
    if (e.onInit !== undefined && typeof e.onInit != `function`) {
      throw TypeError(`options.onInit, when provided, must be a function.`);
    }
    if (e.onSegmentPopped !== undefined && typeof e.onSegmentPopped != `function`) {
      throw TypeError(`options.onSegmentPopped, when provided, must be a function.`);
    }
    super();
    this._options = e;
  }
  _createMuxer(e) {
    return new Qf(e, this);
  }
  get _name() {
    return `HTTP Live Streaming (HLS)`;
  }
  get fileExtension() {
    return `.m3u8`;
  }
  get mimeType() {
    return ka;
  }
  getSupportedCodecs() {
    return [...new Set(lt(this._options.segmentFormat).flatMap(e => {
      return e.getSupportedCodecs();
    }))];
  }
  getSupportedTrackCounts() {
    let e = false;
    let t = false;
    let n = false;
    for (let r of lt(this._options.segmentFormat)) {
      let i = r.getSupportedTrackCounts();
      e ||= i.video.max > 0;
      t ||= i.audio.max > 0;
      n ||= i.subtitle.max > 0;
    }
    return {
      video: {
        min: 0,
        max: e ? Infinity : 0
      },
      audio: {
        min: 0,
        max: t ? Infinity : 0
      },
      subtitle: {
        min: 0,
        max: 0
      },
      total: {
        min: 1,
        max: Infinity
      }
    };
  }
  get supportsVideoRotationMetadata() {
    return lt(this._options.segmentFormat).some(e => {
      return e.supportsVideoRotationMetadata;
    });
  }
  get supportsTimestampedMediaData() {
    return true;
  }
  _codecUnsupportedHint(e) {
    return ` Using different segment formats may grant support for this codec.`;
  }
};
var _p = [`video`, `audio`, `subtitle`];
var vp = class e {
  constructor(e, t, n, r, i) {
    this.id = e;
    this.output = t;
    this.type = n;
    this.source = r;
    this.metadata = i;
  }
  isVideoTrack() {
    return this.type === `video`;
  }
  isAudioTrack() {
    return this.type === `audio`;
  }
  isSubtitleTrack() {
    return this.type === `subtitle`;
  }
  canBePairedWith(t) {
    if (!(t instanceof e)) {
      throw TypeError(`other must be an OutputTrack.`);
    }
    if (this === t) {
      return false;
    }
    let n = lt(this.metadata.group);
    let r = lt(t.metadata.group);
    for (let e of n) {
      if (this.type !== t.type && r.some(t => {
        return e === t;
      }) || r.some(t => {
        return e._pairedGroups.has(t);
      })) {
        return true;
      }
    }
    return false;
  }
};
var yp = class extends vp {
  constructor(e, t, n, r) {
    super(e, t, `video`, n, r);
  }
};
var bp = class extends vp {
  constructor(e, t, n, r) {
    super(e, t, `audio`, n, r);
  }
};
var xp = class extends vp {
  constructor(e, t, n, r) {
    super(e, t, `subtitle`, n, r);
  }
};
var Sp = class e {
  constructor() {
    this._pairedGroups = new Set();
  }
  pairWith(t) {
    if (!(t instanceof e)) {
      throw TypeError(`other must be an OutputTrackGroup.`);
    }
    if (this === t) {
      throw TypeError(`Cannot pair a group with itself.`);
    }
    this._pairedGroups.add(t);
    t._pairedGroups.add(this);
  }
};
var Cp = e => {
  if (!e || typeof e != `object`) {
    throw TypeError(`metadata must be an object.`);
  }
  if (e.languageCode !== undefined && !Ce(e.languageCode)) {
    throw TypeError(`metadata.languageCode, when provided, must be a three-letter, ISO 639-2/T language code.`);
  }
  if (e.name !== undefined && typeof e.name != `string`) {
    throw TypeError(`metadata.name, when provided, must be a string.`);
  }
  if (e.disposition !== undefined) {
    bt(e.disposition);
  }
  if (e.maximumPacketCount !== undefined && (!Number.isInteger(e.maximumPacketCount) || e.maximumPacketCount < 0)) {
    throw TypeError(`metadata.maximumPacketCount, when provided, must be a non-negative integer.`);
  }
  if (e.group !== undefined && !(e.group instanceof Sp) && (!Array.isArray(e.group) || e.group.some(e => {
    return !(e instanceof Sp);
  }))) {
    throw TypeError(`metadata.group, when provided, must be an OutputTrackGroup instance or an array of OutputTrackGroup instances.`);
  }
};
var wp = class extends ut {
  get target() {
    let e = `Output.target cannot be used when using PathedTarget with an async callback. Use the 'target' event instead.`;
    if (this._rootTargetPromise) {
      throw TypeError(e);
    }
    let t = this._getRootTarget();
    if (t instanceof Promise) {
      throw TypeError(e);
    }
    return t;
  }
  constructor(e) {
    super();
    this.state = `pending`;
    this.defaultTrackGroup = new Sp();
    this._onFinalize = null;
    this._unfinalizedTargets = new Set();
    this._rootWriterPromise = null;
    this._tracks = [];
    this._startPromise = null;
    this._cancelPromise = null;
    this._finalizePromise = null;
    this._mutex = new C();
    this._metadataTags = {};
    this._rootTarget = null;
    this._rootTargetPromise = null;
    this._firstMediaStreamTimestamp = null;
    if (!e || typeof e != `object`) {
      throw TypeError(`options must be an object.`);
    }
    if (!(e.format instanceof rp)) {
      throw TypeError(`options.format must be an OutputFormat.`);
    }
    if (!(e.target instanceof Id) && !(e.target instanceof qd)) {
      throw TypeError(`options.target must be a Target or a PathedTarget.`);
    }
    if (e.target instanceof Id) {
      this._rememberTarget(e.target);
    }
    if (e.initTarget !== undefined && !(e.initTarget instanceof Id) && typeof e.initTarget != `function`) {
      throw Error(`options.initTarget, when provided, must be a Target or a function that returns or resolves to a Target.`);
    }
    if (e.onFinalize !== undefined && typeof e.onFinalize != `function`) {
      throw TypeError(`options.onFinalize, when provided, must be a function.`);
    }
    this.format = e.format;
    this._target = e.target;
    this._onFinalize = e.onFinalize ?? null;
    this._initTarget = e.initTarget ?? null;
    if (this._initTarget instanceof Id) {
      this._rememberTarget(this._initTarget);
    }
    this._muxer = e.format._createMuxer(this);
  }
  _getTargetValidated(e) {
    n(this._target instanceof qd);
    let t = this._target.getTarget(e);
    let r = e => {
      if (!(e instanceof Id)) {
        throw TypeError(`getTarget must return a Target.`);
      }
      return e;
    };
    if (t instanceof Promise) {
      return t.then(r);
    } else {
      return r(t);
    }
  }
  async _getTarget(e) {
    n(this._target instanceof qd);
    let t = await this._getTargetValidated(e);
    this._emit(`target`, {
      target: t,
      request: e,
      isRoot: e.isRoot
    });
    if (this.state === `canceled`) {
      await t._close();
    } else {
      this._rememberTarget(t);
    }
    return t;
  }
  _rememberTarget(e) {
    this._unfinalizedTargets.add(e);
    e.on(`finalized`, () => {
      return this._unfinalizedTargets.delete(e);
    }, {
      once: true
    });
  }
  async _getInitTarget() {
    n(this._initTarget !== null);
    if (this._initTarget instanceof Id) {
      return this._initTarget;
    }
    let e = await this._initTarget();
    if (this.state === `canceled`) {
      await e._close();
    } else {
      this._rememberTarget(e);
    }
    return e;
  }
  _hasInitTarget() {
    return this._initTarget !== null;
  }
  _getRootTarget() {
    if (this._rootTarget) {
      return this._rootTarget;
    }
    if (this._rootTargetPromise) {
      return this._rootTargetPromise;
    }
    if (this._target instanceof Id) {
      this._emit(`target`, {
        target: this._target,
        request: null,
        isRoot: true
      });
      this._rootTarget = this._target;
      return this._target;
    }
    let e = {
      path: this._target.rootPath,
      isRoot: true,
      mimeType: this.format.mimeType
    };
    let t = this._getTargetValidated(e);
    let n = t => {
      if (this.state === `canceled`) {
        t._close();
      } else {
        this._rememberTarget(t);
      }
      this._emit(`target`, {
        target: t,
        request: e,
        isRoot: true
      });
      this._rootTarget = t;
      return t;
    };
    if (t instanceof Promise) {
      return this._rootTargetPromise = t.then(n);
    } else {
      return n(t);
    }
  }
  _getRootWriter(e) {
    return this._rootWriterPromise ??= (async () => {
      let t = await this._getRootTarget();
      let n = new Pd(t, typeof e == `boolean` ? e : e(t));
      n.start();
      return n;
    })();
  }
  addVideoTrack(e, t = {}) {
    if (!(e instanceof Df)) {
      throw TypeError(`source must be a VideoSource.`);
    }
    Cp(t);
    if (t.rotation !== undefined && ![0, 90, 180, 270].includes(t.rotation)) {
      throw TypeError(`Invalid video rotation: ${t.rotation}. Has to be 0, 90, 180 or 270.`);
    }
    if (!this.format.supportsVideoRotationMetadata && t.rotation) {
      throw Error(`${this.format._name} does not support video rotation metadata.`);
    }
    if (t.frameRate !== undefined && (!Number.isFinite(t.frameRate) || t.frameRate <= 0)) {
      throw TypeError(`Invalid video frame rate: ${t.frameRate}. Must be a positive number.`);
    }
    let n = {
      ...t
    };
    n.group ??= this.defaultTrackGroup;
    return this._addTrack(new yp(this._tracks.length + 1, this, e, n));
  }
  addAudioTrack(e, t = {}) {
    if (!(e instanceof Lf)) {
      throw TypeError(`source must be an AudioSource.`);
    }
    Cp(t);
    let n = {
      ...t
    };
    n.group ??= this.defaultTrackGroup;
    return this._addTrack(new bp(this._tracks.length + 1, this, e, n));
  }
  addSubtitleTrack(e, t = {}) {
    if (!(e instanceof Xf)) {
      throw TypeError(`source must be a SubtitleSource.`);
    }
    Cp(t);
    let n = {
      ...t
    };
    n.group ??= this.defaultTrackGroup;
    return this._addTrack(new xp(this._tracks.length + 1, this, e, n));
  }
  setMetadataTags(e) {
    _t(e);
    if (this.state !== `pending`) {
      throw Error(`Cannot set metadata tags after output has been started or canceled.`);
    }
    this._metadataTags = e;
  }
  _addTrack(e) {
    if (this.state !== `pending`) {
      throw Error(`Cannot add track after output has been started or canceled.`);
    }
    if (e.source._connectedTrack) {
      throw Error(`Source is already used for a track.`);
    }
    let t = this.format.getSupportedTrackCounts();
    let n = this._tracks.reduce((t, n) => {
      return t + +(n.type === e.type);
    }, 0);
    let r = t[e.type].max;
    if (n === r) {
      throw Error(r === 0 ? `${this.format._name} does not support ${e.type} tracks.` : `${this.format._name} does not support more than ${r} ${e.type} track${r === 1 ? `` : `s`}.`);
    }
    let i = t.total.max;
    if (this._tracks.length === i) {
      throw Error(`${this.format._name} does not support more than ${i} tracks${i === 1 ? `` : `s`} in total.`);
    }
    if (e.isVideoTrack()) {
      let t = this.format.getSupportedVideoCodecs();
      if (t.length === 0) {
        throw Error(`${this.format._name} does not support video tracks.${this.format._codecUnsupportedHint(e.source._codec)}`);
      }
      if (!t.includes(e.source._codec)) {
        throw Error(`Codec '${e.source._codec}' cannot be contained within ${this.format._name}. Supported video codecs are: ${t.map(e => {
          return `'${e}'`;
        }).join(`, `)}.${this.format._codecUnsupportedHint(e.source._codec)}`);
      }
    } else if (e.isAudioTrack()) {
      let t = this.format.getSupportedAudioCodecs();
      if (t.length === 0) {
        throw Error(`${this.format._name} does not support audio tracks.${this.format._codecUnsupportedHint(e.source._codec)}`);
      }
      if (!t.includes(e.source._codec)) {
        throw Error(`Codec '${e.source._codec}' cannot be contained within ${this.format._name}. Supported audio codecs are: ${t.map(e => {
          return `'${e}'`;
        }).join(`, `)}.${this.format._codecUnsupportedHint(e.source._codec)}`);
      }
    } else if (e.isSubtitleTrack()) {
      let t = this.format.getSupportedSubtitleCodecs();
      if (t.length === 0) {
        throw Error(`${this.format._name} does not support subtitle tracks.${this.format._codecUnsupportedHint(e.source._codec)}`);
      }
      if (!t.includes(e.source._codec)) {
        throw Error(`Codec '${e.source._codec}' cannot be contained within ${this.format._name}. Supported subtitle codecs are: ${t.map(e => {
          return `'${e}'`;
        }).join(`, `)}.${this.format._codecUnsupportedHint(e.source._codec)}`);
      }
    }
    this._tracks.push(e);
    e.source._connectedTrack = e;
    return e;
  }
  async start() {
    let e = this.format.getSupportedTrackCounts();
    for (let t of _p) {
      let n = this._tracks.reduce((e, n) => {
        return e + +(n.type === t);
      }, 0);
      let r = e[t].min;
      if (n < r) {
        throw Error(r === e[t].max ? `${this.format._name} requires exactly ${r} ${t} track${r === 1 ? `` : `s`}.` : `${this.format._name} requires at least ${r} ${t} track${r === 1 ? `` : `s`}.`);
      }
    }
    let t = e.total.min;
    if (this._tracks.length < t) {
      throw Error(t === e.total.max ? `${this.format._name} requires exactly ${t} track${t === 1 ? `` : `s`}.` : `${this.format._name} requires at least ${t} track${t === 1 ? `` : `s`}.`);
    }
    if (this.state === `canceled`) {
      throw Error(`Output has been canceled.`);
    }
    if (this._startPromise) {
      k._warn(`Output has already been started.`);
      return this._startPromise;
    } else {
      return this._startPromise = (async () => {
        this.state = `started`;
        let e = await this._mutex.acquire();
        try {
          await this._muxer.start();
          let e = this._tracks.map(e => {
            return e.source._start();
          });
          await Promise.all(e);
        } finally {
          e();
        }
      })();
    }
  }
  getMimeType() {
    return this._muxer.getMimeType();
  }
  async cancel() {
    if (this._cancelPromise) {
      k._warn(`Output has already been canceled.`);
      return this._cancelPromise;
    }
    if (this.state === `finalizing` || this.state === `finalized`) {
      if (this.state === `finalized`) {
        k._warn(`Output has already been finalized.`);
      }
      return;
    }
    return this._cancelPromise = (async () => {
      this.state = `canceled`;
      let e = await this._mutex.acquire();
      try {
        let e = this._tracks.map(e => {
          return e.source._flushOrWaitForOngoingClose(true);
        });
        await Promise.all(e);
        await Promise.all([...this._unfinalizedTargets].map(e => {
          return e._close();
        }));
        this._unfinalizedTargets.clear();
      } finally {
        e();
      }
    })();
  }
  async finalize() {
    if (this.state === `pending`) {
      throw Error(`Cannot finalize before starting.`);
    }
    if (this.state === `canceled`) {
      throw Error(`Cannot finalize after canceling.`);
    }
    if (this._finalizePromise) {
      k._warn(`Output has already been finalized.`);
      return this._finalizePromise;
    } else {
      return this._finalizePromise = (async () => {
        this.state = `finalizing`;
        let e = await this._mutex.acquire();
        try {
          let e = this._tracks.map(e => {
            return e.source._flushOrWaitForOngoingClose(false);
          });
          await Promise.all(e);
          await this._muxer.finalize();
          if (this._rootWriterPromise) {
            let e = await this._rootWriterPromise;
            if (!e.finalized) {
              await e.flush();
              await e.finalize();
            }
          }
          if (this._onFinalize) {
            await this._onFinalize();
          }
          this.state = `finalized`;
        } finally {
          e();
        }
      })();
    }
  }
};
var Tp = e => {
  if (!e || typeof e != `object`) {
    throw TypeError(`options.video, when provided, must be an object.`);
  }
  if (e?.discard !== undefined && typeof e.discard != `boolean`) {
    throw TypeError(`options.video.discard, when provided, must be a boolean.`);
  }
  if (e?.forceTranscode !== undefined && typeof e.forceTranscode != `boolean`) {
    throw TypeError(`options.video.forceTranscode, when provided, must be a boolean.`);
  }
  if (e?.codec !== undefined && !j.includes(e.codec)) {
    throw TypeError(`options.video.codec, when provided, must be one of: ${j.join(`, `)}.`);
  }
  if (e?.bitrate !== undefined && !(e.bitrate instanceof rc) && (!Number.isInteger(e.bitrate) || e.bitrate <= 0)) {
    throw TypeError(`options.video.bitrate, when provided, must be a positive integer or a quality.`);
  }
  if (e?.width !== undefined && (!Number.isInteger(e.width) || e.width <= 0)) {
    throw TypeError(`options.video.width, when provided, must be a positive integer.`);
  }
  if (e?.height !== undefined && (!Number.isInteger(e.height) || e.height <= 0)) {
    throw TypeError(`options.video.height, when provided, must be a positive integer.`);
  }
  if (e?.fit !== undefined && ![`fill`, `contain`, `cover`].includes(e.fit)) {
    throw TypeError(`options.video.fit, when provided, must be one of 'fill', 'contain', or 'cover'.`);
  }
  if (e?.width !== undefined && e.height !== undefined && e.fit === undefined) {
    throw TypeError(`When both options.video.width and options.video.height are provided, options.video.fit must also be provided.`);
  }
  if (e?.rotate !== undefined && ![0, 90, 180, 270].includes(e.rotate)) {
    throw TypeError(`options.video.rotate, when provided, must be 0, 90, 180 or 270.`);
  }
  if (e?.allowRotationMetadata !== undefined && typeof e.allowRotationMetadata != `boolean`) {
    throw TypeError(`options.video.allowRotationMetadata, when provided, must be a boolean.`);
  }
  if (e?.crop !== undefined) {
    As(e.crop, `options.video.`);
  }
  if (e?.frameRate !== undefined && (!Number.isFinite(e.frameRate) || e.frameRate <= 0)) {
    throw TypeError(`options.video.frameRate, when provided, must be a finite positive number.`);
  }
  if (e?.alpha !== undefined && ![`discard`, `keep`].includes(e.alpha)) {
    throw TypeError(`options.video.alpha, when provided, must be either 'discard' or 'keep'.`);
  }
  if (e?.keyFrameInterval !== undefined && (!Number.isFinite(e.keyFrameInterval) || e.keyFrameInterval < 0)) {
    throw TypeError(`options.video.keyFrameInterval, when provided, must be a non-negative number.`);
  }
  if (e?.process !== undefined && typeof e.process != `function`) {
    throw TypeError(`options.video.process, when provided, must be a function.`);
  }
  if (e?.processedWidth !== undefined && (!Number.isInteger(e.processedWidth) || e.processedWidth <= 0)) {
    throw TypeError(`options.video.processedWidth, when provided, must be a positive integer.`);
  }
  if (e?.processedHeight !== undefined && (!Number.isInteger(e.processedHeight) || e.processedHeight <= 0)) {
    throw TypeError(`options.video.processedHeight, when provided, must be a positive integer.`);
  }
  if (e?.hardwareAcceleration !== undefined && ![`no-preference`, `prefer-hardware`, `prefer-software`].includes(e.hardwareAcceleration)) {
    throw TypeError(`options.video.hardwareAcceleration, when provided, must be 'no-preference', 'prefer-hardware' or 'prefer-software'.`);
  }
  if (e?.group !== undefined && !(e.group instanceof Sp) && (!Array.isArray(e.group) || !e.group.every(e => {
    return e instanceof Sp;
  }))) {
    throw TypeError(`options.video.group, when provided, must be an OutputTrackGroup or an array of OutputTrackGroups.`);
  }
};
var Ep = e => {
  if (!e || typeof e != `object`) {
    throw TypeError(`options.audio, when provided, must be an object.`);
  }
  if (e?.discard !== undefined && typeof e.discard != `boolean`) {
    throw TypeError(`options.audio.discard, when provided, must be a boolean.`);
  }
  if (e?.forceTranscode !== undefined && typeof e.forceTranscode != `boolean`) {
    throw TypeError(`options.audio.forceTranscode, when provided, must be a boolean.`);
  }
  if (e?.codec !== undefined && !N.includes(e.codec)) {
    throw TypeError(`options.audio.codec, when provided, must be one of: ${N.join(`, `)}.`);
  }
  if (e?.bitrate !== undefined && !(e.bitrate instanceof rc) && (!Number.isInteger(e.bitrate) || e.bitrate <= 0)) {
    throw TypeError(`options.audio.bitrate, when provided, must be a positive integer or a quality.`);
  }
  if (e?.numberOfChannels !== undefined && (!Number.isInteger(e.numberOfChannels) || e.numberOfChannels <= 0)) {
    throw TypeError(`options.audio.numberOfChannels, when provided, must be a positive integer.`);
  }
  if (e?.sampleRate !== undefined && (!Number.isInteger(e.sampleRate) || e.sampleRate <= 0)) {
    throw TypeError(`options.audio.sampleRate, when provided, must be a positive integer.`);
  }
  if (e?.sampleFormat !== undefined && ![`u8`, `s16`, `s32`, `f32`].includes(e.sampleFormat)) {
    throw TypeError(`options.audio.sampleFormat, when provided, must be one of: u8, s16, s32, f32.`);
  }
  if (e?.process !== undefined && typeof e.process != `function`) {
    throw TypeError(`options.audio.process, when provided, must be a function.`);
  }
  if (e?.processedNumberOfChannels !== undefined && (!Number.isInteger(e.processedNumberOfChannels) || e.processedNumberOfChannels <= 0)) {
    throw TypeError(`options.audio.processedNumberOfChannels, when provided, must be a positive integer.`);
  }
  if (e?.processedSampleRate !== undefined && (!Number.isInteger(e.processedSampleRate) || e.processedSampleRate <= 0)) {
    throw TypeError(`options.audio.processedSampleRate, when provided, must be a positive integer.`);
  }
  if (e?.group !== undefined && !(e.group instanceof Sp) && (!Array.isArray(e.group) || !e.group.every(e => {
    return e instanceof Sp;
  }))) {
    throw TypeError(`options.audio.group, when provided, must be an OutputTrackGroup or an array of OutputTrackGroups.`);
  }
};
var Dp = 2;
var Op = 48000;
var kp = class e {
  static async init(t) {
    let n = new e(t);
    await n._init();
    return n;
  }
  constructor(e) {
    this._addedCounts = {
      video: 0,
      audio: 0,
      subtitle: 0
    };
    this._totalTrackCount = 0;
    this._nextOutputTrackId = 0;
    this._outputTrackIds = [];
    this._outputOwnTrackGroups = [];
    this._trackPromises = [];
    this._executed = false;
    this._synchronizer = new Mp();
    this._totalDuration = null;
    this._maxTimestamps = new Map();
    this._canceled = false;
    this.onProgress = undefined;
    this._computeProgress = false;
    this._lastProgress = 0;
    this.isValid = false;
    this.utilizedTracks = [];
    this.discardedTracks = [];
    if (!e || typeof e != `object`) {
      throw TypeError(`options must be an object.`);
    }
    if (!(e.input instanceof cl)) {
      throw TypeError(`options.input must be an Input.`);
    }
    if (!(e.output instanceof wp)) {
      throw TypeError(`options.output must be an Output.`);
    }
    if (e.tracks !== undefined && e.tracks !== `all` && e.tracks !== `primary`) {
      throw TypeError(`options.tracks, when provided, must be either 'all' or 'primary'.`);
    }
    if (e.output._tracks.length > 0 || Object.keys(e.output._metadataTags).length > 0 || e.output.state !== `pending`) {
      throw TypeError(`options.output must be fresh: no tracks or metadata tags added and not started.`);
    }
    if (e.video !== undefined && typeof e.video != `function`) {
      if (Array.isArray(e.video)) {
        for (let t of e.video) {
          Tp(t);
        }
      } else {
        Tp(e.video);
      }
    }
    if (e.audio !== undefined && typeof e.audio != `function`) {
      if (Array.isArray(e.audio)) {
        for (let t of e.audio) {
          Ep(t);
        }
      } else {
        Ep(e.audio);
      }
    }
    if (e.trim !== undefined && (!e.trim || typeof e.trim != `object`)) {
      throw TypeError(`options.trim, when provided, must be an object.`);
    }
    if (e.trim?.start !== undefined && !Number.isFinite(e.trim.start)) {
      throw TypeError(`options.trim.start, when provided, must be a finite number.`);
    }
    if (e.trim?.end !== undefined && !Number.isFinite(e.trim.end)) {
      throw TypeError(`options.trim.end, when provided, must be a finite number.`);
    }
    if (e.trim?.start !== undefined && e.trim.end !== undefined && e.trim.start >= e.trim.end) {
      throw TypeError(`options.trim.start must be less than options.trim.end.`);
    }
    if (e.tags !== undefined && (typeof e.tags != `object` || !e.tags) && typeof e.tags != `function`) {
      throw TypeError(`options.tags, when provided, must be an object or a function.`);
    }
    if (typeof e.tags == `object`) {
      _t(e.tags);
    }
    if (e.showWarnings !== undefined && typeof e.showWarnings != `boolean`) {
      throw TypeError(`options.showWarnings, when provided, must be a boolean.`);
    }
    this._options = e;
    this.input = e.input;
    this.output = e.output;
    let {
      promise: t,
      resolve: n
    } = E();
    this._started = t;
    this._start = n;
  }
  async _init() {
    let e = await this.input.getFormat();
    let t;
    let r = this._options.tracks;
    if (r === undefined) {
      if (e.name.includes(`(HLS)`)) {
        r = `primary`;
      } else {
        r = `all`;
      }
    }
    if (r === `all`) {
      t = await this.input.getTracks();
    } else if (r === `primary`) {
      t = [await this.input.getPrimaryVideoTrack(), await this.input.getPrimaryAudioTrack()].filter(e => {
        return e !== null;
      });
    } else {
      D(r);
      n(false);
    }
    let i = this.output.format.getSupportedTrackCounts();
    let a = 1;
    let o = 1;
    let s = [];
    let c = [];
    for (let e of t) {
      let t;
      if (e.isVideoTrack()) {
        if (this._options.video) {
          if (typeof this._options.video == `function`) {
            let n = (await this._options.video(e, a)) ?? {};
            if (Array.isArray(n)) {
              for (let e of n) {
                Tp(e);
              }
            } else {
              Tp(n);
            }
            if (Array.isArray(n)) {
              t = n;
            } else {
              t = [n];
            }
            a++;
          } else {
            if (Array.isArray(this._options.video)) {
              t = this._options.video;
            } else {
              t = [this._options.video];
            }
          }
        } else {
          t = [{}];
        }
      } else if (e.isAudioTrack()) {
        if (this._options.audio) {
          if (typeof this._options.audio == `function`) {
            let n = (await this._options.audio(e, o)) ?? {};
            if (Array.isArray(n)) {
              for (let e of n) {
                Ep(e);
              }
            } else {
              Ep(n);
            }
            if (Array.isArray(n)) {
              t = n;
            } else {
              t = [n];
            }
            o++;
          } else {
            if (Array.isArray(this._options.audio)) {
              t = this._options.audio;
            } else {
              t = [this._options.audio];
            }
          }
        } else {
          t = [{}];
        }
      } else {
        n(false);
      }
      let r = t.filter(e => {
        return e.discard;
      });
      for (let t of r) {
        this.discardedTracks.push({
          track: e,
          reason: `discarded_by_user`,
          trackOptions: t
        });
      }
      if (t.length === r.length) {
        if (t.length === 0) {
          this.discardedTracks.push({
            track: e,
            reason: `discarded_by_user`,
            trackOptions: {}
          });
        }
        continue;
      }
      let i = t.filter(e => {
        return !e.discard;
      });
      s.push(e);
      c.push(i);
    }
    if (this._options.trim?.start === undefined) {
      this._startTimestamp = Math.max(await this.input.getFirstTimestamp(s), 0);
    } else {
      this._startTimestamp = this._options.trim.start;
    }
    this._endTimestamp = Math.max(this._options.trim?.end ?? Infinity, this._startTimestamp);
    for (let e = 0; e < s.length; e++) {
      let t = s[e];
      let r = c[e];
      for (let e of r) {
        if (this._totalTrackCount === i.total.max) {
          this.discardedTracks.push({
            track: t,
            reason: `max_track_count_reached`,
            trackOptions: e
          });
          continue;
        }
        if (this._addedCounts[t.type] === i[t.type].max) {
          this.discardedTracks.push({
            track: t,
            reason: `max_track_count_of_type_reached`,
            trackOptions: e
          });
          continue;
        }
        let r = this._nextOutputTrackId++;
        if (t.isVideoTrack()) {
          await this._processVideoTrack(t, e, r);
        } else if (t.isAudioTrack()) {
          await this._processAudioTrack(t, e, r);
        } else {
          n(false);
        }
      }
    }
    for (let e = 0; e < this.utilizedTracks.length - 1; e++) {
      for (let t = e + 1; t < this.utilizedTracks.length; t++) {
        let r = this.utilizedTracks[e];
        let i = this.utilizedTracks[t];
        let a = this._outputOwnTrackGroups[e];
        let o = this._outputOwnTrackGroups[t];
        n(a !== undefined);
        n(o !== undefined);
        if (a && o && r.canBePairedWith(i)) {
          a.pairWith(o);
        }
      }
    }
    let l = await this.input.getMetadataTags();
    let u;
    if (this._options.tags) {
      let e = typeof this._options.tags == `function` ? await this._options.tags(l) : this._options.tags;
      _t(e);
      u = e;
    } else {
      u = l;
    }
    let d = e.mimeType === this.output.format.mimeType;
    let f = l.raw === u.raw;
    if (l.raw && f && !d) {
      delete u.raw;
    }
    this.output.setMetadataTags(u);
    this.isValid = this._totalTrackCount >= i.total.min && this._addedCounts.video >= i.video.min && this._addedCounts.audio >= i.audio.min && this._addedCounts.subtitle >= i.subtitle.min;
    if (this._options.showWarnings ?? true) {
      let e = [];
      let t = this.discardedTracks.filter(e => {
        return e.reason !== `discarded_by_user`;
      });
      if (t.length > 0) {
        e.push(`Some tracks had to be discarded from the conversion:`, t);
      }
      if (!this.isValid) {
        if (e.length > 0) {
          e.push(`

`);
        }
        e.push(this._getInvalidityExplanation().join(``));
      }
      if (e.length > 0) {
        k._warn(...e);
      }
    }
  }
  _getInvalidityExplanation() {
    let e = [];
    if (this.discardedTracks.length === 0) {
      e.push(`Due to missing tracks, this conversion cannot be executed.`);
    } else {
      let t = this.discardedTracks.every(e => {
        return e.reason === `discarded_by_user` || e.reason === `no_encodable_target_codec`;
      }) && this.discardedTracks.some(e => {
        return e.reason === `no_encodable_target_codec`;
      });
      e.push(`Due to discarded tracks, this conversion cannot be executed.`);
      if (t) {
        let t = this.discardedTracks.flatMap(e => {
          if (e.reason === `discarded_by_user`) {
            return [];
          } else {
            if (e.track.type === `video`) {
              return this.output.format.getSupportedVideoCodecs();
            } else {
              if (e.track.type === `audio`) {
                return this.output.format.getSupportedAudioCodecs();
              } else {
                return this.output.format.getSupportedSubtitleCodecs();
              }
            }
          }
        });
        let n = [...new Set(t)];
        if (n.length === 1) {
          e.push(`\nTracks were discarded because your environment is not able to encode '${n[0]}'.`);
        } else {
          e.push(`
Tracks were discarded because your environment is not able to encode any of the following codecs: ${n.map(e => {
            return `'${e}'`;
          }).join(`, `)}.`);
        }
        if (n.includes(`mp3`)) {
          e.push(`
The @mediabunny/mp3-encoder extension package provides support for encoding MP3.`);
        }
        if (n.includes(`aac`)) {
          e.push(`
The @mediabunny/aac-encoder extension package provides support for encoding AAC.`);
        }
        if (n.includes(`ac3`) || n.includes(`eac3`)) {
          e.push(`
The @mediabunny/ac3 extension package provides support for encoding and decoding AC-3/E-AC-3.`);
        }
        if (n.includes(`flac`)) {
          e.push(`
The @mediabunny/flac-encoder extension package provides support for encoding FLAC.`);
        }
      } else {
        e.push(`
Check the discardedTracks field for more info.`);
      }
    }
    return e;
  }
  async execute() {
    if (!this.isValid) {
      throw Error(`Cannot execute this conversion because its output configuration is invalid. Make sure to always check the isValid field before executing a conversion.
${this._getInvalidityExplanation().join(``)}`);
    }
    if (this._executed) {
      throw Error(`Conversion cannot be executed twice.`);
    }
    this._executed = true;
    for (let e of this._outputTrackIds) {
      this._synchronizer.declareTrack(e);
    }
    if (this.onProgress) {
      let e = [...new Set(this.utilizedTracks)].map(async e => {
        if (await e.isLive()) {
          return Infinity;
        } else {
          return (await e.getDurationFromMetadata()) ?? (await e.computeDuration());
        }
      });
      let t = Math.max(0, ...(await Promise.all(e)));
      this._computeProgress = true;
      this._totalDuration = Math.min(t - this._startTimestamp, this._endTimestamp - this._startTimestamp);
      for (let e of this._outputTrackIds) {
        this._maxTimestamps.set(e, 0);
      }
      this.onProgress?.(0, 0);
    }
    await this.output.start();
    this._start();
    try {
      await Promise.all(this._trackPromises);
    } catch (e) {
      if (!this._canceled) {
        this.cancel();
      }
      throw e;
    }
    if (this._canceled) {
      throw new Ap();
    }
    await this.output.finalize();
    if (this._computeProgress) {
      let e = Math.min(...this._maxTimestamps.values());
      this.onProgress?.(1, e);
    }
  }
  async cancel() {
    if (this.output.state !== `finalizing` && this.output.state !== `finalized`) {
      if (this._canceled) {
        k._warn(`Conversion already canceled.`);
        return;
      }
      this._canceled = true;
      await this.output.cancel();
    }
  }
  async _processVideoTrack(e, t, i) {
    let a = await e.getCodec();
    if (!a) {
      this.discardedTracks.push({
        track: e,
        reason: `unknown_source_codec`,
        trackOptions: t
      });
      return;
    }
    let o;
    let s = await e.getRotation();
    let c = r(s + (t.rotate ?? 0));
    let l = c;
    let u = this.output.format.supportsVideoRotationMetadata && (t.allowRotationMetadata ?? true);
    let d = await e.getSquarePixelWidth();
    let f = await e.getSquarePixelHeight();
    let [p, m] = c % 180 == 0 ? [d, f] : [f, d];
    let h = t.crop;
    h &&= ks(h, p, m);
    let [g, _] = h ? [h.width, h.height] : [p, m];
    let v = g;
    let y = _;
    let b = v / y;
    if (t.width !== undefined && t.height === undefined) {
      v = dt(t.width);
      y = dt(Math.round(v / b));
    } else if (t.width === undefined && t.height !== undefined) {
      y = dt(t.height);
      v = dt(Math.round(y * b));
    } else if (t.width !== undefined && t.height !== undefined) {
      v = dt(t.width);
      y = dt(t.height);
    }
    let x = await e.getFirstTimestamp();
    let S = this.output.format.getSupportedVideoCodecs();
    let C = !!t.forceTranscode || x < this._startTimestamp || !!t.frameRate || t.keyFrameInterval !== undefined || t.process !== undefined || t.bitrate !== undefined || !S.includes(a) || t.codec && t.codec !== a || v !== g || y !== _ || c !== 0 && !u || !!h;
    let ee = t.alpha ?? `discard`;
    if (C) {
      if (!(await e.canDecode())) {
        this.discardedTracks.push({
          track: e,
          reason: `undecodable_source_codec`,
          trackOptions: t
        });
        return;
      }
      if (t.codec) {
        S = S.filter(e => {
          return e === t.codec;
        });
      }
      let a = t.bitrate ?? sc;
      let p = await _c(S, {
        width: t.process && t.processedWidth ? t.processedWidth : v,
        height: t.process && t.processedHeight ? t.processedHeight : y,
        bitrate: a
      });
      if (!p) {
        this.discardedTracks.push({
          track: e,
          reason: `no_encodable_target_codec`,
          trackOptions: t
        });
        return;
      }
      let m = {
        codec: p,
        bitrate: a,
        keyFrameInterval: t.keyFrameInterval,
        sizeChangeBehavior: t.fit ?? `passThrough`,
        alpha: ee,
        hardwareAcceleration: t.hardwareAcceleration,
        transform: {}
      };
      n(m.transform);
      let b = v !== g || y !== _ || c !== 0 && (!u || t.process !== undefined) || !!h || d !== (await e.getCodedWidth()) || f !== (await e.getCodedHeight());
      if (!b) {
        let t = new wp({
          format: new ap(),
          target: new Gd()
        });
        let n = new Pf(m);
        t.addVideoTrack(n);
        await t.start();
        let r = await new Kc(e).getSample(x);
        if (r) {
          try {
            await n.add(r);
            r.close();
            await t.finalize();
          } catch (e) {
            k._warn(`An error occurred when probing encoder support. Falling back to rerender path.`, e);
            t.cancel();
            b = true;
            m.transform.force = true;
          }
        } else {
          await t.cancel();
        }
      }
      if (t.frameRate) {
        m.transform.frameRate = t.frameRate;
      }
      if (t.process) {
        m.transform.process = t.process;
      }
      if (b) {
        l = 0;
        m.transform.width = v;
        m.transform.height = y;
        m.transform.fit = t.fit ?? `fill`;
        m.transform.rotate = r(c - s);
        m.transform.crop = h;
        m.transform.alpha = ee;
      }
      let C = null;
      m.onEncodedSample = e => {
        C = e.timestamp;
      };
      let w = new Pf(m);
      o = w;
      this._trackPromises.push((async () => {
        await this._started;
        let t = new Kc(e);
        for await (let e of t.samples(this._startTimestamp, this._endTimestamp)) {
          if (this._canceled) {
            e.close();
            return;
          }
          let t = Math.max(e.timestamp - this._startTimestamp, 0);
          e.setTimestamp(t);
          this._reportProgress(i, e.timestamp + e.duration);
          await w.add(e);
          if (C !== null && this._synchronizer.shouldWait(i, C)) {
            await this._synchronizer.wait(C);
          }
          e.close();
        }
        w.close();
        this._synchronizer.closeTrack(i);
      })());
    } else {
      let t = new kf(a);
      o = t;
      this._trackPromises.push((async () => {
        await this._started;
        let r = new Lc(e);
        let a = {
          decoderConfig: (await e.getDecoderConfig()) ?? undefined
        };
        for await (let e of r.packets(undefined, undefined, {
          verifyKeyPackets: true
        })) {
          if (this._canceled) {
            return;
          }
          if (e.timestamp >= this._endTimestamp) {
            break;
          }
          let r = e.clone({
            timestamp: e.timestamp - this._startTimestamp,
            sideData: ee === `discard` ? {} : e.sideData
          });
          n(r.timestamp >= 0);
          this._reportProgress(i, r.timestamp + r.duration);
          await t.add(r, a);
          if (this._synchronizer.shouldWait(i, r.timestamp)) {
            await this._synchronizer.wait(r.timestamp);
          }
        }
        t.close();
        this._synchronizer.closeTrack(i);
      })());
    }
    let w = null;
    if (!t.group) {
      w = new Sp();
    }
    let te = await e.getLanguageCode();
    this.output.addVideoTrack(o, {
      frameRate: t.frameRate,
      languageCode: Ce(te) ? te : undefined,
      name: (await e.getName()) ?? undefined,
      disposition: await e.getDisposition(),
      rotation: l,
      group: w ?? t.group
    });
    this._addedCounts.video++;
    this._totalTrackCount++;
    this.utilizedTracks.push(e);
    this._outputTrackIds.push(i);
    this._outputOwnTrackGroups.push(w);
  }
  async _processAudioTrack(e, t, r) {
    let i = await e.getCodec();
    if (!i) {
      this.discardedTracks.push({
        track: e,
        reason: `unknown_source_codec`,
        trackOptions: t
      });
      return;
    }
    let a;
    let o = await e.getNumberOfChannels();
    let s = await e.getSampleRate();
    let c = await e.getFirstTimestamp();
    let l = t.numberOfChannels ?? o;
    let u = t.sampleRate ?? s;
    let d = c < this._startTimestamp;
    let f = c > this._startTimestamp && !this.output.format.supportsTimestampedMediaData;
    let p = this.output.format.getSupportedAudioCodecs();
    if (!t.forceTranscode && !t.bitrate && l === o && u === s && !d && !f && p.includes(i) && (!t.codec || t.codec === i) && !t.process && t.sampleFormat === undefined) {
      let t = new Rf(i);
      a = t;
      this._trackPromises.push((async () => {
        await this._started;
        let i = new Lc(e);
        let a = {
          decoderConfig: (await e.getDecoderConfig()) ?? undefined
        };
        for await (let e of i.packets()) {
          if (this._canceled) {
            return;
          }
          if (e.timestamp >= this._endTimestamp) {
            break;
          }
          let i = e.clone({
            timestamp: e.timestamp - this._startTimestamp
          });
          n(i.timestamp >= 0);
          this._reportProgress(r, i.timestamp + i.duration);
          await t.add(i, a);
          if (this._synchronizer.shouldWait(r, i.timestamp)) {
            await this._synchronizer.wait(i.timestamp);
          }
        }
        t.close();
        this._synchronizer.closeTrack(r);
      })());
    } else {
      if (!(await e.canDecode())) {
        this.discardedTracks.push({
          track: e,
          reason: `undecodable_source_codec`,
          trackOptions: t
        });
        return;
      }
      let i = null;
      if (t.codec) {
        p = p.filter(e => {
          return e === t.codec;
        });
      }
      let d = t.bitrate ?? sc;
      let m = await hc(p, {
        numberOfChannels: t.process && t.processedNumberOfChannels ? t.processedNumberOfChannels : l,
        sampleRate: t.process && t.processedSampleRate ? t.processedSampleRate : u,
        bitrate: d
      });
      if (!m.some(e => {
        return Dt.includes(e);
      }) && p.some(e => {
        return Dt.includes(e);
      }) && (l !== Dp || u !== Op)) {
        let e = (await hc(p, {
          numberOfChannels: Dp,
          sampleRate: Op,
          bitrate: d
        })).find(e => {
          return Dt.includes(e);
        });
        if (e) {
          i = e;
          l = Dp;
          u = Op;
        }
      } else {
        i = m[0] ?? null;
      }
      if (i === null) {
        this.discardedTracks.push({
          track: e,
          reason: `no_encodable_target_codec`,
          trackOptions: t
        });
        return;
      }
      let h = {
        codec: i,
        bitrate: d,
        transform: {
          sampleFormat: t.sampleFormat,
          process: t.process
        }
      };
      n(h.transform);
      if (l !== o) {
        h.transform.numberOfChannels = l;
      }
      if (u !== s) {
        h.transform.sampleRate = u;
      }
      let g = null;
      h.onEncodedSample = e => {
        g = e.timestamp;
      };
      let _ = new Bf(h);
      a = _;
      this._trackPromises.push((async () => {
        await this._started;
        let t = new Xc(e);
        for await (let e of t.samples(this._startTimestamp, this._endTimestamp)) {
          if (this._canceled) {
            e.close();
            return;
          }
          if (f) {
            let t = c - this._startTimestamp;
            let n = Math.round(t * s);
            let i = Vs(e.format);
            let a = new Uint8Array(i * n * o);
            if (e.format === `u8` || e.format === `u8-planar`) {
              a.fill(128);
            }
            let l = new Bs({
              data: a,
              format: e.format,
              numberOfChannels: o,
              sampleRate: s,
              timestamp: 0
            });
            await this._registerAudioSample(l, _, r, () => {
              return g;
            });
            f = false;
          }
          let t = 0;
          let n = e.numberOfFrames;
          if (e.timestamp < this._startTimestamp) {
            t = Math.round((this._startTimestamp - e.timestamp) * e.sampleRate);
          }
          if (e.timestamp + e.duration > this._endTimestamp) {
            n = Math.round((this._endTimestamp - e.timestamp) * e.sampleRate);
          }
          if (t > 0 || n < e.numberOfFrames) {
            let r = e.trim(t, n);
            e.close();
            e = r;
            if (e.numberOfFrames === 0) {
              e.close();
              continue;
            }
          }
          e.setTimestamp(e.timestamp - this._startTimestamp);
          await this._registerAudioSample(e, _, r, () => {
            return g;
          });
        }
        _.close();
        this._synchronizer.closeTrack(r);
      })());
    }
    let m = null;
    if (!t.group) {
      m = new Sp();
    }
    let h = await e.getLanguageCode();
    this.output.addAudioTrack(a, {
      languageCode: Ce(h) ? h : undefined,
      name: (await e.getName()) ?? undefined,
      disposition: await e.getDisposition(),
      group: m ?? t.group
    });
    this._addedCounts.audio++;
    this._totalTrackCount++;
    this.utilizedTracks.push(e);
    this._outputTrackIds.push(r);
    this._outputOwnTrackGroups.push(m);
  }
  async _registerAudioSample(e, t, n, r) {
    this._reportProgress(n, e.timestamp + e.duration);
    await t.add(e);
    e.close();
    let i = r();
    if (i !== null && this._synchronizer.shouldWait(n, i)) {
      await this._synchronizer.wait(i);
    }
  }
  _reportProgress(e, t) {
    if (!this._computeProgress) {
      return;
    }
    n(this._totalDuration !== null);
    this._maxTimestamps.set(e, Math.max(t, this._maxTimestamps.get(e)));
    let r = Math.min(...this._maxTimestamps.values());
    let i = O(r / this._totalDuration, 0, 1);
    if (i !== this._lastProgress) {
      this._lastProgress = i;
      this.onProgress?.(i, r);
    }
  }
};
var Ap = class extends Error {
  constructor(e = `Conversion has been canceled.`) {
    super(e);
    this.name = `ConversionCanceledError`;
  }
};
var jp = 1;
var Mp = class {
  constructor() {
    this.maxTimestamps = new Map();
    this.resolvers = [];
  }
  declareTrack(e) {
    this.maxTimestamps.set(e, 0);
  }
  shouldWait(e, t) {
    let r = this.maxTimestamps.get(e);
    n(r !== undefined);
    this.maxTimestamps.set(e, Math.max(t, r));
    return t - this.computeMinAndMaybeResolve() > jp;
  }
  wait(e) {
    let {
      promise: t,
      resolve: n
    } = E();
    this.resolvers.push({
      timestamp: e,
      resolve: n
    });
    return t;
  }
  closeTrack(e) {
    this.maxTimestamps.delete(e);
    this.computeMinAndMaybeResolve();
  }
  computeMinAndMaybeResolve() {
    let e = Infinity;
    for (let [, t] of this.maxTimestamps) {
      e = Math.min(e, t);
    }
    for (let t = 0; t < this.resolvers.length; t++) {
      let n = this.resolvers[t];
      if (n.timestamp - e < jp) {
        n.resolve();
        this.resolvers.splice(t, 1);
        t--;
      }
    }
    return e;
  }
};
var Np = Symbol.for(`mediabunny loaded`);
if (globalThis[Np]) {
  k._error(`[WARNING]
Mediabunny was loaded twice. This will likely cause Mediabunny not to work correctly. Check if multiple dependencies are importing different versions of Mediabunny, or if something is being bundled incorrectly.`);
}
globalThis[Np] = true;
export { _cmp_xs, e, t, n, r, i, a, o, s, c, l, u, d, f, p, m, h, g, _, v, y, b, x, S, C, ee, w, te, ne, re, T, ie, E, ae, oe, se, ce, le, D, ue, de, fe, pe, me, he, O, ge, _e, ve, ye, be, xe, Se, Ce, we, Te, Ee, De, Oe, ke, Ae, je, Me, Ne, Pe, Fe, Ie, Le, Re, ze, Be, Ve, He, Ue, We, Ge, Ke, qe, Je, Ye, Xe, Ze, Qe, $e, et, tt, nt, rt, it, at, ot, st, ct, lt, ut, dt, ft, pt, mt, k, ht, gt, _t, vt, yt, bt, A, xt, St, Ct, wt, Tt, Et, j, M, Dt, N, Ot, kt, At, jt, Mt, Nt, Pt, Ft, It, Lt, Rt, zt, Bt, Vt, Ht, Ut, Wt, Gt, Kt, qt, Jt, Yt, Xt, Zt, Qt, $t, en, tn, nn, rn, an, on, sn, cn, ln, un, dn, fn, pn, mn, hn, gn, _n, vn, P, F, yn, bn, xn, Sn, Cn, wn, Tn, En, Dn, On, kn, An, jn, Mn, Nn, Pn, Fn, In, Ln, Rn, zn, Bn, Vn, Hn, Un, Wn, Gn, Kn, qn, Jn, Yn, Xn, Zn, Qn, $n, er, tr, nr, rr, ir, ar, or, sr, cr, lr, ur, dr, fr, pr, mr, hr, gr, _r, vr, yr, I, br, xr, Sr, Cr, wr, Tr, Er, Dr, Or, kr, Ar, jr, Mr, Nr, Pr, Fr, Ir, Lr, Rr, zr, Br, Vr, Hr, Ur, Wr, Gr, Kr, qr, Jr, Yr, Xr, Zr, Qr, $r, ei, ti, ni, ri, ii, ai, oi, L, si, ci, li, ui, di, fi, pi, mi, hi, gi, R, _i, vi, yi, bi, xi, Si, Ci, wi, Ti, Ei, Di, Oi, ki, Ai, ji, Mi, Ni, Pi, Fi, Ii, Li, Ri, zi, Bi, Vi, Hi, Ui, Wi, Gi, Ki, qi, Ji, Yi, Xi, Zi, Qi, $i, ea, ta, na, ra, ia, aa, oa, sa, ca, la, ua, da, fa, pa, ma, ha, ga, _a, va, ya, ba, xa, Sa, Ca, wa, Ta, Ea, Da, Oa, ka, Aa, ja, Ma, Na, Pa, Fa, Ia, La, Ra, za, Ba, Va, Ha, Ua, Wa, Ga, Ka, qa, Ja, Ya, Xa, Za, Qa, $a, eo, to, no, ro, io, ao, oo, so, co, lo, uo, fo, po, mo, ho, go, _o, vo, yo, bo, xo, So, Co, wo, To, Eo, Do, Oo, ko, Ao, jo, Mo, No, Po, Fo, Io, Lo, Ro, zo, Bo, Vo, Ho, Uo, Wo, Go, Ko, qo, Jo, Yo, Xo, Zo, Qo, $o, es, ts, ns, rs, is, as, os, ss, cs, ls, us, ds, fs, ps, ms, hs, gs, _s, vs, ys, bs, Ss, Cs, ws, Ts, Es, Ds, Os, ks, As, js, Ms, Ns, Ps, Fs, Is, Ls, Rs, zs, Bs, Vs, Hs, Us, Ws, Gs, Ks, qs, Js, Ys, Xs, Zs, Qs, $s, ec, tc, nc, rc, ic, ac, oc, sc, cc, lc, uc, dc, fc, pc, mc, hc, gc, _c, vc, yc, bc, xc, Sc, Cc, wc, Tc, Ec, Dc, Oc, kc, Ac, jc, Mc, Nc, Pc, Fc, Ic, Lc, Rc, zc, Bc, Vc, Hc, Uc, Wc, Gc, Kc, Jc, Yc, Xc, Zc, Qc, z, $c, el, tl, nl, rl, il, al, ol, sl, cl, ll, ul, dl, fl, pl, B, V, ml, H, hl, gl, _l, U, vl, yl, bl, xl, Sl, Cl, wl, Tl, El, W, Dl, Ol, G, kl, Al, jl, Ml, Nl, Pl, Fl, Il, Ll, Rl, zl, Bl, Vl, Hl, Ul, Wl, Gl, Kl, ql, Jl, Yl, K, Xl, q, J, Zl, Ql, Y, $l, eu, tu, nu, ru, iu, au, X, ou, su, cu, Z, Q, lu, uu, du, fu, pu, mu, hu, gu, _u, vu, yu, bu, xu, Su, Cu, wu, Tu, Eu, Du, Ou, ku, Au, ju, Mu, Nu, Pu, Fu, Iu, Lu, Ru, zu, Bu, Vu, Hu, Uu, Wu, Gu, Ku, qu, Ju, Yu, Xu, Zu, Qu, $u, ed, td, nd, rd, id, ad, od, sd, cd, ld, ud, dd, fd, pd, md, hd, gd, _d, vd, yd, bd, xd, Sd, Cd, wd, Td, Ed, Dd, Od, kd, Ad, jd, Md, Nd, Pd, Fd, Id, Ld, Rd, zd, Bd, Vd, Hd, Ud, Wd, Gd, Kd, qd, Jd, Yd, Xd, $, Zd, Qd, $d, ef, tf, nf, rf, af, of, sf, cf, lf, uf, df, ff, pf, mf, hf, gf, _f, vf, yf, bf, xf, Sf, Cf, wf, Tf, Ef, Df, Of, kf, Af, jf, Mf, Nf, Pf, Ff, Lf, Rf, zf, Bf, Vf, Hf, Uf, Wf, Gf, Kf, qf, Jf, Yf, Xf, Zf, Qf, $f, ep, tp, np, rp, ip, ap, op, sp, cp, lp, up, dp, fp, pp, mp, hp, gp, _p, vp, yp, bp, xp, Sp, Cp, wp, Tp, Ep, Dp, Op, kp, Ap, jp, Mp, Np };