/**
 * 节点类型: audioPlayerNode
 * 原版函数名: ps
 * 原版行号: L13404-L13581
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
// jn → wu
// l → VG
// m → LW
// mn → Vu
// n → Fq
// o → oK
// p → VW
// qt → cd
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

var ps = Y.memo(({
    id: e,
    data: n,
    selected: r
  }) => {
    let {
        updateNodeData: i
      } = Gt(),
      a = n,
      o = Y.useRef(null),
      s = ut(t({
        handleType: `target`
      }).map(e => e.source)),
      c = (() => {
        let e = Array.isArray(s) ? s : s ? [s] : [];
        for (let t of e) {
          let e = ls(t?.data);
          if (e) return e;
        }
        return ``;
      })(),
      l = c || a.audioUrl || ``,
      [u, d] = Y.useState(``),
      [f, p] = Y.useState(false),
      [m, h] = Y.useState(``),
      g = Y.useRef(``);
    Y.useEffect(() => {
      let e = false,
        t = new AbortController(),
        n = () => {
          if (g.current) {
            try {
              URL.revokeObjectURL(g.current);
            } catch {}
            g.current = ``;
          }
        };
      if (!l) {
        n(), d(``), h(``), p(false);
        return;
      }
      if (l.startsWith(`data:`) || l.startsWith(`blob:`)) {
        n(), d(l), h(``), p(false);
        return;
      }
      return p(true), h(``), (async () => {
        try {
          let r = l.trim().replace(/^`+|`+$/g, ``),
            i = await fetch(r, {
              signal: t.signal
            });
          if (!i.ok) throw Error(`下载失败 HTTP ${i.status}`);
          let a = await i.blob();
          if (e) return;
          n();
          let o = URL.createObjectURL(a);
          g.current = o, d(o), p(false);
        } catch (t) {
          if (e || t?.name === `AbortError`) return;
          d(l), h(t?.message || `加载失败，尝试直接播放`), p(false);
        }
      })(), () => {
        e = true, t.abort();
      };
    }, [l]), Y.useEffect(() => () => {
      if (g.current) try {
        URL.revokeObjectURL(g.current);
      } catch {}
    }, []);
    let _ = Y.useCallback(t => {
        i(e, {
          audioUrl: URL.createObjectURL(t),
          audioName: t.name
        });
      }, [e, i]),
      v = Y.useCallback(() => {
        i(e, {
          audioUrl: undefined,
          audioName: undefined
        });
      }, [e, i]),
      y = a.audioName || (l ? decodeURIComponent(l.split(`/`).pop()?.split(`?`)[0] || `音频`) : ``),
      b = !!l,
      x = Y.useCallback(async e => {
        if (e.stopPropagation(), l) try {
          let e = document.createElement(`a`);
          if (l.startsWith(`blob:`) || l.startsWith(`data:`)) e.href = l;else {
            let t = await (await fetch(l.trim().replace(/^`+|`+$/g, ``))).blob();
            e.href = URL.createObjectURL(t);
          }
          e.download = y || `audio`, document.body.appendChild(e), e.click(), e.remove(), e.href.startsWith(`blob:`) && !l.startsWith(`blob:`) && setTimeout(() => URL.revokeObjectURL(e.href), 4e3);
        } catch {}
      }, [l, y]);
    return X.jsxs(`div`, {
      className: `relative flex flex-col items-center group/node transition-all ${r ? `z-50` : `z-10`}`,
      style: {
        width: `100%`,
        height: `100%`,
        minWidth: 320,
        minHeight: 200
      },
      children: [X.jsx(si, {
        id: e,
        data: n,
        defaultTitle: `音频`,
        icon: X.jsx(qt, {
          size: 11,
          className: `text-gray-500`
        })
      }), b && X.jsx(`div`, {
        className: `absolute -top-12 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`,
        children: X.jsxs(`div`, {
          className: `flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`,
          children: [X.jsx(`button`, {
            className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`,
            title: `下载音频`,
            onClick: x,
            children: X.jsx(mn, {
              size: 14
            })
          }), !c && X.jsx(`button`, {
            className: `p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-md`,
            title: `清除`,
            onClick: e => {
              e.stopPropagation(), v();
            },
            children: X.jsx(yn, {
              size: 14
            })
          })]
        })
      }), X.jsxs(`div`, {
        className: `relative bg-[#1c1c1c] rounded-xl border shadow-xl transition-all duration-300 flex flex-col w-full h-full ${r ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`,
        children: [X.jsx(_r, {
          type: `target`,
          position: J.Left,
          variant: `small`
        }), X.jsx(_r, {
          type: `source`,
          position: J.Right,
          variant: `small`
        }), X.jsx(`div`, {
          className: `flex-1 flex flex-col rounded-xl overflow-hidden min-h-0`,
          children: b ? X.jsx(fs, {
            playUrl: u,
            loading: f,
            error: m
          }) : X.jsxs(`div`, {
            className: `flex-1 flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-blue-400 cursor-pointer bg-[#151515] transition-colors nodrag`,
            onClick: e => {
              e.stopPropagation(), o.current?.click();
            },
            children: [X.jsx(jn, {
              size: 26
            }), X.jsx(`span`, {
              className: `text-[12px]`,
              children: `点击上传音频`
            }), X.jsx(`span`, {
              className: `text-[10px] text-gray-600`,
              children: `或从左侧连线接入`
            })]
          })
        }), X.jsx(`input`, {
          ref: o,
          type: `file`,
          accept: `audio/*,.flac,.aac,.opus,.m4a,.wma,.aiff`,
          className: `hidden`,
          onChange: e => {
            let t = e.target.files?.[0];
            t && _(t), e.currentTarget.value = ``;
          }
        }), X.jsx(ci, {
          minWidth: 320,
          minHeight: 200
        })]
      })]
    });
  }),