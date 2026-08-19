// TODO(全局, 无需 import): label, colorAriaLabel, hexAriaLabel, value, onColorChange, onHexChange, beginInteraction, endInteraction, r, i, s, o, n
import { Rf, e, t, a } from './shared.js';
export default function Gf({
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
  } = Rf();
  const Component1941 = `span`;
  const Component1942 = `input`;
  const Component1943 = `input`;
  const Component1944 = `div`;
  const Component1945 = `label`;
  return <Component1945 className={`inspector-field`}>
      <Component1941 className={`inspector-field-label`}>{e}</Component1941>
      <Component1944 className={`inspector-color-row`}>
        <Component1942 aria-label={t} className={`inspector-color-swatch`} type={`color`} value={r} onChange={e => {
        return i(e.currentTarget.value);
      }} onBlur={s} onFocus={o} />
        <Component1943 aria-label={n} className={`inspector-text-input inspector-color-hex`} value={r} onChange={e => {
        return a(e.currentTarget.value);
      }} onBlur={s} onFocus={o} />
      </Component1944>
    </Component1945>;
}