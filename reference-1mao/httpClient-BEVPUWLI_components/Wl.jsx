// TODO(全局, 无需 import): data, selected, updateNodeData, handleType, m, r, imageUrls, g, mode, o, strength, color, u, useThumbnail, n, i, loading, progress, errorMessage, resultInfo, resultUrls, preferThumbnail, subfolder, url, label, l, s, count, faceTotal, p, display, v, icon, backgroundColor, scrollbarWidth, b, f, x
import _cmp_Ti from './Ti.jsx';
import _cmp_Ei from './Ei.jsx';
import _cmp__Component10 from './_Component10.jsx';
import _cmp_Vl from './Vl.jsx';
import _cmp_Rl from './Rl.jsx';
import { id, We, t, Lt, Qt, e, Ul, h, c, Tr, Hl, xi, d, y, X, C, _, ei, S, R, _Component8, _Component16, _Component9, _Component53, _n, _Component42 } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
var Wl = Z.memo(({
  id: e,
  data: t,
  selected: n
}) => {
  let {
    updateNodeData: r
  } = We();
  let i = t;
  let a = Z.useRef(null);
  let [o, s] = Z.useState(t.mode || `mosaic`);
  let [c, l] = Z.useState(t.strength ?? 0.5);
  let [u, d] = Z.useState(t.color || `#000000`);
  let [f, p] = Z.useState(false);
  let m = Lt({
    handleType: `target`
  });
  let h = Qt(Z.useMemo(() => {
    return m.map(e => {
      return e.source;
    });
  }, [m]));
  let g = Z.useMemo(() => {
    return Ul(Array.isArray(h) ? h : h ? [h] : []);
  }, [h]);
  Z.useEffect(() => {
    r(e, {
      imageUrls: g
    });
  }, [g, e, r]);
  Z.useEffect(() => {
    r(e, {
      mode: o,
      strength: c,
      color: u
    });
  }, [o, c, u, e, r]);
  let {
    useThumbnail: _
  } = Tr();
  let v = t => {
    let n = t.target.files;
    if (!!n && n.length !== 0) {
      Array.from(n).forEach(t => {
        let n = URL.createObjectURL(t);
        i.onAddImage?.(e, n);
      });
      t.target.value = ``;
    }
  };
  let y = Z.useCallback(t => {
    if (!i.onPushImagesToImageBox || !i.onPushImagesToImageBox(e, t)) {
      t.forEach(t => {
        return i.onSpawnImageNode?.(e, t.url, t.label);
      });
    }
  }, [e, i]);
  let b = Z.useCallback(async () => {
    let t = g;
    if (!t || t.length === 0) {
      i.onShowToast?.(`请先上传图片或连接包含图片的节点`);
      return;
    }
    r(e, {
      loading: true,
      progress: 0,
      errorMessage: undefined,
      resultInfo: undefined,
      resultUrls: undefined
    });
    let n = [];
    let a = 0;
    let s = ``;
    let l = Hl.find(e => {
      return e.mode === o;
    })?.label || `打码`;
    for (let i = 0; i < t.length; i++) {
      try {
        let e = await _cmp_Rl(t[i], {
          mode: o,
          strength: c,
          color: u
        });
        let r = await xi(e.dataUrl, {
          preferThumbnail: true,
          subfolder: `canvas/face_mosaic`
        });
        n.push({
          url: r.url,
          label: `${l} ${i + 1}`
        });
        a += e.faceCount;
      } catch (e) {
        s ||= e?.message || `打码失败`;
      }
      r(e, {
        progress: Math.round((i + 1) / t.length * 100)
      });
    }
    if (n.length === 0) {
      r(e, {
        loading: false,
        errorMessage: s || `打码失败`
      });
      i.onShowToast?.(s || `打码失败`);
      return;
    }
    let d = n.map(e => {
      return e.url;
    });
    r(e, {
      loading: false,
      resultInfo: {
        count: n.length,
        faceTotal: a
      },
      resultUrls: d
    });
    y(n);
    if (a === 0) {
      i.onShowToast?.(`未检测到人脸`);
    }
    if (s) {
      i.onShowToast?.(`部分图片处理失败：${s}`);
    }
  }, [g, o, c, u, e, r, i, y]);
  let x = Z.useCallback(async t => {
    p(false);
    r(e, {
      loading: true,
      progress: 0,
      errorMessage: undefined,
      resultInfo: undefined,
      resultUrls: undefined
    });
    try {
      let n = (await xi(t, {
        preferThumbnail: true,
        subfolder: `canvas/face_mosaic`
      })).url;
      y([{
        url: n,
        label: `手动打码`
      }]);
      r(e, {
        resultInfo: {
          count: 1,
          faceTotal: 0
        },
        resultUrls: [n],
        loading: false
      });
    } catch {
      y([{
        url: t,
        label: `手动打码`
      }]);
      r(e, {
        resultInfo: {
          count: 1,
          faceTotal: 0
        },
        resultUrls: [t],
        loading: false
      });
    }
  }, [y, e, r]);
  let S = !!i.loading;
  let C = g.length;
  const Component1680 = `input`;
  const Component1681 = `span`;
  const Component1682 = `button`;
  const Component1683 = `span`;
  const Component1684 = `div`;
  const Component1685 = `span`;
  const Component1686 = `div`;
  const Component1687 = `button`;
  const Component1688 = `div`;
  const Component1689 = `span`;
  const Component1690 = `input`;
  const Component1691 = `span`;
  const Component1692 = `label`;
  const Component1693 = `span`;
  const Component1694 = `button`;
  const Component1695 = `div`;
  const Component1696 = `div`;
  const Component1697 = `span`;
  const Component1698 = `span`;
  const Component1699 = `span`;
  const Component1700 = `span`;
  const Component1701 = `div`;
  const Component1706 = `div`;
  const Component1707 = `button`;
  const Component1708 = `button`;
  const Component1709 = `button`;
  const Component1710 = `div`;
  const Component1711 = `div`;
  const Component1712 = `div`;
  const Component1713 = `div`;
  return <Component1713 className={`relative group/node w-full h-full min-w-[320px] min-h-[250px]`}>
      <_cmp_Ti id={e} data={t} defaultTitle={`人脸打码`} icon={<R size={11} className={`text-gray-500`} />} floating={true} />
      <_cmp_Ei visible={!!n} minWidth={320} minHeight={250} />
      <Component1712 className={`w-full h-full bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 flex flex-col drag-handle cursor-move ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}>
        <_cmp__Component10 type={`target`} position={X.Left} />
        <Component1680 type={`file`} ref={a} multiple={true} style={{
        display: `none`
      }} accept={`image/*`} onChange={v} />
        <Component1711 className={`flex-1 p-3 flex flex-col gap-2.5`}>
          {C === 0 ? <Component1682 onClick={() => {
          return a.current?.click();
        }} className={`nodrag flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg border border-dashed border-[#3a3a3a] text-gray-500 hover:text-blue-400 hover:border-blue-500/50 transition-colors`}>
              <_Component8 size={20} />
              <Component1681 className={`text-[11px]`}>{`上传图片 或 左侧连接图片节点`}</Component1681>
            </Component1682> : <Component1684 className={`text-[11px] text-gray-400`}>
              {`已连接 `}
              <Component1683 className={`text-blue-400`}>{C}</Component1683>
              {` 张图片`}
            </Component1684>}
          {i.errorMessage && <Component1686 className={`flex items-center gap-1.5 text-[11px] text-red-400`}>
              <_Component16 size={13} className={`shrink-0`} />
              <Component1685 className={`break-words`}>{i.errorMessage}</Component1685>
            </Component1686>}
          <Component1688 className={`grid grid-cols-4 gap-1.5`}>
            {Hl.map(({
            mode: e,
            label: t,
            icon: _Component52
          }) => {
            return <Component1687 onClick={() => {
              return s(e);
            }} className={`nodrag flex flex-col items-center justify-center gap-1 py-1.5 rounded-md text-[11px] border transition-colors ${o === e ? `bg-blue-600 text-white border-blue-500` : `text-gray-300 bg-[#222] hover:bg-[#2a2a2a] border-[#333]`}`} key={e}>
                  <_Component52 size={14} />
                  {t}
                </Component1687>;
          })}
          </Component1688>
          <Component1692 className={`nodrag flex items-center gap-2 text-[10px] text-gray-400`}>
            <Component1689 className={`w-8`}>
              {o === `grid` ? `密度` : o === `bar` ? `透明度` : `程度`}
            </Component1689>
            <Component1690 type={`range`} min={0} max={1} step={0.05} value={c} onChange={e => {
            return l(Number(e.target.value));
          }} className={`nodrag accent-blue-500 flex-1`} />
            <Component1691 className={`w-8 text-right text-gray-500`}>
              {Math.round(c * 100)}
              {`%`}
            </Component1691>
          </Component1692>
          {(o === `bar` || o === `grid`) && <Component1696 className={`nodrag flex items-center gap-2 text-[10px] text-gray-400`}>
              <Component1693 className={`w-8`}>{`颜色`}</Component1693>
              <Component1695 className={`flex items-center gap-1.5 flex-1`}>
                {[`#000000`, `#ffffff`, `#ef4444`, `#22c55e`, `#3b82f6`, `#eab308`, `#a855f7`, `#ec4899`].map(e => {
              return <Component1694 onClick={() => {
                return d(e);
              }} className={`w-4 h-4 rounded-full border border-[#333] ${u === e ? `ring-2 ring-blue-500 ring-offset-1 ring-offset-[#1c1c1c]` : ``}`} style={{
                backgroundColor: e
              }} key={e} />;
            })}
              </Component1695>
            </Component1696>}
          {i.resultInfo && <Component1701 className={`text-[10px] text-gray-400 flex items-center gap-2 flex-wrap`}>
              <Component1697>
                {i.resultInfo.count}
                {` 张`}
              </Component1697>
              {i.resultInfo.faceTotal > 0 && <Q.Fragment>
                  <Component1698>{`·`}</Component1698>
                  <Component1700>
                    {`共 `}
                    <Component1699 className={`text-blue-400`}>
                      {i.resultInfo.faceTotal}
                    </Component1699>
                    {` 张人脸`}
                  </Component1700>
                </Q.Fragment>}
            </Component1701>}
          {i.resultUrls && i.resultUrls.length > 0 && <Component1706 className={`nodrag nowheel mt-1 mb-2 grid grid-cols-2 gap-1.5 max-h-[140px] overflow-y-auto pr-1`} style={{
          scrollbarWidth: `thin`
        }}>
              {i.resultUrls.map((t, n) => {
            let r = _ && ei(t, 420, `image`) || t;
            const Component1702 = `img`;
            const Component1703 = `div`;
            const Component1704 = `button`;
            const Component1705 = `div`;
            return <Component1705 className={`relative aspect-video bg-[#111] rounded-md overflow-hidden border border-[#333] group`} key={n}>
                    <Component1702 src={r} alt={`result-${n}`} className={`w-full h-full object-cover`} loading={`lazy`} onError={e => {
                let n = e.currentTarget;
                if (n.src !== t) {
                  n.src = t;
                }
              }} onDoubleClick={n => {
                n.stopPropagation();
                i.onZoom?.(e, t, r);
              }} />
                    <Component1703 className={`absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none`} />
                    <Component1704 className={`absolute top-1 right-1 p-1 bg-black/60 text-gray-300 hover:text-white rounded opacity-0 group-hover:opacity-100 transition-opacity`} onClick={n => {
                n.stopPropagation();
                i.onZoom?.(e, t, r);
              }} title={`放大查看`}>
                      <_Component9 size={12} />
                    </Component1704>
                  </Component1705>;
          })}
            </Component1706>}
          <Component1710 className={`mt-auto flex items-center gap-2`}>
            <Component1707 onClick={() => {
            return a.current?.click();
          }} className={`nodrag flex items-center justify-center h-8 w-8 rounded-md text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] transition-colors`} title={`上传图片`}>
              <_Component8 size={14} />
            </Component1707>
            <Component1708 onClick={() => {
            if (C === 0) {
              i.onShowToast?.(`请先上传或连接图片`);
              return;
            }
            p(true);
          }} disabled={C === 0} className={`nodrag flex items-center justify-center gap-1 h-8 px-2.5 rounded-md text-[12px] text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] disabled:opacity-40 disabled:cursor-not-allowed transition-colors`} title={`手动打码`}>
              <_Component53 size={13} />
              {` 手动`}
            </Component1708>
            <Component1709 onClick={b} disabled={S || C === 0} className={`nodrag flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-[12px] font-medium bg-white text-[#141414] hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}>
              {S ? <Q.Fragment>
                  <_n size={13} className={`animate-spin`} />
                  {` 处理中 `}
                  {i.progress || 0}
                  {`%`}
                </Q.Fragment> : <Q.Fragment>
                  <_Component42 size={13} />
                  {` AI打码`}
                  {C > 1 ? `（${C}张）` : ``}
                </Q.Fragment>}
            </Component1709>
          </Component1710>
        </Component1711>
        <_cmp__Component10 type={`source`} position={X.Right} id={`main-output`} />
      </Component1712>
      {f && g[0] && <_cmp_Vl imageUrl={g[0]} onSave={x} onClose={() => {
      return p(false);
    }} />}
    </Component1713>;
});
export default Wl;