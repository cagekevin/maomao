import { useEffect, useRef, useState } from 'react'
import { Box, ChevronRight, CircleDot, Grid3X3, Import, Layers, UserRound } from 'lucide-react'

// 资源库菜单：层级完全自适应数据本身，有几层就渲染几列，不写死级数。
// 叶子节点 kind 决定动作：
//   person    -> onAddPerson(value)
//   primitive -> onAddPrimitive(value)
//   import    -> 触发文件选择（onImport）
// 注意：动作预设不在资源库内（它属于右侧 Inspector 选中人物时的设置），不要在这里加。
// 注意：不要为了凑"3 级"而塞无意义的子分类层（如"体型""基础几何体"），数据本身只有两级就两级。
const ASSET_TREE = [
  {
    label: '人物',
    icon: UserRound,
    children: [
      { label: '标准人物', subtitle: '中性比例 · 可换动作', kind: 'person', value: 'standard' },
      { label: '女性人体', subtitle: '窄肩宽髋 · 真人比例', kind: 'person', value: 'female' },
      { label: '男性人体', subtitle: '宽肩躯干 · 真人比例', kind: 'person', value: 'male' },
      { label: '修长人物', subtitle: '高挑比例 · 适合走位', kind: 'person', value: 'tall' },
      { label: '宽体人物', subtitle: '厚重比例 · 强轮廓', kind: 'person', value: 'broad' },
    ],
  },
  {
    label: '物体',
    icon: Box,
    children: [
      { label: '方块', kind: 'primitive', value: 'box' },
      { label: '球体', kind: 'primitive', value: 'sphere' },
      { label: '圆柱', kind: 'primitive', value: 'cylinder' },
      { label: '平面', kind: 'primitive', value: 'plane' },
    ],
  },
  {
    label: '场景粗模',
    icon: Layers,
    children: [
      { label: '拱门', kind: 'primitive', value: 'arch' },
      { label: '楼梯', kind: 'primitive', value: 'stairs' },
      { label: '门', kind: 'primitive', value: 'door' },
      { label: '窗', kind: 'primitive', value: 'window' },
      { label: '桌子', kind: 'primitive', value: 'table' },
      { label: '椅子', kind: 'primitive', value: 'chair' },
      { label: '沙发', kind: 'primitive', value: 'sofa' },
      { label: '屋顶', kind: 'primitive', value: 'roof' },
      { label: '树木', kind: 'primitive', value: 'tree' },
      { label: '车辆', kind: 'primitive', value: 'vehicle' },
    ],
  },
  {
    label: '导入模型',
    icon: Import,
    leaf: true,
    kind: 'import',
  },
]

const PRIMITIVE_ICON = { box: Box, sphere: CircleDot, cylinder: CircleDot, plane: Grid3X3 }

function isLeaf(node) {
  return node.leaf || !node.children || node.children.length === 0
}

export function AssetMenu({ onAddPerson, onAddPrimitive, onImport }) {
  const [open, setOpen] = useState(false)
  // path 记录当前展开路径，例如 [2] 表示展开了"场景粗模"那一列。列数 = path.length + 1，自适应数据深度。
  const [path, setPath] = useState([])
  const rootRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = event => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
    }
    const onKey = event => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const close = () => { setOpen(false); setPath([]) }

  const pick = node => {
    if (node.kind === 'person') onAddPerson(node.value)
    else if (node.kind === 'primitive') onAddPrimitive(node.value)
    else if (node.kind === 'import') fileRef.current?.click()
    close()
  }

  // 根据 path 逐级取出每一列要渲染的节点列表
  const columns = [ASSET_TREE]
  let cursor = ASSET_TREE
  for (const idx of path) {
    const next = cursor[idx]?.children
    if (!next) break
    columns.push(next)
    cursor = next
  }

  const enterColumn = (depth, index) => {
    // depth 为当前列的层级（0 起），点击后展开/收起对应下一列
    const base = path.slice(0, depth)
    if (path[depth] === index) {
      // 再次 hover 同一项不重复；点击有子项的项则展开到这一级
      setPath([...base, index])
    } else {
      setPath([...base, index])
    }
  }

  return (
    <div className="asset-menu-root" ref={rootRef}>
      <button
        type="button"
        className={`asset-menu-trigger ${open ? 'is-open' : ''}`}
        onClick={() => { open ? close() : setOpen(true) }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Layers size={14} /> 资源库
      </button>
      {open && (
        <div className="asset-menu-panel" role="menu">
          {columns.map((col, depth) => (
            <ul className="asset-menu-col" key={depth}>
              {col.map((node, i) => {
                const selected = path[depth] === i
                const leaf = isLeaf(node)
                return (
                  <li
                    key={node.label}
                    className={`asset-menu-item ${selected ? 'is-active' : ''} ${leaf ? 'is-leaf' : ''}`}
                    onMouseEnter={() => { if (!leaf) enterColumn(depth, i) }}
                    onClick={() => leaf ? pick(node) : enterColumn(depth, i)}
                  >
                    {node.icon && depth === 0 && <node.icon size={15} strokeWidth={1.4} />}
                    <span>{node.label}</span>
                    {!leaf && <ChevronRight size={13} className="asset-menu-caret" />}
                  </li>
                )
              })}
            </ul>
          ))}
        </div>
      )}
      <input ref={fileRef} className="visually-hidden" type="file" accept=".glb,.gltf" onChange={onImport} />
    </div>
  )
}
