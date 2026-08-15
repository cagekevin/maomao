// TODO(全局, 无需 import): x, g, camera, captures, l, p, m, s, o, f, dataUrl, fileName, r, preset, source, cameraId, b, n, lastCaptureUrl, k, startX, startY, originX, u, originY, targetMode, targetObjectId, i, transform, ee, ie, label, active, onClick, name, v, axis, ariaLabel, value, onChange, position, z, fov
import _cmp__Component69 from './_Component69.jsx';
import _cmp__Component66 from './_Component66.jsx';
import _cmp__Component67 from './_Component67.jsx';
import _cmp__Component68 from './_Component68.jsx';
import _cmp_Cf from './Cf.jsx';
import _cmp_Tf from './Tf.jsx';
import _cmp_jf from './jf.jsx';
import { y, $, e, t, h, S, w, _, Fu, d, c, If, Ff, O, Pf, kf, a, Lf, E, Lu, Rf, P, A, C, ne, T, re, F, j, R, I, L, D, te, N, B, V, ae, Ot, Te, _Component32, M, _Component1, _Component65, _Component6, Gt, _Component60 } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
export default function _Component72() {
  let [e, t] = Z.useState(`properties`);
  let [n, r] = Z.useState(null);
  let [i, a] = Z.useState(null);
  let [o, s] = Z.useState(null);
  let [c, l] = Z.useState(1);
  let [u, d] = Z.useState({
    x: 0,
    y: 0
  });
  let [f, p] = Z.useState(false);
  let m = Z.useRef(null);
  let h = $(e => {
    return e.project.cameras.find(t => {
      return t.id === e.project.activeCameraId;
    });
  });
  let g = $(e => {
    return e.project.cameras;
  });
  let _ = $(e => {
    return e.project.objects;
  });
  let v = $(e => {
    return e.setActiveCamera;
  });
  let y = $(e => {
    return e.addCameraCaptures;
  });
  let b = $(e => {
    return e.updateCamera;
  });
  if (!h) {
    return null;
  }
  let S = h;
  let C = Z.useMemo(() => {
    return S.captures ?? [];
  }, [S.captures]);
  let w = Z.useMemo(() => {
    return g.map(e => {
      return {
        camera: e,
        captures: e.captures ?? []
      };
    });
  }, [g]);
  let T = w.some(e => {
    return e.captures.length > 0;
  });
  let E = Z.useMemo(() => {
    return _.filter(Fu);
  }, [_]);
  let D = S.targetMode === `object` && S.targetObjectId ? `object:${S.targetObjectId}` : `manual`;
  Z.useEffect(() => {
    if (!o) {
      l(1);
      d({
        x: 0,
        y: 0
      });
      p(false);
      m.current = null;
      return;
    }
    function e(e) {
      if (e.key === `Escape`) {
        s(null);
      }
    }
    window.addEventListener(`keydown`, e);
    return () => {
      return window.removeEventListener(`keydown`, e);
    };
  }, [o]);
  Z.useEffect(() => {
    if (c <= 1) {
      d({
        x: 0,
        y: 0
      });
      p(false);
      m.current = null;
    }
  }, [c]);
  Z.useEffect(() => {
    if (!f) {
      return;
    }
    function e(e) {
      let t = m.current;
      if (t) {
        d({
          x: t.originX + e.clientX - t.startX,
          y: t.originY + e.clientY - t.startY
        });
      }
    }
    function t() {
      p(false);
      m.current = null;
    }
    window.addEventListener(`mousemove`, e);
    window.addEventListener(`mouseup`, t);
    return () => {
      window.removeEventListener(`mousemove`, e);
      window.removeEventListener(`mouseup`, t);
    };
  }, [f]);
  let O = Z.useCallback(e => {
    return Math.min(If, Math.max(Ff, e));
  }, []);
  let k = Z.useCallback(e => {
    l(t => {
      return O(Number(e(t).toFixed(2)));
    });
  }, [O]);
  let A = Z.useCallback(e => {
    Pf([{
      dataUrl: e.dataUrl,
      fileName: `${e.name}.png`
    }]);
  }, []);
  let j = Z.useCallback(() => {
    Pf(w.flatMap(e => {
      return e.captures.map(e => {
        return {
          dataUrl: e.dataUrl,
          fileName: `${e.name}.png`
        };
      });
    }));
  }, [w]);
  async function N() {
    try {
      r(null);
      let e = (await kf({
        preset: `current`,
        source: `camera-panel`,
        cameraId: S.id
      }))[0];
      if (e) {
        y(S.id, [e.dataUrl]);
      }
    } catch (e) {
      r(e instanceof Error ? e.message : `机位截图失败`);
    }
  }
  function P(e) {
    let t = g.find(t => {
      return (t.captures ?? []).some(t => {
        return t.id === e;
      });
    });
    if (!t) {
      return;
    }
    let n = (t.captures ?? []).filter(t => {
      return t.id !== e;
    });
    b(t.id, {
      captures: n,
      lastCaptureUrl: n[n.length - 1]?.dataUrl ?? null
    });
    a(t => {
      if (t === e) {
        return null;
      } else {
        return t;
      }
    });
    s(t => {
      if (t?.id === e) {
        return null;
      } else {
        return t;
      }
    });
  }
  function F() {
    g.forEach(e => {
      if ((e.captures ?? []).length !== 0 || !!e.lastCaptureUrl) {
        b(e.id, {
          captures: [],
          lastCaptureUrl: null
        });
      }
    });
    a(null);
    s(null);
  }
  function I(e) {
    k(t => {
      return t + (e === `in` ? Lf : -0.25);
    });
  }
  function ee(e) {
    e.preventDefault();
    e.stopPropagation();
    k(t => {
      return t + (e.deltaY < 0 ? Lf : -0.25);
    });
  }
  function L(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!(c <= 1)) {
      m.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: u.x,
        originY: u.y
      };
      p(true);
    }
  }
  function R() {
    s(null);
  }
  function te(e) {
    if (e === `manual`) {
      b(S.id, {
        targetMode: `manual`,
        targetObjectId: null
      });
      return;
    }
    let t = e.replace(/^object:/, ``);
    let n = E.find(e => {
      return e.id === t;
    });
    if (!n) {
      b(S.id, {
        targetMode: `manual`,
        targetObjectId: null
      });
      return;
    }
    b(S.id, {
      targetMode: `object`,
      targetObjectId: n.id,
      target: Lu(n)
    });
  }
  function z(e, t) {
    b(S.id, {
      targetMode: `manual`,
      targetObjectId: null,
      target: Rf(S.target, e, Number(t))
    });
  }
  function ne(e) {
    const Component1934 = `div`;
    return <Component1934 className={`camera-capture-grid`} aria-label={`相机截图列表`}>
        {e.map(e => {
        let t = i === e.id;
        const Component1926 = `img`;
        const Component1927 = `button`;
        const Component1928 = `button`;
        const Component1929 = `button`;
        const Component1930 = `div`;
        const Component1931 = `div`;
        const Component1932 = `span`;
        const Component1933 = `div`;
        return <Component1933 className={`camera-capture-card`} key={e.id}>
              <Component1931 className={`camera-capture-thumb-wrap`} onClick={() => {
            return s(e);
          }} onMouseEnter={() => {
            return a(e.id);
          }} onMouseLeave={() => {
            return a(t => {
              if (t === e.id) {
                return null;
              } else {
                return t;
              }
            });
          }}>
                <Component1926 className={`camera-capture-thumb`} alt={`${e.name} 缩略图`} src={e.dataUrl} />
                <Component1930 aria-label={`${e.name} 缩略图操作`} className={`camera-capture-actions${t ? ` is-visible` : ``}`} role={`group`}>
                  <Component1927 aria-label={`删除截图 ${e.name}`} className={`camera-capture-action`} type={`button`} onClick={t => {
                t.stopPropagation();
                P(e.id);
              }}>
                    <Ot aria-hidden={`true`} size={14} strokeWidth={1.9} />
                  </Component1927>
                  <Component1928 aria-label={`发送到画布 ${e.name}`} className={`camera-capture-action`} type={`button`} onClick={t => {
                t.stopPropagation();
                A(e);
              }}>
                    <Te aria-hidden={`true`} size={14} strokeWidth={1.9} />
                  </Component1928>
                  <Component1929 aria-label={`查看截图 ${e.name}`} className={`camera-capture-action`} type={`button`} onClick={t => {
                t.stopPropagation();
                s(e);
              }}>
                    <_Component32 aria-hidden={`true`} size={14} strokeWidth={1.9} />
                  </Component1929>
                </Component1930>
              </Component1931>
              <Component1932 className={`camera-capture-name`}>{e.name}</Component1932>
            </Component1933>;
      })}
      </Component1934>;
  }
  function B() {
    if (C.length === 0) {
      const Component1935 = `div`;
      return <Component1935 className={`capture-list-placeholder`}>{`当前还没有机位截图，可先从当前机位生成一张预览。`}</Component1935>;
    } else {
      return ne(C);
    }
  }
  function re() {
    const Component1936 = `span`;
    const Component1937 = `span`;
    const Component1938 = `div`;
    return <Component1938 className={`camera-capture-empty object-search-empty-state`} role={`status`} aria-label={`暂无摄像机截图`}>
        <Component1936 className={`object-search-empty-icon`} data-testid={`camera-capture-empty-icon`}>
          <M aria-hidden={`true`} size={16} strokeWidth={1.8} />
        </Component1936>
        <Component1937>{`暂无摄像机截图`}</Component1937>
      </Component1938>;
  }
  function V() {
    const Component1939 = `h3`;
    const Component1940 = `section`;
    const Component1941 = `div`;
    const Component1942 = `div`;
    return <Component1942 className={`camera-capture-overview`}>
        <Component1941 className={`camera-capture-overview-scroll`}>
          {T ? w.filter(e => {
          return e.captures.length > 0;
        }).map(e => {
          return <Component1940 aria-label={`${e.camera.name}截图`} className={`camera-capture-group`} key={e.camera.id}>
                      <Component1939>
                        {e.camera.name}
                        {`截图`}
                      </Component1939>
                      {ne(e.captures)}
                    </Component1940>;
        }) : re()}
        </Component1941>
      </Component1942>;
  }
  function ie() {
    if (e === `captures`) {
      const Component1943 = `span`;
      const Component1944 = `button`;
      const Component1945 = `span`;
      const Component1946 = `button`;
      const Component1947 = `div`;
      return <Component1947 className={`camera-capture-overview-footer`}>
          <Component1944 className={`camera-capture-clear-all`} type={`button`} onClick={F}>
            <Ot aria-hidden={`true`} data-testid={`camera-capture-clear-icon`} size={14} strokeWidth={1.9} />
            <Component1943>{`清空全部`}</Component1943>
          </Component1944>
          <Component1946 className={`camera-capture-send-all viewport-toolbar-crowd-confirm`} type={`button`} onClick={j}>
            <Te aria-hidden={`true`} data-testid={`camera-capture-send-icon`} size={14} strokeWidth={1.9} />
            <Component1945>{`发送到画布`}</Component1945>
          </Component1946>
        </Component1947>;
    } else {
      return null;
    }
  }
  function ae() {
    if (!o) {
      return null;
    }
    let e = [`camera-capture-viewer-image`, c > 1 ? `is-zoomed` : ``, f ? `is-dragging` : ``].filter(Boolean).join(` `);
    const Component1948 = `button`;
    const Component1949 = `button`;
    const Component1950 = `button`;
    const Component1951 = `button`;
    const Component1952 = `div`;
    const Component1953 = `img`;
    const Component1954 = `div`;
    const Component1955 = `div`;
    return <Component1955 aria-label={`相机截图查看器`} className={`camera-capture-viewer`} role={`dialog`} onClick={R}>
        <Component1952 aria-label={`相机截图查看器工具栏`} className={`camera-capture-viewer-toolbar`} role={`toolbar`} onClick={e => {
        return e.stopPropagation();
      }}>
          <Component1948 aria-label={`放大图片`} className={`camera-capture-viewer-tool`} type={`button`} onClick={() => {
          return I(`in`);
        }}>
            <_Component1 aria-hidden={`true`} size={18} strokeWidth={2} />
          </Component1948>
          <Component1949 aria-label={`缩小图片`} className={`camera-capture-viewer-tool`} type={`button`} onClick={() => {
          return I(`out`);
        }}>
            <_Component65 aria-hidden={`true`} size={18} strokeWidth={2} />
          </Component1949>
          <Component1950 aria-label={`下载图片`} className={`camera-capture-viewer-tool`} type={`button`} onClick={() => {
          return _cmp_jf(o.dataUrl, `${o.name}.png`);
        }}>
            <_Component6 aria-hidden={`true`} size={18} strokeWidth={2} />
          </Component1950>
          <Component1951 aria-label={`关闭相机截图查看器`} className={`camera-capture-viewer-tool camera-capture-viewer-close`} type={`button`} onClick={R}>
            <Gt aria-hidden={`true`} size={18} strokeWidth={2} />
          </Component1951>
        </Component1952>
        <Component1954 className={`camera-capture-viewer-stage`}>
          <Component1953 className={e} alt={`${o.name} 查看大图`} src={o.dataUrl} style={{
          transform: `translate(${u.x}px, ${u.y}px) scale(${c})`
        }} onClick={e => {
          return e.stopPropagation();
        }} onWheel={ee} onMouseDown={L} draggable={false} />
        </Component1954>
      </Component1955>;
  }
  const Component1956 = `option`;
  const Component1957 = `option`;
  const Component1958 = `option`;
  const Component1959 = `span`;
  const Component1960 = `button`;
  const Component1961 = `p`;
  const Component1962 = `p`;
  const Component1963 = `div`;
  return <_cmp__Component69 title={`摄像机`} ariaLabel={`摄像机右侧属性面板`} className={e === `captures` ? `camera-inspector-captures` : undefined} footer={ie()} tabs={[{
    label: `属性`,
    active: e === `properties`,
    onClick: () => {
      return t(`properties`);
    }
  }, {
    label: `摄像机截图`,
    active: e === `captures`,
    onClick: () => {
      return t(`captures`);
    }
  }]}>
      {e === `properties` ? <Q.Fragment>
          <_cmp__Component66 label={`名称`} ariaLabel={`机位名称`} value={S.name} onChange={e => {
        return b(S.id, {
          name: e
        });
      }} />
          <_cmp__Component67 label={`切换机位`} ariaLabel={`切换机位`} value={S.id} onChange={e => {
        return v(e);
      }}>
            {g.map(e => {
          return <Component1956 value={e.id} key={e.id}>
                  {e.name}
                </Component1956>;
        })}
          </_cmp__Component67>
          <_cmp__Component68 label={`位置`} axes={[{
        axis: `X`,
        ariaLabel: `机位位置 X`,
        value: S.transform.position[0],
        onChange: e => {
          return b(S.id, {
            transform: {
              ...S.transform,
              position: Rf(S.transform.position, 0, Number(e))
            }
          });
        }
      }, {
        axis: `Y`,
        ariaLabel: `机位位置 Y`,
        value: S.transform.position[1],
        onChange: e => {
          return b(S.id, {
            transform: {
              ...S.transform,
              position: Rf(S.transform.position, 1, Number(e))
            }
          });
        }
      }, {
        axis: `Z`,
        ariaLabel: `机位位置 Z`,
        value: S.transform.position[2],
        onChange: e => {
          return b(S.id, {
            transform: {
              ...S.transform,
              position: Rf(S.transform.position, 2, Number(e))
            }
          });
        }
      }]} />
          <_cmp__Component67 label={`注视目标`} ariaLabel={`注视目标模式`} value={D} onChange={te}>
            <Component1957 value={`manual`}>{`手动坐标`}</Component1957>
            {E.map(e => {
          return <Component1958 value={`object:${e.id}`} key={e.id}>
                  {e.name}
                </Component1958>;
        })}
          </_cmp__Component67>
          <_cmp__Component68 label={`注视坐标`} axes={[{
        axis: `X`,
        ariaLabel: `注视坐标 X`,
        value: S.target[0],
        onChange: e => {
          return z(0, e);
        }
      }, {
        axis: `Y`,
        ariaLabel: `注视坐标 Y`,
        value: S.target[1],
        onChange: e => {
          return z(1, e);
        }
      }, {
        axis: `Z`,
        ariaLabel: `注视坐标 Z`,
        value: S.target[2],
        onChange: e => {
          return z(2, e);
        }
      }]} />
          <_cmp_Cf label={`视野角度 (FOV)`} rangeAriaLabel={`机位 FOV 滑杆`} numberAriaLabel={`机位 FOV`} max={`120`} min={`10`} step={`0.1`} value={S.fov} onValueChange={e => {
        return b(S.id, {
          fov: Number(e)
        });
      }} />
          <_cmp_Tf title={`相机截图`} className={`camera-capture-section`}>
            <Component1960 className={`camera-capture-current-button`} type={`button`} onClick={() => {
          return void N();
        }}>
              <_Component60 aria-hidden={`true`} data-testid={`camera-current-capture-icon`} size={14} strokeWidth={1.9} />
              <Component1959>{`当前机位截图`}</Component1959>
            </Component1960>
            {n ? <Component1961>{n}</Component1961> : null}
            {B()}
          </_cmp_Tf>
        </Q.Fragment> : <Component1963 className={`camera-capture-tab`}>
          {n ? <Component1962>{n}</Component1962> : null}
          {V()}
        </Component1963>}
      {ae()}
    </_cmp__Component69>;
}