// ============================================================
// 一毛AI画布 - Resize 控制器共享组件
// ============================================================
import { memo } from 'react';

interface ResizeControllerProps {
  visible: boolean;
}

function ResizeController({ visible }: ResizeControllerProps) {
  if (!visible) return null;

  return (
    <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-0 hover:opacity-100 transition-opacity nodrag">
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        className="text-gray-500"
      >
        <path
          d="M14 14L14 8M14 14L8 14"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M14 11L11 14"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export default memo(ResizeController);