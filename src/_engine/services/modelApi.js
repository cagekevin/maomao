import { LOCAL_MODE_ALLOW_ALL } from '../config.js';
import { r as Vn } from '../entry.js';
import { Q } from '../utils/storage/index.js';
import { ta, Ca, Va } from '../config/constants.js';

var $n = Vn(),
  er = `/api`;
function tr(e) {
  let t = $n.replace(/[\`\s]/g, ``).replace(/\/$/, ``),
    n = (e || t).replace(/[\`\s]/g, ``).trim().replace(/\/$/, ``);
  return n ? /\/api$/i.test(n) ? n : `${n}/api` : `${t}/api`;
}
function nr(e = ``) {
  let t = $n.replace(/[\`\s]/g, ``).replace(/\/+$/, ``),
    n = e.trim().replace(/^\/+|\/+$/g, ``);
  return n ? `${t}/${n}` : t;
}
function rr(e, t) {
  return `${tr(e)}/v1/gateway/ai-app${t.startsWith(`/`) ? t : `/${t}`}`;
}
function ir(e, t) {
  let n = tr(e);
  return t ? `${n}/ai-apps/${encodeURIComponent(t)}` : `${n}/ai-apps`;
}
function ar(e, t) {
  let n = tr($n);
  if (t || !e) return n;
  let r = tr(e),
    i = r.replace(/\/api$/i, ``),
    a = /^https?:\/\/(localhost|127\.0\.0\.1):3000$/i.test(i),
    o = $n.replace(/[`\s]/g, ``).trim().replace(/\/$/, ``),
    s = !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(o);
  return a && s ? n : r;
}
var sr = {
    "Content-Type": `application/json`
  };
function cr(e) {
  return e.startsWith(`http`) ? e : `${$n}${er}${e}`;
}
var yi = {
    text: [],
    image: [],
    video: []
  },
  bi = null,
  LOCAL_MODE_ALLOW_ALL_MODELS = LOCAL_MODE_ALLOW_ALL,
  xi = [],
  Si = null,
  Ci = null,
  wi = 0,
  Ti = new Set(),
  Ei = {};
function Di() {
  Ti.forEach(e => {
    try {
      e();
    } catch {}
  });
}
function Oi() {
  return [...xi];
}
function ki(e) {
  let t = (e || ``).trim();
  if (!t) return null;
  if (LOCAL_MODE_ALLOW_ALL_MODELS) return {
    access: `allowed`
  };
  let n = bi?.entitlements?.[t];
  if (n) return n;
  if (xi.length > 0) {
    let e = xi.find(e => e.modelName === t);
    if (e) return {
      access: e.access,
      reason: e.reason,
      callLimit: e.callLimit,
      usedCount: e.usedCount,
      periodType: e.periodType
    };
  }
  return {
    access: `denied`,
    reason: `权益不够`
  };
}
function Ai(e) {
  let t = ki(e);
  return !t || t.access === `allowed` ? null : t.reason || (t.access === `quota_exceeded` ? `已达到使用次数额度` : `权益不够`);
}
async function ji(e, t, n = false) {
  if (!t || t === `local-mode-token`) {
    xi = [], bi && (bi.entitlements = undefined), LOCAL_MODE_ALLOW_ALL_MODELS = LOCAL_MODE_ALLOW_ALL, Di();
    return;
  }
  if (Ci && !n) return Ci;
  n && (Ci = null), Ci = (async () => {
    try {
      let r = e.replace(/\/$/, ``),
        i = await (await fetch(`${r}/user/model-entitlements`, {
          headers: {
            Authorization: `Bearer ${t}`
          },
          cache: n ? `no-store` : `default`
        })).json();
      if (i.success && i.data) {
        xi = Array.isArray(i.data.models) ? i.data.models : [];
        let e = {};
        for (let t of xi) e[t.modelName] = {
          access: t.access,
          reason: t.reason,
          callLimit: t.callLimit,
          usedCount: t.usedCount,
          periodType: t.periodType,
          source: t.source
        };
        i.data.catalog ? bi = {
          ...(bi || {
            text: [],
            image: [],
            video: [],
            discountVideo: [],
            power: {},
            unit: {},
            currency: {},
            recommended: {},
            descriptions: {}
          }),
          ...i.data.catalog,
          entitlements: e
        } : bi && (bi.entitlements = e), wi = Date.now(), Di();
      }
    } catch (e) {
      console.warn(`[builtinFavorites] 拉取模型权益失败`, e);
    }
  })(), await Ci, n && (Ci = null);
}
function Mi() {
  xi = [], bi && (bi.entitlements = undefined), LOCAL_MODE_ALLOW_ALL_MODELS = true, Di();
}
function Ni(e) {
  return xi.length > 0 ? xi.filter(t => {
    let n = t.builtinCategory || t.category;
    return e === `video` ? n === `video` && !t.isDiscountVideo : n === e;
  }).map(e => e.modelName) : Bi()[e] || [];
}
function Pi() {
  return xi.length > 0 ? xi.filter(e => e.isDiscountVideo).map(e => e.modelName) : Vi();
}
function Fi() {
  return bi;
}
function Ii() {
  return wi;
}
async function Li(e = `/api`, t = false) {
  if (Si && !t) return Si;
  t && (Si = null), Si = (async () => {
    try {
      let n = e.replace(/\/$/, ``),
        r = t ? `?t=${Date.now()}` : ``,
        i = {
          cache: t ? `no-store` : `default`
        };
      await Ri(n, t);
      let a = await (await fetch(`${n}/public/platform/builtin${r}`, i)).json();
      if (a.success && a.data) return bi = a.data, wi = Date.now(), Di(), bi;
    } catch (e) {
      console.warn(`[builtinFavorites] 拉取内置模型失败`, e);
    }
    return bi;
  })();
  try {
    return await Si;
  } finally {
    t && (Si = null);
  }
}
async function Ri(e, t) {
  try {
    let n = t ? `?t=${Date.now()}` : ``,
      r = await (await fetch(`${e}/public/platform/models${n}`, {
        cache: t ? `no-store` : `default`
      })).json();
    if (!r?.success || !Array.isArray(r.data)) return;
    let i = {};
    for (let e of r.data) {
      let t = (e?.name || ``).trim();
      !t || !e.seriesKey && !e.seriesLabel || (i[t] = {
        key: e.seriesKey || e.seriesLabel || t,
        label: e.seriesLabel || e.seriesKey || t
      });
    }
    Ei = i, Di();
  } catch (e) {
    console.warn(`[builtinFavorites] 拉取模型系列失败`, e);
  }
}
function zi(e) {
  return Ti.add(e), () => {
    Ti.delete(e);
  };
}
function Bi() {
  return bi ? {
    text: [...(bi.text || [])],
    image: [...(bi.image || [])],
    video: [...(bi.video || [])]
  } : {
    ...yi
  };
}
function Vi() {
  return bi?.discountVideo ? [...bi.discountVideo] : [];
}
function Hi(e) {
  let t = (e || ``).trim();
  return !t || !bi?.discountVideoSpecs ? null : bi.discountVideoSpecs[t] ?? null;
}
function Ui(e) {
  if (!e) return null;
  let t = e.trim();
  if (!t) return null;
  let n = bi?.power?.[t];
  return typeof n == `number` ? n : null;
}
function Wi(e) {
  if (!e) return null;
  let t = e.trim();
  return t && bi?.unit?.[t] || null;
}
function Gi(e) {
  let t = (e || ``).trim();
  return t && bi?.currency?.[t] === `proxy` ? `proxy` : `compute`;
}
function Ki(e) {
  let t = (e || ``).trim();
  return !t || !bi?.descriptions ? `` : bi.descriptions[t] || ``;
}
function qi(e) {
  let t = (e || ``).trim();
  if (!t) return null;
  let n = Ei[t];
  return n ? {
    key: n.key,
    label: n.label
  } : null;
}
function Ji(e) {
  let t = (e || ``).trim();
  return !t || !bi?.recommended ? false : !!bi.recommended[t];
}
function Yi(e) {
  return e ? Vi().includes(e.trim()) : false;
}
function Xi(e) {
  if (!e) return false;
  let t = e.trim();
  if (!t) return false;
  if (xi.length > 0) return xi.some(e => e.modelName === t);
  let n = Bi();
  return n.text.includes(t) || n.image.includes(t) || n.video.includes(t);
}
function Qi(e) {
  let t = ki(e),
    n = !t || t.access !== `allowed`;
  return {
    disabled: n,
    reason: n ? Ai(e) : null,
    ent: t
  };
}
function $i(e) {
  let {
    disabled: t,
    reason: n,
    ent: r
  } = Qi(e);
  if (t) return r?.access === `quota_exceeded` && r.callLimit != null ? `${n || `已达到使用次数额度`} (${r.usedCount ?? 0}/${r.callLimit})` : n || `权益不够`;
}
function ea(e, t) {
  let {
    disabled: n,
    reason: r
  } = Qi(e);
  return {
    disabled: n,
    denyReason: r,
    title: $i(e) || e,
    className: `w-full flex items-center gap-1.5 mb-1 last:mb-0 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors ${n ? `opacity-40 cursor-not-allowed` : `cursor-pointer ${t ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} ${t && !n ? `bg-[#333] text-white` : ``}`
  };
}
var na = `modelSchedules:change`,
  ra = `schedule:`;
function ia(e) {
  let t = Math.round(Number(e) || 1);
  return t < 1 ? 1 : t > 3 ? 3 : t;
}
function aa(e) {
  if (!Array.isArray(e)) return [];
  let t = [],
    n = 0;
  for (let r of e) {
    if (t.length >= 5) break;
    let e = typeof r?.model == `string` ? r.model.trim() : ``;
    if (!e) continue;
    let i = ia(r?.retries);
    if (n + i > 10 && (i = 10 - n), i <= 0) break;
    t.push({
      model: e,
      retries: i
    }), n += i;
  }
  return t;
}
function oa(e) {
  if (!e || typeof e != `object`) return null;
  let t = e,
    n = t.category === `text` || t.category === `image` || t.category === `video` ? t.category : `image`,
    r = aa(t.steps);
  if (!r.length) return null;
  let i = Date.now();
  return {
    id: typeof t.id == `string` && t.id ? t.id : sa(),
    name: typeof t.name == `string` && t.name.trim() ? t.name.trim() : `未命名调度`,
    category: n,
    enabled: !!t.enabled,
    steps: r,
    createdAt: typeof t.createdAt == `number` ? t.createdAt : i,
    updatedAt: typeof t.updatedAt == `number` ? t.updatedAt : i
  };
}
function sa() {
  return `sch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function ca(e) {
  return e.reduce((e, t) => e + (t.retries || 0), 0);
}
function la() {
  if (typeof window > `u`) return [];
  try {
    let e = window.localStorage.getItem(ta);
    if (!e) return [];
    let t = JSON.parse(e);
    return Array.isArray(t) ? t.map(oa).filter(e => !!e) : [];
  } catch {
    return [];
  }
}
function ua(e) {
  if (!(typeof window > `u`)) {
    try {
      window.localStorage.setItem(ta, JSON.stringify(e));
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent(na, {
        detail: e
      }));
    } catch {}
  }
}
function da(e) {
  ua(e);
  try {
    Q.setObject(ta, e);
  } catch {}
}
function fa(e) {
  let t = oa(e);
  if (!t) return la();
  let n = la(),
    r = n.findIndex(e => e.id === t.id);
  return t.updatedAt = Date.now(), r >= 0 ? (t.createdAt = n[r].createdAt, n[r] = t) : n.push(t), da(n), n;
}
function pa(e) {
  let t = la().filter(t => t.id !== e);
  return da(t), t;
}
function ma(e, t) {
  let n = la(),
    r = n.find(t => t.id === e);
  return r && (r.enabled = t, r.updatedAt = Date.now(), da(n)), n;
}
function ha(e) {
  if (typeof window > `u`) return () => undefined;
  let t = t => {
      e(t.detail ?? la());
    },
    n = t => {
      t.key === `modelSchedules` && e(la());
    };
  return window.addEventListener(na, t), window.addEventListener(`storage`, n), () => {
    window.removeEventListener(na, t), window.removeEventListener(`storage`, n);
  };
}
function ga(e) {
  return `${ra}${e}`;
}
function _a(e) {
  return e && e.startsWith(`schedule:`) ? e.slice(9) : null;
}
function va(e) {
  let t = [];
  for (let n of e.steps) for (let e = 0; e < n.retries; e++) {
    if (t.length >= 10) return t;
    t.push(n.model);
  }
  return t;
}
function ya(e) {
  return Array.isArray(e) ? e.map(oa).filter(e => !!e) : [];
}
function ba(e, t) {
  let n = new Map();
  for (let t of ya(e)) n.set(t.id, t);
  for (let e of ya(t)) n.set(e.id, e);
  return Array.from(n.values());
}
async function xa() {
  try {
    let e = await Q.getObject(ta);
    if (!Array.isArray(e)) return;
    ua(ya(e));
  } catch {}
}
async function Sa(e) {
  let t = ba(la(), e);
  return da(t), t;
}
var wa = `remembered_login_credentials`;
function Ta() {
  let e = localStorage.getItem(wa);
  if (!e) return null;
  try {
    let t = JSON.parse(e);
    if (typeof t.account != `string` || typeof t.password != `string`) throw Error(`Invalid remembered login credentials`);
    return t;
  } catch {
    return localStorage.removeItem(wa), null;
  }
}
function Ea(e) {
  localStorage.setItem(wa, JSON.stringify(e));
}
function Da() {
  localStorage.removeItem(wa);
}
function Oa() {
  return localStorage.getItem(Ca) || `local-mode-token`;
}
function ka(e) {
  localStorage.setItem(Ca, e), Q.setConfig(Ca, e).then(() => {
    console.log(`AUTH_TOKEN_KEY 保存成功`);
  });
}
function Aa() {
  localStorage.removeItem(Ca), Q.remove(Ca).then(() => {
    console.log(`AUTH_TOKEN_KEY 移除成功`);
  });
}
var ja = `${$n}${er}`;
function Ma(e) {
  return e ? /^https?:\/\//i.test(e) || e.startsWith(`data:`) ? e : `${$n}${e.startsWith(`/`) ? `` : `/`}${e}` : ``;
}
function Na() {
  let e = Oa();
  return e ? {
    Authorization: `Bearer ${e}`
  } : {};
}
async function Pa() {
  return [];
  let e = await (await fetch(`${ja}/public/prompt-tags`)).json();
  return e.success ? e.data : [];
}
async function Fa(e = {}) {
  return [];
  let t = new URLSearchParams();
  e.category && t.set(`category`, e.category), e.tagId && t.set(`tagId`, String(e.tagId)), e.keyword && e.keyword.trim() && t.set(`keyword`, e.keyword.trim()), t.set(`pageSize`, `200`);
  let n = await (await fetch(`${ja}/public/prompts?${t.toString()}`)).json();
  return n.success ? n.data : [];
}
async function Ia() {
  return [];
  if (!Oa()) return [];
  let e = await fetch(`${ja}/prompts/favorites`, {
    headers: Na()
  });
  if (!e.ok) return [];
  let t = await e.json();
  return t.success ? t.data.map(e => e.promptId) : [];
}
async function La() {
  return [];
  if (!Oa()) return [];
  let e = await fetch(`${ja}/prompts/favorites/items`, {
    headers: Na()
  });
  if (!e.ok) return [];
  let t = await e.json();
  return t.success ? t.data : [];
}
async function Ra(e) {
  return { ok: false, error: `本地模式不支持` };
  try {
    let t = await fetch(`${ja}/prompts/favorites/${e}`, {
      method: `POST`,
      headers: Na()
    });
    if (t.ok) return {
      ok: true
    };
    let n = `收藏失败 (${t.status})`;
    try {
      let e = await t.json();
      e?.error && (n = e.error);
    } catch {}
    return {
      ok: false,
      error: n
    };
  } catch (e) {
    return {
      ok: false,
      error: e?.message || `网络错误`
    };
  }
}
async function za(e) {
  return false;
  if (!Oa()) return false;
  try {
    return (await fetch(`${ja}/prompts/favorites/${e}`, {
      method: `DELETE`,
      headers: Na()
    })).ok;
  } catch {
    return false;
  }
}
function Ba() {
  return !!Oa();
}
function Ha() {
  try {
    window.dispatchEvent(new CustomEvent(Va));
  } catch {}
}
var Wa = `yimao:promptRecent`;
function Ga() {
  try {
    let e = localStorage.getItem(Wa);
    return e ? JSON.parse(e) : [];
  } catch {
    return [];
  }
}
function Ka(e) {
  try {
    let t = Ga().filter(t => t !== e);
    t.unshift(e), localStorage.setItem(Wa, JSON.stringify(t.slice(0, 50)));
  } catch {}
}
function y_() {
  let e = [],
    t = new Set(),
    n = [`text`, `image`, `video`],
    r = Bi();
  for (let i of n) for (let n of r[i] || []) t.has(n) || (t.add(n), e.push({
    name: n,
    category: i,
    power: Ui(n),
    unit: Wi(n),
    currency: Gi(n)
  }));
  for (let n of Vi()) t.has(n) || (t.add(n), e.push({
    name: n,
    category: `video`,
    power: Ui(n),
    unit: Wi(n),
    currency: Gi(n)
  }));
  return e;
}
var O_ = {
  text: {
    short: `文本`,
    label: `文本`,
    tone: `text-sky-300`
  },
  image: {
    short: `生图`,
    label: `生图`,
    tone: `text-fuchsia-300`
  },
  video: {
    short: `生视频`,
    label: `生视频`,
    tone: `text-emerald-300`
  },
  discount: {
    short: `生视频`,
    label: `生视频`,
    tone: `text-emerald-300`
  }
};
function k_(e) {
  let t = (e || ``).trim();
  if (!t) return {
    key: `misc`,
    label: `其他`
  };
  let n = qi(t);
  if (n) return {
    key: n.key,
    label: n.label
  };
  let r = t.toLowerCase();
  for (let e of [{
    test: /^gemini[-_ ]?3[-_ ]?pro/i,
    key: `gemini-3-pro`,
    label: `Gemini 3 Pro 系列`
  }, {
    test: /^gemini[-_ ]?3\.1/i,
    key: `gemini-3.1`,
    label: `Gemini 3.1 系列`
  }, {
    test: /^gemini[-_ ]?3/i,
    key: `gemini-3`,
    label: `Gemini 3 系列`
  }, {
    test: /^gemini/i,
    key: `gemini`,
    label: `Gemini 系列`
  }, {
    test: /^grok[-_ ]?video/i,
    key: `grok-video`,
    label: `Grok Video 系列`
  }, {
    test: /^deepseek/i,
    key: `deepseek`,
    label: `DeepSeek 系列`
  }, {
    test: /^seedance/i,
    key: `seedance`,
    label: `Seedance 系列`
  }]) if (e.test.test(r)) return {
    key: e.key,
    label: e.label
  };
  let i = t.split(/[-_:.@/\s]/)[0] || `misc`;
  return {
    key: i.toLowerCase(),
    label: `${i} 系列`
  };
}
function A_(e) {
  let t = [[`from-blue-500/65`, `to-cyan-400/45`], [`from-fuchsia-500/65`, `to-pink-400/45`], [`from-emerald-500/65`, `to-teal-400/45`], [`from-amber-500/65`, `to-orange-400/45`], [`from-violet-500/65`, `to-indigo-400/45`], [`from-rose-500/65`, `to-red-400/45`], [`from-sky-500/65`, `to-blue-400/45`], [`from-lime-500/65`, `to-emerald-400/45`]],
    n = 0;
  for (let t = 0; t < e.length; t++) n = n * 31 + e.charCodeAt(t) >>> 0;
  let [r, i] = t[n % t.length];
  return `bg-gradient-to-br ${r} ${i}`;
}
function j_() {
  let e = Oi();
  if (e.length > 0) return e.map(e => {
    let t = e.builtinCategory || e.category || `text`,
      n = t === `video` || t === `text` || t === `image` ? t : `text`,
      r = e.isDiscountVideo ? `discount` : n;
    return {
      id: `${n}:${e.modelName}`,
      name: e.modelName,
      category: n,
      displayCategory: r,
      power: Ui(e.modelName),
      unit: Wi(e.modelName),
      currency: Gi(e.modelName),
      recommended: Ji(e.modelName),
      description: Ki(e.modelName),
      access: e.access,
      accessReason: e.reason
    };
  });
  let t = [],
    n = new Set();
  for (let e of [`text`, `image`, `video`]) for (let r of Bi()[e] || []) {
    if (n.has(r)) continue;
    n.add(r);
    let i = Yi(r) ? `discount` : e;
    t.push({
      id: `${e}:${r}`,
      name: r,
      category: e,
      displayCategory: i,
      power: Ui(r),
      unit: Wi(r),
      currency: Gi(r),
      recommended: Ji(r),
      description: Ki(r)
    });
  }
  for (let e of Vi()) n.has(e) || (n.add(e), t.push({
    id: `video:${e}`,
    name: e,
    category: `video`,
    displayCategory: `discount`,
    power: Ui(e),
    unit: Wi(e),
    currency: Gi(e),
    recommended: Ji(e),
    description: Ki(e)
  }));
  return t;
}

export {
  $n, er, tr, nr, rr, ir, ar, sr, cr,
  yi, bi, LOCAL_MODE_ALLOW_ALL_MODELS, xi, Si, Ci, wi, Ti, Ei,
  Di, Oi, ki, Ai, ji, Mi, Ni, Pi, Fi, Ii, Li, Ri, zi, Bi, Vi, Hi, Ui, Wi, Gi, Ki, qi, Ji, Yi, Xi, Qi, $i, ea,
  na, ra, ia, aa, oa, sa, ca, la, ua, da, fa, pa, ma, ha, ga, _a, va, ya, ba, xa, Sa,
  wa, Ta, Ea, Da, Oa, ka, Aa, ja, Ma, Na, Pa, Fa, Ia, La, Ra, za, Ba, Ha, Wa, Ga, Ka,
  y_, O_, k_, A_, j_
};
