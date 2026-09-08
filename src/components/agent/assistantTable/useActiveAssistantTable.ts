/**
 * AI 助手表格 —— 活动会话「多标签页 + 当前活动 tab」响应式订阅（panel 内数据源单一入口）。
 *
 * 多标签页（spec/AI-ASSISTANT-TABLE-TABS.md）：
 *  - 真源 = memory.assistantTables（{tabs,activeTabId}）；memory.assistantTable/global_contract 只读兼容（老数据水合，不再写）。
 *  - 归一化 normalizeAssistantTabs 只在 raw（含老数据回退）变化时重算（useMemo）。
 *  - globalStyle 每 tab 独立（隔离决策）：返回「当前活动 tab」的 globalStyle，不再读 global_contract。
 *  - 返回 { activeConversationId, tabs, activeTabId, table(当前 tab 的表), globalStyle(当前 tab 的风格), activeTab }。
 * 运行态（open/width/选中/预览/游标）由 tableWorkspaceState 单独提供（本 hook 不碰）。
 */
import { useMemo } from 'react';
import { subscribe, getState } from '../conversation/conversationState.ts';
import type { ConversationStoreState } from '../conversation/conversationState.ts';
import { useStoreSelector, shallowEqual } from '@/hooks/useStoreSelector.ts';
import { normalizeAssistantTabs, getActiveTab } from './assistantTable.ts';
import type { AssistantTableTabs, TableTab, AssistantTable } from './assistantTable.ts';
import { logger } from '../../base/core/logger.ts';

export interface ActiveAssistantTable {
  activeConversationId: string;
  /** 归一化后多标签页集合（真源；面板顶层 tab 条读它渲染） */
  tabs: AssistantTableTabs;
  /** 当前活动 tab id */
  activeTabId: string;
  /** 当前活动 tab；恒存在（normalize 兜底恒 ≥1） */
  activeTab: TableTab;
  /** 当前活动 tab 的表（列 id/width 稳定；增删列保既有 id/width） */
  table: AssistantTable;
  /** 当前活动 tab 的全局风格（每 tab 独立，trim） */
  globalStyle: string;
}

export function useActiveAssistantTable(): ActiveAssistantTable {
  const activeConversationId = useStoreSelector<ConversationStoreState, string>(
    subscribe,
    getState,
    (s) => s.activeId || '',
    shallowEqual,
  );
  const rawTabs = useStoreSelector(
    subscribe,
    getState,
    (s) => {
      const c = (s.conversations || []).find((x) => x.id === s.activeId);
      if (!c) return null;
      return c?.memory?.assistantTables ?? null;
    },
    shallowEqual,
  );
  const legacy = useStoreSelector(
    subscribe,
    getState,
    (s) => {
      const c = (s.conversations || []).find((x) => x.id === s.activeId);
      if (!c) return null;
      const style =
        c.memory?.global_contract && typeof c.memory.global_contract === 'object'
          ? String(
              (c.memory.global_contract as { unified_style_prompt?: unknown })
                .unified_style_prompt ?? '',
            ).trim()
          : '';
      return { assistantTable: c.memory?.assistantTable ?? null, globalStyle: style };
    },
    shallowEqual,
  );
  const tabs = useMemo<AssistantTableTabs>(() => {
    // 【P1-D 可见性 · SSOT-7 旁证 2026-09-08】rawTabs 为 null = 真源尚未落盘，本次 read 只能靠
    // normalizeAssistantTabs 惰性造 id（读时才造 id 的惰性真源）→ 每次读都可能拿到新 id，
    // 多消费方各自归一就会造出两套 id 空间。正确做法是「会话激活时已由 conversationStore
    // materializeAssistantTabs 落成稳定基线」；若这里还告警，说明某个新入口没走激活路径，需补。
    if (rawTabs == null) {
      logger.warn('AI助手', '表格真源未落盘即被读取（将惰性造 id），请确认走会话激活路径', {
        activeConversationId,
      });
    }
    return normalizeAssistantTabs(rawTabs ?? null, {
      assistantTable: (legacy as { assistantTable?: unknown } | null)?.assistantTable ?? null,
      globalStyle: (legacy as { globalStyle?: string } | null)?.globalStyle ?? '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawTabs, legacy]);
  const activeTab = getActiveTab(tabs)!;
  const table = useMemo<AssistantTable>(
    () =>
      activeTab ? { columns: activeTab.columns, rows: activeTab.rows } : { columns: [], rows: [] },
    [activeTab],
  );
  return {
    activeConversationId,
    tabs,
    activeTabId: tabs.activeTabId,
    activeTab,
    table,
    globalStyle: activeTab ? activeTab.globalStyle : '',
  };
}
