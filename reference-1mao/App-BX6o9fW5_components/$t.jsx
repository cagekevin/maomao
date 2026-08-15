// TODO(全局, 无需 import): onSaved, t, i, o, l, n, d, c, u
import { _e, ve, e, a, he, r, _Component6, _Component3 } from './shared.js';
import * as W from 'react';
export default function $t({
  onSaved: e
}) {
  let [t, n] = W.useState(() => {
    return _e();
  });
  let [r, i] = W.useState(false);
  let [a, o] = W.useState(null);
  let [c, l] = W.useState(``);
  let u = W.useMemo(() => {
    return ve.find(e => {
      return e.url === t;
    })?.label || t;
  }, [t]);
  let d = async a => {
    if (!r && a !== t) {
      i(true);
      o(a);
      l(``);
      try {
        if (!(await he(a))) {
          l(`保存失败，请确认本地引擎已连接后重试`);
          i(false);
          o(null);
          return;
        }
        n(a);
        e?.(`接入点已保存，即将重载以生效`);
        window.setTimeout(() => {
          return window.location.reload();
        }, 800);
      } catch (e) {
        l(e instanceof Error ? e.message : `保存失败`);
        i(false);
        o(null);
      }
    }
  };
  const Component88 = `div`;
  const Component89 = `h2`;
  const Component90 = `p`;
  const Component91 = `div`;
  const Component92 = `div`;
  const Component99 = `div`;
  const Component100 = `div`;
  const Component101 = `p`;
  const Component102 = `p`;
  const Component103 = `div`;
  const Component104 = `div`;
  return <Component104 className={`bg-gradient-to-br from-[#1a1a1a] to-[#0d0c0c] rounded-xl overflow-hidden shadow-sm border border-[#222]`}>
      <Component92 className={`flex items-center gap-4 p-5 border-b border-[#222] bg-[#1a1a1a]`}>
        <Component88 className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-400/25`}>
          <_Component6 size={20} className={`text-emerald-300`} />
        </Component88>
        <Component91>
          <Component89 className={`font-bold text-gray-100 text-[15px]`}>{`云端接入点`}</Component89>
          <Component90 className={`text-xs text-gray-500 mt-1`}>{`登录、云同步等云端请求都会走当前选中的接入点。切换后会自动重载页面。`}</Component90>
        </Component91>
      </Component92>
      <Component100 className={`p-4 space-y-2`}>
        {ve.map(e => {
        let n = e.url === t;
        let i = r && a === e.url;
        const Component93 = `div`;
        const Component94 = `div`;
        const Component95 = `div`;
        const Component96 = `span`;
        const Component97 = `div`;
        const Component98 = `button`;
        return <Component98 onClick={() => {
          return d(e.url);
        }} disabled={r} className={`w-full text-left rounded-lg border px-4 py-3 transition-colors ${n ? `border-blue-500 bg-blue-500/10 text-white` : `border-[#333] bg-[#151515] text-gray-300 hover:bg-white/5`} ${r ? `cursor-not-allowed opacity-80` : ``}`} key={e.url}>
              <Component97 className={`flex items-center justify-between gap-3`}>
                <Component95 className={`min-w-0`}>
                  <Component93 className={`font-medium`}>{e.label}</Component93>
                  <Component94 className={`text-xs text-gray-500 mt-1 font-mono break-all`}>
                    {e.url}
                  </Component94>
                </Component95>
                {i ? <_Component3 size={14} className={`animate-spin text-blue-300 flex-shrink-0`} /> : n ? <Component96 className={`text-xs text-blue-300 flex-shrink-0`}>{`当前`}</Component96> : null}
              </Component97>
            </Component98>;
      })}
        {ve.length === 0 && <Component99 className={`text-xs text-gray-500 bg-[#0d0c0c] border border-[#333] rounded-lg p-4`}>{`未配置接入点列表（VITE_API_ENDPOINTS）。`}</Component99>}
      </Component100>
      <Component103 className={`px-4 pb-4`}>
        {c ? <Component101 className={`text-xs text-red-400`}>{c}</Component101> : <Component102 className={`text-xs text-gray-500`}>
            {`当前接入点：`}
            {u}
          </Component102>}
      </Component103>
    </Component104>;
}