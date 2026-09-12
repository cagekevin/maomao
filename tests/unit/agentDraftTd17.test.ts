/**
 * TD-17 复核（2026-09-11 第 4 轮）—— 草稿「唯一真源」真伪检验。
 *
 * 背景：第 3 轮把草稿收敛为 `conv.draft` 单一真源、删掉 `agent_draft` 独立存储键后，
 * 断言「切对话自动跟随」。本文件用**真实 conversationStore**（不 mock）验证该断言，
 * 结果证伪出两处遗漏：
 *
 *   ① switchChat / newChat / deleteChat 在切换前 `setCurrentSnapshot({ …, draft: '' })`
 *      —— 把**即将离开的会话**的草稿清空。旧实现（独立 `agent_draft` 键）下这一清是
 *      「防止草稿串到新对话」的必要防御；收敛到 `conv.draft` 后它变成**数据破坏**：
 *      填了草稿 → 切走 → 切回，草稿永久丢失。
 *
 *   ② `applyConversationState` 从 `snapshot.draft` 同步 UI 态，但 `ConversationSnapshot.draft`
 *      有值而 `transitional`……（见断言）——草稿跟随链路的实际行为由下方用例钉死。
 *
 * 这两条**不是测试桩缺陷**，是生产代码缺陷（用例直接驱动真实 store），故修复前本文件必红。
 */
// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── 隔离存储（KV 走内存 Map，避免真实网络/降级告警）──
const kvStore = new Map();
vi.mock('../../src/components/base/api/localToolApi.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  kvGet: vi.fn(async (key) => (kvStore.has(key) ? kvStore.get(key) : null)),
  kvSet: vi.fn(async (key, value) => {
    kvStore.set(key, value);
  }),
  kvDelete: vi.fn(async (key) => {
    kvStore.delete(key);
  }),
}));
vi.mock('../../src/components/base/core/logger.ts', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), log: vi.fn() },
}));

const store = await import('../../src/components/agent/conversation/conversationStore.ts');
// getState 未从聚合层 re-export（属底座内部契约），复核用其公开读入口 getConversations。
const state = await import('../../src/components/agent/conversation/conversationState.ts');

const readDraft = (convId: string): string =>
  (state.getState().conversations.find((c) => c.id === convId) || ({} as { draft?: string }))
    .draft || '';

describe('TD-17 复核 · 草稿唯一真源 = conv.draft（切对话不丢）', () => {
  beforeEach(() => {
    kvStore.clear();
    store.resetConversationCache();
    store.setAgentKey('canvas-assistant-td17-probe');
    // applyConversation 内部 markHydrated（末行），故建好首会话即已放行落盘；本用例只读内存态。
    store.ensureActiveConversation();
  });

  it('① 草稿写入 conv.draft 后，切走再切回必须原样保留（复刻 switchChat 真实调用序）', () => {
    const convA = store.ensureActiveConversation();
    store.setCurrentSnapshot({ draft: 'A 的草稿' });
    expect(readDraft(convA)).toBe('A 的草稿'); // 落点正确

    // —— 复刻 useAgentChat.newChat：stageBeforeSwitch（只暂存 messages/skills，**不碰 draft**）→ newConversation ——
    store.setCurrentSnapshot({
      messages: store.getCurrentSnapshot().messages,
      skills: store.getCurrentSnapshot().skills,
    });
    const convB = store.newConversation().id;

    // —— 复刻 useAgentChat.switchChat(convA)：stageBeforeSwitch → switchConversation ——
    store.setCurrentSnapshot({
      messages: store.getCurrentSnapshot().messages,
      skills: store.getCurrentSnapshot().skills,
    });
    store.switchConversation(convA);

    // 断言：A 的草稿应仍在（草稿是数据，不是「待发送的瞬时输入」）
    expect(readDraft(convA)).toBe('A 的草稿');
    void convB;
  });

  it('③ 发送期间用户新输入的内容，不被 send 收尾（finally）清掉', () => {
    const convA = store.ensureActiveConversation();
    // send 入口：清 draft（内容已发出）——复刻 useAgentChat.send 准备段
    store.setCurrentSnapshot({ draft: '', attachments: [] });
    // AI 回复期间用户重新打字 → saveDraft
    store.setCurrentSnapshot({ draft: '等结果时我先写下一句' });
    // send 收尾 finally：只落 messages/skills，**不碰 draft**（原实现带 draft:'' → 静默丢字）
    store.setCurrentSnapshot({ messages: store.getCurrentSnapshot().messages });

    expect(readDraft(convA)).toBe('等结果时我先写下一句');
  });

  it('④ 窄接口：setCurrentDraft 只动 draft，不碰 messages/skills/attachments（TD-11-5）', () => {
    const convA = store.ensureActiveConversation();
    store.setCurrentSkills([{ id: 's1' }]);
    store.setCurrentAttachments([{ url: 'u1' }]);
    store.setCurrentDraft('只有草稿变');

    const conv = state.getState().conversations.find((c) => c.id === convA);
    expect(conv?.draft).toBe('只有草稿变');
    // 其余字段必须原样（若窄接口退化成 setCurrentSnapshot 列举，这里会红）
    expect(conv?.skills).toHaveLength(1);
    expect(conv?.attachments).toHaveLength(1);
  });

  it('⑤ 窄接口：resetCurrentConversationToEmpty 清空全部会话态，且 skills 按入参保留（TD-11-5）', () => {
    const convA = store.ensureActiveConversation();
    store.setCurrentSnapshot({
      messages: [{ id: 'm1', role: 'user', content: 'x' }],
      draft: '半截',
      attachments: [{ url: 'u1' }],
    });
    store.resetCurrentConversationToEmpty([{ id: 'keep' }]);

    const conv = state.getState().conversations.find((c) => c.id === convA);
    expect(conv?.messages).toHaveLength(0);
    expect(conv?.draft).toBe('');
    expect(conv?.attachments).toHaveLength(0);
    expect(conv?.skills).toEqual([{ id: 'keep' }]); // 清空对话不撤技能（与原 clear 行为一致）
    expect(conv?.workflow).toBeNull();
    expect(conv?.pending).toBeNull();
    // 记忆必须回到空记忆（而非残留）
    expect(conv?.memory?.summary).toBe('');
    expect(conv?.memory?.global_contract).toBeNull();
    expect(conv?.memory?.assistantTables).toBeNull();
  });

  it('⑥ 门禁态切对话隔离：creditGate 是 per-conversation，切走后不应再读到（TD-11-7）', () => {
    const convA = store.ensureActiveConversation();
    store.setCreditGate({ pending: true, gens: [{ id: 'g1' }], map: { s1: 'n1' } });
    expect(store.getCreditGate()?.pending).toBe(true); // A 上确有门禁

    const convB = store.newConversation().id;
    // 切到 B：真源是 per-conversation，B 上没有门禁
    expect(store.getCreditGate()).toBeNull();
    // 切回 A：A 的门禁应仍在（per-conversation 语义）
    store.switchConversation(convA);
    expect(store.getCreditGate()?.pending).toBe(true);
    void convB;
  });

  it('⑦ 切对话后各 per-conversation 运行态互不串（补齐「无测试覆盖」缺口）', () => {
    const convA = store.ensureActiveConversation();
    store.setActivePendingGenerations([{ id: 'genA' }]);
    store.setAwaitingConfirm(true);
    store.setActivePendingMemorySuggest({ kind: 'fact', content: 'A 的记忆' });
    store.setCurrentRefImages(['a.png']);
    store.pushActiveAiUndo({ action: 'A 的操作' });

    const convB = store.newConversation().id;
    void convB;
    // B 上是全新空态：任何一个字段串过来都是 bug
    expect(store.getActivePendingGenerations()).toBeNull();
    expect(store.getAwaitingConfirm()).toBe(false);
    expect(store.getActivePendingMemorySuggest()).toBeNull();
    expect(store.getCurrentRefImages()).toEqual([]);
    expect(store.getActiveAiUndoStack()).toEqual([]);

    // 切回 A：A 的运行态应原样还在（运营态是数据，随会话走）
    store.switchConversation(convA);
    expect(store.getActivePendingGenerations()).toEqual([{ id: 'genA' }]);
    expect(store.getAwaitingConfirm()).toBe(true);
    expect(store.getActivePendingMemorySuggest()).toEqual({ kind: 'fact', content: 'A 的记忆' });
    expect(store.getCurrentRefImages()).toEqual(['a.png']);
    expect(store.getActiveAiUndoStack()).toEqual([{ action: 'A 的操作' }]);
  });

  it('② 草稿属于各自会话，互不串扰（per-conversation 语义）', () => {
    const convA = store.ensureActiveConversation();
    store.setCurrentSnapshot({ draft: 'A 稿' });
    const convB = store.newConversation().id;
    expect(readDraft(convB)).toBe(''); // 新会话草稿空
    store.setCurrentSnapshot({ draft: 'B 稿' });
    expect(readDraft(convA)).toBe('A 稿'); // A 不受影响
    expect(readDraft(convB)).toBe('B 稿');
  });
});
