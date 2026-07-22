import { Wn } from '../config/constants.js';

async function Gn(e) {
  if (!e.fileUrl && !e.localPath) return {
    ok: false,
    message: `没有可发送的素材`
  };
  try {
    let t = await fetch(`http://127.0.0.1:${Wn}/api/jianying/send`, {
        method: `POST`,
        headers: {
          "Content-Type": `application/json`
        },
        body: JSON.stringify({
          fileUrl: e.fileUrl || ``,
          localPath: e.localPath || ``,
          fileName: e.fileName || ``
        })
      }),
      n = await t.json().catch(() => ({}));
    return t.ok && n.status === `ok` ? {
      ok: true,
      message: n.message || `已发送到剪映`
    } : {
      ok: false,
      message: n.error || `发送失败 (HTTP ${t.status})`
    };
  } catch (e) {
    let t = String(e?.message || e);
    return t.includes(`Failed to fetch`) || t.includes(`NetworkError`) ? {
      ok: false,
      message: `无法连接本地引擎，请确认引擎已启动`
    } : {
      ok: false,
      message: t
    };
  }
}
function Kn(e, t = `mp4`) {
  try {
    let n = e.split(`?`)[0],
      r = n.substring(n.lastIndexOf(`/`) + 1);
    return r && r.includes(`.`) ? r : `clip_${Date.now()}.${t}`;
  } catch {
    return `clip_${Date.now()}.${t}`;
  }
}
async function qn(e) {
  let t = e.filter(e => e.fileUrl || e.localPath);
  if (t.length === 0) return {
    ok: false,
    message: `没有可发送的素材`
  };
  try {
    let e = await fetch(`http://127.0.0.1:${Wn}/api/jianying/send`, {
        method: `POST`,
        headers: {
          "Content-Type": `application/json`
        },
        body: JSON.stringify({
          items: t
        })
      }),
      n = await e.json().catch(() => ({}));
    return e.ok && n.status === `ok` ? {
      ok: true,
      message: `已发送 ${n.count ?? t.length} 个素材到剪映`
    } : {
      ok: false,
      message: n.error || `发送失败 (HTTP ${e.status})`
    };
  } catch (e) {
    let t = String(e?.message || e);
    return t.includes(`Failed to fetch`) || t.includes(`NetworkError`) ? {
      ok: false,
      message: `无法连接本地引擎，请确认引擎已启动`
    } : {
      ok: false,
      message: t
    };
  }
}
export { Gn, Kn, qn };
