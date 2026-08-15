import React, { useState, useMemo } from 'react'
import { Search, Filter, MoreVertical, Copy, Play, RotateCw, Trash2, X, RefreshCw, ChevronDown, Download, Image as ImageIcon } from 'lucide-react'
import { useTasks, statusDotClass, statusLabel, typeLabel, removeTask, retryTask, clearTasksBy, clearAllTasks } from './taskStore.js'
import { showToast } from './toastStore.js'

const TYPE_ICON = {
  image: ImageIcon,
  video: Play,
  text: ImageIcon
}

// 状态筛选（对齐官方）
const STATUS_FILTERS = [
  { key: '', label: '所有状态' },
  { key: 'running', label: '生成中' },
  { key: 'completed', label: '已完成' },
  { key: 'failed', label: '失败' }
]
const TYPE_FILTERS = [
  { key: '', label: '所有类型' },
  { key: 'image', label: '生图' },
  { key: 'video', label: '视频' },
  { key: 'text', label: '文本' }
]

function fmtTime(ts) {
  try { return new Date(ts).toLocaleString('zh-CN', { hour12: false }) } catch { return '' }
}

/**
 * 任务中心（对齐官方 Ln.jsx + jn.jsx 卡片）。
 * Header：标题+总数+过滤toggle+关闭；过滤区：搜索/状态下拉/类型下拉/一键清理；
 * 卡片：状态圆点+文案 · 类型+模型 · 操作；提示词；时间；进度条；错误块；缩略图；更多菜单。
 */
export default function TaskCenter() {
  const tasks = useTasks()
  const [showFilter, setShowFilter] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [moreOpenId, setMoreOpenId] = useState(null)
  const [cleanOpen, setCleanOpen] = useState(false)
  // 大图预览（点击缩略图打开，右下角显示像素；官方 Ln.jsx 同款交互）
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewDims, setPreviewDims] = useState(null) // { w, h }

  const filtered = useMemo(() => {
    let list = tasks
    if (statusFilter === 'running') list = list.filter((t) => t.status === 'running' || t.status === 'pending')
    else if (statusFilter) list = list.filter((t) => t.status === statusFilter)
    if (typeFilter) list = list.filter((t) => t.type === typeFilter)
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase()
      list = list.filter((t) => (t.prompt || '').toLowerCase().includes(kw) || (t.channelName || '').toLowerCase().includes(kw))
    }
    return list
  }, [tasks, statusFilter, typeFilter, keyword])

  const runningCount = tasks.filter((t) => t.status === 'running' || t.status === 'pending').length
  const failedCount = tasks.filter((t) => t.status === 'failed').length
  const completedCount = tasks.filter((t) => t.status === 'completed').length

  const copyPrompt = (t) => {
    try { navigator.clipboard.writeText(t.prompt || ''); showToast('已复制提示词', { type: 'success' }) } catch { /* ignore */ }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 过滤工具栏（标题由 LeftPanel 外壳提供；这里只放过滤与清理） */}
      <div className="h-[44px] bg-surface-active border-b border-edge-faint flex items-center px-3 gap-2 flex-shrink-0">
        <button
          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-body-xs transition-colors cursor-pointer border-none ${showFilter ? 'bg-surface-hover-strong text-white' : 'text-secondary hover:text-white hover:bg-surface-hover-2'}`}
          onClick={() => setShowFilter((v) => !v)}
        >
          <Filter size={14} /> 过滤
        </button>
        <span className="text-caption-sm text-muted">{runningCount} 生成中 · {failedCount} 失败</span>
        <div className="ml-auto flex items-center gap-1">
          <button className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-caption-sm text-muted hover:text-white hover:bg-surface-hover-2 transition-colors cursor-pointer border-none" onClick={() => setCleanOpen((v) => !v)}>
            <Trash2 size={12} /> 清理 <ChevronDown size={11} />
          </button>
          <div className="relative">
            {cleanOpen && (
              <div className="absolute right-0 top-full mt-1 bg-surface-1 border border-edge rounded-lg shadow-xl p-1 z-20 w-44 nowheel nopan nodrag">
                <CleanItem label={`清理失败任务 (${failedCount})`} onClick={() => { clearTasksBy((t) => t.status === 'failed'); setCleanOpen(false) }} />
                <CleanItem label={`清理已完成任务 (${completedCount})`} onClick={() => { clearTasksBy((t) => t.status === 'completed'); setCleanOpen(false) }} />
                <CleanItem label={`清空全部任务 (${tasks.length})`} onClick={() => { clearAllTasks(); setCleanOpen(false) }} danger />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 过滤区 */}
      {showFilter && (
        <div className="px-4 py-3 border-b border-edge-subtle flex flex-col gap-2.5 flex-shrink-0 bg-[#191919]">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索提示词或渠道..."
              className="w-full h-[32px] bg-input border border-edge rounded-lg pl-8 pr-3 text-primary text-body-xs outline-none focus:border-edge-strong box-border"
            />
          </div>
          <div className="flex items-center gap-2">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="flex-1 h-[32px] bg-input border border-edge rounded-lg px-2 text-body-xs text-primary outline-none focus:border-edge-strong box-border">
              {STATUS_FILTERS.map((f) => <option key={f.key || 's_all'} value={f.key}>{f.label}</option>)}
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="flex-1 h-[32px] bg-input border border-edge rounded-lg px-2 text-body-xs text-primary outline-none focus:border-edge-strong box-border">
              {TYPE_FILTERS.map((f) => <option key={f.key || 't_all'} value={f.key}>{f.label}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* 任务列表 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2.5 py-2">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center text-faint text-sm">暂无任务</div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                moreOpen={moreOpenId === t.id}
                onToggleMore={() => setMoreOpenId(moreOpenId === t.id ? null : t.id)}
                onCopy={() => copyPrompt(t)}
                onRetry={() => {
                  const ok = retryTask(t.id)
                  setMoreOpenId(null)
                  showToast(ok ? '已重新生成' : '找不到对应节点，请在画布上重新生成', { type: ok ? 'info' : 'warning' })
                }}
                onRemove={() => { removeTask(t.id); setMoreOpenId(null); showToast('已删除', { type: 'success' }) }}
                onPreview={(url) => { setPreviewUrl(url); setPreviewDims(null) }}
              />
            ))}
          </div>
        )}
      </div>

      {/* 大图预览弹窗（点击缩略图打开；右下角显示像素，如 1920×1080）；图片可拖拽到画布成为节点 */}
      {previewUrl && (
        <div className="absolute inset-0 z-20 bg-black/85 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewUrl}
              alt="预览"
              draggable
              onDragStart={(e) => {
                // 拖到画布时复用「URL 文本拖入」通道（useAssetDropPaste.onDrop → isAssetUrl → imageNode）
                try { e.dataTransfer.setData('text/plain', previewUrl); e.dataTransfer.effectAllowed = 'copy' } catch { /* ignore */ }
              }}
              className="max-h-[80vh] max-w-full rounded-lg object-contain cursor-grab active:cursor-grabbing"
              onLoad={(e) => {
                const el = e.currentTarget
                if (el.naturalWidth && el.naturalHeight) setPreviewDims({ w: el.naturalWidth, h: el.naturalHeight })
              }}
            />
            {/* 拖拽提示角标 */}
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white/80 text-caption-sm pointer-events-none select-none">
              按住拖到画布添加
            </span>
            {/* 右下角像素角标 */}
            {previewDims && (
              <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-white text-caption-sm pointer-events-none">
                {previewDims.w}×{previewDims.h}
              </span>
            )}
            <button className="absolute top-2 right-2 w-8 h-8 rounded-md bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors cursor-pointer border-none" onClick={() => setPreviewUrl(null)} title="关闭">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CleanItem({ label, onClick, danger }) {
  return (
    <button className={`w-full flex items-center px-2 py-1.5 rounded-md text-caption-sm transition-colors cursor-pointer border-none text-left ${danger ? 'text-red-400 hover:bg-red-500/10' : 'text-[#bbb] hover:bg-surface-hover-2 hover:text-white'}`} onClick={onClick}>
      {label}
    </button>
  )
}

// 单条任务卡片（对齐官方 jn.jsx）
function TaskCard({ task, moreOpen, onToggleMore, onCopy, onRetry, onRemove, onPreview }) {
  const [showData, setShowData] = useState(false)
  // 缩略图像素尺寸（缩略图 onLoad 读取 naturalWidth/Height，右下角显示，无需打开大图）
  const [thumbDims, setThumbDims] = useState(null)
  const TypeIcon = TYPE_ICON[task.type] || ImageIcon
  const dot = statusDotClass(task.status)
  const statusText = statusLabel(task.status, task.progress)
  const isActive = task.status === 'running' || task.status === 'pending'
  const isCompleted = task.status === 'completed'

  // 真实下载任务结果（fetch blob → a.download，可控文件名）
  const downloadResult = async (e) => {
    if (e?.stopPropagation) e.stopPropagation()
    if (!task.resultUrl) { showToast('没有可下载的结果', { type: 'warning' }); return }
    try {
      const res = await fetch(task.resultUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objUrl
      const ext = task.type === 'video' ? '.mp4' : task.type === 'text' ? '.txt' : '.png'
      a.download = `${task.modelName || 'task'}_${Date.now()}${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objUrl)
      showToast('已开始下载', { type: 'success' })
    } catch (err) {
      console.warn('[TaskCenter] 下载失败:', err?.message)
      showToast('下载失败', { type: 'error' })
    }
  }

  return (
    <div className="px-1.5 py-2 flex flex-col gap-2 border-b border-edge-subtle last:border-b-0">
      {/* 第一行：状态圆点+文案 · 类型+模型 | 操作 */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
        <span className={`text-caption-sm flex-shrink-0 ${task.status === 'failed' ? 'text-red-400' : isActive ? 'text-blue-400' : 'text-emerald-400'}`}>{statusText}</span>
        <span className="text-subtle">·</span>
        <span className="flex items-center gap-1 text-caption-sm text-body flex-shrink-0"><TypeIcon size={11} /> {typeLabel(task.type)}</span>
        {task.modelName && <span className="text-caption text-faint truncate flex-shrink-0">{task.modelName}</span>}
        <div className="ml-auto flex items-center gap-1 flex-shrink-0">
          <button className="w-6 h-6 flex items-center justify-center rounded-md text-muted hover:text-white hover:bg-surface-hover-2 transition-colors cursor-pointer border-none" title="复制提示词" onClick={onCopy}>
            <Copy size={12} />
          </button>
          {isActive ? (
            <span className="w-6 h-6 flex items-center justify-center"><RotateCw size={12} className="animate-spin text-blue-400" /></span>
          ) : (
            <button className="w-6 h-6 flex items-center justify-center rounded-md text-muted hover:text-white hover:bg-surface-hover-2 transition-colors cursor-pointer border-none" title="刷新状态" onClick={onRetry}>
              <RefreshCw size={12} />
            </button>
          )}
          <div className="relative">
            <button className="w-6 h-6 flex items-center justify-center rounded-md text-muted hover:text-white hover:bg-surface-hover-2 transition-colors cursor-pointer border-none" onClick={onToggleMore}>
              <MoreVertical size={13} />
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full mt-1 bg-surface-1 border border-edge rounded-lg shadow-xl p-1 z-30 w-40 nowheel nopan nodrag">
                {isCompleted && <MenuBtn icon={Download} label="下载结果" onClick={downloadResult} />}
                <MenuBtn icon={RefreshCw} label="再来一次" onClick={onRetry} />
                <MenuBtn icon={Copy} label="复制任务信息" onClick={onCopy} />
                <div className="h-[1px] bg-surface-hover-strong my-1" />
                <MenuBtn icon={Trash2} label="删除任务" onClick={onRemove} danger />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 提示词 */}
      <p className="text-body-xs text-secondary leading-[1.5] m-0" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {task.prompt || '(无提示词)'}
      </p>

      {/* 时间 */}
      <div className="text-caption text-faint">{fmtTime(task.createdAt)}</div>

      {/* 运行中：阶段文案 + 进度条 */}
      {isActive && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-caption text-blue-300/80">
            <span className="text-caption-sm">{task.stageLabel || '生成中…'}</span>
            <span className="text-subtle">·</span>
            <span className="text-caption-sm tabular-nums">{Math.min(100, Math.max(0, task.progress || 0))}%</span>
          </div>
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-blue-400 rounded-full transition-all duration-300" style={{ width: `${Math.min(100, Math.max(0, task.progress || 0))}%` }} />
          </div>
        </div>
      )}

      {/* 错误块 */}
      {task.status === 'failed' && task.errorMsg && (
        <div className="flex items-center gap-2 bg-red-500/5 border border-red-500/20 rounded-lg px-2 py-1.5">
          <span className="text-body-xs">⚠️</span>
          <span className="text-caption-sm text-red-400/90 truncate flex-1">{task.errorMsg}</span>
        </div>
      )}

      {/* 已完成缩略图：点击打开大图预览；图片右下角常显像素（无需打开大图）；视频点击大图播放 */}
      {isCompleted && task.resultUrl && (
        <div
          className="relative w-full h-[72px] rounded-lg overflow-hidden bg-surface-muted group cursor-pointer"
          onClick={() => { if (typeof onPreview === 'function' && task.type === 'image') onPreview(task.resultUrl) }}
        >
          {task.type === 'video' ? (
            <video src={task.resultUrl} className="w-full h-full object-cover" muted />
          ) : (
            <img
              src={task.resultUrl}
              alt={task.modelName || '结果图'}
              draggable
              onDragStart={(e) => {
                // 拖到画布时复用「URL 文本拖入」通道 → imageNode
                try { e.dataTransfer.setData('text/plain', task.resultUrl); e.dataTransfer.effectAllowed = 'copy' } catch { /* ignore */ }
              }}
              onLoad={(e) => {
                const el = e.currentTarget
                if (el.naturalWidth && el.naturalHeight) setThumbDims({ w: el.naturalWidth, h: el.naturalHeight })
              }}
              className="w-full h-full object-cover block cursor-grab active:cursor-grabbing"
            />
          )}
          {/* 图片右下角像素角标（常显） */}
          {task.type === 'image' && thumbDims && (
            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-white/90 text-[10px] leading-none pointer-events-none select-none">
              {thumbDims.w}×{thumbDims.h}
            </span>
          )}
          <button className="absolute top-1 right-1 w-6 h-6 rounded-md bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none" onClick={downloadResult} title="下载结果">
            <Download size={12} />
          </button>
        </div>
      )}

      {/* 展开请求/响应数据 */}
      <button className="flex items-center gap-1 text-caption text-faint hover:text-secondary transition-colors cursor-pointer border-none bg-transparent" onClick={() => setShowData((v) => !v)}>
        <ChevronDown size={11} className={`transition-transform ${showData ? 'rotate-180' : ''}`} /> 请求/响应数据
      </button>
      {showData && (
        <pre className="text-caption text-faint bg-surface-muted border border-[#242424] rounded-lg p-2 overflow-auto max-h-[140px] whitespace-pre-wrap">
{JSON.stringify({ id: task.id, nodeId: task.nodeId, status: task.status, type: task.type, modelName: task.modelName, channelName: task.channelName, prompt: task.prompt, createdAt: task.createdAt }, null, 2)}
        </pre>
      )}
    </div>
  )
}

function MenuBtn({ icon: Icon, label, onClick, danger }) {
  return (
    <button className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-caption-sm transition-colors cursor-pointer border-none text-left ${danger ? 'text-red-400 hover:bg-red-500/10' : 'text-body hover:bg-surface-hover-2 hover:text-white'}`} onClick={onClick}>
      <Icon size={12} /> {label}
    </button>
  )
}
