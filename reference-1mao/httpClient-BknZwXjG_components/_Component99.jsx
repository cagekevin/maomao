// TODO(全局, 无需 import): camera, object, selected, showLabel, transformMode, transformable, translationSnap, s, m, r, i, l, transform, position, n, rotation, scale, g, f, u, p, o
import _cmp_Kp from './Kp.jsx';
import _cmp__Component95 from './_Component95.jsx';
import { $, e, am, om, Yp, vm, Jp, t, Ip, W, a, c, Rp, d, Np, Pp, _, h, _Component96 } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
export default function _Component99({
  camera: e,
  object: t,
  selected: n,
  showLabel: r,
  transformMode: i,
  transformable: a,
  translationSnap: o
}) {
  let s = Z.useRef(null);
  let c = $(e => {
    return e.selectObject;
  });
  let l = $(e => {
    return e.updateCamera;
  });
  let u = Z.useMemo(() => {
    return am();
  }, []);
  let d = Z.useMemo(() => {
    return om();
  }, []);
  let f = Z.useMemo(() => {
    return Yp();
  }, []);
  let p = Z.useMemo(() => {
    return vm(e);
  }, [e]);
  let m = Z.useMemo(() => {
    return Jp(e.transform.position, e.target);
  }, [e.target, e.transform.position]);
  Z.useLayoutEffect(() => {
    s.current?.quaternion?.copy?.(m);
  }, [m]);
  function h() {
    let t = s.current;
    if (!t) {
      return;
    }
    let n = [t.position.x, t.position.y, t.position.z];
    let r = Ip.clone().applyQuaternion(t.quaternion).normalize();
    let i = new W(...e.target).distanceTo(t.position);
    let a = t.position.clone().add(r.multiplyScalar(Math.max(i, 0.1)));
    l(e.id, {
      transform: {
        position: n,
        rotation: [t.rotation.x, t.rotation.y, t.rotation.z],
        scale: [t.scale.x, t.scale.y, t.scale.z]
      },
      target: [a.x, a.y, a.z]
    });
  }
  function g(e) {
    e.stopPropagation();
    c(t?.id ?? null);
  }
  const Component2076 = `boxGeometry`;
  const Component2077 = `meshBasicMaterial`;
  const Component2078 = `mesh`;
  const Component2079 = `group`;
  let _ = <Component2079 ref={s} position={e.transform.position} quaternion={m} scale={t?.transform.scale ?? [1, 1, 1]} userData={{
    [Rp]: true
  }} onClick={g}>
      {r ? <_cmp_Kp position={[0, f, 0]}>{e.name}</_cmp_Kp> : null}
      <Component2078 name={`${e.id}-hit-area`} onClick={g} position={d.position}>
        <Component2076 args={d.args} />
        <Component2077 depthWrite={false} opacity={0} transparent={true} />
      </Component2078>
      {u.map((t, n) => {
      return <_Component96 color={Np} lineWidth={1} name={`${e.id}-${t.part}-${n}`} onClick={g} opacity={Pp} points={t.points} transparent={true} key={`${e.id}-${t.part}-${n}`} />;
    })}
      {p.map((t, n) => {
      return <_Component96 color={Np} lineWidth={1} name={`${e.id}-viewfinder-${n}`} onClick={g} opacity={Pp} points={t} transparent={true} key={`${e.id}-frustum-${n}`} />;
    })}
    </Component2079>;
  if (!n || !a) {
    return _;
  } else {
    return <Q.Fragment>
        {_}
        <_cmp__Component95 mode={i} object={s} onObjectChange={h} translationSnap={i === `translate` ? o : null} />
      </Q.Fragment>;
  }
}