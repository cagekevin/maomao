// TODO(全局, 无需 import): importData, exportData, t, n
import { e, r } from './shared.js';
import * as W from 'react';
export default function Ft({
  importData: e,
  exportData: t
}) {
  let n = W.useRef(e);
  let r = W.useRef(t);
  W.useEffect(() => {
    n.current = e;
    r.current = t;
  }, [e, t]);
  W.useEffect(() => {
    let e = () => {
      let e = document.createElement(`input`);
      e.type = `file`;
      e.accept = `.json`;
      e.onchange = e => {
        return n.current(e);
      };
      e.click();
    };
    let t = () => {
      r.current();
    };
    window.addEventListener(`import-project`, e);
    window.addEventListener(`export-project`, t);
    return () => {
      window.removeEventListener(`import-project`, e);
      window.removeEventListener(`export-project`, t);
    };
  }, []);
}