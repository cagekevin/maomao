import React from 'react'
import { Plus, Trash2, Star, Check, Server, Layers, Boxes } from 'lucide-react'
import { showToast } from '../../toastStore.js'
import { PROVIDER_PROTOCOL_LABELS, GENERAL_PROTOCOLS, SPECIAL_PROTOCOLS, isGeneralProtocol } from '../../providerProtocols.js'
import { useProviders, load, select, add, update, setPrimary, remove, test, fetchModels, applyFetchedModels, closeFetchedModels, save } from '../providerStore.js'
import ProviderForm from './ProviderForm.jsx'
import FetchModelsModal from './FetchModelsModal.jsx'

/**
 * 设置分区 · 第三方 API 配置（双栏后台，样式对齐 SkillSettings 的 zinc 黑白系）。
 *  - 顶部操作栏：标题 + 说明 + 保存（主按钮白底）+ 供应商统计
 *  - 左侧：供应商列表（协议标签/主标记/hover 删除），+ 添加供应商
 *  - 右侧：当前供应商编辑面板（ProviderForm）
 *
 * 【Tab 分流（平台专属颗粒与通用平台完全隔离）】
 *  - Tab「通用平台」：标准 HTTP 平台（openai/apimart/gemini，只需 base_url+key，无专属参数）
 *  - Tab「平台专属」：需专属参数或 CLI（volcengine/runninghub/jimeng/codex/gemini-cli）
 *  两个 tab 的供应商列表完全分开，各自独立管理；协议下拉也按 tab 隔离（通用平台选不到专属协议，反之亦然）。
 */
const isGeneralProvider = (p) => isGeneralProtocol(p?.protocol)
const isSpecialProvider = (p) => !isGeneralProtocol(p?.protocol)

export default function ApiSettings() {
  const { providers, selectedId, loading, dirty, saving, testingId, fetchingId, fetchedModels, testResult } = useProviders()
  // tab：'general' 通用平台 | 'special' 平台专属
  const [tab, setTab] = React.useState('general')

  React.useEffect(() => {
    let cancelled = false
    load().catch(() => { if (!cancelled) showToast('加载供应商失败', { type: 'error' }) })
    return () => { cancelled = true }
  }, [])

  // 当前 tab 的供应商列表
  const tabProviders = React.useMemo(
    () => providers.filter((p) => (tab === 'general' ? isGeneralProvider(p) : isSpecialProvider(p))),
    [providers, tab]
  )
  // 当前选中（优先当前 tab 里的）
  const selected = tabProviders.find((p) => p.id === selectedId) || tabProviders[0] || null

  // 切 tab：确保选中落在该 tab
  const handleTabChange = (t) => {
    setTab(t)
    const list = providers.filter((p) => (t === 'general' ? isGeneralProvider(p) : isSpecialProvider(p)))
    if (list.length) select(list[0].id)
  }
  // 添加供应商：按当前 tab 给默认协议（通用→openai；专属→volcengine）
  const handleAdd = () => {
    const np = add()
    if (np) {
      if (tab === 'general') update(np.id, { protocol: 'openai' })
      else update(np.id, { protocol: 'volcengine' })
    }
  }

  const handleSave = async () => {
    const r = await save()
    showToast(r.ok ? '已保存' : '保存失败：' + r.error, { type: r.ok ? 'success' : 'error' })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 顶部操作栏 */}
      <div className="bg-surface border border-edge-subtle rounded-xl px-6 py-5 flex items-center justify-between">
        <div>
          <h2 className="text-sm text-white font-medium flex items-center gap-2">
            <Server size={17} className="text-zinc-400" /> 第三方 API 配置
          </h2>
          <p className="text-xs text-zinc-500 mt-1">管理各供应商的连接、密钥与模型清单，统一分派画布请求</p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && <span className="text-xs text-yellow-400">有未保存的修改</span>}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-2 px-4 h-9 text-xs font-medium bg-white text-black rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border-none"
          >
            <Check size={14} /> {saving ? '保存中…' : '保存更改'}
          </button>
        </div>
      </div>

      {/* 双栏布局 */}
      <div className="flex gap-4 items-start">
        {/* 左侧：供应商列表 */}
        <aside className="w-[260px] shrink-0 flex flex-col gap-3">
          {/* 供应商分类切换（通用平台默认显示；平台专属单独折叠） */}
          <div className="flex rounded-lg bg-surface border border-edge-subtle p-0.5 text-xs">
            <button
              type="button"
              onClick={() => handleTabChange('general')}
              className={`flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md transition-colors cursor-pointer border-none ${tab === 'general' ? 'bg-surface-hover text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Layers size={13} /> 通用平台
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('special')}
              className={`flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md transition-colors cursor-pointer border-none ${tab === 'special' ? 'bg-surface-hover text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Boxes size={13} /> 平台专属
            </button>
          </div>
          <div className="bg-surface border border-edge-subtle rounded-xl overflow-hidden">
            <div className="px-4 py-3.5 border-b border-edge-subtle flex items-center justify-between">
              <span className="text-sm text-zinc-200">{tab === 'general' ? '通用平台' : '平台专属'}</span>
              <span className="text-xs text-zinc-500 bg-surface-1 px-2 py-0.5 rounded-full">{tabProviders.length}</span>
            </div>
            <div className="p-2 space-y-1">
              {loading ? (
                <div className="text-center text-xs text-zinc-500 py-6">加载中…</div>
              ) : tabProviders.length === 0 ? (
                <div className="text-center text-xs text-zinc-500 py-6 border border-dashed border-edge rounded-lg">暂无供应商</div>
              ) : (
                tabProviders.map((p) => (
                  <ProviderListItem
                    key={p.id}
                    p={p}
                    active={p.id === selectedId}
                    onSelect={() => select(p.id)}
                    onRemove={() => remove(p.id)}
                  />
                ))
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="w-full h-9 bg-surface-1 text-zinc-400 rounded-xl hover:bg-surface-hover hover:text-zinc-200 transition-colors text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer border-none"
          >
            <Plus size={14} /> 添加{tab === 'general' ? '通用' : '专属'}平台
          </button>
        </aside>

        {/* 右侧：编辑面板 */}
        <main className="flex-1 min-w-0">
          {!selected ? (
            <div className="bg-surface border border-dashed border-edge rounded-xl py-16 text-center text-sm text-zinc-500">请选择或添加一个供应商进行配置</div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* 当前供应商 header */}
              <div className="bg-surface border border-edge-subtle rounded-xl px-6 py-5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base text-white font-medium truncate">{selected.name || '未命名供应商'}</h3>
                    {selected.primary && <Star size={14} className="text-zinc-400 fill-zinc-400" />}
                    {selected.readonly && <span className="text-[10px] text-zinc-500 bg-surface-1 px-1.5 py-0.5 rounded-md">内置</span>}
                  </div>
                  <p className="text-xs text-zinc-500 mt-1 truncate">{selected.base_url || '未设置请求地址'}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full ${selected.protocol === 'openai' ? 'text-emerald-400 bg-emerald-500/10' : selected.protocol === 'apimart' ? 'text-sky-400 bg-sky-500/10' : 'text-zinc-400 bg-surface-1'}`}>
                  {PROVIDER_PROTOCOL_LABELS[selected.protocol] || selected.protocol}
                </span>
              </div>

              <ProviderForm
                p={selected}
                tab={tab}
                testing={testingId === selected.id}
                fetching={fetchingId === selected.id}
                testResult={selected.id === selectedId ? testResult : null}
                onUpdate={(patch) => update(selected.id, patch)}
                onSetPrimary={() => setPrimary(selected.id)}
                onRemove={() => remove(selected.id)}
                onTest={() => test(selected.id)}
                onFetchModels={async () => {
                  const r = await fetchModels(selected.id)
                  if (r.error) showToast('拉取模型失败：' + r.error, { type: 'error' })
                  else if (r.warning) showToast(r.warning, { type: 'warning' })
                  else if (r.pending) showToast(`已拉取 ${r.total ?? 0} 个模型，请勾选要保存的`, { type: 'success' })
                  else showToast(`已拉取 ${r.total ?? 0} 个模型`, { type: 'success' })
                }}
              />

              <FetchModelsModal
                open={!!fetchedModels}
                fetched={fetchedModels ? { image_models: fetchedModels.image_models, chat_models: fetchedModels.chat_models, video_models: fetchedModels.video_models } : null}
                existing={selected ? { image_models: selected.image_models, chat_models: selected.chat_models, video_models: selected.video_models } : null}
                fetching={fetchingId === selected?.id}
                onClose={() => closeFetchedModels()}
                onConfirm={(selectedModels) => {
                  if (fetchedModels) {
                    applyFetchedModels(fetchedModels.id, selectedModels)
                    const total = (selectedModels.image_models?.length || 0) + (selectedModels.chat_models?.length || 0) + (selectedModels.video_models?.length || 0)
                    showToast(`已保存 ${total} 个模型（记得点「保存更改」）`, { type: 'success' })
                  }
                }}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function ProviderListItem({ p, active, onSelect, onRemove }) {
  return (
    <div
      className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors border ${active ? 'bg-surface-active border-edge' : 'border-transparent hover:bg-surface-hover'}`}
      onClick={onSelect}
    >
      <span className={`flex-1 truncate text-sm ${active ? 'text-white' : 'text-zinc-300'}`}>{p.name || p.id}</span>
      <span className={`text-[10px] px-1.5 py-0.5 rounded font-normal ${p.protocol === 'openai' ? 'text-emerald-400 bg-emerald-500/10' : p.protocol === 'apimart' ? 'text-sky-400 bg-sky-500/10' : 'text-zinc-500 bg-surface-1'}`}>
        {p.protocol === 'openai' ? 'OpenAI' : p.protocol === 'apimart' ? 'apimart' : p.protocol}
      </span>
      {p.primary && <Star size={12} className="text-zinc-400 fill-zinc-400" />}
      {!p.readonly && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity border-none bg-transparent cursor-pointer p-0.5"
          title="删除供应商"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  )
}
