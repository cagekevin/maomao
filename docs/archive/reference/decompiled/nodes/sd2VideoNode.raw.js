/**
 * 节点类型: sd2VideoNode
 * 原版函数名: Ao
 * 原版行号: L9672-L10749
 * 来源: App-B9jVCs-a.decompiled.js
 *
 * 变量映射（vendor-map.json）:
// _ → tU
// _n → Ru
// _r → Rl
// a → ZK
// b → dT
// bt → Fd
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
// mn → Vu
// mr → Vl
// mt → Vd
// n → Fq
// o → oK
// ot → Jv
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
// yn → Iu
// yr → Il
// z → Rw
 */

  Ao = Y.memo(({
    id: e,
    data: n,
    selected: r
  }) => {
    let {
        updateNodeData: i,
        setEdges: a,
        addNodes: o,
        addEdges: s,
        getNodes: c
      } = Gt(),
      l = n,
      [u, d] = Y.useState(l.prompt || ``),
      [f, p] = Y.useState(l.size || localStorage.getItem(`mutiwindow_sd2video_size`) || `16:9`),
      [m, h] = Y.useState(l.selectedSeconds || localStorage.getItem(`mutiwindow_sd2video_seconds`) || l.videoDurations && l.videoDurations.split(`
`)[0].trim() || `10`),
      [g, _] = Y.useState(l.selectedModel || localStorage.getItem(`mutiwindow_sd2video_model`) || l.sd2VideoModel && l.sd2VideoModel.split(`
`)[0].trim() || ``),
      [v, y] = Y.useState(false),
      [b, x] = Y.useState(false),
      C = Y.useRef(null),
      w = Y.useRef(null),
      [T, E] = Y.useState(false),
      D = Y.useRef(null),
      [O, k] = Y.useState(false),
      A = Y.useRef(null),
      [j, M] = Y.useState(false),
      [N, P] = Y.useState(l.selectedContextResources || []),
      [F, I] = Y.useState(l.internalResources || []),
      {
        uploadedAssets: ee,
        uploadingAssetsRef: R,
        failedAssetsRef: z,
        uploadAsset: B,
        retryAsset: te,
        getAssetStatus: ne,
        clearAllFailedAssets: re
      } = Oo({
        nodeId: e,
        initialUploadedAssets: l.uploadedAssets,
        updateNodeData: i,
        onUploadAsset: l.onUploadAsset,
        onShowToast: l.onShowToast
      });
    Y.useEffect(() => {
      l.selectedContextResources && P(l.selectedContextResources);
    }, [l.selectedContextResources]), Y.useEffect(() => {
      let e = e => {
        D.current && !D.current.contains(e.target) && E(false), A.current && !A.current.contains(e.target) && k(false);
      };
      return (T || O) && document.addEventListener(`mousedown`, e, true), () => {
        document.removeEventListener(`mousedown`, e, true);
      };
    }, [T, O]);
    let [ie, ae] = Y.useState(l.expanded === undefined ? true : l.expanded);
    Y.useEffect(() => {
      l.expanded !== undefined && ae(l.expanded);
    }, [l.expanded]);
    let se = ({
        resId: e,
        resUrl: t,
        resType: n
      }) => {
        let r = ne(e, t);
        return !r.isUploading && !r.isUploaded && !r.isFailed ? null : r.isFailed ? X.jsxs(`div`, {
          className: `absolute inset-0 bg-red-900/70 backdrop-blur-[1px] flex flex-col items-center justify-center cursor-pointer hover:bg-red-900/85 transition-colors group/retry z-10`,
          title: `上传失败,点击重试`,
          onClick: r => {
            r.stopPropagation(), ce({
              id: e,
              url: t,
              type: n
            });
          },
          children: [X.jsx(L, {
            size: 14,
            className: `text-white drop-shadow-md group-hover/retry:rotate-180 transition-transform duration-300`
          }), X.jsx(`span`, {
            className: `text-[8px] text-white mt-0.5 font-medium leading-none`,
            children: `重试`
          })]
        }) : X.jsx(`div`, {
          className: `absolute top-0 left-0 p-0.5 pointer-events-none`,
          children: r.isUploading ? X.jsx(L, {
            size: 12,
            className: `animate-spin drop-shadow-md`,
            style: {
              color: `rgb(210,2,7)`
            }
          }) : r.isUploaded ? X.jsx(ot, {
            size: 12,
            className: `text-green-500 drop-shadow-md`
          }) : null
        });
      },
      ce = async e => {
        await te(e).catch(() => {});
      },
      le = t({
        handleType: `target`
      }),
      ue = ut(Y.useMemo(() => le.map(e => e.source), [le])),
      V = Y.useMemo(() => {
        if (!ue) return {
          images: [],
          videos: [],
          audios: [],
          texts: []
        };
        let e = Array.isArray(ue) ? ue : [ue],
          t = [],
          n = [],
          r = [],
          i = [];
        return e.forEach(e => {
          let a = le.find(t => t.source === e?.id);
          if (e?.data?.imageUrl) {
            let i = e.data.imageUrl;
            i.startsWith(`data:video/`) || /\.(mp4|webm|mov|ogg)($|\?)/i.test(i) ? n.push({
              id: e.id,
              url: i,
              type: `video`
            }) : i.startsWith(`data:audio/`) || /\.(mp3|wav|ogg|aac)($|\?)/i.test(i) ? r.push({
              id: e.id,
              url: i,
              type: `audio`
            }) : t.push({
              id: e.id,
              url: i,
              type: `image`
            });
          }
          if (e?.data?.videoUrl && n.push({
            id: e.id,
            url: e.data.videoUrl,
            type: `video`
          }), e?.data?.audioUrl && r.push({
            id: e.id,
            url: e.data.audioUrl,
            type: `audio`
          }), e?.type === `videoExtractNode` && e?.data?.extractedImages) if (a && a.sourceHandle && a.sourceHandle.startsWith(`frame-`)) {
            let n = parseInt(a.sourceHandle.replace(`frame-`, ``), 10);
            if (!(e.data.hiddenIndices || []).includes(n)) {
              let r = e.data.allExtractedImages;
              r && r[n] && t.push({
                id: `${e.id}-ext-${n}`,
                url: r[n],
                type: `image`
              });
            }
          } else e.data.extractedImages.forEach((n, r) => {
            t.push({
              id: `${e.id}-ext-${r}`,
              url: n,
              type: `image`
            });
          });
          if (e?.type === `imageBoxNode` && Array.isArray(e.data?.images)) {
            let n = e.data.images,
              r = e.data.selectedIds || [];
            if (r.length > 0) {
              let i = new Set(r);
              n.forEach((n, r) => {
                n?.url && i.has(n.id) && t.push({
                  id: `${e.id}-box-${r}`,
                  url: n.url,
                  type: `image`
                });
              });
            } else {
              let r = n[typeof e.data.activeIndex == `number` ? e.data.activeIndex : 0]?.url;
              r && t.push({
                id: `${e.id}-box-active`,
                url: r,
                type: `image`
              });
            }
          }
          let o = new Set([`promptNode`, `imageNode`, `imageBoxNode`, `videoNode`, `sd2VideoNode`, `discountVideoNode`, `gridSplitNode`, `gridMergeNode`, `cropNode`, `urlToImageNode`, `fileToUrlNode`, `panoramaNode`, `videoExtractNode`]);
          e?.data?.text && !o.has(e.type) && i.push({
            id: e.id,
            label: e?.type === `audioNode` ? `听音断句结果` : e.data.label || `文本节点`,
            text: e.data.text
          });
        }), {
          images: t,
          videos: n,
          audios: r,
          texts: i
        };
      }, [ue, le]);
    Y.useEffect(() => {
      l.onUploadAsset && [...N, ...V.images, ...V.videos, ...V.audios].forEach(e => {
        if (!e.url || e.url.startsWith(`asset://`)) return;
        let t = e.url,
          n = e.id;
        ee[t] || R.current[n] || z.current[n] || B({
          id: n,
          url: e.url,
          type: e.type
        }).catch(e => {
          console.error(`Auto upload failed for`, n, e);
        });
      });
    }, [N, V, ee, B, e]), Y.useEffect(() => {
      l.prompt !== undefined && l.prompt !== u && d(l.prompt);
    }, [l.prompt]), Y.useEffect(() => {
      l.size !== undefined && l.size !== f && p(l.size);
    }, [l.size]), Y.useEffect(() => {
      if (l.sd2VideoModel && !g) {
        let t = l.sd2VideoModel.split(`
`)[0].trim();
        _(t), i(e, {
          selectedModel: t
        });
      }
    }, [l.sd2VideoModel, g, e, i]), Y.useEffect(() => {
      l.selectedModel && l.selectedModel !== g && _(l.selectedModel);
    }, [l.selectedModel]), Y.useEffect(() => {
      if (l.videoDurations && !m) {
        let t = l.videoDurations.split(`
`)[0].trim();
        h(t), i(e, {
          selectedSeconds: t
        });
      }
    }, [l.videoDurations, m, e, i]), Y.useEffect(() => {
      l.selectedSeconds && l.selectedSeconds !== m && h(l.selectedSeconds);
    }, [l.selectedSeconds]), Y.useEffect(() => {}, [l.videoUrl, l.loading]);
    let H = () => {
      if (Object.keys(R.current).length > 0) {
        l.onShowToast?.(`素材正在上传处理中，请等待所有对勾出现后再生成`);
        return;
      }
      if (Object.keys(z.current).length > 0) {
        l.onShowToast?.(`有素材上传失败，已为您重新尝试上传，请稍后`), re();
        return;
      }
      if (!u.trim() && V.images.length === 0 && V.texts.length === 0 && N.length === 0) {
        l.onShowToast?.(`请输入提示词或连接参考节点`);
        return;
      }
      l.onGenerateSD2Video?.(e, u, f, g, m);
    };
    return X.jsxs(`div`, {
      className: `relative flex flex-col items-center group/node transition-all w-full h-full min-w-[200px] min-h-[200px] ${r ? `z-50` : `z-10`}`,
      children: [X.jsx(si, {
        id: e,
        data: n,
        defaultTitle: `SD2视频`,
        icon: X.jsx(pe, {
          size: 11,
          className: `text-gray-500`
        })
      }), !l.loading && X.jsx(`div`, {
        className: `absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`,
        children: X.jsxs(`div`, {
          className: `flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`,
          children: [V.images.length === 0 && X.jsx(`button`, {
            className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`,
            title: `上传参考图`,
            onClick: e => {
              e.stopPropagation(), C.current?.click();
            },
            children: X.jsx(jn, {
              size: 14
            })
          }), l.videoUrl && X.jsxs(X.Fragment, {
            children: [X.jsx(`button`, {
              className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`,
              title: `全屏播放`,
              onClick: e => {
                e.stopPropagation(), y(true);
              },
              children: X.jsx(bt, {
                size: 14
              })
            }), X.jsx(`button`, {
              className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`,
              title: `下载`,
              onClick: async e => {
                if (e.stopPropagation(), l.videoUrl) try {
                  if (l.onShowToast?.(`开始下载视频...`), typeof chrome < `u` && chrome.downloads) chrome.downloads.download({
                    url: l.videoUrl,
                    filename: `yimao/video-${Date.now()}.mp4`,
                    saveAs: false
                  });else {
                    let e = await (await fetch(l.videoUrl)).blob(),
                      t = window.URL.createObjectURL(e),
                      n = document.createElement(`a`);
                    n.href = t, n.download = `video-${Date.now()}.mp4`, document.body.appendChild(n), n.click(), window.URL.revokeObjectURL(t), document.body.removeChild(n);
                  }
                } catch (e) {
                  console.error(`Download failed:`, e), l.onShowToast?.(`下载失败，请重试`), window.open(l.videoUrl, `_blank`);
                }
              },
              children: X.jsx(mn, {
                size: 14
              })
            }), l.onDelete && X.jsx(`button`, {
              className: `p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-md`,
              title: `删除`,
              onClick: e => {
                e.stopPropagation(), l.onDelete?.();
              },
              children: X.jsx(S, {
                size: 14
              })
            })]
          })]
        })
      }), X.jsx(ci, {
        visible: !!r,
        minWidth: 200,
        minHeight: 200
      }), X.jsx(`input`, {
        type: `file`,
        ref: C,
        style: {
          display: `none`
        },
        accept: `image/*,video/*,audio/*`,
        onChange: async t => {
          let n = t.target.files?.[0];
          if (!n) return;
          let r = n.type.startsWith(`video`) ? `video` : n.type.startsWith(`audio`) ? `audio` : `image`,
            i = n.name;
          try {
            let t = `node-${Date.now()}`,
              a = c().find(t => t.id === e),
              l = a ? {
                x: a.position.x - 300,
                y: a.position.y
              } : {
                x: 0,
                y: 0
              };
            if (r === `image`) {
              let r = ``,
                a;
              try {
                let e = await ii(n, {
                  subfolder: `canvas/upload`,
                  preferThumbnail: true,
                  thumbMaxDim: 480,
                  thumbQuality: 75
                });
                e.url && /^https?:\/\//i.test(e.url) && (r = e.url, a = e.thumbnailUrl);
              } catch (e) {
                console.warn(`[SD2VideoNode] urlifyAsset failed, fallback to resizeImage:`, e);
              }
              r ||= await yr(n, 2048, .85), o({
                id: t,
                type: `imageNode`,
                position: l,
                data: {
                  imageUrl: r,
                  thumbnailUrl: a,
                  label: i || `图片素材`
                }
              }), s({
                id: `edge-${t}-${e}`,
                source: t,
                target: e
              });
              return;
            }
            let u = ``;
            try {
              let e = await ii(n, {
                subfolder: `canvas/upload`
              });
              e.url && /^https?:\/\//i.test(e.url) && (u = e.url);
            } catch (e) {
              console.warn(`[SD2VideoNode] urlifyAsset failed for media, fallback to base64:`, e);
            }
            let d = n => {
              o(r === `video` ? {
                id: t,
                type: `videoExtractNode`,
                position: l,
                data: {
                  videoUrl: n,
                  videoName: i || `视频素材`
                }
              } : {
                id: t,
                type: `audioNode`,
                position: l,
                data: {
                  audioUrl: n,
                  audioName: i || `音频素材`
                }
              }), s({
                id: `edge-${t}-${e}`,
                source: t,
                target: e
              });
            };
            if (u) d(u);else {
              let e = new FileReader();
              e.onload = e => {
                let t = e.target?.result;
                d(t);
              }, e.readAsDataURL(n);
            }
          } catch (e) {
            console.error(`File upload failed:`, e);
          }
          t.target.value = ``;
        }
      }), X.jsx(`div`, {
        className: `relative bg-[#1c1c1c] rounded-xl border shadow-xl transition-all duration-300 cursor-pointer group/display w-full flex-1 flex flex-col overflow-visible
            ${r ? `border-[#555]` : `border-[#333] hover:border-[#444]`}
        `,
        onClick: () => {
          ae(!ie), i(e, {
            expanded: !ie
          });
        },
        children: X.jsxs(`div`, {
          className: `flex items-center justify-center relative w-full flex-1 rounded-b-xl overflow-hidden ${l.videoUrl ? `` : `bg-[#0d0c0c]`}`,
          children: [l.videoUrl && X.jsxs(X.Fragment, {
            children: [X.jsx(`video`, {
              src: l.videoUrl,
              poster: l.thumbnailUrl,
              className: `max-w-full max-h-[400px] w-full h-full object-contain block ${l.loading ? `opacity-50 blur-sm` : ``}`,
              controls: false,
              autoPlay: false,
              muted: false,
              onDoubleClick: e => {
                e.stopPropagation(), y(true);
              }
            }), !l.loading && X.jsx(`div`, {
              className: `absolute inset-0 flex items-center justify-center pointer-events-none`,
              children: X.jsx(`button`, {
                className: `w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-black/70 transition-all nodrag pointer-events-auto`,
                title: `播放视频`,
                onClick: e => {
                  e.stopPropagation(), y(true);
                },
                children: X.jsx(vn, {
                  className: `text-white w-6 h-6`
                })
              })
            })]
          }), l.loading && X.jsxs(`div`, {
            className: `absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500 z-10 overflow-hidden bg-[#0d0c0c]`,
            children: [(V.images[0] || l.thumbnailUrl) && X.jsx(`div`, {
              className: `absolute inset-0 bg-cover bg-center opacity-30 blur-xl scale-110`,
              style: {
                backgroundImage: `url(${l.thumbnailUrl || V.images[0].url})`
              }
            }), X.jsx(`div`, {
              className: `absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer`,
              style: {
                transform: `skewX(-20deg)`
              }
            }), X.jsxs(`div`, {
              className: `relative z-10 flex flex-col items-center gap-2`,
              children: [X.jsx(ui, {
                size: 32
              }), X.jsx(`span`, {
                className: `text-xs font-mono tracking-wider text-white/80`,
                children: !l.progress || l.progress === 0 ? `生成中...` : `生成中... ${l.progress}%`
              }), X.jsxs(`button`, {
                onClick: t => {
                  t.stopPropagation(), l.onStop?.(e);
                },
                className: `mt-2 bg-[#222]/80 hover:bg-[#333] border border-[#444] text-gray-400 hover:text-gray-200 px-3 py-1 rounded-full text-[10px] flex items-center gap-1.5 transition-colors backdrop-blur-sm`,
                children: [X.jsx(oe, {
                  size: 10,
                  fill: `currentColor`
                }), `停止`]
              })]
            })]
          }), !l.videoUrl && !l.loading && !l.errorMessage && X.jsx(`div`, {
            className: `flex flex-col items-center justify-center absolute inset-0 bg-[#151515] pointer-events-none`,
            children: X.jsx(pe, {
              size: 80,
              className: `text-gray-700`,
              strokeWidth: 1.2
            })
          }), l.errorMessage && !l.loading && X.jsxs(`div`, {
            className: `absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-500 z-10 bg-[#1a1a1a] p-4 text-center`,
            children: [X.jsx(pt, {
              size: 32
            }), X.jsx(`div`, {
              className: `text-xs font-medium max-w-full break-words`,
              children: l.errorMessage
            })]
          })]
        })
      }), X.jsx(_r, {
        type: `target`,
        position: J.Left,
        variant: `large`
      }), X.jsx(_r, {
        type: `source`,
        position: J.Right,
        variant: `large`
      }), (() => {
        let t = X.jsxs(`div`, {
          className: `space-y-3`,
          children: [X.jsxs(`div`, {
            className: `flex flex-col gap-2 mb-2`,
            children: [F.length > 0 && X.jsxs(`div`, {
              className: `flex flex-wrap gap-2 mb-1 p-2 bg-[#1a1a1a] border border-[#333] rounded-lg`,
              children: [X.jsx(`div`, {
                className: `w-full text-[10px] text-gray-500 mb-1`,
                children: `已上传素�?(输入 @ 引用)`
              }), F.map((t, n) => {
                let r = t.type.startsWith(`image`) ? `图片` : t.type.startsWith(`video`) ? `视频` : t.type.startsWith(`audio`) ? `音频` : `素材`;
                return X.jsxs(`div`, {
                  className: `w-10 h-10 rounded-md overflow-hidden border border-[#444] relative group bg-black`,
                  title: t.name || `素材`,
                  children: [X.jsx(`div`, {
                    className: `w-full h-full relative cursor-pointer`,
                    onDoubleClick: e => {
                      if (e.stopPropagation(), t.type.startsWith(`video`) || t.type.startsWith(`audio`)) {
                        let e = document.createElement(t.type.startsWith(`video`) ? `video` : `audio`);
                        e.src = t.url, e.controls = true, e.style.position = `fixed`, e.style.top = `50%`, e.style.left = `50%`, e.style.transform = `translate(-50%, -50%)`, e.style.maxWidth = `90vw`, e.style.maxHeight = `90vh`, e.style.zIndex = `999999`, e.style.boxShadow = `0 0 0 100vmax rgba(0,0,0,0.8)`, document.body.appendChild(e), e.play();
                        let n = t => {
                          t.target !== e && (e.pause(), document.body.removeChild(e), document.removeEventListener(`click`, n));
                        };
                        setTimeout(() => document.addEventListener(`click`, n), 100);
                      }
                    },
                    children: t.type.startsWith(`image`) ? X.jsx(`img`, {
                      src: t.url,
                      alt: `Ref`,
                      loading: `lazy`,
                      decoding: `async`,
                      className: `w-full h-full object-cover`
                    }) : t.type.startsWith(`video`) ? X.jsx(`div`, {
                      className: `w-full h-full bg-[#222] flex items-center justify-center p-1`,
                      children: X.jsx(_n, {
                        size: 16,
                        className: `text-purple-400`
                      })
                    }) : X.jsx(`div`, {
                      className: `w-full h-full bg-[#222] flex items-center justify-center p-1`,
                      children: X.jsx(Zt, {
                        size: 16,
                        className: `text-yellow-500`
                      })
                    })
                  }), X.jsx(se, {
                    resId: t.id,
                    resUrl: t.url,
                    resType: t.type
                  }), X.jsxs(`div`, {
                    className: `absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-white text-center py-0.5 truncate pointer-events-none`,
                    children: [r, t.type.startsWith(`image`) ? F.filter(e => e.type.startsWith(`image`)).findIndex(e => e.id === t.id) + 1 : t.type.startsWith(`video`) ? F.filter(e => e.type.startsWith(`video`)).findIndex(e => e.id === t.id) + 1 : t.type.startsWith(`audio`) ? F.filter(e => e.type.startsWith(`audio`)).findIndex(e => e.id === t.id) + 1 : n + 1]
                  }), X.jsx(`div`, {
                    className: `absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`,
                    onClick: t => {
                      t.stopPropagation();
                      let r = F.filter((e, t) => t !== n);
                      I(r), i(e, {
                        internalResources: r
                      });
                    },
                    children: X.jsx(yn, {
                      size: 10,
                      className: `text-white`
                    })
                  })]
                }, `internal-${n}`);
              })]
            }), (V.images.length > 0 || V.videos.length > 0 || V.audios.length > 0 || V.texts.length > 0 || N.length > 0) && X.jsxs(`div`, {
              className: `flex flex-wrap gap-2 mb-1`,
              children: [V.images.map((t, n) => X.jsxs(`div`, {
                className: `w-10 h-10 rounded-md overflow-hidden border border-[#444] relative group bg-black`,
                title: `连线图片`,
                children: [X.jsx(`img`, {
                  src: t.url,
                  alt: `Ref`,
                  loading: `lazy`,
                  decoding: `async`,
                  className: `w-full h-full object-cover`
                }), X.jsx(se, {
                  resId: t.id,
                  resUrl: t.url,
                  resType: `image`
                }), X.jsxs(`div`, {
                  className: `absolute bottom-0 left-0 right-0 bg-blue-500/80 text-[8px] text-white text-center py-0.5 truncate pointer-events-none`,
                  children: [`图片`, n + 1]
                }), X.jsx(`div`, {
                  className: `absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`,
                  onClick: n => {
                    n.stopPropagation(), a(n => n.filter(n => !(n.target === e && n.source === t.id)));
                  },
                  children: X.jsx(yn, {
                    size: 10,
                    className: `text-white`
                  })
                })]
              }, `img-${n}`)), V.videos?.map((t, n) => X.jsxs(`div`, {
                className: `w-10 h-10 rounded-md overflow-hidden border border-[#444] relative group bg-black`,
                title: `连线视频`,
                children: [X.jsx(`video`, {
                  src: t.url,
                  className: `w-full h-full object-cover cursor-pointer`,
                  muted: true,
                  playsInline: true,
                  preload: `metadata`,
                  onDoubleClick: e => {
                    e.stopPropagation();
                    let n = document.createElement(`video`);
                    n.src = t.url, n.controls = true, n.style.position = `fixed`, n.style.top = `50%`, n.style.left = `50%`, n.style.transform = `translate(-50%, -50%)`, n.style.maxWidth = `90vw`, n.style.maxHeight = `90vh`, n.style.zIndex = `999999`, n.style.backgroundColor = `black`, n.style.boxShadow = `0 25px 50px -12px rgba(0, 0, 0, 0.5)`, n.style.borderRadius = `12px`;
                    let r = document.createElement(`div`);
                    r.style.position = `fixed`, r.style.inset = `0`, r.style.backgroundColor = `rgba(0,0,0,0.9)`, r.style.zIndex = `999998`, r.style.backdropFilter = `blur(4px)`, r.onclick = () => {
                      document.body.contains(n) && document.body.removeChild(n), document.body.contains(r) && document.body.removeChild(r);
                    }, document.body.appendChild(r), document.body.appendChild(n), n.play().catch(() => {});
                  }
                }), X.jsxs(`div`, {
                  className: `absolute inset-0 bg-red-900/70 backdrop-blur-[1px] flex flex-col items-center justify-center cursor-pointer hover:bg-red-900/85 transition-colors group/retry z-10`,
                  title: `上传失败,点击重试`,
                  onClick: e => {
                    e.stopPropagation(), ce({
                      id: t.id,
                      url: t.url,
                      type: `video`
                    });
                  },
                  children: [X.jsx(L, {
                    size: 14,
                    className: `text-white drop-shadow-md group-hover/retry:rotate-180 transition-transform duration-300`
                  }), X.jsx(`span`, {
                    className: `text-[8px] text-white mt-0.5 font-medium leading-none`,
                    children: `重试`
                  })]
                }), X.jsx(`div`, {
                  className: `absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`,
                  onClick: n => {
                    n.stopPropagation(), a(n => n.filter(n => !(n.target === e && n.source === t.id)));
                  },
                  children: X.jsx(yn, {
                    size: 10,
                    className: `text-white`
                  })
                })]
              }, `vid-${n}`)), V.audios?.map((t, n) => X.jsxs(`div`, {
                className: `w-10 h-10 rounded-md overflow-hidden border border-[#444] relative group bg-black`,
                title: `连线音频`,
                children: [X.jsx(`div`, {
                  className: `w-full h-full bg-[#222] flex items-center justify-center p-1`,
                  children: X.jsx(Zt, {
                    size: 16,
                    className: `text-yellow-500`
                  })
                }), X.jsx(se, {
                  resId: t.id,
                  resUrl: t.url,
                  resType: `audio`
                }), X.jsxs(`div`, {
                  className: `absolute bottom-0 left-0 right-0 bg-blue-500/80 text-[8px] text-white text-center py-0.5 truncate pointer-events-none`,
                  children: [`音频`, n + 1]
                }), X.jsx(`div`, {
                  className: `absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`,
                  onClick: n => {
                    n.stopPropagation(), a(n => n.filter(n => !(n.target === e && n.source === t.id)));
                  },
                  children: X.jsx(yn, {
                    size: 10,
                    className: `text-white`
                  })
                })]
              }, `aud-${n}`)), N.filter(e => {
                let t = V.images.some(t => t.id === e.id),
                  n = V.videos?.some(t => t.id === e.id),
                  r = V.audios?.some(t => t.id === e.id),
                  i = [...V.images, ...(V.videos || []), ...(V.audios || [])].some(t => t.id === e.id);
                return !t && !n && !r && i;
              }).map((t, n) => {
                let r = ``;
                return r = t.type.startsWith(`image`) ? `图片${V.images.findIndex(e => e.id === t.id) + 1}` : t.type.startsWith(`video`) ? `视频${V.videos.findIndex(e => e.id === t.id) + 1}` : t.type.startsWith(`audio`) ? `音频${V.audios.findIndex(e => e.id === t.id) + 1}` : `素材${n + 1}`, X.jsxs(`div`, {
                  className: `w-10 h-10 rounded-md overflow-hidden border border-pink-500/50 relative group bg-black`,
                  title: `通过 @ 选中的素材`,
                  children: [X.jsx(`div`, {
                    className: `w-full h-full relative cursor-pointer`,
                    onDoubleClick: e => {
                      if (e.stopPropagation(), t.type.startsWith(`video`) || t.type.startsWith(`audio`)) {
                        let e = document.createElement(t.type.startsWith(`video`) ? `video` : `audio`);
                        e.src = t.url, e.controls = true, e.style.position = `fixed`, e.style.top = `50%`, e.style.left = `50%`, e.style.transform = `translate(-50%, -50%)`, e.style.maxWidth = `90vw`, e.style.maxHeight = `90vh`, e.style.zIndex = `999999`, e.style.boxShadow = `0 0 0 100vmax rgba(0,0,0,0.8)`, document.body.appendChild(e), e.play();
                        let n = t => {
                          t.target !== e && (e.pause(), document.body.removeChild(e), document.removeEventListener(`click`, n));
                        };
                        setTimeout(() => document.addEventListener(`click`, n), 100);
                      }
                    },
                    children: t.type.startsWith(`image`) ? X.jsx(`img`, {
                      src: t.url,
                      loading: `lazy`,
                      decoding: `async`,
                      className: `w-full h-full object-cover opacity-80`
                    }) : t.type.startsWith(`video`) ? X.jsx(`div`, {
                      className: `w-full h-full bg-[#222] flex items-center justify-center p-1`,
                      children: X.jsx(_n, {
                        size: 16,
                        className: `text-purple-400 opacity-80`
                      })
                    }) : X.jsx(`div`, {
                      className: `w-full h-full bg-[#222] flex items-center justify-center p-1`,
                      children: X.jsx(Zt, {
                        size: 16,
                        className: `text-yellow-500 opacity-80`
                      })
                    })
                  }), X.jsx(se, {
                    resId: t.id,
                    resUrl: t.url,
                    resType: t.type
                  }), X.jsx(`div`, {
                    className: `absolute inset-0 bg-pink-500/10 pointer-events-none`
                  }), X.jsx(`div`, {
                    className: `absolute bottom-0 left-0 right-0 bg-pink-500/80 text-[8px] text-white text-center py-0.5 truncate pointer-events-none`,
                    children: r
                  }), X.jsx(`div`, {
                    className: `absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`,
                    onClick: t => {
                      t.stopPropagation();
                      let r = N.filter((e, t) => t !== n);
                      P(r), i(e, {
                        selectedContextResources: r
                      });
                    },
                    children: X.jsx(yn, {
                      size: 10,
                      className: `text-white`
                    })
                  })]
                }, `ctx-${n}`);
              }), V.texts.map((e, t) => X.jsxs(`div`, {
                className: `h-8 px-2 bg-[#2a2a2a] border border-[#444] rounded flex items-center gap-1 text-[10px] text-gray-300 hover:bg-[#333] hover:border-blue-500 hover:text-blue-400 transition-colors cursor-help group/text`,
                title: e.text,
                children: [X.jsx(Dn, {
                  size: 10
                }), X.jsx(`span`, {
                  className: `max-w-[80px] truncate`,
                  children: e.label
                })]
              }, `txt-${t}`))]
            }), X.jsx(`div`, {
              className: `flex items-start gap-2`,
              children: X.jsxs(`div`, {
                className: `flex-1 nodrag relative`,
                children: [X.jsx(gi, {
                  ref: w,
                  className: `w-full bg-transparent text-[15px] text-gray-200 outline-none leading-relaxed placeholder-gray-600 font-sans custom-scrollbar nowheel nopan nodrag`,
                  style: {
                    width: n.inputWidth ? `${n.inputWidth}px` : undefined,
                    height: n.inputHeight ? `${n.inputHeight}px` : `80px`,
                    minHeight: `80px`,
                    overflow: `auto`
                  },
                  placeholder: `描述你想要的视频内容 (输入 @ 调出素材)...`,
                  value: u,
                  onChange: t => {
                    if (d(t), i(e, {
                      prompt: t
                    }), t.endsWith(`@`) ? M(true) : t.includes(`@`) || M(false), !n.inputHeight || n.inputHeight <= 200) {
                      let t = w.current;
                      requestAnimationFrame(() => {
                        if (t) {
                          t.style.height = `auto`;
                          let n = Math.max(80, Math.min(t.scrollHeight, 200));
                          t.style.height = n + `px`, i(e, {
                            inputHeight: n
                          });
                        }
                      });
                    }
                  },
                  onKeyDown: e => {
                    e.key === `Enter` && (e.ctrlKey || e.metaKey) && H();
                  },
                  autoFocus: ie,
                  onWheel: e => e.stopPropagation()
                }), j && X.jsxs(`div`, {
                  className: `absolute bottom-full left-0 mb-1 w-72 bg-[#222] border border-[#444] rounded-lg shadow-2xl z-[100] flex flex-col overflow-hidden h-[300px] nopan`,
                  onWheel: e => e.stopPropagation(),
                  onClick: e => e.stopPropagation(),
                  children: [X.jsxs(`div`, {
                    className: `flex items-center justify-between p-2 border-b border-[#333] bg-[#1a1a1a]`,
                    children: [X.jsx(`div`, {
                      className: `text-xs text-gray-300 font-bold flex items-center gap-2`,
                      children: X.jsx(`span`, {
                        children: `选择素材引用`
                      })
                    }), X.jsx(`button`, {
                      onClick: () => M(false),
                      className: `text-gray-500 hover:text-white p-1`,
                      children: X.jsx(yn, {
                        size: 12
                      })
                    })]
                  }), X.jsx(`div`, {
                    className: `p-2 flex-1 overflow-y-auto custom-scrollbar nowheel nopan nodrag`,
                    children: (() => {
                      let t = [...V.images.map(e => ({
                        id: e.id,
                        url: e.url,
                        type: `image`
                      })), ...V.videos.map(e => ({
                        id: e.id,
                        url: e.url,
                        type: `video`
                      })), ...V.audios.map(e => ({
                        id: e.id,
                        url: e.url,
                        type: `audio`
                      }))];
                      return t.length === 0 ? X.jsx(`div`, {
                        className: `text-center text-gray-500 text-xs py-10`,
                        children: `暂无素材，请先上传`
                      }) : X.jsx(`div`, {
                        className: `grid grid-cols-4 gap-1.5`,
                        children: t.map(t => X.jsxs(`div`, {
                          className: `aspect-square bg-[#111] rounded border border-[#333] hover:border-blue-500 cursor-pointer overflow-hidden relative group`,
                          onClick: () => {
                            let n = u.lastIndexOf(`@`),
                              r = n >= 0 ? u.substring(0, n) + u.substring(n + 1) : u,
                              a = ``;
                            a = t.type.startsWith(`image`) ? `图片${V.images.findIndex(e => e.id === t.id) + 1}` : t.type.startsWith(`video`) ? `视频${V.videos.findIndex(e => e.id === t.id) + 1}` : t.type.startsWith(`audio`) ? `音频${V.audios.findIndex(e => e.id === t.id) + 1}` : `素材1`;
                            let o = r + `@${a} `;
                            d(o), i(e, {
                              prompt: o
                            }), M(false);
                          },
                          children: [t.type.startsWith(`image`) ? X.jsx(`img`, {
                            src: t.url,
                            loading: `lazy`,
                            decoding: `async`,
                            className: `w-full h-full object-cover`
                          }) : t.type.startsWith(`video`) ? X.jsx(`video`, {
                            src: t.url,
                            preload: `metadata`,
                            className: `w-full h-full object-cover`
                          }) : t.type.startsWith(`audio`) ? X.jsx(`div`, {
                            className: `w-full h-full bg-[#222] flex items-center justify-center p-1`,
                            children: X.jsx(`span`, {
                              className: `text-[10px] text-gray-400`,
                              children: `音频`
                            })
                          }) : X.jsx(`div`, {
                            className: `p-1 text-[8px] text-gray-400 break-all overflow-hidden h-full`,
                            children: t.url
                          }), X.jsx(`div`, {
                            className: `absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity`,
                            children: X.jsx(`span`, {
                              className: `text-[10px] text-white`,
                              children: `选择`
                            })
                          })]
                        }, t.id))
                      });
                    })()
                  })]
                })]
              })
            })]
          }), X.jsxs(`div`, {
            className: `flex items-center justify-between pt-2 border-t border-[#2a2a2a] nodrag`,
            children: [X.jsxs(`div`, {
              className: `flex items-center gap-1.5 overflow-visible z-50`,
              children: [X.jsxs(`div`, {
                className: `relative nodrag flex items-center`,
                ref: A,
                children: [X.jsxs(`button`, {
                  className: `flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer max-w-[120px]`,
                  onClick: e => {
                    e.stopPropagation(), k(!O);
                  },
                  title: `选择比例和时长`,
                  children: [X.jsx(oe, {
                    size: 12,
                    className: `opacity-70`
                  }), X.jsxs(`span`, {
                    className: `truncate`,
                    children: [ko.find(e => e.value === f)?.label || f || `16:9`, ` · `, m, `s`]
                  })]
                }), O && X.jsxs(`div`, {
                  className: `absolute bottom-full left-0 mb-1 w-48 bg-[#222] border border-[#333] rounded-lg shadow-xl p-3 z-50 flex flex-col gap-3 max-h-64 overflow-y-auto custom-scrollbar nowheel nopan nodrag`,
                  onClick: e => e.stopPropagation(),
                  children: [X.jsxs(`div`, {
                    children: [X.jsx(`div`, {
                      className: `text-[10px] text-gray-500 mb-2 px-1`,
                      children: `比例 / 分辨率`
                    }), X.jsx(`div`, {
                      className: `mb-2`,
                      children: X.jsx(`input`, {
                        type: `text`,
                        value: f,
                        onChange: t => {
                          p(t.target.value), i(e, {
                            size: t.target.value
                          }), localStorage.setItem(`mutiwindow_sd2video_size`, t.target.value);
                        },
                        placeholder: `自定义分辨率如 1280x720`,
                        className: `w-full bg-[#1c1c1c] border border-[#333] rounded px-2 py-1.5 text-[11px] text-gray-200 outline-none focus:border-blue-500 transition-colors`
                      })
                    }), X.jsx(`div`, {
                      className: `flex flex-wrap gap-1.5`,
                      children: ko.map(t => X.jsx(`button`, {
                        className: `px-3 py-1.5 text-[11px] rounded-md transition-colors ${f === t.value ? `bg-[#444] text-white` : `bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`,
                        onClick: () => {
                          p(t.value), i(e, {
                            size: t.value
                          }), localStorage.setItem(`mutiwindow_sd2video_size`, t.value);
                        },
                        children: t.label
                      }, t.value))
                    })]
                  }), l.videoDurations && X.jsxs(`div`, {
                    children: [X.jsx(`div`, {
                      className: `text-[10px] text-gray-500 mb-2 px-1`,
                      children: `时长 (�?`
                    }), X.jsx(`div`, {
                      className: `flex flex-wrap gap-1.5`,
                      children: l.videoDurations.split(`
`).map(e => e.trim()).filter(e => e !== ``).map((t, n) => X.jsxs(`button`, {
                        className: `px-3 py-1.5 text-[11px] rounded-md transition-colors ${m === t ? `bg-[#444] text-white` : `bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`,
                        onClick: () => {
                          h(t), i(e, {
                            selectedSeconds: t
                          }), localStorage.setItem(`mutiwindow_sd2video_seconds`, t);
                        },
                        children: [t, `s`]
                      }, n))
                    })]
                  })]
                })]
              }), !!(l.sd2VideoModel && l.sd2VideoModel.split(`
`).filter(e => e.trim() !== ``).length > 0) && X.jsxs(`div`, {
                className: `relative nodrag flex items-center`,
                ref: D,
                children: [X.jsx(`div`, {
                  className: `w-[1px] h-3 bg-[#444] mr-1.5`
                }), X.jsx(`button`, {
                  className: `flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer max-w-[100px]`,
                  onClick: e => {
                    e.stopPropagation(), E(!T);
                  },
                  title: `选择模型`,
                  children: X.jsx(`span`, {
                    className: `truncate`,
                    children: g || `选择模型`
                  })
                }), T && X.jsxs(`div`, {
                  className: `absolute bottom-full left-0 mb-1 w-48 bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 block max-h-48 overflow-y-auto custom-scrollbar nowheel nopan nodrag`,
                  onClick: e => e.stopPropagation(),
                  children: [X.jsx(`div`, {
                    className: `text-[10px] text-gray-500 mb-2 px-1`,
                    children: `模型`
                  }), l.sd2VideoModel.split(`
`).map(e => e.trim()).filter(e => e !== ``).map((t, n) => {
                    let r = ea(t, g === t);
                    return X.jsx(`button`, {
                      className: r.className,
                      disabled: r.disabled,
                      onClick: () => {
                        r.disabled || (_(t), i(e, {
                          selectedModel: t
                        }), localStorage.setItem(`mutiwindow_sd2video_model`, t), E(false));
                      },
                      title: r.title,
                      children: t
                    }, n);
                  })]
                })]
              }), X.jsx(Ja, {
                category: `video`,
                presetPrompts: l.presetPrompts || [],
                onApply: t => {
                  let n = u ? `${u}, ${t}` : t;
                  d(n), i(e, {
                    prompt: n
                  });
                },
                onToast: e => l.onShowToast?.(e)
              })]
            }), X.jsx(`div`, {
              className: `flex items-center gap-3 flex-shrink-0 ml-2`,
              children: l.loading ? X.jsxs(`div`, {
                className: `flex items-center gap-1.5`,
                children: [X.jsxs(`button`, {
                  className: `flex items-center gap-1 text-gray-400 hover:text-white bg-[#222] hover:bg-[#333] border border-[#333] hover:border-gray-500 rounded-full px-2.5 py-1 transition-colors`,
                  onClick: t => {
                    t.stopPropagation(), l.onRefresh?.(e);
                  },
                  title: `刷新状态`,
                  children: [X.jsx(L, {
                    size: 12
                  }), X.jsx(`span`, {
                    className: `text-[10px]`,
                    children: `刷新`
                  })]
                }), X.jsxs(`div`, {
                  className: `flex items-center bg-red-500/10 rounded-full p-1 pl-3 border border-red-500/30 hover:border-red-500/50 transition-colors cursor-pointer group/btn`,
                  onClick: t => {
                    t.stopPropagation(), l.onStop?.(e);
                  },
                  children: [X.jsx(`div`, {
                    className: `flex items-center gap-1 mr-3 text-xs text-red-400 group-hover/btn:text-red-300`,
                    children: `停止`
                  }), X.jsx(`button`, {
                    className: `bg-red-500/20 text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-500/30 transition-colors`,
                    children: X.jsx(oe, {
                      size: 10,
                      fill: `currentColor`
                    })
                  })]
                })]
              }) : X.jsxs(`div`, {
                className: `flex items-center bg-[#2a2a2a] rounded-full p-1 pl-3 border border-[#333] hover:border-gray-500 transition-colors cursor-pointer group/btn`,
                onClick: e => {
                  e.stopPropagation(), H();
                },
                children: [X.jsx(`div`, {
                  className: `flex items-center gap-1 mr-3 text-xs text-gray-300 group-hover/btn:text-white`,
                  children: `生成`
                }), X.jsx(`button`, {
                  className: `bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors`,
                  children: X.jsx(En, {
                    size: 14,
                    strokeWidth: 3
                  })
                })]
              })
            })]
          })]
        });
        return X.jsxs(X.Fragment, {
          children: [X.jsxs(`div`, {
            className: `absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[#1c1c1c] rounded-2xl border border-[#333] shadow-2xl w-[500px] transition-all duration-300 origin-top z-50
                ${ie ? `opacity-100 scale-100 p-4 overflow-visible` : `opacity-0 scale-95 pointer-events-none h-0 p-0 border-0 overflow-hidden`}
              `,
            onClick: e => e.stopPropagation(),
            children: [!b && t, ie && !b && X.jsx(_i, {
              targetRef: w,
              onRequestFullscreen: () => x(true),
              onResizeEnd: (t, n) => i(e, {
                inputWidth: t,
                inputHeight: n
              })
            })]
          }), X.jsx(vi, {
            open: b,
            title: `编辑提示词 - 特惠视频`,
            onClose: () => x(false),
            children: t
          })]
        });
      })(), v && l.videoUrl && Un.createPortal(X.jsxs(`div`, {
        className: `fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md`,
        onClick: () => y(false),
        children: [X.jsx(`button`, {
          className: `absolute top-6 right-6 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-50`,
          onClick: () => y(false),
          children: X.jsx(yn, {
            size: 32
          })
        }), X.jsx(`video`, {
          src: l.videoUrl,
          className: `max-w-[95vw] max-h-[95vh] object-contain shadow-2xl rounded-lg outline-none`,
          controls: true,
          autoPlay: true,
          onClick: e => e.stopPropagation(),
          onDoubleClick: e => {
            e.stopPropagation(), y(true);
          }
        })]
      }), document.body)]
    });
  }),