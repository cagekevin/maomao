import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Pen } from 'lucide-react';

/**
 * 轻量改名弹窗（右键菜单「重命名」专用，见 docs/108-节点右键菜单新增重命名 §4.3）。
 *
 * 【定位】非通用输入基座：仅服务「节点改名」单一场景（App 层 renameTarget state 驱动）。
 *  若未来出现多处「输入类弹窗」需求，再升级为 renameStore/askRename 模块级 store 范式
 *  （对齐 confirmStore/toastStore），本组件不做复用改造。
 *
 * 【层级】z-ceiling-2（与 ConfirmContainer 同级）：模态遮罩必须盖住画布与右键菜单。
 *
 * 【交互契约（与全仓弹窗心智一致）】
 *  - 打开时 autoFocus + 全选预填名；Enter 提交、Esc / 遮罩点击 / 取消按钮 = onCancel；
 *  - 提交即调 onSubmit(name)（已由调用方 App.commitRename 判空/判未变）；
 *  - 输入框带 nodrag，防 React Flow 画布拖拽冒泡（浮在节点上也不误拖节点）；
 *  - 关闭/卸载时本地 state 随 open 重置（下次打开用新 initial，不残留）。
 */
interface RenameDialogProps {
  open: boolean;
  initial?: string; // 预填当前名（可能为空）
  placeholder?: string; // 默认「未命名节点」
  onCancel: () => void;
  onSubmit: (name: string) => void; // 已 trim，空值由调用方决定忽略
}

function RenameDialog({
  open,
  initial = '',
  placeholder = '未命名节点',
  onCancel,
  onSubmit,
}: RenameDialogProps) {
  const [name, setName] = useState(initial);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 每次打开用新 initial 重置本地 state（关闭再开不残留旧输入）
  useEffect(() => {
    if (open) setName(initial);
  }, [open, initial]);

  // autoFocus + 全选，键盘直达（与 ConfirmContainer 聚焦确认按钮同语义）
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [open]);

  // Esc = 取消（与 ConfirmContainer 同语义，capture 防被画布快捷键先吃掉）
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-ceiling-2 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onCancel}
      onContextMenu={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label="重命名节点"
    >
      <div
        className="w-full max-w-sm bg-surface-raised border border-edge rounded-xl shadow-2xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部：图标 + 标题（对齐 ConfirmContainer 头部） */}
        <div className="flex items-start gap-2 px-4 pt-4 pb-2">
          <Pen size={14} className="text-secondary mt-0.5 shrink-0" />
          <div className="text-white text-body-sm font-medium leading-relaxed">重命名</div>
        </div>

        {/* 输入区 */}
        <div className="px-4 pb-4">
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSubmit(name);
              }
            }}
            placeholder={placeholder}
            spellCheck={false}
            className="w-full px-3 py-2 rounded-lg bg-surface border border-edge text-body-sm text-primary outline-none focus:border-blue-500/60 nodrag"
          />
        </div>

        {/* 操作区（对齐 ConfirmContainer） */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-edge">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-caption text-secondary hover:text-white hover:bg-surface-hover-strong transition-colors cursor-pointer border border-edge bg-transparent"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onSubmit(name)}
            className="px-3 py-1.5 rounded-lg text-caption font-medium transition-colors cursor-pointer border bg-white border-white text-black hover:bg-white/90"
          >
            确定
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default RenameDialog;
