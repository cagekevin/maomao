import { i as e } from "./rolldown-runtime-aKtaBQYM.js";
import { At as t, Fr as n, Ln as r, Lt as i, Mr as a, Nn as o, Qt as s, Rr as c, in as ee, pt as te, sr as l, wt as u, zt as ne } from "./vendor-Z-adA07W.js";
import { J as d, X as f, a as re, c as ie, ct as p, d as ae, ft as oe, j as se, l as m, n as h, u as ce } from "./httpClient-BknZwXjG.js";
var g = e(c(), 1),
  _ = n(),
  v = {
    builtin: `default`,
    discountVideo: `tehuishipin`,
    aiApp: `yimaoAiApp`
  };
function le(e) {
  return (Array.isArray(e) ? e : Object.values(e || {})).reduce((e, t) => (t?.id && (e[t.id] = t.url || ``), e), {});
}
var y = new Set([`image`, `video`, `audio`]),
  b = () => {},
  x = [],
  ue = [],
  de = {
    type: `FREE`,
    expiry: 0
  };
function fe(e) {
  return e && typeof e == `object` ? {
    ...e,
    nodes: Array.isArray(e.nodes) ? e.nodes.map((e) => {
      let t = {
        ...(e?.data || {})
      };
      return (`loading` in t || `progress` in t || `status` in t || `taskId` in t || `requestData` in t || `responseData` in t || `errorMsg` in t || `errorMessage` in t || `resultData` in t || `customResultData` in t) && (delete t.loading, delete t.progress, delete t.status, delete t.taskId, delete t.requestData, delete t.responseData, delete t.errorMsg, delete t.errorMessage, delete t.resultData, delete t.customResultData, delete t.text, delete t.videoUrl, delete t.audioUrl, delete t.thumbnailUrl, delete t.imageAvailable, delete t.imageUrlRef, delete t.imageUrlThumbRef, delete t.imageUrlUploaded, delete t.extractedImages, delete t.allExtractedImages, delete t.hasChanged, delete t.running), {
        ...e,
        data: t
      };
    }) : [],
    edges: Array.isArray(e.edges) ? e.edges : []
  } : {
    nodes: [],
    edges: []
  };
}
function pe(e) {
  let t = String(e || ``).trim();
  if (!t) return `运行失败，请稍后重试。`;
  let n = t.toLowerCase();
  return n.includes(`invalid token`) ? `应用运行失败：应用凭证无效，请联系应用作者检查后端接入配置。` : n.includes(`unauthorized`) || n.includes(`401`) ? `应用运行失败：当前请求未通过鉴权，请联系应用作者检查授权配置。` : n.includes(`failed to fetch`) || n.includes(`network`) ? `应用运行失败：网络连接异常，请稍后重试。` : t;
}
function me(e, t) {
  let n = `${p.replace(/[\s`]/g, ``).replace(/\/$/, ``)}/api/workflow-apps/${encodeURIComponent(e)}`;
  return t ? `${n}?licenseToken=${encodeURIComponent(t)}` : n;
}
function S({
  app: e,
  onBack: n,
  canvasProps: c,
  licenseToken: l
}) {
  let u = (0, g.useMemo)(() => `workflow-app-license-${e.appId}`, [e.appId]),
    [y, S] = (0, g.useState)(!0),
    [C, w] = (0, g.useState)(``),
    [T, E] = (0, g.useState)(!1),
    [_e, ve] = (0, g.useState)(e.appName || `应用`),
    [D, ye] = (0, g.useState)(``),
    [be, xe] = (0, g.useState)(`private`),
    [Se, Ce] = (0, g.useState)(1),
    [O, k] = (0, g.useState)([]),
    [A, j] = (0, g.useState)([]),
    [M, N] = (0, g.useState)({}),
    [we, P] = (0, g.useState)(``),
    [F, I] = (0, g.useState)(!1),
    [L, R] = (0, g.useState)(!1),
    [z, B] = (0, g.useState)([]),
    [V, H] = (0, g.useState)([]),
    [Te, Ee] = (0, g.useState)(!1),
    [De, U] = (0, g.useState)(!1),
    [W, G] = (0, g.useState)(``),
    [K, q] = (0, g.useState)(() => l || localStorage.getItem(u) || ``),
    [Oe, J] = (0, g.useState)(``),
    [ke, Ae] = (0, g.useState)(!1),
    [je, Me] = (0, g.useState)({}),
    Y = (0, g.useRef)(0),
    X = (0, g.useMemo)(() => `__apprun_${e.appId}`, [e.appId]),
    Z = (0, g.useMemo)(() => ({
      ...c,
      ...je,
      showToast: c.showToast || b,
      transitResources: c.transitResources || x,
      addTransitResource: c.addTransitResource || b,
      presetPrompts: c.presetPrompts || x,
      membership: c.membership || de,
      globalTasks: c.globalTasks || x,
      updateGlobalTasks: c.updateGlobalTasks || b,
      customNodeTemplates: c.customNodeTemplates || ue,
      onAddCustomNodeTemplate: c.onAddCustomNodeTemplate || b,
      onDeleteCustomNodeTemplate: c.onDeleteCustomNodeTemplate || b
    }), [je, c]),
    Q = (0, g.useCallback)(async (t) => {
      let n = ++Y.current;
      S(!0), w(``), I(!1), E(!1);
      try {
        let r = await h(me(e.appId, t), {
          skipAuth: !0
        });
        if (n !== Y.current) return;
        if (!r.success) throw Error(r.error || `加载失败`);
        let i = r.data,
          a = i?.data ?? i;
        if (!a) throw Error(i?.error || r.error || `加载失败`);
        if (ve(a.appName || e.appName || `应用`), ye(a.description || ``), xe(a.visibility || `private`), Ce(a.currentVersionNo || 1), !a.access?.canRun) {
          k([]), j([]), E(!0), I(!1), U(!0), J(a.access?.requiresLicense ? `该应用需要许可证后才能运行，请输入许可证 Token。` : `当前账号没有运行权限。`);
          return;
        }
        let o = a.inputSchema?.fields || [];
        k(o), j(a.mappingSchema?.fields || []), N(Object.fromEntries(o.map((e) => [e.id, e.defaultValue ?? ``]))), await d.setObject(f(X), fe(a.workflowSnapshot || {
          nodes: [],
          edges: []
        })), I(!0), E(!1), U(!1), J(``), t && (localStorage.setItem(u, t), G(t), q(t));
        let s = await h(`${p}/api/sync/default`, {
          skipAuth: !0
        });
        if (s.success && s.data) {
          let e = le((s.data.data || s.data)?.apiConfigs),
            t = oe(p),
            n = (e) => e.replace(`{VITE_API_BASE_URL}`, t);
          Me({
            builtinApiUrl: n(e[v.builtin] || ``),
            textApiUrl: n(e[v.builtin] || ``),
            imageApiUrl: n(e[v.builtin] || ``),
            videoApiUrl: n(e[v.builtin] || ``),
            discountVideoApiUrl: n(e[v.discountVideo] || ``),
            audioApiUrl: n(e[v.builtin] || ``),
            aiAppApiUrl: n(e[v.aiApp] || ``)
          });
        }
        await se(p, !0).catch(() => void 0);
      } catch (e) {
        if (n !== Y.current) return;
        w(e?.message || `加载失败`), J(``);
      } finally {
        n === Y.current && S(!1);
      }
    }, [e.appId, e.appName, X, u]);
  (0, g.useEffect)(() => ((async () => {
    await Q(K || void 0);
  })(), () => {
    d.remove(f(X)).catch(() => {});
  }), [Q, K, X]), (0, g.useEffect)(() => {
    let e = (e) => {
      let t = e.detail || {};
      if (console.log(`[WorkflowAppRunner] 收到工作流完成事件:`, t), t.targetProjectId && t.targetProjectId !== X) return;
      let n = Array.isArray(t.results) ? t.results : [],
        r = Array.isArray(t.errors) ? t.errors : [];
      B(n), H(r), R(!1), Ee(!0);
    };
    return window.addEventListener(m, e), () => window.removeEventListener(m, e);
  }, [X]);
  let Ne = (0, g.useCallback)(async () => {
      let t = W.trim() || K;
      if (!t) {
        J(`请输入许可证 Token`);
        return;
      }
      Ae(!0), J(``);
      try {
        let n = await re(`/workflow-apps/${encodeURIComponent(e.appId)}/verify-license`, {
          licenseToken: t
        });
        if (!n.success) throw Error(n.error || `许可证验证失败`);
        localStorage.setItem(u, t), q(t), G(``), U(!1), await Q(t), J(`许可证验证成功`);
      } catch (e) {
        J(e?.message || `许可证验证失败`), U(!0);
      } finally {
        Ae(!1);
      }
    }, [e.appId, W, K, Q, u]),
    Pe = (0, g.useCallback)(() => {
      let e = O.filter((e) => e.required && (M[e.id] === void 0 || M[e.id] === ``));
      if (e.length > 0) {
        w(`请先填写：${e.map((e) => e.label || e.key).join(`、`)}`);
        return;
      }
      w(``);
      let t = A.map((e) => ({
        nodeId: e.nodeId,
        path: e.path,
        value: M[e.id]
      })).filter((e) => e.nodeId && e.value !== void 0 && e.value !== ``);
      B([]), H([]), R(!0), window.dispatchEvent(new CustomEvent(ie, {
        detail: {
          targetProjectId: X
        }
      })), window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent(ce, {
          detail: {
            targetProjectId: X,
            injections: t
          }
        }));
      }, 80);
    }, [A, M, X, O]),
    $ = (e, t) => N((n) => ({
      ...n,
      [e]: t
    })),
    Fe = (0, g.useCallback)(async (e, t) => {
      P(e.id);
      try {
        let n = new FormData();
        n.append(`file`, t);
        let r = {},
          i = p.replace(/[\s`]/g, ``).replace(/\/$/, ``),
          a = await fetch(`${i}/api/upload/app-asset`, {
            method: `POST`,
            headers: r,
            body: n
          }),
          o = await a.json().catch(() => ({}));
        if (!a.ok || o.success === !1) throw Error(o.error || `上传失败`);
        let s = (o.data || o).url;
        $(e.id, s);
      } catch (e) {
        w(e?.message || `上传失败`);
      } finally {
        P(``);
      }
    }, [e.appId]),
    Ie = F && !L && !y;
  return (0, _.jsxs)(`div`, {
    className: `h-full w-full overflow-y-auto bg-[#0b0a0a] text-gray-100 custom-scrollbar`,
    children: [(0, _.jsx)(`div`, {
      "aria-hidden": !0,
      className: `fixed pointer-events-none opacity-0`,
      style: {
        width: 1280,
        height: 720,
        left: -99999,
        top: 0,
        zIndex: -1,
        overflow: `hidden`
      },
      children: F ? (0, _.jsx)(ae, {
        ...Z,
        licenseToken: K || Z?.licenseToken,
        projectId: X
      }) : null
    }), (0, _.jsxs)(`div`, {
      className: `mx-auto w-full max-w-5xl px-5 py-6 md:px-8 md:py-10`,
      children: [(0, _.jsxs)(`div`, {
        className: `flex items-start justify-between gap-4 flex-wrap`,
        children: [(0, _.jsxs)(`div`, {
          className: `min-w-0 flex items-start gap-3`,
          children: [n ? (0, _.jsx)(`button`, {
            onClick: n,
            className: `mt-1 text-gray-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition-colors`,
            children: (0, _.jsx)(a, {
              size: 18
            })
          }) : null, (0, _.jsxs)(`div`, {
            className: `min-w-0`,
            children: [(0, _.jsx)(`div`, {
              className: `flex items-center gap-2 flex-wrap`,
              children: (0, _.jsx)(`h1`, {
                className: `text-2xl md:text-3xl font-extrabold leading-tight truncate`,
                children: _e
              })
            }), (0, _.jsxs)(`div`, {
              className: `mt-2 flex items-center gap-2 flex-wrap`,
              children: [(0, _.jsx)(`span`, {
                className: `inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-gray-300`,
                children: be === `public` ? `公开应用` : `私有应用`
              }), (0, _.jsxs)(`span`, {
                className: `inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-gray-300`,
                children: [`版本 V`, Se]
              }), T ? (0, _.jsx)(`span`, {
                className: `inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] text-amber-300`,
                children: `需要许可证`
              }) : F ? (0, _.jsx)(`span`, {
                className: `inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] text-emerald-300`,
                children: `可运行`
              }) : null]
            }), D ? (0, _.jsx)(`p`, {
              className: `mt-3 max-w-2xl text-sm leading-7 text-gray-400`,
              children: D
            }) : null]
          })]
        }), (0, _.jsxs)(`button`, {
          onClick: () => U(!0),
          className: `inline-flex items-center gap-2 rounded-xl border border-[#2a2a2a] bg-[#151414] px-3.5 py-2 text-sm text-gray-300 hover:bg-[#1f1f1f] transition-colors`,
          children: [(0, _.jsx)(t, {
            size: 15
          }), ` 许可证`]
        })]
      }), C ? (0, _.jsx)(`div`, {
        className: `mt-5 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300`,
        children: C
      }) : null, (0, _.jsxs)(`div`, {
        className: `mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2 items-start`,
        children: [(0, _.jsxs)(`section`, {
          className: `rounded-2xl border border-[#242424] bg-[#141313] p-5`,
          children: [(0, _.jsxs)(`div`, {
            className: `flex items-center gap-2`,
            children: [(0, _.jsx)(i, {
              size: 16,
              className: `text-blue-400`
            }), (0, _.jsx)(`h2`, {
              className: `font-bold`,
              children: `运行输入`
            })]
          }), (0, _.jsx)(`p`, {
            className: `mt-1 text-xs text-gray-500`,
            children: `填写下面的参数后点击运行`
          }), (0, _.jsx)(`div`, {
            className: `mt-5 space-y-4`,
            children: y ? (0, _.jsxs)(`div`, {
              className: `flex h-40 items-center justify-center text-sm text-gray-500`,
              children: [(0, _.jsx)(s, {
                size: 15,
                className: `mr-2 animate-spin`
              }), ` 加载中…`]
            }) : T ? (0, _.jsxs)(`div`, {
              className: `flex flex-col items-center justify-center gap-3 py-10 text-center`,
              children: [(0, _.jsx)(ne, {
                size: 28,
                className: `text-amber-400`
              }), (0, _.jsx)(`p`, {
                className: `text-sm text-gray-400`,
                children: `该应用需要许可证后才能运行`
              }), (0, _.jsxs)(`button`, {
                onClick: () => U(!0),
                className: `inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500`,
                children: [(0, _.jsx)(o, {
                  size: 15
                }), ` 输入许可证`]
              })]
            }) : O.length === 0 ? (0, _.jsx)(`div`, {
              className: `rounded-xl border border-dashed border-[#2a2a2a] px-4 py-8 text-center text-sm text-gray-500`,
              children: `该应用无需填写参数，可直接运行。`
            }) : O.map((e) => (0, _.jsxs)(`div`, {
              className: `rounded-xl border border-[#232323] bg-[#101010] p-3.5`,
              children: [(0, _.jsxs)(`label`, {
                className: `mb-2 flex items-center gap-2 text-[13px] text-gray-300`,
                children: [(0, _.jsx)(`span`, {
                  className: `font-medium`,
                  children: e.label || e.key
                }), e.required ? (0, _.jsx)(`span`, {
                  className: `text-red-400`,
                  children: `*`
                }) : null, (0, _.jsx)(`span`, {
                  className: `ml-auto text-[10px] uppercase text-gray-600`,
                  children: e.type
                })]
              }), he(e, M[e.id], $, we === e.id, (t) => Fe(e, t))]
            }, e.id))
          }), !T && (0, _.jsxs)(`button`, {
            onClick: Pe,
            disabled: !Ie,
            className: `mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50`,
            children: [L ? (0, _.jsx)(s, {
              size: 16,
              className: `animate-spin`
            }) : (0, _.jsx)(ee, {
              size: 16
            }), L ? `运行中…` : `运行应用`]
          })]
        }), (0, _.jsxs)(`section`, {
          className: `rounded-2xl border border-[#242424] bg-[#141313] p-5`,
          children: [(0, _.jsxs)(`div`, {
            className: `flex items-center gap-2`,
            children: [(0, _.jsx)(r, {
              size: 16,
              className: `text-emerald-400`
            }), (0, _.jsx)(`h2`, {
              className: `font-bold`,
              children: `运行结果`
            })]
          }), (0, _.jsx)(`p`, {
            className: `mt-1 text-xs text-gray-500`,
            children: `应用执行后的输出会显示在这里`
          }), (0, _.jsx)(`div`, {
            className: `mt-5`,
            children: L ? (0, _.jsxs)(`div`, {
              className: `flex h-48 flex-col items-center justify-center gap-3 text-sm text-gray-500`,
              children: [(0, _.jsx)(s, {
                size: 22,
                className: `animate-spin text-blue-400`
              }), `正在运行工作流…`]
            }) : Te ? z.length === 0 && V.length > 0 ? (0, _.jsxs)(`div`, {
              className: `space-y-3`,
              children: [(0, _.jsx)(`div`, {
                className: `rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200`,
                children: `本次运行失败，请检查下面的错误信息。`
              }), V.map((e, t) => (0, _.jsxs)(`div`, {
                className: `rounded-xl border border-red-500/20 bg-[#101010] px-4 py-3`,
                children: [(0, _.jsx)(`div`, {
                  className: `text-sm font-medium text-red-300`,
                  children: e.label || e.type || e.nodeId
                }), (0, _.jsx)(`div`, {
                  className: `mt-1 text-xs leading-6 text-red-200/90 break-words`,
                  children: pe(e.message)
                }), pe(e.message) === e.message ? null : (0, _.jsxs)(`div`, {
                  className: `mt-2 text-[11px] text-gray-500 break-words`,
                  children: [`原始错误：`, e.message]
                })]
              }, `${e.nodeId}-${t}`))]
            }) : z.length === 0 ? (0, _.jsx)(`div`, {
              className: `flex h-48 items-center justify-center rounded-xl border border-dashed border-[#2a2a2a] text-sm text-gray-600`,
              children: `运行完成，但没有可预览的输出`
            }) : (0, _.jsx)(`div`, {
              className: `space-y-4`,
              children: z.map((e) => (0, _.jsx)(ge, {
                result: e
              }, e.nodeId))
            }) : (0, _.jsx)(`div`, {
              className: `flex h-48 items-center justify-center rounded-xl border border-dashed border-[#2a2a2a] text-sm text-gray-600`,
              children: `尚未运行`
            })
          })]
        })]
      })]
    }), De && (0, _.jsx)(`div`, {
      className: `fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm`,
      children: (0, _.jsxs)(`div`, {
        className: `w-full max-w-md overflow-hidden rounded-2xl border border-[#333] bg-[#111] shadow-2xl`,
        children: [(0, _.jsxs)(`div`, {
          className: `flex items-center justify-between border-b border-[#2a2a2a] bg-[#151414] px-5 py-4`,
          children: [(0, _.jsxs)(`div`, {
            className: `flex items-center gap-2 font-bold text-white`,
            children: [(0, _.jsx)(o, {
              size: 18
            }), ` 许可证`]
          }), (0, _.jsx)(`button`, {
            onClick: () => U(!1),
            className: `text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5`,
            children: (0, _.jsx)(te, {
              size: 16
            })
          })]
        }), (0, _.jsxs)(`div`, {
          className: `space-y-4 p-5`,
          children: [(0, _.jsx)(`p`, {
            className: `text-xs leading-6 text-gray-500`,
            children: `许可证是运行应用的凭证,由应用所属者创建分发`
          }), (0, _.jsx)(`input`, {
            type: `password`,
            value: W,
            onChange: (e) => G(e.target.value),
            className: `w-full rounded-xl border border-[#333] bg-[#101010] px-3.5 py-2.5 text-sm text-white outline-none focus:border-blue-500`,
            placeholder: K ? `已保存许可证，请输入新的 Token 替换` : `输入许可证 Token`,
            autoComplete: `off`
          }), Oe && (0, _.jsx)(`div`, {
            className: `rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200`,
            children: Oe
          }), (0, _.jsxs)(`div`, {
            className: `flex justify-end gap-2`,
            children: [(0, _.jsx)(`button`, {
              onClick: () => {
                localStorage.removeItem(u), G(``), q(``), J(`已清除本地许可证缓存`);
              },
              className: `rounded-xl border border-[#333] px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white`,
              children: `清除`
            }), (0, _.jsxs)(`button`, {
              onClick: Ne,
              disabled: ke,
              className: `inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50`,
              children: [ke ? (0, _.jsx)(s, {
                size: 14,
                className: `animate-spin`
              }) : null, `保存并验证`]
            })]
          })]
        })]
      })
    })]
  });
}
function he(e, t, n, r, i) {
  if (y.has(e.type)) {
    let a = e.type === `image` ? `图片` : e.type === `video` ? `视频` : `音频`,
      o = e.type === `image` ? `image/*` : e.type === `video` ? `video/*` : `audio/*`;
    return (0, _.jsxs)(`div`, {
      className: `space-y-2`,
      children: [(0, _.jsxs)(`label`, {
        className: `flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#3a3a3a] bg-[#0f0f0f] px-3 py-3 text-[13px] text-gray-400 transition-colors hover:border-blue-500 hover:text-gray-200`,
        children: [r ? (0, _.jsx)(s, {
          size: 14,
          className: `animate-spin`
        }) : (0, _.jsx)(u, {
          size: 14
        }), r ? `上传中…` : `点击上传${a}`, (0, _.jsx)(`input`, {
          type: `file`,
          accept: o,
          className: `hidden`,
          onChange: (e) => {
            let t = e.target.files?.[0];
            t && i(t);
          }
        })]
      }), (0, _.jsx)(`input`, {
        value: t ?? ``,
        onChange: (t) => n(e.id, t.target.value),
        className: `w-full rounded-xl border border-[#333] bg-[#0f0f0f] px-3 py-2 text-sm text-white outline-none focus:border-blue-500`,
        placeholder: `或粘贴资源 URL`
      }), t ? (0, _.jsx)(`div`, {
        className: `overflow-hidden rounded-xl border border-[#262626] bg-black`,
        children: e.type === `image` ? (0, _.jsx)(`img`, {
          src: t,
          alt: `preview`,
          className: `block max-h-52 w-full object-contain`
        }) : e.type === `video` ? (0, _.jsx)(`video`, {
          src: t,
          controls: !0,
          className: `block w-full`
        }) : (0, _.jsx)(`audio`, {
          src: t,
          controls: !0,
          className: `block w-full p-2`
        })
      }) : null]
    });
  }
  return e.type === `boolean` ? (0, _.jsxs)(`label`, {
    className: `inline-flex cursor-pointer items-center gap-2 text-[13px] text-gray-300`,
    children: [(0, _.jsx)(`input`, {
      type: `checkbox`,
      checked: !!t,
      onChange: (t) => n(e.id, t.target.checked),
      className: `h-4 w-4 accent-blue-500`
    }), `启用`]
  }) : e.type === `json` || e.type === `text` ? (0, _.jsx)(`textarea`, {
    value: t ?? ``,
    onChange: (t) => n(e.id, t.target.value),
    className: `min-h-[88px] w-full resize-y rounded-xl border border-[#333] bg-[#0f0f0f] px-3 py-2 text-sm leading-6 text-white outline-none focus:border-blue-500`,
    placeholder: `请输入${e.label || e.key}`
  }) : (0, _.jsx)(`input`, {
    type: e.type === `number` ? `number` : `text`,
    value: t ?? ``,
    onChange: (t) => n(e.id, e.type === `number` ? t.target.value === `` ? `` : Number(t.target.value) : t.target.value),
    className: `w-full rounded-xl border border-[#333] bg-[#0f0f0f] px-3 py-2 text-sm text-white outline-none focus:border-blue-500`,
    placeholder: `请输入${e.label || e.key}`
  });
}
async function C(e, t) {
  try {
    let n = await (await fetch(e)).blob(),
      r = window.URL.createObjectURL(n),
      i = document.createElement(`a`);
    i.href = r, i.download = t, document.body.appendChild(i), i.click(), window.URL.revokeObjectURL(r), document.body.removeChild(i);
  } catch (t) {
    console.error(`Download failed:`, t), window.open(e, `_blank`);
  }
}
function ge({
  result: e
}) {
  let t = e.imageUrl || e.videoUrl || e.audioUrl;
  return (0, _.jsxs)(`div`, {
    className: `overflow-hidden rounded-xl border border-[#262626] bg-[#0f0f0f]`,
    children: [e.label ? (0, _.jsxs)(`div`, {
      className: `flex items-center justify-between border-b border-[#212121] px-3 py-2`,
      children: [(0, _.jsx)(`span`, {
        className: `text-[12px] text-gray-400`,
        children: e.label
      }), t && (0, _.jsxs)(`button`, {
        onClick: () => {
          let t = e.videoUrl || e.imageUrl || e.audioUrl || ``,
            n = e.videoUrl ? `.mp4` : e.imageUrl ? `.png` : `.mp3`;
          C(t, `result-${Date.now()}${n}`);
        },
        className: `inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-[11px] text-gray-300 hover:bg-white/10 hover:text-white transition-colors`,
        children: [(0, _.jsx)(l, {
          size: 12
        }), ` 下载`]
      })]
    }) : t ? (0, _.jsx)(`div`, {
      className: `flex justify-end border-b border-[#212121] px-3 py-2`,
      children: (0, _.jsxs)(`button`, {
        onClick: () => {
          let t = e.videoUrl || e.imageUrl || e.audioUrl || ``,
            n = e.videoUrl ? `.mp4` : e.imageUrl ? `.png` : `.mp3`;
          C(t, `result-${Date.now()}${n}`);
        },
        className: `inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-[11px] text-gray-300 hover:bg-white/10 hover:text-white transition-colors`,
        children: [(0, _.jsx)(l, {
          size: 12
        }), ` 下载`]
      })
    }) : null, e.imageUrl ? (0, _.jsx)(`img`, {
      src: e.imageUrl,
      alt: `result`,
      className: `block w-full`
    }) : null, e.videoUrl ? (0, _.jsx)(`video`, {
      src: e.videoUrl,
      controls: !0,
      className: `block w-full`
    }) : null, e.audioUrl ? (0, _.jsx)(`audio`, {
      src: e.audioUrl,
      controls: !0,
      className: `block w-full p-3`
    }) : null, e.text ? (0, _.jsx)(`div`, {
      className: `whitespace-pre-wrap px-4 py-3 text-sm leading-7 text-gray-200`,
      children: e.text
    }) : null]
  });
}
function w() {
  let e = new URLSearchParams(window.location.search),
    t = e.get(`appId`) || window.location.pathname.split(`/`).filter(Boolean).pop() || ``,
    n = e.get(`licenseToken`) || void 0,
    r = `http://192.168.1.6:3000`;
  r = ``;
  let i = {
    proxyBaseUrl: r || p || window.location.origin,
    proxyMode: `server-proxy`,
    appId: t,
    licenseToken: n
  };
  return (0, _.jsx)(S, {
    app: {
      appId: t
    },
    canvasProps: i,
    licenseToken: n
  });
}
export { w as default };