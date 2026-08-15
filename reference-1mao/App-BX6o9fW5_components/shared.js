import _cmp_Ln from "./Ln.jsx";
import _cmp_Lt from "./Lt.jsx";
import _cmp_Qt from "./Qt.jsx";
import _cmp_Sr from "./Sr.jsx";
import _cmp_Tr from "./Tr.jsx";
import _cmp_Xt from "./Xt.jsx";
import _cmp_jn from "./jn.jsx";
import { i as e } from '../rolldown-runtime-aKtaBQYM.js';
import '../src-kC58-PF2.js';
import { At as _Component7, Bt as _Component37, Dt as r, Fn as _Component30, Fr as a, Ht as _Component4, Kn as _Component6, Ln as _Component46, Lt as _Component33, Mr as _Component12, Nr as _Component15, Ot as _Component28, Pn as _Component2, Pt as _Component36, Qt as _Component3, Rr as g, Rt as _, Sn as _Component1, Sr as _Component29, St as _Component10, Tr as _Component9, U as S, Un as C, Wt as _Component23, Xn as T, Xt as E, Yn as D, _r as O, ar as _Component27, bt as A, er as _Component45, ft as M, gn as N, ht as P, in as _Component0, kt as F, lr as I, mn as _Component25, mr as L, nn as _Component20, nr as _Component32, on as _Component21, or as _Component35, pt as R, rn as _Component8, sr as _Component5, tr as _Component44, vr as _Component, wn as _Component26, wr as _Component16, wt as _Component31, xr as _Component17 } from '../vendor-Z-adA07W.js';
import { c as me, i as he, o as ge, r as _e, t as ve } from '../endpointConfig-Bt85xi8d.js';
import { $ as ye, A as be, B as xe, C as Se, D as Ce, E as we, F as Te, G as Ee, H as De, I as Oe, J as z, K as ke, L as Ae, M as je, N as Me, O as Ne, P as Pe, Q as Fe, R as Ie, S as Le, T as Re, U as ze, V as Be, W as Ve, X as He, Y as B, Z as Ue, _ as We, a as Ge, at as Ke, b as qe, ct as Je, d as Ye, dt as Xe, et as Ze, f as Qe, ft as $e, g as et, h as tt, ht as _Component39, i as rt, it, j as at, k as ot, lt as st, m as _Component13, mt as lt, n as ut, nt as dt, o as ft, ot as pt, p as mt, pt as ht, q as gt, r as _t, rt as vt, s as yt, st as bt, t as xt, tt as St, u as V, ut as Ct, v as H, w as wt, x as Tt, y as Et, z as U, setDiscountVideoApiConfigModels } from '../httpClient-BknZwXjG.js';
var W = e(g(), 1);
var Dt = async e => {
  try {
    let t = await ut(`${Je}/plugin/manifest.json`, {
      useLicenseServer: true,
      skipAuth: true
    });
    let n = false;
    if (t.success && t.data) {
      let r = t.data;
      if (r.version && r.version !== e) {
        let t = e.split(`.`).map(Number);
        let i = r.version.split(`.`).map(Number);
        for (let e = 0; e < Math.max(t.length, i.length); e++) {
          let r = t[e] || 0;
          n = (i[e] || 0) > r;
          if (n) {
            break;
          }
        }
        return {
          hasUpdate: n,
          ...r
        };
      }
    }
    return {
      hasUpdate: false
    };
  } catch (e) {
    console.error(`Check update failed:`, e);
    return {
      hasUpdate: false
    };
  }
};
function Ot() {
  return `10000000-1000-4000-8000-100000000000`.replace(/[018]/g, e => {
    return (e ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> e / 4).toString(16);
  });
}
var kt = () => {
  let e = localStorage.getItem(B.DEVICE_ID);
  if (!e) {
    e = Ot();
    localStorage.setItem(B.DEVICE_ID, e);
  }
  return e;
};
var At = e(S(), 1);
var jt = 60000;
var Mt = 30000;
var Nt = 5;
function Pt({
  isLoaded: e,
  globalTasks: t,
  handleUpdateGlobalTasks: n,
  showToastMessage: r,
  localPort: i,
  localToolConnected: a,
  sd2VideoApiUrl: o,
  sd2VideoApiKey: s,
  videoApiUrl: c,
  videoApiKey: l,
  discountVideoApiUrl: u,
  discountVideoApiKey: d,
  aiAppApiUrl: f,
  aiAppApiKey: p
}) {
  let m = W.useRef(0);
  let h = W.useRef(new Map());
  let g = W.useCallback(async (e, t = false) => {
    console.log(`[任务刷新] 刷新任务:`, e.id);
    try {
      let m = ``;
      let h = {};
      let g = e.taskId || e.id;
      if (e.type === `sd2Video`) {
        m = `${(e.apiUrl || o).replace(/\/$/, ``)}/v1/video/generations/${g}`;
        h = {
          Authorization: `Bearer ${e.apiKey || s}`,
          Accept: `*/*`
        };
      } else if (e.type === `video`) {
        m = `${(e.apiUrl || c).replace(/\/$/, ``)}/v1/videos/${g}`;
        h = {
          Authorization: `Bearer ${e.apiKey || l}`
        };
      } else if (e.type === `discountVideo`) {
        m = `${(u || ``).replace(/[\`\s]/g, ``).replace(/\/$/, ``)}/v1/gateway/task/${g}`;
        h = {
          Authorization: `Bearer ${d}`,
          Accept: `*/*`
        };
      } else if (e.type === `rhWebapp`) {
        m = ht(lt(f), `/task/${encodeURIComponent(g)}`);
        h = {
          Authorization: `Bearer ${p}`,
          Accept: `*/*`
        };
      } else {
        if (!t) {
          r(`仅支持刷新视频任务状态`);
        }
        return;
      }
      let _ = await mt(m, {
        headers: h,
        localPort: a ? i : undefined
      });
      let v;
      try {
        v = await _.json();
      } catch (e) {
        throw _.ok ? e : Error(`HTTP Error ${_.status}: ${_.statusText}`);
      }
      if (_.ok || !_.ok && v) {
        let i = false;
        let a = e.status;
        let o = e.progress;
        let s = e.errorMsg;
        let c = e.resultUrl;
        let l = e.thumbnailUrl;
        if (!_.ok) {
          a = `failed`;
          s = v.errorMsg || v.errorMessage || v.error || v.message || `请求失败 (${_.status})`;
        }
        if (e.type === `sd2Video` && v.code === `success` && v.data) {
          let e = v.data.status;
          if (e === `SUCCESS` || e === `succeeded`) {
            i = true;
            a = `completed`;
            o = 100;
            c = v.data.data?.content?.video_url || v.data.fail_reason;
          } else if (e === `FAILED` || e === `failed` || e === `FAILURE`) {
            a = `failed`;
            s = v.data.fail_reason || `视频生成失败`;
          } else {
            a = `running`;
            if (v.data.progress) {
              o = parseInt(v.data.progress.replace(`%`, ``)) || 50;
            }
          }
        } else if (e.type === `discountVideo` && v.code === 1 && v.data) {
          let e = v.data.status;
          if (e === 3 || e === `success` || e === `SUCCESS` || e === `completed`) {
            i = true;
            a = `completed`;
            o = 100;
            c = v.data.video_url || v.data.result_url || v.data.data?.content?.video_url || v.data.result?.url;
            c &&= c.replace(/[\`\s]/g, ``);
          } else if (e === 4 || e === `failed` || e === `FAILED` || e === `error`) {
            a = `failed`;
            s = v.data.fail_reason || v.data.error || `视频生成失败`;
          } else {
            a = `running`;
            o = v.data.progress && parseInt(String(v.data.progress).replace(`%`, ``)) || 50;
          }
        } else if (e.type === `discountVideo` && v.status !== undefined && !v.data) {
          let e = v.status;
          if (e === 3 || e === `success` || e === `SUCCESS` || e === `completed`) {
            i = true;
            a = `completed`;
            o = 100;
            c = v.video_url || v.result_url || v.result?.url;
            c &&= c.replace(/[\`\s]/g, ``);
          } else if (e === 4 || e === `failed` || e === `FAILED` || e === `error`) {
            a = `failed`;
            s = v.fail_reason || v.error || `视频生成失败`;
          } else {
            a = `running`;
            o = v.progress && parseInt(String(v.progress).replace(`%`, ``)) || 50;
          }
        } else if (e.type === `rhWebapp`) {
          let t = String(v.status || ``).toUpperCase();
          if (t === `SUCCESS`) {
            i = true;
            a = `completed`;
            o = 100;
            let t = (Array.isArray(v.results) ? v.results : []).find(e => {
              return e?.url;
            });
            if (t?.url) {
              c = String(t.url).replace(/[\`\s]/g, ``);
            } else {
              c = e.resultUrl;
            }
          } else if (t === `FAILED`) {
            a = `failed`;
            s = v.errorMessage || v.error || `AI 应用任务失败`;
          } else {
            a = `running`;
            if (t === `PENDING` || t === `QUEUED`) {
              o = 10;
            } else {
              o = 50;
            }
          }
        } else if (v.status === `completed` || v.status === `success` || v.status === `succeeded`) {
          i = true;
          a = `completed`;
          o = 100;
          c = (v.video_url || v.video || v.result_url || v.result?.url || v.url)?.replace(/[\`\s]/g, ``) || ``;
          l = (v.thumbnail_url || v.cover_url || v.thumbnail)?.replace(/[\`\s]/g, ``) || ``;
        } else if (v.status === `failed` || v.status === `error`) {
          a = `failed`;
          let e = `视频生成失败`;
          if (v.error) {
            if (typeof v.error == `string`) {
              e = v.error;
            } else if (v.error.message) {
              e = v.error.message;
            }
          }
          s = e;
        } else {
          a = `running`;
          o = v.progress || 50;
        }
        if (a === e.status && o === e.progress && s === e.errorMsg && c === e.resultUrl) {
          n(t => {
            return t.map(t => {
              if (t.id === e.id) {
                return {
                  ...t,
                  responseData: v,
                  customRawResponse: v
                };
              } else {
                return t;
              }
            });
          });
          if (!t) {
            r(`任务状态暂无变化`);
          }
          return;
        }
        if (typeof s == `object`) {
          try {
            s = JSON.stringify(s);
          } catch {
            s = `未知错误`;
          }
        }
        n(t => {
          return t.map(t => {
            if (t.id === e.id) {
              let n = {
                status: a,
                progress: o,
                errorMsg: s,
                resultUrl: c,
                thumbnailUrl: l,
                responseData: v,
                customRawResponse: v
              };
              if (e.type === `rhWebapp` && c) {
                n.customResultData = c;
                let e = String((Array.isArray(v.results) ? v.results[0]?.outputType : ``) || ``).toLowerCase();
                if (e.includes(`video`)) {
                  n.customOutputType = `video`;
                } else if (e.includes(`audio`)) {
                  n.customOutputType = `audio`;
                } else if (e.includes(`text`)) {
                  n.customOutputType = `text`;
                } else {
                  n.customOutputType = `image`;
                }
              }
              return {
                ...t,
                ...n
              };
            }
            return t;
          });
        });
        if ((i || a === `failed`) && e.nodeId) {
          window.dispatchEvent(new CustomEvent(`mutiwindow-task-completed`, {
            detail: {
              taskId: e.id,
              nodeId: e.nodeId,
              resultUrl: c,
              type: e.type,
              status: a,
              errorMsg: s
            }
          }));
        }
        if (i) {
          if (!t) {
            r(`任务已完成！`);
          }
        } else if (a === `failed`) {
          if (!t) {
            r(`任务失败: ${typeof s == `object` ? JSON.stringify(s) : s || `未知错误`}`);
          }
        } else if (!t) {
          r(`状态已刷新`);
        }
      } else if (!t) {
        r(`刷新失败: ${_.status}`);
      }
    } catch (e) {
      if (!t) {
        r(`网络错误: ${e.message}`);
      }
    }
  }, [p, f, d, u, n, i, a, s, o, r, l, c]);
  W.useEffect(() => {
    if (!e || !a) {
      return;
    }
    let n = Date.now();
    if (n - m.current < jt) {
      return;
    }
    let r = [];
    for (let e of t) {
      if (r.length >= Nt) {
        break;
      }
      let t = e.type === `sd2Video` || e.type === `video` || e.type === `discountVideo` || e.type === `rhWebapp`;
      let i = e.status === `running` || e.status === `pending`;
      let a = !!e.taskId;
      let o = n - (h.current.get(e.id) || 0) >= Mt;
      if (t && i && a && o) {
        r.push(e);
        h.current.set(e.id, n);
      }
    }
    if (r.length !== 0) {
      m.current = n;
      r.sort((e, t) => {
        if (e.status === `pending` && t.status !== `pending`) {
          return -1;
        } else {
          return +(t.status === `pending` && e.status !== `pending`);
        }
      });
      r.forEach((e, t) => {
        setTimeout(() => {
          g(e, true);
        }, t * 5000 + Math.random() * 1000);
      });
    }
  }, [t, g, e]);
  return {
    handleRefreshTask: g
  };
}
var G = a();
var K = new class {
  listeners = [];
  toasts = [];
  subscribe(e) {
    this.listeners.push(e);
    return () => {
      this.listeners = this.listeners.filter(t => {
        return t !== e;
      });
    };
  }
  notify() {
    this.listeners.forEach(e => {
      return e([...this.toasts]);
    });
  }
  addToast(e, t, n = 3000) {
    let r = Math.random().toString(36).substr(2, 9);
    let i = {
      id: r,
      type: e,
      message: t,
      duration: n
    };
    this.toasts = [...this.toasts, i];
    this.notify();
    setTimeout(() => {
      this.removeToast(r);
    }, n);
  }
  removeToast(e) {
    this.toasts = this.toasts.filter(t => {
      return t.id !== e;
    });
    this.notify();
  }
  success(e, t) {
    this.addToast(`success`, e, t);
  }
  error(e, t) {
    this.addToast(`error`, e, t);
  }
  warning(e, t) {
    this.addToast(`warning`, e, t);
  }
  info(e, t) {
    this.addToast(`info`, e, t);
  }
}();
var Rt = () => {
  let [e, t] = W.useState([]);
  W.useEffect(() => {
    return K.subscribe(t);
  }, []);
  return {
    toasts: e,
    removeToast: W.useCallback(e => {
      K.removeToast(e);
    }, []),
    success: K.success.bind(K),
    error: K.error.bind(K),
    warning: K.warning.bind(K),
    info: K.info.bind(K)
  };
};
var zt = (e, t) => {
  return `${ge()}${t}`;
};
async function Bt(e, t) {
  let n = await fetch(e, t);
  let r = await n.text();
  let i = r ? JSON.parse(r) : {};
  if (!n.ok) {
    throw Error(i?.error || i?.message || `HTTP ${n.status}`);
  }
  return i;
}
function Vt() {
  if (typeof chrome < `u` && chrome.runtime?.getManifest) {
    return chrome.runtime.getManifest().version;
  } else {
    return `1.4.2`;
  }
}
function Ht() {
  if (typeof chrome < `u` && chrome.runtime?.id) {
    return chrome.runtime.id;
  }
}
function Ut() {
  if (typeof chrome < `u` && chrome.runtime?.reload) {
    chrome.runtime.reload();
    return;
  }
  window.location.reload();
}
async function Wt(e, t) {
  return Bt(zt(e, `/extension/update`), {
    method: `POST`,
    headers: {
      'Content-Type': `application/json`
    },
    body: JSON.stringify(t)
  });
}
async function Gt(e, t) {
  return Bt(zt(e, `/extension/rollback`), {
    method: `POST`,
    headers: {
      'Content-Type': `application/json`
    },
    body: JSON.stringify(t)
  });
}
async function Kt(e) {
  return Bt(zt(e, `/extension/update/status`));
}
var q = `extension-update-dist-path`;
var qt = `extension-update-dismissed-version`;
function J(e) {
  return e?.status === `completed` || e?.status === `success`;
}
function Jt(e) {
  return e?.status === `failed` || !!e?.error;
}
function Yt({
  onToast: e,
  openUpgradeSettings: t
}) {
  let [n, r] = W.useState(null);
  let [i, a] = W.useState(false);
  let [o, s] = W.useState(() => {
    return localStorage.getItem(qt) || ``;
  });
  let [c, l] = W.useState(``);
  let u = W.useRef(e);
  let d = W.useRef(t);
  W.useEffect(() => {
    u.current = e;
  }, [e]);
  W.useEffect(() => {
    d.current = t;
  }, [t]);
  let f = W.useCallback(async (e = false) => {
    if (i) {
      return;
    }
    a(true);
    if (e) {
      d.current();
    }
    let t = await Dt(Vt());
    a(false);
    r(t);
    if (t.hasUpdate) {
      if (e || t.version !== localStorage.getItem(qt)) {
        u.current(`发现新版本 v${t.version}`);
      }
      return;
    }
    if (e) {
      u.current(`当前已是最新版本`);
    }
  }, [i]);
  W.useEffect(() => {
    f(false);
  }, []);
  let p = W.useCallback(() => {
    if (n?.version) {
      l(n.version);
    }
  }, [n?.version]);
  let m = W.useCallback(() => {
    if (n?.version) {
      localStorage.setItem(qt, n.version);
      s(n.version);
    }
  }, [n?.version]);
  return {
    updateInfo: n,
    hasUpdate: !!n?.hasUpdate,
    isUpdateBannerVisible: !!n?.hasUpdate && n.version !== o && n.version !== c,
    isCheckingUpdate: i,
    currentVersion: Vt(),
    checkUpdateNow: f,
    openUpgradeSettings: t,
    dismissUpdateBanner: p,
    ignoreUpdateVersion: m,
    showToast: e
  };
}
var rn = `密码至少8位，需包含大写字母、小写字母、数字`;
function an(e) {
  if (e) {
    if (e.length < 8) {
      return {
        valid: false,
        error: `密码长度不能少于8个字符`
      };
    } else if (/[a-z]/.test(e)) {
      if (/[A-Z]/.test(e)) {
        if (/[0-9]/.test(e)) {
          return {
            valid: true
          };
        } else {
          return {
            valid: false,
            error: `密码需包含数字`
          };
        }
      } else {
        return {
          valid: false,
          error: `密码需包含大写字母`
        };
      }
    } else {
      return {
        valid: false,
        error: `密码需包含小写字母`
      };
    }
  } else {
    return {
      valid: false,
      error: `密码不能为空`
    };
  }
}
function on(e, t) {
  if (t) {
    if (e === t) {
      return {
        valid: true
      };
    } else {
      return {
        valid: false,
        error: `两次输入的新密码不一致`
      };
    }
  } else {
    return {
      valid: false,
      error: `请再次输入新密码`
    };
  }
}
var cn = (...e) => {
  return e.filter(Boolean).join(` `);
};
var ln = {
  text: {
    label: `文本`
  },
  image: {
    label: `生图`
  },
  video: {
    label: `生视频`
  }
};
function un() {
  let e = [];
  let t = new Set();
  let n = [`text`, `image`, `video`];
  let r = Pe();
  for (let i of n) {
    for (let n of r[i] || []) {
      if (!t.has(n)) {
        t.add(n);
        e.push({
          name: n,
          category: i,
          power: U(n),
          unit: Be(n),
          currency: Ae(n)
        });
      }
    }
  }
  for (let n of Oe()) {
    if (!t.has(n)) {
      t.add(n);
      e.push({
        name: n,
        category: `video`,
        power: U(n),
        unit: Be(n),
        currency: Ae(n)
      });
    }
  }
  return e;
}
function fn(e) {
  if (e === null) {
    return Infinity;
  } else {
    return e;
  }
}
var _n = (...e) => {
  return e.filter(Boolean).join(` `);
};
var yn = {
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
function bn(e) {
  let t = (e || ``).trim();
  if (!t) {
    return {
      key: `misc`,
      label: `其他`
    };
  }
  let n = xe(t);
  if (n) {
    return {
      key: n.key,
      label: n.label
    };
  }
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
  }]) {
    if (e.test.test(r)) {
      return {
        key: e.key,
        label: e.label
      };
    }
  }
  let i = t.split(/[-_:.@/\s]/)[0] || `misc`;
  return {
    key: i.toLowerCase(),
    label: `${i} 系列`
  };
}
function xn(e) {
  let t = [[`from-blue-500/65`, `to-cyan-400/45`], [`from-fuchsia-500/65`, `to-pink-400/45`], [`from-emerald-500/65`, `to-teal-400/45`], [`from-amber-500/65`, `to-orange-400/45`], [`from-violet-500/65`, `to-indigo-400/45`], [`from-rose-500/65`, `to-red-400/45`], [`from-sky-500/65`, `to-blue-400/45`], [`from-lime-500/65`, `to-emerald-400/45`]];
  let n = 0;
  for (let t = 0; t < e.length; t++) {
    n = n * 31 + e.charCodeAt(t) >>> 0;
  }
  let [r, i] = t[n % t.length];
  return `bg-gradient-to-br ${r} ${i}`;
}
function Sn() {
  let e = ze();
  if (e.length > 0) {
    return e.map(e => {
      let t = e.builtinCategory || e.category || `text`;
      let n = t === `video` || t === `text` || t === `image` ? t : `text`;
      let r = e.isDiscountVideo ? `discount` : n;
      return {
        id: `${n}:${e.modelName}`,
        name: e.modelName,
        category: n,
        displayCategory: r,
        power: U(e.modelName),
        unit: Be(e.modelName),
        currency: Ae(e.modelName),
        recommended: ke(e.modelName),
        description: Ie(e.modelName),
        access: e.access,
        accessReason: e.reason
      };
    });
  }
  let t = [];
  let n = new Set();
  for (let e of [`text`, `image`, `video`]) {
    for (let r of Pe()[e] || []) {
      if (n.has(r)) {
        continue;
      }
      n.add(r);
      let i = Ee(r) ? `discount` : e;
      t.push({
        id: `${e}:${r}`,
        name: r,
        category: e,
        displayCategory: i,
        power: U(r),
        unit: Be(r),
        currency: Ae(r),
        recommended: ke(r),
        description: Ie(r)
      });
    }
  }
  for (let e of Oe()) {
    if (!n.has(e)) {
      n.add(e);
      t.push({
        id: `video:${e}`,
        name: e,
        category: `video`,
        displayCategory: `discount`,
        power: U(e),
        unit: Be(e),
        currency: Ae(e),
        recommended: ke(e),
        description: Ie(e)
      });
    }
  }
  return t;
}
var Tn = {
  text: {
    label: `文本`,
    icon: r
  },
  image: {
    label: `生图`,
    icon: _Component46
  },
  video: {
    label: `视频`,
    icon: A
  },
  sd2Video: {
    label: `SD2 视频`,
    icon: A
  },
  discountVideo: {
    label: `特惠视频`,
    icon: A
  },
  custom: {
    label: `万能`,
    icon: _Component33
  },
  rhWebapp: {
    label: `AI应用`,
    icon: _Component33
  }
};
var En = new Set([`discountVideo`, `sd2Video`]);
function Dn(e) {
  if (e == null) {
    return ``;
  }
  if (typeof e == `string`) {
    try {
      return JSON.stringify(JSON.parse(e), null, 2);
    } catch {
      return e;
    }
  }
  try {
    return JSON.stringify(e, null, 2);
  } catch {
    return String(e);
  }
}
function On(e) {
  if (e.status === `completed`) {
    return `已完成`;
  } else if (e.status === `failed`) {
    return `失败`;
  } else if (!e.progress || e.progress === 0) {
    return `生成中`;
  } else {
    return `${e.progress}%`;
  }
}
function kn(e) {
  if (e === `completed`) {
    return `text-emerald-400`;
  } else if (e === `failed`) {
    return `text-red-400`;
  } else {
    return `text-blue-400`;
  }
}
function An(e) {
  if (e === `completed`) {
    return `bg-emerald-400`;
  } else if (e === `failed`) {
    return `bg-red-400`;
  } else {
    return `bg-blue-400`;
  }
}
var Nn = W.memo(_cmp_jn);
var Pn = 20;
var Fn = (e, t) => {
  if (t === `all`) {
    return true;
  } else {
    if (t === `running`) {
      return e === `running` || e === `pending`;
    } else {
      return e === t;
    }
  }
};
var In = (e, t) => {
  if (t === `all`) {
    return true;
  } else {
    if (t === `video`) {
      return e === `video` || e === `sd2Video` || e === `discountVideo`;
    } else {
      return e === t;
    }
  }
};
var Rn = new Set(`prompt.text.content.query.question.caption.description.style.seed.steps.temperature.guidanceScale.cfgScale.strength.quality.width.height.resolution.size.aspectRatio.ratio.duration.videoDuration.selectedSeconds.videoDurations.discountVideoModel.sd2VideoModel.videoModel.selectedModel.imageUrl.videoUrl.audioUrl.referenceImage.referenceVideo.referenceAudio.maskUrl.fileUrl.model.modelName.outputType.apiUrl.method.body`.split(`.`));
var zn = new Set(`id.label.type.loading.progress.errorMessage.resultData.resultUrl.imageUrlThumbRef.imageUrlRef.imageUrlUploaded.hasChanged.config.variables.variableFormats.presetPrompts.selectedIds.images.extractedImages.allExtractedImages.hiddenIndices.onGenerate.onGenerateText.onGenerateSD2Video.onShowToast.onUploadAsset.onAddImage.onSpawnImageNode.onPushImagesToImageBox.onStop`.split(`.`));
var Bn = {
  selectedSeconds: `number`,
  videoDurations: `text`,
  discountVideoModel: `text`,
  sd2VideoModel: `text`,
  videoModel: `text`,
  selectedModel: `text`,
  videoDuration: `number`,
  duration: `number`,
  videoUrl: `video`,
  audioUrl: `audio`,
  imageUrl: `image`,
  referenceImage: `image`,
  referenceVideo: `video`,
  referenceAudio: `audio`,
  maskUrl: `image`,
  fileUrl: `text`
};
function Vn(e, t) {
  if (Bn[e]) {
    return Bn[e];
  } else if (typeof t == `boolean`) {
    return `boolean`;
  } else if (typeof t == `number`) {
    return `number`;
  } else if (/\b(image|cover|thumb|mask)\b/i.test(e)) {
    return `image`;
  } else if (/\b(video|gif)\b/i.test(e)) {
    return `video`;
  } else if (/\b(audio|voice)\b/i.test(e)) {
    return `audio`;
  } else if (/\b(json|config|body)\b/i.test(e)) {
    return `json`;
  } else {
    return `text`;
  }
}
var Hn = {
  prompt: `提示词`,
  text: `文本`,
  content: `内容`,
  query: `查询`,
  question: `问题`,
  caption: `标题`,
  description: `描述`,
  style: `风格`,
  seed: `种子`,
  steps: `步数`,
  temperature: `温度`,
  guidanceScale: `引导系数`,
  cfgScale: `CFG 系数`,
  strength: `强度`,
  quality: `质量`,
  width: `宽度`,
  height: `高度`,
  resolution: `分辨率`,
  size: `尺寸`,
  aspectRatio: `宽高比`,
  ratio: `比例`,
  duration: `时长`,
  videoDuration: `视频时长`,
  selectedSeconds: `时长(秒)`,
  videoDurations: `可选时长`,
  discountVideoModel: `特惠视频模型`,
  sd2VideoModel: `SD2视频模型`,
  videoModel: `视频模型`,
  selectedModel: `选中模型`,
  imageUrl: `图片地址`,
  videoUrl: `视频地址`,
  audioUrl: `音频地址`,
  referenceImage: `参考图片`,
  referenceVideo: `参考视频`,
  referenceAudio: `参考音频`,
  maskUrl: `蒙版地址`,
  fileUrl: `文件地址`,
  model: `模型`,
  modelName: `模型名称`,
  outputType: `输出类型`,
  apiUrl: `接口地址`,
  method: `请求方法`,
  body: `请求体`
};
function Un(e) {
  return Hn[e] || e;
}
var Wn = {
  discountVideoNode: `特惠视频`,
  videoNode: `普通视频`,
  sd2VideoNode: `SD2视频`,
  promptNode: `生图节点`,
  imageNode: `图片节点`,
  textNode: `文本生成`,
  audioNode: `听音断句`,
  imageBoxNode: `图片盒子`,
  videoExtractNode: `视频抽帧`,
  videoToGifNode: `视频转GIF`,
  imageCompressNode: `图片压缩`,
  faceMosaicNode: `人脸打码`,
  compareNode: `对比工具`,
  panoramaNode: `720全景图`,
  director3dNode: `3D 导演台`,
  rhWebappNode: `AI应用`,
  customNode: `万能节点`,
  gridMergeNode: `图像拼图`,
  gridSplitNode: `图像切分`,
  textConcatNode: `文字拼接`,
  cropNode: `裁剪模式`,
  urlToImageNode: `网址转图片`,
  fileToUrlNode: `文件转链接`,
  audioPlayerNode: `音频播放`
};
function Gn(e) {
  let t = e?.data?.label || e?.data?.name || e?.data?.title || e?.label;
  if (t) {
    return String(t);
  }
  let n = String(e?.type || ``);
  if (Wn[n]) {
    return Wn[n];
  } else {
    return e?.id || n || `参数`;
  }
}
function Kn(e) {
  return e == null || [`string`, `number`, `boolean`].includes(typeof e);
}
function qn(e) {
  if (!e) {
    return {
      nodes: [],
      edges: []
    };
  }
  try {
    let t = JSON.stringify(e, (e, t) => {
      if (typeof t == `function`) {
        return undefined;
      } else {
        return t;
      }
    });
    let n = JSON.parse(t);
    return {
      nodes: Array.isArray(n?.nodes) ? n.nodes : [],
      edges: Array.isArray(n?.edges) ? n.edges : []
    };
  } catch {
    return {
      nodes: Array.isArray(e?.nodes) ? e.nodes : [],
      edges: Array.isArray(e?.edges) ? e.edges : []
    };
  }
}
var Jn = new Set([`videoDurations`, `discountVideoModel`, `sd2VideoModel`, `videoModel`]);
function Yn(e) {
  let t = qn(e);
  let n = [];
  for (let e of t.nodes || []) {
    let t = e?.data || {};
    let r = Gn(e);
    let i = String(e?.type || `node`);
    for (let [a, o] of Object.entries(t)) {
      if (zn.has(a) || a.startsWith(`on`) || !Rn.has(a) || a === `text` || Jn.has(a) || !Kn(o) && !Array.isArray(o)) {
        continue;
      }
      let s = Vn(a, o);
      let c = `${e.id || r}.${a}`;
      let l = Un(a);
      let u = r && !r.match(/^.{0,30}Node-?\d+$/i) ? `${r} · ${l}` : l;
      let d = /^(selectedSeconds|selectedModel|videoDuration|duration|resolution|size|aspectRatio|ratio|steps|temperature|guidanceScale|cfgScale|strength|quality|width|height|seed)$/i.test(a);
      let f = d ? false : /^(prompt|text|content|query|question|caption)$/i.test(a) || /image|video|audio|mask|file|reference/i.test(a);
      let p = o;
      if (a === `selectedSeconds` && (!o || o === ``)) {
        p = (t.videoDurations || ``).split(`
`)[0].trim() || `10`;
      } else if (a === `selectedModel` && (!o || o === ``)) {
        p = (t.discountVideoModel || ``).split(`
`)[0].trim() || (t.sd2VideoModel || ``).split(`
`)[0].trim() || (t.videoModel || ``).split(`
`)[0].trim() || ``;
      }
      n.push({
        id: c,
        nodeId: String(e.id || r),
        nodeType: i,
        nodeLabel: r,
        key: a,
        label: u,
        type: s,
        required: d ? false : /^(prompt|text|image|video|audio)$/i.test(a),
        defaultValue: p,
        sourcePath: `data.${a}`,
        group: r,
        selected: f
      });
    }
  }
  let r = new Set();
  return n.filter(e => {
    if (r.has(e.id)) {
      return false;
    } else {
      r.add(e.id);
      return true;
    }
  });
}
function Xn(e) {
  let t = qn(e.workflowGraph);
  let n = e.inputFields.filter(e => {
    return e.selected;
  });
  return {
    appId: e.appId,
    projectId: e.projectId,
    projectName: e.projectName,
    appName: e.appName.trim(),
    description: e.description?.trim() || ``,
    visibility: e.visibility,
    workflowSnapshot: t,
    inputSchema: {
      fields: n.map((e, t) => {
        return {
          id: e.id,
          label: e.label.trim(),
          key: e.key,
          type: e.type,
          required: !!e.required,
          defaultValue: e.defaultValue,
          source: {
            nodeId: e.nodeId,
            path: e.sourcePath,
            nodeType: e.nodeType,
            nodeLabel: e.nodeLabel
          },
          group: e.group,
          order: t
        };
      })
    },
    mappingSchema: {
      fields: n.map(e => {
        return {
          id: e.id,
          nodeId: e.nodeId,
          path: e.sourcePath,
          key: e.key
        };
      })
    }
  };
}
function Zn(e, t = 2500) {
  return new Promise(n => {
    let r = false;
    let i = () => {
      if (!r) {
        r = true;
        window.removeEventListener(ft, a);
        n();
      }
    };
    let a = t => {
      let n = t.detail || {};
      if (!n.projectId || n.projectId === e) {
        i();
      }
    };
    window.addEventListener(ft, a);
    window.dispatchEvent(new CustomEvent(yt, {
      detail: {
        projectId: e
      }
    }));
    window.setTimeout(i, t);
  });
}
var er = `agent_chat_history_`;
function tr(e) {
  return `${er}${e}`;
}
async function nr(e) {
  try {
    let t = await z.getObject(tr(e));
    if (!t || typeof t != `object`) {
      return [];
    }
    let n = t;
    if (Array.isArray(n.messages)) {
      return n.messages.map(e => {
        if (e.streaming) {
          return {
            ...e,
            streaming: false
          };
        } else {
          return e;
        }
      });
    } else {
      return [];
    }
  } catch {
    return [];
  }
}
async function rr(e, t) {
  try {
    let n = {
      messages: t.slice(-100),
      updatedAt: Date.now()
    };
    await z.setObject(tr(e), n);
  } catch (e) {
    console.warn(`[Agent] 保存对话历史失败:`, e);
  }
}
async function ir(e) {
  try {
    await z.remove(tr(e));
  } catch {}
}
async function ar(e = `canvas-assistant`) {
  let t = We();
  if (!t) {
    return {
      allowed: false,
      message: `请先登录`
    };
  }
  let n = await fetch(`${Je}${st}/agent/${encodeURIComponent(e)}/vip-check`, {
    headers: {
      Authorization: `Bearer ${t}`
    }
  });
  if (n.ok) {
    return await n.json();
  } else {
    return {
      allowed: false,
      message: `VIP 校验失败 (${n.status})`
    };
  }
}
var or = [{
  type: `function`,
  function: {
    name: `list_nodes`,
    description: `列出当前画布上所有节点，包含 id、type、标题、选中状态、坐标。Agent 操作前应先调用以了解画布状态。`,
    parameters: {
      type: `object`,
      properties: {},
      required: []
    }
  }
}, {
  type: `function`,
  function: {
    name: `list_edges`,
    description: `列出当前画布上所有连线（边），包含 id、source、target、handle。用于查看节点间的数据流方向。`,
    parameters: {
      type: `object`,
      properties: {},
      required: []
    }
  }
}, {
  type: `function`,
  function: {
    name: `get_node_details`,
    description: `获取某个节点的完整 data（提示词、模型、尺寸、时长、生成结果 URL 等）。`,
    parameters: {
      type: `object`,
      properties: {
        nodeId: {
          type: `string`,
          description: `节点 ID`
        }
      },
      required: [`nodeId`]
    }
  }
}, {
  type: `function`,
  function: {
    name: `create_node`,
    description: `在画布上新建一个节点。type 可选：textNode（文本生成）、promptNode（生图）、discountVideoNode（特惠视频）、imageNode（图片展示）。如不指定 position，将放在当前视口中心。`,
    parameters: {
      type: `object`,
      properties: {
        type: {
          type: `string`,
          enum: [`textNode`, `promptNode`, `discountVideoNode`, `imageNode`],
          description: `节点类型`
        },
        prompt: {
          type: `string`,
          description: `节点初始提示词（textNode / promptNode / discountVideoNode 适用）`
        },
        label: {
          type: `string`,
          description: `节点标题（可选）`
        },
        position: {
          type: `object`,
          properties: {
            x: {
              type: `number`
            },
            y: {
              type: `number`
            }
          },
          description: `节点坐标（可选）`
        },
        connectFrom: {
          type: `string`,
          description: `若提供，则从该节点 ID 拉一条连线到新节点（可选）`
        }
      },
      required: [`type`]
    }
  }
}, {
  type: `function`,
  function: {
    name: `update_node`,
    description: `修改某个节点的参数。可修改字段：prompt（提示词）、label（标题）、selectedModel（模型名）、aspectRatio（比例，如 16:9 / 9:16 / 1:1）、resolution（分辨率，如 720p / 1080p）、seconds（视频时长秒数）、autoSplit（文本是否自动分段，boolean）、text（文本内容）。仅传入需修改的字段。`,
    parameters: {
      type: `object`,
      properties: {
        nodeId: {
          type: `string`,
          description: `节点 ID`
        },
        prompt: {
          type: `string`
        },
        label: {
          type: `string`
        },
        selectedModel: {
          type: `string`
        },
        aspectRatio: {
          type: `string`
        },
        resolution: {
          type: `string`
        },
        seconds: {
          type: `string`
        },
        autoSplit: {
          type: `boolean`
        },
        text: {
          type: `string`
        }
      },
      required: [`nodeId`]
    }
  }
}, {
  type: `function`,
  function: {
    name: `update_node_raw`,
    description: `高级：修改节点的任意原始 data 字段，不受白名单限制。用于自定义属性或调试。优先使用 update_node，仅在字段不在白名单内时用此工具。`,
    parameters: {
      type: `object`,
      properties: {
        nodeId: {
          type: `string`,
          description: `节点 ID`
        },
        patch: {
          type: `object`,
          description: `要合并到 node.data 的任意键值对`,
          additionalProperties: true
        }
      },
      required: [`nodeId`, `patch`]
    }
  }
}, {
  type: `function`,
  function: {
    name: `delete_node`,
    description: `删除画布上的某个节点（同时删除相关连线）。`,
    parameters: {
      type: `object`,
      properties: {
        nodeId: {
          type: `string`,
          description: `节点 ID`
        }
      },
      required: [`nodeId`]
    }
  }
}, {
  type: `function`,
  function: {
    name: `move_node`,
    description: `把节点移动到新坐标（画布坐标，非屏幕坐标）。`,
    parameters: {
      type: `object`,
      properties: {
        nodeId: {
          type: `string`,
          description: `节点 ID`
        },
        position: {
          type: `object`,
          properties: {
            x: {
              type: `number`
            },
            y: {
              type: `number`
            }
          },
          description: `新坐标`
        }
      },
      required: [`nodeId`, `position`]
    }
  }
}, {
  type: `function`,
  function: {
    name: `duplicate_node`,
    description: `复制节点（含 data 深拷贝），新节点偏移 50px。不复制连线。`,
    parameters: {
      type: `object`,
      properties: {
        nodeId: {
          type: `string`,
          description: `要复制的节点 ID`
        },
        offset: {
          type: `object`,
          properties: {
            x: {
              type: `number`
            },
            y: {
              type: `number`
            }
          },
          description: `相对偏移（可选，默认 {x:50,y:50}）`
        }
      },
      required: [`nodeId`]
    }
  }
}, {
  type: `function`,
  function: {
    name: `connect_nodes`,
    description: `在两个节点之间建立连线（数据流方向 source → target）。`,
    parameters: {
      type: `object`,
      properties: {
        source: {
          type: `string`,
          description: `上游节点 ID`
        },
        target: {
          type: `string`,
          description: `下游节点 ID`
        }
      },
      required: [`source`, `target`]
    }
  }
}, {
  type: `function`,
  function: {
    name: `delete_edge`,
    description: `删除一条连线。优先用 edgeId；若未提供 edgeId，可用 source+target 匹配。`,
    parameters: {
      type: `object`,
      properties: {
        edgeId: {
          type: `string`,
          description: `边 ID（优先）`
        },
        source: {
          type: `string`,
          description: `上游节点 ID（无 edgeId 时用）`
        },
        target: {
          type: `string`,
          description: `下游节点 ID（无 edgeId 时用）`
        }
      },
      required: []
    }
  }
}, {
  type: `function`,
  function: {
    name: `batch_create_nodes`,
    description: `批量创建多个节点。每次调用返回所有新节点 ID。比循环单条调用更高效。`,
    parameters: {
      type: `object`,
      properties: {
        nodes: {
          type: `array`,
          description: `要创建的节点列表`,
          items: {
            type: `object`,
            properties: {
              type: {
                type: `string`,
                enum: [`textNode`, `promptNode`, `discountVideoNode`, `imageNode`]
              },
              prompt: {
                type: `string`
              },
              label: {
                type: `string`
              },
              position: {
                type: `object`,
                properties: {
                  x: {
                    type: `number`
                  },
                  y: {
                    type: `number`
                  }
                }
              },
              connectFrom: {
                type: `string`,
                description: `可选：从该节点 ID 拉一条连线到新节点`
              }
            },
            required: [`type`]
          }
        }
      },
      required: [`nodes`]
    }
  }
}, {
  type: `function`,
  function: {
    name: `batch_delete_nodes`,
    description: `批量删除多个节点（同时删除相关连线）。`,
    parameters: {
      type: `object`,
      properties: {
        nodeIds: {
          type: `array`,
          items: {
            type: `string`
          },
          description: `要删除的节点 ID 列表`
        }
      },
      required: [`nodeIds`]
    }
  }
}, {
  type: `function`,
  function: {
    name: `batch_connect_nodes`,
    description: `批量建立多条连线。`,
    parameters: {
      type: `object`,
      properties: {
        pairs: {
          type: `array`,
          items: {
            type: `object`,
            properties: {
              source: {
                type: `string`
              },
              target: {
                type: `string`
              }
            },
            required: [`source`, `target`]
          },
          description: `要建立的连线列表`
        }
      },
      required: [`pairs`]
    }
  }
}, {
  type: `function`,
  function: {
    name: `batch_update_nodes`,
    description: `批量更新多个节点。每个 item 含 nodeId 和要修改的字段。`,
    parameters: {
      type: `object`,
      properties: {
        updates: {
          type: `array`,
          items: {
            type: `object`,
            properties: {
              nodeId: {
                type: `string`
              },
              patch: {
                type: `object`,
                additionalProperties: true,
                description: `要修改的字段键值对`
              }
            },
            required: [`nodeId`, `patch`]
          }
        }
      },
      required: [`updates`]
    }
  }
}, {
  type: `function`,
  function: {
    name: `trigger_generation`,
    description: `触发某个节点的生成任务（生图 / 文本生成 / 特惠视频）。节点必须已有提示词，否则返回失败。`,
    parameters: {
      type: `object`,
      properties: {
        nodeId: {
          type: `string`,
          description: `节点 ID`
        }
      },
      required: [`nodeId`]
    }
  }
}, {
  type: `function`,
  function: {
    name: `select_node`,
    description: `选中或取消选中某个节点（视觉高亮，便于用户定位 Agent 操作的目标）。`,
    parameters: {
      type: `object`,
      properties: {
        nodeId: {
          type: `string`
        },
        selected: {
          type: `boolean`,
          description: `是否选中，默认 true`
        }
      },
      required: [`nodeId`]
    }
  }
}, {
  type: `function`,
  function: {
    name: `select_nodes`,
    description: `多选：批量选中或取消选中多个节点。`,
    parameters: {
      type: `object`,
      properties: {
        nodeIds: {
          type: `array`,
          items: {
            type: `string`
          },
          description: `节点 ID 列表`
        },
        selected: {
          type: `boolean`,
          description: `是否选中，默认 true`
        }
      },
      required: [`nodeIds`]
    }
  }
}, {
  type: `function`,
  function: {
    name: `clear_selection`,
    description: `清空所有节点的选中状态。`,
    parameters: {
      type: `object`,
      properties: {},
      required: []
    }
  }
}, {
  type: `function`,
  function: {
    name: `focus_node`,
    description: `把画布视口移动到指定节点，让用户能立即看到该节点。`,
    parameters: {
      type: `object`,
      properties: {
        nodeId: {
          type: `string`
        }
      },
      required: [`nodeId`]
    }
  }
}, {
  type: `function`,
  function: {
    name: `get_viewport`,
    description: `获取当前视口状态（x, y, zoom）。`,
    parameters: {
      type: `object`,
      properties: {},
      required: []
    }
  }
}, {
  type: `function`,
  function: {
    name: `set_viewport`,
    description: `设置视口位置和缩放，用于平移或缩放到任意区域。`,
    parameters: {
      type: `object`,
      properties: {
        x: {
          type: `number`,
          description: `x 坐标`
        },
        y: {
          type: `number`,
          description: `y 坐标`
        },
        zoom: {
          type: `number`,
          description: `缩放比例（1=100%）`
        }
      },
      required: [`x`, `y`, `zoom`]
    }
  }
}, {
  type: `function`,
  function: {
    name: `fit_view`,
    description: `自适应视口，让所有节点可见。`,
    parameters: {
      type: `object`,
      properties: {
        padding: {
          type: `number`,
          description: `边距（0-1，默认 0.1）`
        },
        duration: {
          type: `number`,
          description: `动画时长（ms，默认 300）`
        }
      }
    }
  }
}, {
  type: `function`,
  function: {
    name: `zoom_in`,
    description: `视口放大一级。`,
    parameters: {
      type: `object`,
      properties: {},
      required: []
    }
  }
}, {
  type: `function`,
  function: {
    name: `zoom_out`,
    description: `视口缩小一级。`,
    parameters: {
      type: `object`,
      properties: {},
      required: []
    }
  }
}, {
  type: `function`,
  function: {
    name: `lock_node`,
    description: `锁定节点，禁止拖拽和选中，防止误操作。`,
    parameters: {
      type: `object`,
      properties: {
        nodeId: {
          type: `string`
        },
        locked: {
          type: `boolean`,
          description: `true=锁定，false=解锁，默认 true`
        }
      },
      required: [`nodeId`]
    }
  }
}, {
  type: `function`,
  function: {
    name: `group_nodes`,
    description: `把多个节点编组（新建 group 节点作为父级，子节点转为相对坐标）。`,
    parameters: {
      type: `object`,
      properties: {
        nodeIds: {
          type: `array`,
          items: {
            type: `string`
          },
          description: `要编组的节点 ID 列表（至少 2 个）`
        },
        groupId: {
          type: `string`,
          description: `可选：自定义 group 节点 ID`
        }
      },
      required: [`nodeIds`]
    }
  }
}, {
  type: `function`,
  function: {
    name: `ungroup_nodes`,
    description: `解除某个 group，子节点转为顶级节点（坐标转回绝对）。`,
    parameters: {
      type: `object`,
      properties: {
        groupId: {
          type: `string`,
          description: `group 节点 ID`
        }
      },
      required: [`groupId`]
    }
  }
}, {
  type: `function`,
  function: {
    name: `undo`,
    description: `撤销上一步画布操作（最多回退 15 步）。`,
    parameters: {
      type: `object`,
      properties: {},
      required: []
    }
  }
}, {
  type: `function`,
  function: {
    name: `redo`,
    description: `重做（与 undo 配对）。`,
    parameters: {
      type: `object`,
      properties: {},
      required: []
    }
  }
}];
var sr = {
  'canvas-assistant': or
};
function cr(e) {
  return sr[e] || or;
}
function lr(e, t, n) {
  try {
    switch (e) {
      case `list_nodes`:
        {
          let e = n.listNodes();
          return JSON.stringify({
            ok: true,
            count: e.length,
            nodes: e.map(e => {
              return {
                id: e.id,
                type: e.type,
                label: e.label || e.data?.label || ``,
                selected: !!e.selected,
                position: e.position
              };
            })
          });
        }
      case `list_edges`:
        {
          let e = n.listEdges();
          return JSON.stringify({
            ok: true,
            count: e.length,
            edges: e
          });
        }
      case `get_node_details`:
        {
          let {
            nodeId: e
          } = t;
          let r = n.listNodes().find(t => {
            return t.id === e;
          });
          if (!r) {
            return JSON.stringify({
              ok: false,
              error: `未找到节点 ${e}`
            });
          }
          let i = {};
          if (r.data) {
            for (let [e, t] of Object.entries(r.data)) {
              if (typeof t != `function`) {
                i[e] = t;
              }
            }
          }
          return JSON.stringify({
            ok: true,
            node: {
              id: r.id,
              type: r.type,
              label: r.label || i?.label || ``,
              position: r.position,
              data: i
            }
          });
        }
      case `create_node`:
        {
          let {
            type: e,
            prompt: r,
            label: i,
            position: a,
            connectFrom: o
          } = t;
          if (!e) {
            return JSON.stringify({
              ok: false,
              error: `缺少 type`
            });
          }
          let s = a || undefined;
          let c = {};
          if (r) {
            c.prompt = r;
          }
          if (i) {
            c.label = i;
          }
          let l = o ? {
            source: o,
            sourceHandle: null
          } : undefined;
          let u = n.addNode(e, s, c, l);
          n.showToast(`已创建 ${e} 节点`, `success`);
          return JSON.stringify({
            ok: true,
            nodeId: u
          });
        }
      case `update_node`:
        {
          let {
            nodeId: e,
            ...r
          } = t;
          if (!e) {
            return JSON.stringify({
              ok: false,
              error: `缺少 nodeId`
            });
          }
          let i = {};
          for (let [e, t] of Object.entries(r)) {
            if (t !== undefined) {
              i[e] = t;
            }
          }
          let a = n.updateNode(e, i);
          if (a) {
            n.showToast(`节点 ${e} 已更新`, `success`);
          }
          return JSON.stringify({
            ok: a,
            nodeId: e,
            patched: Object.keys(i)
          });
        }
      case `update_node_raw`:
        {
          let {
            nodeId: e,
            patch: r
          } = t;
          if (!e) {
            return JSON.stringify({
              ok: false,
              error: `缺少 nodeId`
            });
          }
          if (!r || typeof r != `object`) {
            return JSON.stringify({
              ok: false,
              error: `缺少 patch`
            });
          }
          let i = n.updateNode(e, r);
          return JSON.stringify({
            ok: i,
            nodeId: e,
            patched: Object.keys(r)
          });
        }
      case `delete_node`:
        {
          let {
            nodeId: e
          } = t;
          let r = n.deleteNode(e);
          if (r) {
            n.showToast(`节点 ${e} 已删除`, `info`);
          }
          return JSON.stringify({
            ok: r,
            nodeId: e
          });
        }
      case `move_node`:
        {
          let {
            nodeId: e,
            position: r
          } = t;
          if (!e || !r) {
            return JSON.stringify({
              ok: false,
              error: `缺少 nodeId / position`
            });
          }
          let i = n.moveNode(e, r);
          return JSON.stringify({
            ok: i,
            nodeId: e,
            position: r
          });
        }
      case `duplicate_node`:
        {
          let {
            nodeId: e,
            offset: r
          } = t;
          if (!e) {
            return JSON.stringify({
              ok: false,
              error: `缺少 nodeId`
            });
          }
          let i = n.duplicateNode(e, r);
          if (i) {
            n.showToast(`已复制节点 → ${i}`, `success`);
          }
          return JSON.stringify({
            ok: !!i,
            nodeId: i
          });
        }
      case `connect_nodes`:
        {
          let {
            source: e,
            target: r
          } = t;
          if (!e || !r) {
            return JSON.stringify({
              ok: false,
              error: `缺少 source/target`
            });
          }
          let i = n.connectNodes(e, r);
          if (i) {
            n.showToast(`已连接 ${e} → ${r}`, `success`);
          }
          return JSON.stringify({
            ok: i,
            source: e,
            target: r
          });
        }
      case `delete_edge`:
        {
          let {
            edgeId: e,
            source: r,
            target: i
          } = t;
          if (!e && (!r || !i)) {
            return JSON.stringify({
              ok: false,
              error: `需提供 edgeId 或 source+target`
            });
          }
          let a = n.deleteEdge(e, r, i);
          if (a) {
            n.showToast(`已删除连线`, `info`);
          }
          return JSON.stringify({
            ok: a,
            edgeId: e,
            source: r,
            target: i
          });
        }
      case `batch_create_nodes`:
        {
          let {
            nodes: e
          } = t;
          if (!Array.isArray(e) || e.length === 0) {
            return JSON.stringify({
              ok: false,
              error: `nodes 必须为非空数组`
            });
          }
          let r = [];
          for (let t of e) {
            try {
              let {
                type: e,
                prompt: i,
                label: a,
                position: o,
                connectFrom: s
              } = t;
              if (!e) {
                r.push({
                  ok: false,
                  error: `缺少 type`,
                  input: t
                });
                continue;
              }
              let c = o || undefined;
              let l = {};
              if (i) {
                l.prompt = i;
              }
              if (a) {
                l.label = a;
              }
              let u = s ? {
                source: s,
                sourceHandle: null
              } : undefined;
              let d = n.addNode(e, c, l, u);
              r.push({
                ok: true,
                nodeId: d,
                input: t
              });
            } catch (e) {
              r.push({
                ok: false,
                error: e?.message || String(e),
                input: t
              });
            }
          }
          n.showToast(`已批量创建 ${r.filter(e => {
            return e.ok;
          }).length}/${e.length} 个节点`, `success`);
          return JSON.stringify({
            ok: true,
            results: r
          });
        }
      case `batch_delete_nodes`:
        {
          let {
            nodeIds: e
          } = t;
          if (!Array.isArray(e) || e.length === 0) {
            return JSON.stringify({
              ok: false,
              error: `nodeIds 必须为非空数组`
            });
          }
          let r = e.map(e => {
            return {
              nodeId: e,
              ok: n.deleteNode(e)
            };
          });
          let i = r.filter(e => {
            return e.ok;
          }).length;
          n.showToast(`已批量删除 ${i}/${e.length} 个节点`, `info`);
          return JSON.stringify({
            ok: true,
            results: r
          });
        }
      case `batch_connect_nodes`:
        {
          let {
            pairs: e
          } = t;
          if (!Array.isArray(e) || e.length === 0) {
            return JSON.stringify({
              ok: false,
              error: `pairs 必须为非空数组`
            });
          }
          let r = e.map(e => {
            if (!e.source || !e.target) {
              return {
                ok: false,
                error: `缺少 source/target`,
                input: e
              };
            } else {
              return {
                ok: n.connectNodes(e.source, e.target),
                source: e.source,
                target: e.target
              };
            }
          });
          let i = r.filter(e => {
            return e.ok;
          }).length;
          n.showToast(`已批量连接 ${i}/${e.length} 条`, `success`);
          return JSON.stringify({
            ok: true,
            results: r
          });
        }
      case `batch_update_nodes`:
        {
          let {
            updates: e
          } = t;
          if (!Array.isArray(e) || e.length === 0) {
            return JSON.stringify({
              ok: false,
              error: `updates 必须为非空数组`
            });
          }
          let r = e.map(e => {
            if (e.nodeId) {
              return {
                ok: n.updateNode(e.nodeId, e.patch || {}),
                nodeId: e.nodeId,
                patched: Object.keys(e.patch || {})
              };
            } else {
              return {
                ok: false,
                error: `缺少 nodeId`,
                input: e
              };
            }
          });
          let i = r.filter(e => {
            return e.ok;
          }).length;
          n.showToast(`已批量更新 ${i}/${e.length} 个节点`, `success`);
          return JSON.stringify({
            ok: true,
            results: r
          });
        }
      case `trigger_generation`:
        {
          let {
            nodeId: e
          } = t;
          if (!e) {
            return JSON.stringify({
              ok: false,
              error: `缺少 nodeId`
            });
          }
          let r = n.triggerGeneration(e);
          if (r) {
            n.showToast(`节点 ${e} 已开始生成`, `success`);
          }
          return JSON.stringify({
            ok: r,
            nodeId: e
          });
        }
      case `select_node`:
        {
          let {
            nodeId: e,
            selected: r = true
          } = t;
          n.selectNode(e, r);
          return JSON.stringify({
            ok: true,
            nodeId: e,
            selected: r
          });
        }
      case `select_nodes`:
        {
          let {
            nodeIds: e,
            selected: r = true
          } = t;
          if (!Array.isArray(e)) {
            return JSON.stringify({
              ok: false,
              error: `nodeIds 必须为数组`
            });
          }
          let i = n.selectNodes(e, r);
          return JSON.stringify({
            ok: true,
            count: i,
            selected: r
          });
        }
      case `clear_selection`:
        {
          n.clearSelection();
          return JSON.stringify({
            ok: true
          });
        }
      case `focus_node`:
        {
          let {
            nodeId: e
          } = t;
          n.focusNode(e);
          return JSON.stringify({
            ok: true,
            nodeId: e
          });
        }
      case `get_viewport`:
        {
          let e = n.getViewport();
          return JSON.stringify({
            ok: true,
            viewport: e
          });
        }
      case `set_viewport`:
        {
          let {
            x: e,
            y: r,
            zoom: i
          } = t;
          if (typeof e != `number` || typeof r != `number` || typeof i != `number`) {
            return JSON.stringify({
              ok: false,
              error: `x/y/zoom 必须为数字`
            });
          } else {
            n.setViewport({
              x: e,
              y: r,
              zoom: i
            });
            return JSON.stringify({
              ok: true,
              viewport: {
                x: e,
                y: r,
                zoom: i
              }
            });
          }
        }
      case `fit_view`:
        {
          let {
            padding: e = 0.1,
            duration: r = 300
          } = t;
          n.fitView({
            padding: e,
            duration: r
          });
          return JSON.stringify({
            ok: true
          });
        }
      case `zoom_in`:
        {
          n.zoomIn();
          return JSON.stringify({
            ok: true
          });
        }
      case `zoom_out`:
        {
          n.zoomOut();
          return JSON.stringify({
            ok: true
          });
        }
      case `lock_node`:
        {
          let {
            nodeId: e,
            locked: r = true
          } = t;
          if (!e) {
            return JSON.stringify({
              ok: false,
              error: `缺少 nodeId`
            });
          }
          let i = n.setNodeLocked(e, r);
          if (i) {
            n.showToast(`节点 ${e} 已${r ? `锁定` : `解锁`}`, `info`);
          }
          return JSON.stringify({
            ok: i,
            nodeId: e,
            locked: r
          });
        }
      case `group_nodes`:
        {
          let {
            nodeIds: e,
            groupId: r
          } = t;
          if (!Array.isArray(e) || e.length < 2) {
            return JSON.stringify({
              ok: false,
              error: `nodeIds 至少 2 个`
            });
          }
          let i = n.groupNodes(e, r);
          if (i) {
            n.showToast(`已编组 ${e.length} 个节点`, `success`);
          }
          return JSON.stringify({
            ok: !!i,
            groupId: i
          });
        }
      case `ungroup_nodes`:
        {
          let {
            groupId: e
          } = t;
          if (!e) {
            return JSON.stringify({
              ok: false,
              error: `缺少 groupId`
            });
          }
          let r = n.ungroupNodes(e);
          if (r) {
            n.showToast(`已解散分组 ${e}`, `info`);
          }
          return JSON.stringify({
            ok: r,
            groupId: e
          });
        }
      case `undo`:
        {
          let e = n.undo();
          if (e) {
            n.showToast(`已撤销`, `info`);
          }
          return JSON.stringify({
            ok: e
          });
        }
      case `redo`:
        {
          let e = n.redo();
          if (e) {
            n.showToast(`已重做`, `info`);
          }
          return JSON.stringify({
            ok: e
          });
        }
      default:
        {
          return JSON.stringify({
            ok: false,
            error: `未知工具 ${e}`
          });
        }
    }
  } catch (e) {
    return JSON.stringify({
      ok: false,
      error: e?.message || String(e)
    });
  }
}
var ur = 8;
function dr(e) {
  let {
    agentKey: t,
    projectId: n,
    canvasHandleRef: r,
    defaultModel: i = `gpt-4o-mini`,
    systemPrompt: a
  } = e;
  let [o, s] = W.useState([]);
  let [c, l] = W.useState(false);
  let [u, d] = W.useState(null);
  let [f, p] = W.useState(i);
  let m = W.useRef(null);
  let h = W.useRef([]);
  let g = W.useRef(a || ``);
  W.useEffect(() => {
    g.current = a || ``;
  }, [a]);
  W.useEffect(() => {
    h.current = o;
  }, [o]);
  W.useEffect(() => {
    let e = false;
    (async () => {
      let t = await nr(n);
      if (!e) {
        s(t);
        h.current = t;
      }
    })();
    return () => {
      e = true;
    };
  }, [n]);
  W.useEffect(() => {
    return () => {
      m.current?.abort();
    };
  }, [n]);
  let _ = W.useCallback(async e => {
    await rr(n, e);
  }, [n]);
  let v = W.useCallback(async (e, n, r) => {
    let i = We();
    if (!i) {
      throw Error(`请先登录`);
    }
    let a = {
      model: f,
      messages: [{
        role: `system`,
        content: g.current
      }, ...e.filter(e => {
        return e.role !== `system`;
      }).map(e => {
        if (e.role === `user` && e.attachments && e.attachments.length > 0) {
          let t = e.attachments.map(e => {
            return {
              type: `image_url`,
              image_url: {
                url: e.url
              }
            };
          });
          if (e.content) {
            t.push({
              type: `text`,
              text: e.content
            });
          }
          return {
            role: `user`,
            content: t
          };
        }
        let t = {
          role: e.role,
          content: e.content || ``
        };
        if (e.tool_calls) {
          t.tool_calls = e.tool_calls;
        }
        if (e.tool_call_id) {
          t.tool_call_id = e.tool_call_id;
        }
        return t;
      })],
      tools: cr(t),
      tool_choice: `auto`,
      stream: true,
      temperature: 0.6
    };
    let o = await fetch(`${Je}${st}/agent/${encodeURIComponent(t)}/chat`, {
      method: `POST`,
      headers: {
        'Content-Type': `application/json`,
        Authorization: `Bearer ${i}`,
        Accept: `text/event-stream`
      },
      body: JSON.stringify(a),
      signal: n
    });
    if (!o.ok) {
      let e = await o.text().catch(() => {
        return ``;
      });
      let t = e;
      try {
        let n = JSON.parse(e);
        let r = n.error?.message || n.error || e;
        if (typeof r == `string`) {
          t = r;
        } else {
          t = JSON.stringify(r);
        }
      } catch {}
      throw Error(t || `调用失败 (${o.status})`);
    }
    let s = o.body.getReader();
    let c = new TextDecoder(`utf-8`);
    let l = ``;
    let u = ``;
    let d = ``;
    let p = [];
    let m = 0;
    let h = false;
    let _ = () => {
      m = Date.now();
      h = false;
      r?.({
        content: u,
        reasoning: d,
        toolCalls: [...p]
      });
    };
    let v = () => {
      if (!r) {
        return;
      }
      let e = Date.now();
      if (e - m >= 50) {
        _();
      } else if (!h) {
        h = true;
        setTimeout(_, 50 - (e - m));
      }
    };
    let y = e => {
      let t = e.split(`
`);
      for (let e of t) {
        if (!e.startsWith(`data:`)) {
          continue;
        }
        let t = e.slice(5).trim();
        if (!!t && t !== `[DONE]`) {
          try {
            let e = JSON.parse(t).choices?.[0]?.delta;
            if (!e) {
              continue;
            }
            let n = false;
            if (e.content) {
              u += e.content;
              n = true;
            }
            if (e.reasoning_content) {
              d += e.reasoning_content;
              n = true;
            } else if (e.reasoning) {
              d += e.reasoning;
              n = true;
            }
            if (Array.isArray(e.tool_calls)) {
              for (let t of e.tool_calls) {
                let e = t.index ?? 0;
                p[e] ||= {
                  id: t.id || ``,
                  type: `function`,
                  function: {
                    name: ``,
                    arguments: ``
                  }
                };
                if (t.id) {
                  p[e].id = t.id;
                }
                if (t.function?.name) {
                  p[e].function.name += t.function.name;
                }
                if (t.function?.arguments) {
                  p[e].function.arguments += t.function.arguments;
                }
              }
              n = true;
            }
            if (n) {
              v();
            }
          } catch {}
        }
      }
    };
    while (true) {
      let {
        done: e,
        value: t
      } = await s.read();
      if (e) {
        break;
      }
      l += c.decode(t, {
        stream: true
      });
      let n = l.split(`

`);
      l = n.pop() || ``;
      for (let e of n) {
        y(e);
      }
    }
    l += c.decode();
    if (l.trim()) {
      y(l);
    }
    _();
    let b = {
      role: `assistant`,
      content: u || ``,
      model: f,
      createdAt: Date.now()
    };
    if (d) {
      b.reasoning = d;
    }
    if (p.length > 0) {
      b.tool_calls = p.filter(e => {
        return e.function?.name;
      });
    }
    return b;
  }, [f, t]);
  return {
    messages: o,
    sending: c,
    error: u,
    model: f,
    setModel: p,
    send: W.useCallback(async (e, t) => {
      if (c || !e.trim() && (!t || t.length === 0)) {
        return;
      }
      d(null);
      let n = {
        role: `user`,
        content: e,
        createdAt: Date.now()
      };
      if (t && t.length > 0) {
        n.attachments = t;
      }
      let i = [...h.current, n];
      s(i);
      h.current = i;
      l(true);
      let a = new AbortController();
      m.current = a;
      try {
        let e = i;
        for (let t = 0; t < ur; t++) {
          let t = {
            role: `assistant`,
            content: ``,
            model: f,
            streaming: true,
            createdAt: Date.now()
          };
          s(e => {
            return [...e, t];
          });
          e = [...e, t];
          let n = await v(e, a.signal, e => {
            s(t => {
              let n = [...t];
              let r = n[n.length - 1];
              if (r && r.role === `assistant` && r.streaming) {
                n[n.length - 1] = {
                  ...r,
                  content: e.content,
                  reasoning: e.reasoning || undefined,
                  tool_calls: e.toolCalls.filter(e => {
                    return e.function?.name;
                  })
                };
              }
              return n;
            });
          });
          s(e => {
            let t = [...e];
            t[t.length - 1] = {
              ...n,
              streaming: false
            };
            return t;
          });
          e = [...e.slice(0, -1), {
            ...n,
            streaming: false
          }];
          if (!n.tool_calls || n.tool_calls.length === 0) {
            break;
          }
          let i = r.current;
          for (let t of n.tool_calls) {
            let n = {};
            if (t.function?.arguments) {
              try {
                n = JSON.parse(t.function.arguments);
              } catch (e) {
                console.warn(`[Agent] 工具参数 JSON.parse 失败:`, t.function?.name, t.function?.arguments, e);
              }
            }
            let r = {
              role: `tool`,
              content: i ? lr(t.function.name, n, i) : JSON.stringify({
                ok: false,
                error: `画布句柄未就绪`
              }),
              tool_call_id: t.id,
              createdAt: Date.now()
            };
            s(e => {
              return [...e, r];
            });
            e = [...e, r];
          }
          await _(e);
        }
        await _(e);
      } catch (e) {
        if (e?.name === `AbortError`) {
          d(`已停止`);
        } else {
          d(e?.message || `发送失败`);
        }
        s(e => {
          let t = [...e];
          if (t.length > 0 && t[t.length - 1].streaming) {
            t.pop();
          }
          return t;
        });
      } finally {
        l(false);
        m.current = null;
      }
    }, [c, f, v, r, _]),
    stop: W.useCallback(() => {
      m.current?.abort();
    }, []),
    clear: W.useCallback(async () => {
      m.current?.abort();
      m.current = null;
      s([]);
      h.current = [];
      d(null);
      await ir(n);
    }, [n])
  };
}
var fr = `canvas-assistant`;
var pr = `agent_selected_model`;
var mr = 320;
var hr = 720;
var gr = 380;
function _r(e) {
  return `agent_selected_model_${e}`;
}
function vr(e) {
  return `agent_panel_width_${e}`;
}
function yr(e) {
  let t = localStorage.getItem(vr(e));
  let n = t ? Number(t) : NaN;
  if (Number.isFinite(n)) {
    return Math.min(hr, Math.max(mr, n));
  } else {
    return gr;
  }
}
function br(e) {
  if (e !== fr) {
    return null;
  }
  let t = _r(e);
  if (localStorage.getItem(t)) {
    return null;
  }
  let n = localStorage.getItem(pr);
  if (n) {
    localStorage.setItem(t, n);
    localStorage.removeItem(pr);
    return n;
  } else {
    return null;
  }
}
function Er(e) {
  if (!e || me()) {
    return e;
  }
  let t = window.location.hostname;
  if (t && t !== `127.0.0.1` && t !== `localhost`) {
    return e.replace(/127\.0\.0\.1/g, t);
  } else {
    return e;
  }
}
function Dr(e) {
  let t = {
    ...e
  };
  t.isFavorite = e.isFavorite === 1 || e.isFavorite === true;
  if (typeof t.timestamp == `number`) {
    t.timestamp = t.timestamp;
  } else {
    t.timestamp = Number(t.timestamp) || 0;
  }
  t.url &&= Er(t.url);
  for (let e of [`pageUrl`, `pageTitle`, `source`, `folder`, `name`]) {
    if (t[e] === ``) {
      delete t[e];
    }
  }
  return t;
}
function Or(e) {
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
async function kr(e = {}) {
  let t = Or({
    sortBy: `timestamp`,
    sortDir: `DESC`,
    ...e
  });
  let n = await fetch(`${ge()}/api/resources?${t}`);
  if (!n.ok) {
    throw Error(`listResources failed: HTTP ${n.status}`);
  }
  let r = await n.json();
  return {
    items: Array.isArray(r.items) ? r.items.map(Dr) : [],
    total: r.total ?? 0,
    page: r.page ?? 1,
    pageSize: r.pageSize ?? (e.pageSize || 20),
    totalPages: r.totalPages ?? 0
  };
}
async function Ar(e) {
  try {
    return (await fetch(`${ge()}/api/resources/save`, {
      method: `POST`,
      headers: {
        'Content-Type': `application/json`
      },
      body: JSON.stringify(e)
    })).ok;
  } catch (e) {
    console.error(`[resourceStore] saveResource error`, e);
    return false;
  }
}
async function jr(e, t) {
  return Ar({
    ...e,
    isFavorite: t
  });
}
async function Mr(e) {
  try {
    return (await fetch(`${ge()}/api/resources/delete?id=${encodeURIComponent(e)}`, {
      method: `POST`
    })).ok;
  } catch (e) {
    console.error(`[resourceStore] deleteResource error`, e);
    return false;
  }
}
async function Nr(e = ``, t = true) {
  try {
    let n = await fetch(`${ge()}/api/resources/clear`, {
      method: `POST`,
      headers: {
        'Content-Type': `application/json`
      },
      body: JSON.stringify({
        folder: e,
        deleteFiles: t
      })
    });
    if (n.ok) {
      return (await n.json()).deleted ?? 0;
    } else {
      return 0;
    }
  } catch (e) {
    console.error(`[resourceStore] clearResources error`, e);
    return 0;
  }
}
async function Pr() {
  try {
    let e = await fetch(`${ge()}/api/resources/rescan`, {
      method: `POST`
    });
    if (e.ok) {
      return (await e.json()).count ?? 0;
    } else {
      return 0;
    }
  } catch (e) {
    console.error(`[resourceStore] rescanResources error`, e);
    return 0;
  }
}
var Fr = 200;
var Ir = `tasks_seeded_to_sqlite`;
var Lr = `resources_seeded_to_sqlite`;
var Rr = [];
var Br = `data:image/svg+xml;utf8,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'80'%20height%3D'80'%20viewBox%3D'0%200%2080%2080'%3E%3Crect%20width%3D'80'%20height%3D'80'%20fill%3D'%232f3a4a'%2F%3E%3Ccircle%20cx%3D'40'%20cy%3D'31'%20r%3D'15'%20fill%3D'%23cbd5e1'%2F%3E%3Cpath%20d%3D'M14%2070c0-15%2012-24%2026-24s26%209%2026%2024z'%20fill%3D'%23cbd5e1'%2F%3E%3C%2Fsvg%3E`;
export { _cmp_Ln, _cmp_Lt, _cmp_Qt, _cmp_Sr, _cmp_Tr, _cmp_Xt, _cmp_jn, e, _Component7, _Component37, r, _Component30, a, _Component4, _Component6, _Component46, _Component33, _Component12, _Component15, _Component28, _Component2, _Component36, _Component3, g, _, _Component1, _Component29, _Component10, _Component9, S, C, _Component23, T, E, D, O, _Component27, A, _Component45, M, N, P, _Component0, F, I, _Component25, L, _Component20, _Component32, _Component21, _Component35, R, _Component8, _Component5, _Component44, _Component, _Component26, _Component16, _Component31, _Component17, me, he, ge, _e, ve, ye, be, xe, Se, Ce, we, Te, Ee, De, Oe, z, ke, Ae, je, Me, Ne, Pe, Fe, Ie, Le, Re, ze, Be, Ve, He, B, Ue, We, Ge, Ke, qe, Je, Ye, Xe, Ze, Qe, $e, et, tt, _Component39, rt, it, at, ot, st, _Component13, lt, ut, dt, ft, pt, mt, ht, gt, _t, vt, yt, bt, xt, St, V, Ct, H, wt, Tt, Et, U, W, Dt, Ot, kt, At, jt, Mt, Nt, Pt, G, K, Rt, zt, Bt, Vt, Ht, Ut, Wt, Gt, Kt, q, qt, J, Jt, Yt, rn, an, on, cn, ln, un, fn, _n, yn, bn, xn, Sn, Tn, En, Dn, On, kn, An, Nn, Pn, Fn, In, Rn, zn, Bn, Vn, Hn, Un, Wn, Gn, Kn, qn, Jn, Yn, Xn, Zn, er, tr, nr, rr, ir, ar, or, sr, cr, lr, ur, dr, fr, pr, mr, hr, gr, _r, vr, yr, br, Er, Dr, Or, kr, Ar, jr, Mr, Nr, Pr, Fr, Ir, Lr, Rr, Br, setDiscountVideoApiConfigModels };