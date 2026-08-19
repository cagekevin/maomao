// TODO(全局, 无需 import): label, ariaLabel, value, onChange, type, step, min, max, beginInteraction, endInteraction, s, o, i, n, r, l
import { Rf, e, t, a, c } from './shared.js';
export default function Bf({
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
  } = Rf();
  const Component1919 = `span`;
  const Component1920 = `input`;
  const Component1921 = `label`;
  return <Component1921 className={`inspector-field`}>
      <Component1919 className={`inspector-field-label`}>{e}</Component1919>
      <Component1920 aria-label={t} className={`inspector-text-input`} max={s} min={o} step={a} type={i} value={n} onChange={e => {
      return r(e.currentTarget.value);
    }} onBlur={l} onFocus={c} />
    </Component1921>;
}