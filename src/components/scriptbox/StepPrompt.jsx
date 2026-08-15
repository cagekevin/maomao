import React, { useState } from 'react'
import { Loader2, Image as ImageIcon, Video, LayoutGrid, Columns2, RefreshCw, Link2, Wand2, Copy, Check } from 'lucide-react'
import { dialogueText, IMAGE_GEN_TYPES, IMAGE_GEN_DEFAULT } from '../base/scriptBoxPrompts.js'
import CustomHandle from '../CustomHandle.jsx'

/**
 * 剧本盒子 步骤3「合成提示词」：列表/单镜头双视图 + 每镜卡片（生图 prompt/生视频 prompt 双击编辑 + 宫格选择 + 生成）+
 * 已连线面板（复刻原型 renderV3）。
 */
export default function StepPrompt({ data, updateData, callbacks }) {
  const d = data || {}
  const shots = d.shots || []
  const [view, setView] = useState('list')
  const [editing, setEditing] = useState(null) // { idx, field, title }
  const [editVal, setEditVal] = useState('')
  const [gridPick, setGridPick] = useState({}) // idx -> grid 模式
  const [selShots, setSelShots] = useState(new Set())
  const [genType, setGenType] = useState({}) // idx -> 选中的生图类型
  const [copied, setCopied] = useState({}) // idx -> 是否已复制
  const [singleIdx, setSingleIdx] = useState(0) // 单镜头视图：当前查看的镜头 idx

  const patchShot = (idx, field, val) => {
    const shots2 = shots.map((s, i) => {
      if (i !== idx) return s
      return typeof field === 'object' ? { ...s, ...field } : { ...s, [field]: val }
    })
    updateData({ shots: shots2 })
  }
  const toggleSel = (idx) => {
    const s2 = new Set(selShots)
    if (s2.has(idx)) s2.delete(idx)
    else s2.add(idx)
    setSelShots(s2)
  }

  const openField = (idx, field, title) => { setEditing({ idx, field, title }); setEditVal(String(shots[idx]?.[field] ?? '')) }
  const commitField = () => { if (editing) patchShot(editing.idx, editing.field, editVal); setEditing(null) }

  const cardFor = (s, i) => (
    <div className="relative flex flex-col gap-2 p-3 bg-[#181818] border border-edge-faint rounded-lg">
      {/* 每镜头独立连线端口（复刻官方 c_.jsx：shot-${id} source，右侧，用统一默认端口外观） */}
      <CustomHandle position="right" variant="small" handleId={`shot-${s.id}`} top="50%" />
      <div className="flex items-center gap-2 text-caption-sm">
        <span className="px-1.5 py-0.5 bg-surface-hover rounded text-gray-300">镜头 {s.index}</span>
        <span className="text-gray-500">{s.duration}</span>
        {s.connImg && <span className="text-emerald-400">图✓</span>}
        {s.connVid && <span className="text-blue-400">视频✓</span>}
        <div className="flex-1" />
        <button className="text-gray-500 hover:text-white" title={selShots.has(i) ? '取消选择' : '选择'} onClick={() => toggleSel(i)}>{selShots.has(i) ? '☑' : '☐'}</button>
      </div>
      <div className="text-caption-sm text-gray-400 leading-relaxed">{s.description}</div>
      {(s.dialogue || []).length > 0 && <div className="text-caption text-gray-500 italic">「{dialogueText(s.dialogue)}」</div>}

      {/* prompt 区：左侧生图提示词（AI 生图在下方），右侧生视频提示词（操作按钮在下方），左右均衡 */}
      <div className="grid grid-cols-2 gap-2">
        {/* 左侧：生图提示词 + 生图按钮 + AI 生图 */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <PromptBox label="生图提示词" text={s.prompt} loading={s.promptLoading} onEdit={() => openField(i, 'prompt', '生图提示词')} onGen={() => handleGenImg(callbacks, patchShot, i, s.id)} />
          {/* AI 生成提示词（关键帧/四宫格/九宫格/俯视调度图，均属生图），样式与重新生成/连下游一致 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-1">
              {/* 生图类型下拉（关键帧/四宫格/九宫格/俯视调度图） */}
              <select
                value={genType[i] || IMAGE_GEN_DEFAULT}
                onChange={(e) => setGenType((g) => ({ ...g, [i]: e.target.value }))}
                className="px-2 py-1 text-caption text-gray-300 bg-surface-1 hover:bg-surface-hover rounded outline-none nodrag cursor-pointer"
              >
                {Object.entries(IMAGE_GEN_TYPES).map(([key, t]) => (
                  <option key={key} value={key} className="bg-surface-menu text-gray-300">{t.label}</option>
                ))}
              </select>
              {s.imgGenLoading ? (
                <Loader2 size={12} className="animate-spin text-gray-400" />
              ) : (
                <button
                  className="flex items-center gap-1 px-2 py-1 text-caption text-gray-300 bg-surface-1 hover:bg-surface-hover rounded"
                  onClick={() => callbacks.onGenerateShotImage?.(s.id, genType[i] || IMAGE_GEN_DEFAULT)}
                >
                  <Wand2 size={10} /> 生成提示词
                </button>
              )}
              {/* 生成完提示词 → 生图（连生图下游） */}
              <button className="flex items-center gap-1 px-2 py-1 text-caption text-gray-300 bg-surface-1 hover:bg-surface-hover rounded" onClick={() => callbacks.onConnectShot?.(s.id, 'image')}><ImageIcon size={10} /> 生图</button>
            </div>
            {s.imgGen && !s.imgGenLoading && (
              <div className="flex flex-col gap-1 bg-[#131313] rounded p-2 border border-edge-faint">
                <div className="flex items-center gap-1.5">
                  <span className="text-meta text-gray-400 px-1 py-px rounded bg-surface-1">{s.imgGen.label}</span>
                  <span className="text-meta text-gray-600">{new Date(s.imgGen.ts).toLocaleTimeString()}</span>
                  <div className="flex-1" />
                  <button className="flex items-center gap-0.5 text-meta text-gray-400 hover:text-white" onClick={() => { navigator.clipboard?.writeText(s.imgGen.prompt).catch(() => {}); setCopied((c) => ({ ...c, [i]: true })); setTimeout(() => setCopied((c) => ({ ...c, [i]: false })), 1200) }}>
                    {copied[i] ? <Check size={9} className="text-emerald-400" /> : <Copy size={9} />} {copied[i] ? '已复制' : '复制'}
                  </button>
                  <button className="px-1.5 py-0.5 text-meta rounded bg-surface-hover hover:bg-surface-hover-strong text-gray-300" onClick={() => patchShot(i, 'prompt', s.imgGen.prompt)}>应用到生图</button>
                </div>
                <div className="text-caption text-gray-300 leading-relaxed line-clamp-4 whitespace-pre-wrap">{s.imgGen.prompt}</div>
              </div>
            )}
          </div>
        </div>
        {/* 右侧：生视频提示词 + 操作 */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <PromptBox label="生视频提示词" text={s.videoPrompt} loading={s.promptLoading} onEdit={() => openField(i, 'videoPrompt', '生视频提示词')} onGen={() => handleGenVid(callbacks, patchShot, i, s.id)} />
          <div className="flex gap-1.5">
            <button className="flex items-center gap-1 px-2 py-1 text-caption text-gray-300 bg-surface-1 hover:bg-surface-hover rounded" onClick={() => callbacks.onGenerateShotPrompts?.([s.id])}><RefreshCw size={10} /> 重新生成</button>
            <button className="flex items-center gap-1 px-2 py-1 text-caption text-gray-300 bg-surface-1 hover:bg-surface-hover rounded" onClick={() => callbacks.onConnectShot?.(s.id, 'video')}><Video size={10} /> 生视频</button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      {/* 视图切换 + 批量 */}
      <div className="flex items-center gap-2">
        <div className="flex bg-[#181818] rounded-lg p-0.5">
          <button className={`flex items-center gap-1.5 px-3 py-1 text-caption-sm rounded-md ${view === 'list' ? 'bg-surface-hover text-white' : 'text-gray-400'}`} onClick={() => setView('list')}><Columns2 size={11} /> 列表</button>
          <button className={`flex items-center gap-1.5 px-3 py-1 text-caption-sm rounded-md ${view === 'grid' ? 'bg-surface-hover text-white' : 'text-gray-400'}`} onClick={() => setView('grid')}><LayoutGrid size={11} /> 单镜头</button>
        </div>
        <div className="flex-1" />
        {/* 批量生成提示词：一次性生成所有镜头的生图 prompt + 生视频 videoPrompt。
            真实现（引擎 onGenerateShotPrompts，对齐官方 Ir）：
              传 undefined 生成全部镜头；引擎对每个镜头用 assembleShotUser 拼 user content +
              分镜导演系统提示词（customShotPrompt 可覆盖），并发请求文本模型 chat/completions，
              返回 { prompt, videoPrompt } 写回各 shot，期间 shot.promptLoading=true。 */}
        <button className="flex items-center gap-1 px-2 py-1 text-caption text-gray-300 bg-surface-1 hover:bg-surface-hover rounded" onClick={() => callbacks.onGenerateShotPrompts?.()}>
          <RefreshCw size={10} /> 批量生成提示词
        </button>
        {selShots.size > 0 && (
          <button className="px-2 py-1 text-caption text-gray-300 bg-surface-1 hover:bg-surface-hover rounded" onClick={() => callbacks.onConnectShots?.([...selShots].map((i) => shots[i].id))}>
            连选中的 {selShots.size} 镜下游
          </button>
        )}
        <span className="text-caption-sm text-gray-500">{shots.length} 镜</span>
      </div>

      {/* 内容 */}
      {shots.length === 0 ? (
        <div className="text-center py-12 text-gray-600 text-body-xs">暂无分镜，请先在「确认镜头」步骤生成</div>
      ) : view === 'list' ? (
        /* 列表视图：所有镜头小卡片纵向排列 */
        <div className="flex flex-col gap-2 min-h-0">{shots.map((s, i) => cardFor(s, i))}</div>
      ) : (
        /* 单镜头视图：一次一个大镜头，‹ 镜N/N › 切换（复刻官方 le==='single'） */
        <div className="flex flex-col gap-3">
          {/* 切换器 + 当前镜头顶部操作 */}
          <div className="flex items-center gap-2">
            <button
              className="px-2.5 py-1 text-base leading-none text-gray-500 hover:text-white disabled:opacity-30 disabled:hover:text-gray-500"
              disabled={singleIdx <= 0}
              onClick={() => setSingleIdx((v) => Math.max(0, v - 1))}
            >‹</button>
            <span className="text-base-sm text-white font-medium">镜{shots[singleIdx]?.index}</span>
            <span className="text-body-xs text-gray-500">/ {shots.length}</span>
            <button
              className="px-2.5 py-1 text-base leading-none text-gray-500 hover:text-white disabled:opacity-30 disabled:hover:text-gray-500"
              disabled={singleIdx >= shots.length - 1}
              onClick={() => setSingleIdx((v) => Math.min(shots.length - 1, v + 1))}
            >›</button>
            <div className="flex-1" />
            {/* 当前镜头操作：生成提示词 / 生图 / 生视频（统一深色按钮，与整体设计语言一致） */}
            <button className="flex items-center gap-1 px-2.5 py-1.5 text-caption-sm text-gray-200 bg-surface-hover hover:bg-surface-hover-strong rounded" onClick={() => callbacks.onGenerateShotPrompts?.([shots[singleIdx].id])}>
              <RefreshCw size={11} /> {shots[singleIdx]?.prompt || shots[singleIdx]?.videoPrompt ? '重生成提示词' : '生成提示词'}
            </button>
            <button className="flex items-center gap-1 px-2.5 py-1.5 text-caption-sm text-gray-200 bg-surface-hover hover:bg-surface-hover-strong border border-edge rounded" onClick={() => callbacks.onConnectShot?.(shots[singleIdx].id, 'image')}>
              <ImageIcon size={11} /> 生图
            </button>
            <button className="flex items-center gap-1 px-2.5 py-1.5 text-caption-sm text-gray-200 bg-surface-hover hover:bg-surface-hover-strong border border-edge rounded" onClick={() => callbacks.onConnectShot?.(shots[singleIdx].id, 'video')}>
              <Video size={11} /> 生视频
            </button>
          </div>
          {shots[singleIdx] && cardFor(shots[singleIdx], singleIdx)}
        </div>
      )}

      {/* 已连线面板 */}
      {(d.connected || []).length > 0 && (
        <div className="text-caption-sm text-gray-500 border-t border-edge-faint pt-2">
          <div className="mb-1 text-gray-400">已连线</div>
          {d.connected.map((c, i) => <div key={i} className="text-gray-500">镜头{c.shotId} · {c.type} · {c.nodeId}</div>)}
        </div>
      )}

      {/* 双击编辑弹窗（相对剧本盒子主容器定位，节点内部面板） */}
      {editing && (
        <div className="absolute inset-0 z-modal flex items-center justify-center bg-black/50" onClick={() => setEditing(null)}>
          <div className="bg-surface-menu border border-edge rounded-xl p-4 w-[520px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-body-xs text-gray-300 mb-2">编辑{editing.title}</div>
            <textarea autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)} className="w-full h-36 bg-surface-strong border border-edge rounded-lg p-2 text-body-xs text-gray-200 outline-none custom-scrollbar nodrag nowheel" />
            <div className="flex justify-end gap-2 mt-3">
              <button className="px-3 py-1 text-caption-sm text-gray-400 hover:text-white" onClick={() => setEditing(null)}>取消</button>
              <button className="px-3 py-1 text-caption-sm bg-surface-hover hover:bg-surface-hover-strong text-gray-200 rounded-md" onClick={commitField}>确定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** 提示词展示 + 生成按钮 */
function PromptBox({ label, text, loading, onEdit, onGen }) {
  return (
    <div className="flex flex-col gap-1 bg-[#131313] rounded p-2">
      <div className="flex items-center justify-between">
        <span className="text-caption text-gray-500">{label}</span>
        <button className="flex items-center gap-0.5 text-caption text-gray-400 hover:text-white" onClick={onGen}>{loading ? <Loader2 size={10} className="animate-spin" /> : <ImageIcon size={10} />} 生成</button>
      </div>
      <div className="text-caption text-gray-400 leading-relaxed line-clamp-3 cursor-text hover:bg-surface rounded px-1 -mx-1" onDoubleClick={onEdit} title="双击编辑">
        {text || <span className="text-gray-600">双击编辑</span>}
      </div>
    </div>
  )
}

/** 生成图片：连生图下游（真实现，走 onConnectShot('image') 建 promptNode） */
function handleGenImg(callbacks, patchShot, i, shotId) {
  callbacks.onConnectShot?.(shotId, 'image')
}

/** 生成视频：连生视频下游（真实现，走 onConnectShot('video') 建 discountVideoNode） */
function handleGenVid(callbacks, patchShot, i, shotId) {
  callbacks.onConnectShot?.(shotId, 'video')
}
