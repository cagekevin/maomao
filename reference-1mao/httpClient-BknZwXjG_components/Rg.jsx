// TODO(全局, 无需 import): data, selected, updateNodeData, s, m, v, r, selectedIds, l, url, thumb, label, source, createdAt, n, images, i, activeIndex, o, expanded, handleType, ee, f, b, u, fileUrl, fileName, display, ie, se, oe, ce, gridTemplateColumns, x, left, k
import _cmp__Component9 from './_Component9.jsx';
import _cmp__Component8 from './_Component8.jsx';
import _cmp__Component12 from './_Component12.jsx';
import _cmp_Lg from './Lg.jsx';
import _cmp_Tr from './Tr.jsx';
import { id, We, a, e, h, C, E, Ig, j, Lt, Qt, L, te, O, y, S, d, R, Rn, Ln, ne, U, H, ae, D, A, I, B, re, V, X, P, F, M, w, _, Fn, W, _Component113, Xt, _Component1, Te, _Component7, _Component6, _Component30, N, T, Ot, _Component26, Ke, _Component2, _Component114, _Component63, Ue, _Component0 } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
var Rg = Z.memo(({
  id: e,
  data: t,
  selected: n
}) => {
  let {
    updateNodeData: r
  } = We();
  let i = Z.useRef(null);
  let a = t.images || [];
  let s = Math.min(Math.max(0, t.activeIndex ?? 0), Math.max(0, a.length - 1));
  let c = t.expanded ?? false;
  let l = t.selectedIds || [];
  let u = a[s];
  let [d, f] = Z.useState(false);
  let [m, h] = Z.useState(null);
  let [_, v] = Z.useState(null);
  let [y, b] = Z.useState(null);
  let [x, S] = Z.useState(null);
  Z.useEffect(() => {
    if (m === null) {
      return;
    }
    let e = e => {
      let t = e.target;
      if (!t.closest(`[data-thumb-menu]`) && !t.closest(`[data-thumb-menu-portal]`)) {
        h(null);
        v(null);
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
  }, [m]);
  let C = Z.useCallback(t => {
    return r(e, {
      selectedIds: t
    });
  }, [e, r]);
  let w = Z.useCallback(e => {
    let t = new Set(l);
    if (t.has(e)) {
      t.delete(e);
    } else {
      t.add(e);
    }
    C(Array.from(t));
  }, [l, C]);
  let E = a.length > 0 && l.length === a.length;
  let D = Z.useCallback(() => {
    C(E ? [] : a.map(e => {
      return e.id;
    }));
  }, [E, a, C]);
  let O = Z.useCallback(async t => {
    if (t.length === 0) {
      return;
    }
    let n = await Promise.all(t.map(async e => {
      let t;
      try {
        t = await _cmp_Tr(e.url, 256, 0.7);
      } catch {
        t = undefined;
      }
      return {
        id: Ig(),
        url: e.url,
        thumb: t,
        label: e.label,
        source: e.source || `upload`,
        createdAt: Date.now()
      };
    }));
    let i = [...a, ...n];
    r(e, {
      images: i,
      activeIndex: i.length - 1
    });
  }, [a, e, r]);
  let k = Z.useCallback(t => {
    let n = a[t];
    let i = a.filter((e, n) => {
      return n !== t;
    });
    r(e, {
      images: i,
      activeIndex: Math.min(s, Math.max(0, i.length - 1)),
      selectedIds: n ? l.filter(e => {
        return e !== n.id;
      }) : l
    });
  }, [s, a, e, l, r]);
  let A = Z.useCallback(() => {
    if (l.length === 0) {
      return;
    }
    let t = new Set(l);
    let n = a.filter(e => {
      return !t.has(e.id);
    });
    r(e, {
      images: n,
      activeIndex: Math.min(s, Math.max(0, n.length - 1)),
      selectedIds: []
    });
  }, [s, a, e, l, r]);
  let j = Z.useCallback(t => {
    if (!(t < 0) && !(t >= a.length)) {
      r(e, {
        activeIndex: t
      });
    }
  }, [e, a.length, r]);
  let M = Z.useCallback((t, n) => {
    if (t === n || t < 0 || n < 0 || t >= a.length || n >= a.length) {
      return;
    }
    let i = a.slice();
    let [o] = i.splice(t, 1);
    i.splice(n, 0, o);
    o.id;
    let c = s;
    let l = a[s]?.id;
    if (l) {
      c = i.findIndex(e => {
        return e.id === l;
      });
      if (c < 0) {
        c = 0;
      }
    }
    r(e, {
      images: i,
      activeIndex: c
    });
  }, [s, e, a, r]);
  let P = Z.useCallback(() => {
    if (!(a.length <= 1)) {
      j((s - 1 + a.length) % a.length);
    }
  }, [s, a.length, j]);
  let F = Z.useCallback(() => {
    if (!(a.length <= 1)) {
      j((s + 1) % a.length);
    }
  }, [s, a.length, j]);
  let I = Z.useCallback(t => {
    r(e, {
      expanded: t
    });
  }, [e, r]);
  let ee = Lt({
    handleType: `target`
  });
  let L = Qt(Z.useMemo(() => {
    return ee.map(e => {
      return e.source;
    });
  }, [ee]));
  let R = Z.useMemo(() => {
    if (!L) {
      return [];
    }
    let e = Array.isArray(L) ? L : [L];
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
  }, [L]);
  let te = Z.useCallback(async e => {
    let t = Array.from(e).filter(e => {
      return e.type.startsWith(`image/`);
    });
    return (await Promise.all(t.map(e => {
      return new Promise(t => {
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
    }))).filter(Boolean);
  }, []);
  let ne = Z.useCallback(async e => {
    let t = await te(e);
    if (t.length !== 0) {
      O(t.map(e => {
        return {
          ...e,
          source: `upload`
        };
      }));
    }
  }, [O, te]);
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
        O((await te(n)).map(e => {
          return {
            ...e,
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
        O([{
          url: r,
          source: `paste`
        }]);
      }
    };
    window.addEventListener(`paste`, e, true);
    return () => {
      return window.removeEventListener(`paste`, e, true);
    };
  }, [n, O, te]);
  let B = Z.useCallback(async e => {
    e.preventDefault();
    e.stopPropagation();
    f(false);
    if (y !== null) {
      b(null);
      S(null);
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      let t = await te(e.dataTransfer.files);
      if (t.length > 0) {
        O(t.map(e => {
          return {
            ...e,
            source: `drop`
          };
        }));
        return;
      }
    }
    let t = e.dataTransfer.getData(`text/plain`) || e.dataTransfer.getData(`text/uri-list`);
    if (t && (t.startsWith(`http`) || t.startsWith(`data:image/`))) {
      O([{
        url: t,
        source: `drop`
      }]);
    }
  }, [O, te, y]);
  let re = Z.useCallback(e => {
    e.preventDefault();
    e.stopPropagation();
    if (y === null) {
      if (!d) {
        f(true);
      }
    }
  }, [d, y]);
  let V = Z.useCallback(e => {
    if (e.currentTarget === e.target) {
      f(false);
    }
  }, []);
  let ie = Z.useCallback(() => {
    if (R.length === 0) {
      t.onShowToast?.(`当前没有上游连线提供图片`);
      return;
    }
    let e = new Set(a.map(e => {
      return e.url;
    }));
    let n = R.filter(t => {
      return !e.has(t.url);
    });
    if (n.length === 0) {
      t.onShowToast?.(`上游连线图片已全部导入`);
      return;
    }
    O(n.map(e => {
      return {
        url: e.url,
        source: `connect`
      };
    }));
    t.onShowToast?.(`已导入 ${n.length} 张连线图`);
  }, [O, t.onShowToast, a, R]);
  let ae = Z.useCallback(e => {
    e.stopPropagation();
    if (!u) {
      return;
    }
    let t = document.createElement(`a`);
    t.href = u.url;
    t.download = u.label || `image-${Date.now()}.png`;
    document.body.appendChild(t);
    t.click();
    document.body.removeChild(t);
  }, [u]);
  let oe = Z.useCallback(n => {
    n.stopPropagation();
    if (u) {
      t.onZoom?.(e, undefined, u.url);
    }
  }, [u, t.onZoom, e]);
  let H = Z.useCallback(e => {
    e.stopPropagation();
    if (u) {
      t.onSendToActiveTab?.(u.url);
    }
  }, [u, t.onSendToActiveTab]);
  let se = a.length;
  let ce = Z.useCallback(async e => {
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
  let U = Z.useCallback(async () => {
    let e = t.onShowToast;
    let n = new Set(l);
    let r = n.size > 0 ? a.filter(e => {
      return n.has(e.id);
    }) : a;
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
  }, [a, l, t.onShowToast]);
  let W = Z.useCallback((e, t) => {
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
  const Component2280 = `input`;
  const Component2281 = `button`;
  const Component2282 = `button`;
  const Component2283 = `path`;
  const Component2284 = `svg`;
  const Component2285 = `button`;
  const Component2286 = `div`;
  const Component2287 = `button`;
  const Component2288 = `button`;
  const Component2289 = `button`;
  const Component2290 = `button`;
  const Component2291 = `div`;
  const Component2292 = `div`;
  const Component2293 = `span`;
  const Component2294 = `button`;
  const Component2295 = `span`;
  const Component2296 = `button`;
  const Component2297 = `span`;
  const Component2298 = `button`;
  const Component2299 = `div`;
  const Component2300 = `div`;
  const Component2301 = `div`;
  const Component2302 = `div`;
  const Component2303 = `div`;
  const Component2304 = `img`;
  const Component2305 = `button`;
  const Component2306 = `span`;
  const Component2307 = `button`;
  const Component2308 = `div`;
  const Component2314 = `button`;
  const Component2315 = `div`;
  const Component2316 = `div`;
  const Component2317 = `div`;
  const Component2318 = `div`;
  const Component2319 = `div`;
  const Component2320 = `div`;
  const Component2334 = `div`;
  const Component2335 = `div`;
  const Component2336 = `div`;
  return <Component2336 className={`relative w-full h-full group/node`}>
      <_cmp__Component9 visible={!!n} minWidth={240} minHeight={c ? 280 : 200} />
      <Component2280 ref={i} type={`file`} accept={`image/*`} multiple={true} style={{
      display: `none`
    }} onChange={async e => {
      if (e.target.files) {
        await ne(e.target.files);
        e.target.value = ``;
      }
    }} />
      <Component2292 className={`absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`}>
        <Component2291 className={`flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`}>
          <Component2281 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`从连线图一键导入`} onClick={e => {
          e.stopPropagation();
          ie();
        }}>
            <_Component113 size={14} />
          </Component2281>
          <Component2282 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`添加本地图片`} onClick={e => {
          e.stopPropagation();
          i.current?.click();
        }}>
            <Xt size={14} />
          </Component2282>
          {se > 0 && <Component2285 className={`p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-[#333] rounded-md`} title={l.length > 0 ? `发送选中 ${l.length} 张到剪映` : `发送全部到剪映`} onClick={e => {
          e.stopPropagation();
          U();
        }}>
              <Component2284 viewBox={`0 0 1389 1024`} width={`14`} height={`14`} fill={`currentColor`} aria-hidden={`true`}>
                <Component2283 d={`M1140.11 150.95l243.537-120.088c0 33.024 0.24 63.046 0 93.188-0.24 22.096 6.124 48.636-3.843 65.208-9.607 15.611-36.266 21.015-55.6 30.622L737.457 510.852c6.004 3.482 10.327 6.485 15.01 8.766 204.99 101.834 410.1 203.428 615.208 304.902 12.13 6.004 16.212 12.49 15.972 25.819-0.84 45.753-0.24 91.506-0.24 141.103l-239.935-118.407c-12.97 24.498-23.537 50.197-39.028 72.293-37.227 53.199-91.507 77.456-154.913 77.697-250.742 0.96-501.365 0.96-752.107 0.24-97.271 0-176.289-65.328-190.94-161.638C0 817.915 3.604 772.642 6.005 728.33c0.48-9.247 14.05-20.775 24.258-25.819 111.681-56.44 223.723-111.801 335.764-167.402l47.555-23.657c-125.972-62.685-249.782-124.89-374.312-185.655-24.859-12.009-37.228-26.78-35.066-55.24 2.882-40.59-1.441-81.9 5.044-121.649C23.057 64.367 103.395 0.6 189.257 0.6 443.844 0.6 698.429 0.96 952.894 0.36c87.904-0.24 157.315 60.524 181.933 134.858l5.164 15.732z m-566.332-8.767H207.51a105.677 105.677 0 0 0-27.98 3.603c-20.415 5.524-31.343 21.135-33.505 43.232-1.921 20.054 3.363 31.943 24.018 42.03 125.851 60.524 250.982 122.49 375.153 185.895 21.616 11.048 38.188 11.169 60.043 0 125.132-63.406 251.223-125.13 376.715-187.696 6.364-3.122 15.13-7.686 16.812-13.21 12.009-40.95-13.57-74.094-56.681-74.094l-368.308 0.36z m0 736.857H949.89c31.223 0 48.035-16.812 49.356-47.795a67.009 67.009 0 0 0-0.24-18.974c-1.561-5.524-4.803-12.85-9.487-15.13-134.498-67.25-268.996-134.138-403.854-200.307a26.9 26.9 0 0 0-20.775 0 86586.855 86586.855 0 0 0-408.897 202.348c-3.843 2.041-9.007 6.364-9.367 10.087-4.203 38.188 11.528 70.852 55 70.371 123.93-1.44 248.1-0.48 372.27-0.48v-0.12z`} />
              </Component2284>
            </Component2285>}
          {!c && u && <Q.Fragment>
              <Component2286 className={`w-px h-4 bg-[#333] mx-1`} />
              <Component2287 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`放大`} onClick={oe}>
                <_Component1 size={14} />
              </Component2287>
              <Component2288 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`发送到左侧网站`} onClick={H}>
                <Te size={14} />
              </Component2288>
              <Component2289 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`复制当前图片到剪贴板`} onClick={e => {
            e.stopPropagation();
            if (u) {
              ce(u.url);
            }
          }}>
                <_Component7 size={14} />
              </Component2289>
              <Component2290 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`下载当前图片`} onClick={ae}>
                <_Component6 size={14} />
              </Component2290>
            </Q.Fragment>}
        </Component2291>
      </Component2292>
      <Component2300 className={`flex justify-between items-center w-full mb-1`}>
        <_cmp__Component8 id={e} data={t} defaultTitle={`图片盒子`} icon={<_Component30 size={11} className={`text-gray-500`} />} className={`!mb-0`} />
        <Component2299 className={`flex items-center gap-1 nodrag`}>
          {c && se > 0 && <Q.Fragment>
              <Component2294 onClick={e => {
            e.stopPropagation();
            D();
          }} className={`px-1.5 py-0.5 rounded hover:bg-[#333] text-gray-400 hover:text-white inline-flex items-center gap-1 text-[10px]`} title={E ? `取消全选` : `全选`}>
                {E ? <N size={10} /> : <T size={10} />}
                <Component2293>{`全选`}</Component2293>
              </Component2294>
              {l.length > 0 && <Q.Fragment>
                  <Component2295 className={`text-gray-300 text-[10px]`}>
                    {`已选 `}
                    {l.length}
                  </Component2295>
                  <Component2296 onClick={e => {
              e.stopPropagation();
              A();
            }} className={`px-1.5 py-0.5 rounded hover:bg-[#333] hover:text-red-400 text-gray-400 inline-flex items-center gap-1 text-[10px]`} title={`删除已选`}>
                    <Ot size={10} />
                  </Component2296>
                </Q.Fragment>}
            </Q.Fragment>}
          <Component2298 onClick={e => {
          e.stopPropagation();
          I(!c);
        }} className={`px-1.5 py-0.5 rounded hover:bg-[#333] text-gray-400 hover:text-white inline-flex items-center gap-1 text-[10px] transition-colors`} title={c ? `折叠为单图` : `展开为缩略图网格`}>
            {c ? <_Component26 size={11} /> : <Ke size={11} />}
            <Component2297>{c ? `折叠` : `展开`}</Component2297>
          </Component2298>
        </Component2299>
      </Component2300>
      <Component2335 className={`relative w-full h-full flex-1 min-h-0`}>
        <Component2320 className={`bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 w-full h-full flex flex-col ${n ? `border-[#555]` : d ? `border-gray-400` : `border-[#333] hover:border-[#444]`}`} onDrop={B} onDragOver={re} onDragLeave={V}>
          <_cmp__Component12 type={`target`} position={X.Left} id={`in`} />
          <_cmp__Component12 type={`source`} position={X.Right} id={`active`} />
          <Component2319 className={`flex-1 bg-[#121212] flex items-center justify-center relative overflow-hidden`}>
            {se === 0 && <Component2303 className={`flex flex-col items-center justify-center absolute inset-0 bg-[#151515] hover:bg-[#1a1a1a] transition-colors cursor-pointer group`} onClick={e => {
            e.stopPropagation();
            i.current?.click();
          }}>
                <Component2301 className={`w-12 h-12 rounded-xl bg-[#222] border border-dashed border-[#444] group-hover:border-blue-500/50 flex flex-col items-center justify-center transition-all`}>
                  <_Component2 size={20} className={`text-gray-600 group-hover:text-blue-500/80 transition-colors`} />
                </Component2301>
                <Component2302 className={`text-[10px] text-gray-500 mt-2`}>{`拖拽 / 粘贴 / 点击添加图片`}</Component2302>
              </Component2303>}
            {!c && u && <Q.Fragment>
                <Component2304 src={u.url} alt={u.label || `图片 ${s + 1}`} className={`w-full h-full object-contain cursor-pointer`} draggable={false} loading={`lazy`} decoding={`async`} onDoubleClick={n => {
              n.stopPropagation();
              t.onZoom?.(e, undefined, u.url);
            }} />
                {se > 1 && <Q.Fragment>
                    <Component2308 className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-1.5 py-1 rounded-full bg-black/60 backdrop-blur-sm opacity-0 group-hover/node:opacity-100 transition-opacity`}>
                      <Component2305 onClick={e => {
                  e.stopPropagation();
                  P();
                }} className={`w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center`} title={`上一张`}>
                        <_Component114 size={14} />
                      </Component2305>
                      <Component2306 className={`px-1 text-[10px] text-white tabular-nums select-none`}>
                        {s + 1}
                        {`/`}
                        {se}
                      </Component2306>
                      <Component2307 onClick={e => {
                  e.stopPropagation();
                  F();
                }} className={`w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center`} title={`下一张`}>
                        <_Component63 size={14} />
                      </Component2307>
                    </Component2308>
                  </Q.Fragment>}
              </Q.Fragment>}
            {c && se > 0 && <Component2316 className={`absolute inset-0 overflow-auto p-2 nowheel`}>
                <Component2315 className={`grid gap-1.5`} style={{
              gridTemplateColumns: `repeat(auto-fill, minmax(72px, 1fr))`
            }}>
                  {a.map((n, r) => {
                let i = l.includes(n.id);
                let a = r === s;
                const Component2309 = `button`;
                const Component2310 = `span`;
                const Component2311 = `button`;
                const Component2312 = `div`;
                const Component2313 = `div`;
                return <Component2313 draggable={true} onDragStart={e => {
                  e.stopPropagation();
                  e.dataTransfer.effectAllowed = `move`;
                  try {
                    e.dataTransfer.setData(`text/plain`, String(r));
                  } catch {}
                  b(r);
                }} onDragEnter={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (y !== null && y !== r) {
                    S(r);
                  }
                }} onDragOver={e => {
                  if (y !== null) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = `move`;
                    if (x !== r) {
                      S(r);
                    }
                  }
                }} onDragLeave={e => {
                  if (y !== null) {
                    e.stopPropagation();
                  }
                }} onDrop={e => {
                  if (y !== null) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (y !== r) {
                      M(y, r);
                    }
                    b(null);
                    S(null);
                  }
                }} onDragEnd={e => {
                  e.stopPropagation();
                  b(null);
                  S(null);
                }} className={`relative aspect-square rounded-md overflow-hidden border cursor-grab active:cursor-grabbing group/thumb transition-all nodrag ${x === r && y !== null && y !== r ? `border-blue-400 ring-2 ring-blue-400/60 scale-[1.03]` : a ? `border-blue-500` : i ? `border-emerald-500` : `border-[#333]`} ${y === r ? `opacity-40` : ``}`} onClick={e => {
                  e.stopPropagation();
                  if (e.shiftKey || e.ctrlKey || e.metaKey) {
                    j(r);
                  } else {
                    w(n.id);
                  }
                }} onDoubleClick={r => {
                  r.stopPropagation();
                  t.onZoom?.(e, undefined, n.url);
                }} title={n.label || (i ? `点击取消选择` : `点击选择 (按住 Ctrl 设为默认图)`)} key={n.id}>
                        <_cmp_Lg src={n.thumb || n.url} className={`w-full h-full bg-[#0e0e0e]`} />
                        <Component2309 onClick={e => {
                    e.stopPropagation();
                    w(n.id);
                  }} className={`absolute top-1 left-1 w-4 h-4 rounded flex items-center justify-center transition-colors ${i ? `bg-emerald-500 text-white` : `bg-black/50 text-gray-300 group-hover/thumb:bg-black/70`}`} title={i ? `取消选择` : `选择`}>
                          {i ? <N size={10} /> : <T size={10} />}
                        </Component2309>
                        {a && <Component2310 className={`absolute bottom-1 left-1 px-1 py-px rounded bg-blue-500 text-white text-[8px] font-medium`}>{`默认`}</Component2310>}
                        <Component2312 className={`absolute top-1 right-1`} data-thumb-menu={true}>
                          <Component2311 onMouseDown={e => {
                      return e.stopPropagation();
                    }} onDoubleClick={e => {
                      return e.stopPropagation();
                    }} onClick={e => {
                      e.stopPropagation();
                      if (m === r) {
                        h(null);
                        v(null);
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
                        h(r);
                        v({
                          top: i,
                          left: n
                        });
                      }
                    }} className={`w-4 h-4 rounded bg-black/60 text-gray-200 hover:bg-blue-500 hover:text-white flex items-center justify-center transition-opacity ${m === r ? `opacity-100` : `opacity-0 group-hover/thumb:opacity-100`}`} title={`更多操作`}>
                            <Ue size={10} />
                          </Component2311>
                        </Component2312>
                      </Component2313>;
              })}
                  <Component2314 onClick={e => {
                e.stopPropagation();
                i.current?.click();
              }} className={`aspect-square rounded-md border border-dashed border-[#444] hover:border-blue-500/50 hover:bg-[#1a1a1a] text-gray-500 hover:text-blue-400 flex items-center justify-center transition-colors nodrag`} title={`添加图片`}>
                    <Xt size={16} />
                  </Component2314>
                </Component2315>
              </Component2316>}
            {d && <Component2318 className={`absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-400 flex items-center justify-center pointer-events-none`}>
                <Component2317 className={`px-3 py-1.5 rounded-md bg-[#1c1c1c] border border-blue-500/40 text-blue-300 text-xs flex items-center gap-1.5`}>
                  <_Component0 size={12} />
                  {` 松开以加入图片盒子`}
                </Component2317>
              </Component2318>}
          </Component2319>
        </Component2320>
        {m !== null && _ && a[m] && Fn.createPortal(<Component2334 data-thumb-menu-portal={true} className={`fixed z-[99999] min-w-[130px] bg-[#1c1c1c] border border-[#333] rounded-md shadow-2xl p-1 nodrag nowheel`} style={{
        top: _.top,
        left: _.left
      }} onClick={e => {
        return e.stopPropagation();
      }} onContextMenu={e => {
        return e.preventDefault();
      }}>
              {(() => {
          let n = m;
          let r = a[n];
          let i = () => {
            h(null);
            v(null);
          };
          const Component2321 = `span`;
          const Component2322 = `button`;
          const Component2323 = `span`;
          const Component2324 = `button`;
          const Component2325 = `span`;
          const Component2326 = `button`;
          const Component2327 = `span`;
          const Component2328 = `button`;
          const Component2329 = `span`;
          const Component2330 = `button`;
          const Component2331 = `div`;
          const Component2332 = `span`;
          const Component2333 = `button`;
          return <Q.Fragment>
                    <Component2322 className={`w-full text-left px-2 py-1.5 text-[11px] text-gray-300 hover:bg-[#333] hover:text-white rounded flex items-center gap-2`} onClick={() => {
              ce(r.url);
              i();
            }}>
                      <_Component7 size={11} className={`text-gray-400`} />
                      <Component2321>{`复制图片`}</Component2321>
                    </Component2322>
                    <Component2324 className={`w-full text-left px-2 py-1.5 text-[11px] text-gray-300 hover:bg-[#333] hover:text-white rounded flex items-center gap-2`} onClick={() => {
              W(r.url, r.label);
              i();
            }}>
                      <_Component6 size={11} className={`text-gray-400`} />
                      <Component2323>{`下载`}</Component2323>
                    </Component2324>
                    <Component2326 className={`w-full text-left px-2 py-1.5 text-[11px] text-gray-300 hover:bg-[#333] hover:text-white rounded flex items-center gap-2`} onClick={() => {
              t.onZoom?.(e, undefined, r.url);
              i();
            }}>
                      <_Component1 size={11} className={`text-gray-400`} />
                      <Component2325>{`放大查看`}</Component2325>
                    </Component2326>
                    <Component2328 className={`w-full text-left px-2 py-1.5 text-[11px] text-gray-300 hover:bg-[#333] hover:text-white rounded flex items-center gap-2`} onClick={() => {
              t.onSendToActiveTab?.(r.url);
              i();
            }}>
                      <Te size={11} className={`text-gray-400`} />
                      <Component2327>{`发送`}</Component2327>
                    </Component2328>
                    {n !== s && <Component2330 className={`w-full text-left px-2 py-1.5 text-[11px] text-gray-300 hover:bg-[#333] hover:text-white rounded flex items-center gap-2`} onClick={() => {
              j(n);
              i();
            }}>
                        <Ke size={11} className={`text-gray-400`} />
                        <Component2329>{`设为默认`}</Component2329>
                      </Component2330>}
                    <Component2331 className={`h-[1px] bg-[#333] my-1`} />
                    <Component2333 className={`w-full text-left px-2 py-1.5 text-[11px] text-red-400 hover:bg-[#333] rounded flex items-center gap-2`} onClick={() => {
              k(n);
              i();
            }}>
                      <Ot size={11} />
                      <Component2332>{`从盒子删除`}</Component2332>
                    </Component2333>
                  </Q.Fragment>;
        })()}
            </Component2334>, document.body)}
      </Component2335>
    </Component2336>;
});
export default Rg;