/**
 * 节点类型: rhWebappNode
 * 原版函数名: Ms
 * 原版行号: L14637-L16030
 * 来源: App-B9jVCs-a.decompiled.js
 *
 * 变量映射（vendor-map.json）:
// _ → tU
// _r → Rl
// a → ZK
// ar → Xl
// at → W_
// b → dT
// c → tK
// ct → qd
// d → zG
// e → i
// f → MG
// g → qU
// h → xW
// i → jq
// in → Zu
// ir → Zl
// j → GE
// jn → wu
// k → cO
// l → VG
// m → LW
// mr → Vl
// mt → Vd
// n → Fq
// o → oK
// p → VW
// pr → Hl
// pt → Hd
// r → Nq
// rr → Ql
// s → iK
// t → e1
// u → BG
// ut → Gd
// v → XH
// w → xT
// x → Y
// y → Mk
// yn → Iu
// z → Rw
 */

var Ms = Y.memo(({
    id: e,
    data: n,
    selected: i
  }) => {
    let {
        updateNodeData: a,
        setNodes: o,
        setEdges: s,
        getNode: c
      } = Gt(),
      l = Et(),
      d = n,
      f = d.webappId || ``,
      p = ar(d.aiAppApiUrl),
      m = d.aiAppApiKey || ``,
      [h, g] = Y.useState(null);
    Y.useEffect(() => {
      if (!h) return;
      let e = () => g(null);
      return document.addEventListener(`mousedown`, e), () => document.removeEventListener(`mousedown`, e);
    }, [h]);
    let _ = Y.useMemo(() => d.schema || [], [d.schema]),
      v = Y.useMemo(() => d.values || {}, [d.values]),
      y = Y.useMemo(() => d.uploadStatus || {}, [d.uploadStatus]),
      b = Y.useMemo(() => d.uploadError || {}, [d.uploadError]),
      x = t({
        handleType: `target`
      }),
      S = ut(Y.useMemo(() => Array.from(new Set(x.map(e => e.source))), [x])),
      C = Y.useMemo(() => _.filter(e => [`IMAGE`, `VIDEO`, `AUDIO`].includes(xs(e))), [_]),
      w = Y.useMemo(() => _.filter(e => ![`IMAGE`, `VIDEO`, `AUDIO`].includes(xs(e))), [_]);
    Y.useEffect(() => {
      let t = window.requestAnimationFrame(() => l(e));
      return () => window.cancelAnimationFrame(t);
    }, [e, _, l]);
    let T = Y.useRef(null),
      E = Y.useRef(false),
      D = Y.useRef(null),
      O = Y.useRef({}),
      k = Y.useRef({}),
      A = Y.useCallback(async (t, n) => {
        if (!p || !m) {
          a(e, {
            schemaLoading: false,
            schemaError: `请先登录以使用 AI 应用`
          });
          return;
        }
        a(e, {
          schemaLoading: true,
          schemaError: undefined
        });
        let r = new AbortController(),
          i = window.setTimeout(() => r.abort(), 15e3);
        try {
          let i = await fetch(ir(p, t), {
              headers: {
                Authorization: `Bearer ${m}`
              },
              signal: r.signal
            }),
            o = await i.json();
          if (i.status === 404) throw Error(o?.error || `应用不存在或已下架，请重新选择应用`);
          if (!i.ok || !o?.success) throw Error(o?.error || `加载失败 HTTP ${i.status}`);
          let s = o.data || {},
            c = (s.nodeInfoList || []).map(e => ({
              nodeId: String(e.nodeId),
              nodeName: e.nodeName,
              fieldName: e.fieldName,
              fieldValue: e.fieldValue,
              fieldData: e.fieldData,
              fieldType: (e.fieldType || ``).toUpperCase(),
              description: e.description,
              descriptionEn: e.descriptionEn
            })),
            l = {};
          c.forEach(e => {
            e.fieldValue !== undefined && (l[Ss(e)] = String(e.fieldValue));
          });
          let u = Array.isArray(s.covers) ? s.covers : [],
            f = s.tags ?? [],
            h = Array.isArray(f) ? f.map(e => typeof e == `string` ? e : e?.name || e?.tagName || ``).filter(Boolean) : [];
          a(e, {
            webappId: t,
            schema: c,
            webappName: s.appName || `AI应用`,
            webappDesc: s.description || ``,
            webappTags: h,
            covers: u,
            preDeductAmount: s.preDeductAmountDefault ?? null,
            values: n?.resetValues ? l : {
              ...l,
              ...(d.values || {})
            },
            uploadStatus: n?.resetValues ? {} : d.uploadStatus || {},
            uploadError: n?.resetValues ? {} : d.uploadError || {},
            uploadSourceSig: n?.resetValues ? {} : d.uploadSourceSig || {},
            schemaLoading: false
          }), O.current = n?.resetValues ? {} : {
            ...(d.uploadSourceSig || {})
          };
        } catch (t) {
          a(e, {
            schemaLoading: false,
            schemaError: t?.name === `AbortError` ? `加载超时（15s），请检查网络或应用 ID` : t?.message || `加载失败`
          });
        } finally {
          window.clearTimeout(i);
        }
      }, [e, p, m]);
    Y.useEffect(() => {
      _.length > 0 || !d.webappId || A(d.webappId);
    }, [e]);
    let j = Y.useRef(m);
    Y.useEffect(() => {
      let e = j.current;
      if (j.current = m, !p || !m || !d.webappId) return;
      let t = !e && !!m,
        n = !!d.schemaError && /登录/.test(d.schemaError);
      (t || n && _.length === 0) && A(d.webappId);
    }, [p, m, d.webappId, d.schemaError, _.length, A]), Y.useEffect(() => {
      C.length !== 0 && C.forEach(t => {
        let n = Ss(t),
          r = x.find(e => e.targetHandle === `var-${n}`),
          i = xs(t);
        if (!r) {
          O.current[n] && (O.current[n] = ``, a(e, {
            values: {
              ...(d.values || {}),
              [n]: ``
            },
            uploadStatus: {
              ...(d.uploadStatus || {}),
              [n]: `idle`
            },
            uploadError: {
              ...(d.uploadError || {}),
              [n]: ``
            },
            uploadSourceSig: {
              ...(d.uploadSourceSig || {}),
              [n]: ``
            }
          }));
          return;
        }
        let o = S.find(e => e?.id === r.source);
        if (!o || !o.data) return;
        let s = o.data,
          c = s.imageUrl || s.videoUrl || s.audioUrl || ``,
          l = ``;
        if (i === `IMAGE` ? l = s.imageUrl && !/\.(mp4|webm|mov|mkv|avi|m4v)(\?|$)/i.test(String(s.imageUrl)) ? s.imageUrl : `` : i === `VIDEO` ? l = s.videoUrl || (s.imageUrl && /\.(mp4|webm|mov|mkv|avi|m4v)(\?|$)/i.test(String(s.imageUrl)) ? s.imageUrl : ``) : i === `AUDIO` && (l = s.audioUrl || (s.imageUrl && /\.(mp3|wav|ogg|m4a|flac|aac|opus|wma|aiff)(\?|$)/i.test(String(s.imageUrl)) ? s.imageUrl : ``)), l ||= c, !l) return;
        let u = i === `IMAGE` ? `image` : i === `VIDEO` ? `video` : `audio`,
          f = js(l);
        if (f !== `unknown` && f !== u) {
          let t = `bad#${r.source}#${r.sourceHandle ?? ``}#${l}`;
          if (O.current[n] !== t) {
            O.current[n] = t;
            let r = {
              image: `图片`,
              video: `视频`,
              audio: `音频`
            };
            a(e, {
              uploadStatus: {
                ...(d.uploadStatus || {}),
                [n]: `error`
              },
              uploadError: {
                ...(d.uploadError || {}),
                [n]: `该字段需要${r[u]}，但接入的是${r[f] || f}`
              }
            });
          }
          return;
        }
        let h = `${r.source}#${r.sourceHandle ?? ``}#${l}`;
        if (O.current[n] === h || (d.uploadSourceSig || {})[n] === h && (d.values || {})[n] && (d.uploadStatus || {})[n] === `done`) {
          O.current[n] = h;
          return;
        }
        O.current[n] = h, (async () => {
          a(e, {
            uploadStatus: {
              ...(d.uploadStatus || {}),
              [n]: `uploading`
            },
            uploadError: {
              ...(d.uploadError || {}),
              [n]: ``
            }
          });
          try {
            let t = await Ts(await Es(l), p, m, (() => {
              try {
                let e = new URL(l);
                return decodeURIComponent(e.pathname.split(`/`).pop() || `upload.bin`);
              } catch {
                return `upload.bin`;
              }
            })());
            a(e, {
              values: {
                ...(d.values || {}),
                [n]: t
              },
              uploadStatus: {
                ...(d.uploadStatus || {}),
                [n]: `done`
              },
              uploadSourceSig: {
                ...(d.uploadSourceSig || {}),
                [n]: h
              }
            });
          } catch (t) {
            a(e, {
              uploadStatus: {
                ...(d.uploadStatus || {}),
                [n]: `error`
              },
              uploadError: {
                ...(d.uploadError || {}),
                [n]: t?.message || `上传失败`
              }
            });
          }
        })();
      });
    }, [x, S, C, e]), Y.useEffect(() => {
      w.length !== 0 && w.forEach(t => {
        let n = Ss(t),
          r = x.find(e => e.targetHandle === `var-${n}`);
        if (!r) {
          k.current[n] && (k.current[n] = ``, a(e, {
            values: {
              ...(d.values || {}),
              [n]: ``
            }
          }));
          return;
        }
        let i = hs(S.find(e => e?.id === r.source)).trim();
        if (!i) return;
        let o = `${r.source}#${r.sourceHandle ?? ``}#${i}`;
        if (k.current[n] === o) return;
        k.current[n] = o;
        let s = xs(t),
          c = i;
        s === `LIST` && (c = Cs(i, bs(t.fieldData))), s === `BOOLEAN` && (c = /^(true|1|yes|是|开)$/i.test(i) ? `true` : /^(false|0|no|否|关)$/i.test(i) ? `false` : i), a(e, {
          values: {
            ...(d.values || {}),
            [n]: c
          }
        });
      });
    }, [x, S, w, e]);
    let M = Y.useCallback(async (t, n, r) => {
        let i = (n.name || ``).toLowerCase(),
          l = n.type.startsWith(`audio/`) || /\.(mp3|wav|ogg|m4a|flac|aac|opus|wma|aiff)$/i.test(i),
          u = n.type.startsWith(`video/`) || /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(i),
          d = n.type.startsWith(`image/`) || /\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i.test(i),
          f = l ? `audio` : u ? `video` : d ? `image` : `unknown`,
          p = r === `IMAGE` ? `image` : r === `VIDEO` ? `video` : `audio`;
        if (f !== `unknown` && f !== p) {
          let n = {
            image: `图片`,
            video: `视频`,
            audio: `音频`
          };
          a(e, {
            uploadStatus: {
              ...(y || {}),
              [t]: `error`
            },
            uploadError: {
              ...(b || {}),
              [t]: `该字段需要${n[p]}，请选择${n[p]}文件`
            }
          });
          return;
        }
        let m = URL.createObjectURL(n);
        try {
          let e = await Xr(n, {
            subfolder: `canvas/upload`,
            generateThumb: p === `image`,
            thumbMaxDim: 480,
            thumbQuality: 75
          });
          e?.url && (m = e.url);
        } catch {}
        let h = c(e),
          g = h?.position?.x ?? 0,
          _ = h?.position?.y ?? 0,
          v = C.findIndex(e => Ss(e) === t),
          x = `${e}-in-${t}-${Date.now()}`,
          S;
        S = p === `audio` ? {
          id: x,
          type: `audioPlayerNode`,
          position: {
            x: g - 420,
            y: _ + Math.max(0, v) * 240
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
        } : {
          id: x,
          type: `imageNode`,
          position: {
            x: g - 420,
            y: _ + Math.max(0, v) * 280
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
        let w = {
          id: `e-${x}-${e}`,
          source: x,
          sourceHandle: null,
          target: e,
          targetHandle: `var-${t}`
        };
        o(e => e.concat(S)), s(e => e.concat(w));
      }, [e, a, y, b, c, C, o, s]),
      N = Y.useCallback(t => {
        s(n => n.filter(n => !(n.target === e && n.targetHandle === `var-${t}`)));
      }, [e, s]),
      P = Y.useCallback((t, n) => {
        a(e, {
          values: {
            ...(d.values || {}),
            [t]: n
          }
        });
      }, [e, a, d.values]),
      F = Y.useMemo(() => C.every(e => y[Ss(e)] === `done`), [C, y]),
      I = Y.useCallback(() => {
        E.current = true, D.current = null, T.current &&= (window.clearTimeout(T.current), null);
      }, []),
      ee = Y.useCallback(t => {
        let n = c(e);
        if (!n) return;
        let r = (n.position?.x ?? 0) + (n.width || 560) + 80,
          i = n.position?.y ?? 0,
          a = [],
          l = [],
          u = i;
        t.forEach((t, n) => {
          let i = js(t.url, t.outputType),
            o = `${e}-out-${Date.now()}-${n}`,
            s,
            c,
            d;
          i === `image` ? (s = `imageNode`, c = {
            width: 360,
            height: 360
          }, d = {
            imageUrl: t.url,
            thumbnailUrl: t.thumbnailUrl,
            label: `结果${n + 1}`
          }) : i === `video` ? (s = `imageNode`, c = {
            width: 360,
            height: 240
          }, d = {
            imageUrl: t.url,
            thumbnailUrl: t.thumbnailUrl,
            label: `视频${n + 1}`
          }) : i === `audio` ? (s = `audioPlayerNode`, c = {
            width: 360,
            height: 220
          }, d = {
            audioUrl: t.url,
            audioName: `音频${n + 1}`,
            label: `音频${n + 1}`
          }) : i === `text` || !t.url && t.text ? (s = `textNode`, c = {
            width: 360,
            height: 200
          }, d = {
            text: t.text || ``,
            label: `文本${n + 1}`,
            expanded: true
          }) : (s = `textNode`, c = {
            width: 360,
            height: 120
          }, d = {
            text: t.url || ``,
            label: `结果${n + 1}`,
            expanded: true
          });
          let f = {
            id: o,
            type: s,
            position: {
              x: r,
              y: u
            },
            style: c,
            data: {
              ...d,
              hasChanged: true
            }
          };
          u += (c?.height || 240) + 30, a.push(f), l.push({
            id: `e-${e}-${o}`,
            source: e,
            sourceHandle: null,
            target: o,
            targetHandle: null
          });
        }), a.length > 0 && (o(e => e.concat(a)), s(e => e.concat(l)));
      }, [c, e, o, s]),
      R = Y.useCallback(async t => {
        if (D.current === t) return;
        D.current = t, E.current = false;
        let n = Date.now(),
          r = async () => {
            if (!E.current) {
              if (Date.now() - n > 6e5) {
                a(e, {
                  loading: false,
                  status: `FAILED`,
                  errorMessage: `任务轮询超时`
                }), d.updateGlobalTasks?.(e => e.map(e => e.taskId === t ? {
                  ...e,
                  status: `failed`,
                  errorMsg: `任务轮询超时`
                } : e)), D.current = null;
                return;
              }
              try {
                let n = await fetch(rr(p, `/task/${encodeURIComponent(t)}`), {
                    headers: {
                      Authorization: `Bearer ${m}`
                    }
                  }),
                  r = await n.json();
                if (!n.ok) throw Error(r?.error || `轮询失败 HTTP ${n.status}`);
                let i = String(r?.status || ``).toUpperCase();
                if (i === `SUCCESS`) {
                  let n = Array.isArray(r?.results) ? r.results : [],
                    i = r?.finalPrice == null ? null : Number(r.finalPrice),
                    o = i != null && i > 0 ? String(i).replace(/\.?0+$/, ``) : null,
                    s = r?.usage?.taskCostTime ?? null,
                    c = e => e ? /^(https?:|data:|blob:)/i.test(e) ? e : `${p.replace(/\/api\/?$/i, ``).replace(/\/$/, ``)}/${e.replace(/^\/+/, ``)}` : ``,
                    l = await Promise.all(n.map(async e => {
                      let t = c(String(e.url || ``).trim().replace(/^`+|`+$/g, ``));
                      if (!t) return {
                        ...e,
                        url: ``
                      };
                      let n = js(t, e.outputType);
                      if (n === `text` || /\.(txt|md|json|csv|log|xml|ya?ml|srt|vtt)(\?|$)/i.test(t)) try {
                        let n = await fetch(t).catch(() => null);
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
                      try {
                        let r = await Xr(t, {
                          subfolder: `tasks`,
                          generateThumb: n === `image`,
                          thumbMaxDim: 480,
                          thumbQuality: 75
                        });
                        if (r?.url) {
                          let t = r.thumbnailUrl;
                          return !t && n === `image` && (t = (await ri(r.url, {
                            maxDim: 480,
                            quality: 75
                          })) || undefined), {
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
                  a(e, {
                    loading: false,
                    status: `SUCCESS`,
                    consumeMoney: o,
                    finalPrice: i,
                    taskCostTime: s,
                    lastResultTaskId: t
                  }), ee(l);
                  let u = d.addTransitResource;
                  u && l.forEach(e => {
                    if (!e?.url) return;
                    let t = js(e.url, e.outputType),
                      n = t === `video` ? `video` : t === `audio` ? `audio` : t === `text` ? `text` : `image`;
                    u(e.url, n, `generated`);
                  });
                  let f = l.find(e => !!e?.url),
                    m = f?.url || ``,
                    h = f?.thumbnailUrl,
                    g = js(m),
                    _ = g === `video` ? `video` : g === `audio` ? `audio` : g === `text` ? `text` : `image`;
                  d.updateGlobalTasks?.(e => e.map(e => e.taskId === t ? {
                    ...e,
                    status: `completed`,
                    progress: 100,
                    resultUrl: m || e.resultUrl,
                    thumbnailUrl: h || e.thumbnailUrl,
                    customResultData: m || e.resultUrl,
                    customOutputType: _,
                    responseData: r
                  } : e)), D.current = null;
                  return;
                }
                if (i === `FAILED`) {
                  let n = r?.errorMessage || r?.errorCode || `任务失败`;
                  a(e, {
                    loading: false,
                    status: `FAILED`,
                    errorMessage: n
                  }), d.updateGlobalTasks?.(e => e.map(e => e.taskId === t ? {
                    ...e,
                    status: `failed`,
                    errorMsg: n,
                    responseData: r
                  } : e)), D.current = null;
                  return;
                }
                a(e, {
                  status: i === `QUEUED` ? `QUEUED` : `RUNNING`
                }), d.updateGlobalTasks?.(e => e.map(e => e.taskId === t ? {
                  ...e,
                  status: `running`
                } : e));
              } catch {}
              T.current = window.setTimeout(r, 3e3);
            }
          };
        T.current = window.setTimeout(r, 1500);
      }, [e, p, m, a, ee, d.addTransitResource, d.updateGlobalTasks]),
      z = Y.useCallback(async () => {
        if (!d.loading) {
          if (!p || !m) {
            let t = `请先登录以使用 AI 应用`;
            a(e, {
              errorMessage: t
            }), d.onShowToast?.(t);
            return;
          }
          if (!ys(d.membershipType)) {
            let t = `AI 应用需要 VIP 或以上会员`;
            a(e, {
              errorMessage: t
            }), d.onShowToast?.(t);
            return;
          }
          if (!f) {
            let t = `请先选择 AI 应用`;
            a(e, {
              errorMessage: t
            }), d.onShowToast?.(t);
            return;
          }
          if (!F) {
            a(e, {
              errorMessage: `存在未完成的文件上传，请等待打勾后再运行`
            });
            return;
          }
          a(e, {
            loading: true,
            status: `QUEUED`,
            errorMessage: undefined,
            consumeMoney: null,
            finalPrice: null,
            taskCostTime: null,
            taskId: undefined
          });
          try {
            let t = _.map(e => {
                let t = Ss(e),
                  n = (d.values || {})[t] ?? e.fieldValue ?? ``;
                xs(e) === `LIST` && (n = Cs(String(n ?? ``), bs(e.fieldData)));
                let r = {
                  nodeId: e.nodeId,
                  fieldName: e.fieldName,
                  fieldValue: String(n ?? ``)
                };
                return e.description && (r.description = e.description), r;
              }),
              n = {
                appId: f,
                instanceType: `default`,
                nodeInfoList: t
              },
              r = await fetch(rr(p, `/run`), {
                method: `POST`,
                headers: {
                  "Content-Type": `application/json`,
                  Authorization: `Bearer ${m}`
                },
                body: JSON.stringify(n)
              }),
              i = await r.json();
            if (!r.ok) throw r.status === 402 ? Error(`特惠币余额不足`) : r.status === 403 ? Error(i?.error || `需要 VIP 会员`) : Error(i?.error || `发起任务失败`);
            let o = String(i?.taskId || i?.task_id || ``);
            if (!o) throw Error(`未拿到 taskId`);
            i?.preDeducted != null && a(e, {
              preDeductAmount: Number(i.preDeducted)
            }), a(e, {
              taskId: o,
              status: `RUNNING`
            });
            let s = (() => {
              let e = [];
              return t.forEach(t => {
                let n = String(t.fieldValue ?? ``);
                if (!n) return;
                let r = n.length > 80 ? `${n.slice(0, 80)}…` : n;
                e.push(`${t.description || t.fieldName}: ${r}`);
              }), e.join(` | `);
            })();
            d.updateGlobalTasks?.(t => {
              let r = t.filter(t => t.nodeId !== e || t.status === `completed` || t.status === `failed`);
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
                modelName: `应用 · ${d.webappName || f}`,
                requestData: n
              }, ...r];
            }), R(o);
          } catch (t) {
            a(e, {
              loading: false,
              status: `FAILED`,
              errorMessage: t?.message || `请求失败`
            }), d.onShowToast?.(t?.message || `请求失败`);
          }
        }
      }, [F, p, m, e, d.loading, d.membershipType, d.onShowToast, d.updateGlobalTasks, d.values, d.webappName, R, _, a, f]);
    Y.useEffect(() => {
      let t = t => {
        t.detail?.nodeId === e && z();
      };
      return window.addEventListener(vs, t), () => window.removeEventListener(vs, t);
    }, [e, z]), Y.useEffect(() => () => I(), [I]);
    let B = Y.useRef(null);
    Y.useEffect(() => {
      let e = d.taskId;
      e && d.status !== `FAILED` && d.lastResultTaskId !== e && B.current !== e && D.current !== e && (B.current = e, R(e));
    }, [d.taskId, d.status, d.lastResultTaskId, R]);
    let te = (e, t) => {
        let n = String(e ?? ``).trim();
        if (!n) return t === `FLOAT` ? .1 : 1;
        let r = n.indexOf(`.`);
        return r === -1 ? 1 : 10 ** -(n.length - r - 1);
      },
      ne = e => {
        let t = Ss(e),
          n = xs(e),
          i = v[t] ?? ``,
          a = e.description || e.fieldName,
          o = X.jsx(_r, {
            type: `target`,
            id: `var-${t}`,
            position: J.Left,
            variant: `small`,
            title: `连接到变量: ${a}`,
            style: {
              top: 18
            },
            ballOutset: 10
          }),
          s = (e, t) => X.jsxs(`div`, {
            className: `w-[120px] flex-shrink-0 pt-2 flex items-start gap-1 text-[12px] text-gray-200`,
            children: [e && X.jsx(`span`, {
              className: `mt-[2px]`,
              children: e
            }), X.jsx(`span`, {
              className: `font-medium leading-snug break-words`,
              title: a,
              children: a
            }), t === `uploading` && X.jsx(L, {
              size: 11,
              className: `animate-spin text-blue-400 ml-auto flex-shrink-0`
            }), t === `done` && X.jsx(Pn, {
              size: 12,
              className: `text-green-400 ml-auto flex-shrink-0`
            }), t === `error` && X.jsx(pt, {
              size: 12,
              className: `text-red-400 ml-auto flex-shrink-0`
            })]
          });
        if ([`IMAGE`, `VIDEO`, `AUDIO`].includes(n)) {
          let e = ws[n] || Ot,
            r = y[t] || `idle`,
            i = x.find(e => e.targetHandle === `var-${t}`),
            a = i ? S.find(e => e?.id === i.source) : null,
            c = a?.data?.imageUrl || a?.data?.videoUrl || a?.data?.audioUrl || ``,
            l = n === `IMAGE` ? `image` : n === `VIDEO` ? `video` : `audio`,
            u = js(c),
            d = u === `unknown` ? l : u;
          return X.jsxs(`div`, {
            className: `flex flex-row items-start gap-3 nodrag`,
            style: {
              position: `relative`
            },
            children: [o, s(X.jsx(e, {
              size: 13,
              className: `text-gray-400`
            }), r), X.jsxs(`div`, {
              className: `flex-1 min-w-0 flex`,
              children: [X.jsx(`div`, {
                className: `relative flex-shrink-0`,
                style: {
                  width: 240,
                  height: 240
                },
                children: i || c ? X.jsxs(`div`, {
                  className: `absolute inset-0 rounded-lg overflow-hidden border border-[#333] bg-black`,
                  children: [c && d === `image` && X.jsx(`img`, {
                    src: c,
                    className: `w-full h-full object-contain`
                  }), c && d === `video` && X.jsx(`video`, {
                    src: c,
                    className: `w-full h-full object-contain bg-black`,
                    controls: true,
                    preload: `metadata`
                  }), c && d === `audio` && X.jsx(`div`, {
                    className: `absolute inset-0 flex items-center justify-center p-3`,
                    children: X.jsx(`audio`, {
                      src: c,
                      controls: true,
                      className: `w-full`
                    })
                  }), !c && X.jsx(`div`, {
                    className: `absolute inset-0 flex items-center justify-center text-[11px] text-gray-500`,
                    children: `已连线，等待来源…`
                  }), r === `uploading` && X.jsx(`div`, {
                    className: `absolute inset-0 bg-black/40 flex items-center justify-center`,
                    children: X.jsx(L, {
                      size: 26,
                      className: `animate-spin text-white drop-shadow`
                    })
                  }), r === `done` && X.jsx(`div`, {
                    className: `absolute top-1.5 right-1.5 bg-green-500/90 rounded-full p-1 shadow`,
                    children: X.jsx(Pn, {
                      size: 12,
                      className: `text-white`
                    })
                  }), r !== `uploading` && X.jsx(`button`, {
                    className: `absolute top-1.5 left-1.5 bg-black/60 hover:bg-red-500/80 text-white rounded-full p-1 shadow transition-colors`,
                    title: `断开连线`,
                    onClick: e => {
                      e.stopPropagation(), N(t);
                    },
                    children: X.jsx(yn, {
                      size: 12
                    })
                  })]
                }) : X.jsxs(`label`, {
                  className: `absolute inset-0 border border-dashed border-[#444] hover:border-blue-500 rounded-lg flex flex-col items-center justify-center cursor-pointer text-gray-500 hover:text-blue-400 transition-colors text-[12px] gap-1.5 bg-[#0d0c0c]`,
                  children: [r === `error` ? X.jsxs(X.Fragment, {
                    children: [X.jsx(pt, {
                      size: 20,
                      className: `text-red-400`
                    }), X.jsx(`span`, {
                      children: `请重新选择`
                    })]
                  }) : X.jsxs(X.Fragment, {
                    children: [X.jsx(jn, {
                      size: 22
                    }), X.jsx(`span`, {
                      children: n === `IMAGE` ? `点击上传图片` : n === `VIDEO` ? `点击上传视频` : `点击上传音频`
                    }), X.jsx(`span`, {
                      className: `text-[10px] text-gray-600`,
                      children: `或从左侧连线接入`
                    })]
                  }), X.jsx(`input`, {
                    type: `file`,
                    accept: n === `IMAGE` ? `image/*` : n === `VIDEO` ? `video/*` : `audio/*,.flac,.aac,.opus,.m4a,.wma,.aiff`,
                    className: `hidden`,
                    onChange: e => {
                      let r = e.target.files?.[0];
                      r && M(t, r, n);
                    }
                  })]
                })
              }), b[t] && X.jsxs(`div`, {
                className: `ml-2 text-red-400 text-[10px] flex items-start gap-1`,
                children: [X.jsx(pt, {
                  size: 11,
                  className: `mt-0.5`
                }), ` `, b[t]]
              })]
            })]
          }, t);
        }
        if (n === `LIST`) {
          let n = bs(e.fieldData),
            r = Cs(i, n),
            a = n.find(e => e.index === r),
            c = a?.description || a?.name || r || `请选择`,
            l = h === t;
          return X.jsxs(`div`, {
            className: `flex flex-row items-start gap-3 nodrag`,
            style: {
              position: `relative`
            },
            children: [o, s(), X.jsx(`div`, {
              className: `flex-1 min-w-0`,
              children: X.jsxs(`div`, {
                className: `relative inline-flex max-w-full`,
                onMouseDown: e => e.stopPropagation(),
                children: [X.jsxs(`button`, {
                  type: `button`,
                  onClick: e => {
                    e.stopPropagation(), g(l ? null : t);
                  },
                  className: `flex items-center gap-2 h-9 pl-3 pr-2 bg-[#0d0c0c] border rounded-full text-[12.5px] text-gray-100 hover:border-gray-500 transition-colors cursor-pointer max-w-full ${l ? `border-blue-500` : `border-[#333]`}`,
                  title: c,
                  children: [X.jsx(`span`, {
                    className: `truncate`,
                    children: c
                  }), X.jsx(Sn, {
                    size: 14,
                    className: `text-gray-400 shrink-0 transition-transform ${l ? `rotate-180` : ``}`
                  })]
                }), l && X.jsxs(`div`, {
                  className: `absolute top-full left-0 mt-1 min-w-[14rem] w-max max-w-[24rem] bg-[#222] border border-[#333] rounded-lg shadow-xl p-1.5 z-50 max-h-60 overflow-y-auto custom-scrollbar nowheel nopan nodrag`,
                  onClick: e => e.stopPropagation(),
                  onMouseDown: e => e.stopPropagation(),
                  children: [n.length === 0 && X.jsx(`div`, {
                    className: `px-3 py-2 text-[12px] text-gray-500`,
                    children: `无可选项`
                  }), n.map(e => {
                    let n = e.description || e.name,
                      i = e.index === r;
                    return X.jsxs(`button`, {
                      type: `button`,
                      onClick: () => {
                        P(t, e.index), g(null);
                      },
                      className: `w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-[12.5px] transition-colors ${i ? `bg-blue-500/15 text-blue-200` : `text-gray-200 hover:bg-white/[0.06]`}`,
                      title: n,
                      children: [X.jsx(`span`, {
                        className: `flex-1 min-w-0 truncate`,
                        children: n
                      }), i && X.jsx(Pn, {
                        size: 13,
                        className: `text-blue-300 shrink-0`
                      })]
                    }, e.index);
                  })]
                })]
              })
            })]
          }, t);
        }
        if (n === `INT` || n === `FLOAT`) {
          let e = te(i, n),
            a = (() => {
              let t = String(e),
                n = t.indexOf(`.`);
              return n === -1 ? 0 : t.length - n - 1;
            })(),
            c = e => {
              let r = (Number(i) || 0) + e;
              r = n === `INT` ? Math.round(r) : Number(r.toFixed(a)), P(t, String(r));
            };
          return X.jsxs(`div`, {
            className: `flex flex-row items-start gap-3 nodrag`,
            style: {
              position: `relative`
            },
            children: [o, s(), X.jsx(`div`, {
              className: `flex-1 min-w-0`,
              children: X.jsxs(`div`, {
                className: `inline-flex items-stretch h-10 rounded-md overflow-hidden border border-[#333] bg-[#0d0c0c]`,
                style: {
                  maxWidth: 220
                },
                children: [X.jsx(`button`, {
                  type: `button`,
                  onClick: () => c(-e),
                  className: `px-3 hover:bg-[#222] text-gray-300 flex items-center justify-center border-r border-[#333]`,
                  title: `-${e}`,
                  children: X.jsx(at, {
                    size: 16
                  })
                }), X.jsx(`input`, {
                  type: `number`,
                  step: e,
                  className: `rh-num-input bg-transparent text-center text-[13px] text-gray-100 outline-none w-[100px]`,
                  value: i,
                  onChange: e => P(t, e.target.value)
                }), X.jsx(`button`, {
                  type: `button`,
                  onClick: () => c(e),
                  className: `px-3 hover:bg-[#222] text-gray-300 flex items-center justify-center border-l border-[#333]`,
                  title: `+${e}`,
                  children: X.jsx(r, {
                    size: 16
                  })
                })]
              })
            })]
          }, t);
        }
        if (n === `BOOLEAN`) {
          let e = i === `true` || i === `1`;
          return X.jsxs(`div`, {
            className: `flex flex-row items-start gap-3 nodrag`,
            style: {
              position: `relative`
            },
            children: [o, s(), X.jsx(`div`, {
              className: `flex-1 min-w-0 pt-1.5`,
              children: X.jsx(`input`, {
                type: `checkbox`,
                checked: e,
                onChange: e => P(t, e.target.checked ? `true` : `false`),
                className: `w-5 h-5 accent-blue-500 cursor-pointer`
              })
            })]
          }, t);
        }
        return X.jsxs(`div`, {
          className: `flex flex-row items-start gap-3 nodrag`,
          style: {
            position: `relative`
          },
          children: [o, s(), X.jsx(`div`, {
            className: `flex-1 min-w-0`,
            children: X.jsx(`textarea`, {
              className: `w-full bg-[#0d0c0c] border border-[#333] rounded-md px-3 py-2 text-[13px] text-gray-100 outline-none focus:border-blue-500 custom-scrollbar resize-y nodrag nowheel min-h-[160px]`,
              placeholder: `输入 ${a}...`,
              value: i,
              onChange: e => P(t, e.target.value),
              onWheel: e => e.stopPropagation()
            })
          })]
        }, t);
      },
      re = d.covers && d.covers[0],
      [ie, ae] = Y.useState(false),
      [se, ce] = Y.useState([]),
      [le, ue] = Y.useState(false),
      [V, H] = Y.useState(null),
      [U, de] = Y.useState(``),
      [W, fe] = Y.useState(1);
    Y.useEffect(() => {
      ie && (fe(1), de(``));
    }, [ie]), Y.useEffect(() => {
      d.openAppSelectorOnMount && (ae(true), a(e, {
        openAppSelectorOnMount: false
      }));
    }, [e, d.openAppSelectorOnMount, a]);
    let me = Y.useMemo(() => {
        let e = U.trim().toLowerCase();
        return e ? se.filter(t => t.appName.toLowerCase().includes(e) || t.appId.includes(e)) : se;
      }, [se, U]),
      G = Y.useMemo(() => {
        let e = (W - 1) * 10;
        return me.slice(e, e + 10);
      }, [me, W]),
      he = W * 10 < me.length;
    Y.useEffect(() => {
      if (!ie || !p || !m) return;
      let e = false;
      ue(true), H(null);
      let t = new URL(ir(p));
      return t.searchParams.set(`page`, `1`), t.searchParams.set(`pageSize`, `100`), fetch(t.toString(), {
        headers: {
          Authorization: `Bearer ${m}`
        }
      }).then(async t => {
        let n = await t.json();
        if (!t.ok || !n?.success) throw Error(n?.error || `加载应用列表失败 HTTP ${t.status}`);
        e || ce(Array.isArray(n.items) ? n.items : []);
      }).catch(t => {
        e || H(t.message || `加载应用列表失败`);
      }).finally(() => {
        e || ue(false);
      }), () => {
        e = true;
      };
    }, [ie, p, m]);
    let ge = Y.useCallback(e => {
        A(e, {
          resetValues: true
        }), ae(false);
      }, [A]),
      _e = e => {
        let t = e.tags || [];
        return Array.isArray(t) ? t.map(e => typeof e == `string` ? e : e?.name || e?.tagName || ``).filter(Boolean).slice(0, 3) : [];
      },
      K = ie ? Un.createPortal(X.jsx(`div`, {
        className: `fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 nowheel nopan nodrag`,
        onClick: () => ae(false),
        onMouseDown: e => e.stopPropagation(),
        children: X.jsxs(`div`, {
          className: `relative w-[58vw] h-[66vh] max-w-[1080px] min-w-[720px] bg-[#141414] border border-[#2a2a2a] rounded-2xl shadow-2xl flex flex-col overflow-hidden`,
          onClick: e => e.stopPropagation(),
          children: [X.jsxs(`div`, {
            className: `shrink-0 flex items-center gap-4 px-5 h-14 border-b border-[#222]`,
            children: [X.jsxs(`div`, {
              className: `flex items-center gap-2 min-w-0`,
              children: [X.jsx(`div`, {
                className: `w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center`,
                children: X.jsx(Nt, {
                  size: 16,
                  className: `text-cyan-300`
                })
              }), X.jsx(`div`, {
                className: `min-w-0`,
                children: X.jsx(`div`, {
                  className: `text-sm text-white font-medium`,
                  children: `应用市场`
                })
              })]
            }), X.jsx(`button`, {
              onClick: () => ae(false),
              className: `ml-auto p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a] rounded-lg`,
              children: X.jsx(yn, {
                size: 18
              })
            })]
          }), X.jsxs(`div`, {
            className: `shrink-0 px-5 py-3 flex items-center gap-3 border-b border-[#1f1f1f]`,
            children: [X.jsxs(`div`, {
              className: `relative flex-1 max-w-md`,
              children: [X.jsx(u, {
                className: `absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500`
              }), X.jsx(`input`, {
                type: `text`,
                className: `w-full pl-8 pr-3 py-2 text-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-gray-200 placeholder:text-gray-600 focus:border-gray-500 outline-none`,
                placeholder: `搜索应用名称或 ID`,
                value: U,
                onChange: e => de(e.target.value)
              })]
            }), f && X.jsxs(`div`, {
              className: `text-[11px] text-gray-500 truncate`,
              children: [`当前：`, X.jsx(`span`, {
                className: `text-gray-300`,
                children: d.webappName || f
              })]
            })]
          }), X.jsx(`div`, {
            className: `flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5`,
            children: m ? le ? X.jsxs(`div`, {
              className: `h-full flex flex-col items-center justify-center gap-3 text-sm text-gray-500`,
              children: [X.jsx(ui, {
                size: 34
              }), X.jsx(`span`, {
                children: `加载应用中…`
              })]
            }) : V ? X.jsx(`div`, {
              className: `h-full flex items-center justify-center text-sm text-red-400`,
              children: V
            }) : me.length === 0 ? X.jsx(`div`, {
              className: `h-full flex items-center justify-center text-sm text-gray-500`,
              children: `暂无已上架应用`
            }) : X.jsx(`div`, {
              className: `grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4`,
              children: G.map(e => {
                let t = e.appId === f,
                  n = e.coverUrl || e.iconUrl || ``,
                  r = _e(e);
                return X.jsx(`button`, {
                  type: `button`,
                  onClick: () => ge(e.appId),
                  className: `group relative rounded-xl overflow-hidden bg-[#1a1a1a] border transition-all text-left ${t ? `border-cyan-400/70 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]` : `border-transparent hover:border-white/30`}`,
                  title: e.appName || e.appId,
                  children: X.jsxs(`div`, {
                    className: `relative aspect-[242/355] bg-[#0d0c0c] overflow-hidden`,
                    children: [n ? /\.(mp4|webm|mov|mkv|avi|m4v)(\?|$)/i.test(n) ? X.jsx(`video`, {
                      src: n,
                      autoPlay: true,
                      loop: true,
                      muted: true,
                      playsInline: true,
                      className: `w-full h-full object-cover`
                    }) : X.jsx(`img`, {
                      src: n,
                      alt: e.appName || e.appId,
                      className: `w-full h-full object-cover`,
                      draggable: false
                    }) : X.jsx(`div`, {
                      className: `w-full h-full flex items-center justify-center text-gray-700`,
                      children: X.jsx(pe, {
                        size: 28
                      })
                    }), X.jsxs(`div`, {
                      className: `absolute inset-x-0 bottom-0 pt-16 px-2.5 pb-2.5 bg-gradient-to-t from-black via-black/75 to-transparent`,
                      children: [X.jsx(`p`, {
                        className: `text-[13px] text-white font-medium truncate drop-shadow`,
                        children: e.appName || e.appId
                      }), (r.length > 0 || e.preDeductAmountDefault != null) && X.jsxs(`div`, {
                        className: `mt-1.5 flex flex-wrap gap-1.5`,
                        children: [r.map(e => X.jsxs(`span`, {
                          className: `px-1.5 py-0.5 rounded bg-white/15 text-[10px] text-gray-200 backdrop-blur-sm`,
                          children: [`#`, e]
                        }, e)), e.preDeductAmountDefault != null && X.jsxs(`span`, {
                          className: `px-1.5 py-0.5 rounded bg-yellow-400/15 text-[10px] text-yellow-100 backdrop-blur-sm`,
                          children: [`预计≈`, e.preDeductAmountDefault, ` 特惠币`]
                        })]
                      })]
                    }), t && X.jsx(`span`, {
                      className: `absolute top-2 right-2 w-6 h-6 rounded-full bg-cyan-400 text-black flex items-center justify-center shadow`,
                      children: X.jsx(Pn, {
                        size: 14
                      })
                    }), X.jsx(`div`, {
                      className: `absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center`,
                      children: X.jsx(`span`, {
                        className: `px-3 py-1.5 rounded-lg bg-white text-xs text-black font-semibold`,
                        children: `选择`
                      })
                    })]
                  })
                }, e.appId);
              })
            }) : X.jsx(`div`, {
              className: `h-full flex items-center justify-center text-sm text-amber-400`,
              children: `请先登录后选择应用`
            })
          }), m && !le && !V && me.length > 0 && X.jsxs(`div`, {
            className: `shrink-0 flex items-center justify-center gap-4 py-3 border-t border-[#1f1f1f] bg-[#141414]`,
            children: [X.jsx(`button`, {
              type: `button`,
              disabled: W <= 1,
              onClick: () => fe(e => Math.max(1, e - 1)),
              className: `px-4 py-1.5 rounded-lg bg-[#2a2a2a] text-sm text-gray-300 hover:bg-[#333] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors`,
              children: `上一页`
            }), X.jsxs(`span`, {
              className: `text-sm text-gray-500`,
              children: [`第 `, W, ` 页`]
            }), X.jsx(`button`, {
              type: `button`,
              disabled: !he,
              onClick: () => fe(e => e + 1),
              className: `px-4 py-1.5 rounded-lg bg-[#2a2a2a] text-sm text-gray-300 hover:bg-[#333] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors`,
              children: `下一页`
            })]
          })]
        })
      }), document.body) : null;
    return X.jsxs(`div`, {
      className: `flex flex-col items-center group/node transition-all ${i ? `z-50` : `z-10`}`,
      children: [X.jsx(si, {
        id: e,
        data: n,
        defaultTitle: `AI应用`,
        icon: X.jsx(pe, {
          size: 11,
          className: `text-gray-500`
        })
      }), X.jsxs(`div`, {
        className: `relative bg-[#1c1c1c] rounded-xl border shadow-xl transition-all duration-300 flex flex-row ${i ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`,
        style: {
          width: `100%`,
          height: `100%`,
          minWidth: 820,
          minHeight: 560,
          overflow: `visible`
        },
        children: [X.jsx(ci, {
          minWidth: 820,
          minHeight: 560
        }), X.jsxs(`div`, {
          className: `flex-1 min-w-0 flex flex-col`,
          children: [X.jsxs(`div`, {
            className: `flex-shrink-0 flex items-center gap-2 px-3 py-2 drag-handle cursor-move rounded-tl-xl`,
            children: [X.jsx(`span`, {
              className: `font-semibold text-[13px] text-gray-100 flex-1 truncate`,
              title: d.webappName,
              children: d.webappName || `AI应用`
            }), f && X.jsx(`button`, {
              className: `text-gray-400 hover:text-gray-100 hover:bg-[#2a2a2a] rounded p-1.5 nodrag`,
              onClick: e => {
                e.stopPropagation(), ae(true);
              },
              title: `应用市场`,
              children: X.jsx(Nt, {
                size: 14
              })
            })]
          }), X.jsxs(`div`, {
            className: `flex-1 min-h-0 px-4 py-4 flex flex-col gap-4`,
            onWheel: e => e.stopPropagation(),
            children: [d.schemaLoading && X.jsxs(`div`, {
              className: `flex items-center gap-2 text-xs text-gray-400 py-6 justify-center`,
              children: [X.jsx(L, {
                size: 12,
                className: `animate-spin`
              }), `正在加载应用参数...`]
            }), d.schemaError && X.jsxs(`div`, {
              className: `text-red-400 text-[11px] p-2 border border-red-500/30 rounded bg-red-500/10 flex items-start gap-1.5`,
              children: [X.jsx(pt, {
                size: 12,
                className: `mt-0.5`
              }), X.jsx(`span`, {
                children: d.schemaError
              })]
            }), !d.schemaLoading && !f && !d.schemaError && X.jsxs(`div`, {
              className: `flex-1 flex flex-col items-center justify-center gap-6 nodrag`,
              children: [X.jsxs(`div`, {
                className: `flex flex-col items-center gap-3`,
                children: [X.jsx(`button`, {
                  type: `button`,
                  onClick: e => {
                    e.stopPropagation(), ae(true);
                  },
                  className: `w-20 h-20 rounded-2xl bg-[#242424] border border-[#333] hover:border-cyan-400/60 hover:bg-[#2a2a2a] flex items-center justify-center text-gray-400 hover:text-cyan-300 transition-colors`,
                  title: `打开应用市场`,
                  children: X.jsx(Nt, {
                    size: 32
                  })
                }), X.jsx(`div`, {
                  className: `flex flex-col items-center gap-1.5`,
                  children: X.jsx(`button`, {
                    type: `button`,
                    onClick: e => {
                      e.stopPropagation(), ae(true);
                    },
                    className: `text-xs text-gray-400 hover:text-gray-200 transition-colors px-3 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a]`,
                    children: `浏览应用`
                  })
                })]
              }), X.jsx(`div`, {
                className: `text-sm text-gray-500`,
                children: `请选择 AI 应用开始创作`
              })]
            }), !d.schemaLoading && _.map(ne), d.errorMessage && X.jsxs(`div`, {
              className: `text-red-400 text-[11px] p-2 border border-red-500/30 rounded bg-red-500/10 flex items-start gap-1.5`,
              children: [X.jsx(pt, {
                size: 12,
                className: `mt-0.5`
              }), X.jsx(`span`, {
                className: `break-all`,
                children: d.errorMessage
              })]
            })]
          }), X.jsxs(`div`, {
            className: `flex-shrink-0 px-4 py-3 flex items-center justify-between gap-3 nodrag`,
            children: [d.loading ? X.jsxs(`div`, {
              className: `flex items-center bg-[#2a2a2a] rounded-full p-1 pl-3 border border-[#333]`,
              title: `停止`,
              onClick: t => {
                t.stopPropagation(), I(), a(e, {
                  loading: false,
                  status: `IDLE`
                });
              },
              children: [X.jsx(`div`, {
                className: `flex items-center gap-1 mr-3 text-xs text-gray-300`,
                children: d.status === `QUEUED` ? `排队中` : `运行中…`
              }), X.jsx(`button`, {
                className: `bg-red-500/20 text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-500/30 transition-colors cursor-pointer`,
                children: X.jsx(oe, {
                  size: 10,
                  fill: `currentColor`
                })
              })]
            }) : X.jsxs(`div`, {
              className: `flex items-center bg-[#2a2a2a] rounded-full p-1 pl-3 border border-[#333] hover:border-gray-500 transition-colors cursor-pointer group/btn ${!F || d.schemaLoading ? `opacity-50 cursor-not-allowed` : ``}`,
              onClick: e => {
                e.stopPropagation(), !(!F || d.schemaLoading) && z();
              },
              title: F ? `` : `等待文件上传完成`,
              children: [X.jsx(`div`, {
                className: `flex items-center gap-1 mr-3 text-xs text-gray-300 group-hover/btn:text-white`,
                children: `运行`
              }), X.jsx(`button`, {
                className: `bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors`,
                children: X.jsx(ct, {
                  size: 12,
                  fill: `currentColor`
                })
              })]
            }), !d.loading && (d.taskCostTime != null || d.consumeMoney != null || d.preDeductAmount != null) && X.jsxs(`div`, {
              className: `text-[12px] text-gray-400 tabular-nums text-right`,
              children: [d.preDeductAmount != null && d.loading === false && d.consumeMoney == null && X.jsxs(`span`, {
                className: `mr-2`,
                children: [`预计预扣 `, X.jsx(`span`, {
                  className: `text-yellow-300`,
                  children: d.preDeductAmount
                }), ` 特惠币`]
              }), (d.taskCostTime != null || d.consumeMoney != null) && X.jsxs(X.Fragment, {
                children: [`上次运行了 `, X.jsx(`span`, {
                  className: `text-gray-200`,
                  children: d.taskCostTime ?? `-`
                }), ` 秒，实扣 `, X.jsxs(`span`, {
                  className: `text-yellow-300`,
                  children: [d.consumeMoney ?? `-`, ` `]
                }), `特惠币`]
              })]
            })]
          })]
        }), X.jsxs(`div`, {
          className: `flex-shrink-0 w-[312px] relative rounded-r-xl overflow-hidden bg-[#141414]`,
          children: [re && X.jsxs(`div`, {
            className: `absolute inset-x-0 top-0`,
            children: [/\.(mp4|webm|mov|mkv|avi|m4v)(\?|$)/i.test(re.url || re.thumbnailUri || ``) ? X.jsx(`video`, {
              src: re.url || re.thumbnailUri,
              className: `w-full h-auto block select-none`,
              autoPlay: true,
              loop: true,
              muted: true,
              playsInline: true
            }) : X.jsx(`img`, {
              src: re.url || re.thumbnailUri,
              className: `w-full h-auto block select-none`,
              alt: `banner`,
              draggable: false
            }), X.jsx(`div`, {
              className: `absolute inset-x-0 -bottom-1 h-[25%] bg-gradient-to-t from-[#141414] to-transparent pointer-events-none`
            })]
          }), re && d.loading && X.jsx(`div`, {
            className: `absolute inset-0 flex items-center justify-center bg-black/40 z-20`,
            children: X.jsx(L, {
              size: 22,
              className: `animate-spin text-white drop-shadow`
            })
          }), (d.webappTags?.length || d.webappDesc) && X.jsx(`div`, {
            className: `absolute inset-0 flex flex-col justify-end z-10 pointer-events-none opacity-0 group-hover/node:opacity-100 group-focus-within/node:opacity-100 transition-opacity duration-300`,
            children: X.jsxs(`div`, {
              className: `max-h-[75%] overflow-auto custom-scrollbar nowheel px-3 pt-14 pb-3 flex flex-col gap-2 nodrag pointer-events-auto bg-gradient-to-t from-black via-black/85 to-transparent`,
              onWheel: e => e.stopPropagation(),
              children: [d.webappTags && d.webappTags.length > 0 && X.jsx(`div`, {
                className: `flex flex-wrap gap-1`,
                children: d.webappTags.map(e => X.jsxs(`span`, {
                  className: `text-[10px] text-pink-200 bg-pink-500/20 rounded px-1.5 py-0.5`,
                  children: [`#`, e]
                }, e))
              }), d.webappDesc && X.jsx(`div`, {
                className: `text-[12px] text-gray-100 leading-relaxed rh-app-desc`,
                dangerouslySetInnerHTML: {
                  __html: As(d.webappDesc.length > 30 ? d.webappDesc.slice(0, 30) + `...` : d.webappDesc)
                }
              })]
            })
          }), f && !re && !d.webappDesc && !d.webappTags?.length && X.jsx(`div`, {
            className: `absolute inset-0 flex items-center justify-center text-gray-700 pointer-events-none`,
            children: X.jsx(Ot, {
              size: 40
            })
          })]
        }), X.jsx(_r, {
          type: `source`,
          position: J.Right,
          variant: `small`
        })]
      }), K]
    });
  }),