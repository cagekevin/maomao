// TODO(全局, 无需 import): shapes, fallbackColor, n
import _cmp_Nm from './Nm.jsx';
import { ym, e, t } from './shared.js';
import * as Z from 'react';
export default function Pm({
  shapes: e,
  fallbackColor: t
}) {
  let n = Z.useMemo(() => {
    return ym(e);
  }, [e]);
  const Component2092 = `group`;
  return <Component2092 name={`composite-model`} position={[-n[0], -n[1], -n[2]]}>
      {e.map((e, n) => {
      return <_cmp_Nm shape={e} fallbackColor={t} key={n} />;
    })}
    </Component2092>;
}