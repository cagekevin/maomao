import { Upload } from 'lucide-react';

interface MediaDragOverlayProps {
  isVisible: boolean;
  isProcessing?: boolean;
  progress?: number;
  onClick?: () => void;
}

export function MediaDragOverlay({
  isVisible,
  isProcessing = false,
  progress = 0,
  onClick,
}: MediaDragOverlayProps) {
  if (!isVisible) return null;

  /**
   * 【不因 isProcessing 而禁用】——本组件是**导入入口**，任何时刻都必须可点。
   * 处理中只把文案/进度条切到进度态（见下方），不阻断再次导入：
   *   · `disabled` 会让 `pointer-events: none` 指针穿透，用户以为"点了没反应"；
   *   · 且用户有权随时导下一批（每批独立处理）。
   * 仅在**没有回调**时禁用（那是真的不可用）。
   */
  const handleClick = ({ event }: { event: React.MouseEvent<HTMLButtonElement> }) => {
    if (!onClick) return;
    event.preventDefault();
    event.stopPropagation();
    onClick();
  };

  return (
    <button
      className="bg-foreground/5 hover:bg-foreground/10 flex w-full flex-1 flex-col items-center justify-center gap-4 rounded-lg p-8 text-center"
      type="button"
      disabled={!onClick}
      aria-busy={isProcessing}
      onClick={(event) => handleClick({ event })}
    >
      <div className="flex items-center justify-center">
        <Upload className="text-foreground size-10" />
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground max-w-sm text-xs">
          {isProcessing ? `正在处理文件（${progress}%）` : '将视频、图片和音频文件拖放到此处'}
        </p>
      </div>

      {isProcessing && (
        <div className="w-full max-w-xs">
          <div className="bg-muted/50 h-2 w-full rounded-full">
            <div className="bg-primary h-2 rounded-full" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </button>
  );
}
