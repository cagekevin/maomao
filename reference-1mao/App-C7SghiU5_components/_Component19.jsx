// TODO(全局, 无需 import): catalog, initial, onCancel, onSave, t, o, u, c, s, l, b, model, retries, n, i, id, name, category, enabled, steps, createdAt, updatedAt, y, f, w, v, m, h, p
import _cmp__Component15 from './_Component15.jsx';
import { e, _, ot, r, a, Dt, S, ln, un, pn, g, E, D, T, R, _Component0, _Component9, _Component16, M, C, _Component17, _Component18, P } from './shared.js';
import * as G from 'react';
var _Component19 = ({
  catalog: e,
  initial: t,
  onCancel: n,
  onSave: r
}) => {
  let [i, a] = G.useState(t?.name || ``);
  let [o, s] = G.useState(t?.category || `image`);
  let [c, l] = G.useState(t?.steps ? t.steps.map(e => {
    return {
      ...e
    };
  }) : []);
  let [u, f] = G.useState(``);
  let [p, m] = G.useState(null);
  let [h, g] = G.useState(null);
  let _ = G.useMemo(() => {
    return e.filter(e => {
      return e.category === o;
    });
  }, [e, o]);
  let v = G.useMemo(() => {
    let t = new Map();
    e.forEach(e => {
      return t.set(e.name, e.power);
    });
    return t;
  }, [e]);
  let y = G.useMemo(() => {
    let e = u.trim().toLowerCase();
    if (e) {
      return _.filter(t => {
        return t.name.toLowerCase().includes(e);
      });
    } else {
      return _;
    }
  }, [_, u]);
  let b = ot(c);
  let S = e => {
    if (e !== o) {
      if (!c.length || !!window.confirm(`切换分类会清空已选模型，确定吗？`)) {
        s(e);
        l([]);
      }
    }
  };
  let w = e => {
    if (!(c.length >= 5) && !c.some(t => {
      return t.model === e;
    }) && !(b >= 10)) {
      l(t => {
        return [...t, {
          model: e,
          retries: 1
        }];
      });
    }
  };
  let T = e => {
    return l(t => {
      return t.filter((t, n) => {
        return n !== e;
      });
    });
  };
  let E = (e, t) => {
    l(n => {
      if (e === t || e < 0 || t < 0 || e >= n.length || t >= n.length) {
        return n;
      }
      let r = [...n];
      let [i] = r.splice(e, 1);
      r.splice(t, 0, i);
      return r;
    });
  };
  let D = (e, t) => {
    l(n => {
      let r = n.map(e => {
        return {
          ...e
        };
      });
      let i = r[e];
      let a = i.retries + t;
      if (a < 1 || a > 3 || r.reduce((t, n, r) => {
        if (r === e) {
          return t;
        } else {
          return t + n.retries;
        }
      }, 0) + a > 10) {
        return n;
      } else {
        i.retries = a;
        return r;
      }
    });
  };
  const Component231 = `button`;
  const Component232 = `span`;
  const Component233 = `button`;
  const Component234 = `div`;
  const Component235 = `input`;
  const Component236 = `button`;
  const Component237 = `div`;
  const Component238 = `div`;
  const Component239 = `span`;
  const Component240 = `span`;
  const Component241 = `div`;
  const Component242 = `input`;
  const Component245 = `div`;
  const Component246 = `div`;
  const Component247 = `div`;
  const Component248 = `span`;
  const Component249 = `span`;
  const Component250 = `button`;
  const Component251 = `div`;
  const Component252 = `span`;
  const Component253 = `div`;
  const Component254 = `span`;
  const Component255 = `span`;
  const Component256 = `button`;
  const Component257 = `span`;
  const Component258 = `button`;
  const Component259 = `div`;
  const Component260 = `button`;
  const Component261 = `div`;
  const Component262 = `div`;
  const Component263 = `p`;
  const Component264 = `div`;
  const Component265 = `div`;
  const Component266 = `div`;
  return <Component266 className={`animate-fade-in space-y-4`}>
      <Component234 className={`flex items-center gap-2`}>
        <Component231 type={`button`} onClick={n} className={`inline-flex items-center gap-1 h-8 px-3 rounded-lg text-[13px] text-white/70 bg-white/[0.06] hover:bg-white/[0.12] hover:text-white transition-all`}>
          <R className={`w-3.5 h-3.5`} />
          {` 取消`}
        </Component231>
        <Component232 className={`text-[15px] font-bold text-white`}>
          {t ? `编辑调度` : `新建调度`}
        </Component232>
        <Component233 type={`button`} onClick={() => {
        if (!i.trim()) {
          window.alert(`请填写调度名称`);
          return;
        }
        if (!c.length) {
          window.alert(`请至少选择一个模型`);
          return;
        }
        let e = Date.now();
        r({
          id: t?.id || Dt(),
          name: i.trim(),
          category: o,
          enabled: t?.enabled ?? true,
          steps: c,
          createdAt: t?.createdAt || e,
          updatedAt: e
        });
      }} className={`ml-auto inline-flex items-center gap-1 h-8 px-4 rounded-lg text-[13px] font-semibold bg-white text-slate-900 hover:bg-white/90 transition-all`}>
          <_Component0 className={`w-3.5 h-3.5`} />
          {` 保存`}
        </Component233>
      </Component234>
      <Component238 className={`flex items-center gap-3 flex-wrap`}>
        <Component235 value={i} onChange={e => {
        return a(e.target.value);
      }} placeholder={`调度名称，如「生图高峰备用」`} className={`flex-1 min-w-[180px] rounded-lg bg-white/[0.05] px-3 py-2 text-[14px] text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all`} />
        <Component237 className={`flex items-center gap-1 p-1 rounded-lg bg-white/[0.04]`}>
          {[`text`, `image`, `video`].map(e => {
          return <Component236 type={`button`} onClick={() => {
            return S(e);
          }} className={ln(`h-7 px-3 rounded-md text-[12.5px] transition-all`, o === e ? `bg-white text-slate-900 font-semibold` : `text-white/60 hover:text-white hover:bg-white/[0.06]`)} key={e}>
                {un[e].label}
              </Component236>;
        })}
        </Component237>
      </Component238>
      <Component265 className={`grid grid-cols-2 gap-3`}>
        <Component247 className={`rounded-xl bg-white/[0.03] p-2 flex flex-col min-h-[320px]`}>
          <Component241 className={`px-1 pb-2 flex items-center gap-2`}>
            <Component239 className={`text-[12.5px] text-white/55`}>{`可选模型`}</Component239>
            <Component240 className={`text-[11px] text-white/35`}>{y.length}</Component240>
          </Component241>
          <Component242 value={u} onChange={e => {
          return f(e.target.value);
        }} placeholder={`搜索模型名`} className={`mb-2 rounded-lg bg-white/[0.05] px-3 py-1.5 text-[13px] text-white placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-blue-500/40`} />
          <Component246 className={`flex-1 overflow-y-auto space-y-0.5 pr-0.5`}>
            {y.map(e => {
            let t = c.some(t => {
              return t.model === e.name;
            });
            let n = !t && (c.length >= 5 || b >= 10);
            const Component243 = `span`;
            const Component244 = `button`;
            return <Component244 type={`button`} disabled={t || n} onClick={() => {
              return w(e.name);
            }} className={ln(`group w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors`, t ? `bg-blue-500/15 ring-1 ring-blue-400/25 cursor-default` : n ? `opacity-35 cursor-not-allowed` : `hover:bg-white/[0.06]`)} key={e.name}>
                  <Component243 className={`flex-1 min-w-0 truncate text-[13.5px] text-white`} title={e.name}>
                    {e.name}
                  </Component243>
                  <_cmp__Component15 model={e} />
                  {t ? <_Component0 className={`w-3.5 h-3.5 text-blue-300 shrink-0`} /> : <_Component9 className={`w-3.5 h-3.5 text-white/40 shrink-0 group-hover:text-white`} />}
                </Component244>;
          })}
            {y.length === 0 && <Component245 className={`px-2 py-8 text-center text-[12px] text-white/40`}>{`没有匹配的模型`}</Component245>}
          </Component246>
        </Component247>
        <Component264 className={`rounded-xl bg-white/[0.03] p-2 flex flex-col min-h-[320px]`}>
          <Component251 className={`px-1 pb-2 flex items-center gap-2`}>
            <Component248 className={`text-[12.5px] text-white/55`}>{`调度顺序`}</Component248>
            <Component249 className={ln(`text-[11px]`, b > 10 ? `text-red-400` : `text-white/35`)}>
              {c.length}
              {`/`}
              {5}
              {` 模型 · `}
              {b}
              {`/`}
              {10}
              {` 次`}
            </Component249>
            <Component250 type={`button`} onClick={() => {
            l(e => {
              return [...e].sort((e, t) => {
                return pn(v.get(e.model) ?? null) - pn(v.get(t.model) ?? null);
              });
            });
          }} disabled={c.length < 2} className={`ml-auto inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[12px] text-white/70 bg-white/[0.06] hover:bg-white/[0.12] hover:text-white transition-all disabled:opacity-35 disabled:cursor-not-allowed`} title={`按价格从低到高排序，价格低的优先级最高`}>
              <_Component16 className={`w-3 h-3`} />
              {` 价格排序`}
            </Component250>
          </Component251>
          <Component262 className={`flex-1 overflow-y-auto space-y-1.5 pr-0.5`}>
            {c.length === 0 && <Component253 className={`h-full flex flex-col items-center justify-center gap-2 text-white/35 py-10`}>
                <M className={`w-7 h-7`} strokeWidth={1.5} />
                <Component252 className={`text-[12.5px]`}>{`从左侧选择模型加入调度`}</Component252>
              </Component253>}
            {c.map((e, t) => {
            return <Component261 draggable={true} onDragStart={e => {
              m(t);
              e.dataTransfer.effectAllowed = `move`;
            }} onDragOver={e => {
              e.preventDefault();
              if (h !== t) {
                g(t);
              }
            }} onDrop={e => {
              e.preventDefault();
              if (p !== null) {
                E(p, t);
              }
              m(null);
              g(null);
            }} onDragEnd={() => {
              m(null);
              g(null);
            }} className={ln(`group flex items-center gap-2 px-2.5 py-2.5 rounded-lg transition-all animate-fade-in cursor-grab active:cursor-grabbing`, p === t ? `opacity-40` : `bg-white/[0.04] hover:bg-white/[0.07]`, h === t && p !== null && p !== t ? `ring-1 ring-blue-400/50` : ``)} key={e.model}>
                  <C className={`shrink-0 w-3.5 h-3.5 text-white/25 group-hover:text-white/50`} />
                  <Component254 className={`shrink-0 w-5 h-5 inline-flex items-center justify-center rounded-md bg-white/10 text-white/70 text-[11px] font-semibold tabular-nums`}>
                    {t + 1}
                  </Component254>
                  <Component255 className={`flex-1 min-w-0 truncate text-[13.5px] text-white`} title={e.model}>
                    {e.model}
                  </Component255>
                  <Component259 className={`shrink-0 flex items-center gap-0.5 px-1 py-0.5 rounded-md bg-white/[0.05]`}>
                    <Component256 type={`button`} onClick={() => {
                  return D(t, -1);
                }} disabled={e.retries <= 1} className={`p-0.5 rounded text-white/45 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed`} title={`减少重试`}>
                      <_Component17 className={`w-3.5 h-3.5`} />
                    </Component256>
                    <Component257 className={`text-[11.5px] text-white/80 tabular-nums`} title={`该模型连续尝试次数`}>
                      {e.retries}
                      {`次`}
                    </Component257>
                    <Component258 type={`button`} onClick={() => {
                  return D(t, 1);
                }} disabled={e.retries >= 3} className={`p-0.5 rounded text-white/45 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed`} title={`增加重试`}>
                      <_Component18 className={`w-3.5 h-3.5`} />
                    </Component258>
                  </Component259>
                  <Component260 type={`button`} onClick={() => {
                return T(t);
              }} className={`shrink-0 p-1 rounded text-white/30 hover:text-red-400 hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100`} title={`移除`}>
                    <P className={`w-3.5 h-3.5`} />
                  </Component260>
                </Component261>;
          })}
          </Component262>
          <Component263 className={`px-1 pt-2 text-[11px] text-white/35 leading-relaxed`}>
            {`生成时按顺序逐个尝试，直到成功。同一模型最多重试 `}
            {3}
            {` 次，最多 `}
            {5}
            {` 个模型，总调度不超过 `}
            {10}
            {` 次。`}
          </Component263>
        </Component264>
      </Component265>
    </Component266>;
};
export default _Component19;