// TODO(全局, 无需 import): active, onRun, i, o, t, n, l, p, m, f, d, c, appId, appName, u
import _cmp__Component11 from './_Component11.jsx';
import { ut, e, r, a, _Component7, _Component3, _Component6, _Component1, _Component10, _Component0 } from './shared.js';
import * as W from 'react';
export default function _Component42({
  active: e,
  onRun: n
}) {
  let [r, i] = W.useState(false);
  let [a, o] = W.useState(``);
  let [c, l] = W.useState([]);
  let [u, d] = W.useState(false);
  let [f, p] = W.useState(false);
  let m = W.useCallback(async () => {
    i(true);
    o(``);
    try {
      let e = await ut(`/workflow-apps`);
      if (!e.success) {
        throw Error(e.error || `加载失败`);
      }
      let t = e.data;
      let n = Array.isArray(t) ? t : t?.data;
      if (!Array.isArray(n)) {
        throw Error(t?.error || `加载失败`);
      }
      l(n);
    } catch (e) {
      o(e?.message || `加载失败`);
    } finally {
      i(false);
      p(true);
    }
  }, []);
  W.useEffect(() => {
    if (e && !f) {
      m();
    }
  }, [e, f, m]);
  const Component161 = `div`;
  const Component162 = `div`;
  const Component163 = `div`;
  const Component164 = `button`;
  const Component165 = `button`;
  const Component166 = `div`;
  const Component167 = `div`;
  const Component168 = `div`;
  const Component169 = `div`;
  const Component170 = `div`;
  const Component171 = `div`;
  const Component172 = `div`;
  const Component173 = `div`;
  const Component174 = `span`;
  const Component175 = `span`;
  const Component176 = `span`;
  const Component177 = `div`;
  const Component178 = `button`;
  const Component179 = `div`;
  const Component180 = `div`;
  const Component181 = `div`;
  const Component182 = `div`;
  const Component183 = `div`;
  const Component184 = `div`;
  return <Component184 className={`h-full flex flex-col bg-[#0d0c0c]`}>
      <Component167 className={`flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f]`}>
        <Component163>
          <Component161 className={`text-white font-bold text-lg`}>{`AI小站`}</Component161>
          <Component162 className={`text-xs text-gray-500 mt-1`}>{`浏览已发布的工作流应用；公开应用可直接运行，私有应用需要许可证`}</Component162>
        </Component163>
        <Component166 className={`flex items-center gap-2`}>
          <Component164 onClick={() => {
          return d(true);
        }} className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#333] text-gray-300 hover:text-white hover:bg-white/5 text-sm`}>
            <_Component7 size={14} />
            {` 许可证管理`}
          </Component164>
          <Component165 onClick={m} disabled={r} className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 text-sm`}>
            <_Component3 size={14} className={r ? `animate-spin` : ``} />
            {` 刷新`}
          </Component165>
        </Component166>
      </Component167>
      <Component183 className={`flex-1 overflow-y-auto p-6 custom-scrollbar`}>
        {a && <Component168 className={`mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300`}>
            {a}
          </Component168>}
        {r && c.length === 0 ? <Component169 className={`h-56 flex items-center justify-center text-gray-400`}>
            <_Component3 size={16} className={`animate-spin mr-2`} />
            {` 正在加载应用…`}
          </Component169> : c.length === 0 ? <Component170 className={`rounded-2xl border border-dashed border-[#333] bg-[#101010] p-12 text-center text-gray-500`}>{`暂无已发布的应用。在画布右上角「发布为应用」后即可在此看到。`}</Component170> : <Component182 className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`}>
            {c.map(e => {
          return <Component181 className={`rounded-2xl border border-[#2a2a2a] bg-[#151414] overflow-hidden flex flex-col hover:border-[#3a3a3a] transition-colors`} key={e.appId}>
                  <Component172 className={`h-28 bg-gradient-to-br from-blue-600/40 to-purple-500/30 flex items-end p-4`}>
                    <Component171 className={`text-white font-bold text-base truncate`}>
                      {e.appName}
                    </Component171>
                  </Component172>
                  <Component180 className={`p-4 flex flex-col gap-3 flex-1`}>
                    <Component173 className={`text-xs text-gray-400 line-clamp-2 min-h-[2rem]`}>
                      {e.description || `暂无描述`}
                    </Component173>
                    <Component177 className={`flex items-center gap-2 flex-wrap text-[11px]`}>
                      <Component174 className={`inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-gray-300`}>
                        {e.visibility === `public` ? <_Component6 size={11} /> : <_Component1 size={11} />}
                        {e.visibility === `public` ? `公开` : `私有`}
                      </Component174>
                      {e.isOwner && <Component175 className={`inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-300`}>
                          <_Component10 size={11} />
                          {` 我的应用`}
                        </Component175>}
                      {typeof e.currentVersionNo == `number` && <Component176 className={`rounded-full bg-white/5 px-2 py-1 text-gray-400`}>
                          {`v`}
                          {e.currentVersionNo}
                        </Component176>}
                    </Component177>
                    <Component179 className={`mt-auto pt-2`}>
                      <Component178 onClick={() => {
                  return n({
                    appId: e.appId,
                    appName: e.appName
                  });
                }} className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#222] text-gray-100 hover:bg-[#2b2b2b] text-sm`}>
                        <_Component0 size={13} />
                        {` 运行应用`}
                      </Component178>
                    </Component179>
                  </Component180>
                </Component181>;
        })}
          </Component182>}
      </Component183>
      {u && <_cmp__Component11 open={u} onClose={() => {
      return d(false);
    }} />}
    </Component184>;
}