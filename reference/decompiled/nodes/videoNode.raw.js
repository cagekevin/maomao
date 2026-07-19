/**
 * 节点类型: videoNode
 * 原版函数名: Do
 * 原版行号: L8617-L9589
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
// p → VW
// pr → Hl
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
// z → Rw
 */

  Do = Y.memo(({
    id: e,
    data: n,
    selected: r,
    width: i
  }) => {
    let {
        updateNodeData: a,
        setEdges: o,
        setNodes: s,
        getNode: c
      } = Gt(),
      l = n,
      {
        useThumbnail: u
      } = pr(),
      d = oi(i ?? 420),
      [f, p] = Y.useState(l.prompt || ``),
      [m, h] = Y.useState(() => {
        let e = localStorage.getItem(`mutiwindow_video_aspectRatio`),
          t = l.aspectRatio || e || l.size || `16:9`;
        return t.includes(`x`) ? `custom` : t;
      }),
      [g, _] = Y.useState((l.aspectRatio, `16:9`)),
      [v, y] = Y.useState(() => l.customSize ? l.customSize : l.size || `1280x720`),
      b = Y.useMemo(() => {
        if (m === `custom`) return v;
        let e = Eo.find(e => e.value === m);
        return e ? e.defaultSize : `1280x720`;
      }, [m, v]),
      x = Y.useMemo(() => m === `custom` ? g : m, [m, g]),
      [C, w] = Y.useState(l.selectedSeconds || l.videoDurations && l.videoDurations.split(`
`)[0].trim() || `10`),
      [T, E] = Y.useState(l.selectedModel || l.videoModel && l.videoModel.split(`
`)[0].trim() || ``),
      [D, O] = Y.useState(false),
      [k, A] = Y.useState(false),
      j = Y.useRef(null),
      M = Y.useRef(null),
      [N, P] = Y.useState(false),
      F = Y.useRef(null),
      [I, L] = Y.useState(false),
      ee = Y.useRef(null),
      [R, z] = Y.useState(false),
      B = Y.useRef(null);
    Y.useEffect(() => {
      (async () => {
        if (!l.aspectRatio && !l.size) {
          let e = await Q.getConfig(Z.VIDEO_SIZE);
          e && h(e);
        }
        if (!l.selectedSeconds) {
          let e = await Q.getConfig(Z.VIDEO_SECONDS);
          e && w(e);
        }
        if (!l.selectedModel) {
          let e = await Q.getConfig(Z.VIDEO_MODEL);
          e && E(e);
        }
      })();
    }, [l.size, l.selectedSeconds, l.selectedModel]);
    let te = Y.useRef(null);
    Y.useEffect(() => {
      let t = l.videoUrl;
      if (!t || l.imageAvailable || l.loading || !t.includes(`/files/`) || te.current === t) return;
      te.current = t;
      let n = false;
      return (async () => {
        let r = await ai(t);
        !n && r && a(e, {
          imageAvailable: true
        });
      })(), () => {
        n = true;
      };
    }, [e, l.videoUrl, l.imageAvailable, l.loading, a]);
    let [ne, re] = Y.useState(false),
      [ie, ae] = Y.useState([]),
      [se, ce] = Y.useState(l.selectedContextResources || []),
      [le, ue] = Y.useState(l.apiFormat || `auto`);
    Y.useEffect(() => {
      l.selectedContextResources && ce(l.selectedContextResources);
    }, [l.selectedContextResources]), Y.useEffect(() => {
      ne && Q.getObject(Z.TRANSIT_RESOURCES).then(e => {
        e && Array.isArray(e) && e.length > 0 && ae(e);
      }).catch(e => {
        console.error(`Failed to fetch transitResources from storage`, e);
      });
    }, [ne]), Y.useEffect(() => {
      let e = e => {
        F.current && !F.current.contains(e.target) && P(false), ee.current && !ee.current.contains(e.target) && L(false), B.current && !B.current.contains(e.target) && z(false);
      };
      return (N || I || R) && document.addEventListener(`mousedown`, e, true), () => {
        document.removeEventListener(`mousedown`, e, true);
      };
    }, [N, I, R]);
    let [V, H] = Y.useState(l.expanded === undefined ? true : l.expanded);
    Y.useEffect(() => {
      l.expanded !== undefined && H(l.expanded);
    }, [l.expanded]);
    let U = t({
        handleType: `target`
      }),
      de = ut(Y.useMemo(() => U.map(e => e.source), [U])),
      W = (() => {
        if (!de) return {
          images: [],
          texts: []
        };
        let e = Array.isArray(de) ? de : [de],
          t = [],
          n = [];
        return e.forEach(e => {
          let r = U.find(t => t.source === e?.id);
          if (e?.data?.imageUrl && t.push({
            id: e.id,
            url: e.data.imageUrl
          }), e?.type === `videoExtractNode` && e?.data?.extractedImages) if (r && r.sourceHandle && r.sourceHandle.startsWith(`frame-`)) {
            let n = parseInt(r.sourceHandle.replace(`frame-`, ``), 10);
            if (!(e.data.hiddenIndices || []).includes(n)) {
              let r = e.data.allExtractedImages;
              r && r[n] && t.push({
                id: `${e.id}-ext-${n}`,
                url: r[n]
              });
            }
          } else e.data.extractedImages.forEach((n, r) => {
            t.push({
              id: `${e.id}-ext-${r}`,
              url: n
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
                  url: n.url
                });
              });
            } else {
              let r = n[typeof e.data.activeIndex == `number` ? e.data.activeIndex : 0]?.url;
              r && t.push({
                id: `${e.id}-box-active`,
                url: r
              });
            }
          }
          let i = new Set([`promptNode`, `imageNode`, `imageBoxNode`, `videoNode`, `sd2VideoNode`, `discountVideoNode`, `gridSplitNode`, `gridMergeNode`, `cropNode`, `urlToImageNode`, `fileToUrlNode`, `panoramaNode`, `videoExtractNode`]);
          e?.data?.text && !i.has(e.type) && n.push({
            id: e.id,
            label: e?.type === `audioNode` ? `听音断句结果` : e.data.label || `文本节点`,
            text: e.data.text
          });
        }), {
          images: t,
          texts: n
        };
      })();
    Y.useEffect(() => {
      l.prompt !== undefined && l.prompt !== f && p(l.prompt);
    }, [l.prompt]), Y.useEffect(() => {
      l.aspectRatio !== undefined && l.aspectRatio !== m && h(l.aspectRatio);
    }, [l.aspectRatio]), Y.useEffect(() => {
      l.customSize !== undefined && l.customSize !== v && y(l.customSize);
    }, [l.customSize]), Y.useEffect(() => {
      if (l.videoModel && !T) {
        let t = l.videoModel.split(`
`)[0].trim();
        E(t), a(e, {
          selectedModel: t
        });
      }
    }, [l.videoModel, T, e, a]), Y.useEffect(() => {
      l.selectedModel && l.selectedModel !== T && E(l.selectedModel);
    }, [l.selectedModel]), Y.useEffect(() => {
      if (l.videoDurations && !C) {
        let t = l.videoDurations.split(`
`)[0].trim();
        w(t), a(e, {
          selectedSeconds: t
        });
      }
    }, [l.videoDurations, C, e, a]), Y.useEffect(() => {
      l.selectedSeconds && l.selectedSeconds !== C && w(l.selectedSeconds);
    }, [l.selectedSeconds]), Y.useEffect(() => {}, [l.videoUrl, l.loading]);
    let fe = () => {
        if (!f.trim() && W.images.length === 0 && W.texts.length === 0) {
          l.onShowToast?.(`请输入提示词或连接参考节点`);
          return;
        }
        l.onGenerateVideo?.(e, f, x, b, T, C, le);
      },
      pe = async e => {
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
      me = async t => {
        let n = t.target.files?.[0];
        if (!n) return;
        t.target.value = ``;
        try {
          let t = await ii(n, {
            subfolder: `canvas/upload`,
            preferThumbnail: true,
            thumbMaxDim: 480,
            thumbQuality: 75
          });
          if (t.url && /^https?:\/\//i.test(t.url) && l.onAddImage) {
            l.onAddImage(e, t.url);
            return;
          }
        } catch (e) {
          console.warn(`[VideoNode] urlifyAsset failed, fallback to base64:`, e);
        }
        let r = new FileReader();
        r.onload = t => {
          let n = t.target?.result;
          l.onAddImage && l.onAddImage(e, n);
        }, r.readAsDataURL(n);
      },
      G = (e => {
        if (!e) return null;
        let t = e.match(/^(\d+(?:\.\d+)?)\s*[:：]\s*(\d+(?:\.\d+)?)$/);
        if (!t) return null;
        let n = parseFloat(t[1]),
          r = parseFloat(t[2]);
        return !n || !r ? null : n / r;
      })(x),
      he = G !== null,
      ge = he && G ? Math.round(360 * Math.sqrt(G)) : null,
      _e = he && G ? Math.round(360 / Math.sqrt(G)) : null,
      K = Y.useRef(_e),
      ve = Y.useRef(null),
      [ye, be] = Y.useState(null);
    Y.useEffect(() => {
      let t = K.current;
      if (K.current = _e, ve.current !== null && (cancelAnimationFrame(ve.current), ve.current = null), ge === null || _e === null) {
        be(null), s(t => t.map(t => {
          if (t.id !== e || t.style?.height !== undefined) return t;
          let n = 420 - (t.style?.width ?? t.width ?? 360);
          return {
            ...t,
            width: 420,
            height: 420,
            style: {
              ...t.style,
              width: 420,
              height: 420
            },
            position: {
              x: t.position.x - n / 2,
              y: t.position.y
            }
          };
        }));
        return;
      }
      let n = c(e),
        r = n?.style?.width ?? n?.width ?? 360,
        i = n?.position.x ?? 0,
        a = n?.position.y ?? 0,
        o = t ?? _e,
        l = ge,
        u = _e;
      if (t === null || Math.round(r) === l && Math.round(o) === u) {
        be(null), s(t => t.map(t => {
          if (t.id !== e) return t;
          let n = t.style?.width ?? t.width ?? 360;
          if (Math.round(n) === l && t.style?.height === undefined) return t;
          let r = l - n,
            i = {
              ...t.style,
              width: l
            };
          return delete i.height, {
            ...t,
            width: l,
            height: undefined,
            style: i,
            position: {
              x: t.position.x - r / 2,
              y: t.position.y
            }
          };
        }));
        return;
      }
      let d = e => 1 - (1 - e) ** 3,
        f = a + o,
        p = i + r / 2,
        m = performance.now(),
        h = t => {
          let n = Math.min(1, (t - m) / 360),
            i = d(n),
            a = r + (l - r) * i,
            c = o + (u - o) * i;
          be(c), s(t => t.map(t => {
            if (t.id !== e) return t;
            let n = {
              ...t.style,
              width: a
            };
            return delete n.height, {
              ...t,
              width: a,
              height: undefined,
              style: n,
              position: {
                x: p - a / 2,
                y: f - c
              }
            };
          })), n < 1 ? ve.current = requestAnimationFrame(h) : (ve.current = null, be(null), s(t => t.map(t => {
            if (t.id !== e) return t;
            let n = {
              ...t.style,
              width: l
            };
            return delete n.height, {
              ...t,
              width: l,
              height: undefined,
              style: n,
              position: {
                x: p - l / 2,
                y: f - u
              }
            };
          })));
        };
      return ve.current = requestAnimationFrame(h), () => {
        ve.current !== null && (cancelAnimationFrame(ve.current), ve.current = null);
      };
    }, [ge, _e, e]);
    let xe = he ? ye === null ? G ? {
      aspectRatio: String(G)
    } : undefined : {
      height: ye
    } : undefined;
    return X.jsxs(`div`, {
      className: `relative flex flex-col items-center group/node w-full min-w-[160px] min-h-[160px] ${he ? `h-auto` : `h-full`} ${r ? `z-50` : `z-10`}`,
      children: [X.jsx(si, {
        id: e,
        data: n,
        defaultTitle: `普通视频`,
        icon: X.jsx(_n, {
          size: 11,
          className: `text-gray-500`
        })
      }), !l.loading && X.jsx(`div`, {
        className: `absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`,
        children: X.jsxs(`div`, {
          className: `flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`,
          children: [W.images.length === 0 && X.jsx(`button`, {
            className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`,
            title: `上传参考图`,
            onClick: e => {
              e.stopPropagation(), j.current?.click();
            },
            children: X.jsx(jn, {
              size: 14
            })
          }), l.videoUrl && X.jsxs(X.Fragment, {
            children: [X.jsx(`button`, {
              className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`,
              title: `全屏播放`,
              onClick: e => {
                e.stopPropagation(), O(true);
              },
              children: X.jsx(bt, {
                size: 14
              })
            }), X.jsx(`button`, {
              className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`,
              title: `下载`,
              onClick: pe,
              children: X.jsx(mn, {
                size: 14
              })
            }), X.jsx(Yn, {
              url: l.videoUrl,
              fallbackExt: `mp4`,
              onToast: e => l.onShowToast?.(e)
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
        minWidth: 160,
        minHeight: 160,
        keepAspectRatio: he
      }), X.jsx(`input`, {
        type: `file`,
        ref: j,
        style: {
          display: `none`
        },
        accept: `image/*`,
        onChange: me
      }), X.jsx(`div`, {
        className: `relative bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-colors duration-300 cursor-pointer group/display flex flex-col w-full
            ${he ? `` : `flex-1`}
            ${r ? `border-[#555]` : `border-[#333] hover:border-[#444]`}
        `,
        style: xe,
        onClick: () => {
          H(!V), a(e, {
            expanded: !V
          });
        },
        children: X.jsxs(`div`, {
          className: `flex items-center justify-center absolute inset-0 ${l.videoUrl ? `` : `bg-[#121212]`}`,
          children: [l.videoUrl && X.jsxs(X.Fragment, {
            children: [(() => {
              let t = u && (l.thumbnailUrl || l.imageAvailable) ? l.thumbnailUrl || Br(l.videoUrl, d) : null,
                n = zr(l.videoUrl);
              return t ? X.jsx(`img`, {
                src: t,
                alt: `video poster`,
                loading: `lazy`,
                decoding: `async`,
                draggable: false,
                className: `max-w-full w-full h-full object-contain block ${l.loading ? `opacity-50 blur-sm` : ``}`,
                onError: t => {
                  let r = t.currentTarget;
                  n && r.src !== n ? r.src = n : a(e, {
                    imageAvailable: false
                  });
                }
              }) : X.jsx(`video`, {
                src: l.videoUrl,
                poster: l.thumbnailUrl,
                preload: l.thumbnailUrl ? `auto` : `metadata`,
                className: `max-w-full w-full h-full object-contain block ${l.loading ? `opacity-50 blur-sm` : ``}`,
                controls: false,
                autoPlay: false,
                muted: false
              });
            })(), !l.loading && X.jsx(`div`, {
              className: `absolute inset-0 flex items-center justify-center pointer-events-none`,
              children: X.jsx(`button`, {
                className: `w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-black/70 transition-all nodrag pointer-events-auto`,
                title: `播放视频`,
                onClick: e => {
                  e.stopPropagation(), O(true);
                },
                children: X.jsx(vn, {
                  className: `text-white w-6 h-6`
                })
              })
            })]
          }), l.loading && X.jsxs(`div`, {
            className: `absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500 z-10 overflow-hidden bg-[#121212]`,
            children: [(W.images[0] || l.thumbnailUrl) && X.jsx(`div`, {
              className: `absolute inset-0 bg-cover bg-center opacity-30 blur-xl scale-110`,
              style: {
                backgroundImage: `url(${l.thumbnailUrl || W.images[0].url})`
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
            children: X.jsx(_n, {
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
        position: J.Left
      }), X.jsx(_r, {
        type: `source`,
        position: J.Right
      }), (() => {
        let t = X.jsxs(`div`, {
          className: `space-y-3`,
          children: [X.jsxs(`div`, {
            className: `flex flex-col gap-2 mb-2`,
            children: [(W.images.length > 0 || W.texts.length > 0 || se.length > 0) && X.jsxs(`div`, {
              className: `flex flex-wrap gap-2 mb-1`,
              children: [W.images.map((t, n) => X.jsxs(`div`, {
                className: `w-10 h-10 rounded-md overflow-hidden border border-[#444] relative group bg-black`,
                title: `连线图片`,
                children: [X.jsx(`img`, {
                  src: t.url,
                  alt: `Ref`,
                  loading: `lazy`,
                  decoding: `async`,
                  className: `w-full h-full object-cover`
                }), X.jsx(`div`, {
                  className: `absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`,
                  onClick: n => {
                    n.stopPropagation(), o(n => n.filter(n => !(n.target === e && n.source === t.id)));
                  },
                  children: X.jsx(yn, {
                    size: 10,
                    className: `text-white`
                  })
                })]
              }, `img-${n}`)), se.map((t, n) => X.jsxs(`div`, {
                className: `w-10 h-10 rounded-md overflow-hidden border border-blue-500/50 relative group bg-black`,
                title: `通过 @ 选中的素材`,
                children: [t.type.startsWith(`image`) ? X.jsx(`img`, {
                  src: t.url,
                  loading: `lazy`,
                  decoding: `async`,
                  className: `w-full h-full object-cover opacity-80`
                }) : t.type.startsWith(`video`) ? X.jsx(`video`, {
                  src: t.url,
                  preload: `metadata`,
                  className: `w-full h-full object-cover opacity-80`
                }) : X.jsx(`div`, {
                  className: `w-full h-full bg-[#222] flex items-center justify-center p-1`,
                  children: X.jsx(Dn, {
                    size: 12,
                    className: `text-gray-400`
                  })
                }), X.jsx(`div`, {
                  className: `absolute inset-0 bg-blue-500/10 pointer-events-none`
                }), X.jsx(`div`, {
                  className: `absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`,
                  onClick: t => {
                    t.stopPropagation();
                    let r = se.filter((e, t) => t !== n);
                    ce(r), a(e, {
                      selectedContextResources: r
                    });
                  },
                  children: X.jsx(yn, {
                    size: 10,
                    className: `text-white`
                  })
                })]
              }, `ctx-${n}`)), W.texts.map((e, t) => X.jsxs(`div`, {
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
                  ref: M,
                  className: `w-full bg-transparent text-[15px] text-gray-200 outline-none leading-relaxed placeholder-gray-600 font-sans custom-scrollbar nodrag nowheel nopan`,
                  style: {
                    width: n.inputWidth ? `${n.inputWidth}px` : undefined,
                    height: n.inputHeight ? `${n.inputHeight}px` : `80px`,
                    minHeight: `80px`,
                    overflow: `auto`
                  },
                  placeholder: `描述你想要的视频内容 (输入 @ 调出素材)...`,
                  value: f,
                  onChange: t => {
                    if (p(t), a(e, {
                      prompt: t
                    }), t.endsWith(`@`) ? re(true) : t.includes(`@`) || re(false), !n.inputHeight || n.inputHeight <= 200) {
                      let t = M.current;
                      requestAnimationFrame(() => {
                        if (t) {
                          t.style.height = `auto`;
                          let n = Math.max(80, Math.min(t.scrollHeight, 200));
                          t.style.height = n + `px`, a(e, {
                            inputHeight: n
                          });
                        }
                      });
                    }
                  },
                  onKeyDown: e => {
                    e.key === `Enter` && (e.ctrlKey || e.metaKey) && fe();
                  },
                  autoFocus: V,
                  onWheel: e => e.stopPropagation()
                }), ne && X.jsx(`div`, {
                  className: `absolute bottom-full left-0 mb-1 z-[100]`,
                  onWheel: e => e.stopPropagation(),
                  onClick: e => e.stopPropagation(),
                  children: X.jsx(Za, {
                    resources: ie,
                    onSelect: t => {
                      let n = f.lastIndexOf(`@`),
                        r = n >= 0 ? f.substring(0, n) + f.substring(n + 1) : f;
                      if (t.type === `text`) {
                        let n = r + (t.url || ``);
                        p(n), a(e, {
                          prompt: n
                        });
                      } else {
                        let n = [...se, t];
                        ce(n), a(e, {
                          selectedContextResources: n
                        }), p(r), a(e, {
                          prompt: r
                        });
                      }
                      re(false);
                    },
                    onClose: () => re(false)
                  })
                })]
              })
            })]
          }), X.jsxs(`div`, {
            className: `flex items-center justify-between pt-2 border-t border-[#2a2a2a] nodrag`,
            children: [X.jsxs(`div`, {
              className: `flex items-center gap-1.5 overflow-visible`,
              children: [X.jsxs(`div`, {
                className: `relative nodrag flex items-center`,
                ref: B,
                children: [X.jsxs(`button`, {
                  className: `flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer max-w-[120px]`,
                  onClick: e => {
                    e.stopPropagation(), z(!R);
                  },
                  title: `选择比例和时长`,
                  children: [X.jsx(oe, {
                    size: 12,
                    className: `opacity-70`
                  }), X.jsxs(`span`, {
                    className: `truncate`,
                    children: [m === `custom` ? `自定义` : Eo.find(e => e.value === m)?.label || m || `16:9`, ` · `, C, `s`]
                  })]
                }), R && X.jsxs(`div`, {
                  className: `absolute bottom-full left-0 mb-1 w-56 bg-[#222] border border-[#333] rounded-lg shadow-xl p-3 z-50 flex flex-col gap-3 max-h-72 overflow-y-auto custom-scrollbar nowheel nopan nodrag`,
                  onClick: e => e.stopPropagation(),
                  children: [X.jsxs(`div`, {
                    children: [X.jsx(`div`, {
                      className: `text-[10px] text-gray-500 mb-2 px-1`,
                      children: `比例 / 分辨率`
                    }), X.jsx(`div`, {
                      className: `flex flex-wrap gap-1.5 mb-3`,
                      children: Eo.map(t => X.jsx(`button`, {
                        className: `px-3 py-1.5 text-[11px] rounded-md transition-colors ${m === t.value ? `bg-[#444] text-white` : `bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`,
                        onClick: () => {
                          h(t.value), a(e, {
                            aspectRatio: t.value
                          }), Q.setConfig(Z.VIDEO_SIZE, t.value);
                        },
                        children: t.label
                      }, t.value))
                    }), m === `custom` && X.jsxs(`div`, {
                      className: `bg-[#1c1c1c] p-2 rounded border border-[#333] mb-2 flex flex-col gap-2`,
                      children: [X.jsxs(`div`, {
                        className: `flex items-center gap-2`,
                        children: [X.jsx(`span`, {
                          className: `text-[10px] text-gray-500 w-10`,
                          children: `比例:`
                        }), X.jsx(`input`, {
                          type: `text`,
                          value: g,
                          onChange: e => _(e.target.value),
                          placeholder: `如 16:9`,
                          className: `flex-1 bg-[#121212] border border-[#444] rounded px-2 py-1 text-[11px] text-gray-200 outline-none focus:border-blue-500`
                        })]
                      }), X.jsxs(`div`, {
                        className: `flex items-center gap-2`,
                        children: [X.jsx(`span`, {
                          className: `text-[10px] text-gray-500 w-10`,
                          children: `尺寸:`
                        }), X.jsx(`input`, {
                          type: `text`,
                          value: v,
                          onChange: t => {
                            y(t.target.value), a(e, {
                              customSize: t.target.value
                            });
                          },
                          placeholder: `如 1280x720 或 720p`,
                          className: `flex-1 bg-[#121212] border border-[#444] rounded px-2 py-1 text-[11px] text-gray-200 outline-none focus:border-blue-500`
                        })]
                      })]
                    })]
                  }), l.videoDurations && X.jsxs(`div`, {
                    children: [X.jsx(`div`, {
                      className: `text-[10px] text-gray-500 mb-2 px-1`,
                      children: `时长 (秒)`
                    }), X.jsx(`div`, {
                      className: `flex flex-wrap gap-1.5`,
                      children: l.videoDurations.split(`
`).map(e => e.trim()).filter(e => e !== ``).map((t, n) => X.jsxs(`button`, {
                        className: `px-3 py-1.5 text-[11px] rounded-md transition-colors ${C === t ? `bg-[#444] text-white` : `bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`,
                        onClick: () => {
                          w(t), a(e, {
                            selectedSeconds: t
                          }), Q.setConfig(Z.VIDEO_SECONDS, t);
                        },
                        children: [t, `s`]
                      }, n))
                    })]
                  })]
                })]
              }), !!(l.videoModel && l.videoModel.split(`
`).filter(e => e.trim() !== ``).length > 0) && X.jsxs(`div`, {
                className: `relative nodrag flex items-center`,
                ref: F,
                children: [X.jsx(`div`, {
                  className: `w-[1px] h-3 bg-[#444] mr-1.5`
                }), X.jsxs(`button`, {
                  className: `flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`,
                  onClick: e => {
                    e.stopPropagation(), P(!N);
                  },
                  title: T ? `${T}（${Xi(T) ? `内置` : `第三方`}）` : `选择模型`,
                  children: [T && X.jsx(`span`, {
                    className: `shrink-0 px-1 rounded text-[9px] leading-[14px] border ${Xi(T) ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`,
                    children: Xi(T) ? `内置` : `三方`
                  }), X.jsx(`span`, {
                    className: `whitespace-nowrap`,
                    children: T || `选择模型`
                  })]
                }), N && X.jsx(`div`, {
                  className: `absolute bottom-full left-0 mb-1 min-w-[17rem] w-max max-w-[29rem] bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 block max-h-60 overflow-y-auto custom-scrollbar nowheel nopan nodrag`,
                  onClick: e => e.stopPropagation(),
                  children: (() => {
                    let t = l.videoModel.split(`
`).map(e => e.trim()).filter(e => e !== ``),
                      n = t.filter(e => Xi(e)),
                      r = t.filter(e => !Xi(e)),
                      i = (t, n, r) => {
                        let i = r ? Ui(t) : null,
                          o = r ? Wi(t) : null,
                          s = ea(t, T === t);
                        return X.jsxs(`button`, {
                          className: s.className,
                          disabled: s.disabled,
                          onClick: () => {
                            s.disabled || (E(t), a(e, {
                              selectedModel: t
                            }), Q.setConfig(Z.VIDEO_MODEL, t), P(false));
                          },
                          title: s.title,
                          children: [X.jsx(`span`, {
                            className: `shrink-0 px-1 rounded text-[9px] leading-[14px] border ${r ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`,
                            children: r ? `内置` : `三方`
                          }), X.jsx(`span`, {
                            className: `flex-1 whitespace-nowrap`,
                            children: t
                          }), i !== null && X.jsxs(`span`, {
                            className: `shrink-0 inline-flex items-center gap-0.5 text-[10px] text-orange-400 tabular-nums`,
                            children: [X.jsx(Lt, {
                              className: `w-2.5 h-2.5`,
                              strokeWidth: 2.5
                            }), X.jsxs(`span`, {
                              children: [Zi(i), o ? `/${o}` : ``]
                            })]
                          })]
                        }, `${r ? `b` : `o`}-${n}`);
                      };
                    return X.jsxs(X.Fragment, {
                      children: [n.length > 0 && X.jsxs(X.Fragment, {
                        children: [X.jsxs(`div`, {
                          className: `text-[10px] text-blue-300 mb-1 px-1 flex items-center gap-1`,
                          children: [X.jsx(`span`, {
                            children: `✨`
                          }), X.jsx(`span`, {
                            children: `内置模型`
                          }), X.jsx(`span`, {
                            className: `ml-auto text-white/90 hover:text-white cursor-pointer whitespace-nowrap`,
                            onClick: e => {
                              e.stopPropagation(), window.dispatchEvent(new CustomEvent(`mutiwindow-open-builtin-settings`)), P(false);
                            },
                            title: `查看内置模型详情`,
                            children: `详情 ›`
                          })]
                        }), n.map((e, t) => i(e, t, true))]
                      }), r.length > 0 && X.jsxs(X.Fragment, {
                        children: [n.length > 0 && X.jsx(`div`, {
                          className: `h-px bg-[#333] my-1.5`
                        }), X.jsx(`div`, {
                          className: `text-[10px] text-gray-500 mb-1 px-1`,
                          children: `第三方 API`
                        }), r.map((e, t) => i(e, t, false))]
                      })]
                    });
                  })()
                })]
              }), X.jsxs(`div`, {
                className: `relative nodrag flex items-center`,
                ref: ee,
                children: [X.jsx(`div`, {
                  className: `w-[1px] h-3 bg-[#444] mr-1.5`
                }), X.jsx(`button`, {
                  className: `flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer max-w-[80px]`,
                  onClick: e => {
                    e.stopPropagation(), L(!I);
                  },
                  title: `请求格式`,
                  children: X.jsx(`span`, {
                    className: `truncate`,
                    children: le === `auto` ? `自动格式` : le === `json` ? `JSON` : `FormData`
                  })
                }), I && X.jsxs(`div`, {
                  className: `absolute bottom-full left-0 mb-1 w-32 bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 block nodrag`,
                  onClick: e => e.stopPropagation(),
                  children: [X.jsx(`div`, {
                    className: `text-[10px] text-gray-500 mb-2 px-1`,
                    children: `请求格式`
                  }), [{
                    label: `自动检测`,
                    value: `auto`
                  }, {
                    label: `FormData`,
                    value: `formdata`
                  }, {
                    label: `JSON`,
                    value: `json`
                  }].map(t => X.jsx(`button`, {
                    className: `w-full block mb-1 last:mb-0 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors truncate ${le === t.value ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`,
                    onClick: () => {
                      ue(t.value), a(e, {
                        apiFormat: t.value
                      }), L(false);
                    },
                    children: t.label
                  }, t.value))]
                })]
              }), X.jsx(Ja, {
                category: `video`,
                presetPrompts: l.presetPrompts || [],
                onApply: t => {
                  let n = f ? `${f}, ${t}` : t;
                  p(n), a(e, {
                    prompt: n
                  });
                },
                onToast: e => l.onShowToast?.(e)
              })]
            }), X.jsx(`div`, {
              className: `flex items-center gap-3 flex-shrink-0 ml-2`,
              children: l.loading ? X.jsxs(`div`, {
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
              }) : X.jsxs(`div`, {
                className: `flex items-center bg-[#2a2a2a] rounded-full p-1 pl-3 border border-[#333] hover:border-gray-500 transition-colors cursor-pointer group/btn`,
                onClick: e => {
                  e.stopPropagation(), fe();
                },
                children: [T && Xi(T) && Ui(T) !== null && X.jsxs(`div`, {
                  className: `flex items-center gap-0.5 mr-2 text-[11px] text-orange-400 tabular-nums`,
                  children: [X.jsx(Lt, {
                    className: `w-3 h-3`,
                    strokeWidth: 2.5
                  }), X.jsxs(`span`, {
                    children: [Zi(Ui(T) || 0), Wi(T) ? `/${Wi(T)}` : ``]
                  })]
                }), X.jsx(`div`, {
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
            className: `absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[#1c1c1c] rounded-2xl border border-[#333] shadow-2xl min-w-[500px] w-max max-w-[920px] transition-all duration-300 origin-top z-50
                ${V ? `opacity-100 scale-100 p-4 overflow-visible` : `opacity-0 scale-95 pointer-events-none h-0 p-0 border-0 overflow-hidden`}
              `,
            onClick: e => e.stopPropagation(),
            children: [!k && t, V && !k && X.jsx(_i, {
              targetRef: M,
              onRequestFullscreen: () => A(true),
              onResizeEnd: (t, n) => a(e, {
                inputWidth: t,
                inputHeight: n
              })
            })]
          }), X.jsx(vi, {
            open: k,
            title: `编辑提示词 - 普通视频`,
            onClose: () => A(false),
            children: t
          })]
        });
      })(), D && l.videoUrl && Un.createPortal(X.jsxs(`div`, {
        className: `fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md`,
        onClick: () => O(false),
        children: [X.jsx(`button`, {
          className: `absolute top-6 right-6 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-50`,
          onClick: () => O(false),
          children: X.jsx(yn, {
            size: 32
          })
        }), X.jsx(`video`, {
          src: l.videoUrl,
          className: `max-w-[95vw] max-h-[95vh] object-contain shadow-2xl rounded-lg outline-none`,
          controls: true,
          autoPlay: true,
          onClick: e => e.stopPropagation()
        })]
      }), document.body)]
    });
  });