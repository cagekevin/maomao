// TODO(全局, 无需 import): children, n, r, i
import { e, wn, W, t } from './shared.js';
import * as Z from 'react';
export default function _Component92({
  children: e
}) {
  let t = Z.useRef(null);
  let n = Z.useRef(null);
  Z.useLayoutEffect(() => {
    let e = n.current;
    if (!e) {
      return;
    }
    e.position.set(0, 0, 0);
    e.updateMatrixWorld(true);
    let r = new wn().setFromObject(e);
    if (r.isEmpty()) {
      return;
    }
    let i = new W();
    r.getCenter(i);
    e.position.set(-i.x, -i.y, -i.z);
    t.current?.updateMatrixWorld(true);
  });
  const Component2071 = `group`;
  const Component2072 = `group`;
  return <Component2072 ref={t}>
      <Component2071 ref={n}>{e}</Component2071>
    </Component2072>;
}