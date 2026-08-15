// TODO(全局, 无需 import): open, onClose, onUse, onToast, defaultCategory, i, r, p, category, v, tagId, g, keyword, b, m, u, n, f, ok, error, key, label, o, x, s, k
import { ro, T, y, Za, c, $a, eo, h, a, C, Qa, d, co, t, O, D, no, to, lo, Fn, w, oo, _, S, Ya, A, j, _Component14, Ae, Gt, _Component15, Se } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
export default function _Component16({
  open: e,
  onClose: t,
  onUse: n,
  onToast: r,
  defaultCategory: i = ``
}) {
  let [a, o] = Z.useState(`square`);
  let [s, c] = Z.useState([]);
  let [u, d] = Z.useState([]);
  let [f, p] = Z.useState(new Set());
  let [m, h] = Z.useState([]);
  let [g, _] = Z.useState(``);
  let [v, y] = Z.useState(i);
  let [b, x] = Z.useState(``);
  let [S, C] = Z.useState(false);
  let [w, T] = Z.useState(``);
  let E = ro();
  let D = e => {
    r?.(e);
    T(e);
    window.setTimeout(() => {
      return T(``);
    }, 2000);
  };
  Z.useEffect(() => {
    if (e) {
      y(i);
    }
  }, [e, i]);
  Z.useEffect(() => {
    if (e) {
      Za().then(c).catch(() => {});
      $a().then(e => {
        return p(new Set(e));
      }).catch(() => {});
      eo().then(h).catch(() => {});
    }
  }, [e]);
  Z.useEffect(() => {
    if (!!e && a === `square`) {
      C(true);
      Qa({
        category: v,
        tagId: g,
        keyword: b
      }).then(d).catch(() => {
        return d([]);
      }).finally(() => {
        return C(false);
      });
    }
  }, [e, a, v, g, b]);
  let O = Z.useMemo(() => {
    if (a === `favorites`) {
      return m;
    }
    if (a === `recent`) {
      let e = co();
      let t = [...u, ...m];
      let n = new Map(t.map(e => {
        return [e.id, e];
      }));
      return e.map(e => {
        return n.get(e);
      }).filter(e => {
        return !!e;
      });
    }
    return u;
  }, [a, u, m]);
  let k = Z.useMemo(() => {
    let e = O;
    if (a !== `square`) {
      if (v) {
        e = e.filter(e => {
          return e.category === v;
        });
      }
      if (g) {
        e = e.filter(e => {
          return e.tags.some(e => {
            return e.id === g;
          });
        });
      }
    }
    if (!b.trim() || a === `square`) {
      return e;
    }
    let t = b.trim().toLowerCase();
    return e.filter(e => {
      return e.title.toLowerCase().includes(t) || e.content.toLowerCase().includes(t) || (e.description || ``).toLowerCase().includes(t);
    });
  }, [O, b, a, v, g]);
  let A = async e => {
    if (!E) {
      D(`请先登录后再收藏`);
      return;
    }
    let t = f.has(e.id);
    let n = new Set(f);
    if (t) {
      n.delete(e.id);
      p(n);
      h(t => {
        return t.filter(t => {
          return t.id !== e.id;
        });
      });
      if (!(await no(e.id))) {
        D(`取消收藏失败`);
        $a().then(e => {
          return p(new Set(e));
        });
      }
    } else {
      n.add(e.id);
      p(n);
      h(t => {
        if (t.some(t => {
          return t.id === e.id;
        })) {
          return t;
        } else {
          return [e, ...t];
        }
      });
      let {
        ok: t,
        error: r
      } = await to(e.id);
      if (t) {
        D(`已收藏`);
      } else {
        n.delete(e.id);
        p(new Set(n));
        h(t => {
          return t.filter(t => {
            return t.id !== e.id;
          });
        });
        D(r || `收藏失败`);
      }
    }
  };
  let j = e => {
    lo(e.id);
    n(e);
    t();
  };
  if (e) {
    const Component187 = `div`;
    const Component188 = `span`;
    const Component189 = `div`;
    const Component190 = `button`;
    const Component191 = `div`;
    const Component192 = `input`;
    const Component193 = `div`;
    const Component194 = `button`;
    const Component195 = `div`;
    const Component196 = `div`;
    const Component197 = `button`;
    const Component198 = `div`;
    const Component199 = `button`;
    const Component200 = `button`;
    const Component201 = `div`;
    const Component202 = `div`;
    const Component203 = `div`;
    const Component216 = `div`;
    const Component217 = `div`;
    const Component218 = `div`;
    const Component219 = `div`;
    return Fn.createPortal(<Component219 className={`fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 nowheel nopan nodrag`} onClick={t}>
        <Component218 className={`relative w-[78vw] h-[82vh] max-w-[1600px] bg-[#141414] border border-[#2a2a2a] rounded-2xl shadow-2xl flex flex-col overflow-hidden`} onClick={e => {
        return e.stopPropagation();
      }}>
          {w && <Component187 className={`absolute top-4 left-1/2 -translate-x-1/2 z-[1100] px-4 py-2 rounded-lg bg-[#2a2a2a] border border-[#3a3a3a] text-sm text-white shadow-2xl`}>
              {w}
            </Component187>}
          <Component196 className={`shrink-0 flex items-center gap-4 px-5 h-14 border-b border-[#222]`}>
            <Component189 className={`flex items-center gap-2 pr-3 mr-1 border-r border-[#2a2a2a]`}>
              <_Component14 className={`w-5 h-5 text-white`} />
              <Component188 className={`text-base font-semibold text-white whitespace-nowrap`}>{`提示词库`}</Component188>
            </Component189>
            <Component191 className={`flex items-center gap-1`}>
              {[{
              key: `square`,
              label: `提示词广场`
            }, {
              key: `favorites`,
              label: `我的收藏`
            }, {
              key: `recent`,
              label: `最近使用`
            }].map(e => {
              return <Component190 onClick={() => {
                return o(e.key);
              }} className={`px-3.5 py-1.5 text-sm rounded-lg transition-colors ${a === e.key ? `bg-[#2a2a2a] text-white font-medium` : `text-gray-400 hover:text-gray-200`}`} key={e.key}>
                    {e.label}
                  </Component190>;
            })}
            </Component191>
            <Component193 className={`relative flex-1 max-w-md`}>
              <Ae className={`absolute left-1 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500`} />
              <Component192 value={b} onChange={e => {
              return x(e.target.value);
            }} placeholder={`搜索标题、标签、提示词内容`} className={`w-full pl-7 pr-3 py-1.5 text-sm bg-transparent border-0 border-b border-[#333] rounded-none text-gray-200 placeholder:text-gray-600 focus:border-gray-400 outline-none`} />
            </Component193>
            <Component195 className={`ml-auto flex items-center gap-3`}>
              <Component194 onClick={t} className={`p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a] rounded-lg`}>
                <Gt size={18} />
              </Component194>
            </Component195>
          </Component196>
          <Component198 className={`shrink-0 flex items-center gap-2 px-5 pt-3 pb-1`}>
            {oo.map(e => {
            return <Component197 onClick={() => {
              return y(e.value);
            }} className={`px-4 py-1.5 text-[13px] rounded-lg transition-colors ${v === e.value ? `bg-white text-[#141414] font-medium` : `bg-[#1f1f1f] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} key={e.value}>
                  {e.label}
                </Component197>;
          })}
          </Component198>
          <Component201 className={`shrink-0 flex items-center gap-1.5 px-5 h-11 overflow-x-auto custom-scrollbar`}>
            <Component199 onClick={() => {
            return _(``);
          }} className={`shrink-0 px-3 py-1.5 text-[13px] rounded-md transition-colors ${g === `` ? `text-white font-medium border-b-2 border-red-500 rounded-none` : `text-gray-400 hover:text-gray-200`}`}>{`推荐`}</Component199>
            {s.map(e => {
            return <Component200 onClick={() => {
              return _(e.id);
            }} className={`shrink-0 px-3 py-1.5 text-[13px] rounded-md transition-colors ${g === e.id ? `text-white font-medium border-b-2 border-red-500 rounded-none` : `text-gray-400 hover:text-gray-200`}`} key={e.id}>
                  {e.name}
                </Component200>;
          })}
          </Component201>
          <Component217 className={`flex-1 overflow-y-auto custom-scrollbar p-5`}>
            {S ? <Component202 className={`h-full flex items-center justify-center text-sm text-gray-500`}>{`加载中…`}</Component202> : k.length === 0 ? <Component203 className={`h-full flex items-center justify-center text-sm text-gray-500`}>
                {a === `favorites` ? `还没有收藏的提示词` : a === `recent` ? `还没有使用记录` : `暂无提示词`}
              </Component203> : <Component216 className={`grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3`}>
                {k.map(e => {
              let t = f.has(e.id);
              const Component204 = `img`;
              const Component205 = `div`;
              const Component206 = `div`;
              const Component207 = `button`;
              const Component208 = `h3`;
              const Component209 = `span`;
              const Component210 = `div`;
              const Component211 = `div`;
              const Component212 = `span`;
              const Component213 = `button`;
              const Component214 = `div`;
              const Component215 = `div`;
              return <Component215 className={`group relative rounded-xl overflow-hidden bg-[#1a1a1a] border border-transparent hover:border-white/30 transition-all`} key={e.id}>
                      <Component214 className={`relative aspect-[3/4] bg-[#0d0c0c] overflow-hidden`}>
                        {e.coverUrl ? <Component204 src={Ya(e.coverUrl)} alt={e.title} className={`w-full h-full object-cover`} /> : <Component205 className={`w-full h-full flex items-center justify-center text-gray-700 text-3xl`}>{`✨`}</Component205>}
                        <Component206 className={`absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 to-transparent`} />
                        <Component207 onClick={t => {
                    t.stopPropagation();
                    A(e);
                  }} className={`absolute top-2 right-2 z-20 p-1.5 rounded-full backdrop-blur-sm transition-all ${t ? `bg-red-500/90 text-white opacity-100` : `bg-black/50 text-white/90 opacity-0 group-hover:opacity-100 hover:bg-black/70`}`} title={t ? `取消收藏` : `收藏`}>
                          <_Component15 size={14} fill={t ? `currentColor` : `none`} />
                        </Component207>
                        <Component211 className={`absolute bottom-0 inset-x-0 p-2.5`}>
                          <Component208 className={`text-[13px] font-semibold text-white truncate drop-shadow`} title={e.title}>
                            {e.title}
                          </Component208>
                          <Component210 className={`mt-1 flex items-center gap-1.5`}>
                            {e.tags.slice(0, 1).map(e => {
                        return <Component209 className={`px-1.5 py-0.5 text-[10px] rounded bg-white/15 text-white/90 backdrop-blur-sm`} key={e.id}>
                                  {e.name}
                                </Component209>;
                      })}
                          </Component210>
                        </Component211>
                        <Component213 onClick={() => {
                    return j(e);
                  }} className={`absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity`}>
                          <Component212 className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-white text-[#141414] rounded-lg shadow-lg`}>
                            <Se size={15} />
                            {` 使用`}
                          </Component212>
                        </Component213>
                      </Component214>
                    </Component215>;
            })}
              </Component216>}
          </Component217>
        </Component218>
      </Component219>, document.body);
  } else {
    return null;
  }
}