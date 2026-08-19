// TODO(全局, 无需 import): data, selected, updateNodeData, i, apiUrl, method, headers, body, outputType, executionMode, resultPath, x, b, v, r, selectedModel, n, name, options, u, p, g, f, taskIdPath, pollingUrl, pollingMethod, pollingHeaders, pollingBody, pollingResultPath, pollingCompletedValue, pollingFailedValue, pollingErrorPath, pollingProgressPath, pollingResultDataPath, rawTextOutput, config, variables, s, configMode, o, subfolder, preferThumbnail, thumbMaxDim, thumbQuality, width, minHeight, color, m, l, left, variableFormats
import _cmp_Ti from './Ti.jsx';
import _cmp_Oi from './Oi.jsx';
import _cmp__Component10 from './_Component10.jsx';
import { id, We, t, e, y, _, d, a, xi, c, ma, sa, ca, va, ha, S, h, C, w, X, D, E, _Component45, _Component22, T, _Component16, B, _Component33, _Component19, Jt, _Component8, _Component42 } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
var ac = Z.memo(({
  id: e,
  data: t,
  selected: n
}) => {
  let {
    updateNodeData: r
  } = We();
  let i = t;
  let [a, o] = Z.useState(i.configMode === undefined ? true : i.configMode);
  let [s, c] = Z.useState(i.config?.variables || {});
  let [l, u] = Z.useState([]);
  let [d, f] = Z.useState(i.config || {
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
  });
  let [p, m] = Z.useState(``);
  let [h, g] = Z.useState(false);
  let [_, v] = Z.useState(i.selectedModel || localStorage.getItem(`mutiwindow_text_model`) || i.textModel?.split(`
`)[0]?.trim() || ``);
  let [y, b] = Z.useState(false);
  let x = Z.useRef(null);
  Z.useEffect(() => {
    let e = e => {
      if (x.current && !x.current.contains(e.target)) {
        b(false);
      }
    };
    if (y) {
      document.addEventListener(`mousedown`, e, true);
    }
    return () => {
      return document.removeEventListener(`mousedown`, e, true);
    };
  }, [y]);
  Z.useEffect(() => {
    if (i.selectedModel) {
      v(i.selectedModel);
    }
  }, [i.selectedModel]);
  Z.useEffect(() => {
    if (!_ && i.textModel) {
      let t = i.textModel.split(`
`).map(e => {
        return e.trim();
      }).find(Boolean) || ``;
      if (t) {
        v(t);
        r(e, {
          selectedModel: t
        });
      }
    }
  }, [e, i.textModel, _, r]);
  Z.useEffect(() => {
    let e = `${d.body || ``} ${d.apiUrl || ``} ${d.headers || ``}`;
    let t = /\{\{([^}]+)\}\}/g;
    let n;
    let r = [];
    let i = new Set();
    while ((n = t.exec(e)) !== null) {
      let e = n[1].trim();
      if (!i.has(e)) {
        i.add(e);
        if (e.includes(`|`)) {
          let [t, n] = e.split(`|`);
          r.push({
            name: t.trim(),
            options: n.split(`,`).map(e => {
              return e.trim();
            })
          });
        } else {
          r.push({
            name: e
          });
        }
      }
    }
    u(r);
  }, [d.body, d.apiUrl, d.headers]);
  let S = async () => {
    if (p.trim()) {
      if (!i.onAIAssist) {
        i.onShowToast?.(`AI辅助不可用，请检查API配置`);
        return;
      }
      g(true);
      try {
        let e = await i.onAIAssist(p, d, _);
        try {
          let t = JSON.parse(e);
          f(e => {
            return {
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
            };
          });
          i.onShowToast?.(`AI 生成配置成功`);
        } catch (t) {
          console.error(`AI 返回的 JSON 解析失败`, t, e);
          i.onShowToast?.(`AI 生成格式错误，请重试`);
        }
      } catch (e) {
        i.onShowToast?.(e.message || `AI 生成失败`);
      } finally {
        g(false);
      }
    }
  };
  let C = () => {
    r(e, {
      config: {
        ...d,
        variables: s
      },
      configMode: false
    });
    o(false);
  };
  let w = () => {
    if (!d.apiUrl) {
      i.onShowToast?.(`请至少填写 API URL`);
      return;
    }
    let e = window.prompt(`请输入自定义节点名称:`, t.label || `万能节点`);
    if (e && i.onSaveTemplate) {
      i.onSaveTemplate(e, {
        ...d,
        variables: s
      });
    }
  };
  let E = t => {
    t.stopPropagation();
    if (a) {
      i.onShowToast?.(`请先完成配置`);
      return;
    }
    let n = {
      ...d,
      variables: s
    };
    f(n);
    r(e, {
      config: n
    });
    setTimeout(() => {
      console.log(`CustomNode handleRun triggered, calling onGenerateCustom`, i.onGenerateCustom);
      if (i.onGenerateCustom) {
        i.onGenerateCustom(e);
      } else {
        i.onShowToast?.(`未找到执行方法，请刷新页面重试`);
      }
    }, 50);
  };
  let D = async (e, t) => {
    try {
      let n = await xi(t, {
        subfolder: `canvas/upload`,
        preferThumbnail: t.type.startsWith(`image/`),
        thumbMaxDim: 480,
        thumbQuality: 75
      });
      if (n.url && /^https?:\/\//i.test(n.url)) {
        c(t => {
          return {
            ...t,
            [e]: n.url
          };
        });
        return;
      }
    } catch (e) {
      console.warn(`[CustomNode] urlifyAsset failed, fallback to base64:`, e);
    }
    let n = new FileReader();
    n.onload = t => {
      if (t.target?.result) {
        c(n => {
          return {
            ...n,
            [e]: t.target.result
          };
        });
      }
    };
    n.readAsDataURL(t);
  };
  const Component1139 = `button`;
  const Component1140 = `button`;
  const Component1141 = `div`;
  const Component1142 = `div`;
  const Component1143 = `span`;
  const Component1144 = `button`;
  const Component1145 = `div`;
  const Component1146 = `span`;
  const Component1147 = `div`;
  const Component1148 = `label`;
  const Component1149 = `span`;
  const Component1150 = `span`;
  const Component1151 = `button`;
  const Component1159 = `div`;
  const Component1160 = `div`;
  const Component1161 = `textarea`;
  const Component1162 = `span`;
  const Component1163 = `button`;
  const Component1164 = `div`;
  const Component1165 = `div`;
  const Component1166 = `label`;
  const Component1167 = `option`;
  const Component1168 = `option`;
  const Component1169 = `option`;
  const Component1170 = `select`;
  const Component1171 = `div`;
  const Component1172 = `label`;
  const Component1173 = `input`;
  const Component1174 = `div`;
  const Component1175 = `div`;
  const Component1176 = `label`;
  const Component1177 = `button`;
  const Component1178 = `button`;
  const Component1179 = `div`;
  const Component1180 = `div`;
  const Component1181 = `textarea`;
  const Component1182 = `div`;
  const Component1183 = `span`;
  const Component1184 = `label`;
  const Component1185 = `textarea`;
  const Component1186 = `div`;
  const Component1187 = `label`;
  const Component1188 = `option`;
  const Component1189 = `option`;
  const Component1190 = `option`;
  const Component1191 = `option`;
  const Component1192 = `select`;
  const Component1193 = `div`;
  const Component1194 = `label`;
  const Component1195 = `option`;
  const Component1196 = `option`;
  const Component1197 = `select`;
  const Component1198 = `div`;
  const Component1199 = `div`;
  const Component1200 = `label`;
  const Component1201 = `input`;
  const Component1202 = `div`;
  const Component1203 = `label`;
  const Component1204 = `input`;
  const Component1205 = `div`;
  const Component1206 = `div`;
  const Component1207 = `div`;
  const Component1208 = `label`;
  const Component1209 = `input`;
  const Component1210 = `div`;
  const Component1211 = `label`;
  const Component1212 = `option`;
  const Component1213 = `option`;
  const Component1214 = `select`;
  const Component1215 = `div`;
  const Component1216 = `label`;
  const Component1217 = `input`;
  const Component1218 = `div`;
  const Component1219 = `div`;
  const Component1220 = `label`;
  const Component1221 = `textarea`;
  const Component1222 = `div`;
  const Component1223 = `label`;
  const Component1224 = `textarea`;
  const Component1225 = `div`;
  const Component1226 = `label`;
  const Component1227 = `input`;
  const Component1228 = `div`;
  const Component1229 = `label`;
  const Component1230 = `input`;
  const Component1231 = `div`;
  const Component1232 = `div`;
  const Component1233 = `label`;
  const Component1234 = `input`;
  const Component1235 = `div`;
  const Component1236 = `label`;
  const Component1237 = `input`;
  const Component1238 = `div`;
  const Component1239 = `div`;
  const Component1240 = `label`;
  const Component1241 = `input`;
  const Component1242 = `div`;
  const Component1243 = `label`;
  const Component1244 = `input`;
  const Component1245 = `div`;
  const Component1246 = `label`;
  const Component1247 = `input`;
  const Component1248 = `div`;
  const Component1249 = `div`;
  const Component1250 = `div`;
  const Component1251 = `div`;
  const Component1252 = `button`;
  const Component1253 = `button`;
  const Component1254 = `div`;
  const Component1255 = `div`;
  const Component1256 = `div`;
  const Component1257 = `img`;
  const Component1258 = `video`;
  const Component1259 = `audio`;
  const Component1260 = `div`;
  const Component1261 = `div`;
  const Component1262 = `label`;
  const Component1263 = `span`;
  const Component1264 = `div`;
  const Component1265 = `div`;
  const Component1266 = `span`;
  const Component1267 = `div`;
  const Component1268 = `div`;
  const Component1269 = `option`;
  const Component1270 = `select`;
  const Component1271 = `img`;
  const Component1272 = `audio`;
  const Component1273 = `video`;
  const Component1274 = `div`;
  const Component1275 = `button`;
  const Component1276 = `div`;
  const Component1277 = `input`;
  const Component1278 = `label`;
  const Component1279 = `div`;
  const Component1280 = `textarea`;
  const Component1281 = `div`;
  const Component1282 = `br`;
  const Component1283 = `div`;
  const Component1284 = `div`;
  const Component1285 = `button`;
  const Component1286 = `div`;
  const Component1287 = `div`;
  const Component1288 = `div`;
  const Component1289 = `div`;
  const Component1290 = `div`;
  const Component1291 = `div`;
  return <Component1291 className={`flex flex-col items-center group/node transition-all ${n ? `z-50` : `z-10`}`}>
      <_cmp_Ti id={e} data={t} defaultTitle={`万能节点`} icon={<_Component45 size={11} className={`text-gray-500`} />} />
      <Component1290 className={`relative bg-[#1c1c1c] rounded-xl overflow-visible border shadow-xl transition-all duration-300 flex flex-col
                ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}
                `} style={{
      width: `400px`,
      minHeight: a ? `450px` : `250px`
    }}>
        <Component1142 className={`absolute top-2 right-2 z-20 flex items-center gap-2 nodrag`}>
          {i.loading && <_Component22 size={12} className={`animate-spin flex-shrink-0`} style={{
          color: `rgb(210,2,7)`
        }} />}
          <Component1141 className={`flex bg-[#0d0c0c]/90 rounded p-0.5 border border-[#333]`}>
            <Component1139 className={`px-2 py-1 text-[10px] rounded transition-colors ${a ? `bg-[#333] text-white` : `text-gray-400 hover:text-gray-200`}`} onClick={() => {
            o(true);
            r(e, {
              configMode: true
            });
          }}>{`编辑模式`}</Component1139>
            <Component1140 className={`px-2 py-1 text-[10px] rounded transition-colors ${a ? `text-gray-400 hover:text-gray-200` : `bg-[#333] text-white`}`} onClick={() => {
            o(false);
            r(e, {
              configMode: false
            });
          }}>{`工作模式`}</Component1140>
          </Component1141>
        </Component1142>
        <Component1289 className={`flex-1 flex flex-col p-3 bg-[#1a1a1a] relative drag-handle rounded-xl`}>
          {i.loading && <Component1145 className={`absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500 bg-[#1a1a1a]/80 backdrop-blur-sm z-10`}>
              <_cmp_Oi size={24} />
              <Component1143 className={`text-xs`}>
                {d.executionMode === `async` ? `请求中... ${i.progress || 0}%` : `请求中...`}
              </Component1143>
              <Component1144 onClick={t => {
            t.stopPropagation();
            if (i.onStop) {
              i.onStop(e);
            }
          }} className={`mt-2 bg-[#222]/80 hover:bg-[#333] border border-[#444] text-gray-400 hover:text-gray-200 px-3 py-1 rounded-full text-[10px] flex items-center gap-1.5 transition-colors backdrop-blur-sm nodrag`}>
                <T size={10} fill={`currentColor`} />
                {`停止`}
              </Component1144>
            </Component1145>}
          {i.errorMessage && <Component1147 className={`text-red-400 text-[10px] p-2 mb-2 border border-red-500/30 rounded bg-red-500/10 flex items-start gap-1.5`}>
              <_Component16 size={12} className={`mt-0.5 flex-shrink-0`} />
              <Component1146 className={`break-all`}>{i.errorMessage}</Component1146>
            </Component1147>}
          {a ? <Component1255 className={`flex flex-col gap-3 nodrag text-xs`}>
              <Component1165 className={`flex flex-col gap-1`}>
                <Component1148 className={`text-gray-500 flex items-center gap-1`}>
                  <B size={12} className={`text-yellow-500`} />
                  {`AI 辅助配置`}
                </Component1148>
                <Component1164 className={`flex flex-col gap-2`}>
                  {i.textModel && <Component1160 className={`relative`} ref={x}>
                      <Component1151 type={`button`} onClick={e => {
                  e.stopPropagation();
                  b(e => {
                    return !e;
                  });
                }} className={`w-full h-8 px-2 bg-[#0d0c0c] border border-[#333] hover:border-[#444] rounded flex items-center gap-1.5 text-[10px] text-gray-300`} title={_ || `选择文本模型`}>
                        {_ && <Component1149 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${ma(_) ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                            {ma(_) ? `内置` : `三方`}
                          </Component1149>}
                        <Component1150 className={`flex-1 truncate text-left`}>
                          {_ || `选择文本模型`}
                        </Component1150>
                        <_Component33 size={12} className={`shrink-0 text-gray-500`} />
                      </Component1151>
                      {y && <Component1159 className={`absolute left-0 top-full mt-1 w-full min-w-[17rem] max-h-56 overflow-y-auto custom-scrollbar bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 nowheel nopan nodrag`} onClick={e => {
                  return e.stopPropagation();
                }} onWheel={e => {
                  return e.stopPropagation();
                }}>
                          {(() => {
                    let t = i.textModel.split(`
`).map(e => {
                      return e.trim();
                    }).filter(Boolean);
                    let n = t.filter(ma).sort((e, t) => {
                      return e.localeCompare(t);
                    });
                    let a = t.filter(e => {
                      return !ma(e);
                    }).sort((e, t) => {
                      return e.localeCompare(t);
                    });
                    let o = t => {
                      v(t);
                      r(e, {
                        selectedModel: t
                      });
                      localStorage.setItem(`mutiwindow_text_model`, t);
                      b(false);
                    };
                    let s = e => {
                      let t = ma(e);
                      let n = t ? sa(e) : null;
                      let r = t ? ca(e) : null;
                      let i = va(e, _ === e);
                      const Component1152 = `span`;
                      const Component1153 = `span`;
                      const Component1154 = `span`;
                      const Component1155 = `div`;
                      return <Component1155 role={`button`} className={i.className} title={i.title} onClick={() => {
                        if (!i.disabled) {
                          o(e);
                        }
                      }} key={e}>
                                  <Component1152 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${t ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                                    {t ? `内置` : `三方`}
                                  </Component1152>
                                  <Component1153 className={`flex-1 truncate`}>{e}</Component1153>
                                  {n !== null && <Component1154 className={`shrink-0 inline-flex items-center gap-0.5 text-[10px] text-orange-400 tabular-nums`}>
                                      <_Component19 size={10} />
                                      {ha(n)}
                                      {r ? `/${r}` : ``}
                                    </Component1154>}
                                </Component1155>;
                    };
                    const Component1156 = `div`;
                    const Component1157 = `div`;
                    const Component1158 = `div`;
                    return <Q.Fragment>
                                {n.length > 0 && <Q.Fragment>
                                    <Component1156 className={`text-[10px] text-blue-300 mb-1 px-1`}>{`内置模型`}</Component1156>
                                    {n.map(s)}
                                  </Q.Fragment>}
                                {a.length > 0 && <Q.Fragment>
                                    {n.length > 0 && <Component1157 className={`h-px bg-[#333] my-1.5`} />}
                                    <Component1158 className={`text-[10px] text-gray-500 mb-1 px-1`}>{`第三方 API`}</Component1158>
                                    {a.map(s)}
                                  </Q.Fragment>}
                              </Q.Fragment>;
                  })()}
                        </Component1159>}
                    </Component1160>}
                  <Component1161 className={`flex-1 bg-[#0d0c0c] border border-[#333] rounded p-2 text-gray-200 focus:border-blue-500 outline-none custom-scrollbar text-[10px] resize-y nodrag nowheel nopan`} placeholder={`描述你想调用的API... (如：调用百度翻译)`} value={p} onChange={e => {
                return m(e.target.value);
              }} onKeyDown={e => {
                if (e.key === `Enter` && (e.ctrlKey || e.metaKey)) {
                  S();
                }
              }} onWheel={e => {
                return e.stopPropagation();
              }} rows={3} />
                  <Component1163 onClick={S} disabled={h} className={`py-1.5 w-full bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 rounded transition-colors flex items-center justify-center gap-1`}>
                    {h ? <_Component22 size={12} className={`animate-spin`} /> : `生成`}
                    {!h && <Component1162 className={`text-[10px] text-blue-400/70`}>{`(Ctrl+Enter)`}</Component1162>}
                  </Component1163>
                </Component1164>
              </Component1165>
              <Component1175 className={`flex gap-2`}>
                <Component1171 className={`flex flex-col gap-1 w-20`}>
                  <Component1166 className={`text-gray-500`}>{`Method`}</Component1166>
                  <Component1170 className={`bg-[#0d0c0c] border border-[#333] rounded px-1 py-1 text-gray-200 outline-none`} value={d.method} onChange={e => {
                return f({
                  ...d,
                  method: e.target.value
                });
              }}>
                    <Component1167>{`GET`}</Component1167>
                    <Component1168>{`POST`}</Component1168>
                    <Component1169>{`PUT`}</Component1169>
                  </Component1170>
                </Component1171>
                <Component1174 className={`flex flex-col gap-1 flex-1`}>
                  <Component1172 className={`text-gray-500`}>{`API URL`}</Component1172>
                  <Component1173 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 focus:border-blue-500 outline-none`} value={d.apiUrl} onChange={e => {
                return f({
                  ...d,
                  apiUrl: e.target.value
                });
              }} />
                </Component1174>
              </Component1175>
              <Component1182 className={`flex flex-col gap-1`}>
                <Component1180 className={`flex justify-between items-center`}>
                  <Component1176 className={`text-gray-500`}>{`Headers (JSON格式)`}</Component1176>
                  <Component1179 className={`flex gap-1`}>
                    <Component1177 onClick={() => {
                  return f({
                    ...d,
                    headers: `{
  "Content-Type": "application/json"
}`
                  });
                }} className={`text-[9px] bg-[#333] hover:bg-[#444] px-1.5 py-0.5 rounded text-gray-300 transition-colors`}>{`JSON`}</Component1177>
                    <Component1178 onClick={() => {
                  return f({
                    ...d,
                    headers: `{
  "Content-Type": "multipart/form-data"
}`
                  });
                }} className={`text-[9px] bg-[#333] hover:bg-[#444] px-1.5 py-0.5 rounded text-gray-300 transition-colors`}>{`FormData`}</Component1178>
                  </Component1179>
                </Component1180>
                <Component1181 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 font-mono text-[10px] h-16 resize-y focus:border-blue-500 outline-none custom-scrollbar nodrag nowheel nopan`} value={d.headers} onChange={e => {
              return f({
                ...d,
                headers: e.target.value
              });
            }} onWheel={e => {
              return e.stopPropagation();
            }} />
              </Component1182>
              <Component1186 className={`flex flex-col gap-1`}>
                <Component1184 className={`text-gray-500 flex justify-between`}>
                  <Component1183>
                    {`Body (支持变量: `}
                    {`{{prompt}}`}
                    {`, `}
                    {`{{image_1}}`}
                    {`)`}
                  </Component1183>
                </Component1184>
                <Component1185 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 font-mono text-[10px] h-24 resize-y focus:border-blue-500 outline-none custom-scrollbar nodrag nowheel nopan`} value={d.body} onChange={e => {
              return f({
                ...d,
                body: e.target.value
              });
            }} onWheel={e => {
              return e.stopPropagation();
            }} />
              </Component1186>
              <Component1199 className={`flex gap-2`}>
                <Component1193 className={`flex flex-col gap-1 flex-1`}>
                  <Component1187 className={`text-gray-500`}>{`输出类型`}</Component1187>
                  <Component1192 className={`bg-[#0d0c0c] border border-[#333] rounded px-1 py-1 text-gray-200 outline-none`} value={d.outputType} onChange={e => {
                return f({
                  ...d,
                  outputType: e.target.value
                });
              }}>
                    <Component1188 value={`text`}>{`文本 (Text)`}</Component1188>
                    <Component1189 value={`image`}>{`图片 (Image URL)`}</Component1189>
                    <Component1190 value={`video`}>{`视频 (Video URL)`}</Component1190>
                    <Component1191 value={`audio`}>{`音频 (Audio URL)`}</Component1191>
                  </Component1192>
                </Component1193>
                <Component1198 className={`flex flex-col gap-1 flex-1`}>
                  <Component1194 className={`text-gray-500`}>{`执行模式`}</Component1194>
                  <Component1197 className={`bg-[#0d0c0c] border border-[#333] rounded px-1 py-1 text-gray-200 outline-none`} value={d.executionMode} onChange={e => {
                return f({
                  ...d,
                  executionMode: e.target.value
                });
              }}>
                    <Component1195 value={`sync`}>{`同步 (立即返回)`}</Component1195>
                    <Component1196 value={`async`}>{`异步 (需轮询)`}</Component1196>
                  </Component1197>
                </Component1198>
              </Component1199>
              <Component1207 className={`flex gap-2`}>
                <Component1202 className={`flex flex-col gap-1 flex-1`}>
                  <Component1200 className={`text-gray-500`}>{`提取结果字段 (JSON Path, 如 data.url)`}</Component1200>
                  <Component1201 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 focus:border-blue-500 outline-none`} value={d.resultPath} onChange={e => {
                return f({
                  ...d,
                  resultPath: e.target.value
                });
              }} placeholder={`如 choices[0].message.content`} />
                </Component1202>
                {d.outputType === `text` && <Component1206 className={`flex flex-col gap-1 w-24`}>
                    <Component1203 className={`text-gray-500 text-center`}>{`纯文本输出`}</Component1203>
                    <Component1205 className={`flex items-center justify-center h-full`}>
                      <Component1204 type={`checkbox`} checked={d.rawTextOutput || false} onChange={e => {
                  return f({
                    ...d,
                    rawTextOutput: e.target.checked
                  });
                }} className={`w-4 h-4 accent-blue-500 cursor-pointer`} />
                    </Component1205>
                  </Component1206>}
              </Component1207>
              {d.executionMode === `async` && <Component1251 className={`flex flex-col gap-2 p-2 bg-[#222] border border-[#333] rounded mt-1`}>
                  <Component1210 className={`flex flex-col gap-1`}>
                    <Component1208 className={`text-gray-500`}>{`提取 Task ID 字段`}</Component1208>
                    <Component1209 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`} value={d.taskIdPath || ``} onChange={e => {
                return f({
                  ...d,
                  taskIdPath: e.target.value
                });
              }} placeholder={`如 data.task_id`} />
                  </Component1210>
                  <Component1219 className={`flex gap-2`}>
                    <Component1215 className={`flex flex-col gap-1 w-24`}>
                      <Component1211 className={`text-gray-500`}>{`轮询 Method`}</Component1211>
                      <Component1214 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none h-[30px]`} value={d.pollingMethod || `GET`} onChange={e => {
                  return f({
                    ...d,
                    pollingMethod: e.target.value
                  });
                }}>
                        <Component1212 value={`GET`}>{`GET`}</Component1212>
                        <Component1213 value={`POST`}>{`POST`}</Component1213>
                      </Component1214>
                    </Component1215>
                    <Component1218 className={`flex flex-col gap-1 flex-1`}>
                      <Component1216 className={`text-gray-500`}>
                        {`轮询 API URL (支持 `}
                        {`{{task_id}}`}
                        {`)`}
                      </Component1216>
                      <Component1217 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none h-[30px]`} value={d.pollingUrl || ``} onChange={e => {
                  return f({
                    ...d,
                    pollingUrl: e.target.value
                  });
                }} placeholder={`如果与上方一致可留空`} />
                    </Component1218>
                  </Component1219>
                  <Component1222 className={`flex flex-col gap-1`}>
                    <Component1220 className={`text-gray-500`}>{`轮询 Headers (JSON格式, 留空同上)`}</Component1220>
                    <Component1221 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 font-mono text-[10px] h-20 resize-y focus:border-blue-500 outline-none custom-scrollbar nodrag nowheel nopan`} value={d.pollingHeaders || ``} onChange={e => {
                return f({
                  ...d,
                  pollingHeaders: e.target.value
                });
              }} placeholder={`例如: {"Authorization": "Bearer xxx"}`} onWheel={e => {
                return e.stopPropagation();
              }} />
                  </Component1222>
                  <Component1225 className={`flex flex-col gap-1 ${d.pollingMethod === `GET` || !d.pollingMethod ? `hidden` : ``}`}>
                    <Component1223 className={`text-gray-500`}>
                      {`轮询 Body (JSON格式, 支持 `}
                      {`{{task_id}}`}
                      {`)`}
                    </Component1223>
                    <Component1224 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 font-mono text-[10px] h-12 resize-y focus:border-blue-500 outline-none custom-scrollbar nodrag`} value={d.pollingBody || ``} onChange={e => {
                return f({
                  ...d,
                  pollingBody: e.target.value
                });
              }} placeholder={`例如: {"taskId": "{{task_id}}"}`} onWheel={e => {
                return e.stopPropagation();
              }} />
                  </Component1225>
                  <Component1232 className={`flex gap-2`}>
                    <Component1228 className={`flex flex-col gap-1 flex-1`}>
                      <Component1226 className={`text-gray-500`}>{`状态判断字段`}</Component1226>
                      <Component1227 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`} value={d.pollingResultPath || ``} onChange={e => {
                  return f({
                    ...d,
                    pollingResultPath: e.target.value
                  });
                }} placeholder={`如 data.status`} />
                    </Component1228>
                    <Component1231 className={`flex flex-col gap-1 flex-1`}>
                      <Component1229 className={`text-gray-500`}>{`完成状态值`}</Component1229>
                      <Component1230 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`} value={d.pollingCompletedValue || ``} onChange={e => {
                  return f({
                    ...d,
                    pollingCompletedValue: e.target.value
                  });
                }} placeholder={`如 completed`} />
                    </Component1231>
                  </Component1232>
                  <Component1239 className={`flex gap-2`}>
                    <Component1235 className={`flex flex-col gap-1 flex-1`}>
                      <Component1233 className={`text-gray-500`}>{`失败状态值`}</Component1233>
                      <Component1234 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`} value={d.pollingFailedValue || ``} onChange={e => {
                  return f({
                    ...d,
                    pollingFailedValue: e.target.value
                  });
                }} placeholder={`如 failed`} />
                    </Component1235>
                    <Component1238 className={`flex flex-col gap-1 flex-1`}>
                      <Component1236 className={`text-gray-500`}>{`失败信息字段`}</Component1236>
                      <Component1237 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`} value={d.pollingErrorPath || ``} onChange={e => {
                  return f({
                    ...d,
                    pollingErrorPath: e.target.value
                  });
                }} placeholder={`如 data.error`} />
                    </Component1238>
                  </Component1239>
                  <Component1242 className={`flex flex-col gap-1`}>
                    <Component1240 className={`text-gray-500`}>{`进度判断字段`}</Component1240>
                    <Component1241 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`} value={d.pollingProgressPath || ``} onChange={e => {
                return f({
                  ...d,
                  pollingProgressPath: e.target.value
                });
              }} placeholder={`如 data.progress (选填)`} />
                  </Component1242>
                  <Component1250 className={`flex gap-2`}>
                    <Component1245 className={`flex flex-col gap-1 flex-1`}>
                      <Component1243 className={`text-gray-500`}>{`异步结果提取字段 (如轮询返回的 data.url)`}</Component1243>
                      <Component1244 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`} value={d.pollingResultDataPath || ``} onChange={e => {
                  return f({
                    ...d,
                    pollingResultDataPath: e.target.value
                  });
                }} placeholder={`留空则使用上方主请求提取字段`} />
                    </Component1245>
                    {d.outputType === `text` && <Component1249 className={`flex flex-col gap-1 w-24`}>
                        <Component1246 className={`text-gray-500 text-center`}>{`纯文本输出`}</Component1246>
                        <Component1248 className={`flex items-center justify-center h-full`}>
                          <Component1247 type={`checkbox`} checked={d.rawTextOutput || false} onChange={e => {
                    return f({
                      ...d,
                      rawTextOutput: e.target.checked
                    });
                  }} className={`w-4 h-4 accent-blue-500 cursor-pointer`} />
                        </Component1248>
                      </Component1249>}
                  </Component1250>
                </Component1251>}
              <Component1254 className={`flex gap-2 mt-2`}>
                <Component1252 onClick={C} className={`flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors text-xs`}>{`完成配置`}</Component1252>
                <Component1253 onClick={w} className={`py-1.5 px-3 bg-[#333] hover:bg-[#444] text-white rounded transition-colors flex items-center justify-center gap-1 text-xs`} title={`保存为自定义节点供下次使用`}>
                  <Jt size={12} />
                  {`保存模板`}
                </Component1253>
              </Component1254>
            </Component1255> : <Component1288 className={`flex flex-col h-full nodrag`}>
              <Component1287 className={`flex-1 flex flex-col min-h-[100px] pr-1`}>
                {i.resultData && <Component1260 className={`flex-1 bg-[#0d0c0c] border border-[#333] rounded p-2 mb-2 overflow-auto custom-scrollbar flex min-h-[60px] max-h-[250px] ${d.outputType === `text` ? `items-start justify-start` : `items-center justify-center`}`}>
                    {d.outputType === `text` && <Component1256 className={`text-gray-300 text-xs whitespace-pre-wrap w-full align-top break-all`}>
                        {i.resultData}
                      </Component1256>}
                    {d.outputType === `image` && <Component1257 src={i.resultData} loading={`lazy`} decoding={`async`} className={`max-w-full max-h-full object-contain`} />}
                    {d.outputType === `video` && <Component1258 src={i.resultData} controls={true} preload={`metadata`} className={`max-w-full max-h-full`} />}
                    {d.outputType === `audio` && <Component1259 src={i.resultData} controls={true} className={`w-full`} />}
                  </Component1260>}
                <Component1284 className={`flex flex-col gap-3 mt-auto pt-2 pb-2`}>
                  {l.length > 0 ? <Q.Fragment>
                      {l.map(e => {
                  return <Component1281 className={`flex flex-col gap-1 relative nodrag`} key={e.name}>
                            <Component1261 className={`absolute top-1/2 -translate-y-1/2`} style={{
                      left: `-12px`
                    }}>
                              <_cmp__Component10 type={`target`} id={`var-${e.name}`} position={X.Left} variant={`small`} title={`连接到变量: ${e.name}`} />
                            </Component1261>
                            <Component1268 className={`flex justify-between items-center mb-1`}>
                              <Component1262 className={`text-gray-400 text-[10px] ml-1`}>
                                {e.name}
                              </Component1262>
                              {!e.options && !e.name.startsWith(`image`) && !e.name.startsWith(`audio`) && !e.name.startsWith(`video`) && !e.name.startsWith(`file`) && <Component1267 className={`flex items-center gap-1 text-[9px]`}>
                                    <Component1263 className={`${d.variableFormats?.[e.name] === `json` ? `text-gray-500` : `text-blue-400 font-bold`}`}>{`Text`}</Component1263>
                                    <Component1265 className={`w-5 h-2.5 bg-[#333] rounded-full relative cursor-pointer`} onClick={() => {
                          let t = (d.variableFormats?.[e.name] || `text`) === `text` ? `json` : `text`;
                          f(n => {
                            return {
                              ...n,
                              variableFormats: {
                                ...n.variableFormats,
                                [e.name]: t
                              }
                            };
                          });
                        }}>
                                      <Component1264 className={`absolute top-[1px] w-2 h-2 rounded-full transition-all ${d.variableFormats?.[e.name] === `json` ? `bg-blue-400 right-[1px]` : `bg-gray-400 left-[1px]`}`} />
                                    </Component1265>
                                    <Component1266 className={`${d.variableFormats?.[e.name] === `json` ? `text-blue-400 font-bold` : `text-gray-500`}`}>{`JSON`}</Component1266>
                                  </Component1267>}
                            </Component1268>
                            {e.options ? <Component1270 className={`w-full bg-[#0d0c0c] border border-[#333] rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500`} value={s[e.name] || e.options[0]} onChange={t => {
                      return c(n => {
                        return {
                          ...n,
                          [e.name]: t.target.value
                        };
                      });
                    }}>
                                {e.options.map(e => {
                        return <Component1269 value={e} key={e}>
                                      {e}
                                    </Component1269>;
                      })}
                              </Component1270> : e.name.startsWith(`image`) || e.name.startsWith(`audio`) || e.name.startsWith(`video`) || e.name.startsWith(`file`) ? <Component1279 className={`flex items-center gap-2`}>
                                {s[e.name] ? <Component1276 className={`relative w-full h-12 rounded overflow-hidden border border-[#444] flex items-center justify-center bg-[#0d0c0c]`}>
                                    {e.name.startsWith(`image`) && <Component1271 src={s[e.name]} loading={`lazy`} decoding={`async`} className={`w-full h-full object-cover`} />}
                                    {e.name.startsWith(`audio`) && <Component1272 src={s[e.name]} controls={true} className={`w-full h-full`} />}
                                    {e.name.startsWith(`video`) && <Component1273 src={s[e.name]} preload={`metadata`} className={`w-full h-full object-cover`} />}
                                    {e.name.startsWith(`file`) && <Component1274 className={`text-xs text-gray-400 break-all p-1 text-center line-clamp-2`}>{`文件已上传`}</Component1274>}
                                    <Component1275 onClick={() => {
                          return c(t => {
                            let n = {
                              ...t
                            };
                            delete n[e.name];
                            return n;
                          });
                        }} className={`absolute top-0 right-0 bg-red-500/80 text-white p-0.5 rounded-bl z-10`}>
                                      <T size={8} fill={`currentColor`} />
                                    </Component1275>
                                  </Component1276> : <Component1278 className={`flex-1 border border-dashed border-[#444] hover:border-blue-500 rounded p-2 flex items-center justify-center cursor-pointer text-gray-500 hover:text-blue-400 transition-colors text-xs`}>
                                    <_Component8 size={12} className={`mr-1`} />
                                    {e.name.startsWith(`image`) ? `上传图片` : e.name.startsWith(`audio`) ? `上传音频` : e.name.startsWith(`video`) ? `上传视频` : `上传文件`}
                                    <Component1277 type={`file`} accept={e.name.startsWith(`image`) ? `image/*` : e.name.startsWith(`audio`) ? `audio/*` : e.name.startsWith(`video`) ? `video/*` : `*/*`} className={`hidden`} onChange={t => {
                          if (t.target.files?.[0]) {
                            D(e.name, t.target.files[0]);
                          }
                        }} />
                                  </Component1278>}
                              </Component1279> : <Component1280 className={`w-full bg-[#0d0c0c] border border-[#333] rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500 custom-scrollbar resize-y nodrag min-h-[30px]`} placeholder={`输入 ${e.name}...`} value={s[e.name] || ``} onChange={t => {
                      return c(n => {
                        return {
                          ...n,
                          [e.name]: t.target.value
                        };
                      });
                    }} onWheel={e => {
                      return e.stopPropagation();
                    }} />}
                          </Component1281>;
                })}
                    </Q.Fragment> : <Component1283 className={`text-gray-500 text-xs text-center py-4 border border-dashed border-[#444] rounded`}>
                      {`当前配置未提取到变量。`}
                      <Component1282 />
                      {`在编辑模式下使用 `}
                      {`{{变量名}}`}
                      {` 添加变量。`}
                    </Component1283>}
                </Component1284>
                <Component1286 className={`mt-auto pt-2`}>
                  <Component1285 onClick={e => {
                e.stopPropagation();
                E(e);
              }} disabled={i.loading} className={`w-full py-2 bg-white hover:bg-gray-100 text-black rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 font-medium text-sm`}>
                    {i.loading ? <_Component22 size={14} className={`animate-spin`} /> : <_Component42 size={14} fill={`currentColor`} />}
                    {i.loading ? `处理中...` : `开始处理`}
                  </Component1285>
                </Component1286>
              </Component1287>
            </Component1288>}
        </Component1289>
        <_cmp__Component10 type={`source`} position={X.Right} variant={`small`} />
      </Component1290>
    </Component1291>;
});
export default ac;