// TODO(全局, 无需 import): i, n, name, icon, crowdId, objectIds, previewChildren, v, object, characters, crowd, geometry, myModels, cameras, r, items, b, u, l, p, g, x, s, o, m
import _cmp_Df from './Df.jsx';
import { $, e, _, t, a, id, y, Ef, w, d, c, S, C, h, T, Ae, _Component33, _Component61, _Component29, _Component28, _e, _Component30, Ot } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
export default function Of() {
  let [e, t] = Z.useState(``);
  let [n, r] = Z.useState([]);
  let i = $(e => {
    return e.project.assets;
  });
  let a = $(e => {
    return e.project.objects;
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
    return e.selectObject;
  });
  let u = $(e => {
    return e.selectCrowd;
  });
  let d = $(e => {
    return e.toggleObjectSelection;
  });
  let p = $(e => {
    return e.setActiveCamera;
  });
  let m = $(e => {
    return e.toggleObjectVisible;
  });
  let h = $(e => {
    return e.toggleObjectLocked;
  });
  let g = $(e => {
    return e.deleteSelectedObject;
  });
  let _ = Z.useMemo(() => {
    return new Map(i.map(e => {
      return [e.id, e];
    }));
  }, [i]);
  let v = e => {
    if (!e?.assetRefId) {
      return false;
    }
    let t = _.get(e.assetRefId);
    return !t || t.sourceType === `model`;
  };
  let y = Z.useMemo(() => {
    let e = new Map();
    let t = [];
    a.forEach(n => {
      if (n.kind === `character` && n.crowdId && n.crowdLabel) {
        let t = e.get(n.crowdId);
        if (t) {
          t.objectIds.push(n.id);
          t.previewChildren = [...(t.previewChildren ?? []), {
            id: n.id,
            name: n.name,
            icon: `character`
          }];
          return;
        }
        e.set(n.crowdId, {
          id: n.crowdId,
          name: n.crowdLabel,
          icon: `crowd`,
          crowdId: n.crowdId,
          objectIds: [n.id],
          previewChildren: [{
            id: n.id,
            name: n.name,
            icon: `character`
          }]
        });
        return;
      }
      t.push({
        id: n.id,
        name: n.name,
        icon: n.kind === `camera` ? `camera` : n.kind === `character` ? `character` : v(n) ? `model` : `geometry`,
        object: n,
        objectIds: [n.id]
      });
    });
    return {
      characters: t.filter(e => {
        return e.object?.kind === `character`;
      }),
      crowd: Array.from(e.values()),
      geometry: t.filter(e => {
        return e.object?.kind === `scene` && !v(e.object) || e.object?.kind === `prop` && !e.object?.assetRefId;
      }),
      myModels: t.filter(e => {
        return v(e.object);
      }),
      cameras: t.filter(e => {
        return e.object?.kind === `camera`;
      })
    };
  }, [a, _]);
  Z.useEffect(() => {
    let e = new Set(y.crowd.map(e => {
      return e.id;
    }));
    r(t => {
      return t.filter(t => {
        return e.has(t);
      });
    });
  }, [y.crowd]);
  let b = Ef.map(t => {
    let n = (t.key === `characters` ? y.characters : t.key === `crowd` ? y.crowd : t.key === `geometry` ? y.geometry : t.key === `my-models` ? y.myModels : y.cameras).map(t => {
      if (!e.trim()) {
        return t;
      }
      let n = t.previewChildren?.filter(t => {
        return t.name.includes(e);
      }) ?? [];
      if (!t.name.includes(e) && n.length === 0) {
        return null;
      } else if (n.length) {
        return {
          ...t,
          previewChildren: n
        };
      } else {
        return t;
      }
    }).filter(e => {
      return !!e;
    });
    return {
      ...t,
      items: n
    };
  }).filter(e => {
    return e.items.length > 0;
  });
  let x = e.trim().length > 0 && b.length === 0;
  function S(e, t) {
    if (e.crowdId) {
      let n = w();
      if (t.shiftKey) {
        if (e.objectIds.every(e => {
          return n.includes(e);
        })) {
          e.objectIds.forEach(e => {
            if (w().includes(e)) {
              d(e);
            }
          });
          return;
        }
        e.objectIds.forEach(e => {
          if (!w().includes(e)) {
            d(e);
          }
        });
        return;
      }
      u(e.crowdId);
      return;
    }
    if (e.objectIds.length > 1) {
      let n = w();
      if (t.shiftKey) {
        if (e.objectIds.every(e => {
          return n.includes(e);
        })) {
          e.objectIds.forEach(e => {
            if (w().includes(e)) {
              d(e);
            }
          });
          return;
        }
        e.objectIds.forEach(e => {
          if (!w().includes(e)) {
            d(e);
          }
        });
        return;
      }
      let [r, ...i] = e.objectIds;
      l(r ?? null);
      i.forEach(e => {
        return d(e);
      });
      return;
    }
    if (t.shiftKey) {
      d(e.id);
      return;
    }
    if (e.object?.kind === `camera` && e.object.linkedCameraId) {
      p(e.object.linkedCameraId);
      return;
    }
    l(e.id);
  }
  function C(e) {
    r(t => {
      if (t.includes(e)) {
        return t.filter(t => {
          return t !== e;
        });
      } else {
        return [...t, e];
      }
    });
  }
  function w() {
    let e = $.getState();
    if (e.selectedObjectIds.length) {
      return e.selectedObjectIds;
    } else if (e.selectedObjectId) {
      return [e.selectedObjectId];
    } else {
      return [];
    }
  }
  function T(e, t) {
    t.stopPropagation();
    if (e.crowdId) {
      u(e.crowdId);
    } else if (e.objectIds.length > 1) {
      let [t, ...n] = e.objectIds;
      l(t ?? null);
      n.forEach(e => {
        return d(e);
      });
    } else {
      l(e.id);
    }
    g();
  }
  const Component1886 = `h2`;
  const Component1887 = `input`;
  const Component1888 = `label`;
  const Component1889 = `span`;
  const Component1890 = `span`;
  const Component1891 = `div`;
  const Component1892 = `h3`;
  const Component1909 = `ul`;
  const Component1910 = `section`;
  const Component1911 = `div`;
  const Component1912 = `section`;
  return <Component1912 className={`panel-card object-tree-panel`}>
      <Component1886 className={`visually-hidden`}>{`场景对象`}</Component1886>
      <Component1888 className={`object-search-field`}>
        <Ae aria-hidden={`true`} size={16} strokeWidth={1.8} />
        <Component1887 className={`ui-field`} aria-label={`搜索场景内容`} value={e} onChange={e => {
        return t(e.target.value);
      }} placeholder={`请输入搜索内容`} />
      </Component1888>
      {x ? <Component1891 className={`object-search-empty-state`} role={`status`} aria-label={`未搜索到内容`}>
          <Component1889 className={`object-search-empty-icon`} data-testid={`object-search-empty-icon`}>
            <Ae aria-hidden={`true`} size={16} strokeWidth={1.8} />
          </Component1889>
          <Component1890>{`未搜索到内容`}</Component1890>
        </Component1891> : <Component1911 className={`object-tree-groups`} role={`tree`} aria-label={`场景对象列表`}>
          {b.map(e => {
        return <Component1910 className={`object-tree-group`} role={`group`} aria-label={`${e.title}分组`} key={e.key}>
                <Component1892>{e.title}</Component1892>
                <Component1909 className={`object-list`}>
                  {e.items.map(e => {
              let t = e.crowdId ? c === e.crowdId || e.objectIds.every(e => {
                return s.includes(e);
              }) : e.objectIds.length > 1 ? e.objectIds.every(e => {
                return s.includes(e);
              }) : s.length ? s.includes(e.id) : e.id === o;
              let r = e.crowdId ? n.includes(e.crowdId) : false;
              const Component1893 = `button`;
              const Component1894 = `span`;
              const Component1895 = `button`;
              const Component1896 = `div`;
              const Component1897 = `button`;
              const Component1898 = `button`;
              const Component1899 = `button`;
              const Component1900 = `div`;
              const Component1901 = `span`;
              const Component1902 = `span`;
              const Component1903 = `button`;
              const Component1904 = `div`;
              const Component1905 = `div`;
              const Component1906 = `li`;
              const Component1907 = `ul`;
              const Component1908 = `li`;
              return <Component1908 className={`object-list-item`} key={e.id}>
                        <Component1900 className={`object-row${t ? ` is-selected` : ``}${e.crowdId ? ` object-row-crowd` : ``}`} role={`treeitem`} aria-label={e.name} aria-selected={t} onClick={t => {
                  return S(e, t);
                }}>
                          <Component1896 className={`object-row-main`}>
                            {e.crowdId ? <Component1893 aria-label={`${r ? `收起` : `展开`} ${e.name}`} className={`object-row-toggle-button`} type={`button`} onClick={t => {
                      t.stopPropagation();
                      C(e.crowdId);
                    }}>
                                {r ? <_Component33 aria-hidden={`true`} size={14} strokeWidth={1.8} /> : <_Component61 aria-hidden={`true`} size={14} strokeWidth={1.8} />}
                              </Component1893> : null}
                            <Component1895 className={`object-select-button`} type={`button`}>
                              <_cmp_Df icon={e.icon} />
                              <Component1894>{e.name}</Component1894>
                            </Component1895>
                          </Component1896>
                          {e.object ? <Q.Fragment>
                              <Component1897 className={`object-flag-button object-icon-flag-button`} type={`button`} aria-label={`${e.name} 可见性`} onClick={t => {
                      t.stopPropagation();
                      m(e.id);
                    }}>
                                {e.object.visible ? <_Component29 aria-hidden={`true`} size={15} strokeWidth={1.8} /> : <_Component28 aria-hidden={`true`} size={15} strokeWidth={1.8} />}
                              </Component1897>
                              <Component1898 className={`object-flag-button object-icon-flag-button`} type={`button`} aria-label={`${e.name} 锁定`} onClick={t => {
                      t.stopPropagation();
                      h(e.id);
                    }}>
                                {e.object.locked ? <_e aria-hidden={`true`} size={15} strokeWidth={1.8} /> : <_Component30 aria-hidden={`true`} size={15} strokeWidth={1.8} />}
                              </Component1898>
                            </Q.Fragment> : null}
                          <Component1899 className={`object-flag-button object-icon-flag-button object-delete-button`} type={`button`} aria-label={`删除 ${e.name}`} title={`删除 ${e.name}`} onClick={t => {
                    return T(e, t);
                  }}>
                            <Ot aria-hidden={`true`} size={15} strokeWidth={1.8} />
                          </Component1899>
                        </Component1900>
                        {e.crowdId && r && e.previewChildren?.length ? <Component1907 className={`object-crowd-preview-list`} aria-label={`${e.name} 成员预览`}>
                            {e.previewChildren.map(n => {
                    return <Component1906 key={n.id}>
                                  <Component1905 className={`object-row object-row-preview${t ? ` is-selected` : ``}`}>
                                    <Component1901 className={`object-row-preview-spacer`} aria-hidden={`true`} />
                                    <Component1904 className={`object-row-main`}>
                                      <Component1903 className={`object-select-button`} type={`button`} onClick={t => {
                            return S(e, t);
                          }}>
                                        <_cmp_Df icon={n.icon} />
                                        <Component1902>{n.name}</Component1902>
                                      </Component1903>
                                    </Component1904>
                                  </Component1905>
                                </Component1906>;
                  })}
                          </Component1907> : null}
                      </Component1908>;
            })}
                </Component1909>
              </Component1910>;
      })}
        </Component1911>}
    </Component1912>;
}