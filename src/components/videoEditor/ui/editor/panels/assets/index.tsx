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
      {/*
        【高度链修正 2026-09-15】原为 `flex-1 overflow-hidden`（只声明了宽度伸缩）。
        父容器是 `flex`（row 方向），子视图（如 `MediaView`）根元素用 `h-full` —— 其百分比
        高度需要父元素有**确定高度**。原写法下高度依赖 stretch 隐式推断，在各视图内容为空时
        容易塌成 0 → **整块面板看起来"什么都没有"**（用户实测：看不到素材区的拖放提示）。
        这里显式给 `h-full min-h-0`（`min-h-0` 防 flex 子项被内容顶破），把高度链钉死。
      */}
      <div className="flex-1 h-full min-h-0 overflow-hidden">{viewMap[activeTab]}</div>
    </div>
  );
}
