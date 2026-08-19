// TODO(全局, 无需 import): bodyType, color, onLabelAnchorYChange, rigState, r, i, n
import _cmp_Ip from './Ip.jsx';
import _cmp__Component71 from './_Component71.jsx';
import { e, t, Jp } from './shared.js';
export default function Yp({
  bodyType: e,
  color: t,
  onLabelAnchorYChange: n,
  rigState: r
}) {
  let i = <_cmp_Ip bodyType={e} color={t} rigState={r} />;
  if (r?.rigType === `ue4-mannequin`) {
    return <Jp fallback={i}>
        <_cmp__Component71 bodyType={e} color={t} onLabelAnchorYChange={n} rigState={r} />
      </Jp>;
  } else {
    return i;
  }
}