/**
 * 节点类型: gridMergeNode
 * 原版函数名: To
 * 原版行号: L7906-L8591
 * 来源: App-B9jVCs-a.decompiled.js
 *
 * 变量映射（vendor-map.json）:
// _ → tU
// _r → Rl
// a → ZK
// b → dT
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
// z → Rw
 */

  To = Y.memo(({
    id: e,
    data: n,
    selected: r
  }) => {
    let i = typeof n.gridSize == `number` ? n.gridSize : undefined,
      a = n.rows ?? i ?? 3,
      o = n.cols ?? i ?? 3,
      [s, c] = Y.useState(n.mergeMode || `grid`),
      [l, u] = Y.useState(a),
      [d, f] = Y.useState(o),
      [p, m] = Y.useState(n.cellSize || 512),
      [h, g] = Y.useState(n.aspectRatio || `1:1`),
      [_, v] = Y.useState(n.autoSize ?? true),
      [y, b] = Y.useState(n.titlePattern || ``),
      [x, S] = Y.useState(n.longDirection || `vertical`),
      [C, w] = Y.useState(n.longGap ?? 0),
      [T, D] = Y.useState(n.longTargetSize ?? 1024),
      [k, A] = Y.useState(n.longAutoSize ?? true),
      [j, M] = Y.useState(false),
      [N, P] = Y.useState(`${a}x${o}`),
      [F, I] = Y.useState(n.bgColor || `transparent`),
      [ee, R] = Y.useState(n.imageUrl || null),
      [z, B] = Y.useState(null),
      [te, ne] = Y.useState(false),
      [re, ie] = Y.useState([]),
      [ae, oe] = Y.useState([]),
      [se, ce] = Y.useState(null),
      [le, ue] = Y.useState(null),
      V = Y.useRef(false),
      H = Y.useRef(``),
      [U, de] = Y.useState(() => {
        let e = n.overlayState;
        return e && Array.isArray(e.layers) ? e : {
          layers: [],
          canvasWidth: n.canvasWidth || 1024,
          canvasHeight: n.canvasHeight || 1024
        };
      }),
      W = Et(),
      {
        updateNodeData: fe
      } = Gt();
    Y.useEffect(() => {
      W(e);
    }, [l, d, s, e, W]), Y.useEffect(() => {
      fe(e, {
        mergeMode: s,
        rows: l,
        cols: d,
        cellSize: p,
        aspectRatio: h,
        autoSize: _,
        titlePattern: y,
        longDirection: x,
        longGap: C,
        longTargetSize: T,
        longAutoSize: k,
        bgColor: F,
        overlayState: U,
        canvasWidth: U.canvasWidth,
        canvasHeight: U.canvasHeight
      });
    }, [s, l, d, p, h, _, y, x, C, T, k, F, U, e, fe]), Y.useEffect(() => {
      U.bgColor !== F && de(e => ({
        ...e,
        bgColor: F
      }));
    }, [F]);
    let pe = t({
        handleType: `target`
      }),
      me = ut(pe.map(e => e.source));
    Y.useEffect(() => {
      let e = l * d,
        t = Array(e).fill(null),
        n = [],
        r = 0,
        i = me ? Array.isArray(me) ? me : [me] : [];
      for (let a of pe) {
        let o = a.targetHandle,
          s = i.find(e => e.id === a.source)?.data;
        if (!s) continue;
        let c = () => {
          if (s.images && Array.isArray(s.images)) {
            let e = s.images,
              t = s.selectedIds || [];
            if (t.length > 0) {
              let n = new Set(t),
                r = [];
              if (e.forEach(e => {
                e?.url && n.has(e.id) && r.push(e.url);
              }), r.length > 0) return r;
            }
            let n = e.map(e => e?.url).filter(e => !!e);
            if (n.length > 0) return n;
          }
          return Array.isArray(s.extractedImages) ? s.extractedImages.filter(Boolean) : s.imageUrl ? [s.imageUrl] : [];
        };
        if (o === "default" || !o) {
          let e = c();
          for (let i of e) {
            for (n.push(i); r < t.length && t[r] !== null;) r++;
            r < t.length && (t[r] = i);
          }
        } else if (o && o.startsWith(`cell-`)) {
          let r = parseInt(o.replace(`cell-`, ``), 10);
          if (r >= 0 && r < e) {
            if (s.imageUrl) t[r] = s.imageUrl, n.push(s.imageUrl);else if (Array.isArray(s.extractedImages)) {
              let e = s.extractedImages.find(Boolean);
              e && (t[r] = e, n.push(e));
            }
          }
        }
      }
      ie(e => {
        let r = JSON.stringify(n);
        return r === H.current ? V.current && e.length === t.length ? e : t : (H.current = r, V.current = false, t);
      }), oe(e => V.current && e.length === n.length ? e : n);
    }, [pe, me, l, d]);
    let G = Y.useRef(null),
      he = Y.useCallback(async e => {
        try {
          if (s === `longImage`) {
            let t = ae;
            if (t.length === 0) return null;
            let n = (await Promise.all(t.map(Co))).filter(Boolean);
            if (n.length === 0) return null;
            let r = x === `vertical`,
              i = k ? r ? n[0].width : n[0].height : T,
              a = 0,
              o = 0,
              s = [];
            if (r) {
              a = i;
              for (let e of n) {
                let t = i,
                  n = Math.round(e.height / e.width * i);
                s.push({
                  w: t,
                  h: n
                }), o += n;
              }
              o += C * Math.max(0, n.length - 1);
            } else {
              o = i;
              for (let e of n) {
                let t = i,
                  n = Math.round(e.width / e.height * i);
                s.push({
                  w: n,
                  h: t
                }), a += n;
              }
              a += C * Math.max(0, n.length - 1);
            }
            let c = e ? 1 : Math.min(1, 800 / Math.max(a, o)),
              l = document.createElement(`canvas`);
            l.width = Math.max(1, Math.round(a * c)), l.height = Math.max(1, Math.round(o * c));
            let u = l.getContext(`2d`);
            if (!u) return null;
            wo(u, l.width, l.height, e, F);
            let d = 0;
            return n.forEach((e, t) => {
              let n = s[t],
                i = n.w * c,
                a = n.h * c;
              r ? (u.drawImage(e, 0, d, i, a), d += a + C * c) : (u.drawImage(e, d, 0, i, a), d += i + C * c);
            }), l.toDataURL(e ? `image/png` : `image/jpeg`, e ? 1 : .85);
          }
          if (s === `grid`) {
            let t = l * d,
              n = re.slice(0, t),
              r = await Promise.all(n.map(e => e ? Co(e) : Promise.resolve(null))),
              i = p,
              a = p,
              o = r.find(Boolean);
            if (_ && o) i = o.width, a = o.height;else {
              let [e, t] = h.split(`:`).map(Number),
                n = e / t;
              a = Math.round(p / n);
            }
            let s = i * d,
              c = a * l,
              u = e ? 1 : Math.min(1, 600 / Math.max(s, c)),
              f = document.createElement(`canvas`);
            f.width = Math.max(1, Math.round(s * u)), f.height = Math.max(1, Math.round(c * u));
            let m = f.getContext(`2d`);
            return m ? (wo(m, f.width, f.height, e, F, {
              rows: l,
              cols: d,
              cellW: i * u,
              cellH: a * u
            }), r.forEach((e, n) => {
              if (n >= t) return;
              let r = Math.floor(n / d),
                o = n % d * i * u,
                s = r * a * u,
                c = i * u,
                l = a * u;
              e && m.drawImage(e, o, s, c, l);
              let f = y.trim() ? y.replace(`{num}`, (n + 1).toString()) : ``;
              if (f) {
                let e = Math.max(12, c * .08);
                m.font = `bold ${e}px sans-serif`;
                let t = m.measureText(f),
                  n = e * .6,
                  r = e * .4,
                  i = t.width + n * 2,
                  a = e + r * 2,
                  l = c * .03;
                m.fillStyle = `rgba(0,0,0,0.75)`;
                let u = o + l,
                  d = s + l;
                m.beginPath(), typeof m.roundRect == `function` ? m.roundRect(u, d, i, a, 8) : m.rect(u, d, i, a), m.fill(), m.fillStyle = `#fff`, m.textBaseline = `middle`, m.textAlign = `center`, m.fillText(f, u + i / 2, d + a / 2 + 2);
              }
            }), f.toDataURL(e ? `image/png` : `image/jpeg`, e ? 1 : .85)) : null;
          }
          return null;
        } catch (e) {
          return console.error(`renderToCanvas failed`, e), null;
        }
      }, [s, ae, x, k, T, C, re, l, d, p, _, h, y, F]);
    Y.useEffect(() => (G.current && window.clearTimeout(G.current), G.current = window.setTimeout(async () => {
      B(await he(false));
    }, 250), () => {
      G.current && window.clearTimeout(G.current);
    }), [he]);
    let ge = Y.useCallback(async () => {
        if (!(s === `longImage` && ae.length === 0) && !(s === `grid` && re.every(e => !e)) && !(s === `overlay` && U.layers.length === 0)) {
          ne(true);
          try {
            let t = null;
            t = s === `overlay` ? await _o(U) : await he(true), t && (R(t), fe(e, {
              imageUrl: t
            }), W(e), typeof n.onSpawnImageNode == `function` && n.onSpawnImageNode(e, t, `merged-${s}`));
          } finally {
            ne(false);
          }
        }
      }, [s, ae, re, U, he, e, fe, W, n]),
      K = l * d,
      ve = (e, t) => l === e && d === t;
    Y.useMemo(() => null, []);
    let ye = Y.useMemo(() => s === `longImage` ? Math.max(1, ae.length || 3) : K, [s, ae.length, K]);
    return X.jsxs(`div`, {
      className: `relative flex flex-col`,
      children: [X.jsxs(`div`, {
        className: `mb-1 flex items-center justify-between gap-2 min-w-[320px]`,
        children: [X.jsx(si, {
          id: e,
          data: n,
          defaultTitle: `图像拼图`,
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
            title: `网格拼图`,
            children: [X.jsx(_e, {
              size: 11
            }), ` 网格`]
          }), X.jsxs(`button`, {
            className: `px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 border transition-colors ${s === `longImage` ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white`}`,
            onClick: () => c(`longImage`),
            title: `无限长图`,
            children: [X.jsx(O, {
              size: 11
            }), ` 长图`]
          }), X.jsxs(`button`, {
            className: `px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 border transition-colors ${s === `overlay` ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white`}`,
            onClick: () => c(`overlay`),
            title: `叠加`,
            children: [X.jsx(Ce, {
              size: 11
            }), ` 叠加`]
          })]
        })]
      }), X.jsxs(`div`, {
        className: `relative bg-[#1c1c1c] rounded-xl border shadow-xl transition-all duration-300 min-w-[320px] flex flex-col ${r ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`,
        children: [X.jsx(_r, {
          type: `target`,
          id: `default`,
          position: J.Left,
          className: `!w-4 !h-4 z-50`,
          style: {
            top: `15px`
          }
        }), X.jsx(_r, {
          type: `source`,
          position: J.Right,
          id: `merged-output`
        }), X.jsxs(`div`, {
          className: `p-3 space-y-3 bg-[#1a1a1a] ${ee ? `rounded-b-xl` : `rounded-xl`} relative drag-handle`,
          children: [s !== `overlay` && X.jsxs(`div`, {
            className: `bg-[#0d0c0c] rounded border border-[#333] flex items-center justify-center relative overflow-hidden nodrag`,
            style: {
              minHeight: 160,
              maxHeight: 360
            },
            children: [z ? X.jsx(`img`, {
              src: z,
              alt: `Preview`,
              className: `max-w-full max-h-[360px] object-contain block`
            }) : X.jsx(`div`, {
              className: `grid w-full p-2 gap-1 opacity-50`,
              style: {
                gridTemplateColumns: s === `longImage` ? `1fr` : `repeat(${d}, minmax(0, 1fr))`,
                gridTemplateRows: s === `longImage` ? `repeat(${ye}, minmax(40px, 1fr))` : `repeat(${l}, minmax(0, 1fr))`,
                minHeight: 160
              },
              children: Array.from({
                length: ye
              }).map((e, t) => X.jsxs(`div`, {
                className: `border border-[#333] border-dashed rounded-[2px] flex items-center justify-center bg-[#1a1a1a] text-[10px] text-[#555] min-h-[40px]`,
                children: [`图 `, t + 1]
              }, t))
            }), s === `grid` && X.jsx(`div`, {
              className: `absolute inset-0 grid gap-1 p-2 pointer-events-none`,
              style: {
                gridTemplateColumns: `repeat(${d}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${l}, minmax(0, 1fr))`
              },
              children: Array.from({
                length: K
              }).map((e, t) => {
                let n = re[t],
                  r = se === t,
                  i = se !== null && se !== t && le === t;
                return X.jsxs(`div`, {
                  className: `relative pointer-events-auto group/cell rounded-[2px] transition-all
                      ${n ? `cursor-grab active:cursor-grabbing` : ``}
                      ${r ? `opacity-30 ring-2 ring-blue-300` : ``}
                      ${i ? `ring-2 ring-blue-400 bg-blue-400/15 shadow-[inset_0_0_0_2px_rgba(96,165,250,0.6)]` : ``}
                    `,
                  draggable: !!n,
                  onDragStart: e => {
                    if (!n) return;
                    e.stopPropagation(), ce(t), e.dataTransfer.effectAllowed = `move`, e.dataTransfer.setData(`application/x-yimao-puzzle`, String(t));
                    let r = document.createElement(`div`);
                    r.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;`, document.body.appendChild(r), e.dataTransfer.setDragImage(r, 0, 0), setTimeout(() => {
                      try {
                        document.body.removeChild(r);
                      } catch {}
                    }, 0);
                  },
                  onDragEnter: e => {
                    se !== null && (e.preventDefault(), e.stopPropagation(), ue(t));
                  },
                  onDragOver: e => {
                    se !== null && (e.preventDefault(), e.stopPropagation(), e.dataTransfer.dropEffect = `move`);
                  },
                  onDragLeave: e => {
                    e.stopPropagation(), ue(e => e === t ? null : e);
                  },
                  onDrop: e => {
                    e.preventDefault(), e.stopPropagation();
                    let n = e.dataTransfer.getData(`application/x-yimao-puzzle`),
                      r = n ? parseInt(n, 10) : se ?? -1;
                    if (r < 0 || r === t || Number.isNaN(r)) {
                      ce(null), ue(null);
                      return;
                    }
                    V.current = true, ie(e => {
                      let n = e.slice(),
                        i = n[r];
                      return n[r] = n[t], n[t] = i, n;
                    }), ce(null), ue(null);
                  },
                  onDragEnd: e => {
                    e.stopPropagation(), ce(null), ue(null);
                  },
                  title: n ? `第 ${t + 1} 格：拖到其它格子可交换位置` : ``,
                  children: [se !== null && X.jsx(`span`, {
                    className: `absolute top-1 right-1 px-1 py-px rounded text-[9px] font-mono pointer-events-none transition-colors
                        ${i ? `bg-blue-500 text-white` : `bg-black/60 text-white/80`}
                      `,
                    children: t + 1
                  }), X.jsx(E, {
                    type: `target`,
                    position: J.Left,
                    id: `cell-${t}`,
                    className: `!opacity-0 group-hover/cell:!opacity-100 !w-1.5 !h-1.5 !bg-blue-500 !border-[1px] !border-white !rounded-full transition-opacity cursor-crosshair z-[100]`,
                    style: {
                      top: `50%`,
                      left: `50%`,
                      transform: `translate(-50%, -50%)`,
                      minWidth: `6px`,
                      minHeight: `6px`
                    }
                  })]
                }, t);
              })
            }), s === `longImage` && ae.length > 0 && X.jsx(`div`, {
              className: `absolute inset-0 grid p-2 gap-0 pointer-events-none`,
              style: {
                gridTemplateColumns: x === `horizontal` ? `repeat(${ae.length}, minmax(0, 1fr))` : `1fr`,
                gridTemplateRows: x === `vertical` ? `repeat(${ae.length}, minmax(0, 1fr))` : `1fr`
              },
              children: ae.map((e, t) => {
                let n = se === t,
                  r = se !== null && se !== t && le === t;
                return X.jsx(`div`, {
                  className: `pointer-events-auto cursor-grab active:cursor-grabbing rounded-[2px] transition-all
                      ${n ? `opacity-30 ring-2 ring-blue-300` : ``}
                      ${r ? `ring-2 ring-blue-400 bg-blue-400/15 shadow-[inset_0_0_0_2px_rgba(96,165,250,0.6)]` : ``}
                    `,
                  draggable: true,
                  onDragStart: e => {
                    e.stopPropagation(), ce(t), e.dataTransfer.effectAllowed = `move`, e.dataTransfer.setData(`application/x-yimao-puzzle`, String(t));
                    let n = document.createElement(`div`);
                    n.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;`, document.body.appendChild(n), e.dataTransfer.setDragImage(n, 0, 0), setTimeout(() => {
                      try {
                        document.body.removeChild(n);
                      } catch {}
                    }, 0);
                  },
                  onDragEnter: e => {
                    se !== null && (e.preventDefault(), e.stopPropagation(), ue(t));
                  },
                  onDragOver: e => {
                    se !== null && (e.preventDefault(), e.stopPropagation(), e.dataTransfer.dropEffect = `move`);
                  },
                  onDragLeave: e => {
                    e.stopPropagation(), ue(e => e === t ? null : e);
                  },
                  onDrop: e => {
                    e.preventDefault(), e.stopPropagation();
                    let n = e.dataTransfer.getData(`application/x-yimao-puzzle`),
                      r = n ? parseInt(n, 10) : se ?? -1;
                    if (r < 0 || r === t || Number.isNaN(r)) {
                      ce(null), ue(null);
                      return;
                    }
                    V.current = true, oe(e => {
                      let n = e.slice(),
                        i = n[r];
                      return n[r] = n[t], n[t] = i, n;
                    }), ce(null), ue(null);
                  },
                  onDragEnd: e => {
                    e.stopPropagation(), ce(null), ue(null);
                  },
                  title: `第 ${t + 1} 张：拖到其它项可交换顺序`,
                  children: se !== null && X.jsx(`span`, {
                    className: `absolute m-1 px-1 py-px rounded text-[9px] font-mono pointer-events-none transition-colors
                        ${r ? `bg-blue-500 text-white` : `bg-black/60 text-white/80`}
                      `,
                    children: t + 1
                  })
                }, t);
              })
            }), te && X.jsx(`div`, {
              className: `absolute inset-0 bg-black/50 flex items-center justify-center`,
              children: X.jsx(L, {
                className: `animate-spin text-white`
              })
            })]
          }), X.jsxs(`div`, {
            className: `space-y-2 nodrag`,
            children: [X.jsxs(`div`, {
              className: `flex items-center gap-1.5 text-[10px] text-gray-400`,
              children: [X.jsx(`span`, {
                children: `背景`
              }), X.jsx(`button`, {
                className: `px-1.5 py-0.5 rounded border text-[10px] transition-colors ${F === `transparent` ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white`}`,
                onClick: () => I(`transparent`),
                title: `透明背景（导出 PNG 保留透明通道）`,
                children: `透明`
              }), X.jsx(`input`, {
                type: `color`,
                value: F === `transparent` ? `#000000` : F,
                onChange: e => I(e.target.value),
                className: `w-6 h-5 rounded border border-[#333] bg-transparent cursor-pointer`,
                title: `自定义背景色`
              }), F !== `transparent` && X.jsx(`span`, {
                className: `font-mono text-gray-500`,
                children: F
              })]
            }), s === `grid` && X.jsxs(X.Fragment, {
              children: [X.jsxs(`div`, {
                className: `flex flex-wrap items-center gap-1`,
                children: [bo.map(e => X.jsx(`button`, {
                  className: `text-[10px] px-2 py-0.5 rounded border transition-colors ${ve(e.rows, e.cols) ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white hover:border-[#555]`}`,
                  onClick: () => {
                    u(e.rows), f(e.cols), P(`${e.rows}x${e.cols}`);
                  },
                  children: e.label
                }, e.label)), X.jsx(`button`, {
                  className: `text-[10px] px-2 py-0.5 rounded border transition-colors ${j ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white hover:border-[#555]`}`,
                  onClick: () => M(e => !e),
                  children: `自定义`
                })]
              }), j && X.jsxs(`div`, {
                className: `flex items-center gap-1.5 text-[10px] text-gray-400`,
                children: [X.jsx(`span`, {
                  children: `行`
                }), X.jsx(`input`, {
                  type: `number`,
                  min: 1,
                  max: 20,
                  value: l,
                  onChange: e => {
                    let t = xo(parseInt(e.target.value || `1`, 10) || 1, 1, 20);
                    u(t), P(`${t}x${d}`);
                  },
                  className: `w-12 bg-[#2a2a2a] text-gray-200 rounded px-1.5 py-0.5 border border-[#333] outline-none`
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
                    let t = xo(parseInt(e.target.value || `1`, 10) || 1, 1, 20);
                    f(t), P(`${l}x${t}`);
                  },
                  className: `w-12 bg-[#2a2a2a] text-gray-200 rounded px-1.5 py-0.5 border border-[#333] outline-none`
                }), X.jsx(`span`, {
                  className: `mx-1 text-[#555]`,
                  children: `|`
                }), X.jsx(`input`, {
                  type: `text`,
                  value: N,
                  placeholder: `1x5`,
                  onChange: e => P(e.target.value),
                  onBlur: () => {
                    let e = So(N);
                    e && (u(e.rows), f(e.cols));
                  },
                  onKeyDown: e => {
                    if (e.key === `Enter`) {
                      let e = So(N);
                      e && (u(e.rows), f(e.cols));
                    }
                  },
                  className: `flex-1 bg-[#2a2a2a] text-gray-200 rounded px-1.5 py-0.5 border border-[#333] outline-none`
                })]
              }), X.jsx(`div`, {
                className: `flex items-center gap-2`,
                children: X.jsx(`input`, {
                  className: `flex-1 bg-[#2a2a2a] text-gray-300 text-xs rounded px-2 py-1 border border-[#333] outline-none`,
                  placeholder: `分图角标，{num} 引入数字编号，可留空`,
                  value: y,
                  onChange: e => b(e.target.value)
                })
              }), X.jsxs(`div`, {
                className: `flex items-center gap-2`,
                children: [X.jsxs(`select`, {
                  value: _ ? `auto` : p,
                  onChange: e => {
                    let t = e.target.value;
                    t === `auto` ? v(true) : (v(false), m(Number(t)));
                  },
                  className: `bg-[#2a2a2a] text-gray-300 text-xs rounded px-2 py-1 border border-[#333] outline-none flex-1`,
                  title: `单格尺寸`,
                  children: [X.jsx(`option`, {
                    value: `auto`,
                    children: `自适应`
                  }), X.jsx(`option`, {
                    value: 256,
                    children: `256px`
                  }), X.jsx(`option`, {
                    value: 512,
                    children: `512px`
                  }), X.jsx(`option`, {
                    value: 1024,
                    children: `1024px`
                  }), X.jsx(`option`, {
                    value: 2048,
                    children: `2048px`
                  })]
                }), X.jsxs(`select`, {
                  value: h,
                  onChange: e => g(e.target.value),
                  className: `bg-[#2a2a2a] text-gray-300 text-xs rounded px-2 py-1 border border-[#333] outline-none flex-1`,
                  title: `比例`,
                  disabled: _,
                  style: {
                    opacity: _ ? .5 : 1
                  },
                  children: [X.jsx(`option`, {
                    value: `1:1`,
                    children: `1:1`
                  }), X.jsx(`option`, {
                    value: `16:9`,
                    children: `16:9`
                  }), X.jsx(`option`, {
                    value: `4:3`,
                    children: `4:3`
                  }), X.jsx(`option`, {
                    value: `3:4`,
                    children: `3:4`
                  }), X.jsx(`option`, {
                    value: `9:16`,
                    children: `9:16`
                  })]
                })]
              })]
            }), s === `longImage` && X.jsxs(`div`, {
              className: `space-y-2`,
              children: [X.jsxs(`div`, {
                className: `flex items-center gap-2 text-[10px] text-gray-400`,
                children: [X.jsx(`span`, {
                  children: `方向`
                }), X.jsx(`button`, {
                  className: `px-2 py-0.5 rounded border transition-colors ${x === `vertical` ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400`}`,
                  onClick: () => S(`vertical`),
                  children: `垂直`
                }), X.jsx(`button`, {
                  className: `px-2 py-0.5 rounded border transition-colors ${x === `horizontal` ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400`}`,
                  onClick: () => S(`horizontal`),
                  children: `水平`
                }), X.jsxs(`span`, {
                  className: `ml-auto`,
                  children: [ae.length, ` 张`]
                })]
              }), X.jsxs(`div`, {
                className: `flex items-center gap-2 text-[10px] text-gray-400`,
                children: [X.jsxs(`label`, {
                  className: `flex items-center gap-1 cursor-pointer`,
                  children: [X.jsx(`input`, {
                    type: `checkbox`,
                    checked: k,
                    onChange: e => A(e.target.checked),
                    className: `accent-blue-500`
                  }), ` 跟随首图`]
                }), X.jsx(`span`, {
                  children: x === `vertical` ? `宽度` : `高度`
                }), X.jsx(`input`, {
                  type: `number`,
                  min: 64,
                  max: 4096,
                  value: T,
                  onChange: e => D(xo(parseInt(e.target.value || `1024`, 10) || 1024, 64, 4096)),
                  disabled: k,
                  className: `w-20 bg-[#2a2a2a] text-gray-200 rounded px-1.5 py-0.5 border border-[#333] outline-none disabled:opacity-50`
                }), X.jsx(`span`, {
                  children: `间距`
                }), X.jsx(`input`, {
                  type: `number`,
                  min: 0,
                  max: 200,
                  value: C,
                  onChange: e => w(xo(parseInt(e.target.value || `0`, 10) || 0, 0, 200)),
                  className: `w-14 bg-[#2a2a2a] text-gray-200 rounded px-1.5 py-0.5 border border-[#333] outline-none`
                })]
              })]
            }), s === `overlay` && X.jsx(yo, {
              state: U,
              onChange: de,
              upstreamUrls: ae,
              onExport: t => {
                R(t), fe(e, {
                  imageUrl: t
                }), W(e);
              },
              onShowToast: e => {
                typeof n.onShowToast == `function` && n.onShowToast(e);
              }
            }), X.jsx(`div`, {
              className: `flex items-center gap-2`,
              children: X.jsx(`button`, {
                onClick: ge,
                disabled: s === `overlay` ? U.layers.length === 0 : pe.length === 0,
                className: `flex-1 py-1.5 rounded text-xs transition-colors ${(s === `overlay` ? U.layers.length > 0 : pe.length > 0) ? `bg-blue-600 text-white hover:bg-blue-500` : `bg-[#333] text-gray-500 cursor-not-allowed`}`,
                children: `开始合成`
              })
            })]
          })]
        }), X.jsx(_r, {
          type: `source`,
          position: J.Right,
          id: `batch-output`
        })]
      })]
    });
  }),