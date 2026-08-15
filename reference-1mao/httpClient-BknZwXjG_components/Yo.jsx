// TODO(全局, 无需 import): data, selected, r, i, layers, canvasWidth, canvasHeight, updateNodeData, l, s, mergeMode, rows, cols, cellSize, p, aspectRatio, autoSize, titlePattern, longDirection, x, longGap, longTargetSize, longAutoSize, bgColor, overlayState, ce, handleType, n, o, se, u, z, f, m, cellW, cellH, de, imageUrl, minHeight, maxHeight, ee, gridTemplateColumns, gridTemplateRows, length, ie, oe, left, transform, minWidth, k, b, v, g, opacity, me
import _cmp__Component8 from "./_Component8.jsx";
import _cmp__Component12 from "./_Component12.jsx";
import _cmp_Uo from "./Uo.jsx";
import _cmp_Vo from "./Vo.jsx";
import { id, t, e, nn, We, W, le, h, _, y, C, T, D, N, U, Lt, Qt, G, ue, c, ne, H, re, B, qo, w, Jo, L, pe, te, I, he, X, F, _e, V, ae, R, P, Wo, ge, M, A, Go, j, Ko, S, O, E, Et, _Component28, Fe, _Component30, Kt, _Component25 } from "./shared.js";
import * as _shared from "./shared.js";
import * as Z from "react";
import * as Q from "react";
var Yo = Z.memo(({
  id: e,
  data: t,
  selected: n
}) => {
  let r = typeof t.gridSize == `number` ? t.gridSize : undefined;
  let i = t.rows ?? r ?? 3;
  let a = t.cols ?? r ?? 3;
  let [s, c] = Z.useState(t.mergeMode || `grid`);
  let [l, u] = Z.useState(i);
  let [d, f] = Z.useState(a);
  let [p, m] = Z.useState(t.cellSize || 512);
  let [h, g] = Z.useState(t.aspectRatio || `1:1`);
  let [_, v] = Z.useState(t.autoSize ?? true);
  let [y, b] = Z.useState(t.titlePattern || ``);
  let [x, S] = Z.useState(t.longDirection || `vertical`);
  let [C, w] = Z.useState(t.longGap ?? 0);
  let [T, E] = Z.useState(t.longTargetSize ?? 1024);
  let [D, O] = Z.useState(t.longAutoSize ?? true);
  let [k, A] = Z.useState(false);
  let [j, M] = Z.useState(`${i}x${a}`);
  let [N, P] = Z.useState(t.bgColor || `transparent`);
  let [F, I] = Z.useState(t.imageUrl || null);
  let [ee, L] = Z.useState(null);
  let [R, te] = Z.useState(false);
  let [z, ne] = Z.useState([]);
  let [B, re] = Z.useState([]);
  let [V, ie] = Z.useState(null);
  let [ae, oe] = Z.useState(null);
  let H = Z.useRef(false);
  let se = Z.useRef(``);
  let [ce, U] = Z.useState(() => {
    let e = t.overlayState;
    if (e && Array.isArray(e.layers)) {
      return e;
    } else {
      return {
        layers: [],
        canvasWidth: t.canvasWidth || 1024,
        canvasHeight: t.canvasHeight || 1024
      };
    }
  });
  let W = nn();
  let {
    updateNodeData: le
  } = We();
  Z.useEffect(() => {
    W(e);
  }, [l, d, s, e, W]);
  Z.useEffect(() => {
    le(e, {
      mergeMode: s,
      rows: l,
      cols: d,
      cellSize: p,
      aspectRatio: h,
      autoSize: _,
      titlePattern: y,
      longDirection: x,
      longGap: C,
      longTargetSize: T,
      longAutoSize: D,
      bgColor: N,
      overlayState: ce,
      canvasWidth: ce.canvasWidth,
      canvasHeight: ce.canvasHeight
    });
  }, [s, l, d, p, h, _, y, x, C, T, D, N, ce, e, le]);
  Z.useEffect(() => {
    if (ce.bgColor !== N) {
      U(e => {
        return {
          ...e,
          bgColor: N
        };
      });
    }
  }, [N]);
  let G = Lt({
    handleType: `target`
  });
  let ue = Qt(G.map(e => {
    return e.source;
  }));
  Z.useEffect(() => {
    let e = l * d;
    let t = Array(e).fill(null);
    let n = [];
    let r = 0;
    let i = ue ? Array.isArray(ue) ? ue : [ue] : [];
    for (let a of G) {
      let o = a.targetHandle;
      let s = i.find(e => {
        return e.id === a.source;
      })?.data;
      if (!s) {
        continue;
      }
      let c = () => {
        if (s.images && Array.isArray(s.images)) {
          let e = s.images;
          let t = s.selectedIds || [];
          if (t.length > 0) {
            let n = new Set(t);
            let r = [];
            e.forEach(e => {
              if (e?.url && n.has(e.id)) {
                r.push(e.url);
              }
            });
            if (r.length > 0) {
              return r;
            }
          }
          let n = e.map(e => {
            return e?.url;
          }).filter(e => {
            return !!e;
          });
          if (n.length > 0) {
            return n;
          }
        }
        if (Array.isArray(s.extractedImages)) {
          return s.extractedImages.filter(Boolean);
        } else if (s.imageUrl) {
          return [s.imageUrl];
        } else {
          return [];
        }
      };
      if (o === 'default' || !o) {
        let e = c();
        for (let i of e) {
          for (n.push(i); r < t.length && t[r] !== null;) {
            r++;
          }
          if (r < t.length) {
            t[r] = i;
          }
        }
      } else if (o && o.startsWith(`cell-`)) {
        let r = parseInt(o.replace(`cell-`, ``), 10);
        if (r >= 0 && r < e) {
          if (s.imageUrl) {
            t[r] = s.imageUrl;
            n.push(s.imageUrl);
          } else if (Array.isArray(s.extractedImages)) {
            let e = s.extractedImages.find(Boolean);
            if (e) {
              t[r] = e;
              n.push(e);
            }
          }
        }
      }
    }
    ne(e => {
      let r = JSON.stringify(n);
      if (r === se.current) {
        if (H.current && e.length === t.length) {
          return e;
        } else {
          return t;
        }
      } else {
        se.current = r;
        H.current = false;
        return t;
      }
    });
    re(e => {
      if (H.current && e.length === n.length) {
        return e;
      } else {
        return n;
      }
    });
  }, [G, ue, l, d]);
  let de = Z.useRef(null);
  let pe = Z.useCallback(async e => {
    try {
      if (s === `longImage`) {
        let t = B;
        if (t.length === 0) {
          return null;
        }
        let n = (await Promise.all(t.map(qo))).filter(Boolean);
        if (n.length === 0) {
          return null;
        }
        let r = x === `vertical`;
        let i = D ? r ? n[0].width : n[0].height : T;
        let a = 0;
        let o = 0;
        let s = [];
        if (r) {
          a = i;
          for (let e of n) {
            let t = i;
            let n = Math.round(e.height / e.width * i);
            s.push({
              w: t,
              h: n
            });
            o += n;
          }
          o += C * Math.max(0, n.length - 1);
        } else {
          o = i;
          for (let e of n) {
            let t = i;
            let n = Math.round(e.width / e.height * i);
            s.push({
              w: n,
              h: t
            });
            a += n;
          }
          a += C * Math.max(0, n.length - 1);
        }
        let c = e ? 1 : Math.min(1, 800 / Math.max(a, o));
        let l = document.createElement(`canvas`);
        l.width = Math.max(1, Math.round(a * c));
        l.height = Math.max(1, Math.round(o * c));
        let u = l.getContext(`2d`);
        if (!u) {
          return null;
        }
        Jo(u, l.width, l.height, e, N);
        let d = 0;
        n.forEach((e, t) => {
          let n = s[t];
          let i = n.w * c;
          let a = n.h * c;
          if (r) {
            u.drawImage(e, 0, d, i, a);
            d += a + C * c;
          } else {
            u.drawImage(e, d, 0, i, a);
            d += i + C * c;
          }
        });
        return l.toDataURL(e ? `image/png` : `image/jpeg`, e ? 1 : 0.85);
      }
      if (s === `grid`) {
        let t = l * d;
        let n = z.slice(0, t);
        let r = await Promise.all(n.map(e => {
          if (e) {
            return qo(e);
          } else {
            return Promise.resolve(null);
          }
        }));
        let i = p;
        let a = p;
        let o = r.find(Boolean);
        if (_ && o) {
          i = o.width;
          a = o.height;
        } else {
          let [e, t] = h.split(`:`).map(Number);
          let n = e / t;
          a = Math.round(p / n);
        }
        let s = i * d;
        let c = a * l;
        let u = e ? 1 : Math.min(1, 600 / Math.max(s, c));
        let f = document.createElement(`canvas`);
        f.width = Math.max(1, Math.round(s * u));
        f.height = Math.max(1, Math.round(c * u));
        let m = f.getContext(`2d`);
        if (m) {
          Jo(m, f.width, f.height, e, N, {
            rows: l,
            cols: d,
            cellW: i * u,
            cellH: a * u
          });
          r.forEach((e, n) => {
            if (n >= t) {
              return;
            }
            let r = Math.floor(n / d);
            let o = n % d * i * u;
            let s = r * a * u;
            let c = i * u;
            let l = a * u;
            if (e) {
              m.drawImage(e, o, s, c, l);
            }
            let f = y.trim() ? y.replace(`{num}`, (n + 1).toString()) : ``;
            if (f) {
              let e = Math.max(12, c * 0.08);
              m.font = `bold ${e}px sans-serif`;
              let t = m.measureText(f);
              let n = e * 0.6;
              let r = e * 0.4;
              let i = t.width + n * 2;
              let a = e + r * 2;
              let l = c * 0.03;
              m.fillStyle = `rgba(0,0,0,0.75)`;
              let u = o + l;
              let d = s + l;
              m.beginPath();
              if (typeof m.roundRect == `function`) {
                m.roundRect(u, d, i, a, 8);
              } else {
                m.rect(u, d, i, a);
              }
              m.fill();
              m.fillStyle = `#fff`;
              m.textBaseline = `middle`;
              m.textAlign = `center`;
              m.fillText(f, u + i / 2, d + a / 2 + 2);
            }
          });
          return f.toDataURL(e ? `image/png` : `image/jpeg`, e ? 1 : 0.85);
        } else {
          return null;
        }
      }
      return null;
    } catch (e) {
      console.error(`renderToCanvas failed`, e);
      return null;
    }
  }, [s, B, x, D, T, C, z, l, d, p, _, h, y, N]);
  Z.useEffect(() => {
    if (de.current) {
      window.clearTimeout(de.current);
    }
    de.current = window.setTimeout(async () => {
      L(await pe(false));
    }, 250);
    return () => {
      if (de.current) {
        window.clearTimeout(de.current);
      }
    };
  }, [pe]);
  let me = Z.useCallback(async () => {
    if ((s !== `longImage` || B.length !== 0) && (s !== `grid` || !z.every(e => {
      return !e;
    })) && (s !== `overlay` || ce.layers.length !== 0)) {
      te(true);
      try {
        let n = null;
        if (s === `overlay`) {
          n = await _cmp_Vo(ce);
        } else {
          n = await pe(true);
        }
        if (n) {
          I(n);
          le(e, {
            imageUrl: n
          });
          W(e);
          if (typeof t.onSpawnImageNode == `function`) {
            t.onSpawnImageNode(e, n, `merged-${s}`);
          }
        }
      } finally {
        te(false);
      }
    }
  }, [s, B, z, ce, pe, e, le, W, t]);
  let he = l * d;
  let ge = (e, t) => {
    return l === e && d === t;
  };
  Z.useMemo(() => {
    return null;
  }, []);
  let _e = Z.useMemo(() => {
    if (s === `longImage`) {
      return Math.max(1, B.length || 3);
    } else {
      return he;
    }
  }, [s, B.length, he]);
  const Component604 = `button`;
  const Component605 = `button`;
  const Component606 = `button`;
  const Component607 = `div`;
  const Component608 = `div`;
  const Component609 = `img`;
  const Component610 = `div`;
  const Component611 = `div`;
  const Component614 = `div`;
  const Component617 = `div`;
  const Component618 = `div`;
  const Component619 = `div`;
  const Component620 = `span`;
  const Component621 = `button`;
  const Component622 = `input`;
  const Component623 = `span`;
  const Component624 = `div`;
  const Component625 = `button`;
  const Component626 = `button`;
  const Component627 = `div`;
  const Component628 = `span`;
  const Component629 = `input`;
  const Component630 = `span`;
  const Component631 = `span`;
  const Component632 = `input`;
  const Component633 = `span`;
  const Component634 = `input`;
  const Component635 = `div`;
  const Component636 = `input`;
  const Component637 = `div`;
  const Component638 = `option`;
  const Component639 = `option`;
  const Component640 = `option`;
  const Component641 = `option`;
  const Component642 = `option`;
  const Component643 = `select`;
  const Component644 = `option`;
  const Component645 = `option`;
  const Component646 = `option`;
  const Component647 = `option`;
  const Component648 = `option`;
  const Component649 = `select`;
  const Component650 = `div`;
  const Component651 = `span`;
  const Component652 = `button`;
  const Component653 = `button`;
  const Component654 = `span`;
  const Component655 = `div`;
  const Component656 = `input`;
  const Component657 = `label`;
  const Component658 = `span`;
  const Component659 = `input`;
  const Component660 = `span`;
  const Component661 = `input`;
  const Component662 = `div`;
  const Component663 = `div`;
  const Component664 = `button`;
  const Component665 = `div`;
  const Component666 = `div`;
  const Component667 = `div`;
  const Component668 = `div`;
  const Component669 = `div`;
  return <Component669 className={`relative flex flex-col`}>
      <Component608 className={`mb-1 flex items-center justify-between gap-2 min-w-[320px]`}>
        <_cmp__Component8 id={e} data={t} defaultTitle={`图像拼图`} icon={<Et size={11} className={`text-gray-500`} />} className={`!mb-0`} />
        <Component607 className={`flex items-center gap-1 nodrag`}>
          <Component604 className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 border transition-colors ${s === `grid` ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white`}`} onClick={() => {
          return c(`grid`);
        }} title={`网格拼图`}>
            <_Component28 size={11} />
            {` 网格`}
          </Component604>
          <Component605 className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 border transition-colors ${s === `longImage` ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white`}`} onClick={() => {
          return c(`longImage`);
        }} title={`无限长图`}>
            <Fe size={11} />
            {` 长图`}
          </Component605>
          <Component606 className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 border transition-colors ${s === `overlay` ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white`}`} onClick={() => {
          return c(`overlay`);
        }} title={`叠加`}>
            <_Component30 size={11} />
            {` 叠加`}
          </Component606>
        </Component607>
      </Component608>
      <Component668 className={`relative bg-[#1c1c1c] rounded-xl border shadow-xl transition-all duration-300 min-w-[320px] flex flex-col ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}>
        <_cmp__Component12 type={`target`} id={`default`} position={X.Left} className={`!w-4 !h-4 z-50`} style={{
        top: `15px`
      }} />
        <_cmp__Component12 type={`source`} position={X.Right} id={`merged-output`} />
        <Component667 className={`p-3 space-y-3 bg-[#1a1a1a] ${F ? `rounded-b-xl` : `rounded-xl`} relative drag-handle`}>
          {s !== `overlay` && <Component619 className={`bg-[#0d0c0c] rounded border border-[#333] flex items-center justify-center relative overflow-hidden nodrag`} style={{
          minHeight: 160,
          maxHeight: 360
        }}>
              {ee ? <Component609 src={ee} alt={`Preview`} className={`max-w-full max-h-[360px] object-contain block`} /> : <Component611 className={`grid w-full p-2 gap-1 opacity-50`} style={{
            gridTemplateColumns: s === `longImage` ? `1fr` : `repeat(${d}, minmax(0, 1fr))`,
            gridTemplateRows: s === `longImage` ? `repeat(${_e}, minmax(40px, 1fr))` : `repeat(${l}, minmax(0, 1fr))`,
            minHeight: 160
          }}>
                  {Array.from({
              length: _e
            }).map((e, t) => {
              return <Component610 className={`border border-[#333] border-dashed rounded-[2px] flex items-center justify-center bg-[#1a1a1a] text-[10px] text-[#555] min-h-[40px]`} key={t}>
                        {`图 `}
                        {t + 1}
                      </Component610>;
            })}
                </Component611>}
              {s === `grid` && <Component614 className={`absolute inset-0 grid gap-1 p-2 pointer-events-none`} style={{
            gridTemplateColumns: `repeat(${d}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${l}, minmax(0, 1fr))`
          }}>
                  {Array.from({
              length: he
            }).map((e, t) => {
              let n = z[t];
              let r = V === t;
              let i = V !== null && V !== t && ae === t;
              const Component612 = `span`;
              const Component613 = `div`;
              return <Component613 className={`relative pointer-events-auto group/cell rounded-[2px] transition-all
                      ${n ? `cursor-grab active:cursor-grabbing` : ``}
                      ${r ? `opacity-30 ring-2 ring-blue-300` : ``}
                      ${i ? `ring-2 ring-blue-400 bg-blue-400/15 shadow-[inset_0_0_0_2px_rgba(96,165,250,0.6)]` : ``}
                    `} draggable={!!n} onDragStart={e => {
                if (!n) {
                  return;
                }
                e.stopPropagation();
                ie(t);
                e.dataTransfer.effectAllowed = `move`;
                e.dataTransfer.setData(`application/x-yimao-puzzle`, String(t));
                let r = document.createElement(`div`);
                r.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;`;
                document.body.appendChild(r);
                e.dataTransfer.setDragImage(r, 0, 0);
                setTimeout(() => {
                  try {
                    document.body.removeChild(r);
                  } catch {}
                }, 0);
              }} onDragEnter={e => {
                if (V !== null) {
                  e.preventDefault();
                  e.stopPropagation();
                  oe(t);
                }
              }} onDragOver={e => {
                if (V !== null) {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = `move`;
                }
              }} onDragLeave={e => {
                e.stopPropagation();
                oe(e => {
                  if (e === t) {
                    return null;
                  } else {
                    return e;
                  }
                });
              }} onDrop={e => {
                e.preventDefault();
                e.stopPropagation();
                let n = e.dataTransfer.getData(`application/x-yimao-puzzle`);
                let r = n ? parseInt(n, 10) : V ?? -1;
                if (r < 0 || r === t || Number.isNaN(r)) {
                  ie(null);
                  oe(null);
                  return;
                }
                H.current = true;
                ne(e => {
                  let n = e.slice();
                  let i = n[r];
                  n[r] = n[t];
                  n[t] = i;
                  return n;
                });
                ie(null);
                oe(null);
              }} onDragEnd={e => {
                e.stopPropagation();
                ie(null);
                oe(null);
              }} title={n ? `第 ${t + 1} 格：拖到其它格子可交换位置` : ``} key={t}>
                        {V !== null && <Component612 className={`absolute top-1 right-1 px-1 py-px rounded text-[9px] font-mono pointer-events-none transition-colors
                        ${i ? `bg-blue-500 text-white` : `bg-black/60 text-white/80`}
                      `}>
                            {t + 1}
                          </Component612>}
                        <Kt type={`target`} position={X.Left} id={`cell-${t}`} className={`!opacity-0 group-hover/cell:!opacity-100 !w-1.5 !h-1.5 !bg-blue-500 !border-[1px] !border-white !rounded-full transition-opacity cursor-crosshair z-[100]`} style={{
                  top: `50%`,
                  left: `50%`,
                  transform: `translate(-50%, -50%)`,
                  minWidth: `6px`,
                  minHeight: `6px`
                }} />
                      </Component613>;
            })}
                </Component614>}
              {s === `longImage` && B.length > 0 && <Component617 className={`absolute inset-0 grid p-2 gap-0 pointer-events-none`} style={{
            gridTemplateColumns: x === `horizontal` ? `repeat(${B.length}, minmax(0, 1fr))` : `1fr`,
            gridTemplateRows: x === `vertical` ? `repeat(${B.length}, minmax(0, 1fr))` : `1fr`
          }}>
                  {B.map((e, t) => {
              let n = V === t;
              let r = V !== null && V !== t && ae === t;
              const Component615 = `span`;
              const Component616 = `div`;
              return <Component616 className={`pointer-events-auto cursor-grab active:cursor-grabbing rounded-[2px] transition-all
                      ${n ? `opacity-30 ring-2 ring-blue-300` : ``}
                      ${r ? `ring-2 ring-blue-400 bg-blue-400/15 shadow-[inset_0_0_0_2px_rgba(96,165,250,0.6)]` : ``}
                    `} draggable={true} onDragStart={e => {
                e.stopPropagation();
                ie(t);
                e.dataTransfer.effectAllowed = `move`;
                e.dataTransfer.setData(`application/x-yimao-puzzle`, String(t));
                let n = document.createElement(`div`);
                n.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;`;
                document.body.appendChild(n);
                e.dataTransfer.setDragImage(n, 0, 0);
                setTimeout(() => {
                  try {
                    document.body.removeChild(n);
                  } catch {}
                }, 0);
              }} onDragEnter={e => {
                if (V !== null) {
                  e.preventDefault();
                  e.stopPropagation();
                  oe(t);
                }
              }} onDragOver={e => {
                if (V !== null) {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = `move`;
                }
              }} onDragLeave={e => {
                e.stopPropagation();
                oe(e => {
                  if (e === t) {
                    return null;
                  } else {
                    return e;
                  }
                });
              }} onDrop={e => {
                e.preventDefault();
                e.stopPropagation();
                let n = e.dataTransfer.getData(`application/x-yimao-puzzle`);
                let r = n ? parseInt(n, 10) : V ?? -1;
                if (r < 0 || r === t || Number.isNaN(r)) {
                  ie(null);
                  oe(null);
                  return;
                }
                H.current = true;
                re(e => {
                  let n = e.slice();
                  let i = n[r];
                  n[r] = n[t];
                  n[t] = i;
                  return n;
                });
                ie(null);
                oe(null);
              }} onDragEnd={e => {
                e.stopPropagation();
                ie(null);
                oe(null);
              }} title={`第 ${t + 1} 张：拖到其它项可交换顺序`} key={t}>
                        {V !== null && <Component615 className={`absolute m-1 px-1 py-px rounded text-[9px] font-mono pointer-events-none transition-colors
                        ${r ? `bg-blue-500 text-white` : `bg-black/60 text-white/80`}
                      `}>
                            {t + 1}
                          </Component615>}
                      </Component616>;
            })}
                </Component617>}
              {R && <Component618 className={`absolute inset-0 bg-black/50 flex items-center justify-center`}>
                  <_Component25 className={`animate-spin text-white`} />
                </Component618>}
            </Component619>}
          <Component666 className={`space-y-2 nodrag`}>
            <Component624 className={`flex items-center gap-1.5 text-[10px] text-gray-400`}>
              <Component620>{`背景`}</Component620>
              <Component621 className={`px-1.5 py-0.5 rounded border text-[10px] transition-colors ${N === `transparent` ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white`}`} onClick={() => {
              return P(`transparent`);
            }} title={`透明背景（导出 PNG 保留透明通道）`}>{`透明`}</Component621>
              <Component622 type={`color`} value={N === `transparent` ? `#000000` : N} onChange={e => {
              return P(e.target.value);
            }} className={`w-6 h-5 rounded border border-[#333] bg-transparent cursor-pointer`} title={`自定义背景色`} />
              {N !== `transparent` && <Component623 className={`font-mono text-gray-500`}>{N}</Component623>}
            </Component624>
            {s === `grid` && <Q.Fragment>
                <Component627 className={`flex flex-wrap items-center gap-1`}>
                  {Wo.map(e => {
                return <Component625 className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${ge(e.rows, e.cols) ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white hover:border-[#555]`}`} onClick={() => {
                  u(e.rows);
                  f(e.cols);
                  M(`${e.rows}x${e.cols}`);
                }} key={e.label}>
                        {e.label}
                      </Component625>;
              })}
                  <Component626 className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${k ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white hover:border-[#555]`}`} onClick={() => {
                return A(e => {
                  return !e;
                });
              }}>{`自定义`}</Component626>
                </Component627>
                {k && <Component635 className={`flex items-center gap-1.5 text-[10px] text-gray-400`}>
                    <Component628>{`行`}</Component628>
                    <Component629 type={`number`} min={1} max={20} value={l} onChange={e => {
                let t = Go(parseInt(e.target.value || `1`, 10) || 1, 1, 20);
                u(t);
                M(`${t}x${d}`);
              }} className={`w-12 bg-[#2a2a2a] text-gray-200 rounded px-1.5 py-0.5 border border-[#333] outline-none`} />
                    <Component630>{`×`}</Component630>
                    <Component631>{`列`}</Component631>
                    <Component632 type={`number`} min={1} max={20} value={d} onChange={e => {
                let t = Go(parseInt(e.target.value || `1`, 10) || 1, 1, 20);
                f(t);
                M(`${l}x${t}`);
              }} className={`w-12 bg-[#2a2a2a] text-gray-200 rounded px-1.5 py-0.5 border border-[#333] outline-none`} />
                    <Component633 className={`mx-1 text-[#555]`}>{`|`}</Component633>
                    <Component634 type={`text`} value={j} placeholder={`1x5`} onChange={e => {
                return M(e.target.value);
              }} onBlur={() => {
                let e = Ko(j);
                if (e) {
                  u(e.rows);
                  f(e.cols);
                }
              }} onKeyDown={e => {
                if (e.key === `Enter`) {
                  let e = Ko(j);
                  if (e) {
                    u(e.rows);
                    f(e.cols);
                  }
                }
              }} className={`flex-1 bg-[#2a2a2a] text-gray-200 rounded px-1.5 py-0.5 border border-[#333] outline-none`} />
                  </Component635>}
                <Component637 className={`flex items-center gap-2`}>
                  <Component636 className={`flex-1 bg-[#2a2a2a] text-gray-300 text-xs rounded px-2 py-1 border border-[#333] outline-none`} placeholder={`分图角标，{num} 引入数字编号，可留空`} value={y} onChange={e => {
                return b(e.target.value);
              }} />
                </Component637>
                <Component650 className={`flex items-center gap-2`}>
                  <Component643 value={_ ? `auto` : p} onChange={e => {
                let t = e.target.value;
                if (t === `auto`) {
                  v(true);
                } else {
                  v(false);
                  m(Number(t));
                }
              }} className={`bg-[#2a2a2a] text-gray-300 text-xs rounded px-2 py-1 border border-[#333] outline-none flex-1`} title={`单格尺寸`}>
                    <Component638 value={`auto`}>{`自适应`}</Component638>
                    <Component639 value={256}>{`256px`}</Component639>
                    <Component640 value={512}>{`512px`}</Component640>
                    <Component641 value={1024}>{`1024px`}</Component641>
                    <Component642 value={2048}>{`2048px`}</Component642>
                  </Component643>
                  <Component649 value={h} onChange={e => {
                return g(e.target.value);
              }} className={`bg-[#2a2a2a] text-gray-300 text-xs rounded px-2 py-1 border border-[#333] outline-none flex-1`} title={`比例`} disabled={_} style={{
                opacity: _ ? 0.5 : 1
              }}>
                    <Component644 value={`1:1`}>{`1:1`}</Component644>
                    <Component645 value={`16:9`}>{`16:9`}</Component645>
                    <Component646 value={`4:3`}>{`4:3`}</Component646>
                    <Component647 value={`3:4`}>{`3:4`}</Component647>
                    <Component648 value={`9:16`}>{`9:16`}</Component648>
                  </Component649>
                </Component650>
              </Q.Fragment>}
            {s === `longImage` && <Component663 className={`space-y-2`}>
                <Component655 className={`flex items-center gap-2 text-[10px] text-gray-400`}>
                  <Component651>{`方向`}</Component651>
                  <Component652 className={`px-2 py-0.5 rounded border transition-colors ${x === `vertical` ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400`}`} onClick={() => {
                return S(`vertical`);
              }}>{`垂直`}</Component652>
                  <Component653 className={`px-2 py-0.5 rounded border transition-colors ${x === `horizontal` ? `bg-blue-500/15 border-blue-500/60 text-blue-300` : `bg-[#2a2a2a] border-[#333] text-gray-400`}`} onClick={() => {
                return S(`horizontal`);
              }}>{`水平`}</Component653>
                  <Component654 className={`ml-auto`}>
                    {B.length}
                    {` 张`}
                  </Component654>
                </Component655>
                <Component662 className={`flex items-center gap-2 text-[10px] text-gray-400`}>
                  <Component657 className={`flex items-center gap-1 cursor-pointer`}>
                    <Component656 type={`checkbox`} checked={D} onChange={e => {
                  return O(e.target.checked);
                }} className={`accent-blue-500`} />
                    {` 跟随首图`}
                  </Component657>
                  <Component658>{x === `vertical` ? `宽度` : `高度`}</Component658>
                  <Component659 type={`number`} min={64} max={4096} value={T} onChange={e => {
                return E(Go(parseInt(e.target.value || `1024`, 10) || 1024, 64, 4096));
              }} disabled={D} className={`w-20 bg-[#2a2a2a] text-gray-200 rounded px-1.5 py-0.5 border border-[#333] outline-none disabled:opacity-50`} />
                  <Component660>{`间距`}</Component660>
                  <Component661 type={`number`} min={0} max={200} value={C} onChange={e => {
                return w(Go(parseInt(e.target.value || `0`, 10) || 0, 0, 200));
              }} className={`w-14 bg-[#2a2a2a] text-gray-200 rounded px-1.5 py-0.5 border border-[#333] outline-none`} />
                </Component662>
              </Component663>}
            {s === `overlay` && <_cmp_Uo state={ce} onChange={U} upstreamUrls={B} onExport={t => {
            I(t);
            le(e, {
              imageUrl: t
            });
            W(e);
          }} onShowToast={e => {
            if (typeof t.onShowToast == `function`) {
              t.onShowToast(e);
            }
          }} />}
            <Component665 className={`flex items-center gap-2`}>
              <Component664 onClick={me} disabled={s === `overlay` ? ce.layers.length === 0 : G.length === 0} className={`flex-1 py-1.5 rounded text-xs transition-colors ${(s === `overlay` ? ce.layers.length > 0 : G.length > 0) ? `bg-blue-600 text-white hover:bg-blue-500` : `bg-[#333] text-gray-500 cursor-not-allowed`}`}>{`开始合成`}</Component664>
            </Component665>
          </Component666>
        </Component667>
        <_cmp__Component12 type={`source`} position={X.Right} id={`batch-output`} />
      </Component668>
    </Component669>;
});
export default Yo;