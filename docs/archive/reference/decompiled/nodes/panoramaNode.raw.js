/**
 * 节点类型: panoramaNode
 * 原版函数名: Yc
 * 原版行号: L19516-L20143
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
// jn → wu
// k → cO
// l → VG
// m → LW
// mr → Vl
// mt → Vd
// n → Fq
// o → oK
// p → VW
// pr → Hl
// pt → Hd
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
// yt → Id
// z → Rw
 */

  Yc = Y.memo(({
    id: e,
    data: n,
    selected: r
  }) => {
    let {
        updateNodeData: i,
        getNode: a,
        setNodes: o
      } = Gt(),
      [s, c] = Y.useState(75),
      [l, u] = Y.useState(false),
      [d, f] = Y.useState(n.panoType || `sphere`),
      p = a(e)?.measured?.width,
      m = a(e)?.measured?.height;
    Y.useEffect(() => {
      let e = [10, 50, 150, 300].map(e => setTimeout(() => window.dispatchEvent(new Event(`resize`)), e));
      return () => e.forEach(clearTimeout);
    }, [l, r, p, m]);
    let [h, g] = Y.useState(n.highQuality === undefined ? false : n.highQuality),
      [_, v] = Y.useState(false),
      [y, b] = Y.useState(null),
      x = Y.useRef(null),
      S = Y.useRef(null),
      [C, w] = Y.useState(n.aspectRatio || `16:9`),
      [T, E] = Y.useState({
        w: 16,
        h: 9
      }),
      D = C === `custom` ? `${T.w}/${T.h}` : C.replace(`:`, `/`);
    Y.useEffect(() => {
      i(e, {
        aspectRatio: C,
        highQuality: h
      });
    }, [C, h, e]), Y.useEffect(() => {
      o(t => t.map(t => {
        if (t.id === e) {
          let e = t.measured?.width || t.width || 512,
            n = Math.round(e / (16 / 9)),
            r = t.style?.height || t.measured?.height || t.height || 288;
          if (Math.abs(r - n) > 1) return {
            ...t,
            style: {
              ...t.style,
              width: e,
              height: n
            }
          };
        }
        return t;
      }));
    }, [e]);
    let [O, k] = Y.useState(null),
      A = e => {
        k(e), setTimeout(() => k(null), 2500);
      },
      j = e => e >= 12 ? `正在截取12大视角…` : e >= 4 ? `正在截取四大视角…` : `正在截取当前视角…`,
      M = e => e >= 12 ? `twelve` : e >= 4 ? `four` : `current`;
    Y.useEffect(() => {
      if (!l) return;
      let e = e => {
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      };
      return window.addEventListener(`keydown`, e), () => {
        window.removeEventListener(`keydown`, e);
      };
    }, [l, n.showToast]);
    let N = ut(t({
        handleType: `target`
      }).map(e => e.source)),
      P = Y.useMemo(() => {
        if (N) {
          let e = (Array.isArray(N) ? N : [N]).find(e => {
            let t = e?.data?.imageUrl;
            return !!(t && !t.startsWith(`data:video/`) && !t.startsWith(`data:audio/`) && !t.startsWith(`data:text/`));
          });
          if (e) return e.data.imageUrl;
        }
        return n.imageUrl ? n.imageUrl : null;
      }, [N, n.imageUrl]),
      F = Y.useCallback(async (t = [0]) => {
        if (x.current) {
          if (b(M(t.length)), A(j(t.length)), v(true), !a(e)) {
            v(false);
            return;
          }
          try {
            let r = await S.current?.capture(t, D);
            if (r && r.length > 0) {
              if (t.length === 1 && r[0] && i(e, {
                imageUrl: r[0]
              }), typeof n.onCaptureToBox == `function`) {
                let i = r.map((e, n) => ({
                  url: e,
                  label: `全景截图 ${t[n]}度`
                }));
                n.onCaptureToBox(e, i);
              }
              typeof n.showToast == `function` && n.showToast(`已截图并放入图片盒子`), A(`截图已放入图片盒子`);
            }
          } catch (e) {
            console.error(`Screenshot failed`, e), A(`截图失败，请重试`);
          } finally {
            v(false), b(null);
          }
        }
      }, [e, i, n, D, a]);
    return X.jsxs(`div`, {
      className: `flex flex-col items-center group/node transition-shadow duration-200 w-full h-full ${r ? `z-50` : `z-10`}`,
      children: [X.jsx(si, {
        id: e,
        data: n,
        defaultTitle: `720全景图`,
        icon: X.jsx(Qe, {
          size: 11,
          className: `text-gray-500`
        })
      }), X.jsx(ci, {
        visible: !!r,
        minWidth: 512,
        keepAspectRatio: true
      }), X.jsx(_r, {
        type: `target`,
        position: J.Left
      }), X.jsxs(`div`, {
        className: `relative w-full h-full bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-[border-color,box-shadow] duration-200 group/image flex-1 flex flex-col ${r ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`,
        id: `pano-container-${e}`,
        style: {
          width: `100%`,
          height: `100%`
        },
        onWheel: e => {
          e.stopPropagation(), c(t => {
            let n = t + (e.deltaY > 0 ? 5 : -5);
            return Math.min(Math.max(n, 30), 120);
          });
        },
        children: [X.jsx(`div`, {
          className: `absolute top-0 left-0 w-full h-8 z-20 flex items-start justify-center pt-2 cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors opacity-0 group-hover/image:opacity-100`,
          children: X.jsx(`div`, {
            className: `w-12 h-1.5 bg-white/20 rounded-full pointer-events-none`
          })
        }), P ? X.jsxs(`div`, {
          className: `absolute inset-0 cursor-move nowheel nodrag z-0 overflow-hidden bg-black`,
          children: [X.jsx(yt, {
            resize: {
              debounce: 0
            },
            gl: {
              preserveDrawingBuffer: true,
              antialias: h,
              alpha: true,
              powerPreference: `high-performance`
            },
            dpr: h ? window.devicePixelRatio ? Math.max(window.devicePixelRatio, 2) : 2 : [1, 1.5],
            style: {
              position: `absolute`,
              top: 0,
              left: 0,
              width: `100%`,
              height: `100%`,
              display: `block`
            },
            children: X.jsx(Jc, {
              ref: S,
              url: P,
              panoType: d,
              fov: s,
              highQuality: h,
              orbitControlsRefLocal: x
            })
          }), X.jsxs(`div`, {
            className: `absolute top-1/2 left-4 -translate-y-1/2 flex flex-col items-center gap-1 z-30 bg-black/60 p-1.5 rounded-xl backdrop-blur-md border border-white/10 shadow-lg nodrag transition-opacity duration-300 ${_ ? `opacity-100 pointer-events-none` : `opacity-0 group-hover/image:opacity-100`}`,
            onClick: e => e.stopPropagation(),
            children: [X.jsx(`button`, {
              className: `p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all active:scale-95 ${y === `current` ? `text-white bg-white/10` : ``}`,
              onClick: () => F([0]),
              title: `当前视角截图`,
              children: X.jsx(Qe, {
                size: 16,
                className: y === `current` ? `animate-spin` : ``
              })
            }), X.jsx(`button`, {
              className: `p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all active:scale-95 ${y === `four` ? `text-white bg-white/10` : ``}`,
              onClick: () => F([90, 180, 270, 0]),
              title: `四大视角截图 (90, 180, 270, 0度)`,
              children: X.jsx(Tn, {
                size: 16,
                className: y === `four` ? `animate-spin` : ``
              })
            }), X.jsx(`button`, {
              className: `p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all active:scale-95 ${y === `twelve` ? `text-white bg-white/10` : ``}`,
              onClick: () => F([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]),
              title: `12大视角截图 (每30度)`,
              children: X.jsx(_e, {
                size: 16,
                className: y === `twelve` ? `animate-spin` : ``
              })
            })]
          }), X.jsxs(`div`, {
            className: `absolute top-6 left-1/2 -translate-x-1/2 z-30 flex items-center bg-black/60 backdrop-blur-md border border-white/10 rounded-lg p-1 nodrag shadow-lg max-w-[90%] overflow-hidden opacity-0 group-hover/image:opacity-100 transition-opacity duration-300`,
            onClick: e => e.stopPropagation(),
            children: [X.jsx(`span`, {
              className: `text-[10px] text-gray-400 px-2 whitespace-nowrap shrink-0`,
              children: `截图比例`
            }), X.jsxs(`select`, {
              value: C,
              onChange: e => w(e.target.value),
              className: `bg-transparent text-gray-200 text-[10px] pl-1 pr-4 py-0.5 outline-none cursor-pointer appearance-none text-center font-bold shrink-0`,
              style: {
                WebkitAppearance: `none`,
                MozAppearance: `none`
              },
              children: [X.jsx(`option`, {
                value: `16:9`,
                className: `bg-[#222]`,
                children: `16:9`
              }), X.jsx(`option`, {
                value: `9:16`,
                className: `bg-[#222]`,
                children: `9:16`
              }), X.jsx(`option`, {
                value: `1:1`,
                className: `bg-[#222]`,
                children: `1:1`
              }), X.jsx(`option`, {
                value: `custom`,
                className: `bg-[#222]`,
                children: `自定义`
              })]
            }), C === `custom` && X.jsxs(`div`, {
              className: `flex items-center gap-1 ml-2 mr-2 border-l border-white/20 pl-2 shrink-0`,
              children: [X.jsx(`input`, {
                type: `number`,
                value: T.w,
                onChange: e => E(t => ({
                  ...t,
                  w: Number(e.target.value)
                })),
                className: `w-8 bg-transparent text-gray-200 text-[10px] outline-none text-center border-b border-transparent focus:border-white/50 min-w-[32px]`
              }), X.jsx(`span`, {
                className: `text-gray-500`,
                children: `:`
              }), X.jsx(`input`, {
                type: `number`,
                value: T.h,
                onChange: e => E(t => ({
                  ...t,
                  h: Number(e.target.value)
                })),
                className: `w-8 bg-transparent text-gray-200 text-[10px] outline-none text-center border-b border-transparent focus:border-white/50 min-w-[32px]`
              })]
            })]
          }), O && X.jsx(`div`, {
            className: `absolute top-0 left-1/2 z-50 pointer-events-none nodrag flex items-center justify-center`,
            children: X.jsx(`div`, {
              className: `animate-[dropIn_2.5s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards] bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/30 px-6 py-3 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-center gap-2 mt-12`,
              children: X.jsx(`span`, {
                className: `text-white font-bold tracking-wider text-sm`,
                children: O
              })
            })
          }), _ && X.jsx(`div`, {
            className: `absolute inset-0 z-40 pointer-events-none nodrag flex items-center justify-center bg-black/20 backdrop-blur-[1px]`,
            children: X.jsxs(`div`, {
              className: `bg-black/80 border border-white/20 rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-3`,
              children: [X.jsx(`div`, {
                className: `w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin`
              }), X.jsx(`span`, {
                className: `text-white text-sm font-semibold`,
                children: `截图处理中…`
              })]
            })
          }), !_ && X.jsx(`div`, {
            className: `absolute inset-0 pointer-events-none z-[5]`,
            style: {
              display: `flex`,
              justifyContent: `center`,
              alignItems: `center`
            },
            children: X.jsx(`div`, {
              className: `border-[2px] border-dashed border-white/30 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] transition-all duration-300`,
              style: {
                aspectRatio: D,
                height: `100%`,
                maxHeight: `100%`,
                maxWidth: `100%`
              }
            })
          }), X.jsx(`button`, {
            className: `absolute top-6 right-4 p-2.5 bg-black/60 text-gray-300 hover:text-white hover:bg-white/20 rounded-lg backdrop-blur-md transition-all z-40 opacity-0 group-hover/image:opacity-100 border border-white/10 nodrag cursor-pointer shadow-lg duration-300`,
            title: `全屏漫游`,
            onPointerDown: e => e.stopPropagation(),
            onClick: e => {
              e.preventDefault(), e.stopPropagation(), u(true);
            },
            children: X.jsx(bt, {
              size: 18
            })
          })]
        }) : X.jsxs(`div`, {
          className: `w-full h-full flex flex-col items-center justify-center text-gray-600 bg-[#151515] transition-colors z-30 relative`,
          children: [X.jsx(jn, {
            size: 24,
            className: `mb-2`
          }), X.jsx(`span`, {
            className: `text-sm`,
            children: `等待输入全景图`
          }), X.jsx(`span`, {
            className: `text-xs mt-1 text-gray-500`,
            children: `请将图片节点连接到此节点`
          })]
        }), X.jsx(_r, {
          type: `source`,
          position: J.Right
        })]
      }), X.jsxs(`div`, {
        className: `hidden absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 bg-[#1c1c1c] rounded-2xl border border-[#333] shadow-2xl w-[400px] flex-col nodrag cursor-default transition-all duration-300 z-50 overflow-hidden`,
        onClick: e => e.stopPropagation(),
        children: [X.jsx(`div`, {
          className: `flex items-center justify-between px-3 py-2 border-b border-[#222] bg-[#1a1a1a]`,
          children: X.jsxs(`div`, {
            className: `flex items-center gap-2`,
            children: [X.jsx(Qe, {
              size: 14,
              className: `text-white`
            }), X.jsx(`span`, {
              className: `text-gray-200 text-xs font-medium`,
              children: typeof n.label == `string` && n.label.trim() !== `` ? n.label : `720全景图`
            })]
          })
        }), X.jsxs(`div`, {
          className: `flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-4 nodrag`,
          children: [X.jsxs(`div`, {
            className: `flex flex-col gap-2 shrink-0 hidden`,
            children: [X.jsx(`span`, {
              className: `text-xs text-gray-500 font-medium`,
              children: `画布设置`
            }), X.jsx(`div`, {
              className: `flex flex-wrap gap-3`,
              children: X.jsxs(`div`, {
                className: `flex-1 min-w-[140px] flex items-center justify-between gap-2 bg-[#222] p-2 rounded-lg border border-[#444] nodrag`,
                children: [X.jsx(`span`, {
                  className: `text-[10px] text-gray-400 whitespace-nowrap`,
                  children: `截图比例`
                }), X.jsxs(`select`, {
                  value: C,
                  onChange: e => w(e.target.value),
                  className: `flex-1 min-w-0 bg-[#111] text-gray-300 text-[10px] px-1 py-0.5 rounded border border-[#444] outline-none cursor-pointer focus:border-white/50`,
                  children: [X.jsx(`option`, {
                    value: `16:9`,
                    children: `16:9`
                  }), X.jsx(`option`, {
                    value: `9:16`,
                    children: `9:16`
                  }), X.jsx(`option`, {
                    value: `1:1`,
                    children: `1:1`
                  }), X.jsx(`option`, {
                    value: `custom`,
                    children: `自定义`
                  })]
                }), C === `custom` && X.jsxs(`div`, {
                  className: `flex items-center gap-1`,
                  children: [X.jsx(`input`, {
                    type: `number`,
                    value: T.w,
                    onChange: e => E(t => ({
                      ...t,
                      w: Number(e.target.value)
                    })),
                    className: `w-8 bg-[#111] text-gray-300 text-[10px] px-1 py-0.5 rounded border border-[#444] outline-none text-center focus:border-white/50`
                  }), X.jsx(`span`, {
                    className: `text-gray-500`,
                    children: `:`
                  }), X.jsx(`input`, {
                    type: `number`,
                    value: T.h,
                    onChange: e => E(t => ({
                      ...t,
                      h: Number(e.target.value)
                    })),
                    className: `w-8 bg-[#111] text-gray-300 text-[10px] px-1 py-0.5 rounded border border-[#444] outline-none text-center focus:border-white/50`
                  })]
                })]
              })
            })]
          }), X.jsx(`div`, {
            className: `flex flex-col gap-2 shrink-0`,
            children: X.jsxs(`div`, {
              className: `flex items-center justify-between mb-2`,
              children: [X.jsx(`span`, {
                className: `text-xs text-gray-500 font-medium`,
                children: `全景设置`
              }), X.jsxs(`div`, {
                className: `flex items-center gap-3`,
                children: [X.jsxs(`label`, {
                  className: `flex items-center gap-1.5 cursor-pointer`,
                  children: [X.jsx(`input`, {
                    type: `checkbox`,
                    checked: h,
                    onChange: e => g(e.target.checked),
                    className: `w-3 h-3 rounded border-[#444] bg-[#111] accent-white`
                  }), X.jsx(`span`, {
                    className: `text-[10px] text-gray-400 select-none`,
                    title: `开启抗锯接、原画分辨率，可能会导致卡顿`,
                    children: `高画质`
                  })]
                }), X.jsxs(`select`, {
                  value: d,
                  onChange: t => {
                    f(t.target.value), i(e, {
                      panoType: t.target.value
                    });
                  },
                  className: `ml-auto bg-[#111] text-gray-300 text-[10px] px-1 py-0.5 rounded border border-[#444] outline-none cursor-pointer`,
                  children: [X.jsx(`option`, {
                    value: `sphere`,
                    children: `球状全景`
                  }), X.jsx(`option`, {
                    value: `cylinder`,
                    children: `柱状全景`
                  })]
                })]
              })]
            })
          }), X.jsx(`div`, {
            className: `mt-auto pt-3`,
            children: X.jsxs(`button`, {
              type: `button`,
              className: `w-full py-2.5 bg-white hover:bg-gray-200 text-black text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all shrink-0 shadow-[0_0_20px_rgba(255,255,255,0.15)] transform hover:scale-[1.02]`,
              onClick: () => F(),
              children: [X.jsx(Qe, {
                size: 16
              }), ` 截图并生成节点`]
            })
          })]
        })]
      }), l && P && Un.createPortal(X.jsxs(`div`, {
        className: `fixed inset-0 z-[9999] bg-[#0a0a0a] flex flex-col`,
        onClick: e => e.stopPropagation(),
        children: [X.jsxs(`div`, {
          className: `absolute top-4 right-4 z-10 flex gap-2`,
          children: [X.jsxs(`button`, {
            className: `bg-white hover:bg-gray-200 text-black px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all transform hover:scale-105`,
            onClick: () => {
              F();
            },
            children: [X.jsx(Qe, {
              size: 18
            }), X.jsx(`span`, {
              className: `text-sm font-bold`,
              children: `截图`
            })]
          }), X.jsx(`button`, {
            className: `bg-black/50 hover:bg-white/10 text-white p-2.5 rounded-lg backdrop-blur border border-white/10 transition-colors`,
            onClick: () => u(false),
            children: X.jsx(yn, {
              size: 22
            })
          })]
        }), X.jsxs(`div`, {
          className: `absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center bg-black/60 backdrop-blur-md border border-white/10 rounded-lg p-1 shadow-lg`,
          onClick: e => e.stopPropagation(),
          children: [X.jsx(`span`, {
            className: `text-[12px] text-gray-400 px-3 whitespace-nowrap`,
            children: `截图比例`
          }), X.jsxs(`select`, {
            value: C,
            onChange: e => w(e.target.value),
            className: `bg-transparent text-gray-200 text-[12px] pl-2 pr-6 py-1 outline-none cursor-pointer appearance-none text-center font-bold`,
            style: {
              WebkitAppearance: `none`,
              MozAppearance: `none`
            },
            children: [X.jsx(`option`, {
              value: `16:9`,
              className: `bg-[#222]`,
              children: `16:9`
            }), X.jsx(`option`, {
              value: `9:16`,
              className: `bg-[#222]`,
              children: `9:16`
            }), X.jsx(`option`, {
              value: `1:1`,
              className: `bg-[#222]`,
              children: `1:1`
            }), X.jsx(`option`, {
              value: `custom`,
              className: `bg-[#222]`,
              children: `自定义`
            })]
          }), C === `custom` && X.jsxs(`div`, {
            className: `flex items-center gap-2 ml-3 mr-3 border-l border-white/20 pl-3`,
            children: [X.jsx(`input`, {
              type: `number`,
              value: T.w,
              onChange: e => E(t => ({
                ...t,
                w: Number(e.target.value)
              })),
              className: `w-10 bg-transparent text-gray-200 text-[12px] outline-none text-center border-b border-transparent focus:border-white/50`
            }), X.jsx(`span`, {
              className: `text-gray-500`,
              children: `:`
            }), X.jsx(`input`, {
              type: `number`,
              value: T.h,
              onChange: e => E(t => ({
                ...t,
                h: Number(e.target.value)
              })),
              className: `w-10 bg-transparent text-gray-200 text-[12px] outline-none text-center border-b border-transparent focus:border-white/50`
            })]
          })]
        }), X.jsx(`div`, {
          className: `flex-1 w-full h-full flex items-center justify-center p-8`,
          children: X.jsxs(`div`, {
            className: `relative shadow-[0_0_50px_rgba(0,0,0,0.8)]`,
            id: `pano-container-fullscreen-${e}`,
            style: {
              aspectRatio: `16/9`,
              width: `100%`,
              maxHeight: `calc(100vh - 6rem)`,
              maxWidth: `calc((100vh - 6rem) * (16/9))`,
              margin: `auto`
            },
            onWheel: e => {
              e.stopPropagation(), c(t => {
                let n = t + (e.deltaY > 0 ? 5 : -5);
                return Math.min(Math.max(n, 30), 120);
              });
            },
            children: [X.jsx(yt, {
              resize: {
                debounce: 0
              },
              gl: {
                preserveDrawingBuffer: true,
                antialias: h,
                powerPreference: `high-performance`
              },
              dpr: h ? window.devicePixelRatio ? Math.max(window.devicePixelRatio, 2) : 2 : [1, 1.5],
              style: {
                position: `absolute`,
                top: 0,
                left: 0,
                width: `100%`,
                height: `100%`
              },
              children: X.jsx(Jc, {
                url: P,
                panoType: d,
                fov: s,
                highQuality: h,
                orbitControlsRefLocal: x
              })
            }), X.jsxs(`div`, {
              className: `absolute top-1/2 left-4 -translate-y-1/2 flex flex-col items-center gap-2 z-10 bg-black/60 p-2.5 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg nodrag ${_ ? `pointer-events-none` : ``}`,
              onClick: e => e.stopPropagation(),
              children: [X.jsx(`button`, {
                className: `p-3 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-95 ${y === `current` ? `text-white bg-white/10` : ``}`,
                onClick: () => F([0]),
                title: `当前视角截图`,
                children: X.jsx(Qe, {
                  size: 20,
                  className: y === `current` ? `animate-spin` : ``
                })
              }), X.jsx(`button`, {
                className: `p-3 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-95 ${y === `four` ? `text-white bg-white/10` : ``}`,
                onClick: () => F([90, 180, 270, 0]),
                title: `四大视角截图 (90, 180, 270, 0度)`,
                children: X.jsx(Tn, {
                  size: 20,
                  className: y === `four` ? `animate-spin` : ``
                })
              }), X.jsx(`button`, {
                className: `p-3 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-95 ${y === `twelve` ? `text-white bg-white/10` : ``}`,
                onClick: () => F([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]),
                title: `12大视角截图 (每30度)`,
                children: X.jsx(_e, {
                  size: 20,
                  className: y === `twelve` ? `animate-spin` : ``
                })
              })]
            }), O && X.jsx(`div`, {
              className: `absolute top-0 left-1/2 z-50 pointer-events-none nodrag flex items-center justify-center`,
              children: X.jsx(`div`, {
                className: `animate-[dropIn_2.5s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards] bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/30 px-8 py-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] flex items-center gap-3 mt-16`,
                children: X.jsx(`span`, {
                  className: `text-white font-bold text-xl tracking-wider`,
                  children: O
                })
              })
            }), _ && X.jsx(`div`, {
              className: `absolute inset-0 z-40 pointer-events-none nodrag flex items-center justify-center bg-black/20 backdrop-blur-[1px]`,
              children: X.jsxs(`div`, {
                className: `bg-black/80 border border-white/20 rounded-2xl px-6 py-4 shadow-2xl flex items-center gap-3`,
                children: [X.jsx(`div`, {
                  className: `w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin`
                }), X.jsx(`span`, {
                  className: `text-white text-base font-semibold`,
                  children: `截图处理中…`
                })]
              })
            }), !_ && X.jsx(`div`, {
              className: `absolute inset-0 pointer-events-none z-[5]`,
              style: {
                display: `flex`,
                justifyContent: `center`,
                alignItems: `center`
              },
              children: X.jsx(`div`, {
                className: `border-[2px] border-dashed border-white/30 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] transition-all duration-300`,
                style: {
                  aspectRatio: D,
                  height: `100%`,
                  maxHeight: `100%`,
                  maxWidth: `100%`
                }
              })
            })]
          })
        })]
      }), document.body)]
    });
  }),