// TODO(全局, 无需 import): bodyType, color, onLabelAnchorYChange, rigState, i, controls, r, restPose, o, n, s
import { Re, It, Fu, Yt, zp, a, qu, e, Wp, t, Bp, Kp, Gp, wp } from './shared.js';
import * as Z from 'react';
export default function _Component71({
  bodyType: e = `mannequin`,
  color: t = `#F3F5F7`,
  onLabelAnchorYChange: n,
  rigState: r
}) {
  let i = Re(It, Fu);
  let a = Z.useMemo(() => {
    return Yt(i.scene);
  }, [i.scene]);
  let o = Z.useMemo(() => {
    return zp(a);
  }, [a]);
  let s = qu(e);
  Z.useLayoutEffect(() => {
    Wp(a, t);
    Bp(a, {
      bodyType: e,
      controls: r?.controls ?? {},
      restPose: o
    });
    Kp(a);
    let i = Gp(a.parent ?? a).max.y + wp;
    if (Number.isFinite(i)) {
      n?.(Number(i.toFixed(4)));
    }
  }, [e, t, n, o, r?.controls, a]);
  const Component2066 = `primitive`;
  const Component2067 = `group`;
  return <Component2067 name={`ue-retopology-mannequin-${e}`} scale={s}>
      <Component2066 object={a} />
    </Component2067>;
}