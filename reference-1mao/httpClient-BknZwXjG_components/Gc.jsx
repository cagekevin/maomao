// TODO(全局, 无需 import): data, selected, updateNodeData, i, handleType, z, n, r, sourceId, url, name, o, track, clip, muted, ie, oe, timelineTracks, sourceOrder, clips, mode, audioFormat, resizeWidth, resizeHeight, x, targetFps, f, s, sourceMetadata, errorMessage, ee, atTime, quality, timeoutMs, p, l, sourceStart, sourceEnd, duration, de, fe, me, value, distance, u, se, once, timelineStart, trackId, kind, sourceVideoUrl, sourceVideoName, loading, progress, videoUrl, audioUrl, signal, segments, start, end, controller, onProgress, format, width, height, fps, subfolder, ce, m, outputName, g, outputInfo, size, left, ve, je, ye, ke, xe, transform, v, b, k
import _cmp__Component8 from './_Component8.jsx';
import _cmp__Component9 from './_Component9.jsx';
import _cmp__Component12 from './_Component12.jsx';
import _cmp_mc from './mc.jsx';
import { id, We, Rc, Lt, R, Qt, te, Fc, Lc, ne, Ic, B, Wc, re, E, V, F, H, U, le, h, _, y, C, I, Ec, D, a, L, G, Hc, j, ue, Uc, pe, W, he, ge, M, _e, d, Pc, ae, we, Vc, bc, Oc, Dc, hi, zc, yc, Ne, Me, be, A, Ae, X, Ce, kc, Ee, N, P, Bc, Oe, ze, Ie, Pe, Fe, Le, Re, Se, Ac, jc, S, K, De, Mc, w, Te, _Component49, _Component0, Xe, _Component43, O, Ot, _Component44, Dn, Xt, _Component50, Be, _Component17, _n, T, Gt } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
var Gc = Z.memo(({
  id: e,
  data: t,
  selected: n
}) => {
  let {
    updateNodeData: r
  } = We();
  let i = t;
  let a = Z.useRef(null);
  let o = Z.useRef(null);
  let s = Z.useRef(``);
  let c = Z.useRef(null);
  let l = Z.useRef(null);
  let u = Z.useRef(null);
  let d = Z.useRef(null);
  let f = Z.useRef(new Set());
  let p = Z.useRef([]);
  let m = Z.useRef(false);
  let [h, g] = Z.useState(() => {
    return Rc(i.mode);
  });
  let [_, v] = Z.useState(i.audioFormat || `m4a`);
  let [y, b] = Z.useState(i.resizeWidth ?? 1280);
  let [x, S] = Z.useState(i.resizeHeight ?? 720);
  let [C, w] = Z.useState(i.targetFps ?? 30);
  let [E, D] = Z.useState(i.sourceMetadata || {});
  let [k, A] = Z.useState(null);
  let [j, M] = Z.useState(0);
  let [N, P] = Z.useState(false);
  let [F, I] = Z.useState(``);
  let [ee, L] = Z.useState({});
  let R = Lt({
    handleType: `target`
  });
  let te = Z.useMemo(() => {
    return Array.from(new Set(R.map(e => {
      return e.source;
    })));
  }, [R]);
  let z = Qt(te);
  let ne = Z.useMemo(() => {
    let e = new Map((Array.isArray(z) ? z : z ? [z] : []).map(e => {
      return [e.id, e];
    }));
    return te.flatMap(t => {
      let n = e.get(t);
      let r = Fc(n ? [n] : []);
      if (r) {
        return [{
          sourceId: t,
          url: r,
          name: Lc(n, r)
        }];
      } else {
        return [];
      }
    });
  }, [z, te]);
  let B = Z.useMemo(() => {
    if (i.sourceVideoUrl && (o.current || !ne.length)) {
      return {
        sourceId: `local-${e}`,
        url: i.sourceVideoUrl,
        name: i.sourceVideoName || Ic(i.sourceVideoUrl)
      };
    } else {
      return null;
    }
  }, [ne.length, e, i.sourceVideoName, i.sourceVideoUrl]);
  let re = Z.useMemo(() => {
    if (B) {
      return [...ne, B];
    } else {
      return ne;
    }
  }, [ne, B]);
  let V = Z.useMemo(() => {
    return Wc(i.timelineTracks, re, E);
  }, [i.timelineTracks, re, E]);
  let ie = Z.useMemo(() => {
    for (let e of V) {
      let t = e.clips.find(e => {
        return e.id === F;
      });
      if (t) {
        return {
          track: e,
          clip: t
        };
      }
    }
    return null;
  }, [F, V]);
  let ae = Z.useMemo(() => {
    return V.filter(e => {
      return e.kind === `video`;
    }).flatMap(e => {
      return [...e.clips].sort((e, t) => {
        return e.timelineStart - t.timelineStart;
      }).filter(e => {
        return e.url && e.duration > 0;
      }).map(t => {
        return {
          ...t,
          muted: !!e.muted || t.muted
        };
      });
    });
  }, [V]);
  let oe = V.find(e => {
    return e.kind === `video`;
  })?.clips[0];
  let H = ie?.clip || oe;
  let se = H?.url || re[0]?.url || ``;
  let ce = H?.name || re[0]?.name || ``;
  let U = H ? E[H.sourceId] : undefined;
  let W = U?.duration || H?.sourceEnd || 0;
  let le = Z.useCallback(t => {
    return r(e, {
      timelineTracks: t,
      sourceOrder: t.filter(e => {
        return e.kind === `video`;
      }).flatMap(e => {
        return e.clips.map(e => {
          return e.sourceId;
        });
      })
    });
  }, [e, r]);
  let G = Z.useCallback(e => {
    let t = V.map(e => {
      return {
        ...e,
        clips: e.clips.map(e => {
          return {
            ...e
          };
        })
      };
    });
    e(t);
    le(t);
  }, [le, V]);
  Z.useEffect(() => {
    return r(e, {
      mode: h,
      audioFormat: _,
      resizeWidth: y,
      resizeHeight: x,
      targetFps: C
    });
  }, [_, e, h, x, y, C, r]);
  Z.useEffect(() => {
    if (JSON.stringify(i.timelineTracks || []) !== JSON.stringify(V)) {
      le(V);
    }
  }, [i.timelineTracks, le, V]);
  Z.useEffect(() => {
    if (!F && oe) {
      I(oe.id);
    }
    if (F && !ie && oe) {
      I(oe.id);
    }
  }, [oe, F, ie]);
  Z.useEffect(() => {
    for (let t of re) {
      if (!E[t.sourceId] && !f.current.has(t.sourceId)) {
        f.current.add(t.sourceId);
        (async () => {
          try {
            let n = await Ec(o.current && t.url === s.current ? o.current : await fetch(t.url).then(e => {
              if (!e.ok) {
                throw Error(`视频读取失败 (${e.status})`);
              }
              return e.blob();
            }));
            D(i => {
              let a = {
                ...i,
                [t.sourceId]: n
              };
              r(e, {
                sourceMetadata: a,
                errorMessage: undefined
              });
              return a;
            });
          } catch (t) {
            r(e, {
              errorMessage: t instanceof Error ? t.message : `无法读取视频信息`
            });
          } finally {
            f.current.delete(t.sourceId);
          }
        })();
      }
    }
  }, [e, re, E, r]);
  Z.useEffect(() => {
    let e = Array.from(new Map(re.filter(e => {
      return E[e.sourceId]?.duration;
    }).map(e => {
      return [e.sourceId, e];
    })).values());
    let t = false;
    (async () => {
      for (let n of e) {
        if (ee[n.sourceId]) {
          continue;
        }
        let e = E[n.sourceId];
        let r = [];
        for (let i = 0; i < 6; i += 1) {
          try {
            let a = await _cmp_mc(n.url, {
              atTime: Math.max(0.05, e.duration * (i + 0.5) / 6),
              quality: 0.55,
              timeoutMs: 6000
            });
            if (t) {
              return;
            }
            let o = URL.createObjectURL(a);
            p.current.push(o);
            r.push(o);
          } catch {
            break;
          }
        }
        if (!t && r.length) {
          L(e => {
            return {
              ...e,
              [n.sourceId]: r
            };
          });
        }
      }
    })();
    return () => {
      t = true;
    };
  }, [ee, re, E]);
  Z.useEffect(() => {
    return () => {
      l.current?.abort();
      c.current?.cancel();
      if (s.current) {
        URL.revokeObjectURL(s.current);
      }
      p.current.forEach(e => {
        return URL.revokeObjectURL(e);
      });
    };
  }, []);
  let ue = Z.useCallback((e, t) => {
    return G(n => {
      let r;
      let i;
      for (let t of n) {
        let n = t.clips.findIndex(t => {
          return t.id === e;
        });
        if (n >= 0) {
          r = t.clips[n];
          i = t;
          break;
        }
      }
      Object.assign(r, t);
      r.duration = Math.max(0, r.sourceEnd - r.sourceStart);
      if (r && i && t.trackId && t.trackId !== i.id) {
        let a = n.find(e => {
          return e.id === t.trackId;
        });
        if (a) {
          i.clips = i.clips.filter(t => {
            return t.id !== e;
          });
          a.clips.push(r);
        }
      }
    });
  }, [G]);
  let de = Z.useCallback(() => {
    if (!H) {
      return;
    }
    let e = Hc(Math.max(0, Math.min(j, H.sourceEnd - 0.05)));
    ue(H.id, {
      sourceStart: e
    });
  }, [H, j, ue]);
  let fe = Z.useCallback(() => {
    if (!H) {
      return;
    }
    let e = E[H.sourceId]?.duration || H.sourceEnd;
    let t = Hc(Math.min(e, Math.max(j, H.sourceStart + 0.05)));
    ue(H.id, {
      sourceEnd: t
    });
  }, [H, j, E, ue]);
  let pe = Z.useCallback(() => {
    if (!H || j <= H.sourceStart + 0.01 || j >= H.sourceEnd - 0.01) {
      return;
    }
    let e = Hc(j);
    G(t => {
      let n = t.find(e => {
        return e.clips.some(e => {
          return e.id === H.id;
        });
      });
      if (!n) {
        return;
      }
      let r = n.clips.findIndex(e => {
        return e.id === H.id;
      });
      let i = n.clips[r];
      let a = {
        ...i,
        sourceEnd: e,
        duration: e - i.sourceStart
      };
      let o = {
        ...i,
        id: Uc(`clip`),
        sourceStart: e,
        duration: i.sourceEnd - e
      };
      n.clips.splice(r, 1, a, o);
      I(o.id);
    });
  }, [H, j, G]);
  let me = Z.useCallback(() => {
    if (ie) {
      G(e => {
        let t = e.find(e => {
          return e.id === ie.track.id;
        });
        if (t) {
          t.clips = t.clips.filter(e => {
            return e.id !== ie.clip.id;
          });
        }
      });
      I(``);
    }
  }, [G, ie]);
  Z.useEffect(() => {
    if (h !== `trim` && h !== `concat`) {
      return;
    }
    let e = e => {
      if (!e.target?.matches(`input, textarea, select`)) {
        if (e.key === `[`) {
          e.preventDefault();
          de();
        } else if (e.key === `]`) {
          e.preventDefault();
          fe();
        } else if (e.key.toLowerCase() === `s` && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          pe();
        } else if (e.key === `Delete` || e.key === `Backspace`) {
          e.preventDefault();
          me();
        }
      }
    };
    window.addEventListener(`keydown`, e);
    return () => {
      return window.removeEventListener(`keydown`, e);
    };
  }, [me, h, de, fe, pe]);
  let he = Math.max(0.08, W * 0.012);
  let ge = Z.useCallback((e, t) => {
    let n = t.reduce((t, n) => {
      let r = Math.abs(n - e);
      if (!t || r < t.distance) {
        return {
          value: n,
          distance: r
        };
      } else {
        return t;
      }
    }, null);
    if (n && n.distance <= he) {
      return n.value;
    } else {
      return e;
    }
  }, [he]);
  let _e = e => {
    let t = H ? [H.sourceStart, H.sourceEnd] : [];
    let n = Math.max(0, Math.min(W, ge(e, t)));
    M(n);
    if (u.current && u.current.src === se) {
      u.current.currentTime = n;
    }
  };
  let ve = e => {
    let t = e.currentTarget.getBoundingClientRect();
    _e((e.clientX - t.left) / t.width * W);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  let ye = (e, t) => {
    e.preventDefault();
    e.stopPropagation();
    let n = H;
    let r = d.current?.getBoundingClientRect();
    if (!r || !n || !W) {
      return;
    }
    let i = e => {
      let i = Hc(ge(Math.max(0, Math.min(W, (e.clientX - r.left) / r.width * W)), [j]));
      if (t === `start`) {
        ue(n.id, {
          sourceStart: Math.min(i, n.sourceEnd - 0.05)
        });
      } else {
        ue(n.id, {
          sourceEnd: Math.max(i, n.sourceStart + 0.05)
        });
      }
    };
    let a = () => {
      window.removeEventListener(`pointermove`, i);
      window.removeEventListener(`pointerup`, a);
      window.removeEventListener(`pointercancel`, a);
    };
    i(e.nativeEvent);
    window.addEventListener(`pointermove`, i);
    window.addEventListener(`pointerup`, a, {
      once: true
    });
    window.addEventListener(`pointercancel`, a, {
      once: true
    });
  };
  let be = (e, t) => {
    e.preventDefault();
    e.stopPropagation();
    let n = V.flatMap(e => {
      return e.clips;
    }).find(e => {
      return e.id === t;
    });
    if (!n) {
      return;
    }
    let r = e.clientX;
    let i = n.timelineStart;
    let a = e => {
      let a = (e.clientX - r) / Pc;
      let o = Math.max(0, i + a);
      let s = [0, j, ...V.flatMap(e => {
        return e.clips.filter(e => {
          return e.id !== t;
        }).flatMap(e => {
          return [e.timelineStart, e.timelineStart + e.duration];
        });
      })];
      let c = ge(o, s);
      let l = ge(o + n.duration, s);
      if (Math.abs(c - o) <= Math.abs(l - (o + n.duration))) {
        o = c;
      } else {
        o = l - n.duration;
      }
      let u = document.elementsFromPoint(e.clientX, e.clientY).find(e => {
        return e.getAttribute(`data-track-id`);
      });
      let d = u ? u.getAttribute(`data-track-id`) : undefined;
      ue(t, {
        timelineStart: Hc(Math.max(0, o)),
        ...(d ? {
          trackId: d
        } : {})
      });
    };
    let o = () => {
      window.removeEventListener(`pointermove`, a);
      window.removeEventListener(`pointerup`, o);
      window.removeEventListener(`pointercancel`, o);
    };
    window.addEventListener(`pointermove`, a);
    window.addEventListener(`pointerup`, o, {
      once: true
    });
    window.addEventListener(`pointercancel`, o, {
      once: true
    });
  };
  let xe = () => {
    if (u.current) {
      if (u.current.paused) {
        u.current.play();
      } else {
        u.current.pause();
      }
    }
  };
  let Se = () => {
    return le([...V, {
      id: Uc(`video-track`),
      name: `视频 ${V.filter(e => {
        return e.kind === `video`;
      }).length + 1}`,
      kind: `video`,
      clips: []
    }]);
  };
  let Ce = t => {
    let n = t.target.files?.[0];
    if (!n) {
      return;
    }
    if (s.current) {
      URL.revokeObjectURL(s.current);
    }
    let i = URL.createObjectURL(n);
    o.current = n;
    s.current = i;
    r(e, {
      sourceVideoUrl: i,
      sourceVideoName: n.name,
      errorMessage: undefined
    });
    t.target.value = ``;
  };
  let we = Z.useCallback(t => {
    r(e, {
      loading: false,
      errorMessage: t
    });
    i.onShowToast?.(t);
  }, [e, i, r]);
  let Te = Z.useCallback(async () => {
    let t = h === `concat`;
    let n = h === `trim` ? ae.filter(e => {
      return e.sourceId === H?.sourceId;
    }) : ae;
    if (h === `concat` && n.length < 2 || h === `trim` && !n.length) {
      we(h === `concat` ? `视频拼接至少需要 2 个可见视频片段` : `时间线中没有可导出的片段`);
      return;
    }
    if (h !== `concat` && h !== `trim` && !se) {
      we(`请先上传视频或连接包含视频的节点`);
      return;
    }
    if (h === `sizeFrameRate` && (y <= 0 || x <= 0 || C <= 0)) {
      we(`宽度、高度和帧率必须为正数`);
      return;
    }
    let a = Vc(y);
    let u = Vc(x);
    let d = new bc();
    let f = new AbortController();
    c.current = d;
    l.current = f;
    r(e, {
      loading: true,
      progress: 0,
      errorMessage: undefined,
      videoUrl: undefined,
      audioUrl: undefined
    });
    try {
      let c;
      if (t) {
        let t = [];
        for (let i = 0; i < n.length; i += 1) {
          let a = n[i];
          let c = o.current && a.url === s.current ? o.current : await fetch(a.url, {
            signal: f.signal
          }).then(e => {
            if (!e.ok) {
              throw Error(`第 ${i + 1} 个片段下载失败 (${e.status})`);
            }
            return e.blob();
          });
          t.push(c);
          r(e, {
            progress: Math.round((i + 1) / n.length * 20)
          });
        }
        c = await Oc(t, {
          segments: n.map(e => {
            return {
              start: e.sourceStart,
              end: e.sourceEnd,
              muted: e.muted
            };
          }),
          controller: d,
          onProgress: t => {
            return r(e, {
              progress: 20 + Math.round(t * 80)
            });
          }
        });
      } else {
        let t = h === `trim` ? n[0] : undefined;
        let i = o.current && se === s.current ? o.current : await fetch(se, {
          signal: f.signal
        }).then(e => {
          if (!e.ok) {
            throw Error(`视频下载失败 (${e.status})`);
          }
          return e.blob();
        });
        let l;
        let p = {
          controller: d,
          onProgress: t => {
            return r(e, {
              progress: Math.round(t * 100)
            });
          }
        };
        if (h === `trim`) {
          l = {
            mode: h,
            start: t.sourceStart,
            end: t.sourceEnd,
            ...p
          };
        } else {
          if (h === `extractAudio`) {
            l = {
              mode: h,
              format: _,
              ...p
            };
          } else {
            l = {
              mode: h,
              width: a,
              height: u,
              fps: C,
              ...p
            };
          }
        }
        c = await Dc(i, l);
      }
      let l = await hi(c.blob, {
        subfolder: `canvas/video-process`
      });
      let p = n.length;
      let m = h === `trim` ? p > 1 ? `trimmed_${p}_clips` : `trimmed` : h === `extractAudio` ? `audio` : h === `sizeFrameRate` ? `${a}x${u}_${C}fps` : `merged_${p}_clips`;
      let g = `${zc(ce || `video`)}_${m}.${c.extension}`;
      r(e, {
        loading: false,
        progress: 100,
        errorMessage: undefined,
        videoUrl: undefined,
        audioUrl: undefined,
        outputName: g,
        outputInfo: {
          duration: c.metadata.duration,
          width: h === `extractAudio` ? undefined : c.metadata.width,
          height: h === `extractAudio` ? undefined : c.metadata.height,
          fps: h === `extractAudio` ? undefined : c.metadata.fps,
          size: c.blob.size
        }
      });
      if (h === `extractAudio`) {
        i.onSpawnAudioNode?.(e, l.url, g);
      } else {
        i.onSpawnImageNode?.(e, l.url, g);
      }
      i.onShowToast?.(h === `extractAudio` ? `音频提取完成` : h === `concat` ? `视频拼接完成` : `视频处理完成`);
    } catch (t) {
      if (t instanceof yc || f.signal.aborted || d.isCanceled) {
        r(e, {
          loading: false,
          progress: 0,
          errorMessage: undefined
        });
      } else {
        we(t instanceof Error ? t.message : `视频处理失败`);
      }
    } finally {
      if (c.current === d) {
        c.current = null;
      }
      if (l.current === f) {
        l.current = null;
      }
    }
  }, [H?.sourceId, _, ae, e, h, i, x, y, we, ce, se, C, r]);
  let Ee = !!i.loading;
  let De = `nodrag nowheel w-full h-8 bg-[#222] border border-[#3a3a3a] rounded-md px-2 text-[11px] text-gray-200 outline-none focus:border-[#777]`;
  let K = `nodrag h-8 px-2 rounded-md border border-[#3a3a3a] bg-[#252525] text-[10px] text-gray-300 hover:bg-[#303030] transition-colors disabled:opacity-35 disabled:cursor-not-allowed`;
  let Oe = `nodrag h-7 min-w-7 px-1.5 rounded border border-[#3b3b3b] bg-[#272727] text-gray-400 flex items-center justify-center hover:text-white disabled:opacity-30`;
  let ke = W ? j / W * 100 : 0;
  let Ae = W && H ? H.sourceStart / W * 100 : 0;
  let je = W && H ? H.sourceEnd / W * 100 : 100;
  let q = h === `concat` ? ae.length >= 2 : h === `trim` ? ae.length > 0 : !!se;
  let Me = Z.useMemo(() => {
    let e = 0;
    for (let t of V) {
      for (let n of t.clips) {
        let t = n.timelineStart + n.duration;
        if (t > e) {
          e = t;
        }
      }
    }
    return e;
  }, [V]);
  let Ne = Z.useRef(null);
  let Pe = e => {
    let t = e.currentTarget.scrollLeft;
    if (Ne.current) {
      Ne.current.querySelectorAll(`.timeline-container`).forEach(n => {
        if (n !== e.currentTarget) {
          n.scrollLeft = t;
        }
      });
    }
  };
  let Fe = Math.max(100, Me * Pc + 100);
  let Ie = j * Pc;
  let Le = Z.useCallback(e => {
    if (!u.current) {
      return;
    }
    let t = e.currentTarget.getBoundingClientRect();
    let n = Math.max(0, e.clientX - t.left) / Pc;
    for (let e of V) {
      if (e.kind !== `video`) {
        continue;
      }
      let t = e.clips.find(e => {
        return n >= e.timelineStart && n <= e.timelineStart + e.duration;
      });
      if (t) {
        if (F !== t.id) {
          I(t.id);
          let e = t.sourceStart + (n - t.timelineStart);
          if (u.current.src !== t.url) {
            u.current.src = t.url;
            let n = () => {
              if (u.current) {
                u.current.currentTime = e;
                u.current.removeEventListener(`loadedmetadata`, n);
              }
            };
            u.current.addEventListener(`loadedmetadata`, n);
          } else {
            u.current.currentTime = e;
          }
        } else {
          u.current.currentTime = t.sourceStart + (n - t.timelineStart);
        }
        M(n);
        return;
      }
    }
    M(n);
  }, [V, F]);
  let Re = e => {
    let t = ee[e.sourceId] || [];
    let n = e.duration * Pc;
    const Component1500 = `img`;
    const Component1501 = `div`;
    const Component1502 = `div`;
    const Component1503 = `span`;
    const Component1504 = `span`;
    const Component1505 = `div`;
    const Component1506 = `div`;
    const Component1507 = `div`;
    return <Component1507 className={`absolute top-1 h-12 z-10`} style={{
      left: e.timelineStart * Pc,
      width: n
    }} onPointerDown={t => {
      t.stopPropagation();
      I(e.id);
      be(t, e.id);
    }} key={e.id}>
        <Component1506 onDoubleClick={() => {
        A(e.id);
        I(e.id);
      }} className={`nodrag relative w-full h-full overflow-hidden border cursor-grab active:cursor-grabbing ${F === e.id ? `border-white z-10` : `border-[#505050]`}`}>
          <Component1502 className={`absolute inset-0 flex`}>
            {(t.length ? t : [undefined, undefined, undefined]).map((e, t) => {
            if (e) {
              return <Component1500 src={e} draggable={false} onDragStart={e => {
                return e.preventDefault();
              }} className={`h-full min-w-0 flex-1 object-cover pointer-events-none select-none`} key={e} />;
            } else {
              return <Component1501 className={`flex-1 bg-[#383838]`} key={t} />;
            }
          })}
          </Component1502>
          <Component1505 className={`absolute inset-x-0 bottom-0 h-5 px-1 flex items-center gap-1 bg-black/70 text-[9px] text-white`}>
            <Component1503 className={`truncate`}>{e.name}</Component1503>
            <Component1504 className={`ml-auto shrink-0 tabular-nums`}>
              {e.duration.toFixed(1)}
              {`s`}
            </Component1504>
          </Component1505>
        </Component1506>
      </Component1507>;
  };
  const Component1508 = `img`;
  const Component1509 = `div`;
  const Component1510 = `div`;
  const Component1511 = `div`;
  const Component1512 = `div`;
  const Component1513 = `span`;
  const Component1514 = `button`;
  const Component1515 = `span`;
  const Component1516 = `button`;
  const Component1517 = `span`;
  const Component1518 = `div`;
  const Component1519 = `div`;
  const Component1520 = `span`;
  const Component1521 = `span`;
  const Component1522 = `span`;
  const Component1523 = `div`;
  const Component1524 = `div`;
  let ze = H && <Component1524 className={`p-2`}>
      <Component1519 ref={d} className={`relative h-16 overflow-hidden bg-[#303030] cursor-crosshair touch-none select-none`} onPointerDown={ve} onPointerMove={e => {
      if (e.buttons === 1) {
        ve(e);
      }
    }}>
        <Component1509 className={`absolute inset-0 flex`}>
          {(ee[H.sourceId] || []).map(e => {
          return <Component1508 src={e} draggable={false} onDragStart={e => {
            return e.preventDefault();
          }} className={`min-w-0 flex-1 object-cover pointer-events-none select-none`} key={e} />;
        })}
        </Component1509>
        <Component1510 className={`absolute inset-y-0 left-0 bg-black/65 pointer-events-none`} style={{
        width: `${Ae}%`
      }} />
        <Component1511 className={`absolute inset-y-0 right-0 bg-black/65 pointer-events-none`} style={{
        width: `${100 - je}%`
      }} />
        <Component1512 className={`absolute inset-y-0 border-y-2 border-white/90 pointer-events-none`} style={{
        left: `${Ae}%`,
        width: `${Math.max(0, je - Ae)}%`
      }} />
        <Component1514 type={`button`} aria-label={`拖动入点`} title={`拖动片段头部设置入点；靠近播放头时自动吸附`} onPointerDown={e => {
        return ye(e, `start`);
      }} className={`nodrag absolute inset-y-0 z-20 w-3 -translate-x-1/2 cursor-ew-resize bg-white hover:bg-blue-300 border-x border-black/40`} style={{
        left: `${Ae}%`
      }}>
          <Component1513 className={`absolute top-1/2 left-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-black/60`} />
        </Component1514>
        <Component1516 type={`button`} aria-label={`拖动出点`} title={`拖动片段尾部设置出点；靠近播放头时自动吸附`} onPointerDown={e => {
        return ye(e, `end`);
      }} className={`nodrag absolute inset-y-0 z-20 w-3 -translate-x-1/2 cursor-ew-resize bg-white hover:bg-blue-300 border-x border-black/40`} style={{
        left: `${je}%`
      }}>
          <Component1515 className={`absolute top-1/2 left-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-black/60`} />
        </Component1516>
        <Component1518 className={`absolute inset-y-0 z-10 w-px bg-red-400 pointer-events-none`} style={{
        left: `${ke}%`
      }}>
          <Component1517 className={`absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-red-400`} />
        </Component1518>
      </Component1519>
      <Component1523 className={`mt-1 flex justify-between text-[9px] text-gray-500 tabular-nums`}>
        <Component1520>
          {`入点 `}
          {H.sourceStart.toFixed(2)}
          {`s`}
        </Component1520>
        <Component1521>
          {`片段 `}
          {H.duration.toFixed(2)}
          {`s`}
        </Component1521>
        <Component1522>
          {`出点 `}
          {H.sourceEnd.toFixed(2)}
          {`s`}
        </Component1522>
      </Component1523>
    </Component1524>;
  const Component1525 = `input`;
  const Component1526 = `button`;
  const Component1527 = `div`;
  const Component1528 = `video`;
  const Component1529 = `button`;
  const Component1530 = `div`;
  const Component1531 = `span`;
  const Component1532 = `button`;
  const Component1533 = `span`;
  const Component1534 = `span`;
  const Component1535 = `div`;
  const Component1536 = `button`;
  const Component1537 = `button`;
  const Component1538 = `button`;
  const Component1539 = `button`;
  const Component1540 = `button`;
  const Component1541 = `span`;
  const Component1542 = `div`;
  const Component1543 = `span`;
  const Component1544 = `div`;
  const Component1545 = `span`;
  const Component1546 = `button`;
  const Component1547 = `div`;
  const Component1548 = `div`;
  const Component1549 = `div`;
  const Component1550 = `div`;
  const Component1551 = `div`;
  const Component1552 = `div`;
  const Component1553 = `button`;
  const Component1554 = `div`;
  const Component1555 = `div`;
  const Component1556 = `span`;
  const Component1557 = `span`;
  const Component1558 = `button`;
  const Component1559 = `div`;
  const Component1560 = `div`;
  const Component1561 = `span`;
  const Component1562 = `span`;
  const Component1563 = `button`;
  const Component1564 = `div`;
  const Component1565 = `button`;
  const Component1566 = `div`;
  const Component1567 = `input`;
  const Component1568 = `label`;
  const Component1569 = `input`;
  const Component1570 = `label`;
  const Component1571 = `div`;
  const Component1572 = `button`;
  const Component1573 = `div`;
  const Component1574 = `div`;
  const Component1575 = `span`;
  const Component1576 = `div`;
  const Component1577 = `button`;
  const Component1578 = `button`;
  const Component1579 = `div`;
  const Component1580 = `div`;
  const Component1581 = `span`;
  const Component1582 = `button`;
  const Component1583 = `div`;
  const Component1584 = `video`;
  const Component1585 = `div`;
  const Component1586 = `button`;
  const Component1587 = `button`;
  const Component1588 = `button`;
  const Component1589 = `button`;
  const Component1590 = `span`;
  const Component1591 = `div`;
  const Component1592 = `div`;
  const Component1593 = `button`;
  const Component1594 = `div`;
  const Component1595 = `div`;
  const Component1596 = `div`;
  const Component1597 = `div`;
  return <Component1597 className={`relative group/node w-full h-full min-w-[520px] min-h-[620px]`}>
      <_cmp__Component8 id={e} data={t} defaultTitle={`视频处理`} icon={<_Component49 size={11} className={`text-gray-500`} />} floating={true} />
      <_cmp__Component9 visible={!!n} minWidth={520} minHeight={620} />
      <Component1596 className={`w-full h-full bg-[#1b1b1b] rounded-lg overflow-hidden border shadow-xl flex flex-col drag-handle cursor-move ${n ? `border-[#666]` : `border-[#343434] hover:border-[#484848]`}`}>
        <_cmp__Component12 type={`target`} position={X.Left} />
        <Component1525 ref={a} type={`file`} accept={`video/*`} className={`hidden`} onChange={Ce} />
        <Component1580 className={`flex-1 min-h-0 p-3 flex flex-col gap-3 overflow-y-auto custom-scrollbar nowheel`}>
          <Component1527 className={`grid grid-cols-4 gap-1.5`}>
            {kc.map(e => {
            return <Component1526 onClick={() => {
              return g(e.value);
            }} disabled={Ee} className={`nodrag h-8 rounded-md border text-[11px] ${h === e.value ? `bg-[#ededed] text-[#161616] border-[#ededed]` : `bg-[#242424] text-gray-400 border-[#3a3a3a] hover:text-white`}`} key={e.value}>
                  {e.label}
                </Component1526>;
          })}
          </Component1527>
          {se ? <Component1530 className={`relative bg-black rounded-md overflow-hidden border border-[#303030]`}>
              <Component1528 ref={u} src={se} controls={h !== `trim` && h !== `concat`} playsInline={true} preload={`metadata`} onTimeUpdate={e => {
            if (!m.current) {
              if (h === `concat`) {
                if (N && H) {
                  M(H.timelineStart + Math.max(0, e.currentTarget.currentTime - H.sourceStart));
                }
              } else {
                M(e.currentTarget.currentTime);
              }
            }
          }} onPlay={() => {
            return P(true);
          }} onPause={() => {
            return P(false);
          }} className={`nodrag nowheel w-full aspect-video object-contain`} />
              {h !== `concat` && <Component1529 onClick={() => {
            return a.current?.click();
          }} title={`替换视频`} className={`nodrag absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded bg-black/75 text-gray-200`}>
                  <_Component0 size={13} />
                </Component1529>}
            </Component1530> : <Component1532 onClick={() => {
          return a.current?.click();
        }} className={`nodrag aspect-video rounded-md border border-dashed border-[#3a3a3a] flex items-center justify-center gap-2 text-gray-500 hover:text-gray-200`}>
              <_Component0 size={18} />
              <Component1531 className={`text-[11px]`}>{`上传视频或连接视频节点`}</Component1531>
            </Component1532>}
          {se && <Component1535 className={`flex justify-between gap-2 text-[10px] text-gray-500`}>
              <Component1533 className={`truncate`}>{ce}</Component1533>
              <Component1534 className={`shrink-0 tabular-nums`}>
                {U ? `${Bc(U.duration)} · ${U.width}×${U.height} · ${U.fps.toFixed(2)} fps` : `读取信息中...`}
              </Component1534>
            </Component1535>}
          {(h === `trim` || h === `concat`) && <Component1560 className={`nodrag nowheel rounded-md border border-[#333] bg-[#202020] overflow-hidden flex flex-col min-h-0 shrink-0`}>
              <Component1542 className={`h-9 px-2 flex shrink-0 items-center gap-1 border-b border-[#333]`}>
                <Component1536 className={Oe} title={N ? `暂停` : `播放`} onClick={xe} disabled={!se}>
                  {N ? <Xe size={13} /> : <_Component43 size={13} />}
                </Component1536>
                <Component1537 className={Oe} title={`在播放头设置入点 ([)`} onClick={de} disabled={!H}>{`[`}</Component1537>
                <Component1538 className={Oe} title={`在播放头设置出点 (])`} onClick={fe} disabled={!H}>{`]`}</Component1538>
                <Component1539 className={Oe} title={`在播放头分割 (S)`} onClick={pe} disabled={!H}>
                  <O size={13} />
                </Component1539>
                <Component1540 className={Oe} title={`删除选中片段 (Delete)`} onClick={me} disabled={!ie}>
                  <Ot size={13} />
                </Component1540>
                <Component1541 className={`ml-auto text-[10px] text-gray-400 tabular-nums`}>
                  {j.toFixed(2)}
                  {`s`}
                </Component1541>
              </Component1542>
              {h === `trim` && ze}
              {h === `concat` && <Component1555 ref={Ne} className={`max-h-72 overflow-y-auto overflow-x-hidden custom-scrollbar p-1.5 space-y-1 relative`}>
                  <Component1544 className={`absolute top-1.5 bottom-0 z-20 w-px bg-red-400 pointer-events-none transition-transform duration-75`} style={{
              transform: `translateX(${Ie}px)`,
              left: `102px`
            }}>
                    <Component1543 className={`absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-red-400`} />
                  </Component1544>
                  {V.map(e => {
              return <Component1551 data-track-id={e.id} className={`flex min-h-16 border border-[#303030] bg-[#242424] relative`} key={e.id}>
                        <Component1548 className={`w-24 shrink-0 p-1.5 border-r border-[#333] flex flex-col gap-1 text-[9px] text-gray-400 z-30 bg-[#242424]`}>
                          <Component1547 className={`flex items-center gap-1`}>
                            <Component1545 className={`truncate`} title={e.name}>
                              {e.name}
                            </Component1545>
                            <Component1546 className={`ml-auto`} title={`轨道静音`} onClick={() => {
                      return G(t => {
                        let n = t.find(t => {
                          return t.id === e.id;
                        });
                        if (n) {
                          n.muted = !n.muted;
                        }
                      });
                    }}>
                              {e.muted ? <_Component44 size={11} /> : <Dn size={11} />}
                            </Component1546>
                          </Component1547>
                        </Component1548>
                        <Component1550 className={`flex-1 min-w-0 overflow-x-auto overflow-y-hidden timeline-container custom-scrollbar pb-1`} onScroll={Pe}>
                          <Component1549 className={`relative h-14 min-w-full cursor-crosshair`} style={{
                    width: Fe
                  }} onPointerDown={e => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    m.current = true;
                    Le(e);
                  }} onPointerMove={e => {
                    if (m.current) {
                      Le(e);
                    }
                  }} onPointerUp={e => {
                    m.current = false;
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }} onPointerCancel={() => {
                    m.current = false;
                  }}>
                            {e.clips.map(e => {
                      return Re(e);
                    })}
                          </Component1549>
                        </Component1550>
                      </Component1551>;
            })}
                  <Component1554 className={`flex items-center justify-between px-1 mt-2`}>
                    <Component1552 className={`text-[9px] text-gray-500`}>{`导出顺序：视频轨从上到下，片段从左到右`}</Component1552>
                    <Component1553 className={`flex items-center gap-1 text-[10px] text-gray-400 hover:text-white px-2 py-1 rounded bg-[#2a2a2a] border border-[#3a3a3a] hover:bg-[#3a3a3a] transition-colors`} onClick={Se}>
                      <Xt size={11} />
                      {`新增轨道`}
                    </Component1553>
                  </Component1554>
                </Component1555>}
              {ie && <Component1559 className={`h-9 px-2 border-t border-[#333] flex items-center gap-2 text-[9px] text-gray-400`}>
                  <Component1556 className={`truncate max-w-32`}>{ie.clip.name}</Component1556>
                  <Component1557 className={`tabular-nums`}>
                    {ie.clip.sourceStart.toFixed(2)}
                    {` - `}
                    {ie.clip.sourceEnd.toFixed(2)}
                    {`s`}
                  </Component1557>
                  <Component1558 className={`ml-auto`} title={`片段静音`} onClick={() => {
              return ue(ie.clip.id, {
                muted: !ie.clip.muted
              });
            }}>
                    {ie.clip.muted ? <_Component50 size={12} /> : <Be size={12} />}
                  </Component1558>
                </Component1559>}
            </Component1560>}
          {h === `extractAudio` && <Component1564 className={`grid grid-cols-3 gap-2`}>
              {Ac.map(e => {
            return <Component1563 onClick={() => {
              return v(e.value);
            }} className={`nodrag h-11 rounded-md border flex flex-col items-center justify-center ${_ === e.value ? `border-[#ededed] bg-[#ededed] text-[#171717]` : `border-[#3a3a3a] bg-[#252525] text-gray-300`}`} key={e.value}>
                    <Component1561 className={`text-[11px]`}>{e.label}</Component1561>
                    <Component1562 className={`text-[9px] opacity-60`}>{e.hint}</Component1562>
                  </Component1563>;
          })}
            </Component1564>}
          {h === `sizeFrameRate` && <Component1574 className={`flex flex-col gap-3`}>
              <Component1566 className={`grid grid-cols-3 gap-2`}>
                {jc.map(e => {
              return <Component1565 onClick={() => {
                b(e.width);
                S(e.height);
              }} className={K} key={e.label}>
                      {e.label}
                    </Component1565>;
            })}
              </Component1566>
              <Component1571 className={`grid grid-cols-2 gap-2`}>
                <Component1568 className={`text-[10px] text-gray-500`}>
                  {`宽度`}
                  <Component1567 type={`number`} min={2} step={2} value={y} onChange={e => {
                return b(Number(e.target.value));
              }} className={`${De} mt-1`} />
                </Component1568>
                <Component1570 className={`text-[10px] text-gray-500`}>
                  {`高度`}
                  <Component1569 type={`number`} min={2} step={2} value={x} onChange={e => {
                return S(Number(e.target.value));
              }} className={`${De} mt-1`} />
                </Component1570>
              </Component1571>
              <Component1573 className={`grid grid-cols-4 gap-2`}>
                {Mc.map(e => {
              return <Component1572 onClick={() => {
                return w(e);
              }} className={`${K} ${C === e ? `border-[#ddd] text-white` : ``}`} key={e}>
                      {e}
                      {` fps`}
                    </Component1572>;
            })}
              </Component1573>
            </Component1574>}
          {i.errorMessage && <Component1576 className={`flex items-start gap-1.5 text-[11px] text-red-400`}>
              <_Component17 size={13} className={`shrink-0 mt-0.5`} />
              <Component1575>{i.errorMessage}</Component1575>
            </Component1576>}
          <Component1579 className={`mt-auto pt-2 flex gap-2 sticky bottom-0 bg-[#1b1b1b]`}>
            <Component1577 onClick={Te} disabled={!q || Ee} className={`nodrag flex-1 h-9 rounded-md bg-[#ededed] text-[#161616] text-[12px] font-medium flex items-center justify-center gap-1.5 disabled:opacity-40`}>
              {Ee ? <Q.Fragment>
                  <_n size={13} className={`animate-spin`} />
                  {`处理中 `}
                  {i.progress || 0}
                  {`%`}
                </Q.Fragment> : <Q.Fragment>
                  <_Component43 size={13} />
                  {h === `concat` ? `按时间线拼接` : `开始处理`}
                </Q.Fragment>}
            </Component1577>
            {Ee && <Component1578 onClick={() => {
            l.current?.abort();
            c.current?.cancel();
          }} title={`取消处理`} className={`nodrag h-9 w-9 rounded-md border border-[#444] bg-[#292929] text-gray-300 flex items-center justify-center`}>
                <T size={12} />
              </Component1578>}
          </Component1579>
        </Component1580>
        <_cmp__Component12 type={`source`} position={X.Right} id={`main-output`} />
        {k && H && <Component1595 className={`absolute inset-0 z-50 bg-[#1b1b1b]/95 backdrop-blur-sm flex flex-col p-3 nodrag nowheel rounded-lg`}>
            <Component1583 className={`flex items-center justify-between mb-3 text-white`}>
              <Component1581 className={`text-sm font-medium`}>{`编辑片段截取`}</Component1581>
              <Component1582 onClick={() => {
            return A(null);
          }} className={`text-gray-400 hover:text-white`}>
                <Gt size={16} />
              </Component1582>
            </Component1583>
            <Component1594 className={`flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto custom-scrollbar`}>
              <Component1585 className={`relative bg-black rounded-md overflow-hidden border border-[#303030]`}>
                <Component1584 ref={u} src={H.url} playsInline={true} preload={`metadata`} onTimeUpdate={e => {
              return M(e.currentTarget.currentTime);
            }} onPlay={() => {
              return P(true);
            }} onPause={() => {
              return P(false);
            }} className={`nodrag nowheel w-full aspect-video object-contain`} />
              </Component1585>
              <Component1592 className={`nodrag nowheel rounded-md border border-[#333] bg-[#202020] overflow-hidden flex flex-col shrink-0`}>
                <Component1591 className={`h-9 px-2 flex shrink-0 items-center gap-1 border-b border-[#333]`}>
                  <Component1586 className={Oe} title={N ? `暂停` : `播放`} onClick={xe}>
                    {N ? <Xe size={13} /> : <_Component43 size={13} />}
                  </Component1586>
                  <Component1587 className={Oe} title={`在播放头设置入点 ([)`} onClick={de}>{`[`}</Component1587>
                  <Component1588 className={Oe} title={`在播放头设置出点 (])`} onClick={fe}>{`]`}</Component1588>
                  <Component1589 className={Oe} title={`在播放头分割 (S)`} onClick={pe}>
                    <O size={13} />
                  </Component1589>
                  <Component1590 className={`ml-auto text-[10px] text-gray-400 tabular-nums`}>
                    {j.toFixed(2)}
                    {`s`}
                  </Component1590>
                </Component1591>
                {ze}
              </Component1592>
              <Component1593 onClick={() => {
            return A(null);
          }} className={`mt-auto shrink-0 h-9 w-full rounded-md bg-[#ededed] text-[#161616] text-[12px] font-medium`}>{`完成截取`}</Component1593>
            </Component1594>
          </Component1595>}
      </Component1596>
    </Component1597>;
});
export default Gc;