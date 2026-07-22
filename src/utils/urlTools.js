// 切自 src/App.js L23-57（URL 工具层）。剪切不重写，混淆名原样保留。
import { r as Vn } from '../entry.js';

var $n = Vn(),
  er = `/api`;
function tr(e) {
  let t = $n.replace(/[`\s]/g, ``).replace(/\/$/, ``),
    n = (e || t).replace(/[`\s]/g, ``).trim().replace(/\/$/, ``);
  return n ? /\/api$/i.test(n) ? n : `${n}/api` : `${t}/api`;
}
function nr(e = ``) {
  let t = $n.replace(/[`\s]/g, ``).replace(/\/+$/, ``),
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
export {
  $n, er, tr, nr, rr, ir, ar, sr, cr
};
