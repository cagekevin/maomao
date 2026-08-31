import React, { useState } from 'react'
import { Loader2, Wand2, User, Image as ImageIcon, Package, Plus, MoreVertical, Upload, RefreshCw, Trash2 } from 'lucide-react'
import { ZgPrompt, removeAsset, renameAssetRefs } from './scriptBoxPrompts.ts'
import { resolveAssetTemplates } from './scriptBoxPromptResolver.ts'
import { assetFolderOf } from '../base/assetStore.ts'
import { useOutsideClick } from '../base/hooks.ts'
import { useRenderImageResolver, toAbsoluteFileUrl } from '../base/imageUrl.ts'
import ImageZoomDialog from '../base/ImageZoomDialog.tsx'
import ScriptBoxAssetPicker from './ScriptBoxAssetPicker.jsx'
import type { ScriptBoxData, ScriptBoxUpdateData } from './scriptBoxSchema.ts'

/** StepAssets 实际调用的引擎回调（来自 props.callbacks = { ...data, onDisconnectUpstream }） */
interface AssetCallbacks {
  onGenerateAssetImage?: (assetId: string) => void
  onGenerateAllAssetImages?: (assetIds?: string[]) => void
  onRetryAssetImageUpload?: (assetId: string) => void
  onUploadAssetImage?: (assetId: string, file?: File | null) => void
  onDisconnectUpstream?: (sourceNodeId: string) => void
  [key: string]: unknown
}

interface StepAssetsProps {
  data?: ScriptBoxData
  updateData: ScriptBoxUpdateData
  callbacks: AssetCallbacks
}

/**
 * 剧本盒子 步骤2「准备资产」：角色/场景/道具三栏 + 资产卡(选中框/图片上传状态/more菜单) +
 * 工具栏(风格/生图模型/上传全部/批量生图带选中数) + 抽屉编辑 + 双击提示词面板（复刻原型 renderV2）。
 *
 * 数据只读 node.data：
 *  - assets[].picked  选中态（批量用，存 node.data）
 *  - assets[].imageStatus  uploading/uploaded/failed
 *  - pickedCount 全局选中数（存 node.data）
 * 编辑经 updateData；生成/上传经 callbacks.onGenerateAssetImage / onGenerateAllAssetImages /
 * onRetryAssetImageUpload / onUploadAssetImage。
 */
export default function StepAssets({ data, updateData, callbacks }: StepAssetsProps) {
  const d = (data ?? ({} as ScriptBoxData))
  const assets = d.assets || []
  const pickedCount = d.pickedCount || 0
  // 当前选中编辑的资产 idx（点资产卡选中；默认 null 显示空态，不遮挡任何资产）
  const [editIdx, setEditIdx] = useState<number | null>(null)
  // 双击查看大图（复用通用 ImageZoomDialog，同生图节点）：zoomUrl 记录当前要放大的图片 URL
  const zoomRef = React.useRef<HTMLDialogElement>(null)
  const [zoomUrl, setZoomUrl] = useState('')
  // 「从素材库选择」：picking 记录正在选图的资产 id（非空时弹出素材库选择器）
  const [picking, setPicking] = useState<number | null>(null)
  // 缩略图显示复用系统统一按需出图出口（与 ImageNode 一致），不再各自落盘独立缩略图文件
  const render = useRenderImageResolver()

  const CATS = [
    { k: 'character', n: '角色', icon: <User size={12} /> },
    { k: 'scene', n: '场景', icon: <ImageIcon size={12} /> },
    { k: 'prop', n: '道具', icon: <Package size={12} /> }
  ]

  // 切换选中
  const togglePick = (id) => {
    const next = assets.map((a) => (a.id === id ? { ...a, picked: !a.picked } : a))
    updateData({ assets: next, pickedCount: next.filter((a) => a.picked).length })
  }
  // 删除资产
  const delAsset = (id) => {
    // 联动清理逻辑收口到纯函数 removeAsset：删资产 → 各镜头文本里 @名 标记去掉（只去 @、保留名字）
    updateData(removeAsset(assets, id, d.shots))
  }
  // 批量生图：用选中集（未选则全部无图资产），走真批量引擎（onGenerateAllAssetImages）
  const batchGen = () => {
    const picked = assets.filter((a) => a.picked)
    const target = picked.length ? picked.map((a) => a.id) : undefined
    callbacks.onGenerateAllAssetImages?.(target)
  }
  // 上传单个资产图片：把本地图片设为该资产参考图（onUploadAssetImage，复用右键上传同一套落盘底层）
  const uploadOne = (id, file) => callbacks.onUploadAssetImage?.(id, file)
  const retryUpload = (id) => callbacks.onRetryAssetImageUpload?.(id)

  return (
    <div className="flex flex-col gap-3">
      {/* 工具栏：批量生成（模型/风格在设置里配置） */}
      <div className="flex flex-wrap items-center gap-2 text-caption-sm text-secondary">
        <button className="flex items-center gap-1 px-2 py-1 text-caption text-body bg-surface-1 hover:bg-surface-hover rounded" onClick={batchGen}>
          <Wand2 size={10} /> 批量生图{pickedCount ? `(${pickedCount})` : ''}
        </button>
      </div>

      {/* 左右分栏：左侧资产分三行（角色/场景/道具，自上而下），右侧固定编辑面板（不遮挡资产）。
          无限画布：不裁剪不滚动，内容自然撑开，节点高度自适应 */}
      <div className="flex gap-3 min-h-0">
        {/* 左侧：资产三行（每类一行，卡片横向排列） */}
        <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-visible">
          {CATS.map((c) => {
            const list = assets.filter((a) => a.category === c.k)
            return (
              <div key={c.k} className="flex flex-col gap-1.5 min-w-0">
                <div className="flex items-center gap-1.5 text-caption-sm text-body">{c.icon}<span>{c.n}</span><span className="text-muted">{list.length}</span></div>
                <div className="grid grid-cols-3 gap-1.5">
                  {list.map((a) => {
                    const gi = assets.indexOf(a)
                    return (
                      <AssetCard
                        key={a.id} asset={a} idx={gi} data={d}
                        updateData={updateData} callbacks={callbacks} render={render}
                        selected={editIdx === gi}
                        onOpen={() => setEditIdx(gi)}
                        onTogglePick={() => togglePick(a.id)}
                        onDel={() => { delAsset(a.id); if (editIdx === gi) setEditIdx(null) }}
                        onUpload={uploadOne}
                        onRetry={() => retryUpload(a.id)}
                        onEditPrompt={() => setEditIdx(gi)}
                        onPickFromLibrary={() => setPicking(gi)}
                        onZoomClick={(url) => { setZoomUrl(url); zoomRef.current?.showModal() }}
                      />
                    )
                  })}
                  <button className="flex items-center justify-center gap-1 h-9 w-full border border-dashed border-edge hover:border-edge-strong rounded-lg text-caption text-muted hover:text-body" onClick={() => { const id = addAsset(updateData, c.k, assets); setEditIdx(id) }}>
                    <Plus size={10} /> 新增{c.n}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* 右侧：固定编辑面板（选中资产时显示，不遮挡左侧资产） */}
        <div className="w-[340px] shrink-0 border-l border-edge-faint pl-3 min-h-0 overflow-visible">
          {editIdx !== null && assets[editIdx] ? (
            <AssetPanel key={assets[editIdx].id} asset={assets[editIdx]} idx={editIdx} data={d} updateData={updateData} onGen={() => callbacks.onGenerateAssetImage?.(assets[editIdx].id)} onClose={() => setEditIdx(null)} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-2 text-caption-sm gap-2">
              <Package size={20} className="text-gray-700" />
              点击左侧资产卡片，在此编辑
            </div>
          )}
        </div>
      </div>
      {/* 双击资产缩略图查看大图 */}
      <ImageZoomDialog ref={zoomRef} url={zoomUrl} />

      {/* 从素材库选择：按资产类别锁文件夹（人物/场景/道具），点选一张图设为该资产参考图。
          这里直接用 updateData 写回 assets（不依赖 node.data 上是否注入 onPickAssetImage），
          保证选完图一定能写进该资产并显示。 */}
      {picking !== null && assets[picking] && (
        <ScriptBoxAssetPicker
          folder={assetFolderOf(assets[picking].category)}
          onClose={() => setPicking(null)}
          onPick={(url) => {
            if (url) {
              const abs = toAbsoluteFileUrl(url)
              updateData({
                assets: assets.map((a) =>
                  a.id === assets[picking].id
                    ? { ...a, imageUrl: abs, thumbnailUrl: abs, has: true, imageStatus: 'uploaded', imageError: undefined }
                    : a
                ),
              })
            }
            setPicking(null)
          }}
        />
      )}
    </div>
  )
}

/** 新增资产（按当前风格生成 prompt），返回新资产的 index（数组末尾） */
function addAsset(updateData: ScriptBoxUpdateData, cat: string, assets: ScriptBoxData['assets']) {
  const name = `${cat === 'character' ? '角色' : cat === 'scene' ? '场景' : '道具'}${assets.length + 1}`
  const newAsset = {
    id: `${cat}-${Date.now()}`,
    category: cat,
    name, description: '', prompt: '',
    imageUrl: '', thumbnailUrl: '',
    has: false, loading: false, picked: false, imageStatus: ''
  }
  updateData({ assets: [...assets, newAsset] })
  return assets.length // 新增后位于数组末尾，旧长度即新 index
}

/** 资产卡：缩略图 + 选中框 + 名称/描述 + 图片上传状态 + more 菜单 */
function AssetCard({ asset, idx, data, updateData, callbacks, render, onOpen, onTogglePick, onDel, onUpload, onRetry, onEditPrompt, onPickFromLibrary, onZoomClick, selected }: {
  asset: ScriptBoxData['assets'][number]
  idx: number
  data: ScriptBoxData
  updateData: ScriptBoxUpdateData
  callbacks: AssetCallbacks
  render: (url: string) => string
  onOpen: () => void
  onTogglePick: () => void
  onDel: () => void
  onUpload: (id: string, file: File) => void
  onRetry: () => void
  onEditPrompt: () => void
  onPickFromLibrary: () => void
  onZoomClick: (url: string) => void
  selected: boolean
}) {
  const [more, setMore] = useState(false)
  const moreRef = React.useRef<HTMLDivElement>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)
  useOutsideClick(moreRef, more, () => setMore(false))
  // 选图后回调（复用上传底层，把图设为该资产参考图）；失败/取消重置 input 便于再次选择
  const handlePickFile = (e) => {
    const file = e.target.files?.[0]
    if (file) onUpload(asset.id, file)
    e.target.value = ''
  }

  return (
    <div className={`relative w-full min-w-0 flex flex-col p-2 bg-surface-1 border rounded-lg transition-colors ${selected ? 'border-blue-500/70' : 'border-edge-faint hover:border-edge-muted'}`}>
      {/* 大图区（在上，放大；点击打开抽屉，双击查看大图） */}
      <div className="w-full h-20 rounded-md overflow-hidden bg-surface-1 flex items-center justify-center cursor-pointer nodrag" onClick={onOpen}>
        {asset.loading ? <Loader2 size={16} className="animate-spin text-secondary" />
          : asset.imageUrl ? <img src={render(asset.imageUrl)} alt={asset.name} className="w-full h-full object-cover" onDoubleClick={(e) => { e.stopPropagation(); onZoomClick?.(asset.imageUrl) }} />
            : asset.has ? <span className="text-emerald-400 text-body-xs">✓</span>
              : <span className="text-caption text-muted">+ 待生成</span>}
      </div>
      {/* 三点菜单（挂卡片根级，覆盖图片右上角；菜单向下展开不被图片区 overflow-hidden 裁剪） */}
      <div className="absolute top-1 right-1 z-50 shrink-0" ref={moreRef}>
        <button className="text-white/80 hover:text-white bg-black/30 hover:bg-black/50 rounded p-0.5" title="更多" onClick={(e) => { e.stopPropagation(); setMore(!more) }}><MoreVertical size={13} /></button>
        {more && (
          <div className="absolute right-0 top-full mt-1 bg-surface-menu border border-edge rounded-lg shadow-2xl py-1 min-w-[120px]" onClick={(e) => e.stopPropagation()}>
            <MenuItem icon={<Wand2 size={11} />} text="生成" onClick={() => { callbacks.onGenerateAssetImage?.(asset.id); setMore(false) }} />
            <MenuItem icon={<Upload size={11} />} text="上传图片" onClick={() => { setMore(false); fileRef.current?.click() }} />
            <MenuItem icon={<ImageIcon size={11} />} text="从素材库选择" onClick={() => { setMore(false); onPickFromLibrary?.() }} />
            {asset.imageStatus === 'failed' && <MenuItem icon={<RefreshCw size={11} />} text="重试上传" onClick={() => { onRetry(); setMore(false) }} />}
            <MenuItem icon={<Wand2 size={11} />} text="编辑提示词" onClick={() => { onEditPrompt(); setMore(false) }} />
            <div className="h-px bg-white/[0.04] my-1" />
            <MenuItem danger icon={<Trash2 size={11} />} text="删除" onClick={() => { onDel(); setMore(false) }} />
          </div>
        )}
      </div>
      {/* 信息区（在下）：名称 + 选中框（同一行） */}
      <div className="flex items-center justify-between gap-1 mt-1.5">
        <span className="text-caption-sm text-primary truncate min-w-0 cursor-pointer" onClick={onOpen}>{asset.name}</span>
        <input type="checkbox" checked={!!asset.picked} onChange={onTogglePick} className="nodrag cursor-pointer shrink-0" />
      </div>
      {/* 图片上传状态：不再显示任何提示行（图显示没显示一眼可见） */}
      {/* 本地图片选择（「上传图片」菜单项触发，只接受图片） */}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePickFile} />
    </div>
  )
}

function MenuItem({ icon, text, onClick, danger }: { icon: React.ReactNode; text: string; onClick: () => void; danger?: boolean }) {
  return (
    <button className={`flex items-center gap-2 w-full px-2.5 py-1.5 text-caption-sm text-left ${danger ? 'text-red-400 hover:bg-red-500/10' : 'text-body hover:bg-surface-hover'}`} onClick={onClick}>{icon}{text}</button>
  )
}

/** 右侧固定编辑面板（选中资产的名称/描述/提示词 + 生图），不遮挡资产卡片。
 *  作为 StepAssets 右侧固定栏常驻，点资产卡切换编辑对象；含改名联动 @旧名→@新名。 */
function AssetPanel({ asset, idx, data, updateData, onGen, onClose }: {
  asset: ScriptBoxData['assets'][number]
  idx: number
  data: ScriptBoxData
  updateData: ScriptBoxUpdateData
  onGen: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(asset.name)
  const [desc, setDesc] = useState(asset.description)
  const [prompt, setPrompt] = useState(asset.prompt)

  const save = (alsoGen) => {
    // 改名联动：@旧名 → @新名（纯函数收口，避免内联 split('@') 重复实现）
    let shots = name !== asset.name ? renameAssetRefs(data.shots || [], asset.name, name) : data.shots || []
    const assets = (data.assets || []).map((a, i) => (i === idx ? { ...a, name, description: desc, prompt: prompt || ZgPrompt(a.category, desc, data.globalStyle, resolveAssetTemplates(data.playbookId)) } : a))
    updateData({ assets, shots })
    if (alsoGen) onGen()
  }

  return (
    <div className="flex flex-col gap-3 text-caption-sm">
      <div className="flex items-center justify-between">
        <div className="text-body-xs text-primary font-medium">编辑资产</div>
        <button className="text-muted hover:text-white text-sm" title="收起" onClick={onClose}>×</button>
      </div>
      <div className="flex flex-col gap-3">
        <label className="text-secondary">名称
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full mt-1 bg-surface-strong border border-edge rounded-md px-2 py-1.5 text-primary outline-none nodrag" />
        </label>
        <label className="text-secondary">描述
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full mt-1 h-20 bg-surface-strong border border-edge rounded-md p-2 text-primary outline-none custom-scrollbar nodrag nowheel" />
        </label>
        <label className="text-secondary">生图提示词
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full mt-1 h-40 bg-surface-strong border border-edge rounded-md p-2 text-primary outline-none custom-scrollbar nodrag nowheel" />
        </label>
      </div>
      <div className="flex gap-2">
        <button className="flex-1 py-2 bg-surface-hover hover:bg-surface-hover-2b text-primary text-body-xs rounded-lg" onClick={() => save(false)}>保存</button>
        <button
          className="flex-1 py-2 bg-surface-active-2 hover:bg-surface-raised-2 text-primary text-body-xs rounded-lg flex items-center justify-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={asset.loading}
          onClick={() => save(true)}
        >
          {asset.loading ? <Loader2 size={13} className="animate-spin" /> : null}
          {asset.loading ? '生成中…' : '保存并生图'}
        </button>
      </div>
    </div>
  )
}
