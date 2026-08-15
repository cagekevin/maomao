// TODO(全局, 无需 import): agentKey, projectId, canvasHandleRef, open, onClose, defaultModel, onGoMembership, onWidthChange, onEnabledChange, x, w, t, b, n, s, u, messages, sending, error, model, setModel, send, stop, clear, systemPrompt, ee, oe, ne, id, name, power, unit, currency, h, p, d, c, ce, ue, le, behavior, de, v, alert, type, url, y, re, i, localUrl, width, confirm, ae, f, o, animationDelay, te, k, fe, minHeight, maxHeight, m, se, j, pe, ie
import _cmp_Cr from './Cr.jsx';
import { fr, yr, E, T, C, hr, mr, vr, r, S, br, _r, a, dr, P, L, ze, U, Be, Ae, ar, _, We, je, Ct, gt, F, I, D, O, A, N, me, g, Me, R, _Component33, M } from './shared.js';
import * as _shared from './shared.js';
import * as W from 'react';
import * as G from 'react';
export default function _Component40({
  agentKey: e = fr,
  projectId: t,
  canvasHandleRef: n,
  open: r,
  onClose: i,
  defaultModel: a = `gpt-4o-mini`,
  onGoMembership: o,
  onWidthChange: s,
  onEnabledChange: c
}) {
  let [u, d] = W.useState(null);
  let [f, p] = W.useState(true);
  let [m, h] = W.useState([]);
  let [g, _] = W.useState(false);
  let [v, y] = W.useState(``);
  let [b, x] = W.useState(() => {
    return yr(e);
  });
  let [S, C] = W.useState(false);
  let [w, T] = W.useState(false);
  let E = W.useRef(null);
  let [D, O] = W.useState([]);
  let [k, A] = W.useState(false);
  let j = W.useRef(null);
  W.useEffect(() => {
    x(yr(e));
  }, [e]);
  W.useEffect(() => {
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
  let N = t => {
    t.preventDefault();
    C(true);
    let n = e => {
      let t = window.innerWidth - e.clientX;
      x(Math.min(hr, Math.max(mr, t)));
    };
    let r = () => {
      C(false);
      localStorage.setItem(vr(e), String(b));
      document.removeEventListener(`mousemove`, n);
      document.removeEventListener(`mouseup`, r);
    };
    document.addEventListener(`mousemove`, n);
    document.addEventListener(`mouseup`, r);
  };
  W.useEffect(() => {
    if (!S) {
      localStorage.setItem(vr(e), String(b));
    }
  }, [S, b, e]);
  W.useEffect(() => {
    if (r) {
      s?.(b);
    }
  }, [r, b, s]);
  W.useEffect(() => {
    if (!r) {
      s?.(0);
    }
  }, [r, s]);
  let P = W.useMemo(() => {
    return br(e) || localStorage.getItem(_r(e)) || u?.defaultModel || a;
  }, [u?.defaultModel, a, e]);
  let ee = u?.systemPrompt;
  let {
    messages: F,
    sending: I,
    error: te,
    model: L,
    setModel: ne,
    send: re,
    stop: ie,
    clear: ae
  } = dr({
    agentKey: e,
    projectId: t,
    canvasHandleRef: n,
    defaultModel: P,
    systemPrompt: ee
  });
  let R = W.useMemo(() => {
    if (!u?.visionModels || u.visionModels.length === 0) {
      return false;
    } else {
      return u.visionModels.includes(L);
    }
  }, [u?.visionModels, L]);
  let oe = W.useRef(false);
  let se = t => {
    oe.current = true;
    ne(t);
    localStorage.setItem(_r(e), t);
  };
  let ce = W.useCallback(() => {
    let e = ze().filter(e => {
      return (e.builtinCategory || e.category) === `text` && e.isBuiltin;
    }).map(e => {
      return e.modelName;
    }).map(e => {
      return {
        id: e,
        name: e,
        power: U(e),
        unit: Be(e) || undefined,
        currency: Ae(e)
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
  W.useEffect(() => {
    if (!r) {
      return;
    }
    let t = false;
    (async () => {
      p(true);
      let n = await ar(e);
      d(n);
      p(false);
      c?.(n.enabled !== false);
      if (!t && n.allowed) {
        _(true);
        let e = We();
        if (e) {
          await je(Ct(``), e);
        }
        if (t) {
          return;
        }
        ce();
        _(false);
      }
    })();
    return () => {
      t = true;
    };
  }, [r, e, ce, c]);
  W.useEffect(() => {
    if (r) {
      return gt(() => {
        ce();
      });
    }
  }, [r, ce]);
  let le = W.useRef(null);
  let ue = F[F.length - 1];
  let de = ue ? (ue.content?.length ?? 0) + (ue.reasoning?.length ?? 0) : 0;
  W.useEffect(() => {
    le.current?.scrollTo({
      top: le.current.scrollHeight,
      behavior: `smooth`
    });
  }, [F.length, I, de]);
  let fe = () => {
    let e = v.trim();
    if (!e && D.length === 0 || I) {
      return;
    }
    if (D.length > 0 && !R) {
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
  let pe = async e => {
    let t = e.target.files;
    if (!t || t.length === 0) {
      return;
    }
    if (!R) {
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
  let me = e => {
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
    const Component580 = `div`;
    const Component581 = `div`;
    const Component582 = `div`;
    const Component583 = `div`;
    const Component584 = `div`;
    const Component585 = `div`;
    const Component586 = `polyline`;
    const Component587 = `path`;
    const Component588 = `svg`;
    const Component589 = `button`;
    const Component590 = `line`;
    const Component591 = `line`;
    const Component592 = `svg`;
    const Component593 = `button`;
    const Component594 = `div`;
    const Component595 = `div`;
    const Component596 = `div`;
    const Component597 = `div`;
    const Component598 = `circle`;
    const Component599 = `line`;
    const Component600 = `svg`;
    const Component601 = `div`;
    const Component602 = `div`;
    const Component603 = `div`;
    const Component604 = `div`;
    const Component605 = `polygon`;
    const Component606 = `svg`;
    const Component607 = `div`;
    const Component608 = `div`;
    const Component609 = `div`;
    const Component610 = `button`;
    const Component611 = `div`;
    const Component612 = `div`;
    const Component613 = `div`;
    const Component614 = `div`;
    const Component615 = `div`;
    const Component616 = `div`;
    const Component617 = `div`;
    const Component618 = `div`;
    const Component619 = `div`;
    const Component620 = `div`;
    const Component621 = `div`;
    const Component622 = `span`;
    const Component623 = `span`;
    const Component624 = `span`;
    const Component625 = `div`;
    const Component626 = `span`;
    const Component627 = `div`;
    const Component628 = `div`;
    const Component629 = `div`;
    const Component630 = `img`;
    const Component631 = `button`;
    const Component632 = `div`;
    const Component633 = `div`;
    const Component634 = `div`;
    const Component635 = `div`;
    const Component636 = `textarea`;
    const Component637 = `rect`;
    const Component638 = `circle`;
    const Component639 = `path`;
    const Component640 = `svg`;
    const Component641 = `span`;
    const Component642 = `span`;
    const Component643 = `polyline`;
    const Component644 = `svg`;
    const Component645 = `button`;
    const Component646 = `div`;
    const Component647 = `span`;
    const Component648 = `span`;
    const Component649 = `span`;
    const Component650 = `span`;
    const Component651 = `button`;
    const Component652 = `div`;
    const Component653 = `div`;
    const Component654 = `input`;
    const Component655 = `rect`;
    const Component656 = `circle`;
    const Component657 = `polyline`;
    const Component658 = `svg`;
    const Component659 = `button`;
    const Component660 = `div`;
    const Component661 = `rect`;
    const Component662 = `svg`;
    const Component663 = `button`;
    const Component664 = `line`;
    const Component665 = `polyline`;
    const Component666 = `svg`;
    const Component667 = `button`;
    const Component668 = `div`;
    const Component669 = `div`;
    const Component670 = `div`;
    const Component671 = `div`;
    return <Component671 className={`absolute top-0 right-0 bottom-0 bg-[#151414] border-l border-[#2a2a2a] flex flex-col z-30 shadow-2xl ${S ? `select-none` : ``}`} style={{
      width: b
    }}>
        <Component580 onMouseDown={N} className={`absolute left-[-3px] top-0 bottom-0 w-[6px] cursor-col-resize z-40 hover:bg-blue-500/30 ${S ? `bg-blue-500/40` : ``}`} title={`拖动调整宽度`} />
        <Component595 className={`flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]`}>
          <Component585 className={`flex items-center gap-2`}>
            <Component581 className={`w-6 h-6 rounded-full bg-gradient-to-br from-[#2a2a2a] to-[#1a1a1a] border border-[#333] flex items-center justify-center`}>
              <_Component33 size={14} className={`text-white`} />
            </Component581>
            <Component584>
              <Component582 className={`text-white text-sm font-medium`}>
                {u?.displayName || `AI 助手`}
              </Component582>
              {u?.allowed && u.membershipType && <Component583 className={`text-[10px] text-yellow-500 font-medium`}>
                  {u.membershipType}
                  {` 会员`}
                </Component583>}
            </Component584>
          </Component585>
          <Component594 className={`flex items-center gap-1`}>
            <Component589 onClick={() => {
            if (confirm(`清空当前会话的所有消息？`)) {
              ae();
            }
          }} disabled={I || F.length === 0} className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#2a2a2a] rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed`} title={`清空对话`}>
              <Component588 width={`14`} height={`14`} viewBox={`0 0 24 24`} fill={`none`} stroke={`currentColor`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                <Component586 points={`3 6 5 6 21 6`} />
                <Component587 d={`M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2`} />
              </Component588>
            </Component589>
            <Component593 onClick={i} className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#2a2a2a] rounded-md transition-colors`} title={`关闭`}>
              <Component592 width={`14`} height={`14`} viewBox={`0 0 24 24`} fill={`none`} stroke={`currentColor`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                <Component590 x1={`18`} y1={`6`} x2={`6`} y2={`18`} />
                <Component591 x1={`6`} y1={`6`} x2={`18`} y2={`18`} />
              </Component592>
            </Component593>
          </Component594>
        </Component595>
        {f && <Component597 className={`flex-1 flex items-center justify-center text-gray-500 text-sm`}>
            <Component596 className={`animate-pulse`}>{`校验会员状态...`}</Component596>
          </Component597>}
        {!f && u && u.enabled === false && <Component604 className={`flex-1 flex flex-col items-center justify-center px-6 text-center`}>
            <Component601 className={`w-16 h-16 rounded-full bg-slate-700/40 border border-slate-600/40 flex items-center justify-center mb-4`}>
              <Component600 width={`28`} height={`28`} viewBox={`0 0 24 24`} fill={`none`} stroke={`#94a3b8`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                <Component598 cx={`12`} cy={`12`} r={`10`} />
                <Component599 x1={`4.93`} y1={`4.93`} x2={`19.07`} y2={`19.07`} />
              </Component600>
            </Component601>
            <Component602 className={`text-white text-base font-semibold mb-2`}>{`AI 助手已关闭`}</Component602>
            <Component603 className={`text-gray-400 text-sm`}>
              {u.message || `AI 助手功能已关闭，请联系管理员`}
            </Component603>
          </Component604>}
        {!f && u && u.enabled !== false && !u.allowed && <Component611 className={`flex-1 flex flex-col items-center justify-center px-6 text-center`}>
            <Component607 className={`w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500/20 to-yellow-700/20 border border-yellow-600/30 flex items-center justify-center mb-4`}>
              <Component606 width={`28`} height={`28`} viewBox={`0 0 24 24`} fill={`none`} stroke={`#fbbf24`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                <Component605 points={`12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2`} />
              </Component606>
            </Component607>
            <Component608 className={`text-white text-base font-semibold mb-2`}>{`VIP 专属功能`}</Component608>
            <Component609 className={`text-gray-400 text-sm mb-6`}>
              {u.message || `AI 助手为 VIP/SVIP 会员专属功能`}
            </Component609>
            {o && <Component610 onClick={o} className={`px-5 py-2 bg-gradient-to-r from-yellow-500 to-amber-600 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity`}>{`开通会员`}</Component610>}
          </Component611>}
        {!f && u?.allowed && u.enabled !== false && <G.Fragment>
            <Component629 ref={le} className={`flex-1 overflow-y-auto px-3 py-3 space-y-3`}>
              {F.length === 0 && <Component621 className={`text-gray-500 text-xs text-center mt-8`}>
                  <Component612 className={`mb-1`}>{`你好！我是画布 AI 助手`}</Component612>
                  <Component613 className={`text-gray-600 mb-3 leading-relaxed`}>{`说一句话，我就能在画布上帮你创建节点、连接数据流、触发图片/文本/视频生成，还能批量整理、聚焦视口、撤销重做。`}</Component613>
                  <Component614 className={`text-gray-600`}>{`试试说：`}</Component614>
                  <Component620 className={`mt-2 space-y-1 text-gray-500`}>
                    <Component615 className={`bg-[#0d0c0c] border border-[#2a2a2a] rounded-md px-3 py-2`}>{`「帮我生成一张赛博朋克风格的猫咪图」`}</Component615>
                    <Component616 className={`bg-[#0d0c0c] border border-[#2a2a2a] rounded-md px-3 py-2`}>{`「把选中的节点改成 9:16」`}</Component616>
                    <Component617 className={`bg-[#0d0c0c] border border-[#2a2a2a] rounded-md px-3 py-2`}>{`「把文本节点连到生图节点并生成」`}</Component617>
                    <Component618 className={`bg-[#0d0c0c] border border-[#2a2a2a] rounded-md px-3 py-2`}>{`「把所有生图节点锁定，并聚焦到第一个」`}</Component618>
                    <Component619 className={`bg-[#0d0c0c] border border-[#2a2a2a] rounded-md px-3 py-2`}>{`「撤销刚才的操作」`}</Component619>
                  </Component620>
                </Component621>}
              {F.map((e, t) => {
            return <_cmp_Cr message={e} key={t} />;
          })}
              {I && <Component627 className={`flex items-center gap-2 text-gray-500 text-xs`}>
                  <Component625 className={`flex gap-1`}>
                    <Component622 className={`w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce`} style={{
                animationDelay: `0ms`
              }} />
                    <Component623 className={`w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce`} style={{
                animationDelay: `150ms`
              }} />
                    <Component624 className={`w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce`} style={{
                animationDelay: `300ms`
              }} />
                  </Component625>
                  <Component626>{`思考中...`}</Component626>
                </Component627>}
              {te && <Component628 className={`text-red-400 text-xs bg-red-950/30 border border-red-800/30 rounded-md px-3 py-2`}>
                  {te}
                </Component628>}
            </Component629>
            <Component670 className={`px-3 py-3 border-t border-[#2a2a2a]`}>
              <Component669 className={`bg-[#0d0c0c] border border-[#333] rounded-lg focus-within:border-blue-500 transition-colors`}>
                {(D.length > 0 || k) && <Component635 className={`flex flex-wrap gap-2 px-2 pt-2`}>
                    {D.map((e, t) => {
                return <Component632 className={`relative w-12 h-12 rounded-md overflow-hidden border border-[#333] group`} key={t}>
                          <Component630 src={e.localUrl || e.url} alt={``} className={`w-full h-full object-cover`} />
                          <Component631 type={`button`} onClick={() => {
                    return me(t);
                  }} className={`absolute top-0 right-0 w-4 h-4 bg-black/70 hover:bg-black text-white text-[10px] flex items-center justify-center rounded-bl-md`} title={`移除`}>{`×`}</Component631>
                        </Component632>;
              })}
                    {k && <Component634 className={`w-12 h-12 rounded-md border border-[#333] bg-[#1a1a1a] flex items-center justify-center`}>
                        <Component633 className={`w-4 h-4 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin`} />
                      </Component634>}
                  </Component635>}
                <Component636 value={v} onChange={e => {
              return y(e.target.value);
            }} onKeyDown={e => {
              if (e.key === `Enter` && !e.shiftKey) {
                e.preventDefault();
                fe();
              }
            }} placeholder={`输入消息，回车发送，Shift+Enter 换行`} rows={2} disabled={I} className={`w-full bg-transparent text-gray-200 text-sm px-3 py-2 resize-none focus:outline-none disabled:opacity-60`} style={{
              minHeight: `60px`,
              maxHeight: `160px`
            }} />
                <Component668 className={`flex items-center justify-between px-1.5 py-1.5 border-t border-[#2a2a2a]`}>
                  <Component660 className={`flex items-center gap-1`}>
                    <Component653 ref={E} className={`relative`}>
                      <Component645 type={`button`} onClick={() => {
                    return T(!w);
                  }} disabled={g} className={`flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-[#1a1a1a] rounded transition-colors disabled:opacity-50 max-w-[200px]`} title={`切换模型`}>
                        <Component640 width={`12`} height={`12`} viewBox={`0 0 24 24`} fill={`none`} stroke={`currentColor`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                          <Component637 x={`3`} y={`11`} width={`18`} height={`10`} rx={`2`} />
                          <Component638 cx={`12`} cy={`5`} r={`2`} />
                          <Component639 d={`M12 7v4`} />
                        </Component640>
                        <Component641 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border bg-white/10 text-white/90 border-white/30`}>{`内置`}</Component641>
                        <Component642 className={`truncate`}>
                          {g ? `加载中...` : L || `选择模型`}
                        </Component642>
                        <Component644 width={`10`} height={`10`} viewBox={`0 0 24 24`} fill={`none`} stroke={`currentColor`} strokeWidth={`2.5`} strokeLinecap={`round`} strokeLinejoin={`round`} className={`transition-transform ${w ? `rotate-180` : ``}`}>
                          <Component643 points={`6 9 12 15 18 9`} />
                        </Component644>
                      </Component645>
                      {w && <Component652 className={`absolute bottom-full left-0 mb-1 w-[260px] max-h-[280px] overflow-y-auto bg-[#1a1a1a] border border-[#333] rounded-lg shadow-2xl z-50 py-1`}>
                          {m.length === 0 ? <Component646 className={`px-3 py-2 text-xs text-gray-500 text-center`}>
                              {g ? `加载中...` : `暂无可用模型`}
                            </Component646> : m.map(e => {
                      return <Component651 type={`button`} onClick={() => {
                        se(e.id);
                        T(false);
                      }} className={`w-full flex items-center gap-1.5 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors ${e.id === L ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} title={e.id} key={e.id}>
                                  <Component647 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border bg-white/10 text-white/90 border-white/30`}>{`内置`}</Component647>
                                  <Component648 className={`flex-1 truncate font-mono`}>
                                    {e.id}
                                  </Component648>
                                  {e.power !== null && e.power !== undefined && <Component650 className={`shrink-0 inline-flex items-center gap-0.5 text-[10px] tabular-nums ${e.currency === `proxy` ? `text-yellow-300` : `text-orange-400`}`}>
                                      <M className={`w-2.5 h-2.5`} strokeWidth={2.5} />
                                      <Component649>
                                        {Me(e.power)}
                                        {e.unit ? `/${e.unit}` : ``}
                                      </Component649>
                                    </Component650>}
                                </Component651>;
                    })}
                        </Component652>}
                    </Component653>
                    <Component654 ref={j} type={`file`} accept={`image/*`} multiple={true} onChange={pe} className={`hidden`} />
                    <Component659 type={`button`} onClick={() => {
                  return j.current?.click();
                }} disabled={!R || k || I} className={`p-1.5 rounded transition-colors ${R ? `text-gray-400 hover:text-gray-200 hover:bg-[#1a1a1a]` : `text-gray-600 cursor-not-allowed`} disabled:cursor-not-allowed`} title={R ? `上传参考图` : u?.visionModels && u.visionModels.length > 0 ? `当前模型不支持视觉，请切换到 ${u.visionModels[0]} 等` : `未配置视觉模型，请联系管理员`}>
                      <Component658 width={`14`} height={`14`} viewBox={`0 0 24 24`} fill={`none`} stroke={`currentColor`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                        <Component655 x={`3`} y={`3`} width={`18`} height={`18`} rx={`2`} ry={`2`} />
                        <Component656 cx={`8.5`} cy={`8.5`} r={`1.5`} />
                        <Component657 points={`21 15 16 10 5 21`} />
                      </Component658>
                    </Component659>
                  </Component660>
                  {I ? <Component663 type={`button`} onClick={ie} className={`w-7 h-7 flex items-center justify-center bg-gray-600 hover:bg-gray-500 text-white rounded-full transition-colors cursor-pointer`} title={`停止`}>
                      <Component662 width={`12`} height={`12`} viewBox={`0 0 24 24`} fill={`white`}>
                        <Component661 x={`6`} y={`6`} width={`12`} height={`12`} rx={`2`} />
                      </Component662>
                    </Component663> : <Component667 type={`button`} onClick={fe} className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors cursor-pointer ${v.trim() || D.length > 0 ? `bg-white hover:bg-gray-200 text-black` : `bg-[#2a2a2a] text-gray-500 cursor-not-allowed`}`} title={`发送`}>
                      <Component666 width={`14`} height={`14`} viewBox={`0 0 24 24`} fill={`none`} stroke={`currentColor`} strokeWidth={`2.5`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                        <Component664 x1={`12`} y1={`19`} x2={`12`} y2={`5`} />
                        <Component665 points={`5 12 12 5 19 12`} />
                      </Component666>
                    </Component667>}
                </Component668>
              </Component669>
            </Component670>
          </G.Fragment>}
      </Component671>;
  } else {
    return null;
  }
}