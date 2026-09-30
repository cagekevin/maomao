import React from 'react';
import { getBezierPath, Position, type ConnectionLineComponentProps } from '@xyflow/react';
import CometParticles from '@/components/canvas/edges/CometParticles';

/**
 * 拖拽中的临时连线（复刻原 Pg.jsx）
 * 与选中 comet 同一套视觉：cust-edge-glow + cust-edge-base is-active + 粒子流光。
 * 固定 sourcePosition:Right / targetPosition:Left。
 *
 * 【2026-09-30】原 LOD 降级（`lodLevel >= 2` 时关辉光 + 粒子）已删 —— 拖拽线是**交互反馈**：
 * 性能模式隐藏它 = 用户拖拽时看不见线、不知道连到哪（能力受损，不是"降级"）。
 * 且拖拽线同时只有 1 条，渲染成本可忽略。
 * 性能模式的边降级只作用于**正式边**（`.react-flow__edge` 限定，见 index.css）。
 */
function ConnectionLine({ fromX, fromY, toX, toY }: ConnectionLineComponentProps) {
  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: Position.Right,
    targetX: toX,
    targetY: toY,
    targetPosition: Position.Left,
  });

  const mpathId = 'cust-conn-mpath';

  return (
    <g fill="none">
      <path id={mpathId} d={path} fill="none" stroke="none" />
      <path d={path} fill="none" className="cust-edge-glow is-active" />
      <path d={path} fill="none" className="cust-edge-base is-active" />

      <CometParticles pathId={mpathId} uid="conn" headRadius={3.6} />
    </g>
  );
}
export default React.memo(ConnectionLine);
