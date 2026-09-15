'use client';
import { logger } from '@videoEditor/lib/logger';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from '@videoEditor/lib/toast';
import { DraggableItem } from '@videoEditor/ui/editor/panels/assets/draggable-item';
import {
  PanelBaseView as BaseView,
  PanelState,
} from '@videoEditor/ui/editor/panels/panel-base-view';
import { Button } from '@videoEditor/ui/ui/button';
import { InputWithBack } from '@videoEditor/ui/ui/input-with-back';
import { PropertyGroup } from '@videoEditor/ui/editor/panels/properties/property-item';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@videoEditor/ui/ui/tooltip';
import { STICKER_CATEGORIES } from '@videoEditor/constants/stickers-constants';
import { useInfiniteScroll } from '@videoEditor/hooks-cutia/use-infinite-scroll';
import { buildIconSvgUrl, POPULAR_COLLECTIONS } from '@videoEditor/engine/lib/iconify-api';
import { useStickersStore } from '@videoEditor/stores/stickers-store';
import type { StickerCategory } from '@videoEditor/types/stickers';
import { cn } from '@videoEditor/utils/ui';
import { Spinner } from '@videoEditor/ui/ui/spinner';
import { LayoutGrid, Sparkles, Hash, Smile, Clock, X, ArrowRight } from 'lucide-react';

function isStickerCategory(value: string): value is StickerCategory {
  return STICKER_CATEGORIES.includes(value as StickerCategory);
}

export function StickersView() {
  const { selectedCategory, setSelectedCategory } = useStickersStore();

  /**
   * 无限滚动的处理函数由**当前活跃 tab** 注册上来（每个 tab 有自己的分页状态），
   * 再挂到**壳那一个**滚动容器上 —— 于是视图不必自建第二个滚动容器（统一语言 ①）。
   * 用 ref 承载而非 state：`handleScroll` 每次渲染都可能重新创建，走 state 会触发
   * "注册 → 渲染 → 注册" 的循环。
   */
  const scrollHandlerRef = useRef<React.UIEventHandler<HTMLDivElement> | null>(null);
  const registerScrollHandler = useCallback(
    (handler: React.UIEventHandler<HTMLDivElement> | null) => {
      scrollHandlerRef.current = handler;
    },
    [],
  );

  return (
    <BaseView
      value={selectedCategory}
      onValueChange={(v) => {
        if (isStickerCategory(v)) {
          setSelectedCategory({ category: v });
        }
      }}
      onScrollCapture={(event) => scrollHandlerRef.current?.(event)}
      tabs={[
        {
          value: 'all',
          label: '全部',
          icon: <LayoutGrid className="size-3" />,
          content: (
            <StickersContentView category="all" registerScrollHandler={registerScrollHandler} />
          ),
        },
        {
          value: 'general',
          label: '图标',
          icon: <Sparkles className="size-3" />,
          content: (
            <StickersContentView category="general" registerScrollHandler={registerScrollHandler} />
          ),
        },
        {
          value: 'brands',
          label: '品牌',
          icon: <Hash className="size-3" />,
          content: (
            <StickersContentView category="brands" registerScrollHandler={registerScrollHandler} />
          ),
        },
        {
          value: 'emoji',
          label: '表情',
          icon: <Smile className="size-3" />,
          content: (
            <StickersContentView category="emoji" registerScrollHandler={registerScrollHandler} />
          ),
        },
      ]}
    />
  );
}

function StickerGrid({
  icons,
  onAdd,
  addingSticker,
  capSize = false,
}: {
  icons: string[];
  onAdd: (iconName: string) => void;
  addingSticker: string | null;
  capSize?: boolean;
}) {
  const gridStyle: CSSProperties & {
    '--sticker-min': string;
    '--sticker-max'?: string;
  } = {
    gridTemplateColumns: capSize
      ? 'repeat(auto-fill, minmax(var(--sticker-min, 96px), var(--sticker-max, 160px)))'
      : 'repeat(auto-fit, minmax(var(--sticker-min, 96px), 1fr))',
    '--sticker-min': '96px',
    ...(capSize ? { '--sticker-max': '160px' } : {}),
  };

  return (
    <div className="grid gap-2" style={gridStyle}>
      {icons.map((iconName) => (
        <StickerItem
          key={iconName}
          iconName={iconName}
          onAdd={onAdd}
          isAdding={addingSticker === iconName}
          capSize={capSize}
        />
      ))}
    </div>
  );
}

function CollectionGrid({
  collections,
  onSelectCollection,
}: {
  collections: Array<{
    prefix: string;
    name: string;
    total: number;
    category?: string;
  }>;
  onSelectCollection: ({ prefix }: { prefix: string }) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {collections.map((collection) => (
        <CollectionItem
          key={collection.prefix}
          title={collection.name}
          subtitle={`${collection.total.toLocaleString()} ${'图标'}${collection.category ? ` • ${collection.category}` : ''}`}
          onClick={() => onSelectCollection({ prefix: collection.prefix })}
        />
      ))}
    </div>
  );
}

/* 空态不再自造（原 `EmptyView` 是第四个"h-full 占位"实现）—— 统一走契约的 `PanelState`。 */

function StickersContentView({
  category,
  registerScrollHandler,
}: {
  category: StickerCategory;
  registerScrollHandler: (handler: React.UIEventHandler<HTMLDivElement> | null) => void;
}) {
  const {
    searchQuery,
    selectedCollection,
    viewMode,
    collections,
    currentCollection,
    searchResults,
    recentStickers,
    isLoadingCollections,
    isLoadingCollection,
    isSearching,
    setSearchQuery,
    setSelectedCollection,
    loadCollections,
    searchStickers,
    addStickerToTimeline,
    clearRecentStickers,
    setSelectedCategory,
    addingSticker,
  } = useStickersStore();

  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [collectionsToShow, setCollectionsToShow] = useState(20);
  const [showCollectionItems, setShowCollectionItems] = useState(false);

  const filteredCollections = useMemo(() => {
    if (category === 'all') {
      return Object.entries(collections).map(([prefix, collection]) => ({
        prefix,
        name: collection.name,
        total: collection.total,
        category: collection.category,
      }));
    }

    const collectionList = POPULAR_COLLECTIONS[category as keyof typeof POPULAR_COLLECTIONS];
    if (!collectionList) return [];

    return collectionList
      .map((c) => {
        const collection = collections[c.prefix];
        return collection
          ? {
              prefix: c.prefix,
              name: c.name,
              total: collection.total,
            }
          : null;
      })
      .filter(Boolean) as Array<{
      prefix: string;
      name: string;
      total: number;
    }>;
  }, [collections, category]);

  const { handleScroll } = useInfiniteScroll({
    onLoadMore: () => setCollectionsToShow((prev) => prev + 20),
    hasMore: filteredCollections.length > collectionsToShow,
    isLoading: isLoadingCollections,
    enabled: viewMode === 'browse' && !selectedCollection && category === 'all',
  });

  // 把「滚到底加载更多」注册给**壳那一个**滚动容器（统一语言 ①）。
  // 每次渲染都重注册：`handleScroll` 的依赖会变，用 ref 承载不会触发"注册 → 渲染"循环。
  useEffect(() => {
    registerScrollHandler(handleScroll);
  }, [registerScrollHandler, handleScroll]);

  useEffect(() => {
    if (Object.keys(collections).length === 0) {
      loadCollections();
    }
  }, [collections, loadCollections]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearchQuery !== searchQuery) {
        setSearchQuery({ query: localSearchQuery });
        if (localSearchQuery.trim()) {
          searchStickers({ query: localSearchQuery });
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [localSearchQuery, searchQuery, searchStickers, setSearchQuery]);

  const handleAddSticker = async (iconName: string) => {
    try {
      await addStickerToTimeline({ iconName });
    } catch (error) {
      logger.error('Failed to add sticker:', error);
      toast.error('贴纸添加到时间轴失败');
    }
  };

  const iconsToDisplay = useMemo(() => {
    if (viewMode === 'search' && searchResults) {
      return searchResults.icons;
    }

    if (viewMode === 'collection' && currentCollection) {
      const icons: string[] = [];

      if (currentCollection.uncategorized) {
        icons.push(
          ...currentCollection.uncategorized.map((name) => `${currentCollection.prefix}:${name}`),
        );
      }

      if (currentCollection.categories) {
        Object.values(currentCollection.categories).forEach((categoryIcons) => {
          icons.push(...categoryIcons.map((name) => `${currentCollection.prefix}:${name}`));
        });
      }

      return icons.slice(0, 100);
    }

    return [];
  }, [viewMode, searchResults, currentCollection]);

  const isInCollection = viewMode === 'collection' && !!selectedCollection;

  useEffect(() => {
    if (isInCollection) {
      setShowCollectionItems(false);
      const timer = setTimeout(() => setShowCollectionItems(true), 350);
      return () => clearTimeout(timer);
    } else {
      setShowCollectionItems(false);
    }
    return undefined;
  }, [isInCollection]);

  return (
    <>
      <PropertyGroup>
        <InputWithBack
          isExpanded={isInCollection}
          setIsExpanded={(expanded) => {
            if (!expanded && isInCollection) {
              setSelectedCollection({ collection: null });
            }
          }}
          placeholder={
            category === 'all'
              ? '搜索所有贴纸'
              : category === 'general'
                ? '搜索图标'
                : category === 'brands'
                  ? '搜索品牌'
                  : '搜索表情'
          }
          value={localSearchQuery}
          onChange={setLocalSearchQuery}
        />
      </PropertyGroup>

      {recentStickers.length > 0 && viewMode === 'browse' && (
        <PropertyGroup>
          <div className="flex items-center gap-2">
            <Clock className="text-muted-foreground size-4" />
            <span className="text-sm font-medium">{'最近'}</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={clearRecentStickers}
                    className="hover:bg-accent ml-auto flex size-5 items-center justify-center rounded p-0"
                  >
                    <X className="text-muted-foreground size-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{'清空最近贴纸'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <StickerGrid
            icons={recentStickers.slice(0, 12)}
            onAdd={handleAddSticker}
            addingSticker={addingSticker}
            capSize
          />
        </PropertyGroup>
      )}

      {viewMode === 'collection' && selectedCollection && (
        <PropertyGroup>
          {isLoadingCollection ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="text-muted-foreground size-6" />
            </div>
          ) : showCollectionItems ? (
            <StickerGrid
              icons={iconsToDisplay}
              onAdd={handleAddSticker}
              addingSticker={addingSticker}
            />
          ) : (
            <div className="flex items-center justify-center py-8">
              <Spinner className="text-muted-foreground size-6" />
            </div>
          )}
        </PropertyGroup>
      )}

      {viewMode === 'search' &&
        (isSearching ? (
          <PropertyGroup grow>
            <PanelState text={'正在搜索…'} />
          </PropertyGroup>
        ) : searchResults?.icons.length ? (
          <PropertyGroup>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                {`${searchResults.total} results`}
              </span>
            </div>
            <StickerGrid
              icons={iconsToDisplay}
              onAdd={handleAddSticker}
              addingSticker={addingSticker}
              capSize
            />
          </PropertyGroup>
        ) : searchQuery ? (
          <PropertyGroup grow>
            <PanelState
              text={'未找到匹配的贴纸'}
              hint={`没有与「${searchQuery}」匹配的结果`}
              action={
                category === 'all'
                  ? undefined
                  : {
                      label: '在所有图标中搜索',
                      onClick: () => {
                        const q = localSearchQuery || searchQuery;
                        if (q) {
                          setSearchQuery({ query: q });
                        }
                        setSelectedCategory({ category: 'all' });
                        if (q) {
                          searchStickers({ query: q });
                        }
                      },
                    }
              }
            />
          </PropertyGroup>
        ) : null)}

      {viewMode === 'browse' && !selectedCollection && (
        <PropertyGroup>
          {isLoadingCollections ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="text-muted-foreground size-6" />
            </div>
          ) : (
            <>
              {category !== 'all' && (
                <CollectionGrid
                  collections={filteredCollections}
                  onSelectCollection={({ prefix }) => setSelectedCollection({ collection: prefix })}
                />
              )}

              {category === 'all' && filteredCollections.length > 0 && (
                <CollectionGrid
                  collections={filteredCollections.slice(0, collectionsToShow)}
                  onSelectCollection={({ prefix }) => setSelectedCollection({ collection: prefix })}
                />
              )}
            </>
          )}
        </PropertyGroup>
      )}
    </>
  );
}

interface CollectionItemProps {
  title: string;
  subtitle: string;
  onClick: () => void;
}

function CollectionItem({ title, subtitle, onClick }: CollectionItemProps) {
  return (
    <Button variant="outline" className="h-auto justify-between rounded-md py-2" onClick={onClick}>
      <div className="text-left">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground text-xs">{subtitle}</p>
      </div>
      <ArrowRight className="size-4" />
    </Button>
  );
}

interface StickerItemProps {
  iconName: string;
  onAdd: (iconName: string) => void;
  isAdding?: boolean;
  capSize?: boolean;
}

function StickerItem({ iconName, onAdd, isAdding, capSize = false }: StickerItemProps) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (!iconName) {
      return;
    }
    setImageError(false);
  }, [iconName]);

  const displayName = iconName.split(':')[1] || iconName;
  const collectionPrefix = iconName.split(':')[0];

  const preview = imageError ? (
    <div className="flex size-full items-center justify-center p-2">
      <span className="text-muted-foreground text-center text-xs break-all">{displayName}</span>
    </div>
  ) : (
    <div className="flex size-full items-center justify-center p-4">
      <img
        /* 唯一 URL 构造函数（上游回落链已收进 localTool 代理，前端不再自己试三家）—— TD-22-47 */
        src={buildIconSvgUrl(iconName, { width: 64, height: 64 })}
        alt={displayName}
        width={64}
        height={64}
        className="size-full object-contain"
        style={
          capSize
            ? {
                maxWidth: 'var(--sticker-max, 160px)',
                maxHeight: 'var(--sticker-max, 160px)',
              }
            : undefined
        }
        onError={() => setImageError(true)}
        loading="lazy"
      />
    </div>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn('relative', isAdding && 'pointer-events-none opacity-50')}>
          <DraggableItem
            name={displayName}
            preview={preview}
            dragData={{
              id: iconName,
              type: 'sticker',
              name: displayName,
              iconName,
            }}
            onAddToTimeline={() => onAdd(iconName)}
            aspectRatio={1}
            shouldShowLabel={false}
            isRounded={true}
            variant="card"
            className=""
            containerClassName="w-full"
          />
          {isAdding && (
            <div className="ve-veil rounded-md">
              <Spinner className="size-6" />
            </div>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1">
          <p className="font-medium">{displayName}</p>
          <p className="text-muted-foreground text-xs">{collectionPrefix}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
