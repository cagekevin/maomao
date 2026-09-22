/**
 * TD-11-22 复核 —— 「带上某个 Skill 去用」必须是**真动作**，不是假按钮。
 *
 * 旧实相：设置页「去使用」只 `showToast('已切换到该技能')`，**零状态变更**（点了等于没点）。
 * 本文件用**真实 conversationStore + appSettings**（不 mock 它们）钉死三件事：
 *   ① 选中态真进了当前对话（`conv.skills`）；
 *   ② AI 面板被**请求打开**（否则用户看不见 ⇒ 动作仍等于没发生）；
 *   ③ 缺 id 时**如实失败**，不返回假成功。
 * 附带回归：`skills` 归一收口后，写进快照的必须是 **id 字符串**（旧实现 `{...s}` 会把它展开成
 * `{0:'s',1:'k',…}` 索引对象 ⇒ 刷新/切对话后按字符串过滤时全部丢失）。
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
vi.mock('../../src/components/base/core/log/logger.ts', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), log: vi.fn() },
}));

const store = await import('../../src/components/agent/conversation/conversationStore.ts');
const state = await import('../../src/components/agent/conversation/conversationState.ts');
const snapshot = await import('../../src/components/agent/conversation/conversationSnapshot.ts');
const appSettings = await import('../../src/components/base/store/appSettings.ts');
const { selectSkillInCurrentConversation } =
  await import('../../src/components/agent/conversation/skillSelection.ts');

/** 直读**落盘真值**（不经快照读入口）：用于抓"读回来看着对、存下去是坏的" */
const storedSkills = (): unknown[] =>
  state.getState().conversations.find((c) => c.id === state.getState().activeId)?.skills ?? [];

describe('selectSkillInCurrentConversation（把某个 Skill 带进当前对话）', () => {
  beforeEach(() => {
    kvStore.clear();
    store.resetConversationCache();
    store.setAgentKey('canvas-assistant-td1122-probe');
    store.ensureActiveConversation();
    appSettings.setSetting('agentOpen', false);
  });

  it('选中后：id 进当前对话，且**面板被请求打开**（否则这次动作用户看不见）', () => {
    const r = selectSkillInCurrentConversation('sk-1');

    expect(r).toMatchObject({ ok: true, added: true });
    expect(snapshot.getCurrentSnapshot().skills).toEqual(['sk-1']);
    expect(storedSkills()).toEqual(['sk-1']);
    expect(appSettings.getSetting('agentOpen')).toBe(true);
  });

  it('已在当前对话 ⇒ 幂等（added:false，不重复加）', () => {
    selectSkillInCurrentConversation('sk-1');
    const again = selectSkillInCurrentConversation('sk-1');

    expect(again).toMatchObject({ ok: true, added: false });
    expect(snapshot.getCurrentSnapshot().skills).toEqual(['sk-1']);
  });

  it('已有别的技能 ⇒ **追加**而不是清空（不破坏用户已选）', () => {
    selectSkillInCurrentConversation('sk-1');
    selectSkillInCurrentConversation('sk-2');

    expect(snapshot.getCurrentSnapshot().skills).toEqual(['sk-1', 'sk-2']);
  });

  it('缺 id ⇒ 如实失败（不假装切换过、也不动面板）', () => {
    const r = selectSkillInCurrentConversation('   ');

    expect(r.ok).toBe(false);
    expect(r.message).toBeTruthy();
    expect(snapshot.getCurrentSnapshot().skills).toEqual([]);
    expect(appSettings.getSetting('agentOpen')).toBe(false);
  });

  it('【回归】落盘的是 **id 字符串本身**（旧实现 `{...id}` 会展开成索引对象，刷新后已选技能丢失）', () => {
    selectSkillInCurrentConversation('sk-1');

    expect(storedSkills()).toEqual(['sk-1']);
    expect(storedSkills().every((s) => typeof s === 'string')).toBe(true);
  });
});
