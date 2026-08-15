import React from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import { FoldVertical, ChevronsUpDown, Folder } from 'lucide-react'
import NodeShell from './base/NodeShell.jsx'
import CustomHandle from './CustomHandle.jsx'

/**
 * 群组 / 分组节点。
 *
 * 复用统一外壳 NodeShell：标题位置、背景、圆角、边框、阴影、尺寸手柄、
 * 端口与所有其它节点完全一致；仅差异化折叠形态（小胶囊 + 子节点 hidden）。
 *
 * 两种形态：
 *  - 折叠态（data.collapsed）：渲染为 h-40px 横向小胶囊，可整体拖动；
 *  - 展开态：NodeShell 容器背景 + 标题栏（双击重命名、折叠按钮）。
 *
 * 由 React Flow 父子节点机制承载：作为父节点，子节点通过 parentId 挂在其下。
 */
export default function GroupNode({ id, data, selected }) {
  const { setNodes } = useReactFlow()
  const collapsed = data?.collapsed || false
  const name = data?.name || '编组'

  // 折叠 / 展开切换（React Flow 官方推荐）：
  //  - 折叠：设 data.collapsed，子节点 hidden:true（原生隐藏），父节点收缩成小胶囊
  //  - 展开：恢复 data.collapsed=false，子节点 hidden:false
  const toggleCollapse = (e) => {
    e.stopPropagation()
    const next = !collapsed
    setNodes((ns) =>
      ns.map((n) => {
        if (n.id === id) {
          if (next) {
            const w = n.style?.width || n.measured?.width || 300
            const h = n.style?.height || n.measured?.height || 200
            return {
              ...n,
              data: { ...n.data, collapsed: true, expandedWidth: w, expandedHeight: h },
              style: { ...n.style, width: 'max-content', height: 40, backgroundColor: 'transparent', border: 'none' }
            }
          }
          return {
            ...n,
            data: { ...n.data, collapsed: false },
            style: {
              ...n.style,
              width: n.data?.expandedWidth || 300,
              height: n.data?.expandedHeight || 200,
              backgroundColor: undefined,
              border: undefined
            }
          }
        }
        // 子节点：随折叠状态隐藏/显示（官方推荐 hidden 字段）
        if (n.parentId === id) {
          return { ...n, hidden: next }
        }
        return n
      })
    )
  }

  // 折叠态：横向小胶囊（不走 NodeShell，NodeShell 强制 min 160 不适用于 40px 胶囊）
  if (collapsed) {
    return (
      <div
        className={`relative flex items-center justify-center bg-surface-raised/80 border border-dashed ${selected ? 'border-edge-strong' : 'border-edge-muted'} rounded-xl px-4 py-2 shadow-lg min-w-[120px] h-[40px] cursor-pointer hover:bg-surface-hover hover:border-edge-strong transition-all duration-300`}
        onClick={toggleCollapse}
      >
        <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-gray-500 !border-gray-600 !opacity-0" />
        <FoldVertical className="w-4 h-4 text-subtle mr-1" />
        <Folder className="w-4 h-4 text-subtle mr-2" />
        <span className="text-gray-300 text-sm select-none">{name}</span>
        <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-gray-500 !border-gray-600 !opacity-0" />
      </div>
    )
  }

  // 展开态：复用统一外壳 NodeShell（标题/背景/边框/阴影/手柄/端口与其它节点一致）
  return (
    <NodeShell
      id={id}
      label={name}
      defaultTitle="编组"
      icon={<Folder size={11} className="text-gray-500" />}
      selected={selected}
      resizable
      minWidth={120}
      minHeight={80}
      keepAspect={false}
      aspectRatio={null}
      defaultHeight={200}
      syncSize={false}
      showHandles={false}
      titleRight={
        <button
          type="button"
          onClick={toggleCollapse}
          className="hover:bg-surface-hover rounded p-0.5 transition-colors cursor-pointer border-none bg-transparent"
          title="折叠"
        >
          <ChevronsUpDown className="w-4 h-4 text-subtle" />
        </button>
      }
    >
      {/* 空容器：外壳背景即 group 背景 */}
      <div className="w-full h-full" />
      {/* 对外出口（右侧 source 端口）：下游连到 group，即自动聚合组内所有子节点产出 */}
      <CustomHandle position="right" variant="small" />
    </NodeShell>
  )
}
