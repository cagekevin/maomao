// TODO(全局, 无需 import): model
import { e, _Component13, M } from './shared.js';
export default function _Component14({
  model: e
}) {
  if (e.power === null) {
    return null;
  } else {
    const Component227 = `span`;
    const Component228 = `span`;
    return <Component228 className={`inline-flex items-center gap-0.5 text-[12px] tabular-nums text-white/45`}>
        {e.currency === `proxy` ? <_Component13 className={`w-3.5 h-3.5 opacity-70`} /> : <M className={`w-3 h-3`} strokeWidth={2.5} />}
        <Component227>
          {e.power}
          {e.unit ? `/${e.unit}` : ``}
        </Component227>
      </Component228>;
  }
}