// 切自 src/App.js L18078（网关 proxy 转发层）。剪切不重写，混淆名原样保留。
// 纯 fetch 无外部依赖；base 由调用方通过参数传入，模块内不硬编码。
async function zc(e, t) {
  let n = t.body instanceof FormData,
    r = t.body instanceof Blob;
  if (t.localPort) {
    if (!e.startsWith(`http`) && !e.startsWith(`data:`) && !e.startsWith(`blob:`)) {
      let n = `http://127.0.0.1:${t.localPort}/api/files/read?path=${encodeURIComponent(e)}`;
      return fetch(n, {
        method: t.method || `GET`,
        headers: t.headers || {}
      });
    }
    try {
      let i;
      if (n || r) {
        let n = new Headers();
        n.set(`X-Proxy-Url`, e), n.set(`X-Proxy-Method`, t.method || `POST`), t.headers && n.set(`X-Proxy-Headers`, JSON.stringify(t.headers)), t.cookie && n.set(`X-Proxy-Cookie`, t.cookie), i = await fetch(`http://127.0.0.1:${t.localPort}/api/proxy`, {
          method: `POST`,
          headers: n,
          body: t.body
        });
      } else i = await fetch(`http://127.0.0.1:${t.localPort}/api/proxy`, {
        method: `POST`,
        headers: {
          "Content-Type": `application/json`
        },
        body: JSON.stringify({
          url: e,
          method: t.method || `GET`,
          headers: t.headers || {},
          body: t.body ? typeof t.body == `string` ? t.body : JSON.stringify(t.body) : ``,
          cookie: t.cookie || ``
        })
      });
      if (!i.ok) {
        let e = await i.text();
        throw Error(`Proxy error: ${i.status} ${e}`);
      }
      return i;
    } catch (e) {
      console.error(`Proxy fetch failed, falling back to direct fetch`, e);
    }
  }
  let i = {
    method: t.method || `GET`,
    headers: t.headers || {}
  };
  return t.body && (i.body = n || typeof t.body == `string` ? t.body : JSON.stringify(t.body)), fetch(e, i);
}
export {
  zc
};
