// TODO(全局, 无需 import): data, selected, updateNodeData, setEdges, addNodes, addEdges, getNodes, l, uploadedAssets, uploadingAssetsRef, failedAssetsRef, uploadAsset, retryAsset, getAssetStatus, clearAllFailedAssets, nodeId, initialUploadedAssets, r, onUploadAsset, onShowToast, p, k, resId, resUrl, resType, url, type, n, color, handleType, oe, images, videos, audios, texts, se, i, o, label, text, ee, z, u, f, selectedModel, g, selectedSeconds, m, b, filename, saveAs, display, s, x, subfolder, preferThumbnail, thumbMaxDim, thumbQuality, position, imageUrl, thumbnailUrl, source, videoUrl, videoName, audioUrl, audioName, expanded, backgroundImage, transform, internalResources, width, selectedContextResources, height, minHeight, overflow, prompt, inputHeight, size, inputWidth
import _cmp_Ti from './Ti.jsx';
import _cmp_Ei from './Ei.jsx';
import _cmp_Oi from './Oi.jsx';
import _cmp__Component10 from './_Component10.jsx';
import _cmp_Pi from './Pi.jsx';
import _cmp__Component20 from './_Component20.jsx';
import _cmp_Fi from './Fi.jsx';
import _cmp_Ii from './Ii.jsx';
import _cmp_jr from './jr.jsx';
import { id, We, t, ls, e, F, h, _, O, D, j, A, E, ie, re, U, ne, Lt, Qt, us, P, W, R, te, d, V, C, c, y, xi, X, I, L, ti, w, N, G, H, M, ds, va, S, Fn, _Component22, Be, B, _Component8, Ke, _Component6, Ot, _Component11, T, _Component16, Pt, _Component36, Gt, _Component17, _Component21 } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
var fs = Z.memo(({
  id: e,
  data: t,
  selected: n
}) => {
  let {
    updateNodeData: r,
    setEdges: i,
    addNodes: a,
    addEdges: o,
    getNodes: c
  } = We();
  let l = t;
  let [u, d] = Z.useState(l.prompt || ``);
  let [f, p] = Z.useState(l.size || localStorage.getItem(`mutiwindow_sd2video_size`) || `16:9`);
  let [m, h] = Z.useState(l.selectedSeconds || localStorage.getItem(`mutiwindow_sd2video_seconds`) || l.videoDurations && l.videoDurations.split(`
`)[0].trim() || `10`);
  let [g, _] = Z.useState(l.selectedModel || localStorage.getItem(`mutiwindow_sd2video_model`) || l.sd2VideoModel && l.sd2VideoModel.split(`
`)[0].trim() || ``);
  let [y, b] = Z.useState(false);
  let [x, S] = Z.useState(false);
  let C = Z.useRef(null);
  let w = Z.useRef(null);
  let [E, D] = Z.useState(false);
  let O = Z.useRef(null);
  let [k, A] = Z.useState(false);
  let j = Z.useRef(null);
  let [M, N] = Z.useState(false);
  let [P, F] = Z.useState(l.selectedContextResources || []);
  let [I, L] = Z.useState(l.internalResources || []);
  let {
    uploadedAssets: ee,
    uploadingAssetsRef: R,
    failedAssetsRef: te,
    uploadAsset: z,
    retryAsset: ne,
    getAssetStatus: re,
    clearAllFailedAssets: V
  } = ls({
    nodeId: e,
    initialUploadedAssets: l.uploadedAssets,
    updateNodeData: r,
    onUploadAsset: l.onUploadAsset,
    onShowToast: l.onShowToast
  });
  Z.useEffect(() => {
    if (l.selectedContextResources) {
      F(l.selectedContextResources);
    }
  }, [l.selectedContextResources]);
  Z.useEffect(() => {
    if (l.selectedSeconds !== undefined) {
      h(l.selectedSeconds);
    }
  }, [l.selectedSeconds]);
  Z.useEffect(() => {
    if (l.selectedModel !== undefined) {
      _(l.selectedModel);
    }
  }, [l.selectedModel]);
  Z.useEffect(() => {
    if (l.size !== undefined) {
      p(l.size);
    }
  }, [l.size]);
  Z.useEffect(() => {
    let e = e => {
      if (O.current && !O.current.contains(e.target)) {
        D(false);
      }
      if (j.current && !j.current.contains(e.target)) {
        A(false);
      }
    };
    if (E || k) {
      document.addEventListener(`mousedown`, e, true);
    }
    return () => {
      document.removeEventListener(`mousedown`, e, true);
    };
  }, [E, k]);
  let [H, ie] = Z.useState(l.expanded === undefined ? true : l.expanded);
  Z.useEffect(() => {
    if (l.expanded !== undefined) {
      ie(l.expanded);
    }
  }, [l.expanded]);
  let _Component37 = ({
    resId: e,
    resUrl: t,
    resType: n
  }) => {
    let r = re(e, t);
    if (!r.isUploading && !r.isUploaded && !r.isFailed) {
      return null;
    } else if (r.isFailed) {
      const Component774 = `span`;
      const Component775 = `div`;
      return <Component775 className={`absolute inset-0 bg-red-900/70 backdrop-blur-[1px] flex flex-col items-center justify-center cursor-pointer hover:bg-red-900/85 transition-colors group/retry z-10`} title={`上传失败,点击重试`} onClick={r => {
        r.stopPropagation();
        U({
          id: e,
          url: t,
          type: n
        });
      }}>
          <_Component22 size={14} className={`text-white drop-shadow-md group-hover/retry:rotate-180 transition-transform duration-300`} />
          <Component774 className={`text-[8px] text-white mt-0.5 font-medium leading-none`}>{`重试`}</Component774>
        </Component775>;
    } else {
      const Component776 = `div`;
      return <Component776 className={`absolute top-0 left-0 p-0.5 pointer-events-none`}>
          {r.isUploading ? <_Component22 size={12} className={`animate-spin drop-shadow-md`} style={{
          color: `rgb(210,2,7)`
        }} /> : r.isUploaded ? <Be size={12} className={`text-green-500 drop-shadow-md`} /> : null}
        </Component776>;
    }
  };
  let U = async e => {
    await ne(e).catch(() => {});
  };
  let oe = Lt({
    handleType: `target`
  });
  let se = Qt(Z.useMemo(() => {
    return oe.map(e => {
      return e.source;
    });
  }, [oe]));
  let W = Z.useMemo(() => {
    if (!se) {
      return {
        images: [],
        videos: [],
        audios: [],
        texts: []
      };
    }
    let e = Array.isArray(se) ? se : [se];
    let t = [];
    let n = [];
    let r = [];
    let i = [];
    e.forEach(e => {
      let a = oe.find(t => {
        return t.source === e?.id;
      });
      if (e?.data?.imageUrl) {
        let i = e.data.imageUrl;
        if (i.startsWith(`data:video/`) || /\.(mp4|webm|mov|ogg)($|\?)/i.test(i)) {
          n.push({
            id: e.id,
            url: i,
            type: `video`
          });
        } else if (i.startsWith(`data:audio/`) || /\.(mp3|wav|ogg|aac)($|\?)/i.test(i)) {
          r.push({
            id: e.id,
            url: i,
            type: `audio`
          });
        } else {
          t.push({
            id: e.id,
            url: i,
            type: `image`
          });
        }
      }
      if (e?.data?.videoUrl) {
        if (us(e.data.videoUrl)) {
          r.push({
            id: e.id,
            url: e.data.videoUrl,
            type: `audio`
          });
        } else {
          n.push({
            id: e.id,
            url: e.data.videoUrl,
            type: `video`
          });
        }
      }
      if (e?.data?.audioUrl && !r.some(t => {
        return t.url === e.data.audioUrl;
      })) {
        r.push({
          id: e.id,
          url: e.data.audioUrl,
          type: `audio`
        });
      }
      if (e?.type === `videoExtractNode` && e?.data?.extractedImages) {
        if (a && a.sourceHandle && a.sourceHandle.startsWith(`frame-`)) {
          let n = parseInt(a.sourceHandle.replace(`frame-`, ``), 10);
          if (!(e.data.hiddenIndices || []).includes(n)) {
            let r = e.data.allExtractedImages;
            if (r && r[n]) {
              t.push({
                id: `${e.id}-ext-${n}`,
                url: r[n],
                type: `image`
              });
            }
          }
        } else {
          e.data.extractedImages.forEach((n, r) => {
            t.push({
              id: `${e.id}-ext-${r}`,
              url: n,
              type: `image`
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
                url: n.url,
                type: `image`
              });
            }
          });
        } else {
          let r = n[typeof e.data.activeIndex == `number` ? e.data.activeIndex : 0]?.url;
          if (r) {
            t.push({
              id: `${e.id}-box-active`,
              url: r,
              type: `image`
            });
          }
        }
      }
      let o = new Set([`promptNode`, `imageNode`, `imageBoxNode`, `videoNode`, `sd2VideoNode`, `discountVideoNode`, `gridSplitNode`, `gridMergeNode`, `cropNode`, `urlToImageNode`, `fileToUrlNode`, `panoramaNode`, `videoExtractNode`]);
      if (e?.data?.text && !o.has(e.type)) {
        i.push({
          id: e.id,
          label: e?.type === `audioNode` ? `听音断句结果` : e.data.label || `文本节点`,
          text: e.data.text
        });
      }
    });
    return {
      images: t,
      videos: n,
      audios: r,
      texts: i
    };
  }, [se, oe]);
  Z.useEffect(() => {
    if (l.onUploadAsset) {
      [...P, ...W.images, ...W.videos, ...W.audios].forEach(e => {
        if (!e.url || e.url.startsWith(`asset://`)) {
          return;
        }
        let t = e.url;
        let n = e.id;
        if (!ee[t] && !R.current[n] && !te.current[n]) {
          z({
            id: n,
            url: e.url,
            type: e.type
          }).catch(e => {
            console.error(`Auto upload failed for`, n, e);
          });
        }
      });
    }
  }, [P, W, ee, z, e]);
  Z.useEffect(() => {
    if (l.prompt !== undefined && l.prompt !== u) {
      d(l.prompt);
    }
  }, [l.prompt]);
  Z.useEffect(() => {
    if (l.size !== undefined && l.size !== f) {
      p(l.size);
    }
  }, [l.size]);
  Z.useEffect(() => {
    if (l.sd2VideoModel && !g) {
      let t = l.sd2VideoModel.split(`
`)[0].trim();
      _(t);
      r(e, {
        selectedModel: t
      });
    }
  }, [l.sd2VideoModel, g, e, r]);
  Z.useEffect(() => {
    if (l.selectedModel && l.selectedModel !== g) {
      _(l.selectedModel);
    }
  }, [l.selectedModel]);
  Z.useEffect(() => {
    if (!l.selectedModel && g.trim()) {
      r(e, {
        selectedModel: g
      });
    }
  }, [l.selectedModel, g, e, r]);
  Z.useEffect(() => {
    if (l.videoDurations && !m) {
      let t = l.videoDurations.split(`
`)[0].trim();
      h(t);
      r(e, {
        selectedSeconds: t
      });
    }
  }, [l.videoDurations, m, e, r]);
  Z.useEffect(() => {
    if (l.selectedSeconds && l.selectedSeconds !== m) {
      h(l.selectedSeconds);
    }
  }, [l.selectedSeconds]);
  Z.useEffect(() => {}, [l.videoUrl, l.loading]);
  let G = () => {
    if (Object.keys(R.current).length > 0) {
      l.onShowToast?.(`素材正在上传处理中，请等待所有对勾出现后再生成`);
      return;
    }
    if (Object.keys(te.current).length > 0) {
      l.onShowToast?.(`有素材上传失败，已为您重新尝试上传，请稍后`);
      V();
      return;
    }
    if (!u.trim() && W.images.length === 0 && W.texts.length === 0 && P.length === 0) {
      l.onShowToast?.(`请输入提示词或连接参考节点`);
      return;
    }
    l.onGenerateSD2Video?.(e, u, f, g, m);
  };
  const Component777 = `button`;
  const Component778 = `button`;
  const Component779 = `button`;
  const Component780 = `button`;
  const Component781 = `div`;
  const Component782 = `div`;
  const Component783 = `input`;
  const Component784 = `video`;
  const Component785 = `button`;
  const Component786 = `div`;
  const Component787 = `div`;
  const Component788 = `div`;
  const Component789 = `span`;
  const Component790 = `button`;
  const Component791 = `div`;
  const Component792 = `div`;
  const Component793 = `div`;
  const Component794 = `div`;
  const Component795 = `div`;
  const Component796 = `div`;
  const Component797 = `div`;
  const Component885 = `button`;
  const Component886 = `video`;
  const Component887 = `div`;
  const Component888 = `div`;
  return <Component888 className={`relative flex flex-col items-center group/node transition-all w-full h-full min-w-[200px] min-h-[200px] ${n ? `z-50` : `z-10`}`}>
      <_cmp_Ti id={e} data={t} defaultTitle={`SD2视频`} icon={<B size={11} className={`text-gray-500`} />} />
      {!l.loading && <Component782 className={`absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`}>
          <Component781 className={`flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`}>
            {W.images.length === 0 && <Component777 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`上传参考图`} onClick={e => {
          e.stopPropagation();
          C.current?.click();
        }}>
                <_Component8 size={14} />
              </Component777>}
            {l.videoUrl && <Q.Fragment>
                <Component778 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`全屏播放`} onClick={e => {
            e.stopPropagation();
            b(true);
          }}>
                  <Ke size={14} />
                </Component778>
                <Component779 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`下载`} onClick={async e => {
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
          }}>
                  <_Component6 size={14} />
                </Component779>
                {l.onDelete && <Component780 className={`p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-md`} title={`删除`} onClick={e => {
            e.stopPropagation();
            l.onDelete?.();
          }}>
                    <Ot size={14} />
                  </Component780>}
              </Q.Fragment>}
          </Component781>
        </Component782>}
      <_cmp_Ei visible={!!n} minWidth={200} minHeight={200} />
      <Component783 type={`file`} ref={C} style={{
      display: `none`
    }} accept={`image/*,video/*,audio/*`} onChange={async t => {
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
            console.warn(`[SD2VideoNode] urlifyAsset failed, fallback to resizeImage:`, e);
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
          console.warn(`[SD2VideoNode] urlifyAsset failed for media, fallback to base64:`, e);
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
    }} />
      <Component797 className={`relative bg-[#1c1c1c] rounded-xl border shadow-xl transition-all duration-300 cursor-pointer group/display w-full flex-1 flex flex-col overflow-visible
            ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}
        `} onClick={() => {
      ie(!H);
      r(e, {
        expanded: !H
      });
    }}>
        <Component796 className={`flex items-center justify-center relative w-full flex-1 rounded-b-xl overflow-hidden ${l.videoUrl ? `` : `bg-[#0d0c0c]`}`}>
          {l.videoUrl && <Q.Fragment>
              <Component784 src={l.videoUrl} poster={l.thumbnailUrl} className={`max-w-full max-h-[400px] w-full h-full object-contain block ${l.loading ? `opacity-50 blur-sm` : ``}`} controls={false} autoPlay={false} muted={false} onDoubleClick={e => {
            e.stopPropagation();
            b(true);
          }} />
              {!l.loading && <Component786 className={`absolute inset-0 flex items-center justify-center pointer-events-none`}>
                  <Component785 className={`w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-black/70 transition-all nodrag pointer-events-auto`} title={`播放视频`} onClick={e => {
              e.stopPropagation();
              b(true);
            }}>
                    <_Component11 className={`text-white w-6 h-6`} />
                  </Component785>
                </Component786>}
            </Q.Fragment>}
          {l.loading && <Component792 className={`absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500 z-10 overflow-hidden bg-[#0d0c0c]`}>
              {(W.images[0] || l.thumbnailUrl) && <Component787 className={`absolute inset-0 bg-cover bg-center opacity-30 blur-xl scale-110`} style={{
            backgroundImage: `url(${l.thumbnailUrl || W.images[0].url})`
          }} />}
              <Component788 className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer`} style={{
            transform: `skewX(-20deg)`
          }} />
              <Component791 className={`relative z-10 flex flex-col items-center gap-2`}>
                <_cmp_Oi size={32} />
                <Component789 className={`text-xs font-mono tracking-wider text-white/80`}>
                  {!l.progress || l.progress === 0 ? `生成中...` : `生成中... ${l.progress}%`}
                </Component789>
                <Component790 onClick={t => {
              t.stopPropagation();
              l.onStop?.(e);
            }} className={`mt-2 bg-[#222]/80 hover:bg-[#333] border border-[#444] text-gray-400 hover:text-gray-200 px-3 py-1 rounded-full text-[10px] flex items-center gap-1.5 transition-colors backdrop-blur-sm`}>
                  <T size={10} fill={`currentColor`} />
                  {`停止`}
                </Component790>
              </Component791>
            </Component792>}
          {!l.videoUrl && !l.loading && !l.errorMessage && <Component793 className={`flex flex-col items-center justify-center absolute inset-0 bg-[#151515] pointer-events-none`}>
              <B size={80} className={`text-gray-700`} strokeWidth={1.2} />
            </Component793>}
          {l.errorMessage && !l.loading && <Component795 className={`absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-500 z-10 bg-[#1a1a1a] p-4 text-center`}>
              <_Component16 size={32} />
              <Component794 className={`text-xs font-medium max-w-full break-words`}>
                {l.errorMessage}
              </Component794>
            </Component795>}
        </Component796>
      </Component797>
      <_cmp__Component10 type={`target`} position={X.Left} variant={`large`} />
      <_cmp__Component10 type={`source`} position={X.Right} variant={`large`} />
      {(() => {
      const Component798 = `div`;
      const Component806 = `div`;
      const Component807 = `img`;
      const Component808 = `div`;
      const Component809 = `div`;
      const Component810 = `div`;
      const Component811 = `video`;
      const Component812 = `span`;
      const Component813 = `div`;
      const Component814 = `div`;
      const Component815 = `div`;
      const Component816 = `div`;
      const Component817 = `div`;
      const Component818 = `div`;
      const Component819 = `div`;
      const Component828 = `span`;
      const Component829 = `div`;
      const Component830 = `div`;
      const Component831 = `span`;
      const Component832 = `div`;
      const Component833 = `button`;
      const Component834 = `div`;
      const Component845 = `div`;
      const Component846 = `div`;
      const Component847 = `div`;
      const Component848 = `div`;
      const Component849 = `div`;
      const Component850 = `span`;
      const Component851 = `button`;
      const Component852 = `div`;
      const Component853 = `input`;
      const Component854 = `div`;
      const Component855 = `button`;
      const Component856 = `div`;
      const Component857 = `div`;
      const Component858 = `div`;
      const Component859 = `button`;
      const Component860 = `div`;
      const Component861 = `div`;
      const Component862 = `div`;
      const Component863 = `div`;
      const Component864 = `div`;
      const Component865 = `span`;
      const Component866 = `button`;
      const Component867 = `div`;
      const Component869 = `div`;
      const Component870 = `div`;
      const Component871 = `div`;
      const Component872 = `span`;
      const Component873 = `button`;
      const Component874 = `div`;
      const Component875 = `button`;
      const Component876 = `div`;
      const Component877 = `div`;
      const Component878 = `div`;
      const Component879 = `button`;
      const Component880 = `div`;
      const Component881 = `div`;
      const Component882 = `div`;
      const Component883 = `div`;
      let n = <Component883 className={`space-y-3`}>
            <Component849 className={`flex flex-col gap-2 mb-2`}>
              {I.length > 0 && <Component806 className={`flex flex-wrap gap-2 mb-1 p-2 bg-[#1a1a1a] border border-[#333] rounded-lg`}>
                  <Component798 className={`w-full text-[10px] text-gray-500 mb-1`}>{`已上传素�?(输入 @ 引用)`}</Component798>
                  {I.map((t, n) => {
              let i = t.type.startsWith(`image`) ? `图片` : t.type.startsWith(`video`) ? `视频` : t.type.startsWith(`audio`) ? `音频` : `素材`;
              const Component799 = `img`;
              const Component800 = `div`;
              const Component801 = `div`;
              const Component802 = `div`;
              const Component803 = `div`;
              const Component804 = `div`;
              const Component805 = `div`;
              return <Component805 className={`w-10 h-10 rounded-md overflow-hidden border border-[#444] relative group bg-black`} title={t.name || `素材`} key={`internal-${n}`}>
                        <Component802 className={`w-full h-full relative cursor-pointer`} onDoubleClick={e => {
                  e.stopPropagation();
                  if (t.type.startsWith(`video`) || t.type.startsWith(`audio`)) {
                    let e = document.createElement(t.type.startsWith(`video`) ? `video` : `audio`);
                    e.src = t.url;
                    e.controls = true;
                    e.style.position = `fixed`;
                    e.style.top = `50%`;
                    e.style.left = `50%`;
                    e.style.transform = `translate(-50%, -50%)`;
                    e.style.maxWidth = `90vw`;
                    e.style.maxHeight = `90vh`;
                    e.style.zIndex = `999999`;
                    e.style.boxShadow = `0 0 0 100vmax rgba(0,0,0,0.8)`;
                    document.body.appendChild(e);
                    e.play();
                    let n = t => {
                      if (t.target !== e) {
                        e.pause();
                        document.body.removeChild(e);
                        document.removeEventListener(`click`, n);
                      }
                    };
                    setTimeout(() => {
                      return document.addEventListener(`click`, n);
                    }, 100);
                  }
                }}>
                          {t.type.startsWith(`image`) ? <Component799 src={t.url} alt={`Ref`} loading={`lazy`} decoding={`async`} className={`w-full h-full object-cover`} /> : t.type.startsWith(`video`) ? <Component800 className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                              <Pt size={16} className={`text-purple-400`} />
                            </Component800> : <Component801 className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                              <_Component36 size={16} className={`text-yellow-500`} />
                            </Component801>}
                        </Component802>
                        <_Component37 resId={t.id} resUrl={t.url} resType={t.type} />
                        <Component803 className={`absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-white text-center py-0.5 truncate pointer-events-none`}>
                          {i}
                          {t.type.startsWith(`image`) ? I.filter(e => {
                    return e.type.startsWith(`image`);
                  }).findIndex(e => {
                    return e.id === t.id;
                  }) + 1 : t.type.startsWith(`video`) ? I.filter(e => {
                    return e.type.startsWith(`video`);
                  }).findIndex(e => {
                    return e.id === t.id;
                  }) + 1 : t.type.startsWith(`audio`) ? I.filter(e => {
                    return e.type.startsWith(`audio`);
                  }).findIndex(e => {
                    return e.id === t.id;
                  }) + 1 : n + 1}
                        </Component803>
                        <Component804 className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`} onClick={t => {
                  t.stopPropagation();
                  let i = I.filter((e, t) => {
                    return t !== n;
                  });
                  L(i);
                  r(e, {
                    internalResources: i
                  });
                }}>
                          <Gt size={10} className={`text-white`} />
                        </Component804>
                      </Component805>;
            })}
                </Component806>}
              {(W.images.length > 0 || W.videos.length > 0 || W.audios.length > 0 || W.texts.length > 0 || P.length > 0) && <Component830 className={`flex flex-wrap gap-2 mb-1`}>
                  {W.images.map((t, n) => {
              return <Component810 className={`w-10 h-10 rounded-md overflow-hidden border border-[#444] relative group bg-black`} title={`连线图片`} key={`img-${n}`}>
                        <Component807 src={ti(t.url, {
                  width: 200
                })} alt={`Ref`} loading={`lazy`} decoding={`async`} className={`w-full h-full object-cover`} onError={e => {
                  let n = e.currentTarget;
                  if (t.url && n.src !== t.url) {
                    n.src = t.url;
                  }
                }} />
                        <_Component37 resId={t.id} resUrl={t.url} resType={`image`} />
                        <Component808 className={`absolute bottom-0 left-0 right-0 bg-blue-500/80 text-[8px] text-white text-center py-0.5 truncate pointer-events-none`}>
                          {`图片`}
                          {n + 1}
                        </Component808>
                        <Component809 className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`} onClick={n => {
                  n.stopPropagation();
                  i(n => {
                    return n.filter(n => {
                      return n.target !== e || n.source !== t.id;
                    });
                  });
                }}>
                          <Gt size={10} className={`text-white`} />
                        </Component809>
                      </Component810>;
            })}
                  {W.videos?.map((t, n) => {
              return <Component815 className={`w-10 h-10 rounded-md overflow-hidden border border-[#444] relative group bg-black`} title={`连线视频`} key={`vid-${n}`}>
                        <Component811 src={t.url} className={`w-full h-full object-cover cursor-pointer`} muted={true} playsInline={true} preload={`metadata`} onDoubleClick={e => {
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
                }} />
                        <Component813 className={`absolute inset-0 bg-red-900/70 backdrop-blur-[1px] flex flex-col items-center justify-center cursor-pointer hover:bg-red-900/85 transition-colors group/retry z-10`} title={`上传失败,点击重试`} onClick={e => {
                  e.stopPropagation();
                  U({
                    id: t.id,
                    url: t.url,
                    type: `video`
                  });
                }}>
                          <_Component22 size={14} className={`text-white drop-shadow-md group-hover/retry:rotate-180 transition-transform duration-300`} />
                          <Component812 className={`text-[8px] text-white mt-0.5 font-medium leading-none`}>{`重试`}</Component812>
                        </Component813>
                        <Component814 className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`} onClick={n => {
                  n.stopPropagation();
                  i(n => {
                    return n.filter(n => {
                      return n.target !== e || n.source !== t.id;
                    });
                  });
                }}>
                          <Gt size={10} className={`text-white`} />
                        </Component814>
                      </Component815>;
            })}
                  {W.audios?.map((t, n) => {
              return <Component819 className={`w-10 h-10 rounded-md overflow-hidden border border-[#444] relative group bg-black`} title={`连线音频`} key={`aud-${n}`}>
                        <Component816 className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                          <_Component36 size={16} className={`text-yellow-500`} />
                        </Component816>
                        <_Component37 resId={t.id} resUrl={t.url} resType={`audio`} />
                        <Component817 className={`absolute bottom-0 left-0 right-0 bg-blue-500/80 text-[8px] text-white text-center py-0.5 truncate pointer-events-none`}>
                          {`音频`}
                          {n + 1}
                        </Component817>
                        <Component818 className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`} onClick={n => {
                  n.stopPropagation();
                  i(n => {
                    return n.filter(n => {
                      return n.target !== e || n.source !== t.id;
                    });
                  });
                }}>
                          <Gt size={10} className={`text-white`} />
                        </Component818>
                      </Component819>;
            })}
                  {P.filter(e => {
              let t = W.images.some(t => {
                return t.id === e.id;
              });
              let n = W.videos?.some(t => {
                return t.id === e.id;
              });
              let r = W.audios?.some(t => {
                return t.id === e.id;
              });
              let i = [...W.images, ...(W.videos || []), ...(W.audios || [])].some(t => {
                return t.id === e.id;
              });
              return !t && !n && !r && i;
            }).map((t, n) => {
              let i = ``;
              if (t.type.startsWith(`image`)) {
                i = `图片${W.images.findIndex(e => {
                  return e.id === t.id;
                }) + 1}`;
              } else {
                if (t.type.startsWith(`video`)) {
                  i = `视频${W.videos.findIndex(e => {
                    return e.id === t.id;
                  }) + 1}`;
                } else {
                  if (t.type.startsWith(`audio`)) {
                    i = `音频${W.audios.findIndex(e => {
                      return e.id === t.id;
                    }) + 1}`;
                  } else {
                    i = `素材${n + 1}`;
                  }
                }
              }
              const Component820 = `img`;
              const Component821 = `div`;
              const Component822 = `div`;
              const Component823 = `div`;
              const Component824 = `div`;
              const Component825 = `div`;
              const Component826 = `div`;
              const Component827 = `div`;
              return <Component827 className={`w-10 h-10 rounded-md overflow-hidden border border-pink-500/50 relative group bg-black`} title={`通过 @ 选中的素材`} key={`ctx-${n}`}>
                        <Component823 className={`w-full h-full relative cursor-pointer`} onDoubleClick={e => {
                  e.stopPropagation();
                  if (t.type.startsWith(`video`) || t.type.startsWith(`audio`)) {
                    let e = document.createElement(t.type.startsWith(`video`) ? `video` : `audio`);
                    e.src = t.url;
                    e.controls = true;
                    e.style.position = `fixed`;
                    e.style.top = `50%`;
                    e.style.left = `50%`;
                    e.style.transform = `translate(-50%, -50%)`;
                    e.style.maxWidth = `90vw`;
                    e.style.maxHeight = `90vh`;
                    e.style.zIndex = `999999`;
                    e.style.boxShadow = `0 0 0 100vmax rgba(0,0,0,0.8)`;
                    document.body.appendChild(e);
                    e.play();
                    let n = t => {
                      if (t.target !== e) {
                        e.pause();
                        document.body.removeChild(e);
                        document.removeEventListener(`click`, n);
                      }
                    };
                    setTimeout(() => {
                      return document.addEventListener(`click`, n);
                    }, 100);
                  }
                }}>
                          {t.type.startsWith(`image`) ? <Component820 src={t.url} loading={`lazy`} decoding={`async`} className={`w-full h-full object-cover opacity-80`} /> : t.type.startsWith(`video`) ? <Component821 className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                              <Pt size={16} className={`text-purple-400 opacity-80`} />
                            </Component821> : <Component822 className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                              <_Component36 size={16} className={`text-yellow-500 opacity-80`} />
                            </Component822>}
                        </Component823>
                        <_Component37 resId={t.id} resUrl={t.url} resType={t.type} />
                        <Component824 className={`absolute inset-0 bg-pink-500/10 pointer-events-none`} />
                        <Component825 className={`absolute bottom-0 left-0 right-0 bg-pink-500/80 text-[8px] text-white text-center py-0.5 truncate pointer-events-none`}>
                          {i}
                        </Component825>
                        <Component826 className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`} onClick={t => {
                  t.stopPropagation();
                  let i = P.filter((e, t) => {
                    return t !== n;
                  });
                  F(i);
                  r(e, {
                    selectedContextResources: i
                  });
                }}>
                          <Gt size={10} className={`text-white`} />
                        </Component826>
                      </Component827>;
            })}
                  {W.texts.map((e, t) => {
              return <Component829 className={`h-8 px-2 bg-[#2a2a2a] border border-[#444] rounded flex items-center gap-1 text-[10px] text-gray-300 hover:bg-[#333] hover:border-blue-500 hover:text-blue-400 transition-colors cursor-help group/text`} title={e.text} key={`txt-${t}`}>
                        <_Component17 size={10} />
                        <Component828 className={`max-w-[80px] truncate`}>{e.label}</Component828>
                      </Component829>;
            })}
                </Component830>}
              <Component848 className={`flex items-start gap-2`}>
                <Component847 className={`flex-1 nodrag relative`}>
                  <_cmp_Pi ref={w} className={`w-full bg-transparent text-[15px] text-gray-200 outline-none leading-relaxed placeholder-gray-600 font-sans custom-scrollbar nowheel nopan nodrag`} style={{
                width: t.inputWidth ? `${t.inputWidth}px` : undefined,
                height: t.inputHeight ? `${t.inputHeight}px` : `80px`,
                minHeight: `80px`,
                overflow: `auto`
              }} placeholder={`描述你想要的视频内容 (输入 @ 调出素材)...`} value={u} onChange={n => {
                d(n);
                r(e, {
                  prompt: n
                });
                if (n.endsWith(`@`)) {
                  N(true);
                } else if (!n.includes(`@`)) {
                  N(false);
                }
                if (!t.inputHeight || t.inputHeight <= 200) {
                  let t = w.current;
                  requestAnimationFrame(() => {
                    if (t) {
                      t.style.height = `auto`;
                      let n = Math.max(80, Math.min(t.scrollHeight, 200));
                      t.style.height = `${n}px`;
                      r(e, {
                        inputHeight: n
                      });
                    }
                  });
                }
              }} onKeyDown={e => {
                if (e.key === `Enter` && (e.ctrlKey || e.metaKey)) {
                  G();
                }
              }} autoFocus={H} onWheel={e => {
                return e.stopPropagation();
              }} />
                  {M && <Component846 className={`absolute bottom-full left-0 mb-1 w-72 bg-[#222] border border-[#444] rounded-lg shadow-2xl z-[100] flex flex-col overflow-hidden h-[300px] nopan`} onWheel={e => {
                return e.stopPropagation();
              }} onClick={e => {
                return e.stopPropagation();
              }}>
                      <Component834 className={`flex items-center justify-between p-2 border-b border-[#333] bg-[#1a1a1a]`}>
                        <Component832 className={`text-xs text-gray-300 font-bold flex items-center gap-2`}>
                          <Component831>{`选择素材引用`}</Component831>
                        </Component832>
                        <Component833 onClick={() => {
                    return N(false);
                  }} className={`text-gray-500 hover:text-white p-1`}>
                          <Gt size={12} />
                        </Component833>
                      </Component834>
                      <Component845 className={`p-2 flex-1 overflow-y-auto custom-scrollbar nowheel nopan nodrag`}>
                        {(() => {
                    let t = [...W.images.map(e => {
                      return {
                        id: e.id,
                        url: e.url,
                        type: `image`
                      };
                    }), ...W.videos.map(e => {
                      return {
                        id: e.id,
                        url: e.url,
                        type: `video`
                      };
                    }), ...W.audios.map(e => {
                      return {
                        id: e.id,
                        url: e.url,
                        type: `audio`
                      };
                    })];
                    if (t.length === 0) {
                      const Component835 = `div`;
                      return <Component835 className={`text-center text-gray-500 text-xs py-10`}>{`暂无素材，请先上传`}</Component835>;
                    } else {
                      const Component836 = `img`;
                      const Component837 = `video`;
                      const Component838 = `span`;
                      const Component839 = `div`;
                      const Component840 = `div`;
                      const Component841 = `span`;
                      const Component842 = `div`;
                      const Component843 = `div`;
                      const Component844 = `div`;
                      return <Component844 className={`grid grid-cols-4 gap-1.5`}>
                                {t.map(t => {
                          return <Component843 className={`aspect-square bg-[#111] rounded border border-[#333] hover:border-blue-500 cursor-pointer overflow-hidden relative group`} onClick={() => {
                            let n = u.lastIndexOf(`@`);
                            let i = n >= 0 ? u.substring(0, n) + u.substring(n + 1) : u;
                            let a = ``;
                            if (t.type.startsWith(`image`)) {
                              a = `图片${W.images.findIndex(e => {
                                return e.id === t.id;
                              }) + 1}`;
                            } else {
                              if (t.type.startsWith(`video`)) {
                                a = `视频${W.videos.findIndex(e => {
                                  return e.id === t.id;
                                }) + 1}`;
                              } else {
                                if (t.type.startsWith(`audio`)) {
                                  a = `音频${W.audios.findIndex(e => {
                                    return e.id === t.id;
                                  }) + 1}`;
                                } else {
                                  a = `素材1`;
                                }
                              }
                            }
                            let o = `${i}@${a} `;
                            d(o);
                            r(e, {
                              prompt: o
                            });
                            N(false);
                          }} key={t.id}>
                                      {t.type.startsWith(`image`) ? <Component836 src={ti(t.url, {
                              width: 200
                            })} loading={`lazy`} decoding={`async`} className={`w-full h-full object-cover`} onError={e => {
                              let n = e.currentTarget;
                              if (t.url && n.src !== t.url) {
                                n.src = t.url;
                              }
                            }} /> : t.type.startsWith(`video`) ? <Component837 src={t.url} preload={`metadata`} className={`w-full h-full object-cover`} /> : t.type.startsWith(`audio`) ? <Component839 className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                                          <Component838 className={`text-[10px] text-gray-400`}>{`音频`}</Component838>
                                        </Component839> : <Component840 className={`p-1 text-[8px] text-gray-400 break-all overflow-hidden h-full`}>
                                          {t.url}
                                        </Component840>}
                                      <Component842 className={`absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity`}>
                                        <Component841 className={`text-[10px] text-white`}>{`选择`}</Component841>
                                      </Component842>
                                    </Component843>;
                        })}
                              </Component844>;
                    }
                  })()}
                      </Component845>
                    </Component846>}
                </Component847>
              </Component848>
            </Component849>
            <Component882 className={`flex items-center justify-between pt-2 border-t border-[#2a2a2a] nodrag`}>
              <Component871 className={`flex items-center gap-1.5 overflow-visible z-50`}>
                <Component863 className={`relative nodrag flex items-center`} ref={j}>
                  <Component851 className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer max-w-[120px]`} onClick={e => {
                e.stopPropagation();
                A(!k);
              }} title={`选择比例和时长`}>
                    <T size={12} className={`opacity-70`} />
                    <Component850 className={`truncate`}>
                      {ds.find(e => {
                    return e.value === f;
                  })?.label || f || `16:9`}
                      {` · `}
                      {m}
                      {`s`}
                    </Component850>
                  </Component851>
                  {k && <Component862 className={`absolute bottom-full left-0 mb-1 w-48 bg-[#222] border border-[#333] rounded-lg shadow-xl p-3 z-50 flex flex-col gap-3 max-h-64 overflow-y-auto custom-scrollbar nowheel nopan nodrag`} onClick={e => {
                return e.stopPropagation();
              }}>
                      <Component857>
                        <Component852 className={`text-[10px] text-gray-500 mb-2 px-1`}>{`比例 / 分辨率`}</Component852>
                        <Component854 className={`mb-2`}>
                          <Component853 type={`text`} value={f} onChange={t => {
                      p(t.target.value);
                      r(e, {
                        size: t.target.value
                      });
                      localStorage.setItem(`mutiwindow_sd2video_size`, t.target.value);
                    }} placeholder={`自定义分辨率如 1280x720`} className={`w-full bg-[#1c1c1c] border border-[#333] rounded px-2 py-1.5 text-[11px] text-gray-200 outline-none focus:border-blue-500 transition-colors`} />
                        </Component854>
                        <Component856 className={`flex flex-wrap gap-1.5`}>
                          {ds.map(t => {
                      return <Component855 className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ${f === t.value ? `bg-[#444] text-white` : `bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} onClick={() => {
                        p(t.value);
                        r(e, {
                          size: t.value
                        });
                        localStorage.setItem(`mutiwindow_sd2video_size`, t.value);
                      }} key={t.value}>
                                {t.label}
                              </Component855>;
                    })}
                        </Component856>
                      </Component857>
                      {l.videoDurations && <Component861>
                          <Component858 className={`text-[10px] text-gray-500 mb-2 px-1`}>{`时长 (�?`}</Component858>
                          <Component860 className={`flex flex-wrap gap-1.5`}>
                            {l.videoDurations.split(`
`).map(e => {
                      return e.trim();
                    }).filter(e => {
                      return e !== ``;
                    }).map((t, n) => {
                      return <Component859 className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ${m === t ? `bg-[#444] text-white` : `bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} onClick={() => {
                        h(t);
                        r(e, {
                          selectedSeconds: t
                        });
                        localStorage.setItem(`mutiwindow_sd2video_seconds`, t);
                      }} key={n}>
                                    {t}
                                    {`s`}
                                  </Component859>;
                    })}
                          </Component860>
                        </Component861>}
                    </Component862>}
                </Component863>
                {!!l.sd2VideoModel && !!(l.sd2VideoModel.split(`
`).filter(e => {
              return e.trim() !== ``;
            }).length > 0) && <Component870 className={`relative nodrag flex items-center`} ref={O}>
                      <Component864 className={`w-[1px] h-3 bg-[#444] mr-1.5`} />
                      <Component866 className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer max-w-[100px]`} onClick={e => {
                e.stopPropagation();
                D(!E);
              }} title={`选择模型`}>
                        <Component865 className={`truncate`}>{g || `选择模型`}</Component865>
                      </Component866>
                      {E && <Component869 className={`absolute bottom-full left-0 mb-1 w-48 bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 block max-h-48 overflow-y-auto custom-scrollbar nowheel nopan nodrag`} onClick={e => {
                return e.stopPropagation();
              }}>
                          <Component867 className={`text-[10px] text-gray-500 mb-2 px-1`}>{`模型`}</Component867>
                          {l.sd2VideoModel.split(`
`).map(e => {
                  return e.trim();
                }).filter(e => {
                  return e !== ``;
                }).map((t, n) => {
                  let i = va(t, g === t);
                  const Component868 = `button`;
                  return <Component868 className={i.className} disabled={i.disabled} onClick={() => {
                    if (!i.disabled) {
                      _(t);
                      r(e, {
                        selectedModel: t
                      });
                      localStorage.setItem(`mutiwindow_sd2video_model`, t);
                      D(false);
                    }
                  }} title={i.title} key={n}>
                                  {t}
                                </Component868>;
                })}
                        </Component869>}
                    </Component870>}
                <_cmp__Component20 category={`video`} presetPrompts={l.presetPrompts || []} onApply={t => {
              let n = u ? `${u}, ${t}` : t;
              d(n);
              r(e, {
                prompt: n
              });
            }} onToast={e => {
              return l.onShowToast?.(e);
            }} />
              </Component871>
              <Component881 className={`flex items-center gap-3 flex-shrink-0 ml-2`}>
                {l.loading ? <Component877 className={`flex items-center gap-1.5`}>
                    <Component873 className={`flex items-center gap-1 text-gray-400 hover:text-white bg-[#222] hover:bg-[#333] border border-[#333] hover:border-gray-500 rounded-full px-2.5 py-1 transition-colors`} onClick={t => {
                t.stopPropagation();
                l.onRefresh?.(e);
              }} title={`刷新状态`}>
                      <_Component22 size={12} />
                      <Component872 className={`text-[10px]`}>{`刷新`}</Component872>
                    </Component873>
                    <Component876 className={`flex items-center bg-red-500/10 rounded-full p-1 pl-3 border border-red-500/30 hover:border-red-500/50 transition-colors cursor-pointer group/btn`} onClick={t => {
                t.stopPropagation();
                l.onStop?.(e);
              }}>
                      <Component874 className={`flex items-center gap-1 mr-3 text-xs text-red-400 group-hover/btn:text-red-300`}>{`停止`}</Component874>
                      <Component875 className={`bg-red-500/20 text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-500/30 transition-colors`}>
                        <T size={10} fill={`currentColor`} />
                      </Component875>
                    </Component876>
                  </Component877> : <Component880 className={`flex items-center bg-[#2a2a2a] rounded-full p-1 pl-3 border border-[#333] hover:border-gray-500 transition-colors cursor-pointer group/btn`} onClick={e => {
              e.stopPropagation();
              G();
            }}>
                    <Component878 className={`flex items-center gap-1 mr-3 text-xs text-gray-300 group-hover/btn:text-white`}>{`生成`}</Component878>
                    <Component879 className={`bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors`}>
                      <_Component21 size={14} strokeWidth={3} />
                    </Component879>
                  </Component880>}
              </Component881>
            </Component882>
          </Component883>;
      const Component884 = `div`;
      return <Q.Fragment>
            <Component884 className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[#1c1c1c] rounded-2xl border border-[#333] shadow-2xl w-[500px] transition-all duration-300 origin-top z-50
                ${H ? `opacity-100 scale-100 p-4 overflow-visible` : `opacity-0 scale-95 pointer-events-none h-0 p-0 border-0 overflow-hidden`}
              `} onClick={e => {
          return e.stopPropagation();
        }}>
              {!x && n}
              {H && !x && <_cmp_Fi targetRef={w} onRequestFullscreen={() => {
            return S(true);
          }} onResizeEnd={(t, n) => {
            return r(e, {
              inputWidth: t,
              inputHeight: n
            });
          }} />}
            </Component884>
            <_cmp_Ii open={x} title={`编辑提示词 - 特惠视频`} onClose={() => {
          return S(false);
        }}>
              {n}
            </_cmp_Ii>
          </Q.Fragment>;
    })()}
      {y && l.videoUrl && Fn.createPortal(<Component887 className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md`} onClick={() => {
      return b(false);
    }}>
            <Component885 className={`absolute top-6 right-6 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-50`} onClick={() => {
        return b(false);
      }}>
              <Gt size={32} />
            </Component885>
            <Component886 src={l.videoUrl} className={`max-w-[95vw] max-h-[95vh] object-contain shadow-2xl rounded-lg outline-none`} controls={true} autoPlay={true} onClick={e => {
        return e.stopPropagation();
      }} onDoubleClick={e => {
        e.stopPropagation();
        b(true);
      }} />
          </Component887>, document.body)}
    </Component888>;
});
export default fs;