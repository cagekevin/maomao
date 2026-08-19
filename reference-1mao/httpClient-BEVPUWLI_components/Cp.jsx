// TODO(全局, 无需 import): children
import _cmp_Of from './Of.jsx';
import _cmp_Sp from './Sp.jsx';
import { $, e, t } from './shared.js';
export default function Cp({
  children: e
}) {
  let t = $(e => {
    return e.viewportPanelsCollapsed;
  });
  const Component2009 = `section`;
  const Component2010 = `aside`;
  const Component2011 = `aside`;
  const Component2012 = `div`;
  return <Component2012 className={`director-shell director-shell-fullbleed${t ? ` is-sidebars-collapsed` : ``}`}>
      <Component2009 className={`viewport-column`} aria-label={`3D视口`}>
        {e}
      </Component2009>
      <Component2010 className={`left-sidebar director-sidebar`} aria-hidden={t ? `true` : undefined} aria-label={`场景`}>
        <_cmp_Of />
      </Component2010>
      <Component2011 className={`right-sidebar director-sidebar`} aria-hidden={t ? `true` : undefined} aria-label={`属性`}>
        <_cmp_Sp />
      </Component2011>
    </Component2012>;
}