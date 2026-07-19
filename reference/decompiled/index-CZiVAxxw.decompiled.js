const __vite__mapDeps = (i, m = __vite__mapDeps, d = m.f || (m.f = ["./App-B9jVCs-a.js", "./rolldown-runtime-aKtaBQYM.js", "./vendor-Cr1JWW-B.js", "./vendor-Qkhkn02K.css", "./App-DFxwm5B3.css"])) => i.map(i => d[i]);
import { i as e } from "./rolldown-runtime-aKtaBQYM.js";
import { Ar as t, Nr as n, jr as r } from "./vendor-Cr1JWW-B.js";
(function () {
  let e = document.createElement(`link`).relList;
  if (e && e.supports && e.supports(`modulepreload`)) return;
  for (let e of document.querySelectorAll(`link[rel="modulepreload"]`)) n(e);
  new MutationObserver(e => {
    for (let t of e) if (t.type === `childList`) for (let e of t.addedNodes) e.tagName === `LINK` && e.rel === `modulepreload` && n(e);
  }).observe(document, {
    childList: true,
    subtree: true
  });
  function t(e) {
    let t = {};
    return e.integrity && (t.integrity = e.integrity), e.referrerPolicy && (t.referrerPolicy = e.referrerPolicy), e.crossOrigin === `use-credentials` ? t.credentials = `include` : e.crossOrigin === `anonymous` ? t.credentials = `omit` : t.credentials = `same-origin`, t;
  }
  function n(e) {
    if (e.ep) return;
    e.ep = true;
    let n = t(e);
    fetch(e.href, n);
  }
})();
var i = e(n(), 1),
  a = e(r(), 1),
  o = `active_api_endpoint`,
  s = `18080`;
function c(e) {
  return (e || ``).replace(/[`\s]/g, ``).trim().replace(/\/$/, ``);
}
function l() {
  let e = [{
    label: `默认接入点`,
    url: c(`http://154.219.102.152:3012`)
  }];
  try {
    let t = JSON.parse(`[{"label":"主接入点","url":"https://www.1mao.cc"},{"label":"备用接入点1","url":"https://1mao.16iai.com"},{"label":"备用接入点2","url":"http://154.219.102.152:3012"}]`);
    if (!Array.isArray(t)) return e;
    let n = t.map(e => ({
      label: String(e?.label || e?.url || ``).trim(),
      url: c(String(e?.url || ``))
    })).filter(e => !!e.url);
    return n.length > 0 ? n : e;
  } catch (t) {
    return console.warn(`[endpointConfig] 解析 VITE_API_ENDPOINTS 失败，使用默认接入点:`, t), e;
  }
}
var u = l();
function d() {
  return u[0]?.url || c(`http://154.219.102.152:3012`);
}
function f() {
  try {
    let e = sessionStorage.getItem(o);
    return e ? c(e) : null;
  } catch {
    return null;
  }
}
function p(e) {
  try {
    sessionStorage.setItem(o, c(e));
  } catch {}
}
function m() {
  try {
    sessionStorage.removeItem(o);
  } catch {}
}
function h() {
  return window.localTool?.status?.port || s;
}
function g(e) {
  if (e == null || e === ``) return null;
  if (typeof e == `string`) {
    let t = e.trim();
    if (!t) return null;
    if (t.startsWith(`"`) || t.startsWith(`{`)) try {
      return g(JSON.parse(t));
    } catch {
      return c(t);
    }
    return c(t);
  }
  if (typeof e == `object`) {
    let t = e;
    if (typeof t.url == `string`) return c(t.url);
    if (typeof t.value == `string`) return g(t.value);
  }
  return null;
}
async function _() {
  try {
    let e = await fetch(`http://127.0.0.1:${h()}/api/kv/get?key=${o}`);
    return e.ok ? g(await e.json()) : null;
  } catch {
    return null;
  }
}
async function v(e) {
  try {
    return (await fetch(`http://127.0.0.1:${h()}/api/kv/set`, {
      method: `POST`,
      headers: {
        "Content-Type": `application/json`
      },
      body: JSON.stringify({
        key: o,
        value: c(e)
      })
    })).ok;
  } catch {
    return false;
  }
}
function y() {
  return f() || d();
}
async function b() {
  let e = f();
  if (e) return e;
  let t = await _();
  return t ? (p(t), t) : d();
}
async function x(e) {
  let t = c(e);
  if (!t) return false;
  let n = await v(t);
  return n && m(), n;
}
var S = t(),
  C = `modulepreload`,
  w = function (e, t) {
    return new URL(e, t).href;
  },
  T = {},
  E = function (e, t, n) {
    let r = Promise.resolve();
    if (t && t.length > 0) {
      let e = document.getElementsByTagName(`link`),
        i = document.querySelector(`meta[property=csp-nonce]`),
        a = i?.nonce || i?.getAttribute(`nonce`);
      function o(e) {
        return Promise.all(e.map(e => Promise.resolve(e).then(e => ({
          status: `fulfilled`,
          value: e
        }), e => ({
          status: `rejected`,
          reason: e
        }))));
      }
      r = o(t.map(t => {
        if (t = w(t, n), t in T) return;
        T[t] = true;
        let r = t.endsWith(`.css`),
          i = r ? `[rel="stylesheet"]` : ``;
        if (n) for (let n = e.length - 1; n >= 0; n--) {
          let i = e[n];
          if (i.href === t && (!r || i.rel === `stylesheet`)) return;
        } else if (document.querySelector(`link[href="${t}"]${i}`)) return;
        let o = document.createElement(`link`);
        if (o.rel = r ? `stylesheet` : C, r || (o.as = `script`), o.crossOrigin = ``, o.href = t, a && o.setAttribute(`nonce`, a), document.head.appendChild(o), r) return new Promise((e, n) => {
          o.addEventListener(`load`, e), o.addEventListener(`error`, () => n(Error(`Unable to preload CSS for ${t}`)));
        });
      }));
    }
    function i(e) {
      let t = new Event(`vite:preloadError`, {
        cancelable: true
      });
      if (t.payload = e, window.dispatchEvent(t), !t.defaultPrevented) throw e;
    }
    return r.then(t => {
      for (let e of t || []) e.status === `rejected` && i(e.reason);
      return e().catch(i);
    });
  },
  D = class extends i.Component {
    constructor(e) {
      super(e), this.state = {
        hasError: false,
        error: null
      };
    }
    static getDerivedStateFromError(e) {
      return {
        hasError: true,
        error: e
      };
    }
    componentDidCatch(e, t) {
      console.error(`[RootErrorBoundary] 捕获到未处理异常:`, e, t);
    }
    render() {
      return this.state.hasError ? S.jsxs(`div`, {
        style: {
          minHeight: `100vh`,
          display: `flex`,
          flexDirection: `column`,
          alignItems: `center`,
          justifyContent: `center`,
          gap: 16,
          background: `#0d0c0c`,
          color: `#e5e5e5`,
          padding: 24,
          textAlign: `center`
        },
        children: [S.jsx(`div`, {
          style: {
            fontSize: 16,
            fontWeight: 600
          },
          children: `页面加载遇到问题`
        }), S.jsx(`div`, {
          style: {
            fontSize: 13,
            color: `#9ca3af`,
            maxWidth: 420,
            lineHeight: 1.6
          },
          children: `可能是网络或代理导致部分数据加载失败。你可以重试，若仍异常请尝试关闭代理后再打开。`
        }), S.jsx(`button`, {
          onClick: () => window.location.reload(),
          style: {
            padding: `8px 20px`,
            borderRadius: 8,
            border: `1px solid #333`,
            background: `#2a2a2a`,
            color: `#fff`,
            cursor: `pointer`,
            fontSize: 13
          },
          children: `重新加载`
        })]
      }) : this.props.children;
    }
  },
  O = console.error;
console.error = (...e) => {
  typeof e[0] == `string` && e[0].includes(`ResizeObserver loop`) || O.call(console, ...e);
}, window.addEventListener(`error`, e => {
  (e.message.includes(`ResizeObserver loop limit exceeded`) || e.message.includes(`ResizeObserver loop completed with undelivered notifications`)) && (e.stopImmediatePropagation(), e.preventDefault());
});
async function k() {
  try {
    await b();
  } catch (e) {
    console.warn(`[main] 接入点引导失败，使用默认接入点:`, e);
  }
  let {
    default: e
  } = await E(async () => {
    let {
      default: e
    } = await import(`./App-B9jVCs-a.js`);
    return {
      default: e
    };
  }, __vite__mapDeps([0, 1, 2, 3, 4]), import.meta.url);
  a.createRoot(document.getElementById(`root`)).render(S.jsx(i.StrictMode, {
    children: S.jsx(D, {
      children: S.jsx(e, {})
    })
  }));
}
k();
export { x as i, u as n, y as r, E as t };