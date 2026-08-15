// TODO(全局, 无需 import): control, beginInteraction, endInteraction, r, n, i, o, s, l, u, f
import { _f, df, e, uf, ff, pf, t, mf, a, lf, c, d } from './shared.js';
import * as Z from 'react';
export default function Sf({
  control: e
}) {
  let [t, n] = Z.useState(false);
  let r = Z.useRef(null);
  let {
    beginInteraction: i,
    endInteraction: a
  } = _f();
  Z.useEffect(() => {
    return () => {
      return r.current?.();
    };
  }, []);
  function o(t, n) {
    let r = df(e.step);
    let i = uf(n) ?? 0;
    let a = Math.max(ff(e.step), ff(n));
    let o = pf(i + t * r, e.min, e.max);
    e.onChange(mf(o, a));
  }
  function s(t) {
    if (t.button !== 0) {
      return;
    }
    t.currentTarget.focus();
    t.preventDefault();
    t.stopPropagation();
    r.current?.();
    i();
    n(true);
    let o = t.clientX;
    let s = uf(e.value) ?? 0;
    let c = df(e.step);
    let l = Math.max(ff(e.step), ff(e.value));
    let u = mf(s, l);
    let d = t => {
      t.preventDefault();
      let n = mf(pf(s + Math.round((t.clientX - o) / lf) * c, e.min, e.max), l);
      if (n !== u) {
        u = n;
        e.onChange(n);
      }
    };
    let f = () => {
      window.removeEventListener(`mousemove`, d);
      window.removeEventListener(`mouseup`, f);
      r.current = null;
      n(false);
      a();
    };
    window.addEventListener(`mousemove`, d);
    window.addEventListener(`mouseup`, f);
    r.current = f;
  }
  function c(t) {
    if (t.key === `ArrowUp`) {
      t.preventDefault();
      o(1, e.value);
    }
    if (t.key === `ArrowDown`) {
      t.preventDefault();
      o(-1, e.value);
    }
  }
  const Component1911 = `button`;
  const Component1912 = `input`;
  const Component1913 = `div`;
  return <Component1913 className={`inspector-axis-input${t ? ` is-dragging` : ``}`}>
      <Component1911 aria-label={`${e.ariaLabel} 拖动调整`} className={`inspector-axis-prefix`} type={`button`} onKeyDown={c} onMouseDown={s}>
        {e.axis}
      </Component1911>
      <Component1912 aria-label={e.ariaLabel} className={`inspector-axis-value`} max={e.max} min={e.min} step={e.step} type={`number`} value={e.value} onChange={t => {
      return e.onChange(t.currentTarget.value);
    }} onBlur={a} onFocus={i} />
    </Component1913>;
}