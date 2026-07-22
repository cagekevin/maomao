// 切自 src/App.js L18128（useLocalTool hook，含同组间隔常量 Vc/Hc）。剪切不重写，混淆名原样保留。
// React 取法与 EditorContext.js / App.js 保持一致（vendor 别名 Y）。
import { i as e } from "../vendor/rolldown-runtime.js";
import { Nr as le, Ar as o, Mr as ae } from "../vendor/vendor.js";
import { Bc } from "../config/constants.js";
import { LOCAL_ENGINE } from "../config.js";

var Y = e(le(), 1),
  Un = ae();
var X = o();
var Vc = 5e3,
  Hc = 15e3;
function Uc() {
  let [e, t] = Y.useState({
      isConnected: false,
      port: Bc
    }),
    n = Y.useCallback(async () => {
      try {
        let e = await fetch(`http://127.0.0.1:${Bc}/api/status`, {
          method: `GET`,
          headers: {
            "Content-Type": `application/json`
          }
        });
        if (e.ok) {
          let n = await e.json();
          if (console.log(`[useLocalTool] 接收到响应数据:`, n), n.status === `ok` || n.ok === true) {
            t(e => e.isConnected && e.version === n.version && e.message === n.message ? e : {
              ...e,
              isConnected: true,
              version: n.version,
              message: n.message
            });
            return;
          }
        }
        t(e => e.isConnected ? {
          ...e,
          isConnected: false
        } : e);
      } catch {
        t(e => e.isConnected ? {
          ...e,
          isConnected: false
        } : e);
      }
    }, []);
  return Y.useEffect(() => {
    n();
  }, [n]), Y.useEffect(() => {
    let t = e.isConnected ? Hc : Vc;
    console.log(`[useLocalTool] 设置检测间隔:`, t, `ms, isConnected:`, e.isConnected);
    let r = setInterval(n, t);
    return () => clearInterval(r);
  }, [e.isConnected, n]), {
    status: e,
    checkConnection: n,
    uploadFile: Y.useCallback(async (t, n, r = ``) => {
      if (!e.isConnected) throw Error(`Local tool not connected`);
      let i = new FormData();
      t instanceof File || t instanceof Blob ? i.append(`file`, t, n) : i.append(`fileUrl`, t), r && i.append(`subfolder`, r);
      let a = await fetch(`http://127.0.0.1:${Bc}/api/files/upload`, {
        method: `POST`,
        body: i
      });
      if (!a.ok) throw Error(`Upload failed`);
      let s = await a.json();
      // 后端返回相对路径 /files/...，Chrome 扩展环境下会被解析为 chrome-extension:// 前缀导致加载失败无限重试。
      // 统一在此补成 http://127.0.0.1:{port} 绝对路径，所有消费链路受益。
      let prefix = `http://127.0.0.1:${Bc}`;
      if (s && typeof s.url == `string` && s.url.startsWith(`/`)) s.url = prefix + s.url;
      if (s && typeof s.thumbnailUrl == `string` && s.thumbnailUrl.startsWith(`/`)) s.thumbnailUrl = prefix + s.thumbnailUrl;
      return s;
    }, [e.isConnected]),
    saveKV: Y.useCallback(async (e, t) => {
      try {
        let n = typeof t == `string` ? t : JSON.stringify(t),
          r = await fetch(`http://127.0.0.1:${Bc}/api/kv/set`, {
            method: `POST`,
            headers: {
              "Content-Type": `application/json`
            },
            body: JSON.stringify({
              key: e,
              value: n
            })
          });
        return r.ok ? true : (console.error(`[useLocalTool] saveKV failed for key "${e}":`, r.status, r.statusText), false);
      } catch (t) {
        return console.error(`[useLocalTool] saveKV error for key "${e}":`, t), false;
      }
    }, [e.isConnected]),
    getKV: Y.useCallback(async e => {
      try {
        let t = `http://127.0.0.1:${Bc}/api/kv/get?key=${e}`,
          n = await fetch(t);
        return console.log(`[useLocalTool.getKV] 📥 响应状态:`, n.status, n.statusText), n.ok ? await n.json() : (console.error(`[useLocalTool.getKV] ❌ 请求失败 HTTP 状态:`, n.status), null);
      } catch (e) {
        let t = e instanceof Error ? e.message : String(e);
        return console.error(`[useLocalTool.getKV] ❌ fetch 异常:`, e), console.error(`[useLocalTool.getKV] ❌ 错误类型:`, e instanceof Error ? e.name : `Error`, `错误消息:`, t), (t.includes(`Failed to fetch`) || t.includes(`NetworkError`)) && console.error(`[useLocalTool.getKV] ❌ 网络错误：无法连接到 ${LOCAL_ENGINE.base}，请确保 localTool Service 正在运行`), null;
      }
    }, [e.isConnected, e.port]),
    createFolder: Y.useCallback(async e => {
      try {
        let ok = await fetch(`http://127.0.0.1:${Bc}/api/files/mkdir`, {
          method: `POST`,
          headers: {
            "Content-Type": `application/json`
          },
          body: JSON.stringify({
            folder: e
          })
        });
        if (ok) {
          // 同步写入资源表，使面板能显示新文件夹
          let folderName = e.split(`/`).pop() || e;
          let parentFolder = e.substring(0, e.lastIndexOf(`/`));
          fetch(`http://127.0.0.1:${Bc}/api/resources/save`, {
            method: `POST`,
            headers: { "Content-Type": `application/json` },
            body: JSON.stringify({
              id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              type: `folder`,
              name: folderName,
              folder: parentFolder || undefined,
              source: `local`,
              timestamp: Date.now()
            })
          }).catch(() => {});
        }
        return ok;
      } catch {
        return false;
      }
    }, [e.isConnected]),
    moveFile: Y.useCallback(async (e, t) => {
      try {
        return await fetch(`http://127.0.0.1:${Bc}/api/files/move`, {
          method: `POST`,
          headers: {
            "Content-Type": `application/json`
          },
          body: JSON.stringify({
            src: e,
            dst: t
          })
        }), true;
      } catch {
        return false;
      }
    }, [e.isConnected])
  };
}
export {
  Uc
};
