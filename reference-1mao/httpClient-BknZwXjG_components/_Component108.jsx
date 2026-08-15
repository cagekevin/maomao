// TODO(全局, 无需 import): r, i, n, v, x, left, right, bottom, s, m, f, l, p, position, fov, antialias, preserveDrawingBuffer, camera, g, o, u, b, k
import _cmp__Component104 from './_Component104.jsx';
import _cmp__Component107 from './_Component107.jsx';
import _cmp_Tm from './Tm.jsx';
import _cmp_Cg from './Cg.jsx';
import _cmp_Lh from './Lh.jsx';
import { $, e, t, Rh, zh, rg, h, a, Gu, d, Gh, Kh, qh, c, sg, S, O, _, tg, Jh, A, T, y, C, E, w, D, _Component61, Rt, _Component59, Qe } from './shared.js';
import * as Z from 'react';
export default function _Component108() {
  let e = $(e => {
    return e.viewMode;
  });
  let t = $(e => {
    return e.openSceneInspector;
  });
  let n = $(e => {
    return e.project.scene;
  });
  let r = $(e => {
    return e.project.assets;
  });
  let i = $(e => {
    return e.project.panoramaAssetId;
  });
  let a = $(e => {
    return e.project.cameras.find(t => {
      return t.id === e.project.activeCameraId;
    });
  });
  let o = Z.useRef(null);
  let s = Z.useRef(null);
  let c = Z.useRef(Rh);
  let l = Z.useRef(false);
  let u = Z.useRef(0);
  let [d, f] = Z.useState(Rh);
  let [p, m] = Z.useState(zh);
  let h = !!i;
  let g = r.find(e => {
    return e.id === i;
  });
  let _ = rg(h, n.snapToGrid);
  let v = a ? Gu(a) : undefined;
  let y = $(e => {
    return e.viewportAspectRatio;
  });
  let b = $(e => {
    return e.viewportRuleOfThirdsEnabled;
  });
  let x = $(e => {
    return e.viewportPanelsCollapsed;
  });
  let S = $(e => {
    return e.setViewMode;
  });
  let C = $(e => {
    return e.setViewportRuleOfThirdsEnabled;
  });
  let w = e === `camera` && v ? v : d;
  let T = x ? {
    left: 0,
    right: 0,
    top: 0,
    bottom: 0
  } : {
    left: Gh,
    right: Kh,
    top: 0,
    bottom: 0
  };
  let E = x ? qh : 320;
  Z.useLayoutEffect(() => {
    let e = s.current;
    if (!e) {
      return;
    }
    let t = () => {
      let t = Math.max(e.offsetHeight, zh);
      m(e => {
        if (e === t) {
          return e;
        } else {
          return t;
        }
      });
    };
    t();
    if (typeof ResizeObserver > `u`) {
      window.addEventListener(`resize`, t);
      return () => {
        window.removeEventListener(`resize`, t);
      };
    }
    let n = new ResizeObserver(t);
    n.observe(e);
    window.addEventListener(`resize`, t);
    return () => {
      n.disconnect();
      window.removeEventListener(`resize`, t);
    };
  }, []);
  function D() {
    return c.current;
  }
  function O(e) {
    c.current = e;
    f(t => {
      if (sg(t, e)) {
        return t;
      } else {
        return e;
      }
    });
  }
  function k(t) {
    if (e !== `director`) {
      S(`director`);
    }
    l.current = true;
    O(t);
  }
  let A = 80 + p;
  const Component2211 = `ambientLight`;
  const Component2212 = `directionalLight`;
  const Component2213 = `div`;
  const Component2214 = `div`;
  return <Component2214 className={`canvas-frame`}>
      <Component2213 className={`director-canvas`} data-testid={`director-canvas`}>
        <_Component61 camera={{
        position: Rh.position,
        fov: Rh.fov
      }} gl={{
        antialias: true,
        preserveDrawingBuffer: true
      }} onPointerMissed={t} onCreated={({
        camera: e
      }) => {
        let t = e;
        t.lookAt(...Rh.target);
        c.current = {
          fov: t.fov,
          position: [t.position.x, t.position.y, t.position.z],
          target: Rh.target
        };
        f(c.current);
      }}>
          <_cmp__Component104 backgroundColor={n.backgroundColor} panoramaAsset={g} panoramaRadius={n.panoramaRadius} panoramaYaw={n.panoramaYaw} />
          <Component2211 intensity={1.15} />
          <Component2212 intensity={1.2} position={[8, 10, 6]} />
          {_ ? <Rt cellThickness={0} fadeDistance={80} infiniteGrid={true} position={[0, n.groundHeight + tg, 0]} sectionColor={`#2A4065`} userData={{
          [Jh]: true
        }} /> : null}
          {e === `director` ? <_Component59 ref={o} enableDamping={true} dampingFactor={0.15} enabled={true} makeDefault={true} target={Rh.target} onChange={e => {
          let t = e?.target?.object;
          let n = e?.target?.target;
          if (!t || !n) {
            return;
          }
          let r = performance.now();
          if (!(r - u.current < 32)) {
            u.current = r;
            O({
              fov: t.fov,
              position: [t.position.x, t.position.y, t.position.z],
              target: [n.x, n.y, n.z]
            });
          }
        }} /> : null}
          <_Component105 controlsRef={o} snapshot={d} viewMode={e} isExternalUpdateRef={l} />
          {e === `camera` && v ? <Qe fov={v.fov} makeDefault={true} position={v.position} onUpdate={e => {
          return e.lookAt(...v.target);
        }} /> : null}
          <_Component106 activeCamera={a} bottomPadding={A} controlsRef={o} safeAreaInsets={T} viewportAspectRatio={y} viewMode={e} />
          <Z.Suspense fallback={null}>
            <_cmp__Component107 />
          </Z.Suspense>
        </_Component61>
      </Component2213>
      <_cmp_Tm bottomPadding={A} onToggleRuleOfThirds={C} ratio={y} safeAreaInsets={T} showRuleOfThirds={b} />
      <_cmp_Cg onSnapshotChange={k} rightOffset={E} snapshot={w} />
      <_cmp_Lh getViewportCameraSnapshot={D} toolbarContainerRef={s} />
    </Component2214>;
}