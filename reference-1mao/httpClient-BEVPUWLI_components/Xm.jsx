// TODO(全局, 无需 import): backgroundColor, panoramaAsset, panoramaRadius, panoramaYaw, scene, o, n, r, s, u, l, i
import { gl, fn, t, Ym, Qp, bn, e, a, c, Nt } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
export default function Xm({
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
  let s = Ym(t?.url ?? null, o);
  let c = Math.max(10, n);
  let l = Qp(r);
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
  const Component2115 = `sphereGeometry`;
  const Component2116 = `meshBasicMaterial`;
  const Component2117 = `mesh`;
  const Component2118 = `strong`;
  const Component2119 = `span`;
  const Component2120 = `div`;
  return <Q.Fragment>
      {s.status === `ready` && o === `backdrop` ? <Component2117 frustumCulled={false} name={`panorama-backdrop-dome`} renderOrder={-1000} rotation={[0, l, 0]}>
          <Component2115 args={[c, 96, 64]} />
          <Component2116 depthWrite={false} map={s.texture} side={1} toneMapped={false} />
        </Component2117> : null}
      {s.status === `error` ? <Nt center={true}>
          <Component2120 className={`viewport-error-card`} role={`status`}>
            <Component2118>{`全景图加载失败`}</Component2118>
            <Component2119>{`请重新导入 JPG / PNG / WEBP 图片`}</Component2119>
          </Component2120>
        </Nt> : null}
    </Q.Fragment>;
}