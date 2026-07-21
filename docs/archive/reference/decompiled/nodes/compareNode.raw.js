/**
 * 节点类型: compareNode
 * 原版函数名: Lc
 * 原版行号: L18501-L18811
 * 来源: App-B9jVCs-a.decompiled.js
 *
 * 变量映射（vendor-map.json）:
// _ → tU
// _r → Rl
// a → ZK
// b → dT
// c → tK
// ct → qd
// d → zG
// e → i
// f → MG
// g → qU
// h → xW
// i → jq
// j → GE
// k → cO
// l → VG
// ln → Ku
// m → LW
// mn → Vu
// n → Fq
// o → oK
// p → VW
// r → Nq
// s → iK
// t → e1
// tt → WC
// u → BG
// ut → Gd
// v → XH
// w → xT
// wt → jd
// x → Y
// y → Mk
// z → Rw
 */

var Lc = Y.memo(({
    id: e,
    data: n,
    selected: r
  }) => {
    let {
        updateNodeData: i
      } = Gt(),
      a = n,
      [o, s] = Y.useState(n.split ?? .5),
      [c, l] = Y.useState(n.orientation || `v`),
      [u, d] = Y.useState(false),
      [f, p] = Y.useState(``),
      [m, h] = Y.useState(0),
      g = Y.useRef(null),
      _ = Y.useRef(false),
      v = Y.useRef(null),
      y = Y.useRef(null),
      b = Y.useRef(null),
      x = Y.useRef(null),
      S = t({
        handleType: `target`
      }),
      C = ut(Y.useMemo(() => S.map(e => e.source), [S])),
      [w, T] = Y.useMemo(() => {
        let e = Array.isArray(C) ? C : C ? [C] : [],
          t = [];
        for (let n of S) {
          let r = e.find(e => e.id === n.source)?.data,
            i = Ic(r);
          if (i && !t.some(e => e.url === i) && t.push({
            url: i,
            kind: Fc(i)
          }), t.length >= 2) break;
        }
        return [t[0] || null, t[1] || null];
      }, [C, S]);
    Y.useEffect(() => {
      i(e, {
        split: o,
        orientation: c
      });
    }, [o, c, e, i]);
    let E = Y.useCallback((e, t) => {
        let n = g.current;
        if (!n) return;
        let r = n.getBoundingClientRect(),
          i = c === `v` ? (e - r.left) / r.width : (t - r.top) / r.height;
        s(Math.max(0, Math.min(1, i)));
      }, [c]),
      D = e => {
        e.stopPropagation(), _.current = true, e.target.setPointerCapture?.(e.pointerId), E(e.clientX, e.clientY);
      },
      O = e => {
        _.current && E(e.clientX, e.clientY);
      },
      k = e => {
        _.current = false, e.target.releasePointerCapture?.(e.pointerId);
      },
      A = w?.kind === `video` || T?.kind === `video`,
      j = !!w && !!T,
      M = a.labelA || `A`,
      N = a.labelB || `B`,
      P = Y.useCallback(() => {
        let e = !u;
        d(e), [v.current, y.current].forEach(t => {
          t && (e ? t.play().catch(() => {}) : t.pause());
        });
      }, [u]),
      F = Y.useCallback(() => {
        let e = v.current,
          t = y.current;
        e && t && Math.abs(e.currentTime - t.currentTime) > .15 && (t.currentTime = e.currentTime);
      }, []),
      I = () => {
        s(.5), [v.current, y.current].forEach(e => {
          e && (e.currentTime = 0);
        });
      },
      L = Y.useCallback(() => {
        let e = w?.kind === `video` ? v.current : b.current,
          t = T?.kind === `video` ? y.current : x.current;
        return !e || !t ? null : [e, t];
      }, [w, T]),
      ee = Y.useCallback(async () => {
        let t = L();
        if (t) {
          p(`export`);
          try {
            let n = await ii(await jc(await Mc(t[0], t[1], {
              mode: `slider`,
              orientation: c,
              split: o,
              drawDivider: true
            })), {
              preferThumbnail: true,
              subfolder: `canvas/compare`
            });
            a.onSpawnImageNode?.(e, n.url, `对比图`), a.onShowToast?.(`已生成对比图节点`);
          } catch (e) {
            a.onShowToast?.(e?.message || `生成对比图失败`);
          } finally {
            p(``);
          }
        }
      }, [L, c, o, e, a]),
      R = Y.useCallback(async () => {
        let t = L();
        if (t) {
          p(`record`), h(0);
          try {
            let {
                blob: n,
                ext: r
              } = await Pc({
                a: t[0],
                b: t[1],
                mode: `slider`,
                orientation: c,
                durationMs: 4e3,
                fps: 30,
                onProgress: e => h(Math.round(e * 100))
              }),
              i = await ii(await jc(n), {
                subfolder: `canvas/compare`
              }),
              o = /\.(mp4|webm|mov)($|\?)/i.test(i.url) ? i.url : `${i.url}#.${r}`;
            a.onSpawnImageNode?.(e, o, `对比视频`), a.onShowToast?.(`已生成对比视频节点，可连「视频转GIF」转 GIF`);
          } catch (e) {
            a.onShowToast?.(e?.message || `录制失败`);
          } finally {
            p(``), h(0);
          }
        }
      }, [L, c, e, a]),
      B = (e, t) => e.kind === `video` ? X.jsx(`video`, {
        ref: t ? v : y,
        src: e.url,
        crossOrigin: `anonymous`,
        className: `absolute inset-0 w-full h-full object-contain bg-black`,
        muted: true,
        loop: true,
        playsInline: true,
        onTimeUpdate: t ? F : undefined
      }) : X.jsx(`img`, {
        ref: t ? b : x,
        src: e.url,
        crossOrigin: `anonymous`,
        alt: t ? `A` : `B`,
        className: `absolute inset-0 w-full h-full object-contain bg-black`,
        draggable: false
      });
    return X.jsxs(`div`, {
      className: `relative group/node w-full h-full min-w-[360px] min-h-[300px]`,
      children: [X.jsx(si, {
        id: e,
        data: n,
        defaultTitle: `对比工具`,
        icon: X.jsx(ke, {
          size: 11,
          className: `text-gray-500`
        }),
        floating: true
      }), X.jsx(ci, {
        visible: !!r,
        minWidth: 360,
        minHeight: 300
      }), X.jsxs(`div`, {
        className: `w-full h-full bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 flex flex-col drag-handle cursor-move ${r ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`,
        children: [X.jsx(_r, {
          type: `target`,
          position: J.Left
        }), X.jsx(`div`, {
          className: `relative flex-1 m-2 rounded-lg overflow-hidden bg-black select-none`,
          children: j ? X.jsxs(`div`, {
            ref: g,
            className: `nodrag absolute inset-0`,
            onPointerDown: D,
            onPointerMove: O,
            onPointerUp: k,
            style: {
              cursor: c === `v` ? `ew-resize` : `ns-resize`,
              touchAction: `none`
            },
            children: [B(T, false), X.jsx(`div`, {
              className: `absolute inset-0`,
              style: {
                clipPath: c === `v` ? `inset(0 ${(1 - o) * 100}% 0 0)` : `inset(0 0 ${(1 - o) * 100}% 0)`
              },
              children: B(w, true)
            }), X.jsx(`div`, {
              className: `absolute bg-white/90 shadow-[0_0_6px_rgba(0,0,0,0.6)] pointer-events-none`,
              style: c === `v` ? {
                left: `${o * 100}%`,
                top: 0,
                bottom: 0,
                width: 2,
                transform: `translateX(-1px)`
              } : {
                top: `${o * 100}%`,
                left: 0,
                right: 0,
                height: 2,
                transform: `translateY(-1px)`
              },
              children: X.jsx(`div`, {
                className: `absolute bg-white rounded-full flex items-center justify-center shadow-lg text-[#141414]`,
                style: c === `v` ? {
                  top: `50%`,
                  left: `50%`,
                  width: 26,
                  height: 26,
                  transform: `translate(-50%, -50%)`
                } : {
                  left: `50%`,
                  top: `50%`,
                  width: 26,
                  height: 26,
                  transform: `translate(-50%, -50%)`
                },
                children: c === `v` ? X.jsx(tt, {
                  size: 14
                }) : X.jsx(ln, {
                  size: 14
                })
              })
            }), X.jsx(`span`, {
              className: `absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white pointer-events-none`,
              children: M
            }), X.jsx(`span`, {
              className: `absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white pointer-events-none`,
              children: N
            })]
          }) : X.jsxs(`div`, {
            className: `absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500`,
            children: [X.jsx(ke, {
              size: 24
            }), X.jsx(`span`, {
              className: `text-[11px]`,
              children: `连接 2 个图片 / 视频节点进行对比`
            }), X.jsxs(`span`, {
              className: `text-[10px] text-gray-600`,
              children: [`已连接 `, [w, T].filter(Boolean).length, ` / 2`]
            })]
          })
        }), X.jsxs(`div`, {
          className: `flex items-center gap-2 px-2.5 pb-2.5`,
          children: [X.jsx(`button`, {
            onClick: () => l(e => e === `v` ? `h` : `v`),
            className: `nodrag flex items-center justify-center h-7 w-7 rounded-md text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] transition-colors`,
            title: c === `v` ? `切换为上下对比` : `切换为左右对比`,
            children: c === `v` ? X.jsx(tt, {
              size: 14
            }) : X.jsx(ln, {
              size: 14
            })
          }), X.jsx(`button`, {
            onClick: I,
            className: `nodrag flex items-center justify-center h-7 w-7 rounded-md text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] transition-colors`,
            title: `重置`,
            children: X.jsx(z, {
              size: 14
            })
          }), A && X.jsx(`button`, {
            onClick: P,
            disabled: !j,
            className: `nodrag flex items-center justify-center h-7 w-7 rounded-md text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] disabled:opacity-40 transition-colors`,
            title: u ? `暂停` : `播放`,
            children: u ? X.jsx(wt, {
              size: 14
            }) : X.jsx(ct, {
              size: 14
            })
          }), X.jsxs(`div`, {
            className: `ml-auto flex items-center gap-1.5`,
            children: [X.jsxs(`button`, {
              onClick: ee,
              disabled: !j || !!f,
              className: `nodrag flex items-center justify-center gap-1 h-7 px-2.5 rounded-md text-[11px] text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] disabled:opacity-40 transition-colors`,
              title: `生成对比图节点`,
              children: [f === `export` ? X.jsx(Nn, {
                size: 13,
                className: `animate-spin`
              }) : X.jsx(mn, {
                size: 13
              }), ` 导图`]
            }), X.jsx(`button`, {
              onClick: R,
              disabled: !j || !!f,
              className: `nodrag flex items-center justify-center gap-1 h-7 px-2.5 rounded-md text-[11px] text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] disabled:opacity-40 transition-colors`,
              title: `生成对比视频节点（可连视频转GIF）`,
              children: f === `record` ? X.jsxs(X.Fragment, {
                children: [X.jsx(Nn, {
                  size: 13,
                  className: `animate-spin`
                }), ` `, m, `%`]
              }) : X.jsxs(X.Fragment, {
                children: [X.jsx(Ke, {
                  size: 13
                }), ` 生成视频`]
              })
            })]
          })]
        }), X.jsx(_r, {
          type: `source`,
          position: J.Right,
          id: `main-output`
        })]
      })]
    });
  }),