// TODO(全局, 无需 import): t, n, i
import _cmp_Cn from './Cn.jsx';
import _cmp__Component24 from './_Component24.jsx';
import { e, _n, r, P } from './shared.js';
import * as W from 'react';
var _Component43 = () => {
  let [e, t] = W.useState(`list`);
  W.useEffect(() => {
    let e = () => {
      return t(`schedule`);
    };
    window.addEventListener(`builtin-panel-switch-schedule`, e);
    return () => {
      return window.removeEventListener(`builtin-panel-switch-schedule`, e);
    };
  }, []);
  const Component326 = `div`;
  const Component327 = `div`;
  const Component328 = `div`;
  return <Component328 className={`space-y-4 animate-fade-in`}>
      <Component326 className={`flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] w-fit`}>
        {[`list`, `schedule`].map(n => {
        let r = e === n;
        let i = n === `list` ? `模型列表` : `模型调度`;
        const Component325 = `button`;
        return <Component325 type={`button`} onClick={() => {
          return t(n);
        }} className={_n(`inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[14px] transition-all`, r ? `bg-white text-slate-900 font-semibold shadow-sm` : `text-white/65 hover:text-white hover:bg-white/[0.06]`)} key={n}>
              {n === `schedule` && <P className={`w-4 h-4`} strokeWidth={2} />}
              {i}
            </Component325>;
      })}
      </Component326>
      <Component327 className={`animate-fade-in`} key={e}>
        {e === `list` ? <_cmp_Cn /> : <_cmp__Component24 />}
      </Component327>
    </Component328>;
};
export default _Component43;