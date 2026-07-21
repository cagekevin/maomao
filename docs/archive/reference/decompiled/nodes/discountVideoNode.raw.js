/**
 * 节点类型: discountVideoNode
 * 原版函数名: os
 * 原版行号: L11322-L12746
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
// q → Ow
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

  os = Y.memo(({
    id: e,
    data: n,
    selected: r
  }) => {
    let {
        updateNodeData: i,
        setEdges: a,
        addNodes: o,
        addEdges: s,
        getNodes: c,
        setNodes: l,
        getNode: u
      } = Gt(),
      d = n,
      [f, p] = Y.useState(d.prompt || ``),
      [m, h] = Y.useState(d.size || localStorage.getItem(`mutiwindow_discountvideo_size`) || `16:9`),
      [g, _] = Y.useState(`16:9`),
      [v, y] = Y.useState(d.resolution || localStorage.getItem(`mutiwindow_discountvideo_resolution`) || `1080p`),
      [b, x] = Y.useState(d.selectedSeconds || localStorage.getItem(`mutiwindow_discountvideo_seconds`) || `10`),
      [C, w] = Y.useState(d.selectedModel || localStorage.getItem(`mutiwindow_discountvideo_model`) || d.discountVideoModel && d.discountVideoModel.split(`
`)[0].trim() || ``),
      [T, E] = Y.useState(false),
      [D, O] = Y.useState(false),
      k = Y.useRef(null),
      [A, j] = Y.useState(false),
      [M, N] = Y.useState(false),
      [P, F] = Y.useState(null),
      I = Y.useRef(null),
      [ee, R] = Y.useState(false),
      z = Y.useRef(null),
      [B, te] = Y.useState(false),
      [ne, re] = Y.useState(-1),
      ie = Y.useRef(null),
      [ae, se] = Y.useState(d.selectedContextResources || []),
      {
        uploadedAssets: ce,
        setUploadedAssets: le,
        uploadingAssetsRef: ue,
        failedAssetsRef: V,
        uploadAsset: H,
        getAssetStatus: U,
        clearAllFailedAssets: W
      } = Oo({
        nodeId: e,
        initialUploadedAssets: d.uploadedAssets,
        updateNodeData: i,
        onUploadAsset: d.onUploadAsset,
        onShowToast: d.onShowToast
      });
    Y.useEffect(() => {
      d.selectedContextResources && se(d.selectedContextResources);
    }, [d.selectedContextResources]), Y.useEffect(() => {
      let e = e => {
        z.current && !z.current.contains(e.target) && R(false), I.current && !I.current.contains(e.target) && (j(false), F(null));
      };
      return (ee || A) && document.addEventListener(`mousedown`, e, true), () => {
        document.removeEventListener(`mousedown`, e, true);
      };
    }, [ee, A]), Y.useEffect(() => {
      Li(`/api`).catch(() => {});
    }, []);
    let [, fe] = Y.useReducer(e => e + 1, 0);
    Y.useEffect(() => zi(() => fe()), []);
    let pe = Ii(),
      me = Y.useMemo(() => d.discountVideoModel ? d.discountVideoModel.split(`
`).map(e => e.trim()).filter(Boolean) : [], [d.discountVideoModel]),
      G = Y.useMemo(() => {
        let e = Fi(),
          t = {};
        for (let n of me) t[n] = Hi(n) ?? e?.discountVideoSpecs?.[n] ?? null;
        return t;
      }, [me, d.discountVideoModel, pe]),
      he = Y.useMemo(() => C ? Hi(C) ?? G[C] ?? null : null, [C, G]),
      ge = Y.useMemo(() => {
        let e = Vo(he, `resolutions`, as.map(e => e.value));
        return as.filter(t => e.includes(t.value));
      }, [he]),
      _e = Y.useMemo(() => {
        let e = Vo(he, `aspectRatios`, is.map(e => e.value));
        return is.filter(t => e.includes(t.value));
      }, [he]),
      K = Y.useMemo(() => Fo(he), [he]),
      ve = Bo(he, `durationSpec`),
      ye = Y.useMemo(() => {
        let e = (d.videoDurations || `4
6
8
10
12
15`).split(`
`).map(e => e.trim()).filter(Boolean).map(Number).filter(e => Number.isFinite(e) && e > 0);
        return Ho(he, e.length ? e : [4, 6, 8, 10, 12, 15]);
      }, [he, d.videoDurations]),
      be = Y.useMemo(() => {
        let e = (d.videoDurations || `4
6
8
10
12
15`).split(`
`).map(e => e.trim()).filter(Boolean).map(Number).filter(e => Number.isFinite(e) && e > 0);
        return Uo(he, {
          min: e.length ? Math.min(...e) : 4,
          max: e.length ? Math.max(...e) : 15
        });
      }, [he, d.videoDurations]),
      xe = be.min,
      Se = be.max,
      Ce = be.step,
      we = K?.mode === `discrete`;
    Y.useEffect(() => {
      if (!C || !he) return;
      let t = v,
        n = m,
        r = b;
      ge.length && !ge.some(e => e.value === v) && (t = ge[0].value, y(t), i(e, {
        resolution: t
      }), localStorage.setItem(`mutiwindow_discountvideo_resolution`, t)), _e.length && m !== `custom` && !_e.some(e => e.value === m) && (n = _e[0].value, h(n), i(e, {
        size: n
      }), localStorage.setItem(`mutiwindow_discountvideo_size`, n));
      let a = Number(b);
      ve && K ? Lo(K, a) || (r = K.mode === `discrete` ? String(K.options[0]) : String(K.min), x(r), i(e, {
        selectedSeconds: r
      }), localStorage.setItem(`mutiwindow_discountvideo_seconds`, r)) : ye.length && (!Number.isFinite(a) || !ye.includes(a)) && (r = String(ye[0]), x(r), i(e, {
        selectedSeconds: r
      }), localStorage.setItem(`mutiwindow_discountvideo_seconds`, r));
    }, [C, he]);
    let [q, Te] = Y.useState(d.expanded === undefined ? true : d.expanded);
    Y.useEffect(() => {
      d.expanded !== undefined && Te(d.expanded);
    }, [d.expanded]);
    let Ee = async t => {
        if (d.onUploadAsset) {
          delete V.current[t.id], ue.current[t.id] = true;
          try {
            let n = await d.onUploadAsset(t.url, t.type);
            if (!n || typeof n != `string`) throw Error(`网关返回为空`);
            le(r => {
              let a = {
                ...r,
                [t.url]: n
              };
              return i(e, {
                uploadedAssets: a
              }), a;
            });
          } catch (e) {
            console.error(`Retry upload failed for`, t.id, e), d.onShowToast?.(`素材重试失败: ${e?.message || e}`), V.current[t.id] = true;
          } finally {
            delete ue.current[t.id];
          }
        }
      },
      De = ({
        resId: e,
        resUrl: t,
        resType: n
      }) => {
        let r = U(e, t);
        return !r.isUploading && !r.isUploaded && !r.isFailed ? null : r.isFailed ? X.jsxs(`div`, {
          className: `absolute inset-0 bg-red-900/70 backdrop-blur-[1px] flex flex-col items-center justify-center cursor-pointer hover:bg-red-900/85 transition-colors group/retry z-10`,
          title: `上传失败,点击重试`,
          onClick: r => {
            r.stopPropagation(), Ee({
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
            className: `animate-spin drop-shadow-md text-white`
          }) : r.isUploaded ? X.jsx(ot, {
            size: 12,
            className: `text-green-500 drop-shadow-md`
          }) : null
        });
      },
      Oe = t({
        handleType: `target`
      }),
      ke = ut(Y.useMemo(() => Oe.map(e => e.source), [Oe])),
      Ae = Y.useMemo(() => {
        if (!ke) return {
          images: [],
          videos: [],
          audios: [],
          texts: []
        };
        let e = Array.isArray(ke) ? ke : [ke],
          t = [],
          n = [],
          r = [],
          i = [];
        return e.forEach(e => {
          let a = Oe.find(t => t.source === e?.id);
          if (e?.data?.imageUrl) {
            let i = e.data.imageUrl;
            i.startsWith(`data:video/`) || /\.(mp4|webm|mov|ogg)($|\?)/i.test(i) ? n.push({
              id: e.id,
              url: i,
              type: `video`,
              sourceNodeId: e.id
            }) : i.startsWith(`data:audio/`) || /\.(mp3|wav|ogg|aac)($|\?)/i.test(i) ? r.push({
              id: e.id,
              url: i,
              type: `audio`,
              sourceNodeId: e.id
            }) : t.push({
              id: e.id,
              url: i,
              type: `image`,
              sourceNodeId: e.id
            });
          }
          if (e?.data?.videoUrl && n.push({
            id: e.id,
            url: e.data.videoUrl,
            type: `video`,
            sourceNodeId: e.id
          }), e?.data?.audioUrl && r.push({
            id: e.id,
            url: e.data.audioUrl,
            type: `audio`,
            sourceNodeId: e.id
          }), e?.type === `videoExtractNode` && e?.data?.extractedImages) if (a && a.sourceHandle && a.sourceHandle.startsWith(`frame-`)) {
            let n = parseInt(a.sourceHandle.replace(`frame-`, ``), 10);
            if (!(e.data.hiddenIndices || []).includes(n)) {
              let r = e.data.allExtractedImages;
              r && r[n] && t.push({
                id: `${e.id}-ext-${n}`,
                url: r[n],
                type: `image`,
                sourceNodeId: e.id
              });
            }
          } else e.data.extractedImages.forEach((n, r) => {
            t.push({
              id: `${e.id}-ext-${r}`,
              url: n,
              type: `image`,
              sourceNodeId: e.id
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
                  type: `image`,
                  sourceNodeId: e.id
                });
              });
            } else {
              let r = n[typeof e.data.activeIndex == `number` ? e.data.activeIndex : 0]?.url;
              r && t.push({
                id: `${e.id}-box-active`,
                url: r,
                type: `image`,
                sourceNodeId: e.id
              });
            }
          }
          let o = new Set([`textNode`, `audioNode`, `textConcatNode`]);
          e?.data?.text && o.has(e.type) && i.push({
            id: e.id,
            sourceNodeId: e.id,
            label: e?.type === `audioNode` ? `听音断句结果` : e.data.label || `文本节点`,
            text: e.data.text
          });
        }), {
          images: t,
          videos: n,
          audios: r,
          texts: i
        };
      }, [ke, Oe]),
      je = Y.useMemo(() => {
        let e = [],
          t = e => typeof e != `string` || e.startsWith(`image`) ? `image` : e.startsWith(`video`) ? `video` : e.startsWith(`audio`) ? `audio` : `image`;
        return ae.forEach(n => {
          n?.url && !n.url.startsWith(`asset://`) && e.push({
            id: n.id,
            url: n.url,
            type: t(n.type)
          });
        }), Ae.images.forEach(t => {
          t.url && !t.url.startsWith(`asset://`) && e.push({
            id: t.id,
            url: t.url,
            type: `image`
          });
        }), Ae.videos.forEach(t => {
          t.url && !t.url.startsWith(`asset://`) && e.push({
            id: t.id,
            url: t.url,
            type: `video`
          });
        }), Ae.audios.forEach(t => {
          t.url && !t.url.startsWith(`asset://`) && e.push({
            id: t.id,
            url: t.url,
            type: `audio`
          });
        }), e;
      }, [ae, Ae]);
    Y.useEffect(() => {
      for (let e of je) {
        if (!e.url || e.url.startsWith(`asset://`)) continue;
        let t = e.url,
          n = e.id;
        ce[t] || ue.current[n] || V.current[n] || H({
          id: n,
          url: e.url,
          type: e.type
        }).catch(e => {
          console.error(`Auto upload failed for`, n, e);
        });
      }
    }, [Y.useMemo(() => je.map(e => `${e.id}|${e.url}`).join(`;`), [je]), ce, H]), Y.useEffect(() => {
      d.prompt !== undefined && d.prompt !== f && p(d.prompt);
    }, [d.prompt]), Y.useEffect(() => {
      d.size !== undefined && d.size !== m && h(d.size);
    }, [d.size]), Y.useEffect(() => {
      if (d.discountVideoModel && !C) {
        let t = d.discountVideoModel.split(`
`)[0].trim();
        w(t), i(e, {
          selectedModel: t
        });
      }
    }, [d.discountVideoModel, C, e, i]);
    let Me = Y.useRef(false);
    Y.useEffect(() => {
      Me.current || (d.selectedModel && d.selectedModel !== C && w(d.selectedModel), (d.selectedModel || C) && (Me.current = true));
    }, [d.selectedModel]), Y.useEffect(() => {
      if (d.videoDurations && !b) {
        let t = d.videoDurations.split(`
`)[0].trim();
        x(t), i(e, {
          selectedSeconds: t
        });
      }
    }, [d.videoDurations, b, e, i]), Y.useEffect(() => {
      d.selectedSeconds && d.selectedSeconds !== b && x(d.selectedSeconds);
    }, [d.selectedSeconds]), Y.useEffect(() => {}, [d.videoUrl, d.loading]);
    let Ne = () => {
        if (Object.keys(ue.current).length > 0) {
          d.onShowToast?.(`素材正在上传处理中，请等待所有对勾出现后再生成`);
          return;
        }
        if (Object.keys(V.current).length > 0) {
          d.onShowToast?.(`有素材上传失败，已为您重新尝试上传，请稍后`), W();
          return;
        }
        if (!C.trim()) {
          d.onShowToast?.(`请选择 AI 模型`);
          return;
        }
        if (!f.trim() && Ae.images.length === 0 && Ae.texts.length === 0 && ae.length === 0) {
          d.onShowToast?.(`请输入提示词或连接参考节点`);
          return;
        }
        let t = m === `custom` ? g : m,
          n = Go(he, {
            modelName: C,
            prompt: f,
            resolution: v,
            aspectRatio: t,
            seconds: b,
            imageCount: Ae.images.length,
            videoCount: Ae.videos.length,
            audioCount: Ae.audios.length
          });
        if (!n.ok) {
          d.onShowToast?.(n.errors[0] || `当前参数不符合模型要求`);
          return;
        }
        d.onGenerateDiscountVideo?.(e, f, t, C, b, v);
      },
      Pe = async e => {
        if (e.stopPropagation(), d.videoUrl) try {
          if (d.onShowToast?.(`开始下载视频...`), typeof chrome < `u` && chrome.downloads) chrome.downloads.download({
            url: d.videoUrl,
            filename: `yimao/video-${Date.now()}.mp4`,
            saveAs: false
          });else {
            let e = await (await fetch(d.videoUrl)).blob(),
              t = window.URL.createObjectURL(e),
              n = document.createElement(`a`);
            n.href = t, n.download = `video-${Date.now()}.mp4`, document.body.appendChild(n), n.click(), window.URL.revokeObjectURL(t), document.body.removeChild(n);
          }
        } catch (e) {
          console.error(`Download failed:`, e), d.onShowToast?.(`下载失败，请重试`), window.open(d.videoUrl, `_blank`);
        }
      },
      Fe = async t => {
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
              console.warn(`[DiscountVideoNode] urlifyAsset failed, fallback to resizeImage:`, e);
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
            console.warn(`[DiscountVideoNode] urlifyAsset failed for media, fallback to base64:`, e);
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
      },
      Ie = (t, n = false) => {
        let r = ie.current,
          a = `@${t} `;
        if (!r) {
          let t = n && ne >= 0 ? f.substring(0, ne) + a + f.substring(ne + 1) : f + a;
          p(t), i(e, {
            prompt: t
          });
          return;
        }
        let o = r.selectionStart ?? f.length,
          s = r.selectionEnd ?? f.length,
          c,
          l;
        n && ne >= 0 ? (c = f.substring(0, ne), l = f.substring(ne + 1)) : (c = f.substring(0, o), l = f.substring(s));
        let u = c + a + l;
        p(u), i(e, {
          prompt: u
        });
        let d = c.length + a.length;
        requestAnimationFrame(() => {
          ie.current && (ie.current.focus(), ie.current.setSelectionRange(d, d));
        });
      },
      Le = e => e.type.startsWith(`image`) ? `图片${Ae.images.findIndex(t => t.id === e.id) + 1}` : e.type.startsWith(`video`) ? `视频${Ae.videos.findIndex(t => t.id === e.id) + 1}` : e.type.startsWith(`audio`) ? `音频${Ae.audios.findIndex(t => t.id === e.id) + 1}` : `素材1`,
      Re = (e => {
        if (!e) return null;
        let t = e.match(/^(\d+(?:\.\d+)?)\s*[:：]\s*(\d+(?:\.\d+)?)$/);
        if (!t) return null;
        let n = parseFloat(t[1]),
          r = parseFloat(t[2]);
        return !n || !r ? null : n / r;
      })(m === `custom` ? g : m),
      ze = Re !== null,
      Be = ze && Re ? Math.round(380 * Math.sqrt(Re)) : null,
      Ve = ze && Re ? Math.round(380 / Math.sqrt(Re)) : null,
      He = Y.useRef(Ve),
      Ue = Y.useRef(null),
      [We, Ge] = Y.useState(null);
    Y.useEffect(() => {
      let t = He.current;
      if (He.current = Ve, Ue.current !== null && (cancelAnimationFrame(Ue.current), Ue.current = null), Be === null || Ve === null) {
        Ge(null), l(t => t.map(t => {
          if (t.id !== e || t.style?.height !== undefined) return t;
          let n = 420 - (t.style?.width ?? t.width ?? 380);
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
      let n = u(e),
        r = n?.style?.width ?? n?.width ?? 380,
        i = n?.position.x ?? 0,
        a = n?.position.y ?? 0,
        o = t ?? Ve,
        s = Be,
        c = Ve;
      if (t === null || Math.round(r) === s && Math.round(o) === c) {
        Ge(null), l(t => t.map(t => {
          if (t.id !== e) return t;
          let n = t.style?.width ?? t.width ?? 380;
          if (Math.round(n) === s && t.style?.height === undefined) return t;
          let r = s - n,
            i = {
              ...t.style,
              width: s
            };
          return delete i.height, {
            ...t,
            width: s,
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
            a = r + (s - r) * i,
            u = o + (c - o) * i;
          Ge(u), l(t => t.map(t => {
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
                y: f - u
              }
            };
          })), n < 1 ? Ue.current = requestAnimationFrame(h) : (Ue.current = null, Ge(null), l(t => t.map(t => {
            if (t.id !== e) return t;
            let n = {
              ...t.style,
              width: s
            };
            return delete n.height, {
              ...t,
              width: s,
              height: undefined,
              style: n,
              position: {
                x: p - s / 2,
                y: f - c
              }
            };
          })));
        };
      return Ue.current = requestAnimationFrame(h), () => {
        Ue.current !== null && (cancelAnimationFrame(Ue.current), Ue.current = null);
      };
    }, [Be, Ve, e]);
    let Ke = ze ? We === null ? Re ? {
      aspectRatio: String(Re)
    } : undefined : {
      height: We
    } : undefined;
    return X.jsxs(`div`, {
      className: `relative flex flex-col items-center group/node w-full min-w-[200px] min-h-[200px] ${ze ? `h-auto` : `h-full`} ${r ? `z-50` : `z-10`}`,
      children: [X.jsx(si, {
        id: e,
        data: n,
        defaultTitle: `特惠视频`,
        icon: X.jsx(de, {
          size: 11,
          className: `text-gray-500`
        })
      }), !d.loading && X.jsx(`div`, {
        className: `absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`,
        children: X.jsxs(`div`, {
          className: `flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`,
          children: [X.jsx(`button`, {
            className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md transition-colors`,
            title: `上传图片、视频或音频素材`,
            onClick: e => {
              e.stopPropagation(), k.current?.click();
            },
            children: X.jsx(jn, {
              size: 14
            })
          }), d.videoUrl && X.jsxs(X.Fragment, {
            children: [X.jsx(`button`, {
              className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md transition-colors`,
              title: `全屏播放`,
              onClick: e => {
                e.stopPropagation(), E(true);
              },
              children: X.jsx(bt, {
                size: 14
              })
            }), X.jsx(`button`, {
              className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md transition-colors`,
              title: `下载`,
              onClick: Pe,
              children: X.jsx(mn, {
                size: 14
              })
            }), X.jsx(Yn, {
              url: d.videoUrl,
              fallbackExt: `mp4`,
              onToast: e => d.onShowToast?.(e)
            }), d.onDelete && X.jsx(`button`, {
              className: `p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors`,
              title: `删除`,
              onClick: e => {
                e.stopPropagation(), d.onDelete?.();
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
        minHeight: 200,
        keepAspectRatio: ze
      }), X.jsx(`input`, {
        type: `file`,
        ref: k,
        style: {
          display: `none`
        },
        accept: `image/*,video/*,audio/*`,
        onChange: Fe
      }), X.jsx(`div`, {
        className: `relative bg-[#1c1c1c] rounded-xl border shadow-xl transition-colors duration-300 cursor-pointer group/display flex flex-col overflow-hidden w-full
            ${ze ? `` : `flex-1`}
            ${r ? `border-[#555]` : `border-[#333] hover:border-[#444]`}
        `,
        style: Ke,
        onClick: () => {
          Te(!q), i(e, {
            expanded: !q
          });
        },
        children: X.jsxs(`div`, {
          className: `flex items-center justify-center absolute inset-0 rounded-xl overflow-hidden ${d.videoUrl ? `` : `bg-[#121212]`}`,
          children: [d.videoUrl && X.jsxs(X.Fragment, {
            children: [X.jsx(`video`, {
              src: d.videoUrl,
              poster: d.thumbnailUrl,
              className: `max-w-full w-full h-full object-contain block ${d.loading ? `opacity-50 blur-sm` : ``}`,
              controls: false,
              autoPlay: false,
              muted: false,
              onDoubleClick: e => {
                e.stopPropagation(), E(true);
              }
            }), !d.loading && X.jsx(`div`, {
              className: `absolute inset-0 flex items-center justify-center pointer-events-none`,
              children: X.jsx(`button`, {
                className: `w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-black/70 transition-all nodrag pointer-events-auto`,
                title: `播放视频`,
                onClick: e => {
                  e.stopPropagation(), E(true);
                },
                children: X.jsx(vn, {
                  className: `text-white w-6 h-6`
                })
              })
            })]
          }), d.loading && X.jsx(pi, {
            label: !d.progress || d.progress === 0 ? `生成中...` : `生成中... ${d.progress}%`,
            backgroundUrl: d.thumbnailUrl || Ae.images[0]?.url,
            children: X.jsx(hi, {
              category: `video`
            })
          }), !d.videoUrl && !d.loading && !d.errorMessage && X.jsx(`div`, {
            className: `flex flex-col items-center justify-center absolute inset-0 bg-[#151515] pointer-events-none`,
            children: X.jsx(de, {
              size: 80,
              className: `text-gray-700`,
              strokeWidth: 1.2
            })
          }), d.errorMessage && !d.loading && !d.videoUrl && X.jsxs(`div`, {
            className: `absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-500 z-10 bg-[#1a1a1a] p-4 text-center`,
            children: [X.jsx(pt, {
              size: 32
            }), X.jsx(`div`, {
              className: `text-xs font-medium max-w-full break-words`,
              children: d.errorMessage
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
            children: [(Ae.images.length > 0 || Ae.videos.length > 0 || Ae.audios.length > 0 || Ae.texts.length > 0 || ae.length > 0) && X.jsxs(`div`, {
              className: `flex flex-wrap gap-2 mb-1`,
              children: [Ae.images.map((t, n) => X.jsxs(`div`, {
                className: `w-10 h-10 rounded-md overflow-hidden border border-[#444] relative group bg-black`,
                title: `连线图片 (点击底部标签插入到提示词)`,
                children: [X.jsx(`img`, {
                  src: t.url,
                  alt: `Ref`,
                  className: `w-full h-full object-cover`
                }), X.jsx(De, {
                  resId: t.id,
                  resUrl: t.url,
                  resType: `image`
                }), X.jsxs(`button`, {
                  type: `button`,
                  className: `absolute bottom-0 left-0 right-0 bg-blue-500/80 hover:bg-blue-500 text-[8px] text-white text-center py-0.5 truncate cursor-pointer transition-colors`,
                  title: `点击插入 @图片${n + 1}`,
                  onMouseDown: e => e.preventDefault(),
                  onClick: e => {
                    e.stopPropagation(), Ie(`图片${n + 1}`);
                  },
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
              }, `img-${n}`)), Ae.videos?.map((t, n) => X.jsxs(`div`, {
                className: `w-10 h-10 rounded-md overflow-hidden border border-[#444] relative group bg-black`,
                title: `连线视频 (点击底部标签插入到提示词)`,
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
                }), X.jsx(De, {
                  resId: t.id,
                  resUrl: t.url,
                  resType: `video`
                }), X.jsxs(`button`, {
                  type: `button`,
                  className: `absolute bottom-0 left-0 right-0 bg-blue-500/80 hover:bg-blue-500 text-[8px] text-white text-center py-0.5 truncate cursor-pointer transition-colors`,
                  title: `点击插入 @视频${n + 1}`,
                  onMouseDown: e => e.preventDefault(),
                  onClick: e => {
                    e.stopPropagation(), Ie(`视频${n + 1}`);
                  },
                  children: [`视频`, n + 1]
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
              }, `vid-${n}`)), Ae.audios?.map((t, n) => X.jsxs(`div`, {
                className: `w-10 h-10 rounded-md overflow-hidden border border-[#444] relative group bg-black`,
                title: `连线音频 (点击底部标签插入到提示词)`,
                children: [X.jsx(`div`, {
                  className: `w-full h-full bg-[#222] flex items-center justify-center p-1`,
                  children: X.jsx(Zt, {
                    size: 16,
                    className: `text-yellow-500`
                  })
                }), X.jsx(De, {
                  resId: t.id,
                  resUrl: t.url,
                  resType: `audio`
                }), X.jsxs(`button`, {
                  type: `button`,
                  className: `absolute bottom-0 left-0 right-0 bg-blue-500/80 hover:bg-blue-500 text-[8px] text-white text-center py-0.5 truncate cursor-pointer transition-colors`,
                  title: `点击插入 @音频${n + 1}`,
                  onMouseDown: e => e.preventDefault(),
                  onClick: e => {
                    e.stopPropagation(), Ie(`音频${n + 1}`);
                  },
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
              }, `aud-${n}`)), ae.filter(e => {
                let t = Ae.images.some(t => t.id === e.id),
                  n = Ae.videos?.some(t => t.id === e.id),
                  r = Ae.audios?.some(t => t.id === e.id),
                  i = [...Ae.images, ...(Ae.videos || []), ...(Ae.audios || [])].some(t => t.id === e.id);
                return !t && !n && !r && i;
              }).map((t, n) => {
                let r = ``;
                return r = t.type.startsWith(`image`) ? `图片${Ae.images.findIndex(e => e.id === t.id) + 1}` : t.type.startsWith(`video`) ? `视频${Ae.videos.findIndex(e => e.id === t.id) + 1}` : t.type.startsWith(`audio`) ? `音频${Ae.audios.findIndex(e => e.id === t.id) + 1}` : `素材${n + 1}`, X.jsxs(`div`, {
                  className: `w-10 h-10 rounded-md overflow-hidden relative group bg-black`,
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
                  }), X.jsx(De, {
                    resId: t.id,
                    resUrl: t.url,
                    resType: t.type.startsWith(`image`) ? `image` : t.type.startsWith(`video`) ? `video` : `audio`
                  }), X.jsx(`div`, {
                    className: `absolute inset-0 bg-blue-500/10 pointer-events-none`
                  }), X.jsx(`button`, {
                    type: `button`,
                    className: `absolute bottom-0 left-0 right-0 bg-blue-500/80 hover:bg-blue-500 text-[8px] text-white text-center py-0.5 truncate cursor-pointer transition-colors`,
                    title: `点击插入 @${r}`,
                    onMouseDown: e => e.preventDefault(),
                    onClick: e => {
                      e.stopPropagation(), Ie(r);
                    },
                    children: r
                  }), X.jsx(`div`, {
                    className: `absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all z-10`,
                    onClick: n => {
                      if (n.stopPropagation(), t.isConnected) a(n => n.filter(n => !(n.source === t.sourceNodeId && n.target === e)));else {
                        let n = ae.filter(e => e.id !== t.id);
                        se(n), i(e, {
                          selectedContextResources: n
                        });
                      }
                    },
                    children: X.jsx(yn, {
                      size: 10,
                      className: `text-white`
                    })
                  })]
                }, `ctx-${n}`);
              }), Ae.texts.map((e, t) => X.jsxs(`div`, {
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
                children: [X.jsx(`textarea`, {
                  ref: ie,
                  className: `w-full h-20 bg-transparent text-[15px] text-gray-200 min-h-[80px] outline-none leading-relaxed placeholder-gray-600 font-sans custom-scrollbar nowheel nopan nodrag`,
                  style: {
                    resize: `none`,
                    boxSizing: `border-box`
                  },
                  placeholder: `描述你想要的视频内容 (输入 @ 调出素材)...`,
                  value: f,
                  onChange: t => {
                    let n = t.target.value,
                      r = t.target.selectionStart ?? n.length;
                    p(n), i(e, {
                      prompt: n
                    });
                    let a = n.substring(0, r),
                      o = a.lastIndexOf(`@`);
                    if (o >= 0) {
                      let e = o === 0 ? `` : a[o - 1],
                        t = a.substring(o + 1),
                        n = o === 0 || /\s/.test(e),
                        r = !/\s/.test(t);
                      if (n && r) {
                        re(o), te(true);
                        return;
                      }
                    }
                    re(-1), te(false);
                  },
                  onKeyDown: e => {
                    e.key === `Enter` && (e.ctrlKey || e.metaKey) && Ne(), e.key === `Escape` && B && te(false);
                  },
                  autoFocus: q,
                  onWheel: e => e.stopPropagation()
                }), B && X.jsxs(`div`, {
                  className: `absolute bottom-[calc(100%+4px)] left-0 w-72 bg-[#222] border border-[#444] rounded-lg shadow-2xl z-[999999] flex flex-col overflow-hidden h-[300px] nopan`,
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
                      onClick: () => te(false),
                      className: `text-gray-500 hover:text-white p-1`,
                      children: X.jsx(yn, {
                        size: 12
                      })
                    })]
                  }), X.jsx(`div`, {
                    className: `p-2 flex-1 overflow-y-auto custom-scrollbar nowheel nopan nodrag`,
                    children: (() => {
                      let e = [...Ae.images.map(e => ({
                        id: e.id,
                        url: e.url,
                        type: `image`
                      })), ...Ae.videos.map(e => ({
                        id: e.id,
                        url: e.url,
                        type: `video`
                      })), ...Ae.audios.map(e => ({
                        id: e.id,
                        url: e.url,
                        type: `audio`
                      }))];
                      return e.length === 0 ? X.jsx(`div`, {
                        className: `text-center text-gray-500 text-xs py-10`,
                        children: `暂无素材，请先上传`
                      }) : X.jsx(`div`, {
                        className: `grid grid-cols-4 gap-1.5`,
                        children: e.map(e => X.jsxs(`div`, {
                          className: `aspect-square bg-[#111] rounded border border-[#333] hover:border-blue-500 cursor-pointer overflow-hidden relative group`,
                          onClick: () => {
                            Ie(Le(e), true), re(-1), te(false);
                          },
                          children: [e.type.startsWith(`image`) ? X.jsx(`img`, {
                            src: e.url,
                            className: `w-full h-full object-cover`
                          }) : e.type.startsWith(`video`) ? X.jsx(`video`, {
                            src: e.url,
                            className: `w-full h-full object-cover`
                          }) : e.type.startsWith(`audio`) ? X.jsx(`div`, {
                            className: `w-full h-full bg-[#222] flex items-center justify-center p-1`,
                            children: X.jsx(`span`, {
                              className: `text-[10px] text-gray-400`,
                              children: `音频`
                            })
                          }) : X.jsx(`div`, {
                            className: `p-1 text-[8px] text-gray-400 break-all overflow-hidden h-full`,
                            children: e.url
                          }), X.jsx(`div`, {
                            className: `absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity`,
                            children: X.jsx(`span`, {
                              className: `text-[10px] text-white`,
                              children: `选择`
                            })
                          })]
                        }, e.id))
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
                ref: z,
                children: [X.jsxs(`button`, {
                  className: `flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`,
                  onClick: e => {
                    e.stopPropagation(), R(!ee);
                  },
                  title: `选择比例和时长`,
                  children: [X.jsx(oe, {
                    size: 12,
                    className: `opacity-70`
                  }), X.jsxs(`span`, {
                    className: `whitespace-nowrap`,
                    children: [is.find(e => e.value === m)?.label || `16:9`, ` · `, v, ` · `, b, `s`]
                  })]
                }), ee && X.jsxs(`div`, {
                  className: `absolute bottom-full left-0 mb-1 w-72 bg-[#222] border border-[#333] rounded-lg shadow-xl p-3 z-50 flex flex-col gap-3 max-h-none overflow-visible nopan nodrag`,
                  onClick: e => e.stopPropagation(),
                  children: [X.jsxs(`div`, {
                    children: [X.jsx(`div`, {
                      className: `text-[10px] text-gray-500 mb-2 px-1`,
                      children: `比例`
                    }), X.jsx(`div`, {
                      className: `flex flex-wrap gap-1.5 mb-2`,
                      children: _e.filter(e => C.startsWith(`grok-`) || C.startsWith(`firefly-`) ? e.value === `16:9` || e.value === `9:16` : true).map(t => X.jsx(`button`, {
                        className: `px-3 py-1.5 text-[11px] rounded-md transition-colors ${m === t.value ? `bg-[#444] text-white` : `bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`,
                        onClick: () => {
                          h(t.value), i(e, {
                            size: t.value
                          }), localStorage.setItem(`mutiwindow_discountvideo_size`, t.value);
                        },
                        children: t.label
                      }, t.value))
                    }), m === `custom` && X.jsx(`div`, {
                      className: `bg-[#1c1c1c] p-2 rounded border border-[#333] mb-2 flex flex-col gap-2`,
                      children: X.jsxs(`div`, {
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
                      })
                    })]
                  }), X.jsxs(`div`, {
                    children: [X.jsx(`div`, {
                      className: `text-[10px] text-gray-500 mb-2 px-1`,
                      children: `分辨率`
                    }), X.jsx(`div`, {
                      className: `flex flex-wrap gap-1.5 mb-3`,
                      children: ge.map(t => X.jsx(`button`, {
                        className: `px-3 py-1.5 text-[11px] rounded-md transition-colors ${v === t.value ? `bg-[#444] text-white` : `bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`,
                        onClick: () => {
                          y(t.value), i(e, {
                            resolution: t.value
                          }), localStorage.setItem(`mutiwindow_discountvideo_resolution`, t.value);
                        },
                        children: t.label
                      }, t.value))
                    })]
                  }), X.jsxs(`div`, {
                    children: [X.jsx(`div`, {
                      className: `text-[10px] text-gray-500 mb-2 px-1`,
                      children: `时长 (秒)`
                    }), ve && we ? X.jsx(`div`, {
                      className: `flex flex-wrap gap-1.5 px-1 mb-1`,
                      children: ye.map(t => X.jsxs(`button`, {
                        type: `button`,
                        className: `px-3 py-1.5 text-[11px] rounded-md transition-colors ${String(t) === b ? `bg-[#444] text-white` : `bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`,
                        onClick: () => {
                          x(String(t)), i(e, {
                            selectedSeconds: String(t)
                          }), localStorage.setItem(`mutiwindow_discountvideo_seconds`, String(t));
                        },
                        children: [t, `s`]
                      }, t))
                    }) : X.jsxs(`div`, {
                      className: `flex items-center gap-2 px-1`,
                      children: [X.jsx(`input`, {
                        type: `range`,
                        min: xe,
                        max: Se,
                        step: Ce,
                        value: b,
                        onChange: t => {
                          x(t.target.value), i(e, {
                            selectedSeconds: t.target.value
                          }), localStorage.setItem(`mutiwindow_discountvideo_seconds`, t.target.value);
                        },
                        className: `flex-1 accent-blue-500`
                      }), X.jsx(`input`, {
                        type: `number`,
                        value: b,
                        onChange: t => {
                          let n = t.target.value;
                          x(n), i(e, {
                            selectedSeconds: n
                          }), localStorage.setItem(`mutiwindow_discountvideo_seconds`, n);
                        },
                        className: `w-12 bg-[#1c1c1c] text-gray-200 border border-[#333] rounded px-1 py-0.5 text-xs outline-none text-center`
                      })]
                    })]
                  })]
                })]
              }), me.length > 0 && X.jsxs(`div`, {
                className: `relative nodrag flex items-center`,
                ref: I,
                children: [X.jsx(`div`, {
                  className: `w-[1px] h-3 bg-[#444] mr-1.5`
                }), X.jsxs(`button`, {
                  className: `flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`,
                  onClick: e => {
                    e.stopPropagation(), j(e => (e && F(null), !e));
                  },
                  title: C ? `${C}（${Xi(C) ? `内置` : `第三方`}）` : `选择 AI 模型`,
                  children: [C && X.jsx(`span`, {
                    className: `shrink-0 px-1 rounded text-[9px] leading-[14px] border ${Xi(C) ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`,
                    children: Xi(C) ? `内置` : `三方`
                  }), X.jsx(`span`, {
                    className: `whitespace-nowrap`,
                    children: C || `选择模型`
                  })]
                }), A && X.jsxs(`div`, {
                  className: `absolute bottom-full left-0 mb-1 bg-[#222] border border-[#333] rounded-lg shadow-xl z-50 flex items-stretch nowheel nopan nodrag`,
                  onClick: e => e.stopPropagation(),
                  children: [X.jsxs(`div`, {
                    className: `w-max min-w-[13rem] max-w-[24rem] shrink-0 flex flex-col border-r border-[#333]`,
                    children: [X.jsxs(`div`, {
                      className: `relative flex-1 min-h-0`,
                      children: [X.jsx(`div`, {
                        className: `p-2 max-h-[24rem] overflow-x-hidden overflow-y-auto no-scrollbar`,
                        children: (() => {
                          let t = me,
                            n = t.filter(e => Xi(e)),
                            r = t.filter(e => !Xi(e)),
                            a = (t, n, r) => {
                              let a = r ? Ui(t) : null,
                                o = r ? Wi(t) : null,
                                s = ea(t, C === t);
                              return X.jsxs(`div`, {
                                role: `button`,
                                className: `relative ${s.className}`,
                                onClick: () => {
                                  s.disabled || (w(t), i(e, {
                                    selectedModel: t
                                  }), localStorage.setItem(`mutiwindow_discountvideo_model`, t), j(false), F(null));
                                },
                                onMouseEnter: () => F(t),
                                onMouseLeave: () => F(e => e === t ? null : e),
                                title: s.title,
                                children: [X.jsx(`span`, {
                                  className: `shrink-0 px-1 rounded text-[9px] leading-[14px] border ${r ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`,
                                  children: r ? `内置` : `三方`
                                }), X.jsx(`span`, {
                                  className: `flex-1 whitespace-nowrap`,
                                  children: t
                                }), a !== null && X.jsxs(`span`, {
                                  className: `shrink-0 inline-flex items-center gap-0.5 text-[10px] text-yellow-300 tabular-nums`,
                                  children: [X.jsx(qo, {
                                    className: `w-2.5 h-2.5`
                                  }), X.jsxs(`span`, {
                                    children: [Zi(a), o ? `/${o}` : ``]
                                  })]
                                })]
                              }, `${r ? `b` : `o`}-${n}`);
                            };
                          return X.jsxs(X.Fragment, {
                            children: [n.length > 0 && X.jsx(`div`, {
                              className: `text-[9px] text-gray-500 px-2 pt-0.5 pb-1`,
                              children: `内置模型`
                            }), n.map((e, t) => a(e, t, true)), r.length > 0 && X.jsx(`div`, {
                              className: `text-[9px] text-gray-500 px-2 pt-1.5 pb-1`,
                              children: `第三方模型`
                            }), r.map((e, t) => a(e, t, false))]
                          });
                        })()
                      }), X.jsx(`div`, {
                        className: `pointer-events-none absolute top-0 left-0 right-0 h-5 bg-gradient-to-b from-[#222] to-transparent`
                      }), X.jsx(`div`, {
                        className: `pointer-events-none absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-t from-[#222] to-transparent`
                      })]
                    }), X.jsx(`div`, {
                      className: `shrink-0 p-2 border-t border-[#333]`,
                      children: X.jsx(`button`, {
                        type: `button`,
                        className: `w-full text-center px-2 py-1.5 text-[11px] text-blue-400 hover:text-blue-300 hover:bg-[#2a2a2a] rounded-md transition-colors cursor-pointer`,
                        onClick: e => {
                          e.stopPropagation(), j(false), F(null), N(true);
                        },
                        children: `详细对比`
                      })
                    })]
                  }), (() => {
                    let e = (P && Xi(P) ? P : null) || (C && Xi(C) ? C : null) || me.find(e => Xi(e)) || null;
                    return X.jsx(`div`, {
                      className: `w-72 shrink-0 p-2 max-h-[28rem] overflow-x-hidden overflow-y-auto no-scrollbar`,
                      children: e ? X.jsx(ns, {
                        name: e,
                        entry: G[e],
                        bare: true
                      }) : X.jsx(`div`, {
                        className: `h-full flex items-center justify-center text-[11px] text-gray-500`,
                        children: `悬停内置模型查看详情`
                      })
                    });
                  })()]
                })]
              }), X.jsx(rs, {
                open: M,
                modelNames: me,
                specsByName: G,
                selectedModel: C,
                onClose: () => N(false),
                onConfirm: t => {
                  w(t), i(e, {
                    selectedModel: t
                  }), localStorage.setItem(`mutiwindow_discountvideo_model`, t), N(false);
                }
              }), X.jsx(Ja, {
                category: `video`,
                presetPrompts: d.presetPrompts || [],
                onApply: t => {
                  let n = f ? `${f}, ${t}` : t;
                  p(n), i(e, {
                    prompt: n
                  });
                },
                onToast: e => d.onShowToast?.(e)
              })]
            }), X.jsx(`div`, {
              className: `flex items-center gap-3 flex-shrink-0 ml-2`,
              children: d.loading ? X.jsxs(`div`, {
                className: `flex items-center gap-1.5`,
                children: [X.jsxs(`button`, {
                  className: `flex items-center gap-1 text-gray-400 hover:text-white bg-[#222] hover:bg-[#333] border border-[#333] hover:border-gray-500 rounded-full px-2.5 py-1 transition-colors`,
                  onClick: t => {
                    t.stopPropagation(), d.onRefresh?.(e);
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
                    t.stopPropagation(), d.onStop?.(e);
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
                  e.stopPropagation(), Ne();
                },
                children: [C && Xi(C) && Ui(C) !== null && (() => {
                  let e = Ui(C),
                    t = Wi(C),
                    n = t === `秒` || t === `s` || t === `sec`,
                    r = parseInt(b, 10) || 0,
                    i = n ? e * r : e;
                  return X.jsxs(`div`, {
                    className: `flex items-center gap-0.5 mr-2 text-[12px] text-yellow-300 tabular-nums`,
                    title: `预计消耗 ${Zi(i)} 特惠币${n ? `（${Zi(e)}/秒 × ${r}秒）` : ``}`,
                    children: [X.jsx(qo, {
                      className: `w-3.5 h-3.5`
                    }), X.jsx(`span`, {
                      children: Zi(i)
                    })]
                  });
                })(), X.jsx(`div`, {
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
                ${q ? `opacity-100 scale-100 p-4 overflow-visible` : `opacity-0 scale-95 pointer-events-none h-0 p-0 border-0 overflow-hidden`}
              `,
            onClick: e => e.stopPropagation(),
            children: [!D && t, q && !D && X.jsx(_i, {
              targetRef: ie,
              onRequestFullscreen: () => O(true)
            })]
          }), X.jsx(vi, {
            open: D,
            title: `编辑提示词 - 特惠视频`,
            onClose: () => O(false),
            children: t
          })]
        });
      })(), T && d.videoUrl && Un.createPortal(X.jsxs(`div`, {
        className: `fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md`,
        onClick: () => E(false),
        children: [X.jsx(`button`, {
          className: `absolute top-6 right-6 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-50`,
          onClick: () => E(false),
          children: X.jsx(yn, {
            size: 32
          })
        }), X.jsx(`video`, {
          src: d.videoUrl,
          className: `max-w-[95vw] max-h-[95vh] object-contain shadow-2xl rounded-lg outline-none`,
          controls: true,
          autoPlay: true,
          onClick: e => e.stopPropagation(),
          onDoubleClick: e => {
            e.stopPropagation(), E(true);
          }
        })]
      }), document.body)]
    });
  }),