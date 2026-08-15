// TODO(全局, 无需 import): open, globalTasks, useThumbnail, onClose, onRefreshTask, onRerunTask, onFullscreen, setGlobalTasks, showToastMessage, u, p, h, t, page, pageSize, sortBy, sortDir, search, filters, n, te, i, k, ne, ee, w, width, ie, re, x, v, b, d, m, confirm, c, l, j, y, o, s
import { Fn, e, In, M, it, Pn, F, A, O, E, r, N, T, I, L, C, S, g, _, ye, P, D, a, Ze, Ue, _Component16, R, _Component28, _Component30, Nn, _Component26 } from './shared.js';
import * as W from 'react';
export default function Ln({
  open: e,
  globalTasks: t,
  useThumbnail: n,
  onClose: r,
  onRefreshTask: a,
  onRerunTask: o,
  onFullscreen: s,
  setGlobalTasks: c,
  showToastMessage: l
}) {
  let [u, d] = W.useState(`all`);
  let [p, m] = W.useState(`all`);
  let [h, g] = W.useState(``);
  let [_, v] = W.useState(false);
  let [y, b] = W.useState(new Set());
  let [x, S] = W.useState(false);
  let [C, w] = W.useState(360);
  let [T, E] = W.useState([]);
  let [D, O] = W.useState(1);
  let [k, A] = W.useState(0);
  let [j, M] = W.useState(false);
  let [N, P] = W.useState(0);
  let ee = W.useRef(false);
  let F = W.useCallback(() => {
    let e = {};
    if (!Fn(`pending`, u)) {
      if (u === `running`) {
        e.status = [`running`, `pending`];
      } else {
        e.status = [u];
      }
    }
    if (!In(`video`, p)) {
      if (p === `video`) {
        e.type = [`video`, `sd2Video`, `discountVideo`];
      } else {
        e.type = [p];
      }
    }
    return e;
  }, [u, p]);
  let I = W.useCallback(e => {
    if (!Fn(e.status, u) || !In(e.type, p)) {
      return false;
    }
    if (h.trim()) {
      let t = h.toLowerCase();
      if ((!e.prompt || !e.prompt.toLowerCase().includes(t)) && (!e.channelName || !e.channelName.toLowerCase().includes(t)) && (!e.modelName || !e.modelName.toLowerCase().includes(t))) {
        return false;
      }
    }
    return true;
  }, [u, p, h]);
  let te = W.useCallback(async (e, t) => {
    M(true);
    try {
      let n = await it({
        page: e,
        pageSize: Pn,
        sortBy: `createdAt`,
        sortDir: `DESC`,
        search: h,
        filters: F()
      });
      A(n.total);
      O(n.page);
      E(e => {
        if (t) {
          return n.items;
        }
        let r = new Set(e.map(e => {
          return e.id;
        }));
        return [...e, ...n.items.filter(e => {
          return !r.has(e.id);
        })];
      });
    } catch (e) {
      console.error(`[TaskListDrawer] 加载任务分页失败:`, e);
    } finally {
      M(false);
    }
  }, [F, h]);
  W.useEffect(() => {
    if (!e) {
      return;
    }
    let t = setTimeout(() => {
      te(1, true);
    }, 300);
    return () => {
      return clearTimeout(t);
    };
  }, [e, u, p, h, N, te]);
  let L = W.useMemo(() => {
    let e = new Map(t.map(e => {
      return [e.id, e];
    }));
    let n = T.map(t => {
      return e.get(t.id) || t;
    });
    let r = new Set(T.map(e => {
      return e.id;
    }));
    let i = [...t.filter(e => {
      return !r.has(e.id) && I(e);
    }), ...n];
    i.sort((e, t) => {
      return (t.createdAt || 0) - (e.createdAt || 0);
    });
    return i;
  }, [T, t, I]);
  let ne = L.length;
  let re = Math.max(k, ne);
  let ie = T.length < k;
  W.useEffect(() => {
    let e = e => {
      if (!ee.current) {
        return;
      }
      let t = document.body.clientWidth - e.clientX;
      if (t >= 280 && t <= 800) {
        w(t);
      }
    };
    let t = () => {
      if (ee.current) {
        ee.current = false;
        document.body.style.cursor = ``;
        document.body.style.userSelect = ``;
      }
    };
    window.addEventListener(`mousemove`, e);
    window.addEventListener(`mouseup`, t);
    return () => {
      window.removeEventListener(`mousemove`, e);
      window.removeEventListener(`mouseup`, t);
    };
  }, []);
  if (e) {
    const Component396 = `div`;
    const Component397 = `span`;
    const Component398 = `h3`;
    const Component399 = `button`;
    const Component400 = `div`;
    const Component401 = `button`;
    const Component402 = `div`;
    const Component403 = `div`;
    const Component404 = `input`;
    const Component405 = `button`;
    const Component406 = `div`;
    const Component407 = `option`;
    const Component408 = `option`;
    const Component409 = `option`;
    const Component410 = `option`;
    const Component411 = `select`;
    const Component412 = `option`;
    const Component413 = `option`;
    const Component414 = `option`;
    const Component415 = `option`;
    const Component416 = `option`;
    const Component417 = `select`;
    const Component418 = `div`;
    const Component419 = `button`;
    const Component420 = `button`;
    const Component421 = `button`;
    const Component422 = `div`;
    const Component423 = `button`;
    const Component424 = `div`;
    const Component425 = `div`;
    const Component426 = `div`;
    const Component427 = `div`;
    const Component428 = `div`;
    const Component429 = `div`;
    const Component430 = `div`;
    const Component431 = `div`;
    const Component432 = `div`;
    const Component433 = `div`;
    const Component434 = `button`;
    const Component435 = `span`;
    const Component436 = `div`;
    const Component437 = `button`;
    const Component438 = `div`;
    const Component439 = `div`;
    const Component440 = `div`;
    return <Component440 className={`fixed top-0 right-0 bottom-0 bg-[#151414] border-l border-[#333] shadow-2xl z-[100] flex flex-col animate-slide-left`} style={{
      width: `${C}px`
    }}>
        <Component396 className={`absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 z-50 transition-colors`} onMouseDown={e => {
        e.preventDefault();
        ee.current = true;
        document.body.style.cursor = `col-resize`;
        document.body.style.userSelect = `none`;
      }} />
        <Component429 className={`p-3 border-b border-[#333] flex flex-col gap-2 bg-[#252525]`}>
          <Component403 className={`flex justify-between items-center`}>
            <Component398 className={`text-sm font-bold text-gray-200 flex items-center gap-2`}>
              {`任务中心`}
              <Component397 className={`text-[10px] text-gray-500 font-normal bg-black/30 px-1.5 py-0.5 rounded`}>
                {ie ? `${ne}/${re}` : re}
              </Component397>
            </Component398>
            <Component402 className={`flex items-center gap-1`}>
              <Component399 onClick={() => {
              return S(!x);
            }} className={`p-1.5 rounded transition-colors flex items-center gap-1 ${x ? `bg-blue-500/20 text-blue-400` : `text-gray-400 hover:text-white hover:bg-white/10`}`} title={`过滤与搜索`}>
                <_Component16 size={14} className={`transform transition-transform ${x ? `rotate-180` : ``}`} />
              </Component399>
              <Component400 className={`w-px h-3 bg-gray-600 mx-1`} />
              <Component401 onClick={r} className={`text-gray-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors`}>
                <R size={14} />
              </Component401>
            </Component402>
          </Component403>
          {x && <Component428 className={`flex flex-col gap-2 mt-1 animate-fade-in`}>
              <Component406 className={`flex items-center gap-2`}>
                <Component404 type={`text`} placeholder={`搜索提示词或渠道...`} className={`flex-1 bg-[#0d0c0c] border border-[#444] rounded px-2 py-1 text-[11px] text-gray-300 focus:outline-none focus:border-blue-500`} value={h} onChange={e => {
              return g(e.target.value);
            }} />
                <Component405 onClick={() => {
              v(!_);
              b(new Set());
            }} className={`text-[11px] px-2 py-1 rounded transition-colors border ${_ ? `bg-blue-500/20 text-blue-400 border-blue-500/50` : `bg-white/5 text-gray-400 border-transparent hover:bg-white/10`}`}>
                  {_ ? `取消多选` : `批量操作`}
                </Component405>
              </Component406>
              <Component427 className={`flex items-center justify-between gap-2`}>
                <Component418 className={`flex items-center gap-2`}>
                  <Component411 value={u} onChange={e => {
                return d(e.target.value);
              }} className={`bg-[#0d0c0c] text-gray-300 text-[10px] rounded px-1 py-1 border border-[#444] outline-none`}>
                    <Component407 value={`all`}>{`所有状态`}</Component407>
                    <Component408 value={`running`}>{`生成中`}</Component408>
                    <Component409 value={`completed`}>{`已完成`}</Component409>
                    <Component410 value={`failed`}>{`失败`}</Component410>
                  </Component411>
                  <Component417 value={p} onChange={e => {
                return m(e.target.value);
              }} className={`bg-[#0d0c0c] text-gray-300 text-[10px] rounded px-1 py-1 border border-[#444] outline-none`}>
                    <Component412 value={`all`}>{`所有类型`}</Component412>
                    <Component413 value={`image`}>{`生图`}</Component413>
                    <Component414 value={`video`}>{`视频`}</Component414>
                    <Component415 value={`text`}>{`文本`}</Component415>
                    <Component416 value={`custom`}>{`万能`}</Component416>
                  </Component417>
                </Component418>
                <Component426 className={`relative group/clean`}>
                  <Component419 className={`text-[10px] text-gray-400 hover:text-red-400 px-1 py-1 rounded hover:bg-white/5 flex items-center gap-1`}>
                    <_Component28 size={12} />
                    {` 一键清理`}
                  </Component419>
                  <Component425 className={`absolute right-0 top-full pt-1 hidden group-hover/clean:block z-50`}>
                    <Component424 className={`bg-[#1a1a1a] border border-[#333] rounded shadow-xl py-1 w-32`}>
                      <Component420 className={`w-full text-left px-3 py-1.5 text-[10px] text-gray-300 hover:bg-[#333] hover:text-red-400`} onClick={async () => {
                    if (confirm(`确定要清空所有失败的任务吗？`)) {
                      await ye([`failed`]);
                      c(e => {
                        return e.filter(e => {
                          return e.status !== `failed`;
                        });
                      });
                      P(e => {
                        return e + 1;
                      });
                      l(`已清理失败任务`);
                    }
                  }}>{`清理失败任务`}</Component420>
                      <Component421 className={`w-full text-left px-3 py-1.5 text-[10px] text-gray-300 hover:bg-[#333] hover:text-red-400`} onClick={async () => {
                    if (confirm(`确定要清空所有已完成的任务吗？（仅移除记录，不删文件）`)) {
                      await ye([`completed`]);
                      c(e => {
                        return e.filter(e => {
                          return e.status !== `completed`;
                        });
                      });
                      P(e => {
                        return e + 1;
                      });
                      l(`已清理完成任务`);
                    }
                  }}>{`清理已完成任务`}</Component421>
                      <Component422 className={`border-t border-[#333] my-1`} />
                      <Component423 className={`w-full text-left px-3 py-1.5 text-[10px] text-red-400 hover:bg-[#333] font-bold`} onClick={async () => {
                    if (confirm(`确定要清空所有任务记录吗？（包含进行中）`)) {
                      await ye([]);
                      c([]);
                      P(e => {
                        return e + 1;
                      });
                      l(`已清空全部任务`);
                    }
                  }}>{`清空全部任务`}</Component423>
                    </Component424>
                  </Component425>
                </Component426>
              </Component427>
            </Component428>}
        </Component429>
        <Component433 className={`flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar nowheel nopan nodrag relative`} onScroll={e => {
        let t = e.target;
        if (t.scrollHeight - t.scrollTop - t.clientHeight < 50 && !j && ie) {
          te(D + 1, false);
        }
      }}>
          {L.length === 0 ? <Component430 className={`text-center text-gray-500 text-xs py-10 flex flex-col items-center gap-2`}>
              <_Component30 size={24} className={`opacity-20`} />
              {j ? `加载中...` : `没有匹配的任务`}
            </Component430> : L.map(e => {
          return <Nn task={e} useThumbnail={n} onRefresh={a} onDelete={e => {
            Ze(e).catch(e => {
              return console.error(`Failed to delete task:`, e);
            });
            c(t => {
              return t.filter(t => {
                return t.id !== e;
              });
            });
            E(t => {
              return t.filter(t => {
                return t.id !== e;
              });
            });
            A(e => {
              return Math.max(0, e - 1);
            });
            if (y.has(e)) {
              let t = new Set(y);
              t.delete(e);
              b(t);
            }
          }} onRerun={o} onFullscreen={s} onToast={l} selectable={_} selected={y.has(e.id)} onToggleSelect={e => {
            let t = new Set(y);
            if (t.has(e)) {
              t.delete(e);
            } else {
              t.add(e);
            }
            b(t);
          }} key={e.id} />;
        })}
          {ie && <Component431 className={`text-center py-3 text-[10px] text-gray-500`}>
              <_Component26 size={12} className={`animate-spin mx-auto mb-1`} />
              {`向上滚动加载更多...`}
            </Component431>}
          {ne > 0 && !ie && <Component432 className={`text-center py-3 text-[10px] text-gray-600`}>
              {`— 已加载全部 `}
              {re}
              {` 条任务 —`}
            </Component432>}
        </Component433>
        {_ && <Component439 className={`p-3 border-t border-[#333] bg-[#252525] flex justify-between items-center animate-slide-up`}>
            <Component436 className={`flex items-center gap-2`}>
              <Component434 onClick={() => {
            if (y.size === L.length) {
              b(new Set());
            } else {
              b(new Set(L.map(e => {
                return e.id;
              })));
            }
          }} className={`text-[11px] text-gray-400 hover:text-white`}>
                {y.size === L.length ? `取消全选` : `全选`}
              </Component434>
              <Component435 className={`text-[11px] text-gray-500`}>
                {`已选 `}
                {y.size}
                {` 项`}
              </Component435>
            </Component436>
            <Component438 className={`flex gap-2`}>
              <Component437 onClick={async () => {
            if (y.size === 0) {
              return;
            }
            let e = Array.from(y);
            if (confirm(`确定要删除选中的 ${e.length} 个任务吗？`)) {
              await Ue(e);
              let t = new Set(e);
              c(e => {
                return e.filter(e => {
                  return !t.has(e.id);
                });
              });
              E(e => {
                return e.filter(e => {
                  return !t.has(e.id);
                });
              });
              A(t => {
                return Math.max(0, t - e.length);
              });
              b(new Set());
              v(false);
              l(`已删除 ${e.length} 个任务`);
            }
          }} disabled={y.size === 0} className={`px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 disabled:opacity-30 rounded text-[11px] transition-colors flex items-center gap-1`}>
                <_Component28 size={12} />
                {`批量删除`}
              </Component437>
            </Component438>
          </Component439>}
      </Component440>;
  } else {
    return null;
  }
}