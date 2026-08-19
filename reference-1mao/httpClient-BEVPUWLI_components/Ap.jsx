// TODO(全局, 无需 import): color, length, position, radius, scale, side, n, i, r
import _cmp_Tp from './Tp.jsx';
import { a, t, e } from './shared.js';
export default function Ap({
  color: e,
  length: t,
  position: n,
  radius: r,
  scale: i,
  side: a
}) {
  const Component2026 = `capsuleGeometry`;
  const Component2027 = `mesh`;
  const Component2028 = `sphereGeometry`;
  const Component2029 = `mesh`;
  const Component2030 = `group`;
  return <Component2030 position={n}>
      <Component2027 name={a === `left` ? `humanoid-left-foot` : `humanoid-right-foot`} rotation={[Math.PI / 2, 0, 0]} scale={i}>
        <Component2026 args={[r, t, 12, 18]} />
        <_cmp_Tp color={e} />
      </Component2027>
      <Component2029 name={a === `left` ? `humanoid-left-toe-cap` : `humanoid-right-toe-cap`} position={[0, -r * 0.04, t * 0.48]} scale={[i[0] * 0.92, i[1] * 0.72, i[2] * 0.48]}>
        <Component2028 args={[r, 16, 12]} />
        <_cmp_Tp color={e} />
      </Component2029>
    </Component2030>;
}