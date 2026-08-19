// TODO(全局, 无需 import): data, selected, width, updateNodeData, useThumbnail, r, l, u, m, s, b, i, selectedIds, f, url, thumb, label, source, createdAt, n, images, activeIndex, o, expanded, handleType, subfolder, preferThumbnail, thumbMaxDim, thumbQuality, thumbnailUrl, v, fileUrl, fileName, display, oe, le, se, ae, ee, gridTemplateColumns, k, left, x, de
import _cmp_Ei from './Ei.jsx';
import _cmp_Ti from './Ti.jsx';
import _cmp__Component10 from './_Component10.jsx';
import _cmp__Component88 from './_Component88.jsx';
import _cmp_Ar from './Ar.jsx';
import { id, We, Tr, wi, ei, c, y, S, O, A, r_, a, I, Lt, Qt, ne, B, xi, V, M, C, w, D, _, re, Rn, Ln, d, H, ce, ue, W, G, j, F, te, ie, U, X, h, R, E, L, Fn, P, _Component86, Xt, _Component9, Te, _Component7, _Component6, _Component27, N, T, Ot, _Component23, Ke, _Component2, _Component87, _Component61, Ue, _Component8 } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
var a_ = Z.memo(({
  id: e,
  data: t,
  selected: n,
  width: r
}) => {
  let {
    updateNodeData: i
  } = We();
  let a = Z.useRef(null);
  let {
    useThumbnail: s
  } = Tr();
  let c = wi(r ?? t._styleWidth ?? 420);
  let l = t.images || [];
  let u = Math.min(Math.max(0, t.activeIndex ?? 0), Math.max(0, l.length - 1));
  let d = t.expanded ?? false;
  let f = t.selectedIds || [];
  let m = l[u];
  let h = Z.useMemo(() => {
    if (m) {
      if (s) {
        return ei(m.url, c, `image`) || m.thumb || m.url;
      } else {
        return m.url || m.thumb;
      }
    }
  }, [s, m, c]);
  let [_, v] = Z.useState(false);
  let [y, b] = Z.useState(null);
  let [x, S] = Z.useState(null);
  let [C, w] = Z.useState(null);
  let [E, D] = Z.useState(null);
  Z.useEffect(() => {
    if (y === null) {
      return;
    }
    let e = e => {
      let t = e.target;
      if (!t.closest(`[data-thumb-menu]`) && !t.closest(`[data-thumb-menu-portal]`)) {
        b(null);
        S(null);
      }
    };
    let t = window.setTimeout(() => {
      window.addEventListener(`mousedown`, e, true);
      window.addEventListener(`click`, e, true);
    }, 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener(`mousedown`, e, true);
      window.removeEventListener(`click`, e, true);
    };
  }, [y]);
  let O = Z.useCallback(t => {
    return i(e, {
      selectedIds: t
    });
  }, [e, i]);
  let k = Z.useCallback(e => {
    let t = new Set(f);
    if (t.has(e)) {
      t.delete(e);
    } else {
      t.add(e);
    }
    O(Array.from(t));
  }, [f, O]);
  let A = l.length > 0 && f.length === l.length;
  let j = Z.useCallback(() => {
    O(A ? [] : l.map(e => {
      return e.id;
    }));
  }, [A, l, O]);
  let M = Z.useCallback(async t => {
    if (t.length === 0) {
      return;
    }
    let n = await Promise.all(t.map(async e => {
      let t = e.thumbnailUrl;
      if (!t) {
        if (typeof e.url == `string` && (e.url.startsWith(`http://`) || e.url.startsWith(`https://`))) {
          t = e.url;
        } else {
          try {
            t = await _cmp_Ar(e.url, 256, 0.7);
          } catch {
            t = undefined;
          }
        }
      }
      return {
        id: r_(),
        url: e.url,
        thumb: t,
        label: e.label,
        source: e.source || `upload`,
        createdAt: Date.now()
      };
    }));
    let r = [...l, ...n];
    i(e, {
      images: r,
      activeIndex: r.length - 1
    });
  }, [l, e, i]);
  let P = Z.useCallback(t => {
    let n = l[t];
    let r = l.filter((e, n) => {
      return n !== t;
    });
    i(e, {
      images: r,
      activeIndex: Math.min(u, Math.max(0, r.length - 1)),
      selectedIds: n ? f.filter(e => {
        return e !== n.id;
      }) : f
    });
  }, [u, l, e, f, i]);
  let F = Z.useCallback(() => {
    if (f.length === 0) {
      return;
    }
    let t = new Set(f);
    let n = l.filter(e => {
      return !t.has(e.id);
    });
    i(e, {
      images: n,
      activeIndex: Math.min(u, Math.max(0, n.length - 1)),
      selectedIds: []
    });
  }, [u, l, e, f, i]);
  let I = Z.useCallback(t => {
    if (!(t < 0) && !(t >= l.length)) {
      i(e, {
        activeIndex: t
      });
    }
  }, [e, l.length, i]);
  let L = Z.useCallback((t, n) => {
    if (t === n || t < 0 || n < 0 || t >= l.length || n >= l.length) {
      return;
    }
    let r = l.slice();
    let [a] = r.splice(t, 1);
    r.splice(n, 0, a);
    a.id;
    let o = u;
    let s = l[u]?.id;
    if (s) {
      o = r.findIndex(e => {
        return e.id === s;
      });
      if (o < 0) {
        o = 0;
      }
    }
    i(e, {
      images: r,
      activeIndex: o
    });
  }, [u, e, l, i]);
  let ee = Z.useCallback(() => {
    if (!(l.length <= 1)) {
      I((u - 1 + l.length) % l.length);
    }
  }, [u, l.length, I]);
  let R = Z.useCallback(() => {
    if (!(l.length <= 1)) {
      I((u + 1) % l.length);
    }
  }, [u, l.length, I]);
  let te = Z.useCallback(t => {
    i(e, {
      expanded: t
    });
  }, [e, i]);
  let ne = Lt({
    handleType: `target`
  });
  let B = Qt(Z.useMemo(() => {
    return ne.map(e => {
      return e.source;
    });
  }, [ne]));
  let re = Z.useMemo(() => {
    if (!B) {
      return [];
    }
    let e = Array.isArray(B) ? B : [B];
    let t = [];
    e.forEach(e => {
      if (e) {
        if (typeof e.data?.imageUrl == `string` && (e.data.imageUrl.startsWith(`http`) || e.data.imageUrl.startsWith(`data:image`))) {
          t.push({
            id: e.id,
            url: e.data.imageUrl
          });
        }
        if (e.type === `imageBoxNode` && Array.isArray(e.data?.images)) {
          e.data.images.forEach(n => {
            if (n?.url) {
              t.push({
                id: `${e.id}-${n.id}`,
                url: n.url
              });
            }
          });
        }
        if (e.type === `videoExtractNode` && Array.isArray(e.data?.extractedImages)) {
          e.data.extractedImages.forEach((n, r) => {
            if (n) {
              t.push({
                id: `${e.id}-ext-${r}`,
                url: n
              });
            }
          });
        }
      }
    });
    return t;
  }, [B]);
  let V = Z.useCallback(async e => {
    let t = Array.from(e).filter(e => {
      return e.type.startsWith(`image/`);
    });
    return (await Promise.all(t.map(async e => {
      try {
        console.log(`[ImageBoxNode] uploadFiles calling urlifyAsset for`, e.name, e.type, e.size);
        let t = await xi(e, {
          subfolder: `canvas/upload`,
          preferThumbnail: true,
          thumbMaxDim: 480,
          thumbQuality: 75
        });
        console.log(`[ImageBoxNode] urlifyAsset success:`, t.url);
        return {
          url: t.url,
          thumbnailUrl: t.thumbnailUrl,
          label: e.name
        };
      } catch (t) {
        console.warn(`[ImageBoxNode] urlifyAsset failed, fallback to base64:`, t);
        try {
          return await new Promise(t => {
            let n = new FileReader();
            n.onload = () => {
              return t({
                url: n.result,
                label: e.name
              });
            };
            n.onerror = () => {
              return t(null);
            };
            n.readAsDataURL(e);
          });
        } catch (e) {
          console.warn(`[ImageBoxNode] base64 fallback also failed:`, e);
          return null;
        }
      }
    }))).filter(Boolean);
  }, []);
  let H = Z.useCallback(async e => {
    let t = await V(e);
    if (t.length !== 0) {
      M(t.map(e => {
        return {
          url: e.url,
          thumbnailUrl: e.thumbnailUrl,
          label: e.label,
          source: `upload`
        };
      }));
    }
  }, [M, V]);
  Z.useEffect(() => {
    if (!n) {
      return;
    }
    let e = async e => {
      if (!e.clipboardData) {
        return;
      }
      let t = document.activeElement;
      if (t && (t.tagName === `INPUT` || t.tagName === `TEXTAREA` || t.isContentEditable)) {
        return;
      }
      let n = Array.from(e.clipboardData.items).filter(e => {
        return e.kind === `file` && e.type.startsWith(`image/`);
      }).map(e => {
        return e.getAsFile();
      }).filter(Boolean);
      if (n.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        M((await V(n)).map(e => {
          return {
            url: e.url,
            thumbnailUrl: e.thumbnailUrl,
            label: e.label,
            source: `paste`
          };
        }));
        return;
      }
      let r = e.clipboardData.getData(`text/plain`).trim();
      if (r && (r.startsWith(`http`) || r.startsWith(`data:image/`))) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        let t = r;
        let n;
        if (r.startsWith(`data:image/`)) {
          try {
            let e = await xi(r, {
              subfolder: `canvas/upload`,
              preferThumbnail: true,
              thumbMaxDim: 480,
              thumbQuality: 75
            });
            t = e.url;
            n = e.thumbnailUrl;
          } catch {}
        }
        M([{
          url: t,
          thumbnailUrl: n,
          source: `paste`
        }]);
      }
    };
    window.addEventListener(`paste`, e, true);
    return () => {
      return window.removeEventListener(`paste`, e, true);
    };
  }, [n, M, V]);
  let ie = Z.useCallback(async e => {
    e.preventDefault();
    e.stopPropagation();
    v(false);
    if (C !== null) {
      w(null);
      D(null);
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      let t = await V(e.dataTransfer.files);
      console.log(`[ImageBoxNode] onDrop uploadFiles returned:`, JSON.stringify(t.map(e => {
        return {
          url: e.url?.slice(0, 60),
          thumb: e.thumbnailUrl?.slice(0, 60),
          label: e.label
        };
      })));
      if (t.length > 0) {
        M(t.map(e => {
          return {
            url: e.url,
            thumbnailUrl: e.thumbnailUrl,
            label: e.label,
            source: `drop`
          };
        }));
        return;
      }
    }
    let t = e.dataTransfer.getData(`text/plain`) || e.dataTransfer.getData(`text/uri-list`);
    if (t && (t.startsWith(`http`) || t.startsWith(`data:image/`))) {
      let e = t;
      let n;
      if (t.startsWith(`data:image/`)) {
        try {
          let r = await xi(t, {
            subfolder: `canvas/upload`,
            preferThumbnail: true,
            thumbMaxDim: 480,
            thumbQuality: 75
          });
          e = r.url;
          n = r.thumbnailUrl;
        } catch (e) {
          console.warn(`[ImageBoxNode] data URL upload failed, keeping original:`, e);
        }
      }
      M([{
        url: e,
        thumbnailUrl: n,
        source: `drop`
      }]);
    }
  }, [M, V, C]);
  let ae = Z.useCallback(e => {
    e.preventDefault();
    e.stopPropagation();
    if (C === null) {
      if (!_) {
        v(true);
      }
    }
  }, [_, C]);
  let U = Z.useCallback(e => {
    if (e.currentTarget === e.target) {
      v(false);
    }
  }, []);
  let oe = Z.useCallback(() => {
    if (re.length === 0) {
      t.onShowToast?.(`当前没有上游连线提供图片`);
      return;
    }
    let e = new Set(l.map(e => {
      return e.url;
    }));
    let n = re.filter(t => {
      return !e.has(t.url);
    });
    if (n.length === 0) {
      t.onShowToast?.(`上游连线图片已全部导入`);
      return;
    }
    M(n.map(e => {
      return {
        url: e.url,
        source: `connect`
      };
    }));
    t.onShowToast?.(`已导入 ${n.length} 张连线图`);
  }, [M, t.onShowToast, l, re]);
  let se = Z.useCallback(e => {
    e.stopPropagation();
    if (!m) {
      return;
    }
    let t = document.createElement(`a`);
    t.href = m.url;
    t.download = m.label || `image-${Date.now()}.png`;
    document.body.appendChild(t);
    t.click();
    document.body.removeChild(t);
  }, [m]);
  let W = Z.useCallback(n => {
    n.stopPropagation();
    if (m) {
      t.onZoom?.(e, undefined, m.url);
    }
  }, [m, t.onZoom, e]);
  let G = Z.useCallback(e => {
    e.stopPropagation();
    if (m) {
      t.onSendToActiveTab?.(m.url);
    }
  }, [m, t.onSendToActiveTab]);
  let ce = l.length;
  let le = Z.useCallback(async e => {
    let n = t.onShowToast;
    try {
      let t = new Image();
      t.crossOrigin = `anonymous`;
      t.src = e;
      await new Promise((e, n) => {
        t.onload = () => {
          return e();
        };
        t.onerror = () => {
          return n(Error(`image load failed`));
        };
      });
      let r = document.createElement(`canvas`);
      r.width = t.naturalWidth || t.width;
      r.height = t.naturalHeight || t.height;
      let i = r.getContext(`2d`);
      if (!i) {
        throw Error(`canvas ctx`);
      }
      i.drawImage(t, 0, 0);
      await new Promise((e, t) => {
        r.toBlob(async n => {
          if (!n) {
            return t(Error(`blob null`));
          }
          try {
            await navigator.clipboard.write([new ClipboardItem({
              'image/png': n
            })]);
            e();
          } catch (e) {
            t(e);
          }
        }, `image/png`);
      });
      n?.(`图片已复制，可以在画布中粘贴`);
    } catch {
      try {
        await navigator.clipboard.writeText(e);
        n?.(`图片链接已复制（直接复制图片失败）`);
      } catch {
        n?.(`复制失败，可能因跨域或权限限制`);
      }
    }
  }, [t.onShowToast]);
  let ue = Z.useCallback(async () => {
    let e = t.onShowToast;
    let n = new Set(f);
    let r = n.size > 0 ? l.filter(e => {
      return n.has(e.id);
    }) : l;
    if (r.length === 0) {
      e?.(`没有可发送的图片`);
      return;
    }
    e?.(`正在发送 ${r.length} 张到剪映…`);
    let i = await Rn(r.map(e => {
      return {
        fileUrl: e.url,
        fileName: Ln(e.url, `png`)
      };
    }));
    e?.(i.message);
  }, [l, f, t.onShowToast]);
  let de = Z.useCallback((e, t) => {
    if (!e) {
      return;
    }
    let n = document.createElement(`a`);
    n.href = e;
    n.download = t || `image-${Date.now()}.png`;
    document.body.appendChild(n);
    n.click();
    document.body.removeChild(n);
  }, []);
  const Component2302 = `input`;
  const Component2303 = `button`;
  const Component2304 = `button`;
  const Component2305 = `path`;
  const Component2306 = `svg`;
  const Component2307 = `button`;
  const Component2308 = `div`;
  const Component2309 = `button`;
  const Component2310 = `button`;
  const Component2311 = `button`;
  const Component2312 = `button`;
  const Component2313 = `div`;
  const Component2314 = `div`;
  const Component2315 = `span`;
  const Component2316 = `button`;
  const Component2317 = `span`;
  const Component2318 = `button`;
  const Component2319 = `span`;
  const Component2320 = `button`;
  const Component2321 = `div`;
  const Component2322 = `div`;
  const Component2323 = `div`;
  const Component2324 = `div`;
  const Component2325 = `div`;
  const Component2326 = `img`;
  const Component2327 = `button`;
  const Component2328 = `span`;
  const Component2329 = `button`;
  const Component2330 = `div`;
  const Component2336 = `button`;
  const Component2337 = `div`;
  const Component2338 = `div`;
  const Component2339 = `div`;
  const Component2340 = `div`;
  const Component2341 = `div`;
  const Component2342 = `div`;
  const Component2356 = `div`;
  const Component2357 = `div`;
  const Component2358 = `div`;
  return <Component2358 className={`relative w-full h-full group/node`}>
      <_cmp_Ei visible={!!n} minWidth={240} minHeight={d ? 280 : 200} />
      <Component2302 ref={a} type={`file`} accept={`image/*`} multiple={true} style={{
      display: `none`
    }} onChange={async e => {
      if (e.target.files) {
        await H(e.target.files);
        e.target.value = ``;
      }
    }} />
      <Component2314 className={`absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`}>
        <Component2313 className={`flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`}>
          <Component2303 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`从连线图一键导入`} onClick={e => {
          e.stopPropagation();
          oe();
        }}>
            <_Component86 size={14} />
          </Component2303>
          <Component2304 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`添加本地图片`} onClick={e => {
          e.stopPropagation();
          a.current?.click();
        }}>
            <Xt size={14} />
          </Component2304>
          {ce > 0 && <Component2307 className={`p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-[#333] rounded-md`} title={f.length > 0 ? `发送选中 ${f.length} 张到剪映` : `发送全部到剪映`} onClick={e => {
          e.stopPropagation();
          ue();
        }}>
              <Component2306 viewBox={`0 0 1389 1024`} width={`14`} height={`14`} fill={`currentColor`} aria-hidden={`true`}>
                <Component2305 d={`M1140.11 150.95l243.537-120.088c0 33.024 0.24 63.046 0 93.188-0.24 22.096 6.124 48.636-3.843 65.208-9.607 15.611-36.266 21.015-55.6 30.622L737.457 510.852c6.004 3.482 10.327 6.485 15.01 8.766 204.99 101.834 410.1 203.428 615.208 304.902 12.13 6.004 16.212 12.49 15.972 25.819-0.84 45.753-0.24 91.506-0.24 141.103l-239.935-118.407c-12.97 24.498-23.537 50.197-39.028 72.293-37.227 53.199-91.507 77.456-154.913 77.697-250.742 0.96-501.365 0.96-752.107 0.24-97.271 0-176.289-65.328-190.94-161.638C0 817.915 3.604 772.642 6.005 728.33c0.48-9.247 14.05-20.775 24.258-25.819 111.681-56.44 223.723-111.801 335.764-167.402l47.555-23.657c-125.972-62.685-249.782-124.89-374.312-185.655-24.859-12.009-37.228-26.78-35.066-55.24 2.882-40.59-1.441-81.9 5.044-121.649C23.057 64.367 103.395 0.6 189.257 0.6 443.844 0.6 698.429 0.96 952.894 0.36c87.904-0.24 157.315 60.524 181.933 134.858l5.164 15.732z m-566.332-8.767H207.51a105.677 105.677 0 0 0-27.98 3.603c-20.415 5.524-31.343 21.135-33.505 43.232-1.921 20.054 3.363 31.943 24.018 42.03 125.851 60.524 250.982 122.49 375.153 185.895 21.616 11.048 38.188 11.169 60.043 0 125.132-63.406 251.223-125.13 376.715-187.696 6.364-3.122 15.13-7.686 16.812-13.21 12.009-40.95-13.57-74.094-56.681-74.094l-368.308 0.36z m0 736.857H949.89c31.223 0 48.035-16.812 49.356-47.795a67.009 67.009 0 0 0-0.24-18.974c-1.561-5.524-4.803-12.85-9.487-15.13-134.498-67.25-268.996-134.138-403.854-200.307a26.9 26.9 0 0 0-20.775 0 86586.855 86586.855 0 0 0-408.897 202.348c-3.843 2.041-9.007 6.364-9.367 10.087-4.203 38.188 11.528 70.852 55 70.371 123.93-1.44 248.1-0.48 372.27-0.48v-0.12z`} />
              </Component2306>
            </Component2307>}
          {!d && m && <Q.Fragment>
              <Component2308 className={`w-px h-4 bg-[#333] mx-1`} />
              <Component2309 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`放大`} onClick={W}>
                <_Component9 size={14} />
              </Component2309>
              <Component2310 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`发送到左侧网站`} onClick={G}>
                <Te size={14} />
              </Component2310>
              <Component2311 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`复制当前图片到剪贴板`} onClick={e => {
            e.stopPropagation();
            if (m) {
              le(m.url);
            }
          }}>
                <_Component7 size={14} />
              </Component2311>
              <Component2312 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`下载当前图片`} onClick={se}>
                <_Component6 size={14} />
              </Component2312>
            </Q.Fragment>}
        </Component2313>
      </Component2314>
      <Component2322 className={`flex justify-between items-center w-full mb-1`}>
        <_cmp_Ti id={e} data={t} defaultTitle={`图片盒子`} icon={<_Component27 size={11} className={`text-gray-500`} />} className={`!mb-0`} />
        <Component2321 className={`flex items-center gap-1 nodrag`}>
          {d && ce > 0 && <Q.Fragment>
              <Component2316 onClick={e => {
            e.stopPropagation();
            j();
          }} className={`px-1.5 py-0.5 rounded hover:bg-[#333] text-gray-400 hover:text-white inline-flex items-center gap-1 text-[10px]`} title={A ? `取消全选` : `全选`}>
                {A ? <N size={10} /> : <T size={10} />}
                <Component2315>{`全选`}</Component2315>
              </Component2316>
              {f.length > 0 && <Q.Fragment>
                  <Component2317 className={`text-gray-300 text-[10px]`}>
                    {`已选 `}
                    {f.length}
                  </Component2317>
                  <Component2318 onClick={e => {
              e.stopPropagation();
              F();
            }} className={`px-1.5 py-0.5 rounded hover:bg-[#333] hover:text-red-400 text-gray-400 inline-flex items-center gap-1 text-[10px]`} title={`删除已选`}>
                    <Ot size={10} />
                  </Component2318>
                </Q.Fragment>}
            </Q.Fragment>}
          <Component2320 onClick={e => {
          e.stopPropagation();
          te(!d);
        }} className={`px-1.5 py-0.5 rounded hover:bg-[#333] text-gray-400 hover:text-white inline-flex items-center gap-1 text-[10px] transition-colors`} title={d ? `折叠为单图` : `展开为缩略图网格`}>
            {d ? <_Component23 size={11} /> : <Ke size={11} />}
            <Component2319>{d ? `折叠` : `展开`}</Component2319>
          </Component2320>
        </Component2321>
      </Component2322>
      <Component2357 className={`relative w-full h-full flex-1 min-h-0`}>
        <Component2342 className={`bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 w-full h-full flex flex-col ${n ? `border-[#555]` : _ ? `border-gray-400` : `border-[#333] hover:border-[#444]`}`} onDrop={ie} onDragOver={ae} onDragLeave={U}>
          <_cmp__Component10 type={`target`} position={X.Left} id={`in`} />
          <_cmp__Component10 type={`source`} position={X.Right} id={`active`} />
          <Component2341 className={`flex-1 bg-[#121212] flex items-center justify-center relative overflow-hidden`}>
            {ce === 0 && <Component2325 className={`flex flex-col items-center justify-center absolute inset-0 bg-[#151515] hover:bg-[#1a1a1a] transition-colors cursor-pointer group`} onClick={e => {
            e.stopPropagation();
            a.current?.click();
          }}>
                <Component2323 className={`w-12 h-12 rounded-xl bg-[#222] border border-dashed border-[#444] group-hover:border-blue-500/50 flex flex-col items-center justify-center transition-all`}>
                  <_Component2 size={20} className={`text-gray-600 group-hover:text-blue-500/80 transition-colors`} />
                </Component2323>
                <Component2324 className={`text-[10px] text-gray-500 mt-2`}>{`拖拽 / 粘贴 / 点击添加图片`}</Component2324>
              </Component2325>}
            {!d && m && <Q.Fragment>
                <Component2326 src={h} alt={m.label || `图片 ${u + 1}`} className={`w-full h-full object-contain cursor-pointer`} draggable={false} loading={`lazy`} decoding={`async`} onError={e => {
              let t = e.currentTarget;
              if (m.url && t.src !== m.url) {
                t.src = m.url;
              }
            }} onDoubleClick={n => {
              n.stopPropagation();
              t.onZoom?.(e, undefined, m.url);
            }} />
                {ce > 1 && <Q.Fragment>
                    <Component2330 className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-1.5 py-1 rounded-full bg-black/60 backdrop-blur-sm opacity-0 group-hover/node:opacity-100 transition-opacity`}>
                      <Component2327 onClick={e => {
                  e.stopPropagation();
                  ee();
                }} className={`w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center`} title={`上一张`}>
                        <_Component87 size={14} />
                      </Component2327>
                      <Component2328 className={`px-1 text-[10px] text-white tabular-nums select-none`}>
                        {u + 1}
                        {`/`}
                        {ce}
                      </Component2328>
                      <Component2329 onClick={e => {
                  e.stopPropagation();
                  R();
                }} className={`w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center`} title={`下一张`}>
                        <_Component61 size={14} />
                      </Component2329>
                    </Component2330>
                  </Q.Fragment>}
              </Q.Fragment>}
            {d && ce > 0 && <Component2338 className={`absolute inset-0 overflow-auto p-2 nowheel`}>
                <Component2337 className={`grid gap-1.5`} style={{
              gridTemplateColumns: `repeat(auto-fill, minmax(72px, 1fr))`
            }}>
                  {l.map((n, r) => {
                let i = f.includes(n.id);
                let a = r === u;
                const Component2331 = `button`;
                const Component2332 = `span`;
                const Component2333 = `button`;
                const Component2334 = `div`;
                const Component2335 = `div`;
                return <Component2335 draggable={true} onDragStart={e => {
                  e.stopPropagation();
                  e.dataTransfer.effectAllowed = `move`;
                  try {
                    e.dataTransfer.setData(`text/plain`, String(r));
                  } catch {}
                  w(r);
                }} onDragEnter={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (C !== null && C !== r) {
                    D(r);
                  }
                }} onDragOver={e => {
                  if (C !== null) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = `move`;
                    if (E !== r) {
                      D(r);
                    }
                  }
                }} onDragLeave={e => {
                  if (C !== null) {
                    e.stopPropagation();
                  }
                }} onDrop={e => {
                  if (C !== null) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (C !== r) {
                      L(C, r);
                    }
                    w(null);
                    D(null);
                  }
                }} onDragEnd={e => {
                  e.stopPropagation();
                  w(null);
                  D(null);
                }} className={`relative aspect-square rounded-md overflow-hidden border cursor-grab active:cursor-grabbing group/thumb transition-all nodrag ${E === r && C !== null && C !== r ? `border-blue-400 ring-2 ring-blue-400/60 scale-[1.03]` : a ? `border-blue-500` : i ? `border-emerald-500` : `border-[#333]`} ${C === r ? `opacity-40` : ``}`} onClick={e => {
                  e.stopPropagation();
                  if (e.shiftKey || e.ctrlKey || e.metaKey) {
                    I(r);
                  } else {
                    k(n.id);
                  }
                }} onDoubleClick={r => {
                  r.stopPropagation();
                  t.onZoom?.(e, undefined, n.url);
                }} title={n.label || (i ? `点击取消选择` : `点击选择 (按住 Ctrl 设为默认图)`)} key={n.id}>
                        <_cmp__Component88 src={n.thumb || n.url} className={`w-full h-full bg-[#0e0e0e]`} />
                        <Component2331 onClick={e => {
                    e.stopPropagation();
                    k(n.id);
                  }} className={`absolute top-1 left-1 w-4 h-4 rounded flex items-center justify-center transition-colors ${i ? `bg-emerald-500 text-white` : `bg-black/50 text-gray-300 group-hover/thumb:bg-black/70`}`} title={i ? `取消选择` : `选择`}>
                          {i ? <N size={10} /> : <T size={10} />}
                        </Component2331>
                        {a && <Component2332 className={`absolute bottom-1 left-1 px-1 py-px rounded bg-blue-500 text-white text-[8px] font-medium`}>{`默认`}</Component2332>}
                        <Component2334 className={`absolute top-1 right-1`} data-thumb-menu={true}>
                          <Component2333 onMouseDown={e => {
                      return e.stopPropagation();
                    }} onDoubleClick={e => {
                      return e.stopPropagation();
                    }} onClick={e => {
                      e.stopPropagation();
                      if (y === r) {
                        b(null);
                        S(null);
                      } else {
                        let t = e.currentTarget.getBoundingClientRect();
                        let n = t.right - 130;
                        if (n < 8) {
                          n = 8;
                        }
                        if (n + 130 > window.innerWidth - 8) {
                          n = window.innerWidth - 8 - 130;
                        }
                        let i = t.bottom + 4;
                        if (i + 220 > window.innerHeight - 8) {
                          i = t.top - 220 - 4;
                        }
                        b(r);
                        S({
                          top: i,
                          left: n
                        });
                      }
                    }} className={`w-4 h-4 rounded bg-black/60 text-gray-200 hover:bg-blue-500 hover:text-white flex items-center justify-center transition-opacity ${y === r ? `opacity-100` : `opacity-0 group-hover/thumb:opacity-100`}`} title={`更多操作`}>
                            <Ue size={10} />
                          </Component2333>
                        </Component2334>
                      </Component2335>;
              })}
                  <Component2336 onClick={e => {
                e.stopPropagation();
                a.current?.click();
              }} className={`aspect-square rounded-md border border-dashed border-[#444] hover:border-blue-500/50 hover:bg-[#1a1a1a] text-gray-500 hover:text-blue-400 flex items-center justify-center transition-colors nodrag`} title={`添加图片`}>
                    <Xt size={16} />
                  </Component2336>
                </Component2337>
              </Component2338>}
            {_ && <Component2340 className={`absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-400 flex items-center justify-center pointer-events-none`}>
                <Component2339 className={`px-3 py-1.5 rounded-md bg-[#1c1c1c] border border-blue-500/40 text-blue-300 text-xs flex items-center gap-1.5`}>
                  <_Component8 size={12} />
                  {` 松开以加入图片盒子`}
                </Component2339>
              </Component2340>}
          </Component2341>
        </Component2342>
        {y !== null && x && l[y] && Fn.createPortal(<Component2356 data-thumb-menu-portal={true} className={`fixed z-[99999] min-w-[130px] bg-[#1c1c1c] border border-[#333] rounded-md shadow-2xl p-1 nodrag nowheel`} style={{
        top: x.top,
        left: x.left
      }} onClick={e => {
        return e.stopPropagation();
      }} onContextMenu={e => {
        return e.preventDefault();
      }}>
              {(() => {
          let n = y;
          let r = l[n];
          let i = () => {
            b(null);
            S(null);
          };
          const Component2343 = `span`;
          const Component2344 = `button`;
          const Component2345 = `span`;
          const Component2346 = `button`;
          const Component2347 = `span`;
          const Component2348 = `button`;
          const Component2349 = `span`;
          const Component2350 = `button`;
          const Component2351 = `span`;
          const Component2352 = `button`;
          const Component2353 = `div`;
          const Component2354 = `span`;
          const Component2355 = `button`;
          return <Q.Fragment>
                    <Component2344 className={`w-full text-left px-2 py-1.5 text-[11px] text-gray-300 hover:bg-[#333] hover:text-white rounded flex items-center gap-2`} onClick={() => {
              le(r.url);
              i();
            }}>
                      <_Component7 size={11} className={`text-gray-400`} />
                      <Component2343>{`复制图片`}</Component2343>
                    </Component2344>
                    <Component2346 className={`w-full text-left px-2 py-1.5 text-[11px] text-gray-300 hover:bg-[#333] hover:text-white rounded flex items-center gap-2`} onClick={() => {
              de(r.url, r.label);
              i();
            }}>
                      <_Component6 size={11} className={`text-gray-400`} />
                      <Component2345>{`下载`}</Component2345>
                    </Component2346>
                    <Component2348 className={`w-full text-left px-2 py-1.5 text-[11px] text-gray-300 hover:bg-[#333] hover:text-white rounded flex items-center gap-2`} onClick={() => {
              t.onZoom?.(e, undefined, r.url);
              i();
            }}>
                      <_Component9 size={11} className={`text-gray-400`} />
                      <Component2347>{`放大查看`}</Component2347>
                    </Component2348>
                    <Component2350 className={`w-full text-left px-2 py-1.5 text-[11px] text-gray-300 hover:bg-[#333] hover:text-white rounded flex items-center gap-2`} onClick={() => {
              t.onSendToActiveTab?.(r.url);
              i();
            }}>
                      <Te size={11} className={`text-gray-400`} />
                      <Component2349>{`发送`}</Component2349>
                    </Component2350>
                    {n !== u && <Component2352 className={`w-full text-left px-2 py-1.5 text-[11px] text-gray-300 hover:bg-[#333] hover:text-white rounded flex items-center gap-2`} onClick={() => {
              I(n);
              i();
            }}>
                        <Ke size={11} className={`text-gray-400`} />
                        <Component2351>{`设为默认`}</Component2351>
                      </Component2352>}
                    <Component2353 className={`h-[1px] bg-[#333] my-1`} />
                    <Component2355 className={`w-full text-left px-2 py-1.5 text-[11px] text-red-400 hover:bg-[#333] rounded flex items-center gap-2`} onClick={() => {
              P(n);
              i();
            }}>
                      <Ot size={11} />
                      <Component2354>{`从盒子删除`}</Component2354>
                    </Component2355>
                  </Q.Fragment>;
        })()}
            </Component2356>, document.body)}
      </Component2357>
    </Component2358>;
});
export default a_;