// ============================================================
// NodeTitle - 节点标题栏组件
// ============================================================
import { memo, useState, useEffect } from 'react';
import type { NodeData, AppNode } from '../types';

interface NodeTitleProps {
  id: string;
  data: NodeData;
  defaultTitle: string;
  icon: React.ReactNode;
  floating?: boolean;
}

function NodeTitle({ data, defaultTitle, icon }: NodeTitleProps) {
  const [title, setTitle] = useState(data.label || defaultTitle);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (data.label !== undefined) {
      setTitle(data.label);
    }
  }, [data.label]);

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-gray-400 select-none">
      {icon}
      {isEditing ? (
        <input
          autoFocus
          className="bg-transparent text-[11px] text-gray-300 outline-none border-b border-[#555] w-24 px-0.5"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            setIsEditing(false);
            data.onUpdateLabel?.(title);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setIsEditing(false);
              data.onUpdateLabel?.(title);
            }
          }}
        />
      ) : (
        <span
          className="cursor-text hover:text-gray-200 transition-colors"
          onDoubleClick={() => setIsEditing(true)}
        >
          {title}
        </span>
      )}
    </div>
  );
}

export default memo(NodeTitle);