import React, { useRef, useState, useLayoutEffect } from 'react'
import type { ContextMenuState } from '../../hooks/useContextMenu.ts'

/**
 * 右键菜单项配置（支持 divider / 普通项 / 子菜单 / 分组工具面板，详见下方各接口）。
 */

/** 图标：组件引用（函数/forwardRef）或 React 元素 */
type MenuIcon = React.ComponentType<{ size?: number; className?: string }> | React.ReactNode

/** 工具面板叶子节点项（renderToolLeaf 用）：支持 badge / trailing 尾随槽 */
interface ToolLeafItem {
  key: string
  icon?: MenuIcon
  label: string
  badge?: { tone: 'new' | 'hot'; text: string }
  onClick?: (e: React.MouseEvent) => void
  /** 尾随插槽：函数则实例化，否则原样渲染 */
  trailing?: (() => React.ReactNode) | React.ReactNode
  closeOnClick?: boolean
}

/** 分组工具面板的分类块（child 带 items） */
interface ToolCategoryItem extends ToolLeafItem {
  items?: ToolLeafItem[]
}

/** 普通菜单项（type 为可选判别字段：调用方可不传，默认 undefined = 普通项） */
interface MenuLeafItem {
  key: string
  icon?: MenuIcon
  label: string
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  onClick?: (e: React.MouseEvent) => void
  onMouseEnter?: () => void
  closeOnClick?: boolean
  /** 判别字段：普通项不传（undefined）或 'item'；与 divider 区分用 */
  type?: 'item'
}

/** 右键菜单项（含 divider / leaf / submenu / 分组工具面板 四种形态） */
export type ContextMenuItem =
  | { type: 'divider' }
  | (MenuLeafItem & {
      /** 悬停展开的子菜单（同构，支持嵌套） */
      submenu?: ContextMenuItem[]
      /** 分组工具面板（小工具网格，见 renderItems） */
      items?: ToolCategoryItem[]
    })

export interface ContextMenuProps {
  /** 菜单状态（x/y 为相对画布容器坐标），null 时不渲染 */
  state: ContextMenuState | null
  /** 菜单项：可传数组，或按 state 返回菜单项的函数 */
  items: ContextMenuItem[] | ((state: ContextMenuState) => ContextMenuItem[])
  /** 关闭回调 */
  onClose: () => void
  /** 画布容器 ref（坐标基准 + 防溢出基准，需与本组件挂在同一个 relative div） */
  containerRef: React.RefObject<HTMLDivElement | null>
}

/**
 * 通用右键菜单基座（复刻 H_.jsx:12229-12619 的 ContextMenu）。
 *
 * 纯渲染组件：由 useContextMenu hook 提供 state 与关闭回调。
 * 三种 type：'canvas'（空白处）/ 'node'（单选节点）/ 'selection'（多选）。
 *
 * 菜单项配置（通过 items 数组传入）：
 *  - { type:'divider' }                                   → 分隔线
 *  - { key, icon, label, shortcut, danger, disabled, onClick, submenu }
 *    submenu: 子菜单数组（悬停展开，同构，支持嵌套）
 *
 * ── 坐标系（务必理解，否则定位全错）──
 * state.x / state.y 是「相对画布容器」的坐标，由 useContextMenu.toContainerPos() 换算：
 *   (clientX - containerRect.left, clientY - containerRect.top)。
 * 本组件挂在 ReactFlow 外层那个 <div ref={containerRef} className="relative"> 里，
 * 菜单 absolute 定位，top/left 就相对这个 relative div，所以直接用 state.x/y 即可对齐鼠标。
 * containerRef 同时是防溢出的基准（getBoundingClientRect 拿到容器可视范围）。
 *
 * ── 防溢出定位（核心设计意图）──
 * 官方（H_.jsx Ji()）的写法是写死「预估高度」：node/selection 菜单预留 150、canvas 菜单预留 550，
 * 判断「鼠标y + 预估高 > 容器高」时，就把菜单顶放到「容器高 - 预估高 - 10」，让菜单整体上移、底部贴住容器底。
 * 官方为何要 550 那么大？因为官方 canvas 菜单真的很长（分组子菜单多，接近满屏高），
 * 在屏幕下方点击时如果不整体上移，菜单会一路掉出屏幕底，所以必须预留足够高度提前上移。
 * 但「写死预估」的坏处是：我们的 canvas 菜单实际没那么高（约 200 左右），若沿用 550，
 * 在屏幕下方点击会「过早上移、离鼠标点很远」，看起来菜单飘到了很上面，是 bug。
 *
 * 因此这里改为「按实际渲染高度自适应」：
 *   1. 先按鼠标点击点定位（top=state.y, left=state.x），菜单向右下展开；
 *   2. useLayoutEffect 在浏览器绘制前（无闪跳）测出菜单真实 offsetWidth/offsetHeight；
 *   3. 若 bottom 超出容器底 → 上移，让菜单底贴住容器底（top = 容器高 - 菜单高 - 10）；
 *      若 right  超出容器右 → 左移，让菜单右贴住容器右。
 *   原则：位置只会「往左上收」，保证永远完整落在容器内；绝不会「往右下移」导致越界。
 *   这样菜单多高就在屏幕下方点多靠近，恰好放下，不飘高也不超出。
 *
 * @param props
 *  - state        { x, y, type, nodeId } | null（x/y 为相对容器坐标）
 *  - items        (state) => items[]    根据 type 返回菜单项
 *  - onClose      关闭回调
 *  - containerRef 画布容器 ref（坐标基准 + 防溢出基准，需与本组件挂在同一个 relative div）
 */
function ContextMenu({ state, items, onClose, containerRef }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  // 见头部「防溢出定位」注释：首次按鼠标点定位，绘制前按实际尺寸往左上收。
  useLayoutEffect(() => {
    if (!state) return
    const el = menuRef.current
    const rect = containerRef?.current?.getBoundingClientRect()
    let top = state.y
    let left = state.x
    if (el && rect) {
      const mw = el.offsetWidth
      const mh = el.offsetHeight
      if (top + mh > rect.height) top = Math.max(4, rect.height - mh - 10)
      if (left + mw > rect.width) left = Math.max(4, rect.width - mw - 10)
    }
    setPos({ top, left })
  }, [state, containerRef])

  if (!state) return null
  const menuItems: ContextMenuItem[] = typeof items === 'function' ? items(state) : items

  return (
    <div
      ref={menuRef}
      className="absolute z-dropdown bg-surface-menu border border-white/[0.04] rounded-2xl shadow-popover p-2 flex flex-col min-w-[208px]"
      style={{ top: pos.top, left: pos.left }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {renderItems(menuItems, onClose)}
    </div>
  )
}

export default React.memo(ContextMenu)

// 统一渲染 icon：支持「组件引用（函数 / forwardRef 对象）」或「React 元素」两种形式
function renderIcon(icon: MenuIcon | undefined, size = 16, className = '') {
  if (!icon) return null
  // 已是 React 元素（有 $$typeof）→ 直接渲染
  if (React.isValidElement(icon)) return icon
  // 否则视为组件引用（函数 或 forwardRef 对象），实例化。
  // 注意：forwardRef 组件 typeof 是 'object' 不是 'function'，必须用 React.createElement(icon) 统一处理。
  return React.createElement(icon as React.ComponentType<{ size?: number; className?: string }>, { size, className })
}

// 渲染小工具面板里的单个节点项（支持尾随图钉，复刻 H_.jsx:12317-12335）
function renderToolLeaf(child: ToolLeafItem, onClose: () => void) {
  return (
    <div
      key={child.key}
      className="group/titem flex items-center rounded-lg hover:bg-white/10 transition-colors"
    >
      <button
        className="flex-1 min-w-0 flex items-center rounded-lg px-2.5 py-1.5 text-body-sm text-primary hover:text-white text-left gap-2"
        onClick={(e) => {
          e.stopPropagation()
          child.onClick?.(e)
          if (child.closeOnClick !== false) onClose()
        }}
      >
        {renderIcon(child.icon, 15, 'text-white shrink-0')}
        <span className="truncate">{child.label}</span>
        {child.badge && (
          <span className={`rounded px-1 py-0.5 text-2xs font-semibold ${child.badge.tone === 'new' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-fuchsia-500/20 text-fuchsia-300'}`}>
            {child.badge.text}
          </span>
        )}
      </button>
      {/* 尾随插槽：官方图钉「固定到右键菜单」/ 其他操作按钮 */}
      {child.trailing && (
        <span
          className="shrink-0 flex items-center"
          onClick={(e) => e.stopPropagation()}
        >
          {typeof child.trailing === 'function' ? child.trailing() : child.trailing}
        </span>
      )}
    </div>
  )
}

// 渲染菜单项（支持 divider / submenu）
function renderItems(items: ContextMenuItem[], onClose: () => void) {
  return (items || []).map((item, index) => {
    if (item.type === 'divider') {
      // key 用索引保证稳定（divider 没有业务 key）
      return <div key={`div-${index}`} className="h-[1px] bg-white/[0.04] my-2 mx-1" />
    }
    if (item.submenu && item.submenu.length) {
      return (
        <div key={item.key} className="relative group/sub">
          <button
            className={`w-full text-left px-3.5 py-2 text-caption-sm text-secondary hover:text-primary rounded-xl flex items-center gap-2 justify-between transition-colors`}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="flex items-center gap-2">
              {renderIcon(item.icon, 13)}
              <span>{item.label}</span>
            </span>
            <span className="text-xl text-secondary leading-none">›</span>
          </button>
          {/* 子菜单：用纯 CSS group-hover 展开，无需 JS 状态。
              before 伪元素是一个「桥」：向左延伸 12px，鼠标从父项移到子菜单
              经过中间 8px gap 时仍算 hover（group-hover/sub），子菜单不会收起。
              这是官方防抖的常用技巧，删掉会出现"鼠标一过 gap 子菜单就消失"。 */}
          <div
            className={`absolute left-full top-0 ml-2 bg-surface-menu border border-white/[0.04] rounded-2xl shadow-popover p-2 min-w-[200px] z-dropdown hidden group-hover/sub:block before:content-[''] before:absolute before:-left-3 before:top-0 before:w-3 before:h-full`}
          >
            {renderItems(item.submenu, onClose)}
          </div>
        </div>
      )
    }
    // 分组子菜单（item.items）：渲染为带标题的小工具面板（复刻 H_.jsx:12301-12340 的 vi/_i）
    // items 支持两种形态：
    //   - 普通节点项 [{key, icon, label, badge, onClick, trailing}] → 直接网格
    //   - 分类块     [{key, label, items:[节点项]}]（child 带 items）→ 每块一个标题 + 内部节点网格
    if (item.items && item.items.length) {
      return (
        <div key={item.key} className="relative group/tools">
          <button
            className="w-full text-left px-3.5 py-2 text-caption-sm text-secondary hover:text-primary rounded-xl flex items-center gap-2 justify-between transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="flex items-center gap-2">
              {renderIcon(item.icon, 13)}
              <span>{item.label}</span>
            </span>
            <span className="text-xl text-secondary leading-none">›</span>
          </button>
          {/* 分组子菜单（工具面板）：同样 group-hover 展开 + before 桥防抖（见上一条注释） */}
          <div
            className={`absolute left-full top-0 ml-2 bg-surface-menu border border-white/[0.04] rounded-2xl shadow-popover p-2 w-[360px] z-dropdown hidden group-hover/tools:block before:content-[''] before:absolute before:-left-3 before:top-0 before:w-3 before:h-full`}
          >
            {/* 提示行（复刻 H_.jsx:12301「勾选可固定到右键菜单」） */}
            <div className="px-1 pb-1 text-2xs text-muted">勾选可固定到右键菜单</div>
            {item.items.map((child) =>
              child.items && child.items.length ? (
                // 分类块：标题 + 内部节点网格
                <div key={child.key} className="mb-1.5 last:mb-0">
                  <div className="px-1 py-1 text-2xs text-muted">{child.label}</div>
                  <div className="grid grid-cols-2 gap-0.5">
                    {child.items.map((leaf) => renderToolLeaf(leaf, onClose))}
                  </div>
                </div>
              ) : (
                // 扁平节点列表
                <div key={child.key} className="grid grid-cols-2 gap-0.5">
                  {child.items ? null : renderToolLeaf(child, onClose)}
                </div>
              )
            )}
          </div>
        </div>
      )
    }
    return (
      <button
        key={item.key}
        disabled={item.disabled}
        // onMouseEnter 可选：供调用方做「悬停预热」（如重依赖节点预取 chunk）。
        // 不传则为 undefined，对既有菜单项零行为变化。
        onMouseEnter={item.onMouseEnter}
        onClick={(e) => {
          e.stopPropagation()
          item.onClick?.(e)
          if (item.closeOnClick !== false) onClose()
        }}
        className={`w-full text-left px-3.5 py-2 text-sm rounded-xl flex items-center gap-2.5 justify-between transition-colors ${
          item.danger
            ? 'text-red-400 hover:bg-surface-hover-strong'
            : 'text-primary hover:bg-white/10 hover:text-white'
        } ${item.disabled ? 'opacity-40 pointer-events-none' : ''}`}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          {renderIcon(item.icon, 16)}
          <span className="truncate">{item.label}</span>
        </span>
        {item.shortcut && <span className="text-caption-sm text-muted ml-3 font-mono shrink-0">{item.shortcut}</span>}
      </button>
    )
  })
}
