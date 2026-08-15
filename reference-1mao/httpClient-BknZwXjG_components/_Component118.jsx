// TODO(全局, 无需 import): isOpen, onClose, title, defaultTab, defaultMediaType, transitResources, canvasNodes, onSelect, onImportToCanvas, r, i, u, f, m, o, n, url, encodeURIComponent, type, name, l, g, timestamp, p, s, project, generated, materials, upload, image, video, text, audio, v, decodeURIComponent
import { t, Ia, id, La, d, a, Kg, c, Fn, h, _, y, Gt, _Component0, _Component2, _Component5, _Component3 } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
export default function _Component118({
  isOpen: e,
  onClose: t,
  title: n = `导入资源`,
  defaultTab: r = `project`,
  defaultMediaType: i = `image`,
  transitResources: a,
  canvasNodes: o = [],
  onSelect: s,
  onImportToCanvas: c
}) {
  let [l, u] = Z.useState(r);
  let [d, f] = Z.useState(i);
  let [p, m] = Z.useState(`all`);
  let h = Z.useRef(null);
  Z.useEffect(() => {
    if (e) {
      u(r);
      f(i);
      m(`all`);
    }
  }, [e, r, i]);
  let g = Z.useMemo(() => {
    let e = [];
    o.forEach(t => {
      if (t.type === `textNode`) {
        let n = Ia(t);
        if (n && !/^https?:\/\/[^\s]+$/.test(n)) {
          e.push({
            id: `canvas-${t.id}-text`,
            url: `data:text/plain;charset=utf-8,${encodeURIComponent(n)}`,
            type: `text`,
            name: t.data?.label || `文本节点`
          });
        }
      }
      let n = La(t);
      n.images.forEach((n, r) => {
        return e.push({
          id: `canvas-${t.id}-img-${r}`,
          url: n,
          type: `image`,
          name: t.data?.label || `图片产物 ${r + 1}`
        });
      });
      n.videos.forEach((n, r) => {
        return e.push({
          id: `canvas-${t.id}-vid-${r}`,
          url: n,
          type: `video`,
          name: t.data?.label || `视频产物 ${r + 1}`
        });
      });
      n.audios.forEach((n, r) => {
        return e.push({
          id: `canvas-${t.id}-aud-${r}`,
          url: n,
          type: `audio`,
          name: t.data?.label || `音频产物 ${r + 1}`
        });
      });
    });
    return e;
  }, [o]);
  let _ = Z.useMemo(() => {
    let e = [];
    if (l === `project`) {
      e = g.filter(e => {
        return e.type === d;
      });
    } else if (l === `generated`) {
      e = a.filter(e => {
        return e.type !== `folder` && !!e.url;
      }).filter(e => {
        let t = (e.folder || ``).trim().replace(/^[/\\]+|[/\\]+$/g, ``);
        return t.startsWith(`tasks`) || t === `tasks`;
      }).map(e => {
        return {
          id: e.id,
          url: e.url,
          type: Kg(e.type || ``, e.url),
          name: e.pageTitle || e.name || `生成内容`,
          timestamp: e.timestamp
        };
      }).filter(e => {
        return e.type === d;
      });
    } else if (l === `materials`) {
      e = a.filter(e => {
        return e.type !== `folder` && !!e.url;
      }).filter(e => {
        let t = (e.folder || ``).trim().replace(/^[/\\]+|[/\\]+$/g, ``);
        return (t.startsWith(`materials`) || t.startsWith(`migrated`) || t === `migrated`) && (p === `all` || t.split(/[/\\]/).includes(p));
      }).map(e => {
        return {
          id: e.id,
          url: e.url,
          type: Kg(e.type || ``, e.url),
          name: e.pageTitle || e.name || `素材`,
          timestamp: e.timestamp
        };
      }).filter(e => {
        return e.type === d;
      });
    }
    e.sort((e, t) => {
      return (t.timestamp || 0) - (e.timestamp || 0);
    });
    return e;
  }, [l, d, p, g, a]);
  let v = e => {
    let n = e.target.files?.[0];
    if (!n) {
      return;
    }
    let r = new FileReader();
    r.onload = () => {
      let e = r.result;
      let i = `image`;
      if (n.type.startsWith(`video/`)) {
        i = `video`;
      } else if (n.type.startsWith(`audio/`)) {
        i = `audio`;
      } else if (n.type.startsWith(`text/`)) {
        i = `text`;
      }
      if (s) {
        s(e, i, n.name);
      } else if (c) {
        c({
          url: e,
          type: i,
          name: n.name
        });
      }
      t();
    };
    r.readAsDataURL(n);
    e.target.value = ``;
  };
  let y = e => {
    if (s) {
      s(e.url, e.type, e.name);
    } else if (c) {
      c({
        url: e.url,
        type: e.type,
        name: e.name
      });
    }
    t();
  };
  if (e) {
    const Component2373 = `div`;
    const Component2374 = `button`;
    const Component2375 = `div`;
    const Component2376 = `button`;
    const Component2377 = `div`;
    const Component2378 = `button`;
    const Component2379 = `div`;
    const Component2380 = `button`;
    const Component2381 = `div`;
    const Component2382 = `div`;
    const Component2383 = `div`;
    const Component2384 = `input`;
    const Component2385 = `div`;
    const Component2386 = `div`;
    const Component2387 = `div`;
    const Component2388 = `div`;
    const Component2389 = `div`;
    const Component2390 = `img`;
    const Component2391 = `video`;
    const Component2392 = `span`;
    const Component2393 = `div`;
    const Component2394 = `div`;
    const Component2395 = `div`;
    const Component2396 = `div`;
    const Component2397 = `div`;
    const Component2398 = `button`;
    const Component2399 = `div`;
    const Component2400 = `div`;
    const Component2401 = `div`;
    const Component2402 = `div`;
    const Component2403 = `div`;
    const Component2404 = `div`;
    return Fn.createPortal(<Component2404 className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm`} onClick={t}>
        <Component2403 className={`bg-[#1e1e1e] border border-[#333] rounded-xl shadow-2xl w-[900px] max-w-[92vw] h-[76vh] flex flex-col overflow-hidden`} onClick={e => {
        return e.stopPropagation();
      }}>
          <Component2375 className={`flex items-center justify-between px-4 py-3 border-b border-[#333]`}>
            <Component2373 className={`text-sm font-medium text-gray-200`}>{n}</Component2373>
            <Component2374 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-lg transition-colors`} onClick={t}>
              <Gt size={16} />
            </Component2374>
          </Component2375>
          <Component2383 className={`px-4 py-3 flex items-center justify-between gap-6 border-b border-[#333] bg-[#1a1a1a]`}>
            <Component2377 className={`flex items-center gap-6`}>
              {[`project`, `generated`, `materials`, `upload`].map(e => {
              return <Component2376 className={`text-sm pb-1 border-b-2 transition-colors ${l === e ? `border-white text-white font-medium` : `border-transparent text-gray-400 hover:text-gray-200`}`} onClick={() => {
                u(e);
                if (e === `upload`) {
                  h.current?.click();
                }
              }} key={e}>
                    {{
                  project: `本项目`,
                  generated: `生成`,
                  materials: `素材`,
                  upload: `上传`
                }[e]}
                  </Component2376>;
            })}
            </Component2377>
            <Component2382 className={`flex items-center gap-3`}>
              {l === `materials` && <Component2379 className={`flex items-center gap-0.5 rounded-md bg-[#262626] p-0.5`}>
                  {[`all`, `人物`, `场景`, `道具`].map(e => {
                return <Component2378 className={`px-2.5 py-1 text-xs rounded ${p === e ? `bg-white text-gray-950` : `text-gray-400 hover:text-white`}`} onClick={() => {
                  return m(e);
                }} key={e}>
                        {e === `all` ? `全部` : e}
                      </Component2378>;
              })}
                </Component2379>}
              <Component2381 className={`${l === `materials` ? `border-l border-[#3a3a3a] pl-3` : ``} flex items-center gap-1`}>
                {[`image`, `video`, `text`, `audio`].map(e => {
                return <Component2380 className={`px-3 py-1 text-xs rounded-full transition-colors ${d === e ? `bg-[#333] text-white` : `bg-transparent text-gray-400 hover:bg-[#2a2a2a]`}`} onClick={() => {
                  return f(e);
                }} key={e}>
                      {{
                    image: `图片`,
                    video: `视频`,
                    text: `文本`,
                    audio: `音频`
                  }[e]}
                    </Component2380>;
              })}
              </Component2381>
            </Component2382>
          </Component2383>
          <Component2402 className={`flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#141414]`}>
            <Component2384 type={`file`} ref={h} className={`hidden`} accept={`image/*,video/*,audio/*,text/plain`} onChange={v} />
            {l === `upload` ? <Component2387 className={`flex flex-col items-center justify-center h-48 border-2 border-dashed border-[#333] rounded-xl hover:border-[#555] hover:bg-[#1a1a1a] transition-colors cursor-pointer`} onClick={() => {
            return h.current?.click();
          }}>
                <_Component0 size={32} className={`text-gray-500 mb-3`} />
                <Component2385 className={`text-sm text-gray-300 mb-1`}>{`点击选择文件`}</Component2385>
                <Component2386 className={`text-xs text-gray-500`}>{`支持图片、视频、音频和文本`}</Component2386>
              </Component2387> : _.length === 0 ? <Component2389 className={`flex flex-col items-center justify-center h-48 text-gray-500`}>
                <_Component2 size={32} className={`mb-2 opacity-50`} />
                <Component2388 className={`text-xs`}>
                  {`暂无`}
                  {d === `image` ? `图片` : d === `video` ? `视频` : d === `audio` ? `音频` : `文本`}
                  {`内容`}
                </Component2388>
              </Component2389> : <Component2401 className={`grid grid-cols-4 gap-3`}>
                {_.map(e => {
              return <Component2400 className={`group relative aspect-square bg-[#222] border border-[#333] rounded-lg overflow-hidden cursor-pointer hover:border-gray-400 transition-colors`} onClick={() => {
                return y(e);
              }} key={e.id}>
                      {e.type === `image` ? <Component2390 src={e.url} alt={e.name} className={`w-full h-full object-cover`} /> : e.type === `video` ? <Component2391 src={e.url} className={`w-full h-full object-cover bg-black`} controls={true} preload={`metadata`} onClick={e => {
                  return e.stopPropagation();
                }} /> : e.type === `audio` ? <Component2393 className={`w-full h-full flex flex-col items-center justify-center bg-black/50 text-gray-400`}>
                          <_Component5 size={24} className={`mb-2`} />
                          <Component2392 className={`text-[10px] px-2 truncate w-full text-center`}>
                            {e.name}
                          </Component2392>
                        </Component2393> : <Component2396 className={`w-full h-full p-2 bg-[#2a2a2a] text-gray-300 text-[10px] break-all overflow-hidden relative`}>
                          <_Component3 size={16} className={`text-gray-500 mb-1`} />
                          <Component2394 className={`line-clamp-4`}>
                            {decodeURIComponent(e.url.replace(`data:text/plain;charset=utf-8,`, ``))}
                          </Component2394>
                          <Component2395 className={`absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#2a2a2a] to-transparent`} />
                        </Component2396>}
                      <Component2399 className={`absolute inset-x-0 bottom-0 flex items-center gap-2 p-2 bg-black/75 translate-y-full group-hover:translate-y-0 transition-transform`}>
                        <Component2397 className={`min-w-0 flex-1 text-[10px] text-white truncate`}>
                          {e.name}
                        </Component2397>
                        <Component2398 className={`shrink-0 rounded bg-white px-2.5 py-1 text-[10px] font-medium text-gray-950 hover:bg-gray-200`} onClick={t => {
                    t.stopPropagation();
                    y(e);
                  }}>{`导入`}</Component2398>
                      </Component2399>
                    </Component2400>;
            })}
              </Component2401>}
          </Component2402>
        </Component2403>
      </Component2404>, document.body);
  } else {
    return null;
  }
}