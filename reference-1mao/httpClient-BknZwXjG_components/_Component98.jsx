// TODO(全局, 无需 import): crowdId, objects, selected, transformMode, transformable, translationSnap, o, s, position, rotation, scale, r, l
import _cmp__Component95 from './_Component95.jsx';
import { $, e, qd, t, c, a } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
export default function _Component98({
  crowdId: e,
  objects: t,
  selected: n,
  transformMode: r,
  transformable: i,
  translationSnap: a
}) {
  let o = Z.useRef(null);
  let s = $(e => {
    return e.updateCrowdTransform;
  });
  let c = Z.useMemo(() => {
    return qd(t, e);
  }, [t, e]);
  function l() {
    let t = o.current;
    if (t) {
      s(e, {
        position: [t.position.x, t.position.y, t.position.z],
        rotation: [t.rotation.x, t.rotation.y, t.rotation.z],
        scale: [t.scale.x, t.scale.y, t.scale.z]
      });
    }
  }
  if (!n || !i || !c) {
    return null;
  } else {
    const Component2074 = `group`;
    return <Q.Fragment>
        <Component2074 ref={o} position={c.position} rotation={c.rotation} scale={c.scale} />
        <_cmp__Component95 mode={r} object={o} onObjectChange={l} translationSnap={r === `translate` ? a : null} />
      </Q.Fragment>;
  }
}