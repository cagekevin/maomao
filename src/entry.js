import { ENDPOINTS, DEFAULT_ENDPOINT, localEngineBase, LOCAL_ENGINE } from './config.js';
// 原版样式（已预编译的最终 Tailwind 输出 + 自定义样式），静态引入以确保打包进 bundle
// 顺序：Tailwind 原子类主体 -> 组件库样式 -> App 自定义样式
import './styles/tailwind.css';
import './styles/vendor.css';
import './styles/app.css';
// 在 engine chunk 内直接解包 React/ReactDOM 并挂 window，保证时序
// engine chunk 先于 main chunk 执行，所以必须在这里完成解包
import { i as unwrapModule } from './vendor/rolldown-runtime.js';
import { Ar as t, Nr as VendorReact, jr as VendorReactDOM } from './vendor/vendor.js';
var React = unwrapModule(VendorReact(), 1);
var ReactDOM = unwrapModule(VendorReactDOM(), 1);
window.__React = React;
window.__ReactDOM = ReactDOM;
var i = React,
  a = ReactDOM,
  o = `active_api_endpoint`,
  s = String(LOCAL_ENGINE.port);
function c(e) {
  return (e || ``).replace(/[`\s]/g, ``).trim().replace(/\/$/, ``);
}
function l() {
  return ENDPOINTS;
}
var u = l();
function d() {
  return u[0]?.url || c(DEFAULT_ENDPOINT);
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
  E = function (e) {
    return e();
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
    } = await import(`./App.js`);
    return {
      default: e
    };
  });
  a.createRoot(document.getElementById(`root`)).render(S.jsx(i.StrictMode, {
    children: S.jsx(D, {
      children: S.jsx(e, {})
    })
  }));
}
// entry.js 是 index.html 直接引用的唯一入口
k();
export { x as i, u as n, y as r, E as t };