// TODO(全局, 无需 import): i, n, f, u, s, o, l, m, v, r, camera, object, g
import _cmp__Component97 from './_Component97.jsx';
import _cmp__Component98 from './_Component98.jsx';
import _cmp__m from './_m.jsx';
import _cmp__Component99 from './_Component99.jsx';
import { $, e, t, d, Mp, h, c, _, a } from './shared.js';
import * as Z from 'react';
export default function _Component107() {
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
  const Component2080 = `planeGeometry`;
  const Component2081 = `meshBasicMaterial`;
  const Component2082 = `mesh`;
  const Component2083 = `group`;
  return <Component2083 position={e.position} rotation={e.rotation} scale={[e.scale, e.scale, e.scale]}>
      {e.showGround ? <Component2082 position={[0, e.groundHeight, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <Component2080 args={[200, 200]} />
          <Component2081 color={`#303640`} opacity={Mp(e.groundOpacity, !!p)} polygonOffset={true} polygonOffsetFactor={1} polygonOffsetUnits={1} transparent={true} />
        </Component2082> : null}
      {n.filter(e => {
      return e.visible && e.kind !== `camera`;
    }).map(t => {
      return <_cmp__Component97 asset={t.assetRefId ? h.get(t.assetRefId) : undefined} item={t} selected={t.crowdId ? false : s.length > 1 ? s.includes(t.id) : t.id === o} showLabels={e.showLabels} transformMode={l} transformable={!t.locked && s.length <= 1} translationSnap={m} onSelect={v} key={t.id} />;
    })}
      {Array.from(new Set(n.map(e => {
      return e.crowdId;
    }).filter(e => {
      return typeof e == `string`;
    }))).map(e => {
      return <_cmp__Component98 crowdId={e} objects={n} selected={c === e} transformMode={l} transformable={!(_.get(e) ?? false)} translationSnap={m} key={e} />;
    })}
      <_cmp__m objects={n} selectedObjectIds={s} transformMode={l} translationSnap={m} />
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
      return <_cmp__Component99 camera={t} object={n} selected={n?.id === o} showLabel={e.showLabels} transformMode={l} transformable={!!n && !n.locked} translationSnap={m} key={t.id} />;
    }) : null}
    </Component2083>;
}