// TODO(全局, 无需 import): bodyType, color, onLabelAnchorYChange, rigState, i, controls, r, restPose, o, n, s
import { ze, It, mu, Yt, vp, a, Eu, e, Cp, t, yp, Tp, wp, rp } from './shared.js';
import * as Z from 'react';
export default function Ep({
  bodyType: e = `mannequin`,
  color: t = `#F3F5F7`,
  onLabelAnchorYChange: n,
  rigState: r
}) {
  let i = ze(It, mu);
  let a = Z.useMemo(() => {
    return Yt(i.scene);
  }, [i.scene]);
  let o = Z.useMemo(() => {
    return vp(a);
  }, [a]);
  let s = Eu(e);
  Z.useLayoutEffect(() => {
    Cp(a, t);
    yp(a, {
      bodyType: e,
      controls: r?.controls ?? {},
      restPose: o
    });
    Tp(a);
    let i = wp(a.parent ?? a).max.y + rp;
    if (Number.isFinite(i)) {
      n?.(Number(i.toFixed(4)));
    }
  }, [e, t, n, o, r?.controls, a]);
  const Component2044 = `primitive`;
  const Component2045 = `group`;
  return <Component2045 name={`ue-retopology-mannequin-${e}`} scale={s}>
      <Component2044 object={a} />
    </Component2045>;
}