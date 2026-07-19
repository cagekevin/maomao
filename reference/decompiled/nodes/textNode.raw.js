/**
 * 节点类型: textNode
 * 原版函数名: Qa
 * 原版行号: L5268-L5909
 * 来源: App-B9jVCs-a.decompiled.js
 *
 * 变量映射（vendor-map.json）:
// _ → tU
// _r → Rl
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
// j → GE
// jn → wu
// k → cO
// l → VG
// m → LW
// mr → Vl
// mt → Vd
// n → Fq
// o → oK
// on → Yu
// p → VW
// pt → Hd
// r → Nq
// s → iK
// t → e1
// u → BG
// ut → Gd
// v → XH
// w → xT
// x → Y
// y → Mk
// yr → Il
// z → Rw
 */

var Qa = Y.memo(({
  id: e,
  data: n,
  selected: r
}) => {
  let {
      updateNodeData: i,
      setEdges: a
    } = Gt(),
    [o, s] = Y.useState(n.prompt || ``),
    [c, l] = Y.useState(n.text || ``),
    [u, d] = Y.useState(n.autoSplit || false),
    [f, p] = Y.useState(n.expanded === undefined ? true : n.expanded);
  Y.useEffect(() => {
    n.expanded !== undefined && p(n.expanded);
  }, [n.expanded]);
  let [m, h] = Y.useState(false),
    [g, _] = Y.useState(false),
    [v, y] = Y.useState(false),
    [b, x] = Y.useState(n.selectedContextResources || []),
    S = n.presetPrompts || [],
    [C, w] = Y.useState(n.selectedModel || localStorage.getItem(`mutiwindow_text_model`) || n.textModel && n.textModel.split(`
`)[0].trim() || ``),
    [T, E] = Y.useState(() => la().filter(e => e.enabled && e.category === `text`));
  Y.useEffect(() => ha(e => {
    E(e.filter(e => e.enabled && e.category === `text`));
  }), []);
  let D = _a(C),
    O = D ? T.find(e => e.id === D) : null,
    k = Y.useRef(null),
    A = Y.useRef(null),
    j = Y.useRef(null),
    M = Y.useRef(null),
    [N, P] = Y.useState(false),
    F = Y.useRef(null),
    [I, ee] = Y.useState(false),
    [z, B] = Y.useState([]);
  Y.useEffect(() => {
    I && Q.getObject(Z.TRANSIT_RESOURCES).then(e => {
      e && Array.isArray(e) && e.length > 0 && B(e);
    }).catch(e => {
      console.error(`Failed to fetch transitResources from storage`, e);
    });
  }, [I]), Y.useEffect(() => {
    let e = e => {
      F.current && !F.current.contains(e.target) && P(false);
    };
    return N && document.addEventListener(`mousedown`, e, true), () => {
      document.removeEventListener(`mousedown`, e, true);
    };
  }, [N]), Y.useEffect(() => {
    s(n.prompt || ``), n.text !== undefined && l(n.text), n.selectedModel && w(n.selectedModel), n.selectedContextResources && x(n.selectedContextResources);
  }, [n.prompt, n.text, n.selectedModel, n.selectedContextResources]), Y.useEffect(() => {
    if (n.textModel && !C) {
      let t = n.textModel.split(`
`)[0].trim();
      w(t), i(e, {
        selectedModel: t
      });
    }
  }, [n.textModel, C, e, i]);
  let te = t({
      handleType: `target`
    }),
    ne = ut(Y.useMemo(() => te.map(e => e.source), [te])),
    re = (() => {
      if (!ne) return {
        images: [],
        texts: []
      };
      let e = Array.isArray(ne) ? ne : [ne],
        t = [],
        n = [];
      return e.forEach(e => {
        let r = te.find(t => t.source === e?.id);
        if (e?.data?.imageUrl && typeof e.data.imageUrl == `string` && (e.data.imageUrl.startsWith(`http`) || e.data.imageUrl.startsWith(`data:`)) && t.push({
          id: e.id,
          url: e.data.imageUrl
        }), e?.type === `videoExtractNode` && e?.data?.extractedImages) if (r && r.sourceHandle && r.sourceHandle.startsWith(`frame-`)) {
          let n = parseInt(r.sourceHandle.replace(`frame-`, ``), 10);
          if (!(e.data.hiddenIndices || []).includes(n)) {
            let r = e.data.allExtractedImages;
            r && r[n] && t.push({
              id: `${e.id}-ext-${n}`,
              url: r[n]
            });
          }
        } else e.data.extractedImages.forEach((n, r) => {
          t.push({
            id: `${e.id}-ext-${r}`,
            url: n
          });
        });
        if (e?.type === `imageBoxNode` && Array.isArray(e.data?.images)) {
          let n = e.data.images,
            r = e.data.selectedIds || [];
          if (r.length > 0) {
            let i = new Set(r);
            n.forEach((n, r) => {
              n?.url && i.has(n.id) && t.push({
                id: `${e.id}-box-${r}`,
                url: n.url
              });
            });
          } else {
            let r = n[typeof e.data.activeIndex == `number` ? e.data.activeIndex : 0]?.url;
            r && t.push({
              id: `${e.id}-box-active`,
              url: r
            });
          }
        }
        let i = new Set([`promptNode`, `imageNode`, `imageBoxNode`, `videoNode`, `sd2VideoNode`, `discountVideoNode`, `gridSplitNode`, `gridMergeNode`, `cropNode`, `urlToImageNode`, `fileToUrlNode`, `panoramaNode`, `videoExtractNode`]);
        e?.data?.text && !i.has(e.type) && n.push({
          id: e.id,
          label: e?.type === `audioNode` ? `听音断句结果` : e.data.label || `文本节点`,
          text: e.data.text
        });
      }), {
        images: t,
        texts: n
      };
    })(),
    ie = n.loading,
    ae = n.errorMessage,
    se = n.fontSize || 14,
    ce = e => {
      e.stopPropagation(), navigator.clipboard.writeText(c), n.onShowToast && n.onShowToast(`已复制文本`);
    },
    le = t => {
      t.stopPropagation(), n.onGenerateText && n.onGenerateText(e, o, u, C);
    };
  return X.jsxs(`div`, {
    className: `relative flex flex-col items-center group/node transition-all ${r ? `z-50` : `z-10`}`,
    children: [X.jsx(si, {
      id: e,
      data: n,
      defaultTitle: `文本生成`,
      icon: X.jsx(R, {
        size: 11,
        className: `text-gray-500`
      })
    }), X.jsx(`div`, {
      className: `absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`,
      children: X.jsxs(`div`, {
        className: `flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`,
        children: [ie && X.jsx(L, {
          size: 12,
          className: `animate-spin flex-shrink-0`,
          style: {
            color: `rgb(210,2,7)`
          }
        }), te.length === 0 && X.jsx(`button`, {
          className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`,
          onClick: () => k.current?.click(),
          title: `上传图片`,
          children: X.jsx(jn, {
            size: 12
          })
        }), X.jsx(`button`, {
          className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`,
          onClick: ce,
          title: `复制文本`,
          children: X.jsx(on, {
            size: 12
          })
        }), X.jsx(`button`, {
          className: `p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`,
          onClick: () => {
            p(!f), i(e, {
              expanded: !f
            });
          },
          title: f ? `收起输入` : `展开输入`,
          children: f ? X.jsx(ft, {
            size: 12
          }) : X.jsx(bt, {
            size: 12
          })
        })]
      })
    }), X.jsx(`input`, {
      type: `file`,
      ref: k,
      style: {
        display: `none`
      },
      accept: `image/*`,
      onChange: async t => {
        let r = t.target.files?.[0];
        if (r) {
          try {
            let t = await yr(r, 2048, .85);
            n.onAddImage && n.onAddImage(e, t);
          } catch (e) {
            console.error(`Image resize failed:`, e);
          }
          t.target.value = ``;
        }
      }
    }), X.jsxs(`div`, {
      ref: M,
      className: `relative bg-[#1c1c1c] rounded-xl border shadow-xl transition-[border-color] duration-200 flex flex-col
          ${r ? `border-[#555]` : `border-[#333] hover:border-[#444]`}
        `,
      style: {
        width: `420px`,
        height: `240px`
      },
      onClick: t => {
        g || t.target instanceof HTMLButtonElement || t.target instanceof HTMLInputElement || t.target instanceof HTMLTextAreaElement || (p(!f), i(e, {
          expanded: !f
        }));
      },
      children: [X.jsxs(`div`, {
        className: `flex-1 min-h-0 p-3 overflow-hidden bg-[#1a1a1a] relative rounded-xl ${g ? `nopan nowheel nodrag` : `drag-handle cursor-move`}`,
        onWheel: e => e.stopPropagation(),
        onDoubleClick: () => {
          g || (_(true), setTimeout(() => j.current?.focus(), 0));
        },
        children: [ie ? X.jsx(pi, {
          label: `生成中...`,
          children: X.jsx(hi, {
            category: `text`
          })
        }) : null, ae ? X.jsxs(`div`, {
          className: `text-red-400 text-xs p-2 border border-red-500/30 rounded bg-red-500/10 flex items-start gap-2`,
          children: [X.jsx(pt, {
            size: 14,
            className: `mt-0.5 flex-shrink-0`
          }), X.jsx(`span`, {
            className: `break-all`,
            children: ae
          })]
        }) : X.jsxs(X.Fragment, {
          children: [!c && !ie && !g && X.jsxs(`div`, {
            className: `absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none`,
            children: [X.jsx(R, {
              size: 72,
              className: `text-gray-700`,
              strokeWidth: 1.2
            }), X.jsx(`span`, {
              className: `text-xs text-gray-600`,
              children: `双击编辑内容或AI生成`
            })]
          }), X.jsx(gi, {
            ref: j,
            className: `w-full h-full bg-transparent outline-none font-sans leading-relaxed custom-scrollbar nowheel ${g ? `nodrag nopan` : `pointer-events-none`}`,
            style: {
              fontSize: `${se}px`,
              color: `#a1a1aa`
            },
            placeholder: ``,
            value: c,
            readOnly: !g,
            onChange: t => {
              l(t), i(e, {
                text: t
              });
            },
            onBlur: () => _(false),
            onWheel: e => e.stopPropagation()
          })]
        }), X.jsx(_i, {
          targetRef: M,
          minWidth: 320,
          minHeight: 180,
          onRequestFullscreen: () => h(true)
        })]
      }), X.jsx(_r, {
        type: `target`,
        position: J.Left
      }), X.jsx(_r, {
        type: `source`,
        position: J.Right
      })]
    }), (() => {
      let t = X.jsxs(`div`, {
        className: `space-y-3`,
        children: [X.jsxs(`div`, {
          className: `flex flex-col gap-2`,
          children: [(re.images.length > 0 || re.texts.length > 0 || b.length > 0) && X.jsxs(`div`, {
            className: `flex flex-wrap gap-2 mb-1`,
            children: [re.images.map((t, n) => X.jsxs(`div`, {
              className: `w-8 h-8 rounded overflow-hidden border border-[#444] relative group bg-black`,
              title: `连线图片`,
              children: [X.jsx(`img`, {
                src: t.url,
                alt: `Ref`,
                className: `w-full h-full object-cover`
              }), X.jsx(`div`, {
                className: `absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`,
                onClick: n => {
                  n.stopPropagation(), a(n => n.filter(n => !(n.target === e && n.source === t.id)));
                },
                children: X.jsx(`span`, {
                  className: `text-white text-[8px]`,
                  children: `×`
                })
              })]
            }, `img-${n}`)), b.map((t, n) => X.jsxs(`div`, {
              className: `w-8 h-8 rounded overflow-hidden border border-blue-500/50 relative group bg-black`,
              title: `通过 @ 选中的素材`,
              children: [t.type.startsWith(`image`) ? X.jsx(`img`, {
                src: t.url,
                className: `w-full h-full object-cover opacity-80`
              }) : t.type.startsWith(`video`) ? X.jsx(`video`, {
                src: t.url,
                className: `w-full h-full object-cover opacity-80`
              }) : X.jsx(`div`, {
                className: `w-full h-full bg-[#222] flex items-center justify-center p-1`,
                children: X.jsx(Dn, {
                  size: 10,
                  className: `text-gray-400`
                })
              }), X.jsx(`div`, {
                className: `absolute inset-0 bg-blue-500/10 pointer-events-none`
              }), X.jsx(`div`, {
                className: `absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`,
                onClick: t => {
                  t.stopPropagation();
                  let r = b.filter((e, t) => t !== n);
                  x(r), i(e, {
                    selectedContextResources: r
                  });
                },
                children: X.jsx(`span`, {
                  className: `text-white text-[8px]`,
                  children: `×`
                })
              })]
            }, `ctx-${n}`)), re.texts.map((e, t) => X.jsxs(`div`, {
              className: `h-8 px-2 bg-[#2a2a2a] border border-[#444] rounded flex items-center gap-1 text-[10px] text-gray-300 hover:bg-[#333] hover:border-blue-500 hover:text-blue-400 transition-colors cursor-help group/text`,
              title: e.text,
              children: [X.jsx(Dn, {
                size: 10
              }), X.jsx(`span`, {
                className: `max-w-[60px] truncate`,
                children: e.label
              })]
            }, `txt-${t}`))]
          }), X.jsx(`div`, {
            className: `flex items-start gap-2`,
            children: X.jsxs(`div`, {
              className: `flex-1 relative`,
              children: [X.jsx(gi, {
                ref: A,
                className: `w-full bg-transparent text-[15px] text-gray-200 outline-none leading-relaxed placeholder-gray-600 font-sans custom-scrollbar nodrag nowheel nopan`,
                style: {
                  width: n.inputWidth ? `${n.inputWidth}px` : undefined,
                  height: n.inputHeight ? `${n.inputHeight}px` : `80px`,
                  minHeight: `80px`,
                  overflow: `auto`
                },
                placeholder: `输入提示词 (输入 @ 调出素材)...`,
                value: o,
                onChange: t => {
                  if (s(t), i(e, {
                    prompt: t
                  }), t.endsWith(`@`) ? ee(true) : t.includes(`@`) || ee(false), !n.inputHeight || n.inputHeight <= 200) {
                    let t = A.current;
                    requestAnimationFrame(() => {
                      if (t) {
                        t.style.height = `auto`;
                        let n = Math.max(80, Math.min(t.scrollHeight, 200));
                        t.style.height = n + `px`, i(e, {
                          inputHeight: n
                        });
                      }
                    });
                  }
                },
                onWheel: e => e.stopPropagation()
              }), I && X.jsx(`div`, {
                className: `absolute bottom-full left-0 mb-1 z-[100]`,
                onWheel: e => e.stopPropagation(),
                onClick: e => e.stopPropagation(),
                children: X.jsx(Za, {
                  resources: z,
                  onSelect: t => {
                    let n = o.lastIndexOf(`@`),
                      r = n >= 0 ? o.substring(0, n) + o.substring(n + 1) : o;
                    if (t.type === `text`) {
                      let n = r + (t.url || ``);
                      s(n), i(e, {
                        prompt: n
                      });
                    } else {
                      let n = [...b, t];
                      x(n), i(e, {
                        selectedContextResources: n
                      }), s(r), i(e, {
                        prompt: r
                      });
                    }
                    ee(false);
                  },
                  onClose: () => ee(false)
                })
              })]
            })
          })]
        }), X.jsxs(`div`, {
          className: `flex items-center justify-between pt-2 border-t border-[#2a2a2a]`,
          children: [X.jsxs(`div`, {
            className: `flex items-center gap-1.5`,
            children: [X.jsxs(`label`, {
              className: `flex items-center gap-1.5 cursor-pointer h-6 px-2 text-[11px] text-gray-400 hover:text-gray-200 select-none bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded transition-colors`,
              children: [X.jsx(`input`, {
                type: `checkbox`,
                checked: u,
                onChange: t => {
                  d(t.target.checked), i(e, {
                    autoSplit: t.target.checked
                  });
                },
                className: `accent-blue-500 rounded sm:w-3 sm:h-3`
              }), `自动拆分`]
            }), !!(n.textModel && n.textModel.split(`
`).filter(e => e.trim() !== ``).length > 0 || T.length > 0) && X.jsxs(`div`, {
              className: `relative nodrag flex items-center`,
              ref: F,
              children: [X.jsx(`div`, {
                className: `w-[1px] h-3 bg-[#444] mr-1.5`
              }), X.jsxs(`button`, {
                className: `flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`,
                onClick: e => {
                  e.stopPropagation(), P(!N);
                },
                title: O ? `调度：${O.name}` : C ? `${C}（${Xi(C) ? `内置` : `第三方`}）` : `选择模型`,
                children: [O ? X.jsx(`span`, {
                  className: `shrink-0 px-1 rounded text-[9px] leading-[14px] border bg-blue-500/20 text-blue-200 border-blue-400/40`,
                  children: `调度`
                }) : C && X.jsx(`span`, {
                  className: `shrink-0 px-1 rounded text-[9px] leading-[14px] border ${Xi(C) ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`,
                  children: Xi(C) ? `内置` : `三方`
                }), X.jsx(`span`, {
                  className: `whitespace-nowrap`,
                  children: O ? O.name : C || `选择模型`
                })]
              }), N && X.jsx(`div`, {
                className: `absolute bottom-full left-0 mb-1 min-w-[17rem] w-max max-w-[29rem] bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 block max-h-60 overflow-y-auto custom-scrollbar nowheel nopan nodrag`,
                onWheel: e => e.stopPropagation(),
                onClick: e => e.stopPropagation(),
                children: (() => {
                  let t = (n.textModel || ``).split(`
`).map(e => e.trim()).filter(e => e !== ``),
                    r = t.filter(e => Xi(e)).sort((e, t) => e.localeCompare(t)),
                    a = t.filter(e => !Xi(e)).sort((e, t) => e.localeCompare(t)),
                    o = (t, n, r) => {
                      let a = r ? Ui(t) : null,
                        o = r ? Wi(t) : null,
                        s = ea(t, C === t);
                      return X.jsxs(`div`, {
                        role: `button`,
                        className: s.className,
                        title: s.title,
                        onClick: () => {
                          s.disabled || (w(t), i(e, {
                            selectedModel: t
                          }), localStorage.setItem(`mutiwindow_text_model`, t), P(false));
                        },
                        children: [X.jsx(`span`, {
                          className: `shrink-0 px-1 rounded text-[9px] leading-[14px] border ${r ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`,
                          children: r ? `内置` : `三方`
                        }), X.jsx(`span`, {
                          className: `flex-1 whitespace-nowrap`,
                          children: t
                        }), a !== null && X.jsxs(`span`, {
                          className: `shrink-0 inline-flex items-center gap-0.5 text-[10px] text-orange-400 tabular-nums`,
                          children: [X.jsx(Lt, {
                            className: `w-2.5 h-2.5`,
                            strokeWidth: 2.5
                          }), X.jsxs(`span`, {
                            children: [Zi(a), o ? `/${o}` : ``]
                          })]
                        })]
                      }, `${r ? `b` : `o`}-${n}`);
                    };
                  return X.jsxs(X.Fragment, {
                    children: [T.length > 0 && X.jsxs(X.Fragment, {
                      children: [X.jsxs(`div`, {
                        className: `text-[10px] text-blue-300 mb-1 px-1 flex items-center justify-between`,
                        children: [X.jsxs(`span`, {
                          className: `flex items-center gap-1`,
                          children: [X.jsx(Lt, {
                            className: `w-2.5 h-2.5`,
                            strokeWidth: 2.5
                          }), X.jsx(`span`, {
                            children: `模型调度`
                          })]
                        }), X.jsx(`span`, {
                          className: `ml-auto text-white/90 hover:text-white cursor-pointer transition-colors`,
                          onClick: e => {
                            e.stopPropagation(), window.dispatchEvent(new CustomEvent(`mutiwindow-open-schedule-settings`));
                          },
                          children: `配置 ›`
                        })]
                      }), T.map(t => {
                        let n = ga(t.id);
                        return X.jsxs(`div`, {
                          role: `button`,
                          className: `w-full flex items-center gap-1.5 mb-1 last:mb-0 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors cursor-pointer ${C === n ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`,
                          onClick: () => {
                            w(n), i(e, {
                              selectedModel: n
                            }), localStorage.setItem(`mutiwindow_text_model`, n), P(false);
                          },
                          title: `${t.name}（${t.steps.length} 个模型按序重试）`,
                          children: [X.jsx(`span`, {
                            className: `shrink-0 px-1 rounded text-[9px] leading-[14px] border bg-blue-500/20 text-blue-200 border-blue-400/40`,
                            children: `调度`
                          }), X.jsx(`span`, {
                            className: `flex-1 whitespace-nowrap`,
                            children: t.name
                          }), X.jsxs(`span`, {
                            className: `shrink-0 text-[10px] text-gray-500`,
                            children: [t.steps.length, ` 模型`]
                          })]
                        }, t.id);
                      }), (r.length > 0 || a.length > 0) && X.jsx(`div`, {
                        className: `h-px bg-[#333] my-1.5`
                      })]
                    }), r.length > 0 && X.jsxs(X.Fragment, {
                      children: [X.jsxs(`div`, {
                        className: `text-[10px] text-blue-300 mb-1 px-1 flex items-center gap-1`,
                        children: [X.jsx(`span`, {
                          children: `✨`
                        }), X.jsx(`span`, {
                          children: `内置模型`
                        }), X.jsx(`span`, {
                          className: `ml-auto text-white/90 hover:text-white cursor-pointer whitespace-nowrap`,
                          onClick: e => {
                            e.stopPropagation(), window.dispatchEvent(new CustomEvent(`mutiwindow-open-builtin-settings`)), P(false);
                          },
                          title: `查看内置模型详情`,
                          children: `详情 ›`
                        })]
                      }), r.map((e, t) => o(e, t, true))]
                    }), a.length > 0 && X.jsxs(X.Fragment, {
                      children: [r.length > 0 && X.jsx(`div`, {
                        className: `h-px bg-[#333] my-1.5`
                      }), X.jsx(`div`, {
                        className: `text-[10px] text-gray-500 mb-1 px-1`,
                        children: `第三方 API`
                      }), a.map((e, t) => o(e, t, false))]
                    })]
                  });
                })()
              })]
            }), X.jsx(Ja, {
              category: `text`,
              presetPrompts: S,
              onApply: t => {
                let n = o ? `${o}, ${t}` : t;
                s(n), i(e, {
                  prompt: n
                });
              },
              onToast: e => n.onShowToast?.(e)
            })]
          }), ie ? X.jsxs(`div`, {
            className: `flex items-center bg-red-500/10 rounded-full p-1 pl-3 border border-red-500/30 hover:border-red-500/50 transition-colors cursor-pointer group/btn flex-shrink-0 ml-2`,
            onClick: t => {
              t.stopPropagation(), n.onStop && n.onStop(e);
            },
            children: [X.jsx(`div`, {
              className: `flex items-center gap-1 mr-3 text-xs text-red-400 group-hover/btn:text-red-300`,
              children: `停止`
            }), X.jsx(`button`, {
              className: `bg-red-500/20 text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-500/30 transition-colors`,
              children: X.jsx(oe, {
                size: 10,
                fill: `currentColor`
              })
            })]
          }) : X.jsxs(`div`, {
            className: `flex items-center bg-[#2a2a2a] rounded-full p-1 pl-3 border border-[#333] hover:border-gray-500 transition-colors cursor-pointer group/btn flex-shrink-0 ml-2`,
            onClick: le,
            children: [C && Xi(C) && Ui(C) !== null && X.jsxs(`div`, {
              className: `flex items-center gap-0.5 mr-2 text-[11px] text-orange-400 tabular-nums`,
              children: [X.jsx(Lt, {
                className: `w-3 h-3`,
                strokeWidth: 2.5
              }), X.jsxs(`span`, {
                children: [Zi(Ui(C) || 0), Wi(C) ? `/${Wi(C)}` : ``]
              })]
            }), X.jsx(`div`, {
              className: `flex items-center gap-1 mr-3 text-xs text-gray-300 group-hover/btn:text-white`,
              children: `生成`
            }), X.jsx(`button`, {
              className: `bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors`,
              children: X.jsx(En, {
                size: 14,
                strokeWidth: 3
              })
            })]
          })]
        })]
      });
      return X.jsxs(X.Fragment, {
        children: [X.jsxs(`div`, {
          className: `absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[#1c1c1c] rounded-2xl border border-[#333] shadow-2xl min-w-[420px] w-max max-w-[920px] transition-all duration-300 origin-top z-50
                ${f ? `opacity-100 scale-100 p-4 overflow-visible` : `opacity-0 scale-95 pointer-events-none h-0 p-0 border-0 overflow-hidden`}
              `,
          onClick: e => e.stopPropagation(),
          children: [!v && t, f && !v && X.jsx(_i, {
            targetRef: A,
            onRequestFullscreen: () => y(true),
            onResizeEnd: (t, n) => i(e, {
              inputWidth: t,
              inputHeight: n
            })
          })]
        }), X.jsx(vi, {
          open: v,
          title: `编辑提示词 - 文本`,
          onClose: () => y(false),
          children: t
        }), X.jsx(vi, {
          open: m,
          title: `编辑文本内容`,
          onClose: () => h(false),
          children: X.jsx(`textarea`, {
            autoFocus: true,
            className: `w-full h-full bg-[#0d0c0c] text-gray-100 outline-none custom-scrollbar resize-none p-4 rounded`,
            style: {
              fontSize: `${se}px`,
              lineHeight: 1.7
            },
            value: c,
            onChange: t => {
              l(t.target.value), i(e, {
                text: t.target.value
              });
            }
          })
        })]
      });
    })()]
  });
});