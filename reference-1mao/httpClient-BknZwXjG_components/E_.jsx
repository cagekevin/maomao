// TODO(全局, 无需 import): open, onClose, onUse, onToast, r, p, i, category, o, keyword, u, isPublic, n, g, m, key, label, s, l, f, v, b, x
import _cmp_T_ from './T_.jsx';
import { e, h, d, v_, y_, c, _, t, b_, x_, C_, Fn, a, w_, S, m_, y, Gt, Ae, _e, L, Ot } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
export default function E_({
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
        d(await (i === `mine` ? v_ : y_)({
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
    let t = await b_(e.id, !e.isPublic);
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
    if (await x_(e.id)) {
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
    e.dataTransfer.setData(C_, JSON.stringify(t));
    e.dataTransfer.setData(`text/plain`, JSON.stringify(t));
    e.dataTransfer.effectAllowed = `copy`;
  };
  if (e) {
    const Component2870 = `div`;
    const Component2871 = `button`;
    const Component2872 = `div`;
    const Component2873 = `button`;
    const Component2874 = `div`;
    const Component2875 = `div`;
    const Component2876 = `button`;
    const Component2877 = `div`;
    const Component2878 = `input`;
    const Component2879 = `div`;
    const Component2880 = `div`;
    const Component2881 = `div`;
    const Component2882 = `div`;
    const Component2883 = `img`;
    const Component2884 = `div`;
    const Component2885 = `div`;
    const Component2886 = `button`;
    const Component2887 = `button`;
    const Component2888 = `button`;
    const Component2889 = `div`;
    const Component2890 = `div`;
    const Component2891 = `p`;
    const Component2892 = `span`;
    const Component2893 = `div`;
    const Component2894 = `p`;
    const Component2895 = `p`;
    const Component2896 = `div`;
    const Component2897 = `div`;
    const Component2898 = `div`;
    const Component2899 = `div`;
    const Component2900 = `div`;
    const Component2901 = `div`;
    return Fn.createPortal(<Component2901 className={`fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 nowheel nopan nodrag`} onClick={t}>
        <Component2900 className={`relative w-[58vw] h-[66vh] max-w-[1080px] bg-[#141414] border border-[#2a2a2a] rounded-2xl shadow-2xl flex flex-col overflow-hidden`} onClick={e => {
        return e.stopPropagation();
      }}>
          {m && <Component2870 className={`absolute top-4 left-1/2 -translate-x-1/2 z-[1100] px-4 py-2 rounded-lg bg-[#2a2a2a] border border-[#3a3a3a] text-sm text-white shadow-2xl`}>
              {m}
            </Component2870>}
          <Component2875 className={`shrink-0 flex items-center gap-4 px-5 h-14 border-b border-[#222]`}>
            <Component2872 className={`flex items-center gap-1`}>
              {[{
              key: `mine`,
              label: `我的模板`
            }, {
              key: `square`,
              label: `模板广场`
            }].map(e => {
              return <Component2871 onClick={() => {
                return a(e.key);
              }} className={`px-3.5 py-1.5 text-sm rounded-lg transition-colors ${i === e.key ? `bg-[#2a2a2a] text-white font-medium` : `text-gray-400 hover:text-gray-200`}`} key={e.key}>
                    {e.label}
                  </Component2871>;
            })}
            </Component2872>
            <Component2874 className={`ml-auto flex items-center gap-3`}>
              <Component2873 onClick={t} className={`p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a] rounded-lg`}>
                <Gt size={18} />
              </Component2873>
            </Component2874>
          </Component2875>
          <Component2877 className={`shrink-0 flex items-center gap-2 px-5 pt-3 pb-1`}>
            {w_.map(e => {
            return <Component2876 onClick={() => {
              return s(e.value);
            }} className={`px-4 py-1.5 text-[13px] rounded-lg transition-colors ${o === e.value ? `bg-white text-[#141414] font-medium` : `bg-[#1f1f1f] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} key={e.value}>
                  {e.label}
                </Component2876>;
          })}
          </Component2877>
          <Component2880 className={`shrink-0 px-5 py-2`}>
            <Component2879 className={`relative max-w-md`}>
              <Ae className={`absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500`} />
              <Component2878 value={c} onChange={e => {
              return l(e.target.value);
            }} placeholder={`搜索模板关键词`} className={`w-full pl-8 pr-3 py-2 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-gray-200 placeholder:text-gray-600 focus:border-gray-500 outline-none`} />
            </Component2879>
          </Component2880>
          <Component2899 className={`flex-1 overflow-y-auto custom-scrollbar p-5`}>
            {f ? <Component2881 className={`h-full flex items-center justify-center text-sm text-gray-500`}>{`加载中…`}</Component2881> : v.length === 0 ? <Component2882 className={`h-full flex items-center justify-center text-sm text-gray-500`}>
                {i === `mine` ? `还没有创建模板，框选画布节点即可创建` : `暂无公开模板`}
              </Component2882> : <Component2898 className={`grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3`}>
                {v.map(e => {
              return <Component2897 draggable={true} onDragStart={t => {
                return S(t, e);
              }} className={`group relative rounded-xl overflow-hidden bg-[#1a1a1a] border border-transparent hover:border-white/30 transition-all cursor-grab active:cursor-grabbing`} title={`拖拽到画布插入，或点击「使用」`} key={e.id}>
                      <Component2890 className={`relative aspect-[4/3] bg-[#0d0c0c] overflow-hidden`}>
                        {e.coverUrl ? <Component2883 src={m_(e.coverUrl)} alt={e.name} className={`w-full h-full object-cover`} draggable={false} /> : <Component2884 className={`w-full h-full flex items-center justify-center text-gray-700 text-3xl`}>{`🧩`}</Component2884>}
                        <Component2885 className={`absolute top-2 left-2 z-10`}>
                          <_cmp_T_ category={e.category} />
                        </Component2885>
                        <Component2889 className={`absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2`}>
                          {i === `mine` && <Q.Fragment>
                              <Component2886 onClick={t => {
                        t.stopPropagation();
                        y(e);
                      }} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#3a3a3a] text-xs text-gray-100`} title={e.isPublic ? `设为私有` : `设为公开`}>
                                {e.isPublic ? <_e size={13} /> : <L size={13} />}
                                {e.isPublic ? `私有` : `公开`}
                              </Component2886>
                              <Component2887 onClick={t => {
                        t.stopPropagation();
                        b(e);
                      }} className={`p-1.5 rounded-lg bg-[#2a2a2a] hover:bg-red-600/80 text-gray-100`} title={`删除`}>
                                <Ot size={14} />
                              </Component2887>
                            </Q.Fragment>}
                          <Component2888 onClick={t => {
                      t.stopPropagation();
                      x(e);
                    }} className={`px-3 py-1.5 rounded-lg bg-white hover:bg-gray-200 text-xs text-[#141414] font-medium`}>{`使用`}</Component2888>
                        </Component2889>
                      </Component2890>
                      <Component2896 className={`px-2 py-2 space-y-1`}>
                        <Component2893 className={`flex items-center justify-between gap-2`}>
                          <Component2891 className={`text-[13px] text-gray-200 truncate`}>
                            {e.name}
                          </Component2891>
                          {i === `mine` && <Component2892 className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${e.reviewStatus === `approved` ? `bg-emerald-500/15 text-emerald-300` : e.reviewStatus === `rejected` ? `bg-rose-500/15 text-rose-300` : e.reviewStatus === `pending` ? `bg-amber-500/15 text-amber-300` : `bg-slate-500/15 text-slate-300`}`}>
                              {e.reviewStatus === `approved` ? `已通过` : e.reviewStatus === `rejected` ? `已驳回` : e.reviewStatus === `pending` ? `待审核` : `草稿`}
                            </Component2892>}
                        </Component2893>
                        {i === `mine` && e.reviewStatus === `rejected` && e.reviewRemark && <Component2894 className={`text-[11px] leading-4 text-rose-300 line-clamp-2 break-words`}>
                            {`驳回原因：`}
                            {e.reviewRemark}
                          </Component2894>}
                        {i === `mine` && e.reviewStatus === `pending` && <Component2895 className={`text-[11px] leading-4 text-amber-300`}>{`已提交审核，等待管理员处理`}</Component2895>}
                      </Component2896>
                    </Component2897>;
            })}
              </Component2898>}
          </Component2899>
        </Component2900>
      </Component2901>, document.body);
  } else {
    return null;
  }
}