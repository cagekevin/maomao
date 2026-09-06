/**
 * AI 助手表格 —— 活动会话「表格数据 + 全局风格」响应式订阅（消除 Panel 内散落订阅逻辑）。
 *
 * 背景（spec/AI-ASSISTANT-TABLE-UI-FOUNDATION.md 阶段 C）：AssistantTablePanel 原在组件内三处
 * useStoreSelector 直读 conversationStore 并各自派生 tableData/globalStyle；收口到本 hook，
 * 单一入口返回「当前活动会话的归一化表格 + 全局风格 + 会话 id」，组件不再散写订阅推导。
 *
 * 数据真相源仍是 per-conversation memory.assistantTable / memory.global_contract；
 * 归一化 normalizeAssistantTable 只在 rawTable 变化时重算（useMemo）。运行态(open/width/选中/预览)
 * 由 tableWorkspaceState 单独提供（本 hook 不碰，阶段 C 不做破坏性拆 store）。
 */
import { useMemo } from 'react';
import { subscribe, getState } from '../conversation/conversationState.ts';
import type { ConversationStoreState } from '../conversation/conversationState.ts';
import { useStoreSelector, shallowEqual } from '@/hooks/useStoreSelector.ts';
import { normalizeAssistantTable } from './assistantTable.ts';
import type { AssistantTable } from './assistantTable.ts';

export interface ActiveAssistantTable {
  activeConversationId: string;
  /** 归一化后表格（列 id/width 稳定；增删列保既有 id/width） */
  table: AssistantTable;
  /** 全局风格（memory.global_contract.unified_style_prompt，trim） */
  globalStyle: string;
}

export function useActiveAssistantTable(): ActiveAssistantTable {
  const activeConversationId = useStoreSelector<ConversationStoreState, string>(
    subscribe,
    getState,
    (s) => s.activeId || '',
    shallowEqual,
  );
  const rawTable = useStoreSelector(
    subscribe,
    getState,
    (s) => {
      const c = (s.conversations || []).find((x) => x.id === s.activeId);
      return c?.memory?.assistantTable ?? null;
    },
    shallowEqual,
  );
  const rawGc = useStoreSelector(
    subscribe,
    getState,
    (s) => {
      const c = (s.conversations || []).find((x) => x.id === s.activeId);
      return c?.memory?.global_contract ?? null;
    },
    shallowEqual,
  );
  const table = useMemo<AssistantTable>(() => normalizeAssistantTable(rawTable), [rawTable]);
  const globalStyle =
    rawGc && typeof rawGc === 'object' && 'unified_style_prompt' in rawGc
      ? String((rawGc as Record<string, unknown>).unified_style_prompt ?? '').trim()
      : '';
  return { activeConversationId, table, globalStyle };
}
