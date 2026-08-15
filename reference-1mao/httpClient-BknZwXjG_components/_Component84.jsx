// TODO(全局, 无需 import): bodyType, color, rigState, n, r, i, v, x, k, o, s, b, l, u, f, p, m, g
import _cmp__Component78 from './_Component78.jsx';
import _cmp__Component79 from './_Component79.jsx';
import _cmp__Component80 from './_Component80.jsx';
import _cmp__Component81 from './_Component81.jsx';
import _cmp__Component82 from './_Component82.jsx';
import _cmp__Component83 from './_Component83.jsx';
import { ou, e, du, pp, fu, a, _, y, w, t, c, j, S, C, d, T, E, D, O, h, A } from './shared.js';
export default function _Component84({
  bodyType: e,
  color: t = `#4F8EF7`,
  rigState: n
}) {
  let r = ou(e);
  let i = n?.controls ?? {};
  let a = r.proportions;
  let o = du(i, `body`, r.bodyType);
  let s = du(i, `torso`, r.bodyType);
  let c = du(i, `head`, r.bodyType);
  let l = pp(i, `leftShoulder`, r.bodyType);
  let u = pp(i, `rightShoulder`, r.bodyType);
  let d = fu(i, `leftElbow.bend`, r.bodyType);
  let f = fu(i, `rightElbow.bend`, r.bodyType);
  let p = pp(i, `leftHip`, r.bodyType);
  let m = pp(i, `rightHip`, r.bodyType);
  let h = fu(i, `leftKnee.bend`, r.bodyType);
  let g = fu(i, `rightKnee.bend`, r.bodyType);
  let _ = a.hipY + a.pelvisRadius * 0.6 + a.torsoLowerHeight * 0.5;
  let v = _ + a.torsoLowerHeight * 0.5 + a.torsoUpperHeight * 0.5 + a.torsoUpperRadius * 0.1;
  let y = v + a.torsoUpperHeight * 0.5 + a.neckHeight * 0.5 + a.torsoUpperRadius * 0.2;
  let b = y + a.neckHeight * 0.5 + a.headRadius * 0.75;
  let x = v + a.torsoUpperHeight * 0.16 + a.shoulderRadius * 0.4;
  let S = x - a.shoulderRadius * 0.55;
  let C = -(a.upperArmLength + a.upperArmRadius + a.elbowRadius);
  let w = -(a.forearmLength + a.forearmRadius + a.wristRadius);
  let T = w - a.handRadius - 0.05;
  let E = a.hipY - a.pelvisRadius * 0.15;
  let D = a.hipY - a.pelvisRadius * 0.35;
  let O = -(a.thighLength + a.thighRadius + a.kneeRadius);
  let k = -(a.calfLength + a.calfRadius + a.ankleRadius);
  let A = k - a.footRadius - 0.045;
  let j = [a.jointRadiusScale, a.jointRadiusScale, a.jointRadiusScale];
  const Component2034 = `group`;
  const Component2035 = `group`;
  const Component2036 = `group`;
  const Component2037 = `group`;
  const Component2038 = `group`;
  const Component2039 = `group`;
  const Component2040 = `group`;
  const Component2041 = `group`;
  const Component2042 = `group`;
  const Component2043 = `group`;
  return <Component2043 name={`procedural-${r.bodyType}`} rotation={o} scale={r.defaultScale}>
      <Component2038 rotation={s}>
        <_cmp__Component78 abdomenPosition={[0, _, 0]} abdomenScale={a.torsoLowerScale} chestPosition={[0, v, 0]} chestScale={a.torsoUpperScale} color={t} pelvisPosition={[0, a.hipY, 0]} pelvisRadius={a.pelvisRadius} pelvisScale={a.pelvisScale} torsoLowerHeight={a.torsoLowerHeight} torsoLowerRadius={a.torsoLowerRadius} torsoUpperHeight={a.torsoUpperHeight} torsoUpperRadius={a.torsoUpperRadius} />
        <_cmp__Component79 color={t} eyeRadius={a.eyeRadius} faceOffsetZ={a.faceOffsetZ} headRadius={a.headRadius} headScale={a.headScale} mouthScale={a.mouthScale} neckHeight={a.neckHeight} neckPosition={[0, y, 0]} neckRadius={a.neckRadius} noseScale={a.noseScale} position={[0, b, 0]} rotation={c} />
        <_cmp__Component80 color={t} position={[-a.shoulderWidth * 0.86, x, 0]} radius={a.shoulderRadius} scale={j} />
        <_cmp__Component80 color={t} position={[a.shoulderWidth * 0.86, x, 0]} radius={a.shoulderRadius} scale={j} />
        <Component2035 position={[-a.shoulderWidth, S, 0]} rotation={l}>
          <_cmp__Component81 color={t} length={a.upperArmLength} position={[0, -(a.upperArmLength * 0.5 + a.upperArmRadius), 0]} radius={a.upperArmRadius} />
          <Component2034 position={[0, C, 0]} rotation={d}>
            <_cmp__Component80 color={t} position={[0, 0, 0]} radius={a.elbowRadius} scale={j} />
            <_cmp__Component81 color={t} length={a.forearmLength} position={[0, -(a.forearmLength * 0.5 + a.forearmRadius), 0]} radius={a.forearmRadius} />
            <_cmp__Component80 color={t} position={[0, w, 0]} radius={a.wristRadius} scale={j} />
            <_cmp__Component82 color={t} position={[0, T, 0.02]} radius={a.handRadius} scale={a.handScale} side={`left`} />
          </Component2034>
        </Component2035>
        <Component2037 position={[a.shoulderWidth, S, 0]} rotation={u}>
          <_cmp__Component81 color={t} length={a.upperArmLength} position={[0, -(a.upperArmLength * 0.5 + a.upperArmRadius), 0]} radius={a.upperArmRadius} />
          <Component2036 position={[0, C, 0]} rotation={f}>
            <_cmp__Component80 color={t} position={[0, 0, 0]} radius={a.elbowRadius} scale={j} />
            <_cmp__Component81 color={t} length={a.forearmLength} position={[0, -(a.forearmLength * 0.5 + a.forearmRadius), 0]} radius={a.forearmRadius} />
            <_cmp__Component80 color={t} position={[0, w, 0]} radius={a.wristRadius} scale={j} />
            <_cmp__Component82 color={t} position={[0, T, 0.02]} radius={a.handRadius} scale={a.handScale} side={`right`} />
          </Component2036>
        </Component2037>
      </Component2038>
      <_cmp__Component80 color={t} position={[-a.legSpread, E, 0]} radius={a.thighRadius * 1.08} scale={j} />
      <_cmp__Component80 color={t} position={[a.legSpread, E, 0]} radius={a.thighRadius * 1.08} scale={j} />
      <Component2040 position={[-a.legSpread, D, 0]} rotation={p}>
        <_cmp__Component81 color={t} length={a.thighLength} position={[0, -(a.thighLength * 0.5 + a.thighRadius), 0]} radius={a.thighRadius} />
        <Component2039 position={[0, O, 0]} rotation={h}>
          <_cmp__Component80 color={t} position={[0, 0, 0]} radius={a.kneeRadius} scale={j} />
          <_cmp__Component81 color={t} length={a.calfLength} position={[0, -(a.calfLength * 0.5 + a.calfRadius), 0]} radius={a.calfRadius} />
          <_cmp__Component80 color={t} position={[0, k, 0]} radius={a.ankleRadius} scale={j} />
          <_cmp__Component83 color={t} length={a.footLength} position={[0, A, a.footRadius * 0.74]} radius={a.footRadius} scale={a.footScale} side={`left`} />
        </Component2039>
      </Component2040>
      <Component2042 position={[a.legSpread, D, 0]} rotation={m}>
        <_cmp__Component81 color={t} length={a.thighLength} position={[0, -(a.thighLength * 0.5 + a.thighRadius), 0]} radius={a.thighRadius} />
        <Component2041 position={[0, O, 0]} rotation={g}>
          <_cmp__Component80 color={t} position={[0, 0, 0]} radius={a.kneeRadius} scale={j} />
          <_cmp__Component81 color={t} length={a.calfLength} position={[0, -(a.calfLength * 0.5 + a.calfRadius), 0]} radius={a.calfRadius} />
          <_cmp__Component80 color={t} position={[0, k, 0]} radius={a.ankleRadius} scale={j} />
          <_cmp__Component83 color={t} length={a.footLength} position={[0, A, a.footRadius * 0.74]} radius={a.footRadius} scale={a.footScale} side={`right`} />
        </Component2041>
      </Component2042>
    </Component2043>;
}