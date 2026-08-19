// TODO(全局, 无需 import): color, name, position, radius, scale, n, i, r
import _cmp_Tp from './Tp.jsx';
import { t, e } from './shared.js';
export default function Op({
  color: e,
  name: t = `humanoid-joint`,
  position: n,
  radius: r,
  scale: i = [1, 1, 1]
}) {
  const Component2017 = `sphereGeometry`;
  const Component2018 = `mesh`;
  return <Component2018 name={t} position={n} scale={i}>
      <Component2017 args={[r, 18, 18]} />
      <_cmp_Tp color={e} />
    </Component2018>;
}