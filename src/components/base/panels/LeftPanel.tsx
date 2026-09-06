import { useMemo, useEffect, useRef } from 'react';
import { Clock, FolderOpen, Sparkles, Pin, PinOff, BookOpen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import './panel-kit.css';
import TaskCenter from './TaskCenter.tsx';
import GeneratedView from './GeneratedView.tsx';
import AssetLibrary from './AssetLibrary.tsx';
import PromptHub from '../prompt/PromptHub.tsx';
import { useTasks, usePanel, setPanel, getPanel, togglePin } from '../store/taskStore.ts';
import { useAssets } from '../store/assetStore.ts';

// tab 配置：任务 / 生成 / 素材 / 提示词库
export type PanelTabKey = 'tasks' | 'generated' | 'assets' | 'prompts';

interface PanelTab {
  key: PanelTabKey;
  label: string;
  icon: LucideIcon;
}

const TABS: PanelTab[] = [
  { key: 'tasks', label: '任务', icon: Clock },
  { key: 'generated', label: '生成', icon: Sparkles },
  { key: 'assets', label: '素材', icon: FolderOpen },
  { key: 'prompts', label: '提示词', icon: BookOpen },
];

/**
 * 左侧滑出面板：收起态是一条竖着的窄工具栏（图标 + 未读角标），
 * 点击图标滑出面板，内部用 tab 切换「任务中心 / 素材库」。
 * 点击面板外部 → 收起；点击收起箭头 → 收起。
 *
 * 展开/活动 tab 状态存于全局（taskStore.usePanel），使「生成任务时自动弹出任务中心」
 * （reportGenerate → openTaskCenter）能控制本面板。
 */
export default function LeftPanel() {
  const { expanded, activeTab, pinned } = usePanel();
  const setActiveTab = (key: PanelTabKey) => setPanel({ activeTab: key });
  const setExpanded = (v: boolean) => setPanel({ expanded: v });
  const tasks = useTasks();
  useAssets();
  const panelRef = useRef<HTMLDivElement>(null);

  // 未读角标：失败任务数 + 进行中任务数，单次遍历
  // 「进行中」口径对齐 TaskCenter（running || pending）；pending 是「已建单未开跑」，
  // statusLabel 同样显示为「生成中」，漏掉会导致刚提交的任务不显示角标。
  // 注：此处原写作 `status === 'queued'`，但 TaskStatus 无该取值（queued 属消息媒体态
  // mediaStatus / 节点 node.queued，与本任务表无关），是永假分支，已修正为 pending。
  // 语义色（panel-kit）：有失败 → 红（需处理）；无失败但仍有生成中/待跑 → 绿（进行中，非报错）；全部完成则无角标。
  const { badgeCount, badgeFailed } = useMemo(() => {
    let active = 0;
    let failed = 0;
    for (const t of tasks) {
      if (t.status === 'failed') {
        active++;
        failed++;
      } else if (t.status === 'running' || t.status === 'pending') active++;
    }
    return { badgeCount: active, badgeFailed: failed };
  }, [tasks]);

  // 点面板外部收起
  useEffect(() => {
    if (!expanded) return;
    const onDown = (e: PointerEvent) => {
      // 钉住态：点击面板外部不收起
      if (getPanel().pinned) return;
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setExpanded(false);
    };
    // 延时注册，避免展开瞬间的点击误关
    const t = setTimeout(() => document.addEventListener('pointerdown', onDown), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [expanded]);

  // 收起时同步保存当前 tab
  const openTab = (key) => {
    setActiveTab(key);
    setExpanded(true);
  };

  return (
    <>
      {/* 收起态：左侧竖条工具栏 */}
      {!expanded && (
        <div className="fixed left-3 top-1/2 -translate-y-1/2 z-sidebar flex flex-col items-center gap-1.5 bg-surface-panel/90 backdrop-blur border border-edge-faint rounded-xl px-1.5 py-2 shadow-lg">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            const showBadge = tab.key === 'tasks' && badgeCount > 0;
            return (
              <button
                key={tab.key}
                className={`relative w-9 h-9 flex items-center justify-center rounded-lg transition-colors cursor-pointer border-none ${isActive ? 'bg-surface-hover text-white' : 'text-muted hover:text-white hover:bg-surface-subtle'}`}
                title={tab.label}
                onClick={() => openTab(tab.key)}
              >
                <Icon size={17} />
                {showBadge && (
                  <span
                    className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full text-white text-meta font-semibold flex items-center justify-center ${badgeFailed > 0 ? 'bg-red-500' : 'bg-emerald-500'}`}
                  >
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 展开态：滑出面板 */}
      {expanded && (
        <div
          ref={panelRef}
          className="fixed left-3 top-2 bottom-2 z-sidebar w-[330px] bg-input border border-edge-faint rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-panel-in"
        >
          {/* 顶栏（48px，对齐 AI 助手 agent-header）：分段控件切 tab + 钉住
              分段控件在 330px 窄面板下的解法：未激活只留图标，激活项展开文字（见 panel-kit.css）。 */}
          <div className="pk-head">
            <div className="pk-seg" role="tablist" aria-label="面板分区">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                const showBadge = tab.key === 'tasks' && badgeCount > 0;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    title={tab.label}
                    className="pk-seg-item"
                    onClick={() => openTab(tab.key)}
                  >
                    <Icon size={16} />
                    <span className="pk-seg-label">{tab.label}</span>
                    {showBadge && (
                      <span className={`pk-badge ${badgeFailed > 0 ? '' : 'is-ok'}`}>
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <span className="pk-head-spacer" />
            {/* 钉住按钮：钉住后点击面板外部不自动收起（激活=蓝，语义：开关已启用） */}
            <button
              type="button"
              title={
                pinned
                  ? '已钉住（点击取消，点击外部不再自动关闭）'
                  : '钉住面板（点击外部不再自动关闭）'
              }
              aria-pressed={pinned}
              className={`pk-icon-btn ${pinned ? 'is-on' : ''}`}
              onClick={togglePin}
            >
              {pinned ? <PinOff size={15} /> : <Pin size={15} />}
            </button>
          </div>

          {/* 内容区 */}
          <div className="flex-1 min-h-0">
            {activeTab === 'tasks' ? (
              <TaskCenter />
            ) : activeTab === 'generated' ? (
              <GeneratedView />
            ) : activeTab === 'assets' ? (
              <AssetLibrary />
            ) : (
              <PromptHub />
            )}
          </div>
        </div>
      )}
    </>
  );
}
