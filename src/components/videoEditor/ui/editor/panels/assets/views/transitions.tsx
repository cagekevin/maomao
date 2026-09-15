'use client';

import { useState } from 'react';
import { PanelBaseView as BaseView } from '@videoEditor/ui/editor/panels/panel-base-view';
import { PropertyGroup } from '@videoEditor/ui/editor/panels/properties/property-item';
import { useEditor } from '@videoEditor/hooks-cutia/use-editor';
import {
  TRANSITION_PRESETS,
  TRANSITION_CATEGORIES,
  TRANSITION_CATEGORY_LABELS,
  DEFAULT_TRANSITION_DURATION,
  type TransitionPreset,
} from '@videoEditor/constants/transition-constants';
import type { TransitionType } from '@videoEditor/types/timeline';
import { toast } from '@videoEditor/lib/toast';
import { cn } from '@videoEditor/utils/ui';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@videoEditor/ui/ui/tooltip';

export function TransitionsView() {
  const editor = useEditor();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredPresets =
    selectedCategory === 'all'
      ? TRANSITION_PRESETS
      : TRANSITION_PRESETS.filter((preset) => preset.category === selectedCategory);

  /**
   * 「当前有几个可加转场的交界」—— 判据与批量应用**同源**（`TimelineManager.countAdjacentJunctions`）。
   *
   * 【TD-22-49】原先这个数**用户看不见**：点转场 → 失败 → 才知道"没有相邻片段"，
   * 而"多近才算相邻"更无从得知。现在它实时显示 ⇒ 拖片段时能看到 `0 → 1` 的跳变，
   * 那一步（吸附生效）就是"贴好了"。
   * `useEditor()` 订阅了 `timeline`，所以轨道任何变化都会让这里重算。
   */
  const junctionCount = editor.timeline.countAdjacentJunctions();

  return (
    <BaseView>
      {/* 说明 + 分类 = 一页的"导语"：标题走分区契约的组头（**唯一的标题形态**，
          此前是自写 `<h3>` —— 它是面板里第二个标题语言，字号/留白都跟组头对不上）。 */}
      <PropertyGroup title={'转场'}>
        <p className="text-muted-foreground text-xs">
          {junctionCount > 0
            ? `共有 ${junctionCount} 个可加转场的片段交界。点下方任意转场即可全部应用；也可以点时间轴交界处的图标单独设置时长。`
            : '当前还没有可加转场的交界：视频轨道上需要首尾相接的两段片段。把后一段拖到前一段末尾附近（会自动吸附贴齐），这里的数字就会变成 1。'}
        </p>
        <div className="flex flex-wrap gap-1">
          <CategoryPill
            label={'全部'}
            isActive={selectedCategory === 'all'}
            onClick={() => setSelectedCategory('all')}
          />
          {TRANSITION_CATEGORIES.map((category) => (
            <CategoryPill
              key={category}
              label={TRANSITION_CATEGORY_LABELS[category]}
              isActive={selectedCategory === category}
              onClick={() => setSelectedCategory(category)}
            />
          ))}
        </div>
      </PropertyGroup>

      <PropertyGroup>
        <div className="grid grid-cols-2 gap-2">
          {filteredPresets.map((preset) => (
            <TransitionPresetCard key={preset.type} preset={preset} />
          ))}
        </div>
      </PropertyGroup>
    </BaseView>
  );
}

function CategoryPill({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-full px-3 py-1 text-xs font-medium transition-colors',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-accent',
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function TransitionPresetCard({ preset }: { preset: TransitionPreset }) {
  const editor = useEditor();

  const handleApplyTransition = () => {
    // 批量应用 = **一次调用**：判据（轨道是不是 video / 元素在不在 / 是否相邻）与命令构造
    // 都在 `TimelineManager`，且整批只入栈**一条**历史条目（撤销一次全回）—— TD-22-51。
    // UI 只负责「表达意图 + 报结果」。
    const { applied } = editor.timeline.addTransitionsToAdjacentPairs({
      type: preset.type,
      duration: DEFAULT_TRANSITION_DURATION,
    });

    if (applied === 0) {
      // 【TD-22-49】原为英文且只说"没找到"：用户既不知道判据，也不知道怎么修。
      toast.info(
        '当前没有可加转场的交界：请在视频轨道上把两段片段拖到首尾相接（靠近会自动吸附贴齐）。',
      );
      return;
    }
    toast.success(`已为 ${applied} 个片段交界应用转场（${preset.label}）`);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="bg-muted hover:bg-accent flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors"
            onClick={handleApplyTransition}
          >
            <TransitionPreview type={preset.type} />
            <span className="text-xs font-medium">{preset.label}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{`把「${preset.label}」应用到全部可加转场的片段交界`}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function TransitionPreview({ type }: { type: TransitionType }) {
  return (
    <div className="relative flex h-10 w-full items-center justify-center overflow-hidden rounded">
      <TransitionIcon type={type} />
    </div>
  );
}

function TransitionIcon({ type }: { type: TransitionType }) {
  const baseClass = 'size-full';
  const label = TRANSITION_PRESETS.find((p) => p.type === type)?.label ?? type;

  if (type === 'fade' || type === 'dissolve') {
    return (
      <svg viewBox="0 0 60 30" className={baseClass} role="img" aria-label={label}>
        <title>{label}</title>
        <defs>
          <linearGradient id={`grad-${type}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="1" />
            <stop
              offset="100%"
              stopColor="hsl(var(--primary))"
              stopOpacity={type === 'dissolve' ? '0.3' : '0'}
            />
          </linearGradient>
        </defs>
        <rect x="0" y="2" width="28" height="26" rx="2" fill={`url(#grad-${type})`} />
        <rect
          x="32"
          y="2"
          width="28"
          height="26"
          rx="2"
          fill="hsl(var(--muted-foreground))"
          opacity="0.3"
        />
      </svg>
    );
  }

  if (type.startsWith('wipe-')) {
    const direction = type.replace('wipe-', '');
    return (
      <svg viewBox="0 0 60 30" className={baseClass} role="img" aria-label={label}>
        <title>{label}</title>
        <rect x="2" y="2" width="26" height="26" rx="2" fill="hsl(var(--primary))" />
        <rect
          x="32"
          y="2"
          width="26"
          height="26"
          rx="2"
          fill="hsl(var(--muted-foreground))"
          opacity="0.3"
        />
        <path
          d={getArrowPath({ direction })}
          fill="none"
          stroke="hsl(var(--foreground))"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (type.startsWith('slide-')) {
    const direction = type.replace('slide-', '');
    return (
      <svg viewBox="0 0 60 30" className={baseClass} role="img" aria-label={label}>
        <title>{label}</title>
        <rect x="2" y="2" width="26" height="26" rx="2" fill="hsl(var(--primary))" />
        <rect
          x="32"
          y="2"
          width="26"
          height="26"
          rx="2"
          fill="hsl(var(--muted-foreground))"
          opacity="0.3"
        />
        <path
          d={getArrowPath({ direction })}
          fill="none"
          stroke="hsl(var(--foreground))"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="2 2"
        />
      </svg>
    );
  }

  if (type === 'zoom-in') {
    return (
      <svg viewBox="0 0 60 30" className={baseClass} role="img" aria-label={label}>
        <title>{label}</title>
        <rect x="2" y="2" width="26" height="26" rx="2" fill="hsl(var(--primary))" />
        <rect
          x="36"
          y="6"
          width="18"
          height="18"
          rx="2"
          fill="hsl(var(--muted-foreground))"
          opacity="0.3"
        />
        <rect
          x="34"
          y="4"
          width="22"
          height="22"
          rx="3"
          fill="none"
          stroke="hsl(var(--foreground))"
          strokeWidth="1"
        />
      </svg>
    );
  }

  if (type === 'zoom-out') {
    return (
      <svg viewBox="0 0 60 30" className={baseClass} role="img" aria-label={label}>
        <title>{label}</title>
        <rect x="4" y="4" width="22" height="22" rx="2" fill="hsl(var(--primary))" />
        <rect
          x="2"
          y="2"
          width="26"
          height="26"
          rx="3"
          fill="none"
          stroke="hsl(var(--foreground))"
          strokeWidth="1"
        />
        <rect
          x="32"
          y="2"
          width="26"
          height="26"
          rx="2"
          fill="hsl(var(--muted-foreground))"
          opacity="0.3"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 60 30" className={baseClass} role="img" aria-label={label}>
      <title>{label}</title>
      <rect x="2" y="2" width="26" height="26" rx="2" fill="hsl(var(--primary))" />
      <rect
        x="32"
        y="2"
        width="26"
        height="26"
        rx="2"
        fill="hsl(var(--muted-foreground))"
        opacity="0.3"
      />
    </svg>
  );
}

function getArrowPath({ direction }: { direction: string }): string {
  switch (direction) {
    case 'left':
      return 'M32 15 L25 15 M28 11 L25 15 L28 19';
    case 'right':
      return 'M28 15 L35 15 M32 11 L35 15 L32 19';
    case 'up':
      return 'M30 20 L30 13 M26 16 L30 13 L34 16';
    case 'down':
      return 'M30 10 L30 17 M26 14 L30 17 L34 14';
    default:
      return 'M28 15 L35 15 M32 11 L35 15 L32 19';
  }
}

// 【已删：`applyTransitionToAdjacentPairs`（2026-09-15 · TD-22-51）】
// 它原先在本文件里循环调 `editor.timeline.addTransition` N 次 —— 三条错：
//   ① 一次点击入栈 N 条历史条目（撤销要按 N 次，用户以为撤销坏了）；
//   ② UI 层重复了「轨道是不是 video / 元素在不在 / 是否相邻」的判据（判据第二份）；
//   ③ 判据与命令构造被拆在两个文件里。
// 现整体下沉为 `TimelineManager.addTransitionsToAdjacentPairs`（判据单点 + 整批一条历史条目，
// 经 `CommandManager.executeBatch`）。**不要**在本层再拼一次。
