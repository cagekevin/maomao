import _cmp_Bn from "./Bn.jsx";
import _cmp_Er from "./Er.jsx";
import _cmp_Tr from "./Tr.jsx";
import _cmp_Vn from "./Vn.jsx";
import _cmp_Oi from "./Oi.jsx";
import _cmp_Vo from "./Vo.jsx";
import _cmp_nc from "./nc.jsx";
import _cmp_mc from "./mc.jsx";
import _cmp_dl from "./dl.jsx";
import _cmp_kl from "./kl.jsx";
import _cmp_dh from "./dh.jsx";
import _cmp_vg from "./vg.jsx";
import _cmp_Mg from "./Mg.jsx";
import _cmp_Og from "./Og.jsx";
import _cmp_xi from "./xi.jsx";
import _cmp_bo from "./bo.jsx";
import _cmp_Co from "./Co.jsx";
import _cmp_To from "./To.jsx";
import _cmp_Lo from "./Lo.jsx";
import _cmp_Yo from "./Yo.jsx";
import _cmp_Zo from "./Zo.jsx";
import _cmp_es from "./es.jsx";
import _cmp_As from "./As.jsx";
import _cmp_Ms from "./Ms.jsx";
import _cmp_Ls from "./Ls.jsx";
import _cmp_Rs from "./Rs.jsx";
import _cmp_$s from "./$s.jsx";
import _cmp_ec from "./ec.jsx";
import _cmp_fc from "./fc.jsx";
import _cmp_Gc from "./Gc.jsx";
import _cmp_nl from "./nl.jsx";
import _cmp_Cl from "./Cl.jsx";
import _cmp_Ll from "./Ll.jsx";
import _cmp_Rl from "./Rl.jsx";
import _cmp_Kl_1 from "./Kl_1.jsx";
import _cmp_Yl from "./Yl.jsx";
import _cmp_Zl from "./Zl.jsx";
import _cmp_Dg from "./Dg.jsx";
import _cmp_Rg from "./Rg.jsx";
import _cmp_Gg from "./Gg.jsx";
import _cmp_c_ from "./c_.jsx";
import _cmp_Fg from "./Fg.jsx";
const __vite__mapDeps = (i, m = __vite__mapDeps, d = m.f ||= ['../src-_qSScO88.js', '../rolldown-runtime-aKtaBQYM.js', '../mediabunny-mp3-encoder-CZeRAvEV.js', '../vendor-Z-adA07W.js', './vendor-Qkhkn02K.css']) => {
  return i.map(i => {
    return d[i];
  });
};
import { i as e, n as t } from '../rolldown-runtime-aKtaBQYM.js';
import { $ as _Component128, $n as _Component11, $t as _Component52, A as a, An as _Component30, Ar as _Component22, B as c, Bn as _Component15, Bt as _Component117, C as d, Cn as _Component33, Cr as _Component114, Ct as _Component102, D as h, Dn as _Component113, Dr as _, Dt as _Component18, E as y, En as _Component58, Er as _Component60, Et as S, F as C, Fr as w, Ft as T, G as E, Gn as D, Gt as O, H as _Component27, Hn as A, I as j, In as M, It as N, J as P, Jn as F, Jt as I, K as _Component112, Kn as L, Kt as R, L as te, Ln as _Component2, Lr as ne, Lt as B, M as re, Mn as V, Mt as _Component48, N as ae, Nt as _Component121, O as H, On as _Component126, Or as _Component29, Ot as U, P as W, Pr as le, Pt as G, Q as ue, Qn as _Component3, Qt as _Component25, R as pe, Rn as _Component115, Rr as he, S as ge, Sn as _e, Sr as _Component63, St as _Component62, T as be, Tn as _Component120, Tr as Se, Tt as Ce, U as we, Ut as Te, V as Ee, Vn as De, Vt as K, W as Oe, Wn as _Component28, Wt as Ae, X as _Component123, Xn as _Component4, Xt as Me, Y as Ne, Yn as Pe, Yt as Fe, Z as Ie, Zn as Le, Zt as Re, _ as ze, _n as Be, _r as Ve, _t as He, a as J, an as Y, ar as Ue, at as We, b as Ge, bn as Ke, br as _Component37, bt as Je, c as Ye, cn as Xe, cr as Ze, ct as X, d as Qe, dn as $e, dr as _Component14, dt as _Component1, en as nt, er as _Component32, et as it, f as _Component96, fn as _Component57, fr as _Component49, ft as _Component20, g as lt, gn as _Component26, gr as _Component13, gt as ft, h as _Component61, hn as _Component47, hr as _Component125, ht as _Component110, i as _t, in as _Component43, ir as _Component34, it as bt, j as xt, jn as St, jr as Ct, jt as _Component41, k as Tt, kn as Et, kr as Dt, kt as Ot, l as _Component86, ln as At, lr as _Component7, lt as Mt, m as Nt, mn as Pt, mt as Ft, n as It, nt as Lt, o as Rt, on as _Component54, or as Bt, ot as Vt, p as Ht, pn as Ut, pr as Wt, pt as Gt, q as Kt, qn as _Component56, qt as Jt, r as Yt, rn as Xt, rr as Zt, rt as Qt, s as $t, sn as _Component10, sr as _Component6, st as nn, t as rn, tn as _Component45, tr as _Component31, tt as sn, u as _Component59, un as _Component5, ur as _Component100, ut as _Component65, v as fn, vn as _Component50, vr as _Component17, vt as _Component44, w as gn, wn as _n, wr as _Component36, wt as _Component0, x as bn, xn as _Component124, xr as Sn, xt as Cn, y as wn, yn as Tn, yr as En, yt as Dn, z as On, zn as _Component71 } from '../vendor-Z-adA07W.js';
import { a as An, c as jn, o as Mn, r as Nn, s as Pn } from '../endpointConfig-Bt85xi8d.js';
var Z = e(he(), 1);
var Fn = ne();
async function In(e) {
  if (!e.fileUrl && !e.localPath) {
    return {
      ok: false,
      message: `没有可发送的素材`
    };
  }
  try {
    let t = await fetch(`${Mn()}/api/jianying/send`, {
      method: `POST`,
      headers: {
        'Content-Type': `application/json`
      },
      body: JSON.stringify({
        fileUrl: e.fileUrl || ``,
        localPath: e.localPath || ``,
        fileName: e.fileName || ``
      })
    });
    let n = await t.json().catch(() => {
      return {};
    });
    if (t.ok && n.status === `ok`) {
      return {
        ok: true,
        message: n.message || `已发送到剪映`
      };
    } else {
      return {
        ok: false,
        message: n.error || `发送失败 (HTTP ${t.status})`
      };
    }
  } catch (e) {
    let t = String(e?.message || e);
    if (t.includes(`Failed to fetch`) || t.includes(`NetworkError`)) {
      return {
        ok: false,
        message: `无法连接本地引擎，请确认引擎已启动`
      };
    } else {
      return {
        ok: false,
        message: t
      };
    }
  }
}
function Ln(e, t = `mp4`) {
  try {
    let n = e.split(`?`)[0];
    let r = n.substring(n.lastIndexOf(`/`) + 1);
    if (r && r.includes(`.`)) {
      return r;
    } else {
      return `clip_${Date.now()}.${t}`;
    }
  } catch {
    return `clip_${Date.now()}.${t}`;
  }
}
async function Rn(e) {
  let t = e.filter(e => {
    return e.fileUrl || e.localPath;
  });
  if (t.length === 0) {
    return {
      ok: false,
      message: `没有可发送的素材`
    };
  }
  try {
    let e = await fetch(`${Mn()}/api/jianying/send`, {
      method: `POST`,
      headers: {
        'Content-Type': `application/json`
      },
      body: JSON.stringify({
        items: t
      })
    });
    let n = await e.json().catch(() => {
      return {};
    });
    if (e.ok && n.status === `ok`) {
      return {
        ok: true,
        message: `已发送 ${n.count ?? t.length} 个素材到剪映`
      };
    } else {
      return {
        ok: false,
        message: n.error || `发送失败 (HTTP ${e.status})`
      };
    }
  } catch (e) {
    let t = String(e?.message || e);
    if (t.includes(`Failed to fetch`) || t.includes(`NetworkError`)) {
      return {
        ok: false,
        message: `无法连接本地引擎，请确认引擎已启动`
      };
    } else {
      return {
        ok: false,
        message: t
      };
    }
  }
}
var Q = w();
var Hn = `canvas-add-resource-request`;
var Wn = Nn();
var Gn = `/api`;
function Kn(e) {
  let t = Wn.replace(/[\`\s]/g, ``).replace(/\/$/, ``);
  let n = (e || t).replace(/[\`\s]/g, ``).trim().replace(/\/$/, ``);
  if (n) {
    if (/\/api$/i.test(n)) {
      return n;
    } else {
      return `${n}/api`;
    }
  } else {
    return `${t}/api`;
  }
}
function qn(e = ``) {
  let t = Wn.replace(/[\`\s]/g, ``).replace(/\/+$/, ``);
  let n = e.trim().replace(/^\/+|\/+$/g, ``);
  if (n) {
    return `${t}/${n}`;
  } else {
    return t;
  }
}
function Jn(e, t) {
  return `${Kn(e)}/v1/gateway/ai-app${t.startsWith(`/`) ? t : `/${t}`}`;
}
function Yn(e, t) {
  let n = Kn(e);
  if (t) {
    return `${n}/ai-apps/${encodeURIComponent(t)}`;
  } else {
    return `${n}/ai-apps`;
  }
}
function Xn(e, t) {
  let n = Kn(Wn);
  if (t || !e) {
    return n;
  }
  let r = Kn(e);
  let i = r.replace(/\/api$/i, ``);
  let a = /^https?:\/\/(localhost|127\.0\.0\.1):3000$/i.test(i);
  let o = Wn.replace(/[`\s]/g, ``).trim().replace(/\/$/, ``);
  let s = !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(o);
  if (a && s) {
    return n;
  } else {
    return r;
  }
}
var Zn = 30000;
var Qn = {
  'Content-Type': `application/json`
};
function $n(e) {
  if (e.startsWith(`http`)) {
    return e;
  } else {
    return `${Wn}${Gn}${e}`;
  }
}
var er = [`customResultData`, `customRawResponse`, `requestData`, `responseData`, `mediaMeta`];
function tr(e) {
  let t = {
    ...e
  };
  for (let e of er) {
    let n = t[e];
    if (n === `` || n == null) {
      delete t[e];
      continue;
    }
    if (typeof n == `string`) {
      try {
        t[e] = JSON.parse(n);
      } catch {}
    }
  }
  if (typeof t.progress == `number`) {
    t.progress = t.progress;
  } else {
    t.progress = Number(t.progress) || 0;
  }
  if (typeof t.createdAt == `number`) {
    t.createdAt = t.createdAt;
  } else {
    t.createdAt = Number(t.createdAt) || 0;
  }
  if (t.notFoundCount !== undefined) {
    t.notFoundCount = Number(t.notFoundCount) || 0;
  }
  for (let e of [`taskId`, `nodeId`, `resultUrl`, `thumbnailUrl`, `errorMsg`, `prompt`, `customOutputType`, `channelName`, `modelName`]) {
    if (t[e] === ``) {
      delete t[e];
    }
  }
  return t;
}
function nr(e) {
  let t = new URLSearchParams();
  if (e.page) {
    t.set(`page`, String(e.page));
  }
  if (e.pageSize) {
    t.set(`pageSize`, String(e.pageSize));
  }
  if (e.sortBy) {
    t.set(`sortBy`, e.sortBy);
  }
  if (e.sortDir) {
    t.set(`sortDir`, e.sortDir);
  }
  if (e.search && e.search.trim()) {
    t.set(`search`, e.search.trim());
  }
  if (e.filters && Object.keys(e.filters).length > 0) {
    t.set(`filters`, JSON.stringify(e.filters));
  }
  return t.toString();
}
async function rr(e = {}) {
  let t = nr({
    sortBy: `createdAt`,
    sortDir: `DESC`,
    ...e
  });
  let n = await fetch(`${Mn()}/api/tasks?${t}`);
  if (!n.ok) {
    throw Error(`listTasks failed: HTTP ${n.status}`);
  }
  let r = await n.json();
  return {
    items: Array.isArray(r.items) ? r.items.map(tr) : [],
    total: r.total ?? 0,
    page: r.page ?? 1,
    pageSize: r.pageSize ?? (e.pageSize || 20),
    totalPages: r.totalPages ?? 0
  };
}
async function ir(e) {
  try {
    return (await fetch(`${Mn()}/api/tasks/save`, {
      method: `POST`,
      headers: {
        'Content-Type': `application/json`
      },
      body: JSON.stringify(e)
    })).ok;
  } catch (e) {
    console.error(`[taskStore] saveTask error`, e);
    return false;
  }
}
async function ar(e) {
  if (!e || e.length === 0) {
    return true;
  }
  try {
    return (await fetch(`${Mn()}/api/tasks/batch-save`, {
      method: `POST`,
      headers: {
        'Content-Type': `application/json`
      },
      body: JSON.stringify(e)
    })).ok;
  } catch (e) {
    console.error(`[taskStore] batchSaveTasks error`, e);
    return false;
  }
}
async function or(e) {
  try {
    return (await fetch(`${Mn()}/api/tasks/delete?id=${encodeURIComponent(e)}`, {
      method: `POST`
    })).ok;
  } catch (e) {
    console.error(`[taskStore] deleteTask error`, e);
    return false;
  }
}
async function sr(e) {
  if (!e || e.length === 0) {
    return 0;
  }
  try {
    let t = await fetch(`${Mn()}/api/tasks/batch-delete`, {
      method: `POST`,
      headers: {
        'Content-Type': `application/json`
      },
      body: JSON.stringify({
        ids: e
      })
    });
    if (t.ok) {
      return (await t.json()).deleted ?? 0;
    } else {
      return 0;
    }
  } catch (e) {
    console.error(`[taskStore] batchDeleteTasks error`, e);
    return 0;
  }
}
async function cr(e = []) {
  try {
    let t = await fetch(`${Mn()}/api/tasks/clear`, {
      method: `POST`,
      headers: {
        'Content-Type': `application/json`
      },
      body: JSON.stringify({
        statuses: e
      })
    });
    if (t.ok) {
      return (await t.json()).deleted ?? 0;
    } else {
      return 0;
    }
  } catch (e) {
    console.error(`[taskStore] clearTasks error`, e);
    return 0;
  }
}
var lr = Promise.resolve();
function ur(e, t) {
  let n = () => {
    return dr(e, t);
  };
  lr = lr.then(n, n);
  return lr;
}
async function dr(e, t) {
  let n = new Map(e.map(e => {
    return [e.id, e];
  }));
  let r = new Map(t.map(e => {
    return [e.id, e];
  }));
  let i = [];
  for (let e of t) {
    let t = n.get(e.id);
    if (!t || JSON.stringify(t) !== JSON.stringify(e)) {
      i.push(e);
    }
  }
  let a = [];
  for (let t of e) {
    if (!r.has(t.id)) {
      a.push(t.id);
    }
  }
  let o = [];
  if (i.length === 1) {
    o.push(ir(i[0]));
  } else if (i.length > 1) {
    o.push(ar(i));
  }
  if (a.length > 0) {
    o.push(sr(a));
  }
  if (o.length > 0) {
    await Promise.all(o).catch(e => {
      return console.error(`[taskStore] diffAndPersistTasks error`, e);
    });
  }
}
var fr = `workflow_checkpoint_`;
async function pr(e) {
  try {
    let t = `${fr}${e}`;
    let n = await fetch(`${Mn()}/api/kv/get?key=${encodeURIComponent(t)}`);
    if (!n.ok) {
      return null;
    }
    let r = await n.text();
    if (r === `null` || r === `` || r === `undefined`) {
      return null;
    }
    let i = JSON.parse(r);
    let a = i && typeof i == `object` && `value` in i ? i.value : i;
    if (a == null) {
      return null;
    }
    let o = typeof a == `string` ? JSON.parse(a) : a;
    console.log(`[taskStore] getWorkflowCheckpoint key=${t}, status=${o?.status}, completed=${o?.completedNodes?.length}/${o?.nodeExecOrder?.length}`);
    return o;
  } catch (e) {
    console.error(`[taskStore] getWorkflowCheckpoint error`, e);
    return null;
  }
}
async function mr(e) {
  try {
    let t = `${fr}${e.projectId}`;
    console.log(`[taskStore] saveWorkflowCheckpoint key=${t}, status=${e.status}, completed=${e.completedNodes.length}/${e.nodeExecOrder.length}`);
    return (await fetch(`${Mn()}/api/kv/set`, {
      method: `POST`,
      headers: {
        'Content-Type': `application/json`
      },
      body: JSON.stringify({
        key: t,
        value: e
      })
    })).ok;
  } catch (e) {
    console.error(`[taskStore] saveWorkflowCheckpoint error`, e);
    return false;
  }
}
async function hr(e) {
  try {
    let t = `${fr}${e}`;
    return (await fetch(`${Mn()}/api/kv/delete?key=${encodeURIComponent(t)}`, {
      method: `POST`
    })).ok;
  } catch (e) {
    console.error(`[taskStore] deleteWorkflowCheckpoint error`, e);
    return false;
  }
}
var gr = {
  useThumbnail: true,
  lodLevel: 0,
  viewportMoving: false,
  nodeCount: 0,
  handleFollowLimit: 60,
  edgeFxLimit: 100
};
var _r = Z.createContext(gr.useThumbnail);
var vr = Z.createContext({
  lodLevel: gr.lodLevel,
  viewportMoving: gr.viewportMoving,
  nodeCount: gr.nodeCount,
  handleFollowLimit: gr.handleFollowLimit,
  edgeFxLimit: gr.edgeFxLimit
});
function br() {
  return {
    useThumbnail: Z.useContext(_r)
  };
}
function xr() {
  return Z.useContext(vr);
}
var Sr = `custom-handle-hover-style`;
var Cr = `
.cust-handle-wrap {
  position: absolute;
  z-index: 100;
  cursor: crosshair;
  pointer-events: auto;
  transform-origin: center center;
  transition: opacity 160ms ease;
  /* 这些 var 默认值在 wrapper 上, 子元素 (dot/ring/plus) 通过 inheritance 取值。
     如果在 dot/ring/plus 自身又写一遍, 会覆盖 wrapper 的 inline style, 导致 anchor 失效! */
  --cust-shift-x: 0px;
  --cust-shift-y: 0px;
  --cust-anchor-x: 50%;
}
.cust-handle-dot,
.cust-handle-ring,
.cust-handle-plus {
  position: absolute;
  pointer-events: none;
  transform-origin: center;
}

/* idle 实心点 - 几何中心位于 wrapper 上的 anchor 位置 (小球贴节点边) */
.cust-handle-dot {
  top: 50%;
  left: var(--cust-anchor-x);
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #6b7280;
  border: 1px solid #1f2937;
  box-shadow: 0 0 4px rgba(0,0,0,0.6);
  transform: translate(-50%, -50%) scale(1);
  opacity: 1;
  transition: opacity 180ms ease, transform 220ms cubic-bezier(.4,1.6,.6,1);
}

/* 外环 (idle 隐藏) */
.cust-handle-ring {
  top: 50%;
  left: var(--cust-anchor-x);
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border: 2px solid rgba(255,255,255,0.7);
  background: rgba(255, 255, 255, 0.05);
  transform: translate(-50%, -50%) scale(0.3);
  opacity: 0;
  transition: opacity 220ms ease, transform 280ms cubic-bezier(.34,1.56,.64,1), box-shadow 220ms ease, border-color 220ms ease;
}

/* 中间 + 号 - 用两条细线;追鼠标时通过 css var 偏移 */
.cust-handle-plus {
  top: 50%;
  left: var(--cust-anchor-x);
  width: 18px;
  height: 18px;
  transform: translate(calc(-50% + var(--cust-shift-x)), calc(-50% + var(--cust-shift-y))) scale(0.3) rotate(-90deg);
  opacity: 0;
  transition: opacity 200ms ease 40ms, transform 220ms cubic-bezier(.34,1.56,.64,1) 0ms;
  color: #fff;
}
.cust-handle-plus::before,
.cust-handle-plus::after {
  content: '';
  position: absolute;
  background: currentColor;
  border-radius: 2px;
  top: 50%;
  left: 50%;
  box-shadow: 0 0 8px rgba(255,255,255,0.8);
}
.cust-handle-plus::before {
  width: 14px;
  height: 2px;
  transform: translate(-50%, -50%);
}
.cust-handle-plus::after {
  width: 2px;
  height: 14px;
  transform: translate(-50%, -50%);
}

/* hover - 中心点淡出, 环+号放大 */
.cust-handle-wrap:hover .cust-handle-dot {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.4);
}
.cust-handle-wrap:hover .cust-handle-ring {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
  border-color: rgba(255, 255, 255, 0.85);
  box-shadow: 0 0 16px rgba(255,255,255,0.35), 0 0 36px rgba(255,255,255,0.15);
  background: rgba(255, 255, 255, 0.08);
}
.cust-handle-wrap:hover .cust-handle-plus {
  opacity: 1;
  /* 注意保留 var 偏移, 才能跟随鼠标 */
  transform: translate(calc(-50% + var(--cust-shift-x)), calc(-50% + var(--cust-shift-y))) scale(1) rotate(0deg);
}

/* React Flow 在 hover 一个 handle 准备连接时, 给 handle 加 .connectingto / .connectingfrom 类 */
.cust-handle-wrap .react-flow__handle.connectingto ~ .cust-handle-ring,
.cust-handle-wrap .react-flow__handle.connectingfrom ~ .cust-handle-ring,
.cust-handle-wrap:active .cust-handle-ring {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1.15);
  border-color: #fff;
  box-shadow: 0 0 22px rgba(255,255,255,0.6), 0 0 48px rgba(255,255,255,0.25);
}
.cust-handle-wrap .react-flow__handle.connectingto ~ .cust-handle-plus,
.cust-handle-wrap .react-flow__handle.connectingfrom ~ .cust-handle-plus {
  opacity: 1;
  transform: translate(calc(-50% + var(--cust-shift-x)), calc(-50% + var(--cust-shift-y))) scale(1.1) rotate(0deg);
}
.cust-handle-wrap .react-flow__handle.connectingto ~ .cust-handle-dot,
.cust-handle-wrap .react-flow__handle.connectingfrom ~ .cust-handle-dot {
  opacity: 0;
}

/* small 变体 */
.cust-handle-wrap.is-small .cust-handle-dot { width: 8px; height: 8px; }
.cust-handle-wrap.is-small .cust-handle-ring { width: 32px; height: 32px; }
.cust-handle-wrap.is-small .cust-handle-plus { width: 14px; height: 14px; }
.cust-handle-wrap.is-small .cust-handle-plus::before { width: 12px; height: 2px; }
.cust-handle-wrap.is-small .cust-handle-plus::after  { width: 2px;  height: 12px; }

/* 注: 不再用 !important 把 react-flow handle 撑满, 我们让它保持 1×1 通过 inline style 控制 */


/* ==== 跑马灯外边框: 节点正在被 hover 当作连接目标时 ==== */
@property --cust-marquee-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}
@keyframes cust-marquee-rotate {
  to { --cust-marquee-angle: 360deg; }
}
/* 注意: 不修改 .react-flow__node 的 position (它本身已经是 absolute),
   也不修改它的 transform 或 layout 相关属性, 避免造成节点位移 bug */
.react-flow__node:has(.react-flow__handle.connectingto) {
  filter: brightness(1.06);
  transition: filter 200ms ease;
}
.react-flow__node:has(.react-flow__handle.connectingto)::before {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: inherit;
  padding: 2px;
  background: conic-gradient(
    from var(--cust-marquee-angle, 0deg),
    rgba(255,255,255,0) 0deg,
    rgba(255,255,255,0.95) 30deg,
    rgba(180,210,255,0.95) 70deg,
    rgba(255,255,255,0) 130deg,
    rgba(255,255,255,0) 360deg
  );
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask-composite: exclude;
  pointer-events: none;
  animation: cust-marquee-rotate 1.6s linear infinite;
  filter: drop-shadow(0 0 8px rgba(180,210,255,0.55));
  z-index: 1000;
  box-sizing: border-box;
}
`;
if (typeof document < `u` && !document.getElementById(Sr)) {
  let e = document.createElement(`style`);
  e.id = Sr;
  e.textContent = Cr;
  document.head.appendChild(e);
}
var Dr = async e => {
  return new Promise((t, n) => {
    let r = e instanceof File || e instanceof Blob ? URL.createObjectURL(e) : e;
    let i = e instanceof File || e instanceof Blob;
    let a = new Image();
    a.crossOrigin = `anonymous`;
    a.onload = () => {
      if (i) {
        URL.revokeObjectURL(r);
      }
      t({
        width: a.naturalWidth || a.width,
        height: a.naturalHeight || a.height
      });
    };
    a.onerror = () => {
      if (i) {
        URL.revokeObjectURL(r);
      }
      n(Error(`Failed to load image for dimension detection`));
    };
    a.src = r;
  });
};
var Or = async (e, t = 1000, n = 0.85) => {
  let {
    width: r,
    height: i
  } = await Dr(e);
  if (r <= t && i <= t) {
    return {
      blob: e,
      compressed: false
    };
  }
  let a = await _cmp_Er(e, t, n);
  return {
    blob: await (await fetch(a)).blob(),
    compressed: true
  };
};
var kr = e(we(), 1);
var Ar = {
  APP_SETTINGS: `app_settings`,
  API_CONFIGS: `api_configs`,
  USERS: `users`,
  MEMBERSHIP: `membership`,
  OLD_MEMBERSHIP: `old_membership`,
  PROJECTS: `projects`,
  LAST_OPENED_PROJECT: `lastOpenedProject`,
  CUSTOM_NODE_TEMPLATES: `customNodeTemplates`,
  PRESET_PROMPTS: `presetPrompts`,
  MODEL_SCHEDULES: `modelSchedules`,
  CLOUD_STORAGE_CONFIG: `cloud_storage_config`,
  TRANSIT_RESOURCES: `transitResources`,
  TRANSIT_GRID_COLS: `transit_grid_cols`,
  GLOBAL_TASKS: `globalTasks`,
  CANVAS_STATE_PREFIX: `canvas-state-v1-`,
  DEVICE_ID: `device_id`,
  CURRENT_USER_ID: `current_user_id`,
  VIDEO_SIZE: `video_size`,
  VIDEO_SECONDS: `video_seconds`,
  VIDEO_MODEL: `video_model`,
  SYNC_VERSION: `sync_version`,
  LAST_SYNC_TIME: `last_sync_time`,
  AUTH_TOKEN: `auth_token`
};
Ar.API_CONFIGS;
Ar.USERS;
Ar.MEMBERSHIP;
Ar.PROJECTS;
Ar.CUSTOM_NODE_TEMPLATES;
Ar.PRESET_PROMPTS;
Ar.MODEL_SCHEDULES;
Ar.CLOUD_STORAGE_CONFIG;
function jr(e) {
  return `${Ar.CANVAS_STATE_PREFIX}${e}`;
}
function Mr() {
  return !!(typeof window < `u`) && !!window.__CANVAS_RUNTIME__?.disableLocalTool;
}
var Nr = new Map();
var Pr = new Map();
var Fr = {
  async get(e) {
    console.log(`[Storage] localToolEngine.get 被调用，key:`, e);
    try {
      let t = window.localTool;
      if (t) {
        console.log(`[Storage] 准备调用 lt.getKV("${e}")`);
        return await t.getKV(e);
      } else {
        console.error(`[Storage] ❌ window.localTool 不存在，localTool service 可能未运行`);
        return null;
      }
    } catch (e) {
      console.error(`[Storage] localToolEngine.get 异常:`, e);
      return null;
    }
  },
  async set(e, t) {
    try {
      let n = window.localTool;
      if (n) {
        return await n.saveKV(e, t);
      } else {
        return false;
      }
    } catch (e) {
      console.error(`localToolEngine set error`, e);
      return false;
    }
  },
  async setObject(e, t) {
    try {
      let n = window.localTool;
      if (n) {
        return await n.saveKV(e, t);
      } else {
        return false;
      }
    } catch {
      return false;
    }
  },
  async remove(e) {
    try {
      let t = window.localTool;
      if (t?.status?.isConnected) {
        return await t.saveKV(e, ``);
      } else {
        return false;
      }
    } catch {
      return false;
    }
  },
  isAvailable() {
    return !!window.localTool?.status?.isConnected;
  }
};
var Ir = new Map();
var Lr = new Map();
var Rr = 600000;
var zr = [`img_`, `img_thumb_`, `video_thumb_`];
function Br(e) {
  return zr.some(t => {
    return e.startsWith(t);
  });
}
function Vr(e) {
  Ir.delete(e);
  Lr.delete(e);
}
async function Hr(e) {
  if (!Br(e)) {
    return Fr.get(e);
  }
  let t = Date.now();
  let n = Ir.get(e);
  if (n && n.expireAt > t) {
    return n.value;
  }
  let r = Lr.get(e);
  if (r) {
    return r;
  }
  let i = (async () => {
    return Fr.get(e);
  })();
  Lr.set(e, i);
  try {
    let t = await i;
    Ir.set(e, {
      value: t,
      expireAt: Date.now() + Rr
    });
    return t;
  } finally {
    Lr.delete(e);
  }
}
var Ur = {
  async get(e) {
    try {
      if (typeof chrome < `u` && chrome.storage?.local) {
        return new Promise(t => {
          chrome.storage.local.get([e], n => {
            t(n[e] ?? null);
          });
        });
      } else {
        return null;
      }
    } catch {
      return null;
    }
  },
  async set(e, t) {
    try {
      if (typeof chrome < `u` && chrome.storage?.local) {
        return new Promise(n => {
          chrome.storage.local.set({
            [e]: t
          }, () => {
            n(!chrome.runtime.lastError);
          });
        });
      } else {
        return false;
      }
    } catch {
      return false;
    }
  },
  async remove(e) {
    try {
      if (typeof chrome < `u` && chrome.storage?.local) {
        return new Promise(t => {
          chrome.storage.local.remove(e, () => {
            t(!chrome.runtime.lastError);
          });
        });
      } else {
        return false;
      }
    } catch {
      return false;
    }
  },
  async getMultiple(e) {
    try {
      if (typeof chrome < `u` && chrome.storage?.local) {
        return new Promise(t => {
          chrome.storage.local.get(e, n => {
            let r = {};
            e.forEach(e => {
              r[e] = n[e] ?? null;
            });
            t(r);
          });
        });
      } else {
        return {};
      }
    } catch {
      return {};
    }
  },
  isAvailable() {
    return !!(typeof chrome < `u`) && !!chrome.storage?.local;
  }
};
var Wr = {
  async get(e) {
    let t = localStorage.getItem(e);
    if (t == null) {
      return null;
    }
    if (e === Ar.TRANSIT_RESOURCES || e.startsWith(Ar.CANVAS_STATE_PREFIX)) {
      try {
        return JSON.parse(t);
      } catch {}
    }
    return t;
  },
  async set(e, t) {
    try {
      let n = typeof t == `string` ? t : JSON.stringify(t);
      localStorage.setItem(e, n);
      return true;
    } catch {
      return false;
    }
  },
  async remove(e) {
    try {
      localStorage.removeItem(e);
      return true;
    } catch {
      return false;
    }
  },
  async getMultiple(e) {
    let t = {};
    e.forEach(e => {
      t[e] = localStorage.getItem(e);
    });
    return t;
  },
  isAvailable() {
    return true;
  }
};
var Gr = {
  async get(e) {
    try {
      return await kr.default.getItem(e);
    } catch {
      return null;
    }
  },
  async set(e, t) {
    try {
      await kr.default.setItem(e, t);
      return true;
    } catch {
      return false;
    }
  },
  async remove(e) {
    try {
      await kr.default.removeItem(e);
      return true;
    } catch {
      return false;
    }
  },
  async clear() {
    try {
      await kr.default.clear();
      return true;
    } catch {
      return false;
    }
  }
};
var Kr = {
  isLocalToolAvailable() {
    return Fr.isAvailable();
  },
  getStatus() {
    return {
      localTool: Fr.isAvailable(),
      chromeStorage: Ur.isAvailable(),
      localStorage: Wr.isAvailable()
    };
  },
  getAvailableEngines() {
    let e = [];
    if (Fr.isAvailable()) {
      e.push(`localTool`);
    }
    if (Ur.isAvailable()) {
      e.push(`chromeStorage`);
    }
    if (Wr.isAvailable()) {
      e.push(`localStorage`);
    }
    return e;
  },
  async getConfig(e) {
    if (Mr()) {
      let t = Nr.get(e);
      if (t == null) {
        return null;
      } else if (typeof t == `string`) {
        return t;
      } else {
        return JSON.stringify(t);
      }
    }
    try {
      let t = await Hr(e);
      if (t != null) {
        if (typeof t == `object`) {
          return JSON.stringify(t);
        } else {
          return String(t);
        }
      }
      let n = await Hr(e);
      if (n == null) {
        return null;
      } else if (typeof n == `object`) {
        return JSON.stringify(n);
      } else {
        return String(n);
      }
    } catch (t) {
      console.error(`[Storage] 读取 ${e} 失败:`, t);
      return null;
    }
  },
  async setConfig(e, t) {
    if (Mr()) {
      Nr.set(e, t);
      return true;
    }
    try {
      let n = await Fr.set(e, t);
      if (n) {
        Vr(e);
      }
      console.log(`[Storage] 保存到 localTool ${e}: ${n ? `成功` : `失败`}`);
      return n;
    } catch (t) {
      console.error(`[Storage] 保存 ${e} 失败:`, t);
      return false;
    }
  },
  async getObject(e) {
    if (Mr()) {
      let t = Nr.get(e);
      if (t === undefined) {
        return null;
      } else {
        return t;
      }
    }
    let t = await Hr(e);
    if (t != null && t !== ``) {
      try {
        if (typeof t == `object`) {
          return t;
        }
        let e = t;
        try {
          return JSON.parse(e);
        } catch {
          return e;
        }
      } catch (t) {
        console.error(`[Storage] 处理 ${e} 失败:`, t);
      }
    }
    console.log(`[Storage] localTool 中 ${e} 不存在或为空`);
    let n = e.startsWith(Ar.CANVAS_STATE_PREFIX);
    let r = e === Ar.TRANSIT_RESOURCES;
    if (n || r) {
      try {
        let t = await Gr.get(e);
        if (t != null) {
          try {
            await Fr.setObject(e, t);
            Vr(e);
            console.log(`[Storage] 回退恢复 ${e}（来自 localforage 历史数据，已回填 localTool）`);
          } catch {}
          return t;
        }
      } catch {}
      try {
        let t = await Wr.get(e);
        if (t != null) {
          try {
            let n = typeof t == `string` ? JSON.parse(t) : t;
            await Fr.setObject(e, n);
            Vr(e);
            console.log(`[Storage] 回退恢复 ${e}（来自 localStorage 历史数据，已回填 localTool）`);
            return n;
          } catch {}
          return t;
        }
      } catch {}
    }
    return null;
  },
  async setObject(e, t) {
    if (Mr()) {
      Nr.set(e, t);
      return true;
    }
    if (t == null) {
      console.warn(`[Storage] 拒绝保存空值 (null/undefined) 到 ${e}`);
      return false;
    }
    if (typeof t == `object`) {
      let n = Object.keys(t).length === 0;
      let r = Array.isArray(t) && t.length === 0;
      if (n) {
        console.warn(`[Storage] 拒绝保存空对象 {} 到 ${e}`);
      }
      if (r) {
        console.warn(`[Storage] 拒绝保存空数组 [] 到 ${e}`);
      }
      if (e.startsWith(Ar.CANVAS_STATE_PREFIX)) {
        let n = t;
        if (!n.nodes || n.nodes.length === 0) {
          console.warn(`[Storage] 拒绝保存无节点的画布状态到 ${e}`);
          return false;
        }
      }
    }
    if (typeof t == `string` && t.trim() === ``) {
      console.warn(`[Storage] 拒绝保存空字符串到 ${e}`);
      return false;
    }
    try {
      let n = await Fr.setObject(e, t);
      if (n) {
        Vr(e);
      }
      console.log(`${new Date().toLocaleString()} [Storage] 保存对象到 localTool ${e}: ${n ? `成功` : `失败`}`);
      return n;
    } catch (t) {
      console.error(`[Storage] 保存对象 ${e} 失败:`, t);
      return false;
    }
  },
  async remove(e) {
    if (Mr()) {
      Nr.delete(e);
      Pr.delete(e);
      return true;
    }
    try {
      let t = await Fr.remove(e);
      Vr(e);
      return t;
    } catch (t) {
      console.error(`[Storage] 删除 ${e} 失败:`, t);
      return false;
    }
  },
  async getMultiple(e) {
    let t = {};
    if (Mr()) {
      e.forEach(e => {
        let n = Nr.get(e);
        if (n != null) {
          if (typeof n == `string`) {
            t[e] = n;
          } else {
            t[e] = JSON.stringify(n);
          }
        }
      });
      return t;
    }
    try {
      let n = e.map(async e => {
        return {
          key: e,
          value: (await Fr.get(e))?.toString()
        };
      });
      (await Promise.all(n)).forEach(({
        key: e,
        value: n
      }) => {
        if (n != null) {
          t[e] = n;
        }
      });
      let r = e.filter(e => {
        return !(e in t);
      });
      if (r.length > 0) {
        console.log(`[Storage] 批量同步 ${r.length} 个缺失的键到 localTool`);
        await this.syncMultipleToLocalTool(r);
        let e = r.map(async e => {
          return {
            key: e,
            value: await Fr.get(e)
          };
        });
        (await Promise.all(e)).forEach(({
          key: e,
          value: n
        }) => {
          if (n !== null) {
            t[e] = n.toString();
          }
        });
      }
    } catch (e) {
      console.error(`[Storage] 批量读取失败:`, e);
    }
    return t;
  },
  async setMultiple(e) {
    let t = true;
    for (let [n, r] of Object.entries(e)) {
      if (!(await this.setConfig(n, r))) {
        t = false;
      }
    }
    return t;
  },
  async has(e) {
    let t = await this.getConfig(e);
    return t !== null && t !== ``;
  },
  async syncToLocalTool(e) {
    if (!Fr.isAvailable()) {
      return false;
    }
    if (Ur.isAvailable()) {
      let t = await Ur.get(e);
      if (t !== null) {
        console.log(`[Storage] 从 Chrome Storage 同步 ${e} 到 localTool`);
        return await Fr.set(e, t);
      }
    }
    let t = await Wr.get(e);
    if (t !== null) {
      console.log(`[Storage] 从 localStorage 同步 ${e} 到 localTool`);
      return await Fr.set(e, t);
    }
    if (e === Ar.TRANSIT_RESOURCES || e.startsWith(`canvas-state-v1-`)) {
      let t = await Gr.get(e);
      if (t !== null) {
        console.log(`[Storage] 从 localforage 同步 ${e} 到 localTool`);
        return await Fr.setObject(e, t);
      }
    }
    console.log(`[Storage] ${e} 在所有存储中都未找到`);
    return false;
  },
  async syncMultipleToLocalTool(e) {
    if (Fr.isAvailable()) {
      for (let t of e) {
        await this.syncToLocalTool(t);
      }
    }
  },
  async syncAllToLocalTool() {
    let e = [Ar.USERS, Ar.MEMBERSHIP, Ar.OLD_MEMBERSHIP, Ar.PROJECTS, Ar.LAST_OPENED_PROJECT, Ar.GLOBAL_TASKS, Ar.CUSTOM_NODE_TEMPLATES, Ar.APP_SETTINGS, Ar.TRANSIT_RESOURCES, Ar.TRANSIT_GRID_COLS];
    let t = 0;
    let n = [];
    for (let r of e) {
      if (await this.syncToLocalTool(r)) {
        t++;
      } else {
        n.push(r);
      }
    }
    console.log(`[Storage] 全量同步完成: 成功 ${t}, 失败 ${n.length}`);
    return {
      synced: t,
      failed: n
    };
  },
  async hasLocalToolData() {
    if (!Fr.isAvailable()) {
      return false;
    }
    let e = [Ar.PROJECTS, Ar.USERS, Ar.TRANSIT_RESOURCES];
    for (let t of e) {
      let e = await Fr.get(t);
      if (e !== null && e !== ``) {
        return true;
      }
    }
    return false;
  },
  async getLocalforage(e) {
    if (Mr()) {
      let t = Nr.get(e);
      if (t === undefined) {
        return null;
      } else {
        return t;
      }
    }
    let t = await Fr.get(e);
    if (t !== null) {
      try {
        return t;
      } catch {
        return t;
      }
    }
    return await Gr.get(e);
  },
  async setLocalforage(e, t) {
    if (Mr()) {
      Nr.set(e, t);
      return true;
    } else {
      if (Fr.isAvailable()) {
        await Fr.setObject(e, t);
      }
      return await Gr.set(e, t);
    }
  },
  async clearLocalforage() {
    return await Gr.clear();
  },
  async saveCanvasState(e, t) {
    let n = jr(e);
    return await this.setLocalforage(n, t);
  },
  async loadCanvasState(e) {
    let t = jr(e);
    return await this.getLocalforage(t);
  },
  async saveCanvasStateWithVersion(e, t, n) {
    let r = jr(e);
    if (Mr()) {
      if (!t.nodes || t.nodes.length === 0) {
        console.log(`[Storage] 画布状态为空，跳过保存`);
        return {
          success: false,
          skipped: true
        };
      }
      let e = `${r}_version`;
      let i = Pr.get(e) || 0;
      if (i > n) {
        return {
          success: false,
          skipped: true,
          conflictVersion: i
        };
      } else {
        Nr.set(r, t);
        Pr.set(e, n);
        return {
          success: true,
          skipped: false
        };
      }
    }
    let i = Array.isArray(t?.nodes) ? t.nodes.length : 0;
    if (i === 0) {
      console.log(`[Storage] 画布状态为空，跳过保存`);
      return {
        success: false,
        skipped: true
      };
    }
    let a = `${r}_version`;
    let o = await Fr.get(a);
    let s = o ? parseInt(String(o), 10) : 0;
    let c = s > 0;
    if (s > n) {
      console.warn(`[Storage] 版本冲突！远程版本 ${s} > 本地版本 ${n}，拒绝覆盖`);
      return {
        success: false,
        skipped: true,
        conflictVersion: s
      };
    }
    if (!c && i === 0) {
      let e = await Gr.get(r);
      let t = Array.isArray(e?.nodes) ? e.nodes.length : 0;
      let n = await Wr.get(r);
      let o = 0;
      try {
        let e = typeof n == `string` ? JSON.parse(n) : n;
        if (e && Array.isArray(e.nodes)) {
          o = e.nodes.length;
        }
      } catch {}
      let s = Math.max(t, o);
      if (s > i) {
        let c = `${r}_migration_backup`;
        let l = t >= o ? e : typeof n == `string` ? JSON.parse(n) : n;
        if (l) {
          try {
            await Gr.set(c, l);
          } catch {}
          try {
            await Fr.setObject(r, l);
            Vr(r);
          } catch {}
          try {
            await Fr.set(a, String(Date.now()));
          } catch {}
        }
        console.warn(`[Storage] 迁移保护：阻止空画布(${i}节点)覆盖历史(${s}节点)，已回填历史并打 migration_backup 标签`);
        return {
          success: false,
          skipped: true,
          preservedDueToEmptyOverwrite: true,
          restoredFromHistory: true
        };
      }
    }
    if (c) {
      try {
        let e = await Fr.get(r);
        let t = typeof e == `string` ? JSON.parse(e) : e;
        if (t && Array.isArray(t.nodes) && t.nodes.length > i) {
          let e = `${r}_migration_backup`;
          await Gr.set(e, t);
        }
      } catch {}
    }
    let l = await Fr.setObject(r, t);
    let u = await Fr.set(a, String(n));
    try {
      await Gr.set(r, t);
    } catch {}
    try {
      await Wr.set(r, t);
    } catch {}
    if (l && u) {
      console.log(`[Storage] 保存画布状态成功，版本号: ${n}`);
    }
    return {
      success: l && u,
      skipped: false
    };
  },
  async getCanvasVersion(e) {
    let t = `${jr(e)}_version`;
    if (Mr()) {
      return Pr.get(t) || 0;
    }
    let n = await Fr.get(t);
    if (n) {
      return parseInt(String(n), 10);
    } else {
      return 0;
    }
  },
  async deleteCanvasState(e) {
    let t = jr(e);
    if (Mr()) {
      Nr.delete(t);
      Pr.delete(`${t}_version`);
      return true;
    } else {
      if (Fr.isAvailable()) {
        await Fr.remove(t);
      }
      return await Gr.remove(t);
    }
  },
  async migrate(e, t, n = true) {
    let r = await this.getConfig(e);
    if (!r) {
      return false;
    }
    try {
      if (n) {
        let e = JSON.parse(r);
        await this.setObject(t, e);
      } else {
        await this.setConfig(t, r);
      }
      console.log(`[Storage] 迁移 ${e} -> ${t} 成功`);
      return true;
    } catch (n) {
      console.error(`[Storage] 迁移 ${e} -> ${t} 失败:`, n);
      return false;
    }
  }
};
var qr = [200, 300, 400, 500, 600, 700, 800, 900, 1000];
function Jr(e) {
  if (!Number.isFinite(e) || e <= 0) {
    return qr[0];
  }
  for (let t of qr) {
    if (e <= t) {
      return t;
    }
  }
  return null;
}
function Yr(e, t, n) {
  if (!e) {
    return e ?? ``;
  }
  if (!e.includes(`/files/`) || e.startsWith(`data:`) || e.startsWith(`blob:`)) {
    return e;
  }
  if (t === null) {
    if (n === `video`) {
      return Yr(e, qr[qr.length - 1], `video`);
    } else {
      return e;
    }
  }
  let [r, i] = e.split(`?`);
  return `${r}${n === `video` ? `_frame1_resize_${t}.jpg` : `_resize_${t}.jpg`}${i ? `?${i}` : ``}`;
}
var Xr = `_frame1.jpg`;
function Zr(e) {
  if (!e || !e.includes(`/files/`) || e.startsWith(`data:`) || e.startsWith(`blob:`)) {
    return null;
  }
  let [t, n] = e.split(`?`);
  return `${t}${Xr}${n ? `?${n}` : ``}`;
}
function Qr(e, t) {
  let n = Zr(e);
  if (n) {
    return Yr(n, t, `image`);
  } else {
    return null;
  }
}
function $r(e) {
  if (!e) {
    return null;
  }
  let t = e.split(`?`)[0];
  let n = t.indexOf(`/files/resources/`);
  if (n < 0) {
    return null;
  }
  let r = t.slice(n + 17);
  let i = r.lastIndexOf(`/`);
  if (i < 0) {
    return {
      subfolder: ``,
      filename: r
    };
  } else {
    return {
      subfolder: r.slice(0, i),
      filename: r.slice(i + 1)
    };
  }
}
var ei = null;
var ti = 0;
var ni = 3000;
async function ri() {
  let e = Date.now();
  if (ei !== null && e - ti < ni) {
    return ei;
  }
  try {
    let e = new AbortController();
    let t = setTimeout(() => {
      return e.abort();
    }, 1000);
    let n = await fetch(`${Mn()}/api/status`, {
      signal: e.signal
    });
    clearTimeout(t);
    ei = n.ok;
    if (n.ok) {
      try {
        let e = await n.clone().json();
        if (typeof e?.ffmpeg == `boolean`) {
          e.ffmpeg;
        }
      } catch {}
    }
  } catch {
    ei = false;
  }
  ti = e;
  return ei;
}
async function ii(e) {
  if (e instanceof File) {
    let t = e.name.includes(`.`) ? e.name.split(`.`).pop() : ai(e.type);
    return {
      blob: e,
      suggestedName: e.name,
      ext: t
    };
  }
  if (e instanceof Blob) {
    let t = ai(e.type);
    return {
      blob: e,
      suggestedName: `blob_${Date.now()}.${t}`,
      ext: t
    };
  }
  if (e.startsWith(`data:`)) {
    let t = oi(e);
    let n = ai(t.type);
    return {
      blob: t,
      suggestedName: `data_${Date.now()}.${n}`,
      ext: n
    };
  }
  let t = await (await fetch(e)).blob();
  let n = ai(t.type);
  return {
    blob: t,
    suggestedName: `remote_${Date.now()}.${n}`,
    ext: n
  };
}
function ai(e) {
  if (e) {
    if (e.includes(`png`)) {
      return `png`;
    } else if (e.includes(`jpeg`) || e.includes(`jpg`)) {
      return `jpg`;
    } else if (e.includes(`webp`)) {
      return `webp`;
    } else if (e.includes(`gif`)) {
      return `gif`;
    } else if (e.includes(`mp4`)) {
      return `mp4`;
    } else if (e.includes(`webm`)) {
      return `webm`;
    } else if (e.includes(`flac`)) {
      return `flac`;
    } else if (e.includes(`aac`)) {
      return `aac`;
    } else if (e.includes(`ogg`)) {
      return `ogg`;
    } else if (e.includes(`opus`)) {
      return `opus`;
    } else if (e.includes(`mpeg`)) {
      return `mp3`;
    } else if (e.includes(`m4a`) || e.includes(`mp4a`)) {
      return `m4a`;
    } else if (e.includes(`wav`)) {
      return `wav`;
    } else if (e.includes(`aiff`)) {
      return `aiff`;
    } else if (e.includes(`plain`)) {
      return `txt`;
    } else {
      return (e.split(`/`)[1] || ``).replace(/^x-/, ``) || `bin`;
    }
  } else {
    return `bin`;
  }
}
function oi(e) {
  let [t, n] = e.split(`,`);
  let r = t.match(/data:([^;]+)/)?.[1] || `application/octet-stream`;
  let i = t.includes(`;base64`) ? atob(n) : decodeURIComponent(n);
  let a = new ArrayBuffer(i.length);
  let o = new Uint8Array(a);
  for (let e = 0; e < i.length; e++) {
    o[e] = i.charCodeAt(e);
  }
  return new Blob([a], {
    type: r
  });
}
async function si(e, t = {}) {
  if (!(await ri())) {
    return null;
  }
  try {
    let {
      blob: n,
      ext: r
    } = await ii(e);
    let i = t.filename || `${li(n.type)}_${Date.now()}_${ui()}.${r}`;
    let a = new FormData();
    a.append(`file`, n, i);
    a.append(`subfolder`, t.subfolder ?? `canvas`);
    let o = await fetch(`${Mn()}/api/files/upload`, {
      method: `POST`,
      body: a
    });
    if (!o.ok) {
      return null;
    }
    let s = await o.json();
    if (s?.url) {
      return {
        url: s.url,
        thumbnailUrl: s.thumbnailUrl,
        path: s.path
      };
    } else {
      return null;
    }
  } catch (e) {
    console.warn(`[uploadHelper] uploadToLocalTool failed:`, e);
    return null;
  }
}
async function ci(e, t = {}) {
  if (!e || typeof e != `string` || !(await ri())) {
    return null;
  }
  try {
    let n = new FormData();
    n.append(`fileUrl`, e);
    n.append(`subfolder`, t.subfolder ?? `canvas`);
    if (t.filename) {
      n.append(`filename`, t.filename);
    }
    let r = await fetch(`${Mn()}/api/files/upload`, {
      method: `POST`,
      body: n
    });
    if (!r.ok) {
      return null;
    }
    let i = await r.json();
    if (i?.url) {
      return {
        url: i.url,
        thumbnailUrl: i.thumbnailUrl,
        path: i.path
      };
    } else {
      return null;
    }
  } catch (e) {
    console.warn(`[uploadHelper] uploadRemoteUrlToLocalTool failed:`, e);
    return null;
  }
}
function li(e) {
  if (e.startsWith(`image/`)) {
    return `img`;
  } else if (e.startsWith(`video/`)) {
    return `vid`;
  } else if (e.startsWith(`audio/`)) {
    return `aud`;
  } else {
    return `file`;
  }
}
function ui() {
  return Math.random().toString(36).slice(2, 8);
}
var di = new Map();
var fi = new Map();
var pi = 300000;
async function mi(e, t = {}) {
  if (!e || !e.includes(`/files/`)) {
    return null;
  }
  let n = `${e}|${t.maxDim ?? ``}|${t.quality ?? ``}`;
  let r = Date.now();
  let i = di.get(n);
  if (i && i.expireAt > r) {
    return i.value;
  }
  let a = fi.get(n);
  if (a) {
    return a;
  }
  let o = (async () => {
    if (!(await ri())) {
      return null;
    }
    try {
      let n = new URLSearchParams({
        url: e
      });
      if (t.maxDim) {
        n.set(`maxDim`, String(t.maxDim));
      }
      if (t.quality) {
        n.set(`quality`, String(t.quality));
      }
      let r = await fetch(`${Mn()}/api/files/thumbnail?${n.toString()}`);
      return r.ok && (await r.json())?.thumbnailUrl || null;
    } catch {
      return null;
    }
  })();
  fi.set(n, o);
  try {
    let e = await o;
    di.set(n, {
      value: e,
      expireAt: Date.now() + pi
    });
    return e;
  } finally {
    fi.delete(n);
  }
}
async function hi(e, t = {}) {
  if (typeof e == `string` && /^https?:\/\//i.test(e) && !e.startsWith(`data:`)) {
    if (t.preferThumbnail && e.includes(`/files/`)) {
      return {
        url: e,
        thumbnailUrl: (await mi(e, {
          maxDim: t.thumbMaxDim,
          quality: t.thumbQuality
        })) || undefined
      };
    } else {
      return {
        url: e
      };
    }
  }
  let n = await si(e, {
    subfolder: t.subfolder ?? `canvas`,
    generateThumb: !!t.preferThumbnail,
    thumbMaxDim: t.thumbMaxDim,
    thumbQuality: t.thumbQuality
  });
  if (n) {
    return {
      url: gi(n.url),
      thumbnailUrl: n.thumbnailUrl ? gi(n.thumbnailUrl) : undefined
    };
  } else if (typeof e == `string`) {
    return {
      url: e
    };
  } else {
    return {
      url: URL.createObjectURL(e)
    };
  }
}
function gi(e) {
  if (!e || typeof e != `string` || jn()) {
    return e;
  }
  let t = window.location.hostname;
  if (t && t !== `127.0.0.1` && t !== `localhost`) {
    return e.replace(/127\.0\.0\.1/g, t);
  } else {
    return e;
  }
}
async function _i(e) {
  if (!e || typeof e != `string` || !e.includes(`/files/`) || !(await ri())) {
    return false;
  }
  let t = $r(e);
  if (!t) {
    return false;
  }
  let n = `${t.filename}${Xr}`;
  try {
    let {
      captureVideoFrameBlob: r
    } = await le(async () => {
      let {
        captureVideoFrameBlob: e
      } = await Promise.resolve().then(() => {
        return pc;
      });
      return {
        captureVideoFrameBlob: e
      };
    }, undefined, import.meta.url);
    return !!(await si(await r(e), {
      subfolder: t.subfolder,
      filename: n
    }))?.url;
  } catch (e) {
    console.warn(`[uploadHelper] ensureVideoPoster failed, will fall back to <video>:`, e);
    return false;
  }
}
function vi(e) {
  return Vt(t => {
    let n = t.transform[2] || 1;
    return Jr((e ?? 0) * n);
  });
}
var Ci = `M20.7624 0C0.868225 2.29614 0.393066 20.877 0 28.8621L1.21155 28.8621C1.21155 21.9207 4.94049 21.4546 8.42853 20.6113C13.6559 19.3462 17.0903 14.3184 17.95 10.2493L15.8051 9.17358L16.9758 7.71509C18.1466 6.25684 19.2449 4.14502 20.7624 0L20.7624 0Z`;
var Ei = [{
  text: `提问前加上“你是一位资深文案”，AI的输出结构会更专业`,
  category: `text`
}, {
  text: `告诉AI“请使用积极的语气”，比说“不要用消极语气”效果更好`,
  category: `text`
}, {
  text: `在提示词中附带满意的案例，AI能迅速模仿你的行文格式`,
  category: `text`
}, {
  text: `加上“请一步步进行推理”，能大幅提高处理复杂逻辑题的准确率`,
  category: `text`
}, {
  text: `交待清楚目标受众和具体应用场景，生成的文案会更有针对性`,
  category: `text`
}, {
  text: `不要让AI一次写完长文，先生成大纲，确认后再逐段扩写`,
  category: `text`
}, {
  text: `设定具体的字数和情绪，如“写一段100字幽默带讽刺的短评”`,
  category: `text`
}, {
  text: `输入长文并要求“提取时间、地点、人物，并以JSON格式输出”`,
  category: `text`
}, {
  text: `把优秀的文案喂给AI，让它分析并反推当初生成这段文案的提示词`,
  category: `text`
}, {
  text: `大部分的大模型都支持图片反推，但支持视频反推的不对，例如Qwen系列`,
  category: `text`
}, {
  text: `把最重要的元素（如人物、主要物体）放在提示词的最开头位置`,
  category: `image`
}, {
  text: `加入“电影级光效”、“丁达尔效应”或“边缘背光”提升画面高级感`,
  category: `image`
}, {
  text: `使用“广角镜头”、“微距特写”或“俯视仰拍”精准控制画面构图`,
  category: `image`
}, {
  text: `提示词中加入“莫兰迪色系”、“高对比度”统一画面的色彩倾向`,
  category: `image`
}, {
  text: `添加“杰作、最高画质、8k分辨率、细节极其丰富”等通用魔法词`,
  category: `image`
}, {
  text: `利用参考图控制构图走势，配合文本提示词进行二次风格迁移`,
  category: `image`
}, {
  text: `描述细节忌抽象：说“穿红裙在雨中撑伞的女孩”，不要说“忧郁女孩”`,
  category: `image`
}, {
  text: `大尺寸慢不稳而且贵，可以先生成小尺寸，满意后高清放大处理`,
  category: `image`
}, {
  text: `越具体的穿搭描述，越能避免AI随机生成结构奇怪的衣服款式`,
  category: `image`
}, {
  text: `若生成元素过多显得拥挤，加上“极简主义”、“干净的背景”、“留白”`,
  category: `image`
}, {
  text: `提示词中加入“镜头缓慢平移”、“推镜头”来精确控制运镜语言`,
  category: `video`
}, {
  text: `利用昂贵主力模型+首尾帧便宜模型，是省钱有好用的方法`,
  category: `video`
}, {
  text: `拆解动作过程，如“他先低头看手表，然后慢慢抬头望向天空”`,
  category: `video`
}, {
  text: `对于长视频，提供多视角的参考图，能有效减少过程中的人物崩坏`,
  category: `video`
}, {
  text: `描述动作和场景即可，太复杂的心理描写AI视频模型目前无法表现`,
  category: `video`
}, {
  text: `添加光影动态变化，如“阳光透过树叶缝隙，光斑在人物脸上移动”`,
  category: `video`
}, {
  text: `先用极高画质的模型生成图像，再输入到视频模型让图片动起来`,
  category: `video`
}, {
  text: `根据低端模型模型能力选择5秒生成，过长的时间容易导致后半段画面崩塌`,
  category: `video`
}, {
  text: `部分模型支持音频节点，让可以让生成的数字人根据台词音频精准对口型`,
  category: `video`
}, {
  text: `描述“大雪纷飞”、“烟雾弥漫”，这类动态粒子效果AI处理极为出色`,
  category: `video`
}, {
  text: `加入“频繁眨眼”、“嘴角微微上扬”，让生成的视频人物更有生命力`,
  category: `video`
}, {
  text: `单个短镜头内尽量保持单一视角，复杂的机位切换容易导致空间错乱`,
  category: `video`
}, {
  text: `写长视频脚本时，务必把提示词按照场景分开，建立独立节点生成`,
  category: `video`
}, {
  text: `上传真人动作视频作为骨骼参考，让AI角色完美复刻复杂的舞蹈动作`,
  category: `video`
}, {
  text: `打斗跳舞高运动感模型目前只推荐SD2`,
  category: `video`
}, {
  text: `在连续节点中传递相同的角色设定，确保下一秒主角不会突然换衣服`,
  category: `video`
}, {
  text: `设定首尾完全相同的画面特征，非常适合制作动态壁纸或网页背景`,
  category: `video`
}, {
  text: `生文写分镜，生图做原画，最后一起喂给生视频节点，流程无缝衔接`,
  category: `video`
}, {
  text: `画布支持多个项目管理，不要把所有都放在一个项目里面`,
  category: `general`
}, {
  text: `生成的满意结果随时拖入素材，作为公共素材池供各节点调用`,
  category: `general`
}, {
  text: `在复杂的节点群旁边添加文本便签，几个月后你依然能一眼看懂逻辑`,
  category: `general`
}, {
  text: `工作流会被实时保存在本地，即使意外关闭浏览器，进度也绝不会丢失`,
  category: `general`
}, {
  text: `使用快捷键Q / W /E，让你快速添加常用节点`,
  category: `general`
}, {
  text: `目前Window支持将资源一键传入剪映，非常高效`,
  category: `general`
}, {
  text: `不要把所有图片都铺满整个画布，不妨试试图片盒子`,
  category: `image`
}, {
  text: `画布太乱？点击“自动整理”功能，让复杂的节点拓扑图瞬间井井有条`,
  category: `general`
}, {
  text: `想在家/在公司资源共享，迁移你的文件的最快方法是把data文件夹搬过去`,
  category: `general`
}, {
  text: `对于视频生成节点，双击即可在画布悬浮窗中全屏播放，无需下载查看`,
  category: `general`
}, {
  text: `不要把整章小说丢给AI，按场景发生地切分成小段，剧本生成会更精准`,
  category: `text`
}, {
  text: `小说里的心理活动无法直接拍出，让AI将其转化为具体的微表情或肢体动作`,
  category: `text`
}, {
  text: `拆解动作时避免连贯长句，让AI重写为“他拔出剑。他向前冲刺”的短平快句型`,
  category: `text`
}, {
  text: `设定镜头感：“请用导演口吻描述剧情，多使用推镜头、特写和全景等专业术语”`,
  category: `text`
}, {
  text: `对于战斗场景，提示AI“增加动词密度，强调力量和速度感，减少修饰性形容词”`,
  category: `text`
}, {
  text: `遇到抽象设定（如剑气、威压），让AI具象化为“发光的蓝色半月形能量波”`,
  category: `text`
}, {
  text: `剧本分镜编号化：要求AI输出“Shot 1, Shot 2”，在画布中对应独立分支`,
  category: `text`
}, {
  text: `如果主角会变身，在小传节点中提前定义好“常态”和“变身态”的两套特征库`,
  category: `text`
}, {
  text: `小说转绘本的核心是角色一致性：先跑出完美的主角三视图，作为后续垫图参考`,
  category: `image`
}, {
  text: `给角色面部打光：加入“伦勃朗光”或“蝴蝶光”，让角色五官更具立体电影感`,
  category: `image`
}, {
  text: `分镜图构图技巧：人物对话多用“过肩镜头（Over-the-shoulder）”，增强互动`,
  category: `image`
}, {
  text: `如果小说场景是宏大奇幻修仙，多用“极远景（Extreme long shot）”和史诗构图`,
  category: `image`
}, {
  text: `控制画面留白：如果该图后续要配大量旁白字幕，提示词记得加上“负空间”`,
  category: `image`
}, {
  text: `保持画风统一的捷径：在每个生图节点末尾加上同一位特定画师或电影导演的名字`,
  category: `image`
}, {
  text: `对于连贯动作，先生成静止的起步动作，这比直接生成复杂的运动画面更容易`,
  category: `image`
}, {
  text: `突出人物情绪：使用“面部特写”配合“泪水”、“咬牙”、“瞳孔地震”等微表情词`,
  category: `image`
}, {
  text: `场景氛围图不需要太清晰的人脸，强调“轮廓（Silhouette）”和环境光更出效果`,
  category: `image`
}, {
  text: `生成背影或侧脸：有效规避正脸崩坏的风险，同时还能增加画面的故事悬念感`,
  category: `image`
}, {
  text: `重要武器或道具：单独生成高清大图，在后续剧情中作为局部重绘的参考源`,
  category: `image`
}, {
  text: `色彩心理学：回忆情节用“泛黄滤镜/黑白”，战斗高潮用“高饱和度对比色”`,
  category: `image`
}, {
  text: `仰拍能让反派显得高大威猛，俯拍（High angle）能表现角色的弱小与无助`,
  category: `image`
}, {
  text: `避免画面太平淡：加入“前景遮挡（Foreground framing）”，如透过树叶看主角`,
  category: `image`
}, {
  text: `整场戏的提示词都带上“蓝绿色调（Teal and orange）”，轻松打造好莱坞大片质感`,
  category: `image`
}, {
  text: `不要每一格都画满人物：适当插入只画背景空镜头的过渡图，让节奏张弛有度`,
  category: `image`
}, {
  text: `生成速度感画面：加上“运动模糊（Motion blur）”和“速度线”视觉效果`,
  category: `image`
}, {
  text: `固定一张完美的图作为风格锚点，通过工作流将其作为所有后续生成的参考`,
  category: `image`
}, {
  text: `图生视频第一准则：原图必须足够清晰，视频的画质与稳定性上限由原图决定`,
  category: `video`
}, {
  text: `视频提示词要克制：不要重复描述图片里已有的东西，重点描述什么东西怎么动`,
  category: `video`
}, {
  text: `小说里的打斗戏：运镜词使用“快速平移（Fast pan）”或“推拉镜头”增强冲击力`,
  category: `video`
}, {
  text: `人物对话场景：保持摄像机微弱移动（Subtle drift），不要完全静止，增加呼吸感`,
  category: `video`
}, {
  text: `控制动作幅度：廉价模型AI视频动作过大易变形，加上“缓慢移动”能大幅提高成功率`,
  category: `video`
}, {
  text: `在视频提示词中强调“角色眨眼并看向镜头”，让原画里的纸片人瞬间活过来`,
  category: `video`
}, {
  text: `首尾相接控制：动作复刻最后一帧，但是可以换个角度`,
  category: `video`
}, {
  text: `小说转场效果：生视频时加入“黑屏过渡”或“白闪”，方便后续节点拼剪`,
  category: `video`
}, {
  text: `处理人物转身：尽量用“切换不同机位”代替“让人物在同一个镜头里转180度”`,
  category: `video`
}, {
  text: `表现时间流逝：输入一张白天场景图，提示词写“从白天变黑夜的延时摄影”`,
  category: `video`
}, {
  text: `头发和衣服的物理效果：加上“随风飘动（Blowing in the wind）”，极大增加生动感`,
  category: `video`
}, {
  text: `镜头光晕移动：提示词加“镜头光晕在画面中划过”，科幻与写实摄影感拉满`,
  category: `video`
}, {
  text: `遇到视频生成崩坏：不要硬死磕，回到生图节点换一张构图稍微不同的图片再试`,
  category: `video`
}, {
  text: `制造悬疑感：使用“缓慢向黑暗的走廊尽头推进（Slow dolly in toward darkness）”`,
  category: `video`
}, {
  text: `你用过Ctrl+D这个快捷键吗，不妨对着节点尝试下，有惊喜`,
  category: `general`
}, {
  text: `云端可以备份你的api/多开/视频模型等信息，你换了设备也可以马上用，而本地资源你需要手动备份`,
  category: `general`
}, {
  text: `别被工具困住：接受适度的随机性，有时AI的“错误”会带来意想不到的绝妙转场`,
  category: `general`
}, {
  text: `不会写提示词时，不妨查看提示词库，学习别人的经验`,
  category: `general`
}];
_cmp_Oi.displayName = `ResizableTextarea`;
var ji = {
  text: [],
  image: [],
  video: []
};
var Mi = null;
var Ni = [];
var discountVideoApiConfigModels = [];
function setDiscountVideoApiConfigModels(e) {
  discountVideoApiConfigModels = e || [];
  zi();
}
var Pi = null;
var Fi = null;
var Ii = 0;
var Li = new Set();
var Ri = {};
function zi() {
  Li.forEach(e => {
    try {
      e();
    } catch {}
  });
}
function Bi() {
  return [...Ni];
}
function Vi(e) {
  let t = (e || ``).trim();
  if (!t) {
    return null;
  }
  if (!ca(t)) {
    return {
      access: `allowed`,
      reason: null
    };
  }
  let n = Mi?.entitlements?.[t];
  if (n) {
    return n;
  }
  if (Ni.length > 0) {
    let e = Ni.find(e => {
      return e.modelName === t;
    });
    if (e) {
      return {
        access: e.access,
        reason: e.reason,
        callLimit: e.callLimit,
        usedCount: e.usedCount,
        periodType: e.periodType
      };
    }
  }
  return {
    access: `denied`,
    reason: `权益不够`
  };
}
function Hi(e) {
  let t = Vi(e);
  if (!t || t.access === `allowed`) {
    return null;
  } else {
    return t.reason || (t.access === `quota_exceeded` ? `已达到使用次数额度` : `权益不够`);
  }
}
async function Ui(e, t, n = false) {
  if (!t) {
    Ni = [];
    if (Mi) {
      Mi.entitlements = undefined;
    }
    zi();
    return;
  }
  if (Fi && !n) {
    return Fi;
  }
  if (n) {
    Fi = null;
  }
  Fi = (async () => {
    try {
      let r = e.replace(/\/$/, ``);
      let i = await (await fetch(`${r}/user/model-entitlements`, {
        headers: {
          Authorization: `Bearer ${t}`
        },
        cache: n ? `no-store` : `default`
      })).json();
      if (i.success && i.data) {
        if (Array.isArray(i.data.models)) {
          Ni = i.data.models;
        } else {
          Ni = [];
        }
        let e = {};
        for (let t of Ni) {
          e[t.modelName] = {
            access: t.access,
            reason: t.reason,
            callLimit: t.callLimit,
            usedCount: t.usedCount,
            periodType: t.periodType,
            source: t.source
          };
        }
        if (i.data.catalog) {
          let t = Mi;
          let n = {
            ...(t || {
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
          };
          let r = t?.discountVideoSpecs;
          let a = i.data.catalog.discountVideoSpecs;
          if (r && a) {
            let e = {
              ...a
            };
            for (let t of Object.keys(r)) {
              let n = r[t];
              let i = a[t];
              e[t] = {
                ...n,
                ...(i || {}),
                speed: i?.speed ?? n?.speed,
                stability: i?.stability ?? n?.stability
              };
            }
            n.discountVideoSpecs = e;
          } else if (r && !a) {
            n.discountVideoSpecs = r;
          }
          Mi = n;
        } else if (Mi) {
          Mi.entitlements = e;
        }
        Ii = Date.now();
        zi();
      }
    } catch (e) {
      console.warn(`[builtinFavorites] 拉取模型权益失败`, e);
    }
  })();
  await Fi;
  if (n) {
    Fi = null;
  }
}
function Wi() {
  Ni = [];
  if (Mi) {
    Mi.entitlements = undefined;
  }
  zi();
}
function Gi(e) {
  if (Ni.length > 0) {
    return Ni.filter(t => {
      let n = t.builtinCategory || t.category;
      if (e === `video`) {
        return n === `video` && !t.isDiscountVideo;
      } else {
        return n === e;
      }
    }).map(e => {
      return e.modelName;
    });
  } else {
    return Qi()[e] || [];
  }
}
function Ki() {
  let e;
  if (Ni.length > 0) {
    e = Ni.filter(t => {
      return t.isDiscountVideo;
    }).map(t => {
      return t.modelName;
    });
  } else {
    e = $i();
  }
  if (discountVideoApiConfigModels.length > 0) {
    let n = new Set(e);
    e = [...e, ...discountVideoApiConfigModels.filter(t => {
      return !n.has(t);
    })];
  }
  return e;
}
function qi() {
  return Mi;
}
function Ji() {
  return Ii;
}
async function Yi(e = `/api`, t = false) {
  if (Pi && !t) {
    return Pi;
  }
  if (t) {
    Pi = null;
  }
  Pi = (async () => {
    try {
      let n = e.replace(/\/$/, ``);
      let r = t ? `?t=${Date.now()}` : ``;
      let i = {
        cache: t ? `no-store` : `default`
      };
      await Xi(n, t);
      let a = await (await fetch(`${n}/public/platform/builtin${r}`, i)).json();
      if (a.success && a.data) {
        Mi = a.data;
        Ii = Date.now();
        zi();
        return Mi;
      }
    } catch (e) {
      console.warn(`[builtinFavorites] 拉取内置模型失败`, e);
    }
    return Mi;
  })();
  try {
    return await Pi;
  } finally {
    if (t) {
      Pi = null;
    }
  }
}
async function Xi(e, t) {
  try {
    let n = t ? `?t=${Date.now()}` : ``;
    let r = await (await fetch(`${e}/public/platform/models${n}`, {
      cache: t ? `no-store` : `default`
    })).json();
    if (!r?.success || !Array.isArray(r.data)) {
      return;
    }
    let i = {};
    for (let e of r.data) {
      let t = (e?.name || ``).trim();
      if (!!t && (!!e.seriesKey || !!e.seriesLabel)) {
        i[t] = {
          key: e.seriesKey || e.seriesLabel || t,
          label: e.seriesLabel || e.seriesKey || t
        };
      }
    }
    Ri = i;
    zi();
  } catch (e) {
    console.warn(`[builtinFavorites] 拉取模型系列失败`, e);
  }
}
function Zi(e) {
  Li.add(e);
  return () => {
    Li.delete(e);
  };
}
function Qi() {
  if (Mi) {
    return {
      text: [...(Mi.text || [])],
      image: [...(Mi.image || [])],
      video: [...(Mi.video || [])]
    };
  } else {
    return {
      ...ji
    };
  }
}
function $i() {
  if (Mi?.discountVideo) {
    return [...Mi.discountVideo];
  } else {
    return [];
  }
}
function ea(e) {
  let t = (e || ``).trim();
  if (!t || !Mi?.discountVideoSpecs) {
    return null;
  }
  if (Mi.discountVideoSpecs[t]) {
    return Mi.discountVideoSpecs[t];
  }
  for (let e of Object.keys(Mi.discountVideoSpecs)) {
    let n = Mi.discountVideoSpecs[e];
    if (e.replace(/^[^\w]+/, ``).replace(/[^\w]+$/, ``) === t || n?.displayName && n.displayName === t) {
      return n;
    }
  }
  return null;
}
function ta(e) {
  if (!e) {
    return null;
  }
  let t = e.trim();
  if (!t) {
    return null;
  }
  let n = Mi?.power?.[t];
  if (typeof n == `number`) {
    return n;
  } else {
    return null;
  }
}
function na(e) {
  if (!e) {
    return null;
  }
  let t = e.trim();
  return t && Mi?.unit?.[t] || null;
}
function ra(e) {
  let t = (e || ``).trim();
  if (t && Mi?.currency?.[t] === `proxy`) {
    return `proxy`;
  } else {
    return `compute`;
  }
}
function ia(e) {
  let t = (e || ``).trim();
  if (!t || !Mi?.descriptions) {
    return ``;
  } else {
    return Mi.descriptions[t] || ``;
  }
}
function aa(e) {
  let t = (e || ``).trim();
  if (!t) {
    return null;
  }
  let n = Ri[t];
  if (n) {
    return {
      key: n.key,
      label: n.label
    };
  } else {
    return null;
  }
}
function oa(e) {
  let t = (e || ``).trim();
  if (!t || !Mi?.recommended) {
    return false;
  } else {
    return !!Mi.recommended[t];
  }
}
function sa(e) {
  if (e) {
    return $i().includes(e.trim());
  } else {
    return false;
  }
}
function ca(e) {
  if (!e) {
    return false;
  }
  let t = e.trim();
  if (!t) {
    return false;
  }
  if (Ni.length > 0) {
    return Ni.some(e => {
      return e.modelName === t;
    });
  }
  let n = Qi();
  return n.text.includes(t) || n.image.includes(t) || n.video.includes(t);
}
function la(e) {
  if (Number.isFinite(e)) {
    return parseFloat(e.toFixed(3)).toString();
  } else {
    return `0`;
  }
}
function ua(e) {
  if (!ca(e)) {
    return {
      disabled: false,
      reason: null,
      ent: null
    };
  }
  let t = Vi(e);
  let n = !t || t.access !== `allowed`;
  return {
    disabled: n,
    reason: n ? Hi(e) : null,
    ent: t
  };
}
function da(e) {
  let {
    disabled: t,
    reason: n,
    ent: r
  } = ua(e);
  if (t) {
    if (r?.access === `quota_exceeded` && r.callLimit != null) {
      return `${n || `已达到使用次数额度`} (${r.usedCount ?? 0}/${r.callLimit})`;
    } else {
      return n || `权益不够`;
    }
  }
}
function fa(e, t) {
  let {
    disabled: n,
    reason: r
  } = ua(e);
  return {
    disabled: n,
    denyReason: r,
    title: da(e) || e,
    className: `w-full flex items-center gap-1.5 mb-1 last:mb-0 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors ${n ? `opacity-40 cursor-not-allowed` : `cursor-pointer ${t ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} ${t && !n ? `bg-[#333] text-white` : ``}`
  };
}
var pa = `modelSchedules`;
var ma = `modelSchedules:change`;
var ha = `schedule:`;
function ga(e) {
  let t = Math.round(Number(e) || 1);
  if (t < 1) {
    return 1;
  } else if (t > 3) {
    return 3;
  } else {
    return t;
  }
}
function _a(e) {
  if (!Array.isArray(e)) {
    return [];
  }
  let t = [];
  let n = 0;
  for (let r of e) {
    if (t.length >= 5) {
      break;
    }
    let e = typeof r?.model == `string` ? r.model.trim() : ``;
    if (!e) {
      continue;
    }
    let i = ga(r?.retries);
    if (n + i > 10) {
      i = 10 - n;
    }
    if (i <= 0) {
      break;
    }
    t.push({
      model: e,
      retries: i
    });
    n += i;
  }
  return t;
}
function va(e) {
  if (!e || typeof e != `object`) {
    return null;
  }
  let t = e;
  let n = t.category === `text` || t.category === `image` || t.category === `video` ? t.category : `image`;
  let r = _a(t.steps);
  if (!r.length) {
    return null;
  }
  let i = Date.now();
  return {
    id: typeof t.id == `string` && t.id ? t.id : ya(),
    name: typeof t.name == `string` && t.name.trim() ? t.name.trim() : `未命名调度`,
    category: n,
    enabled: !!t.enabled,
    steps: r,
    createdAt: typeof t.createdAt == `number` ? t.createdAt : i,
    updatedAt: typeof t.updatedAt == `number` ? t.updatedAt : i
  };
}
function ya() {
  return `sch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function ba(e) {
  return e.reduce((e, t) => {
    return e + (t.retries || 0);
  }, 0);
}
function xa() {
  if (typeof window > `u`) {
    return [];
  }
  try {
    let e = window.localStorage.getItem(pa);
    if (!e) {
      return [];
    }
    let t = JSON.parse(e);
    if (Array.isArray(t)) {
      return t.map(va).filter(e => {
        return !!e;
      });
    } else {
      return [];
    }
  } catch {
    return [];
  }
}
function Sa(e) {
  if (!(typeof window > `u`)) {
    try {
      window.localStorage.setItem(pa, JSON.stringify(e));
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent(ma, {
        detail: e
      }));
    } catch {}
  }
}
function Ca(e) {
  Sa(e);
  try {
    Kr.setObject(pa, e);
  } catch {}
}
function wa(e) {
  let t = va(e);
  if (!t) {
    return xa();
  }
  let n = xa();
  let r = n.findIndex(e => {
    return e.id === t.id;
  });
  t.updatedAt = Date.now();
  if (r >= 0) {
    t.createdAt = n[r].createdAt;
    n[r] = t;
  } else {
    n.push(t);
  }
  Ca(n);
  return n;
}
function Ta(e) {
  let t = xa().filter(t => {
    return t.id !== e;
  });
  Ca(t);
  return t;
}
function Ea(e, t) {
  let n = xa();
  let r = n.find(t => {
    return t.id === e;
  });
  if (r) {
    r.enabled = t;
    r.updatedAt = Date.now();
    Ca(n);
  }
  return n;
}
function Da(e) {
  if (typeof window > `u`) {
    return () => {
      return undefined;
    };
  }
  let t = t => {
    e(t.detail ?? xa());
  };
  let n = t => {
    if (t.key === `modelSchedules`) {
      e(xa());
    }
  };
  window.addEventListener(ma, t);
  window.addEventListener(`storage`, n);
  return () => {
    window.removeEventListener(ma, t);
    window.removeEventListener(`storage`, n);
  };
}
function Oa(e) {
  return `${ha}${e}`;
}
function ka(e) {
  if (e && e.startsWith(`schedule:`)) {
    return e.slice(9);
  } else {
    return null;
  }
}
function Aa(e) {
  let t = [];
  for (let n of e.steps) {
    for (let e = 0; e < n.retries; e++) {
      if (t.length >= 10) {
        return t;
      }
      t.push(n.model);
    }
  }
  return t;
}
function ja(e) {
  if (Array.isArray(e)) {
    return e.map(va).filter(e => {
      return !!e;
    });
  } else {
    return [];
  }
}
function Ma(e, t) {
  let n = new Map();
  for (let t of ja(e)) {
    n.set(t.id, t);
  }
  for (let e of ja(t)) {
    n.set(e.id, e);
  }
  return Array.from(n.values());
}
async function Na() {
  try {
    let e = await Kr.getObject(pa);
    if (!Array.isArray(e)) {
      return;
    }
    Sa(ja(e));
  } catch {}
}
async function Pa(e) {
  let t = Ma(xa(), e);
  Ca(t);
  return t;
}
var Fa = (e, t) => {
  // 语义：判断文本 e 中是否存在合法的 `@资产名` 引用（@资产名 后一位非中英文/数字，或位于文本末尾）。
  // 旧版仅检查「首个命中位置」，导致文本同时含 `@小马妈妈` 与 `@小马` 时，`@小马` 永远匹配不上（indexOf 先撞上 `@小马妈妈`，后一位「妈」非法即放弃）。
  // 现改为：检查所有命中位置，任一位置后一位合法即返回 true；全部命中后一位均非法才返回 false（保留防误报：`@小红帽` 仍不会误匹配资产 `@小红帽子`）。
  if (!e || !t) {
    return false;
  }
  let n = 0;
  while (true) {
    n = e.indexOf(`@${t}`, n);
    if (n < 0) {
      return false;
    }
    let r = e[n + 1 + t.length];
    if (r === undefined || !/[\u4e00-\u9fa5A-Za-z0-9]/.test(r)) {
      return true;
    }
    n += 1;
  }
};
var Ia = (e, t, n = `image`) => {
  if (!e?.data) {
    return ``;
  }
  if (e.type === `scriptBoxNode` && t && t.startsWith(`shot-`)) {
    let r = t.replace(`shot-`, ``);
    let i = (e.data.shots || []).find(e => {
      return e.id === r;
    });
    if (i) {
      let e = n === `video` ? i.videoPrompt || i.prompt : i.prompt || i.videoPrompt;
      if (n === `image` && e && (i.gridMode === 4 || i.gridMode === 9)) {
        let t = i.gridMode;
        e = `${e}。生成严格等分的${t}宫格单张成图：${t}个格子尺寸、宽高、留白完全一致；画布必须被画面内容铺满到四周边缘，格子之间直接相邻、无缝衔接；严禁白边、黑边、外框、内框、圆角、描边、分隔线、装饰留白、文字和编号。每格为独立完整画面但视觉风格、角色造型、色彩和光影保持一致，按阅读顺序形成连贯叙事。四宫格必须精确2×2等分，九宫格必须精确3×3等分，所有格子的边界对齐且画面满 bleed`;
      }
      if (n === `image`) {
        return String(e || ``).trim();
      }
      let t = i.dialogue || ``;
      t &&= t.split(`
`).map(e => {
        let t = e.match(/^\[([^|\]]*)\|([^\]]*)\]\s?(.*)$/);
        if (t) {
          let e = t[1];
          let n = t[2];
          let r = t[3];
          if (n) {
            return `${e}（${n}）：${r}`;
          } else {
            return `${e}：${r}`;
          }
        }
        return e;
      }).join(`
`);
      return [e || ``, t ? `对白/旁白：\n${t}` : ``, i.sound ? `音效：${i.sound}` : ``, i.motion ? `运镜：${i.motion}` : ``, i.duration ? `时长：${i.duration}` : ``].filter(Boolean).join(`
`).trim();
    }
  }
  if (e.type === `textNode` && e.data.text && typeof e.data.text == `string`) {
    let t = e.data.text.trim();
    if (/^https?:\/\/[^\s]+$/.test(t) || t.startsWith(`data:image/`)) {
      return ``;
    }
  }
  if (e.data.text === undefined) {
    if (e.data.prompt === undefined) {
      if (e.data.resultUrl === undefined) {
        if (e.data.resultData === undefined) {
          if (e.data.label !== undefined && e.type !== `imageNode`) {
            return String(e.data.label);
          } else {
            return ``;
          }
        } else if (typeof e.data.resultData == `object`) {
          return JSON.stringify(e.data.resultData, null, 2);
        } else {
          return String(e.data.resultData);
        }
      } else {
        return String(e.data.resultUrl);
      }
    } else {
      return String(e.data.prompt);
    }
  } else {
    return String(e.data.text);
  }
};
var La = (e, t) => {
  let {
    images: n,
    videos: r,
    audios: i
  } = Ra(e, t);
  return {
    images: n.map(e => {
      return e.url;
    }),
    videos: r.map(e => {
      return e.url;
    }),
    audios: i.map(e => {
      return e.url;
    })
  };
};
var Ra = (e, t) => {
  let n = [];
  let r = [];
  let i = [];
  if (!e?.data) {
    return {
      images: n,
      videos: r,
      audios: i
    };
  }
  if (e.type === `scriptBoxNode` && t && t.startsWith(`shot-`)) {
    let a = t.replace(`shot-`, ``);
    let o = (e.data.shots || []).find(e => {
      return e.id === a;
    });
    if (o) {
      let t = e.data.assets || [];
      let r = `${o.description || ``} ${o.prompt || ``} ${o.videoPrompt || ``} ${o.dialogue || ``}`;
      t.forEach(t => {
        if (t?.name && t.imageUrl && Fa(r, t.name)) {
          n.push({
            id: `${e.id}-asset-${t.id}`,
            url: t.imageUrl
          });
        }
      });
    }
    return {
      images: n,
      videos: r,
      audios: i
    };
  }
  if (e.data.imageUrl && typeof e.data.imageUrl == `string` && (e.data.imageUrl.startsWith(`http`) || e.data.imageUrl.startsWith(`data:`))) {
    let t = e.data.imageUrl;
    if (t.startsWith(`data:video/`) || /\.(mp4|webm|mov|ogg)($|\?)/i.test(t)) {
      r.push({
        id: e.id,
        url: t
      });
    } else if (t.startsWith(`data:audio/`) || /\.(mp3|wav|ogg|aac)($|\?)/i.test(t)) {
      i.push({
        id: e.id,
        url: t
      });
    } else {
      n.push({
        id: e.id,
        url: t
      });
    }
  }
  if (e.type === `customNode` && e.data.resultData) {
    let t = e.data.resultData;
    if (e.data.config?.outputType === `image`) {
      if (Array.isArray(t)) {
        t.forEach((t, r) => {
          if (typeof t == `string`) {
            n.push({
              id: `${e.id}-custom-${r}`,
              url: t
            });
          }
        });
      } else if (typeof t == `string`) {
        n.push({
          id: `${e.id}-custom-0`,
          url: t
        });
      }
    }
  }
  if (e.type === `videoExtractNode` && e.data.extractedImages) {
    if (t && t.startsWith(`frame-`)) {
      let r = parseInt(t.replace(`frame-`, ``), 10);
      if (!(e.data.hiddenIndices || []).includes(r)) {
        let t = e.data.allExtractedImages;
        if (t && t[r]) {
          n.push({
            id: `${e.id}-ext-${r}`,
            url: t[r]
          });
        }
      }
    } else {
      e.data.extractedImages.forEach((t, r) => {
        return n.push({
          id: `${e.id}-ext-${r}`,
          url: t
        });
      });
    }
  }
  if (e.type === `imageBoxNode` && Array.isArray(e.data.images)) {
    let t = e.data.images;
    let r = e.data.selectedIds || [];
    if (r.length > 0) {
      let i = new Set(r);
      t.forEach((t, r) => {
        if (t?.url && i.has(t.id)) {
          n.push({
            id: `${e.id}-box-${r}`,
            url: t.url
          });
        }
      });
    } else {
      let r = t[typeof e.data.activeIndex == `number` ? e.data.activeIndex : 0]?.url;
      if (r) {
        n.push({
          id: `${e.id}-box-active`,
          url: r
        });
      }
    }
  }
  if (e.type === `gridSplitNode` && e.data.imageUrl && t && t.startsWith(`cell-`)) {
    let r = parseInt(t.replace(`cell-`, ``), 10);
    if (e.data.extractedImages && Array.isArray(e.data.extractedImages) && e.data.extractedImages[r]) {
      n.push({
        id: `${e.id}-grid-${r}`,
        url: e.data.extractedImages[r]
      });
    }
  }
  if (e.type === `gridMergeNode` && e.data.imageUrl) {
    n.push({
      id: e.id,
      url: e.data.imageUrl
    });
  }
  if (e.data.videoUrl && typeof e.data.videoUrl == `string` && (e.data.videoUrl.startsWith(`http`) || e.data.videoUrl.startsWith(`data:`))) {
    r.push({
      id: e.id,
      url: e.data.videoUrl
    });
  }
  if (e.data.audioUrl && typeof e.data.audioUrl == `string` && (e.data.audioUrl.startsWith(`http`) || e.data.audioUrl.startsWith(`data:`))) {
    i.push({
      id: e.id,
      url: e.data.audioUrl
    });
  }
  if (e.type === `textNode` && e.data.text && typeof e.data.text == `string`) {
    let t = e.data.text.trim();
    if (/^https?:\/\/[^\s]+$/.test(t) || t.startsWith(`data:image/`)) {
      if (/\.(mp4|webm|mov|ogg)($|\?)/i.test(t)) {
        r.push({
          id: e.id,
          url: t
        });
      } else if (/\.(mp3|wav|ogg|aac)($|\?)/i.test(t)) {
        i.push({
          id: e.id,
          url: t
        });
      } else {
        n.push({
          id: e.id,
          url: t
        });
      }
    }
  }
  return {
    images: n,
    videos: r,
    audios: i
  };
};
var za = async e => {
  if (e.startsWith(`data:`)) {
    return e;
  }
  try {
    let t = await (await fetch(e)).blob();
    return new Promise((e, n) => {
      let r = new FileReader();
      r.onloadend = () => {
        let t = r.result;
        e(t);
      };
      r.onerror = n;
      r.readAsDataURL(t);
    });
  } catch (t) {
    console.warn(`Failed to convert URL to Base64:`, e, t);
    return e;
  }
};
var Ba = `auth_token`;
var Va = `remembered_login_credentials`;
function Ha() {
  let e = localStorage.getItem(Va);
  if (!e) {
    return null;
  }
  try {
    let t = JSON.parse(e);
    if (typeof t.account != `string` || typeof t.password != `string`) {
      throw Error(`Invalid remembered login credentials`);
    }
    return t;
  } catch {
    localStorage.removeItem(Va);
    return null;
  }
}
function Ua(e) {
  localStorage.setItem(Va, JSON.stringify(e));
}
function Wa() {
  localStorage.removeItem(Va);
}
function Ga() {
  return localStorage.getItem(Ba);
}
function Ka(e) {
  localStorage.setItem(Ba, e);
  Kr.setConfig(Ba, e).then(() => {
    console.log(`AUTH_TOKEN_KEY 保存成功`);
  });
}
function qa() {
  localStorage.removeItem(Ba);
  Kr.remove(Ba).then(() => {
    console.log(`AUTH_TOKEN_KEY 移除成功`);
  });
}
var Ja = `${Wn}${Gn}`;
function Ya(e) {
  if (e) {
    if (/^https?:\/\//i.test(e) || e.startsWith(`data:`)) {
      return e;
    } else {
      return `${Wn}${e.startsWith(`/`) ? `` : `/`}${e}`;
    }
  } else {
    return ``;
  }
}
function Xa() {
  let e = Ga();
  if (e) {
    return {
      Authorization: `Bearer ${e}`
    };
  } else {
    return {};
  }
}
async function Za() {
  let e = await (await fetch(`${Ja}/public/prompt-tags`)).json();
  if (e.success) {
    return e.data;
  } else {
    return [];
  }
}
async function Qa(e = {}) {
  let t = new URLSearchParams();
  if (e.category) {
    t.set(`category`, e.category);
  }
  if (e.tagId) {
    t.set(`tagId`, String(e.tagId));
  }
  if (e.keyword && e.keyword.trim()) {
    t.set(`keyword`, e.keyword.trim());
  }
  t.set(`pageSize`, `200`);
  let n = await (await fetch(`${Ja}/public/prompts?${t.toString()}`)).json();
  if (n.success) {
    return n.data;
  } else {
    return [];
  }
}
async function $a() {
  if (!Ga()) {
    return [];
  }
  let e = await fetch(`${Ja}/prompts/favorites`, {
    headers: Xa()
  });
  if (!e.ok) {
    return [];
  }
  let t = await e.json();
  if (t.success) {
    return t.data.map(e => {
      return e.promptId;
    });
  } else {
    return [];
  }
}
async function eo() {
  if (!Ga()) {
    return [];
  }
  let e = await fetch(`${Ja}/prompts/favorites/items`, {
    headers: Xa()
  });
  if (!e.ok) {
    return [];
  }
  let t = await e.json();
  if (t.success) {
    return t.data;
  } else {
    return [];
  }
}
async function to(e) {
  if (!Ga()) {
    return {
      ok: false,
      error: `请先登录`
    };
  }
  try {
    let t = await fetch(`${Ja}/prompts/favorites/${e}`, {
      method: `POST`,
      headers: Xa()
    });
    if (t.ok) {
      return {
        ok: true
      };
    }
    let n = `收藏失败 (${t.status})`;
    try {
      let e = await t.json();
      if (e?.error) {
        n = e.error;
      }
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
async function no(e) {
  if (!Ga()) {
    return false;
  }
  try {
    return (await fetch(`${Ja}/prompts/favorites/${e}`, {
      method: `DELETE`,
      headers: Xa()
    })).ok;
  } catch {
    return false;
  }
}
function ro() {
  return !!Ga();
}
var io = `yimao:openPromptSettings`;
function ao() {
  try {
    window.dispatchEvent(new CustomEvent(io));
  } catch {}
}
var oo = [{
  value: ``,
  label: `全部`
}, {
  value: `text`,
  label: `文本`
}, {
  value: `image`,
  label: `生图`
}, {
  value: `video`,
  label: `视频`
}];
var so = `yimao:promptRecent`;
function co() {
  try {
    let e = localStorage.getItem(so);
    if (e) {
      return JSON.parse(e);
    } else {
      return [];
    }
  } catch {
    return [];
  }
}
function lo(e) {
  try {
    let t = co().filter(t => {
      return t !== e;
    });
    t.unshift(e);
    localStorage.setItem(so, JSON.stringify(t.slice(0, 50)));
  } catch {}
}
var po = (e, t) => {
  let n = [];
  [...new Set(t.filter(Boolean))].sort((e, t) => {
    return t.length - e.length;
  }).forEach(t => {
    let r = `@${t}`;
    let i = e.indexOf(r);
    while (i >= 0) {
      let t = i + r.length;
      if (!n.some(e => {
        return i < e.end && t > e.start;
      })) {
        n.push({
          start: i,
          end: t,
          value: r
        });
      }
      i = e.indexOf(r, t);
    }
  });
  return n.sort((e, t) => {
    return e.start - t.start;
  });
};
var mo = e => {
  try {
    let t = window.getSelection();
    if (!t || t.rangeCount === 0 || !t.anchorNode || !e.contains(t.anchorNode)) {
      return (e.innerText || ``).length;
    }
    let n = t.getRangeAt(0).cloneRange();
    let r = n.cloneRange();
    r.selectNodeContents(e);
    r.setEnd(n.startContainer, n.startOffset);
    return r.toString().length;
  } catch {
    return (e.innerText || ``).length;
  }
};
var ho = (e, t) => {
  try {
    let n = window.getSelection();
    if (!n) {
      return;
    }
    let r = (e.innerText || ``).length;
    let i = Math.max(0, Math.min(t, r));
    let a = e.childNodes.length === 1 && e.firstChild && e.firstChild.nodeType === Node.TEXT_NODE ? e.firstChild : null;
    if (a) {
      let e = Math.max(0, Math.min(i, a.textContent?.length ?? 0));
      let t = document.createRange();
      t.setStart(a, e);
      t.collapse(true);
      n.removeAllRanges();
      n.addRange(t);
      return;
    }
    let o = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
    let s = i;
    let c = o.nextNode();
    while (c) {
      let e = c.textContent?.length || 0;
      if (s <= e) {
        let e = document.createRange();
        e.setStart(c, s);
        e.collapse(true);
        n.removeAllRanges();
        n.addRange(e);
        return;
      }
      s -= e;
      c = o.nextNode();
    }
    n.removeAllRanges();
  } catch {}
};
var go = (e, t, n, r) => {
  let i = po(e, t).find(e => {
    if (r === `Backspace`) {
      return n > e.start && n <= e.end;
    } else {
      return n >= e.start && n < e.end;
    }
  });
  if (i) {
    return {
      text: e.slice(0, i.start) + e.slice(i.end),
      cursor: i.start
    };
  } else {
    return null;
  }
};
var _o = (e, t, n, r) => {
  if (n < 0 || t <= n) {
    return null;
  }
  let i = e.slice(n + 1, t);
  if (!/^\d+$/.test(i)) {
    return null;
  }
  let a = r[Number(i) - 1];
  if (!a) {
    return null;
  }
  let o = `@${a} `;
  return {
    text: e.slice(0, n) + o + e.slice(t),
    cursor: n + o.length,
    name: a
  };
};
var yo = e => {
  return e.replace(/&/g, `&amp;`).replace(/</g, `&lt;`).replace(/>/g, `&gt;`);
};
var Eo = [{
  label: `2×2`,
  rows: 2,
  cols: 2
}, {
  label: `3×3`,
  rows: 3,
  cols: 3
}, {
  label: `4×4`,
  rows: 4,
  cols: 4
}, {
  label: `1×5`,
  rows: 1,
  cols: 5
}, {
  label: `5×1`,
  rows: 5,
  cols: 1
}];
var Do = (e, t, n) => {
  return Math.max(t, Math.min(n, e));
};
var Oo = e => {
  let t = e.map(e => {
    return Do(e, 0.01, 0.99);
  });
  return Array.from(new Set(t.map(e => {
    return Math.round(e * 10000) / 10000;
  }))).sort((e, t) => {
    return e - t;
  });
};
var ko = e => {
  let t = [0, ...e, 1];
  let n = [];
  for (let e = 0; e < t.length - 1; e++) {
    n.push([t[e], t[e + 1]]);
  }
  return n;
};
var Ao = () => {
  return `lasso-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
};
var jo = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='6' cy='6' r='3'/><circle cx='6' cy='18' r='3'/><line x1='20' y1='4' x2='8.12' y2='15.88'/><line x1='14.47' y1='14.48' x2='20' y2='20'/><line x1='8.12' y1='8.12' x2='12' y2='12'/></svg>") 4 4, crosshair`;
var Mo = 0.04;
var No = e => {
  let t = e.y;
  let n = 1 - e.y;
  let r = e.x;
  let i = 1 - e.x;
  let a = Math.min(t, n, r, i);
  if (a > Mo) {
    return {
      x: e.x,
      y: e.y,
      edge: null
    };
  } else if (a === t) {
    return {
      x: e.x,
      y: 0,
      edge: `top`
    };
  } else if (a === n) {
    return {
      x: e.x,
      y: 1,
      edge: `bottom`
    };
  } else if (a === r) {
    return {
      x: 0,
      y: e.y,
      edge: `left`
    };
  } else {
    return {
      x: 1,
      y: e.y,
      edge: `right`
    };
  }
};
var Po = (e, t, n) => {
  if (!t || !n) {
    return e;
  }
  let r = [...e];
  if (t === n) {
    return r;
  }
  let i = {
    'top-right': {
      x: 1,
      y: 0
    },
    'bottom-right': {
      x: 1,
      y: 1
    },
    'bottom-left': {
      x: 0,
      y: 1
    },
    'top-left': {
      x: 0,
      y: 0
    }
  };
  let a = [`top`, `right`, `bottom`, `left`];
  let o = a.indexOf(n);
  let s = a.indexOf(t);
  let c = o;
  while (c !== s) {
    let e = a[c] === `top` ? `top-right` : a[c] === `right` ? `bottom-right` : a[c] === `bottom` ? `bottom-left` : `top-left`;
    r.push(i[e]);
    c = (c + 1) % 4;
  }
  return r;
};
var Fo = e => {
  let t = 1;
  let n = 1;
  let r = 0;
  let i = 0;
  for (let a of e) {
    if (a.x < t) {
      t = a.x;
    }
    if (a.y < n) {
      n = a.y;
    }
    if (a.x > r) {
      r = a.x;
    }
    if (a.y > i) {
      i = a.y;
    }
  }
  return {
    minX: t,
    minY: n,
    maxX: r,
    maxY: i
  };
};
var Ro = () => {
  return `layer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};
var zo = e => {
  return new Promise(t => {
    if (!e) {
      return t(null);
    }
    let n = new Image();
    n.crossOrigin = `anonymous`;
    n.onload = () => {
      return t(n);
    };
    n.onerror = () => {
      let n = new Image();
      n.src = e;
      n.onload = () => {
        return t(n);
      };
      n.onerror = () => {
        return t(null);
      };
    };
    n.src = e;
  });
};
var Ho = async (e, t = 800) => {
  let {
    canvasWidth: n,
    canvasHeight: r
  } = e;
  let i = Math.min(1, t / Math.max(n, r));
  return _cmp_Vo(i >= 1 ? e : {
    canvasWidth: Math.max(1, Math.round(n * i)),
    canvasHeight: Math.max(1, Math.round(r * i)),
    bgColor: e.bgColor,
    layers: e.layers.map(e => {
      return {
        ...e,
        x: e.x * i,
        y: e.y * i,
        scale: e.scale * i
      };
    })
  });
};
var Wo = [{
  label: `2×2`,
  rows: 2,
  cols: 2
}, {
  label: `3×3`,
  rows: 3,
  cols: 3
}, {
  label: `4×4`,
  rows: 4,
  cols: 4
}, {
  label: `1×5`,
  rows: 1,
  cols: 5
}, {
  label: `5×1`,
  rows: 5,
  cols: 1
}];
var Go = (e, t, n) => {
  return Math.max(t, Math.min(n, e));
};
var Ko = e => {
  let t = e.trim().match(/^(\d+)\s*[x×*]\s*(\d+)$/i);
  if (!t) {
    return null;
  }
  let n = Go(parseInt(t[1], 10), 1, 20);
  let r = Go(parseInt(t[2], 10), 1, 20);
  if (!n || !r) {
    return null;
  } else {
    return {
      rows: n,
      cols: r
    };
  }
};
var qo = e => {
  return new Promise(t => {
    if (!e) {
      return t(null);
    }
    let n = new Image();
    n.crossOrigin = `anonymous`;
    n.onload = () => {
      return t(n);
    };
    n.onerror = () => {
      let n = new Image();
      n.src = e;
      n.onload = () => {
        return t(n);
      };
      n.onerror = () => {
        return t(null);
      };
    };
    n.src = e;
  });
};
var Jo = (e, t, n, r, i, a) => {
  if (i !== `transparent`) {
    e.fillStyle = i;
    e.fillRect(0, 0, t, n);
  } else if (!r) {
    for (let r = 0; r < n; r += 14) {
      for (let n = 0; n < t; n += 14) {
        if ((n / 14 + r / 14) % 2 < 1) {
          e.fillStyle = `#1f2937`;
        } else {
          e.fillStyle = `#111827`;
        }
        e.fillRect(n, r, 14, 14);
      }
    }
  }
  if (a && !r) {
    e.strokeStyle = `rgba(96,165,250,0.55)`;
    e.lineWidth = 1;
    for (let t = 1; t < a.cols; t++) {
      let r = Math.round(t * a.cellW) + 0.5;
      e.beginPath();
      e.moveTo(r, 0);
      e.lineTo(r, n);
      e.stroke();
    }
    for (let n = 1; n < a.rows; n++) {
      let r = Math.round(n * a.cellH) + 0.5;
      e.beginPath();
      e.moveTo(0, r);
      e.lineTo(t, r);
      e.stroke();
    }
  }
};
var Xo = [{
  label: `16:9`,
  value: `16:9`,
  defaultSize: `1280x720`
}, {
  label: `9:16`,
  value: `9:16`,
  defaultSize: `720x1280`
}, {
  label: `3:2`,
  value: `3:2`,
  defaultSize: `1200x800`
}, {
  label: `2:3`,
  value: `2:3`,
  defaultSize: `800x1200`
}, {
  label: `1:1`,
  value: `1:1`,
  defaultSize: `1024x1024`
}, {
  label: `自定义`,
  value: `custom`,
  defaultSize: ``
}];
function Qo({
  nodeId: e,
  initialUploadedAssets: t,
  updateNodeData: n,
  onUploadAsset: r,
  onShowToast: i
}) {
  let [a, o] = Z.useState(t || {});
  let s = Z.useRef({});
  let c = Z.useRef({});
  let l = Z.useRef(r);
  let u = Z.useRef(i);
  let [, d] = Z.useReducer(e => {
    return e + 1;
  }, 0);
  Z.useEffect(() => {
    l.current = r;
  }, [r]);
  Z.useEffect(() => {
    u.current = i;
  }, [i]);
  Z.useEffect(() => {
    if (t) {
      o(t);
    }
  }, [t]);
  let f = Z.useCallback((t, r) => {
    o(i => {
      let a = {
        ...i,
        [t.url]: r
      };
      n(e, {
        uploadedAssets: a
      });
      return a;
    });
  }, [e, n]);
  let p = Z.useCallback(async e => {
    let t = l.current;
    if (!t) {
      return null;
    }
    delete c.current[e.id];
    s.current[e.id] = true;
    d();
    try {
      let n = await t(e.url, e.type);
      if (!n || typeof n != `string`) {
        throw Error(`网关返回为空`);
      }
      f(e, n);
      return n;
    } catch (t) {
      c.current[e.id] = true;
      u.current?.(`素材上传失败: ${t?.message || t}`);
      throw t;
    } finally {
      delete s.current[e.id];
      d();
    }
  }, [f]);
  return {
    uploadedAssets: a,
    setUploadedAssets: o,
    uploadingAssetsRef: s,
    failedAssetsRef: c,
    uploadAsset: p,
    retryAsset: Z.useCallback(e => {
      return p(e);
    }, [p]),
    getAssetStatus: Z.useCallback((e, t) => {
      return {
        isUploading: !!s.current[e],
        isUploaded: !!a[t],
        isFailed: !!c.current[e]
      };
    }, [a]),
    clearFailedAsset: Z.useCallback(e => {
      delete c.current[e];
      d();
    }, []),
    clearAllFailedAssets: Z.useCallback(() => {
      c.current = {};
      d();
    }, []),
    forceUpdate: d
  };
}
var $o = [{
  label: `16:9`,
  value: `16:9`
}, {
  label: `9:16`,
  value: `9:16`
}, {
  label: `3:4`,
  value: `3:4`
}, {
  label: `4:3`,
  value: `4:3`
}, {
  label: `1:1`,
  value: `1:1`
}];
var ts = {
  image: `图`,
  audio: `音`,
  video: `视`
};
function ns(e) {
  if (!e || typeof e != `object` || Array.isArray(e)) {
    return null;
  } else {
    return e;
  }
}
function rs(e) {
  if (e === `image`) {
    return [{
      type: `image`,
      max: null
    }];
  } else if (e === `video`) {
    return [{
      type: `video`,
      max: null
    }];
  } else if (e === `first_last_frame`) {
    return [{
      type: `image`,
      max: 2
    }];
  } else {
    return [];
  }
}
function is(e) {
  let t = ns(e);
  if (t) {
    if (Array.isArray(t.referenceTypes) && t.referenceTypes.length) {
      return t.referenceTypes.filter(e => {
        return e?.type === `image` || e?.type === `audio` || e?.type === `video`;
      });
    } else {
      return rs(t.referenceSupport);
    }
  } else {
    return [];
  }
}
function as(e) {
  let t = ns(e);
  if (!t) {
    return null;
  }
  let n = t.durationSpec;
  if (n?.mode === `range`) {
    let e = Number(n.min);
    let t = Number(n.max);
    if (Number.isFinite(e) && Number.isFinite(t) && e > 0 && t >= e) {
      let r = {
        mode: `range`,
        min: e,
        max: t
      };
      let i = Number(n.step);
      if (Number.isFinite(i) && i > 1) {
        r.step = i;
      }
      return r;
    }
  }
  if (n?.mode === `discrete`) {
    let e = (n.options || []).map(Number).filter(e => {
      return Number.isFinite(e) && e > 0;
    });
    if (e.length) {
      return {
        mode: `discrete`,
        options: [...new Set(e)].sort((e, t) => {
          return e - t;
        })
      };
    }
  }
  let r = (t.durationOptions || []).map(Number).filter(e => {
    return Number.isFinite(e) && e > 0;
  });
  if (r.length) {
    return {
      mode: `discrete`,
      options: [...new Set(r)].sort((e, t) => {
        return e - t;
      })
    };
  } else {
    return null;
  }
}
function os(e, t) {
  let n = String(t || ``).trim();
  if (n) {
    return n;
  }
  if (!e) {
    return `—`;
  }
  if (e.mode === `range`) {
    let {
      min: t,
      max: n,
      step: r
    } = e;
    if (r && r > 1) {
      return `${t}-${n}秒（步长${r}）`;
    } else {
      return `${t}-${n}秒`;
    }
  }
  return e.options.map(e => {
    return `${e}秒`;
  }).join(`、`);
}
function ss(e, t) {
  let n = Number(t);
  if (!Number.isFinite(n) || n <= 0) {
    return false;
  }
  if (e.mode === `discrete`) {
    return e.options.includes(n);
  }
  if (n < e.min || n > e.max) {
    return false;
  }
  let r = e.step && e.step > 1 ? e.step : 1;
  return (n - e.min) % r === 0;
}
function cs(e) {
  if (e?.length) {
    return e.map(e => {
      let t = ts[e.type] || e.type;
      if (e.max == null || e.max === undefined) {
        return t;
      } else {
        return `${t}*${e.max}`;
      }
    }).join(`/`);
  } else {
    return `—`;
  }
}
function ls(e) {
  let t = ns(e);
  if (!t) {
    return null;
  }
  if (t.abilityScore != null && Number.isFinite(t.abilityScore)) {
    let e = Number(t.abilityScore);
    if (Number.isInteger(e) && e >= 1 && e <= 100) {
      return e;
    }
  }
  if (typeof t.abilities == `number` && Number.isInteger(t.abilities)) {
    let e = t.abilities;
    if (e >= 1 && e <= 100) {
      return e;
    }
  }
  return null;
}
function us(e, t) {
  let n = ns(e);
  if (!n) {
    return false;
  }
  switch (t) {
    case `resolutions`:
      {
        return Array.isArray(n.resolutions) && n.resolutions.length > 0;
      }
    case `aspectRatios`:
      {
        return Array.isArray(n.aspectRatios) && n.aspectRatios.length > 0;
      }
    case `durationSpec`:
      {
        return as(n) != null;
      }
    case `promptLimit`:
      {
        return n.promptLimit?.type === `chars` && Number(n.promptLimit.max) > 0;
      }
    case `supportsRealPerson`:
      {
        return Object.prototype.hasOwnProperty.call(n, `supportsRealPerson`) && n.supportsRealPerson === false;
      }
    case `referenceTypes`:
      {
        return is(n).length > 0;
      }
    case `abilityScore`:
      {
        return ls(n) != null;
      }
    default:
      {
        return false;
      }
  }
}
function ds(e, t, n) {
  if (!us(e, t)) {
    return n;
  }
  let r = ns(e)[t];
  if (!Array.isArray(r) || !r.length) {
    return n;
  } else {
    return r;
  }
}
function fs(e, t) {
  let n = as(e);
  if (n?.mode === `discrete`) {
    return n.options;
  } else {
    return t;
  }
}
function ps(e, t) {
  let n = as(e);
  if (n?.mode === `range`) {
    return {
      min: n.min,
      max: n.max,
      step: n.step && n.step > 1 ? n.step : 1
    };
  } else {
    return {
      min: t.min,
      max: t.max,
      step: 1
    };
  }
}
var ms = {
  image: `图片`,
  audio: `音频`,
  video: `视频`
};
function hs(e, t) {
  let n = [];
  let r = ns(e);
  let i = String(t.prompt ?? ``);
  let a = String(t.resolution ?? ``).trim();
  let o = String(t.aspectRatio ?? ``).trim();
  let s = Number(t.seconds);
  let c = t.imageCount ?? 0;
  let l = t.videoCount ?? 0;
  let u = t.audioCount ?? 0;
  if (us(r, `resolutions`) && a) {
    let e = r.resolutions;
    if (!e.includes(a)) {
      n.push(`分辨率 ${a} 不在模型支持列表（${e.join(`, `)}）`);
    }
  }
  if (us(r, `aspectRatios`) && o && o !== `custom`) {
    let e = r.aspectRatios;
    if (!e.includes(o)) {
      n.push(`比例 ${o} 不在模型支持列表（${e.join(`, `)}）`);
    }
  }
  if (us(r, `durationSpec`) && Number.isFinite(s)) {
    let e = as(r);
    if (!ss(e, s)) {
      if (e.mode === `discrete`) {
        n.push(`时长 ${s} 秒不在模型支持列表（${e.options.join(`, `)}秒）`);
      } else {
        let t = e.step && e.step > 1 ? `，步长 ${e.step}` : ``;
        n.push(`时长 ${s} 秒不在允许区间 ${e.min}-${e.max} 秒${t}`);
      }
    }
  }
  if (us(r, `promptLimit`)) {
    let e = r.promptLimit;
    if (e.type === `chars`) {
      let t = Number(e.max);
      if (i.length > t) {
        n.push(`提示词超过限制（最多 ${t} 字，当前 ${i.length} 字）`);
      }
    }
  }
  if (us(r, `referenceTypes`)) {
    let e = is(r);
    for (let t of e) {
      let e = ms[t.type];
      let r = t.type === `image` ? c : t.type === `audio` ? u : l;
      if (t.max != null && t.max !== undefined && r > t.max) {
        n.push(`${e}参考最多 ${t.max} 个，当前 ${r} 个`);
      }
    }
  }
  return {
    ok: n.length === 0,
    errors: n
  };
}
function gs(e) {
  if (e == null || e === ``) {
    return `—`;
  } else if (Array.isArray(e)) {
    if (e.length) {
      return e.map(String).join(`, `);
    } else {
      return `—`;
    }
  } else if (typeof e == `boolean`) {
    if (e) {
      return `是`;
    } else {
      return `否`;
    }
  } else {
    return String(e);
  }
}
function vs(e) {
  let t = e?.promptLimit;
  if (!t || t.type === `none`) {
    return `—`;
  } else if (t.type === `chars`) {
    return t.label || `${t.max}字`;
  } else {
    return `—`;
  }
}
function ys(e) {
  let t = e?.referenceTypes?.length ? e.referenceTypes : is(e ?? undefined);
  if (t.length) {
    return cs(t);
  } else if (e?.referenceLabel) {
    return e.referenceLabel;
  } else {
    return `—`;
  }
}
function bs(e) {
  let t = ys(e);
  let n = vs(e);
  let r = [];
  if (t && t !== `—`) {
    r.push(t);
  }
  if (n && n !== `—`) {
    r.push(n);
  }
  if (r.length) {
    return r.join(`、`);
  } else {
    return `—`;
  }
}
function xs(e) {
  if (!e) {
    return null;
  }
  if (e.failureRate != null) {
    let t = (1 - e.failureRate) * 100;
    return `${parseFloat(t.toFixed(2))}%`;
  }
  if (e.label) {
    let t = parseFloat(String(e.label).replace(/[^\d.]/g, ``));
    if (Number.isNaN(t)) {
      return e.label;
    } else {
      return `${parseFloat((100 - t).toFixed(2))}%`;
    }
  }
  return null;
}
function Ss(e) {
  if (!e) {
    return null;
  }
  if (e.failureRate != null) {
    return (1 - e.failureRate) * 100;
  }
  if (e.label) {
    let t = parseFloat(String(e.label).replace(/[^\d.]/g, ``));
    if (!Number.isNaN(t)) {
      return 100 - t;
    }
  }
  return null;
}
function Cs(e) {
  if (e == null) {
    return `text-gray-200`;
  } else if (e > 80) {
    return `text-emerald-400`;
  } else if (e < 40) {
    return `text-red-400`;
  } else {
    return `text-gray-200`;
  }
}
var Ds = e => {
  return e.replace(/&/g, `&amp;`).replace(/</g, `&lt;`).replace(/>/g, `&gt;`);
};
var Os = [{
  label: `16:9`,
  value: `16:9`
}, {
  label: `9:16`,
  value: `9:16`
}, {
  label: `3:4`,
  value: `3:4`
}, {
  label: `4:3`,
  value: `4:3`
}, {
  label: `1:1`,
  value: `1:1`
}, {
  label: `自定义`,
  value: `custom`
}];
var ks = [{
  label: `480p`,
  value: `480p`
}, {
  label: `720p`,
  value: `720p`
}, {
  label: `1080p`,
  value: `1080p`
}];
var js = async (e, t, n, r, i, a, o) => {
  if (!n) {
    throw Error(`请先在设置中配置听音 API Key`);
  }
  let s = t.trim().replace(/[`'"]/g, ``).replace(/\/$/, ``);
  let c = s.endsWith(`/v1/audio/transcriptions`) ? s : `${s}/v1/audio/transcriptions`;
  let l = n.trim();
  let u = new FormData();
  u.append(`file`, e);
  u.append(`model`, r || `whisper-1`);
  u.append(`response_format`, `verbose_json`);
  u.append(`timestamp_granularities[]`, `word`);
  if (i) {
    u.append(`prompt`, i);
  }
  let d = await fetch(c, {
    method: `POST`,
    headers: {
      Authorization: `Bearer ${l}`
    },
    body: u
  });
  if (!d.ok) {
    let e = d.statusText;
    try {
      let t = await d.text();
      try {
        let n = JSON.parse(t);
        if (n.error && n.error.message) {
          e = n.error.message;
        } else {
          e = JSON.stringify(n);
        }
      } catch {
        e = t || e;
      }
    } catch {}
    throw Error(`API 请求失败: ${e}`);
  }
  let f = (await d.json()).words || [];
  if (!f || f.length === 0) {
    return [];
  }
  let p = [];
  let m = null;
  let h = 1;
  for (let e = 0; e < f.length; e++) {
    let t = f[e];
    let n = t.word;
    let r = t.start;
    let i = t.end;
    if (!m) {
      m = {
        id: h++,
        text: n,
        start_time: r,
        end_time: i
      };
    } else {
      let e = r - m.end_time;
      let t = i - m.start_time;
      if (e >= o || t > a) {
        m.duration = Number((m.end_time - m.start_time).toFixed(2));
        m.start_time = Number(m.start_time.toFixed(2));
        m.end_time = Number(m.end_time.toFixed(2));
        p.push(m);
        m = {
          id: h++,
          text: n,
          start_time: r,
          end_time: i
        };
      } else {
        m.text += n;
        m.end_time = i;
      }
    }
  }
  if (m) {
    m.duration = Number((m.end_time - m.start_time).toFixed(2));
    m.start_time = Number(m.start_time.toFixed(2));
    m.end_time = Number(m.end_time.toFixed(2));
    p.push(m);
  }
  return p;
};
function Ns(e) {
  if (!e) {
    return ``;
  }
  let t = e => {
    return e.startsWith(`data:audio/`) || /\.(x-)?(mp3|wav|ogg|m4a|flac|aac|opus|wma|aiff)($|\?)/i.test(e);
  };
  if (typeof e.audioUrl == `string` && e.audioUrl) {
    return e.audioUrl;
  }
  if (typeof e.imageUrl == `string` && t(e.imageUrl)) {
    return e.imageUrl;
  }
  if (typeof e.videoUrl == `string` && t(e.videoUrl)) {
    return e.videoUrl;
  }
  if (typeof e.text == `string`) {
    let n = e.text.match(/(https?:\/\/[^\s"'`<>]+)|(data:audio\/[^\s"']+)/i);
    if (n && t(n[0])) {
      return n[0];
    }
  }
  return ``;
}
function Ps(e) {
  if (!isFinite(e) || e < 0) {
    e = 0;
  }
  return `${Math.floor(e / 60)}:${Math.floor(e % 60).toString().padStart(2, `0`)}`;
}
var Fs = `__audio_player_range_style__`;
if (typeof document < `u` && !document.getElementById(Fs)) {
  let e = document.createElement(`style`);
  e.id = Fs;
  e.textContent = `
    .audio-range { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 999px; background: #3a3a3a; outline: none; }
    .audio-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 11px; height: 11px; border-radius: 50%; background: #ffffff; cursor: pointer; box-shadow: 0 0 2px rgba(0,0,0,0.5); }
    .audio-range::-moz-range-thumb { width: 11px; height: 11px; border: none; border-radius: 50%; background: #ffffff; cursor: pointer; }
    .audio-range::-moz-range-track { height: 4px; border-radius: 999px; background: #3a3a3a; }
  `;
  document.head.appendChild(e);
}
var zs = `rhwebapp-run-request`;
function Bs(e) {
  return e === `VIP` || e === `SVIP` || e === `UNLIMITED`;
}
function Vs(e) {
  if (!e) {
    return [];
  }
  try {
    let t = JSON.parse(e);
    if (!Array.isArray(t)) {
      return [];
    }
    let n = [];
    t.forEach((e, t) => {
      if (e != null) {
        if (typeof e == `string` || typeof e == `number`) {
          n.push({
            name: String(e),
            index: String(e),
            description: undefined
          });
          return;
        }
        if (typeof e == `object`) {
          if (e.name != null && e.index !== undefined) {
            n.push({
              name: String(e.name),
              index: String(e.index),
              description: e.description
            });
            return;
          }
          if (e.value !== undefined) {
            n.push({
              name: String(e.label ?? e.value),
              index: String(e.value),
              description: e.description
            });
            return;
          }
        }
      }
    });
    return n;
  } catch {
    return [];
  }
}
function Hs(e) {
  let t = (e.fieldType || ``).toUpperCase();
  if (t === `LIST` || t === `SWITCH`) {
    return `LIST`;
  } else {
    return t || `STRING`;
  }
}
function Us(e) {
  return `${e.nodeId}__${e.fieldName}`;
}
function Ws(e, t) {
  if (!t || t.length === 0) {
    return e || ``;
  }
  let n = String(e ?? ``).trim();
  if (!n) {
    return t[0].index;
  }
  if (t.some(e => {
    return e.index === n;
  })) {
    return n;
  }
  let r = t.find(e => {
    return e.name === n;
  });
  if (r) {
    return r.index;
  }
  let i = Number(n);
  if (Number.isFinite(i) && Number.isInteger(i) && i >= 1 && i <= t.length) {
    return t[i - 1].index;
  } else {
    return n;
  }
}
var Gs = {
  IMAGE: _Component2,
  VIDEO: Le,
  AUDIO: _Component5,
  STRING: _Component3
};
async function Ks(e, t, n, r) {
  let i = new FormData();
  if (e instanceof File) {
    i.append(`file`, e);
  } else {
    i.append(`file`, e, r || `upload.bin`);
  }
  let a = await fetch(Jn(t, `/upload`), {
    method: `POST`,
    headers: {
      Authorization: `Bearer ${n}`
    },
    body: i
  });
  if (!a.ok) {
    let e = await a.json().catch(() => {
      return {};
    });
    throw Error(e?.error || `上传失败 HTTP ${a.status}`);
  }
  let o = await a.json();
  let s = o?.data?.fileName;
  if (!s) {
    throw Error(o?.error || `上传失败`);
  }
  return s;
}
async function qs(e) {
  let t = await fetch(e);
  if (!t.ok) {
    throw Error(`下载源文件失败 HTTP ${t.status}`);
  }
  return t.blob();
}
var Js = new Set(`p.br.strong.b.em.i.u.span.a.ul.ol.li.div.h1.h2.h3.h4.h5.h6.small.sub.sup.blockquote.code.pre.hr`.split(`.`));
var Ys = {
  a: new Set([`href`, `title`, `target`, `rel`])
};
var Xs = `__rh_app_desc_style__`;
if (typeof document < `u` && !document.getElementById(Xs)) {
  let e = document.createElement(`style`);
  e.id = Xs;
  e.textContent = `
    .rh-app-desc, .rh-app-desc * {
      font-size: 12px !important;
      line-height: 1.55 !important;
      color: #d1d5db;
    }
    .rh-app-desc h1, .rh-app-desc h2, .rh-app-desc h3,
    .rh-app-desc h4, .rh-app-desc h5, .rh-app-desc h6,
    .rh-app-desc strong, .rh-app-desc b {
      color: #ffffff !important;
      font-weight: 600;
      margin: 6px 0 4px;
    }
    .rh-app-desc p { margin: 4px 0; }
    .rh-app-desc a { color: #60a5fa; text-decoration: underline; }
    .rh-app-desc ul, .rh-app-desc ol { padding-left: 18px; margin: 4px 0; }
    .rh-app-desc img { max-width: 100%; height: auto; }
    /* 隐藏 number 输入的浏览器自带上下微调按钮 */
    .rh-num-input::-webkit-outer-spin-button,
    .rh-num-input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    .rh-num-input { -moz-appearance: textfield; appearance: textfield; }
  `;
  document.head.appendChild(e);
}
function Zs(e) {
  if (!e || typeof window > `u` || typeof DOMParser > `u`) {
    return ``;
  }
  let t;
  try {
    t = new DOMParser().parseFromString(`<div id="__rh_root">${e}</div>`, `text/html`);
  } catch {
    return ``;
  }
  let n = t.getElementById(`__rh_root`);
  if (!n) {
    return ``;
  }
  let r = e => {
    Array.from(e.children).forEach(e => {
      return r(e);
    });
    let t = e.tagName.toLowerCase();
    if (!Js.has(t)) {
      while (e.firstChild) {
        e.parentNode?.insertBefore(e.firstChild, e);
      }
      e.parentNode?.removeChild(e);
      return;
    }
    let n = Ys[t] || new Set();
    Array.from(e.attributes).forEach(t => {
      let r = t.name.toLowerCase();
      if (!n.has(r)) {
        e.removeAttribute(t.name);
        return;
      }
      if (r === `href`) {
        let n = (t.value || ``).trim().toLowerCase();
        if (!n.startsWith(`http://`) && !n.startsWith(`https://`) && !n.startsWith(`mailto:`) && !n.startsWith(`#`)) {
          e.removeAttribute(t.name);
        }
      }
      if (r === `style`) {
        let n = t.value || ``;
        if (/url\(|expression\(|javascript:/i.test(n)) {
          e.removeAttribute(t.name);
        }
      }
    });
    if (t === `a`) {
      e.setAttribute(`target`, `_blank`);
      e.setAttribute(`rel`, `noopener noreferrer`);
    }
  };
  r(n);
  return n.innerHTML;
}
function Qs(e, t) {
  let n = (t || ``).toLowerCase().replace(/^x-/, ``);
  let r = (e || ``).toLowerCase();
  if (r.startsWith(`data:image/`)) {
    return `image`;
  } else if (r.startsWith(`data:video/`)) {
    return `video`;
  } else if (r.startsWith(`data:audio/`)) {
    return `audio`;
  } else if ([`png`, `jpg`, `jpeg`, `webp`, `gif`, `bmp`, `svg`, `avif`].includes(n) || /\.(png|jpe?g|webp|gif|bmp|svg|avif)(\?|$)/.test(r)) {
    return `image`;
  } else if ([`mp4`, `webm`, `mov`, `mkv`, `avi`, `m4v`].includes(n) || /\.(mp4|webm|mov|mkv|avi|m4v)(\?|$)/.test(r)) {
    return `video`;
  } else if ([`mp3`, `wav`, `ogg`, `m4a`, `flac`, `aac`, `opus`, `wma`, `aiff`].includes(n) || /\.(x-)?(mp3|wav|ogg|m4a|flac|aac|opus|wma|aiff)(\?|$)/.test(r)) {
    return `audio`;
  } else if ([`txt`, `md`, `json`, `csv`, `log`, `xml`, `yaml`, `yml`, `srt`, `vtt`].includes(n) || /\.(txt|md|json|csv|log|xml|ya?ml|srt|vtt)(\?|$)/.test(r) || !e) {
    return `text`;
  } else {
    return `unknown`;
  }
}
var tc = On();
function rc(e, t) {
  return new Promise(n => {
    let r = () => {
      e.removeEventListener(`seeked`, r);
      n();
    };
    e.addEventListener(`seeked`, r);
    e.currentTime = t;
  });
}
function ac(e, t = 15000) {
  return _cmp_nc(e, t).then(e => {
    let t = e.duration;
    e.removeAttribute(`src`);
    try {
      e.load();
    } catch {}
    if (t && isFinite(t)) {
      return t;
    } else {
      return 0;
    }
  });
}
var oc = [240, 360, 480, 640, 720];
var sc = [0.5, 1, 2, 3, 5, 8, 10, 12, 15, 20];
var cc = [{
  label: `0.5×`,
  value: 0.5
}, {
  label: `1×`,
  value: 1
}, {
  label: `1.5×`,
  value: 1.5
}, {
  label: `2×`,
  value: 2
}, {
  label: `3×`,
  value: 3
}];
var lc = [{
  label: `高清 (256色)`,
  value: 256
}, {
  label: `标准 (128色)`,
  value: 128
}, {
  label: `压缩 (64色)`,
  value: 64
}];
function uc(e) {
  if (e < 1024) {
    return `${e} B`;
  } else if (e < 1048576) {
    return `${(e / 1024).toFixed(1)} KB`;
  } else {
    return `${(e / 1048576).toFixed(2)} MB`;
  }
}
function dc(e) {
  for (let t of e) {
    if (t?.data) {
      if (typeof t.data.videoUrl == `string` && t.data.videoUrl) {
        return t.data.videoUrl;
      }
      if (typeof t.data.imageUrl == `string`) {
        let e = t.data.imageUrl;
        if (e.startsWith(`data:video/`) || /\.(mp4|webm|mov|ogg)($|\?)/i.test(e)) {
          return e;
        }
      }
      if (typeof t.data.text == `string`) {
        let e = t.data.text.match(/(https?:\/\/[^\s"'`<>]+)|(data:video\/[^\s"']+)/i);
        if (e && (/\.(mp4|webm|mov|ogg)($|\?)/i.test(e[0]) || e[0].startsWith(`data:video/`))) {
          return e[0];
        }
      }
    }
  }
  return ``;
}
var pc = t({
  captureVideoFrameBlob: () => {
    return _cmp_mc;
  }
});
var hc = null;
var gc = null;
function _c() {
  hc ??= le(() => {
    return import('../src-_qSScO88.js');
  }, __vite__mapDeps([0, 1]), import.meta.url);
  return hc;
}
function vc() {
  gc ??= le(async () => {
    let {
      registerMp3Encoder: e
    } = await import('../mediabunny-mp3-encoder-CZeRAvEV.js');
    return {
      registerMp3Encoder: e
    };
  }, __vite__mapDeps([2, 1, 3, 4, 0]), import.meta.url).then(({
    registerMp3Encoder: e
  }) => {
    e();
  });
  return gc;
}
var yc = class extends Error {
  constructor(e = `视频处理已取消`) {
    super(e);
    this.name = `ConversionCanceledError`;
  }
};
var bc = class {
  conversion = null;
  output = null;
  canceled = false;
  get isCanceled() {
    return this.canceled;
  }
  attach(e) {
    this.conversion = e;
    if (this.canceled) {
      e.cancel();
    }
  }
  attachOutput(e) {
    this.output = e;
    if (this.canceled) {
      e.cancel();
    }
  }
  async cancel() {
    this.canceled = true;
    await Promise.allSettled([this.conversion?.cancel(), this.output?.cancel()].filter(e => {
      return e;
    }));
  }
};
async function xc(e) {
  let {
    ALL_FORMATS: t,
    BlobSource: n,
    Input: r
  } = await _c();
  return new r({
    formats: t,
    source: new n(e)
  });
}
function Sc(e) {
  return Math.max(2, Math.round(e / 2) * 2);
}
function Cc(e) {
  if (Number.isFinite(e) && e >= 1 && e <= 120) {
    return e;
  } else {
    return 30;
  }
}
function wc(e, t = 48000, n = 2) {
  return new AudioBuffer({
    length: Math.max(1, Math.round(e * t)),
    numberOfChannels: n,
    sampleRate: t
  });
}
async function Tc(e, t = 48000, n = 2) {
  if (e.sampleRate === t && e.numberOfChannels === n) {
    return e;
  }
  let r = new OfflineAudioContext(n, Math.max(1, Math.round(e.duration * t)), t);
  let i = r.createBufferSource();
  i.buffer = e;
  i.connect(r.destination);
  i.start();
  return r.startRendering();
}
async function Ec(e) {
  let t = await xc(e);
  try {
    if (!(await t.canRead())) {
      throw Error(`无法识别视频格式`);
    }
    let e = await t.getPrimaryVideoTrack();
    if (!e) {
      throw Error(`输入文件不包含视频轨道`);
    }
    let [n, r, i, a] = await Promise.all([t.getDurationFromMetadata(), e.getDisplayWidth(), e.getDisplayHeight(), e.computePacketStats(120).catch(() => {
      return null;
    })]);
    let o = n ?? (await t.computeDuration());
    let s = a?.averagePacketRate ?? 0;
    return {
      duration: Number.isFinite(o) ? o : 0,
      width: r,
      height: i,
      fps: Cc(s)
    };
  } finally {
    t.dispose();
  }
}
async function Dc(e, t) {
  let {
    BufferTarget: n,
    Conversion: r,
    ConversionCanceledError: i,
    Mp3OutputFormat: a,
    Mp4OutputFormat: o,
    Output: s,
    WavOutputFormat: c
  } = await _c();
  let l = await xc(e);
  let u = new n();
  try {
    if (!(await l.canRead())) {
      throw Error(`无法识别视频格式`);
    }
    let e = await l.getPrimaryVideoTrack();
    let n = await l.getPrimaryAudioTrack();
    if (!e) {
      throw Error(`输入文件不包含视频轨道`);
    }
    if (t.mode === `extractAudio` && !n) {
      throw Error(`该视频不包含可提取的音频轨道`);
    }
    if (t.controller?.isCanceled) {
      throw new yc();
    }
    if (t.mode === `extractAudio` && t.format === `mp3`) {
      await vc();
    }
    let i = {
      input: l,
      output: new s({
        format: t.mode !== `extractAudio` || t.format === `m4a` ? new o({
          fastStart: `in-memory`
        }) : t.format === `wav` ? new c() : new a(),
        target: u
      }),
      tracks: `primary`,
      showWarnings: false
    };
    if (t.mode === `trim`) {
      i.trim = {
        start: t.start,
        end: t.end
      };
      i.video = {};
      i.audio = {};
    } else if (t.mode === `extractAudio`) {
      i.video = {
        discard: true
      };
      if (t.format === `m4a`) {
        i.audio = {
          codec: `aac`
        };
      } else {
        if (t.format === `wav`) {
          i.audio = {
            codec: `pcm-s16`
          };
        } else {
          i.audio = {
            codec: `mp3`,
            bitrate: 192000
          };
        }
      }
    } else {
      i.video = {
        codec: `avc`,
        width: t.width,
        height: t.height,
        fit: `contain`,
        frameRate: t.fps
      };
      i.audio = {
        codec: `aac`
      };
    }
    let d = await r.init(i);
    t.controller?.attach(d);
    if (!d.isValid) {
      let e = d.discardedTracks.map(e => {
        return e.reason;
      }).join(`、`);
      throw Error(e ? `当前浏览器无法完成此处理：${e}` : `当前浏览器无法完成此处理`);
    }
    d.onProgress = e => {
      return t.onProgress?.(e);
    };
    await d.execute();
    if (!u.buffer) {
      throw Error(`视频处理未生成输出文件`);
    }
    let f = t.mode === `trim` ? t.end - t.start : (await l.getDurationFromMetadata()) ?? (await l.computeDuration());
    let p = t.mode === `sizeFrameRate` ? t.width : await e.getDisplayWidth();
    let m = t.mode === `sizeFrameRate` ? t.height : await e.getDisplayHeight();
    let h = Cc((await e.computePacketStats(120).catch(() => {
      return null;
    }))?.averagePacketRate ?? 0);
    let g = t.mode === `sizeFrameRate` ? t.fps : h;
    let _ = t.mode === `extractAudio` ? t.format === `m4a` ? `audio/mp4` : t.format === `wav` ? `audio/wav` : `audio/mpeg` : `video/mp4`;
    let v = t.mode === `extractAudio` ? t.format : `mp4`;
    return {
      blob: new Blob([u.buffer], {
        type: _
      }),
      metadata: {
        duration: f,
        width: p,
        height: m,
        fps: g
      },
      mimeType: _,
      extension: v
    };
  } catch (e) {
    throw e instanceof i ? new yc(e.message) : e;
  } finally {
    l.dispose();
  }
}
async function Oc(e, t = {}) {
  if (e.length < 2) {
    throw Error(`视频拼接至少需要 2 个输入视频`);
  }
  let {
    AudioBufferSource: n,
    AudioSampleSink: r,
    BufferTarget: i,
    Mp4OutputFormat: a,
    Output: o,
    VideoSampleSink: s,
    VideoSampleSource: c
  } = await _c();
  let l = [];
  let u = null;
  try {
    for (let t of e) {
      l.push(await xc(t));
    }
    let d = [];
    for (let e = 0; e < l.length; e += 1) {
      let n = l[e];
      if (!(await n.canRead())) {
        throw Error(`第 ${e + 1} 个视频格式无法识别`);
      }
      let r = await n.getPrimaryVideoTrack();
      if (!r) {
        throw Error(`第 ${e + 1} 个输入不包含视频轨道`);
      }
      let i = (await r.getDurationFromMetadata()) ?? (await r.computeDuration());
      if (!Number.isFinite(i) || i <= 0) {
        throw Error(`第 ${e + 1} 个视频时长无效`);
      }
      let a = t.segments?.[e];
      let o = Math.max(0, Math.min(a?.start ?? 0, i));
      let s = Math.max(o, Math.min(a?.end ?? i, i));
      let c = s - o;
      if (c <= 0) {
        throw Error(`第 ${e + 1} 个片段范围无效`);
      }
      d.push({
        video: r,
        audio: await n.getPrimaryAudioTrack(),
        sourceDuration: i,
        start: o,
        end: s,
        duration: c,
        muted: !!a?.muted
      });
    }
    if (t.controller?.isCanceled) {
      throw new yc();
    }
    let f = await d[0].video.computePacketStats(120).catch(() => {
      return null;
    });
    let p = 0;
    let m = 0;
    for (let e of d) {
      let t = await e.video.getDisplayWidth();
      let n = await e.video.getDisplayHeight();
      if (t > p) {
        p = t;
      }
      if (n > m) {
        m = n;
      }
    }
    let h = Sc(t.width ?? p);
    let g = Sc(t.height ?? m);
    let _ = Cc(t.fps ?? f?.averagePacketRate ?? 30);
    let v = d.reduce((e, t) => {
      return e + t.duration;
    }, 0);
    let y = new i();
    u = new o({
      format: new a({
        fastStart: `in-memory`
      }),
      target: y
    });
    t.controller?.attachOutput(u);
    let b = new c({
      codec: `avc`,
      bitrate: 5000000,
      sizeChangeBehavior: `contain`,
      transform: {
        width: h,
        height: g,
        fit: `contain`,
        frameRate: _
      }
    });
    let x = new n({
      codec: `aac`,
      bitrate: 192000,
      transform: {
        sampleRate: 48000,
        numberOfChannels: 2
      }
    });
    u.addVideoTrack(b, {
      frameRate: _
    });
    u.addAudioTrack(x);
    await u.start();
    let S = 0;
    let C = 0;
    let w = e => {
      let n = Math.max(C, Math.min(1, e));
      C = n;
      t.onProgress?.(n);
    };
    for (let e = 0; e < d.length; e += 1) {
      if (t.controller?.isCanceled) {
        throw new yc();
      }
      let n = d[e];
      let i = new s(n.video);
      for await (let e of i.samples(n.start, n.end)) {
        try {
          if (t.controller?.isCanceled) {
            throw new yc();
          }
          let r = e.timestamp - n.start;
          if (r < 0) {
            continue;
          }
          if (r >= n.duration) {
            break;
          }
          e.setTimestamp(S + r);
          if (r + e.duration > n.duration) {
            e.setDuration(n.duration - r);
          }
          await b.add(e);
          w((S + Math.min(n.duration, r)) / v);
        } finally {
          e.close();
        }
      }
      if (n.audio && !n.muted) {
        let e = new r(n.audio);
        let i = (await n.audio.getFirstTimestamp()) + n.start;
        let a = await n.audio.getSampleRate();
        let o = await n.audio.getNumberOfChannels();
        let s = new AudioBuffer({
          length: Math.max(1, Math.round(n.duration * a)),
          numberOfChannels: o,
          sampleRate: a
        });
        for await (let r of e.samples(i, i + n.duration)) {
          try {
            if (t.controller?.isCanceled) {
              throw new yc();
            }
            let e = r.timestamp - i;
            if (e >= n.duration) {
              break;
            }
            let c = r.toAudioBuffer();
            let l = Math.max(0, Math.round(e * a));
            let u = Math.max(0, Math.round(-e * a));
            let d = Math.min(c.length - u, s.length - l);
            if (d <= 0) {
              continue;
            }
            for (let e = 0; e < o; e += 1) {
              let t = c.getChannelData(Math.min(e, c.numberOfChannels - 1));
              s.copyToChannel(t.subarray(u, u + d), e, l);
            }
          } finally {
            r.close();
          }
        }
        await x.add(await Tc(s));
      } else {
        await x.add(wc(n.duration));
      }
      S += n.duration;
      w(S / v);
    }
    b.close();
    x.close();
    await u.finalize();
    if (!y.buffer) {
      throw Error(`视频拼接未生成输出文件`);
    }
    return {
      blob: new Blob([y.buffer], {
        type: `video/mp4`
      }),
      metadata: {
        duration: v,
        width: h,
        height: g,
        fps: _
      },
      mimeType: `video/mp4`,
      extension: `mp4`
    };
  } catch (e) {
    if (u && u.state !== `canceled` && u.state !== `finalized`) {
      await u.cancel().catch(() => {
        return undefined;
      });
    }
    throw t.controller?.isCanceled ? new yc() : e;
  } finally {
    for (let e of l) {
      e.dispose();
    }
  }
}
var kc = [{
  value: `trim`,
  label: `视频截取`
}, {
  value: `extractAudio`,
  label: `提取音频`
}, {
  value: `sizeFrameRate`,
  label: `尺寸帧率`
}, {
  value: `concat`,
  label: `视频拼接`
}];
var Ac = [{
  value: `m4a`,
  label: `M4A`,
  hint: `体积小`
}, {
  value: `wav`,
  label: `WAV`,
  hint: `无损`
}, {
  value: `mp3`,
  label: `MP3`,
  hint: `通用`
}];
var jc = [{
  label: `480p`,
  width: 854,
  height: 480
}, {
  label: `720p`,
  width: 1280,
  height: 720
}, {
  label: `1080p`,
  width: 1920,
  height: 1080
}];
var Mc = [24, 25, 30, 60];
var Nc = /\.(mp4|webm|mov|mkv|avi|m4v|ogg)(?:$|[?#])/i;
var Pc = 36;
function Fc(e) {
  for (let t of e) {
    let e = t?.data;
    if (e) {
      if (typeof e.videoUrl == `string` && e.videoUrl) {
        return e.videoUrl;
      }
      if (typeof e.imageUrl == `string` && (e.imageUrl.startsWith(`data:video/`) || e.imageUrl.startsWith(`blob:`) || Nc.test(e.imageUrl))) {
        return e.imageUrl;
      }
      if (typeof e.text == `string`) {
        let t = e.text.match(/(https?:\/\/[^\s"'`<>]+)|(data:video\/[^\s"']+)|(blob:[^\s"']+)/i);
        if (t && (t[0].startsWith(`data:video/`) || t[0].startsWith(`blob:`) || Nc.test(t[0]))) {
          return t[0];
        }
      }
    }
  }
  return ``;
}
function Ic(e) {
  if (e.startsWith(`data:`)) {
    return `video.mp4`;
  }
  if (e.startsWith(`blob:`)) {
    return `local-video.mp4`;
  }
  try {
    return decodeURIComponent(new URL(e).pathname.split(`/`).pop() || `video.mp4`);
  } catch {
    return `video.mp4`;
  }
}
function Lc(e, t) {
  let n = e?.data?.sourceVideoName || e?.data?.videoName || e?.data?.fileName || e?.data?.label || e?.id;
  if (typeof n == `string` && n) {
    return n;
  } else {
    return Ic(t);
  }
}
function Rc(e) {
  if (e === `resize` || e === `frameRate`) {
    return `sizeFrameRate`;
  } else if (e === `trim` || e === `extractAudio` || e === `sizeFrameRate` || e === `concat`) {
    return e;
  } else {
    return `trim`;
  }
}
function zc(e) {
  return e.replace(/\.[^.]+$/, ``) || `video`;
}
function Bc(e) {
  if (Number.isFinite(e)) {
    return `${Math.floor(e / 60)}:${Math.floor(e % 60).toString().padStart(2, `0`)}`;
  } else {
    return `0:00`;
  }
}
function Vc(e) {
  return Math.max(2, Math.round(e / 2) * 2);
}
function Hc(e) {
  return Number(e.toFixed(2));
}
function Uc(e) {
  return `${e}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
function Wc(e, t, n) {
  let r = new Map(t.map(e => {
    return [e.sourceId, e];
  }));
  let i = new Set();
  let a = (e || []).map((e, t) => {
    let a = e.kind || e.type || `video`;
    let o = e.id || `${a}-track-${t + 1}`;
    let s = 0;
    let c = (e.clips || e.segments || []).map(e => {
      let t = r.get(e.sourceId);
      let a = n[e.sourceId]?.duration || e.duration || e.sourceEnd || e.end || 0;
      let c = Math.max(0, e.sourceStart ?? e.start ?? 0);
      let l = e.sourceEnd ?? e.end;
      if ((l === 0 || l === e.duration) && a > 0 && (e.duration || 0) === 0) {
        l = a;
      }
      let u = Number.isFinite(l) && l < 9007199254740991 ? Math.min(l, a || l) : a;
      i.add(e.sourceId);
      let d = Math.max(0, u - c);
      let f = e.timelineStart ?? s;
      s = f + d;
      return {
        id: e.id || Uc(`clip`),
        sourceId: e.sourceId,
        url: t?.url || e.url || e.sourceUrl || ``,
        name: t?.name || e.name || e.sourceName || `视频片段`,
        sourceStart: c,
        sourceEnd: Math.max(c, u),
        duration: d,
        timelineStart: f,
        muted: !!e.muted,
        trackId: o
      };
    });
    return {
      id: o,
      name: e.name || e.label || `${a === `video` ? `视频` : `音频`} ${t + 1}`,
      kind: a,
      clips: c,
      muted: !!e.muted
    };
  });
  let o = a.find(e => {
    return e.kind === `video`;
  });
  if (!o) {
    o = {
      id: `video-track-1`,
      name: `视频 1`,
      kind: `video`,
      clips: []
    };
    a.push(o);
  }
  for (let e of t) {
    if (i.has(e.sourceId)) {
      continue;
    }
    let t = n[e.sourceId]?.duration || 0;
    if (t === 0) {
      continue;
    }
    let r = o.clips.length > 0 ? Math.max(...o.clips.map(e => {
      return e.timelineStart + e.duration;
    })) : 0;
    o.clips.push({
      id: Uc(`clip`),
      sourceId: e.sourceId,
      url: e.url,
      name: e.name,
      sourceStart: 0,
      sourceEnd: t,
      duration: t,
      timelineStart: r,
      muted: false,
      trackId: o.id
    });
  }
  return a;
}
function Kc(e, t) {
  return new Promise((n, r) => {
    let i = new Image();
    i.crossOrigin = `anonymous`;
    let a = window.setTimeout(() => {
      return r(Error(`图片加载超时`));
    }, t);
    i.onload = () => {
      window.clearTimeout(a);
      n(i);
    };
    i.onerror = () => {
      window.clearTimeout(a);
      r(Error(`图片加载失败（可能是跨域或格式不支持）`));
    };
    i.src = e;
  });
}
function qc(e, t, n) {
  return new Promise((r, i) => {
    e.toBlob(e => {
      if (e) {
        return r(e);
      } else {
        return i(Error(`图片编码失败`));
      }
    }, t, n);
  });
}
function Jc(e) {
  return new Promise((t, n) => {
    let r = new FileReader();
    r.onload = () => {
      return t(r.result);
    };
    r.onerror = () => {
      return n(Error(`读取结果失败`));
    };
    r.readAsDataURL(e);
  });
}
async function Yc(e) {
  try {
    if (e.startsWith(`data:`)) {
      let t = e.split(`,`)[1] || ``;
      return Math.floor(t.length * 3 / 4);
    }
    return (await (await fetch(e)).blob()).size;
  } catch {
    return 0;
  }
}
var Zc = [{
  label: `原始`,
  value: 0
}, {
  label: `2048`,
  value: 2048
}, {
  label: `1600`,
  value: 1600
}, {
  label: `1280`,
  value: 1280
}, {
  label: `1024`,
  value: 1024
}, {
  label: `768`,
  value: 768
}, {
  label: `512`,
  value: 512
}];
var Qc = [{
  label: `高 (0.9)`,
  value: 0.9
}, {
  label: `较高 (0.8)`,
  value: 0.8
}, {
  label: `中 (0.6)`,
  value: 0.6
}, {
  label: `低 (0.4)`,
  value: 0.4
}];
var $c = [{
  label: `JPEG`,
  value: `image/jpeg`
}, {
  label: `WebP`,
  value: `image/webp`
}, {
  label: `PNG`,
  value: `image/png`
}];
function el(e) {
  if (e) {
    if (e < 1024) {
      return `${e} B`;
    } else if (e < 1048576) {
      return `${(e / 1024).toFixed(1)} KB`;
    } else {
      return `${(e / 1048576).toFixed(2)} MB`;
    }
  } else {
    return `-`;
  }
}
function tl(e) {
  let t = [];
  let n = e => {
    if (!!e && typeof e == `string` && !e.startsWith(`data:video/`) && !/\.(mp4|webm|mov|ogg)($|\?)/i.test(e) && !t.includes(e)) {
      t.push(e);
    }
  };
  for (let t of e) {
    if (t?.data) {
      if (t.type === `imageBoxNode` && Array.isArray(t.data.images)) {
        t.data.images.forEach(e => {
          return n(e?.url);
        });
        continue;
      }
      n(t.data.imageUrl);
      if (typeof t.data.text == `string`) {
        let e = t.data.text.match(/(https?:\/\/[^\s"'`<>]+)|(data:image\/[^\s"']+)/i);
        if (e && (e[0].startsWith(`data:image/`) || /\.(png|jpe?g|webp|gif|bmp)($|\?)/i.test(e[0]))) {
          n(e[0]);
        }
      }
    }
  }
  return t;
}
function rl(e) {
  try {
    let t = globalThis.chrome;
    if (t?.runtime?.getURL) {
      return t.runtime.getURL(e);
    }
  } catch {}
  return e;
}
var il = null;
async function al() {
  il ||= (async () => {
    let e = await te.forVisionTasks(rl(`mediapipe/wasm`));
    return pe.createFromOptions(e, {
      baseOptions: {
        modelAssetPath: rl(`mediapipe/blaze_face_short_range.tflite`)
      },
      runningMode: `IMAGE`,
      minDetectionConfidence: 0.4
    });
  })().catch(e => {
    il = null;
    throw e;
  });
  return il;
}
function ol(e, t) {
  return new Promise((n, r) => {
    let i = new Image();
    i.crossOrigin = `anonymous`;
    let a = window.setTimeout(() => {
      return r(Error(`图片加载超时`));
    }, t);
    i.onload = () => {
      window.clearTimeout(a);
      n(i);
    };
    i.onerror = () => {
      window.clearTimeout(a);
      r(Error(`图片加载失败（可能是跨域或格式不支持）`));
    };
    i.src = e;
  });
}
function sl(e, t, n) {
  let r = e.keypoints;
  if (!r || r.length < 2) {
    return null;
  }
  let i = r[0].x * t;
  let a = r[0].y * n;
  let o = r[1].x * t;
  let s = r[1].y * n;
  let c = Math.hypot(o - i, s - a);
  if (!isFinite(c) || c <= 0) {
    return null;
  } else {
    return {
      lx: o,
      ly: s,
      rx: i,
      ry: a,
      dist: c
    };
  }
}
function cl(e, t, n) {
  let r = sl(e, t, n);
  if (r) {
    let e = (r.lx + r.rx) / 2;
    let i = (r.ly + r.ry) / 2;
    let a = r.dist * 1.15;
    let o = r.dist * 0.7;
    let s = r.dist * 1.55;
    let c = Math.floor(e - a);
    let l = Math.floor(i - o);
    let u = Math.ceil(a * 2);
    let d = Math.ceil(o + s);
    c = Math.max(0, c);
    l = Math.max(0, l);
    u = Math.min(t - c, u);
    d = Math.min(n - l, d);
    if (u <= 0 || d <= 0) {
      return null;
    } else {
      return {
        x: c,
        y: l,
        w: u,
        h: d
      };
    }
  }
  let i = e.boundingBox;
  if (!i) {
    return null;
  }
  let a = Math.max(0, Math.floor(i.originX + i.width * 0.12));
  let o = Math.max(0, Math.floor(i.originY + i.height * 0.2));
  let s = Math.min(t - a, Math.ceil(i.width * 0.76));
  let c = Math.min(n - o, Math.ceil(i.height * 0.5));
  if (s <= 0 || c <= 0) {
    return null;
  } else {
    return {
      x: a,
      y: o,
      w: s,
      h: c
    };
  }
}
function ll(e, t, n) {
  let r = sl(e, t, n);
  if (!r) {
    let t = e.boundingBox;
    if (!t) {
      return null;
    }
    let n = Math.floor(t.originY + t.height * 0.28);
    let r = Math.ceil(t.height * 0.16);
    return {
      x: Math.floor(t.originX + t.width * 0.05),
      y: n,
      w: Math.ceil(t.width * 0.9),
      h: r
    };
  }
  let i = (r.lx + r.rx) / 2;
  let a = (r.ly + r.ry) / 2;
  let o = r.dist * 1.15;
  let s = r.dist * 0.42;
  let c = Math.floor(i - o);
  let l = Math.floor(a - s);
  let u = Math.ceil(o * 2);
  let d = Math.ceil(s * 2);
  c = Math.max(0, c);
  l = Math.max(0, l);
  u = Math.min(t - c, u);
  d = Math.min(n - l, d);
  if (u <= 0 || d <= 0) {
    return null;
  } else {
    return {
      x: c,
      y: l,
      w: u,
      h: d
    };
  }
}
function ul(e, t, n) {
  e.beginPath();
  if (n === `ellipse`) {
    e.ellipse(t.x + t.w / 2, t.y + t.h / 2, t.w / 2, t.h / 2, 0, 0, Math.PI * 2);
  } else {
    e.rect(t.x, t.y, t.w, t.h);
  }
  e.clip();
}
function fl(e, t, n = 0.7, r = `#000000`) {
  e.save();
  e.globalAlpha = n;
  e.fillStyle = r;
  e.fillRect(t.x, t.y, t.w, t.h);
  e.restore();
}
function pl(e, t, n, r, i, a, o = 0.7, s = `#000000`) {
  e.save();
  e.translate(t, n);
  e.rotate(a);
  e.globalAlpha = o;
  e.fillStyle = s;
  e.fillRect(-r / 2, -i / 2, r, i);
  e.restore();
}
function ml(e, t, n = 0.5, r = `#000000`) {
  e.save();
  let i = Math.max(3, Math.round(18 - n * 14));
  e.globalAlpha = 0.6;
  e.strokeStyle = r;
  e.lineWidth = 1;
  e.beginPath();
  for (let n = t.x; n <= t.x + t.w; n += i) {
    e.moveTo(n + 0.5, t.y);
    e.lineTo(n + 0.5, t.y + t.h);
  }
  for (let n = t.y; n <= t.y + t.h; n += i) {
    e.moveTo(t.x, n + 0.5);
    e.lineTo(t.x + t.w, n + 0.5);
  }
  e.stroke();
  e.restore();
}
function hl(e, t, n, r = 0.5, i = `rect`) {
  let a = Math.max(3, Math.round(n.w * (0.04 + r * 0.16)));
  e.save();
  ul(e, n, i);
  e.filter = `blur(${a}px)`;
  let o = a;
  e.drawImage(t, Math.max(0, n.x - o), Math.max(0, n.y - o), n.w + o * 2, n.h + o * 2, n.x - o, n.y - o, n.w + o * 2, n.h + o * 2);
  e.restore();
}
function gl(e, t, n, r, i = 0.5, a = `rect`, o = `#000000`) {
  if (!(n.w <= 0) && !(n.h <= 0)) {
    if (r === `mosaic`) {
      _cmp_dl(e, t, n, i, a);
    } else if (r === `bar`) {
      fl(e, n, i, o);
    } else if (r === `grid`) {
      ml(e, n, i, o);
    } else if (r === `blur`) {
      hl(e, t, n, i, a);
    }
  }
}
async function vl(e, t = 20000) {
  let n = await al();
  let r = await ol(e, t);
  let i = r.naturalWidth || r.width;
  let a = r.naturalHeight || r.height;
  let o = n.detect(r);
  let s = [];
  for (let e of o.detections || []) {
    let t = cl(e, i, a);
    if (t) {
      s.push(t);
    }
  }
  return s;
}
var yl = [{
  mode: `mosaic`,
  label: `马赛克`,
  icon: T
}, {
  mode: `bar`,
  label: `黑条`,
  icon: _Component47
}, {
  mode: `grid`,
  label: `网格`,
  icon: _Component28
}, {
  mode: `blur`,
  label: `模糊`,
  icon: ft
}];
var xl = [{
  mode: `mosaic`,
  label: `马赛克`,
  icon: T
}, {
  mode: `bar`,
  label: `黑条`,
  icon: _Component47
}, {
  mode: `grid`,
  label: `网格`,
  icon: _Component28
}, {
  mode: `blur`,
  label: `模糊`,
  icon: ft
}];
function Sl(e) {
  let t = [];
  let n = e => {
    if (!!e && typeof e == `string` && !e.startsWith(`data:video/`) && !/\.(mp4|webm|mov|ogg)($|\?)/i.test(e) && !t.includes(e)) {
      t.push(e);
    }
  };
  for (let t of e) {
    if (t?.data) {
      if (t.type === `imageBoxNode` && Array.isArray(t.data.images)) {
        t.data.images.forEach(e => {
          return n(e?.url);
        });
        continue;
      }
      n(t.data.imageUrl);
      if (typeof t.data.text == `string`) {
        let e = t.data.text.match(/(https?:\/\/[^\s"'`<>]+)|(data:image\/[^\s"']+)/i);
        if (e && (e[0].startsWith(`data:image/`) || /\.(png|jpe?g|webp|gif|bmp)($|\?)/i.test(e[0]))) {
          n(e[0]);
        }
      }
    }
  }
  return t;
}
function wl(e) {
  if (e instanceof HTMLVideoElement) {
    return {
      w: e.videoWidth,
      h: e.videoHeight
    };
  } else {
    return {
      w: e.naturalWidth || e.width,
      h: e.naturalHeight || e.height
    };
  }
}
function Tl(e, t, n, r) {
  let {
    w: i,
    h: a
  } = wl(t);
  if (!i || !a) {
    return;
  }
  let o = Math.min(n / i, r / a);
  let s = i * o;
  let c = a * o;
  let l = (n - s) / 2;
  let u = (r - c) / 2;
  e.drawImage(t, l, u, s, c);
}
function El(e, t, n = 1280) {
  let r = wl(e);
  let i = wl(t);
  let a = Math.max(r.w, i.w) || 1280;
  let o = Math.max(r.h, i.h) || 720;
  let s = a;
  let c = o;
  if (s > n || c > n) {
    if (s >= c) {
      c = Math.round(c * n / s);
      s = n;
    } else {
      s = Math.round(s * n / c);
      c = n;
    }
  }
  s = Math.max(2, s - s % 2);
  c = Math.max(2, c - c % 2);
  return {
    w: s,
    h: c
  };
}
var Dl = null;
var Ol = null;
function Al(e, t, n, r) {
  let i = e.canvas.width;
  let a = e.canvas.height;
  e.clearRect(0, 0, i, a);
  e.fillStyle = `#000`;
  e.fillRect(0, 0, i, a);
  if (r.mode === `diff`) {
    let o = _cmp_kl(`a`, i, a);
    let s = _cmp_kl(`b`, i, a);
    Tl(o, t, i, a);
    Tl(s, n, i, a);
    let c = o.getImageData(0, 0, i, a);
    let l = s.getImageData(0, 0, i, a);
    let u = e.createImageData(i, a);
    let d = c.data;
    let f = l.data;
    let p = u.data;
    let m = r.diffStrength ?? 0.5;
    let h = Math.round(30 + (1 - m) * 90);
    for (let e = 0; e < d.length; e += 4) {
      let t = Math.abs(d[e] - f[e]);
      let n = Math.abs(d[e + 1] - f[e + 1]);
      let r = Math.abs(d[e + 2] - f[e + 2]);
      let i = (t + n + r) / 3;
      let a = Math.round((d[e] * 0.299 + d[e + 1] * 0.587 + d[e + 2] * 0.114) * 0.5);
      if (i > h) {
        p[e] = 255;
        p[e + 1] = 40;
        p[e + 2] = 40;
        p[e + 3] = 255;
      } else {
        p[e] = a;
        p[e + 1] = a;
        p[e + 2] = a;
        p[e + 3] = 255;
      }
    }
    e.putImageData(u, 0, 0);
    return;
  }
  Tl(e, n, i, a);
  e.save();
  e.beginPath();
  if (r.orientation === `v`) {
    e.rect(0, 0, i * r.split, a);
  } else {
    e.rect(0, 0, i, a * r.split);
  }
  e.clip();
  Tl(e, t, i, a);
  e.restore();
  if (r.drawDivider) {
    e.save();
    e.strokeStyle = `rgba(255,255,255,0.95)`;
    e.lineWidth = Math.max(2, Math.round(i / 400));
    e.beginPath();
    if (r.orientation === `v`) {
      let t = i * r.split;
      e.moveTo(t, 0);
      e.lineTo(t, a);
    } else {
      let t = a * r.split;
      e.moveTo(0, t);
      e.lineTo(i, t);
    }
    e.stroke();
    e.restore();
  }
}
function jl(e) {
  return new Promise((t, n) => {
    let r = new FileReader();
    r.onload = () => {
      return t(r.result);
    };
    r.onerror = n;
    r.readAsDataURL(e);
  });
}
function Nl() {
  for (let e of [{
    mime: `video/mp4;codecs=avc1`,
    ext: `mp4`
  }, {
    mime: `video/mp4`,
    ext: `mp4`
  }, {
    mime: `video/webm;codecs=vp9`,
    ext: `webm`
  }, {
    mime: `video/webm;codecs=vp8`,
    ext: `webm`
  }, {
    mime: `video/webm`,
    ext: `webm`
  }]) {
    if (typeof MediaRecorder < `u` && MediaRecorder.isTypeSupported(e.mime)) {
      return e;
    }
  }
  return {
    mime: ``,
    ext: `webm`
  };
}
function Fl(e) {
  if (e.startsWith(`data:video/`) || /\.(mp4|webm|mov|mkv|avi|m4v|ogg)($|\?)/i.test(e)) {
    return `video`;
  } else {
    return `image`;
  }
}
function Il(e) {
  if (!e) {
    return null;
  }
  if (Array.isArray(e.images) && e.images.length > 0) {
    let t = typeof e.activeIndex == `number` ? e.activeIndex : 0;
    let n = e.images[t]?.url || e.images[0]?.url;
    if (n) {
      return n;
    }
  }
  if (typeof e.imageUrl == `string` && e.imageUrl) {
    return e.imageUrl;
  }
  if (typeof e.videoUrl == `string` && e.videoUrl) {
    return e.videoUrl;
  }
  if (Array.isArray(e.resultUrls) && e.resultUrls[0]) {
    return e.resultUrls[0];
  }
  if (typeof e.text == `string`) {
    let t = e.text.match(/(https?:\/\/[^\s"'`<>]+)|(data:(image|video)\/[^\s"']+)/i);
    if (t) {
      return t[0];
    }
  }
  return null;
}
function zl(e) {
  let t = (e || ``).replace(/[\s`]/g, ``).trim().replace(/\/$/, ``);
  if (t) {
    return `${t}/api/proxy`;
  } else {
    return `/api/proxy`;
  }
}
async function Bl(e, t) {
  let n = t.body instanceof FormData;
  let r = t.body instanceof Blob;
  if ((t.proxyMode || (t.localPort || t.localToolBaseUrl ? `local-tool` : `server-proxy`)) === `local-tool` && (t.localPort || t.localToolBaseUrl)) {
    let i = (t.localToolBaseUrl || Mn()).replace(/[\s`]/g, ``).trim().replace(/\/$/, ``);
    if (!e.startsWith(`http`) && !e.startsWith(`data:`) && !e.startsWith(`blob:`)) {
      let n = `${i}/api/files/read?path=${encodeURIComponent(e)}`;
      return fetch(n, {
        method: t.method || `GET`,
        headers: t.headers || {},
        signal: t.signal || undefined
      });
    }
    try {
      let a;
      if (n || r) {
        let n = new Headers();
        n.set(`X-Proxy-Url`, e);
        n.set(`X-Proxy-Method`, t.method || `POST`);
        if (t.headers) {
          n.set(`X-Proxy-Headers`, JSON.stringify(t.headers));
        }
        if (t.cookie) {
          n.set(`X-Proxy-Cookie`, t.cookie);
        }
        a = await fetch(`${i}/api/proxy`, {
          method: `POST`,
          headers: n,
          body: t.body,
          signal: t.signal || undefined
        });
      } else {
        a = await fetch(`${i}/api/proxy`, {
          method: `POST`,
          headers: {
            'Content-Type': `application/json`
          },
          body: JSON.stringify({
            url: e,
            method: t.method || `GET`,
            headers: t.headers || {},
            body: t.body ? typeof t.body == `string` ? t.body : JSON.stringify(t.body) : ``,
            cookie: t.cookie || ``
          }),
          signal: t.signal || undefined
        });
      }
      if (!a.ok) {
        let e = await a.text();
        throw Error(`Proxy error: ${a.status} ${e}`);
      }
      return a;
    } catch (e) {
      throw e;
    }
  }
  let i = zl(t.proxyBaseUrl);
  let a = {
    'Content-Type': `application/json`
  };
  if (t.licenseToken) {
    a.Authorization = `Bearer ${t.licenseToken}`;
  }
  if (t.appId) {
    a[`X-App-Id`] = t.appId;
  }
  if (n || r) {
    let n = {};
    let r = t.headers ? new Headers(t.headers) : null;
    if (r) {
      r.forEach((e, t) => {
        n[t] = e;
      });
    }
    return fetch(i, {
      method: `POST`,
      headers: {
        ...a,
        'X-Proxy-Url': e,
        'X-Proxy-Method': t.method || `POST`,
        'X-Proxy-Headers': JSON.stringify(n),
        ...(t.cookie ? {
          'X-Proxy-Cookie': t.cookie
        } : {})
      },
      body: t.body,
      signal: t.signal || undefined
    });
  }
  return fetch(i, {
    method: `POST`,
    headers: a,
    body: JSON.stringify({
      url: e,
      method: t.method || `GET`,
      headers: t.headers || {},
      body: t.body ? typeof t.body == `string` ? t.body : JSON.stringify(t.body) : ``,
      cookie: t.cookie || ``
    }),
    signal: t.signal || undefined
  });
}
var Vl = Z.createContext({
  disableLocalTool: false
});
function Hl() {
  return !!(typeof window < `u`) && !!window.__CANVAS_RUNTIME__?.disableLocalTool;
}
var Ul = 5000;
var Wl = 15000;
function Gl() {
  let e = Z.useContext(Vl).disableLocalTool || Hl();
  let [t, n] = Z.useState({
    isConnected: false,
    port: Pn()
  });
  let r = Z.useCallback(async () => {
    if (e) {
      n(e => {
        if (e.isConnected) {
          return {
            ...e,
            isConnected: false
          };
        } else {
          return e;
        }
      });
      return;
    }
    try {
      let e = await fetch(`${Mn()}/api/status`, {
        method: `GET`,
        headers: {
          'Content-Type': `application/json`
        }
      });
      if (e.ok) {
        let t = await e.json();
        console.log(`[useLocalTool] 接收到响应数据:`, t.status);
        if (t.status === `ok`) {
          n(e => {
            if (e.isConnected && e.version === t.version && e.message === t.message) {
              return e;
            } else {
              return {
                ...e,
                isConnected: true,
                version: t.version,
                message: t.message
              };
            }
          });
          return;
        }
      }
      n(e => {
        if (e.isConnected) {
          return {
            ...e,
            isConnected: false
          };
        } else {
          return e;
        }
      });
    } catch {
      n(e => {
        if (e.isConnected) {
          return {
            ...e,
            isConnected: false
          };
        } else {
          return e;
        }
      });
    }
  }, [e]);
  Z.useEffect(() => {
    if (e) {
      n(e => {
        if (e.isConnected) {
          return {
            ...e,
            isConnected: false
          };
        } else {
          return e;
        }
      });
      return;
    }
    r();
  }, [r, e]);
  Z.useEffect(() => {
    if (e) {
      return;
    }
    let n = t.isConnected ? Wl : Ul;
    console.log(`[useLocalTool] 设置检测间隔:`, n, `ms, isConnected:`, t.isConnected);
    let i = setInterval(r, n);
    return () => {
      return clearInterval(i);
    };
  }, [t.isConnected, r, e]);
  return {
    status: t,
    checkConnection: r,
    uploadFile: Z.useCallback(async (n, r, i = ``) => {
      if (e || !t.isConnected) {
        throw Error(`Local tool not connected`);
      }
      let a = new FormData();
      if (n instanceof File || n instanceof Blob) {
        a.append(`file`, n, r);
      } else {
        a.append(`fileUrl`, n);
      }
      if (i) {
        a.append(`subfolder`, i);
      }
      let o = await fetch(`${Mn()}/api/files/upload`, {
        method: `POST`,
        body: a
      });
      if (!o.ok) {
        throw Error(`Upload failed`);
      }
      return o.json();
    }, [t.isConnected, e]),
    saveKV: Z.useCallback(async (t, n) => {
      if (e) {
        return false;
      }
      try {
        let e = typeof n == `string` ? n : JSON.stringify(n);
        let r = await fetch(`${Mn()}/api/kv/set`, {
          method: `POST`,
          headers: {
            'Content-Type': `application/json`
          },
          body: JSON.stringify({
            key: t,
            value: e
          })
        });
        if (r.ok) {
          return true;
        } else {
          console.error(`[useLocalTool] saveKV failed for key "${t}":`, r.status, r.statusText);
          return false;
        }
      } catch (e) {
        console.error(`[useLocalTool] saveKV error for key "${t}":`, e);
        return false;
      }
    }, [t.isConnected, e]),
    getKV: Z.useCallback(async t => {
      if (e) {
        return null;
      }
      try {
        let e = `${Mn()}/api/kv/get?key=${t}`;
        let n = await fetch(e);
        console.log(`[useLocalTool.getKV] 📥 响应状态:`, n.status, n.statusText);
        if (n.ok) {
          return await n.json();
        } else {
          console.error(`[useLocalTool.getKV] ❌ 请求失败 HTTP 状态:`, n.status);
          return null;
        }
      } catch (e) {
        let t = e instanceof Error ? e.message : String(e);
        console.error(`[useLocalTool.getKV] ❌ fetch 异常:`, e);
        console.error(`[useLocalTool.getKV] ❌ 错误类型:`, e instanceof Error ? e.name : `Error`, `错误消息:`, t);
        if (t.includes(`Failed to fetch`) || t.includes(`NetworkError`)) {
          console.error(`[useLocalTool.getKV] ❌ 网络错误：无法连接到 ${Mn()}，请确保 localTool Service 正在运行`);
        }
        return null;
      }
    }, [t.isConnected, t.port, e]),
    createFolder: Z.useCallback(async t => {
      if (e) {
        return false;
      }
      try {
        await fetch(`${Mn()}/api/files/mkdir`, {
          method: `POST`,
          headers: {
            'Content-Type': `application/json`
          },
          body: JSON.stringify({
            folder: t
          })
        });
        return true;
      } catch {
        return false;
      }
    }, [t.isConnected, e]),
    moveFile: Z.useCallback(async (t, n) => {
      if (e) {
        return false;
      }
      try {
        await fetch(`${Mn()}/api/files/move`, {
          method: `POST`,
          headers: {
            'Content-Type': `application/json`
          },
          body: JSON.stringify({
            src: t,
            dst: n
          })
        });
        return true;
      } catch {
        return false;
      }
    }, [t.isConnected, e])
  };
}
function ql(e) {
  if (e.includes(`png`)) {
    return `.png`;
  } else if (e.includes(`jpeg`) || e.includes(`jpg`)) {
    return `.jpg`;
  } else if (e.includes(`webp`)) {
    return `.webp`;
  } else if (e.includes(`gif`)) {
    return `.gif`;
  } else if (e.includes(`mp4`)) {
    return `.mp4`;
  } else if (e.includes(`webm`)) {
    return `.webm`;
  } else if (e.includes(`text`)) {
    return `.txt`;
  } else if (e.includes(`json`)) {
    return `.json`;
  } else if (e.includes(`audio`) || e.includes(`mp3`)) {
    return `.mp3`;
  } else {
    return ``;
  }
}
async function Jl(e, t) {
  if (!t.accessKey || !t.secretKey || !t.bucket || !t.endpoint) {
    throw Error(`云存储未配置，请在设置中完善信息`);
  }
  let n = t.endpoint;
  if (!n.startsWith(`http`)) {
    n = `https://${n}`;
  }
  let r = new j({
    accessKeyId: t.accessKey,
    secretAccessKey: t.secretKey,
    service: `s3`,
    region: n.includes(`cn-south-1`) ? `cn-south-1` : `us-east-1`
  });
  let i = ql(e.type) || `.jpg`;
  let a = `mutiwindow-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${i}`;
  let o = `${n}/${t.bucket}/${a}`;
  if (n.includes(t.bucket)) {
    o = `${n}/${a}`;
  }
  let s = await r.sign(o, {
    method: `PUT`,
    body: e,
    headers: {
      'Content-Type': e.type
    }
  });
  let c = {};
  s.headers.forEach((e, t) => {
    c[t] = e;
  });
  let l = await Bl(o, {
    method: `PUT`,
    body: e,
    headers: c,
    localToolBaseUrl: Mn()
  });
  if (!l.ok) {
    let e = await l.text();
    throw Error(`Upload Failed: ${l.status} ${e}`);
  }
  if (t.domain) {
    let e = t.domain;
    if (!e.startsWith(`http`)) {
      e = `http://${e}`;
    }
    if (e.endsWith(`/`)) {
      e = e.slice(0, -1);
    }
    return `${e}/${a}`;
  }
  return o;
}
var Ql = [{
  id: `stand`,
  label: `站立`,
  controls: {}
}, {
  id: `t-pose`,
  label: `T型`,
  controls: {
    'leftShoulder.spread': -70,
    'rightShoulder.spread': 70,
    'leftShoulder.pitch': 15,
    'rightShoulder.pitch': 15,
    'leftElbow.bend': 10,
    'rightElbow.bend': 10
  }
}, {
  id: `walk`,
  label: `行走`,
  controls: {
    'leftShoulder.pitch': 20,
    'rightShoulder.pitch': -20,
    'leftHip.pitch': -20,
    'rightHip.pitch': 20,
    'leftKnee.bend': 12,
    'rightKnee.bend': 4
  }
}, {
  id: `run`,
  label: `跑步`,
  controls: {
    'leftShoulder.pitch': 42,
    'rightShoulder.pitch': -42,
    'leftHip.pitch': -35,
    'rightHip.pitch': 40,
    'leftKnee.bend': 28,
    'rightKnee.bend': 18
  }
}, {
  id: `sit`,
  label: `坐姿`,
  controls: {
    'torso.pitch': -10,
    'leftHip.pitch': 80,
    'rightHip.pitch': 80,
    'leftKnee.bend': 90,
    'rightKnee.bend': 90
  }
}, {
  id: `crouch`,
  label: `蹲下`,
  controls: {
    'body.offsetY': -0.43,
    'body.pitch': -26,
    'torso.pitch': -24,
    'head.pitch': 22,
    'leftHip.pitch': 92,
    'rightHip.pitch': 92,
    'leftKnee.bend': 112,
    'rightKnee.bend': 112,
    'leftShoulder.pitch': 52,
    'rightShoulder.pitch': 50,
    'leftShoulder.spread': -10,
    'rightShoulder.spread': 10,
    'leftElbow.bend': 80,
    'rightElbow.bend': 76
  }
}, {
  id: `kneel-one`,
  label: `单膝跪`,
  controls: {
    'body.offsetY': -0.42,
    'body.pitch': -16,
    'torso.pitch': -10,
    'head.pitch': 12,
    'leftHip.pitch': 68,
    'leftKnee.bend': 86,
    'leftFoot.pitch': 20,
    'rightHip.pitch': -15,
    'rightKnee.bend': 80,
    'rightFoot.pitch': 60,
    'leftShoulder.pitch': 5,
    'leftShoulder.spread': 10,
    'leftShoulder.twist': -10,
    'leftElbow.bend': 30,
    'rightShoulder.pitch': -18,
    'rightShoulder.spread': 10,
    'rightElbow.bend': 18
  }
}, {
  id: `kneel-two`,
  label: `双膝跪`,
  controls: {
    'body.offsetY': -0.4,
    'body.pitch': 2,
    'torso.pitch': 8,
    'head.pitch': -2,
    'leftShoulder.pitch': -10,
    'rightShoulder.pitch': -10,
    'leftShoulder.spread': -5,
    'rightShoulder.spread': 5,
    'leftElbow.bend': 8,
    'rightElbow.bend': 8,
    'leftHip.pitch': -8,
    'rightHip.pitch': -8,
    'leftKnee.bend': 126,
    'rightKnee.bend': 126,
    'leftFoot.pitch': -20,
    'rightFoot.pitch': -20
  }
}, {
  id: `hands-on-hips`,
  label: `叉腰`,
  controls: {
    'leftShoulder.pitch': -36,
    'rightShoulder.pitch': -36,
    'leftShoulder.spread': 0,
    'rightShoulder.spread': 0,
    'leftShoulder.twist': 80,
    'rightShoulder.twist': -80,
    'leftElbow.bend': 86,
    'rightElbow.bend': 86,
    'leftHand.roll': -35,
    'rightHand.roll': 35
  }
}, {
  id: `lean`,
  label: `倚靠`,
  controls: {
    'body.roll': -10,
    'leftHip.spread': -8,
    'rightHip.spread': 8,
    'head.roll': 6
  }
}, {
  id: `bow`,
  label: `鞠躬`,
  controls: {
    'body.pitch': -46,
    'torso.pitch': -10,
    'head.pitch': 20,
    'leftHip.pitch': 49,
    'rightHip.pitch': 49,
    'leftShoulder.pitch': 5,
    'rightShoulder.pitch': 5,
    'leftShoulder.spread': 10,
    'rightShoulder.spread': -10,
    'leftElbow.bend': 12,
    'rightElbow.bend': 12
  }
}, {
  id: `think`,
  label: `思考`,
  controls: {
    'rightShoulder.pitch': 8,
    'rightShoulder.spread': 0,
    'rightShoulder.twist': -40,
    'rightElbow.bend': 90,
    'rightHand.roll': -40,
    'rightHand.pitch': 15,
    'rightHand.twist': -10,
    'leftShoulder.pitch': 8,
    'leftShoulder.spread': 0,
    'leftShoulder.twist': 40,
    'leftElbow.bend': 90
  }
}, {
  id: `fight`,
  label: `格斗`,
  controls: {
    'body.yaw': -10,
    'body.pitch': 5,
    'torso.yaw': 8,
    'head.yaw': 8,
    'leftShoulder.pitch': 48,
    'leftShoulder.spread': -16,
    'leftShoulder.twist': 22,
    'rightShoulder.pitch': 30,
    'rightShoulder.spread': 0,
    'rightShoulder.twist': -22,
    'leftElbow.bend': 86,
    'rightElbow.bend': 84,
    'leftHip.spread': -18,
    'rightHip.spread': 22,
    'leftHip.pitch': 4,
    'rightHip.pitch': -6,
    'leftKnee.bend': 12,
    'rightKnee.bend': 18
  }
}, {
  id: `kick`,
  label: `踢球`,
  controls: {
    'leftHip.pitch': -8,
    'rightHip.pitch': 58,
    'rightKnee.bend': 35,
    'leftShoulder.pitch': 18,
    'rightShoulder.pitch': -24
  }
}, {
  id: `throw`,
  label: `投掷`,
  controls: {
    'body.offsetY': -0.12,
    'body.pitch': 5,
    'body.yaw': 14,
    'torso.yaw': -10,
    'head.yaw': 8,
    'rightShoulder.pitch': 76,
    'rightShoulder.spread': -14,
    'rightShoulder.twist': 28,
    'rightElbow.bend': 86,
    'rightHand.roll': 18,
    'rightHand.pitch': -12,
    'leftShoulder.pitch': 34,
    'leftShoulder.spread': 10,
    'leftShoulder.twist': 8,
    'leftElbow.bend': 54,
    'leftHand.pitch': -10,
    'leftHip.spread': -12,
    'rightHip.spread': 18,
    'leftHip.pitch': 24,
    'rightHip.pitch': -10,
    'leftKnee.bend': 30,
    'rightKnee.bend': 14,
    'leftFoot.pitch': -8,
    'rightFoot.roll': 6
  }
}, {
  id: `push`,
  label: `推进`,
  controls: {
    'body.offsetY': -0.16,
    'body.pitch': 5,
    'body.yaw': 38,
    'torso.pitch': -4,
    'head.pitch': 6,
    'leftShoulder.pitch': 92,
    'rightShoulder.pitch': 92,
    'leftShoulder.spread': -11,
    'rightShoulder.spread': 11,
    'leftShoulder.twist': 6,
    'rightShoulder.twist': -6,
    'leftElbow.bend': 6,
    'rightElbow.bend': 6,
    'leftHand.pitch': -14,
    'rightHand.pitch': -14,
    'leftHip.spread': -12,
    'rightHip.spread': 14,
    'leftHip.pitch': 38,
    'rightHip.pitch': -20,
    'leftKnee.bend': 42,
    'rightKnee.bend': 20,
    'leftFoot.pitch': -6,
    'rightFoot.roll': 8
  }
}, {
  id: `wave`,
  label: `招手`,
  controls: {
    'rightShoulder.pitch': 60,
    'rightShoulder.spread': 0,
    'rightShoulder.twist': 30,
    'rightElbow.bend': 90,
    'rightHand.roll': -20,
    'rightHand.pitch': 12,
    'rightHand.twist': 10,
    'leftShoulder.pitch': -10,
    'leftShoulder.spread': 8,
    'leftElbow.bend': 18,
    'leftHand.pitch': -8
  }
}, {
  id: `reach`,
  label: `伸手`,
  controls: {
    'rightShoulder.pitch': 50,
    'rightElbow.bend': 12,
    'body.pitch': 0
  }
}, {
  id: `cross-arms`,
  label: `抱臂`,
  controls: {
    'leftShoulder.pitch': 50,
    'leftShoulder.spread': -55,
    'leftShoulder.twist': 75,
    'leftElbow.bend': 50,
    'leftHand.roll': 0,
    'leftHand.pitch': -10,
    'rightShoulder.pitch': 90,
    'rightShoulder.spread': 55,
    'rightShoulder.twist': -45,
    'rightElbow.bend': 50,
    'rightHand.roll': 18,
    'rightHand.pitch': -10
  }
}, {
  id: `phone`,
  label: `看手机`,
  controls: {
    'head.pitch': 18,
    'rightShoulder.pitch': 20,
    'rightShoulder.spread': -4,
    'rightShoulder.twist': -30,
    'rightElbow.bend': 82,
    'rightHand.roll': -30,
    'rightHand.pitch': 14,
    'rightHand.twist': 60,
    'leftShoulder.pitch': -10,
    'leftShoulder.spread': 8,
    'leftElbow.bend': 16,
    'leftHand.pitch': -8
  }
}];
var $l = [{
  type: `box`,
  label: `立方体`
}, {
  type: `sphere`,
  label: `球体`
}, {
  type: `cylinder`,
  label: `圆柱体`
}, {
  type: `torus`,
  label: `环状体`
}, {
  type: `cone`,
  label: `圆锥`
}, {
  type: `pyramid`,
  label: `棱锥`
}];
var eu = `mannequin`;
var tu = {
  hipY: 0.74,
  pelvisRadius: 0.26,
  pelvisScale: [1.34, 0.58, 0.8],
  legSpread: 0.18,
  torsoLowerRadius: 0.18,
  torsoUpperRadius: 0.22,
  torsoLowerHeight: 0.26,
  torsoUpperHeight: 0.48,
  torsoLowerScale: [0.95, 0.96, 0.78],
  torsoUpperScale: [1.42, 1.08, 0.88],
  shoulderWidth: 0.42,
  shoulderRadius: 0.14,
  upperArmRadius: 0.085,
  upperArmLength: 0.34,
  forearmRadius: 0.074,
  forearmLength: 0.3,
  elbowRadius: 0.09,
  wristRadius: 0.074,
  handRadius: 0.095,
  handScale: [0.72, 1, 0.9],
  thighRadius: 0.11,
  thighLength: 0.42,
  calfRadius: 0.095,
  calfLength: 0.4,
  kneeRadius: 0.1,
  ankleRadius: 0.08,
  footRadius: 0.095,
  footLength: 0.22,
  footScale: [0.95, 0.55, 1.42],
  neckRadius: 0.1,
  neckHeight: 0.18,
  headRadius: 0.24,
  headScale: [0.78, 1, 0.72],
  faceOffsetZ: 0.18,
  eyeRadius: 0.022,
  noseScale: [0.42, 0.58, 0.32],
  mouthScale: [0.55, 0.1, 0.08],
  jointRadiusScale: 1
};
function nu(e, t, n, r = {}, i = [1, 1, 1]) {
  return {
    bodyType: e,
    defaultScale: i,
    label: t,
    labelAnchorY: n,
    proportions: {
      ...tu,
      ...r
    }
  };
}
var ru = [nu(`mannequin`, `男性素体`, 2.62), nu(`female`, `女性素体`, 2.52, {
  pelvisScale: [1.42, 0.56, 0.78],
  torsoLowerRadius: 0.16,
  torsoUpperRadius: 0.2,
  torsoLowerScale: [0.86, 0.98, 0.72],
  torsoUpperScale: [1.2, 1.04, 0.8],
  shoulderWidth: 0.37,
  shoulderRadius: 0.12,
  upperArmRadius: 0.074,
  forearmRadius: 0.066,
  thighRadius: 0.1,
  calfRadius: 0.082,
  headScale: [0.76, 1, 0.7]
}), nu(`broad`, `宽厚素体`, 2.76, {
  pelvisScale: [1.46, 0.62, 0.86],
  torsoLowerScale: [1.05, 0.98, 0.84],
  torsoUpperScale: [1.58, 1.08, 0.94],
  torsoUpperRadius: 0.27,
  torsoUpperHeight: 0.52,
  shoulderWidth: 0.52,
  shoulderRadius: 0.16,
  upperArmRadius: 0.105,
  forearmRadius: 0.09,
  thighRadius: 0.125,
  calfRadius: 0.108,
  headRadius: 0.25
}), nu(`muscular`, `健壮素体`, 2.7, {
  pelvisScale: [1.25, 0.56, 0.78],
  torsoLowerRadius: 0.17,
  torsoUpperRadius: 0.28,
  torsoLowerScale: [0.95, 0.96, 0.78],
  torsoUpperScale: [1.62, 1.06, 0.9],
  shoulderWidth: 0.5,
  shoulderRadius: 0.17,
  upperArmRadius: 0.11,
  forearmRadius: 0.095,
  thighRadius: 0.13,
  calfRadius: 0.11
}), nu(`slim`, `纤细素体`, 2.58, {
  pelvisScale: [1.08, 0.5, 0.7],
  torsoLowerRadius: 0.14,
  torsoUpperRadius: 0.17,
  torsoLowerScale: [0.78, 0.96, 0.68],
  torsoUpperScale: [1.04, 1.02, 0.72],
  shoulderWidth: 0.34,
  shoulderRadius: 0.105,
  upperArmRadius: 0.06,
  forearmRadius: 0.052,
  thighRadius: 0.082,
  calfRadius: 0.068,
  headRadius: 0.225
}), nu(`teen`, `少年素体`, 2.28, {
  hipY: 0.64,
  pelvisRadius: 0.22,
  pelvisScale: [1.18, 0.52, 0.74],
  legSpread: 0.15,
  torsoLowerRadius: 0.15,
  torsoLowerHeight: 0.22,
  torsoUpperRadius: 0.18,
  torsoUpperHeight: 0.4,
  torsoLowerScale: [0.82, 0.94, 0.7],
  torsoUpperScale: [1.1, 1.02, 0.76],
  shoulderWidth: 0.34,
  shoulderRadius: 0.105,
  upperArmRadius: 0.065,
  upperArmLength: 0.28,
  forearmRadius: 0.056,
  forearmLength: 0.25,
  thighRadius: 0.088,
  thighLength: 0.35,
  calfRadius: 0.076,
  calfLength: 0.33,
  headRadius: 0.23,
  headScale: [0.82, 1.05, 0.76]
}), nu(`child`, `儿童素体`, 1.82, {
  hipY: 0.5,
  pelvisRadius: 0.18,
  pelvisScale: [1.05, 0.48, 0.72],
  legSpread: 0.12,
  torsoLowerRadius: 0.13,
  torsoLowerHeight: 0.18,
  torsoUpperRadius: 0.15,
  torsoUpperHeight: 0.3,
  torsoLowerScale: [0.76, 0.9, 0.68],
  torsoUpperScale: [0.98, 0.98, 0.72],
  shoulderWidth: 0.28,
  shoulderRadius: 0.085,
  upperArmRadius: 0.052,
  upperArmLength: 0.2,
  forearmRadius: 0.046,
  forearmLength: 0.18,
  elbowRadius: 0.06,
  wristRadius: 0.05,
  handRadius: 0.07,
  thighRadius: 0.07,
  thighLength: 0.24,
  calfRadius: 0.062,
  calfLength: 0.22,
  kneeRadius: 0.065,
  ankleRadius: 0.054,
  footRadius: 0.07,
  footLength: 0.16,
  headRadius: 0.255,
  headScale: [0.9, 1.08, 0.82]
}), nu(`chibi`, `二头身`, 1.38, {
  hipY: 0.36,
  pelvisRadius: 0.16,
  pelvisScale: [1.05, 0.48, 0.78],
  legSpread: 0.1,
  torsoLowerRadius: 0.12,
  torsoLowerHeight: 0.12,
  torsoUpperRadius: 0.14,
  torsoUpperHeight: 0.22,
  torsoLowerScale: [0.86, 0.82, 0.74],
  torsoUpperScale: [0.96, 0.92, 0.78],
  shoulderWidth: 0.24,
  shoulderRadius: 0.07,
  upperArmRadius: 0.044,
  upperArmLength: 0.14,
  forearmRadius: 0.038,
  forearmLength: 0.12,
  elbowRadius: 0.048,
  wristRadius: 0.04,
  handRadius: 0.06,
  thighRadius: 0.056,
  thighLength: 0.15,
  calfRadius: 0.05,
  calfLength: 0.14,
  kneeRadius: 0.052,
  ankleRadius: 0.042,
  footRadius: 0.06,
  footLength: 0.12,
  footScale: [1.12, 0.62, 1.55],
  neckRadius: 0.065,
  neckHeight: 0.06,
  headRadius: 0.34,
  headScale: [0.96, 1.04, 0.88],
  faceOffsetZ: 0.25,
  eyeRadius: 0.026,
  noseScale: [0.34, 0.46, 0.28],
  mouthScale: [0.45, 0.1, 0.07],
  jointRadiusScale: 0.9
})];
var iu = ru.map(({
  bodyType: e,
  label: t
}) => {
  return {
    bodyType: e,
    label: t
  };
});
function au(e) {
  if (ru.some(t => {
    return t.bodyType === e;
  })) {
    return e;
  } else {
    return eu;
  }
}
function ou(e) {
  let t = au(e);
  return ru.find(e => {
    return e.bodyType === t;
  }) ?? ru[0];
}
function su(e) {
  return ou(e).labelAnchorY;
}
function cu(e) {
  return e * Math.PI / 180;
}
function lu(e, t, n) {
  return Math.min(n, Math.max(t, e));
}
function uu(e) {
  switch (au(e)) {
    case `chibi`:
      {
        return 58;
      }
    case `child`:
      {
        return 72;
      }
    default:
      {
        return 90;
      }
  }
}
function du(e, t, n) {
  let r = uu(n);
  return [cu(lu(e[`${t}.pitch`] ?? 0, -r, r)), cu(lu(e[`${t}.yaw`] ?? 0, -r, r)), cu(lu(e[`${t}.roll`] ?? 0, -r, r))];
}
function fu(e, t, n) {
  let r = uu(n);
  return [cu(lu(e[t] ?? 0, -r, r)), 0, 0];
}
function pu(e, t) {
  return `${e.endsWith(`/`) ? e : `${e}/`}${t}`;
}
var mu = pu(`./`, `models/ue-mannequin-retopology.glb`);
var hu = 1 / 0.0254;
function gu(e, t) {
  let n = uu(t);
  return Math.min(n, Math.max(-n, e));
}
function _u(e, t) {
  return cu(gu(e, t));
}
function vu(e, t, n) {
  return [_u(e[`${t}.yaw`] ?? 0, n), _u(e[`${t}.roll`] ?? 0, n), -_u(e[`${t}.pitch`] ?? 0, n)];
}
function yu(e, t) {
  return [_u(e[`head.yaw`] ?? 0, t), _u(e[`head.roll`] ?? 0, t), _u(e[`head.pitch`] ?? 0, t)];
}
function bu(e, t, n) {
  let r = e[`${t}.spread`] ?? 0;
  return [_u(e[`${t}.twist`] ?? 0, n), _u(r, n), -_u(e[`${t}.pitch`] ?? 0, n)];
}
function xu(e, t, n) {
  let r = e[`${t}.spread`] ?? 0;
  return [_u(e[`${t}.twist`] ?? 0, n), -_u(r, n), _u(e[`${t}.pitch`] ?? 0, n)];
}
function Su(e, t, n) {
  return [0, 0, -_u(e[t] ?? 0, n)];
}
function Cu(e, t, n) {
  return [_u(e[`${t}.twist`] ?? 0, n), _u(e[`${t}.roll`] ?? 0, n), _u(e[`${t}.pitch`] ?? 0, n)];
}
function wu(e, t, n) {
  return [_u(e[`${t}.twist`] ?? 0, n), _u(e[`${t}.roll`] ?? 0, n), _u(e[`${t}.pitch`] ?? 0, n)];
}
function Tu() {
  return {
    Bip001_Head_055: [1, 1, 1],
    Bip001_Neck_06: [1, 1, 1],
    Bip001_Pelvis_03: [1, 1, 1],
    Bip001_Spine_04: [1, 1, 1],
    Bip001_Spine1_05: [1, 1.02, 1.02],
    Bip001_L_Clavicle_07: [1, 1, 1],
    Bip001_R_Clavicle_031: [1, 1, 1],
    Bip001_L_UpperArm_08: [1, 1, 1],
    Bip001_R_UpperArm_032: [1, 1, 1],
    Bip001_L_Forearm_09: [1, 1, 1],
    Bip001_R_Forearm_033: [1, 1, 1],
    Bip001_L_Hand_010: [1, 1, 1],
    Bip001_R_Hand_034: [1, 1, 1],
    Bip001_L_Thigh_057: [1, 1, 1],
    Bip001_R_Thigh_061: [1, 1, 1],
    Bip001_L_Calf_058: [1, 1, 1],
    Bip001_R_Calf_062: [1, 1, 1],
    Bip001_L_Foot_059: [1, 1, 1],
    Bip001_R_Foot_063: [1, 1, 1]
  };
}
function Eu(e) {
  switch (e) {
    case `teen`:
      {
        return [0.88, 0.88, 0.88];
      }
    case `child`:
      {
        return [0.72, 0.72, 0.72];
      }
    case `chibi`:
      {
        return [0.56, 0.56, 0.56];
      }
    default:
      {
        return [1, 1, 1];
      }
  }
}
function Du(e) {
  switch (e) {
    case `female`:
    case `slim`:
      {
        return 1.98;
      }
    case `broad`:
    case `muscular`:
      {
        return 2.08;
      }
    case `teen`:
      {
        return 1.78;
      }
    case `child`:
      {
        return 1.46;
      }
    case `chibi`:
      {
        return 1.18;
      }
    default:
      {
        return 2.04;
      }
  }
}
function Ou() {
  return {
    Bip001_L_UpperArm_08: [0, cu(25), 0],
    Bip001_R_UpperArm_032: [0, cu(-25), 0],
    Bip001_L_Forearm_09: [0, 0, cu(25)],
    Bip001_R_Forearm_033: [0, 0, cu(25)]
  };
}
function ku(e = `mannequin`) {
  let t = Tu();
  switch (e) {
    case `female`:
      {
        t.Bip001_Pelvis_03 = [1, 1.04, 1.04];
        t.Bip001_Spine_04 = [0.98, 0.9, 0.94];
        t.Bip001_Spine1_05 = [0.98, 1, 1];
        t.Bip001_L_Clavicle_07 = [0.92, 1, 1];
        t.Bip001_R_Clavicle_031 = [0.92, 1, 1];
        t.Bip001_L_UpperArm_08 = [0.9, 0.9, 0.9];
        t.Bip001_R_UpperArm_032 = [0.9, 0.9, 0.9];
        t.Bip001_L_Forearm_09 = [1, 0.88, 0.9];
        t.Bip001_R_Forearm_033 = [1, 0.88, 0.9];
        t.Bip001_L_Thigh_057 = [1, 0.96, 0.96];
        t.Bip001_R_Thigh_061 = [1, 0.96, 0.96];
        break;
      }
    case `broad`:
      {
        t.Bip001_Pelvis_03 = [1.02, 1.12, 1.08];
        t.Bip001_Spine1_05 = [1.02, 1.22, 1.1];
        t.Bip001_L_Clavicle_07 = [1.12, 1, 1];
        t.Bip001_R_Clavicle_031 = [1.12, 1, 1];
        t.Bip001_L_UpperArm_08 = [1, 1.12, 1.12];
        t.Bip001_R_UpperArm_032 = [1, 1.12, 1.12];
        t.Bip001_L_Forearm_09 = [1, 1.08, 1.08];
        t.Bip001_R_Forearm_033 = [1, 1.08, 1.08];
        t.Bip001_L_Thigh_057 = [1.02, 1.1, 1.08];
        t.Bip001_R_Thigh_061 = [1.02, 1.1, 1.08];
        break;
      }
    case `muscular`:
      {
        t.Bip001_Pelvis_03 = [1, 1.04, 1.04];
        t.Bip001_Spine_04 = [1.02, 1.1, 1.06];
        t.Bip001_Spine1_05 = [1.02, 1.26, 1.1];
        t.Bip001_L_Clavicle_07 = [1.16, 1, 1];
        t.Bip001_R_Clavicle_031 = [1.16, 1, 1];
        t.Bip001_L_UpperArm_08 = [1, 1.18, 1.18];
        t.Bip001_R_UpperArm_032 = [1, 1.18, 1.18];
        t.Bip001_L_Forearm_09 = [1, 1.12, 1.12];
        t.Bip001_R_Forearm_033 = [1, 1.12, 1.12];
        t.Bip001_L_Thigh_057 = [1, 1.12, 1.12];
        t.Bip001_R_Thigh_061 = [1, 1.12, 1.12];
        break;
      }
    case `slim`:
      {
        t.Bip001_Pelvis_03 = [0.98, 0.75, 0.9];
        t.Bip001_Spine_04 = [0.98, 1, 1];
        t.Bip001_Spine1_05 = [0.98, 1, 1];
        t.Bip001_L_Clavicle_07 = [0.9, 1, 0.9];
        t.Bip001_R_Clavicle_031 = [0.9, 1, 0.9];
        t.Bip001_L_UpperArm_08 = [0.96, 0.96, 0.96];
        t.Bip001_R_UpperArm_032 = [0.96, 0.96, 0.96];
        t.Bip001_L_Forearm_09 = [1, 1, 0.78];
        t.Bip001_R_Forearm_033 = [1, 1, 0.78];
        t.Bip001_L_Thigh_057 = [1, 0.84, 0.84];
        t.Bip001_R_Thigh_061 = [1, 0.84, 0.84];
        t.Bip001_L_Calf_058 = [1, 1, 1];
        t.Bip001_R_Calf_062 = [1, 1, 1];
        break;
      }
    case `teen`:
      {
        t.Bip001_Head_055 = [1.12, 1.12, 1.12];
        t.Bip001_Pelvis_03 = [0.96, 0.94, 0.94];
        t.Bip001_Spine1_05 = [0.96, 0.94, 0.94];
        t.Bip001_L_UpperArm_08 = [0.96, 0.9, 0.9];
        t.Bip001_R_UpperArm_032 = [0.96, 0.9, 0.9];
        t.Bip001_L_Thigh_057 = [0.96, 0.9, 0.9];
        t.Bip001_R_Thigh_061 = [0.96, 0.9, 0.9];
        break;
      }
    case `child`:
      {
        t.Bip001_Head_055 = [1.34, 1.34, 1.34];
        t.Bip001_Pelvis_03 = [0.88, 0.9, 0.9];
        t.Bip001_Spine_04 = [1.2, 1.2, 1.2];
        t.Bip001_Spine1_05 = [0.84, 0.86, 0.86];
        t.Bip001_L_UpperArm_08 = [0.84, 1.1, 1.1];
        t.Bip001_R_UpperArm_032 = [0.84, 1.1, 1.1];
        t.Bip001_L_Forearm_09 = [1, 0.8, 0.8];
        t.Bip001_R_Forearm_033 = [1, 0.8, 0.8];
        t.Bip001_L_Thigh_057 = [0.7, 0.9, 0.9];
        t.Bip001_R_Thigh_061 = [0.7, 0.9, 0.9];
        t.Bip001_L_Calf_058 = [0.82, 0.9, 0.9];
        t.Bip001_R_Calf_062 = [0.82, 0.9, 0.9];
        break;
      }
    case `chibi`:
      {
        t.Bip001_Head_055 = [4, 4, 4];
        t.Bip001_Neck_06 = [0.72, 0.76, 0.76];
        t.Bip001_Pelvis_03 = [0.92, 1.22, 1.22];
        t.Bip001_Spine_04 = [0.68, 1, 1];
        t.Bip001_Spine1_05 = [1, 0.9, 0.9];
        t.Bip001_L_Clavicle_07 = [1.24, 0.9, 0.9];
        t.Bip001_R_Clavicle_031 = [1.24, 0.9, 0.9];
        t.Bip001_L_UpperArm_08 = [1.2, 1.3, 1.3];
        t.Bip001_R_UpperArm_032 = [1.2, 1.3, 1.3];
        t.Bip001_L_Forearm_09 = [0.7, 1, 1];
        t.Bip001_R_Forearm_033 = [0.7, 1, 1];
        t.Bip001_L_Hand_010 = [1.45, 1, 1];
        t.Bip001_R_Hand_034 = [1.45, 1, 1];
        t.Bip001_L_Thigh_057 = [0.62, 0.8, 0.8];
        t.Bip001_R_Thigh_061 = [0.62, 0.8, 0.8];
        t.Bip001_L_Calf_058 = [0.7, 0.9, 0.9];
        t.Bip001_R_Calf_062 = [0.7, 0.9, 0.9];
        t.Bip001_L_Foot_059 = [1.06, 0.82, 1.16];
        t.Bip001_R_Foot_063 = [1.06, 0.82, 1.16];
        break;
      }
    default:
      {
        t.Bip001_Pelvis_03 = [1, 1.02, 1.02];
        t.Bip001_Spine1_05 = [1, 1.02, 1.02];
        break;
      }
  }
  return t;
}
function Au(e) {
  let t = e[`body.offsetY`] ?? 0;
  if (t === 0) {
    return {};
  } else {
    return {
      Bip001_Pelvis_03: [0, 0, t * hu]
    };
  }
}
function ju(e, t) {
  return {
    Bip001_Pelvis_03: vu(e, `body`, t),
    Bip001_Spine1_05: vu(e, `torso`, t),
    Bip001_Head_055: yu(e, t),
    Bip001_L_UpperArm_08: bu(e, `leftShoulder`, t),
    Bip001_R_UpperArm_032: bu(e, `rightShoulder`, t),
    Bip001_L_Forearm_09: Su(e, `leftElbow.bend`, t),
    Bip001_R_Forearm_033: Su(e, `rightElbow.bend`, t),
    Bip001_L_Hand_010: Cu(e, `leftHand`, t),
    Bip001_R_Hand_034: Cu(e, `rightHand`, t),
    Bip001_L_Thigh_057: xu(e, `leftHip`, t),
    Bip001_R_Thigh_061: xu(e, `rightHip`, t),
    Bip001_L_Calf_058: Su(e, `leftKnee.bend`, t),
    Bip001_R_Calf_062: Su(e, `rightKnee.bend`, t),
    Bip001_L_Foot_059: wu(e, `leftFoot`, t),
    Bip001_R_Foot_063: wu(e, `rightFoot`, t)
  };
}
var Mu = 1;
var Nu = {
  box: 0.5,
  sphere: 0.55,
  cylinder: 0.6,
  torus: 0.14,
  cone: 0.55,
  pyramid: 0.55
};
function Pu(e) {
  return [e.x, e.y, e.z].map(e => {
    return Number(e.toFixed(6));
  });
}
function Fu(e) {
  return e.visible && e.kind !== `camera` && e.kind !== `panorama`;
}
function Iu(e) {
  if (e.assetRefId) {
    return Mu;
  } else if (e.kind === `character`) {
    return (e.characterRig?.rigType === `ue4-mannequin` ? Du(e.bodyType) : su(e.bodyType)) / 2;
  } else if (e.geometryType) {
    return Nu[e.geometryType];
  } else {
    return Mu;
  }
}
function Lu(e) {
  let [t, n, r] = e.transform.scale;
  let i = new W(0, Iu(e), 0).multiply(new W(t, n, r)).applyEuler(new ge(...e.transform.rotation));
  return Pu(new W(...e.transform.position).add(i));
}
var Ru = 16 / 9;
var zu = 0.35;
var Bu = zu * 5.2;
var Vu = zu * 3.2;
var Hu = {
  fov: 50,
  position: [0, 1.55, 5.4],
  target: [0, 1.05, 0]
};
function Uu(e, t) {
  let n = new W(...t).sub(new W(...e));
  if (n.lengthSq() === 0) {
    return new W(0, 0, -1);
  } else {
    return n.normalize();
  }
}
function Wu(e) {
  return [e.x, e.y, e.z].map(e => {
    return Number(e.toFixed(6));
  });
}
function Gu(e) {
  let t = new W(...e.transform.position);
  let n = Uu(e.transform.position, e.target);
  let r = t.add(n.multiplyScalar(Bu));
  return {
    fov: e.fov,
    position: Wu(r),
    target: e.target
  };
}
function Ku(e) {
  let t = new W(...e.position);
  let n = Uu(e.position, e.target);
  return Wu(t.sub(n.multiplyScalar(Bu)));
}
var qu = {
  scale: 1,
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  backgroundColor: `#000000`,
  panoramaYaw: 0,
  panoramaRadius: 60,
  showLabels: true,
  snapToGrid: false,
  showGround: true,
  groundOpacity: 0.4,
  groundHeight: 0
};
var Ju = [`#4F8EF7`, `#E0524D`, `#E91E63`, `#F2A900`, `#9C4DCC`, `#12B886`, `#00B8D9`, `#FF7A45`];
var Yu = `#d7e7ff`;
var Xu = 1.25;
var Zu = 0.6;
var Qu = 80;
var $u = `storyai-3d-director-local-model-library`;
var ed = `storyai-3d-director-desk-demo`;
var td = `${ed}:`;
var nd = {
  viewMode: `director`,
  selectedObjectId: null,
  selectedObjectIds: [],
  selectedCrowdId: null,
  directorInspectorMode: `auto`,
  transformMode: `translate`,
  viewportAspectRatio: `auto`,
  viewportRuleOfThirdsEnabled: false,
  viewportPanelsCollapsed: false
};
function rd(e) {
  if (typeof e == `string`) {
    return e.trim();
  } else {
    return ``;
  }
}
function id() {
  if (typeof window > `u`) {
    return null;
  }
  try {
    return rd(new URLSearchParams(window.location.search).get(`instanceId`)) || null;
  } catch {
    return null;
  }
}
var ad = id();
function od(e = ad) {
  let t = rd(e);
  if (t) {
    return `${td}${t}`;
  } else {
    return ed;
  }
}
function sd(e) {
  ad = rd(e) || null;
}
function cd(e, t = [0, 0, 0], n = [1, 1, 1]) {
  return {
    position: e,
    rotation: t,
    scale: n
  };
}
function ld(e) {
  return Number(e.toFixed(6));
}
function ud(e) {
  return e.map(e => {
    return ld(e);
  });
}
function dd(e, t) {
  return `${e}${String(t).padStart(2, `0`)}`;
}
function fd(e, t, n = 1) {
  let r = n - 1;
  for (let n of e) {
    if (!n.startsWith(t)) {
      continue;
    }
    let e = n.slice(t.length);
    if (/^\d+$/.test(e)) {
      r = Math.max(r, Number.parseInt(e, 10));
    }
  }
  return `${t}${r + 1}`;
}
function pd(e) {
  return e.sourceType === `model` && e.kind !== `panorama` && e.assetSource === `local`;
}
function md() {
  if (typeof localStorage > `u`) {
    return null;
  } else {
    return localStorage;
  }
}
function hd(e) {
  return JSON.parse(JSON.stringify(e));
}
function gd() {
  let e = md();
  if (!e) {
    return [];
  }
  try {
    let t = e.getItem($u);
    if (!t) {
      return [];
    }
    let n = JSON.parse(t);
    if (Array.isArray(n)) {
      return n.filter(e => {
        return e && typeof e.id == `string` && typeof e.fileName == `string` && typeof e.url == `string` && pd(e);
      });
    } else {
      return [];
    }
  } catch {
    return [];
  }
}
function _d(e) {
  let t = md();
  if (t) {
    try {
      t.setItem($u, JSON.stringify(e.filter(pd)));
    } catch {}
  }
}
function vd(e) {
  if (pd(e)) {
    _d([...gd().filter(t => {
      return t.id !== e.id;
    }), e]);
  }
}
function yd(e) {
  _d(gd().filter(t => {
    return t.id !== e;
  }));
}
function bd(e) {
  if (!e || typeof e != `object`) {
    return false;
  }
  let t = e;
  return t.version === 1 && Array.isArray(t.assets) && Array.isArray(t.objects) && Array.isArray(t.cameras) && !!t.scene && typeof t.scene?.backgroundColor == `string`;
}
function xd(e, t = false) {
  if (!t) {
    return e;
  }
  let n = gd();
  if (!n.length) {
    return e;
  }
  let r = new Set(e.assets.map(e => {
    return e.id;
  }));
  return {
    ...e,
    assets: [...e.assets, ...n.filter(e => {
      return !r.has(e.id);
    })]
  };
}
function Sd(e) {
  return {
    ...e,
    objects: e.objects.map(e => {
      if (e.kind !== `character`) {
        return e;
      }
      let t = e.characterRig;
      if (t?.rigType === `ue4-mannequin`) {
        return e;
      } else {
        return {
          ...e,
          characterRig: {
            rigType: `ue4-mannequin`,
            posePresetId: t?.posePresetId ?? `stand`,
            controls: t?.controls ?? {}
          }
        };
      }
    })
  };
}
function Cd(e) {
  return hd({
    viewMode: e.viewMode,
    selectedObjectId: e.selectedObjectId,
    selectedObjectIds: e.selectedObjectIds,
    selectedCrowdId: e.selectedCrowdId,
    directorInspectorMode: e.directorInspectorMode,
    transformMode: e.transformMode,
    viewportAspectRatio: e.viewportAspectRatio,
    viewportRuleOfThirdsEnabled: e.viewportRuleOfThirdsEnabled,
    viewportPanelsCollapsed: e.viewportPanelsCollapsed,
    project: e.project
  });
}
function wd(e) {
  let t = md();
  if (t) {
    try {
      t.setItem(od(), JSON.stringify(e));
    } catch {}
  }
}
function Td(e, t = {}) {
  return {
    ...nd,
    project: xd(Sd(hd(e)), t.includePersistedLocalAssets)
  };
}
function Ed(e = {}) {
  let t = md();
  if (!t) {
    return null;
  }
  try {
    let n = t.getItem(od(e.persistenceScopeId));
    if (!n) {
      return null;
    }
    let r = JSON.parse(n);
    if (bd(r)) {
      return Td(r, e);
    }
    if (!r || typeof r != `object`) {
      return null;
    }
    let i = r;
    if (bd(i.project)) {
      return {
        viewMode: i.viewMode === `camera` ? `camera` : `director`,
        selectedObjectId: typeof i.selectedObjectId == `string` ? i.selectedObjectId : null,
        selectedObjectIds: Array.isArray(i.selectedObjectIds) ? i.selectedObjectIds.filter(e => {
          return typeof e == `string`;
        }) : [],
        selectedCrowdId: typeof i.selectedCrowdId == `string` ? i.selectedCrowdId : null,
        directorInspectorMode: i.directorInspectorMode === `scene` ? `scene` : `auto`,
        transformMode: i.transformMode === `rotate` || i.transformMode === `scale` ? i.transformMode : `translate`,
        viewportAspectRatio: i.viewportAspectRatio ?? `auto`,
        viewportRuleOfThirdsEnabled: !!i.viewportRuleOfThirdsEnabled,
        viewportPanelsCollapsed: !!i.viewportPanelsCollapsed,
        project: xd(Sd(hd(i.project)), e.includePersistedLocalAssets)
      };
    } else {
      return null;
    }
  } catch {
    return null;
  }
}
function Dd(e) {
  return {
    ...hd(e),
    clipboard: [],
    clipboardPasteCount: 0,
    undoStack: [],
    undoBatchDepth: 0,
    undoBatchSnapshot: null,
    undoBatchHasTrackedChanges: false
  };
}
function Od(e) {
  return Cd(e);
}
function kd({
  includePersistedLocalAssets: e = false
} = {}) {
  let t = {
    id: `cam_1`,
    name: dd(`机位`, 1),
    fov: Hu.fov,
    transform: cd(Ku(Hu)),
    targetMode: `manual`,
    target: Hu.target,
    lastCaptureUrl: null,
    captures: []
  };
  let n = {
    id: `char_default_a`,
    name: dd(`角色`, 1),
    kind: `character`,
    visible: true,
    locked: false,
    bodyType: eu,
    color: `#4F8EF7`,
    transform: cd([0, 0, 0]),
    characterRig: {
      rigType: `ue4-mannequin`,
      posePresetId: `stand`,
      controls: {}
    }
  };
  let r = {
    id: `cam_object_1`,
    name: t.name,
    kind: `camera`,
    visible: true,
    locked: false,
    linkedCameraId: t.id,
    transform: t.transform
  };
  return {
    version: 1,
    scene: qu,
    assets: e ? gd() : [],
    objects: [n, r],
    cameras: [t],
    activeCameraId: t.id,
    panoramaAssetId: null
  };
}
function Ad(e = {}) {
  return (e.includePersistedScene ? Ed(e) : null) || {
    ...nd,
    project: kd({
      includePersistedLocalAssets: e.includePersistedLocalAssets
    })
  };
}
function jd(e, t, n) {
  return e.map(e => {
    if (e.id === t) {
      return n(e);
    } else {
      return e;
    }
  });
}
function Md(e) {
  let t = new Set(e.filter(e => {
    return e.kind === `character`;
  }).map(e => {
    return e.color;
  }));
  return Ju.find(e => {
    return !t.has(e);
  }) || Ju[e.filter(e => {
    return e.kind === `character`;
  }).length % Ju.length];
}
function Nd(e) {
  return $l.find(t => {
    return t.type === e;
  })?.label ?? `几何模型`;
}
function Pd(e) {
  return (e % 2 == 1 ? -1 : 1) * Math.ceil(e / 2) * Xu;
}
function Fd(e, t, n) {
  let r = Math.max(1, e);
  let i = Math.max(1, t);
  let a = Math.max(0.1, n);
  let o = (i - 1) * a / 2;
  let s = (r - 1) * a / 2;
  let c = [];
  for (let e = 0; e < r; e += 1) {
    for (let t = 0; t < i; t += 1) {
      c.push([Number((t * a - o).toFixed(4)), 0, Number((e * a - s).toFixed(4))]);
    }
  }
  return c;
}
function Id(e, t) {
  let n = Math.max(0.1, t);
  let r = e.filter(e => {
    return e.kind === `character`;
  }).map(e => {
    return e.transform.position;
  });
  let i = r.length ? Math.max(...r.map(e => {
    return e[2];
  })) : 0;
  return [0, 0, Number((i + n * 2).toFixed(4))];
}
function Ld(e, t) {
  return `群众（${e}x${t}）`;
}
function Rd(e, t, n, r) {
  let i = e.project.objects.filter(e => {
    return e.kind === `character`;
  }).length + 1;
  let a = fd(e.project.objects.map(e => {
    return e.id;
  }), `char_preset_`, i);
  let o = au(t);
  return {
    id: a,
    name: dd(`角色`, i),
    kind: `character`,
    visible: true,
    locked: false,
    bodyType: o,
    color: Md(e.project.objects),
    crowdId: r?.crowdId,
    crowdLabel: r?.crowdLabel,
    transform: cd(n),
    characterRig: {
      rigType: `ue4-mannequin`,
      posePresetId: `stand`,
      controls: {}
    }
  };
}
function zd(e, t) {
  return `${e}-截图${String(t).padStart(2, `0`)}`;
}
function Bd(e, t) {
  let n = e.captures ?? [];
  return t.map((t, r) => {
    let i = n.length + r + 1;
    return {
      id: `${e.id}-capture-${String(i).padStart(2, `0`)}`,
      index: i,
      name: zd(e.name, i),
      dataUrl: t
    };
  });
}
function Vd(e) {
  return e.replace(/\.(fbx|obj|jpe?g|png|webp)$/i, ``);
}
function Hd(e, t) {
  return {
    id: fd(t.map(e => {
      return e.id;
    }), `obj_`, t.length + 1),
    name: e.name ?? Vd(e.fileName),
    kind: e.kind,
    visible: true,
    locked: false,
    assetRefId: e.id,
    transform: cd([0, 0, 0])
  };
}
function Ud(e, t) {
  return e.map(e => {
    if (e.targetMode === `object` && e.targetObjectId === t.id) {
      return {
        ...e,
        target: Lu(t)
      };
    } else {
      return e;
    }
  });
}
function Wd(e, t, n) {
  let r = new Set(n);
  if (r.size === 0) {
    return e;
  }
  let i = new Map(t.map(e => {
    return [e.id, e];
  }));
  return e.map(e => {
    if (e.targetMode !== `object` || !e.targetObjectId || !r.has(e.targetObjectId)) {
      return e;
    }
    let t = i.get(e.targetObjectId);
    if (t) {
      return {
        ...e,
        target: Lu(t)
      };
    } else {
      return {
        ...e,
        targetMode: `manual`,
        targetObjectId: null
      };
    }
  });
}
function Gd(e, t) {
  return e.filter(e => {
    return e.kind === `character` && e.crowdId === t;
  });
}
function Kd(e, t) {
  return Gd(e, t).map(e => {
    return e.id;
  });
}
function qd(e, t) {
  let n = Gd(e, t);
  if (!n.length) {
    return null;
  }
  let r = n.reduce((e, t) => {
    e[0] += t.transform.position[0];
    e[1] += t.transform.position[1];
    e[2] += t.transform.position[2];
    return e;
  }, [0, 0, 0]);
  let i = n.length;
  let a = ud([r[0] / i, r[1] / i, r[2] / i]);
  let o = n[0];
  return cd(a, [...o.transform.rotation], [...o.transform.scale]);
}
function Jd(e) {
  return fd(e.map(e => {
    return e.crowdId;
  }).filter(e => {
    return typeof e == `string`;
  }), `crowd_`, 1);
}
function Yd(e, t, n) {
  let r = qd(e, t);
  if (!r) {
    return {
      objects: e,
      changedObjectIds: []
    };
  }
  let i = n.position ?? r.position;
  let a = n.rotation ?? r.rotation;
  let o = n.scale ?? r.scale;
  let s = [a[0] - r.rotation[0], a[1] - r.rotation[1], a[2] - r.rotation[2]];
  let c = [r.scale[0] === 0 ? 1 : o[0] / r.scale[0], r.scale[1] === 0 ? 1 : o[1] / r.scale[1], r.scale[2] === 0 ? 1 : o[2] / r.scale[2]];
  let l = r.position;
  let u = Kd(e, t);
  let d = new Set(u);
  return {
    changedObjectIds: u,
    objects: e.map(e => {
      if (!d.has(e.id)) {
        return e;
      }
      let t = (e.transform.position[0] - l[0]) * c[0];
      let n = (e.transform.position[1] - l[1]) * c[1];
      let r = (e.transform.position[2] - l[2]) * c[2];
      let a = Math.cos(s[0]);
      let o = Math.sin(s[0]);
      let u = Math.cos(s[1]);
      let f = Math.sin(s[1]);
      let p = Math.cos(s[2]);
      let m = Math.sin(s[2]);
      let h = t;
      let g = n * a - r * o;
      let _ = n * o + r * a;
      let v = h * u + _ * f;
      let y = g;
      let b = -h * f + _ * u;
      let x = v * p - y * m;
      let S = v * m + y * p;
      let C = b;
      return {
        ...e,
        transform: {
          position: ud([i[0] + x, i[1] + S, i[2] + C]),
          rotation: ud([e.transform.rotation[0] + s[0], e.transform.rotation[1] + s[1], e.transform.rotation[2] + s[2]]),
          scale: ud([e.transform.scale[0] * c[0], e.transform.scale[1] * c[1], e.transform.scale[2] * c[2]])
        }
      };
    })
  };
}
function Xd(e) {
  if (e.selectedObjectIds.length) {
    return e.selectedObjectIds;
  } else if (e.selectedObjectId) {
    return [e.selectedObjectId];
  } else {
    return [];
  }
}
function Zd(e, t) {
  if (t.kind === `camera`) {
    return fd(e.map(e => {
      return e.id;
    }), `cam_object_`, e.filter(e => {
      return e.kind === `camera`;
    }).length + 1);
  } else if (t.kind === `character`) {
    return fd(e.map(e => {
      return e.id;
    }), `char_paste_`, e.filter(e => {
      return e.kind === `character`;
    }).length + 1);
  } else if (t.geometryType) {
    return fd(e.map(e => {
      return e.id;
    }), `geo_${t.geometryType}_copy_`, e.length + 1);
  } else {
    return fd(e.map(e => {
      return e.id;
    }), `obj_`, e.length + 1);
  }
}
function Qd(e, t) {
  return [e[0] + t, e[1], e[2] + t];
}
function $d(e, t) {
  return {
    ...e,
    position: Qd(e.position, t)
  };
}
function ef(e) {
  let t = Xd(e);
  if (t.length) {
    return t.flatMap(t => {
      let n = e.project.objects.find(e => {
        return e.id === t;
      });
      if (!n) {
        return [];
      }
      let r = n.kind === `camera` && n.linkedCameraId ? e.project.cameras.find(e => {
        return e.id === n.linkedCameraId;
      }) : undefined;
      return [{
        object: hd(n),
        camera: r ? hd(r) : undefined
      }];
    });
  } else {
    return [];
  }
}
function tf(e) {
  if (e.clipboard.length === 0) {
    return e;
  }
  let t = e.clipboardPasteCount + 1;
  let n = Zu * t;
  let r = [...e.project.objects];
  let i = [...e.project.cameras];
  let a = new Map();
  let o = new Map();
  let s = [];
  function c(e) {
    let t = o.get(e);
    if (t) {
      return t;
    }
    let n = Jd(r);
    o.set(e, n);
    return n;
  }
  e.clipboard.forEach(e => {
    if (e.object.kind === `camera` && e.camera) {
      let t = i.length + 1;
      let o = fd(i.map(e => {
        return e.id;
      }), `cam_`, t);
      let c = Zd(r, e.object);
      a.set(e.object.id, c);
      if (e.object.linkedCameraId) {
        a.set(e.object.linkedCameraId, o);
      }
      let l = e.camera.targetObjectId ? a.get(e.camera.targetObjectId) : null;
      let u = {
        ...e.camera,
        id: o,
        name: dd(`机位`, t),
        transform: $d(e.camera.transform, n),
        target: e.camera.targetMode === `manual` ? Qd(e.camera.target, n) : e.camera.target,
        targetObjectId: l ?? e.camera.targetObjectId ?? null,
        captures: [],
        lastCaptureUrl: null
      };
      let d = {
        ...e.object,
        id: c,
        name: u.name,
        linkedCameraId: u.id,
        transform: u.transform
      };
      i.push(u);
      r.push(d);
      s.push(c);
      return;
    }
    let t = Zd(r, e.object);
    a.set(e.object.id, t);
    let o = e.object.kind === `character` ? r.filter(e => {
      return e.kind === `character`;
    }).length + 1 : null;
    let l = {
      ...e.object,
      id: t,
      name: e.object.kind === `character` && o ? dd(`角色`, o) : e.object.name,
      crowdId: e.object.crowdId ? c(e.object.crowdId) : e.object.crowdId,
      transform: $d(e.object.transform, n)
    };
    r.push(l);
    s.push(t);
  });
  let l = new Map(r.map(e => {
    return [e.id, e];
  }));
  let u = i.map(e => {
    if (e.targetMode !== `object` || !e.targetObjectId) {
      return e;
    }
    let t = a.get(e.targetObjectId) ?? e.targetObjectId;
    let n = l.get(t);
    if (n) {
      return {
        ...e,
        targetObjectId: t,
        target: Lu(n)
      };
    } else {
      return {
        ...e,
        targetMode: `manual`,
        targetObjectId: null
      };
    }
  });
  let d = s.length ? r.find(e => {
    return e.id === s[s.length - 1];
  }) : null;
  let f = Array.from(new Set(s.map(e => {
    return r.find(t => {
      return t.id === e;
    })?.crowdId;
  }).filter(e => {
    return typeof e == `string`;
  })));
  return {
    ...e,
    selectedObjectId: s[s.length - 1] ?? null,
    selectedObjectIds: s,
    selectedCrowdId: f.length === 1 ? f[0] : null,
    directorInspectorMode: `auto`,
    clipboardPasteCount: t,
    project: {
      ...e.project,
      objects: r,
      cameras: u,
      activeCameraId: d?.kind === `camera` ? d.linkedCameraId ?? e.project.activeCameraId : e.project.activeCameraId
    }
  };
}
function nf(e, t) {
  return JSON.stringify(e) === JSON.stringify(t);
}
function rf(e) {
  if (e.length > Qu) {
    return e.slice(e.length - Qu);
  } else {
    return e;
  }
}
var $ = Ht((e, t) => {
  let n = Dd(Ad({
    includePersistedLocalAssets: true,
    includePersistedScene: true
  }));
  function r(t, n = {}) {
    let {
      trackUndo: r = true,
      persist: i = true
    } = n;
    e(e => {
      let n = e;
      let a = Od(n);
      let o = t(n);
      if (nf(a, Cd(o))) {
        return {
          ...o,
          undoStack: r ? n.undoStack : o.undoStack,
          undoBatchDepth: o.undoBatchDepth,
          undoBatchSnapshot: o.undoBatchSnapshot,
          undoBatchHasTrackedChanges: o.undoBatchHasTrackedChanges
        };
      }
      let s = r && n.undoBatchDepth > 0 && n.undoBatchSnapshot === null;
      let c = r && n.undoBatchDepth === 0 ? rf([...n.undoStack, a]) : o.undoStack;
      let l = {
        ...o,
        undoStack: c,
        undoBatchSnapshot: s ? a : o.undoBatchSnapshot,
        undoBatchHasTrackedChanges: r && n.undoBatchDepth > 0 ? true : o.undoBatchHasTrackedChanges
      };
      if (i) {
        wd(Cd(l));
      }
      return l;
    });
  }
  function i(e) {
    r(e, {
      trackUndo: false,
      persist: true
    });
  }
  return {
    ...n,
    beginUndoBatch: () => {
      e(e => {
        let t = e;
        return {
          ...t,
          undoBatchDepth: t.undoBatchDepth + 1,
          undoBatchSnapshot: t.undoBatchDepth === 0 ? Od(t) : t.undoBatchSnapshot,
          undoBatchHasTrackedChanges: t.undoBatchDepth === 0 ? false : t.undoBatchHasTrackedChanges
        };
      });
    },
    endUndoBatch: () => {
      e(e => {
        let t = e;
        if (t.undoBatchDepth === 0) {
          return t;
        }
        let n = t.undoBatchDepth - 1;
        if (n > 0) {
          return {
            ...t,
            undoBatchDepth: n
          };
        }
        let r = Cd(t);
        let i = t.undoBatchHasTrackedChanges && t.undoBatchSnapshot !== null && !nf(t.undoBatchSnapshot, r);
        return {
          ...t,
          undoStack: i ? rf([...t.undoStack, t.undoBatchSnapshot]) : t.undoStack,
          undoBatchDepth: 0,
          undoBatchSnapshot: null,
          undoBatchHasTrackedChanges: false
        };
      });
    },
    setTransformMode: e => {
      return i(t => {
        return {
          ...t,
          transformMode: e
        };
      });
    },
    setViewportAspectRatio: e => {
      return i(t => {
        return {
          ...t,
          viewportAspectRatio: e
        };
      });
    },
    setViewportRuleOfThirdsEnabled: e => {
      return i(t => {
        return {
          ...t,
          viewportRuleOfThirdsEnabled: e
        };
      });
    },
    toggleViewportPanelsCollapsed: () => {
      return i(e => {
        return {
          ...e,
          viewportPanelsCollapsed: !e.viewportPanelsCollapsed
        };
      });
    },
    setViewportPanelsCollapsed: e => {
      return i(t => {
        return {
          ...t,
          viewportPanelsCollapsed: e
        };
      });
    },
    setViewMode: e => {
      return i(t => {
        return {
          ...t,
          viewMode: e,
          project: {
            ...t.project,
            activeCameraId: e === `camera` ? t.project.activeCameraId ?? t.project.cameras[0]?.id ?? null : t.project.activeCameraId
          }
        };
      });
    },
    selectObject: e => {
      return i(t => {
        let n = t.project.objects.find(t => {
          return t.id === e;
        });
        return {
          ...t,
          selectedObjectId: e,
          selectedObjectIds: e ? [e] : [],
          selectedCrowdId: null,
          directorInspectorMode: `auto`,
          project: {
            ...t.project,
            activeCameraId: n?.kind === `camera` && n.linkedCameraId ? n.linkedCameraId : t.project.activeCameraId
          }
        };
      });
    },
    selectCrowd: e => {
      return i(t => {
        if (!e) {
          return {
            ...t,
            selectedCrowdId: null,
            selectedObjectId: null,
            selectedObjectIds: []
          };
        }
        let n = Kd(t.project.objects, e);
        if (n.length) {
          return {
            ...t,
            selectedCrowdId: e,
            selectedObjectId: n[n.length - 1] ?? null,
            selectedObjectIds: n,
            directorInspectorMode: `auto`
          };
        } else {
          return t;
        }
      });
    },
    toggleObjectSelection: e => {
      return i(t => {
        let n = t.project.objects.find(t => {
          return t.id === e;
        });
        if (!n) {
          return t;
        }
        let r = Xd(t);
        let i = r.includes(e) ? r.filter(t => {
          return t !== e;
        }) : [...r, e];
        let a = i[i.length - 1] ?? null;
        return {
          ...t,
          selectedObjectId: a,
          selectedObjectIds: i,
          selectedCrowdId: null,
          directorInspectorMode: `auto`,
          project: {
            ...t.project,
            activeCameraId: n.kind === `camera` && n.linkedCameraId ? n.linkedCameraId : t.project.activeCameraId
          }
        };
      });
    },
    openSceneInspector: () => {
      return i(e => {
        return {
          ...e,
          directorInspectorMode: `scene`,
          selectedObjectId: null,
          selectedObjectIds: [],
          selectedCrowdId: null
        };
      });
    },
    updateScene: e => {
      return r(t => {
        return {
          ...t,
          project: {
            ...t.project,
            scene: {
              ...t.project.scene,
              ...e
            }
          }
        };
      });
    },
    removePanoramaAsset: () => {
      return r(e => {
        let t = e.project.panoramaAssetId;
        if (t) {
          return {
            ...e,
            project: {
              ...e.project,
              assets: e.project.assets.filter(e => {
                return e.id !== t;
              }),
              panoramaAssetId: null
            }
          };
        } else {
          return e;
        }
      });
    },
    removeImportedAsset: e => {
      return r(t => {
        let n = t.project.assets.find(t => {
          return t.id === e;
        });
        if (!n || n.sourceType !== `model`) {
          return t;
        }
        yd(e);
        let r = new Set(t.project.objects.filter(t => {
          return t.assetRefId === e;
        }).map(e => {
          return e.id;
        }));
        let i = t.project.objects.filter(t => {
          return t.assetRefId !== e;
        });
        let a = t.project.cameras.map(e => {
          if (e.targetObjectId && r.has(e.targetObjectId)) {
            return {
              ...e,
              targetMode: `manual`,
              targetObjectId: null
            };
          } else {
            return e;
          }
        });
        let o = t.selectedObjectIds.filter(e => {
          return !r.has(e);
        });
        let s = t.selectedObjectId && r.has(t.selectedObjectId) ? o[o.length - 1] ?? null : t.selectedObjectId;
        return {
          ...t,
          selectedObjectId: s,
          selectedObjectIds: o,
          selectedCrowdId: null,
          project: {
            ...t.project,
            assets: t.project.assets.filter(t => {
              return t.id !== e;
            }),
            objects: i,
            cameras: a
          }
        };
      });
    },
    updateObjectTransform: (e, t) => {
      return r(n => {
        let r = n.project.objects.find(t => {
          return t.id === e;
        });
        let i = r ? {
          position: t.position ?? r.transform.position,
          rotation: t.rotation ?? r.transform.rotation,
          scale: t.scale ?? r.transform.scale
        } : null;
        let a = r && i ? {
          ...r,
          transform: i
        } : null;
        return {
          ...n,
          project: {
            ...n.project,
            objects: jd(n.project.objects, e, e => {
              return {
                ...e,
                transform: {
                  position: t.position ?? e.transform.position,
                  rotation: t.rotation ?? e.transform.rotation,
                  scale: t.scale ?? e.transform.scale
                }
              };
            }),
            cameras: r?.kind === `camera` && r.linkedCameraId && i ? n.project.cameras.map(e => {
              if (e.id === r.linkedCameraId) {
                return {
                  ...e,
                  transform: i
                };
              } else {
                return e;
              }
            }) : a ? Ud(n.project.cameras, a) : n.project.cameras
          }
        };
      });
    },
    updateCrowdTransform: (e, t) => {
      return r(n => {
        let r = Yd(n.project.objects, e, t);
        if (r.changedObjectIds.length === 0) {
          return n;
        } else {
          return {
            ...n,
            project: {
              ...n.project,
              objects: r.objects,
              cameras: Wd(n.project.cameras, r.objects, r.changedObjectIds)
            }
          };
        }
      });
    },
    updateObjectName: (e, t) => {
      return r(n => {
        return {
          ...n,
          project: {
            ...n.project,
            objects: jd(n.project.objects, e, e => {
              return {
                ...e,
                name: t
              };
            })
          }
        };
      });
    },
    updateCrowdLabel: (e, t) => {
      return r(n => {
        return {
          ...n,
          project: {
            ...n.project,
            objects: n.project.objects.map(n => {
              if (n.kind === `character` && n.crowdId === e) {
                return {
                  ...n,
                  crowdLabel: t
                };
              } else {
                return n;
              }
            })
          }
        };
      });
    },
    updateObjectColor: (e, t) => {
      return r(n => {
        return {
          ...n,
          project: {
            ...n.project,
            objects: jd(n.project.objects, e, e => {
              return {
                ...e,
                color: t
              };
            })
          }
        };
      });
    },
    updateCrowdColor: (e, t) => {
      return r(n => {
        return {
          ...n,
          project: {
            ...n.project,
            objects: n.project.objects.map(n => {
              if (n.kind === `character` && n.crowdId === e) {
                return {
                  ...n,
                  color: t
                };
              } else {
                return n;
              }
            })
          }
        };
      });
    },
    updateCharacterBodyType: (e, t) => {
      return r(n => {
        let r = au(t);
        let i = n.project.objects.find(t => {
          return t.id === e;
        });
        let a = i?.kind === `character` ? {
          ...i,
          bodyType: r
        } : null;
        return {
          ...n,
          project: {
            ...n.project,
            objects: jd(n.project.objects, e, e => {
              if (e.kind === `character`) {
                return {
                  ...e,
                  bodyType: r
                };
              } else {
                return e;
              }
            }),
            cameras: a ? Ud(n.project.cameras, a) : n.project.cameras
          }
        };
      });
    },
    updateUniformScale: (e, t) => {
      return r(n => {
        let r = n.project.objects.find(t => {
          return t.id === e;
        });
        let i = r ? {
          ...r,
          transform: {
            ...r.transform,
            scale: [t, t, t]
          }
        } : null;
        return {
          ...n,
          project: {
            ...n.project,
            objects: jd(n.project.objects, e, e => {
              return {
                ...e,
                transform: {
                  ...e.transform,
                  scale: [t, t, t]
                }
              };
            }),
            cameras: i ? Ud(n.project.cameras, i) : n.project.cameras
          }
        };
      });
    },
    updateCrowdUniformScale: (e, t) => {
      return r(n => {
        let r = Yd(n.project.objects, e, {
          scale: [t, t, t]
        });
        if (r.changedObjectIds.length === 0) {
          return n;
        } else {
          return {
            ...n,
            project: {
              ...n.project,
              objects: r.objects,
              cameras: Wd(n.project.cameras, r.objects, r.changedObjectIds)
            }
          };
        }
      });
    },
    addImportedAsset: e => {
      return r(t => {
        let n = fd(t.project.assets.map(e => {
          return e.id;
        }), `asset_`, t.project.assets.length + 1);
        let r = {
          id: n,
          kind: e.kind,
          sourceType: e.kind === `panorama` ? `image` : `model`,
          fileName: e.fileName,
          name: e.name,
          url: e.url,
          assetSource: e.kind === `panorama` ? undefined : e.assetSource ?? `local`,
          projectionMode: e.projectionMode
        };
        if (e.kind === `panorama`) {
          return {
            ...t,
            directorInspectorMode: `scene`,
            selectedObjectId: null,
            selectedObjectIds: [],
            selectedCrowdId: null,
            project: {
              ...t.project,
              assets: [...t.project.assets, r],
              panoramaAssetId: n
            }
          };
        }
        if (e.addToScene === false) {
          vd(r);
          return {
            ...t,
            project: {
              ...t.project,
              assets: [...t.project.assets, r]
            }
          };
        }
        let i = Hd(r, t.project.objects);
        return {
          ...t,
          selectedObjectId: i.id,
          selectedObjectIds: [i.id],
          selectedCrowdId: null,
          directorInspectorMode: `auto`,
          project: {
            ...t.project,
            assets: [...t.project.assets, r],
            objects: [...t.project.objects, i]
          }
        };
      });
    },
    addObjectFromAsset: e => {
      let t = null;
      r(n => {
        let r = n.project.assets.find(t => {
          return t.id === e;
        });
        if (!r || r.sourceType !== `model` || r.kind === `panorama`) {
          return n;
        }
        let i = Hd(r, n.project.objects);
        t = i.id;
        return {
          ...n,
          selectedObjectId: i.id,
          selectedObjectIds: [i.id],
          selectedCrowdId: null,
          directorInspectorMode: `auto`,
          project: {
            ...n.project,
            objects: [...n.project.objects, i]
          }
        };
      });
      return t;
    },
    addPresetCharacter: (e = eu) => {
      return r(t => {
        let n = t.project.objects.filter(e => {
          return e.kind === `character` && e.id.startsWith(`char_preset_`);
        }).length + 1;
        let r = Math.floor((n - 1) / 4);
        let i = Rd(t, e, [Pd(n - r * 4), 0, r * 0.8]);
        return {
          ...t,
          selectedObjectId: i.id,
          selectedObjectIds: [i.id],
          selectedCrowdId: null,
          directorInspectorMode: `auto`,
          project: {
            ...t.project,
            objects: [...t.project.objects, i]
          }
        };
      });
    },
    addCrowdCharacters: ({
      bodyType: e = eu,
      rows: t,
      columns: n,
      spacing: i
    }) => {
      let a = [];
      r(r => {
        let o = Fd(t, n, i);
        let s = Id(r.project.objects, i);
        let c = [...r.project.objects];
        let l = Ld(t, n);
        let u = Jd(r.project.objects);
        o.forEach(t => {
          let n = Rd({
            ...r,
            project: {
              ...r.project,
              objects: c
            }
          }, e, [Number((t[0] + s[0]).toFixed(4)), Number((t[1] + s[1]).toFixed(4)), Number((t[2] + s[2]).toFixed(4))], {
            crowdId: u,
            crowdLabel: l
          });
          c.push(n);
          a.push(n.id);
        });
        if (a.length) {
          return {
            ...r,
            selectedObjectId: a[a.length - 1] ?? null,
            selectedObjectIds: a,
            selectedCrowdId: u,
            directorInspectorMode: `auto`,
            project: {
              ...r.project,
              objects: c
            }
          };
        } else {
          return r;
        }
      });
      return a;
    },
    addGeometryPrimitive: e => {
      return r(t => {
        let n = t.project.objects.filter(e => {
          return e.kind === `prop` && e.geometryType;
        });
        let r = n.length + 1;
        let i = n.filter(t => {
          return t.geometryType === e;
        }).length;
        let a = Math.floor((r - 1) / 4);
        let o = (r - 1) % 4 * 1.15 - 1.725;
        let s = a * 0.75 + 1.15;
        let c = Nd(e);
        let l = fd(t.project.objects.map(e => {
          return e.id;
        }), `geo_${e}_`, r);
        let u = {
          id: l,
          name: i === 0 ? c : `${c}${String(i + 1).padStart(2, `0`)}`,
          kind: `prop`,
          visible: true,
          locked: false,
          geometryType: e,
          color: Yu,
          transform: cd([o, 0, s])
        };
        return {
          ...t,
          selectedObjectId: l,
          selectedObjectIds: [l],
          selectedCrowdId: null,
          directorInspectorMode: `auto`,
          project: {
            ...t.project,
            objects: [...t.project.objects, u]
          }
        };
      });
    },
    addDirectorObject: e => {
      return r(t => {
        return {
          ...t,
          selectedObjectId: e.id,
          selectedObjectIds: [e.id],
          selectedCrowdId: null,
          directorInspectorMode: `auto`,
          project: {
            ...t.project,
            objects: [...t.project.objects, e]
          }
        };
      });
    },
    addCameraShot: e => {
      let t = ``;
      r(n => {
        let r = n.project.cameras.length + 1;
        let i = fd(n.project.cameras.map(e => {
          return e.id;
        }), `cam_`, r);
        let a = fd(n.project.objects.map(e => {
          return e.id;
        }), `cam_object_`, r);
        t = i;
        let o = cd(e ? Ku(e) : [r * 1.2, 2.2, 9]);
        let s = {
          id: i,
          name: dd(`机位`, r),
          fov: e?.fov ?? 50,
          transform: o,
          targetMode: `manual`,
          target: e?.target ?? [0, 1.2, 0],
          lastCaptureUrl: null,
          captures: []
        };
        let c = {
          id: a,
          name: s.name,
          kind: `camera`,
          visible: true,
          locked: false,
          linkedCameraId: i,
          transform: o
        };
        return {
          ...n,
          selectedObjectId: a,
          selectedObjectIds: [a],
          selectedCrowdId: null,
          directorInspectorMode: `auto`,
          project: {
            ...n.project,
            cameras: [...n.project.cameras, s],
            activeCameraId: i,
            objects: [...n.project.objects, c]
          }
        };
      });
      return t;
    },
    deleteSelectedObject: () => {
      return r(e => {
        let t = Xd(e);
        if (!t.length) {
          return e;
        }
        let n = e.project.objects.filter(e => {
          return t.includes(e.id);
        });
        if (!n.length) {
          return {
            ...e,
            selectedObjectId: null,
            selectedObjectIds: []
          };
        }
        let r = new Set(n.filter(e => {
          return e.kind === `camera` && e.linkedCameraId;
        }).map(e => {
          return e.linkedCameraId;
        }));
        let i = r.size ? e.project.cameras.filter(e => {
          return !r.has(e.id);
        }) : e.project.cameras;
        let a = new Set(t);
        let o = i.map(e => {
          if (e.targetObjectId && a.has(e.targetObjectId)) {
            return {
              ...e,
              targetMode: `manual`,
              targetObjectId: null
            };
          } else {
            return e;
          }
        });
        let s = e.project.activeCameraId && r.has(e.project.activeCameraId) ? o[0]?.id ?? null : e.project.activeCameraId;
        let c = e.project.objects.filter(e => {
          return !t.includes(e.id);
        });
        let l = new Map(e.project.assets.map(e => {
          return [e.id, e];
        }));
        let u = new Set(c.map(e => {
          return e.assetRefId;
        }).filter(e => {
          return !!e;
        }));
        let d = new Set(n.map(e => {
          return e.assetRefId;
        }).filter(e => {
          if (typeof e != `string` || u.has(e)) {
            return false;
          } else {
            return l.get(e)?.assetSource !== `local`;
          }
        }));
        return {
          ...e,
          selectedObjectId: null,
          selectedObjectIds: [],
          selectedCrowdId: null,
          directorInspectorMode: `auto`,
          project: {
            ...e.project,
            assets: e.project.assets.filter(e => {
              return !d.has(e.id);
            }),
            objects: c,
            cameras: o,
            activeCameraId: s
          }
        };
      });
    },
    toggleObjectVisible: e => {
      return r(t => {
        return {
          ...t,
          project: {
            ...t.project,
            objects: jd(t.project.objects, e, e => {
              return {
                ...e,
                visible: !e.visible
              };
            })
          }
        };
      });
    },
    toggleObjectLocked: e => {
      return r(t => {
        return {
          ...t,
          project: {
            ...t.project,
            objects: jd(t.project.objects, e, e => {
              return {
                ...e,
                locked: !e.locked
              };
            })
          }
        };
      });
    },
    applyPosePreset: (e, t) => {
      return r(n => {
        let r = Ql.find(e => {
          return e.id === t;
        });
        return {
          ...n,
          project: {
            ...n.project,
            objects: jd(n.project.objects, e, e => {
              return {
                ...e,
                characterRig: e.characterRig ? {
                  ...e.characterRig,
                  posePresetId: t,
                  controls: r ? {
                    ...r.controls
                  } : e.characterRig.controls
                } : e.characterRig
              };
            })
          }
        };
      });
    },
    applyCrowdPosePreset: (e, t) => {
      return r(n => {
        let r = Ql.find(e => {
          return e.id === t;
        });
        return {
          ...n,
          project: {
            ...n.project,
            objects: n.project.objects.map(n => {
              if (n.kind === `character` && n.crowdId === e) {
                return {
                  ...n,
                  characterRig: n.characterRig ? {
                    ...n.characterRig,
                    posePresetId: t,
                    controls: r ? {
                      ...r.controls
                    } : n.characterRig.controls
                  } : n.characterRig
                };
              } else {
                return n;
              }
            })
          }
        };
      });
    },
    updatePoseControl: (e, t, n) => {
      return r(r => {
        return {
          ...r,
          project: {
            ...r.project,
            objects: jd(r.project.objects, e, e => {
              return {
                ...e,
                characterRig: e.characterRig ? {
                  ...e.characterRig,
                  controls: {
                    ...e.characterRig.controls,
                    [t]: n
                  }
                } : e.characterRig
              };
            })
          }
        };
      });
    },
    updateCrowdPoseControl: (e, t, n) => {
      return r(r => {
        return {
          ...r,
          project: {
            ...r.project,
            objects: r.project.objects.map(r => {
              if (r.kind === `character` && r.crowdId === e) {
                return {
                  ...r,
                  characterRig: r.characterRig ? {
                    ...r.characterRig,
                    controls: {
                      ...r.characterRig.controls,
                      [t]: n
                    }
                  } : r.characterRig
                };
              } else {
                return r;
              }
            })
          }
        };
      });
    },
    setActiveCamera: e => {
      return i(t => {
        let n = t.project.objects.find(t => {
          return t.kind === `camera` && t.linkedCameraId === e;
        })?.id ?? null;
        return {
          ...t,
          project: {
            ...t.project,
            activeCameraId: e
          },
          selectedObjectId: n,
          selectedObjectIds: n ? [n] : [],
          selectedCrowdId: null
        };
      });
    },
    addCameraCaptures: (e, t) => {
      return r(n => {
        if (t.length === 0) {
          return n;
        }
        let r = e ?? n.project.activeCameraId ?? n.project.cameras[0]?.id ?? null;
        if (!r) {
          return n;
        }
        let i = false;
        let a = n.project.cameras.map(e => {
          if (e.id !== r) {
            return e;
          }
          i = true;
          let n = Bd(e, t);
          return {
            ...e,
            lastCaptureUrl: n[n.length - 1]?.dataUrl ?? e.lastCaptureUrl ?? null,
            captures: [...(e.captures ?? []), ...n]
          };
        });
        if (i) {
          return {
            ...n,
            project: {
              ...n.project,
              cameras: a
            }
          };
        } else {
          return n;
        }
      });
    },
    updateCamera: (e, t) => {
      return r(n => {
        return {
          ...n,
          project: {
            ...n.project,
            cameras: n.project.cameras.map(n => {
              if (n.id === e) {
                return {
                  ...n,
                  ...t,
                  transform: t.transform ?? n.transform,
                  target: t.target ?? n.target
                };
              } else {
                return n;
              }
            }),
            objects: n.project.objects.map(n => {
              if (n.kind === `camera` && n.linkedCameraId === e && t.transform) {
                return {
                  ...n,
                  transform: t.transform
                };
              } else {
                return n;
              }
            })
          }
        };
      });
    },
    copySelectedObjects: () => {
      let n = t();
      let r = ef(n);
      e({
        ...n,
        clipboard: r,
        clipboardPasteCount: 0
      });
    },
    pasteClipboardObjects: () => {
      return r(e => {
        return tf(e);
      });
    },
    undo: () => {
      let n = t();
      let r = n.undoStack[n.undoStack.length - 1];
      if (r) {
        e({
          ...Dd(r),
          clipboard: n.clipboard,
          clipboardPasteCount: n.clipboardPasteCount,
          undoStack: n.undoStack.slice(0, -1)
        });
        wd(r);
      }
    },
    openScopedScene: n => {
      let r = t();
      sd(n);
      let i = Ad({
        includePersistedLocalAssets: true,
        includePersistedScene: true,
        persistenceScopeId: ad
      });
      e({
        ...Dd(i),
        clipboard: r.clipboard,
        clipboardPasteCount: r.clipboardPasteCount,
        undoStack: []
      });
      wd(i);
    },
    replaceProject: e => {
      return r(t => {
        return {
          ...t,
          project: hd(e),
          selectedObjectId: null,
          selectedObjectIds: [],
          selectedCrowdId: null,
          directorInspectorMode: `auto`
        };
      });
    },
    saveLatestSnapshot: () => {
      wd(Cd(t()));
    },
    restoreLatestSnapshot: () => {
      let n = Ed({
        includePersistedLocalAssets: true,
        includePersistedScene: true
      });
      if (n) {
        e({
          ...Dd(n),
          clipboard: t().clipboard,
          clipboardPasteCount: t().clipboardPasteCount,
          undoStack: []
        });
        wd(n);
      }
    }
  };
});
var af = [{
  key: `characters`,
  title: `角色`
}, {
  key: `crowd`,
  title: `群众`
}, {
  key: `geometry`,
  title: `几何体`
}, {
  key: `my-models`,
  title: `我的模型`
}, {
  key: `cameras`,
  title: `摄像机`
}];
function cf(e) {
  if (e.viewMode === `director` && e.directorInspectorMode === `scene`) {
    return `scene`;
  }
  if (e.selectedCrowdId) {
    return `character`;
  }
  let t = e.project.objects.find(t => {
    return t.id === e.selectedObjectId;
  });
  let n = t?.assetRefId ? e.project.assets.find(e => {
    return e.id === t.assetRefId;
  }) : undefined;
  if (t?.kind === `character`) {
    return `character`;
  } else if (t?.kind === `prop` || n?.sourceType === `model`) {
    return `prop`;
  } else if (t?.kind === `camera` || e.viewMode === `camera`) {
    return `camera`;
  } else {
    return `scene`;
  }
}
var lf = 10;
function uf(e) {
  let t = Number(e);
  if (Number.isFinite(t)) {
    return t;
  } else {
    return null;
  }
}
function df(e) {
  let t = uf(e);
  if (t && t > 0) {
    return t;
  } else {
    return 1;
  }
}
function ff(e) {
  let t = String(e ?? ``).match(/\.(\d+)/);
  if (t) {
    return t[1].length;
  } else {
    return 0;
  }
}
function pf(e, t, n) {
  let r = uf(t);
  let i = uf(n);
  let a = r === null ? e : Math.max(r, e);
  if (i === null) {
    return a;
  } else {
    return Math.min(i, a);
  }
}
function mf(e, t) {
  return Number(e.toFixed(Math.min(t, 6))).toString();
}
function hf(e) {
  return Z.Children.toArray(e).map(e => {
    if (typeof e == `string` || typeof e == `number`) {
      return String(e);
    } else {
      return ``;
    }
  }).join(``).trim();
}
function gf(e) {
  return Z.Children.toArray(e).flatMap(e => {
    if (!Z.isValidElement(e)) {
      return [];
    }
    let t = e.props.value;
    if (t == null) {
      return [];
    } else {
      return [{
        value: String(t),
        label: hf(e.props.children) || String(t),
        disabled: e.props.disabled
      }];
    }
  });
}
function _f() {
  let e = $(e => {
    return e.beginUndoBatch;
  });
  let t = $(e => {
    return e.endUndoBatch;
  });
  let n = Z.useRef(false);
  let r = Z.useCallback(() => {
    if (!n.current) {
      n.current = true;
      e();
    }
  }, [e]);
  let i = Z.useCallback(() => {
    if (n.current) {
      n.current = false;
      t();
    }
  }, [t]);
  Z.useEffect(() => {
    return i;
  }, [i]);
  return {
    beginInteraction: r,
    endInteraction: i
  };
}
var Ef = null;
function Df(e) {
  Ef = e;
}
function Of() {
  Ef = null;
}
async function kf(e) {
  if (!Ef) {
    throw Error(`Viewport capture handler is not registered`);
  }
  return Ef(e);
}
function Af(e) {
  return e;
}
function Mf(e) {
  if (typeof e == `string`) {
    return e.trim();
  } else {
    return ``;
  }
}
function Nf() {
  return window.location.origin;
}
function Pf(e) {
  let t = e.map((e, t) => {
    let n = Mf(e.dataUrl);
    if (n) {
      return {
        dataUrl: n,
        fileName: Mf(e.fileName) || `director-desk-capture-${t + 1}.png`
      };
    } else {
      return null;
    }
  }).filter(e => {
    return !!e;
  });
  if (t.length !== 0) {
    window.parent?.postMessage({
      type: `storyai:director-desk-captures-sent`,
      payload: {
        captures: t
      }
    }, Nf());
  }
}
var Ff = 0.25;
var If = 5;
var Lf = 0.25;
function Rf(e, t, n) {
  return e.map((e, r) => {
    if (r === t) {
      return n;
    } else {
      return e;
    }
  });
}
function Bf(e, t, n) {
  return e.map((e, r) => {
    if (r === t) {
      return n;
    } else {
      return e;
    }
  });
}
function Hf(e, t, n) {
  return e.map((e, r) => {
    if (r === t) {
      return n;
    } else {
      return e;
    }
  });
}
var Wf = 10;
var Gf = 300;
var Kf = -180;
var qf = 180;
var Jf = 0.1;
var Yf = 3;
var Xf = -5;
var Zf = 5;
function Qf(e, t, n) {
  return e.map((e, r) => {
    if (r === t) {
      return n;
    } else {
      return e;
    }
  });
}
function $f(e, t, n) {
  return Math.min(n, Math.max(t, e));
}
var rp = 0.18;
function fp(e, t) {
  let n = uu(t);
  return Math.min(n, Math.max(-n, e));
}
function pp(e, t, n) {
  return [cu(fp(e[`${t}.pitch`] ?? 0, n)), cu(fp(e[`${t}.twist`] ?? 0, n)), cu(fp(e[`${t}.spread`] ?? 0, n))];
}
function gp(e) {
  return `isBone` in e && e.isBone === true;
}
function _p(e, t) {
  e.quaternion.multiply(new Tt().setFromEuler(new ge(t[0], t[1], t[2])));
}
function vp(e) {
  let t = {};
  e.traverse(e => {
    if (gp(e)) {
      t[e.name] = {
        position: [e.position.x, e.position.y, e.position.z],
        quaternion: [e.quaternion.x, e.quaternion.y, e.quaternion.z, e.quaternion.w],
        scale: [e.scale.x, e.scale.y, e.scale.z]
      };
    }
  });
  return t;
}
function yp(e, {
  bodyType: t = `mannequin`,
  controls: n,
  restPose: r
}) {
  let i = ku(t);
  let a = Au(n);
  let o = Ou();
  let s = ju(n, t);
  e.traverse(e => {
    if (!gp(e)) {
      return;
    }
    let t = r[e.name];
    if (!t) {
      return;
    }
    e.position.set(t.position[0], t.position[1], t.position[2]);
    e.quaternion.set(t.quaternion[0], t.quaternion[1], t.quaternion[2], t.quaternion[3]);
    e.scale.set(t.scale[0], t.scale[1], t.scale[2]);
    let n = a[e.name];
    if (n) {
      e.position.set(t.position[0] + n[0], t.position[1] + n[1], t.position[2] + n[2]);
    }
    let c = i[e.name];
    if (c) {
      e.scale.set(t.scale[0] * c[0], t.scale[1] * c[1], t.scale[2] * c[2]);
    }
    let l = o[e.name];
    if (l) {
      _p(e, l);
    }
    let u = s[e.name];
    if (u) {
      _p(e, u);
    }
  });
}
function bp(e) {
  return `isSkinnedMesh` in e && e.isSkinnedMesh === true;
}
function xp(e, t) {
  let n = Array.isArray(e) ? e : [e];
  let r = new bn(t);
  n.forEach(e => {
    if (e instanceof h && e.name !== `SK_Mannequin_M_UE4Man_ChestLogo`) {
      e.color.copy(r);
      e.roughness = 0.68;
      e.metalness = 0.04;
      e.needsUpdate = true;
    }
  });
}
function Sp(e) {
  if (Array.isArray(e)) {
    return e.map(e => {
      return e.clone();
    });
  } else {
    return e.clone();
  }
}
function Cp(e, t) {
  e.traverse(e => {
    e.frustumCulled = false;
    if (bp(e)) {
      e.castShadow = true;
      e.receiveShadow = true;
      if (!e.userData.storyAiIsolatedMaterial) {
        e.material = Sp(e.material);
        e.userData.storyAiIsolatedMaterial = true;
      }
      xp(e.material, t);
    }
  });
}
function wp(e) {
  (e.parent ?? e).updateMatrixWorld(true);
  let t = new wn().setFromObject(e, true);
  if (!e.parent || t.isEmpty()) {
    return t;
  }
  let n = new y().copy(e.parent.matrixWorld).invert();
  let r = new wn().makeEmpty();
  let i = new W();
  let a = [t.min.x, t.max.x];
  let o = [t.min.y, t.max.y];
  let s = [t.min.z, t.max.z];
  a.forEach(e => {
    o.forEach(t => {
      s.forEach(a => {
        i.set(e, t, a).applyMatrix4(n);
        r.expandByPoint(i);
      });
    });
  });
  return r;
}
function Tp(e) {
  let t = e.position.x;
  let n = e.position.z;
  function r() {
    return wp(e);
  }
  e.position.set(t, 0, n);
  for (let i = 0; i < 5; i += 1) {
    let i = r();
    let a = i.isEmpty() || !Number.isFinite(i.min.y) ? 0 : -i.min.y;
    if (Math.abs(a) < 0.00001) {
      break;
    }
    e.position.set(t, e.position.y + a, n);
  }
  e.position.set(t, e.position.y, n);
  (e.parent ?? e).updateMatrixWorld(true);
  return e.position.y;
}
var Dp = class extends Z.Component {
  state = {
    hasError: false
  };
  static getDerivedStateFromError() {
    return {
      hasError: true
    };
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    } else {
      return this.props.children;
    }
  }
};
var kp = 90;
var Ap = 0.1;
function jp(e) {
  return (e + kp) * Math.PI / 180;
}
function Mp(e, t) {
  if (t) {
    return Math.min(e, Ap);
  } else {
    return e;
  }
}
var Np = `#A9D8FF`;
var Pp = 0.92;
var Fp = 0.06;
var Ip = new W(0, 0, 1);
var Lp = new W(0, 1, 0);
var Rp = `hideFromViewportCapture`;
var zp = [0, 0, zu * -0.52];
var Bp = [zu * 0.4, zu * 0.4, zu * 1];
var Vp = zp[2] + Bp[2] / 2;
var Hp = [0, 0, zu * 0.2];
var Up = 3;
var Wp = 2;
function Gp(e) {
  return {
    position: [...e.position],
    rotation: [...e.rotation],
    scale: [...e.scale]
  };
}
function Jp(e, t) {
  let n = new W(...e);
  let r = new W(...t).sub(n);
  if (r.lengthSq() === 0) {
    return new Tt();
  }
  let i = r.normalize();
  let a = Math.abs(i.dot(Lp)) > 0.999 ? new W(0, 0, 1) : Lp;
  let o = new y().lookAt(n, n.clone().sub(i), a);
  return new Tt().setFromRotationMatrix(o);
}
function Yp() {
  let e = am().flatMap(e => {
    return e.points;
  });
  return Math.max(...e.map(e => {
    return e[1];
  })) + rp;
}
function Xp(e, t = Wp) {
  if (e.isEmpty()) {
    return {
      position: [0, 0, 0],
      scale: 1
    };
  }
  let n = new W();
  let r = new W();
  e.getSize(n);
  e.getCenter(r);
  let i = Math.max(n.x, n.y, n.z);
  let a = Number.isFinite(i) && i > 0 ? t / i : 1;
  return {
    position: [-r.x * a, -r.y * a, -r.z * a],
    scale: a
  };
}
function Zp(e) {
  let [t, n, r] = e.position;
  let [i, a, o] = e.scale;
  let s = e.args;
  let c = 1;
  let l = 1;
  let u = 1;
  if (e.geometryType === `sphere`) {
    let e = s?.[0] ?? 0.5;
    c = e * 2;
    l = e * 2;
    u = e * 2;
  } else if (e.geometryType === `cylinder`) {
    let e = Math.max(s?.[0] ?? 0.45, s?.[1] ?? 0.45);
    c = e * 2;
    l = s?.[2] ?? 1;
    u = e * 2;
  } else if (e.geometryType === `torus`) {
    let e = s?.[0] ?? 0.45;
    let t = s?.[1] ?? 0.14;
    c = (e + t) * 2;
    l = t * 2;
    u = (e + t) * 2;
  } else if (e.geometryType === `cone` || e.geometryType === `pyramid`) {
    let e = s?.[0] ?? 0.5;
    c = e * 2;
    l = s?.[1] ?? 1;
    u = e * 2;
  } else {
    c = s?.[0] ?? 1;
    l = s?.[1] ?? 1;
    u = s?.[2] ?? 1;
  }
  let d = Math.abs(c * i) / 2;
  let f = Math.abs(l * a) / 2;
  let p = Math.abs(u * o) / 2;
  return {
    minX: t - d,
    maxX: t + d,
    minY: n - f,
    maxY: n + f,
    minZ: r - p,
    maxZ: r + p
  };
}
function Qp(e) {
  if (!e.length) {
    return [0, 0, 0];
  }
  let t = Infinity;
  let n = -Infinity;
  let r = Infinity;
  let i = -Infinity;
  let a = Infinity;
  let o = -Infinity;
  e.forEach(e => {
    let s = Zp(e);
    t = Math.min(t, s.minX);
    n = Math.max(n, s.maxX);
    r = Math.min(r, s.minY);
    i = Math.max(i, s.maxY);
    a = Math.min(a, s.minZ);
    o = Math.max(o, s.maxZ);
  });
  if ([t, n, r, i, a, o].every(Number.isFinite)) {
    return [(t + n) / 2, (r + i) / 2, (a + o) / 2];
  } else {
    return [0, 0, 0];
  }
}
function $p(e) {
  if (!e.length) {
    return null;
  }
  let t = e.reduce((e, t) => {
    e[0] += t.transform.position[0];
    e[1] += t.transform.position[1];
    e[2] += t.transform.position[2];
    return e;
  }, [0, 0, 0]);
  let n = e.length;
  let r = e[0];
  return {
    position: [t[0] / n, t[1] / n, t[2] / n],
    rotation: [...r.transform.rotation],
    scale: [...r.transform.scale]
  };
}
function em(e, t, n, r) {
  let i = new Set(t);
  let a = e.filter(e => {
    return i.has(e.id);
  });
  let o = r ?? $p(a);
  if (!o) {
    return e;
  }
  let s = n.position ?? o.position;
  let c = n.rotation ?? o.rotation;
  let l = n.scale ?? o.scale;
  let u = [c[0] - o.rotation[0], c[1] - o.rotation[1], c[2] - o.rotation[2]];
  let d = [o.scale[0] === 0 ? 1 : l[0] / o.scale[0], o.scale[1] === 0 ? 1 : l[1] / o.scale[1], o.scale[2] === 0 ? 1 : l[2] / o.scale[2]];
  let f = Math.cos(u[0]);
  let p = Math.sin(u[0]);
  let m = Math.cos(u[1]);
  let h = Math.sin(u[1]);
  let g = Math.cos(u[2]);
  let _ = Math.sin(u[2]);
  return e.map(e => {
    if (!i.has(e.id)) {
      return e;
    }
    let t = (e.transform.position[0] - o.position[0]) * d[0];
    let n = (e.transform.position[1] - o.position[1]) * d[1];
    let r = (e.transform.position[2] - o.position[2]) * d[2];
    let a = t;
    let c = n * f - r * p;
    let l = n * p + r * f;
    let v = a * m + l * h;
    let y = c;
    let b = -a * h + l * m;
    let x = v * g - y * _;
    let S = v * _ + y * g;
    let C = b;
    return {
      ...e,
      transform: {
        position: [s[0] + x, s[1] + S, s[2] + C],
        rotation: [e.transform.rotation[0] + u[0], e.transform.rotation[1] + u[1], e.transform.rotation[2] + u[2]],
        scale: [e.transform.scale[0] * d[0], e.transform.scale[1] * d[1], e.transform.scale[2] * d[2]]
      }
    };
  });
}
function tm({
  center: e,
  size: t
}) {
  let [n, r, i] = e;
  let [a, o, s] = t;
  let c = n - a / 2;
  let l = n + a / 2;
  let u = r - o / 2;
  let d = r + o / 2;
  let f = i - s / 2;
  let p = i + s / 2;
  let m = {
    bbl: [c, u, f],
    bbr: [l, u, f],
    btl: [c, d, f],
    btr: [l, d, f],
    fbl: [c, u, p],
    fbr: [l, u, p],
    ftl: [c, d, p],
    ftr: [l, d, p]
  };
  return [[m.bbl, m.bbr], [m.bbr, m.btr], [m.btr, m.btl], [m.btl, m.bbl], [m.fbl, m.fbr], [m.fbr, m.ftr], [m.ftr, m.ftl], [m.ftl, m.fbl], [m.bbl, m.fbl], [m.bbr, m.fbr], [m.btr, m.ftr], [m.btl, m.ftl]];
}
function nm({
  center: e,
  radius: t,
  segments: n = 32,
  plane: r = `xy`
}) {
  let [i, a, o] = e;
  return Array.from({
    length: n + 1
  }, (e, s) => {
    let c = Math.PI * 2 * s / n;
    let l = Math.cos(c) * t;
    let u = Math.sin(c) * t;
    if (r === `xz`) {
      return [i + l, a, o + u];
    } else if (r === `yz`) {
      return [i, a + l, o + u];
    } else {
      return [i + l, a + u, o];
    }
  });
}
function rm() {
  let e = [zu * -0.1, zu * 0.1, Vp];
  let t = [zu * 0.1, zu * 0.1, Vp];
  let n = [zu * 0.1, zu * -0.1, Vp];
  let r = [zu * -0.1, zu * -0.1, Vp];
  let i = [zu * -0.25, zu * 0.2, Hp[2]];
  let a = [zu * 0.25, zu * 0.2, Hp[2]];
  let o = [zu * 0.25, zu * -0.2, Hp[2]];
  let s = [zu * -0.25, zu * -0.2, Hp[2]];
  return [[e, t, n, r, e], [i, a, o, s, i], [e, i], [t, a], [n, o], [r, s]];
}
function im(e, t) {
  return t.map(t => {
    return {
      part: e,
      points: t
    };
  });
}
function am() {
  return [...im(`body`, [...tm({
    center: zp,
    size: Bp
  })]), ...im(`lens`, rm()), ...im(`reel`, [nm({
    center: [0, zu * 0.44, zu * -0.78],
    radius: zu * 0.21,
    plane: `yz`
  }), nm({
    center: [0, zu * 0.44, zu * -0.34],
    radius: zu * 0.21,
    plane: `yz`
  })])];
}
function om() {
  let e = am().flatMap(e => {
    return e.points;
  });
  let t = Math.min(...e.map(e => {
    return e[0];
  }));
  let n = Math.max(...e.map(e => {
    return e[0];
  }));
  let r = Math.min(...e.map(e => {
    return e[1];
  }));
  let i = Math.max(...e.map(e => {
    return e[1];
  }));
  let a = Math.min(...e.map(e => {
    return e[2];
  }));
  let o = Math.max(...e.map(e => {
    return e[2];
  }));
  return {
    args: [n - t + Fp * 2, i - r + Fp * 2, o - a + Fp * 2],
    position: [(t + n) / 2, (r + i) / 2, (a + o) / 2]
  };
}
function vm(e) {
  let t = Bu;
  let n = Vu / 2;
  let r = Vu / Ru / 2;
  let i = [-n, r, t];
  let a = [n, r, t];
  let o = [n, -r, t];
  let s = [-n, -r, t];
  return [[Hp, i], [Hp, a], [Hp, o], [Hp, s], [i, a], [a, o], [o, s], [s, i]];
}
var xm = [{
  id: `auto`,
  label: `自动`,
  value: null
}, {
  id: `1:1`,
  label: `1:1`,
  value: 1
}, {
  id: `2:1`,
  label: `2:1`,
  value: 2
}, {
  id: `3:4`,
  label: `3:4`,
  value: 3 / 4
}, {
  id: `4:3`,
  label: `4:3`,
  value: 4 / 3
}, {
  id: `16:9`,
  label: `16:9`,
  value: 16 / 9
}, {
  id: `21:9`,
  label: `21:9`,
  value: 21 / 9
}, {
  id: `9:16`,
  label: `9:16`,
  value: 9 / 16
}];
function Sm(e) {
  return xm.find(t => {
    return t.id === e;
  })?.value ?? null;
}
function Cm(e, t, n, r, i = {
  left: 0,
  right: 0,
  top: 0,
  bottom: 0
}) {
  let a = 40 + i.left;
  let o = 40 + i.top;
  let s = Math.max(e - 40 - i.right, a);
  let c = Math.max(t - Math.max(r, 40) - i.bottom, o);
  let l = Math.max(s - a, 0);
  let u = Math.max(c - o, 0);
  if (l === 0 || u === 0) {
    return {
      width: 0,
      height: 0,
      left: (a + s) / 2,
      top: (o + c) / 2
    };
  }
  let d = l / u;
  let f = n >= d ? l : u * n;
  let p = n >= d ? l / n : u;
  return {
    width: f,
    height: p,
    left: a + (l - f) / 2,
    top: o + (u - p) / 2
  };
}
function wm(e, t, n, r = 40, i = {
  left: 0,
  right: 0,
  top: 0,
  bottom: 0
}) {
  let a = Sm(e);
  if (a) {
    return Cm(t, n, a, r, i);
  } else {
    return null;
  }
}
function Em(e, t = `equirectangular`) {
  e.colorSpace = xt;
  if (t === `equirectangular`) {
    e.mapping = 303;
    e.repeat.set(1, 1);
    e.offset.set(0, 0);
  } else {
    e.wrapS = Ge;
    e.wrapT = Ge;
    e.minFilter = d;
    e.magFilter = d;
    e.repeat.set(-1, 1);
    e.offset.set(1, 0);
  }
  e.needsUpdate = true;
  return e;
}
function Dm(e) {
  if (e instanceof Error) {
    return e;
  } else {
    return Error(`全景图纹理加载失败`);
  }
}
function Om(e, t) {
  let [n, r] = Z.useState({
    status: `idle`
  });
  Z.useEffect(() => {
    if (!e) {
      r({
        status: `idle`
      });
      return;
    }
    let n = false;
    r({
      status: `loading`
    });
    let i = null;
    try {
      i = new ae().load(e, e => {
        if (n) {
          e.dispose();
          return;
        }
        r({
          status: `ready`,
          texture: Em(e, t)
        });
      }, undefined, e => {
        if (!n) {
          r({
            status: `error`,
            error: Dm(e)
          });
        }
      });
    } catch (e) {
      r({
        status: `error`,
        error: Dm(e)
      });
    }
    return () => {
      n = true;
      i?.dispose();
    };
  }, [t, e]);
  return n;
}
var Am = null;
function jm(e) {
  Am = e;
}
async function Mm(e, t) {
  if (!Am) {
    throw Error(`模型生成处理器尚未注册（请从画布中打开导演台）`);
  }
  return Am(e, t);
}
var Pm = /\.(fbx|obj)$/i;
function Fm(e) {
  return new Promise((t, n) => {
    let r = new FileReader();
    r.addEventListener(`load`, () => {
      if (typeof r.result == `string`) {
        t(r.result);
        return;
      }
      n(Error(`模型文件读取失败`));
    });
    r.addEventListener(`error`, () => {
      return n(r.error ?? Error(`模型文件读取失败`));
    });
    r.readAsDataURL(e);
  });
}
async function Im(e) {
  if (!Pm.test(e.name)) {
    throw Error(`当前仅支持 FBX / OBJ 模型文件`);
  }
  return {
    id: crypto.randomUUID(),
    fileName: e.name,
    name: e.name.replace(Pm, ``),
    url: await Fm(e)
  };
}
var Lm = /\.(jpe?g|png|webp)$/i;
var Rm = 2;
var zm = 0.02;
var Bm = 2048;
var Vm = 4096;
var Hm = 0.035;
var Um = 32;
var Wm = 192;
var Gm = 0.16;
var Km = 48;
var qm = 220;
function Jm(e, t) {
  return Math.abs(e / t - Rm) <= zm;
}
function Ym(e, t, n) {
  return Math.min(n, Math.max(t, e));
}
function Xm(e) {
  let t = Math.round(e);
  if (t % 2 == 0) {
    return t;
  } else {
    return t + 1;
  }
}
function Zm(e, t, n, r) {
  let i = Math.max(n / e, r / t);
  let a = e * i;
  let o = t * i;
  return {
    x: (n - a) / 2,
    y: (r - o) / 2,
    width: a,
    height: o
  };
}
function Qm(e) {
  return Math.max(Um, Math.min(Wm, Math.round(e * Hm)));
}
function $m(e) {
  return Math.max(Km, Math.min(qm, Math.round(e * Gm)));
}
function eh(e, t, n) {
  let r = 0;
  let i = 0;
  let a = 0;
  let o = 0;
  for (let s = 0; s < t; s += 1) {
    let c = (n * t + s) * 4;
    r += e[c] ?? 0;
    i += e[c + 1] ?? 0;
    a += e[c + 2] ?? 0;
    o += e[c + 3] ?? 0;
  }
  return [Math.round(r / t), Math.round(i / t), Math.round(a / t), Math.round(o / t)];
}
function th(e, t, n, r) {
  let i = new Uint8ClampedArray(e);
  let a = Math.max(1, r - 1);
  for (let o = 0; o < n; o += 1) {
    for (let n = 0; n < r; n += 1) {
      let r = (o * t + n) * 4;
      let s = (o * t + (t - 1 - n)) * 4;
      let c = n / a;
      for (let t = 0; t < 4; t += 1) {
        let n = e[r + t] ?? 0;
        let a = e[s + t] ?? 0;
        let o = Math.round((n + a) / 2);
        i[r + t] = Math.round(o + (n - o) * c);
        i[s + t] = Math.round(o + (a - o) * c);
      }
    }
  }
  return i;
}
function nh(e, t, n, r) {
  let i = new Uint8ClampedArray(e);
  let a = Math.min(n - 1, r);
  let o = Math.max(0, n - 1 - r);
  let s = eh(e, t, a);
  let c = eh(e, t, o);
  let l = Math.max(1, r - 1);
  for (let a = 0; a < r; a += 1) {
    let r = (a / l) ** 1.35;
    for (let o = 0; o < t; o += 1) {
      let l = (a * t + o) * 4;
      let u = ((n - 1 - a) * t + o) * 4;
      for (let t = 0; t < 4; t += 1) {
        let n = e[l + t] ?? 0;
        let a = e[u + t] ?? 0;
        i[l + t] = Math.round(s[t] + (n - s[t]) * r);
        i[u + t] = Math.round(c[t] + (a - c[t]) * r);
      }
    }
  }
  return i;
}
function rh(e, t, n, r) {
  let i = Math.max(0, Math.min(n - 1, Math.round(n * 0.08)));
  let a = Math.max(i + 1, n - i);
  let o = 0;
  for (let n = i; n < a; n += 1) {
    let i = (n * t + (r - 1)) * 4;
    let a = (n * t + r) * 4;
    o += Math.abs((e[i] ?? 0) - (e[a] ?? 0));
    o += Math.abs((e[i + 1] ?? 0) - (e[a + 1] ?? 0));
    o += Math.abs((e[i + 2] ?? 0) - (e[a + 2] ?? 0));
    o += Math.abs((e[i + 3] ?? 255) - (e[a + 3] ?? 255));
  }
  return o;
}
function ih(e, t) {
  if (t <= 0) {
    return 0;
  } else {
    return (Math.round(e) % t + t) % t;
  }
}
function ah(e, t, n) {
  if (t <= 1) {
    return 0;
  }
  let r = 1;
  let i = Infinity;
  for (let a = 1; a < t; a += 1) {
    let o = rh(e, t, n, a);
    if (o < i) {
      i = o;
      r = a;
    }
  }
  return r;
}
function oh(e, t, n, r = ah(e, t, n)) {
  let i = ih(r, t);
  if (i === 0) {
    return new Uint8ClampedArray(e);
  }
  let a = new Uint8ClampedArray(e.length);
  for (let r = 0; r < n; r += 1) {
    for (let n = 0; n < t; n += 1) {
      let o = (n + i) % t;
      let s = (r * t + o) * 4;
      let c = (r * t + n) * 4;
      a[c] = e[s] ?? 0;
      a[c + 1] = e[s + 1] ?? 0;
      a[c + 2] = e[s + 2] ?? 0;
      a[c + 3] = e[s + 3] ?? 255;
    }
  }
  return a;
}
function sh(e, t, n) {
  if (typeof e.getImageData != `function` || typeof e.putImageData != `function`) {
    return;
  }
  let r = e.getImageData(0, 0, t, n);
  let i = nh(th(oh(r.data, t, n), t, n, Qm(t)), t, n, $m(n));
  r.data.set(i);
  e.putImageData(r, 0, 0);
}
function ch(e, t) {
  let n = Xm(Ym(Math.max(e, t * Rm, Bm), Bm, Vm));
  return {
    width: n,
    height: n / Rm
  };
}
function lh(e, t, n) {
  e.drawImage(t, n.x, n.y, n.width, n.height);
}
async function uh(e) {
  if (typeof createImageBitmap == `function`) {
    return await createImageBitmap(e);
  } else {
    return await new Promise((t, n) => {
      let r = URL.createObjectURL(e);
      let i = new Image();
      i.onload = () => {
        URL.revokeObjectURL(r);
        t(i);
      };
      i.onerror = () => {
        URL.revokeObjectURL(r);
        n(Error(`无法读取全景图尺寸，请重新选择图片`));
      };
      i.src = r;
    });
  }
}
async function fh(e) {
  if (!Lm.test(e.name)) {
    throw Error(`当前全景图仅支持 JPG / PNG / WEBP`);
  }
  let t = await _cmp_dh(e);
  return {
    id: crypto.randomUUID(),
    fileName: e.name,
    name: e.name,
    projectionMode: t.projectionMode,
    url: t.url
  };
}
async function ph(e, t = `panorama.jpg`) {
  let n = await fetch(e);
  if (!n.ok) {
    throw Error(`无法读取图片: ${n.status}`);
  }
  let r = await n.blob();
  let i = r.type || `image/jpeg`;
  let a = i.includes(`png`) ? `png` : i.includes(`webp`) ? `webp` : `jpg`;
  let o = Lm.test(t) ? t : `panorama.${a}`;
  return fh(new File([r], o, {
    type: i
  }));
}
var mh = [{
  id: `convenience`,
  label: `便利生活`,
  directoryName: `便利生活`
}, {
  id: `home`,
  label: `居家生活`,
  directoryName: `生活家居`
}, {
  id: `outdoor`,
  label: `户外出行`,
  directoryName: `户外出行`
}, {
  id: `tools`,
  label: `工具配件`,
  directoryName: `工具配件`
}, {
  id: `my-models`,
  label: `我的模型`,
  directoryName: ``
}];
var hh = Object.assign({});
var gh = Object.assign({});
var _h = Object.assign({});
var vh = Object.assign({});
var yh = Object.assign({});
var bh = {
  '2_liter_low.fbx': `两升饮料瓶`,
  'A_sign_low.fbx': `A字提示牌`,
  'ATM_low.fbx': `自动取款机`,
  'arcade_low.fbx': `街机`,
  'back_saw_low.fbx': `背锯`,
  'backpack_low.fbx': `背包`,
  'bandsaw_low.fbx': `带锯机`,
  'basket_low.fbx': `购物篮`,
  'basketball_hoop_low.fbx': `篮球架`,
  'bathroom_sink_low.fbx': `浴室洗手台`,
  'bathtub_low.fbx': `浴缸`,
  'bed_low.fbx': `床`,
  'beer_bottles_low.fbx': `啤酒瓶`,
  'beer_cans_low.fbx': `啤酒罐`,
  'belt_sander_low.fbx': `砂带机`,
  'big_gulper_low.fbx': `大杯饮料机`,
  'binoculars_low.fbx': `望远镜`,
  'bleach_low.fbx': `漂白剂`,
  'book_shelf_low.fbx': `书架`,
  'bucket_low.fbx': `水桶`,
  'bunk_bed_low.fbx': `双层床`,
  'bunny_low.fbx': `兔子`,
  'cabinet_low.fbx': `储物柜`,
  'cactus_low.fbx': `仙人掌`,
  'camper_low.fbx': `露营车`,
  'camping_stove_low.fbx': `露营炉`,
  'canoe_low.fbx': `独木舟`,
  'canteen_low.fbx': `水壶`,
  'carton_low.fbx': `纸盒`,
  'cash_register_low.fbx': `收银机`,
  'cat_low.fbx': `猫`,
  'ceiling_fan_low.fbx': `吊扇`,
  'cereal_box_low.fbx': `麦片盒`,
  'chair_low.fbx': `椅子`,
  'charcoal_grill_low.fbx': `炭烤炉`,
  'cigarettes_and_lighter_low.fbx': `香烟与打火机`,
  'cleaner_spray_low.fbx': `清洁喷雾`,
  'coffee_carafe_low.fbx': `咖啡壶`,
  'coffee_cup_low.fbx': `咖啡杯`,
  'coffee_maker_low.fbx': `咖啡机`,
  'coffee_table_low.fbx': `茶几`,
  'computer_low.fbx': `电脑`,
  'condiment_dispenser_low.fbx': `调料分配器`,
  'cooking_pot_low.fbx': `炊锅`,
  'cooler_low.fbx': `冷藏箱`,
  'couch_low.fbx': `沙发`,
  'credit_card_machine_low.fbx': `刷卡机`,
  'crowbar_low.fbx': `撬棍`,
  'cup_dispenser_low.fbx': `杯子分配器`,
  'deer_skull_low.fbx': `鹿头骨`,
  'desk_chair_low.fbx': `办公椅`,
  'desk_lamp_low.fbx': `台灯`,
  'desk_low.fbx': `书桌`,
  'detergent_low.fbx': `洗涤剂`,
  'dishwasher_low.fbx': `洗碗机`,
  'display_cooler_low.fbx': `展示冷柜`,
  'door_low.fbx': `门`,
  'dresser_low.fbx': `梳妆柜`,
  'drill_press_low.fbx': `台钻`,
  'drink_fridge_low.fbx': `饮料冰柜`,
  'dryer_low.fbx': `烘干机`,
  'energy_can_low.fbx': `能量饮料罐`,
  'entertainment_system_low.fbx': `影音柜`,
  'fence_low.fbx': `围栏`,
  'fire_low.fbx': `篝火`,
  'fish_low.fbx': `鱼`,
  'fish_tank_low.fbx': `鱼缸`,
  'fishing_pole_low.fbx': `鱼竿`,
  'flashlight_low.fbx': `手电筒`,
  'folding_chair_low.fbx': `折叠椅`,
  'foosball_table_low.fbx': `桌上足球`,
  'french_press_low.fbx': `法压壶`,
  'glass_soda_bottle_low.fbx': `玻璃汽水瓶`,
  'grill_low.fbx': `烧烤炉`,
  'Guitar_low.fbx': `吉他`,
  'hammer_low.fbx': `锤子`,
  'hand_saw_low.fbx': `手锯`,
  'hatchet_low.fbx': `小斧头`,
  'hotdog_roaster_low.fbx': `热狗烤炉`,
  'Ice_cream_machine_low.fbx': `冰淇淋机`,
  'Icebox_low.fbx': `冰柜`,
  'Jar_low.fbx': `玻璃罐`,
  'juice_bottle_low.fbx': `果汁瓶`,
  'juice_machine_low.fbx': `果汁机`,
  'kayak_low.fbx': `皮划艇`,
  'ketchup_bottle_low.fbx': `番茄酱瓶`,
  'kettle_low.fbx': `水壶锅`,
  'kitchen_sink_low.fbx': `厨房水槽`,
  'lantern_low.fbx': `营灯`,
  'laundry_basket_low.fbx': `洗衣篮`,
  'lighter_fluid_low.fbx': `点火油`,
  'lounge_chair_low.fbx': `躺椅`,
  'magazine_rack_low.fbx': `杂志架`,
  'mailbox_low.fbx': `邮箱`,
  'metal_canister_low.fbx': `金属罐`,
  'microwave_low.fbx': `微波炉`,
  'milk_low.fbx': `牛奶盒`,
  'mixer_low.fbx': `搅拌机`,
  'motor_oil_low.fbx': `机油瓶`,
  'mustard_low.fbx': `芥末酱瓶`,
  'nightstand_low.fbx': `床头柜`,
  'oil_additive_low.fbx': `燃油添加剂`,
  'open_sign_low.fbx': `营业标牌`,
  'paint_can_low.fbx': `油漆桶`,
  'paint_roller_low.fbx': `油漆滚筒`,
  'pastry_case_low.fbx': `糕点展示柜`,
  'picnic_table_low.fbx': `野餐桌`,
  'picture_frame_low.fbx': `相框`,
  'pipe_wrench_low.fbx': `管钳`,
  'plant_low.fbx': `盆栽`,
  'plastic_bottle_low.fbx': `塑料瓶`,
  'plastic_water_bottle_low.fbx': `塑料水瓶`,
  'pliers_low.fbx': `钳子`,
  'popcicle_freezer_low.fbx': `冰棒冷柜`,
  'power_drill_low.fbx': `电钻`,
  'pretzel_warmer_low.fbx': `椒盐卷饼保温柜`,
  'radiator_low.fbx': `暖气片`,
  'record_low.fbx': `唱片`,
  'refrigerator_low.fbx': `冰箱`,
  'rotisserie_chicken_low.fbx': `烤鸡柜`,
  'rubber_ducky_low.fbx': `橡皮鸭`,
  'saw_horse_low.fbx': `锯木架`,
  'scratch_awl_low.fbx': `划针`,
  'screw_drivers_low.fbx': `螺丝刀组`,
  'security_camera_low.fbx': `监控摄像头`,
  'shelf_1_low.fbx': `货架1`,
  'shelf_2_low.fbx': `货架2`,
  'shelf_low.fbx': `工具架`,
  'shop_broom_low.fbx': `工坊扫帚`,
  'shop_drawer_low.fbx': `工具抽屉柜`,
  'shop_light_low.fbx': `工坊灯`,
  'shop_vac_low.fbx': `工业吸尘器`,
  'shovel_low.fbx': `铲子`,
  'shower_low.fbx': `淋浴间`,
  'skewers_low.fbx': `烤串签`,
  'skull_n_bones_low.fbx': `骷髅骨头`,
  'sledge_hammer_low.fbx': `大锤`,
  'sleeping_bags_low.fbx': `睡袋`,
  'slurpy_cup_low.fbx': `冰沙杯`,
  'slurpy_machine_low.fbx': `冰沙机`,
  'small_clamp_low.fbx': `小夹具`,
  'soap_low.fbx': `沐浴露`,
  'soda_can_low.fbx': `汽水罐`,
  'soda_cup_low.fbx': `汽水杯`,
  'soda_machine_low.fbx': `汽水机`,
  'speaker_low.fbx': `音箱`,
  'spraypaint_low.fbx': `喷漆罐`,
  'standing_lamp_low.fbx': `落地灯`,
  'stool_low.fbx': `凳子`,
  'stove_low.fbx': `炉灶`,
  'straw_dispenser_low.fbx': `吸管盒`,
  'stump_low.fbx': `树桩`,
  'syrup_bottle_low.fbx': `糖浆瓶`,
  'table_&_chairs_low.fbx': `餐桌椅`,
  'table_clamp_low.fbx': `桌夹`,
  'table_lamp_low.fbx': `桌灯`,
  'tape_measure_low.fbx': `卷尺`,
  'telescope_low.fbx': `天文望远镜`,
  'tent_1_low.fbx': `帐篷1`,
  'tent_2_low.fbx': `帐篷2`,
  'tent_3_low.fbx': `帐篷3`,
  'tent_4_low.fbx': `帐篷4`,
  'thermus_low.fbx': `保温瓶`,
  'Tin_Can_low.fbx': `锡罐`,
  'tin_mug_low.fbx': `金属杯`,
  'toilet_low.fbx': `马桶`,
  'trashcan_low.fbx': `垃圾桶`,
  'tree_saw_low.fbx': `树锯`,
  'tuna_can_low.fbx': `金枪鱼罐头`,
  'tv_low.fbx': `电视`,
  'vacuum_low.fbx': `吸尘器`,
  'vending_machine_low.fbx': `自动售货机`,
  'vice_low.fbx': `台虎钳`,
  'washer_low.fbx': `洗衣机`,
  'water_tank_low.fbx': `水箱`,
  'watering_can_low.fbx': `浇水壶`,
  'window_low.fbx': `窗户`,
  'wood_chizel_low.fbx': `木凿`,
  'workbench_low.fbx': `工作台`,
  'wrench_low.fbx': `扳手`
};
var xh = {
  'condiment_dispenser_low.fbx': `配料分配器`,
  'detergent_low.fbx': `洗调剂`,
  'display_cooler_low.fbx': `展示冰柜`
};
var Sh = {
  'deer_skull_low.fbx': new URL(`../../../../模型库/户外出行/缩略图/鹿头骨.png`, `${import.meta.url}`).href,
  'drill_press_low.fbx': new URL(`../../../../模型库/工具配件/缩略图/台钻.png`, `${import.meta.url}`).href,
  'thermus_low.fbx': new URL(`../../../../模型库/户外出行/缩略图/保温瓶.png`, `${import.meta.url}`).href
};
function Ch(e) {
  return bh[e] || e.replace(/\.(fbx|obj)$/i, ``).replace(/_low$/i, ``).replace(/_/g, ` `).replace(/\b[a-z]/g, e => {
    return e.toUpperCase();
  });
}
function wh(e) {
  return xh[e] ?? Ch(e);
}
function Th() {
  let e = new Map(mh.map(e => {
    return [e.directoryName, e];
  }));
  let t = e => {
    return new Map(Object.entries(e).map(([e, t]) => {
      return [(e.split(`/`).pop() ?? e).replace(/\.(png|jpe?g|webp)$/i, ``), t];
    }));
  };
  let n = new Map([[`convenience`, t(gh)], [`home`, t(_h)], [`outdoor`, t(vh)], [`tools`, t(yh)]]);
  return Object.entries(hh).map(([t, r]) => {
    let [, i, a] = t.match(/模型库\/([^/]+)\/([^/]+)$/) ?? [];
    let o = e.get(i);
    if (!o || !a) {
      return null;
    }
    let s = Ch(a);
    let c = Sh[a] ?? n.get(o.id)?.get(wh(a));
    return {
      categoryId: o.id,
      fileName: a,
      id: `${o.id}:${a}`,
      name: s,
      url: r,
      ...(c ? {
        thumbUrl: c
      } : {})
    };
  }).filter(e => {
    return e !== null;
  }).sort((e, t) => {
    let n = mh.findIndex(t => {
      return t.id === e.categoryId;
    });
    let r = mh.findIndex(e => {
      return e.id === t.categoryId;
    });
    if (n === r) {
      return e.name.localeCompare(t.name);
    } else {
      return n - r;
    }
  });
}
var Eh = 46;
var Dh = 3;
var Oh = 3;
var kh = 1.2;
var Ah = 1;
var jh = 12;
var Mh = 0.1;
var Nh = 10;
function Ph(e) {
  if (Number.isFinite(e)) {
    return Math.min(jh, Math.max(Ah, Math.round(e)));
  } else {
    return Ah;
  }
}
function Fh(e) {
  if (Number.isFinite(e)) {
    return Math.min(Nh, Math.max(Mh, Number(e.toFixed(2))));
  } else {
    return kh;
  }
}
function Ih() {
  return new Promise(e => {
    requestAnimationFrame(() => {
      return e();
    });
  });
}
var Rh = Hu;
var zh = 44;
var Bh = [`#E56C5B`, `#6CDB7A`, `#7AA7FF`];
var Vh = 25;
var Hh = 40;
var Uh = 25;
var Wh = 15;
var Gh = 220;
var Kh = 300;
var qh = 20;
var Jh = `hideFromViewportCapture`;
var Yh = 12;
var Xh = 10;
var Zh = 6;
var Qh = 999;
var $h = `26 26 26`;
var eg = `255 255 255`;
var tg = 0.002;
var ng = [{
  label: `切换到 X 正向视图`,
  className: `is-x-positive`,
  direction: [1, 0, 0]
}, {
  label: `切换到 Y 正向视图`,
  className: `is-y-positive`,
  direction: [0, 1, 0]
}, {
  label: `切换到 Z 正向视图`,
  className: `is-z-positive`,
  direction: [0, 0, 1]
}, {
  label: `切换到 X 反向视图`,
  className: `is-x-negative`,
  direction: [-1, 0, 0]
}, {
  label: `切换到 Y 反向视图`,
  className: `is-y-negative`,
  direction: [0, -1, 0]
}, {
  label: `切换到 Z 反向视图`,
  className: `is-z-negative`,
  direction: [0, 0, -1]
}];
function rg(e, t) {
  return true;
}
function ig(e, t) {
  let n = new W(...e.target);
  let r = new W(...e.position);
  let i = Math.max(r.distanceTo(n), 0.000001);
  let a = t.lengthSq() === 0 ? new W(0, 0, 1) : t.clone().normalize();
  let o = n.clone().add(a.multiplyScalar(i));
  return {
    fov: e.fov,
    position: og(o),
    target: e.target
  };
}
function ag(e, t) {
  let n = new W(...e.position).sub(new W(...e.target));
  let r = new H(e.fov, 1);
  let i = n.lengthSq() === 0 ? new W(0, 0, 1) : n;
  r.position.copy(i);
  r.lookAt(0, 0, 0);
  r.updateMatrixWorld();
  let a = new Tt().setFromRotationMatrix(new y().copy(r.matrix).invert());
  let o = new W(...t).applyQuaternion(a);
  let s = Hh + o.x * Uh - Wh / 2;
  let c = Hh - o.y * Uh - Wh / 2;
  return {
    left: `${Number(s.toFixed(3))}px`,
    top: `${Number(c.toFixed(3))}px`,
    zIndex: Math.round((o.z + 1) * 100)
  };
}
function og(e) {
  return [e.x, e.y, e.z].map(e => {
    return Number(e.toFixed(6));
  });
}
function sg(e, t) {
  let n = (e, t) => {
    return e.every((e, n) => {
      return Math.abs(e - t[n]) < 0.00001;
    });
  };
  return Math.abs(e.fov - t.fov) < 0.00001 && n(e.position, t.position) && n(e.target, t.target);
}
function cg(e, t) {
  e.fov = t.fov;
  e.position.set(...t.position);
  e.lookAt(...t.target);
  e.updateProjectionMatrix();
  e.updateMatrixWorld();
}
function lg(e, t) {
  let n = new W(...t.position);
  let r = new W(...t.target);
  let i = n.sub(r);
  if (i.lengthSq() === 0) {
    i.set(0, 0, 1);
  }
  e.fov = t.fov;
  e.position.copy(i);
  e.lookAt(0, 0, 0);
  e.updateProjectionMatrix();
  e.updateMatrixWorld();
}
function ug(e) {
  return new y().compose(new W(...e.position), new Tt().setFromEuler(new ge(...e.rotation)), new W(...e.scale));
}
function dg(e) {
  return new y().compose(new W(...e.position), new Tt().setFromEuler(new ge(...e.rotation)), new W(e.scale, e.scale, e.scale));
}
function fg(e) {
  if (e.characterRig?.rigType === `ue4-mannequin`) {
    return Du(e.bodyType);
  } else {
    return su(e.bodyType);
  }
}
function pg() {
  let {
    project: {
      objects: e,
      scene: t
    }
  } = $.getState();
  if (!t.showLabels) {
    return [];
  }
  let n = dg(t);
  return e.filter(e => {
    return e.kind === `character` && e.visible;
  }).map(e => {
    let t = ug(e.transform);
    let r = new W(0, fg(e), 0).applyMatrix4(t).applyMatrix4(n);
    return {
      text: e.name,
      worldPosition: r
    };
  });
}
function mg(e, t) {
  if (typeof window > `u`) {
    return t;
  } else {
    return window.getComputedStyle(document.documentElement).getPropertyValue(e).trim() || t;
  }
}
function hg(e, t) {
  let [n = `0`, r = `0`, i = `0`] = e.split(/\s+/);
  return `rgba(${n}, ${r}, ${i}, ${t})`;
}
function gg(e, t, n, r, i, a) {
  let o = Math.min(a, r / 2, i / 2);
  e.beginPath();
  e.moveTo(t + o, n);
  e.lineTo(t + r - o, n);
  e.quadraticCurveTo(t + r, n, t + r, n + o);
  e.lineTo(t + r, n + i - o);
  e.quadraticCurveTo(t + r, n + i, t + r - o, n + i);
  e.lineTo(t + o, n + i);
  e.quadraticCurveTo(t, n + i, t, n + i - o);
  e.lineTo(t, n + o);
  e.quadraticCurveTo(t, n, t + o, n);
  e.closePath();
}
function _g({
  camera: e,
  context: t,
  frameRect: n,
  heightScale: r,
  labels: i,
  viewportHeight: a,
  viewportWidth: o,
  widthScale: s
}) {
  let c = t;
  if (i.length === 0 || !c.fillText || !c.measureText) {
    return;
  }
  let l = Math.max((s + r) / 2, 0.0001);
  let u = Yh * l;
  let d = Xh * l;
  let f = u + Zh * l * 2;
  let p = mg(`--panel-rgb`, $h);
  let m = mg(`--text-rgb`, eg);
  t.font = `${u}px sans-serif`;
  t.textAlign = `center`;
  t.textBaseline = `middle`;
  i.forEach(i => {
    let c = i.worldPosition.clone().project(e);
    if (c.z < -1 || c.z > 1) {
      return;
    }
    let u = (c.x * 0.5 + 0.5) * o;
    let h = (-c.y * 0.5 + 0.5) * a;
    let g = (u - n.left) * s;
    let _ = (h - n.top) * r;
    let v = t.measureText(i.text).width + d * 2;
    let y = g - v / 2;
    let b = _ - f / 2;
    if (!(y > n.width * s) && !(b > n.height * r) && !(y + v < 0) && !(b + f < 0)) {
      t.fillStyle = hg(p, 0.92);
      gg(t, y, b, v, f, Qh * l);
      t.fill();
      t.fillStyle = hg(m, 1);
      t.fillText(i.text, g, _);
    }
  });
}
function yg(e, t) {
  let n = [];
  e.traverse(e => {
    if (e.userData?.[Jh]) {
      n.push({
        object: e,
        visible: e.visible
      });
      e.visible = false;
    }
  });
  try {
    t();
  } finally {
    n.forEach(({
      object: e,
      visible: t
    }) => {
      e.visible = t;
    });
  }
}
function _Component106({
  activeCamera: e,
  bottomPadding: t,
  controlsRef: n,
  safeAreaInsets: r,
  viewportAspectRatio: i,
  viewMode: a
}) {
  let {
    camera: o,
    gl: s,
    scene: c
  } = fn();
  Z.useEffect(() => {
    let l = o;
    Df(async ({
      cameraId: o,
      preset: u,
      source: d
    }) => {
      let f = new W(0, 1.2, 0);
      if (a === `camera` && e) {
        f.fromArray(e.target);
      } else if (n.current?.target) {
        f.copy(n.current.target);
      }
      let p = l.position.clone();
      let m = l.quaternion.clone();
      let h = l.fov;
      let g = n => {
        yg(c, () => {
          s.render(c, l);
        });
        return {
          label: n,
          dataUrl: _cmp_vg(s.domElement, i, t, r, {
            camera: l,
            labels: pg()
          }),
          meta: Af({
            mode: a,
            cameraId: o ?? (a === `camera` ? e?.id ?? null : null),
            fov: l.fov,
            position: [l.position.x, l.position.y, l.position.z],
            target: [f.x, f.y, f.z]
          })
        };
      };
      if (u === `current`) {
        return [g(d === `camera-panel` ? `当前机位` : `当前视角`)];
      }
      let _ = u === `four` ? 4 : 12;
      let v = u === `four` ? `四方位` : `十二方位`;
      let y = p.clone().sub(f);
      let b = new re().setFromVector3(y.lengthSq() === 0 ? new W(0, 0, 6) : y);
      let x = Math.min(Math.max(b.phi, 0.35), Math.PI - 0.35);
      let S = b.radius || 6;
      try {
        let e = [];
        for (let t = 0; t < _; t += 1) {
          let n = new re(S, x, b.theta + Math.PI * 2 * t / _);
          let r = f.clone().add(new W().setFromSpherical(n));
          l.position.copy(r);
          l.lookAt(f);
          l.updateProjectionMatrix();
          e.push(g(`${v} ${t + 1}`));
        }
        return e;
      } finally {
        l.position.copy(p);
        l.quaternion.copy(m);
        l.fov = h;
        l.updateProjectionMatrix();
        s.render(c, l);
      }
    });
    return () => {
      return Of();
    };
  }, [e, t, o, n, s, r, c, a, i]);
  return null;
}
function _Component105({
  controlsRef: e,
  snapshot: t,
  viewMode: n,
  isExternalUpdateRef: r
}) {
  let {
    camera: i
  } = fn();
  let a = Z.useRef(n);
  Z.useLayoutEffect(() => {
    let o = a.current !== n;
    a.current = n;
    if (n === `director`) {
      if (!!r.current || !!o) {
        r.current = false;
        cg(i, t);
        if (e.current) {
          e.current.target.set(...t.target);
          e.current.update();
        }
      }
    }
  }, [i, e, t, n, r]);
  return null;
}
function Tg(e) {
  if (e instanceof HTMLElement) {
    return e.isContentEditable || [`INPUT`, `TEXTAREA`, `SELECT`].includes(e.tagName);
  } else {
    return false;
  }
}
var kg = `custom-edge-flow-style`;
var Ag = `
/* 默认: 淡白色细线 (任何 path 都强制 fill:none, 避免曲线开口被填黑) */
.cust-edge-base,
.cust-edge-glow,
.cust-edge-hit {
  fill: none !important;
}
.cust-edge-base {
  stroke: rgba(255, 255, 255, 0.28);
  stroke-width: 1.4;
  transition: stroke 200ms ease, stroke-width 200ms ease;
}

.cust-edge-glow {
  stroke: rgba(180, 210, 255, 0.18);
  stroke-width: 6;
  filter: blur(3px);
  opacity: 0;
  transition: opacity 200ms ease;
  pointer-events: none;
}

/* 透明加宽 hit 层 - 扩大点击范围 */
.cust-edge-hit {
  stroke: transparent;
  stroke-width: 22;
  pointer-events: stroke;
  cursor: pointer;
}

/* 选中 / 关联激活 -> 显示彗星 + 加亮 base */
.react-flow__edge.selected .cust-edge-base,
.cust-edge-base.is-active {
  stroke: rgba(255, 255, 255, 0.7);
  stroke-width: 1.8;
}
.react-flow__edge.selected .cust-edge-glow,
.cust-edge-glow.is-active {
  opacity: 0.7;
}
.react-flow__edge.selected .cust-edge-comet,
.cust-edge-comet.is-active {
  opacity: 1;
}
.cust-edge-comet {
  opacity: 0;
  transition: opacity 200ms ease;
  pointer-events: none;
}

/* hover 时也能感知 */
.react-flow__edge:hover .cust-edge-base {
  stroke: rgba(255, 255, 255, 0.5);
}
.react-flow__edge:hover .cust-edge-glow {
  opacity: 0.45;
}
.react-flow__edge:hover .cust-edge-comet {
  opacity: 0.9;
}
`;
if (typeof document < `u` && !document.getElementById(kg)) {
  let e = document.createElement(`style`);
  e.id = kg;
  e.textContent = Ag;
  document.head.appendChild(e);
}
var Ng = Z.memo(_cmp_Mg);
var Ig = () => {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};
var zg = [{
  name: `暗黄`,
  value: `rgba(180,160,60,0.25)`
}, {
  name: `暗绿`,
  value: `rgba(60,160,80,0.2)`
}, {
  name: `暗蓝`,
  value: `rgba(60,120,200,0.2)`
}, {
  name: `暗红`,
  value: `rgba(200,60,60,0.2)`
}, {
  name: `暗紫`,
  value: `rgba(140,80,200,0.2)`
}, {
  name: `深灰`,
  value: `rgba(100,100,100,0.25)`
}, {
  name: `透明`,
  value: `transparent`
}];
var Bg = [{
  name: `白`,
  value: `#ffffffea`
}, {
  name: `浅灰`,
  value: `#cccccccc`
}, {
  name: `黄`,
  value: `#ffe650f2`
}, {
  name: `红`,
  value: `#ff6464e6`
}, {
  name: `绿`,
  value: `#64dc78e6`
}, {
  name: `蓝`,
  value: `#64b4ffe6`
}, {
  name: `橙`,
  value: `#ffb43ce6`
}, {
  name: `紫`,
  value: `#b482ffe6`
}];
var Vg = [10, 12, 14, 18, 24, 32, 48, 64, 80, 96, 128];
var Hg = [`➡️`, `⬅️`, `⬆️`, `⬇️`, `↗️`, `↘️`, `✅`, `❌`, `⭐`, `💡`, `🔥`, `📌`, `⚡`, `🎯`, `👇`, `👆`, `🔴`, `🟢`, `🔵`, `🟡`, `⚠️`, `❗`, `📍`, `🏷️`];
function Ug(e) {
  if (e === `transparent`) {
    return `transparent`;
  }
  let t = e.match(/rgba?\((\d+),(\d+),(\d+)/);
  if (!t) {
    return `#888`;
  }
  let [, n, r, i] = t.map(Number);
  return `rgba(${Math.min(255, n + 60)},${Math.min(255, r + 60)},${Math.min(255, i + 60)},0.7)`;
}
function Wg(e) {
  return e.replace(/&/g, `&amp;`).replace(/</g, `&lt;`).replace(/>/g, `&gt;`).replace(/\n/g, `<br>`);
}
var Kg = (e, t) => {
  let n = `${e} ${t}`.toLowerCase();
  if (n.includes(`video`) || /\.(mp4|webm|mov|m4v|avi|mkv)(\?|$)/i.test(t)) {
    return `video`;
  } else if (n.includes(`audio`) || /\.(mp3|wav|m4a|ogg|aac|flac)(\?|$)/i.test(t)) {
    return `audio`;
  } else if (n === `text` || n.includes(`text/`) || /\.(txt|md|json)(\?|$)/i.test(t)) {
    return `text`;
  } else {
    return `image`;
  }
};
var Jg = e => {
  return `[视觉风格：${e || `中世纪童话·皮克斯3D`}]`;
};
function Yg(e, t) {
  let n = String(e || ``).trim();
  let r = String(t || ``).trim();
  if (!n) {
    if (r) {
      return Jg(r);
    } else {
      return ``;
    }
  }
  if (!r) {
    return n;
  }
  let i = n.replace(/\s*\[视觉风格：[^\]]*\]\s*$/u, ``).trim();
  return `${Jg(r)} ${i}`.trim();
}
var Xg = {
  character: `高质量专业角色设定图，横向构图，纯白色纯净背景，中性摄影棚灯光，平光布光；布局结构：正面半身特写 + 全身正面居中 + 左侧面视图 + 背面视图，无任何道具或背景物体。光影：中性摄影棚灯光，柔和的前侧光，清晰的轮廓定义，自然的肤色，面部清晰服装可辨识，平视镜头，完整全身，无裁剪。不得出现任何道具 / 武器 / 食物 / 饮料 / 手持物（角色空手）；不得出现复杂动作、夸张表情、面部遮挡；不得出现环境背景（仅白色）；不得出现其他角色；确保所有视图中的面部特征、发型、体型和服装保持一致；不得出现文字、水印、标签、UI元素；无背景场景，无过度风格化。`,
  scene: `高质量专业场景设定图，横向构图，以 2 行 2 列的干净网格四等分整齐排版，每个格子都是独立的 16:9 横向画面，展示同一场景的四个大全景视角（1为正面中心线大全景视图，镜头正对场景中心轴，构图严格居中，画面同时包含顶面与底面，尽量展示完整空间层次、更多环境细节和深景深；2以1的中心线为参考，摄像机移动到场景左前方45度位置的大全景视图，镜头仍对准场景核心区域；3为以1的中心线为参考，摄像机移动到场景右前方45度位置的大全景视图；4为镜头在室内最深处向外拍摄的正中心全景图。四个视角必须表现同一地点、同一时间、同一天气、同一光源、同一空间结构和同一美术风格。环境清晰，细节丰富，景深较深，光影自然，专业摄影，超清画质。不得出现任何人物（这是空场景参考图），也不得出现人群、背影、剪影、人脸、手脚、人物倒影、人物影子、照片人物、屏幕人物、镜中人物、剧情事件、人物活动；不得让四个视角表现成四个不同场景；不得改变建筑结构、空间比例、主体位置、材质、色彩、天气、时间段或光源方向；画面构图不得倾斜、透视畸变、广角畸变、变形、扭曲；不得出现鱼眼视角、斜角、极端俯视、极端仰视；正面视图必须居中、对称、中心线构图；左前方 45 度、右前方 45 度和背后视角必须保持镜头稳定、空间连贯、比例一致；禁止模糊、低画质；禁止景深太浅；不得出现文字、水印、签名、边框、标签、UI元素、杂乱元素。`,
  prop: `高质量写实道具多角度展示图，横向构图，以 2 行 3 列的干净网格整齐排版，展示道具的六个极正视角。纯白色纯净背景，专业产品影棚摄影，标准六视图参考。六视图包括：绝对正前方视图、绝对正后方视图、绝对左侧视图、绝对右侧视图、绝对正上方俯拍视图、绝对正下方仰拍视图。所有视图必须是同一件道具，材质、颜色、比例、结构完全一致。使用超长焦镜头或移轴镜头效果，将透视变形降到最低，物体所有本该平行的边缘在画面中保持平行，接近正交投影。每个视图都像在专业产品影棚中用三脚架精密校准拍摄，构图绝对端正，物体在每个格子中居中，无任何倾斜、旋转或透视畸变。画面出不得出现任何人物、角色、人群、人影等；不得出现手、脚、人脸、场景、建筑、自然景观；无其他道具；无文字、无水印、无 logo、无 UI 元素，不要任何剧情事件，保持道具本体清晰、保持完整轮廓、保持所有角度的材质和结构一致。`
};
function Zg(e, t, n, r) {
  let i = [`character`, `scene`, `prop`].includes(e) ? e : `character`;
  let a = (t || ``).trim();
  return Yg(`${a}${a && !/[。.!！?？]$/.test(a) ? `。` : ``}${r && r[i] && r[i].trim() ? r[i] : Xg[i]}`, n);
}
var Qg = `

【不可覆盖的最终规则】prompt 与 videoPrompt 每个字段最低 400 个中文字符，建议 450 至 700 字。videoPrompt 必须逐字保留输入中提供的具体角色名、完整对白/旁白和具体音效，并使用“具体角色名说：‘完整台词’”“旁白：‘完整原句’”“环境音/动作音：具体音效”的明确格式。禁止输出“角色说”“人物说”“他说”“她说”等泛称。所有 @名称 必须原样保留。只返回包含 prompt、videoPrompt 的纯 JSON。`;
var $g = [`中世纪童话·皮克斯3D`, `日式动漫·赛璐璐`, `写实电影感`, `国风水墨`, `美式卡通`, `赛博朋克`, `吉卜力手绘`, `黏土定格动画`];
var e_ = [`大远景`, `远景`, `全景`, `中远景`, `中景`, `中近景`, `近景`, `特写`, `大特写`];
var t_ = [`2s`, `3s`, `5s`, `8s`, `10s`, `15s`];
var n_ = [`推镜`, `拉镜`, `摇镜`, `跟镜`, `俯拍`, `仰拍`];
var r_ = {
  character: `角色`,
  scene: `场景`,
  prop: `道具`
};
var i_ = `text-cyan-400`;
var o_ = [`所有人物动作连贯合规，非授权绝不直视镜头`, `开口台词与人物口型帧级同步`, `OS/OV播报期间对应人物嘴巴绝对闭合`, `分镜之间零帧硬切`, `全片无BGM`, `严格规避肢体畸形、物体闪烁、错误口型、画面文字和水印`];
var s_ = 10;
var l_ = e(rn(), 1);
var f_ = `${Wn}${Gn}`;
function p_() {
  let e = Ga();
  if (e) {
    return {
      Authorization: `Bearer ${e}`
    };
  } else {
    return {};
  }
}
function m_(e) {
  if (e) {
    if (e.includes(`/files/`)) {
      return Yr(e, 300, `image`);
    } else if (/^https?:\/\//i.test(e)) {
      if (/x-tos-process=image\/resize,w_300/i.test(e)) {
        return e;
      } else if (e.includes(`?`)) {
        return `${e}&x-tos-process=image/resize,w_300`;
      } else {
        return `${e}?x-tos-process=image/resize,w_300`;
      }
    } else {
      return h_(e);
    }
  } else {
    return ``;
  }
}
function h_(e) {
  if (e) {
    if (/^https?:\/\//i.test(e) || e.startsWith(`data:`)) {
      return e;
    } else {
      return `${Wn}${e.startsWith(`/`) ? `` : `/`}${e}`;
    }
  } else {
    return ``;
  }
}
async function g_(e, t, n = {}) {
  if (!Ga()) {
    throw Error(`请先登录`);
  }
  let r = new FormData();
  r.append(`file`, e, t);
  if (n.folder) {
    r.append(`folder`, n.folder);
  }
  if (n.bizType) {
    r.append(`bizType`, n.bizType);
  }
  let i = await fetch(`${f_}/upload/asset`, {
    method: `POST`,
    headers: p_(),
    body: r
  });
  let a = await i.json().catch(() => {
    return {};
  });
  if (!i.ok || !a.success) {
    throw Error(a.error || `素材上传失败 (${i.status})`);
  }
  return a.data.url;
}
async function __(e) {
  let t = await fetch(`${f_}/templates`, {
    method: `POST`,
    headers: {
      ...p_(),
      'Content-Type': `application/json`
    },
    body: JSON.stringify(e)
  });
  let n = await t.json().catch(() => {
    return {};
  });
  if (!t.ok || !n.success) {
    throw Error(n.error || `保存模板失败 (${t.status})`);
  }
  return n.data;
}
async function v_(e = {}) {
  if (!Ga()) {
    return [];
  }
  let t = new URLSearchParams();
  if (e.category) {
    t.set(`category`, e.category);
  }
  if (e.keyword && e.keyword.trim()) {
    t.set(`keyword`, e.keyword.trim());
  }
  let n = await fetch(`${f_}/templates/mine?${t.toString()}`, {
    headers: p_()
  });
  if (!n.ok) {
    return [];
  }
  let r = await n.json();
  if (r.success) {
    return r.data;
  } else {
    return [];
  }
}
async function y_(e = {}) {
  if (!Ga()) {
    return [];
  }
  let t = new URLSearchParams();
  if (e.category) {
    t.set(`category`, e.category);
  }
  if (e.keyword && e.keyword.trim()) {
    t.set(`keyword`, e.keyword.trim());
  }
  t.set(`pageSize`, `200`);
  let n = await fetch(`${f_}/templates/public?${t.toString()}`, {
    headers: p_()
  });
  if (!n.ok) {
    return [];
  }
  let r = await n.json();
  if (r.success) {
    return r.data;
  } else {
    return [];
  }
}
async function b_(e, t) {
  try {
    let n = await fetch(`${f_}/templates/${e}/visibility`, {
      method: `PATCH`,
      headers: {
        ...p_(),
        'Content-Type': `application/json`
      },
      body: JSON.stringify({
        isPublic: t
      })
    });
    let r = await n.json().catch(() => {
      return {};
    });
    if (n.ok && r.success) {
      return {
        ok: true,
        data: r.data
      };
    } else {
      return {
        ok: false,
        error: r.error || `操作失败 (${n.status})`
      };
    }
  } catch (e) {
    return {
      ok: false,
      error: e?.message || `网络错误`
    };
  }
}
async function x_(e) {
  try {
    return (await fetch(`${f_}/templates/${e}`, {
      method: `DELETE`,
      headers: p_()
    })).ok;
  } catch {
    return false;
  }
}
function S_(e) {
  if (Ga()) {
    fetch(`${f_}/templates/${e}/use`, {
      method: `POST`,
      headers: p_()
    }).catch(() => {});
  }
}
var C_ = `application/x-yimao-template`;
var w_ = [{
  value: ``,
  label: `全部`
}, {
  value: `image`,
  label: `图片`
}, {
  value: `video`,
  label: `视频`
}, {
  value: `text`,
  label: `文本`
}];
var O_ = {
  group: _cmp_Og,
  imageNode: _cmp_xi,
  promptNode: _cmp_bo,
  textNode: _cmp_Co,
  cropNode: _cmp_To,
  gridSplitNode: _cmp_Lo,
  gridMergeNode: _cmp_Yo,
  videoNode: _cmp_Zo,
  sd2VideoNode: _cmp_es,
  discountVideoNode: _cmp_As,
  audioNode: _cmp_Ms,
  audioPlayerNode: _cmp_Ls,
  customNode: _cmp_Rs,
  rhWebappNode: _cmp_$s,
  videoExtractNode: _cmp_ec,
  videoToGifNode: _cmp_fc,
  videoProcessNode: _cmp_Gc,
  imageCompressNode: _cmp_nl,
  faceMosaicNode: _cmp_Cl,
  compareNode: _cmp_Ll,
  textConcatNode: _cmp_Rl,
  urlToImageNode: _cmp_Kl_1,
  fileToUrlNode: _cmp_Yl,
  panoramaNode: _cmp_Zl,
  director3dNode: _cmp_Dg,
  imageBoxNode: _cmp_Rg,
  stickyNoteNode: _cmp_Gg,
  scriptBoxNode: _cmp_c_,
  ghostTarget: _cmp_Fg
};
var k_ = {
  default: Ng
};
var A_ = `canvas-run-workflow-request`;
var j_ = `canvas-reset-workflow-runtime`;
var M_ = `canvas-run-workflow-done`;
var N_ = `canvas-force-save-request`;
var P_ = `canvas-force-save-done`;
function F_(e) {
  if (!e) {
    return false;
  }
  let t = String(e).toLowerCase();
  return !!/余额|算力|额度|配额|充值|欠费|insufficient|quota|balance|not enough|payment|billing|计费/.test(t) || !!/权益不够|已达到使用次数额度|model_entitlement|model_quota/.test(t) || !!/审核|违规|敏感|涉黄|涉政|安全|拦截|blocked|moderation|safety|content[_ ]?policy|policy violation|prohibited|nsfw|sensitive/.test(t);
}
function I_(e) {
  if (!e) {
    return `内置`;
  }
  let t = String(e).trim();
  if (!t || /yimao|jiangwei|weishao/i.test(t)) {
    return `内置`;
  }
  try {
    return new URL(t).host || `第三方`;
  } catch {
    return `第三方`;
  }
}
var L_ = () => {
  return [{
    id: `demo-prompt-1`,
    type: `promptNode`,
    position: {
      x: 500,
      y: 300
    },
    data: {
      prompt: ``,
      expanded: true
    },
    style: {
      width: 420,
      height: 420
    }
  }];
};
var R_ = [];
var _Component122 = Z.memo(({
  onLodChange: e,
  enablePerformanceMode: t = true
}) => {
  let n = Vt(e => {
    return e.transform[2];
  });
  let r = Z.useRef(null);
  let i = Z.useRef(0);
  let a = Z.useRef(null);
  Z.useEffect(() => {
    if (!t) {
      if (a.current !== 0) {
        a.current = 0;
        e(0);
        let t = r.current || document.querySelector(`.react-flow`);
        if (t) {
          t.classList.remove(`lod-1`, `lod-2`, `lod-3`, `zoomed-out-lod`);
        }
      }
      return;
    }
    r.current ||= document.querySelector(`.react-flow`);
    let o = n <= 0.2 ? 3 : n <= 0.3 ? 2 : +(n <= 0.5);
    if (o !== a.current) {
      cancelAnimationFrame(i.current);
      i.current = requestAnimationFrame(() => {
        let t = r.current;
        if (t) {
          t.classList.remove(`lod-1`, `lod-2`, `lod-3`, `zoomed-out-lod`);
          if (o >= 1) {
            t.classList.add(`lod-1`);
          }
          if (o >= 2) {
            t.classList.add(`lod-2`);
          }
          if (o >= 3) {
            t.classList.add(`lod-3`);
            t.classList.add(`zoomed-out-lod`);
          }
          a.current = o;
          e(o);
        }
      });
    }
  }, [n, e, t]);
  return null;
});
function U_(e, t) {
  if (e.startsWith(`http`)) {
    return e;
  } else {
    t.useLicenseServer;
    return `${Wn}${e.startsWith(`/api`) ? e : `${Gn}${e}`}`;
  }
}
function W_(e) {
  let t = new Headers(e.headers || Qn);
  if (!e.skipAuth) {
    let e = Ga();
    if (e) {
      t.set(`Authorization`, `Bearer ${e}`);
    }
  }
  return t;
}
function G_(e, t, n) {
  let r = new AbortController();
  let i = setTimeout(() => {
    return r.abort();
  }, n);
  return fetch(e, {
    ...t,
    signal: r.signal
  }).finally(() => {
    return clearTimeout(i);
  });
}
async function K_(e, t = {}) {
  let {
    method: n = `GET`,
    body: r,
    timeout: i = Zn,
    skipAuth: a = false,
    useLicenseServer: o = false,
    ...s
  } = t;
  try {
    let c = U_(e, {
      ...t,
      useLicenseServer: o
    });
    let l = {
      method: n,
      headers: W_({
        ...t,
        skipAuth: a
      }),
      ...s
    };
    if (r && [`POST`, `PUT`, `PATCH`].includes(n.toUpperCase())) {
      if (!(r instanceof FormData) && !(r instanceof Blob)) {
        if (typeof r == `string`) {
          l.body = r;
        } else {
          l.body = JSON.stringify(r);
        }
      } else {
        l.body = r;
      }
    }
    console.log(`[HTTP ${n}] ${c}`);
    let u = await G_(c, l, i);
    if (u.status === 401 && !a) {
      qa();
    }
    let d;
    let f = u.headers.get(`content-type`);
    if (f && f.includes(`application/json`)) {
      d = await u.json();
    } else {
      d = await u.text();
    }
    if (u.ok) {
      return {
        success: true,
        data: d,
        status: u.status
      };
    } else {
      return {
        success: false,
        error: d.error || d.message || `请求失败: ${u.status}`,
        status: u.status
      };
    }
  } catch (e) {
    console.error(`[HTTP Error]`, e);
    if (e.name === `AbortError`) {
      return {
        success: false,
        error: `请求超时，请检查网络连接`
      };
    } else if (e.message.includes(`Failed to fetch`)) {
      return {
        success: false,
        error: `网络连接失败，请检查网络或服务器状态`
      };
    } else {
      return {
        success: false,
        error: e.message || `未知错误`
      };
    }
  }
}
function q_(e, t) {
  return K_(e, {
    ...t,
    method: `GET`
  });
}
function J_(e, t, n) {
  return K_(e, {
    ...n,
    method: `POST`,
    body: t
  });
}
function Y_(e, t, n) {
  return K_(e, {
    ...n,
    method: `PUT`,
    body: t
  });
}
function X_(e, t) {
  return K_(e, {
    ...t,
    method: `DELETE`
  });
}
function Z_(e, t, n) {
  return K_(e, {
    ...n,
    method: `PATCH`,
    body: t
  });
}
function Q_() {
  return Ga();
}
var $_ = {
  get: q_,
  post: J_,
  put: Y_,
  delete: X_,
  patch: Z_,
  setAuthToken: Ka,
  clearAuthToken: qa,
  getCurrentToken: Q_
};
export { _cmp_Bn, _cmp_Er, _cmp_Tr, _cmp_Vn, _cmp_Oi, _cmp_Vo, _cmp_nc, _cmp_mc, _cmp_dl, _cmp_kl, _cmp_dh, _cmp_vg, _cmp_Mg, _cmp_Og, _cmp_xi, _cmp_bo, _cmp_Co, _cmp_To, _cmp_Lo, _cmp_Yo, _cmp_Zo, _cmp_es, _cmp_As, _cmp_Ms, _cmp_Ls, _cmp_Rs, _cmp_$s, _cmp_ec, _cmp_fc, _cmp_Gc, _cmp_nl, _cmp_Cl, _cmp_Ll, _cmp_Rl, _cmp_Kl_1, _cmp_Yl, _cmp_Zl, _cmp_Dg, _cmp_Rg, _cmp_Gg, _cmp_c_, _cmp_Fg, e, t, _Component128, _Component11, _Component52, a, _Component30, _Component22, c, _Component15, _Component117, d, _Component33, _Component114, _Component102, h, _Component113, _, _Component18, y, _Component58, _Component60, S, C, w, T, E, D, O, _Component27, A, j, M, N, P, F, I, _Component112, L, R, te, _Component2, ne, B, re, V, _Component48, ae, _Component121, H, _Component126, _Component29, U, W, le, G, ue, _Component3, _Component25, pe, _Component115, he, ge, _e, _Component63, _Component62, be, _Component120, Se, Ce, we, Te, Ee, De, K, Oe, _Component28, Ae, _Component123, _Component4, Me, Ne, Pe, Fe, Ie, Le, Re, ze, Be, Ve, He, J, Y, Ue, We, Ge, Ke, _Component37, Je, Ye, Xe, Ze, X, Qe, $e, _Component14, _Component1, nt, _Component32, it, _Component96, _Component57, _Component49, _Component20, lt, _Component26, _Component13, ft, _Component61, _Component47, _Component125, _Component110, _t, _Component43, _Component34, bt, xt, St, Ct, _Component41, Tt, Et, Dt, Ot, _Component86, At, _Component7, Mt, Nt, Pt, Ft, It, Lt, Rt, _Component54, Bt, Vt, Ht, Ut, Wt, Gt, Kt, _Component56, Jt, Yt, Xt, Zt, Qt, $t, _Component10, _Component6, nn, rn, _Component45, _Component31, sn, _Component59, _Component5, _Component100, _Component65, fn, _Component50, _Component17, _Component44, gn, _n, _Component36, _Component0, bn, _Component124, Sn, Cn, wn, Tn, En, Dn, On, _Component71, An, jn, Mn, Nn, Pn, __vite__mapDeps, Z, Fn, In, Ln, Rn, Q, Hn, Wn, Gn, Kn, qn, Jn, Yn, Xn, Zn, Qn, $n, er, tr, nr, rr, ir, ar, or, sr, cr, lr, ur, dr, fr, pr, mr, hr, gr, _r, vr, br, xr, Sr, Cr, Dr, Or, kr, Ar, jr, Mr, Nr, Pr, Fr, Ir, Lr, Rr, zr, Br, Vr, Hr, Ur, Wr, Gr, Kr, qr, Jr, Yr, Xr, Zr, Qr, $r, ei, ti, ni, ri, ii, ai, oi, si, ci, li, ui, di, fi, pi, mi, hi, gi, _i, vi, Ci, Ei, ji, Mi, Ni, Pi, Fi, Ii, Li, Ri, zi, Bi, Vi, Hi, Ui, Wi, Gi, Ki, qi, Ji, Yi, Xi, Zi, Qi, $i, ea, ta, na, ra, ia, aa, oa, sa, ca, la, ua, da, fa, pa, ma, ha, ga, _a, va, ya, ba, xa, Sa, Ca, wa, Ta, Ea, Da, Oa, ka, Aa, ja, Ma, Na, Pa, Fa, Ia, La, Ra, za, Ba, Va, Ha, Ua, Wa, Ga, Ka, qa, Ja, Ya, Xa, Za, Qa, $a, eo, to, no, ro, io, ao, oo, so, co, lo, po, mo, ho, go, _o, yo, Eo, Do, Oo, ko, Ao, jo, Mo, No, Po, Fo, Ro, zo, Ho, Wo, Go, Ko, qo, Jo, Xo, Qo, $o, ts, ns, rs, is, as, os, ss, cs, ls, us, ds, fs, ps, ms, hs, gs, vs, ys, bs, xs, Ss, Cs, Ds, Os, ks, js, Ns, Ps, Fs, zs, Bs, Vs, Hs, Us, Ws, Gs, Ks, qs, Js, Ys, Xs, Zs, Qs, tc, rc, ac, oc, sc, cc, lc, uc, dc, pc, hc, gc, _c, vc, yc, bc, xc, Sc, Cc, wc, Tc, Ec, Dc, Oc, kc, Ac, jc, Mc, Nc, Pc, Fc, Ic, Lc, Rc, zc, Bc, Vc, Hc, Uc, Wc, Kc, qc, Jc, Yc, Zc, Qc, $c, el, tl, rl, il, al, ol, sl, cl, ll, ul, fl, pl, ml, hl, gl, vl, yl, xl, Sl, wl, Tl, El, Dl, Ol, Al, jl, Nl, Fl, Il, zl, Bl, Vl, Hl, Ul, Wl, Gl, ql, Jl, Ql, $l, eu, tu, nu, ru, iu, au, ou, su, cu, lu, uu, du, fu, pu, mu, hu, gu, _u, vu, yu, bu, xu, Su, Cu, wu, Tu, Eu, Du, Ou, ku, Au, ju, Mu, Nu, Pu, Fu, Iu, Lu, Ru, zu, Bu, Vu, Hu, Uu, Wu, Gu, Ku, qu, Ju, Yu, Xu, Zu, Qu, $u, ed, td, nd, rd, id, ad, od, sd, cd, ld, ud, dd, fd, pd, md, hd, gd, _d, vd, yd, bd, xd, Sd, Cd, wd, Td, Ed, Dd, Od, kd, Ad, jd, Md, Nd, Pd, Fd, Id, Ld, Rd, zd, Bd, Vd, Hd, Ud, Wd, Gd, Kd, qd, Jd, Yd, Xd, Zd, Qd, $d, ef, tf, nf, rf, $, af, cf, lf, uf, df, ff, pf, mf, hf, gf, _f, Ef, Df, Of, kf, Af, Mf, Nf, Pf, Ff, If, Lf, Rf, Bf, Hf, Wf, Gf, Kf, qf, Jf, Yf, Xf, Zf, Qf, $f, rp, fp, pp, gp, _p, vp, yp, bp, xp, Sp, Cp, wp, Tp, Dp, kp, Ap, jp, Mp, Np, Pp, Fp, Ip, Lp, Rp, zp, Bp, Vp, Hp, Up, Wp, Gp, Jp, Yp, Xp, Zp, Qp, $p, em, tm, nm, rm, im, am, om, vm, xm, Sm, Cm, wm, Em, Dm, Om, Am, jm, Mm, Pm, Fm, Im, Lm, Rm, zm, Bm, Vm, Hm, Um, Wm, Gm, Km, qm, Jm, Ym, Xm, Zm, Qm, $m, eh, th, nh, rh, ih, ah, oh, sh, ch, lh, uh, fh, ph, mh, hh, gh, _h, vh, yh, bh, xh, Sh, Ch, wh, Th, Eh, Dh, Oh, kh, Ah, jh, Mh, Nh, Ph, Fh, Ih, Rh, zh, Bh, Vh, Hh, Uh, Wh, Gh, Kh, qh, Jh, Yh, Xh, Zh, Qh, $h, eg, tg, ng, rg, ig, ag, og, sg, cg, lg, ug, dg, fg, pg, mg, hg, gg, _g, yg, _Component106, _Component105, Tg, kg, Ag, Ng, Ig, zg, Bg, Vg, Hg, Ug, Wg, Kg, Jg, Yg, Xg, Zg, Qg, $g, e_, t_, n_, r_, i_, o_, s_, l_, f_, p_, m_, h_, g_, __, v_, y_, b_, x_, S_, C_, w_, O_, k_, A_, j_, M_, N_, P_, F_, I_, L_, R_, _Component122, U_, W_, G_, K_, q_, J_, Y_, X_, Z_, Q_, $_, setDiscountVideoApiConfigModels };