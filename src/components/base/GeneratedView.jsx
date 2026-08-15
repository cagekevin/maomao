import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { FolderOpen, Image as ImageIcon, Play, FileText, Music, Copy, Trash2, FolderPlus, ChevronLeft, MoreVertical, Pencil } from 'lucide-react'
import { useLocalToolStatus } from './useLocalToolStatus.js'
import { fetchResources, rescanResources, deleteResource, renameResource, openLocalFolder, openFileDir, relativePathFromUrl } from './resourcesApi.js'
import { showToast } from './toastStore.js'
import { API_BASE } from './apiBase.js'

// 类型过滤 pill（沿用素材库 AssetLibrary 的小圆按钮形式）
const TYPE_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'text', label: '文本' },
]

const TYPE_BADGE = {
  image: { icon: ImageIcon, cls: 'text-blue-400 bg-blue-500/10' },
  video: { icon: Play, cls: 'text-purple-400 bg-purple-500/10' },
  audio: { icon: Music, cls: 'text-green-400 bg-green-500/10' },
  text: { icon: FileText, cls: 'text-yellow-400 bg-yellow-500/10' },
}

const PAGE_SIZE = 20 // 每次加载 20 个，点击翻页（对齐官方 Un.jsx 默认 pageSize:20）

// 文本内容缓存（避免滚动时重复 fetch）
const textCache = new Map()
function fetchText(url) {
  if (textCache.has(url)) return Promise.resolve(textCache.get(url))
  return fetch(url)
    .then((r) => (r.ok ? r.text() : ''))
    .then((t) => {
      textCache.set(url, t)
      return t
    })
    .catch(() => '')
}

function isAudio(type, url) {
  return type === 'audio' || (type && type.startsWith('audio')) || /\.(flac|mp3|wav|ogg|m4a|aac|opus|wma|aiff)(\?|$)/i.test(url || '')
}

// 文字资源单元格：默认展示文件内容（前几行）
function TextResourceCell({ url, name }) {
  const [text, setText] = useState('')
  useEffect(() => {
    let alive = true
    fetchText(url).then((t) => { if (alive) setText(t) })
    return () => { alive = false }
  }, [url])
  const display = useMemo(() => String(text || name || '').slice(0, 120), [text, name])
  return (
    <div className="w-full h-full bg-surface-strong flex items-center justify-center px-1.5">
      {display && (
        <p className="text-2xs text-muted leading-tight m-0 line-clamp-3 break-all text-center">
          {display}
        </p>
      )}
    </div>
  )
}

// 文字预览：完整展示文件内容
function TextPreview({ url, name }) {
  const [text, setText] = useState('')
  useEffect(() => {
    let alive = true
    fetchText(url).then((t) => { if (alive) setText(t) })
    return () => { alive = false }
  }, [url])
  return (
    <div className="w-[360px] max-w-[90vw] bg-surface-2 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <FileText size={18} className="text-yellow-400" />
        <span className="text-sm text-primary m-0">{name}</span>
      </div>
      <pre className="text-xs text-secondary whitespace-pre-wrap break-words max-h-[55vh] overflow-y-auto custom-scrollbar m-0">
        {text || '（加载中...）'}
      </pre>
    </div>
  )
}

/**
 * 生成 tab —— 对齐官方资源面板「生成」(generated) 视图的数据逻辑（Vr.jsx ft()/kr() + Un.jsx），
 * 过滤用本原型素材库的小圆按钮（pill）形式，点击翻页（每页 20 个，底部固定分页栏），无收藏。
 * 预览交互与素材库 AssetLibrary 一致：文字默认展示内容、图片点击大图、视频点击大图播放。
 *
 * 官方逻辑（逐条对齐）：
 *  - 数据：GET /api/resources?filters={folder:{eqOrPrefix:'tasks'}}（AI 生成结果落盘 tasks 目录，rescan 收录）
 *  - 打开面板先 rescan 一次（官方 Xa(true) → Pr rescan + kr 拉取），保证最新生成结果出现
 *  - 类型过滤 pill：全部/图片/视频/文本
 *  - 顶部「打开本地存储目录」按钮 → GET /api/files/open?subfolder=tasks
 *  - 文件夹可进入（tasks 子目录）；卡片悬停：打开目录/复制/删除
 * UI 采用本原型暗色风格（过滤 pill 沿用素材库形式），数据逻辑与官方一致。
 */
export default function GeneratedView() {
  const { status } = useLocalToolStatus()
  const connected = status.isConnected

  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null) // 点击大图/视频/文字/音频预览

  const [typeFilter, setTypeFilter] = useState('all') // all/image/video/text
  const [folder, setFolder] = useState('tasks') // 当前目录（eqOrPrefix 前缀），初始 tasks
  const [creating, setCreating] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [menuOpen, setMenuOpen] = useState(false) // 「⋯」更多操作菜单
  const [renameTarget, setRenameTarget] = useState(null) // 正在重命名的资源
  const [renameName, setRenameName] = useState('')
  const [menuItemId, setMenuItemId] = useState(null) // 卡片「⋯」菜单打开的卡片 id

  const resetTokenRef = useRef(0)

  // 重置并加载第一页（目录/类型变化时）
  const reset = useCallback(async (rescan = false) => {
    if (!connected) return
    const token = ++resetTokenRef.current
    setLoading(true)
    setPage(1)
    try {
      if (rescan) await rescanResources()
      const data = await fetchResources({ folder, page: 1, pageSize: PAGE_SIZE, type: typeFilter === 'all' ? undefined : typeFilter })
      if (token !== resetTokenRef.current) return // 已被更新的请求覆盖
      setItems(data.items || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
    } catch (e) {
      console.warn('[GeneratedView] 加载失败（localTool 未连？）:', e?.message)
      if (token === resetTokenRef.current) setItems([])
    } finally {
      if (token === resetTokenRef.current) setLoading(false)
    }
  }, [connected, folder, typeFilter])

  // 点击上一页/下一页 → 加载指定页（对齐官方 Un.jsx：每页固定数量，只显示当前页，不追加）
  const goPage = useCallback(async (next) => {
    if (!connected || loading || next < 1) return
    const target = Math.min(next, totalPages)
    const token = ++resetTokenRef.current
    setLoading(true)
    try {
      const data = await fetchResources({ folder, page: target, pageSize: PAGE_SIZE, type: typeFilter === 'all' ? undefined : typeFilter })
      if (token !== resetTokenRef.current) return
      setItems(data.items || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
      setPage(data.page || target)
    } catch (e) {
      console.warn('[GeneratedView] 翻页加载失败:', e?.message)
    } finally {
      if (token === resetTokenRef.current) setLoading(false)
    }
  }, [connected, folder, typeFilter, totalPages, loading])

  // 首次挂载 + 过滤/目录变化 → 重置到第 1 页并 rescan
  useEffect(() => {
    if (!connected) return
    reset(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, folder, typeFilter])

  const handleDelete = async (item) => {
    setItems((list) => list.filter((x) => x.id !== item.id))
    setTotal((t) => Math.max(0, t - 1))
    try {
      await deleteResource(item.id)
    } catch {
      showToast('删除失败', { type: 'error' })
    }
  }

  const handleOpenLocal = () => {
    if (!connected) return showToast('请先连接本地引擎', { type: 'warning' })
    openLocalFolder(folder === 'tasks' ? 'tasks' : folder)
      .then((r) => showToast(`已在文件管理器中打开: ${r.path}`, { type: 'success' }))
      .catch(() => showToast('打开本地目录失败', { type: 'error' }))
  }

  const handleOpenFileDir = (item) => {
    const rel = relativePathFromUrl(item.url)
    if (!rel) return showToast('打开所在目录失败', { type: 'error' })
    openFileDir(rel).catch(() => showToast('打开所在目录失败', { type: 'error' }))
  }

  const handleCopy = async (item) => {
    try {
      await navigator.clipboard.writeText(item.url || '')
      showToast('已复制链接', { type: 'success' })
    } catch {
      showToast('复制失败', { type: 'error' })
    }
  }

  // 重命名资源
  const handleRename = async () => {
    if (!renameTarget) return
    const name = renameName.trim()
    if (!name) { setRenameTarget(null); return }
    try {
      const res = await renameResource(renameTarget.id, name)
      // 更新本地列表（id/url/name 已变）
      setItems((list) => list.map((x) => (x.id === renameTarget.id ? { ...x, id: res.id, url: res.url, name: res.name } : x)))
      textCache.delete(renameTarget.url)
      showToast('重命名成功', { type: 'success' })
    } catch (e) {
      showToast(e?.message || '重命名失败', { type: 'error' })
    }
    setRenameTarget(null)
    setRenameName('')
  }

  // 新建文件夹（对齐官方 S.createFolder → POST /api/files/mkdir）
  const createFolder = async (name) => {
    if (!name || !connected) return false
    try {
      const res = await fetch(`${API_BASE}/api/files/mkdir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: folder === 'tasks' ? `tasks/${name}` : `${folder}/${name}` }),
      })
      if (res.ok) {
        reset(true)
        return true
      }
    } catch { /* ignore */ }
    return false
  }

  const back = useCallback(() => {
    const parts = folder.split('/')
    parts.pop()
    const parent = parts.length > 0 ? parts.join('/') : 'tasks'
    setFolder(parent)
  }, [folder])

  // 拖到画布建节点（与素材库一致）：图片/视频/音频 → imageNode，文字 → textNode
  const onDragStart = (e, a) => {
    if (a.type === 'folder') return
    const text = textCache.get(a.url)
    e.dataTransfer.setData('application/x-yimao-asset', JSON.stringify({ url: a.url, name: a.name, type: a.type, text }))
    e.dataTransfer.effectAllowed = 'copy'
    // 文字内容异步补全（dataTransfer 在拖拽期间可多次 setData）
    if (a.type === 'text' && !text) {
      fetchText(a.url).then((t) => {
        if (t) e.dataTransfer.setData('application/x-yimao-asset', JSON.stringify({ url: a.url, name: a.name, type: a.type, text: t }))
      })
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* 顶部：类型过滤 pill（文件操作收进右侧「⋯」菜单，保持简洁） */}
      <div className="px-2.5 pt-2.5 flex items-center gap-1.5 flex-shrink-0 relative">
        <div className="flex gap-1.5 flex-wrap items-center flex-1">
          {folder !== 'tasks' && (
            <button className="flex items-center gap-1 px-2 py-1 rounded-full text-caption-sm text-body hover:bg-surface-hover cursor-pointer border-none bg-surface-2" onClick={back} title="返回上级">
              <ChevronLeft size={12} /> {folder.split('/').pop()}
            </button>
          )}
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.key}
              className={`px-2.5 py-1 rounded-full text-caption-sm transition-all cursor-pointer border-none ${typeFilter === f.key ? 'bg-white text-[#141414] font-medium' : 'bg-surface-2 text-muted hover:text-primary'}`}
              onClick={() => setTypeFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* 「⋯」更多操作菜单：打开本地目录 / 新建文件夹 */}
        <div className="relative flex-shrink-0">
          <button
            className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors cursor-pointer border-none ${menuOpen ? 'bg-surface-hover text-white' : 'text-faint hover:text-body hover:bg-surface-subtle'}`}
            onClick={() => setMenuOpen((v) => !v)}
            title="更多操作"
          >
            <MoreVertical size={15} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-surface-raised border border-edge rounded-lg shadow-xl p-1 z-30 w-40 nowheel nopan nodrag">
              <button
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-caption-sm text-body hover:bg-surface-hover-2 hover:text-white transition-colors cursor-pointer border-none text-left"
                onClick={() => {
                  setMenuOpen(false)
                  handleOpenLocal()
                }}
                title="打开本地存储目录"
              >
                <FolderOpen size={13} /> 打开本地目录
              </button>
              <button
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-caption-sm text-body hover:bg-surface-hover-2 hover:text-white transition-colors cursor-pointer border-none text-left"
                onClick={() => {
                  setMenuOpen(false)
                  if (!connected) return showToast('请先连接本地引擎', { type: 'warning' })
                  setCreating(true)
                  setNewFolderName('新建文件夹')
                }}
                title="新建文件夹"
              >
                <FolderPlus size={13} /> 新建文件夹
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 新建文件夹输入卡片 */}
      {creating && (
        <div className="px-2.5 pt-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 bg-surface-deep border border-orange-500/40 rounded-lg p-1.5">
            <input
              autoFocus value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  const ok = await createFolder(newFolderName.trim())
                  showToast(ok ? '创建成功' : '创建失败', { type: ok ? 'success' : 'error' })
                  setCreating(false)
                } else if (e.key === 'Escape') setCreating(false)
              }}
              onBlur={async () => {
                if (newFolderName.trim() && newFolderName.trim() !== '新建文件夹') {
                  await createFolder(newFolderName.trim())
                }
                setCreating(false)
              }}
              className="flex-1 h-7 bg-surface-faint border border-orange-500/40 rounded-md px-2 text-caption-sm text-white outline-none focus:border-orange-500 box-border"
            />
            <span className="text-caption text-faint whitespace-nowrap">回车确认</span>
          </div>
        </div>
      )}

      {/* 重命名输入条 */}
      {renameTarget && (
        <div className="px-2.5 pt-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 bg-surface-deep border border-blue-500/40 rounded-lg p-1.5">
            <input
              autoFocus value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { handleRename() }
                else if (e.key === 'Escape') { setRenameTarget(null); setRenameName('') }
              }}
              onBlur={handleRename}
              className="flex-1 h-7 bg-surface-faint border border-blue-500/40 rounded-md px-2 text-caption-sm text-white outline-none focus:border-blue-500 box-border"
              placeholder="输入新文件名"
            />
            <span className="text-caption text-faint whitespace-nowrap">回车确认</span>
          </div>
        </div>
      )}

      {/* 网格（点击翻页，只显示当前页） */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2.5 pb-2.5 mt-2">
        {!connected ? (
          <div className="h-full flex items-center justify-center text-faint text-sm">请先连接本地引擎</div>
        ) : loading && items.length === 0 ? (
          <div className="h-full flex items-center justify-center text-faint text-sm">加载中...</div>
        ) : items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-faint text-sm gap-2">
            <div className="text-4xl opacity-40">📦</div>
            <p className="m-0">暂无生成资源</p>
            <p className="text-xs text-subtle m-0">在画布上生成图片/视频后会自动出现在这里</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {items.map((a) => {
                const badge = TYPE_BADGE[a.type] || TYPE_BADGE.image
                const BadgeIcon = badge.icon
                const audio = isAudio(a.type, a.url)
                const isFolder = a.type === 'folder'
                return (
                  <div
                    key={a.id}
                    draggable={!isFolder}
                    onDragStart={(e) => onDragStart(e, a)}
                    className={`group relative aspect-square bg-surface-deep rounded-xl overflow-hidden transition-colors ${isFolder ? 'border border-edge cursor-pointer hover:border-[#4a4a4a]' : 'border border-[#242424] hover:border-edge-raised cursor-grab active:cursor-grabbing'}`}
                    onClick={() => {
                      if (isFolder) setFolder(folder === 'tasks' ? `tasks/${a.name}` : `${folder}/${a.name}`)
                      else setPreview(a) // 图片/视频/文字/音频 → 点击大图预览
                    }}
                  >
                    {isFolder ? (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted">
                        <FolderOpen size={30} strokeWidth={1.2} />
                        <span className="text-caption font-medium text-center px-1 break-all leading-tight m-0">{a.name}</span>
                      </div>
                    ) : audio ? (
                      <div className="w-full h-full bg-surface-black flex flex-col items-center justify-center gap-1.5 p-2">
                        <Music size={22} className="text-green-400" />
                        <span className="text-meta text-muted text-center break-all leading-tight m-0">{a.name}</span>
                      </div>
                    ) : a.type === 'text' ? (
                      <TextResourceCell url={a.url} name={a.name} />
                    ) : a.type === 'video' || (a.type && a.type.startsWith('video')) ? (
                      <div className="w-full h-full flex items-center justify-center relative">
                        {a.url ? <video src={a.url} className="w-full h-full object-cover" muted /> : <Play size={20} className="text-faint" />}
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="w-7 h-7 rounded-full bg-black/45 flex items-center justify-center">
                            <Play size={12} className="text-white ml-0.5" />
                          </span>
                        </span>
                      </div>
                    ) : (
                      <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: a.url ? `url(${a.url})` : undefined }}>
                        {!a.url && <div className="w-full h-full flex items-center justify-center text-subtle"><FileText size={18} /></div>}
                      </div>
                    )}

                    {/* 类型角标（文字不显示，避免黄色图标干扰） */}
                    {!isFolder && a.type !== 'text' && (
                      <span className={`absolute top-1 left-1 w-4 h-4 rounded flex items-center justify-center ${badge.cls}`}>
                        <BadgeIcon size={9} />
                      </span>
                    )}

                    {/* 卡片操作：打开目录 / 复制 / 重命名 / 删除 */}
                    {!isFolder && (
                      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="w-5 h-5 rounded bg-black/60 flex items-center justify-center text-white hover:bg-black/80 cursor-pointer border-none" title="打开所在目录" onClick={(e) => { e.stopPropagation(); handleOpenFileDir(a) }}>
                          <FolderOpen size={10} />
                        </button>
                        <button className="w-5 h-5 rounded bg-black/60 flex items-center justify-center text-white hover:bg-black/80 cursor-pointer border-none" title="复制链接" onClick={(e) => { e.stopPropagation(); handleCopy(a) }}>
                          <Copy size={10} />
                        </button>
                        <button className="w-5 h-5 rounded bg-black/60 flex items-center justify-center text-white hover:bg-black/80 cursor-pointer border-none" title="重命名" onClick={(e) => { e.stopPropagation(); setRenameTarget(a); setRenameName(a.name) }}>
                          <Pencil size={10} />
                        </button>
                        <button className="w-5 h-5 rounded bg-black/60 flex items-center justify-center text-red-300 hover:bg-black/80 cursor-pointer border-none" title="删除" onClick={(e) => { e.stopPropagation(); handleDelete(a) }}>
                          <Trash2 size={10} />
                        </button>
                      </div>
                    )}

                    {/* 底部名称 */}
                    <div className="absolute bottom-0 inset-x-0 px-1.5 py-0.5 bg-gradient-to-t from-black/70 to-transparent">
                      <p className="text-meta text-white/80 truncate m-0">{a.name}</p>
                    </div>
                  </div>
                )
              })}
            </div>

          </>
        )}
      </div>

      {/* 底部固定分页栏（对齐官方 Un.jsx：生成(总数) + 上一页/页码/下一页 + 清空全部） */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-edge bg-canvas flex-shrink-0">
        <span className="text-sm font-bold text-body">
          生成 ({total})
        </span>
        {totalPages > 1 ? (
          <div className="flex justify-center items-center gap-3 flex-1">
            <button
              disabled={page <= 1 || loading}
              onClick={() => goPage(page - 1)}
              className="px-3 py-1 bg-surface-hover text-secondary rounded text-xs hover:bg-surface-hover-strong disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border-none"
            >上一页</button>
            <span className="text-xs text-muted">{page} / {totalPages}</span>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => goPage(page + 1)}
              className="px-3 py-1 bg-surface-hover text-secondary rounded text-xs hover:bg-surface-hover-strong disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border-none"
            >下一页</button>
          </div>
        ) : (
          <div className="flex-1" />
        )}
        {loading && <span className="text-caption text-faint whitespace-nowrap mr-1">加载中...</span>}
      </div>

      {/* 点击大图/视频/文字/音频预览（与素材库一致） */}
      {preview && (
        <div className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="max-w-full max-h-full flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {preview.type === 'text' ? (
              <TextPreview url={preview.url} name={preview.name} />
            ) : preview.type === 'video' || (preview.type && preview.type.startsWith('video')) ? (
              <video src={preview.url} controls className="max-h-[70vh] max-w-full rounded-lg" />
            ) : isAudio(preview.type, preview.url) ? (
              <div className="w-[300px] bg-surface-2 rounded-xl p-6 flex flex-col items-center gap-3">
                <Music size={40} className="text-green-400" />
                <p className="text-xs text-secondary m-0">{preview.name}</p>
                <audio src={preview.url} controls className="w-full" />
              </div>
            ) : (
              <img src={preview.url} alt={preview.name} className="max-h-[75vh] max-w-full rounded-lg object-contain" />
            )}
            <p className="text-xs text-muted m-0">{preview.name} · {preview.folder}</p>
            <button className="px-4 py-1.5 rounded-lg bg-surface-hover text-body hover:bg-surface-hover-strong text-xs cursor-pointer border-none" onClick={() => setPreview(null)}>关闭</button>
          </div>
        </div>
      )}
    </div>
  )
}
