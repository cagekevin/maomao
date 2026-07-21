/**
 * 节点类型: urlToImageNode
 * 原版函数名: Wc
 * 原版行号: L19090-L19225
 * 来源: App-B9jVCs-a.decompiled.js
 *
 * 变量映射（vendor-map.json）:
// _r → Rl
// a → ZK
// c → tK
// d → zG
// e → i
// f → MG
// h → xW
// i → jq
// kn → Eu
// l → VG
// n → Fq
// o → oK
// p → VW
// pt → Hd
// r → Nq
// s → iK
// t → e1
// u → BG
// ut → Gd
// w → xT
// y → Mk
 */

var Wc = Y.memo(({
  id: e,
  data: n,
  selected: r
}) => {
  let {
      updateNodeData: i
    } = Gt(),
    a = ut(t({
      handleType: `target`
    }).map(e => e.source)),
    o = Uc(),
    [s, c] = Y.useState(n.inputUrl || ``),
    [l, u] = Y.useState(false),
    [d, f] = Y.useState(null);
  Y.useEffect(() => {
    let t = ``;
    for (let e of a) if (e?.data?.text && typeof e.data.text == `string` && e.data.text.startsWith(`http`)) {
      t = e.data.text;
      break;
    }
    t && t !== s && (c(t), i(e, {
      inputUrl: t
    }));
  }, [a, e, i, s]);
  let p = async () => {
    if (s) {
      u(true), f(null);
      try {
        let t = await zc(s, {
          method: `GET`,
          localPort: o.status.isConnected ? o.status.port : undefined
        });
        if (!t.ok) throw Error(`HTTP ${t.status}`);
        let r = await t.blob();
        i(e, {
          imageUrl: await new Promise((e, t) => {
            let n = new FileReader();
            n.onload = () => e(n.result), n.onerror = t, n.readAsDataURL(r);
          })
        }), n.onShowToast?.(`图片转换成功`);
      } catch (t) {
        console.error(t), f(t.message || `转换失败`), i(e, {
          imageUrl: null
        });
      } finally {
        u(false);
      }
    }
  };
  return Y.useEffect(() => {
    s && s !== n.lastFetchedUrl && p().then(() => {
      i(e, {
        lastFetchedUrl: s
      });
    });
  }, [s, n.lastFetchedUrl]), X.jsxs(`div`, {
    className: `relative flex flex-col`,
    children: [X.jsx(si, {
      id: e,
      data: n,
      defaultTitle: `网址转图片`,
      icon: X.jsx(kn, {
        size: 11,
        className: `text-gray-500`
      })
    }), X.jsxs(`div`, {
      className: `w-[260px] bg-[#1a1a1a] rounded-xl shadow-2xl border-2 transition-colors ${r ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`,
      children: [X.jsx(_r, {
        type: `target`,
        position: J.Left
      }), X.jsxs(`div`, {
        className: `p-3 space-y-3`,
        children: [X.jsxs(`div`, {
          className: `flex gap-2`,
          children: [X.jsx(`input`, {
            type: `text`,
            value: s,
            onChange: t => {
              c(t.target.value), i(e, {
                inputUrl: t.target.value
              });
            },
            className: `flex-1 bg-[#111] border border-[#333] rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-gray-500 nodrag`,
            placeholder: `输入图片 URL (或连线传入)`
          }), X.jsx(`button`, {
            onClick: p,
            disabled: l || !s,
            className: `px-2 py-1 bg-[#333] hover:bg-[#444] rounded text-gray-300 disabled:opacity-50 transition-colors`,
            title: `重新获取`,
            children: X.jsx(L, {
              size: 14,
              className: l ? `animate-spin` : ``
            })
          })]
        }), d && X.jsxs(`div`, {
          className: `flex items-center gap-1 text-red-400 text-[10px]`,
          children: [X.jsx(pt, {
            size: 12
          }), X.jsx(`span`, {
            children: d
          })]
        }), X.jsx(`div`, {
          className: `border border-[#333] rounded-lg overflow-hidden bg-[#111] relative aspect-video flex items-center justify-center`,
          children: l ? X.jsxs(`div`, {
            className: `text-xs text-gray-500 flex items-center gap-2`,
            children: [X.jsx(L, {
              size: 14,
              className: `animate-spin`
            }), `转换中...`]
          }) : n.imageUrl ? X.jsx(`img`, {
            src: n.imageUrl,
            loading: `lazy`,
            decoding: `async`,
            className: `w-full h-full object-contain cursor-pointer`,
            onDoubleClick: e => {
              e.stopPropagation(), n.onZoom && n.onZoom(n.imageUrl);
            }
          }) : X.jsxs(`div`, {
            className: `text-[10px] text-gray-600 flex flex-col items-center gap-1`,
            children: [X.jsx(Ot, {
              size: 20,
              className: `opacity-50`
            }), X.jsx(`span`, {
              children: `等待图片 URL`
            })]
          })
        })]
      }), X.jsx(_r, {
        type: `source`,
        position: J.Right,
        id: `image`
      })]
    })]
  });
});