// TODO(全局, 无需 import): open, globalTasks, useThumbnail, onClose, onRefreshTask, onRerunTask, onFullscreen, setGlobalTasks, showToastMessage, u, p, h, t, ee, page, pageSize, sortBy, sortDir, search, filters, n, te, status, progress, errorMsg, resultUrl, thumbnailUrl, taskId, responseData, customRawResponse, customResultData, customOutputType, mediaMeta, id, ne, re, w, width, z, ie, x, confirm, c, l, v, b, d, m, j, y, o, s
import { Bn, e, Vn, pt, zn, F, A, O, E, r, M, wt, L, T, I, k, P, C, S, St, g, _, N, D, a, dt, _e, _Component17, _Component26, R, _Component28, Rn, _Component25 } from './shared.js';
import * as G from 'react';
export default function Hn({
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
  let [u, d] = G.useState(`all`);
  let [p, m] = G.useState(`all`);
  let [h, g] = G.useState(``);
  let [_, v] = G.useState(false);
  let [y, b] = G.useState(new Set());
  let [x, S] = G.useState(false);
  let [C, w] = G.useState(360);
  let [T, E] = G.useState([]);
  let [D, O] = G.useState(1);
  let [k, A] = G.useState(0);
  let [j, ee] = G.useState(false);
  let [M, N] = G.useState(0);
  let P = G.useRef(false);
  let F = G.useCallback(() => {
    let e = {};
    if (!Bn(`pending`, u)) {
      if (u === `running`) {
        e.status = [`running`, `pending`];
      } else {
        e.status = [u];
      }
    }
    if (!Vn(`video`, p)) {
      if (p === `video`) {
        e.type = [`video`, `sd2Video`, `discountVideo`];
      } else {
        e.type = [p];
      }
    }
    return e;
  }, [u, p]);
  let I = G.useCallback(e => {
    if (!Bn(e.status, u) || !Vn(e.type, p)) {
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
  let te = G.useCallback(async (e, t) => {
    ee(true);
    try {
      let n = await pt({
        page: e,
        pageSize: zn,
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
      ee(false);
    }
  }, [F, h]);
  G.useEffect(() => {
    if (!e) {
      return;
    }
    let t = setTimeout(() => {
      te(1, true);
    }, 300);
    return () => {
      return clearTimeout(t);
    };
  }, [e, u, p, h, M, te]);
  let L = G.useCallback(e => {
    let n = t.find(t => {
      return wt(t, e);
    });
    if (n) {
      return {
        ...e,
        status: n.status,
        progress: n.progress,
        errorMsg: n.errorMsg,
        resultUrl: n.resultUrl ?? e.resultUrl,
        thumbnailUrl: n.thumbnailUrl ?? e.thumbnailUrl,
        taskId: n.taskId || e.taskId,
        responseData: n.responseData ?? e.responseData,
        customRawResponse: n.customRawResponse ?? e.customRawResponse,
        customResultData: n.customResultData ?? e.customResultData,
        customOutputType: n.customOutputType ?? e.customOutputType,
        mediaMeta: n.mediaMeta ?? e.mediaMeta,
        id: e.id
      };
    } else {
      return e;
    }
  }, [t]);
  G.useEffect(() => {
    if (!!e && t.length !== 0) {
      E(e => {
        let t = false;
        let n = e.map(e => {
          let n = L(e);
          if (n === e) {
            return e;
          } else if (n.resultUrl !== e.resultUrl || n.thumbnailUrl !== e.thumbnailUrl || n.status !== e.status || n.progress !== e.progress || n.errorMsg !== e.errorMsg || n.taskId !== e.taskId) {
            t = true;
            return n;
          } else {
            return e;
          }
        });
        if (t) {
          return n;
        } else {
          return e;
        }
      });
    }
  }, [t, e, L]);
  let ne = G.useMemo(() => {
    let e = T.map(e => {
      return L(e);
    });
    let n = [...t.filter(e => {
      if (T.some(t => {
        return wt(t, e);
      })) {
        return false;
      } else {
        return I(e);
      }
    }), ...e];
    n.sort((e, t) => {
      return (t.createdAt || 0) - (e.createdAt || 0);
    });
    return n;
  }, [T, t, I, L]);
  let re = ne.length;
  let ie = Math.max(k, re);
  let z = T.length < k;
  G.useEffect(() => {
    let e = e => {
      if (!P.current) {
        return;
      }
      let t = document.body.clientWidth - e.clientX;
      if (t >= 280 && t <= 800) {
        w(t);
      }
    };
    let t = () => {
      if (P.current) {
        P.current = false;
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
    const Component397 = `div`;
    const Component398 = `span`;
    const Component399 = `h3`;
    const Component400 = `button`;
    const Component401 = `button`;
    const Component402 = `div`;
    const Component403 = `button`;
    const Component404 = `div`;
    const Component405 = `div`;
    const Component406 = `input`;
    const Component407 = `button`;
    const Component408 = `div`;
    const Component409 = `option`;
    const Component410 = `option`;
    const Component411 = `option`;
    const Component412 = `option`;
    const Component413 = `select`;
    const Component414 = `option`;
    const Component415 = `option`;
    const Component416 = `option`;
    const Component417 = `option`;
    const Component418 = `option`;
    const Component419 = `select`;
    const Component420 = `div`;
    const Component421 = `button`;
    const Component422 = `button`;
    const Component423 = `button`;
    const Component424 = `div`;
    const Component425 = `button`;
    const Component426 = `div`;
    const Component427 = `div`;
    const Component428 = `div`;
    const Component429 = `div`;
    const Component430 = `div`;
    const Component431 = `div`;
    const Component432 = `div`;
    const Component433 = `div`;
    const Component434 = `div`;
    const Component435 = `div`;
    const Component436 = `button`;
    const Component437 = `span`;
    const Component438 = `div`;
    const Component439 = `button`;
    const Component440 = `div`;
    const Component441 = `div`;
    const Component442 = `div`;
    return <Component442 className={`fixed top-0 right-0 bottom-0 bg-[#151414] border-l border-[#333] shadow-2xl z-[100] flex flex-col animate-slide-left`} style={{
      width: `${C}px`
    }}>
        <Component397 className={`absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/50 z-50 transition-colors`} onMouseDown={e => {
        e.preventDefault();
        P.current = true;
        document.body.style.cursor = `col-resize`;
        document.body.style.userSelect = `none`;
      }} />
        <Component431 className={`p-3 border-b border-[#333] flex flex-col gap-2 bg-[#252525]`}>
          <Component405 className={`flex justify-between items-center`}>
            <Component399 className={`text-sm font-bold text-gray-200 flex items-center gap-2`}>
              {`任务中心`}
              <Component398 className={`text-[10px] text-gray-500 font-normal bg-black/30 px-1.5 py-0.5 rounded`}>
                {z ? `${re}/${ie}` : ie}
              </Component398>
            </Component399>
            <Component404 className={`flex items-center gap-1`}>
              <Component400 onClick={() => {
              return S(!x);
            }} className={`p-1.5 rounded transition-colors flex items-center gap-1 ${x ? `bg-blue-500/20 text-blue-400` : `text-gray-400 hover:text-white hover:bg-white/10`}`} title={`过滤与搜索`}>
                <_Component17 size={14} className={`transform transition-transform ${x ? `rotate-180` : ``}`} />
              </Component400>
              <Component401 onClick={async () => {
              if (confirm(`确定要清空所有任务记录吗？（包含进行中）此操作不可撤销。`)) {
                await St([]);
                c([]);
                E([]);
                A(0);
                l(`已清空全部任务`);
              }
            }} className={`p-1.5 rounded transition-colors text-gray-400 hover:text-red-400 hover:bg-red-500/10`} title={`清空全部任务`}>
                <_Component26 size={14} />
              </Component401>
              <Component402 className={`w-px h-3 bg-gray-600 mx-1`} />
              <Component403 onClick={r} className={`text-gray-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors`}>
                <R size={14} />
              </Component403>
            </Component404>
          </Component405>
          {x && <Component430 className={`flex flex-col gap-2 mt-1 animate-fade-in`}>
              <Component408 className={`flex items-center gap-2`}>
                <Component406 type={`text`} placeholder={`搜索提示词或渠道...`} className={`flex-1 bg-[#0d0c0c] border border-[#444] rounded px-2 py-1 text-[11px] text-gray-300 focus:outline-none focus:border-blue-500`} value={h} onChange={e => {
              return g(e.target.value);
            }} />
                <Component407 onClick={() => {
              v(!_);
              b(new Set());
            }} className={`text-[11px] px-2 py-1 rounded transition-colors border ${_ ? `bg-blue-500/20 text-blue-400 border-blue-500/50` : `bg-white/5 text-gray-400 border-transparent hover:bg-white/10`}`}>
                  {_ ? `取消多选` : `批量操作`}
                </Component407>
              </Component408>
              <Component429 className={`flex items-center justify-between gap-2`}>
                <Component420 className={`flex items-center gap-2`}>
                  <Component413 value={u} onChange={e => {
                return d(e.target.value);
              }} className={`bg-[#0d0c0c] text-gray-300 text-[10px] rounded px-1 py-1 border border-[#444] outline-none`}>
                    <Component409 value={`all`}>{`所有状态`}</Component409>
                    <Component410 value={`running`}>{`生成中`}</Component410>
                    <Component411 value={`completed`}>{`已完成`}</Component411>
                    <Component412 value={`failed`}>{`失败`}</Component412>
                  </Component413>
                  <Component419 value={p} onChange={e => {
                return m(e.target.value);
              }} className={`bg-[#0d0c0c] text-gray-300 text-[10px] rounded px-1 py-1 border border-[#444] outline-none`}>
                    <Component414 value={`all`}>{`所有类型`}</Component414>
                    <Component415 value={`image`}>{`生图`}</Component415>
                    <Component416 value={`video`}>{`视频`}</Component416>
                    <Component417 value={`text`}>{`文本`}</Component417>
                    <Component418 value={`custom`}>{`万能`}</Component418>
                  </Component419>
                </Component420>
                <Component428 className={`relative group/clean`}>
                  <Component421 className={`text-[10px] text-gray-400 hover:text-red-400 px-1 py-1 rounded hover:bg-white/5 flex items-center gap-1`}>
                    <_Component26 size={12} />
                    {` 一键清理`}
                  </Component421>
                  <Component427 className={`absolute right-0 top-full pt-1 hidden group-hover/clean:block z-50`}>
                    <Component426 className={`bg-[#1a1a1a] border border-[#333] rounded shadow-xl py-1 w-32`}>
                      <Component422 className={`w-full text-left px-3 py-1.5 text-[10px] text-gray-300 hover:bg-[#333] hover:text-red-400`} onClick={async () => {
                    if (confirm(`确定要清空所有失败的任务吗？`)) {
                      await St([`failed`]);
                      c(e => {
                        return e.filter(e => {
                          return e.status !== `failed`;
                        });
                      });
                      N(e => {
                        return e + 1;
                      });
                      l(`已清理失败任务`);
                    }
                  }}>{`清理失败任务`}</Component422>
                      <Component423 className={`w-full text-left px-3 py-1.5 text-[10px] text-gray-300 hover:bg-[#333] hover:text-red-400`} onClick={async () => {
                    if (confirm(`确定要清空所有已完成的任务吗？（仅移除记录，不删文件）`)) {
                      await St([`completed`]);
                      c(e => {
                        return e.filter(e => {
                          return e.status !== `completed`;
                        });
                      });
                      N(e => {
                        return e + 1;
                      });
                      l(`已清理完成任务`);
                    }
                  }}>{`清理已完成任务`}</Component423>
                      <Component424 className={`border-t border-[#333] my-1`} />
                      <Component425 className={`w-full text-left px-3 py-1.5 text-[10px] text-red-400 hover:bg-[#333] font-bold`} onClick={async () => {
                    if (confirm(`确定要清空所有任务记录吗？（包含进行中）`)) {
                      await St([]);
                      c([]);
                      N(e => {
                        return e + 1;
                      });
                      l(`已清空全部任务`);
                    }
                  }}>{`清空全部任务`}</Component425>
                    </Component426>
                  </Component427>
                </Component428>
              </Component429>
            </Component430>}
        </Component431>
        <Component435 className={`flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar nowheel nopan nodrag relative`} onScroll={e => {
        let t = e.target;
        if (t.scrollHeight - t.scrollTop - t.clientHeight < 50 && !j && z) {
          te(D + 1, false);
        }
      }}>
          {ne.length === 0 ? <Component432 className={`text-center text-gray-500 text-xs py-10 flex flex-col items-center gap-2`}>
              <_Component28 size={24} className={`opacity-20`} />
              {j ? `加载中...` : `没有匹配的任务`}
            </Component432> : ne.map(e => {
          return <Rn task={e} useThumbnail={n} onRefresh={a} onDelete={e => {
            dt(e).catch(e => {
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
          {z && <Component433 className={`text-center py-3 text-[10px] text-gray-500`}>
              <_Component25 size={12} className={`animate-spin mx-auto mb-1`} />
              {`向上滚动加载更多...`}
            </Component433>}
          {re > 0 && !z && <Component434 className={`text-center py-3 text-[10px] text-gray-600`}>
              {`— 已加载全部 `}
              {ie}
              {` 条任务 —`}
            </Component434>}
        </Component435>
        {_ && <Component441 className={`p-3 border-t border-[#333] bg-[#252525] flex justify-between items-center animate-slide-up`}>
            <Component438 className={`flex items-center gap-2`}>
              <Component436 onClick={() => {
            if (y.size === ne.length) {
              b(new Set());
            } else {
              b(new Set(ne.map(e => {
                return e.id;
              })));
            }
          }} className={`text-[11px] text-gray-400 hover:text-white`}>
                {y.size === ne.length ? `取消全选` : `全选`}
              </Component436>
              <Component437 className={`text-[11px] text-gray-500`}>
                {`已选 `}
                {y.size}
                {` 项`}
              </Component437>
            </Component438>
            <Component440 className={`flex gap-2`}>
              <Component439 onClick={async () => {
            if (y.size === 0) {
              return;
            }
            let e = Array.from(y);
            if (confirm(`确定要删除选中的 ${e.length} 个任务吗？`)) {
              await _e(e);
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
                <_Component26 size={12} />
                {`批量删除`}
              </Component439>
            </Component440>
          </Component441>}
      </Component442>;
  } else {
    return null;
  }
}