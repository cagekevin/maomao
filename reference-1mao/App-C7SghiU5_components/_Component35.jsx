// TODO(全局, 无需 import): open, projectId, projectName, existingAppId, onClose, onPublished, nodes, edges, n, x, f, u, encodeURIComponent, t, m, selected, i, d, b, j, l, o, c, ee, label, type, required, p, workflowGraph, appName, description, visibility, appId, w, inputFields
import { e, _, C, T, r, ut, sr, B, Pe, Qn, O, ar, E, M, N, P, g, S, F, a, A, k, We, or, _Component29, R, _Component17, _Component27, _Component7, _Component1, _Component4, D } from './shared.js';
import * as G from 'react';
export default function _Component35({
  open: e,
  projectId: t,
  projectName: n,
  existingAppId: r,
  onClose: i,
  onPublished: a
}) {
  let [o, c] = G.useState(false);
  let [l, u] = G.useState(false);
  let [d, f] = G.useState(``);
  let [p, m] = G.useState({
    nodes: [],
    edges: []
  });
  let [g, _] = G.useState(n);
  let [b, x] = G.useState(``);
  let [S, C] = G.useState(`private`);
  let [w, T] = G.useState(undefined);
  let [E, O] = G.useState([]);
  G.useEffect(() => {
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
      sr(t).then(() => {
        return B.getObject(Pe(t));
      }).then(e => {
        let t = Qn(e);
        m(t);
        O(ar(t));
        u(false);
      }).catch(e => {
        console.error(`[WorkflowAppPublishModal] load graph failed:`, e);
        f(`读取当前画布状态失败，请先保存后再发布`);
        m({
          nodes: [],
          edges: []
        });
        O([]);
        u(false);
      });
    }
  }, [e, t, n, r]);
  let k = G.useMemo(() => {
    return E.filter(e => {
      return e.selected;
    }).length;
  }, [E]);
  let A = (e, t) => {
    O(n => {
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
    O(t => {
      return t.map(t => {
        return {
          ...t,
          selected: e
        };
      });
    });
  };
  let ee = (e, t) => {
    O(n => {
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
  let M = G.useMemo(() => {
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
  let [N, P] = G.useState(new Set());
  G.useEffect(() => {
    if (M.length > 0 && N.size === 0) {
      P(new Set(M.map(([e]) => {
        return e;
      })));
    }
  }, [M]);
  let F = e => {
    P(t => {
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
    const Component443 = `div`;
    const Component444 = `div`;
    const Component445 = `div`;
    const Component446 = `button`;
    const Component447 = `div`;
    const Component448 = `div`;
    const Component449 = `div`;
    const Component450 = `span`;
    const Component451 = `input`;
    const Component452 = `label`;
    const Component453 = `span`;
    const Component454 = `option`;
    const Component455 = `option`;
    const Component456 = `select`;
    const Component457 = `label`;
    const Component458 = `div`;
    const Component459 = `span`;
    const Component460 = `textarea`;
    const Component461 = `label`;
    const Component462 = `div`;
    const Component463 = `div`;
    const Component464 = `div`;
    const Component465 = `div`;
    const Component466 = `button`;
    const Component467 = `button`;
    const Component468 = `div`;
    const Component469 = `div`;
    const Component470 = `div`;
    const Component471 = `div`;
    const Component507 = `div`;
    const Component508 = `div`;
    const Component509 = `div`;
    const Component510 = `div`;
    const Component511 = `span`;
    const Component512 = `span`;
    const Component513 = `div`;
    const Component514 = `span`;
    const Component515 = `span`;
    const Component516 = `div`;
    const Component517 = `span`;
    const Component518 = `span`;
    const Component519 = `div`;
    const Component520 = `span`;
    const Component521 = `span`;
    const Component522 = `div`;
    const Component523 = `span`;
    const Component524 = `span`;
    const Component525 = `div`;
    const Component526 = `div`;
    const Component527 = `div`;
    const Component528 = `div`;
    const Component529 = `li`;
    const Component530 = `li`;
    const Component531 = `li`;
    const Component532 = `ul`;
    const Component533 = `div`;
    const Component534 = `div`;
    const Component535 = `div`;
    const Component536 = `div`;
    const Component537 = `div`;
    const Component538 = `div`;
    const Component539 = `div`;
    const Component540 = `div`;
    const Component541 = `button`;
    const Component542 = `button`;
    const Component543 = `div`;
    const Component544 = `div`;
    const Component545 = `div`;
    const Component546 = `div`;
    return <Component546 className={`fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-3 sm:p-4`}>
        <Component545 className={`w-full max-w-5xl max-h-[calc(100vh-1.5rem)] sm:max-h-[90vh] overflow-hidden rounded-2xl border border-[#333] bg-[#111] shadow-2xl flex flex-col min-h-0`}>
          <Component447 className={`flex items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-4 border-b border-[#2a2a2a] bg-[#151414] flex-shrink-0`}>
            <Component445>
              <Component443 className={`text-white font-bold text-lg flex items-center gap-2`}>
                <_Component29 size={18} />
                {` 发布为应用`}
              </Component443>
              <Component444 className={`text-xs text-gray-400 mt-1`}>{`将当前项目封装为可在AI小站分发的版本`}</Component444>
            </Component445>
            <Component446 onClick={i} className={`text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/5`}>
              <R size={18} />
            </Component446>
          </Component447>
          <Component539 className={`flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-5 custom-scrollbar`}>
            {d && <Component448 className={`rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300`}>
                {d}
              </Component448>}
            <Component538 className={`grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-5 lg:items-start`}>
              <Component509 className={`space-y-4 min-w-0`}>
                <Component462 className={`rounded-2xl border border-[#2a2a2a] bg-[#161616] p-4 min-w-0`}>
                  <Component449 className={`text-sm font-bold text-white mb-3`}>{`应用信息`}</Component449>
                  <Component458 className={`grid grid-cols-1 sm:grid-cols-2 gap-3`}>
                    <Component452 className={`block`}>
                      <Component450 className={`text-xs text-gray-400`}>{`应用名称`}</Component450>
                      <Component451 value={g} onChange={e => {
                      return _(e.target.value);
                    }} className={`mt-1 w-full rounded-lg border border-[#333] bg-[#101010] px-3 py-2 text-sm text-white outline-none focus:border-blue-500`} placeholder={`请输入应用名称`} />
                    </Component452>
                    <Component457 className={`block`}>
                      <Component453 className={`text-xs text-gray-400`}>{`可见性`}</Component453>
                      <Component456 value={S} onChange={e => {
                      return C(e.target.value);
                    }} className={`mt-1 w-full rounded-lg border border-[#333] bg-[#101010] px-3 py-2 text-sm text-white outline-none focus:border-blue-500`}>
                        <Component454 value={`private`}>{`私有`}</Component454>
                        <Component455 value={`public`}>{`公开`}</Component455>
                      </Component456>
                    </Component457>
                  </Component458>
                  <Component461 className={`block mt-3`}>
                    <Component459 className={`text-xs text-gray-400`}>{`应用描述`}</Component459>
                    <Component460 value={b} onChange={e => {
                    return x(e.target.value);
                  }} className={`mt-1 w-full rounded-lg border border-[#333] bg-[#101010] px-3 py-2 text-sm text-white outline-none focus:border-blue-500 min-h-[90px]`} placeholder={`描述这个应用的用途、输入和输出`} />
                  </Component461>
                </Component462>
                <Component508 className={`rounded-2xl border border-[#2a2a2a] bg-[#161616] p-4 min-w-0`}>
                  <Component469 className={`flex items-center justify-between mb-3`}>
                    <Component465>
                      <Component463 className={`text-sm font-bold text-white`}>{`启动参数`}</Component463>
                      <Component464 className={`text-xs text-gray-500 mt-1`}>{`自动识别工作流中的候选参数，支持手动筛选`}</Component464>
                    </Component465>
                    <Component468 className={`flex items-center gap-2 text-xs`}>
                      <Component466 onClick={() => {
                      return j(true);
                    }} className={`px-3 py-1.5 rounded-full bg-[#222] text-gray-200 hover:bg-[#2b2b2b]`}>{`全选`}</Component466>
                      <Component467 onClick={() => {
                      return j(false);
                    }} className={`px-3 py-1.5 rounded-full bg-[#222] text-gray-200 hover:bg-[#2b2b2b]`}>{`全不选`}</Component467>
                    </Component468>
                  </Component469>
                  {l ? <Component470 className={`h-48 flex items-center justify-center text-gray-400 text-sm`}>{`正在读取画布数据…`}</Component470> : E.length === 0 ? <Component471 className={`rounded-xl border border-dashed border-[#333] bg-[#101010] p-4 text-sm text-gray-500`}>{`未识别到可发布参数。你可以先保存画布，或者后续在节点上补充更明确的输入字段标记。`}</Component471> : <Component507 className={`space-y-3 max-h-[42vh] lg:max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar`}>
                      {M.map(([e, t]) => {
                    let n = t[0]?.nodeLabel || e;
                    let r = t[0]?.nodeType || ``;
                    let i = t.every(e => {
                      return e.selected;
                    });
                    let a = t.some(e => {
                      return e.selected;
                    }) && !i;
                    let o = N.has(e);
                    let c = r.includes(`video`) || r.includes(`Video`) ? `🎬` : r.includes(`image`) || r.includes(`Image`) ? `🖼️` : r.includes(`text`) || r.includes(`Text`) ? `📝` : r.includes(`audio`) || r.includes(`Audio`) ? `🎵` : `⚙️`;
                    const Component472 = `span`;
                    const Component473 = `span`;
                    const Component474 = `span`;
                    const Component475 = `div`;
                    const Component476 = `span`;
                    const Component477 = `input`;
                    const Component478 = `div`;
                    const Component479 = `div`;
                    const Component480 = `input`;
                    const Component481 = `span`;
                    const Component482 = `input`;
                    const Component483 = `label`;
                    const Component484 = `span`;
                    const Component485 = `option`;
                    const Component486 = `option`;
                    const Component487 = `option`;
                    const Component488 = `option`;
                    const Component489 = `option`;
                    const Component490 = `option`;
                    const Component491 = `option`;
                    const Component492 = `select`;
                    const Component493 = `label`;
                    const Component494 = `span`;
                    const Component495 = `input`;
                    const Component496 = `span`;
                    const Component497 = `div`;
                    const Component498 = `label`;
                    const Component499 = `div`;
                    const Component500 = `div`;
                    const Component501 = `span`;
                    const Component502 = `span`;
                    const Component503 = `div`;
                    const Component504 = `div`;
                    const Component505 = `div`;
                    const Component506 = `div`;
                    return <Component506 className={`rounded-xl border border-[#2a2a2a] bg-[#101010] overflow-hidden`} key={e}>
                            <Component479 className={`flex items-center gap-3 px-4 py-3 bg-[#141414] cursor-pointer hover:bg-[#181818] transition-colors`} onClick={() => {
                        return F(e);
                      }}>
                              <Component475 className={`flex items-center gap-2 flex-1 min-w-0`}>
                                {o ? <_Component17 size={14} className={`text-gray-400 shrink-0`} /> : <_Component27 size={14} className={`text-gray-400 shrink-0`} />}
                                <Component472 className={`text-base`}>{c}</Component472>
                                <Component473 className={`text-sm font-medium text-white truncate`}>
                                  {n}
                                </Component473>
                                <Component474 className={`text-xs text-gray-500 shrink-0`}>
                                  {`(`}
                                  {t.length}
                                  {` 个参数)`}
                                </Component474>
                              </Component475>
                              <Component478 className={`flex items-center gap-2 shrink-0`}>
                                <Component476 className={`text-xs text-gray-400`}>
                                  {t.filter(e => {
                              return e.selected;
                            }).length}
                                  {`/`}
                                  {t.length}
                                  {` 已选`}
                                </Component476>
                                <Component477 type={`checkbox`} checked={i} ref={e => {
                            if (e) {
                              e.indeterminate = a;
                            }
                          }} onChange={t => {
                            return ee(e, t.target.checked);
                          }} onClick={e => {
                            return e.stopPropagation();
                          }} className={`h-4 w-4 accent-blue-500`} />
                              </Component478>
                            </Component479>
                            {o && <Component505 className={`divide-y divide-[#222]`}>
                                {t.map(e => {
                          return <Component504 className={`px-4 py-3`} key={e.id}>
                                      <Component500 className={`flex items-start gap-3`}>
                                        <Component480 type={`checkbox`} checked={e.selected} onChange={t => {
                                return A(e.id, {
                                  selected: t.target.checked
                                });
                              }} className={`mt-1 h-4 w-4 accent-blue-500`} />
                                        <Component499 className={`flex-1 grid grid-cols-1 sm:grid-cols-[1.2fr_0.6fr_0.8fr] gap-3`}>
                                          <Component483 className={`block`}>
                                            <Component481 className={`text-xs text-gray-500`}>{`显示名`}</Component481>
                                            <Component482 value={e.label} onChange={t => {
                                    return A(e.id, {
                                      label: t.target.value
                                    });
                                  }} className={`mt-1 w-full rounded-lg border border-[#333] bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-blue-500`} />
                                          </Component483>
                                          <Component493 className={`block`}>
                                            <Component484 className={`text-xs text-gray-500`}>{`类型`}</Component484>
                                            <Component492 value={e.type} onChange={t => {
                                    return A(e.id, {
                                      type: t.target.value
                                    });
                                  }} className={`mt-1 w-full rounded-lg border border-[#333] bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-blue-500`}>
                                              <Component485 value={`text`}>{`文本`}</Component485>
                                              <Component486 value={`number`}>{`数字`}</Component486>
                                              <Component487 value={`boolean`}>{`开关`}</Component487>
                                              <Component488 value={`image`}>{`图片`}</Component488>
                                              <Component489 value={`video`}>{`视频`}</Component489>
                                              <Component490 value={`audio`}>{`音频`}</Component490>
                                              <Component491 value={`json`}>{`JSON`}</Component491>
                                            </Component492>
                                          </Component493>
                                          <Component498 className={`block`}>
                                            <Component494 className={`text-xs text-gray-500`}>{`必填`}</Component494>
                                            <Component497 className={`mt-2 flex items-center gap-2 rounded-lg border border-[#333] bg-[#151515] px-3 py-2`}>
                                              <Component495 type={`checkbox`} checked={e.required} onChange={t => {
                                      return A(e.id, {
                                        required: t.target.checked
                                      });
                                    }} className={`h-4 w-4 accent-blue-500`} />
                                              <Component496 className={`text-sm text-gray-300`}>
                                                {e.required ? `是` : `否`}
                                              </Component496>
                                            </Component497>
                                          </Component498>
                                        </Component499>
                                      </Component500>
                                      <Component503 className={`mt-2 text-[11px] text-gray-500 flex items-center gap-3 flex-wrap`}>
                                        <Component501 className={`inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1`}>
                                          <_Component7 size={11} />
                                          {` `}
                                          {e.key}
                                        </Component501>
                                        <Component502 className={`inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1`}>
                                          <_Component1 size={11} />
                                          {` `}
                                          {e.sourcePath}
                                        </Component502>
                                      </Component503>
                                    </Component504>;
                        })}
                              </Component505>}
                          </Component506>;
                  })}
                    </Component507>}
                </Component508>
              </Component509>
              <Component537 className={`space-y-4 min-w-0`}>
                <Component527 className={`rounded-2xl border border-[#2a2a2a] bg-[#161616] p-4 min-w-0`}>
                  <Component510 className={`text-sm font-bold text-white mb-2`}>{`发布前检查`}</Component510>
                  <Component526 className={`space-y-2 text-sm text-gray-300`}>
                    <Component513 className={`flex justify-between gap-4`}>
                      <Component511>{`项目`}</Component511>
                      <Component512 className={`text-white truncate`}>{n}</Component512>
                    </Component513>
                    <Component516 className={`flex justify-between gap-4`}>
                      <Component514>{`节点数`}</Component514>
                      <Component515 className={`text-white`}>{p?.nodes?.length || 0}</Component515>
                    </Component516>
                    <Component519 className={`flex justify-between gap-4`}>
                      <Component517>{`边数`}</Component517>
                      <Component518 className={`text-white`}>{p?.edges?.length || 0}</Component518>
                    </Component519>
                    <Component522 className={`flex justify-between gap-4`}>
                      <Component520>{`已选参数`}</Component520>
                      <Component521 className={`text-white`}>{k}</Component521>
                    </Component522>
                    <Component525 className={`flex justify-between gap-4`}>
                      <Component523>{`应用地址`}</Component523>
                      <Component524 className={`text-white truncate`}>
                        {window.location.origin}
                        {`/apps/<appId>`}
                      </Component524>
                    </Component525>
                  </Component526>
                </Component527>
                <Component533 className={`rounded-2xl border border-[#2a2a2a] bg-[#161616] p-4 min-w-0`}>
                  <Component528 className={`text-sm font-bold text-white mb-2`}>{`发布说明`}</Component528>
                  <Component532 className={`space-y-2 text-sm text-gray-400 leading-6`}>
                    <Component529>{`• 发布后会创建一个新的应用版本快照。`}</Component529>
                    <Component530>{`• 公开应用会显示在应用中心，私有应用仅作者和许可证用户可访问。`}</Component530>
                    <Component531>{`• 运行页会通过服务端代理执行，不会暴露作者的模型凭证。`}</Component531>
                  </Component532>
                </Component533>
                <Component536 className={`rounded-2xl border border-[#2a2a2a] bg-[#161616] p-4 min-w-0`}>
                  <Component534 className={`text-sm font-bold text-white mb-2`}>{`提示`}</Component534>
                  <Component535 className={`text-sm text-gray-400 leading-6`}>{`如果你的工作流有多个入口参数，建议先把真正想暴露给外部用户的字段勾选出来，再发布为应用。`}</Component535>
                </Component536>
              </Component537>
            </Component538>
          </Component539>
          <Component544 className={`border-t border-[#2a2a2a] bg-[#151414] px-4 sm:px-5 py-4 flex items-center justify-between gap-3 flex-shrink-0`}>
            <Component540 className={`text-xs text-gray-500 flex items-center gap-2`}>
              {l ? <_Component4 size={12} className={`animate-spin`} /> : <D size={12} />}
              {k}
              {` 个参数将被发布`}
            </Component540>
            <Component543 className={`flex items-center gap-2`}>
              <Component541 onClick={i} className={`px-4 py-2 rounded-lg border border-[#333] text-gray-300 hover:bg-white/5`}>{`取消`}</Component541>
              <Component542 onClick={async () => {
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
                let e = await We(`/workflow-apps/publish`, or({
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
                {o ? <_Component4 size={14} className={`animate-spin`} /> : <_Component29 size={14} />}
                {w ? `更新发布` : `立即发布`}
              </Component542>
            </Component543>
          </Component544>
        </Component545>
      </Component546>;
  } else {
    return null;
  }
}