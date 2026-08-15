// TODO(全局, 无需 import): children
import _cmp__Component74 from './_Component74.jsx';
import _cmp__Component75 from './_Component75.jsx';
import { $, e, t } from './shared.js';
export default function _Component109({
  children: e
}) {
  let t = $(e => {
    return e.viewportPanelsCollapsed;
  });
  const Component1987 = `section`;
  const Component1988 = `aside`;
  const Component1989 = `aside`;
  const Component1990 = `div`;
  return <Component1990 className={`director-shell director-shell-fullbleed${t ? ` is-sidebars-collapsed` : ``}`}>
      <Component1987 className={`viewport-column`} aria-label={`3D视口`}>
        {e}
      </Component1987>
      <Component1988 className={`left-sidebar director-sidebar`} aria-hidden={t ? `true` : undefined} aria-label={`场景`}>
        <_cmp__Component74 />
      </Component1988>
      <Component1989 className={`right-sidebar director-sidebar`} aria-hidden={t ? `true` : undefined} aria-label={`属性`}>
        <_cmp__Component75 />
      </Component1989>
    </Component1990>;
}