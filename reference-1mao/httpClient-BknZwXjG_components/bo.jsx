// TODO(全局, 无需 import): data, selected, width, updateNodeData, setEdges, setNodes, getNode, n, r, i, aspectRatio, imageSize, quality, left, ce, se, m, prompt, p, de, g, x, fe, selectedModel, k, ee, handleType, images, texts, url, sourceNodeId, o, assetName, s, label, text, expanded, useThumbnail, je, ke, nodeId, imageUrlRef, q, currentImageLength, originalFound, originalLength, useOriginal, urlLength, isHttp, filename, saveAs, subfolder, preferThumbnail, thumbMaxDim, thumbQuality, qe, height, style, position, l, u, f, xe, display, isConnected, ie, resourceOrder, selectedContextResources, minHeight, oe, fontSize, lineHeight, padding, margin, border, boxSizing, fontFamily, fontWeight, letterSpacing, tabSize, wordBreak, whiteSpace, overflow, inputHeight, cursor, type, auto, low, medium, high, b, value, ve, apiFormat, ye, me, inputWidth
import _cmp__Component8 from './_Component8.jsx';
import _cmp_Bn from './Bn.jsx';
import _cmp__Component9 from './_Component9.jsx';
import _cmp_Ti from './Ti.jsx';
import _cmp_Di from './Di.jsx';
import _cmp__Component12 from './_Component12.jsx';
import _cmp__Component19 from './_Component19.jsx';
import _cmp__Component21 from './_Component21.jsx';
import _cmp__Component23 from './_Component23.jsx';
import _cmp_Ai from './Ai.jsx';
import { id, We, e, Se, yo, ho, U, W, xa, Da, ge, ka, G, _e, he, le, we, A, h, De, y, ue, ae, te, w, C, M, F, P, L, S, O, N, I, Lt, Qt, K, Oe, Fa, br, vi, Pe, Yr, Fe, Ne, mo, re, c, Kr, hi, Me, Y, Ue, Ke, Je, Ge, Xe, d, He, J, Ye, Ae, Ie, Le, Re, X, ze, Ce, ne, Be, V, D, go, _o, E, H, Ve, _, Ee, j, ca, ta, na, fa, la, Oa, be, pe, R, B, _Component2, _Component0, _Component1, Ze, _Component10, Te, _Component6, _Component17, Gt, _Component18, _Component20, T, _Component22 } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
var bo = Z.memo(({
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
  let l = Z.useRef(null);
  let u = Z.useRef(null);
  let [d, f] = Z.useState(() => {
    return t.resourceOrder || [];
  });
  let [p, m] = Z.useState(t.prompt || ``);
  let [h, g] = Z.useState(() => {
    let e = localStorage.getItem(`mutiwindow_prompt_aspectRatio`);
    return t.aspectRatio || e || `Auto`;
  });
  let [_, y] = Z.useState(() => {
    let e = localStorage.getItem(`mutiwindow_prompt_imageSize`);
    return t.imageSize || e || `1K`;
  });
  let [b, x] = Z.useState(() => {
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
  let [S, C] = Z.useState(false);
  let w = Z.useRef(null);
  let [E, D] = Z.useState(false);
  let [O, k] = Z.useState(false);
  let [A, j] = Z.useState(false);
  let M = Z.useRef(null);
  let [N, P] = Z.useState(false);
  let F = Z.useRef(null);
  let [I, ee] = Z.useState(false);
  let L = Z.useRef(null);
  let [R, te] = Z.useState(t.expanded === undefined ? true : t.expanded);
  let [ne, B] = Z.useState(false);
  let [re, V] = Z.useState(-1);
  let [ie, ae] = Z.useState(t.selectedContextResources || []);
  let [oe, H] = Z.useState({
    top: 0,
    left: 0
  });
  let se = Z.useRef(0);
  let ce = Z.useRef(``);
  let U = Z.useRef(false);
  let W = (e, t) => {
    let n = Se.current;
    let r = yo(e);
    if (n) {
      n.innerHTML = r;
      if (t !== undefined) {
        requestAnimationFrame(() => {
          if (Se.current) {
            Se.current.focus();
            ho(Se.current, t);
          }
        });
      }
    }
    ce.current = r;
    se.current = t ?? e.length;
  };
  let le = (t, n) => {
    let r = n ?? t.length;
    U.current = true;
    W(t, r);
    m(t);
    i(e, {
      prompt: t
    });
  };
  let [G, ue] = Z.useState(t.selectedModel || localStorage.getItem(`mutiwindow_prompt_model`) || t.drawingModel && t.drawingModel.split(`
`)[0].trim() || ``);
  let [de, fe] = Z.useState(t.apiFormat || `auto`);
  let [pe, me] = Z.useState(1);
  let [he, ge] = Z.useState(() => {
    return xa().filter(e => {
      return e.enabled && e.category === `image`;
    });
  });
  Z.useEffect(() => {
    return Da(e => {
      ge(e.filter(e => {
        return e.enabled && e.category === `image`;
      }));
    });
  }, []);
  let _e = ka(G);
  let ve = _e ? he.find(e => {
    return e.id === _e;
  }) : null;
  let ye = t.presetPrompts || [];
  let be = e => {
    if (!e) {
      return;
    }
    let t = p ? `${p}, ${e}` : e;
    le(t, t.length);
  };
  let xe = Z.useRef(null);
  let Se = Z.useRef(null);
  let Ce = Z.useRef(null);
  let we = Z.useMemo(() => {
    let e = (G || ``).toLowerCase();
    let t = e.includes(`banana`) || e.includes(`gemini`) || e.includes(`香蕉`) || e.includes(`芭蕉`);
    return de === `gemini` || de === `auto` && t;
  }, [G, de]);
  let Ee = Z.useMemo(() => {
    if (we) {
      if (A) {
        return [`Auto`, `1:1`, `1:4`, `1:8`, `2:3`, `3:2`, `3:4`, `4:1`, `4:3`, `4:5`, `5:4`, `8:1`, `9:16`, `16:9`, `21:9`, `9:21`, `1:3`, `3:1`, `2:1`, `1:2`];
      } else {
        return Array.from(new Set([`Auto`, `1:1`, `16:9`, `9:16`, `3:2`, `2:3`, `4:3`, `3:4`, `21:9`, h]));
      }
    } else {
      return [`Auto`, `1:1`, `16:9`, `9:16`, `3:2`, `2:3`, `4:3`, `3:4`, `21:9`, `9:21`, `1:3`, `3:1`, `2:1`, `1:2`];
    }
  }, [we, A, h]);
  let De = Z.useRef(yo(t.prompt || ``));
  ce.current = ce.current || De.current;
  Z.useEffect(() => {
    let e = t.prompt || ``;
    requestAnimationFrame(() => {
      return W(e, e.length);
    });
  }, []);
  Z.useLayoutEffect(() => {
    let e = Se.current;
    if (!e) {
      return;
    }
    if (U.current) {
      U.current = false;
      return;
    }
    let t = ce.current;
    if (t && e.innerHTML !== t) {
      e.innerHTML = t;
      try {
        let t = Math.min(se.current, (e.textContent || ``).length);
        ho(e, t);
        se.current = t;
      } catch {}
    } else if (!t && De.current && !e.innerHTML) {
      e.innerHTML = De.current;
      ce.current = De.current;
    }
  });
  Z.useEffect(() => {
    let e = t.prompt || ``;
    if (e !== p) {
      let t = Se.current;
      W(e, t && document.activeElement === t ? Math.min(se.current, e.length) : e.length);
      m(e);
    }
    if (t.aspectRatio !== undefined) {
      g(t.aspectRatio);
    }
    if (t.imageSize !== undefined) {
      y(t.imageSize);
    }
    if (t.quality !== undefined) {
      x(t.quality);
    }
    if (t.selectedModel !== undefined) {
      ue(t.selectedModel);
    }
    if (t.apiFormat !== undefined) {
      fe(t.apiFormat);
    }
    if (t.selectedContextResources) {
      ae(t.selectedContextResources);
    }
    if (t.expanded !== undefined) {
      te(t.expanded);
    }
  }, [t.prompt, t.aspectRatio, t.imageSize, t.quality, t.selectedModel, t.apiFormat, t.selectedContextResources, t.expanded]);
  Z.useEffect(() => {
    if (!ka(G) && t.drawingModel) {
      let n = t.drawingModel.split(`
`).map(e => {
        return e.trim();
      }).filter(Boolean);
      if (n.length > 0 && (!G || !n.includes(G))) {
        ue(n[0]);
        i(e, {
          selectedModel: n[0]
        });
      }
    }
  }, [t.drawingModel, G, e, i]);
  Z.useEffect(() => {
    let e = e => {
      if (w.current && !w.current.contains(e.target)) {
        C(false);
      }
      if (M.current && !M.current.contains(e.target)) {
        k(false);
      }
      if (F.current && !F.current.contains(e.target)) {
        P(false);
      }
      if (L.current && !L.current.contains(e.target)) {
        ee(false);
      }
    };
    if (S || O || N || I) {
      document.addEventListener(`mousedown`, e, true);
    }
    return () => {
      document.removeEventListener(`mousedown`, e, true);
    };
  }, [S, O, N, I]);
  let K = Lt({
    handleType: `target`
  });
  let Oe = Qt(Z.useMemo(() => {
    return K.map(e => {
      return e.source;
    });
  }, [K]));
  let ke = (() => {
    if (!Oe) {
      return {
        images: [],
        texts: []
      };
    }
    let e = Array.isArray(Oe) ? Oe : [Oe];
    let t = [];
    let n = [];
    K.forEach(r => {
      let i = e.find(e => {
        return e?.id === r?.source;
      });
      if (!i) {
        return;
      }
      if (i?.data?.imageUrl) {
        t.push({
          id: i.id,
          url: i.data.imageUrl,
          sourceNodeId: i.id
        });
      }
      if (i?.type === `videoExtractNode` && i?.data?.extractedImages) {
        if (r && r.sourceHandle && r.sourceHandle.startsWith(`frame-`)) {
          let e = parseInt(r.sourceHandle.replace(`frame-`, ``), 10);
          if (!(i.data.hiddenIndices || []).includes(e)) {
            let n = i.data.allExtractedImages;
            if (n && n[e]) {
              t.push({
                id: `${i.id}-ext-${e}`,
                url: n[e],
                sourceNodeId: i.id
              });
            }
          }
        } else {
          i.data.extractedImages.forEach((e, n) => {
            t.push({
              id: `${i.id}-ext-${n}`,
              url: e,
              sourceNodeId: i.id
            });
          });
        }
      }
      if (i?.type === `imageBoxNode` && Array.isArray(i.data?.images)) {
        let e = i.data.images;
        let n = i.data.selectedIds || [];
        if (n.length > 0) {
          let r = new Set(n);
          e.forEach((e, n) => {
            if (e?.url && r.has(e.id)) {
              t.push({
                id: `${i.id}-box-${n}`,
                url: e.url,
                sourceNodeId: i.id
              });
            }
          });
        } else {
          let n = e[typeof i.data.activeIndex == `number` ? i.data.activeIndex : 0]?.url;
          if (n) {
            t.push({
              id: `${i.id}-box-active`,
              url: n,
              sourceNodeId: i.id
            });
          }
        }
      }
      if (i?.type === `scriptBoxNode` && r?.sourceHandle?.startsWith(`shot-`)) {
        let e = r.sourceHandle.replace(`shot-`, ``);
        let a = (i.data.shots || []).find(t => {
          return t.id === e;
        });
        if (a) {
          let r = i.data.assets || [];
          let o = `${a.description || ``} ${a.prompt || ``} ${a.videoPrompt || ``} ${a.dialogue || ``}`;
          r.forEach(e => {
            if (e?.name && e.imageUrl && Fa(o, e.name)) {
              t.push({
                id: `${i.id}-asset-${e.id}`,
                url: e.imageUrl,
                sourceNodeId: i.id,
                assetName: e.name
              });
            }
          });
          let s = a.prompt || ``;
          if (s && (a.gridMode === 4 || a.gridMode === 9)) {
            let e = a.gridMode;
            s = `${s}。根据当前的描述内容，严格遵循故事内容提示，做出${e}宫格构图的故事内容，${e}个不同的画面，高细节，一致的风格，连贯的叙事，${e}宫格之间无缝拼接`;
          }
          if (s) {
            n.push({
              id: `${i.id}-shot-${e}`,
              sourceNodeId: i.id,
              label: `分镜${a.index}${a.duration ? `（${a.duration}）` : ``}`,
              text: s
            });
          }
        }
      }
      let a = new Set([`promptNode`, `imageNode`, `imageBoxNode`, `videoNode`, `sd2VideoNode`, `discountVideoNode`, `gridSplitNode`, `gridMergeNode`, `cropNode`, `urlToImageNode`, `fileToUrlNode`, `panoramaNode`, `videoExtractNode`, `scriptBoxNode`]);
      if (i?.data?.text && !a.has(i.type)) {
        let e = String(i.data.text).trim();
        if (i.type === `textNode` && (/^https?:\/\/[^\s]+$/.test(e) || e.startsWith(`data:image/`))) {
          t.push({
            id: i.id,
            url: e,
            sourceNodeId: i.id
          });
        } else {
          n.push({
            id: i.id,
            sourceNodeId: i.id,
            label: i?.type === `audioNode` ? `听音断句结果` : i.data.label || `文本节点`,
            text: i.data.text
          });
        }
      }
    });
    let r = new Map();
    let i = new Map();
    let a = new Set();
    let o = [];
    t.forEach(e => {
      if (e.assetName) {
        let t = i.get(e.url);
        if (t === undefined) {
          t = i.size + 1;
          i.set(e.url, t);
          a.add(e.url);
          o.push(e);
        }
        r.set(e.assetName, t);
      } else if (!a.has(e.url)) {
        a.add(e.url);
        o.push(e);
      }
    });
    if (r.size > 0) {
      return {
        images: o,
        texts: n.map(e => {
          let t = e.text || ``;
          r.forEach((e, n) => {
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
        images: o,
        texts: n
      };
    }
  })();
  let Ae = () => {
    te(!R);
    i(e, {
      expanded: !R
    });
  };
  let je = t.imageUrl;
  let q = t.imageUrlRef;
  let Me = t.imageUrlThumbRef;
  let Ne = t.thumbnailUrl;
  let {
    useThumbnail: Pe
  } = br();
  let Fe = vi(r ?? t._styleWidth ?? 420);
  let Ie = Pe ? Yr(je, Fe, `image`) || Ne || je : je || Ne;
  let Le = t.loading;
  let Re = t.errorMessage;
  let ze = (e, t = false) => {
    let n = Se.current;
    let r = `@${e} `;
    let i;
    if (n) {
      i = mo(n);
    } else {
      i = p.length;
    }
    let a;
    let o;
    if (t && re >= 0) {
      a = p.substring(0, re);
      o = p.substring(re + 1);
    } else {
      a = p.substring(0, i);
      o = p.substring(i);
    }
    let s = a + r + o;
    let c = a.length + r.length;
    le(s, c);
    requestAnimationFrame(() => {
      let e = Se.current;
      if (e) {
        e.focus();
        ho(e, c);
      }
    });
  };
  let Be = Z.useMemo(() => {
    return [...ke.images.map((e, t) => {
      return `图片${t + 1}`;
    }), ...ke.texts.map((e, t) => {
      return `文本${t + 1}`;
    })];
  }, [ke.images, ke.texts]);
  let Ve = e => {
    if (e.type.startsWith(`image`)) {
      return `图片${ke.images.findIndex(t => {
        return t.id === e.id;
      }) + 1}`;
    } else {
      if (e.type.startsWith(`text`)) {
        return `文本${ke.texts.findIndex(t => {
          return t.id === e.id;
        }) + 1}`;
      } else {
        return `素材1`;
      }
    }
  };
  let He = async n => {
    n.stopPropagation();
    if (!je) {
      return;
    }
    let r = je;
    let i = false;
    console.log(`[PromptNode] 下载开始:`, {
      nodeId: e,
      imageUrlRef: q,
      currentImageLength: je?.length
    });
    if (q) {
      try {
        let e = await Kr.getConfig(q);
        console.log(`[PromptNode] 读取原图结果:`, {
          imageUrlRef: q,
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
  let J = async n => {
    let r = n.target.files?.[0];
    if (!r) {
      return;
    }
    try {
      let i = await hi(r, {
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
        t.onAddImage(e, r, q, Me);
      }
    };
    i.readAsDataURL(r);
    n.target.value = ``;
  };
  let Y = (e => {
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
  })(h);
  let Ue = Y !== null;
  let Ge = Ue && Y ? Math.round(Math.sqrt(Y) * 360) : null;
  let Ke = Ue && Y ? Math.round(360 / Math.sqrt(Y)) : null;
  let qe = Z.useRef(Ke);
  let Je = Z.useRef(null);
  let [Ye, Xe] = Z.useState(null);
  Z.useEffect(() => {
    let t = qe.current;
    qe.current = Ke;
    if (Je.current !== null) {
      cancelAnimationFrame(Je.current);
      Je.current = null;
    }
    if (Ge === null || Ke === null) {
      Xe(null);
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
    let s = t ?? Ke;
    let l = Ge;
    let u = Ke;
    if (t === null || Math.round(r) === l && Math.round(s) === u) {
      Xe(null);
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
      Xe(c);
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
        Je.current = requestAnimationFrame(h);
      } else {
        Je.current = null;
        Xe(null);
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
    Je.current = requestAnimationFrame(h);
    return () => {
      if (Je.current !== null) {
        cancelAnimationFrame(Je.current);
        Je.current = null;
      }
    };
  }, [Ge, Ke, e]);
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
  return <Component353 ref={l} className={`relative flex flex-col items-center group/node w-full min-w-[160px] min-h-[160px] ${Ue ? `h-auto` : `h-full`} ${n ? `z-50` : `z-10`}`}>
      <_cmp__Component8 id={e} data={t} defaultTitle={`生图节点`} icon={<_Component2 size={11} className={`text-gray-500`} />} />
      {!Le && <Component244 className={`absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`}>
          <Component243 className={`flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`}>
            {ke.images.length === 0 && <Component237 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`上传参考图`} onClick={e => {
          e.stopPropagation();
          xe.current?.click();
        }}>
                <_Component0 size={14} />
              </Component237>}
            {je && <Q.Fragment>
                <Component238 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`放大`} onClick={n => {
            n.stopPropagation();
            if (t.onZoom) {
              t.onZoom(e, q, je);
            }
          }}>
                  <_Component1 size={14} />
                </Component238>
                <Component239 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`裁剪`} onClick={n => {
            n.stopPropagation();
            if (t.onCrop) {
              t.onCrop(e, je, q);
            }
          }}>
                  <Ze size={14} />
                </Component239>
                <Component240 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`编辑`} onClick={n => {
            n.stopPropagation();
            if (t.onEdit) {
              t.onEdit(e, q, je);
            }
          }}>
                  <_Component10 size={14} />
                </Component240>
                <Component241 className={`p-1.5 text-gray-400 hover:text-blue-400 hover:bg-[#333] rounded-md`} title={`发送到左侧网站`} onClick={e => {
            e.stopPropagation();
            if (t.onSendToActiveTab) {
              t.onSendToActiveTab(je);
            }
          }}>
                  <Te size={14} />
                </Component241>
                <_cmp_Bn url={je} fallbackExt={`png`} onToast={e => {
            return t.onShowToast?.(e);
          }} />
                <Component242 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`下载`} onClick={He}>
                  <_Component6 size={14} />
                </Component242>
              </Q.Fragment>}
          </Component243>
        </Component244>}
      <_cmp__Component9 visible={!!n} minWidth={160} minHeight={160} keepAspectRatio={Ue} />
      <Component245 type={`file`} ref={xe} style={{
      display: `none`
    }} accept={`image/*`} onChange={J} />
      <Component253 className={`relative bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-colors duration-300 cursor-pointer group/image w-full flex flex-col
          ${Ue ? `` : `flex-1`}
          ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}
        `} style={Ue ? Ye === null ? Y ? {
      aspectRatio: String(Y)
    } : undefined : {
      height: Ye
    } : undefined} onClick={Ae}>
        <Component252 className={`flex items-center justify-center absolute inset-0 rounded-xl overflow-hidden ${je ? `` : `bg-[#0d0c0c]`}`}>
          {je && <Component246 src={Ie} alt={`Generated Content`} loading={`lazy`} decoding={`async`} className={`max-w-full w-full h-full object-contain block ${Le ? `opacity-50 blur-sm` : ``}`} draggable={false} onError={e => {
          let t = e.currentTarget;
          if (je && t.src !== je) {
            t.src = je;
          }
        }} onDoubleClick={n => {
          n.stopPropagation();
          if (t.onZoom) {
            t.onZoom(e, q, je);
          }
        }} />}
          {Le && <_cmp_Ti label={`生图中...`} backgroundUrl={je || ke.images[0]?.url}>
              <_cmp_Di category={`image`} />
            </_cmp_Ti>}
          {Re && !Le && <Component249 className={`absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-500 z-10 bg-[#1a1a1a] p-4 text-center`}>
              <_Component17 size={32} />
              <Component247 className={`text-xs font-medium max-w-full break-words`}>
                {Re}
              </Component247>
              <Component248 className={`text-[10px] bg-[#333] hover:bg-[#444] text-gray-300 px-3 py-1 rounded-full border border-gray-600 transition-colors`} onClick={e => {
            e.stopPropagation();
          }}>{`请检查设置或重试`}</Component248>
            </Component249>}
          {!je && !Le && !Re && <Component250 className={`flex flex-col items-center justify-center absolute inset-0 bg-[#151515] pointer-events-none`}>
              <_Component2 size={80} className={`text-gray-700`} strokeWidth={1.2} />
            </Component250>}
          <Component251 className={`absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100 pointer-events-none`} />
        </Component252>
      </Component253>
      <_cmp__Component12 type={`target`} position={X.Left} variant={`large`} />
      <_cmp__Component12 type={`source`} position={X.Right} variant={`large`} />
      {(() => {
      let n = [...ke.images.map(e => {
        return {
          ...e,
          isConnected: true
        };
      }), ...ie.filter(e => {
        return e.type.startsWith(`image`) && !ke.images.some(t => {
          return t.id === e.id;
        });
      }).map(e => {
        return {
          ...e,
          isConnected: false
        };
      })].sort((e, t) => {
        let n = d.indexOf(e.id);
        let r = d.indexOf(t.id);
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
        f(c);
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
      let l = <Component351 className={`space-y-3`}>
            <Component280 className={`flex flex-col gap-2 mb-2`}>
              {(n.length > 0 || ke.texts.length > 0) && <Component262 className={`flex flex-wrap gap-2 mb-1`}>
                  {n.map((t, n) => {
              let o = `图片${n + 1}`;
              const Component254 = `img`;
              const Component255 = `div`;
              const Component256 = `button`;
              const Component257 = `div`;
              const Component258 = `div`;
              return <Component258 className={`w-10 h-10 rounded-md overflow-hidden relative group bg-black cursor-grab active:cursor-grabbing nodrag nopan`} title={t.isConnected ? `已连线的图片` : `上传的图片`} draggable={true} onDragStart={e => {
                e.stopPropagation();
                u.current = t.id;
                e.dataTransfer.setData(`text/plain`, t.id);
                e.dataTransfer.effectAllowed = `move`;
              }} onDragOver={e => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = `move`;
              }} onDragEnter={e => {
                e.preventDefault();
                e.stopPropagation();
                let n = u.current;
                if (n && n !== t.id) {
                  r(n, t.id);
                }
              }} onDrop={e => {
                e.preventDefault();
                e.stopPropagation();
                r(u.current || e.dataTransfer.getData(`text/plain`), t.id);
                u.current = null;
              }} onDragEnd={() => {
                u.current = null;
              }} key={`img-${t.id}`}>
                        <Component254 src={t.url} className={`w-full h-full object-cover opacity-80 pointer-events-none`} />
                        <Component255 className={`absolute inset-0 bg-blue-500/10 pointer-events-none`} />
                        <Component256 type={`button`} className={`absolute bottom-0 left-0 right-0 bg-blue-500/80 hover:bg-blue-500 text-[8px] text-white text-center py-0.5 truncate cursor-pointer transition-colors`} title={`点击插入 @${o}`} onMouseDown={e => {
                  return e.preventDefault();
                }} onClick={e => {
                  e.stopPropagation();
                  ze(o);
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
                  {ke.texts.map((t, n) => {
              let r = `文本${n + 1}`;
              const Component259 = `span`;
              const Component260 = `div`;
              const Component261 = `div`;
              return <Component261 className={`h-8 px-2 bg-[#2a2a2a] border border-[#444] rounded flex items-center gap-1 text-[10px] text-gray-300 hover:bg-[#333] hover:border-blue-500 hover:text-blue-400 transition-colors cursor-pointer group/text relative`} title={t.text} onClick={e => {
                e.stopPropagation();
                ze(r);
              }} key={`txt-${n}`}>
                        <_Component18 size={10} />
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
                <Component278 className={`flex-1 nodrag relative shrink-0`} ref={Ce} style={{
              width: ne ? `100%` : o,
              height: ne ? `100%` : c,
              minHeight: `80px`
            }}>
                  <_cmp__Component19 text={p} names={Be} placeholder={`描述你想要的画面 (输入 @ 调出素材)...`} scrollTop={oe.top} scrollLeft={oe.left} className={`absolute inset-0 z-0 custom-scrollbar`} style={{
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
                  <Component263 ref={Se} contentEditable={true} suppressContentEditableWarning={true} spellCheck={false} className={`relative z-10 w-full h-full bg-transparent text-transparent caret-white outline-none custom-scrollbar nodrag nowheel nopan overflow-auto whitespace-pre-wrap`} style={{
                width: `100%`,
                height: `100%`,
                minHeight: `80px`,
                overflow: `auto`,
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
                let o = mo(r);
                se.current = o;
                ce.current = r.innerHTML;
                m(a);
                i(e, {
                  prompt: a
                });
                let s = a.substring(0, o);
                let c = s.lastIndexOf(`@`);
                if (c >= 0) {
                  let e = s.substring(c + 1);
                  if (e === `` || /^\d+$/.test(e)) {
                    V(c);
                    D(true);
                  } else {
                    V(-1);
                    D(false);
                  }
                } else {
                  V(-1);
                  D(false);
                }
                if (!ne && (!t.inputHeight || t.inputHeight <= 200)) {
                  requestAnimationFrame(() => {
                    let t = Se.current;
                    if (t) {
                      let n = Ce.current;
                      t.style.height = `auto`;
                      let r = Math.max(80, Math.min(t.scrollHeight, 200));
                      t.style.height = `${r}px`;
                      if (n) {
                        n.style.height = `${r}px`;
                      }
                      i(e, {
                        inputHeight: r
                      });
                    }
                  });
                }
              }} onKeyDown={e => {
                let t = e.currentTarget;
                let n = mo(t);
                se.current = n;
                if (e.key === `Backspace` || e.key === `Delete`) {
                  let r = window.getSelection();
                  if (!r || r.isCollapsed) {
                    let r = go(p, Be, n, e.key);
                    if (r) {
                      e.preventDefault();
                      le(r.text, r.cursor);
                      requestAnimationFrame(() => {
                        return ho(t, r.cursor);
                      });
                      return;
                    }
                  }
                }
                if (e.key === ` `) {
                  let r = _o(p, n, p.lastIndexOf(`@`, n - 1), Be);
                  if (r) {
                    e.preventDefault();
                    le(r.text, r.cursor);
                    D(false);
                    V(-1);
                    requestAnimationFrame(() => {
                      return ho(t, r.cursor);
                    });
                    return;
                  }
                }
                if (e.key === `Enter`) {
                  if (e.ctrlKey || e.metaKey) {
                    return;
                  }
                  let r = _o(p, n, p.lastIndexOf(`@`, n - 1), Be);
                  e.preventDefault();
                  let i = (() => {
                    if (r) {
                      return {
                        text: r.text,
                        cursor: r.cursor
                      };
                    }
                    let e = p.substring(0, n);
                    let t = p.substring(n);
                    return {
                      text: `${e}
${t}`,
                      cursor: e.length + 1
                    };
                  })();
                  le(i.text, i.cursor);
                  if (r) {
                    D(false);
                    V(-1);
                  }
                  requestAnimationFrame(() => {
                    return ho(t, i.cursor);
                  });
                  return;
                }
                if (e.key === `Escape` && E) {
                  D(false);
                }
              }} onScroll={e => {
                return H({
                  top: e.currentTarget.scrollTop,
                  left: e.currentTarget.scrollLeft
                });
              }} onWheel={e => {
                return e.stopPropagation();
              }} />
                  {E && <Component277 className={`absolute bottom-[calc(100%+4px)] left-0 w-72 bg-[#222] border border-[#444] rounded-lg shadow-2xl z-[999999] flex flex-col overflow-hidden h-[300px] nopan`} onWheel={e => {
                return e.stopPropagation();
              }} onClick={e => {
                return e.stopPropagation();
              }}>
                      <Component267 className={`flex items-center justify-between p-2 border-b border-[#333] bg-[#1a1a1a]`}>
                        <Component265 className={`text-xs text-gray-300 font-bold flex items-center gap-2`}>
                          <Component264>{`选择素材引用`}</Component264>
                        </Component265>
                        <Component266 onClick={() => {
                    return D(false);
                  }} className={`text-gray-500 hover:text-white p-1`}>
                          <Gt size={12} />
                        </Component266>
                      </Component267>
                      <Component276 className={`p-2 flex-1 overflow-y-auto custom-scrollbar nowheel nopan nodrag`}>
                        {(() => {
                    let e = [...ke.images.map(e => {
                      return {
                        id: e.id,
                        url: e.url,
                        type: `image`
                      };
                    }), ...ke.texts.map(e => {
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
                          return <Component274 className={`aspect-square bg-[#111] rounded border border-[#333] hover:border-blue-500 cursor-pointer overflow-hidden relative group flex flex-col`} onClick={() => {
                            ze(Ve(e), true);
                            V(-1);
                            D(false);
                          }} key={e.id}>
                                      {e.type.startsWith(`image`) ? <Component269 src={e.url} className={`w-full h-full object-cover`} /> : <Component271 className={`w-full h-full bg-[#222] flex flex-col items-center justify-center p-1 text-center`}>
                                          <_Component18 size={16} className={`text-blue-400 opacity-80 mb-1`} />
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
                    </Component277>}
                </Component278>
              </Component279>
            </Component280>
            <Component350 className={`flex items-center justify-between mt-2 pt-2 border-t border-[#2a2a2a] nodrag`}>
              <Component334 className={`flex items-center gap-1.5 overflow-visible`}>
                <Component299 className={`relative nodrag`} ref={w}>
                  <Component283 type={`button`} className={`flex items-center gap-1.5 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`} onMouseDown={e => {
                e.stopPropagation();
              }} onClick={e => {
                e.stopPropagation();
                C(!S);
              }}>
                    <Component281 className={`w-2.5 h-3 border border-current rounded-[2px]`} />
                    <Component282>
                      {h}
                      {` · `}
                      {_}
                      {we ? `` : ` · ${{
                    auto: `自动质量`,
                    low: `低质量`,
                    medium: `中质量`,
                    high: `高质量`
                  }[b]}`}
                    </Component282>
                  </Component283>
                  {S && <Component298 className={`absolute bottom-full left-0 mb-1 w-56 bg-[#222] border border-[#333] rounded-lg shadow-xl p-3 z-50 flex flex-col gap-3`} onMouseDown={e => {
                return e.stopPropagation();
              }} onClick={e => {
                return e.stopPropagation();
              }}>
                      <Component287>
                        <Component284 className={`text-[10px] text-gray-500 mb-2`}>{`画质`}</Component284>
                        <Component286 className={`flex gap-1.5`}>
                          {[`1K`, `2K`, `4K`].map(t => {
                      return <Component285 type={`button`} className={`flex-1 py-1.5 text-[11px] rounded-md border transition-colors ${_ === t ? `bg-[#333] border-[#555] text-white` : `bg-[#1a1a1a] border-transparent text-gray-400 hover:bg-[#2a2a2a]`}`} onMouseDown={e => {
                        e.stopPropagation();
                      }} onClick={() => {
                        C(false);
                        y(t);
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
                          {Ee.map(t => {
                      return <Component289 type={`button`} className={`px-3 py-1.5 text-[11px] rounded-md border transition-colors ${h === t ? `bg-[#333] border-[#555] text-white` : `bg-[#1a1a1a] border-transparent text-gray-400 hover:bg-[#2a2a2a]`}`} onMouseDown={e => {
                        e.stopPropagation();
                      }} onClick={() => {
                        C(false);
                        g(t);
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
                          {we && !A && <Component290 type={`button`} className={`px-3 py-1.5 text-[11px] rounded-md border border-transparent bg-[#1a1a1a] text-gray-500 hover:bg-[#2a2a2a] hover:text-gray-400 transition-colors`} onMouseDown={e => {
                      e.stopPropagation();
                    }} onClick={() => {
                      return j(true);
                    }}>{`更多...`}</Component290>}
                          {we && A && <Component291 type={`button`} className={`px-3 py-1.5 text-[11px] rounded-md border border-transparent bg-[#1a1a1a] text-gray-500 hover:bg-[#2a2a2a] hover:text-gray-400 transition-colors`} onMouseDown={e => {
                      e.stopPropagation();
                    }} onClick={() => {
                      return j(false);
                    }}>{`收起`}</Component291>}
                        </Component292>
                      </Component293>
                      {!we && <Component297>
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
                      return <Component295 type={`button`} className={`flex-1 py-1.5 text-[11px] rounded-md border transition-colors ${b === t.value ? `bg-[#333] border-[#555] text-white` : `bg-[#1a1a1a] border-transparent text-gray-400 hover:bg-[#2a2a2a]`}`} onMouseDown={e => {
                        e.stopPropagation();
                      }} onClick={() => {
                        C(false);
                        x(t.value);
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
            }).length > 0) || !!(he.length > 0)) && <Component326 className={`relative nodrag flex items-center`} ref={M}>
                    <Component300 className={`w-[1px] h-3 bg-[#444] flex-shrink-0 mr-1.5`} />
                    <Component304 className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`} onClick={e => {
                e.stopPropagation();
                k(!O);
              }} title={ve ? `调度：${ve.name}` : G ? `${G}（${ca(G) ? `内置` : `第三方`}）` : `选择模型`}>
                      {ve ? <Component301 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border bg-blue-500/20 text-blue-200 border-blue-400/40`}>{`调度`}</Component301> : G && <Component302 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${ca(G) ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                            {ca(G) ? `内置` : `三方`}
                          </Component302>}
                      <Component303 className={`whitespace-nowrap`}>
                        {ve ? ve.name : G || `选择模型`}
                      </Component303>
                    </Component304>
                    {O && <Component325 className={`absolute bottom-full left-0 mb-1 min-w-[17rem] w-max max-w-[29rem] bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 block max-h-60 overflow-y-auto custom-scrollbar nowheel nopan nodrag`} onClick={e => {
                return e.stopPropagation();
              }}>
                        {(() => {
                  let n = (t.drawingModel || ``).split(`
`).map(e => {
                    return e.trim();
                  }).filter(e => {
                    return e !== ``;
                  });
                  let r = n.filter(e => {
                    return ca(e);
                  }).sort((e, t) => {
                    return e.localeCompare(t);
                  });
                  let a = n.filter(e => {
                    return !ca(e);
                  }).sort((e, t) => {
                    return e.localeCompare(t);
                  });
                  let o = (t, n, r) => {
                    let a = r ? ta(t) : null;
                    let o = r ? na(t) : null;
                    let s = fa(t, G === t);
                    const Component305 = `span`;
                    const Component306 = `span`;
                    const Component307 = `span`;
                    const Component308 = `span`;
                    const Component309 = `div`;
                    return <Component309 role={`button`} className={s.className} title={s.title} onClick={() => {
                      if (!s.disabled) {
                        ue(t);
                        i(e, {
                          selectedModel: t
                        });
                        localStorage.setItem(`mutiwindow_prompt_model`, t);
                        k(false);
                      }
                    }} key={`${r ? `b` : `o`}-${n}`}>
                                <Component305 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${r ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                                  {r ? `内置` : `三方`}
                                </Component305>
                                <Component306 className={`flex-1 whitespace-nowrap`}>
                                  {t}
                                </Component306>
                                {a !== null && <Component308 className={`shrink-0 inline-flex items-center gap-0.5 text-[10px] text-orange-400 tabular-nums`}>
                                    <_Component20 className={`w-2.5 h-2.5`} strokeWidth={2.5} />
                                    <Component307>
                                      {la(a)}
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
                              {he.length > 0 && <Q.Fragment>
                                  <Component313 className={`text-[10px] text-blue-300 mb-1 px-1 flex items-center justify-between`}>
                                    <Component311 className={`flex items-center gap-1`}>
                                      <_Component20 className={`w-2.5 h-2.5`} strokeWidth={2.5} />
                                      <Component310>{`模型调度`}</Component310>
                                    </Component311>
                                    <Component312 className={`ml-auto text-white/90 hover:text-white cursor-pointer transition-colors`} onClick={e => {
                          e.stopPropagation();
                          window.dispatchEvent(new CustomEvent(`mutiwindow-open-schedule-settings`));
                        }}>{`配置 ›`}</Component312>
                                  </Component313>
                                  {he.map(t => {
                        let n = Oa(t.id);
                        const Component314 = `span`;
                        const Component315 = `span`;
                        const Component316 = `span`;
                        const Component317 = `div`;
                        return <Component317 role={`button`} className={`w-full flex items-center gap-1.5 mb-1 last:mb-0 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors cursor-pointer ${G === n ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} onClick={() => {
                          ue(n);
                          i(e, {
                            selectedModel: n
                          });
                          localStorage.setItem(`mutiwindow_prompt_model`, n);
                          k(false);
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
                                  {(r.length > 0 || a.length > 0) && <Component318 className={`h-px bg-[#333] my-1.5`} />}
                                </Q.Fragment>}
                              {r.length > 0 && <Q.Fragment>
                                  <Component322 className={`text-[10px] text-blue-300 mb-1 px-1 flex items-center gap-1`}>
                                    <Component319>{`✨`}</Component319>
                                    <Component320>{`内置模型`}</Component320>
                                    <Component321 className={`ml-auto text-white/90 hover:text-white cursor-pointer whitespace-nowrap`} onClick={e => {
                          e.stopPropagation();
                          window.dispatchEvent(new CustomEvent(`mutiwindow-open-builtin-settings`));
                          k(false);
                        }} title={`查看内置模型详情`}>{`详情 ›`}</Component321>
                                  </Component322>
                                  {r.map((e, t) => {
                        return o(e, t, true);
                      })}
                                </Q.Fragment>}
                              {a.length > 0 && <Q.Fragment>
                                  {r.length > 0 && <Component323 className={`h-px bg-[#333] my-1.5`} />}
                                  <Component324 className={`text-[10px] text-gray-500 mb-1 px-1`}>{`第三方 API`}</Component324>
                                  {a.map((e, t) => {
                        return o(e, t, false);
                      })}
                                </Q.Fragment>}
                            </Q.Fragment>;
                })()}
                      </Component325>}
                  </Component326>}
                <Component333 className={`relative nodrag flex items-center`} ref={F}>
                  <Component327 className={`w-[1px] h-3 bg-[#444] flex-shrink-0 mr-1.5`} />
                  <Component329 className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`} onClick={e => {
                e.stopPropagation();
                P(!N);
              }} title={`请求格式`}>
                    <Component328 className={`truncate`}>
                      {de === `auto` ? `自动格式` : de === `openai` ? `OpenAI格式` : `Gemini格式`}
                    </Component328>
                  </Component329>
                  {N && <Component332 className={`absolute bottom-full left-0 mb-1 w-32 bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 block nodrag`} onClick={e => {
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
                  return <Component331 className={`w-full block mb-1 last:mb-0 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors truncate ${de === t.value ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} onClick={() => {
                    fe(t.value);
                    i(e, {
                      apiFormat: t.value
                    });
                    P(false);
                  }} key={t.value}>
                            {t.label}
                          </Component331>;
                })}
                    </Component332>}
                </Component333>
                <_cmp__Component21 category={`image`} presetPrompts={ye} onApply={be} onToast={e => {
              return t.onShowToast?.(e);
            }} />
              </Component334>
              <Component349 className={`flex items-center gap-3 flex-shrink-0 ml-2`}>
                {Le ? <Component337 className={`flex items-center bg-red-500/10 rounded-full p-1 pl-3 border border-red-500/30 hover:border-red-500/50 transition-colors cursor-pointer group/btn`} onClick={n => {
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
                    <Component342 className={`relative nodrag flex items-center`} ref={L}>
                      <Component339 className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-[#333] hover:border-[#555] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`} onClick={e => {
                  e.stopPropagation();
                  ee(!I);
                }} title={`批量生成数量`}>
                        <Component338>
                          {`x`}
                          {pe}
                        </Component338>
                      </Component339>
                      {I && <Component341 className={`absolute bottom-full right-0 mb-1 w-16 bg-[#222] border border-[#333] rounded-lg shadow-xl p-1 z-50 flex flex-col gap-0.5`} onClick={e => {
                  return e.stopPropagation();
                }}>
                          {[1, 2, 3, 4, 5].map(e => {
                    return <Component340 className={`w-full text-center py-1.5 text-[11px] rounded-md transition-colors ${pe === e ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} onClick={t => {
                      t.stopPropagation();
                      me(e);
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
                if (!p.trim() && ke.images.length === 0 && ke.texts.length === 0) {
                  if (t.onShowToast) {
                    t.onShowToast(`请输入提示词或连接参考节点`);
                  }
                  return;
                }
                if (t.onGenerate) {
                  t.onGenerate(e, p, `1024x1024`, G, de, pe);
                }
              }}>
                      {G && ca(G) && ta(G) !== null && <Component344 className={`flex items-center gap-0.5 mr-2 text-[11px] text-orange-400 tabular-nums`}>
                          <_Component20 className={`w-3 h-3`} strokeWidth={2.5} />
                          <Component343>{la((ta(G) || 0) * pe)}</Component343>
                        </Component344>}
                      <Component345 className={`flex items-center gap-1 mr-3 text-xs text-gray-300 group-hover/btn:text-white`}>{`生成`}</Component345>
                      <Component346 className={`bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors`}>
                        <_Component22 size={14} strokeWidth={3} />
                      </Component346>
                    </Component347>
                  </Component348>}
              </Component349>
            </Component350>
          </Component351>;
      const Component352 = `div`;
      return <Q.Fragment>
            <Component352 className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[#1c1c1c] rounded-2xl border border-[#333] shadow-2xl min-w-[500px] w-max max-w-[920px] transition-all duration-300 origin-top z-50
                ${R ? `opacity-100 scale-100 p-4 overflow-visible` : `opacity-0 scale-95 pointer-events-none h-0 p-0 border-0 overflow-hidden`}
              `} onClick={e => {
          return e.stopPropagation();
        }}>
              {!ne && l}
              {R && !ne && <_cmp__Component23 targetRef={Ce} onRequestFullscreen={() => {
            return B(true);
          }} onResizeEnd={(t, n) => {
            return i(e, {
              inputWidth: t,
              inputHeight: n
            });
          }} />}
            </Component352>
            <_cmp_Ai open={ne} title={`编辑提示词 - 生图`} onClose={() => {
          return B(false);
        }}>
              {l}
            </_cmp_Ai>
          </Q.Fragment>;
    })()}
    </Component353>;
});
export default bo;