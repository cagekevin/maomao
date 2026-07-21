/**
 * 节点类型: fileToUrlNode
 * 原版函数名: qc
 * 原版行号: L19270-L19421
 * 来源: App-B9jVCs-a.decompiled.js
 *
 * 变量映射（vendor-map.json）:
// _r → Rl
// a → ZK
// c → tK
// e → i
// h → xW
// i → jq
// kn → Eu
// l → VG
// mt → Vd
// n → Fq
// o → oK
// p → VW
// pt → Hd
// r → Nq
// s → iK
// t → e1
// ut → Gd
// w → xT
 */

function qc({
  id: e,
  data: n,
  selected: r
}) {
  let i = ut(t({
      handleType: `target`,
      handleId: `file-input`
    }).map(e => e.source)),
    {
      updateNodeData: a
    } = Gt(),
    o = Uc(),
    s = n.cloudStorageConfig,
    c = ``,
    l = ``;
  if (i.length > 0) {
    let e = i[0].data;
    e.imageUrl ? (c = e.imageUrl, l = `image`) : e.videoUrl ? (c = e.videoUrl, l = `video`) : e.audioUrl ? (c = e.audioUrl, l = `audio`) : e.text ? (c = e.text, l = `text`) : e.customResultData && (c = e.customResultData, l = e.customOutputType);
  }
  return X.jsxs(`div`, {
    className: `relative flex flex-col`,
    children: [X.jsx(si, {
      id: e,
      data: n,
      defaultTitle: `文件转链接`,
      icon: X.jsx(kn, {
        size: 11,
        className: `text-gray-500`
      })
    }), X.jsx(`div`, {
      className: `relative bg-[#1c1c1c] border-2 rounded-xl w-[320px] shadow-2xl transition-all duration-200 flex flex-col ${r ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`,
      children: X.jsxs(`div`, {
        className: `p-4 flex flex-col gap-4 relative`,
        children: [X.jsx(_r, {
          type: `target`,
          position: J.Left,
          id: `file-input`
        }), X.jsx(`div`, {
          className: `bg-[#0d0c0c] rounded-lg border border-[#333] h-32 flex items-center justify-center relative overflow-hidden`,
          children: c ? l === `image` ? X.jsx(`img`, {
            src: c,
            loading: `lazy`,
            decoding: `async`,
            className: `w-full h-full object-contain`,
            alt: `输入预览`
          }) : l === `video` ? X.jsx(`video`, {
            src: c,
            preload: `metadata`,
            className: `w-full h-full object-contain`
          }) : l === `audio` ? X.jsxs(`div`, {
            className: `text-gray-500 text-xs flex flex-col items-center gap-2`,
            children: [X.jsx(kn, {
              size: 24,
              className: `text-gray-400`
            }), X.jsx(`span`, {
              children: `已连入音频文件`
            })]
          }) : X.jsxs(`div`, {
            className: `text-gray-500 text-xs flex flex-col items-center gap-2`,
            children: [X.jsx(kn, {
              size: 24,
              className: `text-gray-400`
            }), X.jsxs(`span`, {
              children: [`已连入文件 (`, l, `)`]
            })]
          }) : X.jsxs(`div`, {
            className: `text-gray-500 text-xs flex flex-col items-center gap-2`,
            children: [X.jsx(kn, {
              size: 24,
              className: `opacity-50`
            }), X.jsx(`span`, {
              children: `连线传入文件或文本`
            })]
          })
        }), X.jsx(`button`, {
          onClick: async () => {
            if (!c) {
              n.onShowToast?.(`没有接收到文件`);
              return;
            }
            if (!s || !s.accessKey) {
              n.onShowToast?.(`未配置对象存储，请先在设置->对象存储中填写`);
              return;
            }
            a(e, {
              loading: true,
              errorMsg: null
            });
            try {
              let t;
              t = l === `text` && !c.startsWith(`data:`) && !c.startsWith(`http`) ? new Blob([c], {
                type: `text/plain`
              }) : await (await zc(c, {
                method: `GET`,
                localPort: o.status.isConnected ? o.status.port : undefined
              })).blob(), a(e, {
                resultUrl: await Kc(t, s),
                loading: false
              }), n.onShowToast?.(`上传成功`);
            } catch (t) {
              console.error(t), a(e, {
                errorMsg: t.message || `上传失败`,
                loading: false
              });
            }
          },
          disabled: !c || n.loading,
          className: `w-full py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${c ? n.loading ? `bg-[#444] text-white cursor-wait opacity-80` : `bg-[#444] hover:bg-[#555] text-white shadow-lg` : `bg-[#222] text-gray-500 cursor-not-allowed`}`,
          children: n.loading ? X.jsxs(X.Fragment, {
            children: [X.jsx(L, {
              size: 16,
              className: `animate-spin`
            }), ` 上传中...`]
          }) : X.jsx(X.Fragment, {
            children: `生成链接`
          })
        }), n.errorMsg && X.jsxs(`div`, {
          className: `text-xs text-red-400 bg-red-400/10 p-2 rounded flex items-start gap-1.5`,
          children: [X.jsx(pt, {
            size: 14,
            className: `shrink-0 mt-0.5`
          }), X.jsx(`span`, {
            className: `break-words`,
            children: n.errorMsg
          })]
        }), n.resultUrl && X.jsxs(`div`, {
          className: `bg-[#0d0c0c] p-3 rounded-lg border border-[#444] flex flex-col gap-2`,
          children: [X.jsxs(`div`, {
            className: `text-xs text-gray-400 flex items-center justify-between`,
            children: [X.jsx(`span`, {
              children: `生成结果:`
            }), X.jsx(`button`, {
              onClick: () => {
                navigator.clipboard.writeText(n.resultUrl), n.onShowToast?.(`链接已复制`);
              },
              className: `text-gray-300 hover:text-white transition-colors`,
              children: `复制`
            })]
          }), X.jsx(`div`, {
            className: `text-xs text-gray-200 break-all select-all font-mono`,
            children: n.resultUrl
          })]
        }), X.jsx(_r, {
          type: `source`,
          position: J.Right,
          id: `url-output`
        })]
      })
    })]
  });
}