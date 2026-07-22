// 切自 src/App.js L310-443（modelSchedules 调度配置层）。剪切不重写，混淆名原样保留。
import { ta } from '../config/constants.js';
import { Q } from '../utils/storage/index.js';

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
  return Array.isArray(t) && t.length > 0 && da(t), t;
}
export {
  na, ra, ia, aa, oa, sa, ca, la, ua, da, fa, pa, ma, ha, ga, _a, va, ya, ba, xa, Sa
};
