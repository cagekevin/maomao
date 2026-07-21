/**
 * 节点类型: videoExtractNode
 * 原版函数名: Ns
 * 原版行号: L16031-L16603
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
// j → GE
// jn → wu
// k → cO
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

  Ns = Y.memo(({
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
      [p, m] = Y.useState(n.mode || `count`),
      [h, g] = Y.useState(n.intervalSec || 2),
      [_, v] = Y.useState(n.frameCount || 9),
      [y, b] = Y.useState(n.sensitivity || 30),
      [x] = Y.useState(n.hiddenIndices || []),
      S = Y.useRef(null),
      [C, w] = Y.useState(0),
      [T, E] = Y.useState(0);
    Y.useEffect(() => {
      i(e, {
        mode: p,
        intervalSec: h,
        frameCount: _,
        sensitivity: y,
        hiddenIndices: x
      });
    }, [p, h, _, y, x, e, i]);
    let O = t({
        handleType: `target`
      }),
      k = ut(Y.useMemo(() => O.map(e => e.source), [O])),
      A = Y.useRef(``);
    Y.useEffect(() => {
      if (l) return;
      let t = Array.isArray(k) ? k : k ? [k] : [],
        n = ``;
      for (let e of t) if (e?.data) {
        if (e.data.videoUrl && typeof e.data.videoUrl == `string`) {
          n = e.data.videoUrl;
          break;
        }
        if (e.data.imageUrl && typeof e.data.imageUrl == `string`) {
          let t = e.data.imageUrl;
          if (t.startsWith(`data:video/`) || /\.(mp4|webm|mov|ogg)($|\?)/i.test(t)) {
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
      if (n && n !== A.current) {
        A.current = n;
        let t = `connected_video.mp4`;
        if (n.startsWith(`data:video/`)) t = `base64_video.mp4`;else try {
          let e = new URL(n),
            r = e.pathname.split(`/`).pop();
          t = r && r.includes(`.`) ? r + e.search : n;
        } catch {
          t = n;
        }
        i(e, {
          videoUrl: n,
          videoName: t,
          errorMessage: undefined
        });
      } else !n && A.current && (A.current = ``, l || i(e, {
        videoUrl: undefined,
        videoName: undefined
      }));
    }, [k, l, e, i]), Y.useEffect(() => {
      i(e, {
        onExtractFrames: N
      });
    }, [l, p, h, _, y]);
    let j = t => {
        let n = t.target.files?.[0];
        if (!n) return;
        u(n);
        let r = URL.createObjectURL(n);
        s.videoUrl = r, s.videoName = n.name, i(e, {
          videoUrl: r,
          videoName: n.name,
          errorMessage: undefined,
          extractedImages: undefined,
          progress: 0
        }), t.target.value = ``;
      },
      M = async () => {
        let t = S.current;
        if (t) try {
          let n = document.createElement(`canvas`),
            r = n.getContext(`2d`, {
              willReadFrequently: true
            });
          if (!r) throw Error(`Canvas not supported`);
          let a = t.videoWidth,
            o = t.videoHeight;
          if (a === 0 || o === 0) throw Error(`Video dimensions not available`);
          (a > 800 || o > 800) && (a > o ? (o = Math.round(o * 800 / a), a = 800) : (a = Math.round(a * 800 / o), o = 800)), n.width = a, n.height = o, r.drawImage(t, 0, 0, a, o);
          let c = n.toDataURL(`image/jpeg`, .8),
            l = [...(s.allExtractedImages || []), c];
          i(e, {
            allExtractedImages: l,
            extractedImages: l
          }), s.onShowToast?.(`已截取当前帧`);
        } catch (e) {
          console.error(`Manual capture failed:`, e), s.onShowToast?.(`截取失败，可能是跨域限制或视频未就绪`);
        }
      },
      N = async () => {
        let t = ``;
        if (l) t = URL.createObjectURL(l);else {
          let n = o(),
            r = a(),
            i = n.filter(t => t.target === e);
          for (let e of i) {
            let n = r.find(t => t.id === e.source);
            if (n) {
              if (n.data.videoUrl && typeof n.data.videoUrl == `string`) {
                let e = n.data.videoUrl;
                if (e.startsWith(`data:audio/`) || e.startsWith(`data:video/`) || /\.(mp3|wav|ogg|m4a|mp4|webm|mov)($|\?)/i.test(e)) {
                  t = e;
                  break;
                }
              }
              if (n.data.imageUrl && typeof n.data.imageUrl == `string`) {
                let e = n.data.imageUrl;
                if (e.startsWith(`data:video/`) || /\.(mp4|webm|mov|ogg)($|\?)/i.test(e)) {
                  t = e;
                  break;
                }
              }
              if (n.data.text && typeof n.data.text == `string`) {
                let e = n.data.text.match(/(https?:\/\/[^\s"'`<>]+)|(data:(audio|video)\/[^\s"']+)/i);
                if (e) {
                  t = e[0];
                  break;
                }
              }
            }
          }
        }
        if (!t) {
          s.onShowToast?.(`请先上传视频或连接包含视频的节点`);
          return;
        }
        i(e, {
          loading: true,
          errorMessage: undefined,
          progress: 0,
          extractedImages: []
        });
        try {
          let n = document.createElement(`video`);
          n.src = t, n.crossOrigin = `anonymous`, n.muted = true, n.playsInline = true, await new Promise((e, t) => {
            n.onloadedmetadata = e, n.onerror = t;
          });
          let r = n.duration;
          if (!r || isNaN(r) || r === 1 / 0) throw Error(`无法获取视频时长`);
          let a = document.createElement(`canvas`),
            o = a.getContext(`2d`, {
              willReadFrequently: true
            });
          if (!o) throw Error(`Canvas 2D ctx not supported`);
          let c = n.videoWidth,
            l = n.videoHeight;
          (c > 800 || l > 800) && (c > l ? (l = Math.round(l * 800 / c), c = 800) : (c = Math.round(c * 800 / l), l = 800)), a.width = c, a.height = l;
          let u = async e => new Promise(t => {
              let r = () => {
                n.removeEventListener(`seeked`, r), o.drawImage(n, 0, 0, c, l), t(a.toDataURL(`image/jpeg`, .8));
              };
              n.addEventListener(`seeked`, r), n.currentTime = e;
            }),
            d = [];
          if (p === `count`) {
            let e = Math.max(1, _),
              t = r / (e + 1);
            for (let n = 1; n <= e; n++) d.push(n * t);
          } else if (p === `interval`) {
            let e = Math.max(.5, h);
            for (let t = e; t < r; t += e) d.push(t);
          } else if (p === `first_last`) d.push(0), d.push(Math.max(0, r - .1));else if (p === `manual`) {
            s.onShowToast?.(`手动模式请直接在上方播放器中截取`);
            return;
          } else if (p === `smart`) {
            let t = document.createElement(`canvas`);
            t.width = 16, t.height = 16;
            let a = t.getContext(`2d`, {
              willReadFrequently: true
            });
            if (!a) throw Error(`Canvas 2D ctx not supported`);
            let o = async e => new Promise(t => {
                let r = () => {
                  n.removeEventListener(`seeked`, r), a.drawImage(n, 0, 0, 16, 16), t(a.getImageData(0, 0, 16, 16).data);
                };
                n.addEventListener(`seeked`, r), n.currentTime = e;
              }),
              s = null,
              c = 195840 * (.01 + .24 * ((100 - y) / 100) ** 2);
            for (let t = .5; t < r; t += .5) {
              i(e, {
                progress: Math.round(t / r * 50)
              });
              let n = await o(t);
              if (s) {
                let e = 0;
                for (let t = 0; t < n.length; t += 4) e += Math.abs(n[t] - s[t]), e += Math.abs(n[t + 1] - s[t + 1]), e += Math.abs(n[t + 2] - s[t + 2]);
                if (e > c) {
                  d.push(t), t += 1, s = await o(t);
                  continue;
                }
              }
              s = n;
            }
          }
          d.length === 0 && p === `smart` && d.push(r / 2);
          let f = [];
          for (let t = 0; t < d.length; t++) {
            i(e, {
              progress: 50 + Math.round(t / d.length * 50)
            });
            let n = await u(d[t]);
            f.push(n), i(e, {
              extractedImages: [...f]
            });
          }
          i(e, {
            loading: false,
            progress: 100,
            allExtractedImages: f,
            extractedImages: f,
            hiddenIndices: [],
            imageUrl: undefined
          }), s.onShowToast?.(`抽帧完成！共提取 ${f.length} 张图片`), n.src = ``, n.load();
        } catch (t) {
          console.error(`Frame extraction failed:`, t), i(e, {
            loading: false,
            errorMessage: t.message || `抽帧失败，可能是视频格式或跨域限制`
          });
        }
      },
      P = async e => {
        if (e.stopPropagation(), !s.extractedImages || s.extractedImages.length === 0) {
          s.onShowToast?.(`没有提取出的图片可复制`);
          return;
        }
        try {
          let e = {
              type: `mutiwindow-images`,
              images: s.extractedImages
            },
            t = JSON.stringify(e);
          try {
            await navigator.clipboard.writeText(t);
          } catch {
            localStorage.setItem(`mutiwindow-clipboard`, t);
          }
          s.onShowToast?.(`已复制 ${s.extractedImages.length} 张图片`);
        } catch {
          s.onShowToast?.(`复制失败`);
        }
      };
    return X.jsxs(`div`, {
      className: `relative group/node w-full h-full min-w-[280px] ${p === `manual` ? `min-h-[380px]` : `min-h-[220px]`}`,
      children: [X.jsx(si, {
        id: e,
        data: n,
        defaultTitle: `视频抽帧`,
        icon: X.jsx(D, {
          size: 11,
          className: `text-gray-500`
        })
      }), X.jsx(ci, {
        visible: !!r,
        minWidth: 280,
        minHeight: p === `manual` ? 380 : 220
      }), X.jsxs(`div`, {
        className: `w-full h-full bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 flex flex-col ${r ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`,
        children: [X.jsx(_r, {
          type: `target`,
          position: J.Left
        }), X.jsx(`input`, {
          type: `file`,
          ref: c,
          style: {
            display: `none`
          },
          accept: `video/*`,
          onChange: j
        }), X.jsxs(`div`, {
          className: `flex-1 flex flex-col overflow-hidden relative`,
          children: [X.jsxs(`div`, {
            className: `flex-1 bg-[#111] p-4 overflow-y-auto relative border-b border-[#2a2a2a] custom-scrollbar nowheel nopan nodrag flex flex-col gap-4`,
            children: [s.allExtractedImages && s.allExtractedImages.length > 0 && X.jsxs(`button`, {
              onClick: e => P(e),
              className: `absolute top-2 right-2 z-10 text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 px-2 py-1 rounded bg-[#222]/90 hover:bg-[#333] transition-colors`,
              children: [X.jsx(on, {
                size: 12
              }), ` 复制全部`]
            }), s.errorMessage && X.jsxs(`div`, {
              className: `flex flex-col items-center justify-center h-full gap-2 text-red-400 p-4 text-center`,
              children: [X.jsx(pt, {
                size: 24
              }), X.jsx(`span`, {
                className: `text-xs break-words`,
                children: s.errorMessage
              })]
            }), p === `manual` && s.videoUrl && !s.errorMessage && X.jsxs(`div`, {
              className: `flex flex-col gap-3 bg-[#1a1a1a] p-3 rounded-lg border border-[#333] flex-shrink-0`,
              children: [X.jsx(`video`, {
                ref: S,
                src: s.videoUrl,
                crossOrigin: `anonymous`,
                className: `w-full aspect-video bg-black rounded`,
                onLoadedMetadata: e => w(e.currentTarget.duration),
                onTimeUpdate: e => E(e.currentTarget.currentTime),
                playsInline: true,
                muted: true
              }), X.jsxs(`div`, {
                className: `flex items-center gap-2 text-xs`,
                children: [X.jsx(`button`, {
                  onClick: () => {
                    S.current && (S.current.currentTime = Math.max(0, S.current.currentTime - .033));
                  },
                  className: `px-2 py-1.5 bg-[#2a2a2a] rounded-md hover:bg-[#333] text-gray-300 transition-colors`,
                  title: `后退1帧`,
                  children: `-1帧`
                }), X.jsx(`input`, {
                  type: `range`,
                  min: `0`,
                  max: C || 100,
                  step: `0.01`,
                  value: T,
                  onChange: e => {
                    S.current && (S.current.currentTime = Number(e.target.value));
                  },
                  className: `flex-1 accent-white min-w-0`
                }), X.jsx(`button`, {
                  onClick: () => {
                    S.current && (S.current.currentTime = Math.min(C, S.current.currentTime + .033));
                  },
                  className: `px-2 py-1.5 bg-[#2a2a2a] rounded-md hover:bg-[#333] text-gray-300 transition-colors`,
                  title: `前进1帧`,
                  children: `+1帧`
                }), X.jsxs(`button`, {
                  onClick: M,
                  className: `px-4 py-1.5 bg-white hover:bg-gray-200 rounded-md text-black font-medium ml-2 flex-shrink-0 flex items-center gap-1.5 shadow-sm transition-colors`,
                  children: [X.jsx(Ot, {
                    size: 14
                  }), `截取`]
                })]
              })]
            }), !s.errorMessage && s.allExtractedImages && s.allExtractedImages.length > 0 ? X.jsxs(`div`, {
              className: `flex flex-col h-full gap-3`,
              children: [X.jsx(`div`, {
                className: `flex justify-between items-center px-1`,
                children: X.jsxs(`span`, {
                  className: `text-xs text-gray-400 font-medium`,
                  children: [`已提取 `, s.allExtractedImages.length, ` 帧 (当前生效 `, s.extractedImages?.length || 0, ` 帧)`]
                })
              }), X.jsx(`div`, {
                className: `grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3 auto-rows-max`,
                children: s.allExtractedImages.map((e, t) => x.includes(t) ? null : X.jsxs(`div`, {
                  className: `aspect-video bg-black rounded-lg border relative group/img border-[#333] overflow-hidden`,
                  children: [X.jsx(`img`, {
                    src: e,
                    loading: `lazy`,
                    decoding: `async`,
                    className: `w-full h-full object-cover`
                  }), X.jsx(`div`, {
                    className: `absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-3`,
                    children: X.jsx(`button`, {
                      onClick: t => {
                        t.stopPropagation();
                        try {
                          let t = JSON.stringify({
                            type: `mutiwindow-images`,
                            images: [e]
                          });
                          try {
                            navigator.clipboard.writeText(t);
                          } catch {
                            localStorage.setItem(`mutiwindow-clipboard`, t);
                          }
                          s.onShowToast?.(`已复制当前帧，请在空白处粘贴 (Ctrl+V)`);
                        } catch {
                          s.onShowToast?.(`复制失败`);
                        }
                      },
                      className: `p-2 bg-[#222] hover:bg-white rounded-full text-gray-300 hover:text-black transition-all shadow-lg`,
                      title: `复制为新节点 (Ctrl+V粘贴)`,
                      children: X.jsx(on, {
                        size: 16
                      })
                    })
                  })]
                }, t))
              })]
            }) : !s.errorMessage && !(p === `manual` && s.videoUrl) ? X.jsx(`div`, {
              className: `flex items-center justify-center h-full min-h-[120px]`,
              children: s.loading ? X.jsxs(`div`, {
                className: `flex flex-col items-center gap-3`,
                children: [X.jsx(L, {
                  size: 24,
                  className: `animate-spin text-gray-400`
                }), X.jsxs(`span`, {
                  className: `text-xs text-gray-400`,
                  children: [`正在处理... `, s.progress, `%`]
                }), X.jsx(`div`, {
                  className: `w-32 h-1 bg-[#333] rounded-full overflow-hidden`,
                  children: X.jsx(`div`, {
                    className: `h-full bg-white transition-all duration-300`,
                    style: {
                      width: `${s.progress}%`
                    }
                  })
                })]
              }) : X.jsx(`span`, {
                className: `text-xs text-gray-500`,
                children: `等待提取`
              })
            }) : null]
          }), X.jsxs(`div`, {
            className: `p-4 bg-[#1a1a1a] flex flex-col gap-4 nodrag border-t border-[#2a2a2a]`,
            children: [s.videoUrl ? X.jsxs(`div`, {
              className: `w-full flex items-center justify-between bg-[#111] rounded-lg px-3 py-2.5 border border-[#333]`,
              children: [X.jsxs(`div`, {
                className: `flex items-center gap-2 overflow-hidden`,
                children: [X.jsx(vn, {
                  size: 16,
                  className: `text-gray-400 flex-shrink-0`
                }), X.jsx(`span`, {
                  className: `text-xs text-gray-300 truncate`,
                  title: s.videoName,
                  children: s.videoName || `已连接视频`
                })]
              }), X.jsx(`button`, {
                onClick: () => c.current?.click(),
                className: `text-xs text-gray-400 hover:text-white flex-shrink-0 ml-2 px-3 py-1.5 bg-[#222] rounded-md hover:bg-[#333] transition-colors`,
                children: `替换视频`
              })]
            }) : X.jsxs(`div`, {
              onClick: () => c.current?.click(),
              className: `w-full py-6 rounded-xl border-2 border-dashed border-[#333] bg-[#111] hover:bg-[#1a1a1a] hover:border-[#555] flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors`,
              children: [X.jsx(`div`, {
                className: `p-3 bg-[#222] rounded-full`,
                children: X.jsx(jn, {
                  size: 18,
                  className: `text-gray-400`
                })
              }), X.jsx(`span`, {
                className: `text-xs text-gray-400 font-medium`,
                children: `点击上传视频或连接节点`
              })]
            }), d && X.jsxs(`div`, {
              className: `flex flex-col gap-4 bg-[#111] border border-[#333] rounded-lg p-4 mt-1`,
              children: [X.jsxs(`div`, {
                className: `flex flex-col gap-2`,
                children: [X.jsx(`label`, {
                  className: `text-[11px] text-gray-400 font-medium`,
                  children: `抽帧模式`
                }), X.jsxs(`select`, {
                  value: p,
                  onChange: e => m(e.target.value),
                  className: `w-full bg-[#222] border border-[#333] rounded-md px-3 py-2 text-xs text-gray-200 outline-none focus:border-white transition-colors`,
                  children: [X.jsx(`option`, {
                    value: `count`,
                    children: `固定数量 (均匀分布)`
                  }), X.jsx(`option`, {
                    value: `interval`,
                    children: `等距抽帧 (间隔秒数)`
                  }), X.jsx(`option`, {
                    value: `smart`,
                    children: `智能转场检测`
                  }), X.jsx(`option`, {
                    value: `first_last`,
                    children: `首尾帧 (第一帧和最后一帧)`
                  }), X.jsx(`option`, {
                    value: `manual`,
                    children: `手动截取 (拖动轨道截取)`
                  })]
                })]
              }), p === `count` && X.jsxs(`div`, {
                className: `flex flex-col gap-2`,
                children: [X.jsx(`label`, {
                  className: `text-[11px] text-gray-400 font-medium`,
                  children: `提取总张数`
                }), X.jsx(`input`, {
                  type: `number`,
                  min: `1`,
                  max: `100`,
                  value: _,
                  onChange: e => v(Number(e.target.value)),
                  className: `w-full bg-[#222] border border-[#333] rounded-md px-3 py-2 text-xs text-gray-200 outline-none focus:border-white transition-colors`
                })]
              }), p === `interval` && X.jsxs(`div`, {
                className: `flex flex-col gap-2`,
                children: [X.jsx(`label`, {
                  className: `text-[11px] text-gray-400 font-medium`,
                  children: `间隔秒数 (秒)`
                }), X.jsx(`input`, {
                  type: `number`,
                  min: `0.5`,
                  max: `3600`,
                  step: `0.5`,
                  value: h,
                  onChange: e => g(Number(e.target.value)),
                  className: `w-full bg-[#222] border border-[#333] rounded-md px-3 py-2 text-xs text-gray-200 outline-none focus:border-white transition-colors`
                })]
              }), p === `smart` && X.jsxs(`div`, {
                className: `flex flex-col gap-2`,
                children: [X.jsxs(`div`, {
                  className: `flex justify-between`,
                  children: [X.jsx(`label`, {
                    className: `text-[11px] text-gray-400 font-medium`,
                    children: `检测敏感度`
                  }), X.jsx(`span`, {
                    className: `text-[11px] text-gray-500`,
                    children: y
                  })]
                }), X.jsx(`input`, {
                  type: `range`,
                  min: `1`,
                  max: `100`,
                  value: y,
                  onChange: e => b(Number(e.target.value)),
                  className: `w-full accent-white`
                }), X.jsx(`span`, {
                  className: `text-[10px] text-gray-500`,
                  children: `数值越高越容易触发截图`
                })]
              })]
            }), X.jsxs(`div`, {
              className: `flex justify-between items-center mt-1`,
              children: [X.jsxs(`button`, {
                className: `px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${d ? `text-white bg-[#333]` : `text-gray-400 hover:bg-[#333] hover:text-white`}`,
                onClick: () => f(!d),
                title: `参数配置`,
                children: [X.jsx(ne, {
                  size: 14
                }), X.jsx(`span`, {
                  className: `text-xs font-medium`,
                  children: d ? `收起配置` : `配置`
                })]
              }), p !== `manual` && X.jsxs(`button`, {
                className: `px-5 py-2 rounded-full text-xs font-medium flex items-center gap-2 transition-all ${!s.videoUrl || s.loading ? `bg-[#2a2a2a] text-gray-500 cursor-not-allowed` : `bg-white text-black hover:bg-gray-200 shadow-md`}`,
                onClick: e => {
                  e.stopPropagation(), s.videoUrl && !s.loading ? N() : s.videoUrl || s.onShowToast?.(`请先上传或连接视频`);
                },
                children: [s.loading ? `正在处理...` : `开始处理`, X.jsx(Ot, {
                  size: 14
                })]
              })]
            })]
          })]
        }), X.jsx(_r, {
          type: `source`,
          position: J.Right,
          id: `main-output`
        })]
      })]
    });
  }),