// TODO(全局, 无需 import): objects, selectedObjectIds, transformMode, translationSnap, o, i, position, rotation, scale, project, n, s, anchor, transform, r
import _cmp__Component76 from './_Component76.jsx';
import { e, t, bm, a, $, xm, c, fm } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
export default function Rm({
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
    return bm(o);
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
          objects: xm(t.objects, o.map(e => {
            return e.id;
          }), n, t.anchor)
        }
      };
    });
  }
  if (o.length <= 1 || !s) {
    return null;
  } else {
    const Component2097 = `group`;
    return <Q.Fragment>
        <Component2097 ref={i} position={s.position} rotation={s.rotation} scale={s.scale} />
        <_cmp__Component76 mode={n} object={i} onObjectChange={c} onTransformEnd={() => {
        c();
        a.current = null;
      }} onTransformStart={() => {
        a.current = {
          anchor: fm(s),
          objects: $.getState().project.objects.map(e => {
            return {
              ...e,
              transform: fm(e.transform)
            };
          })
        };
      }} translationSnap={n === `translate` ? r : null} />
      </Q.Fragment>;
  }
}