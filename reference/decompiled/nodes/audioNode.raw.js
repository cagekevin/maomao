/**
 * 节点类型: audioNode
 * 原版函数名: cs
 * 原版行号: L12802-L13217
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
// in → Zu
// jn → wu
// l → VG
// m → LW
// mt → Vd
// n → Fq
// o → oK
// on → Yu
// p → VW
// pt → Hd
// r → Nq
// s → iK
// t → e1
// u → BG
// ut → Gd
// v → XH
// vn → Lu
// w → xT
// x → Y
// y → Mk
// z → Rw
 */

  cs = Y.memo(({
    id: e,
    data: n,
    selected: r
  }) => {
    let {
        updateNodeData: i,
        getNodes: a,
        getEdges: o
      } = Gt(),
      s = n,
      c = Y.useRef(null),
      [l, u] = Y.useState(null),
      [d, f] = Y.useState(false),
      [p, m] = Y.useState(n.prompt || `请输出简体中文。`),
      [h, g] = Y.useState(n.maxDuration || 10),
      [_, v] = Y.useState(n.pauseGap || .3);
    Y.useEffect(() => {
      i(e, {
        prompt: p,
        maxDuration: h,
        pauseGap: _
      });
    }, [p, h, _, e, i]);
    let y = ut(t({
        handleType: `target`
      }).map(e => e.source)),
      b = Y.useRef(``);
    Y.useEffect(() => {
      if (l) return;
      let t = Array.isArray(y) ? y : y ? [y] : [],
        n = ``;
      for (let e of t) if (e?.data) {
        if (e.data.videoUrl && typeof e.data.videoUrl == `string`) {
          let t = e.data.videoUrl;
          if (t.startsWith(`data:audio/`) || t.startsWith(`data:video/`) || /\.(mp3|wav|ogg|m4a|mp4|webm|mov)($|\?)/i.test(t)) {
            n = t;
            break;
          }
        }
        if (e.data.imageUrl && typeof e.data.imageUrl == `string`) {
          let t = e.data.imageUrl;
          if (t.startsWith(`data:audio/`) || t.startsWith(`data:video/`) || /\.(mp3|wav|ogg|m4a|mp4|webm|mov)($|\?)/i.test(t)) {
            n = t;
            break;
          }
        }
        if (e.data.text && typeof e.data.text == `string`) {
          let t = e.data.text.match(/(https?:\/\/[^\s"'`<>]+)|(data:(audio|video)\/[^\s"']+)/i);
          if (t) {
            n = t[0];
            break;
          }
        }
      }
      if (n && n !== b.current) {
        b.current = n;
        let t = `connected_audio.mp3`;
        if (n.startsWith(`data:audio/`)) t = `base64_audio.mp3`;else try {
          let e = new URL(n),
            r = e.pathname.split(`/`).pop();
          t = r && r.length > 0 && r !== `/` && r.includes(`.`) ? r + e.search : n;
        } catch {
          t = n;
        }
        s.audioUrl = n, s.audioName = t, m(e => e), i(e, {
          audioUrl: n,
          audioName: t,
          errorMessage: undefined
        });
      } else !n && b.current && (b.current = ``, l || i(e, {
        audioUrl: undefined,
        audioName: undefined
      }));
    }, [y, l, e, i]), Y.useEffect(() => {
      i(e, {
        onGenerateAudio: C
      });
    }, [l, s.audioApiUrl, s.audioApiKey, s.audioModel, p, h, _]);
    let x = t => {
        let n = t.target.files?.[0];
        if (!n) return;
        u(n);
        let r = URL.createObjectURL(n);
        s.audioUrl = r, s.audioName = n.name, m(e => e), i(e, {
          audioUrl: r,
          audioName: n.name,
          errorMessage: undefined,
          chunks: undefined
        }), t.target.value = ``;
      },
      C = async () => {
        let t = l;
        if (!t) {
          let n = o(),
            r = a(),
            s = n.filter(t => t.target === e),
            c = ``;
          for (let e of s) {
            let t = r.find(t => t.id === e.source);
            if (t) {
              if (t.data.audioUrl && typeof t.data.audioUrl == `string`) {
                c = t.data.audioUrl;
                break;
              }
              if (t.data.videoUrl && typeof t.data.videoUrl == `string`) {
                let e = t.data.videoUrl;
                if (e.startsWith(`data:audio/`) || e.startsWith(`data:video/`) || /\.(mp3|wav|ogg|m4a|mp4|webm|mov)($|\?)/i.test(e)) {
                  c = e;
                  break;
                }
              }
              if (t.data.imageUrl && typeof t.data.imageUrl == `string`) {
                let e = t.data.imageUrl;
                if (e.startsWith(`data:audio/`) || e.startsWith(`data:video/`) || /\.(mp3|wav|ogg|m4a|mp4|webm|mov)($|\?)/i.test(e)) {
                  c = e;
                  break;
                }
              }
              if (t.data.text && typeof t.data.text == `string`) {
                let e = t.data.text.match(/(https?:\/\/[^\s"'`<>]+)|(data:(audio|video)\/[^\s"']+)/i);
                if (e) {
                  c = e[0];
                  break;
                }
              }
            }
          }
          if (c) {
            i(e, {
              loading: true,
              errorMessage: `正在下载音频...`
            });
            try {
              if (c.startsWith(`data:audio/`) || c.startsWith(`data:video/`)) {
                let n = c.split(`,`),
                  r = n[0].match(/:(.*?);/),
                  a = r ? r[1] : `audio/mpeg`,
                  o = atob(n[1]),
                  s = o.length,
                  l = new Uint8Array(s);
                for (; s--;) l[s] = o.charCodeAt(s);
                let u = `media_generated.${a.split(`/`)[1] || `mp3`}`;
                t = new File([l], u, {
                  type: a
                }), i(e, {
                  audioUrl: URL.createObjectURL(t),
                  audioName: u
                });
              } else {
                let n = new AbortController(),
                  r = setTimeout(() => n.abort(), 18e4),
                  a = await fetch(c, {
                    signal: n.signal
                  });
                if (clearTimeout(r), !a.ok) throw Error(`下载失败: ${a.status}`);
                let o = await a.blob(),
                  s = c.split(`/`).pop() || `audio.mp3`;
                t = new File([o], s, {
                  type: o.type || `audio/mpeg`
                }), i(e, {
                  audioUrl: URL.createObjectURL(t),
                  audioName: s
                });
              }
            } catch (t) {
              i(e, {
                loading: false,
                errorMessage: t.name === `AbortError` ? `音频下载超时 (3分钟)` : `音频下载失败: ${t.message}`
              });
              return;
            }
          }
        }
        if (!t) {
          s.onShowToast?.(`请先上传音频文件或连接包含音频URL的节点`);
          return;
        }
        if (!s.audioApiUrl || !s.audioApiKey) {
          i(e, {
            errorMessage: `请在设置中配置听音 API Key`
          });
          return;
        }
        i(e, {
          loading: true,
          errorMessage: undefined
        });
        try {
          let n = await ss(t, s.audioApiUrl, s.audioApiKey, s.audioModel || `whisper-1`, p, h, _);
          i(e, {
            loading: false,
            chunks: n,
            text: JSON.stringify(n, null, 2)
          }), s.onShowToast?.(`听音断句完成！`);
        } catch (t) {
          console.error(`Audio processing failed:`, t), i(e, {
            loading: false,
            errorMessage: t.message || `处理失败，请重试`
          });
        }
      };
    return X.jsxs(`div`, {
      className: `relative flex flex-col group/node transition-all w-[360px] ${r ? `z-50` : `z-10`}`,
      children: [X.jsx(si, {
        id: e,
        data: n,
        defaultTitle: `听音断句`,
        icon: X.jsx(`span`, {
          className: `text-gray-500`,
          children: `🎙️`
        })
      }), X.jsx(`input`, {
        type: `file`,
        ref: c,
        style: {
          display: `none`
        },
        accept: `audio/*,video/*`,
        onChange: x
      }), s.audioUrl && X.jsx(`div`, {
        className: `absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`,
        children: X.jsxs(`div`, {
          className: `flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`,
          children: [X.jsx(Yn, {
            url: s.audioUrl,
            fallbackExt: `mp3`,
            size: 13,
            onToast: e => s.onShowToast?.(e)
          }), X.jsx(`button`, {
            className: `p-1.5 text-gray-400 hover:text-red-400 hover:bg-[#333] rounded-md`,
            onClick: () => {
              u(null), i(e, {
                audioUrl: undefined,
                audioName: undefined,
                chunks: undefined,
                errorMessage: undefined
              });
            },
            title: `清除`,
            children: X.jsx(S, {
              size: 14
            })
          })]
        })
      }), X.jsxs(`div`, {
        className: `relative bg-[#1c1c1c] rounded-xl overflow-visible border shadow-xl transition-all duration-300 flex flex-col
          ${r ? `border-[#555]` : `border-[#333] hover:border-[#444]`}
        `,
        style: {
          minHeight: `160px`
        },
        children: [X.jsx(_r, {
          type: `target`,
          position: J.Left
        }), X.jsx(_r, {
          type: `source`,
          position: J.Right
        }), X.jsxs(`div`, {
          className: `flex-1 p-3 overflow-y-auto bg-[#1a1a1a] custom-scrollbar relative min-h-[80px] max-h-[160px] rounded-t-xl`,
          children: [s.loading && X.jsxs(`div`, {
            className: `absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500 bg-[#1a1a1a]/80 backdrop-blur-sm z-10`,
            children: [X.jsx(ui, {
              size: 24
            }), X.jsx(`span`, {
              className: `text-xs`,
              children: `处理中...`
            })]
          }), s.errorMessage && !s.loading ? X.jsxs(`div`, {
            className: `text-red-400 text-[10px] p-2 border border-red-500/30 rounded bg-red-500/10 flex items-start gap-1.5`,
            children: [X.jsx(pt, {
              size: 12,
              className: `mt-0.5 flex-shrink-0`
            }), X.jsx(`span`, {
              className: `break-all leading-tight`,
              children: s.errorMessage
            })]
          }) : s.chunks ? X.jsxs(`div`, {
            className: `flex flex-col gap-1 nodrag`,
            children: [X.jsxs(`div`, {
              className: `flex justify-between items-center`,
              children: [X.jsxs(`span`, {
                className: `text-[10px] text-gray-500`,
                children: [`处理结果 (`, s.chunks.length, ` 句)`]
              }), X.jsxs(`button`, {
                onClick: e => {
                  e.stopPropagation(), s.chunks && (navigator.clipboard.writeText(JSON.stringify(s.chunks, null, 2)), s.onShowToast?.(`JSON 已复制到剪贴板`));
                },
                className: `text-[10px] flex items-center gap-1 text-gray-400 hover:text-white transition-colors`,
                children: [X.jsx(on, {
                  size: 10
                }), ` 复制 JSON`]
              })]
            }), X.jsx(`pre`, {
              className: `text-[10px] text-gray-400 font-mono whitespace-pre-wrap break-all nodrag select-text mt-1`,
              children: JSON.stringify(s.chunks, null, 2)
            })]
          }) : X.jsx(`div`, {
            className: `flex items-center justify-center h-full text-gray-500 text-xs mt-8`,
            children: `等待上传并处理...`
          })]
        }), X.jsxs(`div`, {
          className: `p-3 bg-[#1a1a1a] flex flex-col gap-3 nodrag border-t border-[#2a2a2a] rounded-b-xl relative z-10`,
          onClick: e => e.stopPropagation(),
          children: [s.audioUrl ? X.jsxs(`div`, {
            className: `w-full flex flex-col gap-2 bg-[#111] p-2 rounded-lg border border-[#333]`,
            children: [X.jsx(`div`, {
              className: `flex items-center justify-between`,
              children: X.jsxs(`div`, {
                className: `flex items-center gap-2 overflow-hidden`,
                children: [X.jsx(vn, {
                  size: 14,
                  className: `text-green-500 flex-shrink-0`
                }), X.jsx(`span`, {
                  className: `text-xs text-gray-300 truncate`,
                  title: s.audioName,
                  children: s.audioName
                })]
              })
            }), s.audioUrl.match(/\.(mp4|webm|mov|ogg)($|\?)/i) || s.audioUrl.startsWith(`data:video/`) ? X.jsx(`video`, {
              src: s.audioUrl,
              controls: true,
              className: `w-full h-24 object-contain outline-none nodrag bg-black rounded`
            }) : X.jsx(`audio`, {
              src: s.audioUrl,
              controls: true,
              className: `w-full h-8 outline-none nodrag`
            })]
          }) : X.jsxs(`div`, {
            className: `w-full py-4 rounded-lg border border-dashed border-[#444] bg-[#111] hover:bg-[#1a1a1a] hover:border-[#666] flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors group/upload`,
            onClick: () => c.current?.click(),
            children: [X.jsx(jn, {
              size: 16,
              className: `text-gray-500 group-hover/upload:text-green-500 transition-colors`
            }), X.jsx(`span`, {
              className: `text-[10px] text-gray-500`,
              children: `点击上传音视频或连接含音频的节点`
            })]
          }), d && X.jsxs(`div`, {
            className: `flex flex-col gap-3 bg-[#111] border border-[#333] rounded p-3 mt-1 animate-fade-in nodrag`,
            children: [X.jsxs(`div`, {
              className: `flex flex-col gap-1.5`,
              children: [X.jsx(`label`, {
                className: `text-[10px] text-gray-400`,
                children: `提示词 (Prompt)`
              }), X.jsx(`input`, {
                type: `text`,
                className: `w-full bg-[#222] border border-[#333] rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500`,
                value: p,
                onChange: e => m(e.target.value),
                placeholder: `请输出简体中文。`
              })]
            }), X.jsxs(`div`, {
              className: `flex gap-2`,
              children: [X.jsxs(`div`, {
                className: `flex flex-col gap-1.5 flex-1`,
                children: [X.jsx(`label`, {
                  className: `text-[10px] text-gray-400`,
                  children: `换气停顿 (秒)`
                }), X.jsx(`input`, {
                  type: `number`,
                  step: `0.1`,
                  min: `0`,
                  className: `w-full bg-[#222] border border-[#333] rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500`,
                  value: _,
                  onChange: e => v(parseFloat(e.target.value) || .3)
                })]
              }), X.jsxs(`div`, {
                className: `flex flex-col gap-1.5 flex-1`,
                children: [X.jsx(`label`, {
                  className: `text-[10px] text-gray-400`,
                  children: `强制熔断 (秒)`
                }), X.jsx(`input`, {
                  type: `number`,
                  step: `1`,
                  min: `1`,
                  className: `w-full bg-[#222] border border-[#333] rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500`,
                  value: h,
                  onChange: e => g(parseFloat(e.target.value) || 10)
                })]
              })]
            })]
          }), X.jsxs(`div`, {
            className: `flex justify-between items-center mt-1`,
            children: [X.jsxs(`button`, {
              className: `p-1.5 rounded flex items-center gap-1 transition-colors ${d ? `text-blue-400 bg-[#333]` : `text-gray-400 hover:bg-[#333]`}`,
              onClick: e => {
                e.stopPropagation(), f(!d);
              },
              title: `参数配置`,
              children: [X.jsx(ne, {
                size: 14
              }), X.jsx(`span`, {
                className: `text-[10px]`,
                children: d ? `收起配置` : `配置`
              })]
            }), X.jsx(`button`, {
              className: `px-4 py-1.5 rounded-full text-xs flex items-center gap-1.5 transition-all ${s.audioUrl ? s.loading ? `bg-blue-600/50 text-white cursor-wait` : `bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20` : `bg-[#333] text-gray-500 cursor-not-allowed`}`,
              onClick: C,
              disabled: !s.audioUrl || s.loading,
              children: s.loading ? X.jsxs(X.Fragment, {
                children: [X.jsx(L, {
                  size: 12,
                  className: `animate-spin`
                }), `处理中...`]
              }) : X.jsxs(X.Fragment, {
                children: [X.jsx(vn, {
                  size: 12
                }), `开始断句`]
              })
            })]
          })]
        })]
      })]
    });
  });