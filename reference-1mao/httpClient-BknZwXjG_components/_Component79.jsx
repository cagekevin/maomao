// TODO(全局, 无需 import): color, eyeRadius, faceOffsetZ, headRadius, headScale, mouthScale, neckHeight, neckPosition, neckRadius, noseScale, position, rotation, r, n, s, o, u, i, f, m, p, l
import _cmp__Component76 from './_Component76.jsx';
import _cmp__Component77 from './_Component77.jsx';
import { c, e, d, t, a } from './shared.js';
import * as Q from 'react';
export default function _Component79({
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
  const Component2019 = `cylinderGeometry`;
  const Component2020 = `mesh`;
  const Component2021 = `sphereGeometry`;
  const Component2022 = `mesh`;
  const Component2023 = `sphereGeometry`;
  const Component2024 = `mesh`;
  const Component2025 = `sphereGeometry`;
  const Component2026 = `mesh`;
  const Component2027 = `sphereGeometry`;
  const Component2028 = `mesh`;
  const Component2029 = `sphereGeometry`;
  const Component2030 = `mesh`;
  const Component2031 = `sphereGeometry`;
  const Component2032 = `mesh`;
  const Component2033 = `group`;
  return <Q.Fragment>
      <Component2020 name={`humanoid-neck`} position={s}>
        <Component2019 args={[c * 0.9, c, o, 18]} />
        <_cmp__Component76 color={e} />
      </Component2020>
      <Component2033 position={u} rotation={d}>
        <Component2022 name={`humanoid-head`} scale={i}>
          <Component2021 args={[r, 28, 24]} />
          <_cmp__Component76 color={e} />
        </Component2022>
        <Component2024 name={`humanoid-face-muzzle`} position={[0, -r * 0.08, n]} scale={[0.7, 0.52, 0.25]}>
          <Component2023 args={[r * 0.38, 16, 12]} />
          <_cmp__Component76 color={e} />
        </Component2024>
        <Component2026 name={`humanoid-left-eye`} position={[-p, f, m]} scale={[1, 0.58, 0.32]}>
          <Component2025 args={[t, 10, 8]} />
          <_cmp__Component77 />
        </Component2026>
        <Component2028 name={`humanoid-right-eye`} position={[p, f, m]} scale={[1, 0.58, 0.32]}>
          <Component2027 args={[t, 10, 8]} />
          <_cmp__Component77 />
        </Component2028>
        <Component2030 name={`humanoid-nose`} position={[0, -r * 0.04, m + r * 0.05]} scale={l}>
          <Component2029 args={[r * 0.11, 12, 10]} />
          <_cmp__Component76 color={e} />
        </Component2030>
        <Component2032 name={`humanoid-mouth`} position={[0, -r * 0.24, m + r * 0.025]} scale={a}>
          <Component2031 args={[r * 0.12, 12, 8]} />
          <_cmp__Component77 />
        </Component2032>
      </Component2033>
    </Q.Fragment>;
}