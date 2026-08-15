// TODO(全局, 无需 import): open, onClose, defaultAppId, w, h, j, startX, startY, startW, k, startH, t, i, n, s, l, appId, appName, d, p, encodeURIComponent, f, durationDays, m, maxRuns, v, note, b, y, status, width, height, maxWidth, maxHeight, o, u, c, te, ne, re, background
import { r, e, A, a, ut, N, P, O, Ge, S, E, rt, xt, g, L, C, D, T, M, _Component7, R, _Component8, _Component3, _Component9, I, _Component0, _, F } from './shared.js';
import * as W from 'react';
import * as G from 'react';
export default function _Component11({
  open: e,
  onClose: n,
  defaultAppId: r
}) {
  let [i, a] = W.useState(false);
  let [o, s] = W.useState(``);
  let [c, l] = W.useState([]);
  let [u, d] = W.useState([]);
  let [f, p] = W.useState(r || ``);
  let [m, g] = W.useState(30);
  let [v, y] = W.useState(``);
  let [b, S] = W.useState(``);
  let [C, w] = W.useState(false);
  let [T, E] = W.useState(null);
  let [D, O] = W.useState(null);
  let [k, A] = W.useState({
    w: Math.min(1100, Math.round(window.innerWidth * 0.95)),
    h: Math.min(820, Math.round(window.innerHeight * 0.9))
  });
  let j = W.useRef(null);
  let M = W.useCallback(e => {
    e.preventDefault();
    j.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: k.w,
      startH: k.h
    };
    let t = e => {
      if (!j.current) {
        return;
      }
      let {
        startX: t,
        startY: n,
        startW: r,
        startH: i
      } = j.current;
      A({
        w: Math.max(560, Math.min(window.innerWidth - 24, r + (e.clientX - t))),
        h: Math.max(420, Math.min(window.innerHeight - 24, i + (e.clientY - n)))
      });
    };
    let n = () => {
      j.current = null;
      window.removeEventListener(`mousemove`, t);
      window.removeEventListener(`mouseup`, n);
    };
    window.addEventListener(`mousemove`, t);
    window.addEventListener(`mouseup`, n);
  }, [k.w, k.h]);
  let N = W.useCallback(async () => {
    a(true);
    s(``);
    try {
      let e = await ut(`/workflow-apps/licenses/mine`);
      if (!e.success) {
        throw Error(e.error || `加载失败`);
      }
      let t = e.data;
      let n = Array.isArray(t) ? t : t?.data;
      l(Array.isArray(n) ? n : []);
    } catch (e) {
      s(e?.message || `加载失败`);
    } finally {
      a(false);
    }
  }, []);
  let P = W.useCallback(async () => {
    try {
      let e = await ut(`/workflow-apps`);
      let t = e.data;
      let n = Array.isArray(t) ? t : t?.data;
      if (e.success && Array.isArray(n)) {
        let e = n.filter(e => {
          return e.isOwner;
        }).map(e => {
          return {
            appId: e.appId,
            appName: e.appName
          };
        });
        d(e);
        p(t => {
          return t || r || e[0]?.appId || ``;
        });
      }
    } catch {}
  }, [r]);
  W.useEffect(() => {
    if (e) {
      N();
      P();
    }
  }, [e, N, P]);
  let te = async (e, t) => {
    try {
      await navigator.clipboard.writeText(e);
    } catch {
      let t = document.createElement(`input`);
      t.value = e;
      document.body.appendChild(t);
      t.select();
      document.execCommand(`copy`);
      document.body.removeChild(t);
    }
    if (t != null) {
      O(t);
      window.setTimeout(() => {
        return O(e => {
          if (e === t) {
            return null;
          } else {
            return e;
          }
        });
      }, 2000);
    }
  };
  let L = async () => {
    if (!f) {
      s(`请选择要创建许可证的应用`);
      return;
    }
    w(true);
    s(``);
    try {
      let e = await Ge(`/workflow-apps/${encodeURIComponent(f)}/licenses`, {
        durationDays: Math.max(1, Number(m) || 30),
        maxRuns: v.trim() === `` ? undefined : Math.max(1, Number(v) || 1),
        note: b.trim() || undefined
      });
      if (!e.success) {
        throw Error(e.error || `创建失败`);
      }
      S(``);
      y(``);
      await N();
    } catch (e) {
      s(e?.message || `创建失败`);
    } finally {
      w(false);
    }
  };
  let ne = async e => {
    let t = e.status === `frozen` ? `active` : `frozen`;
    E(e.id);
    s(``);
    try {
      let n = await rt(`/workflow-apps/licenses/${e.id}`, {
        status: t
      });
      if (!n.success) {
        throw Error(n.error || `操作失败`);
      }
      await N();
    } catch (e) {
      s(e?.message || `操作失败`);
    } finally {
      E(null);
    }
  };
  let re = async e => {
    if (window.confirm(`确定删除该许可证吗？删除后使用该 token 的链接将无法运行。`)) {
      E(e.id);
      s(``);
      try {
        let t = await xt(`/workflow-apps/licenses/${e.id}`);
        if (!t.success) {
          throw Error(t.error || `删除失败`);
        }
        await N();
      } catch (e) {
        s(e?.message || `删除失败`);
      } finally {
        E(null);
      }
    }
  };
  if (e) {
    const Component105 = `div`;
    const Component106 = `div`;
    const Component107 = `div`;
    const Component108 = `button`;
    const Component109 = `div`;
    const Component110 = `div`;
    const Component111 = `div`;
    const Component112 = `span`;
    const Component113 = `option`;
    const Component114 = `option`;
    const Component115 = `select`;
    const Component116 = `label`;
    const Component117 = `span`;
    const Component118 = `input`;
    const Component119 = `label`;
    const Component120 = `span`;
    const Component121 = `input`;
    const Component122 = `label`;
    const Component123 = `span`;
    const Component124 = `input`;
    const Component125 = `label`;
    const Component126 = `button`;
    const Component127 = `div`;
    const Component128 = `div`;
    const Component129 = `div`;
    const Component130 = `div`;
    const Component131 = `div`;
    const Component132 = `div`;
    const Component133 = `div`;
    const Component134 = `div`;
    const Component135 = `div`;
    const Component136 = `div`;
    const Component137 = `div`;
    const Component138 = `div`;
    const Component155 = `div`;
    const Component156 = `div`;
    const Component157 = `div`;
    const Component158 = `div`;
    const Component159 = `div`;
    const Component160 = `div`;
    return <Component160 className={`fixed inset-0 z-[210] bg-black/70 flex items-center justify-center p-4`}>
        <Component159 className={`relative overflow-hidden rounded-2xl border border-[#333] bg-[#111] shadow-2xl flex flex-col`} style={{
        width: k.w,
        height: k.h,
        maxWidth: `100vw`,
        maxHeight: `100vh`
      }}>
          <Component109 className={`flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a] bg-[#151414]`}>
            <Component107>
              <Component105 className={`text-white font-bold text-lg flex items-center gap-2`}>
                <_Component7 size={18} />
                {` 许可证管理`}
              </Component105>
              <Component106 className={`text-xs text-gray-400 mt-1`}>{`创建并管理应用许可证，可复制完整 token、冻结或删除`}</Component106>
            </Component107>
            <Component108 onClick={n} className={`text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/5`}>
              <R size={18} />
            </Component108>
          </Component109>
          <Component157 className={`flex-1 overflow-y-auto p-5 space-y-5`}>
            {o && <Component110 className={`rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300`}>
                {o}
              </Component110>}
            <Component128 className={`rounded-2xl border border-[#2a2a2a] bg-[#161616] p-4`}>
              <Component111 className={`text-sm font-bold text-white mb-3 flex items-center gap-2`}>
                <_Component8 size={15} />
                {` 新建许可证`}
              </Component111>
              <Component127 className={`grid grid-cols-1 md:grid-cols-[1.4fr_0.7fr_0.8fr_1fr_auto] gap-3 items-end`}>
                <Component116 className={`block`}>
                  <Component112 className={`text-xs text-gray-500`}>{`应用`}</Component112>
                  <Component115 value={f} onChange={e => {
                  return p(e.target.value);
                }} className={`mt-1 w-full rounded-lg border border-[#333] bg-[#101010] px-3 py-2 text-sm text-white outline-none focus:border-blue-500`}>
                    {u.length === 0 && <Component113 value={``}>{`暂无可用应用`}</Component113>}
                    {u.map(e => {
                    return <Component114 value={e.appId} key={e.appId}>
                          {e.appName}
                        </Component114>;
                  })}
                  </Component115>
                </Component116>
                <Component119 className={`block`}>
                  <Component117 className={`text-xs text-gray-500`}>{`有效期(天)`}</Component117>
                  <Component118 type={`number`} min={1} value={m} onChange={e => {
                  return g(Number(e.target.value));
                }} className={`mt-1 w-full rounded-lg border border-[#333] bg-[#101010] px-3 py-2 text-sm text-white outline-none focus:border-blue-500`} />
                </Component119>
                <Component122 className={`block`}>
                  <Component120 className={`text-xs text-gray-500`}>{`运行次数`}</Component120>
                  <Component121 type={`number`} min={1} value={v} onChange={e => {
                  return y(e.target.value);
                }} placeholder={`不填=不限`} className={`mt-1 w-full rounded-lg border border-[#333] bg-[#101010] px-3 py-2 text-sm text-white outline-none focus:border-blue-500`} />
                </Component122>
                <Component125 className={`block`}>
                  <Component123 className={`text-xs text-gray-500`}>{`备注(可选)`}</Component123>
                  <Component124 value={b} onChange={e => {
                  return S(e.target.value);
                }} placeholder={`用途 / 发放对象`} className={`mt-1 w-full rounded-lg border border-[#333] bg-[#101010] px-3 py-2 text-sm text-white outline-none focus:border-blue-500`} />
                </Component125>
                <Component126 onClick={L} disabled={C || !f} className={`h-[38px] px-4 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50 flex items-center gap-2 justify-center`}>
                  {C ? <_Component3 size={14} className={`animate-spin`} /> : <_Component8 size={14} />}
                  {`创建`}
                </Component126>
              </Component127>
            </Component128>
            <Component156>
              <Component129 className={`text-sm font-bold text-white mb-3`}>{`已创建的许可证`}</Component129>
              {i ? <Component130 className={`h-40 flex items-center justify-center text-gray-400`}>
                  <_Component3 size={16} className={`animate-spin mr-2`} />
                  {` 正在加载许可证…`}
                </Component130> : c.length === 0 ? <Component131 className={`rounded-2xl border border-dashed border-[#333] bg-[#101010] p-8 text-center text-gray-500`}>{`暂无许可证记录`}</Component131> : <Component155 className={`rounded-xl border border-[#2a2a2a] overflow-hidden`}>
                  <Component138 className={`hidden md:grid grid-cols-[minmax(120px,1.4fr)_minmax(180px,2fr)_90px_140px_90px_160px] gap-3 px-4 py-2.5 bg-[#161616] border-b border-[#2a2a2a] text-[11px] font-medium text-gray-500`}>
                    <Component132>{`应用 / 备注`}</Component132>
                    <Component133>{`Token`}</Component133>
                    <Component134>{`状态`}</Component134>
                    <Component135>{`有效期`}</Component135>
                    <Component136>{`运行次数`}</Component136>
                    <Component137 className={`text-right`}>{`操作`}</Component137>
                  </Component138>
                  {c.map(e => {
                let t = e.status === `frozen`;
                let n = e.fullToken || e.token;
                const Component139 = `div`;
                const Component140 = `div`;
                const Component141 = `div`;
                const Component142 = `span`;
                const Component143 = `button`;
                const Component144 = `div`;
                const Component145 = `span`;
                const Component146 = `div`;
                const Component147 = `div`;
                const Component148 = `div`;
                const Component149 = `div`;
                const Component150 = `div`;
                const Component151 = `button`;
                const Component152 = `button`;
                const Component153 = `div`;
                const Component154 = `div`;
                return <Component154 className={`grid grid-cols-1 md:grid-cols-[minmax(120px,1.4fr)_minmax(180px,2fr)_90px_140px_90px_160px] gap-2 md:gap-3 px-4 py-3 border-b border-[#1f1f1f] last:border-b-0 hover:bg-white/[0.02] items-center text-xs`} key={e.id}>
                        <Component141 className={`min-w-0`}>
                          <Component139 className={`text-white font-medium truncate`}>
                            {e.appName || e.appSlug || `未命名应用`}
                          </Component139>
                          <Component140 className={`text-[11px] text-gray-500 truncate`}>
                            {`ID: `}
                            {e.id}
                            {e.note ? ` · ${e.note}` : ``}
                          </Component140>
                        </Component141>
                        <Component144 className={`min-w-0 flex items-center gap-2`}>
                          <Component142 className={`text-gray-200 font-mono truncate flex-1`} title={`复制可获取完整 token`}>
                            {e.token}
                          </Component142>
                          <Component143 onClick={() => {
                      return te(n, e.id);
                    }} className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] ${D === e.id ? `border-emerald-500/40 text-emerald-300 bg-emerald-500/10` : `border-[#333] text-gray-300 hover:text-white hover:bg-white/5`}`}>
                            {D === e.id ? <G.Fragment>
                                <_Component9 size={11} />
                                {` 已复制`}
                              </G.Fragment> : <G.Fragment>
                                <I size={11} />
                                {` 复制`}
                              </G.Fragment>}
                          </Component143>
                        </Component144>
                        <Component146>
                          <Component145 className={`inline-flex px-2 py-0.5 rounded-full text-[11px] ${t ? `bg-amber-500/15 text-amber-300` : `bg-emerald-500/15 text-emerald-300`}`}>
                            {t ? `已冻结` : `有效`}
                          </Component145>
                        </Component146>
                        <Component149 className={`text-gray-400 text-[11px] leading-4`}>
                          <Component147>{new Date(e.startAt).toLocaleDateString()}</Component147>
                          <Component148>
                            {`~ `}
                            {new Date(e.endAt).toLocaleDateString()}
                          </Component148>
                        </Component149>
                        <Component150 className={`text-gray-300`}>
                          {e.runCount ?? 0}
                          {` / `}
                          {e.maxRuns == null ? `不限` : e.maxRuns}
                        </Component150>
                        <Component153 className={`flex items-center justify-end gap-1.5`}>
                          <Component151 onClick={() => {
                      return ne(e);
                    }} disabled={T === e.id} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#333] text-gray-200 hover:bg-white/5 disabled:opacity-50 text-[11px]`} title={t ? `恢复` : `冻结`}>
                            {T === e.id ? <_Component3 size={12} className={`animate-spin`} /> : t ? <_Component0 size={12} /> : <_ size={12} />}
                            {t ? `恢复` : `冻结`}
                          </Component151>
                          <Component152 onClick={() => {
                      return re(e);
                    }} disabled={T === e.id} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border border-red-500/30 text-red-300 hover:bg-red-500/10 disabled:opacity-50 text-[11px]`} title={`删除`}>
                            <F size={12} />
                            {` 删除`}
                          </Component152>
                        </Component153>
                      </Component154>;
              })}
                </Component155>}
            </Component156>
          </Component157>
          <Component158 onMouseDown={M} className={`absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize`} style={{
          background: `linear-gradient(135deg, transparent 50%, #444 50%, #444 60%, transparent 60%, transparent 72%, #444 72%, #444 82%, transparent 82%)`
        }} title={`拖拽调整大小`} />
        </Component159>
      </Component160>;
  } else {
    return null;
  }
}