/**
 * 节点类型: promptNode
 * 原版函数名: Ya
 * 原版行号: L3939-L5030
 * 来源: App-B9jVCs-a.decompiled.js
 *
 * 变量映射（vendor-map.json）:
// _ → tU
// _r → Rl
// a → ZK
// an → Xu
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
// mn → Vu
// mr → Vl
// mt → Vd
// n → Fq
// o → oK
// p → VW
// pr → Hl
// pt → Hd
// q → Ow
// r → Nq
// rt → Bb
// s → iK
// t → e1
// u → BG
// ut → Gd
// v → XH
// w → xT
// x → Y
// y → Mk
// yn → Iu
// z → Rw
 */

var Ya = Y.memo(({
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
    l = Y.useRef(null),
    [u, d] = Y.useState(n.prompt || ``),
    [f, p] = Y.useState(() => {
      let e = localStorage.getItem(`mutiwindow_prompt_aspectRatio`);
      return n.aspectRatio || e || `Auto`;
    }),
    [m, h] = Y.useState(() => {
      let e = localStorage.getItem(`mutiwindow_prompt_imageSize`);
      return n.imageSize || e || `1K`;
    });
  Y.useEffect(() => {
    let t = localStorage.getItem(`mutiwindow_prompt_aspectRatio`),
      r = n.aspectRatio || t || `Auto`;
    r !== n.aspectRatio && a(e, {
      aspectRatio: r
    });
  }, []), Y.useEffect(() => {
    let t = localStorage.getItem(`mutiwindow_prompt_imageSize`),
      r = n.imageSize || t || `1K`;
    r !== n.imageSize && a(e, {
      imageSize: r
    });
  }, []);
  let [g, _] = Y.useState(false),
    v = Y.useRef(null),
    [y, b] = Y.useState(false),
    [x, S] = Y.useState(false),
    [C, w] = Y.useState(false),
    T = Y.useRef(null),
    [E, D] = Y.useState(false),
    O = Y.useRef(null),
    [k, A] = Y.useState(false),
    j = Y.useRef(null),
    [M, N] = Y.useState(n.expanded === undefined ? true : n.expanded),
    [P, F] = Y.useState(false),
    [I, L] = Y.useState(-1),
    [ee, R] = Y.useState(n.selectedContextResources || []),
    [z, B] = Y.useState(n.selectedModel || localStorage.getItem(`mutiwindow_prompt_model`) || n.drawingModel && n.drawingModel.split(`
`)[0].trim() || ``),
    [te, ne] = Y.useState(n.apiFormat || `auto`),
    [re, ie] = Y.useState(1),
    [ae, se] = Y.useState(() => la().filter(e => e.enabled && e.category === `image`));
  Y.useEffect(() => ha(e => {
    se(e.filter(e => e.enabled && e.category === `image`));
  }), []);
  let ce = _a(z),
    le = ce ? ae.find(e => e.id === ce) : null,
    ue = n.presetPrompts || [],
    V = t => {
      if (!t) return;
      let n = u ? `${u}, ${t}` : t;
      d(n), a(e, {
        prompt: n
      });
    },
    H = Y.useRef(null),
    U = Y.useRef(null),
    de = Y.useRef(null),
    W = Y.useMemo(() => {
      let e = (z || ``).toLowerCase(),
        t = e.includes(`banana`) || e.includes(`gemini`) || e.includes(`香蕉`) || e.includes(`芭蕉`);
      return te === `gemini` || te === `auto` && t;
    }, [z, te]),
    fe = Y.useMemo(() => W ? C ? [`Auto`, `1:1`, `1:4`, `1:8`, `2:3`, `3:2`, `3:4`, `4:1`, `4:3`, `4:5`, `5:4`, `8:1`, `9:16`, `16:9`, `21:9`, `9:21`, `1:3`, `3:1`, `2:1`, `1:2`] : Array.from(new Set([`Auto`, `1:1`, `16:9`, `9:16`, `3:2`, `2:3`, `4:3`, `3:4`, `21:9`, f])) : [`Auto`, `1:1`, `16:9`, `9:16`, `3:2`, `2:3`, `4:3`, `3:4`, `21:9`, `9:21`, `1:3`, `3:1`, `2:1`, `1:2`], [W, C, f]);
  Y.useEffect(() => {
    d(n.prompt || ``), n.aspectRatio !== undefined && p(n.aspectRatio), n.imageSize !== undefined && h(n.imageSize), n.selectedModel !== undefined && B(n.selectedModel), n.apiFormat !== undefined && ne(n.apiFormat), n.selectedContextResources && R(n.selectedContextResources), n.expanded !== undefined && N(n.expanded);
  }, [n.prompt, n.aspectRatio, n.imageSize, n.selectedModel, n.apiFormat, n.selectedContextResources, n.expanded]), Y.useEffect(() => {
    if (!_a(z) && n.drawingModel) {
      let t = n.drawingModel.split(`
`).map(e => e.trim()).filter(Boolean);
      t.length > 0 && (!z || !t.includes(z)) && (B(t[0]), a(e, {
        selectedModel: t[0]
      }));
    }
  }, [n.drawingModel, z, e, a]), Y.useEffect(() => {
    let e = e => {
      v.current && !v.current.contains(e.target) && _(false), T.current && !T.current.contains(e.target) && S(false), O.current && !O.current.contains(e.target) && D(false), j.current && !j.current.contains(e.target) && A(false);
    };
    return (g || x || E || k) && document.addEventListener(`mousedown`, e, true), () => {
      document.removeEventListener(`mousedown`, e, true);
    };
  }, [g, x, E, k]);
  let pe = t({
      handleType: `target`
    }),
    me = ut(Y.useMemo(() => pe.map(e => e.source), [pe])),
    G = (() => {
      if (!me) return {
        images: [],
        texts: []
      };
      let e = Array.isArray(me) ? me : [me],
        t = [],
        n = [];
      return e.forEach(e => {
        let r = pe.find(t => t.source === e?.id);
        if (e?.data?.imageUrl && t.push({
          id: e.id,
          url: e.data.imageUrl,
          sourceNodeId: e.id
        }), e?.type === `videoExtractNode` && e?.data?.extractedImages) if (r && r.sourceHandle && r.sourceHandle.startsWith(`frame-`)) {
          let n = parseInt(r.sourceHandle.replace(`frame-`, ``), 10);
          if (!(e.data.hiddenIndices || []).includes(n)) {
            let r = e.data.allExtractedImages;
            r && r[n] && t.push({
              id: `${e.id}-ext-${n}`,
              url: r[n],
              sourceNodeId: e.id
            });
          }
        } else e.data.extractedImages.forEach((n, r) => {
          t.push({
            id: `${e.id}-ext-${r}`,
            url: n,
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
                sourceNodeId: e.id
              });
            });
          } else {
            let r = n[typeof e.data.activeIndex == `number` ? e.data.activeIndex : 0]?.url;
            r && t.push({
              id: `${e.id}-box-active`,
              url: r,
              sourceNodeId: e.id
            });
          }
        }
        let i = new Set([`promptNode`, `imageNode`, `imageBoxNode`, `videoNode`, `sd2VideoNode`, `discountVideoNode`, `gridSplitNode`, `gridMergeNode`, `cropNode`, `urlToImageNode`, `fileToUrlNode`, `panoramaNode`, `videoExtractNode`]);
        if (e?.data?.text && !i.has(e.type)) {
          let r = String(e.data.text).trim();
          e.type === `textNode` && (/^https?:\/\/[^\s]+$/.test(r) || r.startsWith(`data:image/`)) ? t.push({
            id: e.id,
            url: r,
            sourceNodeId: e.id
          }) : n.push({
            id: e.id,
            sourceNodeId: e.id,
            label: e?.type === `audioNode` ? `听音断句结果` : e.data.label || `文本节点`,
            text: e.data.text
          });
        }
      }), {
        images: t,
        texts: n
      };
    })(),
    he = () => {
      N(!M), a(e, {
        expanded: !M
      });
    },
    ge = n.imageUrl,
    _e = n.imageUrlRef,
    K = n.imageUrlThumbRef,
    ve = n.thumbnailUrl,
    {
      useThumbnail: ye
    } = pr(),
    be = oi(i ?? n._styleWidth ?? 420),
    xe = ye ? Lr(ge, be, `image`) || ve || ge : ge || ve,
    Se = n.loading,
    Ce = n.errorMessage,
    we = (t, n = false) => {
      let r = U.current,
        i = r?.textareaRef?.current || r,
        o = `@${t} `;
      if (!i) {
        let t = n && I >= 0 ? u.substring(0, I) + o + u.substring(I + 1) : u + o;
        d(t), a(e, {
          prompt: t
        });
        return;
      }
      let s = i.selectionStart ?? u.length,
        c = i.selectionEnd ?? u.length,
        l,
        f;
      n && I >= 0 ? (l = u.substring(0, I), f = u.substring(I + 1)) : (l = u.substring(0, s), f = u.substring(c));
      let p = l + o + f;
      d(p), a(e, {
        prompt: p
      });
      let m = l.length + o.length;
      requestAnimationFrame(() => {
        let e = U.current?.textareaRef?.current || U.current;
        e && (e.focus(), e.setSelectionRange(m, m));
      });
    },
    q = e => e.type.startsWith(`image`) ? `图片${G.images.findIndex(t => t.id === e.id) + 1}` : e.type.startsWith(`text`) ? `文本${G.texts.findIndex(t => t.id === e.id) + 1}` : `素材1`,
    Te = async t => {
      if (t.stopPropagation(), !ge) return;
      let r = ge,
        i = false;
      if (console.log(`[PromptNode] 下载开始:`, {
        nodeId: e,
        imageUrlRef: _e,
        currentImageLength: ge?.length
      }), _e) try {
        let e = await Q.getConfig(_e);
        console.log(`[PromptNode] 读取原图结果:`, {
          imageUrlRef: _e,
          originalFound: !!e,
          originalLength: e?.length
        }), e && typeof e == `string` && e.length > 1e4 ? (r = e, i = true, console.log(`[PromptNode] 下载使用原图成功, size:`, e.length)) : console.log(`[PromptNode] 原图未找到或数据异常，使用当前图片`);
      } catch (e) {
        console.warn(`[PromptNode] 获取原图失败，使用当前图片:`, e);
      } else console.log(`[PromptNode] 无原图引用(imageUrlRef)，下载当前图片`);
      console.log(`[PromptNode] 开始下载:`, {
        useOriginal: i,
        urlLength: r.length,
        isHttp: r.startsWith(`http`)
      });
      try {
        if (typeof chrome < `u` && chrome.downloads) chrome.downloads.download({
          url: r,
          filename: `yimao/generated-${Date.now()}.png`,
          saveAs: false
        });else {
          let e = await (await fetch(r)).blob(),
            t = window.URL.createObjectURL(e),
            n = document.createElement(`a`);
          n.href = t, n.download = `generated-${Date.now()}.png`, document.body.appendChild(n), n.click(), document.body.removeChild(n), setTimeout(() => window.URL.revokeObjectURL(t), 1e3);
        }
      } catch (e) {
        console.error(`[PromptNode] 下载失败:`, e), n.onShowToast && n.onShowToast(`下载失败，可能因跨域限制`), window.open(r, `_blank`);
      }
    },
    Ee = async t => {
      let r = t.target.files?.[0];
      if (!r) return;
      try {
        let i = await ii(r, {
          subfolder: `canvas/upload`,
          preferThumbnail: true,
          thumbMaxDim: 480,
          thumbQuality: 75
        });
        if (i.url && /^https?:\/\//i.test(i.url)) {
          n.onAddImage && n.onAddImage(e, i.url, i.url, i.thumbnailUrl || i.url), t.target.value = ``;
          return;
        }
      } catch (e) {
        console.warn(`[PromptNode] urlifyAsset failed, fallback to base64:`, e);
      }
      let i = new FileReader();
      i.onload = t => {
        let r = t.target?.result;
        n.onAddImage && n.onAddImage(e, r, _e, K);
      }, i.readAsDataURL(r), t.target.value = ``;
    },
    De = (e => {
      if (!e || e === `Auto`) return null;
      let t = e.match(/^(\d+(?:\.\d+)?)\s*[:：]\s*(\d+(?:\.\d+)?)$/);
      if (!t) return null;
      let n = parseFloat(t[1]),
        r = parseFloat(t[2]);
      return !n || !r ? null : n / r;
    })(f),
    Oe = De !== null,
    ke = Oe && De ? Math.round(360 * Math.sqrt(De)) : null,
    Ae = Oe && De ? Math.round(360 / Math.sqrt(De)) : null,
    je = Y.useRef(Ae),
    Me = Y.useRef(null),
    [Ne, Pe] = Y.useState(null);
  return Y.useEffect(() => {
    let t = je.current;
    if (je.current = Ae, Me.current !== null && (cancelAnimationFrame(Me.current), Me.current = null), ke === null || Ae === null) {
      Pe(null), s(t => t.map(t => {
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
      o = t ?? Ae,
      l = ke,
      u = Ae;
    if (t === null || Math.round(r) === l && Math.round(o) === u) {
      Pe(null), s(t => t.map(t => {
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
        Pe(c), s(t => t.map(t => {
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
        })), n < 1 ? Me.current = requestAnimationFrame(h) : (Me.current = null, Pe(null), s(t => t.map(t => {
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
    return Me.current = requestAnimationFrame(h), () => {
      Me.current !== null && (cancelAnimationFrame(Me.current), Me.current = null);
    };
  }, [ke, Ae, e]), X.jsxs(`div`, {
    ref: l,
    className: `relative flex flex-col items-center group/node w-full min-w-[160px] min-h-[160px] ${Oe ? `h-auto` : `h-full`} ${r ? `z-50` : `z-10`}`,
    children: [X.jsx(si, {
      id: e,
      data: n,
      defaultTitle: `生图节点`,
      icon: X.jsx(Ot, {
        size: 11,
        className: `text-gray-500`
      })
    }), !Se && X.jsx(`div`, {
      className: `absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`,
      children: X.jsxs(`div`, {
        className: `flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`,
        children: [G.images.length === 0 && X.jsx(`button`, {
          className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`,
          title: `上传参考图`,
          onClick: e => {
            e.stopPropagation(), H.current?.click();
          },
          children: X.jsx(jn, {
            size: 14
          })
        }), ge && X.jsxs(X.Fragment, {
          children: [X.jsx(`button`, {
            className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`,
            title: `放大`,
            onClick: t => {
              t.stopPropagation(), n.onZoom && n.onZoom(e, _e, ge);
            },
            children: X.jsx(rt, {
              size: 14
            })
          }), X.jsx(`button`, {
            className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`,
            title: `裁剪`,
            onClick: t => {
              t.stopPropagation(), n.onCrop && n.onCrop(e, ge, _e);
            },
            children: X.jsx(Wt, {
              size: 14
            })
          }), X.jsx(`button`, {
            className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`,
            title: `编辑`,
            onClick: t => {
              t.stopPropagation(), n.onEdit && n.onEdit(e, _e, ge);
            },
            children: X.jsx(an, {
              size: 14
            })
          }), X.jsx(`button`, {
            className: `p-1.5 text-gray-400 hover:text-blue-400 hover:bg-[#333] rounded-md`,
            title: `发送到左侧网站`,
            onClick: e => {
              e.stopPropagation(), n.onSendToActiveTab && n.onSendToActiveTab(ge);
            },
            children: X.jsx(Rn, {
              size: 14
            })
          }), X.jsx(Yn, {
            url: ge,
            fallbackExt: `png`,
            onToast: e => n.onShowToast?.(e)
          }), X.jsx(`button`, {
            className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`,
            title: `下载`,
            onClick: Te,
            children: X.jsx(mn, {
              size: 14
            })
          })]
        })]
      })
    }), X.jsx(ci, {
      visible: !!r,
      minWidth: 160,
      minHeight: 160,
      keepAspectRatio: Oe
    }), X.jsx(`input`, {
      type: `file`,
      ref: H,
      style: {
        display: `none`
      },
      accept: `image/*`,
      onChange: Ee
    }), X.jsx(`div`, {
      className: `relative bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-colors duration-300 cursor-pointer group/image w-full flex flex-col
          ${Oe ? `` : `flex-1`}
          ${r ? `border-[#555]` : `border-[#333] hover:border-[#444]`}
        `,
      style: Oe ? Ne === null ? De ? {
        aspectRatio: String(De)
      } : undefined : {
        height: Ne
      } : undefined,
      onClick: he,
      children: X.jsxs(`div`, {
        className: `flex items-center justify-center absolute inset-0 rounded-xl overflow-hidden ${ge ? `` : `bg-[#0d0c0c]`}`,
        children: [ge && X.jsx(`img`, {
          src: xe,
          alt: `Generated Content`,
          loading: `lazy`,
          decoding: `async`,
          className: `max-w-full w-full h-full object-contain block ${Se ? `opacity-50 blur-sm` : ``}`,
          draggable: false,
          onError: e => {
            let t = e.currentTarget;
            ge && t.src !== ge && (t.src = ge);
          },
          onDoubleClick: t => {
            t.stopPropagation(), n.onZoom && n.onZoom(e, _e, ge);
          }
        }), Se && X.jsx(pi, {
          label: `生图中...`,
          backgroundUrl: ge || G.images[0]?.url,
          children: X.jsx(hi, {
            category: `image`
          })
        }), Ce && !Se && X.jsxs(`div`, {
          className: `absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-500 z-10 bg-[#1a1a1a] p-4 text-center`,
          children: [X.jsx(pt, {
            size: 32
          }), X.jsx(`div`, {
            className: `text-xs font-medium max-w-full break-words`,
            children: Ce
          }), X.jsx(`button`, {
            className: `text-[10px] bg-[#333] hover:bg-[#444] text-gray-300 px-3 py-1 rounded-full border border-gray-600 transition-colors`,
            onClick: e => {
              e.stopPropagation();
            },
            children: `请检查设置或重试`
          })]
        }), !ge && !Se && !Ce && X.jsx(`div`, {
          className: `flex flex-col items-center justify-center absolute inset-0 bg-[#151515] pointer-events-none`,
          children: X.jsx(Ot, {
            size: 80,
            className: `text-gray-700`,
            strokeWidth: 1.2
          })
        }), X.jsx(`div`, {
          className: `absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100 pointer-events-none`
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
      let t = [...G.images.map(e => ({
          ...e,
          isConnected: true
        })), ...ee.filter(e => e.type.startsWith(`image`)).map(e => ({
          ...e,
          isConnected: false
        }))],
        r = X.jsxs(`div`, {
          className: `space-y-3`,
          children: [X.jsxs(`div`, {
            className: `flex flex-col gap-2 mb-2`,
            children: [(t.length > 0 || G.texts.length > 0) && X.jsxs(`div`, {
              className: `flex flex-wrap gap-2 mb-1`,
              children: [t.map((t, n) => {
                let r = `图片${n + 1}`;
                return X.jsxs(`div`, {
                  className: `w-10 h-10 rounded-md overflow-hidden relative group bg-black`,
                  title: t.isConnected ? `已连线的图片` : `上传的图片`,
                  children: [X.jsx(`img`, {
                    src: t.url,
                    className: `w-full h-full object-cover opacity-80`
                  }), X.jsx(`div`, {
                    className: `absolute inset-0 bg-blue-500/10 pointer-events-none`
                  }), X.jsx(`button`, {
                    type: `button`,
                    className: `absolute bottom-0 left-0 right-0 bg-blue-500/80 hover:bg-blue-500 text-[8px] text-white text-center py-0.5 truncate cursor-pointer transition-colors`,
                    title: `点击插入 @${r}`,
                    onMouseDown: e => e.preventDefault(),
                    onClick: e => {
                      e.stopPropagation(), we(r);
                    },
                    children: r
                  }), X.jsx(`div`, {
                    className: `absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`,
                    onClick: n => {
                      if (n.stopPropagation(), t.isConnected) o(n => n.filter(n => !(n.source === t.sourceNodeId && n.target === e)));else {
                        let n = ee.filter(e => e.id !== t.id);
                        R(n), a(e, {
                          selectedContextResources: n
                        });
                      }
                    },
                    children: X.jsx(yn, {
                      size: 10,
                      className: `text-white`
                    })
                  })]
                }, `img-${n}`);
              }), G.texts.map((t, n) => {
                let r = `文本${n + 1}`;
                return X.jsxs(`div`, {
                  className: `h-8 px-2 bg-[#2a2a2a] border border-[#444] rounded flex items-center gap-1 text-[10px] text-gray-300 hover:bg-[#333] hover:border-blue-500 hover:text-blue-400 transition-colors cursor-pointer group/text relative`,
                  title: t.text,
                  onClick: e => {
                    e.stopPropagation(), we(r);
                  },
                  children: [X.jsx(Dn, {
                    size: 10
                  }), X.jsxs(`span`, {
                    className: `max-w-[80px] truncate`,
                    children: [r, ` (`, t.label, `)`]
                  }), X.jsx(`div`, {
                    className: `absolute -top-1 -right-1 p-0.5 bg-black hover:bg-red-500 rounded-full cursor-pointer opacity-0 group-hover/text:opacity-100 transition-all`,
                    onClick: n => {
                      n.stopPropagation(), o(n => n.filter(n => !(n.source === t.sourceNodeId && n.target === e)));
                    },
                    children: X.jsx(yn, {
                      size: 10,
                      className: `text-white`
                    })
                  })]
                }, `txt-${n}`);
              })]
            }), X.jsx(`div`, {
              className: `flex items-start gap-2`,
              children: X.jsxs(`div`, {
                className: `flex-1 nodrag relative`,
                ref: de,
                children: [X.jsx(gi, {
                  ref: U,
                  className: `w-full bg-transparent text-[15px] text-gray-200 outline-none leading-relaxed placeholder-gray-600 font-sans custom-scrollbar nodrag nowheel nopan`,
                  style: {
                    width: n.inputWidth ? `${n.inputWidth}px` : undefined,
                    height: n.inputHeight ? `${n.inputHeight}px` : `80px`,
                    minHeight: `80px`,
                    overflow: `auto`
                  },
                  placeholder: `描述你想要的画面 (输入 @ 调出素材)...`,
                  value: u,
                  onChange: t => {
                    let r = U.current?.textareaRef?.current || U.current,
                      i = r ? r.selectionStart : t.length;
                    d(t), a(e, {
                      prompt: t
                    });
                    let o = t.substring(0, i),
                      s = o.lastIndexOf(`@`);
                    if (s >= 0) {
                      let e = s === 0 ? `` : o[s - 1],
                        t = o.substring(s + 1),
                        n = s === 0 || /\s/.test(e),
                        r = !/\s/.test(t);
                      if (n && r) {
                        L(s), b(true);
                        return;
                      }
                    }
                    L(-1), b(false), (!n.inputHeight || n.inputHeight <= 200) && requestAnimationFrame(() => {
                      if (r) {
                        r.style.height = `auto`;
                        let t = Math.max(80, Math.min(r.scrollHeight, 200));
                        r.style.height = t + `px`, a(e, {
                          inputHeight: t
                        });
                      }
                    });
                  },
                  onKeyDown: e => {
                    e.key === `Escape` && y && b(false);
                  },
                  autoFocus: M,
                  onWheel: e => e.stopPropagation()
                }), y && X.jsxs(`div`, {
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
                      onClick: () => b(false),
                      className: `text-gray-500 hover:text-white p-1`,
                      children: X.jsx(yn, {
                        size: 12
                      })
                    })]
                  }), X.jsx(`div`, {
                    className: `p-2 flex-1 overflow-y-auto custom-scrollbar nowheel nopan nodrag`,
                    children: (() => {
                      let e = [...G.images.map(e => ({
                        id: e.id,
                        url: e.url,
                        type: `image`
                      })), ...G.texts.map(e => ({
                        id: e.id,
                        url: e.text,
                        type: `text`,
                        label: e.label
                      }))];
                      return e.length === 0 ? X.jsx(`div`, {
                        className: `text-center text-gray-500 text-xs py-10`,
                        children: `暂无素材，请先连线`
                      }) : X.jsx(`div`, {
                        className: `grid grid-cols-4 gap-1.5`,
                        children: e.map(e => X.jsxs(`div`, {
                          className: `aspect-square bg-[#111] rounded border border-[#333] hover:border-blue-500 cursor-pointer overflow-hidden relative group flex flex-col`,
                          onClick: () => {
                            we(q(e), true), L(-1), b(false);
                          },
                          children: [e.type.startsWith(`image`) ? X.jsx(`img`, {
                            src: e.url,
                            className: `w-full h-full object-cover`
                          }) : X.jsxs(`div`, {
                            className: `w-full h-full bg-[#222] flex flex-col items-center justify-center p-1 text-center`,
                            children: [X.jsx(Dn, {
                              size: 16,
                              className: `text-blue-400 opacity-80 mb-1`
                            }), X.jsx(`span`, {
                              className: `text-[8px] text-gray-400 truncate w-full`,
                              children: e.label
                            })]
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
            className: `flex items-center justify-between mt-2 pt-2 border-t border-[#2a2a2a] nodrag`,
            children: [X.jsxs(`div`, {
              className: `flex items-center gap-1.5 overflow-visible`,
              children: [X.jsxs(`div`, {
                className: `relative nodrag`,
                ref: v,
                children: [X.jsxs(`button`, {
                  type: `button`,
                  className: `flex items-center gap-1.5 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`,
                  onMouseDown: e => {
                    e.stopPropagation();
                  },
                  onClick: e => {
                    e.stopPropagation(), _(!g);
                  },
                  children: [X.jsx(`div`, {
                    className: `w-2.5 h-3 border border-current rounded-[2px]`
                  }), X.jsxs(`span`, {
                    children: [f, ` · `, m]
                  })]
                }), g && X.jsxs(`div`, {
                  className: `absolute bottom-full left-0 mb-1 w-56 bg-[#222] border border-[#333] rounded-lg shadow-xl p-3 z-50 flex flex-col gap-3`,
                  onMouseDown: e => e.stopPropagation(),
                  onClick: e => e.stopPropagation(),
                  children: [X.jsxs(`div`, {
                    children: [X.jsx(`div`, {
                      className: `text-[10px] text-gray-500 mb-2`,
                      children: `画质`
                    }), X.jsx(`div`, {
                      className: `flex gap-1.5`,
                      children: [`1K`, `2K`, `4K`].map(t => X.jsx(`button`, {
                        type: `button`,
                        className: `flex-1 py-1.5 text-[11px] rounded-md border transition-colors ${m === t ? `bg-[#333] border-[#555] text-white` : `bg-[#1a1a1a] border-transparent text-gray-400 hover:bg-[#2a2a2a]`}`,
                        onMouseDown: e => {
                          e.stopPropagation();
                        },
                        onClick: () => {
                          _(false), h(t), requestAnimationFrame(() => {
                            a(e, {
                              imageSize: t
                            }), localStorage.setItem(`mutiwindow_prompt_imageSize`, t);
                          });
                        },
                        children: t
                      }, t))
                    })]
                  }), X.jsxs(`div`, {
                    children: [X.jsx(`div`, {
                      className: `text-[10px] text-gray-500 mb-2`,
                      children: `比例`
                    }), X.jsxs(`div`, {
                      className: `flex flex-wrap gap-1.5`,
                      children: [fe.map(t => X.jsx(`button`, {
                        type: `button`,
                        className: `px-3 py-1.5 text-[11px] rounded-md border transition-colors ${f === t ? `bg-[#333] border-[#555] text-white` : `bg-[#1a1a1a] border-transparent text-gray-400 hover:bg-[#2a2a2a]`}`,
                        onMouseDown: e => {
                          e.stopPropagation();
                        },
                        onClick: () => {
                          _(false), p(t), requestAnimationFrame(() => {
                            a(e, {
                              aspectRatio: t
                            }), localStorage.setItem(`mutiwindow_prompt_aspectRatio`, t);
                          });
                        },
                        children: t
                      }, t)), W && !C && X.jsx(`button`, {
                        type: `button`,
                        className: `px-3 py-1.5 text-[11px] rounded-md border border-transparent bg-[#1a1a1a] text-gray-500 hover:bg-[#2a2a2a] hover:text-gray-400 transition-colors`,
                        onMouseDown: e => {
                          e.stopPropagation();
                        },
                        onClick: () => w(true),
                        children: `更多...`
                      }), W && C && X.jsx(`button`, {
                        type: `button`,
                        className: `px-3 py-1.5 text-[11px] rounded-md border border-transparent bg-[#1a1a1a] text-gray-500 hover:bg-[#2a2a2a] hover:text-gray-400 transition-colors`,
                        onMouseDown: e => {
                          e.stopPropagation();
                        },
                        onClick: () => w(false),
                        children: `收起`
                      })]
                    })]
                  })]
                })]
              }), !!(n.drawingModel && n.drawingModel.split(`
`).filter(e => e.trim() !== ``).length > 0 || ae.length > 0) && X.jsxs(`div`, {
                className: `relative nodrag flex items-center`,
                ref: T,
                children: [X.jsx(`div`, {
                  className: `w-[1px] h-3 bg-[#444] flex-shrink-0 mr-1.5`
                }), X.jsxs(`button`, {
                  className: `flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`,
                  onClick: e => {
                    e.stopPropagation(), S(!x);
                  },
                  title: le ? `调度：${le.name}` : z ? `${z}（${Xi(z) ? `内置` : `第三方`}）` : `选择模型`,
                  children: [le ? X.jsx(`span`, {
                    className: `shrink-0 px-1 rounded text-[9px] leading-[14px] border bg-blue-500/20 text-blue-200 border-blue-400/40`,
                    children: `调度`
                  }) : z && X.jsx(`span`, {
                    className: `shrink-0 px-1 rounded text-[9px] leading-[14px] border ${Xi(z) ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`,
                    children: Xi(z) ? `内置` : `三方`
                  }), X.jsx(`span`, {
                    className: `whitespace-nowrap`,
                    children: le ? le.name : z || `选择模型`
                  })]
                }), x && X.jsx(`div`, {
                  className: `absolute bottom-full left-0 mb-1 min-w-[17rem] w-max max-w-[29rem] bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 block max-h-60 overflow-y-auto custom-scrollbar nowheel nopan nodrag`,
                  onClick: e => e.stopPropagation(),
                  children: (() => {
                    let t = (n.drawingModel || ``).split(`
`).map(e => e.trim()).filter(e => e !== ``),
                      r = t.filter(e => Xi(e)).sort((e, t) => e.localeCompare(t)),
                      i = t.filter(e => !Xi(e)).sort((e, t) => e.localeCompare(t)),
                      o = (t, n, r) => {
                        let i = r ? Ui(t) : null,
                          o = r ? Wi(t) : null,
                          s = ea(t, z === t);
                        return X.jsxs(`div`, {
                          role: `button`,
                          className: s.className,
                          title: s.title,
                          onClick: () => {
                            s.disabled || (B(t), a(e, {
                              selectedModel: t
                            }), localStorage.setItem(`mutiwindow_prompt_model`, t), S(false));
                          },
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
                      children: [ae.length > 0 && X.jsxs(X.Fragment, {
                        children: [X.jsxs(`div`, {
                          className: `text-[10px] text-blue-300 mb-1 px-1 flex items-center justify-between`,
                          children: [X.jsxs(`span`, {
                            className: `flex items-center gap-1`,
                            children: [X.jsx(Lt, {
                              className: `w-2.5 h-2.5`,
                              strokeWidth: 2.5
                            }), X.jsx(`span`, {
                              children: `模型调度`
                            })]
                          }), X.jsx(`span`, {
                            className: `ml-auto text-white/90 hover:text-white cursor-pointer transition-colors`,
                            onClick: e => {
                              e.stopPropagation(), window.dispatchEvent(new CustomEvent(`mutiwindow-open-schedule-settings`));
                            },
                            children: `配置 ›`
                          })]
                        }), ae.map(t => {
                          let n = ga(t.id);
                          return X.jsxs(`div`, {
                            role: `button`,
                            className: `w-full flex items-center gap-1.5 mb-1 last:mb-0 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors cursor-pointer ${z === n ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`,
                            onClick: () => {
                              B(n), a(e, {
                                selectedModel: n
                              }), localStorage.setItem(`mutiwindow_prompt_model`, n), S(false);
                            },
                            title: `${t.name}（${t.steps.length} 个模型按序重试）`,
                            children: [X.jsx(`span`, {
                              className: `shrink-0 px-1 rounded text-[9px] leading-[14px] border bg-blue-500/20 text-blue-200 border-blue-400/40`,
                              children: `调度`
                            }), X.jsx(`span`, {
                              className: `flex-1 whitespace-nowrap`,
                              children: t.name
                            }), X.jsxs(`span`, {
                              className: `shrink-0 text-[10px] text-gray-500`,
                              children: [t.steps.length, ` 模型`]
                            })]
                          }, t.id);
                        }), (r.length > 0 || i.length > 0) && X.jsx(`div`, {
                          className: `h-px bg-[#333] my-1.5`
                        })]
                      }), r.length > 0 && X.jsxs(X.Fragment, {
                        children: [X.jsxs(`div`, {
                          className: `text-[10px] text-blue-300 mb-1 px-1 flex items-center gap-1`,
                          children: [X.jsx(`span`, {
                            children: `✨`
                          }), X.jsx(`span`, {
                            children: `内置模型`
                          }), X.jsx(`span`, {
                            className: `ml-auto text-white/90 hover:text-white cursor-pointer whitespace-nowrap`,
                            onClick: e => {
                              e.stopPropagation(), window.dispatchEvent(new CustomEvent(`mutiwindow-open-builtin-settings`)), S(false);
                            },
                            title: `查看内置模型详情`,
                            children: `详情 ›`
                          })]
                        }), r.map((e, t) => o(e, t, true))]
                      }), i.length > 0 && X.jsxs(X.Fragment, {
                        children: [r.length > 0 && X.jsx(`div`, {
                          className: `h-px bg-[#333] my-1.5`
                        }), X.jsx(`div`, {
                          className: `text-[10px] text-gray-500 mb-1 px-1`,
                          children: `第三方 API`
                        }), i.map((e, t) => o(e, t, false))]
                      })]
                    });
                  })()
                })]
              }), X.jsxs(`div`, {
                className: `relative nodrag flex items-center`,
                ref: O,
                children: [X.jsx(`div`, {
                  className: `w-[1px] h-3 bg-[#444] flex-shrink-0 mr-1.5`
                }), X.jsx(`button`, {
                  className: `flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`,
                  onClick: e => {
                    e.stopPropagation(), D(!E);
                  },
                  title: `请求格式`,
                  children: X.jsx(`span`, {
                    className: `truncate`,
                    children: te === `auto` ? `自动格式` : te === `openai` ? `OpenAI格式` : `Gemini格式`
                  })
                }), E && X.jsxs(`div`, {
                  className: `absolute bottom-full left-0 mb-1 w-32 bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 block nodrag`,
                  onClick: e => e.stopPropagation(),
                  children: [X.jsx(`div`, {
                    className: `text-[10px] text-gray-500 mb-2 px-1`,
                    children: `请求格式`
                  }), [{
                    label: `自动检测`,
                    value: `auto`
                  }, {
                    label: `OpenAI 格式`,
                    value: `openai`
                  }, {
                    label: `Gemini 格式`,
                    value: `gemini`
                  }].map(t => X.jsx(`button`, {
                    className: `w-full block mb-1 last:mb-0 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors truncate ${te === t.value ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`,
                    onClick: () => {
                      ne(t.value), a(e, {
                        apiFormat: t.value
                      }), D(false);
                    },
                    children: t.label
                  }, t.value))]
                })]
              }), X.jsx(Ja, {
                category: `image`,
                presetPrompts: ue,
                onApply: V,
                onToast: e => n.onShowToast?.(e)
              })]
            }), X.jsx(`div`, {
              className: `flex items-center gap-3 flex-shrink-0 ml-2`,
              children: Se ? X.jsxs(`div`, {
                className: `flex items-center bg-red-500/10 rounded-full p-1 pl-3 border border-red-500/30 hover:border-red-500/50 transition-colors cursor-pointer group/btn`,
                onClick: t => {
                  t.stopPropagation(), n.onStop && n.onStop(e);
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
                className: `flex items-center gap-2`,
                children: [X.jsxs(`div`, {
                  className: `relative nodrag flex items-center`,
                  ref: j,
                  children: [X.jsx(`button`, {
                    className: `flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-[#333] hover:border-[#555] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`,
                    onClick: e => {
                      e.stopPropagation(), A(!k);
                    },
                    title: `批量生成数量`,
                    children: X.jsxs(`span`, {
                      children: [`x`, re]
                    })
                  }), k && X.jsx(`div`, {
                    className: `absolute bottom-full right-0 mb-1 w-16 bg-[#222] border border-[#333] rounded-lg shadow-xl p-1 z-50 flex flex-col gap-0.5`,
                    onClick: e => e.stopPropagation(),
                    children: [1, 2, 3, 4, 5].map(e => X.jsxs(`button`, {
                      className: `w-full text-center py-1.5 text-[11px] rounded-md transition-colors ${re === e ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`,
                      onClick: t => {
                        t.stopPropagation(), ie(e), A(false);
                      },
                      children: [`x`, e]
                    }, e))
                  })]
                }), X.jsxs(`div`, {
                  className: `flex items-center bg-[#2a2a2a] rounded-full p-1 pl-3 border border-[#333] hover:border-gray-500 transition-colors cursor-pointer group/btn`,
                  onClick: t => {
                    if (t.stopPropagation(), !u.trim() && G.images.length === 0 && G.texts.length === 0) {
                      n.onShowToast && n.onShowToast(`请输入提示词或连接参考节点`);
                      return;
                    }
                    n.onGenerate && n.onGenerate(e, u, `1024x1024`, z, te, re);
                  },
                  children: [z && Xi(z) && Ui(z) !== null && X.jsxs(`div`, {
                    className: `flex items-center gap-0.5 mr-2 text-[11px] text-orange-400 tabular-nums`,
                    children: [X.jsx(Lt, {
                      className: `w-3 h-3`,
                      strokeWidth: 2.5
                    }), X.jsx(`span`, {
                      children: Zi((Ui(z) || 0) * re)
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
                })]
              })
            })]
          })]
        });
      return X.jsxs(X.Fragment, {
        children: [X.jsxs(`div`, {
          className: `absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[#1c1c1c] rounded-2xl border border-[#333] shadow-2xl min-w-[500px] w-max max-w-[920px] transition-all duration-300 origin-top z-50
                ${M ? `opacity-100 scale-100 p-4 overflow-visible` : `opacity-0 scale-95 pointer-events-none h-0 p-0 border-0 overflow-hidden`}
              `,
          onClick: e => e.stopPropagation(),
          children: [!P && r, M && !P && X.jsx(_i, {
            targetRef: U,
            onRequestFullscreen: () => F(true),
            onResizeEnd: (t, n) => a(e, {
              inputWidth: t,
              inputHeight: n
            })
          })]
        }), X.jsx(vi, {
          open: P,
          title: `编辑提示词 - 生图`,
          onClose: () => F(false),
          children: r
        })]
      });
    })()]
  });
});