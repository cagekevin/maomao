// TODO(全局, 无需 import): data, selected, updateNodeData, setNodes, setEdges, getNode, p, f, handleType, v, m, s, r, schemaLoading, schemaError, i, u, headers, Authorization, signal, o, nodeId, nodeName, fieldName, fieldValue, fieldData, fieldType, description, descriptionEn, l, webappId, schema, webappName, webappDesc, webappTags, covers, preDeductAmount, values, n, uploadStatus, uploadError, uploadSourceSig, k, b, image, video, audio, decodeURIComponent, x, g, subfolder, generateThumb, thumbMaxDim, thumbQuality, type, position, style, width, height, audioUrl, audioName, label, hasChanged, imageUrl, source, sourceHandle, targetHandle, thumbnailUrl, text, expanded, loading, status, errorMessage, errorMsg, encodeURIComponent, url, outputType, maxDim, quality, consumeMoney, finalPrice, taskCostTime, lastResultTaskId, progress, resultUrl, customResultData, customOutputType, responseData, taskId, appId, instanceType, nodeInfoList, method, body, createdAt, prompt, channelName, modelName, requestData, ee, maxWidth, openAppSelectorOnMount, de, se, oe, resetValues, ce, minWidth, minHeight, overflow, __html
import _cmp__Component12 from "./_Component12.jsx";
import _cmp_Si from "./Si.jsx";
import _cmp__Component8 from "./_Component8.jsx";
import _cmp__Component9 from "./_Component9.jsx";
import { id, We, nn, c, Xn, Lt, Qt, Hs, Yn, Us, h, E, O, y, Qs, Ks, qs, D, Ia, Ws, Vs, _, si, S, w, Jn, mi, F, Bs, I, N, zs, P, L, X, Gs, _Component2, j, A, M, R, re, ue, le, V, W, ae, G, U, Fn, H, pe, ge, he, te, ne, Zs, _e, _Component25, Se, _Component17, Gt, _Component0, _Component36, _Component47, Xt, _Component48, Ae, B, T, _Component43 } from "./shared.js";
import * as _shared from "./shared.js";
import * as Z from "react";
import * as Q from "react";
var $s = Z.memo(({
  id: e,
  data: t,
  selected: n
}) => {
  let {
    updateNodeData: r,
    setNodes: i,
    setEdges: a,
    getNode: o
  } = We();
  let s = nn();
  let c = t;
  let l = c.webappId || ``;
  let u = Xn(c.aiAppApiUrl);
  let d = c.aiAppApiKey || ``;
  let [f, p] = Z.useState(null);
  Z.useEffect(() => {
    if (!f) {
      return;
    }
    let e = () => {
      return p(null);
    };
    document.addEventListener(`mousedown`, e);
    return () => {
      return document.removeEventListener(`mousedown`, e);
    };
  }, [f]);
  let m = Z.useMemo(() => {
    return c.schema || [];
  }, [c.schema]);
  let h = Z.useMemo(() => {
    return c.values || {};
  }, [c.values]);
  let g = Z.useMemo(() => {
    return c.uploadStatus || {};
  }, [c.uploadStatus]);
  let _ = Z.useMemo(() => {
    return c.uploadError || {};
  }, [c.uploadError]);
  let v = Lt({
    handleType: `target`
  });
  let y = Qt(Z.useMemo(() => {
    return Array.from(new Set(v.map(e => {
      return e.source;
    })));
  }, [v]));
  let b = Z.useMemo(() => {
    return m.filter(e => {
      return [`IMAGE`, `VIDEO`, `AUDIO`].includes(Hs(e));
    });
  }, [m]);
  let x = Z.useMemo(() => {
    return m.filter(e => {
      return ![`IMAGE`, `VIDEO`, `AUDIO`].includes(Hs(e));
    });
  }, [m]);
  Z.useEffect(() => {
    let t = window.requestAnimationFrame(() => {
      return s(e);
    });
    return () => {
      return window.cancelAnimationFrame(t);
    };
  }, [e, m, s]);
  let S = Z.useRef(null);
  let C = Z.useRef(false);
  let w = Z.useRef(null);
  let E = Z.useRef({});
  let D = Z.useRef({});
  let O = Z.useCallback(async (t, n) => {
    if (!u || !d) {
      r(e, {
        schemaLoading: false,
        schemaError: `请先登录以使用 AI 应用`
      });
      return;
    }
    r(e, {
      schemaLoading: true,
      schemaError: undefined
    });
    let i = new AbortController();
    let a = window.setTimeout(() => {
      return i.abort();
    }, 15000);
    try {
      let a = await fetch(Yn(u, t), {
        headers: {
          Authorization: `Bearer ${d}`
        },
        signal: i.signal
      });
      let o = await a.json();
      if (a.status === 404) {
        throw Error(o?.error || `应用不存在或已下架，请重新选择应用`);
      }
      if (!a.ok || !o?.success) {
        throw Error(o?.error || `加载失败 HTTP ${a.status}`);
      }
      let s = o.data || {};
      let l = (s.nodeInfoList || []).map(e => {
        return {
          nodeId: String(e.nodeId),
          nodeName: e.nodeName,
          fieldName: e.fieldName,
          fieldValue: e.fieldValue,
          fieldData: e.fieldData,
          fieldType: (e.fieldType || ``).toUpperCase(),
          description: e.description,
          descriptionEn: e.descriptionEn
        };
      });
      let f = {};
      l.forEach(e => {
        if (e.fieldValue !== undefined) {
          f[Us(e)] = String(e.fieldValue);
        }
      });
      let p = Array.isArray(s.covers) ? s.covers : [];
      let m = s.tags ?? [];
      let h = Array.isArray(m) ? m.map(e => {
        if (typeof e == `string`) {
          return e;
        } else {
          return e?.name || e?.tagName || ``;
        }
      }).filter(Boolean) : [];
      r(e, {
        webappId: t,
        schema: l,
        webappName: s.appName || `AI应用`,
        webappDesc: s.description || ``,
        webappTags: h,
        covers: p,
        preDeductAmount: s.preDeductAmountDefault ?? null,
        values: n?.resetValues ? f : {
          ...f,
          ...(c.values || {})
        },
        uploadStatus: n?.resetValues ? {} : c.uploadStatus || {},
        uploadError: n?.resetValues ? {} : c.uploadError || {},
        uploadSourceSig: n?.resetValues ? {} : c.uploadSourceSig || {},
        schemaLoading: false
      });
      if (n?.resetValues) {
        E.current = {};
      } else {
        E.current = {
          ...(c.uploadSourceSig || {})
        };
      }
    } catch (t) {
      r(e, {
        schemaLoading: false,
        schemaError: t?.name === `AbortError` ? `加载超时（15s），请检查网络或应用 ID` : t?.message || `加载失败`
      });
    } finally {
      window.clearTimeout(a);
    }
  }, [e, u, d]);
  Z.useEffect(() => {
    if (!(m.length > 0) && !!c.webappId) {
      O(c.webappId);
    }
  }, [e]);
  let k = Z.useRef(d);
  Z.useEffect(() => {
    let e = k.current;
    k.current = d;
    if (!u || !d || !c.webappId) {
      return;
    }
    let t = !e && !!d;
    let n = !!c.schemaError && /登录/.test(c.schemaError);
    if (t || n && m.length === 0) {
      O(c.webappId);
    }
  }, [u, d, c.webappId, c.schemaError, m.length, O]);
  Z.useEffect(() => {
    if (b.length !== 0) {
      b.forEach(t => {
        let n = Us(t);
        let i = v.find(e => {
          return e.targetHandle === `var-${n}`;
        });
        let a = Hs(t);
        if (!i) {
          if (E.current[n]) {
            E.current[n] = ``;
            r(e, {
              values: {
                ...(c.values || {}),
                [n]: ``
              },
              uploadStatus: {
                ...(c.uploadStatus || {}),
                [n]: `idle`
              },
              uploadError: {
                ...(c.uploadError || {}),
                [n]: ``
              },
              uploadSourceSig: {
                ...(c.uploadSourceSig || {}),
                [n]: ``
              }
            });
          }
          return;
        }
        let o = y.find(e => {
          return e?.id === i.source;
        });
        if (!o || !o.data) {
          return;
        }
        let s = o.data;
        let l = s.imageUrl || s.videoUrl || s.audioUrl || ``;
        let f = ``;
        if (a === `IMAGE`) {
          if (s.imageUrl && !/\.(mp4|webm|mov|mkv|avi|m4v)(\?|$)/i.test(String(s.imageUrl))) {
            f = s.imageUrl;
          } else {
            f = ``;
          }
        } else if (a === `VIDEO`) {
          f = s.videoUrl || (s.imageUrl && /\.(mp4|webm|mov|mkv|avi|m4v)(\?|$)/i.test(String(s.imageUrl)) ? s.imageUrl : ``);
        } else if (a === `AUDIO`) {
          f = s.audioUrl || (s.imageUrl && /\.(mp3|wav|ogg|m4a|flac|aac|opus|wma|aiff)(\?|$)/i.test(String(s.imageUrl)) ? s.imageUrl : ``);
        }
        f ||= l;
        if (!f) {
          return;
        }
        let p = a === `IMAGE` ? `image` : a === `VIDEO` ? `video` : `audio`;
        let m = Qs(f);
        if (m !== `unknown` && m !== p) {
          let t = `bad#${i.source}#${i.sourceHandle ?? ``}#${f}`;
          if (E.current[n] !== t) {
            E.current[n] = t;
            let i = {
              image: `图片`,
              video: `视频`,
              audio: `音频`
            };
            r(e, {
              uploadStatus: {
                ...(c.uploadStatus || {}),
                [n]: `error`
              },
              uploadError: {
                ...(c.uploadError || {}),
                [n]: `该字段需要${i[p]}，但接入的是${i[m] || m}`
              }
            });
          }
          return;
        }
        let h = `${i.source}#${i.sourceHandle ?? ``}#${f}`;
        if (E.current[n] === h || (c.uploadSourceSig || {})[n] === h && (c.values || {})[n] && (c.uploadStatus || {})[n] === `done`) {
          E.current[n] = h;
          return;
        }
        E.current[n] = h;
        (async () => {
          r(e, {
            uploadStatus: {
              ...(c.uploadStatus || {}),
              [n]: `uploading`
            },
            uploadError: {
              ...(c.uploadError || {}),
              [n]: ``
            }
          });
          try {
            let t = await Ks(await qs(f), u, d, (() => {
              try {
                let e = new URL(f);
                return decodeURIComponent(e.pathname.split(`/`).pop() || `upload.bin`);
              } catch {
                return `upload.bin`;
              }
            })());
            r(e, {
              values: {
                ...(c.values || {}),
                [n]: t
              },
              uploadStatus: {
                ...(c.uploadStatus || {}),
                [n]: `done`
              },
              uploadSourceSig: {
                ...(c.uploadSourceSig || {}),
                [n]: h
              }
            });
          } catch (t) {
            r(e, {
              uploadStatus: {
                ...(c.uploadStatus || {}),
                [n]: `error`
              },
              uploadError: {
                ...(c.uploadError || {}),
                [n]: t?.message || `上传失败`
              }
            });
          }
        })();
      });
    }
  }, [v, y, b, e]);
  Z.useEffect(() => {
    if (x.length !== 0) {
      x.forEach(t => {
        let n = Us(t);
        let i = v.find(e => {
          return e.targetHandle === `var-${n}`;
        });
        if (!i) {
          if (D.current[n]) {
            D.current[n] = ``;
            r(e, {
              values: {
                ...(c.values || {}),
                [n]: ``
              }
            });
          }
          return;
        }
        let a = Ia(y.find(e => {
          return e?.id === i.source;
        })).trim();
        if (!a) {
          return;
        }
        let o = `${i.source}#${i.sourceHandle ?? ``}#${a}`;
        if (D.current[n] === o) {
          return;
        }
        D.current[n] = o;
        let s = Hs(t);
        let l = a;
        if (s === `LIST`) {
          l = Ws(a, Vs(t.fieldData));
        }
        if (s === `BOOLEAN`) {
          if (/^(true|1|yes|是|开)$/i.test(a)) {
            l = `true`;
          } else {
            if (/^(false|0|no|否|关)$/i.test(a)) {
              l = `false`;
            } else {
              l = a;
            }
          }
        }
        r(e, {
          values: {
            ...(c.values || {}),
            [n]: l
          }
        });
      });
    }
  }, [v, y, x, e]);
  let A = Z.useCallback(async (t, n, s) => {
    let c = (n.name || ``).toLowerCase();
    let l = n.type.startsWith(`audio/`) || /\.(mp3|wav|ogg|m4a|flac|aac|opus|wma|aiff)$/i.test(c);
    let u = n.type.startsWith(`video/`) || /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(c);
    let d = n.type.startsWith(`image/`) || /\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i.test(c);
    let f = l ? `audio` : u ? `video` : d ? `image` : `unknown`;
    let p = s === `IMAGE` ? `image` : s === `VIDEO` ? `video` : `audio`;
    if (f !== `unknown` && f !== p) {
      let n = {
        image: `图片`,
        video: `视频`,
        audio: `音频`
      };
      r(e, {
        uploadStatus: {
          ...(g || {}),
          [t]: `error`
        },
        uploadError: {
          ...(_ || {}),
          [t]: `该字段需要${n[p]}，请选择${n[p]}文件`
        }
      });
      return;
    }
    let m = URL.createObjectURL(n);
    try {
      let e = await si(n, {
        subfolder: `canvas/upload`,
        generateThumb: p === `image`,
        thumbMaxDim: 480,
        thumbQuality: 75
      });
      if (e?.url) {
        m = e.url;
      }
    } catch {}
    let h = o(e);
    let v = h?.position?.x ?? 0;
    let y = h?.position?.y ?? 0;
    let x = b.findIndex(e => {
      return Us(e) === t;
    });
    let S = `${e}-in-${t}-${Date.now()}`;
    let C;
    if (p === `audio`) {
      C = {
        id: S,
        type: `audioPlayerNode`,
        position: {
          x: v - 420,
          y: y + Math.max(0, x) * 240
        },
        style: {
          width: 360,
          height: 220
        },
        data: {
          audioUrl: m,
          audioName: n.name,
          label: n.name,
          hasChanged: true
        }
      };
    } else {
      C = {
        id: S,
        type: `imageNode`,
        position: {
          x: v - 420,
          y: y + Math.max(0, x) * 280
        },
        style: {
          width: 360,
          height: p === `video` ? 240 : 360
        },
        data: {
          imageUrl: m,
          label: n.name,
          hasChanged: true
        }
      };
    }
    let w = {
      id: `e-${S}-${e}`,
      source: S,
      sourceHandle: null,
      target: e,
      targetHandle: `var-${t}`
    };
    i(e => {
      return e.concat(C);
    });
    a(e => {
      return e.concat(w);
    });
  }, [e, r, g, _, o, b, i, a]);
  let j = Z.useCallback(t => {
    a(n => {
      return n.filter(n => {
        return n.target !== e || n.targetHandle !== `var-${t}`;
      });
    });
  }, [e, a]);
  let M = Z.useCallback((t, n) => {
    r(e, {
      values: {
        ...(c.values || {}),
        [t]: n
      }
    });
  }, [e, r, c.values]);
  let N = Z.useMemo(() => {
    return b.every(e => {
      return g[Us(e)] === `done`;
    });
  }, [b, g]);
  let P = Z.useCallback(() => {
    C.current = true;
    w.current = null;
    window.clearTimeout(S.current);
    S.current &&= null;
  }, []);
  let F = Z.useCallback(t => {
    let n = o(e);
    if (!n) {
      return;
    }
    let r = (n.position?.x ?? 0) + (n.width || 560) + 80;
    let s = n.position?.y ?? 0;
    let c = [];
    let l = [];
    let u = s;
    t.forEach((t, n) => {
      let i = Qs(t.url, t.outputType);
      let a = `${e}-out-${Date.now()}-${n}`;
      let o;
      let s;
      let d;
      if (i === `image`) {
        o = `imageNode`;
        s = {
          width: 360,
          height: 360
        };
        d = {
          imageUrl: t.url,
          thumbnailUrl: t.thumbnailUrl,
          label: `结果${n + 1}`
        };
      } else if (i === `video`) {
        o = `imageNode`;
        s = {
          width: 360,
          height: 240
        };
        d = {
          imageUrl: t.url,
          thumbnailUrl: t.thumbnailUrl,
          label: `视频${n + 1}`
        };
      } else if (i === `audio`) {
        o = `audioPlayerNode`;
        s = {
          width: 360,
          height: 220
        };
        d = {
          audioUrl: t.url,
          audioName: `音频${n + 1}`,
          label: `音频${n + 1}`
        };
      } else if (i === `text` || !t.url && t.text) {
        o = `textNode`;
        s = {
          width: 360,
          height: 200
        };
        d = {
          text: t.text || ``,
          label: `文本${n + 1}`,
          expanded: true
        };
      } else {
        o = `textNode`;
        s = {
          width: 360,
          height: 120
        };
        d = {
          text: t.url || ``,
          label: `结果${n + 1}`,
          expanded: true
        };
      }
      let f = {
        id: a,
        type: o,
        position: {
          x: r,
          y: u
        },
        style: s,
        data: {
          ...d,
          hasChanged: true
        }
      };
      u += (s?.height || 240) + 30;
      c.push(f);
      l.push({
        id: `e-${e}-${a}`,
        source: e,
        sourceHandle: null,
        target: a,
        targetHandle: null
      });
    });
    if (c.length > 0) {
      i(e => {
        return e.concat(c);
      });
      a(e => {
        return e.concat(l);
      });
    }
  }, [o, e, i, a]);
  let I = Z.useCallback(async t => {
    if (w.current === t) {
      return;
    }
    w.current = t;
    C.current = false;
    let n = Date.now();
    let i = async () => {
      if (!C.current) {
        if (Date.now() - n > 600000) {
          r(e, {
            loading: false,
            status: `FAILED`,
            errorMessage: `任务轮询超时`
          });
          c.updateGlobalTasks?.(e => {
            return e.map(e => {
              if (e.taskId === t) {
                return {
                  ...e,
                  status: `failed`,
                  errorMsg: `任务轮询超时`
                };
              } else {
                return e;
              }
            });
          });
          w.current = null;
          return;
        }
        try {
          let n = await fetch(Jn(u, `/task/${encodeURIComponent(t)}`), {
            headers: {
              Authorization: `Bearer ${d}`
            }
          });
          let i = await n.json();
          if (!n.ok) {
            throw Error(i?.error || `轮询失败 HTTP ${n.status}`);
          }
          let a = String(i?.status || ``).toUpperCase();
          if (a === `SUCCESS`) {
            let n = Array.isArray(i?.results) ? i.results : [];
            let a = i?.finalPrice == null ? null : Number(i.finalPrice);
            let o = a != null && a > 0 ? String(a).replace(/\.?0+$/, ``) : null;
            let s = i?.usage?.taskCostTime ?? null;
            let l = e => {
              if (e) {
                if (/^(https?:|data:|blob:)/i.test(e)) {
                  return e;
                } else {
                  return `${u.replace(/\/api\/?$/i, ``).replace(/\/$/, ``)}/${e.replace(/^\/+/, ``)}`;
                }
              } else {
                return ``;
              }
            };
            let d = await Promise.all(n.map(async e => {
              let t = l(String(e.url || ``).trim().replace(/^`+|`+$/g, ``));
              if (!t) {
                return {
                  ...e,
                  url: ``
                };
              }
              let n = Qs(t, e.outputType);
              if (n === `text` || /\.(txt|md|json|csv|log|xml|ya?ml|srt|vtt)(\?|$)/i.test(t)) {
                try {
                  let n = await fetch(t).catch(() => {
                    return null;
                  });
                  if (n && n.ok) {
                    let t = await n.text();
                    return {
                      ...e,
                      url: ``,
                      text: t,
                      outputType: `text`
                    };
                  }
                } catch (e) {
                  console.warn(`Failed to fetch text file content`, e);
                }
              }
              try {
                let r = await si(t, {
                  subfolder: `tasks`,
                  generateThumb: n === `image`,
                  thumbMaxDim: 480,
                  thumbQuality: 75
                });
                if (r?.url) {
                  let t = r.thumbnailUrl;
                  if (!t && n === `image`) {
                    t = (await mi(r.url, {
                      maxDim: 480,
                      quality: 75
                    })) || undefined;
                  }
                  return {
                    ...e,
                    url: r.url,
                    thumbnailUrl: t
                  };
                }
                return {
                  ...e,
                  url: t
                };
              } catch {
                return {
                  ...e,
                  url: t
                };
              }
            }));
            r(e, {
              loading: false,
              status: `SUCCESS`,
              consumeMoney: o,
              finalPrice: a,
              taskCostTime: s,
              lastResultTaskId: t
            });
            F(d);
            let f = c.addTransitResource;
            if (f) {
              d.forEach(e => {
                if (!e?.url) {
                  return;
                }
                let t = Qs(e.url, e.outputType);
                let n = t === `video` ? `video` : t === `audio` ? `audio` : t === `text` ? `text` : `image`;
                f(e.url, n, `generated`);
              });
            }
            let p = d.find(e => {
              return !!e?.url;
            });
            let m = p?.url || ``;
            let h = p?.thumbnailUrl;
            let g = Qs(m);
            let _ = g === `video` ? `video` : g === `audio` ? `audio` : g === `text` ? `text` : `image`;
            c.updateGlobalTasks?.(e => {
              return e.map(e => {
                if (e.taskId === t) {
                  return {
                    ...e,
                    status: `completed`,
                    progress: 100,
                    resultUrl: m || e.resultUrl,
                    thumbnailUrl: h || e.thumbnailUrl,
                    customResultData: m || e.resultUrl,
                    customOutputType: _,
                    responseData: i
                  };
                } else {
                  return e;
                }
              });
            });
            w.current = null;
            return;
          }
          if (a === `FAILED`) {
            let n = i?.errorMessage || i?.errorCode || `任务失败`;
            r(e, {
              loading: false,
              status: `FAILED`,
              errorMessage: n
            });
            c.updateGlobalTasks?.(e => {
              return e.map(e => {
                if (e.taskId === t) {
                  return {
                    ...e,
                    status: `failed`,
                    errorMsg: n,
                    responseData: i
                  };
                } else {
                  return e;
                }
              });
            });
            w.current = null;
            return;
          }
          r(e, {
            status: a === `QUEUED` ? `QUEUED` : `RUNNING`
          });
          c.updateGlobalTasks?.(e => {
            return e.map(e => {
              if (e.taskId === t) {
                return {
                  ...e,
                  status: `running`
                };
              } else {
                return e;
              }
            });
          });
        } catch {}
        S.current = window.setTimeout(i, 3000);
      }
    };
    S.current = window.setTimeout(i, 1500);
  }, [e, u, d, r, F, c.addTransitResource, c.updateGlobalTasks]);
  let ee = Z.useCallback(async () => {
    if (!c.loading) {
      if (!u || !d) {
        let t = `请先登录以使用 AI 应用`;
        r(e, {
          errorMessage: t
        });
        c.onShowToast?.(t);
        return;
      }
      if (!Bs(c.membershipType)) {
        let t = `AI 应用需要 VIP 或以上会员`;
        r(e, {
          errorMessage: t
        });
        c.onShowToast?.(t);
        return;
      }
      if (!l) {
        let t = `请先选择 AI 应用`;
        r(e, {
          errorMessage: t
        });
        c.onShowToast?.(t);
        return;
      }
      if (!N) {
        r(e, {
          errorMessage: `存在未完成的文件上传，请等待打勾后再运行`
        });
        return;
      }
      r(e, {
        loading: true,
        status: `QUEUED`,
        errorMessage: undefined,
        consumeMoney: null,
        finalPrice: null,
        taskCostTime: null,
        taskId: undefined
      });
      try {
        let t = m.map(e => {
          let t = Us(e);
          let n = (c.values || {})[t] ?? e.fieldValue ?? ``;
          if (Hs(e) === `LIST`) {
            n = Ws(String(n ?? ``), Vs(e.fieldData));
          }
          let r = {
            nodeId: e.nodeId,
            fieldName: e.fieldName,
            fieldValue: String(n ?? ``)
          };
          if (e.description) {
            r.description = e.description;
          }
          return r;
        });
        let n = {
          appId: l,
          instanceType: `default`,
          nodeInfoList: t
        };
        let i = await fetch(Jn(u, `/run`), {
          method: `POST`,
          headers: {
            'Content-Type': `application/json`,
            Authorization: `Bearer ${d}`
          },
          body: JSON.stringify(n)
        });
        let a = await i.json();
        if (!i.ok) {
          throw i.status === 402 ? Error(`特惠币余额不足`) : i.status === 403 ? Error(a?.error || `需要 VIP 会员`) : Error(a?.error || `发起任务失败`);
        }
        let o = String(a?.taskId || a?.task_id || ``);
        if (!o) {
          throw Error(`未拿到 taskId`);
        }
        if (a?.preDeducted != null) {
          r(e, {
            preDeductAmount: Number(a.preDeducted)
          });
        }
        r(e, {
          taskId: o,
          status: `RUNNING`
        });
        let s = (() => {
          let e = [];
          t.forEach(t => {
            let n = String(t.fieldValue ?? ``);
            if (!n) {
              return;
            }
            let r = n.length > 80 ? `${n.slice(0, 80)}…` : n;
            e.push(`${t.description || t.fieldName}: ${r}`);
          });
          return e.join(` | `);
        })();
        c.updateGlobalTasks?.(t => {
          let r = t.filter(t => {
            return t.nodeId !== e || t.status === `completed` || t.status === `failed`;
          });
          return [{
            id: o,
            taskId: o,
            nodeId: e,
            type: `rhWebapp`,
            status: `running`,
            progress: 0,
            createdAt: Date.now(),
            prompt: s,
            channelName: `一毛AI应用`,
            modelName: `应用 · ${c.webappName || l}`,
            requestData: n
          }, ...r];
        });
        I(o);
      } catch (t) {
        r(e, {
          loading: false,
          status: `FAILED`,
          errorMessage: t?.message || `请求失败`
        });
        c.onShowToast?.(t?.message || `请求失败`);
      }
    }
  }, [N, u, d, e, c.loading, c.membershipType, c.onShowToast, c.updateGlobalTasks, c.values, c.webappName, I, m, r, l]);
  Z.useEffect(() => {
    let t = t => {
      if (t.detail?.nodeId === e) {
        ee();
      }
    };
    window.addEventListener(zs, t);
    return () => {
      return window.removeEventListener(zs, t);
    };
  }, [e, ee]);
  Z.useEffect(() => {
    return () => {
      return P();
    };
  }, [P]);
  let L = Z.useRef(null);
  Z.useEffect(() => {
    let e = c.taskId;
    if (e && c.status !== `FAILED` && c.lastResultTaskId !== e && L.current !== e && w.current !== e) {
      L.current = e;
      I(e);
    }
  }, [c.taskId, c.status, c.lastResultTaskId, I]);
  let R = (e, t) => {
    let n = String(e ?? ``).trim();
    if (!n) {
      if (t === `FLOAT`) {
        return 0.1;
      } else {
        return 1;
      }
    }
    let r = n.indexOf(`.`);
    if (r === -1) {
      return 1;
    } else {
      return 10 ** -(n.length - r - 1);
    }
  };
  let te = e => {
    let t = Us(e);
    let n = Hs(e);
    let r = h[t] ?? ``;
    let i = e.description || e.fieldName;
    let a = <_cmp__Component12 type={`target`} id={`var-${t}`} position={X.Left} variant={`small`} title={`连接到变量: ${i}`} style={{
      top: 18
    }} ballOutset={10} />;
    const Component1282 = `span`;
    const Component1283 = `span`;
    const Component1284 = `div`;
    let o = (e, t) => {
      return <Component1284 className={`w-[120px] flex-shrink-0 pt-2 flex items-start gap-1 text-[12px] text-gray-200`}>
          {e && <Component1282 className={`mt-[2px]`}>{e}</Component1282>}
          <Component1283 className={`font-medium leading-snug break-words`} title={i}>
            {i}
          </Component1283>
          {t === `uploading` && <_Component25 size={11} className={`animate-spin text-blue-400 ml-auto flex-shrink-0`} />}
          {t === `done` && <Se size={12} className={`text-green-400 ml-auto flex-shrink-0`} />}
          {t === `error` && <_Component17 size={12} className={`text-red-400 ml-auto flex-shrink-0`} />}
        </Component1284>;
    };
    if ([`IMAGE`, `VIDEO`, `AUDIO`].includes(n)) {
      let _Component46 = Gs[n] || _Component2;
      let r = g[t] || `idle`;
      let i = v.find(e => {
        return e.targetHandle === `var-${t}`;
      });
      let s = i ? y.find(e => {
        return e?.id === i.source;
      }) : null;
      let c = s?.data?.imageUrl || s?.data?.videoUrl || s?.data?.audioUrl || ``;
      let l = n === `IMAGE` ? `image` : n === `VIDEO` ? `video` : `audio`;
      let u = Qs(c);
      let d = u === `unknown` ? l : u;
      const Component1285 = `img`;
      const Component1286 = `video`;
      const Component1287 = `audio`;
      const Component1288 = `div`;
      const Component1289 = `div`;
      const Component1290 = `div`;
      const Component1291 = `div`;
      const Component1292 = `button`;
      const Component1293 = `div`;
      const Component1294 = `span`;
      const Component1295 = `span`;
      const Component1296 = `span`;
      const Component1297 = `input`;
      const Component1298 = `label`;
      const Component1299 = `div`;
      const Component1300 = `div`;
      const Component1301 = `div`;
      const Component1302 = `div`;
      return <Component1302 className={`flex flex-row items-start gap-3 nodrag`} style={{
        position: `relative`
      }} key={t}>
          {a}
          {o(<_Component46 size={13} className={`text-gray-400`} />, r)}
          <Component1301 className={`flex-1 min-w-0 flex`}>
            <Component1299 className={`relative flex-shrink-0`} style={{
            width: 240,
            height: 240
          }}>
              {i || c ? <Component1293 className={`absolute inset-0 rounded-lg overflow-hidden border border-[#333] bg-black`}>
                  {c && d === `image` && <Component1285 src={c} className={`w-full h-full object-contain`} />}
                  {c && d === `video` && <Component1286 src={c} className={`w-full h-full object-contain bg-black`} controls={true} preload={`metadata`} />}
                  {c && d === `audio` && <Component1288 className={`absolute inset-0 flex items-center justify-center p-3`}>
                      <Component1287 src={c} controls={true} className={`w-full`} />
                    </Component1288>}
                  {!c && <Component1289 className={`absolute inset-0 flex items-center justify-center text-[11px] text-gray-500`}>{`已连线，等待来源…`}</Component1289>}
                  {r === `uploading` && <Component1290 className={`absolute inset-0 bg-black/40 flex items-center justify-center`}>
                      <_Component25 size={26} className={`animate-spin text-white drop-shadow`} />
                    </Component1290>}
                  {r === `done` && <Component1291 className={`absolute top-1.5 right-1.5 bg-green-500/90 rounded-full p-1 shadow`}>
                      <Se size={12} className={`text-white`} />
                    </Component1291>}
                  {r !== `uploading` && <Component1292 className={`absolute top-1.5 left-1.5 bg-black/60 hover:bg-red-500/80 text-white rounded-full p-1 shadow transition-colors`} title={`断开连线`} onClick={e => {
                e.stopPropagation();
                j(t);
              }}>
                      <Gt size={12} />
                    </Component1292>}
                </Component1293> : <Component1298 className={`absolute inset-0 border border-dashed border-[#444] hover:border-blue-500 rounded-lg flex flex-col items-center justify-center cursor-pointer text-gray-500 hover:text-blue-400 transition-colors text-[12px] gap-1.5 bg-[#0d0c0c]`}>
                  {r === `error` ? <Q.Fragment>
                      <_Component17 size={20} className={`text-red-400`} />
                      <Component1294>{`请重新选择`}</Component1294>
                    </Q.Fragment> : <Q.Fragment>
                      <_Component0 size={22} />
                      <Component1295>
                        {n === `IMAGE` ? `点击上传图片` : n === `VIDEO` ? `点击上传视频` : `点击上传音频`}
                      </Component1295>
                      <Component1296 className={`text-[10px] text-gray-600`}>{`或从左侧连线接入`}</Component1296>
                    </Q.Fragment>}
                  <Component1297 type={`file`} accept={n === `IMAGE` ? `image/*` : n === `VIDEO` ? `video/*` : `audio/*,.flac,.aac,.opus,.m4a,.wma,.aiff`} className={`hidden`} onChange={e => {
                let r = e.target.files?.[0];
                if (r) {
                  A(t, r, n);
                }
              }} />
                </Component1298>}
            </Component1299>
            {_[t] && <Component1300 className={`ml-2 text-red-400 text-[10px] flex items-start gap-1`}>
                <_Component17 size={11} className={`mt-0.5`} />
                {` `}
                {_[t]}
              </Component1300>}
          </Component1301>
        </Component1302>;
    }
    if (n === `LIST`) {
      let n = Vs(e.fieldData);
      let i = Ws(r, n);
      let s = n.find(e => {
        return e.index === i;
      });
      let c = s?.description || s?.name || i || `请选择`;
      let l = f === t;
      const Component1303 = `span`;
      const Component1304 = `button`;
      const Component1305 = `div`;
      const Component1308 = `div`;
      const Component1309 = `div`;
      const Component1310 = `div`;
      const Component1311 = `div`;
      return <Component1311 className={`flex flex-row items-start gap-3 nodrag`} style={{
        position: `relative`
      }} key={t}>
          {a}
          {o()}
          <Component1310 className={`flex-1 min-w-0`}>
            <Component1309 className={`relative inline-flex max-w-full`} onMouseDown={e => {
            return e.stopPropagation();
          }}>
              <Component1304 type={`button`} onClick={e => {
              e.stopPropagation();
              p(l ? null : t);
            }} className={`flex items-center gap-2 h-9 pl-3 pr-2 bg-[#0d0c0c] border rounded-full text-[12.5px] text-gray-100 hover:border-gray-500 transition-colors cursor-pointer max-w-full ${l ? `border-blue-500` : `border-[#333]`}`} title={c}>
                <Component1303 className={`truncate`}>{c}</Component1303>
                <_Component36 size={14} className={`text-gray-400 shrink-0 transition-transform ${l ? `rotate-180` : ``}`} />
              </Component1304>
              {l && <Component1308 className={`absolute top-full left-0 mt-1 min-w-[14rem] w-max max-w-[24rem] bg-[#222] border border-[#333] rounded-lg shadow-xl p-1.5 z-50 max-h-60 overflow-y-auto custom-scrollbar nowheel nopan nodrag`} onClick={e => {
              return e.stopPropagation();
            }} onMouseDown={e => {
              return e.stopPropagation();
            }}>
                  {n.length === 0 && <Component1305 className={`px-3 py-2 text-[12px] text-gray-500`}>{`无可选项`}</Component1305>}
                  {n.map(e => {
                let n = e.description || e.name;
                let r = e.index === i;
                const Component1306 = `span`;
                const Component1307 = `button`;
                return <Component1307 type={`button`} onClick={() => {
                  M(t, e.index);
                  p(null);
                }} className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-[12.5px] transition-colors ${r ? `bg-blue-500/15 text-blue-200` : `text-gray-200 hover:bg-white/[0.06]`}`} title={n} key={e.index}>
                        <Component1306 className={`flex-1 min-w-0 truncate`}>{n}</Component1306>
                        {r && <Se size={13} className={`text-blue-300 shrink-0`} />}
                      </Component1307>;
              })}
                </Component1308>}
            </Component1309>
          </Component1310>
        </Component1311>;
    }
    if (n === `INT` || n === `FLOAT`) {
      let e = R(r, n);
      let i = (() => {
        let t = String(e);
        let n = t.indexOf(`.`);
        if (n === -1) {
          return 0;
        } else {
          return t.length - n - 1;
        }
      })();
      let s = e => {
        let a = (Number(r) || 0) + e;
        if (n === `INT`) {
          a = Math.round(a);
        } else {
          a = Number(a.toFixed(i));
        }
        M(t, String(a));
      };
      const Component1312 = `button`;
      const Component1313 = `input`;
      const Component1314 = `button`;
      const Component1315 = `div`;
      const Component1316 = `div`;
      const Component1317 = `div`;
      return <Component1317 className={`flex flex-row items-start gap-3 nodrag`} style={{
        position: `relative`
      }} key={t}>
          {a}
          {o()}
          <Component1316 className={`flex-1 min-w-0`}>
            <Component1315 className={`inline-flex items-stretch h-10 rounded-md overflow-hidden border border-[#333] bg-[#0d0c0c]`} style={{
            maxWidth: 220
          }}>
              <Component1312 type={`button`} onClick={() => {
              return s(-e);
            }} className={`px-3 hover:bg-[#222] text-gray-300 flex items-center justify-center border-r border-[#333]`} title={`-${e}`}>
                <_Component47 size={16} />
              </Component1312>
              <Component1313 type={`number`} step={e} className={`rh-num-input bg-transparent text-center text-[13px] text-gray-100 outline-none w-[100px]`} value={r} onChange={e => {
              return M(t, e.target.value);
            }} />
              <Component1314 type={`button`} onClick={() => {
              return s(e);
            }} className={`px-3 hover:bg-[#222] text-gray-300 flex items-center justify-center border-l border-[#333]`} title={`+${e}`}>
                <Xt size={16} />
              </Component1314>
            </Component1315>
          </Component1316>
        </Component1317>;
    }
    if (n === `BOOLEAN`) {
      let e = r === `true` || r === `1`;
      const Component1318 = `input`;
      const Component1319 = `div`;
      const Component1320 = `div`;
      return <Component1320 className={`flex flex-row items-start gap-3 nodrag`} style={{
        position: `relative`
      }} key={t}>
          {a}
          {o()}
          <Component1319 className={`flex-1 min-w-0 pt-1.5`}>
            <Component1318 type={`checkbox`} checked={e} onChange={e => {
            return M(t, e.target.checked ? `true` : `false`);
          }} className={`w-5 h-5 accent-blue-500 cursor-pointer`} />
          </Component1319>
        </Component1320>;
    }
    const Component1321 = `textarea`;
    const Component1322 = `div`;
    const Component1323 = `div`;
    return <Component1323 className={`flex flex-row items-start gap-3 nodrag`} style={{
      position: `relative`
    }} key={t}>
        {a}
        {o()}
        <Component1322 className={`flex-1 min-w-0`}>
          <Component1321 className={`w-full bg-[#0d0c0c] border border-[#333] rounded-md px-3 py-2 text-[13px] text-gray-100 outline-none focus:border-blue-500 custom-scrollbar resize-y nodrag nowheel min-h-[160px]`} placeholder={`输入 ${i}...`} value={r} onChange={e => {
          return M(t, e.target.value);
        }} onWheel={e => {
          return e.stopPropagation();
        }} />
        </Component1322>
      </Component1323>;
  };
  let ne = c.covers && c.covers[0];
  let [re, V] = Z.useState(false);
  let [ae, oe] = Z.useState([]);
  let [H, se] = Z.useState(false);
  let [ce, U] = Z.useState(null);
  let [W, le] = Z.useState(``);
  let [G, ue] = Z.useState(1);
  Z.useEffect(() => {
    if (re) {
      ue(1);
      le(``);
    }
  }, [re]);
  Z.useEffect(() => {
    if (c.openAppSelectorOnMount) {
      V(true);
      r(e, {
        openAppSelectorOnMount: false
      });
    }
  }, [e, c.openAppSelectorOnMount, r]);
  let de = Z.useMemo(() => {
    let e = W.trim().toLowerCase();
    if (e) {
      return ae.filter(t => {
        return t.appName.toLowerCase().includes(e) || t.appId.includes(e);
      });
    } else {
      return ae;
    }
  }, [ae, W]);
  let pe = Z.useMemo(() => {
    let e = (G - 1) * 10;
    return de.slice(e, e + 10);
  }, [de, G]);
  let me = G * 10 < de.length;
  Z.useEffect(() => {
    if (!re || !u || !d) {
      return;
    }
    let e = false;
    se(true);
    U(null);
    let t = new URL(Yn(u));
    t.searchParams.set(`page`, `1`);
    t.searchParams.set(`pageSize`, `100`);
    fetch(t.toString(), {
      headers: {
        Authorization: `Bearer ${d}`
      }
    }).then(async t => {
      let n = await t.json();
      if (!t.ok || !n?.success) {
        throw Error(n?.error || `加载应用列表失败 HTTP ${t.status}`);
      }
      if (!e) {
        oe(Array.isArray(n.items) ? n.items : []);
      }
    }).catch(t => {
      if (!e) {
        U(t.message || `加载应用列表失败`);
      }
    }).finally(() => {
      if (!e) {
        se(false);
      }
    });
    return () => {
      e = true;
    };
  }, [re, u, d]);
  let he = Z.useCallback(e => {
    O(e, {
      resetValues: true
    });
    V(false);
  }, [O]);
  let ge = e => {
    let t = e.tags || [];
    if (Array.isArray(t)) {
      return t.map(e => {
        if (typeof e == `string`) {
          return e;
        } else {
          return e?.name || e?.tagName || ``;
        }
      }).filter(Boolean).slice(0, 3);
    } else {
      return [];
    }
  };
  const Component1324 = `div`;
  const Component1325 = `div`;
  const Component1326 = `div`;
  const Component1327 = `div`;
  const Component1328 = `button`;
  const Component1329 = `div`;
  const Component1330 = `input`;
  const Component1331 = `div`;
  const Component1332 = `span`;
  const Component1333 = `div`;
  const Component1334 = `div`;
  const Component1335 = `span`;
  const Component1336 = `div`;
  const Component1337 = `div`;
  const Component1338 = `div`;
  const Component1352 = `div`;
  const Component1353 = `div`;
  const Component1354 = `div`;
  const Component1355 = `button`;
  const Component1356 = `span`;
  const Component1357 = `button`;
  const Component1358 = `div`;
  const Component1359 = `div`;
  const Component1360 = `div`;
  let _e = re ? Fn.createPortal(<Component1360 className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 nowheel nopan nodrag`} onClick={() => {
    return V(false);
  }} onMouseDown={e => {
    return e.stopPropagation();
  }}>
          <Component1359 className={`relative w-[58vw] h-[66vh] max-w-[1080px] min-w-[720px] bg-[#141414] border border-[#2a2a2a] rounded-2xl shadow-2xl flex flex-col overflow-hidden`} onClick={e => {
      return e.stopPropagation();
    }}>
            <Component1329 className={`shrink-0 flex items-center gap-4 px-5 h-14 border-b border-[#222]`}>
              <Component1327 className={`flex items-center gap-2 min-w-0`}>
                <Component1324 className={`w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center`}>
                  <_Component48 size={16} className={`text-cyan-300`} />
                </Component1324>
                <Component1326 className={`min-w-0`}>
                  <Component1325 className={`text-sm text-white font-medium`}>{`应用市场`}</Component1325>
                </Component1326>
              </Component1327>
              <Component1328 onClick={() => {
          return V(false);
        }} className={`ml-auto p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a] rounded-lg`}>
                <Gt size={18} />
              </Component1328>
            </Component1329>
            <Component1334 className={`shrink-0 px-5 py-3 flex items-center gap-3 border-b border-[#1f1f1f]`}>
              <Component1331 className={`relative flex-1 max-w-md`}>
                <Ae className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500`} />
                <Component1330 type={`text`} className={`w-full pl-8 pr-3 py-2 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-gray-200 placeholder:text-gray-600 focus:border-gray-500 outline-none`} placeholder={`搜索应用名称或 ID`} value={W} onChange={e => {
            return le(e.target.value);
          }} />
              </Component1331>
              {l && <Component1333 className={`text-[11px] text-gray-500 truncate`}>
                  {`当前：`}
                  <Component1332 className={`text-gray-300`}>{c.webappName || l}</Component1332>
                </Component1333>}
            </Component1334>
            <Component1354 className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5`}>
              {d ? H ? <Component1336 className={`h-full flex flex-col items-center justify-center gap-3 text-sm text-gray-500`}>
                    <_cmp_Si size={34} />
                    <Component1335>{`加载应用中…`}</Component1335>
                  </Component1336> : ce ? <Component1337 className={`h-full flex items-center justify-center text-sm text-red-400`}>
                    {ce}
                  </Component1337> : de.length === 0 ? <Component1338 className={`h-full flex items-center justify-center text-sm text-gray-500`}>{`暂无已上架应用`}</Component1338> : <Component1352 className={`grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4`}>
                    {pe.map(e => {
            let t = e.appId === l;
            let n = e.coverUrl || e.iconUrl || ``;
            let r = ge(e);
            const Component1339 = `video`;
            const Component1340 = `img`;
            const Component1341 = `div`;
            const Component1342 = `p`;
            const Component1343 = `span`;
            const Component1344 = `span`;
            const Component1345 = `div`;
            const Component1346 = `div`;
            const Component1347 = `span`;
            const Component1348 = `span`;
            const Component1349 = `div`;
            const Component1350 = `div`;
            const Component1351 = `button`;
            return <Component1351 type={`button`} onClick={() => {
              return he(e.appId);
            }} className={`group relative rounded-xl overflow-hidden bg-[#1a1a1a] border transition-all text-left ${t ? `border-cyan-400/70 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]` : `border-transparent hover:border-white/30`}`} title={e.appName || e.appId} key={e.appId}>
                          <Component1350 className={`relative aspect-[242/355] bg-[#0d0c0c] overflow-hidden`}>
                            {n ? /\.(mp4|webm|mov|mkv|avi|m4v)(\?|$)/i.test(n) ? <Component1339 src={n} autoPlay={true} loop={true} muted={true} playsInline={true} className={`w-full h-full object-cover`} /> : <Component1340 src={n} alt={e.appName || e.appId} className={`w-full h-full object-cover`} draggable={false} /> : <Component1341 className={`w-full h-full flex items-center justify-center text-gray-700`}>
                                <B size={28} />
                              </Component1341>}
                            <Component1346 className={`absolute inset-x-0 bottom-0 pt-16 px-2.5 pb-2.5 bg-gradient-to-t from-black via-black/75 to-transparent`}>
                              <Component1342 className={`text-[13px] text-white font-medium truncate drop-shadow`}>
                                {e.appName || e.appId}
                              </Component1342>
                              {(r.length > 0 || e.preDeductAmountDefault != null) && <Component1345 className={`mt-1.5 flex flex-wrap gap-1.5`}>
                                  {r.map(e => {
                      return <Component1343 className={`px-1.5 py-0.5 rounded bg-white/15 text-[10px] text-gray-200 backdrop-blur-sm`} key={e}>
                                        {`#`}
                                        {e}
                                      </Component1343>;
                    })}
                                  {e.preDeductAmountDefault != null && <Component1344 className={`px-1.5 py-0.5 rounded bg-yellow-400/15 text-[10px] text-yellow-100 backdrop-blur-sm`}>
                                      {`预计≈`}
                                      {e.preDeductAmountDefault}
                                      {` 特惠币`}
                                    </Component1344>}
                                </Component1345>}
                            </Component1346>
                            {t && <Component1347 className={`absolute top-2 right-2 w-6 h-6 rounded-full bg-cyan-400 text-black flex items-center justify-center shadow`}>
                                <Se size={14} />
                              </Component1347>}
                            <Component1349 className={`absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center`}>
                              <Component1348 className={`px-3 py-1.5 rounded-lg bg-white text-xs text-black font-semibold`}>{`选择`}</Component1348>
                            </Component1349>
                          </Component1350>
                        </Component1351>;
          })}
                  </Component1352> : <Component1353 className={`h-full flex items-center justify-center text-sm text-amber-400`}>{`请先登录后选择应用`}</Component1353>}
            </Component1354>
            {d && !H && !ce && de.length > 0 && <Component1358 className={`shrink-0 flex items-center justify-center gap-4 py-3 border-t border-[#1f1f1f] bg-[#141414]`}>
                <Component1355 type={`button`} disabled={G <= 1} onClick={() => {
          return ue(e => {
            return Math.max(1, e - 1);
          });
        }} className={`px-4 py-1.5 rounded-lg bg-[#2a2a2a] text-sm text-gray-300 hover:bg-[#333] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}>{`上一页`}</Component1355>
                <Component1356 className={`text-sm text-gray-500`}>
                  {`第 `}
                  {G}
                  {` 页`}
                </Component1356>
                <Component1357 type={`button`} disabled={!me} onClick={() => {
          return ue(e => {
            return e + 1;
          });
        }} className={`px-4 py-1.5 rounded-lg bg-[#2a2a2a] text-sm text-gray-300 hover:bg-[#333] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}>{`下一页`}</Component1357>
              </Component1358>}
          </Component1359>
        </Component1360>, document.body) : null;
  const Component1361 = `span`;
  const Component1362 = `button`;
  const Component1363 = `div`;
  const Component1364 = `div`;
  const Component1365 = `span`;
  const Component1366 = `div`;
  const Component1367 = `button`;
  const Component1368 = `button`;
  const Component1369 = `div`;
  const Component1370 = `div`;
  const Component1371 = `div`;
  const Component1372 = `div`;
  const Component1373 = `span`;
  const Component1374 = `div`;
  const Component1375 = `div`;
  const Component1376 = `div`;
  const Component1377 = `button`;
  const Component1378 = `div`;
  const Component1379 = `div`;
  const Component1380 = `button`;
  const Component1381 = `div`;
  const Component1382 = `span`;
  const Component1383 = `span`;
  const Component1384 = `span`;
  const Component1385 = `span`;
  const Component1386 = `div`;
  const Component1387 = `div`;
  const Component1388 = `div`;
  const Component1389 = `video`;
  const Component1390 = `img`;
  const Component1391 = `div`;
  const Component1392 = `div`;
  const Component1393 = `div`;
  const Component1394 = `span`;
  const Component1395 = `div`;
  const Component1396 = `div`;
  const Component1397 = `div`;
  const Component1398 = `div`;
  const Component1399 = `div`;
  const Component1400 = `div`;
  const Component1401 = `div`;
  const Component1402 = `div`;
  return <Component1402 className={`flex flex-col items-center group/node transition-all ${n ? `z-50` : `z-10`}`}>
      <_cmp__Component8 id={e} data={t} defaultTitle={`AI应用`} icon={<B size={11} className={`text-gray-500`} />} />
      <Component1401 className={`relative bg-[#1c1c1c] rounded-xl border shadow-xl transition-all duration-300 flex flex-row ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`} style={{
      width: `100%`,
      height: `100%`,
      minWidth: 820,
      minHeight: 560,
      overflow: `visible`
    }}>
        <_cmp__Component9 minWidth={820} minHeight={560} />
        <Component1388 className={`flex-1 min-w-0 flex flex-col`}>
          <Component1363 className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 drag-handle cursor-move rounded-tl-xl`}>
            <Component1361 className={`font-semibold text-[13px] text-gray-100 flex-1 truncate`} title={c.webappName}>
              {c.webappName || `AI应用`}
            </Component1361>
            {l && <Component1362 className={`text-gray-400 hover:text-gray-100 hover:bg-[#2a2a2a] rounded p-1.5 nodrag`} onClick={e => {
            e.stopPropagation();
            V(true);
          }} title={`应用市场`}>
                <_Component48 size={14} />
              </Component1362>}
          </Component1363>
          <Component1375 className={`flex-1 min-h-0 px-4 py-4 flex flex-col gap-4`} onWheel={e => {
          return e.stopPropagation();
        }}>
            {c.schemaLoading && <Component1364 className={`flex items-center gap-2 text-xs text-gray-400 py-6 justify-center`}>
                <_Component25 size={12} className={`animate-spin`} />
                {`正在加载应用参数...`}
              </Component1364>}
            {c.schemaError && <Component1366 className={`text-red-400 text-[11px] p-2 border border-red-500/30 rounded bg-red-500/10 flex items-start gap-1.5`}>
                <_Component17 size={12} className={`mt-0.5`} />
                <Component1365>{c.schemaError}</Component1365>
              </Component1366>}
            {!c.schemaLoading && !l && !c.schemaError && <Component1372 className={`flex-1 flex flex-col items-center justify-center gap-6 nodrag`}>
                <Component1370 className={`flex flex-col items-center gap-3`}>
                  <Component1367 type={`button`} onClick={e => {
                e.stopPropagation();
                V(true);
              }} className={`w-20 h-20 rounded-2xl bg-[#242424] border border-[#333] hover:border-cyan-400/60 hover:bg-[#2a2a2a] flex items-center justify-center text-gray-400 hover:text-cyan-300 transition-colors`} title={`打开应用市场`}>
                    <_Component48 size={32} />
                  </Component1367>
                  <Component1369 className={`flex flex-col items-center gap-1.5`}>
                    <Component1368 type={`button`} onClick={e => {
                  e.stopPropagation();
                  V(true);
                }} className={`text-xs text-gray-400 hover:text-gray-200 transition-colors px-3 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a]`}>{`浏览应用`}</Component1368>
                  </Component1369>
                </Component1370>
                <Component1371 className={`text-sm text-gray-500`}>{`请选择 AI 应用开始创作`}</Component1371>
              </Component1372>}
            {!c.schemaLoading && m.map(te)}
            {c.errorMessage && <Component1374 className={`text-red-400 text-[11px] p-2 border border-red-500/30 rounded bg-red-500/10 flex items-start gap-1.5`}>
                <_Component17 size={12} className={`mt-0.5`} />
                <Component1373 className={`break-all`}>{c.errorMessage}</Component1373>
              </Component1374>}
          </Component1375>
          <Component1387 className={`flex-shrink-0 px-4 py-3 flex items-center justify-between gap-3 nodrag`}>
            {c.loading ? <Component1378 className={`flex items-center bg-[#2a2a2a] rounded-full p-1 pl-3 border border-[#333]`} title={`停止`} onClick={t => {
            t.stopPropagation();
            P();
            r(e, {
              loading: false,
              status: `IDLE`
            });
          }}>
                <Component1376 className={`flex items-center gap-1 mr-3 text-xs text-gray-300`}>
                  {c.status === `QUEUED` ? `排队中` : `运行中…`}
                </Component1376>
                <Component1377 className={`bg-red-500/20 text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-500/30 transition-colors cursor-pointer`}>
                  <T size={10} fill={`currentColor`} />
                </Component1377>
              </Component1378> : <Component1381 className={`flex items-center bg-[#2a2a2a] rounded-full p-1 pl-3 border border-[#333] hover:border-gray-500 transition-colors cursor-pointer group/btn ${!N || c.schemaLoading ? `opacity-50 cursor-not-allowed` : ``}`} onClick={e => {
            e.stopPropagation();
            if (!!N && !c.schemaLoading) {
              ee();
            }
          }} title={N ? `` : `等待文件上传完成`}>
                <Component1379 className={`flex items-center gap-1 mr-3 text-xs text-gray-300 group-hover/btn:text-white`}>{`运行`}</Component1379>
                <Component1380 className={`bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors`}>
                  <_Component43 size={12} fill={`currentColor`} />
                </Component1380>
              </Component1381>}
            {!c.loading && (c.taskCostTime != null || c.consumeMoney != null || c.preDeductAmount != null) && <Component1386 className={`text-[12px] text-gray-400 tabular-nums text-right`}>
                  {c.preDeductAmount != null && c.loading === false && c.consumeMoney == null && <Component1383 className={`mr-2`}>
                      {`预计预扣 `}
                      <Component1382 className={`text-yellow-300`}>
                        {c.preDeductAmount}
                      </Component1382>
                      {` 特惠币`}
                    </Component1383>}
                  {(c.taskCostTime != null || c.consumeMoney != null) && <Q.Fragment>
                      {`上次运行了 `}
                      <Component1384 className={`text-gray-200`}>
                        {c.taskCostTime ?? `-`}
                      </Component1384>
                      {` 秒，实扣 `}
                      <Component1385 className={`text-yellow-300`}>
                        {c.consumeMoney ?? `-`}
                        {` `}
                      </Component1385>
                      {`特惠币`}
                    </Q.Fragment>}
                </Component1386>}
          </Component1387>
        </Component1388>
        <Component1400 className={`flex-shrink-0 w-[312px] relative rounded-r-xl overflow-hidden bg-[#141414]`}>
          {ne && <Component1392 className={`absolute inset-x-0 top-0`}>
              {/\.(mp4|webm|mov|mkv|avi|m4v)(\?|$)/i.test(ne.url || ne.thumbnailUri || ``) ? <Component1389 src={ne.url || ne.thumbnailUri} className={`w-full h-auto block select-none`} autoPlay={true} loop={true} muted={true} playsInline={true} /> : <Component1390 src={ne.url || ne.thumbnailUri} className={`w-full h-auto block select-none`} alt={`banner`} draggable={false} />}
              <Component1391 className={`absolute inset-x-0 -bottom-1 h-[25%] bg-gradient-to-t from-[#141414] to-transparent pointer-events-none`} />
            </Component1392>}
          {ne && c.loading && <Component1393 className={`absolute inset-0 flex items-center justify-center bg-black/40 z-20`}>
              <_Component25 size={22} className={`animate-spin text-white drop-shadow`} />
            </Component1393>}
          {(c.webappTags?.length || c.webappDesc) && <Component1398 className={`absolute inset-0 flex flex-col justify-end z-10 pointer-events-none opacity-0 group-hover/node:opacity-100 group-focus-within/node:opacity-100 transition-opacity duration-300`}>
              <Component1397 className={`max-h-[75%] overflow-auto custom-scrollbar nowheel px-3 pt-14 pb-3 flex flex-col gap-2 nodrag pointer-events-auto bg-gradient-to-t from-black via-black/85 to-transparent`} onWheel={e => {
            return e.stopPropagation();
          }}>
                {c.webappTags && c.webappTags.length > 0 && <Component1395 className={`flex flex-wrap gap-1`}>
                    {c.webappTags.map(e => {
                return <Component1394 className={`text-[10px] text-pink-200 bg-pink-500/20 rounded px-1.5 py-0.5`} key={e}>
                          {`#`}
                          {e}
                        </Component1394>;
              })}
                  </Component1395>}
                {c.webappDesc && <Component1396 className={`text-[12px] text-gray-100 leading-relaxed rh-app-desc`} dangerouslySetInnerHTML={{
              __html: Zs(c.webappDesc.length > 30 ? `${c.webappDesc.slice(0, 30)}...` : c.webappDesc)
            }} />}
              </Component1397>
            </Component1398>}
          {l && !ne && !c.webappDesc && !c.webappTags?.length && <Component1399 className={`absolute inset-0 flex items-center justify-center text-gray-700 pointer-events-none`}>
              <_Component2 size={40} />
            </Component1399>}
        </Component1400>
        <_cmp__Component12 type={`source`} position={X.Right} variant={`small`} />
      </Component1401>
      {_e}
    </Component1402>;
});
export default $s;