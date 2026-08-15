// TODO(全局, 无需 import): getViewportCameraSnapshot, toolbarContainerRef, n, l, u, f, p, r, g, v, b, k, i, ee, left, bottom, o, z, ie, width, s, de, kind, addToScene, assetSource, xe, preset, source, cameraId, ye, bodyType, rows, oe, columns, se, spacing, fileName, name, url, categoryId, thumbUrl, label, icon, mode, onClick, q, qe, fe, et, je
import _cmp_Nm from './Nm.jsx';
import { Eh, iu, Dh, Oh, kh, $, e, d, h, C, T, O, A, M, j, y, w, E, P, t, S, a, R, re, c, Im, fh, Ce, be, Se, Ee, Ih, kf, De, ge, ae, Ph, Fh, W, H, U, le, Be, Ve, _e, he, id, K, Ut, Me, Re, I, _Component115, _Component29, B, Pe, Je, We, nt, Ge, _Component60, D, _Component28, Zt, Oe, we, Th, G, Ue, Xe, X, N, $e, Ye, Ne, F, Fe, Le, te, Qe, Ah, jh, Mh, Nh, ze, He, L, $l, Ie, V, ne, mh, ue, Ze, Y, pe, J, xm, Te, Ke, Ae, _Component102, _Component63, Gt, _, Ot, Xt } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
export default function Lh({
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
  let [N, P] = Z.useState(Eh);
  let [F, ee] = Z.useState({});
  let [L, R] = Z.useState({});
  let [te, z] = Z.useState({});
  let [ne, re] = Z.useState({});
  let [V, ie] = Z.useState({});
  let [ae] = Z.useState(iu[0]?.bodyType ?? `mannequin`);
  let [oe, H] = Z.useState(String(Dh));
  let [se, U] = Z.useState(String(Oh));
  let [W, le] = Z.useState(String(kh));
  let [G, ue] = Z.useState(`convenience`);
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
  let K = $(e => {
    return e.setViewportAspectRatio;
  });
  let Oe = $(e => {
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
      let t = Math.max(e.offsetHeight, Eh);
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
        ee({
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
        ie({
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
            ...(await Im(e)),
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
          ...(await fh(n))
        });
      } catch {} finally {
        t.value = ``;
      }
    }
  }
  async function q(t) {
    try {
      let n = Ce === `director` ? be(e?.()) : Se;
      Ee(`camera`);
      await Ih();
      xe(n, (await kf({
        preset: t,
        source: `camera-panel`,
        cameraId: n
      })).map(e => {
        return e.dataUrl;
      }));
    } catch {}
  }
  function Me(e) {
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
  function Ie(e) {
    ye(e);
    b(false);
    C(false);
    T(false);
  }
  function Le() {
    T(true);
    C(false);
  }
  function ze() {
    T(false);
  }
  function Be() {
    return {
      bodyType: ae,
      rows: Ph(Number(oe)),
      columns: Ph(Number(se)),
      spacing: Fh(Number(W))
    };
  }
  function Ve(e) {
    H(String(e.rows));
    U(String(e.columns));
    le(String(e.spacing));
  }
  function He() {
    let e = Be();
    Ve(e);
    _e(e);
    b(false);
    C(false);
    T(false);
  }
  function J(e) {
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
    K(e);
    M(false);
  }
  let qe = [{
    label: `移动`,
    icon: Ut,
    mode: `translate`,
    onClick: () => {
      return Me(`translate`);
    }
  }, {
    label: `旋转`,
    icon: Re,
    mode: `rotate`,
    onClick: () => {
      return Me(`rotate`);
    }
  }, {
    label: `缩放`,
    icon: I,
    mode: `scale`,
    onClick: () => {
      return Me(`scale`);
    }
  }, {
    label: `导入全景图`,
    icon: _Component115,
    onClick: () => {
      return v.current?.click();
    }
  }, {
    label: `导入本地模型`,
    icon: _Component29,
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
    icon: _Component60,
    onClick: () => {
      return void q(`current`);
    }
  }, {
    label: `四方位截图`,
    icon: D,
    onClick: () => {
      return void q(`four`);
    }
  }, {
    label: `十二方位截图`,
    icon: _Component28,
    onClick: () => {
      return void q(`twelve`);
    }
  }, {
    label: `全屏`,
    icon: Zt,
    onClick: Oe
  }];
  function Ye(e) {
    let _Component101 = e.icon;
    let n = e.mode ? we === e.mode : false;
    const Component2139 = `span`;
    const Component2140 = `button`;
    return <Component2140 aria-label={e.label} aria-pressed={e.mode ? n : undefined} className={`ui-icon-button viewport-toolbar-button${n ? ` is-active` : ``}`} type={`button`} onClick={e.onClick} key={e.label}>
        <_Component101 aria-hidden={`true`} size={17} strokeWidth={1.9} />
        <Component2139 className={`viewport-toolbar-label`}>{e.label}</Component2139>
      </Component2140>;
  }
  let Xe = Th();
  let Ze = G === `my-models` ? Ue : Xe.filter(e => {
    return e.categoryId === G;
  });
  let X = Be();
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
  const Component2141 = `span`;
  const Component2142 = `button`;
  const Component2143 = `div`;
  const Component2146 = `div`;
  const Component2147 = `button`;
  const Component2148 = `span`;
  const Component2149 = `button`;
  const Component2150 = `div`;
  const Component2151 = `span`;
  const Component2152 = `button`;
  const Component2153 = `div`;
  const Component2154 = `div`;
  const Component2155 = `h2`;
  const Component2156 = `span`;
  const Component2157 = `div`;
  const Component2158 = `span`;
  const Component2159 = `input`;
  const Component2160 = `label`;
  const Component2161 = `span`;
  const Component2162 = `span`;
  const Component2163 = `input`;
  const Component2164 = `label`;
  const Component2165 = `span`;
  const Component2166 = `input`;
  const Component2167 = `label`;
  const Component2168 = `div`;
  const Component2169 = `button`;
  const Component2170 = `button`;
  const Component2171 = `div`;
  const Component2172 = `div`;
  const Component2173 = `button`;
  const Component2174 = `div`;
  const Component2175 = `h2`;
  const Component2176 = `button`;
  const Component2177 = `div`;
  const Component2179 = `div`;
  const Component2180 = `span`;
  const Component2181 = `span`;
  const Component2182 = `button`;
  const Component2183 = `div`;
  const Component2184 = `img`;
  const Component2185 = `span`;
  const Component2186 = `span`;
  const Component2187 = `button`;
  const Component2188 = `button`;
  const Component2189 = `div`;
  const Component2190 = `img`;
  const Component2191 = `span`;
  const Component2192 = `span`;
  const Component2193 = `button`;
  const Component2194 = `span`;
  const Component2195 = `span`;
  const Component2196 = `button`;
  const Component2197 = `div`;
  const Component2198 = `div`;
  const Component2199 = `h2`;
  const Component2203 = `div`;
  const Component2204 = `div`;
  const Component2205 = `input`;
  const Component2206 = `input`;
  const Component2207 = `input`;
  return <Q.Fragment>
      <Component2146 className={`viewport-toolbar`} role={`group`} aria-label={`3D视口快捷工具`} ref={$e}>
        {qe.slice(0, 3).map(Ye)}
        <Component2143 className={`viewport-toolbar-menu-wrap`}>
          <Component2142 aria-expanded={y} aria-label={`添加角色`} className={`ui-icon-button viewport-toolbar-button`} ref={i} type={`button`} onClick={Ne}>
            <_Component102 aria-hidden={`true`} size={17} strokeWidth={1.9} />
            <Component2141 className={`viewport-toolbar-label`}>{`添加角色`}</Component2141>
          </Component2142>
        </Component2143>
        {qe.slice(3).map(e => {
        if (e.label !== `模型库` && e.label !== `AI 生成 3D 模型`) {
          return Ye(e);
        }
        let _Component103 = e.icon;
        let n = e.label === `AI 生成 3D 模型`;
        const Component2144 = `span`;
        const Component2145 = `button`;
        return <Component2145 aria-label={e.label} className={`ui-icon-button viewport-toolbar-button`} ref={n ? c : s} type={`button`} onClick={e.onClick} key={e.label}>
              <_Component103 aria-hidden={`true`} size={17} strokeWidth={1.9} />
              <Component2144 className={`viewport-toolbar-label`}>{e.label}</Component2144>
            </Component2145>;
      })}
      </Component2146>
      {y ? <Component2154 ref={l} className={`viewport-toolbar-menu`} role={`menu`} aria-label={`选择角色体型`} style={F}>
          {iu.map(e => {
        return <Component2147 role={`menuitem`} type={`button`} onClick={() => {
          return Fe(e.bodyType);
        }} onMouseEnter={() => {
          C(false);
          T(false);
        }} key={e.bodyType}>
                {e.label}
              </Component2147>;
      })}
          <Component2150 className={`viewport-toolbar-submenu-wrap`} onMouseEnter={Le}>
            <Component2149 ref={o} aria-expanded={w} aria-haspopup={`dialog`} className={`viewport-toolbar-menu-subtrigger`} role={`menuitem`} type={`button`} onFocus={Le} onMouseEnter={Le}>
              <Component2148>{`群众 (3x3)`}</Component2148>
              <_Component63 aria-hidden={`true`} size={14} strokeWidth={1.8} />
            </Component2149>
          </Component2150>
          <Component2153 className={`viewport-toolbar-submenu-wrap`} onMouseEnter={() => {
        C(true);
        T(false);
      }}>
            <Component2152 ref={a} aria-expanded={S} aria-haspopup={`menu`} className={`viewport-toolbar-menu-subtrigger`} role={`menuitem`} type={`button`} onMouseEnter={() => {
          C(true);
          T(false);
        }}>
              <Component2151>{`几何模型`}</Component2151>
              <_Component63 aria-hidden={`true`} size={14} strokeWidth={1.8} />
            </Component2152>
          </Component2153>
        </Component2154> : null}
      {w ? <Component2172 ref={d} className={`viewport-toolbar-crowd-panel`} role={`dialog`} aria-label={`添加群众阵列`} style={te}>
          <Component2157 className={`viewport-toolbar-crowd-panel-header`}>
            <Component2155 className={`viewport-toolbar-crowd-panel-title`}>{`添加群众阵列`}</Component2155>
            <Component2156 className={`viewport-toolbar-crowd-panel-count`}>
              {`共`}
              {Qe}
              {`人`}
            </Component2156>
          </Component2157>
          <Component2168 className={`viewport-toolbar-crowd-grid`}>
            <Component2160 className={`viewport-toolbar-crowd-field`}>
              <Component2158>{`行数`}</Component2158>
              <Component2159 className={`ui-field`} aria-label={`群众行数`} inputMode={`numeric`} type={`number`} min={Ah} max={jh} value={oe} onChange={e => {
            return H(e.currentTarget.value);
          }} />
            </Component2160>
            <Component2161 className={`viewport-toolbar-crowd-separator`} aria-hidden={`true`}>{`×`}</Component2161>
            <Component2164 className={`viewport-toolbar-crowd-field`}>
              <Component2162>{`列数`}</Component2162>
              <Component2163 className={`ui-field`} aria-label={`群众列数`} inputMode={`numeric`} type={`number`} min={Ah} max={jh} value={se} onChange={e => {
            return U(e.currentTarget.value);
          }} />
            </Component2164>
            <Component2167 className={`viewport-toolbar-crowd-field viewport-toolbar-crowd-field-spacing`}>
              <Component2165>{`间距`}</Component2165>
              <Component2166 className={`ui-field`} aria-label={`群众间距`} inputMode={`decimal`} type={`number`} min={Mh} max={Nh} step={`0.1`} value={W} onChange={e => {
            return le(e.currentTarget.value);
          }} />
            </Component2167>
          </Component2168>
          <Component2171 className={`viewport-toolbar-crowd-actions`}>
            <Component2169 className={`viewport-toolbar-crowd-cancel camera-capture-clear-all`} type={`button`} onClick={ze}>{`取消`}</Component2169>
            <Component2170 aria-label={`添加群众`} className={`viewport-toolbar-crowd-confirm camera-capture-send-all`} type={`button`} onClick={He}>{`添加`}</Component2170>
          </Component2171>
        </Component2172> : null}
      {S ? <Component2174 ref={u} className={`viewport-toolbar-submenu`} role={`menu`} aria-label={`选择几何模型`} style={L}>
          {$l.map(e => {
        return <Component2173 role={`menuitem`} type={`button`} onClick={() => {
          return Ie(e.type);
        }} key={e.type}>
                {e.label}
              </Component2173>;
      })}
        </Component2174> : null}
      {k ? <_cmp_Nm panelRef={p} style={V} onClose={() => {
      return A(false);
    }} /> : null}
      {E ? <Component2198 ref={f} className={`model-library-panel`} role={`dialog`} aria-label={`模型库`} style={ne}>
          <Component2177 className={`model-library-header`}>
            <Component2175 className={`model-library-title`}>{`模型库`}</Component2175>
            <Component2176 aria-label={`关闭模型库`} className={`top-bar-action-button model-library-close-button`} type={`button`} onClick={() => {
          return O(false);
        }}>
              <Gt aria-hidden={`true`} size={16} strokeWidth={1.8} />
            </Component2176>
          </Component2177>
          <Component2179 className={`model-library-tabs`} role={`tablist`} aria-label={`模型分类`}>
            {mh.map(e => {
          let t = e.id === G;
          const Component2178 = `button`;
          return <Component2178 aria-selected={t} className={`model-library-tab${t ? ` is-active` : ``}`} role={`tab`} type={`button`} onClick={() => {
            return ue(e.id);
          }} key={e.id}>
                  {e.label}
                </Component2178>;
        })}
          </Component2179>
          {G === `my-models` && Ze.length === 0 ? <Component2183 className={`model-library-empty-state object-search-empty-state`} role={`status`} aria-label={`暂无任何模型`}>
              <Component2180 className={`object-search-empty-icon`} data-testid={`my-models-empty-icon`}>
                <_ aria-hidden={`true`} size={16} strokeWidth={1.8} />
              </Component2180>
              <Component2181>{`暂无任何模型`}</Component2181>
              <Component2182 className={`top-bar-action-button model-library-empty-action`} type={`button`} onClick={() => {
          return void Y();
        }}>{`本地导入`}</Component2182>
            </Component2183> : <Component2197 className={`model-library-grid`} role={`list`} aria-label={`模型列表`}>
              {Ze.map(e => {
          if (G === `my-models`) {
            return <Component2189 className={`model-library-card-wrap`} key={e.id}>
                      <Component2187 aria-label={`添加模型 ${e.name}`} className={`model-library-card`} type={`button`} onClick={() => {
                fe(e.id);
                O(false);
              }}>
                        <Component2185 className={`model-library-thumb`} aria-hidden={`true`}>
                          {e.thumbUrl ? <Component2184 alt={``} aria-hidden={`true`} className={`model-library-thumb-image`} loading={`lazy`} src={e.thumbUrl} /> : <_ size={24} strokeWidth={1.6} />}
                        </Component2185>
                        <Component2186 className={`model-library-name`}>{e.name}</Component2186>
                      </Component2187>
                      <Component2188 aria-label={`删除模型 ${e.name}`} className={`model-library-card-delete`} type={`button`} onClick={() => {
                pe(e.id);
              }}>
                        <Ot aria-hidden={`true`} size={14} strokeWidth={1.9} />
                      </Component2188>
                    </Component2189>;
          } else {
            return <Component2193 aria-label={`添加模型 ${e.name}`} className={`model-library-card`} type={`button`} onClick={() => {
              J(e);
            }} key={e.id}>
                      <Component2191 className={`model-library-thumb`} aria-hidden={`true`}>
                        {e.thumbUrl ? <Component2190 alt={``} aria-hidden={`true`} className={`model-library-thumb-image`} loading={`lazy`} src={e.thumbUrl} /> : <_ size={24} strokeWidth={1.6} />}
                      </Component2191>
                      <Component2192 className={`model-library-name`}>{e.name}</Component2192>
                    </Component2193>;
          }
        })}
              {G === `my-models` ? <Component2196 aria-label={`本地导入`} className={`model-library-card model-library-import-card`} type={`button`} onClick={() => {
          return void Y();
        }}>
                  <Component2194 className={`model-library-thumb model-library-thumb-import`} aria-hidden={`true`}>
                    <Xt size={28} strokeWidth={1.8} />
                  </Component2194>
                  <Component2195 className={`model-library-name`}>{`本地导入`}</Component2195>
                </Component2196> : null}
            </Component2197>}
        </Component2198> : null}
      {j ? <Component2204 ref={r} className={`viewport-aspect-panel`} role={`dialog`} aria-label={`比例`} style={et}>
          <Component2199 className={`viewport-aspect-panel-title`}>{`比例`}</Component2199>
          <Component2203 className={`viewport-aspect-panel-grid`} role={`group`} aria-label={`画幅比例选项`}>
            {xm.map(e => {
          let t = e.id === Te;
          let n = `viewport-aspect-option-frame viewport-aspect-option-frame-${e.id.replace(`:`, `-`)}`;
          const Component2200 = `span`;
          const Component2201 = `span`;
          const Component2202 = `button`;
          return <Component2202 aria-pressed={t} className={`viewport-aspect-option${t ? ` is-active` : ``}`} type={`button`} onClick={() => {
            return Ke(e.id);
          }} key={e.id}>
                  <Component2200 className={n} aria-hidden={`true`} />
                  <Component2201 className={`viewport-aspect-option-label`}>
                    {e.label}
                  </Component2201>
                </Component2202>;
        })}
          </Component2203>
        </Component2204> : null}
      <Component2205 ref={v} aria-hidden={`true`} className={`hidden-file-input`} tabIndex={-1} accept={`.jpg,.jpeg,.png,.webp`} type={`file`} onChange={e => {
      return void je(e);
    }} />
      <Component2206 ref={h} aria-hidden={`true`} className={`hidden-file-input`} data-testid={`scene-local-model-input`} tabIndex={-1} accept={`.fbx,.obj`} type={`file`} onChange={e => {
      return void Ae(e, true);
    }} />
      <Component2207 ref={g} aria-hidden={`true`} className={`hidden-file-input`} data-testid={`library-local-model-input`} tabIndex={-1} accept={`.fbx,.obj`} multiple={true} type={`file`} onChange={e => {
      return void Ae(e, false);
    }} />
    </Q.Fragment>;
}