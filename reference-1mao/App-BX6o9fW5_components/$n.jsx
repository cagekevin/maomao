// TODO(全局, 无需 import): open, app, onClose, n, i, encodeURIComponent, b, t, l, p, x, y, k, d, durationDays, m, note, f, o, c, j, u, w
import { Je, E, T, ut, e, C, a, g, Ge, _, r, D, A, S, _Component32, _Component6, _Component1, R, O, I, _Component7, _Component3 } from './shared.js';
import * as W from 'react';
export default function $n({
  open: e,
  app: n,
  onClose: r
}) {
  let i = W.useMemo(() => {
    return `${Je.replace(/[\s`]/g, ``).replace(/\/$/, ``)}`;
  }, []);
  let a = n?.visibility === `public`;
  let o = n?.status === `offline`;
  let [c, l] = W.useState(``);
  let [u, d] = W.useState(false);
  let [f, p] = W.useState(``);
  let [m, g] = W.useState(30);
  let [_, y] = W.useState(``);
  let [b, x] = W.useState(``);
  let [S, C] = W.useState([]);
  let [w, T] = W.useState(false);
  let E = n ? `${i}/apps/${encodeURIComponent(n.appId)}` : ``;
  let D = b ? `${E}?licenseToken=${encodeURIComponent(b)}` : E;
  let k = W.useCallback(async () => {
    if (!!n && !a) {
      T(true);
      try {
        let e = (await ut(`/workflow-apps/licenses/mine`)).data;
        let t = Array.isArray(e) ? e : e?.data;
        C((Array.isArray(t) ? t : []).filter(e => {
          return e.appId === n.appId;
        }));
      } catch {} finally {
        T(false);
      }
    }
  }, [n, a]);
  W.useEffect(() => {
    if (e) {
      l(``);
      p(``);
      x(``);
      y(``);
      g(30);
      k();
    }
  }, [e, k]);
  let A = W.useCallback(async (e, t) => {
    try {
      await navigator.clipboard.writeText(e);
      l(t);
      window.setTimeout(() => {
        return l(``);
      }, 2000);
    } catch {
      p(`复制失败，请手动选择复制`);
    }
  }, []);
  let j = W.useCallback(async () => {
    if (n) {
      d(true);
      p(``);
      x(``);
      try {
        let e = await Ge(`/workflow-apps/${encodeURIComponent(n.appId)}/licenses`, {
          durationDays: Math.max(1, Number(m) || 30),
          note: _.trim() || undefined
        });
        if (!e.success) {
          throw Error(e.error || `创建失败`);
        }
        let t = e.data;
        let r = (t?.data ?? t)?.token || ``;
        if (!r) {
          throw Error(t?.error || `未返回许可证 token`);
        }
        x(r);
        k();
      } catch (e) {
        p(e?.message || `创建失败`);
      } finally {
        d(false);
      }
    }
  }, [n, m, _, k]);
  if (!e || !n) {
    return null;
  } else {
    const Component545 = `div`;
    const Component546 = `span`;
    const Component547 = `span`;
    const Component548 = `div`;
    const Component549 = `div`;
    const Component550 = `button`;
    const Component551 = `div`;
    const Component552 = `div`;
    const Component553 = `div`;
    const Component554 = `div`;
    const Component555 = `div`;
    const Component556 = `div`;
    const Component557 = `button`;
    const Component558 = `div`;
    const Component559 = `div`;
    const Component560 = `div`;
    const Component561 = `div`;
    const Component562 = `span`;
    const Component563 = `input`;
    const Component564 = `label`;
    const Component565 = `span`;
    const Component566 = `input`;
    const Component567 = `label`;
    const Component568 = `button`;
    const Component569 = `div`;
    const Component570 = `div`;
    const Component571 = `div`;
    const Component572 = `button`;
    const Component573 = `div`;
    const Component574 = `div`;
    const Component575 = `div`;
    const Component576 = `div`;
    const Component577 = `div`;
    const Component578 = `div`;
    const Component579 = `div`;
    return <Component579 className={`fixed inset-0 z-[210] bg-black/70 flex items-center justify-center p-4`}>
        <Component578 className={`w-full max-w-2xl max-h-[88vh] overflow-hidden rounded-2xl border border-[#333] bg-[#111] shadow-2xl flex flex-col`}>
          <Component551 className={`flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a] bg-[#151414]`}>
            <Component549>
              <Component545 className={`text-white font-bold text-lg flex items-center gap-2`}>
                <_Component32 size={18} />
                {` 分享应用`}
              </Component545>
              <Component548 className={`text-xs text-gray-400 mt-1 flex items-center gap-2`}>
                <Component546 className={`text-white truncate max-w-[220px]`}>
                  {n.appName || n.appId}
                </Component546>
                <Component547 className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${a ? `bg-emerald-500/15 text-emerald-300` : `bg-amber-500/15 text-amber-300`}`}>
                  {a ? <_Component6 size={10} /> : <_Component1 size={10} />}
                  {a ? `公开` : `私有`}
                </Component547>
              </Component548>
            </Component549>
            <Component550 onClick={r} className={`text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/5`}>
              <R size={18} />
            </Component550>
          </Component551>
          <Component577 className={`flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar`}>
            {f && <Component552 className={`rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300`}>
                {f}
              </Component552>}
            {o && <Component553 className={`rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300`}>{`应用当前已下架，分享链接暂时无法访问。请先在项目菜单中「重新上架」。`}</Component553>}
            <Component559 className={`rounded-2xl border border-[#2a2a2a] bg-[#161616] p-4 space-y-2`}>
              <Component554 className={`text-sm font-bold text-white`}>{`应用访问链接`}</Component554>
              <Component555 className={`text-xs text-gray-500`}>
                {a ? `公开应用，任何人打开链接即可运行。` : `私有应用，需附带许可证 token 才能访问。下方可生成带 token 的完整链接。`}
              </Component555>
              <Component558 className={`flex items-center justify-between gap-2 rounded-lg bg-[#101010] border border-[#252525] px-3 py-2`}>
                <Component556 className={`text-sm text-white font-mono truncate`}>{D}</Component556>
                <Component557 onClick={() => {
                return A(D, `link`);
              }} className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#333] text-gray-300 hover:text-white hover:bg-white/5 text-xs`}>
                  {c === `link` ? <O size={12} className={`text-emerald-400`} /> : <I size={12} />}
                  {c === `link` ? `已复制` : `复制链接`}
                </Component557>
              </Component558>
            </Component559>
            {!a && <Component576 className={`rounded-2xl border border-[#2a2a2a] bg-[#161616] p-4 space-y-3`}>
                <Component560 className={`text-sm font-bold text-white flex items-center gap-2`}>
                  <_Component7 size={15} />
                  {` 生成带许可证的分享链接`}
                </Component560>
                <Component561 className={`text-xs text-gray-500`}>{`每次生成会创建一个新许可证，token 仅在此展示一次，请及时复制完整链接。`}</Component561>
                <Component569 className={`grid grid-cols-1 md:grid-cols-[0.8fr_1.4fr_auto] gap-3 items-end`}>
                  <Component564 className={`block`}>
                    <Component562 className={`text-xs text-gray-500`}>{`有效期(天)`}</Component562>
                    <Component563 type={`number`} min={1} value={m} onChange={e => {
                  return g(Number(e.target.value));
                }} className={`mt-1 w-full rounded-lg border border-[#333] bg-[#101010] px-3 py-2 text-sm text-white outline-none focus:border-blue-500`} />
                  </Component564>
                  <Component567 className={`block`}>
                    <Component565 className={`text-xs text-gray-500`}>{`备注(可选)`}</Component565>
                    <Component566 value={_} onChange={e => {
                  return y(e.target.value);
                }} placeholder={`发放对象 / 用途`} className={`mt-1 w-full rounded-lg border border-[#333] bg-[#101010] px-3 py-2 text-sm text-white outline-none focus:border-blue-500`} />
                  </Component567>
                  <Component568 onClick={j} disabled={u || o} className={`h-[38px] px-4 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50 flex items-center gap-2 justify-center`}>
                    {u ? <_Component3 size={14} className={`animate-spin`} /> : <_Component7 size={14} />}
                    {`生成`}
                  </Component568>
                </Component569>
                {b && <Component574 className={`rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 space-y-2`}>
                    <Component570 className={`text-xs text-emerald-300 flex items-center gap-2`}>
                      <O size={13} />
                      {` 已生成带 token 的完整分享链接，请立即复制（token 只显示这一次）`}
                    </Component570>
                    <Component573 className={`flex items-center justify-between gap-2 rounded-lg bg-[#101010] border border-[#252525] px-3 py-2`}>
                      <Component571 className={`text-sm text-white font-mono truncate`}>
                        {D}
                      </Component571>
                      <Component572 onClick={() => {
                  return A(D, `tokenlink`);
                }} className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#333] text-gray-300 hover:text-white hover:bg-white/5 text-xs`}>
                        {c === `tokenlink` ? <O size={12} className={`text-emerald-400`} /> : <I size={12} />}
                        {c === `tokenlink` ? `已复制` : `复制`}
                      </Component572>
                    </Component573>
                  </Component574>}
                <Component575 className={`text-[11px] text-gray-500`}>
                  {w ? `正在读取已有许可证…` : `该应用已有 ${S.length} 个许可证（可在「许可证管理」中查看掩码与状态）。`}
                </Component575>
              </Component576>}
          </Component577>
        </Component578>
      </Component579>;
  }
}