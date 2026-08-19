// TODO(全局, 无需 import): data, selected, updateNodeData, setEdges, addNodes, addEdges, getNodes, setNodes, getNode, f, left, n, r, le, i, prompt, uploadedAssets, setUploadedAssets, uploadingAssetsRef, failedAssetsRef, uploadAsset, getAssetStatus, clearAllFailedAssets, nodeId, initialUploadedAssets, onUploadAsset, onShowToast, b, z, ke, je, label, value, min, max, resolution, aspectRatio, seconds, resolutions, aspectRatios, durations, k, selectedModel, size, selectedSeconds, q, ye, ve, resId, resUrl, resType, url, type, handleType, images, videos, audios, texts, o, s, sourceNodeId, assetName, l, u, text, xe, g, et, x, modelName, imageCount, videoCount, audioCount, filename, saveAs, subfolder, preferThumbnail, thumbMaxDim, thumbQuality, position, imageUrl, thumbnailUrl, source, videoUrl, videoName, audioUrl, audioName, de, st, ct, ut, pt, ht, width, height, style, m, p, mt, display, rt, gt, expanded, isConnected, resourceOrder, selectedContextResources, me, minHeight, at, fontSize, lineHeight, padding, margin, border, boxSizing, fontFamily, fontWeight, letterSpacing, tabSize, wordBreak, whiteSpace, resize, overflow, scrollbarGutter, ae, maxHeight, inputHeight, tt, cursor, oe, se, ot, ee, inputWidth, marginTop, visibility
import _cmp_Ti from './Ti.jsx';
import _cmp_Bn from './Bn.jsx';
import _cmp_Ei from './Ei.jsx';
import _cmp__Component15 from './_Component15.jsx';
import _cmp_Ni from './Ni.jsx';
import _cmp__Component18 from './_Component18.jsx';
import _cmp_As from './As.jsx';
import _cmp_Rs from './Rs.jsx';
import _cmp__Component41 from './_Component41.jsx';
import _cmp__Component20 from './_Component20.jsx';
import _cmp_Fi from './Fi.jsx';
import _cmp_Ii from './Ii.jsx';
import _cmp__Component10 from './_Component10.jsx';
import _cmp_jr from './jr.jsx';
import _cmp_Ks from './Ks.jsx';
import _cmp_So from './So.jsx';
import { id, We, nn, pe, qs, e, Eo, ce, G, ue, _, ls, ge, we, E, D, C, w, y, Ee, re, B, I, te, ne, F, ta, ra, De, ea, Qi, $i, K, oa, Oe, O, Ae, Cs, Xs, Ys, Ss, _s, ws, Ts, J, Ne, Es, Fe, Te, Me, Ue, be, Se, Ge, Lt, Qt, Je, Ye, Va, Js, he, Xe, Ze, $e, _e, Qe, Ce, Os, xi, xo, ie, ft, lt, h, Y, P, j, nt, it, M, U, H, W, Co, wo, Do, Oo, V, To, Fn, ti, S, Pe, Ve, Ie, Le, Re, ma, sa, ca, va, He, ha, R, L, N, X, _t, A, _Component22, Be, _Component39, _Component8, Ke, _Component6, Ot, _Component11, _Component16, Pt, _Component36, Gt, _Component17, T, _Component21 } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
var Zs = Z.memo(({
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
  let d = nn();
  let f = t;
  let p = Z.useRef(null);
  let [m, h] = Z.useState(() => {
    return f.resourceOrder || [];
  });
  let [g, _] = Z.useState(f.prompt || ``);
  let [y, b] = Z.useState(f.size || localStorage.getItem(`mutiwindow_discountvideo_size`) || `16:9`);
  let [x, S] = Z.useState(`16:9`);
  let [C, w] = Z.useState(f.resolution || localStorage.getItem(`mutiwindow_discountvideo_resolution`) || `1080p`);
  let [E, D] = Z.useState(f.selectedSeconds || localStorage.getItem(`mutiwindow_discountvideo_seconds`) || `10`);
  let [O, k] = Z.useState(f.selectedModel || localStorage.getItem(`mutiwindow_discountvideo_model`) || f.discountVideoModel && f.discountVideoModel.split(`
`)[0].trim() || ``);
  let [A, j] = Z.useState(false);
  let [M, N] = Z.useState(false);
  let P = Z.useRef(null);
  let [F, I] = Z.useState(false);
  let [L, ee] = Z.useState(false);
  let [R, te] = Z.useState(null);
  let z = Z.useRef(null);
  let [ne, B] = Z.useState(false);
  let re = Z.useRef(null);
  let [V, H] = Z.useState(false);
  let [ie, ae] = Z.useState(-1);
  let [U, oe] = Z.useState({
    top: 0,
    left: 0
  });
  let [se, W] = Z.useState(null);
  let G = Z.useRef(0);
  let ce = Z.useRef(``);
  let le = Z.useRef(false);
  let ue = (e, t) => {
    let n = pe.current;
    let r = qs(e);
    if (n) {
      n.innerHTML = r;
      if (t !== undefined) {
        requestAnimationFrame(() => {
          if (pe.current) {
            pe.current.focus();
            Eo(pe.current, t);
          }
        });
      }
    }
    ce.current = r;
    G.current = t ?? e.length;
  };
  let de = (t, n) => {
    let i = n ?? t.length;
    le.current = true;
    ue(t, i);
    _(t);
    r(e, {
      prompt: t
    });
  };
  let pe = Z.useRef(null);
  let me = Z.useRef(null);
  let [he, ge] = Z.useState(f.selectedContextResources || []);
  let {
    uploadedAssets: _e,
    setUploadedAssets: ve,
    uploadingAssetsRef: ye,
    failedAssetsRef: be,
    uploadAsset: xe,
    getAssetStatus: Se,
    clearAllFailedAssets: Ce
  } = ls({
    nodeId: e,
    initialUploadedAssets: f.uploadedAssets,
    updateNodeData: r,
    onUploadAsset: f.onUploadAsset,
    onShowToast: f.onShowToast
  });
  Z.useEffect(() => {
    if (f.selectedContextResources) {
      ge(f.selectedContextResources);
    }
  }, [f.selectedContextResources]);
  let we = Z.useRef(false);
  let Te = () => {
    we.current = true;
    window.setTimeout(() => {
      we.current = false;
    }, 300);
  };
  Z.useEffect(() => {
    if (!we.current) {
      if (f.selectedSeconds !== undefined && f.selectedSeconds !== E) {
        D(f.selectedSeconds);
      }
    }
  }, [f.selectedSeconds]);
  Z.useEffect(() => {
    if (!we.current) {
      if (f.resolution !== undefined && f.resolution !== C) {
        w(f.resolution);
      }
    }
  }, [f.resolution]);
  Z.useEffect(() => {
    if (!we.current) {
      if (f.size !== undefined && f.size !== y) {
        b(f.size);
      }
    }
  }, [f.size]);
  let Ee = Z.useRef(qs(f.prompt || ``));
  ce.current = ce.current || Ee.current;
  Z.useEffect(() => {
    let e = f.prompt || ``;
    requestAnimationFrame(() => {
      return ue(e, e.length);
    });
  }, []);
  Z.useLayoutEffect(() => {
    let e = pe.current;
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
    } else if (!t && Ee.current && !e.innerHTML) {
      e.innerHTML = Ee.current;
      ce.current = Ee.current;
    }
  });
  Z.useEffect(() => {
    let e = e => {
      if (re.current && !re.current.contains(e.target)) {
        B(false);
      }
      if (z.current && !z.current.contains(e.target)) {
        I(false);
        te(null);
      }
    };
    if (ne || F) {
      document.addEventListener(`mousedown`, e, true);
    }
    return () => {
      document.removeEventListener(`mousedown`, e, true);
    };
  }, [ne, F]);
  Z.useEffect(() => {
    ta(`/api`).catch(() => {});
  }, []);
  let [, De] = Z.useReducer(e => {
    return e + 1;
  }, 0);
  Z.useEffect(() => {
    return ra(() => {
      return De();
    });
  }, []);
  let Oe = ea();
  let ke = Qi();
  let K = Z.useMemo(() => {
    if (ke.length > 0) {
      return ke;
    } else {
      if (f.discountVideoModel) {
        return f.discountVideoModel.split(`
`).map(e => {
          return e.trim();
        }).filter(Boolean);
      } else {
        return [];
      }
    }
  }, [ke, f.discountVideoModel]);
  let Ae = Z.useMemo(() => {
    let e = $i();
    let t = {};
    for (let n of K) {
      t[n] = oa(n) ?? e?.discountVideoSpecs?.[n] ?? null;
    }
    return t;
  }, [K, f.discountVideoModel, Oe]);
  let je = Z.useMemo(() => {
    if (O) {
      return oa(O) ?? Ae[O] ?? null;
    } else {
      return null;
    }
  }, [O, Ae]);
  let Me = Z.useMemo(() => {
    let e = Cs(je, `resolutions`, Xs.map(e => {
      return e.value;
    })).map(e => {
      return String(e).trim();
    }).filter(Boolean);
    let t = new Set();
    return e.filter(e => {
      if (t.has(e)) {
        return false;
      } else {
        t.add(e);
        return true;
      }
    }).map(e => {
      return Xs.find(t => {
        return t.value === e;
      }) ?? {
        label: e,
        value: e
      };
    });
  }, [je]);
  let q = Z.useMemo(() => {
    let e = Cs(je, `aspectRatios`, Ys.map(e => {
      return e.value;
    })).map(e => {
      return String(e).trim();
    }).filter(Boolean);
    let t = new Set();
    let n = e.filter(e => {
      if (t.has(e)) {
        return false;
      } else {
        t.add(e);
        return true;
      }
    }).map(e => {
      return Ys.find(t => {
        return t.value === e;
      }) ?? {
        label: e,
        value: e
      };
    });
    if (Ss(je, `aspectRatios`)) {
      return n;
    }
    if (!n.some(e => {
      return e.value === `custom`;
    })) {
      let e = Ys.find(e => {
        return e.value === `custom`;
      });
      if (e) {
        n.push(e);
      }
    }
    return n;
  }, [je]);
  let Ne = Z.useMemo(() => {
    return _s(je);
  }, [je]);
  let Pe = Ss(je, `durationSpec`);
  let Fe = Z.useMemo(() => {
    let e = (f.videoDurations || `4
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
    return ws(je, e.length ? e : [4, 6, 8, 10, 12, 15]);
  }, [je, f.videoDurations]);
  let J = Z.useMemo(() => {
    let e = (f.videoDurations || `4
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
    return Ts(je, {
      min: e.length ? Math.min(...e) : 4,
      max: e.length ? Math.max(...e) : 15
    });
  }, [je, f.videoDurations]);
  let Ie = J.min;
  let Le = J.max;
  let Re = J.step;
  let Ve = Ne?.mode === `discrete`;
  let He = t => {
    let n = String(t || ``).trim();
    if (!n) {
      return;
    }
    let i = Es(oa(n) ?? Ae[n] ?? $i()?.discountVideoSpecs?.[n] ?? null, {
      resolution: C,
      aspectRatio: y,
      seconds: f.selectedSeconds || E
    }, {
      resolutions: Xs.map(e => {
        return e.value;
      }),
      aspectRatios: Ys.filter(e => {
        return e.value !== `custom`;
      }).map(e => {
        return e.value;
      }),
      durations: Fe.length ? Fe : [4, 6, 8, 10, 12, 15]
    });
    Te();
    k(n);
    w(i.resolution);
    b(i.aspectRatio);
    D(i.seconds);
    localStorage.setItem(`mutiwindow_discountvideo_model`, n);
    localStorage.setItem(`mutiwindow_discountvideo_resolution`, i.resolution);
    localStorage.setItem(`mutiwindow_discountvideo_size`, i.aspectRatio);
    localStorage.setItem(`mutiwindow_discountvideo_seconds`, i.seconds);
    r(e, {
      selectedModel: n,
      resolution: i.resolution,
      size: i.aspectRatio,
      selectedSeconds: i.seconds
    });
  };
  Z.useEffect(() => {
    if (!O) {
      return;
    }
    let t = Es(je, {
      resolution: C,
      aspectRatio: y,
      seconds: f.selectedSeconds || E
    }, {
      resolutions: Xs.map(e => {
        return e.value;
      }),
      aspectRatios: Ys.filter(e => {
        return e.value !== `custom`;
      }).map(e => {
        return e.value;
      }),
      durations: Fe.length ? Fe : [4, 6, 8, 10, 12, 15]
    });
    if (t.changed) {
      Te();
      w(t.resolution);
      b(t.aspectRatio);
      D(t.seconds);
      localStorage.setItem(`mutiwindow_discountvideo_resolution`, t.resolution);
      localStorage.setItem(`mutiwindow_discountvideo_size`, t.aspectRatio);
      localStorage.setItem(`mutiwindow_discountvideo_seconds`, t.seconds);
      r(e, {
        resolution: t.resolution,
        size: t.aspectRatio,
        selectedSeconds: t.seconds
      });
    }
  }, [O, je, Me, q, Fe, e, r]);
  let [Y, Ue] = Z.useState(f.expanded === undefined ? true : f.expanded);
  Z.useEffect(() => {
    if (f.expanded !== undefined) {
      Ue(f.expanded);
    }
  }, [f.expanded]);
  let Ge = async t => {
    if (f.onUploadAsset) {
      delete be.current[t.id];
      ye.current[t.id] = true;
      try {
        let n = await f.onUploadAsset(t.url, t.type);
        if (!n || typeof n != `string`) {
          throw Error(`网关返回为空`);
        }
        ve(i => {
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
        f.onShowToast?.(`素材重试失败: ${e?.message || e}`);
        be.current[t.id] = true;
      } finally {
        delete ye.current[t.id];
      }
    }
  };
  let _Component40 = ({
    resId: e,
    resUrl: t,
    resType: n
  }) => {
    let r = Se(e, t);
    if (!r.isUploading && !r.isUploaded && !r.isFailed) {
      return null;
    } else if (r.isFailed) {
      const Component953 = `span`;
      const Component954 = `div`;
      return <Component954 className={`absolute inset-0 bg-red-900/70 backdrop-blur-[1px] flex flex-col items-center justify-center cursor-pointer hover:bg-red-900/85 transition-colors group/retry z-10`} title={`上传失败,点击重试`} onClick={r => {
        r.stopPropagation();
        Ge({
          id: e,
          url: t,
          type: n
        });
      }}>
          <_Component22 size={14} className={`text-white drop-shadow-md group-hover/retry:rotate-180 transition-transform duration-300`} />
          <Component953 className={`text-[8px] text-white mt-0.5 font-medium leading-none`}>{`重试`}</Component953>
        </Component954>;
    } else {
      const Component955 = `div`;
      return <Component955 className={`absolute top-0 left-0 p-0.5 pointer-events-none`}>
          {r.isUploading ? <_Component22 size={12} className={`animate-spin drop-shadow-md text-white`} /> : r.isUploaded ? <Be size={12} className={`text-green-500 drop-shadow-md`} /> : null}
        </Component955>;
    }
  };
  let Je = Lt({
    handleType: `target`
  });
  let Ye = Qt(Z.useMemo(() => {
    return Je.map(e => {
      return e.source;
    });
  }, [Je]));
  let Xe = Z.useMemo(() => {
    if (!Ye) {
      return {
        images: [],
        videos: [],
        audios: [],
        texts: []
      };
    }
    let e = Array.isArray(Ye) ? Ye : [Ye];
    let t = [];
    let n = [];
    let r = [];
    let i = [];
    Je.forEach(a => {
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
          let a = o.data.assets || [];
          let s = `${n.description || ``} ${n.prompt || ``} ${n.videoPrompt || ``} ${n.dialogue || ``}`;
          a.forEach(e => {
            if (e?.name && e.imageUrl && Va(s, e.name)) {
              t.push({
                id: `${o.id}-asset-${e.id}`,
                url: e.imageUrl,
                type: `image`,
                sourceNodeId: o.id,
                assetName: e.name
              });
            }
            if (e?.name && (e.category === `character` || e.category === `角色`) && e.audioUrl && Va(s, e.name)) {
              r.push({
                id: `${o.id}-charaudio-${e.id}`,
                url: e.audioUrl,
                type: `audio`,
                sourceNodeId: o.id
              });
            }
          });
          let c = !!n.usePrevShotImageRef || !!n.usePrevShotVideoTail;
          let l = t.length;
          let u = ``;
          if (c) {
            let r = n.selectedTailFrameVariantId || `original`;
            let i = (Array.isArray(n.prevTailFrameVariants) && n.prevTailFrameVariants.length > 0 ? n.prevTailFrameVariants : []).find(e => {
              return e?.id === r && e?.imageUrl;
            });
            if (i) {
              t.push({
                id: `${o.id}-prevsel-${e}-${r}`,
                url: i.imageUrl,
                type: `image`,
                sourceNodeId: o.id
              });
              u = `图片${l + 1}`;
            } else if (Array.isArray(n.prevShotImageRefUrls) && n.prevShotImageRefUrls.length > 0) {
              t.push({
                id: `${o.id}-prevcache-${e}-0`,
                url: n.prevShotImageRefUrls[0],
                type: `image`,
                sourceNodeId: o.id
              });
              u = `图片${l + 1}`;
            }
          }
          let d = [n.videoPrompt || n.prompt || ``, n.dialogue ? `对白/旁白：${n.dialogue}` : ``, n.sound ? `音效：${n.sound}` : ``, n.motion ? `运镜：${n.motion}` : ``].filter(Boolean).join(`
`);
          if (n.usePrevShotImageRef || n.usePrevShotVideoTail) {
            let e = [];
            if (n.usePrevShotImageRef) {
              e.push(`本镜起始画面必须与传入的上一镜参考图的结尾状态视觉完全连续：人物位置、姿态、表情、服装、场景摆设和光影色彩100%一致，不能跳切、不能瞬移、不能换服装/发型/道具`);
            }
            if (n.usePrevShotVideoTail) {
              let t = u ? `（尾帧，已截取为图@${u}）` : `（尾帧，已截取为图）`;
              e.push(`本镜的起始画面必须与传入的上一视频的最后一帧${t}保持零帧硬切连续：人物位置、姿态、表情、服装、场景光线、色彩、角度和构图完全一致，不得出现瞬移或任何视觉跳变`);
            }
            if (e.length > 0) {
              let t = `【镜头衔接硬约束】\n${e.join(`
`)}`;
              if (d) {
                d = `${t}\n${d}`;
              } else {
                d = t;
              }
            }
          }
          if (d) {
            i.push({
              id: `${o.id}-shot-${e}`,
              sourceNodeId: o.id,
              label: `分镜${n.index}${n.duration ? `（${n.duration}）` : ``}`,
              text: d
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
        if (Js(o.data.videoUrl)) {
          r.push({
            id: o.id,
            url: o.data.videoUrl,
            type: `audio`,
            sourceNodeId: o.id
          });
        } else {
          n.push({
            id: o.id,
            url: o.data.videoUrl,
            type: `video`,
            sourceNodeId: o.id
          });
        }
      }
      if (o?.data?.audioUrl && !r.some(e => {
        return e.url === o.data.audioUrl;
      })) {
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
    let l = new Set();
    let u = new Set();
    let d = [];
    r.forEach(e => {
      let t = typeof e.id == `string` && e.id.includes(`-charaudio-`) ? e.id.split(`-charaudio-`)[1] : e.id;
      if (!u.has(t) && !l.has(e.url)) {
        u.add(t);
        l.add(e.url);
        d.push(e);
      }
    });
    if (a.size > 0) {
      return {
        images: c,
        videos: n,
        audios: d,
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
        audios: d,
        texts: i
      };
    }
  }, [Ye, Je]);
  let Ze = Z.useMemo(() => {
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
    he.forEach(n => {
      if (n?.url && !n.url.startsWith(`asset://`)) {
        e.push({
          id: n.id,
          url: n.url,
          type: t(n.type)
        });
      }
    });
    Xe.images.forEach(t => {
      if (t.url && !t.url.startsWith(`asset://`)) {
        e.push({
          id: t.id,
          url: t.url,
          type: `image`
        });
      }
    });
    Xe.videos.forEach(t => {
      if (t.url && !t.url.startsWith(`asset://`)) {
        e.push({
          id: t.id,
          url: t.url,
          type: `video`
        });
      }
    });
    Xe.audios.forEach(t => {
      if (t.url && !t.url.startsWith(`asset://`)) {
        e.push({
          id: t.id,
          url: t.url,
          type: `audio`
        });
      }
    });
    return e;
  }, [he, Xe]);
  let Qe = Z.useMemo(() => {
    return Ze.map(e => {
      return `${e.id}|${e.url}`;
    }).join(`;`);
  }, [Ze]);
  let $e = e => {
    if (!e || e.startsWith(`asset://`) || e.startsWith(`http://`) || e.startsWith(`https://`)) {
      return false;
    } else {
      if (e.startsWith(`blob:`) || e.startsWith(`data:`) || /^[a-zA-Z]:[\\/]/.test(e) || e.startsWith(`files/`) || e.startsWith(`/files/`) || e.startsWith(`./files/`) || e.startsWith(`../`)) {
        return true;
      } else {
        return !/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(e);
      }
    }
  };
  Z.useEffect(() => {
    if (!f.scriptAssetUploadPending) {
      for (let e of Ze) {
        if (!e.url || !$e(e.url)) {
          continue;
        }
        let t = e.url;
        let n = e.id;
        if (!_e[t] && !ye.current[n] && !be.current[n]) {
          xe({
            id: n,
            url: e.url,
            type: e.type
          }).catch(e => {
            console.error(`Auto upload failed for`, n, e);
          });
        }
      }
    }
  }, [Qe, _e, xe]);
  Z.useEffect(() => {
    if (f.prompt !== undefined && f.prompt !== g) {
      let e = pe.current;
      let t = e && document.activeElement === e ? Math.min(G.current, f.prompt.length) : f.prompt.length;
      ue(f.prompt, t);
      _(f.prompt);
    }
  }, [f.prompt]);
  Z.useEffect(() => {
    if (f.discountVideoModel && !O) {
      let t = f.discountVideoModel.split(`
`)[0].trim();
      k(t);
      r(e, {
        selectedModel: t
      });
    }
  }, [f.discountVideoModel, O, e, r]);
  let et = Z.useRef(false);
  Z.useEffect(() => {
    if (!et.current) {
      if (f.selectedModel && f.selectedModel !== O) {
        k(f.selectedModel);
      }
      if (f.selectedModel || O) {
        et.current = true;
      }
    }
  }, [f.selectedModel]);
  Z.useEffect(() => {
    if (!f.selectedModel && O.trim()) {
      r(e, {
        selectedModel: O
      });
    }
  }, [f.selectedModel, O, e, r]);
  Z.useEffect(() => {
    if (f.videoDurations && !E) {
      let t = f.videoDurations.split(`
`)[0].trim();
      D(t);
      r(e, {
        selectedSeconds: t
      });
    }
  }, [f.videoDurations, E, e, r]);
  Z.useEffect(() => {
    if (!je && f.selectedSeconds && f.selectedSeconds !== E) {
      D(f.selectedSeconds);
    }
  }, [f.selectedSeconds, je]);
  Z.useEffect(() => {}, [f.videoUrl, f.loading]);
  let tt = () => {
    if (Object.keys(ye.current).length > 0) {
      f.onShowToast?.(`素材正在上传处理中，请等待所有对勾出现后再生成`);
      return;
    }
    if (Object.keys(be.current).length > 0) {
      f.onShowToast?.(`有素材上传失败，已为您重新尝试上传，请稍后`);
      Ce();
      return;
    }
    if (!O.trim()) {
      f.onShowToast?.(`请选择 AI 模型`);
      return;
    }
    if (!g.trim() && Xe.images.length === 0 && Xe.texts.length === 0 && he.length === 0) {
      f.onShowToast?.(`请输入提示词或连接参考节点`);
      return;
    }
    let t = y === `custom` ? x : y;
    let n = Os(je, {
      modelName: O,
      prompt: g,
      resolution: C,
      aspectRatio: t,
      seconds: E,
      imageCount: Xe.images.length,
      videoCount: Xe.videos.length,
      audioCount: Xe.audios.length
    });
    if (!n.ok) {
      f.onShowToast?.(n.errors[0] || `当前参数不符合模型要求`);
      return;
    }
    f.onGenerateDiscountVideo?.(e, g, t, O, E, C);
  };
  let nt = async e => {
    e.stopPropagation();
    if (f.videoUrl) {
      try {
        let e = Js(f.videoUrl);
        f.onShowToast?.(e ? `开始下载音频...` : `开始下载视频...`);
        let t = e ? f.videoUrl.match(/\.(mp3|wav|ogg|m4a|aac|flac)(\?|$)/i)?.[1] || `mp3` : `mp4`;
        if (typeof chrome < `u` && chrome.downloads) {
          chrome.downloads.download({
            url: f.videoUrl,
            filename: `yimao/${e ? `audio` : `video`}-${Date.now()}.${t}`,
            saveAs: false
          });
        } else {
          let n = await (await fetch(f.videoUrl)).blob();
          let r = window.URL.createObjectURL(n);
          let i = document.createElement(`a`);
          i.href = r;
          i.download = `${e ? `audio` : `video`}-${Date.now()}.${t}`;
          document.body.appendChild(i);
          i.click();
          window.URL.revokeObjectURL(r);
          document.body.removeChild(i);
        }
      } catch (e) {
        console.error(`Download failed:`, e);
        f.onShowToast?.(`下载失败，请重试`);
        window.open(f.videoUrl, `_blank`);
      }
    }
  };
  let rt = async t => {
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
          let e = await xi(n, {
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
        r ||= await _cmp_jr(n, 2048, 0.85);
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
        let e = await xi(n, {
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
  let it = (e, t = false) => {
    let n = pe.current;
    let r = `@${e} `;
    let i;
    if (n) {
      i = xo(n);
    } else {
      i = g.length;
    }
    let a;
    let o;
    if (t && ie >= 0) {
      a = g.substring(0, ie);
      o = g.substring(ie + 1);
    } else {
      a = g.substring(0, i);
      o = g.substring(i);
    }
    let s = a + r + o;
    let c = a.length + r.length;
    de(s, c);
    requestAnimationFrame(() => {
      let e = pe.current;
      if (e) {
        e.focus();
        Eo(e, c);
      }
    });
  };
  let at = Z.useMemo(() => {
    return [...Xe.images.map((e, t) => {
      return `图片${t + 1}`;
    }), ...Xe.videos.map((e, t) => {
      return `视频${t + 1}`;
    }), ...Xe.audios.map((e, t) => {
      return `音频${t + 1}`;
    })];
  }, [Xe.images, Xe.videos, Xe.audios]);
  let ot = e => {
    if (e.type.startsWith(`image`)) {
      return `图片${Xe.images.findIndex(t => {
        return t.id === e.id;
      }) + 1}`;
    } else {
      if (e.type.startsWith(`video`)) {
        return `视频${Xe.videos.findIndex(t => {
          return t.id === e.id;
        }) + 1}`;
      } else {
        if (e.type.startsWith(`audio`)) {
          return `音频${Xe.audios.findIndex(t => {
            return t.id === e.id;
          }) + 1}`;
        } else {
          return `素材1`;
        }
      }
    }
  };
  let st = (e => {
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
  })(y === `custom` ? x : y);
  let ct = st !== null;
  let lt = ct && st ? Math.round(Math.sqrt(st) * 380) : null;
  let ut = ct && st ? Math.round(380 / Math.sqrt(st)) : null;
  let ft = Z.useRef(ut);
  let pt = Z.useRef(null);
  let [mt, ht] = Z.useState(null);
  Z.useEffect(() => {
    let t = ft.current;
    ft.current = ut;
    if (pt.current !== null) {
      cancelAnimationFrame(pt.current);
      pt.current = null;
    }
    if (lt === null || ut === null) {
      ht(null);
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
    let o = t ?? ut;
    let s = lt;
    let c = ut;
    if (t === null || Math.round(r) === s && Math.round(o) === c) {
      ht(null);
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
      ht(u);
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
        pt.current = requestAnimationFrame(h);
      } else {
        pt.current = null;
        ht(null);
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
    pt.current = requestAnimationFrame(h);
    return () => {
      if (pt.current !== null) {
        cancelAnimationFrame(pt.current);
        pt.current = null;
      }
    };
  }, [lt, ut, e]);
  let gt = ct ? mt === null ? st ? {
    aspectRatio: String(st)
  } : undefined : {
    height: mt
  } : undefined;
  let _t = Y && !M ? Math.max(220, (Number(f.inputHeight) || 80) + 140) : 0;
  const Component956 = `button`;
  const Component957 = `button`;
  const Component958 = `button`;
  const Component959 = `button`;
  const Component960 = `div`;
  const Component961 = `div`;
  const Component962 = `input`;
  const Component963 = `audio`;
  const Component964 = `div`;
  const Component965 = `video`;
  const Component966 = `button`;
  const Component967 = `div`;
  const Component968 = `div`;
  const Component969 = `div`;
  const Component970 = `div`;
  const Component971 = `div`;
  const Component972 = `div`;
  const Component1065 = `div`;
  const Component1066 = `div`;
  const Component1067 = `button`;
  const Component1068 = `video`;
  const Component1069 = `div`;
  const Component1070 = `div`;
  return <Component1070 className={`relative flex flex-col items-center group/node w-full min-w-[200px] min-h-[200px] ${ct ? `h-auto` : `h-full`} ${n ? `z-50` : `z-10`}`}>
      <_cmp_Ti id={e} data={t} defaultTitle={`特惠视频`} icon={<_Component39 size={11} className={`text-gray-500`} />} />
      {!f.loading && <Component961 className={`absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`}>
          <Component960 className={`flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`}>
            <Component956 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md transition-colors`} title={`上传图片、视频或音频素材`} onClick={e => {
          e.stopPropagation();
          P.current?.click();
        }}>
              <_Component8 size={14} />
            </Component956>
            {f.videoUrl && <Q.Fragment>
                <Component957 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md transition-colors`} title={`全屏播放`} onClick={e => {
            e.stopPropagation();
            j(true);
          }}>
                  <Ke size={14} />
                </Component957>
                <Component958 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md transition-colors`} title={`下载`} onClick={nt}>
                  <_Component6 size={14} />
                </Component958>
                <_cmp_Bn url={f.videoUrl} fallbackExt={`mp4`} onToast={e => {
            return f.onShowToast?.(e);
          }} />
                {f.onDelete && <Component959 className={`p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors`} title={`删除`} onClick={e => {
            e.stopPropagation();
            f.onDelete?.();
          }}>
                    <Ot size={14} />
                  </Component959>}
              </Q.Fragment>}
          </Component960>
        </Component961>}
      <Component962 type={`file`} ref={P} style={{
      display: `none`
    }} accept={`image/*,video/*,audio/*`} onChange={rt} />
      <Component1065 className={`relative w-full ${ct ? `` : `flex-1 min-h-0`}`}>
        <_cmp_Ei visible={!!n} minWidth={200} minHeight={200} keepAspectRatio={ct} />
        <Component972 className={`relative bg-[#1c1c1c] rounded-xl border shadow-xl transition-colors duration-300 cursor-pointer group/display flex flex-col overflow-hidden w-full
            ${ct ? `` : `h-full`}
            ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}
        `} style={gt} onClick={() => {
        let t = !Y;
        Ue(t);
        r(e, {
          expanded: t
        });
        requestAnimationFrame(() => {
          return d(e);
        });
      }}>
          <Component971 className={`flex items-center justify-center absolute inset-0 rounded-xl overflow-hidden ${f.videoUrl ? `` : `bg-[#121212]`}`}>
            {f.videoUrl && (Js(f.videoUrl) ? <Component964 className={`w-full h-full flex items-center justify-center px-4 bg-[#151515] nodrag`} onClick={e => {
            return e.stopPropagation();
          }}>
                  <Component963 src={f.videoUrl} controls={true} className={`w-full max-w-[420px] h-9 outline-none`} />
                </Component964> : <Q.Fragment>
                  <Component965 src={f.videoUrl} poster={f.thumbnailUrl} className={`max-w-full w-full h-full object-contain block ${f.loading ? `opacity-50 blur-sm` : ``}`} controls={false} autoPlay={false} muted={false} onDoubleClick={e => {
              e.stopPropagation();
              j(true);
            }} />
                  {!f.loading && <Component967 className={`absolute inset-0 flex items-center justify-center pointer-events-none`}>
                      <Component966 className={`w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-black/70 transition-all nodrag pointer-events-auto`} title={`播放视频`} onClick={e => {
                e.stopPropagation();
                j(true);
              }}>
                        <_Component11 className={`text-white w-6 h-6`} />
                      </Component966>
                    </Component967>}
                </Q.Fragment>)}
            {f.loading && <_cmp__Component15 label={!f.progress || f.progress === 0 ? `生成中...` : `生成中... ${f.progress}%`} backgroundUrl={f.thumbnailUrl || Xe.images[0]?.url}>
                <_cmp_Ni category={`video`} />
              </_cmp__Component15>}
            {!f.videoUrl && !f.loading && !f.errorMessage && <Component968 className={`flex flex-col items-center justify-center absolute inset-0 bg-[#151515] pointer-events-none`}>
                <_Component39 size={80} className={`text-gray-700`} strokeWidth={1.2} />
              </Component968>}
            {f.errorMessage && !f.loading && !f.videoUrl && <Component970 className={`absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-500 z-10 bg-[#1a1a1a] p-4 text-center`}>
                <_Component16 size={32} />
                <Component969 className={`text-xs font-medium max-w-full break-words`}>
                  {f.errorMessage}
                </Component969>
              </Component970>}
          </Component971>
        </Component972>
        {(() => {
        let t = [...Xe.images.map(e => {
          return {
            ...e,
            resType: `image`,
            isConnected: true
          };
        }), ...Xe.videos.map(e => {
          return {
            ...e,
            resType: `video`,
            isConnected: true
          };
        }), ...Xe.audios.map(e => {
          return {
            ...e,
            resType: `audio`,
            isConnected: true
          };
        }), ...he.filter(e => {
          let t = Xe.images.some(t => {
            return t.id === e.id;
          });
          let n = Xe.videos?.some(t => {
            return t.id === e.id;
          });
          let r = Xe.audios?.some(t => {
            return t.id === e.id;
          });
          let i = [...Xe.images, ...(Xe.videos || []), ...(Xe.audios || [])].some(t => {
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
          let n = m.indexOf(e.id);
          let r = m.indexOf(t.id);
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
          h(c);
          r(e, {
            resourceOrder: c
          });
        };
        let a = 0;
        let o = 0;
        let c = 0;
        let l = f.inputWidth ? `${f.inputWidth}px` : undefined;
        let u = f.inputHeight ? `${f.inputHeight}px` : `80px`;
        const Component981 = `span`;
        const Component982 = `div`;
        const Component983 = `div`;
        const Component984 = `div`;
        const Component985 = `span`;
        const Component986 = `div`;
        const Component987 = `button`;
        const Component988 = `div`;
        const Component999 = `div`;
        const Component1000 = `div`;
        const Component1001 = `div`;
        const Component1002 = `div`;
        const Component1003 = `div`;
        const Component1004 = `span`;
        const Component1005 = `button`;
        const Component1006 = `div`;
        const Component1007 = `button`;
        const Component1008 = `div`;
        const Component1009 = `span`;
        const Component1010 = `input`;
        const Component1011 = `div`;
        const Component1012 = `div`;
        const Component1013 = `div`;
        const Component1014 = `div`;
        const Component1015 = `button`;
        const Component1016 = `div`;
        const Component1017 = `div`;
        const Component1018 = `div`;
        const Component1019 = `button`;
        const Component1020 = `div`;
        const Component1021 = `input`;
        const Component1022 = `input`;
        const Component1023 = `div`;
        const Component1024 = `div`;
        const Component1025 = `div`;
        const Component1026 = `div`;
        const Component1027 = `div`;
        const Component1028 = `span`;
        const Component1029 = `span`;
        const Component1030 = `button`;
        const Component1038 = `div`;
        const Component1039 = `div`;
        const Component1040 = `div`;
        const Component1041 = `div`;
        const Component1042 = `button`;
        const Component1043 = `div`;
        const Component1044 = `div`;
        const Component1047 = `div`;
        const Component1048 = `div`;
        const Component1049 = `div`;
        const Component1050 = `span`;
        const Component1051 = `button`;
        const Component1052 = `div`;
        const Component1053 = `button`;
        const Component1054 = `div`;
        const Component1055 = `div`;
        const Component1058 = `div`;
        const Component1059 = `button`;
        const Component1060 = `div`;
        const Component1061 = `div`;
        const Component1062 = `div`;
        const Component1063 = `div`;
        let k = <Component1063 className={`space-y-3`}>
              <Component1003 className={`flex flex-col gap-2 mb-2`}>
                {(t.length > 0 || Xe.texts.length > 0) && <Component983 className={`flex flex-wrap gap-2 mb-1`}>
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
                const Component973 = `img`;
                const Component974 = `div`;
                const Component975 = `div`;
                const Component976 = `div`;
                const Component977 = `div`;
                const Component978 = `button`;
                const Component979 = `div`;
                const Component980 = `div`;
                return <Component980 className={`w-10 h-10 rounded-md overflow-hidden border border-[#444] relative group bg-black cursor-grab active:cursor-grabbing nodrag nopan`} title={t.isConnected ? `连线${t.resType === `image` ? `图片` : t.resType === `video` ? `视频` : `音频`}（缩略图单击/双击全屏预览，底部标签插入@${l}）` : `通过 @ 选中的素材（缩略图单击全屏预览）`} draggable={true} onClick={e => {
                  if (!p.current) {
                    e.stopPropagation();
                    _cmp_Ks(t.url, t.resType);
                  }
                }} onDragStart={e => {
                  e.stopPropagation();
                  p.current = t.id;
                  e.dataTransfer.setData(`text/plain`, t.id);
                  e.dataTransfer.effectAllowed = `move`;
                }} onDragOver={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = `move`;
                }} onDragEnter={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  let r = p.current;
                  if (r && r !== t.id) {
                    n(r, t.id);
                  }
                }} onDrop={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  n(p.current || e.dataTransfer.getData(`text/plain`), t.id);
                  p.current = null;
                }} onDragEnd={() => {
                  p.current = null;
                }} key={`res-${t.id}`}>
                          {t.resType === `image` ? <Component973 src={t.url} alt={`Ref`} className={`w-full h-full object-cover pointer-events-none`} loading={`lazy`} decoding={`async`} onDoubleClick={e => {
                    e.stopPropagation();
                    _cmp_Ks(t.url, `image`);
                  }} /> : t.resType === `video` ? <Component975 className={`w-full h-full relative cursor-pointer`} onDoubleClick={e => {
                    e.stopPropagation();
                    _cmp_Ks(t.url, `video`);
                  }}>
                              <Component974 className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                                <Pt size={16} className={`text-purple-400 opacity-80 pointer-events-none`} />
                              </Component974>
                            </Component975> : <Component977 className={`w-full h-full relative cursor-pointer`} onDoubleClick={e => {
                    e.stopPropagation();
                    _cmp_Ks(t.url, `audio`);
                  }}>
                              <Component976 className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                                <_Component36 size={16} className={`text-yellow-500 pointer-events-none`} />
                              </Component976>
                            </Component977>}
                          <_Component40 resId={t.id} resUrl={t.url} resType={t.resType} />
                          <Component978 type={`button`} className={`absolute bottom-0 left-0 right-0 bg-blue-500/80 hover:bg-blue-500 text-[8px] text-white text-center py-0.5 truncate cursor-pointer transition-colors z-10`} title={`点击标签插入 @${l}（点击上方缩略图放大预览）`} onMouseDown={e => {
                    return e.preventDefault();
                  }} onClick={e => {
                    e.stopPropagation();
                    it(l);
                  }} onDoubleClick={e => {
                    e.stopPropagation();
                    _cmp_Ks(t.url, t.resType);
                  }}>
                            {l}
                          </Component978>
                          <Component979 className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all z-20`} onClick={n => {
                    n.stopPropagation();
                    if (t.isConnected) {
                      i(n => {
                        return n.filter(n => {
                          return n.target !== e || n.source !== t.sourceNodeId;
                        });
                      });
                    } else {
                      let n = he.filter(e => {
                        return e.id !== t.id;
                      });
                      ge(n);
                      r(e, {
                        selectedContextResources: n
                      });
                    }
                  }}>
                            <Gt size={10} className={`text-white`} />
                          </Component979>
                        </Component980>;
              })}
                    {Xe.texts.map((e, t) => {
                return <Component982 className={`h-8 px-2 bg-[#2a2a2a] border border-[#444] rounded flex items-center gap-1 text-[10px] text-gray-300 hover:bg-[#333] hover:border-blue-500 hover:text-blue-400 transition-colors cursor-help group/text`} title={e.text} key={`txt-${t}`}>
                          <_Component17 size={10} />
                          <Component981 className={`max-w-[80px] truncate`}>{e.label}</Component981>
                        </Component982>;
              })}
                  </Component983>}
                <Component1002 className={`flex items-start gap-2`}>
                  <Component1001 className={`flex-1 nodrag relative shrink-0`} ref={me} style={{
                width: M ? `100%` : l,
                height: M ? `100%` : u,
                minHeight: `80px`
              }}>
                    <_cmp__Component18 text={g} names={at} placeholder={`描述你想要的视频内容 (输入 @ 调出素材)...`} scrollTop={U.top} scrollLeft={U.left} className={`absolute inset-0 z-0 custom-scrollbar`} style={{
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
                    <Component984 ref={pe} contentEditable={true} suppressContentEditableWarning={true} spellCheck={false} className={`relative z-10 w-full h-full bg-transparent text-transparent caret-white min-h-[80px] outline-none custom-scrollbar nowheel nopan nodrag overflow-auto whitespace-pre-wrap`} style={{
                  resize: `none`,
                  width: `100%`,
                  height: `100%`,
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
                }} onInput={t => {
                  let n = t.currentTarget;
                  let i = n.innerText.replace(/\u00a0/g, ` `);
                  let a = xo(n);
                  G.current = a;
                  ce.current = n.innerHTML;
                  _(i);
                  r(e, {
                    prompt: i
                  });
                  let o = i.substring(0, a);
                  let s = o.lastIndexOf(`@`);
                  if (s >= 0) {
                    let e = o.substring(s + 1);
                    if (e === `` || /^\d+$/.test(e)) {
                      ae(s);
                      H(true);
                      W(Co(_cmp_So(n), n));
                    } else {
                      ae(-1);
                      H(false);
                      W(null);
                    }
                  } else {
                    ae(-1);
                    H(false);
                    W(null);
                  }
                  if (!M && (!f.inputHeight || f.inputHeight <= 200)) {
                    requestAnimationFrame(() => {
                      let t = pe.current;
                      if (!t) {
                        return;
                      }
                      let n = me.current;
                      let i = wo(t, n, {
                        minHeight: 80,
                        maxHeight: 200
                      });
                      if (f.inputHeight !== i) {
                        r(e, {
                          inputHeight: i
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
                      let r = Do(g, at, n, e.key);
                      if (r) {
                        e.preventDefault();
                        de(r.text, r.cursor);
                        requestAnimationFrame(() => {
                          return Eo(t, r.cursor);
                        });
                        return;
                      }
                    }
                  }
                  if (e.key === ` `) {
                    let r = Oo(g, n, g.lastIndexOf(`@`, n - 1), at);
                    if (r) {
                      e.preventDefault();
                      de(r.text, r.cursor);
                      H(false);
                      W(null);
                      ae(-1);
                      requestAnimationFrame(() => {
                        return Eo(t, r.cursor);
                      });
                      return;
                    }
                  }
                  if (e.key === `Enter`) {
                    if (e.ctrlKey || e.metaKey) {
                      tt();
                      e.preventDefault();
                      return;
                    }
                    let r = Oo(g, n, g.lastIndexOf(`@`, n - 1), at);
                    e.preventDefault();
                    let i = (() => {
                      if (r) {
                        return {
                          text: r.text,
                          cursor: r.cursor
                        };
                      }
                      let e = g.substring(0, n);
                      let t = g.substring(n);
                      return {
                        text: `${e}
${t}`,
                        cursor: e.length + 1
                      };
                    })();
                    de(i.text, i.cursor);
                    if (r) {
                      H(false);
                      W(null);
                      ae(-1);
                    }
                    requestAnimationFrame(() => {
                      return Eo(t, i.cursor);
                    });
                    return;
                  }
                  if (e.key === `Escape` && V) {
                    H(false);
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
                  let t = pe.current;
                  if (!t) {
                    return;
                  }
                  let n = (t.innerText || ``).replace(/\u00a0/g, ` `);
                  let i = qs(n);
                  if (t.innerHTML !== i) {
                    t.innerHTML = i;
                  }
                  ce.current = i;
                  if (n !== g) {
                    _(n);
                    r(e, {
                      prompt: n
                    });
                  }
                }} />
                    {V && se && Fn.createPortal(<Component1000 className={`fixed w-72 bg-[#222] border border-[#444] rounded-lg shadow-2xl z-[999999] flex flex-col overflow-hidden h-[300px] nopan`} style={{
                  top: se.top,
                  left: se.left
                }} onWheel={e => {
                  return e.stopPropagation();
                }} onMouseDown={e => {
                  return e.preventDefault();
                }} onClick={e => {
                  return e.stopPropagation();
                }}>
                          <Component988 className={`flex items-center justify-between p-2 border-b border-[#333] bg-[#1a1a1a]`}>
                            <Component986 className={`text-xs text-gray-300 font-bold flex items-center gap-2`}>
                              <Component985>{`选择素材引用`}</Component985>
                            </Component986>
                            <Component987 onClick={() => {
                      H(false);
                      W(null);
                    }} className={`text-gray-500 hover:text-white p-1`}>
                              <Gt size={12} />
                            </Component987>
                          </Component988>
                          <Component999 className={`p-2 flex-1 overflow-y-auto custom-scrollbar nowheel nopan nodrag`}>
                            {(() => {
                      let e = [...Xe.images.map(e => {
                        return {
                          id: e.id,
                          url: e.url,
                          type: `image`
                        };
                      }), ...Xe.videos.map(e => {
                        return {
                          id: e.id,
                          url: e.url,
                          type: `video`
                        };
                      }), ...Xe.audios.map(e => {
                        return {
                          id: e.id,
                          url: e.url,
                          type: `audio`
                        };
                      })];
                      if (e.length === 0) {
                        const Component989 = `div`;
                        return <Component989 className={`text-center text-gray-500 text-xs py-10`}>{`暂无素材，请先上传`}</Component989>;
                      } else {
                        const Component990 = `img`;
                        const Component991 = `video`;
                        const Component992 = `span`;
                        const Component993 = `div`;
                        const Component994 = `div`;
                        const Component995 = `span`;
                        const Component996 = `div`;
                        const Component997 = `div`;
                        const Component998 = `div`;
                        return <Component998 className={`grid grid-cols-4 gap-1.5`}>
                                    {e.map(e => {
                            return <Component997 className={`aspect-square bg-[#111] rounded border border-[#333] hover:border-blue-500 cursor-pointer overflow-hidden relative group`} onMouseDown={t => {
                              t.preventDefault();
                              t.stopPropagation();
                              it(ot(e), true);
                              ae(-1);
                              H(false);
                              W(null);
                            }} key={e.id}>
                                          {e.type.startsWith(`image`) ? <Component990 src={ti(e.url, {
                                width: 200
                              })} className={`w-full h-full object-cover`} loading={`lazy`} decoding={`async`} onError={t => {
                                let n = t.currentTarget;
                                if (e.url && n.src !== e.url) {
                                  n.src = e.url;
                                }
                              }} /> : e.type.startsWith(`video`) ? <Component991 src={e.url} className={`w-full h-full object-cover`} /> : e.type.startsWith(`audio`) ? <Component993 className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                                              <Component992 className={`text-[10px] text-gray-400`}>{`音频`}</Component992>
                                            </Component993> : <Component994 className={`p-1 text-[8px] text-gray-400 break-all overflow-hidden h-full`}>
                                              {e.url}
                                            </Component994>}
                                          <Component996 className={`absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity`}>
                                            <Component995 className={`text-[10px] text-white`}>{`选择`}</Component995>
                                          </Component996>
                                        </Component997>;
                          })}
                                  </Component998>;
                      }
                    })()}
                          </Component999>
                        </Component1000>, document.body)}
                  </Component1001>
                </Component1002>
              </Component1003>
              <Component1062 className={`flex items-center justify-between pt-2 border-t border-[#2a2a2a] nodrag`}>
                <Component1049 className={`flex items-center gap-1.5 overflow-visible z-50`}>
                  <Component1026 className={`relative nodrag flex items-center`} ref={re}>
                    <Component1005 className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`} onClick={e => {
                  e.stopPropagation();
                  B(!ne);
                }} title={`选择比例和时长`}>
                      <T size={12} className={`opacity-70`} />
                      <Component1004 className={`whitespace-nowrap`}>
                        {q.find(e => {
                      return e.value === y;
                    })?.label || Ys.find(e => {
                      return e.value === y;
                    })?.label || y || `16:9`}
                        {` · `}
                        {C}
                        {` · `}
                        {E}
                        {`s`}
                      </Component1004>
                    </Component1005>
                    {ne && <Component1025 className={`absolute bottom-full left-0 mb-1 w-72 bg-[#222] border border-[#333] rounded-lg shadow-xl p-3 z-50 flex flex-col gap-3 max-h-none overflow-visible nopan nodrag`} onClick={e => {
                  return e.stopPropagation();
                }}>
                        <Component1013>
                          <Component1006 className={`text-[10px] text-gray-500 mb-2 px-1`}>{`比例`}</Component1006>
                          <Component1008 className={`flex flex-wrap gap-1.5 mb-2`}>
                            {q.filter(e => {
                        if (O.startsWith(`grok-`) || O.startsWith(`firefly-`)) {
                          return e.value === `16:9` || e.value === `9:16`;
                        } else {
                          return true;
                        }
                      }).map(t => {
                        return <Component1007 className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ${y === t.value ? `bg-[#444] text-white` : `bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} onClick={() => {
                          b(t.value);
                          r(e, {
                            size: t.value
                          });
                          localStorage.setItem(`mutiwindow_discountvideo_size`, t.value);
                        }} key={t.value}>
                                    {t.label}
                                  </Component1007>;
                      })}
                          </Component1008>
                          {y === `custom` && <Component1012 className={`bg-[#1c1c1c] p-2 rounded border border-[#333] mb-2 flex flex-col gap-2`}>
                              <Component1011 className={`flex items-center gap-2`}>
                                <Component1009 className={`text-[10px] text-gray-500 w-10`}>{`比例:`}</Component1009>
                                <Component1010 type={`text`} value={x} onChange={e => {
                          return S(e.target.value);
                        }} placeholder={`如 16:9`} className={`flex-1 bg-[#121212] border border-[#444] rounded px-2 py-1 text-[11px] text-gray-200 outline-none focus:border-blue-500`} />
                              </Component1011>
                            </Component1012>}
                        </Component1013>
                        <Component1017>
                          <Component1014 className={`text-[10px] text-gray-500 mb-2 px-1`}>{`分辨率`}</Component1014>
                          <Component1016 className={`flex flex-wrap gap-1.5 mb-3`}>
                            {Me.map(t => {
                        return <Component1015 className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ${C === t.value ? `bg-[#444] text-white` : `bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} onClick={() => {
                          w(t.value);
                          r(e, {
                            resolution: t.value
                          });
                          localStorage.setItem(`mutiwindow_discountvideo_resolution`, t.value);
                        }} key={t.value}>
                                  {t.label}
                                </Component1015>;
                      })}
                          </Component1016>
                        </Component1017>
                        <Component1024>
                          <Component1018 className={`text-[10px] text-gray-500 mb-2 px-1`}>{`时长 (秒)`}</Component1018>
                          {Pe && Ve ? <Component1020 className={`flex flex-wrap gap-1.5 px-1 mb-1`}>
                              {Fe.map(t => {
                        return <Component1019 type={`button`} className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ${String(t) === E ? `bg-[#444] text-white` : `bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} onClick={() => {
                          D(String(t));
                          r(e, {
                            selectedSeconds: String(t)
                          });
                          localStorage.setItem(`mutiwindow_discountvideo_seconds`, String(t));
                        }} key={t}>
                                    {t}
                                    {`s`}
                                  </Component1019>;
                      })}
                            </Component1020> : <Component1023 className={`flex items-center gap-2 px-1`}>
                              <Component1021 type={`range`} min={Ie} max={Le} step={Re} value={E} onChange={t => {
                        D(t.target.value);
                        r(e, {
                          selectedSeconds: t.target.value
                        });
                        localStorage.setItem(`mutiwindow_discountvideo_seconds`, t.target.value);
                      }} className={`flex-1 accent-blue-500`} />
                              <Component1022 type={`number`} value={E} onChange={t => {
                        let n = t.target.value;
                        D(n);
                        r(e, {
                          selectedSeconds: n
                        });
                        localStorage.setItem(`mutiwindow_discountvideo_seconds`, n);
                      }} className={`w-12 bg-[#1c1c1c] text-gray-200 border border-[#333] rounded px-1 py-0.5 text-xs outline-none text-center`} />
                            </Component1023>}
                        </Component1024>
                      </Component1025>}
                  </Component1026>
                  {K.length > 0 && <Component1048 className={`relative nodrag flex items-center`} ref={z}>
                      <Component1027 className={`w-[1px] h-3 bg-[#444] mr-1.5`} />
                      <Component1030 className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`} onClick={e => {
                  e.stopPropagation();
                  I(e => {
                    if (e) {
                      te(null);
                    }
                    return !e;
                  });
                }} title={O ? `${O}（${ma(O) ? `内置` : `第三方`}）` : `选择 AI 模型`}>
                        {O && <Component1028 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${ma(O) ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                            {ma(O) ? `内置` : `三方`}
                          </Component1028>}
                        <Component1029 className={`whitespace-nowrap`}>
                          {O || `选择模型`}
                        </Component1029>
                      </Component1030>
                      {F && <Component1047 className={`absolute bottom-full left-0 mb-1 bg-[#222] border border-[#333] rounded-lg shadow-xl z-50 flex items-stretch nowheel nopan nodrag`} onClick={e => {
                  return e.stopPropagation();
                }}>
                          <Component1044 className={`w-max min-w-[13rem] max-w-[24rem] shrink-0 flex flex-col border-r border-[#333]`}>
                            <Component1041 className={`relative flex-1 min-h-0`}>
                              <Component1038 className={`p-2 max-h-[24rem] overflow-x-hidden overflow-y-auto no-scrollbar`}>
                                {(() => {
                          let e = K;
                          let t = e.filter(e => {
                            return ma(e);
                          });
                          let n = e.filter(e => {
                            return !ma(e);
                          });
                          let r = (e, t, n) => {
                            let r = n ? sa(e) : null;
                            let i = n ? ca(e) : null;
                            let a = va(e, O === e);
                            const Component1031 = `span`;
                            const Component1032 = `span`;
                            const Component1033 = `span`;
                            const Component1034 = `span`;
                            const Component1035 = `div`;
                            return <Component1035 role={`button`} className={`relative ${a.className}`} onClick={() => {
                              if (!a.disabled) {
                                He(e);
                                I(false);
                                te(null);
                              }
                            }} onMouseEnter={() => {
                              return te(e);
                            }} onMouseLeave={() => {
                              return te(t => {
                                if (t === e) {
                                  return null;
                                } else {
                                  return t;
                                }
                              });
                            }} title={a.title} key={`${n ? `b` : `o`}-${t}`}>
                                        <Component1031 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${n ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                                          {n ? `内置` : `三方`}
                                        </Component1031>
                                        <Component1032 className={`flex-1 whitespace-nowrap`}>
                                          {e}
                                        </Component1032>
                                        {r !== null && <Component1034 className={`shrink-0 inline-flex items-center gap-0.5 text-[10px] text-yellow-300 tabular-nums`}>
                                            <_cmp_As className={`w-2.5 h-2.5`} />
                                            <Component1033>
                                              {ha(r)}
                                              {i ? `/${i}` : ``}
                                            </Component1033>
                                          </Component1034>}
                                      </Component1035>;
                          };
                          const Component1036 = `div`;
                          const Component1037 = `div`;
                          return <Q.Fragment>
                                      {t.length > 0 && <Component1036 className={`text-[9px] text-gray-500 px-2 pt-0.5 pb-1`}>{`内置模型`}</Component1036>}
                                      {t.map((e, t) => {
                              return r(e, t, true);
                            })}
                                      {n.length > 0 && <Component1037 className={`text-[9px] text-gray-500 px-2 pt-1.5 pb-1`}>{`第三方模型`}</Component1037>}
                                      {n.map((e, t) => {
                              return r(e, t, false);
                            })}
                                    </Q.Fragment>;
                        })()}
                              </Component1038>
                              <Component1039 className={`pointer-events-none absolute top-0 left-0 right-0 h-5 bg-gradient-to-b from-[#222] to-transparent`} />
                              <Component1040 className={`pointer-events-none absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-t from-[#222] to-transparent`} />
                            </Component1041>
                            <Component1043 className={`shrink-0 p-2 border-t border-[#333]`}>
                              <Component1042 type={`button`} className={`w-full text-center px-2 py-1.5 text-[11px] text-blue-400 hover:text-blue-300 hover:bg-[#2a2a2a] rounded-md transition-colors cursor-pointer`} onClick={e => {
                        e.stopPropagation();
                        I(false);
                        te(null);
                        ee(true);
                      }}>{`详细对比`}</Component1042>
                            </Component1043>
                          </Component1044>
                          {(() => {
                    let e = (R && ma(R) ? R : null) || (O && ma(O) ? O : null) || K.find(e => {
                      return ma(e);
                    }) || null;
                    const Component1045 = `div`;
                    const Component1046 = `div`;
                    return <Component1046 className={`w-72 shrink-0 p-2 max-h-[28rem] overflow-x-hidden overflow-y-auto no-scrollbar`}>
                                {e ? <_cmp_Rs name={e} entry={Ae[e]} bare={true} /> : <Component1045 className={`h-full flex items-center justify-center text-[11px] text-gray-500`}>{`悬停内置模型查看详情`}</Component1045>}
                              </Component1046>;
                  })()}
                        </Component1047>}
                    </Component1048>}
                  <_cmp__Component41 open={L} modelNames={K} specsByName={Ae} selectedModel={O} onClose={() => {
                return ee(false);
              }} onConfirm={e => {
                He(e);
                ee(false);
              }} />
                  <_cmp__Component20 category={`video`} presetPrompts={f.presetPrompts || []} onApply={t => {
                let n = g ? `${g}, ${t}` : t;
                _(n);
                r(e, {
                  prompt: n
                });
              }} onToast={e => {
                return f.onShowToast?.(e);
              }} />
                </Component1049>
                <Component1061 className={`flex items-center gap-3 flex-shrink-0 ml-2`}>
                  {f.loading ? <Component1055 className={`flex items-center gap-1.5`}>
                      <Component1051 className={`flex items-center gap-1 text-gray-400 hover:text-white bg-[#222] hover:bg-[#333] border border-[#333] hover:border-gray-500 rounded-full px-2.5 py-1 transition-colors`} onClick={t => {
                  t.stopPropagation();
                  f.onRefresh?.(e);
                }} title={`刷新状态`}>
                        <_Component22 size={12} />
                        <Component1050 className={`text-[10px]`}>{`刷新`}</Component1050>
                      </Component1051>
                      <Component1054 className={`flex items-center bg-red-500/10 rounded-full p-1 pl-3 border border-red-500/30 hover:border-red-500/50 transition-colors cursor-pointer group/btn`} onClick={t => {
                  t.stopPropagation();
                  f.onStop?.(e);
                }}>
                        <Component1052 className={`flex items-center gap-1 mr-3 text-xs text-red-400 group-hover/btn:text-red-300`}>{`停止`}</Component1052>
                        <Component1053 className={`bg-red-500/20 text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-500/30 transition-colors`}>
                          <T size={10} fill={`currentColor`} />
                        </Component1053>
                      </Component1054>
                    </Component1055> : <Component1060 className={`flex items-center bg-[#2a2a2a] rounded-full p-1 pl-3 border border-[#333] hover:border-gray-500 transition-colors cursor-pointer group/btn`} onClick={e => {
                e.stopPropagation();
                tt();
              }}>
                      {O && ma(O) && sa(O) !== null && (() => {
                  let e = sa(O);
                  let t = ca(O);
                  let n = t === `秒` || t === `s` || t === `sec`;
                  let r = parseInt(E, 10) || 0;
                  let i = n ? e * r : e;
                  const Component1056 = `span`;
                  const Component1057 = `div`;
                  return <Component1057 className={`flex items-center gap-0.5 mr-2 text-[12px] text-yellow-300 tabular-nums`} title={`预计消耗 ${ha(i)} 特惠币${n ? `（${ha(e)}/秒 × ${r}秒）` : ``}`}>
                              <_cmp_As className={`w-3.5 h-3.5`} />
                              <Component1056>{ha(i)}</Component1056>
                            </Component1057>;
                })()}
                      <Component1058 className={`flex items-center gap-1 mr-3 text-xs text-gray-300 group-hover/btn:text-white`}>{`生成`}</Component1058>
                      <Component1059 className={`bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors`}>
                        <_Component21 size={14} strokeWidth={3} />
                      </Component1059>
                    </Component1060>}
                </Component1061>
              </Component1062>
            </Component1063>;
        const Component1064 = `div`;
        return <Q.Fragment>
              <Component1064 className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[#1c1c1c] rounded-2xl border border-[#333] shadow-2xl min-w-[500px] w-max max-w-[920px] transition-all duration-300 origin-top z-50
                ${Y ? `opacity-100 scale-100 p-4 overflow-visible` : `opacity-0 scale-95 pointer-events-none h-0 p-0 border-0 overflow-hidden`}
              `} onClick={e => {
            return e.stopPropagation();
          }}>
                {!M && k}
                {Y && !M && <_cmp_Fi targetRef={me} onRequestFullscreen={() => {
              return N(true);
            }} onResizeEnd={(t, n) => {
              r(e, {
                inputWidth: t,
                inputHeight: n
              });
              requestAnimationFrame(() => {
                return d(e);
              });
            }} />}
              </Component1064>
              <_cmp_Ii open={M} title={`编辑提示词 - 特惠视频`} onClose={() => {
            return N(false);
          }}>
                {k}
              </_cmp_Ii>
            </Q.Fragment>;
      })()}
        <_cmp__Component10 type={`target`} position={X.Left} variant={`large`} />
        <_cmp__Component10 type={`source`} position={X.Right} variant={`large`} />
      </Component1065>
      {_t > 0 && <Component1066 aria-hidden={true} className={`w-full pointer-events-none`} style={{
      height: _t,
      marginTop: -_t,
      visibility: `hidden`
    }} />}
      {A && f.videoUrl && Fn.createPortal(<Component1069 className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md`} onClick={() => {
      return j(false);
    }}>
            <Component1067 className={`absolute top-6 right-6 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-50`} onClick={() => {
        return j(false);
      }}>
              <Gt size={32} />
            </Component1067>
            <Component1068 src={f.videoUrl} className={`max-w-[95vw] max-h-[95vh] object-contain shadow-2xl rounded-lg outline-none`} controls={true} autoPlay={true} onClick={e => {
        return e.stopPropagation();
      }} onDoubleClick={e => {
        e.stopPropagation();
        j(true);
      }} />
          </Component1069>, document.body)}
    </Component1070>;
});
export default Zs;