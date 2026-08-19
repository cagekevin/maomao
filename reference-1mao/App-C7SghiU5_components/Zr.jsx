// TODO(全局, 无需 import): toasts, removeToast, i, localToolBaseUrl, accessKey, secretKey, bucket, endpoint, domain, u, w, t, eqOrPrefix, se, page, pageSize, sortBy, sortDir, filters, z, n, userId, username, phone, nickname, avatar, membershipType, balance, modelApiTokenKey, membershipExpiryDate, hasUnlimitedMembership, hasPassword, team, ai, key, url, type, expiry, code, xi, Si, ma, id, Li, Ri, ia, d, status, completed, total, ii, showKey, p, si, li, di, pi, _i, Qr, ei, ni, vi, X, oi, ci, ui, fi, gi, mi, yi, bi, o, hi, s, c, l, skipAuth, Di, Ai, Oi, ki, usage, quota, percentage, Ni, Mi, Pi, accounts, presets, name, Xi, encodeURIComponent, Z, ra, title, prompt, enabled, la, wn, Yi, $, onToast, openUpgradeSettings, pa, ha, ga, j, Ei, active, currentWindow, favIconUrl, folder, source, ct, success, error, Ii, Q, ri, f, defaultTextModel, defaultDrawingModel, defaultVideoModel, defaultAudioModel, defaultSd2VideoModel, textApiConfigId, imageApiConfigId, videoApiConfigId, sd2VideoApiConfigId, audioApiConfigId, videoDurations, globalPollingInterval, globalMaxPollingDuration, globalSyncTimeout, transitGridCols, sd2Token, useThumbnail, panPerformanceMode, $r, enablePerformanceMode, ti, taskId, patch, errorMsg, completedEvent, nodeId, resultUrl, headers, Authorization, Accept, notFoundCount, progress, responseData, customRawResponse, detail, _taskSnapshot, mediaMeta, alert, storeId, value, ya, va, Sa, wa, data, hn, path, secure, confirm, httpOnly, expirationDate, sameSite, cookies, siteName, siteUrl, _a, mn, gn, fn, ka, ja, Aa, Oa, Ia, La, isFavorite, eo, Va, timestamp, pageUrl, pageTitle, tabId, func, Uint8Array, bubbles, args, Vi, Hi, Bi, Ki, Wi, Gi, handleRefreshTask, isLoaded, globalTasks, handleUpdateGlobalTasks, Za, showToastMessage, localPort, localToolConnected, sd2VideoApiUrl, sd2VideoApiKey, videoApiUrl, videoApiKey, discountVideoApiUrl, discountVideoApiKey, aiAppApiUrl, aiAppApiKey, task, thumbnailUrl, customResultData, customOutputType, to, localforage, kvStore, importData, so, exportData, oo, Ka, Ja, Ta, Ca, Ea, y, x, Qa, $a, Zi, Qi, $i, ea, ta, na, fa, Da, Ma, Na, Pa, Fa, xa, ba, Ra, de, za, Ba, Wa, Ha, Ua, te, Ya, Xa, zi, Ga, Ui, qa, qi, Ji, textApiUrl, textApiKey, imageApiUrl, imageApiKey, builtinApiUrl, builtinApiKey, audioApiUrl, audioApiKey, textModel, drawingModel, videoModel, sd2VideoModel, discountVideoModel, audioModel, showToast, transitResources, addTransitResource, presetPrompts, membership, updateGlobalTasks, onSendToActiveTab, customNodeTemplates, onAddCustomNodeTemplate, onDeleteCustomNodeTemplate, setShowTaskList, cloudStorageConfig, isLoggedIn, Fi, ro, no, io, readonly, ao, ca, sa, da, ua
import _cmp_Fr from "./Fr.jsx";
import _cmp_Hn from "./Hn.jsx";
import _cmp__Component35 from "./_Component35.jsx";
import _cmp__Component11 from "./_Component11.jsx";
import _cmp__Component36 from "./_Component36.jsx";
import _cmp_Yr from "./Yr.jsx";
import _cmp_Qt from "./Qt.jsx";
import _cmp__Component38 from "./_Component38.jsx";
import _cmp__Component39 from "./_Component39.jsx";
import _cmp__Component40 from "./_Component40.jsx";
import _cmp_Zt from "./Zt.jsx";
import _cmp_Tn from "./Tn.jsx";
import _cmp_$t from "./$t.jsx";
import _cmp__Component43 from "./_Component43.jsx";
import _cmp_Lt from "./Lt.jsx";
import _cmp__Component44 from "./_Component44.jsx";
import _cmp_Rt from "./Rt.jsx";
import _cmp_Nr from "./Nr.jsx";
import _cmp_Ln from "./Ln.jsx";
import _cmp_In from "./In.jsx";
import _cmp_Mr from "./Mr.jsx";
import _cmp_Pr from "./Pr.jsx";
import _cmp__n from "./_n.jsx";
import _cmp_It from "./It.jsx";
import _cmp_yn from "./yn.jsx";
import { zt, Ze, me, At, Ne, gt, dt, ft, k, fe, _e, he, rt, zr, Me, yt, Be, He, Qe, ke, Wr, H, hr, Vt, xt, ot, Oe, Jr, Yt, Jt, Tt, je, ht, nt, Ye, Ue, B, V, on, qr, jt, Br, Ee, Kr, Xe, pt, Gr, bt, Ge, st, vt, Le, Ir, Rr, Rn, Gn, Zn, ar, $n, wr, _, C, at, Ke, _t, un, On, Ae, De, Dr, Tr, we, Er, Wn, fr, Re, Pn, Bn, Un, qn, Yn, tr, rr, sr, dr, gr, vr, br, Sr, An, Mn, pr, L, J, Dn, Xt, U, Ot, Y, Sn, pe, an, Xn, Cr, ir, Qn, Lr, Te, g, Ct, or, ur, wt, it, qe, tt, M, N, q, ln, $e, Se, Ie, pn, xn, bn, vn, sn, Vr, Ur, Hr, Ft, er, nr, Kn, Jn, mr, _r, Dt, St, Pe, S, ut, mt, lt, Gt, Xr, qt, dn, ze, Ve, We, et, ge, ve, ye, be, xe, Ce, F, Nn, Fn, zn, Vn, kn, jn, yr, xr, Or, kr, Ar, Ut, Nt, Mt, Pt, Ht, W, O, E, Cn, En, T, D, Wt, Fe, Kt, _Component17, _Component32, _Component21, P, _Component10, _Component33, _Component25, _Component29, _Component6, _Component1, _Component34, _Component37, Et, Je, _Component31, I, _Component7, _Component30, _Component4, _Component41, A, _Component5, _Component42, R } from "./shared.js";
import * as _shared from "./shared.js";
import * as G from "react";
import * as K from "react";
export default function Zr() {
  let {
    toasts: e,
    removeToast: t
  } = zt();
  let r = Ze();
  let i = G.useMemo(() => {
    if (r.status.isConnected) {
      return me();
    } else {
      return undefined;
    }
  }, [r.status.isConnected, r.status.port]);
  let a = At();
  G.useEffect(() => {
    window.localTool = r;
  }, [r]);
  G.useEffect(() => {
    if (typeof chrome < `u` && chrome.storage?.local && i) {
      chrome.storage.local.set({
        localToolBaseUrl: i
      }).catch(() => {});
    }
  }, [i]);
  let [u, d] = G.useState([]);
  let [f, p] = G.useState({
    accessKey: ``,
    secretKey: ``,
    bucket: ``,
    endpoint: ``,
    domain: ``
  });
  let [g, _] = G.useState(``);
  let [y, x] = G.useState(false);
  let [S, C] = G.useState(true);
  let w = G.useMemo(() => {
    return u.some(e => {
      if (e.status !== `running` && e.status !== `pending`) {
        return false;
      } else {
        return e.type === `text` || e.type === `image` || e.type === `custom` && (e.customOutputType === `text` || e.customOutputType === `image`);
      }
    });
  }, [u]);
  G.useEffect(() => {
    let e = `还有文字/图片在生成，现在关闭会中断任务，可能白跑一趟，确定要关吗？`;
    let t = t => {
      if (w) {
        t.preventDefault();
        t.returnValue = e;
        return e;
      }
    };
    window.addEventListener(`beforeunload`, t);
    return () => {
      return window.removeEventListener(`beforeunload`, t);
    };
  }, [w]);
  let [T, E] = G.useState(false);
  let [D, O] = G.useState(null);
  let [k, j] = G.useState(true);
  let [M, N] = G.useState(null);
  let [F, te] = G.useState(null);
  let [L, z] = G.useState([]);
  let [se, de] = G.useState(`all`);
  let [fe, pe] = G.useState(`generated`);
  let [he, ge] = G.useState(`all`);
  let [_e, ve] = G.useState(``);
  let [ye, be] = G.useState(false);
  let [xe, Ce] = G.useState(``);
  let [Te, Ee] = G.useState(4);
  let [Oe, ke] = G.useState(1);
  let [Me] = G.useState(20);
  let [Ne, Fe] = G.useState(0);
  let [ze, Be] = G.useState([]);
  let [Ve, He] = G.useState(0);
  let [We, Qe] = G.useState(0);
  let [et, rt] = G.useState(false);
  let [ot, ct] = G.useState(0);
  let [ut, dt] = G.useState(false);
  let [ft, mt] = G.useState(false);
  let gt = G.useRef(Ne);
  G.useEffect(() => {
    if (gt.current !== Ne) {
      console.log(`[refreshCounter监控] refreshCounter 从`, gt.current, `变为`, Ne);
      gt.current = Ne;
    }
  }, [Ne]);
  G.useEffect(() => {
    let e = setTimeout(() => {
      if (!r.status.isConnected && !ft && !k) {
        dt(true);
      } else if (r.status.isConnected) {
        dt(false);
      }
    }, 3000);
    return () => {
      return clearTimeout(e);
    };
  }, [r.status.isConnected, ft, k]);
  let yt = G.useCallback(() => {
    let e = {};
    let t = fe === `generated` ? `tasks` : `migrated`;
    e.folder = {
      eqOrPrefix: _e ? `${t}/${_e}` : t
    };
    if (se !== `all`) {
      if (se === `video`) {
        e.type = [`video`, `audio`, `folder`];
      } else {
        e.type = [se, `folder`];
      }
    }
    if (he === `favorite`) {
      e.isFavorite = 1;
    }
    return e;
  }, [fe, _e, se, he]);
  let xt = G.useCallback(async e => {
    rt(true);
    try {
      let t = await zr({
        page: e,
        pageSize: Me,
        sortBy: `timestamp`,
        sortDir: `DESC`,
        filters: yt()
      });
      Be(t.items);
      He(t.total);
      Qe(t.totalPages);
      ke(t.page);
    } catch (e) {
      console.error(`[App] 加载资源分页失败:`, e);
    } finally {
      rt(false);
    }
  }, [Me, yt]);
  let St = G.useRef(false);
  let Ct = G.useRef([]);
  let Dt = G.useCallback(async () => {
    if (r.status.port) {
      try {
        await Wr();
        z((await zr({
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
  let [H, U] = G.useState(`accounts`);
  let [W, Ot] = G.useState(`builtin`);
  let [kt, Mt] = G.useState(false);
  let [Nt, Pt] = G.useState(0);
  let [Bt, Vt] = G.useState(true);
  let Ut = G.useRef(null);
  G.useEffect(() => {
    if (H !== `canvas`) {
      return;
    }
    let e = false;
    let t;
    let n = async () => {
      try {
        let t = await hr(`canvas-assistant`);
        if (!e) {
          Vt(t.enabled !== false);
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
  }, [H]);
  G.useEffect(() => {
    if (H === `transit`) {
      xt(1);
    }
  }, [H, fe, se, he, _e, ot]);
  G.useEffect(() => {
    if (H === `transit`) {
      xt(Oe);
    }
  }, [Oe]);
  let [Wt, Gt] = G.useState(false);
  let [Kt, qt] = G.useState(false);
  let [J, Jt] = G.useState(false);
  let [Y, Yt] = G.useState(null);
  let [an, on] = G.useState(Jr);
  let [sn, ln] = G.useState(null);
  let un = e => {
    Yt({
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
      hasPassword: e.hasPassword,
      team: e.team || null
    });
    Jt(true);
    let t = Tt();
    if (t) {
      je(ht(``), t, true).catch(() => {
        return undefined;
      });
    }
    console.log(`[useEffect:refreshCounter] 使用函数式更新 apiConfigs 中 default 的 key 为服务器返回的值`);
    ai(t => {
      return t.map(t => {
        if (t.id === 'default') {
          return {
            ...t,
            key: e.modelApiTokenKey
          };
        }
        if (t.id === `tehuishipin` || t.id === `yimaoAiApp`) {
          let e = t.url.replace(`{VITE_API_BASE_URL}`, nt(Ye));
          return {
            ...t,
            key: Tt(),
            url: Ue(e, true)
          };
        }
        return t;
      });
    });
    if (e.membershipType) {
      let t = {
        type: e.membershipType,
        expiry: e.membershipExpiryDate,
        code: xi.code
      };
      B.setObject(V.MEMBERSHIP, t);
      Si(t);
    } else {
      let e = {
        type: `FREE`,
        expiry: 0,
        code: ``
      };
      Si(e);
      B.setObject(V.MEMBERSHIP, e);
    }
  };
  G.useEffect(() => {
    ma(false);
    console.log(`[useEffect:refreshCounter] refreshCounter 变化触发，当前值:`, Ne);
    try {
      B.getObject(V.USERS).then(e => {
        if (e && e.length > 0) {
          on(e);
        } else {
          on(Jr);
          B.setObject(V.USERS, Jr);
        }
      });
      (async () => {
        try {
          if (await B.getConfig(qr)) {
            return;
          }
          let e = await B.getObject(V.TRANSIT_RESOURCES);
          let t = await jt.default.getItem(V.TRANSIT_RESOURCES);
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
              return Br({
                ...e,
                id: String(e.id)
              });
            }));
            console.log(`[App] 已播种 ${r.length} 条历史资源到 SQLite`);
          }
          await B.setConfig(qr, String(Date.now()));
        } catch (e) {
          console.error(`[App] 资源播种失败:`, e);
        }
      })();
      B.getConfig(V.TRANSIT_GRID_COLS).then(e => {
        if (e) {
          let t = parseInt(e.toString());
          if (!isNaN(t)) {
            Ee(t);
          }
        }
      });
      B.getObject(V.PROJECTS).then(e => {
        Li(t => {
          if (t.length > 1 || t.length === 1 && t[0].id !== 'default') {
            return t;
          } else {
            if (e && e.length > 0) {
              B.getConfig(V.LAST_OPENED_PROJECT).then(t => {
                if (t && e.some(e => {
                  return e.id === t;
                })) {
                  Ri(t);
                } else {
                  Ri(e[0].id);
                }
              });
              return e;
            } else {
              return t;
            }
          }
        });
      });
      B.getObject(V.PRESET_PROMPTS).then(e => {
        if (e && e.length > 0) {
          ia(e);
        }
      });
      B.getObject(V.GLOBAL_TASKS).then(async e => {
        try {
          if (!(await B.getConfig(Kr)) && e && e.length > 0 && (await Xe(e))) {
            await B.setConfig(Kr, String(Date.now()));
            console.log(`[App] 已播种 ${e.length} 条历史任务到 SQLite`);
          }
        } catch (e) {
          console.error(`[App] 任务播种失败，回退使用 KV 数据:`, e);
        }
        try {
          let e = await pt({
            page: 1,
            pageSize: Gr,
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
          d(e.map(bt));
        }
        if (r.status.isConnected) {
          try {
            let e = (await B.getConfig(V.LAST_OPENED_PROJECT)) || `default`;
            let t = await Ge(e);
            console.log(`[App] 检查点检测: checkpoint=`, t ? {
              status: t.status,
              completed: t.completedNodes?.length,
              total: t.nodeExecOrder?.length
            } : `null`);
            if (t && t.status === `running`) {
              t.status = `interrupted`;
              await st(t);
              console.log(`[App] 检测到中断的工作流，${t.completedNodes.length}/${t.nodeExecOrder.length} 节点已完成`);
            } else if (t && t.status !== `interrupted`) {
              console.log(`[App] 检查点状态=${t.status}，清理检查点`);
              await vt(e);
            }
          } catch (e) {
            console.error(`[App] 恢复工作流检查点失败:`, e);
          }
        }
      });
      B.getObject(V.CUSTOM_NODE_TEMPLATES).then(e => {
        if (e && e.length > 0) {
          ii(e);
        }
      });
      B.getObject(V.API_CONFIGS).then(e => {
        if (e && e.length > 0) {
          ai(t => {
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
      B.getObject(V.CLOUD_STORAGE_CONFIG).then(e => {
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
      Le();
      B.getObject(V.APP_SETTINGS).then(e => {
        console.log(`[Storage] 加载 app_settings:`, e ? `存在` : `不存在`);
        if (e) {
          if (e.globalPollingInterval !== undefined) {
            Nr(e.globalPollingInterval > 60 ? e.globalPollingInterval / 1000 : e.globalPollingInterval);
          }
          if (e.globalMaxPollingDuration !== undefined) {
            Ir(e.globalMaxPollingDuration);
          }
          if (e.globalSyncTimeout !== undefined) {
            Rr(e.globalSyncTimeout);
          }
          if (e.transitGridCols !== undefined) {
            Ee(e.transitGridCols);
          }
          if (e.defaultTextModel) {
            Rn(e.defaultTextModel);
          }
          if (e.defaultDrawingModel) {
            Gn(e.defaultDrawingModel);
          }
          if (e.defaultVideoModel) {
            Zn(e.defaultVideoModel);
          }
          if (e.defaultSd2VideoModel) {
            ar(e.defaultSd2VideoModel);
          }
          if (e.videoDurations) {
            $n(e.videoDurations);
          }
          if (e.defaultAudioModel) {
            wr(e.defaultAudioModel);
          }
          if (e.textApiConfigId && !localStorage.getItem(`apiConfigId_text`)) {
            si(e.textApiConfigId);
          }
          if (e.imageApiConfigId && !localStorage.getItem(`apiConfigId_image`)) {
            li(e.imageApiConfigId);
          }
          if (e.videoApiConfigId && !localStorage.getItem(`apiConfigId_video`)) {
            di(e.videoApiConfigId);
          }
          if (e.sd2VideoApiConfigId && !localStorage.getItem(`apiConfigId_sd2Video`)) {
            pi(e.sd2VideoApiConfigId);
          }
          if (e.audioApiConfigId && !localStorage.getItem(`apiConfigId_audio`)) {
            _i(e.audioApiConfigId);
          }
          if (e.sd2Token && !g) {
            _(e.sd2Token);
          }
          if (e.useThumbnail !== undefined) {
            Qr(e.useThumbnail);
          }
          if (e.panPerformanceMode !== undefined) {
            ei(e.panPerformanceMode);
          }
          if (e.enablePerformanceMode !== undefined) {
            ni(e.enablePerformanceMode);
          }
          console.log(`result.useThumbnail`, e.useThumbnail);
        }
      });
      B.getObject(V.MEMBERSHIP).then(e => {
        if (e) {
          let t = Date.now();
          if (e.expiry > t) {
            Si(e);
          } else {
            Si({
              type: `FREE`,
              expiry: 0
            });
            B.remove(V.MEMBERSHIP);
          }
        }
      });
      C(false);
    } catch (e) {
      console.error(`Storage get error:`, e);
      C(false);
      ma(true);
    }
    B.getConfig(`auth_token`).then(e => {
      if (!e) {
        console.log(`[useEffect:refreshCounter] 未检测到登录 Token`);
        at();
        Si({
          type: `FREE`,
          expiry: 0,
          code: ``
        });
        B.getObject(V.OLD_MEMBERSHIP).then(e => {
          if (e) {
            Si(e);
          }
        });
        setTimeout(() => {
          return ma(true);
        }, 300);
        return;
      }
      Ke(e.toString());
      console.log(`[useEffect:refreshCounter] 检测到登录 Token，开始获取用户信息...`);
      (async (e = 2, t = 800) => {
        for (let n = 0; n <= e; n++) {
          try {
            let e = await _t.get(`/user/info`);
            if (e.success && e.data) {
              let t = e.data.user;
              console.log(`[useEffect:refreshCounter] 获取用户信息成功，modelApiTokenKey:`, t.modelApiTokenKey ? `***${t.modelApiTokenKey.slice(-4)}` : `empty`);
              un(t);
              setTimeout(() => {
                return ma(true);
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
            let i = await B.getObject(V.MEMBERSHIP).catch(() => {
              return null;
            });
            if (i && i.expiry > Date.now()) {
              Si(i);
            }
            setTimeout(() => {
              return ma(true);
            }, 300);
          }
        }
      })();
    });
  }, [Ne]);
  let [dn, fn] = G.useState(false);
  let [pn, mn] = G.useState(``);
  let [hn, gn] = G.useState(null);
  let [_n, vn] = G.useState(``);
  let [yn, bn] = G.useState(false);
  let [xn, Sn] = G.useState(null);
  let [Cn, wn] = G.useState(false);
  let [En, Dn] = G.useState(``);
  let On = `https://0.1mao.cc`;
  let [kn, An] = G.useState(On);
  let [jn, Mn] = G.useState(``);
  let [Nn, Pn] = G.useState(On);
  let [Fn, In] = G.useState(``);
  let [Ln, Rn] = G.useState(`gemini-3-flash-preview
gemini-3-pro`);
  let [zn, Bn] = G.useState(On);
  let [Vn, Un] = G.useState(``);
  let [Wn, Gn] = G.useState(`gemini-3.1-flash-image-preview
gemini-3-pro-image-preview`);
  let [Kn, qn] = G.useState(On);
  let [Jn, Yn] = G.useState(``);
  let [Xn, Zn] = G.useState(`grok-video-3-pro
grok-video-3`);
  let [Qn, $n] = G.useState(`10
15`);
  let [er, tr] = G.useState(`defaultModelApiUrl`);
  let [nr, rr] = G.useState(``);
  let [ir, ar] = G.useState(`seed-2`);
  let [or, sr] = G.useState(() => {
    return nt(Ye);
  });
  let [ur, dr] = G.useState(``);
  let [fr, pr] = G.useState(`seedance_2_fast`);
  let [mr, gr] = G.useState(() => {
    return nt(Ye);
  });
  let [_r, vr] = G.useState(``);
  let [yr, br] = G.useState(`defaultModelApiUrl`);
  let [xr, Sr] = G.useState(``);
  let [Cr, wr] = G.useState(`whisper-1`);
  let Tr = (e, t) => {
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
  let [Er, Dr] = G.useState(0);
  G.useEffect(() => {
    Ae(ht(``));
    return De(() => {
      return Dr(e => {
        return e + 1;
      });
    });
  }, []);
  let Or = G.useMemo(() => {
    return Tr(Ln, we(`text`));
  }, [Ln, Er]);
  let kr = G.useMemo(() => {
    return Tr(Wn, we(`image`));
  }, [Wn, Er]);
  let Ar = G.useMemo(() => {
    return Tr(fr, Re());
  }, [fr, Er]);
  let [Mr, Nr] = G.useState(3);
  let [Pr, Ir] = G.useState(600);
  let [Lr, Rr] = G.useState(600);
  let [Zr, Qr] = G.useState(true);
  let [$r, ei] = G.useState(false);
  let [ti, ni] = G.useState(true);
  let [ri, ii] = G.useState([]);
  let [X, ai] = G.useState([]);
  let [oi, si] = G.useState(() => {
    try {
      return localStorage.getItem(`apiConfigId_text`) || `default`;
    } catch {
      return `default`;
    }
  });
  let [ci, li] = G.useState(() => {
    try {
      return localStorage.getItem(`apiConfigId_image`) || `default`;
    } catch {
      return `default`;
    }
  });
  let [ui, di] = G.useState(() => {
    try {
      return localStorage.getItem(`apiConfigId_video`) || `default`;
    } catch {
      return `default`;
    }
  });
  let [fi, pi] = G.useState(() => {
    try {
      return localStorage.getItem(`apiConfigId_sd2Video`) || `default`;
    } catch {
      return `default`;
    }
  });
  let [mi] = G.useState(`tehuishipin`);
  let [hi] = G.useState(`yimaoAiApp`);
  let [gi, _i] = G.useState(() => {
    try {
      return localStorage.getItem(`apiConfigId_audio`) || `default`;
    } catch {
      return `default`;
    }
  });
  let vi = G.useCallback((e, t = false) => {
    if (!Array.isArray(e) || e.length === 0) {
      return null;
    } else {
      if (t) {
        return e.find(e => {
          return e.id === 'default' && e.readonly;
        }) || e.find(e => {
          return e.readonly;
        }) || e[0] || null;
      } else {
        return e.find(e => {
          return !e.readonly;
        }) || e.find(e => {
          return e.id === 'default';
        }) || e[0] || null;
      }
    }
  }, []);
  let yi = G.useCallback((e, t, n = false) => {
    let r = Array.isArray(e) ? e : [];
    let i = t ? r.find(e => {
      return e.id === t;
    }) : undefined;
    if (i) {
      if (!n) {
        return (i.readonly || i.id === 'default') && vi(r, false) || i;
      }
      if (i.readonly || i.id === 'default') {
        return i;
      }
    }
    return vi(r, n);
  }, [vi]);
  let bi = G.useCallback(e => {
    let t = vi(X, e === `sd2Video` || e === `discountVideo`);
    if (t) {
      if (e === `text` && oi !== t.id || e === `image` && ci !== t.id || e === `video` && ui !== t.id || e === `sd2Video` && fi !== t.id || e === `audio` && gi !== t.id) {
        if (e === `text`) {
          si(t.id);
        } else if (e === `image`) {
          li(t.id);
        } else if (e === `video`) {
          di(t.id);
        } else if (e === `sd2Video`) {
          pi(t.id);
        } else if (e === `audio`) {
          _i(t.id);
        }
      }
      return t;
    } else {
      return null;
    }
  }, [X, gi, vi, ci, fi, oi, ui]);
  G.useEffect(() => {
    try {
      localStorage.setItem(`apiConfigId_text`, oi);
    } catch {}
  }, [oi]);
  G.useEffect(() => {
    try {
      localStorage.setItem(`apiConfigId_image`, ci);
    } catch {}
  }, [ci]);
  G.useEffect(() => {
    try {
      localStorage.setItem(`apiConfigId_video`, ui);
    } catch {}
  }, [ui]);
  G.useEffect(() => {
    try {
      localStorage.setItem(`apiConfigId_sd2Video`, fi);
    } catch {}
  }, [fi]);
  G.useEffect(() => {
    try {
      localStorage.setItem(`apiConfigId_discountVideo`, mi);
    } catch {}
  }, [mi]);
  G.useEffect(() => {
    try {
      localStorage.setItem(`apiConfigId_audio`, gi);
    } catch {}
  }, [gi]);
  G.useEffect(() => {
    let e = vi(X, false);
    let t = t => {
      return yi(X, t, false) || e;
    };
    let n = t(oi);
    if (n) {
      Pn(n.url);
      In(n.key);
    }
    if (!n || !n.key && !n.readonly) {
      let e = bi(`text`);
      if (e) {
        Pn(e.url);
        In(e.key);
      }
    }
    let r = t(ci);
    if (r) {
      Bn(r.url);
      Un(r.key);
    }
    if (!r || !r.key && !r.readonly) {
      let e = bi(`image`);
      if (e) {
        Bn(e.url);
        Un(e.key);
      }
    }
    let i = t(ui);
    if (i) {
      qn(i.url);
      Yn(i.key);
    }
    if (!i || !i.key && !i.readonly) {
      let e = bi(`video`);
      if (e) {
        qn(e.url);
        Yn(e.key);
      }
    }
    let a = yi(X, fi, true) || X[0];
    if (a) {
      tr(a.url);
      rr(a.key);
    }
    if (!a || !a.key) {
      let e = bi(`sd2Video`);
      if (e) {
        tr(e.url);
        rr(e.key);
      }
    }
    let o = yi(X, mi, true) || X[0];
    if (o) {
      sr(o.url);
      dr(o.key);
    }
    if (!o || !o.key) {
      let e = bi(`discountVideo`);
      if (e) {
        sr(e.url);
        dr(e.key);
      }
    }
    let s = yi(X, hi, true) || o;
    if (s) {
      gr(Ue(s.url, s.readonly || s.id === `yimaoAiApp`));
      vr(s.key);
    }
    let c = t(gi);
    if (c) {
      br(c.url);
      Sr(c.key);
    }
    if (!c || !c.key && !c.readonly) {
      let e = bi(`audio`);
      if (e) {
        br(e.url);
        Sr(e.key);
      }
    }
    let l = yi(X, `default`, true) || X[0];
    if (l) {
      An(l.url);
      Mn(l.key);
    }
  }, [X, oi, ci, ui, fi, mi, hi, gi, vi, yi]);
  let [xi, Si] = G.useState({
    type: `FREE`,
    expiry: 0
  });
  let [Ci, wi] = G.useState(``);
  let [Ti, Ei] = G.useState(``);
  let Di = G.useRef(false);
  let Oi = e => {
    console.log(`[loadAppSettings] 加载配置数据`, e);
    if (e.users && e.users.length > 0) {
      on(e.users);
    }
    if (e.projects && e.projects.length > 0) {
      Li(e.projects);
    }
    if (e.textApiConfigId && !localStorage.getItem(`apiConfigId_text`)) {
      si(e.textApiConfigId);
    }
    if (e.imageApiConfigId && !localStorage.getItem(`apiConfigId_image`)) {
      li(e.imageApiConfigId);
    }
    if (e.videoApiConfigId && !localStorage.getItem(`apiConfigId_video`)) {
      di(e.videoApiConfigId);
    }
    if (e.sd2VideoApiConfigId && !localStorage.getItem(`apiConfigId_sd2Video`)) {
      pi(e.sd2VideoApiConfigId);
    }
    if (e.audioApiConfigId && !localStorage.getItem(`apiConfigId_audio`)) {
      _i(e.audioApiConfigId);
    }
    if (e.textModel) {
      Rn(e.textModel);
    }
    if (e.drawingModel) {
      Gn(e.drawingModel);
    }
    if (e.videoModel) {
      Zn(e.videoModel);
    }
    if (e.sd2VideoModel) {
      ar(e.sd2VideoModel);
    }
    if (e.discountVideoModel) {
      pr(e.discountVideoModel);
    }
    if (e.audioModel) {
      wr(e.audioModel);
    }
    if (e.presetPrompts) {
      ia(e.presetPrompts);
    }
    if (e.customNodeTemplates) {
      ii(e.customNodeTemplates);
    }
    if (e.sd2Token) {
      _(e.sd2Token);
    }
    if (e.cloudStorageConfig) {
      p(e.cloudStorageConfig);
    }
    if (e.globalPollingInterval !== undefined) {
      Nr(e.globalPollingInterval);
    }
    if (e.globalMaxPollingDuration !== undefined) {
      Ir(e.globalMaxPollingDuration);
    }
    if (e.globalSyncTimeout !== undefined) {
      Rr(e.globalSyncTimeout);
    }
    if (e.textApiUrl) {
      Pn(e.textApiUrl);
    }
    if (e.textApiKey) {
      In(e.textApiKey);
    }
    if (e.imageApiUrl) {
      Bn(e.imageApiUrl);
    }
    if (e.imageApiKey) {
      Un(e.imageApiKey);
    }
    if (e.videoApiUrl) {
      qn(e.videoApiUrl);
    }
    if (e.videoApiKey) {
      Yn(e.videoApiKey);
    }
    if (e.sd2VideoApiUrl) {
      tr(e.sd2VideoApiUrl);
    }
    if (e.sd2VideoApiKey) {
      rr(e.sd2VideoApiKey);
    }
    if (e.audioApiUrl) {
      br(e.audioApiUrl);
    }
    if (e.audioApiKey) {
      Sr(e.audioApiKey);
    }
    if (e.videoApiUrl) {
      qn(e.videoApiUrl);
    }
    if (e.useThumbnail !== undefined) {
      Qr(e.useThumbnail);
    }
    if (e.panPerformanceMode !== undefined) {
      ei(e.panPerformanceMode);
    }
  };
  let ki = (e, t) => {
    console.log(`[adjustApiConfigs] 加载配置数据`, e);
    e ||= [];
    if (!Array.isArray(t)) {
      t = [];
    }
    ai(n => {
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
  let Ai = async () => {
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
  G.useEffect(() => {
    console.log(`kvLoadedRef.current`, Di.current);
    if (!Di.current) {
      Di.current = true;
      console.log(`[useEffect:storage] 开始从存储引擎加载设置...`);
      (async () => {
        let [e, t, n] = await Promise.all([B.getObject(`app_settings`), B.getObject(`api_configs`), Ai()]);
        if (!e) {
          console.log(`[useEffect:storage] 本地无配置，使用云端默认配置完整加载`);
          if (n) {
            console.log(`[useEffect:storage] 获取到云端默认配置，正在加载...`);
            Oi(n);
          }
        }
        if (n?.discountVideoModel) {
          pr(n.discountVideoModel);
        }
        console.log(`[appSettingKvData] 配置数据:`, e);
        console.log(`defaultConfig?.apiConfigs`, n?.apiConfigs);
        let r = Array.isArray(n?.apiConfigs) ? n.apiConfigs : [];
        let i = Array.isArray(t) ? t : [];
        if (!e && r.length === 0 && i.length === 0) {
          console.warn(`[useEffect:storage] 未检测到任何可用 API 配置，后续将依赖运行时兜底`);
        }
        ki(t, n?.apiConfigs);
      })();
    }
  }, []);
  let [ji, Mi] = G.useState({
    usage: 0,
    quota: 0,
    percentage: 0
  });
  let Ni = 524288000;
  G.useEffect(() => {
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(e => {
        let t = e.usage || 0;
        let n = Math.min(e.quota || Ni, Ni);
        Mi({
          usage: t,
          quota: n,
          percentage: n > 0 ? t / n * 100 : 0
        });
      });
    }
  }, [L, u, Ni]);
  let Pi = G.useRef(null);
  G.useEffect(() => {
    if (Pi.current === null) {
      Pi.current = X;
      return;
    }
    let e = Pi.current;
    let t = JSON.stringify(e);
    let n = JSON.stringify(X);
    if (t !== n) {
      console.log(`[useEffect:apiConfigs监控] apiConfigs 发生变化！`);
      console.log(`[useEffect:apiConfigs监控] 变化前:`, t);
      console.log(`[useEffect:apiConfigs监控] 变化后:`, n);
      Pi.current = X;
    }
  }, [X]);
  let Fi = {
    accounts: 9999,
    presets: 9999,
    name: `无限制`
  };
  let [Ii, Li] = G.useState([{
    id: `default`,
    name: `默认项目`
  }]);
  let [Z, Ri] = G.useState(`default`);
  let [zi, Bi] = G.useState(false);
  let [Vi, Hi] = G.useState(``);
  let [Ui, Wi] = G.useState(false);
  let [Gi, Ki] = G.useState(``);
  let [qi, Ji] = G.useState(null);
  let [Yi, Xi] = G.useState(null);
  let [Zi, Qi] = G.useState(false);
  let [$i, ea] = G.useState(false);
  let [ta, na] = G.useState(false);
  let ra = G.useCallback(async () => {
    if (!J || !Z) {
      Xi(null);
      return;
    }
    try {
      let e = await _t.get(`/workflow-apps/by-project/${encodeURIComponent(Z)}`);
      let t = e.data;
      Xi(e.success ? t?.data ?? t ?? null : null);
    } catch {
      Xi(null);
    }
  }, [J, Z]);
  G.useEffect(() => {
    ra();
  }, [ra]);
  let [Q, ia] = G.useState([{
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
  let [aa, oa] = G.useState(false);
  let [sa, ca] = G.useState(false);
  let la = `{
  "accessKey": "",
  "secretKey": "",
  "bucket": "",
  "endpoint": "",
  "domain": ""
}`;
  let [ua, da] = G.useState(la);
  let $ = G.useCallback(e => {
    Dn(e);
    wn(true);
    setTimeout(() => {
      wn(false);
    }, 2000);
  }, []);
  G.useCallback(async () => {
    if (Yi?.appId) {
      try {
        let e = Yi.status === `offline` ? `published` : `offline`;
        let t = await _t.patch(`/workflow-apps/${encodeURIComponent(Yi.appId)}`, {
          status: e
        });
        if (!t.success) {
          throw Error(t.error || `操作失败`);
        }
        await ra();
        $?.(e === `offline` ? `应用已下架` : `应用已重新上架`);
      } catch (e) {
        $?.(e?.message || `操作失败`);
      }
    }
  }, [Yi, ra, $]);
  let fa = Xt({
    onToast: $,
    openUpgradeSettings: () => {
      U(`settings`);
      Ot(`upgrade`);
    }
  });
  let [pa, ma] = G.useState(false);
  let ha = G.useRef(false);
  G.useEffect(() => {
    if (pa && !ha.current) {
      ha.current = true;
      console.log(`[初始化完成] 当前 isLoggedIn:`, J);
      console.log(`[初始化完成] 当前 userInfo:`, Y?.modelApiTokenKey ? `***${Y.modelApiTokenKey.slice(-4)}` : `empty`);
    }
  }, [pa, X, J, Y]);
  G.useEffect(() => {
    if (pa && Z) {
      B.setConfig(V.LAST_OPENED_PROJECT, Z);
    }
  }, [Z, pa]);
  let ga = G.useRef(X.length);
  ga.current = X.length;
  G.useEffect(() => {
    let e = typeof chrome < `u` && chrome.runtime && chrome.runtime.id;
    j(!!e);
    if (e) {
      document.title = `一毛AI画布·插件端`;
    } else {
      U(`canvas`);
      document.title = `一毛AI画布·本地端`;
    }
    if (e) {
      chrome.tabs.getCurrent(e => {});
    }
    Ei(a);
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
          Sn({
            title: t.title || `当前平台`,
            favIconUrl: t.favIconUrl || ``,
            url: t.url || ``
          });
        }
      });
      let e = (e, t, n) => {
        if (t.status === `complete` && n.active) {
          Sn({
            title: n.title || `当前平台`,
            favIconUrl: n.favIconUrl || ``,
            url: n.url || ``
          });
        }
      };
      let n = e => {
        chrome.tabs.get(e.tabId, e => {
          if (e) {
            Sn({
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
          z(e => {
            if (e.find(e => {
              return e.id === i.id;
            })) {
              return e;
            } else {
              return [i, ...e];
            }
          });
          if (r) {
            ct(e => {
              return e + 1;
            });
          } else {
            Br({
              ...i,
              id: String(i.id)
            }).then(() => {
              return ct(e => {
                return e + 1;
              });
            });
          }
          U(`transit`);
          pe(`materials`);
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
  G.useEffect(() => {
    if (!pa) {
      return;
    }
    let e = setTimeout(() => {
      B.setObject(V.PROJECTS, Ii).catch(e => {
        return console.error(`PROJECTS save error`, e);
      });
      B.setObject(V.USERS, an).catch(e => {
        return console.error(`USERS save error`, e);
      });
      let e = X.filter(e => {
        return !e.readonly;
      });
      B.setObject(V.API_CONFIGS, e).catch(e => {
        return console.error(`API_CONFIGS save error`, e);
      });
      B.setObject(V.PRESET_PROMPTS, Q).catch(e => {
        return console.error(`PRESET_PROMPTS save error`, e);
      });
      B.setObject(V.CUSTOM_NODE_TEMPLATES, ri).catch(e => {
        return console.error(`CUSTOM_NODE_TEMPLATES save error`, e);
      });
      B.setObject(V.CLOUD_STORAGE_CONFIG, f).catch(e => {
        return console.error(`CLOUD_STORAGE_CONFIG save error`, e);
      });
    }, 1000);
    return () => {
      return clearTimeout(e);
    };
  }, [Ii, an, X, Q, ri, f]);
  G.useEffect(() => {
    if (!pa) {
      return;
    }
    let e = {
      defaultTextModel: Ln,
      defaultDrawingModel: Wn,
      defaultVideoModel: Xn,
      defaultAudioModel: Cr,
      defaultSd2VideoModel: ir,
      textApiConfigId: oi,
      imageApiConfigId: ci,
      videoApiConfigId: ui,
      sd2VideoApiConfigId: fi,
      audioApiConfigId: gi,
      videoDurations: Qn,
      globalPollingInterval: Mr,
      globalMaxPollingDuration: Pr,
      globalSyncTimeout: Lr,
      transitGridCols: Te,
      sd2Token: g,
      useThumbnail: Zr,
      panPerformanceMode: $r,
      enablePerformanceMode: ti
    };
    let t = setTimeout(() => {
      B.setObject(V.APP_SETTINGS, e).catch(e => {
        return console.error(`APP_SETTINGS save error`, e);
      });
    }, 1000);
    return () => {
      return clearTimeout(t);
    };
  }, [Ln, Wn, Xn, Cr, ir, oi, ci, ui, fi, gi, Qn, Mr, Pr, Lr, Te, g, Zr, $r, ti]);
  G.useEffect(() => {
    if (u.length === 0 || u.filter(e => {
      return e.status === `pending` || e.status === `running`;
    }).length === 0) {
      return;
    }
    let e = setInterval(async () => {
      let e = Ct.current;
      let t = Date.now();
      let n = e.filter(e => {
        return (e.status === `pending` || e.status === `running`) && e.type === `discountVideo` && !!e.taskId;
      });
      if (n.length === 0) {
        return;
      }
      let r = [];
      for (let e of n) {
        let n = e.taskId || e.id;
        let i = (Pr || 600) * 1000;
        if (t - e.createdAt > i) {
          r.push({
            key: {
              id: e.id,
              taskId: e.taskId
            },
            patch: {
              status: `failed`,
              errorMsg: `查询超时，已停止同步`
            },
            completedEvent: e.nodeId ? {
              taskId: n,
              nodeId: e.nodeId,
              resultUrl: undefined,
              type: e.type,
              status: `failed`,
              errorMsg: `查询超时，已停止同步`
            } : undefined
          });
          continue;
        }
        try {
          let i = or.replace(/[`\s]/g, ``).replace(/\/$/, ``);
          let a = await fetch(`${i}/v1/gateway/task/${n}`, {
            headers: {
              Authorization: `Bearer ${ur}`,
              Accept: `*/*`
            }
          });
          if (!a.ok) {
            if (a.status === 404) {
              let i = (e.notFoundCount || 0) + 1;
              if (t - e.createdAt > 30000 && i >= 3) {
                r.push({
                  key: {
                    id: e.id,
                    taskId: e.taskId
                  },
                  patch: {
                    status: `failed`,
                    errorMsg: `任务未找到或已被清理`,
                    notFoundCount: i
                  },
                  completedEvent: e.nodeId ? {
                    taskId: n,
                    nodeId: e.nodeId,
                    resultUrl: undefined,
                    type: e.type,
                    status: `failed`,
                    errorMsg: `任务未找到或已被清理`
                  } : undefined
                });
              } else {
                r.push({
                  key: {
                    id: e.id,
                    taskId: e.taskId
                  },
                  patch: {
                    notFoundCount: i
                  }
                });
              }
            }
            continue;
          }
          let o = await a.json();
          let s = false;
          let c = false;
          let l = ``;
          let u = ``;
          let d = e.progress;
          if (o.code === 1 && o.data) {
            let e = o.data.status;
            if (e === 3 || e === `success` || e === `SUCCESS` || e === `completed`) {
              s = true;
              l = o.data.video_url || o.data.result_url || o.data.data?.content?.video_url;
            } else if (e === 4 || e === `failed` || e === `FAILED` || e === `error`) {
              c = true;
              u = o.data.fail_reason || o.data.error || `视频生成失败`;
            } else if (o.data.progress) {
              d = parseInt(String(o.data.progress).replace(`%`, ``)) || 50;
            }
          } else if (o.status !== undefined && !o.data) {
            let e = o.status;
            if (e === 3 || e === `success` || e === `SUCCESS` || e === `completed`) {
              s = true;
              l = o.video_url || o.result_url;
            } else if (e === 4 || e === `failed` || e === `FAILED` || e === `error`) {
              c = true;
              u = o.fail_reason || o.error || `视频生成失败`;
            } else if (o.progress) {
              d = parseInt(String(o.progress).replace(`%`, ``)) || 50;
            }
          } else if (o.status === `success` || o.status === `succeeded` || o.status === `completed`) {
            s = true;
            l = o.result?.url || o.resultUrl || o.responseData?.debug_extracted_url;
          } else if (o.status === `failed`) {
            c = true;
            u = o.errorMsg || o.errorMessage || o.error || `任务生成失败`;
          } else if (o.progress !== undefined) {
            d = parseInt(String(o.progress).replace(`%`, ``)) || 50;
          }
          if (s && l) {
            l = l.replace(/[`\s]/g, ``);
            r.push({
              key: {
                id: e.id,
                taskId: e.taskId
              },
              patch: {
                status: `completed`,
                progress: 100,
                resultUrl: l,
                responseData: o,
                customRawResponse: o
              },
              completedEvent: e.nodeId ? {
                taskId: n,
                nodeId: e.nodeId,
                resultUrl: l,
                type: e.type,
                status: `completed`,
                errorMsg: undefined
              } : undefined
            });
          } else if (c) {
            if (typeof u == `object`) {
              try {
                u = JSON.stringify(u);
              } catch {
                u = `未知错误`;
              }
            }
            r.push({
              key: {
                id: e.id,
                taskId: e.taskId
              },
              patch: {
                status: `failed`,
                errorMsg: u,
                responseData: o,
                customRawResponse: o
              },
              completedEvent: e.nodeId ? {
                taskId: n,
                nodeId: e.nodeId,
                resultUrl: undefined,
                type: e.type,
                status: `failed`,
                errorMsg: u
              } : undefined
            });
          } else if (d !== e.progress && d !== undefined) {
            r.push({
              key: {
                id: e.id,
                taskId: e.taskId
              },
              patch: {
                progress: d,
                errorMsg: undefined,
                responseData: o,
                customRawResponse: o
              }
            });
          } else if (e.errorMsg) {
            r.push({
              key: {
                id: e.id,
                taskId: e.taskId
              },
              patch: {
                errorMsg: undefined,
                notFoundCount: 0,
                responseData: o,
                customRawResponse: o
              }
            });
          }
        } catch (t) {
          console.error(`Failed to sync task ${e.id}`, t);
        }
      }
      if (r.length === 0) {
        return;
      }
      let i = new Map();
      for (let e of r) {
        if (e.key.id) {
          i.set(String(e.key.id), e);
        }
        if (e.key.taskId) {
          i.set(String(e.key.taskId), e);
        }
      }
      d(e => {
        let t = false;
        let n = e.map(e => {
          let n = i.get(String(e.id)) || (e.taskId ? i.get(String(e.taskId)) : undefined) || r.find(t => {
            return wt(e, {
              id: t.key.id,
              taskId: t.key.taskId
            });
          });
          if (!n) {
            return e;
          }
          t = true;
          let a = n.patch;
          let o = {
            ...a
          };
          if (e.resultUrl && a.resultUrl && e.resultUrl !== a.resultUrl) {
            delete o.resultUrl;
          }
          if (e.thumbnailUrl && a.thumbnailUrl && e.thumbnailUrl !== a.thumbnailUrl) {
            delete o.thumbnailUrl;
          }
          if (Object.values(o).some(e => {
            return e !== undefined;
          })) {
            return {
              ...e,
              ...o
            };
          } else {
            return e;
          }
        });
        if (t) {
          it(e, n).catch(e => {
            return console.error(`Failed to persist global tasks:`, e);
          });
          return n;
        } else {
          return e;
        }
      });
      for (let e of r) {
        if (e.completedEvent) {
          window.dispatchEvent(new CustomEvent(`mutiwindow-task-completed`, {
            detail: e.completedEvent
          }));
        }
      }
    }, (Mr || 10) * 1000);
    return () => {
      return clearInterval(e);
    };
  }, [u.length, or, ur, Mr, Pr]);
  G.useEffect(() => {
    let e = e => {
      let {
        id: t,
        taskId: n,
        meta: r,
        _taskSnapshot: i
      } = e.detail || {};
      if (!r) {
        return;
      }
      let a = {
        id: t || ``,
        taskId: n
      };
      d(e => {
        let o = e.findIndex(e => {
          return wt(e, a);
        });
        let s = null;
        let c = false;
        if (o !== -1) {
          let t = e[o];
          s = {
            ...(t.mediaMeta || {})
          };
          for (let e of Object.keys(r)) {
            let t = r[e];
            if (t == null) {
              if (e in s) {
                delete s[e];
                c = true;
              }
            } else if (s[e] !== t) {
              s[e] = t;
              c = true;
            }
          }
          if (!c) {
            return e;
          }
          let n = [...e];
          n[o] = {
            ...t,
            mediaMeta: Object.keys(s).length ? s : undefined
          };
          let i = n[o];
          setTimeout(() => {
            qe(i).catch(e => {
              return console.error(`Failed to save task meta:`, e);
            });
          }, 100);
          return n;
        }
        let l = null;
        if (i && (i.id === t || i.taskId === n)) {
          l = i;
        }
        if (l) {
          let e = {
            ...(l.mediaMeta || {})
          };
          let t = false;
          for (let n of Object.keys(r)) {
            let i = r[n];
            if (i == null) {
              if (n in e) {
                delete e[n];
                t = true;
              }
            } else if (e[n] !== i) {
              e[n] = i;
              t = true;
            }
          }
          if (t) {
            let t = {
              ...l,
              mediaMeta: Object.keys(e).length ? e : undefined
            };
            setTimeout(() => {
              qe(t).catch(e => {
                return console.error(`Failed to save task meta (out-of-working-set):`, e);
              });
            }, 100);
          }
        }
        return e;
      });
    };
    window.addEventListener(`mutiwindow-update-task-meta`, e);
    return () => {
      return window.removeEventListener(`mutiwindow-update-task-meta`, e);
    };
  }, []);
  G.useEffect(() => {
    let e = () => {
      U(`settings`);
      Ot(`builtin`);
    };
    let t = () => {
      U(`settings`);
      Ot(`builtin`);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent(`builtin-panel-switch-schedule`));
      }, 50);
    };
    window.addEventListener(`mutiwindow-open-builtin-settings`, e);
    window.addEventListener(`mutiwindow-open-schedule-settings`, t);
    let n = () => {
      U(`settings`);
      Ot(`basic`);
    };
    window.addEventListener(tt, n);
    return () => {
      window.removeEventListener(`mutiwindow-open-builtin-settings`, e);
      window.removeEventListener(`mutiwindow-open-schedule-settings`, t);
      window.removeEventListener(tt, n);
    };
  }, []);
  G.useEffect(() => {
    let e = e => {
      if (e.key === `Escape` && M) {
        N(null);
      }
    };
    window.addEventListener(`keydown`, e);
    return () => {
      return window.removeEventListener(`keydown`, e);
    };
  }, [M]);
  let _a = e => {
    on(e);
    B.setObject(V.USERS, e).then(e => {
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
  let va = async e => {
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
  let ya = [`sid_tt`, `sid_guard`, `uid_tt`, `ttwid`, `n_mh`, `odin_tt`, `has_biz_token`, `is_staff_user`, `user_spaces_idc`];
  let ba = async (e, t = false) => {
    if (!k) {
      q.error(`仅支持浏览器扩展环境`);
      return;
    }
    try {
      let [n] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });
      if (!n?.url || !n.url.startsWith(`http`)) {
        q.error(`无法获取当前页面 URL`);
        return;
      }
      let r = n.url;
      console.log(`正在清除页面 cookies:`, r);
      let i = await chrome.cookies.getAll({
        url: r
      });
      if (i.length === 0) {
        q.info(`当前页面没有可清除的 Cookies`);
        return;
      }
      console.log(`找到 ${i.length} 个 Cookies，开始清除...`);
      let a = 0;
      let o = [];
      for (let e of i) {
        if (t || ya.includes(e.name)) {
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
        q.info(`没有找到登录状态 Cookies`);
      } else {
        let e = t ? `全部` : `登录状态`;
        q.success(`已清除 ${a} 个${e} Cookies`);
        console.log(`已清除的 cookies:`, o);
      }
      if (n.id) {
        chrome.tabs.reload(n.id);
      }
    } catch (e) {
      console.error(`清除 cookies 失败:`, e);
      q.error(`清除 Cookies 失败`);
    }
  };
  let xa = async e => {
    await va(e);
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
    ln(e);
  };
  let Sa = async () => {
    Jt(false);
    Yt(null);
    Ke(``);
    at();
    B.remove(V.AUTH_TOKEN);
  };
  G.useEffect(() => {
    let e = e => {
      let t = e.detail;
      Sa();
      $e();
      $(t?.message || `该账号已被停用，请联系管理员`);
    };
    window.addEventListener(`yimao:auth-disabled`, e);
    return () => {
      return window.removeEventListener(`yimao:auth-disabled`, e);
    };
  }, []);
  let [Ca, wa] = G.useState(false);
  let Ta = async () => {
    if (!_t.getCurrentToken()) {
      $(`请先登录`);
      return;
    }
    wa(true);
    try {
      let e = {};
      for (let t of [`app_settings`, `api_configs`, `users`, `membership`, `projects`, `presetPrompts`, `customNodeTemplates`, `modelSchedules`, `cloud_storage_config`]) {
        let n = t === `modelSchedules` ? Se() : await B.getObject(t);
        if (n !== null) {
          e[t] = n;
        }
      }
      if (Object.keys(e).length === 0) {
        $(`本地没有可同步的配置数据`);
        wa(false);
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
      wa(false);
    }
  };
  let Ea = async () => {
    if (!_t.getCurrentToken()) {
      $(`请先登录`);
      return;
    }
    wa(true);
    try {
      let e = await _t.get(`/sync/download`);
      if (!e.success || !e.data || e.data.hasData !== true) {
        $(`云端没有配置数据`);
        wa(false);
        return;
      }
      let t = e.data.data.cloud_config || e.data.data || {};
      let n = Object.keys(t);
      if (n.length === 0) {
        $(`云端没有新的配置数据`);
        wa(false);
        return;
      }
      let r = 0;
      for (let e of n) {
        let n = t[e];
        if (n != null) {
          if (e === `modelSchedules`) {
            await Ie(n);
          } else {
            await B.setObject(e, n);
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
      wa(false);
    }
  };
  let Da = async (e = false) => {
    let t = e ? `` : pn;
    let n = e ? `` : _n;
    let r = e ? null : hn;
    let i = t.trim();
    if (!i && xn) {
      i = xn.title;
    }
    i ||= `新建环境`;
    bn(true);
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
            if (_n.includes(`=`)) {
              r = _n.split(`;`).map(e => {
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
            o = xn?.favIconUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`;
          } else {
            throw Error(`Invalid cookie format`);
          }
        } catch {
          alert(`Cookie 格式错误，请输入有效的 JSON 数组或 key=value; 格式字符串`);
          bn(false);
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
        bn(false);
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
        c = an.map(e => {
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
        c = [...an, e];
      }
      _a(c);
      mn(``);
      vn(``);
      gn(null);
      fn(false);
    } catch (e) {
      console.error(`Error during add environment:`, e);
      alert(`添加失败，请重试: ${e.message || `未知错误`}`);
    } finally {
      bn(false);
    }
  };
  let [Oa, ka] = G.useState(null);
  let [Aa, ja] = G.useState(null);
  let Ma = (e, t) => {
    ka(t);
    e.dataTransfer.effectAllowed = `move`;
    setTimeout(() => {
      let t = e.target;
      if (t) {
        t.style.opacity = `0.5`;
      }
    }, 0);
  };
  let Na = e => {
    ka(null);
    ja(null);
    let t = e.target;
    if (t) {
      t.style.opacity = `1`;
    }
  };
  let Pa = (e, t) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = `move`;
    if (Aa !== t) {
      ja(t);
    }
  };
  let Fa = (e, t) => {
    e.preventDefault();
    ja(null);
    if (Oa === null || Oa === t) {
      return;
    }
    let n = [...an];
    let [r] = n.splice(Oa, 1);
    n.splice(t, 0, r);
    _a(n);
  };
  let [Ia, La] = G.useState(null);
  let Ra = (e, t) => {
    t.stopPropagation();
    if (Ia === e) {
      _a(an.filter(t => {
        return t.id !== e;
      }));
      if (sn?.id === e) {
        ln(null);
      }
      La(null);
    } else {
      La(e);
      setTimeout(() => {
        return La(null);
      }, 3000);
    }
  };
  let za = async e => {
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
    Be(e => {
      return e.map(n);
    });
    z(e => {
      return e.map(n);
    });
    await Vr(e, t);
  };
  let Ba = async () => {
    if (confirm(`确定清空当前页签下所有未收藏的资源吗？（收藏的资源保留，本地文件将被删除）`)) {
      await Ur(fe === `generated` ? `tasks` : `migrated`, true);
      ct(e => {
        return e + 1;
      });
      eo.current?.();
      $(`已清空未收藏资源`);
    }
  };
  G.useEffect(() => {
    let e = async e => {
      if (H !== `transit`) {
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
                  Va(t, `image`);
                }
              };
              t.readAsDataURL(e);
            }
          } else if (n.type === `text/plain`) {
            n.getAsString(e => {
              if (e) {
                Va(e, `text`);
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
  }, [H, L]);
  let Va = (e, t, n = `pasted`) => {
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
    z(e => {
      return [a, ...e];
    });
    if (i) {
      ct(e => {
        return e + 1;
      });
      return;
    }
    Br({
      ...a
    }).then(() => {
      return ct(e => {
        return e + 1;
      });
    });
  };
  let Ha = async e => {
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
  let Ua = async e => {
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
  let Wa = e => {
    Hr(e).catch(e => {
      return console.error(`delete resource failed:`, e);
    });
    Be(t => {
      return t.filter(t => {
        return t.id !== e;
      });
    });
    z(t => {
      return t.filter(t => {
        return t.id !== e;
      });
    });
    He(e => {
      return Math.max(0, e - 1);
    });
  };
  let Ga = () => {
    if (!Vi.trim()) {
      return;
    }
    let e = {
      id: `proj-${Date.now()}`,
      name: Vi
    };
    let t = [...Ii, e];
    Li(t);
    Ri(e.id);
    Hi(``);
    Bi(false);
    B.setObject(V.PROJECTS, t);
  };
  let Ka = () => {
    let e = Ii.find(e => {
      return e.id === Z;
    });
    if (e) {
      Ki(e.name);
      Wi(true);
    }
  };
  let qa = () => {
    let e = Gi.trim();
    if (!e) {
      $(`应用名称不能为空`);
      return;
    }
    let t = Ii.map(t => {
      if (t.id === Z) {
        return {
          ...t,
          name: e
        };
      } else {
        return t;
      }
    });
    Li(t);
    B.setObject(V.PROJECTS, t);
    Wi(false);
    Ki(``);
    $(`应用名称已更新`);
  };
  let Ja = e => {
    if (Ii.length <= 1) {
      $(`至少保留一个项目`);
      return;
    }
    if (confirm(`确定删除此项目吗？`)) {
      let t = Ii.filter(t => {
        return t.id !== e;
      });
      Li(t);
      if (Z === e) {
        Ri(t[0].id);
      }
      B.setObject(V.PROJECTS, t);
      jt.default.removeItem(`canvas-state-v1-${e}`).catch(console.error);
    }
  };
  let Ya = e => {
    e.id ||= Date.now().toString();
    let t = [...ri, e];
    ii(t);
    B.setObject(V.CUSTOM_NODE_TEMPLATES, t);
    $(`已保存为自定义节点`);
  };
  let Xa = e => {
    if (confirm(`确定要删除这个自定义节点模板吗？`)) {
      let t = ri.filter(t => {
        return t.id !== e;
      });
      ii(t);
      B.setObject(V.CUSTOM_NODE_TEMPLATES, t);
      $(`已删除自定义节点`);
    }
  };
  let Za = e => {
    d(t => {
      let n = e(t);
      it(t, n).catch(e => {
        return console.error(`Failed to persist global tasks:`, e);
      });
      return n;
    });
  };
  let {
    handleRefreshTask: Qa
  } = Ft({
    isLoaded: pa,
    globalTasks: u,
    handleUpdateGlobalTasks: Za,
    showToastMessage: $,
    localPort: r.status.port,
    localToolConnected: r.status.isConnected,
    sd2VideoApiUrl: er,
    sd2VideoApiKey: nr,
    videoApiUrl: Kn,
    videoApiKey: Jn,
    discountVideoApiUrl: or,
    discountVideoApiKey: ur,
    aiAppApiUrl: mr,
    aiAppApiKey: _r
  });
  let $a = e => {
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
  let eo = G.useRef(Dt);
  eo.current = Dt;
  G.useEffect(() => {
    Ct.current = u;
  }, [u]);
  G.useEffect(() => {
    (async () => {
      if (St.current) {
        console.log(`[统一同步] 正在同步中，跳过此次触发`);
        return;
      }
      St.current = true;
      try {
        let e = Ct.current;
        if (e.length > 0 && r.status.port) {
          let t = [];
          await Promise.all(e.map(async e => {
            if (e.status !== `completed`) {
              return;
            }
            let n = async (t, n, i) => {
              if (!t || typeof t != `string`) {
                return t;
              }
              let a = /:\d+\/files\//.test(t);
              if (a && /\/files\/tasks(\/|$)/.test(t)) {
                return t;
              }
              try {
                if (!a && t.startsWith(`http`) || t.startsWith(`data:`) || t.startsWith(`blob:`)) {
                  let a = null;
                  if (t.startsWith(`http`)) {
                    a = t;
                  } else {
                    a = await (await fetch(t)).blob();
                  }
                  let o = n === `image` ? `png` : n === `video` ? `mp4` : `mp3`;
                  let s = e.createdAt && Number.isFinite(e.createdAt) ? e.createdAt : Date.now();
                  let c = `${i}_${e.id.substring(0, 8)}_${s}.${o}`;
                  return (await r.uploadFile(a, c, `tasks`)).url;
                }
              } catch (e) {
                console.error(`Failed to sync to local tool:`, e);
              }
              return t;
            };
            let i = e.resultUrl;
            let a = e.thumbnailUrl;
            let o = e.customResultData;
            let s = false;
            if (e.type === `custom` && e.customResultData && typeof e.customResultData == `string`) {
              if (e.customOutputType === `image` || e.customOutputType === `video` || e.customOutputType === `audio`) {
                let t = await n(e.customResultData, e.customOutputType, e.customOutputType);
                if (t !== e.customResultData) {
                  o = t;
                  s = true;
                }
              }
            } else if (e.resultUrl) {
              let t = e.type === `image` ? `image` : e.type === `video` || e.type === `sd2Video` || e.type === `discountVideo` ? `video` : `text`;
              if (t === `image` || t === `video`) {
                let r = await n(e.resultUrl, t, t);
                if (r !== e.resultUrl) {
                  i = r;
                  s = true;
                }
              }
            }
            if (e.thumbnailUrl) {
              let t = await n(e.thumbnailUrl, `image`, `thumb`);
              if (t !== e.thumbnailUrl) {
                a = t;
                s = true;
              }
            }
            if (s) {
              t.push({
                id: e.id,
                taskId: e.taskId,
                resultUrl: i,
                thumbnailUrl: a,
                customResultData: o,
                nodeId: e.nodeId,
                type: e.type,
                customOutputType: e.customOutputType,
                status: e.status,
                errorMsg: e.errorMsg
              });
            }
          }));
          if (t.length > 0) {
            d(n => {
              let r = false;
              let i = n.map(n => {
                let i = t.find(e => {
                  return wt(n, {
                    id: e.id,
                    taskId: e.taskId
                  });
                });
                if (!i) {
                  return n;
                }
                let a = {};
                if (i.resultUrl && i.resultUrl !== n.resultUrl && (!n.resultUrl || n.resultUrl === e.find(e => {
                  return e.id === i.id || e.taskId === i.taskId;
                })?.resultUrl || /\/files\/tasks(\/|$)/.test(i.resultUrl))) {
                  a.resultUrl = i.resultUrl;
                }
                if (i.thumbnailUrl && i.thumbnailUrl !== n.thumbnailUrl) {
                  a.thumbnailUrl = i.thumbnailUrl;
                }
                if (i.customResultData !== undefined && i.customResultData !== n.customResultData) {
                  a.customResultData = i.customResultData;
                }
                if (Object.keys(a).length === 0) {
                  return n;
                } else {
                  r = true;
                  return {
                    ...n,
                    ...a
                  };
                }
              });
              if (r) {
                it(n, i).catch(e => {
                  return console.error(`Failed to persist global tasks:`, e);
                });
                return i;
              } else {
                return n;
              }
            });
            t.forEach(e => {
              if (!e.nodeId) {
                return;
              }
              let t = e.type === `custom` ? e.customResultData : e.resultUrl;
              window.dispatchEvent(new CustomEvent(`mutiwindow-task-completed`, {
                detail: {
                  taskId: e.id,
                  nodeId: e.nodeId,
                  resultUrl: t,
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
        await eo.current();
      } finally {
        St.current = false;
      }
    })();
  }, [u, r.status.isConnected, r.status.port]);
  let to = G.useCallback(async (e = false) => {
    if (!e) {
      $(`正在同步本地文件夹...`);
    }
    try {
      await Dt();
      if (!e) {
        $(`同步成功`);
      }
    } catch {
      if (!e) {
        $(`同步失败`);
      }
    }
  }, [Dt, $]);
  G.useEffect(() => {
    if (H === `transit`) {
      to(true);
    }
  }, [H, to]);
  let no = (e, t, n) => {
    let r = [...Q];
    r[e] = {
      ...r[e],
      [t]: n
    };
    ia(r);
  };
  let ro = () => {
    ia([...Q, {
      title: `新预设`,
      prompt: ``,
      type: `all`,
      enabled: true
    }]);
  };
  let io = e => {
    ia(Q.filter((t, n) => {
      return n !== e;
    }));
  };
  G.useEffect(() => {}, [oi, ci, ui, gi, pa, g, Te, X]);
  let ao = async () => {
    $(`开始同步数据到本地引擎...`);
    try {
      let e = {
        defaultTextModel: Ln,
        defaultDrawingModel: Wn,
        defaultVideoModel: Xn,
        defaultAudioModel: Cr,
        defaultSd2VideoModel: ir,
        textApiConfigId: oi,
        imageApiConfigId: ci,
        videoApiConfigId: ui,
        sd2VideoApiConfigId: fi,
        audioApiConfigId: gi,
        videoDurations: Qn,
        globalPollingInterval: Mr,
        globalMaxPollingDuration: Pr,
        globalSyncTimeout: Lr,
        transitGridCols: Te,
        sd2Token: g
      };
      let t = await B.setObject(V.APP_SETTINGS, e);
      console.log(`[syncAllToLocalTool] app_settings 保存结果:`, t);
      if (!t) {
        $(`⚠️ app_settings 保存失败，请检查本地引擎连接`);
        return;
      }
      await B.setObject(V.PROJECTS, Ii);
      await B.setObject(V.USERS, an);
      await B.setObject(V.API_CONFIGS, X.filter(e => {
        return !e.readonly;
      }));
      await B.setObject(V.PRESET_PROMPTS, Q);
      await B.setObject(V.CUSTOM_NODE_TEMPLATES, ri);
      await B.setObject(V.CLOUD_STORAGE_CONFIG, f);
      let n = 0;
      for (let e of Ii) {
        let t = Pe(e.id);
        let r = null;
        let i = await jt.default.getItem(t);
        if (i) {
          r = i;
          if (await B.setObject(t, i)) {
            n++;
          }
        } else {
          let e = localStorage.getItem(t);
          if (e) {
            r = JSON.parse(e);
            if (await B.setObject(t, r)) {
              n++;
            }
          }
        }
        if (r && r.nodes) {
          for (let e of r.nodes) {
            if (e.data && e.data.imageUrlRef) {
              let t = e.data.imageUrlRef;
              let r = await jt.default.getItem(t);
              if (r) {
                await B.setObject(t, r);
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
  let oo = async () => {
    try {
      let e = {
        localforage: {},
        kvStore: {}
      };
      for (let t of [`users`, `membership`, `old_membership`, `projects`, `lastOpenedProject`, `app_settings`, `presetPrompts`, `customNodeTemplates`, `cloud_storage_config`, `api_configs`]) {
        let n = await B.getObject(t);
        if (n !== null) {
          e.kvStore[t] = n;
        }
      }
      try {
        let t = await jt.default.keys();
        for (let n of t) {
          if (!n.startsWith(`img_`) && n !== `transitResources`) {
            let t = await jt.default.getItem(n);
            if (t !== null) {
              e.localforage[n] = t;
            }
          }
        }
      } catch (e) {
        console.error(`Failed to export localforage data:`, e);
      }
      let t = await B.getConfig(`app_settings`);
      if (t) {
        let n = typeof t == `string` ? JSON.parse(t) : t;
        e.kvStore.app_settings = n;
      }
      let n = e.kvStore.projects || [];
      for (let t of n) {
        let n = await B.getObject(Pe(t.id));
        if (n !== null) {
          e.kvStore[Pe(t.id)] = n;
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
  let so = e => {
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
            a[V.USERS] = t.users;
          }
          if (t.projects) {
            a[V.PROJECTS] = t.projects;
          }
          if (t.presetPrompts) {
            a[V.PRESET_PROMPTS] = t.presetPrompts;
          }
          if (t.customNodeTemplates) {
            a[V.CUSTOM_NODE_TEMPLATES] = t.customNodeTemplates;
          }
          if (t.membership) {
            a[V.MEMBERSHIP] = t.membership;
          }
          if (t.cloudStorageConfig) {
            a[V.CLOUD_STORAGE_CONFIG] = t.cloudStorageConfig;
          }
          if (t.lastOpenedProject) {
            a[V.LAST_OPENED_PROJECT] = t.lastOpenedProject;
          }
          if (t.apiConfigs) {
            a[V.API_CONFIGS] = t.apiConfigs;
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
            a[V.APP_SETTINGS] = e;
          }
          i = t.localforage || {};
          if (t.transitResources) {
            i[V.TRANSIT_RESOURCES] = t.transitResources;
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
            await jt.default.setItem(e, i[e]);
          }
        }
        if (r.status.isConnected && Object.keys(a).length > 0) {
          $(`正在恢复本地引擎配置...`);
          for (let e of Object.keys(a)) {
            await B.setObject(e, a[e]);
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
  _cmp_It({
    importData: so,
    exportData: oo
  });
  if (S) {
    const Component721 = `div`;
    return <Component721 className={`flex items-center justify-center h-screen`}>{`Loading...`}</Component721>;
  } else {
    const Component722 = `path`;
    const Component723 = `svg`;
    const Component724 = `span`;
    const Component725 = `button`;
    const Component726 = `div`;
    const Component727 = `div`;
    const Component728 = `button`;
    const Component729 = `button`;
    const Component730 = `button`;
    const Component731 = `button`;
    const Component732 = `div`;
    const Component733 = `span`;
    const Component734 = `div`;
    const Component735 = `div`;
    const Component736 = `div`;
    const Component737 = `span`;
    const Component738 = `div`;
    const Component739 = `div`;
    const Component740 = `div`;
    const Component741 = `div`;
    const Component742 = `line`;
    const Component743 = `line`;
    const Component744 = `svg`;
    const Component745 = `button`;
    const Component746 = `button`;
    const Component747 = `button`;
    const Component748 = `div`;
    const Component749 = `button`;
    const Component750 = `div`;
    const Component751 = `div`;
    const Component752 = `div`;
    const Component753 = `div`;
    const Component754 = `span`;
    const Component755 = `span`;
    const Component756 = `span`;
    const Component757 = `path`;
    const Component758 = `svg`;
    const Component759 = `span`;
    const Component760 = `span`;
    const Component761 = `span`;
    const Component762 = `div`;
    const Component763 = `span`;
    const Component764 = `span`;
    const Component765 = `div`;
    const Component766 = `div`;
    const Component767 = `button`;
    const Component768 = `button`;
    const Component769 = `button`;
    const Component770 = `div`;
    const Component771 = `div`;
    const Component772 = `div`;
    const Component773 = `img`;
    const Component774 = `span`;
    const Component775 = `button`;
    const Component776 = `img`;
    const Component777 = `span`;
    const Component778 = `span`;
    const Component779 = `span`;
    const Component780 = `span`;
    const Component781 = `span`;
    const Component782 = `div`;
    const Component783 = `div`;
    const Component784 = `div`;
    const Component785 = `span`;
    const Component786 = `span`;
    const Component787 = `div`;
    const Component788 = `button`;
    const Component789 = `div`;
    const Component790 = `div`;
    const Component791 = `button`;
    const Component792 = `button`;
    const Component793 = `div`;
    const Component794 = `button`;
    const Component795 = `div`;
    const Component796 = `path`;
    const Component797 = `polyline`;
    const Component798 = `line`;
    const Component799 = `svg`;
    const Component800 = `button`;
    const Component801 = `div`;
    const Component802 = `div`;
    const Component803 = `div`;
    const Component804 = `button`;
    const Component805 = `circle`;
    const Component806 = `polyline`;
    const Component807 = `svg`;
    const Component808 = `span`;
    const Component809 = `button`;
    const Component810 = `div`;
    const Component811 = `div`;
    const Component812 = `video`;
    const Component813 = `div`;
    const Component814 = `path`;
    const Component815 = `circle`;
    const Component816 = `circle`;
    const Component817 = `svg`;
    const Component818 = `audio`;
    const Component819 = `div`;
    const Component820 = `img`;
    const Component821 = `button`;
    const Component822 = `div`;
    const Component823 = `h3`;
    const Component824 = `button`;
    const Component825 = `div`;
    const Component826 = `input`;
    const Component827 = `button`;
    const Component828 = `div`;
    const Component829 = `textarea`;
    const Component830 = `div`;
    const Component831 = `p`;
    const Component832 = `div`;
    const Component833 = `div`;
    const Component834 = `a`;
    const Component835 = `div`;
    const Component836 = `div`;
    const Component837 = `div`;
    const Component838 = `div`;
    const Component839 = `div`;
    const Component840 = `img`;
    const Component841 = `div`;
    const Component842 = `span`;
    const Component843 = `div`;
    const Component844 = `circle`;
    const Component845 = `circle`;
    const Component846 = `circle`;
    const Component847 = `svg`;
    const Component848 = `button`;
    const Component849 = `button`;
    const Component850 = `button`;
    const Component851 = `button`;
    const Component852 = `div`;
    const Component853 = `button`;
    const Component854 = `div`;
    const Component855 = `div`;
    const Component856 = `div`;
    const Component857 = `div`;
    const Component858 = `div`;
    const Component859 = `div`;
    const Component860 = `div`;
    const Component861 = `div`;
    const Component862 = `div`;
    const Component863 = `span`;
    const Component864 = `polyline`;
    const Component865 = `svg`;
    const Component866 = `line`;
    const Component867 = `line`;
    const Component868 = `svg`;
    const Component869 = `span`;
    const Component870 = `div`;
    const Component871 = `div`;
    const Component872 = `div`;
    const Component873 = `h3`;
    const Component874 = `input`;
    const Component875 = `button`;
    const Component876 = `button`;
    const Component877 = `div`;
    const Component878 = `div`;
    const Component879 = `div`;
    const Component880 = `h3`;
    const Component881 = `input`;
    const Component882 = `button`;
    const Component883 = `button`;
    const Component884 = `div`;
    const Component885 = `div`;
    const Component886 = `div`;
    const Component887 = `div`;
    const Component888 = `div`;
    const Component889 = `div`;
    const Component890 = `button`;
    const Component891 = `button`;
    const Component892 = `button`;
    const Component893 = `button`;
    const Component894 = `div`;
    const Component895 = `span`;
    const Component896 = `span`;
    const Component897 = `h2`;
    const Component898 = `button`;
    const Component899 = `div`;
    const Component900 = `input`;
    const Component901 = `div`;
    const Component902 = `input`;
    const Component903 = `option`;
    const Component904 = `option`;
    const Component905 = `option`;
    const Component906 = `option`;
    const Component907 = `select`;
    const Component908 = `div`;
    const Component909 = `textarea`;
    const Component910 = `div`;
    const Component911 = `button`;
    const Component912 = `div`;
    const Component913 = `div`;
    const Component914 = `div`;
    const Component915 = `div`;
    const Component916 = `div`;
    const Component917 = `div`;
    const Component918 = `span`;
    const Component919 = `a`;
    const Component920 = `h2`;
    const Component921 = `button`;
    const Component922 = `div`;
    const Component923 = `div`;
    const Component934 = `button`;
    const Component935 = `div`;
    const Component936 = `div`;
    const Component937 = `span`;
    const Component938 = `h2`;
    const Component939 = `option`;
    const Component940 = `select`;
    const Component941 = `div`;
    const Component942 = `div`;
    const Component943 = `label`;
    const Component944 = `textarea`;
    const Component945 = `div`;
    const Component946 = `div`;
    const Component947 = `span`;
    const Component948 = `h2`;
    const Component949 = `option`;
    const Component950 = `select`;
    const Component951 = `div`;
    const Component952 = `div`;
    const Component953 = `label`;
    const Component954 = `textarea`;
    const Component955 = `div`;
    const Component956 = `div`;
    const Component957 = `span`;
    const Component958 = `h2`;
    const Component959 = `div`;
    const Component960 = `span`;
    const Component961 = `h3`;
    const Component962 = `option`;
    const Component963 = `select`;
    const Component964 = `div`;
    const Component965 = `textarea`;
    const Component966 = `div`;
    const Component967 = `div`;
    const Component968 = `div`;
    const Component969 = `label`;
    const Component970 = `textarea`;
    const Component971 = `div`;
    const Component972 = `div`;
    const Component973 = `div`;
    const Component974 = `span`;
    const Component975 = `h2`;
    const Component976 = `option`;
    const Component977 = `select`;
    const Component978 = `div`;
    const Component979 = `div`;
    const Component980 = `label`;
    const Component981 = `textarea`;
    const Component982 = `div`;
    const Component983 = `div`;
    const Component984 = `div`;
    const Component985 = `span`;
    const Component986 = `h2`;
    const Component987 = `div`;
    const Component988 = `strong`;
    const Component989 = `br`;
    const Component990 = `span`;
    const Component991 = `br`;
    const Component992 = `span`;
    const Component993 = `br`;
    const Component994 = `span`;
    const Component995 = `p`;
    const Component996 = `span`;
    const Component997 = `button`;
    const Component998 = `span`;
    const Component999 = `button`;
    const Component1000 = `span`;
    const Component1001 = `input`;
    const Component1002 = `label`;
    const Component1003 = `div`;
    const Component1004 = `div`;
    const Component1005 = `div`;
    const Component1006 = `span`;
    const Component1007 = `h2`;
    const Component1008 = `div`;
    const Component1009 = `label`;
    const Component1010 = `input`;
    const Component1011 = `span`;
    const Component1012 = `div`;
    const Component1013 = `label`;
    const Component1014 = `input`;
    const Component1015 = `span`;
    const Component1016 = `div`;
    const Component1017 = `label`;
    const Component1018 = `input`;
    const Component1019 = `span`;
    const Component1020 = `div`;
    const Component1021 = `div`;
    const Component1022 = `div`;
    const Component1023 = `div`;
    const Component1024 = `span`;
    const Component1025 = `h2`;
    const Component1026 = `div`;
    const Component1027 = `span`;
    const Component1028 = `span`;
    const Component1029 = `div`;
    const Component1030 = `span`;
    const Component1031 = `button`;
    const Component1032 = `div`;
    const Component1033 = `span`;
    const Component1034 = `span`;
    const Component1035 = `div`;
    const Component1036 = `span`;
    const Component1037 = `button`;
    const Component1038 = `div`;
    const Component1039 = `span`;
    const Component1040 = `span`;
    const Component1041 = `div`;
    const Component1042 = `span`;
    const Component1043 = `button`;
    const Component1044 = `div`;
    const Component1045 = `p`;
    const Component1046 = `div`;
    const Component1047 = `div`;
    const Component1048 = `span`;
    const Component1049 = `h2`;
    const Component1050 = `button`;
    const Component1051 = `div`;
    const Component1052 = `button`;
    const Component1053 = `h3`;
    const Component1054 = `p`;
    const Component1055 = `textarea`;
    const Component1056 = `button`;
    const Component1057 = `button`;
    const Component1058 = `div`;
    const Component1059 = `div`;
    const Component1060 = `p`;
    const Component1061 = `label`;
    const Component1062 = `input`;
    const Component1063 = `div`;
    const Component1064 = `label`;
    const Component1065 = `input`;
    const Component1066 = `div`;
    const Component1067 = `label`;
    const Component1068 = `input`;
    const Component1069 = `div`;
    const Component1070 = `label`;
    const Component1071 = `input`;
    const Component1072 = `div`;
    const Component1073 = `label`;
    const Component1074 = `input`;
    const Component1075 = `p`;
    const Component1076 = `div`;
    const Component1077 = `div`;
    const Component1078 = `div`;
    const Component1079 = `div`;
    const Component1080 = `div`;
    const Component1081 = `div`;
    const Component1082 = `div`;
    const Component1083 = `div`;
    const Component1084 = `div`;
    const Component1085 = `div`;
    const Component1086 = `div`;
    const Component1087 = `div`;
    const Component1088 = `h3`;
    const Component1089 = `button`;
    const Component1090 = `div`;
    const Component1091 = `span`;
    const Component1092 = `span`;
    const Component1093 = `p`;
    const Component1094 = `div`;
    const Component1095 = `span`;
    const Component1096 = `span`;
    const Component1097 = `p`;
    const Component1098 = `div`;
    const Component1099 = `div`;
    const Component1100 = `span`;
    const Component1101 = `span`;
    const Component1102 = `br`;
    const Component1103 = `br`;
    const Component1104 = `p`;
    const Component1105 = `div`;
    const Component1106 = `div`;
    const Component1107 = `span`;
    const Component1108 = `span`;
    const Component1109 = `br`;
    const Component1110 = `br`;
    const Component1111 = `p`;
    const Component1112 = `div`;
    const Component1113 = `div`;
    const Component1114 = `span`;
    const Component1115 = `span`;
    const Component1116 = `p`;
    const Component1117 = `div`;
    const Component1118 = `div`;
    const Component1119 = `span`;
    const Component1120 = `span`;
    const Component1121 = `p`;
    const Component1122 = `div`;
    const Component1123 = `div`;
    const Component1124 = `div`;
    const Component1125 = `p`;
    const Component1126 = `div`;
    const Component1127 = `button`;
    const Component1128 = `button`;
    const Component1129 = `div`;
    const Component1130 = `div`;
    const Component1131 = `div`;
    const Component1132 = `button`;
    const Component1133 = `path`;
    const Component1134 = `svg`;
    const Component1135 = `span`;
    const Component1136 = `div`;
    const Component1137 = `p`;
    const Component1138 = `div`;
    const Component1139 = `div`;
    const Component1140 = `div`;
    const Component1141 = `div`;
    const Component1142 = `div`;
    const Component1143 = `div`;
    return <Component1143 className={`flex h-screen bg-[#0d0c0c] flex-col font-sans text-gray-200`}>
        <_cmp_Fr isVisible={ut} onClose={() => {
        dt(false);
        mt(true);
      }} onRetry={() => {
        r.checkConnection();
      }} />
        <Component811 className={`bg-[#0d0c0c] flex items-center justify-between px-4 relative z-20 flex-shrink-0 h-16 pt-2 pb-2`}>
          <Component753 className={`flex items-center gap-6`}>
            <Component727 className={`flex items-center gap-2 cursor-pointer relative group/logo`} onClick={() => {
            return U(`canvas`);
          }} title={`返回画布`}>
              <Component723 viewBox={`0 0 20.7624 28.8621`} xmlns={`http://www.w3.org/2000/svg`} xmlnsXlink={`http://www.w3.org/1999/xlink`} width={`24`} height={`24`} fill={`none`}>
                <Component722 d={`M20.7624 0C0.868225 2.29614 0.393066 20.877 0 28.8621L1.21155 28.8621C1.21155 21.9207 4.94049 21.4546 8.42853 20.6113C13.6559 19.3462 17.0903 14.3184 17.95 10.2493L15.8051 9.17358L16.9758 7.71509C18.1466 6.25684 19.2449 4.14502 20.7624 0L20.7624 0Z`} fill={`rgb(210,2,7)`} fillRule={`evenodd`} />
              </Component723>
              <Component724 className={`text-white font-bold text-lg italic tracking-wider`}>{`一毛AI`}</Component724>
              <Component726 className={`absolute left-0 top-full mt-2 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl opacity-0 invisible group-hover/logo:opacity-100 group-hover/logo:visible transition-all duration-300 delay-500 z-50 overflow-hidden whitespace-nowrap p-1`}>
                <Component725 onClick={e => {
                e.stopPropagation();
                window.open(lt(), `_blank`);
              }} className={`text-sm text-gray-300 hover:text-white hover:bg-[#333] px-3 py-2 rounded-md flex items-center gap-2`}>{`访问官网 (1mao.cc)`}</Component725>
              </Component726>
            </Component727>
            <Component732 className={`flex items-center bg-[#151414] rounded-full p-1`}>
              <Component728 onClick={() => {
              return U(`canvas`);
            }} className={`px-5 py-1.5 text-sm font-medium rounded-full transition-colors ${H === `canvas` ? `bg-white text-black` : `text-gray-400 hover:text-gray-200`}`}>{`画布`}</Component728>
              <Component729 onClick={() => {
              return U(`transit`);
            }} className={`px-5 py-1.5 text-sm font-medium rounded-full transition-colors ${H === `transit` ? `bg-white text-black` : `text-gray-400 hover:text-gray-200`}`}>{`资源`}</Component729>
              <Component730 onClick={() => {
              return U(`accounts`);
            }} className={`px-5 py-1.5 text-sm font-medium rounded-full transition-colors ${H === `accounts` ? `bg-white text-black` : `text-gray-400 hover:text-gray-200`}`}>{`多开`}</Component730>
              <Component731 onClick={() => {
              return U(`appcenter`);
            }} className={`px-5 py-1.5 text-sm font-medium rounded-full transition-colors ${H === `appcenter` ? `bg-white text-black` : `text-gray-400 hover:text-gray-200`}`}>{`AI小站`}</Component731>
            </Component732>
            {H === `canvas` && <Component752 className={`flex items-center gap-1 group/project-selector relative`}>
                <Component741 className={`relative group/project-dropdown cursor-pointer`}>
                  <Component734 className={`flex items-center gap-1 bg-transparent text-gray-300 text-sm hover:text-white pl-2 pr-2 py-1 outline-none min-w-[100px] pb-1.5 z-10 relative`}>
                    <Component733 className={`truncate max-w-[120px]`}>
                      {Ii.find(e => {
                    return e.id === Z;
                  })?.name || `选择项目`}
                    </Component733>
                    <_Component17 size={14} className={`text-gray-500 group-hover/project-dropdown:text-white transition-colors`} />
                  </Component734>
                  <Component735 className={`absolute bottom-0 left-2 right-2 h-[2px] bg-white/10 group-hover/project-dropdown:bg-white transition-colors pointer-events-none rounded-full`} />
                  <Component740 className={`absolute left-0 top-full mt-2 w-80 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl opacity-0 invisible group-hover/project-dropdown:opacity-100 group-hover/project-dropdown:visible transition-all duration-200 z-[100] overflow-hidden`}>
                    <Component739 className={`grid grid-cols-2 gap-1 max-h-[420px] overflow-y-auto p-1 custom-scrollbar`}>
                      {Ii.map(e => {
                    return <Component738 onClick={() => {
                      return Ri(e.id);
                    }} className={`px-2.5 py-2 text-sm cursor-pointer flex items-center gap-2 rounded-lg hover:bg-[#333] transition-colors ${e.id === Z ? `text-white bg-[#222]` : `text-gray-400`}`} key={e.id}>
                            <Component736 className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${e.id === Z ? `bg-green-500` : `bg-transparent`}`} />
                            <Component737 className={`truncate`}>{e.name}</Component737>
                          </Component738>;
                  })}
                    </Component739>
                  </Component740>
                </Component741>
                <Component745 onClick={() => {
              return Bi(true);
            }} className={`text-gray-400 hover:text-white transition-colors p-1 ml-1`} title={`新建项目`}>
                  <Component744 width={`18`} height={`18`} viewBox={`0 0 24 24`} fill={`none`} stroke={`currentColor`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                    <Component742 x1={`12`} y1={`5`} x2={`12`} y2={`19`} />
                    <Component743 x1={`5`} y1={`12`} x2={`19`} y2={`12`} />
                  </Component744>
                </Component745>
                <Component751 className={`relative group/project-menu -ml-1 z-10`}>
                  <Component746 className={`text-gray-500 hover:text-white transition-colors p-1 flex items-center justify-center`}>
                    <_Component32 size={16} />
                  </Component746>
                  <Component750 className={`absolute left-0 top-full mt-2 w-40 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl opacity-0 invisible group-hover/project-menu:opacity-100 group-hover/project-menu:visible transition-all duration-200 z-[100] overflow-hidden py-1`}>
                    <Component747 onClick={Ka} className={`w-full text-left px-3 py-2.5 text-sm text-gray-300 hover:bg-[#333] hover:text-white flex items-center gap-2`}>
                      <_Component21 size={14} />
                      {` 重命名`}
                    </Component747>
                    {Ii.length > 1 && <K.Fragment>
                        <Component748 className={`h-[1px] bg-[#333] my-1 mx-2`} />
                        <Component749 onClick={() => {
                    return Ja(Z);
                  }} className={`w-full text-left px-3 py-2.5 text-sm text-red-400 hover:bg-[#333] hover:text-red-300 flex items-center gap-2`}>
                          <P size={14} />
                          {` 删除项目`}
                        </Component749>
                      </K.Fragment>}
                    {false}
                  </Component750>
                </Component751>
              </Component752>}
          </Component753>
          <Component810 className={`flex items-center gap-4`}>
            {J && Y && <Component772 className={`relative group/balance flex items-center gap-2 text-[13px] font-medium bg-[#151414] px-3 py-1.5 rounded-full border border-[#333] cursor-pointer`}>
                <Component755 className={`text-white flex items-center gap-1`}>
                  {Y.balance.totalBalance.toFixed(2)}
                  {` `}
                  <Component754 className={`text-yellow-500`}>{`⚡`}</Component754>
                </Component755>
                <Component756 className={`text-gray-600`}>{`/`}</Component756>
                <Component759 className={`text-gray-300 flex items-center gap-1`}>
                  {Y.proxyBalance.totalBalance.toFixed(2)}
                  <Component758 className={`inline-block w-[1em] h-[1em] align-middle text-yellow-400 ml-0.5`} viewBox={`0 0 1024 1024`} xmlns={`http://www.w3.org/2000/svg`} fill={`currentColor`} aria-hidden={`true`}>
                    <Component757 d={`M836.152889 224.009481a75.851852 75.851852 0 0 1 75.851852 75.851852v116.129186a96.009481 96.009481 0 0 0 0 192v116.167111a75.851852 75.851852 0 0 1-75.851852 75.851851H187.847111a75.851852 75.851852 0 0 1-75.851852-75.851851v-116.167111a96.009481 96.009481 0 0 0 0-191.981038v-116.148148a75.851852 75.851852 0 0 1 75.851852-75.851852h648.305778z m-383.469037 138.733038a24.007111 24.007111 0 0 0-33.943704 33.943703l51.313778 51.313778h-46.061037a24.007111 24.007111 0 1 0 0 47.995259h64v32.009482h-64a24.007111 24.007111 0 1 0 0 47.995259h64v80.004741a24.007111 24.007111 0 1 0 48.014222 0l-0.018963-80.023704 64.018963 0.018963a24.007111 24.007111 0 1 0 0-47.995259h-64.018963v-32.009482h64.018963a24.007111 24.007111 0 1 0 0-47.995259h-46.08l51.332741-51.313778 1.744592-1.953185a24.007111 24.007111 0 0 0-35.688296-31.990518l-56.566518 56.566518-1.744593 1.953185-0.986074 1.365334a24.139852 24.139852 0 0 0-2.768593-3.318519z`} />
                  </Component758>
                </Component759>
                <Component771 className={`absolute right-0 top-full mt-2 w-48 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl opacity-0 invisible group-hover/balance:opacity-100 group-hover/balance:visible transition-all duration-200 z-50 overflow-hidden`}>
                  <Component766 className={`p-3 space-y-2 text-sm text-gray-300 border-b border-[#333]`}>
                    <Component762 className={`flex justify-between items-center`}>
                      <Component760>{`算力余额：`}</Component760>
                      <Component761 className={`font-bold text-white`}>
                        {Y.balance.totalBalance.toFixed(2)}
                      </Component761>
                    </Component762>
                    <Component765 className={`flex justify-between items-center`}>
                      <Component763>{`特惠币余额：`}</Component763>
                      <Component764 className={`font-bold text-white`}>
                        {Y.proxyBalance.totalBalance.toFixed(2)}
                      </Component764>
                    </Component765>
                  </Component766>
                  {Y.team?.role !== `MEMBER` && <Component767 onClick={() => {
                return window.open(lt(`/invite`), `_blank`);
              }} className={`w-full py-2 text-sm text-center text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 transition-colors border-b border-[#333]`}>{`邀好友 赚奖励`}</Component767>}
                  <Component770 className={`flex bg-[#222]`}>
                    {Y.team?.role !== `MEMBER` && <Component768 onClick={() => {
                  return window.open(lt(`/console/wallet`), `_blank`);
                }} className={`flex-1 py-2 text-sm font-bold text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors border-r border-[#333]`}>{`充值`}</Component768>}
                    <Component769 onClick={() => {
                  return window.open(lt(`/console/consumption`), `_blank`);
                }} className={`${Y.team?.role === `MEMBER` ? `w-full` : `flex-1`} py-2 text-sm text-gray-400 hover:text-white hover:bg-[#333] transition-colors`}>{`消费详情`}</Component769>
                  </Component770>
                </Component771>
              </Component772>}
            <Component803 className={`relative group/avatar`}>
              <Component775 type={`button`} onClick={() => {
              if (!J) {
                Gt(true);
              }
            }} className={`relative flex items-center justify-center font-bold transition-all border-2 border-transparent hover:border-gray-500 ${J ? `w-8 h-8 rounded-full text-sm bg-[#333]` : `h-8 px-3 rounded-full text-xs cursor-pointer bg-red-600/90 hover:bg-red-500`}`} title={J ? `用户信息` : `登录`}>
                {J && Y ? <Component773 src={Y.avatar || Xr} alt={`avatar`} className={`w-full h-full rounded-full object-cover`} onError={e => {
                e.currentTarget.src = Xr;
              }} /> : <Component774 className={`text-white flex items-center gap-1`}>
                    <_Component10 size={14} />
                    {` 未登录`}
                  </Component774>}
              </Component775>
              {J && Y && <Component802 className={`absolute right-0 top-full mt-2 w-64 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl opacity-0 invisible group-hover/avatar:opacity-100 group-hover/avatar:visible transition-all duration-200 z-[100] overflow-hidden flex flex-col`}>
                  <Component783 className={`p-4 border-b border-[#333] flex items-center gap-3`}>
                    <Component776 src={Y.avatar || Xr} alt={`avatar`} className={`w-10 h-10 rounded-full object-cover border border-[#444]`} onError={e => {
                  e.currentTarget.src = Xr;
                }} />
                    <Component782 className={`flex flex-col min-w-0`}>
                      <Component777 className={`text-white font-bold text-sm truncate`}>
                        {Y.nickname || Y.username || `一毛用户`}
                      </Component777>
                      <Component778 className={`text-gray-400 text-xs`}>
                        {Y.phone || `未绑定手机号`}
                      </Component778>
                      {Y.team?.enabled && <Component781 className={`mt-1 inline-flex items-center gap-1 text-xs`}>
                          {Y.team.role === `OWNER` ? <Component779 className={`inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-300`}>{`团队主账号`}</Component779> : <Component780 className={`inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-blue-300 truncate`}>
                              {`子账号 · 隶属 `}
                              {Y.team.ownerUsername}
                            </Component780>}
                        </Component781>}
                    </Component782>
                  </Component783>
                  <Component789 className={`p-2 border-b border-[#333]`}>
                    <Component784 className={`px-2 py-1 text-xs text-gray-500 font-bold`}>{`会员信息`}</Component784>
                    <Component787 className={`flex justify-between items-center px-2 py-1.5 text-sm text-gray-300`}>
                      <Component785 className={`flex items-center gap-1.5`}>
                        <_Component33 size={14} className={`text-yellow-500`} />
                        {xi.type}
                        {` 会员`}
                      </Component785>
                      {xi.type !== `FREE` && xi.expiry && <Component786 className={`text-xs text-gray-500`}>
                          {new Date(xi.expiry).toLocaleDateString()}
                          {` 到期`}
                        </Component786>}
                    </Component787>
                    {Y.team?.role !== `MEMBER` && <Component788 onClick={() => {
                  return window.open(lt(`/pricing`), `_blank`);
                }} className={`mt-2 w-full bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-white font-bold py-1.5 rounded-lg text-sm transition-all shadow-lg`}>{`开通 / 续费`}</Component788>}
                  </Component789>
                  <Component793 className={`p-2 border-b border-[#333]`}>
                    <Component790 className={`px-2 py-1 text-xs text-gray-500 font-bold`}>{`同步设置`}</Component790>
                    <Component791 onClick={Ta} disabled={Ca} className={`w-full text-left px-2 py-2 text-sm text-gray-300 hover:bg-[#333] hover:text-white rounded-md flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}>
                      {Ca ? <_Component25 size={14} className={`animate-spin`} /> : <_Component29 size={14} />}
                      {` 上传云端`}
                    </Component791>
                    <Component792 onClick={Ea} disabled={Ca} className={`w-full text-left px-2 py-2 text-sm text-gray-300 hover:bg-[#333] hover:text-white rounded-md flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}>
                      {Ca ? <_Component25 size={14} className={`animate-spin`} /> : <_Component6 size={14} />}
                      {` 从云端下载`}
                    </Component792>
                  </Component793>
                  <Component795 className={`p-2 border-b border-[#333]`}>
                    <Component794 onClick={() => {
                  return qt(true);
                }} className={`w-full text-left px-2 py-2 text-sm text-gray-300 hover:bg-[#333] hover:text-white rounded-md flex items-center gap-2 transition-colors`}>
                      <_Component1 size={14} />
                      {` 修改密码`}
                    </Component794>
                  </Component795>
                  <Component801 className={`p-2`}>
                    <Component800 onClick={Sa} className={`w-full text-left px-2 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-md flex items-center gap-2 transition-colors`}>
                      <Component799 width={`14`} height={`14`} viewBox={`0 0 24 24`} fill={`none`} stroke={`currentColor`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                        <Component796 d={`M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4`} />
                        <Component797 points={`16 17 21 12 16 7`} />
                        <Component798 x1={`21`} y1={`12`} x2={`9`} y2={`12`} />
                      </Component799>
                      {`退出登录`}
                    </Component800>
                  </Component801>
                </Component802>}
            </Component803>
            <Component804 onClick={() => {
            return U(`settings`);
          }} className={`relative text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-[#252525] ${H === `settings` ? `bg-[#252525] text-white` : ``}`} title={`设置`}>
              <_Component34 size={20} />
            </Component804>
            <Component809 onClick={() => {
            if (y) {
              x(false);
              return;
            }
            x(true);
          }} className={`relative text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-[#252525]`} title={`任务中心`}>
              <Component807 width={`20`} height={`20`} viewBox={`0 0 24 24`} fill={`none`} stroke={`currentColor`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                <Component805 cx={`12`} cy={`12`} r={`10`} />
                <Component806 points={`12 6 12 12 16 14`} />
              </Component807>
              {u.filter(e => {
              return e.status === `running` || e.status === `pending`;
            }).length > 0 && <Component808 className={`absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0d0c0c] animate-pulse`} />}
            </Component809>
          </Component810>
        </Component811>
        <_cmp_Hn open={y} globalTasks={u} useThumbnail={Zr} onClose={() => {
        return x(false);
      }} onRefreshTask={Qa} onRerunTask={$a} onFullscreen={({
        url: e,
        type: t
      }) => {
        return N({
          url: e,
          type: t
        });
      }} setGlobalTasks={d} showToastMessage={$} />
        {Zi && <_cmp__Component35 open={Zi} projectId={Z} projectName={Ii.find(e => {
        return e.id === Z;
      })?.name || `默认项目`} existingAppId={Yi?.appId} onClose={() => {
        return Qi(false);
      }} onPublished={() => {
        Qi(false);
        ra();
      }} />}
        {$i && <_cmp__Component11 open={$i} onClose={() => {
        return ea(false);
      }} defaultAppId={Yi?.appId} />}
        {ta && <_cmp__Component36 open={ta} app={Yi} onClose={() => {
        return na(false);
      }} />}
        {M && <Component822 className={`fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-8 cursor-zoom-out animate-fade-in`} onClick={() => {
        return N(null);
      }}>
            {M.type === `video` ? <Component812 src={M.url} className={`max-w-full max-h-full object-contain shadow-2xl rounded-lg`} controls={true} autoPlay={true} onClick={e => {
          return e.stopPropagation();
        }} /> : M.type === `text` ? <Component813 className={`w-[80vw] h-[80vh] bg-[#1a1a1a] rounded-lg shadow-2xl border border-[#333] p-8 overflow-y-auto text-gray-200 whitespace-pre-wrap font-sans text-sm leading-relaxed`} onClick={e => {
          return e.stopPropagation();
        }}>
                <_cmp_Yr url={M.url} />
              </Component813> : M.type === `audio` ? <Component819 className={`bg-gradient-to-b from-[#1d2230] to-[#0e0f12] rounded-xl shadow-2xl border border-[#333] p-8 flex flex-col items-center gap-4`} onClick={e => {
          return e.stopPropagation();
        }}>
                <Component817 width={`48`} height={`48`} viewBox={`0 0 24 24`} fill={`none`} stroke={`#60a5fa`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                  <Component814 d={`M9 18V5l12-2v13`} />
                  <Component815 cx={`6`} cy={`18`} r={`3`} />
                  <Component816 cx={`18`} cy={`16`} r={`3`} />
                </Component817>
                <Component818 src={M.url} controls={true} autoPlay={true} className={`w-[420px] max-w-[80vw]`} />
              </Component819> : <Component820 src={M.url} className={`max-w-full max-h-full object-contain shadow-2xl rounded-lg`} onClick={e => {
          return e.stopPropagation();
        }} />}
            <Component821 className={`absolute top-4 right-4 text-white/50 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-colors`} onClick={() => {
          return N(null);
        }}>
              <_Component37 size={24} />
            </Component821>
          </Component822>}
        <_cmp_Qt controller={fa} />
        <Component1086 className={`flex-1 relative overflow-hidden bg-[#0d0c0c]`}>
          <Component861 className={`absolute inset-0 flex flex-col ${H === `accounts` ? `visible z-10` : `invisible -z-10`}`}>
            {dn && <Component833 className={`p-3 bg-[#151414] border-b border-[#333] shadow-sm`}>
                <Component832 className={`bg-[#252525] p-3 rounded-lg border border-[#333] animate-fade-in`}>
                  <Component825 className={`flex justify-between items-center mb-2`}>
                    <Component823 className={`text-sm font-bold text-gray-200`}>
                      {hn ? `修改环境` : `手动添加环境`}
                    </Component823>
                    <Component824 onClick={() => {
                  fn(false);
                  gn(null);
                  mn(``);
                  vn(``);
                }} className={`text-gray-500 hover:text-gray-300`}>{`✕`}</Component824>
                  </Component825>
                  <Component828 className={`flex gap-2`}>
                    <Component826 className={`flex-1 bg-[#1a1a1a] border border-[#333] rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500`} placeholder={`输入环境名称 (如:即梦小号)`} value={pn} onChange={e => {
                  return mn(e.target.value);
                }} autoFocus={true} onKeyDown={e => {
                  return e.key === `Enter` && Da();
                }} />
                    <Component827 onClick={() => {
                  return Da(false);
                }} disabled={yn} className={`bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-500 disabled:opacity-50 whitespace-nowrap`}>
                      {yn ? `保存中...` : `保存`}
                    </Component827>
                  </Component828>
                  <Component830 className={`mt-2`}>
                    <Component829 className={`w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-1.5 text-[10px] text-gray-300 focus:outline-none focus:border-blue-500 h-16 resize-none font-mono nowheel nopan`} placeholder={`[可选] 手动粘贴 Cookie (JSON 或 key=value; 格式)`} value={_n} onChange={e => {
                  return vn(e.target.value);
                }} />
                  </Component830>
                  <Component831 className={`text-[10px] text-gray-500 mt-2`}>{`* 默认自动抓取当前标签页 Cookie。若填写上方 Cookie 则优先使用。`}</Component831>
                </Component832>
              </Component833>}
            <Component860 className={`flex-1 overflow-y-auto p-4 relative`}>
              <Component835 className={`flex justify-between items-center mb-4`}>
                <Component834 href={`https://www.bilibili.com/video/BV1nWdbBREXv/?share_source=copy_web&vd_source=cebaf375056cef0735636bdd79543af1`} target={`_blank`} rel={`noreferrer`} className={`text-xs text-gray-500 hover:text-gray-300 underline flex items-center gap-1 transition-colors bg-[#222] px-3 py-1.5 rounded-full hover:bg-[#333]`}>{`📺 如何一个网站登录多个账号？(视频教程)`}</Component834>
              </Component835>
              <Component859 className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4`}>
                <Component839 className={`relative bg-blue-900/10 rounded-xl border-[3px] border-blue-500 border-dashed transition-all cursor-pointer hover:bg-blue-900/20 hover:border-blue-400 flex flex-col items-center justify-center p-3 h-32 group`} onClick={() => {
                return Da(true);
              }} title={`保存当前环境`}>
                  <Component837 className={`relative mb-3 flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 group-hover:scale-110 transition-transform group-hover:bg-blue-500 group-hover:text-white`}>
                    <Component836 className={`text-3xl font-light`}>{`+`}</Component836>
                  </Component837>
                  <Component838 className={`font-bold text-blue-400 group-hover:text-blue-300 truncate text-sm w-full text-center px-2 transition-colors`}>{`保存当前环境`}</Component838>
                </Component839>
                {an.map((e, t) => {
                return <Component858 draggable={true} onDragStart={e => {
                  return Ma(e, t);
                }} onDragEnd={Na} onDragOver={e => {
                  return Pa(e, t);
                }} onDrop={e => {
                  return Fa(e, t);
                }} className={`relative bg-[#151414] rounded-xl border transition-all cursor-grab active:cursor-grabbing group hover:bg-[#252525] flex flex-col items-center justify-center p-3 h-32
                    ${sn?.id === e.id ? `border-blue-500 shadow-blue-500/10 shadow-md ring-1 ring-blue-500/50 bg-blue-900/10` : `border-[#333] hover:border-gray-500`}
                    ${Aa === t ? `border-dashed border-[3px] border-blue-400 opacity-80 scale-105 z-10` : ``}
                  `} onClick={() => {
                  return xa(e);
                }} title={e.siteName} key={e.id}>
                      <Component840 src={e.avatar} className={`w-12 h-12 rounded-full bg-[#0d0c0c] object-contain p-0.5 border border-[#333] mb-3 pointer-events-none`} draggable={`false`} onError={t => {
                    t.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${e.name}`;
                  }} />
                      <Component841 className={`font-bold text-gray-200 truncate text-sm w-full text-center px-2`}>
                        {e.name}
                      </Component841>
                      {sn?.id === e.id && <Component843 className={`absolute top-0 left-0 w-0 h-0 border-t-[32px] border-r-[32px] border-t-blue-500 border-r-transparent rounded-tl-xl z-10`}>
                          <Component842 className={`absolute -top-[28px] left-[6px] text-[12px] text-white font-bold`}>{`√`}</Component842>
                        </Component843>}
                      <Component857 className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20`}>
                        <Component856 className={`relative group/menu`}>
                          <Component848 className={`text-gray-400 hover:text-white p-1 rounded hover:bg-[#333]`} onClick={e => {
                        return e.stopPropagation();
                      }}>
                            <Component847 width={`18`} height={`18`} viewBox={`0 0 24 24`} fill={`none`} stroke={`currentColor`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                              <Component844 cx={`12`} cy={`12`} r={`1`} />
                              <Component845 cx={`12`} cy={`5`} r={`1`} />
                              <Component846 cx={`12`} cy={`19`} r={`1`} />
                            </Component847>
                          </Component848>
                          <Component855 className={`absolute right-0 top-full pt-1 hidden group-hover/menu:block z-50`}>
                            <Component854 className={`bg-[#252525] border border-[#333] rounded-md shadow-xl py-1 w-24`}>
                              <Component849 className={`w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-[#333] hover:text-white`} onClick={t => {
                            t.stopPropagation();
                            fn(true);
                            gn(e.id);
                            mn(e.name);
                            vn(JSON.stringify(e.cookies));
                          }}>{`修改`}</Component849>
                              <Component850 className={`w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-[#333] hover:text-white`} onClick={t => {
                            t.stopPropagation();
                            let n = JSON.stringify(e.cookies);
                            navigator.clipboard.writeText(n);
                            $(`Cookie已复制`);
                          }}>{`复制 Cookie`}</Component850>
                              <Component851 className={`w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-[#333] hover:text-red-300`} onClick={t => {
                            t.stopPropagation();
                            ba(e, true);
                          }}>{`清除全部 Cookies`}</Component851>
                              <Component852 className={`border-t border-[#333] my-1`} />
                              <Component853 className={`w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-[#333] hover:text-red-300`} onClick={t => {
                            return Ra(e.id, t);
                          }}>
                                {Ia === e.id ? `确认删除?` : `删除`}
                              </Component853>
                            </Component854>
                          </Component855>
                        </Component856>
                      </Component857>
                    </Component858>;
              })}
              </Component859>
            </Component860>
          </Component861>
          <Et active={H === `transit`} transitItems={ze} transitResources={L} transitTotal={Ve} transitTotalPages={We} transitLoading={et} transitPage={Oe} setTransitPage={ke} transitGridCols={Te} setTransitGridCols={Ee} transitTabFilter={fe} setTransitTabFilter={pe} transitFilter={se} setTransitFilter={de} transitSourceFilter={he} setTransitSourceFilter={ge} currentFolder={_e} setCurrentFolder={ve} creatingFolder={ye} setCreatingFolder={be} newFolderName={xe} setNewFolderName={Ce} localTool={r} showToastMessage={$} handleSyncLocal={to} handleToggleFavorite={za} handleClearResources={Ba} handleDeleteResource={Wa} handleSendToActiveTab={Ha} handleCopyResource={Ua} setFullscreenResource={N} openResourceMenu={F} setOpenResourceMenu={te} />
          <Component887 className={`absolute inset-0 w-full h-full bg-[#0d0c0c] flex flex-col ${H === `canvas` ? `visible z-10` : `invisible -z-10`}`}>
            <Component872 className={`flex-1 relative`}>
              <Component862 className={`absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-[#0d0c0c] to-transparent z-10 pointer-events-none`} />
              <Je projectId={Z} textApiUrl={Nn} textApiKey={Fn} imageApiUrl={zn} imageApiKey={Vn} videoApiUrl={Kn} videoApiKey={Jn} builtinApiUrl={kn} builtinApiKey={jn} sd2VideoApiUrl={er} sd2VideoApiKey={nr} discountVideoApiUrl={or} discountVideoApiKey={ur} aiAppApiUrl={mr} aiAppApiKey={_r} audioApiUrl={yr} audioApiKey={xr} textModel={Or} drawingModel={kr} videoModel={Xn} sd2VideoModel={ir} discountVideoModel={Ar} videoDurations={Qn} audioModel={Cr} showToast={$} transitResources={L} addTransitResource={Va} presetPrompts={Q} membership={xi} globalTasks={u} updateGlobalTasks={Za} onSendToActiveTab={Ha} customNodeTemplates={ri} onAddCustomNodeTemplate={Ya} onDeleteCustomNodeTemplate={Xa} globalPollingInterval={Mr} globalMaxPollingDuration={Pr} globalSyncTimeout={Lr} setShowTaskList={x} cloudStorageConfig={f} sd2Token={g} useThumbnail={Zr} panPerformanceMode={$r} enablePerformanceMode={ti} onTogglePerformanceMode={() => {
              return ni(e => {
                return !e;
              });
            }} isLoggedIn={J} localToolBaseUrl={i} agentCanvasRef={Ut} agentPanelOpen={false} agentPanelWidth={Nt} key={Z} />
              {false}
              <_cmp__Component38 agentKey={`canvas-assistant`} projectId={Z} canvasHandleRef={Ut} open={false} onClose={() => {
              return Mt(false);
            }} onGoMembership={() => {
              U(`settings`);
              Ot(`membership`);
            }} onWidthChange={Pt} onEnabledChange={Vt} />
              {!kt && <Component871 className={`absolute bottom-6 right-6 z-50 flex items-center gap-2`}>
                  <Component863 className={`text-[10px] font-medium text-white/15 tabular-nums select-none leading-none`} title={`当前版本`}>
                    {`v`}
                    {Ht()}
                  </Component863>
                  <Component870 className={`flex items-center gap-2 rounded-full bg-[#151414] border shadow-lg transition-all ${r.status.isConnected ? `justify-center w-8 h-8 border-[#333]` : `px-3 py-1.5 border-red-500/30 bg-red-950/20`}`} title={r.status.isConnected ? `本地引擎已连接` : `本地引擎未启动`}>
                    {r.status.isConnected ? <Component865 width={`16`} height={`16`} viewBox={`0 0 24 24`} fill={`none`} stroke={`#10b981`} strokeWidth={`3`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                        <Component864 points={`20 6 9 17 4 12`} />
                      </Component865> : <K.Fragment>
                        <Component868 width={`14`} height={`14`} viewBox={`0 0 24 24`} fill={`none`} stroke={`#ef4444`} strokeWidth={`3`} strokeLinecap={`round`} strokeLinejoin={`round`}>
                          <Component866 x1={`18`} y1={`6`} x2={`6`} y2={`18`} />
                          <Component867 x1={`6`} y1={`6`} x2={`18`} y2={`18`} />
                        </Component868>
                        <Component869 className={`text-xs font-medium text-red-400 animate-pulse`}>{`本地引擎未启动`}</Component869>
                      </K.Fragment>}
                  </Component870>
                </Component871>}
            </Component872>
            {zi && <Component879 className={`absolute inset-0 bg-black/50 flex items-center justify-center z-50`}>
                <Component878 className={`bg-[#2a2a2a] p-4 rounded-lg border border-[#333] w-64`}>
                  <Component873 className={`text-gray-200 text-sm font-bold mb-3`}>{`新建项目`}</Component873>
                  <Component874 className={`w-full bg-[#151414] border border-[#333] rounded p-2 text-gray-200 text-xs mb-3 focus:outline-none focus:border-blue-500`} placeholder={`项目名称`} value={Vi} onChange={e => {
                return Hi(e.target.value);
              }} autoFocus={true} />
                  <Component877 className={`flex justify-end gap-2`}>
                    <Component875 onClick={() => {
                  return Bi(false);
                }} className={`text-gray-400 hover:text-white text-xs px-2 py-1`}>{`取消`}</Component875>
                    <Component876 onClick={Ga} className={`bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-500`}>{`创建`}</Component876>
                  </Component877>
                </Component878>
              </Component879>}
            {Ui && <Component886 className={`absolute inset-0 bg-black/50 flex items-center justify-center z-50`}>
                <Component885 className={`bg-[#2a2a2a] p-4 rounded-lg border border-[#333] w-64`}>
                  <Component880 className={`text-gray-200 text-sm font-bold mb-3`}>{`重命名应用`}</Component880>
                  <Component881 className={`w-full bg-[#151414] border border-[#333] rounded p-2 text-gray-200 text-xs mb-3 focus:outline-none focus:border-blue-500`} placeholder={`应用名称`} value={Gi} onChange={e => {
                return Ki(e.target.value);
              }} onKeyDown={e => {
                if (e.key === `Enter`) {
                  qa();
                }
                if (e.key === `Escape`) {
                  Wi(false);
                  Ki(``);
                }
              }} autoFocus={true} />
                  <Component884 className={`flex justify-end gap-2`}>
                    <Component882 onClick={() => {
                  Wi(false);
                  Ki(``);
                }} className={`text-gray-400 hover:text-white text-xs px-2 py-1`}>{`取消`}</Component882>
                    <Component883 onClick={qa} className={`bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-500`}>{`保存`}</Component883>
                  </Component884>
                </Component885>
              </Component886>}
          </Component887>
          <Component888 className={`absolute inset-0 ${H === `appcenter` ? `visible z-10` : `invisible -z-10`}`}>
            {qi ? <_cmp__Component39 app={qi} onBack={() => {
            return Ji(null);
          }} canvasProps={{
            textApiUrl: Nn,
            textApiKey: Fn,
            imageApiUrl: zn,
            imageApiKey: Vn,
            videoApiUrl: Kn,
            videoApiKey: Jn,
            builtinApiUrl: kn,
            builtinApiKey: jn,
            sd2VideoApiUrl: er,
            sd2VideoApiKey: nr,
            discountVideoApiUrl: or,
            discountVideoApiKey: ur,
            aiAppApiUrl: mr,
            aiAppApiKey: _r,
            audioApiUrl: yr,
            audioApiKey: xr,
            textModel: Or,
            drawingModel: kr,
            videoModel: Xn,
            sd2VideoModel: ir,
            discountVideoModel: Ar,
            videoDurations: Qn,
            audioModel: Cr,
            showToast: $,
            transitResources: L,
            addTransitResource: Va,
            presetPrompts: Q,
            membership: xi,
            globalTasks: u,
            updateGlobalTasks: Za,
            onSendToActiveTab: Ha,
            customNodeTemplates: ri,
            onAddCustomNodeTemplate: Ya,
            onDeleteCustomNodeTemplate: Xa,
            globalPollingInterval: Mr,
            globalMaxPollingDuration: Pr,
            globalSyncTimeout: Lr,
            setShowTaskList: x,
            cloudStorageConfig: f,
            sd2Token: g,
            useThumbnail: Zr,
            panPerformanceMode: $r,
            isLoggedIn: J
          }} /> : <_cmp__Component40 active={H === `appcenter`} onRun={Ji} showToast={$} />}
          </Component888>
          <Component1085 className={`absolute inset-0 flex bg-[#0d0c0c] overflow-hidden ${H === `settings` ? `visible z-10` : `invisible -z-10`}`}>
            <Component894 className={`w-48 bg-[#0d0c0c] border-r-0 flex flex-col p-3 z-10 flex-shrink-0`}>
              <Component889 className={`text-[10px] text-gray-500 font-bold px-3 py-2 mb-1 uppercase tracking-wider`}>{`设置`}</Component889>
              <Component890 onClick={() => {
              return Ot(`builtin`);
            }} className={`text-left px-3 py-2.5 rounded-lg text-sm transition-colors mb-1.5 flex items-center gap-2 ${W === `builtin` ? `bg-[#252525] text-blue-500 font-bold border border-[#333] shadow-sm` : `text-gray-300 hover:bg-[#222] hover:text-gray-100 border border-transparent`}`}>
                <_Component31 size={16} />
                {` 内置模型`}
              </Component890>
              <Component891 onClick={() => {
              return Ot(`models`);
            }} className={`text-left px-3 py-2.5 rounded-lg text-sm transition-colors mb-1.5 flex items-center gap-2 ${W === `models` ? `bg-[#252525] text-blue-500 font-bold border border-[#333] shadow-sm` : `text-gray-300 hover:bg-[#222] hover:text-gray-100 border border-transparent`}`}>
                <I size={16} />
                {` 第三方API配置`}
              </Component891>
              <Component892 onClick={() => {
              return Ot(`basic`);
            }} className={`text-left px-3 py-2.5 rounded-lg text-sm transition-colors mb-1.5 flex items-center gap-2 ${W === `basic` ? `bg-[#252525] text-blue-500 font-bold border border-[#333] shadow-sm` : `text-gray-300 hover:bg-[#222] hover:text-gray-100 border border-transparent`}`}>
                <_Component34 size={16} />
                {` 预设提示词`}
              </Component892>
              <_cmp_Zt active={W === `upgrade`} controller={fa} onClick={() => {
              return Ot(`upgrade`);
            }} />
              <Component893 onClick={() => {
              return Ot(`endpoint`);
            }} className={`text-left px-3 py-2.5 rounded-lg text-sm transition-colors mb-1.5 flex items-center gap-2 ${W === `endpoint` ? `bg-[#252525] text-blue-500 font-bold border border-[#333] shadow-sm` : `text-gray-300 hover:bg-[#222] hover:text-gray-100 border border-transparent`}`}>
                <_Component7 size={16} />
                {` 后端接入点`}
              </Component893>
            </Component894>
            <Component1083 className={`flex-1 overflow-y-auto p-6 relative pb-24 custom-scrollbar bg-[#0d0c0c] nowheel nopan nodrag`}>
              <Component1082 className={`max-w-4xl mx-auto flex flex-col gap-6`}>
                {W === `basic` && <Component917 className={`space-y-6 animate-fade-in`}>
                    <Component916 className={`group bg-[#1a1a1a] rounded-xl overflow-hidden transition-all duration-300 pb-4 shadow-sm border border-[#222]`}>
                      <Component899 className={`flex justify-between items-center p-4 border-b border-[#222]`}>
                        <Component897 className={`font-bold text-gray-200 text-sm flex items-center gap-2`}>
                          <Component895 className={`text-yellow-500`}>{`✨`}</Component895>
                          {` 预设提示词`}
                          <Component896 className={`text-xs text-gray-500 font-normal ml-2 bg-[#222] px-2 py-0.5 rounded-full`}>
                            {`(`}
                            {Q.length}
                            {`/`}
                            {Fi.presets}
                            {`)`}
                          </Component896>
                        </Component897>
                        <Component898 onClick={ro} className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${Q.length >= Fi.presets ? `bg-[#222] text-gray-600 cursor-not-allowed` : `bg-[#222] text-gray-300 hover:bg-[#2a2a2a] hover:text-blue-400`}`} disabled={Q.length >= Fi.presets} title={Q.length >= Fi.presets ? `达到上限` : `添加预设`}>{`+ 添加新预设`}</Component898>
                      </Component899>
                      <Component915 className={`px-4 pt-4`}>
                        <Component914 className={`space-y-3 custom-scrollbar`}>
                          {Q.map((e, t) => {
                        return <Component912 className={`flex gap-3 items-start bg-[#0d0c0c] p-3 rounded-lg border border-[#333] hover:border-[#444] transition-colors group/preset`} key={t}>
                                <Component901 className={`flex flex-col gap-2 pt-1.5`}>
                                  <Component900 type={`checkbox`} checked={e.enabled !== false} onChange={e => {
                              return no(t, `enabled`, e.target.checked);
                            }} className={`cursor-pointer accent-blue-500 w-4 h-4`} title={`启用/禁用`} />
                                </Component901>
                                <Component910 className={`flex-1 space-y-2`}>
                                  <Component908 className={`flex gap-2`}>
                                    <Component902 className={`w-full text-xs bg-[#1a1a1a] border border-[#333] rounded px-3 py-1.5 text-gray-300 focus:border-blue-500 outline-none transition-all`} placeholder={`标题`} value={e.title} onChange={e => {
                                return no(t, `title`, e.target.value);
                              }} />
                                    <Component907 className={`text-xs bg-[#1a1a1a] border border-[#333] rounded px-2 py-1.5 text-gray-300 focus:border-blue-500 outline-none transition-all w-24`} value={e.type || `all`} onChange={e => {
                                return no(t, `type`, e.target.value);
                              }}>
                                      <Component903 value={`all`}>{`通用`}</Component903>
                                      <Component904 value={`text`}>{`文本`}</Component904>
                                      <Component905 value={`image`}>{`生图`}</Component905>
                                      <Component906 value={`video`}>{`视频`}</Component906>
                                    </Component907>
                                  </Component908>
                                  <Component909 className={`w-full text-xs bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 resize-none h-16 text-gray-400 focus:border-blue-500 outline-none transition-all nowheel nopan`} placeholder={`提示词内容`} value={e.prompt} onChange={e => {
                              return no(t, `prompt`, e.target.value);
                            }} />
                                </Component910>
                                <Component911 onClick={() => {
                            return io(t);
                          }} className={`text-gray-600 hover:text-red-500 p-1.5 hover:bg-[#222] rounded-lg transition-colors opacity-0 group-hover/preset:opacity-100`}>
                                  <P size={14} />
                                </Component911>
                              </Component912>;
                      })}
                          {Q.length >= Fi.presets && xi.type !== `VIP` && <Component913 className={`text-xs text-center text-gray-500 mt-4 bg-[#222] p-2 rounded-lg`}>{`已达当前版本预设上限，请升级会员`}</Component913>}
                        </Component914>
                      </Component915>
                    </Component916>
                  </Component917>}
                {W === `builtin` && <_cmp_Tn />}
                {W === `models` && <Component984 className={`space-y-6 animate-fade-in`}>
                    <Component936 className={`group bg-[#1a1a1a] rounded-xl overflow-hidden transition-all duration-300 pb-4 shadow-sm border border-[#222]`}>
                      <Component922 className={`flex justify-between items-center p-4 select-none border-b border-[#222]`}>
                        <Component920 className={`font-bold text-gray-200 text-sm flex items-center gap-2`}>
                          <Component918 className={`text-yellow-500`}>{`⚙️`}</Component918>
                          {` 第三方 API 配置`}
                          <Component919 href={`https://test-cyfyd24zfbua.feishu.cn/wiki/CCkewnbsQiQZlMkfQSbctRI5nUh?from=from_copylink`} target={`_blank`} rel={`noopener noreferrer`} className={`ml-1 inline-flex items-center gap-1 text-xs font-normal text-blue-400 hover:text-blue-300 transition-colors`}>
                            {`查看配置教程`}
                            <_Component30 size={11} />
                          </Component919>
                        </Component920>
                        <Component921 onClick={async () => {
                      try {
                        let e = await Ai();
                        if (e) {
                          O(e);
                          E(true);
                        }
                      } catch (e) {
                        console.error(`获取默认配置失败:`, e);
                        q.error(`获取默认配置失败，请重试`);
                      }
                    }} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg transition-colors`}>
                          <_Component4 size={12} />
                          {`恢复默认`}
                        </Component921>
                      </Component922>
                      <Component935 className={`px-4 space-y-3 pt-4`}>
                        {X.filter(e => {
                      return !e.readonly;
                    }).length === 0 && <Component923 className={`text-center text-xs text-gray-500 py-4 bg-[#1a1a1a] border border-dashed border-[#333] rounded-lg`}>{`暂无自定义 API 配置，点击下方按钮添加`}</Component923>}
                        {X.filter(e => {
                      return !e.readonly;
                    }).map(e => {
                      let t = X.findIndex(t => {
                        return t.id === e.id;
                      });
                      const Component924 = `input`;
                      const Component925 = `div`;
                      const Component926 = `input`;
                      const Component927 = `div`;
                      const Component928 = `input`;
                      const Component929 = `button`;
                      const Component930 = `div`;
                      const Component931 = `div`;
                      const Component932 = `button`;
                      const Component933 = `div`;
                      return <Component933 className={`flex items-center gap-3 bg-[#222] rounded-lg p-2 relative group/item border border-transparent hover:border-[#333] transition-colors`} key={e.id}>
                              <Component925 className={`w-1/4`}>
                                <Component924 className={`w-full bg-transparent border-b border-[#444] px-1 py-1.5 text-xs focus:border-blue-500 outline-none placeholder-gray-600 transition-colors text-gray-200`} placeholder={`配置名称 (例: API Studio)`} value={e.name} onChange={e => {
                            let n = [...X];
                            n[t].name = e.target.value;
                            ai(n);
                          }} />
                              </Component925>
                              <Component927 className={`w-1/3`}>
                                <Component926 className={`w-full bg-transparent border-b border-[#444] px-1 py-1.5 text-xs focus:border-blue-500 outline-none placeholder-gray-600 transition-colors text-gray-200`} placeholder={`Base URL`} value={e.url} onChange={e => {
                            let n = [...X];
                            n[t].url = e.target.value;
                            ai(n);
                          }} />
                              </Component927>
                              <Component931 className={`flex-1 relative`}>
                                <Component930 className={`relative flex items-center`}>
                                  <Component928 className={`w-full bg-transparent border-b border-[#444] px-1 py-1.5 pr-8 text-xs text-gray-200 focus:border-blue-500 outline-none placeholder-gray-600 transition-colors`} placeholder={`密钥 (sk-...)`} type={e.showKey ? `text` : `password`} value={e.key} onChange={e => {
                              let n = [...X];
                              n[t].key = e.target.value;
                              ai(n);
                            }} />
                                  <Component929 type={`button`} onClick={() => {
                              let e = [...X];
                              e[t].showKey = !e[t].showKey;
                              ai(e);
                            }} className={`absolute right-0 text-gray-500 hover:text-gray-300 p-1`}>
                                    {e.showKey ? <_Component41 size={14} /> : <A size={14} />}
                                  </Component929>
                                </Component930>
                              </Component931>
                              <Component932 onClick={() => {
                          ai(X.filter(t => {
                            return t.id !== e.id;
                          }));
                        }} className={`text-gray-600 hover:text-red-500 p-1 opacity-0 group-hover/item:opacity-100 transition-opacity`} title={`删除配置`}>
                                <P size={14} />
                              </Component932>
                            </Component933>;
                    })}
                        <Component934 onClick={() => {
                      ai([...X, {
                        id: Date.now().toString(),
                        name: ``,
                        url: ``,
                        key: ``,
                        showKey: false,
                        readonly: false
                      }]);
                    }} className={`w-full py-2 bg-[#222] text-gray-400 rounded-lg hover:bg-[#2a2a2a] hover:text-gray-200 transition-colors text-xs font-medium`}>{`+ 添加统一配置`}</Component934>
                      </Component935>
                    </Component936>
                    <Component946 className={`group bg-[#1a1a1a] rounded-xl overflow-hidden transition-all duration-300 pb-4 shadow-sm border border-[#222]`}>
                      <Component942 className={`flex justify-between items-center p-4 border-b border-[#222]`}>
                        <Component938 className={`font-bold text-gray-200 text-sm flex items-center gap-2`}>
                          <Component937 className={`text-blue-500`}>{`📝`}</Component937>
                          {` 文本大模型`}
                        </Component938>
                        <Component941 className={`flex items-center gap-2`}>
                          <Component940 className={`bg-[#222] border border-[#333] text-gray-300 text-xs px-3 py-1.5 rounded-lg outline-none focus:border-blue-500 hover:bg-[#2a2a2a] transition-colors`} onChange={e => {
                        return si(e.target.value);
                      }} value={oi}>
                            {X.filter(e => {
                          return !e.readonly;
                        }).map(e => {
                          return <Component939 value={e.id} key={e.id}>
                                  {e.name || e.url}
                                </Component939>;
                        })}
                          </Component940>
                        </Component941>
                      </Component942>
                      <Component945 className={`px-4 pt-4`}>
                        <Component943 className={`block text-xs font-medium text-gray-500 mb-2`}>{`模型名称 (支持多个，换行分隔)`}</Component943>
                        <Component944 value={Ln} onChange={e => {
                      return Rn(e.target.value);
                    }} className={`w-full bg-[#0d0c0c] border border-[#333] rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition-all min-h-[80px] resize-y`} placeholder={`gpt-3.5-turbo
gpt-4o`} />
                      </Component945>
                    </Component946>
                    <Component956 className={`group bg-[#1a1a1a] rounded-xl overflow-hidden transition-all duration-300 pb-4 shadow-sm border border-[#222]`}>
                      <Component952 className={`flex justify-between items-center p-4 border-b border-[#222]`}>
                        <Component948 className={`font-bold text-gray-200 text-sm flex items-center gap-2`}>
                          <Component947 className={`text-pink-500`}>{`🎨`}</Component947>
                          {` 图像大模型`}
                        </Component948>
                        <Component951 className={`flex items-center gap-2`}>
                          <Component950 className={`bg-[#222] border border-[#333] text-gray-300 text-xs px-3 py-1.5 rounded-lg outline-none focus:border-blue-500 hover:bg-[#2a2a2a] transition-colors`} onChange={e => {
                        return li(e.target.value);
                      }} value={ci}>
                            {X.filter(e => {
                          return !e.readonly;
                        }).map(e => {
                          return <Component949 value={e.id} key={e.id}>
                                  {e.name || e.url}
                                </Component949>;
                        })}
                          </Component950>
                        </Component951>
                      </Component952>
                      <Component955 className={`px-4 pt-4`}>
                        <Component953 className={`block text-xs font-medium text-gray-500 mb-2`}>{`模型名称 (支持多个，换行分隔)`}</Component953>
                        <Component954 value={Wn} onChange={e => {
                      return Gn(e.target.value);
                    }} className={`w-full bg-[#0d0c0c] border border-[#333] rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition-all min-h-[80px] resize-y`} placeholder={`gemini-3.1-flash-image-preview
dall-e-3`} />
                      </Component955>
                    </Component956>
                    <Component973 className={`group bg-[#1a1a1a] rounded-xl overflow-hidden transition-all duration-300 pb-4 shadow-sm border border-[#222]`}>
                      <Component959 className={`flex justify-between items-center p-4 border-b border-[#222]`}>
                        <Component958 className={`font-bold text-gray-200 text-sm flex items-center gap-2`}>
                          <Component957 className={`text-purple-500`}>{`🎬`}</Component957>
                          {` 视频配置`}
                        </Component958>
                      </Component959>
                      <Component972 className={`px-4 pt-4 space-y-6`}>
                        <Component967 className={`space-y-2`}>
                          <Component964 className={`flex justify-between items-center`}>
                            <Component961 className={`text-xs font-bold text-gray-300 flex items-center gap-2`}>
                              <Component960 className={`text-purple-500`}>{`🎬`}</Component960>
                              {` 视频大模型`}
                            </Component961>
                            <Component963 className={`bg-[#222] border border-[#333] text-gray-300 text-xs px-3 py-1.5 rounded-lg outline-none focus:border-blue-500 hover:bg-[#2a2a2a] transition-colors`} onChange={e => {
                          return di(e.target.value);
                        }} value={ui}>
                              {X.filter(e => {
                            return !e.readonly;
                          }).map(e => {
                            return <Component962 value={e.id} key={e.id}>
                                    {e.name || e.url}
                                  </Component962>;
                          })}
                            </Component963>
                          </Component964>
                          <Component966>
                            <Component965 value={Xn} onChange={e => {
                          return Zn(e.target.value);
                        }} className={`w-full bg-[#0d0c0c] border border-[#333] rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition-all min-h-[60px] resize-y`} placeholder={`grok-video-3-pro
sora`} />
                          </Component966>
                        </Component967>
                        <Component968 className={`h-px bg-[#333] w-full`} />
                        <Component971 className={`pt-2`}>
                          <Component969 className={`block text-xs font-medium text-gray-500 mb-2`}>{`通用可选时长 (秒数，换行分隔)`}</Component969>
                          <Component970 value={Qn} onChange={e => {
                        return $n(e.target.value);
                      }} className={`w-full bg-[#0d0c0c] border border-[#333] rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition-all min-h-[80px] resize-y`} placeholder={`10
15`} />
                        </Component971>
                      </Component972>
                    </Component973>
                    <Component983 className={`group bg-[#1a1a1a] rounded-xl overflow-hidden transition-all duration-300 pb-4 shadow-sm border border-[#222]`}>
                      <Component979 className={`flex justify-between items-center p-4 border-b border-[#222]`}>
                        <Component975 className={`font-bold text-gray-200 text-sm flex items-center gap-2`}>
                          <Component974 className={`text-green-500`}>{`🎙️`}</Component974>
                          {` 听音断句 API`}
                        </Component975>
                        <Component978 className={`flex items-center gap-2`}>
                          <Component977 className={`bg-[#222] border border-[#333] text-gray-300 text-xs px-3 py-1.5 rounded-lg outline-none focus:border-blue-500 hover:bg-[#2a2a2a] transition-colors`} onChange={e => {
                        return _i(e.target.value);
                      }} value={gi}>
                            {X.filter(e => {
                          return !e.readonly;
                        }).map(e => {
                          return <Component976 value={e.id} key={e.id}>
                                  {e.name || e.url}
                                </Component976>;
                        })}
                          </Component977>
                        </Component978>
                      </Component979>
                      <Component982 className={`px-4 pt-4`}>
                        <Component980 className={`block text-xs font-medium text-gray-500 mb-2`}>{`模型名称`}</Component980>
                        <Component981 value={Cr} onChange={e => {
                      return wr(e.target.value);
                    }} className={`w-full bg-[#0d0c0c] border border-[#333] rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition-all min-h-[80px] resize-y`} placeholder={`whisper-1`} />
                      </Component982>
                    </Component983>
                  </Component984>}
                {W === `data` && <Component1080 className={`space-y-6 animate-fade-in`}>
                    <Component1005 className={`group bg-[#1a1a1a] rounded-xl overflow-hidden transition-all duration-300 pb-4 shadow-sm border border-[#222]`}>
                      <Component987 className={`flex justify-between items-center p-4 border-b border-[#222]`}>
                        <Component986 className={`font-bold text-gray-200 text-sm flex items-center gap-2`}>
                          <Component985 className={`text-orange-500`}>{`📦`}</Component985>
                          {` 数据管理`}
                        </Component986>
                      </Component987>
                      <Component1004 className={`px-4 pt-4 pb-2`}>
                        <Component995 className={`text-xs text-gray-400 leading-relaxed mb-4`}>
                          {`通过导出功能，您可以将当前的`}
                          <Component988 className={`text-gray-200`}>{`全局配置、账号环境、API 密钥以及所有的画布项目内容（节点连线）`}</Component988>
                          {`完整打包下载为一个极小体积的 JSON 文件（KB 级别）。您可以将该备份文件用于：`}
                          <Component989 />
                          <Component990 className={`text-blue-400 mt-1 inline-block`}>{`• 异地设备的数据无缝同步`}</Component990>
                          <Component991 />
                          <Component992 className={`text-green-400`}>{`• 与团队同事分享您的优质工作流`}</Component992>
                          <Component993 />
                          <Component994 className={`text-purple-400`}>{`• 本地日常配置备份防丢失`}</Component994>
                        </Component995>
                        <Component1003 className={`flex gap-4`}>
                          {r.status.isConnected && <Component997 onClick={e => {
                        e.preventDefault();
                        ao();
                      }} className={`flex-1 flex items-center justify-center gap-2 text-sm bg-emerald-900/30 text-emerald-400 border border-emerald-500/30 py-2.5 rounded-lg hover:bg-emerald-900/50 hover:text-emerald-300 transition-all`}>
                              <_Component5 size={16} />
                              <Component996 className={`font-bold`}>{`一键同步到本地引擎`}</Component996>
                            </Component997>}
                          <Component999 onClick={e => {
                        e.preventDefault();
                        oo();
                      }} className={`flex-1 flex items-center justify-center gap-2 text-sm bg-[#222] text-gray-300 border border-[#333] py-2.5 rounded-lg hover:bg-[#2a2a2a] hover:text-white hover:border-gray-500 transition-all`}>
                            <_Component6 size={16} className={`text-orange-400`} />
                            <Component998 className={`font-bold`}>{`导出所有内容 (JSON)`}</Component998>
                          </Component999>
                          <Component1002 className={`flex-1 flex items-center justify-center gap-2 text-sm bg-[#222] text-gray-300 border border-[#333] py-2.5 rounded-lg hover:bg-[#2a2a2a] hover:text-white hover:border-gray-500 transition-all text-center cursor-pointer`}>
                            <_Component29 size={16} className={`text-blue-400`} />
                            <Component1000 className={`font-bold`}>{`导入所有内容 (JSON)`}</Component1000>
                            <Component1001 type={`file`} accept={`.json`} className={`hidden`} onChange={so} />
                          </Component1002>
                        </Component1003>
                      </Component1004>
                    </Component1005>
                    <Component1023 className={`group bg-[#1a1a1a] rounded-xl overflow-hidden transition-all duration-300 pb-4 shadow-sm border border-[#222]`}>
                      <Component1008 className={`flex justify-between items-center p-4 border-b border-[#222]`}>
                        <Component1007 className={`font-bold text-gray-200 text-sm flex items-center gap-2`}>
                          <Component1006 className={`text-blue-400`}>{`⏱️`}</Component1006>
                          {` 全局任务与超时设置`}
                        </Component1007>
                      </Component1008>
                      <Component1022 className={`px-4 pt-4 pb-2`}>
                        <Component1021 className={`grid grid-cols-3 gap-4`}>
                          <Component1012>
                            <Component1009 className={`block text-[11px] font-medium text-gray-500 mb-1.5`}>{`轮询间隔 (秒)`}</Component1009>
                            <Component1010 type={`number`} value={Mr} onChange={e => {
                          return Nr(parseInt(e.target.value) || 3);
                        }} className={`w-full bg-[#0d0c0c] border border-[#333] rounded px-3 py-2 text-xs text-gray-400 focus:outline-none focus:border-gray-500 transition-all`} placeholder={`3`} />
                            <Component1011 className={`text-[9px] text-gray-500 mt-1 inline-block`}>{`默认: 3s`}</Component1011>
                          </Component1012>
                          <Component1016>
                            <Component1013 className={`block text-[11px] font-medium text-gray-500 mb-1.5`}>{`最大轮询时间 (秒)`}</Component1013>
                            <Component1014 type={`number`} value={Pr} onChange={e => {
                          return Ir(parseInt(e.target.value) || 600);
                        }} className={`w-full bg-[#0d0c0c] border border-[#333] rounded px-3 py-2 text-xs text-gray-400 focus:outline-none focus:border-gray-500 transition-all`} placeholder={`600`} />
                            <Component1015 className={`text-[9px] text-gray-500 mt-1 inline-block`}>{`默认: 600s`}</Component1015>
                          </Component1016>
                          <Component1020>
                            <Component1017 className={`block text-[11px] font-medium text-gray-500 mb-1.5`}>{`同步任务超时 (秒)`}</Component1017>
                            <Component1018 type={`number`} value={Lr} onChange={e => {
                          return Rr(parseInt(e.target.value) || 600);
                        }} className={`w-full bg-[#0d0c0c] border border-[#333] rounded px-3 py-2 text-xs text-gray-400 focus:outline-none focus:border-gray-500 transition-all`} placeholder={`600`} />
                            <Component1019 className={`text-[9px] text-gray-500 mt-1 inline-block`}>{`默认: 600s`}</Component1019>
                          </Component1020>
                        </Component1021>
                      </Component1022>
                    </Component1023>
                    <Component1047 className={`group bg-[#1a1a1a] rounded-xl overflow-hidden transition-all duration-300 pb-4 shadow-sm border border-[#222]`}>
                      <Component1026 className={`flex justify-between items-center p-4 border-b border-[#222]`}>
                        <Component1025 className={`font-bold text-gray-200 text-sm flex items-center gap-2`}>
                          <Component1024 className={`text-blue-400`}>
                            <_Component42 size={16} />
                          </Component1024>
                          {` 图片缩略图`}
                        </Component1025>
                      </Component1026>
                      <Component1046 className={`px-4 pt-4 pb-2`}>
                        <Component1032 className={`flex items-center justify-between mb-3`}>
                          <Component1029 className={`flex flex-col`}>
                            <Component1027 className={`text-xs text-gray-300 font-medium`}>{`启用缩略图`}</Component1027>
                            <Component1028 className={`text-[10px] text-gray-500 mt-0.5`}>{`开启后可以提升页面的响应速度`}</Component1028>
                          </Component1029>
                          <Component1031 onClick={() => {
                        return Qr(!Zr);
                      }} className={`relative w-10 h-5 rounded-full transition-colors ${Zr ? `bg-blue-500` : `bg-gray-600`}`}>
                            <Component1030 className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${Zr ? `translate-x-5` : `translate-x-0`}`} />
                          </Component1031>
                        </Component1032>
                        <Component1038 className={`flex items-center justify-between mb-3 pt-3 border-t border-[#222]`}>
                          <Component1035 className={`flex flex-col`}>
                            <Component1033 className={`text-xs text-gray-300 font-medium`}>{`拖动画布性能模式`}</Component1033>
                            <Component1034 className={`text-[10px] text-gray-500 mt-0.5`}>{`开启后拖动画布时会临时隐藏媒体/控件，大画布更流畅`}</Component1034>
                          </Component1035>
                          <Component1037 onClick={() => {
                        return ei(!$r);
                      }} className={`relative w-10 h-5 rounded-full transition-colors ${$r ? `bg-blue-500` : `bg-gray-600`}`}>
                            <Component1036 className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${$r ? `translate-x-5` : `translate-x-0`}`} />
                          </Component1037>
                        </Component1038>
                        <Component1044 className={`flex items-center justify-between mb-3 pt-3 border-t border-[#222]`}>
                          <Component1041 className={`flex flex-col`}>
                            <Component1039 className={`text-xs text-gray-300 font-medium`}>{`缩放性能模式`}</Component1039>
                            <Component1040 className={`text-[10px] text-gray-500 mt-0.5`}>{`缩小画布时自动隐藏图片视频，提升渲染性能`}</Component1040>
                          </Component1041>
                          <Component1043 onClick={() => {
                        return ni(!ti);
                      }} className={`relative w-10 h-5 rounded-full transition-colors ${ti ? `bg-blue-500` : `bg-gray-600`}`}>
                            <Component1042 className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${ti ? `translate-x-5` : `translate-x-0`}`} />
                          </Component1043>
                        </Component1044>
                        <Component1045 className={`text-[10px] text-gray-500 leading-relaxed`}>{`开启后，画布上的图片节点和任务清单中的图片将使用缩略图显示，可显著减少内存占用并提升页面流畅度。关闭后将直接显示原图。`}</Component1045>
                      </Component1046>
                    </Component1047>
                    <Component1079 className={`group bg-[#1a1a1a] rounded-xl overflow-hidden transition-all duration-300 pb-4 shadow-sm border border-[#222]`}>
                      <Component1051 className={`flex justify-between items-center p-4 border-b border-[#222]`}>
                        <Component1049 className={`font-bold text-gray-200 text-sm flex items-center gap-2`}>
                          <Component1048 className={`text-cyan-400`}>
                            <_Component5 size={16} />
                          </Component1048>
                          {` 七牛云 S3 对象存储配置`}
                        </Component1049>
                        <Component1050 onClick={() => {
                      return ca(true);
                    }} className={`px-2 py-1 text-[10px] bg-[#333] hover:bg-[#444] text-gray-300 rounded transition-colors border border-[#444]`} title={`从 JSON 文本一键导入配置`}>{`JSON 导入`}</Component1050>
                      </Component1051>
                      <Component1078 className={`px-4 pt-4 pb-2`}>
                        {sa && <Component1059 className={`bg-[#0d0c0c] border border-[#444] rounded-lg p-4 mb-4 animate-fade-in relative`}>
                            <Component1052 onClick={() => {
                        ca(false);
                        da(la);
                      }} className={`absolute top-2 right-2 text-gray-500 hover:text-white`}>
                              <R size={16} />
                            </Component1052>
                            <Component1053 className={`text-xs font-bold text-gray-300 mb-2`}>{`粘贴 JSON 配置`}</Component1053>
                            <Component1054 className={`text-[10px] text-gray-500 mb-2`}>{`包含 accessKey, secretKey, bucket, endpoint, domain 任意字段即可。`}</Component1054>
                            <Component1055 value={ua} onChange={e => {
                        return da(e.target.value);
                      }} className={`w-full h-24 bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-cyan-500 font-mono mb-3`} placeholder={`{
  "accessKey": "...",
  "secretKey": "...",
  "bucket": "...",
  "endpoint": "..."
}`} />
                            <Component1058 className={`flex justify-end gap-2`}>
                              <Component1056 onClick={() => {
                          ca(false);
                          da(la);
                        }} className={`px-3 py-1.5 text-xs bg-[#222] hover:bg-[#333] text-gray-300 rounded transition-colors`}>{`取消`}</Component1056>
                              <Component1057 onClick={() => {
                          try {
                            if (!ua.trim()) {
                              $(`JSON 文本不能为空`);
                              return;
                            }
                            let e = JSON.parse(ua);
                            if (e.accessKey || e.secretKey || e.bucket || e.endpoint || e.domain) {
                              p({
                                accessKey: e.accessKey || f.accessKey,
                                secretKey: e.secretKey || f.secretKey,
                                bucket: e.bucket || f.bucket,
                                endpoint: e.endpoint || f.endpoint,
                                domain: e.domain || f.domain
                              });
                              ca(false);
                              da(``);
                              $(`JSON 导入成功，请记得点击保存`);
                            } else {
                              $(`无效的 JSON 格式或缺少必要字段`);
                            }
                          } catch {
                            $(`JSON 解析失败，请检查格式`);
                          }
                        }} className={`px-3 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors`}>{`确认导入`}</Component1057>
                            </Component1058>
                          </Component1059>}
                        <Component1060 className={`text-[11px] text-gray-400 mb-4`}>{`配置后可以使用画布中的【文件转链接】节点，将图片/视频等持久化存储到您的七牛云 Bucket。`}</Component1060>
                        <Component1077 className={`grid grid-cols-2 gap-4`}>
                          <Component1063>
                            <Component1061 className={`block text-[11px] font-medium text-gray-400 mb-1.5`}>{`Access Key (AK)`}</Component1061>
                            <Component1062 type={`password`} value={f.accessKey} onChange={e => {
                          return p({
                            ...f,
                            accessKey: e.target.value
                          });
                        }} className={`w-full bg-[#0d0c0c] border border-[#333] rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500 transition-colors`} placeholder={`例如：6LOdM9TU2SLPgR0DB...`} />
                          </Component1063>
                          <Component1066>
                            <Component1064 className={`block text-[11px] font-medium text-gray-400 mb-1.5`}>{`Secret Key (SK)`}</Component1064>
                            <Component1065 type={`password`} value={f.secretKey} onChange={e => {
                          return p({
                            ...f,
                            secretKey: e.target.value
                          });
                        }} className={`w-full bg-[#0d0c0c] border border-[#333] rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500 transition-colors`} placeholder={`例如：i8dfozxy0q5IPuuIOAM...`} />
                          </Component1066>
                          <Component1069>
                            <Component1067 className={`block text-[11px] font-medium text-gray-400 mb-1.5`}>{`Bucket 名称`}</Component1067>
                            <Component1068 type={`text`} value={f.bucket} onChange={e => {
                          return p({
                            ...f,
                            bucket: e.target.value
                          });
                        }} className={`w-full bg-[#0d0c0c] border border-[#333] rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500 transition-colors`} placeholder={`例如：yimaoai`} />
                          </Component1069>
                          <Component1072>
                            <Component1070 className={`block text-[11px] font-medium text-gray-400 mb-1.5`}>{`S3 Endpoint`}</Component1070>
                            <Component1071 type={`text`} value={f.endpoint} onChange={e => {
                          return p({
                            ...f,
                            endpoint: e.target.value
                          });
                        }} className={`w-full bg-[#0d0c0c] border border-[#333] rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500 transition-colors`} placeholder={`例如：s3.cn-south-1.qiniucs.com`} />
                          </Component1072>
                          <Component1076 className={`col-span-2`}>
                            <Component1073 className={`block text-[11px] font-medium text-gray-400 mb-1.5`}>{`外网访问域名 (可选)`}</Component1073>
                            <Component1074 type={`text`} value={f.domain} onChange={e => {
                          return p({
                            ...f,
                            domain: e.target.value
                          });
                        }} className={`w-full bg-[#0d0c0c] border border-[#333] rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500 transition-colors`} placeholder={`例如：http://tdfc98zdu.hn-bkt.clouddn.com`} />
                            <Component1075 className={`text-[9px] text-gray-500 mt-1`}>{`留空则自动使用 Endpoint 拼接`}</Component1075>
                          </Component1076>
                        </Component1077>
                      </Component1078>
                    </Component1079>
                  </Component1080>}
                {false}
                {W === `upgrade` && <_cmp_$t controller={fa} localToolStatus={r.status} />}
                {W === `endpoint` && <Component1081 className={`animate-fade-in`}>
                    <_cmp__Component43 onSaved={$} />
                  </Component1081>}
                {false}
              </Component1082>
            </Component1083>
            <Component1084 className={`absolute bottom-0 left-48 right-0 p-4 bg-gradient-to-t from-[#0d0c0c] via-[#0d0c0c] to-transparent z-20 flex justify-center pointer-events-none`} />
          </Component1085>
        </Component1086>
        {Cn && <Component1087 className={`absolute top-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white px-4 py-2 rounded-full text-sm z-50 animate-fade-in pointer-events-none`}>
            {En}
          </Component1087>}
        {T && D && <Component1131 className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center animate-fade-in`}>
            <Component1130 className={`bg-[#1a1a1a] rounded-xl border border-[#333] shadow-2xl max-w-md w-full mx-4 overflow-hidden`}>
              <Component1090 className={`px-6 py-4 border-b border-[#333] flex items-center justify-between`}>
                <Component1088 className={`text-lg font-bold text-gray-200 flex items-center gap-2`}>
                  <_Component4 size={18} className={`text-blue-400`} />
                  {`恢复默认配置`}
                </Component1088>
                <Component1089 onClick={() => {
              E(false);
              O(null);
            }} className={`text-gray-400 hover:text-gray-200 transition-colors`}>
                  <R size={18} />
                </Component1089>
              </Component1090>
              <Component1126 className={`p-6 space-y-4`}>
                <Component1094 className={`bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4`}>
                  <Component1093 className={`text-yellow-200 text-sm flex items-start gap-2`}>
                    <Component1091 className={`text-yellow-400 mt-0.5`}>{`⚠️`}</Component1091>
                    <Component1092>{`恢复默认配置将覆盖以下本地设置，请确认：`}</Component1092>
                  </Component1093>
                </Component1094>
                <Component1124 className={`bg-[#222] rounded-lg p-4 space-y-2 text-sm text-gray-300 max-h-60 overflow-y-auto`}>
                  <Component1099 className={`flex items-start gap-2`}>
                    <Component1095 className={`text-blue-400`}>{`•`}</Component1095>
                    <Component1098>
                      <Component1096 className={`font-medium text-gray-200`}>{`API 配置`}</Component1096>
                      <Component1097 className={`text-xs text-gray-500 mt-0.5`}>
                        {`将重置为 `}
                        {D.apiConfigs?.length || 0}
                        {` 个默认配置项`}
                      </Component1097>
                    </Component1098>
                  </Component1099>
                  <Component1106 className={`flex items-start gap-2`}>
                    <Component1100 className={`text-blue-400`}>{`•`}</Component1100>
                    <Component1105>
                      <Component1101 className={`font-medium text-gray-200`}>{`模型配置`}</Component1101>
                      <Component1104 className={`text-xs text-gray-500 mt-0.5`}>
                        {`文本模型: `}
                        {D.textModel?.split(`
`)[0] || `默认`}
                        <Component1102 />
                        {`绘图模型: `}
                        {D.drawingModel?.split(`
`)[0] || `默认`}
                        <Component1103 />
                        {`视频模型: `}
                        {D.videoModel?.split(`
`)[0] || `默认`}
                      </Component1104>
                    </Component1105>
                  </Component1106>
                  <Component1113 className={`flex items-start gap-2`}>
                    <Component1107 className={`text-blue-400`}>{`•`}</Component1107>
                    <Component1112>
                      <Component1108 className={`font-medium text-gray-200`}>{`任务配置`}</Component1108>
                      <Component1111 className={`text-xs text-gray-500 mt-0.5`}>
                        {`轮询间隔: `}
                        {D.globalPollingInterval}
                        {`s`}
                        <Component1109 />
                        {`最大轮询时长: `}
                        {D.globalMaxPollingDuration}
                        {`s`}
                        <Component1110 />
                        {`同步超时: `}
                        {D.globalSyncTimeout}
                        {`s`}
                      </Component1111>
                    </Component1112>
                  </Component1113>
                  <Component1118 className={`flex items-start gap-2`}>
                    <Component1114 className={`text-blue-400`}>{`•`}</Component1114>
                    <Component1117>
                      <Component1115 className={`font-medium text-gray-200`}>{`预设提示词`}</Component1115>
                      <Component1116 className={`text-xs text-gray-500 mt-0.5`}>
                        {D.presetPrompts?.length || 0}
                        {` 个预设模板`}
                      </Component1116>
                    </Component1117>
                  </Component1118>
                  <Component1123 className={`flex items-start gap-2`}>
                    <Component1119 className={`text-blue-400`}>{`•`}</Component1119>
                    <Component1122>
                      <Component1120 className={`font-medium text-gray-200`}>{`云存储配置`}</Component1120>
                      <Component1121 className={`text-xs text-gray-500 mt-0.5`}>{`将清空所有云存储凭证信息`}</Component1121>
                    </Component1122>
                  </Component1123>
                </Component1124>
                <Component1125 className={`text-xs text-gray-500 text-center`}>{`此操作不可撤销，确定要继续吗？`}</Component1125>
              </Component1126>
              <Component1129 className={`px-6 py-4 bg-[#161616] border-t border-[#333] flex justify-end gap-3`}>
                <Component1127 onClick={() => {
              E(false);
              O(null);
            }} className={`px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#333] rounded-lg transition-colors`}>{`取消`}</Component1127>
                <Component1128 onClick={async () => {
              try {
                Oi(D);
                E(false);
                O(null);
                q.success(`配置已恢复为默认设置`);
              } catch (e) {
                console.error(`恢复默认配置失败:`, e);
                q.error(`恢复配置失败，请重试`);
                E(false);
              }
            }} className={`px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors flex items-center gap-2`}>
                  <_Component4 size={14} />
                  {`确认恢复`}
                </Component1128>
              </Component1129>
            </Component1130>
          </Component1131>}
        {Wt && <Component1142 className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4`}>
            <Component1141 className={`bg-[#151414] rounded-3xl w-full max-w-[420px] shadow-2xl overflow-hidden relative`}>
              <Component1132 type={`button`} onClick={() => {
            return Gt(false);
          }} className={`absolute top-4 right-4 z-10 text-gray-400 hover:text-white transition-all duration-300 hover:rotate-90 p-1.5 rounded-full hover:bg-white/10 bg-black/10 backdrop-blur-md`} aria-label={`关闭登录弹窗`}>
                <R size={18} />
              </Component1132>
              <Component1139 className={`w-full pt-10 pb-2 flex flex-col items-center justify-center bg-[#151414]`}>
                <Component1138 className={`flex flex-col items-center gap-2`}>
                  <Component1136 className={`flex items-center gap-2`}>
                    <Component1134 viewBox={`0 0 20.7624 28.8621`} xmlns={`http://www.w3.org/2000/svg`} xmlnsXlink={`http://www.w3.org/1999/xlink`} width={`28`} height={`28`} fill={`none`}>
                      <Component1133 d={`M20.7624 0C0.868225 2.29614 0.393066 20.877 0 28.8621L1.21155 28.8621C1.21155 21.9207 4.94049 21.4546 8.42853 20.6113C13.6559 19.3462 17.0903 14.3184 17.95 10.2493L15.8051 9.17358L16.9758 7.71509C18.1466 6.25684 19.2449 4.14502 20.7624 0L20.7624 0Z`} fill={`rgb(210,2,7)`} fillRule={`evenodd`} />
                    </Component1134>
                    <Component1135 className={`text-2xl font-black tracking-wider text-white italic`}>{`一毛AI`}</Component1135>
                  </Component1136>
                  <Component1137 className={`text-sm text-gray-400 font-medium tracking-widest mt-1`}>{`省钱就用一毛AI`}</Component1137>
                </Component1138>
              </Component1139>
              <Component1140 className={`px-8 pb-10 pt-2 bg-[#151414]`}>
                <_cmp_Lt onLoginSuccess={e => {
              un(e);
              Fe(e => {
                return e + 1;
              });
              Gt(false);
            }} />
              </Component1140>
            </Component1141>
          </Component1142>}
        <_cmp__Component44 open={Kt} hasPassword={Y?.hasPassword} onClose={() => {
        return qt(false);
      }} onSuccess={() => {
        Yt(e => {
          return e && {
            ...e,
            hasPassword: true
          };
        });
      }} />
        <_cmp_Rt toasts={e} onRemove={t} />
      </Component1143>;
  }
}