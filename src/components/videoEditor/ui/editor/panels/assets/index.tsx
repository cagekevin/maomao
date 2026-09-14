'use client';

import { Separator } from '@videoEditor/ui/ui/separator';
import { type Tab, useAssetsPanelStore } from '@videoEditor/stores/assets-panel-store';
import { TabBar } from './tabbar';
import { Captions } from './views/captions';
import { MediaView } from './views/media';
import { SoundsView } from './views/sounds';
import { SettingsView } from './views/settings';
import { StickersView } from './views/stickers';
import { TextView } from './views/text';
import { TransitionsView } from './views/transitions';

export function AssetsPanel() {
  const { activeTab } = useAssetsPanelStore();

  // 更新(2026-09-14)：sounds / captions **已恢复**（误判为 AI 相关而删除，实测零 AI 依赖 ——
  //   音效库=素材能力；字幕=浏览器内 Whisper 本地转写。见 docs/133 §〇.4）。
  // 仍缺的只有 ai（真属 AI 域）。
  const removedView = (name: string) => (
    <div className="text-muted-foreground p-4">{`${name} 未移植（AI 域已移除）`}</div>
  );

  const viewMap: Record<Tab, React.ReactNode> = {
    media: <MediaView />,
    sounds: <SoundsView />,
    text: <TextView />,
    stickers: <StickersView />,
    effects: <div className="text-muted-foreground p-4">Effects view coming soon...</div>,
    transitions: <TransitionsView />,
    captions: <Captions />,
    filters: <div className="text-muted-foreground p-4">Filters view coming soon...</div>,
    adjustment: <div className="text-muted-foreground p-4">Adjustment view coming soon...</div>,
    ai: removedView('AI'),
    settings: <SettingsView />,
  };

  return (
    <div className="panel bg-background flex h-full border overflow-hidden">
      <TabBar />
      <Separator orientation="vertical" />
      <div className="flex-1 overflow-hidden">{viewMap[activeTab]}</div>
    </div>
  );
}
