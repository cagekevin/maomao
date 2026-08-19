// TODO(全局, 无需 import): onSnapshotChange, snapshot, camera, r, n, i, fov, position, o
import { fn, G, t, Ag, a, e, Dg, sg, cg, Ye, $t } from './shared.js';
import * as Z from 'react';
export default function Ug({
  onSnapshotChange: e,
  snapshot: t
}) {
  let {
    camera: n
  } = fn();
  let r = Z.useRef(new G(...t.target));
  Z.useLayoutEffect(() => {
    r.current.set(...t.target);
    Ag(n, t);
  }, [n, t]);
  let i = Z.useCallback(() => {
    let i = n;
    let a = r.current;
    let o = a.clone().add(i.position);
    e({
      fov: t.fov,
      position: Dg(o),
      target: Dg(a)
    });
  }, [n, e, t.fov]);
  return <Ye alignment={`center-center`} margin={[0, 0]} onTarget={Z.useCallback(() => {
    return new G(0, 0, 0);
  }, [])} onUpdate={i}>
      <$t axisColors={sg} disabled={true} scale={cg} />
    </Ye>;
}