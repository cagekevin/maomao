// TODO(全局, 无需 import): url, panoType, fov, highQuality, orbitControlsRefLocal, scene, camera, o, capture, i, u, s, f, minFilter, magFilter, format, samples, p, n, m, l, Uint8Array, r
import { Re, ie, e, gl, fn, C, d, a, xt, U, c, be, h, gn, Qe, _Component57 } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
var _u = Z.forwardRef(({
  url: e,
  panoType: t,
  fov: n,
  highQuality: r,
  orbitControlsRefLocal: i
}, o) => {
  let s = Re(ie, e);
  let {
    gl: c,
    scene: l,
    camera: u
  } = fn();
  let f = Z.useRef(null);
  Z.useImperativeHandle(o, () => {
    return {
      capture: async (e, t) => {
        let r = [];
        let [i, o] = t.split(`/`).map(Number);
        let s = i && o ? i / o : 16 / 9;
        let u = 2560;
        let f = Math.round(u / s);
        let p = new C(u, f, {
          minFilter: d,
          magFilter: d,
          format: a,
          samples: 4
        });
        p.texture.colorSpace = xt;
        let m = new U(n, u / f, 0.1, 2000);
        m.position.set(0, 0, 0);
        m.up.set(0, 1, 0);
        m.updateProjectionMatrix();
        let h = c.getRenderTarget();
        for (let t of e) {
          let e = be.degToRad(t);
          m.lookAt(Math.sin(e), 0, -Math.cos(e));
          m.updateMatrixWorld(true);
          c.setRenderTarget(p);
          c.clear(true, true, true);
          c.render(l, m);
          let n = new Uint8Array(u * f * 4);
          c.readRenderTargetPixels(p, 0, 0, u, f, n);
          let i = document.createElement(`canvas`);
          i.width = u;
          i.height = f;
          let a = i.getContext(`2d`);
          if (a) {
            let e = a.createImageData(u, f);
            for (let t = 0; t < f; t++) {
              for (let r = 0; r < u; r++) {
                let i = (t * u + r) * 4;
                let a = ((f - 1 - t) * u + r) * 4;
                e.data[a] = n[i];
                e.data[a + 1] = n[i + 1];
                e.data[a + 2] = n[i + 2];
                e.data[a + 3] = 255;
              }
            }
            a.putImageData(e, 0, 0);
            r.push(i.toDataURL(`image/jpeg`, 0.95));
          }
        }
        c.setRenderTarget(h);
        p.dispose();
        return r;
      }
    };
  });
  Z.useEffect(() => {
    if (s) {
      if (t === `cylinder`) {
        s.mapping = 300;
      } else {
        s.mapping = 303;
      }
      s.colorSpace = xt;
      s.generateMipmaps = true;
      s.minFilter = gn;
      s.magFilter = d;
      if (r) {
        s.anisotropy = c.capabilities.getMaxAnisotropy();
      } else {
        s.anisotropy = Math.min(4, c.capabilities.getMaxAnisotropy());
      }
      s.needsUpdate = true;
    }
  }, [s, c, r]);
  Z.useEffect(() => {
    if (u instanceof U) {
      u.fov = n;
      u.updateProjectionMatrix();
    }
  }, [n, u]);
  const Component1784 = `cylinderGeometry`;
  const Component1785 = `meshBasicMaterial`;
  const Component1786 = `mesh`;
  const Component1787 = `sphereGeometry`;
  const Component1788 = `meshBasicMaterial`;
  const Component1789 = `mesh`;
  return <Q.Fragment>
        <Qe makeDefault={true} position={[0, 0, 0.1]} fov={n} />
        <_Component57 ref={e => {
      if (f && typeof f != `function`) {
        f.current = e;
      }
      i.current = e;
    }} enableZoom={false} enablePan={false} enableDamping={true} dampingFactor={0.1} rotateSpeed={-0.5} />
        {t === `cylinder` ? <Component1786 scale={[-1, 1, 1]} renderOrder={-100}>
            <Component1784 args={[500, 500, 1000, 128, 1, true]} />
            <Component1785 map={s} side={1} depthTest={false} depthWrite={false} />
          </Component1786> : <Component1789 scale={[-1, 1, 1]} renderOrder={-100}>
            <Component1787 args={[500, 128, 128]} />
            <Component1788 map={s} side={1} depthTest={false} depthWrite={false} />
          </Component1789>}
      </Q.Fragment>;
});
export default _u;