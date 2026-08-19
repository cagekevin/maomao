// TODO(全局, 无需 import): control, beginInteraction, endInteraction, r, n, i, o, s, l, u, f
import { Rf, Mf, e, jf, Nf, Pf, t, Ff, a, Af, c, d } from './shared.js';
import * as Z from 'react';
export default function Uf({
  control: e
}) {
  let [t, n] = Z.useState(false);
  let r = Z.useRef(null);
  let {
    beginInteraction: i,
    endInteraction: a
  } = Rf();
  Z.useEffect(() => {
    return () => {
      return r.current?.();
    };
  }, []);
  function o(t, n) {
    let r = Mf(e.step);
    let i = jf(n) ?? 0;
    let a = Math.max(Nf(e.step), Nf(n));
    let o = Pf(i + t * r, e.min, e.max);
    e.onChange(Ff(o, a));
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
    let s = jf(e.value) ?? 0;
    let c = Mf(e.step);
    let l = Math.max(Nf(e.step), Nf(e.value));
    let u = Ff(s, l);
    let d = t => {
      t.preventDefault();
      let n = Ff(Pf(s + Math.round((t.clientX - o) / Af) * c, e.min, e.max), l);
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
  const Component1933 = `button`;
  const Component1934 = `input`;
  const Component1935 = `div`;
  return <Component1935 className={`inspector-axis-input${t ? ` is-dragging` : ``}`}>
      <Component1933 aria-label={`${e.ariaLabel} 拖动调整`} className={`inspector-axis-prefix`} type={`button`} onKeyDown={c} onMouseDown={s}>
        {e.axis}
      </Component1933>
      <Component1934 aria-label={e.ariaLabel} className={`inspector-axis-value`} max={e.max} min={e.min} step={e.step} type={`number`} value={e.value} onChange={t => {
      return e.onChange(t.currentTarget.value);
    }} onBlur={a} onFocus={i} />
    </Component1935>;
}