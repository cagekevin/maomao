import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStore,
} from '@xyflow/react';
import type { Node, Edge, Connection } from '@xyflow/react';
import { Zap, RefreshCw } from 'lucide-react';
import CanvasToolbar from './components/base/panels/CanvasToolbar.tsx';
import ArrangeConfirm from './components/base/canvas/ArrangeConfirm.tsx';
import { useArrangeCanvas } from './hooks/useArrangeCanvas.ts';
import { useAssetDropPaste, useGlobalPaste } from './hooks/useAssetDropPaste.ts';
import { copyImageToClipboard } from './components/base/utils/clipboard.ts';
import GhostTargetNode from './components/nodes/GhostTargetNode.tsx';
import AgentPanel from './components/panels/AgentPanel.tsx';
import { getNodeImageUrl } from './components/agent/index.ts';
import LeftPanel from './components/base/panels/LeftPanel.tsx';
import {
  switchProject,
  loadCanvasState,
  saveCanvasState,
  getCurrentProject,
  initProjects,
  useCurrentProjectId,
} from './components/base/store/projectStore.ts';
import previewUrls from './components/base/utils/previewUrl.ts';
import { logger } from './components/base/core/logger.ts';
import {
  useProjectBackupIO,
  useAssetUrlRewrite,
  usePersistFailureToast,
} from './components/base/canvas/useCanvasEventSubscriptions.ts';
import { menuForState, type MenuActionCtx } from './components/base/canvas/canvasContextMenu.tsx';
import { useNodePosition } from './components/base/core/uiHooks.ts';
import CustomEdge from './components/edges/CustomEdge.tsx';
import ConnectionLine from './components/edges/ConnectionLine.tsx';
import ContextMenu, { ContextMenuItem } from './components/base/ui/ContextMenu.tsx';
import { useContextMenu } from './hooks/useContextMenu.ts';
import { useCanvasHistory } from './hooks/useCanvasHistory.ts';
import { patchNodeDataById } from './hooks/useNodeData.ts';
import { CanvasEdgesProvider } from './components/base/canvas/CanvasEdgesContext.tsx';
import { useCanvasShortcuts } from './hooks/useCanvasShortcuts.ts';
import {
  paletteCategories,
  getNodesByCategory,
  defaultNodeData,
  getPaletteNode,
  buildNodeTypeComponents,
} from './components/base/canvas/NodePalette.ts';
import LodProvider, { useLod } from './components/base/canvas/lod.tsx';
import ToastContainer from './components/base/ui/ToastContainer.tsx';
import ConfirmContainer from './components/base/ui/ConfirmContainer.tsx';
import SettingsFrame from './components/base/panels/SettingsFrame.tsx';
import AccountsSettings from './components/base/panels/sections/AccountsSettings.tsx';
import TopNav from './components/base/panels/TopNav.tsx';
import { showToast } from './components/base/core/toastStore.ts';
import { askConfirm } from './components/base/core/confirmStore.ts';
import { setSetting, useAppSettings } from './components/base/store/appSettings.ts';
import { setAgentKey } from './components/agent/index.ts';
import { uploadConfig, downloadConfig } from './components/base/store/cloudSync.ts';
import { useLocalToolStatus } from './hooks/useLocalToolStatus.ts';
import { useUpstreamAutoTrigger } from './components/base/canvas/upstreamLink.ts';
import LocalToolConnectModal from './components/base/panels/LocalToolConnectModal.tsx';
import EmptyCanvasGuide from './components/base/panels/EmptyCanvasGuide.tsx';
import { initTasks } from './components/base/store/taskStore.ts';
import { initTaskRecovery } from './components/base/api/index.ts';
import {
  createGroupFromNodes,
  ungroupNodes,
  deleteNodesWithCascade,
  duplicateSelectedWithEdges,
} from './components/base/canvas/groupNodes.ts';
import { externalizeInlineData } from './components/base/utils/externalizeInline.ts';
import { saveInlineToLocal } from './components/base/api/index.ts';
import { generateId } from './components/base/core/idGen.ts';
import { resolveDragGrouping } from './components/base/canvas/groupNodes.ts';
import { buildNodesFromClipboard } from './components/base/utils/clipboard.ts';
import { applyNodeTypeDefaults } from './components/base/canvas/nodeDefaults.ts';
import { injectNodePrefs } from './components/base/canvas/nodePrefs.ts';
import { useCanvasSync } from './hooks/useCanvasSync.ts';
import { parseShotHandle } from './components/base/core/contracts.ts';
import { prefetchHeavyNode } from './components/base/canvas/lazyNode.tsx';

/* ======================================================================
 * 【区 1】常量与配置区
 * nodeTypes / edgeTypes / 初始画布内容 / 画布参数
 * ====================================================================== */

// 节点类型注册表：由 NodePalette 单源派生（type→组件），不再手写平行表。
// 重依赖节点（3D 引擎 / 视频处理）已由 palette 以 lazyNode 登记（动态 import，按需下载 chunk），
// 故此处**不得**再静态 import Director3DNode —— 静态 import 会让 vendor-3d(1.06MB) 进首屏。
// 新增常规节点只需改 palette 一处；仅新增「连线占位」类节点才在此补例外。
const nodeTypes = {
  ...buildNodeTypeComponents(),
  ghostTarget: GhostTargetNode,
};

// 边类型注册表
const edgeTypes = {
  default: CustomEdge,
};

// React Flow 错误回调（覆盖库内置的 devWarn，仅 dev 生效）。
// 只静音 002：本文件已把 nodeTypes/edgeTypes 提到模块级常量，正常渲染下引用永不变化，
// 唯一触发源是 Vite HMR 重新执行本模块（改节点文件 → 冒泡到 App.jsx）时重建了注册表对象，
// 属 dev-only 误报，生产构建走不到该分支（库内 `process.env.NODE_ENV === 'development'` 分支）。
// 其余错误码是真问题（003 节点类型未注册 / 004 连线端点不存在 / 010 011 012 013 …），必须原样输出。
const RF_SILENCED_ERROR_CODES = new Set(['002']);

function handleReactFlowError(code, message) {
  if (RF_SILENCED_ERROR_CODES.has(String(code))) return;
  logger.warn('react-flow', `code-${code}`, message);
}

// ═══ P0-C（106 画布重渲放大器根治）常量提取：消除每帧多余的 store.setState ═══
// 背景：StoreUpdater（react/index.mjs）的 effect deps 含 fitViewOptions / deleteKeyCode。
// 内联字面量会让「App 每次渲染 → effect 重跑 → 多一次 store.setState → 全画布 selector 重跑一轮」。
// 提成模块常量后引用永远稳定，effect 只在真变化时触发（零行为改动，值完全不变）。
// C1：fitViewOptions 只在初始化 fitView 时读一次（fitView={initialFitView}），提常量无副作用。
const FIT_VIEW_OPTIONS = { padding: 0.2, maxZoom: 1, minZoom: 0.05 };
// C2：deleteKeyCode 内联数组会破坏 memo(FlowRenderer)（react/index.mjs:2117），提常量恢复命中率。
const DELETE_KEY_CODE = ['Backspace', 'Delete'];

// ═══ P0-C C3：缩放百分比叶子组件（把 App 重渲移出 rAF 回调）═══
// 原实现：onViewportChange → viewportRaf（rAF 回调内 setZoomPercent）→ App 全量 setState →
// App 重渲（ReactFlow + 全部节点）→ 耗时记在 rAF handler 上 → [Violation] 81ms。
// 现在 zoom% 自订阅 ReactFlow store 的 transform（原始 number，Object.is 安全）：
// 缩放时只有本叶子重渲自己，App / CanvasToolbar 完全不参与。App 不再持有 zoomPercent state。
const ZoomPercent = React.memo(function ZoomPercent() {
  const pct = useStore((s) => Math.round((s.transform?.[2] ?? 1) * 100));
  return <>{pct}%</>;
});

function Canvas() {
  /* ====================================================================
   * 【区 2】状态区
   * nodes / edges + ref 同步（供能力区取最新快照，避免闭包旧值）
   * ==================================================================== */
  // 项目系统（对齐官方 Vr.jsx）：画布状态按当前项目初始化/持久化。
  // 对齐官方：初始画布为空（官方 H_.jsx 空画布时显示「右键自由生成你的想象」引导）。
  // 画布快照走 localTool KV（异步）：挂载后从 KV 读当前项目快照，有值（含空画布）则覆盖；
  // 无快照（首次）保持空画布 → 触发 EmptyCanvasGuide 空状态引导（完整复刻官方）。
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // P2-G 拓扑触发安全网：上游完成可选自动触发直接下游（AUTO_TRIGGER_DOWNSTREAM 默认关）
  useUpstreamAutoTrigger();

  // 响应式订阅当前项目 id（projectStore，useSyncExternalStore）。
  // 修复画布「加载/保存 key 错位」：initProjects() 异步从后端覆盖 currentProjectId
  // （后端 lastOpened=proj_mssij9sn_b04a1，而本地 localStorage 可能仍是 default），
  // 若画布加载 effect 只用挂载时的旧 id，就会读到错项目快照，而保存又写到新 id → 刷新丢节点。
  // 订阅 currentProjectId 后，initProjects 覆盖一完成，加载 effect 即重跑并加载正确项目。
  const activeProjectId = useCurrentProjectId();

  // 异步加载当前项目画布快照（KV）：依赖 activeProjectId，跟随「当前项目」变化而重载。
  const [canvasLoaded, setCanvasLoaded] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    const projectId = getCurrentProject().id;
    loadCanvasState(projectId)
      .then((saved) => {
        if (cancelled) return;
        setCanvasLoaded(true);
        if (saved && saved.nodes) {
          // P2-4 撤销/重做一致性：加载画布快照前清空 history 栈。否则走 project:import /
          // initProjects / 外部 activeProjectId 重载路径时，旧项目的整图快照残留在栈内，
          // 首次 Ctrl+Z 会用旧项目整图污染当前画布。
          history.clear?.();
          // 兜底：历史快照里各节点类型可能缺 width/style/className/data.name 等结构字段
          // （如早期「右键新建 group」未补 style/className），加载时统一补默认，与新建路径保持一致。
          const rawNodes = saved.nodes.map((n) => applyNodeTypeDefaults(n));
          // 兜底：折叠/展开 group 的子节点 hidden 必须与父 group 的 collapsed 状态对齐，
          // 避免存量快照里「子节点残留 hidden:true 但父已展开」或「父折叠但子却可见」导致
          // 子节点永久隐藏/误显（visibleNodes 只会在折叠时加 hidden，不会在展开时清除 hidden）。
          const collapsedById = new Set(
            rawNodes
              .filter((n) => n.type === 'group' && (n.data as Record<string, unknown>)?.collapsed)
              .map((n) => n.id),
          );
          const loadedNodes = rawNodes.map((n) =>
            n.parentId && collapsedById.has(n.parentId)
              ? { ...n, hidden: true }
              : n.parentId && collapsedById.size
                ? { ...n, hidden: false }
                : n,
          );
          setNodes(loadedNodes);
          // 预取重依赖节点 chunk：画布里若含 3D/视频处理节点，立即预热（不阻塞渲染），
          // 让节点真正渲染时 chunk 已在模块缓存里，骨架屏一闪而过甚至不出现。
          for (const n of loadedNodes)
            prefetchHeavyNode(n.type as Parameters<typeof prefetchHeavyNode>[0]);
          // 兜底：历史快照里可能有旧 onConnect 建的「无 id」边 → 补唯一 id，
          // 否则 EdgeRenderer 用 undefined 作 key 触发重复 key 警告。
          // 同时修正「连到剧本盒子却缺 targetHandle」的历史坏边：scriptBoxNode 的输入口
          // 固定为 handleId='in'（showHandles={false} 无默认口），旧边 targetHandle 是
          // null/undefined 会触发 React Flow 的 "Couldn't create edge for target handle id: null"。
          // 这里统一把 target 是 scriptBoxNode 的边 targetHandle 补成 'in'，让存量边立即生效。
          const targetIsScriptBox = new Set(
            loadedNodes.filter((n) => n.type === 'scriptBoxNode').map((n) => n.id),
          );
          const loadedEdges = (saved.edges || []).map((e, i) => ({
            ...e,
            id: e.id || generateId('loaded-edge'),
            targetHandle:
              targetIsScriptBox.has(e.target) && !e.targetHandle ? 'in' : e.targetHandle,
          }));
          setEdges(loadedEdges);
          // P20 视窗状态恢复：快照里存了视窗（缩放/平移）则恢复，回到上次视角；
          // 无视窗（旧快照/首次）不干预，保留 ReactFlow 默认 fitView 适配全图。
          if (saved.viewport && Number.isFinite(saved.viewport.zoom)) {
            // 快照带视窗 → 关掉初始 fitView，避免覆盖下面恢复的精准位置（P20 竞态修复）
            setInitialFitView(false);
            setViewport(
              { x: saved.viewport.x, y: saved.viewport.y, zoom: saved.viewport.zoom },
              { duration: 0 },
            );
          }
        }
        // 无 saved（首次）：保留演示画布
      })
      .catch((e) => {
        // 项目画布加载失败：兜底仍标记 loaded（避免白屏卡死），但必须可查+可见
        logger.warn('App', '项目画布加载失败，回退演示画布', {
          projectId: activeProjectId,
          error: e?.message || String(e),
        });
        showToast('画布加载失败，已回退到默认画布', { type: 'warning' });
        setCanvasLoaded(true);
      });
    return () => {
      cancelled = true;
    };
    // 依赖 activeProjectId：项目切换/initProjects 覆盖时重新加载对应项目画布
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  /* ====================================================================
   * 多窗口画布同步检测（复刻官方 H_.jsx:480-492 + 870-880）——收拢到 useCanvasSync hook。
   *  - 每窗口唯一 tabId；BroadcastChannel('yimao_canvas_sync') 监听：收到「其他窗口」
   *    保存的同一项目 CANVAS_SAVED → 置 canvasConflict（App 显示红色警告条）。
   *
   * ═══ 官方其他 BroadcastChannel/mutiwindow 事件，我们为什么不做 ═══
   * 1) mutiwindow-task-completed / mutiwindow-rerun-task：
   *    已在官方 H_.jsx 核实：它们其实是【窗口内】CustomEvent（window.addEventListener /
   *    dispatchEvent），并非跨窗口 BroadcastChannel；且全项目【只有监听、从未 dispatch】，
   *    属于预留钩子/死代码，当前业务流程根本不触发 → 无脑复刻没有意义。
   *    任务完成本就走 taskStore + /api/tasks 轮询刷新，结果落盘即更新，不依赖该事件。
   * 2) mutiwindow-open-schedule-settings / open-builtin-settings：
   *    这是「模型调度 / 内置模型详情」两个独立功能面板的窗口内事件，
   *    属功能缺失而非窗口机制，应单独评估开发，不并入本多窗口模块。
   * ==================================================================== */
  // 多窗口同步：返回 canvasConflict（冲突警告态）+ tabIdRef（persistCanvas 广播用）。
  // 「切换项目后重置冲突」已在 useCanvasSync 内部处理（getProjectId 变化时自动置 false）。
  const { canvasConflict, tabIdRef } = useCanvasSync(() => getCurrentProject()?.id);

  // 视窗中心 → flow 坐标（Q/W/E 快速添加节点用）；适配用 fitView
  // P20 视窗状态持久化：getViewport 读取当前视窗、setViewport 恢复（刷新/切项目回到上次视角）。
  const { screenToFlowPosition, fitView, getViewport, setViewport, getNodes, getEdges } =
    useReactFlow();
  // 始终指向最新 viewport（onViewportChange 更新），persistCanvas 保存时无需实时 useReactFlow 查询
  const viewportRef = React.useRef(null);
  // 视窗拖拽/缩放结束后 600ms 防抖保存（P20），与 autoSave 节奏一致，避免高频移动反复写 KV
  const viewportSaveTimer = React.useRef(null);

  // 应用设置单一订阅（读写唯一入口 appSettings）：agentOpen/minimapOn/performanceMode/pinnedTools 从此快照解构。
  // 默认值/类型由 settingRegistry.ts 单一真源派生；写统一走 setSetting（内存+持久化+通知），不再用 useState+useEffect 镜像回写。
  const { agentOpen, minimapOn, performanceMode, pinnedTools } = useAppSettings();

  // 视图切换：canvas（画布）/ accounts（多开整页，复刻官方 V='accounts'）/ settings（独立设置框架：侧栏 + 舞台）
  const [view, setView] = React.useState<'canvas' | 'accounts' | 'settings'>('canvas');

  // 小地图开关（复刻 H_.jsx:474 un/dn，默认关——用户要求默认不显示，点工具栏 Map 图标再开）。
  // 仅当开启且节点数 <100 时显示 MiniMap（官方 De.length<100）。持久化到 app_settings。值由 useAppSettings 订阅提供（见上）。

  // P20 视窗恢复竞态修复：加载时若快照带视窗，则初始不 fitView（否则 <ReactFlow fitView>
  // 会在 setNodes 后下一帧自动 fitView，把你恢复的 setViewport 位置覆盖成全图适配的固定位置）。
  // 默认 true（首次/旧快照无 viewport 时走 fitView 全图）；有视窗快照时置 false，精确恢复上次视角。
  const [initialFitView, setInitialFitView] = React.useState(true);

  // 缩放性能模式开关（复刻 H_.jsx:79 ge，官方默认 true：性能模式默认开启）。
  // 从 app_settings 读入（对齐官方 Vr.jsx ei 从 app_settings 读），持久化刷新不丢。值由 useAppSettings 订阅提供（见上）。

  // ── localTool 连接检测 + 全屏提醒（完整复刻官方 Vr.jsx L35/L95-106/L3274-3280）──
  const { status: localTool, checkConnection } = useLocalToolStatus();
  // 全屏提醒开关（对齐官方 rt）与「用户已关闭」标记（对齐官方 st，关闭后不再自动弹，直到重连）
  const [connectWarn, setConnectWarn] = React.useState(false);
  const [warnDismissed, setWarnDismissed] = React.useState(false);
  // 官方 3s 延迟后判定是否弹提醒：未连接且用户未主动关闭 → 弹；已连接 → 关
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (!localTool.isConnected && !warnDismissed) {
        setConnectWarn(true);
      } else if (localTool.isConnected) {
        setConnectWarn(false);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [localTool.isConnected, warnDismissed]);

  // 整理后「是否保留」快照（复刻 H_.jsx:134 tt/nt，null = 无弹窗）。
  // 存「排列前」的 nodes/edges 快照，「还原」= 整体写回（见 revertArrange）。
  const [arrangeSnapshot, setArrangeSnapshot] = React.useState<{
    nodes: Node[];
    edges: Edge[];
  } | null>(null);

  // 自动排版（复刻 H_.jsx:10985 Ui / Ctrl+L）。本 hook 只做纯布局计算，快照/历史/确认弹窗由
  // arrangeCanvas 在此统一编排（见能力区）。
  const { arrange } = useArrangeCanvas();

  // 当前缩放百分比：已下沉为 ZoomPercent 叶子组件自订阅 store（P0-C C3），App 不再持有 state。
  // 接真系统：若需在缩小到某级做额外事（如隐藏 toolbar 部分按钮），可直接读 lodLevel state（见下）。
  // onViewportChange 保留只为同步 viewportRef（持久化视窗位置用，persistCanvas 读它），
  // 不再驱动任何 setState → 缩放时 App 不重渲染，rAF 回调不再承担全量重渲。
  const onViewportChange = React.useCallback((v) => {
    viewportRef.current = v || null;
  }, []);

  // P0-C C3：zoom% 叶子组件插槽。useMemo 固定元素引用 → CanvasToolbar 的 memo 不被每次 App 重渲打破
  // （叶子自身订阅 store，缩放时只有它重渲，CanvasToolbar/App 不参与）。
  const zoomPercentSlot = React.useMemo(() => <ZoomPercent />, []);

  // P0-C 收尾（docs/106）：CanvasToolbar 三个回调提 useCallback，让 memo(CanvasToolbar) 在
  // 「App 因拖拽等其它原因每帧重渲」时命中 → 拖拽期间工具栏不再跟着每帧重渲。
  // 依赖都是稳定源：setSetting 是模块级函数、fitView 是 useReactFlow 的 store action、minimapOn/performanceMode 来自 useAppSettings。
  const handleToggleMinimap = React.useCallback(
    () => setSetting('minimapOn', !minimapOn),
    [minimapOn],
  );
  const handleFitView = React.useCallback(
    () => fitView({ padding: 0.2, duration: 800 }),
    [fitView],
  );
  const handleTogglePerformance = React.useCallback(
    () => setSetting('performanceMode', !performanceMode),
    [performanceMode],
  );

  // 始终指向最新 nodes/edges（撤销/重做取快照用）
  const nodesRef = React.useRef(nodes);
  const edgesRef = React.useRef(edges);
  React.useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  React.useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // 当前选中的「带图节点」列表（供 AgentPanel 引用：用户选中带图节点 → 输入框出现缩略图）。
  // 只存 id/type/label + 主图 URL（getNodeImageUrl 提取），不存整个 node（避免状态过大）。
  // 在 onNodesChangeForEdges 的 select 变化里同步更新。
  const [selectedImageNodes, setSelectedImageNodes] = React.useState([]);

  // 历史栈（基座 useCanvasHistory）：record 需显式传最新快照，避免异步 setState 取到旧值
  const history = useCanvasHistory(
    () => ({ nodes: nodesRef.current, edges: edgesRef.current }),
    ({ nodes: ns, edges: es }) => {
      setNodes(ns);
      setEdges(es);
    },
  );

  // 保存画布并广播到其他窗口（复刻官方 H_.jsx:870-880：保存后 postMessage CANVAS_SAVED）
  const persistCanvas = React.useCallback((projectId) => {
    // P20：顺带把视窗状态（缩放/平移）存进快照，刷新/切项目后回到上次视角
    saveCanvasState(projectId, nodesRef.current, edgesRef.current, viewportRef.current).catch((e) =>
      logger.warn('canvas', 'save-fail', { projectId, error: e?.message }),
    );
    try {
      const channel = new BroadcastChannel('yimao_canvas_sync');
      channel.postMessage({ type: 'CANVAS_SAVED', projectId, tabId: tabIdRef.current });
      channel.close();
    } catch (err) {
      logger.warn('Canvas', '广播画布同步失败', err?.message);
    }
  }, []);

  // 自动保存（防抖）：节点/连线变化后延迟写入画布快照（KV），避免「新建节点后直接刷新丢失」。
  // 之前只有切换/新建项目时保存，画布变更无落盘 → 刷新即丢。这里用 600ms 防抖合并频繁变更，
  // canvasLoaded 跳过「首次从 KV 读回」那一次，避免把读回内容当用户改动重复保存并广播冲突。
  const autoSaveTimer = React.useRef(null);
  React.useEffect(() => {
    if (!canvasLoaded) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      persistCanvas(getCurrentProject().id);
    }, 600);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [nodes, edges, canvasLoaded, persistCanvas]);

  // P20 视窗拖拽/缩放结束 → 保存画布（顺带持久化视窗状态）。
  // 用 useCallback + canvasLoaded 守卫：初始化 fitView 也会触发 onMoveEnd，
  // 但此时 canvasLoaded 可能未置 true（首次加载中）→ 不存，避免把适配中的视窗误写回。
  const handleViewportMoveEnd = React.useCallback(() => {
    if (!canvasLoaded) return;
    if (!viewportRef.current) return; // 尚无视窗信息（未发生实际移动）
    // 与 autoSave 一致：600ms 防抖合并高频连续移动，最终态落一次盘
    if (viewportSaveTimer.current) clearTimeout(viewportSaveTimer.current);
    viewportSaveTimer.current = setTimeout(() => {
      persistCanvas(getCurrentProject().id);
    }, 600);
  }, [canvasLoaded, persistCanvas]);

  // AI 会话按项目隔离：project 作为最顶层，每个项目一套 AI 会话（对话/绘画）。
  // agentKey = canvas-assistant-<projectId>，conversationStore 据此隔离存储；
  // 新建项目 = 新 projectId = 新 agentKey → 该项目的绘画/会话全新。
  const agentKeyForProject = useCallback(
    (projectId) => `canvas-assistant-${projectId || 'default'}`,
    [],
  );
  // 切换项目时同步 AI 会话隔离键（conversationStore 内部切换 + 通知订阅者重载）
  const syncAgentKey = useCallback(
    (projectId) => {
      setAgentKey(agentKeyForProject(projectId));
    },
    [agentKeyForProject],
  );

  // 挂载 / 当前项目变化时，同步 AI 会话隔离键（agentKey）。initProjects 异步覆盖项目后，
  // activeProjectId 变化也会触发这里，确保 AI 会话始终跟随当前项目。
  React.useEffect(() => {
    syncAgentKey(activeProjectId);
  }, [activeProjectId, syncAgentKey]);

  // 切换项目：保存当前画布快照（KV）→ 切换 → 目标项目快照由「加载 effect（依赖 activeProjectId）」统一重载 → 重置历史（对齐官方 Vr.jsx）。
  // 不再手动 loadCanvasState：switchProject 更新 currentProjectId 后，加载 effect 会自动加载目标项目，避免双重加载竞态。
  const handleSwitchProject = useCallback(
    (targetId) => {
      persistCanvas(getCurrentProject().id);
      const target = switchProject(targetId);
      syncAgentKey(target?.id || targetId);
      setNodes([]);
      setEdges([]);
      history.clear?.();
      previewUrls.clear(); // 项目切换：清空所有本地预览 URL（P2-5），避免跨项目泄漏
      logger.info('项目', 'switch', { targetId });
    },
    [setNodes, setEdges, history, persistCanvas, syncAgentKey],
  );

  // 新建项目：先用【旧项目 id】保存旧画布（prevProjectId 由 ProjectSelector 传入），再清空画布。
  // 注意不能再用 getCurrentProject().id：createProject 已把 currentProjectId 切到新项目，
  // 若此时 persistCanvas(新id) 会把旧节点误存进新项目 key（bug：新项目=旧内容）。
  const handleCreateProject = useCallback(
    (proj, prevProjectId) => {
      if (prevProjectId) persistCanvas(prevProjectId);
      syncAgentKey(proj?.id); // 新项目 → 新 agentKey → 该项目 AI 会话全新
      setNodes([]);
      setEdges([]);
      history.clear?.();
      previewUrls.clear(); // 新建项目：清空所有本地预览 URL（P2-5）
      logger.info('项目', 'create', { name: getCurrentProject().name });
    },
    [setNodes, setEdges, history, persistCanvas, syncAgentKey],
  );

  // 【推送到云端】收集本地全量配置/用户数据 → 云端更新时先问用户 → CloudSyncEngine 推送（不含画布）。
  // 确认统一走 confirmStore（全局唯一确认入口，弹窗由根节点的 ConfirmContainer 渲染）：
  // 用户取消时 uploadConfig 返回 cancelled，不发起 push，云端保持原样。
  const handlePushToCloud = useCallback(async () => {
    return uploadConfig((msg) => showToast(msg, { type: 'info' }), {
      onConfirm: (copy) => askConfirm(copy),
    });
  }, []);

  // 【从云端拉取】CloudSyncEngine.pull → 有本地项会被覆盖时先列清单问用户 → 覆盖恢复配置/用户数据，
  // 延迟刷新让各 store 重新加载生效。
  const handlePullFromCloud = useCallback(async () => {
    const r = await downloadConfig((msg) => showToast(msg, { type: 'info' }), {
      onConfirm: (copy) => askConfirm(copy),
    });
    if (r.ok) {
      setTimeout(() => window.location.reload(), 1200);
    }
    return r;
  }, []);

  // 完整工作流备份导入导出 / 素材 url 改写同步 / 持久化失败上报
  // → 已收拢到 useCanvasEventSubscriptions.ts（本项目"抽独立事件订阅"收口，见该文件头）。
  useProjectBackupIO();
  useAssetUrlRewrite(getNodes, setNodes);

  // 右键菜单状态（基座 useContextMenu）
  const menu = useContextMenu();
  // 统一新建节点落点（公共 base）：posAtMenu 右键位置 / posAtCenter 视图中央
  const { posAtMenu, posAtCenter } = useNodePosition();

  // 「固定到右键菜单第一层」的节点集合（复刻官方 H_.jsx pt，默认固定 3 个常用，
  // 持久化到 app_settings.pinnedTools，刷新不丢）。固定项在小工具子菜单里有图钉开关，
  // 固定的节点直接渲染在右键菜单第一层，不用每次钻子菜单。
  const togglePinTool = useCallback(
    (type: string) => {
      const next = pinnedTools.includes(type)
        ? pinnedTools.filter((t) => t !== type)
        : [...pinnedTools, type];
      setSetting('pinnedTools', next);
    },
    [pinnedTools],
  );

  // 后端化初始化：任务中心从 /api/tasks 加载历史任务；项目系统从 /api/projects 加载项目（对齐官方）
  React.useEffect(() => {
    initTasks();
    initProjects();
    // 【取舍】启动异步任务恢复轮询（pollTask.js）：对 running 的任务，
    // 刷新后统一靠 GET /api/generate/:id attach 回结果、补回任务记录。
    // 文本/生图 sync 同步无 taskId，不在此轮询范围（刷新断即断，官方同此）。
    // 延迟启动：等 initTasks() 从后端加载完历史任务，首轮扫描才有候选。
    const t = setTimeout(() => initTaskRecovery(), 500);
    return () => clearTimeout(t);
  }, []);

  // 持久化失败统一上报（persist:failed 节流/透传）→ usePersistFailureToast（收口同上）
  usePersistFailureToast();

  /* ====================================================================
   * 【区 3】能力区
   * 画布操作：addNode / deleteNode / selectAll / duplicateSelected
   * ==================================================================== */

  // 各节点类型「结构默认」单源表 + 补齐函数已收拢到 nodeDefaults.js（见 import）。
  // 注意：applyNodeTypeDefaults 为模块级纯函数，引用稳定，addNode/加载 effect 直接复用，
  // 与快照加载还原路径共用同一单源，避免「新建/右键」与「历史还原」字段不一致。

  // 新增节点（复刻源码 di(type, position, data, connection)）
  // connection?: { source, sourceHandle, dropPosition } —— 从端口拖出到空白时，
  // 在 dropPosition 建节点并自动创建 source→新节点 的边；scriptBox 的 shot- 端口预填宽高比/时长。
  const addNode = useCallback(
    (
      type: string,
      position: { x: number; y: number },
      data: Record<string, unknown> = {},
      connection?: {
        source: string;
        sourceHandle: string | null;
        dropPosition: { x: number; y: number };
      },
    ) => {
      const id = generateId(type);
      const nodeData: Record<string, unknown> = { label: '', ...data };

      // scriptBoxNode 的 `shot-${id}` 端口 → promptNode/discountVideoNode 时预填（复刻 di:8667-8687）
      // handle 名解析走 contracts.parseShotHandle，与写侧 shotHandleId 成对（前缀唯一事实来源）。
      if (connection) {
        const src = nodesRef.current.find((n) => n.id === connection.source);
        const shotId = parseShotHandle(connection.sourceHandle);
        const shot =
          shotId && src?.type === 'scriptBoxNode'
            ? (src.data?.shots || []).find((s) => s.id === shotId)
            : null;
        if (shot) {
          const ar = String(src.data?.aspectRatio || '16:9');
          const o = ar === 'custom' ? String(src.data?.customAspectRatio || '16:9') : ar;
          if (type === 'promptNode') {
            nodeData.aspectRatio = o === '4:4' ? '1:1' : o;
          } else if (type === 'discountVideoNode') {
            nodeData.size = o === '4:4' ? '1:1' : o;
            nodeData.selectedSeconds = String(
              Math.max(1, Number.parseInt(shot.duration || '5', 10) || 5),
            );
            nodeData.durationFromScript = true;
          }
        }
      }

      // 【记忆只在新建注入，绝不污染存量】
      // 把节点「上次参数」记忆（localStorage）在新建那一刻填进新节点的 data，
      // 使得新建节点默认沿用上次选择（复刻官方「记住上次」体验）。
      // 关键：仅在 data 未显式传该字段时注入（传入优先于记忆，如剧本盒子端口预填），
      // 且记忆注入发生在本入口——快照还原走 applyNodeTypeDefaults（纯函数、不碰记忆），
      // 已挂载的存量节点组件初始化也不再读记忆回退（见各节点 useState 的 ?? 常量），
      // 三处配合从根上消除「记忆反向改写存量节点」的 bug。
      // 注入逻辑抽到 nodePrefs.injectNodePrefs（纯函数，映射表集中、可测）。
      injectNodePrefs(type, nodeData);

      const newNode = { id, type, position: { ...position }, data: nodeData };
      // 复用 nodeDefaults.js 单源表，与「快照加载还原」保持一致（见加载 effect）
      const nodeWithDefaults = applyNodeTypeDefaults(newNode);
      const nextNodes = [...nodesRef.current, nodeWithDefaults];
      // 若带 connection：自动创建 source→新节点 的边。
      // 目标端口：剧本盒子（scriptBoxNode）只暴露 handleId='in' 的输入口（showHandles={false} 关了默认口），
      // 若不带 targetHandle 会落成 null → React Flow 报 "Couldn't create edge for target handle id: null"。
      // 因此当新节点是 scriptBoxNode 时，必须把边的 targetHandle 指到 'in'。
      const nextEdges = connection
        ? [
            ...edgesRef.current,
            {
              id: `e-${connection.source}-${id}`,
              source: connection.source,
              sourceHandle: connection.sourceHandle || null,
              target: id,
              targetHandle: type === 'scriptBoxNode' ? 'in' : undefined,
              type: 'default',
              animated: false,
            },
          ]
        : edgesRef.current;
      // 【关键修复 · 批量 addNode 并发安全】不能只读 nodesRef/edgesRef 再绝对 setNodes。
      // nodesRef/edgesRef 靠 useEffect 在「每次渲染提交后」才同步，若同一 tick 内连续批量
      // addNode（拖入多图、粘贴多帧等），每次都读到同一个旧 ref → 各自产出「旧+自己」，
      // setNodes 绝对赋值后一个覆盖前一个 → 只留下最后一张（toast 却全弹）。这里建完节点
      // 就地同步 ref，让同一批次的后续 addNode 立刻看到最新列表，删除丢失更新。
      nodesRef.current = nextNodes;
      if (connection) edgesRef.current = nextEdges;
      setNodes(nextNodes);
      if (connection) setEdges(nextEdges);
      history.record({ nodes: nextNodes, edges: nextEdges });
      // 不记建节点日志：结构操作可从画布快照/历史栈还原，记了是噪音（见 logger.js 注释）
      return id;
    },
    [setNodes, setEdges, history],
  );

  // 删除节点及其相连边 + 级联删除其子孙（R3：删 group 不留孤儿子节点）
  const deleteNode = useCallback(
    (id) => {
      const { nodes: nextNodes, edges: nextEdges } = deleteNodesWithCascade(
        nodesRef.current,
        edgesRef.current,
        id,
      );
      setNodes(nextNodes);
      setEdges(nextEdges);
      history.record({ nodes: nextNodes, edges: nextEdges });
      // 不记删节点日志（同建节点）
    },
    [setNodes, setEdges, history],
  );

  // 全选（复刻 H_.jsx:11493-11513）
  const selectAll = useCallback(() => {
    setNodes((ns) => ns.map((n) => ({ ...n, selected: true })));
    setEdges((eds) => eds.map((e) => ({ ...e, selected: true })));
  }, [setNodes, setEdges]);

  // 克隆当前选中的节点（复刻 Ctrl+D）。R3：用统一子图克隆，保留组关系 + 连线（不再丢边/空壳）
  const duplicateSelected = useCallback(() => {
    const selectedIds = nodesRef.current.filter((n) => n.selected).map((n) => n.id);
    if (selectedIds.length === 0) return;
    const { nodes: nextNodes, edges: nextEdges } = duplicateSelectedWithEdges(
      nodesRef.current,
      edgesRef.current,
      selectedIds,
    );
    const idSet = new Set(selectedIds);
    // 复制后只取消原节点/原边的选中，保留复制出的新节点/新边为选中态
    const next = nextNodes.map((n) => (idSet.has(String(n.id)) ? { ...n, selected: false } : n));
    setNodes(next);
    setEdges(
      nextEdges.map((e) =>
        idSet.has(String(e.source)) && idSet.has(String(e.target)) ? { ...e, selected: false } : e,
      ),
    );
    history.record({ nodes: next, edges: nextEdges });
  }, [setNodes, setEdges, history]);

  // 编组选中节点（Ctrl+G；与右键菜单/Agent 共用 createGroupFromNodes）
  const groupSelected = useCallback(() => {
    const selectedIds = nodesRef.current.filter((n) => n.selected).map((n) => n.id);
    if (selectedIds.length === 0) {
      showToast('请先选中要编组的节点', { type: 'warning' });
      return;
    }
    const res = createGroupFromNodes(nodesRef.current, selectedIds);
    if (res.ok) {
      setNodes(res.nodes);
      history.record({ nodes: res.nodes, edges: edgesRef.current });
      showToast('已编组', { type: 'success' });
    } else {
      showToast(res.error || '编组失败', { type: 'warning' });
    }
  }, [setNodes, history]);

  // 取消所选 group（Ctrl+Shift+G；与右键菜单/Agent 共用 ungroupNodes）
  const ungroupSelected = useCallback(() => {
    const selected = nodesRef.current.find((n) => n.selected && n.type === 'group');
    if (!selected) return;
    const res = ungroupNodes(nodesRef.current, selected.id);
    if (res.ok) {
      setNodes(res.nodes);
      history.record({ nodes: res.nodes, edges: edgesRef.current });
    }
  }, [setNodes, history]);

  // 复制选中节点组到系统剪贴板（对齐官方 Ci，H_.jsx:9966-10024）。
  // 格式 {type:'mutiwindow-nodes', nodes, edges, originalIds}，data 去掉函数与运行时字段，
  // 粘贴时（onPaste）解析 JSON 重建节点组（含连线），与官方完全一致。
  const copySelectedNodes = useCallback(async (onlyId?: string) => {
    let t = nodesRef.current.filter((n) => n.selected);
    // 若右键的是某个 node 且不在选中集合内，则只复制该节点（对齐官方 Ci:9971）
    if (onlyId && !t.some((n) => n.id === onlyId)) {
      const single = nodesRef.current.find((n) => n.id === onlyId);
      if (single) t = [single];
    }
    if (t.length === 0) return;
    // 只复制「选中节点之间互连」的边（对齐官方 Ci:9982-9988）
    const innerEdges = edgesRef.current.filter(
      (e) => t.some((n) => n.id === e.source) && t.some((n) => n.id === e.target),
    );
    const payload = {
      type: 'mutiwindow-nodes',
      nodes: t.map((n) => {
        const data = { ...n.data };
        Object.keys(data).forEach((k) => {
          if (typeof data[k] === 'function') delete data[k];
        });
        delete data.loading;
        delete data.progress;
        delete data.errorMessage;
        delete data.imageUrlRef;
        delete data.imageUrlThumbRef;
        delete data.imageUrlUploaded;
        return { ...n, data };
      }),
      edges: innerEdges,
      originalIds: t.map((n) => n.id),
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload));
      showToast(`已复制 ${t.length} 个节点`);
    } catch {
      showToast('复制失败，请检查浏览器权限', { type: 'error' });
    }
  }, []);

  // 复制节点图片本身到剪贴板（对齐官方 Ei，H_.jsx:10044）：与「复制节点」不同，
  // 这是把图片以 image/png 写进剪贴板，可粘到微信/PS 等其它软件。复用公共 clipboard.copyImageToClipboard。
  const copyNodeImage = useCallback(async (nodeId) => {
    const node = nodesRef.current.find((n) => n.id === nodeId);
    const imgUrl = node?.data?.imageUrl || node?.data?.url;
    if (!imgUrl) {
      showToast('该节点没有图片', { type: 'warning' });
      return;
    }
    const res = await copyImageToClipboard(imgUrl);
    showToast(res.msg, { type: res.ok ? 'success' : 'error' });
  }, []);

  // 粘贴节点组（对齐官方 xi，H_.jsx:9635-9789）：解析 mutiwindow-nodes 重建节点+边，
  // 以粘贴点 pos 为中心整体落下。返回是否处理了 mutiwindow-nodes。
  // 解析+重建纯逻辑已收拢到 clipboard.buildNodesFromClipboard，这里只做编排（写回/历史/toast）。
  const pasteNodeGroup = useCallback(
    async (jsonStr, pos) => {
      const rebuilt = buildNodesFromClipboard(jsonStr, pos);
      if (!rebuilt) return false;
      const { nodes: p, edges: m, count } = rebuilt;
      const beforeNodes = nodesRef.current;
      const beforeEdges = edgesRef.current;
      // 旧节点取消选中，新节点/边并入（对齐官方 xi:9751-9766）
      const nextNodes = beforeNodes.map((x) => ({ ...x, selected: false })).concat(p);
      const nextEdges = beforeEdges.map((x) => ({ ...x, selected: false })).concat(m);
      setNodes(nextNodes);
      setEdges(nextEdges);
      history.record({ nodes: nextNodes, edges: nextEdges });
      showToast(`已粘贴 ${count} 个节点`);
      return true;
    },
    [setNodes, setEdges, history],
  );

  // 整理画布（复刻 H_.jsx:10985 Ui / Ctrl+L）：
  // 先存排列前快照 → dagre 布局写回 → 弹「是否保留整理结果」确认。
  // 整理画布（复刻 H_.jsx:10985 Ui / Ctrl+L）。
  // 编排顺序（抉择）：
  //   1. 先存「排列前快照」before → 供「还原」用（不污染全局撤销栈，见 ArrangeConfirm 注释）；
  //   2. 调 useArrangeCanvas.arrange 算新布局并写回（onArrange 走 setNodes/setEdges）；
  //   3. 写回后 fitView 适配新布局；
  //   4. 弹「是否保留」确认窗（ArrangeConfirm）；
  //   5. 把「排列后结果」入历史栈（undo 可回到排列前）。
  // 接真系统：nodesRef.current/edgesRef.current 换 useReactFlow().getNodes/getEdges() 即可，
  // 其余编排不变。
  const arrangeCanvas = useCallback(() => {
    const before = { nodes: nodesRef.current, edges: edgesRef.current };
    const result = arrange({
      nodes: nodesRef.current,
      edges: edgesRef.current,
      onArrange: ({ nodes: ns, edges: es }) => {
        setNodes(ns);
        setEdges(es);
      },
      onComplete: () => {
        setTimeout(() => {
          fitView({ padding: 0.2, duration: 800, maxZoom: 1 });
        }, 100);
      },
    });
    // 弹确认：存排列前快照，还原时写回
    setArrangeSnapshot(before);
    history.record({ nodes: result.nodes, edges: result.edges });
  }, [arrange, setNodes, setEdges, fitView, history]);

  // 还原整理：写回排列前快照 + 关闭弹窗 + fitView（复刻 H_.jsx:11996-12006）
  // 抉择：直接用快照整体 setNodes/setEdges，比逆向 dagre 更简单可靠。
  const revertArrange = useCallback(() => {
    if (!arrangeSnapshot) return;
    setNodes(arrangeSnapshot.nodes);
    setEdges(arrangeSnapshot.edges);
    setArrangeSnapshot(null);
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 800, maxZoom: 1 });
    }, 100);
  }, [arrangeSnapshot, setNodes, setEdges, fitView]);

  // 保留整理：仅关闭弹窗（复刻 H_.jsx:12008-12010），整理结果已写回、无需再动
  const keepArrange = useCallback(() => {
    setArrangeSnapshot(null);
  }, []);

  // 清理缓存（复刻官方 Ki 语义）：把画布内联 base64 资源真正转为本地 /files/ URL，而非删除。
  // 对齐官方后端 base64Externalize 的做法：
  //  1) 深度遍历节点 data，把所有 data:image/video/audio;base64 字段（含 imageBoxNode 的 images 数组、
  //     imageUrl / videoUrl / thumbnailUrl / poster 等）逐个落盘为 /files/ URL（sha1 幂等去重）；
  //  2) 落盘成功的字段用 URL 替换；失败字段保留原 base64（绝不删图，图片不丢）；
  //  3) localTool 离线时无法落盘 → 保留原图并提示，不做任何删除。
  const handleClearCache = useCallback(async () => {
    // 递归外置内联 dataURL 的纯逻辑已收拢到 externalizeInline.externalizeInlineData，
    // 这里注入真实落盘依赖 saveInlineToLocal，只做编排（遍历节点 + 计数 + 写回）。

    // 1. localTool 离线无法落盘 → 保留原图，绝不删除
    if (!localTool.isConnected) {
      showToast('本地引擎未连接，无法将内联资源转为 URL（已保留原图）', { type: 'warning' });
      return;
    }
    // 2. 逐节点深度外置内联资源
    let convertedTotal = 0;
    let failedTotal = 0;
    let changed = false;
    const next = [];
    for (const n of nodesRef.current) {
      const {
        data: newData,
        converted,
        failed,
      } = await externalizeInlineData(n.data, { save: saveInlineToLocal });
      convertedTotal += converted;
      failedTotal += failed;
      if (converted > 0 || failed > 0) {
        changed = true;
        next.push({ ...n, data: newData });
      } else {
        next.push(n);
      }
    }
    // 3. 无内联资源 → 提示并返回
    if (!changed) {
      showToast('画布中没有需要转换的内联资源', { type: 'info' });
      return;
    }
    setNodes(next);
    history.record({ nodes: next, edges: edgesRef.current });
    if (failedTotal > 0) {
      showToast(`已转换 ${convertedTotal} 个内联资源，${failedTotal} 个保留原图（转换失败）`, {
        type: 'warning',
      });
    } else {
      showToast(`已将 ${convertedTotal} 个内联资源转为本地 URL`, { type: 'success' });
    }
  }, [localTool.isConnected, setNodes, history]);

  /* ====================================================================
   * 素材拖入 / 粘贴（复刻 H_.jsx:10201-10350 onDragOver ki / onDrop Ai + handlePaste）
   * 统一收敛到 useAssetDropPaste hook：App 只挂事件，具体建节点逻辑在 hook 里。
   * ==================================================================== */
  const { onDragOver, onDrop, onPaste, createNodeFromFile } = useAssetDropPaste({
    addNode: (type, pos, data) => addNode(type, pos, data),
    screenToFlowPosition,
    onPasteNodeGroup: (json, pos) => {
      void pasteNodeGroup(json, pos);
    },
    // 节点 data 写回走 useNodeData 唯一入口（网页图后台本地化成功后替换 imageUrl）
    patchNodeData: (id, patch) => patchNodeDataById(setNodes, id, patch),
  });

  // 右键菜单「上传」隐藏文件输入（复刻官方 Re.current）：选中文件 → 复用 createNodeFromFile 建素材节点
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const handleUploadFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) createNodeFromFile(file, posAtCenter());
      e.target.value = '';
    },
    [createNodeFromFile, posAtCenter],
  );
  // 全局粘贴监听（文档级）
  useGlobalPaste(onPaste);

  /* ====================================================================
   * 【区 4】菜单配置区
   * canvas（空白）/ node（单选节点）/ selection（多选）三套右键菜单项
   * ==================================================================== */

  // 空白右键菜单（文本/图片/视频/剧本盒子 + 图钉小工具 + 上传）+ 单选 + 多选三态菜单项
  // → 已收口到 canvasContextMenu.tsx（buildCanvasMenuItems/buildNodeMenuItems/buildSelectionMenuItems / menuForState）。
  //   图钉「一级显示≠删二级固定项」等反直觉决策随迁移保留在新模块文件头，勿丢。

  // 单选菜单（复制 / 复制图片 / 取消编组 / 删除）→ buildNodeMenuItems（收口上同）

  // 从「连接」状态建下游节点：在 dropPosition 建节点 + 自动连线，并清掉 ghost（复刻官方 di + a()）
  const buildFromConnection = useCallback(
    (type, conn) => {
      if (!conn) return;
      addNode(
        type,
        { x: conn.dropPosition.x, y: conn.dropPosition.y },
        defaultNodeData(type),
        conn,
      );
      setNodes((ns) => ns.filter((n) => n.id !== 'ghost-target'));
      setEdges((es) => es.filter((e) => !e.id.startsWith('ghost-edge-')));
      menu.close();
    },
    [addNode, setNodes, setEdges, menu.close],
  );

  // 点击空白：关闭菜单并清理连接拖拽残留（反悔时不留 ghost 线，修复「拉出节点后取消，线仍在」bug）。
  // 普通右键菜单下无 ghost，filter 为空操作，安全复用。
  const handlePaneClick = useCallback(() => {
    menu.close();
    setNodes((ns) => ns.filter((n) => n.id !== 'ghost-target'));
    setEdges((es) => es.filter((e) => !e.id.startsWith('ghost-edge-')));
  }, [menu, setNodes, setEdges]);

  // 统一建节点入口（单一数据源）：
  //   - 从端口拖出到空白（state.connection 存在）→ 复用同一份 canvas 菜单项，但建节点时自动连线 + 清 ghost；
  //   - 空白处右键（无 connection）→ 普通建节点。
  const addNodeFromMenu = useCallback(
    (type) => {
      const conn = menu.state?.connection;
      if (conn) {
        buildFromConnection(type, conn);
        return;
      }
      // 右键菜单（含工具子菜单/视频抽帧）：用公共 posAtMenu 算落点（右键位置，点哪建哪）
      addNode(
        type,
        posAtMenu((menu.state ?? null) as unknown as Parameters<typeof posAtMenu>[0]),
        defaultNodeData(type),
      );
    },
    [menu.state, buildFromConnection, addNode, posAtMenu],
  );

  // 三态菜单统一入口：组装 MenuActionCtx（动作回调由 App 提供；菜单项生成 → buildCanvas*/buildNode*/buildSelection* / menuForState）
  // 动作发生在菜单项 onClick 里（渲染后触发），闭包引用安全；ctx 对象随渲染重建，与原内联实现一致。
  // applyUngroup/applyGroup/applyDeleteSelected 原内联在菜单函数内，此处上移到 App 层供 ctx 复用。
  const menuCtx: MenuActionCtx = {
    pinnedTools,
    addNodeFromMenu,
    togglePinTool,
    prefetchHeavyNode,
    uploadRef,
    nodeById: (id) => nodesRef.current.find((n) => n.id === id),
    selectedCount: () => nodesRef.current.filter((n) => n.selected).length,
    duplicateSelected: (onlyId?) => copySelectedNodes(onlyId),
    copyNodeImage: (nodeId) => copyNodeImage(nodeId),
    deleteNode: (id) => deleteNode(id),
    applyUngroup: (groupId) => {
      const res = ungroupNodes(nodesRef.current, groupId);
      if (res.ok) {
        setNodes(res.nodes);
        history.record({ nodes: res.nodes, edges: edgesRef.current });
      }
    },
    applyGroup: () => {
      const selectedIds = nodesRef.current.filter((n) => n.selected).map((n) => n.id);
      const res = createGroupFromNodes(nodesRef.current, selectedIds);
      if (res.ok) {
        setNodes(res.nodes);
        history.record({ nodes: res.nodes, edges: edgesRef.current });
      }
    },
    applyDeleteSelected: () => {
      const sel = nodesRef.current.filter((n) => n.selected).map((n) => n.id);
      // R3：多选删除也级联删选中 group 的子孙节点（防留孤儿）
      const { nodes: nextNodes, edges: nextEdges } = deleteNodesWithCascade(
        nodesRef.current,
        edgesRef.current,
        sel,
      );
      setNodes(nextNodes);
      setEdges(nextEdges);
      history.record({ nodes: nextNodes, edges: nextEdges });
    },
  };

  /* ====================================================================
   * 【区 5】事件绑定区
   * 快捷键 / 连线 / 删边监听 / 选中节点→边关联联动
   * ==================================================================== */

  // 一键折叠/展开 text/prompt/discountVideo 节点的 input 面板（Tab 键触发）。
  // 不在撤销栈里（expanded 是 UI 偏好，与节点内部 patchData 一致：只落盘不进 history）。
  const toggleInputPanels = useCallback(() => {
    const targetTypes = new Set(['textNode', 'promptNode', 'discountVideoNode']);
    const matching = nodesRef.current.filter((n) => targetTypes.has(n.type as string));
    if (matching.length === 0) return;
    // 只要有一个展开 → 全部折叠；否则全部展开（一键整理全局）
    const anyExpanded = matching.some((n) => (n.data?.expanded ?? true) === true);
    const target = !anyExpanded;
    setNodes((ns) =>
      ns.map((n) =>
        targetTypes.has(n.type as string) ? { ...n, data: { ...n.data, expanded: target } } : n,
      ),
    );
  }, [setNodes]);

  // 键盘快捷键（基座 useCanvasShortcuts）
  useCanvasShortcuts({
    onUndo: history.undo,
    onRedo: history.redo,
    onSelectAll: selectAll,
    onDuplicate: duplicateSelected,
    onArrange: arrangeCanvas,
    onGroup: groupSelected,
    onUngroup: ungroupSelected,
    onToggleInputPanels: toggleInputPanels,
    onAdd: (type) => {
      // 若处于「拖线」菜单态（复用 canvas 菜单但 state 带 connection）：建下游并自动连线
      const conn = menu.state?.connection;
      if (conn) {
        buildFromConnection(type, conn);
        return;
      }
      // 否则快速添加节点到视窗中心（复刻 Q/W/E，统一走公共 posAtCenter）
      addNode(type, posAtCenter(), defaultNodeData(type));
    },
  });

  // 连线：连到真实节点时建边（isValid 连接）
  // ⚠️ params 是 Connection 类型（只有 source/target/sourceHandle/targetHandle，无 id）。
  // 直接 { ...params } 塞进 edges 会让边【没有 id】→ EdgeRenderer 用 undefined 作 key →
  // 多条边 key 重复 → React key 警告。必须补唯一 id（对齐官方 addEdge 的 xy-edge__ 前缀）。
  const onConnect = useCallback(
    (params) => {
      const baseId = `xy-edge__${params.source}_${params.target}`;
      const dup = edgesRef.current.some((e) => e.id === baseId);
      const id = dup ? `${baseId}_${Date.now()}` : baseId;
      const nextEdges = [...edgesRef.current, { ...params, id, type: 'default', animated: false }];
      setEdges(nextEdges);
      history.record({ nodes: nodesRef.current, edges: nextEdges });
      // 不记连线日志（同建节点）
    },
    [setEdges, history],
  );

  // 从端口拖出到空白：建 ghost-target + ghost-edge + 弹「连接」菜单（复刻官方 onConnectEnd Oi:H_.jsx:10143）
  // ReactFlow 的 onConnectEnd 第二参数是 connectionState（含 isValid/fromNode/fromHandle）。
  const onConnectEnd = useCallback(
    (event, connectionState) => {
      const t = connectionState || {};
      // 仅当「连接无效（拖到空白）+ 有源节点和源端口」时弹菜单（官方判断）
      if (t.isValid || !t.fromNode || !t.fromHandle) return;
      const { clientX, clientY } = event?.changedTouches?.[0] || event || {};
      if (clientX == null) return;

      const rect = menu.containerRef.current?.getBoundingClientRect();
      const pos = screenToFlowPosition({ x: clientX, y: clientY });
      // 建 ghost-target（不可见占位节点）
      setNodes((ns) =>
        ns
          .filter((n) => n.id !== 'ghost-target')
          .concat({
            id: 'ghost-target',
            type: 'ghostTarget',
            position: pos,
            style: { opacity: 0, pointerEvents: 'none', width: 1, height: 1 },
            data: { label: '' },
            selectable: false,
            draggable: false,
          }),
      );
      // 建 ghost-edge（fromNode → ghost-target）。
      // ⚠️ id 必须唯一（用时间戳）：固定 'ghost-edge' 在连续快速触发 onConnectEnd 时
      // 可能因 setState 批处理出现两条同 id 边 → React key 重复警告（EdgeRenderer）。
      // 清理点统一按前缀 'ghost-edge-' 过滤（见下方 onConnectEnd/handlePaneClick/菜单确认）。
      setEdges((es) =>
        es
          .filter((e) => !e.id.startsWith('ghost-edge-'))
          .concat({
            id: 'ghost-edge-' + Date.now(),
            source: t.fromNode.id,
            sourceHandle: t.fromHandle.id || null,
            target: 'ghost-target',
            type: 'default',
          }),
      );
      // 弹「连接」菜单（官方 setTimeout 50ms，确保 ghost 渲染完成）
      setTimeout(() => {
        menu.openConnection(
          {
            source: t.fromNode.id,
            sourceHandle: t.fromHandle.id || null,
            dropPosition: pos,
          } as unknown as Connection,
          clientX - (rect?.left || 0),
          clientY - (rect?.top || 0),
        );
      }, 50);
    },
    [setNodes, setEdges, screenToFlowPosition, menu.openConnection],
  );

  // 删除连线（统一入口：CustomEdge 的 ✕ 按钮、连线双击删除 都走这里）
  const removeEdge = useCallback(
    (id) => {
      if (!id) return;
      const nextEdges = edgesRef.current.filter((ed) => ed.id !== id);
      setEdges(nextEdges);
      history.record({ nodes: nodesRef.current, edges: nextEdges });
    },
    [setEdges, history],
  );

  // CustomEdge 的 ✕ 按钮通过 window 事件触发（edge 组件无法直接拿 App 函数）
  useEffect(() => {
    const handler = (e) => {
      removeEdge(e.detail?.id);
    };
    window.addEventListener('yimao:remove-edge', handler);
    return () => window.removeEventListener('yimao:remove-edge', handler);
  }, [removeEdge]);

  // 双击连线删除
  const onEdgeDoubleClick = useCallback(
    (event, edge) => {
      removeEdge(edge.id);
    },
    [removeEdge],
  );

  // deleteElements 统一入口（Backspace/Delete 删节点/边、CustomEdge ✕ 删边都会触发）。
  // 旧实现只绑 onEdgesDelete：删节点时节点本身不进 undo 历史，导致按 Delete 删节点后 Ctrl+Z 无反应。
  // onDelete 一次性拿到被删的 { nodes, edges }，据此算出「删除后」完整快照并 record 一次，避免与删边重复入栈。
  const onDelete = useCallback(
    ({ nodes: dn, edges: de }) => {
      if ((!dn || !dn.length) && (!de || !de.length)) return;
      const delNodeIds = new Set((dn || []).map((n) => n.id));
      const delEdgeIds = new Set((de || []).map((e) => e.id));
      const nextNodes = nodesRef.current.filter((n) => !delNodeIds.has(n.id));
      const nextEdges = edgesRef.current.filter((e) => !delEdgeIds.has(e.id));
      history.record({ nodes: nextNodes, edges: nextEdges });
      // 不记删线/删节点日志
    },
    [history],
  );

  // 选中节点联动：与选中节点相连的边 → data.relatedToSelected = true（触发 comet + 加亮）
  // 每次节点 change 后，基于当前全部选中节点重算每条边的关联态（支持多选）
  const onNodesChangeForEdges = useCallback(
    (changes) => {
      onNodesChange(changes);

      // 聚合本次 change 造成的选中变化（select 类型 change 带 selected 字段）
      const selectionMap = {};
      changes.forEach((c) => {
        if (c.type === 'select' && c.id) {
          selectionMap[c.id] = c.selected;
        }
      });
      if (Object.keys(selectionMap).length === 0) return;

      // 基于当前 nodes 快照 + 本次 select 覆盖，算出真实选中集合，再重算每条边关联态
      setNodes((currentNodes) => {
        const selectedIds = new Set();
        currentNodes.forEach((n) => {
          const override = selectionMap[n.id];
          if (override !== undefined ? override : !!n.selected) {
            selectedIds.add(n.id);
          }
        });

        // 【选中锚点】算出当前选中的「带图节点」，传给 AgentPanel 供引用（选中图→输入框缩略图）。
        // 对齐参考项目（daxiong-canvas-plugins canvas-agent agentBuildAttachmentsFromNodes）：
        // 除 nodeId/type/label/url 外，把节点的画布坐标 position(x/y) 一并传给 AI，
        // 让 LLM 感知参考图来自画布哪个位置。
        const selImg = currentNodes
          .filter((n) => selectedIds.has(n.id))
          .map((n) => ({
            nodeId: n.id,
            nodeType: n.type,
            label: n.data?.label || n.data?.projectName || '',
            url: getNodeImageUrl(n),
            x: Number(n.position?.x) || 0,
            y: Number(n.position?.y) || 0,
          }))
          .filter((n) => n.url);
        setSelectedImageNodes(selImg);

        setEdges((eds) => {
          let changed = false;
          const next = eds.map((ed) => {
            const rel = selectedIds.has(ed.source) || selectedIds.has(ed.target);
            if (ed.data?.relatedToSelected !== rel) {
              changed = true;
              return { ...ed, data: { ...ed.data, relatedToSelected: rel } };
            }
            return ed;
          });
          return changed ? next : eds;
        });
        return currentNodes;
      });
    },
    [onNodesChange, setEdges, setNodes],
  );

  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

  // nodeTypes/edgeTypes 已是模块级常量（引用稳定），这里再包一层 useMemo 是官方推荐写法：
  // 保证任何重渲染/重挂载下引用绝对一致，不触发 002。
  // 注：稳定引用挡不住 HMR 重建模块（见 handleReactFlowError），那种情况由 onError 静音。
  const stableNodeTypes = useMemo(() => nodeTypes, []);
  const stableEdgeTypes = useMemo(() => edgeTypes, []);

  // 折叠 group 时隐藏其子节点（React Flow 官方推荐用 hidden 字段，替代自研 opacity 方案）。
  // hidden:true 让 React Flow 原生不渲染、不交互、不占布局；展开时自动恢复。
  // GroupNode.toggleCollapse 折叠时已设子节点 hidden，这里对「加载快照即折叠」的 group 兜底处理。
  const visibleNodes = useMemo(() => {
    const collapsedGroups = new Set(
      nodes.filter((n) => n.type === 'group' && n.data?.collapsed).map((n) => n.id),
    );
    if (collapsedGroups.size === 0) return nodes;
    return nodes.map((n) =>
      n.parentId && collapsedGroups.has(n.parentId) ? { ...n, hidden: true } : n,
    );
  }, [nodes]);

  // 拖拽节点结束（onNodeDragStop）：
  // 1) 拖入成组：节点落入某 group 范围内 → 设为该 group 子节点（parentId + 相对坐标）
  // 2) 拖出离组：原 group 子节点拖出其父边界 → 解除 parentId（转绝对坐标），group 保留
  // group 尺寸只由用户手动拖动调整，不根据子节点自动伸缩。
  const handleNodeDragStop = React.useCallback(
    (_evt, dragged) => {
      if (!dragged || dragged.type === 'group') return;
      // 拖入/拖出判定的纯几何计算已收拢到 groupNodes.resolveDragGrouping：
      // 返回新 nodes（有组归属变化）或 null（无组归属变化）。
      // 几何细节（absPosOf/groupSize/insideGroup/候选组面积排序）见该函数。
      const nextNodes = resolveDragGrouping(dragged, nodesRef.current);
      // group 尺寸只由用户手动拖动调整，不根据子节点自动伸缩
      if (nextNodes) setNodes(nextNodes);
      // R3：位置拖拽进撤销栈（最高频操作）。无论是否跨组，拖拽结束后 React Flow 已把
      // 新 position 写进 nodesRef.current，这里统一 record，使「移动节点/改组归属」都可 Ctrl+Z。
      // 只 record 节点位置相关快照，避免进入 suppress 竞态（TASK-013#2 由 useCanvasHistory 处理）。
      history.record({ nodes: nodesRef.current, edges: edgesRef.current });
    },
    [setNodes, history],
  );

  /* ====================================================================
   * 框选兜底：按住 Shift 在画布上拖拽框选时，若 mousedown 起点落在画布外的
   * 文本上（顶栏/侧栏等），浏览器原生选区会延续到画布外。这里在画布区域
   * 按下 Shift 的那一刻清掉已有选区，仅作用于框选交互、零渲染副作用。
   * ==================================================================== */
  const handleCanvasMouseDown = useCallback((e) => {
    if (e.shiftKey) {
      const sel = window.getSelection();
      if (sel && sel.toString().length > 0) sel.removeAllRanges();
    }
  }, []);

  /* ====================================================================
   * 【区 6】渲染区
   * ReactFlow 画布 + 覆盖层（右键菜单）
   * ==================================================================== */
  return (
    <LodProvider enablePerformanceMode={performanceMode} nodeCount={nodes.length}>
      {/* 顶层：flex 纵向布局（复刻官方 Vr.jsx L3274 flex h-screen flex-col） */}
      <div className="flex flex-col h-screen bg-canvas font-sans text-primary">
        {/* 本地引擎未连接全屏提醒（完整复刻官方 Vr.jsx L3274-3280 挂载 _cmp_Tr） */}
        <LocalToolConnectModal
          isVisible={connectWarn}
          onClose={() => {
            setConnectWarn(false);
            setWarnDismissed(true); // 对齐官方 ct(true)：用户关闭后不再自动弹，直到重连
          }}
          onRetry={checkConnection}
        />
        {/* 顶部导航栏：Logo + 画布/多开 pill tab + 项目选择器 + 右侧设置/AI 助手 */}
        <TopNav
          view={view}
          onNavigate={setView}
          onSwitchProject={handleSwitchProject}
          onCreateProject={handleCreateProject}
          onPushToCloud={handlePushToCloud}
          onPullFromCloud={handlePullFromCloud}
          agentOpen={agentOpen}
          onToggleAgent={() => {
            // 在非画布视图（设置/多开）点 AI 助手按钮：【阶段1C】AgentPanel 现已任意视图常驻挂载
            //（open 控 CSS 显隐）。点按钮统一切回画布并打开面板，让用户回到画布看到面板。画布内则正常 toggle。
            if (view !== 'canvas') {
              setSetting('agentOpen', true);
              setView('canvas');
            } else {
              setSetting('agentOpen', !agentOpen);
            }
          }}
        />

        {/* 内容区：画布为基座，多开/设置整页覆盖（官方 visible/invisible 覆盖层形态） */}
        <div
          ref={menu.containerRef}
          className="relative flex-1 min-h-0"
          onMouseDown={handleCanvasMouseDown}
        >
          {/* key=activeProjectId 对齐官方 Vr.jsx L3683 key={Z}：项目切换时强制重挂载整个画布，
            保证每个项目的画布状态完全隔离（清空旧节点 + 加载对应项目），修复「新项目加载到旧内容」 */}
          <CanvasEdgesProvider history={history}>
            <ReactFlow
              key={activeProjectId}
              nodes={visibleNodes}
              edges={edges}
              onNodesChange={onNodesChangeForEdges}
              onEdgesChange={onEdgesChange}
              onNodeDragStop={handleNodeDragStop}
              onConnect={onConnect}
              onConnectEnd={onConnectEnd}
              onEdgeDoubleClick={onEdgeDoubleClick}
              onDelete={onDelete}
              nodeTypes={stableNodeTypes}
              edgeTypes={stableEdgeTypes}
              onError={handleReactFlowError}
              connectionLineComponent={ConnectionLine}
              connectionRadius={60}
              deleteKeyCode={DELETE_KEY_CODE}
              onPaneContextMenu={menu.onPaneContextMenu}
              onNodeContextMenu={menu.onNodeContextMenu}
              onSelectionContextMenu={menu.onSelectionContextMenu}
              onSelectionEnd={menu.onSelectionEnd}
              onPaneClick={handlePaneClick}
              onDragOver={onDragOver}
              onDrop={onDrop}
              proOptions={proOptions}
              minZoom={0.05}
              maxZoom={4}
              fitView={initialFitView}
              fitViewOptions={{ padding: 0.2, maxZoom: 1, minZoom: 0.05 }}
              onViewportChange={onViewportChange}
              onMoveEnd={handleViewportMoveEnd}
              /* ===== 画布性能优化（复刻 H_.jsx:11958-11964）===== */
              /* 注意：elevateNodesOnSelect 必须保持 true ——
             选中节点需要自动置顶，否则会被数组顺序靠后的节点遮挡（用户反馈）。
             该选项仅在选中状态变化时给节点加高 z-index，无持续性能开销，
             关掉它省不了性能却会导致选中节点被挡，故保持开启。 */
              elevateNodesOnSelect
              elevateEdgesOnSelect={false}
              nodeOrigin={[0, 0]}
              onlyRenderVisibleElements={nodes.length > 20}
              /* 框选统一走 React Flow 默认的 Shift+拖拽，关闭 selectionOnDrag，
             避免与 panOnDrag 抢 mousedown 导致框选错位 */
              selectionOnDrag={false}
              panOnDrag
              className={nodes.length > 100 ? 'performance-large-canvas' : undefined}
            >
              {/* 点阵网格：gap=20 / size=1.5 / color=#333（复刻 H_.jsx:12100，点略放大更易辨识） */}
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1.5}
                color="#333"
                bgColor="#0d0c0c"
              />
              {/* 小地图（复刻 H_.jsx:12095-12098，仅当开启且节点数 <100 时显示） */}
              {/* 抉择：定位在左下角工具栏上方（bottom-16），样式令牌 #222/#333/nodeColor#444 对齐 docs/39 */}
              {minimapOn && nodes.length < 100 && (
                <div className="absolute left-4 bottom-16 z-canvas-tools flex flex-col items-start gap-2 pointer-events-none">
                  <MiniMap
                    pannable
                    zoomable
                    maskColor="#0d0c0c80"
                    nodeColor="#444"
                    className="!bg-surface-1 !m-0 !relative !bottom-0 !left-0 shadow-2xl rounded overflow-hidden border border-edge pointer-events-auto"
                  />
                </div>
              )}
              {/* 性能模式横幅（复刻 H_.jsx:11966-11971：ge 开 且 lodLevel>=2 时顶部黄条） */}
              {/* lodLevel 由 LodProvider 内部监听缩放自动算（缩放越小 level 越高）：>=2 缩到 ≤0.3，>=3 缩到 ≤0.2 */}
              <LodPerformanceBanner performanceMode={performanceMode} />
              {/* 画布在其他窗口被修改警告条（复刻官方 H_.jsx:11984-11991：Sn 时红色横幅，点击刷新页面） */}
              {canvasConflict && (
                <Panel position="top-center" className="mt-16 pointer-events-none">
                  <div
                    className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm flex items-center gap-2 pointer-events-auto cursor-pointer"
                    onClick={() => window.location.reload()}
                    title="点击刷新页面"
                  >
                    <RefreshCw size={14} className="text-red-400 animate-pulse" />
                    检测到该画布在其他窗口被修改，继续保存可能会覆盖数据，强烈建议点击此处刷新页面！
                  </div>
                </Panel>
              )}
              {/* LOD 视口缩放监听已收进 LodProvider 内部（lod.jsx）：
              enablePerformanceMode=false 时内部清空 lod class 并令 lodLevel=0，
              因此「性能模式关 → 节点不隐藏媒体、横幅不弹」天然成立（各节点用 useLod 读 lodLevel）。 */}
            </ReactFlow>
          </CanvasEdgesProvider>

          {/* 画布专属覆盖层：仅画布视图渲染（对齐官方 V 视图互斥，避免叠到设置/多开上） */}
          {view === 'canvas' && (
            <>
              {/* 画布空状态引导「右键自由生成你的想象」（完整复刻官方 H_.jsx L12622：画布加载完成且无节点时显示） */}
              {canvasLoaded && nodes.length === 0 && (
                <EmptyCanvasGuide
                  onAdd={(type) => addNode(type, posAtCenter(), defaultNodeData(type))}
                />
              )}
              {/* 左侧滑出面板：任务中心 + 素材库（fixed 覆盖层，不依赖画布容器） */}
              <LeftPanel />

              {/* 左下角工具栏（复刻 H_.jsx:12013 bottom-left） */}
              {/* 抉择：工具栏 + 确认弹窗叠在一个 absolute 容器（left-3 bottom-3），弹窗 absolute bottom-full 挂在工具栏上方 */}
              <div className="absolute left-3 bottom-3 z-canvas-tools pointer-events-auto">
                <div className="relative">
                  {/* 整理后「是否保留」确认弹窗（复刻 H_.jsx:11993） */}
                  <ArrangeConfirm
                    snapshot={arrangeSnapshot}
                    onRevert={revertArrange}
                    onKeep={keepArrange}
                  />
                  {/* 占位按钮 onRun/onClearCache 未传：接真系统时在 App 传入（见 CanvasToolbar 注释） */}
                  <CanvasToolbar
                    minimapOn={minimapOn}
                    onToggleMinimap={() => setSetting('minimapOn', !minimapOn)}
                    onArrange={arrangeCanvas}
                    onFitView={() => fitView({ padding: 0.2, duration: 800 })}
                    zoomPercentNode={zoomPercentSlot}
                    performanceMode={performanceMode}
                    onTogglePerformance={() => setSetting('performanceMode', !performanceMode)}
                    onClearCache={handleClearCache}
                    localToolConnected={localTool.isConnected}
                  />
                </div>
              </div>

              {/* 右键菜单（基座 ContextMenu，挂载于画布外层） */}
              <ContextMenu
                state={menu.state}
                items={(state) => menuForState(state, menuCtx)}
                onClose={menu.close}
                containerRef={menu.containerRef}
              />

              {/* 右键菜单「上传」隐藏文件输入（复刻官方 Re，选中文件建素材节点） */}
              <input
                ref={uploadRef}
                type="file"
                accept="image/*,video/*,audio/*,text/plain"
                style={{ display: 'none' }}
                onChange={handleUploadFile}
              />
            </>
          )}

          {/* 画布 AI 助手面板（复刻官方 _Component40）——【阶段1C】任意视图常驻挂载，open 控制 CSS 显隐
            （AgentPanel 内部已改 CSS hidden，不再条件卸载）。运行态（useAgentChat 流式/状态机）不因
            收起/切页断流（配合阶段1B 卸载不 abort）。settings/accounts 用 z-float(100) 覆盖其 z-30，
            切设置/多开页会被正确盖住不遮挡。agentKey 按项目派生 + key=projectId 强制重挂载：
            AI 会话跟随项目，项目切换/新建即切换会话。 */}
          <AgentPanel
            key={activeProjectId}
            agentKey={agentKeyForProject(activeProjectId)}
            open={agentOpen}
            onClose={() => setSetting('agentOpen', false)}
            systemPrompt={''}
            selectedImageNodes={selectedImageNodes}
          />

          {/* 多开整页：覆盖画布（复刻官方 V='accounts'，含新建表单+环境网格+⋮菜单） */}
          {view === 'accounts' && <AccountsSettings />}
          {/* 设置层：覆盖画布（官方 Vr.jsx 形态），右上角齿轮常驻可切换 */}
          {view === 'settings' && <SettingsFrame />}
        </div>
      </div>
    </LodProvider>
  );
}

// 性能模式黄条（复刻 H_.jsx:11966-11971）：性能模式开且 lodLevel>=2 时顶部黄条。
// 抽为子组件是因为 lodLevel 已收进 LodProvider 内部，需在 Provider 内用 useLod() 读，
// 而非在 Canvas 外层读已删除的 App 级 state。
function LodPerformanceBanner({ performanceMode }) {
  const { lodLevel } = useLod();
  if (!performanceMode || lodLevel < 2) return null;
  return (
    <Panel position="top-center" className="mt-4 pointer-events-none">
      <div className="bg-yellow-500/20 border border-yellow-500/50 text-yellow-200 px-4 py-2 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm flex items-center gap-2 animate-pulse">
        <Zap size={14} className="text-yellow-400" />
        {lodLevel === 3 ? '已进入全局性能模式 (图片视频已隐藏)' : '低缩放性能模式 (图片已隐藏)'}
      </div>
    </Panel>
  );
}

export default function App() {
  return (
    <>
      <ReactFlowProvider>
        <Canvas />
      </ReactFlowProvider>
      {/* 统一通知容器（顶部居中，配合 toastStore.showToast 使用） */}
      <ToastContainer />
      {/* 统一确认弹窗容器（配合 confirmStore.askConfirm 使用：云同步覆盖确认等） */}
      <ConfirmContainer />
    </>
  );
}
