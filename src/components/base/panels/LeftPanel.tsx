import { memo, useEffect, useRef, useState } from 'react';
import { Clock, FolderOpen, Sparkles, Pin, PinOff, BookOpen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import './panel-kit.css';
import TaskCenter from '@/components/task/TaskCenter';
import GeneratedView from '@/components/generate/GeneratedView';
import ResourceLibrary from '@/components/resource/ResourceLibrary';
import PromptHub from '@/components/prompt/PromptHub';
import { useTaskBadge, usePanel, setPanel, getPanel, togglePin } from '../store/taskStore.ts';
// 拖拽调宽原语（唯一实现；与 AI 面板 / 表格工作区共用同一份，见该 hook 文件头）
import { usePanelResize } from '@/hooks/usePanelResize';
import { clamp } from '../core/utils.ts';
import { contentGet, contentSet } from '../core/contentStore.ts';
import { confirmPersist } from '../core/log/degrade.ts';
import { KEY_LEFT_PANEL_WIDTH } from '../core/contracts.ts';

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
 * 面板宽度区间（px）—— 归本面板（各宿主自持自己的设计区间，见 `usePanelResize` 职责边界）。
 * · 默认 = 沿用改造前的 330（观感不倒退）；
 * · 下限 320 略低于默认值，给"想收窄一点"留余地，同时保证 3 列网格仍成立（见 `.pk-media-grid`）；
 * · 上限 900 ≈ 2.7 倍：再宽就遮满画布，且列数收益递减。
 */
const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 900;
const DEFAULT_PANEL_WIDTH = 330;

/**
 * 宽面板阈值（px）：≥ 此宽度时顶栏 4 个 tab 的**文字全部展开**（窄面板仍只展开激活项）。
 * 依据 = 4 项 ×（图标 28 + 文字 56 + 间距）≈ 390 + 顶栏其余件 ≈ 450 ⇒ 取 480 留余量。
 */
const WIDE_PANEL_THRESHOLD = 480;

/** 读宽度记忆（非法/缺失 → 默认值；越界 → 钳到区间）。 */
function loadPanelWidth(): number {
  const t = contentGet(KEY_LEFT_PANEL_WIDTH);
  const n = t ? Number(t) : NaN;
  return Number.isFinite(n) ? clamp(n, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH) : DEFAULT_PANEL_WIDTH;
}

/**
 * 左侧滑出面板：收起态是一条竖着的窄工具栏（图标 + 未读角标），
 * 点击图标滑出面板，内部用 tab 切换「任务中心 / 素材库」。
 * 点击面板外部 → 收起；点击收起箭头 → 收起。
 *
 * 展开/活动 tab 状态存于全局（taskStore.usePanel），使「生成任务时自动弹出任务中心」
 * （reportGenerate → openTaskCenter）能控制本面板。
 */
function LeftPanel() {
  const { expanded, activeTab, pinned } = usePanel();
  const setActiveTab = (key: PanelTabKey) => setPanel({ activeTab: key });
  const setExpanded = (v: boolean) => setPanel({ expanded: v });
  const panelRef = useRef<HTMLDivElement>(null);

  /**
   * 面板宽度（右缘「磁条」拖拽 + `left_panel_width` 记忆）。
   * 【为什么宽度**不**进 `taskStore.PanelState`】那个模块态的存在理由是「让外部入口能遥控面板」
   * （`openTaskCenter` / `openResourceLibrary`）；而宽度**只有本面板自己消费**（无第二消费者）
   * ⇒ 收进共享态只会扩大对外契约面而不换来任何复用。
   */
  const [width, setWidth] = useState(loadPanelWidth);
  const { dragging, handleProps: widthGripProps } = usePanelResize({
    width,
    onChange: setWidth,
    anchor: 'right',
    min: MIN_PANEL_WIDTH,
    max: MAX_PANEL_WIDTH,
  });
  // 宽度落盘：**拖拽中不写** —— 鼠标每移动一像素就写一次 localStorage 是同步 IO，
  // 会把拖拽拖成掉帧；`dragging` 回 false 时统一落一次（含首次挂载的写回，与 AI 面板同性质）。
  useEffect(() => {
    if (dragging) return;
    confirmPersist(contentSet(KEY_LEFT_PANEL_WIDTH, String(width)), {
      layer: 'leftPanel',
      key: KEY_LEFT_PANEL_WIDTH,
    });
  }, [width, dragging]);

  // 未读角标：失败任务数 + 进行中任务数，单次遍历
  // 「进行中」口径对齐 TaskCenter（running || pending）；pending 是「已建单未开跑」，
  // statusLabel 同样显示为「生成中」，漏掉会导致刚提交的任务不显示角标。
  // 注：此处原写作 `status === 'queued'`，但 TaskStatus 无该取值（queued 属消息媒体态
  // mediaStatus / 节点 node.queued，与本任务表无关），是永假分支，已修正为 pending。
  // 语义色（panel-kit）：有失败 → 红（需处理）；无失败但仍有生成中/待跑 → 绿（进行中，非报错）；全部完成则无角标。
  // 【TD-04-47】角标改用 store 的**原子订阅**（口径收口到 `taskStore.computeTaskCounts`，
  // 与 TaskCenter 共用同一份 —— 此前两处各写一份同义口径）。
  // 此前整包订阅 `tasks` + 组件内遍历 ⇒ 任务进度高频 notify 时 LeftPanel 每帧重渲。
  // 口径等价性：旧 `active` 已把 failed/unknown 一并计入 ⇒ `badgeCount = running + failed` 逐项等价。
  const { running, failed: badgeFailed } = useTaskBadge();
  const badgeCount = running + badgeFailed;

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
  const openTab = (key: PanelTabKey) => {
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
          // 宽度改由右缘「磁条」拖拽（`style.width`），默认值仍是 330 ⇒ 观感与改造前一致。
          className={`fixed left-3 top-2 bottom-2 z-sidebar bg-input border border-edge-faint rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-panel-in${dragging ? ' select-none' : ''}`}
          style={{ width }}
          // 宽面板档位（≥480px）：顶栏 4 个 tab 文字全部展开（CSS 见 panel-kit.css）。
          data-panel-wide={width >= WIDE_PANEL_THRESHOLD ? 'true' : undefined}
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
              <ResourceLibrary />
            ) : (
              <PromptHub />
            )}
          </div>

          {/* 右缘宽度拖拽手柄（「磁条」）——平时透明不占视觉，hover/拖拽中显色。
              原语与 AI 面板 / 表格工作区**同一份**（`usePanelResize`）。 */}
          <div
            {...widthGripProps}
            className={`pk-grip${dragging ? ' is-dragging' : ''}`}
            title="拖动调整面板宽度"
          />
        </div>
      )}
    </>
  );
}

/**
 * 【TD-04-46】`memo` 在这里是**结构上有效**的，不是护栏：
 * ① 本组件**零 prop**（调用点 `<LeftPanel />`）⇒ 浅比较恒相等 ⇒ 父组件（App）重渲**不会**带动它；
 * ② 它需要的重渲由**自己的订阅**驱动：`usePanel()`（展开/tab/钉住）+ `useTaskBadge()`（角标，TD-04-47 的原子订阅）
 *    ⇒ 不依赖父组件重渲 ⇒ **无"陈旧"风险**（本组件渲染期不读任何模块级可变态，只读上面两个 hook）。
 * 【为什么值得】App 持 `useNodesState` 的 nodes（`App.tsx:244`）⇒ 拖拽每帧 `setNodes` ⇒ App 每帧重渲；
 * 本面板与 `AgentPanel` 是 App 里**常驻挂载**的两块（其余常驻件 TopNav / CanvasToolbar / ContextMenu /
 * ToastContainer / ConfirmContainer 均已 memo），此前每帧陪跑。
 */
export default memo(LeftPanel);
