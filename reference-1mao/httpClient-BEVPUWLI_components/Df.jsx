// TODO(全局, 无需 import): icon, size, strokeWidth
import { e, t, _Component58, Cn, _Component26, _Component60 } from './shared.js';
export default function Df({
  icon: e
}) {
  let t = {
    'aria-hidden': true,
    size: 16,
    strokeWidth: 1.8
  };
  const Component1885 = `span`;
  return <Component1885 className={`object-row-kind-icon`} data-testid={`object-row-icon-${e}`}>
      {e === `camera` ? <_Component58 {...t} /> : null}
      {e === `crowd` ? <Cn {...t} /> : null}
      {e === `geometry` || e === `model` ? <_Component26 {...t} /> : null}
      {e === `character` ? <_Component60 {...t} /> : null}
    </Component1885>;
}