// TODO(全局, 无需 import): data, selected, updateNodeData, setEdges, p, k, z, ee, o, l, n, r, selectedModel, handleType, images, texts, url, i, label, text, u, color, oe, expanded, f, display, width, height, HTMLButtonElement, HTMLTextAreaElement, g, ie, fontSize, x, selectedContextResources, minHeight, overflow, prompt, inputHeight, autoSplit, s, b, inputWidth, m, lineHeight
import _cmp__Component8 from './_Component8.jsx';
import _cmp_Ti from './Ti.jsx';
import _cmp_Di from './Di.jsx';
import _cmp_Oi from './Oi.jsx';
import _cmp__Component23 from './_Component23.jsx';
import _cmp__Component12 from './_Component12.jsx';
import _cmp_So from './So.jsx';
import _cmp__Component21 from './_Component21.jsx';
import _cmp_Ai from './Ai.jsx';
import _cmp_Er from './Er.jsx';
import { id, We, t, xa, e, Da, O, ka, w, D, L, Kr, Ar, I, F, E, S, Lt, Qt, ne, B, c, a, V, j, P, _, N, ae, h, X, re, M, R, te, d, A, ca, ta, na, fa, la, Oa, C, H, y, _Component3, _Component25, _Component0, _Component7, _Component26, Ke, _Component17, _Component18, _Component20, T, _Component22 } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
var Co = Z.memo(({
  id: e,
  data: t,
  selected: n
}) => {
  let {
    updateNodeData: r,
    setEdges: i
  } = We();
  let [a, o] = Z.useState(t.prompt || ``);
  let [c, l] = Z.useState(t.text || ``);
  let [u, d] = Z.useState(t.autoSplit || false);
  let [f, p] = Z.useState(t.expanded === undefined ? true : t.expanded);
  Z.useEffect(() => {
    if (t.expanded !== undefined) {
      p(t.expanded);
    }
  }, [t.expanded]);
  let [m, h] = Z.useState(false);
  let [g, _] = Z.useState(false);
  let [y, b] = Z.useState(false);
  let [x, S] = Z.useState(t.selectedContextResources || []);
  let C = t.presetPrompts || [];
  let [w, E] = Z.useState(t.selectedModel || localStorage.getItem(`mutiwindow_text_model`) || t.textModel && t.textModel.split(`
`)[0].trim() || ``);
  let [D, O] = Z.useState(() => {
    return xa().filter(e => {
      return e.enabled && e.category === `text`;
    });
  });
  Z.useEffect(() => {
    return Da(e => {
      O(e.filter(e => {
        return e.enabled && e.category === `text`;
      }));
    });
  }, []);
  let k = ka(w);
  let A = k ? D.find(e => {
    return e.id === k;
  }) : null;
  let j = Z.useRef(null);
  let M = Z.useRef(null);
  let N = Z.useRef(null);
  let P = Z.useRef(null);
  let [F, I] = Z.useState(false);
  let ee = Z.useRef(null);
  let [L, R] = Z.useState(false);
  let [te, z] = Z.useState([]);
  Z.useEffect(() => {
    if (L) {
      Kr.getObject(Ar.TRANSIT_RESOURCES).then(e => {
        if (e && Array.isArray(e) && e.length > 0) {
          z(e);
        }
      }).catch(e => {
        console.error(`Failed to fetch transitResources from storage`, e);
      });
    }
  }, [L]);
  Z.useEffect(() => {
    let e = e => {
      if (ee.current && !ee.current.contains(e.target)) {
        I(false);
      }
    };
    if (F) {
      document.addEventListener(`mousedown`, e, true);
    }
    return () => {
      document.removeEventListener(`mousedown`, e, true);
    };
  }, [F]);
  Z.useEffect(() => {
    o(t.prompt || ``);
    if (t.text !== undefined) {
      l(t.text);
    }
    if (t.selectedModel) {
      E(t.selectedModel);
    }
    if (t.selectedContextResources) {
      S(t.selectedContextResources);
    }
  }, [t.prompt, t.text, t.selectedModel, t.selectedContextResources]);
  Z.useEffect(() => {
    if (t.textModel && !w) {
      let n = t.textModel.split(`
`)[0].trim();
      E(n);
      r(e, {
        selectedModel: n
      });
    }
  }, [t.textModel, w, e, r]);
  let ne = Lt({
    handleType: `target`
  });
  let B = Qt(Z.useMemo(() => {
    return ne.map(e => {
      return e.source;
    });
  }, [ne]));
  let re = (() => {
    if (!B) {
      return {
        images: [],
        texts: []
      };
    }
    let e = Array.isArray(B) ? B : [B];
    let t = [];
    let n = [];
    e.forEach(e => {
      let r = ne.find(t => {
        return t.source === e?.id;
      });
      if (e?.data?.imageUrl && typeof e.data.imageUrl == `string` && (e.data.imageUrl.startsWith(`http`) || e.data.imageUrl.startsWith(`data:`))) {
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
  let V = t.loading;
  let ie = t.errorMessage;
  let ae = t.fontSize || 14;
  let oe = e => {
    e.stopPropagation();
    navigator.clipboard.writeText(c);
    if (t.onShowToast) {
      t.onShowToast(`已复制文本`);
    }
  };
  let H = n => {
    n.stopPropagation();
    if (t.onGenerateText) {
      t.onGenerateText(e, a, u, w);
    }
  };
  const Component396 = `button`;
  const Component397 = `button`;
  const Component398 = `button`;
  const Component399 = `div`;
  const Component400 = `div`;
  const Component401 = `input`;
  const Component402 = `span`;
  const Component403 = `div`;
  const Component404 = `span`;
  const Component405 = `div`;
  const Component406 = `div`;
  const Component407 = `div`;
  const Component468 = `div`;
  return <Component468 className={`relative flex flex-col items-center group/node transition-all ${n ? `z-50` : `z-10`}`}>
      <_cmp__Component8 id={e} data={t} defaultTitle={`文本生成`} icon={<_Component3 size={11} className={`text-gray-500`} />} />
      <Component400 className={`absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`}>
        <Component399 className={`flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`}>
          {V && <_Component25 size={12} className={`animate-spin flex-shrink-0`} style={{
          color: `rgb(210,2,7)`
        }} />}
          {ne.length === 0 && <Component396 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} onClick={() => {
          return j.current?.click();
        }} title={`上传图片`}>
              <_Component0 size={12} />
            </Component396>}
          <Component397 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} onClick={oe} title={`复制文本`}>
            <_Component7 size={12} />
          </Component397>
          <Component398 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} onClick={() => {
          p(!f);
          r(e, {
            expanded: !f
          });
        }} title={f ? `收起输入` : `展开输入`}>
            {f ? <_Component26 size={12} /> : <Ke size={12} />}
          </Component398>
        </Component399>
      </Component400>
      <Component401 type={`file`} ref={j} style={{
      display: `none`
    }} accept={`image/*`} onChange={async n => {
      let r = n.target.files?.[0];
      if (r) {
        try {
          let n = await _cmp_Er(r, 2048, 0.85);
          if (t.onAddImage) {
            t.onAddImage(e, n);
          }
        } catch (e) {
          console.error(`Image resize failed:`, e);
        }
        n.target.value = ``;
      }
    }} />
      <Component407 ref={P} className={`relative bg-[#1c1c1c] rounded-xl border shadow-xl transition-[border-color] duration-200 flex flex-col
          ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}
        `} style={{
      width: `420px`,
      height: `240px`
    }} onClick={t => {
      if (!g && !(t.target instanceof HTMLButtonElement) && !(t.target instanceof HTMLInputElement) && !(t.target instanceof HTMLTextAreaElement)) {
        p(!f);
        r(e, {
          expanded: !f
        });
      }
    }}>
        <Component406 className={`flex-1 min-h-0 p-3 overflow-hidden bg-[#1a1a1a] relative rounded-xl ${g ? `nopan nowheel nodrag` : `drag-handle cursor-move`}`} onWheel={e => {
        return e.stopPropagation();
      }} onDoubleClick={() => {
        if (!g) {
          _(true);
          setTimeout(() => {
            return N.current?.focus();
          }, 0);
        }
      }}>
          {V ? <_cmp_Ti label={`生成中...`}>
              <_cmp_Di category={`text`} />
            </_cmp_Ti> : null}
          {ie ? <Component403 className={`text-red-400 text-xs p-2 border border-red-500/30 rounded bg-red-500/10 flex items-start gap-2`}>
              <_Component17 size={14} className={`mt-0.5 flex-shrink-0`} />
              <Component402 className={`break-all`}>{ie}</Component402>
            </Component403> : <Q.Fragment>
              {!c && !V && !g && <Component405 className={`absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none`}>
                  <_Component3 size={72} className={`text-gray-700`} strokeWidth={1.2} />
                  <Component404 className={`text-xs text-gray-600`}>{`双击编辑内容或AI生成`}</Component404>
                </Component405>}
              <_cmp_Oi ref={N} className={`w-full h-full bg-transparent outline-none font-sans leading-relaxed custom-scrollbar nowheel ${g ? `nodrag nopan` : `pointer-events-none`}`} style={{
            fontSize: `${ae}px`,
            color: `#a1a1aa`
          }} placeholder={``} value={c} readOnly={!g} onChange={t => {
            l(t);
            r(e, {
              text: t
            });
          }} onBlur={() => {
            return _(false);
          }} onWheel={e => {
            return e.stopPropagation();
          }} />
            </Q.Fragment>}
          <_cmp__Component23 targetRef={P} minWidth={320} minHeight={180} onRequestFullscreen={() => {
          return h(true);
        }} />
        </Component406>
        <_cmp__Component12 type={`target`} position={X.Left} />
        <_cmp__Component12 type={`source`} position={X.Right} />
      </Component407>
      {(() => {
      const Component408 = `img`;
      const Component409 = `span`;
      const Component410 = `div`;
      const Component411 = `div`;
      const Component412 = `img`;
      const Component413 = `video`;
      const Component414 = `div`;
      const Component415 = `div`;
      const Component416 = `span`;
      const Component417 = `div`;
      const Component418 = `div`;
      const Component419 = `span`;
      const Component420 = `div`;
      const Component421 = `div`;
      const Component422 = `div`;
      const Component423 = `div`;
      const Component424 = `div`;
      const Component425 = `div`;
      const Component426 = `input`;
      const Component427 = `label`;
      const Component428 = `div`;
      const Component429 = `span`;
      const Component430 = `span`;
      const Component431 = `span`;
      const Component432 = `button`;
      const Component453 = `div`;
      const Component454 = `div`;
      const Component455 = `div`;
      const Component456 = `div`;
      const Component457 = `button`;
      const Component458 = `div`;
      const Component459 = `span`;
      const Component460 = `div`;
      const Component461 = `div`;
      const Component462 = `button`;
      const Component463 = `div`;
      const Component464 = `div`;
      const Component465 = `div`;
      let n = <Component465 className={`space-y-3`}>
            <Component425 className={`flex flex-col gap-2`}>
              {(re.images.length > 0 || re.texts.length > 0 || x.length > 0) && <Component421 className={`flex flex-wrap gap-2 mb-1`}>
                  {re.images.map((t, n) => {
              return <Component411 className={`w-8 h-8 rounded overflow-hidden border border-[#444] relative group bg-black`} title={`连线图片`} key={`img-${n}`}>
                        <Component408 src={t.url} alt={`Ref`} className={`w-full h-full object-cover`} />
                        <Component410 className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`} onClick={n => {
                  n.stopPropagation();
                  i(n => {
                    return n.filter(n => {
                      return n.target !== e || n.source !== t.id;
                    });
                  });
                }}>
                          <Component409 className={`text-white text-[8px]`}>{`×`}</Component409>
                        </Component410>
                      </Component411>;
            })}
                  {x.map((t, n) => {
              return <Component418 className={`w-8 h-8 rounded overflow-hidden border border-blue-500/50 relative group bg-black`} title={`通过 @ 选中的素材`} key={`ctx-${n}`}>
                        {t.type.startsWith(`image`) ? <Component412 src={t.url} className={`w-full h-full object-cover opacity-80`} /> : t.type.startsWith(`video`) ? <Component413 src={t.url} className={`w-full h-full object-cover opacity-80`} /> : <Component414 className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                            <_Component18 size={10} className={`text-gray-400`} />
                          </Component414>}
                        <Component415 className={`absolute inset-0 bg-blue-500/10 pointer-events-none`} />
                        <Component417 className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`} onClick={t => {
                  t.stopPropagation();
                  let i = x.filter((e, t) => {
                    return t !== n;
                  });
                  S(i);
                  r(e, {
                    selectedContextResources: i
                  });
                }}>
                          <Component416 className={`text-white text-[8px]`}>{`×`}</Component416>
                        </Component417>
                      </Component418>;
            })}
                  {re.texts.map((e, t) => {
              return <Component420 className={`h-8 px-2 bg-[#2a2a2a] border border-[#444] rounded flex items-center gap-1 text-[10px] text-gray-300 hover:bg-[#333] hover:border-blue-500 hover:text-blue-400 transition-colors cursor-help group/text`} title={e.text} key={`txt-${t}`}>
                        <_Component18 size={10} />
                        <Component419 className={`max-w-[60px] truncate`}>{e.label}</Component419>
                      </Component420>;
            })}
                </Component421>}
              <Component424 className={`flex items-start gap-2`}>
                <Component423 className={`flex-1 relative`}>
                  <_cmp_Oi ref={M} className={`w-full bg-transparent text-[15px] text-gray-200 outline-none leading-relaxed placeholder-gray-600 font-sans custom-scrollbar nodrag nowheel nopan`} style={{
                width: t.inputWidth ? `${t.inputWidth}px` : undefined,
                height: t.inputHeight ? `${t.inputHeight}px` : `80px`,
                minHeight: `80px`,
                overflow: `auto`
              }} placeholder={`输入提示词 (输入 @ 调出素材)...`} value={a} onChange={n => {
                o(n);
                r(e, {
                  prompt: n
                });
                if (n.endsWith(`@`)) {
                  R(true);
                } else if (!n.includes(`@`)) {
                  R(false);
                }
                if (!t.inputHeight || t.inputHeight <= 200) {
                  let t = M.current;
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
              }} onWheel={e => {
                return e.stopPropagation();
              }} />
                  {L && <Component422 className={`absolute bottom-full left-0 mb-1 z-[100]`} onWheel={e => {
                return e.stopPropagation();
              }} onClick={e => {
                return e.stopPropagation();
              }}>
                      <_cmp_So resources={te} onSelect={t => {
                  let n = a.lastIndexOf(`@`);
                  let i = n >= 0 ? a.substring(0, n) + a.substring(n + 1) : a;
                  if (t.type === `text`) {
                    let n = i + (t.url || ``);
                    o(n);
                    r(e, {
                      prompt: n
                    });
                  } else {
                    let n = [...x, t];
                    S(n);
                    r(e, {
                      selectedContextResources: n
                    });
                    o(i);
                    r(e, {
                      prompt: i
                    });
                  }
                  R(false);
                }} onClose={() => {
                  return R(false);
                }} />
                    </Component422>}
                </Component423>
              </Component424>
            </Component425>
            <Component464 className={`flex items-center justify-between pt-2 border-t border-[#2a2a2a]`}>
              <Component455 className={`flex items-center gap-1.5`}>
                <Component427 className={`flex items-center gap-1.5 cursor-pointer h-6 px-2 text-[11px] text-gray-400 hover:text-gray-200 select-none bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded transition-colors`}>
                  <Component426 type={`checkbox`} checked={u} onChange={t => {
                d(t.target.checked);
                r(e, {
                  autoSplit: t.target.checked
                });
              }} className={`accent-blue-500 rounded sm:w-3 sm:h-3`} />
                  {`自动拆分`}
                </Component427>
                {(!!t.textModel && !!(t.textModel.split(`
`).filter(e => {
              return e.trim() !== ``;
            }).length > 0) || !!(D.length > 0)) && <Component454 className={`relative nodrag flex items-center`} ref={ee}>
                    <Component428 className={`w-[1px] h-3 bg-[#444] mr-1.5`} />
                    <Component432 className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`} onClick={e => {
                e.stopPropagation();
                I(!F);
              }} title={A ? `调度：${A.name}` : w ? `${w}（${ca(w) ? `内置` : `第三方`}）` : `选择模型`}>
                      {A ? <Component429 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border bg-blue-500/20 text-blue-200 border-blue-400/40`}>{`调度`}</Component429> : w && <Component430 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${ca(w) ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                            {ca(w) ? `内置` : `三方`}
                          </Component430>}
                      <Component431 className={`whitespace-nowrap`}>
                        {A ? A.name : w || `选择模型`}
                      </Component431>
                    </Component432>
                    {F && <Component453 className={`absolute bottom-full left-0 mb-1 min-w-[17rem] w-max max-w-[29rem] bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 block max-h-60 overflow-y-auto custom-scrollbar nowheel nopan nodrag`} onWheel={e => {
                return e.stopPropagation();
              }} onClick={e => {
                return e.stopPropagation();
              }}>
                        {(() => {
                  let n = (t.textModel || ``).split(`
`).map(e => {
                    return e.trim();
                  }).filter(e => {
                    return e !== ``;
                  });
                  let i = n.filter(e => {
                    return ca(e);
                  }).sort((e, t) => {
                    return e.localeCompare(t);
                  });
                  let a = n.filter(e => {
                    return !ca(e);
                  }).sort((e, t) => {
                    return e.localeCompare(t);
                  });
                  let o = (t, n, i) => {
                    let a = i ? ta(t) : null;
                    let o = i ? na(t) : null;
                    let s = fa(t, w === t);
                    const Component433 = `span`;
                    const Component434 = `span`;
                    const Component435 = `span`;
                    const Component436 = `span`;
                    const Component437 = `div`;
                    return <Component437 role={`button`} className={s.className} title={s.title} onClick={() => {
                      if (!s.disabled) {
                        E(t);
                        r(e, {
                          selectedModel: t
                        });
                        localStorage.setItem(`mutiwindow_text_model`, t);
                        I(false);
                      }
                    }} key={`${i ? `b` : `o`}-${n}`}>
                                <Component433 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${i ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                                  {i ? `内置` : `三方`}
                                </Component433>
                                <Component434 className={`flex-1 whitespace-nowrap`}>
                                  {t}
                                </Component434>
                                {a !== null && <Component436 className={`shrink-0 inline-flex items-center gap-0.5 text-[10px] text-orange-400 tabular-nums`}>
                                    <_Component20 className={`w-2.5 h-2.5`} strokeWidth={2.5} />
                                    <Component435>
                                      {la(a)}
                                      {o ? `/${o}` : ``}
                                    </Component435>
                                  </Component436>}
                              </Component437>;
                  };
                  const Component438 = `span`;
                  const Component439 = `span`;
                  const Component440 = `span`;
                  const Component441 = `div`;
                  const Component446 = `div`;
                  const Component447 = `span`;
                  const Component448 = `span`;
                  const Component449 = `span`;
                  const Component450 = `div`;
                  const Component451 = `div`;
                  const Component452 = `div`;
                  return <Q.Fragment>
                              {D.length > 0 && <Q.Fragment>
                                  <Component441 className={`text-[10px] text-blue-300 mb-1 px-1 flex items-center justify-between`}>
                                    <Component439 className={`flex items-center gap-1`}>
                                      <_Component20 className={`w-2.5 h-2.5`} strokeWidth={2.5} />
                                      <Component438>{`模型调度`}</Component438>
                                    </Component439>
                                    <Component440 className={`ml-auto text-white/90 hover:text-white cursor-pointer transition-colors`} onClick={e => {
                          e.stopPropagation();
                          window.dispatchEvent(new CustomEvent(`mutiwindow-open-schedule-settings`));
                        }}>{`配置 ›`}</Component440>
                                  </Component441>
                                  {D.map(t => {
                        let n = Oa(t.id);
                        const Component442 = `span`;
                        const Component443 = `span`;
                        const Component444 = `span`;
                        const Component445 = `div`;
                        return <Component445 role={`button`} className={`w-full flex items-center gap-1.5 mb-1 last:mb-0 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors cursor-pointer ${w === n ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} onClick={() => {
                          E(n);
                          r(e, {
                            selectedModel: n
                          });
                          localStorage.setItem(`mutiwindow_text_model`, n);
                          I(false);
                        }} title={`${t.name}（${t.steps.length} 个模型按序重试）`} key={t.id}>
                                        <Component442 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border bg-blue-500/20 text-blue-200 border-blue-400/40`}>{`调度`}</Component442>
                                        <Component443 className={`flex-1 whitespace-nowrap`}>
                                          {t.name}
                                        </Component443>
                                        <Component444 className={`shrink-0 text-[10px] text-gray-500`}>
                                          {t.steps.length}
                                          {` 模型`}
                                        </Component444>
                                      </Component445>;
                      })}
                                  {(i.length > 0 || a.length > 0) && <Component446 className={`h-px bg-[#333] my-1.5`} />}
                                </Q.Fragment>}
                              {i.length > 0 && <Q.Fragment>
                                  <Component450 className={`text-[10px] text-blue-300 mb-1 px-1 flex items-center gap-1`}>
                                    <Component447>{`✨`}</Component447>
                                    <Component448>{`内置模型`}</Component448>
                                    <Component449 className={`ml-auto text-white/90 hover:text-white cursor-pointer whitespace-nowrap`} onClick={e => {
                          e.stopPropagation();
                          window.dispatchEvent(new CustomEvent(`mutiwindow-open-builtin-settings`));
                          I(false);
                        }} title={`查看内置模型详情`}>{`详情 ›`}</Component449>
                                  </Component450>
                                  {i.map((e, t) => {
                        return o(e, t, true);
                      })}
                                </Q.Fragment>}
                              {a.length > 0 && <Q.Fragment>
                                  {i.length > 0 && <Component451 className={`h-px bg-[#333] my-1.5`} />}
                                  <Component452 className={`text-[10px] text-gray-500 mb-1 px-1`}>{`第三方 API`}</Component452>
                                  {a.map((e, t) => {
                        return o(e, t, false);
                      })}
                                </Q.Fragment>}
                            </Q.Fragment>;
                })()}
                      </Component453>}
                  </Component454>}
                <_cmp__Component21 category={`text`} presetPrompts={C} onApply={t => {
              let n = a ? `${a}, ${t}` : t;
              o(n);
              r(e, {
                prompt: n
              });
            }} onToast={e => {
              return t.onShowToast?.(e);
            }} />
              </Component455>
              {V ? <Component458 className={`flex items-center bg-red-500/10 rounded-full p-1 pl-3 border border-red-500/30 hover:border-red-500/50 transition-colors cursor-pointer group/btn flex-shrink-0 ml-2`} onClick={n => {
            n.stopPropagation();
            if (t.onStop) {
              t.onStop(e);
            }
          }}>
                  <Component456 className={`flex items-center gap-1 mr-3 text-xs text-red-400 group-hover/btn:text-red-300`}>{`停止`}</Component456>
                  <Component457 className={`bg-red-500/20 text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-500/30 transition-colors`}>
                    <T size={10} fill={`currentColor`} />
                  </Component457>
                </Component458> : <Component463 className={`flex items-center bg-[#2a2a2a] rounded-full p-1 pl-3 border border-[#333] hover:border-gray-500 transition-colors cursor-pointer group/btn flex-shrink-0 ml-2`} onClick={H}>
                  {w && ca(w) && ta(w) !== null && <Component460 className={`flex items-center gap-0.5 mr-2 text-[11px] text-orange-400 tabular-nums`}>
                      <_Component20 className={`w-3 h-3`} strokeWidth={2.5} />
                      <Component459>
                        {la(ta(w) || 0)}
                        {na(w) ? `/${na(w)}` : ``}
                      </Component459>
                    </Component460>}
                  <Component461 className={`flex items-center gap-1 mr-3 text-xs text-gray-300 group-hover/btn:text-white`}>{`生成`}</Component461>
                  <Component462 className={`bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors`}>
                    <_Component22 size={14} strokeWidth={3} />
                  </Component462>
                </Component463>}
            </Component464>
          </Component465>;
      const Component466 = `div`;
      const Component467 = `textarea`;
      return <Q.Fragment>
            <Component466 className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[#1c1c1c] rounded-2xl border border-[#333] shadow-2xl min-w-[420px] w-max max-w-[920px] transition-all duration-300 origin-top z-50
                ${f ? `opacity-100 scale-100 p-4 overflow-visible` : `opacity-0 scale-95 pointer-events-none h-0 p-0 border-0 overflow-hidden`}
              `} onClick={e => {
          return e.stopPropagation();
        }}>
              {!y && n}
              {f && !y && <_cmp__Component23 targetRef={M} onRequestFullscreen={() => {
            return b(true);
          }} onResizeEnd={(t, n) => {
            return r(e, {
              inputWidth: t,
              inputHeight: n
            });
          }} />}
            </Component466>
            <_cmp_Ai open={y} title={`编辑提示词 - 文本`} onClose={() => {
          return b(false);
        }}>
              {n}
            </_cmp_Ai>
            <_cmp_Ai open={m} title={`编辑文本内容`} onClose={() => {
          return h(false);
        }}>
              <Component467 autoFocus={true} className={`w-full h-full bg-[#0d0c0c] text-gray-100 outline-none custom-scrollbar resize-none p-4 rounded`} style={{
            fontSize: `${ae}px`,
            lineHeight: 1.7
          }} value={c} onChange={t => {
            l(t.target.value);
            r(e, {
              text: t.target.value
            });
          }} />
            </_cmp_Ai>
          </Q.Fragment>;
    })()}
    </Component468>;
});
export default Co;