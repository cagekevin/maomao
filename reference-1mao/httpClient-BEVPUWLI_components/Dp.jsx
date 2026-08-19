// TODO(全局, 无需 import): color, length, name, position, radius, rotation, scale, n, r, o, i
import _cmp_Tp from './Tp.jsx';
import { a, t, e } from './shared.js';
export default function Dp({
  color: e,
  length: t,
  name: n,
  position: r,
  radius: i,
  rotation: a,
  scale: o = [1, 1, 1]
}) {
  const Component2015 = `capsuleGeometry`;
  const Component2016 = `mesh`;
  return <Component2016 name={n} position={r} rotation={a} scale={o}>
      <Component2015 args={[i, t, 12, 22]} />
      <_cmp_Tp color={e} />
    </Component2016>;
}