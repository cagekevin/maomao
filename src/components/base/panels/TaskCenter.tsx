import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  MoreVertical,
  Copy,
  Play,
  RotateCw,
  Trash2,
  X,
  RefreshCw,
  ChevronDown,
  Download,
  Image as ImageIcon,
} from 'lucide-react';
import {
  statusLabel,
  typeLabel,
  removeTask,
  retryTask,
  clearTasksBy,
  clearAllTasks,
  type Task,
  useTasks,
  statusDotClass,
} from '../store/taskStore.ts';
import { logger } from '../core/logger.ts';
import { downloadUrl } from '../utils/clipboard.ts';
import { showToast } from '../core/toastStore.ts';
import { makeAssetDragProps } from '../../../hooks/useAssetDragToCanvas.ts';
import VideoThumbnail from '../ui/VideoThumbnail.tsx';
import ImageZoomDialog from '../editors/ImageZoomDialog.tsx';
import { useRenderImageResolver } from '../utils/imageUrl.ts';
import { useOutsideClick } from '../core/uiHooks.ts';
import { formatTime } from '../core/utils.ts';
import { PanelSubBar, PanelMoreMenu } from './PanelBar.tsx';

const TYPE_ICON = {
  image: ImageIcon,
  video: Play,
  text: ImageIcon,
};

/**
 * 任务中心（对齐官方 Ln.jsx + jn.jsx 卡片）。
 * Header：标题+总数+过滤toggle+关闭；过滤区：搜索/状态下拉/类型下拉/一键清理；
 * 卡片：状态圆点+文案 · 类型+模型 · 操作；提示词；时间；进度条；错误块；缩略图；更多菜单。
 */
function TaskCenter() {
  const tasks = useTasks();
  const [moreOpenId, setMoreOpenId] = useState(null);
  // 大图/视频预览（点击缩略图打开；图片显示像素/可拖到画布，视频走统一 ImageZoomDialog 播放器）
  const [preview, setPreview] = useState<{ url: string; type: string } | null>(null);
  const [previewDims, setPreviewDims] = useState(null); // { w, h }
  const videoZoomRef = useRef<HTMLDialogElement>(null); // 视频预览统一走 ImageZoomDialog（含截屏/下载当前帧）

  // 视频预览：preview 变为视频时，等 dialog 挂载后自动 showModal（与 GeneratedView/生成面板一致）
  useEffect(() => {
    if (preview && preview.type === 'video') {
      videoZoomRef.current?.showModal();
    }
  }, [preview]);

  // 运行/失败计数合并为单次遍历，避免每次渲染跑两次全量 filter
  const counts = useMemo(() => {
    let running = 0;
    let failed = 0;
    for (const t of tasks) {
      if (t.status === 'running' || t.status === 'pending') running++;
      else if (t.status === 'failed') failed++;
    }
    return { running, failed };
  }, [tasks]);
  const runningCount = counts.running;
  const failedCount = counts.failed;

  const copyPrompt = (t) => {
    try {
      navigator.clipboard.writeText(t.prompt || '');
      showToast('已复制提示词', { type: 'success' });
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 副工具条（无 pill / 无搜索 —— 按用户裁定去掉）：左侧统计，右侧 ⋯ = 清理菜单（视觉统一走 panel-kit） */}
      <PanelSubBar>
        <span className="pk-stat">
          <b>{runningCount}</b> 生成中 · <b>{failedCount}</b> 失败
        </span>
        <PanelMoreMenu
          title="清理任务"
          items={[
            {
              key: 'clean-failed',
              label: `清理失败任务 (${failedCount})`,
              icon: Trash2,
              danger: true,
              disabled: failedCount === 0,
              onClick: () => clearTasksBy((t) => t.status === 'failed'),
            },
            {
              key: 'clean-all',
              label: `清理全部任务 (${tasks.length})`,
              icon: Trash2,
              disabled: tasks.length === 0,
              onClick: () => clearAllTasks(),
            },
          ]}
        />
      </PanelSubBar>

      {/* 任务列表 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2.5 py-2">
        {tasks.length === 0 ? (
          <div className="h-full flex items-center justify-center text-faint text-sm">暂无任务</div>
        ) : (
          <div className="flex flex-col gap-2">
            {tasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                moreOpen={moreOpenId === t.id}
                onToggleMore={() => setMoreOpenId(moreOpenId === t.id ? null : t.id)}
                onCloseMore={() => setMoreOpenId(null)}
                onCopy={() => copyPrompt(t)}
                onRetry={() => {
                  const ok = retryTask(t.id);
                  setMoreOpenId(null);
                  showToast(ok ? '已重新生成' : '找不到对应节点，请在画布上重新生成', {
                    type: ok ? 'info' : 'warning',
                  });
                }}
                onRemove={() => {
                  removeTask(t.id);
                  setMoreOpenId(null);
                  showToast('已删除', { type: 'success' });
                }}
                onPreview={(task) => {
                  setPreviewDims(null);
                  setPreview({ url: task.resultUrl, type: task.type });
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* 大图预览弹窗（图片；点击缩略图打开，右下角显示像素，如 1920×1080）；图片可拖拽到画布成为节点 */}
      {preview && preview.type !== 'video' && (
        <div
          className="absolute inset-0 z-20 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={preview.url}
              alt="预览"
              {...makeAssetDragProps({ url: preview.url, name: '预览', type: 'image' })}
              draggable
              className="max-h-[80vh] max-w-full rounded-lg object-contain cursor-grab active:cursor-grabbing"
              onLoad={(e) => {
                const el = e.currentTarget;
                if (el.naturalWidth && el.naturalHeight)
                  setPreviewDims({ w: el.naturalWidth, h: el.naturalHeight });
              }}
            />
            {/* 拖拽提示角标 */}
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white/80 text-caption-sm pointer-events-none select-none">
              按住拖到画布添加
            </span>
            {/* 右下角像素角标 */}
            {previewDims && (
              <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-white text-caption-sm pointer-events-none">
                {previewDims.w}×{previewDims.h}
              </span>
            )}
            <button
              className="absolute top-2 right-2 w-8 h-8 rounded-md bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors cursor-pointer border-none"
              onClick={() => setPreview(null)}
              title="关闭"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
      {/* 视频预览：与生成面板一致，走统一 ImageZoomDialog 视频播放器（含截屏/下载当前帧） */}
      {preview && preview.type === 'video' && (
        <ImageZoomDialog
          ref={videoZoomRef}
          url={preview.url}
          kind="video"
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

/** 单条任务卡片 Props（对齐官方 jn.jsx）。 */
interface TaskCardProps {
  task: Task;
  moreOpen: boolean;
  onToggleMore: () => void;
  onCloseMore: () => void;
  onCopy: () => void;
  onRetry: () => void;
  onRemove: () => void;
  onPreview: (task: Task) => void;
}

// 单条任务卡片（对齐官方 jn.jsx）
const TaskCard = React.memo(function TaskCard({
  task,
  moreOpen,
  onToggleMore,
  onCloseMore,
  onCopy,
  onRetry,
  onRemove,
  onPreview,
}: TaskCardProps) {
  const render = useRenderImageResolver();
  const [showData, setShowData] = useState(false);
  const menuRef = useRef(null); // 任务卡片「⋮」更多菜单容器 ref，点击外部自动关闭
  useOutsideClick(menuRef, moreOpen, () => onCloseMore?.());
  const TypeIcon = TYPE_ICON[task.type] || ImageIcon;
  const dot = statusDotClass(task.status);
  const statusText = statusLabel(task.status, task.progress);
  const isActive = task.status === 'running' || task.status === 'pending';
  const isCompleted = task.status === 'completed';

  // 真实下载任务结果（fetch blob → downloadUrl，可控文件名）
  const downloadResult = async (e) => {
    if (e?.stopPropagation) e.stopPropagation();
    if (!task.resultUrl) {
      showToast('没有可下载的结果', { type: 'warning' });
      return;
    }
    try {
      const ext = task.type === 'video' ? '.mp4' : task.type === 'text' ? '.txt' : '.png';
      const filename = `${task.modelName || 'task'}_${Date.now()}${ext}`;
      const res = await downloadUrl(task.resultUrl, filename);
      if (res?.ok) showToast('已开始下载', { type: 'success' });
      else showToast('下载失败', { type: 'error' });
    } catch (err) {
      logger.warn('TaskCenter', '下载失败', err?.message);
      showToast('下载失败', { type: 'error' });
    }
  };

  return (
    <div
      className="px-1.5 py-2 flex flex-col gap-2 border-b border-edge-subtle last:border-b-0"
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 140px' }}
    >
      {/* 第一行：状态圆点+文案 · 类型+模型 | 操作 */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
        <span
          className={`text-caption-sm flex-shrink-0 ${task.status === 'failed' ? 'text-red-400' : isActive ? 'text-blue-400' : 'text-emerald-400'}`}
        >
          {statusText}
        </span>
        <span className="text-subtle">·</span>
        <span className="flex items-center gap-1 text-caption-sm text-body flex-shrink-0">
          <TypeIcon size={11} /> {typeLabel(task.type)}
        </span>
        {task.modelName && (
          <span className="text-caption text-faint truncate flex-shrink-0">{task.modelName}</span>
        )}
        <div className="ml-auto flex items-center gap-1 flex-shrink-0">
          <button
            className="w-6 h-6 flex items-center justify-center rounded-md text-muted hover:text-white hover:bg-surface-hover-2 transition-colors cursor-pointer border-none"
            title="复制提示词"
            onClick={onCopy}
          >
            <Copy size={12} />
          </button>
          {isActive && (
            <span className="w-6 h-6 flex items-center justify-center">
              <RotateCw size={12} className="animate-spin text-blue-400" />
            </span>
          )}
          <div ref={menuRef} className="relative">
            <button
              className="w-6 h-6 flex items-center justify-center rounded-md text-muted hover:text-white hover:bg-surface-hover-2 transition-colors cursor-pointer border-none"
              onClick={onToggleMore}
              title="更多操作"
            >
              <MoreVertical size={13} />
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full mt-1 bg-surface-1 border border-edge rounded-lg shadow-xl p-1 z-30 w-40 nowheel nopan nodrag">
                {isCompleted && (
                  <MenuBtn icon={Download} label="下载结果" onClick={downloadResult} />
                )}
                <MenuBtn icon={RefreshCw} label="再来一次" onClick={onRetry} />
                <MenuBtn icon={Copy} label="复制任务信息" onClick={onCopy} />
                <div className="h-[1px] bg-surface-hover-strong my-1" />
                <MenuBtn icon={Trash2} label="删除任务" onClick={onRemove} danger />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 提示词 */}
      <p
        className="text-body-xs text-secondary leading-[1.5] m-0"
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {task.prompt || '(无提示词)'}
      </p>

      {/* 时间 */}
      <div className="text-caption text-faint">{formatTime(task.createdAt)}</div>

      {/* 运行中：阶段文案 + 进度条 */}
      {isActive && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-caption text-blue-300/80">
            <span className="text-caption-sm">{task.stageLabel || '生成中…'}</span>
            <span className="text-subtle">·</span>
            <span className="text-caption-sm tabular-nums">
              {Math.min(100, Math.max(0, task.progress || 0))}%
            </span>
          </div>
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-400 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, task.progress || 0))}%` }}
            />
          </div>
        </div>
      )}

      {/* 错误块 */}
      {task.status === 'failed' && task.errorMsg && (
        <div className="flex items-center gap-2 bg-red-500/5 border border-red-500/20 rounded-lg px-2 py-1.5">
          <span className="text-body-xs">⚠️</span>
          <span className="text-caption-sm text-red-400/90 truncate flex-1">{task.errorMsg}</span>
        </div>
      )}

      {/* 已完成缩略图：点击打开大图预览（预览弹窗右下角显示原图像素）；视频点击大图播放 */}
      {isCompleted && task.resultUrl && (
        <div
          className="relative w-full h-[72px] rounded-lg overflow-hidden bg-surface-muted group cursor-pointer"
          onClick={() => {
            if (typeof onPreview === 'function' && task.type === 'image') onPreview(task);
          }}
        >
          {task.type === 'video' ? (
            <VideoThumbnail
              src={task.resultUrl}
              className="w-full h-full"
              onActivate={() => {
                if (typeof onPreview === 'function') onPreview(task);
              }}
            />
          ) : (
            <img
              src={render(task.resultUrl)}
              alt={task.modelName || '结果图'}
              {...makeAssetDragProps({
                url: task.resultUrl,
                name: task.modelName || '结果图',
                type: task.type,
              })}
              draggable
              className="w-full h-full object-cover block cursor-grab active:cursor-grabbing"
            />
          )}
          <button
            className="absolute top-1 right-1 w-6 h-6 rounded-md bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none"
            onClick={downloadResult}
            title="下载结果"
          >
            <Download size={12} />
          </button>
        </div>
      )}

      {/* 展开请求/响应数据 */}
      <button
        className="flex items-center gap-1 text-caption text-faint hover:text-secondary transition-colors cursor-pointer border-none bg-transparent"
        onClick={() => setShowData((v) => !v)}
      >
        <ChevronDown size={11} className={`transition-transform ${showData ? 'rotate-180' : ''}`} />{' '}
        请求/响应数据
      </button>
      {showData && (
        <pre className="text-caption text-faint bg-surface-muted border border-edge rounded-lg p-2 overflow-auto max-h-[140px] whitespace-pre-wrap">
          {JSON.stringify(
            {
              id: task.id,
              nodeId: task.nodeId,
              status: task.status,
              type: task.type,
              modelName: task.modelName,
              channelName: task.channelName,
              prompt: task.prompt,
              createdAt: task.createdAt,
            },
            null,
            2,
          )}
        </pre>
      )}
    </div>
  );
});

/** 任务卡片「⋮」菜单项（icon + label + onClick）。 */
interface MenuBtnProps {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: (e: React.MouseEvent) => void | Promise<unknown>;
  danger?: boolean;
}

const MenuBtn = React.memo(function MenuBtn({ icon: Icon, label, onClick, danger }: MenuBtnProps) {
  return (
    <button
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-caption-sm transition-colors cursor-pointer border-none text-left ${danger ? 'text-red-400 hover:bg-red-500/10' : 'text-body hover:bg-surface-hover-2 hover:text-white'}`}
      onClick={onClick}
    >
      <Icon size={12} /> {label}
    </button>
  );
});

export default React.memo(TaskCenter);
