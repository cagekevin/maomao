// TODO(全局, 无需 import): data, selected, r, i, updateNodeData, handleType, o, l, n, x, p, extractedImages, rows, ee, cols, gridSize, splitMode, hLines, vLines, lassoShapes, s, u, v, f, titlePattern, sendToImageBox, z, m, g, points, closed, b, lastX, lastY, k, cx, cy, cursor, ae, left, width, height, transform, right, minWidth, minHeight, type, index, oe, me, fe, de, le, aspectRatio
import _cmp_Ti from "./Ti.jsx";
import _cmp__Component10 from "./_Component10.jsx";
import _cmp_qo from "./qo.jsx";
import { id, zo, nn, We, Qt, Lt, e, P, d, y, w, h, Bo, _, I, L, M, N, R, c, te, Ro, C, D, re, B, H, ie, V, Wo, j, Vo, A, Go, X, Ho, W, ue, ne, U, G, Lo, T, E, pe, ce, S, Fn, Et, K, O, St, Se, Kt, _Component25, Ke, Ot, _Component26, _Component21, Gt } from "./shared.js";
import * as _shared from "./shared.js";
import * as Z from "react";
import * as Q from "react";
var Jo = Z.memo(({
  id: e,
  data: t,
  selected: n
}) => {
  let r = typeof t.gridSize == `number` ? t.gridSize : undefined;
  let i = t.rows ?? r ?? 3;
  let a = t.cols ?? r ?? 3;
  let [o, c] = Z.useState(t.splitMode || `grid`);
  let [l, u] = Z.useState(i);
  let [d, f] = Z.useState(a);
  let [p, m] = Z.useState(Array.isArray(t.hLines) ? zo(t.hLines) : [0.5]);
  let [h, g] = Z.useState(Array.isArray(t.vLines) ? zo(t.vLines) : [0.5]);
  let [_, v] = Z.useState(Array.isArray(t.lassoShapes) ? t.lassoShapes : []);
  let [y, b] = Z.useState(null);
  let [x, S] = Z.useState(t.titlePattern || `#{num}`);
  let [C, w] = Z.useState(t.sendToImageBox ?? false);
  let [T, E] = Z.useState(false);
  let [D, k] = Z.useState(false);
  let [A, j] = Z.useState(null);
  let M = nn();
  let {
    updateNodeData: N
  } = We();
  let P = Qt(Lt({
    handleType: `target`
  }).map(e => {
    return e.source;
  }));
  let F = t.imageUrl;
  if (!F && P) {
    let e = (Array.isArray(P) ? P : [P]).find(e => {
      return e?.data?.imageUrl;
    });
    if (e) {
      F = e.data.imageUrl;
    }
  }
  let I = Z.useMemo(() => {
    if (o === `grid`) {
      let e = 1 / d;
      let t = 1 / l;
      let n = [];
      for (let r = 0; r < l; r++) {
        for (let i = 0; i < d; i++) {
          n.push({
            x: i * e,
            y: r * t,
            w: e,
            h: t
          });
        }
      }
      return n;
    }
    if (o === `manual`) {
      let e = Bo(h);
      let t = Bo(p);
      let n = [];
      for (let [r, i] of t) {
        for (let [t, a] of e) {
          n.push({
            x: t,
            y: r,
            w: a - t,
            h: i - r
          });
        }
      }
      return n;
    }
    return [];
  }, [o, l, d, p, h]);
  let L = o === `lasso` ? _.filter(e => {
    return e.closed && e.points.length >= 3;
  }).length : I.length;
  let ee = o === `grid` ? l : o === `manual` ? p.length + 1 : 1;
  let R = o === `grid` ? d : o === `manual` ? h.length + 1 : L;
  let te = Z.useRef(null);
  Z.useEffect(() => {
    M(e);
  }, [L, e, M]);
  Z.useEffect(() => {
    if (o === `lasso`) {
      return;
    }
    if (!F) {
      N(e, {
        extractedImages: [],
        rows: ee,
        cols: R,
        gridSize: Math.max(ee, R),
        splitMode: o,
        hLines: p,
        vLines: h,
        lassoShapes: _
      });
      return;
    }
    let t = false;
    (async () => {
      try {
        let n = new Image();
        n.crossOrigin = `anonymous`;
        n.src = F;
        await new Promise(e => {
          n.onload = e;
          n.onerror = () => {
            let t = new Image();
            t.src = F;
            t.onload = () => {
              return e(null);
            };
            t.onerror = () => {
              return e(null);
            };
          };
        });
        let r = n.width;
        let i = n.height;
        let a = [];
        for (let e of I) {
          let t = e.x * r;
          let o = e.y * i;
          let s = e.w * r;
          let c = e.h * i;
          let l = document.createElement(`canvas`);
          l.width = Math.max(1, Math.round(s));
          l.height = Math.max(1, Math.round(c));
          let u = l.getContext(`2d`);
          if (u) {
            u.drawImage(n, t, o, s, c, 0, 0, l.width, l.height);
            a.push(l.toDataURL(`image/jpeg`, 0.85));
          } else {
            a.push(null);
          }
        }
        if (!t) {
          N(e, {
            extractedImages: a,
            rows: ee,
            cols: R,
            gridSize: Math.max(ee, R),
            splitMode: o,
            hLines: p,
            vLines: h,
            lassoShapes: _
          });
        }
      } catch (e) {
        console.error(`Failed to pre-crop images:`, e);
      }
    })();
    return () => {
      t = true;
    };
  }, [F, I, ee, R, o, p, h, _, e, N]);
  Z.useEffect(() => {
    if (o !== `lasso` || te.current) {
      return;
    }
    if (!F) {
      N(e, {
        extractedImages: [],
        rows: 1,
        cols: 0,
        gridSize: 1,
        splitMode: o,
        hLines: p,
        vLines: h,
        lassoShapes: _
      });
      return;
    }
    let t = false;
    (async () => {
      let n = _.filter(e => {
        return e.closed && e.points.length >= 3;
      });
      let r = [];
      for (let e of n) {
        let n = await _cmp_qo(F, e);
        r.push(n);
        if (t) {
          return;
        }
      }
      if (!t) {
        N(e, {
          extractedImages: r,
          rows: 1,
          cols: n.length,
          gridSize: Math.max(1, n.length),
          splitMode: o,
          hLines: p,
          vLines: h,
          lassoShapes: _
        });
      }
    })();
    return () => {
      t = true;
    };
  }, [F, _, o, p, h, e, N]);
  Z.useEffect(() => {
    if (te.current) {
      return;
    }
    let e = t.lassoShapes;
    if (Array.isArray(e) && JSON.stringify(e) !== JSON.stringify(_)) {
      v(e);
    }
  }, [t.lassoShapes]);
  Z.useEffect(() => {
    let e = t.rows;
    if (typeof e == `number` && e !== l) {
      u(Ro(e, 1, 20));
    }
  }, [t.rows]);
  Z.useEffect(() => {
    let e = t.cols;
    if (typeof e == `number` && e !== d) {
      f(Ro(e, 1, 20));
    }
  }, [t.cols]);
  Z.useEffect(() => {
    let e = t.splitMode;
    if (e && e !== o) {
      c(e);
    }
  }, [t.splitMode]);
  Z.useEffect(() => {
    N(e, {
      titlePattern: x,
      sendToImageBox: C
    });
  }, [x, C, e, N]);
  let z = Lt({
    handleType: `source`
  });
  let ne = Z.useMemo(() => {
    return new Set(z.filter(e => {
      return e.sourceHandle?.startsWith(`cell-`);
    }).map(e => {
      return parseInt(e.sourceHandle.replace(`cell-`, ``), 10);
    }));
  }, [z]);
  let B = Z.useRef(null);
  let re = Z.useRef(null);
  let V = Z.useCallback(() => {
    if (o === `lasso` && D && re.current) {
      return re.current;
    } else {
      return B.current;
    }
  }, [o, D]);
  let [H, ie] = Z.useState(null);
  Z.useEffect(() => {
    if (H) {
      return;
    }
    let e = t.hLines;
    if (Array.isArray(e) && JSON.stringify(e) !== JSON.stringify(p)) {
      m(zo(e));
    }
  }, [t.hLines]);
  Z.useEffect(() => {
    if (H) {
      return;
    }
    let e = t.vLines;
    if (Array.isArray(e) && JSON.stringify(e) !== JSON.stringify(h)) {
      g(zo(e));
    }
  }, [t.vLines]);
  Z.useEffect(() => {
    if (!H) {
      return;
    }
    let e = e => {
      let t = B.current;
      if (!t) {
        return;
      }
      let n = t.getBoundingClientRect();
      if (H.type === `h`) {
        let t = Ro((e.clientY - n.top) / n.height, 0.01, 0.99);
        m(e => {
          return zo(e.map((e, n) => {
            if (n === H.index) {
              return t;
            } else {
              return e;
            }
          }));
        });
      } else {
        let t = Ro((e.clientX - n.left) / n.width, 0.01, 0.99);
        g(e => {
          return zo(e.map((e, n) => {
            if (n === H.index) {
              return t;
            } else {
              return e;
            }
          }));
        });
      }
    };
    let t = () => {
      return ie(null);
    };
    window.addEventListener(`mousemove`, e);
    window.addEventListener(`mouseup`, t);
    return () => {
      window.removeEventListener(`mousemove`, e);
      window.removeEventListener(`mouseup`, t);
    };
  }, [H]);
  let ae = Z.useCallback(e => {
    if (o !== `manual`) {
      return;
    }
    e.stopPropagation();
    let t = B.current;
    if (!t) {
      return;
    }
    let n = t.getBoundingClientRect();
    let r = (e.clientX - n.left) / n.width;
    let i = (e.clientY - n.top) / n.height;
    if (e.shiftKey) {
      g(e => {
        return zo([...e, r]);
      });
    } else {
      m(e => {
        return zo([...e, i]);
      });
    }
  }, [o]);
  let U = e => {
    return m(t => {
      return t.filter((t, n) => {
        return n !== e;
      });
    });
  };
  let oe = e => {
    return g(t => {
      return t.filter((t, n) => {
        return n !== e;
      });
    });
  };
  let W = Z.useCallback(e => {
    if (o !== `lasso`) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    let t = V();
    if (!t) {
      return;
    }
    let n = t.getBoundingClientRect();
    let r = Wo({
      x: Ro((e.clientX - n.left) / n.width, 0, 1),
      y: Ro((e.clientY - n.top) / n.height, 0, 1)
    });
    j(r.edge);
    let i = Vo();
    v(e => {
      return [...e, {
        id: i,
        points: [{
          x: r.x,
          y: r.y
        }],
        closed: false
      }];
    });
    b(i);
    te.current = {
      id: i,
      lastX: r.x,
      lastY: r.y
    };
  }, [o, V]);
  Z.useEffect(() => {
    if (o !== `lasso`) {
      return;
    }
    let e = e => {
      let t = te.current;
      if (!t) {
        return;
      }
      let n = V();
      if (!n) {
        return;
      }
      let r = n.getBoundingClientRect();
      let i = Ro((e.clientX - r.left) / r.width, 0, 1);
      let a = Ro((e.clientY - r.top) / r.height, 0, 1);
      let o = i - t.lastX;
      let s = a - t.lastY;
      if (!(o * o + s * s < 0.0006)) {
        t.lastX = i;
        t.lastY = a;
        v(e => {
          return e.map(e => {
            if (e.id === t.id) {
              return {
                ...e,
                points: [...e.points, {
                  x: i,
                  y: a
                }]
              };
            } else {
              return e;
            }
          });
        });
      }
    };
    let t = () => {
      let e = te.current;
      if (!e) {
        return;
      }
      te.current = null;
      let t = A;
      j(null);
      v(n => {
        return n.map(n => {
          if (n.id !== e.id || n.points.length < 3) {
            return n;
          }
          let r = n.points[n.points.length - 1];
          let i = Wo(r);
          let a = n.points.slice();
          if (i.edge) {
            a[a.length - 1] = {
              x: i.x,
              y: i.y
            };
          }
          if (t && i.edge) {
            a = Go(a, t, i.edge);
          }
          return {
            ...n,
            points: a,
            closed: true
          };
        }).filter(t => {
          return t.id !== e.id || !(t.points.length < 3);
        });
      });
    };
    window.addEventListener(`mousemove`, e);
    window.addEventListener(`mouseup`, t);
    return () => {
      window.removeEventListener(`mousemove`, e);
      window.removeEventListener(`mouseup`, t);
    };
  }, [o, A, V]);
  let G = e => {
    v(t => {
      return t.filter(t => {
        return t.id !== e;
      });
    });
    if (y === e) {
      b(null);
    }
  };
  let ce = () => {
    v([]);
    b(null);
  };
  Z.useEffect(() => {
    if (!D) {
      return;
    }
    let e = e => {
      if (e.key === `Escape`) {
        k(false);
      }
    };
    window.addEventListener(`keydown`, e);
    return () => {
      return window.removeEventListener(`keydown`, e);
    };
  }, [D]);
  let le = Z.useCallback(n => {
    n.stopPropagation();
    if (!F) {
      return;
    }
    let r = {
      rows: ee,
      cols: R,
      titlePattern: x,
      splitMode: o,
      hLines: p,
      vLines: h,
      sendToImageBox: C
    };
    if ((o === `manual` || o === `lasso`) && typeof t.onSplitManual == `function`) {
      let n = (t.extractedImages || []).filter(e => {
        return typeof e == `string` && !!e;
      });
      t.onSplitManual(e, n, x, r);
      return;
    }
    if (typeof t.onSplit == `function`) {
      t.onSplit(e, F, ee, R, x, r);
    }
  }, [t, e, F, ee, R, x, C, o, p, h]);
  let ue = Z.useCallback(n => {
    if (!F) {
      return;
    }
    let r = x.replace(`{num}`, (n + 1).toString());
    let i = {
      rows: ee,
      cols: R,
      splitMode: o,
      sendToImageBox: C
    };
    if ((o === `manual` || o === `lasso`) && typeof t.onSplitOneManual == `function`) {
      let a = (t.extractedImages || [])[n];
      if (a) {
        t.onSplitOneManual(e, a, n, r, i);
        return;
      }
    }
    if (typeof t.onSplitOne == `function`) {
      t.onSplitOne(e, F, ee, R, n, r, i);
    }
  }, [t, e, F, ee, R, x, C, o]);
  let de = (e, t) => {
    u(e);
    f(t);
  };
  let fe = (e, t) => {
    return l === e && d === t;
  };
  let pe = () => {
    m([0.5]);
    g([0.5]);
  };
  let me = Z.useMemo(() => {
    return _.filter(e => {
      return e.closed && e.points.length >= 3;
    }).map(e => {
      let t = e.points.length;
      let n = 0;
      let r = 0;
      for (let t of e.points) {
        n += t.x;
        r += t.y;
      }
      return {
        id: e.id,
        cx: n / t,
        cy: r / t
      };
    });
  }, [_]);
  const Component487 = `button`;
  const Component488 = `button`;
  const Component489 = `button`;
  const Component490 = `div`;
  const Component491 = `div`;
  const Component492 = `img`;
  const Component493 = `span`;
  const Component494 = `div`;
  const Component495 = `div`;
  const Component496 = `div`;
  const Component497 = `div`;
  const Component498 = `div`;
  const Component499 = `div`;
  const Component501 = `svg`;
  const Component502 = `span`;
  const Component503 = `button`;
  const Component504 = `div`;
  const Component505 = `div`;
  const Component506 = `div`;
  const Component507 = `div`;
  const Component508 = `div`;
  const Component509 = `div`;
  const Component510 = `span`;
  const Component511 = `div`;
  const Component512 = `button`;
  const Component513 = `button`;
  const Component514 = `div`;
  const Component515 = `span`;
  const Component516 = `input`;
  const Component517 = `span`;
  const Component518 = `span`;
  const Component519 = `input`;
  const Component520 = `div`;
  const Component521 = `span`;
  const Component522 = `button`;
  const Component523 = `div`;
  const Component524 = `span`;
  const Component525 = `button`;
  const Component526 = `button`;
  const Component527 = `div`;
  const Component528 = `div`;
  const Component529 = `input`;
  const Component530 = `div`;
  const Component531 = `input`;
  const Component532 = `span`;
  const Component533 = `label`;
  const Component534 = `span`;
  const Component535 = `button`;
  const Component536 = `div`;
  const Component537 = `div`;
  const Component538 = `div`;
  const Component539 = `div`;
  const Component540 = `div`;
  const Component541 = `span`;
  const Component542 = `span`;
  const Component543 = `div`;
  const Component544 = `button`;
  const Component545 = `button`;
  const Component546 = `div`;
  const Component547 = `div`;
  const Component548 = `img`;
  const Component550 = `svg`;
  const Component551 = `span`;
  const Component552 = `button`;
  const Component553 = `div`;
  const Component554 = `div`;
  const Component555 = `div`;
  const Component556 = `div`;
  const Component557 = `div`;
  const Component558 = `div`;
  const Component559 = `div`;
  return <Component559 className={`relative flex flex-col`}>
      <Component491 className={`mb-1 flex items-center justify-between gap-2 w-[280px]`}>
        <_cmp_Ti id={e} data={t} defaultTitle={`图像切分`} icon={<Et size={11} className={`text-gray-500`} />} className={`!mb-0`} />
        <Component490 className={`flex items-center gap-1 nodrag`}>
          <Component487 className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 border transition-colors ${o === `grid` ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white`}`} onClick={() => {
          return c(`grid`);
        }} title={`规则网格`}>
            <K size={11} />
            {` 规则`}
          </Component487>
          <Component488 className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 border transition-colors ${o === `manual` ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white`}`} onClick={() => {
          return c(`manual`);
        }} title={`手动网格 (拖动切割线)`}>
            <O size={11} />
            {` 手动`}
          </Component488>
          <Component489 className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 border transition-colors ${o === `lasso` ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white`}`} onClick={() => {
          return c(`lasso`);
        }} title={`手动切刀 (任意形状 + 透明通道)`}>
            <St size={11} />
            {` 切刀`}
          </Component489>
        </Component490>
      </Component491>
      <Component540 className={`relative bg-[#1c1c1c] rounded-xl border shadow-xl transition-all duration-300 w-[280px] ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}>
        <_cmp__Component10 type={`target`} position={X.Left} variant={`small`} />
        <_cmp__Component10 type={`source`} position={X.Right} id={`batch`} variant={`small`} />
        <Component539 className={`p-3 space-y-3 relative z-10 bg-[#1c1c1c] rounded-xl`}>
          {F ? <Component509 className={`relative w-full`}>
              <Component506 className={`relative w-full rounded bg-black/50 overflow-hidden shadow-inner`}>
                <Component492 src={F} alt={`Source`} loading={`lazy`} decoding={`async`} className={`w-full h-auto block opacity-80 select-none pointer-events-none`} draggable={false} />
                <Component505 ref={B} className={`absolute inset-0 nodrag`} style={o === `lasso` ? {
              cursor: Ho
            } : undefined} onDoubleClick={ae} onMouseDown={W} title={o === `manual` ? `双击空白加水平线，Shift+双击加垂直线；拖动线移动；Shift+点击线删除` : o === `lasso` ? `按住拖动绘制不规则形状，松开自动闭合；起/终点贴近边时自动吸附` : ``}>
                  {o !== `lasso` && I.map((e, t) => {
                return <Component495 className={`absolute border border-white/20 hover:bg-blue-500/30 hover:border-blue-400 active:bg-blue-500/50 transition-all cursor-pointer rounded-[1px] group/cell`} style={{
                  left: `${e.x * 100}%`,
                  top: `${e.y * 100}%`,
                  width: `${e.w * 100}%`,
                  height: `${e.h * 100}%`
                }} onClick={e => {
                  e.stopPropagation();
                  ue(t);
                }} title={`点击切出: ${x.replace(`{num}`, (t + 1).toString())}`} key={t}>
                          <Component493 className={`absolute top-0.5 left-0.5 text-[8px] text-white/90 bg-black/50 px-1 rounded-sm font-mono pointer-events-none scale-75 origin-top-left backdrop-blur-[1px]`}>
                            {t + 1}
                          </Component493>
                          {ne.has(t) && <Component494 className={`absolute inset-0 flex items-center justify-center pointer-events-none`}>
                              <Se size={16} className={`text-green-500 drop-shadow-md bg-black/30 rounded-full p-0.5`} />
                            </Component494>}
                          <Kt type={`source`} position={X.Right} id={`cell-${t}`} className={`!opacity-0 group-hover/cell:!opacity-100 !w-1.5 !h-1.5 !bg-blue-500 !border-[1px] !border-white !rounded-full transition-opacity cursor-crosshair z-[100]`} style={{
                    top: `50%`,
                    left: `50%`,
                    transform: `translate(-50%, -50%)`,
                    right: `auto`,
                    minWidth: `6px`,
                    minHeight: `6px`
                  }} />
                        </Component495>;
              })}
                  {o === `manual` && <Q.Fragment>
                      {p.map((e, t) => {
                  return <Component497 className={`absolute left-0 right-0 cursor-row-resize z-[80]`} style={{
                    top: `calc(${e * 100}% - 5px)`,
                    height: 10
                  }} onMouseDown={e => {
                    e.stopPropagation();
                    ie({
                      type: `h`,
                      index: t
                    });
                  }} onClick={e => {
                    if (e.shiftKey) {
                      e.stopPropagation();
                      U(t);
                    }
                  }} title={`拖动调整位置 / Shift+点击删除`} key={`h-${t}`}>
                            <Component496 className={`absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-blue-400/90 shadow-[0_0_4px_rgba(59,130,246,0.8)]`} />
                          </Component497>;
                })}
                      {h.map((e, t) => {
                  return <Component499 className={`absolute top-0 bottom-0 cursor-col-resize z-[80]`} style={{
                    left: `calc(${e * 100}% - 5px)`,
                    width: 10
                  }} onMouseDown={e => {
                    e.stopPropagation();
                    ie({
                      type: `v`,
                      index: t
                    });
                  }} onClick={e => {
                    if (e.shiftKey) {
                      e.stopPropagation();
                      oe(t);
                    }
                  }} title={`拖动调整位置 / Shift+点击删除`} key={`v-${t}`}>
                            <Component498 className={`absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-blue-400/90 shadow-[0_0_4px_rgba(59,130,246,0.8)]`} />
                          </Component499>;
                })}
                    </Q.Fragment>}
                  {o === `lasso` && <Component501 className={`absolute inset-0 w-full h-full pointer-events-none`} viewBox={`0 0 100 100`} preserveAspectRatio={`none`}>
                      {_.map(e => {
                  if (e.points.length < 2) {
                    return null;
                  }
                  let t = e.points.map((e, t) => {
                    return `${t === 0 ? `M` : `L`} ${e.x * 100} ${e.y * 100}`;
                  }).join(` `) + (e.closed ? ` Z` : ``);
                  let n = e.id === y;
                  const Component500 = `path`;
                  return <Component500 d={t} fill={e.closed ? n ? `rgba(59,130,246,0.35)` : `rgba(59,130,246,0.18)` : `none`} stroke={n ? `#60a5fa` : `#3b82f6`} strokeWidth={0.4} vectorEffect={`non-scaling-stroke`} key={e.id} />;
                })}
                    </Component501>}
                  {o === `lasso` && me.map((e, t) => {
                return <Component504 className={`absolute -translate-x-1/2 -translate-y-1/2 group/cell`} style={{
                  left: `${e.cx * 100}%`,
                  top: `${e.cy * 100}%`
                }} key={e.id}>
                          <Component503 className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono cursor-pointer border ${y === e.id ? `bg-blue-500 text-white border-blue-300` : `bg-black/70 text-white border-white/30 hover:bg-blue-500/80`}`} onClick={n => {
                    n.stopPropagation();
                    if (n.shiftKey) {
                      G(e.id);
                      return;
                    }
                    b(e.id);
                    ue(t);
                  }} title={`点击切出 / Shift+点击删除`}>
                            <Component502>{t + 1}</Component502>
                            {ne.has(t) && <Se size={10} className={`text-green-400`} />}
                          </Component503>
                          <Kt type={`source`} position={X.Right} id={`cell-${t}`} className={`!opacity-0 group-hover/cell:!opacity-100 !w-1.5 !h-1.5 !bg-blue-500 !border-[1px] !border-white !rounded-full transition-opacity cursor-crosshair z-[100]`} style={{
                    top: `50%`,
                    left: `50%`,
                    transform: `translate(-50%, -50%)`,
                    right: `auto`,
                    minWidth: `6px`,
                    minHeight: `6px`
                  }} />
                        </Component504>;
              })}
                </Component505>
              </Component506>
              {o === `manual` && <Component507 className={`mt-1 text-[10px] text-gray-500 leading-tight`}>{`双击空白加水平线，Shift+双击加垂直线；拖动线移动；Shift+点击线删除。`}</Component507>}
              {o === `lasso` && <Component508 className={`mt-1 text-[10px] text-gray-500 leading-tight`}>{`按住鼠标在图上画一圈即可生成一个透明形状，可以画多个；点击编号切出当前块，Shift+点击删除。`}</Component508>}
            </Component509> : <Component511 className={`h-24 flex flex-col items-center justify-center text-gray-600 bg-[#151515] rounded border border-dashed border-[#333]`}>
              <Component510 className={`text-xs`}>{`请连接图片`}</Component510>
            </Component511>}
          <Component538 className={`space-y-2 nodrag`}>
            {o === `grid` && <Q.Fragment>
                <Component514 className={`flex flex-wrap items-center gap-1`}>
                  {Lo.map(e => {
                return <Component512 className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${fe(e.rows, e.cols) ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white hover:border-[#555]`}`} onClick={() => {
                  return de(e.rows, e.cols);
                }} title={`${e.rows} 行 × ${e.cols} 列`} key={e.label}>
                        {e.label}
                      </Component512>;
              })}
                  <Component513 className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${T ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white hover:border-[#555]`}`} onClick={() => {
                return E(e => {
                  return !e;
                });
              }}>{`自定义`}</Component513>
                </Component514>
                {T && <Component520 className={`flex items-center gap-1.5 text-[10px] text-gray-400`}>
                    <Component515>{`行`}</Component515>
                    <Component516 type={`number`} min={1} max={20} value={l} onChange={e => {
                u(Ro(parseInt(e.target.value || `1`, 10) || 1, 1, 20));
              }} className={`w-14 bg-[#2a2a2a] text-gray-200 rounded px-1.5 py-0.5 border border-[#333] outline-none`} />
                    <Component517>{`×`}</Component517>
                    <Component518>{`列`}</Component518>
                    <Component519 type={`number`} min={1} max={20} value={d} onChange={e => {
                f(Ro(parseInt(e.target.value || `1`, 10) || 1, 1, 20));
              }} className={`w-14 bg-[#2a2a2a] text-gray-200 rounded px-1.5 py-0.5 border border-[#333] outline-none`} />
                  </Component520>}
              </Q.Fragment>}
            {o === `manual` && <Component523 className={`flex items-center justify-between text-[10px] text-gray-400`}>
                <Component521>
                  {ee}
                  {` 行 × `}
                  {R}
                  {` 列 = `}
                  {L}
                  {` 块`}
                </Component521>
                <Component522 className={`flex items-center gap-1 px-1.5 py-0.5 rounded border bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white hover:border-[#555]`} onClick={pe} title={`重置切割线`}>
                  <_Component25 size={11} />
                  {` 重置`}
                </Component522>
              </Component523>}
            {o === `lasso` && <Component528 className={`flex items-center justify-between text-[10px] text-gray-400`}>
                <Component524>
                  {`已绘制 `}
                  {L}
                  {` 块`}
                </Component524>
                <Component527 className={`flex items-center gap-1`}>
                  <Component525 className={`flex items-center gap-1 px-1.5 py-0.5 rounded border bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white hover:border-[#555]`} onClick={() => {
                return k(true);
              }} title={`全屏聚焦切刀`}>
                    <Ke size={11} />
                    {` 全屏`}
                  </Component525>
                  <Component526 className={`flex items-center gap-1 px-1.5 py-0.5 rounded border bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-red-300 hover:border-red-400/60 disabled:opacity-50`} onClick={ce} disabled={_.length === 0} title={`清空所有切刀`}>
                    <Ot size={11} />
                    {` 清空`}
                  </Component526>
                </Component527>
              </Component528>}
            <Component530 className={`flex items-center gap-2`}>
              <Component529 className={`flex-1 bg-[#2a2a2a] text-gray-300 text-xs rounded px-2 py-1 border border-[#333] outline-none`} placeholder={`分图角标，{num} 引入数字编号，可留空`} value={x} onChange={e => {
              return S(e.target.value);
            }} />
            </Component530>
            <Component537 className={`flex items-center gap-2`}>
              <Component533 className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] border cursor-pointer transition-colors ${C ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white hover:border-[#555]`}`} title={`勾选后未连接图片盒子也会自动新建一个并送入；下游已连图片盒子时会直接送入`} onClick={e => {
              return e.stopPropagation();
            }}>
                <Component531 type={`checkbox`} checked={C} onChange={e => {
                return w(e.target.checked);
              }} className={`accent-blue-500 sm:w-3 sm:h-3`} />
                <_Component26 size={12} />
                <Component532>{`图片盒子`}</Component532>
              </Component533>
              <Component536 className={`flex-1 flex items-center justify-between bg-[#2a2a2a] rounded-full p-1 pl-3 border border-[#333] transition-colors cursor-pointer group/btn
                ${F ? `hover:border-gray-500` : `opacity-50 cursor-not-allowed`}
              `} onClick={F ? le : undefined}>
                <Component534 className={`text-xs text-gray-300 group-hover/btn:text-white`}>{`批量切分`}</Component534>
                <Component535 className={`bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors`}>
                  <_Component21 size={14} strokeWidth={3} />
                </Component535>
              </Component536>
            </Component537>
          </Component538>
        </Component539>
      </Component540>
      {o === `lasso` && D && Fn.createPortal(<Component558 className={`fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex flex-col nodrag nowheel`} onClick={e => {
      return e.stopPropagation();
    }} onWheel={e => {
      return e.stopPropagation();
    }}>
            <Component547 className={`flex items-center justify-between px-4 py-2 bg-black/60 border-b border-white/10`}>
              <Component543 className={`flex items-center gap-2 text-gray-200 text-sm`}>
                <St size={16} className={`text-blue-400`} />
                <Component541>{`切刀（全屏聚焦）`}</Component541>
                <Component542 className={`text-xs text-gray-400 ml-2`}>
                  {`已绘制 `}
                  {L}
                  {` 块 · 起/终点贴近边时会自动吸附`}
                </Component542>
              </Component543>
              <Component546 className={`flex items-center gap-2`}>
                <Component544 className={`flex items-center gap-1 px-2 py-1 rounded border bg-[#2a2a2a] border-[#444] text-gray-200 hover:text-white hover:border-[#666] text-xs disabled:opacity-50`} onClick={ce} disabled={_.length === 0}>
                  <Ot size={13} />
                  {` 清空`}
                </Component544>
                <Component545 className={`flex items-center gap-1 px-2 py-1 rounded border bg-[#2a2a2a] border-[#444] text-gray-200 hover:text-white hover:border-[#666] text-xs`} onClick={() => {
            return k(false);
          }} title={`退出全屏 (Esc)`}>
                  <Gt size={13} />
                  {` 关闭`}
                </Component545>
              </Component546>
            </Component547>
            <Component556 className={`flex-1 flex items-center justify-center p-6`}>
              <Component555 className={`relative max-w-full max-h-full`} style={{
          aspectRatio: `auto`
        }}>
                <Component548 src={F} alt={`Source`} className={`max-w-[90vw] max-h-[80vh] object-contain block select-none pointer-events-none`} draggable={false} />
                <Component554 ref={re} className={`absolute inset-0`} style={{
            cursor: Ho
          }} onMouseDown={W}>
                  <Component550 className={`absolute inset-0 w-full h-full pointer-events-none`} viewBox={`0 0 100 100`} preserveAspectRatio={`none`}>
                    {_.map(e => {
                if (e.points.length < 2) {
                  return null;
                }
                let t = e.points.map((e, t) => {
                  return `${t === 0 ? `M` : `L`} ${e.x * 100} ${e.y * 100}`;
                }).join(` `) + (e.closed ? ` Z` : ``);
                let n = e.id === y;
                const Component549 = `path`;
                return <Component549 d={t} fill={e.closed ? n ? `rgba(59,130,246,0.30)` : `rgba(59,130,246,0.18)` : `none`} stroke={n ? `#60a5fa` : `#3b82f6`} strokeWidth={0.3} vectorEffect={`non-scaling-stroke`} key={e.id} />;
              })}
                  </Component550>
                  {me.map((e, t) => {
              return <Component553 className={`absolute -translate-x-1/2 -translate-y-1/2`} style={{
                left: `${e.cx * 100}%`,
                top: `${e.cy * 100}%`
              }} key={e.id}>
                        <Component552 className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono cursor-pointer border ${y === e.id ? `bg-blue-500 text-white border-blue-300` : `bg-black/70 text-white border-white/30 hover:bg-blue-500/80`}`} onClick={n => {
                  n.stopPropagation();
                  if (n.shiftKey) {
                    G(e.id);
                    return;
                  }
                  b(e.id);
                  ue(t);
                }} title={`点击切出 / Shift+点击删除`}>
                          <Component551>{t + 1}</Component551>
                          {ne.has(t) && <Se size={12} className={`text-green-400`} />}
                        </Component552>
                      </Component553>;
            })}
                </Component554>
              </Component555>
            </Component556>
            <Component557 className={`px-4 py-2 bg-black/60 border-t border-white/10 text-[11px] text-gray-300 leading-snug`}>{`按住鼠标在图上画一圈生成一个透明形状；起点或终点贴近图片边缘时会自动吸附到该边，并沿边自动闭合多边形（适合切人物 / 主体）。Shift + 点击编号可删除形状。`}</Component557>
          </Component558>, document.body)}
    </Component559>;
});
export default Jo;