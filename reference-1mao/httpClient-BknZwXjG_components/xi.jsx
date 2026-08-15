// TODO(全局, 无需 import): data, selected, width, updateNodeData, useThumbnail, i, u, l, m, f, p, n, imageAvailable, o, display, subfolder, preferThumbnail, r, thumbMaxDim, thumbQuality, imageUrl, thumbnailUrl, label, imageUrlRef, nodeId, currentImageType, currentImageLength, type, isNull, isUndefined, isString, length, currentLength, equal, first100, currentFirst100, useOriginal, isLikelyThumbnail, urlLength, isBase64, isHttp, url, filename, saveAs, g, s, v
import _cmp__Component8 from './_Component8.jsx';
import _cmp__Component9 from './_Component9.jsx';
import _cmp_Bn from './Bn.jsx';
import _cmp__Component12 from './_Component12.jsx';
import _cmp_Er from './Er.jsx';
import { id, We, br, vi, Yr, Qr, Zr, h, y, _i, a, hi, d, Kr, X, c, _, Le, _Component5, _Component3, _Component2, _Component0, _Component1, Ze, _Component10, _Component11, Te, _Component6, _Component13 } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
var xi = Z.memo(({
  id: e,
  data: t,
  selected: n,
  width: i
}) => {
  let {
    updateNodeData: a
  } = We();
  let o = Z.useRef(null);
  let [s, c] = Z.useState(false);
  let {
    useThumbnail: l
  } = br();
  let u = t.imageUrl;
  let d = t.imageUrlRef;
  let f = t.thumbnailUrl;
  let p = t.imageAvailable;
  let m = vi(i ?? t._styleWidth ?? 420);
  let h = Z.useMemo(() => {
    if (u) {
      if (u.startsWith(`data:video/`) || /\.(mp4|webm|mov|mkv|avi|m4v)($|\?)/i.test(u)) {
        return `video`;
      } else {
        if (u.startsWith(`data:audio/`) || /\.(mp3|wav|ogg|m4a|flac|aac|opus|wma|aiff)($|\?)/i.test(u)) {
          return `audio`;
        } else {
          if (u.startsWith(`data:text/`) || /\.(txt|md|json|csv)($|\?)/i.test(u)) {
            return `text`;
          } else {
            return `image`;
          }
        }
      }
    } else {
      return `empty`;
    }
  }, [u]);
  let g = Z.useMemo(() => {
    if (l) {
      return Yr(u, m, `image`) || f || u;
    } else {
      return u || f;
    }
  }, [l, u, f, m]);
  let _ = Z.useMemo(() => {
    if (l && p) {
      let e = Qr(u, m);
      if (e) {
        return e;
      }
    }
    return f;
  }, [l, p, u, f, m]);
  let v = Z.useMemo(() => {
    return Zr(u);
  }, [u]);
  let y = Z.useRef(null);
  Z.useEffect(() => {
    if (h !== `video` || !u || p || !u.includes(`/files/`) || y.current === u) {
      return;
    }
    y.current = u;
    let t = false;
    (async () => {
      let n = await _i(u);
      if (!t && n) {
        a(e, {
          imageAvailable: true
        });
      }
    })();
    return () => {
      t = true;
    };
  }, [e, h, u, p, a]);
  const Component105 = `input`;
  const Component106 = `button`;
  const Component107 = `button`;
  const Component108 = `button`;
  const Component109 = `button`;
  const Component110 = `button`;
  const Component111 = `div`;
  const Component112 = `button`;
  const Component113 = `button`;
  const Component114 = `div`;
  const Component115 = `div`;
  const Component116 = `img`;
  const Component117 = `video`;
  const Component118 = `img`;
  const Component119 = `button`;
  const Component120 = `div`;
  const Component121 = `div`;
  const Component122 = `video`;
  const Component123 = `audio`;
  const Component124 = `div`;
  const Component125 = `span`;
  const Component126 = `div`;
  const Component127 = `div`;
  const Component128 = `div`;
  const Component129 = `div`;
  const Component130 = `div`;
  const Component131 = `div`;
  return <Component131 className={`relative group/node w-full h-full min-w-[120px] min-h-[80px]`}>
      <_cmp__Component8 id={e} data={t} defaultTitle={h === `video` ? `视频` : h === `audio` ? `音频` : h === `text` ? `文本文件` : `图片`} icon={h === `video` ? <Le size={11} /> : h === `audio` ? <_Component5 size={11} /> : h === `text` ? <_Component3 size={11} /> : <_Component2 size={11} />} />
      <_cmp__Component9 visible={!!n} minWidth={120} minHeight={80} />
      <Component105 type={`file`} ref={o} style={{
      display: `none`
    }} accept={`image/*,video/*,audio/*,text/plain`} multiple={true} onChange={async t => {
      let n = t.target.files?.[0];
      if (!n) {
        return;
      }
      t.target.value = ``;
      let r = n.type.startsWith(`image/`);
      try {
        let t = await hi(n, {
          subfolder: `canvas/upload`,
          preferThumbnail: r,
          thumbMaxDim: 480,
          thumbQuality: 75
        });
        if (t.url && /^https?:\/\//i.test(t.url)) {
          a(e, {
            imageUrl: t.url,
            thumbnailUrl: t.thumbnailUrl,
            label: n.name,
            imageUrlRef: undefined
          });
          return;
        }
      } catch (e) {
        console.warn(`[ImageNode] urlifyAsset failed, fallback to base64:`, e);
      }
      let i = new FileReader();
      i.onload = t => {
        let r = t.target?.result;
        a(e, {
          imageUrl: r,
          thumbnailUrl: undefined,
          label: n.name
        });
      };
      i.onerror = () => {
        console.error(`File read failed`);
      };
      i.readAsDataURL(n);
    }} />
      <Component115 className={`absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`}>
        <Component114 className={`flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`}>
          <Component106 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`上传/替换`} onClick={e => {
          e.stopPropagation();
          o.current?.click();
        }}>
            <_Component0 size={14} />
          </Component106>
          {(h === `image` || h === `empty`) && <Q.Fragment>
              <Component107 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`放大`} onClick={n => {
            n.stopPropagation();
            if (t.onZoom) {
              t.onZoom(e, d, u);
            }
          }}>
                <_Component1 size={14} />
              </Component107>
              <Component108 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`裁剪`} onClick={n => {
            n.stopPropagation();
            if (t.onCrop) {
              t.onCrop(e, u, d);
            }
          }}>
                <Ze size={14} />
              </Component108>
              <Component109 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`编辑`} onClick={n => {
            n.stopPropagation();
            if (t.onEdit) {
              t.onEdit(e, d, u);
            }
          }}>
                <_Component10 size={14} />
              </Component109>
            </Q.Fragment>}
          {u && u.startsWith(`http`) && h === `image` && <Component110 className={`p-1.5 text-blue-400 hover:text-blue-300 hover:bg-[#333] rounded-md`} title={`将URL转换为Base64内嵌数据 (解决跨域/跨设备问题)`} onClick={async n => {
          n.stopPropagation();
          try {
            a(e, {
              imageUrl: await _cmp_Er(u, 2048, 0.85)
            });
            t.onShowToast?.(`已转换为 Base64 内嵌格式`);
          } catch {
            t.onShowToast?.(`转换失败: 可能是跨域问题`);
          }
        }}>
              <_Component11 size={14} />
            </Component110>}
          <Component111 className={`w-px h-4 bg-[#333] mx-1`} />
          <Component112 className={`p-1.5 text-gray-400 hover:text-blue-400 hover:bg-[#333] rounded-md`} title={`发送到左侧网站`} onClick={e => {
          e.stopPropagation();
          if (t.onSendToActiveTab && u) {
            t.onSendToActiveTab(u);
          }
        }}>
            <Te size={14} />
          </Component112>
          <_cmp_Bn url={u} fallbackExt={h === `video` ? `mp4` : `png`} onToast={e => {
          return t.onShowToast?.(e);
        }} />
          <Component113 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`下载`} onClick={async t => {
          t.stopPropagation();
          let n = u;
          let r = false;
          console.log(`[ImageNode] 下载开始:`, {
            nodeId: e,
            imageUrlRef: d,
            currentImageType: typeof u,
            currentImageLength: u?.length
          });
          if (d) {
            try {
              console.log(`[ImageNode] 尝试读取原图, key=${d}`);
              let e = await Kr.getConfig(d);
              console.log(`[ImageNode] storage.getConfig 返回:`, {
                type: typeof e,
                isNull: e === null,
                isUndefined: e === undefined,
                isString: typeof e == `string`,
                length: e?.length,
                currentLength: u?.length,
                equal: e === u,
                first100: e?.substring(0, 100),
                currentFirst100: u?.substring(0, 100)
              });
              if (e && typeof e == `string` && e.length > 10000) {
                n = e;
                r = true;
                console.log(`[ImageNode] 下载使用原图成功, size:`, e.length);
              } else {
                console.log(`[ImageNode] 原图未找到或数据异常，使用当前图片`);
              }
            } catch (e) {
              console.warn(`[ImageNode] 获取原图失败，使用当前图片:`, e);
            }
          } else {
            console.log(`[ImageNode] 无原图引用(imageUrlRef)，下载当前图片`);
          }
          let i = n.length < 50000 && n.startsWith(`data:image`);
          console.log(`[ImageNode] 开始下载:`, {
            useOriginal: r,
            isLikelyThumbnail: i,
            urlLength: n.length,
            isBase64: n.startsWith(`data:image`),
            isHttp: n.startsWith(`http`)
          });
          if (n) {
            let e = `png`;
            if (h === `video`) {
              e = `mp4`;
            }
            if (h === `audio`) {
              e = `mp3`;
            }
            if (h === `text`) {
              e = `txt`;
            }
            if (typeof chrome < `u` && chrome.downloads) {
              chrome.downloads.download({
                url: n,
                filename: `yimao/file-${Date.now()}.${e}`,
                saveAs: false
              });
            } else {
              let t = document.createElement(`a`);
              t.href = n;
              t.download = `file-${Date.now()}.${e}`;
              document.body.appendChild(t);
              t.click();
              document.body.removeChild(t);
            }
          }
        }}>
            <_Component6 size={14} />
          </Component113>
        </Component114>
      </Component115>
      <Component130 className={`bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 w-full h-full flex flex-col ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}>
        <_cmp__Component12 type={`target`} position={X.Left} />
        <Component129 className={`flex-1 p-0 bg-[#121212] flex items-center justify-center relative overflow-hidden`} onMouseEnter={() => {
        return c(true);
      }} onMouseLeave={() => {
        return c(false);
      }}>
          {h === `image` && <Component116 src={g} alt={`Content`} loading={`lazy`} decoding={`async`} className={`w-full h-full object-contain cursor-pointer`} draggable={false} onError={e => {
          let t = e.currentTarget;
          if (u && t.src !== u) {
            t.src = u;
          }
        }} onDoubleClick={n => {
          n.stopPropagation();
          if (t.onZoom) {
            t.onZoom(e, d, u);
          }
        }} />}
          {h === `video` && (s ? <Component117 src={u} controls={true} autoPlay={true} preload={`metadata`} poster={_} className={`w-full h-full object-contain`} /> : l && _ ? <Component121 className={`relative w-full h-full`}>
                <Component118 src={_} alt={`video poster`} loading={`lazy`} decoding={`async`} draggable={false} className={`w-full h-full object-contain cursor-pointer`} onClick={e => {
            e.stopPropagation();
            c(true);
          }} onError={t => {
            let n = t.currentTarget;
            if (v && n.src !== v) {
              n.src = v;
            } else if (f && n.src !== f) {
              n.src = f;
            } else {
              a(e, {
                imageAvailable: false
              });
              c(true);
            }
          }} />
                <Component120 className={`absolute inset-0 flex items-center justify-center pointer-events-none`}>
                  <Component119 className={`w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-80 hover:opacity-100 hover:bg-black/70 transition-all nodrag pointer-events-auto`} title={`播放视频`} onClick={e => {
              e.stopPropagation();
              c(true);
            }}>
                    <_Component13 className={`text-white w-6 h-6`} />
                  </Component119>
                </Component120>
              </Component121> : <Component122 src={u} preload={`none`} muted={true} poster={f} className={`w-full h-full object-contain`} />)}
          {h === `audio` && <Component124 className={`w-full h-full flex flex-col items-center justify-center bg-[#1a1a1a] p-2 gap-2`}>
              <_Component5 size={24} className={`text-blue-500 mb-2`} />
              <Component123 src={u} controls={true} className={`w-full max-w-[200px] h-8`} />
            </Component124>}
          {h === `text` && <Component126 className={`w-full h-full flex flex-col items-center justify-center bg-[#1a1a1a] p-2`}>
              <_Component3 size={24} className={`text-gray-400 mb-2`} />
              <Component125 className={`text-[10px] text-gray-500`}>{`文本/数据文件`}</Component125>
            </Component126>}
          {h === `empty` && <Component128 className={`flex flex-col items-center justify-center absolute inset-0 bg-[#151515] hover:bg-[#1a1a1a] transition-colors cursor-pointer group`} onClick={e => {
          e.stopPropagation();
          o.current?.click();
        }}>
              <Component127 className={`w-12 h-12 rounded-xl bg-[#222] border border-dashed border-[#444] group-hover:border-blue-500/50 flex flex-col items-center justify-center transition-all`}>
                <_Component2 size={20} className={`text-gray-600 group-hover:text-blue-500/80 transition-colors`} />
              </Component127>
            </Component128>}
        </Component129>
        <_cmp__Component12 type={`source`} position={X.Right} />
      </Component130>
    </Component131>;
});
export default xi;