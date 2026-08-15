// TODO(全局, 无需 import): open, modelNames, specsByName, selectedModel, onClose, onConfirm, name, entry, n, i, o, r, f, p, s, l, u
import _cmp__s from './_s.jsx';
import _cmp__Component40 from './_Component40.jsx';
import { t, e, Fn, ta, na, la, xs, Ss, ls, oa, a, c, Cs, os, as, gs, bs, d, Gt, Se } from './shared.js';
import * as Z from 'react';
export default function Es({
  open: e,
  modelNames: t,
  specsByName: n,
  selectedModel: r,
  onClose: i,
  onConfirm: a
}) {
  let o = Z.useMemo(() => {
    return t.map(e => {
      return {
        name: e,
        entry: n[e] ?? null
      };
    });
  }, [t, n]);
  if (e) {
    const Component900 = `h2`;
    const Component901 = `button`;
    const Component902 = `div`;
    const Component903 = `th`;
    const Component904 = `th`;
    const Component905 = `th`;
    const Component906 = `th`;
    const Component907 = `th`;
    const Component908 = `th`;
    const Component909 = `th`;
    const Component910 = `th`;
    const Component911 = `th`;
    const Component912 = `th`;
    const Component913 = `tr`;
    const Component914 = `thead`;
    const Component938 = `tbody`;
    const Component939 = `table`;
    const Component940 = `div`;
    const Component941 = `div`;
    const Component942 = `span`;
    const Component943 = `button`;
    const Component944 = `div`;
    const Component945 = `div`;
    const Component946 = `div`;
    return Fn.createPortal(<Component946 className={`fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm nowheel nopan nodrag`} onClick={i}>
        <Component945 className={`bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl w-[min(96vw,1100px)] max-h-[85vh] flex flex-col`} onClick={e => {
        return e.stopPropagation();
      }}>
          <Component902 className={`flex items-center justify-between px-5 py-4 border-b border-[#333]`}>
            <Component900 className={`text-gray-100 text-base font-semibold`}>{`选择 AI 模型`}</Component900>
            <Component901 type={`button`} onClick={i} className={`text-gray-400 hover:text-white p-1 rounded transition-colors`} aria-label={`关闭`}>
              <Gt size={18} />
            </Component901>
          </Component902>
          <Component941 className={`overflow-y-auto overflow-x-hidden flex-1 custom-scrollbar`}>
            <Component939 className={`w-full text-[11px] text-left border-collapse table-fixed`}>
              <Component914 className={`sticky top-0 bg-[#222] z-10`}>
                <Component913 className={`text-gray-400 border-b border-[#333]`}>
                  <Component903 className={`px-2 py-2 font-medium w-[15%]`}>{`名字`}</Component903>
                  <Component904 className={`px-2 py-2 font-medium w-[8%]`}>{`价格`}</Component904>
                  <Component905 className={`px-2 py-2 font-medium w-[8%]`}>{`平均速度`}</Component905>
                  <Component906 className={`px-2 py-2 font-medium w-[6%]`}>{`稳定性`}</Component906>
                  <Component907 className={`px-2 py-2 font-medium w-[9%]`}>{`时长`}</Component907>
                  <Component908 className={`px-2 py-2 font-medium w-[15%]`}>{`规格`}</Component908>
                  <Component909 className={`px-2 py-2 font-medium w-[5%] text-center`}>{`真人`}</Component909>
                  <Component910 className={`px-2 py-2 font-medium w-[12%]`}>{`参考约束`}</Component910>
                  <Component911 className={`px-2 py-2 font-medium w-[8%]`}>{`能力`}</Component911>
                  <Component912 className={`px-2 py-2 font-medium w-[11%]`}>{`备注`}</Component912>
                </Component913>
              </Component914>
              <Component938>
                {o.map(({
                name: e,
                entry: t
              }) => {
                let n = t?.displayName || e;
                let i = t?.power ?? ta(e);
                let o = t?.unit ?? na(e);
                let s = i == null ? `—` : `${la(i)}${o ? `/${o}` : ``}`;
                let c = t?.speed?.label;
                let l = xs(t?.stability);
                let u = Ss(t?.stability);
                let d = ls(t ?? undefined);
                let f = r === e;
                let p = t?.isRecommended ?? oa(e);
                const Component915 = `span`;
                const Component916 = `span`;
                const Component917 = `div`;
                const Component918 = `div`;
                const Component919 = `td`;
                const Component920 = `span`;
                const Component921 = `td`;
                const Component922 = `span`;
                const Component923 = `span`;
                const Component924 = `td`;
                const Component925 = `span`;
                const Component926 = `span`;
                const Component927 = `td`;
                const Component928 = `td`;
                const Component929 = `div`;
                const Component930 = `div`;
                const Component931 = `td`;
                const Component932 = `span`;
                const Component933 = `td`;
                const Component934 = `td`;
                const Component935 = `td`;
                const Component936 = `td`;
                const Component937 = `tr`;
                return <Component937 className={`border-b border-[#2a2a2a] cursor-pointer transition-colors ${f ? `bg-white/10` : `hover:bg-[#252525]`}`} onClick={() => {
                  return a(e);
                }} key={e}>
                      <Component919 className={`px-2 py-2.5 text-gray-200 align-top`}>
                        <Component917 className={`flex items-center gap-1.5 flex-wrap`}>
                          <Component915 className={`break-all`}>{n}</Component915>
                          {p && <Component916 className={`text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0`}>{`推荐`}</Component916>}
                        </Component917>
                        {n !== e && <Component918 className={`text-[10px] text-gray-500 font-mono mt-0.5 break-all`}>
                            {e}
                          </Component918>}
                      </Component919>
                      <Component921 className={`px-2 py-2.5 text-yellow-300 align-top`}>
                        {i == null ? `—` : <Component920 className={`inline-flex items-center gap-0.5 tabular-nums flex-wrap`}>
                            <_cmp__s className={`w-3 h-3 shrink-0`} />
                            {s}
                          </Component920>}
                      </Component921>
                      <Component924 className={`px-2 py-2.5 align-top`}>
                        {c ? <Component922 className={`text-[11px] text-sky-300 tabular-nums whitespace-nowrap`}>
                            {c}
                          </Component922> : <Component923 className={`text-gray-500`}>{`—`}</Component923>}
                      </Component924>
                      <Component927 className={`px-2 py-2.5 align-top`}>
                        {l ? <Component925 className={`tabular-nums ${Cs(u)}`}>{l}</Component925> : <Component926 className={`text-gray-500`}>{`—`}</Component926>}
                      </Component927>
                      <Component928 className={`px-2 py-2.5 text-gray-300 align-top break-words`}>
                        {os(as(t ?? undefined), t?.durationLabel)}
                      </Component928>
                      <Component931 className={`px-2 py-2.5 text-gray-300 align-top whitespace-nowrap`}>
                        <Component929>{gs(t?.resolutions)}</Component929>
                        <Component930 className={`text-gray-400 mt-0.5`}>
                          {gs(t?.aspectRatios)}
                        </Component930>
                      </Component931>
                      <Component933 className={`px-2 py-2.5 align-top text-center`}>
                        {t?.supportsRealPerson === false ? <Component932 className={`text-gray-600`}>{`—`}</Component932> : <Se size={14} className={`inline text-emerald-400`} />}
                      </Component933>
                      <Component934 className={`px-2 py-2.5 text-gray-300 align-top break-words`}>
                        {bs(t)}
                      </Component934>
                      <Component935 className={`px-2 py-2.5 text-gray-300 align-top`}>
                        <_cmp__Component40 score={d} />
                      </Component935>
                      <Component936 className={`px-2 py-2.5 text-gray-400 align-top break-words`} title={t?.notes || undefined}>
                        {t?.notes || `—`}
                      </Component936>
                    </Component937>;
              })}
              </Component938>
            </Component939>
            {!o.length && <Component940 className={`py-12 text-center text-gray-500 text-sm`}>{`未配置特惠视频模型`}</Component940>}
          </Component941>
          <Component944 className={`flex items-center justify-between gap-3 px-5 py-3 border-t border-[#333]`}>
            <Component942 className={`text-[11px] text-gray-500`}>{`点击任意模型即可选择`}</Component942>
            <Component943 type={`button`} onClick={i} className={`px-4 py-2 text-sm rounded-lg bg-[#2a2a2a] text-gray-300 hover:bg-[#333] border border-[#444] transition-colors`}>{`关闭`}</Component943>
          </Component944>
        </Component945>
      </Component946>, document.body);
  } else {
    return null;
  }
}