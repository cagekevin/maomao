/**
 * 节点类型: imageBoxNode
 * 原版函数名: Ih
 * 原版行号: L28906-L29603
 * 来源: App-B9jVCs-a.decompiled.js
 *
 * 变量映射（vendor-map.json）:
// _ → tU
// _r → Rl
// _t → Rd
// a → ZK
// b → dT
// bt → Fd
// c → tK
// d → zG
// e → i
// f → MG
// ft → Ud
// g → qU
// h → xW
// i → jq
// in → Zu
// j → GE
// jn → wu
// k → cO
// l → VG
// m → LW
// mn → Vu
// mt → Vd
// n → Fq
// o → oK
// on → Yu
// p → VW
// qn → cu
// r → Nq
// rt → Bb
// s → iK
// t → e1
// u → BG
// ut → Gd
// v → XH
// vr → Ll
// w → xT
// x → Y
// y → Mk
// z → Rw
 */

  Ih = Y.memo(({
    id: e,
    data: i,
    selected: a
  }) => {
    let {
        updateNodeData: o
      } = Gt(),
      s = Y.useRef(null),
      c = i.images || [],
      l = Math.min(Math.max(0, i.activeIndex ?? 0), Math.max(0, c.length - 1)),
      u = i.expanded ?? false,
      d = i.selectedIds || [],
      f = c[l],
      [p, m] = Y.useState(false),
      [h, g] = Y.useState(null),
      [_, v] = Y.useState(null),
      [y, b] = Y.useState(null),
      [x, C] = Y.useState(null);
    Y.useEffect(() => {
      if (h === null) return;
      let e = e => {
          let t = e.target;
          !t.closest(`[data-thumb-menu]`) && !t.closest(`[data-thumb-menu-portal]`) && (g(null), v(null));
        },
        t = window.setTimeout(() => {
          window.addEventListener(`mousedown`, e, true), window.addEventListener(`click`, e, true);
        }, 0);
      return () => {
        window.clearTimeout(t), window.removeEventListener(`mousedown`, e, true), window.removeEventListener(`click`, e, true);
      };
    }, [h]);
    let w = Y.useCallback(t => o(e, {
        selectedIds: t
      }), [e, o]),
      T = Y.useCallback(e => {
        let t = new Set(d);
        t.has(e) ? t.delete(e) : t.add(e), w(Array.from(t));
      }, [d, w]),
      E = c.length > 0 && d.length === c.length,
      D = Y.useCallback(() => {
        w(E ? [] : c.map(e => e.id));
      }, [E, c, w]),
      O = Y.useCallback(async t => {
        if (t.length === 0) return;
        let n = await Promise.all(t.map(async e => {
            let t;
            try {
              t = await vr(e.url, 256, .7);
            } catch {
              t = undefined;
            }
            return {
              id: Ph(),
              url: e.url,
              thumb: t,
              label: e.label,
              source: e.source || `upload`,
              createdAt: Date.now()
            };
          })),
          r = [...c, ...n];
        o(e, {
          images: r,
          activeIndex: r.length - 1
        });
      }, [c, e, o]),
      k = Y.useCallback(t => {
        let n = c[t],
          r = c.filter((e, n) => n !== t);
        o(e, {
          images: r,
          activeIndex: Math.min(l, Math.max(0, r.length - 1)),
          selectedIds: n ? d.filter(e => e !== n.id) : d
        });
      }, [l, c, e, d, o]),
      A = Y.useCallback(() => {
        if (d.length === 0) return;
        let t = new Set(d),
          n = c.filter(e => !t.has(e.id));
        o(e, {
          images: n,
          activeIndex: Math.min(l, Math.max(0, n.length - 1)),
          selectedIds: []
        });
      }, [l, c, e, d, o]),
      j = Y.useCallback(t => {
        t < 0 || t >= c.length || o(e, {
          activeIndex: t
        });
      }, [e, c.length, o]),
      M = Y.useCallback((t, n) => {
        if (t === n || t < 0 || n < 0 || t >= c.length || n >= c.length) return;
        let r = c.slice(),
          [i] = r.splice(t, 1);
        r.splice(n, 0, i), i.id;
        let a = l,
          s = c[l]?.id;
        s && (a = r.findIndex(e => e.id === s), a < 0 && (a = 0)), o(e, {
          images: r,
          activeIndex: a
        });
      }, [l, e, c, o]),
      N = Y.useCallback(() => {
        c.length <= 1 || j((l - 1 + c.length) % c.length);
      }, [l, c.length, j]),
      P = Y.useCallback(() => {
        c.length <= 1 || j((l + 1) % c.length);
      }, [l, c.length, j]),
      F = Y.useCallback(t => {
        o(e, {
          expanded: t
        });
      }, [e, o]),
      I = t({
        handleType: `target`
      }),
      L = ut(Y.useMemo(() => I.map(e => e.source), [I])),
      ee = Y.useMemo(() => {
        if (!L) return [];
        let e = Array.isArray(L) ? L : [L],
          t = [];
        return e.forEach(e => {
          e && (typeof e.data?.imageUrl == `string` && (e.data.imageUrl.startsWith(`http`) || e.data.imageUrl.startsWith(`data:image`)) && t.push({
            id: e.id,
            url: e.data.imageUrl
          }), e.type === `imageBoxNode` && Array.isArray(e.data?.images) && e.data.images.forEach(n => {
            n?.url && t.push({
              id: `${e.id}-${n.id}`,
              url: n.url
            });
          }), e.type === `videoExtractNode` && Array.isArray(e.data?.extractedImages) && e.data.extractedImages.forEach((n, r) => {
            n && t.push({
              id: `${e.id}-ext-${r}`,
              url: n
            });
          }));
        }), t;
      }, [L]),
      R = Y.useCallback(async e => {
        let t = Array.from(e).filter(e => e.type.startsWith(`image/`));
        return (await Promise.all(t.map(e => new Promise(t => {
          let n = new FileReader();
          n.onload = () => t({
            url: n.result,
            label: e.name
          }), n.onerror = () => t(null), n.readAsDataURL(e);
        })))).filter(Boolean);
      }, []),
      z = Y.useCallback(async e => {
        let t = await R(e);
        t.length !== 0 && O(t.map(e => ({
          ...e,
          source: `upload`
        })));
      }, [O, R]);
    Y.useEffect(() => {
      if (!a) return;
      let e = async e => {
        if (!e.clipboardData) return;
        let t = document.activeElement;
        if (t && (t.tagName === `INPUT` || t.tagName === `TEXTAREA` || t.isContentEditable)) return;
        let n = Array.from(e.clipboardData.items).filter(e => e.kind === `file` && e.type.startsWith(`image/`)).map(e => e.getAsFile()).filter(Boolean);
        if (n.length > 0) {
          e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation(), O((await R(n)).map(e => ({
            ...e,
            source: `paste`
          })));
          return;
        }
        let r = e.clipboardData.getData(`text/plain`).trim();
        r && (r.startsWith(`http`) || r.startsWith(`data:image/`)) && (e.preventDefault(), e.stopPropagation(), e.stopImmediatePropagation(), O([{
          url: r,
          source: `paste`
        }]));
      };
      return window.addEventListener(`paste`, e, true), () => window.removeEventListener(`paste`, e, true);
    }, [a, O, R]);
    let B = Y.useCallback(async e => {
        if (e.preventDefault(), e.stopPropagation(), m(false), y !== null) {
          b(null), C(null);
          return;
        }
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          let t = await R(e.dataTransfer.files);
          if (t.length > 0) {
            O(t.map(e => ({
              ...e,
              source: `drop`
            })));
            return;
          }
        }
        let t = e.dataTransfer.getData(`text/plain`) || e.dataTransfer.getData(`text/uri-list`);
        t && (t.startsWith(`http`) || t.startsWith(`data:image/`)) && O([{
          url: t,
          source: `drop`
        }]);
      }, [O, R, y]),
      te = Y.useCallback(e => {
        e.preventDefault(), e.stopPropagation(), y === null && (p || m(true));
      }, [p, y]),
      ne = Y.useCallback(e => {
        e.currentTarget === e.target && m(false);
      }, []),
      re = Y.useCallback(() => {
        if (ee.length === 0) {
          i.onShowToast?.(`当前没有上游连线提供图片`);
          return;
        }
        let e = new Set(c.map(e => e.url)),
          t = ee.filter(t => !e.has(t.url));
        if (t.length === 0) {
          i.onShowToast?.(`上游连线图片已全部导入`);
          return;
        }
        O(t.map(e => ({
          url: e.url,
          source: `connect`
        }))), i.onShowToast?.(`已导入 ${t.length} 张连线图`);
      }, [O, i.onShowToast, c, ee]),
      ie = Y.useCallback(e => {
        if (e.stopPropagation(), !f) return;
        let t = document.createElement(`a`);
        t.href = f.url, t.download = f.label || `image-${Date.now()}.png`, document.body.appendChild(t), t.click(), document.body.removeChild(t);
      }, [f]),
      ae = Y.useCallback(t => {
        t.stopPropagation(), f && i.onZoom?.(e, undefined, f.url);
      }, [f, i.onZoom, e]),
      se = Y.useCallback(e => {
        e.stopPropagation(), f && i.onSendToActiveTab?.(f.url);
      }, [f, i.onSendToActiveTab]),
      ce = c.length,
      le = Y.useCallback(async e => {
        let t = i.onShowToast;
        try {
          let n = new Image();
          n.crossOrigin = `anonymous`, n.src = e, await new Promise((e, t) => {
            n.onload = () => e(), n.onerror = () => t(Error(`image load failed`));
          });
          let r = document.createElement(`canvas`);
          r.width = n.naturalWidth || n.width, r.height = n.naturalHeight || n.height;
          let i = r.getContext(`2d`);
          if (!i) throw Error(`canvas ctx`);
          i.drawImage(n, 0, 0), await new Promise((e, t) => {
            r.toBlob(async n => {
              if (!n) return t(Error(`blob null`));
              try {
                await navigator.clipboard.write([new ClipboardItem({
                  "image/png": n
                })]), e();
              } catch (e) {
                t(e);
              }
            }, `image/png`);
          }), t?.(`图片已复制，可以在画布中粘贴`);
        } catch {
          try {
            await navigator.clipboard.writeText(e), t?.(`图片链接已复制（直接复制图片失败）`);
          } catch {
            t?.(`复制失败，可能因跨域或权限限制`);
          }
        }
      }, [i.onShowToast]),
      V = Y.useCallback(async () => {
        let e = i.onShowToast,
          t = new Set(d),
          n = t.size > 0 ? c.filter(e => t.has(e.id)) : c;
        if (n.length === 0) {
          e?.(`没有可发送的图片`);
          return;
        }
        e?.(`正在发送 ${n.length} 张到剪映…`);
        let r = await qn(n.map(e => ({
          fileUrl: e.url,
          fileName: Kn(e.url, `png`)
        })));
        e?.(r.message);
      }, [c, d, i.onShowToast]),
      H = Y.useCallback((e, t) => {
        if (!e) return;
        let n = document.createElement(`a`);
        n.href = e, n.download = t || `image-${Date.now()}.png`, document.body.appendChild(n), n.click(), document.body.removeChild(n);
      }, []);
    return X.jsxs(`div`, {
      className: `relative w-full h-full group/node`,
      children: [X.jsx(ci, {
        visible: !!a,
        minWidth: 240,
        minHeight: u ? 280 : 200
      }), X.jsx(`input`, {
        ref: s,
        type: `file`,
        accept: `image/*`,
        multiple: true,
        style: {
          display: `none`
        },
        onChange: async e => {
          e.target.files && (await z(e.target.files), e.target.value = ``);
        }
      }), X.jsx(`div`, {
        className: `absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`,
        children: X.jsxs(`div`, {
          className: `flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`,
          children: [X.jsx(`button`, {
            className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`,
            title: `从连线图一键导入`,
            onClick: e => {
              e.stopPropagation(), re();
            },
            children: X.jsx(ye, {
              size: 14
            })
          }), X.jsx(`button`, {
            className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`,
            title: `添加本地图片`,
            onClick: e => {
              e.stopPropagation(), s.current?.click();
            },
            children: X.jsx(r, {
              size: 14
            })
          }), ce > 0 && X.jsx(`button`, {
            className: `p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-[#333] rounded-md`,
            title: d.length > 0 ? `发送选中 ${d.length} 张到剪映` : `发送全部到剪映`,
            onClick: e => {
              e.stopPropagation(), V();
            },
            children: X.jsx(`svg`, {
              viewBox: `0 0 1389 1024`,
              width: `14`,
              height: `14`,
              fill: `currentColor`,
              "aria-hidden": `true`,
              children: X.jsx(`path`, {
                d: `M1140.11 150.95l243.537-120.088c0 33.024 0.24 63.046 0 93.188-0.24 22.096 6.124 48.636-3.843 65.208-9.607 15.611-36.266 21.015-55.6 30.622L737.457 510.852c6.004 3.482 10.327 6.485 15.01 8.766 204.99 101.834 410.1 203.428 615.208 304.902 12.13 6.004 16.212 12.49 15.972 25.819-0.84 45.753-0.24 91.506-0.24 141.103l-239.935-118.407c-12.97 24.498-23.537 50.197-39.028 72.293-37.227 53.199-91.507 77.456-154.913 77.697-250.742 0.96-501.365 0.96-752.107 0.24-97.271 0-176.289-65.328-190.94-161.638C0 817.915 3.604 772.642 6.005 728.33c0.48-9.247 14.05-20.775 24.258-25.819 111.681-56.44 223.723-111.801 335.764-167.402l47.555-23.657c-125.972-62.685-249.782-124.89-374.312-185.655-24.859-12.009-37.228-26.78-35.066-55.24 2.882-40.59-1.441-81.9 5.044-121.649C23.057 64.367 103.395 0.6 189.257 0.6 443.844 0.6 698.429 0.96 952.894 0.36c87.904-0.24 157.315 60.524 181.933 134.858l5.164 15.732z m-566.332-8.767H207.51a105.677 105.677 0 0 0-27.98 3.603c-20.415 5.524-31.343 21.135-33.505 43.232-1.921 20.054 3.363 31.943 24.018 42.03 125.851 60.524 250.982 122.49 375.153 185.895 21.616 11.048 38.188 11.169 60.043 0 125.132-63.406 251.223-125.13 376.715-187.696 6.364-3.122 15.13-7.686 16.812-13.21 12.009-40.95-13.57-74.094-56.681-74.094l-368.308 0.36z m0 736.857H949.89c31.223 0 48.035-16.812 49.356-47.795a67.009 67.009 0 0 0-0.24-18.974c-1.561-5.524-4.803-12.85-9.487-15.13-134.498-67.25-268.996-134.138-403.854-200.307a26.9 26.9 0 0 0-20.775 0 86586.855 86586.855 0 0 0-408.897 202.348c-3.843 2.041-9.007 6.364-9.367 10.087-4.203 38.188 11.528 70.852 55 70.371 123.93-1.44 248.1-0.48 372.27-0.48v-0.12z`
              })
            })
          }), !u && f && X.jsxs(X.Fragment, {
            children: [X.jsx(`div`, {
              className: `w-px h-4 bg-[#333] mx-1`
            }), X.jsx(`button`, {
              className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`,
              title: `放大`,
              onClick: ae,
              children: X.jsx(rt, {
                size: 14
              })
            }), X.jsx(`button`, {
              className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`,
              title: `发送到左侧网站`,
              onClick: se,
              children: X.jsx(Rn, {
                size: 14
              })
            }), X.jsx(`button`, {
              className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`,
              title: `复制当前图片到剪贴板`,
              onClick: e => {
                e.stopPropagation(), f && le(f.url);
              },
              children: X.jsx(on, {
                size: 14
              })
            }), X.jsx(`button`, {
              className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`,
              title: `下载当前图片`,
              onClick: ie,
              children: X.jsx(mn, {
                size: 14
              })
            })]
          })]
        })
      }), X.jsxs(`div`, {
        className: `flex justify-between items-center w-full mb-1`,
        children: [X.jsx(si, {
          id: e,
          data: i,
          defaultTitle: `图片盒子`,
          icon: X.jsx(Ce, {
            size: 11,
            className: `text-gray-500`
          }),
          className: `!mb-0`
        }), X.jsxs(`div`, {
          className: `flex items-center gap-1 nodrag`,
          children: [u && ce > 0 && X.jsxs(X.Fragment, {
            children: [X.jsxs(`button`, {
              onClick: e => {
                e.stopPropagation(), D();
              },
              className: `px-1.5 py-0.5 rounded hover:bg-[#333] text-gray-400 hover:text-white inline-flex items-center gap-1 text-[10px]`,
              title: E ? `取消全选` : `全选`,
              children: [E ? X.jsx(ue, {
                size: 10
              }) : X.jsx(oe, {
                size: 10
              }), X.jsx(`span`, {
                children: `全选`
              })]
            }), d.length > 0 && X.jsxs(X.Fragment, {
              children: [X.jsxs(`span`, {
                className: `text-gray-300 text-[10px]`,
                children: [`已选 `, d.length]
              }), X.jsx(`button`, {
                onClick: e => {
                  e.stopPropagation(), A();
                },
                className: `px-1.5 py-0.5 rounded hover:bg-[#333] hover:text-red-400 text-gray-400 inline-flex items-center gap-1 text-[10px]`,
                title: `删除已选`,
                children: X.jsx(S, {
                  size: 10
                })
              })]
            })]
          }), X.jsxs(`button`, {
            onClick: e => {
              e.stopPropagation(), F(!u);
            },
            className: `px-1.5 py-0.5 rounded hover:bg-[#333] text-gray-400 hover:text-white inline-flex items-center gap-1 text-[10px] transition-colors`,
            title: u ? `折叠为单图` : `展开为缩略图网格`,
            children: [u ? X.jsx(ft, {
              size: 11
            }) : X.jsx(bt, {
              size: 11
            }), X.jsx(`span`, {
              children: u ? `折叠` : `展开`
            })]
          })]
        })]
      }), X.jsxs(`div`, {
        className: `relative w-full h-full flex-1 min-h-0`,
        children: [X.jsxs(`div`, {
          className: `bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 w-full h-full flex flex-col ${a ? `border-[#555]` : p ? `border-gray-400` : `border-[#333] hover:border-[#444]`}`,
          onDrop: B,
          onDragOver: te,
          onDragLeave: ne,
          children: [X.jsx(_r, {
            type: `target`,
            position: J.Left,
            id: `in`
          }), X.jsx(_r, {
            type: `source`,
            position: J.Right,
            id: `active`
          }), X.jsxs(`div`, {
            className: `flex-1 bg-[#121212] flex items-center justify-center relative overflow-hidden`,
            children: [ce === 0 && X.jsxs(`div`, {
              className: `flex flex-col items-center justify-center absolute inset-0 bg-[#151515] hover:bg-[#1a1a1a] transition-colors cursor-pointer group`,
              onClick: e => {
                e.stopPropagation(), s.current?.click();
              },
              children: [X.jsx(`div`, {
                className: `w-12 h-12 rounded-xl bg-[#222] border border-dashed border-[#444] group-hover:border-blue-500/50 flex flex-col items-center justify-center transition-all`,
                children: X.jsx(Ot, {
                  size: 20,
                  className: `text-gray-600 group-hover:text-blue-500/80 transition-colors`
                })
              }), X.jsx(`div`, {
                className: `text-[10px] text-gray-500 mt-2`,
                children: `拖拽 / 粘贴 / 点击添加图片`
              })]
            }), !u && f && X.jsxs(X.Fragment, {
              children: [X.jsx(`img`, {
                src: f.url,
                alt: f.label || `图片 ${l + 1}`,
                className: `w-full h-full object-contain cursor-pointer`,
                draggable: false,
                loading: `lazy`,
                decoding: `async`,
                onDoubleClick: t => {
                  t.stopPropagation(), i.onZoom?.(e, undefined, f.url);
                }
              }), ce > 1 && X.jsx(X.Fragment, {
                children: X.jsxs(`div`, {
                  className: `absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-1.5 py-1 rounded-full bg-black/60 backdrop-blur-sm opacity-0 group-hover/node:opacity-100 transition-opacity`,
                  children: [X.jsx(`button`, {
                    onClick: e => {
                      e.stopPropagation(), N();
                    },
                    className: `w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center`,
                    title: `上一张`,
                    children: X.jsx(Ge, {
                      size: 14
                    })
                  }), X.jsxs(`span`, {
                    className: `px-1 text-[10px] text-white tabular-nums select-none`,
                    children: [l + 1, `/`, ce]
                  }), X.jsx(`button`, {
                    onClick: e => {
                      e.stopPropagation(), P();
                    },
                    className: `w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center`,
                    title: `下一张`,
                    children: X.jsx(_t, {
                      size: 14
                    })
                  })]
                })
              })]
            }), u && ce > 0 && X.jsx(`div`, {
              className: `absolute inset-0 overflow-auto p-2 nowheel`,
              children: X.jsxs(`div`, {
                className: `grid gap-1.5`,
                style: {
                  gridTemplateColumns: `repeat(auto-fill, minmax(72px, 1fr))`
                },
                children: [c.map((t, r) => {
                  let a = d.includes(t.id),
                    o = r === l;
                  return X.jsxs(`div`, {
                    draggable: true,
                    onDragStart: e => {
                      e.stopPropagation(), e.dataTransfer.effectAllowed = `move`;
                      try {
                        e.dataTransfer.setData(`text/plain`, String(r));
                      } catch {}
                      b(r);
                    },
                    onDragEnter: e => {
                      e.preventDefault(), e.stopPropagation(), y !== null && y !== r && C(r);
                    },
                    onDragOver: e => {
                      y !== null && (e.preventDefault(), e.stopPropagation(), e.dataTransfer.dropEffect = `move`, x !== r && C(r));
                    },
                    onDragLeave: e => {
                      y !== null && e.stopPropagation();
                    },
                    onDrop: e => {
                      y !== null && (e.preventDefault(), e.stopPropagation(), y !== r && M(y, r), b(null), C(null));
                    },
                    onDragEnd: e => {
                      e.stopPropagation(), b(null), C(null);
                    },
                    className: `relative aspect-square rounded-md overflow-hidden border cursor-grab active:cursor-grabbing group/thumb transition-all nodrag ${x === r && y !== null && y !== r ? `border-blue-400 ring-2 ring-blue-400/60 scale-[1.03]` : o ? `border-blue-500` : a ? `border-emerald-500` : `border-[#333]`} ${y === r ? `opacity-40` : ``}`,
                    onClick: e => {
                      e.stopPropagation(), e.shiftKey || e.ctrlKey || e.metaKey ? j(r) : T(t.id);
                    },
                    onDoubleClick: n => {
                      n.stopPropagation(), i.onZoom?.(e, undefined, t.url);
                    },
                    title: t.label || (a ? `点击取消选择` : `点击选择 (按住 Ctrl 设为默认图)`),
                    children: [X.jsx(Fh, {
                      src: t.thumb || t.url,
                      className: `w-full h-full bg-[#0e0e0e]`
                    }), X.jsx(`button`, {
                      onClick: e => {
                        e.stopPropagation(), T(t.id);
                      },
                      className: `absolute top-1 left-1 w-4 h-4 rounded flex items-center justify-center transition-colors ${a ? `bg-emerald-500 text-white` : `bg-black/50 text-gray-300 group-hover/thumb:bg-black/70`}`,
                      title: a ? `取消选择` : `选择`,
                      children: a ? X.jsx(ue, {
                        size: 10
                      }) : X.jsx(oe, {
                        size: 10
                      })
                    }), o && X.jsx(`span`, {
                      className: `absolute bottom-1 left-1 px-1 py-px rounded bg-blue-500 text-white text-[8px] font-medium`,
                      children: `默认`
                    }), X.jsx(`div`, {
                      className: `absolute top-1 right-1`,
                      "data-thumb-menu": true,
                      children: X.jsx(`button`, {
                        onMouseDown: e => e.stopPropagation(),
                        onDoubleClick: e => e.stopPropagation(),
                        onClick: e => {
                          if (e.stopPropagation(), h === r) g(null), v(null);else {
                            let t = e.currentTarget.getBoundingClientRect(),
                              n = t.right - 130;
                            n < 8 && (n = 8), n + 130 > window.innerWidth - 8 && (n = window.innerWidth - 8 - 130);
                            let i = t.bottom + 4;
                            i + 220 > window.innerHeight - 8 && (i = t.top - 220 - 4), g(r), v({
                              top: i,
                              left: n
                            });
                          }
                        },
                        className: `w-4 h-4 rounded bg-black/60 text-gray-200 hover:bg-blue-500 hover:text-white flex items-center justify-center transition-opacity ${h === r ? `opacity-100` : `opacity-0 group-hover/thumb:opacity-100`}`,
                        title: `更多操作`,
                        children: X.jsx(n, {
                          size: 10
                        })
                      })
                    })]
                  }, t.id);
                }), X.jsx(`button`, {
                  onClick: e => {
                    e.stopPropagation(), s.current?.click();
                  },
                  className: `aspect-square rounded-md border border-dashed border-[#444] hover:border-blue-500/50 hover:bg-[#1a1a1a] text-gray-500 hover:text-blue-400 flex items-center justify-center transition-colors nodrag`,
                  title: `添加图片`,
                  children: X.jsx(r, {
                    size: 16
                  })
                })]
              })
            }), p && X.jsx(`div`, {
              className: `absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-400 flex items-center justify-center pointer-events-none`,
              children: X.jsxs(`div`, {
                className: `px-3 py-1.5 rounded-md bg-[#1c1c1c] border border-blue-500/40 text-blue-300 text-xs flex items-center gap-1.5`,
                children: [X.jsx(jn, {
                  size: 12
                }), ` 松开以加入图片盒子`]
              })
            })]
          })]
        }), h !== null && _ && c[h] && Un.createPortal(X.jsx(`div`, {
          "data-thumb-menu-portal": true,
          className: `fixed z-[99999] min-w-[130px] bg-[#1c1c1c] border border-[#333] rounded-md shadow-2xl p-1 nodrag nowheel`,
          style: {
            top: _.top,
            left: _.left
          },
          onClick: e => e.stopPropagation(),
          onContextMenu: e => e.preventDefault(),
          children: (() => {
            let t = h,
              n = c[t],
              r = () => {
                g(null), v(null);
              };
            return X.jsxs(X.Fragment, {
              children: [X.jsxs(`button`, {
                className: `w-full text-left px-2 py-1.5 text-[11px] text-gray-300 hover:bg-[#333] hover:text-white rounded flex items-center gap-2`,
                onClick: () => {
                  le(n.url), r();
                },
                children: [X.jsx(on, {
                  size: 11,
                  className: `text-gray-400`
                }), X.jsx(`span`, {
                  children: `复制图片`
                })]
              }), X.jsxs(`button`, {
                className: `w-full text-left px-2 py-1.5 text-[11px] text-gray-300 hover:bg-[#333] hover:text-white rounded flex items-center gap-2`,
                onClick: () => {
                  H(n.url, n.label), r();
                },
                children: [X.jsx(mn, {
                  size: 11,
                  className: `text-gray-400`
                }), X.jsx(`span`, {
                  children: `下载`
                })]
              }), X.jsxs(`button`, {
                className: `w-full text-left px-2 py-1.5 text-[11px] text-gray-300 hover:bg-[#333] hover:text-white rounded flex items-center gap-2`,
                onClick: () => {
                  i.onZoom?.(e, undefined, n.url), r();
                },
                children: [X.jsx(rt, {
                  size: 11,
                  className: `text-gray-400`
                }), X.jsx(`span`, {
                  children: `放大查看`
                })]
              }), X.jsxs(`button`, {
                className: `w-full text-left px-2 py-1.5 text-[11px] text-gray-300 hover:bg-[#333] hover:text-white rounded flex items-center gap-2`,
                onClick: () => {
                  i.onSendToActiveTab?.(n.url), r();
                },
                children: [X.jsx(Rn, {
                  size: 11,
                  className: `text-gray-400`
                }), X.jsx(`span`, {
                  children: `发送`
                })]
              }), t !== l && X.jsxs(`button`, {
                className: `w-full text-left px-2 py-1.5 text-[11px] text-gray-300 hover:bg-[#333] hover:text-white rounded flex items-center gap-2`,
                onClick: () => {
                  j(t), r();
                },
                children: [X.jsx(bt, {
                  size: 11,
                  className: `text-gray-400`
                }), X.jsx(`span`, {
                  children: `设为默认`
                })]
              }), X.jsx(`div`, {
                className: `h-[1px] bg-[#333] my-1`
              }), X.jsxs(`button`, {
                className: `w-full text-left px-2 py-1.5 text-[11px] text-red-400 hover:bg-[#333] rounded flex items-center gap-2`,
                onClick: () => {
                  k(t), r();
                },
                children: [X.jsx(S, {
                  size: 11
                }), X.jsx(`span`, {
                  children: `从盒子删除`
                })]
              })]
            });
          })()
        }), document.body)]
      })]
    });
  }),