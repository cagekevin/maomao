/**
 * App 右键菜单三态配置单源（纯函数，无状态、无副作用）。
 *
 * 【定位】原内联在 App.tsx 的 canvasMenuItems/nodeMenuItems/selectionMenuItems 收拢至此，
 *        使入口只保留画布编排 + 渲染。纯声明式配置：state → ContextMenuItem[]，全部可单测。
 *
 * 【动作边界】模块不含任何 setState / ref 读写；所有会改画布状态的动作由 App 层组装成
 *        MenuActionCtx 回调传入（callback 由 App 提供，本体 mutate 状态）。菜单项只负责
 *        "生成配置 + 触发回调"。
 *
 * 【图钉交互禁止项·反直觉决策，勿删⚠️】
 *        一级显示 = 常用节点（固定的 + 顶部快捷）。二级里已固定的节点「仍然显示」，
 *        但它的作用只是承载「取消固定」的图钉（📌亮=已固定），不是让你再建一个。
 *        图钉是取消固定唯一的把手 —— 若因「一级已显示」就删掉二级里的固定项，图钉会
 *        一起消失，用户就没法取消固定。真要删，必须先在一级那一项加「取消」按钮。
 *        （原始出处 App.tsx 869-872 行，迁移保留）
 */
import type { Node } from '@xyflow/react'
import { Pin, PinOff, Type, Image as ImageIcon, Clapperboard, Zap, Folder, FolderOpen, Trash2, Copy, Upload } from 'lucide-react'
import { getNodesByCategory, getPaletteNode, paletteCategories } from './NodePalette.ts'
import { prefetchHeavyNode } from './lazyNode.tsx'
import type { ContextMenuItem } from '../ui/ContextMenu.tsx'
import type { ContextMenuState } from '../../../hooks/useContextMenu.ts'

/**
 * 菜单动作上下文：App 组装一次后整体传入，模块内只调用不持有。
 */
export interface MenuActionCtx {
  /** 已固定到一级菜单的节点类型（来自 app_settings.pinnedTools） */
  pinnedTools: string[]
  /** 空白/拖线统一建节点入口（App.addNodeFromMenu：含 connection 自动连线 + 清 ghost） */
  addNodeFromMenu: (type: string) => void
  /** 图钉固定/取消（写 app_settings.pinnedTools） */
  togglePinTool: (type: string) => void
  /** 悬停预热重依赖 chunk（3D/视频）；轻量节点内部直接返回 */
  prefetchHeavyNode: (type: string) => void
  /** 上传隐藏文件输入（菜单「上传」触发 click） */
  uploadRef: { current: HTMLInputElement | null }
  /** 按 id 取当前节点（App 用 nodesRef.current.find） */
  nodeById: (id: string) => Node | undefined
  /** 当前选中节点数（App 用 nodesRef.current.filter(selected).length），决定是否出「编组」 */
  selectedCount: () => number
  /** 复制选中节点组到系统剪贴板（onlyId 为右键节点且不在选中集时只复制该节点） */
  duplicateSelected: (onlyId?: string) => void
  /** 复制单节点图片本身到剪贴板（image/png，可粘微信/PS） */
  copyNodeImage: (nodeId: string) => void
  /** 删除节点（级联删子孙） */
  deleteNode: (id: string) => void
  /** 取消指定 group 编组（App 内 ungroupNodes+setNodes+history） */
  applyUngroup: (groupId: string) => void
  /** 编组当前选中节点（App 内 createGroupFromNodes+setNodes+history+toast） */
  applyGroup: () => void
  /** 删除所有选中节点（App 内 deleteNodesWithCascade+setNodes+history） */
  applyDeleteSelected: () => void
}

/** 图钉可取消固定唯一把手——二级固定项禁止删，见文件头 JSDoc */
type PaletteNodeRef = { type: string; label: string; icon?: React.ComponentType<{ size?: number; className?: string }>; badge?: { text: string; tone: 'new' | 'hot' } }

/** 空白处菜单：快速添加节点 + 小工具子菜单（复刻 H_.jsx:12232-12340） */
export function buildCanvasMenuItems(ctx: MenuActionCtx): ContextMenuItem[] {
  const { pinnedTools } = ctx
  // 单个目录节点的菜单项 + 图钉（固定到第一层）尾随按钮。复刻官方 H_.jsx:12317-12335。
  const toolItem = (n) => {
    const pinned = pinnedTools.includes(n.type)
    return {
      key: n.type,
      icon: n.icon,
      label: n.label,
      badge: n.badge,
      onClick: () => ctx.addNodeFromMenu(n.type),
      // 悬停即预热重依赖节点 chunk；轻量节点 prefetchHeavyNode 内部直接返回，无副作用。
      onMouseEnter: () => ctx.prefetchHeavyNode(n.type),
      // trailing 为函数形式 → ContextMenu 渲染时实例化（不随 pinnedTools 变化重建 item 数组）
      trailing: () => (
        <button
          type="button"
          className={`p-1 mr-1 rounded transition-colors ${pinned ? 'text-white hover:text-primary' : 'text-muted hover:text-body'}`}
          title={pinned ? '已固定到右键菜单，点击取消' : '固定到右键菜单'}
          onClick={(e) => { e.stopPropagation(); ctx.togglePinTool(n.type) }}
        >
          {pinned ? <Pin size={14} /> : <PinOff size={14} className="opacity-30" />}
        </button>
      )
    }
  }

  // ── 右键菜单「小工具」子菜单（二级）──
  const EXCLUDED_FROM_SUBMENU = ['scriptBoxNode']
  const toolsSubmenu = paletteCategories
    .map((cat) => {
      const catNodes = getNodesByCategory(cat.key).filter((n) => !EXCLUDED_FROM_SUBMENU.includes(n.type))
      if (catNodes.length === 0) return null
      return {
        key: `tools-${cat.key}`,
        label: cat.label,
        items: catNodes.map(toolItem)
      }
    })
    .filter(Boolean)

  // 固定到一级的节点，直接渲染在菜单第一层（常用，一眼可见）。二级里也仍显示（承载取消图钉）。
  const pinnedItems = pinnedTools
    .map((type) => getPaletteNode(type))
    .filter(Boolean)
    .map((n): ContextMenuItem & Record<string, unknown> => {
      const item = n as unknown as PaletteNodeRef
      return {
        key: `pinned-${item.type}`,
        icon: item.icon,
        label: item.label,
        badge: item.badge,
        onClick: () => ctx.addNodeFromMenu(item.type)
      }
    })

  return [
    { key: 'text', icon: <Type size={16} className="text-green-500" />, label: '文本', shortcut: 'Q', onClick: () => ctx.addNodeFromMenu('textNode') },
    { key: 'image', icon: <ImageIcon size={16} className="text-blue-400" />, label: '图片', shortcut: 'W', onClick: () => ctx.addNodeFromMenu('promptNode') },
    { key: 'video', icon: <Clapperboard size={16} className="text-yellow-500" />, label: '视频', shortcut: 'E', onClick: () => ctx.addNodeFromMenu('discountVideoNode') },
    { key: 'scriptBox', icon: <Clapperboard size={16} className="text-fuchsia-300" />, label: '剧本盒子', badge: { text: 'Beta', tone: 'new' }, onClick: () => ctx.addNodeFromMenu('scriptBoxNode') },
    { type: 'divider' as const },
    // 小工具子菜单（未固定项 + 图钉）
    ...(toolsSubmenu.length
      ? [
          { key: 'tools', icon: <Zap size={13} className="text-secondary" />, label: '小工具', items: toolsSubmenu },
          { type: 'divider' as const }
        ]
      : []),
    // 已固定节点直接渲染在第一层（复刻官方 pt）
    ...pinnedItems,
    { type: 'divider' as const },
    { key: 'upload', icon: <Upload size={16} className="text-secondary" />, label: '上传', onClick: () => ctx.uploadRef.current?.click() }
  ]
}

/** 单选节点菜单：复制 / [复制图片] / 删除（复刻 H_.jsx:12573-12617） */
export function buildNodeMenuItems(ctx: MenuActionCtx, nodeId: string | null | undefined): ContextMenuItem[] {
  if (!nodeId) return []
  const node = ctx.nodeById(nodeId)
  if (!node) return []
  const isImageLike = node.type === 'imageNode' || node.type === 'promptNode'
  const isGroup = node.type === 'group'
  const items: ContextMenuItem[] = [
    { key: 'duplicate', icon: <Copy size={16} className="text-body" />, label: '复制', onClick: () => ctx.duplicateSelected(node.id) }
  ]
  // 「复制图片」仅图片类节点（imageNode/promptNode）有：把图片本身复制到剪贴板（对齐官方 Ei）
  if (isImageLike) {
    items.push({
      key: 'copyImage',
      icon: <ImageIcon size={16} className="text-body" />,
      label: '复制图片',
      onClick: () => ctx.copyNodeImage(node.id)
    })
  }
  // group 节点：取消编组（治根：与 Agent 共用 ungroupNodes）
  if (isGroup) {
    items.push({
      key: 'ungroup',
      icon: <FolderOpen size={16} className="text-body" />,
      label: '取消编组',
      onClick: () => ctx.applyUngroup(node.id)
    })
  }
  items.push(
    { type: 'divider' },
    { key: 'delete', icon: <Trash2 size={16} className="text-red-400" />, label: '删除', danger: true, onClick: () => ctx.deleteNode(node.id) }
  )
  return items
}

/** 多选菜单：编组 / 复制 / 删除（对齐官方多选右键：复制选中节点组到剪贴板，粘贴时重建） */
export function buildSelectionMenuItems(ctx: MenuActionCtx): ContextMenuItem[] {
  const items: ContextMenuItem[] = []
  // 编组：选中≥2个普通节点时可用（治根：与 Agent group_nodes 共用 createGroupFromNodes）
  if (ctx.selectedCount() >= 2) {
    items.push({
      key: 'group',
      icon: <Folder size={16} className="text-body" />,
      label: '编组',
      onClick: () => ctx.applyGroup()
    })
    items.push({ type: 'divider' })
  }
  items.push(
    {
      key: 'duplicate',
      icon: <Copy size={16} className="text-body" />,
      label: '复制',
      onClick: () => ctx.duplicateSelected()
    },
    { type: 'divider' },
    {
      key: 'delete',
      icon: <Trash2 size={16} className="text-red-400" />,
      label: '删除',
      danger: true,
      onClick: () => ctx.applyDeleteSelected() // 级联删选中 group 的子孙节点（防留孤儿）
    }
  )
  return items
}

/** 根据菜单类型分发到对应配置（单一数据源：拖线复用 canvas 菜单，故无独立 connection 分支） */
export function menuForState(state: ContextMenuState, ctx: MenuActionCtx): ContextMenuItem[] {
  if (state.type === 'node') return buildNodeMenuItems(ctx, state.nodeId)
  if (state.type === 'selection') return buildSelectionMenuItems(ctx)
  return buildCanvasMenuItems(ctx)
}