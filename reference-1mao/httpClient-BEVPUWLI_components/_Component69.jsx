// TODO(全局, 无需 import): abdomenPosition, abdomenScale, chestPosition, chestScale, color, pelvisPosition, pelvisRadius, pelvisScale, torsoLowerHeight, torsoLowerRadius, torsoUpperHeight, torsoUpperRadius, r, l, n, u, i, f, p, s, o
import _cmp_Tp from './Tp.jsx';
import _cmp_Ep from './Ep.jsx';
import { d, t, e, c, a } from './shared.js';
import * as Q from 'react';
export default function _Component69({
  abdomenPosition: e,
  abdomenScale: t,
  chestPosition: n,
  chestScale: r,
  color: i,
  pelvisPosition: a,
  pelvisRadius: o,
  pelvisScale: s,
  torsoLowerHeight: c,
  torsoLowerRadius: l,
  torsoUpperHeight: u,
  torsoUpperRadius: d
}) {
  let f = d * r[0] * 0.78;
  let p = l * t[0] * 0.92;
  const Component2031 = `capsuleGeometry`;
  const Component2032 = `mesh`;
  const Component2033 = `torusGeometry`;
  const Component2034 = `mesh`;
  const Component2035 = `capsuleGeometry`;
  const Component2036 = `mesh`;
  const Component2037 = `torusGeometry`;
  const Component2038 = `mesh`;
  const Component2039 = `sphereGeometry`;
  const Component2040 = `mesh`;
  return <Q.Fragment>
      <Component2032 name={`humanoid-chest`} position={n} scale={r}>
        <Component2031 args={[d, u, 18, 28]} />
        <_cmp_Tp color={i} />
      </Component2032>
      <Component2034 name={`humanoid-chest-seam`} position={[n[0], n[1] - u * 0.38, n[2]]} rotation={[Math.PI / 2, 0, 0]} scale={[1, r[2] / r[0], 1]}>
        <Component2033 args={[f, Math.max(d * 0.028, 0.006), 8, 40]} />
        <_cmp_Ep />
      </Component2034>
      <Component2036 name={`humanoid-abdomen`} position={e} scale={t}>
        <Component2035 args={[l, c, 16, 24]} />
        <_cmp_Tp color={i} />
      </Component2036>
      <Component2038 name={`humanoid-waist-seam`} position={[e[0], e[1] - c * 0.46, e[2]]} rotation={[Math.PI / 2, 0, 0]} scale={[1, t[2] / t[0], 1]}>
        <Component2037 args={[p, Math.max(l * 0.026, 0.005), 8, 40]} />
        <_cmp_Ep />
      </Component2038>
      <Component2040 name={`humanoid-pelvis`} position={a} scale={s}>
        <Component2039 args={[o, 24, 20]} />
        <_cmp_Tp color={i} />
      </Component2040>
    </Q.Fragment>;
}