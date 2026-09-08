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
 *  - 订阅 useTableWorkspace() + conversationState（memory.assistantTables / sending）；
 *  - 把 AssistantTablePanel 的 props 接到共享态：width / previewing / onSendToCanvas /
 *    preview(由共享态 preview.resultCols/resultRows 派生显示模型，预览=确认) /
 *    sending / onConfirmPreview / onCancelPreview；选中态由 AssistantTablePanel 直读共享态（C1）。
 *  - onSendToCanvas = callTool('create_node')：与 useAgentChat.sendContentToCanvas 同源工具层
 *    （同一 AGENT_TOOLS 注册表），不新增第二条发送链路；
 *  - 右缘拖拽改宽 = setTableWorkspaceWidth()（吸附边界即表格宽度拖拽条）。
 *
 * 定位：由 AgentPanel 渲染（片段兄弟），锚点 = `right: agentPanelWidth`（紧贴 AI 面板左缘），
 * 开合联动：AI 面板收起时 AgentPanel 调 closeTableWorkspace() 一起收（见 AgentPanel）。
 * 本组件无独立头部（贴近旧 UI 的左栏表格），关闭入口 = AI 助手顶栏「表格」图标。
 */
import { useCallback } from 'react';
import {
  useTableWorkspace,
  setTableWorkspaceWidth,
  confirmTablePreview,
  cancelTablePreview,
} from '../agent/assistantTable/tableWorkspaceState.ts';
import { useCanvasAgentTools } from '../agent/canvas/useCanvasAgentTools.ts';
import AssistantTablePanel from '../agent/assistantTable/AssistantTablePanel.tsx';
import { subscribe, getState } from '../agent/conversation/conversationState.ts';
import type { ConversationStoreState } from '../agent/conversation/conversationState.ts';
import { useStoreSelector, shallowEqual } from '@/hooks/useStoreSelector.ts';
import '../agent/assistantTable/assistant-table.css';

export default function TableWorkspacePanel({ agentPanelWidth }: { agentPanelWidth: number }) {
  const ws = useTableWorkspace();
  const { callTool } = useCanvasAgentTools();

  // ── 会话发送态（与 AssistantTablePanel 同款原子订阅；切对话自动跟随）──
  const sending = useStoreSelector<ConversationStoreState, boolean>(
    subscribe,
    getState,
    (s) => !!s.sending,
    shallowEqual,
  );

  // 发送到画布：复用 AI 操作画布的现成工具链路（create_node → textGenerateNode），不裸写 setNodes
  const onSendToCanvas = useCallback(
    (text: string) => {
      const t = String(text ?? '').trim();
      if (!t) return;
      callTool('create_node', { type: 'textGenerateNode', text: t });
    },
    [callTool],
  );

  // 左缘拖拽改宽：更新共享态 width（内部 clamp 360~1080 + 记忆 agent_split_width）。
  // 手柄贴画布左缘（表格左边）：往左拖 → 左缘左扩 → 表格变宽；往右拖 → 变窄。
  const startWidthDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = ws.width;
      const onMove = (ev: MouseEvent) => {
        setTableWorkspaceWidth(startW - (ev.clientX - startX));
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
        onSendToCanvas={onSendToCanvas}
        sending={sending}
        onConfirmPreview={confirmTablePreview}
        onCancelPreview={cancelTablePreview}
      />
      {/* 左缘拖拽手柄（贴画布左缘 = 表格左边，拖动调表格宽度） */}
      <div className="tw-grip" onMouseDown={startWidthDrag} title="拖动调整表格宽度" />
    </div>
  );
}
