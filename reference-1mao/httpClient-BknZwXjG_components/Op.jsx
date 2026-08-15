// TODO(全局, 无需 import): bodyType, color, onLabelAnchorYChange, rigState, r, i, n
import _cmp__Component85 from './_Component85.jsx';
import _cmp_Ep from './Ep.jsx';
import { e, t, Dp } from './shared.js';
export default function Op({
  bodyType: e,
  color: t,
  onLabelAnchorYChange: n,
  rigState: r
}) {
  let i = <_cmp__Component85 bodyType={e} color={t} rigState={r} />;
  if (r?.rigType === `ue4-mannequin`) {
    return <Dp fallback={i}>
        <_cmp_Ep bodyType={e} color={t} onLabelAnchorYChange={n} rigState={r} />
      </Dp>;
  } else {
    return i;
  }
}