// TODO(全局, 无需 import): toasts, removeToast, i, localToolBaseUrl, accessKey, secretKey, bucket, endpoint, domain, k, pe, eqOrPrefix, t, oe, page, pageSize, sortBy, sortDir, filters, ne, n, userId, username, phone, nickname, avatar, membershipType, balance, modelApiTokenKey, membershipExpiryDate, hasUnlimitedMembership, hasPassword, ii, key, url, type, expiry, code, _i, vi, la, id, Mi, Ni, $i, d, status, completed, total, ri, showKey, p, Gr, qr, Yr, wr, oi, ci, ui, fi, gi, Zr, $r, ti, ai, si, li, di, pi, hi, Y, o, mi, s, c, l, skipAuth, Ci, Ei, wi, Ti, usage, quota, percentage, ki, Oi, u, Ai, accounts, presets, name, Gi, encodeURIComponent, Z, Qi, title, prompt, enabled, ia, onToast, $, openUpgradeSettings, ca, ua, da, Si, active, currentWindow, favIconUrl, folder, source, success, error, X, Q, ni, f, defaultTextModel, defaultDrawingModel, defaultVideoModel, defaultAudioModel, defaultSd2VideoModel, textApiConfigId, imageApiConfigId, videoApiConfigId, sd2VideoApiConfigId, audioApiConfigId, videoDurations, globalPollingInterval, Wr, globalMaxPollingDuration, Kr, globalSyncTimeout, Jr, transitGridCols, sd2Token, useThumbnail, Xr, panPerformanceMode, Qr, enablePerformanceMode, ei, errorMsg, headers, Authorization, Accept, notFoundCount, detail, taskId, nodeId, resultUrl, progress, responseData, customRawResponse, mediaMeta, alert, storeId, value, ma, pa, ya, data, gn, mn, path, secure, confirm, httpOnly, expirationDate, sameSite, cookies, siteName, siteUrl, fa, pn, hn, dn, wa, Ea, Ta, Ca, ja, Ma, isFavorite, Ya, Ia, timestamp, pageUrl, pageTitle, tabId, func, Uint8Array, bubbles, args, Ii, Li, Fi, Vi, zi, Bi, handleRefreshTask, isLoaded, globalTasks, handleUpdateGlobalTasks, Ka, showToastMessage, localPort, localToolConnected, sd2VideoApiUrl, sd2VideoApiKey, videoApiUrl, videoApiKey, discountVideoApiUrl, discountVideoApiKey, aiAppApiUrl, aiAppApiKey, task, thumbnailUrl, customOutputType, Xa, localforage, kvStore, importData, no, exportData, to, ct, Va, Ua, ba, va, xa, _a, x, y, qa, Ja, Ki, Wi, qi, Ji, Yi, Xi, Zi, sa, Sa, Da, Oa, ka, Aa, ga, ha, Na, le, Pa, Fa, za, La, Ra, ee, Hr, Ur, Wa, Ga, Pi, Ba, Ri, Ha, Hi, Ui, textApiUrl, textApiKey, imageApiUrl, imageApiKey, builtinApiUrl, builtinApiKey, audioApiUrl, audioApiKey, textModel, drawingModel, videoModel, sd2VideoModel, discountVideoModel, audioModel, showToast, transitResources, addTransitResource, presetPrompts, membership, updateGlobalTasks, onSendToActiveTab, customNodeTemplates, onAddCustomNodeTemplate, onDeleteCustomNodeTemplate, setShowTaskList, cloudStorageConfig, isLoggedIn, ji, Qa, Za, $a, readonly, eo, ra, na, oa, aa, w
import _cmp_Tr from "./Tr.jsx";
import _cmp_Ln from "./Ln.jsx";
import _cmp_Qn from "./Qn.jsx";
import _cmp__Component11 from "./_Component11.jsx";
import _cmp_$n from "./$n.jsx";
import _cmp__Component38 from "./_Component38.jsx";
import _cmp_Zt from "./Zt.jsx";
import _cmp__Component40 from "./_Component40.jsx";
import _cmp__Component41 from "./_Component41.jsx";
import _cmp__Component42 from "./_Component42.jsx";
import _cmp_Xt from "./Xt.jsx";
import _cmp__Component43 from "./_Component43.jsx";
import _cmp_Qt from "./Qt.jsx";
import _cmp_$t from "./$t.jsx";
import _cmp_It from "./It.jsx";
import _cmp__Component47 from "./_Component47.jsx";
import _cmp_Lt from "./Lt.jsx";
import _cmp_Sr from "./Sr.jsx";
import _cmp_jn from "./jn.jsx";
import _cmp_Cn from "./Cn.jsx";
import _cmp_Cr from "./Cr.jsx";
import _cmp_Ft from "./Ft.jsx";
import _cmp_vn from "./vn.jsx";
import _cmp_Mn from "./Mn.jsx";
import { Rt, Qe, ge, kt, Me, ut, ot, st, ve, he, qe, kr, Ae, ft, Ie, ze, Ue, ke, Pr, V, ar, Bt, mt, Ze, Oe, Rr, Jt, qt, We, je, Ct, $e, Je, lt, z, B, an, Lr, At, Ar, Ee, Ir, Fe, it, Fr, Ke, vt, bt, St, wt, Rn, Wn, Xn, sr, er, _, C, be, Et, _t, ln, Dn, at, gt, Or, Er, In, Ve, Dr, Un, fr, De, Nn, Fn, Bn, Hn, Kn, Jn, nr, ir, lr, dr, hr, _r, yr, kn, pr, L, q, En, Yt, H, Dt, J, A, xn, et, me, rn, Yn, or, Zn, Te, g, cr, ur, dt, pt, tt, M, P, K, cn, Re, Tt, fn, bn, yn, _n, on, jr, Nr, Mr, Pt, tr, rr, Gn, qn, mr, gr, xt, yt, ht, He, S, rt, Xe, Wt, Br, Kt, un, Pe, Le, Be, Ge, _e, ye, xe, Se, Ce, we, I, Pn, zn, Vn, On, An, vr, br, Ht, Mt, jt, Nt, Vt, U, O, E, Sn, Tn, D, Ut, Ne, Gt, _Component16, _Component35, _Component21, _Component31, _Component5, F, _Component10, _Component36, _Component26, _Component1, _Component37, N, _Component39, Ye, _Component33, _Component25, T, _Component6, _Component32, _Component3, _Component44, _Component45, _Component4, _Component46, R, setDiscountVideoApiConfigModels } from "./shared.js";
import * as _shared from "./shared.js";
import * as W from "react";
import * as G from "react";
export default function Vr() {
  let {
    toasts: e,
    removeToast: t
  } = Rt();
  let r = Qe();
  let i = W.useMemo(() => {
    if (r.status.isConnected) {
      return ge();
    } else {
      return undefined;
    }
  }, [r.status.isConnected, r.status.port]);
  let a = kt();
  W.useEffect(() => {
    window.localTool = r;
  }, [r]);
  W.useEffect(() => {
    if (typeof chrome < `u` && chrome.storage?.local && i) {
      chrome.storage.local.set({
        localToolBaseUrl: i
      }).catch(() => {});
    }
  }, [i]);
  let [u, d] = W.useState([]);
  let [f, p] = W.useState({
    accessKey: ``,
    secretKey: ``,
    bucket: ``,
    endpoint: ``,
    domain: ``
  });
  let [g, _] = W.useState(``);
  let [y, x] = W.useState(false);
  let [S, C] = W.useState(true);
  let [w, E] = W.useState(false);
  let [D, O] = W.useState(null);
  let [k, A] = W.useState(true);
  let [M, P] = W.useState(null);
  let [ee, I] = W.useState(null);
  let [L, ne] = W.useState([]);
  let [oe, le] = W.useState(`all`);
  let [pe, me] = W.useState(`generated`);
  let [he, _e] = W.useState(`all`);
  let [ve, ye] = W.useState(``);
  let [xe, Se] = W.useState(false);
  let [Ce, we] = W.useState(``);
  let [Te, Ee] = W.useState(4);
  let [Oe, ke] = W.useState(1);
  let [Ae] = W.useState(20);
  let [Me, Ne] = W.useState(0);
  let [Pe, Ie] = W.useState([]);
  let [Le, ze] = W.useState(0);
  let [Be, Ue] = W.useState(0);
  let [Ge, qe] = W.useState(false);
  let [Ze, et] = W.useState(0);
  let [rt, ot] = W.useState(false);
  let [st, ct] = W.useState(false);
  let ut = W.useRef(Me);
  W.useEffect(() => {
    if (ut.current !== Me) {
      console.log(`[refreshCounter监控] refreshCounter 从`, ut.current, `变为`, Me);
      ut.current = Me;
    }
  }, [Me]);
  W.useEffect(() => {
    let e = setTimeout(() => {
      if (!r.status.isConnected && !st && !k) {
        ot(true);
      } else if (r.status.isConnected) {
        ot(false);
      }
    }, 3000);
    return () => {
      return clearTimeout(e);
    };
  }, [r.status.isConnected, st, k]);
  let ft = W.useCallback(() => {
    let e = {};
    let t = pe === `generated` ? `tasks` : `migrated`;
    // ve 为空(根目录)时精确匹配当前层,只显示本层文件 + 子目录条目,不把后代全铺出来;
    // 进入子目录后(ve 非空)才用 eqOrPrefix,把该文件夹及其子目录都查出来。
    e.folder = ve ? { eqOrPrefix: `${t}/${ve}` } : t;
    if (oe !== `all`) {
      if (oe === `video`) {
        e.type = [`video`, `audio`, `folder`];
      } else {
        e.type = [oe, `folder`];
      }
    }
    if (he === `favorite`) {
      e.isFavorite = 1;
    }
    return e;
  }, [pe, ve, oe, he]);
  let mt = W.useCallback(async e => {
    qe(true);
    try {
      let t = await kr({
        page: e,
        pageSize: Ae,
        sortBy: `timestamp`,
        sortDir: `DESC`,
        filters: ft()
      });
      Ie(t.items);
      ze(t.total);
      Ue(t.totalPages);
      ke(t.page);
    } catch (e) {
      console.error(`[App] 加载资源分页失败:`, e);
    } finally {
      qe(false);
    }
  }, [Ae, ft]);
  let ht = W.useRef(false);
  let yt = W.useRef([]);
  let xt = W.useCallback(async () => {
    if (r.status.port) {
      try {
        await Pr();
        ne((await kr({
          page: 1,
          pageSize: 300,
          sortBy: `timestamp`,
          sortDir: `DESC`
        })).items);
      } catch (e) {
        console.error(`Failed to sync transit resources from local:`, e);
      }
    }
  }, [r.status.port]);
  let [V, H] = W.useState(`accounts`);
  let [U, Dt] = W.useState(`builtin`);
  let [Ot, jt] = W.useState(false);
  let [Mt, Nt] = W.useState(0);
  let [zt, Bt] = W.useState(true);
  let Ht = W.useRef(null);
  W.useEffect(() => {
    if (V !== `canvas`) {
      return;
    }
    let e = false;
    let t;
    let n = async () => {
      try {
        let t = await ar(`canvas-assistant`);
        if (!e) {
          Bt(t.enabled !== false);
        }
      } catch {}
      if (!e) {
        t = setTimeout(n, 30000);
      }
    };
    n();
    return () => {
      e = true;
      if (t) {
        clearTimeout(t);
      }
    };
  }, [V]);
  W.useEffect(() => {
    if (V === `transit`) {
      mt(1);
    }
  }, [V, pe, oe, he, ve, Ze]);
  W.useEffect(() => {
    if (V === `transit`) {
      mt(Oe);
    }
  }, [Oe]);
  let [Ut, Wt] = W.useState(false);
  let [Gt, Kt] = W.useState(false);
  let [q, qt] = W.useState(false);
  let [J, Jt] = W.useState(null);
  let [rn, an] = W.useState(Rr);
  let [on, cn] = W.useState(null);
  let ln = e => {
    Jt({
      ...e,
      userId: e.userId,
      username: e.username,
      phone: e.phone,
      nickname: e.nickname,
      avatar: e.avatar,
      membershipType: e.membershipType,
      balance: e.balance,
      modelApiTokenKey: e.modelApiTokenKey,
      membershipExpiryDate: e.membershipExpiryDate,
      hasUnlimitedMembership: e.hasUnlimitedMembership,
      hasPassword: e.hasPassword
    });
    qt(true);
    let t = We();
    if (t) {
      je(Ct(``), t, true).catch(() => {
        return undefined;
      });
    }
    console.log(`[useEffect:refreshCounter] 使用函数式更新 apiConfigs 中 default 的 key 为服务器返回的值`);
    ii(t => {
      return t.map(t => {
        if (t.id === 'default') {
          return {
            ...t,
            key: e.modelApiTokenKey
          };
        }
        if (t.id === `tehuishipin` || t.id === `yimaoAiApp`) {
          let e = t.url.replace(`{VITE_API_BASE_URL}`, $e(Je));
          return {
            ...t,
            key: We(),
            url: lt(e, true)
          };
        }
        return t;
      });
    });
    if (e.membershipType) {
      let t = {
        type: e.membershipType,
        expiry: e.membershipExpiryDate,
        code: _i.code
      };
      z.setObject(B.MEMBERSHIP, t);
      vi(t);
    } else {
      let e = {
        type: `FREE`,
        expiry: 0,
        code: ``
      };
      vi(e);
      z.setObject(B.MEMBERSHIP, e);
    }
  };
  W.useEffect(() => {
    la(false);
    console.log(`[useEffect:refreshCounter] refreshCounter 变化触发，当前值:`, Me);
    try {
      z.getObject(B.USERS).then(e => {
        if (e && e.length > 0) {
          an(e);
        } else {
          an(Rr);
          z.setObject(B.USERS, Rr);
        }
      });
      (async () => {
        try {
          if (await z.getConfig(Lr)) {
            return;
          }
          let e = await z.getObject(B.TRANSIT_RESOURCES);
          let t = await At.default.getItem(B.TRANSIT_RESOURCES);
          let n = [];
          if (Array.isArray(t)) {
            n.push(...t);
          }
          if (Array.isArray(e)) {
            let t = new Set(n.map(e => {
              return e.id;
            }));
            n.push(...e.filter(e => {
              return !t.has(e.id);
            }));
          }
          let r = n.filter(e => {
            return e && e.id && e.source !== `local-tool`;
          });
          if (r.length > 0) {
            await Promise.all(r.map(e => {
              return Ar({
                ...e,
                id: String(e.id)
              });
            }));
            console.log(`[App] 已播种 ${r.length} 条历史资源到 SQLite`);
          }
          await z.setConfig(Lr, String(Date.now()));
        } catch (e) {
          console.error(`[App] 资源播种失败:`, e);
        }
      })();
      z.getConfig(B.TRANSIT_GRID_COLS).then(e => {
        if (e) {
          let t = parseInt(e.toString());
          if (!isNaN(t)) {
            Ee(t);
          }
        }
      });
      z.getObject(B.PROJECTS).then(e => {
        Mi(t => {
          if (t.length > 1 || t.length === 1 && t[0].id !== 'default') {
            return t;
          } else {
            if (e && e.length > 0) {
              z.getConfig(B.LAST_OPENED_PROJECT).then(t => {
                if (t && e.some(e => {
                  return e.id === t;
                })) {
                  Ni(t);
                } else {
                  Ni(e[0].id);
                }
              });
              return e;
            } else {
              return t;
            }
          }
        });
      });
      z.getObject(B.PRESET_PROMPTS).then(e => {
        if (e && e.length > 0) {
          $i(e);
        }
      });
      z.getObject(B.GLOBAL_TASKS).then(async e => {
        try {
          if (!(await z.getConfig(Ir)) && e && e.length > 0 && (await Fe(e))) {
            await z.setConfig(Ir, String(Date.now()));
            console.log(`[App] 已播种 ${e.length} 条历史任务到 SQLite`);
          }
        } catch (e) {
          console.error(`[App] 任务播种失败，回退使用 KV 数据:`, e);
        }
        try {
          let e = await it({
            page: 1,
            pageSize: Fr,
            sortBy: `createdAt`,
            sortDir: `DESC`
          });
          if (e.items.length > 0) {
            d(e.items);
            return;
          }
        } catch (e) {
          console.error(`[App] 从 SQLite 加载任务失败，回退使用 KV 数据:`, e);
        }
        if (e && e.length > 0) {
          d(e.map(Ke));
        }
        if (r.status.isConnected) {
          try {
            let e = (await z.getConfig(B.LAST_OPENED_PROJECT)) || `default`;
            let t = await vt(e);
            console.log(`[App] 检查点检测: checkpoint=`, t ? {
              status: t.status,
              completed: t.completedNodes?.length,
              total: t.nodeExecOrder?.length
            } : `null`);
            if (t && t.status === `running`) {
              t.status = `interrupted`;
              await bt(t);
              console.log(`[App] 检测到中断的工作流，${t.completedNodes.length}/${t.nodeExecOrder.length} 节点已完成`);
            } else if (t && t.status !== `interrupted`) {
              console.log(`[App] 检查点状态=${t.status}，清理检查点`);
              await St(e);
            }
          } catch (e) {
            console.error(`[App] 恢复工作流检查点失败:`, e);
          }
        }
      });
      z.getObject(B.CUSTOM_NODE_TEMPLATES).then(e => {
        if (e && e.length > 0) {
          ri(e);
        }
      });
      z.getObject(B.API_CONFIGS).then(e => {
        if (e && e.length > 0) {
          ii(t => {
            let n = e.map(e => {
              return {
                ...e,
                showKey: e.showKey ?? false
              };
            });
            let r = n.filter(e => {
              return e.readonly;
            });
            let i = n.filter(e => {
              return !e.readonly;
            });
            let a = t.filter(e => {
              return e.readonly;
            });
            return [...(a.length > 0 ? a : r), ...i];
          });
        }
      });
      z.getObject(B.CLOUD_STORAGE_CONFIG).then(e => {
        if (e && Object.keys(e).length > 0) {
          p(t => {
            if (Object.keys(t).every(e => {
              return !t[e];
            })) {
              return e;
            } else {
              return t;
            }
          });
        }
      });
      wt();
      z.getObject(B.APP_SETTINGS).then(e => {
        console.log(`[Storage] 加载 app_settings:`, e ? `存在` : `不存在`);
        if (e) {
          if (e.globalPollingInterval !== undefined) {
            Gr(e.globalPollingInterval > 60 ? e.globalPollingInterval / 1000 : e.globalPollingInterval);
          }
          if (e.globalMaxPollingDuration !== undefined) {
            qr(e.globalMaxPollingDuration);
          }
          if (e.globalSyncTimeout !== undefined) {
            Yr(e.globalSyncTimeout);
          }
          if (e.transitGridCols !== undefined) {
            Ee(e.transitGridCols);
          }
          if (e.defaultTextModel) {
            Rn(e.defaultTextModel);
          }
          if (e.defaultDrawingModel) {
            Wn(e.defaultDrawingModel);
          }
          if (e.defaultVideoModel) {
            Xn(e.defaultVideoModel);
          }
          if (e.defaultSd2VideoModel) {
            sr(e.defaultSd2VideoModel);
          }
          if (e.videoDurations) {
            er(e.videoDurations);
          }
          if (e.defaultAudioModel) {
            wr(e.defaultAudioModel);
          }
          if (e.textApiConfigId && !localStorage.getItem(`apiConfigId_text`)) {
            oi(e.textApiConfigId);
          }
          if (e.imageApiConfigId && !localStorage.getItem(`apiConfigId_image`)) {
            ci(e.imageApiConfigId);
          }
          if (e.videoApiConfigId && !localStorage.getItem(`apiConfigId_video`)) {
            ui(e.videoApiConfigId);
          }
          if (e.sd2VideoApiConfigId && !localStorage.getItem(`apiConfigId_sd2Video`)) {
            fi(e.sd2VideoApiConfigId);
          }
          if (e.audioApiConfigId && !localStorage.getItem(`apiConfigId_audio`)) {
            gi(e.audioApiConfigId);
          }
          if (e.sd2Token && !g) {
            _(e.sd2Token);
          }
          if (e.useThumbnail !== undefined) {
            Zr(e.useThumbnail);
          }
          if (e.panPerformanceMode !== undefined) {
            $r(e.panPerformanceMode);
          }
          if (e.enablePerformanceMode !== undefined) {
            ti(e.enablePerformanceMode);
          }
          console.log(`result.useThumbnail`, e.useThumbnail);
        }
      });
      z.getObject(B.MEMBERSHIP).then(e => {
        if (e) {
          let t = Date.now();
          if (e.expiry > t) {
            vi(e);
          } else {
            vi({
              type: `FREE`,
              expiry: 0
            });
            z.remove(B.MEMBERSHIP);
          }
        }
      });
      C(false);
    } catch (e) {
      console.error(`Storage get error:`, e);
      C(false);
      la(true);
    }
    z.getConfig(`auth_token`).then(e => {
      if (!e) {
        console.log(`[useEffect:refreshCounter] 未检测到登录 Token`);
        be();
        vi({
          type: `FREE`,
          expiry: 0,
          code: ``
        });
        z.getObject(B.OLD_MEMBERSHIP).then(e => {
          if (e) {
            vi(e);
          }
        });
        setTimeout(() => {
          return la(true);
        }, 300);
        return;
      }
      Et(e.toString());
      console.log(`[useEffect:refreshCounter] 检测到登录 Token，开始获取用户信息...`);
      (async (e = 2, t = 800) => {
        for (let n = 0; n <= e; n++) {
          try {
            let e = await _t.get(`/user/info`);
            if (e.success && e.data) {
              let t = e.data.user;
              console.log(`[useEffect:refreshCounter] 获取用户信息成功，modelApiTokenKey:`, t.modelApiTokenKey ? `***${t.modelApiTokenKey.slice(-4)}` : `empty`);
              ln(t);
              setTimeout(() => {
                return la(true);
              }, 300);
              return;
            }
            throw Error(`user/info 返回 success=false`);
          } catch (r) {
            if (n < e) {
              console.warn(`[useEffect:refreshCounter] 获取用户信息失败，第 ${n + 1} 次重试...`, r);
              await new Promise(e => {
                return setTimeout(e, t * (n + 1));
              });
              continue;
            }
            console.warn(`[useEffect:refreshCounter] 获取用户信息多次失败，使用离线兜底（保留缓存会员）:`, r);
            let i = await z.getObject(B.MEMBERSHIP).catch(() => {
              return null;
            });
            if (i && i.expiry > Date.now()) {
              vi(i);
            }
            setTimeout(() => {
              return la(true);
            }, 300);
          }
        }
      })();
    });
  }, [Me]);
  let [un, dn] = W.useState(false);
  let [fn, pn] = W.useState(``);
  let [mn, hn] = W.useState(null);
  let [gn, _n] = W.useState(``);
  let [vn, yn] = W.useState(false);
  let [bn, xn] = W.useState(null);
  let [Sn, Cn] = W.useState(false);
  let [Tn, En] = W.useState(``);
  let Dn = `https://0.1mao.cc`;
  let [On, kn] = W.useState(Dn);
  let [An, jn] = W.useState(``);
  let [Mn, Nn] = W.useState(Dn);
  let [Pn, Fn] = W.useState(``);
  let [In, Rn] = W.useState(`gemini-3-flash-preview
gemini-3-pro`);
  let [zn, Bn] = W.useState(Dn);
  let [Vn, Hn] = W.useState(``);
  let [Un, Wn] = W.useState(`gemini-3.1-flash-image-preview
gemini-3-pro-image-preview`);
  let [Gn, Kn] = W.useState(Dn);
  let [qn, Jn] = W.useState(``);
  let [Yn, Xn] = W.useState(`grok-video-3-pro
grok-video-3`);
  let [Zn, er] = W.useState(`10
15`);
  let [tr, nr] = W.useState(`defaultModelApiUrl`);
  let [rr, ir] = W.useState(``);
  let [or, sr] = W.useState(`seed-2`);
  let [cr, lr] = W.useState(() => {
    return $e(Je);
  });
  let [ur, dr] = W.useState(``);
  let [fr, pr] = W.useState(`seedance_2_fast`);
  let [mr, hr] = W.useState(() => {
    return $e(Je);
  });
  let [gr, _r] = W.useState(``);
  let [vr, yr] = W.useState(`defaultModelApiUrl`);
  let [br, Sr] = W.useState(``);
  let [Cr, wr] = W.useState(`whisper-1`);
  let Er = (e, t) => {
    let n = new Set();
    let r = [];
    let i = e => {
      let t = (e || ``).trim();
      if (!!t && !n.has(t)) {
        n.add(t);
        r.push(t);
      }
    };
    (e || ``).split(`
`).forEach(i);
    (t || []).forEach(i);
    return r.join(`
`);
  };
  let [Dr, Or] = W.useState(0);
  W.useEffect(() => {
    at(Ct(``));
    return gt(() => {
      return Or(e => {
        return e + 1;
      });
    });
  }, []);
  let Vr = W.useMemo(() => {
    return Er(In, Ve(`text`));
  }, [In, Dr]);
  let Hr = W.useMemo(() => {
    return Er(Un, Ve(`image`));
  }, [Un, Dr]);
  let Ur = W.useMemo(() => {
    return Er(fr, De());
  }, [fr, Dr]);
  let [Wr, Gr] = W.useState(3);
  let [Kr, qr] = W.useState(600);
  let [Jr, Yr] = W.useState(600);
  let [Xr, Zr] = W.useState(true);
  let [Qr, $r] = W.useState(false);
  let [ei, ti] = W.useState(true);
  let [ni, ri] = W.useState([]);
  let [Y, ii] = W.useState([]);
  let [ai, oi] = W.useState(() => {
    try {
      return localStorage.getItem(`apiConfigId_text`) || `default`;
    } catch {
      return `default`;
    }
  });
  let [si, ci] = W.useState(() => {
    try {
      return localStorage.getItem(`apiConfigId_image`) || `default`;
    } catch {
      return `default`;
    }
  });
  let [li, ui] = W.useState(() => {
    try {
      return localStorage.getItem(`apiConfigId_video`) || `default`;
    } catch {
      return `default`;
    }
  });
  let [di, fi] = W.useState(() => {
    try {
      return localStorage.getItem(`apiConfigId_sd2Video`) || `default`;
    } catch {
      return `default`;
    }
  });
  let [pi] = W.useState(`tehuishipin`);
  let [mi] = W.useState(`yimaoAiApp`);
  let [hi, gi] = W.useState(() => {
    try {
      return localStorage.getItem(`apiConfigId_audio`) || `default`;
    } catch {
      return `default`;
    }
  });
  W.useEffect(() => {
    try {
      localStorage.setItem(`apiConfigId_text`, ai);
    } catch {}
  }, [ai]);
  W.useEffect(() => {
    try {
      localStorage.setItem(`apiConfigId_image`, si);
    } catch {}
  }, [si]);
  W.useEffect(() => {
    try {
      localStorage.setItem(`apiConfigId_video`, li);
    } catch {}
  }, [li]);
  W.useEffect(() => {
    try {
      localStorage.setItem(`apiConfigId_sd2Video`, di);
    } catch {}
  }, [di]);
  W.useEffect(() => {
    try {
      localStorage.setItem(`apiConfigId_discountVideo`, pi);
    } catch {}
  }, [pi]);
  W.useEffect(() => {
    try {
      localStorage.setItem(`apiConfigId_audio`, hi);
    } catch {}
  }, [hi]);
  W.useEffect(() => {
    let e = Y.find(e => {
      return !e.readonly;
    });
    let t = t => {
      let n = Y.find(e => {
        return e.id === t;
      });
      if (n && !n.readonly) {
        return n;
      } else {
        return e || n || Y[0];
      }
    };
    let n = t(ai);
    if (n) {
      Nn(n.url);
      Fn(n.key);
    }
    let r = t(si);
    if (r) {
      Bn(r.url);
      Hn(r.key);
    }
    let i = t(li);
    if (i) {
      Kn(i.url);
      Jn(i.key);
    }
    let a = Y.find(e => {
      return e.id === di;
    }) || Y[0];
    if (a) {
      nr(a.url);
      ir(a.key);
    }
    let o = Y.find(e => {
      return e.id === pi;
    }) || Y[0];
    if (o) {
      lr(o.url);
      dr(o.key);
    }
    let s = Y.find(e => {
      return e.id === mi;
    }) || o;
    if (s) {
      hr(lt(s.url, s.readonly || s.id === `yimaoAiApp`));
      _r(s.key);
    }
    let c = Y.find(e => {
      return e.id === hi;
    }) || Y[0];
    if (c) {
      yr(c.url);
      Sr(c.key);
    }
    let l = Y.find(e => {
      return e.id === 'default';
    }) || Y[0];
    if (l) {
      kn(l.url);
      jn(l.key);
    }
    let discountVideoModels = [];
    for (let e of Y) {
      let t = e.models;
      if (Array.isArray(t)) {
        for (let n of t) {
          if (n.type === 'video' && n.id) {
            discountVideoModels.push(n.id);
          }
        }
      }
    }
    setDiscountVideoApiConfigModels(discountVideoModels);
  }, [Y, ai, si, li, di, pi, mi, hi]);
  let [_i, vi] = W.useState({
    type: `FREE`,
    expiry: 0
  });
  let [yi, bi] = W.useState(``);
  let [xi, Si] = W.useState(``);
  let Ci = W.useRef(false);
  let wi = e => {
    console.log(`[loadAppSettings] 加载配置数据`, e);
    if (e.users && e.users.length > 0) {
      an(e.users);
    }
    if (e.projects && e.projects.length > 0) {
      Mi(e.projects);
    }
    if (e.textApiConfigId && !localStorage.getItem(`apiConfigId_text`)) {
      oi(e.textApiConfigId);
    }
    if (e.imageApiConfigId && !localStorage.getItem(`apiConfigId_image`)) {
      ci(e.imageApiConfigId);
    }
    if (e.videoApiConfigId && !localStorage.getItem(`apiConfigId_video`)) {
      ui(e.videoApiConfigId);
    }
    if (e.sd2VideoApiConfigId && !localStorage.getItem(`apiConfigId_sd2Video`)) {
      fi(e.sd2VideoApiConfigId);
    }
    if (e.audioApiConfigId && !localStorage.getItem(`apiConfigId_audio`)) {
      gi(e.audioApiConfigId);
    }
    if (e.textModel) {
      Rn(e.textModel);
    }
    if (e.drawingModel) {
      Wn(e.drawingModel);
    }
    if (e.videoModel) {
      Xn(e.videoModel);
    }
    if (e.sd2VideoModel) {
      sr(e.sd2VideoModel);
    }
    if (e.discountVideoModel) {
      pr(e.discountVideoModel);
    }
    if (e.audioModel) {
      wr(e.audioModel);
    }
    if (e.presetPrompts) {
      $i(e.presetPrompts);
    }
    if (e.customNodeTemplates) {
      ri(e.customNodeTemplates);
    }
    if (e.sd2Token) {
      _(e.sd2Token);
    }
    if (e.cloudStorageConfig) {
      p(e.cloudStorageConfig);
    }
    if (e.globalPollingInterval !== undefined) {
      Gr(e.globalPollingInterval);
    }
    if (e.globalMaxPollingDuration !== undefined) {
      qr(e.globalMaxPollingDuration);
    }
    if (e.globalSyncTimeout !== undefined) {
      Yr(e.globalSyncTimeout);
    }
    if (e.textApiUrl) {
      Nn(e.textApiUrl);
    }
    if (e.textApiKey) {
      Fn(e.textApiKey);
    }
    if (e.imageApiUrl) {
      Bn(e.imageApiUrl);
    }
    if (e.imageApiKey) {
      Hn(e.imageApiKey);
    }
    if (e.videoApiUrl) {
      Kn(e.videoApiUrl);
    }
    if (e.videoApiKey) {
      Jn(e.videoApiKey);
    }
    if (e.sd2VideoApiUrl) {
      nr(e.sd2VideoApiUrl);
    }
    if (e.sd2VideoApiKey) {
      ir(e.sd2VideoApiKey);
    }
    if (e.audioApiUrl) {
      yr(e.audioApiUrl);
    }
    if (e.audioApiKey) {
      Sr(e.audioApiKey);
    }
    if (e.videoApiUrl) {
      Kn(e.videoApiUrl);
    }
    if (e.useThumbnail !== undefined) {
      Zr(e.useThumbnail);
    }
    if (e.panPerformanceMode !== undefined) {
      $r(e.panPerformanceMode);
    }
  };
  let Ti = (e, t) => {
    console.log(`[adjustApiConfigs] 加载配置数据`, e);
    e ||= [];
    if (!Array.isArray(t)) {
      t = [];
    }
    ii(n => {
      let r = e.map(e => {
        return {
          ...e,
          showKey: e.showKey ?? false
        };
      }).filter(e => {
        return !e.readonly;
      });
      let i = t.length > 0 ? t : n.filter(e => {
        return e.readonly;
      });
      let a = [...i, ...r];
      console.log(`[loadAppSettings] apiConfigs 合并结果: 系统内置`, i.length, `个 + 用户自定义`, r.length, `个`);
      return a;
    });
  };
  let Ei = async () => {
    try {
      let e = await _t.get(`/sync/default`, {
        skipAuth: true
      });
      console.log(`[fetchDefaultConfig] 原始响应:`, JSON.stringify(e));
      if (e.success && e.data) {
        let t = e.data.data || e.data;
        console.log(`[fetchDefaultConfig] 提取的配置数据:`, JSON.stringify(t, null, 2));
        return t;
      } else {
        console.warn(`[fetchDefaultConfig] 获取默认配置失败:`, e.error);
        return null;
      }
    } catch (e) {
      console.error(`[fetchDefaultConfig] 获取默认配置异常:`, e);
      return null;
    }
  };
  W.useEffect(() => {
    console.log(`kvLoadedRef.current`, Ci.current);
    if (!Ci.current) {
      Ci.current = true;
      console.log(`[useEffect:storage] 开始从存储引擎加载设置...`);
      (async () => {
        let [e, t, n] = await Promise.all([z.getObject(`app_settings`), z.getObject(`api_configs`), Ei()]);
        if (!e) {
          console.log(`[useEffect:storage] 本地无配置，使用云端默认配置完整加载`);
          if (n) {
            console.log(`[useEffect:storage] 获取到云端默认配置，正在加载...`);
            wi(n);
          }
        }
        if (n?.discountVideoModel) {
          pr(n.discountVideoModel);
        }
        // 与特惠视频 discountVideoModel 对称：无条件从 baseline 覆盖图片/聊天默认模型
        // (drawingModel/textModel 已在 wi() 内支持，这里补无条件分支确保老用户也生效)
        if (n?.drawingModel) {
          Wn(n.drawingModel);
        }
        if (n?.textModel) {
          Rn(n.textModel);
        }
        console.log(`[appSettingKvData] 配置数据:`, e);
        console.log(`defaultConfig?.apiConfigs`, n?.apiConfigs);
        Ti(t, n?.apiConfigs);
      })();
    }
  }, []);
  let [Di, Oi] = W.useState({
    usage: 0,
    quota: 0,
    percentage: 0
  });
  let ki = 524288000;
  W.useEffect(() => {
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(e => {
        let t = e.usage || 0;
        let n = Math.min(e.quota || ki, ki);
        Oi({
          usage: t,
          quota: n,
          percentage: n > 0 ? t / n * 100 : 0
        });
      });
    }
  }, [L, u, ki]);
  let Ai = W.useRef(null);
  W.useEffect(() => {
    if (Ai.current === null) {
      Ai.current = Y;
      return;
    }
    let e = Ai.current;
    let t = JSON.stringify(e);
    let n = JSON.stringify(Y);
    if (t !== n) {
      console.log(`[useEffect:apiConfigs监控] apiConfigs 发生变化！`);
      console.log(`[useEffect:apiConfigs监控] 变化前:`, t);
      console.log(`[useEffect:apiConfigs监控] 变化后:`, n);
      Ai.current = Y;
    }
  }, [Y]);
  let ji = {
    accounts: 9999,
    presets: 9999,
    name: `无限制`
  };
  let [X, Mi] = W.useState([{
    id: `default`,
    name: `默认项目`
  }]);
  let [Z, Ni] = W.useState(`default`);
  let [Pi, Fi] = W.useState(false);
  let [Ii, Li] = W.useState(``);
  let [Ri, zi] = W.useState(false);
  let [Bi, Vi] = W.useState(``);
  let [Hi, Ui] = W.useState(null);
  let [Wi, Gi] = W.useState(null);
  let [Ki, qi] = W.useState(false);
  let [Ji, Yi] = W.useState(false);
  let [Xi, Zi] = W.useState(false);
  let Qi = W.useCallback(async () => {
    if (!q || !Z) {
      Gi(null);
      return;
    }
    try {
      let e = await _t.get(`/workflow-apps/by-project/${encodeURIComponent(Z)}`);
      let t = e.data;
      Gi(e.success ? t?.data ?? t ?? null : null);
    } catch {
      Gi(null);
    }
  }, [q, Z]);
  W.useEffect(() => {
    Qi();
  }, [Qi]);
  let [Q, $i] = W.useState([{
    title: `三视图`,
    prompt: `三视图，包括前视图、侧视图和后视图，白色背景，高品质，8k分辨率，角色设计`,
    type: `all`,
    enabled: true
  }, {
    title: `九宫格`,
    prompt: `九宫格构图，9个不同的画面，高细节，一致的风格，连贯的叙事`,
    type: `all`,
    enabled: true
  }]);
  let [ea, ta] = W.useState(false);
  let [na, ra] = W.useState(false);
  let ia = `{
  "accessKey": "",
  "secretKey": "",
  "bucket": "",
  "endpoint": "",
  "domain": ""
}`;
  let [aa, oa] = W.useState(ia);
  let $ = W.useCallback(e => {
    En(e);
    Cn(true);
    setTimeout(() => {
      Cn(false);
    }, 2000);
  }, []);
  let sa = Yt({
    onToast: $,
    openUpgradeSettings: () => {
      H(`settings`);
      Dt(`upgrade`);
    }
  });
  let [ca, la] = W.useState(false);
  let ua = W.useRef(false);
  W.useEffect(() => {
    if (ca && !ua.current) {
      ua.current = true;
      console.log(`[初始化完成] 当前 isLoggedIn:`, q);
      console.log(`[初始化完成] 当前 userInfo:`, J?.modelApiTokenKey ? `***${J.modelApiTokenKey.slice(-4)}` : `empty`);
    }
  }, [ca, Y, q, J]);
  W.useEffect(() => {
    if (ca && Z) {
      z.setConfig(B.LAST_OPENED_PROJECT, Z);
    }
  }, [Z, ca]);
  let da = W.useRef(Y.length);
  da.current = Y.length;
  W.useEffect(() => {
    let e = typeof chrome < `u` && chrome.runtime && chrome.runtime.id;
    A(!!e);
    if (e) {
      document.title = `一毛AI画布·插件端`;
    } else {
      H(`canvas`);
      document.title = `一毛AI画布·本地端`;
    }
    if (e) {
      chrome.tabs.getCurrent(e => {});
    }
    Si(a);
    let t = setTimeout(() => {
      C(false);
    }, 2000);
    if (e) {
      chrome.tabs.query({
        active: true,
        currentWindow: true
      }, e => {
        if (e && e.length > 0) {
          let t = e[0];
          xn({
            title: t.title || `当前平台`,
            favIconUrl: t.favIconUrl || ``,
            url: t.url || ``
          });
        }
      });
      let e = (e, t, n) => {
        if (t.status === `complete` && n.active) {
          xn({
            title: n.title || `当前平台`,
            favIconUrl: n.favIconUrl || ``,
            url: n.url || ``
          });
        }
      };
      let n = e => {
        chrome.tabs.get(e.tabId, e => {
          if (e) {
            xn({
              title: e.title || `当前平台`,
              favIconUrl: e.favIconUrl || ``,
              url: e.url || ``
            });
          }
        });
      };
      chrome.tabs.onUpdated.addListener(e);
      chrome.tabs.onActivated.addListener(n);
      let r = (e, t, n) => {
        if (e.action === `resourceAdded` && e.resource) {
          let t = e.resource;
          let r = t.source === `local-tool`;
          let i = {
            ...t,
            folder: `migrated`,
            source: r ? `local-tool` : `extension`
          };
          ne(e => {
            if (e.find(e => {
              return e.id === i.id;
            })) {
              return e;
            } else {
              return [i, ...e];
            }
          });
          if (r) {
            et(e => {
              return e + 1;
            });
          } else {
            Ar({
              ...i,
              id: String(i.id)
            }).then(() => {
              return et(e => {
                return e + 1;
              });
            });
          }
          H(`transit`);
          me(`materials`);
          n({
            success: true
          });
          return false;
        }
        n({
          success: false,
          error: `unknown_action`
        });
        return false;
      };
      chrome.runtime.onMessage.addListener(r);
      return () => {
        clearTimeout(t);
        chrome.tabs.onUpdated.removeListener(e);
        chrome.tabs.onActivated.removeListener(n);
        chrome.runtime.onMessage.removeListener(r);
      };
    }
    return () => {
      return clearTimeout(t);
    };
  }, []);
  W.useEffect(() => {
    if (!ca) {
      return;
    }
    let e = setTimeout(() => {
      z.setObject(B.PROJECTS, X).catch(e => {
        return console.error(`PROJECTS save error`, e);
      });
      z.setObject(B.USERS, rn).catch(e => {
        return console.error(`USERS save error`, e);
      });
      let e = Y.filter(e => {
        return !e.readonly;
      });
      z.setObject(B.API_CONFIGS, e).catch(e => {
        return console.error(`API_CONFIGS save error`, e);
      });
      z.setObject(B.PRESET_PROMPTS, Q).catch(e => {
        return console.error(`PRESET_PROMPTS save error`, e);
      });
      z.setObject(B.CUSTOM_NODE_TEMPLATES, ni).catch(e => {
        return console.error(`CUSTOM_NODE_TEMPLATES save error`, e);
      });
      z.setObject(B.CLOUD_STORAGE_CONFIG, f).catch(e => {
        return console.error(`CLOUD_STORAGE_CONFIG save error`, e);
      });
    }, 1000);
    return () => {
      return clearTimeout(e);
    };
  }, [X, rn, Y, Q, ni, f]);
  W.useEffect(() => {
    if (!ca) {
      return;
    }
    let e = {
      defaultTextModel: In,
      defaultDrawingModel: Un,
      defaultVideoModel: Yn,
      defaultAudioModel: Cr,
      defaultSd2VideoModel: or,
      textApiConfigId: ai,
      imageApiConfigId: si,
      videoApiConfigId: li,
      sd2VideoApiConfigId: di,
      audioApiConfigId: hi,
      videoDurations: Zn,
      globalPollingInterval: Wr,
      globalMaxPollingDuration: Kr,
      globalSyncTimeout: Jr,
      transitGridCols: Te,
      sd2Token: g,
      useThumbnail: Xr,
      panPerformanceMode: Qr,
      enablePerformanceMode: ei
    };
    let t = setTimeout(() => {
      z.setObject(B.APP_SETTINGS, e).catch(e => {
        return console.error(`APP_SETTINGS save error`, e);
      });
    }, 1000);
    return () => {
      return clearTimeout(t);
    };
  }, [In, Un, Yn, Cr, or, ai, si, li, di, hi, Zn, Wr, Kr, Jr, Te, g, Xr, Qr, ei]);
  W.useEffect(() => {
    if (u.length === 0 || u.filter(e => {
      return e.status === `pending` || e.status === `running`;
    }).length === 0) {
      return;
    }
    let e = setInterval(async () => {
      d(e => {
        let t = Date.now();
        if (e.filter(e => {
          return (e.status === `pending` || e.status === `running`) && e.type === `discountVideo` && !!e.taskId;
        }).length !== 0) {
          (async () => {
            let n = false;
            let r = [...e];
            for (let e = 0; e < r.length; e++) {
              let i = r[e];
              if (i.status !== `pending` && i.status !== `running` || i.type !== `discountVideo` || !i.taskId) {
                continue;
              }
              let a = (Kr || 600) * 1000;
              if (t - i.createdAt > a) {
                r[e] = {
                  ...i,
                  status: `failed`,
                  errorMsg: `查询超时，已停止同步`
                };
                n = true;
                continue;
              }
              try {
                let a = cr.replace(/[`\s]/g, ``).replace(/\/$/, ``);
                let o = i.taskId || i.id;
                let s = await fetch(`${a}/v1/gateway/task/${o}`, {
                  headers: {
                    Authorization: `Bearer ${ur}`,
                    Accept: `*/*`
                  }
                });
                if (!s.ok) {
                  if (s.status === 404) {
                    let a = (i.notFoundCount || 0) + 1;
                    if (t - i.createdAt > 30000 && a >= 3) {
                      r[e] = {
                        ...i,
                        status: `failed`,
                        errorMsg: `任务未找到或已被清理`,
                        notFoundCount: a
                      };
                      n = true;
                      if (i.nodeId) {
                        window.dispatchEvent(new CustomEvent(`mutiwindow-task-completed`, {
                          detail: {
                            taskId: o,
                            nodeId: i.nodeId,
                            resultUrl: undefined,
                            type: i.type,
                            status: `failed`,
                            errorMsg: `任务未找到或已被清理`
                          }
                        }));
                      }
                    } else {
                      r[e] = {
                        ...i,
                        notFoundCount: a
                      };
                      n = true;
                    }
                  }
                  continue;
                }
                let c = await s.json();
                let l = false;
                let u = false;
                let d = ``;
                let f = ``;
                let p = i.progress;
                if (c.code === 1 && c.data) {
                  let e = c.data.status;
                  if (e === 3 || e === `success` || e === `SUCCESS` || e === `completed`) {
                    l = true;
                    d = c.data.video_url || c.data.result_url || c.data.data?.content?.video_url;
                  } else if (e === 4 || e === `failed` || e === `FAILED` || e === `error`) {
                    u = true;
                    f = c.data.fail_reason || c.data.error || `视频生成失败`;
                  } else if (c.data.progress) {
                    p = parseInt(String(c.data.progress).replace(`%`, ``)) || 50;
                  }
                } else if (c.status !== undefined && !c.data) {
                  let e = c.status;
                  if (e === 3 || e === `success` || e === `SUCCESS` || e === `completed`) {
                    l = true;
                    d = c.video_url || c.result_url;
                  } else if (e === 4 || e === `failed` || e === `FAILED` || e === `error`) {
                    u = true;
                    f = c.fail_reason || c.error || `视频生成失败`;
                  } else if (c.progress) {
                    p = parseInt(String(c.progress).replace(`%`, ``)) || 50;
                  }
                } else if (c.status === `success` || c.status === `succeeded` || c.status === `completed`) {
                  l = true;
                  d = c.result?.url || c.resultUrl || c.responseData?.debug_extracted_url;
                } else if (c.status === `failed`) {
                  u = true;
                  f = c.errorMsg || c.errorMessage || c.error || `任务生成失败`;
                } else if (c.progress !== undefined) {
                  p = parseInt(String(c.progress).replace(`%`, ``)) || 50;
                }
                if (l && d) {
                  d = d.replace(/[`\s]/g, ``);
                  r[e] = {
                    ...i,
                    status: `completed`,
                    progress: 100,
                    resultUrl: d,
                    responseData: c,
                    customRawResponse: c
                  };
                  n = true;
                  if (i.nodeId) {
                    window.dispatchEvent(new CustomEvent(`mutiwindow-task-completed`, {
                      detail: {
                        taskId: o,
                        nodeId: i.nodeId,
                        resultUrl: d,
                        type: i.type,
                        status: `completed`,
                        errorMsg: undefined
                      }
                    }));
                  }
                } else if (u) {
                  if (typeof f == `object`) {
                    try {
                      f = JSON.stringify(f);
                    } catch {
                      f = `未知错误`;
                    }
                  }
                  r[e] = {
                    ...i,
                    status: `failed`,
                    errorMsg: f,
                    responseData: c,
                    customRawResponse: c
                  };
                  n = true;
                  if (i.nodeId) {
                    window.dispatchEvent(new CustomEvent(`mutiwindow-task-completed`, {
                      detail: {
                        taskId: o,
                        nodeId: i.nodeId,
                        resultUrl: undefined,
                        type: i.type,
                        status: `failed`,
                        errorMsg: f
                      }
                    }));
                  }
                } else if (p !== i.progress && p !== undefined) {
                  r[e] = {
                    ...i,
                    progress: p,
                    errorMsg: undefined,
                    responseData: c,
                    customRawResponse: c
                  };
                  n = true;
                } else if (i.errorMsg) {
                  r[e] = {
                    ...i,
                    errorMsg: undefined,
                    notFoundCount: 0,
                    responseData: c,
                    customRawResponse: c
                  };
                  n = true;
                } else {
                  r[e] = {
                    ...i,
                    responseData: c,
                    customRawResponse: c
                  };
                }
              } catch (e) {
                console.error(`Failed to sync task ${i.id}`, e);
              }
            }
            if (n) {
              d(r);
              dt(e, r).catch(e => {
                return console.error(`Failed to persist global tasks:`, e);
              });
            }
          })();
        }
        return e;
      });
    }, (Wr || 10) * 1000);
    return () => {
      return clearInterval(e);
    };
  }, [u.length, cr, ur, Wr, Kr]);
  W.useEffect(() => {
    let e = e => {
      let {
        taskId: t,
        meta: n
      } = e.detail;
      if (!!t && !!n) {
        d(e => {
          let r = e.findIndex(e => {
            return e.id === t;
          });
          if (r === -1) {
            return e;
          }
          let i = e[r];
          let a = i.mediaMeta || {};
          let o = false;
          for (let e in n) {
            if (n[e] !== a[e]) {
              o = true;
              break;
            }
          }
          if (!o) {
            return e;
          }
          let s = [...e];
          s[r] = {
            ...i,
            mediaMeta: {
              ...a,
              ...n
            }
          };
          let c = s[r];
          setTimeout(() => {
            pt(c).catch(e => {
              return console.error(`Failed to save task meta:`, e);
            });
          }, 1000);
          return s;
        });
      }
    };
    window.addEventListener(`mutiwindow-update-task-meta`, e);
    return () => {
      return window.removeEventListener(`mutiwindow-update-task-meta`, e);
    };
  }, []);
  W.useEffect(() => {
    let e = () => {
      H(`settings`);
      Dt(`builtin`);
    };
    let t = () => {
      H(`settings`);
      Dt(`builtin`);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent(`builtin-panel-switch-schedule`));
      }, 50);
    };
    window.addEventListener(`mutiwindow-open-builtin-settings`, e);
    window.addEventListener(`mutiwindow-open-schedule-settings`, t);
    let n = () => {
      H(`settings`);
      Dt(`basic`);
    };
    window.addEventListener(tt, n);
    return () => {
      window.removeEventListener(`mutiwindow-open-builtin-settings`, e);
      window.removeEventListener(`mutiwindow-open-schedule-settings`, t);
      window.removeEventListener(tt, n);
    };
  }, []);
  W.useEffect(() => {
    let e = e => {
      if (e.key === `Escape` && M) {
        P(null);
      }
    };
    window.addEventListener(`keydown`, e);
    return () => {
      return window.removeEventListener(`keydown`, e);
    };
  }, [M]);
  let fa = e => {
    an(e);
    z.setObject(B.USERS, e).then(e => {
      if (!e) {
        console.error(`Storage save failed for users`);
        if (k) {
          alert(`保存失败：存储操作失败。`);
        }
      }
    }).catch(e => {
      console.error(`Save exception:`, e);
      alert(`保存发生异常: ${e}`);
    });
  };
  let pa = async e => {
    if (k) {
      try {
        let [t] = await chrome.tabs.query({
          active: true,
          currentWindow: true
        });
        if (!t?.url || !t.url.startsWith(`http`)) {
          console.log(`无法获取当前页面 URL`);
          return;
        }
        let n = t.url;
        console.log(`正在同步 cookies 到:`, n);
        let r = await chrome.cookies.getAll({
          url: n
        });
        let i = new Set(e.cookies?.map(e => {
          return e.name;
        }) || []);
        let a = 0;
        for (let e of r) {
          if (!i.has(e.name)) {
            try {
              await chrome.cookies.remove({
                url: n,
                name: e.name,
                storeId: e.storeId
              });
              a++;
              console.log(`已清除多余 cookie:`, e.name);
            } catch (t) {
              console.error(`清除 cookie 失败:`, e.name, t);
            }
          }
        }
        let o = 0;
        for (let t of e.cookies || []) {
          try {
            let e = {
              url: n,
              name: t.name,
              value: t.value
            };
            if (t.domain) {
              e.domain = t.domain;
            }
            if (t.path) {
              e.path = t.path;
            }
            if (t.secure !== undefined) {
              e.secure = t.secure;
            }
            if (t.httpOnly !== undefined) {
              e.httpOnly = t.httpOnly;
            }
            if (t.expirationDate) {
              e.expirationDate = t.expirationDate;
            }
            if (t.storeId) {
              e.storeId = t.storeId;
            }
            if (t.sameSite) {
              e.sameSite = t.sameSite;
            }
            await chrome.cookies.set(e);
            o++;
            console.log(`已设置 cookie:`, t.name);
          } catch (e) {
            console.error(`设置 cookie 失败:`, t.name, e);
          }
        }
        console.log(`Cookie 同步完成：清除 ${a} 个，设置 ${o} 个`);
      } catch (e) {
        console.error(`Cookie 同步失败:`, e);
      }
    }
  };
  let ma = [`sid_tt`, `sid_guard`, `uid_tt`, `ttwid`, `n_mh`, `odin_tt`, `has_biz_token`, `is_staff_user`, `user_spaces_idc`];
  let ha = async (e, t = false) => {
    if (!k) {
      K.error(`仅支持浏览器扩展环境`);
      return;
    }
    try {
      let [n] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });
      if (!n?.url || !n.url.startsWith(`http`)) {
        K.error(`无法获取当前页面 URL`);
        return;
      }
      let r = n.url;
      console.log(`正在清除页面 cookies:`, r);
      let i = await chrome.cookies.getAll({
        url: r
      });
      if (i.length === 0) {
        K.info(`当前页面没有可清除的 Cookies`);
        return;
      }
      console.log(`找到 ${i.length} 个 Cookies，开始清除...`);
      let a = 0;
      let o = [];
      for (let e of i) {
        if (t || ma.includes(e.name)) {
          try {
            await chrome.cookies.remove({
              url: r,
              name: e.name,
              storeId: e.storeId
            });
            a++;
            o.push(e.name);
            console.log(`已清除:`, e.name);
          } catch (t) {
            console.error(`清除 cookie 失败:`, e.name, t);
          }
        }
      }
      e.cookies = [];
      if (a === 0) {
        K.info(`没有找到登录状态 Cookies`);
      } else {
        let e = t ? `全部` : `登录状态`;
        K.success(`已清除 ${a} 个${e} Cookies`);
        console.log(`已清除的 cookies:`, o);
      }
      if (n.id) {
        chrome.tabs.reload(n.id);
      }
    } catch (e) {
      console.error(`清除 cookies 失败:`, e);
      K.error(`清除 Cookies 失败`);
    }
  };
  let ga = async e => {
    await pa(e);
    if (k && e.siteUrl) {
      let t = (await chrome.tabs.query({
        active: true,
        currentWindow: true
      }))[0];
      if (t) {
        chrome.tabs.update(t.id, {
          url: e.siteUrl
        });
      }
    }
    cn(e);
  };
  let _a = async () => {
    qt(false);
    Jt(null);
    Et(``);
    be();
    z.remove(B.AUTH_TOKEN);
  };
  let [va, ya] = W.useState(false);
  let ba = async () => {
    if (!_t.getCurrentToken()) {
      $(`请先登录`);
      return;
    }
    ya(true);
    try {
      let e = {};
      for (let t of [`app_settings`, `api_configs`, `users`, `membership`, `projects`, `presetPrompts`, `customNodeTemplates`, `modelSchedules`, `cloud_storage_config`]) {
        let n = t === `modelSchedules` ? Re() : await z.getObject(t);
        if (n !== null) {
          e[t] = n;
        }
      }
      if (Object.keys(e).length === 0) {
        $(`本地没有可同步的配置数据`);
        ya(false);
        return;
      }
      if ((await _t.post(`/sync/upload`, {
        type: `cloud_config`,
        data: e
      })).success) {
        $(`【配置】已同步到云端`);
      } else {
        $(`同步失败，请重试`);
      }
    } catch (e) {
      console.error(`[云端同步] 同步失败:`, e);
      $(`同步失败，请重试`);
    } finally {
      ya(false);
    }
  };
  let xa = async () => {
    if (!_t.getCurrentToken()) {
      $(`请先登录`);
      return;
    }
    ya(true);
    try {
      let e = await _t.get(`/sync/download`);
      if (!e.success || !e.data || e.data.hasData !== true) {
        $(`云端没有配置数据`);
        ya(false);
        return;
      }
      let t = e.data.data.cloud_config || e.data.data || {};
      let n = Object.keys(t);
      if (n.length === 0) {
        $(`云端没有新的配置数据`);
        ya(false);
        return;
      }
      let r = 0;
      for (let e of n) {
        let n = t[e];
        if (n != null) {
          if (e === `modelSchedules`) {
            await Tt(n);
          } else {
            await z.setObject(e, n);
          }
          r++;
        }
      }
      $(r > 0 ? `【配置】已从云端同步到本地 (${r}项)` : `没有需要恢复的配置`);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (e) {
      console.error(`[云端同步] 同步失败:`, e);
      $(`同步失败，请重试`);
    } finally {
      ya(false);
    }
  };
  let Sa = async (e = false) => {
    let t = e ? `` : fn;
    let n = e ? `` : gn;
    let r = e ? null : mn;
    let i = t.trim();
    if (!i && bn) {
      i = bn.title;
    }
    i ||= `新建环境`;
    yn(true);
    try {
      let e = [];
      let t = `未知网站`;
      let a = ``;
      let o = ``;
      if (n.trim()) {
        try {
          let r = [];
          try {
            let e = JSON.parse(n);
            if (Array.isArray(e)) {
              r = e;
            } else {
              r = [e];
            }
          } catch {
            if (gn.includes(`=`)) {
              r = gn.split(`;`).map(e => {
                let [t, ...n] = e.trim().split(`=`);
                let r = n.join(`=`);
                if (t && r) {
                  return {
                    name: t.trim(),
                    value: r.trim(),
                    domain: new URL(a || `https://example.com`).hostname,
                    path: `/`,
                    secure: true
                  };
                } else {
                  return null;
                }
              }).filter(Boolean);
            }
          }
          if (r.length > 0) {
            e = r;
            t = `手动添加`;
            a ||= `https://example.com`;
            o = bn?.favIconUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`;
          } else {
            throw Error(`Invalid cookie format`);
          }
        } catch {
          alert(`Cookie 格式错误，请输入有效的 JSON 数组或 key=value; 格式字符串`);
          yn(false);
          return;
        }
      } else if (k) {
        let n = (await chrome.tabs.query({
          active: true,
          currentWindow: true
        }))[0];
        console.log(`add tab`, n);
        if (n?.url) {
          a = n.url;
          o = n.favIconUrl || `https://www.google.com/s2/favicons?domain=${new URL(n.url).hostname}&sz=64`;
          e = await chrome.cookies.getAll({
            url: n.url
          });
          console.log(`add cookies`, e);
          if (n.title) {
            t = n.title.substring(0, 5);
          }
        }
      } else {
        t = `开发测试网`;
        a = `http://localhost:3000`;
        o = `https://api.dicebear.com/7.x/avataaars/svg?seed=test`;
        e = [{
          name: `test`,
          value: `123`
        }];
      }
      if (e.length === 0 && !confirm(`当前页面未检测到 Cookie，且未手动输入，确定要保存吗？`)) {
        yn(false);
        return;
      }
      let s = e.map(e => {
        return {
          name: e.name,
          value: e.value,
          domain: e.domain,
          path: e.path,
          secure: e.secure,
          httpOnly: e.httpOnly,
          expirationDate: e.expirationDate,
          sameSite: e.sameSite,
          storeId: e.storeId
        };
      });
      let c;
      if (r) {
        c = rn.map(e => {
          if (e.id === r) {
            return {
              ...e,
              name: i,
              cookies: s,
              avatar: o || e.avatar,
              siteName: e.siteName,
              siteUrl: e.siteUrl
            };
          } else {
            return e;
          }
        });
      } else {
        let e = {
          id: Date.now().toString(),
          name: i,
          siteName: t,
          siteUrl: a,
          avatar: o || `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`,
          cookies: s
        };
        c = [...rn, e];
      }
      fa(c);
      pn(``);
      _n(``);
      hn(null);
      dn(false);
    } catch (e) {
      console.error(`Error during add environment:`, e);
      alert(`添加失败，请重试: ${e.message || `未知错误`}`);
    } finally {
      yn(false);
    }
  };
  let [Ca, wa] = W.useState(null);
  let [Ta, Ea] = W.useState(null);
  let Da = (e, t) => {
    wa(t);
    e.dataTransfer.effectAllowed = `move`;
    setTimeout(() => {
      let t = e.target;
      if (t) {
        t.style.opacity = `0.5`;
      }
    }, 0);
  };
  let Oa = e => {
    wa(null);
    Ea(null);
    let t = e.target;
    if (t) {
      t.style.opacity = `1`;
    }
  };
  let ka = (e, t) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = `move`;
    if (Ta !== t) {
      Ea(t);
    }
  };
  let Aa = (e, t) => {
    e.preventDefault();
    Ea(null);
    if (Ca === null || Ca === t) {
      return;
    }
    let n = [...rn];
    let [r] = n.splice(Ca, 1);
    n.splice(t, 0, r);
    fa(n);
  };
  let [ja, Ma] = W.useState(null);
  let Na = (e, t) => {
    t.stopPropagation();
    if (ja === e) {
      fa(rn.filter(t => {
        return t.id !== e;
      }));
      if (on?.id === e) {
        cn(null);
      }
      Ma(null);
    } else {
      Ma(e);
      setTimeout(() => {
        return Ma(null);
      }, 3000);
    }
  };
  let Pa = async e => {
    let t = !e.isFavorite;
    let n = n => {
      if (n.id === e.id) {
        return {
          ...n,
          isFavorite: t
        };
      } else {
        return n;
      }
    };
    Ie(e => {
      return e.map(n);
    });
    ne(e => {
      return e.map(n);
    });
    await jr(e, t);
  };
  let Fa = async () => {
    if (confirm(`确定清空当前页签下所有未收藏的资源吗？（收藏的资源保留，本地文件将被删除）`)) {
      await Nr(pe === `generated` ? `tasks` : `migrated`, true);
      et(e => {
        return e + 1;
      });
      Ya.current?.();
      $(`已清空未收藏资源`);
    }
  };
  W.useEffect(() => {
    let e = async e => {
      if (V !== `transit`) {
        return;
      }
      let t = e.clipboardData?.items;
      if (t) {
        for (let e = 0; e < t.length; e++) {
          let n = t[e];
          if (n.type.indexOf(`image`) !== -1) {
            let e = n.getAsFile();
            if (e) {
              let t = new FileReader();
              t.onload = e => {
                if (e.target?.result) {
                  let t = e.target.result;
                  Ia(t, `image`);
                }
              };
              t.readAsDataURL(e);
            }
          } else if (n.type === `text/plain`) {
            n.getAsString(e => {
              if (e) {
                Ia(e, `text`);
              }
            });
          }
        }
      }
    };
    window.addEventListener(`paste`, e);
    return () => {
      window.removeEventListener(`paste`, e);
    };
  }, [V, L]);
  let Ia = (e, t, n = `pasted`) => {
    let r = n === `generated`;
    let i = r && e.includes(`/files/resources/`);
    let a = {
      id: Date.now().toString(),
      url: e,
      type: t,
      timestamp: Date.now(),
      pageUrl: `clipboard`,
      pageTitle: n === `generated` ? `AI生成内容` : `来自剪贴板`,
      source: n,
      folder: r ? `tasks` : `migrated`
    };
    ne(e => {
      return [a, ...e];
    });
    if (i) {
      et(e => {
        return e + 1;
      });
      return;
    }
    Ar({
      ...a
    }).then(() => {
      return et(e => {
        return e + 1;
      });
    });
  };
  let La = async e => {
    if (!k) {
      $(`发送失败：非插件环境`);
      return;
    }
    try {
      $(`正在发送...`);
      let t = ``;
      let n = `image/png`;
      let r = `png`;
      let i = typeof e == `string` ? {
        url: e,
        type: `image/png`
      } : e;
      if (i.type.startsWith(`image`)) {
        try {
          let e = await (await fetch(i.url)).blob();
          n = e.type || `image/png`;
          r = n.split(`/`)[1] || `png`;
          t = await new Promise((t, n) => {
            let r = new FileReader();
            r.onloadend = () => {
              return t(r.result);
            };
            r.onerror = n;
            r.readAsDataURL(e);
          });
        } catch {
          let e = new Image();
          e.crossOrigin = `Anonymous`;
          e.src = i.url;
          await new Promise((t, n) => {
            e.onload = t;
            e.onerror = n;
          });
          let a = document.createElement(`canvas`);
          a.width = e.width;
          a.height = e.height;
          a.getContext(`2d`)?.drawImage(e, 0, 0);
          t = a.toDataURL(`image/png`);
          n = `image/png`;
          r = `png`;
        }
      } else if (i.type.startsWith(`video`)) {
        let e = await (await fetch(i.url)).blob();
        n = e.type || `video/mp4`;
        r = n.split(`/`)[1] || `mp4`;
        t = await new Promise((t, n) => {
          let r = new FileReader();
          r.onloadend = () => {
            return t(r.result);
          };
          r.onerror = n;
          r.readAsDataURL(e);
        });
      } else {
        $(`暂不支持发送此类型文件`);
        return;
      }
      let [a] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });
      if (!a?.id) {
        $(`未找到活动标签页`);
        return;
      }
      await chrome.scripting.executeScript({
        target: {
          tabId: a.id
        },
        func: (e, t, n) => {
          let r = Array.from(document.querySelectorAll(`input[type="file"]`));
          let i = r.find(e => {
            return e.offsetParent !== null;
          }) || r[0];
          if (!i) {
            alert(`未在当前页面找到可用的文件上传框`);
            return;
          }
          let a = e.split(`,`);
          let o = atob(a[1]);
          let s = o.length;
          let c = new Uint8Array(s);
          while (s--) {
            c[s] = o.charCodeAt(s);
          }
          let l = new File([c], `upload-${Date.now()}.${n}`, {
            type: t
          });
          let u = new DataTransfer();
          u.items.add(l);
          let d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, `files`)?.set;
          if (d) {
            d.call(i, u.files);
          } else {
            i.files = u.files;
          }
          i.dispatchEvent(new Event(`change`, {
            bubbles: true
          }));
          i.dispatchEvent(new Event(`input`, {
            bubbles: true
          }));
          let f = i.style.border;
          i.style.border = `2px solid #3b82f6`;
          setTimeout(() => {
            i.style.border = f;
          }, 1000);
          return true;
        },
        args: [t, n, r]
      });
      $(`已发送到左侧网站！`);
    } catch (e) {
      console.error(e);
      $(`发送失败，请确保左侧有打开的网页，且文件没有过大`);
    }
  };
  let Ra = async e => {
    try {
      if (e.type === `text`) {
        await navigator.clipboard.writeText(e.url);
        $(`文本已复制！`);
      } else if (e.type.startsWith(`image`)) {
        try {
          let t = new Image();
          t.crossOrigin = `Anonymous`;
          t.src = e.url;
          await new Promise((e, n) => {
            t.onload = e;
            t.onerror = n;
          });
          let n = document.createElement(`canvas`);
          n.width = t.width;
          n.height = t.height;
          n.getContext(`2d`)?.drawImage(t, 0, 0);
          n.toBlob(async t => {
            if (t) {
              try {
                let e = new ClipboardItem({
                  'image/png': t
                });
                await navigator.clipboard.write([e]);
                $(`图片已复制到剪贴板！`);
              } catch (t) {
                console.error(`Clipboard write failed:`, t);
                await navigator.clipboard.writeText(e.url);
                $(`图片链接已复制（直接复制图片失败）`);
              }
            }
          }, `image/png`);
        } catch (t) {
          console.error(`Failed to process image:`, t);
          await navigator.clipboard.writeText(e.url);
          $(`图片链接已复制（直接复制图片失败）`);
        }
      } else {
        await navigator.clipboard.writeText(e.url);
        $(`链接已复制！`);
      }
    } catch (e) {
      console.error(`Copy failed:`, e);
    }
  };
  let za = e => {
    Mr(e).catch(e => {
      return console.error(`delete resource failed:`, e);
    });
    Ie(t => {
      return t.filter(t => {
        return t.id !== e;
      });
    });
    ne(t => {
      return t.filter(t => {
        return t.id !== e;
      });
    });
    ze(e => {
      return Math.max(0, e - 1);
    });
  };
  let Ba = () => {
    if (!Ii.trim()) {
      return;
    }
    let e = {
      id: `proj-${Date.now()}`,
      name: Ii
    };
    let t = [...X, e];
    Mi(t);
    Ni(e.id);
    Li(``);
    Fi(false);
    z.setObject(B.PROJECTS, t);
  };
  let Va = () => {
    let e = X.find(e => {
      return e.id === Z;
    });
    if (e) {
      Vi(e.name);
      zi(true);
    }
  };
  let Ha = () => {
    let e = Bi.trim();
    if (!e) {
      $(`应用名称不能为空`);
      return;
    }
    let t = X.map(t => {
      if (t.id === Z) {
        return {
          ...t,
          name: e
        };
      } else {
        return t;
      }
    });
    Mi(t);
    z.setObject(B.PROJECTS, t);
    zi(false);
    Vi(``);
    $(`应用名称已更新`);
  };
  let Ua = e => {
    if (X.length <= 1) {
      $(`至少保留一个项目`);
      return;
    }
    if (confirm(`确定删除此项目吗？`)) {
      let t = X.filter(t => {
        return t.id !== e;
      });
      Mi(t);
      if (Z === e) {
        Ni(t[0].id);
      }
      z.setObject(B.PROJECTS, t);
      At.default.removeItem(`canvas-state-v1-${e}`).catch(console.error);
    }
  };
  let Wa = e => {
    e.id ||= Date.now().toString();
    let t = [...ni, e];
    ri(t);
    z.setObject(B.CUSTOM_NODE_TEMPLATES, t);
    $(`已保存为自定义节点`);
  };
  let Ga = e => {
    if (confirm(`确定要删除这个自定义节点模板吗？`)) {
      let t = ni.filter(t => {
        return t.id !== e;
      });
      ri(t);
      z.setObject(B.CUSTOM_NODE_TEMPLATES, t);
      $(`已删除自定义节点`);
    }
  };
  let Ka = e => {
    d(t => {
      let n = e(t);
      dt(t, n).catch(e => {
        return console.error(`Failed to persist global tasks:`, e);
      });
      return n;
    });
  };
  let {
    handleRefreshTask: qa
  } = Pt({
    isLoaded: ca,
    globalTasks: u,
    handleUpdateGlobalTasks: Ka,
    showToastMessage: $,
    localPort: r.status.port,
    localToolConnected: r.status.isConnected,
    sd2VideoApiUrl: tr,
    sd2VideoApiKey: rr,
    videoApiUrl: Gn,
    videoApiKey: qn,
    discountVideoApiUrl: cr,
    discountVideoApiKey: ur,
    aiAppApiUrl: mr,
    aiAppApiKey: gr
  });
  let Ja = e => {
    if (!e.nodeId) {
      $(`该任务无关联节点,无法重新执行`);
      return;
    }
    window.dispatchEvent(new CustomEvent(`mutiwindow-rerun-task`, {
      detail: {
        task: e
      }
    }));
    $(`正在重新执行任务...`);
  };
  let Ya = W.useRef(xt);
  Ya.current = xt;
  W.useEffect(() => {
    yt.current = u;
  }, [u]);
  W.useEffect(() => {
    (async () => {
      if (ht.current) {
        console.log(`[统一同步] 正在同步中，跳过此次触发`);
        return;
      }
      ht.current = true;
      try {
        if (u.length > 0 && r.status.port) {
          let e = false;
          let t = await Promise.all(u.map(async t => {
            if (t.status !== `completed`) {
              return t;
            }
            let n = {
              ...t
            };
            let i = false;
            let a = async (e, n, i) => {
              if (!e || typeof e != `string`) {
                return e;
              }
              let a = /:\d+\/files\//.test(e);
              if (a && /\/files\/tasks(\/|$)/.test(e)) {
                return e;
              }
              try {
                if (!a && e.startsWith(`http`) || e.startsWith(`data:`) || e.startsWith(`blob:`)) {
                  let a = null;
                  if (e.startsWith(`http`)) {
                    a = e;
                  } else {
                    a = await (await fetch(e)).blob();
                  }
                  let o = n === `image` ? `png` : n === `video` ? `mp4` : `mp3`;
                  let s = t.createdAt && Number.isFinite(t.createdAt) ? t.createdAt : Date.now();
                  let c = `${i}_${t.id.substring(0, 8)}_${s}.${o}`;
                  return (await r.uploadFile(a, c, `tasks`)).url;
                }
              } catch (e) {
                console.error(`Failed to sync to local tool:`, e);
              }
              return e;
            };
            if (t.type === `custom` && t.customResultData && typeof t.customResultData == `string`) {
              if (t.customOutputType === `image` || t.customOutputType === `video` || t.customOutputType === `audio`) {
                let e = await a(t.customResultData, t.customOutputType, t.customOutputType);
                if (e !== t.customResultData) {
                  n.customResultData = e;
                  i = true;
                }
              }
            } else if (t.resultUrl) {
              let e = t.type === `image` ? `image` : t.type === `video` || t.type === `sd2Video` || t.type === `discountVideo` ? `video` : `text`;
              if (e === `image` || e === `video`) {
                let r = await a(t.resultUrl, e, e);
                if (r !== t.resultUrl) {
                  n.resultUrl = r;
                  i = true;
                }
              }
            }
            if (t.thumbnailUrl) {
              let e = await a(t.thumbnailUrl, `image`, `thumb`);
              if (e !== t.thumbnailUrl) {
                n.thumbnailUrl = e;
                i = true;
              }
            }
            if (i) {
              e = true;
            }
            return n;
          }));
          if (e) {
            d(t);
            dt(u, t).catch(e => {
              return console.error(`Failed to persist global tasks:`, e);
            });
            t.forEach((e, t) => {
              let n = u[t];
              if (!n || !e.nodeId || e.resultUrl === n.resultUrl && e.customResultData === n.customResultData && e.thumbnailUrl === n.thumbnailUrl) {
                return;
              }
              let r = e.type === `custom` ? e.customResultData : e.resultUrl;
              window.dispatchEvent(new CustomEvent(`mutiwindow-task-completed`, {
                detail: {
                  taskId: e.id,
                  nodeId: e.nodeId,
                  resultUrl: r,
                  thumbnailUrl: e.thumbnailUrl,
                  type: e.type,
                  customOutputType: e.customOutputType,
                  status: e.status,
                  errorMsg: e.errorMsg
                }
              }));
            });
          }
        }
        await Ya.current();
      } finally {
        ht.current = false;
      }
    })();
  }, [u, r.status.isConnected, r.status.port]);
  let Xa = W.useCallback(async (e = false) => {
    if (!e) {
      $(`正在同步本地文件夹...`);
    }
    try {
      await xt();
      if (!e) {
        $(`同步成功`);
      }
    } catch {
      if (!e) {
        $(`同步失败`);
      }
    }
  }, [xt, $]);
  W.useEffect(() => {
    if (V === `transit`) {
      Xa(true);
    }
  }, [V, Xa]);
  let Za = (e, t, n) => {
    let r = [...Q];
    r[e] = {
      ...r[e],
      [t]: n
    };
    $i(r);
  };
  let Qa = () => {
    $i([...Q, {
      title: `新预设`,
      prompt: ``,
      type: `all`,
      enabled: true
    }]);
  };
  let $a = e => {
    $i(Q.filter((t, n) => {
      return n !== e;
    }));
  };
  W.useEffect(() => {}, [ai, si, li, hi, ca, g, Te, Y]);
  let eo = async () => {
    $(`开始同步数据到本地引擎...`);
    try {
      let e = {
        defaultTextModel: In,
        defaultDrawingModel: Un,
        defaultVideoModel: Yn,
        defaultAudioModel: Cr,
        defaultSd2VideoModel: or,
        textApiConfigId: ai,
        imageApiConfigId: si,
        videoApiConfigId: li,
        sd2VideoApiConfigId: di,
        audioApiConfigId: hi,
        videoDurations: Zn,
        globalPollingInterval: Wr,
        globalMaxPollingDuration: Kr,
        globalSyncTimeout: Jr,
        transitGridCols: Te,
        sd2Token: g
      };
      let t = await z.setObject(B.APP_SETTINGS, e);
      console.log(`[syncAllToLocalTool] app_settings 保存结果:`, t);
      if (!t) {
        $(`⚠️ app_settings 保存失败，请检查本地引擎连接`);
        return;
      }
      await z.setObject(B.PROJECTS, X);
      await z.setObject(B.USERS, rn);
      await z.setObject(B.API_CONFIGS, Y.filter(e => {
        return !e.readonly;
      }));
      await z.setObject(B.PRESET_PROMPTS, Q);
      await z.setObject(B.CUSTOM_NODE_TEMPLATES, ni);
      await z.setObject(B.CLOUD_STORAGE_CONFIG, f);
      let n = 0;
      for (let e of X) {
        let t = He(e.id);
        let r = null;
        let i = await At.default.getItem(t);
        if (i) {
          r = i;
          if (await z.setObject(t, i)) {
            n++;
          }
        } else {
          let e = localStorage.getItem(t);
          if (e) {
            r = JSON.parse(e);
            if (await z.setObject(t, r)) {
              n++;
            }
          }
        }
        if (r && r.nodes) {
          for (let e of r.nodes) {
            if (e.data && e.data.imageUrlRef) {
              let t = e.data.imageUrlRef;
              let r = await At.default.getItem(t);
              if (r) {
                await z.setObject(t, r);
                n++;
              }
            }
          }
        }
      }
      console.log(`[syncAllToLocalTool] 共保存了`, n, `个项目数据`);
      $(`✅ 同步完成！已保存 ${n + 1} 项数据到本地引擎。`);
    } catch (e) {
      console.error(e);
      $(`同步失败：${String(e)}`);
    }
  };
  let to = async () => {
    try {
      let e = {
        localforage: {},
        kvStore: {}
      };
      for (let t of [`users`, `membership`, `old_membership`, `projects`, `lastOpenedProject`, `app_settings`, `presetPrompts`, `customNodeTemplates`, `cloud_storage_config`, `api_configs`]) {
        let n = await z.getObject(t);
        if (n !== null) {
          e.kvStore[t] = n;
        }
      }
      try {
        let t = await At.default.keys();
        for (let n of t) {
          if (!n.startsWith(`img_`) && n !== `transitResources`) {
            let t = await At.default.getItem(n);
            if (t !== null) {
              e.localforage[n] = t;
            }
          }
        }
      } catch (e) {
        console.error(`Failed to export localforage data:`, e);
      }
      let t = await z.getConfig(`app_settings`);
      if (t) {
        let n = typeof t == `string` ? JSON.parse(t) : t;
        e.kvStore.app_settings = n;
      }
      let n = e.kvStore.projects || [];
      for (let t of n) {
        let n = await z.getObject(He(t.id));
        if (n !== null) {
          e.kvStore[He(t.id)] = n;
        }
      }
      let r = new Blob([JSON.stringify(e, null, 2)], {
        type: `application/json`
      });
      let i = URL.createObjectURL(r);
      let a = document.createElement(`a`);
      a.href = i;
      a.download = `yimao-workflow-backup-${new Date().toISOString().split(`T`)[0]}.json`;
      a.click();
      URL.revokeObjectURL(i);
      $(`配置与工作流导出成功`);
    } catch (e) {
      console.error(e);
      $(`导出失败`);
    }
  };
  let no = e => {
    let t = e.target.files?.[0];
    if (!t) {
      return;
    }
    let n = new FileReader();
    n.onload = async e => {
      try {
        let t = JSON.parse(e.target?.result);
        let n = !t.localforage && !t.kvStore && (t.users || t.projects || t.apiConfigs || t.presetPrompts || t.customNodeTemplates || t.membership || t.cloudStorageConfig || t.apiUrl || t.apiKey || t.textApiUrl || t.textApiKey);
        let i = {};
        let a = {};
        if (n) {
          console.log(`[importData] 检测到老格式数据，正在兼容处理...`);
          if (t.users) {
            a[B.USERS] = t.users;
          }
          if (t.projects) {
            a[B.PROJECTS] = t.projects;
          }
          if (t.presetPrompts) {
            a[B.PRESET_PROMPTS] = t.presetPrompts;
          }
          if (t.customNodeTemplates) {
            a[B.CUSTOM_NODE_TEMPLATES] = t.customNodeTemplates;
          }
          if (t.membership) {
            a[B.MEMBERSHIP] = t.membership;
          }
          if (t.cloudStorageConfig) {
            a[B.CLOUD_STORAGE_CONFIG] = t.cloudStorageConfig;
          }
          if (t.lastOpenedProject) {
            a[B.LAST_OPENED_PROJECT] = t.lastOpenedProject;
          }
          if (t.apiConfigs) {
            a[B.API_CONFIGS] = t.apiConfigs;
          }
          let e = {};
          if (t.textModel) {
            e.defaultTextModel = t.textModel;
          }
          if (t.drawingModel) {
            e.defaultDrawingModel = t.drawingModel;
          }
          if (t.videoModel) {
            e.defaultVideoModel = t.videoModel;
          }
          if (t.audioModel) {
            e.defaultAudioModel = t.audioModel;
          }
          if (t.sd2VideoModel) {
            e.defaultSd2VideoModel = t.sd2VideoModel;
          }
          if (t.videoDurations) {
            e.videoDurations = t.videoDurations;
          }
          if (t.globalPollingInterval) {
            e.globalPollingInterval = t.globalPollingInterval;
          }
          if (t.globalMaxPollingDuration) {
            e.globalMaxPollingDuration = t.globalMaxPollingDuration;
          }
          if (t.globalSyncTimeout) {
            e.globalSyncTimeout = t.globalSyncTimeout;
          }
          if (t.transitGridCols) {
            e.transitGridCols = t.transitGridCols;
          }
          if (t.sd2Token) {
            e.sd2Token = t.sd2Token;
          }
          if (t.textApiConfigId) {
            e.textApiConfigId = t.textApiConfigId;
          }
          if (t.imageApiConfigId) {
            e.imageApiConfigId = t.imageApiConfigId;
          }
          if (t.videoApiConfigId) {
            e.videoApiConfigId = t.videoApiConfigId;
          }
          if (t.sd2VideoApiConfigId) {
            e.sd2VideoApiConfigId = t.sd2VideoApiConfigId;
          }
          if (t.audioApiConfigId) {
            e.audioApiConfigId = t.audioApiConfigId;
          }
          if (t.textApiUrl) {
            e.textApiUrl = t.textApiUrl;
          }
          if (t.textApiKey) {
            e.textApiKey = t.textApiKey;
          }
          if (t.imageApiUrl) {
            e.imageApiUrl = t.imageApiUrl;
          }
          if (t.imageApiKey) {
            e.imageApiKey = t.imageApiKey;
          }
          if (t.videoApiUrl) {
            e.videoApiUrl = t.videoApiUrl;
          }
          if (t.videoApiKey) {
            e.videoApiKey = t.videoApiKey;
          }
          if (t.sd2VideoApiUrl) {
            e.sd2VideoApiUrl = t.sd2VideoApiUrl;
          }
          if (t.sd2VideoApiKey) {
            e.sd2VideoApiKey = t.sd2VideoApiKey;
          }
          if (t.audioApiUrl) {
            e.audioApiUrl = t.audioApiUrl;
          }
          if (t.audioApiKey) {
            e.audioApiKey = t.audioApiKey;
          }
          if (t.apiUrl) {
            e.textApiUrl = t.apiUrl;
          }
          if (t.apiKey) {
            e.textApiKey = t.apiKey;
          }
          if (Object.keys(e).length > 0) {
            a[B.APP_SETTINGS] = e;
          }
          i = t.localforage || {};
          if (t.transitResources) {
            i[B.TRANSIT_RESOURCES] = t.transitResources;
          }
          if (t.canvasState || t.canvasStateV1) {
            i[`canvas-state-v1-default`] = t.canvasState || t.canvasStateV1;
          }
        } else {
          i = t.localforage || {};
          a = t.kvStore || {};
        }
        if (Object.keys(i).length > 0) {
          $(`正在恢复画布节点与连线...`);
          for (let e of Object.keys(i)) {
            await At.default.setItem(e, i[e]);
          }
        }
        if (r.status.isConnected && Object.keys(a).length > 0) {
          $(`正在恢复本地引擎配置...`);
          for (let e of Object.keys(a)) {
            await z.setObject(e, a[e]);
          }
        }
        $(`导入成功${n ? `（老格式已自动兼容）` : ``}，即将刷新页面应用更改`);
        setTimeout(() => {
          return window.location.reload();
        }, 1500);
      } catch (e) {
        console.error(e);
        $(`导入失败：文件格式不正确`);
      }
    };
    n.readAsText(t);
  };
  _cmp_Ft({
    importData: no,
    exportData: to
  });
  if (S) {
    const Component719 = `div`;
    return <Component719 className={`flex items-center justify-center h-screen`}>{`Loading...`}</Component719>;
  } else {
    const Component720 = `path`;
    const Component721 = `svg`;
    const Component722 = `span`;
    const Component723 = `button`;
    const Component724 = `div`;
    const Component725 = `div`;
    const Component726 = `button`;
    const Component727 = `button`;
    const Component728 = `button`;
    const Component729 = `div`;
    const Component730 = `span`;
    const Component731 = `div`;
    const Component732 = `div`;
    const Component733 = `div`;
    const Component734 = `span`;
    const Component735 = `div`;
    const Component736 = `div`;
    const Component737 = `div`;
    const Component738 = `line`;
    const Component739 = `line`;
    const Component740 = `svg`;
    const Component741 = `button`;
    const Component742 = `button`;
    const Component743 = `button`;
    const Component744 = `button`;
    const Component745 = `button`;
    const Component746 = `div`;
    const Component747 = `button`;
    const Component748 = `div`;
    const Component749 = `div`;
    const Component750 = `div`;
    const Component751 = `div`;
    const Component752 = `span`;
    const Component753 = `span`;
    const Component754 = `span`;
    const Component755 = `path`;
    const Component756 = `svg`;
    const Component757 = `span`;
    const Component758 = `span`;
    const Component759 = `span`;
    const Component760 = `div`;
    const Component761 = `span`;
    const Component762 = `span`;
    const Component763 = `div`;
    const Component764 = `div`;
    const Component765 = `button`;
    const Component766 = `button`;
    const Component767 = `button`;
    const Component768 = `div`;
    const Component769 = `div`;
    const Component770 = `div`;
    const Component771 = `img`;
    const Component772 = `span`;
    const Component773 = `button`;
    const Component774 = `img`;
    const Component775 = `span`;
    const Component776 = `span`;
    const Component777 = `div`;
    const Component778 = `div`;
    const Component779 = `div`;
    const Component780 = `span`;
    const Component781 = `span`;
    const Component782 = `div`;
    const Component783 = `button`;
    const Component784 = `div`;
    const Component785 = `div`;
    const Component786 = `button`;
    const Component787 = `button`;
    const Component788 = `div`;
    const Component789 = `button`;
    const Component790 = `div`;
    const Component791 = `path`;
    const Component792 = `polyline`;
    const Component793 = `line`;
    const Component794 = `svg`;
    const Component795 = `button`;
    const Component796 = `div`;
    const Component797 = `div`;
    const Component798 = `div`;
    const Component799 = `button`;
    const Component800 = `circle`;
    const Component801 = `polyline`;
    const Component802 = `svg`;
    const Component803 = `span`;
    const Component804 = `button`;
    const Component805 = `div`;
    const Component806 = `div`;
    const Component807 = `video`;
    const Component808 = `div`;
    const Component809 = `path`;
    const Component810 = `circle`;
    const Component811 = `circle`;
    const Component812 = `svg`;
    const Component813 = `audio`;
    const Component814 = `div`;
    const Component815 = `img`;
    const Component816 = `button`;
    const Component817 = `div`;
    const Component818 = `h3`;
    const Component819 = `button`;
    const Component820 = `div`;
    const Component821 = `input`;
    const Component822 = `button`;
    const Component823 = `div`;
    const Component824 = `textarea`;
    const Component825 = `div`;
    const Component826 = `p`;
    const Component827 = `div`;
    const Component828 = `div`;
    const Component829 = `a`;
    const Component830 = `div`;
    const Component831 = `div`;
    const Component832 = `div`;
    const Component833 = `div`;
    const Component834 = `div`;
    const Component835 = `img`;
    const Component836 = `div`;
    const Component837 = `span`;
    const Component838 = `div`;
    const Component839 = `circle`;
    const Component840 = `circle`;
    const Component841 = `circle`;
    const Component842 = `svg`;
    const Component843 = `button`;
    const Component844 = `button`;
    const Component845 = `button`;
    const Component846 = `button`;
    const Component847 = `div`;
    const Component848 = `button`;
    const Component849 = `div`;
    const Component850 = `div`;
    const Component851 = `div`;
    const Component852 = `div`;
    const Component853 = `div`;
    const Component854 = `div`;
    const Component855 = `div`;
    const Component856 = `div`;
    const Component857 = `div`;
    const Component858 = `span`;
    const Component859 = `polyline`;
    const Component860 = `svg`;
    const Component861 = `line`;
    const Component862 = `line`;
    const Component863 = `svg`;
    const Component864 = `span`;
    const Component865 = `div`;
    const Component866 = `div`;
    const Component867 = `div`;
    const Component868 = `h3`;
    const Component869 = `input`;
    const Component870 = `button`;
    const Component871 = `button`;
    const Component872 = `div`;
    const Component873 = `div`;
    const Component874 = `div`;
    const Component875 = `h3`;
    const Component876 = `input`;
    const Component877 = `button`;
    const Component878 = `button`;
    const Component879 = `div`;
    const Component880 = `div`;
    const Component881 = `div`;
    const Component882 = `div`;
    const Component883 = `div`;
    const Component884 = `div`;
    const Component885 = `button`;
    const Component886 = `button`;
    const Component887 = `button`;
    const Component888 = `button`;
    const Component889 = `button`;
    const Component890 = `div`;
    const Component891 = `span`;
    const Component892 = `span`;
    const Component893 = `h2`;
    const Component894 = `button`;
    const Component895 = `div`;
    const Component896 = `input`;
    const Component897 = `div`;
    const Component898 = `input`;
    const Component899 = `option`;
    const Component900 = `option`;
    const Component901 = `option`;
    const Component902 = `option`;
    const Component903 = `select`;
    const Component904 = `div`;
    const Component905 = `textarea`;
    const Component906 = `div`;
    const Component907 = `button`;
    const Component908 = `div`;
    const Component909 = `div`;
    const Component910 = `div`;
    const Component911 = `div`;
    const Component912 = `div`;
    const Component913 = `div`;
    const Component914 = `span`;
    const Component915 = `a`;
    const Component916 = `h2`;
    const Component917 = `button`;
    const Component918 = `div`;
    const Component919 = `div`;
    const Component930 = `button`;
    const Component931 = `div`;
    const Component932 = `div`;
    const Component933 = `span`;
    const Component934 = `h2`;
    const Component935 = `option`;
    const Component936 = `select`;
    const Component937 = `div`;
    const Component938 = `div`;
    const Component939 = `label`;
    const Component940 = `textarea`;
    const Component941 = `div`;
    const Component942 = `div`;
    const Component943 = `span`;
    const Component944 = `h2`;
    const Component945 = `option`;
    const Component946 = `select`;
    const Component947 = `div`;
    const Component948 = `div`;
    const Component949 = `label`;
    const Component950 = `textarea`;
    const Component951 = `div`;
    const Component952 = `div`;
    const Component953 = `span`;
    const Component954 = `h2`;
    const Component955 = `div`;
    const Component956 = `span`;
    const Component957 = `h3`;
    const Component958 = `option`;
    const Component959 = `select`;
    const Component960 = `div`;
    const Component961 = `textarea`;
    const Component962 = `div`;
    const Component963 = `div`;
    const Component964 = `div`;
    const Component965 = `label`;
    const Component966 = `textarea`;
    const Component967 = `div`;
    const Component968 = `div`;
    const Component969 = `div`;
    const Component970 = `span`;
    const Component971 = `h2`;
    const Component972 = `option`;
    const Component973 = `select`;
    const Component974 = `div`;
    const Component975 = `div`;
    const Component976 = `label`;
    const Component977 = `textarea`;
    const Component978 = `div`;
    const Component979 = `div`;
    const Component980 = `div`;
    const Component981 = `span`;
    const Component982 = `h2`;
    const Component983 = `div`;
    const Component984 = `strong`;
    const Component985 = `br`;
    const Component986 = `span`;
    const Component987 = `br`;
    const Component988 = `span`;
    const Component989 = `br`;
    const Component990 = `span`;
    const Component991 = `p`;
    const Component992 = `span`;
    const Component993 = `button`;
    const Component994 = `span`;
    const Component995 = `button`;
    const Component996 = `span`;
    const Component997 = `input`;
    const Component998 = `label`;
    const Component999 = `div`;
    const Component1000 = `div`;
    const Component1001 = `div`;
    const Component1002 = `span`;
    const Component1003 = `h2`;
    const Component1004 = `div`;
    const Component1005 = `label`;
    const Component1006 = `input`;
    const Component1007 = `span`;
    const Component1008 = `div`;
    const Component1009 = `label`;
    const Component1010 = `input`;
    const Component1011 = `span`;
    const Component1012 = `div`;
    const Component1013 = `label`;
    const Component1014 = `input`;
    const Component1015 = `span`;
    const Component1016 = `div`;
    const Component1017 = `div`;
    const Component1018 = `div`;
    const Component1019 = `div`;
    const Component1020 = `span`;
    const Component1021 = `h2`;
    const Component1022 = `div`;
    const Component1023 = `span`;
    const Component1024 = `span`;
    const Component1025 = `div`;
    const Component1026 = `span`;
    const Component1027 = `button`;
    const Component1028 = `div`;
    const Component1029 = `span`;
    const Component1030 = `span`;
    const Component1031 = `div`;
    const Component1032 = `span`;
    const Component1033 = `button`;
    const Component1034 = `div`;
    const Component1035 = `span`;
    const Component1036 = `span`;
    const Component1037 = `div`;
    const Component1038 = `span`;
    const Component1039 = `button`;
    const Component1040 = `div`;
    const Component1041 = `p`;
    const Component1042 = `div`;
    const Component1043 = `div`;
    const Component1044 = `span`;
    const Component1045 = `h2`;
    const Component1046 = `button`;
    const Component1047 = `div`;
    const Component1048 = `button`;
    const Component1049 = `h3`;
    const Component1050 = `p`;
    const Component1051 = `textarea`;
    const Component1052 = `button`;
    const Component1053 = `button`;
    const Component1054 = `div`;
    const Component1055 = `div`;
    const Component1056 = `p`;
    const Component1057 = `label`;
    const Component1058 = `input`;
    const Component1059 = `div`;
    const Component1060 = `label`;
    const Component1061 = `input`;
    const Component1062 = `div`;
    const Component1063 = `label`;
    const Component1064 = `input`;
    const Component1065 = `div`;
    const Component1066 = `label`;
    const Component1067 = `input`;
    const Component1068 = `div`;
    const Component1069 = `label`;
    const Component1070 = `input`;
    const Component1071 = `p`;
    const Component1072 = `div`;
    const Component1073 = `div`;
    const Component1074 = `div`;
    const Component1075 = `div`;
    const Component1076 = `div`;
    const Component1077 = `div`;
    const Component1078 = `div`;
    const Component1079 = `div`;
    const Component1080 = `div`;
    const Component1081 = `div`;
    const Component1082 = `div`;
    const Component1083 = `div`;
    const Component1084 = `h3`;
    const Component1085 = `button`;
    const Component1086 = `div`;
    const Component1087 = `span`;
    const Component1088 = `span`;
    const Component1089 = `p`;
    const Component1090 = `div`;
    const Component1091 = `span`;
    const Component1092 = `span`;
    const Component1093 = `p`;
    const Component1094 = `div`;
    const Component1095 = `div`;
    const Component1096 = `span`;
    const Component1097 = `span`;
    const Component1098 = `br`;
    const Component1099 = `br`;
    const Component1100 = `p`;
    const Component1101 = `div`;
    const Component1102 = `div`;
    const Component1103 = `span`;
    const Component1104 = `span`;
    const Component1105 = `br`;
    const Component1106 = `br`;
    const Component1107 = `p`;
    const Component1108 = `div`;
    const Component1109 = `div`;
    const Component1110 = `span`;
    const Component1111 = `span`;
    const Component1112 = `p`;
    const Component1113 = `div`;
    const Component1114 = `div`;
    const Component1115 = `span`;
    const Component1116 = `span`;
    const Component1117 = `p`;
    const Component1118 = `div`;
    const Component1119 = `div`;
    const Component1120 = `div`;
    const Component1121 = `p`;
    const Component1122 = `div`;
    const Component1123 = `button`;
    const Component1124 = `button`;
    const Component1125 = `div`;
    const Component1126 = `div`;
    const Component1127 = `div`;
    const Component1128 = `button`;
    const Component1129 = `path`;
    const Component1130 = `svg`;
    const Component1131 = `span`;
    const Component1132 = `div`;
    const Component1133 = `p`;
    const Component1134 = `div`;
    const Component1135 = `div`;
    const Component1136 = `div`;
    const Component1137 = `div`;
    const Component1138 = `div`;
    const Component1139 = `div`;
    return <Component1139 className={`flex h-screen bg-[#0d0c0c] flex-col font-sans text-gray-200`}>
        <_cmp_Tr isVisible={rt} onClose={() => {
        ot(false);
        ct(true);
      }} onRetry={() => {
        r.checkConnection();
      }} />
        <Component806 className={`bg-[#0d0c0c] flex items-center justify-between px-4 relative z-20 flex-shrink-0 h-16 pt-2 pb-2`}>
          <Component751 className={`flex items-center gap-6`}>
            <Component725 className={`flex items-center gap-2 cursor-pointer relative group/logo`} onClick={() => {
            return H(`canvas`);
          }} title={`返回画布`}>
              <Component721 viewBox={`0 0 20.7624 28.8621`} xmlns={`http://www.w3.org/2000/svg`} xmlnsXlink={`http://www.w3.org/1999/xlink`} width={`24`} height={`24`} fill={`none`}>
                <Component720 d={`M20.7624 0C0.868225 2.29614 0.393066 20.877 0 28.8621L1.21155 28.8621C1.21155 21.9207 4.94049 21.4546 8.42853 20.6113C13.6559 19.3462 17.0903 14.3184 17.95 10.2493L15.8051 9.17358L16.9758 7.71509C18.1466 6.25684 19.2449 4.14502 20.7624 0L20.7624 0Z`} fill={`rgb(210,2,7)`} fillRule={`evenodd`} />
              </Component721>
              <Component722 className={`text-white font-bold text-lg italic tracking-wider`}>{`猫猫画布`}</Component722>
              <Component724 className={`absolute left-0 top-full mt-2 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl opacity-0 invisible group-hover/logo:opacity-100 group-hover/logo:visible transition-all duration-300 delay-500 z-50 overflow-hidden whitespace-nowrap p-1`}>
                <Component723 onClick={e => {
                e.stopPropagation();
                window.open(Xe(), `_blank`);
              }} className={`text-sm text-gray-300 hover:text-white hover:bg-[#333] px-3 py-2 rounded-md flex items-center gap-2`}>{`访问官网 (1mao.cc)`}</Component723>
              </Component724>
            </Component725>
            <Component729 className={`flex items-center bg-[#151414] rounded-full p-1`}>
              <Component726 onClick={() => {
              return H(`canvas`);
            }} className={`px-5 py-1.5 text-sm font-medium rounded-full transition-colors ${V === `canvas` ? `bg-white text-black` : `text-gray-400 hover:text-gray-200`}`}>{`画布`}</Component726>
              <Component727 onClick={() => {
              return H(`transit`);
            }} className={`px-5 py-1.5 text-sm font-medium rounded-full transition-colors ${V === `transit` ? `bg-white text-black` : `text-gray-400 hover:text-gray-200`}`}>{`资源`}</Component727>
              <Component728 onClick={() => {
              return H(`accounts`);
            }} className={`px-5 py-1.5 text-sm font-medium rounded-full transition-colors ${V === `accounts` ? `bg-white text-black` : `text-gray-400 hover:text-gray-200`}`}>{`多开`}</Component728>
            </Component729>
            {V === `canvas` && <Component750 className={`flex items-center gap-1 group/project-selector relative`}>
                <Component737 className={`relative group/project-dropdown cursor-pointer`}>
                  <Component731 className={`flex items-center gap-1 bg-transparent text-gray-300 text-sm hover:text-white pl-2 pr-2 py-1 outline-none min-w-[100px] pb-1.5 z-10 relative`}>
                    <Component730 className={`truncate max-w-[120px]`}>
                      {X.find(e => {
                    return e.id === Z;
                  })?.name || `选择项目`}
                    </Component730>
                    <_Component16 size={14} className={`text-gray-500 group-hover/project-dropdown:text-white transition-colors`} />
                  </Component731>
                  <Component732 className={`absolute bottom-0 left-2 right-2 h-[2px] bg-white/10 group-hover/project-dropdown:bg-white transition-colors pointer-events-none rounded-full`} />
                  <Component736 className={`absolute left-0 top-full mt-2 w-48 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl opacity-0 invisible group-hover/project-dropdown:opacity-100 group-hover/project-dropdown:visible transition-all duration-200 z-[100] overflow-hidden py-1`}>
                    {X.map(e => {
                  return <Component735 onClick={() => {
                    return Ni(e.id);
                  }} className={`px-3 py-2.5 text-sm cursor-pointer flex items-center gap-2 hover:bg-[#333] transition-colors ${e.id === Z ? `text-white bg-[#222]` : `text-gray-400`}`} key={e.id}>
                          <Component733 className={`w-1.5 h-1.5 rounded-full ${e.id === Z ? `bg-green-500` : `bg-transparent`}`} />
                          <Component734 className={`truncate`}>{e.name}</Component734>
                        </Component735>;
                })}
                  </Component736>
                </Component737>
                <Component741 onClick={() => {
              return Fi(true);
            }} className={`text-gray-400 hover:text-white transition-colors p-1 ml-1`} title={`新建项目`}>
                  <Component740 width={`18`} height={`18`} viewBox={`0 0 24 24`} fill={`none`} stroke={`currentColor`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                    <Component738 x1={`12`} y1={`5`} x2={`12`} y2={`19`} />
                    <Component739 x1={`5`} y1={`12`} x2={`19`} y2={`12`} />
                  </Component740>
                </Component741>
                <Component749 className={`relative group/project-menu -ml-1 z-10`}>
                  <Component742 className={`text-gray-500 hover:text-white transition-colors p-1 flex items-center justify-center`}>
                    <_Component35 size={16} />
                  </Component742>
                  <Component748 className={`absolute left-0 top-full mt-2 w-40 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl opacity-0 invisible group-hover/project-menu:opacity-100 group-hover/project-menu:visible transition-all duration-200 z-[100] overflow-hidden py-1`}>
                    <Component743 onClick={Va} className={`w-full text-left px-3 py-2.5 text-sm text-gray-300 hover:bg-[#333] hover:text-white flex items-center gap-2`}>
                      <_Component21 size={14} />
                      {` 重命名应用`}
                    </Component743>
                    <Component744 onClick={() => {
                  return window.dispatchEvent(new CustomEvent(`import-project`));
                }} className={`w-full text-left px-3 py-2.5 text-sm text-gray-300 hover:bg-[#333] hover:text-white flex items-center gap-2`}>
                      <_Component31 size={14} />
                      {` 导入项目`}
                    </Component744>
                    <Component745 onClick={() => {
                  return window.dispatchEvent(new CustomEvent(`export-project`));
                }} className={`w-full text-left px-3 py-2.5 text-sm text-gray-300 hover:bg-[#333] hover:text-white flex items-center gap-2`}>
                      <_Component5 size={14} />
                      {` 导出项目`}
                    </Component745>
                    {X.length > 1 && <G.Fragment>
                        <Component746 className={`h-[1px] bg-[#333] my-1 mx-2`} />
                        <Component747 onClick={() => {
                    return Ua(Z);
                  }} className={`w-full text-left px-3 py-2.5 text-sm text-red-400 hover:bg-[#333] hover:text-red-300 flex items-center gap-2`}>
                          <F size={14} />
                          {` 删除项目`}
                        </Component747>
                      </G.Fragment>}
                  </Component748>
                </Component749>
              </Component750>}
          </Component751>
          <Component805 className={`flex items-center gap-4`}>
            {q && J && <Component770 className={`relative group/balance flex items-center gap-2 text-[13px] font-medium bg-[#151414] px-3 py-1.5 rounded-full border border-[#333] cursor-pointer`}>
                <Component753 className={`text-white flex items-center gap-1`}>
                  {J.balance.totalBalance.toFixed(2)}
                  {` `}
                  <Component752 className={`text-yellow-500`}>{`⚡`}</Component752>
                </Component753>
                <Component754 className={`text-gray-600`}>{`/`}</Component754>
                <Component757 className={`text-gray-300 flex items-center gap-1`}>
                  {J.proxyBalance.totalBalance.toFixed(2)}
                  <Component756 className={`inline-block w-[1em] h-[1em] align-middle text-yellow-400 ml-0.5`} viewBox={`0 0 1024 1024`} xmlns={`http://www.w3.org/2000/svg`} fill={`currentColor`} aria-hidden={`true`}>
                    <Component755 d={`M836.152889 224.009481a75.851852 75.851852 0 0 1 75.851852 75.851852v116.129186a96.009481 96.009481 0 0 0 0 192v116.167111a75.851852 75.851852 0 0 1-75.851852 75.851851H187.847111a75.851852 75.851852 0 0 1-75.851852-75.851851v-116.167111a96.009481 96.009481 0 0 0 0-191.981038v-116.148148a75.851852 75.851852 0 0 1 75.851852-75.851852h648.305778z m-383.469037 138.733038a24.007111 24.007111 0 0 0-33.943704 33.943703l51.313778 51.313778h-46.061037a24.007111 24.007111 0 1 0 0 47.995259h64v32.009482h-64a24.007111 24.007111 0 1 0 0 47.995259h64v80.004741a24.007111 24.007111 0 1 0 48.014222 0l-0.018963-80.023704 64.018963 0.018963a24.007111 24.007111 0 1 0 0-47.995259h-64.018963v-32.009482h64.018963a24.007111 24.007111 0 1 0 0-47.995259h-46.08l51.332741-51.313778 1.744592-1.953185a24.007111 24.007111 0 0 0-35.688296-31.990518l-56.566518 56.566518-1.744593 1.953185-0.986074 1.365334a24.139852 24.139852 0 0 0-2.768593-3.318519z`} />
                  </Component756>
                </Component757>
                <Component769 className={`absolute right-0 top-full mt-2 w-48 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl opacity-0 invisible group-hover/balance:opacity-100 group-hover/balance:visible transition-all duration-200 z-50 overflow-hidden`}>
                  <Component764 className={`p-3 space-y-2 text-sm text-gray-300 border-b border-[#333]`}>
                    <Component760 className={`flex justify-between items-center`}>
                      <Component758>{`算力余额：`}</Component758>
                      <Component759 className={`font-bold text-white`}>
                        {J.balance.totalBalance.toFixed(2)}
                      </Component759>
                    </Component760>
                    <Component763 className={`flex justify-between items-center`}>
                      <Component761>{`特惠币余额：`}</Component761>
                      <Component762 className={`font-bold text-white`}>
                        {J.proxyBalance.totalBalance.toFixed(2)}
                      </Component762>
                    </Component763>
                  </Component764>
                  <Component765 onClick={() => {
                return window.open(Xe(`/invite`), `_blank`);
              }} className={`w-full py-2 text-sm text-center text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 transition-colors border-b border-[#333]`}>{`邀好友 赚奖励`}</Component765>
                  <Component768 className={`flex bg-[#222]`}>
                    <Component766 onClick={() => {
                  return window.open(Xe(`/console/wallet`), `_blank`);
                }} className={`flex-1 py-2 text-sm font-bold text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors border-r border-[#333]`}>{`充值`}</Component766>
                    <Component767 onClick={() => {
                  return window.open(Xe(`/console/consumption`), `_blank`);
                }} className={`flex-1 py-2 text-sm text-gray-400 hover:text-white hover:bg-[#333] transition-colors`}>{`消费详情`}</Component767>
                  </Component768>
                </Component769>
              </Component770>}
            <Component798 className={`relative group/avatar`}>
              <Component773 type={`button`} onClick={() => {
              if (!q) {
                Wt(true);
              }
            }} className={`relative flex items-center justify-center font-bold transition-all border-2 border-transparent hover:border-gray-500 ${q ? `w-8 h-8 rounded-full text-sm bg-[#333]` : `h-8 px-3 rounded-full text-xs cursor-pointer bg-red-600/90 hover:bg-red-500`}`} title={q ? `用户信息` : `登录`}>
                {q && J ? <Component771 src={J.avatar || Br} alt={`avatar`} className={`w-full h-full rounded-full object-cover`} onError={e => {
                e.currentTarget.src = Br;
              }} /> : <Component772 className={`text-white flex items-center gap-1`}>
                    <_Component10 size={14} />
                    {` 未登录`}
                  </Component772>}
              </Component773>
              {q && J && <Component797 className={`absolute right-0 top-full mt-2 w-64 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl opacity-0 invisible group-hover/avatar:opacity-100 group-hover/avatar:visible transition-all duration-200 z-[100] overflow-hidden flex flex-col`}>
                  <Component778 className={`p-4 border-b border-[#333] flex items-center gap-3`}>
                    <Component774 src={J.avatar || Br} alt={`avatar`} className={`w-10 h-10 rounded-full object-cover border border-[#444]`} onError={e => {
                  e.currentTarget.src = Br;
                }} />
                    <Component777 className={`flex flex-col`}>
                      <Component775 className={`text-white font-bold text-sm truncate`}>
                        {J.nickname || J.username || `一毛用户`}
                      </Component775>
                      <Component776 className={`text-gray-400 text-xs`}>
                        {J.phone || `未绑定手机号`}
                      </Component776>
                    </Component777>
                  </Component778>
                  <Component784 className={`p-2 border-b border-[#333]`}>
                    <Component779 className={`px-2 py-1 text-xs text-gray-500 font-bold`}>{`会员信息`}</Component779>
                    <Component782 className={`flex justify-between items-center px-2 py-1.5 text-sm text-gray-300`}>
                      <Component780 className={`flex items-center gap-1.5`}>
                        <_Component36 size={14} className={`text-yellow-500`} />
                        {_i.type}
                        {` 会员`}
                      </Component780>
                      {_i.type !== `FREE` && _i.expiry && <Component781 className={`text-xs text-gray-500`}>
                          {new Date(_i.expiry).toLocaleDateString()}
                          {` 到期`}
                        </Component781>}
                    </Component782>
                    <Component783 onClick={() => {
                  return window.open(Xe(`/pricing`), `_blank`);
                }} className={`mt-2 w-full bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-white font-bold py-1.5 rounded-lg text-sm transition-all shadow-lg`}>{`开通 / 续费`}</Component783>
                  </Component784>
                  <Component788 className={`p-2 border-b border-[#333]`}>
                    <Component785 className={`px-2 py-1 text-xs text-gray-500 font-bold`}>{`同步设置`}</Component785>
                    <Component786 onClick={ba} disabled={va} className={`w-full text-left px-2 py-2 text-sm text-gray-300 hover:bg-[#333] hover:text-white rounded-md flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}>
                      {va ? <_Component26 size={14} className={`animate-spin`} /> : <_Component31 size={14} />}
                      {` 上传云端`}
                    </Component786>
                    <Component787 onClick={xa} disabled={va} className={`w-full text-left px-2 py-2 text-sm text-gray-300 hover:bg-[#333] hover:text-white rounded-md flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}>
                      {va ? <_Component26 size={14} className={`animate-spin`} /> : <_Component5 size={14} />}
                      {` 从云端下载`}
                    </Component787>
                  </Component788>
                  <Component790 className={`p-2 border-b border-[#333]`}>
                    <Component789 onClick={() => {
                  return Kt(true);
                }} className={`w-full text-left px-2 py-2 text-sm text-gray-300 hover:bg-[#333] hover:text-white rounded-md flex items-center gap-2 transition-colors`}>
                      <_Component1 size={14} />
                      {` 修改密码`}
                    </Component789>
                  </Component790>
                  <Component796 className={`p-2`}>
                    <Component795 onClick={_a} className={`w-full text-left px-2 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-md flex items-center gap-2 transition-colors`}>
                      <Component794 width={`14`} height={`14`} viewBox={`0 0 24 24`} fill={`none`} stroke={`currentColor`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                        <Component791 d={`M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4`} />
                        <Component792 points={`16 17 21 12 16 7`} />
                        <Component793 x1={`21`} y1={`12`} x2={`9`} y2={`12`} />
                      </Component794>
                      {`退出登录`}
                    </Component795>
                  </Component796>
                </Component797>}
            </Component798>
            <Component799 onClick={() => {
            return H(`settings`);
          }} className={`relative text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-[#252525] ${V === `settings` ? `bg-[#252525] text-white` : ``}`} title={`设置`}>
              <_Component37 size={20} />
            </Component799>
            <Component804 onClick={() => {
            return x(!y);
          }} className={`relative text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-[#252525]`} title={`任务中心`}>
              <Component802 width={`20`} height={`20`} viewBox={`0 0 24 24`} fill={`none`} stroke={`currentColor`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                <Component800 cx={`12`} cy={`12`} r={`10`} />
                <Component801 points={`12 6 12 12 16 14`} />
              </Component802>
              {u.filter(e => {
              return e.status === `running` || e.status === `pending`;
            }).length > 0 && <Component803 className={`absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0d0c0c] animate-pulse`} />}
            </Component804>
          </Component805>
        </Component806>
        <_cmp_Ln open={y} globalTasks={u} useThumbnail={Xr} onClose={() => {
        return x(false);
      }} onRefreshTask={qa} onRerunTask={Ja} onFullscreen={({
        url: e,
        type: t
      }) => {
        return P({
          url: e,
          type: t
        });
      }} setGlobalTasks={d} showToastMessage={$} />
        {Ki && <_cmp_Qn open={Ki} projectId={Z} projectName={X.find(e => {
        return e.id === Z;
      })?.name || `默认项目`} existingAppId={Wi?.appId} onClose={() => {
        return qi(false);
      }} onPublished={() => {
        qi(false);
        Qi();
      }} />}
        {Ji && <_cmp__Component11 open={Ji} onClose={() => {
        return Yi(false);
      }} defaultAppId={Wi?.appId} />}
        {Xi && <_cmp_$n open={Xi} app={Wi} onClose={() => {
        return Zi(false);
      }} />}
        {M && <Component817 className={`fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-8 cursor-zoom-out animate-fade-in`} onClick={() => {
        return P(null);
      }}>
            {M.type === `video` ? <Component807 src={M.url} className={`max-w-full max-h-full object-contain shadow-2xl rounded-lg`} controls={true} autoPlay={true} onClick={e => {
          return e.stopPropagation();
        }} /> : M.type === `text` ? <Component808 className={`w-[80vw] h-[80vh] bg-[#1a1a1a] rounded-lg shadow-2xl border border-[#333] p-8 overflow-y-auto text-gray-200 whitespace-pre-wrap font-sans text-sm leading-relaxed`} onClick={e => {
          return e.stopPropagation();
        }}>
                <_cmp__Component38 url={M.url} />
              </Component808> : M.type === `audio` ? <Component814 className={`bg-gradient-to-b from-[#1d2230] to-[#0e0f12] rounded-xl shadow-2xl border border-[#333] p-8 flex flex-col items-center gap-4`} onClick={e => {
          return e.stopPropagation();
        }}>
                <Component812 width={`48`} height={`48`} viewBox={`0 0 24 24`} fill={`none`} stroke={`#60a5fa`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                  <Component809 d={`M9 18V5l12-2v13`} />
                  <Component810 cx={`6`} cy={`18`} r={`3`} />
                  <Component811 cx={`18`} cy={`16`} r={`3`} />
                </Component812>
                <Component813 src={M.url} controls={true} autoPlay={true} className={`w-[420px] max-w-[80vw]`} />
              </Component814> : <Component815 src={M.url} className={`max-w-full max-h-full object-contain shadow-2xl rounded-lg`} onClick={e => {
          return e.stopPropagation();
        }} />}
            <Component816 className={`absolute top-4 right-4 text-white/50 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-colors`} onClick={() => {
          return P(null);
        }}>
              <N size={24} />
            </Component816>
          </Component817>}
        <_cmp_Zt controller={sa} />
        <Component1082 className={`flex-1 relative overflow-hidden bg-[#0d0c0c]`}>
          <Component856 className={`absolute inset-0 flex flex-col ${V === `accounts` ? `visible z-10` : `invisible -z-10`}`}>
            {un && <Component828 className={`p-3 bg-[#151414] border-b border-[#333] shadow-sm`}>
                <Component827 className={`bg-[#252525] p-3 rounded-lg border border-[#333] animate-fade-in`}>
                  <Component820 className={`flex justify-between items-center mb-2`}>
                    <Component818 className={`text-sm font-bold text-gray-200`}>
                      {mn ? `修改环境` : `手动添加环境`}
                    </Component818>
                    <Component819 onClick={() => {
                  dn(false);
                  hn(null);
                  pn(``);
                  _n(``);
                }} className={`text-gray-500 hover:text-gray-300`}>{`✕`}</Component819>
                  </Component820>
                  <Component823 className={`flex gap-2`}>
                    <Component821 className={`flex-1 bg-[#1a1a1a] border border-[#333] rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500`} placeholder={`输入环境名称 (如:即梦小号)`} value={fn} onChange={e => {
                  return pn(e.target.value);
                }} autoFocus={true} onKeyDown={e => {
                  return e.key === `Enter` && Sa();
                }} />
                    <Component822 onClick={() => {
                  return Sa(false);
                }} disabled={vn} className={`bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-500 disabled:opacity-50 whitespace-nowrap`}>
                      {vn ? `保存中...` : `保存`}
                    </Component822>
                  </Component823>
                  <Component825 className={`mt-2`}>
                    <Component824 className={`w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-1.5 text-[10px] text-gray-300 focus:outline-none focus:border-blue-500 h-16 resize-none font-mono nowheel nopan`} placeholder={`[可选] 手动粘贴 Cookie (JSON 或 key=value; 格式)`} value={gn} onChange={e => {
                  return _n(e.target.value);
                }} />
                  </Component825>
                  <Component826 className={`text-[10px] text-gray-500 mt-2`}>{`* 默认自动抓取当前标签页 Cookie。若填写上方 Cookie 则优先使用。`}</Component826>
                </Component827>
              </Component828>}
            <Component855 className={`flex-1 overflow-y-auto p-4 relative`}>
              <Component830 className={`flex justify-between items-center mb-4`}>
                <Component829 href={`https://www.bilibili.com/video/BV1nWdbBREXv/?share_source=copy_web&vd_source=cebaf375056cef0735636bdd79543af1`} target={`_blank`} rel={`noreferrer`} className={`text-xs text-gray-500 hover:text-gray-300 underline flex items-center gap-1 transition-colors bg-[#222] px-3 py-1.5 rounded-full hover:bg-[#333]`}>{`📺 如何一个网站登录多个账号？(视频教程)`}</Component829>
              </Component830>
              <Component854 className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4`}>
                <Component834 className={`relative bg-blue-900/10 rounded-xl border-[3px] border-blue-500 border-dashed transition-all cursor-pointer hover:bg-blue-900/20 hover:border-blue-400 flex flex-col items-center justify-center p-3 h-32 group`} onClick={() => {
                return Sa(true);
              }} title={`保存当前环境`}>
                  <Component832 className={`relative mb-3 flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 group-hover:scale-110 transition-transform group-hover:bg-blue-500 group-hover:text-white`}>
                    <Component831 className={`text-3xl font-light`}>{`+`}</Component831>
                  </Component832>
                  <Component833 className={`font-bold text-blue-400 group-hover:text-blue-300 truncate text-sm w-full text-center px-2 transition-colors`}>{`保存当前环境`}</Component833>
                </Component834>
                {rn.map((e, t) => {
                return <Component853 draggable={true} onDragStart={e => {
                  return Da(e, t);
                }} onDragEnd={Oa} onDragOver={e => {
                  return ka(e, t);
                }} onDrop={e => {
                  return Aa(e, t);
                }} className={`relative bg-[#151414] rounded-xl border transition-all cursor-grab active:cursor-grabbing group hover:bg-[#252525] flex flex-col items-center justify-center p-3 h-32
                    ${on?.id === e.id ? `border-blue-500 shadow-blue-500/10 shadow-md ring-1 ring-blue-500/50 bg-blue-900/10` : `border-[#333] hover:border-gray-500`}
                    ${Ta === t ? `border-dashed border-[3px] border-blue-400 opacity-80 scale-105 z-10` : ``}
                  `} onClick={() => {
                  return ga(e);
                }} title={e.siteName} key={e.id}>
                      <Component835 src={e.avatar} className={`w-12 h-12 rounded-full bg-[#0d0c0c] object-contain p-0.5 border border-[#333] mb-3 pointer-events-none`} draggable={`false`} onError={t => {
                    t.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${e.name}`;
                  }} />
                      <Component836 className={`font-bold text-gray-200 truncate text-sm w-full text-center px-2`}>
                        {e.name}
                      </Component836>
                      {on?.id === e.id && <Component838 className={`absolute top-0 left-0 w-0 h-0 border-t-[32px] border-r-[32px] border-t-blue-500 border-r-transparent rounded-tl-xl z-10`}>
                          <Component837 className={`absolute -top-[28px] left-[6px] text-[12px] text-white font-bold`}>{`√`}</Component837>
                        </Component838>}
                      <Component852 className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20`}>
                        <Component851 className={`relative group/menu`}>
                          <Component843 className={`text-gray-400 hover:text-white p-1 rounded hover:bg-[#333]`} onClick={e => {
                        return e.stopPropagation();
                      }}>
                            <Component842 width={`18`} height={`18`} viewBox={`0 0 24 24`} fill={`none`} stroke={`currentColor`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                              <Component839 cx={`12`} cy={`12`} r={`1`} />
                              <Component840 cx={`12`} cy={`5`} r={`1`} />
                              <Component841 cx={`12`} cy={`19`} r={`1`} />
                            </Component842>
                          </Component843>
                          <Component850 className={`absolute right-0 top-full pt-1 hidden group-hover/menu:block z-50`}>
                            <Component849 className={`bg-[#252525] border border-[#333] rounded-md shadow-xl py-1 w-24`}>
                              <Component844 className={`w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-[#333] hover:text-white`} onClick={t => {
                            t.stopPropagation();
                            dn(true);
                            hn(e.id);
                            pn(e.name);
                            _n(JSON.stringify(e.cookies));
                          }}>{`修改`}</Component844>
                              <Component845 className={`w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-[#333] hover:text-white`} onClick={t => {
                            t.stopPropagation();
                            let n = JSON.stringify(e.cookies);
                            navigator.clipboard.writeText(n);
                            $(`Cookie已复制`);
                          }}>{`复制 Cookie`}</Component845>
                              <Component846 className={`w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-[#333] hover:text-red-300`} onClick={t => {
                            t.stopPropagation();
                            ha(e, true);
                          }}>{`清除全部 Cookies`}</Component846>
                              <Component847 className={`border-t border-[#333] my-1`} />
                              <Component848 className={`w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-[#333] hover:text-red-300`} onClick={t => {
                            return Na(e.id, t);
                          }}>
                                {ja === e.id ? `确认删除?` : `删除`}
                              </Component848>
                            </Component849>
                          </Component850>
                        </Component851>
                      </Component852>
                    </Component853>;
              })}
              </Component854>
            </Component855>
          </Component856>
          <_Component39 active={V === `transit`} transitItems={Pe} transitResources={L} transitTotal={Le} transitTotalPages={Be} transitLoading={Ge} transitPage={Oe} setTransitPage={ke} transitGridCols={Te} setTransitGridCols={Ee} transitTabFilter={pe} setTransitTabFilter={me} transitFilter={oe} setTransitFilter={le} transitSourceFilter={he} setTransitSourceFilter={_e} currentFolder={ve} setCurrentFolder={ye} creatingFolder={xe} setCreatingFolder={Se} newFolderName={Ce} setNewFolderName={we} localTool={r} showToastMessage={$} handleSyncLocal={Xa} handleToggleFavorite={Pa} handleClearResources={Fa} handleDeleteResource={za} handleSendToActiveTab={La} handleCopyResource={Ra} setFullscreenResource={P} openResourceMenu={ee} setOpenResourceMenu={I} />
          <Component882 className={`absolute inset-0 w-full h-full bg-[#0d0c0c] flex flex-col ${V === `canvas` ? `visible z-10` : `invisible -z-10`}`}>
            <Component867 className={`flex-1 relative`}>
              <Component857 className={`absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-[#0d0c0c] to-transparent z-10 pointer-events-none`} />
              <Ye projectId={Z} textApiUrl={Mn} textApiKey={Pn} imageApiUrl={zn} imageApiKey={Vn} videoApiUrl={Gn} videoApiKey={qn} builtinApiUrl={On} builtinApiKey={An} sd2VideoApiUrl={tr} sd2VideoApiKey={rr} discountVideoApiUrl={cr} discountVideoApiKey={ur} aiAppApiUrl={mr} aiAppApiKey={gr} audioApiUrl={vr} audioApiKey={br} textModel={Vr} drawingModel={Hr} videoModel={Yn} sd2VideoModel={or} discountVideoModel={Ur} videoDurations={Zn} audioModel={Cr} showToast={$} transitResources={L} addTransitResource={Ia} presetPrompts={Q} membership={_i} globalTasks={u} updateGlobalTasks={Ka} onSendToActiveTab={La} customNodeTemplates={ni} onAddCustomNodeTemplate={Wa} onDeleteCustomNodeTemplate={Ga} globalPollingInterval={Wr} globalMaxPollingDuration={Kr} globalSyncTimeout={Jr} setShowTaskList={x} cloudStorageConfig={f} sd2Token={g} useThumbnail={Xr} panPerformanceMode={Qr} enablePerformanceMode={ei} onTogglePerformanceMode={() => {
              return ti(e => {
                return !e;
              });
            }} isLoggedIn={q} localToolBaseUrl={i} agentCanvasRef={Ht} agentPanelOpen={false} agentPanelWidth={Mt} key={Z} />
              {false}
              <_cmp__Component40 agentKey={`canvas-assistant`} projectId={Z} canvasHandleRef={Ht} open={Ot} onClose={() => {
              return jt(false);
            }} onGoMembership={() => {
              H(`settings`);
              Dt(`membership`);
            }} onWidthChange={Nt} onEnabledChange={Bt} />
              {!Ot && <Component866 className={`absolute bottom-6 right-6 z-50 flex items-center gap-2`}>
                  <Component865 className={`flex items-center gap-1.5 rounded-full bg-[#151414] border border-[#333] px-3 py-1.5 text-xs font-medium text-gray-200 shadow-lg transition-colors hover:bg-[#202020] hover:border-blue-500/40 cursor-pointer`} title={`AI 画布助手`} onClick={() => jt(true)}>
                    <Component860 width={`14`} height={`14`} viewBox={`0 0 24 24`} fill={`none`} stroke={`#8b5cf6`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`}><Component859 points={`12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2`} /></Component860>
                    <Component864 className={`leading-none`}>{`AI 助手`}</Component864>
                  </Component865>
                  <Component858 className={`text-[10px] font-medium text-white/15 tabular-nums select-none leading-none`} title={`当前版本`}>
                    {`v`}
                    {Vt()}
                  </Component858>
                  <Component865 className={`flex items-center gap-2 rounded-full bg-[#151414] border shadow-lg transition-all ${r.status.isConnected ? `justify-center w-8 h-8 border-[#333]` : `px-3 py-1.5 border-red-500/30 bg-red-950/20`}`} title={r.status.isConnected ? `本地引擎已连接` : `本地引擎未启动`}>
                    {r.status.isConnected ? <Component860 width={`16`} height={`16`} viewBox={`0 0 24 24`} fill={`none`} stroke={`#10b981`} strokeWidth={`3`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                        <Component859 points={`20 6 9 17 4 12`} />
                      </Component860> : <G.Fragment>
                        <Component863 width={`14`} height={`14`} viewBox={`0 0 24 24`} fill={`none`} stroke={`#ef4444`} strokeWidth={`3`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                          <Component861 x1={`18`} y1={`6`} x2={`6`} y2={`18`} />
                          <Component862 x1={`6`} y1={`6`} x2={`18`} y2={`18`} />
                        </Component863>
                        <Component864 className={`text-xs font-medium text-red-400 animate-pulse`}>{`本地引擎未启动`}</Component864>
                      </G.Fragment>}
                  </Component865>
                </Component866>}
            </Component867>
            {Pi && <Component874 className={`absolute inset-0 bg-black/50 flex items-center justify-center z-50`}>
                <Component873 className={`bg-[#2a2a2a] p-4 rounded-lg border border-[#333] w-64`}>
                  <Component868 className={`text-gray-200 text-sm font-bold mb-3`}>{`新建项目`}</Component868>
                  <Component869 className={`w-full bg-[#151414] border border-[#333] rounded p-2 text-gray-200 text-xs mb-3 focus:outline-none focus:border-blue-500`} placeholder={`项目名称`} value={Ii} onChange={e => {
                return Li(e.target.value);
              }} autoFocus={true} />
                  <Component872 className={`flex justify-end gap-2`}>
                    <Component870 onClick={() => {
                  return Fi(false);
                }} className={`text-gray-400 hover:text-white text-xs px-2 py-1`}>{`取消`}</Component870>
                    <Component871 onClick={Ba} className={`bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-500`}>{`创建`}</Component871>
                  </Component872>
                </Component873>
              </Component874>}
            {Ri && <Component881 className={`absolute inset-0 bg-black/50 flex items-center justify-center z-50`}>
                <Component880 className={`bg-[#2a2a2a] p-4 rounded-lg border border-[#333] w-64`}>
                  <Component875 className={`text-gray-200 text-sm font-bold mb-3`}>{`重命名应用`}</Component875>
                  <Component876 className={`w-full bg-[#151414] border border-[#333] rounded p-2 text-gray-200 text-xs mb-3 focus:outline-none focus:border-blue-500`} placeholder={`应用名称`} value={Bi} onChange={e => {
                return Vi(e.target.value);
              }} onKeyDown={e => {
                if (e.key === `Enter`) {
                  Ha();
                }
                if (e.key === `Escape`) {
                  zi(false);
                  Vi(``);
                }
              }} autoFocus={true} />
                  <Component879 className={`flex justify-end gap-2`}>
                    <Component877 onClick={() => {
                  zi(false);
                  Vi(``);
                }} className={`text-gray-400 hover:text-white text-xs px-2 py-1`}>{`取消`}</Component877>
                    <Component878 onClick={Ha} className={`bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-500`}>{`保存`}</Component878>
                  </Component879>
                </Component880>
              </Component881>}
          </Component882>
          <Component883 className={`absolute inset-0 ${V === `appcenter` ? `visible z-10` : `invisible -z-10`}`}>
            {Hi ? <_cmp__Component41 app={Hi} onBack={() => {
            return Ui(null);
          }} canvasProps={{
            textApiUrl: Mn,
            textApiKey: Pn,
            imageApiUrl: zn,
            imageApiKey: Vn,
            videoApiUrl: Gn,
            videoApiKey: qn,
            builtinApiUrl: On,
            builtinApiKey: An,
            sd2VideoApiUrl: tr,
            sd2VideoApiKey: rr,
            discountVideoApiUrl: cr,
            discountVideoApiKey: ur,
            aiAppApiUrl: mr,
            aiAppApiKey: gr,
            audioApiUrl: vr,
            audioApiKey: br,
            textModel: Vr,
            drawingModel: Hr,
            videoModel: Yn,
            sd2VideoModel: or,
            discountVideoModel: Ur,
            videoDurations: Zn,
            audioModel: Cr,
            showToast: $,
            transitResources: L,
            addTransitResource: Ia,
            presetPrompts: Q,
            membership: _i,
            globalTasks: u,
            updateGlobalTasks: Ka,
            onSendToActiveTab: La,
            customNodeTemplates: ni,
            onAddCustomNodeTemplate: Wa,
            onDeleteCustomNodeTemplate: Ga,
            globalPollingInterval: Wr,
            globalMaxPollingDuration: Kr,
            globalSyncTimeout: Jr,
            setShowTaskList: x,
            cloudStorageConfig: f,
            sd2Token: g,
            useThumbnail: Xr,
            panPerformanceMode: Qr,
            isLoggedIn: q
          }} /> : <_cmp__Component42 active={V === `appcenter`} onRun={Ui} />}
          </Component883>
          <Component1081 className={`absolute inset-0 flex bg-[#0d0c0c] overflow-hidden ${V === `settings` ? `visible z-10` : `invisible -z-10`}`}>
            <Component890 className={`w-48 bg-[#0d0c0c] border-r-0 flex flex-col p-3 z-10 flex-shrink-0`}>
              <Component884 className={`text-[10px] text-gray-500 font-bold px-3 py-2 mb-1 uppercase tracking-wider`}>{`设置`}</Component884>
              <Component885 onClick={() => {
              return Dt(`builtin`);
            }} className={`text-left px-3 py-2.5 rounded-lg text-sm transition-colors mb-1.5 flex items-center gap-2 ${U === `builtin` ? `bg-[#252525] text-blue-500 font-bold border border-[#333] shadow-sm` : `text-gray-300 hover:bg-[#222] hover:text-gray-100 border border-transparent`}`}>
                <_Component33 size={16} />
                {` 内置模型`}
              </Component885>
              <Component886 onClick={() => {
              return Dt(`models`);
            }} className={`text-left px-3 py-2.5 rounded-lg text-sm transition-colors mb-1.5 flex items-center gap-2 ${U === `models` ? `bg-[#252525] text-blue-500 font-bold border border-[#333] shadow-sm` : `text-gray-300 hover:bg-[#222] hover:text-gray-100 border border-transparent`}`}>
                <_Component25 size={16} />
                {` 第三方API配置`}
              </Component886>
              <Component887 onClick={() => {
              return Dt(`basic`);
            }} className={`text-left px-3 py-2.5 rounded-lg text-sm transition-colors mb-1.5 flex items-center gap-2 ${U === `basic` ? `bg-[#252525] text-blue-500 font-bold border border-[#333] shadow-sm` : `text-gray-300 hover:bg-[#222] hover:text-gray-100 border border-transparent`}`}>
                <_Component37 size={16} />
                {` 预设提示词`}
              </Component887>
              <Component888 onClick={() => {
              return Dt(`data`);
            }} className={`text-left px-3 py-2.5 rounded-lg text-sm transition-colors mb-1.5 flex items-center gap-2 ${U === `data` ? `bg-[#252525] text-blue-500 font-bold border border-[#333] shadow-sm` : `text-gray-300 hover:bg-[#222] hover:text-gray-100 border border-transparent`}`}>
                <T size={16} />
                {` 数据管理`}
              </Component888>
              <_cmp_Xt active={U === `upgrade`} controller={sa} onClick={() => {
              return Dt(`upgrade`);
            }} />
              <Component889 onClick={() => {
              return Dt(`endpoint`);
            }} className={`text-left px-3 py-2.5 rounded-lg text-sm transition-colors mb-1.5 flex items-center gap-2 ${U === `endpoint` ? `bg-[#252525] text-blue-500 font-bold border border-[#333] shadow-sm` : `text-gray-300 hover:bg-[#222] hover:text-gray-100 border border-transparent`}`}>
                <_Component6 size={16} />
                {` 后端接入点`}
              </Component889>
            </Component890>
            <Component1079 className={`flex-1 overflow-y-auto p-6 relative pb-24 custom-scrollbar bg-[#0d0c0c] nowheel nopan nodrag`}>
              <Component1078 className={`max-w-4xl mx-auto flex flex-col gap-6`}>
                {U === `basic` && <Component913 className={`space-y-6 animate-fade-in`}>
                    <Component912 className={`group bg-[#1a1a1a] rounded-xl overflow-hidden transition-all duration-300 pb-4 shadow-sm border border-[#222]`}>
                      <Component895 className={`flex justify-between items-center p-4 border-b border-[#222]`}>
                        <Component893 className={`font-bold text-gray-200 text-sm flex items-center gap-2`}>
                          <Component891 className={`text-yellow-500`}>{`✨`}</Component891>
                          {` 预设提示词`}
                          <Component892 className={`text-xs text-gray-500 font-normal ml-2 bg-[#222] px-2 py-0.5 rounded-full`}>
                            {`(`}
                            {Q.length}
                            {`/`}
                            {ji.presets}
                            {`)`}
                          </Component892>
                        </Component893>
                        <Component894 onClick={Qa} className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${Q.length >= ji.presets ? `bg-[#222] text-gray-600 cursor-not-allowed` : `bg-[#222] text-gray-300 hover:bg-[#2a2a2a] hover:text-blue-400`}`} disabled={Q.length >= ji.presets} title={Q.length >= ji.presets ? `达到上限` : `添加预设`}>{`+ 添加新预设`}</Component894>
                      </Component895>
                      <Component911 className={`px-4 pt-4`}>
                        <Component910 className={`space-y-3 custom-scrollbar`}>
                          {Q.map((e, t) => {
                        return <Component908 className={`flex gap-3 items-start bg-[#0d0c0c] p-3 rounded-lg border border-[#333] hover:border-[#444] transition-colors group/preset`} key={t}>
                                <Component897 className={`flex flex-col gap-2 pt-1.5`}>
                                  <Component896 type={`checkbox`} checked={e.enabled !== false} onChange={e => {
                              return Za(t, `enabled`, e.target.checked);
                            }} className={`cursor-pointer accent-blue-500 w-4 h-4`} title={`启用/禁用`} />
                                </Component897>
                                <Component906 className={`flex-1 space-y-2`}>
                                  <Component904 className={`flex gap-2`}>
                                    <Component898 className={`w-full text-xs bg-[#1a1a1a] border border-[#333] rounded px-3 py-1.5 text-gray-300 focus:border-blue-500 outline-none transition-all`} placeholder={`标题`} value={e.title} onChange={e => {
                                return Za(t, `title`, e.target.value);
                              }} />
                                    <Component903 className={`text-xs bg-[#1a1a1a] border border-[#333] rounded px-2 py-1.5 text-gray-300 focus:border-blue-500 outline-none transition-all w-24`} value={e.type || `all`} onChange={e => {
                                return Za(t, `type`, e.target.value);
                              }}>
                                      <Component899 value={`all`}>{`通用`}</Component899>
                                      <Component900 value={`text`}>{`文本`}</Component900>
                                      <Component901 value={`image`}>{`生图`}</Component901>
                                      <Component902 value={`video`}>{`视频`}</Component902>
                                    </Component903>
                                  </Component904>
                                  <Component905 className={`w-full text-xs bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 resize-none h-16 text-gray-400 focus:border-blue-500 outline-none transition-all nowheel nopan`} placeholder={`提示词内容`} value={e.prompt} onChange={e => {
                              return Za(t, `prompt`, e.target.value);
                            }} />
                                </Component906>
                                <Component907 onClick={() => {
                            return $a(t);
                          }} className={`text-gray-600 hover:text-red-500 p-1.5 hover:bg-[#222] rounded-lg transition-colors opacity-0 group-hover/preset:opacity-100`}>
                                  <F size={14} />
                                </Component907>
                              </Component908>;
                      })}
                          {Q.length >= ji.presets && _i.type !== `VIP` && <Component909 className={`text-xs text-center text-gray-500 mt-4 bg-[#222] p-2 rounded-lg`}>{`已达当前版本预设上限，请升级会员`}</Component909>}
                        </Component910>
                      </Component911>
                    </Component912>
                  </Component913>}
                {U === `builtin` && <_cmp__Component43 />}
                {U === `models` && <Component980 className={`space-y-6 animate-fade-in`}>
                    <Component932 className={`group bg-[#1a1a1a] rounded-xl overflow-hidden transition-all duration-300 pb-4 shadow-sm border border-[#222]`}>
                      <Component918 className={`flex justify-between items-center p-4 select-none border-b border-[#222]`}>
                        <Component916 className={`font-bold text-gray-200 text-sm flex items-center gap-2`}>
                          <Component914 className={`text-yellow-500`}>{`⚙️`}</Component914>
                          {` 第三方 API 配置`}
                          <Component915 href={`https://test-cyfyd24zfbua.feishu.cn/wiki/CCkewnbsQiQZlMkfQSbctRI5nUh?from=from_copylink`} target={`_blank`} rel={`noopener noreferrer`} className={`ml-1 inline-flex items-center gap-1 text-xs font-normal text-blue-400 hover:text-blue-300 transition-colors`}>
                            {`查看配置教程`}
                            <_Component32 size={11} />
                          </Component915>
                        </Component916>
                        <Component917 onClick={async () => {
                      try {
                        let e = await Ei();
                        if (e) {
                          O(e);
                          E(true);
                        }
                      } catch (e) {
                        console.error(`获取默认配置失败:`, e);
                        K.error(`获取默认配置失败，请重试`);
                      }
                    }} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg transition-colors`}>
                          <_Component3 size={12} />
                          {`恢复默认`}
                        </Component917>
                      </Component918>
                      <Component931 className={`px-4 space-y-3 pt-4`}>
                        {Y.filter(e => {
                      return !e.readonly;
                    }).length === 0 && <Component919 className={`text-center text-xs text-gray-500 py-4 bg-[#1a1a1a] border border-dashed border-[#333] rounded-lg`}>{`暂无自定义 API 配置，点击下方按钮添加`}</Component919>}
                        {Y.filter(e => {
                      return !e.readonly;
                    }).map(e => {
                      let t = Y.findIndex(t => {
                        return t.id === e.id;
                      });
                      const Component920 = `input`;
                      const Component921 = `div`;
                      const Component922 = `input`;
                      const Component923 = `div`;
                      const Component924 = `input`;
                      const Component925 = `button`;
                      const Component926 = `div`;
                      const Component927 = `div`;
                      const Component928 = `button`;
                      const Component929 = `div`;
                      return <Component929 className={`flex items-center gap-3 bg-[#222] rounded-lg p-2 relative group/item border border-transparent hover:border-[#333] transition-colors`} key={e.id}>
                              <Component921 className={`w-1/4`}>
                                <Component920 className={`w-full bg-transparent border-b border-[#444] px-1 py-1.5 text-xs focus:border-blue-500 outline-none placeholder-gray-600 transition-colors text-gray-200`} placeholder={`配置名称 (例: API Studio)`} value={e.name} onChange={e => {
                            let n = [...Y];
                            n[t].name = e.target.value;
                            ii(n);
                          }} />
                              </Component921>
                              <Component923 className={`w-1/3`}>
                                <Component922 className={`w-full bg-transparent border-b border-[#444] px-1 py-1.5 text-xs focus:border-blue-500 outline-none placeholder-gray-600 transition-colors text-gray-200`} placeholder={`Base URL`} value={e.url} onChange={e => {
                            let n = [...Y];
                            n[t].url = e.target.value;
                            ii(n);
                          }} />
                              </Component923>
                              <Component927 className={`flex-1 relative`}>
                                <Component926 className={`relative flex items-center`}>
                                  <Component924 className={`w-full bg-transparent border-b border-[#444] px-1 py-1.5 pr-8 text-xs text-gray-200 focus:border-blue-500 outline-none placeholder-gray-600 transition-colors`} placeholder={`密钥 (sk-...)`} type={e.showKey ? `text` : `password`} value={e.key} onChange={e => {
                              let n = [...Y];
                              n[t].key = e.target.value;
                              ii(n);
                            }} />
                                  <Component925 type={`button`} onClick={() => {
                              let e = [...Y];
                              e[t].showKey = !e[t].showKey;
                              ii(e);
                            }} className={`absolute right-0 text-gray-500 hover:text-gray-300 p-1`}>
                                    {e.showKey ? <_Component44 size={14} /> : <_Component45 size={14} />}
                                  </Component925>
                                </Component926>
                              </Component927>
                              <Component928 onClick={() => {
                          ii(Y.filter(t => {
                            return t.id !== e.id;
                          }));
                        }} className={`text-gray-600 hover:text-red-500 p-1 opacity-0 group-hover/item:opacity-100 transition-opacity`} title={`删除配置`}>
                                <F size={14} />
                              </Component928>
                            </Component929>;
                    })}
                        <Component930 onClick={() => {
                      ii([...Y, {
                        id: Date.now().toString(),
                        name: ``,
                        url: ``,
                        key: ``,
                        showKey: false,
                        readonly: false
                      }]);
                    }} className={`w-full py-2 bg-[#222] text-gray-400 rounded-lg hover:bg-[#2a2a2a] hover:text-gray-200 transition-colors text-xs font-medium`}>{`+ 添加统一配置`}</Component930>
                      </Component931>
                    </Component932>
                    <Component942 className={`group bg-[#1a1a1a] rounded-xl overflow-hidden transition-all duration-300 pb-4 shadow-sm border border-[#222]`}>
                      <Component938 className={`flex justify-between items-center p-4 border-b border-[#222]`}>
                        <Component934 className={`font-bold text-gray-200 text-sm flex items-center gap-2`}>
                          <Component933 className={`text-blue-500`}>{`📝`}</Component933>
                          {` 文本大模型`}
                        </Component934>
                        <Component937 className={`flex items-center gap-2`}>
                          <Component936 className={`bg-[#222] border border-[#333] text-gray-300 text-xs px-3 py-1.5 rounded-lg outline-none focus:border-blue-500 hover:bg-[#2a2a2a] transition-colors`} onChange={e => {
                        return oi(e.target.value);
                      }} value={ai}>
                            {Y.filter(e => {
                          return !e.readonly;
                        }).map(e => {
                          return <Component935 value={e.id} key={e.id}>
                                  {e.name || e.url}
                                </Component935>;
                        })}
                          </Component936>
                        </Component937>
                      </Component938>
                      <Component941 className={`px-4 pt-4`}>
                        <Component939 className={`block text-xs font-medium text-gray-500 mb-2`}>{`模型名称 (支持多个，换行分隔)`}</Component939>
                        <Component940 value={In} onChange={e => {
                      return Rn(e.target.value);
                    }} className={`w-full bg-[#0d0c0c] border border-[#333] rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition-all min-h-[80px] resize-y`} placeholder={`gpt-3.5-turbo
gpt-4o`} />
                      </Component941>
                    </Component942>
                    <Component952 className={`group bg-[#1a1a1a] rounded-xl overflow-hidden transition-all duration-300 pb-4 shadow-sm border border-[#222]`}>
                      <Component948 className={`flex justify-between items-center p-4 border-b border-[#222]`}>
                        <Component944 className={`font-bold text-gray-200 text-sm flex items-center gap-2`}>
                          <Component943 className={`text-pink-500`}>{`🎨`}</Component943>
                          {` 图像大模型`}
                        </Component944>
                        <Component947 className={`flex items-center gap-2`}>
                          <Component946 className={`bg-[#222] border border-[#333] text-gray-300 text-xs px-3 py-1.5 rounded-lg outline-none focus:border-blue-500 hover:bg-[#2a2a2a] transition-colors`} onChange={e => {
                        return ci(e.target.value);
                      }} value={si}>
                            {Y.filter(e => {
                          return !e.readonly;
                        }).map(e => {
                          return <Component945 value={e.id} key={e.id}>
                                  {e.name || e.url}
                                </Component945>;
                        })}
                          </Component946>
                        </Component947>
                      </Component948>
                      <Component951 className={`px-4 pt-4`}>
                        <Component949 className={`block text-xs font-medium text-gray-500 mb-2`}>{`模型名称 (支持多个，换行分隔)`}</Component949>
                        <Component950 value={Un} onChange={e => {
                      return Wn(e.target.value);
                    }} className={`w-full bg-[#0d0c0c] border border-[#333] rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition-all min-h-[80px] resize-y`} placeholder={`gemini-3.1-flash-image-preview
dall-e-3`} />
                      </Component951>
                    </Component952>
                    <Component969 className={`group bg-[#1a1a1a] rounded-xl overflow-hidden transition-all duration-300 pb-4 shadow-sm border border-[#222]`}>
                      <Component955 className={`flex justify-between items-center p-4 border-b border-[#222]`}>
                        <Component954 className={`font-bold text-gray-200 text-sm flex items-center gap-2`}>
                          <Component953 className={`text-purple-500`}>{`🎬`}</Component953>
                          {` 视频配置`}
                        </Component954>
                      </Component955>
                      <Component968 className={`px-4 pt-4 space-y-6`}>
                        <Component963 className={`space-y-2`}>
                          <Component960 className={`flex justify-between items-center`}>
                            <Component957 className={`text-xs font-bold text-gray-300 flex items-center gap-2`}>
                              <Component956 className={`text-purple-500`}>{`🎬`}</Component956>
                              {` 视频大模型`}
                            </Component957>
                            <Component959 className={`bg-[#222] border border-[#333] text-gray-300 text-xs px-3 py-1.5 rounded-lg outline-none focus:border-blue-500 hover:bg-[#2a2a2a] transition-colors`} onChange={e => {
                          return ui(e.target.value);
                        }} value={li}>
                              {Y.filter(e => {
                            return !e.readonly;
                          }).map(e => {
                            return <Component958 value={e.id} key={e.id}>
                                    {e.name || e.url}
                                  </Component958>;
                          })}
                            </Component959>
                          </Component960>
                          <Component962>
                            <Component961 value={Yn} onChange={e => {
                          return Xn(e.target.value);
                        }} className={`w-full bg-[#0d0c0c] border border-[#333] rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition-all min-h-[60px] resize-y`} placeholder={`grok-video-3-pro
sora`} />
                          </Component962>
                        </Component963>
                        <Component964 className={`h-px bg-[#333] w-full`} />
                        <Component967 className={`pt-2`}>
                          <Component965 className={`block text-xs font-medium text-gray-500 mb-2`}>{`通用可选时长 (秒数，换行分隔)`}</Component965>
                          <Component966 value={Zn} onChange={e => {
                        return er(e.target.value);
                      }} className={`w-full bg-[#0d0c0c] border border-[#333] rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition-all min-h-[80px] resize-y`} placeholder={`10
15`} />
                        </Component967>
                      </Component968>
                    </Component969>
                    <Component979 className={`group bg-[#1a1a1a] rounded-xl overflow-hidden transition-all duration-300 pb-4 shadow-sm border border-[#222]`}>
                      <Component975 className={`flex justify-between items-center p-4 border-b border-[#222]`}>
                        <Component971 className={`font-bold text-gray-200 text-sm flex items-center gap-2`}>
                          <Component970 className={`text-green-500`}>{`🎙️`}</Component970>
                          {` 听音断句 API`}
                        </Component971>
                        <Component974 className={`flex items-center gap-2`}>
                          <Component973 className={`bg-[#222] border border-[#333] text-gray-300 text-xs px-3 py-1.5 rounded-lg outline-none focus:border-blue-500 hover:bg-[#2a2a2a] transition-colors`} onChange={e => {
                        return gi(e.target.value);
                      }} value={hi}>
                            {Y.filter(e => {
                          return !e.readonly;
                        }).map(e => {
                          return <Component972 value={e.id} key={e.id}>
                                  {e.name || e.url}
                                </Component972>;
                        })}
                          </Component973>
                        </Component974>
                      </Component975>
                      <Component978 className={`px-4 pt-4`}>
                        <Component976 className={`block text-xs font-medium text-gray-500 mb-2`}>{`模型名称`}</Component976>
                        <Component977 value={Cr} onChange={e => {
                      return wr(e.target.value);
                    }} className={`w-full bg-[#0d0c0c] border border-[#333] rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition-all min-h-[80px] resize-y`} placeholder={`whisper-1`} />
                      </Component978>
                    </Component979>
                  </Component980>}
                {U === `data` && <Component1076 className={`space-y-6 animate-fade-in`}>
                    <Component1001 className={`group bg-[#1a1a1a] rounded-xl overflow-hidden transition-all duration-300 pb-4 shadow-sm border border-[#222]`}>
                      <Component983 className={`flex justify-between items-center p-4 border-b border-[#222]`}>
                        <Component982 className={`font-bold text-gray-200 text-sm flex items-center gap-2`}>
                          <Component981 className={`text-orange-500`}>{`📦`}</Component981>
                          {` 数据管理`}
                        </Component982>
                      </Component983>
                      <Component1000 className={`px-4 pt-4 pb-2`}>
                        <Component991 className={`text-xs text-gray-400 leading-relaxed mb-4`}>
                          {`通过导出功能，您可以将当前的`}
                          <Component984 className={`text-gray-200`}>{`全局配置、账号环境、API 密钥以及所有的画布项目内容（节点连线）`}</Component984>
                          {`完整打包下载为一个极小体积的 JSON 文件（KB 级别）。您可以将该备份文件用于：`}
                          <Component985 />
                          <Component986 className={`text-blue-400 mt-1 inline-block`}>{`• 异地设备的数据无缝同步`}</Component986>
                          <Component987 />
                          <Component988 className={`text-green-400`}>{`• 与团队同事分享您的优质工作流`}</Component988>
                          <Component989 />
                          <Component990 className={`text-purple-400`}>{`• 本地日常配置备份防丢失`}</Component990>
                        </Component991>
                        <Component999 className={`flex gap-4`}>
                          {r.status.isConnected && <Component993 onClick={e => {
                        e.preventDefault();
                        eo();
                      }} className={`flex-1 flex items-center justify-center gap-2 text-sm bg-emerald-900/30 text-emerald-400 border border-emerald-500/30 py-2.5 rounded-lg hover:bg-emerald-900/50 hover:text-emerald-300 transition-all`}>
                              <_Component4 size={16} />
                              <Component992 className={`font-bold`}>{`一键同步到本地引擎`}</Component992>
                            </Component993>}
                          <Component995 onClick={e => {
                        e.preventDefault();
                        to();
                      }} className={`flex-1 flex items-center justify-center gap-2 text-sm bg-[#222] text-gray-300 border border-[#333] py-2.5 rounded-lg hover:bg-[#2a2a2a] hover:text-white hover:border-gray-500 transition-all`}>
                            <_Component5 size={16} className={`text-orange-400`} />
                            <Component994 className={`font-bold`}>{`导出所有内容 (JSON)`}</Component994>
                          </Component995>
                          <Component998 className={`flex-1 flex items-center justify-center gap-2 text-sm bg-[#222] text-gray-300 border border-[#333] py-2.5 rounded-lg hover:bg-[#2a2a2a] hover:text-white hover:border-gray-500 transition-all text-center cursor-pointer`}>
                            <_Component31 size={16} className={`text-blue-400`} />
                            <Component996 className={`font-bold`}>{`导入所有内容 (JSON)`}</Component996>
                            <Component997 type={`file`} accept={`.json`} className={`hidden`} onChange={no} />
                          </Component998>
                        </Component999>
                      </Component1000>
                    </Component1001>
                    <Component1019 className={`group bg-[#1a1a1a] rounded-xl overflow-hidden transition-all duration-300 pb-4 shadow-sm border border-[#222]`}>
                      <Component1004 className={`flex justify-between items-center p-4 border-b border-[#222]`}>
                        <Component1003 className={`font-bold text-gray-200 text-sm flex items-center gap-2`}>
                          <Component1002 className={`text-blue-400`}>{`⏱️`}</Component1002>
                          {` 全局任务与超时设置`}
                        </Component1003>
                      </Component1004>
                      <Component1018 className={`px-4 pt-4 pb-2`}>
                        <Component1017 className={`grid grid-cols-3 gap-4`}>
                          <Component1008>
                            <Component1005 className={`block text-[11px] font-medium text-gray-500 mb-1.5`}>{`轮询间隔 (秒)`}</Component1005>
                            <Component1006 type={`number`} value={Wr} onChange={e => {
                          return Gr(parseInt(e.target.value) || 3);
                        }} className={`w-full bg-[#0d0c0c] border border-[#333] rounded px-3 py-2 text-xs text-gray-400 focus:outline-none focus:border-gray-500 transition-all`} placeholder={`3`} />
                            <Component1007 className={`text-[9px] text-gray-500 mt-1 inline-block`}>{`默认: 3s`}</Component1007>
                          </Component1008>
                          <Component1012>
                            <Component1009 className={`block text-[11px] font-medium text-gray-500 mb-1.5`}>{`最大轮询时间 (秒)`}</Component1009>
                            <Component1010 type={`number`} value={Kr} onChange={e => {
                          return qr(parseInt(e.target.value) || 600);
                        }} className={`w-full bg-[#0d0c0c] border border-[#333] rounded px-3 py-2 text-xs text-gray-400 focus:outline-none focus:border-gray-500 transition-all`} placeholder={`600`} />
                            <Component1011 className={`text-[9px] text-gray-500 mt-1 inline-block`}>{`默认: 600s`}</Component1011>
                          </Component1012>
                          <Component1016>
                            <Component1013 className={`block text-[11px] font-medium text-gray-500 mb-1.5`}>{`同步任务超时 (秒)`}</Component1013>
                            <Component1014 type={`number`} value={Jr} onChange={e => {
                          return Yr(parseInt(e.target.value) || 600);
                        }} className={`w-full bg-[#0d0c0c] border border-[#333] rounded px-3 py-2 text-xs text-gray-400 focus:outline-none focus:border-gray-500 transition-all`} placeholder={`600`} />
                            <Component1015 className={`text-[9px] text-gray-500 mt-1 inline-block`}>{`默认: 600s`}</Component1015>
                          </Component1016>
                        </Component1017>
                      </Component1018>
                    </Component1019>
                    <Component1043 className={`group bg-[#1a1a1a] rounded-xl overflow-hidden transition-all duration-300 pb-4 shadow-sm border border-[#222]`}>
                      <Component1022 className={`flex justify-between items-center p-4 border-b border-[#222]`}>
                        <Component1021 className={`font-bold text-gray-200 text-sm flex items-center gap-2`}>
                          <Component1020 className={`text-blue-400`}>
                            <_Component46 size={16} />
                          </Component1020>
                          {` 图片缩略图`}
                        </Component1021>
                      </Component1022>
                      <Component1042 className={`px-4 pt-4 pb-2`}>
                        <Component1028 className={`flex items-center justify-between mb-3`}>
                          <Component1025 className={`flex flex-col`}>
                            <Component1023 className={`text-xs text-gray-300 font-medium`}>{`启用缩略图`}</Component1023>
                            <Component1024 className={`text-[10px] text-gray-500 mt-0.5`}>{`开启后可以提升页面的响应速度`}</Component1024>
                          </Component1025>
                          <Component1027 onClick={() => {
                        return Zr(!Xr);
                      }} className={`relative w-10 h-5 rounded-full transition-colors ${Xr ? `bg-blue-500` : `bg-gray-600`}`}>
                            <Component1026 className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${Xr ? `translate-x-5` : `translate-x-0`}`} />
                          </Component1027>
                        </Component1028>
                        <Component1034 className={`flex items-center justify-between mb-3 pt-3 border-t border-[#222]`}>
                          <Component1031 className={`flex flex-col`}>
                            <Component1029 className={`text-xs text-gray-300 font-medium`}>{`拖动画布性能模式`}</Component1029>
                            <Component1030 className={`text-[10px] text-gray-500 mt-0.5`}>{`开启后拖动画布时会临时隐藏媒体/控件，大画布更流畅`}</Component1030>
                          </Component1031>
                          <Component1033 onClick={() => {
                        return $r(!Qr);
                      }} className={`relative w-10 h-5 rounded-full transition-colors ${Qr ? `bg-blue-500` : `bg-gray-600`}`}>
                            <Component1032 className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${Qr ? `translate-x-5` : `translate-x-0`}`} />
                          </Component1033>
                        </Component1034>
                        <Component1040 className={`flex items-center justify-between mb-3 pt-3 border-t border-[#222]`}>
                          <Component1037 className={`flex flex-col`}>
                            <Component1035 className={`text-xs text-gray-300 font-medium`}>{`缩放性能模式`}</Component1035>
                            <Component1036 className={`text-[10px] text-gray-500 mt-0.5`}>{`缩小画布时自动隐藏图片视频，提升渲染性能`}</Component1036>
                          </Component1037>
                          <Component1039 onClick={() => {
                        return ti(!ei);
                      }} className={`relative w-10 h-5 rounded-full transition-colors ${ei ? `bg-blue-500` : `bg-gray-600`}`}>
                            <Component1038 className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${ei ? `translate-x-5` : `translate-x-0`}`} />
                          </Component1039>
                        </Component1040>
                        <Component1041 className={`text-[10px] text-gray-500 leading-relaxed`}>{`开启后，画布上的图片节点和任务清单中的图片将使用缩略图显示，可显著减少内存占用并提升页面流畅度。关闭后将直接显示原图。`}</Component1041>
                      </Component1042>
                    </Component1043>
                    <Component1075 className={`group bg-[#1a1a1a] rounded-xl overflow-hidden transition-all duration-300 pb-4 shadow-sm border border-[#222]`}>
                      <Component1047 className={`flex justify-between items-center p-4 border-b border-[#222]`}>
                        <Component1045 className={`font-bold text-gray-200 text-sm flex items-center gap-2`}>
                          <Component1044 className={`text-cyan-400`}>
                            <_Component4 size={16} />
                          </Component1044>
                          {` 七牛云 S3 对象存储配置`}
                        </Component1045>
                        <Component1046 onClick={() => {
                      return ra(true);
                    }} className={`px-2 py-1 text-[10px] bg-[#333] hover:bg-[#444] text-gray-300 rounded transition-colors border border-[#444]`} title={`从 JSON 文本一键导入配置`}>{`JSON 导入`}</Component1046>
                      </Component1047>
                      <Component1074 className={`px-4 pt-4 pb-2`}>
                        {na && <Component1055 className={`bg-[#0d0c0c] border border-[#444] rounded-lg p-4 mb-4 animate-fade-in relative`}>
                            <Component1048 onClick={() => {
                        ra(false);
                        oa(ia);
                      }} className={`absolute top-2 right-2 text-gray-500 hover:text-white`}>
                              <R size={16} />
                            </Component1048>
                            <Component1049 className={`text-xs font-bold text-gray-300 mb-2`}>{`粘贴 JSON 配置`}</Component1049>
                            <Component1050 className={`text-[10px] text-gray-500 mb-2`}>{`包含 accessKey, secretKey, bucket, endpoint, domain 任意字段即可。`}</Component1050>
                            <Component1051 value={aa} onChange={e => {
                        return oa(e.target.value);
                      }} className={`w-full h-24 bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-cyan-500 font-mono mb-3`} placeholder={`{
  "accessKey": "...",
  "secretKey": "...",
  "bucket": "...",
  "endpoint": "..."
}`} />
                            <Component1054 className={`flex justify-end gap-2`}>
                              <Component1052 onClick={() => {
                          ra(false);
                          oa(ia);
                        }} className={`px-3 py-1.5 text-xs bg-[#222] hover:bg-[#333] text-gray-300 rounded transition-colors`}>{`取消`}</Component1052>
                              <Component1053 onClick={() => {
                          try {
                            if (!aa.trim()) {
                              $(`JSON 文本不能为空`);
                              return;
                            }
                            let e = JSON.parse(aa);
                            if (e.accessKey || e.secretKey || e.bucket || e.endpoint || e.domain) {
                              p({
                                accessKey: e.accessKey || f.accessKey,
                                secretKey: e.secretKey || f.secretKey,
                                bucket: e.bucket || f.bucket,
                                endpoint: e.endpoint || f.endpoint,
                                domain: e.domain || f.domain
                              });
                              ra(false);
                              oa(``);
                              $(`JSON 导入成功，请记得点击保存`);
                            } else {
                              $(`无效的 JSON 格式或缺少必要字段`);
                            }
                          } catch {
                            $(`JSON 解析失败，请检查格式`);
                          }
                        }} className={`px-3 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors`}>{`确认导入`}</Component1053>
                            </Component1054>
                          </Component1055>}
                        <Component1056 className={`text-[11px] text-gray-400 mb-4`}>{`配置后可以使用画布中的【文件转链接】节点，将图片/视频等持久化存储到您的七牛云 Bucket。`}</Component1056>
                        <Component1073 className={`grid grid-cols-2 gap-4`}>
                          <Component1059>
                            <Component1057 className={`block text-[11px] font-medium text-gray-400 mb-1.5`}>{`Access Key (AK)`}</Component1057>
                            <Component1058 type={`password`} value={f.accessKey} onChange={e => {
                          return p({
                            ...f,
                            accessKey: e.target.value
                          });
                        }} className={`w-full bg-[#0d0c0c] border border-[#333] rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500 transition-colors`} placeholder={`例如：6LOdM9TU2SLPgR0DB...`} />
                          </Component1059>
                          <Component1062>
                            <Component1060 className={`block text-[11px] font-medium text-gray-400 mb-1.5`}>{`Secret Key (SK)`}</Component1060>
                            <Component1061 type={`password`} value={f.secretKey} onChange={e => {
                          return p({
                            ...f,
                            secretKey: e.target.value
                          });
                        }} className={`w-full bg-[#0d0c0c] border border-[#333] rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500 transition-colors`} placeholder={`例如：i8dfozxy0q5IPuuIOAM...`} />
                          </Component1062>
                          <Component1065>
                            <Component1063 className={`block text-[11px] font-medium text-gray-400 mb-1.5`}>{`Bucket 名称`}</Component1063>
                            <Component1064 type={`text`} value={f.bucket} onChange={e => {
                          return p({
                            ...f,
                            bucket: e.target.value
                          });
                        }} className={`w-full bg-[#0d0c0c] border border-[#333] rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500 transition-colors`} placeholder={`例如：yimaoai`} />
                          </Component1065>
                          <Component1068>
                            <Component1066 className={`block text-[11px] font-medium text-gray-400 mb-1.5`}>{`S3 Endpoint`}</Component1066>
                            <Component1067 type={`text`} value={f.endpoint} onChange={e => {
                          return p({
                            ...f,
                            endpoint: e.target.value
                          });
                        }} className={`w-full bg-[#0d0c0c] border border-[#333] rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500 transition-colors`} placeholder={`例如：s3.cn-south-1.qiniucs.com`} />
                          </Component1068>
                          <Component1072 className={`col-span-2`}>
                            <Component1069 className={`block text-[11px] font-medium text-gray-400 mb-1.5`}>{`外网访问域名 (可选)`}</Component1069>
                            <Component1070 type={`text`} value={f.domain} onChange={e => {
                          return p({
                            ...f,
                            domain: e.target.value
                          });
                        }} className={`w-full bg-[#0d0c0c] border border-[#333] rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500 transition-colors`} placeholder={`例如：http://tdfc98zdu.hn-bkt.clouddn.com`} />
                            <Component1071 className={`text-[9px] text-gray-500 mt-1`}>{`留空则自动使用 Endpoint 拼接`}</Component1071>
                          </Component1072>
                        </Component1073>
                      </Component1074>
                    </Component1075>
                  </Component1076>}
                {false}
                {U === `upgrade` && <_cmp_Qt controller={sa} localToolStatus={r.status} />}
                {U === `endpoint` && <Component1077 className={`animate-fade-in`}>
                    <_cmp_$t onSaved={$} />
                  </Component1077>}
                {false}
              </Component1078>
            </Component1079>
            <Component1080 className={`absolute bottom-0 left-48 right-0 p-4 bg-gradient-to-t from-[#0d0c0c] via-[#0d0c0c] to-transparent z-20 flex justify-center pointer-events-none`} />
          </Component1081>
        </Component1082>
        {Sn && <Component1083 className={`absolute top-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white px-4 py-2 rounded-full text-sm z-50 animate-fade-in pointer-events-none`}>
            {Tn}
          </Component1083>}
        {w && D && <Component1127 className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center animate-fade-in`}>
            <Component1126 className={`bg-[#1a1a1a] rounded-xl border border-[#333] shadow-2xl max-w-md w-full mx-4 overflow-hidden`}>
              <Component1086 className={`px-6 py-4 border-b border-[#333] flex items-center justify-between`}>
                <Component1084 className={`text-lg font-bold text-gray-200 flex items-center gap-2`}>
                  <_Component3 size={18} className={`text-blue-400`} />
                  {`恢复默认配置`}
                </Component1084>
                <Component1085 onClick={() => {
              E(false);
              O(null);
            }} className={`text-gray-400 hover:text-gray-200 transition-colors`}>
                  <R size={18} />
                </Component1085>
              </Component1086>
              <Component1122 className={`p-6 space-y-4`}>
                <Component1090 className={`bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4`}>
                  <Component1089 className={`text-yellow-200 text-sm flex items-start gap-2`}>
                    <Component1087 className={`text-yellow-400 mt-0.5`}>{`⚠️`}</Component1087>
                    <Component1088>{`恢复默认配置将覆盖以下本地设置，请确认：`}</Component1088>
                  </Component1089>
                </Component1090>
                <Component1120 className={`bg-[#222] rounded-lg p-4 space-y-2 text-sm text-gray-300 max-h-60 overflow-y-auto`}>
                  <Component1095 className={`flex items-start gap-2`}>
                    <Component1091 className={`text-blue-400`}>{`•`}</Component1091>
                    <Component1094>
                      <Component1092 className={`font-medium text-gray-200`}>{`API 配置`}</Component1092>
                      <Component1093 className={`text-xs text-gray-500 mt-0.5`}>
                        {`将重置为 `}
                        {D.apiConfigs?.length || 0}
                        {` 个默认配置项`}
                      </Component1093>
                    </Component1094>
                  </Component1095>
                  <Component1102 className={`flex items-start gap-2`}>
                    <Component1096 className={`text-blue-400`}>{`•`}</Component1096>
                    <Component1101>
                      <Component1097 className={`font-medium text-gray-200`}>{`模型配置`}</Component1097>
                      <Component1100 className={`text-xs text-gray-500 mt-0.5`}>
                        {`文本模型: `}
                        {D.textModel?.split(`
`)[0] || `默认`}
                        <Component1098 />
                        {`绘图模型: `}
                        {D.drawingModel?.split(`
`)[0] || `默认`}
                        <Component1099 />
                        {`视频模型: `}
                        {D.videoModel?.split(`
`)[0] || `默认`}
                      </Component1100>
                    </Component1101>
                  </Component1102>
                  <Component1109 className={`flex items-start gap-2`}>
                    <Component1103 className={`text-blue-400`}>{`•`}</Component1103>
                    <Component1108>
                      <Component1104 className={`font-medium text-gray-200`}>{`任务配置`}</Component1104>
                      <Component1107 className={`text-xs text-gray-500 mt-0.5`}>
                        {`轮询间隔: `}
                        {D.globalPollingInterval}
                        {`s`}
                        <Component1105 />
                        {`最大轮询时长: `}
                        {D.globalMaxPollingDuration}
                        {`s`}
                        <Component1106 />
                        {`同步超时: `}
                        {D.globalSyncTimeout}
                        {`s`}
                      </Component1107>
                    </Component1108>
                  </Component1109>
                  <Component1114 className={`flex items-start gap-2`}>
                    <Component1110 className={`text-blue-400`}>{`•`}</Component1110>
                    <Component1113>
                      <Component1111 className={`font-medium text-gray-200`}>{`预设提示词`}</Component1111>
                      <Component1112 className={`text-xs text-gray-500 mt-0.5`}>
                        {D.presetPrompts?.length || 0}
                        {` 个预设模板`}
                      </Component1112>
                    </Component1113>
                  </Component1114>
                  <Component1119 className={`flex items-start gap-2`}>
                    <Component1115 className={`text-blue-400`}>{`•`}</Component1115>
                    <Component1118>
                      <Component1116 className={`font-medium text-gray-200`}>{`云存储配置`}</Component1116>
                      <Component1117 className={`text-xs text-gray-500 mt-0.5`}>{`将清空所有云存储凭证信息`}</Component1117>
                    </Component1118>
                  </Component1119>
                </Component1120>
                <Component1121 className={`text-xs text-gray-500 text-center`}>{`此操作不可撤销，确定要继续吗？`}</Component1121>
              </Component1122>
              <Component1125 className={`px-6 py-4 bg-[#161616] border-t border-[#333] flex justify-end gap-3`}>
                <Component1123 onClick={() => {
              E(false);
              O(null);
            }} className={`px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#333] rounded-lg transition-colors`}>{`取消`}</Component1123>
                <Component1124 onClick={async () => {
              try {
                wi(D);
                E(false);
                O(null);
                K.success(`配置已恢复为默认设置`);
              } catch (e) {
                console.error(`恢复默认配置失败:`, e);
                K.error(`恢复配置失败，请重试`);
                E(false);
              }
            }} className={`px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors flex items-center gap-2`}>
                  <_Component3 size={14} />
                  {`确认恢复`}
                </Component1124>
              </Component1125>
            </Component1126>
          </Component1127>}
        {Ut && <Component1138 className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4`}>
            <Component1137 className={`bg-[#151414] rounded-3xl w-full max-w-[420px] shadow-2xl overflow-hidden relative`}>
              <Component1128 type={`button`} onClick={() => {
            return Wt(false);
          }} className={`absolute top-4 right-4 z-10 text-gray-400 hover:text-white transition-all duration-300 hover:rotate-90 p-1.5 rounded-full hover:bg-white/10 bg-black/10 backdrop-blur-md`} aria-label={`关闭登录弹窗`}>
                <R size={18} />
              </Component1128>
              <Component1135 className={`w-full pt-10 pb-2 flex flex-col items-center justify-center bg-[#151414]`}>
                <Component1134 className={`flex flex-col items-center gap-2`}>
                  <Component1132 className={`flex items-center gap-2`}>
                    <Component1130 viewBox={`0 0 20.7624 28.8621`} xmlns={`http://www.w3.org/2000/svg`} xmlnsXlink={`http://www.w3.org/1999/xlink`} width={`28`} height={`28`} fill={`none`}>
                      <Component1129 d={`M20.7624 0C0.868225 2.29614 0.393066 20.877 0 28.8621L1.21155 28.8621C1.21155 21.9207 4.94049 21.4546 8.42853 20.6113C13.6559 19.3462 17.0903 14.3184 17.95 10.2493L15.8051 9.17358L16.9758 7.71509C18.1466 6.25684 19.2449 4.14502 20.7624 0L20.7624 0Z`} fill={`rgb(210,2,7)`} fillRule={`evenodd`} />
                    </Component1130>
                    <Component1131 className={`text-2xl font-black tracking-wider text-white italic`}>{`猫猫画布`}</Component1131>
                  </Component1132>
                  <Component1133 className={`text-sm text-gray-400 font-medium tracking-widest mt-1`}>{`省钱就用猫猫画布`}</Component1133>
                </Component1134>
              </Component1135>
              <Component1136 className={`px-8 pb-10 pt-2 bg-[#151414]`}>
                <_cmp_It onLoginSuccess={e => {
              ln(e);
              Ne(e => {
                return e + 1;
              });
              Wt(false);
            }} />
              </Component1136>
            </Component1137>
          </Component1138>}
        <_cmp__Component47 open={Gt} hasPassword={J?.hasPassword} onClose={() => {
        return Kt(false);
      }} onSuccess={() => {
        Jt(e => {
          return e && {
            ...e,
            hasPassword: true
          };
        });
      }} />
        <_cmp_Lt toasts={e} onRemove={t} />
      </Component1139>;
  }
}