const __vite__mapDeps = (i, m = __vite__mapDeps, d = m.f || (m.f = ["./App-BX6o9fW5.js", "./rolldown-runtime-aKtaBQYM.js", "./src-kC58-PF2.js", "./src-DoQUrSOl.css", "./vendor-Z-adA07W.js", "./vendor-Qkhkn02K.css", "./httpClient-BknZwXjG.js", "./endpointConfig-Bt85xi8d.js", "./httpClient-DFxwm5B3.css"])) => i.map((i) => d[i]);
import { i as e } from "./rolldown-runtime-aKtaBQYM.js";
import "./src-kC58-PF2.js";
import { Fr as t, Ir as n, Pr as r, Rr as i } from "./vendor-Z-adA07W.js";
import { n as a } from "./endpointConfig-Bt85xi8d.js";
var o = e(i(), 1),
  s = e(n(), 1),
  c = t(),
  l = class extends o.Component {
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
      console.error(`[RootErrorBoundary] 捕获到未处理异常:`, e, t);
    }
    render() {
      return this.state.hasError ? (0, c.jsxs)(`div`, {
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
        children: [(0, c.jsx)(`div`, {
          style: {
            fontSize: 16,
            fontWeight: 600
          },
          children: `页面加载遇到问题`
        }), (0, c.jsx)(`div`, {
          style: {
            fontSize: 13,
            color: `#9ca3af`,
            maxWidth: 420,
            lineHeight: 1.6
          },
          children: `可能是网络或代理导致部分数据加载失败。你可以重试，若仍异常请尝试关闭代理后再打开。`
        }), (0, c.jsx)(`button`, {
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
  u = console.error;
console.error = (...e) => {
  typeof e[0] == `string` && e[0].includes(`ResizeObserver loop`) || u.call(console, ...e);
}, window.addEventListener(`error`, (e) => {
  (e.message.includes(`ResizeObserver loop limit exceeded`) || e.message.includes(`ResizeObserver loop completed with undelivered notifications`)) && (e.stopImmediatePropagation(), e.preventDefault());
});
async function d() {
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
    } = await import(`./App-BX6o9fW5.js`);
    return {
      default: e
    };
  }, __vite__mapDeps([0, 1, 2, 3, 4, 5, 6, 7, 8]), import.meta.url);
  (0, s.createRoot)(document.getElementById(`root`)).render((0, c.jsx)(o.StrictMode, {
    children: (0, c.jsx)(l, {
      children: (0, c.jsx)(e, {})
    })
  }));
}
d();