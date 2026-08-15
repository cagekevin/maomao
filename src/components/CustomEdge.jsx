import React from 'react'
import { getBezierPath, EdgeLabelRenderer, Position, useReactFlow } from '@xyflow/react'
import Comet from './Comet.jsx'

/**
 * 自定义连线（复刻原 Mg.jsx）
 * 三层 path：cust-edge-hit（透明加宽命中层）+ cust-edge-glow（辉光层）+ cust-edge-base（主线）
 * 选中或关联时 is-active → 渲染 Comet 彗星流光。
 * 需配合 App.jsx 里把 edge data 标记 relatedToSelected 才生效。
 */
export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  selected,
  data
}) {
  const relatedToSelected = !!data?.relatedToSelected
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition: Position.Right,
    targetX,
    targetY,
    targetPosition: Position.Left
  })

  const { deleteElements } = useReactFlow()
  const removeEdge = (evt) => {
    evt.stopPropagation()
    // 用 ReactFlow 官方 deleteElements 删边（比自定义事件更可靠）
    deleteElements({ edges: [{ id }] })
  }

  const active = !!selected || !!relatedToSelected // 触发特效（comet + 加亮）
  const mpathId = `cust-edge-mpath-${id}`

  return (
    <>
      {/* 隐藏 path，供 comet <animateMotion> 引用 */}
      {active && (
        <path id={mpathId} d={path} fill="none" stroke="none" style={{ pointerEvents: 'none' }} />
      )}

      {/* 透明加宽命中层 */}
      <path d={path} className="cust-edge-hit" />

      {/* 辉光层（仅激活时渲染） */}
      {active && <path d={path} className="cust-edge-glow is-active" />}

      {/* 主线 */}
      <path
        d={path}
        className={`cust-edge-base ${active ? 'is-active' : ''}`}
        markerEnd={typeof markerEnd === 'string' ? markerEnd : undefined}
      />

      {/* 彗星流光（仅激活时渲染） */}
      {active && <Comet pathRef={mpathId} edgeId={id} isActive={true} />}

      {/* 删除按钮（选中节点联动或点选连线时，显示在连线中点） */}
      {active && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 12,
              pointerEvents: 'all',
              opacity: 1,
              zIndex: 1000,
              transition: 'opacity 0.2s'
            }}
            className="nodrag nopan group/edge hover:opacity-100"
            onPointerDown={(e) => e.stopPropagation()} // 阻止画布拖拽/选中接管，确保点击可靠
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="bg-white hover:bg-gray-100 text-gray-600 rounded-full w-5 h-5 flex items-center justify-center shadow-lg border border-gray-300 cursor-pointer transition-colors"
              onClick={removeEdge}
              title="删除连线"
            >
              ×
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
