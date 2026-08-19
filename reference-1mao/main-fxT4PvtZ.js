const __vite__mapDeps = (i, m = __vite__mapDeps, d = m.f || (m.f = ["./App-C7SghiU5.js", "./rolldown-runtime-aKtaBQYM.js", "./src-BUqq4fCC.js", "./src-CoR0E5kW.css", "./vendor-Z-adA07W.js", "./vendor-Qkhkn02K.css", "./httpClient-BEVPUWLI.js", "./endpointConfig-Bt85xi8d.js", "./httpClient-DFxwm5B3.css"])) => i.map(i => d[i]);
import { i as e } from "./rolldown-runtime-aKtaBQYM.js";
import "./src-BUqq4fCC.js";
import { Fr as t, Ir as n, Pr as r, Rr as i } from "./vendor-Z-adA07W.js";
import { n as a, o } from "./endpointConfig-Bt85xi8d.js";
var s = e(i(), 1),
  c = e(n(), 1),
  l = 12e3,
  u = `/api/errors/report`;
function d(e) {
  if (e != null) {
    if (typeof e == `string`) return e.slice(0, l);
    try {
      return JSON.stringify(e).slice(0, l);
    } catch {
      return String(e).slice(0, l);
    }
  }
}
function f(e) {
  let t = {
    source: e.source,
    message: d(e.message),
    stack: d(e.stack),
    componentStack: d(e.componentStack),
    details: d(e.details),
    url: window.location.href,
    userAgent: navigator.userAgent
  };
  fetch(`${o()}${u}`, {
    method: `POST`,
    headers: {
      "Content-Type": `application/json`
    },
    body: JSON.stringify(t),
    keepalive: !0
  }).catch(() => {});
}
function p() {
  let e = e => {
      e.message.includes(`ResizeObserver loop limit exceeded`) || e.message.includes(`ResizeObserver loop completed with undelivered notifications`) || f({
        source: `window.error`,
        message: e.message,
        stack: e.error?.stack,
        details: {
          filename: e.filename,
          lineno: e.lineno,
          colno: e.colno
        }
      });
    },
    t = e => {
      let t = e.reason;
      f({
        source: `unhandledrejection`,
        message: t instanceof Error ? t.message : t,
        stack: t instanceof Error ? t.stack : void 0
      });
    };
  return window.addEventListener(`error`, e), window.addEventListener(`unhandledrejection`, t), () => {
    window.removeEventListener(`error`, e), window.removeEventListener(`unhandledrejection`, t);
  };
}
var m = t(),
  h = class extends s.Component {
    constructor(e) {
      super(e), this.state = {
        hasError: !1,
        error: null
      };
    }
    static getDerivedStateFromError(e) {
      return {
        hasError: !0,
        error: e
      };
    }
    componentDidCatch(e, t) {
      console.error(`[RootErrorBoundary] 捕获到未处理异常:`, e, t), f({
        source: `react.error-boundary`,
        message: e.message,
        stack: e.stack,
        componentStack: t
      });
    }
    render() {
      return this.state.hasError ? (0, m.jsxs)(`div`, {
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
        children: [(0, m.jsx)(`div`, {
          style: {
            fontSize: 16,
            fontWeight: 600
          },
          children: `页面加载遇到问题`
        }), (0, m.jsx)(`div`, {
          style: {
            fontSize: 13,
            color: `#9ca3af`,
            maxWidth: 420,
            lineHeight: 1.6
          },
          children: `可能是网络或代理导致部分数据加载失败。你可以重试，若仍异常请尝试关闭代理后再打开。`
        }), (0, m.jsx)(`button`, {
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
  g = console.error;
console.error = (...e) => {
  typeof e[0] == `string` && e[0].includes(`ResizeObserver loop`) || g.call(console, ...e);
}, window.addEventListener(`error`, e => {
  (e.message.includes(`ResizeObserver loop limit exceeded`) || e.message.includes(`ResizeObserver loop completed with undelivered notifications`)) && (e.stopImmediatePropagation(), e.preventDefault());
}), p();
async function _() {
  try {
    await a();
  } catch (e) {
    console.warn(`[main] 接入点引导失败，使用默认接入点:`, e);
  }
  let {
    default: e
  } = await r(async () => {
    let {
      default: e
    } = await import(`./App-C7SghiU5.js`);
    return {
      default: e
    };
  }, __vite__mapDeps([0, 1, 2, 3, 4, 5, 6, 7, 8]), import.meta.url);
  (0, c.createRoot)(document.getElementById(`root`)).render((0, m.jsx)(s.StrictMode, {
    children: (0, m.jsx)(h, {
      children: (0, m.jsx)(e, {})
    })
  }));
}
_();