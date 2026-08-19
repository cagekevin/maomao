// TODO(全局, 无需 import): object, clone, normalization, n
import { e, t, _m, wn } from './shared.js';
import * as Z from 'react';
export default function Om({
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
      normalization: _m(new wn().setFromObject(t))
    };
  }, [e]);
  const Component2069 = `primitive`;
  const Component2070 = `group`;
  return <Component2070 position={n.position} scale={[n.scale, n.scale, n.scale]}>
      <Component2069 object={t} />
    </Component2070>;
}