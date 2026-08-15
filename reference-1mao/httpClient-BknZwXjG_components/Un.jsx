// TODO(全局, 无需 import): active, transitItems, transitResources, transitTotal, transitTotalPages, transitLoading, transitPage, setTransitPage, transitGridCols, setTransitGridCols, transitTabFilter, setTransitTabFilter, transitFilter, setTransitFilter, transitSourceFilter, setTransitSourceFilter, currentFolder, setCurrentFolder, creatingFolder, setCreatingFolder, newFolderName, setNewFolderName, localTool, showToastMessage, handleSyncLocal, handleToggleFavorite, handleClearResources, handleDeleteResource, handleSendToActiveTab, handleCopyResource, setFullscreenResource, openResourceMenu, setOpenResourceMenu, detail, u, s, g, f, p, m, l, x, encodeURIComponent, gridTemplateColumns, v, b, n, r, i, url, type, ee, decodeURIComponent, method, k, left, transform, confirm, o
import _cmp_Vn from "./Vn.jsx";
import _cmp_Bn from "./Bn.jsx";
import { t, e, Hn, d, _, h, c, S, y, C, Mn, w, P, I, j, O, D, N, id, M, Fn, T, a, E, _Component2, Pt, _Component3, G, F, _Component4, _Component5, Te, At, Pe, _Component6, _Component7, U, Bt, A } from "./shared.js";
import * as Q from "react";
export default function Un({
  active: e,
  transitItems: t,
  transitResources: n,
  transitTotal: r,
  transitTotalPages: i,
  transitLoading: a,
  transitPage: o,
  setTransitPage: s,
  transitGridCols: c,
  setTransitGridCols: l,
  transitTabFilter: u,
  setTransitTabFilter: d,
  transitFilter: f,
  setTransitFilter: p,
  transitSourceFilter: m,
  setTransitSourceFilter: h,
  currentFolder: g,
  setCurrentFolder: _,
  creatingFolder: v,
  setCreatingFolder: y,
  newFolderName: b,
  setNewFolderName: x,
  localTool: S,
  showToastMessage: C,
  handleSyncLocal: w,
  handleToggleFavorite: T,
  handleClearResources: E,
  handleDeleteResource: D,
  handleSendToActiveTab: O,
  handleCopyResource: k,
  setFullscreenResource: j,
  openResourceMenu: M,
  setOpenResourceMenu: N
}) {
  if (!e) {
    return null;
  }
  let P = t.filter(e => {
    return e.type !== `folder` || !e.name || !e.name.startsWith(`_`);
  });
  let I = e => {
    return e.type === `audio` || e.type?.startsWith(`audio`) || /\.(flac|mp3|wav|ogg|m4a|aac|opus|wma|aiff)(\?|$)/i.test(e.url || ``);
  };
  let ee = e => {
    window.dispatchEvent(new CustomEvent(Hn, {
      detail: e
    }));
  };
  const Component5 = `button`;
  const Component6 = `button`;
  const Component7 = `div`;
  const Component8 = `span`;
  const Component9 = `button`;
  const Component10 = `button`;
  const Component11 = `button`;
  const Component12 = `button`;
  const Component13 = `button`;
  const Component14 = `div`;
  const Component15 = `button`;
  const Component16 = `div`;
  const Component17 = `div`;
  const Component18 = `span`;
  const Component19 = `input`;
  const Component20 = `div`;
  const Component21 = `span`;
  const Component22 = `button`;
  const Component23 = `button`;
  const Component24 = `div`;
  const Component25 = `div`;
  const Component26 = `div`;
  const Component27 = `div`;
  const Component28 = `p`;
  const Component29 = `br`;
  const Component30 = `p`;
  const Component31 = `div`;
  const Component32 = `input`;
  const Component33 = `div`;
  const Component34 = `div`;
  const Component35 = `div`;
  const Component45 = `span`;
  const Component46 = `div`;
  const Component47 = `video`;
  const Component48 = `polygon`;
  const Component49 = `svg`;
  const Component50 = `div`;
  const Component51 = `div`;
  const Component52 = `div`;
  const Component53 = `div`;
  const Component54 = `audio`;
  const Component55 = `div`;
  const Component56 = `div`;
  const Component57 = `img`;
  const Component58 = `button`;
  const Component59 = `button`;
  const Component60 = `button`;
  const Component61 = `button`;
  const Component62 = `button`;
  const Component63 = `button`;
  const Component64 = `div`;
  const Component65 = `button`;
  const Component66 = `div`;
  const Component67 = `button`;
  const Component68 = `button`;
  const Component69 = `button`;
  const Component70 = `button`;
  const Component71 = `button`;
  const Component72 = `button`;
  const Component73 = `div`;
  const Component74 = `div`;
  const Component75 = `button`;
  const Component76 = `button`;
  const Component77 = `div`;
  const Component78 = `span`;
  const Component79 = `div`;
  const Component80 = `div`;
  const Component81 = `div`;
  const Component82 = `div`;
  const Component83 = `div`;
  const Component84 = `div`;
  const Component85 = `div`;
  const Component86 = `div`;
  const Component87 = `div`;
  const Component93 = `button`;
  const Component94 = `div`;
  const Component95 = `div`;
  return <Component95 className={`absolute inset-0 flex flex-col bg-[#0d0c0c] visible z-10`}>
      <Component26 className={`p-3 bg-[#0d0c0c] flex justify-between items-center gap-4`}>
        <Component16 className={`flex items-center gap-2`}>
          <Component7 className={`flex bg-[#151414] rounded-full p-1 items-center mr-2 border border-[#333]`}>
            <Component5 className={`px-5 py-1.5 text-sm font-medium rounded-full transition-colors ${u === `generated` ? `bg-white text-black` : `text-gray-400 hover:text-gray-200`}`} onClick={() => {
            d(`generated`);
            _(``);
            s(1);
          }}>{`生成`}</Component5>
            <Component6 className={`px-5 py-1.5 text-sm font-medium rounded-full transition-colors ${u === `materials` ? `bg-white text-black` : `text-gray-400 hover:text-gray-200`}`} onClick={() => {
            d(`materials`);
            _(``);
            s(1);
          }}>{`素材`}</Component6>
          </Component7>
          {g && <Component9 onClick={() => {
          let e = g.split(`/`);
          e.pop();
          _(e.join(`/`));
          s(1);
        }} className={`flex items-center gap-1 bg-[#222] hover:bg-[#333] text-gray-300 hover:text-white px-3 py-1.5 rounded-lg font-bold transition-colors mr-2`}>
              <Component8 className={`text-xl mb-0.5 leading-none`}>{`‹`}</Component8>
              {g.split(`/`).pop()}
            </Component9>}
          <Component14 className={`flex bg-[#1a1a1a] rounded-lg p-1 items-center`}>
            <Component10 className={`px-3 py-1 text-xs rounded-md transition-colors flex items-center justify-center ${f === `all` ? `bg-[#333] text-white font-bold` : `text-gray-400 hover:text-gray-200`}`} onClick={() => {
            p(`all`);
            s(1);
          }}>{`全部`}</Component10>
            <Component11 className={`px-3 py-1 text-xs rounded-md transition-colors flex items-center justify-center ${f === `image` ? `bg-[#333] text-white` : `text-gray-400 hover:text-gray-200`}`} onClick={() => {
            p(`image`);
            s(1);
          }} title={`图片`}>
              <_Component2 size={14} />
            </Component11>
            <Component12 className={`px-3 py-1 text-xs rounded-md transition-colors flex items-center justify-center ${f === `video` ? `bg-[#333] text-white` : `text-gray-400 hover:text-gray-200`}`} onClick={() => {
            p(`video`);
            s(1);
          }} title={`视频`}>
              <Pt size={14} />
            </Component12>
            <Component13 className={`px-3 py-1 text-xs rounded-md transition-colors flex items-center justify-center ${f === `text` ? `bg-[#333] text-white` : `text-gray-400 hover:text-gray-200`}`} onClick={() => {
            p(`text`);
            s(1);
          }} title={`文本`}>
              <_Component3 size={14} />
            </Component13>
          </Component14>
          <Component15 onClick={() => {
          h(m === `favorite` ? `all` : `favorite`);
          s(1);
        }} className={`flex items-center justify-center p-1.5 rounded transition-colors ml-1 ${m === `favorite` ? `bg-yellow-500/20 text-yellow-500` : `text-gray-500 hover:text-gray-300 hover:bg-[#333]`}`} title={m === `favorite` ? `取消收藏过滤` : `只看收藏`}>
            <G size={16} fill={m === `favorite` ? `currentColor` : `none`} />
          </Component15>
        </Component16>
        <Component17 className={`flex flex-1 justify-center max-w-sm mx-auto items-center`} />
        <Component25 className={`flex items-center gap-4`}>
          <Component24 className={`flex items-center gap-2 hidden md:flex`}>
            <Component18 className={`text-xs text-gray-500 ml-2`}>{`显示大小`}</Component18>
            <Component19 type={`range`} min={`2`} max={`8`} step={`1`} value={c} onChange={e => {
            l(parseInt(e.target.value));
          }} className={`w-24 accent-white bg-gray-600 h-1.5 rounded-lg appearance-none cursor-pointer`} />
            <Component20 className={`w-px h-4 bg-[#333] mx-2`} />
            <Component22 onClick={() => {
            if (S.status.isConnected) {
              y(true);
              x(`新建文件夹`);
            } else {
              C(`请先连接本地引擎`);
            }
          }} className={`flex items-center gap-1.5 px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] rounded text-sm text-gray-300 hover:text-white transition-colors`} title={`新建文件夹`}>
              <F size={14} />
              <Component21 className={`font-medium`}>{`新建文件夹`}</Component21>
            </Component22>
            <Component23 onClick={() => {
            if (S.status.isConnected) {
              let e = u === `generated` ? `tasks/` : `migrated/`;
              let t = g ? `${e}${g}` : e.slice(0, -1);
              fetch(`${Mn()}/api/files/open?subfolder=${encodeURIComponent(t)}`).then(e => {
                return e.json();
              }).then(e => {
                return C(`已在文件管理器中打开: ${e.path}`);
              }).catch(() => {
                return C(`打开本地目录失败`);
              });
            } else if (typeof chrome < `u` && chrome.downloads) {
              chrome.downloads.showDefaultFolder();
            } else {
              C(`当前环境不支持打开下载目录`);
            }
          }} className={`flex items-center justify-center bg-[#2a2a2a] hover:bg-[#333] border border-[#333] rounded w-8 h-8 text-gray-300 hover:text-white transition-colors`} title={S.status.isConnected ? `打开本地存储目录` : `打开浏览器下载目录`}>
              <_Component4 size={16} />
            </Component23>
          </Component24>
        </Component25>
      </Component26>
      <Component86 className={`flex-1 overflow-y-auto p-3 flex flex-col`}>
        {!a && t.length === 0 && <Component31 className={`text-center text-gray-500 py-20 text-sm flex flex-col items-center`}>
            <Component27 className={`text-4xl mb-3 opacity-50`}>{`📦`}</Component27>
            <Component28>{`暂无资源`}</Component28>
            <Component30 className={`text-xs mt-2 text-gray-600`}>
              {`在网页图片/视频上点击右键`}
              <Component29 />
              {`选择"发送到资源"`}
            </Component30>
          </Component31>}
        <Component85 className={`grid gap-3 flex-1 content-start`} style={{
        gridTemplateColumns: `repeat(${c}, minmax(0, 1fr))`
      }}>
          <Q.Fragment>
            {v && <Component35 className={`bg-[#151414] rounded-lg border border-orange-500/50 shadow-sm overflow-hidden flex flex-col aspect-square`}>
                <Component33 className={`flex-1 bg-[#0d0c0c] relative flex flex-col items-center justify-center text-orange-400 opacity-100`}>
                  <_Component4 size={48} strokeWidth={1} />
                  <Component32 autoFocus={true} type={`text`} value={b} onChange={e => {
                return x(e.target.value);
              }} onKeyDown={async e => {
                if (e.key === `Enter`) {
                  let e = b.trim();
                  if (e && S.status.isConnected) {
                    let t = g ? `${g}/${e}` : `${u === `generated` ? `tasks/` : `migrated/`}${e}`;
                    if (await S.createFolder(t)) {
                      C(`创建成功`);
                      w(true);
                    } else {
                      C(`创建失败`);
                    }
                  }
                  y(false);
                } else if (e.key === `Escape`) {
                  y(false);
                }
              }} onBlur={async () => {
                let e = b.trim();
                if (e && e !== `新建文件夹` && S.status.isConnected) {
                  let t = g ? `${g}/${e}` : `${u === `generated` ? `tasks/` : `migrated/`}${e}`;
                  if (await S.createFolder(t)) {
                    C(`创建成功`);
                    w(true);
                  }
                }
                y(false);
              }} className={`mt-2 text-sm text-center w-3/4 bg-[#222] border border-orange-500/50 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-orange-500 text-white`} />
                </Component33>
                <Component34 className={`h-8 p-1.5 bg-[#151414] border-t border-[#333] flex items-center justify-center text-[10px] text-gray-500`}>{`按回车确认`}</Component34>
              </Component35>}
            {P.map(e => {
            return <Component84 className={`bg-[#151414] rounded-lg border shadow-sm overflow-hidden group relative flex flex-col aspect-square hover:border-gray-500 transition-colors ${e.type === `folder` ? `border-orange-500/30 bg-orange-900/10 cursor-pointer` : `border-[#333]`}`} onDragOver={t => {
              if (e.type === `folder`) {
                t.preventDefault();
              }
            }} onDrop={async t => {
              if (e.type === `folder` && S.status.isConnected) {
                t.preventDefault();
                let r = t.dataTransfer.getData(`text/plain`);
                let i = n.find(e => {
                  return e.id === r;
                });
                if (i && i.source === `local-tool` && i.name) {
                  C(`移动文件到 ${e.name}...`);
                  let t = u === `generated` ? `tasks/` : `migrated/`;
                  let n = g ? `${t}${g}/${e.name}` : `${t}${e.name}`;
                  if (await S.moveFile(i.folder ? `${i.folder}/${i.name}` : i.name, n)) {
                    C(`移动成功`);
                    w(true);
                  } else {
                    C(`移动失败`);
                  }
                } else {
                  C(`仅支持移动本地同步的资源`);
                }
              }
            }} key={e.id}>
                  <Component80 className={`flex-1 bg-[#0d0c0c] relative flex items-center justify-center overflow-hidden`} onClick={() => {
                if (e.type === `folder`) {
                  _(g ? `${g}/${e.name}` : e.name || ``);
                  s(1);
                }
              }}>
                    {e.type === `folder` ? <Component46 className={`flex flex-col items-center justify-center w-full h-full text-orange-400 opacity-80 group-hover:opacity-100 transition-opacity relative p-2`}>
                        {(() => {
                    let t = u === `generated` ? `tasks/` : `migrated/`;
                    let r = g ? `${t}${g}/${e.name}` : `${t}${e.name}`;
                    let i = n.filter(e => {
                      return e.type !== `folder` && e.folder === r;
                    }).sort((e, t) => {
                      return (t.timestamp || 0) - (e.timestamp || 0);
                    }).slice(0, 4);
                    if (i.length > 0) {
                      const Component36 = `video`;
                      const Component37 = `polygon`;
                      const Component38 = `svg`;
                      const Component39 = `div`;
                      const Component40 = `div`;
                      const Component41 = `div`;
                      const Component42 = `div`;
                      const Component43 = `img`;
                      const Component44 = `div`;
                      return <Component44 className={`absolute inset-0 p-2 grid grid-cols-2 gap-1 overflow-hidden opacity-40 mix-blend-screen pointer-events-none`}>
                                {i.map(e => {
                          if (e.type?.startsWith(`video`)) {
                            return <Q.Fragment>
                                        <Component36 src={e.url} className={`w-full h-full object-cover rounded-sm`} preload={`metadata`} key={e.id} />
                                        <Component40 className={`absolute inset-0 flex items-center justify-center pointer-events-none`}>
                                          <Component39 className={`w-5 h-5 rounded-full bg-black/40 flex items-center justify-center border border-white/20 backdrop-blur-sm`}>
                                            <Component38 width={`10`} height={`10`} viewBox={`0 0 24 24`} fill={`white`} stroke={`white`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`} className={`ml-0.5`}>
                                              <Component37 points={`5 3 19 12 5 21 5 3`} />
                                            </Component38>
                                          </Component39>
                                        </Component40>
                                      </Q.Fragment>;
                          } else {
                            if (I(e)) {
                              return <Component41 className={`w-full h-full bg-[#111] rounded-sm flex items-center justify-center text-gray-500`} key={e.id}>
                                          <_Component5 size={12} />
                                        </Component41>;
                            } else {
                              if (e.type?.startsWith(`text`)) {
                                return <Component42 className={`w-full h-full bg-[#111] rounded-sm text-[4px] text-gray-500 overflow-hidden p-0.5 break-all`} key={e.id}>
                                            {e.url.substring(0, 20)}
                                            {`...`}
                                          </Component42>;
                              } else {
                                return <Component43 src={e.url} loading={`lazy`} decoding={`async`} className={`w-full h-full object-cover rounded-sm`} key={e.id} />;
                              }
                            }
                          }
                        })}
                              </Component44>;
                    } else {
                      return null;
                    }
                  })()}
                        <_Component4 size={48} strokeWidth={1} className={`z-10 drop-shadow-md`} />
                        <Component45 className={`mt-2 font-bold text-sm truncate w-full text-center px-2 z-10 drop-shadow-md`}>
                          {e.name}
                        </Component45>
                      </Component46> : e.type === `video` || e.type && e.type.startsWith(`video`) ? <Component52 className={`w-full h-full relative cursor-grab active:cursor-grabbing`} onDoubleClick={() => {
                  return j({
                    url: e.url,
                    type: `video`
                  });
                }} draggable={`true`} onDragStart={t => {
                  t.dataTransfer.setData(`text/plain`, e.id);
                  let n = new Image();
                  n.src = e.url;
                  t.dataTransfer.setDragImage(n, 0, 0);
                }}>
                        <Component47 src={e.url} className={`w-full h-full object-cover`} preload={`metadata`} muted={true} onMouseEnter={e => {
                    e.target.play().catch(() => {});
                  }} onMouseLeave={e => {
                    e.target.pause();
                  }} />
                        <Component51 className={`absolute inset-0 flex items-center justify-center pointer-events-none`}>
                          <Component50 className={`w-8 h-8 rounded-full bg-black/40 flex items-center justify-center border border-white/20 backdrop-blur-sm`}>
                            <Component49 width={`14`} height={`14`} viewBox={`0 0 24 24`} fill={`white`} stroke={`white`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`} className={`ml-0.5`}>
                              <Component48 points={`5 3 19 12 5 21 5 3`} />
                            </Component49>
                          </Component50>
                        </Component51>
                      </Component52> : I(e) ? <Component55 className={`w-full h-full p-4 bg-[#111] flex flex-col items-center justify-center gap-3 cursor-grab active:cursor-grabbing`} onDoubleClick={() => {
                  return j({
                    url: e.url,
                    type: `audio`
                  });
                }} draggable={`true`} onDragStart={t => {
                  t.dataTransfer.setData(`text/plain`, e.id);
                }}>
                        <Component53 className={`w-14 h-14 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-gray-300`}>
                          <_Component5 size={28} />
                        </Component53>
                        <Component54 src={e.url} controls={true} preload={`metadata`} className={`w-full max-w-[220px] h-8`} />
                      </Component55> : e.type === `text` ? <Component56 className={`p-2 text-xs text-gray-400 overflow-hidden w-full h-full break-all bg-[#1a1a1a] cursor-grab active:cursor-grabbing hover:bg-[#222] transition-colors`} onDoubleClick={() => {
                  return j({
                    url: e.url,
                    type: `text`
                  });
                }} draggable={`true`} onDragStart={t => {
                  t.dataTransfer.setData(`text/plain`, e.id);
                }}>
                        <_cmp_Vn url={e.url} />
                      </Component56> : <Component57 src={e.url} loading={`lazy`} decoding={`async`} className={`w-full h-full object-cover cursor-grab active:cursor-grabbing`} draggable={`true`} onDragStart={t => {
                  t.dataTransfer.setData(`text/plain`, e.id);
                  t.dataTransfer.setData(`text/html`, `<img src="${e.url}" />`);
                }} onDoubleClick={() => {
                  return j({
                    url: e.url,
                    type: `image`
                  });
                }} />}
                    <Component77 className={`absolute top-2 right-2 flex opacity-0 group-hover:opacity-100 transition-opacity z-20 gap-1`}>
                      {e.type !== `folder` && (c <= 5 ? <Component64 className={`flex gap-1 bg-white/90 p-1 rounded-md backdrop-blur-sm border border-gray-200 shadow-lg`}>
                            {!e.type.startsWith(`text`) && <Component58 onClick={t => {
                      t.stopPropagation();
                      O(e);
                    }} className={`p-1 text-gray-700 hover:bg-gray-100 rounded`} title={`发送到网页`}>
                                <Te size={14} />
                              </Component58>}
                            <Component59 onClick={t => {
                      t.stopPropagation();
                      ee(e);
                    }} className={`p-1 text-gray-700 hover:bg-gray-100 rounded`} title={`发送到画布`}>
                              <At size={14} />
                            </Component59>
                            {!e.type.startsWith(`text`) && (e.source === `local-tool` ? <Component60 onClick={t => {
                      t.stopPropagation();
                      if (S.status.isConnected && e.url.includes(`/files/`)) {
                        try {
                          let t = new URL(e.url);
                          let n = decodeURIComponent(t.pathname).replace(/^\/files\//, ``).replace(/^resources\//, ``);
                          if (n) {
                            fetch(`${Mn()}/api/files/open-dir?filepath=${encodeURIComponent(n)}`, {
                              method: `GET`
                            }).catch(() => {
                              return C(`打开所在目录失败`);
                            });
                          }
                        } catch {
                          C(`打开所在目录失败`);
                        }
                      } else {
                        C(`资源未连接本地引擎`);
                      }
                    }} className={`p-1 text-gray-700 hover:bg-gray-100 rounded`} title={`打开目录`}>
                                  <Pe size={14} />
                                </Component60> : <Component61 onClick={t => {
                      t.stopPropagation();
                      let n = document.createElement(`a`);
                      n.href = e.url;
                      n.download = `download-${Date.now()}`;
                      document.body.appendChild(n);
                      n.click();
                      document.body.removeChild(n);
                    }} className={`p-1 text-gray-700 hover:bg-gray-100 rounded`} title={`下载`}>
                                  <_Component6 size={14} />
                                </Component61>)}
                            {!e.type.startsWith(`text`) && <_cmp_Bn url={e.url} fallbackExt={e.type.startsWith(`video`) ? `mp4` : e.type.startsWith(`audio`) ? `mp3` : `png`} size={14} className={`p-1 text-gray-700 hover:bg-gray-100 rounded`} onToast={C} />}
                            <Component62 onClick={() => {
                      return k(e);
                    }} className={`p-1 text-gray-700 hover:bg-gray-100 rounded`} title={`复制`}>
                              <_Component7 size={14} />
                            </Component62>
                            <Component63 onClick={t => {
                      t.stopPropagation();
                      D(e.id);
                    }} className={`p-1 text-red-600 hover:bg-red-50 rounded`} title={`删除`}>
                              <U size={14} />
                            </Component63>
                          </Component64> : <Component74 className={`relative`}>
                            <Component65 onClick={t => {
                      t.stopPropagation();
                      let n = t.currentTarget.getBoundingClientRect();
                      N(t => {
                        if (t?.id === e.id) {
                          return null;
                        } else {
                          return {
                            id: e.id,
                            x: n.right,
                            y: n.bottom
                          };
                        }
                      });
                    }} className={`p-1.5 bg-white/90 hover:bg-gray-100 text-gray-700 rounded-md backdrop-blur-sm border border-gray-200 transition-colors shadow-lg`}>
                              <Bt size={16} />
                            </Component65>
                            {M?.id === e.id && Fn.createPortal(<Q.Fragment>
                                  <Component66 className={`fixed inset-0 z-[9998]`} onClick={() => {
                        return N(null);
                      }} />
                                  <Component73 className={`fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl p-1 min-w-[120px]`} style={{
                        top: M.y + 4,
                        left: M.x,
                        transform: `translateX(-100%)`
                      }} onClick={e => {
                        return e.stopPropagation();
                      }}>
                                    {!e.type.startsWith(`text`) && <Component67 onClick={t => {
                          t.stopPropagation();
                          N(null);
                          O(e);
                        }} className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 rounded`} title={`发送到网页`}>
                                        <Te size={12} />
                                        {` 发送到网页`}
                                      </Component67>}
                                    <Component68 onClick={t => {
                          t.stopPropagation();
                          N(null);
                          ee(e);
                        }} className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 rounded`} title={`发送到画布`}>
                                      <At size={12} />
                                      {` 发送到画布`}
                                    </Component68>
                                    {!e.type.startsWith(`text`) && (e.source === `local-tool` ? <Component69 onClick={t => {
                          t.stopPropagation();
                          N(null);
                          if (S.status.isConnected && e.url.includes(`/files/`)) {
                            try {
                              let t = new URL(e.url);
                              let n = decodeURIComponent(t.pathname).replace(/^\/files\//, ``).replace(/^resources\//, ``);
                              if (n) {
                                fetch(`${Mn()}/api/files/open-dir?filepath=${encodeURIComponent(n)}`, {
                                  method: `GET`
                                }).catch(() => {
                                  return C(`打开所在目录失败`);
                                });
                              }
                            } catch {
                              C(`打开所在目录失败`);
                            }
                          } else {
                            C(`资源未连接本地引擎`);
                          }
                        }} className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 rounded`} title={`打开所在目录`}>
                                          <Pe size={12} />
                                          {` 打开目录`}
                                        </Component69> : <Component70 onClick={t => {
                          t.stopPropagation();
                          N(null);
                          let n = document.createElement(`a`);
                          n.href = e.url;
                          n.download = `download-${Date.now()}`;
                          document.body.appendChild(n);
                          n.click();
                          document.body.removeChild(n);
                        }} className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 rounded`} title={`下载`}>
                                          <_Component6 size={12} />
                                          {` 下载`}
                                        </Component70>)}
                                    <Component71 onClick={() => {
                          N(null);
                          k(e);
                        }} className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 rounded`} title={`复制`}>
                                      <_Component7 size={12} />
                                      {` 复制`}
                                    </Component71>
                                    <Component72 onClick={t => {
                          t.stopPropagation();
                          N(null);
                          D(e.id);
                        }} className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded`} title={`删除`}>
                                      <U size={12} />
                                      {` 删除`}
                                    </Component72>
                                  </Component73>
                                </Q.Fragment>, document.body)}
                          </Component74>)}
                      {e.type !== `folder` && <Component75 onClick={t => {
                    t.stopPropagation();
                    T(e);
                  }} className={`p-1.5 rounded-md backdrop-blur-sm border transition-colors shadow-lg ${e.isFavorite ? `bg-yellow-100 border-yellow-200 text-yellow-600` : `bg-white/90 border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700`}`} title={`收藏`}>
                          <G size={16} fill={e.isFavorite ? `currentColor` : `none`} />
                        </Component75>}
                      {e.type === `folder` && <Component76 onClick={t => {
                    t.stopPropagation();
                    if (confirm(`确定要删除文件夹 "${e.name}" 及其所有内容吗？此操作无法撤销！`)) {
                      C(`请在"打开本地存储目录"中进行文件夹删除`);
                    }
                  }} className={`ml-1 p-1 bg-white/90 hover:bg-red-50 text-gray-700 hover:text-red-600 rounded-md backdrop-blur-sm border border-gray-200 transition-colors shadow-lg`} title={`删除文件夹`}>
                          <U size={16} />
                        </Component76>}
                    </Component77>
                    <Component79 className={`absolute top-2 left-2 flex gap-1 pointer-events-none flex-wrap max-w-[80%]`}>
                      {e.source === `local-tool` && e.type !== `folder` && <Component78 className={`text-white/70 bg-black/30 backdrop-blur-sm p-1 rounded-md shadow-sm opacity-50 group-hover:opacity-100 transition-opacity`} title={`本地资源`}>
                          <A size={12} />
                        </Component78>}
                    </Component79>
                  </Component80>
                  <Component83 className={`h-8 p-1.5 bg-[#151414] border-t border-[#333] flex items-center justify-between text-[10px] text-gray-500`}>
                    <Component81 className={`truncate flex-1 mr-2`} title={e.name || e.pageTitle}>
                      {e.type === `folder` ? e.name : e.type === `text` ? `📝 文本片段` : e.name || e.pageTitle || `资源`}
                    </Component81>
                    {e.type !== `folder` && <Component82 className={`text-gray-600 flex-shrink-0`} title={new Date(e.timestamp).toLocaleString()}>
                        {new Date(e.timestamp).toLocaleDateString().slice(5)}
                        {` `}
                        {new Date(e.timestamp).getHours()}
                        {`:`}
                        {new Date(e.timestamp).getMinutes().toString().padStart(2, `0`)}
                      </Component82>}
                  </Component83>
                </Component84>;
          })}
          </Q.Fragment>
        </Component85>
      </Component86>
      <Component94 className={`flex justify-between items-center px-4 py-3 border-t border-[#333] bg-[#0d0c0c] z-20 flex-shrink-0`}>
        <Component87 className={`text-sm font-bold text-gray-200`}>
          {u === `materials` ? `素材` : `生成`}
          {` (`}
          {r}
          {`)`}
        </Component87>
        {(() => {
        let e = i;
        if (e <= 1) {
          const Component88 = `div`;
          return <Component88 className={`flex-1`} />;
        } else {
          const Component89 = `button`;
          const Component90 = `span`;
          const Component91 = `button`;
          const Component92 = `div`;
          return <Component92 className={`flex justify-center items-center gap-4 flex-1`}>
                <Component89 disabled={o <= 1 || a} onClick={() => {
              return s(e => {
                return Math.max(1, e - 1);
              });
            }} className={`px-3 py-1 bg-[#2a2a2a] text-gray-300 rounded text-xs hover:bg-[#333] disabled:opacity-50 disabled:cursor-not-allowed`}>{`上一页`}</Component89>
                <Component90 className={`text-xs text-gray-500`}>
                  {o}
                  {` / `}
                  {e}
                </Component90>
                <Component91 disabled={o >= e || a} onClick={() => {
              return s(t => {
                return Math.min(e, t + 1);
              });
            }} className={`px-3 py-1 bg-[#2a2a2a] text-gray-300 rounded text-xs hover:bg-[#333] disabled:opacity-50 disabled:cursor-not-allowed`}>{`下一页`}</Component91>
              </Component92>;
        }
      })()}
        <Component93 onClick={E} className={`text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded hover:bg-[#333] transition-colors border border-transparent hover:border-red-900/50 whitespace-nowrap flex items-center gap-1`}>
          <U size={12} />
          {`清空全部`}
        </Component93>
      </Component94>
    </Component95>;
}