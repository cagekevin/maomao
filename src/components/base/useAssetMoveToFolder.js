import { useCallback } from 'react'
import { moveFile, canMoveAsset, resolveMovePaths } from './localToolApi.js'
import { toAbsoluteFileUrl } from './imageUrl.js'
import { publish } from './eventBus.js'
import { showToast } from './toastStore.js'

/** 移动拖拽专用 MIME（与素材「拖到画布」的 application/x-yimao-asset 区分，互不干扰） */
export const ASSET_MOVE_MIME = 'application/x-yimao-move'

function movePayload(item) {
  return JSON.stringify({ folder: item.folder || '', name: item.name, source: item.source, type: item.type })
}
function parseMovePayload(str) {
  try { return JSON.parse(str) } catch { return null }
}
// 文件夹卡片的完整相对路径（落点目录）：parent/name。rescan 记录子目录 folder=父目录、name=目录名。
function moveTargetDirOf(folderCard) {
  return folderCard?.folder ? `${folderCard.folder}/${folderCard.name}` : (folderCard?.name || '')
}

/**
 * 「把文件拖到文件夹卡片上即归类」的共享实现（素材/生成两 tab 唯一收敛点）。
 *
 * - sourceDragProps(item)：放在「文件卡片」上，使其可拖拽，只写移动归类 payload
 *   （application/x-yimao-move）。卡片拖拽【仅】用于「拖到文件夹归类」；
 *   拖到画布建节点是「点开大图后在预览里拖」的另一条链路（预览 img 上的 assetDragProps），两者互不混淆。
 * - folderDropProps(folderCard)：放在「文件夹卡片」上，作为落点；drop 时执行移动 + toast + 回调刷新。
 *
 * 直接复用 localToolApi 的 canMoveAsset / resolveMovePaths / moveFile，遵守同一套相对路径与边界契约。
 */
export function useAssetMoveToFolder({ connected, onRefreshed }) {
  // 源（文件卡片）拖拽属性：仅移动归类
  const sourceDragProps = useCallback((item) => {
    if (item.type === 'folder' || !item.url) return {}
    return {
      draggable: true,
      onDragStart: (e) => {
        e.dataTransfer.setData(ASSET_MOVE_MIME, movePayload(item))
        e.dataTransfer.effectAllowed = 'move'
      },
    }
  }, [])

  // 目标（文件夹卡片）承接 drop
  const folderDropProps = useCallback((folderCard) => ({
    onDragOver: (e) => { e.preventDefault() },
    onDrop: async (e) => {
      e.preventDefault(); e.stopPropagation() // 不落到面板层的上传 onDrop
      if (!connected) { showToast('请先连接本地引擎', { type: 'warning' }); return }
      const it = parseMovePayload(e.dataTransfer.getData(ASSET_MOVE_MIME))
      if (!it) return
      const target = moveTargetDirOf(folderCard)
      if (!canMoveAsset(it)) { showToast('仅支持移动本地资源', { type: 'warning' }); return }
      const { src, dst, sameDir } = resolveMovePaths(it, target)
      if (sameDir) { showToast('文件已在目标目录', { type: 'warning' }); return }
      try {
        await moveFile(src, dst)
        // 移动也改资源 url：广播旧→新，让 App 同步改写当前画布/脚本箱节点里引用旧 url 的字段
        // （与改名同一事件，后端 handleMove 已 rewrite 落盘库）。否则同一会话内节点仍指旧路径 → 404。
        publish('resource:renamed', { oldUrl: toAbsoluteFileUrl(`/files/${src}`), newUrl: toAbsoluteFileUrl(`/files/${dst}`) })
        showToast(`已移动到「${target}」`, { type: 'success' })
        onRefreshed?.()
      } catch (err) {
        showToast(err?.message || '移动失败', { type: 'error' })
      }
    },
  }), [connected, onRefreshed])

  return { sourceDragProps, folderDropProps }
}