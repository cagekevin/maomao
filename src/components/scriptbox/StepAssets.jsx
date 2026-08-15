import React, { useState } from 'react'
import { Loader2, Wand2, User, Image as ImageIcon, Package, Plus, MoreVertical, Upload, RefreshCw, Trash2 } from 'lucide-react'
import { ZgPrompt } from '../base/scriptBoxPrompts.js'
import { useOutsideClick } from '../base/hooks.js'

/**
 * 剧本盒子 步骤2「准备资产」：角色/场景/道具三栏 + 资产卡(选中框/视频上传状态/more菜单) +
 * 工具栏(风格/生图模型/上传全部/批量生图带选中数) + 抽屉编辑 + 双击提示词面板（复刻原型 renderV2）。
 *
 * 数据只读 node.data：
 *  - assets[].picked  选中态（批量用，存 node.data）
 *  - assets[].videoStatus  uploading/uploaded/failed
 *  - pickedCount 全局选中数（存 node.data）
 * 编辑经 updateData；生成/上传经 callbacks.onGenerateAssetImage / onGenerateAllAssetImages /
 * onUploadAllVideoAssets / onRetryVideoAssetUpload。
 */
export default function StepAssets({ data, updateData, callbacks }) {
  const d = data || {}
  const assets = d.assets || []
  const pickedCount = d.pickedCount || 0
  // 当前选中编辑的资产 idx（点资产卡选中；默认 null 显示空态，不遮挡任何资产）
  const [editIdx, setEditIdx] = useState(null)

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
    const next = assets.filter((a) => a.id !== id)
    updateData({ assets: next, pickedCount: next.filter((a) => a.picked).length })
  }
  // 批量生图：用选中集（未选则全部无图资产），走真批量引擎（onGenerateAllAssetImages）
  const batchGen = () => {
    const picked = assets.filter((a) => a.picked)
    const target = picked.length ? picked.map((a) => a.id) : undefined
    callbacks.onGenerateAllAssetImages?.(target)
  }
  // 上传全部素材
  const uploadAll = () => callbacks.onUploadAllVideoAssets?.()
  // 上传单个资产视频：走真重试上传引擎（onRetryVideoAssetUpload，内部标记 uploading→uploaded）
  const uploadOne = (id) => callbacks.onRetryVideoAssetUpload?.(id)
  const retryUpload = (id) => callbacks.onRetryVideoAssetUpload?.(id)

  return (
    <div className="flex flex-col gap-3">
      {/* 工具栏（统一风格/模型已在设置里配置，这里只保留素材操作，按钮靠左顶对齐） */}
      <div className="flex flex-wrap items-center gap-2 text-caption-sm text-gray-400">
        <button className="flex items-center gap-1 px-2 py-1 text-caption text-gray-300 bg-surface-1 hover:bg-surface-hover rounded" onClick={uploadAll}><Upload size={10} /> 上传全部素材</button>
        <button className="flex items-center gap-1 px-2 py-1 text-caption text-gray-300 bg-surface-1 hover:bg-surface-hover rounded" onClick={batchGen}>
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
                <div className="flex items-center gap-1.5 text-caption-sm text-gray-300">{c.icon}<span>{c.n}</span><span className="text-gray-500">{list.length}</span></div>
                <div className="grid grid-cols-3 gap-1.5">
                  {list.map((a) => {
                    const gi = assets.indexOf(a)
                    return (
                      <AssetCard
                        key={a.id} asset={a} idx={gi} data={d}
                        updateData={updateData} callbacks={callbacks}
                        selected={editIdx === gi}
                        onOpen={() => setEditIdx(gi)}
                        onTogglePick={() => togglePick(a.id)}
                        onDel={() => { delAsset(a.id); if (editIdx === gi) setEditIdx(null) }}
                        onUpload={() => uploadOne(a.id)}
                        onRetry={() => retryUpload(a.id)}
                        onEditPrompt={() => setEditIdx(gi)}
                      />
                    )
                  })}
                  <button className="flex items-center justify-center gap-1 h-9 w-full border border-dashed border-edge hover:border-edge-strong rounded-lg text-caption text-gray-500 hover:text-gray-300" onClick={() => { const id = addAsset(updateData, c.k, assets); setEditIdx(id) }}>
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
            <div className="flex flex-col items-center justify-center h-full text-gray-600 text-caption-sm gap-2">
              <Package size={20} className="text-gray-700" />
              点击左侧资产卡片，在此编辑
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** 新增资产（按当前风格生成 prompt），返回新资产的 index（数组末尾） */
function addAsset(updateData, cat, assets) {
  const name = `${cat === 'character' ? '角色' : cat === 'scene' ? '场景' : '道具'}${assets.length + 1}`
  const newAsset = {
    id: `${cat}-${Date.now()}`,
    category: cat,
    name, description: '', prompt: '',
    imageUrl: '', thumbnailUrl: '',
    has: false, loading: false, picked: false, videoStatus: ''
  }
  updateData({ assets: [...assets, newAsset] })
  return assets.length // 新增后位于数组末尾，旧长度即新 index
}

/** 资产卡：缩略图 + 选中框 + 名称/描述 + 视频状态 + more 菜单 */
function AssetCard({ asset, idx, data, updateData, callbacks, onOpen, onTogglePick, onDel, onUpload, onRetry, onEditPrompt, selected }) {
  const [more, setMore] = useState(false)
  const moreRef = React.useRef(null)
  useOutsideClick(moreRef, more, () => setMore(false))

  return (
    <div className={`w-full min-w-0 flex items-center gap-2 p-2 bg-[#181818] border rounded-lg transition-colors ${selected ? 'border-blue-500/70' : asset.picked ? 'border-emerald-500/60' : 'border-edge-faint hover:border-edge-muted'}`}>
      {/* 选中框 */}
      <div className="flex flex-col items-center gap-1">
        <input type="checkbox" checked={!!asset.picked} onChange={onTogglePick} className="nodrag cursor-pointer" />
      </div>
      {/* 缩略图（点击打开抽屉） */}
      <div className="w-11 h-11 shrink-0 rounded-md overflow-hidden bg-surface-1 flex items-center justify-center cursor-pointer" onClick={onOpen}>
        {asset.loading ? <Loader2 size={13} className="animate-spin text-gray-400" />
          : asset.imageUrl ? <img src={asset.imageUrl} alt={asset.name} className="w-full h-full object-cover" />
            : asset.has ? <span className="text-emerald-400 text-body-xs">✓</span>
              : <span className="text-caption text-gray-500">+ 待生成</span>}
      </div>
      <div className="min-w-0 flex-1 cursor-pointer" onClick={onOpen}>
        <div className="text-caption-sm text-gray-200 truncate">{asset.name}</div>
        <div className="text-meta text-gray-500 truncate">{asset.description || '双击编辑'}</div>
        {/* 视频上传状态 */}
        {asset.videoStatus && (
          <div className={`flex items-center gap-1 text-meta mt-0.5 ${asset.videoStatus === 'uploaded' ? 'text-emerald-400' : asset.videoStatus === 'failed' ? 'text-red-400' : 'text-yellow-400'}`}>
            {asset.videoStatus === 'uploading' && <Loader2 size={8} className="animate-spin" />}
            {asset.videoStatus === 'uploaded' ? '✓ 视频已上传' : asset.videoStatus === 'failed' ? '✗ 上传失败' : '上传中…'}
          </div>
        )}
      </div>
      {/* 生成按钮 */}
      <button className="text-gray-600 hover:text-gray-300 p-0.5" title="生成参考图" onClick={(e) => { e.stopPropagation(); callbacks.onGenerateAssetImage?.(asset.id) }}><Wand2 size={11} /></button>
      {/* more 菜单 */}
      <div className="relative" ref={moreRef}>
        <button className="text-gray-600 hover:text-gray-300 p-0.5" title="更多" onClick={(e) => { e.stopPropagation(); setMore(!more) }}><MoreVertical size={11} /></button>
        {more && (
          <div className="absolute right-0 top-full mt-1 z-50 bg-surface-menu border border-edge rounded-lg shadow-2xl py-1 min-w-[120px]" onClick={(e) => e.stopPropagation()}>
            <MenuItem icon={<RefreshCw size={11} />} text="重新生成" onClick={() => { callbacks.onGenerateAssetImage?.(asset.id); setMore(false) }} />
            <MenuItem icon={<Upload size={11} />} text="上传视频" onClick={() => { onUpload(); setMore(false) }} />
            {asset.videoStatus === 'failed' && <MenuItem icon={<RefreshCw size={11} />} text="重试上传" onClick={() => { onRetry(); setMore(false) }} />}
            <MenuItem icon={<Wand2 size={11} />} text="编辑提示词" onClick={() => { onEditPrompt(); setMore(false) }} />
            <div className="h-px bg-white/[0.04] my-1" />
            <MenuItem danger icon={<Trash2 size={11} />} text="删除" onClick={() => { onDel(); setMore(false) }} />
          </div>
        )}
      </div>
    </div>
  )
}

function MenuItem({ icon, text, onClick, danger }) {
  return (
    <button className={`flex items-center gap-2 w-full px-2.5 py-1.5 text-caption-sm text-left ${danger ? 'text-red-400 hover:bg-red-500/10' : 'text-gray-300 hover:bg-surface-hover'}`} onClick={onClick}>{icon}{text}</button>
  )
}

/** 右侧固定编辑面板（选中资产的名称/描述/提示词 + 生图），不遮挡资产卡片。
 *  作为 StepAssets 右侧固定栏常驻，点资产卡切换编辑对象；含改名联动 @旧名→@新名。 */
function AssetPanel({ asset, idx, data, updateData, onGen, onClose }) {
  const [name, setName] = useState(asset.name)
  const [desc, setDesc] = useState(asset.description)
  const [prompt, setPrompt] = useState(asset.prompt)

  const save = (alsoGen) => {
    let shots = data.shots || []
    if (name !== asset.name) {
      shots = shots.map((s) => ({ ...s, description: (s.description || '').split('@').map((seg, k) => k ? (seg.startsWith(asset.name) ? '@' + name + seg.slice(asset.name.length) : '@' + seg) : seg).join('') }))
    }
    const assets = (data.assets || []).map((a, i) => (i === idx ? { ...a, name, description: desc, prompt: prompt || ZgPrompt(a.category, desc, data.globalStyle, data.customAssetTemplates) } : a))
    updateData({ assets, shots })
    if (alsoGen) onGen()
  }

  return (
    <div className="flex flex-col gap-3 text-caption-sm">
      <div className="flex items-center justify-between">
        <div className="text-body-xs text-gray-200 font-medium">编辑资产</div>
        <button className="text-gray-500 hover:text-white text-sm" title="收起" onClick={onClose}>×</button>
      </div>
      <div className="flex flex-col gap-3">
        <label className="text-gray-400">名称
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full mt-1 bg-surface-strong border border-edge rounded-md px-2 py-1.5 text-gray-200 outline-none nodrag" />
        </label>
        <label className="text-gray-400">描述
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full mt-1 h-20 bg-surface-strong border border-edge rounded-md p-2 text-gray-200 outline-none custom-scrollbar nodrag nowheel" />
        </label>
        <label className="text-gray-400">生图提示词
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full mt-1 h-40 bg-surface-strong border border-edge rounded-md p-2 text-gray-200 outline-none custom-scrollbar nodrag nowheel" />
        </label>
      </div>
      <div className="flex gap-2">
        <button className="flex-1 py-2 bg-[#27272a] hover:bg-[#313135] text-gray-200 text-body-xs rounded-lg" onClick={() => save(false)}>保存</button>
        <button className="flex-1 py-2 bg-[#3a3a3a] hover:bg-[#454545] text-gray-200 text-body-xs rounded-lg" onClick={() => save(true)}>保存并生图</button>
      </div>
    </div>
  )
}
