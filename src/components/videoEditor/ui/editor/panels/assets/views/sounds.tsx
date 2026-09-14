'use client';
import { logger } from '@videoEditor/lib/logger';

import { useEffect, useState } from 'react';
import { Button } from '@videoEditor/ui/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@videoEditor/ui/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@videoEditor/ui/ui/dropdown-menu';
import { Input } from '@videoEditor/ui/ui/input';
import { ScrollArea } from '@videoEditor/ui/ui/scroll-area';
import { Separator } from '@videoEditor/ui/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@videoEditor/ui/ui/tabs';
import { useInfiniteScroll } from '@videoEditor/hooks-cutia/use-infinite-scroll';
import { useSoundSearch } from '@videoEditor/hooks-cutia/use-sound-search';
import { useSoundsStore } from '@videoEditor/stores/sounds-store';
import type { SavedSound, SoundEffect } from '@videoEditor/types/sounds';
import { cn } from '@videoEditor/utils/ui';
import {
  FavouriteIcon,
  FilterMailIcon,
  PauseIcon,
  PlayIcon,
  PlusSignIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

export function SoundsView() {
  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="sound-effects" className="flex h-full flex-col">
        <div className="px-3 pt-4 pb-0">
          <TabsList>
            <TabsTrigger value="sound-effects">{'音效'}</TabsTrigger>
            <TabsTrigger value="songs">{'音乐'}</TabsTrigger>
            <TabsTrigger value="saved">{'已保存'}</TabsTrigger>
          </TabsList>
        </div>
        <Separator className="my-4" />
        <TabsContent value="sound-effects" className="mt-0 flex min-h-0 flex-1 flex-col p-5 pt-0">
          <SoundEffectsView />
        </TabsContent>
        <TabsContent value="saved" className="mt-0 flex min-h-0 flex-1 flex-col p-5 pt-0">
          <SavedSoundsView />
        </TabsContent>
        <TabsContent value="songs" className="mt-0 flex min-h-0 flex-1 flex-col p-5 pt-0">
          <SongsView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SoundEffectsView() {
  const {
    topSoundEffects,
    isLoading,
    searchQuery,
    setSearchQuery,
    scrollPosition,
    setScrollPosition,
    loadSavedSounds,
    showCommercialOnly,
    toggleCommercialFilter,
    hasLoaded,
    setTopSoundEffects,
    setLoading,
    setError,
    setHasLoaded,
    setCurrentPage,
    setHasNextPage,
    setTotalCount,
  } = useSoundsStore();
  const {
    results: searchResults,
    isLoading: isSearching,
    loadMore,
    hasNextPage,
    isLoadingMore,
  } = useSoundSearch({
    query: searchQuery,
    commercialOnly: showCommercialOnly,
  });

  const [playingId, setPlayingId] = useState<number | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const { scrollAreaRef, handleScroll } = useInfiniteScroll({
    onLoadMore: loadMore,
    hasMore: hasNextPage,
    isLoading: isLoadingMore || isSearching,
  });

  useEffect(() => {
    loadSavedSounds();
  }, [loadSavedSounds]);

  useEffect(() => {
    if (hasLoaded) {
      return;
    }

    let shouldIgnore = false;

    const fetchTopSounds = async () => {
      try {
        if (!shouldIgnore) {
          setLoading({ loading: true });
          setError({ error: null });
        }

        const response = await fetch('/api/sounds/search?page_size=50&sort=downloads');

        if (!shouldIgnore) {
          if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status}`);
          }

          const data = await response.json();
          setTopSoundEffects({ sounds: data.results });
          setHasLoaded({ loaded: true });

          setCurrentPage({ page: 1 });
          setHasNextPage({ hasNext: !!data.next });
          setTotalCount({ count: data.count });
        }
      } catch (error) {
        if (!shouldIgnore) {
          logger.error('Failed to fetch top sounds:', error);
          setError({
            error: error instanceof Error ? error.message : 'Failed to load sounds',
          });
        }
      } finally {
        if (!shouldIgnore) {
          setLoading({ loading: false });
        }
      }
    };

    const timeoutId = setTimeout(fetchTopSounds, 100, {});

    return () => {
      shouldIgnore = true;
      clearTimeout(timeoutId);
    };
  }, [
    hasLoaded,
    setTopSoundEffects,
    setLoading,
    setError,
    setHasLoaded,
    setCurrentPage,
    setHasNextPage,
    setTotalCount,
  ]);

  useEffect(() => {
    if (!scrollAreaRef.current || scrollPosition <= 0) {
      return;
    }

    const restoreScrollPosition = () => {
      scrollAreaRef.current?.scrollTo({ top: scrollPosition });
    };

    const timeoutId = setTimeout(restoreScrollPosition, 100, {});

    return () => clearTimeout(timeoutId);
  }, [scrollPosition, scrollAreaRef]);

  const handleScrollWithPosition = ({ currentTarget }: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = currentTarget;
    setScrollPosition({ position: scrollTop });
    handleScroll({ currentTarget } as React.UIEvent<HTMLDivElement>);
  };

  const displayedSounds = searchQuery ? searchResults : topSoundEffects;

  const playSound = ({ sound }: { sound: SoundEffect }) => {
    if (playingId === sound.id) {
      audioElement?.pause();
      setPlayingId(null);
      return;
    }

    audioElement?.pause();

    if (sound.previewUrl) {
      const audio = new Audio(sound.previewUrl);
      audio.addEventListener('ended', () => {
        setPlayingId(null);
      });
      audio.addEventListener('error', () => {
        setPlayingId(null);
      });
      audio.play().catch((error: DOMException) => {
        if (error.name === 'AbortError') return;
        logger.error('Failed to play sound preview:', error);
        setPlayingId(null);
      });

      setAudioElement(audio);
      setPlayingId(sound.id);
    }
  };

  return (
    <div className="mt-1 flex h-full flex-col gap-5">
      <div className="flex items-center gap-3">
        <Input
          placeholder={'搜索音效'}
          className="bg-accent w-full"
          containerClassName="w-full"
          value={searchQuery}
          onChange={({ currentTarget }) => setSearchQuery({ query: currentTarget.value })}
          showClearIcon
          onClear={() => setSearchQuery({ query: '' })}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="text" size="icon" className={cn(showCommercialOnly && 'text-primary')}>
              <HugeiconsIcon icon={FilterMailIcon} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuCheckboxItem
              checked={showCommercialOnly}
              onCheckedChange={() => toggleCommercialFilter()}
            >
              {'仅显示商业授权'}
            </DropdownMenuCheckboxItem>
            <div className="text-muted-foreground px-2 py-1.5 text-xs">
              {showCommercialOnly ? '仅显示可用于商业用途的音效' : '显示所有音效（不限授权）'}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="relative h-full overflow-hidden">
        <ScrollArea
          className="h-full flex-1"
          ref={scrollAreaRef}
          onScrollCapture={handleScrollWithPosition}
        >
          <div className="flex flex-col gap-4">
            {isLoading && !searchQuery && (
              <div className="text-muted-foreground text-sm">{'正在加载音效…'}</div>
            )}
            {isSearching && searchQuery && (
              <div className="text-muted-foreground text-sm">{'搜索中…'}</div>
            )}
            {displayedSounds.map((sound) => (
              <AudioItem
                key={sound.id}
                sound={sound}
                isPlaying={playingId === sound.id}
                onPlay={playSound}
              />
            ))}
            {!isLoading && !isSearching && displayedSounds.length === 0 && (
              <div className="text-muted-foreground text-sm">
                {searchQuery ? '未找到音效' : '没有可用音效'}
              </div>
            )}
            {isLoadingMore && (
              <div className="text-muted-foreground py-4 text-center text-sm">
                {'正在加载更多音效…'}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function SavedSoundsView() {
  const { savedSounds, isLoadingSavedSounds, savedSoundsError, loadSavedSounds, clearSavedSounds } =
    useSoundsStore();

  const [playingId, setPlayingId] = useState<number | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const [showClearDialog, setShowClearDialog] = useState(false);

  useEffect(() => {
    loadSavedSounds();
  }, [loadSavedSounds]);

  const playSound = ({ sound }: { sound: SoundEffect }) => {
    if (playingId === sound.id) {
      audioElement?.pause();
      setPlayingId(null);
      return;
    }

    audioElement?.pause();

    if (sound.previewUrl) {
      const audio = new Audio(sound.previewUrl);
      audio.addEventListener('ended', () => {
        setPlayingId(null);
      });
      audio.addEventListener('error', () => {
        setPlayingId(null);
      });
      audio.play().catch((error: DOMException) => {
        if (error.name === 'AbortError') return;
        logger.error('Failed to play sound preview:', error);
        setPlayingId(null);
      });

      setAudioElement(audio);
      setPlayingId(sound.id);
    }
  };

  const convertToSoundEffect = ({ savedSound }: { savedSound: SavedSound }): SoundEffect => ({
    id: savedSound.id,
    name: savedSound.name,
    description: '',
    url: '',
    previewUrl: savedSound.previewUrl,
    downloadUrl: savedSound.downloadUrl,
    duration: savedSound.duration,
    filesize: 0,
    type: 'audio',
    channels: 0,
    bitrate: 0,
    bitdepth: 0,
    samplerate: 0,
    username: savedSound.username,
    tags: savedSound.tags,
    license: savedSound.license,
    created: savedSound.savedAt,
    downloads: 0,
    rating: 0,
    ratingCount: 0,
  });

  if (isLoadingSavedSounds) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground text-sm">{'正在加载已保存音效…'}</div>
      </div>
    );
  }

  if (savedSoundsError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-destructive text-sm">{`Error: ${savedSoundsError}`}</div>
      </div>
    );
  }

  if (savedSounds.length === 0) {
    return (
      <div className="bg-background flex h-full flex-col items-center justify-center gap-3 p-4">
        <HugeiconsIcon icon={FavouriteIcon} className="text-muted-foreground size-10" />
        <div className="flex flex-col gap-2 text-center">
          <p className="text-lg font-medium">{'没有已保存的音效'}</p>
          <p className="text-muted-foreground text-sm text-balance">
            {'点击任意音效上的爱心图标即可保存到此处'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1 flex h-full flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {`${savedSounds.length} saved ${savedSounds.length === 1 ? '音效' : '音效'}`}
        </p>
        <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
          <DialogTrigger asChild>
            <Button
              variant="text"
              size="sm"
              className="text-muted-foreground hover:text-destructive h-auto !opacity-100"
            >
              {'全部清除'}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{'清空所有已保存音效？'}</DialogTitle>
              <DialogDescription>
                {`This will permanently remove all ${savedSounds.length} saved sounds from your collection. This action cannot be undone.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="text" onClick={() => setShowClearDialog(false)}>
                {'取消'}
              </Button>
              <Button
                variant="destructive"
                onClick={async ({ stopPropagation }: React.MouseEvent<HTMLButtonElement>) => {
                  stopPropagation();
                  await clearSavedSounds();
                  setShowClearDialog(false);
                }}
              >
                {'清空所有音效'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative h-full overflow-hidden">
        <ScrollArea className="h-full flex-1">
          <div className="flex flex-col gap-4">
            {savedSounds.map((sound) => (
              <AudioItem
                key={sound.id}
                sound={convertToSoundEffect({ savedSound: sound })}
                isPlaying={playingId === sound.id}
                onPlay={playSound}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function SongsView() {
  return <div>{'音乐'}</div>;
}

interface AudioItemProps {
  sound: SoundEffect;
  isPlaying: boolean;
  onPlay: ({ sound }: { sound: SoundEffect }) => void;
}

function AudioItem({ sound, isPlaying, onPlay }: AudioItemProps) {
  const { addSoundToTimeline, isSoundSaved, toggleSavedSound } = useSoundsStore();
  const isSaved = isSoundSaved({ soundId: sound.id });

  const handleClick = () => {
    onPlay({ sound });
  };

  const handleSaveClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    toggleSavedSound({ soundEffect: sound });
  };

  const handleAddToTimeline = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    await addSoundToTimeline({ sound });
  };

  return (
    <div className="group flex items-center gap-3 opacity-100 hover:opacity-75">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={handleClick}
      >
        <div className="bg-accent relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md">
          <div className="from-primary/20 absolute inset-0 bg-gradient-to-br to-transparent" />
          {isPlaying ? (
            <HugeiconsIcon icon={PauseIcon} className="size-5" />
          ) : (
            <HugeiconsIcon icon={PlayIcon} className="size-5" />
          )}
        </div>

        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="truncate text-sm font-medium">{sound.name}</p>
          <span className="text-muted-foreground block truncate text-xs">{sound.username}</span>
        </div>
      </button>

      <div className="flex items-center gap-3 pr-2">
        <Button
          variant="text"
          size="icon"
          className="text-muted-foreground hover:text-foreground w-auto !opacity-100"
          onClick={handleAddToTimeline}
          title={'添加到时间轴'}
        >
          <HugeiconsIcon icon={PlusSignIcon} />
        </Button>
        <Button
          variant="text"
          size="icon"
          className={`hover:text-foreground w-auto !opacity-100 ${
            isSaved ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground'
          }`}
          onClick={handleSaveClick}
          title={isSaved ? '从已保存中移除' : '保存音效'}
        >
          <HugeiconsIcon icon={FavouriteIcon} className={`${isSaved ? 'fill-current' : ''}`} />
        </Button>
      </div>
    </div>
  );
}
