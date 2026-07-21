/**
 * 节点类型: textConcatNode
 * 原版函数名: Rc
 * 原版行号: L18812-L18920
 * 来源: App-B9jVCs-a.decompiled.js
 *
 * 变量映射（vendor-map.json）:
// _r → Rl
// a → ZK
// c → tK
// d → zG
// e → i
// f → MG
// g → qU
// h → xW
// i → jq
// l → VG
// m → LW
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

  Rc = Y.memo(({
    id: e,
    data: n,
    selected: r
  }) => {
    let {
        updateNodeData: i
      } = Gt(),
      a = t({
        handleType: `target`
      }),
      o = ut(a.map(e => e.source)),
      [s, c] = Y.useState(n.separator === undefined ? `\\n` : n.separator),
      [l, u] = Y.useState(n.prefix || ``),
      [d, f] = Y.useState(n.suffix || ``),
      p = a.map(e => hs(o.find(t => t?.id === e.source))).filter(e => e),
      m = s.replace(/\\n/g, `
`),
      h = p.length > 0 ? `${l}${p.join(m)}${d}` : ``;
    return Y.useEffect(() => {
      n.text !== h && i(e, {
        text: h
      });
    }, [h, e, i, n.text]), X.jsxs(`div`, {
      className: `relative flex flex-col`,
      children: [X.jsx(si, {
        id: e,
        data: n,
        defaultTitle: `文字拼接`,
        icon: X.jsx(Dn, {
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
            className: `space-y-1`,
            children: [X.jsx(`label`, {
              className: `text-[10px] text-gray-500`,
              children: `前缀`
            }), X.jsx(`input`, {
              type: `text`,
              value: l,
              onChange: t => {
                u(t.target.value), i(e, {
                  prefix: t.target.value
                });
              },
              className: `w-full bg-[#111] border border-[#333] rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-gray-500 nodrag`,
              placeholder: `可选`
            })]
          }), X.jsxs(`div`, {
            className: `space-y-1`,
            children: [X.jsx(`label`, {
              className: `text-[10px] text-gray-500`,
              children: `分隔符 (输入 \\n 表示换行)`
            }), X.jsx(`input`, {
              type: `text`,
              value: s,
              onChange: t => {
                c(t.target.value), i(e, {
                  separator: t.target.value
                });
              },
              className: `w-full bg-[#111] border border-[#333] rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-gray-500 nodrag`
            })]
          }), X.jsxs(`div`, {
            className: `space-y-1`,
            children: [X.jsx(`label`, {
              className: `text-[10px] text-gray-500`,
              children: `后缀`
            }), X.jsx(`input`, {
              type: `text`,
              value: d,
              onChange: t => {
                f(t.target.value), i(e, {
                  suffix: t.target.value
                });
              },
              className: `w-full bg-[#111] border border-[#333] rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-gray-500 nodrag`,
              placeholder: `可选`
            })]
          }), X.jsxs(`div`, {
            className: `space-y-1 pt-2 border-t border-[#333]`,
            children: [X.jsx(`label`, {
              className: `text-[10px] text-gray-500 flex justify-between`,
              children: X.jsxs(`span`, {
                children: [`拼接结果 (`, p.length, ` 个输入)`]
              })
            }), X.jsx(`textarea`, {
              readOnly: true,
              value: h,
              className: `w-full bg-[#111] border border-[#333] rounded px-2 py-1 text-xs text-gray-300 h-[60px] resize-y custom-scrollbar`,
              placeholder: `等待连入文本...`
            })]
          })]
        }), X.jsx(_r, {
          type: `source`,
          position: J.Right,
          id: `text`
        })]
      })]
    });
  });