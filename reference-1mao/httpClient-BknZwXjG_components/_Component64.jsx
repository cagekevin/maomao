// TODO(全局, 无需 import): icon, size, strokeWidth
import { e, t, _Component60, Cn, _Component29, _Component62 } from './shared.js';
export default function _Component64({
  icon: e
}) {
  let t = {
    'aria-hidden': true,
    size: 16,
    strokeWidth: 1.8
  };
  const Component1863 = `span`;
  return <Component1863 className={`object-row-kind-icon`} data-testid={`object-row-icon-${e}`}>
      {e === `camera` ? <_Component60 {...t} /> : null}
      {e === `crowd` ? <Cn {...t} /> : null}
      {e === `geometry` || e === `model` ? <_Component29 {...t} /> : null}
      {e === `character` ? <_Component62 {...t} /> : null}
    </Component1863>;
}