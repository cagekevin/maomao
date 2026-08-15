// TODO(全局, 无需 import): data, selected, updateNodeData, i, apiUrl, method, headers, body, outputType, executionMode, resultPath, x, b, v, r, selectedModel, n, name, options, u, p, g, f, taskIdPath, pollingUrl, pollingMethod, pollingHeaders, pollingBody, pollingResultPath, pollingCompletedValue, pollingFailedValue, pollingErrorPath, pollingProgressPath, pollingResultDataPath, rawTextOutput, config, variables, s, configMode, o, subfolder, preferThumbnail, thumbMaxDim, thumbQuality, width, minHeight, color, m, l, left, variableFormats
import _cmp__Component8 from './_Component8.jsx';
import _cmp_Si from './Si.jsx';
import _cmp__Component12 from './_Component12.jsx';
import { id, We, t, e, y, _, d, a, hi, c, ca, ta, na, fa, la, S, h, C, w, X, D, E, _Component45, _Component25, T, _Component17, B, _Component36, _Component20, Jt, _Component0, _Component43 } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
var Rs = Z.memo(({
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
      let n = await hi(t, {
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
  const Component1129 = `button`;
  const Component1130 = `button`;
  const Component1131 = `div`;
  const Component1132 = `div`;
  const Component1133 = `span`;
  const Component1134 = `button`;
  const Component1135 = `div`;
  const Component1136 = `span`;
  const Component1137 = `div`;
  const Component1138 = `label`;
  const Component1139 = `span`;
  const Component1140 = `span`;
  const Component1141 = `button`;
  const Component1149 = `div`;
  const Component1150 = `div`;
  const Component1151 = `textarea`;
  const Component1152 = `span`;
  const Component1153 = `button`;
  const Component1154 = `div`;
  const Component1155 = `div`;
  const Component1156 = `label`;
  const Component1157 = `option`;
  const Component1158 = `option`;
  const Component1159 = `option`;
  const Component1160 = `select`;
  const Component1161 = `div`;
  const Component1162 = `label`;
  const Component1163 = `input`;
  const Component1164 = `div`;
  const Component1165 = `div`;
  const Component1166 = `label`;
  const Component1167 = `button`;
  const Component1168 = `button`;
  const Component1169 = `div`;
  const Component1170 = `div`;
  const Component1171 = `textarea`;
  const Component1172 = `div`;
  const Component1173 = `span`;
  const Component1174 = `label`;
  const Component1175 = `textarea`;
  const Component1176 = `div`;
  const Component1177 = `label`;
  const Component1178 = `option`;
  const Component1179 = `option`;
  const Component1180 = `option`;
  const Component1181 = `option`;
  const Component1182 = `select`;
  const Component1183 = `div`;
  const Component1184 = `label`;
  const Component1185 = `option`;
  const Component1186 = `option`;
  const Component1187 = `select`;
  const Component1188 = `div`;
  const Component1189 = `div`;
  const Component1190 = `label`;
  const Component1191 = `input`;
  const Component1192 = `div`;
  const Component1193 = `label`;
  const Component1194 = `input`;
  const Component1195 = `div`;
  const Component1196 = `div`;
  const Component1197 = `div`;
  const Component1198 = `label`;
  const Component1199 = `input`;
  const Component1200 = `div`;
  const Component1201 = `label`;
  const Component1202 = `option`;
  const Component1203 = `option`;
  const Component1204 = `select`;
  const Component1205 = `div`;
  const Component1206 = `label`;
  const Component1207 = `input`;
  const Component1208 = `div`;
  const Component1209 = `div`;
  const Component1210 = `label`;
  const Component1211 = `textarea`;
  const Component1212 = `div`;
  const Component1213 = `label`;
  const Component1214 = `textarea`;
  const Component1215 = `div`;
  const Component1216 = `label`;
  const Component1217 = `input`;
  const Component1218 = `div`;
  const Component1219 = `label`;
  const Component1220 = `input`;
  const Component1221 = `div`;
  const Component1222 = `div`;
  const Component1223 = `label`;
  const Component1224 = `input`;
  const Component1225 = `div`;
  const Component1226 = `label`;
  const Component1227 = `input`;
  const Component1228 = `div`;
  const Component1229 = `div`;
  const Component1230 = `label`;
  const Component1231 = `input`;
  const Component1232 = `div`;
  const Component1233 = `label`;
  const Component1234 = `input`;
  const Component1235 = `div`;
  const Component1236 = `label`;
  const Component1237 = `input`;
  const Component1238 = `div`;
  const Component1239 = `div`;
  const Component1240 = `div`;
  const Component1241 = `div`;
  const Component1242 = `button`;
  const Component1243 = `button`;
  const Component1244 = `div`;
  const Component1245 = `div`;
  const Component1246 = `div`;
  const Component1247 = `img`;
  const Component1248 = `video`;
  const Component1249 = `audio`;
  const Component1250 = `div`;
  const Component1251 = `div`;
  const Component1252 = `label`;
  const Component1253 = `span`;
  const Component1254 = `div`;
  const Component1255 = `div`;
  const Component1256 = `span`;
  const Component1257 = `div`;
  const Component1258 = `div`;
  const Component1259 = `option`;
  const Component1260 = `select`;
  const Component1261 = `img`;
  const Component1262 = `audio`;
  const Component1263 = `video`;
  const Component1264 = `div`;
  const Component1265 = `button`;
  const Component1266 = `div`;
  const Component1267 = `input`;
  const Component1268 = `label`;
  const Component1269 = `div`;
  const Component1270 = `textarea`;
  const Component1271 = `div`;
  const Component1272 = `br`;
  const Component1273 = `div`;
  const Component1274 = `div`;
  const Component1275 = `button`;
  const Component1276 = `div`;
  const Component1277 = `div`;
  const Component1278 = `div`;
  const Component1279 = `div`;
  const Component1280 = `div`;
  const Component1281 = `div`;
  return <Component1281 className={`flex flex-col items-center group/node transition-all ${n ? `z-50` : `z-10`}`}>
      <_cmp__Component8 id={e} data={t} defaultTitle={`万能节点`} icon={<_Component45 size={11} className={`text-gray-500`} />} />
      <Component1280 className={`relative bg-[#1c1c1c] rounded-xl overflow-visible border shadow-xl transition-all duration-300 flex flex-col
                ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}
                `} style={{
      width: `400px`,
      minHeight: a ? `450px` : `250px`
    }}>
        <Component1132 className={`absolute top-2 right-2 z-20 flex items-center gap-2 nodrag`}>
          {i.loading && <_Component25 size={12} className={`animate-spin flex-shrink-0`} style={{
          color: `rgb(210,2,7)`
        }} />}
          <Component1131 className={`flex bg-[#0d0c0c]/90 rounded p-0.5 border border-[#333]`}>
            <Component1129 className={`px-2 py-1 text-[10px] rounded transition-colors ${a ? `bg-[#333] text-white` : `text-gray-400 hover:text-gray-200`}`} onClick={() => {
            o(true);
            r(e, {
              configMode: true
            });
          }}>{`编辑模式`}</Component1129>
            <Component1130 className={`px-2 py-1 text-[10px] rounded transition-colors ${a ? `text-gray-400 hover:text-gray-200` : `bg-[#333] text-white`}`} onClick={() => {
            o(false);
            r(e, {
              configMode: false
            });
          }}>{`工作模式`}</Component1130>
          </Component1131>
        </Component1132>
        <Component1279 className={`flex-1 flex flex-col p-3 bg-[#1a1a1a] relative drag-handle rounded-xl`}>
          {i.loading && <Component1135 className={`absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500 bg-[#1a1a1a]/80 backdrop-blur-sm z-10`}>
              <_cmp_Si size={24} />
              <Component1133 className={`text-xs`}>
                {d.executionMode === `async` ? `请求中... ${i.progress || 0}%` : `请求中...`}
              </Component1133>
              <Component1134 onClick={t => {
            t.stopPropagation();
            if (i.onStop) {
              i.onStop(e);
            }
          }} className={`mt-2 bg-[#222]/80 hover:bg-[#333] border border-[#444] text-gray-400 hover:text-gray-200 px-3 py-1 rounded-full text-[10px] flex items-center gap-1.5 transition-colors backdrop-blur-sm nodrag`}>
                <T size={10} fill={`currentColor`} />
                {`停止`}
              </Component1134>
            </Component1135>}
          {i.errorMessage && <Component1137 className={`text-red-400 text-[10px] p-2 mb-2 border border-red-500/30 rounded bg-red-500/10 flex items-start gap-1.5`}>
              <_Component17 size={12} className={`mt-0.5 flex-shrink-0`} />
              <Component1136 className={`break-all`}>{i.errorMessage}</Component1136>
            </Component1137>}
          {a ? <Component1245 className={`flex flex-col gap-3 nodrag text-xs`}>
              <Component1155 className={`flex flex-col gap-1`}>
                <Component1138 className={`text-gray-500 flex items-center gap-1`}>
                  <B size={12} className={`text-yellow-500`} />
                  {`AI 辅助配置`}
                </Component1138>
                <Component1154 className={`flex flex-col gap-2`}>
                  {i.textModel && <Component1150 className={`relative`} ref={x}>
                      <Component1141 type={`button`} onClick={e => {
                  e.stopPropagation();
                  b(e => {
                    return !e;
                  });
                }} className={`w-full h-8 px-2 bg-[#0d0c0c] border border-[#333] hover:border-[#444] rounded flex items-center gap-1.5 text-[10px] text-gray-300`} title={_ || `选择文本模型`}>
                        {_ && <Component1139 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${ca(_) ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                            {ca(_) ? `内置` : `三方`}
                          </Component1139>}
                        <Component1140 className={`flex-1 truncate text-left`}>
                          {_ || `选择文本模型`}
                        </Component1140>
                        <_Component36 size={12} className={`shrink-0 text-gray-500`} />
                      </Component1141>
                      {y && <Component1149 className={`absolute left-0 top-full mt-1 w-full min-w-[17rem] max-h-56 overflow-y-auto custom-scrollbar bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 nowheel nopan nodrag`} onClick={e => {
                  return e.stopPropagation();
                }} onWheel={e => {
                  return e.stopPropagation();
                }}>
                          {(() => {
                    let t = i.textModel.split(`
`).map(e => {
                      return e.trim();
                    }).filter(Boolean);
                    let n = t.filter(ca).sort((e, t) => {
                      return e.localeCompare(t);
                    });
                    let a = t.filter(e => {
                      return !ca(e);
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
                      let t = ca(e);
                      let n = t ? ta(e) : null;
                      let r = t ? na(e) : null;
                      let i = fa(e, _ === e);
                      const Component1142 = `span`;
                      const Component1143 = `span`;
                      const Component1144 = `span`;
                      const Component1145 = `div`;
                      return <Component1145 role={`button`} className={i.className} title={i.title} onClick={() => {
                        if (!i.disabled) {
                          o(e);
                        }
                      }} key={e}>
                                  <Component1142 className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${t ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                                    {t ? `内置` : `三方`}
                                  </Component1142>
                                  <Component1143 className={`flex-1 truncate`}>{e}</Component1143>
                                  {n !== null && <Component1144 className={`shrink-0 inline-flex items-center gap-0.5 text-[10px] text-orange-400 tabular-nums`}>
                                      <_Component20 size={10} />
                                      {la(n)}
                                      {r ? `/${r}` : ``}
                                    </Component1144>}
                                </Component1145>;
                    };
                    const Component1146 = `div`;
                    const Component1147 = `div`;
                    const Component1148 = `div`;
                    return <Q.Fragment>
                                {n.length > 0 && <Q.Fragment>
                                    <Component1146 className={`text-[10px] text-blue-300 mb-1 px-1`}>{`内置模型`}</Component1146>
                                    {n.map(s)}
                                  </Q.Fragment>}
                                {a.length > 0 && <Q.Fragment>
                                    {n.length > 0 && <Component1147 className={`h-px bg-[#333] my-1.5`} />}
                                    <Component1148 className={`text-[10px] text-gray-500 mb-1 px-1`}>{`第三方 API`}</Component1148>
                                    {a.map(s)}
                                  </Q.Fragment>}
                              </Q.Fragment>;
                  })()}
                        </Component1149>}
                    </Component1150>}
                  <Component1151 className={`flex-1 bg-[#0d0c0c] border border-[#333] rounded p-2 text-gray-200 focus:border-blue-500 outline-none custom-scrollbar text-[10px] resize-y nodrag nowheel nopan`} placeholder={`描述你想调用的API... (如：调用百度翻译)`} value={p} onChange={e => {
                return m(e.target.value);
              }} onKeyDown={e => {
                if (e.key === `Enter` && (e.ctrlKey || e.metaKey)) {
                  S();
                }
              }} onWheel={e => {
                return e.stopPropagation();
              }} rows={3} />
                  <Component1153 onClick={S} disabled={h} className={`py-1.5 w-full bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 rounded transition-colors flex items-center justify-center gap-1`}>
                    {h ? <_Component25 size={12} className={`animate-spin`} /> : `生成`}
                    {!h && <Component1152 className={`text-[10px] text-blue-400/70`}>{`(Ctrl+Enter)`}</Component1152>}
                  </Component1153>
                </Component1154>
              </Component1155>
              <Component1165 className={`flex gap-2`}>
                <Component1161 className={`flex flex-col gap-1 w-20`}>
                  <Component1156 className={`text-gray-500`}>{`Method`}</Component1156>
                  <Component1160 className={`bg-[#0d0c0c] border border-[#333] rounded px-1 py-1 text-gray-200 outline-none`} value={d.method} onChange={e => {
                return f({
                  ...d,
                  method: e.target.value
                });
              }}>
                    <Component1157>{`GET`}</Component1157>
                    <Component1158>{`POST`}</Component1158>
                    <Component1159>{`PUT`}</Component1159>
                  </Component1160>
                </Component1161>
                <Component1164 className={`flex flex-col gap-1 flex-1`}>
                  <Component1162 className={`text-gray-500`}>{`API URL`}</Component1162>
                  <Component1163 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 focus:border-blue-500 outline-none`} value={d.apiUrl} onChange={e => {
                return f({
                  ...d,
                  apiUrl: e.target.value
                });
              }} />
                </Component1164>
              </Component1165>
              <Component1172 className={`flex flex-col gap-1`}>
                <Component1170 className={`flex justify-between items-center`}>
                  <Component1166 className={`text-gray-500`}>{`Headers (JSON格式)`}</Component1166>
                  <Component1169 className={`flex gap-1`}>
                    <Component1167 onClick={() => {
                  return f({
                    ...d,
                    headers: `{
  "Content-Type": "application/json"
}`
                  });
                }} className={`text-[9px] bg-[#333] hover:bg-[#444] px-1.5 py-0.5 rounded text-gray-300 transition-colors`}>{`JSON`}</Component1167>
                    <Component1168 onClick={() => {
                  return f({
                    ...d,
                    headers: `{
  "Content-Type": "multipart/form-data"
}`
                  });
                }} className={`text-[9px] bg-[#333] hover:bg-[#444] px-1.5 py-0.5 rounded text-gray-300 transition-colors`}>{`FormData`}</Component1168>
                  </Component1169>
                </Component1170>
                <Component1171 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 font-mono text-[10px] h-16 resize-y focus:border-blue-500 outline-none custom-scrollbar nodrag nowheel nopan`} value={d.headers} onChange={e => {
              return f({
                ...d,
                headers: e.target.value
              });
            }} onWheel={e => {
              return e.stopPropagation();
            }} />
              </Component1172>
              <Component1176 className={`flex flex-col gap-1`}>
                <Component1174 className={`text-gray-500 flex justify-between`}>
                  <Component1173>
                    {`Body (支持变量: `}
                    {`{{prompt}}`}
                    {`, `}
                    {`{{image_1}}`}
                    {`)`}
                  </Component1173>
                </Component1174>
                <Component1175 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 font-mono text-[10px] h-24 resize-y focus:border-blue-500 outline-none custom-scrollbar nodrag nowheel nopan`} value={d.body} onChange={e => {
              return f({
                ...d,
                body: e.target.value
              });
            }} onWheel={e => {
              return e.stopPropagation();
            }} />
              </Component1176>
              <Component1189 className={`flex gap-2`}>
                <Component1183 className={`flex flex-col gap-1 flex-1`}>
                  <Component1177 className={`text-gray-500`}>{`输出类型`}</Component1177>
                  <Component1182 className={`bg-[#0d0c0c] border border-[#333] rounded px-1 py-1 text-gray-200 outline-none`} value={d.outputType} onChange={e => {
                return f({
                  ...d,
                  outputType: e.target.value
                });
              }}>
                    <Component1178 value={`text`}>{`文本 (Text)`}</Component1178>
                    <Component1179 value={`image`}>{`图片 (Image URL)`}</Component1179>
                    <Component1180 value={`video`}>{`视频 (Video URL)`}</Component1180>
                    <Component1181 value={`audio`}>{`音频 (Audio URL)`}</Component1181>
                  </Component1182>
                </Component1183>
                <Component1188 className={`flex flex-col gap-1 flex-1`}>
                  <Component1184 className={`text-gray-500`}>{`执行模式`}</Component1184>
                  <Component1187 className={`bg-[#0d0c0c] border border-[#333] rounded px-1 py-1 text-gray-200 outline-none`} value={d.executionMode} onChange={e => {
                return f({
                  ...d,
                  executionMode: e.target.value
                });
              }}>
                    <Component1185 value={`sync`}>{`同步 (立即返回)`}</Component1185>
                    <Component1186 value={`async`}>{`异步 (需轮询)`}</Component1186>
                  </Component1187>
                </Component1188>
              </Component1189>
              <Component1197 className={`flex gap-2`}>
                <Component1192 className={`flex flex-col gap-1 flex-1`}>
                  <Component1190 className={`text-gray-500`}>{`提取结果字段 (JSON Path, 如 data.url)`}</Component1190>
                  <Component1191 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 focus:border-blue-500 outline-none`} value={d.resultPath} onChange={e => {
                return f({
                  ...d,
                  resultPath: e.target.value
                });
              }} placeholder={`如 choices[0].message.content`} />
                </Component1192>
                {d.outputType === `text` && <Component1196 className={`flex flex-col gap-1 w-24`}>
                    <Component1193 className={`text-gray-500 text-center`}>{`纯文本输出`}</Component1193>
                    <Component1195 className={`flex items-center justify-center h-full`}>
                      <Component1194 type={`checkbox`} checked={d.rawTextOutput || false} onChange={e => {
                  return f({
                    ...d,
                    rawTextOutput: e.target.checked
                  });
                }} className={`w-4 h-4 accent-blue-500 cursor-pointer`} />
                    </Component1195>
                  </Component1196>}
              </Component1197>
              {d.executionMode === `async` && <Component1241 className={`flex flex-col gap-2 p-2 bg-[#222] border border-[#333] rounded mt-1`}>
                  <Component1200 className={`flex flex-col gap-1`}>
                    <Component1198 className={`text-gray-500`}>{`提取 Task ID 字段`}</Component1198>
                    <Component1199 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`} value={d.taskIdPath || ``} onChange={e => {
                return f({
                  ...d,
                  taskIdPath: e.target.value
                });
              }} placeholder={`如 data.task_id`} />
                  </Component1200>
                  <Component1209 className={`flex gap-2`}>
                    <Component1205 className={`flex flex-col gap-1 w-24`}>
                      <Component1201 className={`text-gray-500`}>{`轮询 Method`}</Component1201>
                      <Component1204 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none h-[30px]`} value={d.pollingMethod || `GET`} onChange={e => {
                  return f({
                    ...d,
                    pollingMethod: e.target.value
                  });
                }}>
                        <Component1202 value={`GET`}>{`GET`}</Component1202>
                        <Component1203 value={`POST`}>{`POST`}</Component1203>
                      </Component1204>
                    </Component1205>
                    <Component1208 className={`flex flex-col gap-1 flex-1`}>
                      <Component1206 className={`text-gray-500`}>
                        {`轮询 API URL (支持 `}
                        {`{{task_id}}`}
                        {`)`}
                      </Component1206>
                      <Component1207 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none h-[30px]`} value={d.pollingUrl || ``} onChange={e => {
                  return f({
                    ...d,
                    pollingUrl: e.target.value
                  });
                }} placeholder={`如果与上方一致可留空`} />
                    </Component1208>
                  </Component1209>
                  <Component1212 className={`flex flex-col gap-1`}>
                    <Component1210 className={`text-gray-500`}>{`轮询 Headers (JSON格式, 留空同上)`}</Component1210>
                    <Component1211 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 font-mono text-[10px] h-20 resize-y focus:border-blue-500 outline-none custom-scrollbar nodrag nowheel nopan`} value={d.pollingHeaders || ``} onChange={e => {
                return f({
                  ...d,
                  pollingHeaders: e.target.value
                });
              }} placeholder={`例如: {"Authorization": "Bearer xxx"}`} onWheel={e => {
                return e.stopPropagation();
              }} />
                  </Component1212>
                  <Component1215 className={`flex flex-col gap-1 ${d.pollingMethod === `GET` || !d.pollingMethod ? `hidden` : ``}`}>
                    <Component1213 className={`text-gray-500`}>
                      {`轮询 Body (JSON格式, 支持 `}
                      {`{{task_id}}`}
                      {`)`}
                    </Component1213>
                    <Component1214 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 font-mono text-[10px] h-12 resize-y focus:border-blue-500 outline-none custom-scrollbar nodrag`} value={d.pollingBody || ``} onChange={e => {
                return f({
                  ...d,
                  pollingBody: e.target.value
                });
              }} placeholder={`例如: {"taskId": "{{task_id}}"}`} onWheel={e => {
                return e.stopPropagation();
              }} />
                  </Component1215>
                  <Component1222 className={`flex gap-2`}>
                    <Component1218 className={`flex flex-col gap-1 flex-1`}>
                      <Component1216 className={`text-gray-500`}>{`状态判断字段`}</Component1216>
                      <Component1217 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`} value={d.pollingResultPath || ``} onChange={e => {
                  return f({
                    ...d,
                    pollingResultPath: e.target.value
                  });
                }} placeholder={`如 data.status`} />
                    </Component1218>
                    <Component1221 className={`flex flex-col gap-1 flex-1`}>
                      <Component1219 className={`text-gray-500`}>{`完成状态值`}</Component1219>
                      <Component1220 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`} value={d.pollingCompletedValue || ``} onChange={e => {
                  return f({
                    ...d,
                    pollingCompletedValue: e.target.value
                  });
                }} placeholder={`如 completed`} />
                    </Component1221>
                  </Component1222>
                  <Component1229 className={`flex gap-2`}>
                    <Component1225 className={`flex flex-col gap-1 flex-1`}>
                      <Component1223 className={`text-gray-500`}>{`失败状态值`}</Component1223>
                      <Component1224 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`} value={d.pollingFailedValue || ``} onChange={e => {
                  return f({
                    ...d,
                    pollingFailedValue: e.target.value
                  });
                }} placeholder={`如 failed`} />
                    </Component1225>
                    <Component1228 className={`flex flex-col gap-1 flex-1`}>
                      <Component1226 className={`text-gray-500`}>{`失败信息字段`}</Component1226>
                      <Component1227 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`} value={d.pollingErrorPath || ``} onChange={e => {
                  return f({
                    ...d,
                    pollingErrorPath: e.target.value
                  });
                }} placeholder={`如 data.error`} />
                    </Component1228>
                  </Component1229>
                  <Component1232 className={`flex flex-col gap-1`}>
                    <Component1230 className={`text-gray-500`}>{`进度判断字段`}</Component1230>
                    <Component1231 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`} value={d.pollingProgressPath || ``} onChange={e => {
                return f({
                  ...d,
                  pollingProgressPath: e.target.value
                });
              }} placeholder={`如 data.progress (选填)`} />
                  </Component1232>
                  <Component1240 className={`flex gap-2`}>
                    <Component1235 className={`flex flex-col gap-1 flex-1`}>
                      <Component1233 className={`text-gray-500`}>{`异步结果提取字段 (如轮询返回的 data.url)`}</Component1233>
                      <Component1234 className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`} value={d.pollingResultDataPath || ``} onChange={e => {
                  return f({
                    ...d,
                    pollingResultDataPath: e.target.value
                  });
                }} placeholder={`留空则使用上方主请求提取字段`} />
                    </Component1235>
                    {d.outputType === `text` && <Component1239 className={`flex flex-col gap-1 w-24`}>
                        <Component1236 className={`text-gray-500 text-center`}>{`纯文本输出`}</Component1236>
                        <Component1238 className={`flex items-center justify-center h-full`}>
                          <Component1237 type={`checkbox`} checked={d.rawTextOutput || false} onChange={e => {
                    return f({
                      ...d,
                      rawTextOutput: e.target.checked
                    });
                  }} className={`w-4 h-4 accent-blue-500 cursor-pointer`} />
                        </Component1238>
                      </Component1239>}
                  </Component1240>
                </Component1241>}
              <Component1244 className={`flex gap-2 mt-2`}>
                <Component1242 onClick={C} className={`flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors text-xs`}>{`完成配置`}</Component1242>
                <Component1243 onClick={w} className={`py-1.5 px-3 bg-[#333] hover:bg-[#444] text-white rounded transition-colors flex items-center justify-center gap-1 text-xs`} title={`保存为自定义节点供下次使用`}>
                  <Jt size={12} />
                  {`保存模板`}
                </Component1243>
              </Component1244>
            </Component1245> : <Component1278 className={`flex flex-col h-full nodrag`}>
              <Component1277 className={`flex-1 flex flex-col min-h-[100px] pr-1`}>
                {i.resultData && <Component1250 className={`flex-1 bg-[#0d0c0c] border border-[#333] rounded p-2 mb-2 overflow-auto custom-scrollbar flex min-h-[60px] max-h-[250px] ${d.outputType === `text` ? `items-start justify-start` : `items-center justify-center`}`}>
                    {d.outputType === `text` && <Component1246 className={`text-gray-300 text-xs whitespace-pre-wrap w-full align-top break-all`}>
                        {i.resultData}
                      </Component1246>}
                    {d.outputType === `image` && <Component1247 src={i.resultData} loading={`lazy`} decoding={`async`} className={`max-w-full max-h-full object-contain`} />}
                    {d.outputType === `video` && <Component1248 src={i.resultData} controls={true} preload={`metadata`} className={`max-w-full max-h-full`} />}
                    {d.outputType === `audio` && <Component1249 src={i.resultData} controls={true} className={`w-full`} />}
                  </Component1250>}
                <Component1274 className={`flex flex-col gap-3 mt-auto pt-2 pb-2`}>
                  {l.length > 0 ? <Q.Fragment>
                      {l.map(e => {
                  return <Component1271 className={`flex flex-col gap-1 relative nodrag`} key={e.name}>
                            <Component1251 className={`absolute top-1/2 -translate-y-1/2`} style={{
                      left: `-12px`
                    }}>
                              <_cmp__Component12 type={`target`} id={`var-${e.name}`} position={X.Left} variant={`small`} title={`连接到变量: ${e.name}`} />
                            </Component1251>
                            <Component1258 className={`flex justify-between items-center mb-1`}>
                              <Component1252 className={`text-gray-400 text-[10px] ml-1`}>
                                {e.name}
                              </Component1252>
                              {!e.options && !e.name.startsWith(`image`) && !e.name.startsWith(`audio`) && !e.name.startsWith(`video`) && !e.name.startsWith(`file`) && <Component1257 className={`flex items-center gap-1 text-[9px]`}>
                                    <Component1253 className={`${d.variableFormats?.[e.name] === `json` ? `text-gray-500` : `text-blue-400 font-bold`}`}>{`Text`}</Component1253>
                                    <Component1255 className={`w-5 h-2.5 bg-[#333] rounded-full relative cursor-pointer`} onClick={() => {
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
                                      <Component1254 className={`absolute top-[1px] w-2 h-2 rounded-full transition-all ${d.variableFormats?.[e.name] === `json` ? `bg-blue-400 right-[1px]` : `bg-gray-400 left-[1px]`}`} />
                                    </Component1255>
                                    <Component1256 className={`${d.variableFormats?.[e.name] === `json` ? `text-blue-400 font-bold` : `text-gray-500`}`}>{`JSON`}</Component1256>
                                  </Component1257>}
                            </Component1258>
                            {e.options ? <Component1260 className={`w-full bg-[#0d0c0c] border border-[#333] rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500`} value={s[e.name] || e.options[0]} onChange={t => {
                      return c(n => {
                        return {
                          ...n,
                          [e.name]: t.target.value
                        };
                      });
                    }}>
                                {e.options.map(e => {
                        return <Component1259 value={e} key={e}>
                                      {e}
                                    </Component1259>;
                      })}
                              </Component1260> : e.name.startsWith(`image`) || e.name.startsWith(`audio`) || e.name.startsWith(`video`) || e.name.startsWith(`file`) ? <Component1269 className={`flex items-center gap-2`}>
                                {s[e.name] ? <Component1266 className={`relative w-full h-12 rounded overflow-hidden border border-[#444] flex items-center justify-center bg-[#0d0c0c]`}>
                                    {e.name.startsWith(`image`) && <Component1261 src={s[e.name]} loading={`lazy`} decoding={`async`} className={`w-full h-full object-cover`} />}
                                    {e.name.startsWith(`audio`) && <Component1262 src={s[e.name]} controls={true} className={`w-full h-full`} />}
                                    {e.name.startsWith(`video`) && <Component1263 src={s[e.name]} preload={`metadata`} className={`w-full h-full object-cover`} />}
                                    {e.name.startsWith(`file`) && <Component1264 className={`text-xs text-gray-400 break-all p-1 text-center line-clamp-2`}>{`文件已上传`}</Component1264>}
                                    <Component1265 onClick={() => {
                          return c(t => {
                            let n = {
                              ...t
                            };
                            delete n[e.name];
                            return n;
                          });
                        }} className={`absolute top-0 right-0 bg-red-500/80 text-white p-0.5 rounded-bl z-10`}>
                                      <T size={8} fill={`currentColor`} />
                                    </Component1265>
                                  </Component1266> : <Component1268 className={`flex-1 border border-dashed border-[#444] hover:border-blue-500 rounded p-2 flex items-center justify-center cursor-pointer text-gray-500 hover:text-blue-400 transition-colors text-xs`}>
                                    <_Component0 size={12} className={`mr-1`} />
                                    {e.name.startsWith(`image`) ? `上传图片` : e.name.startsWith(`audio`) ? `上传音频` : e.name.startsWith(`video`) ? `上传视频` : `上传文件`}
                                    <Component1267 type={`file`} accept={e.name.startsWith(`image`) ? `image/*` : e.name.startsWith(`audio`) ? `audio/*` : e.name.startsWith(`video`) ? `video/*` : `*/*`} className={`hidden`} onChange={t => {
                          if (t.target.files?.[0]) {
                            D(e.name, t.target.files[0]);
                          }
                        }} />
                                  </Component1268>}
                              </Component1269> : <Component1270 className={`w-full bg-[#0d0c0c] border border-[#333] rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500 custom-scrollbar resize-y nodrag min-h-[30px]`} placeholder={`输入 ${e.name}...`} value={s[e.name] || ``} onChange={t => {
                      return c(n => {
                        return {
                          ...n,
                          [e.name]: t.target.value
                        };
                      });
                    }} onWheel={e => {
                      return e.stopPropagation();
                    }} />}
                          </Component1271>;
                })}
                    </Q.Fragment> : <Component1273 className={`text-gray-500 text-xs text-center py-4 border border-dashed border-[#444] rounded`}>
                      {`当前配置未提取到变量。`}
                      <Component1272 />
                      {`在编辑模式下使用 `}
                      {`{{变量名}}`}
                      {` 添加变量。`}
                    </Component1273>}
                </Component1274>
                <Component1276 className={`mt-auto pt-2`}>
                  <Component1275 onClick={e => {
                e.stopPropagation();
                E(e);
              }} disabled={i.loading} className={`w-full py-2 bg-white hover:bg-gray-100 text-black rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 font-medium text-sm`}>
                    {i.loading ? <_Component25 size={14} className={`animate-spin`} /> : <_Component43 size={14} fill={`currentColor`} />}
                    {i.loading ? `处理中...` : `开始处理`}
                  </Component1275>
                </Component1276>
              </Component1277>
            </Component1278>}
        </Component1279>
        <_cmp__Component12 type={`source`} position={X.Right} variant={`small`} />
      </Component1280>
    </Component1281>;
});
export default Rs;