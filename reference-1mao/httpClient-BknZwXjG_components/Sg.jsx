// TODO(全局, 无需 import): onSnapshotChange, snapshot, camera, r, n, i, fov, position, o
import { fn, W, t, lg, a, e, og, Bh, Vh, Ye, $t } from './shared.js';
import * as Z from 'react';
export default function Sg({
  onSnapshotChange: e,
  snapshot: t
}) {
  let {
    camera: n
  } = fn();
  let r = Z.useRef(new W(...t.target));
  Z.useLayoutEffect(() => {
    r.current.set(...t.target);
    lg(n, t);
  }, [n, t]);
  let i = Z.useCallback(() => {
    let i = n;
    let a = r.current;
    let o = a.clone().add(i.position);
    e({
      fov: t.fov,
      position: og(o),
      target: og(a)
    });
  }, [n, e, t.fov]);
  return <Ye alignment={`center-center`} margin={[0, 0]} onTarget={Z.useCallback(() => {
    return new W(0, 0, 0);
  }, [])} onUpdate={i}>
      <$t axisColors={Bh} disabled={true} scale={Vh} />
    </Ye>;
}