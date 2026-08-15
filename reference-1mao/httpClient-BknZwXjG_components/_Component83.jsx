// TODO(全局, 无需 import): color, length, position, radius, scale, side, n, i, r
import _cmp__Component76 from './_Component76.jsx';
import { a, t, e } from './shared.js';
export default function _Component83({
  color: e,
  length: t,
  position: n,
  radius: r,
  scale: i,
  side: a
}) {
  const Component2004 = `capsuleGeometry`;
  const Component2005 = `mesh`;
  const Component2006 = `sphereGeometry`;
  const Component2007 = `mesh`;
  const Component2008 = `group`;
  return <Component2008 position={n}>
      <Component2005 name={a === `left` ? `humanoid-left-foot` : `humanoid-right-foot`} rotation={[Math.PI / 2, 0, 0]} scale={i}>
        <Component2004 args={[r, t, 12, 18]} />
        <_cmp__Component76 color={e} />
      </Component2005>
      <Component2007 name={a === `left` ? `humanoid-left-toe-cap` : `humanoid-right-toe-cap`} position={[0, -r * 0.04, t * 0.48]} scale={[i[0] * 0.92, i[1] * 0.72, i[2] * 0.48]}>
        <Component2006 args={[r, 16, 12]} />
        <_cmp__Component76 color={e} />
      </Component2007>
    </Component2008>;
}