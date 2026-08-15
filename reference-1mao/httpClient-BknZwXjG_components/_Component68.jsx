// TODO(全局, 无需 import): label, axes
import _cmp_Sf from './Sf.jsx';
import { e, t } from './shared.js';
export default function _Component68({
  label: e,
  axes: t
}) {
  const Component1908 = `span`;
  const Component1909 = `div`;
  const Component1910 = `div`;
  return <Component1910 className={`inspector-field inspector-axis-group`} role={`group`} aria-label={e}>
      <Component1908 className={`inspector-field-label`}>{e}</Component1908>
      <Component1909 className={`inspector-axis-row`}>
        {t.map(e => {
        return <_cmp_Sf control={e} key={e.ariaLabel} />;
      })}
      </Component1909>
    </Component1910>;
}