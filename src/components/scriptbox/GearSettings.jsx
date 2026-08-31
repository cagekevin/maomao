import React, { useState, useEffect } from 'react'
import { useProviders, load as loadProviders } from '../base/settings/providerStore.ts'
import { logger } from '../base/logger.ts'
import { buildAllModels } from '../base/providerModels.ts'
import ModelSelect from '../base/ModelSelect.tsx'
import Select from '../base/Select.tsx'
import ScriptBoxModal from './ScriptBoxModal.jsx'
import ScriptBoxPlaybookManager from './scriptBoxPlaybookManager.jsx'
import { getAllPlaybooks, getPlaybook, isBuiltin, saveCustomPlaybook } from './scriptBoxPlaybookStore.ts'
import { DEFAULT_WORKFLOW } from './scriptBoxWorkflows.ts'

/**
 * 剧本盒子 齿轮设置弹窗 —— Playbook 编辑器（收口后无覆盖层）。
 *
 * 【可写性铁律（§7.1）】提示词配置唯一真相源 = playbook（scriptBoxPlaybookStore）：
 *  - 内置 playbook：只读（disabled），想改请「另存为」（管理面板，后续阶段）。
 *  - 自定义 playbook：可编辑，点保存写回 store（scriptbox_playbooks，全局+云同步）。
 * node.data 只存 playbookId / playbookLabel + 本片参数（模型/画幅），不存任何提示词副本。
 *
 * 编辑态 = 当前 playbook 的复制；切 playbook 时经 useEffect 重置，所见即所得。
 */
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

  // 供应商（多 provider，接真系统）
  const { providers } = useProviders()
  useEffect(() => {
    if (!providers || providers.length === 0) loadProviders().catch((e) => logger.warn('provider', 'load-fail', { error: e?.message }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const chatModels = buildAllModels(providers, 'chat')
  const imageModels = buildAllModels(providers, 'image')

  // ── 选中 playbook（本片层）──
  const allPlaybooks = getAllPlaybooks()
  const [playbookId, setPlaybookId] = useState(d.playbookId || DEFAULT_WORKFLOW)
  const current = getPlaybook(playbookId)
  const builtin = isBuiltin(playbookId) || current.builtin

  /** 从 playbook 抽取可编辑提示词配置（保持统一结构）。 */
  const pickEditable = (pb) => ({
    script: pb.script || '',
    shot: pb.shot || '',
    audit: pb.audit || '',
    qg: pb.qg || '',
    assetTemplates: { ...pb.assetTemplates },
    imageGenTemplates: { ...pb.imageGenTemplates },
    constraints: { image: pb.constraints?.image || '', video: pb.constraints?.video || '' },
    negative: { common: pb.negative?.common || '', image: pb.negative?.image || '', video: pb.negative?.video || '' },
  })
  const [editing, setEditing] = useState(() => pickEditable(current))
  // 切 playbook → 重置编辑态为所选项（所见即所得）
  useEffect(() => {
    setEditing(pickEditable(getPlaybook(playbookId)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbookId])

  // ── 本片参数（per-node，始终可写）──
  const [aspectRatio, setAspectRatio] = useState(d.aspectRatio || '16:9')
  const [customAspectRatio, setCustomAspectRatio] = useState(d.customAspectRatio || '')
  const [textModel, setTextModel] = useState(() => (d.textModel || d.selectedModel || chatModels[0]?.id || ''))
  const [assetModel, setAssetModel] = useState(() => (d.assetModelSettings?.globalModel || imageModels[0]?.id || ''))

  const isDirty = () => JSON.stringify(editing) !== JSON.stringify(pickEditable(current))

  const save = () => {
    // 1) 本片参数 + playbook 选择：写回 node.data
    updateData({
      aspectRatio,
      customAspectRatio,
      playbookId,
      playbookLabel: current.label,
      textModel,
      selectedModel: textModel,
      assetModelSettings: { ...d.assetModelSettings, globalModel: assetModel }
    })
    // 2) 自定义 playbook 有改动 → 写回 store（单一数据源），全局生效
    if (!builtin && playbookId && isDirty()) {
      saveCustomPlaybook({ ...current, ...editing })
    }
    onClose()
  }

  // ── 管理面板 ──
  const [manageOpen, setManageOpen] = useState(false)

  // ── 另存为已移除：新建/编辑/删除统一走「管理」面板（scriptBoxPlaybookManager）──

  return (
    <>
    <ScriptBoxModal
      title="总体设置"
      onClose={onClose}
      width={760}
      height={600}
      bodyClass="p-0 flex flex-col min-h-0 flex-1"
      footer={
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-white/[0.06] shrink-0">
          <button className="px-4 py-1.5 text-body-xs text-secondary hover:text-white" onClick={onClose}>取消</button>
          <button className="px-4 py-1.5 text-body-xs bg-white/10 hover:bg-white/15 text-primary rounded-lg transition-colors" onClick={save}>保存</button>
        </div>
      }
    >
      {/* 顶部条：playbook 选择 + 可写性提示 */}
      <div className="flex items-center gap-2 px-5 py-2.5 shrink-0 border-b border-white/[0.06]">
        <span className="text-body-xs text-secondary shrink-0">剧本盒子工作流</span>
        <Select
          value={playbookId}
          onChange={setPlaybookId}
          options={allPlaybooks.map((p) => ({ value: p.id, label: p.label }))}
          placeholder="选择工作流"
        />
        <span className="shrink-0 text-2xs text-muted-2">{builtin ? '·官方·只读' : '·我的·可编辑'}</span>
        <button type="button" onClick={() => setManageOpen(true)} className="shrink-0 ml-auto px-3 py-1 text-body-xs text-secondary hover:text-white rounded-lg">管理</button>
      </div>

      {/* 标签页 */}
      <div className="flex gap-1 px-5 pt-3 pb-2 shrink-0 overflow-x-auto custom-scrollbar">
        {TABS.map(([k, n]) => (
          <button key={k} onClick={() => setTab(k)} className={`shrink-0 px-3.5 py-1.5 text-body-xs rounded-lg transition-colors ${tab === k ? 'bg-white/10 text-white' : 'text-secondary hover:text-primary hover:bg-white/5'}`}>{n}</button>
        ))}
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar px-5 py-4">
        {tab === 'basic' && (
          <div className="flex flex-col gap-5">
            <Section title="画面比例">
              <div className="flex gap-1.5 flex-wrap">
                {ratios.map((r) => (
                  <button key={r} onClick={() => setAspectRatio(r)} className={`px-2.5 py-1 text-caption-sm rounded-lg border transition-colors ${aspectRatio === r ? 'border-white/50 text-white bg-white/10' : 'border-white/[0.06] text-secondary hover:border-white/20 hover:text-primary'}`}>{r}</button>
                ))}
                <button onClick={() => setAspectRatio('custom')} className={`px-2.5 py-1 text-caption-sm rounded-lg border transition-colors ${aspectRatio === 'custom' ? 'border-white/50 text-white bg-white/10' : 'border-white/[0.06] text-secondary hover:border-white/20'}`}>自定义</button>
              </div>
              {aspectRatio === 'custom' && <input value={customAspectRatio} onChange={(e) => setCustomAspectRatio(e.target.value)} placeholder="如 2:1" className="mt-2 w-28 bg-surface-strong border border-white/[0.06] rounded-md px-2 py-1 text-caption-sm text-primary outline-none focus:border-white/20 nodrag" />}
            </Section>

            <Section title="模型">
              <div className="grid grid-cols-2 gap-3">
                <Field label="文本模型（生成分镜/提示词）">
                  <div className="flex items-center"><ModelSelect value={textModel} onChange={setTextModel} models={chatModels} placeholder="选择文本模型" popupTo="down" showDivider={false} /></div>
                </Field>
                <Field label="资产生图模型">
                  <div className="flex items-center"><ModelSelect value={assetModel} onChange={setAssetModel} models={imageModels} placeholder="选择生图模型" popupTo="down" showDivider={false} /></div>
                </Field>
              </div>
            </Section>

            <Section title="全局约束">
              <div className="grid grid-cols-2 gap-3">
                <Field label="图片·要求"><EditableTextarea heightClass="h-16" value={editing.constraints.image} name="ci" disabled={builtin} onChange={(v) => setEdit({ constraints: { ...editing.constraints, image: v } })} /></Field>
                <Field label="视频·要求"><EditableTextarea heightClass="h-16" value={editing.constraints.video} name="cv" disabled={builtin} onChange={(v) => setEdit({ constraints: { ...editing.constraints, video: v } })} /></Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="通用·禁止"><EditableTextarea heightClass="h-16" value={editing.negative.common} name="nc" disabled={builtin} onChange={(v) => setEdit({ negative: { ...editing.negative, common: v } })} /></Field>
                <Field label="图片·禁止"><EditableTextarea heightClass="h-16" value={editing.negative.image} name="ni" disabled={builtin} onChange={(v) => setEdit({ negative: { ...editing.negative, image: v } })} /></Field>
                <Field label="视频·禁止"><EditableTextarea heightClass="h-16" value={editing.negative.video} name="nv" disabled={builtin} onChange={(v) => setEdit({ negative: { ...editing.negative, video: v } })} /></Field>
              </div>
            </Section>
          </div>
        )}

        {tab === 'script' && (
          <Section title="剧本生成提示词（剧情 → 分镜）">
            <EditableTextarea heightClass="h-64" value={editing.script} name="script" disabled={builtin} onChange={(v) => setEdit({ script: v })} />
          </Section>
        )}

        {tab === 'shot' && (
          <div className="flex flex-col gap-4">
            <Section title="分镜生成提示词（分镜 → 生图/生视频）">
              <EditableTextarea heightClass="h-64" value={editing.shot} name="shot" disabled={builtin} onChange={(v) => setEdit({ shot: v })} />
            </Section>
            <Section title="提示词审计改写提示词（按意见精修，随工作流切换）">
              <EditableTextarea heightClass="h-40" value={editing.audit} name="audit" disabled={builtin} onChange={(v) => setEdit({ audit: v })} />
            </Section>
          </div>
        )}

        {tab === 'image' && (
          <div className="flex flex-col gap-4">
            <div className="text-caption-sm text-muted">生图类型模板（AI 生图：关键帧 / 四宫格 / 九宫格 / 俯视调度图）</div>
            {Object.entries(editing.imageGenTemplates).map(([k, t]) => (
              <Field key={k} label={t?.label || k}>
                <EditableTextarea heightClass="h-36" value={t?.sys || ''} name={`img-${k}`} disabled={builtin} onChange={(v) => { const g = { ...editing.imageGenTemplates }; g[k] = { ...(g[k] || { label: k }), sys: v }; setEdit({ imageGenTemplates: g }) }} />
              </Field>
            ))}
          </div>
        )}

        {tab === 'asset' && (
          <div className="flex flex-col gap-4">
            <div className="text-caption-sm text-muted">资产参考图模板（角色 / 场景 / 道具）</div>
            {[['character', '角色'], ['scene', '场景'], ['prop', '道具']].map(([k, n]) => (
              <Field key={k} label={n}>
                <EditableTextarea heightClass="h-28" value={editing.assetTemplates[k] || ''} name={`as-${k}`} disabled={builtin} onChange={(v) => setEdit({ assetTemplates: { ...editing.assetTemplates, [k]: v } })} />
              </Field>
            ))}
          </div>
        )}
      </div>
    </ScriptBoxModal>
    {manageOpen && (
      <ScriptBoxPlaybookManager
        currentId={playbookId}
        onSelect={setPlaybookId}
        onClose={() => setManageOpen(false)}
      />
    )}
  </>
)
}

/** playbook 提示词编辑区：内置只读（disabled + 降透明度），自定义可编辑。heightClass 控制各提示词高度。 */
function EditableTextarea({ value, name, disabled, heightClass = 'h-36', onChange }) {
  return (
    <textarea
      value={value}
      name={name}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full bg-surface-strong border border-white/[0.06] rounded-md p-2 text-primary text-caption-sm outline-none custom-scrollbar nodrag nowheel ${heightClass} ${disabled ? 'opacity-60 cursor-not-allowed' : 'focus:border-white/20'}`}
    />
  )
}

function Field({ label, children }) {
  return <label className="block text-caption-sm text-muted">{label}<div className="mt-1.5">{children}</div></label>
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-caption-sm text-muted mb-2">{title}</div>
      {children}
    </div>
  )
}