// TODO(全局, 无需 import): backgroundColor, panoramaAsset, panoramaRadius, panoramaYaw, scene, o, n, r, s, u, l, i
import { gl, fn, t, Om, jp, bn, e, a, c, Nt } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
export default function _Component104({
  backgroundColor: e,
  panoramaAsset: t,
  panoramaRadius: n,
  panoramaYaw: r
}) {
  let {
    gl: i,
    scene: a
  } = fn();
  let o = t?.projectionMode ?? `equirectangular`;
  let s = Om(t?.url ?? null, o);
  let c = Math.max(10, n);
  let l = jp(r);
  let u = Z.useMemo(() => {
    return new bn(e);
  }, [e]);
  Z.useEffect(() => {
    if (s.status === `ready` && o === `equirectangular`) {
      a.background = s.texture;
    } else {
      a.background = u;
    }
    a.backgroundBlurriness = 0;
    a.backgroundIntensity = 1;
    a.backgroundRotation.set(0, s.status === `ready` && o === `equirectangular` ? l : 0, 0);
    i.setClearColor(u, 1);
  }, [u, i, o, l, a, s]);
  const Component2093 = `sphereGeometry`;
  const Component2094 = `meshBasicMaterial`;
  const Component2095 = `mesh`;
  const Component2096 = `strong`;
  const Component2097 = `span`;
  const Component2098 = `div`;
  return <Q.Fragment>
      {s.status === `ready` && o === `backdrop` ? <Component2095 frustumCulled={false} name={`panorama-backdrop-dome`} renderOrder={-1000} rotation={[0, l, 0]}>
          <Component2093 args={[c, 96, 64]} />
          <Component2094 depthWrite={false} map={s.texture} side={1} toneMapped={false} />
        </Component2095> : null}
      {s.status === `error` ? <Nt center={true}>
          <Component2098 className={`viewport-error-card`} role={`status`}>
            <Component2096>{`全景图加载失败`}</Component2096>
            <Component2097>{`请重新导入 JPG / PNG / WEBP 图片`}</Component2097>
          </Component2098>
        </Nt> : null}
    </Q.Fragment>;
}