'use client';

import { AlertTriangle } from 'lucide-react';
import { cn } from '@/components/videoEditor/utils/ui';

/**
 * 「素材不可用」的统一指示块 —— 时间轴片段**唯一**的缺失表达。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么需要它（TD-22-48）】此前"源不可用"在时间轴上有 **3 处坍缩点**，各自悄悄落回
 * 一行小字或留白画布：
 *   · `!mediaAsset`（mediaId 断链：素材被删 / 加载失败 / 切项目重置）→ 一行 `name` 小字
 *   · video 有 asset 但 `file` 缺 → 跳过缩略图条 → 一行 `name` 小字
 *   · image 有 asset 但 `url` 缺 → 跳过背景图 → 一行 `name` 小字
 * 用户看到的是"一片空白"，**分不出**"这个片段素材没了"和"这个片段本来就是空的"。
 * 而音频侧早就有 `audio-waveform` 的 "Audio unavailable" —— **同一种失败、两种说法**。
 * 现在这几处 + 音频波形错误态**共用本组件**：虚线红框 + 告警图标 + 原因文案。
 *
 * 【为什么区分 kind】"素材记录找不到"（多半被删了）与"素材还在但源文件取不到"
 * （本地服务未起 / 文件丢失）对用户的**补救动作不同**：前者要重新导入，
 * 后者要检查本地服务或重新上传。合成一句"不可用"等于把两种故障混成一个。
 * ════════════════════════════════════════════════════════════════
 */
export function MissingMediaIndicator({
  kind,
  name,
  className,
}: {
  /** `missing-asset` = 素材记录都不在了；`source-unavailable` = 记录在但源文件取不到 */
  kind: 'missing-asset' | 'source-unavailable';
  /** 片段名（可选：波形等拿不到名字的场景省略） */
  name?: string;
  className?: string;
}) {
  const reason = kind === 'missing-asset' ? '素材缺失（可能已被删除）' : '源文件不可用';
  const label = name ? `${reason} · ${name}` : reason;

  return (
    <div
      role="alert"
      title={label}
      className={cn(
        'border-destructive/60 bg-destructive/10 flex size-full min-w-0 items-center gap-1.5 overflow-hidden rounded-sm border border-dashed px-2',
        className,
      )}
    >
      <AlertTriangle className="text-destructive size-3.5 shrink-0" />
      <span className="text-destructive truncate text-xs">{label}</span>
    </div>
  );
}
