// TODO(全局, 无需 import): label, ariaLabel, value, onChange, children, options, i, l, n, s, o, r, f, u
import { a, gf, e, c, t, d, _Component36 } from './shared.js';
import * as Z from 'react';
export default function _Component67({
  label: e,
  ariaLabel: t,
  value: n,
  onChange: r,
  children: i,
  options: a
}) {
  let [o, s] = Z.useState(false);
  let c = Z.useRef(null);
  let l = a ?? gf(i);
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
  const Component1900 = `span`;
  const Component1901 = `span`;
  const Component1902 = `button`;
  const Component1905 = `div`;
  const Component1906 = `div`;
  const Component1907 = `div`;
  return <Component1907 className={`inspector-field inspector-select-field`}>
      <Component1900 className={`inspector-field-label`}>{e}</Component1900>
      <Component1906 className={`inspector-dropdown`} ref={c}>
        <Component1902 aria-expanded={o} aria-haspopup={`listbox`} aria-label={t} className={`inspector-dropdown-trigger`} type={`button`} onClick={() => {
        return s(e => {
          return !e;
        });
      }} onKeyDown={f}>
          <Component1901 className={`inspector-dropdown-value`}>
            {u?.label ?? `请选择`}
          </Component1901>
          <_Component36 aria-hidden={`true`} className={`inspector-dropdown-chevron`} strokeWidth={1.8} />
        </Component1902>
        {o ? <Component1905 aria-label={t} className={`inspector-dropdown-menu`} role={`listbox`}>
            {l.map(e => {
          let t = e.value === n;
          const Component1903 = `span`;
          const Component1904 = `button`;
          return <Component1904 aria-selected={t} className={`inspector-dropdown-option${t ? ` is-selected` : ``}`} disabled={e.disabled} role={`option`} type={`button`} onClick={() => {
            return d(e);
          }} key={e.value}>
                  <Component1903>{e.label}</Component1903>
                </Component1904>;
        })}
          </Component1905> : null}
      </Component1906>
    </Component1907>;
}