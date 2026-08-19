// TODO(全局, 无需 import): model
import { e, _Component13, _Component14 } from './shared.js';
export default function _Component15({
  model: e
}) {
  if (e.power === null) {
    return null;
  } else {
    const Component229 = `span`;
    const Component230 = `span`;
    return <Component230 className={`inline-flex items-center gap-0.5 text-[12px] tabular-nums text-white/45`}>
        {e.currency === `proxy` ? <_Component13 className={`w-3.5 h-3.5 opacity-70`} /> : <_Component14 className={`w-3 h-3`} strokeWidth={2.5} />}
        <Component229>
          {e.power}
          {e.unit ? `/${e.unit}` : ``}
        </Component229>
      </Component230>;
  }
}