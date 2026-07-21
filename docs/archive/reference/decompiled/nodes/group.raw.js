/**
 * 节点类型: group
 * 原版函数名: Eh
 * 原版行号: L28406-L28519
 * 来源: App-B9jVCs-a.decompiled.js
 *
 * 变量映射（vendor-map.json）:
// _t → Rd
// a → ZK
// c → tK
// d → zG
// e → i
// f → MG
// h → xW
// i → jq
// l → VG
// m → LW
// mr → Vl
// mt → Vd
// n → Fq
// o → oK
// p → VW
// r → Nq
// s → iK
// t → e1
// u → BG
// w → xT
 */

function Eh({
  id: e,
  data: t,
  selected: n
}) {
  let {
      updateNodeData: r,
      setNodes: i
    } = Gt(),
    [a, o] = Y.useState(false),
    [s, c] = Y.useState(t?.name || `编组`),
    l = Y.useRef(null),
    u = t?.collapsed || false;
  Y.useEffect(() => {
    a && l.current && (l.current.focus(), l.current.select());
  }, [a]);
  let d = e => {
      c(e.target.value);
    },
    f = () => {
      o(false), r(e, {
        name: s
      });
    },
    p = e => {
      e.key === `Enter` && f();
    },
    m = t => {
      t.stopPropagation();
      let n = !u;
      i(t => t.map(t => {
        if (t.id === e) if (n) {
          let e = t.style?.width || t.measured?.width || 300,
            n = t.style?.height || t.measured?.height || 200;
          return {
            ...t,
            data: {
              ...t.data,
              collapsed: true,
              expandedWidth: e,
              expandedHeight: n
            },
            style: {
              ...t.style,
              width: `max-content`,
              height: 40,
              backgroundColor: `transparent`,
              border: `none`
            }
          };
        } else return {
          ...t,
          data: {
            ...t.data,
            collapsed: false
          },
          style: {
            ...t.style,
            width: t.data?.expandedWidth || 300,
            height: t.data?.expandedHeight || 200,
            backgroundColor: undefined,
            border: undefined
          }
        };
        return t;
      }));
    };
  return u ? X.jsxs(`div`, {
    className: `relative flex items-center justify-center bg-[#2a1f24] border border-dashed ${n ? `border-[#555]` : `border-[#444]`} rounded-xl px-4 py-2 shadow-lg min-w-[120px] h-[40px] cursor-pointer hover:bg-[#352a30] hover:border-gray-400 transition-all duration-300`,
    onClick: m,
    children: [X.jsx(E, {
      type: `target`,
      position: J.Left,
      className: `!w-2 !h-2 !bg-gray-500 !border-gray-600 !opacity-0`
    }), X.jsx(_t, {
      className: `w-4 h-4 text-gray-400 mr-1`
    }), X.jsx(mt, {
      className: `w-4 h-4 text-[#8b92a5] mr-2`
    }), X.jsx(`span`, {
      className: `text-gray-300 text-sm select-none`,
      children: s
    }), X.jsx(E, {
      type: `source`,
      position: J.Right,
      className: `!w-2 !h-2 !bg-gray-500 !border-gray-600 !opacity-0`
    })]
  }) : X.jsx(`div`, {
    className: `relative w-full h-full rounded-xl transition-all duration-300 ${n ? `border border-[#555]` : `border border-transparent hover:border-white/10`} bg-[#1e171b]/50 hover:bg-[#161214] group`,
    children: X.jsxs(`div`, {
      className: `absolute -top-8 left-0 flex items-center px-2 py-1`,
      onDoubleClick: () => o(true),
      children: [X.jsx(`button`, {
        onClick: m,
        className: `mr-1 hover:bg-white/10 rounded p-0.5 transition-colors`,
        children: X.jsx(Sn, {
          className: `w-4 h-4 text-gray-500 group-hover:text-gray-300`
        })
      }), X.jsx(mt, {
        className: `w-4 h-4 text-[#8b92a5] mr-1.5`
      }), a ? X.jsx(`input`, {
        ref: l,
        type: `text`,
        value: s,
        onChange: d,
        onBlur: f,
        onKeyDown: p,
        className: `bg-[#2a2a2a] border border-[#444] rounded outline-none text-gray-200 text-sm w-32 focus:border-blue-500 px-1 py-0.5`
      }) : X.jsx(`span`, {
        className: `text-gray-400 group-hover:text-gray-300 text-sm select-none cursor-text transition-colors`,
        children: s
      })]
    })
  });
}