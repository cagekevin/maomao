// TODO(全局, 无需 import): label, ariaLabel, value, onChange, type, step, min, max, beginInteraction, endInteraction, s, o, i, n, r, l
import { _f, e, t, a, c } from './shared.js';
export default function _Component66({
  label: e,
  ariaLabel: t,
  value: n,
  onChange: r,
  type: i = `text`,
  step: a,
  min: o,
  max: s
}) {
  let {
    beginInteraction: c,
    endInteraction: l
  } = _f();
  const Component1897 = `span`;
  const Component1898 = `input`;
  const Component1899 = `label`;
  return <Component1899 className={`inspector-field`}>
      <Component1897 className={`inspector-field-label`}>{e}</Component1897>
      <Component1898 aria-label={t} className={`inspector-text-input`} max={s} min={o} step={a} type={i} value={n} onChange={e => {
      return r(e.currentTarget.value);
    }} onBlur={l} onFocus={c} />
    </Component1899>;
}