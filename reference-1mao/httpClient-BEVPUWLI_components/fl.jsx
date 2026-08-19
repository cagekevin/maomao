// TODO(全局, 无需 import): data, selected, updateNodeData, i, handleType, z, n, r, sourceId, url, name, o, track, clip, muted, ae, timelineTracks, sourceOrder, clips, mode, audioFormat, resizeWidth, resizeHeight, x, targetFps, f, s, sourceMetadata, errorMessage, atTime, quality, timeoutMs, p, ee, l, le, sourceStart, sourceEnd, duration, de, fe, me, value, distance, u, oe, once, timelineStart, trackId, kind, sourceVideoUrl, sourceVideoName, loading, progress, videoUrl, audioUrl, signal, segments, start, end, controller, onProgress, format, width, height, fps, subfolder, se, m, outputName, g, outputInfo, size, q, left, ve, je, ye, ke, xe, transform, v, b, k
import _cmp_Ti from './Ti.jsx';
import _cmp_Ei from './Ei.jsx';
import _cmp__Component10 from './_Component10.jsx';
import _cmp_Fc from './Fc.jsx';
import { id, We, al, Lt, R, Qt, te, nl, il, ne, rl, B, dl, re, E, V, F, H, U, W, ce, h, _, y, C, I, qc, D, a, L, ll, j, ue, ul, pe, G, he, ge, M, _e, d, tl, ie, we, cl, Vc, Yc, Jc, xi, ol, Bc, Ne, be, A, Ae, K, X, Ce, Xc, Ee, N, P, sl, Re, J, Pe, Fe, Ie, Le, Se, Zc, Qc, S, Oe, De, $c, w, Te, _Component48, _Component8, Xe, _Component42, O, Ot, _Component43, Dn, Xt, _Component49, _Component36, _Component16, _n, T, Gt } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
var fl = Z.memo(({
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
    return al(i.mode);
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
  let [L, ee] = Z.useState({});
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
      let r = nl(n ? [n] : []);
      if (r) {
        return [{
          sourceId: t,
          url: r,
          name: il(n, r)
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
        name: i.sourceVideoName || rl(i.sourceVideoUrl)
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
    return dl(i.timelineTracks, re, E);
  }, [i.timelineTracks, re, E]);
  let H = Z.useMemo(() => {
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
  let ie = Z.useMemo(() => {
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
  let ae = V.find(e => {
    return e.kind === `video`;
  })?.clips[0];
  let U = H?.clip || ae;
  let oe = U?.url || re[0]?.url || ``;
  let se = U?.name || re[0]?.name || ``;
  let W = U ? E[U.sourceId] : undefined;
  let G = W?.duration || U?.sourceEnd || 0;
  let ce = Z.useCallback(t => {
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
  let le = Z.useCallback(e => {
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
    ce(t);
  }, [ce, V]);
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
      ce(V);
    }
  }, [i.timelineTracks, ce, V]);
  Z.useEffect(() => {
    if (!F && ae) {
      I(ae.id);
    }
    if (F && !H && ae) {
      I(ae.id);
    }
  }, [ae, F, H]);
  Z.useEffect(() => {
    for (let t of re) {
      if (!E[t.sourceId] && !f.current.has(t.sourceId)) {
        f.current.add(t.sourceId);
        (async () => {
          try {
            let n = await qc(o.current && t.url === s.current ? o.current : await fetch(t.url).then(e => {
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
        if (L[n.sourceId]) {
          continue;
        }
        let e = E[n.sourceId];
        let r = [];
        for (let i = 0; i < 6; i += 1) {
          try {
            let a = await _cmp_Fc(n.url, {
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
          ee(e => {
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
  }, [L, re, E]);
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
    return le(n => {
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
  }, [le]);
  let de = Z.useCallback(() => {
    if (!U) {
      return;
    }
    let e = ll(Math.max(0, Math.min(j, U.sourceEnd - 0.05)));
    ue(U.id, {
      sourceStart: e
    });
  }, [U, j, ue]);
  let fe = Z.useCallback(() => {
    if (!U) {
      return;
    }
    let e = E[U.sourceId]?.duration || U.sourceEnd;
    let t = ll(Math.min(e, Math.max(j, U.sourceStart + 0.05)));
    ue(U.id, {
      sourceEnd: t
    });
  }, [U, j, E, ue]);
  let pe = Z.useCallback(() => {
    if (!U || j <= U.sourceStart + 0.01 || j >= U.sourceEnd - 0.01) {
      return;
    }
    let e = ll(j);
    le(t => {
      let n = t.find(e => {
        return e.clips.some(e => {
          return e.id === U.id;
        });
      });
      if (!n) {
        return;
      }
      let r = n.clips.findIndex(e => {
        return e.id === U.id;
      });
      let i = n.clips[r];
      let a = {
        ...i,
        sourceEnd: e,
        duration: e - i.sourceStart
      };
      let o = {
        ...i,
        id: ul(`clip`),
        sourceStart: e,
        duration: i.sourceEnd - e
      };
      n.clips.splice(r, 1, a, o);
      I(o.id);
    });
  }, [U, j, le]);
  let me = Z.useCallback(() => {
    if (H) {
      le(e => {
        let t = e.find(e => {
          return e.id === H.track.id;
        });
        if (t) {
          t.clips = t.clips.filter(e => {
            return e.id !== H.clip.id;
          });
        }
      });
      I(``);
    }
  }, [le, H]);
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
  let he = Math.max(0.08, G * 0.012);
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
    let t = U ? [U.sourceStart, U.sourceEnd] : [];
    let n = Math.max(0, Math.min(G, ge(e, t)));
    M(n);
    if (u.current && u.current.src === oe) {
      u.current.currentTime = n;
    }
  };
  let ve = e => {
    let t = e.currentTarget.getBoundingClientRect();
    _e((e.clientX - t.left) / t.width * G);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  let ye = (e, t) => {
    e.preventDefault();
    e.stopPropagation();
    let n = U;
    let r = d.current?.getBoundingClientRect();
    if (!r || !n || !G) {
      return;
    }
    let i = e => {
      let i = ll(ge(Math.max(0, Math.min(G, (e.clientX - r.left) / r.width * G)), [j]));
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
      let a = (e.clientX - r) / tl;
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
        timelineStart: ll(Math.max(0, o)),
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
    return ce([...V, {
      id: ul(`video-track`),
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
    let n = h === `trim` ? ie.filter(e => {
      return e.sourceId === U?.sourceId;
    }) : ie;
    if (h === `concat` && n.length < 2 || h === `trim` && !n.length) {
      we(h === `concat` ? `视频拼接至少需要 2 个可见视频片段` : `时间线中没有可导出的片段`);
      return;
    }
    if (h !== `concat` && h !== `trim` && !oe) {
      we(`请先上传视频或连接包含视频的节点`);
      return;
    }
    if (h === `sizeFrameRate` && (y <= 0 || x <= 0 || C <= 0)) {
      we(`宽度、高度和帧率必须为正数`);
      return;
    }
    let a = cl(y);
    let u = cl(x);
    let d = new Vc();
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
        c = await Yc(t, {
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
        let i = o.current && oe === s.current ? o.current : await fetch(oe, {
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
        c = await Jc(i, l);
      }
      let l = await xi(c.blob, {
        subfolder: `canvas/video-process`
      });
      let p = n.length;
      let m = h === `trim` ? p > 1 ? `trimmed_${p}_clips` : `trimmed` : h === `extractAudio` ? `audio` : h === `sizeFrameRate` ? `${a}x${u}_${C}fps` : `merged_${p}_clips`;
      let g = `${ol(se || `video`)}_${m}.${c.extension}`;
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
      if (t instanceof Bc || f.signal.aborted || d.isCanceled) {
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
  }, [U?.sourceId, _, ie, e, h, i, x, y, we, se, oe, C, r]);
  let Ee = !!i.loading;
  let De = `nodrag nowheel w-full h-8 bg-[#222] border border-[#3a3a3a] rounded-md px-2 text-[11px] text-gray-200 outline-none focus:border-[#777]`;
  let Oe = `nodrag h-8 px-2 rounded-md border border-[#3a3a3a] bg-[#252525] text-[10px] text-gray-300 hover:bg-[#303030] transition-colors disabled:opacity-35 disabled:cursor-not-allowed`;
  let ke = `nodrag h-7 min-w-7 px-1.5 rounded border border-[#3b3b3b] bg-[#272727] text-gray-400 flex items-center justify-center hover:text-white disabled:opacity-30`;
  let K = G ? j / G * 100 : 0;
  let Ae = G && U ? U.sourceStart / G * 100 : 0;
  let je = G && U ? U.sourceEnd / G * 100 : 100;
  let Me = h === `concat` ? ie.length >= 2 : h === `trim` ? ie.length > 0 : !!oe;
  let q = Z.useMemo(() => {
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
  let Fe = Math.max(100, q * tl + 100);
  let J = j * tl;
  let Ie = Z.useCallback(e => {
    if (!u.current) {
      return;
    }
    let t = e.currentTarget.getBoundingClientRect();
    let n = Math.max(0, e.clientX - t.left) / tl;
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
  let Le = e => {
    let t = L[e.sourceId] || [];
    let n = e.duration * tl;
    const Component1522 = `img`;
    const Component1523 = `div`;
    const Component1524 = `div`;
    const Component1525 = `span`;
    const Component1526 = `span`;
    const Component1527 = `div`;
    const Component1528 = `div`;
    const Component1529 = `div`;
    return <Component1529 className={`absolute top-1 h-12 z-10`} style={{
      left: e.timelineStart * tl,
      width: n
    }} onPointerDown={t => {
      t.stopPropagation();
      I(e.id);
      be(t, e.id);
    }} key={e.id}>
        <Component1528 onDoubleClick={() => {
        A(e.id);
        I(e.id);
      }} className={`nodrag relative w-full h-full overflow-hidden border cursor-grab active:cursor-grabbing ${F === e.id ? `border-white z-10` : `border-[#505050]`}`}>
          <Component1524 className={`absolute inset-0 flex`}>
            {(t.length ? t : [undefined, undefined, undefined]).map((e, t) => {
            if (e) {
              return <Component1522 src={e} draggable={false} onDragStart={e => {
                return e.preventDefault();
              }} className={`h-full min-w-0 flex-1 object-cover pointer-events-none select-none`} key={e} />;
            } else {
              return <Component1523 className={`flex-1 bg-[#383838]`} key={t} />;
            }
          })}
          </Component1524>
          <Component1527 className={`absolute inset-x-0 bottom-0 h-5 px-1 flex items-center gap-1 bg-black/70 text-[9px] text-white`}>
            <Component1525 className={`truncate`}>{e.name}</Component1525>
            <Component1526 className={`ml-auto shrink-0 tabular-nums`}>
              {e.duration.toFixed(1)}
              {`s`}
            </Component1526>
          </Component1527>
        </Component1528>
      </Component1529>;
  };
  const Component1530 = `img`;
  const Component1531 = `div`;
  const Component1532 = `div`;
  const Component1533 = `div`;
  const Component1534 = `div`;
  const Component1535 = `span`;
  const Component1536 = `button`;
  const Component1537 = `span`;
  const Component1538 = `button`;
  const Component1539 = `span`;
  const Component1540 = `div`;
  const Component1541 = `div`;
  const Component1542 = `span`;
  const Component1543 = `span`;
  const Component1544 = `span`;
  const Component1545 = `div`;
  const Component1546 = `div`;
  let Re = U && <Component1546 className={`p-2`}>
      <Component1541 ref={d} className={`relative h-16 overflow-hidden bg-[#303030] cursor-crosshair touch-none select-none`} onPointerDown={ve} onPointerMove={e => {
      if (e.buttons === 1) {
        ve(e);
      }
    }}>
        <Component1531 className={`absolute inset-0 flex`}>
          {(L[U.sourceId] || []).map(e => {
          return <Component1530 src={e} draggable={false} onDragStart={e => {
            return e.preventDefault();
          }} className={`min-w-0 flex-1 object-cover pointer-events-none select-none`} key={e} />;
        })}
        </Component1531>
        <Component1532 className={`absolute inset-y-0 left-0 bg-black/65 pointer-events-none`} style={{
        width: `${Ae}%`
      }} />
        <Component1533 className={`absolute inset-y-0 right-0 bg-black/65 pointer-events-none`} style={{
        width: `${100 - je}%`
      }} />
        <Component1534 className={`absolute inset-y-0 border-y-2 border-white/90 pointer-events-none`} style={{
        left: `${Ae}%`,
        width: `${Math.max(0, je - Ae)}%`
      }} />
        <Component1536 type={`button`} aria-label={`拖动入点`} title={`拖动片段头部设置入点；靠近播放头时自动吸附`} onPointerDown={e => {
        return ye(e, `start`);
      }} className={`nodrag absolute inset-y-0 z-20 w-3 -translate-x-1/2 cursor-ew-resize bg-white hover:bg-blue-300 border-x border-black/40`} style={{
        left: `${Ae}%`
      }}>
          <Component1535 className={`absolute top-1/2 left-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-black/60`} />
        </Component1536>
        <Component1538 type={`button`} aria-label={`拖动出点`} title={`拖动片段尾部设置出点；靠近播放头时自动吸附`} onPointerDown={e => {
        return ye(e, `end`);
      }} className={`nodrag absolute inset-y-0 z-20 w-3 -translate-x-1/2 cursor-ew-resize bg-white hover:bg-blue-300 border-x border-black/40`} style={{
        left: `${je}%`
      }}>
          <Component1537 className={`absolute top-1/2 left-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-black/60`} />
        </Component1538>
        <Component1540 className={`absolute inset-y-0 z-10 w-px bg-red-400 pointer-events-none`} style={{
        left: `${K}%`
      }}>
          <Component1539 className={`absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-red-400`} />
        </Component1540>
      </Component1541>
      <Component1545 className={`mt-1 flex justify-between text-[9px] text-gray-500 tabular-nums`}>
        <Component1542>
          {`入点 `}
          {U.sourceStart.toFixed(2)}
          {`s`}
        </Component1542>
        <Component1543>
          {`片段 `}
          {U.duration.toFixed(2)}
          {`s`}
        </Component1543>
        <Component1544>
          {`出点 `}
          {U.sourceEnd.toFixed(2)}
          {`s`}
        </Component1544>
      </Component1545>
    </Component1546>;
  const Component1547 = `input`;
  const Component1548 = `button`;
  const Component1549 = `div`;
  const Component1550 = `video`;
  const Component1551 = `button`;
  const Component1552 = `div`;
  const Component1553 = `span`;
  const Component1554 = `button`;
  const Component1555 = `span`;
  const Component1556 = `span`;
  const Component1557 = `div`;
  const Component1558 = `button`;
  const Component1559 = `button`;
  const Component1560 = `button`;
  const Component1561 = `button`;
  const Component1562 = `button`;
  const Component1563 = `span`;
  const Component1564 = `div`;
  const Component1565 = `span`;
  const Component1566 = `div`;
  const Component1567 = `span`;
  const Component1568 = `button`;
  const Component1569 = `div`;
  const Component1570 = `div`;
  const Component1571 = `div`;
  const Component1572 = `div`;
  const Component1573 = `div`;
  const Component1574 = `div`;
  const Component1575 = `button`;
  const Component1576 = `div`;
  const Component1577 = `div`;
  const Component1578 = `span`;
  const Component1579 = `span`;
  const Component1580 = `button`;
  const Component1581 = `div`;
  const Component1582 = `div`;
  const Component1583 = `span`;
  const Component1584 = `span`;
  const Component1585 = `button`;
  const Component1586 = `div`;
  const Component1587 = `button`;
  const Component1588 = `div`;
  const Component1589 = `input`;
  const Component1590 = `label`;
  const Component1591 = `input`;
  const Component1592 = `label`;
  const Component1593 = `div`;
  const Component1594 = `button`;
  const Component1595 = `div`;
  const Component1596 = `div`;
  const Component1597 = `span`;
  const Component1598 = `div`;
  const Component1599 = `button`;
  const Component1600 = `button`;
  const Component1601 = `div`;
  const Component1602 = `div`;
  const Component1603 = `span`;
  const Component1604 = `button`;
  const Component1605 = `div`;
  const Component1606 = `video`;
  const Component1607 = `div`;
  const Component1608 = `button`;
  const Component1609 = `button`;
  const Component1610 = `button`;
  const Component1611 = `button`;
  const Component1612 = `span`;
  const Component1613 = `div`;
  const Component1614 = `div`;
  const Component1615 = `button`;
  const Component1616 = `div`;
  const Component1617 = `div`;
  const Component1618 = `div`;
  const Component1619 = `div`;
  return <Component1619 className={`relative group/node w-full h-full min-w-[520px] min-h-[620px]`}>
      <_cmp_Ti id={e} data={t} defaultTitle={`视频处理`} icon={<_Component48 size={11} className={`text-gray-500`} />} floating={true} />
      <_cmp_Ei visible={!!n} minWidth={520} minHeight={620} />
      <Component1618 className={`w-full h-full bg-[#1b1b1b] rounded-lg overflow-hidden border shadow-xl flex flex-col drag-handle cursor-move ${n ? `border-[#666]` : `border-[#343434] hover:border-[#484848]`}`}>
        <_cmp__Component10 type={`target`} position={X.Left} />
        <Component1547 ref={a} type={`file`} accept={`video/*`} className={`hidden`} onChange={Ce} />
        <Component1602 className={`flex-1 min-h-0 p-3 flex flex-col gap-3 overflow-y-auto custom-scrollbar nowheel`}>
          <Component1549 className={`grid grid-cols-4 gap-1.5`}>
            {Xc.map(e => {
            return <Component1548 onClick={() => {
              return g(e.value);
            }} disabled={Ee} className={`nodrag h-8 rounded-md border text-[11px] ${h === e.value ? `bg-[#ededed] text-[#161616] border-[#ededed]` : `bg-[#242424] text-gray-400 border-[#3a3a3a] hover:text-white`}`} key={e.value}>
                  {e.label}
                </Component1548>;
          })}
          </Component1549>
          {oe ? <Component1552 className={`relative bg-black rounded-md overflow-hidden border border-[#303030]`}>
              <Component1550 ref={u} src={oe} controls={h !== `trim` && h !== `concat`} playsInline={true} preload={`metadata`} onTimeUpdate={e => {
            if (!m.current) {
              if (h === `concat`) {
                if (N && U) {
                  M(U.timelineStart + Math.max(0, e.currentTarget.currentTime - U.sourceStart));
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
              {h !== `concat` && <Component1551 onClick={() => {
            return a.current?.click();
          }} title={`替换视频`} className={`nodrag absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded bg-black/75 text-gray-200`}>
                  <_Component8 size={13} />
                </Component1551>}
            </Component1552> : <Component1554 onClick={() => {
          return a.current?.click();
        }} className={`nodrag aspect-video rounded-md border border-dashed border-[#3a3a3a] flex items-center justify-center gap-2 text-gray-500 hover:text-gray-200`}>
              <_Component8 size={18} />
              <Component1553 className={`text-[11px]`}>{`上传视频或连接视频节点`}</Component1553>
            </Component1554>}
          {oe && <Component1557 className={`flex justify-between gap-2 text-[10px] text-gray-500`}>
              <Component1555 className={`truncate`}>{se}</Component1555>
              <Component1556 className={`shrink-0 tabular-nums`}>
                {W ? `${sl(W.duration)} · ${W.width}×${W.height} · ${W.fps.toFixed(2)} fps` : `读取信息中...`}
              </Component1556>
            </Component1557>}
          {(h === `trim` || h === `concat`) && <Component1582 className={`nodrag nowheel rounded-md border border-[#333] bg-[#202020] overflow-hidden flex flex-col min-h-0 shrink-0`}>
              <Component1564 className={`h-9 px-2 flex shrink-0 items-center gap-1 border-b border-[#333]`}>
                <Component1558 className={ke} title={N ? `暂停` : `播放`} onClick={xe} disabled={!oe}>
                  {N ? <Xe size={13} /> : <_Component42 size={13} />}
                </Component1558>
                <Component1559 className={ke} title={`在播放头设置入点 ([)`} onClick={de} disabled={!U}>{`[`}</Component1559>
                <Component1560 className={ke} title={`在播放头设置出点 (])`} onClick={fe} disabled={!U}>{`]`}</Component1560>
                <Component1561 className={ke} title={`在播放头分割 (S)`} onClick={pe} disabled={!U}>
                  <O size={13} />
                </Component1561>
                <Component1562 className={ke} title={`删除选中片段 (Delete)`} onClick={me} disabled={!H}>
                  <Ot size={13} />
                </Component1562>
                <Component1563 className={`ml-auto text-[10px] text-gray-400 tabular-nums`}>
                  {j.toFixed(2)}
                  {`s`}
                </Component1563>
              </Component1564>
              {h === `trim` && Re}
              {h === `concat` && <Component1577 ref={Ne} className={`max-h-72 overflow-y-auto overflow-x-hidden custom-scrollbar p-1.5 space-y-1 relative`}>
                  <Component1566 className={`absolute top-1.5 bottom-0 z-20 w-px bg-red-400 pointer-events-none transition-transform duration-75`} style={{
              transform: `translateX(${J}px)`,
              left: `102px`
            }}>
                    <Component1565 className={`absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-red-400`} />
                  </Component1566>
                  {V.map(e => {
              return <Component1573 data-track-id={e.id} className={`flex min-h-16 border border-[#303030] bg-[#242424] relative`} key={e.id}>
                        <Component1570 className={`w-24 shrink-0 p-1.5 border-r border-[#333] flex flex-col gap-1 text-[9px] text-gray-400 z-30 bg-[#242424]`}>
                          <Component1569 className={`flex items-center gap-1`}>
                            <Component1567 className={`truncate`} title={e.name}>
                              {e.name}
                            </Component1567>
                            <Component1568 className={`ml-auto`} title={`轨道静音`} onClick={() => {
                      return le(t => {
                        let n = t.find(t => {
                          return t.id === e.id;
                        });
                        if (n) {
                          n.muted = !n.muted;
                        }
                      });
                    }}>
                              {e.muted ? <_Component43 size={11} /> : <Dn size={11} />}
                            </Component1568>
                          </Component1569>
                        </Component1570>
                        <Component1572 className={`flex-1 min-w-0 overflow-x-auto overflow-y-hidden timeline-container custom-scrollbar pb-1`} onScroll={Pe}>
                          <Component1571 className={`relative h-14 min-w-full cursor-crosshair`} style={{
                    width: Fe
                  }} onPointerDown={e => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    m.current = true;
                    Ie(e);
                  }} onPointerMove={e => {
                    if (m.current) {
                      Ie(e);
                    }
                  }} onPointerUp={e => {
                    m.current = false;
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }} onPointerCancel={() => {
                    m.current = false;
                  }}>
                            {e.clips.map(e => {
                      return Le(e);
                    })}
                          </Component1571>
                        </Component1572>
                      </Component1573>;
            })}
                  <Component1576 className={`flex items-center justify-between px-1 mt-2`}>
                    <Component1574 className={`text-[9px] text-gray-500`}>{`导出顺序：视频轨从上到下，片段从左到右`}</Component1574>
                    <Component1575 className={`flex items-center gap-1 text-[10px] text-gray-400 hover:text-white px-2 py-1 rounded bg-[#2a2a2a] border border-[#3a3a3a] hover:bg-[#3a3a3a] transition-colors`} onClick={Se}>
                      <Xt size={11} />
                      {`新增轨道`}
                    </Component1575>
                  </Component1576>
                </Component1577>}
              {H && <Component1581 className={`h-9 px-2 border-t border-[#333] flex items-center gap-2 text-[9px] text-gray-400`}>
                  <Component1578 className={`truncate max-w-32`}>{H.clip.name}</Component1578>
                  <Component1579 className={`tabular-nums`}>
                    {H.clip.sourceStart.toFixed(2)}
                    {` - `}
                    {H.clip.sourceEnd.toFixed(2)}
                    {`s`}
                  </Component1579>
                  <Component1580 className={`ml-auto`} title={`片段静音`} onClick={() => {
              return ue(H.clip.id, {
                muted: !H.clip.muted
              });
            }}>
                    {H.clip.muted ? <_Component49 size={12} /> : <_Component36 size={12} />}
                  </Component1580>
                </Component1581>}
            </Component1582>}
          {h === `extractAudio` && <Component1586 className={`grid grid-cols-3 gap-2`}>
              {Zc.map(e => {
            return <Component1585 onClick={() => {
              return v(e.value);
            }} className={`nodrag h-11 rounded-md border flex flex-col items-center justify-center ${_ === e.value ? `border-[#ededed] bg-[#ededed] text-[#171717]` : `border-[#3a3a3a] bg-[#252525] text-gray-300`}`} key={e.value}>
                    <Component1583 className={`text-[11px]`}>{e.label}</Component1583>
                    <Component1584 className={`text-[9px] opacity-60`}>{e.hint}</Component1584>
                  </Component1585>;
          })}
            </Component1586>}
          {h === `sizeFrameRate` && <Component1596 className={`flex flex-col gap-3`}>
              <Component1588 className={`grid grid-cols-3 gap-2`}>
                {Qc.map(e => {
              return <Component1587 onClick={() => {
                b(e.width);
                S(e.height);
              }} className={Oe} key={e.label}>
                      {e.label}
                    </Component1587>;
            })}
              </Component1588>
              <Component1593 className={`grid grid-cols-2 gap-2`}>
                <Component1590 className={`text-[10px] text-gray-500`}>
                  {`宽度`}
                  <Component1589 type={`number`} min={2} step={2} value={y} onChange={e => {
                return b(Number(e.target.value));
              }} className={`${De} mt-1`} />
                </Component1590>
                <Component1592 className={`text-[10px] text-gray-500`}>
                  {`高度`}
                  <Component1591 type={`number`} min={2} step={2} value={x} onChange={e => {
                return S(Number(e.target.value));
              }} className={`${De} mt-1`} />
                </Component1592>
              </Component1593>
              <Component1595 className={`grid grid-cols-4 gap-2`}>
                {$c.map(e => {
              return <Component1594 onClick={() => {
                return w(e);
              }} className={`${Oe} ${C === e ? `border-[#ddd] text-white` : ``}`} key={e}>
                      {e}
                      {` fps`}
                    </Component1594>;
            })}
              </Component1595>
            </Component1596>}
          {i.errorMessage && <Component1598 className={`flex items-start gap-1.5 text-[11px] text-red-400`}>
              <_Component16 size={13} className={`shrink-0 mt-0.5`} />
              <Component1597>{i.errorMessage}</Component1597>
            </Component1598>}
          <Component1601 className={`mt-auto pt-2 flex gap-2 sticky bottom-0 bg-[#1b1b1b]`}>
            <Component1599 onClick={Te} disabled={!Me || Ee} className={`nodrag flex-1 h-9 rounded-md bg-[#ededed] text-[#161616] text-[12px] font-medium flex items-center justify-center gap-1.5 disabled:opacity-40`}>
              {Ee ? <Q.Fragment>
                  <_n size={13} className={`animate-spin`} />
                  {`处理中 `}
                  {i.progress || 0}
                  {`%`}
                </Q.Fragment> : <Q.Fragment>
                  <_Component42 size={13} />
                  {h === `concat` ? `按时间线拼接` : `开始处理`}
                </Q.Fragment>}
            </Component1599>
            {Ee && <Component1600 onClick={() => {
            l.current?.abort();
            c.current?.cancel();
          }} title={`取消处理`} className={`nodrag h-9 w-9 rounded-md border border-[#444] bg-[#292929] text-gray-300 flex items-center justify-center`}>
                <T size={12} />
              </Component1600>}
          </Component1601>
        </Component1602>
        <_cmp__Component10 type={`source`} position={X.Right} id={`main-output`} />
        {k && U && <Component1617 className={`absolute inset-0 z-50 bg-[#1b1b1b]/95 backdrop-blur-sm flex flex-col p-3 nodrag nowheel rounded-lg`}>
            <Component1605 className={`flex items-center justify-between mb-3 text-white`}>
              <Component1603 className={`text-sm font-medium`}>{`编辑片段截取`}</Component1603>
              <Component1604 onClick={() => {
            return A(null);
          }} className={`text-gray-400 hover:text-white`}>
                <Gt size={16} />
              </Component1604>
            </Component1605>
            <Component1616 className={`flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto custom-scrollbar`}>
              <Component1607 className={`relative bg-black rounded-md overflow-hidden border border-[#303030]`}>
                <Component1606 ref={u} src={U.url} playsInline={true} preload={`metadata`} onTimeUpdate={e => {
              return M(e.currentTarget.currentTime);
            }} onPlay={() => {
              return P(true);
            }} onPause={() => {
              return P(false);
            }} className={`nodrag nowheel w-full aspect-video object-contain`} />
              </Component1607>
              <Component1614 className={`nodrag nowheel rounded-md border border-[#333] bg-[#202020] overflow-hidden flex flex-col shrink-0`}>
                <Component1613 className={`h-9 px-2 flex shrink-0 items-center gap-1 border-b border-[#333]`}>
                  <Component1608 className={ke} title={N ? `暂停` : `播放`} onClick={xe}>
                    {N ? <Xe size={13} /> : <_Component42 size={13} />}
                  </Component1608>
                  <Component1609 className={ke} title={`在播放头设置入点 ([)`} onClick={de}>{`[`}</Component1609>
                  <Component1610 className={ke} title={`在播放头设置出点 (])`} onClick={fe}>{`]`}</Component1610>
                  <Component1611 className={ke} title={`在播放头分割 (S)`} onClick={pe}>
                    <O size={13} />
                  </Component1611>
                  <Component1612 className={`ml-auto text-[10px] text-gray-400 tabular-nums`}>
                    {j.toFixed(2)}
                    {`s`}
                  </Component1612>
                </Component1613>
                {Re}
              </Component1614>
              <Component1615 onClick={() => {
            return A(null);
          }} className={`mt-auto shrink-0 h-9 w-full rounded-md bg-[#ededed] text-[#161616] text-[12px] font-medium`}>{`完成截取`}</Component1615>
            </Component1616>
          </Component1617>}
      </Component1618>
    </Component1619>;
});
export default fl;