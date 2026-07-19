/**
 * 节点类型: imageNode
 * 原版函数名: li
 * 原版行号: L2000-L2336
 * 来源: App-B9jVCs-a.decompiled.js
 *
 * 变量映射（vendor-map.json）:
// _ → tU
// _r → Rl
// a → ZK
// an → Xu
// c → tK
// d → zG
// e → i
// f → MG
// g → qU
// h → xW
// i → jq
// jn → wu
// l → VG
// m → LW
// mn → Vu
// n → Fq
// o → oK
// p → VW
// pr → Hl
// qt → cd
// r → Nq
// rt → Bb
// s → iK
// t → e1
// tn → ed
// u → BG
// v → XH
// vn → Lu
// w → xT
// x → Y
// yr → Il
// z → Rw
 */

var li = Y.memo(({
  id: e,
  data: t,
  selected: n,
  width: r
}) => {
  let {
      updateNodeData: i
    } = Gt(),
    a = Y.useRef(null),
    [o, s] = Y.useState(false),
    {
      useThumbnail: c
    } = pr(),
    l = t.imageUrl,
    u = t.imageUrlRef,
    d = t.thumbnailUrl,
    f = t.imageAvailable,
    p = oi(r ?? t._styleWidth ?? 420),
    m = Y.useMemo(() => l ? l.startsWith(`data:video/`) || /\.(mp4|webm|mov|mkv|avi|m4v)($|\?)/i.test(l) ? `video` : l.startsWith(`data:audio/`) || /\.(mp3|wav|ogg|m4a|flac|aac|opus|wma|aiff)($|\?)/i.test(l) ? `audio` : l.startsWith(`data:text/`) || /\.(txt|md|json|csv)($|\?)/i.test(l) ? `text` : `image` : `empty`, [l]),
    h = Y.useMemo(() => c ? Lr(l, p, `image`) || d || l : l || d, [c, l, d, p]),
    g = Y.useMemo(() => {
      if (c && f) {
        let e = Br(l, p);
        if (e) return e;
      }
      return d;
    }, [c, f, l, d, p]),
    _ = Y.useMemo(() => zr(l), [l]),
    v = Y.useRef(null);
  return Y.useEffect(() => {
    if (m !== `video` || !l || f || !l.includes(`/files/`) || v.current === l) return;
    v.current = l;
    let t = false;
    return (async () => {
      let n = await ai(l);
      !t && n && i(e, {
        imageAvailable: true
      });
    })(), () => {
      t = true;
    };
  }, [e, m, l, f, i]), X.jsxs(`div`, {
    className: `relative group/node w-full h-full min-w-[120px] min-h-[80px]`,
    children: [X.jsx(si, {
      id: e,
      data: t,
      defaultTitle: m === `video` ? `视频` : m === `audio` ? `音频` : m === `text` ? `文本文件` : `图片`,
      icon: m === `video` ? X.jsx(D, {
        size: 11
      }) : m === `audio` ? X.jsx(qt, {
        size: 11
      }) : m === `text` ? X.jsx(R, {
        size: 11
      }) : X.jsx(Ot, {
        size: 11
      })
    }), X.jsx(ci, {
      visible: !!n,
      minWidth: 120,
      minHeight: 80
    }), X.jsx(`input`, {
      type: `file`,
      ref: a,
      style: {
        display: `none`
      },
      accept: `image/*,video/*,audio/*,text/plain`,
      multiple: true,
      onChange: async t => {
        let n = t.target.files?.[0];
        if (!n) return;
        t.target.value = ``;
        let r = n.type.startsWith(`image/`);
        try {
          let t = await ii(n, {
            subfolder: `canvas/upload`,
            preferThumbnail: r,
            thumbMaxDim: 480,
            thumbQuality: 75
          });
          if (t.url && /^https?:\/\//i.test(t.url)) {
            i(e, {
              imageUrl: t.url,
              thumbnailUrl: t.thumbnailUrl,
              label: n.name,
              imageUrlRef: undefined
            });
            return;
          }
        } catch (e) {
          console.warn(`[ImageNode] urlifyAsset failed, fallback to base64:`, e);
        }
        let a = new FileReader();
        a.onload = t => {
          let r = t.target?.result;
          i(e, {
            imageUrl: r,
            thumbnailUrl: undefined,
            label: n.name
          });
        }, a.onerror = () => {
          console.error(`File read failed`);
        }, a.readAsDataURL(n);
      }
    }), X.jsx(`div`, {
      className: `absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`,
      children: X.jsxs(`div`, {
        className: `flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`,
        children: [X.jsx(`button`, {
          className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`,
          title: `上传/替换`,
          onClick: e => {
            e.stopPropagation(), a.current?.click();
          },
          children: X.jsx(jn, {
            size: 14
          })
        }), (m === `image` || m === `empty`) && X.jsxs(X.Fragment, {
          children: [X.jsx(`button`, {
            className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`,
            title: `放大`,
            onClick: n => {
              n.stopPropagation(), t.onZoom && t.onZoom(e, u, l);
            },
            children: X.jsx(rt, {
              size: 14
            })
          }), X.jsx(`button`, {
            className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`,
            title: `裁剪`,
            onClick: n => {
              n.stopPropagation(), t.onCrop && t.onCrop(e, l, u);
            },
            children: X.jsx(Wt, {
              size: 14
            })
          }), X.jsx(`button`, {
            className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`,
            title: `编辑`,
            onClick: n => {
              n.stopPropagation(), t.onEdit && t.onEdit(e, u, l);
            },
            children: X.jsx(an, {
              size: 14
            })
          })]
        }), l && l.startsWith(`http`) && m === `image` && X.jsx(`button`, {
          className: `p-1.5 text-blue-400 hover:text-blue-300 hover:bg-[#333] rounded-md`,
          title: `将URL转换为Base64内嵌数据 (解决跨域/跨设备问题)`,
          onClick: async n => {
            n.stopPropagation();
            try {
              i(e, {
                imageUrl: await yr(l, 2048, .85)
              }), t.onShowToast?.(`已转换为 Base64 内嵌格式`);
            } catch {
              t.onShowToast?.(`转换失败: 可能是跨域问题`);
            }
          },
          children: X.jsx(tn, {
            size: 14
          })
        }), X.jsx(`div`, {
          className: `w-px h-4 bg-[#333] mx-1`
        }), X.jsx(`button`, {
          className: `p-1.5 text-gray-400 hover:text-blue-400 hover:bg-[#333] rounded-md`,
          title: `发送到左侧网站`,
          onClick: e => {
            e.stopPropagation(), t.onSendToActiveTab && l && t.onSendToActiveTab(l);
          },
          children: X.jsx(Rn, {
            size: 14
          })
        }), X.jsx(Yn, {
          url: l,
          fallbackExt: m === `video` ? `mp4` : `png`,
          onToast: e => t.onShowToast?.(e)
        }), X.jsx(`button`, {
          className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`,
          title: `下载`,
          onClick: async t => {
            t.stopPropagation();
            let n = l,
              r = false;
            if (console.log(`[ImageNode] 下载开始:`, {
              nodeId: e,
              imageUrlRef: u,
              currentImageType: typeof l,
              currentImageLength: l?.length
            }), u) try {
              console.log(`[ImageNode] 尝试读取原图, key=${u}`);
              let e = await Q.getConfig(u);
              console.log(`[ImageNode] storage.getConfig 返回:`, {
                type: typeof e,
                isNull: e === null,
                isUndefined: e === undefined,
                isString: typeof e == `string`,
                length: e?.length,
                currentLength: l?.length,
                equal: e === l,
                first100: e?.substring(0, 100),
                currentFirst100: l?.substring(0, 100)
              }), e && typeof e == `string` && e.length > 1e4 ? (n = e, r = true, console.log(`[ImageNode] 下载使用原图成功, size:`, e.length)) : console.log(`[ImageNode] 原图未找到或数据异常，使用当前图片`);
            } catch (e) {
              console.warn(`[ImageNode] 获取原图失败，使用当前图片:`, e);
            } else console.log(`[ImageNode] 无原图引用(imageUrlRef)，下载当前图片`);
            let i = n.length < 5e4 && n.startsWith(`data:image`);
            if (console.log(`[ImageNode] 开始下载:`, {
              useOriginal: r,
              isLikelyThumbnail: i,
              urlLength: n.length,
              isBase64: n.startsWith(`data:image`),
              isHttp: n.startsWith(`http`)
            }), n) {
              let e = `png`;
              if (m === `video` && (e = `mp4`), m === `audio` && (e = `mp3`), m === `text` && (e = `txt`), typeof chrome < `u` && chrome.downloads) chrome.downloads.download({
                url: n,
                filename: `yimao/file-${Date.now()}.${e}`,
                saveAs: false
              });else {
                let t = document.createElement(`a`);
                t.href = n, t.download = `file-${Date.now()}.${e}`, document.body.appendChild(t), t.click(), document.body.removeChild(t);
              }
            }
          },
          children: X.jsx(mn, {
            size: 14
          })
        })]
      })
    }), X.jsxs(`div`, {
      className: `bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 w-full h-full flex flex-col ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`,
      children: [X.jsx(_r, {
        type: `target`,
        position: J.Left
      }), X.jsxs(`div`, {
        className: `flex-1 p-0 bg-[#121212] flex items-center justify-center relative overflow-hidden`,
        onMouseEnter: () => s(true),
        onMouseLeave: () => s(false),
        children: [m === `image` && X.jsx(`img`, {
          src: h,
          alt: `Content`,
          loading: `lazy`,
          decoding: `async`,
          className: `w-full h-full object-contain cursor-pointer`,
          draggable: false,
          onError: e => {
            let t = e.currentTarget;
            l && t.src !== l && (t.src = l);
          },
          onDoubleClick: n => {
            n.stopPropagation(), t.onZoom && t.onZoom(e, u, l);
          }
        }), m === `video` && (o ? X.jsx(`video`, {
          src: l,
          controls: true,
          autoPlay: true,
          preload: `metadata`,
          poster: g,
          className: `w-full h-full object-contain`
        }) : c && g ? X.jsxs(`div`, {
          className: `relative w-full h-full`,
          children: [X.jsx(`img`, {
            src: g,
            alt: `video poster`,
            loading: `lazy`,
            decoding: `async`,
            draggable: false,
            className: `w-full h-full object-contain cursor-pointer`,
            onClick: e => {
              e.stopPropagation(), s(true);
            },
            onError: t => {
              let n = t.currentTarget;
              _ && n.src !== _ ? n.src = _ : d && n.src !== d ? n.src = d : (i(e, {
                imageAvailable: false
              }), s(true));
            }
          }), X.jsx(`div`, {
            className: `absolute inset-0 flex items-center justify-center pointer-events-none`,
            children: X.jsx(`button`, {
              className: `w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-80 hover:opacity-100 hover:bg-black/70 transition-all nodrag pointer-events-auto`,
              title: `播放视频`,
              onClick: e => {
                e.stopPropagation(), s(true);
              },
              children: X.jsx(vn, {
                className: `text-white w-6 h-6`
              })
            })
          })]
        }) : X.jsx(`video`, {
          src: l,
          preload: `none`,
          muted: true,
          poster: d,
          className: `w-full h-full object-contain`
        })), m === `audio` && X.jsxs(`div`, {
          className: `w-full h-full flex flex-col items-center justify-center bg-[#1a1a1a] p-2 gap-2`,
          children: [X.jsx(qt, {
            size: 24,
            className: `text-blue-500 mb-2`
          }), X.jsx(`audio`, {
            src: l,
            controls: true,
            className: `w-full max-w-[200px] h-8`
          })]
        }), m === `text` && X.jsxs(`div`, {
          className: `w-full h-full flex flex-col items-center justify-center bg-[#1a1a1a] p-2`,
          children: [X.jsx(R, {
            size: 24,
            className: `text-gray-400 mb-2`
          }), X.jsx(`span`, {
            className: `text-[10px] text-gray-500`,
            children: `文本/数据文件`
          })]
        }), m === `empty` && X.jsx(`div`, {
          className: `flex flex-col items-center justify-center absolute inset-0 bg-[#151515] hover:bg-[#1a1a1a] transition-colors cursor-pointer group`,
          onClick: e => {
            e.stopPropagation(), a.current?.click();
          },
          children: X.jsx(`div`, {
            className: `w-12 h-12 rounded-xl bg-[#222] border border-dashed border-[#444] group-hover:border-blue-500/50 flex flex-col items-center justify-center transition-all`,
            children: X.jsx(Ot, {
              size: 20,
              className: `text-gray-600 group-hover:text-blue-500/80 transition-colors`
            })
          })
        })]
      }), X.jsx(_r, {
        type: `source`,
        position: J.Right
      })]
    })]
  });
});