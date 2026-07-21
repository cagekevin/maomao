/**
 * 节点类型: stickyNoteNode
 * 原版函数名: Uh
 * 原版行号: L29663-L29999
 * 来源: App-B9jVCs-a.decompiled.js
 *
 * 变量映射（vendor-map.json）:
// _ → tU
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
// mt → Vd
// n → Fq
// o → oK
// p → VW
// pt → Hd
// r → Nq
// s → iK
// t → e1
// u → BG
// v → XH
// w → xT
// x → Y
// y → Mk
// z → Rw
 */

function Uh({
  id: e,
  data: t
}) {
  let n = t,
    {
      updateNodeData: r
    } = Gt(),
    [i, a] = Y.useState(n.html ?? (n.text ? Hh(n.text) : ``)),
    [o, s] = Y.useState(n.fontSize ?? 24),
    [c, l] = Y.useState(n.bold ?? false),
    [u, d] = Y.useState(n.color ?? Rh[0].value),
    [f, p] = Y.useState(n.bgColor ?? Lh[0].value),
    [m, h] = Y.useState(n.width ?? 400),
    [g, _] = Y.useState(n.height ?? 400),
    [v, y] = Y.useState(false),
    [b, x] = Y.useState(null),
    [S, C] = Y.useState(false),
    [w, T] = Y.useState(false),
    E = Y.useRef(null),
    D = Y.useRef(null),
    O = Y.useCallback(t => {
      r(e, t);
    }, [e, r]);
  Y.useEffect(() => {
    O({
      html: i,
      fontSize: o,
      bold: c,
      color: u,
      bgColor: f,
      width: m,
      height: g
    });
  }, [i, o, c, u, f, m, g, O]);
  let k = f === `transparent`,
    A = Vh(f),
    j = e => {
      e.stopPropagation(), y(true), setTimeout(() => {
        let e = E.current;
        if (e) {
          e.innerHTML = i, e.focus();
          let t = document.createRange();
          t.selectNodeContents(e), t.collapse(false);
          let n = window.getSelection();
          n?.removeAllRanges(), n?.addRange(t);
        }
      }, 50);
    },
    M = () => {
      E.current && a(E.current.innerHTML), y(false), x(null), C(false), T(false);
    },
    N = () => {
      M();
    },
    P = e => {
      if (!v) return;
      e.preventDefault(), e.stopPropagation();
      let t = e.currentTarget.closest(`.react-flow__node`)?.getBoundingClientRect();
      x({
        x: e.clientX - (t?.left ?? 0),
        y: e.clientY - (t?.top ?? 0)
      });
    },
    F = () => {
      E.current && a(E.current.innerHTML);
    },
    I = () => {
      let e = window.getSelection();
      if (!e || e.rangeCount === 0 || e.isCollapsed) return false;
      let t = E.current;
      return t ? t.contains(e.anchorNode) && t.contains(e.focusNode) : false;
    },
    L = e => {
      let t = window.getSelection();
      if (!t || t.rangeCount === 0 || t.isCollapsed) return;
      let n = t.getRangeAt(0),
        r = document.createElement(`span`);
      Object.assign(r.style, e);
      try {
        n.surroundContents(r);
      } catch {
        let e = n.extractContents();
        r.appendChild(e), n.insertNode(r);
      }
      let i = document.createRange();
      i.selectNodeContents(r), t.removeAllRanges(), t.addRange(i), F();
    },
    ee = e => {
      v && I() ? L({
        fontSize: `${e}px`
      }) : s(e), x(null);
    },
    R = e => {
      v && I() ? L({
        color: e
      }) : d(e), x(null);
    },
    z = () => {
      v && I() ? L({
        fontWeight: `700`
      }) : l(e => !e), x(null);
    },
    B = e => {
      let t = zh.indexOf(o),
        n = t === -1 ? zh.findIndex(e => e >= o) : t;
      ee(zh[Math.max(0, Math.min(zh.length - 1, (n === -1 ? zh.length - 1 : n) + e))]);
    },
    te = e => {
      let t = E.current;
      t && (t.focus(), document.execCommand(`insertText`, false, e), F()), C(false);
    },
    ne = e => {
      e.preventDefault(), e.stopPropagation(), D.current = {
        startX: e.clientX,
        startY: e.clientY,
        startW: m,
        startH: g
      };
      let t = e => {
          if (!D.current) return;
          let t = Math.max(200, D.current.startW + e.clientX - D.current.startX),
            n = Math.max(150, D.current.startH + e.clientY - D.current.startY);
          h(t), _(n);
        },
        n = () => {
          D.current = null, window.removeEventListener(`mousemove`, t), window.removeEventListener(`mouseup`, n);
        };
      window.addEventListener(`mousemove`, t), window.addEventListener(`mouseup`, n);
    },
    re = (e => e >= 96 ? 1.08 : e >= 64 ? 1.12 : e >= 32 ? 1.16 : e >= 18 ? 1.22 : 1.28)(o),
    ie = {
      fontSize: o,
      color: u,
      fontWeight: c ? 700 : 400,
      lineHeight: re
    };
  return X.jsxs(X.Fragment, {
    children: [X.jsx(`style`, {
      children: `.sticky-editor:empty:before{content:attr(data-placeholder);color:#666;pointer-events:none;}`
    }), X.jsxs(`div`, {
      className: `relative group/sticky select-none ${v ? `nodrag nopan nowheel` : ``}`,
      style: {
        width: m,
        minHeight: g,
        background: f,
        borderRadius: k ? 0 : 8,
        padding: k ? `4px 0` : `16px 20px`,
        borderLeft: k ? `none` : `4px solid ${A}`
      },
      onDoubleClick: j,
      onClick: () => {
        x(null);
      },
      onContextMenu: P,
      children: [!v && X.jsx(`div`, {
        className: `w-full whitespace-pre-wrap break-words`,
        style: {
          ...ie,
          minHeight: 60,
          cursor: `grab`
        },
        children: i ? X.jsx(`div`, {
          dangerouslySetInnerHTML: {
            __html: i
          }
        }) : X.jsx(`span`, {
          style: {
            color: `#666`
          },
          children: `双击编辑...`
        })
      }), v && X.jsxs(X.Fragment, {
        children: [X.jsx(`div`, {
          ref: E,
          contentEditable: true,
          suppressContentEditableWarning: true,
          className: `sticky-editor w-full bg-transparent border-none outline-none whitespace-pre-wrap break-words nopan nowheel nodrag`,
          style: {
            ...ie,
            minHeight: Math.max(100, g - 80),
            overflow: `hidden`
          },
          onInput: F,
          onBlur: N,
          onKeyDown: e => {
            e.key === `Escape` && M();
          },
          "data-placeholder": `输入内容...`
        }), X.jsxs(`div`, {
          className: `flex items-center gap-2 mt-2 pt-2 border-t border-white/10 nodrag nopan`,
          onClick: e => e.stopPropagation(),
          onMouseDown: e => e.preventDefault(),
          children: [X.jsxs(`div`, {
            className: `relative`,
            children: [X.jsx(`button`, {
              className: `w-6 h-6 rounded border border-white/20 cursor-pointer`,
              style: {
                background: k ? `repeating-conic-gradient(#333 0% 25%, #555 0% 50%) 50%/6px 6px` : f
              },
              onClick: () => {
                T(!w), C(false);
              },
              title: `便签底色`
            }), w && X.jsx(`div`, {
              className: `absolute bottom-8 left-0 z-50 bg-[#2a2a2a] border border-[#444] rounded-lg p-2 flex gap-1.5 shadow-xl`,
              children: Lh.map(e => X.jsx(`button`, {
                className: `w-6 h-6 rounded border transition-all cursor-pointer ${f === e.value ? `border-white scale-110` : `border-transparent hover:border-white/40`}`,
                style: {
                  background: e.value === `transparent` ? `repeating-conic-gradient(#333 0% 25%, #555 0% 50%) 50%/6px 6px` : e.value
                },
                onClick: () => {
                  p(e.value), T(false);
                },
                title: e.name
              }, e.name))
            })]
          }), X.jsxs(`div`, {
            className: `relative`,
            children: [X.jsx(`button`, {
              className: `text-sm px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-400 cursor-pointer`,
              onClick: () => {
                C(!S), T(false);
              },
              children: `😀`
            }), S && X.jsx(`div`, {
              className: `absolute bottom-8 left-0 z-50 bg-[#2a2a2a] border border-[#444] rounded-lg p-2 grid grid-cols-6 gap-1 w-[180px] shadow-xl`,
              children: Bh.map(e => X.jsx(`button`, {
                className: `text-base w-7 h-7 flex items-center justify-center rounded hover:bg-[#444] cursor-pointer`,
                onClick: () => te(e),
                children: e
              }, e))
            })]
          }), X.jsx(`button`, {
            className: `w-7 h-7 rounded font-bold cursor-pointer transition-colors ${c ? `bg-white/20 text-white` : `bg-white/5 text-gray-400 hover:bg-white/10`}`,
            onClick: z,
            title: `加粗（选中文字则只改选中部分）`,
            children: `B`
          }), X.jsxs(`div`, {
            className: `flex items-center gap-0.5`,
            children: [X.jsx(`button`, {
              className: `w-6 h-7 rounded bg-white/5 hover:bg-white/10 text-gray-400 text-xs cursor-pointer`,
              onClick: () => B(-1),
              title: `减小字号`,
              children: `A-`
            }), X.jsx(`button`, {
              className: `w-7 h-7 rounded bg-white/5 hover:bg-white/10 text-gray-300 text-sm cursor-pointer`,
              onClick: () => B(1),
              title: `增大字号`,
              children: `A+`
            })]
          }), X.jsx(`div`, {
            className: `flex items-center gap-0.5 ml-1`,
            children: Rh.slice(0, 5).map(e => X.jsx(`button`, {
              className: `w-4 h-4 rounded-full border transition-all cursor-pointer ${u === e.value ? `border-white scale-125` : `border-transparent hover:border-white/50`}`,
              style: {
                background: e.value
              },
              onClick: () => R(e.value),
              title: e.name
            }, e.name))
          })]
        })]
      }), b && X.jsxs(`div`, {
        className: `absolute z-[9999] bg-[#222]/95 backdrop-blur border border-[#444] rounded-xl shadow-2xl p-2 min-w-[160px] nodrag nopan`,
        style: {
          left: b.x,
          top: b.y
        },
        onClick: e => e.stopPropagation(),
        onMouseDown: e => e.preventDefault(),
        children: [X.jsx(`div`, {
          className: `text-[10px] text-gray-500 px-2 mb-1`,
          children: `文字（选中后仅改选中部分）`
        }), X.jsxs(`div`, {
          className: `flex items-center gap-1 px-2 mb-2`,
          children: [X.jsx(`button`, {
            className: `w-6 h-6 rounded font-bold text-xs cursor-pointer ${c ? `bg-white/20 text-white` : `text-gray-400 hover:bg-white/10`}`,
            onClick: z,
            title: `加粗`,
            children: `B`
          }), Rh.map(e => X.jsx(`button`, {
            className: `w-5 h-5 rounded-full border transition-all cursor-pointer ${u === e.value ? `border-white scale-125` : `border-transparent hover:border-white/50`}`,
            style: {
              background: e.value
            },
            onClick: () => R(e.value),
            title: e.name
          }, e.name))]
        }), X.jsx(`div`, {
          className: `text-[10px] text-gray-500 px-2 mb-1`,
          children: `字号`
        }), X.jsx(`div`, {
          className: `flex items-center gap-1 px-2 flex-wrap mb-2`,
          children: zh.map(e => X.jsx(`button`, {
            className: `text-[10px] px-1.5 py-0.5 rounded transition-all cursor-pointer ${o === e ? `bg-white/20 text-white` : `text-gray-400 hover:bg-white/10`}`,
            onClick: () => ee(e),
            children: e
          }, e))
        }), X.jsx(`div`, {
          className: `h-px bg-[#444] my-1.5`
        }), X.jsx(`div`, {
          className: `text-[10px] text-gray-500 px-2 mb-1`,
          children: `便签底色`
        }), X.jsx(`div`, {
          className: `flex items-center gap-1 px-2`,
          children: Lh.map(e => X.jsx(`button`, {
            className: `w-5 h-5 rounded border transition-all cursor-pointer ${f === e.value ? `border-white scale-110` : `border-transparent hover:border-white/40`}`,
            style: {
              background: e.value === `transparent` ? `repeating-conic-gradient(#333 0% 25%, #555 0% 50%) 50%/6px 6px` : e.value
            },
            onClick: () => {
              p(e.value), x(null);
            },
            title: e.name
          }, e.name))
        })]
      }), X.jsx(`div`, {
        className: `absolute bottom-1 right-1 w-4 h-4 cursor-nwse-resize opacity-0 group-hover/sticky:opacity-60 transition-opacity nodrag`,
        onMouseDown: ne,
        title: `拖拽调整大小`,
        children: X.jsx(`svg`, {
          width: `16`,
          height: `16`,
          viewBox: `0 0 16 16`,
          fill: `none`,
          children: X.jsx(`path`, {
            d: `M14 2L2 14M14 6L6 14M14 10L10 14`,
            stroke: `#888`,
            strokeWidth: `1.5`,
            strokeLinecap: `round`
          })
        })
      })]
    })]
  });
}