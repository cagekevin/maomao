// TODO(全局, 无需 import): data, selected, updateNodeData, setEdges, getNodes, o, n, r, i, p, m, g, character, scene, prop, v, xe, je, label, category, original, DOMRect, ze, u, s, l, f, at, rt, ke, b, mt, k, le, ht, shots, description, prompt, videoPrompt, dialogue, assets, index, duration, story, errorMsg, scriptProgressChars, loading, gt, ut, imageUrl, shotId, field, z, motion, left, width, fontSize, lineHeight, padding, margin, border, boxSizing, fontFamily, fontWeight, letterSpacing, tabSize, wordBreak, whiteSpace, minHeight, overflow, scrollbarGutter, qe, text, cursor, kind, role, et, tt, idx, gridTemplateColumns, paddingX, paddingY, fontSizePx, minHeightPx, ee, shotType, kt, jt, assetModelSettings, ot, qt, zt, globalModel, globalStyle, de, vt, audioUrl, ye, name, yt, en, x, selectedModel, se, shotCount, tn, right, transform, on, q, prevShot, images, videos, url, candidate, videoUrl, lastResult, lastVideos, custom, ln, zIndex, usePrevShotVideoTail, ae, tailFrameAngleIds, selectedTailFrameVariantId, gridMode, an, detail, nodeId, shotIds, un, cn, title, desc, progress, step, height, dt, wt, pn, pt, dn, oe, aspectRatio, customAspectRatio, imageGlobalConstraint, videoGlobalConstraint, customScriptPrompt, customShotPrompt, customAssetTemplates, ve
import _cmp__Component18 from './_Component18.jsx';
import _cmp_Fi from './Fi.jsx';
import _cmp_Ti from './Ti.jsx';
import _cmp__Component91 from './_Component91.jsx';
import { id, We, it, nn, Vt, e, t, d, ei, h, D, D_, Te, Ae, K, Pe, Y, J, Ie, T_, Eo, Le, Re, Je, _t, He, xo, c, Ye, _, F, L, Qe, Da, Na, lt, P, Ee, Ce, we, Me, O, ce, ft, E, M, S, _e, B, R, ne, A, Et, S_, Dt, C_, Ve, Be, Ue, Do, Oo, I, Fn, Xe, w_, Pt, Nt, At, x_, Tt, te, Mt, y, xt, Rt, Fa, Ht, Ut, Wt, Lt, ma, sa, ca, ha, Jt, nt, Pa, Yt, Ne, N, Fe, ue, he, pe, Ct, be, St, $t, w, b_, W, C, rn, It, X, bt, Va, Ze, $e, H, ie, U, Ge, sn, Zt, Qt, Se, Oe, De, fn, V, j, G, re, E_, ge, _Component33, Gt, Xt, Ot, _Component19, _Component89, _Component22, Dn, T, Bt, _Component21, Kt, O_, _Component48, _Component90, Ke } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
var k_ = Z.memo(({
  id: e,
  data: t,
  selected: n
}) => {
  let {
    updateNodeData: r,
    setEdges: i,
    getNodes: a
  } = We();
  let o = it();
  let c = nn();
  let l = Vt(e => {
    return e.transform[2] || 1;
  });
  let d = Z.useMemo(() => {
    return o.filter(t => {
      return t.source === e && t.sourceHandle?.startsWith(`shot-`);
    }).map(e => {
      return e.target;
    }).sort();
  }, [o, e]);
  let f = Vt(Z.useCallback(e => {
    return d.map(t => {
      let n = (e.nodes || []).find(e => {
        return e.id === t;
      })?.data || {};
      let r = Array.isArray(n.resultVideos) ? n.resultVideos.map(e => {
        if (typeof e == `string`) {
          return e;
        } else {
          return e?.url;
        }
      }).join(`,`) : ``;
      let i = Array.isArray(n.videos) ? n.videos.map(e => {
        if (typeof e == `string`) {
          return e;
        } else {
          return e?.url;
        }
      }).join(`,`) : ``;
      return `${t}:${n.videoUrl || ``}:${r}:${i}`;
    }).join(`|`);
  }, [d]));
  let p = t;
  let m = Z.useMemo(() => {
    return p.shots || [];
  }, [p.shots]);
  let h = Z.useMemo(() => {
    return p.assets || [];
  }, [p.assets]);
  let g = Z.useRef(m);
  g.current = m;
  let _ = (e, t) => {
    return t || (e ? ei(e, 200, `image`) || e : ``);
  };
  let v = Z.useMemo(() => {
    return {
      character: h.filter(e => {
        return e.category === `character`;
      }),
      scene: h.filter(e => {
        return e.category === `scene`;
      }),
      prop: h.filter(e => {
        return e.category === `prop`;
      })
    };
  }, [h]);
  let y = v.character;
  let b = p.step || 1;
  let x = m.length > 0;
  let [S, C] = Z.useState(p.story || ``);
  let [w, E] = Z.useState(false);
  let [D, O] = Z.useState(false);
  let k = !!p.loading || D;
  let [A, j] = Z.useState(false);
  let [M, N] = Z.useState(null);
  let [P, F] = Z.useState(null);
  let [I, L] = Z.useState(null);
  let [ee, R] = Z.useState(null);
  let [te, z] = Z.useState(null);
  let [ne, B] = Z.useState(null);
  let [re, V] = Z.useState(false);
  let [H, ie] = Z.useState(new Set());
  let [ae, U] = Z.useState(new Set());
  let [oe, se] = Z.useState(false);
  let W = Z.useRef(null);
  let G = Z.useRef(null);
  let [ce, le] = Z.useState(null);
  let [ue, de] = Z.useState(null);
  let [pe, he] = Z.useState(null);
  let [ge, _e] = Z.useState(false);
  let [ve, ye] = Z.useState(false);
  let be = Z.useRef(null);
  let [xe, Se] = Z.useState(() => {
    try {
      if (localStorage.getItem(`script-box-view-${e}`) === `single`) {
        return `single`;
      } else {
        return `list`;
      }
    } catch {
      return `list`;
    }
  });
  Z.useEffect(() => {
    try {
      localStorage.setItem(`script-box-view-${e}`, xe);
    } catch {}
  }, [e, xe]);
  let [Ce, we] = Z.useState(0);
  let [Te, Ee] = Z.useState(0);
  let [De, Oe] = Z.useState(false);
  let ke = Math.max(1, Math.ceil(m.length / D_));
  let K = Z.useMemo(() => {
    return m.slice(Te * D_, (Te + 1) * D_);
  }, [Te, m]);
  let Ae = Z.useMemo(() => {
    return new Set(o.filter(t => {
      return t.source === e && t.sourceHandle?.startsWith(`shot-`);
    }).map(e => {
      return e.sourceHandle;
    }));
  }, [o, e]);
  let je = Z.useMemo(() => {
    return m.filter(e => {
      return Ae.has(`shot-${e.id}`);
    });
  }, [Ae, m]);
  let Me = Z.useMemo(() => {
    return je.map(e => {
      return `shot-${e.id}`;
    }).join(`|`);
  }, [je]);
  let q = je.some(e => {
    return !K.some(t => {
      return t.id === e.id;
    });
  });
  let [Ne, Pe] = Z.useState(new Set());
  let Fe = e => {
    return Pe(t => {
      let n = new Set(t);
      if (n.has(e)) {
        n.delete(e);
      } else {
        n.add(e);
      }
      return n;
    });
  };
  let J = (e, t) => {
    return `${e}:${t}`;
  };
  let Ie = Z.useRef({});
  let Le = Z.useRef({});
  let Re = Z.useRef({});
  let ze = Z.useRef({});
  let Be = Z.useRef({});
  let Ve = Z.useRef({});
  let He = Z.useRef({});
  let Y = [{
    id: `forward`,
    label: `镜头向前移动`,
    category: `移动`
  }, {
    id: `left`,
    label: `镜头向左移动`,
    category: `移动`
  }, {
    id: `closeup`,
    label: `特写镜头`,
    category: `景别`
  }, {
    id: `right`,
    label: `镜头向右移动`,
    category: `移动`
  }, {
    id: `rotateLeft45`,
    label: `镜头左转45°`,
    category: `旋转`
  }, {
    id: `down`,
    label: `镜头向下移动`,
    category: `移动`
  }, {
    id: `rotateRight45`,
    label: `镜头右转45°`,
    category: `旋转`
  }, {
    id: `topDown`,
    label: `俯视视角`,
    category: `视角`
  }, {
    id: `faceCloseup`,
    label: `脸部特写镜头`,
    category: `景别`
  }, {
    id: `lowAngle`,
    label: `仰视视角`,
    category: `视角`
  }, {
    id: `wideAngle`,
    label: `广角镜头`,
    category: `景别`
  }, {
    id: `backFull`,
    label: `背后全身镜头`,
    category: `构图`
  }, {
    id: `sideFull`,
    label: `正侧面全身镜头`,
    category: `构图`
  }, {
    id: `chestCloseup`,
    label: `胸部特写镜头`,
    category: `景别`
  }, {
    id: `frontFull`,
    label: `正面全身镜头`,
    category: `构图`
  }];
  let Ue = Z.useMemo(() => {
    return h.map(e => {
      return e.name;
    }).filter(Boolean);
  }, [h]);
  let Ge = Z.useMemo(() => {
    let e = {
      original: `原版尾帧`
    };
    Y.forEach(t => {
      e[t.id] = t.label;
    });
    return e;
  }, [Y]);
  let qe = e => {
    let t = window.getSelection();
    if (!t || t.rangeCount === 0) {
      return null;
    }
    let n = t.getRangeAt(0).cloneRange();
    if (!e.contains(n.endContainer)) {
      return null;
    }
    n.collapse(true);
    let r = n.getClientRects();
    if (r && r.length > 0) {
      return r[0];
    }
    let i = n.getBoundingClientRect();
    if (i && (i.width > 0 || i.height > 0)) {
      return i;
    }
    let a = e.getBoundingClientRect();
    let o = parseInt(window.getComputedStyle(e).lineHeight || `18`, 10) || 18;
    return new DOMRect(a.left, a.top + o, 1, o);
  };
  let Je = (e, t, n, r) => {
    let i = J(e, t);
    let a = Ie.current[i];
    let o = T_(n || ``);
    if (a) {
      a.innerHTML = o;
      if (r !== undefined) {
        requestAnimationFrame(() => {
          let e = Ie.current[i];
          if (e) {
            e.focus();
            Eo(e, r);
          }
        });
      }
    }
    Le.current[i] = o;
    Re.current[i] = r ?? (n || ``).length;
  };
  let Ye = (e, t, n, r) => {
    let i = J(e, t);
    let a = r ?? (n || ``).length;
    ze.current[i] = true;
    Je(e, t, n, a);
    _t(e, {
      [t]: n
    });
  };
  let Xe = (e, t, n, r = false) => {
    let i = J(e, t);
    let a = Ie.current[i];
    let o = g.current.find(t => {
      return t.id === e;
    });
    let s = a ? a.innerText.replace(/\u00a0/g, ` `) : o && o[t] || ``;
    let c = `@${n} `;
    let l = He.current[i] ?? -1;
    let u = Re.current[i];
    let d = a ? xo(a) : -1;
    let f = u !== undefined && u >= 0 ? u : d >= 0 ? d : s.length;
    let p;
    let m;
    if (r && l >= 0) {
      let e = Math.min(Math.max(0, l), s.length);
      let t = Math.min(Math.max(e, f), s.length);
      p = s.substring(0, e);
      m = s.substring(t);
    } else {
      let e = Math.min(Math.max(0, f), s.length);
      p = s.substring(0, e);
      m = s.substring(e);
    }
    let h = p + c + m;
    let _ = p.length + c.length;
    Ye(e, t, h, _);
    He.current[i] = -1;
    F(null);
    L(null);
    requestAnimationFrame(() => {
      let e = Ie.current[i];
      if (e) {
        if (document.activeElement !== e) {
          e.focus();
        }
        Eo(e, Math.min(_, (e.innerText || ``).length));
      }
    });
  };
  let [Ze, Qe] = Z.useState(new Set());
  let $e = e => {
    return Qe(t => {
      let n = new Set(t);
      if (n.has(e)) {
        n.delete(e);
      } else {
        n.add(e);
      }
      return n;
    });
  };
  let [et, tt] = Z.useState([36, 92, 320, 90, 90, 30]);
  let [nt, rt] = Z.useState(false);
  let at = Z.useRef(null);
  let [ot, lt] = Z.useState(() => {
    return Da().filter(e => {
      return e.enabled && e.category === `image`;
    });
  });
  Z.useEffect(() => {
    return Na(e => {
      lt(e.filter(e => {
        return e.enabled && e.category === `image`;
      }));
    });
  }, []);
  Z.useEffect(() => {
    let e = e => {
      if (at.current && !at.current.contains(e.target)) {
        rt(false);
      }
      if (P) {
        if (!Object.values(Ie.current).find(t => {
          return t && t.contains(e.target);
        })) {
          F(null);
          L(null);
        }
      }
    };
    document.addEventListener(`mousedown`, e);
    return () => {
      return document.removeEventListener(`mousedown`, e);
    };
  }, [P]);
  let ut = Z.useRef(null);
  let dt = Z.useRef(null);
  let ft = Z.useRef(null);
  Z.useEffect(() => {
    Ee(e => {
      return Math.min(e, ke - 1);
    });
  }, [ke, m]);
  Z.useEffect(() => {
    if (xe !== `single` || m.length === 0) {
      return;
    }
    let e = Te * D_;
    let t = Math.min(e + D_, m.length) - 1;
    if (Ce < e || Ce > t) {
      we(e);
    }
  }, [Ce, Te, xe, m.length]);
  Z.useEffect(() => {
    c(e);
  }, [Me, Ce, e, Te, xe, m.length, b, c]);
  Z.useEffect(() => {
    O(false);
  }, [D, e, p.shots, p.errorMsg, p.loading]);
  let [pt, mt] = Z.useState(0);
  Z.useEffect(() => {
    if (!k) {
      mt(0);
      return;
    }
    let e = Date.now();
    let t = setInterval(() => {
      return mt(Math.floor((Date.now() - e) / 1000));
    }, 1000);
    return () => {
      return clearInterval(t);
    };
  }, [k]);
  Z.useEffect(() => {
    if (!ce) {
      return;
    }
    let e = e => {
      if (e.key === `Escape`) {
        le(null);
      }
    };
    window.addEventListener(`keydown`, e);
    return () => {
      return window.removeEventListener(`keydown`, e);
    };
  }, [ce]);
  let ht = Z.useMemo(() => {
    return (p.textModel || ``).split(`
`).map(e => {
      return e.trim();
    }).filter(Boolean);
  }, [p.textModel]);
  let gt = p.selectedModel || ht[0] || ``;
  Z.useEffect(() => {
    let e = e => {
      if (ft.current && !ft.current.contains(e.target)) {
        E(false);
      }
    };
    document.addEventListener(`mousedown`, e);
    return () => {
      return document.removeEventListener(`mousedown`, e);
    };
  }, []);
  let _t = (t, n) => {
    r(e, {
      shots: m.map(e => {
        if (e.id === t) {
          return {
            ...e,
            ...n
          };
        } else {
          return e;
        }
      })
    });
  };
  let vt = (t, n) => {
    let i = h.find(e => {
      return e.id === t;
    });
    if (i && typeof n.name == `string` && n.name.trim() && n.name !== i.name) {
      let a = i.name;
      let o = n.name;
      let s = e => {
        return e && e.split(a).join(o);
      };
      r(e, {
        shots: m.map(e => {
          return {
            ...e,
            description: s(e.description),
            prompt: s(e.prompt),
            videoPrompt: s(e.videoPrompt),
            dialogue: s(e.dialogue)
          };
        }),
        assets: h.map(e => {
          if (e.id === t) {
            return {
              ...e,
              ...n,
              prompt: s(e.prompt)
            };
          } else {
            return e;
          }
        })
      });
      return;
    }
    r(e, {
      assets: h.map(e => {
        if (e.id === t) {
          return {
            ...e,
            ...n
          };
        } else {
          return e;
        }
      })
    });
  };
  let yt = h.find(e => {
    return e.id === M;
  }) || null;
  let bt = () => {
    let t = m.length > 0 ? Math.max(...m.map(e => {
      return e.index;
    })) + 1 : 1;
    r(e, {
      shots: [...m, {
        id: `${e}-shot-${Date.now()}`,
        index: t,
        duration: `5s`,
        description: ``
      }]
    });
  };
  let xt = t => {
    r(e, {
      shots: m.filter(e => {
        return e.id !== t;
      })
    });
    i(n => {
      return n.filter(n => {
        return n.source !== e || n.sourceHandle !== `shot-${t}`;
      });
    });
  };
  let St = t => {
    t?.stopPropagation();
    if (!!S.trim() && !D) {
      O(true);
      r(e, {
        story: S,
        errorMsg: undefined,
        scriptProgressChars: 0,
        loading: true
      });
      p.onGenerateScript?.(e, S, gt);
    }
  };
  let Ct = e => {
    ut.current = e;
    _e(true);
  };
  let wt = t => {
    let n = t.target.files?.[0];
    let i = ut.current;
    if (!n || !i) {
      return;
    }
    let a = new FileReader();
    a.onload = () => {
      return r(e, {
        assets: h.map(e => {
          if (e.id === i) {
            return {
              ...e,
              imageUrl: a.result
            };
          } else {
            return e;
          }
        })
      });
    };
    a.readAsDataURL(n);
    t.target.value = ``;
  };
  let Tt = (e, t) => {
    B(n => {
      if (n?.shotId === e && n.field === t) {
        return null;
      } else {
        return {
          shotId: e,
          field: t
        };
      }
    });
    F(null);
    R(null);
    z(null);
  };
  let Et = e => {
    if (e === `duration`) {
      return `时长`;
    } else {
      if (e === `sound`) {
        return `音效`;
      } else {
        if (e === `motion`) {
          return `运镜`;
        } else {
          return `光影`;
        }
      }
    }
  };
  let Dt = e => {
    if (e === `duration`) {
      return `如 3s / 5s`;
    } else {
      if (e === `sound`) {
        return `环境音、音效…`;
      } else {
        if (e === `motion`) {
          return `推/拉/摇/移…`;
        } else {
          return `光影氛围`;
        }
      }
    }
  };
  let kt = (e, t) => {
    if (ne?.shotId !== e.id || ne.field !== t) {
      return null;
    }
    let n = e[t] || ``;
    const Component2427 = `div`;
    const Component2428 = `button`;
    const Component2429 = `div`;
    const Component2430 = `input`;
    const Component2431 = `textarea`;
    const Component2432 = `button`;
    const Component2433 = `div`;
    const Component2434 = `div`;
    const Component2435 = `button`;
    const Component2436 = `div`;
    const Component2437 = `div`;
    return <Component2437 className={`absolute z-50 top-full ${A && (t === `motion` || t === `sound`) ? `right-0` : `left-0`} mt-1 w-56 rounded-lg border border-[#3a3a3a] bg-[#202020] p-2 shadow-xl nowheel nopan nodrag space-y-2`} onWheel={e => {
      return e.stopPropagation();
    }} onClick={e => {
      return e.stopPropagation();
    }}>
        <Component2427 className={`text-[10px] text-gray-400`}>{Et(t)}</Component2427>
        {t === `duration` && <Component2429 className={`flex flex-wrap gap-1`}>
            {S_.map(t => {
          return <Component2428 className={`px-2 py-1 rounded text-[11px] nodrag ${n === t ? `bg-gray-100 text-gray-950` : `bg-[#2a2a2a] text-gray-300 hover:bg-[#333]`}`} onClick={() => {
            return _t(e.id, {
              duration: t
            });
          }} key={t}>
                  {t}
                </Component2428>;
        })}
          </Component2429>}
        {t === `duration` ? <Component2430 autoFocus={true} value={n} onChange={t => {
        return _t(e.id, {
          duration: t.target.value
        });
      }} placeholder={Dt(t)} className={`w-full rounded bg-[#262626] border border-[#3a3a3a] px-2 py-1.5 text-[11px] text-gray-200 outline-none`} /> : <Component2431 autoFocus={true} rows={3} value={n} onChange={n => {
        return _t(e.id, {
          [t]: n.target.value
        });
      }} placeholder={Dt(t)} className={`w-full rounded bg-[#262626] border border-[#3a3a3a] px-2 py-1.5 text-[11px] text-gray-200 outline-none resize-none`} />}
        {t === `motion` && <Component2434 className={`flex flex-wrap gap-1`}>
            {C_.map(t => {
          return <Component2432 className={`px-2 py-1 rounded text-[11px] bg-[#2a2a2a] text-gray-300 hover:bg-[#333] nodrag border border-[#3a3a3a]`} onClick={() => {
            let r = n ? `${n}，${t}` : t;
            _t(e.id, {
              motion: r
            });
          }} key={t}>
                  {t}
                </Component2432>;
        })}
            <Component2433 className={`w-full mt-1 text-[10px] text-gray-500`}>{`点击预设直接填入`}</Component2433>
          </Component2434>}
        <Component2436 className={`flex justify-end mt-1`}>
          <Component2435 className={`px-3 py-1.5 rounded-lg bg-gray-100 text-gray-950 font-medium text-[11px] hover:bg-white transition-colors`} onClick={() => {
          return B(null);
        }}>{`保存`}</Component2435>
        </Component2436>
      </Component2437>;
  };
  let At = (e, t, n, r, i) => {
    let a = e[t] || ``;
    let o = J(e.id, t);
    let s = Ve.current[o] || {
      top: 0,
      left: 0
    };
    let c = i?.paddingX ?? 8;
    let l = i?.paddingY ?? 8;
    let u = i?.fontSizePx ?? 11;
    let d = i?.lineHeight ?? 1.625;
    let f = i?.minHeightPx ?? 60;
    let p = Be.current[o];
    let m = T_(a);
    if (p === undefined) {
      Be.current[o] = m;
    }
    Le.current[o] ||= m;
    let g = `${l}px ${c}px`;
    let _ = {
      width: `100%`,
      fontSize: `${u}px`,
      lineHeight: d,
      padding: g,
      margin: 0,
      border: `none`,
      boxSizing: `border-box`,
      fontFamily: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
      fontWeight: 400,
      letterSpacing: 0,
      tabSize: 4,
      wordBreak: `break-word`,
      whiteSpace: `pre-wrap`
    };
    let v = {
      ..._,
      minHeight: `${f}px`,
      overflow: `auto`,
      scrollbarGutter: `stable`
    };
    const Component2438 = `div`;
    const Component2439 = `span`;
    const Component2440 = `span`;
    const Component2441 = `span`;
    const Component2442 = `div`;
    const Component2443 = `div`;
    const Component2444 = `div`;
    const Component2445 = `div`;
    return <Component2445 className={`relative group w-full overflow-hidden ${n}`} style={{
      minHeight: `${f}px`
    }}>
        <_cmp__Component18 text={a} names={Ue} placeholder={r} scrollTop={s.top} scrollLeft={s.left} className={`absolute inset-0 z-0 custom-scrollbar pointer-events-none`} style={_} />
        <Component2438 ref={e => {
        Ie.current[o] = e;
        if (e) {
          let t = Le.current[o] || Be.current[o];
          if (t && e.innerHTML !== t) {
            e.innerHTML = t;
          }
        }
      }} role={`textbox`} contentEditable={true} suppressContentEditableWarning={true} spellCheck={false} data-placeholder={r} className={`relative z-10 w-full bg-transparent text-transparent caret-white whitespace-pre-wrap break-words cursor-text outline-none nodrag nowheel nopan overflow-auto custom-scrollbar`} style={v} onClick={e => {
        let t = e.currentTarget;
        let n = xo(t);
        Re.current[o] = n;
        if (P === o) {
          let e = t.innerText.replace(/\u00a0/g, ` `).substring(0, n);
          let r = e.lastIndexOf(`@`);
          if (r >= 0) {
            let n = e.substring(r + 1);
            if (n === `` || /^\d+$/.test(n)) {
              let e = qe(t);
              let n = t.getBoundingClientRect();
              let r = e ? e.bottom + 4 : n.bottom + 4;
              let i = e ? e.left : n.left;
              i = Math.min(Math.max(i, n.left), Math.max(n.left, n.right - 232));
              L({
                top: r,
                left: i
              });
            }
          }
        }
      }} onInput={n => {
        let r = n.currentTarget;
        let i = r.innerText.replace(/\u00a0/g, ` `);
        let a = xo(r);
        Re.current[o] = a;
        Le.current[o] = r.innerHTML;
        _t(e.id, {
          [t]: i
        });
        let s = i.substring(0, a);
        let c = s.lastIndexOf(`@`);
        if (c >= 0) {
          let e = s.substring(c + 1);
          if (e === `` || /^\d+$/.test(e)) {
            He.current[o] = c;
            let e = qe(r);
            let t = r.getBoundingClientRect();
            let n = e ? e.bottom + 4 : t.bottom + 4;
            let i = e ? e.left : t.left;
            i = Math.min(Math.max(i, t.left), Math.max(t.left, t.right - 232));
            L({
              top: n,
              left: i
            });
            F(o);
          } else {
            He.current[o] = -1;
            if (P === o) {
              F(null);
              L(null);
            }
          }
        } else {
          He.current[o] = -1;
          if (P === o) {
            F(null);
            L(null);
          }
        }
      }} onKeyDown={n => {
        let r = n.currentTarget;
        let i = xo(r);
        Re.current[o] = i;
        if (n.key === `Backspace` || n.key === `Delete`) {
          let o = window.getSelection();
          if (!o || o.isCollapsed) {
            let o = Do(a, Ue, i, n.key);
            if (o) {
              n.preventDefault();
              Ye(e.id, t, o.text, o.cursor);
              requestAnimationFrame(() => {
                return Eo(r, o.cursor);
              });
              return;
            }
          }
        }
        if (n.key === ` `) {
          let o = Oo(a, i, a.lastIndexOf(`@`, i - 1), Ue);
          if (o) {
            n.preventDefault();
            Ye(e.id, t, o.text, o.cursor);
            F(null);
            L(null);
            requestAnimationFrame(() => {
              return Eo(r, o.cursor);
            });
            return;
          }
        }
        if (n.key === `Enter`) {
          if (n.ctrlKey || n.metaKey) {
            return;
          }
          let o = Oo(a, i, a.lastIndexOf(`@`, i - 1), Ue);
          n.preventDefault();
          let s = (() => {
            if (o) {
              return {
                text: o.text,
                cursor: o.cursor
              };
            }
            let e = a.substring(0, i);
            let t = a.substring(i);
            return {
              text: `${e}
${t}`,
              cursor: e.length + 1
            };
          })();
          Ye(e.id, t, s.text, s.cursor);
          if (o) {
            F(null);
            L(null);
          }
          requestAnimationFrame(() => {
            return Eo(r, s.cursor);
          });
          return;
        }
        if (n.key === `Escape` && P === o) {
          F(null);
          L(null);
        }
      }} onScroll={e => {
        Ve.current[o] = {
          top: e.currentTarget.scrollTop,
          left: e.currentTarget.scrollLeft
        };
      }} onWheel={e => {
        return e.stopPropagation();
      }} />
        {P === o && I && Fn.createPortal(<Component2444 className={`fixed z-[99999] w-56 max-h-60 overflow-y-auto rounded-lg border border-[#3a3a3a] bg-[#202020] p-1 shadow-xl nowheel nopan nodrag`} style={{
        top: I.top,
        left: I.left
      }} onWheel={e => {
        return e.stopPropagation();
      }} onMouseDown={e => {
        return e.preventDefault();
      }} onClick={e => {
        return e.stopPropagation();
      }}>
              {h.length > 0 ? h.map((n, r) => {
          return <Component2442 role={`button`} className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] cursor-pointer text-gray-300 hover:bg-[#2a2a2a]`} onMouseDown={r => {
            r.preventDefault();
            r.stopPropagation();
            Xe(e.id, t, n.name, true);
          }} key={n.id}>
                      <Component2439 className={`shrink-0 text-gray-500`}>
                        {w_[n.category]}
                      </Component2439>
                      <Component2440 className={`flex-1 truncate`}>{n.name}</Component2440>
                      <Component2441 className={`text-gray-600 text-[9px]`}>
                        {`(@`}
                        {r + 1}
                        {`)`}
                      </Component2441>
                    </Component2442>;
        }) : <Component2443 className={`px-2 py-2 text-[11px] text-gray-600`}>{`暂无资产，先生成脚本`}</Component2443>}
            </Component2444>, document.body)}
      </Component2445>;
  };
  Z.useLayoutEffect(() => {
    let e = new Map();
    Object.keys(Ie.current).forEach(t => {
      let [n, r] = t.split(/:(.+)/);
      if (n && r) {
        e.set(t, {
          shotId: n,
          field: r
        });
      }
    });
    Object.keys(Ie.current).forEach(t => {
      let n = Ie.current[t];
      ze.current[t] = false;
      if (!n || document.activeElement === n) {
        return;
      }
      let r = e.get(t);
      let i = Le.current[t] || Be.current[t];
      let a;
      if (r) {
        let e = m.find(e => {
          return e.id === r.shotId;
        });
        if (e) {
          a = e[r.field];
        }
      }
      let o = a === undefined ? i : T_(a);
      if (o && n.innerHTML !== o) {
        n.innerHTML = o;
        Le.current[t] = o;
        Re.current[t] = Math.min(Re.current[t] || 0, a?.length ?? (n.textContent || ``).length);
      }
    });
  });
  let jt = e => {
    if (e) {
      return e.split(`
`).map(e => {
        let t = e.trim();
        let n = t.match(/^\[([^|\]]*)\|([^\]]*)\]\s?(.*)$/);
        if (n) {
          return {
            kind: n[1] || `台词`,
            role: n[2] || ``,
            text: n[3] || ``
          };
        } else {
          n = t.match(/^\[旁白\]\s?(.*)$/);
          if (n) {
            return {
              kind: `旁白`,
              role: ``,
              text: n[1] || ``
            };
          } else {
            n = t.match(/^(?:台词|对白)[（(]([^）)]+)[）)]\s*[：:]\s*(.*)$/);
            if (n) {
              return {
                kind: `台词`,
                role: n[1],
                text: n[2] || ``
              };
            } else {
              n = t.match(/^([^：:【\[]+?)\s*[：:]\s*(.*)$/);
              if (n && n[1].trim() !== `旁白`) {
                return {
                  kind: `台词`,
                  role: n[1].trim(),
                  text: n[2] || ``
                };
              } else {
                n = t.match(/^旁白\s*[：:]?\s*(.*)$/);
                if (n) {
                  return {
                    kind: `旁白`,
                    role: ``,
                    text: n[1] || ``
                  };
                } else {
                  return {
                    kind: `台词`,
                    role: ``,
                    text: t
                  };
                }
              }
            }
          }
        }
      });
    } else {
      return [];
    }
  };
  let Mt = e => {
    return e.map(e => {
      return `[${e.kind}|${e.role}] ${e.text}`;
    }).join(`
`);
  };
  let Nt = et.map((e, t) => {
    if (t === 2) {
      return `minmax(160px,${e}px)`;
    } else {
      return `${e}px`;
    }
  }).join(` `);
  let Pt = (e, t) => {
    t.preventDefault();
    t.stopPropagation();
    let n = t.clientX;
    let r = et[e];
    let i = t => {
      let i = [...et];
      i[e] = Math.max(28, r + (t.clientX - n));
      tt(i);
    };
    let a = () => {
      window.removeEventListener(`mousemove`, i);
      window.removeEventListener(`mouseup`, a);
    };
    window.addEventListener(`mousemove`, i);
    window.addEventListener(`mouseup`, a);
  };
  const Component2446 = `div`;
  let Ft = ({
    idx: e
  }) => {
    return <Component2446 className={`absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-white/30 nodrag`} onMouseDown={t => {
      return Pt(e, t);
    }} />;
  };
  const Component2447 = `div`;
  const Component2448 = `input`;
  const Component2449 = `span`;
  const Component2450 = `div`;
  const Component2451 = `div`;
  const Component2452 = `span`;
  const Component2453 = `button`;
  const Component2454 = `div`;
  const Component2455 = `div`;
  const Component2456 = `div`;
  const Component2457 = `span`;
  const Component2458 = `button`;
  const Component2459 = `div`;
  const Component2460 = `span`;
  const Component2461 = `span`;
  const Component2462 = `span`;
  const Component2463 = `span`;
  const Component2464 = `div`;
  const Component2465 = `span`;
  const Component2466 = `button`;
  const Component2478 = `button`;
  const Component2479 = `div`;
  const Component2480 = `div`;
  const Component2481 = `div`;
  const Component2482 = `span`;
  const Component2483 = `button`;
  const Component2484 = `div`;
  const Component2485 = `span`;
  const Component2486 = `button`;
  const Component2487 = `div`;
  const Component2488 = `button`;
  const Component2489 = `div`;
  const Component2490 = `div`;
  const Component2491 = `div`;
  let It = (e, t) => {
    return <Component2491 className={`relative border-t border-[#2a2a2a] hover:bg-[#202020] min-h-[88px]`} key={e.id}>
        <Component2490 className={`grid ${t ? `grid-cols-[44px_92px_minmax(220px,1.6fr)_96px_120px_150px_110px_96px_34px]` : ``} items-stretch min-h-[88px]`} style={t ? undefined : {
        gridTemplateColumns: Nt
      }}>
          <Component2447 className={`px-2 py-3 text-xs text-white flex items-center`}>
            {e.index}
          </Component2447>
          <Component2450 className={`relative flex items-center gap-1 px-1.5 py-4`}>
            <Component2448 type={`number`} min={1} max={60} step={1} value={Math.max(1, Number.parseInt(e.duration || `5`, 10) || 5)} onChange={t => {
            return _t(e.id, {
              duration: `${Math.max(1, Number(t.target.value) || 1)}s`
            });
          }} className={`min-w-0 flex-1 rounded bg-[#242424] py-1 pl-2 pr-1 text-[11px] text-gray-300 outline-none [color-scheme:dark] hover:bg-[#2a2a2a] focus:bg-[#2a2a2a] nodrag`} />
            <Component2449 className={`shrink-0 text-[10px] text-gray-500`}>{`秒`}</Component2449>
          </Component2450>
          <Component2451 className={`relative`}>
            {At(e, `description`, `w-full h-full bg-transparent rounded min-h-[72px] overflow-hidden`, `画面描述，输入 @ 引用资产`, {
            paddingX: 8,
            paddingY: 8,
            fontSizePx: 12,
            lineHeight: 1.625,
            minHeightPx: 72
          })}
          </Component2451>
          <Component2456 className={`relative`}>
            <Component2453 className={`w-full h-full bg-transparent rounded px-2 py-3 text-[11px] leading-relaxed nodrag text-left flex items-center justify-between`} onClick={t => {
            t.stopPropagation();
            R(ee === e.id ? null : e.id);
            F(null);
            z(null);
            B(null);
          }}>
              <Component2452 className={e.shotType ? `text-gray-300` : `text-gray-600`}>
                {e.shotType || `景别`}
              </Component2452>
              <_Component33 size={10} className={`text-gray-500 shrink-0`} />
            </Component2453>
            {ee === e.id && <Component2455 className={`absolute z-50 top-full left-0 mt-1 w-28 max-h-52 overflow-y-auto rounded-lg border border-[#3a3a3a] bg-[#202020] p-1 shadow-xl nowheel nopan nodrag`} onWheel={e => {
            return e.stopPropagation();
          }} onClick={e => {
            return e.stopPropagation();
          }}>
                {x_.map(t => {
              return <Component2454 role={`button`} className={`px-2 py-1.5 rounded text-[11px] cursor-pointer ${e.shotType === t ? `bg-[#333] text-white` : `text-gray-300 hover:bg-[#2a2a2a]`}`} onClick={() => {
                _t(e.id, {
                  shotType: t
                });
                R(null);
              }} key={t}>
                      {t}
                    </Component2454>;
            })}
              </Component2455>}
          </Component2456>
          {t && <Component2459 className={`relative`}>
              <Component2458 className={`w-full h-full bg-transparent rounded px-2 py-3 text-[11px] leading-relaxed nodrag text-left truncate`} onClick={t => {
            t.stopPropagation();
            Tt(e.id, `lighting`);
          }}>
                <Component2457 className={e.lighting ? `text-gray-300` : `text-gray-600`}>
                  {e.lighting || `光影氛围`}
                </Component2457>
              </Component2458>
              {kt(e, `lighting`)}
            </Component2459>}
          {t && <Component2481 className={`relative`}>
              <Component2466 className={`w-full h-full bg-transparent rounded px-2 py-3 text-[11px] leading-relaxed nodrag text-left truncate`} onClick={t => {
            t.stopPropagation();
            z(te === e.id ? null : e.id);
            F(null);
            R(null);
            B(null);
          }}>
                {e.dialogue ? <Component2464 className={`flex flex-col gap-1`}>
                    {jt(e.dialogue).map((e, t) => {
                return <Component2463 className={`text-gray-300 truncate text-[10px]`} key={t}>
                          {e.kind === `旁白` ? <Component2460 className={`text-gray-200`}>
                              {`[旁白] `}
                              {e.text}
                            </Component2460> : <Component2462>
                              <Component2461 className={`text-cyan-400`}>
                                {e.role || `未知角色`}
                              </Component2461>
                              {`: `}
                              {e.text}
                            </Component2462>}
                        </Component2463>;
              })}
                  </Component2464> : <Component2465 className={`text-gray-600`}>{`对白/旁白`}</Component2465>}
              </Component2466>
              {te === e.id && <Component2480 className={`absolute z-50 top-full left-0 mt-1 w-[360px] rounded-lg border border-[#3a3a3a] bg-[#202020] p-3 shadow-xl nowheel nopan nodrag space-y-2`} onWheel={e => {
            return e.stopPropagation();
          }} onClick={e => {
            return e.stopPropagation();
          }}>
                  {(() => {
              let t = jt(e.dialogue);
              const Component2467 = `button`;
              const Component2468 = `option`;
              const Component2469 = `option`;
              const Component2470 = `select`;
              const Component2471 = `textarea`;
              const Component2472 = `button`;
              const Component2473 = `div`;
              const Component2474 = `button`;
              const Component2475 = `button`;
              const Component2476 = `div`;
              const Component2477 = `div`;
              return <Component2477 className={`space-y-2`}>
                        {t.map((n, r) => {
                  return <Component2473 className={`flex items-center gap-2`} key={r}>
                              <Component2467 type={`button`} className={`w-[52px] shrink-0 rounded border border-transparent px-1 py-1 text-[10px] outline-none nodrag ${n.kind === `旁白` ? `bg-purple-500/20 text-purple-300` : `bg-cyan-500/20 text-cyan-400`}`} onClick={() => {
                      let i = [...t];
                      let a = n.kind === `旁白` ? `台词` : `旁白`;
                      i[r] = {
                        ...i[r],
                        kind: a,
                        role: a === `旁白` ? `` : i[r].role
                      };
                      _t(e.id, {
                        dialogue: Mt(i)
                      });
                    }}>
                                {n.kind}
                              </Component2467>
                              {n.kind === `台词` && <Component2470 value={n.role} onChange={n => {
                      let i = [...t];
                      i[r] = {
                        ...i[r],
                        role: n.target.value
                      };
                      _t(e.id, {
                        dialogue: Mt(i)
                      });
                    }} className={`w-[48px] rounded bg-[#1a1a1a] border border-[#3a3a3a] px-0.5 py-0.5 text-[10px] text-gray-200 outline-none nodrag text-center`}>
                                  <Component2468 value={``}>{`角色`}</Component2468>
                                  {y.map(e => {
                        return <Component2469 value={e.name} key={e.id}>
                                        {e.name}
                                      </Component2469>;
                      })}
                                </Component2470>}
                              <Component2471 rows={1} value={n.text} onChange={n => {
                      let i = [...t];
                      i[r] = {
                        ...i[r],
                        text: n.target.value
                      };
                      _t(e.id, {
                        dialogue: Mt(i)
                      });
                    }} placeholder={n.kind === `旁白` ? `旁白内容` : `台词内容`} className={`flex-1 rounded bg-[#1a1a1a] border border-[#3a3a3a] px-2 py-1.5 text-[11px] text-gray-200 outline-none resize-none min-h-[28px] nodrag`} />
                              <Component2472 className={`p-1 text-gray-500 hover:text-red-400 shrink-0 nodrag mt-0.5`} onClick={() => {
                      let n = [...t];
                      n.splice(r, 1);
                      _t(e.id, {
                        dialogue: Mt(n)
                      });
                    }}>
                                <Gt size={12} />
                              </Component2472>
                            </Component2473>;
                })}
                        <Component2476 className={`flex items-center gap-2 pt-1`}>
                          <Component2474 className={`px-2 py-1 rounded bg-[#2a2a2a] text-gray-300 hover:bg-[#333] text-[10px] flex items-center gap-1 nodrag`} onClick={() => {
                    return _t(e.id, {
                      dialogue: Mt([{
                        kind: `台词`,
                        role: ``,
                        text: ``
                      }, ...t])
                    });
                  }}>
                            <Xt size={10} />
                            {` 台词`}
                          </Component2474>
                          <Component2475 className={`px-2 py-1 rounded bg-[#2a2a2a] text-gray-300 hover:bg-[#333] text-[10px] flex items-center gap-1 nodrag`} onClick={() => {
                    return _t(e.id, {
                      dialogue: Mt([{
                        kind: `旁白`,
                        role: ``,
                        text: ``
                      }, ...t])
                    });
                  }}>
                            <Xt size={10} />
                            {` 旁白`}
                          </Component2475>
                        </Component2476>
                      </Component2477>;
            })()}
                  <Component2479 className={`flex justify-end pt-1`}>
                    <Component2478 className={`px-3 py-1.5 rounded-lg bg-gray-100 text-gray-950 font-medium text-[11px] hover:bg-white transition-colors`} onClick={() => {
                return z(null);
              }}>{`保存`}</Component2478>
                  </Component2479>
                </Component2480>}
            </Component2481>}
          {t && <Component2484 className={`relative`}>
              <Component2483 className={`w-full h-full bg-transparent rounded px-2 py-3 text-[11px] leading-relaxed nodrag text-left truncate`} onClick={t => {
            t.stopPropagation();
            Tt(e.id, `sound`);
          }}>
                <Component2482 className={e.sound ? `text-gray-300` : `text-gray-600`}>
                  {e.sound || `音效`}
                </Component2482>
              </Component2483>
              {kt(e, `sound`)}
            </Component2484>}
          <Component2487 className={`relative`}>
            <Component2486 className={`w-full h-full bg-transparent rounded px-2 py-3 text-[11px] leading-relaxed nodrag text-left truncate`} onClick={t => {
            t.stopPropagation();
            Tt(e.id, `motion`);
          }}>
              <Component2485 className={e.motion ? `text-gray-300` : `text-gray-600`}>
                {e.motion || `运镜`}
              </Component2485>
            </Component2486>
            {kt(e, `motion`)}
          </Component2487>
          <Component2489 className={`px-1 py-5 flex items-center justify-center`}>
            <Component2488 className={`p-1 text-gray-500 hover:text-red-400 nodrag`} onClick={t => {
            t.stopPropagation();
            xt(e.id);
          }}>
              <Ot size={12} />
            </Component2488>
          </Component2489>
        </Component2490>
      </Component2491>;
  };
  let Lt = Z.useMemo(() => {
    return (p.drawingModelForScript || ``).split(`
`).map(e => {
      return e.trim();
    }).filter(Boolean);
  }, [p.drawingModelForScript]);
  let Rt = p.assetModelSettings || {};
  let zt = t => {
    return r(e, {
      assetModelSettings: {
        ...Rt,
        ...t
      }
    });
  };
  let Ht = Rt.globalModel || ``;
  let Ut = Fa(Ht);
  let Wt = Ut ? ot.find(e => {
    return e.id === Ut;
  }) : null;
  let qt = Wt ? `` : Ht || Lt[0] || ``;
  let Jt = qt && ma(qt) ? sa(qt) : null;
  let Yt = () => {
    let e = Lt;
    let t = e.filter(e => {
      return ma(e);
    }).sort((e, t) => {
      return e.localeCompare(t);
    });
    let n = e.filter(e => {
      return !ma(e);
    }).sort((e, t) => {
      return e.localeCompare(t);
    });
    let r = e => {
      zt({
        globalModel: e
      });
      rt(false);
    };
    let i = (e, t) => {
      let n = t ? sa(e) : null;
      let i = t ? ca(e) : null;
      const Component2492 = `span`;
      const Component2493 = `span`;
      const Component2494 = `span`;
      const Component2495 = `div`;
      return <Component2495 role={`button`} className={`w-full flex items-center gap-1.5 mb-1 last:mb-0 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors cursor-pointer ${Ht === e ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} onClick={() => {
        return r(e);
      }} title={e} key={`${t ? `b` : `o`}-${e}`}>
          <Component2492 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${t ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
            {t ? `内置` : `三方`}
          </Component2492>
          <Component2493 className={`flex-1 whitespace-nowrap`}>{e}</Component2493>
          {n !== null && <Component2494 className={`shrink-0 inline-flex items-center gap-0.5 text-[10px] text-orange-400 tabular-nums`}>
              <_Component19 className={`w-2.5 h-2.5`} strokeWidth={2.5} />
              {ha(n)}
              {i ? `/${i}` : ``}
            </Component2494>}
        </Component2495>;
    };
    const Component2496 = `span`;
    const Component2497 = `span`;
    const Component2498 = `span`;
    const Component2499 = `span`;
    const Component2500 = `button`;
    const Component2501 = `span`;
    const Component2502 = `span`;
    const Component2503 = `div`;
    const Component2508 = `div`;
    const Component2509 = `span`;
    const Component2510 = `span`;
    const Component2511 = `span`;
    const Component2512 = `div`;
    const Component2513 = `div`;
    const Component2514 = `div`;
    const Component2515 = `div`;
    const Component2516 = `div`;
    const Component2517 = `div`;
    return <Component2517 className={`relative nodrag flex items-center`} ref={at} onClick={e => {
      return e.stopPropagation();
    }}>
        <Component2500 className={`flex items-center gap-1 h-7 px-2 bg-[#262626] hover:bg-[#2a2a2a] border border-[#3a3a3a] hover:border-[#555] rounded-lg text-[11px] text-gray-300 transition-colors cursor-pointer max-w-[200px]`} onClick={e => {
        e.stopPropagation();
        rt(e => {
          return !e;
        });
      }} title={Wt ? `调度：${Wt.name}` : qt || `选择模型`}>
          {Wt ? <Component2496 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border bg-blue-500/20 text-blue-200 border-blue-400/40`}>{`调度`}</Component2496> : qt && <Component2497 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${ma(qt) ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                {ma(qt) ? `内置` : `三方`}
              </Component2497>}
          <Component2498 className={`whitespace-nowrap truncate`}>
            {Wt ? Wt.name : qt || `选择模型`}
          </Component2498>
          {Jt !== null && <Component2499 className={`shrink-0 inline-flex items-center gap-0.5 text-[10px] text-orange-400 tabular-nums`}>
              <_Component19 className={`w-2.5 h-2.5`} strokeWidth={2.5} />
              {ha(Jt)}
              {ca(qt) ? `/${ca(qt)}` : ``}
            </Component2499>}
          <_Component33 size={12} />
        </Component2500>
        {nt && <Component2516 className={`absolute bottom-full right-0 mb-1 min-w-[17rem] w-max max-w-[29rem] bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 max-h-72 overflow-y-auto custom-scrollbar nowheel nopan nodrag`} onClick={e => {
        return e.stopPropagation();
      }} onWheel={e => {
        return e.stopPropagation();
      }}>
            {ot.length > 0 && <Q.Fragment>
                <Component2503 className={`text-[10px] text-blue-300 mb-1 px-1 flex items-center justify-between`}>
                  <Component2501 className={`flex items-center gap-1`}>
                    <_Component19 className={`w-2.5 h-2.5`} strokeWidth={2.5} />
                    {`模型调度`}
                  </Component2501>
                  <Component2502 className={`ml-auto text-white/90 hover:text-white cursor-pointer`} onClick={e => {
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent(`mutiwindow-open-schedule-settings`));
            }}>{`配置 ›`}</Component2502>
                </Component2503>
                {ot.map(e => {
            let t = Pa(e.id);
            const Component2504 = `span`;
            const Component2505 = `span`;
            const Component2506 = `span`;
            const Component2507 = `div`;
            return <Component2507 role={`button`} className={`w-full flex items-center gap-1.5 mb-1 last:mb-0 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors cursor-pointer ${Ht === t ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} onClick={() => {
              return r(t);
            }} title={`${e.name}（${e.steps.length} 个模型按序重试）`} key={e.id}>
                      <Component2504 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border bg-blue-500/20 text-blue-200 border-blue-400/40`}>{`调度`}</Component2504>
                      <Component2505 className={`flex-1 whitespace-nowrap`}>{e.name}</Component2505>
                      <Component2506 className={`shrink-0 text-[10px] text-gray-500`}>
                        {e.steps.length}
                        {` 模型`}
                      </Component2506>
                    </Component2507>;
          })}
                {(t.length > 0 || n.length > 0) && <Component2508 className={`h-px bg-[#333] my-1.5`} />}
              </Q.Fragment>}
            {t.length > 0 && <Q.Fragment>
                <Component2512 className={`text-[10px] text-blue-300 mb-1 px-1 flex items-center gap-1`}>
                  <Component2509>{`✨`}</Component2509>
                  <Component2510>{`内置模型`}</Component2510>
                  <Component2511 className={`ml-auto text-white/90 hover:text-white cursor-pointer whitespace-nowrap`} onClick={e => {
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent(`mutiwindow-open-builtin-settings`));
              rt(false);
            }} title={`查看内置模型详情`}>{`详情 ›`}</Component2511>
                </Component2512>
                {t.map(e => {
            return i(e, true);
          })}
              </Q.Fragment>}
            {n.length > 0 && <Q.Fragment>
                {t.length > 0 && <Component2513 className={`h-px bg-[#333] my-1.5`} />}
                <Component2514 className={`text-[10px] text-gray-500 mb-1 px-1`}>{`第三方模型`}</Component2514>
                {n.map(e => {
            return i(e, false);
          })}
              </Q.Fragment>}
            {e.length === 0 && ot.length === 0 && <Component2515 className={`px-2 py-2 text-[11px] text-gray-600`}>{`请先在设置中配置生图模型（可点‘恢复默认’修复）`}</Component2515>}
          </Component2516>}
      </Component2517>;
  };
  let Zt = (t = false) => {
    let n = t ? `grid-cols-8` : `grid-cols-5`;
    const Component2518 = `button`;
    const Component2519 = `div`;
    const Component2520 = `div`;
    const Component2521 = `div`;
    const Component2522 = `input`;
    const Component2523 = `div`;
    const Component2524 = `div`;
    const Component2525 = `img`;
    const Component2526 = `div`;
    const Component2527 = `div`;
    const Component2528 = `div`;
    const Component2529 = `div`;
    const Component2530 = `div`;
    const Component2531 = `div`;
    const Component2532 = `span`;
    const Component2533 = `button`;
    const Component2534 = `div`;
    const Component2535 = `button`;
    const Component2536 = `button`;
    const Component2537 = `button`;
    const Component2538 = `button`;
    const Component2539 = `button`;
    const Component2540 = `button`;
    const Component2541 = `button`;
    const Component2542 = `div`;
    const Component2543 = `div`;
    const Component2544 = `div`;
    const Component2545 = `div`;
    const Component2546 = `div`;
    const Component2547 = `div`;
    const Component2548 = `div`;
    const Component2549 = `span`;
    const Component2550 = `div`;
    const Component2551 = `div`;
    const Component2552 = `div`;
    const Component2553 = `div`;
    return <Component2553>
        <Component2520 className={`flex items-center justify-end mb-2 gap-2`}>
          <Component2519 className={`flex items-center gap-2`}>
            {Yt()}
            <Component2518 className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-950 text-xs font-medium hover:bg-white nodrag nopan shrink-0`} title={Ne.size > 0 ? `生成勾选的 ${Ne.size} 项` : `生成全部空缺项`} onClick={t => {
            t.stopPropagation();
            let n = h.filter(e => {
              return Ne.has(e.id);
            }).map(e => {
              return e.id;
            });
            p.onGenerateAllAssetImages?.(e, n.length > 0 ? n : undefined);
          }}>
              <_Component89 size={12} />
              {` 批量生成`}
              {Ne.size > 0 ? `（${Ne.size}）` : ``}
            </Component2518>
          </Component2519>
        </Component2520>
        <Component2523 className={`mb-3`}>
          <Component2521 className={`text-[11px] text-gray-500 mb-1`}>{`统一风格说明`}</Component2521>
          <Component2522 value={p.globalStyle || ``} onChange={t => {
          return r(e, {
            globalStyle: t.target.value
          });
        }} placeholder={`例如：中世纪童话·皮克斯3D`} className={`w-full rounded-lg bg-[#242424] border border-transparent focus:border-gray-500 px-2.5 py-2 text-xs text-gray-200 outline-none nodrag transition-colors`} />
        </Component2523>
        {[`character`, `scene`, `prop`].map(t => {
        return <Component2552 className={`mb-5`} key={t}>
              <Component2524 className={`text-[11px] font-medium text-gray-300 mb-2`}>
                {w_[t]}
              </Component2524>
              <Component2551 className={`grid ${n} gap-1.5`}>
                {v[t].map(t => {
              return <Component2548 className={`rounded-lg border bg-[#212121] overflow-hidden transition-colors ${Ne.has(t.id) ? `border-gray-300` : `border-transparent hover:border-[#3a3a3a]`}`} key={t.id}>
                      <Component2544 className={`aspect-square bg-[#1a1a1a] relative flex items-center justify-center cursor-pointer nodrag overflow-hidden`} onClick={() => {
                  return N(t.id);
                }} onDoubleClick={e => {
                  e.stopPropagation();
                  if (t.imageUrl) {
                    le(t.imageUrl);
                  }
                }} title={`单击编辑提示词 · 双击放大查看`}>
                        {t.imageUrl ? <Q.Fragment>
                            <Component2525 src={_(t.imageUrl, t.thumbnailUrl)} alt={t.name} loading={`lazy`} decoding={`async`} className={`w-full h-full object-cover ${t.loading ? `opacity-55` : ``}`} onError={e => {
                      let n = e.currentTarget;
                      let r = p.videoUploadedAssets?.[t.imageUrl || ``] || t.imageUrl;
                      if (r && n.src !== r) {
                        n.src = r;
                      }
                    }} />
                            {t.loading && <Component2529 className={`absolute inset-0 pointer-events-none overflow-hidden`}>
                                <Component2526 className={`absolute inset-0 bg-black/25`} />
                                <Component2527 className={`absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer`} />
                                <Component2528 className={`absolute inset-0 flex items-center justify-center`}>
                                  <_Component22 size={16} className={`animate-spin text-white drop-shadow`} />
                                </Component2528>
                              </Component2529>}
                          </Q.Fragment> : t.loading ? <Component2531 className={`absolute inset-0 flex items-center justify-center overflow-hidden`}>
                            <Component2530 className={`absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer`} />
                            <_Component22 size={14} className={`animate-spin text-gray-400 relative z-10`} />
                          </Component2531> : <Component2532 className={`text-[9px] text-gray-600 px-1 text-center`}>{`点击编辑`}</Component2532>}
                        <Component2533 className={`absolute top-1 left-1 w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] border ${Ne.has(t.id) ? `bg-white border-white text-black` : `bg-black/50 border-white/40 text-transparent`}`} title={`勾选以批量生成`} onClick={e => {
                    e.stopPropagation();
                    Fe(t.id);
                  }}>{`✓`}</Component2533>
                        {t.category === `character` && t.audioUrl && <Component2534 className={`absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/90 text-white shadow`}>
                            <Dn size={9} strokeWidth={2.5} />
                          </Component2534>}
                        <Component2543 className={`absolute top-1 right-1`}>
                          {t.loading ? <Component2535 className={`p-1 rounded bg-red-500/70 text-white hover:bg-red-500`} title={`取消生成`} onClick={n => {
                      n.stopPropagation();
                      p.onStopScriptItem?.(e, `asset`, t.id);
                    }}>
                              <T size={11} fill={`currentColor`} />
                            </Component2535> : <Q.Fragment>
                              <Component2536 className={`p-1 rounded bg-black/60 text-gray-200 hover:text-white`} title={`更多操作`} onClick={e => {
                        e.stopPropagation();
                        if (ue === t.id) {
                          de(null);
                          he(null);
                          return;
                        }
                        let n = e.currentTarget.getBoundingClientRect();
                        he({
                          top: n.bottom + 4,
                          left: Math.max(8, n.right - 128)
                        });
                        de(t.id);
                      }}>
                                <Bt size={12} />
                              </Component2536>
                              {ue === t.id && pe && Fn.createPortal(<Component2542 className={`fixed z-[9999] w-32 rounded-lg border border-[#3a3a3a] bg-[#202020] p-1 shadow-xl`} style={{
                        top: pe.top,
                        left: pe.left
                      }} onClick={e => {
                        return e.stopPropagation();
                      }}>
                                    <Component2537 className={`w-full rounded px-2 py-1.5 text-left text-[10px] text-gray-300 hover:bg-[#2a2a2a]`} onClick={() => {
                          p.onGenerateAssetImage?.(e, t.id);
                          de(null);
                          he(null);
                        }}>{`重新生成`}</Component2537>
                                    <Component2538 className={`w-full rounded px-2 py-1.5 text-left text-[10px] text-gray-300 hover:bg-[#2a2a2a]`} onClick={() => {
                          Ct(t.id);
                          de(null);
                          he(null);
                        }}>{`从资源选择`}</Component2538>
                                    {t.category === `character` && <Q.Fragment>
                                        {t.audioUrl ? <Component2539 className={`w-full rounded px-2 py-1.5 text-left text-[10px] text-amber-300 hover:bg-amber-500/10`} title={t.audioUrl} onClick={() => {
                            vt(t.id, {
                              audioUrl: undefined
                            });
                            de(null);
                            he(null);
                          }}>{`解绑语音`}</Component2539> : <Component2540 className={`w-full rounded px-2 py-1.5 text-left text-[10px] text-emerald-300 hover:bg-emerald-500/10`} onClick={() => {
                            be.current = t.id;
                            ye(true);
                            de(null);
                            he(null);
                          }}>{`绑定语音`}</Component2540>}
                                      </Q.Fragment>}
                                    <Component2541 className={`w-full rounded px-2 py-1.5 text-left text-[10px] text-red-400 hover:bg-red-500/10`} onClick={() => {
                          r(e, {
                            assets: h.filter(e => {
                              return e.id !== t.id;
                            })
                          });
                          Pe(e => {
                            let n = new Set(e);
                            n.delete(t.id);
                            return n;
                          });
                          if (M === t.id) {
                            N(null);
                          }
                          de(null);
                          he(null);
                        }}>{`删除`}</Component2541>
                                  </Component2542>, document.body)}
                            </Q.Fragment>}
                        </Component2543>
                      </Component2544>
                      <Component2547 className={`px-1.5 py-1`}>
                        <Component2545 className={`text-[10px] font-medium text-gray-100 truncate`}>
                          {t.name}
                        </Component2545>
                        <Component2546 className={`mt-0.5 text-[9px] leading-relaxed text-gray-500 truncate`}>
                          {t.description}
                        </Component2546>
                      </Component2547>
                    </Component2548>;
            })}
                <Component2550 className={`rounded-lg border border-dashed border-[#3a3a3a] bg-transparent hover:bg-[#202020] hover:border-gray-500 cursor-pointer flex flex-col items-center justify-center transition-colors nodrag min-h-[120px]`} onClick={() => {
              let n = {
                id: `asset-${Date.now()}`,
                category: t,
                name: `新${w_[t]}`
              };
              r(e, {
                assets: [...h, n]
              });
              N(n.id);
            }}>
                  <Xt size={16} className={`text-gray-500 mb-1`} />
                  <Component2549 className={`text-[10px] text-gray-500`}>
                    {`新增`}
                    {w_[t]}
                  </Component2549>
                </Component2550>
              </Component2551>
            </Component2552>;
      })}
      </Component2553>;
  };
  let Qt = (t = false) => {
    if (!yt) {
      return null;
    }
    let n = t ? 220 : 240;
    let r = t ? 80 : 96;
    const Component2554 = `div`;
    const Component2555 = `button`;
    const Component2556 = `div`;
    const Component2557 = `img`;
    const Component2558 = `div`;
    const Component2559 = `div`;
    const Component2560 = `div`;
    const Component2561 = `div`;
    const Component2562 = `div`;
    const Component2563 = `div`;
    const Component2564 = `span`;
    const Component2565 = `div`;
    const Component2566 = `div`;
    const Component2567 = `input`;
    const Component2568 = `div`;
    const Component2569 = `div`;
    const Component2570 = `textarea`;
    const Component2571 = `div`;
    const Component2572 = `div`;
    const Component2573 = `textarea`;
    const Component2574 = `div`;
    const Component2575 = `button`;
    const Component2576 = `button`;
    const Component2577 = `div`;
    const Component2578 = `div`;
    const Component2579 = `div`;
    return <Component2579 className={`shrink-0 self-stretch bg-[#191919] border-l border-white/10 flex flex-col nodrag`} style={{
      width: n
    }} onClick={e => {
      return e.stopPropagation();
    }}>
        <Component2556 className={`flex items-center justify-between px-3 py-3 border-b border-white/10`}>
          <Component2554 className={`text-xs text-white truncate`}>
            {`编辑`}
            {w_[yt.category]}
            {` · `}
            {yt.name}
          </Component2554>
          <Component2555 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md shrink-0`} onClick={() => {
          return N(null);
        }} title={`收起`}>
            <Gt size={14} />
          </Component2555>
        </Component2556>
        <Component2578 className={`flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 nowheel`} onWheel={e => {
        return e.stopPropagation();
      }}>
          <Component2565 className={`bg-[#222] rounded-xl overflow-hidden flex items-center justify-center relative`} style={{
          minHeight: r
        }}>
            {yt.imageUrl ? <Q.Fragment>
                <Component2557 src={_(yt.imageUrl, yt.thumbnailUrl)} alt={yt.name} loading={`lazy`} decoding={`async`} className={`w-full object-contain cursor-zoom-in ${yt.loading ? `opacity-55` : ``}`} onError={e => {
              let t = e.currentTarget;
              let n = p.videoUploadedAssets?.[yt.imageUrl || ``] || yt.imageUrl;
              if (n && t.src !== n) {
                t.src = n;
              }
            }} onDoubleClick={() => {
              return le(yt.imageUrl);
            }} title={`双击放大查看`} />
                {yt.loading && <Component2561 className={`absolute inset-0 pointer-events-none overflow-hidden`}>
                    <Component2558 className={`absolute inset-0 bg-black/20`} />
                    <Component2559 className={`absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent animate-shimmer`} />
                    <Component2560 className={`absolute inset-0 flex items-center justify-center`}>
                      <_Component22 size={18} className={`animate-spin text-white drop-shadow`} />
                    </Component2560>
                  </Component2561>}
              </Q.Fragment> : yt.loading ? <Component2563 className={`absolute inset-0 flex items-center justify-center overflow-hidden`}>
                <Component2562 className={`absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer`} />
                <_Component22 size={18} className={`animate-spin text-gray-400 relative z-10`} />
              </Component2563> : <Component2564 className={`text-xs text-gray-600 py-8`}>{`暂无参考图`}</Component2564>}
          </Component2565>
          <Component2568>
            <Component2566 className={`text-[11px] text-gray-500 mb-1`}>
              {w_[yt.category]}
              {`名称`}
            </Component2566>
            <Component2567 value={yt.name} onChange={e => {
            return vt(yt.id, {
              name: e.target.value
            });
          }} className={`w-full rounded-lg bg-[#242424] border border-transparent focus:border-gray-500 px-2.5 py-2 text-xs text-gray-100 outline-none transition-colors`} />
          </Component2568>
          <Component2571>
            <Component2569 className={`text-[11px] text-gray-500 mb-1`}>{`主体描述`}</Component2569>
            <Component2570 value={yt.description || ``} onChange={e => {
            return vt(yt.id, {
              description: e.target.value
            });
          }} placeholder={`该资产的主体外观描述`} className={`w-full min-h-[80px] rounded-lg bg-[#242424] border border-transparent focus:border-gray-500 px-2.5 py-2 text-xs text-gray-200 outline-none resize-y custom-scrollbar nowheel transition-colors`} />
          </Component2571>
          <Component2574>
            <Component2572 className={`text-[11px] text-gray-500 mb-1`}>{`完整生图提示词（可编辑）`}</Component2572>
            <Component2573 value={yt.prompt || ``} onChange={e => {
            return vt(yt.id, {
              prompt: e.target.value
            });
          }} placeholder={`该资产的完整生图提示词`} className={`w-full min-h-[220px] rounded-lg bg-[#242424] border border-transparent focus:border-gray-500 px-2.5 py-2 text-xs text-gray-200 outline-none resize-y custom-scrollbar nowheel transition-colors`} />
          </Component2574>
          <Component2577 className={`flex justify-end gap-2`}>
            <Component2575 className={`px-3 py-1.5 rounded-lg bg-[#262626] text-xs text-gray-300 hover:bg-[#333]`} onClick={() => {
            return Ct(yt.id);
          }}>{`从资源选择`}</Component2575>
            <Component2576 className={`px-3 py-1.5 rounded-lg bg-gray-100 text-gray-950 text-xs font-medium hover:bg-white`} onClick={() => {
            return p.onGenerateAssetImage?.(e, yt.id);
          }}>{`用此提示词生成`}</Component2576>
          </Component2577>
        </Component2578>
      </Component2579>;
  };
  let $t = gt && ma(gt) ? sa(gt) : null;
  let en = p.scriptProgressChars;
  const Component2580 = `div`;
  const Component2581 = `button`;
  const Component2582 = `div`;
  const Component2583 = `span`;
  const Component2584 = `div`;
  const Component2585 = `div`;
  const Component2586 = `button`;
  const Component2587 = `div`;
  let tn = () => {
    if (k) {
      return <Component2582 className={`flex items-center bg-red-500/10 rounded-full p-1 pl-3 border border-red-500/30 hover:border-red-500/50 transition-colors cursor-pointer flex-shrink-0 nodrag nopan`} onMouseDown={e => {
        return e.stopPropagation();
      }} onClick={t => {
        t.stopPropagation();
        p.onStop?.(e);
      }} title={`停止生成`}>
          <Component2580 className={`flex items-center gap-1 mr-3 text-xs text-red-400`}>
            {typeof en == `number` && en > 0 ? `生成中 ${en} 字` : `生成中`}
          </Component2580>
          <Component2581 className={`bg-red-500/20 text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-500/30`}>
            <T size={10} fill={`currentColor`} />
          </Component2581>
        </Component2582>;
    } else {
      return <Component2587 className={`flex items-center rounded-full p-1 pl-3 border transition-colors flex-shrink-0 nodrag nopan ${S.trim() ? `bg-[#2a2a2a] border-[#333] hover:border-gray-500 cursor-pointer` : `bg-[#222] border-[#2a2a2a] opacity-50 cursor-not-allowed`}`} onMouseDown={e => {
        return e.stopPropagation();
      }} onClick={St}>
          {$t !== null && <Component2584 className={`flex items-center gap-0.5 mr-2 text-[11px] text-orange-400 tabular-nums`}>
              <_Component19 className={`w-3 h-3`} strokeWidth={2.5} />
              <Component2583>
                {ha($t)}
                {ca(gt) ? `/${ca(gt)}` : ``}
              </Component2583>
            </Component2584>}
          <Component2585 className={`flex items-center gap-1 mr-3 text-xs text-gray-300`}>
            {x ? `重新生成` : `生成`}
          </Component2585>
          <Component2586 className={`bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors`}>
            <_Component21 size={14} strokeWidth={3} />
          </Component2586>
        </Component2587>;
    }
  };
  const Component2588 = `span`;
  const Component2589 = `span`;
  const Component2590 = `span`;
  const Component2591 = `button`;
  const Component2596 = `div`;
  const Component2597 = `div`;
  const Component2598 = `div`;
  let rn = () => {
    return <Component2598 className={`relative nodrag nopan`} ref={ft} onClick={e => {
      return e.stopPropagation();
    }} onMouseDown={e => {
      return e.stopPropagation();
    }}>
        <Component2591 className={`flex items-center gap-1 px-3 py-2 rounded-xl bg-[#262626] border border-[#3a3a3a] text-xs text-gray-200 hover:border-[#555] nodrag`} onClick={e => {
        e.stopPropagation();
        E(e => {
          return !e;
        });
      }} title={`选择文本模型`}>
          {gt && <Component2588 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${ma(gt) ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
              {ma(gt) ? `内置` : `三方`}
            </Component2588>}
          <Component2589 className={`max-w-[150px] truncate`}>{gt || `选择模型`}</Component2589>
          {$t !== null && <Component2590 className={`inline-flex items-center gap-0.5 text-[10px] text-orange-400 tabular-nums`}>
              <_Component19 className={`w-2.5 h-2.5`} strokeWidth={2.5} />
              {ha($t)}
            </Component2590>}
          <_Component33 size={12} />
        </Component2591>
        {w && <Component2597 className={`absolute z-50 bottom-full left-0 mb-1 w-60 max-h-60 overflow-y-auto rounded-xl border border-[#3a3a3a] bg-[#202020] p-1 shadow-xl custom-scrollbar nowheel nopan nodrag`} onWheel={e => {
        return e.stopPropagation();
      }} onMouseDown={e => {
        return e.stopPropagation();
      }} onClick={e => {
        return e.stopPropagation();
      }}>
            {ht.length > 0 ? ht.map(t => {
          let n = ma(t) ? sa(t) : null;
          const Component2592 = `span`;
          const Component2593 = `span`;
          const Component2594 = `span`;
          const Component2595 = `div`;
          return <Component2595 role={`button`} className={`w-full flex items-center gap-1.5 text-left px-2 py-1.5 rounded-lg text-[11px] cursor-pointer ${gt === t ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a]`}`} onClick={n => {
            n.stopPropagation();
            r(e, {
              selectedModel: t
            });
            try {
              localStorage.setItem(`mutiwindow_text_model`, t);
            } catch {}
            E(false);
          }} key={t}>
                    <Component2592 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${ma(t) ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                      {ma(t) ? `内置` : `三方`}
                    </Component2592>
                    <Component2593 className={`flex-1 truncate`}>{t}</Component2593>
                    {n !== null && <Component2594 className={`shrink-0 inline-flex items-center gap-0.5 text-[10px] text-orange-400 tabular-nums`}>
                        <_Component19 className={`w-2.5 h-2.5`} strokeWidth={2.5} />
                        {ha(n)}
                        {ca(t) ? `/${ca(t)}` : ``}
                      </Component2594>}
                  </Component2595>;
        }) : <Component2596 className={`px-2 py-2 text-[11px] text-gray-600`}>{`请先在设置中配置文本模型（可点‘恢复默认’修复）`}</Component2596>}
          </Component2597>}
      </Component2598>;
  };
  const Component2599 = `div`;
  const Component2600 = `input`;
  const Component2601 = `div`;
  const Component2602 = `button`;
  const Component2603 = `div`;
  const Component2604 = `div`;
  const Component2605 = `div`;
  const Component2606 = `textarea`;
  const Component2607 = `div`;
  const Component2608 = `div`;
  const Component2609 = `div`;
  const Component2610 = `button`;
  const Component2611 = `button`;
  const Component2612 = `input`;
  const Component2613 = `div`;
  const Component2614 = `div`;
  const Component2615 = `div`;
  const Component2616 = `div`;
  const Component2617 = `div`;
  const Component2618 = `div`;
  let an = () => {
    return <Component2618 className={`w-[240px] shrink-0 flex flex-col gap-3 pr-3 border-r border-[#2a2a2a]`}>
        <Component2604>
          <Component2599 className={`text-[11px] text-gray-500 mb-1`}>{`风格`}</Component2599>
          <Component2601 className={`relative nodrag`}>
            <Component2600 value={p.globalStyle || ``} onChange={t => {
            return r(e, {
              globalStyle: t.target.value
            });
          }} placeholder={`选择或输入风格`} className={`w-full rounded-lg bg-[#262626] border border-[#3a3a3a] px-2 py-1.5 text-xs text-gray-200 outline-none`} />
          </Component2601>
          <Component2603 className={`flex flex-wrap gap-1 mt-1.5`}>
            {b_.map(t => {
            return <Component2602 className={`px-1.5 py-0.5 rounded text-[10px] nodrag ${p.globalStyle === t ? `bg-gray-100 text-gray-950` : `bg-[#262626] text-gray-400 hover:text-gray-200`}`} onClick={() => {
              return r(e, {
                globalStyle: t
              });
            }} key={t}>
                  {t}
                </Component2602>;
          })}
          </Component2603>
        </Component2604>
        <Component2608 className={`flex-1 flex flex-col`}>
          <Component2605 className={`text-[11px] text-gray-500 mb-1`}>{`剧情`}</Component2605>
          <Component2607 className={`relative flex-1 min-h-[180px]`}>
            <Component2606 ref={W} value={S} onChange={e => {
            return C(e.target.value);
          }} onDoubleClick={() => {
            return se(true);
          }} placeholder={`描述剧情片段、故事，为你生成分镜脚本`} className={`w-full h-full min-h-[180px] rounded-xl bg-[#262626] border border-[#3a3a3a] px-3 py-2 pb-8 text-sm text-gray-200 outline-none resize-none nodrag custom-scrollbar nowheel`} />
            <_cmp_Fi targetRef={W} onRequestFullscreen={() => {
            return se(true);
          }} minHeight={180} />
          </Component2607>
        </Component2608>
        <Component2614>
          <Component2609 className={`text-[11px] text-gray-500 mb-1`}>{`镜头数量`}</Component2609>
          <Component2613 className={`flex items-center gap-1.5 flex-wrap`}>
            <Component2610 className={`px-2 py-1 rounded-lg text-[11px] nodrag ${p.shotCount === undefined || p.shotCount === `auto` ? `bg-gray-100 text-gray-950` : `bg-[#262626] text-gray-400 hover:text-gray-200`}`} onClick={() => {
            return r(e, {
              shotCount: `auto`
            });
          }}>{`自动`}</Component2610>
            {[10, 20, 30, 50].map(t => {
            return <Component2611 className={`px-2 py-1 rounded-lg text-[11px] nodrag ${p.shotCount === t ? `bg-gray-100 text-gray-950` : `bg-[#262626] text-gray-400 hover:text-gray-200`}`} onClick={() => {
              return r(e, {
                shotCount: t
              });
            }} key={t}>
                  {t}
                </Component2611>;
          })}
            <Component2612 type={`number`} min={1} max={300} placeholder={`自定义`} value={typeof p.shotCount == `number` && ![10, 20, 30, 50].includes(p.shotCount) ? p.shotCount : ``} onChange={t => {
            let n = parseInt(t.target.value, 10);
            r(e, {
              shotCount: Number.isFinite(n) && n > 0 ? n : `auto`
            });
          }} className={`w-16 rounded-lg bg-[#262626] border border-[#3a3a3a] px-2 py-1 text-[11px] text-gray-200 outline-none nodrag`} />
          </Component2613>
        </Component2614>
        <Component2616>
          <Component2615 className={`text-[11px] text-gray-500 mb-1`}>{`模型`}</Component2615>
          {rn()}
        </Component2616>
        <Component2617 className={`flex justify-end`}>{tn()}</Component2617>
      </Component2618>;
  };
  const Component2619 = `button`;
  const Component2620 = `span`;
  const Component2621 = `button`;
  const Component2622 = `div`;
  let on = () => {
    if (x) {
      return <Component2622 className={`mt-3 flex items-center justify-between gap-3 text-[11px] text-gray-500`}>
          <Component2619 className={`px-2 py-1 text-gray-400 hover:text-gray-200 disabled:opacity-30 nodrag transition-colors`} disabled={Te === 0} onClick={() => {
          return Ee(e => {
            return Math.max(0, e - 1);
          });
        }}>{`上一页`}</Component2619>
          <Component2620 className={`tabular-nums`}>
            {Te + 1}
            {` / `}
            {ke}
            {`  每页 `}
            {D_}
            {` 镜`}
          </Component2620>
          <Component2621 className={`px-2 py-1 text-gray-400 hover:text-gray-200 disabled:opacity-30 nodrag transition-colors`} disabled={Te >= ke - 1} onClick={() => {
          return Ee(e => {
            return Math.min(ke - 1, e + 1);
          });
        }}>{`下一页`}</Component2621>
        </Component2622>;
    } else {
      return null;
    }
  };
  const Component2623 = `div`;
  const Component2624 = `div`;
  const Component2625 = `div`;
  const Component2626 = `div`;
  const Component2627 = `div`;
  const Component2628 = `div`;
  const Component2629 = `div`;
  const Component2630 = `div`;
  const Component2631 = `div`;
  const Component2632 = `div`;
  const Component2633 = `div`;
  const Component2634 = `div`;
  const Component2635 = `div`;
  const Component2636 = `div`;
  const Component2637 = `div`;
  const Component2638 = `span`;
  const Component2639 = `span`;
  const Component2640 = `div`;
  const Component2641 = `button`;
  const Component2642 = `div`;
  const Component2643 = `div`;
  const Component2644 = `button`;
  const Component2645 = `div`;
  let sn = e => {
    return <Component2645 className={`flex-1 min-w-0`}>
        {p.errorMsg && <Component2623 className={`text-xs text-red-400 mb-2`}>{p.errorMsg}</Component2623>}
        <Component2637 className={`relative`}>
          <Component2633 className={`grid ${e ? `grid-cols-[44px_56px_minmax(220px,1.6fr)_96px_120px_150px_110px_96px_34px]` : ``} bg-[#222] text-[11px] text-gray-400 rounded-t-lg`} style={e ? undefined : {
          gridTemplateColumns: Nt
        }}>
            <Component2624 className={`relative px-2 py-2`}>
              {`镜号`}
              {!e && <Ft idx={0} />}
            </Component2624>
            <Component2625 className={`relative px-2 py-2`}>
              {`时长`}
              {!e && <Ft idx={1} />}
            </Component2625>
            <Component2626 className={`relative px-2 py-2`}>
              {`画面描述`}
              {!e && <Ft idx={2} />}
            </Component2626>
            <Component2627 className={`relative px-2 py-2`}>
              {`景别`}
              {!e && <Ft idx={3} />}
            </Component2627>
            {e && <Component2628 className={`px-2 py-2`}>{`光影氛围`}</Component2628>}
            {e && <Component2629 className={`px-2 py-2`}>{`对白旁白`}</Component2629>}
            {e && <Component2630 className={`px-2 py-2`}>{`音效`}</Component2630>}
            <Component2631 className={`relative px-2 py-2`}>
              {`运镜`}
              {!e && <Ft idx={4} />}
            </Component2631>
            <Component2632 className={`px-1 py-2 text-center`}>{`·`}</Component2632>
          </Component2633>
          <Component2636>
            {x ? K.map(t => {
            return <Component2634 className={`relative`} key={t.id}>
                    {It(t, e)}
                    {!e && !Ae.has(`shot-${t.id}`) && <Kt type={`source`} position={X.Right} id={`shot-${t.id}`} className={`!w-3 !h-3 !bg-white !border-2 !border-[#1c1c1c]`} style={{
                top: `50%`,
                right: -10,
                transform: `translateY(-50%)`
              }} title={`镜${t.index} 单独连线（生图/生视频）`} />}
                  </Component2634>;
          }) : <Component2635 className={`px-3 py-8 text-sm text-gray-500 text-center`}>{`输入剧情后点“生成”，自动生成多镜头分镜表`}</Component2635>}
          </Component2636>
        </Component2637>
        {on()}
        {!e && je.length > 0 && <Component2643 className={`mt-2 border-t border-white/10 pt-2`}>
            <Component2640 className={`mb-1.5 flex items-center justify-between text-[10px] text-gray-500`}>
              <Component2638>{`已连接镜头`}</Component2638>
              {q && <Component2639>{`其他页含已连接镜头`}</Component2639>}
            </Component2640>
            <Component2642 className={`flex flex-wrap gap-1.5`}>
              {je.map(e => {
            return <Component2641 className={`relative rounded border border-white/10 bg-[#242424] px-2 py-1 text-[10px] text-gray-300 hover:bg-[#2b2b2b] nodrag transition-colors`} onClick={() => {
              return Ee(Math.floor(m.findIndex(t => {
                return t.id === e.id;
              }) / D_));
            }} key={e.id}>
                    {`镜 `}
                    {e.index}
                    <Kt type={`source`} position={X.Right} id={`shot-${e.id}`} className={`!h-2.5 !w-2.5 !border-2 !border-[#1c1c1c] !bg-white`} style={{
                right: -7,
                top: `50%`,
                transform: `translateY(-50%)`
              }} title={`镜${e.index} 已连接`} />
                  </Component2641>;
          })}
            </Component2642>
          </Component2643>}
        <Component2644 className={`mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#262626] hover:bg-[#333] text-xs text-gray-300 nodrag transition-colors`} onClick={bt}>
          <Xt size={12} />
          {` 添加镜头`}
        </Component2644>
      </Component2645>;
  };
  let cn = (t, n) => {
    let r = n === `image` ? new Set([`promptNode`]) : new Set([`videoNode`, `discountVideoNode`, `sd2VideoNode`]);
    return o.some(n => {
      if (n.source !== e || n.sourceHandle !== `shot-${t}`) {
        return false;
      }
      let i = a().find(e => {
        return e.id === n.target;
      });
      return !!i && r.has(i.type || ``);
    });
  };
  let ln = Z.useCallback(t => {
    let n = m.findIndex(e => {
      return e.id === t;
    });
    if (n <= 0) {
      return {
        prevShot: undefined,
        images: [],
        videos: []
      };
    }
    let r = m[n - 1];
    let i = a();
    let s = [];
    let c = [];
    o.forEach(t => {
      if (t.source !== e || t.sourceHandle !== `shot-${r.id}`) {
        return;
      }
      let n = i.find(e => {
        return e.id === t.target;
      });
      if (!n) {
        return;
      }
      let a = n.data || {};
      if (Array.isArray(a.extractedImages) && a.extractedImages.length) {
        a.extractedImages.forEach(e => {
          return s.push(e);
        });
      }
      if (a.imageUrl && typeof a.imageUrl == `string` && (a.imageUrl.startsWith(`http`) || a.imageUrl.startsWith(`data:`))) {
        let e = a.imageUrl;
        if (/(\.mp4|\.webm|\.mov|\.ogg)($|\?)/i.test(e) || e.startsWith(`data:video/`)) {
          c.push({
            url: e,
            candidate: `custom`
          });
        } else {
          s.push(e);
        }
      }
      if (Array.isArray(a.images)) {
        a.images.forEach(e => {
          if (e?.url) {
            s.push(e.url);
          }
        });
      }
      if (Array.isArray(a.resultImages)) {
        a.resultImages.forEach(e => {
          if (typeof e == `string`) {
            s.push(e);
          }
        });
      }
      if (a.videoUrl && typeof a.videoUrl == `string`) {
        c.push({
          url: a.videoUrl,
          candidate: `videoUrl`
        });
      }
      if (Array.isArray(a.resultVideos) && a.resultVideos.length > 0) {
        let e = a.resultVideos[a.resultVideos.length - 1];
        let t = typeof e == `string` ? e : e?.url;
        if (t) {
          c.push({
            url: t,
            candidate: `lastResult`
          });
        }
      }
      if (Array.isArray(a.videos) && a.videos.length > 0) {
        let e = a.videos[a.videos.length - 1];
        let t = typeof e == `string` ? e : e?.url;
        if (t) {
          c.push({
            url: t,
            candidate: `lastVideos`
          });
        }
      }
      if (n.type === `customNode` && a.resultData !== undefined) {
        let e = a.config?.outputType;
        if (Array.isArray(a.resultData) && a.resultData.length > 0) {
          let t = a.resultData[a.resultData.length - 1];
          if (typeof t == `string`) {
            if (e === `video` || /(\.mp4|\.webm|\.mov)($|\?)/i.test(t)) {
              c.push({
                url: t,
                candidate: `custom`
              });
            } else {
              s.push(t);
            }
          }
        } else if (typeof a.resultData == `string`) {
          if (e === `video` || /(\.mp4|\.webm|\.mov)($|\?)/i.test(a.resultData)) {
            c.push({
              url: a.resultData,
              candidate: `custom`
            });
          } else {
            s.push(a.resultData);
          }
        }
      }
    });
    let l = /\.(mp4|webm|mov|ogg|m4v)(\?|#|$)/i;
    let u = {
      videoUrl: 4,
      lastResult: 3,
      lastVideos: 2,
      custom: 1
    };
    let d = new Map();
    c.forEach(e => {
      if (!l.test(e.url) && !e.url.startsWith(`data:video/`)) {
        return;
      }
      let t = d.get(e.url) ?? 0;
      let n = u[e.candidate] ?? 0;
      if (n > t) {
        d.set(e.url, n);
      }
    });
    return {
      prevShot: r,
      images: s,
      videos: Array.from(d.entries()).sort((e, t) => {
        return t[1] - e[1];
      }).map(([e]) => {
        return e;
      })
    };
  }, [o, a, e, m, f]);
  let un = (t, n, r = false) => {
    let i = h.filter(e => {
      return e.name && e.imageUrl && Va(`${t.description || ``} ${t.prompt || ``} ${t.videoPrompt || ``} ${t.dialogue || ``}`, e.name);
    });
    let a = r ? ln(t.id) : null;
    let o = a?.videos || [];
    let s = !!a?.prevShot;
    const Component2646 = `div`;
    const Component2647 = `span`;
    const Component2648 = `div`;
    const Component2649 = `div`;
    const Component2650 = `input`;
    const Component2651 = `span`;
    const Component2652 = `span`;
    const Component2653 = `label`;
    const Component2654 = `button`;
    const Component2655 = `button`;
    const Component2656 = `div`;
    const Component2657 = `div`;
    const Component2658 = `img`;
    const Component2659 = `button`;
    const Component2660 = `div`;
    const Component2661 = `div`;
    const Component2662 = `div`;
    const Component2663 = `div`;
    const Component2664 = `div`;
    const Component2665 = `div`;
    const Component2666 = `div`;
    const Component2667 = `div`;
    const Component2686 = `div`;
    const Component2687 = `div`;
    const Component2688 = `div`;
    const Component2689 = `div`;
    const Component2711 = `div`;
    const Component2712 = `div`;
    const Component2713 = `span`;
    const Component2714 = `button`;
    const Component2715 = `div`;
    const Component2716 = `div`;
    const Component2717 = `option`;
    const Component2718 = `option`;
    const Component2719 = `select`;
    const Component2720 = `div`;
    const Component2721 = `div`;
    const Component2722 = `span`;
    const Component2723 = `button`;
    const Component2724 = `div`;
    const Component2725 = `div`;
    const Component2726 = `span`;
    const Component2727 = `button`;
    const Component2728 = `div`;
    const Component2729 = `div`;
    const Component2730 = `span`;
    const Component2731 = `button`;
    const Component2732 = `div`;
    const Component2733 = `div`;
    const Component2734 = `div`;
    const Component2746 = `div`;
    const Component2747 = `div`;
    const Component2748 = `div`;
    const Component2749 = `div`;
    const Component2750 = `div`;
    const Component2751 = `button`;
    const Component2752 = `div`;
    const Component2753 = `div`;
    const Component2754 = `div`;
    const Component2755 = `div`;
    const Component2756 = `div`;
    const Component2757 = `div`;
    const Component2758 = `div`;
    return <Component2758 className={`relative border-b border-[#2a2a2a] transition-colors ${Ze.has(t.id) ? `bg-[#242424]` : `bg-transparent`} ${r ? `p-7 space-y-1` : `p-2.5`}`} key={t.id}>
        {t.promptLoading && <Component2649 className={`absolute inset-0 z-40 overflow-hidden bg-[#181818]/55 backdrop-blur-[1px] cursor-not-allowed`}>
            <Component2646 className={`absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-shimmer`} />
            {n && <Component2648 className={`absolute inset-0 flex flex-col items-center justify-center gap-2`}>
                <_Component22 size={24} className={`animate-spin text-white`} />
                <Component2647 className={`text-xs text-gray-200`}>{`正在生成镜头提示词`}</Component2647>
              </Component2648>}
          </Component2649>}
        <Component2657 className={`flex items-center justify-between mb-2`}>
          {!r && <Component2653 className={`flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer nodrag`}>
              <Component2650 type={`checkbox`} checked={Ze.has(t.id)} onChange={() => {
            return $e(t.id);
          }} className={`accent-white`} />
              <Component2651 className={`text-base text-white font-semibold`} style={{
            fontFamily: `STSong, SimSun, "Songti SC", serif`
          }}>
                {`镜`}
                {t.index}
              </Component2651>
              {t.duration && <Component2652 className={`text-[10px] text-gray-500`}>{t.duration}</Component2652>}
            </Component2653>}
          {!r && <Component2656 className={`ml-auto`}>
              {t.promptLoading ? <Component2654 type={`button`} className={`p-1 rounded text-white hover:bg-white/10 nodrag`} title={`生成中，点击停止`} onClick={() => {
            return p.onStopScriptItem?.(e, `shot`, t.id);
          }}>
                  <_Component22 size={15} className={`animate-spin`} />
                </Component2654> : <Component2655 type={`button`} className={`p-1 rounded text-gray-500 hover:text-white hover:bg-white/10 nodrag`} title={t.prompt || t.videoPrompt ? `重生成提示词` : `生成提示词`} onClick={() => {
            return p.onGenerateShotPrompts?.(e, t.id);
          }}>
                  <_Component22 size={15} />
                </Component2655>}
            </Component2656>}
        </Component2657>
        {r && <Component2749 className={`mb-6 space-y-5`}>
            <Component2689 className={`flex items-stretch gap-3 rounded-lg bg-[#1b1b1b] px-4 py-3`}>
              {i.length > 0 ? <Component2665 className={`flex shrink-0 items-center gap-5`}>
                  <Component2660 className={`flex shrink-0 items-center pl-2 py-1 ${H.has(t.id) ? `max-w-[420px] flex-wrap gap-2` : ``}`}>
                    {(H.has(t.id) ? i : i.slice(0, 4)).map((e, n) => {
                return <Component2658 src={e.imageUrl} alt={e.name} loading={`lazy`} decoding={`async`} className={`w-16 h-16 object-cover border-2 border-white/90 shadow-[0_8px_18px_rgba(0,0,0,0.38)] cursor-zoom-in nodrag ${H.has(t.id) ? `rounded-md` : `${n > 0 ? `-ml-7` : ``} ${[`-rotate-3`, `rotate-2`, `-rotate-1`, `rotate-3`][n] || ``}`}`} style={{
                  zIndex: n + 1
                }} onError={t => {
                  let n = t.currentTarget;
                  let r = p.videoUploadedAssets?.[e.imageUrl || ``] || e.thumbnailUrl || e.imageUrl;
                  if (r && n.src !== r) {
                    n.src = r;
                  }
                }} onDoubleClick={() => {
                  return le(e.imageUrl);
                }} title={`双击放大`} key={e.id} />;
              })}
                    {i.length > 4 && <Component2659 type={`button`} className={`relative z-10 flex h-8 min-w-8 items-center justify-center rounded-full border border-white/40 bg-[#303030] px-1.5 text-[10px] font-medium text-white shadow-lg hover:bg-[#444] nodrag ${H.has(t.id) ? `` : `-ml-5`}`} onClick={() => {
                return ie(e => {
                  let n = new Set(e);
                  if (n.has(t.id)) {
                    n.delete(t.id);
                  } else {
                    n.add(t.id);
                  }
                  return n;
                });
              }}>
                        {H.has(t.id) ? `收起` : `+${i.length - 4}`}
                      </Component2659>}
                  </Component2660>
                  <Component2664 className={`min-w-0`}>
                    <Component2661 className={`text-xs font-medium text-gray-100`}>{`引用资产`}</Component2661>
                    <Component2662 className={`mt-0.5 text-[10px] text-gray-500`}>
                      {i.length}
                      {` 张附图`}
                    </Component2662>
                    <Component2663 className={`mt-1.5 truncate w-[220px] text-[11px] text-gray-300`} title={i.map(e => {
                return e.name;
              }).join(`、`)}>
                      {i.map(e => {
                  return e.name;
                }).join(`、`)}
                    </Component2663>
                  </Component2664>
                </Component2665> : <Component2667 className={`flex shrink-0 items-center gap-3`}>
                  <Component2666 className={`h-20 w-28 shrink-0 rounded-md border border-dashed border-white/10 bg-[#171717] flex items-center justify-center text-[10px] text-gray-600 nodrag`}>{`暂无引用资产`}</Component2666>
                </Component2667>}
              <Component2688 className={`flex-1 min-w-0 flex items-center justify-end gap-3`}>
                <Component2687 className={`rounded-lg border transition-colors ${!s || o.length === 0 ? `border-white/10 bg-[#171717] opacity-60` : t.usePrevShotVideoTail ? `border-emerald-400/60 bg-emerald-400/10` : `border-white/10 bg-[#1f1f1f]`}`}>
                  <Component2686 className={`flex flex-col items-center gap-1.5 px-2.5 py-2`}>
                    {(() => {
                  let n = t.prevTailFrameVariants || [];
                  let r = t.selectedTailFrameVariantId || `original`;
                  let i = n.find(e => {
                    return e.id === r;
                  });
                  let a = !s || o.length === 0;
                  let c = !!t.tailFrameVariantsLoading;
                  let l = n.some(e => {
                    return e.imageUrl;
                  });
                  let u = i?.imageUrl || ``;
                  let d = u;
                  let f = i?.errorMsg;
                  const Component2668 = `div`;
                  const Component2669 = `div`;
                  const Component2670 = `div`;
                  const Component2671 = `div`;
                  const Component2672 = `img`;
                  const Component2673 = `button`;
                  const Component2674 = `div`;
                  const Component2675 = `div`;
                  const Component2676 = `div`;
                  const Component2677 = `div`;
                  const Component2678 = `div`;
                  const Component2679 = `div`;
                  const Component2680 = `div`;
                  const Component2681 = `div`;
                  const Component2682 = `div`;
                  const Component2683 = `div`;
                  const Component2684 = `button`;
                  const Component2685 = `div`;
                  return <Component2685 className={`flex shrink-0 items-center gap-2.5 min-w-0`}>
                          <O_ enabled={s && o.length > 0 && !c && !n.some(e => {
                      return e.id === `original` && e.imageUrl;
                    })} onExtract={() => {
                      return p.onGenerateTailFrameVariants?.(e, t.id, undefined, true);
                    }} />
                          <Component2678 className={`flex shrink-0 items-center pl-2 py-1`}>
                            {a ? <Component2668 className={`h-16 w-20 shrink-0 rounded-md border border-dashed border-white/10 bg-[#141414] flex items-center justify-center text-[9px] text-gray-600 nodrag`}>{`无视频结果`}</Component2668> : <Component2677 className={`relative flex items-center shrink-0`}>
                                {c && !d ? <Component2669 className={`h-16 w-20 rounded-md bg-[#141414] border border-white/10 flex items-center justify-center text-gray-500 text-[9px] nodrag`}>
                                    <_Component22 size={12} className={`animate-spin mr-1`} />
                                    {`生成中`}
                                  </Component2669> : d ? <Q.Fragment>
                                    <Component2670 className={`absolute left-1 top-1.5 h-14 w-[70px] rounded-md border-2 border-white/25 shadow-[0_6px_14px_rgba(0,0,0,0.35)] -rotate-3 bg-[#1a1a1a]`} aria-hidden={true} />
                                    <Component2671 className={`absolute left-0.5 top-0.5 h-[62px] w-[74px] rounded-md border-2 border-white/40 shadow-[0_10px_18px_rgba(0,0,0,0.45)] rotate-1 bg-[#1a1a1a]`} aria-hidden={true} />
                                    <Component2672 src={d} alt={`上一视频尾帧`} loading={`lazy`} decoding={`async`} onError={e => {
                            let t = e.currentTarget;
                            let n = i?.thumbnailUrl || i?.imageUrl;
                            if (n && t.src !== n) {
                              t.src = n;
                            }
                          }} className={`relative z-10 h-16 w-20 object-cover rounded-md border-2 border-white/90 shadow-[0_10px_22px_rgba(0,0,0,0.5)] nodrag cursor-zoom-in`} onDoubleClick={() => {
                            if (u) {
                              le(u);
                            }
                          }} />
                                    <Component2673 type={`button`} title={t.usePrevShotVideoTail ? `已勾选：作为本镜参考图带入下游，并自动加"视觉起点 @图片1"约束到提示词（点击取消）` : `未勾选：不会带入下游参考图，提示词也不会加衔接约束（点击启用）`} onClick={e => {
                            e.stopPropagation();
                            _t(t.id, {
                              usePrevShotVideoTail: !t.usePrevShotVideoTail
                            });
                          }} className={`absolute -right-1 -bottom-1 z-20 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white shadow transition-all nodrag ${t.usePrevShotVideoTail ? `bg-emerald-500 hover:bg-emerald-400` : `bg-white/20 hover:bg-white/40 border border-white/60`}`}>
                                      {t.usePrevShotVideoTail ? `✓` : ``}
                                    </Component2673>
                                  </Q.Fragment> : f ? <Component2674 className={`h-16 w-20 rounded-md bg-[#141414] border border-white/10 flex items-center justify-center px-1 text-[9px] text-red-400/70 text-center nodrag`} title={f}>
                                    {f}
                                  </Component2674> : l ? <Component2675 className={`h-16 w-20 rounded-md bg-[#141414] border border-dashed border-white/10 flex items-center justify-center text-[9px] text-gray-600 nodrag`}>{`未选中`}</Component2675> : <Component2676 className={`h-16 w-20 rounded-md bg-[#141414] border border-dashed border-white/10 flex items-center justify-center text-[9px] text-gray-600 nodrag`}>{`未生成`}</Component2676>}
                              </Component2677>}
                          </Component2678>
                          <Component2683 className={`flex flex-col min-w-0 gap-0.5 w-full`}>
                            <Component2682 className={`min-w-0`}>
                              <Component2679 className={`text-[12px] font-semibold ${t.usePrevShotVideoTail ? `text-emerald-300` : `text-gray-100`}`}>{`上一视频尾帧`}</Component2679>
                              <Component2680 className={`text-[10px] text-gray-500 mt-0.5 truncate`}>
                                {s ? o.length > 0 ? a ? `尾帧占位` : c ? `生成中…` : n.length > 0 ? `${n.length}张可选` : d ? `1张可选` : `未生成` : `无视频结果` : `第 1 镜，没有上一镜`}
                              </Component2680>
                              {t.tailFrameVariantsError && <Component2681 className={`mt-0.5 text-[10px] text-red-400/80 truncate`} title={t.tailFrameVariantsError}>
                                  {t.tailFrameVariantsError}
                                </Component2681>}
                            </Component2682>
                          </Component2683>
                          <Component2684 type={`button`} disabled={!s || o.length === 0} className={`h-4 w-full flex items-center justify-center text-gray-500 hover:text-gray-200 disabled:text-gray-700 transition-colors nodrag`} onClick={e => {
                      e.stopPropagation();
                      U(e => {
                        let n = new Set(e);
                        if (n.has(t.id)) {
                          n.delete(t.id);
                        } else {
                          n.add(t.id);
                        }
                        return n;
                      });
                    }} title={ae.has(t.id) ? `收起角度` : `展开角度`}>
                            <_Component33 size={14} className={`transition-transform ${ae.has(t.id) ? `rotate-180` : ``}`} />
                          </Component2684>
                        </Component2685>;
                })()}
                  </Component2686>
                </Component2687>
              </Component2688>
            </Component2689>
            {r && ae.has(t.id) && <Component2711 className={`rounded-lg border border-white/10 bg-[#171717] px-3 py-2.5 mt-[-18px]`}>
                {(() => {
            let n = t.prevTailFrameVariants ? t.prevTailFrameVariants : t.tailFrameVariantsLoading ? [{
              id: `original`,
              label: `原版尾帧`,
              loading: true
            }, ...(t.tailFrameAngleIds && t.tailFrameAngleIds.length > 0 ? t.tailFrameAngleIds : []).map(e => {
              return {
                id: e,
                label: Ge[e] || e,
                loading: true
              };
            })] : [];
            if (n.length === 0) {
              const Component2690 = `div`;
              return <Component2690 className={`text-[11px] text-gray-500`}>{`请先生成尾帧变体`}</Component2690>;
            }
            let r = t.selectedTailFrameVariantId || `original`;
            let i = {};
            Y.forEach(e => {
              (i[e.category] ||= []).push(e);
            });
            let a = new Set(t.tailFrameAngleIds || []);
            const Component2691 = `span`;
            const Component2692 = `button`;
            const Component2693 = `div`;
            const Component2694 = `div`;
            const Component2698 = `div`;
            const Component2699 = `div`;
            const Component2700 = `button`;
            const Component2701 = `div`;
            const Component2709 = `div`;
            const Component2710 = `div`;
            return <Component2710 className={`grid grid-cols-[250px_minmax(0,1fr)] gap-4 items-start`}>
                      <Component2701 className={`rounded-lg bg-[#1d1d1d] border border-white/10 p-3 space-y-2 nodrag`}>
                        <Component2693 className={`flex items-center justify-between gap-2`}>
                          <Component2691 className={`text-[10px] text-gray-500`}>{`每类单选，可跨类别组合`}</Component2691>
                          <Component2692 type={`button`} className={`text-[10px] text-gray-400 hover:text-white`} onClick={() => {
                    return _t(t.id, {
                      tailFrameAngleIds: undefined
                    });
                  }}>{`重置`}</Component2692>
                        </Component2693>
                        {Object.entries(i).map(([e, n]) => {
                  return <Component2699 key={e}>
                              <Component2694 className={`mb-1 text-[10px] text-gray-500`}>
                                {e}
                              </Component2694>
                              <Component2698 className={`grid grid-cols-2 gap-x-2 gap-y-1`}>
                                {n.map(e => {
                        let r = a.has(e.id);
                        const Component2695 = `span`;
                        const Component2696 = `span`;
                        const Component2697 = `button`;
                        return <Component2697 type={`button`} className={`flex min-w-0 items-center gap-1.5 text-left text-[10px] text-gray-300 hover:text-white`} onClick={() => {
                          let i = t.tailFrameAngleIds || [];
                          let a = new Set(n.map(e => {
                            return e.id;
                          }));
                          let o = i.filter(e => {
                            return !a.has(e);
                          });
                          if (!r) {
                            o.push(e.id);
                          }
                          _t(t.id, {
                            tailFrameAngleIds: o.length > 0 ? o : undefined
                          });
                        }} key={e.id}>
                                      <Component2695 className={`h-3 w-3 shrink-0 rounded-full border ${r ? `border-white bg-white shadow-[inset_0_0_0_3px_#1d1d1d]` : `border-gray-500`}`} />
                                      <Component2696 className={`truncate`}>
                                        {e.label}
                                      </Component2696>
                                    </Component2697>;
                      })}
                              </Component2698>
                            </Component2699>;
                })}
                        <Component2700 type={`button`} disabled={!s || o.length === 0 || !t.tailFrameVariantsLoading && a.size === 0} className={`mt-1 w-full rounded bg-gray-100 px-2 py-1.5 text-[11px] font-medium text-gray-950 hover:bg-white disabled:cursor-not-allowed disabled:bg-[#333] disabled:text-gray-600`} onClick={() => {
                  if (t.tailFrameVariantsLoading) {
                    p.onStopScriptItem?.(e, `shot`, t.id);
                  } else {
                    p.onGenerateTailFrameVariants?.(e, t.id, t.tailFrameAngleIds || []);
                  }
                }}>
                          {t.tailFrameVariantsLoading ? `停止生成` : `生成换角度图`}
                        </Component2700>
                      </Component2701>
                      <Component2709 className={`grid grid-cols-2 xl:grid-cols-3 gap-2 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar nowheel`} onWheel={e => {
                return e.stopPropagation();
              }}>
                        {n.map(e => {
                  let n = r === e.id;
                  const Component2702 = `div`;
                  const Component2703 = `img`;
                  const Component2704 = `div`;
                  const Component2705 = `div`;
                  const Component2706 = `div`;
                  const Component2707 = `div`;
                  const Component2708 = `button`;
                  return <Component2708 type={`button`} onClick={n => {
                    n.stopPropagation();
                    if (!e.imageUrl && !e.loading) {
                      return;
                    }
                    let r = e.id;
                    let i = (t.prevTailFrameVariants || []).find(e => {
                      return e.id === r;
                    });
                    let a = {
                      selectedTailFrameVariantId: r
                    };
                    if (i?.imageUrl) {
                      a.prevShotImageRefUrls = [i.imageUrl];
                    } else if (e.imageUrl) {
                      a.prevShotImageRefUrls = [e.imageUrl];
                    }
                    _t(t.id, a);
                  }} className={`group relative w-full aspect-[16/10] rounded-md overflow-hidden border-2 nodrag nowheel transition-all ${n ? `border-emerald-400 shadow-[0_0_0_2px_rgba(52,211,153,0.18)]` : `border-white/10 hover:border-white/30`} ${!e.imageUrl && !e.loading ? `opacity-55 cursor-not-allowed` : `cursor-pointer`}`} title={e.errorMsg ? `${e.label}：${e.errorMsg}` : e.label} key={e.id}>
                              {e.loading ? <Component2702 className={`absolute inset-0 flex items-center justify-center bg-[#121212] text-gray-500 text-[10px]`}>
                                  <_Component22 size={12} className={`animate-spin mr-1`} />
                                  {`生成中`}
                                </Component2702> : e.imageUrl ? <Component2703 src={e.imageUrl} alt={e.label} loading={`lazy`} decoding={`async`} className={`w-full h-full object-cover`} onDoubleClick={() => {
                      return e.imageUrl && le(e.imageUrl);
                    }} onError={t => {
                      let n = e.thumbnailUrl || e.imageUrl;
                      if (n && t.currentTarget.src !== n) {
                        t.currentTarget.src = n;
                      }
                    }} /> : e.errorMsg ? <Component2704 className={`absolute inset-0 flex items-center justify-center bg-[#141414] text-[10px] text-red-400/80 px-1 text-center leading-tight`}>
                                  {e.errorMsg}
                                </Component2704> : <Component2705 className={`absolute inset-0 flex items-center justify-center bg-[#141414] text-[10px] text-gray-500 px-1 text-center leading-tight`}>{`等待中`}</Component2705>}
                              <Component2706 className={`absolute left-1 top-1 rounded bg-black/55 px-1 py-0.5 text-[10px] text-white leading-none`}>
                                {e.label}
                              </Component2706>
                              {n && <Component2707 className={`absolute right-1 bottom-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white shadow`}>{`✓`}</Component2707>}
                            </Component2708>;
                })}
                      </Component2709>
                    </Component2710>;
          })()}
              </Component2711>}
            <Component2733 className={`grid grid-cols-2 gap-4`}>
              <Component2715 className={`relative`}>
                <Component2712 className={`text-[10px] text-gray-500 mb-0.5`}>{`时长`}</Component2712>
                <Component2714 className={`w-full rounded-md bg-[#262626] border border-transparent focus:border-gray-500 px-2 py-1.5 text-[11px] text-left text-gray-200 outline-none nodrag transition-colors`} onClick={e => {
              e.stopPropagation();
              Tt(t.id, `duration`);
            }}>
                  <Component2713 className={t.duration ? `text-gray-200` : `text-gray-500`}>
                    {t.duration || `如 3s / 5s`}
                  </Component2713>
                </Component2714>
                {kt(t, `duration`)}
              </Component2715>
              <Component2720>
                <Component2716 className={`text-[10px] text-gray-500 mb-0.5`}>{`景别`}</Component2716>
                <Component2719 value={t.shotType || ``} onChange={e => {
              return _t(t.id, {
                shotType: e.target.value
              });
            }} className={`w-full rounded-md bg-[#262626] border border-transparent focus:border-gray-500 px-2 py-1.5 text-[11px] text-gray-200 outline-none nodrag transition-colors`}>
                  <Component2717 value={``}>{`未指定`}</Component2717>
                  {x_.map(e => {
                return <Component2718 value={e} key={e}>
                        {e}
                      </Component2718>;
              })}
                </Component2719>
              </Component2720>
              <Component2724 className={`relative`}>
                <Component2721 className={`text-[10px] text-gray-500 mb-0.5`}>{`运镜`}</Component2721>
                <Component2723 className={`w-full rounded-md bg-[#262626] border border-transparent focus:border-gray-500 px-2 py-1.5 text-[11px] text-left text-gray-200 outline-none nodrag transition-colors`} onClick={e => {
              e.stopPropagation();
              Tt(t.id, `motion`);
            }}>
                  <Component2722 className={t.motion ? `text-gray-200` : `text-gray-500`}>
                    {t.motion || `推/拉/摇/移…`}
                  </Component2722>
                </Component2723>
                {kt(t, `motion`)}
              </Component2724>
              <Component2728 className={`relative`}>
                <Component2725 className={`text-[10px] text-gray-500 mb-0.5`}>{`光影`}</Component2725>
                <Component2727 className={`w-full rounded-md bg-[#262626] border border-transparent focus:border-gray-500 px-2 py-1.5 text-[11px] text-left text-gray-200 outline-none nodrag transition-colors`} onClick={e => {
              e.stopPropagation();
              Tt(t.id, `lighting`);
            }}>
                  <Component2726 className={t.lighting ? `text-gray-200` : `text-gray-500`}>
                    {t.lighting || `光影氛围`}
                  </Component2726>
                </Component2727>
                {kt(t, `lighting`)}
              </Component2728>
              <Component2732 className={`relative col-span-2`}>
                <Component2729 className={`text-[10px] text-gray-500 mb-0.5`}>{`音效`}</Component2729>
                <Component2731 className={`w-full rounded-md bg-[#262626] border border-transparent focus:border-gray-500 px-2 py-1.5 text-[11px] text-left text-gray-200 outline-none nodrag transition-colors`} onClick={e => {
              e.stopPropagation();
              Tt(t.id, `sound`);
            }}>
                  <Component2730 className={t.sound ? `text-gray-200` : `text-gray-500`}>
                    {t.sound || `环境声/音效描述`}
                  </Component2730>
                </Component2731>
                {kt(t, `sound`)}
              </Component2732>
            </Component2733>
            <Component2746>
              <Component2734 className={`text-[10px] text-gray-500 mb-0.5`}>{`对白/旁白`}</Component2734>
              {(() => {
            let e = jt(t.dialogue);
            const Component2735 = `button`;
            const Component2736 = `option`;
            const Component2737 = `option`;
            const Component2738 = `select`;
            const Component2739 = `textarea`;
            const Component2740 = `button`;
            const Component2741 = `div`;
            const Component2742 = `button`;
            const Component2743 = `button`;
            const Component2744 = `div`;
            const Component2745 = `div`;
            return <Component2745 className={`space-y-2`}>
                    {e.map((n, r) => {
                return <Component2741 className={`flex items-center gap-2`} key={r}>
                          <Component2735 type={`button`} className={`w-[52px] shrink-0 rounded border border-transparent px-1 py-1 text-[10px] outline-none nodrag ${n.kind === `旁白` ? `bg-purple-500/20 text-purple-300` : `bg-cyan-500/20 text-cyan-400`}`} onClick={() => {
                    let i = [...e];
                    let a = n.kind === `旁白` ? `台词` : `旁白`;
                    i[r] = {
                      ...i[r],
                      kind: a,
                      role: a === `旁白` ? `` : i[r].role
                    };
                    _t(t.id, {
                      dialogue: Mt(i)
                    });
                  }}>
                            {n.kind}
                          </Component2735>
                          {n.kind === `台词` && <Component2738 value={n.role} onChange={n => {
                    let i = [...e];
                    i[r] = {
                      ...i[r],
                      role: n.target.value
                    };
                    _t(t.id, {
                      dialogue: Mt(i)
                    });
                  }} className={`w-[60px] rounded bg-[#1a1a1a] border border-[#3a3a3a] px-0.5 py-0.5 text-[10px] text-gray-200 outline-none nodrag text-center`}>
                              <Component2736 value={``}>{`角色`}</Component2736>
                              {y.map(e => {
                      return <Component2737 value={e.name} key={e.id}>
                                    {e.name}
                                  </Component2737>;
                    })}
                            </Component2738>}
                          <Component2739 rows={1} value={n.text} onChange={n => {
                    let i = [...e];
                    i[r] = {
                      ...i[r],
                      text: n.target.value
                    };
                    _t(t.id, {
                      dialogue: Mt(i)
                    });
                  }} placeholder={n.kind === `旁白` ? `旁白内容` : `台词内容`} className={`flex-1 rounded bg-[#1a1a1a] border border-[#3a3a3a] px-2 py-1.5 text-[11px] text-gray-200 outline-none resize-none min-h-[28px] nodrag`} />
                          <Component2740 className={`p-1 text-gray-500 hover:text-red-400 shrink-0 nodrag mt-0.5`} onClick={() => {
                    let n = [...e];
                    n.splice(r, 1);
                    _t(t.id, {
                      dialogue: Mt(n)
                    });
                  }}>
                            <Gt size={12} />
                          </Component2740>
                        </Component2741>;
              })}
                    <Component2744 className={`flex items-center gap-2 pt-1`}>
                      <Component2742 className={`px-2 py-1 rounded bg-[#2a2a2a] text-gray-300 hover:bg-[#333] text-[10px] flex items-center gap-1 nodrag`} onClick={() => {
                  return _t(t.id, {
                    dialogue: Mt([{
                      kind: `台词`,
                      role: ``,
                      text: ``
                    }, ...e])
                  });
                }}>
                        <Xt size={10} />
                        {` 台词`}
                      </Component2742>
                      <Component2743 className={`px-2 py-1 rounded bg-[#2a2a2a] text-gray-300 hover:bg-[#333] text-[10px] flex items-center gap-1 nodrag`} onClick={() => {
                  return _t(t.id, {
                    dialogue: Mt([{
                      kind: `旁白`,
                      role: ``,
                      text: ``
                    }, ...e])
                  });
                }}>
                        <Xt size={10} />
                        {` 旁白`}
                      </Component2743>
                    </Component2744>
                  </Component2745>;
          })()}
            </Component2746>
            <Component2748 className={`relative`}>
              <Component2747 className={`text-[10px] text-gray-500 mb-0.5`}>{`画面描述（输入 @ 引用资产）`}</Component2747>
              {At(t, `description`, `w-full min-h-[64px] rounded-md bg-[#262626] border border-transparent focus-within:border-gray-500 outline-none nodrag custom-scrollbar nowheel transition-colors`, `画面描述，输入 @ 引用资源`, {
            paddingX: 10,
            paddingY: 8,
            fontSizePx: 11,
            lineHeight: 1.625,
            minHeightPx: 64
          })}
            </Component2748>
          </Component2749>}
        <Component2757 className={`grid ${r ? `grid-cols-1 gap-3` : `grid-cols-2 gap-2`}`}>
          <Component2754>
            <Component2753 className={`flex items-center justify-between gap-2 mb-1.5`}>
              <Component2750 className={`text-xs font-medium text-gray-300`}>{`生图`}</Component2750>
              <Component2752 className={`flex items-center gap-0.5`} title={`图像提示词宫格构图`}>
                {[[0, `单图`], [4, `四宫格`], [9, `九宫格`]].map(([e, n]) => {
                return <Component2751 className={`px-1.5 py-0.5 rounded text-[10px] nodrag ${(t.gridMode || 0) === e ? `bg-gray-100 text-gray-950` : `bg-[#2a2a2a] text-gray-500 hover:text-gray-300`}`} onClick={() => {
                  return _t(t.id, {
                    gridMode: e
                  });
                }} key={e}>
                      {n}
                    </Component2751>;
              })}
              </Component2752>
            </Component2753>
            {At(t, `prompt`, `w-full ${r ? `min-h-[100px] bg-[#262626]` : `min-h-[60px] bg-transparent group-hover:bg-[#262626] focus-within:bg-[#262626]`} rounded-lg border border-transparent hover:border-[#3a3a3a] focus-within:border-gray-500 outline-none nodrag nowheel transition-colors`, `点上方按钮生成，或输入 @ 引用资产`, {
            paddingX: 10,
            paddingY: 8,
            fontSizePx: 12,
            lineHeight: 1.625,
            minHeightPx: r ? 100 : 60
          })}
          </Component2754>
          <Component2756>
            <Component2755 className={`text-xs font-medium text-gray-300 mb-1.5`}>{`生视频`}</Component2755>
            {At(t, `videoPrompt`, `w-full ${r ? `min-h-[100px] bg-[#262626]` : `min-h-[60px] bg-transparent group-hover:bg-[#262626] focus-within:bg-[#262626]`} rounded-lg border border-transparent hover:border-[#3a3a3a] focus-within:border-gray-500 outline-none nodrag nowheel transition-colors`, `点上方按钮生成，或输入 @ 引用资产`, {
            paddingX: 10,
            paddingY: 8,
            fontSizePx: 12,
            lineHeight: 1.625,
            minHeightPx: r ? 100 : 60
          })}
          </Component2756>
        </Component2757>
        <Kt type={`source`} position={X.Right} id={`shot-${t.id}`} className={`!w-3 !h-3 !border-2 !z-20 ${n ? `!opacity-0 !pointer-events-none` : `!bg-white !border-[#1c1c1c]`}`} style={{
        top: r ? 32 : `50%`,
        right: n ? 0 : r ? -10 : -22,
        transform: r ? undefined : `translateY(-50%)`
      }} title={`镜${t.index} 单独连线`} />
      </Component2758>;
  };
  const Component2759 = `div`;
  const Component2760 = `div`;
  const Component2761 = `div`;
  const Component2762 = `span`;
  const Component2763 = `span`;
  const Component2764 = `div`;
  const Component2765 = `div`;
  const Component2766 = `div`;
  const Component2767 = `div`;
  const Component2768 = `button`;
  const Component2769 = `button`;
  const Component2770 = `div`;
  const Component2771 = `span`;
  const Component2772 = `button`;
  const Component2773 = `button`;
  const Component2774 = `button`;
  const Component2775 = `div`;
  const Component2776 = `div`;
  const Component2777 = `div`;
  const Component2778 = `div`;
  const Component2794 = `div`;
  const Component2795 = `div`;
  const Component2796 = `div`;
  const Component2797 = `div`;
  let dn = t => {
    return <Component2797>
        {b === 1 && <Component2759 className={`flex gap-3 ${t ? `p-2` : `px-4 py-3`}`}>
            {an()}
            {sn(t)}
          </Component2759>}
        {b === 2 && <Component2761 className={`flex items-stretch`}>
            <Component2760 className={`flex-1 min-w-0 ${t ? `p-2` : `px-4 py-3`}`}>
              {Zt(t)}
            </Component2760>
            {Qt(t)}
          </Component2761>}
        {b === 3 && <Component2796 className={t ? `p-2` : `px-4 py-3`}>
            {p.videoAssetUploadProgress?.status === `uploading` && <Component2767 className={`mb-3 rounded-lg border border-white/10 bg-[#202020] px-3 py-2`}>
                <Component2764 className={`mb-1.5 flex items-center justify-between text-[11px]`}>
                  <Component2762 className={`text-gray-300`}>{`正在连接视频素材`}</Component2762>
                  <Component2763 className={`text-gray-500`}>
                    {p.videoAssetUploadProgress.completed}
                    {`/`}
                    {p.videoAssetUploadProgress.total}
                  </Component2763>
                </Component2764>
                <Component2766 className={`h-1 overflow-hidden rounded-full bg-[#333]`}>
                  <Component2765 className={`h-full bg-emerald-400 transition-all`} style={{
              width: `${p.videoAssetUploadProgress.total ? p.videoAssetUploadProgress.completed / p.videoAssetUploadProgress.total * 100 : 0}%`
            }} />
                </Component2766>
              </Component2767>}
            <Component2776 className={`flex items-center justify-between mb-4 gap-2`}>
              <Component2770 className={`flex items-center gap-0.5 p-0.5 rounded-lg bg-[#262626]`}>
                <Component2768 className={`px-2.5 py-1 rounded-md text-[11px] transition-colors nodrag ${xe === `list` ? `bg-gray-100 text-gray-950` : `text-gray-400 hover:text-gray-200`}`} onClick={() => {
              return Se(`list`);
            }}>{`列表`}</Component2768>
                <Component2769 className={`px-2.5 py-1 rounded-md text-[11px] transition-colors nodrag ${xe === `single` ? `bg-gray-100 text-gray-950` : `text-gray-400 hover:text-gray-200`}`} onClick={() => {
              return Se(`single`);
            }}>{`单镜头`}</Component2769>
              </Component2770>
              {xe === `list` && <Component2775 className={`flex items-center gap-1.5 nodrag`}>
                  <Component2771 className={`mr-0.5 text-[11px] text-gray-500`}>{`批量操作：`}</Component2771>
                  <Component2772 className={`inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-950 hover:bg-white`} onClick={() => {
              let t = m.filter(e => {
                return Ze.has(e.id);
              }).map(e => {
                return e.id;
              });
              p.onGenerateShotPrompts?.(e, undefined, t.length ? t : undefined);
            }}>
                    <_Component19 size={12} />
                    {` 提示词`}
                  </Component2772>
                  <Component2773 className={`rounded-lg bg-[#2a2a2a] px-2.5 py-1.5 text-xs text-gray-200 hover:bg-[#333]`} onClick={() => {
              return window.dispatchEvent(new CustomEvent(`script-box-connect-shots`, {
                detail: {
                  nodeId: e,
                  shotIds: m.filter(e => {
                    return Ze.has(e.id);
                  }).map(e => {
                    return e.id;
                  }),
                  target: `image`
                }
              }));
            }}>{`连接生图`}</Component2773>
                  <Component2774 className={`rounded-lg bg-[#2a2a2a] px-2.5 py-1.5 text-xs text-gray-200 hover:bg-[#333]`} onClick={() => {
              return window.dispatchEvent(new CustomEvent(`script-box-connect-shots`, {
                detail: {
                  nodeId: e,
                  shotIds: m.filter(e => {
                    return Ze.has(e.id);
                  }).map(e => {
                    return e.id;
                  }),
                  target: `video`
                }
              }));
            }}>{`连接视频`}</Component2774>
                </Component2775>}
            </Component2776>
            {x ? xe === `list` ? <Component2778>
                  <Component2777 className={`space-y-2`}>
                    {K.map(e => {
              return un(e, t, false);
            })}
                  </Component2777>
                  {on()}
                </Component2778> : <Component2794>
                  {(() => {
            let n = Te * D_;
            let r = Math.min(n + D_, m.length);
            let i = n + Math.min(Math.max(Ce - n, 0), Math.max(r - n - 1, 0));
            let a = m[i] || m[Math.min(Ce, m.length - 1)];
            const Component2779 = `button`;
            const Component2780 = `span`;
            const Component2781 = `span`;
            const Component2782 = `button`;
            const Component2783 = `button`;
            const Component2784 = `div`;
            const Component2785 = `div`;
            const Component2786 = `button`;
            const Component2787 = `div`;
            const Component2788 = `button`;
            const Component2789 = `button`;
            const Component2790 = `button`;
            const Component2791 = `button`;
            const Component2792 = `div`;
            const Component2793 = `div`;
            return <Q.Fragment>
                        <Component2793 className={`flex items-center justify-between mb-3`}>
                          <Component2787 className={`flex items-center justify-start gap-2`}>
                            <Component2779 className={`text-5xl font-light leading-none text-gray-500 hover:text-white nodrag`} disabled={i <= 0} onClick={() => {
                    we(i - 1);
                    Ee(Math.floor((i - 1) / D_));
                  }}>{`‹`}</Component2779>
                            <Component2785 className={`relative text-center`}>
                              <Component2782 className={`flex items-baseline gap-2 nodrag`} onMouseEnter={() => {
                      return Oe(true);
                    }}>
                                <Component2780 className={`text-3xl text-white font-semibold`} style={{
                        fontFamily: `STSong, SimSun, "Songti SC", serif`
                      }}>
                                  {`镜`}
                                  {a.index}
                                </Component2780>
                                <Component2781 className={`text-sm text-gray-500`}>
                                  {`/`}
                                  {m.length}
                                </Component2781>
                                <_Component33 size={14} className={`text-gray-500`} />
                              </Component2782>
                              {De && <Component2784 className={`absolute left-1/2 top-full z-50 mt-1 grid max-h-64 w-[360px] -translate-x-1/2 grid-cols-10 gap-1 rounded-lg border border-[#3a3a3a] bg-[#202020] p-2 shadow-xl`} onClick={e => {
                      if (e.target === e.currentTarget) {
                        Oe(false);
                      }
                    }} onMouseLeave={() => {
                      return Oe(false);
                    }}>
                                  {m.map((e, t) => {
                        return <Component2783 className={`h-7 w-7 rounded border border-white/10 text-center text-xs text-gray-300 hover:border-white/50 hover:bg-[#333]`} onClick={() => {
                          we(t);
                          Ee(Math.floor(t / D_));
                          Oe(false);
                        }} key={e.id}>
                                        {e.index}
                                      </Component2783>;
                      })}
                                </Component2784>}
                            </Component2785>
                            <Component2786 className={`text-5xl font-light leading-none text-gray-500 hover:text-white nodrag`} disabled={i >= m.length - 1} onClick={() => {
                    we(i + 1);
                    Ee(Math.floor((i + 1) / D_));
                  }}>{`›`}</Component2786>
                          </Component2787>
                          <Component2792 className={`flex items-center justify-end gap-2`}>
                            {a.promptLoading ? <Component2788 type={`button`} className={`h-8 rounded-md bg-[#2a2a2a] px-3 text-xs text-gray-200 nodrag`} title={`生成中，点击停止`} onClick={() => {
                    return p.onStopScriptItem?.(e, `shot`, a.id);
                  }}>{`生成中`}</Component2788> : <Component2789 type={`button`} className={`h-8 rounded-md bg-[#2a2a2a] px-3 text-xs text-gray-200 hover:bg-[#333] nodrag`} onClick={() => {
                    return p.onGenerateShotPrompts?.(e, a.id);
                  }}>
                                {a.prompt || a.videoPrompt ? `重生成提示词` : `生成提示词`}
                              </Component2789>}
                            <Component2790 className={`inline-flex min-w-[76px] items-center justify-center gap-1.5 px-3.5 py-2 rounded-md bg-white text-gray-950 text-xs hover:bg-gray-200 nodrag`} onClick={() => {
                    return window.dispatchEvent(new CustomEvent(`script-box-connect-shot`, {
                      detail: {
                        nodeId: e,
                        shotId: a.id,
                        target: `image`
                      }
                    }));
                  }}>
                              {cn(a.id, `image`) ? `√ 生图` : `生图`}
                            </Component2790>
                            <Component2791 className={`inline-flex min-w-[76px] items-center justify-center gap-1.5 px-3.5 py-2 rounded-md bg-white text-gray-950 text-xs hover:bg-gray-200 nodrag`} onClick={() => {
                    return window.dispatchEvent(new CustomEvent(`script-box-connect-shot`, {
                      detail: {
                        nodeId: e,
                        shotId: a.id,
                        target: `video`
                      }
                    }));
                  }}>
                              {cn(a.id, `video`) ? `√ 视频` : `生视频`}
                            </Component2791>
                          </Component2792>
                        </Component2793>
                        {un(a, t, true)}
                      </Q.Fragment>;
          })()}
                </Component2794> : <Component2795 className={`text-sm text-gray-500 text-center py-6`}>{`先生成脚本`}</Component2795>}
          </Component2796>}
      </Component2797>;
  };
  let fn = (() => {
    let t = m.length;
    let n = h.length;
    let i = h.filter(e => {
      return e.imageUrl;
    }).length;
    let a = m.filter(e => {
      return e.prompt || e.videoPrompt;
    }).length;
    let o = [{
      n: 1,
      title: `确认镜头`,
      desc: t === 0 ? `暂无镜头` : `${t}镜头`,
      progress: +(t > 0)
    }, {
      n: 2,
      title: `准备资产`,
      desc: n === 0 ? `暂无资产` : `${i}/${n}`,
      progress: n === 0 ? 0 : i / n
    }, {
      n: 3,
      title: `合成提示词`,
      desc: t === 0 ? `暂无镜头` : `${a}/${t}`,
      progress: t === 0 ? 0 : a / t
    }];
    const Component2809 = `div`;
    return <Component2809 className={`flex items-center flex-1 max-w-3xl mx-auto text-xs w-full`}>
        {o.map((t, n) => {
        let i = t.n === b;
        let a = n === o.length - 1;
        const Component2798 = `circle`;
        const Component2799 = `circle`;
        const Component2800 = `svg`;
        const Component2801 = `span`;
        const Component2802 = `div`;
        const Component2803 = `span`;
        const Component2804 = `span`;
        const Component2805 = `div`;
        const Component2806 = `button`;
        const Component2807 = `div`;
        const Component2808 = `div`;
        return <Component2808 className={`flex items-center flex-1`} key={t.n}>
              <Component2806 className={`flex items-center gap-3 nodrag text-left rounded-xl px-3 py-1.5 transition-colors w-[160px] ${i ? `bg-[#2a2a2a]` : `hover:bg-[#222]`}`} onClick={() => {
            return r(e, {
              step: t.n
            });
          }}>
                <Component2802 className={`relative flex items-center justify-center w-7 h-7 shrink-0`}>
                  <Component2800 className={`absolute inset-0 w-full h-full -rotate-90`} viewBox={`0 0 24 24`}>
                    <Component2798 cx={`12`} cy={`12`} r={`11`} fill={`none`} stroke={i ? `#3a3a3a` : `#2a2a2a`} strokeWidth={`2`} />
                    <Component2799 cx={`12`} cy={`12`} r={`11`} fill={`none`} stroke={i ? `#fff` : `#666`} strokeWidth={`2`} strokeDasharray={Math.PI * 2 * 11} strokeDashoffset={Math.PI * 2 * 11 * (1 - t.progress)} className={`transition-all duration-300 ease-out`} />
                  </Component2800>
                  <Component2801 className={`relative z-10 text-[11px] font-medium ${i ? `text-white` : `text-gray-400`}`}>
                    {t.n}
                  </Component2801>
                </Component2802>
                <Component2805 className={`flex flex-col flex-1 min-w-0`}>
                  <Component2803 className={`text-[12px] font-medium truncate ${i ? `text-white` : `text-gray-400`}`}>
                    {t.title}
                  </Component2803>
                  <Component2804 className={`text-[10px] truncate ${i ? `text-gray-400` : `text-gray-500`}`}>
                    {t.desc}
                  </Component2804>
                </Component2805>
              </Component2806>
              {!a && <Component2807 className={`flex-1 mx-4 h-px bg-[#333]`} />}
            </Component2808>;
      })}
      </Component2809>;
  })();
  let pn = b === 3 && xe === `single`;
  if (l < 0.2 && !n && !k) {
    const Component2810 = `div`;
    const Component2811 = `div`;
    const Component2812 = `div`;
    const Component2813 = `div`;
    const Component2814 = `div`;
    const Component2815 = `span`;
    const Component2816 = `span`;
    const Component2817 = `span`;
    const Component2818 = `span`;
    const Component2819 = `span`;
    const Component2820 = `div`;
    const Component2821 = `div`;
    const Component2822 = `div`;
    const Component2823 = `div`;
    const Component2824 = `div`;
    return <Component2824 className={`relative flex flex-col items-stretch ${n ? `z-50` : `z-10`}`} style={{
      width: 860,
      height: 220
    }}>
        <_cmp_Ti id={e} data={t} defaultTitle={`脚本盒子`} icon={<_Component48 size={11} className={`text-gray-500`} />} className={`w-full justify-start text-left shrink-0`} />
        <Component2823 className={`w-full rounded-[20px] border border-white/10 bg-[#1c1c1c] px-6 py-8 shadow-[0_12px_40px_rgba(0,0,0,0.35)]`} style={{
        height: 184
      }}>
          <Component2822 className={`flex items-center gap-3`}>
            <Component2813 className={`relative shrink-0`}>
              <Component2810 className={`absolute -left-1 top-1 h-10 w-10 rounded-lg border border-white/20 bg-[#232323]`} />
              <Component2811 className={`absolute left-1 -top-1 h-10 w-10 rounded-lg border border-white/25 bg-[#2a2a2a]`} />
              <Component2812 className={`relative flex h-10 w-10 items-center justify-center rounded-lg border border-white/40 bg-[#1c1c1c]`}>
                <_Component48 size={20} className={`text-gray-400`} />
              </Component2812>
            </Component2813>
            <Component2821 className={`min-w-0 flex-1`}>
              <Component2814 className={`truncate text-xl font-semibold text-white`} style={{
              fontFamily: `STSong, SimSun, "Songti SC", serif`
            }}>
                {p.label || `脚本盒子`}
              </Component2814>
              <Component2820 className={`mt-1 flex items-center gap-2 text-xs text-gray-500`}>
                <Component2815>
                  {m.length}
                  {` 镜头`}
                </Component2815>
                <Component2816 className={`h-3 w-px bg-white/10`} />
                <Component2817>
                  {h.length}
                  {` 资产`}
                </Component2817>
                <Component2818 className={`h-3 w-px bg-white/10`} />
                <Component2819>
                  {`第 `}
                  {b}
                  {` 步`}
                </Component2819>
              </Component2820>
            </Component2821>
          </Component2822>
        </Component2823>
        {m.map(e => {
        return <Kt type={`source`} position={X.Right} id={`shot-${e.id}`} className={`!h-0 !w-0 !min-w-0 !border-0 !bg-transparent`} style={{
          right: 0,
          top: `50%`
        }} key={e.id} />;
      })}
      </Component2824>;
  } else {
    const Component2825 = `input`;
    const Component2826 = `div`;
    const Component2827 = `div`;
    const Component2828 = `span`;
    const Component2829 = `button`;
    const Component2830 = `button`;
    const Component2831 = `div`;
    const Component2832 = `div`;
    const Component2833 = `span`;
    const Component2834 = `button`;
    const Component2835 = `div`;
    const Component2836 = `div`;
    const Component2837 = `div`;
    const Component2838 = `div`;
    const Component2839 = `button`;
    const Component2840 = `button`;
    const Component2841 = `div`;
    const Component2842 = `div`;
    const Component2843 = `div`;
    const Component2844 = `div`;
    const Component2845 = `div`;
    const Component2846 = `span`;
    const Component2847 = `button`;
    const Component2848 = `div`;
    const Component2849 = `textarea`;
    const Component2850 = `div`;
    const Component2851 = `div`;
    const Component2852 = `span`;
    const Component2853 = `span`;
    const Component2854 = `div`;
    const Component2855 = `button`;
    const Component2856 = `div`;
    const Component2857 = `div`;
    const Component2858 = `button`;
    const Component2859 = `div`;
    const Component2860 = `input`;
    const Component2861 = `div`;
    const Component2862 = `div`;
    const Component2863 = `textarea`;
    const Component2864 = `div`;
    const Component2865 = `div`;
    const Component2866 = `textarea`;
    const Component2867 = `div`;
    const Component2868 = `div`;
    const Component2869 = `span`;
    const Component2870 = `button`;
    const Component2871 = `div`;
    const Component2872 = `p`;
    const Component2873 = `textarea`;
    const Component2874 = `div`;
    const Component2875 = `span`;
    const Component2876 = `button`;
    const Component2877 = `div`;
    const Component2878 = `p`;
    const Component2879 = `textarea`;
    const Component2880 = `div`;
    const Component2881 = `span`;
    const Component2882 = `button`;
    const Component2883 = `div`;
    const Component2884 = `textarea`;
    const Component2885 = `div`;
    const Component2886 = `div`;
    const Component2887 = `button`;
    const Component2888 = `div`;
    const Component2889 = `div`;
    const Component2890 = `div`;
    const Component2891 = `button`;
    const Component2892 = `img`;
    const Component2893 = `div`;
    const Component2894 = `div`;
    return <Component2894 className={`relative flex flex-col items-stretch group/node transition-colors ${n ? `z-50` : `z-10`}`} style={{
      width: 860
    }}>
        <_cmp_Ti id={e} data={t} defaultTitle={`脚本盒子`} icon={<_Component48 size={11} className={`text-gray-500`} />} className={`w-full justify-start text-left`} />
        <Component2825 type={`file`} ref={dt} accept={`image/*`} className={`hidden`} onChange={wt} />
        <Component2838 className={`relative w-full ${pn ? `isolate pt-2 pb-3` : ``}`}>
          {pn && <Q.Fragment>
              <Component2826 className={`pointer-events-none absolute inset-x-2 top-4 bottom-0 z-0 translate-x-3 rotate-2 rounded-[22px] border border-white/10 bg-[#2a2a2a] shadow-xl`} />
              <Component2827 className={`pointer-events-none absolute inset-x-1 top-2 bottom-1 z-0 -translate-x-2 -rotate-1 rounded-[22px] border border-white/15 bg-[#242424] shadow-xl`} />
            </Q.Fragment>}
          <Component2837 className={`relative z-10 w-full bg-[#1c1c1c] rounded-[20px] border shadow-[0_12px_40px_rgba(0,0,0,0.35)] ${n ? `border-white/35` : `border-white/10 hover:border-white/20`}`}>
            <Component2832 className={`flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#191919] rounded-t-[20px]`}>
              {fn}
              <Component2831 className={`flex items-center gap-2`}>
                {k && <Component2828 className={`inline-flex items-center gap-1 text-[11px] text-emerald-400`}>
                    <_Component22 size={12} className={`animate-spin`} />
                    {` `}
                    {typeof en == `number` && en > 0 ? `生成中 ${en} 字 · ${pt}s` : `生成中 ${pt}s`}
                  </Component2828>}
                <Component2829 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md nodrag`} onClick={() => {
                return V(true);
              }} title={`总体提示词设置`}>
                  <_Component90 size={14} />
                </Component2829>
                <Component2830 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md nodrag`} onClick={() => {
                return j(true);
              }} title={`全屏显示`}>
                  <Ke size={14} />
                </Component2830>
              </Component2831>
            </Component2832>
            <Component2836 className={`relative`}>
              {k && <Component2835 className={`absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-[#1a1a1a]/75 rounded-b-[20px]`}>
                  <_Component22 className={`w-7 h-7 animate-spin text-emerald-400`} />
                  <Component2833 className={`text-xs text-gray-200`}>
                    {typeof en == `number` && en > 0 ? `正在生成分镜脚本… 已接收 ${en} 字 · 已用 ${pt}s` : `正在生成分镜脚本… 已用 ${pt}s`}
                  </Component2833>
                  <Component2834 className={`mt-1 px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30 nodrag nopan`} onMouseDown={e => {
                return e.stopPropagation();
              }} onClick={t => {
                t.stopPropagation();
                p.onStop?.(e);
              }}>{`停止生成`}</Component2834>
                </Component2835>}
              {dn(false)}
            </Component2836>
          </Component2837>
        </Component2838>
        {A && Fn.createPortal(<Component2845 className={`fixed inset-0 z-[2147483646] bg-black/85 backdrop-blur-sm flex items-center justify-center p-6`} onMouseDown={e => {
        return e.stopPropagation();
      }} onWheel={e => {
        return e.stopPropagation();
      }}>
              <Component2844 className={`relative bg-[#1c1c1c] rounded-2xl border border-[#3a3a3a] shadow-2xl flex flex-col`} style={{
          width: `92vw`,
          height: `88vh`
        }}>
                <Component2842 className={`flex items-center justify-between px-5 py-3 border-b border-[#2c2c2c]`}>
                  {fn}
                  <Component2841 className={`flex items-center gap-2`}>
                    <Component2839 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} onClick={() => {
                return V(true);
              }} title={`总体提示词设置`}>
                      <_Component90 size={15} />
                    </Component2839>
                    <Component2840 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} onClick={() => {
                return j(false);
              }}>
                      <Gt size={16} />
                    </Component2840>
                  </Component2841>
                </Component2842>
                <Component2843 className={`flex-1 overflow-y-auto custom-scrollbar p-3`}>
                  {dn(true)}
                </Component2843>
              </Component2844>
            </Component2845>, document.body)}
        {oe && Fn.createPortal(<Component2851 className={`fixed inset-0 z-[2147483647] bg-black/85 backdrop-blur-sm flex items-center justify-center p-8`} onMouseDown={() => {
        return se(false);
      }}>
              <Component2850 ref={G} className={`relative w-[min(1000px,90vw)] h-[80vh] rounded-2xl border border-[#3a3a3a] bg-[#1c1c1c] p-5 shadow-2xl`} onMouseDown={e => {
          return e.stopPropagation();
        }}>
                <Component2848 className={`mb-3 flex items-center justify-between`}>
                  <Component2846 className={`text-sm text-white`}>{`剧情`}</Component2846>
                  <Component2847 className={`p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10`} onClick={() => {
              return se(false);
            }}>
                    <Gt size={16} />
                  </Component2847>
                </Component2848>
                <Component2849 autoFocus={true} value={S} onChange={e => {
            return C(e.target.value);
          }} placeholder={`描述剧情片段、故事，为你生成分镜脚本`} className={`h-[calc(100%-40px)] w-full resize-none rounded-xl border border-[#3a3a3a] bg-[#262626] p-4 text-sm text-gray-200 outline-none custom-scrollbar`} />
                <_cmp_Fi targetRef={G} minWidth={520} minHeight={360} />
              </Component2850>
            </Component2851>, document.body)}
        {re && Fn.createPortal(<Component2890 className={`fixed inset-0 z-[2147483647] bg-black/85 backdrop-blur-sm flex items-center justify-center p-6`} onMouseDown={e => {
        return e.stopPropagation();
      }} onWheel={e => {
        return e.stopPropagation();
      }}>
              <Component2889 className={`relative bg-[#1c1c1c] rounded-2xl border border-[#3a3a3a] shadow-2xl flex flex-col`} style={{
          width: `min(900px, 92vw)`,
          height: `86vh`
        }} onClick={e => {
          return e.stopPropagation();
        }}>
                <Component2856 className={`flex items-center justify-between px-5 py-3 border-b border-[#2c2c2c]`}>
                  <Component2854 className={`flex flex-col gap-0.5`}>
                    <Component2852 className={`text-sm text-white`}>{`提示词自定义（留空则用默认）`}</Component2852>
                    <Component2853 className={`text-[11px] text-gray-500`}>{`改完后需重新点「生成剧本 / 生成提示词」才会生效，不会自动改写已生成内容`}</Component2853>
                  </Component2854>
                  <Component2855 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} onClick={() => {
              return V(false);
            }}>
                    <Gt size={16} />
                  </Component2855>
                </Component2856>
                <Component2886 className={`flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5 nowheel`} onWheel={e => {
            return e.stopPropagation();
          }}>
                  <Component2861>
                    <Component2857 className={`mb-1.5 text-xs text-gray-200`}>{`画面比例`}</Component2857>
                    <Component2859 className={`flex flex-wrap gap-2`}>
                      {[`16:9`, `9:16`, `4:3`, `3:4`, `1:1`, `custom`].map(t => {
                  return <Component2858 className={`rounded-md px-3 py-1.5 text-xs ${(p.aspectRatio || `16:9`) === t ? `bg-white text-gray-950` : `bg-[#262626] text-gray-400 hover:text-white`}`} onClick={() => {
                    return r(e, {
                      aspectRatio: t
                    });
                  }} key={t}>
                            {t === `custom` ? `自定义` : t}
                          </Component2858>;
                })}
                    </Component2859>
                    {(p.aspectRatio || `16:9`) === `custom` && <Component2860 value={p.customAspectRatio || ``} onChange={t => {
                return r(e, {
                  customAspectRatio: t.target.value
                });
              }} placeholder={`例如 21:9`} className={`mt-2 w-44 rounded-md border border-[#3a3a3a] bg-[#262626] px-3 py-1.5 text-xs text-gray-200 outline-none`} />}
                  </Component2861>
                  <Component2868 className={`grid grid-cols-2 gap-4`}>
                    <Component2864>
                      <Component2862 className={`mb-1.5 text-xs text-gray-200`}>{`生图强制约束`}</Component2862>
                      <Component2863 value={p.imageGlobalConstraint || ``} onChange={t => {
                  return r(e, {
                    imageGlobalConstraint: t.target.value
                  });
                }} placeholder={`例如：禁止画面文字、水印、边框；人物肢体结构正确……`} className={`min-h-[110px] w-full resize-y rounded-lg border border-[#3a3a3a] bg-[#262626] p-3 text-xs text-gray-200 outline-none`} />
                    </Component2864>
                    <Component2867>
                      <Component2865 className={`mb-1.5 text-xs text-gray-200`}>{`生视频强制约束`}</Component2865>
                      <Component2866 value={p.videoGlobalConstraint ?? [...(p.globalConstraints || []), p.customGlobalConstraint || ``].filter(Boolean).join(`；`)} onChange={t => {
                  return r(e, {
                    videoGlobalConstraint: t.target.value
                  });
                }} placeholder={E_.join(`；`)} className={`min-h-[110px] w-full resize-y rounded-lg border border-[#3a3a3a] bg-[#262626] p-3 text-xs text-gray-200 outline-none`} />
                    </Component2867>
                  </Component2868>
                  <Component2874>
                    <Component2871 className={`flex items-center justify-between mb-1.5`}>
                      <Component2869 className={`text-xs text-gray-200`}>{`剧本生成提示词`}</Component2869>
                      <Component2870 className={`text-[11px] text-gray-500 hover:text-gray-300 nodrag`} onClick={() => {
                  return r(e, {
                    customScriptPrompt: `你是顶级爆款短剧编剧 + 资深影视分镜师，集编剧、导演、制片人视角于一身，精通短剧/网剧/短视频的爆款公式。
你的创作哲学：节奏第一、情绪至上、悬念不断、前3秒定生死、强冲突×高密度爽点×持续悬念×极致情绪。

【创作流程（必须先想清楚再出分镜，禁止直接平铺直叙）】
1. 先在脑中规划一条清晰故事线：明确题材类型、主角的欲望与成长弧线、核心冲突、反派动机；
2. 用「事件→反应→反转→再反应（设局→入局→破局→新局）」组织剧情，保证冲突逐级升级；
3. 按时间结构铺排：开场即冲突锚定 → 情绪爆破 → 反转打脸 → 结尾留悬念钩子；
4. 再把这条故事线拆成连续、有因果递进的分镜，每个分镜承担明确的叙事功能，不要无效镜头、不要重复镜头、不要流水账；
5. 镜头语言要有变化：景别（大远景/全景/中景/近景/特写）与运镜（推/拉/摇/移/跟/升降）按情绪需要切换，关键情绪点用特写。

【输出格式】严格输出一个 JSON 对象（只返回纯 JSON，不要解释、不要 Markdown 代码块）：
{"projectName":"根据故事生成的简洁项目名称，2至8个中文字符，例如：小红帽","globalStyle":"整部片子的统一视觉风格，例如：中世纪童话·皮克斯3D","logline":"一句话故事核心（用于自检，可选）","shots":[{"index":1,"duration":"5s","description":"画面描述：聚焦这一镜要呈现的画面与动作，凡出现 assets 中的角色/场景/道具，必须写成 @名称 形式，例如 @小红帽 走进 @幽暗森林","shotType":"景别","lighting":"光影氛围","dialogue":"该镜对白或旁白（如有）","sound":"音效（如有）","motion":"运镜"}],"assets":[{"category":"character|scene|prop","name":"名称","description":"主体外观描述，详细具体（角色：体型/发型/五官/瞳色/肤色/服装/配饰/神态；场景：环境/前景背景/氛围/光线；道具：形状/材质/颜色/细节），只描述主体本身，不要写构图/视角/布光/负面词，这些由系统自动补全"}]}

【硬性要求】assets 的 name 必须与 shots 的 description 中 @ 引用的名称完全一致；分镜数量与时长要与剧情体量匹配，叙事连贯、有头有尾。
【分镜自包含规则（强制）】每个 shot 的 description 必须独立完整、自包含写明当前所在场景（用 @场景名 形式），禁止采用"上一镜已写过场景所以这一镜省略"的上下文省略写法。即便连续多镜处于同一个场景，每一镜的 description 中也必须重复出现该场景的 @场景名 引用。
【资产完整性规则（强制）】若某个 shot 的动作或对白发生在确定的场景中（即便你认为上一镜已经描述过），必须在该镜的 description 中再次显式 @引用 该场景资产名，绝不允许只写角色动作而漏掉所在场景。`
                  });
                }}>{`填入默认`}</Component2870>
                    </Component2871>
                    <Component2872 className={`mb-1.5 text-[10px] leading-relaxed text-gray-600`}>{`用于第 1 步「生成剧本」；只影响之后新生成的分镜结构，不会改已有分镜文案。`}</Component2872>
                    <Component2873 value={p.customScriptPrompt ?? `你是顶级爆款短剧编剧 + 资深影视分镜师，集编剧、导演、制片人视角于一身，精通短剧/网剧/短视频的爆款公式。
你的创作哲学：节奏第一、情绪至上、悬念不断、前3秒定生死、强冲突×高密度爽点×持续悬念×极致情绪。

【创作流程（必须先想清楚再出分镜，禁止直接平铺直叙）】
1. 先在脑中规划一条清晰故事线：明确题材类型、主角的欲望与成长弧线、核心冲突、反派动机；
2. 用「事件→反应→反转→再反应（设局→入局→破局→新局）」组织剧情，保证冲突逐级升级；
3. 按时间结构铺排：开场即冲突锚定 → 情绪爆破 → 反转打脸 → 结尾留悬念钩子；
4. 再把这条故事线拆成连续、有因果递进的分镜，每个分镜承担明确的叙事功能，不要无效镜头、不要重复镜头、不要流水账；
5. 镜头语言要有变化：景别（大远景/全景/中景/近景/特写）与运镜（推/拉/摇/移/跟/升降）按情绪需要切换，关键情绪点用特写。

【输出格式】严格输出一个 JSON 对象（只返回纯 JSON，不要解释、不要 Markdown 代码块）：
{"projectName":"根据故事生成的简洁项目名称，2至8个中文字符，例如：小红帽","globalStyle":"整部片子的统一视觉风格，例如：中世纪童话·皮克斯3D","logline":"一句话故事核心（用于自检，可选）","shots":[{"index":1,"duration":"5s","description":"画面描述：聚焦这一镜要呈现的画面与动作，凡出现 assets 中的角色/场景/道具，必须写成 @名称 形式，例如 @小红帽 走进 @幽暗森林","shotType":"景别","lighting":"光影氛围","dialogue":"该镜对白或旁白（如有）","sound":"音效（如有）","motion":"运镜"}],"assets":[{"category":"character|scene|prop","name":"名称","description":"主体外观描述，详细具体（角色：体型/发型/五官/瞳色/肤色/服装/配饰/神态；场景：环境/前景背景/氛围/光线；道具：形状/材质/颜色/细节），只描述主体本身，不要写构图/视角/布光/负面词，这些由系统自动补全"}]}

【硬性要求】assets 的 name 必须与 shots 的 description 中 @ 引用的名称完全一致；分镜数量与时长要与剧情体量匹配，叙事连贯、有头有尾。
【分镜自包含规则（强制）】每个 shot 的 description 必须独立完整、自包含写明当前所在场景（用 @场景名 形式），禁止采用"上一镜已写过场景所以这一镜省略"的上下文省略写法。即便连续多镜处于同一个场景，每一镜的 description 中也必须重复出现该场景的 @场景名 引用。
【资产完整性规则（强制）】若某个 shot 的动作或对白发生在确定的场景中（即便你认为上一镜已经描述过），必须在该镜的 description 中再次显式 @引用 该场景资产名，绝不允许只写角色动作而漏掉所在场景。`} onChange={t => {
                return r(e, {
                  customScriptPrompt: t.target.value
                });
              }} className={`w-full min-h-[120px] rounded-lg bg-[#262626] border border-[#3a3a3a] px-3 py-2 text-xs text-gray-200 outline-none resize-y custom-scrollbar nowheel`} />
                  </Component2874>
                  <Component2880>
                    <Component2877 className={`flex items-center justify-between mb-1.5`}>
                      <Component2875 className={`text-xs text-gray-200`}>{`分镜/视频提示词生成`}</Component2875>
                      <Component2876 className={`text-[11px] text-gray-500 hover:text-gray-300 nodrag`} onClick={() => {
                  return r(e, {
                    customShotPrompt: `你是资深电影导演、分镜设计师、AI绘画与AI视频提示词工程师。根据给定的单个分镜资料，输出一个严格 JSON 对象：
{"prompt":"用于生成静态画面的详细图像提示词","videoPrompt":"用于生成该镜头视频的详细提示词"}

【总体要求】
1. prompt 与 videoPrompt 必须围绕同一个镜头，主体身份、服装、道具、场景、时间、光线和空间关系完全一致。
2. 两个字段都要信息充足、语言连贯、可直接交给生成模型使用；每个字段建议 450 至 700 个中文字符，最低不得少于 400 个中文字符，禁止用空洞形容词凑字数。
3. 画面资料中的 @名称 是资产绑定标记，必须逐字原样保留，不能删减、改写、合并或替换成“角色”“人物”“主体”等泛称。

【prompt（生图）要求】
只写单帧中能够被摄像机看见的内容。按主体身份与外观、精确动作和姿态、角色间距离与视线关系、前中后景环境、关键道具位置、景别与构图、镜头焦段和视角、光源方向与明暗层次、色彩关系、材质纹理、空气透视、电影美术风格的顺序组织。明确每个 @资产 在画面中的位置、朝向、遮挡和互动。不得写对白、旁白、声音、音效、配乐、字幕、心理活动、画外信息或生成操作说明。

【videoPrompt（生视频）要求】
以 prompt 的画面状态为起点，详细描述镜头在指定时长内如何连续发展：起始画面、运镜方向和速度、焦点迁移、主体逐步动作、表情与视线变化、衣物毛发和环境物体的次级运动、光影与粒子变化、动作节奏、结束画面和停顿方式。避免突然跳切、瞬移、身份漂移和无因果动作。
必须加入本镜头提供的对白/旁白和音效，而且必须保留具体说话者姓名与完整原句。格式写成“角色名说：‘完整台词’”，旁白写成“旁白：‘完整原句’”，音效写成“环境音/动作音：具体声音内容”。严禁把具体姓名泛化为“角色说”“人物说”“他说/她说”，严禁遗漏、缩写或擅自改写台词。若资料明确没有对白或音效，才可不写。

【资产外观唯一性规则（强制）】输入中会提供“本分镜涉及资产清单”（含每个 @资产 的角色/场景/道具分类与外观/环境/材质描述）。你在写 prompt 和 videoPrompt 时必须：
1. 所有 @资产 的具体外观、服装、材质、颜色、体型、发型、瞳色、配饰、场景环境、道具细节等，必须与该清单中的描述 **完全一致**，绝不允许遗漏、改变或与清单冲突；
2. 禁止依赖“上文已经出现过所以这镜省略”的上下文记忆，禁止自行脑补或自由发挥清单中没有给出的外观特征；
3. 若该分镜的 description 中没有写明某场景名，但资产清单中包含该场景且从剧情推断本镜确实发生在此场景中，必须在画面中按清单描述把该场景完整呈现出来，并保留 @场景名 引用。

只返回可解析的纯 JSON，不要解释，不要 Markdown，不要在 JSON 前后添加任何文字。`
                  });
                }}>{`填入默认`}</Component2876>
                    </Component2877>
                    <Component2878 className={`mb-1.5 text-[10px] leading-relaxed text-gray-600`}>{`用于第 3 步「生成/重生成提示词」。系统仍会追加 JSON 格式与字数等硬规则，避免模型跑偏。`}</Component2878>
                    <Component2879 value={p.customShotPrompt ?? `你是资深电影导演、分镜设计师、AI绘画与AI视频提示词工程师。根据给定的单个分镜资料，输出一个严格 JSON 对象：
{"prompt":"用于生成静态画面的详细图像提示词","videoPrompt":"用于生成该镜头视频的详细提示词"}

【总体要求】
1. prompt 与 videoPrompt 必须围绕同一个镜头，主体身份、服装、道具、场景、时间、光线和空间关系完全一致。
2. 两个字段都要信息充足、语言连贯、可直接交给生成模型使用；每个字段建议 450 至 700 个中文字符，最低不得少于 400 个中文字符，禁止用空洞形容词凑字数。
3. 画面资料中的 @名称 是资产绑定标记，必须逐字原样保留，不能删减、改写、合并或替换成“角色”“人物”“主体”等泛称。

【prompt（生图）要求】
只写单帧中能够被摄像机看见的内容。按主体身份与外观、精确动作和姿态、角色间距离与视线关系、前中后景环境、关键道具位置、景别与构图、镜头焦段和视角、光源方向与明暗层次、色彩关系、材质纹理、空气透视、电影美术风格的顺序组织。明确每个 @资产 在画面中的位置、朝向、遮挡和互动。不得写对白、旁白、声音、音效、配乐、字幕、心理活动、画外信息或生成操作说明。

【videoPrompt（生视频）要求】
以 prompt 的画面状态为起点，详细描述镜头在指定时长内如何连续发展：起始画面、运镜方向和速度、焦点迁移、主体逐步动作、表情与视线变化、衣物毛发和环境物体的次级运动、光影与粒子变化、动作节奏、结束画面和停顿方式。避免突然跳切、瞬移、身份漂移和无因果动作。
必须加入本镜头提供的对白/旁白和音效，而且必须保留具体说话者姓名与完整原句。格式写成“角色名说：‘完整台词’”，旁白写成“旁白：‘完整原句’”，音效写成“环境音/动作音：具体声音内容”。严禁把具体姓名泛化为“角色说”“人物说”“他说/她说”，严禁遗漏、缩写或擅自改写台词。若资料明确没有对白或音效，才可不写。

【资产外观唯一性规则（强制）】输入中会提供“本分镜涉及资产清单”（含每个 @资产 的角色/场景/道具分类与外观/环境/材质描述）。你在写 prompt 和 videoPrompt 时必须：
1. 所有 @资产 的具体外观、服装、材质、颜色、体型、发型、瞳色、配饰、场景环境、道具细节等，必须与该清单中的描述 **完全一致**，绝不允许遗漏、改变或与清单冲突；
2. 禁止依赖“上文已经出现过所以这镜省略”的上下文记忆，禁止自行脑补或自由发挥清单中没有给出的外观特征；
3. 若该分镜的 description 中没有写明某场景名，但资产清单中包含该场景且从剧情推断本镜确实发生在此场景中，必须在画面中按清单描述把该场景完整呈现出来，并保留 @场景名 引用。

只返回可解析的纯 JSON，不要解释，不要 Markdown，不要在 JSON 前后添加任何文字。`} onChange={t => {
                return r(e, {
                  customShotPrompt: t.target.value
                });
              }} className={`w-full min-h-[100px] rounded-lg bg-[#262626] border border-[#3a3a3a] px-3 py-2 text-xs text-gray-200 outline-none resize-y custom-scrollbar nowheel`} />
                  </Component2880>
                  {[[`character`, `角色参考图模板`, `高质量专业角色设定图，横向构图，纯白色纯净背景，中性摄影棚灯光，平光布光；布局结构：正面半身特写 + 全身正面居中 + 左侧面视图 + 背面视图，无任何道具或背景物体。光影：中性摄影棚灯光，柔和的前侧光，清晰的轮廓定义，自然的肤色，面部清晰服装可辨识，平视镜头，完整全身，无裁剪。不得出现任何道具 / 武器 / 食物 / 饮料 / 手持物（角色空手）；不得出现复杂动作、夸张表情、面部遮挡；不得出现环境背景（仅白色）；不得出现其他角色；确保所有视图中的面部特征、发型、体型和服装保持一致；不得出现文字、水印、标签、UI元素；无背景场景，无过度风格化。`], [`scene`, `场景参考图模板`, `高质量专业场景设定图，横向构图，以 2 行 2 列的干净网格四等分整齐排版，每个格子都是独立的 16:9 横向画面，展示同一场景的四个大全景视角（1为正面中心线大全景视图，镜头正对场景中心轴，构图严格居中，画面同时包含顶面与底面，尽量展示完整空间层次、更多环境细节和深景深；2以1的中心线为参考，摄像机移动到场景左前方45度位置的大全景视图，镜头仍对准场景核心区域；3为以1的中心线为参考，摄像机移动到场景右前方45度位置的大全景视图；4为镜头在室内最深处向外拍摄的正中心全景图。四个视角必须表现同一地点、同一时间、同一天气、同一光源、同一空间结构和同一美术风格。环境清晰，细节丰富，景深较深，光影自然，专业摄影，超清画质。不得出现任何人物（这是空场景参考图），也不得出现人群、背影、剪影、人脸、手脚、人物倒影、人物影子、照片人物、屏幕人物、镜中人物、剧情事件、人物活动；不得让四个视角表现成四个不同场景；不得改变建筑结构、空间比例、主体位置、材质、色彩、天气、时间段或光源方向；画面构图不得倾斜、透视畸变、广角畸变、变形、扭曲；不得出现鱼眼视角、斜角、极端俯视、极端仰视；正面视图必须居中、对称、中心线构图；左前方 45 度、右前方 45 度和背后视角必须保持镜头稳定、空间连贯、比例一致；禁止模糊、低画质；禁止景深太浅；不得出现文字、水印、签名、边框、标签、UI元素、杂乱元素。`], [`prop`, `道具参考图模板`, `高质量写实道具多角度展示图，横向构图，以 2 行 3 列的干净网格整齐排版，展示道具的六个极正视角。纯白色纯净背景，专业产品影棚摄影，标准六视图参考。六视图包括：绝对正前方视图、绝对正后方视图、绝对左侧视图、绝对右侧视图、绝对正上方俯拍视图、绝对正下方仰拍视图。所有视图必须是同一件道具，材质、颜色、比例、结构完全一致。使用超长焦镜头或移轴镜头效果，将透视变形降到最低，物体所有本该平行的边缘在画面中保持平行，接近正交投影。每个视图都像在专业产品影棚中用三脚架精密校准拍摄，构图绝对端正，物体在每个格子中居中，无任何倾斜、旋转或透视畸变。画面出不得出现任何人物、角色、人群、人影等；不得出现手、脚、人脸、场景、建筑、自然景观；无其他道具；无文字、无水印、无 logo、无 UI 元素，不要任何剧情事件，保持道具本体清晰、保持完整轮廓、保持所有角度的材质和结构一致。`]].map(([t, n, i]) => {
              return <Component2885 key={t}>
                        <Component2883 className={`flex items-center justify-between mb-1.5`}>
                          <Component2881 className={`text-xs text-gray-300`}>{n}</Component2881>
                          <Component2882 className={`text-[11px] text-gray-500 hover:text-gray-300 nodrag`} onClick={() => {
                    return r(e, {
                      customAssetTemplates: {
                        ...(p.customAssetTemplates || {}),
                        [t]: i
                      }
                    });
                  }}>{`填入默认`}</Component2882>
                        </Component2883>
                        <Component2884 value={p.customAssetTemplates?.[t] ?? i} onChange={n => {
                  return r(e, {
                    customAssetTemplates: {
                      ...(p.customAssetTemplates || {}),
                      [t]: n.target.value
                    }
                  });
                }} className={`w-full min-h-[90px] rounded-lg bg-[#262626] border border-[#3a3a3a] px-3 py-2 text-xs text-gray-200 outline-none resize-y custom-scrollbar nowheel`} />
                      </Component2885>;
            })}
                </Component2886>
                <Component2888 className={`flex justify-end gap-2 px-5 py-3 border-t border-[#2c2c2c]`}>
                  <Component2887 className={`px-4 py-1.5 rounded-lg bg-gray-100 text-gray-950 text-xs font-medium hover:bg-white`} onClick={() => {
              return V(false);
            }}>{`完成`}</Component2887>
                </Component2888>
              </Component2889>
            </Component2890>, document.body)}
        {ce && Fn.createPortal(<Component2893 className={`fixed inset-0 z-[2147483647] bg-black/90 flex items-center justify-center p-6 cursor-zoom-out`} onMouseDown={e => {
        return e.stopPropagation();
      }} onWheel={e => {
        return e.stopPropagation();
      }} onClick={() => {
        return le(null);
      }}>
              <Component2891 className={`absolute top-4 right-4 p-2 text-white hover:text-gray-300 bg-black/50 rounded-full`} onClick={e => {
          e.stopPropagation();
          le(null);
        }}>
                <Gt size={20} />
              </Component2891>
              <Component2892 src={ce} alt={`预览`} className={`max-w-[92vw] max-h-[88vh] object-contain`} onClick={e => {
          return e.stopPropagation();
        }} />
            </Component2893>, document.body)}
        {ge && ut.current && <_cmp__Component91 isOpen={true} onClose={() => {
        return _e(false);
      }} transitResources={p.transitResources || []} canvasNodes={a()} defaultMediaType={`image`} onSelect={e => {
        vt(ut.current, {
          imageUrl: e
        });
        _e(false);
      }} />}
        {ve && be.current && <_cmp__Component91 title={`绑定角色语音（仅音频）`} isOpen={true} onClose={() => {
        return ye(false);
      }} transitResources={p.transitResources || []} canvasNodes={a()} defaultMediaType={`audio`} onSelect={(e, t) => {
        if (t === `audio` && be.current) {
          vt(be.current, {
            audioUrl: e
          });
        }
        ye(false);
      }} />}
      </Component2894>;
  }
});
export default k_;