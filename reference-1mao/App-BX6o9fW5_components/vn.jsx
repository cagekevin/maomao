// TODO(全局, 无需 import): t
import { e } from './shared.js';
export default function vn(e, t) {
  if (e === `allowed`) {
    const Component291 = `span`;
    return <Component291 className={`text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30`}>{`可用`}</Component291>;
  } else if (e === `quota_exceeded`) {
    const Component292 = `span`;
    return <Component292 className={`text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-200 border border-amber-500/30`}>{`额度已满`}</Component292>;
  } else {
    const Component293 = `span`;
    return <Component293 className={`text-[10px] px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400 border border-slate-600/40`} title={t || `权益不够`}>{`权益不够`}</Component293>;
  }
}