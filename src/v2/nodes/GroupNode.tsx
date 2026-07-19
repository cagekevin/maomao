// ============================================================
// GroupNode - 编组节点
// 严格 1:1 复刻原版 App.js Eh 函数
// ============================================================
import { memo, useState, useRef, useEffect } from 'react';
import { NodeProps, Position, Handle, useReactFlow } from '@xyflow/react';
import { FolderOpen, ChevronDown } from 'lucide-react';
import type { AppNode } from '../types';

function GroupNode({ id, data, selected }: NodeProps<AppNode>) {
  let { updateNodeData, setNodes } = useReactFlow();
  let [editing, setEditing] = useState(false);
  let [name, setName] = useState(data?.name || `编组`);
  let inputRef = useRef<HTMLInputElement>(null);
  let collapsed = data?.collapsed || false;

  useEffect(() => {
    editing && inputRef.current && (inputRef.current.focus(), inputRef.current.select());
  }, [editing]);

  let onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  let finishEdit = () => {
    setEditing(false);
    updateNodeData(id, { name });
  };

  let onKeyDown = (e: React.KeyboardEvent) => {
    e.key === `Enter` && finishEdit();
  };

  let toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    let next = !collapsed;
    setNodes((nodes: AppNode[]) =>
      nodes.map((node: AppNode) => {
        if (node.id === id) {
          if (next) {
            let w = node.style?.width || node.measured?.width || 300;
            let h = node.style?.height || node.measured?.height || 200;
            return {
              ...node,
              data: {
                ...node.data,
                collapsed: true,
                expandedWidth: w,
                expandedHeight: h,
              },
              style: {
                ...node.style,
                width: `max-content`,
                height: 40,
                backgroundColor: `transparent`,
                border: `none`,
              },
            };
          } else {
            return {
              ...node,
              data: {
                ...node.data,
                collapsed: false,
              },
              style: {
                ...node.style,
                width: node.data?.expandedWidth || 300,
                height: node.data?.expandedHeight || 200,
                backgroundColor: undefined,
                border: undefined,
              },
            };
          }
        }
        return node;
      })
    );
  };

  return collapsed ? (
    <div
      className={`relative flex items-center justify-center bg-[#2a1f24] border border-dashed ${selected ? `border-[#555]` : `border-[#444]`} rounded-xl px-4 py-2 shadow-lg min-w-[120px] h-[40px] cursor-pointer hover:bg-[#352a30] hover:border-gray-400 transition-all duration-300`}
      onClick={toggleCollapse}
    >
      <Handle
        type="target"
        position={Position.Left}
        className={`!w-2 !h-2 !bg-gray-500 !border-gray-600 !opacity-0`}
      />
      <FolderOpen className={`w-4 h-4 text-gray-400 mr-1`} />
      <ChevronDown className={`w-4 h-4 text-[#8b92a5] mr-2`} />
      <span className={`text-gray-300 text-sm select-none`}>{name}</span>
      <Handle
        type="source"
        position={Position.Right}
        className={`!w-2 !h-2 !bg-gray-500 !border-gray-600 !opacity-0`}
      />
    </div>
  ) : (
    <div
      className={`relative w-full h-full rounded-xl transition-all duration-300 ${selected ? `border border-[#555]` : `border border-transparent hover:border-white/10`} bg-[#1e171b]/50 hover:bg-[#161214] group`}
    >
      <div
        className={`absolute -top-8 left-0 flex items-center px-2 py-1`}
        onDoubleClick={() => setEditing(true)}
      >
        <button
          onClick={toggleCollapse}
          className={`mr-1 hover:bg-white/10 rounded p-0.5 transition-colors`}
        >
          <ChevronDown className={`w-4 h-4 text-gray-500 group-hover:text-gray-300`} />
        </button>
        <ChevronDown className={`w-4 h-4 text-[#8b92a5] mr-1.5`} />
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={onNameChange}
            onBlur={finishEdit}
            onKeyDown={onKeyDown}
            className={`bg-[#2a2a2a] border border-[#444] rounded outline-none text-gray-200 text-sm w-32 focus:border-blue-500 px-1 py-0.5`}
          />
        ) : (
          <span
            className={`text-gray-400 group-hover:text-gray-300 text-sm select-none cursor-text transition-colors`}
          >
            {name}
          </span>
        )}
      </div>
    </div>
  );
}

export default memo(GroupNode);