// TODO(全局, 无需 import): label, axes
import _cmp_Uf from './Uf.jsx';
import { e, t } from './shared.js';
export default function Hf({
  label: e,
  axes: t
}) {
  const Component1930 = `span`;
  const Component1931 = `div`;
  const Component1932 = `div`;
  return <Component1932 className={`inspector-field inspector-axis-group`} role={`group`} aria-label={e}>
      <Component1930 className={`inspector-field-label`}>{e}</Component1930>
      <Component1931 className={`inspector-axis-row`}>
        {t.map(e => {
        return <_cmp_Uf control={e} key={e.ariaLabel} />;
      })}
      </Component1931>
    </Component1932>;
}