/**
 * 节点类型: videoToGifNode
 * 原版函数名: Gs
 * 原版行号: L16746-L17022
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
// jn → wu
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
// ut → Gd
// v → XH
// w → xT
// x → Y
// y → Mk
 */

var Gs = Y.memo(({
  id: e,
  data: n,
  selected: r
}) => {
  let {
      updateNodeData: i
    } = Gt(),
    a = n,
    o = Y.useRef(null),
    [s, c] = Y.useState(n.fps || 10),
    [l, u] = Y.useState(n.maxSize || 480),
    [d, f] = Y.useState(n.colors || 256),
    [p, m] = Y.useState(n.speed || 1),
    [h, g] = Y.useState(0),
    [_, v] = Y.useState(0),
    [y, b] = Y.useState(0),
    x = t({
      handleType: `target`
    }),
    S = ut(Y.useMemo(() => x.map(e => e.source), [x])),
    C = Y.useRef(``);
  Y.useEffect(() => {
    let t = Ws(Array.isArray(S) ? S : S ? [S] : []);
    if (t && t !== C.current) {
      C.current = t;
      let n = `connected_video.mp4`;
      try {
        let e = new URL(t).pathname.split(`/`).pop();
        e && e.includes(`.`) && (n = e);
      } catch {}
      i(e, {
        videoUrl: t,
        videoName: n,
        errorMessage: undefined
      });
    } else !t && C.current && (C.current = ``, i(e, {
      videoUrl: undefined,
      videoName: undefined
    }));
  }, [S, e, i]), Y.useEffect(() => {
    if (!a.videoUrl) {
      g(0);
      return;
    }
    let e = false;
    return Rs(a.videoUrl).then(t => {
      e || !t || (g(t), v(0), b(t));
    }).catch(() => {}), () => {
      e = true;
    };
  }, [a.videoUrl]), Y.useEffect(() => {
    i(e, {
      fps: s,
      maxSize: l,
      colors: d,
      speed: p
    });
  }, [s, l, d, p, e, i]);
  let w = t => {
      let n = t.target.files?.[0];
      if (!n) return;
      let r = URL.createObjectURL(n);
      a.onAddImage?.(e, r), t.target.value = ``;
    },
    T = Y.useCallback(async () => {
      let t = a.videoUrl;
      if (!t) {
        a.onShowToast?.(`请先上传视频或连接包含视频的节点`);
        return;
      }
      i(e, {
        loading: true,
        progress: 0,
        errorMessage: undefined,
        resultInfo: undefined
      });
      try {
        let n = await Ls(t, {
            fps: s,
            maxSize: l,
            colors: d,
            speed: p,
            startTime: h ? _ : 0,
            endTime: h ? y : undefined,
            onProgress: t => i(e, {
              progress: Math.round(t * 100)
            })
          }),
          r = URL.createObjectURL(n.blob);
        i(e, {
          loading: false,
          progress: 100,
          resultInfo: {
            width: n.width,
            height: n.height,
            frameCount: n.frameCount,
            size: n.size
          }
        }), a.onSpawnImageNode?.(e, r, `GIF`);
      } catch (t) {
        i(e, {
          loading: false,
          errorMessage: t?.message || `GIF 生成失败`
        }), a.onShowToast?.(t?.message || `GIF 生成失败`);
      }
    }, [a.videoUrl, s, l, d, p, _, y, h, e, i, a]),
    E = !!a.loading,
    D = !!a.resultInfo,
    O = !!a.videoUrl;
  return X.jsxs(`div`, {
    className: `relative group/node w-full h-full min-w-[300px] min-h-[200px]`,
    children: [X.jsx(si, {
      id: e,
      data: n,
      defaultTitle: `视频转GIF`,
      icon: X.jsx(Jt, {
        size: 11,
        className: `text-gray-500`
      }),
      floating: true
    }), X.jsx(ci, {
      visible: !!r,
      minWidth: 300,
      minHeight: 200
    }), X.jsxs(`div`, {
      className: `w-full h-full bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 flex flex-col drag-handle cursor-move ${r ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`,
      children: [X.jsx(_r, {
        type: `target`,
        position: J.Left
      }), X.jsx(`input`, {
        type: `file`,
        ref: o,
        style: {
          display: `none`
        },
        accept: `video/*`,
        onChange: w
      }), X.jsxs(`div`, {
        className: `flex-1 p-3 flex flex-col gap-2.5`,
        children: [!O && X.jsxs(`button`, {
          onClick: () => o.current?.click(),
          className: `nodrag flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg border border-dashed border-[#3a3a3a] text-gray-500 hover:text-blue-400 hover:border-blue-500/50 transition-colors`,
          children: [X.jsx(jn, {
            size: 20
          }), X.jsx(`span`, {
            className: `text-[11px]`,
            children: `上传视频 或 左侧连接视频节点`
          })]
        }), a.errorMessage && X.jsxs(`div`, {
          className: `flex items-center gap-1.5 text-[11px] text-red-400`,
          children: [X.jsx(pt, {
            size: 13,
            className: `shrink-0`
          }), X.jsx(`span`, {
            className: `break-words`,
            children: a.errorMessage
          })]
        }), X.jsxs(`div`, {
          className: `grid grid-cols-4 gap-2`,
          children: [X.jsxs(`label`, {
            className: `nodrag flex flex-col gap-1 text-[10px] text-gray-500`,
            children: [`清晰度`, X.jsx(`select`, {
              value: l,
              onChange: e => u(Number(e.target.value)),
              className: `nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555]`,
              children: zs.map(e => X.jsxs(`option`, {
                value: e,
                children: [e, `p`]
              }, e))
            })]
          }), X.jsxs(`label`, {
            className: `nodrag flex flex-col gap-1 text-[10px] text-gray-500`,
            children: [`帧率`, X.jsx(`select`, {
              value: s,
              onChange: e => c(Number(e.target.value)),
              className: `nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555]`,
              children: Bs.map(e => X.jsxs(`option`, {
                value: e,
                children: [e, ` fps`]
              }, e))
            })]
          }), X.jsxs(`label`, {
            className: `nodrag flex flex-col gap-1 text-[10px] text-gray-500`,
            children: [`速度`, X.jsx(`select`, {
              value: p,
              onChange: e => m(Number(e.target.value)),
              className: `nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555]`,
              children: Vs.map(e => X.jsx(`option`, {
                value: e.value,
                children: e.label
              }, e.value))
            })]
          }), X.jsxs(`label`, {
            className: `nodrag flex flex-col gap-1 text-[10px] text-gray-500`,
            children: [`色彩`, X.jsx(`select`, {
              value: d,
              onChange: e => f(Number(e.target.value)),
              className: `nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555]`,
              children: Hs.map(e => X.jsx(`option`, {
                value: e.value,
                children: e.label
              }, e.value))
            })]
          })]
        }), h > 0 && X.jsxs(`div`, {
          className: `nodrag flex items-center gap-2 text-[10px] text-gray-400`,
          children: [X.jsx(`span`, {
            className: `shrink-0`,
            children: `裁剪`
          }), X.jsx(`input`, {
            type: `range`,
            min: 0,
            max: h,
            step: .1,
            value: _,
            onChange: e => v(Math.min(parseFloat(e.target.value), y - .1)),
            className: `nodrag flex-1 accent-blue-500`
          }), X.jsx(`input`, {
            type: `range`,
            min: 0,
            max: h,
            step: .1,
            value: y,
            onChange: e => b(Math.max(parseFloat(e.target.value), _ + .1)),
            className: `nodrag flex-1 accent-blue-500`
          }), X.jsxs(`span`, {
            className: `shrink-0 tabular-nums w-20 text-right`,
            children: [_.toFixed(1), `-`, y.toFixed(1), `s`]
          })]
        }), a.resultInfo && X.jsxs(`div`, {
          className: `text-[10px] text-gray-400 flex items-center gap-2 flex-wrap`,
          children: [X.jsxs(`span`, {
            children: [a.resultInfo.width, `×`, a.resultInfo.height]
          }), X.jsx(`span`, {
            children: `·`
          }), X.jsxs(`span`, {
            children: [a.resultInfo.frameCount, ` 帧`]
          }), X.jsx(`span`, {
            children: `·`
          }), X.jsx(`span`, {
            className: `text-blue-400`,
            children: Us(a.resultInfo.size)
          })]
        }), X.jsxs(`div`, {
          className: `mt-auto flex items-center gap-2`,
          children: [O && X.jsx(`button`, {
            onClick: () => o.current?.click(),
            className: `nodrag flex items-center justify-center h-8 w-8 rounded-md text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] transition-colors`,
            title: `重新上传视频`,
            children: X.jsx(jn, {
              size: 14
            })
          }), X.jsx(`button`, {
            onClick: T,
            disabled: E || !O,
            className: `nodrag flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-[12px] font-medium bg-white text-[#141414] hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors`,
            children: E ? X.jsxs(X.Fragment, {
              children: [X.jsx(Nn, {
                size: 13,
                className: `animate-spin`
              }), ` 生成中 `, a.progress || 0, `%`]
            }) : X.jsxs(X.Fragment, {
              children: [X.jsx(ct, {
                size: 13
              }), ` `, D ? `重新免费生成` : `免费生成`]
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
});