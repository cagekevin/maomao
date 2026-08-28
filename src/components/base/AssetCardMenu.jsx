import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical, FolderOpen, Copy, Pencil, Trash2, FolderPlus, ChevronLeft, Folder, X } from 'lucide-react'
import { fetchResources, rescanResources, createFolder as createFolderApi, moveFile, canMoveAsset, resolveMovePaths } from './localToolApi.js'
import { showToast } from './toastStore.js'
import { logger } from './logger.js'

/**
 * 资源卡片「⋯」下拉菜单 + 「移动到文件夹」选择器 —— 素材/生成两 tab 共用的唯一收敛点。
 *
 * 【职责】把卡片右上角原来的四个平铺按钮（打开目录/复制/重命名/删除）收进 ⋯ 下拉，
 *   并新增「移动到文件夹」：弹出目标文件夹选择器（可进入子目录 / 新建文件夹）→ 确认后
 *   moveFile（相对目录归类）→ 成功后回调刷新、失败 toast 报错。
 *
 * 【Props】
 *   item        资源对象 { id, url, name, folder, type, source }
 *   connected   localTool 是否已连接（未连接时移动/拉目录被禁用）
 *   onOpenDir(item) 打开所在目录
 *   onCopy(item)    复制链接
 *   onRename(item)  重命名（外层 setRenameTarget 展开输入条）
 *   onDelete(item)  删除
 *   onRefreshed()   移动成功后外层 reset(true) 刷新列表
 */
function AssetCardMenu({ item = {}, connected, onOpenDir, onCopy, onRename, onDelete, onRefreshed }) {
  // ── 卡片 ⋯ 下拉 ──
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ left: 0, top: 0 })
  const triggerRef = useRef(null)

  // ── 移动选择器 ──
  const [moveOpen, setMoveOpen] = useState(false)
  const [browseDir, setBrowseDir] = useState('') // 选择器当前浏览目录（相对 uploadDir）
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const movable = canMoveAsset(item)

  // 打开卡片 ⋯：记录触发按钮位置，避免弹层被滚动容器裁剪、随内容滚动
  const openMenu = () => {
    const el = triggerRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      // 菜单宽度 ~168，靠右对齐触发按钮右缘；防止超出视口左侧
      const left = Math.max(8, Math.min(r.right - 168, window.innerWidth - 168))
      setMenuPos({ left, top: r.bottom + 4 })
    }
    setMenuOpen(true)
  }

  // 点击外部 / Esc 关闭 ⋯ 下拉
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e) => {
      if (triggerRef.current && triggerRef.current.contains(e.target)) return
      setMenuOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [menuOpen])

  // 加载当前浏览目录下的子文件夹（type='folder'，rescan 已把子目录录为 folder 资源）
  const loadFolders = useCallback(async (dir) => {
    if (!connected) { setFolders([]); return }
    setLoading(true)
    try {
      const data = await fetchResources({ folder: dir, type: 'folder', pageSize: 100 })
      const d = data?.data || {}
      setFolders(d.items || [])
    } catch (e) {
      logger.warn('AssetCardMenu', '加载目录失败', e?.message)
      setFolders([]) // 目录加载失败 → 空列表，仍可新建；移动失败风险交给 moveFile 兜底
    } finally {
      setLoading(false)
    }
  }, [connected])

  // 打开移动选择器：初始浏览到 item 所在目录
  const openMove = () => {
    setMenuOpen(false)
    if (!connected) return showToast('请先连接本地引擎', { type: 'warning' })
    if (!movable) return
    const dir = item.folder || ''
    setBrowseDir(dir)
    setFolders([])
    setMoveOpen(true)
  }

  // 进入子目录 / 返回 / 均重新拉取该层文件夹
  useEffect(() => {
    if (moveOpen) loadFolders(browseDir)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveOpen, browseDir])

  const enterFolder = (name) => setBrowseDir((dir) => (dir ? `${dir}/${name}` : name))
  const backFolder = () => {
    setBrowseDir((dir) => {
      const parts = dir.split('/')
      parts.pop()
      return parts.length > 1 ? parts.join('/') : parts[0] || ''
    })
  }

  // 新建文件夹：先 mkdir，再 rescan 收录为 folder 资源，最后刷新当前层列表
  const createFolder = async (name) => {
    if (!name || !connected) return false
    try {
      await createFolderApi(browseDir ? `${browseDir}/${name}` : name)
      await rescanResources()
      await loadFolders(browseDir)
      return true
    } catch (e) {
      logger.warn('AssetCardMenu', '新建文件夹失败', e?.message)
      return false
    }
  }

  // 确认移动：同目录忽略；否则 moveFile → 成功刷新 + toast，失败 toast 保留原状
  const confirmMove = async () => {
    const { src, dst, sameDir } = resolveMovePaths(item, browseDir)
    setMoveOpen(false)
    if (sameDir) return showToast('文件已在目标目录', { type: 'warning' })
    try {
      await moveFile(src, dst)
      showToast(`已移动到「${browseDir}」`, { type: 'success' })
      onRefreshed?.()
    } catch (e) {
      showToast(e?.message || '移动失败', { type: 'error' })
    }
  }

  const run = (fn) => () => { setMenuOpen(false); fn?.() }

  return (
    <>
      <button
        ref={triggerRef}
        className="w-5 h-5 rounded bg-black/60 flex items-center justify-center text-white hover:bg-black/80 cursor-pointer border-none"
        title="更多操作"
        onClick={(e) => { e.stopPropagation(); openMenu() }}
      >
        <MoreVertical size={10} />
      </button>

      {/* 卡片 ⋯ 下拉（portal 到 body，规避滚动容器裁剪） */}
      {menuOpen && createPortal(
        <div style={{ position: 'fixed', left: menuPos.left, top: menuPos.top, zIndex: 100 }} className="bg-surface-raised border border-edge rounded-lg shadow-xl p-1 w-[168px] nowheel nopan nodrag">
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-caption-sm text-body hover:bg-surface-hover-2 hover:text-white transition-colors cursor-pointer border-none text-left" onClick={run(() => onOpenDir?.(item))} title="打开所在目录">
            <FolderOpen size={13} /> 打开所在目录
          </button>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-caption-sm text-body hover:bg-surface-hover-2 hover:text-white transition-colors cursor-pointer border-none text-left" onClick={run(() => onCopy?.(item))} title="复制链接">
            <Copy size={13} /> 复制链接
          </button>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-caption-sm text-body hover:bg-surface-hover-2 hover:text-white transition-colors cursor-pointer border-none text-left" onClick={() => { setMenuOpen(false); onRename?.(item) }} title="重命名">
            <Pencil size={13} /> 重命名
          </button>
          {movable && (
            <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-caption-sm text-body hover:bg-surface-hover-2 hover:text-white transition-colors cursor-pointer border-none text-left" onClick={openMove} title="移动到文件夹">
              <FolderPlus size={13} /> 移动到文件夹
            </button>
          )}
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-caption-sm text-body hover:bg-surface-hover-2 hover:text-red-300 transition-colors cursor-pointer border-none text-left" onClick={() => { setMenuOpen(false); onDelete?.(item) }} title="删除">
            <Trash2 size={13} /> 删除
          </button>
        </div>,
        document.body,
      )}

      {/* 移动目标文件夹选择器（居中弹层，复用 preview 遮罩交互） */}
      {moveOpen && createPortal(
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setMoveOpen(false)}>
          <div className="w-[360px] max-w-full bg-surface-2 rounded-xl p-4 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-caption-sm text-primary m-0">移动到文件夹</span>
              <button className="w-6 h-6 rounded flex items-center justify-center text-muted hover:text-body hover:bg-surface-hover cursor-pointer border-none" onClick={() => setMoveOpen(false)}>
                <X size={14} />
              </button>
            </div>

            {/* 当前浏览路径 + 返回上级 */}
            <div className="flex items-center gap-1 text-caption-sm text-muted">
              {browseDir ? (
                <>
                  {browseDir.split('/').length > 1 && (
                    <button className="flex items-center gap-0.5 text-caption-sm text-body hover:text-primary cursor-pointer border-none bg-transparent" onClick={backFolder} title="返回上级">
                      <ChevronLeft size={12} /> 上级
                    </button>
                  )}
                  <span className="truncate m-0">{browseDir}</span>
                </>
              ) : (
                <span className="m-0">根目录</span>
              )}
            </div>

            {/* 文件夹列表 */}
            <div className="max-h-[40vh] overflow-y-auto custom-scrollbar bg-surface-strong rounded-lg p-1.5 flex flex-col gap-0.5">
              {loading && folders.length === 0 ? (
                <span className="text-caption-sm text-faint text-center py-2 m-0">加载中...</span>
              ) : folders.length === 0 ? (
                <span className="text-caption-sm text-faint text-center py-2 m-0">该目录暂无子文件夹</span>
              ) : (
                folders.map((f) => (
                  <button
                    key={f.id}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-caption-sm text-body hover:bg-surface-hover-2 hover:text-white transition-colors cursor-pointer border-none text-left"
                    onClick={() => enterFolder(f.name)}
                    title={`进入 ${f.name}`}
                  >
                    <Folder size={13} className="text-muted" /> {f.name}
                  </button>
                ))
              )}
            </div>

            {/* 新建文件夹 */}
            {creating ? (
              <div className="flex items-center gap-1.5 bg-surface-deep border border-orange-500/40 rounded-lg p-1.5">
                <input
                  autoFocus value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      const ok = await createFolder(newFolderName.trim())
                      showToast(ok ? '创建成功' : '创建失败', { type: ok ? 'success' : 'error' })
                      setNewFolderName('')
                      setCreating(false)
                    } else if (e.key === 'Escape') setCreating(false)
                  }}
                  className="flex-1 h-7 bg-surface-strong border border-orange-500/40 rounded-md px-2 text-caption-sm text-white outline-none focus:border-orange-500 box-border"
                  placeholder="新文件夹名"
                />
                <span className="text-caption text-faint whitespace-nowrap">回车确认</span>
              </div>
            ) : (
              <button
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-edge text-caption-sm text-muted hover:text-body hover:border-edge-strong transition-colors cursor-pointer bg-surface-strong/50"
                onClick={() => { setCreating(true); setNewFolderName('') }}
              >
                <FolderPlus size={13} /> 新建文件夹
              </button>
            )}

            {/* 确认 / 取消 */}
            <div className="flex gap-2">
              <button className="flex-1 py-2 rounded-lg text-caption-sm text-secondary hover:bg-surface-hover cursor-pointer border border-edge bg-transparent" onClick={() => setMoveOpen(false)}>
                取消
              </button>
              <button
                className="flex-1 py-2 rounded-lg text-caption-sm text-[#141414] font-medium hover:opacity-90 cursor-pointer border-none bg-white"
                onClick={confirmMove}
              >
                移动到此处
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

export default React.memo(AssetCardMenu)