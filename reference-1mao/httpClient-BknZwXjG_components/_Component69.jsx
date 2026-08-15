// TODO(全局, 无需 import): title, ariaLabel, tabs, className, children, footer, r, n, i
import { t, e, a } from './shared.js';
export default function _Component69({
  title: e,
  ariaLabel: t,
  tabs: n,
  className: r,
  children: i,
  footer: a
}) {
  const Component1891 = `h2`;
  const Component1892 = `header`;
  const Component1893 = `button`;
  const Component1894 = `div`;
  const Component1895 = `div`;
  const Component1896 = `section`;
  return <Component1896 className={`panel-card right-inspector${r ? ` ${r}` : ``}`} aria-label={t}>
      <Component1892 className={`right-inspector-header`}>
        <Component1891 className={`right-inspector-title`}>{e}</Component1891>
      </Component1892>
      {n ? <Component1894 className={`tab-row right-inspector-tabs`} role={`tablist`} aria-label={`${e}面板标签`}>
          {n.map(e => {
        return <Component1893 className={`right-inspector-tab-button`} type={`button`} aria-pressed={e.active} onClick={e.onClick} key={e.label}>
                {e.label}
              </Component1893>;
      })}
        </Component1894> : null}
      <Component1895 className={`right-inspector-content ${n ? `` : `right-inspector-content-no-tabs`}`}>
        {i}
      </Component1895>
      {a}
    </Component1896>;
}