// TODO(全局, 无需 import): data, selected, updateNodeData, getNodes, getEdges, r, mode, f, intervalSec, m, frameCount, g, sensitivity, v, hiddenIndices, b, handleType, n, videoUrl, videoName, errorMessage, onExtractFrames, l, o, i, extractedImages, progress, x, willReadFrequently, s, allExtractedImages, loading, u, p, imageUrl, type, images, display, k, width
import _cmp__Component8 from './_Component8.jsx';
import _cmp__Component9 from './_Component9.jsx';
import _cmp__Component12 from './_Component12.jsx';
import { id, We, Lt, Qt, E, D, O, j, d, X, M, C, T, S, w, A, _, h, y, Le, _Component7, _Component17, _Component2, _Component25, _Component13, _Component0, K } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
var ec = Z.memo(({
  id: e,
  data: t,
  selected: n
}) => {
  let {
    updateNodeData: r,
    getNodes: i,
    getEdges: a
  } = We();
  let o = t;
  let s = Z.useRef(null);
  let [c, l] = Z.useState(null);
  let [u, d] = Z.useState(false);
  let [f, p] = Z.useState(t.mode || `count`);
  let [m, h] = Z.useState(t.intervalSec || 2);
  let [g, _] = Z.useState(t.frameCount || 9);
  let [v, y] = Z.useState(t.sensitivity || 30);
  let [b] = Z.useState(t.hiddenIndices || []);
  let x = Z.useRef(null);
  let [S, C] = Z.useState(0);
  let [w, T] = Z.useState(0);
  Z.useEffect(() => {
    r(e, {
      mode: f,
      intervalSec: m,
      frameCount: g,
      sensitivity: v,
      hiddenIndices: b
    });
  }, [f, m, g, v, b, e, r]);
  let E = Lt({
    handleType: `target`
  });
  let D = Qt(Z.useMemo(() => {
    return E.map(e => {
      return e.source;
    });
  }, [E]));
  let O = Z.useRef(``);
  Z.useEffect(() => {
    if (c) {
      return;
    }
    let t = Array.isArray(D) ? D : D ? [D] : [];
    let n = ``;
    for (let e of t) {
      if (e?.data) {
        if (e.data.videoUrl && typeof e.data.videoUrl == `string`) {
          n = e.data.videoUrl;
          break;
        }
        if (e.data.imageUrl && typeof e.data.imageUrl == `string`) {
          let t = e.data.imageUrl;
          if (t.startsWith(`data:video/`) || /\.(mp4|webm|mov|ogg)($|\?)/i.test(t)) {
            n = t;
            break;
          }
        }
        if (e.data.text && typeof e.data.text == `string`) {
          let t = e.data.text.match(/(https?:\/\/[^\s"'`<>]+)|(data:(audio|video)\/[^\s"']+)/i);
          if (t) {
            n = t[0];
            break;
          }
        }
      }
    }
    if (n && n !== O.current) {
      O.current = n;
      let t = `connected_video.mp4`;
      if (n.startsWith(`data:video/`)) {
        t = `base64_video.mp4`;
      } else {
        try {
          let e = new URL(n);
          let r = e.pathname.split(`/`).pop();
          if (r && r.includes(`.`)) {
            t = r + e.search;
          } else {
            t = n;
          }
        } catch {
          t = n;
        }
      }
      r(e, {
        videoUrl: n,
        videoName: t,
        errorMessage: undefined
      });
    } else if (!n && O.current) {
      O.current = ``;
      if (!c) {
        r(e, {
          videoUrl: undefined,
          videoName: undefined
        });
      }
    }
  }, [D, c, e, r]);
  Z.useEffect(() => {
    r(e, {
      onExtractFrames: j
    });
  }, [c, f, m, g, v]);
  let k = t => {
    let n = t.target.files?.[0];
    if (!n) {
      return;
    }
    l(n);
    let i = URL.createObjectURL(n);
    o.videoUrl = i;
    o.videoName = n.name;
    r(e, {
      videoUrl: i,
      videoName: n.name,
      errorMessage: undefined,
      extractedImages: undefined,
      progress: 0
    });
    t.target.value = ``;
  };
  let A = async () => {
    let t = x.current;
    if (t) {
      try {
        let n = document.createElement(`canvas`);
        let i = n.getContext(`2d`, {
          willReadFrequently: true
        });
        if (!i) {
          throw Error(`Canvas not supported`);
        }
        let a = t.videoWidth;
        let s = t.videoHeight;
        if (a === 0 || s === 0) {
          throw Error(`Video dimensions not available`);
        }
        if (a > 800 || s > 800) {
          if (a > s) {
            s = Math.round(s * 800 / a);
            a = 800;
          } else {
            a = Math.round(a * 800 / s);
            s = 800;
          }
        }
        n.width = a;
        n.height = s;
        i.drawImage(t, 0, 0, a, s);
        let c = n.toDataURL(`image/jpeg`, 0.8);
        let l = [...(o.allExtractedImages || []), c];
        r(e, {
          allExtractedImages: l,
          extractedImages: l
        });
        o.onShowToast?.(`已截取当前帧`);
      } catch (e) {
        console.error(`Manual capture failed:`, e);
        o.onShowToast?.(`截取失败，可能是跨域限制或视频未就绪`);
      }
    }
  };
  let j = async () => {
    let t = ``;
    if (c) {
      t = URL.createObjectURL(c);
    } else {
      let n = a();
      let r = i();
      let o = n.filter(t => {
        return t.target === e;
      });
      for (let e of o) {
        let n = r.find(t => {
          return t.id === e.source;
        });
        if (n) {
          if (n.data.videoUrl && typeof n.data.videoUrl == `string`) {
            let e = n.data.videoUrl;
            if (e.startsWith(`data:audio/`) || e.startsWith(`data:video/`) || /\.(mp3|wav|ogg|m4a|mp4|webm|mov)($|\?)/i.test(e)) {
              t = e;
              break;
            }
          }
          if (n.data.imageUrl && typeof n.data.imageUrl == `string`) {
            let e = n.data.imageUrl;
            if (e.startsWith(`data:video/`) || /\.(mp4|webm|mov|ogg)($|\?)/i.test(e)) {
              t = e;
              break;
            }
          }
          if (n.data.text && typeof n.data.text == `string`) {
            let e = n.data.text.match(/(https?:\/\/[^\s"'`<>]+)|(data:(audio|video)\/[^\s"']+)/i);
            if (e) {
              t = e[0];
              break;
            }
          }
        }
      }
    }
    if (!t) {
      o.onShowToast?.(`请先上传视频或连接包含视频的节点`);
      return;
    }
    r(e, {
      loading: true,
      errorMessage: undefined,
      progress: 0,
      extractedImages: []
    });
    try {
      let n = document.createElement(`video`);
      n.src = t;
      n.crossOrigin = `anonymous`;
      n.muted = true;
      n.playsInline = true;
      await new Promise((e, t) => {
        n.onloadedmetadata = e;
        n.onerror = t;
      });
      let i = n.duration;
      if (!i || isNaN(i) || i === Infinity) {
        throw Error(`无法获取视频时长`);
      }
      let a = document.createElement(`canvas`);
      let s = a.getContext(`2d`, {
        willReadFrequently: true
      });
      if (!s) {
        throw Error(`Canvas 2D ctx not supported`);
      }
      let c = n.videoWidth;
      let l = n.videoHeight;
      if (c > 800 || l > 800) {
        if (c > l) {
          l = Math.round(l * 800 / c);
          c = 800;
        } else {
          c = Math.round(c * 800 / l);
          l = 800;
        }
      }
      a.width = c;
      a.height = l;
      let u = async e => {
        return new Promise(t => {
          let r = () => {
            n.removeEventListener(`seeked`, r);
            s.drawImage(n, 0, 0, c, l);
            t(a.toDataURL(`image/jpeg`, 0.8));
          };
          n.addEventListener(`seeked`, r);
          n.currentTime = e;
        });
      };
      let d = [];
      if (f === `count`) {
        let e = Math.max(1, g);
        let t = i / (e + 1);
        for (let n = 1; n <= e; n++) {
          d.push(n * t);
        }
      } else if (f === `interval`) {
        let e = Math.max(0.5, m);
        for (let t = e; t < i; t += e) {
          d.push(t);
        }
      } else if (f === `first_last`) {
        d.push(0);
        d.push(Math.max(0, i - 0.1));
      } else if (f === `manual`) {
        o.onShowToast?.(`手动模式请直接在上方播放器中截取`);
        return;
      } else if (f === `smart`) {
        let t = document.createElement(`canvas`);
        t.width = 16;
        t.height = 16;
        let a = t.getContext(`2d`, {
          willReadFrequently: true
        });
        if (!a) {
          throw Error(`Canvas 2D ctx not supported`);
        }
        let o = async e => {
          return new Promise(t => {
            let r = () => {
              n.removeEventListener(`seeked`, r);
              a.drawImage(n, 0, 0, 16, 16);
              t(a.getImageData(0, 0, 16, 16).data);
            };
            n.addEventListener(`seeked`, r);
            n.currentTime = e;
          });
        };
        let s = null;
        let c = (0.01 + ((100 - v) / 100) ** 2 * 0.24) * 195840;
        for (let t = 0.5; t < i; t += 0.5) {
          r(e, {
            progress: Math.round(t / i * 50)
          });
          let n = await o(t);
          if (s) {
            let e = 0;
            for (let t = 0; t < n.length; t += 4) {
              e += Math.abs(n[t] - s[t]);
              e += Math.abs(n[t + 1] - s[t + 1]);
              e += Math.abs(n[t + 2] - s[t + 2]);
            }
            if (e > c) {
              d.push(t);
              t += 1;
              s = await o(t);
              continue;
            }
          }
          s = n;
        }
      }
      if (d.length === 0 && f === `smart`) {
        d.push(i / 2);
      }
      let p = [];
      for (let t = 0; t < d.length; t++) {
        r(e, {
          progress: 50 + Math.round(t / d.length * 50)
        });
        let n = await u(d[t]);
        p.push(n);
        r(e, {
          extractedImages: [...p]
        });
      }
      r(e, {
        loading: false,
        progress: 100,
        allExtractedImages: p,
        extractedImages: p,
        hiddenIndices: [],
        imageUrl: undefined
      });
      o.onShowToast?.(`抽帧完成！共提取 ${p.length} 张图片`);
      n.src = ``;
      n.load();
    } catch (t) {
      console.error(`Frame extraction failed:`, t);
      r(e, {
        loading: false,
        errorMessage: t.message || `抽帧失败，可能是视频格式或跨域限制`
      });
    }
  };
  let M = async e => {
    e.stopPropagation();
    if (!o.extractedImages || o.extractedImages.length === 0) {
      o.onShowToast?.(`没有提取出的图片可复制`);
      return;
    }
    try {
      let e = {
        type: `mutiwindow-images`,
        images: o.extractedImages
      };
      let t = JSON.stringify(e);
      try {
        await navigator.clipboard.writeText(t);
      } catch {
        localStorage.setItem(`mutiwindow-clipboard`, t);
      }
      o.onShowToast?.(`已复制 ${o.extractedImages.length} 张图片`);
    } catch {
      o.onShowToast?.(`复制失败`);
    }
  };
  const Component1403 = `input`;
  const Component1404 = `button`;
  const Component1405 = `span`;
  const Component1406 = `div`;
  const Component1407 = `video`;
  const Component1408 = `button`;
  const Component1409 = `input`;
  const Component1410 = `button`;
  const Component1411 = `button`;
  const Component1412 = `div`;
  const Component1413 = `div`;
  const Component1414 = `span`;
  const Component1415 = `div`;
  const Component1416 = `img`;
  const Component1417 = `button`;
  const Component1418 = `div`;
  const Component1419 = `div`;
  const Component1420 = `div`;
  const Component1421 = `div`;
  const Component1422 = `span`;
  const Component1423 = `div`;
  const Component1424 = `div`;
  const Component1425 = `div`;
  const Component1426 = `span`;
  const Component1427 = `div`;
  const Component1428 = `div`;
  const Component1429 = `span`;
  const Component1430 = `div`;
  const Component1431 = `button`;
  const Component1432 = `div`;
  const Component1433 = `div`;
  const Component1434 = `span`;
  const Component1435 = `div`;
  const Component1436 = `label`;
  const Component1437 = `option`;
  const Component1438 = `option`;
  const Component1439 = `option`;
  const Component1440 = `option`;
  const Component1441 = `option`;
  const Component1442 = `select`;
  const Component1443 = `div`;
  const Component1444 = `label`;
  const Component1445 = `input`;
  const Component1446 = `div`;
  const Component1447 = `label`;
  const Component1448 = `input`;
  const Component1449 = `div`;
  const Component1450 = `label`;
  const Component1451 = `span`;
  const Component1452 = `div`;
  const Component1453 = `input`;
  const Component1454 = `span`;
  const Component1455 = `div`;
  const Component1456 = `div`;
  const Component1457 = `span`;
  const Component1458 = `button`;
  const Component1459 = `button`;
  const Component1460 = `div`;
  const Component1461 = `div`;
  const Component1462 = `div`;
  const Component1463 = `div`;
  const Component1464 = `div`;
  return <Component1464 className={`relative group/node w-full h-full min-w-[280px] ${f === `manual` ? `min-h-[380px]` : `min-h-[220px]`}`}>
      <_cmp__Component8 id={e} data={t} defaultTitle={`视频抽帧`} icon={<Le size={11} className={`text-gray-500`} />} />
      <_cmp__Component9 visible={!!n} minWidth={280} minHeight={f === `manual` ? 380 : 220} />
      <Component1463 className={`w-full h-full bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 flex flex-col ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}>
        <_cmp__Component12 type={`target`} position={X.Left} />
        <Component1403 type={`file`} ref={s} style={{
        display: `none`
      }} accept={`video/*`} onChange={k} />
        <Component1462 className={`flex-1 flex flex-col overflow-hidden relative`}>
          <Component1428 className={`flex-1 bg-[#111] p-4 overflow-y-auto relative border-b border-[#2a2a2a] custom-scrollbar nowheel nopan nodrag flex flex-col gap-4`}>
            {o.allExtractedImages && o.allExtractedImages.length > 0 && <Component1404 onClick={e => {
            return M(e);
          }} className={`absolute top-2 right-2 z-10 text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 px-2 py-1 rounded bg-[#222]/90 hover:bg-[#333] transition-colors`}>
                <_Component7 size={12} />
                {` 复制全部`}
              </Component1404>}
            {o.errorMessage && <Component1406 className={`flex flex-col items-center justify-center h-full gap-2 text-red-400 p-4 text-center`}>
                <_Component17 size={24} />
                <Component1405 className={`text-xs break-words`}>{o.errorMessage}</Component1405>
              </Component1406>}
            {f === `manual` && o.videoUrl && !o.errorMessage && <Component1413 className={`flex flex-col gap-3 bg-[#1a1a1a] p-3 rounded-lg border border-[#333] flex-shrink-0`}>
                <Component1407 ref={x} src={o.videoUrl} crossOrigin={`anonymous`} className={`w-full aspect-video bg-black rounded`} onLoadedMetadata={e => {
              return C(e.currentTarget.duration);
            }} onTimeUpdate={e => {
              return T(e.currentTarget.currentTime);
            }} playsInline={true} muted={true} />
                <Component1412 className={`flex items-center gap-2 text-xs`}>
                  <Component1408 onClick={() => {
                if (x.current) {
                  x.current.currentTime = Math.max(0, x.current.currentTime - 0.033);
                }
              }} className={`px-2 py-1.5 bg-[#2a2a2a] rounded-md hover:bg-[#333] text-gray-300 transition-colors`} title={`后退1帧`}>{`-1帧`}</Component1408>
                  <Component1409 type={`range`} min={`0`} max={S || 100} step={`0.01`} value={w} onChange={e => {
                if (x.current) {
                  x.current.currentTime = Number(e.target.value);
                }
              }} className={`flex-1 accent-white min-w-0`} />
                  <Component1410 onClick={() => {
                if (x.current) {
                  x.current.currentTime = Math.min(S, x.current.currentTime + 0.033);
                }
              }} className={`px-2 py-1.5 bg-[#2a2a2a] rounded-md hover:bg-[#333] text-gray-300 transition-colors`} title={`前进1帧`}>{`+1帧`}</Component1410>
                  <Component1411 onClick={A} className={`px-4 py-1.5 bg-white hover:bg-gray-200 rounded-md text-black font-medium ml-2 flex-shrink-0 flex items-center gap-1.5 shadow-sm transition-colors`}>
                    <_Component2 size={14} />
                    {`截取`}
                  </Component1411>
                </Component1412>
              </Component1413>}
            {!o.errorMessage && o.allExtractedImages && o.allExtractedImages.length > 0 ? <Component1421 className={`flex flex-col h-full gap-3`}>
                <Component1415 className={`flex justify-between items-center px-1`}>
                  <Component1414 className={`text-xs text-gray-400 font-medium`}>
                    {`已提取 `}
                    {o.allExtractedImages.length}
                    {` 帧 (当前生效 `}
                    {o.extractedImages?.length || 0}
                    {` 帧)`}
                  </Component1414>
                </Component1415>
                <Component1420 className={`grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3 auto-rows-max`}>
                  {o.allExtractedImages.map((e, t) => {
                if (b.includes(t)) {
                  return null;
                } else {
                  return <Component1419 className={`aspect-video bg-black rounded-lg border relative group/img border-[#333] overflow-hidden`} key={t}>
                          <Component1416 src={e} loading={`lazy`} decoding={`async`} className={`w-full h-full object-cover`} />
                          <Component1418 className={`absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-3`}>
                            <Component1417 onClick={t => {
                        t.stopPropagation();
                        try {
                          let t = JSON.stringify({
                            type: `mutiwindow-images`,
                            images: [e]
                          });
                          try {
                            navigator.clipboard.writeText(t);
                          } catch {
                            localStorage.setItem(`mutiwindow-clipboard`, t);
                          }
                          o.onShowToast?.(`已复制当前帧，请在空白处粘贴 (Ctrl+V)`);
                        } catch {
                          o.onShowToast?.(`复制失败`);
                        }
                      }} className={`p-2 bg-[#222] hover:bg-white rounded-full text-gray-300 hover:text-black transition-all shadow-lg`} title={`复制为新节点 (Ctrl+V粘贴)`}>
                              <_Component7 size={16} />
                            </Component1417>
                          </Component1418>
                        </Component1419>;
                }
              })}
                </Component1420>
              </Component1421> : !o.errorMessage && (f !== `manual` || !o.videoUrl) ? <Component1427 className={`flex items-center justify-center h-full min-h-[120px]`}>
                {o.loading ? <Component1425 className={`flex flex-col items-center gap-3`}>
                    <_Component25 size={24} className={`animate-spin text-gray-400`} />
                    <Component1422 className={`text-xs text-gray-400`}>
                      {`正在处理... `}
                      {o.progress}
                      {`%`}
                    </Component1422>
                    <Component1424 className={`w-32 h-1 bg-[#333] rounded-full overflow-hidden`}>
                      <Component1423 className={`h-full bg-white transition-all duration-300`} style={{
                  width: `${o.progress}%`
                }} />
                    </Component1424>
                  </Component1425> : <Component1426 className={`text-xs text-gray-500`}>{`等待提取`}</Component1426>}
              </Component1427> : null}
          </Component1428>
          <Component1461 className={`p-4 bg-[#1a1a1a] flex flex-col gap-4 nodrag border-t border-[#2a2a2a]`}>
            {o.videoUrl ? <Component1432 className={`w-full flex items-center justify-between bg-[#111] rounded-lg px-3 py-2.5 border border-[#333]`}>
                <Component1430 className={`flex items-center gap-2 overflow-hidden`}>
                  <_Component13 size={16} className={`text-gray-400 flex-shrink-0`} />
                  <Component1429 className={`text-xs text-gray-300 truncate`} title={o.videoName}>
                    {o.videoName || `已连接视频`}
                  </Component1429>
                </Component1430>
                <Component1431 onClick={() => {
              return s.current?.click();
            }} className={`text-xs text-gray-400 hover:text-white flex-shrink-0 ml-2 px-3 py-1.5 bg-[#222] rounded-md hover:bg-[#333] transition-colors`}>{`替换视频`}</Component1431>
              </Component1432> : <Component1435 onClick={() => {
            return s.current?.click();
          }} className={`w-full py-6 rounded-xl border-2 border-dashed border-[#333] bg-[#111] hover:bg-[#1a1a1a] hover:border-[#555] flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors`}>
                <Component1433 className={`p-3 bg-[#222] rounded-full`}>
                  <_Component0 size={18} className={`text-gray-400`} />
                </Component1433>
                <Component1434 className={`text-xs text-gray-400 font-medium`}>{`点击上传视频或连接节点`}</Component1434>
              </Component1435>}
            {u && <Component1456 className={`flex flex-col gap-4 bg-[#111] border border-[#333] rounded-lg p-4 mt-1`}>
                <Component1443 className={`flex flex-col gap-2`}>
                  <Component1436 className={`text-[11px] text-gray-400 font-medium`}>{`抽帧模式`}</Component1436>
                  <Component1442 value={f} onChange={e => {
                return p(e.target.value);
              }} className={`w-full bg-[#222] border border-[#333] rounded-md px-3 py-2 text-xs text-gray-200 outline-none focus:border-white transition-colors`}>
                    <Component1437 value={`count`}>{`固定数量 (均匀分布)`}</Component1437>
                    <Component1438 value={`interval`}>{`等距抽帧 (间隔秒数)`}</Component1438>
                    <Component1439 value={`smart`}>{`智能转场检测`}</Component1439>
                    <Component1440 value={`first_last`}>{`首尾帧 (第一帧和最后一帧)`}</Component1440>
                    <Component1441 value={`manual`}>{`手动截取 (拖动轨道截取)`}</Component1441>
                  </Component1442>
                </Component1443>
                {f === `count` && <Component1446 className={`flex flex-col gap-2`}>
                    <Component1444 className={`text-[11px] text-gray-400 font-medium`}>{`提取总张数`}</Component1444>
                    <Component1445 type={`number`} min={`1`} max={`100`} value={g} onChange={e => {
                return _(Number(e.target.value));
              }} className={`w-full bg-[#222] border border-[#333] rounded-md px-3 py-2 text-xs text-gray-200 outline-none focus:border-white transition-colors`} />
                  </Component1446>}
                {f === `interval` && <Component1449 className={`flex flex-col gap-2`}>
                    <Component1447 className={`text-[11px] text-gray-400 font-medium`}>{`间隔秒数 (秒)`}</Component1447>
                    <Component1448 type={`number`} min={`0.5`} max={`3600`} step={`0.5`} value={m} onChange={e => {
                return h(Number(e.target.value));
              }} className={`w-full bg-[#222] border border-[#333] rounded-md px-3 py-2 text-xs text-gray-200 outline-none focus:border-white transition-colors`} />
                  </Component1449>}
                {f === `smart` && <Component1455 className={`flex flex-col gap-2`}>
                    <Component1452 className={`flex justify-between`}>
                      <Component1450 className={`text-[11px] text-gray-400 font-medium`}>{`检测敏感度`}</Component1450>
                      <Component1451 className={`text-[11px] text-gray-500`}>{v}</Component1451>
                    </Component1452>
                    <Component1453 type={`range`} min={`1`} max={`100`} value={v} onChange={e => {
                return y(Number(e.target.value));
              }} className={`w-full accent-white`} />
                    <Component1454 className={`text-[10px] text-gray-500`}>{`数值越高越容易触发截图`}</Component1454>
                  </Component1455>}
              </Component1456>}
            <Component1460 className={`flex justify-between items-center mt-1`}>
              <Component1458 className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${u ? `text-white bg-[#333]` : `text-gray-400 hover:bg-[#333] hover:text-white`}`} onClick={() => {
              return d(!u);
            }} title={`参数配置`}>
                <K size={14} />
                <Component1457 className={`text-xs font-medium`}>
                  {u ? `收起配置` : `配置`}
                </Component1457>
              </Component1458>
              {f !== `manual` && <Component1459 className={`px-5 py-2 rounded-full text-xs font-medium flex items-center gap-2 transition-all ${!o.videoUrl || o.loading ? `bg-[#2a2a2a] text-gray-500 cursor-not-allowed` : `bg-white text-black hover:bg-gray-200 shadow-md`}`} onClick={e => {
              e.stopPropagation();
              if (o.videoUrl && !o.loading) {
                j();
              } else if (!o.videoUrl) {
                o.onShowToast?.(`请先上传或连接视频`);
              }
            }}>
                  {o.loading ? `正在处理...` : `开始处理`}
                  <_Component2 size={14} />
                </Component1459>}
            </Component1460>
          </Component1461>
        </Component1462>
        <_cmp__Component12 type={`source`} position={X.Right} id={`main-output`} />
      </Component1463>
    </Component1464>;
});
export default ec;