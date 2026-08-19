const __vite__mapDeps = (i, m = __vite__mapDeps, d = m.f || (m.f = ["./ShareAppPage-J_0Zovf4.js", "./rolldown-runtime-aKtaBQYM.js", "./vendor-Z-adA07W.js", "./vendor-Qkhkn02K.css", "./httpClient-BEVPUWLI.js", "./endpointConfig-Bt85xi8d.js", "./httpClient-DFxwm5B3.css"])) => i.map(i => d[i]);
import { i as e } from "./rolldown-runtime-aKtaBQYM.js";
import "./src-BUqq4fCC.js";
import { Fr as t, Ir as n, Pr as r } from "./vendor-Z-adA07W.js";
var i = e(n(), 1),
  a = t();
window.__CANVAS_RUNTIME__ = {
  disableLocalTool: !0
};
async function o() {
  let {
    default: e
  } = await r(async () => {
    let {
      default: e
    } = await import(`./ShareAppPage-J_0Zovf4.js`);
    return {
      default: e
    };
  }, __vite__mapDeps([0, 1, 2, 3, 4, 5, 6]), import.meta.url);
  (0, i.createRoot)(document.getElementById(`root`)).render((0, a.jsx)(e, {}));
}
o();