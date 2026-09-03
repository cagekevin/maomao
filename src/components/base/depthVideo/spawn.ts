/**
 * 深度转视频 —— 下游深度视频节点 spawn（两宿主共用，避免各写一份 spawn 拷贝漂移）。
 *
 * 设计稿 D4/§6.8：照抄 VideoProcessNode.spawnVideoNode 的范式——
 * 用 buildSpawnNodes（自动连 edge：source=源 → target=下游，sourceHandle:'main-output'）
 * + spawnAndCommit（原子提交 setNodes/setEdges/history.record 三连已收口，禁止手写），
 * 位置用 getNode(sourceId).measured.width 计算「源节点右缘」，源在左、结果在右。
 *
 * ⚠️ 出口契约（勿删）：sourceHandle 固定 'main-output'。因此所有「转深度」入口源节点
 * 必须注册一个 id='main-output' 的右侧 source 口，否则 React Flow 找不到句柄会抛
 * code-008 "Couldn't create edge for source handle 'main-output'"。
 * 入口源含：VideoProcessNode、ImageNode、DiscountVideoNode ——
 * 后两者通过 NodeShell 的 sourceHandleId="main-output" 关闭默认空端口、改用 main-output。
 * 若未来新增入口节点，务必照此约定补上 main-output 输出口。
 *
 * 链式：下游是 imageNode(mediaType:'video')，其 hover 同样有「转深度」→ 可继续转深度。
 */

import {
  buildSpawnNodes,
  spawnAndCommit,
  makeChildId,
  type CanvasCommitHandles,
} from '../canvas/deriveNodes.ts'
import type { Node } from '@xyflow/react'
import { buildDepthChildSpec } from './engine.ts'

/** spawn 所需句柄：除提交句柄外，还需 getNode 读取源节点位置/尺寸用于右缘排布 */
export interface DepthSpawnHandles extends CanvasCommitHandles {
  /** 读取源节点（需 position 与 measured.width 计算右缘坐标） */
  getNode(id: string): { id?: string; position?: { x: number; y: number }; measured?: { width?: number } } | null
  /** 语义前缀 id（对齐 VideoProcessNode 的 `video-${id}-${generateId(...)}` 惯例） */
  makeId?: (prefix: string) => string
}

/**
 * 生成下游深度视频节点并原子提交。
 * @param sourceId 源视频节点 id
 * @param url      深度视频落盘 URL（filesApi 上传结果）
 * @param name     深度视频文件名（含实际扩展名，如 xxx_depth.mp4）
 * @returns 新建节点数组（供调用方如需拿 id/样式）
 */
export function spawnDepthVideoNode(
  sourceId: string,
  url: string,
  name: string,
  handles: DepthSpawnHandles
): Node[] {
  const me = getMe(handles.getNode(sourceId))
  const baseX = me.x + me.width + 60
  const baseY = me.y
  const nid = handles.makeId ? handles.makeId('depth-video') : makeChildId('depth-video')
  const spec = buildDepthChildSpec(url, name)
  const spawned = buildSpawnNodes(
    { id: sourceId, position: { x: baseX, y: baseY } },
    [
      {
        id: nid,
        type: spec.type,
        position: { x: baseX, y: baseY },
        data: spec.data,
        style: { width: 420, height: 380 },
      },
    ],
    { sourceHandle: 'main-output' }
  )
  return spawnAndCommit(spawned, handles)
}

/** 源节点位置/宽度归一（缺省回退，与 spawnVideoNode 的 `?? 100` / `?? 540` 对齐） */
function getMe(node: { position?: { x: number; y: number }; measured?: { width?: number } } | null): {
  x: number
  y: number
  width: number
} {
  return {
    x: node?.position?.x ?? 100,
    y: node?.position?.y ?? 100,
    width: node?.measured?.width ?? 540,
  }
}