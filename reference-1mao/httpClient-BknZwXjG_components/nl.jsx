// TODO(全局, 无需 import): data, selected, updateNodeData, handleType, g, r, imageUrls, v, maxSize, o, quality, format, u, targetKB, f, m, n, i, loading, progress, errorMessage, resultInfo, url, label, l, count, totalOriginal, totalSize, s, display, p, b, x
import _cmp__Component8 from './_Component8.jsx';
import _cmp__Component9 from './_Component9.jsx';
import _cmp__Component12 from './_Component12.jsx';
import _cmp_Xc from './Xc.jsx';
import { id, We, t, Lt, Qt, e, tl, _, c, X, y, w, Zc, C, Qc, d, $c, h, el, S, _Component26, _Component0, _Component17, _n, _Component43 } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
var nl = Z.memo(({
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
    return tl(Array.isArray(_) ? _ : _ ? [_] : []);
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
        let e = await _cmp_Xc(t[i], {
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
  const Component1598 = `input`;
  const Component1599 = `span`;
  const Component1600 = `button`;
  const Component1601 = `span`;
  const Component1602 = `div`;
  const Component1603 = `span`;
  const Component1604 = `div`;
  const Component1605 = `option`;
  const Component1606 = `select`;
  const Component1607 = `label`;
  const Component1608 = `option`;
  const Component1609 = `select`;
  const Component1610 = `label`;
  const Component1611 = `option`;
  const Component1612 = `select`;
  const Component1613 = `label`;
  const Component1614 = `div`;
  const Component1615 = `input`;
  const Component1616 = `span`;
  const Component1617 = `input`;
  const Component1618 = `span`;
  const Component1619 = `label`;
  const Component1620 = `span`;
  const Component1621 = `span`;
  const Component1622 = `span`;
  const Component1623 = `span`;
  const Component1624 = `span`;
  const Component1625 = `div`;
  const Component1626 = `button`;
  const Component1627 = `button`;
  const Component1628 = `div`;
  const Component1629 = `div`;
  const Component1630 = `div`;
  const Component1631 = `div`;
  return <Component1631 className={`relative group/node w-full h-full min-w-[300px] min-h-[200px]`}>
      <_cmp__Component8 id={e} data={t} defaultTitle={`图片压缩`} icon={<_Component26 size={11} className={`text-gray-500`} />} floating={true} />
      <_cmp__Component9 visible={!!n} minWidth={300} minHeight={200} />
      <Component1630 className={`w-full h-full bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 flex flex-col drag-handle cursor-move ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}>
        <_cmp__Component12 type={`target`} position={X.Left} />
        <Component1598 type={`file`} ref={a} multiple={true} style={{
        display: `none`
      }} accept={`image/*`} onChange={y} />
        <Component1629 className={`flex-1 p-3 flex flex-col gap-2.5`}>
          {w === 0 ? <Component1600 onClick={() => {
          return a.current?.click();
        }} className={`nodrag flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg border border-dashed border-[#3a3a3a] text-gray-500 hover:text-blue-400 hover:border-blue-500/50 transition-colors`}>
              <_Component0 size={20} />
              <Component1599 className={`text-[11px]`}>{`上传图片 或 左侧连接图片节点`}</Component1599>
            </Component1600> : <Component1602 className={`text-[11px] text-gray-400`}>
              {`已连接 `}
              <Component1601 className={`text-blue-400`}>{w}</Component1601>
              {` 张图片`}
            </Component1602>}
          {i.errorMessage && <Component1604 className={`flex items-center gap-1.5 text-[11px] text-red-400`}>
              <_Component17 size={13} className={`shrink-0`} />
              <Component1603 className={`break-words`}>{i.errorMessage}</Component1603>
            </Component1604>}
          <Component1614 className={`grid grid-cols-3 gap-2`}>
            <Component1607 className={`nodrag flex flex-col gap-1 text-[10px] text-gray-500`}>
              {`尺寸`}
              <Component1606 value={o} onChange={e => {
              return s(Number(e.target.value));
            }} className={`nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555]`}>
                {Zc.map(e => {
                return <Component1605 value={e.value} key={e.value}>
                      {e.label}
                    </Component1605>;
              })}
              </Component1606>
            </Component1607>
            <Component1610 className={`nodrag flex flex-col gap-1 text-[10px] text-gray-500`}>
              {`清晰度`}
              <Component1609 value={c} disabled={C || f} onChange={e => {
              return l(Number(e.target.value));
            }} className={`nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555] disabled:opacity-40`}>
                {Qc.map(e => {
                return <Component1608 value={e.value} key={e.value}>
                      {e.label}
                    </Component1608>;
              })}
              </Component1609>
            </Component1610>
            <Component1613 className={`nodrag flex flex-col gap-1 text-[10px] text-gray-500`}>
              {`格式`}
              <Component1612 value={u} onChange={e => {
              return d(e.target.value);
            }} className={`nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555]`}>
                {$c.map(e => {
                return <Component1611 value={e.value} key={e.value}>
                      {e.label}
                    </Component1611>;
              })}
              </Component1612>
            </Component1613>
          </Component1614>
          {!C && <Component1619 className={`nodrag flex items-center gap-2 text-[10px] text-gray-400`}>
              <Component1615 type={`checkbox`} checked={f} onChange={e => {
            return p(e.target.checked);
          }} className={`nodrag accent-blue-500`} />
              <Component1616>{`限制目标大小`}</Component1616>
              {f && <Q.Fragment>
                  <Component1617 type={`number`} min={10} max={20000} value={m} onChange={e => {
              return h(Math.max(10, Number(e.target.value) || 10));
            }} className={`nodrag w-16 bg-[#222] border border-[#333] rounded px-1.5 py-0.5 text-[11px] text-gray-200 outline-none focus:border-[#555]`} />
                  <Component1618>{`KB`}</Component1618>
                </Q.Fragment>}
            </Component1619>}
          {i.resultInfo && <Component1625 className={`text-[10px] text-gray-400 flex items-center gap-2 flex-wrap`}>
              <Component1620>
                {i.resultInfo.count}
                {` 张`}
              </Component1620>
              <Component1621>{`·`}</Component1621>
              {i.resultInfo.totalOriginal ? <Component1623>
                  {el(i.resultInfo.totalOriginal)}
                  {` → `}
                  <Component1622 className={`text-blue-400`}>
                    {el(i.resultInfo.totalSize)}
                  </Component1622>
                </Component1623> : <Component1624 className={`text-blue-400`}>
                  {el(i.resultInfo.totalSize)}
                </Component1624>}
            </Component1625>}
          <Component1628 className={`mt-auto flex items-center gap-2`}>
            <Component1626 onClick={() => {
            return a.current?.click();
          }} className={`nodrag flex items-center justify-center h-8 w-8 rounded-md text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] transition-colors`} title={`上传图片`}>
              <_Component0 size={14} />
            </Component1626>
            <Component1627 onClick={b} disabled={x || w === 0} className={`nodrag flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-[12px] font-medium bg-white text-[#141414] hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}>
              {x ? <Q.Fragment>
                  <_n size={13} className={`animate-spin`} />
                  {` 压缩中 `}
                  {i.progress || 0}
                  {`%`}
                </Q.Fragment> : <Q.Fragment>
                  <_Component43 size={13} />
                  {` `}
                  {S ? `重新免费压缩` : `免费压缩`}
                  {w > 1 ? `（${w}张）` : ``}
                </Q.Fragment>}
            </Component1627>
          </Component1628>
        </Component1629>
        <_cmp__Component12 type={`source`} position={X.Right} id={`main-output`} />
      </Component1630>
    </Component1631>;
});
export default nl;