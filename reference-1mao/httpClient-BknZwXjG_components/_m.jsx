// TODO(全局, 无需 import): objects, selectedObjectIds, transformMode, translationSnap, o, i, position, rotation, scale, project, n, s, anchor, transform, r
import _cmp__Component95 from './_Component95.jsx';
import { e, t, $p, a, $, em, c, Gp } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
export default function _m({
  objects: e,
  selectedObjectIds: t,
  transformMode: n,
  translationSnap: r
}) {
  let i = Z.useRef(null);
  let a = Z.useRef(null);
  let o = Z.useMemo(() => {
    return e.filter(e => {
      return t.includes(e.id) && !e.locked;
    });
  }, [e, t]);
  let s = Z.useMemo(() => {
    return $p(o);
  }, [o]);
  function c() {
    let e = i.current;
    let t = a.current;
    if (!e || !t) {
      return;
    }
    let n = {
      position: [e.position.x, e.position.y, e.position.z],
      rotation: [e.rotation.x, e.rotation.y, e.rotation.z],
      scale: [e.scale.x, e.scale.y, e.scale.z]
    };
    $.setState(e => {
      return {
        ...e,
        project: {
          ...e.project,
          objects: em(t.objects, o.map(e => {
            return e.id;
          }), n, t.anchor)
        }
      };
    });
  }
  if (o.length <= 1 || !s) {
    return null;
  } else {
    const Component2075 = `group`;
    return <Q.Fragment>
        <Component2075 ref={i} position={s.position} rotation={s.rotation} scale={s.scale} />
        <_cmp__Component95 mode={n} object={i} onObjectChange={c} onTransformEnd={() => {
        c();
        a.current = null;
      }} onTransformStart={() => {
        a.current = {
          anchor: Gp(s),
          objects: $.getState().project.objects.map(e => {
            return {
              ...e,
              transform: Gp(e.transform)
            };
          })
        };
      }} translationSnap={n === `translate` ? r : null} />
      </Q.Fragment>;
  }
}