// TODO(全局, 无需 import): t, n, c, s, i, o, f, u, l, d, p, m
import _cmp__Component19 from './_Component19.jsx';
import _cmp__Component20 from './_Component20.jsx';
import { Se, Me, De, r, e, dn, a, ve, be, xe, _Component9, M } from './shared.js';
import * as G from 'react';
var _Component24 = () => {
  let [e, t] = G.useState(() => {
    return Se();
  });
  let [n, r] = G.useState(0);
  let [i, a] = G.useState(`list`);
  let [o, s] = G.useState(null);
  G.useEffect(() => {
    return Me(t);
  }, []);
  G.useEffect(() => {
    return De(() => {
      return r(e => {
        return e + 1;
      });
    });
  }, []);
  let c = G.useMemo(() => {
    return dn();
  }, [n]);
  let l = G.useMemo(() => {
    let e = new Map();
    c.forEach(t => {
      return e.set(t.name, t);
    });
    return e;
  }, [c]);
  let u = () => {
    s(null);
    a(`edit`);
  };
  let d = e => {
    s(e);
    a(`edit`);
  };
  let f = e => {
    t(ve(e));
    a(`list`);
    s(null);
  };
  let p = e => {
    if (window.confirm(`确定删除调度「${e.name}」吗？`)) {
      t(be(e.id));
    }
  };
  let m = e => {
    t(xe(e.id, !e.enabled));
  };
  if (i === `edit`) {
    return <_cmp__Component19 catalog={c} initial={o} onCancel={() => {
      a(`list`);
      s(null);
    }} onSave={f} />;
  } else {
    const Component267 = `span`;
    const Component268 = `span`;
    const Component269 = `button`;
    const Component270 = `div`;
    const Component271 = `div`;
    const Component272 = `div`;
    const Component273 = `button`;
    const Component274 = `div`;
    const Component275 = `div`;
    const Component276 = `div`;
    return <Component276 className={`space-y-4 animate-fade-in`}>
        <Component270 className={`flex items-center gap-2 pb-3 border-b border-[#222]`}>
          <Component267 className={`text-[17px] font-bold text-white tracking-tight`}>{`模型调度`}</Component267>
          <Component268 className={`text-[13px] text-white/45`}>
            {e.length}
            {` 组`}
          </Component268>
          <Component269 type={`button`} onClick={u} className={`ml-auto inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13.5px] font-semibold bg-white text-slate-900 hover:bg-white/90 transition-all`}>
            <_Component9 className={`w-4 h-4`} strokeWidth={2.5} />
            {` 新建调度`}
          </Component269>
        </Component270>
        {e.length === 0 ? <Component274 className={`rounded-xl bg-white/[0.03] px-4 py-12 flex flex-col items-center gap-3 text-center`}>
            <M className={`w-9 h-9 text-white/30`} strokeWidth={1.5} />
            <Component271 className={`text-[13.5px] text-white/55`}>{`还没有调度组`}</Component271>
            <Component272 className={`text-[12px] text-white/35 max-w-[320px] leading-relaxed`}>{`把多个模型按顺序编排成一组，生成失败时自动按序重试下一个，避开高峰期的不稳定。`}</Component272>
            <Component273 type={`button`} onClick={u} className={`mt-1 inline-flex items-center gap-1.5 h-8 px-4 rounded-lg text-[13px] text-white/80 bg-white/[0.06] hover:bg-white/[0.12] hover:text-white transition-all`}>
              <_Component9 className={`w-3.5 h-3.5`} />
              {` 新建第一个调度`}
            </Component273>
          </Component274> : <Component275 className={`space-y-2.5`}>
            {e.map(e => {
          return <_cmp__Component20 schedule={e} powerOf={l} onEdit={() => {
            return d(e);
          }} onDelete={() => {
            return p(e);
          }} onToggle={() => {
            return m(e);
          }} key={e.id} />;
        })}
          </Component275>}
      </Component276>;
  }
};
export default _Component24;