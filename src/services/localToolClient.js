// 切自 src/App.js L742-912（localTool 上传/缩略图/视频封面客户端层）。剪切不重写，混淆名原样保留。
import { Hr, Rr } from '../config/constants.js';
import { qr } from '../utils/fileUtils.js';
import { t as Hn } from '../entry.js';

function Vr(e) {
  if (!e) return null;
  let t = e.split(`?`)[0],
    n = t.indexOf(`/files/resources/`);
  if (n < 0) return null;
  let r = t.slice(n + 17),
    i = r.lastIndexOf(`/`);
  return i < 0 ? {
    subfolder: ``,
    filename: r
  } : {
    subfolder: r.slice(0, i),
    filename: r.slice(i + 1)
  };
}
var localToolAvailableCache = null,
  lastStatusCheckTime = 0,
  statusCheckIntervalMs = 3e3;
async function Kr() {
  let e = Date.now();
  if (localToolAvailableCache !== null && e - lastStatusCheckTime < statusCheckIntervalMs) return localToolAvailableCache;
  try {
    let e = new AbortController(),
      t = setTimeout(() => e.abort(), 1e3),
      n = await fetch(`${Hr}/api/status`, {
        signal: e.signal
      });
    if (clearTimeout(t), localToolAvailableCache = n.ok, n.ok) try {
      let e = await n.clone().json();
      typeof e?.ffmpeg == `boolean` && e.ffmpeg;
    } catch {}
  } catch {
    localToolAvailableCache = false;
  }
  return lastStatusCheckTime = e, localToolAvailableCache;
}
async function Xr(e, t = {}) {
  if (!(await Kr())) return null;
  try {
    let {
        blob: n,
        ext: r
      } = await qr(e),
      i = t.filename || `${Qr(n.type)}_${Date.now()}_${$r()}.${r}`,
      a = new FormData();
    a.append(`file`, n, i), a.append(`subfolder`, t.subfolder ?? `canvas`);
    let o = await fetch(`${Hr}/api/files/upload`, {
      method: `POST`,
      body: a
    });
    if (!o.ok) return null;
    let s = await o.json();
    return s?.url ? {
      url: s.url,
      thumbnailUrl: s.thumbnailUrl,
      path: s.path
    } : null;
  } catch (e) {
    return console.warn(`[uploadHelper] uploadToLocalTool failed:`, e), null;
  }
}
async function Zr(e, t = {}) {
  if (!e || typeof e != `string` || !(await Kr())) return null;
  try {
    let n = new FormData();
    n.append(`fileUrl`, e), n.append(`subfolder`, t.subfolder ?? `canvas`), t.filename && n.append(`filename`, t.filename);
    let r = await fetch(`${Hr}/api/files/upload`, {
      method: `POST`,
      body: n
    });
    if (!r.ok) return null;
    let i = await r.json();
    return i?.url ? {
      url: i.url,
      thumbnailUrl: i.thumbnailUrl,
      path: i.path
    } : null;
  } catch (e) {
    return console.warn(`[uploadHelper] uploadRemoteUrlToLocalTool failed:`, e), null;
  }
}
function Qr(e) {
  return e.startsWith(`image/`) ? `img` : e.startsWith(`video/`) ? `vid` : e.startsWith(`audio/`) ? `aud` : `file`;
}
function $r() {
  return Math.random().toString(36).slice(2, 8);
}
var thumbnailCache = new Map(),
  pendingThumbnails = new Map(),
  thumbnailCacheTtlMs = 300 * 1e3;
async function ri(e, t = {}) {
  if (!e || !e.includes(`/files/`)) return null;
  let n = `${e}|${t.maxDim ?? ``}|${t.quality ?? ``}`,
    r = Date.now(),
    i = thumbnailCache.get(n);
  if (i && i.expireAt > r) return i.value;
  let a = pendingThumbnails.get(n);
  if (a) return a;
  let o = (async () => {
    if (!(await Kr())) return null;
    try {
      let n = new URLSearchParams({
        url: e
      });
      t.maxDim && n.set(`maxDim`, String(t.maxDim)), t.quality && n.set(`quality`, String(t.quality));
      let r = await fetch(`${Hr}/api/files/thumbnail?${n.toString()}`);
      return r.ok && (await r.json())?.thumbnailUrl || null;
    } catch {
      return null;
    }
  })();
  pendingThumbnails.set(n, o);
  try {
    let e = await o;
    return thumbnailCache.set(n, {
      value: e,
      expireAt: Date.now() + thumbnailCacheTtlMs
    }), e;
  } finally {
    pendingThumbnails.delete(n);
  }
}
async function ii(e, t = {}) {
  if (typeof e == `string` && /^https?:\/\//i.test(e) && !e.startsWith(`data:`)) return t.preferThumbnail && e.includes(`/files/`) ? {
    url: e,
    thumbnailUrl: (await ri(e, {
      maxDim: t.thumbMaxDim,
      quality: t.thumbQuality
    })) || undefined
  } : {
    url: e
  };
  let n = await Xr(e, {
    subfolder: t.subfolder ?? `canvas`,
    generateThumb: !!t.preferThumbnail,
    thumbMaxDim: t.thumbMaxDim,
    thumbQuality: t.thumbQuality
  });
  return n ? {
    url: n.url,
    thumbnailUrl: n.thumbnailUrl
  } : typeof e == `string` ? {
    url: e
  } : {
    url: URL.createObjectURL(e)
  };
}
async function ai(e) {
  if (!e || typeof e != `string` || !e.includes(`/files/`) || !(await Kr())) return false;
  let t = Vr(e);
  if (!t) return false;
  let n = `${t.filename}${Rr}`;
  try {
    let {
      captureVideoFrameBlob: r
    } = await Hn(async () => {
      let {
        captureVideoFrameBlob: e
      } = await import(`../vendor/captureVideoFrame.js`);
      return {
        captureVideoFrameBlob: e
      };
    }, [], import.meta.url);
    return !!(await Xr(await r(e), {
      subfolder: t.subfolder,
      filename: n
    }))?.url;
  } catch (e) {
    return console.warn(`[uploadHelper] ensureVideoPoster failed, will fall back to <video>:`, e), false;
  }
}
export {
  Vr,
  Kr,
  Xr,
  Zr,
  Qr,
  $r,
  ri,
  ii,
  ai
};
