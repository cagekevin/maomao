// TODO(全局, 无需 import): value, children, lodLevel, n, viewportMoving, r, nodeCount, i, handleFollowLimit, edgeFxLimit, o, s
import { e, xr, a, t, Sr, Cr } from './shared.js';
import * as Z from 'react';
export default function _Component108({
  value: e,
  children: t
}) {
  let n = e.lodLevel ?? xr.lodLevel;
  let r = e.viewportMoving ?? xr.viewportMoving;
  let i = e.nodeCount ?? xr.nodeCount;
  let a = e.handleFollowLimit ?? xr.handleFollowLimit;
  let o = e.edgeFxLimit ?? xr.edgeFxLimit;
  let s = Z.useMemo(() => {
    return {
      lodLevel: n,
      viewportMoving: r,
      nodeCount: i,
      handleFollowLimit: a,
      edgeFxLimit: o
    };
  }, [n, r, i, a, o]);
  return <Sr.Provider value={e.useThumbnail}>
      <Cr.Provider value={s}>{t}</Cr.Provider>
    </Sr.Provider>;
}