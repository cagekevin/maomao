/**
 * AI 助手表格 —— 统一图标组件（消灭十数处重复内联 SVG <path>）。
 *
 * 背景：AssistantTablePanel 原是「上帝组件」，十多个 16×16 inline SVG 重复书写、
 * 同一 feather path 拷多份。抽成 <Icon name="copy" /> 小表（name → path），改图标只动一处。
 *
 * 图标均用 feather 语义（viewBox=24、fill=none、stroke=currentColor、round 端点）。
 * 尺寸/线宽经 props 传入：在 `.atw-icobtn`（表格操作钮）上下文由 CSS 统一锁定 11×11；
 * 非 icobtn 处（全局标签 / 空态 mark / 预览卡确认钮）显式传 size/strokeWidth 对齐原观感。
 */
import type { ReactNode } from 'react';

export type IconName =
  | 'copy'
  | 'chevron-up'
  | 'chevron-down'
  | 'trash'
  | 'trash-clear'
  | 'send'
  | 'globe'
  | 'edit'
  | 'plus'
  | 'x'
  | 'table'
  | 'check';

/** name → 图形子节点（feather 24 viewBox，不含外层 <svg> 公共属性） */
const ICON_PATHS: Record<IconName, ReactNode> = {
  copy: (
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  'chevron-up': <polyline points="18 15 12 9 6 15" />,
  'chevron-down': <polyline points="6 9 12 15 18 9" />,
  trash: (
    <>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
  ),
  'trash-clear': (
    <>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </>
  ),
  send: (
    <>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>
  ),
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  x: (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  table: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </>
  ),
  check: <polyline points="20 6 9 17 4 12" />,
};

/** 统一图标：size=宽高（px，icobtn 场景由 CSS 覆盖为 11），strokeWidth=线宽 */
export default function Icon({
  name,
  size = 11,
  strokeWidth = 2,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  /** 透传给 <svg> 的 class（如全局区 .pen 配色） */
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
