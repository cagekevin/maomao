// TODO(全局, 无需 import): object, clone, normalization, n
import { e, t, Xp, wn } from './shared.js';
import * as Z from 'react';
export default function _Component87({
  object: e
}) {
  let {
    clone: t,
    normalization: n
  } = Z.useMemo(() => {
    let t = e.clone(true);
    t.updateMatrixWorld(true);
    return {
      clone: t,
      normalization: Xp(new wn().setFromObject(t))
    };
  }, [e]);
  const Component2047 = `primitive`;
  const Component2048 = `group`;
  return <Component2048 position={n.position} scale={[n.scale, n.scale, n.scale]}>
      <Component2047 object={t} />
    </Component2048>;
}