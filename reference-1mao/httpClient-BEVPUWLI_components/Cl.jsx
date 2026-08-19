// TODO(全局, 无需 import): data, selected, updateNodeData, handleType, g, r, imageUrls, v, maxSize, o, quality, format, u, targetKB, f, m, n, i, loading, progress, errorMessage, resultInfo, url, label, l, count, totalOriginal, totalSize, s, display, p, b, x
import _cmp_Ti from './Ti.jsx';
import _cmp_Ei from './Ei.jsx';
import _cmp__Component10 from './_Component10.jsx';
import _cmp__l from './_l.jsx';
import { id, We, t, Lt, Qt, e, Sl, _, c, X, y, w, vl, C, yl, d, bl, h, xl, S, _Component23, _Component8, _Component16, _n, _Component42 } from './shared.js';
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
  let [o, s] = Z.useState(t.maxSize ?? 0);
  let [c, l] = Z.useState(t.quality ?? 0.8);
  let [u, d] = Z.useState(t.format || `image/jpeg`);
  let [f, p] = Z.useState(!!t.targetKB);
  let [m, h] = Z.useState(t.targetKB || 200);
  let g = Lt({
    handleType: `target`
  });
  let _ = Qt(Z.useMemo(() => {
    return g.map(e => {
      return e.source;
    });
  }, [g]));
  let v = Z.useMemo(() => {
    return Sl(Array.isArray(_) ? _ : _ ? [_] : []);
  }, [_]);
  Z.useEffect(() => {
    r(e, {
      imageUrls: v
    });
  }, [v, e, r]);
  Z.useEffect(() => {
    r(e, {
      maxSize: o,
      quality: c,
      format: u,
      targetKB: f ? m : undefined
    });
  }, [o, c, u, f, m, e, r]);
  let y = t => {
    let n = t.target.files;
    if (!!n && n.length !== 0) {
      Array.from(n).forEach(t => {
        let n = URL.createObjectURL(t);
        i.onAddImage?.(e, n);
      });
      t.target.value = ``;
    }
  };
  let b = Z.useCallback(async () => {
    let t = v;
    if (!t || t.length === 0) {
      i.onShowToast?.(`请先上传图片或连接包含图片的节点`);
      return;
    }
    r(e, {
      loading: true,
      progress: 0,
      errorMessage: undefined,
      resultInfo: undefined
    });
    let n = [];
    let a = 0;
    let s = 0;
    let l = ``;
    for (let i = 0; i < t.length; i++) {
      try {
        let e = await _cmp__l(t[i], {
          maxSize: o,
          quality: c,
          format: u,
          targetKB: f ? m : undefined
        });
        n.push({
          url: e.dataUrl,
          label: `压缩图 ${i + 1}`
        });
        a += e.originalSize;
        s += e.size;
      } catch (e) {
        l ||= e?.message || `压缩失败`;
      }
      r(e, {
        progress: Math.round((i + 1) / t.length * 100)
      });
    }
    if (n.length === 0) {
      r(e, {
        loading: false,
        errorMessage: l || `压缩失败`
      });
      i.onShowToast?.(l || `压缩失败`);
      return;
    }
    r(e, {
      loading: false,
      resultInfo: {
        count: n.length,
        totalOriginal: a,
        totalSize: s
      }
    });
    if (!i.onPushImagesToImageBox || !i.onPushImagesToImageBox(e, n)) {
      n.forEach(t => {
        return i.onSpawnImageNode?.(e, t.url, t.label);
      });
    }
    if (l) {
      i.onShowToast?.(`部分图片压缩失败：${l}`);
    }
  }, [v, o, c, u, f, m, e, r, i]);
  let x = !!i.loading;
  let S = !!i.resultInfo;
  let C = u === `image/png`;
  let w = v.length;
  const Component1620 = `input`;
  const Component1621 = `span`;
  const Component1622 = `button`;
  const Component1623 = `span`;
  const Component1624 = `div`;
  const Component1625 = `span`;
  const Component1626 = `div`;
  const Component1627 = `option`;
  const Component1628 = `select`;
  const Component1629 = `label`;
  const Component1630 = `option`;
  const Component1631 = `select`;
  const Component1632 = `label`;
  const Component1633 = `option`;
  const Component1634 = `select`;
  const Component1635 = `label`;
  const Component1636 = `div`;
  const Component1637 = `input`;
  const Component1638 = `span`;
  const Component1639 = `input`;
  const Component1640 = `span`;
  const Component1641 = `label`;
  const Component1642 = `span`;
  const Component1643 = `span`;
  const Component1644 = `span`;
  const Component1645 = `span`;
  const Component1646 = `span`;
  const Component1647 = `div`;
  const Component1648 = `button`;
  const Component1649 = `button`;
  const Component1650 = `div`;
  const Component1651 = `div`;
  const Component1652 = `div`;
  const Component1653 = `div`;
  return <Component1653 className={`relative group/node w-full h-full min-w-[300px] min-h-[200px]`}>
      <_cmp_Ti id={e} data={t} defaultTitle={`图片压缩`} icon={<_Component23 size={11} className={`text-gray-500`} />} floating={true} />
      <_cmp_Ei visible={!!n} minWidth={300} minHeight={200} />
      <Component1652 className={`w-full h-full bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 flex flex-col drag-handle cursor-move ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}>
        <_cmp__Component10 type={`target`} position={X.Left} />
        <Component1620 type={`file`} ref={a} multiple={true} style={{
        display: `none`
      }} accept={`image/*`} onChange={y} />
        <Component1651 className={`flex-1 p-3 flex flex-col gap-2.5`}>
          {w === 0 ? <Component1622 onClick={() => {
          return a.current?.click();
        }} className={`nodrag flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg border border-dashed border-[#3a3a3a] text-gray-500 hover:text-blue-400 hover:border-blue-500/50 transition-colors`}>
              <_Component8 size={20} />
              <Component1621 className={`text-[11px]`}>{`上传图片 或 左侧连接图片节点`}</Component1621>
            </Component1622> : <Component1624 className={`text-[11px] text-gray-400`}>
              {`已连接 `}
              <Component1623 className={`text-blue-400`}>{w}</Component1623>
              {` 张图片`}
            </Component1624>}
          {i.errorMessage && <Component1626 className={`flex items-center gap-1.5 text-[11px] text-red-400`}>
              <_Component16 size={13} className={`shrink-0`} />
              <Component1625 className={`break-words`}>{i.errorMessage}</Component1625>
            </Component1626>}
          <Component1636 className={`grid grid-cols-3 gap-2`}>
            <Component1629 className={`nodrag flex flex-col gap-1 text-[10px] text-gray-500`}>
              {`尺寸`}
              <Component1628 value={o} onChange={e => {
              return s(Number(e.target.value));
            }} className={`nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555]`}>
                {vl.map(e => {
                return <Component1627 value={e.value} key={e.value}>
                      {e.label}
                    </Component1627>;
              })}
              </Component1628>
            </Component1629>
            <Component1632 className={`nodrag flex flex-col gap-1 text-[10px] text-gray-500`}>
              {`清晰度`}
              <Component1631 value={c} disabled={C || f} onChange={e => {
              return l(Number(e.target.value));
            }} className={`nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555] disabled:opacity-40`}>
                {yl.map(e => {
                return <Component1630 value={e.value} key={e.value}>
                      {e.label}
                    </Component1630>;
              })}
              </Component1631>
            </Component1632>
            <Component1635 className={`nodrag flex flex-col gap-1 text-[10px] text-gray-500`}>
              {`格式`}
              <Component1634 value={u} onChange={e => {
              return d(e.target.value);
            }} className={`nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555]`}>
                {bl.map(e => {
                return <Component1633 value={e.value} key={e.value}>
                      {e.label}
                    </Component1633>;
              })}
              </Component1634>
            </Component1635>
          </Component1636>
          {!C && <Component1641 className={`nodrag flex items-center gap-2 text-[10px] text-gray-400`}>
              <Component1637 type={`checkbox`} checked={f} onChange={e => {
            return p(e.target.checked);
          }} className={`nodrag accent-blue-500`} />
              <Component1638>{`限制目标大小`}</Component1638>
              {f && <Q.Fragment>
                  <Component1639 type={`number`} min={10} max={20000} value={m} onChange={e => {
              return h(Math.max(10, Number(e.target.value) || 10));
            }} className={`nodrag w-16 bg-[#222] border border-[#333] rounded px-1.5 py-0.5 text-[11px] text-gray-200 outline-none focus:border-[#555]`} />
                  <Component1640>{`KB`}</Component1640>
                </Q.Fragment>}
            </Component1641>}
          {i.resultInfo && <Component1647 className={`text-[10px] text-gray-400 flex items-center gap-2 flex-wrap`}>
              <Component1642>
                {i.resultInfo.count}
                {` 张`}
              </Component1642>
              <Component1643>{`·`}</Component1643>
              {i.resultInfo.totalOriginal ? <Component1645>
                  {xl(i.resultInfo.totalOriginal)}
                  {` → `}
                  <Component1644 className={`text-blue-400`}>
                    {xl(i.resultInfo.totalSize)}
                  </Component1644>
                </Component1645> : <Component1646 className={`text-blue-400`}>
                  {xl(i.resultInfo.totalSize)}
                </Component1646>}
            </Component1647>}
          <Component1650 className={`mt-auto flex items-center gap-2`}>
            <Component1648 onClick={() => {
            return a.current?.click();
          }} className={`nodrag flex items-center justify-center h-8 w-8 rounded-md text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] transition-colors`} title={`上传图片`}>
              <_Component8 size={14} />
            </Component1648>
            <Component1649 onClick={b} disabled={x || w === 0} className={`nodrag flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-[12px] font-medium bg-white text-[#141414] hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}>
              {x ? <Q.Fragment>
                  <_n size={13} className={`animate-spin`} />
                  {` 压缩中 `}
                  {i.progress || 0}
                  {`%`}
                </Q.Fragment> : <Q.Fragment>
                  <_Component42 size={13} />
                  {` `}
                  {S ? `重新免费压缩` : `免费压缩`}
                  {w > 1 ? `（${w}张）` : ``}
                </Q.Fragment>}
            </Component1649>
          </Component1650>
        </Component1651>
        <_cmp__Component10 type={`source`} position={X.Right} id={`main-output`} />
      </Component1652>
    </Component1653>;
});
export default Cl;