// TODO(全局, 无需 import): data, selected, updateNodeData, handleType, m, r, imageUrls, g, mode, o, strength, color, u, useThumbnail, n, i, loading, progress, errorMessage, resultInfo, resultUrls, preferThumbnail, subfolder, url, label, l, s, count, faceTotal, p, display, v, icon, backgroundColor, scrollbarWidth, b, f, x
import _cmp__Component8 from './_Component8.jsx';
import _cmp__Component9 from './_Component9.jsx';
import _cmp__Component12 from './_Component12.jsx';
import _cmp__Component55 from './_Component55.jsx';
import _cmp__l from './_l.jsx';
import { id, We, t, Lt, Qt, e, Sl, h, c, br, xl, hi, d, y, X, C, _, Yr, S, R, _Component0, _Component17, _Component1, _Component54, _n, _Component43 } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
var Cl = Z.memo(({
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
    return Sl(Array.isArray(h) ? h : h ? [h] : []);
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
  } = br();
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
    let l = xl.find(e => {
      return e.mode === o;
    })?.label || `打码`;
    for (let i = 0; i < t.length; i++) {
      try {
        let e = await _cmp__l(t[i], {
          mode: o,
          strength: c,
          color: u
        });
        let r = await hi(e.dataUrl, {
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
      let n = (await hi(t, {
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
  const Component1658 = `input`;
  const Component1659 = `span`;
  const Component1660 = `button`;
  const Component1661 = `span`;
  const Component1662 = `div`;
  const Component1663 = `span`;
  const Component1664 = `div`;
  const Component1665 = `button`;
  const Component1666 = `div`;
  const Component1667 = `span`;
  const Component1668 = `input`;
  const Component1669 = `span`;
  const Component1670 = `label`;
  const Component1671 = `span`;
  const Component1672 = `button`;
  const Component1673 = `div`;
  const Component1674 = `div`;
  const Component1675 = `span`;
  const Component1676 = `span`;
  const Component1677 = `span`;
  const Component1678 = `span`;
  const Component1679 = `div`;
  const Component1684 = `div`;
  const Component1685 = `button`;
  const Component1686 = `button`;
  const Component1687 = `button`;
  const Component1688 = `div`;
  const Component1689 = `div`;
  const Component1690 = `div`;
  const Component1691 = `div`;
  return <Component1691 className={`relative group/node w-full h-full min-w-[320px] min-h-[250px]`}>
      <_cmp__Component8 id={e} data={t} defaultTitle={`人脸打码`} icon={<R size={11} className={`text-gray-500`} />} floating={true} />
      <_cmp__Component9 visible={!!n} minWidth={320} minHeight={250} />
      <Component1690 className={`w-full h-full bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 flex flex-col drag-handle cursor-move ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}>
        <_cmp__Component12 type={`target`} position={X.Left} />
        <Component1658 type={`file`} ref={a} multiple={true} style={{
        display: `none`
      }} accept={`image/*`} onChange={v} />
        <Component1689 className={`flex-1 p-3 flex flex-col gap-2.5`}>
          {C === 0 ? <Component1660 onClick={() => {
          return a.current?.click();
        }} className={`nodrag flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg border border-dashed border-[#3a3a3a] text-gray-500 hover:text-blue-400 hover:border-blue-500/50 transition-colors`}>
              <_Component0 size={20} />
              <Component1659 className={`text-[11px]`}>{`上传图片 或 左侧连接图片节点`}</Component1659>
            </Component1660> : <Component1662 className={`text-[11px] text-gray-400`}>
              {`已连接 `}
              <Component1661 className={`text-blue-400`}>{C}</Component1661>
              {` 张图片`}
            </Component1662>}
          {i.errorMessage && <Component1664 className={`flex items-center gap-1.5 text-[11px] text-red-400`}>
              <_Component17 size={13} className={`shrink-0`} />
              <Component1663 className={`break-words`}>{i.errorMessage}</Component1663>
            </Component1664>}
          <Component1666 className={`grid grid-cols-4 gap-1.5`}>
            {xl.map(({
            mode: e,
            label: t,
            icon: _Component53
          }) => {
            return <Component1665 onClick={() => {
              return s(e);
            }} className={`nodrag flex flex-col items-center justify-center gap-1 py-1.5 rounded-md text-[11px] border transition-colors ${o === e ? `bg-blue-600 text-white border-blue-500` : `text-gray-300 bg-[#222] hover:bg-[#2a2a2a] border-[#333]`}`} key={e}>
                  <_Component53 size={14} />
                  {t}
                </Component1665>;
          })}
          </Component1666>
          <Component1670 className={`nodrag flex items-center gap-2 text-[10px] text-gray-400`}>
            <Component1667 className={`w-8`}>
              {o === `grid` ? `密度` : o === `bar` ? `透明度` : `程度`}
            </Component1667>
            <Component1668 type={`range`} min={0} max={1} step={0.05} value={c} onChange={e => {
            return l(Number(e.target.value));
          }} className={`nodrag accent-blue-500 flex-1`} />
            <Component1669 className={`w-8 text-right text-gray-500`}>
              {Math.round(c * 100)}
              {`%`}
            </Component1669>
          </Component1670>
          {(o === `bar` || o === `grid`) && <Component1674 className={`nodrag flex items-center gap-2 text-[10px] text-gray-400`}>
              <Component1671 className={`w-8`}>{`颜色`}</Component1671>
              <Component1673 className={`flex items-center gap-1.5 flex-1`}>
                {[`#000000`, `#ffffff`, `#ef4444`, `#22c55e`, `#3b82f6`, `#eab308`, `#a855f7`, `#ec4899`].map(e => {
              return <Component1672 onClick={() => {
                return d(e);
              }} className={`w-4 h-4 rounded-full border border-[#333] ${u === e ? `ring-2 ring-blue-500 ring-offset-1 ring-offset-[#1c1c1c]` : ``}`} style={{
                backgroundColor: e
              }} key={e} />;
            })}
              </Component1673>
            </Component1674>}
          {i.resultInfo && <Component1679 className={`text-[10px] text-gray-400 flex items-center gap-2 flex-wrap`}>
              <Component1675>
                {i.resultInfo.count}
                {` 张`}
              </Component1675>
              {i.resultInfo.faceTotal > 0 && <Q.Fragment>
                  <Component1676>{`·`}</Component1676>
                  <Component1678>
                    {`共 `}
                    <Component1677 className={`text-blue-400`}>
                      {i.resultInfo.faceTotal}
                    </Component1677>
                    {` 张人脸`}
                  </Component1678>
                </Q.Fragment>}
            </Component1679>}
          {i.resultUrls && i.resultUrls.length > 0 && <Component1684 className={`nodrag nowheel mt-1 mb-2 grid grid-cols-2 gap-1.5 max-h-[140px] overflow-y-auto pr-1`} style={{
          scrollbarWidth: `thin`
        }}>
              {i.resultUrls.map((t, n) => {
            let r = _ && Yr(t, 420, `image`) || t;
            const Component1680 = `img`;
            const Component1681 = `div`;
            const Component1682 = `button`;
            const Component1683 = `div`;
            return <Component1683 className={`relative aspect-video bg-[#111] rounded-md overflow-hidden border border-[#333] group`} key={n}>
                    <Component1680 src={r} alt={`result-${n}`} className={`w-full h-full object-cover`} loading={`lazy`} onError={e => {
                let n = e.currentTarget;
                if (n.src !== t) {
                  n.src = t;
                }
              }} onDoubleClick={n => {
                n.stopPropagation();
                i.onZoom?.(e, t, r);
              }} />
                    <Component1681 className={`absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none`} />
                    <Component1682 className={`absolute top-1 right-1 p-1 bg-black/60 text-gray-300 hover:text-white rounded opacity-0 group-hover:opacity-100 transition-opacity`} onClick={n => {
                n.stopPropagation();
                i.onZoom?.(e, t, r);
              }} title={`放大查看`}>
                      <_Component1 size={12} />
                    </Component1682>
                  </Component1683>;
          })}
            </Component1684>}
          <Component1688 className={`mt-auto flex items-center gap-2`}>
            <Component1685 onClick={() => {
            return a.current?.click();
          }} className={`nodrag flex items-center justify-center h-8 w-8 rounded-md text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] transition-colors`} title={`上传图片`}>
              <_Component0 size={14} />
            </Component1685>
            <Component1686 onClick={() => {
            if (C === 0) {
              i.onShowToast?.(`请先上传或连接图片`);
              return;
            }
            p(true);
          }} disabled={C === 0} className={`nodrag flex items-center justify-center gap-1 h-8 px-2.5 rounded-md text-[12px] text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] disabled:opacity-40 disabled:cursor-not-allowed transition-colors`} title={`手动打码`}>
              <_Component54 size={13} />
              {` 手动`}
            </Component1686>
            <Component1687 onClick={b} disabled={S || C === 0} className={`nodrag flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-[12px] font-medium bg-white text-[#141414] hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}>
              {S ? <Q.Fragment>
                  <_n size={13} className={`animate-spin`} />
                  {` 处理中 `}
                  {i.progress || 0}
                  {`%`}
                </Q.Fragment> : <Q.Fragment>
                  <_Component43 size={13} />
                  {` AI打码`}
                  {C > 1 ? `（${C}张）` : ``}
                </Q.Fragment>}
            </Component1687>
          </Component1688>
        </Component1689>
        <_cmp__Component12 type={`source`} position={X.Right} id={`main-output`} />
      </Component1690>
      {f && g[0] && <_cmp__Component55 imageUrl={g[0]} onSave={x} onClose={() => {
      return p(false);
    }} />}
    </Component1691>;
});
export default Cl;