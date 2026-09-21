'use client';

import { Minus, Plus } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { AspectRatio } from '@/components/videoEditor/ui/ui/aspect-ratio';
import { LayerPortal } from '@/components/videoEditor/ui/ui/layer/layer-root';
import { Button } from '@/components/videoEditor/ui/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/videoEditor/ui/ui/tooltip';
import { useEditor } from '@/components/videoEditor/hooks-cutia/use-editor';
import { setDragData } from '@/components/videoEditor/engine/lib/drag-data';
import type { TimelineDragData } from '@/components/videoEditor/types/drag';
import { cn } from '@/components/videoEditor/utils/ui';

export interface DraggableItemProps {
  name: string;
  preview: ReactNode;
  dragData: TimelineDragData;
  onDragStart?: ({ e }: { e: React.DragEvent }) => void;
  onAddToTimeline?: ({ currentTime }: { currentTime: number }) => void;
  /**
   * 「减号」回调 —— 与 `onAddToTimeline` 反向、二者成对（素材：加=上轨 / 减=删素材并清其片段）。
   * 不传 = 不渲染减号（贴纸 / 文本没有这一语义）。
   * 传 `event` 供调用方 `stopPropagation`（否则会连带触发卡片的选中/拖拽）。
   */
  onRemoveFromTimeline?: ({ event }: { event: React.MouseEvent }) => void;
  /** 减号按钮的提示文案（不传则不给 tooltip）。 */
  removeTooltipText?: string;
  onClick?: () => void;
  aspectRatio?: number;
  className?: string;
  containerClassName?: string;
  shouldShowPlusOnDrag?: boolean;
  shouldShowLabel?: boolean;
  isRounded?: boolean;
  variant?: 'card' | 'compact';
  isDraggable?: boolean;
  isHighlighted?: boolean;
  isSelected?: boolean;
}

export function DraggableItem({
  name,
  preview,
  dragData,
  onDragStart,
  onAddToTimeline,
  onRemoveFromTimeline,
  removeTooltipText,
  onClick,
  aspectRatio = 16 / 9,
  className = '',
  containerClassName,
  shouldShowPlusOnDrag = true,
  shouldShowLabel = true,
  variant = 'card',
  isDraggable = true,
  isHighlighted = false,
  isSelected = false,
}: DraggableItemProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const dragRef = useRef<HTMLDivElement>(null);
  const didDragRef = useRef(false);
  const editor = useEditor('playback');
  // mockup 口径：选中/高亮 = 仅缩略图 2px 描边（offset 1px），无底色、不套整卡
  // 视觉定义已收敛到 videoEditorTheme.css §8（.ve-card-selected）

  const handleAddToTimeline = () => {
    onAddToTimeline?.({ currentTime: editor.playback.getCurrentTime() });
  };

  const emptyImg = new window.Image();
  emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=';

  useEffect(() => {
    if (!isDragging) return;

    const handleDragOver = (e: DragEvent) => {
      setDragPosition({ x: e.clientX, y: e.clientY });
    };

    document.addEventListener('dragover', handleDragOver);

    return () => {
      document.removeEventListener('dragover', handleDragOver);
    };
  }, [isDragging]);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setDragImage(emptyImg, 0, 0);

    setDragData({ dataTransfer: e.dataTransfer, dragData });
    e.dataTransfer.effectAllowed = 'copy';

    setDragPosition({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
    didDragRef.current = true;

    onDragStart?.({ e });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleClick = () => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    onClick?.();
  };

  return (
    <>
      {variant === 'card' ? (
        // biome-ignore lint/a11y/useSemanticElements: container wraps draggable content with nested interactive elements
        <div
          ref={dragRef}
          className={cn('group relative', containerClassName ?? 'size-28')}
          onClick={handleClick}
          onKeyUp={(event) => {
            if (event.key === 'Enter') handleClick();
          }}
          role="button"
          tabIndex={0}
        >
          <div
            className={cn(
              'relative flex h-auto w-full cursor-default flex-col gap-1 p-1',
              className,
            )}
          >
            <AspectRatio
              ratio={aspectRatio}
              className={cn(
                've-card-thumb',
                (isHighlighted || isSelected) && 've-card-selected',
                isDraggable && '[&::-webkit-drag-ghost]:opacity-0',
              )}
              draggable={isDraggable}
              onDragStart={isDraggable ? handleDragStart : undefined}
              onDragEnd={isDraggable ? handleDragEnd : undefined}
            >
              {preview}
              {!isDragging && <PlusButton variant="card" onClick={handleAddToTimeline} />}
              {/* 减号：与加号同族、同显隐口径（hover 才现），位置在右上角（见 videoEditorTheme §8）。 */}
              {!isDragging && onRemoveFromTimeline && (
                <MinusButton
                  variant="card"
                  onClick={onRemoveFromTimeline}
                  tooltipText={removeTooltipText}
                />
              )}
            </AspectRatio>
            {shouldShowLabel && (
              // 【2026-09-19 名称收口】截断**只有一份判据 = 本元素的 CSS `truncate`**
              // （按容器真实宽度出省略号；卡片固定一排 2 个 ⇒ 宽度确定，观感稳定）。
              //
              // 被替换的旧实现（一句话两个错）：
              //   `name.length > 8 ? `${name.slice(0,16)}...${name.slice(-3)}` : name`
              //   ① 判据 `>8` 与切点 `16` **不一致** ⇒ 9~16 字的名称进"长名分支"却整名未被切掉，
              //      渲染成「**整名 + ... + 末 3 字**」的乱码（实测 `my_video_01.mp4` → `my_video_01.mp4...mp4`）；
              //   ② 它与 `truncate` 是**两份截断判据维护同一真相** ⇒ 必然漂移。
              //
              // 现形态：作者只提供**完整名称**；截断交 CSS。完整名在 `title`（悬停可看）
              // 与 `sr-only`（读屏）里 —— 三处同源，不各自加工。
              <span className="ve-card-name block w-full truncate text-left" title={name}>
                <span className="sr-only">{name}</span>
                <span aria-hidden="true">{name}</span>
              </span>
            )}
          </div>
        </div>
      ) : (
        // ── 列表（compact）态 ─────────────────────────────────────────────────────────
        // 【与卡片态对齐】卡片态缩略图上有加/减号，列表态原本**一个都没有**（功能不等价）。
        // 【布局：行内流，不绝对定位】（2026-09-15 修「超出面板」）
        //   行本体 <button> 用 `flex-1` 占满剩余宽度；两个动作钮是**并列的兄弟节点**，
        //   参与同一行 flex —— 它们的宽度天然被算进行宽，**不可能溢出**。
        //   反例（已废）：早先把钮绝对定位在 `right-1`，而钮自身又带着卡片态的
        //   `top:6px` 浮层定位 → 两套定位叠加，28px 的圆钮从 32px 的行里溢出去。
        // 【为什么钮必须在 <button> 外面】按钮嵌按钮是非法 HTML 嵌套。
        <div ref={dragRef} className="group flex h-8 w-full items-center">
          <button
            type="button"
            className={cn(
              'flex h-8 min-w-0 flex-1 cursor-default items-center gap-3 px-1',
              isDraggable && '[&::-webkit-drag-ghost]:opacity-0',
              className,
            )}
            draggable={isDraggable}
            onDragStart={isDraggable ? handleDragStart : undefined}
            onDragEnd={isDraggable ? handleDragEnd : undefined}
            onClick={handleClick}
          >
            <div
              className={cn(
                'size-6 flex-shrink-0 overflow-hidden rounded-[0.35rem]',
                (isHighlighted || isSelected) && 've-card-selected',
              )}
            >
              {preview}
            </div>
            <span className="w-full flex-1 truncate text-sm text-left">{name}</span>
          </button>
          {!isDragging && (onAddToTimeline || onRemoveFromTimeline) && (
            // 【2026-09-19】补 `ml-auto`：显式把动作钮**推到最右**（右对齐）。
            // 原实现只靠 `flex-1` 行本体"吃掉剩余空间"间接实现右对齐 —— 一旦行本体
            // 因内容/父级约束没撑满（或将来改成 `w-auto`），两颗钮就会**跟着名称跑**、
            // 不在一条竖直线上。`ml-auto` 把"右对齐"变成**这一层自己声明的判据**，
            // 不依赖祖先的宽度行为（用户口径：列表态加减号要贴最右对齐）。
            <div className="ml-auto flex shrink-0 items-center gap-0.5 pr-1">
              {/* 顺序与卡片态一致：先加（左）后减（右）。 */}
              {onAddToTimeline && <PlusButton variant="inline" onClick={handleAddToTimeline} />}
              {onRemoveFromTimeline && (
                <MinusButton
                  variant="inline"
                  onClick={onRemoveFromTimeline}
                  tooltipText={removeTooltipText}
                />
              )}
            </div>
          )}
        </div>
      )}

      {isDraggable && isDragging && (
        /* 拖拽预览：渲染进**编辑器层根**（原 `createPortal(document.body)`）。
           为什么要跟着改：它用的 `ve-card-thumb` / `ring-primary` 都来自 `.ve-scope` 作用域，
           落在 body 上只能靠"给 body 挂主题类"的补丁活着（见 docs/135 收尾三件）。 */
        <LayerPortal>
          <div
            className="pointer-events-none fixed z-[9999]"
            style={{
              left: dragPosition.x - 40,
              top: dragPosition.y - 40,
            }}
          >
            <div className="w-[80px]">
              <AspectRatio
                ratio={1}
                className="ring-primary relative overflow-hidden rounded-md shadow-2xl ring-3"
              >
                <div className="size-full [&_img]:size-full [&_img]:rounded-none [&_img]:object-cover">
                  {preview}
                </div>
                {shouldShowPlusOnDrag && (
                  <PlusButton
                    variant="card"
                    onClick={handleAddToTimeline}
                    // 【2026-09-19】原文案为英文（本编辑器其余 UI 文案一律中文，且卡片态加号无 tooltip）
                    // ⇒ 同一动作两种文案、两种语言，属描述层第二份真相。统一为中文口径。
                    tooltipText="添加到时间轴（或拖到指定位置）"
                  />
                )}
              </AspectRatio>
            </div>
          </div>
        </LayerPortal>
      )}
    </>
  );
}

/**
 * 加 / 减动作按钮 —— **两种形态共用同一实现**（唯一形状来源，勿各写一份）。
 *
 * 【为什么共用】两种形态下两者结构完全同构：「小图标钮 + 可选 tooltip + 必须
 * `preventDefault`/`stopPropagation` 以免触发条目自身的选中/拖拽」。差异只有：
 *   · 图标（`Plus` / `Minus`）
 *   · **外套样式**（由 `className` 传入：卡片态 = `.ve-act-btn .ve-card-plus`（形状 + 浮层定位）；
 *     列表态 = `.ve-act-btn`（形状，参与行内 flex））
 *   · 回调
 * 故形状收口在 CSS 的 `.ve-act-btn`，本组件只负责行为。
 *
 * 【一个真实缺陷留下的教训】（2026-09-15）
 * 早先把"形状"与"卡片态浮层定位"写死在同一组类里（`ve-card-plus` = `absolute; top:6px; 26×26`）：
 *   · 列表态复用它 → 被迫带上浮层定位 → 28px 圆钮从 `h-8`(32px) 的行里**溢出面板**；
 *   · 临时改用画布 Tailwind token（`text-muted-foreground`/`hover:bg-accent`）救急 →
 *     在这个 `ve-scope` 里解析成**白底白字**，且与旁边按钮**格格不入**
 *     （`ve-scope` 只认 `--ve-*`，不吃画布 token）。
 * 根因 = **形状与定位耦合**。现已在 CSS 层拆开（形状 `.ve-act-btn` / 定位 `.ve-card-*`），
 * 两种形态同源，不再需要各写一份样式。
 *
 * 【配色：素净，不用实心彩底】（2026-09-15 用户三次反馈后定稿）
 * 曾用"半透明实心圆钮"（白 / 红），用户评「一白一红的也很丑」。现改为**素净图标钮**：
 * 常态只有中性色图标、悬停才给薄纱；减号的危险色**只在悬停**时出现。
 * 配色细节全在 `videoEditorTheme.css` 的 `.ve-act-btn` 一族人话里。
 */
function ActionButton({
  className,
  onClick,
  tooltipText,
  children,
}: {
  className?: string;
  onClick?: ({ event }: { event: React.MouseEvent }) => void;
  tooltipText?: string;
  children: ReactNode;
}) {
  const button = (
    <Button
      size="icon"
      // 形状/配色由调用方经 `className` 传入（卡片态与列表态都用 `.ve-act-btn` 同源）；
      // 此处只负责"事件必须拦住"这一行为（否则冒泡到条目的 onClick/拖拽）。
      className={cn(className)}
      onClick={(event) => {
        // 必须拦掉：本按钮叠在条目上，事件会冒泡到条目的 onClick（选中）/ 触发拖拽。
        event.preventDefault();
        event.stopPropagation();
        onClick?.({ event });
      }}
      title={tooltipText}
    >
      {children}
    </Button>
  );

  if (tooltipText) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

function PlusButton({
  variant,
  className,
  onClick,
  tooltipText,
}: {
  variant: 'card' | 'inline';
  className?: string;
  onClick?: () => void;
  tooltipText?: string;
}) {
  return (
    <ActionButton
      // 一套形状（`.ve-act-btn`）；卡片态额外套 `.ve-card-plus` 拿到浮层定位。
      className={cn('ve-act-btn', variant === 'card' && 've-card-plus', className)}
      onClick={() => onClick?.()}
      tooltipText={tooltipText}
    >
      <Plus />
    </ActionButton>
  );
}

function MinusButton({
  variant,
  className,
  onClick,
  tooltipText,
}: {
  variant: 'card' | 'inline';
  className?: string;
  onClick?: ({ event }: { event: React.MouseEvent }) => void;
  tooltipText?: string;
}) {
  return (
    <ActionButton
      className={cn(
        've-act-btn ve-act-btn-danger',
        variant === 'card' && 've-card-minus',
        className,
      )}
      onClick={onClick}
      tooltipText={tooltipText}
    >
      <Minus />
    </ActionButton>
  );
}
