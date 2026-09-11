import React from 'react';
import { Folder } from 'lucide-react';
import NodeShell from '../base/ui/NodeShell.tsx';

/**
 * 群组 / 分组节点。
 *
 * 复用统一外壳 NodeShell：标题位置、背景、圆角、边框、阴影、尺寸手柄、
 * 端口与所有其它节点完全一致。
 *
 * 【2026-09-07 方案 D4】编组折叠态已整体下线——编组只有一种形态（展开框）。
 * 不再渲染小胶囊、不再有折叠按钮，也不再写 data.collapsed / expandedWidth / expandedHeight。
 * （nodeDefaults 仍保留 expandedWidth/expandedHeight 的读取兜底，仅兼容存量快照尺寸，见 S5。）
 *
 * 由 React Flow 父子节点机制承载：作为父节点，子节点通过 parentId 挂在其下。
 */
interface GroupNodeData {
  name?: string;
}
interface GroupNodeProps {
  id: string;
  data: GroupNodeData;
  selected?: boolean;
}
function GroupNode({ id, data, selected }: GroupNodeProps) {
  const name = (data?.name as string | undefined) || '编组';

  return (
    <NodeShell
      id={id}
      label={name}
      defaultTitle="编组"
      icon={<Folder size={11} className="text-muted" />}
      selected={selected}
      resizable
      minWidth={120}
      minHeight={80}
      keepAspect={false}
      aspectRatio={null}
      defaultHeight={200}
      syncSize={false}
      handleVariant="small"
    >
      {/* 空容器：外壳背景即 group 背景 */}
      <div className="w-full h-full" />
      {/* 端口走 NodeShell 标准渲染（默认左右口，handleId=null）：
          下游连到 group 即自动聚合组内所有子节点产出。
          原先手写 CustomHandle 在 children 里，定位基准错误 → 已收口。 */}
    </NodeShell>
  );
}
export default React.memo(GroupNode);
