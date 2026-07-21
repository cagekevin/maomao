/**
 * 节点类型: gridSplitNode
 * 原版函数名: po
 * 原版行号: L6167-L6960
 * 来源: App-B9jVCs-a.decompiled.js
 *
 * 变量映射（vendor-map.json）:
// _ → tU
// _r → Rl
// a → ZK
// b → dT
// bt → Fd
// c → tK
// d → zG
// e → i
// f → MG
// g → qU
// h → xW
// i → jq
// j → GE
// k → cO
// l → VG
// m → LW
// mt → Vd
// n → Fq
// o → oK
// p → VW
// r → Nq
// s → iK
// t → e1
// u → BG
// ut → Gd
// v → XH
// w → xT
// x → Y
// y → Mk
// yn → Iu
// z → Rw
 */

  po = Y.memo(({
    id: e,
    data: n,
    selected: r
  }) => {
    let i = typeof n.gridSize == `number` ? n.gridSize : undefined,
      a = n.rows ?? i ?? 3,
      o = n.cols ?? i ?? 3,
      [s, c] = Y.useState(n.splitMode || `grid`),
      [l, u] = Y.useState(a),
      [d, f] = Y.useState(o),
      [p, m] = Y.useState(Array.isArray(n.hLines) ? ro(n.hLines) : [.5]),
      [h, g] = Y.useState(Array.isArray(n.vLines) ? ro(n.vLines) : [.5]),
      [_, v] = Y.useState(Array.isArray(n.lassoShapes) ? n.lassoShapes : []),
      [y, x] = Y.useState(null),
      [C, w] = Y.useState(n.titlePattern || `#{num}`),
      [T, D] = Y.useState(n.sendToImageBox ?? false),
      [O, k] = Y.useState(false),
      [A, j] = Y.useState(false),
      [M, N] = Y.useState(null),
      P = Et(),
      {
        updateNodeData: F
      } = Gt(),
      I = ut(t({
        handleType: `target`
      }).map(e => e.source)),
      L = n.imageUrl;
    if (!L && I) {
      let e = (Array.isArray(I) ? I : [I]).find(e => e?.data?.imageUrl);
      e && (L = e.data.imageUrl);
    }
    let ee = Y.useMemo(() => {
        if (s === `grid`) {
          let e = 1 / d,
            t = 1 / l,
            n = [];
          for (let r = 0; r < l; r++) for (let i = 0; i < d; i++) n.push({
            x: i * e,
            y: r * t,
            w: e,
            h: t
          });
          return n;
        }
        if (s === `manual`) {
          let e = io(h),
            t = io(p),
            n = [];
          for (let [r, i] of t) for (let [t, a] of e) n.push({
            x: t,
            y: r,
            w: a - t,
            h: i - r
          });
          return n;
        }
        return [];
      }, [s, l, d, p, h]),
      R = s === `lasso` ? _.filter(e => e.closed && e.points.length >= 3).length : ee.length,
      B = s === `grid` ? l : s === `manual` ? p.length + 1 : 1,
      te = s === `grid` ? d : s === `manual` ? h.length + 1 : R,
      ne = Y.useRef(null);
    Y.useEffect(() => {
      P(e);
    }, [R, e, P]), Y.useEffect(() => {
      if (s === `lasso`) return;
      if (!L) {
        F(e, {
          extractedImages: [],
          rows: B,
          cols: te,
          gridSize: Math.max(B, te),
          splitMode: s,
          hLines: p,
          vLines: h,
          lassoShapes: _
        });
        return;
      }
      let t = false;
      return (async () => {
        try {
          let n = new Image();
          n.crossOrigin = `anonymous`, n.src = L, await new Promise(e => {
            n.onload = e, n.onerror = () => {
              let t = new Image();
              t.src = L, t.onload = () => e(null), t.onerror = () => e(null);
            };
          });
          let r = n.width,
            i = n.height,
            a = [];
          for (let e of ee) {
            let t = e.x * r,
              o = e.y * i,
              s = e.w * r,
              c = e.h * i,
              l = document.createElement(`canvas`);
            l.width = Math.max(1, Math.round(s)), l.height = Math.max(1, Math.round(c));
            let u = l.getContext(`2d`);
            u ? (u.drawImage(n, t, o, s, c, 0, 0, l.width, l.height), a.push(l.toDataURL(`image/jpeg`, .85))) : a.push(null);
          }
          t || F(e, {
            extractedImages: a,
            rows: B,
            cols: te,
            gridSize: Math.max(B, te),
            splitMode: s,
            hLines: p,
            vLines: h,
            lassoShapes: _
          });
        } catch (e) {
          console.error(`Failed to pre-crop images:`, e);
        }
      })(), () => {
        t = true;
      };
    }, [L, ee, B, te, s, p, h, _, e, F]), Y.useEffect(() => {
      if (s !== `lasso` || ne.current) return;
      if (!L) {
        F(e, {
          extractedImages: [],
          rows: 1,
          cols: 0,
          gridSize: 1,
          splitMode: s,
          hLines: p,
          vLines: h,
          lassoShapes: _
        });
        return;
      }
      let t = false;
      return (async () => {
        let n = _.filter(e => e.closed && e.points.length >= 3),
          r = [];
        for (let e of n) {
          let n = await fo(L, e);
          if (r.push(n), t) return;
        }
        t || F(e, {
          extractedImages: r,
          rows: 1,
          cols: n.length,
          gridSize: Math.max(1, n.length),
          splitMode: s,
          hLines: p,
          vLines: h,
          lassoShapes: _
        });
      })(), () => {
        t = true;
      };
    }, [L, _, s, p, h, e, F]), Y.useEffect(() => {
      if (ne.current) return;
      let e = n.lassoShapes;
      Array.isArray(e) && JSON.stringify(e) !== JSON.stringify(_) && v(e);
    }, [n.lassoShapes]), Y.useEffect(() => {
      let e = n.rows;
      typeof e == `number` && e !== l && u(no(e, 1, 20));
    }, [n.rows]), Y.useEffect(() => {
      let e = n.cols;
      typeof e == `number` && e !== d && f(no(e, 1, 20));
    }, [n.cols]), Y.useEffect(() => {
      let e = n.splitMode;
      e && e !== s && c(e);
    }, [n.splitMode]), Y.useEffect(() => {
      F(e, {
        titlePattern: C,
        sendToImageBox: T
      });
    }, [C, T, e, F]);
    let re = t({
        handleType: `source`
      }),
      ie = Y.useMemo(() => new Set(re.filter(e => e.sourceHandle?.startsWith(`cell-`)).map(e => parseInt(e.sourceHandle.replace(`cell-`, ``), 10))), [re]),
      ae = Y.useRef(null),
      oe = Y.useRef(null),
      se = Y.useCallback(() => s === `lasso` && A && oe.current ? oe.current : ae.current, [s, A]),
      [ce, le] = Y.useState(null);
    Y.useEffect(() => {
      if (ce) return;
      let e = n.hLines;
      Array.isArray(e) && JSON.stringify(e) !== JSON.stringify(p) && m(ro(e));
    }, [n.hLines]), Y.useEffect(() => {
      if (ce) return;
      let e = n.vLines;
      Array.isArray(e) && JSON.stringify(e) !== JSON.stringify(h) && g(ro(e));
    }, [n.vLines]), Y.useEffect(() => {
      if (!ce) return;
      let e = e => {
          let t = ae.current;
          if (!t) return;
          let n = t.getBoundingClientRect();
          if (ce.type === `h`) {
            let t = no((e.clientY - n.top) / n.height, .01, .99);
            m(e => ro(e.map((e, n) => n === ce.index ? t : e)));
          } else {
            let t = no((e.clientX - n.left) / n.width, .01, .99);
            g(e => ro(e.map((e, n) => n === ce.index ? t : e)));
          }
        },
        t = () => le(null);
      return window.addEventListener(`mousemove`, e), window.addEventListener(`mouseup`, t), () => {
        window.removeEventListener(`mousemove`, e), window.removeEventListener(`mouseup`, t);
      };
    }, [ce]);
    let ue = Y.useCallback(e => {
        if (s !== `manual`) return;
        e.stopPropagation();
        let t = ae.current;
        if (!t) return;
        let n = t.getBoundingClientRect(),
          r = (e.clientX - n.left) / n.width,
          i = (e.clientY - n.top) / n.height;
        e.shiftKey ? g(e => ro([...e, r])) : m(e => ro([...e, i]));
      }, [s]),
      V = e => m(t => t.filter((t, n) => n !== e)),
      H = e => g(t => t.filter((t, n) => n !== e)),
      U = Y.useCallback(e => {
        if (s !== `lasso`) return;
        e.stopPropagation(), e.preventDefault();
        let t = se();
        if (!t) return;
        let n = t.getBoundingClientRect(),
          r = co({
            x: no((e.clientX - n.left) / n.width, 0, 1),
            y: no((e.clientY - n.top) / n.height, 0, 1)
          });
        N(r.edge);
        let i = ao();
        v(e => [...e, {
          id: i,
          points: [{
            x: r.x,
            y: r.y
          }],
          closed: false
        }]), x(i), ne.current = {
          id: i,
          lastX: r.x,
          lastY: r.y
        };
      }, [s, se]);
    Y.useEffect(() => {
      if (s !== `lasso`) return;
      let e = e => {
          let t = ne.current;
          if (!t) return;
          let n = se();
          if (!n) return;
          let r = n.getBoundingClientRect(),
            i = no((e.clientX - r.left) / r.width, 0, 1),
            a = no((e.clientY - r.top) / r.height, 0, 1),
            o = i - t.lastX,
            s = a - t.lastY;
          o * o + s * s < 6e-4 || (t.lastX = i, t.lastY = a, v(e => e.map(e => e.id === t.id ? {
            ...e,
            points: [...e.points, {
              x: i,
              y: a
            }]
          } : e)));
        },
        t = () => {
          let e = ne.current;
          if (!e) return;
          ne.current = null;
          let t = M;
          N(null), v(n => n.map(n => {
            if (n.id !== e.id || n.points.length < 3) return n;
            let r = n.points[n.points.length - 1],
              i = co(r),
              a = n.points.slice();
            return i.edge && (a[a.length - 1] = {
              x: i.x,
              y: i.y
            }), t && i.edge && (a = lo(a, t, i.edge)), {
              ...n,
              points: a,
              closed: true
            };
          }).filter(t => !(t.id === e.id && t.points.length < 3)));
        };
      return window.addEventListener(`mousemove`, e), window.addEventListener(`mouseup`, t), () => {
        window.removeEventListener(`mousemove`, e), window.removeEventListener(`mouseup`, t);
      };
    }, [s, M, se]);
    let de = e => {
        v(t => t.filter(t => t.id !== e)), y === e && x(null);
      },
      W = () => {
        v([]), x(null);
      };
    Y.useEffect(() => {
      if (!A) return;
      let e = e => {
        e.key === `Escape` && j(false);
      };
      return window.addEventListener(`keydown`, e), () => window.removeEventListener(`keydown`, e);
    }, [A]);
    let fe = Y.useCallback(t => {
        if (t.stopPropagation(), !L) return;
        let r = {
          rows: B,
          cols: te,
          titlePattern: C,
          splitMode: s,
          hLines: p,
          vLines: h,
          sendToImageBox: T
        };
        if ((s === `manual` || s === `lasso`) && typeof n.onSplitManual == `function`) {
          let t = (n.extractedImages || []).filter(e => typeof e == `string` && !!e);
          n.onSplitManual(e, t, C, r);
          return;
        }
        typeof n.onSplit == `function` && n.onSplit(e, L, B, te, C, r);
      }, [n, e, L, B, te, C, T, s, p, h]),
      pe = Y.useCallback(t => {
        if (!L) return;
        let r = C.replace(`{num}`, (t + 1).toString()),
          i = {
            rows: B,
            cols: te,
            splitMode: s,
            sendToImageBox: T
          };
        if ((s === `manual` || s === `lasso`) && typeof n.onSplitOneManual == `function`) {
          let a = (n.extractedImages || [])[t];
          if (a) {
            n.onSplitOneManual(e, a, t, r, i);
            return;
          }
        }
        typeof n.onSplitOne == `function` && n.onSplitOne(e, L, B, te, t, r, i);
      }, [n, e, L, B, te, C, T, s]),
      me = (e, t) => {
        u(e), f(t);
      },
      G = (e, t) => l === e && d === t,
      he = () => {
        m([.5]), g([.5]);
      },
      ge = Y.useMemo(() => _.filter(e => e.closed && e.points.length >= 3).map(e => {
        let t = e.points.length,
          n = 0,
          r = 0;
        for (let t of e.points) n += t.x, r += t.y;
        return {
          id: e.id,
          cx: n / t,
          cy: r / t
        };
      }), [_]);
    return X.jsxs(`div`, {
      className: `relative flex flex-col`,
      children: [X.jsxs(`div`, {
        className: `mb-1 flex items-center justify-between gap-2 w-[280px]`,
        children: [X.jsx(si, {
          id: e,
          data: n,
          defaultTitle: `图像切分`,
          icon: X.jsx(Tn, {
            size: 11,
            className: `text-gray-500`
          }),
          className: `!mb-0`
        }), X.jsxs(`div`, {
          className: `flex items-center gap-1 nodrag`,
          children: [X.jsxs(`button`, {
            className: `px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 border transition-colors ${s === `grid` ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white`}`,
            onClick: () => c(`grid`),
            title: `规则网格`,
            children: [X.jsx(_e, {
              size: 11
            }), ` 规则`]
          }), X.jsxs(`button`, {
            className: `px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 border transition-colors ${s === `manual` ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white`}`,
            onClick: () => c(`manual`),
            title: `手动网格 (拖动切割线)`,
            children: [X.jsx(Ae, {
              size: 11
            }), ` 手动`]
          }), X.jsxs(`button`, {
            className: `px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 border transition-colors ${s === `lasso` ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white`}`,
            onClick: () => c(`lasso`),
            title: `手动切刀 (任意形状 + 透明通道)`,
            children: [X.jsx(b, {
              size: 11
            }), ` 切刀`]
          })]
        })]
      }), X.jsxs(`div`, {
        className: `relative bg-[#1c1c1c] rounded-xl border shadow-xl transition-all duration-300 w-[280px] ${r ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`,
        children: [X.jsx(_r, {
          type: `target`,
          position: J.Left,
          variant: `small`
        }), X.jsx(_r, {
          type: `source`,
          position: J.Right,
          id: `batch`,
          variant: `small`
        }), X.jsxs(`div`, {
          className: `p-3 space-y-3 relative z-10 bg-[#1c1c1c] rounded-xl`,
          children: [L ? X.jsxs(`div`, {
            className: `relative w-full`,
            children: [X.jsxs(`div`, {
              className: `relative w-full rounded bg-black/50 overflow-hidden shadow-inner`,
              children: [X.jsx(`img`, {
                src: L,
                alt: `Source`,
                loading: `lazy`,
                decoding: `async`,
                className: `w-full h-auto block opacity-80 select-none pointer-events-none`,
                draggable: false
              }), X.jsxs(`div`, {
                ref: ae,
                className: `absolute inset-0 nodrag`,
                style: s === `lasso` ? {
                  cursor: oo
                } : undefined,
                onDoubleClick: ue,
                onMouseDown: U,
                title: s === `manual` ? `双击空白加水平线，Shift+双击加垂直线；拖动线移动；Shift+点击线删除` : s === `lasso` ? `按住拖动绘制不规则形状，松开自动闭合；起/终点贴近边时自动吸附` : ``,
                children: [s !== `lasso` && ee.map((e, t) => X.jsxs(`div`, {
                  className: `absolute border border-white/20 hover:bg-blue-500/30 hover:border-blue-400 active:bg-blue-500/50 transition-all cursor-pointer rounded-[1px] group/cell`,
                  style: {
                    left: `${e.x * 100}%`,
                    top: `${e.y * 100}%`,
                    width: `${e.w * 100}%`,
                    height: `${e.h * 100}%`
                  },
                  onClick: e => {
                    e.stopPropagation(), pe(t);
                  },
                  title: `点击切出: ${C.replace(`{num}`, (t + 1).toString())}`,
                  children: [X.jsx(`span`, {
                    className: `absolute top-0.5 left-0.5 text-[8px] text-white/90 bg-black/50 px-1 rounded-sm font-mono pointer-events-none scale-75 origin-top-left backdrop-blur-[1px]`,
                    children: t + 1
                  }), ie.has(t) && X.jsx(`div`, {
                    className: `absolute inset-0 flex items-center justify-center pointer-events-none`,
                    children: X.jsx(Pn, {
                      size: 16,
                      className: `text-green-500 drop-shadow-md bg-black/30 rounded-full p-0.5`
                    })
                  }), X.jsx(E, {
                    type: `source`,
                    position: J.Right,
                    id: `cell-${t}`,
                    className: `!opacity-0 group-hover/cell:!opacity-100 !w-1.5 !h-1.5 !bg-blue-500 !border-[1px] !border-white !rounded-full transition-opacity cursor-crosshair z-[100]`,
                    style: {
                      top: `50%`,
                      left: `50%`,
                      transform: `translate(-50%, -50%)`,
                      right: `auto`,
                      minWidth: `6px`,
                      minHeight: `6px`
                    }
                  })]
                }, t)), s === `manual` && X.jsxs(X.Fragment, {
                  children: [p.map((e, t) => X.jsx(`div`, {
                    className: `absolute left-0 right-0 cursor-row-resize z-[80]`,
                    style: {
                      top: `calc(${e * 100}% - 5px)`,
                      height: 10
                    },
                    onMouseDown: e => {
                      e.stopPropagation(), le({
                        type: `h`,
                        index: t
                      });
                    },
                    onClick: e => {
                      e.shiftKey && (e.stopPropagation(), V(t));
                    },
                    title: `拖动调整位置 / Shift+点击删除`,
                    children: X.jsx(`div`, {
                      className: `absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-blue-400/90 shadow-[0_0_4px_rgba(59,130,246,0.8)]`
                    })
                  }, `h-${t}`)), h.map((e, t) => X.jsx(`div`, {
                    className: `absolute top-0 bottom-0 cursor-col-resize z-[80]`,
                    style: {
                      left: `calc(${e * 100}% - 5px)`,
                      width: 10
                    },
                    onMouseDown: e => {
                      e.stopPropagation(), le({
                        type: `v`,
                        index: t
                      });
                    },
                    onClick: e => {
                      e.shiftKey && (e.stopPropagation(), H(t));
                    },
                    title: `拖动调整位置 / Shift+点击删除`,
                    children: X.jsx(`div`, {
                      className: `absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-blue-400/90 shadow-[0_0_4px_rgba(59,130,246,0.8)]`
                    })
                  }, `v-${t}`))]
                }), s === `lasso` && X.jsx(`svg`, {
                  className: `absolute inset-0 w-full h-full pointer-events-none`,
                  viewBox: `0 0 100 100`,
                  preserveAspectRatio: `none`,
                  children: _.map(e => {
                    if (e.points.length < 2) return null;
                    let t = e.points.map((e, t) => `${t === 0 ? `M` : `L`} ${e.x * 100} ${e.y * 100}`).join(` `) + (e.closed ? ` Z` : ``),
                      n = e.id === y;
                    return X.jsx(`path`, {
                      d: t,
                      fill: e.closed ? n ? `rgba(59,130,246,0.35)` : `rgba(59,130,246,0.18)` : `none`,
                      stroke: n ? `#60a5fa` : `#3b82f6`,
                      strokeWidth: .4,
                      vectorEffect: `non-scaling-stroke`
                    }, e.id);
                  })
                }), s === `lasso` && ge.map((e, t) => X.jsxs(`div`, {
                  className: `absolute -translate-x-1/2 -translate-y-1/2 group/cell`,
                  style: {
                    left: `${e.cx * 100}%`,
                    top: `${e.cy * 100}%`
                  },
                  children: [X.jsxs(`button`, {
                    className: `flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono cursor-pointer border ${y === e.id ? `bg-blue-500 text-white border-blue-300` : `bg-black/70 text-white border-white/30 hover:bg-blue-500/80`}`,
                    onClick: n => {
                      if (n.stopPropagation(), n.shiftKey) {
                        de(e.id);
                        return;
                      }
                      x(e.id), pe(t);
                    },
                    title: `点击切出 / Shift+点击删除`,
                    children: [X.jsx(`span`, {
                      children: t + 1
                    }), ie.has(t) && X.jsx(Pn, {
                      size: 10,
                      className: `text-green-400`
                    })]
                  }), X.jsx(E, {
                    type: `source`,
                    position: J.Right,
                    id: `cell-${t}`,
                    className: `!opacity-0 group-hover/cell:!opacity-100 !w-1.5 !h-1.5 !bg-blue-500 !border-[1px] !border-white !rounded-full transition-opacity cursor-crosshair z-[100]`,
                    style: {
                      top: `50%`,
                      left: `50%`,
                      transform: `translate(-50%, -50%)`,
                      right: `auto`,
                      minWidth: `6px`,
                      minHeight: `6px`
                    }
                  })]
                }, e.id))]
              })]
            }), s === `manual` && X.jsx(`div`, {
              className: `mt-1 text-[10px] text-gray-500 leading-tight`,
              children: `双击空白加水平线，Shift+双击加垂直线；拖动线移动；Shift+点击线删除。`
            }), s === `lasso` && X.jsx(`div`, {
              className: `mt-1 text-[10px] text-gray-500 leading-tight`,
              children: `按住鼠标在图上画一圈即可生成一个透明形状，可以画多个；点击编号切出当前块，Shift+点击删除。`
            })]
          }) : X.jsx(`div`, {
            className: `h-24 flex flex-col items-center justify-center text-gray-600 bg-[#151515] rounded border border-dashed border-[#333]`,
            children: X.jsx(`span`, {
              className: `text-xs`,
              children: `请连接图片`
            })
          }), X.jsxs(`div`, {
            className: `space-y-2 nodrag`,
            children: [s === `grid` && X.jsxs(X.Fragment, {
              children: [X.jsxs(`div`, {
                className: `flex flex-wrap items-center gap-1`,
                children: [to.map(e => X.jsx(`button`, {
                  className: `text-[10px] px-2 py-0.5 rounded border transition-colors ${G(e.rows, e.cols) ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white hover:border-[#555]`}`,
                  onClick: () => me(e.rows, e.cols),
                  title: `${e.rows} 行 × ${e.cols} 列`,
                  children: e.label
                }, e.label)), X.jsx(`button`, {
                  className: `text-[10px] px-2 py-0.5 rounded border transition-colors ${O ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white hover:border-[#555]`}`,
                  onClick: () => k(e => !e),
                  children: `自定义`
                })]
              }), O && X.jsxs(`div`, {
                className: `flex items-center gap-1.5 text-[10px] text-gray-400`,
                children: [X.jsx(`span`, {
                  children: `行`
                }), X.jsx(`input`, {
                  type: `number`,
                  min: 1,
                  max: 20,
                  value: l,
                  onChange: e => {
                    u(no(parseInt(e.target.value || `1`, 10) || 1, 1, 20));
                  },
                  className: `w-14 bg-[#2a2a2a] text-gray-200 rounded px-1.5 py-0.5 border border-[#333] outline-none`
                }), X.jsx(`span`, {
                  children: `×`
                }), X.jsx(`span`, {
                  children: `列`
                }), X.jsx(`input`, {
                  type: `number`,
                  min: 1,
                  max: 20,
                  value: d,
                  onChange: e => {
                    f(no(parseInt(e.target.value || `1`, 10) || 1, 1, 20));
                  },
                  className: `w-14 bg-[#2a2a2a] text-gray-200 rounded px-1.5 py-0.5 border border-[#333] outline-none`
                })]
              })]
            }), s === `manual` && X.jsxs(`div`, {
              className: `flex items-center justify-between text-[10px] text-gray-400`,
              children: [X.jsxs(`span`, {
                children: [B, ` 行 × `, te, ` 列 = `, R, ` 块`]
              }), X.jsxs(`button`, {
                className: `flex items-center gap-1 px-1.5 py-0.5 rounded border bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white hover:border-[#555]`,
                onClick: he,
                title: `重置切割线`,
                children: [X.jsx(z, {
                  size: 11
                }), ` 重置`]
              })]
            }), s === `lasso` && X.jsxs(`div`, {
              className: `flex items-center justify-between text-[10px] text-gray-400`,
              children: [X.jsxs(`span`, {
                children: [`已绘制 `, R, ` 块`]
              }), X.jsxs(`div`, {
                className: `flex items-center gap-1`,
                children: [X.jsxs(`button`, {
                  className: `flex items-center gap-1 px-1.5 py-0.5 rounded border bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white hover:border-[#555]`,
                  onClick: () => j(true),
                  title: `全屏聚焦切刀`,
                  children: [X.jsx(bt, {
                    size: 11
                  }), ` 全屏`]
                }), X.jsxs(`button`, {
                  className: `flex items-center gap-1 px-1.5 py-0.5 rounded border bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-red-300 hover:border-red-400/60 disabled:opacity-50`,
                  onClick: W,
                  disabled: _.length === 0,
                  title: `清空所有切刀`,
                  children: [X.jsx(S, {
                    size: 11
                  }), ` 清空`]
                })]
              })]
            }), X.jsx(`div`, {
              className: `flex items-center gap-2`,
              children: X.jsx(`input`, {
                className: `flex-1 bg-[#2a2a2a] text-gray-300 text-xs rounded px-2 py-1 border border-[#333] outline-none`,
                placeholder: `分图角标，{num} 引入数字编号，可留空`,
                value: C,
                onChange: e => w(e.target.value)
              })
            }), X.jsxs(`div`, {
              className: `flex items-center gap-2`,
              children: [X.jsxs(`label`, {
                className: `flex items-center gap-1 px-2 py-1 rounded text-[10px] border cursor-pointer transition-colors ${T ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white hover:border-[#555]`}`,
                title: `勾选后未连接图片盒子也会自动新建一个并送入；下游已连图片盒子时会直接送入`,
                onClick: e => e.stopPropagation(),
                children: [X.jsx(`input`, {
                  type: `checkbox`,
                  checked: T,
                  onChange: e => D(e.target.checked),
                  className: `accent-blue-500 sm:w-3 sm:h-3`
                }), X.jsx(be, {
                  size: 12
                }), X.jsx(`span`, {
                  children: `图片盒子`
                })]
              }), X.jsxs(`div`, {
                className: `flex-1 flex items-center justify-between bg-[#2a2a2a] rounded-full p-1 pl-3 border border-[#333] transition-colors cursor-pointer group/btn
                ${L ? `hover:border-gray-500` : `opacity-50 cursor-not-allowed`}
              `,
                onClick: L ? fe : undefined,
                children: [X.jsx(`span`, {
                  className: `text-xs text-gray-300 group-hover/btn:text-white`,
                  children: `批量切分`
                }), X.jsx(`button`, {
                  className: `bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors`,
                  children: X.jsx(En, {
                    size: 14,
                    strokeWidth: 3
                  })
                })]
              })]
            })]
          })]
        })]
      }), s === `lasso` && A && Un.createPortal(X.jsxs(`div`, {
        className: `fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex flex-col nodrag nowheel`,
        onClick: e => e.stopPropagation(),
        onWheel: e => e.stopPropagation(),
        children: [X.jsxs(`div`, {
          className: `flex items-center justify-between px-4 py-2 bg-black/60 border-b border-white/10`,
          children: [X.jsxs(`div`, {
            className: `flex items-center gap-2 text-gray-200 text-sm`,
            children: [X.jsx(b, {
              size: 16,
              className: `text-blue-400`
            }), X.jsx(`span`, {
              children: `切刀（全屏聚焦）`
            }), X.jsxs(`span`, {
              className: `text-xs text-gray-400 ml-2`,
              children: [`已绘制 `, R, ` 块 · 起/终点贴近边时会自动吸附`]
            })]
          }), X.jsxs(`div`, {
            className: `flex items-center gap-2`,
            children: [X.jsxs(`button`, {
              className: `flex items-center gap-1 px-2 py-1 rounded border bg-[#2a2a2a] border-[#444] text-gray-200 hover:text-white hover:border-[#666] text-xs disabled:opacity-50`,
              onClick: W,
              disabled: _.length === 0,
              children: [X.jsx(S, {
                size: 13
              }), ` 清空`]
            }), X.jsxs(`button`, {
              className: `flex items-center gap-1 px-2 py-1 rounded border bg-[#2a2a2a] border-[#444] text-gray-200 hover:text-white hover:border-[#666] text-xs`,
              onClick: () => j(false),
              title: `退出全屏 (Esc)`,
              children: [X.jsx(yn, {
                size: 13
              }), ` 关闭`]
            })]
          })]
        }), X.jsx(`div`, {
          className: `flex-1 flex items-center justify-center p-6`,
          children: X.jsxs(`div`, {
            className: `relative max-w-full max-h-full`,
            style: {
              aspectRatio: `auto`
            },
            children: [X.jsx(`img`, {
              src: L,
              alt: `Source`,
              className: `max-w-[90vw] max-h-[80vh] object-contain block select-none pointer-events-none`,
              draggable: false
            }), X.jsxs(`div`, {
              ref: oe,
              className: `absolute inset-0`,
              style: {
                cursor: oo
              },
              onMouseDown: U,
              children: [X.jsx(`svg`, {
                className: `absolute inset-0 w-full h-full pointer-events-none`,
                viewBox: `0 0 100 100`,
                preserveAspectRatio: `none`,
                children: _.map(e => {
                  if (e.points.length < 2) return null;
                  let t = e.points.map((e, t) => `${t === 0 ? `M` : `L`} ${e.x * 100} ${e.y * 100}`).join(` `) + (e.closed ? ` Z` : ``),
                    n = e.id === y;
                  return X.jsx(`path`, {
                    d: t,
                    fill: e.closed ? n ? `rgba(59,130,246,0.30)` : `rgba(59,130,246,0.18)` : `none`,
                    stroke: n ? `#60a5fa` : `#3b82f6`,
                    strokeWidth: .3,
                    vectorEffect: `non-scaling-stroke`
                  }, e.id);
                })
              }), ge.map((e, t) => X.jsx(`div`, {
                className: `absolute -translate-x-1/2 -translate-y-1/2`,
                style: {
                  left: `${e.cx * 100}%`,
                  top: `${e.cy * 100}%`
                },
                children: X.jsxs(`button`, {
                  className: `flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono cursor-pointer border ${y === e.id ? `bg-blue-500 text-white border-blue-300` : `bg-black/70 text-white border-white/30 hover:bg-blue-500/80`}`,
                  onClick: n => {
                    if (n.stopPropagation(), n.shiftKey) {
                      de(e.id);
                      return;
                    }
                    x(e.id), pe(t);
                  },
                  title: `点击切出 / Shift+点击删除`,
                  children: [X.jsx(`span`, {
                    children: t + 1
                  }), ie.has(t) && X.jsx(Pn, {
                    size: 12,
                    className: `text-green-400`
                  })]
                })
              }, e.id))]
            })]
          })
        }), X.jsx(`div`, {
          className: `px-4 py-2 bg-black/60 border-t border-white/10 text-[11px] text-gray-300 leading-snug`,
          children: `按住鼠标在图上画一圈生成一个透明形状；起点或终点贴近图片边缘时会自动吸附到该边，并沿边自动闭合多边形（适合切人物 / 主体）。Shift + 点击编号可删除形状。`
        })]
      }), document.body)]
    });
  }),