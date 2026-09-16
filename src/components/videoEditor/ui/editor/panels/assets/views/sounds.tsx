'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/videoEditor/ui/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/videoEditor/ui/ui/dialog';
import { Input } from '@/components/videoEditor/ui/ui/input';
import {
  PanelBaseView as BaseView,
  PanelState,
} from '@/components/videoEditor/ui/editor/panels/panel-base-view';
import { PropertyGroup } from '@/components/videoEditor/ui/editor/panels/properties/property-item';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/videoEditor/ui/ui/tooltip';
import {
  useSoundLibrary,
  type SoundKind,
  type SoundLibraryItem,
} from '@/components/videoEditor/hooks-cutia/use-sound-library';
import { useSoundPreview } from '@/components/videoEditor/hooks-cutia/use-sound-preview';
import { useSoundsStore } from '@/components/videoEditor/stores/sounds-store';
import type { SavedSound, SoundEffect } from '@/components/videoEditor/types/sounds';
import { Pause, Play, Plus, RefreshCw, Star } from 'lucide-react';

export function SoundsView() {
  // 三个 tab 交给壳（与「设置」同一套 tabs 语言）：tab 的 content 是**纯内容**，不是第二个壳。
  return (
    <BaseView
      defaultTab="sound-effects"
      tabs={[
        { value: 'sound-effects', label: '音效', content: <SoundLibraryPanel kind="effect" /> },
        { value: 'songs', label: '音乐', content: <SoundLibraryPanel kind="music" /> },
        { value: 'saved', label: '已保存', content: <SavedSoundsView /> },
      ]}
    />
  );
}

/**
 * 声音库面板 —— 音效 / 音乐**共用一份**展示逻辑（自建本地库）。
 *
 * 【为什么音效与音乐合用一个组件（TD-22-47）】两者除「读哪个目录」外完全同构
 * （搜索 → 列表 → 试听 / 入轨 / 收藏）。原 `SongsView` 是 `return <div>音乐</div>` 空壳、
 * `SoundEffectsView` 自成一套 —— 若各写一份，第三个分类出现时必然是第三份。
 */
function SoundLibraryPanel({ kind }: { kind: SoundKind }) {
  const { items, isLoading, error, dir, reload } = useSoundLibrary({ kind });
  const [query, setQuery] = useState('');
  const { playingId, toggle: togglePreview } = useSoundPreview();
  const { loadSavedSounds } = useSoundsStore();

  // 收藏（爱心）状态依赖已保存列表 —— 与「库」本身无关，但同一面板要显示它。
  useEffect(() => {
    loadSavedSounds();
  }, [loadSavedSounds]);

  const label = kind === 'music' ? '音乐' : '音效';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, query]);

  if (isLoading) {
    return (
      <PropertyGroup grow>
        <PanelState text={`正在加载${label}库…`} />
      </PropertyGroup>
    );
  }

  if (error) {
    // TD-22-47 的**失败可见**：旧实现是 `response.ok` 为假 → 静默空面板（用户分不清"没有"与"坏了"）。
    return (
      <PropertyGroup grow>
        <PanelState
          tone="error"
          text={`${label}库加载失败`}
          hint={error}
          action={{ label: '重试', onClick: reload }}
        />
      </PropertyGroup>
    );
  }

  return (
    <>
      <PropertyGroup>
        <div className="flex items-center gap-2">
          <Input
            placeholder={`搜索${label}`}
            className="w-full"
            containerClassName="w-full"
            value={query}
            onChange={({ currentTarget }) => setQuery(currentTarget.value)}
            showClearIcon
            onClear={() => setQuery('')}
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="text"
                  size="icon"
                  className="items-center justify-center"
                  onClick={reload}
                >
                  <RefreshCw />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{'重新扫描本地声音目录'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </PropertyGroup>

      {items.length === 0 ? (
        /* 空库 = **合法状态**（不是错误）：告诉用户"放哪儿"。`dir` 是后端给的真源，前端不拼路径。 */
        <PropertyGroup grow>
          <PanelState
            text={`${label}库是空的`}
            hint={dir ? `把音频文件放进 uploads/${dir}/ 后点右上角刷新` : undefined}
          />
        </PropertyGroup>
      ) : (
        <PropertyGroup>
          {filtered.map((item) => (
            <AudioItem
              key={item.id}
              sound={toSoundEffect(item)}
              isPlaying={playingId === item.id}
              onPlay={togglePreview}
            />
          ))}
          {filtered.length === 0 && (
            <div className="text-muted-foreground text-sm">{`未找到匹配的${label}`}</div>
          )}
        </PropertyGroup>
      )}
    </>
  );
}

/**
 * 本地库条目 → 面板与存档沿用的 `SoundEffect` 形状。
 * 第三方时代的字段（username/downloads/rating…）给**中性默认值**，不伪造数据。
 */
function toSoundEffect(item: SoundLibraryItem): SoundEffect {
  return {
    id: item.id,
    name: item.name,
    description: '',
    url: item.url,
    previewUrl: item.url,
    downloadUrl: item.url,
    // 时长不在清单里（后端不读音频元数据）；入轨时由 addSoundToTimeline 解出的真实 buffer 提供。
    duration: 0,
    filesize: item.size,
    type: 'audio',
    channels: 0,
    bitrate: 0,
    bitdepth: 0,
    samplerate: 0,
    username: '本地库',
    tags: [],
    license: '',
    created: '',
    downloads: 0,
    rating: 0,
    ratingCount: 0,
  };
}

function SavedSoundsView() {
  const { savedSounds, isLoadingSavedSounds, savedSoundsError, loadSavedSounds, clearSavedSounds } =
    useSoundsStore();

  const { playingId, toggle: togglePreview } = useSoundPreview();

  const [showClearDialog, setShowClearDialog] = useState(false);

  useEffect(() => {
    loadSavedSounds();
  }, [loadSavedSounds]);

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
      <PropertyGroup grow>
        <PanelState text={'正在加载已保存音效…'} />
      </PropertyGroup>
    );
  }

  if (savedSoundsError) {
    return (
      <PropertyGroup grow>
        <PanelState tone="error" text={'已保存音效加载失败'} hint={savedSoundsError} />
      </PropertyGroup>
    );
  }

  if (savedSounds.length === 0) {
    return (
      <PropertyGroup grow>
        <PanelState text={'没有已保存的音效'} hint={'点击任意音效上的爱心图标即可保存到此处'} />
      </PropertyGroup>
    );
  }

  return (
    <>
      <PropertyGroup>
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
      </PropertyGroup>

      <PropertyGroup>
        {savedSounds.map((sound) => (
          <AudioItem
            key={sound.id}
            sound={convertToSoundEffect({ savedSound: sound })}
            isPlaying={playingId === sound.id}
            onPlay={togglePreview}
          />
        ))}
      </PropertyGroup>
    </>
  );
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
        <div className="bg-muted text-foreground relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md">
          <div className="from-primary/20 absolute inset-0 bg-gradient-to-br to-transparent" />
          {isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
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
          <Plus />
        </Button>
        <Button
          variant="text"
          size="icon"
          className={`hover:text-foreground w-auto !opacity-100 ${
            isSaved ? 'text-destructive hover:opacity-80' : 'text-muted-foreground'
          }`}
          onClick={handleSaveClick}
          title={isSaved ? '从已保存中移除' : '保存音效'}
        >
          <Star className={`${isSaved ? 'fill-current' : ''}`} />
        </Button>
      </div>
    </div>
  );
}
