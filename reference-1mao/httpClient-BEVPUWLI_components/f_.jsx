// TODO(全局, 无需 import): data, updateNodeData, n, r, html, i, fontSize, o, bold, color, u, bgColor, f, width, m, height, g, x, v, s, fontWeight, l, ee, startX, startY, startW, startH, lineHeight, minHeight, background, borderRadius, k, padding, borderLeft, cursor, __html, overflow, p, z, b, left
import { id, t, We, d_, s_, o_, e, O, c, u_, y, E, a, C, T, M, F, I, L, d, c_, D, h, _, re, A, j, P, V, N, w, S, l_, ne, te, R, B } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
export default function f_({
  id: e,
  data: t
}) {
  let n = t;
  let {
    updateNodeData: r
  } = We();
  let [i, a] = Z.useState(n.html ?? (n.text ? d_(n.text) : ``));
  let [o, s] = Z.useState(n.fontSize ?? 24);
  let [c, l] = Z.useState(n.bold ?? false);
  let [u, d] = Z.useState(n.color ?? s_[0].value);
  let [f, p] = Z.useState(n.bgColor ?? o_[0].value);
  let [m, h] = Z.useState(n.width ?? 400);
  let [g, _] = Z.useState(n.height ?? 400);
  let [v, y] = Z.useState(false);
  let [b, x] = Z.useState(null);
  let [S, C] = Z.useState(false);
  let [w, T] = Z.useState(false);
  let E = Z.useRef(null);
  let D = Z.useRef(null);
  let O = Z.useCallback(t => {
    r(e, t);
  }, [e, r]);
  Z.useEffect(() => {
    O({
      html: i,
      fontSize: o,
      bold: c,
      color: u,
      bgColor: f,
      width: m,
      height: g
    });
  }, [i, o, c, u, f, m, g, O]);
  let k = f === `transparent`;
  let A = u_(f);
  let j = e => {
    e.stopPropagation();
    y(true);
    setTimeout(() => {
      let e = E.current;
      if (e) {
        e.innerHTML = i;
        e.focus();
        let t = document.createRange();
        t.selectNodeContents(e);
        t.collapse(false);
        let n = window.getSelection();
        n?.removeAllRanges();
        n?.addRange(t);
      }
    }, 50);
  };
  let M = () => {
    if (E.current) {
      a(E.current.innerHTML);
    }
    y(false);
    x(null);
    C(false);
    T(false);
  };
  let N = () => {
    M();
  };
  let P = e => {
    if (!v) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    let t = e.currentTarget.closest(`.react-flow__node`)?.getBoundingClientRect();
    x({
      x: e.clientX - (t?.left ?? 0),
      y: e.clientY - (t?.top ?? 0)
    });
  };
  let F = () => {
    if (E.current) {
      a(E.current.innerHTML);
    }
  };
  let I = () => {
    let e = window.getSelection();
    if (!e || e.rangeCount === 0 || e.isCollapsed) {
      return false;
    }
    let t = E.current;
    if (t) {
      return t.contains(e.anchorNode) && t.contains(e.focusNode);
    } else {
      return false;
    }
  };
  let L = e => {
    let t = window.getSelection();
    if (!t || t.rangeCount === 0 || t.isCollapsed) {
      return;
    }
    let n = t.getRangeAt(0);
    let r = document.createElement(`span`);
    Object.assign(r.style, e);
    try {
      n.surroundContents(r);
    } catch {
      let e = n.extractContents();
      r.appendChild(e);
      n.insertNode(r);
    }
    let i = document.createRange();
    i.selectNodeContents(r);
    t.removeAllRanges();
    t.addRange(i);
    F();
  };
  let ee = e => {
    if (v && I()) {
      L({
        fontSize: `${e}px`
      });
    } else {
      s(e);
    }
    x(null);
  };
  let R = e => {
    if (v && I()) {
      L({
        color: e
      });
    } else {
      d(e);
    }
    x(null);
  };
  let te = () => {
    if (v && I()) {
      L({
        fontWeight: `700`
      });
    } else {
      l(e => {
        return !e;
      });
    }
    x(null);
  };
  let z = e => {
    let t = c_.indexOf(o);
    let n = t === -1 ? c_.findIndex(e => {
      return e >= o;
    }) : t;
    ee(c_[Math.max(0, Math.min(c_.length - 1, (n === -1 ? c_.length - 1 : n) + e))]);
  };
  let ne = e => {
    let t = E.current;
    if (t) {
      t.focus();
      document.execCommand(`insertText`, false, e);
      F();
    }
    C(false);
  };
  let B = e => {
    e.preventDefault();
    e.stopPropagation();
    D.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: m,
      startH: g
    };
    let t = e => {
      if (!D.current) {
        return;
      }
      let t = Math.max(200, D.current.startW + e.clientX - D.current.startX);
      let n = Math.max(150, D.current.startH + e.clientY - D.current.startY);
      h(t);
      _(n);
    };
    let n = () => {
      D.current = null;
      window.removeEventListener(`mousemove`, t);
      window.removeEventListener(`mouseup`, n);
    };
    window.addEventListener(`mousemove`, t);
    window.addEventListener(`mouseup`, n);
  };
  let re = (e => {
    if (e >= 96) {
      return 1.08;
    } else {
      if (e >= 64) {
        return 1.12;
      } else {
        if (e >= 32) {
          return 1.16;
        } else {
          if (e >= 18) {
            return 1.22;
          } else {
            return 1.28;
          }
        }
      }
    }
  })(o);
  let V = {
    fontSize: o,
    color: u,
    fontWeight: c ? 700 : 400,
    lineHeight: re
  };
  const Component2359 = `style`;
  const Component2360 = `div`;
  const Component2361 = `span`;
  const Component2362 = `div`;
  const Component2363 = `div`;
  const Component2364 = `button`;
  const Component2365 = `button`;
  const Component2366 = `div`;
  const Component2367 = `div`;
  const Component2368 = `button`;
  const Component2369 = `button`;
  const Component2370 = `div`;
  const Component2371 = `div`;
  const Component2372 = `button`;
  const Component2373 = `button`;
  const Component2374 = `button`;
  const Component2375 = `div`;
  const Component2376 = `button`;
  const Component2377 = `div`;
  const Component2378 = `div`;
  const Component2379 = `div`;
  const Component2380 = `button`;
  const Component2381 = `button`;
  const Component2382 = `div`;
  const Component2383 = `div`;
  const Component2384 = `button`;
  const Component2385 = `div`;
  const Component2386 = `div`;
  const Component2387 = `div`;
  const Component2388 = `button`;
  const Component2389 = `div`;
  const Component2390 = `div`;
  const Component2391 = `path`;
  const Component2392 = `svg`;
  const Component2393 = `div`;
  const Component2394 = `div`;
  return <Q.Fragment>
      <Component2359>{`.sticky-editor:empty:before{content:attr(data-placeholder);color:#666;pointer-events:none;}`}</Component2359>
      <Component2394 className={`relative group/sticky select-none ${v ? `nodrag nopan nowheel` : ``}`} style={{
      width: m,
      minHeight: g,
      background: f,
      borderRadius: k ? 0 : 8,
      padding: k ? `4px 0` : `16px 20px`,
      borderLeft: k ? `none` : `4px solid ${A}`
    }} onDoubleClick={j} onClick={() => {
      x(null);
    }} onContextMenu={P}>
        {!v && <Component2362 className={`w-full whitespace-pre-wrap break-words`} style={{
        ...V,
        minHeight: 60,
        cursor: `grab`
      }}>
            {i ? <Component2360 dangerouslySetInnerHTML={{
          __html: i
        }} /> : <Component2361 style={{
          color: `#666`
        }}>{`双击编辑...`}</Component2361>}
          </Component2362>}
        {v && <Q.Fragment>
            <Component2363 ref={E} contentEditable={true} suppressContentEditableWarning={true} className={`sticky-editor w-full bg-transparent border-none outline-none whitespace-pre-wrap break-words nopan nowheel nodrag`} style={{
          ...V,
          minHeight: Math.max(100, g - 80),
          overflow: `hidden`
        }} onInput={F} onBlur={N} onKeyDown={e => {
          if (e.key === `Escape`) {
            M();
          }
        }} data-placeholder={`输入内容...`} />
            <Component2378 className={`flex items-center gap-2 mt-2 pt-2 border-t border-white/10 nodrag nopan`} onClick={e => {
          return e.stopPropagation();
        }} onMouseDown={e => {
          return e.preventDefault();
        }}>
              <Component2367 className={`relative`}>
                <Component2364 className={`w-6 h-6 rounded border border-white/20 cursor-pointer`} style={{
              background: k ? `repeating-conic-gradient(#333 0% 25%, #555 0% 50%) 50%/6px 6px` : f
            }} onClick={() => {
              T(!w);
              C(false);
            }} title={`便签底色`} />
                {w && <Component2366 className={`absolute bottom-8 left-0 z-50 bg-[#2a2a2a] border border-[#444] rounded-lg p-2 flex gap-1.5 shadow-xl`}>
                    {o_.map(e => {
                return <Component2365 className={`w-6 h-6 rounded border transition-all cursor-pointer ${f === e.value ? `border-white scale-110` : `border-transparent hover:border-white/40`}`} style={{
                  background: e.value === `transparent` ? `repeating-conic-gradient(#333 0% 25%, #555 0% 50%) 50%/6px 6px` : e.value
                }} onClick={() => {
                  p(e.value);
                  T(false);
                }} title={e.name} key={e.name} />;
              })}
                  </Component2366>}
              </Component2367>
              <Component2371 className={`relative`}>
                <Component2368 className={`text-sm px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-400 cursor-pointer`} onClick={() => {
              C(!S);
              T(false);
            }}>{`😀`}</Component2368>
                {S && <Component2370 className={`absolute bottom-8 left-0 z-50 bg-[#2a2a2a] border border-[#444] rounded-lg p-2 grid grid-cols-6 gap-1 w-[180px] shadow-xl`}>
                    {l_.map(e => {
                return <Component2369 className={`text-base w-7 h-7 flex items-center justify-center rounded hover:bg-[#444] cursor-pointer`} onClick={() => {
                  return ne(e);
                }} key={e}>
                          {e}
                        </Component2369>;
              })}
                  </Component2370>}
              </Component2371>
              <Component2372 className={`w-7 h-7 rounded font-bold cursor-pointer transition-colors ${c ? `bg-white/20 text-white` : `bg-white/5 text-gray-400 hover:bg-white/10`}`} onClick={te} title={`加粗（选中文字则只改选中部分）`}>{`B`}</Component2372>
              <Component2375 className={`flex items-center gap-0.5`}>
                <Component2373 className={`w-6 h-7 rounded bg-white/5 hover:bg-white/10 text-gray-400 text-xs cursor-pointer`} onClick={() => {
              return z(-1);
            }} title={`减小字号`}>{`A-`}</Component2373>
                <Component2374 className={`w-7 h-7 rounded bg-white/5 hover:bg-white/10 text-gray-300 text-sm cursor-pointer`} onClick={() => {
              return z(1);
            }} title={`增大字号`}>{`A+`}</Component2374>
              </Component2375>
              <Component2377 className={`flex items-center gap-0.5 ml-1`}>
                {s_.slice(0, 5).map(e => {
              return <Component2376 className={`w-4 h-4 rounded-full border transition-all cursor-pointer ${u === e.value ? `border-white scale-125` : `border-transparent hover:border-white/50`}`} style={{
                background: e.value
              }} onClick={() => {
                return R(e.value);
              }} title={e.name} key={e.name} />;
            })}
              </Component2377>
            </Component2378>
          </Q.Fragment>}
        {b && <Component2390 className={`absolute z-[9999] bg-[#222]/95 backdrop-blur border border-[#444] rounded-xl shadow-2xl p-2 min-w-[160px] nodrag nopan`} style={{
        left: b.x,
        top: b.y
      }} onClick={e => {
        return e.stopPropagation();
      }} onMouseDown={e => {
        return e.preventDefault();
      }}>
            <Component2379 className={`text-[10px] text-gray-500 px-2 mb-1`}>{`文字（选中后仅改选中部分）`}</Component2379>
            <Component2382 className={`flex items-center gap-1 px-2 mb-2`}>
              <Component2380 className={`w-6 h-6 rounded font-bold text-xs cursor-pointer ${c ? `bg-white/20 text-white` : `text-gray-400 hover:bg-white/10`}`} onClick={te} title={`加粗`}>{`B`}</Component2380>
              {s_.map(e => {
            return <Component2381 className={`w-5 h-5 rounded-full border transition-all cursor-pointer ${u === e.value ? `border-white scale-125` : `border-transparent hover:border-white/50`}`} style={{
              background: e.value
            }} onClick={() => {
              return R(e.value);
            }} title={e.name} key={e.name} />;
          })}
            </Component2382>
            <Component2383 className={`text-[10px] text-gray-500 px-2 mb-1`}>{`字号`}</Component2383>
            <Component2385 className={`flex items-center gap-1 px-2 flex-wrap mb-2`}>
              {c_.map(e => {
            return <Component2384 className={`text-[10px] px-1.5 py-0.5 rounded transition-all cursor-pointer ${o === e ? `bg-white/20 text-white` : `text-gray-400 hover:bg-white/10`}`} onClick={() => {
              return ee(e);
            }} key={e}>
                    {e}
                  </Component2384>;
          })}
            </Component2385>
            <Component2386 className={`h-px bg-[#444] my-1.5`} />
            <Component2387 className={`text-[10px] text-gray-500 px-2 mb-1`}>{`便签底色`}</Component2387>
            <Component2389 className={`flex items-center gap-1 px-2`}>
              {o_.map(e => {
            return <Component2388 className={`w-5 h-5 rounded border transition-all cursor-pointer ${f === e.value ? `border-white scale-110` : `border-transparent hover:border-white/40`}`} style={{
              background: e.value === `transparent` ? `repeating-conic-gradient(#333 0% 25%, #555 0% 50%) 50%/6px 6px` : e.value
            }} onClick={() => {
              p(e.value);
              x(null);
            }} title={e.name} key={e.name} />;
          })}
            </Component2389>
          </Component2390>}
        <Component2393 className={`absolute bottom-1 right-1 w-4 h-4 cursor-nwse-resize opacity-0 group-hover/sticky:opacity-60 transition-opacity nodrag`} onMouseDown={B} title={`拖拽调整大小`}>
          <Component2392 width={`16`} height={`16`} viewBox={`0 0 16 16`} fill={`none`}>
            <Component2391 d={`M14 2L2 14M14 6L6 14M14 10L10 14`} stroke={`#888`} strokeWidth={`1.5`} strokeLinecap={`round`} />
          </Component2392>
        </Component2393>
      </Component2394>
    </Q.Fragment>;
}