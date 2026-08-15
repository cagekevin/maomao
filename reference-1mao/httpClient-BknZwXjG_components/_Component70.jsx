// TODO(全局, 无需 import): label, colorAriaLabel, hexAriaLabel, value, onColorChange, onHexChange, beginInteraction, endInteraction, r, i, s, o, n
import { _f, e, t, a } from './shared.js';
export default function _Component70({
  label: e,
  colorAriaLabel: t,
  hexAriaLabel: n,
  value: r,
  onColorChange: i,
  onHexChange: a
}) {
  let {
    beginInteraction: o,
    endInteraction: s
  } = _f();
  const Component1919 = `span`;
  const Component1920 = `input`;
  const Component1921 = `input`;
  const Component1922 = `div`;
  const Component1923 = `label`;
  return <Component1923 className={`inspector-field`}>
      <Component1919 className={`inspector-field-label`}>{e}</Component1919>
      <Component1922 className={`inspector-color-row`}>
        <Component1920 aria-label={t} className={`inspector-color-swatch`} type={`color`} value={r} onChange={e => {
        return i(e.currentTarget.value);
      }} onBlur={s} onFocus={o} />
        <Component1921 aria-label={n} className={`inspector-text-input inspector-color-hex`} value={r} onChange={e => {
        return a(e.currentTarget.value);
      }} onBlur={s} onFocus={o} />
      </Component1922>
    </Component1923>;
}