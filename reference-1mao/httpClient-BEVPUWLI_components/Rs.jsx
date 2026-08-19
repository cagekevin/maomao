// TODO(全局, 无需 import): name, entry, bare, label, children, n, r, i, o, s, u, l
import _cmp_As from './As.jsx';
import _cmp_Ls from './Ls.jsx';
import { t, e, sa, ca, Ps, Fs, xs, ha, a, Is, c, vs, _s, ks, Ns } from './shared.js';
import * as Q from 'react';
export default function Rs({
  name: e,
  entry: t,
  bare: n = false
}) {
  let r = t?.displayName || e;
  let i = t?.power ?? sa(e);
  let a = t?.unit ?? ca(e);
  let o = t?.speed?.label;
  let s = Ps(t?.stability);
  let c = Fs(t?.stability);
  let l = xs(t ?? undefined);
  let u = t?.supportsRealPerson === false ? `否` : `支持`;
  const Component896 = `span`;
  const Component897 = `div`;
  let _Component38 = ({
    label: e,
    children: t
  }) => {
    return <Q.Fragment>
        <Component896 className={`text-[10px] text-gray-500 whitespace-nowrap pt-0.5`}>
          {e}
        </Component896>
        <Component897 className={`text-[11px] text-gray-300 break-words min-w-0`}>{t}</Component897>
      </Q.Fragment>;
  };
  const Component898 = `span`;
  const Component899 = `div`;
  const Component900 = `div`;
  const Component901 = `span`;
  const Component902 = `span`;
  const Component903 = `span`;
  const Component904 = `div`;
  const Component905 = `div`;
  return <Component905 className={n ? `w-full` : `w-72 bg-[#1d1d1d] border border-[#3a3a3a] rounded-lg shadow-2xl p-3`}>
      <Component899 className={`flex items-center gap-1.5 mb-2 pb-2 border-b border-[#333]`}>
        <Component898 className={`text-[12px] font-semibold text-gray-100`}>{r}</Component898>
      </Component899>
      {r !== e && <Component900 className={`text-[10px] text-gray-500 font-mono mb-2 -mt-1 break-all`}>
          {e}
        </Component900>}
      <Component904 className={`grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-start`}>
        <_Component38 label={`价格`}>
          {i == null ? `—` : <Component901 className={`text-yellow-300 inline-flex items-center gap-0.5 tabular-nums`}>
              <_cmp_As className={`w-3 h-3`} />
              {`${ha(i)}${a ? `/${a}` : ``}`}
            </Component901>}
        </_Component38>
        <_Component38 label={`平均速度`}>
          {o ? <Component902 className={`text-[11px] text-sky-300 tabular-nums`}>{o}</Component902> : `—`}
        </_Component38>
        <_Component38 label={`稳定性`}>
          {s ? <Component903 className={`tabular-nums ${Is(c)}`}>{s}</Component903> : `—`}
        </_Component38>
        <_Component38 label={`时长`}>{vs(_s(t ?? undefined), t?.durationLabel)}</_Component38>
        <_Component38 label={`分辨率`}>{ks(t?.resolutions)}</_Component38>
        <_Component38 label={`比例`}>{ks(t?.aspectRatios)}</_Component38>
        <_Component38 label={`真人`}>{u}</_Component38>
        <_Component38 label={`参考约束`}>{Ns(t)}</_Component38>
        <_Component38 label={`能力`}>
          <_cmp_Ls score={l} />
        </_Component38>
        <_Component38 label={`备注`}>{t?.notes || `—`}</_Component38>
      </Component904>
    </Component905>;
}