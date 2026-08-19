// TODO(全局, 无需 import): data, selected, width, updateNodeData, setEdges, setNodes, getNode, n, r, i, aspectRatio, imageSize, quality, left, de, ke, le, prompt, xe, m, me, g, b, ve, ae, fe, selectedModel, ee, k, handleType, q, images, texts, url, sourceNodeId, o, s, assetName, label, text, u, l, audios, expanded, useThumbnail, ze, nodeId, imageUrlRef, currentImageLength, originalFound, originalLength, useOriginal, urlLength, isHttp, filename, saveAs, subfolder, preferThumbnail, thumbMaxDim, thumbQuality, et, height, style, position, x, p, f, qe, display, rt, isConnected, resourceOrder, selectedContextResources, minHeight, fontSize, lineHeight, padding, margin, border, boxSizing, fontFamily, fontWeight, letterSpacing, tabSize, wordBreak, whiteSpace, overflow, scrollbarGutter, maxHeight, inputHeight, cursor, oe, se, type, auto, low, medium, high, je, value, apiFormat, ye, inputWidth, at, marginTop, visibility
import _cmp_Ti from './Ti.jsx';
import _cmp_Bn from './Bn.jsx';
import _cmp_Ei from './Ei.jsx';
import _cmp__Component15 from './_Component15.jsx';
import _cmp_Ni from './Ni.jsx';
import _cmp__Component18 from './_Component18.jsx';
import _cmp__Component20 from './_Component20.jsx';
import _cmp_Fi from './Fi.jsx';
import _cmp_Ii from './Ii.jsx';
import _cmp__Component10 from './_Component10.jsx';
import _cmp_So from './So.jsx';
import { id, We, nn, e, ta, ra, ue, ea, Zi, Ao, Eo, ce, G, pe, h, Da, Na, Se, Fa, he, Ce, _e, Ae, j, Me, _, S, ge, ne, E, w, N, A, I, F, R, C, P, L, Lt, Qt, Ne, Va, Tr, wi, ei, J, Be, Re, xo, V, Pe, Ie, Zr, xi, Le, Ye, Xe, $e, nt, Qe, it, y, d, te, Oe, Je, Fe, Ve, He, Y, ie, ti, Ue, K, B, Ge, U, H, O, W, Co, wo, Do, Oo, D, To, Fn, Ke, M, we, ma, sa, ca, va, ha, Pa, Ee, De, be, re, X, _Component2, _Component8, _Component9, Ze, _Component0, Te, _Component6, _Component16, Gt, _Component17, _Component19, T, _Component21 } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
var jo = Z.memo(({
  id: e,
  data: t,
  selected: n,
  width: r
}) => {
  let {
    updateNodeData: i,
    setEdges: a,
    setNodes: o,
    getNode: c
  } = We();
  let l = nn();
  let u = Z.useRef(null);
  let d = Z.useRef(null);
  let [f, p] = Z.useState(() => {
    return t.resourceOrder || [];
  });
  let [m, h] = Z.useState(t.prompt || ``);
  let [g, _] = Z.useState(() => {
    let e = localStorage.getItem(`mutiwindow_prompt_aspectRatio`);
    return t.aspectRatio || e || `Auto`;
  });
  let [y, b] = Z.useState(() => {
    let e = localStorage.getItem(`mutiwindow_prompt_imageSize`);
    return t.imageSize || e || `1K`;
  });
  let [x, S] = Z.useState(() => {
    let e = localStorage.getItem(`mutiwindow_prompt_quality`);
    return t.quality || e || `auto`;
  });
  Z.useEffect(() => {
    let n = localStorage.getItem(`mutiwindow_prompt_aspectRatio`);
    let r = t.aspectRatio || n || `Auto`;
    if (r !== t.aspectRatio) {
      i(e, {
        aspectRatio: r
      });
    }
  }, []);
  Z.useEffect(() => {
    let n = localStorage.getItem(`mutiwindow_prompt_imageSize`);
    let r = t.imageSize || n || `1K`;
    if (r !== t.imageSize) {
      i(e, {
        imageSize: r
      });
    }
  }, []);
  Z.useEffect(() => {
    let n = localStorage.getItem(`mutiwindow_prompt_quality`);
    let r = t.quality || n || `auto`;
    if (r !== t.quality) {
      i(e, {
        quality: r
      });
    }
  }, []);
  let [C, w] = Z.useState(false);
  let E = Z.useRef(null);
  let [D, O] = Z.useState(false);
  let [k, A] = Z.useState(false);
  let [j, M] = Z.useState(false);
  let N = Z.useRef(null);
  let [P, F] = Z.useState(false);
  let I = Z.useRef(null);
  let [L, ee] = Z.useState(false);
  let R = Z.useRef(null);
  let [te, ne] = Z.useState(t.expanded === undefined ? true : t.expanded);
  let [B, re] = Z.useState(false);
  let [V, H] = Z.useState(-1);
  let [ie, ae] = Z.useState(t.selectedContextResources || []);
  let [U, oe] = Z.useState({
    top: 0,
    left: 0
  });
  let [se, W] = Z.useState(null);
  let G = Z.useRef(0);
  let ce = Z.useRef(``);
  let le = Z.useRef(false);
  let [, ue] = Z.useReducer(e => {
    return e + 1;
  }, 0);
  Z.useEffect(() => {
    ta(`/api`).catch(() => {});
  }, []);
  Z.useEffect(() => {
    return ra(() => {
      return ue();
    });
  }, []);
  let de = ea();
  let fe = Z.useMemo(() => {
    let e = (t.drawingModel || ``).split(`
`).map(e => {
      return e.trim();
    }).filter(Boolean);
    let n = Zi(`image`);
    let r = new Set();
    let i = [];
    let a = e => {
      let t = (e || ``).trim();
      if (!!t && !r.has(t)) {
        r.add(t);
        i.push(t);
      }
    };
    e.forEach(a);
    n.forEach(a);
    return i;
  }, [t.drawingModel, de]);
  let pe = (e, t) => {
    let n = ke.current;
    let r = Ao(e);
    if (n) {
      n.innerHTML = r;
      if (t !== undefined) {
        requestAnimationFrame(() => {
          if (ke.current) {
            ke.current.focus();
            Eo(ke.current, t);
          }
        });
      }
    }
    ce.current = r;
    G.current = t ?? e.length;
  };
  let me = (t, n) => {
    let r = n ?? t.length;
    le.current = true;
    pe(t, r);
    h(t);
    i(e, {
      prompt: t
    });
  };
  let [he, ge] = Z.useState(t.selectedModel || localStorage.getItem(`mutiwindow_prompt_model`) || t.drawingModel && t.drawingModel.split(`
`)[0].trim() || ``);
  let [_e, ve] = Z.useState(t.apiFormat || `auto`);
  let [ye, be] = Z.useState(1);
  let [xe, Se] = Z.useState(() => {
    return Da().filter(e => {
      return e.enabled && e.category === `image`;
    });
  });
  Z.useEffect(() => {
    return Na(e => {
      Se(e.filter(e => {
        return e.enabled && e.category === `image`;
      }));
    });
  }, []);
  let Ce = Fa(he);
  let we = Ce ? xe.find(e => {
    return e.id === Ce;
  }) : null;
  let Ee = t.presetPrompts || [];
  let De = e => {
    if (!e) {
      return;
    }
    let t = m ? `${m}, ${e}` : e;
    me(t, t.length);
  };
  let Oe = Z.useRef(null);
  let ke = Z.useRef(null);
  let K = Z.useRef(null);
  let Ae = Z.useMemo(() => {
    let e = (he || ``).toLowerCase();
    let t = e.includes(`banana`) || e.includes(`gemini`) || e.includes(`香蕉`) || e.includes(`芭蕉`);
    return _e === `gemini` || _e === `auto` && t;
  }, [he, _e]);
  let je = Z.useMemo(() => {
    if (Ae) {
      if (j) {
        return [`Auto`, `1:1`, `1:4`, `1:8`, `2:3`, `3:2`, `3:4`, `4:1`, `4:3`, `4:5`, `5:4`, `8:1`, `9:16`, `16:9`, `21:9`, `9:21`, `1:3`, `3:1`, `2:1`, `1:2`];
      } else {
        return Array.from(new Set([`Auto`, `1:1`, `16:9`, `9:16`, `3:2`, `2:3`, `4:3`, `3:4`, `21:9`, g]));
      }
    } else {
      return [`Auto`, `1:1`, `16:9`, `9:16`, `3:2`, `2:3`, `4:3`, `3:4`, `21:9`, `9:21`, `1:3`, `3:1`, `2:1`, `1:2`];
    }
  }, [Ae, j, g]);
  let Me = Z.useRef(Ao(t.prompt || ``));
  ce.current = ce.current || Me.current;
  Z.useEffect(() => {
    let e = t.prompt || ``;
    requestAnimationFrame(() => {
      return pe(e, e.length);
    });
  }, []);
  Z.useLayoutEffect(() => {
    let e = ke.current;
    if (!e) {
      return;
    }
    if (le.current) {
      le.current = false;
      return;
    }
    let t = ce.current;
    if (t && e.innerHTML !== t) {
      let n = e.scrollTop;
      e.innerHTML = t;
      e.scrollTop = n;
      try {
        let t = Math.min(G.current, (e.textContent || ``).length);
        Eo(e, t);
        G.current = t;
      } catch {}
    } else if (!t && Me.current && !e.innerHTML) {
      e.innerHTML = Me.current;
      ce.current = Me.current;
    }
  });
  Z.useEffect(() => {
    let e = t.prompt || ``;
    if (e !== m) {
      let t = ke.current;
      pe(e, t && document.activeElement === t ? Math.min(G.current, e.length) : e.length);
      h(e);
    }
    if (t.aspectRatio !== undefined) {
      _(t.aspectRatio);
    }
    if (t.imageSize !== undefined) {
      b(t.imageSize);
    }
    if (t.quality !== undefined) {
      S(t.quality);
    }
    if (t.selectedModel !== undefined) {
      ge(t.selectedModel);
    }
    if (t.apiFormat !== undefined) {
      ve(t.apiFormat);
    }
    if (t.selectedContextResources) {
      ae(t.selectedContextResources);
    }
    if (t.expanded !== undefined) {
      ne(t.expanded);
    }
  }, [t.prompt, t.aspectRatio, t.imageSize, t.quality, t.selectedModel, t.apiFormat, t.selectedContextResources, t.expanded]);
  Z.useEffect(() => {
    if (!Fa(he)) {
      if (fe.length !== 0 && (!he || !fe.includes(he))) {
        ge(fe[0]);
        i(e, {
          selectedModel: fe[0]
        });
      }
    }
  }, [fe, he, e, i]);
  Z.useEffect(() => {
    let e = e => {
      if (E.current && !E.current.contains(e.target)) {
        w(false);
      }
      if (N.current && !N.current.contains(e.target)) {
        A(false);
      }
      if (I.current && !I.current.contains(e.target)) {
        F(false);
      }
      if (R.current && !R.current.contains(e.target)) {
        ee(false);
      }
    };
    if (C || k || P || L) {
      document.addEventListener(`mousedown`, e, true);
    }
    return () => {
      document.removeEventListener(`mousedown`, e, true);
    };
  }, [C, k, P, L]);
  let q = Lt({
    handleType: `target`
  });
  let Ne = Qt(Z.useMemo(() => {
    return q.map(e => {
      return e.source;
    });
  }, [q]));
  let Pe = (() => {
    if (!Ne) {
      return {
        images: [],
        texts: []
      };
    }
    let e = Array.isArray(Ne) ? Ne : [Ne];
    let t = [];
    let n = [];
    let r = [];
    q.forEach(i => {
      let a = e.find(e => {
        return e?.id === i?.source;
      });
      if (!a) {
        return;
      }
      if (a?.data?.imageUrl) {
        t.push({
          id: a.id,
          url: a.data.imageUrl,
          sourceNodeId: a.id
        });
      }
      if (a?.type === `videoExtractNode` && a?.data?.extractedImages) {
        if (i && i.sourceHandle && i.sourceHandle.startsWith(`frame-`)) {
          let e = parseInt(i.sourceHandle.replace(`frame-`, ``), 10);
          if (!(a.data.hiddenIndices || []).includes(e)) {
            let n = a.data.allExtractedImages;
            if (n && n[e]) {
              t.push({
                id: `${a.id}-ext-${e}`,
                url: n[e],
                sourceNodeId: a.id
              });
            }
          }
        } else {
          a.data.extractedImages.forEach((e, n) => {
            t.push({
              id: `${a.id}-ext-${n}`,
              url: e,
              sourceNodeId: a.id
            });
          });
        }
      }
      if (a?.type === `imageBoxNode` && Array.isArray(a.data?.images)) {
        let e = a.data.images;
        let n = a.data.selectedIds || [];
        if (n.length > 0) {
          let r = new Set(n);
          e.forEach((e, n) => {
            if (e?.url && r.has(e.id)) {
              t.push({
                id: `${a.id}-box-${n}`,
                url: e.url,
                sourceNodeId: a.id
              });
            }
          });
        } else {
          let n = e[typeof a.data.activeIndex == `number` ? a.data.activeIndex : 0]?.url;
          if (n) {
            t.push({
              id: `${a.id}-box-active`,
              url: n,
              sourceNodeId: a.id
            });
          }
        }
      }
      if (a?.type === `scriptBoxNode` && i?.sourceHandle?.startsWith(`shot-`)) {
        let e = i.sourceHandle.replace(`shot-`, ``);
        let o = (a.data.shots || []).find(t => {
          return t.id === e;
        });
        if (o) {
          let i = a.data.assets || [];
          let s = `${o.description || ``} ${o.prompt || ``} ${o.videoPrompt || ``} ${o.dialogue || ``}`;
          i.forEach(e => {
            if (e?.name && Va(s, e.name)) {
              if (e.imageUrl) {
                t.push({
                  id: `${a.id}-asset-${e.id}`,
                  url: e.imageUrl,
                  sourceNodeId: a.id,
                  assetName: e.name
                });
              }
              if (e.category === `character` && e.audioUrl) {
                n.push({
                  id: `${a.id}-audio-${e.id}`,
                  url: e.audioUrl,
                  sourceNodeId: a.id,
                  assetName: e.name
                });
              }
            }
          });
          if (o.usePrevShotImageRef || o.usePrevShotVideoTail) {
            let n = o.selectedTailFrameVariantId || `original`;
            let r = (Array.isArray(o.prevTailFrameVariants) && o.prevTailFrameVariants.length > 0 ? o.prevTailFrameVariants : []).find(e => {
              return e?.id === n && e?.imageUrl;
            });
            if (r) {
              t.push({
                id: `${a.id}-prevsel-${e}-${n}`,
                url: r.imageUrl,
                sourceNodeId: a.id
              });
            } else if (Array.isArray(o.prevShotImageRefUrls) && o.prevShotImageRefUrls.length > 0) {
              t.push({
                id: `${a.id}-prevcache-${e}-0`,
                url: o.prevShotImageRefUrls[0],
                sourceNodeId: a.id
              });
            }
          }
          let c = o.prompt || ``;
          if (c && (o.gridMode === 4 || o.gridMode === 9)) {
            let e = o.gridMode;
            c = `${c}。根据当前的描述内容，严格遵循故事内容提示，做出${e}宫格构图的故事内容，${e}个不同的画面，高细节，一致的风格，连贯的叙事，${e}宫格之间无缝拼接`;
          }
          if (o.usePrevShotImageRef || o.usePrevShotVideoTail) {
            let e = [];
            if (o.usePrevShotImageRef) {
              e.push(`画面构图、角色姿态与风格、色彩光影必须与传入的上一镜参考图高度连续，不能出现跳切`);
            }
            if (o.usePrevShotVideoTail) {
              e.push(`本镜的起始画面必须与上一视频的结尾帧（尾帧）视觉完全连续：人物位置、姿态、表情、服装、场景光线和色彩完全一致，不得发生瞬移或跳切`);
            }
            if (e.length > 0) {
              c = `${c}${c && !c.endsWith(`。`) && !c.endsWith(`；`) ? `。` : ``}${e.join(`；`)}。`;
            }
          }
          if (c) {
            r.push({
              id: `${a.id}-shot-${e}`,
              sourceNodeId: a.id,
              label: `分镜${o.index}${o.duration ? `（${o.duration}）` : ``}`,
              text: c
            });
          }
        }
      }
      let o = new Set([`promptNode`, `imageNode`, `imageBoxNode`, `videoNode`, `sd2VideoNode`, `discountVideoNode`, `gridSplitNode`, `gridMergeNode`, `cropNode`, `urlToImageNode`, `fileToUrlNode`, `panoramaNode`, `videoExtractNode`, `scriptBoxNode`]);
      if (a?.data?.text && !o.has(a.type)) {
        let e = String(a.data.text).trim();
        if (a.type === `textNode` && (/^https?:\/\/[^\s]+$/.test(e) || e.startsWith(`data:image/`))) {
          t.push({
            id: a.id,
            url: e,
            sourceNodeId: a.id
          });
        } else {
          r.push({
            id: a.id,
            sourceNodeId: a.id,
            label: a?.type === `audioNode` ? `听音断句结果` : a.data.label || `文本节点`,
            text: a.data.text
          });
        }
      }
    });
    let i = new Map();
    let a = new Map();
    let o = new Set();
    let s = [];
    t.forEach(e => {
      if (e.assetName) {
        let t = a.get(e.url);
        if (t === undefined) {
          t = a.size + 1;
          a.set(e.url, t);
          o.add(e.url);
          s.push(e);
        }
        i.set(e.assetName, t);
      } else if (!o.has(e.url)) {
        o.add(e.url);
        s.push(e);
      }
    });
    let c = new Set();
    let l = [];
    let u = new Set();
    n.forEach(e => {
      if (e.assetName) {
        if (u.has(e.id) || c.has(e.url)) {
          return;
        }
        u.add(e.id);
        c.add(e.url);
        l.push(e);
      } else if (!c.has(e.url)) {
        c.add(e.url);
        l.push(e);
      }
    });
    if (i.size > 0) {
      return {
        images: s,
        audios: l,
        texts: r.map(e => {
          let t = e.text || ``;
          i.forEach((e, n) => {
            let r = `（@图片${e}）`;
            let i = RegExp(`@${n}(?!（@图片)`, `g`);
            t = t.replace(i, `@${n}${r}`);
          });
          return {
            ...e,
            text: t
          };
        })
      };
    } else {
      return {
        images: s,
        audios: l,
        texts: r
      };
    }
  })();
  let Fe = () => {
    let t = !te;
    ne(t);
    i(e, {
      expanded: t
    });
    requestAnimationFrame(() => {
      return l(e);
    });
  };
  let J = t.imageUrl;
  let Ie = t.imageUrlRef;
  let Le = t.imageUrlThumbRef;
  let Re = t.thumbnailUrl;
  let {
    useThumbnail: ze
  } = Tr();
  let Be = wi(r ?? t._styleWidth ?? 420);
  let Ve = ze ? ei(J, Be, `image`) || Re || J : J || Re;
  let He = t.loading;
  let Y = t.errorMessage;
  let Ue = (e, t = false) => {
    let n = ke.current;
    let r = `@${e} `;
    let i;
    if (n) {
      i = xo(n);
    } else {
      i = m.length;
    }
    let a;
    let o;
    if (t && V >= 0) {
      a = m.substring(0, V);
      o = m.substring(V + 1);
    } else {
      a = m.substring(0, i);
      o = m.substring(i);
    }
    let s = a + r + o;
    let c = a.length + r.length;
    me(s, c);
    requestAnimationFrame(() => {
      let e = ke.current;
      if (e) {
        e.focus();
        Eo(e, c);
      }
    });
  };
  let Ge = Z.useMemo(() => {
    return [...Pe.images.map((e, t) => {
      return `图片${t + 1}`;
    }), ...Pe.texts.map((e, t) => {
      return `文本${t + 1}`;
    })];
  }, [Pe.images, Pe.texts]);
  let Ke = e => {
    if (e.type.startsWith(`image`)) {
      return `图片${Pe.images.findIndex(t => {
        return t.id === e.id;
      }) + 1}`;
    } else {
      if (e.type.startsWith(`text`)) {
        return `文本${Pe.texts.findIndex(t => {
          return t.id === e.id;
        }) + 1}`;
      } else {
        return `素材1`;
      }
    }
  };
  let qe = async n => {
    n.stopPropagation();
    if (!J) {
      return;
    }
    let r = J;
    let i = false;
    console.log(`[PromptNode] 下载开始:`, {
      nodeId: e,
      imageUrlRef: Ie,
      currentImageLength: J?.length
    });
    if (Ie) {
      try {
        let e = await Zr.getConfig(Ie);
        console.log(`[PromptNode] 读取原图结果:`, {
          imageUrlRef: Ie,
          originalFound: !!e,
          originalLength: e?.length
        });
        if (e && typeof e == `string` && e.length > 10000) {
          r = e;
          i = true;
          console.log(`[PromptNode] 下载使用原图成功, size:`, e.length);
        } else {
          console.log(`[PromptNode] 原图未找到或数据异常，使用当前图片`);
        }
      } catch (e) {
        console.warn(`[PromptNode] 获取原图失败，使用当前图片:`, e);
      }
    } else {
      console.log(`[PromptNode] 无原图引用(imageUrlRef)，下载当前图片`);
    }
    console.log(`[PromptNode] 开始下载:`, {
      useOriginal: i,
      urlLength: r.length,
      isHttp: r.startsWith(`http`)
    });
    try {
      if (typeof chrome < `u` && chrome.downloads) {
        chrome.downloads.download({
          url: r,
          filename: `yimao/generated-${Date.now()}.png`,
          saveAs: false
        });
      } else {
        let e = await (await fetch(r)).blob();
        let t = window.URL.createObjectURL(e);
        let n = document.createElement(`a`);
        n.href = t;
        n.download = `generated-${Date.now()}.png`;
        document.body.appendChild(n);
        n.click();
        document.body.removeChild(n);
        setTimeout(() => {
          return window.URL.revokeObjectURL(t);
        }, 1000);
      }
    } catch (e) {
      console.error(`[PromptNode] 下载失败:`, e);
      if (t.onShowToast) {
        t.onShowToast(`下载失败，可能因跨域限制`);
      }
      window.open(r, `_blank`);
    }
  };
  let Je = async n => {
    let r = n.target.files?.[0];
    if (!r) {
      return;
    }
    try {
      let i = await xi(r, {
        subfolder: `canvas/upload`,
        preferThumbnail: true,
        thumbMaxDim: 480,
        thumbQuality: 75
      });
      if (i.url && /^https?:\/\//i.test(i.url)) {
        if (t.onAddImage) {
          t.onAddImage(e, i.url, i.url, i.thumbnailUrl || i.url);
        }
        n.target.value = ``;
        return;
      }
    } catch (e) {
      console.warn(`[PromptNode] urlifyAsset failed, fallback to base64:`, e);
    }
    let i = new FileReader();
    i.onload = n => {
      let r = n.target?.result;
      if (t.onAddImage) {
        t.onAddImage(e, r, Ie, Le);
      }
    };
    i.readAsDataURL(r);
    n.target.value = ``;
  };
  let Ye = (e => {
    if (!e || e === `Auto`) {
      return null;
    }
    let t = e.match(/^(\d+(?:\.\d+)?)\s*[:：]\s*(\d+(?:\.\d+)?)$/);
    if (!t) {
      return null;
    }
    let n = parseFloat(t[1]);
    let r = parseFloat(t[2]);
    if (!n || !r) {
      return null;
    } else {
      return n / r;
    }
  })(g);
  let Xe = Ye !== null;
  let Qe = Xe && Ye ? Math.round(Math.sqrt(Ye) * 360) : null;
  let $e = Xe && Ye ? Math.round(360 / Math.sqrt(Ye)) : null;
  let et = Z.useRef($e);
  let nt = Z.useRef(null);
  let [rt, it] = Z.useState(null);
  Z.useEffect(() => {
    let t = et.current;
    et.current = $e;
    if (nt.current !== null) {
      cancelAnimationFrame(nt.current);
      nt.current = null;
    }
    if (Qe === null || $e === null) {
      it(null);
      o(t => {
        return t.map(t => {
          if (t.id !== e || t.style?.height !== undefined) {
            return t;
          }
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
        });
      });
      return;
    }
    let n = c(e);
    let r = n?.style?.width ?? n?.width ?? 360;
    let i = n?.position.x ?? 0;
    let a = n?.position.y ?? 0;
    let s = t ?? $e;
    let l = Qe;
    let u = $e;
    if (t === null || Math.round(r) === l && Math.round(s) === u) {
      it(null);
      o(t => {
        return t.map(t => {
          if (t.id !== e) {
            return t;
          }
          let n = t.style?.width ?? t.width ?? 360;
          if (Math.round(n) === l && t.style?.height === undefined) {
            return t;
          }
          let r = l - n;
          let i = {
            ...t.style,
            width: l
          };
          delete i.height;
          return {
            ...t,
            width: l,
            height: undefined,
            style: i,
            position: {
              x: t.position.x - r / 2,
              y: t.position.y
            }
          };
        });
      });
      return;
    }
    let d = e => {
      return 1 - (1 - e) ** 3;
    };
    let f = a + s;
    let p = i + r / 2;
    let m = performance.now();
    let h = t => {
      let n = Math.min(1, (t - m) / 360);
      let i = d(n);
      let a = r + (l - r) * i;
      let c = s + (u - s) * i;
      it(c);
      o(t => {
        return t.map(t => {
          if (t.id !== e) {
            return t;
          }
          let n = {
            ...t.style,
            width: a
          };
          delete n.height;
          return {
            ...t,
            width: a,
            height: undefined,
            style: n,
            position: {
              x: p - a / 2,
              y: f - c
            }
          };
        });
      });
      if (n < 1) {
        nt.current = requestAnimationFrame(h);
      } else {
        nt.current = null;
        it(null);
        o(t => {
          return t.map(t => {
            if (t.id !== e) {
              return t;
            }
            let n = {
              ...t.style,
              width: l
            };
            delete n.height;
            return {
              ...t,
              width: l,
              height: undefined,
              style: n,
              position: {
                x: p - l / 2,
                y: f - u
              }
            };
          });
        });
      }
    };
    nt.current = requestAnimationFrame(h);
    return () => {
      if (nt.current !== null) {
        cancelAnimationFrame(nt.current);
        nt.current = null;
      }
    };
  }, [Qe, $e, e]);
  let at = te && !B ? Math.max(220, (Number(t.inputHeight) || 80) + 140) : 0;
  const Component237 = `button`;
  const Component238 = `button`;
  const Component239 = `button`;
  const Component240 = `button`;
  const Component241 = `button`;
  const Component242 = `button`;
  const Component243 = `div`;
  const Component244 = `div`;
  const Component245 = `input`;
  const Component246 = `img`;
  const Component247 = `div`;
  const Component248 = `button`;
  const Component249 = `div`;
  const Component250 = `div`;
  const Component251 = `div`;
  const Component252 = `div`;
  const Component253 = `div`;
  const Component353 = `div`;
  const Component354 = `div`;
  const Component355 = `div`;
  return <Component355 ref={u} className={`relative flex flex-col items-center group/node w-full min-w-[160px] min-h-[160px] ${Xe ? `h-auto` : `h-full`} ${n ? `z-50` : `z-10`}`}>
      <_cmp_Ti id={e} data={t} defaultTitle={`生图节点`} icon={<_Component2 size={11} className={`text-gray-500`} />} />
      {!He && <Component244 className={`absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`}>
          <Component243 className={`flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`}>
            {Pe.images.length === 0 && <Component237 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`上传参考图`} onClick={e => {
          e.stopPropagation();
          Oe.current?.click();
        }}>
                <_Component8 size={14} />
              </Component237>}
            {J && <Q.Fragment>
                <Component238 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`放大`} onClick={n => {
            n.stopPropagation();
            if (t.onZoom) {
              t.onZoom(e, Ie, J);
            }
          }}>
                  <_Component9 size={14} />
                </Component238>
                <Component239 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`裁剪`} onClick={n => {
            n.stopPropagation();
            if (t.onCrop) {
              t.onCrop(e, J, Ie);
            }
          }}>
                  <Ze size={14} />
                </Component239>
                <Component240 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`编辑`} onClick={n => {
            n.stopPropagation();
            if (t.onEdit) {
              t.onEdit(e, Ie, J);
            }
          }}>
                  <_Component0 size={14} />
                </Component240>
                <Component241 className={`p-1.5 text-gray-400 hover:text-blue-400 hover:bg-[#333] rounded-md`} title={`发送到左侧网站`} onClick={e => {
            e.stopPropagation();
            if (t.onSendToActiveTab) {
              t.onSendToActiveTab(J);
            }
          }}>
                  <Te size={14} />
                </Component241>
                <_cmp_Bn url={J} fallbackExt={`png`} onToast={e => {
            return t.onShowToast?.(e);
          }} />
                <Component242 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`下载`} onClick={qe}>
                  <_Component6 size={14} />
                </Component242>
              </Q.Fragment>}
          </Component243>
        </Component244>}
      <Component245 type={`file`} ref={Oe} style={{
      display: `none`
    }} accept={`image/*`} onChange={Je} />
      <Component353 className={`relative w-full ${Xe ? `` : `flex-1 min-h-0`}`}>
        <_cmp_Ei visible={!!n} minWidth={160} minHeight={160} keepAspectRatio={Xe} />
        <Component253 className={`relative bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-colors duration-300 cursor-pointer group/image w-full flex flex-col
          ${Xe ? `` : `h-full`}
          ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}
        `} style={Xe ? rt === null ? Ye ? {
        aspectRatio: String(Ye)
      } : undefined : {
        height: rt
      } : undefined} onClick={Fe}>
          <Component252 className={`flex items-center justify-center absolute inset-0 rounded-xl overflow-hidden ${J ? `` : `bg-[#0d0c0c]`}`}>
            {J && <Component246 src={Ve} alt={`Generated Content`} loading={`lazy`} decoding={`async`} className={`max-w-full w-full h-full object-contain block ${He ? `opacity-50 blur-sm` : ``}`} draggable={false} onError={e => {
            let t = e.currentTarget;
            if (J && t.src !== J) {
              t.src = J;
            }
          }} onDoubleClick={n => {
            n.stopPropagation();
            if (t.onZoom) {
              t.onZoom(e, Ie, J);
            }
          }} />}
            {He && <_cmp__Component15 label={`生图中...`} backgroundUrl={J || Pe.images[0]?.url}>
                <_cmp_Ni category={`image`} />
              </_cmp__Component15>}
            {Y && !He && <Component249 className={`absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-500 z-10 bg-[#1a1a1a] p-4 text-center`}>
                <_Component16 size={32} />
                <Component247 className={`text-xs font-medium max-w-full break-words`}>
                  {Y}
                </Component247>
                <Component248 className={`text-[10px] bg-[#333] hover:bg-[#444] text-gray-300 px-3 py-1 rounded-full border border-gray-600 transition-colors`} onClick={e => {
              e.stopPropagation();
            }}>{`请检查设置或重试`}</Component248>
              </Component249>}
            {!J && !He && !Y && <Component250 className={`flex flex-col items-center justify-center absolute inset-0 bg-[#151515] pointer-events-none`}>
                <_Component2 size={80} className={`text-gray-700`} strokeWidth={1.2} />
              </Component250>}
            <Component251 className={`absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100 pointer-events-none`} />
          </Component252>
        </Component253>
        {(() => {
        let n = [...Pe.images.map(e => {
          return {
            ...e,
            isConnected: true
          };
        }), ...ie.filter(e => {
          return e.type.startsWith(`image`) && !Pe.images.some(t => {
            return t.id === e.id;
          });
        }).map(e => {
          return {
            ...e,
            isConnected: false
          };
        })].sort((e, t) => {
          let n = f.indexOf(e.id);
          let r = f.indexOf(t.id);
          if (n === -1 && r === -1) {
            return 0;
          } else if (n === -1) {
            return 1;
          } else if (r === -1) {
            return -1;
          } else {
            return n - r;
          }
        });
        let r = (t, r) => {
          if (!t || !r || t === r) {
            return;
          }
          let a = n.map(e => {
            return e.id;
          });
          let o = a.indexOf(t);
          let s = a.indexOf(r);
          if (o === -1 || s === -1) {
            return;
          }
          let c = [...a];
          c.splice(o, 1);
          c.splice(s, 0, t);
          p(c);
          i(e, {
            resourceOrder: c
          });
        };
        let o = t.inputWidth ? `${t.inputWidth}px` : undefined;
        let c = t.inputHeight ? `${t.inputHeight}px` : `80px`;
        const Component262 = `div`;
        const Component263 = `div`;
        const Component264 = `span`;
        const Component265 = `div`;
        const Component266 = `button`;
        const Component267 = `div`;
        const Component276 = `div`;
        const Component277 = `div`;
        const Component278 = `div`;
        const Component279 = `div`;
        const Component280 = `div`;
        const Component281 = `div`;
        const Component282 = `span`;
        const Component283 = `button`;
        const Component284 = `div`;
        const Component285 = `button`;
        const Component286 = `div`;
        const Component287 = `div`;
        const Component288 = `div`;
        const Component289 = `button`;
        const Component290 = `button`;
        const Component291 = `button`;
        const Component292 = `div`;
        const Component293 = `div`;
        const Component294 = `div`;
        const Component295 = `button`;
        const Component296 = `div`;
        const Component297 = `div`;
        const Component298 = `div`;
        const Component299 = `div`;
        const Component300 = `div`;
        const Component301 = `span`;
        const Component302 = `span`;
        const Component303 = `span`;
        const Component304 = `button`;
        const Component325 = `div`;
        const Component326 = `div`;
        const Component327 = `div`;
        const Component328 = `span`;
        const Component329 = `button`;
        const Component330 = `div`;
        const Component331 = `button`;
        const Component332 = `div`;
        const Component333 = `div`;
        const Component334 = `div`;
        const Component335 = `div`;
        const Component336 = `button`;
        const Component337 = `div`;
        const Component338 = `span`;
        const Component339 = `button`;
        const Component340 = `button`;
        const Component341 = `div`;
        const Component342 = `div`;
        const Component343 = `span`;
        const Component344 = `div`;
        const Component345 = `div`;
        const Component346 = `button`;
        const Component347 = `div`;
        const Component348 = `div`;
        const Component349 = `div`;
        const Component350 = `div`;
        const Component351 = `div`;
        let u = <Component351 className={`space-y-3`}>
              <Component280 className={`flex flex-col gap-2 mb-2`}>
                {(n.length > 0 || Pe.texts.length > 0) && <Component262 className={`flex flex-wrap gap-2 mb-1`}>
                    {n.map((t, n) => {
                let o = `图片${n + 1}`;
                const Component254 = `img`;
                const Component255 = `div`;
                const Component256 = `button`;
                const Component257 = `div`;
                const Component258 = `div`;
                return <Component258 className={`w-10 h-10 rounded-md overflow-hidden relative group bg-black cursor-grab active:cursor-grabbing nodrag nopan`} title={t.isConnected ? `已连线的图片` : `上传的图片`} draggable={true} onDragStart={e => {
                  e.stopPropagation();
                  d.current = t.id;
                  e.dataTransfer.setData(`text/plain`, t.id);
                  e.dataTransfer.effectAllowed = `move`;
                }} onDragOver={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = `move`;
                }} onDragEnter={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  let n = d.current;
                  if (n && n !== t.id) {
                    r(n, t.id);
                  }
                }} onDrop={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  r(d.current || e.dataTransfer.getData(`text/plain`), t.id);
                  d.current = null;
                }} onDragEnd={() => {
                  d.current = null;
                }} key={`img-${t.id}`}>
                          <Component254 src={ti(t.url, {
                    width: 200
                  })} className={`w-full h-full object-cover opacity-80 pointer-events-none`} loading={`lazy`} decoding={`async`} onError={e => {
                    let n = e.currentTarget;
                    if (t.url && n.src !== t.url) {
                      n.src = t.url;
                    }
                  }} />
                          <Component255 className={`absolute inset-0 bg-blue-500/10 pointer-events-none`} />
                          <Component256 type={`button`} className={`absolute bottom-0 left-0 right-0 bg-blue-500/80 hover:bg-blue-500 text-[8px] text-white text-center py-0.5 truncate cursor-pointer transition-colors`} title={`点击插入 @${o}`} onMouseDown={e => {
                    return e.preventDefault();
                  }} onClick={e => {
                    e.stopPropagation();
                    Ue(o);
                  }}>
                            {o}
                          </Component256>
                          <Component257 className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`} onClick={n => {
                    n.stopPropagation();
                    if (t.isConnected) {
                      a(n => {
                        return n.filter(n => {
                          return n.source !== t.sourceNodeId || n.target !== e;
                        });
                      });
                    } else {
                      let n = ie.filter(e => {
                        return e.id !== t.id;
                      });
                      ae(n);
                      i(e, {
                        selectedContextResources: n
                      });
                    }
                  }}>
                            <Gt size={10} className={`text-white`} />
                          </Component257>
                        </Component258>;
              })}
                    {Pe.texts.map((t, n) => {
                let r = `文本${n + 1}`;
                const Component259 = `span`;
                const Component260 = `div`;
                const Component261 = `div`;
                return <Component261 className={`h-8 px-2 bg-[#2a2a2a] border border-[#444] rounded flex items-center gap-1 text-[10px] text-gray-300 hover:bg-[#333] hover:border-blue-500 hover:text-blue-400 transition-colors cursor-pointer group/text relative`} title={t.text} onClick={e => {
                  e.stopPropagation();
                  Ue(r);
                }} key={`txt-${n}`}>
                          <_Component17 size={10} />
                          <Component259 className={`max-w-[80px] truncate`}>
                            {r}
                            {` (`}
                            {t.label}
                            {`)`}
                          </Component259>
                          <Component260 className={`absolute -top-1 -right-1 p-0.5 bg-black hover:bg-red-500 rounded-full cursor-pointer opacity-0 group-hover/text:opacity-100 transition-all`} onClick={n => {
                    n.stopPropagation();
                    a(n => {
                      return n.filter(n => {
                        return n.source !== t.sourceNodeId || n.target !== e;
                      });
                    });
                  }}>
                            <Gt size={10} className={`text-white`} />
                          </Component260>
                        </Component261>;
              })}
                  </Component262>}
                <Component279 className={`flex items-start gap-2`}>
                  <Component278 className={`flex-1 nodrag relative shrink-0`} ref={K} style={{
                width: B ? `100%` : o,
                height: B ? `100%` : c,
                minHeight: `80px`
              }}>
                    <_cmp__Component18 text={m} names={Ge} placeholder={`描述你想要的画面 (输入 @ 调出素材)...`} scrollTop={U.top} scrollLeft={U.left} className={`absolute inset-0 z-0 custom-scrollbar`} style={{
                  width: `100%`,
                  height: `100%`,
                  fontSize: `15px`,
                  lineHeight: 1.625,
                  padding: 0,
                  margin: 0,
                  border: `none`,
                  boxSizing: `border-box`,
                  fontFamily: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
                  fontWeight: 400,
                  letterSpacing: 0,
                  tabSize: 4,
                  wordBreak: `break-word`,
                  whiteSpace: `pre-wrap`
                }} />
                    <Component263 ref={ke} contentEditable={true} suppressContentEditableWarning={true} spellCheck={false} className={`relative z-10 w-full h-full bg-transparent text-transparent caret-white outline-none custom-scrollbar nodrag nowheel nopan overflow-auto whitespace-pre-wrap`} style={{
                  width: `100%`,
                  height: `100%`,
                  minHeight: `80px`,
                  overflow: `auto`,
                  scrollbarGutter: `stable`,
                  fontSize: `15px`,
                  lineHeight: 1.625,
                  padding: 0,
                  margin: 0,
                  border: `none`,
                  boxSizing: `border-box`,
                  fontFamily: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
                  fontWeight: 400,
                  letterSpacing: 0,
                  tabSize: 4,
                  wordBreak: `break-word`
                }} onInput={n => {
                  let r = n.currentTarget;
                  let a = r.innerText.replace(/\u00a0/g, ` `);
                  let o = xo(r);
                  G.current = o;
                  ce.current = Ao(a);
                  h(a);
                  i(e, {
                    prompt: a
                  });
                  let s = a.substring(0, o);
                  let c = s.lastIndexOf(`@`);
                  if (c >= 0) {
                    let e = s.substring(c + 1);
                    if (e === `` || /^\d+$/.test(e)) {
                      H(c);
                      O(true);
                      W(Co(_cmp_So(r), r));
                    } else {
                      H(-1);
                      O(false);
                      W(null);
                    }
                  } else {
                    H(-1);
                    O(false);
                    W(null);
                  }
                  if (!B && (!t.inputHeight || t.inputHeight <= 200)) {
                    requestAnimationFrame(() => {
                      let n = ke.current;
                      if (!n) {
                        return;
                      }
                      let r = K.current;
                      let a = wo(n, r, {
                        minHeight: 80,
                        maxHeight: 200
                      });
                      if (t.inputHeight !== a) {
                        i(e, {
                          inputHeight: a
                        });
                      }
                    });
                  }
                }} onKeyDown={e => {
                  let t = e.currentTarget;
                  let n = xo(t);
                  G.current = n;
                  if (e.key === `Backspace` || e.key === `Delete`) {
                    let r = window.getSelection();
                    if (!r || r.isCollapsed) {
                      let r = Do(m, Ge, n, e.key);
                      if (r) {
                        e.preventDefault();
                        me(r.text, r.cursor);
                        requestAnimationFrame(() => {
                          return Eo(t, r.cursor);
                        });
                        return;
                      }
                    }
                  }
                  if (e.key === ` `) {
                    let r = Oo(m, n, m.lastIndexOf(`@`, n - 1), Ge);
                    if (r) {
                      e.preventDefault();
                      me(r.text, r.cursor);
                      O(false);
                      W(null);
                      H(-1);
                      requestAnimationFrame(() => {
                        return Eo(t, r.cursor);
                      });
                      return;
                    }
                  }
                  if (e.key === `Enter`) {
                    if (e.ctrlKey || e.metaKey) {
                      return;
                    }
                    let r = Oo(m, n, m.lastIndexOf(`@`, n - 1), Ge);
                    e.preventDefault();
                    let i = (() => {
                      if (r) {
                        return {
                          text: r.text,
                          cursor: r.cursor
                        };
                      }
                      let e = m.substring(0, n);
                      let t = m.substring(n);
                      return {
                        text: `${e}
${t}`,
                        cursor: e.length + 1
                      };
                    })();
                    me(i.text, i.cursor);
                    if (r) {
                      O(false);
                      W(null);
                      H(-1);
                    }
                    requestAnimationFrame(() => {
                      return Eo(t, i.cursor);
                    });
                    return;
                  }
                  if (e.key === `Escape` && D) {
                    O(false);
                    W(null);
                  }
                }} onScroll={e => {
                  return oe({
                    top: e.currentTarget.scrollTop,
                    left: e.currentTarget.scrollLeft
                  });
                }} onWheel={e => {
                  return e.stopPropagation();
                }} onPaste={e => {
                  To(e);
                }} onBlur={() => {
                  let t = ke.current;
                  if (!t) {
                    return;
                  }
                  let n = (t.innerText || ``).replace(/\u00a0/g, ` `);
                  let r = Ao(n);
                  if (t.innerHTML !== r) {
                    t.innerHTML = r;
                  }
                  ce.current = r;
                  if (n !== m) {
                    h(n);
                    i(e, {
                      prompt: n
                    });
                  }
                }} />
                    {D && se && Fn.createPortal(<Component277 className={`fixed w-72 bg-[#222] border border-[#444] rounded-lg shadow-2xl z-[999999] flex flex-col overflow-hidden h-[300px] nopan`} style={{
                  top: se.top,
                  left: se.left
                }} onWheel={e => {
                  return e.stopPropagation();
                }} onMouseDown={e => {
                  return e.preventDefault();
                }} onClick={e => {
                  return e.stopPropagation();
                }}>
                          <Component267 className={`flex items-center justify-between p-2 border-b border-[#333] bg-[#1a1a1a]`}>
                            <Component265 className={`text-xs text-gray-300 font-bold flex items-center gap-2`}>
                              <Component264>{`选择素材引用`}</Component264>
                            </Component265>
                            <Component266 onClick={() => {
                      O(false);
                      W(null);
                    }} className={`text-gray-500 hover:text-white p-1`}>
                              <Gt size={12} />
                            </Component266>
                          </Component267>
                          <Component276 className={`p-2 flex-1 overflow-y-auto custom-scrollbar nowheel nopan nodrag`}>
                            {(() => {
                      let e = [...Pe.images.map(e => {
                        return {
                          id: e.id,
                          url: e.url,
                          type: `image`
                        };
                      }), ...Pe.texts.map(e => {
                        return {
                          id: e.id,
                          url: e.text,
                          type: `text`,
                          label: e.label
                        };
                      })];
                      if (e.length === 0) {
                        const Component268 = `div`;
                        return <Component268 className={`text-center text-gray-500 text-xs py-10`}>{`暂无素材，请先连线`}</Component268>;
                      } else {
                        const Component269 = `img`;
                        const Component270 = `span`;
                        const Component271 = `div`;
                        const Component272 = `span`;
                        const Component273 = `div`;
                        const Component274 = `div`;
                        const Component275 = `div`;
                        return <Component275 className={`grid grid-cols-4 gap-1.5`}>
                                    {e.map(e => {
                            return <Component274 className={`aspect-square bg-[#111] rounded border border-[#333] hover:border-blue-500 cursor-pointer overflow-hidden relative group flex flex-col`} onMouseDown={t => {
                              t.preventDefault();
                              t.stopPropagation();
                              Ue(Ke(e), true);
                              H(-1);
                              O(false);
                              W(null);
                            }} key={e.id}>
                                          {e.type.startsWith(`image`) ? <Component269 src={ti(e.url, {
                                width: 200
                              })} className={`w-full h-full object-cover`} loading={`lazy`} decoding={`async`} onError={t => {
                                let n = t.currentTarget;
                                if (e.url && n.src !== e.url) {
                                  n.src = e.url;
                                }
                              }} /> : <Component271 className={`w-full h-full bg-[#222] flex flex-col items-center justify-center p-1 text-center`}>
                                              <_Component17 size={16} className={`text-blue-400 opacity-80 mb-1`} />
                                              <Component270 className={`text-[8px] text-gray-400 truncate w-full`}>
                                                {e.label}
                                              </Component270>
                                            </Component271>}
                                          <Component273 className={`absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity`}>
                                            <Component272 className={`text-[10px] text-white`}>{`选择`}</Component272>
                                          </Component273>
                                        </Component274>;
                          })}
                                  </Component275>;
                      }
                    })()}
                          </Component276>
                        </Component277>, document.body)}
                  </Component278>
                </Component279>
              </Component280>
              <Component350 className={`flex items-center justify-between mt-2 pt-2 border-t border-[#2a2a2a] nodrag`}>
                <Component334 className={`flex items-center gap-1.5 overflow-visible`}>
                  <Component299 className={`relative nodrag`} ref={E}>
                    <Component283 type={`button`} className={`flex items-center gap-1.5 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`} onMouseDown={e => {
                  e.stopPropagation();
                }} onClick={e => {
                  e.stopPropagation();
                  w(!C);
                }}>
                      <Component281 className={`w-2.5 h-3 border border-current rounded-[2px]`} />
                      <Component282>
                        {g}
                        {` · `}
                        {y}
                        {Ae ? `` : ` · ${{
                      auto: `自动质量`,
                      low: `低质量`,
                      medium: `中质量`,
                      high: `高质量`
                    }[x]}`}
                      </Component282>
                    </Component283>
                    {C && <Component298 className={`absolute bottom-full left-0 mb-1 w-56 bg-[#222] border border-[#333] rounded-lg shadow-xl p-3 z-50 flex flex-col gap-3`} onMouseDown={e => {
                  return e.stopPropagation();
                }} onClick={e => {
                  return e.stopPropagation();
                }}>
                        <Component287>
                          <Component284 className={`text-[10px] text-gray-500 mb-2`}>{`画质`}</Component284>
                          <Component286 className={`flex gap-1.5`}>
                            {[`1K`, `2K`, `4K`].map(t => {
                        return <Component285 type={`button`} className={`flex-1 py-1.5 text-[11px] rounded-md border transition-colors ${y === t ? `bg-[#333] border-[#555] text-white` : `bg-[#1a1a1a] border-transparent text-gray-400 hover:bg-[#2a2a2a]`}`} onMouseDown={e => {
                          e.stopPropagation();
                        }} onClick={() => {
                          w(false);
                          b(t);
                          requestAnimationFrame(() => {
                            i(e, {
                              imageSize: t
                            });
                            localStorage.setItem(`mutiwindow_prompt_imageSize`, t);
                          });
                        }} key={t}>
                                  {t}
                                </Component285>;
                      })}
                          </Component286>
                        </Component287>
                        <Component293>
                          <Component288 className={`text-[10px] text-gray-500 mb-2`}>{`比例`}</Component288>
                          <Component292 className={`flex flex-wrap gap-1.5`}>
                            {je.map(t => {
                        return <Component289 type={`button`} className={`px-3 py-1.5 text-[11px] rounded-md border transition-colors ${g === t ? `bg-[#333] border-[#555] text-white` : `bg-[#1a1a1a] border-transparent text-gray-400 hover:bg-[#2a2a2a]`}`} onMouseDown={e => {
                          e.stopPropagation();
                        }} onClick={() => {
                          w(false);
                          _(t);
                          requestAnimationFrame(() => {
                            i(e, {
                              aspectRatio: t
                            });
                            localStorage.setItem(`mutiwindow_prompt_aspectRatio`, t);
                          });
                        }} key={t}>
                                  {t}
                                </Component289>;
                      })}
                            {Ae && !j && <Component290 type={`button`} className={`px-3 py-1.5 text-[11px] rounded-md border border-transparent bg-[#1a1a1a] text-gray-500 hover:bg-[#2a2a2a] hover:text-gray-400 transition-colors`} onMouseDown={e => {
                        e.stopPropagation();
                      }} onClick={() => {
                        return M(true);
                      }}>{`更多...`}</Component290>}
                            {Ae && j && <Component291 type={`button`} className={`px-3 py-1.5 text-[11px] rounded-md border border-transparent bg-[#1a1a1a] text-gray-500 hover:bg-[#2a2a2a] hover:text-gray-400 transition-colors`} onMouseDown={e => {
                        e.stopPropagation();
                      }} onClick={() => {
                        return M(false);
                      }}>{`收起`}</Component291>}
                          </Component292>
                        </Component293>
                        {!Ae && <Component297>
                            <Component294 className={`text-[10px] text-gray-500 mb-2`}>{`渲染质量`}</Component294>
                            <Component296 className={`flex gap-1.5`}>
                              {[{
                        value: `auto`,
                        label: `自动`
                      }, {
                        value: `low`,
                        label: `低质量`
                      }, {
                        value: `medium`,
                        label: `中质量`
                      }, {
                        value: `high`,
                        label: `高质量`
                      }].map(t => {
                        return <Component295 type={`button`} className={`flex-1 py-1.5 text-[11px] rounded-md border transition-colors ${x === t.value ? `bg-[#333] border-[#555] text-white` : `bg-[#1a1a1a] border-transparent text-gray-400 hover:bg-[#2a2a2a]`}`} onMouseDown={e => {
                          e.stopPropagation();
                        }} onClick={() => {
                          w(false);
                          S(t.value);
                          requestAnimationFrame(() => {
                            i(e, {
                              quality: t.value
                            });
                            localStorage.setItem(`mutiwindow_prompt_quality`, t.value);
                          });
                        }} key={t.value}>
                                    {t.label}
                                  </Component295>;
                      })}
                            </Component296>
                          </Component297>}
                      </Component298>}
                  </Component299>
                  {(!!t.drawingModel && !!(t.drawingModel.split(`
`).filter(e => {
                return e.trim() !== ``;
              }).length > 0) || !!(xe.length > 0)) && <Component326 className={`relative nodrag flex items-center`} ref={N}>
                      <Component300 className={`w-[1px] h-3 bg-[#444] flex-shrink-0 mr-1.5`} />
                      <Component304 className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`} onClick={e => {
                  e.stopPropagation();
                  A(!k);
                }} title={we ? `调度：${we.name}` : he ? `${he}（${ma(he) ? `内置` : `第三方`}）` : `选择模型`}>
                        {we ? <Component301 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border bg-blue-500/20 text-blue-200 border-blue-400/40`}>{`调度`}</Component301> : he && <Component302 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${ma(he) ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                              {ma(he) ? `内置` : `三方`}
                            </Component302>}
                        <Component303 className={`whitespace-nowrap`}>
                          {we ? we.name : he || `选择模型`}
                        </Component303>
                      </Component304>
                      {k && <Component325 className={`absolute bottom-full left-0 mb-1 min-w-[17rem] w-max max-w-[29rem] bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 block max-h-60 overflow-y-auto custom-scrollbar nowheel nopan nodrag`} onClick={e => {
                  return e.stopPropagation();
                }}>
                          {(() => {
                    let t = fe;
                    let n = t.filter(e => {
                      return ma(e);
                    }).sort((e, t) => {
                      return e.localeCompare(t);
                    });
                    let r = t.filter(e => {
                      return !ma(e);
                    }).sort((e, t) => {
                      return e.localeCompare(t);
                    });
                    let a = (t, n, r) => {
                      let a = r ? sa(t) : null;
                      let o = r ? ca(t) : null;
                      let s = va(t, he === t);
                      const Component305 = `span`;
                      const Component306 = `span`;
                      const Component307 = `span`;
                      const Component308 = `span`;
                      const Component309 = `div`;
                      return <Component309 role={`button`} className={s.className} title={s.title} onClick={() => {
                        if (!s.disabled) {
                          ge(t);
                          i(e, {
                            selectedModel: t
                          });
                          localStorage.setItem(`mutiwindow_prompt_model`, t);
                          A(false);
                        }
                      }} key={`${r ? `b` : `o`}-${n}`}>
                                  <Component305 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${r ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                                    {r ? `内置` : `三方`}
                                  </Component305>
                                  <Component306 className={`flex-1 whitespace-nowrap`}>
                                    {t}
                                  </Component306>
                                  {a !== null && <Component308 className={`shrink-0 inline-flex items-center gap-0.5 text-[10px] text-orange-400 tabular-nums`}>
                                      <_Component19 className={`w-2.5 h-2.5`} strokeWidth={2.5} />
                                      <Component307>
                                        {ha(a)}
                                        {o ? `/${o}` : ``}
                                      </Component307>
                                    </Component308>}
                                </Component309>;
                    };
                    const Component310 = `span`;
                    const Component311 = `span`;
                    const Component312 = `span`;
                    const Component313 = `div`;
                    const Component318 = `div`;
                    const Component319 = `span`;
                    const Component320 = `span`;
                    const Component321 = `span`;
                    const Component322 = `div`;
                    const Component323 = `div`;
                    const Component324 = `div`;
                    return <Q.Fragment>
                                {xe.length > 0 && <Q.Fragment>
                                    <Component313 className={`text-[10px] text-blue-300 mb-1 px-1 flex items-center justify-between`}>
                                      <Component311 className={`flex items-center gap-1`}>
                                        <_Component19 className={`w-2.5 h-2.5`} strokeWidth={2.5} />
                                        <Component310>{`模型调度`}</Component310>
                                      </Component311>
                                      <Component312 className={`ml-auto text-white/90 hover:text-white cursor-pointer transition-colors`} onClick={e => {
                            e.stopPropagation();
                            window.dispatchEvent(new CustomEvent(`mutiwindow-open-schedule-settings`));
                          }}>{`配置 ›`}</Component312>
                                    </Component313>
                                    {xe.map(t => {
                          let n = Pa(t.id);
                          const Component314 = `span`;
                          const Component315 = `span`;
                          const Component316 = `span`;
                          const Component317 = `div`;
                          return <Component317 role={`button`} className={`w-full flex items-center gap-1.5 mb-1 last:mb-0 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors cursor-pointer ${he === n ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} onClick={() => {
                            ge(n);
                            i(e, {
                              selectedModel: n
                            });
                            localStorage.setItem(`mutiwindow_prompt_model`, n);
                            A(false);
                          }} title={`${t.name}（${t.steps.length} 个模型按序重试）`} key={t.id}>
                                          <Component314 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border bg-blue-500/20 text-blue-200 border-blue-400/40`}>{`调度`}</Component314>
                                          <Component315 className={`flex-1 whitespace-nowrap`}>
                                            {t.name}
                                          </Component315>
                                          <Component316 className={`shrink-0 text-[10px] text-gray-500`}>
                                            {t.steps.length}
                                            {` 模型`}
                                          </Component316>
                                        </Component317>;
                        })}
                                    {(n.length > 0 || r.length > 0) && <Component318 className={`h-px bg-[#333] my-1.5`} />}
                                  </Q.Fragment>}
                                {n.length > 0 && <Q.Fragment>
                                    <Component322 className={`text-[10px] text-blue-300 mb-1 px-1 flex items-center gap-1`}>
                                      <Component319>{`✨`}</Component319>
                                      <Component320>{`内置模型`}</Component320>
                                      <Component321 className={`ml-auto text-white/90 hover:text-white cursor-pointer whitespace-nowrap`} onClick={e => {
                            e.stopPropagation();
                            window.dispatchEvent(new CustomEvent(`mutiwindow-open-builtin-settings`));
                            A(false);
                          }} title={`查看内置模型详情`}>{`详情 ›`}</Component321>
                                    </Component322>
                                    {n.map((e, t) => {
                          return a(e, t, true);
                        })}
                                  </Q.Fragment>}
                                {r.length > 0 && <Q.Fragment>
                                    {n.length > 0 && <Component323 className={`h-px bg-[#333] my-1.5`} />}
                                    <Component324 className={`text-[10px] text-gray-500 mb-1 px-1`}>{`第三方 API`}</Component324>
                                    {r.map((e, t) => {
                          return a(e, t, false);
                        })}
                                  </Q.Fragment>}
                              </Q.Fragment>;
                  })()}
                        </Component325>}
                    </Component326>}
                  <Component333 className={`relative nodrag flex items-center`} ref={I}>
                    <Component327 className={`w-[1px] h-3 bg-[#444] flex-shrink-0 mr-1.5`} />
                    <Component329 className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`} onClick={e => {
                  e.stopPropagation();
                  F(!P);
                }} title={`请求格式`}>
                      <Component328 className={`truncate`}>
                        {_e === `auto` ? `自动格式` : _e === `openai` ? `OpenAI格式` : `Gemini格式`}
                      </Component328>
                    </Component329>
                    {P && <Component332 className={`absolute bottom-full left-0 mb-1 w-32 bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 block nodrag`} onClick={e => {
                  return e.stopPropagation();
                }}>
                        <Component330 className={`text-[10px] text-gray-500 mb-2 px-1`}>{`请求格式`}</Component330>
                        {[{
                    label: `自动检测`,
                    value: `auto`
                  }, {
                    label: `OpenAI 格式`,
                    value: `openai`
                  }, {
                    label: `Gemini 格式`,
                    value: `gemini`
                  }].map(t => {
                    return <Component331 className={`w-full block mb-1 last:mb-0 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors truncate ${_e === t.value ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} onClick={() => {
                      ve(t.value);
                      i(e, {
                        apiFormat: t.value
                      });
                      F(false);
                    }} key={t.value}>
                              {t.label}
                            </Component331>;
                  })}
                      </Component332>}
                  </Component333>
                  <_cmp__Component20 category={`image`} presetPrompts={Ee} onApply={De} onToast={e => {
                return t.onShowToast?.(e);
              }} />
                </Component334>
                <Component349 className={`flex items-center gap-3 flex-shrink-0 ml-2`}>
                  {He ? <Component337 className={`flex items-center bg-red-500/10 rounded-full p-1 pl-3 border border-red-500/30 hover:border-red-500/50 transition-colors cursor-pointer group/btn`} onClick={n => {
                n.stopPropagation();
                if (t.onStop) {
                  t.onStop(e);
                }
              }}>
                      <Component335 className={`flex items-center gap-1 mr-3 text-xs text-red-400 group-hover/btn:text-red-300`}>{`停止`}</Component335>
                      <Component336 className={`bg-red-500/20 text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-500/30 transition-colors`}>
                        <T size={10} fill={`currentColor`} />
                      </Component336>
                    </Component337> : <Component348 className={`flex items-center gap-2`}>
                      <Component342 className={`relative nodrag flex items-center`} ref={R}>
                        <Component339 className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-[#333] hover:border-[#555] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`} onClick={e => {
                    e.stopPropagation();
                    ee(!L);
                  }} title={`批量生成数量`}>
                          <Component338>
                            {`x`}
                            {ye}
                          </Component338>
                        </Component339>
                        {L && <Component341 className={`absolute bottom-full right-0 mb-1 w-16 bg-[#222] border border-[#333] rounded-lg shadow-xl p-1 z-50 flex flex-col gap-0.5`} onClick={e => {
                    return e.stopPropagation();
                  }}>
                            {[1, 2, 3, 4, 5].map(e => {
                      return <Component340 className={`w-full text-center py-1.5 text-[11px] rounded-md transition-colors ${ye === e ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} onClick={t => {
                        t.stopPropagation();
                        be(e);
                        ee(false);
                      }} key={e}>
                                  {`x`}
                                  {e}
                                </Component340>;
                    })}
                          </Component341>}
                      </Component342>
                      <Component347 className={`flex items-center bg-[#2a2a2a] rounded-full p-1 pl-3 border border-[#333] hover:border-gray-500 transition-colors cursor-pointer group/btn`} onClick={n => {
                  n.stopPropagation();
                  if (!m.trim() && Pe.images.length === 0 && Pe.texts.length === 0) {
                    if (t.onShowToast) {
                      t.onShowToast(`请输入提示词或连接参考节点`);
                    }
                    return;
                  }
                  if (t.onGenerate) {
                    t.onGenerate(e, m, `1024x1024`, he, _e, ye);
                  }
                }}>
                        {he && ma(he) && sa(he) !== null && <Component344 className={`flex items-center gap-0.5 mr-2 text-[11px] text-orange-400 tabular-nums`}>
                            <_Component19 className={`w-3 h-3`} strokeWidth={2.5} />
                            <Component343>{ha((sa(he) || 0) * ye)}</Component343>
                          </Component344>}
                        <Component345 className={`flex items-center gap-1 mr-3 text-xs text-gray-300 group-hover/btn:text-white`}>{`生成`}</Component345>
                        <Component346 className={`bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors`}>
                          <_Component21 size={14} strokeWidth={3} />
                        </Component346>
                      </Component347>
                    </Component348>}
                </Component349>
              </Component350>
            </Component351>;
        const Component352 = `div`;
        return <Q.Fragment>
              <Component352 className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[#1c1c1c] rounded-2xl border border-[#333] shadow-2xl min-w-[500px] w-max max-w-[920px] transition-all duration-300 origin-top z-50
                ${te ? `opacity-100 scale-100 p-4 overflow-visible` : `opacity-0 scale-95 pointer-events-none h-0 p-0 border-0 overflow-hidden`}
              `} onClick={e => {
            return e.stopPropagation();
          }}>
                {!B && u}
                {te && !B && <_cmp_Fi targetRef={K} onRequestFullscreen={() => {
              return re(true);
            }} onResizeEnd={(t, n) => {
              i(e, {
                inputWidth: t,
                inputHeight: n
              });
              requestAnimationFrame(() => {
                return l(e);
              });
            }} />}
              </Component352>
              <_cmp_Ii open={B} title={`编辑提示词 - 生图`} onClose={() => {
            return re(false);
          }}>
                {u}
              </_cmp_Ii>
            </Q.Fragment>;
      })()}
        <_cmp__Component10 type={`target`} position={X.Left} variant={`large`} />
        <_cmp__Component10 type={`source`} position={X.Right} variant={`large`} />
      </Component353>
      {at > 0 && <Component354 aria-hidden={true} className={`w-full pointer-events-none`} style={{
      height: at,
      marginTop: -at,
      visibility: `hidden`
    }} />}
    </Component355>;
});
export default jo;