// TODO(全局, 无需 import): t, n, i
import _cmp__Component23 from './_Component23.jsx';
import _cmp__Component24 from './_Component24.jsx';
import { e, vn, r, M } from './shared.js';
import * as G from 'react';
var Tn = () => {
  let [e, t] = G.useState(`list`);
  G.useEffect(() => {
    let e = () => {
      return t(`schedule`);
    };
    window.addEventListener(`builtin-panel-switch-schedule`, e);
    return () => {
      return window.removeEventListener(`builtin-panel-switch-schedule`, e);
    };
  }, []);
  const Component328 = `div`;
  const Component329 = `div`;
  const Component330 = `div`;
  return <Component330 className={`space-y-4 animate-fade-in`}>
      <Component328 className={`flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] w-fit`}>
        {[`list`, `schedule`].map(n => {
        let r = e === n;
        let i = n === `list` ? `模型列表` : `模型调度`;
        const Component327 = `button`;
        return <Component327 type={`button`} onClick={() => {
          return t(n);
        }} className={vn(`inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[14px] transition-all`, r ? `bg-white text-slate-900 font-semibold shadow-sm` : `text-white/65 hover:text-white hover:bg-white/[0.06]`)} key={n}>
              {n === `schedule` && <M className={`w-4 h-4`} strokeWidth={2} />}
              {i}
            </Component327>;
      })}
      </Component328>
      <Component329 className={`animate-fade-in`} key={e}>
        {e === `list` ? <_cmp__Component23 /> : <_cmp__Component24 />}
      </Component329>
    </Component330>;
};
export default Tn;