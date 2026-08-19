// TODO(全局, 无需 import): open, onClose, onUse, onToast, r, p, i, category, o, keyword, u, isPublic, n, g, m, key, label, s, l, f, v, b, x
import _cmp__Component93 from './_Component93.jsx';
import { e, h, d, Y_, X_, c, _, t, Z_, Q_, ev, Fn, a, tv, S, G_, y, Gt, Ae, _e, _Component94, Ot } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
export default function _Component107({
  open: e,
  onClose: t,
  onUse: n,
  onToast: r
}) {
  let [i, a] = Z.useState(`mine`);
  let [o, s] = Z.useState(``);
  let [c, l] = Z.useState(``);
  let [u, d] = Z.useState([]);
  let [f, p] = Z.useState(false);
  let [m, h] = Z.useState(``);
  let g = e => {
    r?.(e);
    h(e);
    window.setTimeout(() => {
      return h(``);
    }, 2000);
  };
  let _ = async () => {
    if (e) {
      p(true);
      try {
        d(await (i === `mine` ? Y_ : X_)({
          category: o,
          keyword: c
        }));
      } catch {
        d([]);
      } finally {
        p(false);
      }
    }
  };
  Z.useEffect(() => {
    if (e) {
      _();
    }
  }, [e, i, o]);
  let v = Z.useMemo(() => {
    let e = c.trim().toLowerCase();
    if (e) {
      return u.filter(t => {
        return t.name.toLowerCase().includes(e);
      });
    } else {
      return u;
    }
  }, [u, c]);
  let y = async e => {
    let t = await Z_(e.id, !e.isPublic);
    if (t.ok) {
      let n = t.data || {
        ...e,
        isPublic: !e.isPublic
      };
      d(t => {
        return t.map(t => {
          if (t.id === e.id) {
            return n;
          } else {
            return t;
          }
        });
      });
      if (e.isPublic) {
        g(`已设为私有`);
      } else {
        g(n.reviewStatus === `pending` ? `已提交审核，等待后台审核` : `已设为公开`);
      }
    } else {
      g(t.error || `操作失败`);
    }
  };
  let b = async e => {
    if (await Q_(e.id)) {
      d(t => {
        return t.filter(t => {
          return t.id !== e.id;
        });
      });
      g(`已删除`);
    } else {
      g(`删除失败`);
    }
  };
  let x = e => {
    n(e);
    t();
  };
  let S = (e, t) => {
    e.dataTransfer.setData(ev, JSON.stringify(t));
    e.dataTransfer.setData(`text/plain`, JSON.stringify(t));
    e.dataTransfer.effectAllowed = `copy`;
  };
  if (e) {
    const Component2977 = `div`;
    const Component2978 = `button`;
    const Component2979 = `div`;
    const Component2980 = `button`;
    const Component2981 = `div`;
    const Component2982 = `div`;
    const Component2983 = `button`;
    const Component2984 = `div`;
    const Component2985 = `input`;
    const Component2986 = `div`;
    const Component2987 = `div`;
    const Component2988 = `div`;
    const Component2989 = `div`;
    const Component2990 = `img`;
    const Component2991 = `div`;
    const Component2992 = `div`;
    const Component2993 = `button`;
    const Component2994 = `button`;
    const Component2995 = `button`;
    const Component2996 = `div`;
    const Component2997 = `div`;
    const Component2998 = `p`;
    const Component2999 = `span`;
    const Component3000 = `div`;
    const Component3001 = `p`;
    const Component3002 = `p`;
    const Component3003 = `div`;
    const Component3004 = `div`;
    const Component3005 = `div`;
    const Component3006 = `div`;
    const Component3007 = `div`;
    const Component3008 = `div`;
    return Fn.createPortal(<Component3008 className={`fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 nowheel nopan nodrag`} onClick={t}>
        <Component3007 className={`relative w-[58vw] h-[66vh] max-w-[1080px] bg-[#141414] border border-[#2a2a2a] rounded-2xl shadow-2xl flex flex-col overflow-hidden`} onClick={e => {
        return e.stopPropagation();
      }}>
          {m && <Component2977 className={`absolute top-4 left-1/2 -translate-x-1/2 z-[1100] px-4 py-2 rounded-lg bg-[#2a2a2a] border border-[#3a3a3a] text-sm text-white shadow-2xl`}>
              {m}
            </Component2977>}
          <Component2982 className={`shrink-0 flex items-center gap-4 px-5 h-14 border-b border-[#222]`}>
            <Component2979 className={`flex items-center gap-1`}>
              {[{
              key: `mine`,
              label: `我的模板`
            }, {
              key: `square`,
              label: `模板广场`
            }].map(e => {
              return <Component2978 onClick={() => {
                return a(e.key);
              }} className={`px-3.5 py-1.5 text-sm rounded-lg transition-colors ${i === e.key ? `bg-[#2a2a2a] text-white font-medium` : `text-gray-400 hover:text-gray-200`}`} key={e.key}>
                    {e.label}
                  </Component2978>;
            })}
            </Component2979>
            <Component2981 className={`ml-auto flex items-center gap-3`}>
              <Component2980 onClick={t} className={`p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a] rounded-lg`}>
                <Gt size={18} />
              </Component2980>
            </Component2981>
          </Component2982>
          <Component2984 className={`shrink-0 flex items-center gap-2 px-5 pt-3 pb-1`}>
            {tv.map(e => {
            return <Component2983 onClick={() => {
              return s(e.value);
            }} className={`px-4 py-1.5 text-[13px] rounded-lg transition-colors ${o === e.value ? `bg-white text-[#141414] font-medium` : `bg-[#1f1f1f] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} key={e.value}>
                  {e.label}
                </Component2983>;
          })}
          </Component2984>
          <Component2987 className={`shrink-0 px-5 py-2`}>
            <Component2986 className={`relative max-w-md`}>
              <Ae className={`absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500`} />
              <Component2985 value={c} onChange={e => {
              return l(e.target.value);
            }} placeholder={`搜索模板关键词`} className={`w-full pl-8 pr-3 py-2 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-gray-200 placeholder:text-gray-600 focus:border-gray-500 outline-none`} />
            </Component2986>
          </Component2987>
          <Component3006 className={`flex-1 overflow-y-auto custom-scrollbar p-5`}>
            {f ? <Component2988 className={`h-full flex items-center justify-center text-sm text-gray-500`}>{`加载中…`}</Component2988> : v.length === 0 ? <Component2989 className={`h-full flex items-center justify-center text-sm text-gray-500`}>
                {i === `mine` ? `还没有创建模板，框选画布节点即可创建` : `暂无公开模板`}
              </Component2989> : <Component3005 className={`grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3`}>
                {v.map(e => {
              return <Component3004 draggable={true} onDragStart={t => {
                return S(t, e);
              }} className={`group relative rounded-xl overflow-hidden bg-[#1a1a1a] border border-transparent hover:border-white/30 transition-all cursor-grab active:cursor-grabbing`} title={`拖拽到画布插入，或点击「使用」`} key={e.id}>
                      <Component2997 className={`relative aspect-[4/3] bg-[#0d0c0c] overflow-hidden`}>
                        {e.coverUrl ? <Component2990 src={G_(e.coverUrl)} alt={e.name} className={`w-full h-full object-cover`} draggable={false} /> : <Component2991 className={`w-full h-full flex items-center justify-center text-gray-700 text-3xl`}>{`🧩`}</Component2991>}
                        <Component2992 className={`absolute top-2 left-2 z-10`}>
                          <_cmp__Component93 category={e.category} />
                        </Component2992>
                        <Component2996 className={`absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2`}>
                          {i === `mine` && <Q.Fragment>
                              <Component2993 onClick={t => {
                        t.stopPropagation();
                        y(e);
                      }} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#3a3a3a] text-xs text-gray-100`} title={e.isPublic ? `设为私有` : `设为公开`}>
                                {e.isPublic ? <_e size={13} /> : <_Component94 size={13} />}
                                {e.isPublic ? `私有` : `公开`}
                              </Component2993>
                              <Component2994 onClick={t => {
                        t.stopPropagation();
                        b(e);
                      }} className={`p-1.5 rounded-lg bg-[#2a2a2a] hover:bg-red-600/80 text-gray-100`} title={`删除`}>
                                <Ot size={14} />
                              </Component2994>
                            </Q.Fragment>}
                          <Component2995 onClick={t => {
                      t.stopPropagation();
                      x(e);
                    }} className={`px-3 py-1.5 rounded-lg bg-white hover:bg-gray-200 text-xs text-[#141414] font-medium`}>{`使用`}</Component2995>
                        </Component2996>
                      </Component2997>
                      <Component3003 className={`px-2 py-2 space-y-1`}>
                        <Component3000 className={`flex items-center justify-between gap-2`}>
                          <Component2998 className={`text-[13px] text-gray-200 truncate`}>
                            {e.name}
                          </Component2998>
                          {i === `mine` && <Component2999 className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${e.reviewStatus === `approved` ? `bg-emerald-500/15 text-emerald-300` : e.reviewStatus === `rejected` ? `bg-rose-500/15 text-rose-300` : e.reviewStatus === `pending` ? `bg-amber-500/15 text-amber-300` : `bg-slate-500/15 text-slate-300`}`}>
                              {e.reviewStatus === `approved` ? `已通过` : e.reviewStatus === `rejected` ? `已驳回` : e.reviewStatus === `pending` ? `待审核` : `草稿`}
                            </Component2999>}
                        </Component3000>
                        {i === `mine` && e.reviewStatus === `rejected` && e.reviewRemark && <Component3001 className={`text-[11px] leading-4 text-rose-300 line-clamp-2 break-words`}>
                            {`驳回原因：`}
                            {e.reviewRemark}
                          </Component3001>}
                        {i === `mine` && e.reviewStatus === `pending` && <Component3002 className={`text-[11px] leading-4 text-amber-300`}>{`已提交审核，等待管理员处理`}</Component3002>}
                      </Component3003>
                    </Component3004>;
            })}
              </Component3005>}
          </Component3006>
        </Component3007>
      </Component3008>, document.body);
  } else {
    return null;
  }
}