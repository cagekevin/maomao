// TODO(全局, 无需 import): i, n, f, u, s, o, l, m, v, r, camera, object, g
import _cmp_Im from './Im.jsx';
import _cmp_Lm from './Lm.jsx';
import _cmp_Rm from './Rm.jsx';
import _cmp_Bm from './Bm.jsx';
import { $, e, t, d, $p, h, c, _, a } from './shared.js';
import * as Z from 'react';
export default function Vm() {
  let e = $(e => {
    return e.project.scene;
  });
  let t = $(e => {
    return e.project.assets;
  });
  let n = $(e => {
    return e.project.objects;
  });
  let r = $(e => {
    return e.project.cameras;
  });
  let i = $(e => {
    return e.project.panoramaAssetId;
  });
  let a = $(e => {
    return e.viewMode;
  });
  let o = $(e => {
    return e.selectedObjectId;
  });
  let s = $(e => {
    return e.selectedObjectIds;
  });
  let c = $(e => {
    return e.selectedCrowdId;
  });
  let l = $(e => {
    return e.transformMode;
  });
  let u = $(e => {
    return e.selectObject;
  });
  let d = $(e => {
    return e.toggleObjectSelection;
  });
  let f = $(e => {
    return e.selectCrowd;
  });
  let p = t.find(e => {
    return e.id === i;
  });
  let m = e.snapToGrid ? 1 : null;
  let h = Z.useMemo(() => {
    return new Map(t.map(e => {
      return [e.id, e];
    }));
  }, [t]);
  let g = Z.useMemo(() => {
    return new Map(n.filter(e => {
      return e.kind === `camera` && e.linkedCameraId;
    }).map(e => {
      return [e.linkedCameraId, e];
    }));
  }, [n]);
  let _ = Z.useMemo(() => {
    let e = new Map();
    n.filter(e => {
      return e.kind === `character` && e.crowdId;
    }).forEach(t => {
      let n = t.crowdId;
      e.set(n, (e.get(n) ?? false) || t.locked);
    });
    return e;
  }, [n]);
  function v(e, t) {
    if (t?.shiftKey && (e.kind !== `character` || !e.crowdId)) {
      d(e.id);
      return;
    }
    if (e.kind === `character` && e.crowdId) {
      f(e.crowdId);
      return;
    }
    u(e.id);
  }
  const Component2102 = `planeGeometry`;
  const Component2103 = `meshBasicMaterial`;
  const Component2104 = `mesh`;
  const Component2105 = `group`;
  return <Component2105 position={e.position} rotation={e.rotation} scale={[e.scale, e.scale, e.scale]}>
      {e.showGround ? <Component2104 position={[0, e.groundHeight, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <Component2102 args={[200, 200]} />
          <Component2103 color={`#303640`} opacity={$p(e.groundOpacity, !!p)} polygonOffset={true} polygonOffsetFactor={1} polygonOffsetUnits={1} transparent={true} />
        </Component2104> : null}
      {n.filter(e => {
      return e.visible && e.kind !== `camera`;
    }).map(t => {
      return <_cmp_Im asset={t.assetRefId ? h.get(t.assetRefId) : undefined} item={t} selected={t.crowdId ? false : s.length > 1 ? s.includes(t.id) : t.id === o} showLabels={e.showLabels} transformMode={l} transformable={!t.locked && s.length <= 1} translationSnap={m} onSelect={v} key={t.id} />;
    })}
      {Array.from(new Set(n.map(e => {
      return e.crowdId;
    }).filter(e => {
      return typeof e == `string`;
    }))).map(e => {
      return <_cmp_Lm crowdId={e} objects={n} selected={c === e} transformMode={l} transformable={!(_.get(e) ?? false)} translationSnap={m} key={e} />;
    })}
      <_cmp_Rm objects={n} selectedObjectIds={s} transformMode={l} translationSnap={m} />
      {a === `director` ? r.map(e => {
      return {
        camera: e,
        object: g.get(e.id)
      };
    }).filter(({
      object: e
    }) => {
      return e?.visible ?? true;
    }).map(({
      camera: t,
      object: n
    }) => {
      return <_cmp_Bm camera={t} object={n} selected={n?.id === o} showLabel={e.showLabels} transformMode={l} transformable={!!n && !n.locked} translationSnap={m} key={t.id} />;
    }) : null}
    </Component2105>;
}