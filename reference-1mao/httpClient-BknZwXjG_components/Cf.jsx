// TODO(全局, 无需 import): label, rangeAriaLabel, numberAriaLabel, value, onValueChange, onRangeChange, onNumberChange, onNumberBlur, min, max, step, beginInteraction, endInteraction, m, p, f, l, u, r, i, n, s, o
import { _f, d, e, t, c, a, h } from './shared.js';
import * as Z from 'react';
export default function Cf({
  label: e,
  rangeAriaLabel: t,
  numberAriaLabel: n,
  value: r,
  onValueChange: i,
  onRangeChange: a,
  onNumberChange: o,
  onNumberBlur: s,
  min: c,
  max: l,
  step: u
}) {
  let d = Z.useRef(null);
  let {
    beginInteraction: f,
    endInteraction: p
  } = _f();
  Z.useEffect(() => {
    return () => {
      return d.current?.();
    };
  }, []);
  function m() {
    window.removeEventListener(`pointerup`, m);
    window.removeEventListener(`pointercancel`, m);
    d.current = null;
    p();
  }
  function h() {
    d.current?.();
    f();
    window.addEventListener(`pointerup`, m);
    window.addEventListener(`pointercancel`, m);
    d.current = m;
  }
  const Component1914 = `span`;
  const Component1915 = `input`;
  const Component1916 = `input`;
  const Component1917 = `div`;
  const Component1918 = `div`;
  return <Component1918 className={`inspector-field inspector-range-field`}>
      <Component1914 className={`inspector-field-label`}>{e}</Component1914>
      <Component1917 className={`inspector-range-row`}>
        <Component1915 aria-label={t} className={`inspector-range`} max={l} min={c} step={u} type={`range`} value={r} onChange={e => {
        return (a ?? i)(e.currentTarget.value);
      }} onPointerCancel={m} onPointerDown={h} onPointerUp={m} />
        <Component1916 aria-label={n} className={`inspector-text-input inspector-range-value`} max={l} min={c} step={u} type={`number`} value={r} onBlur={e => {
        s?.(e.currentTarget.value);
        p();
      }} onChange={e => {
        return (o ?? i)(e.currentTarget.value);
      }} onFocus={f} />
      </Component1917>
    </Component1918>;
}