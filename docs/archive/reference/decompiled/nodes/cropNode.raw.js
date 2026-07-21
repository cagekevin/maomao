/**
 * 节点类型: cropNode
 * 原版函数名: eo
 * 原版行号: L5931-L6032
 * 来源: App-B9jVCs-a.decompiled.js
 *
 * 变量映射（vendor-map.json）:
// a → ZK
// b → dT
// c → tK
// e → i
// h → xW
// i → jq
// n → Fq
// o → oK
// p → VW
// r → Nq
// s → iK
// t → e1
// w → xT
// yn → Iu
// z → Rw
 */

function eo({
  id: e,
  data: t,
  selected: n
}) {
  let [r, i] = Y.useState(),
    [a, o] = Y.useState(),
    s = Y.useRef(null);
  return X.jsxs(`div`, {
    className: `relative flex flex-col ${n ? `z-50` : `z-40`}`,
    children: [X.jsx(si, {
      id: e,
      data: t,
      defaultTitle: `裁剪模式`,
      icon: X.jsx(`span`, {
        className: `text-gray-500`,
        children: `✂️`
      })
    }), X.jsxs(`div`, {
      className: `relative bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`,
      children: [X.jsx(`div`, {
        className: `p-2 bg-[#2a2a2a] flex justify-end items-center border-b border-[#333]`,
        children: X.jsxs(`div`, {
          className: `flex gap-2`,
          children: [X.jsxs(`button`, {
            onClick: async () => {
              if (a && s.current && t.onCropComplete && a.width && a.height) try {
                let n = await $a(s.current, a);
                t.onCropComplete(e, n);
              } catch (e) {
                console.error(`Crop failed`, e);
              }
            },
            className: `p-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-md transition-colors flex items-center gap-1`,
            title: `确认裁剪`,
            children: [X.jsx(Pn, {
              size: 14
            }), X.jsx(`span`, {
              className: `text-xs`,
              children: `确认`
            })]
          }), X.jsxs(`button`, {
            onClick: () => {
              t.onCancel && t.onCancel(e);
            },
            className: `p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md transition-colors flex items-center gap-1`,
            title: `取消`,
            children: [X.jsx(yn, {
              size: 14
            }), X.jsx(`span`, {
              className: `text-xs`,
              children: `取消`
            })]
          })]
        })
      }), X.jsx(`div`, {
        className: `p-4 bg-[#0d0c0c] min-w-[300px] min-h-[200px] flex items-center justify-center cursor-crosshair nodrag nowheel`,
        onMouseDownCapture: e => e.stopPropagation(),
        onTouchStartCapture: e => e.stopPropagation(),
        onWheelCapture: e => e.stopPropagation(),
        children: t.imageUrl ? X.jsx(c, {
          crop: r,
          onChange: e => i(e),
          onComplete: e => o(e),
          aspect: undefined,
          minWidth: 10,
          minHeight: 10,
          ruleOfThirds: true,
          className: `max-w-full max-h-full`,
          children: X.jsx(`img`, {
            ref: s,
            src: t.imageUrl,
            onLoad: e => {
              let {
                width: t,
                height: n
              } = e.currentTarget;
              i(In(ge({
                unit: `%`,
                width: 80
              }, t / n, t, n), t, n));
            },
            alt: `Crop me`,
            className: `max-w-[600px] max-h-[600px] object-contain pointer-events-none select-none`,
            draggable: false
          })
        }) : X.jsx(`div`, {
          className: `text-gray-500 text-sm`,
          children: `等待输入图片...`
        })
      }), X.jsx(E, {
        type: `target`,
        position: J.Left,
        className: `!bg-[#666] !w-4 !h-4 !border-2 !border-[#333]`
      }), X.jsx(E, {
        type: `source`,
        position: J.Right,
        className: `!bg-[#666] !w-4 !h-4 !border-2 !border-[#333]`
      })]
    })]
  });
}