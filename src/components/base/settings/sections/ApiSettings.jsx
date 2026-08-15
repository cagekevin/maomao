import React from 'react'
import { Plus, Trash2, Star, Check, Server } from 'lucide-react'
import { showToast } from '../../toastStore.js'
import { useProviders, load, select, add, update, setPrimary, remove, test, fetchModels, save } from '../providerStore.js'
import ProviderForm from './ProviderForm.jsx'

/**
 * 设置分区 · 第三方 API 配置（正规后台双栏布局）。
 *  - 顶部操作栏：标题 + 说明 + 保存（主按钮）+ 供应商统计
 *  - 左侧：供应商列表（协议标签/主标记/hover 删除），+ 添加供应商
 *  - 右侧：当前供应商编辑面板（ProviderForm：连接/密钥/测试/模型）
 * 功能完整：协议/请求形态/Key/测试/拉取模型/模型三栏/设主/删除。
 */
export default function ApiSettings() {
  const { providers, selectedId, loading, dirty, saving, testingId, fetchingId, testResult } = useProviders()

  React.useEffect(() => {
    let cancelled = false
    load().catch(() => { if (!cancelled) showToast('加载供应商失败', { type: 'error' }) })
    return () => { cancelled = true }
  }, [])

  const selected = providers.find((p) => p.id === selectedId) || null

  const handleSave = async () => {
    const r = await save()
    showToast(r.ok ? '已保存' : '保存失败：' + r.error, { type: r.ok ? 'success' : 'error' })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 顶部操作栏 */}
      <div className="bg-surface border border-edge-subtle rounded-xl px-5 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-base text-gray-100 flex items-center gap-2">
            <Server size={18} className="text-gray-500" /> 第三方 API 配置
          </h2>
          <p className="text-xs text-gray-500 mt-1">管理各供应商的连接、密钥与模型清单，统一分派画布请求</p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && <span className="text-xs text-yellow-400">有未保存的修改</span>}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border-none"
          >
            <Check size={14} /> {saving ? '保存中…' : '保存更改'}
          </button>
        </div>
      </div>

      {/* 双栏布局 */}
      <div className="flex gap-6 items-start">
        {/* 左侧：供应商列表 */}
        <aside className="w-72 shrink-0 flex flex-col gap-3">
          <div className="bg-surface border border-edge-subtle rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-edge-subtle flex items-center justify-between">
              <span className="text-sm text-gray-200">供应商</span>
              <span className="text-xs text-gray-500 bg-surface-1 px-2 py-0.5 rounded-full">{providers.length}</span>
            </div>
            <div className="p-2 space-y-1">
              {loading ? (
                <div className="text-center text-xs text-gray-500 py-6">加载中…</div>
              ) : providers.length === 0 ? (
                <div className="text-center text-xs text-gray-500 py-6 border border-dashed border-edge rounded-lg">暂无供应商</div>
              ) : (
                providers.map((p) => (
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
            onClick={add}
            className="w-full py-2.5 bg-surface-1 text-gray-400 rounded-lg hover:bg-surface-hover hover:text-gray-200 transition-colors text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer border-none"
          >
            <Plus size={14} /> 添加供应商
          </button>
        </aside>

        {/* 右侧：编辑面板 */}
        <main className="flex-1 min-w-0">
          {!selected ? (
            <div className="bg-surface border border-dashed border-edge rounded-xl py-16 text-center text-sm text-gray-500">请选择或添加一个供应商进行配置</div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* 当前供应商 header */}
              <div className="bg-surface border border-edge-subtle rounded-xl px-5 py-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base text-gray-100 truncate">{selected.name || '未命名供应商'}</h3>
                    {selected.isPrimary && <Star size={14} className="text-gray-400 fill-gray-400" />}
                    {selected.readonly && <span className="text-caption text-gray-500 bg-surface-1 px-2 py-0.5 rounded-full">内置</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{selected.base_url || '未设置请求地址'}</p>
                </div>
                <span className={`text-caption-sm px-2.5 py-1 rounded-full ${selected.protocol === 'openai' ? 'text-emerald-400 bg-emerald-500/10' : 'text-sky-400 bg-sky-500/10'}`}>
                  {selected.protocol === 'openai' ? 'OpenAI 兼容' : 'apimart'}
                </span>
              </div>

              <ProviderForm
                p={selected}
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
                  else showToast(`已拉取 ${r.total ?? 0} 个模型`, { type: 'success' })
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
      className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors border ${active ? 'bg-surface-active border-edge' : 'border-transparent hover:bg-surface-1'}`}
      onClick={onSelect}
    >
      <span className={`flex-1 truncate text-sm ${active ? 'text-white' : 'text-gray-300'}`}>{p.name || p.id}</span>
      <span className={`text-caption px-1.5 py-0.5 rounded font-normal ${p.protocol === 'openai' ? 'text-emerald-400 bg-emerald-500/10' : 'text-sky-400 bg-sky-500/10'}`}>
        {p.protocol === 'openai' ? 'OpenAI' : 'apimart'}
      </span>
      {p.isPrimary && <Star size={12} className="text-gray-400 fill-gray-400" />}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity border-none bg-transparent cursor-pointer p-0.5"
        title="删除供应商"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}
