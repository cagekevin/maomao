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

import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { Position, useReactFlow, useHandleConnections } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import {
  Settings,
  Loader2,
  AlertCircle,
  Play,
  Upload,
  Save,
  X,
  Sparkles,
  Check,
  ChevronDown,
  Minus,
  Plus,
} from 'lucide-react';
import NodeTitle from './NodeTitle';
import CustomHandle from './CustomHandle';

// ====== External dependency stubs ======
// TODO: implement ii - urlifyAsset function
const ii = async (file: File, options: any): Promise<{ url: string }> => {
  console.warn('[CustomNode] ii (urlifyAsset) not implemented', file, options);
  return { url: URL.createObjectURL(file) };
};

interface CustomNodeData {
  configMode?: boolean;
  config?: {
    apiUrl?: string;
    method?: string;
    headers?: string;
    body?: string;
    outputType?: string;
    executionMode?: string;
    resultPath?: string;
    taskIdPath?: string;
    pollingUrl?: string;
    pollingMethod?: string;
    pollingHeaders?: string;
    pollingBody?: string;
    pollingResultPath?: string;
    pollingCompletedValue?: string;
    pollingFailedValue?: string;
    pollingErrorPath?: string;
    pollingProgressPath?: string;
    pollingResultDataPath?: string;
    rawTextOutput?: boolean;
    variables?: Record<string, any>;
    variableFormats?: Record<string, string>;
  };
  loading?: boolean;
  progress?: number;
  errorMessage?: string;
  resultData?: any;
  label?: string;
  onAIAssist?: (prompt: string, config: any) => Promise<string>;
  onShowToast?: (msg: string) => void;
  onSaveTemplate?: (name: string, config: any) => void;
  onGenerateCustom?: (nodeId: string) => void;
  onStop?: (nodeId: string) => void;
  [key: string]: unknown;
}

interface VariableInfo {
  name: string;
  options?: string[];
}

function CustomNode({ id, data, selected }: NodeProps<CustomNodeData>) {
  const { updateNodeData } = useReactFlow();
  const nodeData = data;

  const [configMode, setConfigMode] = useState(nodeData.configMode === undefined ? true : nodeData.configMode);
  const [variables, setVariables] = useState(nodeData.config?.variables || {});
  const [extractedVars, setExtractedVars] = useState<VariableInfo[]>([]);
  const [config, setConfig] = useState(nodeData.config || {
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
  const [aiPrompt, setAiPrompt] = useState(``);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const text = (config.body || ``) + ` ` + (config.apiUrl || ``) + ` ` + (config.headers || ``);
    const regex = /\{\{([^}]+)\}\}/g;
    let match: RegExpExecArray | null;
    const vars: VariableInfo[] = [];
    const seen = new Set<string>();

    while ((match = regex.exec(text)) !== null) {
      const varName = match[1].trim();
      if (!seen.has(varName)) {
        seen.add(varName);
        if (varName.includes(`|`)) {
          const [name, optionsStr] = varName.split(`|`);
          vars.push({
            name: name.trim(),
            options: optionsStr.split(`,`).map((o: string) => o.trim())
          });
        } else {
          vars.push({
            name: varName
          });
        }
      }
    }
    setExtractedVars(vars);
  }, [config.body, config.apiUrl, config.headers]);

  const handleAIAssist = useCallback(async () => {
    if (!aiPrompt.trim()) return;

    if (!nodeData.onAIAssist) {
      nodeData.onShowToast?.(`AI辅助不可用，请检查API配置`);
      return;
    }

    setAiLoading(true);
    try {
      const result = await nodeData.onAIAssist(aiPrompt, config);
      try {
        const parsed = JSON.parse(result);
        setConfig((prev: any) => ({
          ...prev,
          apiUrl: parsed.apiUrl || prev.apiUrl,
          method: parsed.method || prev.method,
          headers: parsed.headers || prev.headers,
          body: parsed.body || prev.body,
          outputType: parsed.outputType || prev.outputType,
          executionMode: parsed.executionMode || prev.executionMode,
          resultPath: parsed.resultPath || prev.resultPath,
          taskIdPath: parsed.taskIdPath || prev.taskIdPath,
          pollingUrl: parsed.pollingUrl || prev.pollingUrl,
          pollingMethod: parsed.pollingMethod || prev.pollingMethod,
          pollingHeaders: parsed.pollingHeaders || prev.pollingHeaders,
          pollingBody: parsed.pollingBody || prev.pollingBody,
          pollingResultPath: parsed.pollingResultPath || prev.pollingResultPath,
          pollingCompletedValue: parsed.pollingCompletedValue || prev.pollingCompletedValue,
          pollingFailedValue: parsed.pollingFailedValue || prev.pollingFailedValue,
          pollingErrorPath: parsed.pollingErrorPath || prev.pollingErrorPath,
          pollingProgressPath: parsed.pollingProgressPath === undefined ? prev.pollingProgressPath : parsed.pollingProgressPath,
          pollingResultDataPath: parsed.pollingResultDataPath === undefined ? prev.pollingResultDataPath : parsed.pollingResultDataPath,
          rawTextOutput: parsed.rawTextOutput === undefined ? prev.rawTextOutput : parsed.rawTextOutput
        }));
        nodeData.onShowToast?.(`AI 生成配置成功`);
      } catch (e) {
        console.error(`AI 返回的 JSON 解析失败`, e, result);
        nodeData.onShowToast?.(`AI 生成格式错误，请重试`);
      }
    } catch (e: any) {
      nodeData.onShowToast?.(e.message || `AI 生成失败`);
    } finally {
      setAiLoading(false);
    }
  }, [aiPrompt, config, nodeData]);

  const handleSaveConfig = useCallback(() => {
    updateNodeData(id, {
      config: {
        ...config,
        variables: variables
      },
      configMode: false
    });
    setConfigMode(false);
  }, [id, config, variables, updateNodeData]);

  const handleSaveTemplate = useCallback(() => {
    if (!config.apiUrl) {
      nodeData.onShowToast?.(`请至少填写 API URL`);
      return;
    }
    const name = window.prompt(`请输入自定义节点名称:`, nodeData.label || `万能节点`);
    if (name && nodeData.onSaveTemplate) {
      nodeData.onSaveTemplate(name, {
        ...config,
        variables: variables
      });
    }
  }, [config, variables, nodeData]);

  const handleRun = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (configMode) {
      nodeData.onShowToast?.(`请先完成配置`);
      return;
    }
    const fullConfig = {
      ...config,
      variables: variables
    };
    setConfig(fullConfig);
    updateNodeData(id, {
      config: fullConfig
    });
    setTimeout(() => {
      console.log(`CustomNode handleRun triggered, calling onGenerateCustom`, nodeData.onGenerateCustom);
      if (nodeData.onGenerateCustom) {
        nodeData.onGenerateCustom(id);
      } else {
        nodeData.onShowToast?.(`未找到执行方法，请刷新页面重试`);
      }
    }, 50);
  }, [configMode, config, variables, id, updateNodeData, nodeData]);

  const handleFileUpload = useCallback(async (varName: string, file: File) => {
    try {
      const result = await ii(file, {
        subfolder: `canvas/upload`,
        preferThumbnail: file.type.startsWith(`image/`),
        thumbMaxDim: 480,
        thumbQuality: 75
      });
      if (result.url && /^https?:\/\//i.test(result.url)) {
        setVariables((prev: any) => ({
          ...prev,
          [varName]: result.url
        }));
        return;
      }
    } catch (e) {
      console.warn(`[CustomNode] urlifyAsset failed, fallback to base64:`, e);
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setVariables((prev: any) => ({
          ...prev,
          [varName]: e.target.result
        }));
      }
    };
    reader.readAsDataURL(file);
  }, []);

  return (
    <div className={`flex flex-col items-center group/node transition-all ${selected ? `z-50` : `z-10`}`}>
      <NodeTitle
        id={id}
        data={nodeData}
        defaultTitle={`万能节点`}
        icon={<Settings size={11} className={`text-gray-500`} />}
      />
      <div
        className={`relative bg-[#1c1c1c] rounded-xl overflow-visible border shadow-xl transition-all duration-300 flex flex-col
                ${selected ? `border-[#555]` : `border-[#333] hover:border-[#444]`}
                `}
        style={{
          width: `400px`,
          minHeight: configMode ? `450px` : `250px`
        }}
      >
        <div className={`absolute top-2 right-2 z-20 flex items-center gap-2 nodrag`}>
          {nodeData.loading && (
            <Loader2
              size={12}
              className={`animate-spin flex-shrink-0`}
              style={{
                color: `rgb(210,2,7)`
              }}
            />
          )}
          <div className={`flex bg-[#0d0c0c]/90 rounded p-0.5 border border-[#333]`}>
            <button
              className={`px-2 py-1 text-[10px] rounded transition-colors ${configMode ? `bg-[#333] text-white` : `text-gray-400 hover:text-gray-200`}`}
              onClick={() => {
                setConfigMode(true);
                updateNodeData(id, {
                  configMode: true
                });
              }}
            >
              编辑模式
            </button>
            <button
              className={`px-2 py-1 text-[10px] rounded transition-colors ${configMode ? `text-gray-400 hover:text-gray-200` : `bg-[#333] text-white`}`}
              onClick={() => {
                setConfigMode(false);
                updateNodeData(id, {
                  configMode: false
                });
              }}
            >
              工作模式
            </button>
          </div>
        </div>
        <div className={`flex-1 flex flex-col p-3 bg-[#1a1a1a] relative drag-handle rounded-xl`}>
          {nodeData.loading && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500 bg-[#1a1a1a]/80 backdrop-blur-sm z-10`}>
              <Loader2 size={24} />
              <span className={`text-xs`}>
                {config.executionMode === `async` ? `请求中... ${nodeData.progress || 0}%` : `请求中...`}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (nodeData.onStop) {
                    nodeData.onStop(id);
                  }
                }}
                className={`mt-2 bg-[#222]/80 hover:bg-[#333] border border-[#444] text-gray-400 hover:text-gray-200 px-3 py-1 rounded-full text-[10px] flex items-center gap-1.5 transition-colors backdrop-blur-sm nodrag`}
              >
                <X size={10} fill={`currentColor`} />
                停止
              </button>
            </div>
          )}
          {nodeData.errorMessage && (
            <div className={`text-red-400 text-[10px] p-2 mb-2 border border-red-500/30 rounded bg-red-500/10 flex items-start gap-1.5`}>
              <AlertCircle size={12} className={`mt-0.5 flex-shrink-0`} />
              <span className={`break-all`}>{nodeData.errorMessage}</span>
            </div>
          )}
          {configMode ? (
            <div className={`flex flex-col gap-3 nodrag text-xs`}>
              <div className={`flex flex-col gap-1`}>
                <label className={`text-gray-500 flex items-center gap-1`}>
                  <Sparkles size={12} className={`text-yellow-500`} />
                  AI 辅助配置
                </label>
                <div className={`flex flex-col gap-2`}>
                  <textarea
                    className={`flex-1 bg-[#0d0c0c] border border-[#333] rounded p-2 text-gray-200 focus:border-blue-500 outline-none custom-scrollbar text-[10px] resize-y nodrag nowheel nopan`}
                    placeholder={`描述你想调用的API... (如：调用百度翻译)`}
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === `Enter` && (e.ctrlKey || e.metaKey)) {
                        handleAIAssist();
                      }
                    }}
                    onWheel={(e) => e.stopPropagation()}
                    rows={3}
                  />
                  <button
                    onClick={handleAIAssist}
                    disabled={aiLoading}
                    className={`py-1.5 w-full bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 rounded transition-colors flex items-center justify-center gap-1`}
                  >
                    {aiLoading ? <Loader2 size={12} className={`animate-spin`} /> : `生成`}
                    {!aiLoading && <span className={`text-[10px] text-blue-400/70`}>(Ctrl+Enter)</span>}
                  </button>
                </div>
              </div>
              <div className={`flex gap-2`}>
                <div className={`flex flex-col gap-1 w-20`}>
                  <label className={`text-gray-500`}>Method</label>
                  <select
                    className={`bg-[#0d0c0c] border border-[#333] rounded px-1 py-1 text-gray-200 outline-none`}
                    value={config.method}
                    onChange={(e) => setConfig({
                      ...config,
                      method: e.target.value
                    })}
                  >
                    <option>GET</option>
                    <option>POST</option>
                    <option>PUT</option>
                  </select>
                </div>
                <div className={`flex flex-col gap-1 flex-1`}>
                  <label className={`text-gray-500`}>API URL</label>
                  <input
                    className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 focus:border-blue-500 outline-none`}
                    value={config.apiUrl}
                    onChange={(e) => setConfig({
                      ...config,
                      apiUrl: e.target.value
                    })}
                  />
                </div>
              </div>
              <div className={`flex flex-col gap-1`}>
                <div className={`flex justify-between items-center`}>
                  <label className={`text-gray-500`}>Headers (JSON格式)</label>
                  <div className={`flex gap-1`}>
                    <button
                      onClick={() => setConfig({
                        ...config,
                        headers: `{
  "Content-Type": "application/json"
}`
                      })}
                      className={`text-[9px] bg-[#333] hover:bg-[#444] px-1.5 py-0.5 rounded text-gray-300 transition-colors`}
                    >
                      JSON
                    </button>
                    <button
                      onClick={() => setConfig({
                        ...config,
                        headers: `{
  "Content-Type": "multipart/form-data"
}`
                      })}
                      className={`text-[9px] bg-[#333] hover:bg-[#444] px-1.5 py-0.5 rounded text-gray-300 transition-colors`}
                    >
                      FormData
                    </button>
                  </div>
                </div>
                <textarea
                  className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 font-mono text-[10px] h-16 resize-y focus:border-blue-500 outline-none custom-scrollbar nodrag nowheel nopan`}
                  value={config.headers}
                  onChange={(e) => setConfig({
                    ...config,
                    headers: e.target.value
                  })}
                  onWheel={(e) => e.stopPropagation()}
                />
              </div>
              <div className={`flex flex-col gap-1`}>
                <label className={`text-gray-500 flex justify-between`}>
                  <span>Body (支持变量: {{prompt}}, {{image_1}})</span>
                </label>
                <textarea
                  className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 font-mono text-[10px] h-24 resize-y focus:border-blue-500 outline-none custom-scrollbar nodrag nowheel nopan`}
                  value={config.body}
                  onChange={(e) => setConfig({
                    ...config,
                    body: e.target.value
                  })}
                  onWheel={(e) => e.stopPropagation()}
                />
              </div>
              <div className={`flex gap-2`}>
                <div className={`flex flex-col gap-1 flex-1`}>
                  <label className={`text-gray-500`}>输出类型</label>
                  <select
                    className={`bg-[#0d0c0c] border border-[#333] rounded px-1 py-1 text-gray-200 outline-none`}
                    value={config.outputType}
                    onChange={(e) => setConfig({
                      ...config,
                      outputType: e.target.value
                    })}
                  >
                    <option value={`text`}>文本 (Text)</option>
                    <option value={`image`}>图片 (Image URL)</option>
                    <option value={`video`}>视频 (Video URL)</option>
                    <option value={`audio`}>音频 (Audio URL)</option>
                  </select>
                </div>
                <div className={`flex flex-col gap-1 flex-1`}>
                  <label className={`text-gray-500`}>执行模式</label>
                  <select
                    className={`bg-[#0d0c0c] border border-[#333] rounded px-1 py-1 text-gray-200 outline-none`}
                    value={config.executionMode}
                    onChange={(e) => setConfig({
                      ...config,
                      executionMode: e.target.value
                    })}
                  >
                    <option value={`sync`}>同步 (立即返回)</option>
                    <option value={`async`}>异步 (需轮询)</option>
                  </select>
                </div>
              </div>
              <div className={`flex gap-2`}>
                <div className={`flex flex-col gap-1 flex-1`}>
                  <label className={`text-gray-500`}>提取结果字段 (JSON Path, 如 data.url)</label>
                  <input
                    className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 focus:border-blue-500 outline-none`}
                    value={config.resultPath}
                    onChange={(e) => setConfig({
                      ...config,
                      resultPath: e.target.value
                    })}
                    placeholder={`如 choices[0].message.content`}
                  />
                </div>
                {config.outputType === `text` && (
                  <div className={`flex flex-col gap-1 w-24`}>
                    <label className={`text-gray-500 text-center`}>纯文本输出</label>
                    <div className={`flex items-center justify-center h-full`}>
                      <input
                        type={`checkbox`}
                        checked={config.rawTextOutput || false}
                        onChange={(e) => setConfig({
                          ...config,
                          rawTextOutput: e.target.checked
                        })}
                        className={`w-4 h-4 accent-blue-500 cursor-pointer`}
                      />
                    </div>
                  </div>
                )}
              </div>
              {config.executionMode === `async` && (
                <div className={`flex flex-col gap-2 p-2 bg-[#222] border border-[#333] rounded mt-1`}>
                  <div className={`flex flex-col gap-1`}>
                    <label className={`text-gray-500`}>提取 Task ID 字段</label>
                    <input
                      className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`}
                      value={config.taskIdPath || ``}
                      onChange={(e) => setConfig({
                        ...config,
                        taskIdPath: e.target.value
                      })}
                      placeholder={`如 data.task_id`}
                    />
                  </div>
                  <div className={`flex gap-2`}>
                    <div className={`flex flex-col gap-1 w-24`}>
                      <label className={`text-gray-500`}>轮询 Method</label>
                      <select
                        className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none h-[30px]`}
                        value={config.pollingMethod || `GET`}
                        onChange={(e) => setConfig({
                          ...config,
                          pollingMethod: e.target.value
                        })}
                      >
                        <option value={`GET`}>GET</option>
                        <option value={`POST`}>POST</option>
                      </select>
                    </div>
                    <div className={`flex flex-col gap-1 flex-1`}>
                      <label className={`text-gray-500`}>
                        轮询 API URL (支持 {{task_id}})
                      </label>
                      <input
                        className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none h-[30px]`}
                        value={config.pollingUrl || ``}
                        onChange={(e) => setConfig({
                          ...config,
                          pollingUrl: e.target.value
                        })}
                        placeholder={`如果与上方一致可留空`}
                      />
                    </div>
                  </div>
                  <div className={`flex flex-col gap-1`}>
                    <label className={`text-gray-500`}>轮询 Headers (JSON格式, 留空同上)</label>
                    <textarea
                      className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 font-mono text-[10px] h-20 resize-y focus:border-blue-500 outline-none custom-scrollbar nodrag nowheel nopan`}
                      value={config.pollingHeaders || ``}
                      onChange={(e) => setConfig({
                        ...config,
                        pollingHeaders: e.target.value
                      })}
                      placeholder={`例如: {"Authorization": "Bearer xxx"}`}
                      onWheel={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className={`flex flex-col gap-1 ${config.pollingMethod === `GET` || !config.pollingMethod ? `hidden` : ``}`}>
                    <label className={`text-gray-500`}>
                      轮询 Body (JSON格式, 支持 {{task_id}})
                    </label>
                    <textarea
                      className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 font-mono text-[10px] h-12 resize-y focus:border-blue-500 outline-none custom-scrollbar nodrag`}
                      value={config.pollingBody || ``}
                      onChange={(e) => setConfig({
                        ...config,
                        pollingBody: e.target.value
                      })}
                      placeholder={`例如: {"taskId": "{{task_id}}"}`}
                      onWheel={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className={`flex gap-2`}>
                    <div className={`flex flex-col gap-1 flex-1`}>
                      <label className={`text-gray-500`}>状态判断字段</label>
                      <input
                        className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`}
                        value={config.pollingResultPath || ``}
                        onChange={(e) => setConfig({
                          ...config,
                          pollingResultPath: e.target.value
                        })}
                        placeholder={`如 data.status`}
                      />
                    </div>
                    <div className={`flex flex-col gap-1 flex-1`}>
                      <label className={`text-gray-500`}>完成状态值</label>
                      <input
                        className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`}
                        value={config.pollingCompletedValue || ``}
                        onChange={(e) => setConfig({
                          ...config,
                          pollingCompletedValue: e.target.value
                        })}
                        placeholder={`如 completed`}
                      />
                    </div>
                  </div>
                  <div className={`flex gap-2`}>
                    <div className={`flex flex-col gap-1 flex-1`}>
                      <label className={`text-gray-500`}>失败状态值</label>
                      <input
                        className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`}
                        value={config.pollingFailedValue || ``}
                        onChange={(e) => setConfig({
                          ...config,
                          pollingFailedValue: e.target.value
                        })}
                        placeholder={`如 failed`}
                      />
                    </div>
                    <div className={`flex flex-col gap-1 flex-1`}>
                      <label className={`text-gray-500`}>失败信息字段</label>
                      <input
                        className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`}
                        value={config.pollingErrorPath || ``}
                        onChange={(e) => setConfig({
                          ...config,
                          pollingErrorPath: e.target.value
                        })}
                        placeholder={`如 data.error`}
                      />
                    </div>
                  </div>
                  <div className={`flex flex-col gap-1`}>
                    <label className={`text-gray-500`}>进度判断字段</label>
                    <input
                      className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`}
                      value={config.pollingProgressPath || ``}
                      onChange={(e) => setConfig({
                        ...config,
                        pollingProgressPath: e.target.value
                      })}
                      placeholder={`如 data.progress (选填)`}
                    />
                  </div>
                  <div className={`flex gap-2`}>
                    <div className={`flex flex-col gap-1 flex-1`}>
                      <label className={`text-gray-500`}>异步结果提取字段 (如轮询返回的 data.url)</label>
                      <input
                        className={`bg-[#0d0c0c] border border-[#333] rounded px-2 py-1 text-gray-200 outline-none`}
                        value={config.pollingResultDataPath || ``}
                        onChange={(e) => setConfig({
                          ...config,
                          pollingResultDataPath: e.target.value
                        })}
                        placeholder={`留空则使用上方主请求提取字段`}
                      />
                    </div>
                    {config.outputType === `text` && (
                      <div className={`flex flex-col gap-1 w-24`}>
                        <label className={`text-gray-500 text-center`}>纯文本输出</label>
                        <div className={`flex items-center justify-center h-full`}>
                          <input
                            type={`checkbox`}
                            checked={config.rawTextOutput || false}
                            onChange={(e) => setConfig({
                              ...config,
                              rawTextOutput: e.target.checked
                            })}
                            className={`w-4 h-4 accent-blue-500 cursor-pointer`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className={`flex gap-2 mt-2`}>
                <button
                  onClick={handleSaveConfig}
                  className={`flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors text-xs`}
                >
                  完成配置
                </button>
                <button
                  onClick={handleSaveTemplate}
                  className={`py-1.5 px-3 bg-[#333] hover:bg-[#444] text-white rounded transition-colors flex items-center justify-center gap-1 text-xs`}
                  title={`保存为自定义节点供下次使用`}
                >
                  <Save size={12} />
                  保存模板
                </button>
              </div>
            </div>
          ) : (
            <div className={`flex flex-col h-full nodrag`}>
              <div className={`flex-1 flex flex-col min-h-[100px] pr-1`}>
                {nodeData.resultData && (
                  <div className={`flex-1 bg-[#0d0c0c] border border-[#333] rounded p-2 mb-2 overflow-auto custom-scrollbar flex min-h-[60px] max-h-[250px] ${config.outputType === `text` ? `items-start justify-start` : `items-center justify-center`}`}>
                    {config.outputType === `text` && (
                      <div className={`text-gray-300 text-xs whitespace-pre-wrap w-full align-top break-all`}>
                        {nodeData.resultData}
                      </div>
                    )}
                    {config.outputType === `image` && (
                      <img
                        src={nodeData.resultData}
                        loading={`lazy`}
                        decoding={`async`}
                        className={`max-w-full max-h-full object-contain`}
                      />
                    )}
                    {config.outputType === `video` && (
                      <video
                        src={nodeData.resultData}
                        controls={true}
                        preload={`metadata`}
                        className={`max-w-full max-h-full`}
                      />
                    )}
                    {config.outputType === `audio` && (
                      <audio
                        src={nodeData.resultData}
                        controls={true}
                        className={`w-full`}
                      />
                    )}
                  </div>
                )}
                <div className={`flex flex-col gap-3 mt-auto pt-2 pb-2`}>
                  {extractedVars.length > 0 ? (
                    extractedVars.map((variable) => (
                      <div key={variable.name} className={`flex flex-col gap-1 relative nodrag`}>
                        <div
                          className={`absolute top-1/2 -translate-y-1/2`}
                          style={{
                            left: `-12px`
                          }}
                        >
                          <CustomHandle
                            type={`target`}
                            id={`var-${variable.name}`}
                            position={Position.Left}
                            variant={`small`}
                            title={`连接到变量: ${variable.name}`}
                          />
                        </div>
                        <div className={`flex justify-between items-center mb-1`}>
                          <label className={`text-gray-400 text-[10px] ml-1`}>{variable.name}</label>
                          {!variable.options && !variable.name.startsWith(`image`) && !variable.name.startsWith(`audio`) && !variable.name.startsWith(`video`) && !variable.name.startsWith(`file`) && (
                            <div className={`flex items-center gap-1 text-[9px]`}>
                              <span className={`${config.variableFormats?.[variable.name] === `json` ? `text-gray-500` : `text-blue-400 font-bold`}`}>
                                Text
                              </span>
                              <div
                                className={`w-5 h-2.5 bg-[#333] rounded-full relative cursor-pointer`}
                                onClick={() => {
                                  const newFormat = (config.variableFormats?.[variable.name] || `text`) === `text` ? `json` : `text`;
                                  setConfig((prev: any) => ({
                                    ...prev,
                                    variableFormats: {
                                      ...prev.variableFormats,
                                      [variable.name]: newFormat
                                    }
                                  }));
                                }}
                              >
                                <div className={`absolute top-[1px] w-2 h-2 rounded-full transition-all ${config.variableFormats?.[variable.name] === `json` ? `bg-blue-400 right-[1px]` : `bg-gray-400 left-[1px]`}`} />
                              </div>
                              <span className={`${config.variableFormats?.[variable.name] === `json` ? `text-blue-400 font-bold` : `text-gray-500`}`}>
                                JSON
                              </span>
                            </div>
                          )}
                        </div>
                        {variable.options ? (
                          <select
                            className={`w-full bg-[#0d0c0c] border border-[#333] rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500`}
                            value={variables[variable.name] || variable.options[0]}
                            onChange={(e) => setVariables((prev: any) => ({
                              ...prev,
                              [variable.name]: e.target.value
                            }))}
                          >
                            {variable.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : variable.name.startsWith(`image`) || variable.name.startsWith(`audio`) || variable.name.startsWith(`video`) || variable.name.startsWith(`file`) ? (
                          <div className={`flex items-center gap-2`}>
                            {variables[variable.name] ? (
                              <div className={`relative w-full h-12 rounded overflow-hidden border border-[#444] flex items-center justify-center bg-[#0d0c0c]`}>
                                {variable.name.startsWith(`image`) && (
                                  <img
                                    src={variables[variable.name]}
                                    loading={`lazy`}
                                    decoding={`async`}
                                    className={`w-full h-full object-cover`}
                                  />
                                )}
                                {variable.name.startsWith(`audio`) && (
                                  <audio
                                    src={variables[variable.name]}
                                    controls={true}
                                    className={`w-full h-full`}
                                  />
                                )}
                                {variable.name.startsWith(`video`) && (
                                  <video
                                    src={variables[variable.name]}
                                    preload={`metadata`}
                                    className={`w-full h-full object-cover`}
                                  />
                                )}
                                {variable.name.startsWith(`file`) && (
                                  <div className={`text-xs text-gray-400 break-all p-1 text-center line-clamp-2`}>
                                    文件已上传
                                  </div>
                                )}
                                <button
                                  onClick={() => setVariables((prev: any) => {
                                    const newVars = { ...prev };
                                    delete newVars[variable.name];
                                    return newVars;
                                  })}
                                  className={`absolute top-0 right-0 bg-red-500/80 text-white p-0.5 rounded-bl z-10`}
                                >
                                  <X size={8} fill={`currentColor`} />
                                </button>
                              </div>
                            ) : (
                              <label className={`flex-1 border border-dashed border-[#444] hover:border-blue-500 rounded p-2 flex items-center justify-center cursor-pointer text-gray-500 hover:text-blue-400 transition-colors text-xs`}>
                                <Upload size={12} className={`mr-1`} />
                                {variable.name.startsWith(`image`) ? `上传图片` : variable.name.startsWith(`audio`) ? `上传音频` : variable.name.startsWith(`video`) ? `上传视频` : `上传文件`}
                                <input
                                  type={`file`}
                                  accept={variable.name.startsWith(`image`) ? `image/*` : variable.name.startsWith(`audio`) ? `audio/*` : variable.name.startsWith(`video`) ? `video/*` : `*/*`}
                                  className={`hidden`}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleFileUpload(variable.name, file);
                                    }
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        ) : (
                          <textarea
                            className={`w-full bg-[#0d0c0c] border border-[#333] rounded px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-blue-500 custom-scrollbar resize-y nodrag min-h-[30px]`}
                            placeholder={`输入 ${variable.name}...`}
                            value={variables[variable.name] || ``}
                            onChange={(e) => setVariables((prev: any) => ({
                              ...prev,
                              [variable.name]: e.target.value
                            }))}
                            onWheel={(e) => e.stopPropagation()}
                          />
                        )}
                      </div>
                    ))
                  ) : (
                    <div className={`text-gray-500 text-xs text-center py-4 border border-dashed border-[#444] rounded`}>
                      当前配置未提取到变量。<br />
                      在编辑模式下使用 {{变量名}} 添加变量。
                    </div>
                  )}
                </div>
              </div>
              <div className={`mt-auto pt-2`}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRun(e);
                  }}
                  disabled={nodeData.loading}
                  className={`w-full py-2 bg-white hover:bg-gray-100 text-black rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 font-medium text-sm`}
                >
                  {nodeData.loading ? <Loader2 size={14} className={`animate-spin`} /> : <Play size={14} fill={`currentColor`} />}
                  {nodeData.loading ? `处理中...` : `开始处理`}
                </button>
              </div>
            </div>
          )}
        </div>
        <CustomHandle
          type={`source`}
          position={Position.Right}
          variant={`small`}
        />
      </div>
    </div>
  );
}

export default memo(CustomNode);