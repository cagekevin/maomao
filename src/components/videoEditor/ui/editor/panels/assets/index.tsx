'use client';

import { Separator } from '@/components/videoEditor/ui/ui/separator';
import {
  PanelBaseView,
  VideoEditorPanelState,
} from '@/components/videoEditor/ui/editor/panels/panel-base-view';
import { PropertyGroup } from '@/components/videoEditor/ui/editor/panels/properties/property-item';
import { type Tab, useAssetsPanelStore } from '@/components/videoEditor/stores/assets-panel-store';
import { TabBar } from './tabbar';
import { Captions } from './views/captions';
import { MediaView } from './views/media';
import { SoundsView } from './views/sounds';
import { SettingsView } from './views/settings';
import { StickersView } from './views/stickers';
import { TextView } from './views/text';
import { TransitionsView } from './views/transitions';

/**
 * 素材面板 = 左侧图标栏 + 视图槽，横向两栏。
 *
 * 【高度链】面板根 `flex h-full min-h-0` → 两个子项都 `min-h-0`：
 *   · 图标栏 `shrink-0`（宽度由它自己定，永不被压扁）；
 *   · 视图槽 `min-w-0 flex-1`（吃掉剩余宽高）。
 * 视图槽用 `overflow-hidden` 关掉自身滚动 —— 滚动只发生在视图内部的
 * `PanelBaseView`（那**一个** `ScrollArea`），panel 层再滚一次就是第二层滚动。
 */
export function AssetsPanel() {
  const { activeTab } = useAssetsPanelStore();

  // 更新(2026-09-14)：sounds / captions **已恢复**（误判为 AI 相关而删除，实测零 AI 依赖 ——
  //   音效库=素材能力；字幕=浏览器内 Whisper 本地转写。见 docs/133 §〇.4）。
  // 更新(2026-09-16)：`ai` tab 已删（AI 域随 docs/130 整体移除，本仓不移植；残留 tab 点击只说
  //   「未移植」= 死入口，用户裁定删除）。
  // 未实现的视图（effects / filters / adjustment）也走同一套面板语言（`grow` 分区 + `PanelState`），
  // 不再自造 `p-4` 占位块。
  const notice = (text: string, hint: string) => (
    <PanelBaseView>
      <PropertyGroup grow>
        <VideoEditorPanelState text={text} hint={hint} />
      </PropertyGroup>
    </PanelBaseView>
  );

  const viewMap: Record<Tab, React.ReactNode> = {
    media: <MediaView />,
    sounds: <SoundsView />,
    text: <TextView />,
    stickers: <StickersView />,
    effects: notice('效果', '该视图尚未实现'),
    transitions: <TransitionsView />,
    captions: <Captions />,
    filters: notice('滤镜', '该视图尚未实现'),
    adjustment: notice('调整', '该视图尚未实现'),
    settings: <SettingsView />,
  };

  return (
    <div className="panel bg-background flex h-full min-h-0 overflow-hidden border">
      <TabBar />
      <Separator orientation="vertical" className="shrink-0" />
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{viewMap[activeTab]}</div>
    </div>
  );
}
