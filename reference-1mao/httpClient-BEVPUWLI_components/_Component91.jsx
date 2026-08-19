// TODO(全局, 无需 import): isOpen, onClose, title, defaultTab, defaultMediaType, transitResources, canvasNodes, onSelect, onImportToCanvas, r, i, u, f, m, o, n, url, encodeURIComponent, type, name, l, g, timestamp, p, s, project, generated, materials, upload, image, video, text, audio, v, decodeURIComponent
import { t, Ua, id, Wa, d, a, p_, c, Fn, h, _, y, Gt, _Component8, _Component2, _Component5, _Component3 } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
export default function _Component91({
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
        let n = Ua(t);
        if (n && !/^https?:\/\/[^\s]+$/.test(n)) {
          e.push({
            id: `canvas-${t.id}-text`,
            url: `data:text/plain;charset=utf-8,${encodeURIComponent(n)}`,
            type: `text`,
            name: t.data?.label || `文本节点`
          });
        }
      }
      let n = Wa(t);
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
          type: p_(e.type || ``, e.url),
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
          type: p_(e.type || ``, e.url),
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
    const Component2395 = `div`;
    const Component2396 = `button`;
    const Component2397 = `div`;
    const Component2398 = `button`;
    const Component2399 = `div`;
    const Component2400 = `button`;
    const Component2401 = `div`;
    const Component2402 = `button`;
    const Component2403 = `div`;
    const Component2404 = `div`;
    const Component2405 = `div`;
    const Component2406 = `input`;
    const Component2407 = `div`;
    const Component2408 = `div`;
    const Component2409 = `div`;
    const Component2410 = `div`;
    const Component2411 = `div`;
    const Component2412 = `img`;
    const Component2413 = `video`;
    const Component2414 = `span`;
    const Component2415 = `div`;
    const Component2416 = `div`;
    const Component2417 = `div`;
    const Component2418 = `div`;
    const Component2419 = `div`;
    const Component2420 = `button`;
    const Component2421 = `div`;
    const Component2422 = `div`;
    const Component2423 = `div`;
    const Component2424 = `div`;
    const Component2425 = `div`;
    const Component2426 = `div`;
    return Fn.createPortal(<Component2426 className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm`} onClick={t}>
        <Component2425 className={`bg-[#1e1e1e] border border-[#333] rounded-xl shadow-2xl w-[900px] max-w-[92vw] h-[76vh] flex flex-col overflow-hidden`} onClick={e => {
        return e.stopPropagation();
      }}>
          <Component2397 className={`flex items-center justify-between px-4 py-3 border-b border-[#333]`}>
            <Component2395 className={`text-sm font-medium text-gray-200`}>{n}</Component2395>
            <Component2396 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-lg transition-colors`} onClick={t}>
              <Gt size={16} />
            </Component2396>
          </Component2397>
          <Component2405 className={`px-4 py-3 flex items-center justify-between gap-6 border-b border-[#333] bg-[#1a1a1a]`}>
            <Component2399 className={`flex items-center gap-6`}>
              {[`project`, `generated`, `materials`, `upload`].map(e => {
              return <Component2398 className={`text-sm pb-1 border-b-2 transition-colors ${l === e ? `border-white text-white font-medium` : `border-transparent text-gray-400 hover:text-gray-200`}`} onClick={() => {
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
                  </Component2398>;
            })}
            </Component2399>
            <Component2404 className={`flex items-center gap-3`}>
              {l === `materials` && <Component2401 className={`flex items-center gap-0.5 rounded-md bg-[#262626] p-0.5`}>
                  {[`all`, `人物`, `场景`, `道具`].map(e => {
                return <Component2400 className={`px-2.5 py-1 text-xs rounded ${p === e ? `bg-white text-gray-950` : `text-gray-400 hover:text-white`}`} onClick={() => {
                  return m(e);
                }} key={e}>
                        {e === `all` ? `全部` : e}
                      </Component2400>;
              })}
                </Component2401>}
              <Component2403 className={`${l === `materials` ? `border-l border-[#3a3a3a] pl-3` : ``} flex items-center gap-1`}>
                {[`image`, `video`, `text`, `audio`].map(e => {
                return <Component2402 className={`px-3 py-1 text-xs rounded-full transition-colors ${d === e ? `bg-[#333] text-white` : `bg-transparent text-gray-400 hover:bg-[#2a2a2a]`}`} onClick={() => {
                  return f(e);
                }} key={e}>
                      {{
                    image: `图片`,
                    video: `视频`,
                    text: `文本`,
                    audio: `音频`
                  }[e]}
                    </Component2402>;
              })}
              </Component2403>
            </Component2404>
          </Component2405>
          <Component2424 className={`flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#141414]`}>
            <Component2406 type={`file`} ref={h} className={`hidden`} accept={d === `image` ? `image/*` : d === `video` ? `video/*` : d === `audio` ? `audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac` : `text/plain,.txt,.md,.json`} onChange={v} />
            {l === `upload` ? <Component2409 className={`flex flex-col items-center justify-center h-48 border-2 border-dashed border-[#333] rounded-xl hover:border-[#555] hover:bg-[#1a1a1a] transition-colors cursor-pointer`} onClick={() => {
            return h.current?.click();
          }}>
                <_Component8 size={32} className={`text-gray-500 mb-3`} />
                <Component2407 className={`text-sm text-gray-300 mb-1`}>{`点击选择文件`}</Component2407>
                <Component2408 className={`text-xs text-gray-500`}>
                  {d === `image` ? `支持 JPG / PNG / WEBP 等图片` : d === `video` ? `支持 MP4 / WEBM / MOV 等视频` : d === `audio` ? `支持 MP3 / WAV / OGG / M4A / FLAC 等音频` : `支持 TXT / MD / JSON 等文本`}
                </Component2408>
              </Component2409> : _.length === 0 ? <Component2411 className={`flex flex-col items-center justify-center h-48 text-gray-500`}>
                <_Component2 size={32} className={`mb-2 opacity-50`} />
                <Component2410 className={`text-xs`}>
                  {`暂无`}
                  {d === `image` ? `图片` : d === `video` ? `视频` : d === `audio` ? `音频` : `文本`}
                  {`内容`}
                </Component2410>
              </Component2411> : <Component2423 className={`grid grid-cols-4 gap-3`}>
                {_.map(e => {
              return <Component2422 className={`group relative aspect-square bg-[#222] border border-[#333] rounded-lg overflow-hidden cursor-pointer hover:border-gray-400 transition-colors`} onClick={() => {
                return y(e);
              }} key={e.id}>
                      {e.type === `image` ? <Component2412 src={e.url} alt={e.name} className={`w-full h-full object-cover`} /> : e.type === `video` ? <Component2413 src={e.url} className={`w-full h-full object-cover bg-black`} controls={true} preload={`metadata`} onClick={e => {
                  return e.stopPropagation();
                }} /> : e.type === `audio` ? <Component2415 className={`w-full h-full flex flex-col items-center justify-center bg-black/50 text-gray-400`}>
                          <_Component5 size={24} className={`mb-2`} />
                          <Component2414 className={`text-[10px] px-2 truncate w-full text-center`}>
                            {e.name}
                          </Component2414>
                        </Component2415> : <Component2418 className={`w-full h-full p-2 bg-[#2a2a2a] text-gray-300 text-[10px] break-all overflow-hidden relative`}>
                          <_Component3 size={16} className={`text-gray-500 mb-1`} />
                          <Component2416 className={`line-clamp-4`}>
                            {decodeURIComponent(e.url.replace(`data:text/plain;charset=utf-8,`, ``))}
                          </Component2416>
                          <Component2417 className={`absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#2a2a2a] to-transparent`} />
                        </Component2418>}
                      <Component2421 className={`absolute inset-x-0 bottom-0 flex items-center gap-2 p-2 bg-black/75 translate-y-full group-hover:translate-y-0 transition-transform`}>
                        <Component2419 className={`min-w-0 flex-1 text-[10px] text-white truncate`}>
                          {e.name}
                        </Component2419>
                        <Component2420 className={`shrink-0 rounded bg-white px-2.5 py-1 text-[10px] font-medium text-gray-950 hover:bg-gray-200`} onClick={t => {
                    t.stopPropagation();
                    y(e);
                  }}>{`导入`}</Component2420>
                      </Component2421>
                    </Component2422>;
            })}
              </Component2423>}
          </Component2424>
        </Component2425>
      </Component2426>, document.body);
  } else {
    return null;
  }
}