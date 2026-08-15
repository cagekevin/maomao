// TODO(全局, 无需 import): shapes, fallbackColor, n
import _cmp__Component90 from './_Component90.jsx';
import { Qp, e, t } from './shared.js';
import * as Z from 'react';
export default function _Component93({
  shapes: e,
  fallbackColor: t
}) {
  let n = Z.useMemo(() => {
    return Qp(e);
  }, [e]);
  const Component2070 = `group`;
  return <Component2070 name={`composite-model`} position={[-n[0], -n[1], -n[2]]}>
      {e.map((e, n) => {
      return <_cmp__Component90 shape={e} fallbackColor={t} key={n} />;
    })}
    </Component2070>;
}