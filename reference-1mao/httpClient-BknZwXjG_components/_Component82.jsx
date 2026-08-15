// TODO(全局, 无需 import): color, position, radius, scale, side, i, r, n
import _cmp__Component76 from './_Component76.jsx';
import { t, e, a } from './shared.js';
export default function _Component82({
  color: e,
  position: t,
  radius: n,
  scale: r,
  side: i
}) {
  let a = i === `left` ? -1 : 1;
  const Component1997 = `sphereGeometry`;
  const Component1998 = `mesh`;
  const Component1999 = `capsuleGeometry`;
  const Component2000 = `mesh`;
  const Component2001 = `capsuleGeometry`;
  const Component2002 = `mesh`;
  const Component2003 = `group`;
  return <Component2003 position={t} scale={r}>
      <Component1998 name={i === `left` ? `humanoid-left-hand` : `humanoid-right-hand`}>
        <Component1997 args={[n, 18, 18]} />
        <_cmp__Component76 color={e} />
      </Component1998>
      <Component2000 name={i === `left` ? `humanoid-left-thumb` : `humanoid-right-thumb`} position={[a * n * 0.76, -n * 0.12, n * 0.36]} rotation={[0.18, 0, a * 0.72]} scale={[0.58, 0.85, 0.52]}>
        <Component1999 args={[n * 0.24, n * 0.62, 8, 12]} />
        <_cmp__Component76 color={e} />
      </Component2000>
      <Component2002 name={i === `left` ? `humanoid-left-fingers` : `humanoid-right-fingers`} position={[0, -n * 0.44, n * 0.22]} rotation={[0.18, 0, 0]} scale={[1.12, 0.56, 0.48]}>
        <Component2001 args={[n * 0.34, n * 0.7, 8, 12]} />
        <_cmp__Component76 color={e} />
      </Component2002>
    </Component2003>;
}