// TODO(全局, 无需 import): data, selected, width, updateNodeData, setEdges, setNodes, getNode, useThumbnail, r, l, m, g, i, selectedModel, imageAvailable, ee, z, handleType, images, texts, le, url, n, label, text, f, p, b, selectedSeconds, x, oe, filename, saveAs, subfolder, preferThumbnail, thumbMaxDim, thumbQuality, me, ve, ye, xe, o, height, style, position, s, u, aspectRatio, k, fe, display, expanded, backgroundImage, transform, ae, selectedContextResources, minHeight, overflow, prompt, inputHeight, de, customSize, value, se, apiFormat, inputWidth
import _cmp_Ti from './Ti.jsx';
import _cmp_Bn from './Bn.jsx';
import _cmp_Ei from './Ei.jsx';
import _cmp_Oi from './Oi.jsx';
import _cmp__Component10 from './_Component10.jsx';
import _cmp_Pi from './Pi.jsx';
import _cmp_No from './No.jsx';
import _cmp__Component20 from './_Component20.jsx';
import _cmp_Fi from './Fi.jsx';
import _cmp_Ii from './Ii.jsx';
import { id, We, t, Tr, wi, e, y, ss, Zr, Fr, h, w, D, E, B, Ci, U, re, ie, I, F, R, ne, P, L, te, G, Lt, Qt, ce, C, ue, S, xi, he, _e, ge, c, a, d, be, M, pe, Se, ii, ri, X, ti, N, V, W, H, _, ma, sa, ca, va, ha, j, A, O, Fn, Pt, _Component8, Ke, _Component6, Ot, _Component11, T, _Component16, Gt, _Component17, _Component19, _Component21 } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
var cs = Z.memo(({
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
  let l = t;
  let {
    useThumbnail: u
  } = Tr();
  let d = wi(r ?? 420);
  let [f, p] = Z.useState(l.prompt || ``);
  let [m, h] = Z.useState(() => {
    let e = localStorage.getItem(`mutiwindow_video_aspectRatio`);
    let t = l.aspectRatio || e || l.size || `16:9`;
    if (t.includes(`x`)) {
      return `custom`;
    } else {
      return t;
    }
  });
  l.aspectRatio;
  let [g, _] = Z.useState(`16:9`);
  let [y, b] = Z.useState(() => {
    if (l.customSize) {
      return l.customSize;
    } else {
      return l.size || `1280x720`;
    }
  });
  let x = Z.useMemo(() => {
    if (m === `custom`) {
      return y;
    }
    let e = ss.find(e => {
      return e.value === m;
    });
    if (e) {
      return e.defaultSize;
    } else {
      return `1280x720`;
    }
  }, [m, y]);
  let S = Z.useMemo(() => {
    if (m === `custom`) {
      return g;
    } else {
      return m;
    }
  }, [m, g]);
  let [C, w] = Z.useState(l.selectedSeconds || l.videoDurations && l.videoDurations.split(`
`)[0].trim() || `10`);
  let [E, D] = Z.useState(l.selectedModel || l.videoModel && l.videoModel.split(`
`)[0].trim() || ``);
  let [O, k] = Z.useState(false);
  let [A, j] = Z.useState(false);
  let M = Z.useRef(null);
  let N = Z.useRef(null);
  let [P, F] = Z.useState(false);
  let I = Z.useRef(null);
  let [L, ee] = Z.useState(false);
  let R = Z.useRef(null);
  let [te, z] = Z.useState(false);
  let ne = Z.useRef(null);
  Z.useEffect(() => {
    (async () => {
      if (!l.aspectRatio && !l.size) {
        let e = await Zr.getConfig(Fr.VIDEO_SIZE);
        if (e) {
          h(e);
        }
      }
      if (!l.selectedSeconds) {
        let e = await Zr.getConfig(Fr.VIDEO_SECONDS);
        if (e) {
          w(e);
        }
      }
      if (!l.selectedModel) {
        let e = await Zr.getConfig(Fr.VIDEO_MODEL);
        if (e) {
          D(e);
        }
      }
    })();
  }, [l.size, l.selectedSeconds, l.selectedModel]);
  Z.useEffect(() => {
    if (l.selectedSeconds !== undefined) {
      w(l.selectedSeconds);
    }
  }, [l.selectedSeconds]);
  Z.useEffect(() => {
    if (l.selectedModel !== undefined) {
      D(l.selectedModel);
    }
  }, [l.selectedModel]);
  Z.useEffect(() => {
    if (!l.selectedModel && E.trim()) {
      i(e, {
        selectedModel: E
      });
    }
  }, [l.selectedModel, E, e, i]);
  Z.useEffect(() => {
    if (l.aspectRatio !== undefined) {
      h(l.aspectRatio);
    }
  }, [l.aspectRatio]);
  let B = Z.useRef(null);
  Z.useEffect(() => {
    let t = l.videoUrl;
    if (!t || l.imageAvailable || l.loading || !t.includes(`/files/`) || B.current === t) {
      return;
    }
    B.current = t;
    let n = false;
    (async () => {
      let r = await Ci(t);
      if (!n && r) {
        i(e, {
          imageAvailable: true
        });
      }
    })();
    return () => {
      n = true;
    };
  }, [e, l.videoUrl, l.imageAvailable, l.loading, i]);
  let [re, V] = Z.useState(false);
  let [H, ie] = Z.useState([]);
  let [ae, U] = Z.useState(l.selectedContextResources || []);
  let [oe, se] = Z.useState(l.apiFormat || `auto`);
  Z.useEffect(() => {
    if (l.selectedContextResources) {
      U(l.selectedContextResources);
    }
  }, [l.selectedContextResources]);
  Z.useEffect(() => {
    if (re) {
      Zr.getObject(Fr.TRANSIT_RESOURCES).then(e => {
        if (e && Array.isArray(e) && e.length > 0) {
          ie(e);
        }
      }).catch(e => {
        console.error(`Failed to fetch transitResources from storage`, e);
      });
    }
  }, [re]);
  Z.useEffect(() => {
    let e = e => {
      if (I.current && !I.current.contains(e.target)) {
        F(false);
      }
      if (R.current && !R.current.contains(e.target)) {
        ee(false);
      }
      if (ne.current && !ne.current.contains(e.target)) {
        z(false);
      }
    };
    if (P || L || te) {
      document.addEventListener(`mousedown`, e, true);
    }
    return () => {
      document.removeEventListener(`mousedown`, e, true);
    };
  }, [P, L, te]);
  let [W, G] = Z.useState(l.expanded === undefined ? true : l.expanded);
  Z.useEffect(() => {
    if (l.expanded !== undefined) {
      G(l.expanded);
    }
  }, [l.expanded]);
  let ce = Lt({
    handleType: `target`
  });
  let le = Qt(Z.useMemo(() => {
    return ce.map(e => {
      return e.source;
    });
  }, [ce]));
  let ue = (() => {
    if (!le) {
      return {
        images: [],
        texts: []
      };
    }
    let e = Array.isArray(le) ? le : [le];
    let t = [];
    let n = [];
    e.forEach(e => {
      let r = ce.find(t => {
        return t.source === e?.id;
      });
      if (e?.data?.imageUrl) {
        t.push({
          id: e.id,
          url: e.data.imageUrl
        });
      }
      if (e?.type === `videoExtractNode` && e?.data?.extractedImages) {
        if (r && r.sourceHandle && r.sourceHandle.startsWith(`frame-`)) {
          let n = parseInt(r.sourceHandle.replace(`frame-`, ``), 10);
          if (!(e.data.hiddenIndices || []).includes(n)) {
            let r = e.data.allExtractedImages;
            if (r && r[n]) {
              t.push({
                id: `${e.id}-ext-${n}`,
                url: r[n]
              });
            }
          }
        } else {
          e.data.extractedImages.forEach((n, r) => {
            t.push({
              id: `${e.id}-ext-${r}`,
              url: n
            });
          });
        }
      }
      if (e?.type === `imageBoxNode` && Array.isArray(e.data?.images)) {
        let n = e.data.images;
        let r = e.data.selectedIds || [];
        if (r.length > 0) {
          let i = new Set(r);
          n.forEach((n, r) => {
            if (n?.url && i.has(n.id)) {
              t.push({
                id: `${e.id}-box-${r}`,
                url: n.url
              });
            }
          });
        } else {
          let r = n[typeof e.data.activeIndex == `number` ? e.data.activeIndex : 0]?.url;
          if (r) {
            t.push({
              id: `${e.id}-box-active`,
              url: r
            });
          }
        }
      }
      let i = new Set([`promptNode`, `imageNode`, `imageBoxNode`, `videoNode`, `sd2VideoNode`, `discountVideoNode`, `gridSplitNode`, `gridMergeNode`, `cropNode`, `urlToImageNode`, `fileToUrlNode`, `panoramaNode`, `videoExtractNode`]);
      if (e?.data?.text && !i.has(e.type)) {
        n.push({
          id: e.id,
          label: e?.type === `audioNode` ? `听音断句结果` : e.data.label || `文本节点`,
          text: e.data.text
        });
      }
    });
    return {
      images: t,
      texts: n
    };
  })();
  Z.useEffect(() => {
    if (l.prompt !== undefined && l.prompt !== f) {
      p(l.prompt);
    }
  }, [l.prompt]);
  Z.useEffect(() => {
    if (l.aspectRatio !== undefined && l.aspectRatio !== m) {
      h(l.aspectRatio);
    }
  }, [l.aspectRatio]);
  Z.useEffect(() => {
    if (l.customSize !== undefined && l.customSize !== y) {
      b(l.customSize);
    }
  }, [l.customSize]);
  Z.useEffect(() => {
    if (l.videoModel && !E) {
      let t = l.videoModel.split(`
`)[0].trim();
      D(t);
      i(e, {
        selectedModel: t
      });
    }
  }, [l.videoModel, E, e, i]);
  Z.useEffect(() => {
    if (l.selectedModel && l.selectedModel !== E) {
      D(l.selectedModel);
    }
  }, [l.selectedModel]);
  Z.useEffect(() => {
    if (l.videoDurations && !C) {
      let t = l.videoDurations.split(`
`)[0].trim();
      w(t);
      i(e, {
        selectedSeconds: t
      });
    }
  }, [l.videoDurations, C, e, i]);
  Z.useEffect(() => {
    if (l.selectedSeconds && l.selectedSeconds !== C) {
      w(l.selectedSeconds);
    }
  }, [l.selectedSeconds]);
  Z.useEffect(() => {}, [l.videoUrl, l.loading]);
  let de = () => {
    if (!f.trim() && ue.images.length === 0 && ue.texts.length === 0) {
      l.onShowToast?.(`请输入提示词或连接参考节点`);
      return;
    }
    l.onGenerateVideo?.(e, f, S, x, E, C, oe);
  };
  let fe = async e => {
    e.stopPropagation();
    if (l.videoUrl) {
      try {
        l.onShowToast?.(`开始下载视频...`);
        if (typeof chrome < `u` && chrome.downloads) {
          chrome.downloads.download({
            url: l.videoUrl,
            filename: `yimao/video-${Date.now()}.mp4`,
            saveAs: false
          });
        } else {
          let e = await (await fetch(l.videoUrl)).blob();
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
        l.onShowToast?.(`下载失败，请重试`);
        window.open(l.videoUrl, `_blank`);
      }
    }
  };
  let pe = async t => {
    let n = t.target.files?.[0];
    if (!n) {
      return;
    }
    t.target.value = ``;
    try {
      let t = await xi(n, {
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
      if (l.onAddImage) {
        l.onAddImage(e, n);
      }
    };
    r.readAsDataURL(n);
  };
  let me = (e => {
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
  })(S);
  let he = me !== null;
  let ge = he && me ? Math.round(Math.sqrt(me) * 360) : null;
  let _e = he && me ? Math.round(360 / Math.sqrt(me)) : null;
  let ve = Z.useRef(_e);
  let ye = Z.useRef(null);
  let [be, xe] = Z.useState(null);
  Z.useEffect(() => {
    let t = ve.current;
    ve.current = _e;
    if (ye.current !== null) {
      cancelAnimationFrame(ye.current);
      ye.current = null;
    }
    if (ge === null || _e === null) {
      xe(null);
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
    let s = t ?? _e;
    let l = ge;
    let u = _e;
    if (t === null || Math.round(r) === l && Math.round(s) === u) {
      xe(null);
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
      xe(c);
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
        ye.current = requestAnimationFrame(h);
      } else {
        ye.current = null;
        xe(null);
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
    ye.current = requestAnimationFrame(h);
    return () => {
      if (ye.current !== null) {
        cancelAnimationFrame(ye.current);
        ye.current = null;
      }
    };
  }, [ge, _e, e]);
  let Se = he ? be === null ? me ? {
    aspectRatio: String(me)
  } : undefined : {
    height: be
  } : undefined;
  const Component676 = `button`;
  const Component677 = `button`;
  const Component678 = `button`;
  const Component679 = `button`;
  const Component680 = `div`;
  const Component681 = `div`;
  const Component682 = `input`;
  const Component685 = `button`;
  const Component686 = `div`;
  const Component687 = `div`;
  const Component688 = `div`;
  const Component689 = `span`;
  const Component690 = `button`;
  const Component691 = `div`;
  const Component692 = `div`;
  const Component693 = `div`;
  const Component694 = `div`;
  const Component695 = `div`;
  const Component696 = `div`;
  const Component697 = `div`;
  const Component770 = `button`;
  const Component771 = `video`;
  const Component772 = `div`;
  const Component773 = `div`;
  return <Component773 className={`relative flex flex-col items-center group/node w-full min-w-[160px] min-h-[160px] ${he ? `h-auto` : `h-full`} ${n ? `z-50` : `z-10`}`}>
      <_cmp_Ti id={e} data={t} defaultTitle={`普通视频`} icon={<Pt size={11} className={`text-gray-500`} />} />
      {!l.loading && <Component681 className={`absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`}>
          <Component680 className={`flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`}>
            {ue.images.length === 0 && <Component676 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`上传参考图`} onClick={e => {
          e.stopPropagation();
          M.current?.click();
        }}>
                <_Component8 size={14} />
              </Component676>}
            {l.videoUrl && <Q.Fragment>
                <Component677 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`全屏播放`} onClick={e => {
            e.stopPropagation();
            k(true);
          }}>
                  <Ke size={14} />
                </Component677>
                <Component678 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`下载`} onClick={fe}>
                  <_Component6 size={14} />
                </Component678>
                <_cmp_Bn url={l.videoUrl} fallbackExt={`mp4`} onToast={e => {
            return l.onShowToast?.(e);
          }} />
                {l.onDelete && <Component679 className={`p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-md`} title={`删除`} onClick={e => {
            e.stopPropagation();
            l.onDelete?.();
          }}>
                    <Ot size={14} />
                  </Component679>}
              </Q.Fragment>}
          </Component680>
        </Component681>}
      <_cmp_Ei visible={!!n} minWidth={160} minHeight={160} keepAspectRatio={he} />
      <Component682 type={`file`} ref={M} style={{
      display: `none`
    }} accept={`image/*`} onChange={pe} />
      <Component697 className={`relative bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-colors duration-300 cursor-pointer group/display flex flex-col w-full
            ${he ? `` : `flex-1`}
            ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}
        `} style={Se} onClick={() => {
      G(!W);
      i(e, {
        expanded: !W
      });
    }}>
        <Component696 className={`flex items-center justify-center absolute inset-0 ${l.videoUrl ? `` : `bg-[#121212]`}`}>
          {l.videoUrl && <Q.Fragment>
              {(() => {
            let t = u && (l.thumbnailUrl || l.imageAvailable) ? l.thumbnailUrl || ii(l.videoUrl, d) : null;
            let n = ri(l.videoUrl);
            if (t) {
              const Component683 = `img`;
              return <Component683 src={t} alt={`video poster`} loading={`lazy`} decoding={`async`} draggable={false} className={`max-w-full w-full h-full object-contain block ${l.loading ? `opacity-50 blur-sm` : ``}`} onError={t => {
                let r = t.currentTarget;
                if (n && r.src !== n) {
                  r.src = n;
                } else {
                  i(e, {
                    imageAvailable: false
                  });
                }
              }} />;
            } else {
              const Component684 = `video`;
              return <Component684 src={l.videoUrl} poster={l.thumbnailUrl} preload={l.thumbnailUrl ? `auto` : `metadata`} className={`max-w-full w-full h-full object-contain block ${l.loading ? `opacity-50 blur-sm` : ``}`} controls={false} autoPlay={false} muted={false} />;
            }
          })()}
              {!l.loading && <Component686 className={`absolute inset-0 flex items-center justify-center pointer-events-none`}>
                  <Component685 className={`w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-black/70 transition-all nodrag pointer-events-auto`} title={`播放视频`} onClick={e => {
              e.stopPropagation();
              k(true);
            }}>
                    <_Component11 className={`text-white w-6 h-6`} />
                  </Component685>
                </Component686>}
            </Q.Fragment>}
          {l.loading && <Component692 className={`absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500 z-10 overflow-hidden bg-[#121212]`}>
              {(ue.images[0] || l.thumbnailUrl) && <Component687 className={`absolute inset-0 bg-cover bg-center opacity-30 blur-xl scale-110`} style={{
            backgroundImage: `url(${l.thumbnailUrl || ue.images[0].url})`
          }} />}
              <Component688 className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer`} style={{
            transform: `skewX(-20deg)`
          }} />
              <Component691 className={`relative z-10 flex flex-col items-center gap-2`}>
                <_cmp_Oi size={32} />
                <Component689 className={`text-xs font-mono tracking-wider text-white/80`}>
                  {!l.progress || l.progress === 0 ? `生成中...` : `生成中... ${l.progress}%`}
                </Component689>
                <Component690 onClick={t => {
              t.stopPropagation();
              l.onStop?.(e);
            }} className={`mt-2 bg-[#222]/80 hover:bg-[#333] border border-[#444] text-gray-400 hover:text-gray-200 px-3 py-1 rounded-full text-[10px] flex items-center gap-1.5 transition-colors backdrop-blur-sm`}>
                  <T size={10} fill={`currentColor`} />
                  {`停止`}
                </Component690>
              </Component691>
            </Component692>}
          {!l.videoUrl && !l.loading && !l.errorMessage && <Component693 className={`flex flex-col items-center justify-center absolute inset-0 bg-[#151515] pointer-events-none`}>
              <Pt size={80} className={`text-gray-700`} strokeWidth={1.2} />
            </Component693>}
          {l.errorMessage && !l.loading && <Component695 className={`absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-500 z-10 bg-[#1a1a1a] p-4 text-center`}>
              <_Component16 size={32} />
              <Component694 className={`text-xs font-medium max-w-full break-words`}>
                {l.errorMessage}
              </Component694>
            </Component695>}
        </Component696>
      </Component697>
      <_cmp__Component10 type={`target`} position={X.Left} />
      <_cmp__Component10 type={`source`} position={X.Right} />
      {(() => {
      const Component698 = `img`;
      const Component699 = `div`;
      const Component700 = `div`;
      const Component701 = `img`;
      const Component702 = `video`;
      const Component703 = `div`;
      const Component704 = `div`;
      const Component705 = `div`;
      const Component706 = `div`;
      const Component707 = `span`;
      const Component708 = `div`;
      const Component709 = `div`;
      const Component710 = `div`;
      const Component711 = `div`;
      const Component712 = `div`;
      const Component713 = `div`;
      const Component714 = `span`;
      const Component715 = `button`;
      const Component716 = `div`;
      const Component717 = `button`;
      const Component718 = `div`;
      const Component719 = `span`;
      const Component720 = `input`;
      const Component721 = `div`;
      const Component722 = `span`;
      const Component723 = `input`;
      const Component724 = `div`;
      const Component725 = `div`;
      const Component726 = `div`;
      const Component727 = `div`;
      const Component728 = `button`;
      const Component729 = `div`;
      const Component730 = `div`;
      const Component731 = `div`;
      const Component732 = `div`;
      const Component733 = `div`;
      const Component734 = `span`;
      const Component735 = `span`;
      const Component736 = `button`;
      const Component748 = `div`;
      const Component749 = `div`;
      const Component750 = `div`;
      const Component751 = `span`;
      const Component752 = `button`;
      const Component753 = `div`;
      const Component754 = `button`;
      const Component755 = `div`;
      const Component756 = `div`;
      const Component757 = `div`;
      const Component758 = `div`;
      const Component759 = `button`;
      const Component760 = `div`;
      const Component761 = `span`;
      const Component762 = `div`;
      const Component763 = `div`;
      const Component764 = `button`;
      const Component765 = `div`;
      const Component766 = `div`;
      const Component767 = `div`;
      const Component768 = `div`;
      let n = <Component768 className={`space-y-3`}>
            <Component713 className={`flex flex-col gap-2 mb-2`}>
              {(ue.images.length > 0 || ue.texts.length > 0 || ae.length > 0) && <Component709 className={`flex flex-wrap gap-2 mb-1`}>
                  {ue.images.map((t, n) => {
              return <Component700 className={`w-10 h-10 rounded-md overflow-hidden border border-[#444] relative group bg-black`} title={`连线图片`} key={`img-${n}`}>
                        <Component698 src={ti(t.url, {
                  width: 200
                })} alt={`Ref`} loading={`lazy`} decoding={`async`} className={`w-full h-full object-cover`} onError={e => {
                  let n = e.currentTarget;
                  if (t.url && n.src !== t.url) {
                    n.src = t.url;
                  }
                }} />
                        <Component699 className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`} onClick={n => {
                  n.stopPropagation();
                  a(n => {
                    return n.filter(n => {
                      return n.target !== e || n.source !== t.id;
                    });
                  });
                }}>
                          <Gt size={10} className={`text-white`} />
                        </Component699>
                      </Component700>;
            })}
                  {ae.map((t, n) => {
              return <Component706 className={`w-10 h-10 rounded-md overflow-hidden border border-blue-500/50 relative group bg-black`} title={`通过 @ 选中的素材`} key={`ctx-${n}`}>
                        {t.type.startsWith(`image`) ? <Component701 src={ti(t.url, {
                  width: 200
                })} loading={`lazy`} decoding={`async`} className={`w-full h-full object-cover opacity-80`} onError={e => {
                  let n = e.currentTarget;
                  if (t.url && n.src !== t.url) {
                    n.src = t.url;
                  }
                }} /> : t.type.startsWith(`video`) ? <Component702 src={t.url} preload={`metadata`} className={`w-full h-full object-cover opacity-80`} /> : <Component703 className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                            <_Component17 size={12} className={`text-gray-400`} />
                          </Component703>}
                        <Component704 className={`absolute inset-0 bg-blue-500/10 pointer-events-none`} />
                        <Component705 className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`} onClick={t => {
                  t.stopPropagation();
                  let r = ae.filter((e, t) => {
                    return t !== n;
                  });
                  U(r);
                  i(e, {
                    selectedContextResources: r
                  });
                }}>
                          <Gt size={10} className={`text-white`} />
                        </Component705>
                      </Component706>;
            })}
                  {ue.texts.map((e, t) => {
              return <Component708 className={`h-8 px-2 bg-[#2a2a2a] border border-[#444] rounded flex items-center gap-1 text-[10px] text-gray-300 hover:bg-[#333] hover:border-blue-500 hover:text-blue-400 transition-colors cursor-help group/text`} title={e.text} key={`txt-${t}`}>
                        <_Component17 size={10} />
                        <Component707 className={`max-w-[80px] truncate`}>{e.label}</Component707>
                      </Component708>;
            })}
                </Component709>}
              <Component712 className={`flex items-start gap-2`}>
                <Component711 className={`flex-1 nodrag relative`}>
                  <_cmp_Pi ref={N} className={`w-full bg-transparent text-[15px] text-gray-200 outline-none leading-relaxed placeholder-gray-600 font-sans custom-scrollbar nodrag nowheel nopan`} style={{
                width: t.inputWidth ? `${t.inputWidth}px` : undefined,
                height: t.inputHeight ? `${t.inputHeight}px` : `80px`,
                minHeight: `80px`,
                overflow: `auto`
              }} placeholder={`描述你想要的视频内容 (输入 @ 调出素材)...`} value={f} onChange={n => {
                p(n);
                i(e, {
                  prompt: n
                });
                if (n.endsWith(`@`)) {
                  V(true);
                } else if (!n.includes(`@`)) {
                  V(false);
                }
                if (!t.inputHeight || t.inputHeight <= 200) {
                  let t = N.current;
                  requestAnimationFrame(() => {
                    if (t) {
                      t.style.height = `auto`;
                      let n = Math.max(80, Math.min(t.scrollHeight, 200));
                      t.style.height = `${n}px`;
                      i(e, {
                        inputHeight: n
                      });
                    }
                  });
                }
              }} onKeyDown={e => {
                if (e.key === `Enter` && (e.ctrlKey || e.metaKey)) {
                  de();
                }
              }} autoFocus={W} onWheel={e => {
                return e.stopPropagation();
              }} />
                  {re && <Component710 className={`absolute bottom-full left-0 mb-1 z-[100]`} onWheel={e => {
                return e.stopPropagation();
              }} onClick={e => {
                return e.stopPropagation();
              }}>
                      <_cmp_No resources={H} onSelect={t => {
                  let n = f.lastIndexOf(`@`);
                  let r = n >= 0 ? f.substring(0, n) + f.substring(n + 1) : f;
                  if (t.type === `text`) {
                    let n = r + (t.url || ``);
                    p(n);
                    i(e, {
                      prompt: n
                    });
                  } else {
                    let n = [...ae, t];
                    U(n);
                    i(e, {
                      selectedContextResources: n
                    });
                    p(r);
                    i(e, {
                      prompt: r
                    });
                  }
                  V(false);
                }} onClose={() => {
                  return V(false);
                }} />
                    </Component710>}
                </Component711>
              </Component712>
            </Component713>
            <Component767 className={`flex items-center justify-between pt-2 border-t border-[#2a2a2a] nodrag`}>
              <Component757 className={`flex items-center gap-1.5 overflow-visible`}>
                <Component732 className={`relative nodrag flex items-center`} ref={ne}>
                  <Component715 className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer max-w-[120px]`} onClick={e => {
                e.stopPropagation();
                z(!te);
              }} title={`选择比例和时长`}>
                    <T size={12} className={`opacity-70`} />
                    <Component714 className={`truncate`}>
                      {m === `custom` ? `自定义` : ss.find(e => {
                    return e.value === m;
                  })?.label || m || `16:9`}
                      {` · `}
                      {C}
                      {`s`}
                    </Component714>
                  </Component715>
                  {te && <Component731 className={`absolute bottom-full left-0 mb-1 w-56 bg-[#222] border border-[#333] rounded-lg shadow-xl p-3 z-50 flex flex-col gap-3 max-h-72 overflow-y-auto custom-scrollbar nowheel nopan nodrag`} onClick={e => {
                return e.stopPropagation();
              }}>
                      <Component726>
                        <Component716 className={`text-[10px] text-gray-500 mb-2 px-1`}>{`比例 / 分辨率`}</Component716>
                        <Component718 className={`flex flex-wrap gap-1.5 mb-3`}>
                          {ss.map(t => {
                      return <Component717 className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ${m === t.value ? `bg-[#444] text-white` : `bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} onClick={() => {
                        h(t.value);
                        i(e, {
                          aspectRatio: t.value
                        });
                        Zr.setConfig(Fr.VIDEO_SIZE, t.value);
                      }} key={t.value}>
                                {t.label}
                              </Component717>;
                    })}
                        </Component718>
                        {m === `custom` && <Component725 className={`bg-[#1c1c1c] p-2 rounded border border-[#333] mb-2 flex flex-col gap-2`}>
                            <Component721 className={`flex items-center gap-2`}>
                              <Component719 className={`text-[10px] text-gray-500 w-10`}>{`比例:`}</Component719>
                              <Component720 type={`text`} value={g} onChange={e => {
                        return _(e.target.value);
                      }} placeholder={`如 16:9`} className={`flex-1 bg-[#121212] border border-[#444] rounded px-2 py-1 text-[11px] text-gray-200 outline-none focus:border-blue-500`} />
                            </Component721>
                            <Component724 className={`flex items-center gap-2`}>
                              <Component722 className={`text-[10px] text-gray-500 w-10`}>{`尺寸:`}</Component722>
                              <Component723 type={`text`} value={y} onChange={t => {
                        b(t.target.value);
                        i(e, {
                          customSize: t.target.value
                        });
                      }} placeholder={`如 1280x720 或 720p`} className={`flex-1 bg-[#121212] border border-[#444] rounded px-2 py-1 text-[11px] text-gray-200 outline-none focus:border-blue-500`} />
                            </Component724>
                          </Component725>}
                      </Component726>
                      {l.videoDurations && <Component730>
                          <Component727 className={`text-[10px] text-gray-500 mb-2 px-1`}>{`时长 (秒)`}</Component727>
                          <Component729 className={`flex flex-wrap gap-1.5`}>
                            {l.videoDurations.split(`
`).map(e => {
                      return e.trim();
                    }).filter(e => {
                      return e !== ``;
                    }).map((t, n) => {
                      return <Component728 className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ${C === t ? `bg-[#444] text-white` : `bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} onClick={() => {
                        w(t);
                        i(e, {
                          selectedSeconds: t
                        });
                        Zr.setConfig(Fr.VIDEO_SECONDS, t);
                      }} key={n}>
                                    {t}
                                    {`s`}
                                  </Component728>;
                    })}
                          </Component729>
                        </Component730>}
                    </Component731>}
                </Component732>
                {!!l.videoModel && !!(l.videoModel.split(`
`).filter(e => {
              return e.trim() !== ``;
            }).length > 0) && <Component749 className={`relative nodrag flex items-center`} ref={I}>
                      <Component733 className={`w-[1px] h-3 bg-[#444] mr-1.5`} />
                      <Component736 className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`} onClick={e => {
                e.stopPropagation();
                F(!P);
              }} title={E ? `${E}（${ma(E) ? `内置` : `第三方`}）` : `选择模型`}>
                        {E && <Component734 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${ma(E) ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                            {ma(E) ? `内置` : `三方`}
                          </Component734>}
                        <Component735 className={`whitespace-nowrap`}>
                          {E || `选择模型`}
                        </Component735>
                      </Component736>
                      {P && <Component748 className={`absolute bottom-full left-0 mb-1 min-w-[17rem] w-max max-w-[29rem] bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 block max-h-60 overflow-y-auto custom-scrollbar nowheel nopan nodrag`} onClick={e => {
                return e.stopPropagation();
              }}>
                          {(() => {
                  let t = l.videoModel.split(`
`).map(e => {
                    return e.trim();
                  }).filter(e => {
                    return e !== ``;
                  });
                  let n = t.filter(e => {
                    return ma(e);
                  });
                  let r = t.filter(e => {
                    return !ma(e);
                  });
                  let a = (t, n, r) => {
                    let a = r ? sa(t) : null;
                    let o = r ? ca(t) : null;
                    let s = va(t, E === t);
                    const Component737 = `span`;
                    const Component738 = `span`;
                    const Component739 = `span`;
                    const Component740 = `span`;
                    const Component741 = `button`;
                    return <Component741 className={s.className} disabled={s.disabled} onClick={() => {
                      if (!s.disabled) {
                        D(t);
                        i(e, {
                          selectedModel: t
                        });
                        Zr.setConfig(Fr.VIDEO_MODEL, t);
                        F(false);
                      }
                    }} title={s.title} key={`${r ? `b` : `o`}-${n}`}>
                                  <Component737 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${r ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                                    {r ? `内置` : `三方`}
                                  </Component737>
                                  <Component738 className={`flex-1 whitespace-nowrap`}>
                                    {t}
                                  </Component738>
                                  {a !== null && <Component740 className={`shrink-0 inline-flex items-center gap-0.5 text-[10px] text-orange-400 tabular-nums`}>
                                      <_Component19 className={`w-2.5 h-2.5`} strokeWidth={2.5} />
                                      <Component739>
                                        {ha(a)}
                                        {o ? `/${o}` : ``}
                                      </Component739>
                                    </Component740>}
                                </Component741>;
                  };
                  const Component742 = `span`;
                  const Component743 = `span`;
                  const Component744 = `span`;
                  const Component745 = `div`;
                  const Component746 = `div`;
                  const Component747 = `div`;
                  return <Q.Fragment>
                                {n.length > 0 && <Q.Fragment>
                                    <Component745 className={`text-[10px] text-blue-300 mb-1 px-1 flex items-center gap-1`}>
                                      <Component742>{`✨`}</Component742>
                                      <Component743>{`内置模型`}</Component743>
                                      <Component744 className={`ml-auto text-white/90 hover:text-white cursor-pointer whitespace-nowrap`} onClick={e => {
                          e.stopPropagation();
                          window.dispatchEvent(new CustomEvent(`mutiwindow-open-builtin-settings`));
                          F(false);
                        }} title={`查看内置模型详情`}>{`详情 ›`}</Component744>
                                    </Component745>
                                    {n.map((e, t) => {
                        return a(e, t, true);
                      })}
                                  </Q.Fragment>}
                                {r.length > 0 && <Q.Fragment>
                                    {n.length > 0 && <Component746 className={`h-px bg-[#333] my-1.5`} />}
                                    <Component747 className={`text-[10px] text-gray-500 mb-1 px-1`}>{`第三方 API`}</Component747>
                                    {r.map((e, t) => {
                        return a(e, t, false);
                      })}
                                  </Q.Fragment>}
                              </Q.Fragment>;
                })()}
                        </Component748>}
                    </Component749>}
                <Component756 className={`relative nodrag flex items-center`} ref={R}>
                  <Component750 className={`w-[1px] h-3 bg-[#444] mr-1.5`} />
                  <Component752 className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer max-w-[80px]`} onClick={e => {
                e.stopPropagation();
                ee(!L);
              }} title={`请求格式`}>
                    <Component751 className={`truncate`}>
                      {oe === `auto` ? `自动格式` : oe === `json` ? `JSON` : `FormData`}
                    </Component751>
                  </Component752>
                  {L && <Component755 className={`absolute bottom-full left-0 mb-1 w-32 bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 block nodrag`} onClick={e => {
                return e.stopPropagation();
              }}>
                      <Component753 className={`text-[10px] text-gray-500 mb-2 px-1`}>{`请求格式`}</Component753>
                      {[{
                  label: `自动检测`,
                  value: `auto`
                }, {
                  label: `FormData`,
                  value: `formdata`
                }, {
                  label: `JSON`,
                  value: `json`
                }].map(t => {
                  return <Component754 className={`w-full block mb-1 last:mb-0 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors truncate ${oe === t.value ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} onClick={() => {
                    se(t.value);
                    i(e, {
                      apiFormat: t.value
                    });
                    ee(false);
                  }} key={t.value}>
                            {t.label}
                          </Component754>;
                })}
                    </Component755>}
                </Component756>
                <_cmp__Component20 category={`video`} presetPrompts={l.presetPrompts || []} onApply={t => {
              let n = f ? `${f}, ${t}` : t;
              p(n);
              i(e, {
                prompt: n
              });
            }} onToast={e => {
              return l.onShowToast?.(e);
            }} />
              </Component757>
              <Component766 className={`flex items-center gap-3 flex-shrink-0 ml-2`}>
                {l.loading ? <Component760 className={`flex items-center bg-red-500/10 rounded-full p-1 pl-3 border border-red-500/30 hover:border-red-500/50 transition-colors cursor-pointer group/btn`} onClick={t => {
              t.stopPropagation();
              l.onStop?.(e);
            }}>
                    <Component758 className={`flex items-center gap-1 mr-3 text-xs text-red-400 group-hover/btn:text-red-300`}>{`停止`}</Component758>
                    <Component759 className={`bg-red-500/20 text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-500/30 transition-colors`}>
                      <T size={10} fill={`currentColor`} />
                    </Component759>
                  </Component760> : <Component765 className={`flex items-center bg-[#2a2a2a] rounded-full p-1 pl-3 border border-[#333] hover:border-gray-500 transition-colors cursor-pointer group/btn`} onClick={e => {
              e.stopPropagation();
              de();
            }}>
                    {E && ma(E) && sa(E) !== null && <Component762 className={`flex items-center gap-0.5 mr-2 text-[11px] text-orange-400 tabular-nums`}>
                        <_Component19 className={`w-3 h-3`} strokeWidth={2.5} />
                        <Component761>
                          {ha(sa(E) || 0)}
                          {ca(E) ? `/${ca(E)}` : ``}
                        </Component761>
                      </Component762>}
                    <Component763 className={`flex items-center gap-1 mr-3 text-xs text-gray-300 group-hover/btn:text-white`}>{`生成`}</Component763>
                    <Component764 className={`bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors`}>
                      <_Component21 size={14} strokeWidth={3} />
                    </Component764>
                  </Component765>}
              </Component766>
            </Component767>
          </Component768>;
      const Component769 = `div`;
      return <Q.Fragment>
            <Component769 className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[#1c1c1c] rounded-2xl border border-[#333] shadow-2xl min-w-[500px] w-max max-w-[920px] transition-all duration-300 origin-top z-50
                ${W ? `opacity-100 scale-100 p-4 overflow-visible` : `opacity-0 scale-95 pointer-events-none h-0 p-0 border-0 overflow-hidden`}
              `} onClick={e => {
          return e.stopPropagation();
        }}>
              {!A && n}
              {W && !A && <_cmp_Fi targetRef={N} onRequestFullscreen={() => {
            return j(true);
          }} onResizeEnd={(t, n) => {
            return i(e, {
              inputWidth: t,
              inputHeight: n
            });
          }} />}
            </Component769>
            <_cmp_Ii open={A} title={`编辑提示词 - 普通视频`} onClose={() => {
          return j(false);
        }}>
              {n}
            </_cmp_Ii>
          </Q.Fragment>;
    })()}
      {O && l.videoUrl && Fn.createPortal(<Component772 className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md`} onClick={() => {
      return k(false);
    }}>
            <Component770 className={`absolute top-6 right-6 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-50`} onClick={() => {
        return k(false);
      }}>
              <Gt size={32} />
            </Component770>
            <Component771 src={l.videoUrl} className={`max-w-[95vw] max-h-[95vh] object-contain shadow-2xl rounded-lg outline-none`} controls={true} autoPlay={true} onClick={e => {
        return e.stopPropagation();
      }} />
          </Component772>, document.body)}
    </Component773>;
});
export default cs;