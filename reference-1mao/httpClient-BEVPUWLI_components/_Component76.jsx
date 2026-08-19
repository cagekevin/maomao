// TODO(全局, 无需 import): mode, object, onObjectChange, onTransformEnd, onTransformStart, translationSnap, o, l, i, r, u, n, s
import { fn, e, am, $, lt, c, t, a, _Component72 } from './shared.js';
import * as Z from 'react';
export default function _Component76({
  mode: e,
  object: t,
  onObjectChange: n,
  onTransformEnd: r,
  onTransformStart: i,
  translationSnap: a
}) {
  let o = Z.useRef(null);
  let s = fn(e => {
    return e.scene;
  });
  let c = Z.useCallback(e => {
    o.current = e;
    if (e) {
      e.userData[am] = true;
    }
  }, []);
  let l = $(e => {
    return e.beginUndoBatch;
  });
  let u = $(e => {
    return e.endUndoBatch;
  });
  return lt(<_Component72 ref={c} mode={e} object={t} onMouseDown={() => {
    l();
    i?.();
  }} onMouseUp={() => {
    r?.();
    u();
  }} onObjectChange={n} translationSnap={a ?? undefined} userData={{
    [am]: true
  }} />, s);
}