/**
 * ════════════════════════════════════════════════════════════════
 * 会话隔离数据层 —— AI 编排状态（F 类，占原文件近半导出）
 * ════════════════════════════════════════════════════════════════
 *
 * 【拆分契约 · 2026-08-21】从 conversationStore.js 拆出的 F 类职能：
 * 统一风格契约 global_contract / 跨步成果 artifact / AI 撤销栈 /
 * 参考图 refImages / 执行分级 runMode。全部 per-conversation。
 * 【阶段3 · 2026-08-21】Skill 三阶段状态（pendingGenerations/awaitingConfirm）已抽至
 * conversationSkillState.js（编排轴子域化）。本文件不再包含 Skill 门禁状态。
 * 依赖单向指向 conversationState 底座，命名/导出不变，消费方无感知。
 * ════════════════════════════════════════════════════════════════
 */
import { getActiveConv, commit, getState, normalizeMemory } from './conversationState.ts';
import { normalizeAssistantTable, emptyAssistantTable } from '../assistantTable/assistantTable.ts';
import type { AssistantTable } from '../assistantTable/assistantTable.ts';
import {
  normalizeAssistantTabs,
  getActiveTab,
  getTab,
  updateTab,
  setActiveTabId,
  setTabGlobalStyle,
  setTabTable,
} from '../assistantTable/assistantTable.ts';
import type {
  AssistantTableTabs,
  TableTab,
  TableColumn,
  TableRow,
} from '../assistantTable/assistantTable.ts';
import {
  getWorkMode,
  setWorkMode,
  resolveConvRunMode,
  registerLegacyRunModeReader,
  registerRunModeSync,
} from '../runtime/runModeRegistry.ts';

/**
 * runMode（执行分级）2026-09-05 精简收敛恒 auto（direct/step-confirm 已删）：
 *  - 读：getCurrentRunMode 由 workMode 派生，恒 auto
 *  - 写：setCurrentRunMode 收敛为 setWorkMode，恒映射 auto
 * 首占钩子：legacyRunModeReader 已不再参与推导（getWorkMode 恒 auto）；
 *           runModeSync 使 setWorkMode 同步写当前会话 conv.runMode 归 auto（兼容历史持久化）。
 */
registerLegacyRunModeReader(() => String(getActiveConv()?.runMode || 'auto').toLowerCase());
registerRunModeSync((_runMode) => {
  const conv = getActiveConv();
  if (!conv) return; // 会话未就绪不写（读取侧以 workMode 为真源，不受影响）
  // 2026-09-05 精简：执行模型恒 auto，runMode 兼容字段一律归 auto
  commit({
    ...getState(),
    conversations: getState().conversations.map((c) =>
      c.id === conv.id ? { ...c, runMode: 'auto', updatedAt: Date.now() } : c,
    ),
  });
});

/** 执行分级（workMode 的派生态）：2026-09-05 精简后运行时恒 'auto'；保留 'step-confirm' 供读历史持久化数据 */
export type RunMode = 'step-confirm' | 'auto';

/** 【对齐大雄 agentGetRunMode】读当前执行分级：由 workMode 派生，恒 auto（direct/step-confirm 已删） */
export function getCurrentRunMode(): RunMode {
  return resolveConvRunMode(getWorkMode()) as RunMode;
}

/** 【对齐大雄 agentSetRunMode】写执行分级：收敛为 setWorkMode。2026-09-05 精简后恒映射 auto。 */
export function setCurrentRunMode(_mode: unknown): void {
  // 2026-09-05 精简：执行模型收敛恒 auto（direct/step-confirm 已删），任何入参一律归 'auto'
  setWorkMode('auto');
}

/* ── 统一风格契约 global_contract + 跨步成果 artifact（对齐大雄，per-conversation）── */

// 统一风格契约 / 跨步成果资产的权威形状定义在底座 conversationState（避免两处漂移），此处仅别名导出。
import type { GlobalContractShape, ArtifactShape } from './conversationState.ts';
export type GlobalContract = GlobalContractShape;

/** 读当前对话的统一风格契约（无则 null） */
export function getCurrentGlobalContract(): GlobalContract | null {
  return getActiveConv()?.memory?.global_contract || null;
}

/** 写当前对话的统一风格契约（阶段1 产出，逐字锁定每步） */
export function setCurrentGlobalContract(c: GlobalContract | null): void {
  const conv = getActiveConv();
  if (!conv) return;
  commit({
    ...getState(),
    conversations: getState().conversations.map((x) =>
      x.id === conv.id
        ? {
            ...x,
            memory: normalizeMemory({
              ...x.memory,
              global_contract: c || null,
              // 【对齐大雄 agentCaptureActiveConversation】统一风格契约写入时同步 lastSharedStyle：
              // 大雄从最后 assistant 消息的 shared_style 提炼 memory.lastSharedStyle，续轮 fresh-task 时注入。
              // 我们统一风格走 global_contract，故在此映射，保证 memory.lastSharedStyle 有承载。
              lastSharedStyle:
                c && (c.unified_style_prompt || c.visual_positioning)
                  ? String(c.unified_style_prompt || c.visual_positioning || '').trim()
                  : x.memory.lastSharedStyle,
            }),
            updatedAt: Date.now(),
          }
        : x,
    ),
  });
}

/* ── AI 助手表格工作区（per-conversation，挂会话记忆。一对话多标签页，spec/AI-ASSISTANT-TABLE-TABS.md）
   真源 = memory.assistantTables（{tabs,activeTabId}）；memory.assistantTable 只读兼容（老数据水合，不再写）。
   新建对话 = 新空表；回看旧对话 = 那张表还在。不与画布节点/其它存储耦合，随既有「按 agentKey 隔离 + 会话记忆落盘」链路走。 */

/** 读当前对话的多标签页集合（归一兜底：真源不存在则从老 assistantTable+global_contract 水合成单 tab） */
export function getCurrentAssistantTabs(): AssistantTableTabs {
  const mem = getActiveConv()?.memory ?? null;
  const rawTabs = mem?.assistantTables;
  const legacyTable = mem?.assistantTable;
  const legacyStyle =
    mem && mem.global_contract && typeof mem.global_contract === 'object'
      ? String(
          (mem.global_contract as { unified_style_prompt?: unknown }).unified_style_prompt ?? '',
        ).trim()
      : '';
  return normalizeAssistantTabs(rawTabs ?? null, {
    assistantTable: legacyTable ?? null,
    globalStyle: legacyStyle,
  });
}

/** 【根治·非幂等读-2026-09-07】把当前对话 tables 落成「稳定基线」：仅当 memory.assistantTables 尚未落盘时，
 *  把 getCurrentAssistantTabs 的归一结果（空表水合或老数据升级）写回一次。
 *  背景：normalizeAssistantTabs 在真源缺失时每次调用都会 generateId 造新 tab id，
 *  而 getCurrentAssistantTabs 是纯读从不落盘 → 空/老数据对话的 tab id 只活在「那一次读」里。
 *  被别处捕获后（如 acceptTablePreview 存的 preview.targetTabId）再重读就对不上，confirm 误判「目标不存在」。
 *  落一次后真源存在 → 后续读全部返回同一批稳定 id。幂等：已落盘则直接返回。 */
export function materializeAssistantTabs(): void {
  const conv = getActiveConv();
  if (!conv) return;
  if (conv.memory?.assistantTables) return; // 已落盘 → id 已稳定
  setCurrentAssistantTabs(getCurrentAssistantTabs());
}

/** 写当前对话的多标签页集合（归一后落 memory.assistantTables + commit 自动落盘；不再写 assistantTable） */
export function setCurrentAssistantTabs(tabs: AssistantTableTabs): void {
  const conv = getActiveConv();
  if (!conv) return;
  commit({
    ...getState(),
    conversations: getState().conversations.map((x) =>
      x.id === conv.id
        ? {
            ...x,
            // 深拷贝后落盘，避免内存态 tabs 引用被后续 setState 污染
            memory: normalizeMemory({ ...x.memory, assistantTables: normalizeAssistantTabs(tabs) }),
            updatedAt: Date.now(),
          }
        : x,
    ),
  });
}

/** 【兼容语义收窄】读当前对话「当前活动 tab」的表（内部走 tabs；既有调用点签名不变） */
export function getCurrentAssistantTable(): AssistantTable {
  const tab = getActiveTab(getCurrentAssistantTabs());
  return tab ? { columns: tab.columns, rows: tab.rows } : emptyAssistantTable();
}

/** 【兼容语义收窄】写当前对话「当前活动 tab」的表（内部走 tabs；既有调用点签名不变） */
export function setCurrentAssistantTable(sb: AssistantTable): void {
  const tabs = getCurrentAssistantTabs();
  const normalized = normalizeAssistantTable(sb);
  setCurrentAssistantTabs(updateTab(tabs, tabs.activeTabId, () => normalized));
}

/** 设置当前对话的活动 tab（读写真源 tabs；运行态「切 tab 重置协作现场」由调用方 tableWorkspaceState 处理） */
export function setActiveTableTab(tabId: string): void {
  setCurrentAssistantTabs(setActiveTabId(getCurrentAssistantTabs(), tabId));
}

/** 写当前活动 tab 的 globalStyle（隔离决策：每 tab 独立，不进 global_contract） */
export function setCurrentTableGlobalStyle(style: string): void {
  const tabs = getCurrentAssistantTabs();
  setCurrentAssistantTabs(setTabGlobalStyle(tabs, tabs.activeTabId, style));
}

/** 读某 tab；不存在返回 null */
export function getTableTab(tabId: string): TableTab | null {
  return getTab(getCurrentAssistantTabs(), tabId);
}

/** 整表替换某 tab（预览确认写回目标表用；源表不动） */
export function setTableTab(tabId: string, sb: { columns: TableColumn[]; rows: TableRow[] }): void {
  const tabs = getCurrentAssistantTabs();
  setCurrentAssistantTabs(setTabTable(tabs, tabId, sb));
}

/** 给某条消息打「表格预览处理态」标记（confirmed=已写入 / cancelled=已取消），随消息落盘。
 *  背景（2026-09-06 持久化修复）：AI 返回表格 JSON 会被 AgentPanel 变成「待确认表格预览」；
 *  用户确认/取消后，表格数据已写回 memory.assistantTable（持久），但「这条消息已被处理」这个
 *  事实若只留在内存 UI 态（tbPreview state），刷新后 AgentPanel 的探测 effect 会把历史表格消息
 *  误判成「新的待确认预览」再次弹卡（左侧表格其实已写入）。把处理态写回消息自身，即可让刷新后
 *  自动恢复消息流里的 pv-done 痕迹、且不再重复弹待确认卡。 */
export function markMessageTableResolved(
  messageId: unknown,
  resolved: 'confirmed' | 'cancelled',
): void {
  const conv = getActiveConv();
  if (!conv || messageId == null) return;
  commit({
    ...getState(),
    conversations: getState().conversations.map((c) =>
      c.id === conv.id
        ? {
            ...c,
            messages: c.messages.map((m) =>
              m && (m as { id?: unknown }).id === messageId ? { ...m, tableResolved: resolved } : m,
            ),
            updatedAt: Date.now(),
          }
        : c,
    ),
  });
}

/** 读当前对话的跨步成果资产（无则 null） */
/** 跨步成果资产条目（底座 ArtifactShape 的别名；字段由写入方约定，故全部可选） */
export type Artifact = ArtifactShape;

export function getCurrentArtifacts(): Artifact[] | null {
  return getActiveConv()?.memory?.artifacts || null;
}

/** 写当前对话的跨步成果资产（[{id,type,title,description,nodeId?,url?}]） */
export function setCurrentArtifacts(arr: Artifact[] | null): void {
  const conv = getActiveConv();
  if (!conv) return;
  commit({
    ...getState(),
    conversations: getState().conversations.map((x) =>
      x.id === conv.id
        ? {
            ...x,
            memory: normalizeMemory({
              ...x.memory,
              artifacts: Array.isArray(arr) && arr.length ? arr : null,
            }),
            updatedAt: Date.now(),
          }
        : x,
    ),
  });
}

/* ── 工作流运行时状态（per-conversation，Step D；替代模块级 aiUndoStack/pendingGenerations）── */

/** 读当前对话的 AI 撤销栈（副本） */
export function getActiveAiUndoStack(): unknown[] {
  return [...(getActiveConv()?.aiUndoStack || [])];
}

/** 压入 AI 撤销快照（上限 20） */
export function pushActiveAiUndo(snapshot: Record<string, unknown>): void {
  const conv = getActiveConv();
  if (!conv) return;
  const stack = [...(conv.aiUndoStack || []), snapshot];
  if (stack.length > 20) stack.shift();
  commit({
    ...getState(),
    conversations: getState().conversations.map((c) =>
      c.id === conv.id ? { ...c, aiUndoStack: stack, updatedAt: Date.now() } : c,
    ),
  });
}

/** 弹出最近 AI 撤销快照 */
export function popActiveAiUndo(): Record<string, unknown> | undefined {
  const conv = getActiveConv();
  if (!conv || !(conv.aiUndoStack || []).length) return null;
  const stack = [...conv.aiUndoStack];
  const popped = stack.pop() as Record<string, unknown> | undefined;
  commit({
    ...getState(),
    conversations: getState().conversations.map((c) =>
      c.id === conv.id ? { ...c, aiUndoStack: stack, updatedAt: Date.now() } : c,
    ),
  });
  return popped;
}

/* ── 参考图引用（per-conversation，防跨对话泄漏）── */

/** 读当前对话「本轮用户引用的参考图」URL 数组（per-conversation，TASK-006 #7 防跨对话泄漏） */
export function getCurrentRefImages(): string[] {
  return getActiveConv()?.referenceImages || [];
}

/** 写当前对话「本轮用户引用的参考图」URL 数组 */
export function setCurrentRefImages(urls: unknown[] = []): void {
  const conv = getActiveConv();
  if (!conv) return;
  const next: string[] = Array.isArray(urls) ? (urls.filter(Boolean) as string[]) : [];
  commit({
    ...getState(),
    conversations: getState().conversations.map((c) =>
      c.id === conv.id ? { ...c, referenceImages: next, updatedAt: Date.now() } : c,
    ),
  });
}
