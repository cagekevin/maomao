// TODO(全局, 无需 import): color, name, position, radius, scale, n, i, r
import _cmp__Component76 from './_Component76.jsx';
import { t, e } from './shared.js';
export default function _Component80({
  color: e,
  name: t = `humanoid-joint`,
  position: n,
  radius: r,
  scale: i = [1, 1, 1]
}) {
  const Component1995 = `sphereGeometry`;
  const Component1996 = `mesh`;
  return <Component1996 name={t} position={n} scale={i}>
      <Component1995 args={[r, 18, 18]} />
      <_cmp__Component76 color={e} />
    </Component1996>;
}