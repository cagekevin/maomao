// TODO(全局, 无需 import): data, selected, updateNodeData, setEdges, p, r, i, n, o, l, selectedModel, handleType, oe, images, texts, se, url, label, text, u, color, expanded, f, display, width, height, HTMLButtonElement, HTMLTextAreaElement, g, x, b, z, fontSize, le, selectedContextResources, minHeight, overflow, prompt, inputHeight, ae, autoSplit, ee, s, k, inputWidth, m, lineHeight
import _cmp_Ti from './Ti.jsx';
import _cmp__Component15 from './_Component15.jsx';
import _cmp_Ni from './Ni.jsx';
import _cmp_Pi from './Pi.jsx';
import _cmp_Fi from './Fi.jsx';
import _cmp__Component10 from './_Component10.jsx';
import _cmp_No from './No.jsx';
import _cmp__Component20 from './_Component20.jsx';
import _cmp_Ii from './Ii.jsx';
import _cmp_jr from './jr.jsx';
import { id, We, t, C, Da, e, Na, N, ta, ra, P, ea, Zi, a, F, Fa, A, L, M, H, Zr, Fr, U, V, re, B, j, O, I, Lt, Qt, c, G, R, ue, ne, y, S, _, ce, h, X, W, D, ti, te, ie, d, ma, sa, ca, va, ha, Pa, pe, E, w, _Component3, _Component22, _Component8, _Component7, _Component23, Ke, _Component16, _Component17, _Component19, T, _Component21 } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
var Po = Z.memo(({
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
  let [x, S] = Z.useState(false);
  let C = Z.useRef(null);
  Z.useEffect(() => {
    return () => {
      if (C.current) {
        clearTimeout(C.current);
      }
    };
  }, []);
  let [w, E] = Z.useState(false);
  let [D, O] = Z.useState(t.selectedContextResources || []);
  let k = t.presetPrompts || [];
  let [A, j] = Z.useState(t.selectedModel || localStorage.getItem(`mutiwindow_text_model`) || t.textModel && t.textModel.split(`
`)[0].trim() || ``);
  let [M, N] = Z.useState(() => {
    return Da().filter(e => {
      return e.enabled && e.category === `text`;
    });
  });
  Z.useEffect(() => {
    return Na(e => {
      N(e.filter(e => {
        return e.enabled && e.category === `text`;
      }));
    });
  }, []);
  let [, P] = Z.useReducer(e => {
    return e + 1;
  }, 0);
  Z.useEffect(() => {
    ta(`/api`).catch(() => {});
  }, []);
  Z.useEffect(() => {
    return ra(() => {
      return P();
    });
  }, []);
  let F = ea();
  let I = Z.useMemo(() => {
    let e = (t.textModel || ``).split(`
`).map(e => {
      return e.trim();
    }).filter(Boolean);
    let n = Zi(`text`);
    let r = new Set();
    let i = [];
    let a = e => {
      let t = (e || ``).trim();
      if (!!t && !r.has(t)) {
        r.add(t);
        i.push(t);
      }
    };
    e.forEach(a);
    n.forEach(a);
    return i;
  }, [t.textModel, F]);
  let L = Fa(A);
  let ee = L ? M.find(e => {
    return e.id === L;
  }) : null;
  let R = Z.useRef(null);
  let te = Z.useRef(null);
  let z = Z.useRef(null);
  let ne = Z.useRef(null);
  let [B, re] = Z.useState(false);
  let V = Z.useRef(null);
  let [H, ie] = Z.useState(false);
  let [ae, U] = Z.useState([]);
  Z.useEffect(() => {
    if (H) {
      Zr.getObject(Fr.TRANSIT_RESOURCES).then(e => {
        if (e && Array.isArray(e) && e.length > 0) {
          U(e);
        }
      }).catch(e => {
        console.error(`Failed to fetch transitResources from storage`, e);
      });
    }
  }, [H]);
  Z.useEffect(() => {
    let e = e => {
      if (V.current && !V.current.contains(e.target)) {
        re(false);
      }
    };
    if (B) {
      document.addEventListener(`mousedown`, e, true);
    }
    return () => {
      document.removeEventListener(`mousedown`, e, true);
    };
  }, [B]);
  Z.useEffect(() => {
    o(t.prompt || ``);
    if (t.text !== undefined) {
      l(t.text);
    }
    if (t.selectedModel) {
      j(t.selectedModel);
    }
    if (t.selectedContextResources) {
      O(t.selectedContextResources);
    }
  }, [t.prompt, t.text, t.selectedModel, t.selectedContextResources]);
  Z.useEffect(() => {
    if (!Fa(A)) {
      if (I.length !== 0 && (!A || !I.includes(A))) {
        j(I[0]);
        r(e, {
          selectedModel: I[0]
        });
      }
    }
  }, [I, A, e, r]);
  let oe = Lt({
    handleType: `target`
  });
  let se = Qt(Z.useMemo(() => {
    return oe.map(e => {
      return e.source;
    });
  }, [oe]));
  let W = (() => {
    if (!se) {
      return {
        images: [],
        texts: []
      };
    }
    let e = Array.isArray(se) ? se : [se];
    let t = [];
    let n = [];
    e.forEach(e => {
      let r = oe.find(t => {
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
  let G = t.loading;
  let ce = t.errorMessage;
  let le = t.fontSize || 14;
  let ue = e => {
    e.stopPropagation();
    navigator.clipboard.writeText(c);
    if (t.onShowToast) {
      t.onShowToast(`已复制文本`);
    }
  };
  let pe = n => {
    n.stopPropagation();
    if (t.onGenerateText) {
      t.onGenerateText(e, a, u, A);
    }
  };
  const Component398 = `button`;
  const Component399 = `button`;
  const Component400 = `button`;
  const Component401 = `div`;
  const Component402 = `div`;
  const Component403 = `input`;
  const Component404 = `span`;
  const Component405 = `div`;
  const Component406 = `span`;
  const Component407 = `span`;
  const Component408 = `div`;
  const Component409 = `span`;
  const Component410 = `div`;
  const Component411 = `div`;
  const Component412 = `div`;
  const Component413 = `div`;
  const Component474 = `div`;
  return <Component474 className={`relative flex flex-col items-center group/node transition-all ${n ? `z-50` : `z-10`}`}>
      <_cmp_Ti id={e} data={t} defaultTitle={`文本生成`} icon={<_Component3 size={11} className={`text-gray-500`} />} />
      <Component402 className={`absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`}>
        <Component401 className={`flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`}>
          {G && <_Component22 size={12} className={`animate-spin flex-shrink-0`} style={{
          color: `rgb(210,2,7)`
        }} />}
          {oe.length === 0 && <Component398 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} onClick={() => {
          return R.current?.click();
        }} title={`上传图片`}>
              <_Component8 size={12} />
            </Component398>}
          <Component399 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} onClick={ue} title={`复制文本`}>
            <_Component7 size={12} />
          </Component399>
          <Component400 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} onClick={() => {
          p(!f);
          r(e, {
            expanded: !f
          });
        }} title={f ? `收起输入` : `展开输入`}>
            {f ? <_Component23 size={12} /> : <Ke size={12} />}
          </Component400>
        </Component401>
      </Component402>
      <Component403 type={`file`} ref={R} style={{
      display: `none`
    }} accept={`image/*`} onChange={async n => {
      let r = n.target.files?.[0];
      if (r) {
        try {
          let n = await _cmp_jr(r, 2048, 0.85);
          if (t.onAddImage) {
            t.onAddImage(e, n);
          }
        } catch (e) {
          console.error(`Image resize failed:`, e);
        }
        n.target.value = ``;
      }
    }} />
      <Component413 ref={ne} className={`relative bg-[#1c1c1c] rounded-xl border shadow-xl transition-[border-color] duration-200 flex flex-col
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
        <Component412 className={`flex-1 min-h-0 p-3 overflow-hidden bg-[#1a1a1a] relative rounded-xl transition-[box-shadow,background-color] duration-150 ${g ? `nopan nowheel nodrag ring-1 ring-blue-500/40 bg-[#181818]` : `drag-handle cursor-grab ${y || x ? `bg-[#1d1d1d] ring-1 ring-white/10` : ``}`}`} title={g ? undefined : `双击编辑文本内容`} onMouseEnter={() => {
        if (!g && !G) {
          b(true);
        }
      }} onMouseLeave={() => {
        return b(false);
      }} onWheel={e => {
        return e.stopPropagation();
      }} onClick={e => {
        if (!g && !G && !ce && !(e.detail > 1)) {
          S(true);
          if (C.current) {
            clearTimeout(C.current);
          }
          C.current = setTimeout(() => {
            return S(false);
          }, 1600);
        }
      }} onDoubleClick={e => {
        e.stopPropagation();
        if (C.current) {
          clearTimeout(C.current);
        }
        S(false);
        b(false);
        if (!g) {
          _(true);
          setTimeout(() => {
            return z.current?.focus();
          }, 0);
        }
      }}>
          {G ? <_cmp__Component15 label={`生成中...`}>
              <_cmp_Ni category={`text`} />
            </_cmp__Component15> : null}
          {ce ? <Component405 className={`text-red-400 text-xs p-2 border border-red-500/30 rounded bg-red-500/10 flex items-start gap-2`}>
              <_Component16 size={14} className={`mt-0.5 flex-shrink-0`} />
              <Component404 className={`break-all`}>{ce}</Component404>
            </Component405> : <Q.Fragment>
              {!c && !G && !g && <Component408 className={`absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none transition-opacity duration-150`}>
                  <_Component3 size={72} className={`transition-colors duration-150 ${y || x ? `text-gray-500` : `text-gray-700`}`} strokeWidth={1.2} />
                  <Component406 className={`text-xs transition-colors duration-150 ${y || x ? `text-gray-300` : `text-gray-600`}`}>{`双击编辑内容`}</Component406>
                  <Component407 className={`text-[10px] text-gray-700`}>{`或使用下方输入区 AI 生成`}</Component407>
                </Component408>}
              <_cmp_Pi ref={z} className={`w-full h-full bg-transparent outline-none font-sans leading-relaxed custom-scrollbar nowheel ${g ? `nodrag nopan cursor-text` : `pointer-events-none`}`} style={{
            fontSize: `${le}px`,
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
              {!!c && !G && !g && (y || x) && <Component411 className={`absolute inset-x-0 bottom-2 flex justify-center pointer-events-none z-10`}>
                  <Component410 className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-black/70 text-[11px] text-gray-200 shadow-lg backdrop-blur-sm transition-opacity duration-150 ${x ? `opacity-100` : `opacity-90`}`}>
                    <_Component17 size={12} className={`text-blue-300`} />
                    <Component409>{`双击编辑`}</Component409>
                  </Component410>
                </Component411>}
            </Q.Fragment>}
          <_cmp_Fi targetRef={ne} minWidth={320} minHeight={180} onRequestFullscreen={() => {
          return h(true);
        }} />
        </Component412>
        <_cmp__Component10 type={`target`} position={X.Left} />
        <_cmp__Component10 type={`source`} position={X.Right} />
      </Component413>
      {(() => {
      const Component414 = `img`;
      const Component415 = `span`;
      const Component416 = `div`;
      const Component417 = `div`;
      const Component418 = `img`;
      const Component419 = `video`;
      const Component420 = `div`;
      const Component421 = `div`;
      const Component422 = `span`;
      const Component423 = `div`;
      const Component424 = `div`;
      const Component425 = `span`;
      const Component426 = `div`;
      const Component427 = `div`;
      const Component428 = `div`;
      const Component429 = `div`;
      const Component430 = `div`;
      const Component431 = `div`;
      const Component432 = `input`;
      const Component433 = `label`;
      const Component434 = `div`;
      const Component435 = `span`;
      const Component436 = `span`;
      const Component437 = `span`;
      const Component438 = `button`;
      const Component459 = `div`;
      const Component460 = `div`;
      const Component461 = `div`;
      const Component462 = `div`;
      const Component463 = `button`;
      const Component464 = `div`;
      const Component465 = `span`;
      const Component466 = `div`;
      const Component467 = `div`;
      const Component468 = `button`;
      const Component469 = `div`;
      const Component470 = `div`;
      const Component471 = `div`;
      let n = <Component471 className={`space-y-3`}>
            <Component431 className={`flex flex-col gap-2`}>
              {(W.images.length > 0 || W.texts.length > 0 || D.length > 0) && <Component427 className={`flex flex-wrap gap-2 mb-1`}>
                  {W.images.map((t, n) => {
              return <Component417 className={`w-8 h-8 rounded overflow-hidden border border-[#444] relative group bg-black`} title={`连线图片`} key={`img-${n}`}>
                        <Component414 src={ti(t.url, {
                  width: 200
                })} alt={`Ref`} className={`w-full h-full object-cover`} loading={`lazy`} decoding={`async`} onError={e => {
                  let n = e.currentTarget;
                  if (t.url && n.src !== t.url) {
                    n.src = t.url;
                  }
                }} />
                        <Component416 className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`} onClick={n => {
                  n.stopPropagation();
                  i(n => {
                    return n.filter(n => {
                      return n.target !== e || n.source !== t.id;
                    });
                  });
                }}>
                          <Component415 className={`text-white text-[8px]`}>{`×`}</Component415>
                        </Component416>
                      </Component417>;
            })}
                  {D.map((t, n) => {
              return <Component424 className={`w-8 h-8 rounded overflow-hidden border border-blue-500/50 relative group bg-black`} title={`通过 @ 选中的素材`} key={`ctx-${n}`}>
                        {t.type.startsWith(`image`) ? <Component418 src={ti(t.url, {
                  width: 200
                })} className={`w-full h-full object-cover opacity-80`} loading={`lazy`} decoding={`async`} onError={e => {
                  let n = e.currentTarget;
                  if (t.url && n.src !== t.url) {
                    n.src = t.url;
                  }
                }} /> : t.type.startsWith(`video`) ? <Component419 src={t.url} className={`w-full h-full object-cover opacity-80`} /> : <Component420 className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                            <_Component17 size={10} className={`text-gray-400`} />
                          </Component420>}
                        <Component421 className={`absolute inset-0 bg-blue-500/10 pointer-events-none`} />
                        <Component423 className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`} onClick={t => {
                  t.stopPropagation();
                  let i = D.filter((e, t) => {
                    return t !== n;
                  });
                  O(i);
                  r(e, {
                    selectedContextResources: i
                  });
                }}>
                          <Component422 className={`text-white text-[8px]`}>{`×`}</Component422>
                        </Component423>
                      </Component424>;
            })}
                  {W.texts.map((e, t) => {
              return <Component426 className={`h-8 px-2 bg-[#2a2a2a] border border-[#444] rounded flex items-center gap-1 text-[10px] text-gray-300 hover:bg-[#333] hover:border-blue-500 hover:text-blue-400 transition-colors cursor-help group/text`} title={e.text} key={`txt-${t}`}>
                        <_Component17 size={10} />
                        <Component425 className={`max-w-[60px] truncate`}>{e.label}</Component425>
                      </Component426>;
            })}
                </Component427>}
              <Component430 className={`flex items-start gap-2`}>
                <Component429 className={`flex-1 relative`}>
                  <_cmp_Pi ref={te} className={`w-full bg-transparent text-[15px] text-gray-200 outline-none leading-relaxed placeholder-gray-600 font-sans custom-scrollbar nodrag nowheel nopan`} style={{
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
                  ie(true);
                } else if (!n.includes(`@`)) {
                  ie(false);
                }
                if (!t.inputHeight || t.inputHeight <= 200) {
                  let t = te.current;
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
                  {H && <Component428 className={`absolute bottom-full left-0 mb-1 z-[100]`} onWheel={e => {
                return e.stopPropagation();
              }} onClick={e => {
                return e.stopPropagation();
              }}>
                      <_cmp_No resources={ae} onSelect={t => {
                  let n = a.lastIndexOf(`@`);
                  let i = n >= 0 ? a.substring(0, n) + a.substring(n + 1) : a;
                  if (t.type === `text`) {
                    let n = i + (t.url || ``);
                    o(n);
                    r(e, {
                      prompt: n
                    });
                  } else {
                    let n = [...D, t];
                    O(n);
                    r(e, {
                      selectedContextResources: n
                    });
                    o(i);
                    r(e, {
                      prompt: i
                    });
                  }
                  ie(false);
                }} onClose={() => {
                  return ie(false);
                }} />
                    </Component428>}
                </Component429>
              </Component430>
            </Component431>
            <Component470 className={`flex items-center justify-between pt-2 border-t border-[#2a2a2a]`}>
              <Component461 className={`flex items-center gap-1.5`}>
                <Component433 className={`flex items-center gap-1.5 cursor-pointer h-6 px-2 text-[11px] text-gray-400 hover:text-gray-200 select-none bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded transition-colors`}>
                  <Component432 type={`checkbox`} checked={u} onChange={t => {
                d(t.target.checked);
                r(e, {
                  autoSplit: t.target.checked
                });
              }} className={`accent-blue-500 rounded sm:w-3 sm:h-3`} />
                  {`自动拆分`}
                </Component433>
                {(!!t.textModel && !!(t.textModel.split(`
`).filter(e => {
              return e.trim() !== ``;
            }).length > 0) || !!(M.length > 0)) && <Component460 className={`relative nodrag flex items-center`} ref={V}>
                    <Component434 className={`w-[1px] h-3 bg-[#444] mr-1.5`} />
                    <Component438 className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`} onClick={e => {
                e.stopPropagation();
                re(!B);
              }} title={ee ? `调度：${ee.name}` : A ? `${A}（${ma(A) ? `内置` : `第三方`}）` : `选择模型`}>
                      {ee ? <Component435 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border bg-blue-500/20 text-blue-200 border-blue-400/40`}>{`调度`}</Component435> : A && <Component436 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${ma(A) ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                            {ma(A) ? `内置` : `三方`}
                          </Component436>}
                      <Component437 className={`whitespace-nowrap`}>
                        {ee ? ee.name : A || `选择模型`}
                      </Component437>
                    </Component438>
                    {B && <Component459 className={`absolute bottom-full left-0 mb-1 min-w-[17rem] w-max max-w-[29rem] bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 block max-h-60 overflow-y-auto custom-scrollbar nowheel nopan nodrag`} onWheel={e => {
                return e.stopPropagation();
              }} onClick={e => {
                return e.stopPropagation();
              }}>
                        {(() => {
                  let t = I;
                  let n = t.filter(e => {
                    return ma(e);
                  }).sort((e, t) => {
                    return e.localeCompare(t);
                  });
                  let i = t.filter(e => {
                    return !ma(e);
                  }).sort((e, t) => {
                    return e.localeCompare(t);
                  });
                  let a = (t, n, i) => {
                    let a = i ? sa(t) : null;
                    let o = i ? ca(t) : null;
                    let s = va(t, A === t);
                    const Component439 = `span`;
                    const Component440 = `span`;
                    const Component441 = `span`;
                    const Component442 = `span`;
                    const Component443 = `div`;
                    return <Component443 role={`button`} className={s.className} title={s.title} onClick={() => {
                      if (!s.disabled) {
                        j(t);
                        r(e, {
                          selectedModel: t
                        });
                        localStorage.setItem(`mutiwindow_text_model`, t);
                        re(false);
                      }
                    }} key={`${i ? `b` : `o`}-${n}`}>
                                <Component439 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${i ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                                  {i ? `内置` : `三方`}
                                </Component439>
                                <Component440 className={`flex-1 whitespace-nowrap`}>
                                  {t}
                                </Component440>
                                {a !== null && <Component442 className={`shrink-0 inline-flex items-center gap-0.5 text-[10px] text-orange-400 tabular-nums`}>
                                    <_Component19 className={`w-2.5 h-2.5`} strokeWidth={2.5} />
                                    <Component441>
                                      {ha(a)}
                                      {o ? `/${o}` : ``}
                                    </Component441>
                                  </Component442>}
                              </Component443>;
                  };
                  const Component444 = `span`;
                  const Component445 = `span`;
                  const Component446 = `span`;
                  const Component447 = `div`;
                  const Component452 = `div`;
                  const Component453 = `span`;
                  const Component454 = `span`;
                  const Component455 = `span`;
                  const Component456 = `div`;
                  const Component457 = `div`;
                  const Component458 = `div`;
                  return <Q.Fragment>
                              {M.length > 0 && <Q.Fragment>
                                  <Component447 className={`text-[10px] text-blue-300 mb-1 px-1 flex items-center justify-between`}>
                                    <Component445 className={`flex items-center gap-1`}>
                                      <_Component19 className={`w-2.5 h-2.5`} strokeWidth={2.5} />
                                      <Component444>{`模型调度`}</Component444>
                                    </Component445>
                                    <Component446 className={`ml-auto text-white/90 hover:text-white cursor-pointer transition-colors`} onClick={e => {
                          e.stopPropagation();
                          window.dispatchEvent(new CustomEvent(`mutiwindow-open-schedule-settings`));
                        }}>{`配置 ›`}</Component446>
                                  </Component447>
                                  {M.map(t => {
                        let n = Pa(t.id);
                        const Component448 = `span`;
                        const Component449 = `span`;
                        const Component450 = `span`;
                        const Component451 = `div`;
                        return <Component451 role={`button`} className={`w-full flex items-center gap-1.5 mb-1 last:mb-0 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors cursor-pointer ${A === n ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`} onClick={() => {
                          j(n);
                          r(e, {
                            selectedModel: n
                          });
                          localStorage.setItem(`mutiwindow_text_model`, n);
                          re(false);
                        }} title={`${t.name}（${t.steps.length} 个模型按序重试）`} key={t.id}>
                                        <Component448 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border bg-blue-500/20 text-blue-200 border-blue-400/40`}>{`调度`}</Component448>
                                        <Component449 className={`flex-1 whitespace-nowrap`}>
                                          {t.name}
                                        </Component449>
                                        <Component450 className={`shrink-0 text-[10px] text-gray-500`}>
                                          {t.steps.length}
                                          {` 模型`}
                                        </Component450>
                                      </Component451>;
                      })}
                                  {(n.length > 0 || i.length > 0) && <Component452 className={`h-px bg-[#333] my-1.5`} />}
                                </Q.Fragment>}
                              {n.length > 0 && <Q.Fragment>
                                  <Component456 className={`text-[10px] text-blue-300 mb-1 px-1 flex items-center gap-1`}>
                                    <Component453>{`✨`}</Component453>
                                    <Component454>{`内置模型`}</Component454>
                                    <Component455 className={`ml-auto text-white/90 hover:text-white cursor-pointer whitespace-nowrap`} onClick={e => {
                          e.stopPropagation();
                          window.dispatchEvent(new CustomEvent(`mutiwindow-open-builtin-settings`));
                          re(false);
                        }} title={`查看内置模型详情`}>{`详情 ›`}</Component455>
                                  </Component456>
                                  {n.map((e, t) => {
                        return a(e, t, true);
                      })}
                                </Q.Fragment>}
                              {i.length > 0 && <Q.Fragment>
                                  {n.length > 0 && <Component457 className={`h-px bg-[#333] my-1.5`} />}
                                  <Component458 className={`text-[10px] text-gray-500 mb-1 px-1`}>{`第三方 API`}</Component458>
                                  {i.map((e, t) => {
                        return a(e, t, false);
                      })}
                                </Q.Fragment>}
                            </Q.Fragment>;
                })()}
                      </Component459>}
                  </Component460>}
                <_cmp__Component20 category={`text`} presetPrompts={k} onApply={t => {
              let n = a ? `${a}, ${t}` : t;
              o(n);
              r(e, {
                prompt: n
              });
            }} onToast={e => {
              return t.onShowToast?.(e);
            }} />
              </Component461>
              {G ? <Component464 className={`flex items-center bg-red-500/10 rounded-full p-1 pl-3 border border-red-500/30 hover:border-red-500/50 transition-colors cursor-pointer group/btn flex-shrink-0 ml-2`} onClick={n => {
            n.stopPropagation();
            if (t.onStop) {
              t.onStop(e);
            }
          }}>
                  <Component462 className={`flex items-center gap-1 mr-3 text-xs text-red-400 group-hover/btn:text-red-300`}>{`停止`}</Component462>
                  <Component463 className={`bg-red-500/20 text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-500/30 transition-colors`}>
                    <T size={10} fill={`currentColor`} />
                  </Component463>
                </Component464> : <Component469 className={`flex items-center bg-[#2a2a2a] rounded-full p-1 pl-3 border border-[#333] hover:border-gray-500 transition-colors cursor-pointer group/btn flex-shrink-0 ml-2`} onClick={pe}>
                  {A && ma(A) && sa(A) !== null && <Component466 className={`flex items-center gap-0.5 mr-2 text-[11px] text-orange-400 tabular-nums`}>
                      <_Component19 className={`w-3 h-3`} strokeWidth={2.5} />
                      <Component465>
                        {ha(sa(A) || 0)}
                        {ca(A) ? `/${ca(A)}` : ``}
                      </Component465>
                    </Component466>}
                  <Component467 className={`flex items-center gap-1 mr-3 text-xs text-gray-300 group-hover/btn:text-white`}>{`生成`}</Component467>
                  <Component468 className={`bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors`}>
                    <_Component21 size={14} strokeWidth={3} />
                  </Component468>
                </Component469>}
            </Component470>
          </Component471>;
      const Component472 = `div`;
      const Component473 = `textarea`;
      return <Q.Fragment>
            <Component472 className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[#1c1c1c] rounded-2xl border border-[#333] shadow-2xl min-w-[420px] w-max max-w-[920px] transition-all duration-300 origin-top z-50
                ${f ? `opacity-100 scale-100 p-4 overflow-visible` : `opacity-0 scale-95 pointer-events-none h-0 p-0 border-0 overflow-hidden`}
              `} onClick={e => {
          return e.stopPropagation();
        }}>
              {!w && n}
              {f && !w && <_cmp_Fi targetRef={te} onRequestFullscreen={() => {
            return E(true);
          }} onResizeEnd={(t, n) => {
            return r(e, {
              inputWidth: t,
              inputHeight: n
            });
          }} />}
            </Component472>
            <_cmp_Ii open={w} title={`编辑提示词 - 文本`} onClose={() => {
          return E(false);
        }}>
              {n}
            </_cmp_Ii>
            <_cmp_Ii open={m} title={`编辑文本内容`} onClose={() => {
          return h(false);
        }}>
              <Component473 autoFocus={true} className={`w-full h-full bg-[#0d0c0c] text-gray-100 outline-none custom-scrollbar resize-none p-4 rounded`} style={{
            fontSize: `${le}px`,
            lineHeight: 1.7
          }} value={c} onChange={t => {
            l(t.target.value);
            r(e, {
              text: t.target.value
            });
          }} />
            </_cmp_Ii>
          </Q.Fragment>;
    })()}
    </Component474>;
});
export default Po;