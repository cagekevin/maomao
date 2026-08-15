// TODO(全局, 无需 import): s, o, n, f, t, p, key, label, i, items, l, d, c, u, m, v
import _cmp_vn from './vn.jsx';
import { gt, e, Sn, bn, r, Te, at, Ct, a, g, _, _n, yn, xn, _Component3, _Component23, _Component9, I, _Component13, M } from './shared.js';
import * as W from 'react';
var Cn = () => {
  let [e, t] = W.useState(`all`);
  let [n, r] = W.useState(``);
  let [i, a] = W.useState(null);
  let [o, s] = W.useState(0);
  let [c, l] = W.useState(false);
  let [u, d] = W.useState(``);
  W.useEffect(() => {
    return gt(() => {
      return s(e => {
        return e + 1;
      });
    });
  }, []);
  let f = W.useMemo(() => {
    return Sn();
  }, [o]);
  let p = W.useMemo(() => {
    let t = n.trim().toLowerCase();
    return f.filter(n => {
      if (e !== `all`) {
        if (e === `discount`) {
          if (n.displayCategory !== `discount` && n.displayCategory !== `video`) {
            return false;
          }
        } else if (n.displayCategory !== e) {
          return false;
        }
      }
      return !t || !!`${n.name} ${n.description}`.toLowerCase().includes(t);
    });
  }, [f, e, n]);
  let m = W.useMemo(() => {
    let e = new Map();
    for (let t of p) {
      let {
        key: n,
        label: r
      } = bn(t.name);
      let i = e.get(n);
      if (i) {
        i.items.push(t);
      } else {
        e.set(n, {
          key: n,
          label: r,
          items: [t]
        });
      }
    }
    return Array.from(e.values()).sort((e, t) => {
      return t.items.length - e.items.length;
    });
  }, [p]);
  let g = W.useMemo(() => {
    let e = Te();
    if (e) {
      return `上次同步 ${new Date(e).toLocaleTimeString()}`;
    } else {
      return `尚未同步`;
    }
  }, [o]);
  let _ = async () => {
    if (!c) {
      l(true);
      d(``);
      try {
        if (!(await at(Ct(``), true))) {
          d(`刷新失败，请检查网络或服务端配置`);
        }
      } catch (e) {
        d(e instanceof Error ? e.message : `刷新失败`);
      } finally {
        l(false);
      }
    }
  };
  let v = async (e, t) => {
    try {
      await navigator.clipboard.writeText(e);
      a(t);
      setTimeout(() => {
        return a(null);
      }, 1500);
    } catch {}
  };
  const Component294 = `span`;
  const Component295 = `span`;
  const Component296 = `span`;
  const Component297 = `div`;
  const Component298 = `button`;
  const Component300 = `div`;
  const Component301 = `div`;
  const Component302 = `div`;
  const Component303 = `input`;
  const Component304 = `div`;
  const Component305 = `div`;
  const Component306 = `div`;
  const Component307 = `div`;
  const Component308 = `div`;
  const Component309 = `div`;
  const Component310 = `div`;
  const Component311 = `span`;
  const Component312 = `span`;
  const Component313 = `span`;
  const Component314 = `button`;
  const Component315 = `div`;
  const Component316 = `div`;
  const Component317 = `div`;
  const Component318 = `span`;
  const Component319 = `div`;
  const Component320 = `div`;
  const Component321 = `div`;
  const Component322 = `div`;
  const Component323 = `div`;
  const Component324 = `div`;
  return <Component324 className={`space-y-4 animate-fade-in`}>
      <Component301 className={`flex items-center gap-2 flex-wrap pb-3 border-b border-[#222]`}>
        <Component297 className={`flex items-center gap-2 shrink-0`}>
          <Component294 className={`text-[17px] font-bold text-white tracking-tight`}>{`内置模型`}</Component294>
          <Component295 className={`text-[13px] text-white/45`}>
            {p.length}
            {` 个`}
          </Component295>
          <Component296 className={`text-[11.5px] text-white/35`}>{g}</Component296>
        </Component297>
        <Component300 className={`flex flex-wrap gap-1 ml-auto`}>
          <Component298 type={`button`} onClick={_} disabled={c} className={_n(`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13.5px] transition-all`, c ? `bg-white/[0.04] text-white/35 cursor-not-allowed` : `bg-blue-500/15 text-blue-200 hover:bg-blue-500/25 hover:text-white`)} title={`从服务器重新拉取最新内置模型`}>
            <_Component3 className={_n(`w-3.5 h-3.5`, c && `animate-spin`)} />
            {c ? `刷新中` : `刷新`}
          </Component298>
          {[`all`, `text`, `image`, `discount`].map(n => {
          let r = e === n;
          let i = n === `all` ? `全部` : yn[n].label;
          const Component299 = `button`;
          return <Component299 type={`button`} onClick={() => {
            return t(n);
          }} className={_n(`inline-flex items-center justify-center min-w-[44px] h-8 px-3 rounded-lg text-[13.5px] transition-all`, r ? `bg-white text-slate-900 font-semibold shadow-sm` : `bg-white/[0.06] text-white/70 hover:bg-white/[0.12] hover:text-white`)} title={n === `all` ? `全部` : yn[n].label} key={n}>
                {i}
              </Component299>;
        })}
        </Component300>
      </Component301>
      {u && <Component302 className={`rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-[12px] text-red-200`}>
          {u}
        </Component302>}
      <Component304 className={`relative`}>
        <_Component23 className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/45`} />
        <Component303 value={n} onChange={e => {
        return r(e.target.value);
      }} placeholder={`搜索模型名`} className={`w-full rounded-xl bg-white/[0.05] pl-9 pr-3 py-2 text-[14.5px] text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:bg-white/[0.08] transition-all`} />
      </Component304>
      {m.length === 0 ? <Component305 className={`rounded-xl bg-white/[0.03] px-3 py-8 text-center text-[12px] text-white/55`}>
          {o === 0 ? `正在加载内置模型…` : `没有匹配的模型`}
        </Component305> : <Component323 className={`space-y-3`}>
          {m.map(e => {
        return <Component322 className={`grid grid-cols-[165px_1fr] rounded-xl bg-white/[0.03] hover:bg-white/[0.05] transition-colors overflow-hidden`} key={e.key}>
                <Component310 className={_n(`relative overflow-hidden flex flex-col justify-end p-3 min-h-[100px]`, xn(e.key))}>
                  <Component306 className={`absolute inset-0 bg-gradient-to-tr from-black/45 via-transparent to-white/10 pointer-events-none`} />
                  <Component309 className={`relative z-10`}>
                    <Component307 className={`text-[14.5px] font-bold text-white drop-shadow-md tracking-tight truncate`}>
                      {e.label}
                    </Component307>
                    <Component308 className={`mt-0.5 text-[12px] text-white/85 drop-shadow`}>
                      {e.items.length}
                      {` 个模型`}
                    </Component308>
                  </Component309>
                </Component310>
                <Component321 className={`py-1`}>
                  {e.items.map(e => {
              return <Component320 className={`group/row flex items-center gap-2 px-3 py-2 rounded-lg mx-1 my-0.5 odd:bg-white/[0.02] hover:bg-white/[0.06] transition-colors`} key={e.id}>
                        {e.recommended && <Component311 className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-400/15 text-amber-200 text-[11.5px] ring-1 ring-amber-300/25`}>{`推荐`}</Component311>}
                        {e.access && _cmp_vn(e.access, e.accessReason)}
                        <Component317 className={`flex-1 min-w-0 flex flex-col gap-0.5`}>
                          <Component315 className={`flex items-center gap-1.5 min-w-0`}>
                            <Component312 className={_n(`text-[12px] leading-none shrink-0`, yn[e.displayCategory].tone)} title={yn[e.displayCategory].label}>
                              {yn[e.displayCategory].short}
                            </Component312>
                            <Component313 className={`truncate text-[14.5px] text-white font-medium`} title={e.name}>
                              {e.name}
                            </Component313>
                            <Component314 type={`button`} onClick={() => {
                      return v(e.name, e.id);
                    }} className={`shrink-0 p-0.5 rounded text-white/35 opacity-0 group-hover/row:opacity-100 hover:text-white hover:bg-white/10 transition`} title={`复制模型名`}>
                              {i === e.id ? <_Component9 className={`w-3.5 h-3.5 text-emerald-300`} /> : <I className={`w-3.5 h-3.5`} />}
                            </Component314>
                          </Component315>
                          {e.description && <Component316 className={`text-[12.5px] text-white/55 truncate`} title={e.description}>
                              {e.description}
                            </Component316>}
                        </Component317>
                        {e.power !== null && <Component319 className={_n(`shrink-0 inline-flex items-center gap-0.5 text-[12.5px] tabular-nums`, e.currency === `proxy` ? `text-yellow-300` : `text-orange-400`)}>
                            {e.currency === `proxy` ? <_Component13 className={`w-4 h-4`} /> : <M className={`w-3.5 h-3.5`} strokeWidth={2.5} />}
                            <Component318>
                              {e.power}
                              {e.unit ? `/${e.unit}` : ``}
                            </Component318>
                          </Component319>}
                      </Component320>;
            })}
                </Component321>
              </Component322>;
      })}
        </Component323>}
    </Component324>;
};
export default Cn;