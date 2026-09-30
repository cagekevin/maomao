import React from 'react';
import { ArrowUp, Loader2 } from 'lucide-react';

/**
 * 生成按钮（复刻各节点底部「生成」胶囊按钮）。
 *
 * @param props
 *  - loading      是否生成中（生成中渲染为**禁用态**，不提供中止入口）
 *  - onGenerate   生成点击
 *  - cost         币消耗（可选，显示在生成按钮内）
 *  - costColor    币颜色（默认橙 yellow）
 *  - label        按钮文字（默认「生成」）
 *  - showCost     cost 是否显示（默认 true）
 *
 * 【2026-09-30】loading 由「`return null` 整块消失」改为「保留占位 + 禁用态」。
 * 原实现让按钮在生成期间完全不见：用户看不到状态，且「消失 → 出现」会引起面板布局跳动。
 * 禁用态保留原占位（尺寸/位置不变），灰化 + 转圈给出「正在生成」的可见信号，同时拦截点击。
 * 语义不变：**仍不提供中止入口**（ADR-0061），「不再等待」由编排的 pending 分支承担。
 */

/** 生成按钮 Props。 */
interface GenerateButtonProps {
  /** 是否生成中（生成中渲染为禁用态 —— 生成链路不提供中止入口，ADR-0061） */
  loading: boolean;
  /** 生成点击 */
  onGenerate: () => void;
  /** 币消耗（可选，显示在生成按钮内） */
  cost?: React.ReactNode;
  /** 币颜色（默认橙 yellow） */
  costColor?: string;
  /** 按钮文字（默认「生成」） */
  label?: string;
  /** cost 是否显示（默认 true） */
  showCost?: boolean;
}

export default function GenerateButton({
  loading,
  onGenerate,
  cost,
  costColor = 'text-orange-400',
  label = '生成',
  showCost = true,
}: GenerateButtonProps) {
  return (
    <div
      className={`flex items-center bg-surface-hover rounded-full p-1 pl-3 border border-edge flex-shrink-0 ml-2 transition-colors ${
        loading
          ? 'opacity-40 cursor-not-allowed'
          : 'hover:border-edge-strong cursor-pointer group/btn'
      }`}
      aria-disabled={loading}
      onClick={(e) => {
        e.stopPropagation();
        // 禁用态拦截：生成中点击不触发（防连点 / 防重复提交）
        if (loading) return;
        onGenerate();
      }}
    >
      {showCost && cost != null && (
        <span
          className={`flex items-center gap-0.5 mr-2 text-caption-sm ${costColor} tabular-nums`}
          title="预计消耗"
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
            <path
              d="M12 7v10M9 10.5c0-1.4 1.3-2.5 3-2.5s3 1.1 3 2.5c0 3.5-6 2-6 5 0 1.4 1.3 2.5 3 2.5s3-1.1 3-2.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          {cost}
        </span>
      )}
      <span className="flex items-center gap-1 mr-3 text-xs text-white">{label}</span>
      <span
        className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
          loading ? 'bg-white/60 text-black/60' : 'bg-white text-black hover:bg-gray-200'
        }`}
      >
        {loading ? (
          <Loader2 size={14} strokeWidth={3} className="animate-spin" />
        ) : (
          <ArrowUp size={14} strokeWidth={3} />
        )}
      </span>
    </div>
  );
}
