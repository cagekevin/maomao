// TODO(全局, 无需 import): data, selected, updateNodeData, handleType, x, n, r, i, url, kind, split, orientation, s, o, g, u, v, l, b, f, mode, drawDivider, preferThumbnail, subfolder, m, blob, ext, durationMs, fps, onProgress, cursor, touchAction, clipPath, left, bottom, width, transform, right, height, k, ee, p
import _cmp_Ti from './Ti.jsx';
import _cmp_Ei from './Ei.jsx';
import _cmp__Component10 from './_Component10.jsx';
import _cmp_$l from './$l.jsx';
import _cmp_tu from './tu.jsx';
import { id, We, t, Lt, Qt, e, S, ru, nu, a, h, T, C, w, _, y, I, xi, Ql, P, X, A, E, D, O, R, j, M, c, F, N, L, d, _Component54, _Component55, $e, _Component25, Xe, _Component42, _n, _Component6, Je } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
var iu = Z.memo(({
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
      let i = ru(r);
      if (i && !t.some(e => {
        return e.url === i;
      })) {
        t.push({
          url: i,
          kind: nu(i)
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
  let L = Z.useCallback(async () => {
    let t = I();
    if (t) {
      f(`export`);
      try {
        let n = await xi(await Ql(await _cmp_$l(t[0], t[1], {
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
  let ee = Z.useCallback(async () => {
    let t = I();
    if (t) {
      f(`record`);
      m(0);
      try {
        let {
          blob: n,
          ext: r
        } = await _cmp_tu({
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
        let a = await xi(await Ql(n), {
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
  const Component1714 = `video`;
  const Component1715 = `img`;
  let R = (e, t) => {
    if (e.kind === `video`) {
      return <Component1714 ref={t ? _ : v} src={e.url} crossOrigin={`anonymous`} className={`absolute inset-0 w-full h-full object-contain bg-black`} muted={true} loop={true} playsInline={true} onTimeUpdate={t ? P : undefined} />;
    } else {
      return <Component1715 ref={t ? y : b} src={e.url} crossOrigin={`anonymous`} alt={t ? `A` : `B`} className={`absolute inset-0 w-full h-full object-contain bg-black`} draggable={false} />;
    }
  };
  const Component1716 = `div`;
  const Component1717 = `div`;
  const Component1718 = `div`;
  const Component1719 = `span`;
  const Component1720 = `span`;
  const Component1721 = `div`;
  const Component1722 = `span`;
  const Component1723 = `span`;
  const Component1724 = `div`;
  const Component1725 = `div`;
  const Component1726 = `button`;
  const Component1727 = `button`;
  const Component1728 = `button`;
  const Component1729 = `button`;
  const Component1730 = `button`;
  const Component1731 = `div`;
  const Component1732 = `div`;
  const Component1733 = `div`;
  const Component1734 = `div`;
  return <Component1734 className={`relative group/node w-full h-full min-w-[360px] min-h-[300px]`}>
      <_cmp_Ti id={e} data={t} defaultTitle={`对比工具`} icon={<_Component54 size={11} className={`text-gray-500`} />} floating={true} />
      <_cmp_Ei visible={!!n} minWidth={360} minHeight={300} />
      <Component1733 className={`w-full h-full bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 flex flex-col drag-handle cursor-move ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}>
        <_cmp__Component10 type={`target`} position={X.Left} />
        <Component1725 className={`relative flex-1 m-2 rounded-lg overflow-hidden bg-black select-none`}>
          {A ? <Component1721 ref={h} className={`nodrag absolute inset-0`} onPointerDown={E} onPointerMove={D} onPointerUp={O} style={{
          cursor: s === `v` ? `ew-resize` : `ns-resize`,
          touchAction: `none`
        }}>
              {R(w, false)}
              <Component1716 className={`absolute inset-0`} style={{
            clipPath: s === `v` ? `inset(0 ${(1 - a) * 100}% 0 0)` : `inset(0 0 ${(1 - a) * 100}% 0)`
          }}>
                {R(C, true)}
              </Component1716>
              <Component1718 className={`absolute bg-white/90 shadow-[0_0_6px_rgba(0,0,0,0.6)] pointer-events-none`} style={s === `v` ? {
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
                <Component1717 className={`absolute bg-white rounded-full flex items-center justify-center shadow-lg text-[#141414]`} style={s === `v` ? {
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
                  {s === `v` ? <_Component55 size={14} /> : <$e size={14} />}
                </Component1717>
              </Component1718>
              <Component1719 className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white pointer-events-none`}>
                {j}
              </Component1719>
              <Component1720 className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white pointer-events-none`}>
                {M}
              </Component1720>
            </Component1721> : <Component1724 className={`absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500`}>
              <_Component54 size={24} />
              <Component1722 className={`text-[11px]`}>{`连接 2 个图片 / 视频节点进行对比`}</Component1722>
              <Component1723 className={`text-[10px] text-gray-600`}>
                {`已连接 `}
                {[C, w].filter(Boolean).length}
                {` / 2`}
              </Component1723>
            </Component1724>}
        </Component1725>
        <Component1732 className={`flex items-center gap-2 px-2.5 pb-2.5`}>
          <Component1726 onClick={() => {
          return c(e => {
            if (e === `v`) {
              return `h`;
            } else {
              return `v`;
            }
          });
        }} className={`nodrag flex items-center justify-center h-7 w-7 rounded-md text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] transition-colors`} title={s === `v` ? `切换为上下对比` : `切换为左右对比`}>
            {s === `v` ? <_Component55 size={14} /> : <$e size={14} />}
          </Component1726>
          <Component1727 onClick={F} className={`nodrag flex items-center justify-center h-7 w-7 rounded-md text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] transition-colors`} title={`重置`}>
            <_Component25 size={14} />
          </Component1727>
          {k && <Component1728 onClick={N} disabled={!A} className={`nodrag flex items-center justify-center h-7 w-7 rounded-md text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] disabled:opacity-40 transition-colors`} title={l ? `暂停` : `播放`}>
              {l ? <Xe size={14} /> : <_Component42 size={14} />}
            </Component1728>}
          <Component1731 className={`ml-auto flex items-center gap-1.5`}>
            <Component1729 onClick={L} disabled={!A || !!d} className={`nodrag flex items-center justify-center gap-1 h-7 px-2.5 rounded-md text-[11px] text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] disabled:opacity-40 transition-colors`} title={`生成对比图节点`}>
              {d === `export` ? <_n size={13} className={`animate-spin`} /> : <_Component6 size={13} />}
              {` 导图`}
            </Component1729>
            <Component1730 onClick={ee} disabled={!A || !!d} className={`nodrag flex items-center justify-center gap-1 h-7 px-2.5 rounded-md text-[11px] text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] disabled:opacity-40 transition-colors`} title={`生成对比视频节点（可连视频转GIF）`}>
              {d === `record` ? <Q.Fragment>
                  <_n size={13} className={`animate-spin`} />
                  {` `}
                  {p}
                  {`%`}
                </Q.Fragment> : <Q.Fragment>
                  <Je size={13} />
                  {` 生成视频`}
                </Q.Fragment>}
            </Component1730>
          </Component1731>
        </Component1732>
        <_cmp__Component10 type={`source`} position={X.Right} id={`main-output`} />
      </Component1733>
    </Component1734>;
});
export default iu;