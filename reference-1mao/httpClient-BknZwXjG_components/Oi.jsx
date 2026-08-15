// TODO(全局, 无需 import): value, onChange, className, style, placeholder, onKeyDown, onWheel, l, n, r, resize, boxSizing, i, o, s
import { c, e, t, a } from './shared.js';
import * as Z from 'react';
var Oi = Z.forwardRef(({
  value: e,
  onChange: t,
  className: n = ``,
  style: r,
  placeholder: i,
  onKeyDown: a,
  onWheel: o,
  ...s
}, c) => {
  let l = Z.useRef(null);
  Z.useImperativeHandle(c, () => {
    return l.current;
  });
  const Component166 = `textarea`;
  return <Component166 ref={l} className={`${n.split(/\s+/).filter(e => {
    return e && e !== `resize-y` && e !== `resize-x` && e !== `resize-none` && e !== `resize`;
  }).join(` `)} block`} style={{
    ...r,
    resize: `none`,
    boxSizing: `border-box`
  }} value={e} onChange={e => {
    return t(e.target.value);
  }} placeholder={i} onKeyDown={a} onWheel={o} {...s} />;
});
export default Oi;