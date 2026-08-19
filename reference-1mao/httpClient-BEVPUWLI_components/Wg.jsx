// TODO(全局, 无需 import): onSnapshotChange, rightOffset, snapshot, n, right, fov, position, alpha, antialias, r
import _cmp_Ug from './Ug.jsx';
import { mg, e, Tg, G, t, Cg, Eg, _Component59 } from './shared.js';
export default function Wg({
  onSnapshotChange: e,
  rightOffset: t = mg,
  snapshot: n
}) {
  function r(t) {
    e(Tg(n, new G(...t)));
  }
  const Component2230 = `button`;
  const Component2231 = `div`;
  const Component2232 = `div`;
  return <Component2232 className={`viewport-gizmo-overlay`} aria-label={`3D视口原生坐标控件`} style={{
    right: `${t}px`
  }}>
      <_Component59 className={`viewport-gizmo-canvas`} camera={{
      fov: n.fov,
      position: [0, 0, 1]
    }} gl={{
      alpha: true,
      antialias: true
    }}>
        <_cmp_Ug onSnapshotChange={e} snapshot={n} />
      </_Component59>
      <Component2231 className={`viewport-gizmo-hit-layer`} aria-label={`3D视口坐标切换按钮`}>
        {Cg.map(e => {
        return <Component2230 aria-label={e.label} className={`viewport-gizmo-hit-button ${e.className}`} style={Eg(n, e.direction)} type={`button`} onClick={() => {
          return r(e.direction);
        }} key={e.label} />;
      })}
      </Component2231>
    </Component2232>;
}