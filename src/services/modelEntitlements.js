import { LOCAL_MODE_ALLOW_ALL } from '../config.js';

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
    test: /^gemini[-_ ]?2/i,
    key: `gemini-2`,
    label: `Gemini 2 系列`
  }, {
    test: /^claude[-_ ]?4/i,
    key: `claude-4`,
    label: `Claude 4 系列`
  }, {
    test: /^claude[-_ ]?3\.7/i,
    key: `claude-3.7`,
    label: `Claude 3.7 系列`
  }, {
    test: /^claude[-_ ]?3\.5/i,
    key: `claude-3.5`,
    label: `Claude 3.5 系列`
  }, {
    test: /^claude[-_ ]?3/i,
    key: `claude-3`,
    label: `Claude 3 系列`
  }, {
    test: /^gpt[-_ ]?5/i,
    key: `gpt-5`,
    label: `GPT 5 系列`
  }, {
    test: /^gpt[-_ ]?4\.1/i,
    key: `gpt-4.1`,
    label: `GPT 4.1 系列`
  }, {
    test: /^gpt[-_ ]?4\.5/i,
    key: `gpt-4.5`,
    label: `GPT 4.5 系列`
  }, {
    test: /^gpt[-_ ]?4/i,
    key: `gpt-4`,
    label: `GPT 4 系列`
  }, {
    test: /^gpt[-_ ]?3\.5/i,
    key: `gpt-3.5`,
    label: `GPT 3.5 系列`
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
  yi, bi, LOCAL_MODE_ALLOW_ALL_MODELS, xi, Si, Ci, wi, Ti, Ei,
  Di, Oi, ki, Ai, ji, Mi, Ni, Pi, Fi, Ii, Li, Ri, zi, Bi, Vi, Hi, Ui, Wi, Gi, Ki, qi, Ji, Yi, Xi, Qi, $i, ea,
  y_, O_, k_, A_, j_
};
