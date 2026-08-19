// TODO(全局, 无需 import): bodyType, color, rigState, n, r, i, v, x, k, o, s, b, l, u, f, p, m, g
import _cmp__Component69 from './_Component69.jsx';
import _cmp_Mp from './Mp.jsx';
import _cmp_Op from './Op.jsx';
import _cmp_Dp from './Dp.jsx';
import _cmp__Component70 from './_Component70.jsx';
import _cmp_Ap from './Ap.jsx';
import { Du, e, Mu, Pp, Nu, a, _, y, w, t, c, j, S, C, d, T, E, D, O, h, A } from './shared.js';
export default function Fp({
  bodyType: e,
  color: t = `#4F8EF7`,
  rigState: n
}) {
  let r = Du(e);
  let i = n?.controls ?? {};
  let a = r.proportions;
  let o = Mu(i, `body`, r.bodyType);
  let s = Mu(i, `torso`, r.bodyType);
  let c = Mu(i, `head`, r.bodyType);
  let l = Pp(i, `leftShoulder`, r.bodyType);
  let u = Pp(i, `rightShoulder`, r.bodyType);
  let d = Nu(i, `leftElbow.bend`, r.bodyType);
  let f = Nu(i, `rightElbow.bend`, r.bodyType);
  let p = Pp(i, `leftHip`, r.bodyType);
  let m = Pp(i, `rightHip`, r.bodyType);
  let h = Nu(i, `leftKnee.bend`, r.bodyType);
  let g = Nu(i, `rightKnee.bend`, r.bodyType);
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
  const Component2056 = `group`;
  const Component2057 = `group`;
  const Component2058 = `group`;
  const Component2059 = `group`;
  const Component2060 = `group`;
  const Component2061 = `group`;
  const Component2062 = `group`;
  const Component2063 = `group`;
  const Component2064 = `group`;
  const Component2065 = `group`;
  return <Component2065 name={`procedural-${r.bodyType}`} rotation={o} scale={r.defaultScale}>
      <Component2060 rotation={s}>
        <_cmp__Component69 abdomenPosition={[0, _, 0]} abdomenScale={a.torsoLowerScale} chestPosition={[0, v, 0]} chestScale={a.torsoUpperScale} color={t} pelvisPosition={[0, a.hipY, 0]} pelvisRadius={a.pelvisRadius} pelvisScale={a.pelvisScale} torsoLowerHeight={a.torsoLowerHeight} torsoLowerRadius={a.torsoLowerRadius} torsoUpperHeight={a.torsoUpperHeight} torsoUpperRadius={a.torsoUpperRadius} />
        <_cmp_Mp color={t} eyeRadius={a.eyeRadius} faceOffsetZ={a.faceOffsetZ} headRadius={a.headRadius} headScale={a.headScale} mouthScale={a.mouthScale} neckHeight={a.neckHeight} neckPosition={[0, y, 0]} neckRadius={a.neckRadius} noseScale={a.noseScale} position={[0, b, 0]} rotation={c} />
        <_cmp_Op color={t} position={[-a.shoulderWidth * 0.86, x, 0]} radius={a.shoulderRadius} scale={j} />
        <_cmp_Op color={t} position={[a.shoulderWidth * 0.86, x, 0]} radius={a.shoulderRadius} scale={j} />
        <Component2057 position={[-a.shoulderWidth, S, 0]} rotation={l}>
          <_cmp_Dp color={t} length={a.upperArmLength} position={[0, -(a.upperArmLength * 0.5 + a.upperArmRadius), 0]} radius={a.upperArmRadius} />
          <Component2056 position={[0, C, 0]} rotation={d}>
            <_cmp_Op color={t} position={[0, 0, 0]} radius={a.elbowRadius} scale={j} />
            <_cmp_Dp color={t} length={a.forearmLength} position={[0, -(a.forearmLength * 0.5 + a.forearmRadius), 0]} radius={a.forearmRadius} />
            <_cmp_Op color={t} position={[0, w, 0]} radius={a.wristRadius} scale={j} />
            <_cmp__Component70 color={t} position={[0, T, 0.02]} radius={a.handRadius} scale={a.handScale} side={`left`} />
          </Component2056>
        </Component2057>
        <Component2059 position={[a.shoulderWidth, S, 0]} rotation={u}>
          <_cmp_Dp color={t} length={a.upperArmLength} position={[0, -(a.upperArmLength * 0.5 + a.upperArmRadius), 0]} radius={a.upperArmRadius} />
          <Component2058 position={[0, C, 0]} rotation={f}>
            <_cmp_Op color={t} position={[0, 0, 0]} radius={a.elbowRadius} scale={j} />
            <_cmp_Dp color={t} length={a.forearmLength} position={[0, -(a.forearmLength * 0.5 + a.forearmRadius), 0]} radius={a.forearmRadius} />
            <_cmp_Op color={t} position={[0, w, 0]} radius={a.wristRadius} scale={j} />
            <_cmp__Component70 color={t} position={[0, T, 0.02]} radius={a.handRadius} scale={a.handScale} side={`right`} />
          </Component2058>
        </Component2059>
      </Component2060>
      <_cmp_Op color={t} position={[-a.legSpread, E, 0]} radius={a.thighRadius * 1.08} scale={j} />
      <_cmp_Op color={t} position={[a.legSpread, E, 0]} radius={a.thighRadius * 1.08} scale={j} />
      <Component2062 position={[-a.legSpread, D, 0]} rotation={p}>
        <_cmp_Dp color={t} length={a.thighLength} position={[0, -(a.thighLength * 0.5 + a.thighRadius), 0]} radius={a.thighRadius} />
        <Component2061 position={[0, O, 0]} rotation={h}>
          <_cmp_Op color={t} position={[0, 0, 0]} radius={a.kneeRadius} scale={j} />
          <_cmp_Dp color={t} length={a.calfLength} position={[0, -(a.calfLength * 0.5 + a.calfRadius), 0]} radius={a.calfRadius} />
          <_cmp_Op color={t} position={[0, k, 0]} radius={a.ankleRadius} scale={j} />
          <_cmp_Ap color={t} length={a.footLength} position={[0, A, a.footRadius * 0.74]} radius={a.footRadius} scale={a.footScale} side={`left`} />
        </Component2061>
      </Component2062>
      <Component2064 position={[a.legSpread, D, 0]} rotation={m}>
        <_cmp_Dp color={t} length={a.thighLength} position={[0, -(a.thighLength * 0.5 + a.thighRadius), 0]} radius={a.thighRadius} />
        <Component2063 position={[0, O, 0]} rotation={g}>
          <_cmp_Op color={t} position={[0, 0, 0]} radius={a.kneeRadius} scale={j} />
          <_cmp_Dp color={t} length={a.calfLength} position={[0, -(a.calfLength * 0.5 + a.calfRadius), 0]} radius={a.calfRadius} />
          <_cmp_Op color={t} position={[0, k, 0]} radius={a.ankleRadius} scale={j} />
          <_cmp_Ap color={t} length={a.footLength} position={[0, A, a.footRadius * 0.74]} radius={a.footRadius} scale={a.footScale} side={`right`} />
        </Component2063>
      </Component2064>
    </Component2065>;
}