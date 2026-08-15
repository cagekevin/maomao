// TODO(全局, 无需 import): data, selected, updateNodeData, setEdges, addNodes, addEdges, getNodes, l, uploadedAssets, uploadingAssetsRef, failedAssetsRef, uploadAsset, retryAsset, getAssetStatus, clearAllFailedAssets, nodeId, initialUploadedAssets, r, onUploadAsset, onShowToast, p, k, resId, resUrl, resType, url, type, n, color, handleType, se, images, videos, audios, texts, ce, i, o, label, text, z, u, f, selectedModel, g, selectedSeconds, m, b, filename, saveAs, display, s, x, subfolder, preferThumbnail, thumbMaxDim, thumbQuality, position, imageUrl, thumbnailUrl, source, videoUrl, videoName, audioUrl, audioName, expanded, backgroundImage, transform, ee, internalResources, selectedContextResources, width, height, minHeight, overflow, prompt, inputHeight, ie, size, inputWidth
import _cmp__Component8 from './_Component8.jsx';
import _cmp__Component9 from './_Component9.jsx';
import _cmp_Si from './Si.jsx';
import _cmp__Component12 from './_Component12.jsx';
import _cmp_Oi from './Oi.jsx';
import _cmp__Component21 from './_Component21.jsx';
import _cmp__Component23 from './_Component23.jsx';
import _cmp_Ai from './Ai.jsx';
import _cmp_Er from './Er.jsx';
import { id, We, t, Qo, e, F, h, _, O, D, j, A, E, ae, re, H, ne, Lt, Qt, P, U, L, R, te, d, V, C, c, y, hi, X, I, w, N, W, M, $o, fa, S, Fn, _Component25, Ve, B, _Component0, Ke, _Component6, Ot, _Component13, T, _Component17, Pt, Be, Gt, _Component18, _Component22 } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
var es = Z.memo(({
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
  let [I, ee] = Z.useState(l.internalResources || []);
  let {
    uploadedAssets: L,
    uploadingAssetsRef: R,
    failedAssetsRef: te,
    uploadAsset: z,
    retryAsset: ne,
    getAssetStatus: re,
    clearAllFailedAssets: V
  } = Qo({
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
  let [ie, ae] = Z.useState(l.expanded === undefined ? true : l.expanded);
  Z.useEffect(() => {
    if (l.expanded !== undefined) {
      ae(l.expanded);
    }
  }, [l.expanded]);
  let _Component38 = ({
    resId: e,
    resUrl: t,
    resType: n
  }) => {
    let r = re(e, t);
    if (!r.isUploading && !r.isUploaded && !r.isFailed) {
      return null;
    } else if (r.isFailed) {
      const Component768 = `span`;
      const Component769 = `div`;
      return <Component769 className={`absolute inset-0 bg-red-900/70 backdrop-blur-[1px] flex flex-col items-center justify-center cursor-pointer hover:bg-red-900/85 transition-colors group/retry z-10`} title={`上传失败,点击重试`} onClick={r => {
        r.stopPropagation();
        H({
          id: e,
          url: t,
          type: n
        });
      }}>
          <_Component25 size={14} className={`text-white drop-shadow-md group-hover/retry:rotate-180 transition-transform duration-300`} />
          <Component768 className={`text-[8px] text-white mt-0.5 font-medium leading-none`}>{`重试`}</Component768>
        </Component769>;
    } else {
      const Component770 = `div`;
      return <Component770 className={`absolute top-0 left-0 p-0.5 pointer-events-none`}>
          {r.isUploading ? <_Component25 size={12} className={`animate-spin drop-shadow-md`} style={{
          color: `rgb(210,2,7)`
        }} /> : r.isUploaded ? <Ve size={12} className={`text-green-500 drop-shadow-md`} /> : null}
        </Component770>;
    }
  };
  let H = async e => {
    await ne(e).catch(() => {});
  };
  let se = Lt({
    handleType: `target`
  });
  let ce = Qt(Z.useMemo(() => {
    return se.map(e => {
      return e.source;
    });
  }, [se]));
  let U = Z.useMemo(() => {
    if (!ce) {
      return {
        images: [],
        videos: [],
        audios: [],
        texts: []
      };
    }
    let e = Array.isArray(ce) ? ce : [ce];
    let t = [];
    let n = [];
    let r = [];
    let i = [];
    e.forEach(e => {
      let a = se.find(t => {
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
        n.push({
          id: e.id,
          url: e.data.videoUrl,
          type: `video`
        });
      }
      if (e?.data?.audioUrl) {
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
  }, [ce, se]);
  Z.useEffect(() => {
    if (l.onUploadAsset) {
      [...P, ...U.images, ...U.videos, ...U.audios].forEach(e => {
        if (!e.url || e.url.startsWith(`asset://`)) {
          return;
        }
        let t = e.url;
        let n = e.id;
        if (!L[t] && !R.current[n] && !te.current[n]) {
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
  }, [P, U, L, z, e]);
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
  let W = () => {
    if (Object.keys(R.current).length > 0) {
      l.onShowToast?.(`素材正在上传处理中，请等待所有对勾出现后再生成`);
      return;
    }
    if (Object.keys(te.current).length > 0) {
      l.onShowToast?.(`有素材上传失败，已为您重新尝试上传，请稍后`);
      V();
      return;
    }
    if (!u.trim() && U.images.length === 0 && U.texts.length === 0 && P.length === 0) {
      l.onShowToast?.(`请输入提示词或连接参考节点`);
      return;
    }
    l.onGenerateSD2Video?.(e, u, f, g, m);
  };
  const Component771 = `button`;
  const Component772 = `button`;
  const Component773 = `button`;
  const Component774 = `button`;
  const Component775 = `div`;
  const Component776 = `div`;
  const Component777 = `input`;
  const Component778 = `video`;
  const Component779 = `button`;
  const Component780 = `div`;
  const Component781 = `div`;
  const Component782 = `div`;
  const Component783 = `span`;
  const Component784 = `button`;
  const Component785 = `div`;
  const Component786 = `div`;
  const Component787 = `div`;
  const Component788 = `div`;
  const Component789 = `div`;
  const Component790 = `div`;
  const Component791 = `div`;
  const Component879 = `button`;
  const Component880 = `video`;
  const Component881 = `div`;
  const Component882 = `div`;
  return <Component882 className={`relative flex flex-col items-center group/node transition-all w-full h-full min-w-[200px] min-h-[200px] ${n ? `z-50` : `z-10`}`}>
      <_cmp__Component8 id={e} data={t} defaultTitle={`SD2视频`} icon={<B size={11} className={`text-gray-500`} />} />
      {!l.loading && <Component776 className={`absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`}>
          <Component775 className={`flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`}>
            {U.images.length === 0 && <Component771 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`上传参考图`} onClick={e => {
          e.stopPropagation();
          C.current?.click();
        }}>
                <_Component0 size={14} />
              </Component771>}
            {l.videoUrl && <Q.Fragment>
                <Component772 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`全屏播放`} onClick={e => {
            e.stopPropagation();
            b(true);
          }}>
                  <Ke size={14} />
                </Component772>
                <Component773 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`下载`} onClick={async e => {
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
                </Component773>
                {l.onDelete && <Component774 className={`p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-md`} title={`删除`} onClick={e => {
            e.stopPropagation();
            l.onDelete?.();
          }}>
                    <Ot size={14} />
                  </Component774>}
              </Q.Fragment>}
          </Component775>
        </Component776>}
      <_cmp__Component9 visible={!!n} minWidth={200} minHeight={200} />
      <Component777 type={`file`} ref={C} style={{
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
            console.warn(`[SD2VideoNode] urlifyAsset failed, fallback to resizeImage:`, e);
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
      <Component791 className={`relative bg-[#1c1c1c] rounded-xl border shadow-xl transition-all duration-300 cursor-pointer group/display w-full flex-1 flex flex-col overflow-visible
            ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}
        `} onClick={() => {
      ae(!ie);
      r(e, {
        expanded: !ie
      });
    }}>
        <Component790 className={`flex items-center justify-center relative w-full flex-1 rounded-b-xl overflow-hidden ${l.videoUrl ? `` : `bg-[#0d0c0c]`}`}>
          {l.videoUrl && <Q.Fragment>
              <Component778 src={l.videoUrl} poster={l.thumbnailUrl} className={`max-w-full max-h-[400px] w-full h-full object-contain block ${l.loading ? `opacity-50 blur-sm` : ``}`} controls={false} autoPlay={false} muted={false} onDoubleClick={e => {
            e.stopPropagation();
            b(true);
          }} />
              {!l.loading && <Component780 className={`absolute inset-0 flex items-center justify-center pointer-events-none`}>
                  <Component779 className={`w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-black/70 transition-all nodrag pointer-events-auto`} title={`播放视频`} onClick={e => {
              e.stopPropagation();
              b(true);
            }}>
                    <_Component13 className={`text-white w-6 h-6`} />
                  </Component779>
                </Component780>}
            </Q.Fragment>}
          {l.loading && <Component786 className={`absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500 z-10 overflow-hidden bg-[#0d0c0c]`}>
              {(U.images[0] || l.thumbnailUrl) && <Component781 className={`absolute inset-0 bg-cover bg-center opacity-30 blur-xl scale-110`} style={{
            backgroundImage: `url(${l.thumbnailUrl || U.images[0].url})`
          }} />}
              <Component782 className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer`} style={{
            transform: `skewX(-20deg)`
          }} />
              <Component785 className={`relative z-10 flex flex-col items-center gap-2`}>
                <_cmp_Si size={32} />
                <Component783 className={`text-xs font-mono tracking-wider text-white/80`}>
                  {!l.progress || l.progress === 0 ? `生成中...` : `生成中... ${l.progress}%`}
                </Component783>
                <Component784 onClick={t => {
              t.stopPropagation();
              l.onStop?.(e);
            }} className={`mt-2 bg-[#222]/80 hover:bg-[#333] border border-[#444] text-gray-400 hover:text-gray-200 px-3 py-1 rounded-full text-[10px] flex items-center gap-1.5 transition-colors backdrop-blur-sm`}>
                  <T size={10} fill={`currentColor`} />
                  {`停止`}
                </Component784>
              </Component785>
            </Component786>}
          {!l.videoUrl && !l.loading && !l.errorMessage && <Component787 className={`flex flex-col items-center justify-center absolute inset-0 bg-[#151515] pointer-events-none`}>
              <B size={80} className={`text-gray-700`} strokeWidth={1.2} />
            </Component787>}
          {l.errorMessage && !l.loading && <Component789 className={`absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-500 z-10 bg-[#1a1a1a] p-4 text-center`}>
              <_Component17 size={32} />
              <Component788 className={`text-xs font-medium max-w-full break-words`}>
                {l.errorMessage}
              </Component788>
            </Component789>}
        </Component790>
      </Component791>
      <_cmp__Component12 type={`target`} position={X.Left} variant={`large`} />
      <_cmp__Component12 type={`source`} position={X.Right} variant={`large`} />
      {(() => {
      const Component792 = `div`;
      const Component800 = `div`;
      const Component801 = `img`;
      const Component802 = `div`;
      const Component803 = `div`;
      const Component804 = `div`;
      const Component805 = `video`;
      const Component806 = `span`;
      const Component807 = `div`;
      const Component808 = `div`;
      const Component809 = `div`;
      const Component810 = `div`;
      const Component811 = `div`;
      const Component812 = `div`;
      const Component813 = `div`;
      const Component822 = `span`;
      const Component823 = `div`;
      const Component824 = `div`;
      const Component825 = `span`;
      const Component826 = `div`;
      const Component827 = `button`;
      const Component828 = `div`;
      const Component839 = `div`;
      const Component840 = `div`;
      const Component841 = `div`;
      const Component842 = `div`;
      const Component843 = `div`;
      const Component844 = `span`;
      const Component845 = `button`;
      const Component846 = `div`;
      const Component847 = `input`;
      const Component848 = `div`;
      const Component849 = `button`;
      const Component850 = `div`;
      const Component851 = `div`;
      const Component852 = `div`;
      const Component853 = `button`;
      const Component854 = `div`;
      const Component855 = `div`;
      const Component856 = `div`;
      const Component857 = `div`;
      const Component858 = `div`;
      const Component859 = `span`;
      const Component860 = `button`;
      const Component861 = `div`;
      const Component863 = `div`;
      const Component864 = `div`;
      const Component865 = `div`;
      const Component866 = `span`;
      const Component867 = `button`;
      const Component868 = `div`;
      const Component869 = `button`;
      const Component870 = `div`;
      const Component871 = `div`;
      const Component872 = `div`;
      const Component873 = `button`;
      const Component874 = `div`;
      const Component875 = `div`;
      const Component876 = `div`;
      const Component877 = `div`;
      let n = <Component877 className={`space-y-3`}>
            <Component843 className={`flex flex-col gap-2 mb-2`}>
              {I.length > 0 && <Component800 className={`flex flex-wrap gap-2 mb-1 p-2 bg-[#1a1a1a] border border-[#333] rounded-lg`}>
                  <Component792 className={`w-full text-[10px] text-gray-500 mb-1`}>{`已上传素�?(输入 @ 引用)`}</Component792>
                  {I.map((t, n) => {
              let i = t.type.startsWith(`image`) ? `图片` : t.type.startsWith(`video`) ? `视频` : t.type.startsWith(`audio`) ? `音频` : `素材`;
              const Component793 = `img`;
              const Component794 = `div`;
              const Component795 = `div`;
              const Component796 = `div`;
              const Component797 = `div`;
              const Component798 = `div`;
              const Component799 = `div`;
              return <Component799 className={`w-10 h-10 rounded-md overflow-hidden border border-[#444] relative group bg-black`} title={t.name || `素材`} key={`internal-${n}`}>
                        <Component796 className={`w-full h-full relative cursor-pointer`} onDoubleClick={e => {
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
                          {t.type.startsWith(`image`) ? <Component793 src={t.url} alt={`Ref`} loading={`lazy`} decoding={`async`} className={`w-full h-full object-cover`} /> : t.type.startsWith(`video`) ? <Component794 className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                              <Pt size={16} className={`text-purple-400`} />
                            </Component794> : <Component795 className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                              <Be size={16} className={`text-yellow-500`} />
                            </Component795>}
                        </Component796>
                        <_Component38 resId={t.id} resUrl={t.url} resType={t.type} />
                        <Component797 className={`absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-white text-center py-0.5 truncate pointer-events-none`}>
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
                        </Component797>
                        <Component798 className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`} onClick={t => {
                  t.stopPropagation();
                  let i = I.filter((e, t) => {
                    return t !== n;
                  });
                  ee(i);
                  r(e, {
                    internalResources: i
                  });
                }}>
                          <Gt size={10} className={`text-white`} />
                        </Component798>
                      </Component799>;
            })}
                </Component800>}
              {(U.images.length > 0 || U.videos.length > 0 || U.audios.length > 0 || U.texts.length > 0 || P.length > 0) && <Component824 className={`flex flex-wrap gap-2 mb-1`}>
                  {U.images.map((t, n) => {
              return <Component804 className={`w-10 h-10 rounded-md overflow-hidden border border-[#444] relative group bg-black`} title={`连线图片`} key={`img-${n}`}>
                        <Component801 src={t.url} alt={`Ref`} loading={`lazy`} decoding={`async`} className={`w-full h-full object-cover`} />
                        <_Component38 resId={t.id} resUrl={t.url} resType={`image`} />
                        <Component802 className={`absolute bottom-0 left-0 right-0 bg-blue-500/80 text-[8px] text-white text-center py-0.5 truncate pointer-events-none`}>
                          {`图片`}
                          {n + 1}
                        </Component802>
                        <Component803 className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`} onClick={n => {
                  n.stopPropagation();
                  i(n => {
                    return n.filter(n => {
                      return n.target !== e || n.source !== t.id;
                    });
                  });
                }}>
                          <Gt size={10} className={`text-white`} />
                        </Component803>
                      </Component804>;
            })}
                  {U.videos?.map((t, n) => {
              return <Component809 className={`w-10 h-10 rounded-md overflow-hidden border border-[#444] relative group bg-black`} title={`连线视频`} key={`vid-${n}`}>
                        <Component805 src={t.url} className={`w-full h-full object-cover cursor-pointer`} muted={true} playsInline={true} preload={`metadata`} onDoubleClick={e => {
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
                        <Component807 className={`absolute inset-0 bg-red-900/70 backdrop-blur-[1px] flex flex-col items-center justify-center cursor-pointer hover:bg-red-900/85 transition-colors group/retry z-10`} title={`上传失败,点击重试`} onClick={e => {
                  e.stopPropagation();
                  H({
                    id: t.id,
                    url: t.url,
                    type: `video`
                  });
                }}>
                          <_Component25 size={14} className={`text-white drop-shadow-md group-hover/retry:rotate-180 transition-transform duration-300`} />
                          <Component806 className={`text-[8px] text-white mt-0.5 font-medium leading-none`}>{`重试`}</Component806>
                        </Component807>
                        <Component808 className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`} onClick={n => {
                  n.stopPropagation();
                  i(n => {
                    return n.filter(n => {
                      return n.target !== e || n.source !== t.id;
                    });
                  });
                }}>
                          <Gt size={10} className={`text-white`} />
                        </Component808>
                      </Component809>;
            })}
                  {U.audios?.map((t, n) => {
              return <Component813 className={`w-10 h-10 rounded-md overflow-hidden border border-[#444] relative group bg-black`} title={`连线音频`} key={`aud-${n}`}>
                        <Component810 className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                          <Be size={16} className={`text-yellow-500`} />
                        </Component810>
                        <_Component38 resId={t.id} resUrl={t.url} resType={`audio`} />
                        <Component811 className={`absolute bottom-0 left-0 right-0 bg-blue-500/80 text-[8px] text-white text-center py-0.5 truncate pointer-events-none`}>
                          {`音频`}
                          {n + 1}
                        </Component811>
                        <Component812 className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`} onClick={n => {
                  n.stopPropagation();
                  i(n => {
                    return n.filter(n => {
                      return n.target !== e || n.source !== t.id;
                    });
                  });
                }}>
                          <Gt size={10} className={`text-white`} />
                        </Component812>
                      </Component813>;
            })}
                  {P.filter(e => {
              let t = U.images.some(t => {
                return t.id === e.id;
              });
              let n = U.videos?.some(t => {
                return t.id === e.id;
              });
              let r = U.audios?.some(t => {
                return t.id === e.id;
              });
              let i = [...U.images, ...(U.videos || []), ...(U.audios || [])].some(t => {
                return t.id === e.id;
              });
              return !t && !n && !r && i;
            }).map((t, n) => {
              let i = ``;
              if (t.type.startsWith(`image`)) {
                i = `图片${U.images.findIndex(e => {
                  return e.id === t.id;
                }) + 1}`;
              } else {
                if (t.type.startsWith(`video`)) {
                  i = `视频${U.videos.findIndex(e => {
                    return e.id === t.id;
                  }) + 1}`;
                } else {
                  if (t.type.startsWith(`audio`)) {
                    i = `音频${U.audios.findIndex(e => {
                      return e.id === t.id;
                    }) + 1}`;
                  } else {
                    i = `素材${n + 1}`;
                  }
                }
              }
              const Component814 = `img`;
              const Component815 = `div`;
              const Component816 = `div`;
              const Component817 = `div`;
              const Component818 = `div`;
              const Component819 = `div`;
              const Component820 = `div`;
              const Component821 = `div`;
              return <Component821 className={`w-10 h-10 rounded-md overflow-hidden border border-pink-500/50 relative group bg-black`} title={`通过 @ 选中的素材`} key={`ctx-${n}`}>
                        <Component817 className={`w-full h-full relative cursor-pointer`} onDoubleClick={e => {
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
                          {t.type.startsWith(`image`) ? <Component814 src={t.url} loading={`lazy`} decoding={`async`} className={`w-full h-full object-cover opacity-80`} /> : t.type.startsWith(`video`) ? <Component815 className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                              <Pt size={16} className={`text-purple-400 opacity-80`} />
                            </Component815> : <Component816 className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                              <Be size={16} className={`text-yellow-500 opacity-80`} />
                            </Component816>}
                        </Component817>
                        <_Component38 resId={t.id} resUrl={t.url} resType={t.type} />
                        <Component818 className={`absolute inset-0 bg-pink-500/10 pointer-events-none`} />
                        <Component819 className={`absolute bottom-0 left-0 right-0 bg-pink-500/80 text-[8px] text-white text-center py-0.5 truncate pointer-events-none`}>
                          {i}
                        </Component819>
                        <Component820 className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`} onClick={t => {
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
                        </Component820>
                      </Component821>;
            })}
                  {U.texts.map((e, t) => {
              return <Component823 className={`h-8 px-2 bg-[#2a2a2a] border border-[#444] rounded flex items-center gap-1 text-[10px] text-gray-300 hover:bg-[#333] hover:border-blue-500 hover:text-blue-400 transition-colors cursor-help group/text`} title={e.text} key={`txt-${t}`}>
                        <_Component18 size={10} />
                        <Component822 className={`max-w-[80px] truncate`}>{e.label}</Component822>
                      </Component823>;
            })}
                </Component824>}
              <Component842 className={`flex items-start gap-2`}>
                <Component841 className={`flex-1 nodrag relative`}>
                  <_cmp_Oi ref={w} className={`w-full bg-transparent text-[15px] text-gray-200 outline-none leading-relaxed placeholder-gray-600 font-sans custom-scrollbar nowheel nopan nodrag`} style={{
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
                  W();
                }
              }} autoFocus={ie} onWheel={e => {
                return e.stopPropagation();
              }} />
                  {M && <Component840 className={`absolute bottom-full left-0 mb-1 w-72 bg-[#222] border border-[#444] rounded-lg shadow-2xl z-[100] flex flex-col overflow-hidden h-[300px] nopan`} onWheel={e => {
                return e.stopPropagation();
              }} onClick={e => {
                return e.stopPropagation();
              }}>
                      <Component828 className={`flex items-center justify-between p-2 border-b border-[#333] bg-[#1a1a1a]`}>
                        <Component826 className={`text-xs text-gray-300 font-bold flex items-center gap-2`}>
                          <Component825>{`选择素材引用`}</Component825>
                        </Component826>
                        <Component827 onClick={() => {
                    return N(false);
                  }} className={`text-gray-500 hover:text-white p-1`}>
                          <Gt size={12} />
                        </Component827>
                      </Component828>
                      <Component839 className={`p-2 flex-1 overflow-y-auto custom-scrollbar nowheel nopan nodrag`}>
                        {(() => {
                    let t = [...U.images.map(e => {
                      return {
                        id: e.id,
                        url: e.url,
                        type: `image`
                      };
                    }), ...U.videos.map(e => {
                      return {
                        id: e.id,
                        url: e.url,
                        type: `video`
                      };
                    }), ...U.audios.map(e => {
                      return {
                        id: e.id,
                        url: e.url,
                        type: `audio`
                      };
                    })];
                    if (t.length === 0) {
                      const Component829 = `div`;
                      return <Component829 className={`text-center text-gray-500 text-xs py-10`}>{`暂无素材，请先上传`}</Component829>;
                    } else {
                      const Component830 = `img`;
                      const Component831 = `video`;
                      const Component832 = `span`;
                      const Component833 = `div`;
                      const Component834 = `div`;
                      const Component835 = `span`;
                      const Component836 = `div`;
                      const Component837 = `div`;
                      const Component838 = `div`;
                      return <Component838 className={`grid grid-cols-4 gap-1.5`}>
                                {t.map(t => {
                          return <Component837 className={`aspect-square bg-[#111] rounded border border-[#333] hover:border-blue-500 cursor-pointer overflow-hidden relative group`} onClick={() => {
                            let n = u.lastIndexOf(`@`);
                            let i = n >= 0 ? u.substring(0, n) + u.substring(n + 1) : u;
                            let a = ``;
                            if (t.type.startsWith(`image`)) {
                              a = `图片${U.images.findIndex(e => {
                                return e.id === t.id;
                              }) + 1}`;
                            } else {
                              if (t.type.startsWith(`video`)) {
                                a = `视频${U.videos.findIndex(e => {
                                  return e.id === t.id;
                                }) + 1}`;
                              } else {
                                if (t.type.startsWith(`audio`)) {
                                  a = `音频${U.audios.findIndex(e => {
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
                                      {t.type.startsWith(`image`) ? <Component830 src={t.url} loading={`lazy`} decoding={`async`} className={`w-full h-full object-cover`} /> : t.type.startsWith(`video`) ? <Component831 src={t.url} preload={`metadata`} className={`w-full h-full object-cover`} /> : t.type.startsWith(`audio`) ? <Component833 className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                                          <Component832 className={`text-[10px] text-gray-400`}>{`音频`}</Component832>
                                        </Component833> : <Component834 className={`p-1 text-[8px] text-gray-400 break-all overflow-hidden h-full`}>
                                          {t.url}
                                        </Component834>}
                                      <Component836 className={`absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity`}>
                                        <Component835 className={`text-[10px] text-white`}>{`选择`}</Component835>
                                      </Component836>
                                    </Component837>;
                        })}
                              </Component838>;
                    }
                  })()}
                      </Component839>
                    </Component840>}
                </Component841>
              </Component842>
            </Component843>
            <Component876 className={`flex items-center justify-between pt-2 border-t border-[#2a2a2a] nodrag`}>
              <Component865 className={`flex items-center gap-1.5 overflow-visible z-50`}>
                <Component857 className={`relative nodrag flex items-center`} ref={j}>
                  <Component845 className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer max-w-[120px]`} onClick={e => {
                e.stopPropagation();
                A(!k);
              }} title={`选择比例和时长`}>
                    <T size={12} className={`opacity-70`} />
                    <Component844 className={`truncate`}>
                      {$o.find(e => {
                    return e.value === f;
                  })?.label || f || `16:9`}
                      {` · `}
                      {m}
                      {`s`}
                    </Component844>
                  </Component845>
                  {k && <Component856 className={`absolute bottom-full left-0 mb-1 w-48 bg-[#222] border border-[#333] rounded-lg shadow-xl p-3 z-50 flex flex-col gap-3 max-h-64 overflow-y-auto custom-scrollbar nowheel nopan nodrag`} onClick={e => {
                return e.stopPropagation();
              }}>
                      <Component851>
                        <Component846 className={`text-[10px] text-gray-500 mb-2 px-1`}>{`比例 / 分辨率`}</Component846>
                        <Component848 className={`mb-2`}>
                          <Component847 type={`text`} value={f} onChange={t => {
                      p(t.target.value);
                      r(e, {
                        size: t.target.value
                      });
                      localStorage.setItem(`mutiwindow_sd2video_size`, t.target.value);
                    }} placeholder={`自定义分辨率如 1280x720`} className={`w-full bg-[#1c1c1c] border border-[#333] rounded px-2 py-1.5 text-[11px] text-gray-200 outline-none focus:border-blue-500 transition-colors`} />
                        </Component848>
                        <Component850 className={`flex flex-wrap gap-1.5`}>
                          {$o.map(t => {
                      return <Component849 className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ${f === t.value ? `bg-[#444] text-white` : `bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} onClick={() => {
                        p(t.value);
                        r(e, {
                          size: t.value
                        });
                        localStorage.setItem(`mutiwindow_sd2video_size`, t.value);
                      }} key={t.value}>
                                {t.label}
                              </Component849>;
                    })}
                        </Component850>
                      </Component851>
                      {l.videoDurations && <Component855>
                          <Component852 className={`text-[10px] text-gray-500 mb-2 px-1`}>{`时长 (�?`}</Component852>
                          <Component854 className={`flex flex-wrap gap-1.5`}>
                            {l.videoDurations.split(`
`).map(e => {
                      return e.trim();
                    }).filter(e => {
                      return e !== ``;
                    }).map((t, n) => {
                      return <Component853 className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ${m === t ? `bg-[#444] text-white` : `bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} onClick={() => {
                        h(t);
                        r(e, {
                          selectedSeconds: t
                        });
                        localStorage.setItem(`mutiwindow_sd2video_seconds`, t);
                      }} key={n}>
                                    {t}
                                    {`s`}
                                  </Component853>;
                    })}
                          </Component854>
                        </Component855>}
                    </Component856>}
                </Component857>
                {!!l.sd2VideoModel && !!(l.sd2VideoModel.split(`
`).filter(e => {
              return e.trim() !== ``;
            }).length > 0) && <Component864 className={`relative nodrag flex items-center`} ref={O}>
                      <Component858 className={`w-[1px] h-3 bg-[#444] mr-1.5`} />
                      <Component860 className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer max-w-[100px]`} onClick={e => {
                e.stopPropagation();
                D(!E);
              }} title={`选择模型`}>
                        <Component859 className={`truncate`}>{g || `选择模型`}</Component859>
                      </Component860>
                      {E && <Component863 className={`absolute bottom-full left-0 mb-1 w-48 bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 block max-h-48 overflow-y-auto custom-scrollbar nowheel nopan nodrag`} onClick={e => {
                return e.stopPropagation();
              }}>
                          <Component861 className={`text-[10px] text-gray-500 mb-2 px-1`}>{`模型`}</Component861>
                          {l.sd2VideoModel.split(`
`).map(e => {
                  return e.trim();
                }).filter(e => {
                  return e !== ``;
                }).map((t, n) => {
                  let i = fa(t, g === t);
                  const Component862 = `button`;
                  return <Component862 className={i.className} disabled={i.disabled} onClick={() => {
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
                                </Component862>;
                })}
                        </Component863>}
                    </Component864>}
                <_cmp__Component21 category={`video`} presetPrompts={l.presetPrompts || []} onApply={t => {
              let n = u ? `${u}, ${t}` : t;
              d(n);
              r(e, {
                prompt: n
              });
            }} onToast={e => {
              return l.onShowToast?.(e);
            }} />
              </Component865>
              <Component875 className={`flex items-center gap-3 flex-shrink-0 ml-2`}>
                {l.loading ? <Component871 className={`flex items-center gap-1.5`}>
                    <Component867 className={`flex items-center gap-1 text-gray-400 hover:text-white bg-[#222] hover:bg-[#333] border border-[#333] hover:border-gray-500 rounded-full px-2.5 py-1 transition-colors`} onClick={t => {
                t.stopPropagation();
                l.onRefresh?.(e);
              }} title={`刷新状态`}>
                      <_Component25 size={12} />
                      <Component866 className={`text-[10px]`}>{`刷新`}</Component866>
                    </Component867>
                    <Component870 className={`flex items-center bg-red-500/10 rounded-full p-1 pl-3 border border-red-500/30 hover:border-red-500/50 transition-colors cursor-pointer group/btn`} onClick={t => {
                t.stopPropagation();
                l.onStop?.(e);
              }}>
                      <Component868 className={`flex items-center gap-1 mr-3 text-xs text-red-400 group-hover/btn:text-red-300`}>{`停止`}</Component868>
                      <Component869 className={`bg-red-500/20 text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-500/30 transition-colors`}>
                        <T size={10} fill={`currentColor`} />
                      </Component869>
                    </Component870>
                  </Component871> : <Component874 className={`flex items-center bg-[#2a2a2a] rounded-full p-1 pl-3 border border-[#333] hover:border-gray-500 transition-colors cursor-pointer group/btn`} onClick={e => {
              e.stopPropagation();
              W();
            }}>
                    <Component872 className={`flex items-center gap-1 mr-3 text-xs text-gray-300 group-hover/btn:text-white`}>{`生成`}</Component872>
                    <Component873 className={`bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors`}>
                      <_Component22 size={14} strokeWidth={3} />
                    </Component873>
                  </Component874>}
              </Component875>
            </Component876>
          </Component877>;
      const Component878 = `div`;
      return <Q.Fragment>
            <Component878 className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[#1c1c1c] rounded-2xl border border-[#333] shadow-2xl w-[500px] transition-all duration-300 origin-top z-50
                ${ie ? `opacity-100 scale-100 p-4 overflow-visible` : `opacity-0 scale-95 pointer-events-none h-0 p-0 border-0 overflow-hidden`}
              `} onClick={e => {
          return e.stopPropagation();
        }}>
              {!x && n}
              {ie && !x && <_cmp__Component23 targetRef={w} onRequestFullscreen={() => {
            return S(true);
          }} onResizeEnd={(t, n) => {
            return r(e, {
              inputWidth: t,
              inputHeight: n
            });
          }} />}
            </Component878>
            <_cmp_Ai open={x} title={`编辑提示词 - 特惠视频`} onClose={() => {
          return S(false);
        }}>
              {n}
            </_cmp_Ai>
          </Q.Fragment>;
    })()}
      {y && l.videoUrl && Fn.createPortal(<Component881 className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md`} onClick={() => {
      return b(false);
    }}>
            <Component879 className={`absolute top-6 right-6 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-50`} onClick={() => {
        return b(false);
      }}>
              <Gt size={32} />
            </Component879>
            <Component880 src={l.videoUrl} className={`max-w-[95vw] max-h-[95vh] object-contain shadow-2xl rounded-lg outline-none`} controls={true} autoPlay={true} onClick={e => {
        return e.stopPropagation();
      }} onDoubleClick={e => {
        e.stopPropagation();
        b(true);
      }} />
          </Component881>, document.body)}
    </Component882>;
});
export default es;