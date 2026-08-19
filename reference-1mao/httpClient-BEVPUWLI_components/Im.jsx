// TODO(全局, 无需 import): asset, item, selected, showLabels, transformMode, transformable, translationSnap, onSelect, u, g, n, key, l, p, f, position, rotation, scale, m, v, r, s, b, x, i, o
import _cmp_Fm from './Fm.jsx';
import _cmp__Component74 from './_Component74.jsx';
import _cmp_Yp from './Yp.jsx';
import _cmp__Component75 from './_Component75.jsx';
import _cmp_Pm from './Pm.jsx';
import _cmp_Mm from './Mm.jsx';
import _cmp__Component76 from './_Component76.jsx';
import { $, e, t, Ju, Ou, h, d, y, c, _, fm } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
export default function Im({
  asset: e,
  item: t,
  selected: n,
  showLabels: r,
  transformMode: i,
  transformable: a,
  translationSnap: o,
  onSelect: s
}) {
  let c = Z.useRef(null);
  let l = Z.useRef(false);
  let [u, d] = Z.useState(null);
  let f = $(e => {
    return e.updateObjectTransform;
  });
  let p = Z.useRef(null);
  let m = e?.sourceType === `model`;
  let h = `${t.id}:${t.bodyType ?? ``}:${t.characterRig?.rigType ?? ``}`;
  let g = t.kind === `character` ? t.characterRig?.rigType === `ue4-mannequin` ? Ju(t.bodyType) : Ou(t.bodyType) : 1.25;
  let _ = u?.key === h ? u.y : g;
  let v = Z.useCallback(e => {
    d(t => {
      let n = Number(e.toFixed(4));
      if (t?.key === h && Math.abs(t.y - n) < 0.0001) {
        return t;
      } else {
        return {
          key: h,
          y: n
        };
      }
    });
  }, [h]);
  Z.useEffect(() => {
    if (l.current) {
      return;
    }
    let e = c.current;
    if (e) {
      e.position.set(...t.transform.position);
      e.rotation.set(...t.transform.rotation);
      e.scale.set(...t.transform.scale);
    }
  }, [t.transform.position, t.transform.rotation, t.transform.scale]);
  function y() {
    let e = c.current;
    if (!!e && !!p.current) {
      f(t.id, {
        position: [e.position.x, e.position.y, e.position.z],
        rotation: [e.rotation.x, e.rotation.y, e.rotation.z],
        scale: [e.scale.x, e.scale.y, e.scale.z]
      });
    }
  }
  let b = m && e ? <_cmp_Fm>
        <Z.Suspense fallback={null}>
          <_cmp__Component74 fileName={e.fileName} url={e.url} />
        </Z.Suspense>
      </_cmp_Fm> : t.kind === `character` ? <Q.Fragment>
        <Z.Suspense fallback={null}>
          <_cmp_Yp bodyType={t.bodyType} color={t.color} onLabelAnchorYChange={v} rigState={t.characterRig} />
        </Z.Suspense>
        {r ? <_cmp__Component75 position={[0, _, 0]}>{t.name}</_cmp__Component75> : null}
      </Q.Fragment> : t.kind === `prop` && t.compositeShapes && t.compositeShapes.length > 0 ? <Q.Fragment>
        <_cmp_Pm shapes={t.compositeShapes} fallbackColor={t.color} />
        {r ? <_cmp__Component75 position={[0, 1.25, 0]}>{t.name}</_cmp__Component75> : null}
      </Q.Fragment> : t.kind === `prop` && t.geometryType ? <_cmp_Fm>
        <_cmp_Mm color={t.color} geometryType={t.geometryType} />
      </_cmp_Fm> : null;
  const Component2095 = `group`;
  let x = <Component2095 ref={c} position={t.transform.position} rotation={t.transform.rotation} scale={t.transform.scale} onClick={e => {
    e.stopPropagation();
    s?.(t, e);
  }}>
      {b}
    </Component2095>;
  if (!n || !a) {
    return x;
  } else {
    return <Q.Fragment>
        {x}
        <_cmp__Component76 mode={i} object={c} onObjectChange={y} onTransformEnd={() => {
        y();
        l.current = false;
        p.current = null;
      }} onTransformStart={() => {
        l.current = true;
        p.current = fm(t.transform);
      }} translationSnap={i === `translate` ? o : null} />
      </Q.Fragment>;
  }
}