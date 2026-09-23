import React from 'react';
import { ArrowUp } from 'lucide-react';

/**
 * 生成按钮（复刻各节点底部「生成」胶囊按钮）。
 *
 * @param props
 *  - loading      是否生成中（生成中不渲染按钮）
 *  - onGenerate   生成点击
 *  - cost         币消耗（可选，显示在生成按钮内）
 *  - costColor    币颜色（默认橙 yellow）
 *  - label        按钮文字（默认「生成」）
 *  - showCost     cost 是否显示（默认 true）
 */

/** 生成按钮 Props。 */
interface GenerateButtonProps {
  /** 是否生成中（生成中不渲染按钮 —— 生成链路不提供中止入口，ADR-0061） */
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
  // 生成中不渲染任何按钮：前端不拥有「中止」（既不掌握上游句柄，也无法影响上游计费）⇒ 无中止入口。
  // 「不再等待」由编排的 pending 分支承担（预算耗尽自动清 loading），结果由后端终态经 pollTask 回填。
  if (loading) return null;

  return (
    <div
      className="flex items-center bg-surface-hover rounded-full p-1 pl-3 border border-edge hover:border-edge-strong transition-colors cursor-pointer group/btn flex-shrink-0 ml-2"
      onClick={(e) => {
        e.stopPropagation();
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
      <span className="bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
        <ArrowUp size={14} strokeWidth={3} />
      </span>
    </div>
  );
}
