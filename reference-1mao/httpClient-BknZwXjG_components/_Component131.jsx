// TODO(全局, 无需 import): value, children, lodLevel, n, viewportMoving, r, nodeCount, i, handleFollowLimit, edgeFxLimit, o, s
import { e, gr, a, t, _r, vr } from './shared.js';
import * as Z from 'react';
export default function _Component131({
  value: e,
  children: t
}) {
  let n = e.lodLevel ?? gr.lodLevel;
  let r = e.viewportMoving ?? gr.viewportMoving;
  let i = e.nodeCount ?? gr.nodeCount;
  let a = e.handleFollowLimit ?? gr.handleFollowLimit;
  let o = e.edgeFxLimit ?? gr.edgeFxLimit;
  let s = Z.useMemo(() => {
    return {
      lodLevel: n,
      viewportMoving: r,
      nodeCount: i,
      handleFollowLimit: a,
      edgeFxLimit: o
    };
  }, [n, r, i, a, o]);
  return <_r.Provider value={e.useThumbnail}>
      <vr.Provider value={s}>{t}</vr.Provider>
    </_r.Provider>;
}