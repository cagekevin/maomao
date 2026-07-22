import { i as e } from "../../vendor/rolldown-runtime.js";
import { Nr as le, Ar as o, Mr as ae } from "../../vendor/vendor.js";

var Y = e(le(), 1),
  Un = ae();
var X = o();
var gi = Y.forwardRef(({
  value: e,
  onChange: t,
  className: n = ``,
  style: r,
  placeholder: i,
  onKeyDown: a,
  onWheel: o,
  ...s
}, c) => {
  let l = Y.useRef(null);
  return Y.useImperativeHandle(c, () => l.current), X.jsx(`textarea`, {
    ref: l,
    className: `${n.split(/\s+/).filter(e => e && e !== `resize-y` && e !== `resize-x` && e !== `resize-none` && e !== `resize`).join(` `)} block`,
    style: {
      ...r,
      resize: `none`,
      boxSizing: `border-box`
    },
    value: e,
    onChange: e => t(e.target.value),
    placeholder: i,
    onKeyDown: a,
    onWheel: o,
    ...s
  });
});
gi.displayName = `ResizableTextarea`;

export { gi };
