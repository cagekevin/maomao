// TODO(全局, 无需 import): r, i, n, v, x, left, right, bottom, s, m, f, l, p, position, fov, antialias, preserveDrawingBuffer, camera, g, o, u, b, k
import _cmp_Xm from './Xm.jsx';
import _cmp_Vm from './Vm.jsx';
import _cmp_Km from './Km.jsx';
import _cmp_Wg from './Wg.jsx';
import _cmp__Component83 from './_Component83.jsx';
import { $, e, t, ag, og, wg, h, a, fd, d, fg, pg, mg, c, Og, S, O, _, Sg, hg, A, T, y, C, E, w, D, _Component59, Rt, _Component57, Qe } from './shared.js';
import * as Z from 'react';
export default function Gg() {
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
  let c = Z.useRef(ag);
  let l = Z.useRef(false);
  let u = Z.useRef(0);
  let [d, f] = Z.useState(ag);
  let [p, m] = Z.useState(og);
  let h = !!i;
  let g = r.find(e => {
    return e.id === i;
  });
  let _ = wg(h, n.snapToGrid);
  let v = a ? fd(a) : undefined;
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
    left: fg,
    right: pg,
    top: 0,
    bottom: 0
  };
  let E = x ? mg : 320;
  Z.useLayoutEffect(() => {
    let e = s.current;
    if (!e) {
      return;
    }
    let t = () => {
      let t = Math.max(e.offsetHeight, og);
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
      if (Og(t, e)) {
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
  const Component2233 = `ambientLight`;
  const Component2234 = `directionalLight`;
  const Component2235 = `div`;
  const Component2236 = `div`;
  return <Component2236 className={`canvas-frame`}>
      <Component2235 className={`director-canvas`} data-testid={`director-canvas`}>
        <_Component59 camera={{
        position: ag.position,
        fov: ag.fov
      }} gl={{
        antialias: true,
        preserveDrawingBuffer: true
      }} onPointerMissed={t} onCreated={({
        camera: e
      }) => {
        let t = e;
        t.lookAt(...ag.target);
        c.current = {
          fov: t.fov,
          position: [t.position.x, t.position.y, t.position.z],
          target: ag.target
        };
        f(c.current);
      }}>
          <_cmp_Xm backgroundColor={n.backgroundColor} panoramaAsset={g} panoramaRadius={n.panoramaRadius} panoramaYaw={n.panoramaYaw} />
          <Component2233 intensity={1.15} />
          <Component2234 intensity={1.2} position={[8, 10, 6]} />
          {_ ? <Rt cellThickness={0} fadeDistance={80} infiniteGrid={true} position={[0, n.groundHeight + Sg, 0]} sectionColor={`#2A4065`} userData={{
          [hg]: true
        }} /> : null}
          {e === `director` ? <_Component57 ref={o} enableDamping={true} dampingFactor={0.15} enabled={true} makeDefault={true} target={ag.target} onChange={e => {
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
          <Hg controlsRef={o} snapshot={d} viewMode={e} isExternalUpdateRef={l} />
          {e === `camera` && v ? <Qe fov={v.fov} makeDefault={true} position={v.position} onUpdate={e => {
          return e.lookAt(...v.target);
        }} /> : null}
          <Vg activeCamera={a} bottomPadding={A} controlsRef={o} safeAreaInsets={T} viewportAspectRatio={y} viewMode={e} />
          <Z.Suspense fallback={null}>
            <_cmp_Vm />
          </Z.Suspense>
        </_Component59>
      </Component2235>
      <_cmp_Km bottomPadding={A} onToggleRuleOfThirds={C} ratio={y} safeAreaInsets={T} showRuleOfThirds={b} />
      <_cmp_Wg onSnapshotChange={k} rightOffset={E} snapshot={w} />
      <_cmp__Component83 getViewportCameraSnapshot={D} toolbarContainerRef={s} />
    </Component2236>;
}