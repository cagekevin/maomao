// TODO(全局, 无需 import): title, ariaLabel, tabs, className, children, footer, r, n, i
import { t, e, a } from './shared.js';
export default function _Component63({
  title: e,
  ariaLabel: t,
  tabs: n,
  className: r,
  children: i,
  footer: a
}) {
  const Component1913 = `h2`;
  const Component1914 = `header`;
  const Component1915 = `button`;
  const Component1916 = `div`;
  const Component1917 = `div`;
  const Component1918 = `section`;
  return <Component1918 className={`panel-card right-inspector${r ? ` ${r}` : ``}`} aria-label={t}>
      <Component1914 className={`right-inspector-header`}>
        <Component1913 className={`right-inspector-title`}>{e}</Component1913>
      </Component1914>
      {n ? <Component1916 className={`tab-row right-inspector-tabs`} role={`tablist`} aria-label={`${e}面板标签`}>
          {n.map(e => {
        return <Component1915 className={`right-inspector-tab-button`} type={`button`} aria-pressed={e.active} onClick={e.onClick} key={e.label}>
                {e.label}
              </Component1915>;
      })}
        </Component1916> : null}
      <Component1917 className={`right-inspector-content ${n ? `` : `right-inspector-content-no-tabs`}`}>
        {i}
      </Component1917>
      {a}
    </Component1918>;
}