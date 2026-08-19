// TODO(全局, 无需 import): children, n, r, i
import { e, wn, G, t } from './shared.js';
import * as Z from 'react';
export default function Fm({
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
    let i = new G();
    r.getCenter(i);
    e.position.set(-i.x, -i.y, -i.z);
    t.current?.updateMatrixWorld(true);
  });
  const Component2093 = `group`;
  const Component2094 = `group`;
  return <Component2094 ref={t}>
      <Component2093 ref={n}>{e}</Component2093>
    </Component2094>;
}