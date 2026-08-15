// TODO(全局, 无需 import): url, n, t, decodeURIComponent, escape
import { e } from './shared.js';
import * as W from 'react';
export default function _Component38({
  url: e
}) {
  let [t, n] = W.useState(`加载中...`);
  W.useEffect(() => {
    let t = async e => {
      n(e);
    };
    (async () => {
      if (!e || typeof e != `string`) {
        await t(typeof e == `object` ? JSON.stringify(e) : `无内容`);
        return;
      }
      if (e.startsWith(`data:text/`)) {
        try {
          let n = e.split(`,`);
          if (n.length > 1) {
            await t(decodeURIComponent(escape(atob(n[1]))));
          }
          return;
        } catch {
          try {
            let n = e.split(`,`);
            if (n.length > 1) {
              await t(decodeURIComponent(n[1]));
            }
            return;
          } catch (e) {
            console.error(e);
          }
        }
      }
      if (e.startsWith(`http://`) || e.startsWith(`https://`)) {
        try {
          let n = await fetch(e);
          if (n.ok) {
            await t(await n.text());
          } else {
            await t(`无法加载文本内容: HTTP ${n.status} ${n.statusText}`);
          }
        } catch {
          await t(`无法加载文本内容: Network Error (CORS or Blocked)\n\nURL: ${e}`);
        }
      } else {
        await t(e);
      }
    })();
  }, [e]);
  const Component718 = `div`;
  return <Component718 className={`whitespace-pre-wrap`}>{t}</Component718>;
}