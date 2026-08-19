// TODO(全局, 无需 import): agentKey, projectId, canvasHandleRef, open, onClose, defaultModel, onGoMembership, onWidthChange, onEnabledChange, x, w, t, b, n, s, u, messages, sending, error, model, setModel, send, stop, clear, systemPrompt, ae, ne, id, name, power, unit, currency, h, p, d, c, se, le, ce, behavior, ue, v, alert, type, url, y, re, i, localUrl, width, confirm, f, o, animationDelay, te, de, minHeight, maxHeight, m, oe, ee, z, ie
import _cmp_Nr from './Nr.jsx';
import { Sr, kr, E, T, C, Tr, wr, Or, r, S, Ar, Dr, a, xr, N, P, L, Be, ye, Te, Fe, hr, _, Tt, je, ht, De, F, I, D, O, A, M, R, k, pe, g, Ne, fe, _Component31, _Component14 } from './shared.js';
import * as _shared from './shared.js';
import * as G from 'react';
import * as K from 'react';
export default function _Component38({
  agentKey: e = Sr,
  projectId: t,
  canvasHandleRef: n,
  open: r,
  onClose: i,
  defaultModel: a = `gpt-4o-mini`,
  onGoMembership: o,
  onWidthChange: s,
  onEnabledChange: c
}) {
  let [u, d] = G.useState(null);
  let [f, p] = G.useState(true);
  let [m, h] = G.useState([]);
  let [g, _] = G.useState(false);
  let [v, y] = G.useState(``);
  let [b, x] = G.useState(() => {
    return kr(e);
  });
  let [S, C] = G.useState(false);
  let [w, T] = G.useState(false);
  let E = G.useRef(null);
  let [D, O] = G.useState([]);
  let [k, A] = G.useState(false);
  let ee = G.useRef(null);
  G.useEffect(() => {
    x(kr(e));
  }, [e]);
  G.useEffect(() => {
    if (!w) {
      return;
    }
    let e = e => {
      if (E.current && !E.current.contains(e.target)) {
        T(false);
      }
    };
    document.addEventListener(`mousedown`, e);
    return () => {
      return document.removeEventListener(`mousedown`, e);
    };
  }, [w]);
  let M = t => {
    t.preventDefault();
    C(true);
    let n = e => {
      let t = window.innerWidth - e.clientX;
      x(Math.min(Tr, Math.max(wr, t)));
    };
    let r = () => {
      C(false);
      localStorage.setItem(Or(e), String(b));
      document.removeEventListener(`mousemove`, n);
      document.removeEventListener(`mouseup`, r);
    };
    document.addEventListener(`mousemove`, n);
    document.addEventListener(`mouseup`, r);
  };
  G.useEffect(() => {
    if (!S) {
      localStorage.setItem(Or(e), String(b));
    }
  }, [S, b, e]);
  G.useEffect(() => {
    if (r) {
      s?.(b);
    }
  }, [r, b, s]);
  G.useEffect(() => {
    if (!r) {
      s?.(0);
    }
  }, [r, s]);
  let N = G.useMemo(() => {
    return Ar(e) || localStorage.getItem(Dr(e)) || u?.defaultModel || a;
  }, [u?.defaultModel, a, e]);
  let P = u?.systemPrompt;
  let {
    messages: F,
    sending: I,
    error: te,
    model: L,
    setModel: ne,
    send: re,
    stop: ie,
    clear: R
  } = xr({
    agentKey: e,
    projectId: t,
    canvasHandleRef: n,
    defaultModel: N,
    systemPrompt: P
  });
  let z = G.useMemo(() => {
    if (!u?.visionModels || u.visionModels.length === 0) {
      return false;
    } else {
      return u.visionModels.includes(L);
    }
  }, [u?.visionModels, L]);
  let ae = G.useRef(false);
  let oe = t => {
    ae.current = true;
    ne(t);
    localStorage.setItem(Dr(e), t);
  };
  let se = G.useCallback(() => {
    let e = Be().filter(e => {
      return (e.builtinCategory || e.category) === `text` && e.isBuiltin;
    }).map(e => {
      return e.modelName;
    }).map(e => {
      return {
        id: e,
        name: e,
        power: ye(e),
        unit: Te(e) || undefined,
        currency: Fe(e)
      };
    });
    h(e);
    ne(t => {
      if (e.length > 0 && !e.find(e => {
        return e.id === t;
      })) {
        return e[0].id;
      } else {
        return t;
      }
    });
  }, []);
  G.useEffect(() => {
    if (!r) {
      return;
    }
    let t = false;
    (async () => {
      p(true);
      let n = await hr(e);
      d(n);
      p(false);
      c?.(n.enabled !== false);
      if (!t && n.allowed) {
        _(true);
        let e = Tt();
        if (e) {
          await je(ht(``), e);
        }
        if (t) {
          return;
        }
        se();
        _(false);
      }
    })();
    return () => {
      t = true;
    };
  }, [r, e, se, c]);
  G.useEffect(() => {
    if (r) {
      return De(() => {
        se();
      });
    }
  }, [r, se]);
  let ce = G.useRef(null);
  let le = F[F.length - 1];
  let ue = le ? (le.content?.length ?? 0) + (le.reasoning?.length ?? 0) : 0;
  G.useEffect(() => {
    ce.current?.scrollTo({
      top: ce.current.scrollHeight,
      behavior: `smooth`
    });
  }, [F.length, I, ue]);
  let de = () => {
    let e = v.trim();
    if (!e && D.length === 0 || I) {
      return;
    }
    if (D.length > 0 && !z) {
      let e = u?.visionModels && u.visionModels.length > 0 ? u.visionModels[0] : `视觉模型`;
      alert(`当前模型 ${L} 不支持视觉，请切换到 ${e} 等视觉模型后再发送`);
      return;
    }
    let t = D.length > 0 ? D.map(({
      type: e,
      url: t
    }) => {
      return {
        type: e,
        url: t
      };
    }) : undefined;
    O([]);
    y(``);
    Promise.resolve(re(e, t)).catch(e => {
      console.error(`[Agent] send 失败:`, e);
    });
  };
  let fe = async e => {
    let t = e.target.files;
    if (!t || t.length === 0) {
      return;
    }
    if (!z) {
      let t = u?.visionModels && u.visionModels.length > 0 ? u.visionModels[0] : `视觉模型`;
      alert(`当前模型 ${L} 不支持视觉，请先切换到 ${t} 等视觉模型`);
      e.target.value = ``;
      return;
    }
    let r = n.current;
    if (!r?.uploadAsset) {
      alert(`上传通道未就绪，请稍后再试`);
      e.target.value = ``;
      return;
    }
    A(true);
    try {
      for (let e = 0; e < t.length; e++) {
        let n = t[e];
        if (!n.type.startsWith(`image/`)) {
          continue;
        }
        let i = URL.createObjectURL(n);
        try {
          let t = await r.uploadAsset(i, `image`, D.length + e);
          if (!t) {
            alert(`图片上传失败：网关未返回 URL`);
            URL.revokeObjectURL(i);
            continue;
          }
          O(e => {
            return [...e, {
              type: `image`,
              url: t,
              localUrl: i
            }];
          });
        } catch (e) {
          console.error(`[Agent] 图片上传失败:`, e);
          let t = e instanceof Error ? e.message : String(e);
          alert(`图片上传失败：${t}`);
          URL.revokeObjectURL(i);
        }
      }
    } finally {
      A(false);
      e.target.value = ``;
    }
  };
  let pe = e => {
    O(t => {
      let n = t[e];
      if (n?.localUrl) {
        URL.revokeObjectURL(n.localUrl);
      }
      return t.filter((t, n) => {
        return n !== e;
      });
    });
  };
  if (r) {
    const Component582 = `div`;
    const Component583 = `div`;
    const Component584 = `div`;
    const Component585 = `div`;
    const Component586 = `div`;
    const Component587 = `div`;
    const Component588 = `polyline`;
    const Component589 = `path`;
    const Component590 = `svg`;
    const Component591 = `button`;
    const Component592 = `line`;
    const Component593 = `line`;
    const Component594 = `svg`;
    const Component595 = `button`;
    const Component596 = `div`;
    const Component597 = `div`;
    const Component598 = `div`;
    const Component599 = `div`;
    const Component600 = `circle`;
    const Component601 = `line`;
    const Component602 = `svg`;
    const Component603 = `div`;
    const Component604 = `div`;
    const Component605 = `div`;
    const Component606 = `div`;
    const Component607 = `polygon`;
    const Component608 = `svg`;
    const Component609 = `div`;
    const Component610 = `div`;
    const Component611 = `div`;
    const Component612 = `button`;
    const Component613 = `div`;
    const Component614 = `div`;
    const Component615 = `div`;
    const Component616 = `div`;
    const Component617 = `div`;
    const Component618 = `div`;
    const Component619 = `div`;
    const Component620 = `div`;
    const Component621 = `div`;
    const Component622 = `div`;
    const Component623 = `div`;
    const Component624 = `span`;
    const Component625 = `span`;
    const Component626 = `span`;
    const Component627 = `div`;
    const Component628 = `span`;
    const Component629 = `div`;
    const Component630 = `div`;
    const Component631 = `div`;
    const Component632 = `img`;
    const Component633 = `button`;
    const Component634 = `div`;
    const Component635 = `div`;
    const Component636 = `div`;
    const Component637 = `div`;
    const Component638 = `textarea`;
    const Component639 = `rect`;
    const Component640 = `circle`;
    const Component641 = `path`;
    const Component642 = `svg`;
    const Component643 = `span`;
    const Component644 = `span`;
    const Component645 = `polyline`;
    const Component646 = `svg`;
    const Component647 = `button`;
    const Component648 = `div`;
    const Component649 = `span`;
    const Component650 = `span`;
    const Component651 = `span`;
    const Component652 = `span`;
    const Component653 = `button`;
    const Component654 = `div`;
    const Component655 = `div`;
    const Component656 = `input`;
    const Component657 = `rect`;
    const Component658 = `circle`;
    const Component659 = `polyline`;
    const Component660 = `svg`;
    const Component661 = `button`;
    const Component662 = `div`;
    const Component663 = `rect`;
    const Component664 = `svg`;
    const Component665 = `button`;
    const Component666 = `line`;
    const Component667 = `polyline`;
    const Component668 = `svg`;
    const Component669 = `button`;
    const Component670 = `div`;
    const Component671 = `div`;
    const Component672 = `div`;
    const Component673 = `div`;
    return <Component673 className={`absolute top-0 right-0 bottom-0 bg-[#151414] border-l border-[#2a2a2a] flex flex-col z-30 shadow-2xl ${S ? `select-none` : ``}`} style={{
      width: b
    }}>
        <Component582 onMouseDown={M} className={`absolute left-[-3px] top-0 bottom-0 w-[6px] cursor-col-resize z-40 hover:bg-blue-500/30 ${S ? `bg-blue-500/40` : ``}`} title={`拖动调整宽度`} />
        <Component597 className={`flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]`}>
          <Component587 className={`flex items-center gap-2`}>
            <Component583 className={`w-6 h-6 rounded-full bg-gradient-to-br from-[#2a2a2a] to-[#1a1a1a] border border-[#333] flex items-center justify-center`}>
              <_Component31 size={14} className={`text-white`} />
            </Component583>
            <Component586>
              <Component584 className={`text-white text-sm font-medium`}>
                {u?.displayName || `AI 助手`}
              </Component584>
              {u?.allowed && u.membershipType && <Component585 className={`text-[10px] text-yellow-500 font-medium`}>
                  {u.membershipType}
                  {` 会员`}
                </Component585>}
            </Component586>
          </Component587>
          <Component596 className={`flex items-center gap-1`}>
            <Component591 onClick={() => {
            if (confirm(`清空当前会话的所有消息？`)) {
              R();
            }
          }} disabled={I || F.length === 0} className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#2a2a2a] rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed`} title={`清空对话`}>
              <Component590 width={`14`} height={`14`} viewBox={`0 0 24 24`} fill={`none`} stroke={`currentColor`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                <Component588 points={`3 6 5 6 21 6`} />
                <Component589 d={`M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2`} />
              </Component590>
            </Component591>
            <Component595 onClick={i} className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#2a2a2a] rounded-md transition-colors`} title={`关闭`}>
              <Component594 width={`14`} height={`14`} viewBox={`0 0 24 24`} fill={`none`} stroke={`currentColor`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                <Component592 x1={`18`} y1={`6`} x2={`6`} y2={`18`} />
                <Component593 x1={`6`} y1={`6`} x2={`18`} y2={`18`} />
              </Component594>
            </Component595>
          </Component596>
        </Component597>
        {f && <Component599 className={`flex-1 flex items-center justify-center text-gray-500 text-sm`}>
            <Component598 className={`animate-pulse`}>{`校验会员状态...`}</Component598>
          </Component599>}
        {!f && u && u.enabled === false && <Component606 className={`flex-1 flex flex-col items-center justify-center px-6 text-center`}>
            <Component603 className={`w-16 h-16 rounded-full bg-slate-700/40 border border-slate-600/40 flex items-center justify-center mb-4`}>
              <Component602 width={`28`} height={`28`} viewBox={`0 0 24 24`} fill={`none`} stroke={`#94a3b8`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                <Component600 cx={`12`} cy={`12`} r={`10`} />
                <Component601 x1={`4.93`} y1={`4.93`} x2={`19.07`} y2={`19.07`} />
              </Component602>
            </Component603>
            <Component604 className={`text-white text-base font-semibold mb-2`}>{`AI 助手已关闭`}</Component604>
            <Component605 className={`text-gray-400 text-sm`}>
              {u.message || `AI 助手功能已关闭，请联系管理员`}
            </Component605>
          </Component606>}
        {!f && u && u.enabled !== false && !u.allowed && <Component613 className={`flex-1 flex flex-col items-center justify-center px-6 text-center`}>
            <Component609 className={`w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500/20 to-yellow-700/20 border border-yellow-600/30 flex items-center justify-center mb-4`}>
              <Component608 width={`28`} height={`28`} viewBox={`0 0 24 24`} fill={`none`} stroke={`#fbbf24`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                <Component607 points={`12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2`} />
              </Component608>
            </Component609>
            <Component610 className={`text-white text-base font-semibold mb-2`}>{`VIP 专属功能`}</Component610>
            <Component611 className={`text-gray-400 text-sm mb-6`}>
              {u.message || `AI 助手为 VIP/SVIP 会员专属功能`}
            </Component611>
            {o && <Component612 onClick={o} className={`px-5 py-2 bg-gradient-to-r from-yellow-500 to-amber-600 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity`}>{`开通会员`}</Component612>}
          </Component613>}
        {!f && u?.allowed && u.enabled !== false && <K.Fragment>
            <Component631 ref={ce} className={`flex-1 overflow-y-auto px-3 py-3 space-y-3`}>
              {F.length === 0 && <Component623 className={`text-gray-500 text-xs text-center mt-8`}>
                  <Component614 className={`mb-1`}>{`你好！我是画布 AI 助手`}</Component614>
                  <Component615 className={`text-gray-600 mb-3 leading-relaxed`}>{`说一句话，我就能在画布上帮你创建节点、连接数据流、触发图片/文本/视频生成，还能批量整理、聚焦视口、撤销重做。`}</Component615>
                  <Component616 className={`text-gray-600`}>{`试试说：`}</Component616>
                  <Component622 className={`mt-2 space-y-1 text-gray-500`}>
                    <Component617 className={`bg-[#0d0c0c] border border-[#2a2a2a] rounded-md px-3 py-2`}>{`「帮我生成一张赛博朋克风格的猫咪图」`}</Component617>
                    <Component618 className={`bg-[#0d0c0c] border border-[#2a2a2a] rounded-md px-3 py-2`}>{`「把选中的节点改成 9:16」`}</Component618>
                    <Component619 className={`bg-[#0d0c0c] border border-[#2a2a2a] rounded-md px-3 py-2`}>{`「把文本节点连到生图节点并生成」`}</Component619>
                    <Component620 className={`bg-[#0d0c0c] border border-[#2a2a2a] rounded-md px-3 py-2`}>{`「把所有生图节点锁定，并聚焦到第一个」`}</Component620>
                    <Component621 className={`bg-[#0d0c0c] border border-[#2a2a2a] rounded-md px-3 py-2`}>{`「撤销刚才的操作」`}</Component621>
                  </Component622>
                </Component623>}
              {F.map((e, t) => {
            return <_cmp_Nr message={e} key={t} />;
          })}
              {I && <Component629 className={`flex items-center gap-2 text-gray-500 text-xs`}>
                  <Component627 className={`flex gap-1`}>
                    <Component624 className={`w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce`} style={{
                animationDelay: `0ms`
              }} />
                    <Component625 className={`w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce`} style={{
                animationDelay: `150ms`
              }} />
                    <Component626 className={`w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce`} style={{
                animationDelay: `300ms`
              }} />
                  </Component627>
                  <Component628>{`思考中...`}</Component628>
                </Component629>}
              {te && <Component630 className={`text-red-400 text-xs bg-red-950/30 border border-red-800/30 rounded-md px-3 py-2`}>
                  {te}
                </Component630>}
            </Component631>
            <Component672 className={`px-3 py-3 border-t border-[#2a2a2a]`}>
              <Component671 className={`bg-[#0d0c0c] border border-[#333] rounded-lg focus-within:border-blue-500 transition-colors`}>
                {(D.length > 0 || k) && <Component637 className={`flex flex-wrap gap-2 px-2 pt-2`}>
                    {D.map((e, t) => {
                return <Component634 className={`relative w-12 h-12 rounded-md overflow-hidden border border-[#333] group`} key={t}>
                          <Component632 src={e.localUrl || e.url} alt={``} className={`w-full h-full object-cover`} />
                          <Component633 type={`button`} onClick={() => {
                    return pe(t);
                  }} className={`absolute top-0 right-0 w-4 h-4 bg-black/70 hover:bg-black text-white text-[10px] flex items-center justify-center rounded-bl-md`} title={`移除`}>{`×`}</Component633>
                        </Component634>;
              })}
                    {k && <Component636 className={`w-12 h-12 rounded-md border border-[#333] bg-[#1a1a1a] flex items-center justify-center`}>
                        <Component635 className={`w-4 h-4 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin`} />
                      </Component636>}
                  </Component637>}
                <Component638 value={v} onChange={e => {
              return y(e.target.value);
            }} onKeyDown={e => {
              if (e.key === `Enter` && !e.shiftKey) {
                e.preventDefault();
                de();
              }
            }} placeholder={`输入消息，回车发送，Shift+Enter 换行`} rows={2} disabled={I} className={`w-full bg-transparent text-gray-200 text-sm px-3 py-2 resize-none focus:outline-none disabled:opacity-60`} style={{
              minHeight: `60px`,
              maxHeight: `160px`
            }} />
                <Component670 className={`flex items-center justify-between px-1.5 py-1.5 border-t border-[#2a2a2a]`}>
                  <Component662 className={`flex items-center gap-1`}>
                    <Component655 ref={E} className={`relative`}>
                      <Component647 type={`button`} onClick={() => {
                    return T(!w);
                  }} disabled={g} className={`flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-[#1a1a1a] rounded transition-colors disabled:opacity-50 max-w-[200px]`} title={`切换模型`}>
                        <Component642 width={`12`} height={`12`} viewBox={`0 0 24 24`} fill={`none`} stroke={`currentColor`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                          <Component639 x={`3`} y={`11`} width={`18`} height={`10`} rx={`2`} />
                          <Component640 cx={`12`} cy={`5`} r={`2`} />
                          <Component641 d={`M12 7v4`} />
                        </Component642>
                        <Component643 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border bg-white/10 text-white/90 border-white/30`}>{`内置`}</Component643>
                        <Component644 className={`truncate`}>
                          {g ? `加载中...` : L || `选择模型`}
                        </Component644>
                        <Component646 width={`10`} height={`10`} viewBox={`0 0 24 24`} fill={`none`} stroke={`currentColor`} strokeWidth={`2.5`} strokeLinecap={`round`} strokeLinejoin={`round`} className={`transition-transform ${w ? `rotate-180` : ``}`}>
                          <Component645 points={`6 9 12 15 18 9`} />
                        </Component646>
                      </Component647>
                      {w && <Component654 className={`absolute bottom-full left-0 mb-1 w-[260px] max-h-[280px] overflow-y-auto bg-[#1a1a1a] border border-[#333] rounded-lg shadow-2xl z-50 py-1`}>
                          {m.length === 0 ? <Component648 className={`px-3 py-2 text-xs text-gray-500 text-center`}>
                              {g ? `加载中...` : `暂无可用模型`}
                            </Component648> : m.map(e => {
                      return <Component653 type={`button`} onClick={() => {
                        oe(e.id);
                        T(false);
                      }} className={`w-full flex items-center gap-1.5 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors ${e.id === L ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} title={e.id} key={e.id}>
                                  <Component649 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border bg-white/10 text-white/90 border-white/30`}>{`内置`}</Component649>
                                  <Component650 className={`flex-1 truncate font-mono`}>
                                    {e.id}
                                  </Component650>
                                  {e.power !== null && e.power !== undefined && <Component652 className={`shrink-0 inline-flex items-center gap-0.5 text-[10px] tabular-nums ${e.currency === `proxy` ? `text-yellow-300` : `text-orange-400`}`}>
                                      <_Component14 className={`w-2.5 h-2.5`} strokeWidth={2.5} />
                                      <Component651>
                                        {Ne(e.power)}
                                        {e.unit ? `/${e.unit}` : ``}
                                      </Component651>
                                    </Component652>}
                                </Component653>;
                    })}
                        </Component654>}
                    </Component655>
                    <Component656 ref={ee} type={`file`} accept={`image/*`} multiple={true} onChange={fe} className={`hidden`} />
                    <Component661 type={`button`} onClick={() => {
                  return ee.current?.click();
                }} disabled={!z || k || I} className={`p-1.5 rounded transition-colors ${z ? `text-gray-400 hover:text-gray-200 hover:bg-[#1a1a1a]` : `text-gray-600 cursor-not-allowed`} disabled:cursor-not-allowed`} title={z ? `上传参考图` : u?.visionModels && u.visionModels.length > 0 ? `当前模型不支持视觉，请切换到 ${u.visionModels[0]} 等` : `未配置视觉模型，请联系管理员`}>
                      <Component660 width={`14`} height={`14`} viewBox={`0 0 24 24`} fill={`none`} stroke={`currentColor`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                        <Component657 x={`3`} y={`3`} width={`18`} height={`18`} rx={`2`} ry={`2`} />
                        <Component658 cx={`8.5`} cy={`8.5`} r={`1.5`} />
                        <Component659 points={`21 15 16 10 5 21`} />
                      </Component660>
                    </Component661>
                  </Component662>
                  {I ? <Component665 type={`button`} onClick={ie} className={`w-7 h-7 flex items-center justify-center bg-gray-600 hover:bg-gray-500 text-white rounded-full transition-colors cursor-pointer`} title={`停止`}>
                      <Component664 width={`12`} height={`12`} viewBox={`0 0 24 24`} fill={`white`}>
                        <Component663 x={`6`} y={`6`} width={`12`} height={`12`} rx={`2`} />
                      </Component664>
                    </Component665> : <Component669 type={`button`} onClick={de} className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors cursor-pointer ${v.trim() || D.length > 0 ? `bg-white hover:bg-gray-200 text-black` : `bg-[#2a2a2a] text-gray-500 cursor-not-allowed`}`} title={`发送`}>
                      <Component668 width={`14`} height={`14`} viewBox={`0 0 24 24`} fill={`none`} stroke={`currentColor`} strokeWidth={`2.5`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                        <Component666 x1={`12`} y1={`19`} x2={`12`} y2={`5`} />
                        <Component667 points={`5 12 12 5 19 12`} />
                      </Component668>
                    </Component669>}
                </Component670>
              </Component671>
            </Component672>
          </K.Fragment>}
      </Component673>;
  } else {
    return null;
  }
}