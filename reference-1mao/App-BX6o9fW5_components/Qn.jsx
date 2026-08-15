// TODO(全局, 无需 import): open, projectId, projectName, existingAppId, onClose, onPublished, nodes, edges, n, x, f, u, encodeURIComponent, t, m, selected, ee, i, d, b, j, l, o, c, label, type, required, p, k, workflowGraph, appName, description, visibility, appId, w, inputFields
import { e, _, C, T, r, ut, Zn, z, He, qn, D, Yn, E, N, P, g, S, F, a, M, A, Ge, Xn, _Component31, R, _Component16, _Component29, _Component6, _Component1, _Component3, O } from './shared.js';
import * as W from 'react';
export default function Qn({
  open: e,
  projectId: t,
  projectName: n,
  existingAppId: r,
  onClose: i,
  onPublished: a
}) {
  let [o, c] = W.useState(false);
  let [l, u] = W.useState(false);
  let [d, f] = W.useState(``);
  let [p, m] = W.useState({
    nodes: [],
    edges: []
  });
  let [g, _] = W.useState(n);
  let [b, x] = W.useState(``);
  let [S, C] = W.useState(`private`);
  let [w, T] = W.useState(undefined);
  let [E, D] = W.useState([]);
  W.useEffect(() => {
    if (e) {
      _(n);
      x(``);
      C(`private`);
      T(r);
      f(``);
      u(true);
      if (r) {
        ut(`/workflow-apps/${encodeURIComponent(r)}`).then(e => {
          let t = e?.data;
          let n = t?.data ?? t;
          if (e.success && n) {
            if (n.appName) {
              _(n.appName);
            }
            if (n.description) {
              x(n.description);
            }
            if (n.visibility) {
              C(n.visibility);
            }
          }
        }).catch(() => {});
      }
      Zn(t).then(() => {
        return z.getObject(He(t));
      }).then(e => {
        let t = qn(e);
        m(t);
        D(Yn(t));
        u(false);
      }).catch(e => {
        console.error(`[WorkflowAppPublishModal] load graph failed:`, e);
        f(`读取当前画布状态失败，请先保存后再发布`);
        m({
          nodes: [],
          edges: []
        });
        D([]);
        u(false);
      });
    }
  }, [e, t, n, r]);
  let k = W.useMemo(() => {
    return E.filter(e => {
      return e.selected;
    }).length;
  }, [E]);
  let A = (e, t) => {
    D(n => {
      return n.map(n => {
        if (n.id === e) {
          return {
            ...n,
            ...t
          };
        } else {
          return n;
        }
      });
    });
  };
  let j = e => {
    D(t => {
      return t.map(t => {
        return {
          ...t,
          selected: e
        };
      });
    });
  };
  let M = (e, t) => {
    D(n => {
      return n.map(n => {
        if (n.nodeId === e) {
          return {
            ...n,
            selected: t
          };
        } else {
          return n;
        }
      });
    });
  };
  let N = W.useMemo(() => {
    let e = new Map();
    for (let t of E) {
      let n = t.nodeId;
      if (!e.has(n)) {
        e.set(n, []);
      }
      e.get(n).push(t);
    }
    return Array.from(e.entries());
  }, [E]);
  let [P, ee] = W.useState(new Set());
  W.useEffect(() => {
    if (N.length > 0 && P.size === 0) {
      ee(new Set(N.map(([e]) => {
        return e;
      })));
    }
  }, [N]);
  let F = e => {
    ee(t => {
      let n = new Set(t);
      if (n.has(e)) {
        n.delete(e);
      } else {
        n.add(e);
      }
      return n;
    });
  };
  if (e) {
    const Component441 = `div`;
    const Component442 = `div`;
    const Component443 = `div`;
    const Component444 = `button`;
    const Component445 = `div`;
    const Component446 = `div`;
    const Component447 = `div`;
    const Component448 = `span`;
    const Component449 = `input`;
    const Component450 = `label`;
    const Component451 = `span`;
    const Component452 = `option`;
    const Component453 = `option`;
    const Component454 = `select`;
    const Component455 = `label`;
    const Component456 = `div`;
    const Component457 = `span`;
    const Component458 = `textarea`;
    const Component459 = `label`;
    const Component460 = `div`;
    const Component461 = `div`;
    const Component462 = `div`;
    const Component463 = `div`;
    const Component464 = `button`;
    const Component465 = `button`;
    const Component466 = `div`;
    const Component467 = `div`;
    const Component468 = `div`;
    const Component469 = `div`;
    const Component505 = `div`;
    const Component506 = `div`;
    const Component507 = `div`;
    const Component508 = `div`;
    const Component509 = `span`;
    const Component510 = `span`;
    const Component511 = `div`;
    const Component512 = `span`;
    const Component513 = `span`;
    const Component514 = `div`;
    const Component515 = `span`;
    const Component516 = `span`;
    const Component517 = `div`;
    const Component518 = `span`;
    const Component519 = `span`;
    const Component520 = `div`;
    const Component521 = `span`;
    const Component522 = `span`;
    const Component523 = `div`;
    const Component524 = `div`;
    const Component525 = `div`;
    const Component526 = `div`;
    const Component527 = `li`;
    const Component528 = `li`;
    const Component529 = `li`;
    const Component530 = `ul`;
    const Component531 = `div`;
    const Component532 = `div`;
    const Component533 = `div`;
    const Component534 = `div`;
    const Component535 = `div`;
    const Component536 = `div`;
    const Component537 = `div`;
    const Component538 = `div`;
    const Component539 = `button`;
    const Component540 = `button`;
    const Component541 = `div`;
    const Component542 = `div`;
    const Component543 = `div`;
    const Component544 = `div`;
    return <Component544 className={`fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4`}>
        <Component543 className={`w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border border-[#333] bg-[#111] shadow-2xl flex flex-col`}>
          <Component445 className={`flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a] bg-[#151414]`}>
            <Component443>
              <Component441 className={`text-white font-bold text-lg flex items-center gap-2`}>
                <_Component31 size={18} />
                {` 发布为应用`}
              </Component441>
              <Component442 className={`text-xs text-gray-400 mt-1`}>{`将当前项目封装为可在AI小站分发的版本`}</Component442>
            </Component443>
            <Component444 onClick={i} className={`text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/5`}>
              <R size={18} />
            </Component444>
          </Component445>
          <Component537 className={`flex-1 overflow-y-auto p-5 space-y-5`}>
            {d && <Component446 className={`rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300`}>
                {d}
              </Component446>}
            <Component536 className={`grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-5`}>
              <Component507 className={`space-y-4`}>
                <Component460 className={`rounded-2xl border border-[#2a2a2a] bg-[#161616] p-4`}>
                  <Component447 className={`text-sm font-bold text-white mb-3`}>{`应用信息`}</Component447>
                  <Component456 className={`grid grid-cols-1 md:grid-cols-2 gap-3`}>
                    <Component450 className={`block`}>
                      <Component448 className={`text-xs text-gray-400`}>{`应用名称`}</Component448>
                      <Component449 value={g} onChange={e => {
                      return _(e.target.value);
                    }} className={`mt-1 w-full rounded-lg border border-[#333] bg-[#101010] px-3 py-2 text-sm text-white outline-none focus:border-blue-500`} placeholder={`请输入应用名称`} />
                    </Component450>
                    <Component455 className={`block`}>
                      <Component451 className={`text-xs text-gray-400`}>{`可见性`}</Component451>
                      <Component454 value={S} onChange={e => {
                      return C(e.target.value);
                    }} className={`mt-1 w-full rounded-lg border border-[#333] bg-[#101010] px-3 py-2 text-sm text-white outline-none focus:border-blue-500`}>
                        <Component452 value={`private`}>{`私有`}</Component452>
                        <Component453 value={`public`}>{`公开`}</Component453>
                      </Component454>
                    </Component455>
                  </Component456>
                  <Component459 className={`block mt-3`}>
                    <Component457 className={`text-xs text-gray-400`}>{`应用描述`}</Component457>
                    <Component458 value={b} onChange={e => {
                    return x(e.target.value);
                  }} className={`mt-1 w-full rounded-lg border border-[#333] bg-[#101010] px-3 py-2 text-sm text-white outline-none focus:border-blue-500 min-h-[90px]`} placeholder={`描述这个应用的用途、输入和输出`} />
                  </Component459>
                </Component460>
                <Component506 className={`rounded-2xl border border-[#2a2a2a] bg-[#161616] p-4`}>
                  <Component467 className={`flex items-center justify-between mb-3`}>
                    <Component463>
                      <Component461 className={`text-sm font-bold text-white`}>{`启动参数`}</Component461>
                      <Component462 className={`text-xs text-gray-500 mt-1`}>{`自动识别工作流中的候选参数，支持手动筛选`}</Component462>
                    </Component463>
                    <Component466 className={`flex items-center gap-2 text-xs`}>
                      <Component464 onClick={() => {
                      return j(true);
                    }} className={`px-3 py-1.5 rounded-full bg-[#222] text-gray-200 hover:bg-[#2b2b2b]`}>{`全选`}</Component464>
                      <Component465 onClick={() => {
                      return j(false);
                    }} className={`px-3 py-1.5 rounded-full bg-[#222] text-gray-200 hover:bg-[#2b2b2b]`}>{`全不选`}</Component465>
                    </Component466>
                  </Component467>
                  {l ? <Component468 className={`h-48 flex items-center justify-center text-gray-400 text-sm`}>{`正在读取画布数据…`}</Component468> : E.length === 0 ? <Component469 className={`rounded-xl border border-dashed border-[#333] bg-[#101010] p-4 text-sm text-gray-500`}>{`未识别到可发布参数。你可以先保存画布，或者后续在节点上补充更明确的输入字段标记。`}</Component469> : <Component505 className={`space-y-3 max-h-[50vh] overflow-y-auto pr-1`}>
                      {N.map(([e, t]) => {
                    let n = t[0]?.nodeLabel || e;
                    let r = t[0]?.nodeType || ``;
                    let i = t.every(e => {
                      return e.selected;
                    });
                    let a = t.some(e => {
                      return e.selected;
                    }) && !i;
                    let o = P.has(e);
                    let c = r.includes(`video`) || r.includes(`Video`) ? `🎬` : r.includes(`image`) || r.includes(`Image`) ? `🖼️` : r.includes(`text`) || r.includes(`Text`) ? `📝` : r.includes(`audio`) || r.includes(`Audio`) ? `🎵` : `⚙️`;
                    const Component470 = `span`;
                    const Component471 = `span`;
                    const Component472 = `span`;
                    const Component473 = `div`;
                    const Component474 = `span`;
                    const Component475 = `input`;
                    const Component476 = `div`;
                    const Component477 = `div`;
                    const Component478 = `input`;
                    const Component479 = `span`;
                    const Component480 = `input`;
                    const Component481 = `label`;
                    const Component482 = `span`;
                    const Component483 = `option`;
                    const Component484 = `option`;
                    const Component485 = `option`;
                    const Component486 = `option`;
                    const Component487 = `option`;
                    const Component488 = `option`;
                    const Component489 = `option`;
                    const Component490 = `select`;
                    const Component491 = `label`;
                    const Component492 = `span`;
                    const Component493 = `input`;
                    const Component494 = `span`;
                    const Component495 = `div`;
                    const Component496 = `label`;
                    const Component497 = `div`;
                    const Component498 = `div`;
                    const Component499 = `span`;
                    const Component500 = `span`;
                    const Component501 = `div`;
                    const Component502 = `div`;
                    const Component503 = `div`;
                    const Component504 = `div`;
                    return <Component504 className={`rounded-xl border border-[#2a2a2a] bg-[#101010] overflow-hidden`} key={e}>
                            <Component477 className={`flex items-center gap-3 px-4 py-3 bg-[#141414] cursor-pointer hover:bg-[#181818] transition-colors`} onClick={() => {
                        return F(e);
                      }}>
                              <Component473 className={`flex items-center gap-2 flex-1 min-w-0`}>
                                {o ? <_Component16 size={14} className={`text-gray-400 shrink-0`} /> : <_Component29 size={14} className={`text-gray-400 shrink-0`} />}
                                <Component470 className={`text-base`}>{c}</Component470>
                                <Component471 className={`text-sm font-medium text-white truncate`}>
                                  {n}
                                </Component471>
                                <Component472 className={`text-xs text-gray-500 shrink-0`}>
                                  {`(`}
                                  {t.length}
                                  {` 个参数)`}
                                </Component472>
                              </Component473>
                              <Component476 className={`flex items-center gap-2 shrink-0`}>
                                <Component474 className={`text-xs text-gray-400`}>
                                  {t.filter(e => {
                              return e.selected;
                            }).length}
                                  {`/`}
                                  {t.length}
                                  {` 已选`}
                                </Component474>
                                <Component475 type={`checkbox`} checked={i} ref={e => {
                            if (e) {
                              e.indeterminate = a;
                            }
                          }} onChange={t => {
                            return M(e, t.target.checked);
                          }} onClick={e => {
                            return e.stopPropagation();
                          }} className={`h-4 w-4 accent-blue-500`} />
                              </Component476>
                            </Component477>
                            {o && <Component503 className={`divide-y divide-[#222]`}>
                                {t.map(e => {
                          return <Component502 className={`px-4 py-3`} key={e.id}>
                                      <Component498 className={`flex items-start gap-3`}>
                                        <Component478 type={`checkbox`} checked={e.selected} onChange={t => {
                                return A(e.id, {
                                  selected: t.target.checked
                                });
                              }} className={`mt-1 h-4 w-4 accent-blue-500`} />
                                        <Component497 className={`flex-1 grid grid-cols-1 md:grid-cols-[1.2fr_0.6fr_0.8fr] gap-3`}>
                                          <Component481 className={`block`}>
                                            <Component479 className={`text-xs text-gray-500`}>{`显示名`}</Component479>
                                            <Component480 value={e.label} onChange={t => {
                                    return A(e.id, {
                                      label: t.target.value
                                    });
                                  }} className={`mt-1 w-full rounded-lg border border-[#333] bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-blue-500`} />
                                          </Component481>
                                          <Component491 className={`block`}>
                                            <Component482 className={`text-xs text-gray-500`}>{`类型`}</Component482>
                                            <Component490 value={e.type} onChange={t => {
                                    return A(e.id, {
                                      type: t.target.value
                                    });
                                  }} className={`mt-1 w-full rounded-lg border border-[#333] bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-blue-500`}>
                                              <Component483 value={`text`}>{`文本`}</Component483>
                                              <Component484 value={`number`}>{`数字`}</Component484>
                                              <Component485 value={`boolean`}>{`开关`}</Component485>
                                              <Component486 value={`image`}>{`图片`}</Component486>
                                              <Component487 value={`video`}>{`视频`}</Component487>
                                              <Component488 value={`audio`}>{`音频`}</Component488>
                                              <Component489 value={`json`}>{`JSON`}</Component489>
                                            </Component490>
                                          </Component491>
                                          <Component496 className={`block`}>
                                            <Component492 className={`text-xs text-gray-500`}>{`必填`}</Component492>
                                            <Component495 className={`mt-2 flex items-center gap-2 rounded-lg border border-[#333] bg-[#151515] px-3 py-2`}>
                                              <Component493 type={`checkbox`} checked={e.required} onChange={t => {
                                      return A(e.id, {
                                        required: t.target.checked
                                      });
                                    }} className={`h-4 w-4 accent-blue-500`} />
                                              <Component494 className={`text-sm text-gray-300`}>
                                                {e.required ? `是` : `否`}
                                              </Component494>
                                            </Component495>
                                          </Component496>
                                        </Component497>
                                      </Component498>
                                      <Component501 className={`mt-2 text-[11px] text-gray-500 flex items-center gap-3 flex-wrap`}>
                                        <Component499 className={`inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1`}>
                                          <_Component6 size={11} />
                                          {` `}
                                          {e.key}
                                        </Component499>
                                        <Component500 className={`inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1`}>
                                          <_Component1 size={11} />
                                          {` `}
                                          {e.sourcePath}
                                        </Component500>
                                      </Component501>
                                    </Component502>;
                        })}
                              </Component503>}
                          </Component504>;
                  })}
                    </Component505>}
                </Component506>
              </Component507>
              <Component535 className={`space-y-4`}>
                <Component525 className={`rounded-2xl border border-[#2a2a2a] bg-[#161616] p-4`}>
                  <Component508 className={`text-sm font-bold text-white mb-2`}>{`发布前检查`}</Component508>
                  <Component524 className={`space-y-2 text-sm text-gray-300`}>
                    <Component511 className={`flex justify-between gap-4`}>
                      <Component509>{`项目`}</Component509>
                      <Component510 className={`text-white truncate`}>{n}</Component510>
                    </Component511>
                    <Component514 className={`flex justify-between gap-4`}>
                      <Component512>{`节点数`}</Component512>
                      <Component513 className={`text-white`}>{p?.nodes?.length || 0}</Component513>
                    </Component514>
                    <Component517 className={`flex justify-between gap-4`}>
                      <Component515>{`边数`}</Component515>
                      <Component516 className={`text-white`}>{p?.edges?.length || 0}</Component516>
                    </Component517>
                    <Component520 className={`flex justify-between gap-4`}>
                      <Component518>{`已选参数`}</Component518>
                      <Component519 className={`text-white`}>{k}</Component519>
                    </Component520>
                    <Component523 className={`flex justify-between gap-4`}>
                      <Component521>{`应用地址`}</Component521>
                      <Component522 className={`text-white truncate`}>
                        {window.location.origin}
                        {`/apps/<appId>`}
                      </Component522>
                    </Component523>
                  </Component524>
                </Component525>
                <Component531 className={`rounded-2xl border border-[#2a2a2a] bg-[#161616] p-4`}>
                  <Component526 className={`text-sm font-bold text-white mb-2`}>{`发布说明`}</Component526>
                  <Component530 className={`space-y-2 text-sm text-gray-400 leading-6`}>
                    <Component527>{`• 发布后会创建一个新的应用版本快照。`}</Component527>
                    <Component528>{`• 公开应用会显示在应用中心，私有应用仅作者和许可证用户可访问。`}</Component528>
                    <Component529>{`• 运行页会通过服务端代理执行，不会暴露作者的模型凭证。`}</Component529>
                  </Component530>
                </Component531>
                <Component534 className={`rounded-2xl border border-[#2a2a2a] bg-[#161616] p-4`}>
                  <Component532 className={`text-sm font-bold text-white mb-2`}>{`提示`}</Component532>
                  <Component533 className={`text-sm text-gray-400 leading-6`}>{`如果你的工作流有多个入口参数，建议先把真正想暴露给外部用户的字段勾选出来，再发布为应用。`}</Component533>
                </Component534>
              </Component535>
            </Component536>
          </Component537>
          <Component542 className={`border-t border-[#2a2a2a] bg-[#151414] px-5 py-4 flex items-center justify-between gap-3`}>
            <Component538 className={`text-xs text-gray-500 flex items-center gap-2`}>
              {l ? <_Component3 size={12} className={`animate-spin`} /> : <O size={12} />}
              {k}
              {` 个参数将被发布`}
            </Component538>
            <Component541 className={`flex items-center gap-2`}>
              <Component539 onClick={i} className={`px-4 py-2 rounded-lg border border-[#333] text-gray-300 hover:bg-white/5`}>{`取消`}</Component539>
              <Component540 onClick={async () => {
              if (!g.trim()) {
                f(`请输入应用名称`);
                return;
              }
              if (!p || !Array.isArray(p.nodes) || p.nodes.length === 0) {
                f(`当前画布没有可发布的节点`);
                return;
              }
              if (k === 0) {
                f(`请至少选择一个启动参数`);
                return;
              }
              c(true);
              f(``);
              try {
                let e = await Ge(`/workflow-apps/publish`, Xn({
                  projectId: t,
                  projectName: n,
                  workflowGraph: p,
                  appName: g,
                  description: b,
                  visibility: S,
                  appId: w,
                  inputFields: E
                }));
                if (!e.success) {
                  throw Error(e.error || `发布失败`);
                }
                let r = e.data;
                let i = r?.data ?? r;
                if (!i) {
                  throw Error(r?.error || `发布失败`);
                }
                T(i.app?.appId || i.appId);
                a?.(i);
              } catch (e) {
                f(e?.message || `发布失败`);
              } finally {
                c(false);
              }
            }} disabled={o || l} className={`px-5 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50 flex items-center gap-2`}>
                {o ? <_Component3 size={14} className={`animate-spin`} /> : <_Component31 size={14} />}
                {w ? `更新发布` : `立即发布`}
              </Component540>
            </Component541>
          </Component542>
        </Component543>
      </Component544>;
  } else {
    return null;
  }
}