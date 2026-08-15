// TODO(全局, 无需 import): data, selected, updateNodeData, setEdges, getNodes, character, p, scene, prop, m, f, o, xe, ye, n, q, ve, de, g, oe, x, r, shots, i, description, s, prompt, videoPrompt, dialogue, assets, index, duration, v, story, errorMsg, scriptProgressChars, loading, imageUrl, shotId, field, ee, motion, NodeFilter, tt, left, et, kind, role, text, ke, idx, ut, gridTemplateColumns, rt, shotType, at, ot, assetModelSettings, mt, gt, vt, pt, yt, ht, globalModel, je, globalStyle, k, ce, se, category, name, width, minHeight, qe, wt, b, selectedModel, ie, shotCount, right, transform, fontFamily, zIndex, gridMode, kt, jt, detail, nodeId, shotIds, title, desc, progress, step, l, z, height, aspectRatio, customAspectRatio, imageGlobalConstraint, videoGlobalConstraint, customScriptPrompt, customShotPrompt, customAssetTemplates
import _cmp__Component23 from "./_Component23.jsx";
import _cmp__Component8 from "./_Component8.jsx";
import _cmp__Component118 from "./_Component118.jsx";
import _cmp_a_ from "./a_.jsx";
import { id, We, it, nn, Vt, e, t, d, S, le, s_, pe, be, Te, K, xa, Da, Pe, Me, he, ue, c, Se, C, ze, w, H, Be, Le, a, O, Ve, Fe, W, R, j, F, L, E, Ze, t_, He, Qe, n_, N, go, _o, nt, A, M, r_, Ae, lt, P, e_, Xe, $e, I, h, Ge, ka, _t, Ne, ca, ta, na, la, bt, Oa, xt, we, Ee, Je, Y, J, Tt, _, $g, y, V, Dt, Et, ft, X, At, Ce, Ue, Fa, De, Oe, ne, B, St, Ct, G, Nt, _e, ge, Mt, Ie, Ye, It, Ft, Re, D, Pt, Fn, re, ae, te, o_, U, _Component36, Gt, Xt, Ot, _Component20, _Component0, _Component115, _Component25, T, Bt, _Component22, Kt, _Component49, _Component117, Ke } from "./shared.js";
import * as Z from "react";
import * as Q from "react";
var c_ = Z.memo(({
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
  let d = t;
  let f = Z.useMemo(() => {
    return d.shots || [];
  }, [d.shots]);
  let p = Z.useMemo(() => {
    return d.assets || [];
  }, [d.assets]);
  let m = Z.useMemo(() => {
    return {
      character: p.filter(e => {
        return e.category === `character`;
      }),
      scene: p.filter(e => {
        return e.category === `scene`;
      }),
      prop: p.filter(e => {
        return e.category === `prop`;
      })
    };
  }, [p]);
  let h = m.character;
  let g = d.step || 1;
  let _ = f.length > 0;
  let [v, y] = Z.useState(d.story || ``);
  let [b, x] = Z.useState(false);
  let [S, C] = Z.useState(false);
  let w = !!d.loading || S;
  let [E, D] = Z.useState(false);
  let [O, k] = Z.useState(null);
  let [A, j] = Z.useState(null);
  let [M, N] = Z.useState(null);
  let [P, F] = Z.useState(null);
  let [I, ee] = Z.useState(null);
  let [L, R] = Z.useState(null);
  let [te, z] = Z.useState(false);
  let [ne, B] = Z.useState(new Set());
  let [re, V] = Z.useState(false);
  let ie = Z.useRef(null);
  let ae = Z.useRef(null);
  let [oe, H] = Z.useState(null);
  let [se, ce] = Z.useState(null);
  let [U, W] = Z.useState(false);
  // [新增·自研] em = 分镜字段双击弹窗编辑状态 {shotId, field, value}；null=关闭。解决 contentEditable 原地编辑崩溃（见 docs/38）
  let [em, ems] = Z.useState(null);
  let emRef = Z.useRef(null);
  let [le, G] = Z.useState(() => {
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
      localStorage.setItem(`script-box-view-${e}`, le);
    } catch {}
  }, [e, le]);
  let [ue, de] = Z.useState(0);
  let [pe, he] = Z.useState(0);
  let [ge, _e] = Z.useState(false);
  let ve = Math.max(1, Math.ceil(f.length / s_));
  let ye = Z.useMemo(() => {
    return f.slice(pe * s_, (pe + 1) * s_);
  }, [pe, f]);
  let be = Z.useMemo(() => {
    return new Set(o.filter(t => {
      return t.source === e && t.sourceHandle?.startsWith(`shot-`);
    }).map(e => {
      return e.sourceHandle;
    }));
  }, [o, e]);
  let xe = Z.useMemo(() => {
    return f.filter(e => {
      return be.has(`shot-${e.id}`);
    });
  }, [be, f]);
  let Se = Z.useMemo(() => {
    return xe.map(e => {
      return `shot-${e.id}`;
    }).join(`|`);
  }, [xe]);
  let Ce = xe.some(e => {
    return !ye.some(t => {
      return t.id === e.id;
    });
  });
  let [we, Te] = Z.useState(new Set());
  let Ee = e => {
    return Te(t => {
      let n = new Set(t);
      if (n.has(e)) {
        n.delete(e);
      } else {
        n.add(e);
      }
      return n;
    });
  };
  let [De, K] = Z.useState(new Set());
  let Oe = e => {
    return K(t => {
      let n = new Set(t);
      if (n.has(e)) {
        n.delete(e);
      } else {
        n.add(e);
      }
      return n;
    });
  };
  let [ke, Ae] = Z.useState([36, 92, 320, 90, 90, 30]);
  let [je, q] = Z.useState(false);
  let Me = Z.useRef(null);
  let [Ne, Pe] = Z.useState(() => {
    return xa().filter(e => {
      return e.enabled && e.category === `image`;
    });
  });
  Z.useEffect(() => {
    return Da(e => {
      Pe(e.filter(e => {
        return e.enabled && e.category === `image`;
      }));
    });
  }, []);
  Z.useEffect(() => {
    let e = e => {
      if (Me.current && !Me.current.contains(e.target)) {
        q(false);
      }
    };
    document.addEventListener(`mousedown`, e);
    return () => {
      return document.removeEventListener(`mousedown`, e);
    };
  }, []);
  let Fe = Z.useRef(null);
  let Ie = Z.useRef(null);
  let Le = Z.useRef(null);
  Z.useEffect(() => {
    he(e => {
      return Math.min(e, ve - 1);
    });
  }, [ve, f]);
  Z.useEffect(() => {
    if (le !== `single` || f.length === 0) {
      return;
    }
    let e = pe * s_;
    let t = Math.min(e + s_, f.length) - 1;
    if (ue < e || ue > t) {
      de(e);
    }
  }, [ue, pe, le, f.length]);
  Z.useEffect(() => {
    c(e);
  }, [Se, ue, e, pe, le, f.length, g, c]);
  Z.useEffect(() => {
    C(false);
  }, [S, e, d.shots, d.errorMsg, d.loading]);
  let [Re, ze] = Z.useState(0);
  Z.useEffect(() => {
    if (!w) {
      ze(0);
      return;
    }
    let e = Date.now();
    let t = setInterval(() => {
      return ze(Math.floor((Date.now() - e) / 1000));
    }, 1000);
    return () => {
      return clearInterval(t);
    };
  }, [w]);
  Z.useEffect(() => {
    if (!oe) {
      return;
    }
    let e = e => {
      if (e.key === `Escape`) {
        H(null);
      }
    };
    window.addEventListener(`keydown`, e);
    return () => {
      return window.removeEventListener(`keydown`, e);
    };
  }, [oe]);
  let Be = Z.useMemo(() => {
    return (d.textModel || ``).split(`
`).map(e => {
      return e.trim();
    }).filter(Boolean);
  }, [d.textModel]);
  let Ve = d.selectedModel || Be[0] || ``;
  Z.useEffect(() => {
    let e = e => {
      if (Le.current && !Le.current.contains(e.target)) {
        x(false);
      }
    };
    document.addEventListener(`mousedown`, e);
    return () => {
      return document.removeEventListener(`mousedown`, e);
    };
  }, []);
  let He = (t, n) => {
    r(e, {
      shots: f.map(e => {
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
  let J = (t, n) => {
    let i = p.find(e => {
      return e.id === t;
    });
    if (i && typeof n.name == `string` && n.name.trim() && n.name !== i.name) {
      let a = i.name;
      let o = n.name;
      let s = e => {
        return e && e.split(a).join(o);
      };
      r(e, {
        shots: f.map(e => {
          return {
            ...e,
            description: s(e.description),
            prompt: s(e.prompt),
            videoPrompt: s(e.videoPrompt),
            dialogue: s(e.dialogue)
          };
        }),
        assets: p.map(e => {
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
      assets: p.map(e => {
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
  let Y = p.find(e => {
    return e.id === O;
  }) || null;
  let Ue = () => {
    let t = f.length > 0 ? Math.max(...f.map(e => {
      return e.index;
    })) + 1 : 1;
    r(e, {
      shots: [...f, {
        id: `${e}-shot-${Date.now()}`,
        index: t,
        duration: `5s`,
        description: ``
      }]
    });
  };
  let Ge = t => {
    r(e, {
      shots: f.filter(e => {
        return e.id !== t;
      })
    });
    i(n => {
      return n.filter(n => {
        return n.source !== e || n.sourceHandle !== `shot-${t}`;
      });
    });
  };
  let qe = t => {
    t?.stopPropagation();
    if (!!v.trim() && !S) {
      C(true);
      r(e, {
        story: v,
        errorMsg: undefined,
        scriptProgressChars: 0,
        loading: true
      });
      d.onGenerateScript?.(e, v, Ve);
    }
  };
  let Je = e => {
    Fe.current = e;
    W(true);
  };
  let Ye = t => {
    let n = t.target.files?.[0];
    let i = Fe.current;
    if (!n || !i) {
      return;
    }
    let a = new FileReader();
    a.onload = () => {
      return r(e, {
        assets: p.map(e => {
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
  let Xe = (e, t) => {
    R(n => {
      if (n?.shotId === e && n.field === t) {
        return null;
      } else {
        return {
          shotId: e,
          field: t
        };
      }
    });
    j(null);
    F(null);
    ee(null);
  };
  let Ze = e => {
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
  let Qe = e => {
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
  let $e = (e, t) => {
    if (L?.shotId !== e.id || L.field !== t) {
      return null;
    }
    let n = e[t] || ``;
    const Component2406 = `div`;
    const Component2407 = `button`;
    const Component2408 = `div`;
    const Component2409 = `input`;
    const Component2410 = `textarea`;
    const Component2411 = `button`;
    const Component2412 = `div`;
    const Component2413 = `div`;
    const Component2414 = `button`;
    const Component2415 = `div`;
    const Component2416 = `div`;
    return <Component2416 className={`absolute z-50 top-full ${E && (t === `motion` || t === `sound`) ? `right-0` : `left-0`} mt-1 w-56 rounded-lg border border-[#3a3a3a] bg-[#202020] p-2 shadow-xl nowheel nopan nodrag space-y-2`} onWheel={e => {
      return e.stopPropagation();
    }} onClick={e => {
      return e.stopPropagation();
    }}>
        <Component2406 className={`text-[10px] text-gray-400`}>{Ze(t)}</Component2406>
        {t === `duration` && <Component2408 className={`flex flex-wrap gap-1`}>
            {t_.map(t => {
          return <Component2407 className={`px-2 py-1 rounded text-[11px] nodrag ${n === t ? `bg-gray-100 text-gray-950` : `bg-[#2a2a2a] text-gray-300 hover:bg-[#333]`}`} onClick={() => {
            return He(e.id, {
              duration: t
            });
          }} key={t}>
                  {t}
                </Component2407>;
        })}
          </Component2408>}
        {t === `duration` ? <Component2409 autoFocus={true} value={n} onChange={t => {
        return He(e.id, {
          duration: t.target.value
        });
      }} placeholder={Qe(t)} className={`w-full rounded bg-[#262626] border border-[#3a3a3a] px-2 py-1.5 text-[11px] text-gray-200 outline-none`} /> : <Component2410 autoFocus={true} rows={3} value={n} onChange={n => {
        return He(e.id, {
          [t]: n.target.value
        });
      }} placeholder={Qe(t)} className={`w-full rounded bg-[#262626] border border-[#3a3a3a] px-2 py-1.5 text-[11px] text-gray-200 outline-none resize-none`} />}
        {t === `motion` && <Component2413 className={`flex flex-wrap gap-1`}>
            {n_.map(t => {
          return <Component2411 className={`px-2 py-1 rounded text-[11px] bg-[#2a2a2a] text-gray-300 hover:bg-[#333] nodrag border border-[#3a3a3a]`} onClick={() => {
            let r = n ? `${n}，${t}` : t;
            He(e.id, {
              motion: r
            });
          }} key={t}>
                  {t}
                </Component2411>;
        })}
            <Component2412 className={`w-full mt-1 text-[10px] text-gray-500`}>{`点击预设直接填入`}</Component2412>
          </Component2413>}
        <Component2415 className={`flex justify-end mt-1`}>
          <Component2414 className={`px-3 py-1.5 rounded-lg bg-gray-100 text-gray-950 font-medium text-[11px] hover:bg-white transition-colors`} onClick={() => {
          return R(null);
        }}>{`保存`}</Component2414>
        </Component2415>
      </Component2416>;
  };
  let et = (e, t, n = `description`) => {
    let r = e[n] || ``;
    let i = r.endsWith(`@`) ? `${r}${t} ` : r ? `${r} @${t} ` : `@${t} `;
    He(e.id, {
      [n]: i
    });
    j(null);
    N(null);
  };
  let tt = (e, t) => {
    let n = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
    let r = t;
    let i = n.nextNode();
    while (i) {
      let e = i.textContent?.length || 0;
      if (r <= e) {
        let e = document.createRange();
        e.setStart(i, r);
        e.collapse(true);
        let t = window.getSelection();
        t?.removeAllRanges();
        t?.addRange(e);
        return;
      }
      r -= e;
      i = n.nextNode();
    }
  };
  let nt = (e, t, n) => {
    let r = e.currentTarget;
    let i = r.innerText || ``;
    let a = window.getSelection();
    let o = i.length;
    let s = i.length;
    if (a && a.rangeCount > 0 && r.contains(a.anchorNode)) {
      let e = a.getRangeAt(0);
      let t = e.cloneRange();
      t.selectNodeContents(r);
      t.setEnd(e.startContainer, e.startOffset);
      o = t.toString().length;
      s = o + e.toString().length;
    }
    if (o === s) {
      if (e.key === `Backspace` || e.key === `Delete`) {
        let a = go(i, p.map(e => {
          return e.name;
        }), o, e.key);
        if (a) {
          e.preventDefault();
          r.innerText = a.text;
          He(t.id, {
            [n]: a.text
          });
          setTimeout(() => {
            return tt(r, a.cursor);
          }, 0);
          return;
        }
      }
      if (e.key === ` ` || e.key === `Enter`) {
        let a = _o(i, o, i.lastIndexOf(`@`, o - 1), p.map(e => {
          return e.name;
        }));
        if (a) {
          e.preventDefault();
          r.innerText = a.text;
          He(t.id, {
            [n]: a.text
          });
          setTimeout(() => {
            return tt(r, a.cursor);
          }, 0);
        }
      }
    }
  };
  let rt = (e, t, n, r) => {
    let i = e[t] || ``;
    const Component2417 = `div`;
    const Component2424 = `div`;
    // [改造·自研] 原为 contentEditable 原地编辑，每按键 updateNodeData 触发全组件重渲染 + React 重排编辑中 DOM → 崩溃白屏（见 docs/38）。
    // 现改为只读展示 + 双击打开弹窗编辑（em/ems），保存时才写回，彻底避开 contentEditable 双源冲突。
    return <Component2424 className={`relative group w-full h-full flex flex-col`} onDoubleClick={ev => {
        ev.stopPropagation();
        // [修复·自研] 回调参数改名 ev，避免遮蔽外层 shot 对象 e；原写 e.id 拿到的是事件对象的 id=undefined → 保存时 He(undefined) 匹配不到 shot 不写回（见 daily/2026-08-11）
        ems({
          shotId: e.id,
          field: t,
          value: i
        });
      }}>
        <Component2417 role={`button`} title={`双击编辑`} data-placeholder={r} className={`${n} whitespace-pre-wrap break-words cursor-text empty:before:content-[attr(data-placeholder)] empty:before:text-gray-600`}>
          {i ? _cmp_a_(i, p) : null}
        </Component2417>
      </Component2424>;
  };
  let at = e => {
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
  let ot = e => {
    return e.map(e => {
      return `[${e.kind}|${e.role}] ${e.text}`;
    }).join(`
`);
  };
  let lt = ke.map((e, t) => {
    if (t === 2) {
      return `minmax(160px,${e}px)`;
    } else {
      return `${e}px`;
    }
  }).join(` `);
  let ut = (e, t) => {
    t.preventDefault();
    t.stopPropagation();
    let n = t.clientX;
    let r = ke[e];
    let i = t => {
      let i = [...ke];
      i[e] = Math.max(28, r + (t.clientX - n));
      Ae(i);
    };
    let a = () => {
      window.removeEventListener(`mousemove`, i);
      window.removeEventListener(`mouseup`, a);
    };
    window.addEventListener(`mousemove`, i);
    window.addEventListener(`mouseup`, a);
  };
  const Component2425 = `div`;
  let _Component116 = ({
    idx: e
  }) => {
    return <Component2425 className={`absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-white/30 nodrag`} onMouseDown={t => {
      return ut(e, t);
    }} />;
  };
  const Component2426 = `div`;
  const Component2427 = `input`;
  const Component2428 = `span`;
  const Component2429 = `div`;
  const Component2430 = `div`;
  const Component2431 = `span`;
  const Component2432 = `button`;
  const Component2433 = `div`;
  const Component2434 = `div`;
  const Component2435 = `div`;
  const Component2436 = `span`;
  const Component2437 = `button`;
  const Component2438 = `div`;
  const Component2439 = `span`;
  const Component2440 = `span`;
  const Component2441 = `span`;
  const Component2442 = `span`;
  const Component2443 = `div`;
  const Component2444 = `span`;
  const Component2445 = `button`;
  const Component2457 = `button`;
  const Component2458 = `div`;
  const Component2459 = `div`;
  const Component2460 = `div`;
  const Component2461 = `span`;
  const Component2462 = `button`;
  const Component2463 = `div`;
  const Component2464 = `span`;
  const Component2465 = `button`;
  const Component2466 = `div`;
  const Component2467 = `button`;
  const Component2468 = `div`;
  const Component2469 = `div`;
  const Component2470 = `div`;
  let ft = (e, t) => {
    return <Component2470 className={`relative border-t border-[#2a2a2a] hover:bg-[#202020] min-h-[88px]`} key={e.id}>
        <Component2469 className={`grid ${t ? `grid-cols-[44px_92px_minmax(220px,1.6fr)_96px_120px_150px_110px_96px_34px]` : ``} items-stretch min-h-[88px]`} style={t ? undefined : {
        gridTemplateColumns: lt
      }}>
          <Component2426 className={`px-2 py-5 text-sm text-white flex items-center`}>
            {e.index}
          </Component2426>
          <Component2429 className={`relative flex items-center gap-1 px-1.5 py-4`}>
            <Component2427 type={`number`} min={1} max={60} step={1} value={Math.max(1, Number.parseInt(e.duration || `5`, 10) || 5)} onChange={t => {
            return He(e.id, {
              duration: `${Math.max(1, Number(t.target.value) || 1)}s`
            });
          }} className={`min-w-0 flex-1 rounded bg-[#242424] py-1 pl-2 pr-1 text-[11px] text-gray-300 outline-none [color-scheme:dark] hover:bg-[#2a2a2a] focus:bg-[#2a2a2a] nodrag`} />
            <Component2428 className={`shrink-0 text-[10px] text-gray-500`}>{`秒`}</Component2428>
          </Component2429>
          <Component2430 className={`relative`}>
            {rt(e, `description`, `w-full h-full bg-transparent text-xs text-gray-300 outline-none resize-none px-2 py-5 leading-relaxed focus:bg-[#262626] rounded min-h-[72px] overflow-hidden`, `画面描述，输入 @ 引用资产`)}
          </Component2430>
          <Component2435 className={`relative`}>
            <Component2432 className={`w-full h-full bg-transparent text-xs text-gray-300 outline-none resize-none px-2 py-5 leading-relaxed focus:bg-[#262626] rounded nodrag text-left flex items-center justify-between`} onClick={t => {
            t.stopPropagation();
            F(P === e.id ? null : e.id);
            j(null);
            ee(null);
            R(null);
          }}>
              <Component2431 className={e.shotType ? `text-gray-300` : `text-gray-600`}>
                {e.shotType || `景别`}
              </Component2431>
              <_Component36 size={10} className={`text-gray-500 shrink-0`} />
            </Component2432>
            {P === e.id && <Component2434 className={`absolute z-50 top-full left-0 mt-1 w-28 max-h-52 overflow-y-auto rounded-lg border border-[#3a3a3a] bg-[#202020] p-1 shadow-xl nowheel nopan nodrag`} onWheel={e => {
            return e.stopPropagation();
          }} onClick={e => {
            return e.stopPropagation();
          }}>
                {e_.map(t => {
              return <Component2433 role={`button`} className={`px-2 py-1.5 rounded text-[11px] cursor-pointer ${e.shotType === t ? `bg-[#333] text-white` : `text-gray-300 hover:bg-[#2a2a2a]`}`} onClick={() => {
                He(e.id, {
                  shotType: t
                });
                F(null);
              }} key={t}>
                      {t}
                    </Component2433>;
            })}
              </Component2434>}
          </Component2435>
          {t && <Component2438 className={`relative`}>
              <Component2437 className={`w-full h-full bg-transparent text-xs text-gray-300 outline-none resize-none px-2 py-5 leading-relaxed focus:bg-[#262626] rounded nodrag text-left truncate`} onClick={t => {
            t.stopPropagation();
            Xe(e.id, `lighting`);
          }}>
                <Component2436 className={e.lighting ? `text-gray-300` : `text-gray-600`}>
                  {e.lighting || `光影氛围`}
                </Component2436>
              </Component2437>
              {$e(e, `lighting`)}
            </Component2438>}
          {t && <Component2460 className={`relative`}>
              <Component2445 className={`w-full h-full bg-transparent text-xs text-gray-300 outline-none resize-none px-2 py-5 leading-relaxed focus:bg-[#262626] rounded nodrag text-left truncate`} onClick={t => {
            t.stopPropagation();
            ee(I === e.id ? null : e.id);
            j(null);
            F(null);
            R(null);
          }}>
                {e.dialogue ? <Component2443 className={`flex flex-col gap-1`}>
                    {at(e.dialogue).map((e, t) => {
                return <Component2442 className={`text-gray-300 truncate text-[10px]`} key={t}>
                          {e.kind === `旁白` ? <Component2439 className={`text-gray-200`}>
                              {`[旁白] `}
                              {e.text}
                            </Component2439> : <Component2441>
                              <Component2440 className={`text-cyan-400`}>
                                {e.role || `未知角色`}
                              </Component2440>
                              {`: `}
                              {e.text}
                            </Component2441>}
                        </Component2442>;
              })}
                  </Component2443> : <Component2444 className={`text-gray-600`}>{`对白/旁白`}</Component2444>}
              </Component2445>
              {I === e.id && <Component2459 className={`absolute z-50 top-full left-0 mt-1 w-[360px] rounded-lg border border-[#3a3a3a] bg-[#202020] p-3 shadow-xl nowheel nopan nodrag space-y-2`} onWheel={e => {
            return e.stopPropagation();
          }} onClick={e => {
            return e.stopPropagation();
          }}>
                  {(() => {
              let t = at(e.dialogue);
              const Component2446 = `button`;
              const Component2447 = `option`;
              const Component2448 = `option`;
              const Component2449 = `select`;
              const Component2450 = `textarea`;
              const Component2451 = `button`;
              const Component2452 = `div`;
              const Component2453 = `button`;
              const Component2454 = `button`;
              const Component2455 = `div`;
              const Component2456 = `div`;
              return <Component2456 className={`space-y-2`}>
                        {t.map((n, r) => {
                  return <Component2452 className={`flex items-center gap-2`} key={r}>
                              <Component2446 type={`button`} className={`w-[52px] shrink-0 rounded border border-transparent px-1 py-1 text-[10px] outline-none nodrag ${n.kind === `旁白` ? `bg-purple-500/20 text-purple-300` : `bg-cyan-500/20 text-cyan-400`}`} onClick={() => {
                      let i = [...t];
                      let a = n.kind === `旁白` ? `台词` : `旁白`;
                      i[r] = {
                        ...i[r],
                        kind: a,
                        role: a === `旁白` ? `` : i[r].role
                      };
                      He(e.id, {
                        dialogue: ot(i)
                      });
                    }}>
                                {n.kind}
                              </Component2446>
                              {n.kind === `台词` && <Component2449 value={n.role} onChange={n => {
                      let i = [...t];
                      i[r] = {
                        ...i[r],
                        role: n.target.value
                      };
                      He(e.id, {
                        dialogue: ot(i)
                      });
                    }} className={`w-[48px] rounded bg-[#1a1a1a] border border-[#3a3a3a] px-0.5 py-0.5 text-[10px] text-gray-200 outline-none nodrag text-center`}>
                                  <Component2447 value={``}>{`角色`}</Component2447>
                                  {h.map(e => {
                        return <Component2448 value={e.name} key={e.id}>
                                        {e.name}
                                      </Component2448>;
                      })}
                                </Component2449>}
                              <Component2450 rows={1} value={n.text} onChange={n => {
                      let i = [...t];
                      i[r] = {
                        ...i[r],
                        text: n.target.value
                      };
                      He(e.id, {
                        dialogue: ot(i)
                      });
                    }} placeholder={n.kind === `旁白` ? `旁白内容` : `台词内容`} className={`flex-1 rounded bg-[#1a1a1a] border border-[#3a3a3a] px-2 py-1.5 text-[11px] text-gray-200 outline-none resize-none min-h-[28px] nodrag`} />
                              <Component2451 className={`p-1 text-gray-500 hover:text-red-400 shrink-0 nodrag mt-0.5`} onClick={() => {
                      let n = [...t];
                      n.splice(r, 1);
                      He(e.id, {
                        dialogue: ot(n)
                      });
                    }}>
                                <Gt size={12} />
                              </Component2451>
                            </Component2452>;
                })}
                        <Component2455 className={`flex items-center gap-2 pt-1`}>
                          <Component2453 className={`px-2 py-1 rounded bg-[#2a2a2a] text-gray-300 hover:bg-[#333] text-[10px] flex items-center gap-1 nodrag`} onClick={() => {
                    return He(e.id, {
                      dialogue: ot([{
                        kind: `台词`,
                        role: ``,
                        text: ``
                      }, ...t])
                    });
                  }}>
                            <Xt size={10} />
                            {` 台词`}
                          </Component2453>
                          <Component2454 className={`px-2 py-1 rounded bg-[#2a2a2a] text-gray-300 hover:bg-[#333] text-[10px] flex items-center gap-1 nodrag`} onClick={() => {
                    return He(e.id, {
                      dialogue: ot([{
                        kind: `旁白`,
                        role: ``,
                        text: ``
                      }, ...t])
                    });
                  }}>
                            <Xt size={10} />
                            {` 旁白`}
                          </Component2454>
                        </Component2455>
                      </Component2456>;
            })()}
                  <Component2458 className={`flex justify-end pt-1`}>
                    <Component2457 className={`px-3 py-1.5 rounded-lg bg-gray-100 text-gray-950 font-medium text-[11px] hover:bg-white transition-colors`} onClick={() => {
                return ee(null);
              }}>{`保存`}</Component2457>
                  </Component2458>
                </Component2459>}
            </Component2460>}
          {t && <Component2463 className={`relative`}>
              <Component2462 className={`w-full h-full bg-transparent text-xs text-gray-300 outline-none resize-none px-2 py-5 leading-relaxed focus:bg-[#262626] rounded nodrag text-left truncate`} onClick={t => {
            t.stopPropagation();
            Xe(e.id, `sound`);
          }}>
                <Component2461 className={e.sound ? `text-gray-300` : `text-gray-600`}>
                  {e.sound || `音效`}
                </Component2461>
              </Component2462>
              {$e(e, `sound`)}
            </Component2463>}
          <Component2466 className={`relative`}>
            <Component2465 className={`w-full h-full bg-transparent text-xs text-gray-300 outline-none resize-none px-2 py-5 leading-relaxed focus:bg-[#262626] rounded nodrag text-left truncate`} onClick={t => {
            t.stopPropagation();
            Xe(e.id, `motion`);
          }}>
              <Component2464 className={e.motion ? `text-gray-300` : `text-gray-600`}>
                {e.motion || `运镜`}
              </Component2464>
            </Component2465>
            {$e(e, `motion`)}
          </Component2466>
          <Component2468 className={`px-1 py-5 flex items-center justify-center`}>
            <Component2467 className={`p-1 text-gray-500 hover:text-red-400 nodrag`} onClick={t => {
            t.stopPropagation();
            Ge(e.id);
          }}>
              <Ot size={12} />
            </Component2467>
          </Component2468>
        </Component2469>
      </Component2470>;
  };
  let pt = Z.useMemo(() => {
    return (d.drawingModelForScript || ``).split(`
`).map(e => {
      return e.trim();
    }).filter(Boolean);
  }, [d.drawingModelForScript]);
  let mt = d.assetModelSettings || {};
  let ht = t => {
    return r(e, {
      assetModelSettings: {
        ...mt,
        ...t
      }
    });
  };
  let gt = mt.globalModel || ``;
  let _t = ka(gt);
  let vt = _t ? Ne.find(e => {
    return e.id === _t;
  }) : null;
  let yt = vt ? `` : gt || pt[0] || ``;
  let bt = yt && ca(yt) ? ta(yt) : null;
  let xt = () => {
    let e = pt;
    let t = e.filter(e => {
      return ca(e);
    }).sort((e, t) => {
      return e.localeCompare(t);
    });
    let n = e.filter(e => {
      return !ca(e);
    }).sort((e, t) => {
      return e.localeCompare(t);
    });
    let r = e => {
      ht({
        globalModel: e
      });
      q(false);
    };
    let i = (e, t) => {
      let n = t ? ta(e) : null;
      let i = t ? na(e) : null;
      const Component2471 = `span`;
      const Component2472 = `span`;
      const Component2473 = `span`;
      const Component2474 = `div`;
      return <Component2474 role={`button`} className={`w-full flex items-center gap-1.5 mb-1 last:mb-0 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors cursor-pointer ${gt === e ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} onClick={() => {
        return r(e);
      }} title={e} key={`${t ? `b` : `o`}-${e}`}>
          <Component2471 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${t ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
            {t ? `内置` : `三方`}
          </Component2471>
          <Component2472 className={`flex-1 whitespace-nowrap`}>{e}</Component2472>
          {n !== null && <Component2473 className={`shrink-0 inline-flex items-center gap-0.5 text-[10px] text-orange-400 tabular-nums`}>
              <_Component20 className={`w-2.5 h-2.5`} strokeWidth={2.5} />
              {la(n)}
              {i ? `/${i}` : ``}
            </Component2473>}
        </Component2474>;
    };
    const Component2475 = `span`;
    const Component2476 = `span`;
    const Component2477 = `span`;
    const Component2478 = `span`;
    const Component2479 = `button`;
    const Component2480 = `span`;
    const Component2481 = `span`;
    const Component2482 = `div`;
    const Component2487 = `div`;
    const Component2488 = `span`;
    const Component2489 = `span`;
    const Component2490 = `span`;
    const Component2491 = `div`;
    const Component2492 = `div`;
    const Component2493 = `div`;
    const Component2494 = `div`;
    const Component2495 = `div`;
    const Component2496 = `div`;
    return <Component2496 className={`relative nodrag flex items-center`} ref={Me} onClick={e => {
      return e.stopPropagation();
    }}>
        <Component2479 className={`flex items-center gap-1 h-7 px-2 bg-[#262626] hover:bg-[#2a2a2a] border border-[#3a3a3a] hover:border-[#555] rounded-lg text-[11px] text-gray-300 transition-colors cursor-pointer max-w-[200px]`} onClick={e => {
        e.stopPropagation();
        q(e => {
          return !e;
        });
      }} title={vt ? `调度：${vt.name}` : yt || `选择模型`}>
          {vt ? <Component2475 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border bg-blue-500/20 text-blue-200 border-blue-400/40`}>{`调度`}</Component2475> : yt && <Component2476 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${ca(yt) ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                {ca(yt) ? `内置` : `三方`}
              </Component2476>}
          <Component2477 className={`whitespace-nowrap truncate`}>
            {vt ? vt.name : yt || `选择模型`}
          </Component2477>
          {bt !== null && <Component2478 className={`shrink-0 inline-flex items-center gap-0.5 text-[10px] text-orange-400 tabular-nums`}>
              <_Component20 className={`w-2.5 h-2.5`} strokeWidth={2.5} />
              {la(bt)}
              {na(yt) ? `/${na(yt)}` : ``}
            </Component2478>}
          <_Component36 size={12} />
        </Component2479>
        {je && <Component2495 className={`absolute bottom-full right-0 mb-1 min-w-[17rem] w-max max-w-[29rem] bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 max-h-72 overflow-y-auto custom-scrollbar nowheel nopan nodrag`} onClick={e => {
        return e.stopPropagation();
      }} onWheel={e => {
        return e.stopPropagation();
      }}>
            {Ne.length > 0 && <Q.Fragment>
                <Component2482 className={`text-[10px] text-blue-300 mb-1 px-1 flex items-center justify-between`}>
                  <Component2480 className={`flex items-center gap-1`}>
                    <_Component20 className={`w-2.5 h-2.5`} strokeWidth={2.5} />
                    {`模型调度`}
                  </Component2480>
                  <Component2481 className={`ml-auto text-white/90 hover:text-white cursor-pointer`} onClick={e => {
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent(`mutiwindow-open-schedule-settings`));
            }}>{`配置 ›`}</Component2481>
                </Component2482>
                {Ne.map(e => {
            let t = Oa(e.id);
            const Component2483 = `span`;
            const Component2484 = `span`;
            const Component2485 = `span`;
            const Component2486 = `div`;
            return <Component2486 role={`button`} className={`w-full flex items-center gap-1.5 mb-1 last:mb-0 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors cursor-pointer ${gt === t ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} onClick={() => {
              return r(t);
            }} title={`${e.name}（${e.steps.length} 个模型按序重试）`} key={e.id}>
                      <Component2483 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border bg-blue-500/20 text-blue-200 border-blue-400/40`}>{`调度`}</Component2483>
                      <Component2484 className={`flex-1 whitespace-nowrap`}>{e.name}</Component2484>
                      <Component2485 className={`shrink-0 text-[10px] text-gray-500`}>
                        {e.steps.length}
                        {` 模型`}
                      </Component2485>
                    </Component2486>;
          })}
                {(t.length > 0 || n.length > 0) && <Component2487 className={`h-px bg-[#333] my-1.5`} />}
              </Q.Fragment>}
            {t.length > 0 && <Q.Fragment>
                <Component2491 className={`text-[10px] text-blue-300 mb-1 px-1 flex items-center gap-1`}>
                  <Component2488>{`✨`}</Component2488>
                  <Component2489>{`内置模型`}</Component2489>
                  <Component2490 className={`ml-auto text-white/90 hover:text-white cursor-pointer whitespace-nowrap`} onClick={e => {
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent(`mutiwindow-open-builtin-settings`));
              q(false);
            }} title={`查看内置模型详情`}>{`详情 ›`}</Component2490>
                </Component2491>
                {t.map(e => {
            return i(e, true);
          })}
              </Q.Fragment>}
            {n.length > 0 && <Q.Fragment>
                {t.length > 0 && <Component2492 className={`h-px bg-[#333] my-1.5`} />}
                <Component2493 className={`text-[10px] text-gray-500 mb-1 px-1`}>{`第三方模型`}</Component2493>
                {n.map(e => {
            return i(e, false);
          })}
              </Q.Fragment>}
            {e.length === 0 && Ne.length === 0 && <Component2494 className={`px-2 py-2 text-[11px] text-gray-600`}>{`请先在设置中配置生图模型`}</Component2494>}
          </Component2495>}
      </Component2496>;
  };
  let St = (t = false) => {
    let n = t ? `grid-cols-8` : `grid-cols-5`;
    const Component2497 = `button`;
    const Component2498 = `button`;
    const Component2499 = `div`;
    const Component2500 = `div`;
    const Component2501 = `div`;
    const Component2502 = `input`;
    const Component2503 = `div`;
    const Component2504 = `div`;
    const Component2505 = `img`;
    const Component2506 = `div`;
    const Component2507 = `div`;
    const Component2508 = `div`;
    const Component2509 = `div`;
    const Component2510 = `div`;
    const Component2511 = `div`;
    const Component2512 = `span`;
    const Component2513 = `button`;
    const Component2514 = `span`;
    const Component2515 = `button`;
    const Component2516 = `span`;
    const Component2517 = `button`;
    const Component2518 = `button`;
    const Component2519 = `button`;
    const Component2520 = `button`;
    const Component2521 = `button`;
    const Component2522 = `div`;
    const Component2523 = `div`;
    const Component2524 = `div`;
    const Component2525 = `div`;
    const Component2526 = `div`;
    const Component2527 = `div`;
    const Component2528 = `div`;
    const Component2529 = `span`;
    const Component2530 = `div`;
    const Component2531 = `div`;
    const Component2532 = `div`;
    const Component2533 = `div`;
    return <Component2533>
        <Component2500 className={`flex items-center justify-end mb-2 gap-2`}>
          <Component2499 className={`flex items-center gap-2`}>
            {xt()}
            <Component2497 className={`inline-flex items-center gap-1 rounded-lg bg-[#2a2a2a] px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-[#333] nodrag nopan shrink-0`} title={`上传全部已生成图片资产到视频网关`} onClick={t => {
            t.stopPropagation();
            d.onUploadAllVideoAssets?.(e);
          }}>
              <_Component0 size={12} />
              {` 上传全部素材`}
            </Component2497>
            <Component2498 className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-950 text-xs font-medium hover:bg-white nodrag nopan shrink-0`} title={we.size > 0 ? `生成勾选的 ${we.size} 项` : `生成全部空缺项`} onClick={t => {
            t.stopPropagation();
            let n = p.filter(e => {
              return we.has(e.id);
            }).map(e => {
              return e.id;
            });
            d.onGenerateAllAssetImages?.(e, n.length > 0 ? n : undefined);
          }}>
              <_Component115 size={12} />
              {` 批量生成`}
              {we.size > 0 ? `（${we.size}）` : ``}
            </Component2498>
          </Component2499>
        </Component2500>
        <Component2503 className={`mb-3`}>
          <Component2501 className={`text-[11px] text-gray-500 mb-1`}>{`统一风格说明`}</Component2501>
          <Component2502 value={d.globalStyle || ``} onChange={t => {
          return r(e, {
            globalStyle: t.target.value
          });
        }} placeholder={`例如：中世纪童话·皮克斯3D`} className={`w-full rounded-lg bg-[#242424] border border-transparent focus:border-gray-500 px-2.5 py-2 text-xs text-gray-200 outline-none nodrag transition-colors`} />
        </Component2503>
        {[`character`, `scene`, `prop`].map(t => {
        return <Component2532 className={`mb-5`} key={t}>
              <Component2504 className={`text-[11px] font-medium text-gray-300 mb-2`}>
                {r_[t]}
              </Component2504>
              <Component2531 className={`grid ${n} gap-1.5`}>
                {m[t].map(t => {
              return <Component2528 className={`rounded-lg border bg-[#212121] overflow-hidden transition-colors ${we.has(t.id) ? `border-gray-300` : `border-transparent hover:border-[#3a3a3a]`}`} key={t.id}>
                      <Component2524 className={`aspect-square bg-[#1a1a1a] relative flex items-center justify-center cursor-pointer nodrag overflow-hidden`} onClick={() => {
                  return k(t.id);
                }} onDoubleClick={e => {
                  e.stopPropagation();
                  if (t.imageUrl) {
                    H(t.imageUrl);
                  }
                }} title={`单击编辑提示词 · 双击放大查看`}>
                        {t.imageUrl ? <Q.Fragment>
                            <Component2505 src={t.thumbnailUrl || t.imageUrl} alt={t.name} loading={`lazy`} decoding={`async`} className={`w-full h-full object-cover ${t.loading ? `opacity-55` : ``}`} onError={e => {
                      let n = e.currentTarget;
                      let r = d.videoUploadedAssets?.[t.imageUrl || ``] || t.imageUrl;
                      if (r && n.src !== r) {
                        n.src = r;
                      }
                    }} />
                            {t.loading && <Component2509 className={`absolute inset-0 pointer-events-none overflow-hidden`}>
                                <Component2506 className={`absolute inset-0 bg-black/25`} />
                                <Component2507 className={`absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer`} />
                                <Component2508 className={`absolute inset-0 flex items-center justify-center`}>
                                  <_Component25 size={16} className={`animate-spin text-white drop-shadow`} />
                                </Component2508>
                              </Component2509>}
                          </Q.Fragment> : t.loading ? <Component2511 className={`absolute inset-0 flex items-center justify-center overflow-hidden`}>
                            <Component2510 className={`absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer`} />
                            <_Component25 size={14} className={`animate-spin text-gray-400 relative z-10`} />
                          </Component2511> : <Component2512 className={`text-[9px] text-gray-600 px-1 text-center`}>{`点击编辑`}</Component2512>}
                        <Component2513 className={`absolute top-1 left-1 w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] border ${we.has(t.id) ? `bg-white border-white text-black` : `bg-black/50 border-white/40 text-transparent`}`} title={`勾选以批量生成`} onClick={e => {
                    e.stopPropagation();
                    Ee(t.id);
                  }}>{`✓`}</Component2513>
                        <Component2523 className={`absolute top-1 right-1`}>
                          {d.videoAssetUploadStatus?.[t.imageUrl || ``] === `uploading` && <Component2514 className={`flex items-center gap-1 rounded bg-black/70 px-1.5 py-1 text-[9px] text-gray-200`}>
                              <_Component25 size={10} className={`animate-spin`} />
                              {`上传中`}
                            </Component2514>}
                          {d.videoAssetUploadStatus?.[t.imageUrl || ``] === `failed` && <Component2515 className={`rounded bg-red-500/80 px-1.5 py-1 text-[9px] text-white hover:bg-red-500`} title={d.videoAssetUploadErrors?.[t.imageUrl || ``] || `上传失败`} onClick={n => {
                      n.stopPropagation();
                      d.onRetryVideoAssetUpload?.(e, t.id);
                    }}>{`重试上传`}</Component2515>}
                          {d.videoAssetUploadStatus?.[t.imageUrl || ``] === `uploaded` && <Component2516 className={`rounded bg-emerald-600/80 px-1.5 py-1 text-[9px] text-white`}>{`已上传`}</Component2516>}
                          {t.loading ? <Component2517 className={`p-1 rounded bg-red-500/70 text-white hover:bg-red-500`} title={`取消生成`} onClick={n => {
                      n.stopPropagation();
                      d.onStopScriptItem?.(e, `asset`, t.id);
                    }}>
                              <T size={11} fill={`currentColor`} />
                            </Component2517> : <Q.Fragment>
                              <Component2518 className={`p-1 rounded bg-black/60 text-gray-200 hover:text-white`} title={`更多操作`} onClick={e => {
                        e.stopPropagation();
                        ce(se === t.id ? null : t.id);
                      }}>
                                <Bt size={12} />
                              </Component2518>
                              {se === t.id && <Component2522 className={`absolute right-0 top-full z-50 mt-1 w-28 rounded-lg border border-[#3a3a3a] bg-[#202020] p-1 shadow-xl`} onClick={e => {
                        return e.stopPropagation();
                      }}>
                                  <Component2519 className={`w-full rounded px-2 py-1.5 text-left text-[10px] text-gray-300 hover:bg-[#2a2a2a]`} onClick={() => {
                          d.onGenerateAssetImage?.(e, t.id);
                          ce(null);
                        }}>{`重新生成`}</Component2519>
                                  <Component2520 className={`w-full rounded px-2 py-1.5 text-left text-[10px] text-gray-300 hover:bg-[#2a2a2a]`} onClick={() => {
                          Je(t.id);
                          ce(null);
                        }}>{`上传`}</Component2520>
                                  <Component2521 className={`w-full rounded px-2 py-1.5 text-left text-[10px] text-red-400 hover:bg-red-500/10`} onClick={() => {
                          r(e, {
                            assets: p.filter(e => {
                              return e.id !== t.id;
                            })
                          });
                          Te(e => {
                            let n = new Set(e);
                            n.delete(t.id);
                            return n;
                          });
                          if (O === t.id) {
                            k(null);
                          }
                          ce(null);
                        }}>{`删除`}</Component2521>
                                </Component2522>}
                            </Q.Fragment>}
                        </Component2523>
                      </Component2524>
                      <Component2527 className={`px-1.5 py-1`}>
                        <Component2525 className={`text-[10px] font-medium text-gray-100 truncate`}>
                          {t.name}
                        </Component2525>
                        <Component2526 className={`mt-0.5 text-[9px] leading-relaxed text-gray-500 truncate`}>
                          {t.description}
                        </Component2526>
                      </Component2527>
                    </Component2528>;
            })}
                <Component2530 className={`rounded-lg border border-dashed border-[#3a3a3a] bg-transparent hover:bg-[#202020] hover:border-gray-500 cursor-pointer flex flex-col items-center justify-center transition-colors nodrag min-h-[120px]`} onClick={() => {
              let n = {
                id: `asset-${Date.now()}`,
                category: t,
                name: `新${r_[t]}`
              };
              r(e, {
                assets: [...p, n]
              });
              k(n.id);
            }}>
                  <Xt size={16} className={`text-gray-500 mb-1`} />
                  <Component2529 className={`text-[10px] text-gray-500`}>
                    {`新增`}
                    {r_[t]}
                  </Component2529>
                </Component2530>
              </Component2531>
            </Component2532>;
      })}
      </Component2533>;
  };
  let Ct = (t = false) => {
    if (!Y) {
      return null;
    }
    let n = t ? 220 : 240;
    let r = t ? 80 : 96;
    const Component2534 = `div`;
    const Component2535 = `button`;
    const Component2536 = `div`;
    const Component2537 = `img`;
    const Component2538 = `div`;
    const Component2539 = `div`;
    const Component2540 = `div`;
    const Component2541 = `div`;
    const Component2542 = `div`;
    const Component2543 = `div`;
    const Component2544 = `span`;
    const Component2545 = `div`;
    const Component2546 = `div`;
    const Component2547 = `input`;
    const Component2548 = `div`;
    const Component2549 = `div`;
    const Component2550 = `textarea`;
    const Component2551 = `div`;
    const Component2552 = `div`;
    const Component2553 = `textarea`;
    const Component2554 = `div`;
    const Component2555 = `button`;
    const Component2556 = `button`;
    const Component2557 = `div`;
    const Component2558 = `div`;
    const Component2559 = `div`;
    return <Component2559 className={`shrink-0 self-stretch bg-[#191919] border-l border-white/10 flex flex-col nodrag`} style={{
      width: n
    }} onClick={e => {
      return e.stopPropagation();
    }}>
        <Component2536 className={`flex items-center justify-between px-3 py-3 border-b border-white/10`}>
          <Component2534 className={`text-xs text-white truncate`}>
            {`编辑`}
            {r_[Y.category]}
            {` · `}
            {Y.name}
          </Component2534>
          <Component2535 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md shrink-0`} onClick={() => {
          return k(null);
        }} title={`收起`}>
            <Gt size={14} />
          </Component2535>
        </Component2536>
        <Component2558 className={`flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 nowheel`} onWheel={e => {
        return e.stopPropagation();
      }}>
          <Component2545 className={`bg-[#222] rounded-xl overflow-hidden flex items-center justify-center relative`} style={{
          minHeight: r
        }}>
            {Y.imageUrl ? <Q.Fragment>
                <Component2537 src={Y.thumbnailUrl || Y.imageUrl} alt={Y.name} loading={`lazy`} decoding={`async`} className={`w-full object-contain cursor-zoom-in ${Y.loading ? `opacity-55` : ``}`} onError={e => {
              let t = e.currentTarget;
              let n = d.videoUploadedAssets?.[Y.imageUrl || ``] || Y.imageUrl;
              if (n && t.src !== n) {
                t.src = n;
              }
            }} onDoubleClick={() => {
              return H(Y.imageUrl);
            }} title={`双击放大查看`} />
                {Y.loading && <Component2541 className={`absolute inset-0 pointer-events-none overflow-hidden`}>
                    <Component2538 className={`absolute inset-0 bg-black/20`} />
                    <Component2539 className={`absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent animate-shimmer`} />
                    <Component2540 className={`absolute inset-0 flex items-center justify-center`}>
                      <_Component25 size={18} className={`animate-spin text-white drop-shadow`} />
                    </Component2540>
                  </Component2541>}
              </Q.Fragment> : Y.loading ? <Component2543 className={`absolute inset-0 flex items-center justify-center overflow-hidden`}>
                <Component2542 className={`absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer`} />
                <_Component25 size={18} className={`animate-spin text-gray-400 relative z-10`} />
              </Component2543> : <Component2544 className={`text-xs text-gray-600 py-8`}>{`暂无参考图`}</Component2544>}
          </Component2545>
          <Component2548>
            <Component2546 className={`text-[11px] text-gray-500 mb-1`}>
              {r_[Y.category]}
              {`名称`}
            </Component2546>
            <Component2547 value={Y.name} onChange={e => {
            return J(Y.id, {
              name: e.target.value
            });
          }} className={`w-full rounded-lg bg-[#242424] border border-transparent focus:border-gray-500 px-2.5 py-2 text-xs text-gray-100 outline-none transition-colors`} />
          </Component2548>
          <Component2551>
            <Component2549 className={`text-[11px] text-gray-500 mb-1`}>{`主体描述`}</Component2549>
            <Component2550 value={Y.description || ``} onChange={e => {
            return J(Y.id, {
              description: e.target.value
            });
          }} placeholder={`该资产的主体外观描述`} className={`w-full min-h-[80px] rounded-lg bg-[#242424] border border-transparent focus:border-gray-500 px-2.5 py-2 text-xs text-gray-200 outline-none resize-y custom-scrollbar nowheel transition-colors`} />
          </Component2551>
          <Component2554>
            <Component2552 className={`text-[11px] text-gray-500 mb-1`}>{`完整生图提示词（可编辑）`}</Component2552>
            <Component2553 value={Y.prompt || ``} onChange={e => {
            return J(Y.id, {
              prompt: e.target.value
            });
          }} placeholder={`该资产的完整生图提示词`} className={`w-full min-h-[220px] rounded-lg bg-[#242424] border border-transparent focus:border-gray-500 px-2.5 py-2 text-xs text-gray-200 outline-none resize-y custom-scrollbar nowheel transition-colors`} />
          </Component2554>
          <Component2557 className={`flex justify-end gap-2`}>
            <Component2555 className={`px-3 py-1.5 rounded-lg bg-[#262626] text-xs text-gray-300 hover:bg-[#333]`} onClick={() => {
            return W(true);
          }}>{`从资源选择`}</Component2555>
            <Component2556 className={`px-3 py-1.5 rounded-lg bg-gray-100 text-gray-950 text-xs font-medium hover:bg-white`} onClick={() => {
            return d.onGenerateAssetImage?.(e, Y.id);
          }}>{`用此提示词生成`}</Component2556>
          </Component2557>
        </Component2558>
      </Component2559>;
  };
  let wt = Ve && ca(Ve) ? ta(Ve) : null;
  let Tt = d.scriptProgressChars;
  const Component2560 = `div`;
  const Component2561 = `button`;
  const Component2562 = `div`;
  const Component2563 = `span`;
  const Component2564 = `div`;
  const Component2565 = `div`;
  const Component2566 = `button`;
  const Component2567 = `div`;
  let Et = () => {
    if (w) {
      return <Component2562 className={`flex items-center bg-red-500/10 rounded-full p-1 pl-3 border border-red-500/30 hover:border-red-500/50 transition-colors cursor-pointer flex-shrink-0 nodrag nopan`} onMouseDown={e => {
        return e.stopPropagation();
      }} onClick={t => {
        t.stopPropagation();
        d.onStop?.(e);
      }} title={`停止生成`}>
          <Component2560 className={`flex items-center gap-1 mr-3 text-xs text-red-400`}>
            {typeof Tt == `number` && Tt > 0 ? `生成中 ${Tt} 字` : `生成中`}
          </Component2560>
          <Component2561 className={`bg-red-500/20 text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-500/30`}>
            <T size={10} fill={`currentColor`} />
          </Component2561>
        </Component2562>;
    } else {
      return <Component2567 className={`flex items-center rounded-full p-1 pl-3 border transition-colors flex-shrink-0 nodrag nopan ${v.trim() ? `bg-[#2a2a2a] border-[#333] hover:border-gray-500 cursor-pointer` : `bg-[#222] border-[#2a2a2a] opacity-50 cursor-not-allowed`}`} onMouseDown={e => {
        return e.stopPropagation();
      }} onClick={qe}>
          {wt !== null && <Component2564 className={`flex items-center gap-0.5 mr-2 text-[11px] text-orange-400 tabular-nums`}>
              <_Component20 className={`w-3 h-3`} strokeWidth={2.5} />
              <Component2563>
                {la(wt)}
                {na(Ve) ? `/${na(Ve)}` : ``}
              </Component2563>
            </Component2564>}
          <Component2565 className={`flex items-center gap-1 mr-3 text-xs text-gray-300`}>
            {_ ? `重新生成` : `生成`}
          </Component2565>
          <Component2566 className={`bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors`}>
            <_Component22 size={14} strokeWidth={3} />
          </Component2566>
        </Component2567>;
    }
  };
  const Component2568 = `span`;
  const Component2569 = `span`;
  const Component2570 = `span`;
  const Component2571 = `button`;
  const Component2576 = `div`;
  const Component2577 = `div`;
  const Component2578 = `div`;
  let Dt = () => {
    return <Component2578 className={`relative nodrag nopan`} ref={Le} onClick={e => {
      return e.stopPropagation();
    }} onMouseDown={e => {
      return e.stopPropagation();
    }}>
        <Component2571 className={`flex items-center gap-1 px-3 py-2 rounded-xl bg-[#262626] border border-[#3a3a3a] text-xs text-gray-200 hover:border-[#555] nodrag`} onClick={e => {
        e.stopPropagation();
        x(e => {
          return !e;
        });
      }} title={`选择文本模型`}>
          {Ve && <Component2568 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${ca(Ve) ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
              {ca(Ve) ? `内置` : `三方`}
            </Component2568>}
          <Component2569 className={`max-w-[150px] truncate`}>{Ve || `选择模型`}</Component2569>
          {wt !== null && <Component2570 className={`inline-flex items-center gap-0.5 text-[10px] text-orange-400 tabular-nums`}>
              <_Component20 className={`w-2.5 h-2.5`} strokeWidth={2.5} />
              {la(wt)}
            </Component2570>}
          <_Component36 size={12} />
        </Component2571>
        {b && <Component2577 className={`absolute z-50 bottom-full left-0 mb-1 w-60 max-h-60 overflow-y-auto rounded-xl border border-[#3a3a3a] bg-[#202020] p-1 shadow-xl custom-scrollbar nowheel nopan nodrag`} onWheel={e => {
        return e.stopPropagation();
      }} onMouseDown={e => {
        return e.stopPropagation();
      }} onClick={e => {
        return e.stopPropagation();
      }}>
            {Be.length > 0 ? Be.map(t => {
          let n = ca(t) ? ta(t) : null;
          const Component2572 = `span`;
          const Component2573 = `span`;
          const Component2574 = `span`;
          const Component2575 = `div`;
          return <Component2575 role={`button`} className={`w-full flex items-center gap-1.5 text-left px-2 py-1.5 rounded-lg text-[11px] cursor-pointer ${Ve === t ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a]`}`} onClick={n => {
            n.stopPropagation();
            r(e, {
              selectedModel: t
            });
            try {
              localStorage.setItem(`mutiwindow_text_model`, t);
            } catch {}
            x(false);
          }} key={t}>
                    <Component2572 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${ca(t) ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                      {ca(t) ? `内置` : `三方`}
                    </Component2572>
                    <Component2573 className={`flex-1 truncate`}>{t}</Component2573>
                    {n !== null && <Component2574 className={`shrink-0 inline-flex items-center gap-0.5 text-[10px] text-orange-400 tabular-nums`}>
                        <_Component20 className={`w-2.5 h-2.5`} strokeWidth={2.5} />
                        {la(n)}
                        {na(t) ? `/${na(t)}` : ``}
                      </Component2574>}
                  </Component2575>;
        }) : <Component2576 className={`px-2 py-2 text-[11px] text-gray-600`}>{`请先在设置中配置文本模型`}</Component2576>}
          </Component2577>}
      </Component2578>;
  };
  const Component2579 = `div`;
  const Component2580 = `input`;
  const Component2581 = `div`;
  const Component2582 = `button`;
  const Component2583 = `div`;
  const Component2584 = `div`;
  const Component2585 = `div`;
  const Component2586 = `textarea`;
  const Component2587 = `div`;
  const Component2588 = `div`;
  const Component2589 = `div`;
  const Component2590 = `button`;
  const Component2591 = `button`;
  const Component2592 = `input`;
  const Component2593 = `div`;
  const Component2594 = `div`;
  const Component2595 = `div`;
  const Component2596 = `div`;
  const Component2597 = `div`;
  const Component2598 = `div`;
  let kt = () => {
    return <Component2598 className={`w-[240px] shrink-0 flex flex-col gap-3 pr-3 border-r border-[#2a2a2a]`}>
        <Component2584>
          <Component2579 className={`text-[11px] text-gray-500 mb-1`}>{`风格`}</Component2579>
          <Component2581 className={`relative nodrag`}>
            <Component2580 value={d.globalStyle || ``} onChange={t => {
            return r(e, {
              globalStyle: t.target.value
            });
          }} placeholder={`选择或输入风格`} className={`w-full rounded-lg bg-[#262626] border border-[#3a3a3a] px-2 py-1.5 text-xs text-gray-200 outline-none`} />
          </Component2581>
          <Component2583 className={`flex flex-wrap gap-1 mt-1.5`}>
            {$g.map(t => {
            return <Component2582 className={`px-1.5 py-0.5 rounded text-[10px] nodrag ${d.globalStyle === t ? `bg-gray-100 text-gray-950` : `bg-[#262626] text-gray-400 hover:text-gray-200`}`} onClick={() => {
              return r(e, {
                globalStyle: t
              });
            }} key={t}>
                  {t}
                </Component2582>;
          })}
          </Component2583>
        </Component2584>
        <Component2588 className={`flex-1 flex flex-col`}>
          <Component2585 className={`text-[11px] text-gray-500 mb-1`}>{`剧情`}</Component2585>
          <Component2587 className={`relative flex-1 min-h-[180px]`}>
            <Component2586 ref={ie} value={v} onChange={e => {
            return y(e.target.value);
          }} onDoubleClick={() => {
            return V(true);
          }} placeholder={`描述剧情片段、故事，为你生成分镜脚本`} className={`w-full h-full min-h-[180px] rounded-xl bg-[#262626] border border-[#3a3a3a] px-3 py-2 pb-8 text-sm text-gray-200 outline-none resize-none nodrag custom-scrollbar nowheel`} />
            <_cmp__Component23 targetRef={ie} onRequestFullscreen={() => {
            return V(true);
          }} minHeight={180} />
          </Component2587>
        </Component2588>
        <Component2594>
          <Component2589 className={`text-[11px] text-gray-500 mb-1`}>{`镜头数量`}</Component2589>
          <Component2593 className={`flex items-center gap-1.5 flex-wrap`}>
            <Component2590 className={`px-2 py-1 rounded-lg text-[11px] nodrag ${d.shotCount === undefined || d.shotCount === `auto` ? `bg-gray-100 text-gray-950` : `bg-[#262626] text-gray-400 hover:text-gray-200`}`} onClick={() => {
            return r(e, {
              shotCount: `auto`
            });
          }}>{`自动`}</Component2590>
            {[10, 20, 30, 50].map(t => {
            return <Component2591 className={`px-2 py-1 rounded-lg text-[11px] nodrag ${d.shotCount === t ? `bg-gray-100 text-gray-950` : `bg-[#262626] text-gray-400 hover:text-gray-200`}`} onClick={() => {
              return r(e, {
                shotCount: t
              });
            }} key={t}>
                  {t}
                </Component2591>;
          })}
            <Component2592 type={`number`} min={1} max={300} placeholder={`自定义`} value={typeof d.shotCount == `number` && ![10, 20, 30, 50].includes(d.shotCount) ? d.shotCount : ``} onChange={t => {
            let n = parseInt(t.target.value, 10);
            r(e, {
              shotCount: Number.isFinite(n) && n > 0 ? n : `auto`
            });
          }} className={`w-16 rounded-lg bg-[#262626] border border-[#3a3a3a] px-2 py-1 text-[11px] text-gray-200 outline-none nodrag`} />
          </Component2593>
        </Component2594>
        <Component2596>
          <Component2595 className={`text-[11px] text-gray-500 mb-1`}>{`模型`}</Component2595>
          {Dt()}
        </Component2596>
        <Component2597 className={`flex justify-end`}>{Et()}</Component2597>
      </Component2598>;
  };
  const Component2599 = `button`;
  const Component2600 = `span`;
  const Component2601 = `button`;
  const Component2602 = `div`;
  let At = () => {
    if (_) {
      return <Component2602 className={`mt-3 flex items-center justify-between gap-3 text-[11px] text-gray-500`}>
          <Component2599 className={`px-2 py-1 text-gray-400 hover:text-gray-200 disabled:opacity-30 nodrag transition-colors`} disabled={pe === 0} onClick={() => {
          return he(e => {
            return Math.max(0, e - 1);
          });
        }}>{`上一页`}</Component2599>
          <Component2600 className={`tabular-nums`}>
            {pe + 1}
            {` / `}
            {ve}
            {`  每页 `}
            {s_}
            {` 镜`}
          </Component2600>
          <Component2601 className={`px-2 py-1 text-gray-400 hover:text-gray-200 disabled:opacity-30 nodrag transition-colors`} disabled={pe >= ve - 1} onClick={() => {
          return he(e => {
            return Math.min(ve - 1, e + 1);
          });
        }}>{`下一页`}</Component2601>
        </Component2602>;
    } else {
      return null;
    }
  };
  const Component2603 = `div`;
  const Component2604 = `div`;
  const Component2605 = `div`;
  const Component2606 = `div`;
  const Component2607 = `div`;
  const Component2608 = `div`;
  const Component2609 = `div`;
  const Component2610 = `div`;
  const Component2611 = `div`;
  const Component2612 = `div`;
  const Component2613 = `div`;
  const Component2614 = `div`;
  const Component2615 = `div`;
  const Component2616 = `div`;
  const Component2617 = `div`;
  const Component2618 = `span`;
  const Component2619 = `span`;
  const Component2620 = `div`;
  const Component2621 = `button`;
  const Component2622 = `div`;
  const Component2623 = `div`;
  const Component2624 = `button`;
  const Component2625 = `div`;
  let jt = e => {
    return <Component2625 className={`flex-1 min-w-0`}>
        {d.errorMsg && <Component2603 className={`text-xs text-red-400 mb-2`}>{d.errorMsg}</Component2603>}
        <Component2617 className={`relative`}>
          <Component2613 className={`grid ${e ? `grid-cols-[44px_56px_minmax(220px,1.6fr)_96px_120px_150px_110px_96px_34px]` : ``} bg-[#222] text-[11px] text-gray-400 rounded-t-lg`} style={e ? undefined : {
          gridTemplateColumns: lt
        }}>
            <Component2604 className={`relative px-2 py-2`}>
              {`镜号`}
              {!e && <_Component116 idx={0} />}
            </Component2604>
            <Component2605 className={`relative px-2 py-2`}>
              {`时长`}
              {!e && <_Component116 idx={1} />}
            </Component2605>
            <Component2606 className={`relative px-2 py-2`}>
              {`画面描述`}
              {!e && <_Component116 idx={2} />}
            </Component2606>
            <Component2607 className={`relative px-2 py-2`}>
              {`景别`}
              {!e && <_Component116 idx={3} />}
            </Component2607>
            {e && <Component2608 className={`px-2 py-2`}>{`光影氛围`}</Component2608>}
            {e && <Component2609 className={`px-2 py-2`}>{`对白旁白`}</Component2609>}
            {e && <Component2610 className={`px-2 py-2`}>{`音效`}</Component2610>}
            <Component2611 className={`relative px-2 py-2`}>
              {`运镜`}
              {!e && <_Component116 idx={4} />}
            </Component2611>
            <Component2612 className={`px-1 py-2 text-center`}>{`·`}</Component2612>
          </Component2613>
          <Component2616>
            {_ ? ye.map(t => {
            return <Component2614 className={`relative`} key={t.id}>
                    {ft(t, e)}
                    {!e && !be.has(`shot-${t.id}`) && <Kt type={`source`} position={X.Right} id={`shot-${t.id}`} className={`!w-3 !h-3 !bg-white !border-2 !border-[#1c1c1c]`} style={{
                top: `50%`,
                right: -10,
                transform: `translateY(-50%)`
              }} title={`镜${t.index} 单独连线（生图/生视频）`} />}
                  </Component2614>;
          }) : <Component2615 className={`px-3 py-8 text-sm text-gray-500 text-center`}>{`输入剧情后点“生成”，自动生成多镜头分镜表`}</Component2615>}
          </Component2616>
        </Component2617>
        {At()}
        {!e && xe.length > 0 && <Component2623 className={`mt-2 border-t border-white/10 pt-2`}>
            <Component2620 className={`mb-1.5 flex items-center justify-between text-[10px] text-gray-500`}>
              <Component2618>{`已连接镜头`}</Component2618>
              {Ce && <Component2619>{`其他页含已连接镜头`}</Component2619>}
            </Component2620>
            <Component2622 className={`flex flex-wrap gap-1.5`}>
              {xe.map(e => {
            return <Component2621 className={`relative rounded border border-white/10 bg-[#242424] px-2 py-1 text-[10px] text-gray-300 hover:bg-[#2b2b2b] nodrag transition-colors`} onClick={() => {
              return he(Math.floor(f.findIndex(t => {
                return t.id === e.id;
              }) / s_));
            }} key={e.id}>
                    {`镜 `}
                    {e.index}
                    <Kt type={`source`} position={X.Right} id={`shot-${e.id}`} className={`!h-2.5 !w-2.5 !border-2 !border-[#1c1c1c] !bg-white`} style={{
                right: -7,
                top: `50%`,
                transform: `translateY(-50%)`
              }} title={`镜${e.index} 已连接`} />
                  </Component2621>;
          })}
            </Component2622>
          </Component2623>}
        <Component2624 className={`mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#262626] hover:bg-[#333] text-xs text-gray-300 nodrag transition-colors`} onClick={Ue}>
          <Xt size={12} />
          {` 添加镜头`}
        </Component2624>
      </Component2625>;
  };
  let Mt = (t, n) => {
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
  let Nt = (t, n, r = false) => {
    let i = p.filter(e => {
      return e.name && e.imageUrl && Fa(`${t.description || ``} ${t.prompt || ``} ${t.videoPrompt || ``} ${t.dialogue || ``}`, e.name);
    });
    const Component2626 = `div`;
    const Component2627 = `span`;
    const Component2628 = `div`;
    const Component2629 = `div`;
    const Component2630 = `input`;
    const Component2631 = `span`;
    const Component2632 = `span`;
    const Component2633 = `label`;
    const Component2634 = `button`;
    const Component2635 = `button`;
    const Component2636 = `div`;
    const Component2637 = `div`;
    const Component2638 = `img`;
    const Component2639 = `button`;
    const Component2640 = `div`;
    const Component2641 = `div`;
    const Component2642 = `div`;
    const Component2643 = `div`;
    const Component2644 = `div`;
    const Component2645 = `div`;
    const Component2646 = `div`;
    const Component2647 = `span`;
    const Component2648 = `button`;
    const Component2649 = `div`;
    const Component2650 = `div`;
    const Component2651 = `option`;
    const Component2652 = `option`;
    const Component2653 = `select`;
    const Component2654 = `div`;
    const Component2655 = `div`;
    const Component2656 = `span`;
    const Component2657 = `button`;
    const Component2658 = `div`;
    const Component2659 = `div`;
    const Component2660 = `span`;
    const Component2661 = `button`;
    const Component2662 = `div`;
    const Component2663 = `div`;
    const Component2664 = `span`;
    const Component2665 = `button`;
    const Component2666 = `div`;
    const Component2667 = `div`;
    const Component2668 = `div`;
    const Component2680 = `div`;
    const Component2681 = `div`;
    const Component2682 = `div`;
    const Component2683 = `div`;
    const Component2684 = `div`;
    const Component2685 = `button`;
    const Component2686 = `div`;
    const Component2687 = `div`;
    const Component2688 = `div`;
    const Component2689 = `div`;
    const Component2690 = `div`;
    const Component2691 = `div`;
    const Component2692 = `div`;
    return <Component2692 className={`relative border-b border-[#2a2a2a] transition-colors ${De.has(t.id) ? `bg-[#242424]` : `bg-transparent`} ${r ? `p-7 space-y-1` : `p-2.5`}`} key={t.id}>
        {t.promptLoading && <Component2629 className={`absolute inset-0 z-40 overflow-hidden bg-[#181818]/55 backdrop-blur-[1px] cursor-not-allowed`}>
            <Component2626 className={`absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-shimmer`} />
            {n && <Component2628 className={`absolute inset-0 flex flex-col items-center justify-center gap-2`}>
                <_Component25 size={24} className={`animate-spin text-white`} />
                <Component2627 className={`text-xs text-gray-200`}>{`正在生成镜头提示词`}</Component2627>
              </Component2628>}
          </Component2629>}
        <Component2637 className={`flex items-center justify-between mb-2`}>
          {!r && <Component2633 className={`flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer nodrag`}>
              <Component2630 type={`checkbox`} checked={De.has(t.id)} onChange={() => {
            return Oe(t.id);
          }} className={`accent-white`} />
              <Component2631 className={`text-base text-white font-semibold`} style={{
            fontFamily: `STSong, SimSun, "Songti SC", serif`
          }}>
                {`镜`}
                {t.index}
              </Component2631>
              {t.duration && <Component2632 className={`text-[10px] text-gray-500`}>{t.duration}</Component2632>}
            </Component2633>}
          {!r && <Component2636 className={`ml-auto`}>
              {t.promptLoading ? <Component2634 type={`button`} className={`p-1 rounded text-white hover:bg-white/10 nodrag`} title={`生成中，点击停止`} onClick={() => {
            return d.onStopScriptItem?.(e, `shot`, t.id);
          }}>
                  <_Component25 size={15} className={`animate-spin`} />
                </Component2634> : <Component2635 type={`button`} className={`p-1 rounded text-gray-500 hover:text-white hover:bg-white/10 nodrag`} title={t.prompt || t.videoPrompt ? `重生成提示词` : `生成提示词`} onClick={() => {
            return d.onGenerateShotPrompts?.(e, t.id);
          }}>
                  <_Component25 size={15} />
                </Component2635>}
            </Component2636>}
        </Component2637>
        {r && <Component2683 className={`mb-6 space-y-5`}>
            {i.length > 0 && <Component2645 className={`flex items-center gap-5 rounded-lg bg-[#1b1b1b] px-4 py-3`}>
                <Component2640 className={`flex shrink-0 items-center pl-2 py-1 ${ne.has(t.id) ? `max-w-[420px] flex-wrap gap-2` : ``}`}>
                  {(ne.has(t.id) ? i : i.slice(0, 4)).map((e, n) => {
              return <Component2638 src={e.thumbnailUrl || e.imageUrl} alt={e.name} loading={`lazy`} decoding={`async`} className={`w-16 h-16 object-cover border-2 border-white/90 shadow-[0_8px_18px_rgba(0,0,0,0.38)] cursor-zoom-in nodrag ${ne.has(t.id) ? `rounded-md` : `${n > 0 ? `-ml-7` : ``} ${[`-rotate-3`, `rotate-2`, `-rotate-1`, `rotate-3`][n] || ``}`}`} style={{
                zIndex: n + 1
              }} onError={t => {
                let n = t.currentTarget;
                let r = d.videoUploadedAssets?.[e.imageUrl || ``] || e.imageUrl;
                if (r && n.src !== r) {
                  n.src = r;
                }
              }} onDoubleClick={() => {
                return H(e.imageUrl);
              }} title={`双击放大`} key={e.id} />;
            })}
                  {i.length > 4 && <Component2639 type={`button`} className={`relative z-10 flex h-8 min-w-8 items-center justify-center rounded-full border border-white/40 bg-[#303030] px-1.5 text-[10px] font-medium text-white shadow-lg hover:bg-[#444] nodrag ${ne.has(t.id) ? `` : `-ml-5`}`} onClick={() => {
              return B(e => {
                let n = new Set(e);
                if (n.has(t.id)) {
                  n.delete(t.id);
                } else {
                  n.add(t.id);
                }
                return n;
              });
            }}>
                      {ne.has(t.id) ? `收起` : `+${i.length - 4}`}
                    </Component2639>}
                </Component2640>
                <Component2644 className={`min-w-0 flex-1`}>
                  <Component2641 className={`text-xs font-medium text-gray-100`}>{`引用资产`}</Component2641>
                  <Component2642 className={`mt-0.5 text-[10px] text-gray-500`}>
                    {i.length}
                    {` 张附图`}
                  </Component2642>
                  <Component2643 className={`mt-1.5 truncate text-[11px] text-gray-300`} title={i.map(e => {
              return e.name;
            }).join(`、`)}>
                    {i.map(e => {
                return e.name;
              }).join(`、`)}
                  </Component2643>
                </Component2644>
              </Component2645>}
            <Component2667 className={`grid grid-cols-2 gap-4`}>
              <Component2649 className={`relative`}>
                <Component2646 className={`text-[10px] text-gray-500 mb-0.5`}>{`时长`}</Component2646>
                <Component2648 className={`w-full rounded-md bg-[#262626] border border-transparent focus:border-gray-500 px-2 py-1.5 text-[11px] text-left text-gray-200 outline-none nodrag transition-colors`} onClick={e => {
              e.stopPropagation();
              Xe(t.id, `duration`);
            }}>
                  <Component2647 className={t.duration ? `text-gray-200` : `text-gray-500`}>
                    {t.duration || `如 3s / 5s`}
                  </Component2647>
                </Component2648>
                {$e(t, `duration`)}
              </Component2649>
              <Component2654>
                <Component2650 className={`text-[10px] text-gray-500 mb-0.5`}>{`景别`}</Component2650>
                <Component2653 value={t.shotType || ``} onChange={e => {
              return He(t.id, {
                shotType: e.target.value
              });
            }} className={`w-full rounded-md bg-[#262626] border border-transparent focus:border-gray-500 px-2 py-1.5 text-[11px] text-gray-200 outline-none nodrag transition-colors`}>
                  <Component2651 value={``}>{`未指定`}</Component2651>
                  {e_.map(e => {
                return <Component2652 value={e} key={e}>
                        {e}
                      </Component2652>;
              })}
                </Component2653>
              </Component2654>
              <Component2658 className={`relative`}>
                <Component2655 className={`text-[10px] text-gray-500 mb-0.5`}>{`运镜`}</Component2655>
                <Component2657 className={`w-full rounded-md bg-[#262626] border border-transparent focus:border-gray-500 px-2 py-1.5 text-[11px] text-left text-gray-200 outline-none nodrag transition-colors`} onClick={e => {
              e.stopPropagation();
              Xe(t.id, `motion`);
            }}>
                  <Component2656 className={t.motion ? `text-gray-200` : `text-gray-500`}>
                    {t.motion || `推/拉/摇/移…`}
                  </Component2656>
                </Component2657>
                {$e(t, `motion`)}
              </Component2658>
              <Component2662 className={`relative`}>
                <Component2659 className={`text-[10px] text-gray-500 mb-0.5`}>{`光影`}</Component2659>
                <Component2661 className={`w-full rounded-md bg-[#262626] border border-transparent focus:border-gray-500 px-2 py-1.5 text-[11px] text-left text-gray-200 outline-none nodrag transition-colors`} onClick={e => {
              e.stopPropagation();
              Xe(t.id, `lighting`);
            }}>
                  <Component2660 className={t.lighting ? `text-gray-200` : `text-gray-500`}>
                    {t.lighting || `光影氛围`}
                  </Component2660>
                </Component2661>
                {$e(t, `lighting`)}
              </Component2662>
              <Component2666 className={`relative col-span-2`}>
                <Component2663 className={`text-[10px] text-gray-500 mb-0.5`}>{`音效`}</Component2663>
                <Component2665 className={`w-full rounded-md bg-[#262626] border border-transparent focus:border-gray-500 px-2 py-1.5 text-[11px] text-left text-gray-200 outline-none nodrag transition-colors`} onClick={e => {
              e.stopPropagation();
              Xe(t.id, `sound`);
            }}>
                  <Component2664 className={t.sound ? `text-gray-200` : `text-gray-500`}>
                    {t.sound || `环境声/音效描述`}
                  </Component2664>
                </Component2665>
                {$e(t, `sound`)}
              </Component2666>
            </Component2667>
            <Component2680>
              <Component2668 className={`text-[10px] text-gray-500 mb-0.5`}>{`对白/旁白`}</Component2668>
              {(() => {
            let e = at(t.dialogue);
            const Component2669 = `button`;
            const Component2670 = `option`;
            const Component2671 = `option`;
            const Component2672 = `select`;
            const Component2673 = `textarea`;
            const Component2674 = `button`;
            const Component2675 = `div`;
            const Component2676 = `button`;
            const Component2677 = `button`;
            const Component2678 = `div`;
            const Component2679 = `div`;
            return <Component2679 className={`space-y-2`}>
                    {e.map((n, r) => {
                return <Component2675 className={`flex items-center gap-2`} key={r}>
                          <Component2669 type={`button`} className={`w-[52px] shrink-0 rounded border border-transparent px-1 py-1 text-[10px] outline-none nodrag ${n.kind === `旁白` ? `bg-purple-500/20 text-purple-300` : `bg-cyan-500/20 text-cyan-400`}`} onClick={() => {
                    let i = [...e];
                    let a = n.kind === `旁白` ? `台词` : `旁白`;
                    i[r] = {
                      ...i[r],
                      kind: a,
                      role: a === `旁白` ? `` : i[r].role
                    };
                    He(t.id, {
                      dialogue: ot(i)
                    });
                  }}>
                            {n.kind}
                          </Component2669>
                          {n.kind === `台词` && <Component2672 value={n.role} onChange={n => {
                    let i = [...e];
                    i[r] = {
                      ...i[r],
                      role: n.target.value
                    };
                    He(t.id, {
                      dialogue: ot(i)
                    });
                  }} className={`w-[60px] rounded bg-[#1a1a1a] border border-[#3a3a3a] px-0.5 py-0.5 text-[10px] text-gray-200 outline-none nodrag text-center`}>
                              <Component2670 value={``}>{`角色`}</Component2670>
                              {h.map(e => {
                      return <Component2671 value={e.name} key={e.id}>
                                    {e.name}
                                  </Component2671>;
                    })}
                            </Component2672>}
                          <Component2673 rows={1} value={n.text} onChange={n => {
                    let i = [...e];
                    i[r] = {
                      ...i[r],
                      text: n.target.value
                    };
                    He(t.id, {
                      dialogue: ot(i)
                    });
                  }} placeholder={n.kind === `旁白` ? `旁白内容` : `台词内容`} className={`flex-1 rounded bg-[#1a1a1a] border border-[#3a3a3a] px-2 py-1.5 text-[11px] text-gray-200 outline-none resize-none min-h-[28px] nodrag`} />
                          <Component2674 className={`p-1 text-gray-500 hover:text-red-400 shrink-0 nodrag mt-0.5`} onClick={() => {
                    let n = [...e];
                    n.splice(r, 1);
                    He(t.id, {
                      dialogue: ot(n)
                    });
                  }}>
                            <Gt size={12} />
                          </Component2674>
                        </Component2675>;
              })}
                    <Component2678 className={`flex items-center gap-2 pt-1`}>
                      <Component2676 className={`px-2 py-1 rounded bg-[#2a2a2a] text-gray-300 hover:bg-[#333] text-[10px] flex items-center gap-1 nodrag`} onClick={() => {
                  return He(t.id, {
                    dialogue: ot([{
                      kind: `台词`,
                      role: ``,
                      text: ``
                    }, ...e])
                  });
                }}>
                        <Xt size={10} />
                        {` 台词`}
                      </Component2676>
                      <Component2677 className={`px-2 py-1 rounded bg-[#2a2a2a] text-gray-300 hover:bg-[#333] text-[10px] flex items-center gap-1 nodrag`} onClick={() => {
                  return He(t.id, {
                    dialogue: ot([{
                      kind: `旁白`,
                      role: ``,
                      text: ``
                    }, ...e])
                  });
                }}>
                        <Xt size={10} />
                        {` 旁白`}
                      </Component2677>
                    </Component2678>
                  </Component2679>;
          })()}
            </Component2680>
            <Component2682 className={`relative`}>
              <Component2681 className={`text-[10px] text-gray-500 mb-0.5`}>{`画面描述（输入 @ 引用资产）`}</Component2681>
              {rt(t, `description`, `w-full min-h-[64px] rounded-md bg-[#262626] border border-transparent focus:border-gray-500 px-2.5 py-2 text-[11px] text-gray-200 outline-none resize-y nodrag custom-scrollbar nowheel transition-colors`, `画面描述，输入 @ 引用资源`)}
            </Component2682>
          </Component2683>}
        <Component2691 className={`grid ${r ? `grid-cols-1 gap-3` : `grid-cols-2 gap-2`}`}>
          <Component2688>
            <Component2687 className={`flex items-center justify-between gap-2 mb-1.5`}>
              <Component2684 className={`text-xs font-medium text-gray-300`}>{`生图`}</Component2684>
              <Component2686 className={`flex items-center gap-0.5`} title={`图像提示词宫格构图`}>
                {[[0, `单图`], [4, `四宫格`], [9, `九宫格`]].map(([e, n]) => {
                return <Component2685 className={`px-1.5 py-0.5 rounded text-[10px] nodrag ${(t.gridMode || 0) === e ? `bg-gray-100 text-gray-950` : `bg-[#2a2a2a] text-gray-500 hover:text-gray-300`}`} onClick={() => {
                  return He(t.id, {
                    gridMode: e
                  });
                }} key={e}>
                      {n}
                    </Component2685>;
              })}
              </Component2686>
            </Component2687>
            {rt(t, `prompt`, `w-full ${r ? `min-h-[100px] bg-[#262626]` : `min-h-[60px] bg-transparent group-hover:bg-[#262626] focus:bg-[#262626]`} rounded-lg border border-transparent hover:border-[#3a3a3a] focus:border-gray-500 text-xs text-gray-200 outline-none px-2.5 py-2 nodrag nowheel transition-colors`, `点上方按钮生成，或输入 @ 引用资产`)}
          </Component2688>
          <Component2690>
            <Component2689 className={`text-xs font-medium text-gray-300 mb-1.5`}>{`生视频`}</Component2689>
            {rt(t, `videoPrompt`, `w-full ${r ? `min-h-[100px] bg-[#262626]` : `min-h-[60px] bg-transparent group-hover:bg-[#262626] focus:bg-[#262626]`} rounded-lg border border-transparent hover:border-[#3a3a3a] focus:border-gray-500 text-xs text-gray-200 outline-none px-2.5 py-2 nodrag nowheel transition-colors`, `点上方按钮生成，或输入 @ 引用资产`)}
          </Component2690>
        </Component2691>
        <Kt type={`source`} position={X.Right} id={`shot-${t.id}`} className={`!w-3 !h-3 !border-2 !z-20 ${n ? `!opacity-0 !pointer-events-none` : `!bg-white !border-[#1c1c1c]`}`} style={{
        top: r ? 32 : `50%`,
        right: n ? 0 : r ? -10 : -22,
        transform: r ? undefined : `translateY(-50%)`
      }} title={`镜${t.index} 单独连线`} />
      </Component2692>;
  };
  const Component2693 = `div`;
  const Component2694 = `div`;
  const Component2695 = `div`;
  const Component2696 = `span`;
  const Component2697 = `span`;
  const Component2698 = `div`;
  const Component2699 = `div`;
  const Component2700 = `div`;
  const Component2701 = `div`;
  const Component2702 = `button`;
  const Component2703 = `button`;
  const Component2704 = `div`;
  const Component2705 = `span`;
  const Component2706 = `button`;
  const Component2707 = `button`;
  const Component2708 = `button`;
  const Component2709 = `div`;
  const Component2710 = `div`;
  const Component2711 = `div`;
  const Component2712 = `div`;
  const Component2728 = `div`;
  const Component2729 = `div`;
  const Component2730 = `div`;
  const Component2731 = `div`;
  let Pt = t => {
    return <Component2731>
        {g === 1 && <Component2693 className={`flex gap-3 ${t ? `p-2` : `px-4 py-3`}`}>
            {kt()}
            {jt(t)}
          </Component2693>}
        {g === 2 && <Component2695 className={`flex items-stretch`}>
            <Component2694 className={`flex-1 min-w-0 ${t ? `p-2` : `px-4 py-3`}`}>
              {St(t)}
            </Component2694>
            {Ct(t)}
          </Component2695>}
        {g === 3 && <Component2730 className={t ? `p-2` : `px-4 py-3`}>
            {d.videoAssetUploadProgress?.status === `uploading` && <Component2701 className={`mb-3 rounded-lg border border-white/10 bg-[#202020] px-3 py-2`}>
                <Component2698 className={`mb-1.5 flex items-center justify-between text-[11px]`}>
                  <Component2696 className={`text-gray-300`}>{`正在连接视频素材`}</Component2696>
                  <Component2697 className={`text-gray-500`}>
                    {d.videoAssetUploadProgress.completed}
                    {`/`}
                    {d.videoAssetUploadProgress.total}
                  </Component2697>
                </Component2698>
                <Component2700 className={`h-1 overflow-hidden rounded-full bg-[#333]`}>
                  <Component2699 className={`h-full bg-emerald-400 transition-all`} style={{
              width: `${d.videoAssetUploadProgress.total ? d.videoAssetUploadProgress.completed / d.videoAssetUploadProgress.total * 100 : 0}%`
            }} />
                </Component2700>
              </Component2701>}
            <Component2710 className={`flex items-center justify-between mb-4 gap-2`}>
              <Component2704 className={`flex items-center gap-0.5 p-0.5 rounded-lg bg-[#262626]`}>
                <Component2702 className={`px-2.5 py-1 rounded-md text-[11px] transition-colors nodrag ${le === `list` ? `bg-gray-100 text-gray-950` : `text-gray-400 hover:text-gray-200`}`} onClick={() => {
              return G(`list`);
            }}>{`列表`}</Component2702>
                <Component2703 className={`px-2.5 py-1 rounded-md text-[11px] transition-colors nodrag ${le === `single` ? `bg-gray-100 text-gray-950` : `text-gray-400 hover:text-gray-200`}`} onClick={() => {
              return G(`single`);
            }}>{`单镜头`}</Component2703>
              </Component2704>
              {le === `list` && <Component2709 className={`flex items-center gap-1.5 nodrag`}>
                  <Component2705 className={`mr-0.5 text-[11px] text-gray-500`}>{`批量操作：`}</Component2705>
                  <Component2706 className={`inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-950 hover:bg-white`} onClick={() => {
              let t = f.filter(e => {
                return De.has(e.id);
              }).map(e => {
                return e.id;
              });
              d.onGenerateShotPrompts?.(e, undefined, t.length ? t : undefined);
            }}>
                    <_Component20 size={12} />
                    {` 提示词`}
                  </Component2706>
                  <Component2707 className={`rounded-lg bg-[#2a2a2a] px-2.5 py-1.5 text-xs text-gray-200 hover:bg-[#333]`} onClick={() => {
              return window.dispatchEvent(new CustomEvent(`script-box-connect-shots`, {
                detail: {
                  nodeId: e,
                  shotIds: f.filter(e => {
                    return De.has(e.id);
                  }).map(e => {
                    return e.id;
                  }),
                  target: `image`
                }
              }));
            }}>{`连接生图`}</Component2707>
                  <Component2708 className={`rounded-lg bg-[#2a2a2a] px-2.5 py-1.5 text-xs text-gray-200 hover:bg-[#333]`} onClick={() => {
              return window.dispatchEvent(new CustomEvent(`script-box-connect-shots`, {
                detail: {
                  nodeId: e,
                  shotIds: f.filter(e => {
                    return De.has(e.id);
                  }).map(e => {
                    return e.id;
                  }),
                  target: `video`
                }
              }));
            }}>{`连接视频`}</Component2708>
                </Component2709>}
            </Component2710>
            {_ ? le === `list` ? <Component2712>
                  <Component2711 className={`space-y-2`}>
                    {ye.map(e => {
              return Nt(e, t, false);
            })}
                  </Component2711>
                  {At()}
                </Component2712> : <Component2728>
                  {(() => {
            let n = pe * s_;
            let r = Math.min(n + s_, f.length);
            let i = n + Math.min(Math.max(ue - n, 0), Math.max(r - n - 1, 0));
            let a = f[i] || f[Math.min(ue, f.length - 1)];
            const Component2713 = `button`;
            const Component2714 = `span`;
            const Component2715 = `span`;
            const Component2716 = `button`;
            const Component2717 = `button`;
            const Component2718 = `div`;
            const Component2719 = `div`;
            const Component2720 = `button`;
            const Component2721 = `div`;
            const Component2722 = `button`;
            const Component2723 = `button`;
            const Component2724 = `button`;
            const Component2725 = `button`;
            const Component2726 = `div`;
            const Component2727 = `div`;
            return <Q.Fragment>
                        <Component2727 className={`flex items-center justify-between mb-3`}>
                          <Component2721 className={`flex items-center justify-start gap-2`}>
                            <Component2713 className={`text-5xl font-light leading-none text-gray-500 hover:text-white nodrag`} disabled={i <= 0} onClick={() => {
                    de(i - 1);
                    he(Math.floor((i - 1) / s_));
                  }}>{`‹`}</Component2713>
                            <Component2719 className={`relative text-center`}>
                              <Component2716 className={`flex items-baseline gap-2 nodrag`} onMouseEnter={() => {
                      return _e(true);
                    }}>
                                <Component2714 className={`text-3xl text-white font-semibold`} style={{
                        fontFamily: `STSong, SimSun, "Songti SC", serif`
                      }}>
                                  {`镜`}
                                  {a.index}
                                </Component2714>
                                <Component2715 className={`text-sm text-gray-500`}>
                                  {`/`}
                                  {f.length}
                                </Component2715>
                                <_Component36 size={14} className={`text-gray-500`} />
                              </Component2716>
                              {ge && <Component2718 className={`absolute left-1/2 top-full z-50 mt-1 grid max-h-64 w-[360px] -translate-x-1/2 grid-cols-10 gap-1 rounded-lg border border-[#3a3a3a] bg-[#202020] p-2 shadow-xl`} onClick={e => {
                      if (e.target === e.currentTarget) {
                        _e(false);
                      }
                    }} onMouseLeave={() => {
                      return _e(false);
                    }}>
                                  {f.map((e, t) => {
                        return <Component2717 className={`h-7 w-7 rounded border border-white/10 text-center text-xs text-gray-300 hover:border-white/50 hover:bg-[#333]`} onClick={() => {
                          de(t);
                          he(Math.floor(t / s_));
                          _e(false);
                        }} key={e.id}>
                                        {e.index}
                                      </Component2717>;
                      })}
                                </Component2718>}
                            </Component2719>
                            <Component2720 className={`text-5xl font-light leading-none text-gray-500 hover:text-white nodrag`} disabled={i >= f.length - 1} onClick={() => {
                    de(i + 1);
                    he(Math.floor((i + 1) / s_));
                  }}>{`›`}</Component2720>
                          </Component2721>
                          <Component2726 className={`flex items-center justify-end gap-2`}>
                            {a.promptLoading ? <Component2722 type={`button`} className={`h-8 rounded-md bg-[#2a2a2a] px-3 text-xs text-gray-200 nodrag`} title={`生成中，点击停止`} onClick={() => {
                    return d.onStopScriptItem?.(e, `shot`, a.id);
                  }}>{`生成中`}</Component2722> : <Component2723 type={`button`} className={`h-8 rounded-md bg-[#2a2a2a] px-3 text-xs text-gray-200 hover:bg-[#333] nodrag`} onClick={() => {
                    return d.onGenerateShotPrompts?.(e, a.id);
                  }}>
                                {a.prompt || a.videoPrompt ? `重生成提示词` : `生成提示词`}
                              </Component2723>}
                            <Component2724 className={`inline-flex min-w-[76px] items-center justify-center gap-1.5 px-3.5 py-2 rounded-md bg-white text-gray-950 text-xs hover:bg-gray-200 nodrag`} onClick={() => {
                    return window.dispatchEvent(new CustomEvent(`script-box-connect-shot`, {
                      detail: {
                        nodeId: e,
                        shotId: a.id,
                        target: `image`
                      }
                    }));
                  }}>
                              {Mt(a.id, `image`) ? `√ 生图` : `生图`}
                            </Component2724>
                            <Component2725 className={`inline-flex min-w-[76px] items-center justify-center gap-1.5 px-3.5 py-2 rounded-md bg-white text-gray-950 text-xs hover:bg-gray-200 nodrag`} onClick={() => {
                    return window.dispatchEvent(new CustomEvent(`script-box-connect-shot`, {
                      detail: {
                        nodeId: e,
                        shotId: a.id,
                        target: `video`
                      }
                    }));
                  }}>
                              {Mt(a.id, `video`) ? `√ 视频` : `生视频`}
                            </Component2725>
                          </Component2726>
                        </Component2727>
                        {Nt(a, t, true)}
                      </Q.Fragment>;
          })()}
                </Component2728> : <Component2729 className={`text-sm text-gray-500 text-center py-6`}>{`先生成脚本`}</Component2729>}
          </Component2730>}
      </Component2731>;
  };
  let Ft = (() => {
    let t = f.length;
    let n = p.length;
    let i = p.filter(e => {
      return e.imageUrl;
    }).length;
    let a = f.filter(e => {
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
    const Component2743 = `div`;
    return <Component2743 className={`flex items-center flex-1 max-w-3xl mx-auto text-xs w-full`}>
        {o.map((t, n) => {
        let i = t.n === g;
        let a = n === o.length - 1;
        const Component2732 = `circle`;
        const Component2733 = `circle`;
        const Component2734 = `svg`;
        const Component2735 = `span`;
        const Component2736 = `div`;
        const Component2737 = `span`;
        const Component2738 = `span`;
        const Component2739 = `div`;
        const Component2740 = `button`;
        const Component2741 = `div`;
        const Component2742 = `div`;
        return <Component2742 className={`flex items-center flex-1`} key={t.n}>
              <Component2740 className={`flex items-center gap-3 nodrag text-left rounded-xl px-3 py-1.5 transition-colors w-[160px] ${i ? `bg-[#2a2a2a]` : `hover:bg-[#222]`}`} onClick={() => {
            return r(e, {
              step: t.n
            });
          }}>
                <Component2736 className={`relative flex items-center justify-center w-7 h-7 shrink-0`}>
                  <Component2734 className={`absolute inset-0 w-full h-full -rotate-90`} viewBox={`0 0 24 24`}>
                    <Component2732 cx={`12`} cy={`12`} r={`11`} fill={`none`} stroke={i ? `#3a3a3a` : `#2a2a2a`} strokeWidth={`2`} />
                    <Component2733 cx={`12`} cy={`12`} r={`11`} fill={`none`} stroke={i ? `#fff` : `#666`} strokeWidth={`2`} strokeDasharray={Math.PI * 2 * 11} strokeDashoffset={Math.PI * 2 * 11 * (1 - t.progress)} className={`transition-all duration-300 ease-out`} />
                  </Component2734>
                  <Component2735 className={`relative z-10 text-[11px] font-medium ${i ? `text-white` : `text-gray-400`}`}>
                    {t.n}
                  </Component2735>
                </Component2736>
                <Component2739 className={`flex flex-col flex-1 min-w-0`}>
                  <Component2737 className={`text-[12px] font-medium truncate ${i ? `text-white` : `text-gray-400`}`}>
                    {t.title}
                  </Component2737>
                  <Component2738 className={`text-[10px] truncate ${i ? `text-gray-400` : `text-gray-500`}`}>
                    {t.desc}
                  </Component2738>
                </Component2739>
              </Component2740>
              {!a && <Component2741 className={`flex-1 mx-4 h-px bg-[#333]`} />}
            </Component2742>;
      })}
      </Component2743>;
  })();
  let It = g === 3 && le === `single`;
  if (l < 0.4 && !n && !w) {
    const Component2744 = `div`;
    const Component2745 = `div`;
    const Component2746 = `div`;
    const Component2747 = `div`;
    const Component2748 = `div`;
    const Component2749 = `div`;
    return <Component2749 className={`relative flex flex-col items-stretch ${n ? `z-50` : `z-10`}`} style={{
      width: 860
    }}>
        <_cmp__Component8 id={e} data={t} defaultTitle={`脚本盒子`} icon={<_Component49 size={11} className={`text-gray-500`} />} className={`w-full justify-start text-left`} />
        <Component2748 className={`w-full rounded-[20px] border border-white/10 bg-[#1c1c1c] px-6 py-8 shadow-[0_12px_40px_rgba(0,0,0,0.35)]`}>
          <Component2747 className={`flex items-center gap-3`}>
            <_Component49 size={40} className={`text-gray-600`} />
            <Component2746 className={`min-w-0`}>
              <Component2744 className={`truncate text-2xl font-semibold text-white`} style={{
              fontFamily: `STSong, SimSun, "Songti SC", serif`
            }}>
                {d.label || `脚本盒子`}
              </Component2744>
              <Component2745 className={`mt-1 text-sm text-gray-500`}>
                {f.length}
                {` 镜头 · `}
                {p.length}
                {` 资产 · 第 `}
                {g}
                {` 步`}
              </Component2745>
            </Component2746>
          </Component2747>
        </Component2748>
        {f.map(e => {
        return <Kt type={`source`} position={X.Right} id={`shot-${e.id}`} className={`!h-0 !w-0 !min-w-0 !border-0 !bg-transparent`} style={{
          right: 0,
          top: `50%`
        }} key={e.id} />;
      })}
      </Component2749>;
  } else {
    const Component2750 = `input`;
    const Component2751 = `div`;
    const Component2752 = `div`;
    const Component2753 = `span`;
    const Component2754 = `button`;
    const Component2755 = `button`;
    const Component2756 = `div`;
    const Component2757 = `div`;
    const Component2758 = `span`;
    const Component2759 = `button`;
    const Component2760 = `div`;
    const Component2761 = `div`;
    const Component2762 = `div`;
    const Component2763 = `div`;
    const Component2764 = `button`;
    const Component2765 = `button`;
    const Component2766 = `div`;
    const Component2767 = `div`;
    const Component2768 = `div`;
    const Component2769 = `div`;
    const Component2770 = `div`;
    const Component2771 = `span`;
    const Component2772 = `button`;
    const Component2773 = `div`;
    const Component2774 = `textarea`;
    const Component2775 = `div`;
    const Component2776 = `div`;
    const Component2777 = `span`;
    const Component2778 = `button`;
    const Component2779 = `div`;
    const Component2780 = `div`;
    const Component2781 = `button`;
    const Component2782 = `div`;
    const Component2783 = `input`;
    const Component2784 = `div`;
    const Component2785 = `div`;
    const Component2786 = `textarea`;
    const Component2787 = `div`;
    const Component2788 = `div`;
    const Component2789 = `textarea`;
    const Component2790 = `div`;
    const Component2791 = `div`;
    const Component2792 = `span`;
    const Component2793 = `button`;
    const Component2794 = `div`;
    const Component2795 = `textarea`;
    const Component2796 = `div`;
    const Component2797 = `span`;
    const Component2798 = `button`;
    const Component2799 = `div`;
    const Component2800 = `textarea`;
    const Component2801 = `div`;
    const Component2802 = `span`;
    const Component2803 = `button`;
    const Component2804 = `div`;
    const Component2805 = `textarea`;
    const Component2806 = `div`;
    const Component2807 = `div`;
    const Component2808 = `button`;
    const Component2809 = `div`;
    const Component2810 = `div`;
    const Component2811 = `div`;
    const Component2812 = `button`;
    const Component2813 = `img`;
    const Component2814 = `div`;
    const Component2815 = `div`;
    return <Component2815 className={`relative flex flex-col items-stretch group/node transition-colors ${n ? `z-50` : `z-10`}`} style={{
      width: 860
    }}>
        <_cmp__Component8 id={e} data={t} defaultTitle={`脚本盒子`} icon={<_Component49 size={11} className={`text-gray-500`} />} className={`w-full justify-start text-left`} />
        <Component2750 type={`file`} ref={Ie} accept={`image/*`} className={`hidden`} onChange={Ye} />
        <Component2763 className={`relative w-full ${It ? `isolate pt-2 pb-3` : ``}`}>
          {It && <Q.Fragment>
              <Component2751 className={`pointer-events-none absolute inset-x-2 top-4 bottom-0 z-0 translate-x-3 rotate-2 rounded-[22px] border border-white/10 bg-[#2a2a2a] shadow-xl`} />
              <Component2752 className={`pointer-events-none absolute inset-x-1 top-2 bottom-1 z-0 -translate-x-2 -rotate-1 rounded-[22px] border border-white/15 bg-[#242424] shadow-xl`} />
            </Q.Fragment>}
          <Component2762 className={`relative z-10 w-full bg-[#1c1c1c] rounded-[20px] border shadow-[0_12px_40px_rgba(0,0,0,0.35)] ${n ? `border-white/35` : `border-white/10 hover:border-white/20`}`}>
            <Component2757 className={`flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#191919] rounded-t-[20px]`}>
              {Ft}
              <Component2756 className={`flex items-center gap-2`}>
                {w && <Component2753 className={`inline-flex items-center gap-1 text-[11px] text-emerald-400`}>
                    <_Component25 size={12} className={`animate-spin`} />
                    {` `}
                    {typeof Tt == `number` && Tt > 0 ? `生成中 ${Tt} 字 · ${Re}s` : `生成中 ${Re}s`}
                  </Component2753>}
                <Component2754 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md nodrag`} onClick={() => {
                return z(true);
              }} title={`总体提示词设置`}>
                  <_Component117 size={14} />
                </Component2754>
                <Component2755 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md nodrag`} onClick={() => {
                return D(true);
              }} title={`全屏显示`}>
                  <Ke size={14} />
                </Component2755>
              </Component2756>
            </Component2757>
            <Component2761 className={`relative`}>
              {w && <Component2760 className={`absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-[#1a1a1a]/75 rounded-b-[20px]`}>
                  <_Component25 className={`w-7 h-7 animate-spin text-emerald-400`} />
                  <Component2758 className={`text-xs text-gray-200`}>
                    {typeof Tt == `number` && Tt > 0 ? `正在生成分镜脚本… 已接收 ${Tt} 字 · 已用 ${Re}s` : `正在生成分镜脚本… 已用 ${Re}s`}
                  </Component2758>
                  <Component2759 className={`mt-1 px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30 nodrag nopan`} onMouseDown={e => {
                return e.stopPropagation();
              }} onClick={t => {
                t.stopPropagation();
                d.onStop?.(e);
              }}>{`停止生成`}</Component2759>
                </Component2760>}
              {Pt(false)}
            </Component2761>
          </Component2762>
        </Component2763>
        {E && Fn.createPortal(<Component2770 className={`fixed inset-0 z-[2147483646] bg-black/85 backdrop-blur-sm flex items-center justify-center p-6`} onMouseDown={e => {
        return e.stopPropagation();
      }} onWheel={e => {
        return e.stopPropagation();
      }}>
              <Component2769 className={`relative bg-[#1c1c1c] rounded-2xl border border-[#3a3a3a] shadow-2xl flex flex-col`} style={{
          width: `92vw`,
          height: `88vh`
        }}>
                <Component2767 className={`flex items-center justify-between px-5 py-3 border-b border-[#2c2c2c]`}>
                  {Ft}
                  <Component2766 className={`flex items-center gap-2`}>
                    <Component2764 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} onClick={() => {
                return z(true);
              }} title={`总体提示词设置`}>
                      <_Component117 size={15} />
                    </Component2764>
                    <Component2765 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} onClick={() => {
                return D(false);
              }}>
                      <Gt size={16} />
                    </Component2765>
                  </Component2766>
                </Component2767>
                <Component2768 className={`flex-1 overflow-y-auto custom-scrollbar p-3`}>
                  {Pt(true)}
                </Component2768>
              </Component2769>
            </Component2770>, document.body)}
        {re && Fn.createPortal(<Component2776 className={`fixed inset-0 z-[2147483647] bg-black/85 backdrop-blur-sm flex items-center justify-center p-8`} onMouseDown={() => {
        return V(false);
      }}>
              <Component2775 ref={ae} className={`relative w-[min(1000px,90vw)] h-[80vh] rounded-2xl border border-[#3a3a3a] bg-[#1c1c1c] p-5 shadow-2xl`} onMouseDown={e => {
          return e.stopPropagation();
        }}>
                <Component2773 className={`mb-3 flex items-center justify-between`}>
                  <Component2771 className={`text-sm text-white`}>{`剧情`}</Component2771>
                  <Component2772 className={`p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10`} onClick={() => {
              return V(false);
            }}>
                    <Gt size={16} />
                  </Component2772>
                </Component2773>
                <Component2774 autoFocus={true} value={v} onChange={e => {
            return y(e.target.value);
          }} placeholder={`描述剧情片段、故事，为你生成分镜脚本`} className={`h-[calc(100%-40px)] w-full resize-none rounded-xl border border-[#3a3a3a] bg-[#262626] p-4 text-sm text-gray-200 outline-none custom-scrollbar`} />
                <_cmp__Component23 targetRef={ae} minWidth={520} minHeight={360} />
              </Component2775>
            </Component2776>, document.body)}
        {te && Fn.createPortal(<Component2811 className={`fixed inset-0 z-[2147483647] bg-black/85 backdrop-blur-sm flex items-center justify-center p-6`} onMouseDown={e => {
        return e.stopPropagation();
      }} onWheel={e => {
        return e.stopPropagation();
      }}>
              <Component2810 className={`relative bg-[#1c1c1c] rounded-2xl border border-[#3a3a3a] shadow-2xl flex flex-col`} style={{
          width: `min(900px, 92vw)`,
          height: `86vh`
        }} onClick={e => {
          return e.stopPropagation();
        }}>
                <Component2779 className={`flex items-center justify-between px-5 py-3 border-b border-[#2c2c2c]`}>
                  <Component2777 className={`text-sm text-white`}>{`提示词自定义（留空则用默认）`}</Component2777>
                  <Component2778 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} onClick={() => {
              return z(false);
            }}>
                    <Gt size={16} />
                  </Component2778>
                </Component2779>
                <Component2807 className={`flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5 nowheel`} onWheel={e => {
            return e.stopPropagation();
          }}>
                  <Component2784>
                    <Component2780 className={`mb-1.5 text-xs text-gray-200`}>{`画面比例`}</Component2780>
                    <Component2782 className={`flex flex-wrap gap-2`}>
                      {[`16:9`, `9:16`, `4:3`, `3:4`, `1:1`, `custom`].map(t => {
                  return <Component2781 className={`rounded-md px-3 py-1.5 text-xs ${(d.aspectRatio || `16:9`) === t ? `bg-white text-gray-950` : `bg-[#262626] text-gray-400 hover:text-white`}`} onClick={() => {
                    return r(e, {
                      aspectRatio: t
                    });
                  }} key={t}>
                            {t === `custom` ? `自定义` : t}
                          </Component2781>;
                })}
                    </Component2782>
                    {(d.aspectRatio || `16:9`) === `custom` && <Component2783 value={d.customAspectRatio || ``} onChange={t => {
                return r(e, {
                  customAspectRatio: t.target.value
                });
              }} placeholder={`例如 21:9`} className={`mt-2 w-44 rounded-md border border-[#3a3a3a] bg-[#262626] px-3 py-1.5 text-xs text-gray-200 outline-none`} />}
                  </Component2784>
                  <Component2791 className={`grid grid-cols-2 gap-4`}>
                    <Component2787>
                      <Component2785 className={`mb-1.5 text-xs text-gray-200`}>{`生图强制约束`}</Component2785>
                      <Component2786 value={d.imageGlobalConstraint || ``} onChange={t => {
                  return r(e, {
                    imageGlobalConstraint: t.target.value
                  });
                }} placeholder={`例如：禁止画面文字、水印、边框；人物肢体结构正确……`} className={`min-h-[110px] w-full resize-y rounded-lg border border-[#3a3a3a] bg-[#262626] p-3 text-xs text-gray-200 outline-none`} />
                    </Component2787>
                    <Component2790>
                      <Component2788 className={`mb-1.5 text-xs text-gray-200`}>{`生视频强制约束`}</Component2788>
                      <Component2789 value={d.videoGlobalConstraint ?? [...(d.globalConstraints || []), d.customGlobalConstraint || ``].filter(Boolean).join(`；`)} onChange={t => {
                  return r(e, {
                    videoGlobalConstraint: t.target.value
                  });
                }} placeholder={o_.join(`；`)} className={`min-h-[110px] w-full resize-y rounded-lg border border-[#3a3a3a] bg-[#262626] p-3 text-xs text-gray-200 outline-none`} />
                    </Component2790>
                  </Component2791>
                  <Component2796>
                    <Component2794 className={`flex items-center justify-between mb-1.5`}>
                      <Component2792 className={`text-xs text-gray-200`}>{`剧本生成提示词`}</Component2792>
                      <Component2793 className={`text-[11px] text-gray-500 hover:text-gray-300 nodrag`} onClick={() => {
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
【硬性要求】assets 的 name 必须与 shots 的 description 中 @ 引用的名称完全一致；分镜数量与时长要与剧情体量匹配，叙事连贯、有头有尾。`
                  });
                }}>{`填入默认`}</Component2793>
                    </Component2794>
                    <Component2795 value={d.customScriptPrompt ?? `你是顶级爆款短剧编剧 + 资深影视分镜师，集编剧、导演、制片人视角于一身，精通短剧/网剧/短视频的爆款公式。
你的创作哲学：节奏第一、情绪至上、悬念不断、前3秒定生死、强冲突×高密度爽点×持续悬念×极致情绪。

【创作流程（必须先想清楚再出分镜，禁止直接平铺直叙）】
1. 先在脑中规划一条清晰故事线：明确题材类型、主角的欲望与成长弧线、核心冲突、反派动机；
2. 用「事件→反应→反转→再反应（设局→入局→破局→新局）」组织剧情，保证冲突逐级升级；
3. 按时间结构铺排：开场即冲突锚定 → 情绪爆破 → 反转打脸 → 结尾留悬念钩子；
4. 再把这条故事线拆成连续、有因果递进的分镜，每个分镜承担明确的叙事功能，不要无效镜头、不要重复镜头、不要流水账；
5. 镜头语言要有变化：景别（大远景/全景/中景/近景/特写）与运镜（推/拉/摇/移/跟/升降）按情绪需要切换，关键情绪点用特写。

【输出格式】严格输出一个 JSON 对象（只返回纯 JSON，不要解释、不要 Markdown 代码块）：
{"projectName":"根据故事生成的简洁项目名称，2至8个中文字符，例如：小红帽","globalStyle":"整部片子的统一视觉风格，例如：中世纪童话·皮克斯3D","logline":"一句话故事核心（用于自检，可选）","shots":[{"index":1,"duration":"5s","description":"画面描述：聚焦这一镜要呈现的画面与动作，凡出现 assets 中的角色/场景/道具，必须写成 @名称 形式，例如 @小红帽 走进 @幽暗森林","shotType":"景别","lighting":"光影氛围","dialogue":"该镜对白或旁白（如有）","sound":"音效（如有）","motion":"运镜"}],"assets":[{"category":"character|scene|prop","name":"名称","description":"主体外观描述，详细具体（角色：体型/发型/五官/瞳色/肤色/服装/配饰/神态；场景：环境/前景背景/氛围/光线；道具：形状/材质/颜色/细节），只描述主体本身，不要写构图/视角/布光/负面词，这些由系统自动补全"}]}
【硬性要求】assets 的 name 必须与 shots 的 description 中 @ 引用的名称完全一致；分镜数量与时长要与剧情体量匹配，叙事连贯、有头有尾。`} onChange={t => {
                return r(e, {
                  customScriptPrompt: t.target.value
                });
              }} className={`w-full min-h-[120px] rounded-lg bg-[#262626] border border-[#3a3a3a] px-3 py-2 text-xs text-gray-200 outline-none resize-y custom-scrollbar nowheel`} />
                  </Component2796>
                  <Component2801>
                    <Component2799 className={`flex items-center justify-between mb-1.5`}>
                      <Component2797 className={`text-xs text-gray-200`}>{`分镜/视频提示词生成`}</Component2797>
                      <Component2798 className={`text-[11px] text-gray-500 hover:text-gray-300 nodrag`} onClick={() => {
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

只返回可解析的纯 JSON，不要解释，不要 Markdown，不要在 JSON 前后添加任何文字。`
                  });
                }}>{`填入默认`}</Component2798>
                    </Component2799>
                    <Component2800 value={d.customShotPrompt ?? `你是资深电影导演、分镜设计师、AI绘画与AI视频提示词工程师。根据给定的单个分镜资料，输出一个严格 JSON 对象：
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

只返回可解析的纯 JSON，不要解释，不要 Markdown，不要在 JSON 前后添加任何文字。`} onChange={t => {
                return r(e, {
                  customShotPrompt: t.target.value
                });
              }} className={`w-full min-h-[100px] rounded-lg bg-[#262626] border border-[#3a3a3a] px-3 py-2 text-xs text-gray-200 outline-none resize-y custom-scrollbar nowheel`} />
                  </Component2801>
                  {[[`character`, `角色参考图模板`, `高质量专业角色设定图，横向构图，纯白色纯净背景，中性摄影棚灯光，平光布光；布局结构：正面半身特写 + 全身正面居中 + 左侧面视图 + 背面视图，无任何道具或背景物体。光影：中性摄影棚灯光，柔和的前侧光，清晰的轮廓定义，自然的肤色，面部清晰服装可辨识，平视镜头，完整全身，无裁剪。不得出现任何道具 / 武器 / 食物 / 饮料 / 手持物（角色空手）；不得出现复杂动作、夸张表情、面部遮挡；不得出现环境背景（仅白色）；不得出现其他角色；确保所有视图中的面部特征、发型、体型和服装保持一致；不得出现文字、水印、标签、UI元素；无背景场景，无过度风格化。`], [`scene`, `场景参考图模板`, `高质量专业场景设定图，横向构图，以 2 行 2 列的干净网格四等分整齐排版，每个格子都是独立的 16:9 横向画面，展示同一场景的四个大全景视角（1为正面中心线大全景视图，镜头正对场景中心轴，构图严格居中，画面同时包含顶面与底面，尽量展示完整空间层次、更多环境细节和深景深；2以1的中心线为参考，摄像机移动到场景左前方45度位置的大全景视图，镜头仍对准场景核心区域；3为以1的中心线为参考，摄像机移动到场景右前方45度位置的大全景视图；4为镜头在室内最深处向外拍摄的正中心全景图。四个视角必须表现同一地点、同一时间、同一天气、同一光源、同一空间结构和同一美术风格。环境清晰，细节丰富，景深较深，光影自然，专业摄影，超清画质。不得出现任何人物（这是空场景参考图），也不得出现人群、背影、剪影、人脸、手脚、人物倒影、人物影子、照片人物、屏幕人物、镜中人物、剧情事件、人物活动；不得让四个视角表现成四个不同场景；不得改变建筑结构、空间比例、主体位置、材质、色彩、天气、时间段或光源方向；画面构图不得倾斜、透视畸变、广角畸变、变形、扭曲；不得出现鱼眼视角、斜角、极端俯视、极端仰视；正面视图必须居中、对称、中心线构图；左前方 45 度、右前方 45 度和背后视角必须保持镜头稳定、空间连贯、比例一致；禁止模糊、低画质；禁止景深太浅；不得出现文字、水印、签名、边框、标签、UI元素、杂乱元素。`], [`prop`, `道具参考图模板`, `高质量写实道具多角度展示图，横向构图，以 2 行 3 列的干净网格整齐排版，展示道具的六个极正视角。纯白色纯净背景，专业产品影棚摄影，标准六视图参考。六视图包括：绝对正前方视图、绝对正后方视图、绝对左侧视图、绝对右侧视图、绝对正上方俯拍视图、绝对正下方仰拍视图。所有视图必须是同一件道具，材质、颜色、比例、结构完全一致。使用超长焦镜头或移轴镜头效果，将透视变形降到最低，物体所有本该平行的边缘在画面中保持平行，接近正交投影。每个视图都像在专业产品影棚中用三脚架精密校准拍摄，构图绝对端正，物体在每个格子中居中，无任何倾斜、旋转或透视畸变。画面出不得出现任何人物、角色、人群、人影等；不得出现手、脚、人脸、场景、建筑、自然景观；无其他道具；无文字、无水印、无 logo、无 UI 元素，不要任何剧情事件，保持道具本体清晰、保持完整轮廓、保持所有角度的材质和结构一致。`]].map(([t, n, i]) => {
              return <Component2806 key={t}>
                        <Component2804 className={`flex items-center justify-between mb-1.5`}>
                          <Component2802 className={`text-xs text-gray-300`}>{n}</Component2802>
                          <Component2803 className={`text-[11px] text-gray-500 hover:text-gray-300 nodrag`} onClick={() => {
                    return r(e, {
                      customAssetTemplates: {
                        ...(d.customAssetTemplates || {}),
                        [t]: i
                      }
                    });
                  }}>{`填入默认`}</Component2803>
                        </Component2804>
                        <Component2805 value={d.customAssetTemplates?.[t] ?? i} onChange={n => {
                  return r(e, {
                    customAssetTemplates: {
                      ...(d.customAssetTemplates || {}),
                      [t]: n.target.value
                    }
                  });
                }} className={`w-full min-h-[90px] rounded-lg bg-[#262626] border border-[#3a3a3a] px-3 py-2 text-xs text-gray-200 outline-none resize-y custom-scrollbar nowheel`} />
                      </Component2806>;
            })}
                </Component2807>
                <Component2809 className={`flex justify-end gap-2 px-5 py-3 border-t border-[#2c2c2c]`}>
                  <Component2808 className={`px-4 py-1.5 rounded-lg bg-gray-100 text-gray-950 text-xs font-medium hover:bg-white`} onClick={() => {
              return z(false);
            }}>{`完成`}</Component2808>
                </Component2809>
              </Component2810>
            </Component2811>, document.body)}
        {oe && Fn.createPortal(<Component2814 className={`fixed inset-0 z-[2147483647] bg-black/90 flex items-center justify-center p-6 cursor-zoom-out`} onMouseDown={e => {
        return e.stopPropagation();
      }} onWheel={e => {
        return e.stopPropagation();
      }} onClick={() => {
        return H(null);
      }}>
              <Component2812 className={`absolute top-4 right-4 p-2 text-white hover:text-gray-300 bg-black/50 rounded-full`} onClick={e => {
          e.stopPropagation();
          H(null);
        }}>
                <Gt size={20} />
              </Component2812>
              <Component2813 src={oe} alt={`预览`} className={`max-w-[92vw] max-h-[88vh] object-contain`} onClick={e => {
          return e.stopPropagation();
        }} />
            </Component2814>, document.body)}
        {U && Fe.current && <_cmp__Component118 isOpen={true} onClose={() => {
        return W(false);
      }} transitResources={d.transitResources || []} canvasNodes={a()} defaultMediaType={`image`} onSelect={e => {
        J(Fe.current, {
          imageUrl: e
        });
        W(false);
      }} />}
        {em && (() => {
        const Component2425 = `div`;
        const Component2426 = `div`;
        const Component2427 = `div`;
        const Component2428 = `div`;
        const Component2429 = `button`;
        const Component2430 = `textarea`;
        const Component2431 = `div`;
        const Component2432 = `div`;
        const Component2433 = `div`;
        const Component2434 = `button`;
        const Component2435 = `div`;
        const Component2436 = `button`;
        const Component2437 = `button`;
        // [自研·自包含 CSS] 不用 Tailwind 任意值类，样式由下方 <style> 注入的 shotedit-* 语义类承载（见 docs/01 新建自研 SOP）
        const SHOTEDIT_CSS = `.shotedit-overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.85);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:24px}.shotedit-panel{position:relative;width:860px;max-width:94vw;max-height:90vh;overflow-y:auto;border-radius:16px;border:1px solid #3a3a3a;background:#1c1c1c;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.6);display:flex;flex-direction:column}.shotedit-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.shotedit-title{font-size:14px;color:#fff}.shotedit-head-actions{display:flex;align-items:center;gap:8px}.shotedit-close{padding:6px;border-radius:8px;color:#9ca3af;cursor:pointer;background:none;border:none}.shotedit-close:hover{color:#fff;background:rgba(255,255,255,.1)}.shotedit-format{padding:5px 12px;border-radius:8px;color:#93c5fd;background:rgba(59,130,246,.12);border:1px solid rgba(59,130,246,.35);font-size:12px;font-weight:500;cursor:pointer}.shotedit-format:hover{background:rgba(59,130,246,.22);color:#bfdbfe}.shotedit-area{width:100%;min-height:480px;max-height:75vh;height:60vh;resize:vertical;border-radius:8px;border:1px solid #3a3a3a;background:#262626;padding:14px 16px;font-size:15px;color:#e5e7eb;outline:none;box-sizing:border-box;font-family:inherit;line-height:2;letter-spacing:.3px}.shotedit-assets{margin-top:8px}.shotedit-assets-title{font-size:10px;color:#6b7280;margin-bottom:4px}.shotedit-assets-list{display:flex;flex-wrap:wrap;gap:4px}.shotedit-asset{padding:2px 8px;font-size:11px;color:#d1d5db;cursor:pointer;background:none;border:none}.shotedit-asset:hover{color:#fff;background:#2a2a2a}.shotedit-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.shotedit-save{padding:6px 16px;border-radius:8px;background:#f3f4f6;color:#111;font-size:12px;font-weight:500;cursor:pointer;border:none}.shotedit-save:hover{background:#fff}`;
        return Fn.createPortal(<>
          <style>{SHOTEDIT_CSS}</style>
          <Component2425 className={`shotedit-overlay`} onMouseDown={e => {
          return e.stopPropagation();
        }} onWheel={e => {
          return e.stopPropagation();
        }}>
              <Component2426 className={`shotedit-panel`} onClick={e => {
            return e.stopPropagation();
          }}>
                <Component2427 className={`shotedit-head`}>
                  <Component2428 className={`shotedit-title`}>{({ description: `画面描述`, prompt: `生图提示词`, videoPrompt: `生视频提示词` })[em.field] || em.field}</Component2428>
                  <div className={`shotedit-head-actions`}>
                    <Component2437 className={`shotedit-format nodrag`} title={`把长段落按句/逗号拆成多行，方便逐句阅读修改`} onClick={() => {
                return ems(o => {
                  if (!o) return o;
                  let s = o.value || ``;
                  // [自研·一键排版] 先按句号类标点拆行；单行仍过长(>60字)再按中文逗号二次拆。保留标点在行尾，忽略已换行，过滤空行。不破坏 @资产名 引用。
                  let lines = s.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                  let out = [];
                  for (let line of lines) {
                    // 按句号/感叹/问号/分号切分，分隔符留在行尾
                    let segs = line.split(/(?<=[。！？；])/).map(x => x.trim()).filter(Boolean);
                    if (segs.length <= 1 && line.length > 60) {
                      // 无句号分隔的超长句 → 按中文逗号切分
                      segs = line.split(/(?<=[，,])/).map(x => x.trim()).filter(Boolean);
                    }
                    out.push(...segs);
                  }
                  return { ...o, value: out.join(`\n`) };
                });
              }}>{`一键排版`}</Component2437>
                    <Component2429 className={`shotedit-close nodrag`} onClick={() => {
                return ems(null);
              }}>
                      <Gt size={16} />
                    </Component2429>
                  </div>
                </Component2427>
                <Component2430 ref={emRef} autoFocus={true} value={em.value || ``} onChange={n => {
              return ems(o => {
                return {
                  ...o,
                  value: n.target.value
                };
              });
            }} onKeyDown={n => {
              if (n.key === `Escape`) {
                return ems(null);
              }
              if (n.key === `Enter` && (n.metaKey || n.ctrlKey)) {
                n.preventDefault();
                return ems(o => {
                  if (o) {
                    He(o.shotId, {
                      [o.field]: o.value
                    });
                  }
                  return null;
                });
              }
            }} placeholder={`输入或修改该${({ description: `画面描述`, prompt: `生图提示词`, videoPrompt: `生视频提示词` })[em.field] || ``}，可直接键入 @资产名 引用资产`} className={`shotedit-area`} />
                {p.length > 0 && <Component2431 className={`shotedit-assets`}>
                    <Component2432 className={`shotedit-assets-title`}>{`点资产名插入 @引用`}</Component2432>
                    <Component2433 className={`shotedit-assets-list`}>
                      {p.map(n => {
                return <Component2434 className={`shotedit-asset nodrag`} onClick={() => {
                  let r = emRef.current;
                  let o = em.value || ``;
                  let a = r ? r.selectionStart : o.length;
                  let s = `${o.slice(0, a)}@${n.name} ${o.slice(a)}`;
                  ems(x => {
                    return {
                      ...x,
                      value: s
                    };
                  });
                  if (r) {
                    requestAnimationFrame(() => {
                      r.focus();
                      let c = a + n.name.length + 2;
                      r.setSelectionRange(c, c);
                    });
                  }
                }} key={n.id}>
                          {r_[n.category]}
                          {` `}
                          {n.name}
                        </Component2434>;
              })}
                    </Component2433>
                  </Component2431>}
                <Component2435 className={`shotedit-foot`}>
                  <Component2436 className={`shotedit-save nodrag`} onClick={() => {
                ems(o => {
                  if (o) {
                    He(o.shotId, {
                      [o.field]: o.value
                    });
                  }
                  return null;
                });
              }}>{`保存 (Ctrl+Enter)`}</Component2436>
                </Component2435>
              </Component2426>
            </Component2425>
        </>, document.body);
      })()}
      </Component2815>;
  }
});
export default c_;