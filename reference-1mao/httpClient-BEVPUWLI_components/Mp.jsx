// TODO(全局, 无需 import): color, eyeRadius, faceOffsetZ, headRadius, headScale, mouthScale, neckHeight, neckPosition, neckRadius, noseScale, position, rotation, r, n, s, o, u, i, f, m, p, l
import _cmp_Tp from './Tp.jsx';
import _cmp_Ep from './Ep.jsx';
import { c, e, d, t, a } from './shared.js';
import * as Q from 'react';
export default function Mp({
  color: e,
  eyeRadius: t,
  faceOffsetZ: n,
  headRadius: r,
  headScale: i,
  mouthScale: a,
  neckHeight: o,
  neckPosition: s,
  neckRadius: c,
  noseScale: l,
  position: u,
  rotation: d
}) {
  let f = r * 0.16;
  let p = r * 0.26;
  let m = n + r * 0.08;
  const Component2041 = `cylinderGeometry`;
  const Component2042 = `mesh`;
  const Component2043 = `sphereGeometry`;
  const Component2044 = `mesh`;
  const Component2045 = `sphereGeometry`;
  const Component2046 = `mesh`;
  const Component2047 = `sphereGeometry`;
  const Component2048 = `mesh`;
  const Component2049 = `sphereGeometry`;
  const Component2050 = `mesh`;
  const Component2051 = `sphereGeometry`;
  const Component2052 = `mesh`;
  const Component2053 = `sphereGeometry`;
  const Component2054 = `mesh`;
  const Component2055 = `group`;
  return <Q.Fragment>
      <Component2042 name={`humanoid-neck`} position={s}>
        <Component2041 args={[c * 0.9, c, o, 18]} />
        <_cmp_Tp color={e} />
      </Component2042>
      <Component2055 position={u} rotation={d}>
        <Component2044 name={`humanoid-head`} scale={i}>
          <Component2043 args={[r, 28, 24]} />
          <_cmp_Tp color={e} />
        </Component2044>
        <Component2046 name={`humanoid-face-muzzle`} position={[0, -r * 0.08, n]} scale={[0.7, 0.52, 0.25]}>
          <Component2045 args={[r * 0.38, 16, 12]} />
          <_cmp_Tp color={e} />
        </Component2046>
        <Component2048 name={`humanoid-left-eye`} position={[-p, f, m]} scale={[1, 0.58, 0.32]}>
          <Component2047 args={[t, 10, 8]} />
          <_cmp_Ep />
        </Component2048>
        <Component2050 name={`humanoid-right-eye`} position={[p, f, m]} scale={[1, 0.58, 0.32]}>
          <Component2049 args={[t, 10, 8]} />
          <_cmp_Ep />
        </Component2050>
        <Component2052 name={`humanoid-nose`} position={[0, -r * 0.04, m + r * 0.05]} scale={l}>
          <Component2051 args={[r * 0.11, 12, 10]} />
          <_cmp_Tp color={e} />
        </Component2052>
        <Component2054 name={`humanoid-mouth`} position={[0, -r * 0.24, m + r * 0.025]} scale={a}>
          <Component2053 args={[r * 0.12, 12, 8]} />
          <_cmp_Ep />
        </Component2054>
      </Component2055>
    </Q.Fragment>;
}