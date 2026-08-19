// TODO(全局, 无需 import): camera, object, selected, showLabel, transformMode, transformable, translationSnap, s, m, r, i, l, transform, position, n, rotation, scale, g, f, u, p, o
import _cmp__Component75 from './_Component75.jsx';
import _cmp__Component76 from './_Component76.jsx';
import { $, e, Em, Dm, gm, zm, hm, t, rm, G, a, c, am, d, em, tm, _, h, _Component77 } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
export default function Bm({
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
    return Em();
  }, []);
  let d = Z.useMemo(() => {
    return Dm();
  }, []);
  let f = Z.useMemo(() => {
    return gm();
  }, []);
  let p = Z.useMemo(() => {
    return zm(e);
  }, [e]);
  let m = Z.useMemo(() => {
    return hm(e.transform.position, e.target);
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
    let r = rm.clone().applyQuaternion(t.quaternion).normalize();
    let i = new G(...e.target).distanceTo(t.position);
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
  const Component2098 = `boxGeometry`;
  const Component2099 = `meshBasicMaterial`;
  const Component2100 = `mesh`;
  const Component2101 = `group`;
  let _ = <Component2101 ref={s} position={e.transform.position} quaternion={m} scale={t?.transform.scale ?? [1, 1, 1]} userData={{
    [am]: true
  }} onClick={g}>
      {r ? <_cmp__Component75 position={[0, f, 0]}>{e.name}</_cmp__Component75> : null}
      <Component2100 name={`${e.id}-hit-area`} onClick={g} position={d.position}>
        <Component2098 args={d.args} />
        <Component2099 depthWrite={false} opacity={0} transparent={true} />
      </Component2100>
      {u.map((t, n) => {
      return <_Component77 color={em} lineWidth={1} name={`${e.id}-${t.part}-${n}`} onClick={g} opacity={tm} points={t.points} transparent={true} key={`${e.id}-${t.part}-${n}`} />;
    })}
      {p.map((t, n) => {
      return <_Component77 color={em} lineWidth={1} name={`${e.id}-viewfinder-${n}`} onClick={g} opacity={tm} points={t} transparent={true} key={`${e.id}-frustum-${n}`} />;
    })}
    </Component2101>;
  if (!n || !a) {
    return _;
  } else {
    return <Q.Fragment>
        {_}
        <_cmp__Component76 mode={i} object={s} onObjectChange={h} translationSnap={i === `translate` ? o : null} />
      </Q.Fragment>;
  }
}