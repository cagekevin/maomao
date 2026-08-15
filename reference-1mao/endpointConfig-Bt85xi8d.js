var e = `18080`;
function t() {
  try {
    return typeof chrome < `u` && !!chrome.runtime && !!chrome.runtime.id;
  } catch {
    return !1;
  }
}
function n() {
  return t() ? `http://127.0.0.1:${e}` : `http://${window.location.hostname || `127.0.0.1`}:${e}`;
}
function r() {
  return e;
}
function i(e) {
  if (!e || typeof e != `string` || t()) return e;
  let n = window.location.hostname;
  return n && n !== `127.0.0.1` && n !== `localhost` ? e.replace(/127\.0\.0\.1/g, n) : e;
}
var a = `active_api_endpoint`;
function o(e) {
  return (e || ``).replace(/[`\s]/g, ``).trim().replace(/\/$/, ``);
}
function s() {
  let e = [{
    label: `默认接入点`,
    url: o(`http://154.219.102.152:3012`)
  }];
  try {
    // [base→18080] 自研唯一出口网关（docs/01 变更#1）；官方更新重打须按 s()/l() 语义重新定位，勿套旧行号
    let t = JSON.parse(`[{"label":"本地引擎","url":"http://127.0.0.1:18080"},{"label":"主接入点","url":"https://www.1mao.cc"},{"label":"备用接入点1","url":"https://1mao.16iai.com"},{"label":"备用接入点2","url":"http://154.219.102.152:3012"}]`);
    if (!Array.isArray(t)) return e;
    let n = t.map((e) => ({
      label: String(e?.label || e?.url || ``).trim(),
      url: o(String(e?.url || ``))
    })).filter((e) => !!e.url);
    return n.length > 0 ? n : e;
  } catch (t) {
    return console.warn(`[endpointConfig] 解析 VITE_API_ENDPOINTS 失败，使用默认接入点:`, t), e;
  }
}
var c = s();
function l() {
  // [base→18080] 自研唯一出口网关（docs/01 变更#1）；官方更新重打须按 s()/l() 语义重新定位，勿套旧行号
  return c[0]?.url || o(`http://127.0.0.1:18080`);
}
function u() {
  try {
    let e = sessionStorage.getItem(a);
    return e ? o(e) : null;
  } catch {
    return null;
  }
}
function d(e) {
  try {
    sessionStorage.setItem(a, o(e));
  } catch {}
}
function f() {
  try {
    sessionStorage.removeItem(a);
  } catch {}
}
function p(e) {
  if (e == null || e === ``) return null;
  if (typeof e == `string`) {
    let t = e.trim();
    if (!t) return null;
    if (t.startsWith(`"`) || t.startsWith(`{`)) try {
      return p(JSON.parse(t));
    } catch {
      return o(t);
    }
    return o(t);
  }
  if (typeof e == `object`) {
    let t = e;
    if (typeof t.url == `string`) return o(t.url);
    if (typeof t.value == `string`) return p(t.value);
  }
  return null;
}
async function m() {
  try {
    let e = await fetch(`${n()}/api/kv/get?key=${a}`);
    return e.ok ? p(await e.json()) : null;
  } catch {
    return null;
  }
}
async function h(e) {
  try {
    return (await fetch(`${n()}/api/kv/set`, {
      method: `POST`,
      headers: {
        "Content-Type": `application/json`
      },
      body: JSON.stringify({
        key: a,
        value: o(e)
      })
    })).ok;
  } catch {
    return !1;
  }
}
function g() {
  return u() || l();
}
async function _() {
  let e = u();
  if (e) return e;
  let t = await m();
  return t ? (d(t), t) : l();
}
async function v(e) {
  let t = o(e);
  if (!t) return !1;
  let n = await h(t);
  return n && f(), n;
}
export { i as a, t as c, v as i, _ as n, n as o, g as r, r as s, c as t };