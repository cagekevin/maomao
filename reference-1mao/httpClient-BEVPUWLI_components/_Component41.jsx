// TODO(全局, 无需 import): open, modelNames, specsByName, selectedModel, onClose, onConfirm, name, entry, n, i, o, r, f, p, s, l, u
import _cmp_As from './As.jsx';
import _cmp_Ls from './Ls.jsx';
import { t, e, Fn, sa, ca, ha, Ps, Fs, xs, fa, a, c, Is, vs, _s, ks, Ns, d, Gt, Se } from './shared.js';
import * as Z from 'react';
export default function _Component41({
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
    const Component906 = `h2`;
    const Component907 = `button`;
    const Component908 = `div`;
    const Component909 = `th`;
    const Component910 = `th`;
    const Component911 = `th`;
    const Component912 = `th`;
    const Component913 = `th`;
    const Component914 = `th`;
    const Component915 = `th`;
    const Component916 = `th`;
    const Component917 = `th`;
    const Component918 = `th`;
    const Component919 = `tr`;
    const Component920 = `thead`;
    const Component944 = `tbody`;
    const Component945 = `table`;
    const Component946 = `div`;
    const Component947 = `div`;
    const Component948 = `span`;
    const Component949 = `button`;
    const Component950 = `div`;
    const Component951 = `div`;
    const Component952 = `div`;
    return Fn.createPortal(<Component952 className={`fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm nowheel nopan nodrag`} onClick={i}>
        <Component951 className={`bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl w-[min(96vw,1100px)] max-h-[85vh] flex flex-col`} onClick={e => {
        return e.stopPropagation();
      }}>
          <Component908 className={`flex items-center justify-between px-5 py-4 border-b border-[#333]`}>
            <Component906 className={`text-gray-100 text-base font-semibold`}>{`选择 AI 模型`}</Component906>
            <Component907 type={`button`} onClick={i} className={`text-gray-400 hover:text-white p-1 rounded transition-colors`} aria-label={`关闭`}>
              <Gt size={18} />
            </Component907>
          </Component908>
          <Component947 className={`overflow-y-auto overflow-x-hidden flex-1 custom-scrollbar`}>
            <Component945 className={`w-full text-[11px] text-left border-collapse table-fixed`}>
              <Component920 className={`sticky top-0 bg-[#222] z-10`}>
                <Component919 className={`text-gray-400 border-b border-[#333]`}>
                  <Component909 className={`px-2 py-2 font-medium w-[15%]`}>{`名字`}</Component909>
                  <Component910 className={`px-2 py-2 font-medium w-[8%]`}>{`价格`}</Component910>
                  <Component911 className={`px-2 py-2 font-medium w-[8%]`}>{`平均速度`}</Component911>
                  <Component912 className={`px-2 py-2 font-medium w-[6%]`}>{`稳定性`}</Component912>
                  <Component913 className={`px-2 py-2 font-medium w-[9%]`}>{`时长`}</Component913>
                  <Component914 className={`px-2 py-2 font-medium w-[15%]`}>{`规格`}</Component914>
                  <Component915 className={`px-2 py-2 font-medium w-[5%] text-center`}>{`真人`}</Component915>
                  <Component916 className={`px-2 py-2 font-medium w-[12%]`}>{`参考约束`}</Component916>
                  <Component917 className={`px-2 py-2 font-medium w-[8%]`}>{`能力`}</Component917>
                  <Component918 className={`px-2 py-2 font-medium w-[11%]`}>{`备注`}</Component918>
                </Component919>
              </Component920>
              <Component944>
                {o.map(({
                name: e,
                entry: t
              }) => {
                let n = t?.displayName || e;
                let i = t?.power ?? sa(e);
                let o = t?.unit ?? ca(e);
                let s = i == null ? `—` : `${ha(i)}${o ? `/${o}` : ``}`;
                let c = t?.speed?.label;
                let l = Ps(t?.stability);
                let u = Fs(t?.stability);
                let d = xs(t ?? undefined);
                let f = r === e;
                let p = t?.isRecommended ?? fa(e);
                const Component921 = `span`;
                const Component922 = `span`;
                const Component923 = `div`;
                const Component924 = `div`;
                const Component925 = `td`;
                const Component926 = `span`;
                const Component927 = `td`;
                const Component928 = `span`;
                const Component929 = `span`;
                const Component930 = `td`;
                const Component931 = `span`;
                const Component932 = `span`;
                const Component933 = `td`;
                const Component934 = `td`;
                const Component935 = `div`;
                const Component936 = `div`;
                const Component937 = `td`;
                const Component938 = `span`;
                const Component939 = `td`;
                const Component940 = `td`;
                const Component941 = `td`;
                const Component942 = `td`;
                const Component943 = `tr`;
                return <Component943 className={`border-b border-[#2a2a2a] cursor-pointer transition-colors ${f ? `bg-white/10` : `hover:bg-[#252525]`}`} onClick={() => {
                  return a(e);
                }} key={e}>
                      <Component925 className={`px-2 py-2.5 text-gray-200 align-top`}>
                        <Component923 className={`flex items-center gap-1.5 flex-wrap`}>
                          <Component921 className={`break-all`}>{n}</Component921>
                          {p && <Component922 className={`text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0`}>{`推荐`}</Component922>}
                        </Component923>
                        {n !== e && <Component924 className={`text-[10px] text-gray-500 font-mono mt-0.5 break-all`}>
                            {e}
                          </Component924>}
                      </Component925>
                      <Component927 className={`px-2 py-2.5 text-yellow-300 align-top`}>
                        {i == null ? `—` : <Component926 className={`inline-flex items-center gap-0.5 tabular-nums flex-wrap`}>
                            <_cmp_As className={`w-3 h-3 shrink-0`} />
                            {s}
                          </Component926>}
                      </Component927>
                      <Component930 className={`px-2 py-2.5 align-top`}>
                        {c ? <Component928 className={`text-[11px] text-sky-300 tabular-nums whitespace-nowrap`}>
                            {c}
                          </Component928> : <Component929 className={`text-gray-500`}>{`—`}</Component929>}
                      </Component930>
                      <Component933 className={`px-2 py-2.5 align-top`}>
                        {l ? <Component931 className={`tabular-nums ${Is(u)}`}>{l}</Component931> : <Component932 className={`text-gray-500`}>{`—`}</Component932>}
                      </Component933>
                      <Component934 className={`px-2 py-2.5 text-gray-300 align-top break-words`}>
                        {vs(_s(t ?? undefined), t?.durationLabel)}
                      </Component934>
                      <Component937 className={`px-2 py-2.5 text-gray-300 align-top whitespace-nowrap`}>
                        <Component935>{ks(t?.resolutions)}</Component935>
                        <Component936 className={`text-gray-400 mt-0.5`}>
                          {ks(t?.aspectRatios)}
                        </Component936>
                      </Component937>
                      <Component939 className={`px-2 py-2.5 align-top text-center`}>
                        {t?.supportsRealPerson === false ? <Component938 className={`text-gray-600`}>{`—`}</Component938> : <Se size={14} className={`inline text-emerald-400`} />}
                      </Component939>
                      <Component940 className={`px-2 py-2.5 text-gray-300 align-top break-words`}>
                        {Ns(t)}
                      </Component940>
                      <Component941 className={`px-2 py-2.5 text-gray-300 align-top`}>
                        <_cmp_Ls score={d} />
                      </Component941>
                      <Component942 className={`px-2 py-2.5 text-gray-400 align-top break-words`} title={t?.notes || undefined}>
                        {t?.notes || `—`}
                      </Component942>
                    </Component943>;
              })}
              </Component944>
            </Component945>
            {!o.length && <Component946 className={`py-12 text-center text-gray-500 text-sm`}>{`未配置特惠视频模型`}</Component946>}
          </Component947>
          <Component950 className={`flex items-center justify-between gap-3 px-5 py-3 border-t border-[#333]`}>
            <Component948 className={`text-[11px] text-gray-500`}>{`点击任意模型即可选择`}</Component948>
            <Component949 type={`button`} onClick={i} className={`px-4 py-2 text-sm rounded-lg bg-[#2a2a2a] text-gray-300 hover:bg-[#333] border border-[#444] transition-colors`}>{`关闭`}</Component949>
          </Component950>
        </Component951>
      </Component952>, document.body);
  } else {
    return null;
  }
}