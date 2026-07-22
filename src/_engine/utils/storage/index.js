import { Z } from '../../config/storageKeys.js';
import { V as Oe } from '../../vendor/vendor.js';
import { i as e } from '../../vendor/rolldown-runtime.js';

var Sr = e(Oe(), 1);

function Cr(e) {
  return `${Z.CANVAS_STATE_PREFIX}${e}`;
}

var wr = {
    async get(e) {
      console.log(`[Storage] localToolEngine.get 被调用，key:`, e);
      try {
        let t = window.localTool;
        return t ? (console.log(`[Storage] 准备调用 lt.getKV("` + e + `")`), await t.getKV(e)) : (console.error(`[Storage] ❌ window.localTool 不存在，localTool service 可能未运行`), null);
      } catch (e) {
        return console.error(`[Storage] localToolEngine.get 异常:`, e), null;
      }
    },
    async set(e, t) {
      try {
        let n = window.localTool;
        return n ? await n.saveKV(e, t) : false;
      } catch (e) {
        return console.error(`localToolEngine set error`, e), false;
      }
    },
    async setObject(e, t) {
      try {
        let n = window.localTool;
        return n ? await n.saveKV(e, t) : false;
      } catch {
        return false;
      }
    },
    async remove(e) {
      try {
        let t = window.localTool;
        return t?.status?.isConnected ? await t.saveKV(e, ``) : false;
      } catch {
        return false;
      }
    },
    isAvailable() {
      return !!window.localTool?.status?.isConnected;
    }
  },
  Tr = new Map(),
  Er = new Map(),
  Dr = 600 * 1e3,
  Or = [`img_`, `img_thumb_`, `video_thumb_`];
function kr(e) {
  return Or.some(t => e.startsWith(t));
}
function Ar(e) {
  Tr.delete(e), Er.delete(e);
}
async function jr(e) {
  if (!kr(e)) return wr.get(e);
  let t = Date.now(),
    n = Tr.get(e);
  if (n && n.expireAt > t) return n.value;
  let r = Er.get(e);
  if (r) return r;
  let i = (async () => wr.get(e))();
  Er.set(e, i);
  try {
    let t = await i;
    return Tr.set(e, {
      value: t,
      expireAt: Date.now() + Dr
    }), t;
  } finally {
    Er.delete(e);
  }
}
var Mr = {
    async get(e) {
      try {
        return typeof chrome < `u` && chrome.storage?.local ? new Promise(t => {
          chrome.storage.local.get([e], n => {
            t(n[e] ?? null);
          });
        }) : null;
      } catch {
        return null;
      }
    },
    async set(e, t) {
      try {
        return typeof chrome < `u` && chrome.storage?.local ? new Promise(n => {
          chrome.storage.local.set({
            [e]: t
          }, () => {
            n(!chrome.runtime.lastError);
          });
        }) : false;
      } catch {
        return false;
      }
    },
    async remove(e) {
      try {
        return typeof chrome < `u` && chrome.storage?.local ? new Promise(t => {
          chrome.storage.local.remove(e, () => {
            t(!chrome.runtime.lastError);
          });
        }) : false;
      } catch {
        return false;
      }
    },
    async getMultiple(e) {
      try {
        return typeof chrome < `u` && chrome.storage?.local ? new Promise(t => {
          chrome.storage.local.get(e, n => {
            let r = {};
            e.forEach(e => {
              r[e] = n[e] ?? null;
            }), t(r);
          });
        }) : {};
      } catch {
        return {};
      }
    },
    isAvailable() {
      return !!(typeof chrome < `u` && chrome.storage?.local);
    }
  },
  Nr = {
    async get(e) {
      return localStorage.getItem(e);
    },
    async set(e, t) {
      try {
        return localStorage.setItem(e, t), true;
      } catch {
        return false;
      }
    },
    async remove(e) {
      try {
        return localStorage.removeItem(e), true;
      } catch {
        return false;
      }
    },
    async getMultiple(e) {
      let t = {};
      return e.forEach(e => {
        t[e] = localStorage.getItem(e);
      }), t;
    },
    isAvailable() {
      return true;
    }
  },
  Pr = {
    async get(e) {
      try {
        return await Sr.default.getItem(e);
      } catch {
        return null;
      }
    },
    async set(e, t) {
      try {
        return await Sr.default.setItem(e, t), true;
      } catch {
        return false;
      }
    },
    async remove(e) {
      try {
        return await Sr.default.removeItem(e), true;
      } catch {
        return false;
      }
    },
    async clear() {
      try {
        return await Sr.default.clear(), true;
      } catch {
        return false;
      }
    }
  },
  Q = {
    isLocalToolAvailable() {
      return wr.isAvailable();
    },
    getStatus() {
      return {
        localTool: wr.isAvailable(),
        chromeStorage: Mr.isAvailable(),
        localStorage: Nr.isAvailable()
      };
    },
    getAvailableEngines() {
      let e = [];
      return wr.isAvailable() && e.push(`localTool`), Mr.isAvailable() && e.push(`chromeStorage`), Nr.isAvailable() && e.push(`localStorage`), e;
    },
    async getConfig(e) {
      try {
        let t = await jr(e);
        if (t != null) return typeof t == `object` ? JSON.stringify(t) : String(t);
        let n = await jr(e);
        return n == null ? null : typeof n == `object` ? JSON.stringify(n) : String(n);
      } catch (t) {
        return console.error(`[Storage] 读取 ${e} 失败:`, t), null;
      }
    },
    async setConfig(e, t) {
      try {
        let n = await wr.set(e, t);
        return n && Ar(e), console.log(`[Storage] 保存到 localTool ${e}: ${n ? `成功` : `失败`}`), n;
      } catch (t) {
        return console.error(`[Storage] 保存 ${e} 失败:`, t), false;
      }
    },
    async getObject(e) {
      let t = await jr(e);
      if (t != null && t !== ``) try {
        if (typeof t == `object`) return t;
        let e = t;
        try {
          return JSON.parse(e);
        } catch {
          return e;
        }
      } catch (t) {
        console.error(`[Storage] 处理 ${e} 失败:`, t);
      }
      return console.log(`[Storage] localTool 中 ${e} 不存在或为空`), null;
    },
    async setObject(e, t) {
      if (t == null) return console.warn(`[Storage] 拒绝保存空值 (null/undefined) 到 ${e}`), false;
      if (typeof t == `object`) {
        let n = Object.keys(t).length === 0,
          r = Array.isArray(t) && t.length === 0;
        if (n && console.warn(`[Storage] 拒绝保存空对象 {} 到 ${e}`), r && console.warn(`[Storage] 拒绝保存空数组 [] 到 ${e}`), e.startsWith(Z.CANVAS_STATE_PREFIX)) {
          let n = t;
          if (!n.nodes || n.nodes.length === 0) return console.warn(`[Storage] 拒绝保存无节点的画布状态到 ${e}`), false;
        }
      }
      if (typeof t == `string` && t.trim() === ``) return console.warn(`[Storage] 拒绝保存空字符串到 ${e}`), false;
      try {
        let n = await wr.setObject(e, t);
        return n && Ar(e), console.log(`${new Date().toLocaleString()} [Storage] 保存对象到 localTool ${e}: ${n ? `成功` : `失败`}`), n;
      } catch (t) {
        return console.error(`[Storage] 保存对象 ${e} 失败:`, t), false;
      }
    },
    async remove(e) {
      try {
        let t = await wr.remove(e);
        return Ar(e), t;
      } catch (t) {
        return console.error(`[Storage] 删除 ${e} 失败:`, t), false;
      }
    },
    async getMultiple(e) {
      let t = {};
      try {
        let n = e.map(async e => ({
          key: e,
          value: (await wr.get(e))?.toString()
        }));
        (await Promise.all(n)).forEach(({
          key: e,
          value: n
        }) => {
          n != null && (t[e] = n);
        });
        let r = e.filter(e => !(e in t));
        if (r.length > 0) {
          console.log(`[Storage] 批量同步 ${r.length} 个缺失的键到 localTool`), await this.syncMultipleToLocalTool(r);
          let e = r.map(async e => ({
            key: e,
            value: await wr.get(e)
          }));
          (await Promise.all(e)).forEach(({
            key: e,
            value: n
          }) => {
            n !== null && (t[e] = n.toString());
          });
        }
      } catch (e) {
        console.error(`[Storage] 批量读取失败:`, e);
      }
      return t;
    },
    async setMultiple(e) {
      let t = true;
      for (let [n, r] of Object.entries(e)) (await this.setConfig(n, r)) || (t = false);
      return t;
    },
    async has(e) {
      let t = await this.getConfig(e);
      return t !== null && t !== ``;
    },
    async syncToLocalTool(e) {
      if (!wr.isAvailable()) return false;
      if (Mr.isAvailable()) {
        let t = await Mr.get(e);
        if (t !== null) return console.log(`[Storage] 从 Chrome Storage 同步 ${e} 到 localTool`), await wr.set(e, t);
      }
      let t = await Nr.get(e);
      if (t !== null) return console.log(`[Storage] 从 localStorage 同步 ${e} 到 localTool`), await wr.set(e, t);
      if (e === Z.TRANSIT_RESOURCES || e.startsWith(`canvas-state-v1-`)) {
        let t = await Pr.get(e);
        if (t !== null) return console.log(`[Storage] 从 localforage 同步 ${e} 到 localTool`), await wr.setObject(e, t);
      }
      return console.log(`[Storage] ${e} 在所有存储中都未找到`), false;
    },
    async syncMultipleToLocalTool(e) {
      if (wr.isAvailable()) for (let t of e) await this.syncToLocalTool(t);
    },
    async syncAllToLocalTool() {
      let e = [Z.USERS, Z.MEMBERSHIP, Z.OLD_MEMBERSHIP, Z.PROJECTS, Z.LAST_OPENED_PROJECT, Z.GLOBAL_TASKS, Z.CUSTOM_NODE_TEMPLATES, Z.APP_SETTINGS, Z.TRANSIT_RESOURCES, Z.TRANSIT_GRID_COLS],
        t = 0,
        n = [];
      for (let r of e) (await this.syncToLocalTool(r)) ? t++ : n.push(r);
      return console.log(`[Storage] 全量同步完成: 成功 ${t}, 失败 ${n.length}`), {
        synced: t,
        failed: n
      };
    },
    async hasLocalToolData() {
      if (!wr.isAvailable()) return false;
      let e = [Z.PROJECTS, Z.USERS, Z.TRANSIT_RESOURCES];
      for (let t of e) {
        let e = await wr.get(t);
        if (e !== null && e !== ``) return true;
      }
      return false;
    },
    async getLocalforage(e) {
      let t = await wr.get(e);
      if (t !== null) try {
        return t;
      } catch {
        return t;
      }
      return await Pr.get(e);
    },
    async setLocalforage(e, t) {
      return wr.isAvailable() && (await wr.setObject(e, t)), await Pr.set(e, t);
    },
    async clearLocalforage() {
      return await Pr.clear();
    },
    async saveCanvasState(e, t) {
      let n = Cr(e);
      return await this.setLocalforage(n, t);
    },
    async loadCanvasState(e) {
      let t = Cr(e);
      return await this.getLocalforage(t);
    },
    async saveCanvasStateWithVersion(e, t, n) {
      let r = Cr(e);
      if (!t.nodes || t.nodes.length === 0) return console.log(`[Storage] 画布状态为空，跳过保存`), {
        success: false,
        skipped: true
      };
      let i = `${r}_version`,
        a = await wr.get(i),
        o = a ? parseInt(String(a), 10) : 0;
      if (o > n) return console.warn(`[Storage] 版本冲突！远程版本 ${o} > 本地版本 ${n}，拒绝覆盖`), {
        success: false,
        skipped: true,
        conflictVersion: o
      };
      let s = await wr.setObject(r, t),
        c = await wr.set(i, String(n));
      return s && c && console.log(`[Storage] 保存画布状态成功，版本号: ${n}`), {
        success: s && c,
        skipped: false
      };
    },
    async getCanvasVersion(e) {
      let t = `${Cr(e)}_version`,
        n = await wr.get(t);
      return n ? parseInt(String(n), 10) : 0;
    },
    async deleteCanvasState(e) {
      let t = Cr(e);
      return wr.isAvailable() && (await wr.remove(t)), await Pr.remove(t);
    },
    async migrate(e, t, n = true) {
      let r = await this.getConfig(e);
      if (!r) return false;
      try {
        if (n) {
          let e = JSON.parse(r);
          await this.setObject(t, e);
        } else await this.setConfig(t, r);
        return console.log(`[Storage] 迁移 ${e} -> ${t} 成功`), true;
      } catch (n) {
        return console.error(`[Storage] 迁移 ${e} -> ${t} 失败:`, n), false;
      }
    }
  };

export { Sr, Cr, wr, Tr, Er, Dr, Or, kr, Ar, jr, Mr, Nr, Pr, Q };
