// 切自 src/App.js L41515-41598（资源写库层）。剪切不重写，混淆名原样保留。
// 事实修正（SOP §二.4）：统一使用 vv（=LOCAL_ENGINE.base=18080），不引入 U_，不改 9004。
import { vv } from '../config/constants.js';

function yv(e) {
  let t = {
    ...e
  };
  t.isFavorite = e.isFavorite === 1 || e.isFavorite === true, t.timestamp = typeof t.timestamp == `number` ? t.timestamp : Number(t.timestamp) || 0;
  for (let e of [`pageUrl`, `pageTitle`, `source`, `folder`, `name`]) t[e] === `` && delete t[e];
  return t;
}
function bv(e) {
  let t = new URLSearchParams();
  return e.page && t.set(`page`, String(e.page)), e.pageSize && t.set(`pageSize`, String(e.pageSize)), e.sortBy && t.set(`sortBy`, e.sortBy), e.sortDir && t.set(`sortDir`, e.sortDir), e.search && e.search.trim() && t.set(`search`, e.search.trim()), e.filters && Object.keys(e.filters).length > 0 && t.set(`filters`, JSON.stringify(e.filters)), t.toString();
}
async function xv(e = {}) {
  let t = bv({
      sortBy: `timestamp`,
      sortDir: `DESC`,
      ...e
    }),
    n = await fetch(`${vv}/api/resources?${t}`);
  if (!n.ok) throw Error(`listResources failed: HTTP ${n.status}`);
  let r = await n.json();
  return {
    items: Array.isArray(r.items) ? r.items.map(yv) : [],
    total: r.total ?? 0,
    page: r.page ?? 1,
    pageSize: r.pageSize ?? (e.pageSize || 20),
    totalPages: r.totalPages ?? 0
  };
}
async function Sv(e) {
  try {
    return (await fetch(`${vv}/api/resources/save`, {
      method: `POST`,
      headers: {
        "Content-Type": `application/json`
      },
      body: JSON.stringify(e)
    })).ok;
  } catch (e) {
    return console.error(`[resourceStore] saveResource error`, e), false;
  }
}
async function Cv(e, t) {
  return Sv({
    ...e,
    isFavorite: t
  });
}
async function wv(e) {
  try {
    return (await fetch(`${vv}/api/resources/delete?id=${encodeURIComponent(e)}`, {
      method: `POST`
    })).ok;
  } catch (e) {
    return console.error(`[resourceStore] deleteResource error`, e), false;
  }
}
async function Tv(e = ``, t = true) {
  try {
    let n = await fetch(`${vv}/api/resources/clear`, {
      method: `POST`,
      headers: {
        "Content-Type": `application/json`
      },
      body: JSON.stringify({
        folder: e,
        deleteFiles: t
      })
    });
    return n.ok ? (await n.json()).deleted ?? 0 : 0;
  } catch (e) {
    return console.error(`[resourceStore] clearResources error`, e), 0;
  }
}
async function Ev() {
  try {
    let e = await fetch(`${vv}/api/resources/rescan`, {
      method: `POST`
    });
    return e.ok ? (await e.json()).count ?? 0 : 0;
  } catch (e) {
    return console.error(`[resourceStore] rescanResources error`, e), 0;
  }
}
export {
  yv,
  bv,
  xv,
  Sv,
  Cv,
  wv,
  Tv,
  Ev
};
