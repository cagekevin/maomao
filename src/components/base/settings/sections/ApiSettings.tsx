import React from 'react'
import { Check, Star, Server, RefreshCw, CircleDot, AlertCircle, Image, MessagesSquare, Video } from 'lucide-react'
import { showToast } from '../../toastStore.ts'
import { PROVIDER_PROTOCOL_LABELS } from '../../providerProtocols.ts'
import { useProviders, load, select, setPrimary, test, fetchModels, applyFetchedModels, closeFetchedModels, save } from '../providerStore.ts'
import FetchModelsModal from './FetchModelsModal.tsx'
import type { RawModel } from '../../providerModels.ts'

/**
 * 设置分区 · 服务商配置（新时代「切哪个用哪个」，docs/96、docs/101）。
 *
 * 【语义（用户拍板）】能实现的厂商/模型都已配进 config/providers JSON，用户想用哪个就用哪个——
 * 这里是「集中展示所有已配置厂商 + 切换到当前想用的那个」，不是旧时代的「自由增删连接 + 选协议 + 存 providers.json」。
 *  - 厂商列表 = 后端 GET /api/providers（13 平台 JSON + 内置目录合并），只读展示。
 *  - 「当前使用」= primary（仅作默认/回退兜底）；节点仍可经 providerId::modelId 独立选任意厂商模型。
 *  - 保留「测试连接 / 拉取模型」；厂商本身（base_url/key/协议/模型清单）由 config JSON 管理，不在本页增删改。
 */
function protocolBadgeCls(protocol: string): string {
  if (protocol === 'openai') return 'text-emerald-400 bg-emerald-500/10'
  if (protocol === 'apimart') return 'text-sky-400 bg-sky-500/10'
  return 'text-secondary bg-surface-1'
}

export default function ApiSettings() {
  const { providers, selectedId, loading, dirty, saving, testingId, fetchingId, fetchedModels, testResult } = useProviders()

  React.useEffect(() => {
    let cancelled = false
    load().catch((e) => { if (!cancelled) showToast('加载服务商失败', { type: 'error' }) })
    return () => { cancelled = true }
  }, [])

  const selected = React.useMemo(
    () => providers.find((p) => p.id === selectedId) || providers[0] || null,
    [providers, selectedId]
  )
  const isPrimary = !!selected?.primary

  const handleSave = async () => {
    const r = await save()
    showToast(r.ok ? '已保存当前服务商' : '保存失败：' + r.error, { type: r.ok ? 'success' : 'error' })
  }
  const handleSetPrimary = async () => {
    if (!selected) return
    setPrimary(selected.id)
    showToast('已设为当前使用（记得保存）', { type: 'success' })
  }
  const handleFetch = async () => {
    if (!selected) return
    const r = await fetchModels(selected.id)
    if (r.error) showToast('拉取模型失败：' + r.error, { type: 'error' })
    else if (r.warning) showToast(r.warning, { type: 'warning' })
    else if (r.pending) showToast(`已拉取 ${r.total ?? 0} 个模型，请勾选要写入的`, { type: 'success' })
    else showToast(`已拉取 ${r.total ?? 0} 个模型`, { type: 'success' })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 顶部操作栏 */}
      <div className="bg-surface border border-edge-subtle rounded-xl px-6 py-5 flex items-center justify-between">
        <div>
          <h2 className="settings-page-title flex items-center gap-2">
            <Server size={17} className="text-secondary" /> 服务商配置
          </h2>
          <p className="text-xs text-muted mt-1">切换当前想用的服务商；节点仍可各自独立选择任意厂商模型</p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && <span className="text-xs text-red-400">有未保存的修改</span>}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-2 px-4 h-9 text-xs font-medium bg-white text-black rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border-none"
          >
            <Check size={14} /> {saving ? '保存中…' : '保存更改'}
          </button>
        </div>
      </div>

      <div className="flex gap-4 items-start">
        {/* 左：厂商列表 */}
        <aside className="w-[260px] shrink-0 flex flex-col gap-3">
          <div className="bg-surface border border-edge-subtle rounded-xl overflow-hidden">
            <div className="px-4 py-3.5 border-b border-edge-subtle flex items-center justify-between">
              <span className="text-sm text-body">已配置服务商</span>
              <span className="text-xs text-muted bg-surface-1 px-2 py-0.5 rounded-full">{providers.length}</span>
            </div>
            <div className="p-2 space-y-1">
              {loading ? (
                <div className="text-center text-xs text-muted py-6">加载中…</div>
              ) : providers.length === 0 ? (
                <div className="text-center text-xs text-muted py-6 border border-dashed border-edge rounded-lg">暂无已配置服务商</div>
              ) : (
                providers.map((p) => (
                  <ProviderListItem
                    key={p.id}
                    p={p}
                    active={p.id === selectedId || (!selectedId && p.id === providers[0]?.id)}
                    onSelect={() => select(p.id)}
                  />
                ))
              )}
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-muted px-1">
            服务商与其模型由 config/providers JSON 管理，本页仅切换/测试，不做增删改。
          </p>
        </aside>

        {/* 右：详情 */}
        <main className="flex-1 min-w-0">
          {!selected ? (
            <div className="bg-surface border border-dashed border-edge rounded-xl py-16 text-center text-sm text-muted">请选择一个服务商查看</div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* header */}
              <div className="bg-surface border border-edge-subtle rounded-xl px-6 py-5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base text-strong font-medium truncate">{selected.name || selected.id}</h3>
                    {selected.primary && <Star size={14} className="text-secondary fill-secondary" />}
                    {selected.readonly && <span className="text-[10px] text-muted bg-surface-1 px-1.5 py-0.5 rounded-md">内置</span>}
                  </div>
                  <p className="text-xs text-muted mt-1 truncate">
                    {selected.base_url || (selected._relay && (selected._relay as { defaultBaseUrl?: string })?.defaultBaseUrl) || '未设置请求地址'}
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full ${protocolBadgeCls(selected.protocol || '')}`}>
                  {PROVIDER_PROTOCOL_LABELS[selected.protocol || ''] || selected.protocol || '未知'}
                </span>
              </div>

              {/* 动作栏 */}
              <div className="bg-surface border border-edge-subtle rounded-xl px-6 py-4 flex items-center gap-3 flex-wrap">
                {!isPrimary && (
                  <button type="button" onClick={handleSetPrimary} className="inline-flex items-center gap-2 px-4 h-9 text-xs rounded-xl text-yellow-300 hover:bg-yellow-500/10 border border-yellow-500/40 transition-colors cursor-pointer">
                    <Star size={14} /> 设为当前使用
                  </button>
                )}
                {isPrimary && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-secondary"><Star size={14} className="fill-secondary" /> 当前使用</span>
                )}
                <button type="button" onClick={() => test(selected.id)} disabled={testingId === selected.id} className="inline-flex items-center gap-2 px-4 h-9 text-xs rounded-xl bg-surface-1 text-body hover:bg-surface-hover hover:text-blue-400 transition-colors cursor-pointer border-none disabled:opacity-50">
                  <RefreshCw size={14} className={testingId === selected.id ? 'animate-spin' : ''} /> {testingId === selected.id ? '测试中…' : '测试连接'}
                </button>
                <button type="button" onClick={handleFetch} disabled={fetchingId === selected.id} className="inline-flex items-center gap-2 px-4 h-9 text-xs rounded-xl bg-surface-1 text-body hover:bg-surface-hover hover:text-blue-400 transition-colors cursor-pointer border-none disabled:opacity-50">
                  <CircleDot size={14} className={fetchingId === selected.id ? 'animate-spin' : ''} /> {fetchingId === selected.id ? '拉取中…' : '拉取模型'}
                </button>
                {testResult && selectedId === selected.id && (
                  <div className={`flex flex-col gap-1 text-xs px-3 py-2 rounded-xl ${testResult.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
                    <div className="flex items-center gap-2">
                      {testResult.ok ? <AlertCircle size={14} /> : <AlertCircle size={14} />}
                      {testResult.ok ? `连接成功（${testResult.status ?? ''}${testResult.stage ? ' · ' + testResult.stage : ''}）` : `连接失败：${testResult.error || testResult.status || '未知'}`}
                    </div>
                  </div>
                )}
              </div>

              {/* 模型清单（只读，按能力分开） */}
              <CapabilityModels title="图片模型" icon={<Image size={14} />} models={selected.image_models || []} />
              <CapabilityModels title="聊天模型" icon={<MessagesSquare size={14} />} models={selected.chat_models || []} />
              <CapabilityModels title="视频模型" icon={<Video size={14} />} models={selected.video_models || []} />

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
                    showToast(`已写入 ${total} 个模型（记得点「保存更改」）`, { type: 'success' })
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

function ProviderListItem({ p, active, onSelect }: { p: { id: string; name?: string; protocol?: string; primary?: boolean; image_models?: RawModel[]; chat_models?: RawModel[]; video_models?: RawModel[] }; active: boolean; onSelect: () => void }) {
  const cap = (arr?: RawModel[]) => arr?.length || 0
  return (
    <div
      className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors border ${active ? 'bg-surface-active border-edge' : 'border-transparent hover:bg-surface-hover'}`}
      onClick={onSelect}
    >
      <span className={`flex-1 truncate text-sm ${active ? 'text-strong' : 'text-body'}`}>{p.name || p.id}</span>
      <span className="hidden sm:flex text-[10px] text-muted shrink-0">
        <span className="px-1">图{cap(p.image_models)}</span><span className="px-1">文{cap(p.chat_models)}</span><span className="px-1">视{cap(p.video_models)}</span>
      </span>
      <span className={`text-[10px] px-1.5 py-0.5 rounded font-normal ${protocolBadgeCls(p.protocol || '')}`}>
        {PROVIDER_PROTOCOL_LABELS[p.protocol || ''] || p.protocol || '——'}
      </span>
      {p.primary && <Star size={12} className="text-secondary fill-secondary" />}
    </div>
  )
}

function CapabilityModels({ title, icon, models }: { title: string; icon: React.ReactNode; models: RawModel[] }) {
  return (
    <section className="bg-surface border border-edge-subtle rounded-xl overflow-hidden">
      <div className="px-6 py-3.5 border-b border-edge-subtle flex items-center gap-2">
        <span className="text-secondary">{icon}</span>
        <h3 className="text-sm text-body">{title}</h3>
        <span className="text-xs text-muted bg-surface-1 px-2 py-0.5 rounded-full">{models.length}</span>
      </div>
      {models.length === 0 ? (
        <div className="px-6 py-4 text-xs text-muted border border-dashed border-transparent">该服务商暂无此能力模型</div>
      ) : (
        <div className="px-6 py-4 grid grid-cols-2 gap-x-6 gap-y-1">
          {models.map((m, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-body truncate">
              <span className="w-1 h-1 rounded-full bg-secondary shrink-0" />
              <span className="truncate">{m.label || m.id}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}