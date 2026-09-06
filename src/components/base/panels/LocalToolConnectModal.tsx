import React from 'react';
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';

/**
 * 本地引擎未连接 —— 居中警告弹窗。
 *
 * 【视觉】走项目自身的暗色面板语言（与 LeftPanel / 任务卡片同尺度同色阶）：
 *   · 卡片：bg-input + border-edge-faint + rounded-2xl + shadow-2xl
 *   · 顶部：红色警告图标（圆形浅底），下接标题/说明的居中文本块
 *   · 状态行：状态圆点 + 文案（同任务卡片状态行：未连接=红，检测中=蓝）
 *   · 按钮：次要（描边）+ 主（蓝），等高 h-8 / rounded-lg / text-caption-sm
 * 不做 1-2-3 步骤引导，只给「是什么 + 怎么办 + 重试」三件事。
 *
 * props：
 *  - isVisible: boolean    是否显示
 *  - onClose: () => void   点「稍后再说」（父层还需标记「用户已关闭」避免再次自动弹）
 *  - onRetry: () => void   点「重试连接」（父层传 checkConnection）
 */
export interface LocalToolConnectModalProps {
  /** 是否显示 */
  isVisible: boolean;
  /** 点「稍后再说」（父层还需同时标记「用户已关闭」避免再次自动弹） */
  onClose: () => void;
  /** 点「重试连接」（父层传 checkConnection） */
  onRetry: () => void;
}

/** 行内标记（工具名 / 端口）：等宽 + 蓝底胶囊 */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-1.5 py-[1px] mx-0.5 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-300 font-mono text-caption-sm align-baseline">
      {children}
    </span>
  );
}

export default function LocalToolConnectModal({
  isVisible,
  onClose,
  onRetry,
}: LocalToolConnectModalProps) {
  const [retrying, setRetrying] = React.useState(false);
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-modal bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-[440px] max-w-full bg-input border border-edge-faint rounded-2xl shadow-2xl px-7 py-8 flex flex-col items-center text-center animate-slide-up">
        {/* 警告图标 */}
        <div className="w-14 h-14 mb-4 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center">
          <AlertTriangle size={26} className="text-red-400" />
        </div>

        {/* 标题 + 说明 */}
        <h2 className="m-0 text-lg text-strong font-semibold">本地引擎未连接</h2>
        <p className="mt-2.5 mb-0 text-body-sm text-secondary leading-[1.6]">
          系统功能需要 <Chip>localTool</Chip> 工具支持
        </p>
        <p className="mt-1.5 mb-0 text-body-sm text-muted leading-[1.6]">
          请启动本地服务（默认端口 <Chip>18080</Chip>）后重试
        </p>

        {/* 状态行（同任务卡片：未连接=红，检测中=蓝） */}
        <div className="mt-5 flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${retrying ? 'bg-blue-400' : 'bg-red-500'}`}
          />
          <span className={`text-body-xs ${retrying ? 'text-blue-400' : 'text-red-400'}`}>
            {retrying ? '正在检测连接…' : '未检测到 localTool 连接'}
          </span>
        </div>

        {/* 操作 */}
        <div className="mt-6 w-full flex items-center gap-3">
          <button
            type="button"
            className="flex-1 h-9 rounded-lg border border-edge bg-transparent text-body-sm text-secondary hover:bg-surface-hover hover:text-primary transition-colors cursor-pointer"
            onClick={onClose}
          >
            稍后再说
          </button>
          <button
            type="button"
            disabled={retrying}
            className="flex-1 h-9 rounded-lg flex items-center justify-center gap-2 text-body-sm font-medium text-white transition-colors cursor-pointer border-none bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed"
            onClick={() => {
              setRetrying(true);
              onRetry();
              setTimeout(() => setRetrying(false), 2000);
            }}
          >
            {retrying ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {retrying ? '检测中…' : '重试连接'}
          </button>
        </div>
      </div>
    </div>
  );
}
