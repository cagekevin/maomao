// TODO(全局, 无需 import): color, length, name, position, radius, rotation, scale, n, r, o, i
import _cmp__Component76 from './_Component76.jsx';
import { a, t, e } from './shared.js';
export default function _Component81({
  color: e,
  length: t,
  name: n,
  position: r,
  radius: i,
  rotation: a,
  scale: o = [1, 1, 1]
}) {
  const Component1993 = `capsuleGeometry`;
  const Component1994 = `mesh`;
  return <Component1994 name={n} position={r} rotation={a} scale={o}>
      <Component1993 args={[i, t, 12, 22]} />
      <_cmp__Component76 color={e} />
    </Component1994>;
}