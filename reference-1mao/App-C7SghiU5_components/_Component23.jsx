// TODO(全局, 无需 import): s, o, n, f, t, p, key, label, i, items, l, d, c, u, m, v
import _cmp_yn from './yn.jsx';
import { De, e, Cn, xn, r, Ee, Ae, ht, a, g, _, vn, bn, Sn, _Component4, _Component22, _Component0, F, _Component13, _Component14 } from './shared.js';
import * as G from 'react';
var _Component23 = () => {
  let [e, t] = G.useState(`all`);
  let [n, r] = G.useState(``);
  let [i, a] = G.useState(null);
  let [o, s] = G.useState(0);
  let [c, l] = G.useState(false);
  let [u, d] = G.useState(``);
  G.useEffect(() => {
    return De(() => {
      return s(e => {
        return e + 1;
      });
    });
  }, []);
  let f = G.useMemo(() => {
    return Cn();
  }, [o]);
  let p = G.useMemo(() => {
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
  let m = G.useMemo(() => {
    let e = new Map();
    for (let t of p) {
      let {
        key: n,
        label: r
      } = xn(t.name);
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
  let g = G.useMemo(() => {
    let e = Ee();
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
        if (!(await Ae(ht(``), true))) {
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
  const Component296 = `span`;
  const Component297 = `span`;
  const Component298 = `span`;
  const Component299 = `div`;
  const Component300 = `button`;
  const Component302 = `div`;
  const Component303 = `div`;
  const Component304 = `div`;
  const Component305 = `input`;
  const Component306 = `div`;
  const Component307 = `div`;
  const Component308 = `div`;
  const Component309 = `div`;
  const Component310 = `div`;
  const Component311 = `div`;
  const Component312 = `div`;
  const Component313 = `span`;
  const Component314 = `span`;
  const Component315 = `span`;
  const Component316 = `button`;
  const Component317 = `div`;
  const Component318 = `div`;
  const Component319 = `div`;
  const Component320 = `span`;
  const Component321 = `div`;
  const Component322 = `div`;
  const Component323 = `div`;
  const Component324 = `div`;
  const Component325 = `div`;
  const Component326 = `div`;
  return <Component326 className={`space-y-4 animate-fade-in`}>
      <Component303 className={`flex items-center gap-2 flex-wrap pb-3 border-b border-[#222]`}>
        <Component299 className={`flex items-center gap-2 shrink-0`}>
          <Component296 className={`text-[17px] font-bold text-white tracking-tight`}>{`内置模型`}</Component296>
          <Component297 className={`text-[13px] text-white/45`}>
            {p.length}
            {` 个`}
          </Component297>
          <Component298 className={`text-[11.5px] text-white/35`}>{g}</Component298>
        </Component299>
        <Component302 className={`flex flex-wrap gap-1 ml-auto`}>
          <Component300 type={`button`} onClick={_} disabled={c} className={vn(`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13.5px] transition-all`, c ? `bg-white/[0.04] text-white/35 cursor-not-allowed` : `bg-blue-500/15 text-blue-200 hover:bg-blue-500/25 hover:text-white`)} title={`从服务器重新拉取最新内置模型`}>
            <_Component4 className={vn(`w-3.5 h-3.5`, c && `animate-spin`)} />
            {c ? `刷新中` : `刷新`}
          </Component300>
          {[`all`, `text`, `image`, `discount`].map(n => {
          let r = e === n;
          let i = n === `all` ? `全部` : bn[n].label;
          const Component301 = `button`;
          return <Component301 type={`button`} onClick={() => {
            return t(n);
          }} className={vn(`inline-flex items-center justify-center min-w-[44px] h-8 px-3 rounded-lg text-[13.5px] transition-all`, r ? `bg-white text-slate-900 font-semibold shadow-sm` : `bg-white/[0.06] text-white/70 hover:bg-white/[0.12] hover:text-white`)} title={n === `all` ? `全部` : bn[n].label} key={n}>
                {i}
              </Component301>;
        })}
        </Component302>
      </Component303>
      {u && <Component304 className={`rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-[12px] text-red-200`}>
          {u}
        </Component304>}
      <Component306 className={`relative`}>
        <_Component22 className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/45`} />
        <Component305 value={n} onChange={e => {
        return r(e.target.value);
      }} placeholder={`搜索模型名`} className={`w-full rounded-xl bg-white/[0.05] pl-9 pr-3 py-2 text-[14.5px] text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:bg-white/[0.08] transition-all`} />
      </Component306>
      {m.length === 0 ? <Component307 className={`rounded-xl bg-white/[0.03] px-3 py-8 text-center text-[12px] text-white/55`}>
          {o === 0 ? `正在加载内置模型…` : `没有匹配的模型`}
        </Component307> : <Component325 className={`space-y-3`}>
          {m.map(e => {
        return <Component324 className={`grid grid-cols-[165px_1fr] rounded-xl bg-white/[0.03] hover:bg-white/[0.05] transition-colors overflow-hidden`} key={e.key}>
                <Component312 className={vn(`relative overflow-hidden flex flex-col justify-end p-3 min-h-[100px]`, Sn(e.key))}>
                  <Component308 className={`absolute inset-0 bg-gradient-to-tr from-black/45 via-transparent to-white/10 pointer-events-none`} />
                  <Component311 className={`relative z-10`}>
                    <Component309 className={`text-[14.5px] font-bold text-white drop-shadow-md tracking-tight truncate`}>
                      {e.label}
                    </Component309>
                    <Component310 className={`mt-0.5 text-[12px] text-white/85 drop-shadow`}>
                      {e.items.length}
                      {` 个模型`}
                    </Component310>
                  </Component311>
                </Component312>
                <Component323 className={`py-1`}>
                  {e.items.map(e => {
              return <Component322 className={`group/row flex items-center gap-2 px-3 py-2 rounded-lg mx-1 my-0.5 odd:bg-white/[0.02] hover:bg-white/[0.06] transition-colors`} key={e.id}>
                        {e.recommended && <Component313 className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-400/15 text-amber-200 text-[11.5px] ring-1 ring-amber-300/25`}>{`推荐`}</Component313>}
                        {e.access && _cmp_yn(e.access, e.accessReason)}
                        <Component319 className={`flex-1 min-w-0 flex flex-col gap-0.5`}>
                          <Component317 className={`flex items-center gap-1.5 min-w-0`}>
                            <Component314 className={vn(`text-[12px] leading-none shrink-0`, bn[e.displayCategory].tone)} title={bn[e.displayCategory].label}>
                              {bn[e.displayCategory].short}
                            </Component314>
                            <Component315 className={`truncate text-[14.5px] text-white font-medium`} title={e.name}>
                              {e.name}
                            </Component315>
                            <Component316 type={`button`} onClick={() => {
                      return v(e.name, e.id);
                    }} className={`shrink-0 p-0.5 rounded text-white/35 opacity-0 group-hover/row:opacity-100 hover:text-white hover:bg-white/10 transition`} title={`复制模型名`}>
                              {i === e.id ? <_Component0 className={`w-3.5 h-3.5 text-emerald-300`} /> : <F className={`w-3.5 h-3.5`} />}
                            </Component316>
                          </Component317>
                          {e.description && <Component318 className={`text-[12.5px] text-white/55 truncate`} title={e.description}>
                              {e.description}
                            </Component318>}
                        </Component319>
                        {e.power !== null && <Component321 className={vn(`shrink-0 inline-flex items-center gap-0.5 text-[12.5px] tabular-nums`, e.currency === `proxy` ? `text-yellow-300` : `text-orange-400`)}>
                            {e.currency === `proxy` ? <_Component13 className={`w-4 h-4`} /> : <_Component14 className={`w-3.5 h-3.5`} strokeWidth={2.5} />}
                            <Component320>
                              {e.power}
                              {e.unit ? `/${e.unit}` : ``}
                            </Component320>
                          </Component321>}
                      </Component322>;
            })}
                </Component323>
              </Component324>;
      })}
        </Component325>}
    </Component326>;
};
export default _Component23;