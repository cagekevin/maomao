// 切自 src/App.js L447-581（认证/token/提示词偏好层）。剪切不重写，混淆名原样保留。
import { Ca, Va } from '../config/constants.js';
import { Q } from '../utils/storage/index.js';
import { $n, er } from '../utils/urlTools.js';

var wa = `remembered_login_credentials`;
function Ta() {
  let e = localStorage.getItem(wa);
  if (!e) return null;
  try {
    let t = JSON.parse(e);
    if (typeof t.account != `string` || typeof t.password != `string`) throw Error(`Invalid remembered login credentials`);
    return t;
  } catch {
    return localStorage.removeItem(wa), null;
  }
}
function Ea(e) {
  localStorage.setItem(wa, JSON.stringify(e));
}
function Da() {
  localStorage.removeItem(wa);
}
function Oa() {
  return localStorage.getItem(Ca) || `local-mode-token`;
}
function ka(e) {
  localStorage.setItem(Ca, e), Q.setConfig(Ca, e).then(() => {
    console.log(`AUTH_TOKEN_KEY 保存成功`);
  });
}
function Aa() {
  localStorage.removeItem(Ca), Q.remove(Ca).then(() => {
    console.log(`AUTH_TOKEN_KEY 移除成功`);
  });
}
var ja = `${$n}${er}`;
function Ma(e) {
  return e ? /^https?:\/\//i.test(e) || e.startsWith(`data:`) ? e : `${$n}${e.startsWith(`/`) ? `` : `/`}${e}` : ``;
}
function Na() {
  let e = Oa();
  return e ? {
    Authorization: `Bearer ${e}`
  } : {};
}
async function Pa() {
  return [];
  let e = await (await fetch(`${ja}/public/prompt-tags`)).json();
  return e.success ? e.data : [];
}
async function Fa(e = {}) {
  return [];
  let t = new URLSearchParams();
  e.category && t.set(`category`, e.category), e.tagId && t.set(`tagId`, String(e.tagId)), e.keyword && e.keyword.trim() && t.set(`keyword`, e.keyword.trim()), t.set(`pageSize`, `200`);
  let n = await (await fetch(`${ja}/public/prompts?${t.toString()}`)).json();
  return n.success ? n.data : [];
}
async function Ia() {
  return [];
  if (!Oa()) return [];
  let e = await fetch(`${ja}/prompts/favorites`, {
    headers: Na()
  });
  if (!e.ok) return [];
  let t = await e.json();
  return t.success ? t.data.map(e => e.promptId) : [];
}
async function La() {
  return [];
  if (!Oa()) return [];
  let e = await fetch(`${ja}/prompts/favorites/items`, {
    headers: Na()
  });
  if (!e.ok) return [];
  let t = await e.json();
  return t.success ? t.data : [];
}
async function Ra(e) {
  return { ok: false, error: `本地模式不支持` };
  try {
    let t = await fetch(`${ja}/prompts/favorites/${e}`, {
      method: `POST`,
      headers: Na()
    });
    if (t.ok) return {
      ok: true
    };
    let n = `收藏失败 (${t.status})`;
    try {
      let e = await t.json();
      e?.error && (n = e.error);
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
async function za(e) {
  return false;
  if (!Oa()) return false;
  try {
    return (await fetch(`${ja}/prompts/favorites/${e}`, {
      method: `DELETE`,
      headers: Na()
    })).ok;
  } catch {
    return false;
  }
}
function Ba() {
  return !!Oa();
}
function Ha() {
  try {
    window.dispatchEvent(new CustomEvent(Va));
  } catch {}
}
var Wa = `yimao:promptRecent`;
function Ga() {
  try {
    let e = localStorage.getItem(Wa);
    return e ? JSON.parse(e) : [];
  } catch {
    return [];
  }
}
function Ka(e) {
  try {
    let t = Ga().filter(t => t !== e);
    t.unshift(e), localStorage.setItem(Wa, JSON.stringify(t.slice(0, 50)));
  } catch {}
}
export {
  wa, Ta, Ea, Da, Oa, ka, Aa, ja, Ma, Na, Pa, Fa, Ia, La, Ra, za, Ba, Ha, Wa, Ga, Ka
};
