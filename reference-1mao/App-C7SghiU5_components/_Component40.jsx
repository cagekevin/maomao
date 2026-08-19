// TODO(全局, 无需 import): active, onRun, showToast, encodeURIComponent, status, t, n, u, c, m, x, p, f, i, o, l, appId, appName, y, d
import _cmp__Component11 from './_Component11.jsx';
import { _, e, rt, r, a, ut, g, _Component8, _Component4, _Component7, _Component1, _Component10, N } from './shared.js';
import * as G from 'react';
export default function _Component40({
  active: e,
  onRun: n,
  showToast: r
}) {
  let [i, a] = G.useState(false);
  let [o, c] = G.useState(``);
  let [l, u] = G.useState([]);
  let [d, f] = G.useState(false);
  let [p, m] = G.useState(false);
  let [g, _] = G.useState(null);
  let y = async e => {
    _(e.appId);
    try {
      let t = e.status === `offline` ? `published` : `offline`;
      let n = await rt(`/workflow-apps/${encodeURIComponent(e.appId)}`, {
        status: t
      });
      if (!n.success) {
        throw Error(n.error || `操作失败`);
      }
      r?.(t === `offline` ? `应用已下架` : `应用已重新上架`, `success`);
      u(t === `offline` ? t => {
        return t.filter(t => {
          return t.appId !== e.appId;
        });
      } : n => {
        return n.map(n => {
          if (n.appId === e.appId) {
            return {
              ...n,
              status: t
            };
          } else {
            return n;
          }
        });
      });
    } catch (e) {
      r?.(e?.message || `操作失败`, `error`);
    } finally {
      _(null);
    }
  };
  let x = G.useCallback(async () => {
    a(true);
    c(``);
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
      u(n);
    } catch (e) {
      c(e?.message || `加载失败`);
    } finally {
      a(false);
      m(true);
    }
  }, []);
  G.useEffect(() => {
    if (e && !p) {
      x();
    }
  }, [e, p, x]);
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
  const Component177 = `span`;
  const Component178 = `div`;
  const Component179 = `button`;
  const Component180 = `button`;
  const Component181 = `div`;
  const Component182 = `div`;
  const Component183 = `div`;
  const Component184 = `div`;
  const Component185 = `div`;
  const Component186 = `div`;
  return <Component186 className={`h-full flex flex-col bg-[#0d0c0c]`}>
      <Component167 className={`flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f]`}>
        <Component163>
          <Component161 className={`text-white font-bold text-lg`}>{`AI小站`}</Component161>
          <Component162 className={`text-xs text-gray-500 mt-1`}>{`浏览已发布的工作流应用；公开应用可直接运行，私有应用需要许可证`}</Component162>
        </Component163>
        <Component166 className={`flex items-center gap-2`}>
          <Component164 onClick={() => {
          return f(true);
        }} className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#333] text-gray-300 hover:text-white hover:bg-white/5 text-sm`}>
            <_Component8 size={14} />
            {` 许可证管理`}
          </Component164>
          <Component165 onClick={x} disabled={i} className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 text-sm`}>
            <_Component4 size={14} className={i ? `animate-spin` : ``} />
            {` 刷新`}
          </Component165>
        </Component166>
      </Component167>
      <Component185 className={`flex-1 overflow-y-auto p-6 custom-scrollbar`}>
        {o && <Component168 className={`mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300`}>
            {o}
          </Component168>}
        {i && l.length === 0 ? <Component169 className={`h-56 flex items-center justify-center text-gray-400`}>
            <_Component4 size={16} className={`animate-spin mr-2`} />
            {` 正在加载应用…`}
          </Component169> : l.length === 0 ? <Component170 className={`rounded-2xl border border-dashed border-[#333] bg-[#101010] p-12 text-center text-gray-500`}>{`暂无已发布的应用。在画布右上角「发布为应用」后即可在此看到。`}</Component170> : <Component184 className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`}>
            {l.map(e => {
          return <Component183 className={`rounded-2xl border border-[#2a2a2a] bg-[#151414] overflow-hidden flex flex-col hover:border-[#3a3a3a] transition-colors`} key={e.appId}>
                  <Component172 className={`h-28 bg-gradient-to-br from-blue-600/40 to-purple-500/30 flex items-end p-4`}>
                    <Component171 className={`text-white font-bold text-base truncate`}>
                      {e.appName}
                    </Component171>
                  </Component172>
                  <Component182 className={`p-4 flex flex-col gap-3 flex-1`}>
                    <Component173 className={`text-xs text-gray-400 line-clamp-2 min-h-[2rem]`}>
                      {e.description || `暂无描述`}
                    </Component173>
                    <Component178 className={`flex items-center gap-2 flex-wrap text-[11px]`}>
                      <Component174 className={`inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-gray-300`}>
                        {e.visibility === `public` ? <_Component7 size={11} /> : <_Component1 size={11} />}
                        {e.visibility === `public` ? `公开` : `私有`}
                      </Component174>
                      {e.isOwner && <Component175 className={`inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-300`}>
                          <_Component10 size={11} />
                          {` 我的应用`}
                        </Component175>}
                      {e.isOwner && e.status === `offline` && <Component176 className={`inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-1 text-red-300`}>
                          <_Component1 size={11} />
                          {` 已下架`}
                        </Component176>}
                      {typeof e.currentVersionNo == `number` && <Component177 className={`rounded-full bg-white/5 px-2 py-1 text-gray-400`}>
                          {`v`}
                          {e.currentVersionNo}
                        </Component177>}
                    </Component178>
                    <Component181 className={`mt-auto pt-2 flex items-center gap-2`}>
                      <Component179 onClick={() => {
                  return n({
                    appId: e.appId,
                    appName: e.appName
                  });
                }} disabled={e.status === `offline` && !e.isOwner} className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#222] text-gray-100 hover:bg-[#2b2b2b] text-sm disabled:opacity-50`}>
                        <N size={13} />
                        {` `}
                        {e.status === `offline` ? `已下架` : `运行应用`}
                      </Component179>
                      {e.isOwner && <Component180 onClick={() => {
                  return y(e);
                }} disabled={g === e.appId} className={`px-3 py-2 rounded-lg border text-sm transition-colors ${e.status === `offline` ? `border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10` : `border-red-500/30 text-red-400 hover:bg-red-500/10`}`}>
                          {g === e.appId ? `处理中` : e.status === `offline` ? `上架` : `下架`}
                        </Component180>}
                    </Component181>
                  </Component182>
                </Component183>;
        })}
          </Component184>}
      </Component185>
      {d && <_cmp__Component11 open={d} onClose={() => {
      return f(false);
    }} />}
    </Component186>;
}