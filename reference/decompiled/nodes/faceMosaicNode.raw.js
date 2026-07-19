/**
 * 节点类型: faceMosaicNode
 * 原版函数名: Cc
 * 原版行号: L17950-L18288
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
// jn → wu
// l → VG
// m → LW
// mt → Vd
// n → Fq
// o → oK
// p → VW
// pr → Hl
// pt → Hd
// r → Nq
// rt → Bb
// s → iK
// t → e1
// u → BG
// ut → Gd
// v → XH
// w → xT
// x → Y
// y → Mk
 */

var Cc = Y.memo(({
  id: e,
  data: n,
  selected: r
}) => {
  let {
      updateNodeData: i
    } = Gt(),
    a = n,
    o = Y.useRef(null),
    [s, c] = Y.useState(n.mode || `mosaic`),
    [l, u] = Y.useState(n.strength ?? .5),
    [d, f] = Y.useState(n.color || `#000000`),
    [p, m] = Y.useState(false),
    h = t({
      handleType: `target`
    }),
    g = ut(Y.useMemo(() => h.map(e => e.source), [h])),
    _ = Y.useMemo(() => Sc(Array.isArray(g) ? g : g ? [g] : []), [g]);
  Y.useEffect(() => {
    i(e, {
      imageUrls: _
    });
  }, [_, e, i]), Y.useEffect(() => {
    i(e, {
      mode: s,
      strength: l,
      color: d
    });
  }, [s, l, d, e, i]);
  let {
      useThumbnail: v
    } = pr(),
    y = t => {
      let n = t.target.files;
      !n || n.length === 0 || (Array.from(n).forEach(t => {
        let n = URL.createObjectURL(t);
        a.onAddImage?.(e, n);
      }), t.target.value = ``);
    },
    b = Y.useCallback(t => {
      a.onPushImagesToImageBox && a.onPushImagesToImageBox(e, t) || t.forEach(t => a.onSpawnImageNode?.(e, t.url, t.label));
    }, [e, a]),
    x = Y.useCallback(async () => {
      let t = _;
      if (!t || t.length === 0) {
        a.onShowToast?.(`请先上传图片或连接包含图片的节点`);
        return;
      }
      i(e, {
        loading: true,
        progress: 0,
        errorMessage: undefined,
        resultInfo: undefined,
        resultUrls: undefined
      });
      let n = [],
        r = 0,
        o = ``,
        c = xc.find(e => e.mode === s)?.label || `打码`;
      for (let a = 0; a < t.length; a++) {
        try {
          let e = await _c(t[a], {
              mode: s,
              strength: l,
              color: d
            }),
            i = await ii(e.dataUrl, {
              preferThumbnail: true,
              subfolder: `canvas/face_mosaic`
            });
          n.push({
            url: i.url,
            label: `${c} ${a + 1}`
          }), r += e.faceCount;
        } catch (e) {
          o ||= e?.message || `打码失败`;
        }
        i(e, {
          progress: Math.round((a + 1) / t.length * 100)
        });
      }
      if (n.length === 0) {
        i(e, {
          loading: false,
          errorMessage: o || `打码失败`
        }), a.onShowToast?.(o || `打码失败`);
        return;
      }
      let u = n.map(e => e.url);
      i(e, {
        loading: false,
        resultInfo: {
          count: n.length,
          faceTotal: r
        },
        resultUrls: u
      }), b(n), r === 0 && a.onShowToast?.(`未检测到人脸`), o && a.onShowToast?.(`部分图片处理失败：${o}`);
    }, [_, s, l, d, e, i, a, b]),
    S = Y.useCallback(async t => {
      m(false), i(e, {
        loading: true,
        progress: 0,
        errorMessage: undefined,
        resultInfo: undefined,
        resultUrls: undefined
      });
      try {
        let n = (await ii(t, {
          preferThumbnail: true,
          subfolder: `canvas/face_mosaic`
        })).url;
        b([{
          url: n,
          label: `手动打码`
        }]), i(e, {
          resultInfo: {
            count: 1,
            faceTotal: 0
          },
          resultUrls: [n],
          loading: false
        });
      } catch {
        b([{
          url: t,
          label: `手动打码`
        }]), i(e, {
          resultInfo: {
            count: 1,
            faceTotal: 0
          },
          resultUrls: [t],
          loading: false
        });
      }
    }, [b, e, i]),
    C = !!a.loading,
    w = _.length;
  return X.jsxs(`div`, {
    className: `relative group/node w-full h-full min-w-[320px] min-h-[250px]`,
    children: [X.jsx(si, {
      id: e,
      data: n,
      defaultTitle: `人脸打码`,
      icon: X.jsx(j, {
        size: 11,
        className: `text-gray-500`
      }),
      floating: true
    }), X.jsx(ci, {
      visible: !!r,
      minWidth: 320,
      minHeight: 250
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
        onChange: y
      }), X.jsxs(`div`, {
        className: `flex-1 p-3 flex flex-col gap-2.5`,
        children: [w === 0 ? X.jsxs(`button`, {
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
            children: w
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
        }), X.jsx(`div`, {
          className: `grid grid-cols-4 gap-1.5`,
          children: xc.map(({
            mode: e,
            label: t,
            icon: n
          }) => X.jsxs(`button`, {
            onClick: () => c(e),
            className: `nodrag flex flex-col items-center justify-center gap-1 py-1.5 rounded-md text-[11px] border transition-colors ${s === e ? `bg-blue-600 text-white border-blue-500` : `text-gray-300 bg-[#222] hover:bg-[#2a2a2a] border-[#333]`}`,
            children: [X.jsx(n, {
              size: 14
            }), t]
          }, e))
        }), X.jsxs(`label`, {
          className: `nodrag flex items-center gap-2 text-[10px] text-gray-400`,
          children: [X.jsx(`span`, {
            className: `w-8`,
            children: s === `grid` ? `密度` : s === `bar` ? `透明度` : `程度`
          }), X.jsx(`input`, {
            type: `range`,
            min: 0,
            max: 1,
            step: .05,
            value: l,
            onChange: e => u(Number(e.target.value)),
            className: `nodrag accent-blue-500 flex-1`
          }), X.jsxs(`span`, {
            className: `w-8 text-right text-gray-500`,
            children: [Math.round(l * 100), `%`]
          })]
        }), (s === `bar` || s === `grid`) && X.jsxs(`div`, {
          className: `nodrag flex items-center gap-2 text-[10px] text-gray-400`,
          children: [X.jsx(`span`, {
            className: `w-8`,
            children: `颜色`
          }), X.jsx(`div`, {
            className: `flex items-center gap-1.5 flex-1`,
            children: [`#000000`, `#ffffff`, `#ef4444`, `#22c55e`, `#3b82f6`, `#eab308`, `#a855f7`, `#ec4899`].map(e => X.jsx(`button`, {
              onClick: () => f(e),
              className: `w-4 h-4 rounded-full border border-[#333] ${d === e ? `ring-2 ring-blue-500 ring-offset-1 ring-offset-[#1c1c1c]` : ``}`,
              style: {
                backgroundColor: e
              }
            }, e))
          })]
        }), a.resultInfo && X.jsxs(`div`, {
          className: `text-[10px] text-gray-400 flex items-center gap-2 flex-wrap`,
          children: [X.jsxs(`span`, {
            children: [a.resultInfo.count, ` 张`]
          }), a.resultInfo.faceTotal > 0 && X.jsxs(X.Fragment, {
            children: [X.jsx(`span`, {
              children: `·`
            }), X.jsxs(`span`, {
              children: [`共 `, X.jsx(`span`, {
                className: `text-blue-400`,
                children: a.resultInfo.faceTotal
              }), ` 张人脸`]
            })]
          })]
        }), a.resultUrls && a.resultUrls.length > 0 && X.jsx(`div`, {
          className: `nodrag nowheel mt-1 mb-2 grid grid-cols-2 gap-1.5 max-h-[140px] overflow-y-auto pr-1`,
          style: {
            scrollbarWidth: `thin`
          },
          children: a.resultUrls.map((t, n) => {
            let r = v && Lr(t, 420, `image`) || t;
            return X.jsxs(`div`, {
              className: `relative aspect-video bg-[#111] rounded-md overflow-hidden border border-[#333] group`,
              children: [X.jsx(`img`, {
                src: r,
                alt: `result-${n}`,
                className: `w-full h-full object-cover`,
                loading: `lazy`,
                onError: e => {
                  let n = e.currentTarget;
                  n.src !== t && (n.src = t);
                },
                onDoubleClick: n => {
                  n.stopPropagation(), a.onZoom?.(e, t, r);
                }
              }), X.jsx(`div`, {
                className: `absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none`
              }), X.jsx(`button`, {
                className: `absolute top-1 right-1 p-1 bg-black/60 text-gray-300 hover:text-white rounded opacity-0 group-hover:opacity-100 transition-opacity`,
                onClick: n => {
                  n.stopPropagation(), a.onZoom?.(e, t, r);
                },
                title: `放大查看`,
                children: X.jsx(rt, {
                  size: 12
                })
              })]
            }, n);
          })
        }), X.jsxs(`div`, {
          className: `mt-auto flex items-center gap-2`,
          children: [X.jsx(`button`, {
            onClick: () => o.current?.click(),
            className: `nodrag flex items-center justify-center h-8 w-8 rounded-md text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] transition-colors`,
            title: `上传图片`,
            children: X.jsx(jn, {
              size: 14
            })
          }), X.jsxs(`button`, {
            onClick: () => {
              if (w === 0) {
                a.onShowToast?.(`请先上传或连接图片`);
                return;
              }
              m(true);
            },
            disabled: w === 0,
            className: `nodrag flex items-center justify-center gap-1 h-8 px-2.5 rounded-md text-[12px] text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] disabled:opacity-40 disabled:cursor-not-allowed transition-colors`,
            title: `手动打码`,
            children: [X.jsx(Ut, {
              size: 13
            }), ` 手动`]
          }), X.jsx(`button`, {
            onClick: x,
            disabled: C || w === 0,
            className: `nodrag flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-[12px] font-medium bg-white text-[#141414] hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors`,
            children: C ? X.jsxs(X.Fragment, {
              children: [X.jsx(Nn, {
                size: 13,
                className: `animate-spin`
              }), ` 处理中 `, a.progress || 0, `%`]
            }) : X.jsxs(X.Fragment, {
              children: [X.jsx(ct, {
                size: 13
              }), ` AI打码`, w > 1 ? `（${w}张）` : ``]
            })
          })]
        })]
      }), X.jsx(_r, {
        type: `source`,
        position: J.Right,
        id: `main-output`
      })]
    }), p && _[0] && X.jsx(bc, {
      imageUrl: _[0],
      onSave: S,
      onClose: () => m(false)
    })]
  });
});