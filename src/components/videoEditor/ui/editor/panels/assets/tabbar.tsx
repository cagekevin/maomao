'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/videoEditor/ui/ui/tooltip';
import { Button } from '@/components/videoEditor/ui/ui/button';
import { cn } from '@/components/videoEditor/utils/ui';
import {
  TAB_KEYS,
  tabs,
  useAssetsPanelStore,
} from '@/components/videoEditor/stores/assets-panel-store';

/**
 * 素材面板左栏（图标 tab 竖列）。
 *
 * 【结构】一列图标 + **一层**渐隐提示：
 *   · 列自己滚（`overflow-y-auto`），宽度由内容决定（26px 图标 + 8px 内边距），
 *     所以外面这层必须是 `shrink-0` —— 它是固定宽度的一栏，不参与横向分配；
 *   · 高度由父（`AssetsPanel` 的 `h-full` 行）拉伸给出，故列用 `h-full`。
 *
 * 【渐隐只能有一层】此前渲染了**两个** `FadeOverlay` 节点，未显示的那个也会落到
 * `bottom-0` → 上下两层渐变叠在同一位置（互相遮挡）。正确形态：一个节点，
 * 位置与可见性都由状态决定；不显示时 `opacity-0`，不占视觉。
 */
export function TabBar() {
  const { activeTab, setActiveTab } = useAssetsPanelStore();

  // i18next-toolkit: forces extraction of tab labels (dead code, extract-only)
  if (false as boolean) {
    ('素材');
    ('音效');
    ('文字');
    ('贴纸');
    ('效果');
    ('转场');
    ('字幕');
    ('滤镜');
    ('调整');
    ('AI');
    ('设置');
  }
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const checkScrollPosition = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const { scrollTop, scrollHeight, clientHeight } = element;
    setShowTopFade(scrollTop > 0);
    setShowBottomFade(scrollTop < scrollHeight - clientHeight - 1);
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    checkScrollPosition();
    element.addEventListener('scroll', checkScrollPosition);

    const resizeObserver = new ResizeObserver(checkScrollPosition);
    resizeObserver.observe(element);

    return () => {
      element.removeEventListener('scroll', checkScrollPosition);
      resizeObserver.disconnect();
    };
  }, [checkScrollPosition]);

  const fade = showTopFade
    ? 'top-0 bg-gradient-to-b from-background to-transparent'
    : showBottomFade
      ? 'bottom-0 bg-gradient-to-t from-background to-transparent'
      : 'opacity-0';

  return (
    <div className="relative flex h-full shrink-0">
      <div
        ref={scrollRef}
        className="scrollbar-hidden flex h-full flex-col items-center justify-start gap-1.5 overflow-y-auto p-2"
      >
        {TAB_KEYS.map((tabKey) => {
          const tab = tabs[tabKey];
          return (
            <Tooltip key={tabKey} delayDuration={10}>
              <TooltipTrigger asChild>
                <Button
                  variant="text"
                  aria-label={tab.label}
                  data-active={activeTab === tabKey || undefined}
                  className="ve-tab flex-col h-auto p-1.5 [&_svg]:size-3.5"
                  onClick={() => setActiveTab(tabKey)}
                >
                  <tab.icon />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" align="center" variant="sidebar" sideOffset={8}>
                <div className="text-foreground text-sm leading-none font-medium">{tab.label}</div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div className={cn('pointer-events-none absolute inset-x-0 h-6', fade)} />
    </div>
  );
}
