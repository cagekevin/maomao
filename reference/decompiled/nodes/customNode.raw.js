/**
 * 节点类型: customNode
 * 原版函数名: ms
 * 原版行号: L13582-L14394
 * 来源: App-B9jVCs-a.decompiled.js
 *
 * 变量映射（vendor-map.json）:
// _ → tU
// _r → Rl
// a → ZK
// b → dT
// br → Fl
// c → tK
// ct → qd
// d → zG
// e → i
// f → MG
// g → qU
// h → xW
// i → jq
// jn → wu
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
// s → iK
// t → e1
// u → BG
// v → XH
// w → xT
// x → Y
// y → Mk
// z → Rw
 */

  ms = Y.memo(({
    id: e,
    data: t,
    selected: n
  }) => {
    let {
        updateNodeData: r
      } = Gt(),
      i = t,
      [a, o] = Y.useState(i.configMode === undefined ? true : i.configMode),
      [s, c] = Y.useState(i.config?.variables || {}),
      [l, u] = Y.useState([]),
      [d, f] = Y.useState(i.config || {
        apiUrl: ``,
        method: `POST`,
        headers: `{
  "Content-Type": "application/json"
}`,
        body: `{
  "prompt": "{{prompt}}"
}`,
        outputType: `text`,
        executionMode: `sync`,
        resultPath: `data.result`
      }),
      [p, m] = Y.useState(``),
      [h, g] = Y.useState(false);
    Y.useEffect(() => {
      let e = (d.body || ``) + ` ` + (d.apiUrl || ``) + ` ` + (d.headers || ``),
        t = /\{\{([^}]+)\}\}/g,
        n,
        r = [],
        i = new Set();
      for (; (n = t.exec(e)) !== null;) {
        let e = n[1].trim();
        if (!i.has(e)) if (i.add(e), e.includes(`|`)) {
          let [t, n] = e.split(`|`);
          r.push({
            name: t.trim(),
            options: n.split(`,`).map(e => e.trim())
          });
        } else r.push({
          name: e
        });
      }
      u(r);
    }, [d.body, d.apiUrl, d.headers]);
    let _ = async () => {
        if (p.trim()) {
          if (!i.onAIAssist) {
            i.onShowToast?.(`AI辅助不可用，请检查API配置`);
            return;
          }
          g(true);
          try {
            let e = await i.onAIAssist(p, d);
            try {
              let t = JSON.parse(e);
              f(e => ({
                ...e,
                apiUrl: t.apiUrl || e.apiUrl,
                method: t.method || e.method,
                headers: t.headers || e.headers,
                body: t.body || e.body,
                outputType: t.outputType || e.outputType,
                executionMode: t.executionMode || e.executionMode,
                resultPath: t.resultPath || e.resultPath,
                taskIdPath: t.taskIdPath || e.taskIdPath,
                pollingUrl: t.pollingUrl || e.pollingUrl,
                pollingMethod: t.pollingMethod || e.pollingMethod,
                pollingHeaders: t.pollingHeaders || e.pollingHeaders,
                pollingBody: t.pollingBody || e.pollingBody,
                pollingResultPath: t.pollingResultPath || e.pollingResultPath,
                pollingCompletedValue: t.pollingCompletedValue || e.pollingCompletedValue,
                pollingFailedValue: t.pollingFailedValue || e.pollingFailedValue,
                pollingErrorPath: t.pollingErrorPath || e.pollingErrorPath,
                pollingProgressPath: t.pollingProgressPath === undefined ? e.pollingProgressPath : t.pollingProgressPath,
                pollingResultDataPath: t.pollingResultDataPath === undefined ? e.pollingResultDataPath : t.pollingResultDataPath,
                rawTextOutput: t.rawTextOutput === undefined ? e.rawTextOutput : t.rawTextOutput
              })), i.onShowToast?.(`AI 生成配置成功`);
            } catch (t) {
              console.error(`AI 返回的 JSON 解析失败`, t, e), i.onShowToast?.(`AI 生成格式错误，请重试`);
            }
          } catch (e) {
            i.onShowToast?.(e.message || `AI 生成失败`);
          } finally {
            g(false);
          }
        }
      },
      v = () => {
        r(e, {
          config: {
            ...d,
            variables: s
          },
          configMode: false
        }), o(false);
      },
      y = () => {
        if (!d.apiUrl) {
          i.onShowToast?.(`请至少填写 API URL`);
          return;
        }
        let e = window.prompt(`请输入自定义节点名称:`, t.label || `万能节点`);
        e && i.onSaveTemplate && i.onSaveTemplate(e, {
          ...d,
          variables: s
        });
      },
      b = t => {
        if (t.stopPropagation(), a) {
          i.onShowToast?.(`请先完成配置`);
          return;
        }
        let n = {
          ...d,
          variables: s
        };
        f(n), r(e, {
          config: n
        }), setTimeout(() => {
          console.log(`CustomNode handleRun triggered, calling onGenerateCustom`, i.onGenerateCustom), i.onGenerateCustom ? i.onGenerateCustom(e) : i.onShowToast?.(`未找到执行方法，请刷新页面重试`);
        }, 50);
      },
      x = async (e, t) => {
        try {
          let n = await ii(t, {
            subfolder: `canvas/upload`,
            preferThumbnail: t.type.startsWith(`image/`),
            thumbMaxDim: 480,
            thumbQuality: 75
          });
          if (n.url && /^https?:\/\//i.test(n.url)) {
            c(t => ({
              ...t,
              [e]: n.url
            }));
            return;
          }
        } catch (e) {
          console.warn(`[CustomNode] urlifyAsset failed, fallback to base64:`, e);
        }
        let n = new FileReader();
        n.onload = t => {
          t.target?.result && c(n => ({
            ...n,
            [e]: t.target.result
          }));
        }, n.readAsDataURL(t);
      };
    return X.jsxs(`div`, {
      className: `flex flex-col items-center group/node transition-all ${n ? `z-50` : `z-10`}`,
      children: [X.jsx(si, {
        id: e,
        data: t,
        defaultTitle: `万能节点`,
        icon: X.jsx(He, {
          size: 11,
          className: `text-gray-500`
        })
      }), X.jsxs(`div`, {
        className: `relative bg-[#1c1c1c] rounded-xl overflow-visible border shadow-xl transition-all duration-300 flex flex-col
                ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}
                `,
        style: {
          width: `400px`,
          minHeight: a ? `450px` : `250px`
        },
        children: [X.jsxs(`div`, {
          className: `absolute top-2 right-2 z-20 flex items-center gap-2 nodrag`,
          children: [i.loading && X.jsx(L, {
            size: 12,
            className: `animate-spin flex-shrink-0`,
            style: {
              color: `rgb(210,2,7)`
            }
          }), X.jsxs(`div`, {
            className: `flex bg-[#0d0c0c]/90 rounded p-0.5 border border-[#333]`,
            children: [X.jsx(`button`, {
              className: `px-2 py-1 text-[10px] rounded transition-colors ${a ? `bg-[#333] text-white` : `text-gray-400 hover:text-gray-200`}`,
              onClick: () => {
                o(true), r(e, {
                  configMode: true
                });
              },
              children: `编辑模式`
            }), X.jsx(`button`, {
              className: `px-2 py-1 text-[10px] rounded transition-colors ${a ? `text-gray-400 hover:text-gray-200` : `bg-[#333] text-white`}`,
              onClick: () => {
                o(false), r(e, {
                  configMode: false
                });
              },
              children: `工作模式`
            })]
          })]
        }), X.jsxs(`div`, {
          className: `flex-1 flex flex-col p-3 bg-[#1a1a1a] relative drag-handle rounded-xl`,
          children: [i.loading && X.jsxs(`div`, {
            className: `absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500 bg-[#1a1a1a]/80 backdrop-blur-sm z-10`,
            children: [X.jsx(ui, {
              size: 24
            }), X.jsx(`span`, {
              className: `text-xs`,
              children: d.executionMode === `async` ? `请求中... ${i.progress || 0}%` : `请求中...`
            }), X.jsxs(`button`, {
              onClick: t => {
                t.stopPropagation(), i.onStop && i.onStop(e);
              },
              className: `mt-2 bg-[#222]/80 hover:bg-[#333] border border-[#444] text-gray-400 hover:text-gray-200 px-3 py-1 rounded-full text-[10px] flex items-center gap-1.5 transition-colors backdrop-blur-sm nodrag`,
              children: [X.jsx(oe, {
                size: 10,
                fill: `currentColor`
              }), `停止`]
            })]
          }), i.errorMessage && X.jsxs(`div`, {
            className: `text-red-400 text-[10px] p-2 mb-2 border border-red-500/30 rounded bg-red-500/10 flex items-start gap-1.5`,
            children: [X.jsx(pt, {
              size: 12,
              className: `mt-0.5 flex-shrink-0`
            }), X.jsx(`span`, {
              className: `break-all`,
              children: i.errorMessage
            })]
          }), a ? X.jsxs(`div`, {
            className: `flex flex-col gap-3 nodrag text-xs`,
            children: [X.jsxs(`div`, {
              className: `flex flex-col gap-1`,
              children: [X.jsxs(`label`, {
                className: `text-gray-500 flex items-center gap-1`,
                children: [X.jsx(pe, {
                  size: 12,
                  className: `text-yellow-500`
                }), `AI 辅助配置`]
              }), X.jsxs(`div`, {
                className: `flex flex-col gap-2`,
                children: [X.jsx(`textarea`, {
                  className: `flex-1 bg-[#0d0c0c] border border-[#333] rounded p-2 text-gray-200 focus:border-blue-500 outline-none custom-scrollbar text-[10px] resize-y nodrag nowheel nopan`,
                  placeholder: `描述你想调用的API... (如：调用百度翻译)`,
                  value: p,
                  onChange: e => m(e.target.value),
                  onKeyDown: e => {
                    e.key === `Enter` && (e.ctrlKey || e.metaKey) && _();
                  },
                  onWheel: e => e.stopPropagation(),
                  rows: 3
                }), X.jsxs(`button`, {
                  onClick: _,
                  disabled: h,
                  className: `py-1.5 w-full bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 rounded transition-colors flex items-center justify-center gap-1`,
                  children: [h ? X.jsx(L, {
                    size: 12,
                    className: `animate-spin`
                  }) : `生成`, !h && X.jsx(`span`, {
                    className: `text-[10px] text-blue-400/70`,
                    children: `(Ctrl+Enter)`
                  })]
                })]
              })]
            }), X.jsxs(`div`, {
              className: `flex gap-2`,
              children: [X.jsxs(`div`, {
                className: `flex flex-col gap-1 w-20`,
                children: [X.jsx(`label`, {
                  className: `text-gray-500`,
                  children: `Method`
                }), X.jsxs(`select`, {
                  className: `bg-[#0d0c0c] border border-[#333] rounded px-1 py-1 text-gray-200 outline-none`,
                  value: d.method,
                  onChange: e => f({
                    ...d,
                    method: e.target.value
                  }),
                  children: [X.jsx(`option`, {
                    children: `GET`
                  }), X.jsx(`option`, {
                    children: `POST`
                  }), X.jsx(`option`, {
                    children: `PUT`
                  })]
                })]
              }), X.jsxs(`div`, {
                className: `flex flex-col gap-1 flex-1`,
                children: [X.jsx(`label`, {
                  className: `text-gray-500`,
                  children: `API URL`
                }), X.jsx(`input`, {
                  className: `bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 focus:border-blue-500 outline-none`,
                  value: d.apiUrl,
                  onChange: e => f({
                    ...d,
                    apiUrl: e.target.value
                  })
                })]
              })]
            }), X.jsxs(`div`, {
              className: `flex flex-col gap-1`,
              children: [X.jsxs(`div`, {
                className: `flex justify-between items-center`,
                children: [X.jsx(`label`, {
                  className: `text-gray-500`,
                  children: `Headers (JSON格式)`
                }), X.jsxs(`div`, {
                  className: `flex gap-1`,
                  children: [X.jsx(`button`, {
                    onClick: () => f({
                      ...d,
                      headers: `{
  "Content-Type": "application/json"
}`
                    }),
                    className: `text-[9px] bg-[#333] hover:bg-[#444] px-1.5 py-0.5 rounded text-gray-300 transition-colors`,
                    children: `JSON`
                  }), X.jsx(`button`, {
                    onClick: () => f({
                      ...d,
                      headers: `{
  "Content-Type": "multipart/form-data"
}`
                    }),
                    className: `text-[9px] bg-[#333] hover:bg-[#444] px-1.5 py-0.5 rounded text-gray-300 transition-colors`,
                    children: `FormData`
                  })]
                })]
              }), X.jsx(`textarea`, {
                className: `bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 font-mono text-[10px] h-16 resize-y focus:border-blue-500 outline-none custom-scrollbar nodrag nowheel nopan`,
                value: d.headers,
                onChange: e => f({
                  ...d,
                  headers: e.target.value
                }),
                onWheel: e => e.stopPropagation()
              })]
            }), X.jsxs(`div`, {
              className: `flex flex-col gap-1`,
              children: [X.jsx(`label`, {
                className: `text-gray-500 flex justify-between`,
                children: X.jsxs(`span`, {
                  children: [`Body (支持变量: `, `{{prompt}}`, `, `, `{{image_1}}`, `)`]
                })
              }), X.jsx(`textarea`, {
                className: `bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 font-mono text-[10px] h-24 resize-y focus:border-blue-500 outline-none custom-scrollbar nodrag nowheel nopan`,
                value: d.body,
                onChange: e => f({
                  ...d,
                  body: e.target.value
                }),
                onWheel: e => e.stopPropagation()
              })]
            }), X.jsxs(`div`, {
              className: `flex gap-2`,
              children: [X.jsxs(`div`, {
                className: `flex flex-col gap-1 flex-1`,
                children: [X.jsx(`label`, {
                  className: `text-gray-500`,
                  children: `输出类型`
                }), X.jsxs(`select`, {
                  className: `bg-[#0d0c0c] border border-[#333] rounded px-1 py-1 text-gray-200 outline-none`,
                  value: d.outputType,
                  onChange: e => f({
                    ...d,
                    outputType: e.target.value
                  }),
                  children: [X.jsx(`option`, {
                    value: `text`,
                    children: `文本 (Text)`
                  }), X.jsx(`option`, {
                    value: `image`,
                    children: `图片 (Image URL)`
                  }), X.jsx(`option`, {
                    value: `video`,
                    children: `视频 (Video URL)`
                  }), X.jsx(`option`, {
                    value: `audio`,
                    children: `音频 (Audio URL)`
                  })]
                })]
              }), X.jsxs(`div`, {
                className: `flex flex-col gap-1 flex-1`,
                children: [X.jsx(`label`, {
                  className: `text-gray-500`,
                  children: `执行模式`
                }), X.jsxs(`select`, {
                  className: `bg-[#0d0c0c] border border-[#333] rounded px-1 py-1 text-gray-200 outline-none`,
                  value: d.executionMode,
                  onChange: e => f({
                    ...d,
                    executionMode: e.target.value
                  }),
                  children: [X.jsx(`option`, {
                    value: `sync`,
                    children: `同步 (立即返回)`
                  }), X.jsx(`option`, {
                    value: `async`,
                    children: `异步 (需轮询)`
                  })]
                })]
              })]
            }), X.jsxs(`div`, {
              className: `flex gap-2`,
              children: [X.jsxs(`div`, {
                className: `flex flex-col gap-1 flex-1`,
                children: [X.jsx(`label`, {
                  className: `text-gray-500`,
                  children: `提取结果字段 (JSON Path, 如 data.url)`
                }), X.jsx(`input`, {
                  className: `bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 focus:border-blue-500 outline-none`,
                  value: d.resultPath,
                  onChange: e => f({
                    ...d,
                    resultPath: e.target.value
                  }),
                  placeholder: `如 choices[0].message.content`
                })]
              }), d.outputType === `text` && X.jsxs(`div`, {
                className: `flex flex-col gap-1 w-24`,
                children: [X.jsx(`label`, {
                  className: `text-gray-500 text-center`,
                  children: `纯文本输出`
                }), X.jsx(`div`, {
                  className: `flex items-center justify-center h-full`,
                  children: X.jsx(`input`, {
                    type: `checkbox`,
                    checked: d.rawTextOutput || false,
                    onChange: e => f({
                      ...d,
                      rawTextOutput: e.target.checked
                    }),
                    className: `w-4 h-4 accent-blue-500 cursor-pointer`
                  })
                })]
              })]
            }), d.executionMode === `async` && X.jsxs(`div`, {
              className: `flex flex-col gap-2 p-2 bg-[#222] border border-[#333] rounded mt-1`,
              children: [X.jsxs(`div`, {
                className: `flex flex-col gap-1`,
                children: [X.jsx(`label`, {
                  className: `text-gray-500`,
                  children: `提取 Task ID 字段`
                }), X.jsx(`input`, {
                  className: `bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`,
                  value: d.taskIdPath || ``,
                  onChange: e => f({
                    ...d,
                    taskIdPath: e.target.value
                  }),
                  placeholder: `如 data.task_id`
                })]
              }), X.jsxs(`div`, {
                className: `flex gap-2`,
                children: [X.jsxs(`div`, {
                  className: `flex flex-col gap-1 w-24`,
                  children: [X.jsx(`label`, {
                    className: `text-gray-500`,
                    children: `轮询 Method`
                  }), X.jsxs(`select`, {
                    className: `bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none h-[30px]`,
                    value: d.pollingMethod || `GET`,
                    onChange: e => f({
                      ...d,
                      pollingMethod: e.target.value
                    }),
                    children: [X.jsx(`option`, {
                      value: `GET`,
                      children: `GET`
                    }), X.jsx(`option`, {
                      value: `POST`,
                      children: `POST`
                    })]
                  })]
                }), X.jsxs(`div`, {
                  className: `flex flex-col gap-1 flex-1`,
                  children: [X.jsxs(`label`, {
                    className: `text-gray-500`,
                    children: [`轮询 API URL (支持 `, `{{task_id}}`, `)`]
                  }), X.jsx(`input`, {
                    className: `bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none h-[30px]`,
                    value: d.pollingUrl || ``,
                    onChange: e => f({
                      ...d,
                      pollingUrl: e.target.value
                    }),
                    placeholder: `如果与上方一致可留空`
                  })]
                })]
              }), X.jsxs(`div`, {
                className: `flex flex-col gap-1`,
                children: [X.jsx(`label`, {
                  className: `text-gray-500`,
                  children: `轮询 Headers (JSON格式, 留空同上)`
                }), X.jsx(`textarea`, {
                  className: `bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 font-mono text-[10px] h-20 resize-y focus:border-blue-500 outline-none custom-scrollbar nodrag nowheel nopan`,
                  value: d.pollingHeaders || ``,
                  onChange: e => f({
                    ...d,
                    pollingHeaders: e.target.value
                  }),
                  placeholder: `例如: {"Authorization": "Bearer xxx"}`,
                  onWheel: e => e.stopPropagation()
                })]
              }), X.jsxs(`div`, {
                className: `flex flex-col gap-1 ${d.pollingMethod === `GET` || !d.pollingMethod ? `hidden` : ``}`,
                children: [X.jsxs(`label`, {
                  className: `text-gray-500`,
                  children: [`轮询 Body (JSON格式, 支持 `, `{{task_id}}`, `)`]
                }), X.jsx(`textarea`, {
                  className: `bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 font-mono text-[10px] h-12 resize-y focus:border-blue-500 outline-none custom-scrollbar nodrag`,
                  value: d.pollingBody || ``,
                  onChange: e => f({
                    ...d,
                    pollingBody: e.target.value
                  }),
                  placeholder: `例如: {"taskId": "{{task_id}}"}`,
                  onWheel: e => e.stopPropagation()
                })]
              }), X.jsxs(`div`, {
                className: `flex gap-2`,
                children: [X.jsxs(`div`, {
                  className: `flex flex-col gap-1 flex-1`,
                  children: [X.jsx(`label`, {
                    className: `text-gray-500`,
                    children: `状态判断字段`
                  }), X.jsx(`input`, {
                    className: `bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`,
                    value: d.pollingResultPath || ``,
                    onChange: e => f({
                      ...d,
                      pollingResultPath: e.target.value
                    }),
                    placeholder: `如 data.status`
                  })]
                }), X.jsxs(`div`, {
                  className: `flex flex-col gap-1 flex-1`,
                  children: [X.jsx(`label`, {
                    className: `text-gray-500`,
                    children: `完成状态值`
                  }), X.jsx(`input`, {
                    className: `bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`,
                    value: d.pollingCompletedValue || ``,
                    onChange: e => f({
                      ...d,
                      pollingCompletedValue: e.target.value
                    }),
                    placeholder: `如 completed`
                  })]
                })]
              }), X.jsxs(`div`, {
                className: `flex gap-2`,
                children: [X.jsxs(`div`, {
                  className: `flex flex-col gap-1 flex-1`,
                  children: [X.jsx(`label`, {
                    className: `text-gray-500`,
                    children: `失败状态值`
                  }), X.jsx(`input`, {
                    className: `bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`,
                    value: d.pollingFailedValue || ``,
                    onChange: e => f({
                      ...d,
                      pollingFailedValue: e.target.value
                    }),
                    placeholder: `如 failed`
                  })]
                }), X.jsxs(`div`, {
                  className: `flex flex-col gap-1 flex-1`,
                  children: [X.jsx(`label`, {
                    className: `text-gray-500`,
                    children: `失败信息字段`
                  }), X.jsx(`input`, {
                    className: `bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`,
                    value: d.pollingErrorPath || ``,
                    onChange: e => f({
                      ...d,
                      pollingErrorPath: e.target.value
                    }),
                    placeholder: `如 data.error`
                  })]
                })]
              }), X.jsxs(`div`, {
                className: `flex flex-col gap-1`,
                children: [X.jsx(`label`, {
                  className: `text-gray-500`,
                  children: `进度判断字段`
                }), X.jsx(`input`, {
                  className: `bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`,
                  value: d.pollingProgressPath || ``,
                  onChange: e => f({
                    ...d,
                    pollingProgressPath: e.target.value
                  }),
                  placeholder: `如 data.progress (选填)`
                })]
              }), X.jsxs(`div`, {
                className: `flex gap-2`,
                children: [X.jsxs(`div`, {
                  className: `flex flex-col gap-1 flex-1`,
                  children: [X.jsx(`label`, {
                    className: `text-gray-500`,
                    children: `异步结果提取字段 (如轮询返回的 data.url)`
                  }), X.jsx(`input`, {
                    className: `bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`,
                    value: d.pollingResultDataPath || ``,
                    onChange: e => f({
                      ...d,
                      pollingResultDataPath: e.target.value
                    }),
                    placeholder: `留空则使用上方主请求提取字段`
                  })]
                }), d.outputType === `text` && X.jsxs(`div`, {
                  className: `flex flex-col gap-1 w-24`,
                  children: [X.jsx(`label`, {
                    className: `text-gray-500 text-center`,
                    children: `纯文本输出`
                  }), X.jsx(`div`, {
                    className: `flex items-center justify-center h-full`,
                    children: X.jsx(`input`, {
                      type: `checkbox`,
                      checked: d.rawTextOutput || false,
                      onChange: e => f({
                        ...d,
                        rawTextOutput: e.target.checked
                      }),
                      className: `w-4 h-4 accent-blue-500 cursor-pointer`
                    })
                  })]
                })]
              })]
            }), X.jsxs(`div`, {
              className: `flex gap-2 mt-2`,
              children: [X.jsx(`button`, {
                onClick: v,
                className: `flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors text-xs`,
                children: `完成配置`
              }), X.jsxs(`button`, {
                onClick: y,
                className: `py-1.5 px-3 bg-[#333] hover:bg-[#444] text-white rounded transition-colors flex items-center justify-center gap-1 text-xs`,
                title: `保存为自定义节点供下次使用`,
                children: [X.jsx(De, {
                  size: 12
                }), `保存模板`]
              })]
            })]
          }) : X.jsx(`div`, {
            className: `flex flex-col h-full nodrag`,
            children: X.jsxs(`div`, {
              className: `flex-1 flex flex-col min-h-[100px] pr-1`,
              children: [i.resultData && X.jsxs(`div`, {
                className: `flex-1 bg-[#0d0c0c] border border-[#333] rounded p-2 mb-2 overflow-auto custom-scrollbar flex min-h-[60px] max-h-[250px] ${d.outputType === `text` ? `items-start justify-start` : `items-center justify-center`}`,
                children: [d.outputType === `text` && X.jsx(`div`, {
                  className: `text-gray-300 text-xs whitespace-pre-wrap w-full align-top break-all`,
                  children: i.resultData
                }), d.outputType === `image` && X.jsx(`img`, {
                  src: i.resultData,
                  loading: `lazy`,
                  decoding: `async`,
                  className: `max-w-full max-h-full object-contain`
                }), d.outputType === `video` && X.jsx(`video`, {
                  src: i.resultData,
                  controls: true,
                  preload: `metadata`,
                  className: `max-w-full max-h-full`
                }), d.outputType === `audio` && X.jsx(`audio`, {
                  src: i.resultData,
                  controls: true,
                  className: `w-full`
                })]
              }), X.jsx(`div`, {
                className: `flex flex-col gap-3 mt-auto pt-2 pb-2`,
                children: l.length > 0 ? X.jsx(X.Fragment, {
                  children: l.map(e => X.jsxs(`div`, {
                    className: `flex flex-col gap-1 relative nodrag`,
                    children: [X.jsx(`div`, {
                      className: `absolute top-1/2 -translate-y-1/2`,
                      style: {
                        left: `-12px`
                      },
                      children: X.jsx(_r, {
                        type: `target`,
                        id: `var-${e.name}`,
                        position: J.Left,
                        variant: `small`,
                        title: `连接到变量: ${e.name}`
                      })
                    }), X.jsxs(`div`, {
                      className: `flex justify-between items-center mb-1`,
                      children: [X.jsx(`label`, {
                        className: `text-gray-400 text-[10px] ml-1`,
                        children: e.name
                      }), !e.options && !e.name.startsWith(`image`) && !e.name.startsWith(`audio`) && !e.name.startsWith(`video`) && !e.name.startsWith(`file`) && X.jsxs(`div`, {
                        className: `flex items-center gap-1 text-[9px]`,
                        children: [X.jsx(`span`, {
                          className: `${d.variableFormats?.[e.name] === `json` ? `text-gray-500` : `text-blue-400 font-bold`}`,
                          children: `Text`
                        }), X.jsx(`div`, {
                          className: `w-5 h-2.5 bg-[#333] rounded-full relative cursor-pointer`,
                          onClick: () => {
                            let t = (d.variableFormats?.[e.name] || `text`) === `text` ? `json` : `text`;
                            f(n => ({
                              ...n,
                              variableFormats: {
                                ...n.variableFormats,
                                [e.name]: t
                              }
                            }));
                          },
                          children: X.jsx(`div`, {
                            className: `absolute top-[1px] w-2 h-2 rounded-full transition-all ${d.variableFormats?.[e.name] === `json` ? `bg-blue-400 right-[1px]` : `bg-gray-400 left-[1px]`}`
                          })
                        }), X.jsx(`span`, {
                          className: `${d.variableFormats?.[e.name] === `json` ? `text-blue-400 font-bold` : `text-gray-500`}`,
                          children: `JSON`
                        })]
                      })]
                    }), e.options ? X.jsx(`select`, {
                      className: `w-full bg-[#0d0c0c] border border-[#333] rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500`,
                      value: s[e.name] || e.options[0],
                      onChange: t => c(n => ({
                        ...n,
                        [e.name]: t.target.value
                      })),
                      children: e.options.map(e => X.jsx(`option`, {
                        value: e,
                        children: e
                      }, e))
                    }) : e.name.startsWith(`image`) || e.name.startsWith(`audio`) || e.name.startsWith(`video`) || e.name.startsWith(`file`) ? X.jsx(`div`, {
                      className: `flex items-center gap-2`,
                      children: s[e.name] ? X.jsxs(`div`, {
                        className: `relative w-full h-12 rounded overflow-hidden border border-[#444] flex items-center justify-center bg-[#0d0c0c]`,
                        children: [e.name.startsWith(`image`) && X.jsx(`img`, {
                          src: s[e.name],
                          loading: `lazy`,
                          decoding: `async`,
                          className: `w-full h-full object-cover`
                        }), e.name.startsWith(`audio`) && X.jsx(`audio`, {
                          src: s[e.name],
                          controls: true,
                          className: `w-full h-full`
                        }), e.name.startsWith(`video`) && X.jsx(`video`, {
                          src: s[e.name],
                          preload: `metadata`,
                          className: `w-full h-full object-cover`
                        }), e.name.startsWith(`file`) && X.jsx(`div`, {
                          className: `text-xs text-gray-400 break-all p-1 text-center line-clamp-2`,
                          children: `文件已上传`
                        }), X.jsx(`button`, {
                          onClick: () => c(t => {
                            let n = {
                              ...t
                            };
                            return delete n[e.name], n;
                          }),
                          className: `absolute top-0 right-0 bg-red-500/80 text-white p-0.5 rounded-bl z-10`,
                          children: X.jsx(oe, {
                            size: 8,
                            fill: `currentColor`
                          })
                        })]
                      }) : X.jsxs(`label`, {
                        className: `flex-1 border border-dashed border-[#444] hover:border-blue-500 rounded p-2 flex items-center justify-center cursor-pointer text-gray-500 hover:text-blue-400 transition-colors text-xs`,
                        children: [X.jsx(jn, {
                          size: 12,
                          className: `mr-1`
                        }), e.name.startsWith(`image`) ? `上传图片` : e.name.startsWith(`audio`) ? `上传音频` : e.name.startsWith(`video`) ? `上传视频` : `上传文件`, X.jsx(`input`, {
                          type: `file`,
                          accept: e.name.startsWith(`image`) ? `image/*` : e.name.startsWith(`audio`) ? `audio/*` : e.name.startsWith(`video`) ? `video/*` : `*/*`,
                          className: `hidden`,
                          onChange: t => {
                            t.target.files?.[0] && x(e.name, t.target.files[0]);
                          }
                        })]
                      })
                    }) : X.jsx(`textarea`, {
                      className: `w-full bg-[#0d0c0c] border border-[#333] rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500 custom-scrollbar resize-y nodrag min-h-[30px]`,
                      placeholder: `输入 ${e.name}...`,
                      value: s[e.name] || ``,
                      onChange: t => c(n => ({
                        ...n,
                        [e.name]: t.target.value
                      })),
                      onWheel: e => e.stopPropagation()
                    })]
                  }, e.name))
                }) : X.jsxs(`div`, {
                  className: `text-gray-500 text-xs text-center py-4 border border-dashed border-[#444] rounded`,
                  children: [`当前配置未提取到变量。`, X.jsx(`br`, {}), `在编辑模式下使用 `, `{{变量名}}`, ` 添加变量。`]
                })
              }), X.jsx(`div`, {
                className: `mt-auto pt-2`,
                children: X.jsxs(`button`, {
                  onClick: e => {
                    e.stopPropagation(), b(e);
                  },
                  disabled: i.loading,
                  className: `w-full py-2 bg-white hover:bg-gray-100 text-black rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 font-medium text-sm`,
                  children: [i.loading ? X.jsx(L, {
                    size: 14,
                    className: `animate-spin`
                  }) : X.jsx(ct, {
                    size: 14,
                    fill: `currentColor`
                  }), i.loading ? `处理中...` : `开始处理`]
                })
              })]
            })
          })]
        }), X.jsx(_r, {
          type: `source`,
          position: J.Right,
          variant: `small`
        })]
      })]
    });
  }),