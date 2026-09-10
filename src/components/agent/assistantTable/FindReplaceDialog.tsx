import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { countMatchesInTabs } from './assistantTable.ts';
import type { AssistantTableTabs } from './assistantTable.ts';
import FullscreenShell from '@/components/base/panels/FullscreenShell.tsx';

/**
 * 表格「查找替换」弹窗（spec：查找替换面板）。
 *
 * 【定位】作用于「所有标签页」的纯文本替换面板；复用 RenameDialog 的模态视觉范式
 * （z-ceiling-2 / 遮罩 / Enter 提交 / Esc 取消 / 头部+输入区+操作区），但双输入框（查找 / 替换）。
 * 不改造 RenameDialog（其注释声明非通用）。
 *
 * 【稳定契约（对齐用户「怕崩只要稳」诉求）】
 *  - 本组件只管输入 + 实时计数预览，落盘由上层 onReplace(find, replace) 回调（在 AssistantTablePanel 走
 *    pushHistory + setCurrentAssistantTabs 唯一入口）；本组件不碰会话记忆。
 *  - 查找词空 → 禁用「替换全部」+ 计数 0；
 *  - 实时计数对输入防抖（避免每次按键全量遍历所有 tab 单元格卡顿）；
 *  - 替换是上层一次性全量不可变更新（原子、可撤销），本组件不持有任何中间态。
 */
export interface FindReplaceDialogProps {
  open: boolean;
  /** 只读：当前多标签页集合，供实时计数（不修改） */
  tabs: AssistantTableTabs;
  onCancel: () => void;
  /** 确认替换：上层执行全量替换 + 入撤销栈 + 落盘 */
  onReplace: (find: string, replace: string) => void;
}

export default function FindReplaceDialog({
  open,
  tabs,
  onCancel,
  onReplace,
}: FindReplaceDialogProps) {
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const findRef = useRef<HTMLInputElement | null>(null);

  // 打开时用新初始值重置本地 state（关闭再开不残留旧输入）
  useEffect(() => {
    if (open) {
      setFind('');
      setReplace('');
      setMatchCount(0);
    }
  }, [open]);

  // autoFocus 查找框（动画帧后聚焦，避免 portal 挂载瞬间 focus 失准）
  useEffect(() => {
    if (!open) return undefined;
    const id = requestAnimationFrame(() => findRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  // 实时计数防抖：find 变化后 150ms 才遍历所有 tab 计数（高频输入不全量卡顿）
  useEffect(() => {
    const timer = setTimeout(() => {
      setMatchCount(countMatchesInTabs(tabs, find));
    }, 150);
    return () => clearTimeout(timer);
  }, [find, tabs]);

  const canReplace = find.trim().length > 0 && matchCount > 0;

  const submit = () => {
    if (!canReplace) return;
    onReplace(find, replace);
  };

  // 全屏外壳负责 portal / 模态登记 / Esc 取消。
  // 原实现把 Esc 挂在【捕获阶段】只为「抢在画布快捷键之前」，但画布现在会主动让位，
  // 抢跑已无必要；改用外壳还额外拿到「本层打开时画布快捷键整体让位」——
  // 此前焦点落在替换按钮上时，Q/W/E 会漏出去新建画布节点。
  return (
    <FullscreenShell
      open={open}
      onClose={onCancel}
      className="fixed inset-0 z-ceiling-2 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onCancel}
      onContextMenu={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label="查找替换"
    >
      <div
        className="w-full max-w-sm bg-surface-raised border border-edge rounded-xl shadow-2xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-start gap-2 px-4 pt-4 pb-2">
          <Search size={14} className="text-secondary mt-0.5 shrink-0" />
          <div className="text-white text-body-sm font-medium leading-relaxed">
            查找替换（所有标签页）
          </div>
        </div>

        {/* 输入区 */}
        <div className="px-4 pb-3 space-y-2">
          <input
            ref={findRef}
            value={find}
            onChange={(e) => setFind(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="查找内容"
            spellCheck={false}
            className="w-full px-3 py-2 rounded-lg bg-surface border border-edge text-body-sm text-primary outline-none focus:border-blue-500/60 nodrag"
          />
          <input
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="替换为（留空 = 删除该词）"
            spellCheck={false}
            className="w-full px-3 py-2 rounded-lg bg-surface border border-edge text-body-sm text-primary outline-none focus:border-blue-500/60 nodrag"
          />
          <div className="text-caption text-secondary">
            {find.trim().length === 0
              ? '输入查找内容后可预览匹配数量'
              : `在所有标签页找到 ${matchCount} 处`}
          </div>
        </div>

        {/* 操作区 */}
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
            disabled={!canReplace}
            onClick={submit}
            className="px-3 py-1.5 rounded-lg text-caption font-medium transition-colors cursor-pointer border bg-white border-white text-black hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            替换全部
          </button>
        </div>
      </div>
    </FullscreenShell>
  );
}
