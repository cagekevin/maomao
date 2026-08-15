// TODO(全局, 无需 import): data, selected, r, i, updateNodeData, handleType, o, l, n, x, p, ee, extractedImages, rows, cols, gridSize, splitMode, hLines, vLines, lassoShapes, s, u, v, f, titlePattern, sendToImageBox, z, ie, m, g, points, closed, b, lastX, lastY, k, cx, cy, cursor, oe, left, width, height, transform, right, minWidth, minHeight, type, index, se, me, fe, de, aspectRatio
import _cmp__Component8 from "./_Component8.jsx";
import _cmp__Component12 from "./_Component12.jsx";
import _cmp_Io from "./Io.jsx";
import { id, Oo, nn, We, Qt, Lt, e, P, d, y, w, h, ko, _, I, M, N, L, R, c, te, Do, C, D, re, B, ae, V, No, j, Ao, A, Po, X, jo, U, ue, ne, H, W, Eo, T, E, pe, le, S, G, Fn, Et, _Component28, O, St, Se, Kt, Me, Ke, Ot, _Component29, _Component22, Gt } from "./shared.js";
import * as _shared from "./shared.js";
import * as Z from "react";
import * as Q from "react";
var Lo = Z.memo(({
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
  let [p, m] = Z.useState(Array.isArray(t.hLines) ? Oo(t.hLines) : [0.5]);
  let [h, g] = Z.useState(Array.isArray(t.vLines) ? Oo(t.vLines) : [0.5]);
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
      let e = ko(h);
      let t = ko(p);
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
  let ee = o === `lasso` ? _.filter(e => {
    return e.closed && e.points.length >= 3;
  }).length : I.length;
  let L = o === `grid` ? l : o === `manual` ? p.length + 1 : 1;
  let R = o === `grid` ? d : o === `manual` ? h.length + 1 : ee;
  let te = Z.useRef(null);
  Z.useEffect(() => {
    M(e);
  }, [ee, e, M]);
  Z.useEffect(() => {
    if (o === `lasso`) {
      return;
    }
    if (!F) {
      N(e, {
        extractedImages: [],
        rows: L,
        cols: R,
        gridSize: Math.max(L, R),
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
            rows: L,
            cols: R,
            gridSize: Math.max(L, R),
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
  }, [F, I, L, R, o, p, h, _, e, N]);
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
        let n = await _cmp_Io(F, e);
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
      u(Do(e, 1, 20));
    }
  }, [t.rows]);
  Z.useEffect(() => {
    let e = t.cols;
    if (typeof e == `number` && e !== d) {
      f(Do(e, 1, 20));
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
  let [ie, ae] = Z.useState(null);
  Z.useEffect(() => {
    if (ie) {
      return;
    }
    let e = t.hLines;
    if (Array.isArray(e) && JSON.stringify(e) !== JSON.stringify(p)) {
      m(Oo(e));
    }
  }, [t.hLines]);
  Z.useEffect(() => {
    if (ie) {
      return;
    }
    let e = t.vLines;
    if (Array.isArray(e) && JSON.stringify(e) !== JSON.stringify(h)) {
      g(Oo(e));
    }
  }, [t.vLines]);
  Z.useEffect(() => {
    if (!ie) {
      return;
    }
    let e = e => {
      let t = B.current;
      if (!t) {
        return;
      }
      let n = t.getBoundingClientRect();
      if (ie.type === `h`) {
        let t = Do((e.clientY - n.top) / n.height, 0.01, 0.99);
        m(e => {
          return Oo(e.map((e, n) => {
            if (n === ie.index) {
              return t;
            } else {
              return e;
            }
          }));
        });
      } else {
        let t = Do((e.clientX - n.left) / n.width, 0.01, 0.99);
        g(e => {
          return Oo(e.map((e, n) => {
            if (n === ie.index) {
              return t;
            } else {
              return e;
            }
          }));
        });
      }
    };
    let t = () => {
      return ae(null);
    };
    window.addEventListener(`mousemove`, e);
    window.addEventListener(`mouseup`, t);
    return () => {
      window.removeEventListener(`mousemove`, e);
      window.removeEventListener(`mouseup`, t);
    };
  }, [ie]);
  let oe = Z.useCallback(e => {
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
        return Oo([...e, r]);
      });
    } else {
      m(e => {
        return Oo([...e, i]);
      });
    }
  }, [o]);
  let H = e => {
    return m(t => {
      return t.filter((t, n) => {
        return n !== e;
      });
    });
  };
  let se = e => {
    return g(t => {
      return t.filter((t, n) => {
        return n !== e;
      });
    });
  };
  let U = Z.useCallback(e => {
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
    let r = No({
      x: Do((e.clientX - n.left) / n.width, 0, 1),
      y: Do((e.clientY - n.top) / n.height, 0, 1)
    });
    j(r.edge);
    let i = Ao();
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
      let i = Do((e.clientX - r.left) / r.width, 0, 1);
      let a = Do((e.clientY - r.top) / r.height, 0, 1);
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
          let i = No(r);
          let a = n.points.slice();
          if (i.edge) {
            a[a.length - 1] = {
              x: i.x,
              y: i.y
            };
          }
          if (t && i.edge) {
            a = Po(a, t, i.edge);
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
  let W = e => {
    v(t => {
      return t.filter(t => {
        return t.id !== e;
      });
    });
    if (y === e) {
      b(null);
    }
  };
  let le = () => {
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
  let G = Z.useCallback(n => {
    n.stopPropagation();
    if (!F) {
      return;
    }
    let r = {
      rows: L,
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
      t.onSplit(e, F, L, R, x, r);
    }
  }, [t, e, F, L, R, x, C, o, p, h]);
  let ue = Z.useCallback(n => {
    if (!F) {
      return;
    }
    let r = x.replace(`{num}`, (n + 1).toString());
    let i = {
      rows: L,
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
      t.onSplitOne(e, F, L, R, n, r, i);
    }
  }, [t, e, F, L, R, x, C, o]);
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
  const Component481 = `button`;
  const Component482 = `button`;
  const Component483 = `button`;
  const Component484 = `div`;
  const Component485 = `div`;
  const Component486 = `img`;
  const Component487 = `span`;
  const Component488 = `div`;
  const Component489 = `div`;
  const Component490 = `div`;
  const Component491 = `div`;
  const Component492 = `div`;
  const Component493 = `div`;
  const Component495 = `svg`;
  const Component496 = `span`;
  const Component497 = `button`;
  const Component498 = `div`;
  const Component499 = `div`;
  const Component500 = `div`;
  const Component501 = `div`;
  const Component502 = `div`;
  const Component503 = `div`;
  const Component504 = `span`;
  const Component505 = `div`;
  const Component506 = `button`;
  const Component507 = `button`;
  const Component508 = `div`;
  const Component509 = `span`;
  const Component510 = `input`;
  const Component511 = `span`;
  const Component512 = `span`;
  const Component513 = `input`;
  const Component514 = `div`;
  const Component515 = `span`;
  const Component516 = `button`;
  const Component517 = `div`;
  const Component518 = `span`;
  const Component519 = `button`;
  const Component520 = `button`;
  const Component521 = `div`;
  const Component522 = `div`;
  const Component523 = `input`;
  const Component524 = `div`;
  const Component525 = `input`;
  const Component526 = `span`;
  const Component527 = `label`;
  const Component528 = `span`;
  const Component529 = `button`;
  const Component530 = `div`;
  const Component531 = `div`;
  const Component532 = `div`;
  const Component533 = `div`;
  const Component534 = `div`;
  const Component535 = `span`;
  const Component536 = `span`;
  const Component537 = `div`;
  const Component538 = `button`;
  const Component539 = `button`;
  const Component540 = `div`;
  const Component541 = `div`;
  const Component542 = `img`;
  const Component544 = `svg`;
  const Component545 = `span`;
  const Component546 = `button`;
  const Component547 = `div`;
  const Component548 = `div`;
  const Component549 = `div`;
  const Component550 = `div`;
  const Component551 = `div`;
  const Component552 = `div`;
  const Component553 = `div`;
  return <Component553 className={`relative flex flex-col`}>
      <Component485 className={`mb-1 flex items-center justify-between gap-2 w-[280px]`}>
        <_cmp__Component8 id={e} data={t} defaultTitle={`图像切分`} icon={<Et size={11} className={`text-gray-500`} />} className={`!mb-0`} />
        <Component484 className={`flex items-center gap-1 nodrag`}>
          <Component481 className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 border transition-colors ${o === `grid` ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white`}`} onClick={() => {
          return c(`grid`);
        }} title={`规则网格`}>
            <_Component28 size={11} />
            {` 规则`}
          </Component481>
          <Component482 className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 border transition-colors ${o === `manual` ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white`}`} onClick={() => {
          return c(`manual`);
        }} title={`手动网格 (拖动切割线)`}>
            <O size={11} />
            {` 手动`}
          </Component482>
          <Component483 className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 border transition-colors ${o === `lasso` ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white`}`} onClick={() => {
          return c(`lasso`);
        }} title={`手动切刀 (任意形状 + 透明通道)`}>
            <St size={11} />
            {` 切刀`}
          </Component483>
        </Component484>
      </Component485>
      <Component534 className={`relative bg-[#1c1c1c] rounded-xl border shadow-xl transition-all duration-300 w-[280px] ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}>
        <_cmp__Component12 type={`target`} position={X.Left} variant={`small`} />
        <_cmp__Component12 type={`source`} position={X.Right} id={`batch`} variant={`small`} />
        <Component533 className={`p-3 space-y-3 relative z-10 bg-[#1c1c1c] rounded-xl`}>
          {F ? <Component503 className={`relative w-full`}>
              <Component500 className={`relative w-full rounded bg-black/50 overflow-hidden shadow-inner`}>
                <Component486 src={F} alt={`Source`} loading={`lazy`} decoding={`async`} className={`w-full h-auto block opacity-80 select-none pointer-events-none`} draggable={false} />
                <Component499 ref={B} className={`absolute inset-0 nodrag`} style={o === `lasso` ? {
              cursor: jo
            } : undefined} onDoubleClick={oe} onMouseDown={U} title={o === `manual` ? `双击空白加水平线，Shift+双击加垂直线；拖动线移动；Shift+点击线删除` : o === `lasso` ? `按住拖动绘制不规则形状，松开自动闭合；起/终点贴近边时自动吸附` : ``}>
                  {o !== `lasso` && I.map((e, t) => {
                return <Component489 className={`absolute border border-white/20 hover:bg-blue-500/30 hover:border-blue-400 active:bg-blue-500/50 transition-all cursor-pointer rounded-[1px] group/cell`} style={{
                  left: `${e.x * 100}%`,
                  top: `${e.y * 100}%`,
                  width: `${e.w * 100}%`,
                  height: `${e.h * 100}%`
                }} onClick={e => {
                  e.stopPropagation();
                  ue(t);
                }} title={`点击切出: ${x.replace(`{num}`, (t + 1).toString())}`} key={t}>
                          <Component487 className={`absolute top-0.5 left-0.5 text-[8px] text-white/90 bg-black/50 px-1 rounded-sm font-mono pointer-events-none scale-75 origin-top-left backdrop-blur-[1px]`}>
                            {t + 1}
                          </Component487>
                          {ne.has(t) && <Component488 className={`absolute inset-0 flex items-center justify-center pointer-events-none`}>
                              <Se size={16} className={`text-green-500 drop-shadow-md bg-black/30 rounded-full p-0.5`} />
                            </Component488>}
                          <Kt type={`source`} position={X.Right} id={`cell-${t}`} className={`!opacity-0 group-hover/cell:!opacity-100 !w-1.5 !h-1.5 !bg-blue-500 !border-[1px] !border-white !rounded-full transition-opacity cursor-crosshair z-[100]`} style={{
                    top: `50%`,
                    left: `50%`,
                    transform: `translate(-50%, -50%)`,
                    right: `auto`,
                    minWidth: `6px`,
                    minHeight: `6px`
                  }} />
                        </Component489>;
              })}
                  {o === `manual` && <Q.Fragment>
                      {p.map((e, t) => {
                  return <Component491 className={`absolute left-0 right-0 cursor-row-resize z-[80]`} style={{
                    top: `calc(${e * 100}% - 5px)`,
                    height: 10
                  }} onMouseDown={e => {
                    e.stopPropagation();
                    ae({
                      type: `h`,
                      index: t
                    });
                  }} onClick={e => {
                    if (e.shiftKey) {
                      e.stopPropagation();
                      H(t);
                    }
                  }} title={`拖动调整位置 / Shift+点击删除`} key={`h-${t}`}>
                            <Component490 className={`absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-blue-400/90 shadow-[0_0_4px_rgba(59,130,246,0.8)]`} />
                          </Component491>;
                })}
                      {h.map((e, t) => {
                  return <Component493 className={`absolute top-0 bottom-0 cursor-col-resize z-[80]`} style={{
                    left: `calc(${e * 100}% - 5px)`,
                    width: 10
                  }} onMouseDown={e => {
                    e.stopPropagation();
                    ae({
                      type: `v`,
                      index: t
                    });
                  }} onClick={e => {
                    if (e.shiftKey) {
                      e.stopPropagation();
                      se(t);
                    }
                  }} title={`拖动调整位置 / Shift+点击删除`} key={`v-${t}`}>
                            <Component492 className={`absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-blue-400/90 shadow-[0_0_4px_rgba(59,130,246,0.8)]`} />
                          </Component493>;
                })}
                    </Q.Fragment>}
                  {o === `lasso` && <Component495 className={`absolute inset-0 w-full h-full pointer-events-none`} viewBox={`0 0 100 100`} preserveAspectRatio={`none`}>
                      {_.map(e => {
                  if (e.points.length < 2) {
                    return null;
                  }
                  let t = e.points.map((e, t) => {
                    return `${t === 0 ? `M` : `L`} ${e.x * 100} ${e.y * 100}`;
                  }).join(` `) + (e.closed ? ` Z` : ``);
                  let n = e.id === y;
                  const Component494 = `path`;
                  return <Component494 d={t} fill={e.closed ? n ? `rgba(59,130,246,0.35)` : `rgba(59,130,246,0.18)` : `none`} stroke={n ? `#60a5fa` : `#3b82f6`} strokeWidth={0.4} vectorEffect={`non-scaling-stroke`} key={e.id} />;
                })}
                    </Component495>}
                  {o === `lasso` && me.map((e, t) => {
                return <Component498 className={`absolute -translate-x-1/2 -translate-y-1/2 group/cell`} style={{
                  left: `${e.cx * 100}%`,
                  top: `${e.cy * 100}%`
                }} key={e.id}>
                          <Component497 className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono cursor-pointer border ${y === e.id ? `bg-blue-500 text-white border-blue-300` : `bg-black/70 text-white border-white/30 hover:bg-blue-500/80`}`} onClick={n => {
                    n.stopPropagation();
                    if (n.shiftKey) {
                      W(e.id);
                      return;
                    }
                    b(e.id);
                    ue(t);
                  }} title={`点击切出 / Shift+点击删除`}>
                            <Component496>{t + 1}</Component496>
                            {ne.has(t) && <Se size={10} className={`text-green-400`} />}
                          </Component497>
                          <Kt type={`source`} position={X.Right} id={`cell-${t}`} className={`!opacity-0 group-hover/cell:!opacity-100 !w-1.5 !h-1.5 !bg-blue-500 !border-[1px] !border-white !rounded-full transition-opacity cursor-crosshair z-[100]`} style={{
                    top: `50%`,
                    left: `50%`,
                    transform: `translate(-50%, -50%)`,
                    right: `auto`,
                    minWidth: `6px`,
                    minHeight: `6px`
                  }} />
                        </Component498>;
              })}
                </Component499>
              </Component500>
              {o === `manual` && <Component501 className={`mt-1 text-[10px] text-gray-500 leading-tight`}>{`双击空白加水平线，Shift+双击加垂直线；拖动线移动；Shift+点击线删除。`}</Component501>}
              {o === `lasso` && <Component502 className={`mt-1 text-[10px] text-gray-500 leading-tight`}>{`按住鼠标在图上画一圈即可生成一个透明形状，可以画多个；点击编号切出当前块，Shift+点击删除。`}</Component502>}
            </Component503> : <Component505 className={`h-24 flex flex-col items-center justify-center text-gray-600 bg-[#151515] rounded border border-dashed border-[#333]`}>
              <Component504 className={`text-xs`}>{`请连接图片`}</Component504>
            </Component505>}
          <Component532 className={`space-y-2 nodrag`}>
            {o === `grid` && <Q.Fragment>
                <Component508 className={`flex flex-wrap items-center gap-1`}>
                  {Eo.map(e => {
                return <Component506 className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${fe(e.rows, e.cols) ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white hover:border-[#555]`}`} onClick={() => {
                  return de(e.rows, e.cols);
                }} title={`${e.rows} 行 × ${e.cols} 列`} key={e.label}>
                        {e.label}
                      </Component506>;
              })}
                  <Component507 className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${T ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white hover:border-[#555]`}`} onClick={() => {
                return E(e => {
                  return !e;
                });
              }}>{`自定义`}</Component507>
                </Component508>
                {T && <Component514 className={`flex items-center gap-1.5 text-[10px] text-gray-400`}>
                    <Component509>{`行`}</Component509>
                    <Component510 type={`number`} min={1} max={20} value={l} onChange={e => {
                u(Do(parseInt(e.target.value || `1`, 10) || 1, 1, 20));
              }} className={`w-14 bg-[#2a2a2a] text-gray-200 rounded px-1.5 py-0.5 border border-[#333] outline-none`} />
                    <Component511>{`×`}</Component511>
                    <Component512>{`列`}</Component512>
                    <Component513 type={`number`} min={1} max={20} value={d} onChange={e => {
                f(Do(parseInt(e.target.value || `1`, 10) || 1, 1, 20));
              }} className={`w-14 bg-[#2a2a2a] text-gray-200 rounded px-1.5 py-0.5 border border-[#333] outline-none`} />
                  </Component514>}
              </Q.Fragment>}
            {o === `manual` && <Component517 className={`flex items-center justify-between text-[10px] text-gray-400`}>
                <Component515>
                  {L}
                  {` 行 × `}
                  {R}
                  {` 列 = `}
                  {ee}
                  {` 块`}
                </Component515>
                <Component516 className={`flex items-center gap-1 px-1.5 py-0.5 rounded border bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white hover:border-[#555]`} onClick={pe} title={`重置切割线`}>
                  <Me size={11} />
                  {` 重置`}
                </Component516>
              </Component517>}
            {o === `lasso` && <Component522 className={`flex items-center justify-between text-[10px] text-gray-400`}>
                <Component518>
                  {`已绘制 `}
                  {ee}
                  {` 块`}
                </Component518>
                <Component521 className={`flex items-center gap-1`}>
                  <Component519 className={`flex items-center gap-1 px-1.5 py-0.5 rounded border bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white hover:border-[#555]`} onClick={() => {
                return k(true);
              }} title={`全屏聚焦切刀`}>
                    <Ke size={11} />
                    {` 全屏`}
                  </Component519>
                  <Component520 className={`flex items-center gap-1 px-1.5 py-0.5 rounded border bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-red-300 hover:border-red-400/60 disabled:opacity-50`} onClick={le} disabled={_.length === 0} title={`清空所有切刀`}>
                    <Ot size={11} />
                    {` 清空`}
                  </Component520>
                </Component521>
              </Component522>}
            <Component524 className={`flex items-center gap-2`}>
              <Component523 className={`flex-1 bg-[#2a2a2a] text-gray-300 text-xs rounded px-2 py-1 border border-[#333] outline-none`} placeholder={`分图角标，{num} 引入数字编号，可留空`} value={x} onChange={e => {
              return S(e.target.value);
            }} />
            </Component524>
            <Component531 className={`flex items-center gap-2`}>
              <Component527 className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] border cursor-pointer transition-colors ${C ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white hover:border-[#555]`}`} title={`勾选后未连接图片盒子也会自动新建一个并送入；下游已连图片盒子时会直接送入`} onClick={e => {
              return e.stopPropagation();
            }}>
                <Component525 type={`checkbox`} checked={C} onChange={e => {
                return w(e.target.checked);
              }} className={`accent-blue-500 sm:w-3 sm:h-3`} />
                <_Component29 size={12} />
                <Component526>{`图片盒子`}</Component526>
              </Component527>
              <Component530 className={`flex-1 flex items-center justify-between bg-[#2a2a2a] rounded-full p-1 pl-3 border border-[#333] transition-colors cursor-pointer group/btn
                ${F ? `hover:border-gray-500` : `opacity-50 cursor-not-allowed`}
              `} onClick={F ? G : undefined}>
                <Component528 className={`text-xs text-gray-300 group-hover/btn:text-white`}>{`批量切分`}</Component528>
                <Component529 className={`bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors`}>
                  <_Component22 size={14} strokeWidth={3} />
                </Component529>
              </Component530>
            </Component531>
          </Component532>
        </Component533>
      </Component534>
      {o === `lasso` && D && Fn.createPortal(<Component552 className={`fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex flex-col nodrag nowheel`} onClick={e => {
      return e.stopPropagation();
    }} onWheel={e => {
      return e.stopPropagation();
    }}>
            <Component541 className={`flex items-center justify-between px-4 py-2 bg-black/60 border-b border-white/10`}>
              <Component537 className={`flex items-center gap-2 text-gray-200 text-sm`}>
                <St size={16} className={`text-blue-400`} />
                <Component535>{`切刀（全屏聚焦）`}</Component535>
                <Component536 className={`text-xs text-gray-400 ml-2`}>
                  {`已绘制 `}
                  {ee}
                  {` 块 · 起/终点贴近边时会自动吸附`}
                </Component536>
              </Component537>
              <Component540 className={`flex items-center gap-2`}>
                <Component538 className={`flex items-center gap-1 px-2 py-1 rounded border bg-[#2a2a2a] border-[#444] text-gray-200 hover:text-white hover:border-[#666] text-xs disabled:opacity-50`} onClick={le} disabled={_.length === 0}>
                  <Ot size={13} />
                  {` 清空`}
                </Component538>
                <Component539 className={`flex items-center gap-1 px-2 py-1 rounded border bg-[#2a2a2a] border-[#444] text-gray-200 hover:text-white hover:border-[#666] text-xs`} onClick={() => {
            return k(false);
          }} title={`退出全屏 (Esc)`}>
                  <Gt size={13} />
                  {` 关闭`}
                </Component539>
              </Component540>
            </Component541>
            <Component550 className={`flex-1 flex items-center justify-center p-6`}>
              <Component549 className={`relative max-w-full max-h-full`} style={{
          aspectRatio: `auto`
        }}>
                <Component542 src={F} alt={`Source`} className={`max-w-[90vw] max-h-[80vh] object-contain block select-none pointer-events-none`} draggable={false} />
                <Component548 ref={re} className={`absolute inset-0`} style={{
            cursor: jo
          }} onMouseDown={U}>
                  <Component544 className={`absolute inset-0 w-full h-full pointer-events-none`} viewBox={`0 0 100 100`} preserveAspectRatio={`none`}>
                    {_.map(e => {
                if (e.points.length < 2) {
                  return null;
                }
                let t = e.points.map((e, t) => {
                  return `${t === 0 ? `M` : `L`} ${e.x * 100} ${e.y * 100}`;
                }).join(` `) + (e.closed ? ` Z` : ``);
                let n = e.id === y;
                const Component543 = `path`;
                return <Component543 d={t} fill={e.closed ? n ? `rgba(59,130,246,0.30)` : `rgba(59,130,246,0.18)` : `none`} stroke={n ? `#60a5fa` : `#3b82f6`} strokeWidth={0.3} vectorEffect={`non-scaling-stroke`} key={e.id} />;
              })}
                  </Component544>
                  {me.map((e, t) => {
              return <Component547 className={`absolute -translate-x-1/2 -translate-y-1/2`} style={{
                left: `${e.cx * 100}%`,
                top: `${e.cy * 100}%`
              }} key={e.id}>
                        <Component546 className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono cursor-pointer border ${y === e.id ? `bg-blue-500 text-white border-blue-300` : `bg-black/70 text-white border-white/30 hover:bg-blue-500/80`}`} onClick={n => {
                  n.stopPropagation();
                  if (n.shiftKey) {
                    W(e.id);
                    return;
                  }
                  b(e.id);
                  ue(t);
                }} title={`点击切出 / Shift+点击删除`}>
                          <Component545>{t + 1}</Component545>
                          {ne.has(t) && <Se size={12} className={`text-green-400`} />}
                        </Component546>
                      </Component547>;
            })}
                </Component548>
              </Component549>
            </Component550>
            <Component551 className={`px-4 py-2 bg-black/60 border-t border-white/10 text-[11px] text-gray-300 leading-snug`}>{`按住鼠标在图上画一圈生成一个透明形状；起点或终点贴近图片边缘时会自动吸附到该边，并沿边自动闭合多边形（适合切人物 / 主体）。Shift + 点击编号可删除形状。`}</Component551>
          </Component552>, document.body)}
    </Component553>;
});
export default Lo;