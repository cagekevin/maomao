// TODO(全局, 无需 import): name, entry, bare, label, children, n, r, i, o, s, u, l
import _cmp__s from './_s.jsx';
import _cmp__Component40 from './_Component40.jsx';
import { t, e, ta, na, xs, Ss, ls, la, a, Cs, c, os, as, gs, bs } from './shared.js';
import * as Q from 'react';
export default function Ts({
  name: e,
  entry: t,
  bare: n = false
}) {
  let r = t?.displayName || e;
  let i = t?.power ?? ta(e);
  let a = t?.unit ?? na(e);
  let o = t?.speed?.label;
  let s = xs(t?.stability);
  let c = Ss(t?.stability);
  let l = ls(t ?? undefined);
  let u = t?.supportsRealPerson === false ? `否` : `支持`;
  const Component890 = `span`;
  const Component891 = `div`;
  let _Component39 = ({
    label: e,
    children: t
  }) => {
    return <Q.Fragment>
        <Component890 className={`text-[10px] text-gray-500 whitespace-nowrap pt-0.5`}>
          {e}
        </Component890>
        <Component891 className={`text-[11px] text-gray-300 break-words min-w-0`}>{t}</Component891>
      </Q.Fragment>;
  };
  const Component892 = `span`;
  const Component893 = `div`;
  const Component894 = `div`;
  const Component895 = `span`;
  const Component896 = `span`;
  const Component897 = `span`;
  const Component898 = `div`;
  const Component899 = `div`;
  return <Component899 className={n ? `w-full` : `w-72 bg-[#1d1d1d] border border-[#3a3a3a] rounded-lg shadow-2xl p-3`}>
      <Component893 className={`flex items-center gap-1.5 mb-2 pb-2 border-b border-[#333]`}>
        <Component892 className={`text-[12px] font-semibold text-gray-100`}>{r}</Component892>
      </Component893>
      {r !== e && <Component894 className={`text-[10px] text-gray-500 font-mono mb-2 -mt-1 break-all`}>
          {e}
        </Component894>}
      <Component898 className={`grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-start`}>
        <_Component39 label={`价格`}>
          {i == null ? `—` : <Component895 className={`text-yellow-300 inline-flex items-center gap-0.5 tabular-nums`}>
              <_cmp__s className={`w-3 h-3`} />
              {`${la(i)}${a ? `/${a}` : ``}`}
            </Component895>}
        </_Component39>
        <_Component39 label={`平均速度`}>
          {o ? <Component896 className={`text-[11px] text-sky-300 tabular-nums`}>{o}</Component896> : `—`}
        </_Component39>
        <_Component39 label={`稳定性`}>
          {s ? <Component897 className={`tabular-nums ${Cs(c)}`}>{s}</Component897> : `—`}
        </_Component39>
        <_Component39 label={`时长`}>{os(as(t ?? undefined), t?.durationLabel)}</_Component39>
        <_Component39 label={`分辨率`}>{gs(t?.resolutions)}</_Component39>
        <_Component39 label={`比例`}>{gs(t?.aspectRatios)}</_Component39>
        <_Component39 label={`真人`}>{u}</_Component39>
        <_Component39 label={`参考约束`}>{bs(t)}</_Component39>
        <_Component39 label={`能力`}>
          <_cmp__Component40 score={l} />
        </_Component39>
        <_Component39 label={`备注`}>{t?.notes || `—`}</_Component39>
      </Component898>
    </Component899>;
}