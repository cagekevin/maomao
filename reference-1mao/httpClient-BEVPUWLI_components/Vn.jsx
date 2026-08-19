// TODO(全局, 无需 import): url, n, decodeURIComponent, escape
import { e, t } from './shared.js';
import * as Z from 'react';
export default function Vn({
  url: e
}) {
  let [t, n] = Z.useState(`加载中...`);
  Z.useEffect(() => {
    if (!e) {
      n(`无内容`);
      return;
    }
    if (e.startsWith(`data:text/`)) {
      try {
        let t = e.split(`,`);
        if (t.length > 1) {
          n(decodeURIComponent(escape(atob(t[1]))));
        }
        return;
      } catch {
        try {
          let t = e.split(`,`);
          if (t.length > 1) {
            n(decodeURIComponent(t[1]));
          }
          return;
        } catch (e) {
          console.error(e);
        }
      }
    }
    if (e.startsWith(`http://`) || e.startsWith(`https://`)) {
      (async () => {
        try {
          let t = await fetch(e);
          if (t.ok) {
            n(await t.text());
          } else {
            n(`无法加载文本内容: HTTP ${t.status}`);
          }
        } catch {
          n(`无法加载文本内容: Network Error\n\nURL: ${e}`);
        }
      })();
      return;
    }
    n(e);
  }, [e]);
  const Component4 = `div`;
  return <Component4 className={`whitespace-pre-wrap`}>{t}</Component4>;
}