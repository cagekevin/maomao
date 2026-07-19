// GhostTarget - 幽灵目标节点（透明占位，用于连线锚点）
// 原版函数名: Nh (L28852-L28873)
import { Handle, Position } from '@xyflow/react';

export default function GhostTarget() {
  return (
    <div style={{ width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}>
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: 'transparent', border: 0, width: 1, height: 1, opacity: 0 }}
        isConnectable={false}
      />
    </div>
  );
}
