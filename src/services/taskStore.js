// 切自 src/App.js L40278-40405（任务写库层）。剪切不重写，混淆名原样保留。
// 事实修正（SOP §二.4）：原 U_ = LOCAL_ENGINE.base（L39758），统一改用 vv（=LOCAL_ENGINE.base=18080），
// 不引入 U_，不改 9004。W_ 为同组字段白名单，一并切走。
import { vv } from '../config/constants.js';

const W_ = [`customResultData`, `customRawResponse`, `requestData`, `responseData`, `mediaMeta`];
function G_(e) {
  let t = {
    ...e
  };
  for (let e of W_) {
    let n = t[e];
    if (n === `` || n == null) {
      delete t[e];
      continue;
    }
    if (typeof n == `string`) try {
      t[e] = JSON.parse(n);
    } catch {}
  }
  t.progress = typeof t.progress == `number` ? t.progress : Number(t.progress) || 0, t.createdAt = typeof t.createdAt == `number` ? t.createdAt : Number(t.createdAt) || 0, t.notFoundCount !== undefined && (t.notFoundCount = Number(t.notFoundCount) || 0);
  for (let e of [`taskId`, `nodeId`, `resultUrl`, `thumbnailUrl`, `errorMsg`, `prompt`, `customOutputType`, `channelName`, `modelName`]) t[e] === `` && delete t[e];
  return t;
}
function K_(e) {
  let t = new URLSearchParams();
  return e.page && t.set(`page`, String(e.page)), e.pageSize && t.set(`pageSize`, String(e.pageSize)), e.sortBy && t.set(`sortBy`, e.sortBy), e.sortDir && t.set(`sortDir`, e.sortDir), e.search && e.search.trim() && t.set(`search`, e.search.trim()), e.filters && Object.keys(e.filters).length > 0 && t.set(`filters`, JSON.stringify(e.filters)), t.toString();
}
async function q_(e = {}) {
  let t = K_({
      sortBy: `createdAt`,
      sortDir: `DESC`,
      ...e
    }),
    n = await fetch(`${vv}/api/tasks?${t}`);
  if (!n.ok) throw Error(`listTasks failed: HTTP ${n.status}`);
  let r = await n.json();
  return {
    items: Array.isArray(r.items) ? r.items.map(G_) : [],
    total: r.total ?? 0,
    page: r.page ?? 1,
    pageSize: r.pageSize ?? (e.pageSize || 20),
    totalPages: r.totalPages ?? 0
  };
}
async function J_(e) {
  try {
    return (await fetch(`${vv}/api/tasks/save`, {
      method: `POST`,
      headers: {
        "Content-Type": `application/json`
      },
      body: JSON.stringify(e)
    })).ok;
  } catch (e) {
    return console.error(`[taskStore] saveTask error`, e), false;
  }
}
async function Y_(e) {
  if (!e || e.length === 0) return true;
  try {
    return (await fetch(`${vv}/api/tasks/batch-save`, {
      method: `POST`,
      headers: {
        "Content-Type": `application/json`
      },
      body: JSON.stringify(e)
    })).ok;
  } catch (e) {
    return console.error(`[taskStore] batchSaveTasks error`, e), false;
  }
}
async function X_(e) {
  try {
    return (await fetch(`${vv}/api/tasks/delete?id=${encodeURIComponent(e)}`, {
      method: `POST`
    })).ok;
  } catch (e) {
    return console.error(`[taskStore] deleteTask error`, e), false;
  }
}
async function Z_(e) {
  if (!e || e.length === 0) return 0;
  try {
    let t = await fetch(`${vv}/api/tasks/batch-delete`, {
      method: `POST`,
      headers: {
        "Content-Type": `application/json`
      },
      body: JSON.stringify({
        ids: e
      })
    });
    return t.ok ? (await t.json()).deleted ?? 0 : 0;
  } catch (e) {
    return console.error(`[taskStore] batchDeleteTasks error`, e), 0;
  }
}
async function Q_(e = []) {
  try {
    let t = await fetch(`${vv}/api/tasks/clear`, {
      method: `POST`,
      headers: {
        "Content-Type": `application/json`
      },
      body: JSON.stringify({
        statuses: e
      })
    });
    return t.ok ? (await t.json()).deleted ?? 0 : 0;
  } catch (e) {
    return console.error(`[taskStore] clearTasks error`, e), 0;
  }
}
var $_ = Promise.resolve();
function ev(e, t) {
  let n = () => tv(e, t);
  return $_ = $_.then(n, n), $_;
}
async function tv(e, t) {
  let n = new Map(e.map(e => [e.id, e])),
    r = new Map(t.map(e => [e.id, e])),
    i = [];
  for (let e of t) {
    let t = n.get(e.id);
    (!t || JSON.stringify(t) !== JSON.stringify(e)) && i.push(e);
  }
  let a = [];
  for (let t of e) r.has(t.id) || a.push(t.id);
  let o = [];
  i.length === 1 ? o.push(J_(i[0])) : i.length > 1 && o.push(Y_(i)), a.length > 0 && o.push(Z_(a)), o.length > 0 && (await Promise.all(o).catch(e => console.error(`[taskStore] diffAndPersistTasks error`, e)));
}
export {
  G_,
  K_,
  q_,
  J_,
  Y_,
  X_,
  Z_,
  Q_,
  $_,
  ev,
  tv
};
