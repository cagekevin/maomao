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
  TABLE_WIDTH_RANGE,
  confirmTablePreview,
  cancelTablePreview,
} from '../assistantTable/tableWorkspaceState.ts';
// 拖拽调宽原语（唯一实现；与左侧面板 / AI 面板共用，见该 hook 文件头）
import { usePanelResize } from '@/hooks/usePanelResize';
import { useCanvasAgentTools } from '../canvas/useCanvasAgentTools.ts';
import AssistantTablePanel from '../assistantTable/AssistantTablePanel.tsx';
import { agentConversationSubscribe, getState } from '../conversation/conversationState.ts';
import type { ConversationStoreState } from '../conversation/conversationState.ts';
import { useStoreSelector, shallowEqual } from '@/hooks/useStoreSelector';
import '../assistantTable/assistant-table.css';

export default function TableWorkspacePanel({ agentPanelWidth }: { agentPanelWidth: number }) {
  const ws = useTableWorkspace();
  const { callTool } = useCanvasAgentTools();

  // ── 会话发送态（与 AssistantTablePanel 同款原子订阅；切对话自动跟随）──
  const sending = useStoreSelector<ConversationStoreState, boolean>(
    agentConversationSubscribe,
    getState,
    (s) => !!s.sending,
    shallowEqual,
  );

  // 发送到画布：复用 AI 操作画布的现成工具链路（create_node → textGenerateNode），不裸写 setNodes。
  // 【契约携带结果 · 2026-09-17 TD-16-27】原签名 `(text) => void` 且**丢弃 `callTool` 返回值**
  // ⇒ 调用方（AssistantTablePanel）无从知道成败，只能无条件报「已发送到画布」= 假成功。
  // 现返回 `{ok, error?}`，成功文案由调用方按**结果事实**给出。
  const onSendToCanvas = useCallback(
    async (text: string): Promise<{ ok: boolean; message: string }> => {
      const t = String(text ?? '').trim();
      if (!t) return { ok: false, message: '内容为空，未发送' };
      const res = (await callTool('create_node', { type: 'textGenerateNode', text: t })) as
        { ok?: boolean; error?: string } | undefined;
      // 【2026-09-17 裁定「消费者只转发」】**可展示信息由本层（生产者）给全** ——
      // 消费方（AssistantTablePanel）拿到了 `message` 直接转发即可，不得再拼 `发送失败：${error}`、
      // 也不得用 `|| '未知原因'` 补默认值（那是消费者加工 + 掩盖缺失字段）。
      return res?.ok
        ? { ok: true, message: '已发送到画布（建成文本节点）' }
        : { ok: false, message: `发送失败：${res?.error ? res.error : '未知原因'}` };
    },
    [callTool],
  );

  // 左缘拖拽改宽：手柄贴画布左缘（表格左边），往左拖 → 表格变宽（`anchor:'left'`）。
  // 拖拽生命周期与钳制走**唯一实现** `usePanelResize`（与左侧面板 / AI 面板同一份）；
  // 宽度落点仍是共享态 `setTableWorkspaceWidth`（值域取 `TABLE_WIDTH_RANGE` 单源）。
  const { handleProps: widthGripProps } = usePanelResize({
    width: ws.width,
    onChange: setTableWorkspaceWidth,
    anchor: 'left',
    min: TABLE_WIDTH_RANGE.min,
    max: TABLE_WIDTH_RANGE.max,
  });

  if (!ws.open) return null;
  return (
    <div className="tw-panel" style={{ width: ws.width, right: agentPanelWidth }}>
      <AssistantTablePanel
        width={ws.width}
        onSendToCanvas={onSendToCanvas}
        sending={sending}
        onConfirmPreview={confirmTablePreview}
        onCancelPreview={cancelTablePreview}
      />
      {/* 左缘拖拽手柄（贴画布左缘 = 表格左边，拖动调表格宽度） */}
      <div className="tw-grip" {...widthGripProps} title="拖动调整表格宽度" />
    </div>
  );
}
