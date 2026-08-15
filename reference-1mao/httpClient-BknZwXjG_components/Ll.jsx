// TODO(全局, 无需 import): data, selected, updateNodeData, handleType, x, n, r, i, url, kind, split, orientation, s, o, g, u, v, l, b, f, mode, drawDivider, preferThumbnail, subfolder, m, blob, ext, durationMs, fps, onProgress, cursor, touchAction, clipPath, left, bottom, width, transform, right, height, k, ee, p
import _cmp__Component8 from './_Component8.jsx';
import _cmp__Component9 from './_Component9.jsx';
import _cmp__Component12 from './_Component12.jsx';
import _cmp_Ml from './Ml.jsx';
import _cmp_Pl from './Pl.jsx';
import { id, We, t, Lt, Qt, e, S, Il, Fl, a, h, T, C, w, _, y, I, hi, jl, P, X, A, E, D, O, R, j, M, c, F, N, d, L, _Component56, _Component57, $e, Me, Xe, _Component43, _n, _Component6, Je } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
var Ll = Z.memo(({
  id: e,
  data: t,
  selected: n
}) => {
  let {
    updateNodeData: r
  } = We();
  let i = t;
  let [a, o] = Z.useState(t.split ?? 0.5);
  let [s, c] = Z.useState(t.orientation || `v`);
  let [l, u] = Z.useState(false);
  let [d, f] = Z.useState(``);
  let [p, m] = Z.useState(0);
  let h = Z.useRef(null);
  let g = Z.useRef(false);
  let _ = Z.useRef(null);
  let v = Z.useRef(null);
  let y = Z.useRef(null);
  let b = Z.useRef(null);
  let x = Lt({
    handleType: `target`
  });
  let S = Qt(Z.useMemo(() => {
    return x.map(e => {
      return e.source;
    });
  }, [x]));
  let [C, w] = Z.useMemo(() => {
    let e = Array.isArray(S) ? S : S ? [S] : [];
    let t = [];
    for (let n of x) {
      let r = e.find(e => {
        return e.id === n.source;
      })?.data;
      let i = Il(r);
      if (i && !t.some(e => {
        return e.url === i;
      })) {
        t.push({
          url: i,
          kind: Fl(i)
        });
      }
      if (t.length >= 2) {
        break;
      }
    }
    return [t[0] || null, t[1] || null];
  }, [S, x]);
  Z.useEffect(() => {
    r(e, {
      split: a,
      orientation: s
    });
  }, [a, s, e, r]);
  let T = Z.useCallback((e, t) => {
    let n = h.current;
    if (!n) {
      return;
    }
    let r = n.getBoundingClientRect();
    let i = s === `v` ? (e - r.left) / r.width : (t - r.top) / r.height;
    o(Math.max(0, Math.min(1, i)));
  }, [s]);
  let E = e => {
    e.stopPropagation();
    g.current = true;
    e.target.setPointerCapture?.(e.pointerId);
    T(e.clientX, e.clientY);
  };
  let D = e => {
    if (g.current) {
      T(e.clientX, e.clientY);
    }
  };
  let O = e => {
    g.current = false;
    e.target.releasePointerCapture?.(e.pointerId);
  };
  let k = C?.kind === `video` || w?.kind === `video`;
  let A = !!C && !!w;
  let j = i.labelA || `A`;
  let M = i.labelB || `B`;
  let N = Z.useCallback(() => {
    let e = !l;
    u(e);
    [_.current, v.current].forEach(t => {
      if (t) {
        if (e) {
          t.play().catch(() => {});
        } else {
          t.pause();
        }
      }
    });
  }, [l]);
  let P = Z.useCallback(() => {
    let e = _.current;
    let t = v.current;
    if (e && t && Math.abs(e.currentTime - t.currentTime) > 0.15) {
      t.currentTime = e.currentTime;
    }
  }, []);
  let F = () => {
    o(0.5);
    [_.current, v.current].forEach(e => {
      if (e) {
        e.currentTime = 0;
      }
    });
  };
  let I = Z.useCallback(() => {
    let e = C?.kind === `video` ? _.current : y.current;
    let t = w?.kind === `video` ? v.current : b.current;
    if (!e || !t) {
      return null;
    } else {
      return [e, t];
    }
  }, [C, w]);
  let ee = Z.useCallback(async () => {
    let t = I();
    if (t) {
      f(`export`);
      try {
        let n = await hi(await jl(await _cmp_Ml(t[0], t[1], {
          mode: `slider`,
          orientation: s,
          split: a,
          drawDivider: true
        })), {
          preferThumbnail: true,
          subfolder: `canvas/compare`
        });
        i.onSpawnImageNode?.(e, n.url, `对比图`);
        i.onShowToast?.(`已生成对比图节点`);
      } catch (e) {
        i.onShowToast?.(e?.message || `生成对比图失败`);
      } finally {
        f(``);
      }
    }
  }, [I, s, a, e, i]);
  let L = Z.useCallback(async () => {
    let t = I();
    if (t) {
      f(`record`);
      m(0);
      try {
        let {
          blob: n,
          ext: r
        } = await _cmp_Pl({
          a: t[0],
          b: t[1],
          mode: `slider`,
          orientation: s,
          durationMs: 4000,
          fps: 30,
          onProgress: e => {
            return m(Math.round(e * 100));
          }
        });
        let a = await hi(await jl(n), {
          subfolder: `canvas/compare`
        });
        let o = /\.(mp4|webm|mov)($|\?)/i.test(a.url) ? a.url : `${a.url}#.${r}`;
        i.onSpawnImageNode?.(e, o, `对比视频`);
        i.onShowToast?.(`已生成对比视频节点，可连「视频转GIF」转 GIF`);
      } catch (e) {
        i.onShowToast?.(e?.message || `录制失败`);
      } finally {
        f(``);
        m(0);
      }
    }
  }, [I, s, e, i]);
  const Component1692 = `video`;
  const Component1693 = `img`;
  let R = (e, t) => {
    if (e.kind === `video`) {
      return <Component1692 ref={t ? _ : v} src={e.url} crossOrigin={`anonymous`} className={`absolute inset-0 w-full h-full object-contain bg-black`} muted={true} loop={true} playsInline={true} onTimeUpdate={t ? P : undefined} />;
    } else {
      return <Component1693 ref={t ? y : b} src={e.url} crossOrigin={`anonymous`} alt={t ? `A` : `B`} className={`absolute inset-0 w-full h-full object-contain bg-black`} draggable={false} />;
    }
  };
  const Component1694 = `div`;
  const Component1695 = `div`;
  const Component1696 = `div`;
  const Component1697 = `span`;
  const Component1698 = `span`;
  const Component1699 = `div`;
  const Component1700 = `span`;
  const Component1701 = `span`;
  const Component1702 = `div`;
  const Component1703 = `div`;
  const Component1704 = `button`;
  const Component1705 = `button`;
  const Component1706 = `button`;
  const Component1707 = `button`;
  const Component1708 = `button`;
  const Component1709 = `div`;
  const Component1710 = `div`;
  const Component1711 = `div`;
  const Component1712 = `div`;
  return <Component1712 className={`relative group/node w-full h-full min-w-[360px] min-h-[300px]`}>
      <_cmp__Component8 id={e} data={t} defaultTitle={`对比工具`} icon={<_Component56 size={11} className={`text-gray-500`} />} floating={true} />
      <_cmp__Component9 visible={!!n} minWidth={360} minHeight={300} />
      <Component1711 className={`w-full h-full bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 flex flex-col drag-handle cursor-move ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}>
        <_cmp__Component12 type={`target`} position={X.Left} />
        <Component1703 className={`relative flex-1 m-2 rounded-lg overflow-hidden bg-black select-none`}>
          {A ? <Component1699 ref={h} className={`nodrag absolute inset-0`} onPointerDown={E} onPointerMove={D} onPointerUp={O} style={{
          cursor: s === `v` ? `ew-resize` : `ns-resize`,
          touchAction: `none`
        }}>
              {R(w, false)}
              <Component1694 className={`absolute inset-0`} style={{
            clipPath: s === `v` ? `inset(0 ${(1 - a) * 100}% 0 0)` : `inset(0 0 ${(1 - a) * 100}% 0)`
          }}>
                {R(C, true)}
              </Component1694>
              <Component1696 className={`absolute bg-white/90 shadow-[0_0_6px_rgba(0,0,0,0.6)] pointer-events-none`} style={s === `v` ? {
            left: `${a * 100}%`,
            top: 0,
            bottom: 0,
            width: 2,
            transform: `translateX(-1px)`
          } : {
            top: `${a * 100}%`,
            left: 0,
            right: 0,
            height: 2,
            transform: `translateY(-1px)`
          }}>
                <Component1695 className={`absolute bg-white rounded-full flex items-center justify-center shadow-lg text-[#141414]`} style={s === `v` ? {
              top: `50%`,
              left: `50%`,
              width: 26,
              height: 26,
              transform: `translate(-50%, -50%)`
            } : {
              left: `50%`,
              top: `50%`,
              width: 26,
              height: 26,
              transform: `translate(-50%, -50%)`
            }}>
                  {s === `v` ? <_Component57 size={14} /> : <$e size={14} />}
                </Component1695>
              </Component1696>
              <Component1697 className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white pointer-events-none`}>
                {j}
              </Component1697>
              <Component1698 className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white pointer-events-none`}>
                {M}
              </Component1698>
            </Component1699> : <Component1702 className={`absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500`}>
              <_Component56 size={24} />
              <Component1700 className={`text-[11px]`}>{`连接 2 个图片 / 视频节点进行对比`}</Component1700>
              <Component1701 className={`text-[10px] text-gray-600`}>
                {`已连接 `}
                {[C, w].filter(Boolean).length}
                {` / 2`}
              </Component1701>
            </Component1702>}
        </Component1703>
        <Component1710 className={`flex items-center gap-2 px-2.5 pb-2.5`}>
          <Component1704 onClick={() => {
          return c(e => {
            if (e === `v`) {
              return `h`;
            } else {
              return `v`;
            }
          });
        }} className={`nodrag flex items-center justify-center h-7 w-7 rounded-md text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] transition-colors`} title={s === `v` ? `切换为上下对比` : `切换为左右对比`}>
            {s === `v` ? <_Component57 size={14} /> : <$e size={14} />}
          </Component1704>
          <Component1705 onClick={F} className={`nodrag flex items-center justify-center h-7 w-7 rounded-md text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] transition-colors`} title={`重置`}>
            <Me size={14} />
          </Component1705>
          {k && <Component1706 onClick={N} disabled={!A} className={`nodrag flex items-center justify-center h-7 w-7 rounded-md text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] disabled:opacity-40 transition-colors`} title={l ? `暂停` : `播放`}>
              {l ? <Xe size={14} /> : <_Component43 size={14} />}
            </Component1706>}
          <Component1709 className={`ml-auto flex items-center gap-1.5`}>
            <Component1707 onClick={ee} disabled={!A || !!d} className={`nodrag flex items-center justify-center gap-1 h-7 px-2.5 rounded-md text-[11px] text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] disabled:opacity-40 transition-colors`} title={`生成对比图节点`}>
              {d === `export` ? <_n size={13} className={`animate-spin`} /> : <_Component6 size={13} />}
              {` 导图`}
            </Component1707>
            <Component1708 onClick={L} disabled={!A || !!d} className={`nodrag flex items-center justify-center gap-1 h-7 px-2.5 rounded-md text-[11px] text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] disabled:opacity-40 transition-colors`} title={`生成对比视频节点（可连视频转GIF）`}>
              {d === `record` ? <Q.Fragment>
                  <_n size={13} className={`animate-spin`} />
                  {` `}
                  {p}
                  {`%`}
                </Q.Fragment> : <Q.Fragment>
                  <Je size={13} />
                  {` 生成视频`}
                </Q.Fragment>}
            </Component1708>
          </Component1709>
        </Component1710>
        <_cmp__Component12 type={`source`} position={X.Right} id={`main-output`} />
      </Component1711>
    </Component1712>;
});
export default Ll;