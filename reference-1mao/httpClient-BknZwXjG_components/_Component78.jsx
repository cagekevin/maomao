// TODO(全局, 无需 import): abdomenPosition, abdomenScale, chestPosition, chestScale, color, pelvisPosition, pelvisRadius, pelvisScale, torsoLowerHeight, torsoLowerRadius, torsoUpperHeight, torsoUpperRadius, r, l, n, u, i, f, p, s, o
import _cmp__Component76 from './_Component76.jsx';
import _cmp__Component77 from './_Component77.jsx';
import { d, t, e, c, a } from './shared.js';
import * as Q from 'react';
export default function _Component78({
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
  const Component2009 = `capsuleGeometry`;
  const Component2010 = `mesh`;
  const Component2011 = `torusGeometry`;
  const Component2012 = `mesh`;
  const Component2013 = `capsuleGeometry`;
  const Component2014 = `mesh`;
  const Component2015 = `torusGeometry`;
  const Component2016 = `mesh`;
  const Component2017 = `sphereGeometry`;
  const Component2018 = `mesh`;
  return <Q.Fragment>
      <Component2010 name={`humanoid-chest`} position={n} scale={r}>
        <Component2009 args={[d, u, 18, 28]} />
        <_cmp__Component76 color={i} />
      </Component2010>
      <Component2012 name={`humanoid-chest-seam`} position={[n[0], n[1] - u * 0.38, n[2]]} rotation={[Math.PI / 2, 0, 0]} scale={[1, r[2] / r[0], 1]}>
        <Component2011 args={[f, Math.max(d * 0.028, 0.006), 8, 40]} />
        <_cmp__Component77 />
      </Component2012>
      <Component2014 name={`humanoid-abdomen`} position={e} scale={t}>
        <Component2013 args={[l, c, 16, 24]} />
        <_cmp__Component76 color={i} />
      </Component2014>
      <Component2016 name={`humanoid-waist-seam`} position={[e[0], e[1] - c * 0.46, e[2]]} rotation={[Math.PI / 2, 0, 0]} scale={[1, t[2] / t[0], 1]}>
        <Component2015 args={[p, Math.max(l * 0.026, 0.005), 8, 40]} />
        <_cmp__Component77 />
      </Component2016>
      <Component2018 name={`humanoid-pelvis`} position={a} scale={s}>
        <Component2017 args={[o, 24, 20]} />
        <_cmp__Component76 color={i} />
      </Component2018>
    </Q.Fragment>;
}