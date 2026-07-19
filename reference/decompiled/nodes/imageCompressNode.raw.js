/**
 * 节点类型: imageCompressNode
 * 原版函数名: nc
 * 原版行号: L17168-L17422
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
// ft → Ud
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

var nc = Y.memo(({
  id: e,
  data: n,
  selected: r
}) => {
  let {
      updateNodeData: i
    } = Gt(),
    a = n,
    o = Y.useRef(null),
    [s, c] = Y.useState(n.maxSize ?? 0),
    [l, u] = Y.useState(n.quality ?? .8),
    [d, f] = Y.useState(n.format || `image/jpeg`),
    [p, m] = Y.useState(!!n.targetKB),
    [h, g] = Y.useState(n.targetKB || 200),
    _ = t({
      handleType: `target`
    }),
    v = ut(Y.useMemo(() => _.map(e => e.source), [_])),
    y = Y.useMemo(() => tc(Array.isArray(v) ? v : v ? [v] : []), [v]);
  Y.useEffect(() => {
    i(e, {
      imageUrls: y
    });
  }, [y, e, i]), Y.useEffect(() => {
    i(e, {
      maxSize: s,
      quality: l,
      format: d,
      targetKB: p ? h : undefined
    });
  }, [s, l, d, p, h, e, i]);
  let b = t => {
      let n = t.target.files;
      !n || n.length === 0 || (Array.from(n).forEach(t => {
        let n = URL.createObjectURL(t);
        a.onAddImage?.(e, n);
      }), t.target.value = ``);
    },
    x = Y.useCallback(async () => {
      let t = y;
      if (!t || t.length === 0) {
        a.onShowToast?.(`请先上传图片或连接包含图片的节点`);
        return;
      }
      i(e, {
        loading: true,
        progress: 0,
        errorMessage: undefined,
        resultInfo: undefined
      });
      let n = [],
        r = 0,
        o = 0,
        c = ``;
      for (let a = 0; a < t.length; a++) {
        try {
          let e = await Xs(t[a], {
            maxSize: s,
            quality: l,
            format: d,
            targetKB: p ? h : undefined
          });
          n.push({
            url: e.dataUrl,
            label: `压缩图 ${a + 1}`
          }), r += e.originalSize, o += e.size;
        } catch (e) {
          c ||= e?.message || `压缩失败`;
        }
        i(e, {
          progress: Math.round((a + 1) / t.length * 100)
        });
      }
      if (n.length === 0) {
        i(e, {
          loading: false,
          errorMessage: c || `压缩失败`
        }), a.onShowToast?.(c || `压缩失败`);
        return;
      }
      i(e, {
        loading: false,
        resultInfo: {
          count: n.length,
          totalOriginal: r,
          totalSize: o
        }
      }), a.onPushImagesToImageBox && a.onPushImagesToImageBox(e, n) || n.forEach(t => a.onSpawnImageNode?.(e, t.url, t.label)), c && a.onShowToast?.(`部分图片压缩失败：${c}`);
    }, [y, s, l, d, p, h, e, i, a]),
    S = !!a.loading,
    C = !!a.resultInfo,
    w = d === `image/png`,
    T = y.length;
  return X.jsxs(`div`, {
    className: `relative group/node w-full h-full min-w-[300px] min-h-[200px]`,
    children: [X.jsx(si, {
      id: e,
      data: n,
      defaultTitle: `图片压缩`,
      icon: X.jsx(ft, {
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
        multiple: true,
        style: {
          display: `none`
        },
        accept: `image/*`,
        onChange: b
      }), X.jsxs(`div`, {
        className: `flex-1 p-3 flex flex-col gap-2.5`,
        children: [T === 0 ? X.jsxs(`button`, {
          onClick: () => o.current?.click(),
          className: `nodrag flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg border border-dashed border-[#3a3a3a] text-gray-500 hover:text-blue-400 hover:border-blue-500/50 transition-colors`,
          children: [X.jsx(jn, {
            size: 20
          }), X.jsx(`span`, {
            className: `text-[11px]`,
            children: `上传图片 或 左侧连接图片节点`
          })]
        }) : X.jsxs(`div`, {
          className: `text-[11px] text-gray-400`,
          children: [`已连接 `, X.jsx(`span`, {
            className: `text-blue-400`,
            children: T
          }), ` 张图片`]
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
          className: `grid grid-cols-3 gap-2`,
          children: [X.jsxs(`label`, {
            className: `nodrag flex flex-col gap-1 text-[10px] text-gray-500`,
            children: [`尺寸`, X.jsx(`select`, {
              value: s,
              onChange: e => c(Number(e.target.value)),
              className: `nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555]`,
              children: Zs.map(e => X.jsx(`option`, {
                value: e.value,
                children: e.label
              }, e.value))
            })]
          }), X.jsxs(`label`, {
            className: `nodrag flex flex-col gap-1 text-[10px] text-gray-500`,
            children: [`清晰度`, X.jsx(`select`, {
              value: l,
              disabled: w || p,
              onChange: e => u(Number(e.target.value)),
              className: `nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555] disabled:opacity-40`,
              children: Qs.map(e => X.jsx(`option`, {
                value: e.value,
                children: e.label
              }, e.value))
            })]
          }), X.jsxs(`label`, {
            className: `nodrag flex flex-col gap-1 text-[10px] text-gray-500`,
            children: [`格式`, X.jsx(`select`, {
              value: d,
              onChange: e => f(e.target.value),
              className: `nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555]`,
              children: $s.map(e => X.jsx(`option`, {
                value: e.value,
                children: e.label
              }, e.value))
            })]
          })]
        }), !w && X.jsxs(`label`, {
          className: `nodrag flex items-center gap-2 text-[10px] text-gray-400`,
          children: [X.jsx(`input`, {
            type: `checkbox`,
            checked: p,
            onChange: e => m(e.target.checked),
            className: `nodrag accent-blue-500`
          }), X.jsx(`span`, {
            children: `限制目标大小`
          }), p && X.jsxs(X.Fragment, {
            children: [X.jsx(`input`, {
              type: `number`,
              min: 10,
              max: 2e4,
              value: h,
              onChange: e => g(Math.max(10, Number(e.target.value) || 10)),
              className: `nodrag w-16 bg-[#222] border border-[#333] rounded px-1.5 py-0.5 text-[11px] text-gray-200 outline-none focus:border-[#555]`
            }), X.jsx(`span`, {
              children: `KB`
            })]
          })]
        }), a.resultInfo && X.jsxs(`div`, {
          className: `text-[10px] text-gray-400 flex items-center gap-2 flex-wrap`,
          children: [X.jsxs(`span`, {
            children: [a.resultInfo.count, ` 张`]
          }), X.jsx(`span`, {
            children: `·`
          }), a.resultInfo.totalOriginal ? X.jsxs(`span`, {
            children: [ec(a.resultInfo.totalOriginal), ` → `, X.jsx(`span`, {
              className: `text-blue-400`,
              children: ec(a.resultInfo.totalSize)
            })]
          }) : X.jsx(`span`, {
            className: `text-blue-400`,
            children: ec(a.resultInfo.totalSize)
          })]
        }), X.jsxs(`div`, {
          className: `mt-auto flex items-center gap-2`,
          children: [X.jsx(`button`, {
            onClick: () => o.current?.click(),
            className: `nodrag flex items-center justify-center h-8 w-8 rounded-md text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] transition-colors`,
            title: `上传图片`,
            children: X.jsx(jn, {
              size: 14
            })
          }), X.jsx(`button`, {
            onClick: x,
            disabled: S || T === 0,
            className: `nodrag flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-[12px] font-medium bg-white text-[#141414] hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors`,
            children: S ? X.jsxs(X.Fragment, {
              children: [X.jsx(Nn, {
                size: 13,
                className: `animate-spin`
              }), ` 压缩中 `, a.progress || 0, `%`]
            }) : X.jsxs(X.Fragment, {
              children: [X.jsx(ct, {
                size: 13
              }), ` `, C ? `重新免费压缩` : `免费压缩`, T > 1 ? `（${T}张）` : ``]
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