// TODO(全局, 无需 import): getViewportCameraSnapshot, toolbarContainerRef, n, l, u, f, p, r, g, v, b, k, i, left, bottom, o, z, width, s, de, kind, addToScene, assetSource, xe, preset, source, cameraId, ye, bodyType, rows, ae, columns, oe, spacing, ze, fileName, name, url, categoryId, thumbUrl, label, icon, mode, onClick, q, ke, le, qe, ee, fe, et, je
import _cmp__Component82 from './_Component82.jsx';
import { qh, Tu, Jh, Yh, Xh, $, e, d, h, C, T, O, A, M, j, y, w, E, P, t, L, S, a, R, re, H, c, rh, Nh, Ce, be, Se, Ee, rg, Xf, De, ge, ie, tg, ng, G, U, W, ce, Be, _e, he, id, Oe, Ut, Le, I, _Component89, _Component26, B, Pe, Je, We, nt, Ge, _Component58, Me, D, K, Zt, we, Kh, Ue, Xe, X, N, $e, Ye, Ne, F, Fe, Ie, te, Qe, Zh, Qh, $h, eg, Re, Ve, bu, J, V, ne, Fh, ue, Ze, Y, pe, He, Hm, Te, Ke, Ae, _Component80, _Component61, Gt, _, Ot, Xt } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
export default function _Component83({
  getViewportCameraSnapshot: e,
  toolbarContainerRef: t
}) {
  let n = Z.useRef(null);
  let r = Z.useRef(null);
  let i = Z.useRef(null);
  let a = Z.useRef(null);
  let o = Z.useRef(null);
  let s = Z.useRef(null);
  let c = Z.useRef(null);
  let l = Z.useRef(null);
  let u = Z.useRef(null);
  let d = Z.useRef(null);
  let f = Z.useRef(null);
  let p = Z.useRef(null);
  let h = Z.useRef(null);
  let g = Z.useRef(null);
  let v = Z.useRef(null);
  let [y, b] = Z.useState(false);
  let [S, C] = Z.useState(false);
  let [w, T] = Z.useState(false);
  let [E, O] = Z.useState(false);
  let [k, A] = Z.useState(false);
  let [j, M] = Z.useState(false);
  let [N, P] = Z.useState(qh);
  let [F, L] = Z.useState({});
  let [ee, R] = Z.useState({});
  let [te, z] = Z.useState({});
  let [ne, re] = Z.useState({});
  let [V, H] = Z.useState({});
  let [ie] = Z.useState(Tu[0]?.bodyType ?? `mannequin`);
  let [ae, U] = Z.useState(String(Jh));
  let [oe, W] = Z.useState(String(Yh));
  let [G, ce] = Z.useState(String(Xh));
  let [le, ue] = Z.useState(`convenience`);
  let de = $(e => {
    return e.addImportedAsset;
  });
  let fe = $(e => {
    return e.addObjectFromAsset;
  });
  let pe = $(e => {
    return e.removeImportedAsset;
  });
  let he = $(e => {
    return e.project.assets;
  });
  let ge = $(e => {
    return e.addPresetCharacter;
  });
  let _e = $(e => {
    return e.addCrowdCharacters;
  });
  let ye = $(e => {
    return e.addGeometryPrimitive;
  });
  let be = $(e => {
    return e.addCameraShot;
  });
  let xe = $(e => {
    return e.addCameraCaptures;
  });
  let Se = $(e => {
    return e.project.activeCameraId;
  });
  let Ce = $(e => {
    return e.viewMode;
  });
  let we = $(e => {
    return e.transformMode;
  });
  let Te = $(e => {
    return e.viewportAspectRatio;
  });
  let Ee = $(e => {
    return e.setViewMode;
  });
  let De = $(e => {
    return e.setTransformMode;
  });
  let Oe = $(e => {
    return e.setViewportAspectRatio;
  });
  let ke = $(e => {
    return e.toggleViewportPanelsCollapsed;
  });
  Z.useEffect(() => {
    if (!y && !w && !E && !j && !k) {
      return;
    }
    function e(e) {
      if ((!(e.target instanceof Node) || !n.current?.contains(e.target)) && (!(e.target instanceof Node) || !l.current?.contains(e.target)) && (!(e.target instanceof Node) || !u.current?.contains(e.target)) && (!(e.target instanceof Node) || !d.current?.contains(e.target)) && (!(e.target instanceof Node) || !f.current?.contains(e.target)) && (!(e.target instanceof Node) || !p.current?.contains(e.target)) && (!(e.target instanceof Node) || !r.current?.contains(e.target)) && (!(e.target instanceof Node) || !h.current?.contains(e.target)) && (!(e.target instanceof Node) || !g.current?.contains(e.target)) && (!(e.target instanceof Node) || !v.current?.contains(e.target))) {
        b(false);
        C(false);
        T(false);
        O(false);
        A(false);
        M(false);
      }
    }
    document.addEventListener(`pointerdown`, e);
    return () => {
      document.removeEventListener(`pointerdown`, e);
    };
  }, [j, y, w, E, k]);
  Z.useLayoutEffect(() => {
    let e = n.current;
    if (!e) {
      return;
    }
    let t = () => {
      let t = Math.max(e.offsetHeight, qh);
      P(e => {
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
    let r = new ResizeObserver(t);
    r.observe(e);
    window.addEventListener(`resize`, t);
    return () => {
      r.disconnect();
      window.removeEventListener(`resize`, t);
    };
  }, []);
  Z.useLayoutEffect(() => {
    let e = n.current;
    let t = e?.parentElement;
    if (!e || !t) {
      return;
    }
    let r = () => {
      let n = t.getBoundingClientRect();
      if (y && i.current) {
        let e = i.current.getBoundingClientRect();
        L({
          left: `${e.left - n.left + e.width / 2}px`,
          bottom: `${n.bottom - e.top + 8}px`
        });
      }
      if (S && a.current) {
        let e = a.current.getBoundingClientRect();
        R({
          left: `${e.right - n.left + 8}px`,
          bottom: `${n.bottom - e.bottom}px`
        });
      }
      if (w && o.current) {
        let e = o.current.getBoundingClientRect();
        z({
          left: `${e.right - n.left + 8}px`,
          bottom: `${n.bottom - e.bottom}px`
        });
      }
      if (E) {
        let t = e.getBoundingClientRect();
        re({
          left: `${t.left - n.left + t.width / 2}px`,
          bottom: `${n.bottom - t.top + 10}px`
        });
      }
      if (k) {
        let t = e.getBoundingClientRect();
        H({
          left: `${t.left - n.left + t.width / 2}px`,
          bottom: `${n.bottom - t.top + 10}px`,
          width: `320px`
        });
      }
    };
    r();
    if (typeof ResizeObserver > `u`) {
      window.addEventListener(`resize`, r);
      return () => {
        window.removeEventListener(`resize`, r);
      };
    }
    let l = new ResizeObserver(r);
    l.observe(t);
    l.observe(e);
    if (i.current) {
      l.observe(i.current);
    }
    if (a.current) {
      l.observe(a.current);
    }
    if (o.current) {
      l.observe(o.current);
    }
    if (s.current) {
      l.observe(s.current);
    }
    if (c.current) {
      l.observe(c.current);
    }
    window.addEventListener(`resize`, r);
    return () => {
      l.disconnect();
      window.removeEventListener(`resize`, r);
    };
  }, [y, w, S, E, k]);
  async function Ae(e, t) {
    let n = e.currentTarget;
    let r = Array.from(n.files ?? []);
    if (r.length) {
      try {
        for (let e of r) {
          de({
            kind: `prop`,
            ...(await rh(e)),
            addToScene: t,
            assetSource: `local`
          });
        }
      } catch {} finally {
        n.value = ``;
      }
    }
  }
  async function je(e) {
    let t = e.currentTarget;
    let n = t.files?.[0];
    if (n) {
      try {
        de({
          kind: `panorama`,
          ...(await Nh(n))
        });
      } catch {} finally {
        t.value = ``;
      }
    }
  }
  async function Me(t) {
    try {
      let n = Ce === `director` ? be(e?.()) : Se;
      Ee(`camera`);
      await rg();
      xe(n, (await Xf({
        preset: t,
        source: `camera-panel`,
        cameraId: n
      })).map(e => {
        return e.dataUrl;
      }));
    } catch {}
  }
  function q(e) {
    De(e);
  }
  function Ne() {
    b(e => {
      return !e;
    });
    C(false);
    T(false);
    O(false);
    M(false);
  }
  function Pe() {
    A(e => {
      return !e;
    });
    b(false);
    C(false);
    T(false);
    O(false);
    M(false);
  }
  function Fe(e) {
    ge(e);
    b(false);
    C(false);
    T(false);
  }
  function J(e) {
    ye(e);
    b(false);
    C(false);
    T(false);
  }
  function Ie() {
    T(true);
    C(false);
  }
  function Re() {
    T(false);
  }
  function ze() {
    return {
      bodyType: ie,
      rows: tg(Number(ae)),
      columns: tg(Number(oe)),
      spacing: ng(Number(G))
    };
  }
  function Be(e) {
    U(String(e.rows));
    W(String(e.columns));
    ce(String(e.spacing));
  }
  function Ve() {
    let e = ze();
    Be(e);
    _e(e);
    b(false);
    C(false);
    T(false);
  }
  function He(e) {
    de({
      kind: `prop`,
      assetSource: `library`,
      fileName: e.fileName,
      name: e.name,
      url: e.url
    });
    O(false);
  }
  async function Y() {
    g.current?.click();
  }
  let Ue = he.filter(e => {
    return e.sourceType === `model` && e.assetSource === `local`;
  }).map(e => {
    return {
      categoryId: `my-models`,
      fileName: e.fileName,
      id: e.id,
      name: e.name ?? e.fileName.replace(/\.(fbx|obj)$/i, ``),
      thumbUrl: undefined,
      url: e.url
    };
  });
  function We() {
    let t = e?.();
    be(t);
  }
  function Ge() {
    M(e => {
      return !e;
    });
    b(false);
    C(false);
    T(false);
    O(false);
  }
  function Ke(e) {
    Oe(e);
    M(false);
  }
  let qe = [{
    label: `移动`,
    icon: Ut,
    mode: `translate`,
    onClick: () => {
      return q(`translate`);
    }
  }, {
    label: `旋转`,
    icon: Le,
    mode: `rotate`,
    onClick: () => {
      return q(`rotate`);
    }
  }, {
    label: `缩放`,
    icon: I,
    mode: `scale`,
    onClick: () => {
      return q(`scale`);
    }
  }, {
    label: `导入全景图`,
    icon: _Component89,
    onClick: () => {
      return v.current?.click();
    }
  }, {
    label: `导入本地模型`,
    icon: _Component26,
    onClick: () => {
      h.current?.click();
    }
  }, {
    label: `AI 生成 3D 模型`,
    icon: B,
    onClick: Pe
  }, {
    label: `添加机位`,
    icon: Je,
    onClick: We
  }, {
    label: `选择画幅比例`,
    icon: nt,
    onClick: Ge
  }, {
    label: `当前视角截图`,
    icon: _Component58,
    onClick: () => {
      return void Me(`current`);
    }
  }, {
    label: `四方位截图`,
    icon: D,
    onClick: () => {
      return void Me(`four`);
    }
  }, {
    label: `十二方位截图`,
    icon: K,
    onClick: () => {
      return void Me(`twelve`);
    }
  }, {
    label: `全屏`,
    icon: Zt,
    onClick: ke
  }];
  function Ye(e) {
    let _Component79 = e.icon;
    let n = e.mode ? we === e.mode : false;
    const Component2161 = `span`;
    const Component2162 = `button`;
    return <Component2162 aria-label={e.label} aria-pressed={e.mode ? n : undefined} className={`ui-icon-button viewport-toolbar-button${n ? ` is-active` : ``}`} type={`button`} onClick={e.onClick} key={e.label}>
        <_Component79 aria-hidden={`true`} size={17} strokeWidth={1.9} />
        <Component2161 className={`viewport-toolbar-label`}>{e.label}</Component2161>
      </Component2162>;
  }
  let Xe = Kh();
  let Ze = le === `my-models` ? Ue : Xe.filter(e => {
    return e.categoryId === le;
  });
  let X = ze();
  let Qe = X.rows * X.columns;
  function $e(e) {
    n.current = e;
    if (t) {
      t.current = e;
    }
  }
  let et = {
    '--viewport-toolbar-height': `${N}px`
  };
  const Component2163 = `span`;
  const Component2164 = `button`;
  const Component2165 = `div`;
  const Component2168 = `div`;
  const Component2169 = `button`;
  const Component2170 = `span`;
  const Component2171 = `button`;
  const Component2172 = `div`;
  const Component2173 = `span`;
  const Component2174 = `button`;
  const Component2175 = `div`;
  const Component2176 = `div`;
  const Component2177 = `h2`;
  const Component2178 = `span`;
  const Component2179 = `div`;
  const Component2180 = `span`;
  const Component2181 = `input`;
  const Component2182 = `label`;
  const Component2183 = `span`;
  const Component2184 = `span`;
  const Component2185 = `input`;
  const Component2186 = `label`;
  const Component2187 = `span`;
  const Component2188 = `input`;
  const Component2189 = `label`;
  const Component2190 = `div`;
  const Component2191 = `button`;
  const Component2192 = `button`;
  const Component2193 = `div`;
  const Component2194 = `div`;
  const Component2195 = `button`;
  const Component2196 = `div`;
  const Component2197 = `h2`;
  const Component2198 = `button`;
  const Component2199 = `div`;
  const Component2201 = `div`;
  const Component2202 = `span`;
  const Component2203 = `span`;
  const Component2204 = `button`;
  const Component2205 = `div`;
  const Component2206 = `img`;
  const Component2207 = `span`;
  const Component2208 = `span`;
  const Component2209 = `button`;
  const Component2210 = `button`;
  const Component2211 = `div`;
  const Component2212 = `img`;
  const Component2213 = `span`;
  const Component2214 = `span`;
  const Component2215 = `button`;
  const Component2216 = `span`;
  const Component2217 = `span`;
  const Component2218 = `button`;
  const Component2219 = `div`;
  const Component2220 = `div`;
  const Component2221 = `h2`;
  const Component2225 = `div`;
  const Component2226 = `div`;
  const Component2227 = `input`;
  const Component2228 = `input`;
  const Component2229 = `input`;
  return <Q.Fragment>
      <Component2168 className={`viewport-toolbar`} role={`group`} aria-label={`3D视口快捷工具`} ref={$e}>
        {qe.slice(0, 3).map(Ye)}
        <Component2165 className={`viewport-toolbar-menu-wrap`}>
          <Component2164 aria-expanded={y} aria-label={`添加角色`} className={`ui-icon-button viewport-toolbar-button`} ref={i} type={`button`} onClick={Ne}>
            <_Component80 aria-hidden={`true`} size={17} strokeWidth={1.9} />
            <Component2163 className={`viewport-toolbar-label`}>{`添加角色`}</Component2163>
          </Component2164>
        </Component2165>
        {qe.slice(3).map(e => {
        if (e.label !== `模型库` && e.label !== `AI 生成 3D 模型`) {
          return Ye(e);
        }
        let _Component81 = e.icon;
        let n = e.label === `AI 生成 3D 模型`;
        const Component2166 = `span`;
        const Component2167 = `button`;
        return <Component2167 aria-label={e.label} className={`ui-icon-button viewport-toolbar-button`} ref={n ? c : s} type={`button`} onClick={e.onClick} key={e.label}>
              <_Component81 aria-hidden={`true`} size={17} strokeWidth={1.9} />
              <Component2166 className={`viewport-toolbar-label`}>{e.label}</Component2166>
            </Component2167>;
      })}
      </Component2168>
      {y ? <Component2176 ref={l} className={`viewport-toolbar-menu`} role={`menu`} aria-label={`选择角色体型`} style={F}>
          {Tu.map(e => {
        return <Component2169 role={`menuitem`} type={`button`} onClick={() => {
          return Fe(e.bodyType);
        }} onMouseEnter={() => {
          C(false);
          T(false);
        }} key={e.bodyType}>
                {e.label}
              </Component2169>;
      })}
          <Component2172 className={`viewport-toolbar-submenu-wrap`} onMouseEnter={Ie}>
            <Component2171 ref={o} aria-expanded={w} aria-haspopup={`dialog`} className={`viewport-toolbar-menu-subtrigger`} role={`menuitem`} type={`button`} onFocus={Ie} onMouseEnter={Ie}>
              <Component2170>{`群众 (3x3)`}</Component2170>
              <_Component61 aria-hidden={`true`} size={14} strokeWidth={1.8} />
            </Component2171>
          </Component2172>
          <Component2175 className={`viewport-toolbar-submenu-wrap`} onMouseEnter={() => {
        C(true);
        T(false);
      }}>
            <Component2174 ref={a} aria-expanded={S} aria-haspopup={`menu`} className={`viewport-toolbar-menu-subtrigger`} role={`menuitem`} type={`button`} onMouseEnter={() => {
          C(true);
          T(false);
        }}>
              <Component2173>{`几何模型`}</Component2173>
              <_Component61 aria-hidden={`true`} size={14} strokeWidth={1.8} />
            </Component2174>
          </Component2175>
        </Component2176> : null}
      {w ? <Component2194 ref={d} className={`viewport-toolbar-crowd-panel`} role={`dialog`} aria-label={`添加群众阵列`} style={te}>
          <Component2179 className={`viewport-toolbar-crowd-panel-header`}>
            <Component2177 className={`viewport-toolbar-crowd-panel-title`}>{`添加群众阵列`}</Component2177>
            <Component2178 className={`viewport-toolbar-crowd-panel-count`}>
              {`共`}
              {Qe}
              {`人`}
            </Component2178>
          </Component2179>
          <Component2190 className={`viewport-toolbar-crowd-grid`}>
            <Component2182 className={`viewport-toolbar-crowd-field`}>
              <Component2180>{`行数`}</Component2180>
              <Component2181 className={`ui-field`} aria-label={`群众行数`} inputMode={`numeric`} type={`number`} min={Zh} max={Qh} value={ae} onChange={e => {
            return U(e.currentTarget.value);
          }} />
            </Component2182>
            <Component2183 className={`viewport-toolbar-crowd-separator`} aria-hidden={`true`}>{`×`}</Component2183>
            <Component2186 className={`viewport-toolbar-crowd-field`}>
              <Component2184>{`列数`}</Component2184>
              <Component2185 className={`ui-field`} aria-label={`群众列数`} inputMode={`numeric`} type={`number`} min={Zh} max={Qh} value={oe} onChange={e => {
            return W(e.currentTarget.value);
          }} />
            </Component2186>
            <Component2189 className={`viewport-toolbar-crowd-field viewport-toolbar-crowd-field-spacing`}>
              <Component2187>{`间距`}</Component2187>
              <Component2188 className={`ui-field`} aria-label={`群众间距`} inputMode={`decimal`} type={`number`} min={$h} max={eg} step={`0.1`} value={G} onChange={e => {
            return ce(e.currentTarget.value);
          }} />
            </Component2189>
          </Component2190>
          <Component2193 className={`viewport-toolbar-crowd-actions`}>
            <Component2191 className={`viewport-toolbar-crowd-cancel camera-capture-clear-all`} type={`button`} onClick={Re}>{`取消`}</Component2191>
            <Component2192 aria-label={`添加群众`} className={`viewport-toolbar-crowd-confirm camera-capture-send-all`} type={`button`} onClick={Ve}>{`添加`}</Component2192>
          </Component2193>
        </Component2194> : null}
      {S ? <Component2196 ref={u} className={`viewport-toolbar-submenu`} role={`menu`} aria-label={`选择几何模型`} style={ee}>
          {bu.map(e => {
        return <Component2195 role={`menuitem`} type={`button`} onClick={() => {
          return J(e.type);
        }} key={e.type}>
                {e.label}
              </Component2195>;
      })}
        </Component2196> : null}
      {k ? <_cmp__Component82 panelRef={p} style={V} onClose={() => {
      return A(false);
    }} /> : null}
      {E ? <Component2220 ref={f} className={`model-library-panel`} role={`dialog`} aria-label={`模型库`} style={ne}>
          <Component2199 className={`model-library-header`}>
            <Component2197 className={`model-library-title`}>{`模型库`}</Component2197>
            <Component2198 aria-label={`关闭模型库`} className={`top-bar-action-button model-library-close-button`} type={`button`} onClick={() => {
          return O(false);
        }}>
              <Gt aria-hidden={`true`} size={16} strokeWidth={1.8} />
            </Component2198>
          </Component2199>
          <Component2201 className={`model-library-tabs`} role={`tablist`} aria-label={`模型分类`}>
            {Fh.map(e => {
          let t = e.id === le;
          const Component2200 = `button`;
          return <Component2200 aria-selected={t} className={`model-library-tab${t ? ` is-active` : ``}`} role={`tab`} type={`button`} onClick={() => {
            return ue(e.id);
          }} key={e.id}>
                  {e.label}
                </Component2200>;
        })}
          </Component2201>
          {le === `my-models` && Ze.length === 0 ? <Component2205 className={`model-library-empty-state object-search-empty-state`} role={`status`} aria-label={`暂无任何模型`}>
              <Component2202 className={`object-search-empty-icon`} data-testid={`my-models-empty-icon`}>
                <_ aria-hidden={`true`} size={16} strokeWidth={1.8} />
              </Component2202>
              <Component2203>{`暂无任何模型`}</Component2203>
              <Component2204 className={`top-bar-action-button model-library-empty-action`} type={`button`} onClick={() => {
          return void Y();
        }}>{`本地导入`}</Component2204>
            </Component2205> : <Component2219 className={`model-library-grid`} role={`list`} aria-label={`模型列表`}>
              {Ze.map(e => {
          if (le === `my-models`) {
            return <Component2211 className={`model-library-card-wrap`} key={e.id}>
                      <Component2209 aria-label={`添加模型 ${e.name}`} className={`model-library-card`} type={`button`} onClick={() => {
                fe(e.id);
                O(false);
              }}>
                        <Component2207 className={`model-library-thumb`} aria-hidden={`true`}>
                          {e.thumbUrl ? <Component2206 alt={``} aria-hidden={`true`} className={`model-library-thumb-image`} loading={`lazy`} src={e.thumbUrl} /> : <_ size={24} strokeWidth={1.6} />}
                        </Component2207>
                        <Component2208 className={`model-library-name`}>{e.name}</Component2208>
                      </Component2209>
                      <Component2210 aria-label={`删除模型 ${e.name}`} className={`model-library-card-delete`} type={`button`} onClick={() => {
                pe(e.id);
              }}>
                        <Ot aria-hidden={`true`} size={14} strokeWidth={1.9} />
                      </Component2210>
                    </Component2211>;
          } else {
            return <Component2215 aria-label={`添加模型 ${e.name}`} className={`model-library-card`} type={`button`} onClick={() => {
              He(e);
            }} key={e.id}>
                      <Component2213 className={`model-library-thumb`} aria-hidden={`true`}>
                        {e.thumbUrl ? <Component2212 alt={``} aria-hidden={`true`} className={`model-library-thumb-image`} loading={`lazy`} src={e.thumbUrl} /> : <_ size={24} strokeWidth={1.6} />}
                      </Component2213>
                      <Component2214 className={`model-library-name`}>{e.name}</Component2214>
                    </Component2215>;
          }
        })}
              {le === `my-models` ? <Component2218 aria-label={`本地导入`} className={`model-library-card model-library-import-card`} type={`button`} onClick={() => {
          return void Y();
        }}>
                  <Component2216 className={`model-library-thumb model-library-thumb-import`} aria-hidden={`true`}>
                    <Xt size={28} strokeWidth={1.8} />
                  </Component2216>
                  <Component2217 className={`model-library-name`}>{`本地导入`}</Component2217>
                </Component2218> : null}
            </Component2219>}
        </Component2220> : null}
      {j ? <Component2226 ref={r} className={`viewport-aspect-panel`} role={`dialog`} aria-label={`比例`} style={et}>
          <Component2221 className={`viewport-aspect-panel-title`}>{`比例`}</Component2221>
          <Component2225 className={`viewport-aspect-panel-grid`} role={`group`} aria-label={`画幅比例选项`}>
            {Hm.map(e => {
          let t = e.id === Te;
          let n = `viewport-aspect-option-frame viewport-aspect-option-frame-${e.id.replace(`:`, `-`)}`;
          const Component2222 = `span`;
          const Component2223 = `span`;
          const Component2224 = `button`;
          return <Component2224 aria-pressed={t} className={`viewport-aspect-option${t ? ` is-active` : ``}`} type={`button`} onClick={() => {
            return Ke(e.id);
          }} key={e.id}>
                  <Component2222 className={n} aria-hidden={`true`} />
                  <Component2223 className={`viewport-aspect-option-label`}>
                    {e.label}
                  </Component2223>
                </Component2224>;
        })}
          </Component2225>
        </Component2226> : null}
      <Component2227 ref={v} aria-hidden={`true`} className={`hidden-file-input`} tabIndex={-1} accept={`.jpg,.jpeg,.png,.webp`} type={`file`} onChange={e => {
      return void je(e);
    }} />
      <Component2228 ref={h} aria-hidden={`true`} className={`hidden-file-input`} data-testid={`scene-local-model-input`} tabIndex={-1} accept={`.fbx,.obj`} type={`file`} onChange={e => {
      return void Ae(e, true);
    }} />
      <Component2229 ref={g} aria-hidden={`true`} className={`hidden-file-input`} data-testid={`library-local-model-input`} tabIndex={-1} accept={`.fbx,.obj`} multiple={true} type={`file`} onChange={e => {
      return void Ae(e, false);
    }} />
    </Q.Fragment>;
}