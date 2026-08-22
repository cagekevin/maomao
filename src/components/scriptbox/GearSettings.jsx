import React, { useState, useEffect } from 'react'
import {
  ASSET_TEMPLATES, SCRIPT_WRITER_SYSTEM, SHOT_DIRECTOR_SYSTEM, SHOT_AUDIT_SYSTEM,
  IMAGE_GEN_TYPES, defaultImageGenTemplates
} from '../base/scriptBoxPrompts.js'
import { SCRIPT_BOX_WORKFLOWS, DEFAULT_WORKFLOW } from './scriptBoxWorkflows.js'
import { useProviders, load as loadProviders } from '../base/settings/providerStore.js'
import { logger } from '../base/logger.js'
import { buildAllModels } from '../base/providerModels.js'
import ModelSelect from '../base/ModelSelect.jsx'
import Select from '../base/Select.jsx'
import ScriptBoxModal from './ScriptBoxModal.jsx'

/**
 * 剧本盒子 齿轮设置弹窗（复刻原型 .gearModal）。
 * 每个配置一块 Tab（含各提示词），平铺展示，不折叠、不遮挡、方便阅读：
 *  基础 / 剧本 / 分镜 / 生图类型 / 资产
 */
// 生图类型模板可能来自工作流（嵌套 {key:{label,sys}}）或历史自定义（扁平 {key:sys字符串}），
// 统一收口为扁平 sys 字符串映射，供生图类型 Tab 的 textarea 直接编辑/显示。
function flattenImageGenTable(obj) {
  return Object.fromEntries(
    Object.entries(obj || {}).map(([k, t]) => [
      k,
      t && typeof t === 'object' && 'sys' in t ? String(t.sys) : typeof t === 'string' ? t : ''
    ])
  )
}

export default function GearSettings({ data, updateData, onClose }) {
  const d = data || {}
  const ratios = ['16:9', '9:16', '1:1', '3:4', '4:3', '21:9']

  const TABS = [
    ['basic', '基础'],
    ['script', '剧本'],
    ['shot', '分镜'],
    ['image', '生图类型'],
    ['asset', '资产']
  ]
  const [tab, setTab] = useState('basic')

  // 供应商（多 provider，接真系统）：模型下拉聚合所有 provider 的 chat/image 模型，
  // 值用 `providerId::modelId`，保存后引擎经 resolveProviderModel 解析回 provider + modelId。
  const { providers } = useProviders()
  useEffect(() => {
    if (!providers || providers.length === 0) loadProviders().catch((e) => logger.warn('provider', 'load-fail', { error: e?.message }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const chatModels = buildAllModels(providers, 'chat')
  const imageModels = buildAllModels(providers, 'image')

  // 本地编辑态（保存时一次性写回，避免每次输入都触发全节点更新）
  const [aspectRatio, setAspectRatio] = useState(d.aspectRatio || '16:9')
  const [customAspectRatio, setCustomAspectRatio] = useState(d.customAspectRatio || '')
  const [imageConstraint, setImageConstraint] = useState(d.imageGlobalConstraint || '')
  const [videoConstraint, setVideoConstraint] = useState(d.videoGlobalConstraint || '')
  const [customGlobalConstraint, setCustomGlobalConstraint] = useState(d.customGlobalConstraint || '')
  // P0-1 分通道 negative：仅作用于生图 prompt / 生视频 videoPrompt（高优先级）
  const [imageNegative, setImageNegative] = useState(d.imageNegative || '')
  const [videoNegative, setVideoNegative] = useState(d.videoNegative || '')
  const [scriptPrompt, setScriptPrompt] = useState(d.customScriptPrompt ?? SCRIPT_WRITER_SYSTEM)
  const [shotPrompt, setShotPrompt] = useState(d.customShotPrompt ?? SHOT_DIRECTOR_SYSTEM)
  const [tpl, setTpl] = useState(d.customAssetTemplates || { ...ASSET_TEMPLATES })
  // 生图类型模板（关键帧/四宫格/九宫格/俯视调度图），默认用内置，可覆盖
  const [genTpl, setGenTpl] = useState(() => (d.customImageGenTemplates ? flattenImageGenTable(d.customImageGenTemplates) : defaultImageGenTemplates()))
  // 工作流：当前选用的工作流 id + 审计改写提示词（默认来自工作流，可单字段覆盖）
  const [workflowId, setWorkflowId] = useState(d.workflowId || DEFAULT_WORKFLOW)
  const [auditPrompt, setAuditPrompt] = useState(d.customAuditPrompt ?? SHOT_AUDIT_SYSTEM)
  // 应用某工作流：把该套整套提示词填入本地编辑态（各工作流彼此完全独立、互不残留），保存即整套切换。
  const applyWorkflow = (id) => {
    const w = SCRIPT_BOX_WORKFLOWS[id] || SCRIPT_BOX_WORKFLOWS[DEFAULT_WORKFLOW]
    setWorkflowId(id)
    if (w.script !== undefined) setScriptPrompt(w.script)
    if (w.shot !== undefined) setShotPrompt(w.shot)
    if (w.audit !== undefined) setAuditPrompt(w.audit)
    // 解耦：资产/生图模板直接用「所选工作流自身」的定义，不再 merge 默认，避免残留上一套。
    if (w.assetTemplates) setTpl({ ...w.assetTemplates })
    if (w.imageGenTemplates) setGenTpl(flattenImageGenTable(w.imageGenTemplates))
    if (w.constraints) {
      if (w.constraints.image !== undefined) setImageConstraint(w.constraints.image)
      if (w.constraints.video !== undefined) setVideoConstraint(w.constraints.video)
      if (w.constraints.custom !== undefined) setCustomGlobalConstraint(w.constraints.custom)
    }
    if (w.negative) {
      if (w.negative.image !== undefined) setImageNegative(w.negative.image)
      if (w.negative.video !== undefined) setVideoNegative(w.negative.video)
    }
  }
  // 模型（文本模型 = 生成分镜/提示词；资产生图模型 = 步骤2批量生图）
  // 默认值：节点已存（textModel/selectedModel 或 assetModelSettings.globalModel）优先；
  // 否则取第一个 chat/image 模型；若已在 store 里则取该值，无则回退节点值/空。
  const pickDefault = (stored, models) => {
    if (stored) {
      // 兼容旧裸模型名：若 store 里找不到该裸名，仍保留（引擎会回退主供应商）
      return stored
    }
    return models[0]?.id || ''
  }
  const [textModel, setTextModel] = useState(() => pickDefault(d.textModel || d.selectedModel, chatModels))
  const [assetModel, setAssetModel] = useState(() => pickDefault(d.assetModelSettings && d.assetModelSettings.globalModel, imageModels))

  const save = () => {
    updateData({
      aspectRatio,
      customAspectRatio,
      imageGlobalConstraint: imageConstraint,
      videoGlobalConstraint: videoConstraint,
      customGlobalConstraint,
      imageNegative,
      videoNegative,
      customScriptPrompt: scriptPrompt,
      customShotPrompt: shotPrompt,
      customAuditPrompt: auditPrompt,
      customAssetTemplates: tpl,
      customImageGenTemplates: genTpl,
      workflowId,
      textModel,
      selectedModel: textModel,
      assetModelSettings: { ...(d.assetModelSettings || {}), globalModel: assetModel }
    })
    onClose()
  }

  return (
    // 弹窗用 absolute inset-0 相对剧本盒子主容器定位（节点内面板）。
    // 注意：不要 createPortal 到 body + fixed inset-0——那会让弹窗脱离节点变成全屏遮罩，
    // 用户明确要求这些弹窗是「剧本盒子的一部分」，显示在节点内部。
    <ScriptBoxModal
      title="总体设置"
      onClose={onClose}
      width={760}
      height={600}
      bodyClass="p-0 flex flex-col min-h-0 flex-1"
      footer={
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-white/[0.06] shrink-0">
          <button className="px-4 py-1.5 text-body-xs text-gray-400 hover:text-white" onClick={onClose}>取消</button>
          <button className="px-4 py-1.5 text-body-xs bg-white/10 hover:bg-white/15 text-gray-100 rounded-lg transition-colors" onClick={save}>保存</button>
        </div>
      }
    >
        {/* 工作流一键切换：整套提示词预设的顶部总入口（下拉选择即填入各 Tab，保存生效） */}
        <div className="flex items-center gap-2 px-5 py-2.5 shrink-0 border-b border-white/[0.06]">
          <span className="text-body-xs text-gray-400 shrink-0">工作流</span>
          <Select
            value={workflowId}
            onChange={(id) => applyWorkflow(id)}
            options={Object.values(SCRIPT_BOX_WORKFLOWS).map((w) => ({ value: w.id, label: w.label }))}
            placeholder="选择工作流"
          />
          <span className="text-2xs text-gray-600 shrink-0">选择整套提示词，各 Tab 可再单条微调</span>
        </div>
        {/* 标签页 */}
        <div className="flex gap-1 px-5 pt-3 pb-2 shrink-0 overflow-x-auto custom-scrollbar">
          {TABS.map(([k, n]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`shrink-0 px-3.5 py-1.5 text-body-xs rounded-lg transition-colors ${tab === k ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
            >{n}</button>
          ))}
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar px-5 py-4">
          {tab === 'basic' && (
            <div className="flex flex-col gap-5">
              <Section title="画面比例">
                <div className="flex gap-1.5 flex-wrap">
                  {ratios.map((r) => (
                    <button key={r} onClick={() => setAspectRatio(r)} className={`px-2.5 py-1 text-caption-sm rounded-lg border transition-colors ${aspectRatio === r ? 'border-white/50 text-white bg-white/10' : 'border-white/[0.06] text-gray-400 hover:border-white/20 hover:text-gray-200'}`}>{r}</button>
                  ))}
                  <button onClick={() => setAspectRatio('custom')} className={`px-2.5 py-1 text-caption-sm rounded-lg border transition-colors ${aspectRatio === 'custom' ? 'border-white/50 text-white bg-white/10' : 'border-white/[0.06] text-gray-400 hover:border-white/20'}`}>自定义</button>
                </div>
                {aspectRatio === 'custom' && <input value={customAspectRatio} onChange={(e) => setCustomAspectRatio(e.target.value)} placeholder="如 2:1" className="mt-2 w-28 bg-surface-strong border border-white/[0.06] rounded-md px-2 py-1 text-caption-sm text-gray-200 outline-none focus:border-white/20 nodrag" />}
              </Section>

              <Section title="模型">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="文本模型（生成分镜/提示词）">
                    <div className="flex items-center">
                      <ModelSelect value={textModel} onChange={setTextModel} models={chatModels} placeholder="选择文本模型" popupTo="down" showDivider={false} />
                    </div>
                  </Field>
                  <Field label="资产生图模型">
                    <div className="flex items-center">
                      <ModelSelect value={assetModel} onChange={setAssetModel} models={imageModels} placeholder="选择生图模型" popupTo="down" showDivider={false} />
                    </div>
                  </Field>
                </div>
              </Section>

              <Section title="全局约束">
                <div className="grid grid-cols-3 gap-3">
                  <Field label="图片"><textarea value={imageConstraint} onChange={(e) => setImageConstraint(e.target.value)} className="w-full bg-surface-strong border border-white/[0.06] rounded-md p-2 text-gray-200 text-caption-sm outline-none h-16 focus:border-white/20 custom-scrollbar nodrag nowheel" /></Field>
                  <Field label="视频"><textarea value={videoConstraint} onChange={(e) => setVideoConstraint(e.target.value)} className="w-full bg-surface-strong border border-white/[0.06] rounded-md p-2 text-gray-200 text-caption-sm outline-none h-16 focus:border-white/20 custom-scrollbar nodrag nowheel" /></Field>
                  <Field label="自定义"><textarea value={customGlobalConstraint} onChange={(e) => setCustomGlobalConstraint(e.target.value)} className="w-full bg-surface-strong border border-white/[0.06] rounded-md p-2 text-gray-200 text-caption-sm outline-none h-16 focus:border-white/20 custom-scrollbar nodrag nowheel" /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="图片负面词（仅生图 prompt）"><textarea value={imageNegative} onChange={(e) => setImageNegative(e.target.value)} className="w-full bg-surface-strong border border-white/[0.06] rounded-md p-2 text-gray-200 text-caption-sm outline-none h-16 focus:border-white/20 custom-scrollbar nodrag nowheel" /></Field>
                  <Field label="视频负面词（仅生视频 videoPrompt）"><textarea value={videoNegative} onChange={(e) => setVideoNegative(e.target.value)} className="w-full bg-surface-strong border border-white/[0.06] rounded-md p-2 text-gray-200 text-caption-sm outline-none h-16 focus:border-white/20 custom-scrollbar nodrag nowheel" /></Field>
                </div>
              </Section>
            </div>
          )}

          {tab === 'script' && (
            <Section title="剧本生成提示词（剧情 → 分镜）">
              <textarea value={scriptPrompt} onChange={(e) => setScriptPrompt(e.target.value)} className="w-full bg-surface-strong border border-white/[0.06] rounded-md p-2 text-gray-200 text-caption-sm outline-none h-64 focus:border-white/20 custom-scrollbar nodrag nowheel" />
            </Section>
          )}

          {tab === 'shot' && (
            <div className="flex flex-col gap-4">
              <Section title="分镜生成提示词（分镜 → 生图/生视频）">
                <textarea value={shotPrompt} onChange={(e) => setShotPrompt(e.target.value)} className="w-full bg-surface-strong border border-white/[0.06] rounded-md p-2 text-gray-200 text-caption-sm outline-none h-64 focus:border-white/20 custom-scrollbar nodrag nowheel" />
              </Section>
              <Section title="提示词审计改写提示词（按意见精修，随工作流切换）">
                <textarea value={auditPrompt} onChange={(e) => setAuditPrompt(e.target.value)} className="w-full bg-surface-strong border border-white/[0.06] rounded-md p-2 text-gray-200 text-caption-sm outline-none h-40 focus:border-white/20 custom-scrollbar nodrag nowheel" />
              </Section>
            </div>
          )}

          {tab === 'image' && (
            <div className="flex flex-col gap-4">
              <div className="text-caption-sm text-gray-500">生图类型模板（AI 生图：关键帧 / 四宫格 / 九宫格 / 俯视调度图）</div>
              {Object.entries(IMAGE_GEN_TYPES).map(([k, t]) => (
                <Field key={k} label={t.label}>
                  <textarea value={genTpl[k] || ''} onChange={(e) => setGenTpl({ ...genTpl, [k]: e.target.value })} className="w-full bg-surface-strong border border-white/[0.06] rounded-md p-2 text-gray-200 text-caption-sm outline-none h-36 focus:border-white/20 custom-scrollbar nodrag nowheel" />
                </Field>
              ))}
            </div>
          )}

          {tab === 'asset' && (
            <div className="flex flex-col gap-4">
              <div className="text-caption-sm text-gray-500">资产参考图模板（角色 / 场景 / 道具）</div>
              {[['character', '角色'], ['scene', '场景'], ['prop', '道具']].map(([k, n]) => (
                <Field key={k} label={n}>
                  <textarea value={tpl[k] || ''} onChange={(e) => setTpl({ ...tpl, [k]: e.target.value })} className="w-full bg-surface-strong border border-white/[0.06] rounded-md p-2 text-gray-200 text-caption-sm outline-none h-28 focus:border-white/20 custom-scrollbar nodrag nowheel" />
                </Field>
              ))}
            </div>
          )}
        </div>
    </ScriptBoxModal>
  )
}

function Field({ label, children }) {
  return <label className="block text-caption-sm text-gray-500">{label}<div className="mt-1.5">{children}</div></label>
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-caption-sm text-gray-500 mb-2">{title}</div>
      {children}
    </div>
  )
}
