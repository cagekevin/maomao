/**
 * AI 助手表格 —— 吸附在 AI 助手面板左侧的表格面板（TableWorkspacePanel）。
 *
 * 背景（2026-09-06 定稿，见 spec/TABLE-WORKSPACE-INDEPENDENT-PANEL.md §四.5）：
 * 表格拆出 AgentPanel 内部（避免挤半宽），但**不浮在画布最左**——用户裁定「表格在左、对话在右，
 * 吸附 AI 面板左缘、开合联动」（几轮讨论后定稿，勿回退成画布最左独立面板）。
 * 本组件 = 该面板的「薄壳」：只订阅共享运行态（tableWorkspaceState）+ 会话表格数据，
 * 真正的表格 UI / 编辑 / 预览卡由 AssistantTablePanel 承载（零改动复用）。
 *
 * 职责（spec §4.5.2「左侧 TableWorkspacePanel」）：
 *  - 订阅 useTableWorkspace() + conversationState（memory.assistantTable / sending）；
 *  - 把 AssistantTablePanel 的 props 接到共享态：width / previewing / onSelectRow /
 *    preview(由 raw JSON 派生 buildPreviewModel) / sending / onConfirmPreview / onCancelPreview；
 *  - onSendToCanvas = callTool('create_node')：与 useAgentChat.sendContentToCanvas 同源工具层
 *    （同一 AGENT_TOOLS 注册表），不新增第二条发送链路；
 *  - 右缘拖拽改宽 = setTableWorkspaceWidth()（吸附边界即表格宽度拖拽条）。
 *
 * 定位：由 AgentPanel 渲染（片段兄弟），锚点 = `right: agentPanelWidth`（紧贴 AI 面板左缘），
 * 开合联动：AI 面板收起时 AgentPanel 调 closeTableWorkspace() 一起收（见 AgentPanel）。
 * 本组件无独立头部（贴近旧 UI 的左栏表格），关闭入口 = AI 助手顶栏「表格」图标。
 */
import { useCallback, useMemo } from 'react';
import {
  useTableWorkspace,
  setTableWorkspaceWidth,
  setTableWorkspaceRow,
  confirmTablePreview,
  cancelTablePreview,
} from '../agent/assistantTable/tableWorkspaceState.ts';
import { useCanvasAgentTools } from '../agent/canvas/useCanvasAgentTools.ts';
import AssistantTablePanel from '../agent/assistantTable/AssistantTablePanel.tsx';
import {
  normalizeAssistantTable,
  buildPreviewModel,
} from '../agent/assistantTable/assistantTable.ts';
import { subscribe, getState } from '../agent/conversation/conversationState.ts';
import type { ConversationStoreState } from '../agent/conversation/conversationState.ts';
import { useStoreSelector, shallowEqual } from '@/hooks/useStoreSelector.ts';

export default function TableWorkspacePanel({ agentPanelWidth }: { agentPanelWidth: number }) {
  const ws = useTableWorkspace();
  const { callTool } = useCanvasAgentTools();

  // ── 会话表格数据（与 AssistantTablePanel 同款原子订阅；切对话自动跟随）──
  const rawTable = useStoreSelector<ConversationStoreState, unknown>(
    subscribe,
    getState,
    (s) => {
      const c = (s.conversations || []).find((x) => x.id === s.activeId);
      return c?.memory?.assistantTable ?? null;
    },
    shallowEqual,
  );
  const storyboard = useMemo(() => normalizeAssistantTable(rawTable), [rawTable]);
  const sending = useStoreSelector<ConversationStoreState, boolean>(
    subscribe,
    getState,
    (s) => !!s.sending,
    shallowEqual,
  );

  // 待确认预览模型：raw JSON（共享态） + 当前表 → 对比预览（整表 / 单行），确认才写回
  const preview = ws.preview
    ? buildPreviewModel(storyboard, ws.preview.json, ws.preview.rowId)
    : null;

  // 发送到画布：复用 AI 操作画布的现成工具链路（create_node → textNode），不裸写 setNodes
  const onSendToCanvas = useCallback(
    (text: string) => {
      const t = String(text ?? '').trim();
      if (!t) return;
      callTool('create_node', { type: 'textNode', text: t });
    },
    [callTool],
  );

  // 右缘拖拽改宽：更新共享态 width（内部 clamp 360~760 + 记忆 agent_split_width）。
  // 吸附在 AI 面板左缘 → 拖这条边界 = 调表格宽度（对话宽度不动），对齐旧 UI 分栏拖拽语义。
  const startWidthDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = ws.width;
      const onMove = (ev: MouseEvent) => {
        setTableWorkspaceWidth(startW + (ev.clientX - startX));
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [ws.width],
  );

  if (!ws.open) return null;
  return (
    <div className="tw-panel" style={{ width: ws.width, right: agentPanelWidth }}>
      <AssistantTablePanel
        width={ws.width}
        previewing={!!ws.preview}
        onSelectRow={setTableWorkspaceRow}
        onSendToCanvas={onSendToCanvas}
        preview={preview}
        sending={sending}
        onConfirmPreview={confirmTablePreview}
        onCancelPreview={cancelTablePreview}
      />
      {/* 右缘拖拽手柄（吸附边界 = 表格宽度条） */}
      <div className="tw-grip" onMouseDown={startWidthDrag} title="拖动调整表格宽度" />
    </div>
  );
}
