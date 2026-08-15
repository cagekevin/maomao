// TODO(全局, 无需 import): data, selected, updateNodeData, setEdges, addNodes, addEdges, getNodes, setNodes, getNode, left, n, r, ce, se, i, g, prompt, uploadedAssets, setUploadedAssets, uploadingAssetsRef, failedAssetsRef, uploadAsset, getAssetStatus, clearAllFailedAssets, nodeId, initialUploadedAssets, onUploadAsset, onShowToast, xe, z, min, max, q, ke, resolution, size, o, selectedSeconds, je, resId, resUrl, resType, ye, url, type, handleType, images, videos, audios, texts, sourceNodeId, assetName, s, label, text, de, me, ve, selectedModel, b, modelName, aspectRatio, seconds, imageCount, videoCount, audioCount, filename, saveAs, x, subfolder, preferThumbnail, thumbMaxDim, thumbQuality, position, l, imageUrl, thumbnailUrl, source, videoUrl, videoName, audioUrl, audioName, u, ie, et, rt, tt, ot, width, height, style, m, p, f, at, display, st, expanded, isConnected, resourceOrder, selectedContextResources, minHeight, oe, fontSize, lineHeight, padding, margin, border, boxSizing, fontFamily, fontWeight, letterSpacing, tabSize, wordBreak, whiteSpace, resize, overflow, inputHeight, qe, cursor, ee, k, inputWidth
import _cmp__Component8 from './_Component8.jsx';
import _cmp_Bn from './Bn.jsx';
import _cmp__Component9 from './_Component9.jsx';
import _cmp_Ti from './Ti.jsx';
import _cmp_Di from './Di.jsx';
import _cmp__Component12 from './_Component12.jsx';
import _cmp__Component19 from './_Component19.jsx';
import _cmp__s from './_s.jsx';
import _cmp_Ts from './Ts.jsx';
import _cmp_Es_1 from './Es_1.jsx';
import _cmp__Component21 from './_Component21.jsx';
import _cmp__Component23 from './_Component23.jsx';
import _cmp_Ai from './Ai.jsx';
import _cmp_Er from './Er.jsx';
import { id, We, d, G, Ds, e, ho, U, W, Qo, pe, E, O, C, y, B, ne, te, F, R, P, Yi, Zi, Se, Ji, Ki, we, qi, Te, ea, Ce, D, Ee, ds, De, ks, Os, as, us, fs, ps, S, _, w, K, Oe, Ae, ss, Le, _e, ge, he, Re, Lt, Qt, He, J, Fa, Y, Ue, h, Ge, be, hs, hi, mo, le, $e, nt, it, N, A, Je, Ye, X, Xe, ue, j, Ze, ae, V, go, _o, re, H, Qe, Fe, Me, Ne, Pe, ca, ta, na, fa, la, L, I, Ie, M, Fn, _Component25, Ve, _Component41, _Component0, Ke, _Component6, Ot, _Component13, _Component17, Pt, Be, Gt, _Component18, T, _Component22 } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
var As = Z.memo(({
  id: e,
  data: t,
  selected: n
}) => {
  let {
    updateNodeData: r,
    setEdges: i,
    addNodes: a,
    addEdges: o,
    getNodes: c,
    setNodes: l,
    getNode: u
  } = We();
  let d = t;
  let f = Z.useRef(null);
  let [p, m] = Z.useState(() => {
    return d.resourceOrder || [];
  });
  let [h, g] = Z.useState(d.prompt || ``);
  let [_, y] = Z.useState(d.size || localStorage.getItem(`mutiwindow_discountvideo_size`) || `16:9`);
  let [b, x] = Z.useState(`16:9`);
  let [S, C] = Z.useState(d.resolution || localStorage.getItem(`mutiwindow_discountvideo_resolution`) || `1080p`);
  let [w, E] = Z.useState(d.selectedSeconds || localStorage.getItem(`mutiwindow_discountvideo_seconds`) || `10`);
  let [D, O] = Z.useState(d.selectedModel || localStorage.getItem(`mutiwindow_discountvideo_model`) || d.discountVideoModel && d.discountVideoModel.split(`
`)[0].trim() || ``);
  let [k, A] = Z.useState(false);
  let [j, M] = Z.useState(false);
  let N = Z.useRef(null);
  let [P, F] = Z.useState(false);
  let [I, ee] = Z.useState(false);
  let [L, R] = Z.useState(null);
  let te = Z.useRef(null);
  let [z, ne] = Z.useState(false);
  let B = Z.useRef(null);
  let [re, V] = Z.useState(false);
  let [ie, ae] = Z.useState(-1);
  let [oe, H] = Z.useState({
    top: 0,
    left: 0
  });
  let se = Z.useRef(0);
  let ce = Z.useRef(``);
  let U = Z.useRef(false);
  let W = (e, t) => {
    let n = G.current;
    let r = Ds(e);
    if (n) {
      n.innerHTML = r;
      if (t !== undefined) {
        requestAnimationFrame(() => {
          if (G.current) {
            G.current.focus();
            ho(G.current, t);
          }
        });
      }
    }
    ce.current = r;
    se.current = t ?? e.length;
  };
  let le = (t, n) => {
    let i = n ?? t.length;
    U.current = true;
    W(t, i);
    g(t);
    r(e, {
      prompt: t
    });
  };
  let G = Z.useRef(null);
  let ue = Z.useRef(null);
  let [de, pe] = Z.useState(d.selectedContextResources || []);
  let {
    uploadedAssets: me,
    setUploadedAssets: he,
    uploadingAssetsRef: ge,
    failedAssetsRef: _e,
    uploadAsset: ve,
    getAssetStatus: ye,
    clearAllFailedAssets: be
  } = Qo({
    nodeId: e,
    initialUploadedAssets: d.uploadedAssets,
    updateNodeData: r,
    onUploadAsset: d.onUploadAsset,
    onShowToast: d.onShowToast
  });
  Z.useEffect(() => {
    if (d.selectedContextResources) {
      pe(d.selectedContextResources);
    }
  }, [d.selectedContextResources]);
  Z.useEffect(() => {
    if (d.selectedSeconds !== undefined) {
      E(d.selectedSeconds);
    }
  }, [d.selectedSeconds]);
  Z.useEffect(() => {
    if (d.selectedModel !== undefined) {
      O(d.selectedModel);
    }
  }, [d.selectedModel]);
  Z.useEffect(() => {
    if (d.resolution !== undefined) {
      C(d.resolution);
    }
  }, [d.resolution]);
  Z.useEffect(() => {
    if (d.size !== undefined) {
      y(d.size);
    }
  }, [d.size]);
  let xe = Z.useRef(Ds(d.prompt || ``));
  ce.current = ce.current || xe.current;
  Z.useEffect(() => {
    let e = d.prompt || ``;
    requestAnimationFrame(() => {
      return W(e, e.length);
    });
  }, []);
  Z.useLayoutEffect(() => {
    let e = G.current;
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
    } else if (!t && xe.current && !e.innerHTML) {
      e.innerHTML = xe.current;
      ce.current = xe.current;
    }
  });
  Z.useEffect(() => {
    let e = e => {
      if (B.current && !B.current.contains(e.target)) {
        ne(false);
      }
      if (te.current && !te.current.contains(e.target)) {
        F(false);
        R(null);
      }
    };
    if (z || P) {
      document.addEventListener(`mousedown`, e, true);
    }
    return () => {
      document.removeEventListener(`mousedown`, e, true);
    };
  }, [z, P]);
  Z.useEffect(() => {
    Yi(`/api`).catch(() => {});
  }, []);
  let [, Se] = Z.useReducer(e => {
    return e + 1;
  }, 0);
  Z.useEffect(() => {
    return Zi(() => {
      return Se();
    });
  }, []);
  let Ce = Ji();
  let we = Ki();
  let Te = Z.useMemo(() => {
    if (we.length > 0) {
      return we;
    } else {
      if (d.discountVideoModel) {
        return d.discountVideoModel.split(`
`).map(e => {
          return e.trim();
        }).filter(Boolean);
      } else {
        return [];
      }
    }
  }, [we, d.discountVideoModel]);
  let Ee = Z.useMemo(() => {
    let e = qi();
    let t = {};
    for (let n of Te) {
      t[n] = ea(n) ?? e?.discountVideoSpecs?.[n] ?? null;
    }
    return t;
  }, [Te, d.discountVideoModel, Ce]);
  let De = Z.useMemo(() => {
    if (D) {
      return ea(D) ?? Ee[D] ?? null;
    } else {
      return null;
    }
  }, [D, Ee]);
  let K = Z.useMemo(() => {
    let e = ds(De, `resolutions`, ks.map(e => {
      return e.value;
    }));
    return ks.filter(t => {
      return e.includes(t.value);
    });
  }, [De]);
  let Oe = Z.useMemo(() => {
    let e = ds(De, `aspectRatios`, Os.map(e => {
      return e.value;
    }));
    return Os.filter(t => {
      return e.includes(t.value);
    });
  }, [De]);
  let ke = Z.useMemo(() => {
    return as(De);
  }, [De]);
  let Ae = us(De, `durationSpec`);
  let je = Z.useMemo(() => {
    let e = (d.videoDurations || `4
6
8
10
12
15`).split(`
`).map(e => {
      return e.trim();
    }).filter(Boolean).map(Number).filter(e => {
      return Number.isFinite(e) && e > 0;
    });
    return fs(De, e.length ? e : [4, 6, 8, 10, 12, 15]);
  }, [De, d.videoDurations]);
  let q = Z.useMemo(() => {
    let e = (d.videoDurations || `4
6
8
10
12
15`).split(`
`).map(e => {
      return e.trim();
    }).filter(Boolean).map(Number).filter(e => {
      return Number.isFinite(e) && e > 0;
    });
    return ps(De, {
      min: e.length ? Math.min(...e) : 4,
      max: e.length ? Math.max(...e) : 15
    });
  }, [De, d.videoDurations]);
  let Me = q.min;
  let Ne = q.max;
  let Pe = q.step;
  let Fe = ke?.mode === `discrete`;
  Z.useEffect(() => {
    if (!D || !De) {
      return;
    }
    let t = S;
    let n = _;
    let i = w;
    if (K.length && !K.some(e => {
      return e.value === S;
    })) {
      t = K[0].value;
      C(t);
      r(e, {
        resolution: t
      });
      localStorage.setItem(`mutiwindow_discountvideo_resolution`, t);
    }
    if (Oe.length && _ !== `custom` && !Oe.some(e => {
      return e.value === _;
    })) {
      n = Oe[0].value;
      y(n);
      r(e, {
        size: n
      });
      localStorage.setItem(`mutiwindow_discountvideo_size`, n);
    }
    let a = d.selectedSeconds || w;
    let o = Number(a);
    if (Ae && ke) {
      if (!ss(ke, o)) {
        if (ke.mode === `discrete`) {
          let e = ke.options.filter(e => {
            return Number.isFinite(e);
          });
          let t = e.reduce((e, t) => {
            if (Math.abs(t - o) < Math.abs(e - o)) {
              return t;
            } else {
              return e;
            }
          }, e[0]);
          i = String(t);
        } else {
          let e = Math.min(ke.max, Math.max(ke.min, Number.isFinite(o) ? o : ke.min));
          let t = ke.step || 1;
          i = String(Math.min(ke.max, Math.max(ke.min, ke.min + Math.round((e - ke.min) / t) * t)));
        }
        E(i);
        r(e, {
          selectedSeconds: i
        });
        localStorage.setItem(`mutiwindow_discountvideo_seconds`, i);
      }
    } else if (je.length && (!Number.isFinite(o) || !je.includes(o))) {
      let t = je.reduce((e, t) => {
        if (Math.abs(t - o) < Math.abs(e - o)) {
          return t;
        } else {
          return e;
        }
      }, je[0]);
      i = String(Number.isFinite(o) ? t : je[0]);
      E(i);
      r(e, {
        selectedSeconds: i
      });
      localStorage.setItem(`mutiwindow_discountvideo_seconds`, i);
    } else if (a && a !== w) {
      E(a);
    }
  }, [D, De, d.selectedSeconds]);
  let [Ie, Le] = Z.useState(d.expanded === undefined ? true : d.expanded);
  Z.useEffect(() => {
    if (d.expanded !== undefined) {
      Le(d.expanded);
    }
  }, [d.expanded]);
  let Re = async t => {
    if (d.onUploadAsset) {
      delete _e.current[t.id];
      ge.current[t.id] = true;
      try {
        let n = await d.onUploadAsset(t.url, t.type);
        if (!n || typeof n != `string`) {
          throw Error(`网关返回为空`);
        }
        he(i => {
          let a = {
            ...i,
            [t.url]: n
          };
          r(e, {
            uploadedAssets: a
          });
          return a;
        });
      } catch (e) {
        console.error(`Retry upload failed for`, t.id, e);
        d.onShowToast?.(`素材重试失败: ${e?.message || e}`);
        _e.current[t.id] = true;
      } finally {
        delete ge.current[t.id];
      }
    }
  };
  let _Component42 = ({
    resId: e,
    resUrl: t,
    resType: n
  }) => {
    let r = ye(e, t);
    if (!r.isUploading && !r.isUploaded && !r.isFailed) {
      return null;
    } else if (r.isFailed) {
      const Component947 = `span`;
      const Component948 = `div`;
      return <Component948 className={`absolute inset-0 bg-red-900/70 backdrop-blur-[1px] flex flex-col items-center justify-center cursor-pointer hover:bg-red-900/85 transition-colors group/retry z-10`} title={`上传失败,点击重试`} onClick={r => {
        r.stopPropagation();
        Re({
          id: e,
          url: t,
          type: n
        });
      }}>
          <_Component25 size={14} className={`text-white drop-shadow-md group-hover/retry:rotate-180 transition-transform duration-300`} />
          <Component947 className={`text-[8px] text-white mt-0.5 font-medium leading-none`}>{`重试`}</Component947>
        </Component948>;
    } else {
      const Component949 = `div`;
      return <Component949 className={`absolute top-0 left-0 p-0.5 pointer-events-none`}>
          {r.isUploading ? <_Component25 size={12} className={`animate-spin drop-shadow-md text-white`} /> : r.isUploaded ? <Ve size={12} className={`text-green-500 drop-shadow-md`} /> : null}
        </Component949>;
    }
  };
  let He = Lt({
    handleType: `target`
  });
  let J = Qt(Z.useMemo(() => {
    return He.map(e => {
      return e.source;
    });
  }, [He]));
  let Y = Z.useMemo(() => {
    if (!J) {
      return {
        images: [],
        videos: [],
        audios: [],
        texts: []
      };
    }
    let e = Array.isArray(J) ? J : [J];
    let t = [];
    let n = [];
    let r = [];
    let i = [];
    He.forEach(a => {
      let o = e.find(e => {
        return e?.id === a?.source;
      });
      if (!o) {
        return;
      }
      if (o?.type === `scriptBoxNode` && a?.sourceHandle?.startsWith(`shot-`)) {
        let e = a.sourceHandle.replace(`shot-`, ``);
        let n = (o.data.shots || []).find(t => {
          return t.id === e;
        });
        if (n) {
          let r = o.data.assets || [];
          let a = `${n.description || ``} ${n.prompt || ``} ${n.videoPrompt || ``} ${n.dialogue || ``}`;
          r.forEach(e => {
            if (e?.name && e.imageUrl && Fa(a, e.name)) {
              t.push({
                id: `${o.id}-asset-${e.id}`,
                url: e.imageUrl,
                type: `image`,
                sourceNodeId: o.id,
                assetName: e.name
              });
            }
          });
          let s = [n.videoPrompt || n.prompt || ``, n.dialogue ? `对白/旁白：${n.dialogue}` : ``, n.sound ? `音效：${n.sound}` : ``, n.motion ? `运镜：${n.motion}` : ``].filter(Boolean).join(`
`);
          if (s) {
            i.push({
              id: `${o.id}-shot-${e}`,
              sourceNodeId: o.id,
              label: `分镜${n.index}${n.duration ? `（${n.duration}）` : ``}`,
              text: s
            });
          }
        }
        return;
      }
      if (o?.data?.imageUrl) {
        let e = o.data.imageUrl;
        if (e.startsWith(`data:video/`) || /\.(mp4|webm|mov|ogg)($|\?)/i.test(e)) {
          n.push({
            id: o.id,
            url: e,
            type: `video`,
            sourceNodeId: o.id
          });
        } else if (e.startsWith(`data:audio/`) || /\.(mp3|wav|ogg|aac)($|\?)/i.test(e)) {
          r.push({
            id: o.id,
            url: e,
            type: `audio`,
            sourceNodeId: o.id
          });
        } else {
          t.push({
            id: o.id,
            url: e,
            type: `image`,
            sourceNodeId: o.id
          });
        }
      }
      if (o?.data?.videoUrl) {
        n.push({
          id: o.id,
          url: o.data.videoUrl,
          type: `video`,
          sourceNodeId: o.id
        });
      }
      if (o?.data?.audioUrl) {
        r.push({
          id: o.id,
          url: o.data.audioUrl,
          type: `audio`,
          sourceNodeId: o.id
        });
      }
      if (o?.type === `videoExtractNode` && o?.data?.extractedImages) {
        if (a && a.sourceHandle && a.sourceHandle.startsWith(`frame-`)) {
          let e = parseInt(a.sourceHandle.replace(`frame-`, ``), 10);
          if (!(o.data.hiddenIndices || []).includes(e)) {
            let n = o.data.allExtractedImages;
            if (n && n[e]) {
              t.push({
                id: `${o.id}-ext-${e}`,
                url: n[e],
                type: `image`,
                sourceNodeId: o.id
              });
            }
          }
        } else {
          o.data.extractedImages.forEach((e, n) => {
            t.push({
              id: `${o.id}-ext-${n}`,
              url: e,
              type: `image`,
              sourceNodeId: o.id
            });
          });
        }
      }
      if (o?.type === `imageBoxNode` && Array.isArray(o.data?.images)) {
        let e = o.data.images;
        let n = o.data.selectedIds || [];
        if (n.length > 0) {
          let r = new Set(n);
          e.forEach((e, n) => {
            if (e?.url && r.has(e.id)) {
              t.push({
                id: `${o.id}-box-${n}`,
                url: e.url,
                type: `image`,
                sourceNodeId: o.id
              });
            }
          });
        } else {
          let n = e[typeof o.data.activeIndex == `number` ? o.data.activeIndex : 0]?.url;
          if (n) {
            t.push({
              id: `${o.id}-box-active`,
              url: n,
              type: `image`,
              sourceNodeId: o.id
            });
          }
        }
      }
      let s = new Set([`textNode`, `audioNode`, `textConcatNode`]);
      if (o?.data?.text && s.has(o.type)) {
        i.push({
          id: o.id,
          sourceNodeId: o.id,
          label: o?.type === `audioNode` ? `听音断句结果` : o.data.label || `文本节点`,
          text: o.data.text
        });
      }
    });
    let a = new Map();
    let o = new Map();
    let s = new Set();
    let c = [];
    t.forEach(e => {
      if (e.assetName) {
        let t = o.get(e.url);
        if (t === undefined) {
          t = o.size + 1;
          o.set(e.url, t);
          s.add(e.url);
          c.push(e);
        }
        a.set(e.assetName, t);
      } else if (!s.has(e.url)) {
        s.add(e.url);
        c.push(e);
      }
    });
    if (a.size > 0) {
      return {
        images: c,
        videos: n,
        audios: r,
        texts: i.map(e => {
          let t = e.text || ``;
          a.forEach((e, n) => {
            let r = RegExp(`@${n}(?!（@图片)`, `g`);
            t = t.replace(r, `@${n}（@图片${e}）`);
          });
          return {
            ...e,
            text: t
          };
        })
      };
    } else {
      return {
        images: c,
        videos: n,
        audios: r,
        texts: i
      };
    }
  }, [J, He]);
  let Ue = Z.useMemo(() => {
    let e = [];
    let t = e => {
      if (typeof e != `string` || e.startsWith(`image`)) {
        return `image`;
      } else {
        if (e.startsWith(`video`)) {
          return `video`;
        } else {
          if (e.startsWith(`audio`)) {
            return `audio`;
          } else {
            return `image`;
          }
        }
      }
    };
    de.forEach(n => {
      if (n?.url && !n.url.startsWith(`asset://`)) {
        e.push({
          id: n.id,
          url: n.url,
          type: t(n.type)
        });
      }
    });
    Y.images.forEach(t => {
      if (t.url && !t.url.startsWith(`asset://`)) {
        e.push({
          id: t.id,
          url: t.url,
          type: `image`
        });
      }
    });
    Y.videos.forEach(t => {
      if (t.url && !t.url.startsWith(`asset://`)) {
        e.push({
          id: t.id,
          url: t.url,
          type: `video`
        });
      }
    });
    Y.audios.forEach(t => {
      if (t.url && !t.url.startsWith(`asset://`)) {
        e.push({
          id: t.id,
          url: t.url,
          type: `audio`
        });
      }
    });
    return e;
  }, [de, Y]);
  Z.useEffect(() => {
    if (!d.scriptAssetUploadPending) {
      for (let e of Ue) {
        if (!e.url || e.url.startsWith(`asset://`)) {
          continue;
        }
        let t = e.url;
        let n = e.id;
        if (!me[t] && !ge.current[n] && !_e.current[n]) {
          ve({
            id: n,
            url: e.url,
            type: e.type
          }).catch(e => {
            console.error(`Auto upload failed for`, n, e);
          });
        }
      }
    }
  }, [Z.useMemo(() => {
    return Ue.map(e => {
      return `${e.id}|${e.url}`;
    }).join(`;`);
  }, [Ue]), me, ve]);
  Z.useEffect(() => {
    if (d.prompt !== undefined && d.prompt !== h) {
      let e = G.current;
      let t = e && document.activeElement === e ? Math.min(se.current, d.prompt.length) : d.prompt.length;
      W(d.prompt, t);
      g(d.prompt);
    }
  }, [d.prompt]);
  Z.useEffect(() => {
    if (d.size !== undefined && d.size !== _) {
      y(d.size);
    }
  }, [d.size]);
  Z.useEffect(() => {
    if (d.discountVideoModel && !D) {
      let t = d.discountVideoModel.split(`
`)[0].trim();
      O(t);
      r(e, {
        selectedModel: t
      });
    }
  }, [d.discountVideoModel, D, e, r]);
  let Ge = Z.useRef(false);
  Z.useEffect(() => {
    if (!Ge.current) {
      if (d.selectedModel && d.selectedModel !== D) {
        O(d.selectedModel);
      }
      if (d.selectedModel || D) {
        Ge.current = true;
      }
    }
  }, [d.selectedModel]);
  Z.useEffect(() => {
    if (d.videoDurations && !w) {
      let t = d.videoDurations.split(`
`)[0].trim();
      E(t);
      r(e, {
        selectedSeconds: t
      });
    }
  }, [d.videoDurations, w, e, r]);
  Z.useEffect(() => {
    if (!De && d.selectedSeconds && d.selectedSeconds !== w) {
      E(d.selectedSeconds);
    }
  }, [d.selectedSeconds, De]);
  Z.useEffect(() => {}, [d.videoUrl, d.loading]);
  let qe = () => {
    if (Object.keys(ge.current).length > 0) {
      d.onShowToast?.(`素材正在上传处理中，请等待所有对勾出现后再生成`);
      return;
    }
    if (Object.keys(_e.current).length > 0) {
      d.onShowToast?.(`有素材上传失败，已为您重新尝试上传，请稍后`);
      be();
      return;
    }
    if (!D.trim()) {
      d.onShowToast?.(`请选择 AI 模型`);
      return;
    }
    if (!h.trim() && Y.images.length === 0 && Y.texts.length === 0 && de.length === 0) {
      d.onShowToast?.(`请输入提示词或连接参考节点`);
      return;
    }
    let t = _ === `custom` ? b : _;
    let n = hs(De, {
      modelName: D,
      prompt: h,
      resolution: S,
      aspectRatio: t,
      seconds: w,
      imageCount: Y.images.length,
      videoCount: Y.videos.length,
      audioCount: Y.audios.length
    });
    if (!n.ok) {
      d.onShowToast?.(n.errors[0] || `当前参数不符合模型要求`);
      return;
    }
    d.onGenerateDiscountVideo?.(e, h, t, D, w, S);
  };
  let Je = async e => {
    e.stopPropagation();
    if (d.videoUrl) {
      try {
        d.onShowToast?.(`开始下载视频...`);
        if (typeof chrome < `u` && chrome.downloads) {
          chrome.downloads.download({
            url: d.videoUrl,
            filename: `yimao/video-${Date.now()}.mp4`,
            saveAs: false
          });
        } else {
          let e = await (await fetch(d.videoUrl)).blob();
          let t = window.URL.createObjectURL(e);
          let n = document.createElement(`a`);
          n.href = t;
          n.download = `video-${Date.now()}.mp4`;
          document.body.appendChild(n);
          n.click();
          window.URL.revokeObjectURL(t);
          document.body.removeChild(n);
        }
      } catch (e) {
        console.error(`Download failed:`, e);
        d.onShowToast?.(`下载失败，请重试`);
        window.open(d.videoUrl, `_blank`);
      }
    }
  };
  let Ye = async t => {
    let n = t.target.files?.[0];
    if (!n) {
      return;
    }
    let r = n.type.startsWith(`video`) ? `video` : n.type.startsWith(`audio`) ? `audio` : `image`;
    let i = n.name;
    try {
      let t = `node-${Date.now()}`;
      let s = c().find(t => {
        return t.id === e;
      });
      let l = s ? {
        x: s.position.x - 300,
        y: s.position.y
      } : {
        x: 0,
        y: 0
      };
      if (r === `image`) {
        let r = ``;
        let s;
        try {
          let e = await hi(n, {
            subfolder: `canvas/upload`,
            preferThumbnail: true,
            thumbMaxDim: 480,
            thumbQuality: 75
          });
          if (e.url && /^https?:\/\//i.test(e.url)) {
            r = e.url;
            s = e.thumbnailUrl;
          }
        } catch (e) {
          console.warn(`[DiscountVideoNode] urlifyAsset failed, fallback to resizeImage:`, e);
        }
        r ||= await _cmp_Er(n, 2048, 0.85);
        a({
          id: t,
          type: `imageNode`,
          position: l,
          data: {
            imageUrl: r,
            thumbnailUrl: s,
            label: i || `图片素材`
          }
        });
        o({
          id: `edge-${t}-${e}`,
          source: t,
          target: e
        });
        return;
      }
      let u = ``;
      try {
        let e = await hi(n, {
          subfolder: `canvas/upload`
        });
        if (e.url && /^https?:\/\//i.test(e.url)) {
          u = e.url;
        }
      } catch (e) {
        console.warn(`[DiscountVideoNode] urlifyAsset failed for media, fallback to base64:`, e);
      }
      let d = n => {
        a(r === `video` ? {
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
        });
        o({
          id: `edge-${t}-${e}`,
          source: t,
          target: e
        });
      };
      if (u) {
        d(u);
      } else {
        let e = new FileReader();
        e.onload = e => {
          let t = e.target?.result;
          d(t);
        };
        e.readAsDataURL(n);
      }
    } catch (e) {
      console.error(`File upload failed:`, e);
    }
    t.target.value = ``;
  };
  let Xe = (e, t = false) => {
    let n = G.current;
    let r = `@${e} `;
    let i;
    if (n) {
      i = mo(n);
    } else {
      i = h.length;
    }
    let a;
    let o;
    if (t && ie >= 0) {
      a = h.substring(0, ie);
      o = h.substring(ie + 1);
    } else {
      a = h.substring(0, i);
      o = h.substring(i);
    }
    let s = a + r + o;
    let c = a.length + r.length;
    le(s, c);
    requestAnimationFrame(() => {
      let e = G.current;
      if (e) {
        e.focus();
        ho(e, c);
      }
    });
  };
  let Ze = Z.useMemo(() => {
    return [...Y.images.map((e, t) => {
      return `图片${t + 1}`;
    }), ...Y.videos.map((e, t) => {
      return `视频${t + 1}`;
    }), ...Y.audios.map((e, t) => {
      return `音频${t + 1}`;
    })];
  }, [Y.images, Y.videos, Y.audios]);
  let Qe = e => {
    if (e.type.startsWith(`image`)) {
      return `图片${Y.images.findIndex(t => {
        return t.id === e.id;
      }) + 1}`;
    } else {
      if (e.type.startsWith(`video`)) {
        return `视频${Y.videos.findIndex(t => {
          return t.id === e.id;
        }) + 1}`;
      } else {
        if (e.type.startsWith(`audio`)) {
          return `音频${Y.audios.findIndex(t => {
            return t.id === e.id;
          }) + 1}`;
        } else {
          return `素材1`;
        }
      }
    }
  };
  let $e = (e => {
    if (!e) {
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
  })(_ === `custom` ? b : _);
  let et = $e !== null;
  let tt = et && $e ? Math.round(Math.sqrt($e) * 380) : null;
  let nt = et && $e ? Math.round(380 / Math.sqrt($e)) : null;
  let rt = Z.useRef(nt);
  let it = Z.useRef(null);
  let [at, ot] = Z.useState(null);
  Z.useEffect(() => {
    let t = rt.current;
    rt.current = nt;
    if (it.current !== null) {
      cancelAnimationFrame(it.current);
      it.current = null;
    }
    if (tt === null || nt === null) {
      ot(null);
      l(t => {
        return t.map(t => {
          if (t.id !== e || t.style?.height !== undefined) {
            return t;
          }
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
        });
      });
      return;
    }
    let n = u(e);
    let r = n?.style?.width ?? n?.width ?? 380;
    let i = n?.position.x ?? 0;
    let a = n?.position.y ?? 0;
    let o = t ?? nt;
    let s = tt;
    let c = nt;
    if (t === null || Math.round(r) === s && Math.round(o) === c) {
      ot(null);
      l(t => {
        return t.map(t => {
          if (t.id !== e) {
            return t;
          }
          let n = t.style?.width ?? t.width ?? 380;
          if (Math.round(n) === s && t.style?.height === undefined) {
            return t;
          }
          let r = s - n;
          let i = {
            ...t.style,
            width: s
          };
          delete i.height;
          return {
            ...t,
            width: s,
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
    let f = a + o;
    let p = i + r / 2;
    let m = performance.now();
    let h = t => {
      let n = Math.min(1, (t - m) / 360);
      let i = d(n);
      let a = r + (s - r) * i;
      let u = o + (c - o) * i;
      ot(u);
      l(t => {
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
              y: f - u
            }
          };
        });
      });
      if (n < 1) {
        it.current = requestAnimationFrame(h);
      } else {
        it.current = null;
        ot(null);
        l(t => {
          return t.map(t => {
            if (t.id !== e) {
              return t;
            }
            let n = {
              ...t.style,
              width: s
            };
            delete n.height;
            return {
              ...t,
              width: s,
              height: undefined,
              style: n,
              position: {
                x: p - s / 2,
                y: f - c
              }
            };
          });
        });
      }
    };
    it.current = requestAnimationFrame(h);
    return () => {
      if (it.current !== null) {
        cancelAnimationFrame(it.current);
        it.current = null;
      }
    };
  }, [tt, nt, e]);
  let st = et ? at === null ? $e ? {
    aspectRatio: String($e)
  } : undefined : {
    height: at
  } : undefined;
  const Component950 = `button`;
  const Component951 = `button`;
  const Component952 = `button`;
  const Component953 = `button`;
  const Component954 = `div`;
  const Component955 = `div`;
  const Component956 = `input`;
  const Component957 = `video`;
  const Component958 = `button`;
  const Component959 = `div`;
  const Component960 = `div`;
  const Component961 = `div`;
  const Component962 = `div`;
  const Component963 = `div`;
  const Component964 = `div`;
  const Component1057 = `button`;
  const Component1058 = `video`;
  const Component1059 = `div`;
  const Component1060 = `div`;
  return <Component1060 className={`relative flex flex-col items-center group/node w-full min-w-[200px] min-h-[200px] ${et ? `h-auto` : `h-full`} ${n ? `z-50` : `z-10`}`}>
      <_cmp__Component8 id={e} data={t} defaultTitle={`特惠视频`} icon={<_Component41 size={11} className={`text-gray-500`} />} />
      {!d.loading && <Component955 className={`absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`}>
          <Component954 className={`flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`}>
            <Component950 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md transition-colors`} title={`上传图片、视频或音频素材`} onClick={e => {
          e.stopPropagation();
          N.current?.click();
        }}>
              <_Component0 size={14} />
            </Component950>
            {d.videoUrl && <Q.Fragment>
                <Component951 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md transition-colors`} title={`全屏播放`} onClick={e => {
            e.stopPropagation();
            A(true);
          }}>
                  <Ke size={14} />
                </Component951>
                <Component952 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md transition-colors`} title={`下载`} onClick={Je}>
                  <_Component6 size={14} />
                </Component952>
                <_cmp_Bn url={d.videoUrl} fallbackExt={`mp4`} onToast={e => {
            return d.onShowToast?.(e);
          }} />
                {d.onDelete && <Component953 className={`p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors`} title={`删除`} onClick={e => {
            e.stopPropagation();
            d.onDelete?.();
          }}>
                    <Ot size={14} />
                  </Component953>}
              </Q.Fragment>}
          </Component954>
        </Component955>}
      <_cmp__Component9 visible={!!n} minWidth={200} minHeight={200} keepAspectRatio={et} />
      <Component956 type={`file`} ref={N} style={{
      display: `none`
    }} accept={`image/*,video/*,audio/*`} onChange={Ye} />
      <Component964 className={`relative bg-[#1c1c1c] rounded-xl border shadow-xl transition-colors duration-300 cursor-pointer group/display flex flex-col overflow-hidden w-full
            ${et ? `` : `flex-1`}
            ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}
        `} style={st} onClick={() => {
      Le(!Ie);
      r(e, {
        expanded: !Ie
      });
    }}>
        <Component963 className={`flex items-center justify-center absolute inset-0 rounded-xl overflow-hidden ${d.videoUrl ? `` : `bg-[#121212]`}`}>
          {d.videoUrl && <Q.Fragment>
              <Component957 src={d.videoUrl} poster={d.thumbnailUrl} className={`max-w-full w-full h-full object-contain block ${d.loading ? `opacity-50 blur-sm` : ``}`} controls={false} autoPlay={false} muted={false} onDoubleClick={e => {
            e.stopPropagation();
            A(true);
          }} />
              {!d.loading && <Component959 className={`absolute inset-0 flex items-center justify-center pointer-events-none`}>
                  <Component958 className={`w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-black/70 transition-all nodrag pointer-events-auto`} title={`播放视频`} onClick={e => {
              e.stopPropagation();
              A(true);
            }}>
                    <_Component13 className={`text-white w-6 h-6`} />
                  </Component958>
                </Component959>}
            </Q.Fragment>}
          {d.loading && <_cmp_Ti label={!d.progress || d.progress === 0 ? `生成中...` : `生成中... ${d.progress}%`} backgroundUrl={d.thumbnailUrl || Y.images[0]?.url}>
              <_cmp_Di category={`video`} />
            </_cmp_Ti>}
          {!d.videoUrl && !d.loading && !d.errorMessage && <Component960 className={`flex flex-col items-center justify-center absolute inset-0 bg-[#151515] pointer-events-none`}>
              <_Component41 size={80} className={`text-gray-700`} strokeWidth={1.2} />
            </Component960>}
          {d.errorMessage && !d.loading && !d.videoUrl && <Component962 className={`absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-500 z-10 bg-[#1a1a1a] p-4 text-center`}>
              <_Component17 size={32} />
              <Component961 className={`text-xs font-medium max-w-full break-words`}>
                {d.errorMessage}
              </Component961>
            </Component962>}
        </Component963>
      </Component964>
      <_cmp__Component12 type={`target`} position={X.Left} variant={`large`} />
      <_cmp__Component12 type={`source`} position={X.Right} variant={`large`} />
      {(() => {
      let t = [...Y.images.map(e => {
        return {
          ...e,
          resType: `image`,
          isConnected: true
        };
      }), ...Y.videos.map(e => {
        return {
          ...e,
          resType: `video`,
          isConnected: true
        };
      }), ...Y.audios.map(e => {
        return {
          ...e,
          resType: `audio`,
          isConnected: true
        };
      }), ...de.filter(e => {
        let t = Y.images.some(t => {
          return t.id === e.id;
        });
        let n = Y.videos?.some(t => {
          return t.id === e.id;
        });
        let r = Y.audios?.some(t => {
          return t.id === e.id;
        });
        let i = [...Y.images, ...(Y.videos || []), ...(Y.audios || [])].some(t => {
          return t.id === e.id;
        });
        return !t && !n && !r && i;
      }).map(e => {
        return {
          id: e.id,
          url: e.url,
          resType: e.type.startsWith(`image`) ? `image` : e.type.startsWith(`video`) ? `video` : `audio`,
          isConnected: false,
          sourceNodeId: e.sourceNodeId
        };
      })].sort((e, t) => {
        let n = p.indexOf(e.id);
        let r = p.indexOf(t.id);
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
      let n = (n, i) => {
        if (!n || !i || n === i) {
          return;
        }
        let a = t.map(e => {
          return e.id;
        });
        let o = a.indexOf(n);
        let s = a.indexOf(i);
        if (o === -1 || s === -1) {
          return;
        }
        let c = [...a];
        c.splice(o, 1);
        c.splice(s, 0, n);
        m(c);
        r(e, {
          resourceOrder: c
        });
      };
      let a = 0;
      let o = 0;
      let c = 0;
      let l = d.inputWidth ? `${d.inputWidth}px` : undefined;
      let u = d.inputHeight ? `${d.inputHeight}px` : `80px`;
      const Component973 = `span`;
      const Component974 = `div`;
      const Component975 = `div`;
      const Component976 = `div`;
      const Component977 = `span`;
      const Component978 = `div`;
      const Component979 = `button`;
      const Component980 = `div`;
      const Component991 = `div`;
      const Component992 = `div`;
      const Component993 = `div`;
      const Component994 = `div`;
      const Component995 = `div`;
      const Component996 = `span`;
      const Component997 = `button`;
      const Component998 = `div`;
      const Component999 = `button`;
      const Component1000 = `div`;
      const Component1001 = `span`;
      const Component1002 = `input`;
      const Component1003 = `div`;
      const Component1004 = `div`;
      const Component1005 = `div`;
      const Component1006 = `div`;
      const Component1007 = `button`;
      const Component1008 = `div`;
      const Component1009 = `div`;
      const Component1010 = `div`;
      const Component1011 = `button`;
      const Component1012 = `div`;
      const Component1013 = `input`;
      const Component1014 = `input`;
      const Component1015 = `div`;
      const Component1016 = `div`;
      const Component1017 = `div`;
      const Component1018 = `div`;
      const Component1019 = `div`;
      const Component1020 = `span`;
      const Component1021 = `span`;
      const Component1022 = `button`;
      const Component1030 = `div`;
      const Component1031 = `div`;
      const Component1032 = `div`;
      const Component1033 = `div`;
      const Component1034 = `button`;
      const Component1035 = `div`;
      const Component1036 = `div`;
      const Component1039 = `div`;
      const Component1040 = `div`;
      const Component1041 = `div`;
      const Component1042 = `span`;
      const Component1043 = `button`;
      const Component1044 = `div`;
      const Component1045 = `button`;
      const Component1046 = `div`;
      const Component1047 = `div`;
      const Component1050 = `div`;
      const Component1051 = `button`;
      const Component1052 = `div`;
      const Component1053 = `div`;
      const Component1054 = `div`;
      const Component1055 = `div`;
      let k = <Component1055 className={`space-y-3`}>
            <Component995 className={`flex flex-col gap-2 mb-2`}>
              {(t.length > 0 || Y.texts.length > 0) && <Component975 className={`flex flex-wrap gap-2 mb-1`}>
                  {t.map(t => {
              let s = 0;
              let l = ``;
              if (t.resType === `image`) {
                a++;
                s = a;
                l = `图片${s}`;
              } else if (t.resType === `video`) {
                o++;
                s = o;
                l = `视频${s}`;
              } else {
                c++;
                s = c;
                l = `音频${s}`;
              }
              const Component965 = `img`;
              const Component966 = `div`;
              const Component967 = `div`;
              const Component968 = `div`;
              const Component969 = `div`;
              const Component970 = `button`;
              const Component971 = `div`;
              const Component972 = `div`;
              return <Component972 className={`w-10 h-10 rounded-md overflow-hidden border border-[#444] relative group bg-black cursor-grab active:cursor-grabbing nodrag nopan`} title={t.isConnected ? `连线${t.resType === `image` ? `图片` : t.resType === `video` ? `视频` : `音频`} (点击底部标签插入到提示词)` : `通过 @ 选中的素材`} draggable={true} onDragStart={e => {
                e.stopPropagation();
                f.current = t.id;
                e.dataTransfer.setData(`text/plain`, t.id);
                e.dataTransfer.effectAllowed = `move`;
              }} onDragOver={e => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = `move`;
              }} onDragEnter={e => {
                e.preventDefault();
                e.stopPropagation();
                let r = f.current;
                if (r && r !== t.id) {
                  n(r, t.id);
                }
              }} onDrop={e => {
                e.preventDefault();
                e.stopPropagation();
                n(f.current || e.dataTransfer.getData(`text/plain`), t.id);
                f.current = null;
              }} onDragEnd={() => {
                f.current = null;
              }} key={`res-${t.id}`}>
                        {t.resType === `image` ? <Component965 src={t.url} alt={`Ref`} className={`w-full h-full object-cover pointer-events-none`} /> : t.resType === `video` ? <Component967 className={`w-full h-full relative cursor-pointer`} onDoubleClick={e => {
                  e.stopPropagation();
                  let n = document.createElement(`video`);
                  n.src = t.url;
                  n.controls = true;
                  n.style.position = `fixed`;
                  n.style.top = `50%`;
                  n.style.left = `50%`;
                  n.style.transform = `translate(-50%, -50%)`;
                  n.style.maxWidth = `90vw`;
                  n.style.maxHeight = `90vh`;
                  n.style.zIndex = `999999`;
                  n.style.backgroundColor = `black`;
                  n.style.boxShadow = `0 25px 50px -12px rgba(0, 0, 0, 0.5)`;
                  n.style.borderRadius = `12px`;
                  let r = document.createElement(`div`);
                  r.style.position = `fixed`;
                  r.style.inset = `0`;
                  r.style.backgroundColor = `rgba(0,0,0,0.9)`;
                  r.style.zIndex = `999998`;
                  r.style.backdropFilter = `blur(4px)`;
                  r.onclick = () => {
                    if (document.body.contains(n)) {
                      document.body.removeChild(n);
                    }
                    if (document.body.contains(r)) {
                      document.body.removeChild(r);
                    }
                  };
                  document.body.appendChild(r);
                  document.body.appendChild(n);
                  n.play().catch(() => {});
                }}>
                            <Component966 className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                              <Pt size={16} className={`text-purple-400 opacity-80 pointer-events-none`} />
                            </Component966>
                          </Component967> : <Component969 className={`w-full h-full relative cursor-pointer`} onDoubleClick={e => {
                  e.stopPropagation();
                  let n = document.createElement(`audio`);
                  n.src = t.url;
                  n.controls = true;
                  n.style.position = `fixed`;
                  n.style.top = `50%`;
                  n.style.left = `50%`;
                  n.style.transform = `translate(-50%, -50%)`;
                  n.style.maxWidth = `90vw`;
                  n.style.maxHeight = `90vh`;
                  n.style.zIndex = `999999`;
                  n.style.boxShadow = `0 0 0 100vmax rgba(0,0,0,0.8)`;
                  document.body.appendChild(n);
                  n.play();
                  let r = e => {
                    if (e.target !== n) {
                      n.pause();
                      document.body.removeChild(n);
                      document.removeEventListener(`click`, r);
                    }
                  };
                  setTimeout(() => {
                    return document.addEventListener(`click`, r);
                  }, 100);
                }}>
                            <Component968 className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                              <Be size={16} className={`text-yellow-500 pointer-events-none`} />
                            </Component968>
                          </Component969>}
                        <_Component42 resId={t.id} resUrl={t.url} resType={t.resType} />
                        <Component970 type={`button`} className={`absolute bottom-0 left-0 right-0 bg-blue-500/80 hover:bg-blue-500 text-[8px] text-white text-center py-0.5 truncate cursor-pointer transition-colors z-10`} title={`点击插入 @${l}`} onMouseDown={e => {
                  return e.preventDefault();
                }} onClick={e => {
                  e.stopPropagation();
                  Xe(l);
                }}>
                          {l}
                        </Component970>
                        <Component971 className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all z-20`} onClick={n => {
                  n.stopPropagation();
                  if (t.isConnected) {
                    i(n => {
                      return n.filter(n => {
                        return n.target !== e || n.source !== t.sourceNodeId;
                      });
                    });
                  } else {
                    let n = de.filter(e => {
                      return e.id !== t.id;
                    });
                    pe(n);
                    r(e, {
                      selectedContextResources: n
                    });
                  }
                }}>
                          <Gt size={10} className={`text-white`} />
                        </Component971>
                      </Component972>;
            })}
                  {Y.texts.map((e, t) => {
              return <Component974 className={`h-8 px-2 bg-[#2a2a2a] border border-[#444] rounded flex items-center gap-1 text-[10px] text-gray-300 hover:bg-[#333] hover:border-blue-500 hover:text-blue-400 transition-colors cursor-help group/text`} title={e.text} key={`txt-${t}`}>
                        <_Component18 size={10} />
                        <Component973 className={`max-w-[80px] truncate`}>{e.label}</Component973>
                      </Component974>;
            })}
                </Component975>}
              <Component994 className={`flex items-start gap-2`}>
                <Component993 className={`flex-1 nodrag relative shrink-0`} ref={ue} style={{
              width: j ? `100%` : l,
              height: j ? `100%` : u,
              minHeight: `80px`
            }}>
                  <_cmp__Component19 text={h} names={Ze} placeholder={`描述你想要的视频内容 (输入 @ 调出素材)...`} scrollTop={oe.top} scrollLeft={oe.left} className={`absolute inset-0 z-0 custom-scrollbar`} style={{
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
                  <Component976 ref={G} contentEditable={true} suppressContentEditableWarning={true} spellCheck={false} className={`relative z-10 w-full h-full bg-transparent text-transparent caret-white min-h-[80px] outline-none custom-scrollbar nowheel nopan nodrag overflow-auto whitespace-pre-wrap`} style={{
                resize: `none`,
                width: `100%`,
                height: `100%`,
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
              }} onInput={t => {
                let n = t.currentTarget;
                let i = n.innerText.replace(/\u00a0/g, ` `);
                let a = mo(n);
                se.current = a;
                ce.current = n.innerHTML;
                g(i);
                r(e, {
                  prompt: i
                });
                let o = i.substring(0, a);
                let s = o.lastIndexOf(`@`);
                if (s >= 0) {
                  let e = o.substring(s + 1);
                  if (e === `` || /^\d+$/.test(e)) {
                    ae(s);
                    V(true);
                  } else {
                    ae(-1);
                    V(false);
                  }
                } else {
                  ae(-1);
                  V(false);
                }
                if (!j && (!d.inputHeight || d.inputHeight <= 200)) {
                  requestAnimationFrame(() => {
                    let t = G.current;
                    let n = t?.parentElement;
                    if (t) {
                      t.style.height = `auto`;
                      let i = Math.max(80, Math.min(t.scrollHeight, 200));
                      t.style.height = `${i}px`;
                      if (n) {
                        n.style.height = `${i}px`;
                      }
                      r(e, {
                        inputHeight: i
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
                    let r = go(h, Ze, n, e.key);
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
                  let r = _o(h, n, h.lastIndexOf(`@`, n - 1), Ze);
                  if (r) {
                    e.preventDefault();
                    le(r.text, r.cursor);
                    V(false);
                    ae(-1);
                    requestAnimationFrame(() => {
                      return ho(t, r.cursor);
                    });
                    return;
                  }
                }
                if (e.key === `Enter`) {
                  if (e.ctrlKey || e.metaKey) {
                    qe();
                    e.preventDefault();
                    return;
                  }
                  let r = _o(h, n, h.lastIndexOf(`@`, n - 1), Ze);
                  e.preventDefault();
                  let i = (() => {
                    if (r) {
                      return {
                        text: r.text,
                        cursor: r.cursor
                      };
                    }
                    let e = h.substring(0, n);
                    let t = h.substring(n);
                    return {
                      text: `${e}
${t}`,
                      cursor: e.length + 1
                    };
                  })();
                  le(i.text, i.cursor);
                  if (r) {
                    V(false);
                    ae(-1);
                  }
                  requestAnimationFrame(() => {
                    return ho(t, i.cursor);
                  });
                  return;
                }
                if (e.key === `Escape` && re) {
                  V(false);
                }
              }} onScroll={e => {
                return H({
                  top: e.currentTarget.scrollTop,
                  left: e.currentTarget.scrollLeft
                });
              }} onWheel={e => {
                return e.stopPropagation();
              }} />
                  {re && <Component992 className={`absolute bottom-[calc(100%+4px)] left-0 w-72 bg-[#222] border border-[#444] rounded-lg shadow-2xl z-[999999] flex flex-col overflow-hidden h-[300px] nopan`} onWheel={e => {
                return e.stopPropagation();
              }} onClick={e => {
                return e.stopPropagation();
              }}>
                      <Component980 className={`flex items-center justify-between p-2 border-b border-[#333] bg-[#1a1a1a]`}>
                        <Component978 className={`text-xs text-gray-300 font-bold flex items-center gap-2`}>
                          <Component977>{`选择素材引用`}</Component977>
                        </Component978>
                        <Component979 onClick={() => {
                    return V(false);
                  }} className={`text-gray-500 hover:text-white p-1`}>
                          <Gt size={12} />
                        </Component979>
                      </Component980>
                      <Component991 className={`p-2 flex-1 overflow-y-auto custom-scrollbar nowheel nopan nodrag`}>
                        {(() => {
                    let e = [...Y.images.map(e => {
                      return {
                        id: e.id,
                        url: e.url,
                        type: `image`
                      };
                    }), ...Y.videos.map(e => {
                      return {
                        id: e.id,
                        url: e.url,
                        type: `video`
                      };
                    }), ...Y.audios.map(e => {
                      return {
                        id: e.id,
                        url: e.url,
                        type: `audio`
                      };
                    })];
                    if (e.length === 0) {
                      const Component981 = `div`;
                      return <Component981 className={`text-center text-gray-500 text-xs py-10`}>{`暂无素材，请先上传`}</Component981>;
                    } else {
                      const Component982 = `img`;
                      const Component983 = `video`;
                      const Component984 = `span`;
                      const Component985 = `div`;
                      const Component986 = `div`;
                      const Component987 = `span`;
                      const Component988 = `div`;
                      const Component989 = `div`;
                      const Component990 = `div`;
                      return <Component990 className={`grid grid-cols-4 gap-1.5`}>
                                {e.map(e => {
                          return <Component989 className={`aspect-square bg-[#111] rounded border border-[#333] hover:border-blue-500 cursor-pointer overflow-hidden relative group`} onClick={() => {
                            Xe(Qe(e), true);
                            ae(-1);
                            V(false);
                          }} key={e.id}>
                                      {e.type.startsWith(`image`) ? <Component982 src={e.url} className={`w-full h-full object-cover`} /> : e.type.startsWith(`video`) ? <Component983 src={e.url} className={`w-full h-full object-cover`} /> : e.type.startsWith(`audio`) ? <Component985 className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                                          <Component984 className={`text-[10px] text-gray-400`}>{`音频`}</Component984>
                                        </Component985> : <Component986 className={`p-1 text-[8px] text-gray-400 break-all overflow-hidden h-full`}>
                                          {e.url}
                                        </Component986>}
                                      <Component988 className={`absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity`}>
                                        <Component987 className={`text-[10px] text-white`}>{`选择`}</Component987>
                                      </Component988>
                                    </Component989>;
                        })}
                              </Component990>;
                    }
                  })()}
                      </Component991>
                    </Component992>}
                </Component993>
              </Component994>
            </Component995>
            <Component1054 className={`flex items-center justify-between pt-2 border-t border-[#2a2a2a] nodrag`}>
              <Component1041 className={`flex items-center gap-1.5 overflow-visible z-50`}>
                <Component1018 className={`relative nodrag flex items-center`} ref={B}>
                  <Component997 className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`} onClick={e => {
                e.stopPropagation();
                ne(!z);
              }} title={`选择比例和时长`}>
                    <T size={12} className={`opacity-70`} />
                    <Component996 className={`whitespace-nowrap`}>
                      {Os.find(e => {
                    return e.value === _;
                  })?.label || `16:9`}
                      {` · `}
                      {S}
                      {` · `}
                      {w}
                      {`s`}
                    </Component996>
                  </Component997>
                  {z && <Component1017 className={`absolute bottom-full left-0 mb-1 w-72 bg-[#222] border border-[#333] rounded-lg shadow-xl p-3 z-50 flex flex-col gap-3 max-h-none overflow-visible nopan nodrag`} onClick={e => {
                return e.stopPropagation();
              }}>
                      <Component1005>
                        <Component998 className={`text-[10px] text-gray-500 mb-2 px-1`}>{`比例`}</Component998>
                        <Component1000 className={`flex flex-wrap gap-1.5 mb-2`}>
                          {Oe.filter(e => {
                      if (D.startsWith(`grok-`) || D.startsWith(`firefly-`)) {
                        return e.value === `16:9` || e.value === `9:16`;
                      } else {
                        return true;
                      }
                    }).map(t => {
                      return <Component999 className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ${_ === t.value ? `bg-[#444] text-white` : `bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} onClick={() => {
                        y(t.value);
                        r(e, {
                          size: t.value
                        });
                        localStorage.setItem(`mutiwindow_discountvideo_size`, t.value);
                      }} key={t.value}>
                                {t.label}
                              </Component999>;
                    })}
                        </Component1000>
                        {_ === `custom` && <Component1004 className={`bg-[#1c1c1c] p-2 rounded border border-[#333] mb-2 flex flex-col gap-2`}>
                            <Component1003 className={`flex items-center gap-2`}>
                              <Component1001 className={`text-[10px] text-gray-500 w-10`}>{`比例:`}</Component1001>
                              <Component1002 type={`text`} value={b} onChange={e => {
                        return x(e.target.value);
                      }} placeholder={`如 16:9`} className={`flex-1 bg-[#121212] border border-[#444] rounded px-2 py-1 text-[11px] text-gray-200 outline-none focus:border-blue-500`} />
                            </Component1003>
                          </Component1004>}
                      </Component1005>
                      <Component1009>
                        <Component1006 className={`text-[10px] text-gray-500 mb-2 px-1`}>{`分辨率`}</Component1006>
                        <Component1008 className={`flex flex-wrap gap-1.5 mb-3`}>
                          {K.map(t => {
                      return <Component1007 className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ${S === t.value ? `bg-[#444] text-white` : `bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} onClick={() => {
                        C(t.value);
                        r(e, {
                          resolution: t.value
                        });
                        localStorage.setItem(`mutiwindow_discountvideo_resolution`, t.value);
                      }} key={t.value}>
                                {t.label}
                              </Component1007>;
                    })}
                        </Component1008>
                      </Component1009>
                      <Component1016>
                        <Component1010 className={`text-[10px] text-gray-500 mb-2 px-1`}>{`时长 (秒)`}</Component1010>
                        {Ae && Fe ? <Component1012 className={`flex flex-wrap gap-1.5 px-1 mb-1`}>
                            {je.map(t => {
                      return <Component1011 type={`button`} className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ${String(t) === w ? `bg-[#444] text-white` : `bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} onClick={() => {
                        E(String(t));
                        r(e, {
                          selectedSeconds: String(t)
                        });
                        localStorage.setItem(`mutiwindow_discountvideo_seconds`, String(t));
                      }} key={t}>
                                  {t}
                                  {`s`}
                                </Component1011>;
                    })}
                          </Component1012> : <Component1015 className={`flex items-center gap-2 px-1`}>
                            <Component1013 type={`range`} min={Me} max={Ne} step={Pe} value={w} onChange={t => {
                      E(t.target.value);
                      r(e, {
                        selectedSeconds: t.target.value
                      });
                      localStorage.setItem(`mutiwindow_discountvideo_seconds`, t.target.value);
                    }} className={`flex-1 accent-blue-500`} />
                            <Component1014 type={`number`} value={w} onChange={t => {
                      let n = t.target.value;
                      E(n);
                      r(e, {
                        selectedSeconds: n
                      });
                      localStorage.setItem(`mutiwindow_discountvideo_seconds`, n);
                    }} className={`w-12 bg-[#1c1c1c] text-gray-200 border border-[#333] rounded px-1 py-0.5 text-xs outline-none text-center`} />
                          </Component1015>}
                      </Component1016>
                    </Component1017>}
                </Component1018>
                {Te.length > 0 && <Component1040 className={`relative nodrag flex items-center`} ref={te}>
                    <Component1019 className={`w-[1px] h-3 bg-[#444] mr-1.5`} />
                    <Component1022 className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`} onClick={e => {
                e.stopPropagation();
                F(e => {
                  if (e) {
                    R(null);
                  }
                  return !e;
                });
              }} title={D ? `${D}（${ca(D) ? `内置` : `第三方`}）` : `选择 AI 模型`}>
                      {D && <Component1020 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${ca(D) ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                          {ca(D) ? `内置` : `三方`}
                        </Component1020>}
                      <Component1021 className={`whitespace-nowrap`}>
                        {D || `选择模型`}
                      </Component1021>
                    </Component1022>
                    {P && <Component1039 className={`absolute bottom-full left-0 mb-1 bg-[#222] border border-[#333] rounded-lg shadow-xl z-50 flex items-stretch nowheel nopan nodrag`} onClick={e => {
                return e.stopPropagation();
              }}>
                        <Component1036 className={`w-max min-w-[13rem] max-w-[24rem] shrink-0 flex flex-col border-r border-[#333]`}>
                          <Component1033 className={`relative flex-1 min-h-0`}>
                            <Component1030 className={`p-2 max-h-[24rem] overflow-x-hidden overflow-y-auto no-scrollbar`}>
                              {(() => {
                        let t = Te;
                        let n = t.filter(e => {
                          return ca(e);
                        });
                        let i = t.filter(e => {
                          return !ca(e);
                        });
                        let a = (t, n, i) => {
                          let a = i ? ta(t) : null;
                          let o = i ? na(t) : null;
                          let s = fa(t, D === t);
                          const Component1023 = `span`;
                          const Component1024 = `span`;
                          const Component1025 = `span`;
                          const Component1026 = `span`;
                          const Component1027 = `div`;
                          return <Component1027 role={`button`} className={`relative ${s.className}`} onClick={() => {
                            if (!s.disabled) {
                              O(t);
                              r(e, {
                                selectedModel: t
                              });
                              localStorage.setItem(`mutiwindow_discountvideo_model`, t);
                              F(false);
                              R(null);
                            }
                          }} onMouseEnter={() => {
                            return R(t);
                          }} onMouseLeave={() => {
                            return R(e => {
                              if (e === t) {
                                return null;
                              } else {
                                return e;
                              }
                            });
                          }} title={s.title} key={`${i ? `b` : `o`}-${n}`}>
                                      <Component1023 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${i ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                                        {i ? `内置` : `三方`}
                                      </Component1023>
                                      <Component1024 className={`flex-1 whitespace-nowrap`}>
                                        {t}
                                      </Component1024>
                                      {a !== null && <Component1026 className={`shrink-0 inline-flex items-center gap-0.5 text-[10px] text-yellow-300 tabular-nums`}>
                                          <_cmp__s className={`w-2.5 h-2.5`} />
                                          <Component1025>
                                            {la(a)}
                                            {o ? `/${o}` : ``}
                                          </Component1025>
                                        </Component1026>}
                                    </Component1027>;
                        };
                        const Component1028 = `div`;
                        const Component1029 = `div`;
                        return <Q.Fragment>
                                    {n.length > 0 && <Component1028 className={`text-[9px] text-gray-500 px-2 pt-0.5 pb-1`}>{`内置模型`}</Component1028>}
                                    {n.map((e, t) => {
                            return a(e, t, true);
                          })}
                                    {i.length > 0 && <Component1029 className={`text-[9px] text-gray-500 px-2 pt-1.5 pb-1`}>{`第三方模型`}</Component1029>}
                                    {i.map((e, t) => {
                            return a(e, t, false);
                          })}
                                  </Q.Fragment>;
                      })()}
                            </Component1030>
                            <Component1031 className={`pointer-events-none absolute top-0 left-0 right-0 h-5 bg-gradient-to-b from-[#222] to-transparent`} />
                            <Component1032 className={`pointer-events-none absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-t from-[#222] to-transparent`} />
                          </Component1033>
                          <Component1035 className={`shrink-0 p-2 border-t border-[#333]`}>
                            <Component1034 type={`button`} className={`w-full text-center px-2 py-1.5 text-[11px] text-blue-400 hover:text-blue-300 hover:bg-[#2a2a2a] rounded-md transition-colors cursor-pointer`} onClick={e => {
                      e.stopPropagation();
                      F(false);
                      R(null);
                      ee(true);
                    }}>{`详细对比`}</Component1034>
                          </Component1035>
                        </Component1036>
                        {(() => {
                  let e = (L && ca(L) ? L : null) || (D && ca(D) ? D : null) || Te.find(e => {
                    return ca(e);
                  }) || null;
                  const Component1037 = `div`;
                  const Component1038 = `div`;
                  return <Component1038 className={`w-72 shrink-0 p-2 max-h-[28rem] overflow-x-hidden overflow-y-auto no-scrollbar`}>
                              {e ? <_cmp_Ts name={e} entry={Ee[e]} bare={true} /> : <Component1037 className={`h-full flex items-center justify-center text-[11px] text-gray-500`}>{`悬停内置模型查看详情`}</Component1037>}
                            </Component1038>;
                })()}
                      </Component1039>}
                  </Component1040>}
                <_cmp_Es_1 open={I} modelNames={Te} specsByName={Ee} selectedModel={D} onClose={() => {
              return ee(false);
            }} onConfirm={t => {
              O(t);
              r(e, {
                selectedModel: t
              });
              localStorage.setItem(`mutiwindow_discountvideo_model`, t);
              ee(false);
            }} />
                <_cmp__Component21 category={`video`} presetPrompts={d.presetPrompts || []} onApply={t => {
              let n = h ? `${h}, ${t}` : t;
              g(n);
              r(e, {
                prompt: n
              });
            }} onToast={e => {
              return d.onShowToast?.(e);
            }} />
              </Component1041>
              <Component1053 className={`flex items-center gap-3 flex-shrink-0 ml-2`}>
                {d.loading ? <Component1047 className={`flex items-center gap-1.5`}>
                    <Component1043 className={`flex items-center gap-1 text-gray-400 hover:text-white bg-[#222] hover:bg-[#333] border border-[#333] hover:border-gray-500 rounded-full px-2.5 py-1 transition-colors`} onClick={t => {
                t.stopPropagation();
                d.onRefresh?.(e);
              }} title={`刷新状态`}>
                      <_Component25 size={12} />
                      <Component1042 className={`text-[10px]`}>{`刷新`}</Component1042>
                    </Component1043>
                    <Component1046 className={`flex items-center bg-red-500/10 rounded-full p-1 pl-3 border border-red-500/30 hover:border-red-500/50 transition-colors cursor-pointer group/btn`} onClick={t => {
                t.stopPropagation();
                d.onStop?.(e);
              }}>
                      <Component1044 className={`flex items-center gap-1 mr-3 text-xs text-red-400 group-hover/btn:text-red-300`}>{`停止`}</Component1044>
                      <Component1045 className={`bg-red-500/20 text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-500/30 transition-colors`}>
                        <T size={10} fill={`currentColor`} />
                      </Component1045>
                    </Component1046>
                  </Component1047> : <Component1052 className={`flex items-center bg-[#2a2a2a] rounded-full p-1 pl-3 border border-[#333] hover:border-gray-500 transition-colors cursor-pointer group/btn`} onClick={e => {
              e.stopPropagation();
              qe();
            }}>
                    {D && ca(D) && ta(D) !== null && (() => {
                let e = ta(D);
                let t = na(D);
                let n = t === `秒` || t === `s` || t === `sec`;
                let r = parseInt(w, 10) || 0;
                let i = n ? e * r : e;
                const Component1048 = `span`;
                const Component1049 = `div`;
                return <Component1049 className={`flex items-center gap-0.5 mr-2 text-[12px] text-yellow-300 tabular-nums`} title={`预计消耗 ${la(i)} 特惠币${n ? `（${la(e)}/秒 × ${r}秒）` : ``}`}>
                            <_cmp__s className={`w-3.5 h-3.5`} />
                            <Component1048>{la(i)}</Component1048>
                          </Component1049>;
              })()}
                    <Component1050 className={`flex items-center gap-1 mr-3 text-xs text-gray-300 group-hover/btn:text-white`}>{`生成`}</Component1050>
                    <Component1051 className={`bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors`}>
                      <_Component22 size={14} strokeWidth={3} />
                    </Component1051>
                  </Component1052>}
              </Component1053>
            </Component1054>
          </Component1055>;
      const Component1056 = `div`;
      return <Q.Fragment>
            <Component1056 className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[#1c1c1c] rounded-2xl border border-[#333] shadow-2xl min-w-[500px] w-max max-w-[920px] transition-all duration-300 origin-top z-50
                ${Ie ? `opacity-100 scale-100 p-4 overflow-visible` : `opacity-0 scale-95 pointer-events-none h-0 p-0 border-0 overflow-hidden`}
              `} onClick={e => {
          return e.stopPropagation();
        }}>
              {!j && k}
              {Ie && !j && <_cmp__Component23 targetRef={ue} onRequestFullscreen={() => {
            return M(true);
          }} onResizeEnd={(t, n) => {
            return r(e, {
              inputWidth: t,
              inputHeight: n
            });
          }} />}
            </Component1056>
            <_cmp_Ai open={j} title={`编辑提示词 - 特惠视频`} onClose={() => {
          return M(false);
        }}>
              {k}
            </_cmp_Ai>
          </Q.Fragment>;
    })()}
      {k && d.videoUrl && Fn.createPortal(<Component1059 className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md`} onClick={() => {
      return A(false);
    }}>
            <Component1057 className={`absolute top-6 right-6 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-50`} onClick={() => {
        return A(false);
      }}>
              <Gt size={32} />
            </Component1057>
            <Component1058 src={d.videoUrl} className={`max-w-[95vw] max-h-[95vh] object-contain shadow-2xl rounded-lg outline-none`} controls={true} autoPlay={true} onClick={e => {
        return e.stopPropagation();
      }} onDoubleClick={e => {
        e.stopPropagation();
        A(true);
      }} />
          </Component1059>, document.body)}
    </Component1060>;
});
export default As;