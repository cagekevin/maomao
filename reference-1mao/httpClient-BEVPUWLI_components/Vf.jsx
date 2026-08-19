// TODO(全局, 无需 import): label, ariaLabel, value, onChange, children, options, i, l, n, s, o, r, f, u
import { a, Lf, e, c, t, d, _Component33 } from './shared.js';
import * as Z from 'react';
export default function Vf({
  label: e,
  ariaLabel: t,
  value: n,
  onChange: r,
  children: i,
  options: a
}) {
  let [o, s] = Z.useState(false);
  let c = Z.useRef(null);
  let l = a ?? Lf(i);
  let u = l.find(e => {
    return e.value === n;
  }) ?? l[0];
  Z.useEffect(() => {
    if (!o) {
      return;
    }
    let e = e => {
      let t = e.target;
      if (!c.current?.contains(t)) {
        s(false);
      }
    };
    let t = e => {
      if (e.key === `Escape`) {
        s(false);
      }
    };
    document.addEventListener(`mousedown`, e);
    document.addEventListener(`keydown`, t);
    return () => {
      document.removeEventListener(`mousedown`, e);
      document.removeEventListener(`keydown`, t);
    };
  }, [o]);
  function d(e) {
    if (!e.disabled) {
      r(e.value);
      s(false);
    }
  }
  function f(e) {
    if (e.key === `ArrowDown` || e.key === `Enter` || e.key === ` `) {
      e.preventDefault();
      s(true);
    }
  }
  const Component1922 = `span`;
  const Component1923 = `span`;
  const Component1924 = `button`;
  const Component1927 = `div`;
  const Component1928 = `div`;
  const Component1929 = `div`;
  return <Component1929 className={`inspector-field inspector-select-field`}>
      <Component1922 className={`inspector-field-label`}>{e}</Component1922>
      <Component1928 className={`inspector-dropdown`} ref={c}>
        <Component1924 aria-expanded={o} aria-haspopup={`listbox`} aria-label={t} className={`inspector-dropdown-trigger`} type={`button`} onClick={() => {
        return s(e => {
          return !e;
        });
      }} onKeyDown={f}>
          <Component1923 className={`inspector-dropdown-value`}>
            {u?.label ?? `请选择`}
          </Component1923>
          <_Component33 aria-hidden={`true`} className={`inspector-dropdown-chevron`} strokeWidth={1.8} />
        </Component1924>
        {o ? <Component1927 aria-label={t} className={`inspector-dropdown-menu`} role={`listbox`}>
            {l.map(e => {
          let t = e.value === n;
          const Component1925 = `span`;
          const Component1926 = `button`;
          return <Component1926 aria-selected={t} className={`inspector-dropdown-option${t ? ` is-selected` : ``}`} disabled={e.disabled} role={`option`} type={`button`} onClick={() => {
            return d(e);
          }} key={e.value}>
                  <Component1925>{e.label}</Component1925>
                </Component1926>;
        })}
          </Component1927> : null}
      </Component1928>
    </Component1929>;
}