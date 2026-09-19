import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as contentStore from '../../src/components/base/core/contentStore.ts';
import {
  SAFE_BUDGET_BYTES,
  STEER_QUEUE_MAX,
} from '../../src/components/agent/runtime/volumePolicy.ts';
const { contentClearCache } = contentStore;
import {
  agentConversationSubscribe,
  getState,
  commit,
  emptyMemory,
  normalizeWorkflow,
} from '../../src/components/agent/conversation/conversationState.ts';
import {
  resetConversationCache,
  ensureActiveConversation,
  applyConversation,
  setAgentKey,
  agentFlushPersist,
  getCurrentSnapshot,
  setCurrentSnapshot,
  patchCurrentMessages,
  setCurrentPending,
  getCurrentPending,
  makePendingRef,
  resetCurrentConversationToEmpty,
} from '../../src/components/agent/conversation/conversationStore.ts';

// 会话键已迁 KV（backend:'kv'）：写走 kvSet、读走 kvGet。用 Map 兜底让 KV 确定性往返，
// 避免走真实 localToolApi 网络（响铃 fetch 抛错 + 误导性降级告警 + 慢）。
const kvStore = new Map();
vi.mock('../../src/components/base/api/localToolApi.ts', async (importOriginal) => ({
  ...(await importOriginal()),
  kvGet: vi.fn(async (key) => (kvStore.has(key) ? kvStore.get(key) : null)),
  kvSet: vi.fn(async (key, value) => {
    kvStore.set(key, value);
    return { ok: true };
  }),
  kvDelete: vi.fn(async (key) => {
    kvStore.delete(key);
    return { ok: true };
  }),
}));

// 降级上报 spy：会话落盘**真失败**（4xx 拒收等）必须由本处交代，故断言它被调到。
const { degradeSpy } = vi.hoisted(() => ({ degradeSpy: vi.fn() }));
vi.mock('../../src/components/base/core/degrade.ts', async (importOriginal) => ({
  ...(await importOriginal()),
  reportDegrade: degradeSpy,
}));

beforeEach(() => {
  localStorage.clear();
  kvStore.clear();
  contentClearCache();
  resetConversationCache();
  degradeSpy.mockClear();
});

/**
 * 阶段1A（docs/25）新增测试安全网：
 * 覆盖 message 单源化的底层基座 —— commit 的 persist 语义（patch 轻量不落盘 vs setCurrentSnapshot 落盘）、
 * patchCurrentMessages 的「同步读」不变量、subscribe 按字段订阅入口。
 */

describe('conversationState 订阅与提交（消息单源底座）', () => {
  it('getState/subscribe 是可用入口（可订阅并收到通知）', () => {
    const id = ensureActiveConversation();
    applyConversation(id);
    expect(getState().activeId).toBe(id);
    let notified = 0;
    const unsub = agentConversationSubscribe(() => {
      notified++;
    });
    patchCurrentMessages([{ role: 'user', content: 'X' }]);
    expect(notified).toBeGreaterThan(0);
    unsub();
    const before = notified;
    patchCurrentMessages([{ role: 'user', content: 'Y' }]);
    expect(notified).toBe(before); // 退订后不再通知
  });

  it('patchCurrentMessages 更新消息且同步可读（50ms 热路径的不变量）', () => {
    const id = ensureActiveConversation();
    applyConversation(id);
    patchCurrentMessages([{ role: 'user', content: 'first' }]);
    // 核心不变量：patch 后立即 getCurrentSnapshot() 读到最新消息（send finally 落盘依赖此同步链）
    expect(getCurrentSnapshot().messages).toHaveLength(1);
    expect(getCurrentSnapshot().messages[0].content).toBe('first');
    // 追加一条再读
    const cur = getCurrentSnapshot().messages;
    patchCurrentMessages([...cur, { role: 'assistant', content: 'second' }]);
    expect(getCurrentSnapshot().messages).toHaveLength(2);
    expect(getCurrentSnapshot().messages[1].content).toBe('second');
  });

  it('patchCurrentMessages 是轻量通知路径：不发起落盘调度（contentSet 不被同步触发）', () => {
    const id = ensureActiveConversation();
    applyConversation(id);
    const spy = vi.spyOn(contentStore, 'contentSet');
    patchCurrentMessages([{ role: 'user', content: 'IN_FLIGHT' }]);
    // patch 走 persist:false，不触发 persistDebounced.schedule → 不同步写存储；
    // 落盘只由 send finally（最终态）统一发起。这是流式热路径不卡主线程的关键。
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('setCurrentSnapshot 落盘（对比基准：仅最终写入会持久化）', async () => {
    const id = ensureActiveConversation();
    applyConversation(id);
    setCurrentSnapshot({ messages: [{ role: 'user', content: 'PERSISTED' }] });
    agentFlushPersist();
    // 【2026-09-17 TD-24-4 阶段0】会话落盘改走 contentSetAsync（生产者给结果）。
    // 原断言只等 `kvStore.has(key)` —— 那是**弱断言**：键可能由"存量迁移写"先建好，
    // 于是"本次快照到底写没写进去"根本没被验证（实测它先绿、水化却读到空）。
    // 现等**本次内容**真的落进 KV，再重置缓存异步水化重读。
    await vi.waitFor(() =>
      expect(JSON.stringify(kvStore.get('agent_conversations_canvas-assistant') ?? [])).toContain(
        'PERSISTED',
      ),
    );
    contentClearCache();
    resetConversationCache();
    setAgentKey('canvas-assistant');
    // 会话键已迁 KV，水化为异步：轮询等待水化完成读到 KV 里持久化数据（而非空壳）
    await vi.waitFor(() => expect(getCurrentSnapshot().messages).toHaveLength(1));
    expect(getCurrentSnapshot().messages[0].content).toBe('PERSISTED');
  });

  it('会话落盘真失败（contentSetAsync 抛错，如 4xx 拒收）→ reportDegrade 报出，且不阻断调用栈', async () => {
    const id = ensureActiveConversation();
    applyConversation(id);
    setCurrentSnapshot({ messages: [{ role: 'user', content: 'P' }] });
    // 【2026-09-17 改写】原用例 spy 的是**同步 contentSet** —— 而会话键走 KV，落盘早已改走
    // contentSetAsync（阶段0），那个 spy 永不触发 ⇒ 是**假绿**（测了个不存在的路径）。现锁真路径。
    const spy = vi.spyOn(contentStore, 'contentSetAsync').mockRejectedValue(new Error('KV 409'));
    expect(() => agentFlushPersist()).not.toThrow(); // 不阻断调用栈（persistDebounced 语义）
    await vi.waitFor(() => expect(spy).toHaveBeenCalled()); // 真落盘路径确实被走到
    await vi.waitFor(() => expect(degradeSpy).toHaveBeenCalled()); // 失败由本处交代（不静默）
    spy.mockRestore();
  });

  it('整包超预算：persistDebounced 用 applyConversationBudget 降级后的投影落盘（内存态不受影响）', async () => {
    const id = ensureActiveConversation();
    applyConversation(id);
    // 构造一个远超 SAFE_BUDGET_BYTES 的整包（仅驻内存，落盘前被降级）
    const hugeContent = 'x'.repeat(SAFE_BUDGET_BYTES + 1024 * 1024);
    setCurrentSnapshot({ messages: [{ role: 'user', content: hugeContent }] });
    // 【2026-09-17 TD-24-4 阶段0】落盘走 contentSetAsync（KV 键唯一合法写路径）——断言随之跟上
    const spy = vi.spyOn(contentStore, 'contentSetAsync');
    agentFlushPersist();
    // contentSetAsync 拿到的是【降级后】的投影：正文被截断，序列化字节回到预算内。
    // flush() 对异步写不同步等待 → 用 waitFor 等 spy 真正被调用（等不到 = 没落盘，如实红）。
    const persisted = (await vi.waitFor(() => {
      const call = spy.mock.calls[0];
      expect(call, 'persistDebounced flush 后必须发起一次 KV 落盘').toBeTruthy();
      return call[1] as Array<{ messages: Array<{ content: string }> }>;
    })) as Array<{ messages: Array<{ content: string }> }>; // contentSetAsync(key, value) → value 即 toStore 数组
    expect(JSON.stringify(persisted).length).toBeLessThan(SAFE_BUDGET_BYTES);
    const downgradedContent = persisted[0].messages[0].content;
    expect(downgradedContent.length).toBeLessThan(hugeContent.length);
    expect(downgradedContent.includes('…[已截断]')).toBe(true);
    // 内存态保持完整（投影降级不改 states 本体）
    expect(getCurrentSnapshot().messages[0].content).toBe(hugeContent);
    spy.mockRestore();
  });

  it('patchCurrentMessages 同样受 AGENT_MSG_MAX=60 上限截断（保留最近 60 条）', () => {
    const id = ensureActiveConversation();
    applyConversation(id);
    const many = Array.from({ length: 100 }, (_, i) => ({ role: 'user', content: `m${i}` }));
    patchCurrentMessages(many);
    expect(getCurrentSnapshot().messages).toHaveLength(60);
    expect(getCurrentSnapshot().messages.at(-1)!.content).toBe('m99');
  });

  it('pending 引用契约（P1a）：makePendingRef 不存 text 副本、保留原始 attachments；set/get 往返一致', () => {
    const id = ensureActiveConversation();
    applyConversation(id);
    const rawAtt = [{ type: 'image', url: '/files/raw.png' }];
    setCurrentPending(
      makePendingRef({ conversationId: id, messageId: 'm-42', attachments: rawAtt }),
    );
    const p = getCurrentPending()!;
    expect(p.messageId).toBe('m-42');
    // text 不入 pending（由 messageId 引用找回），避免用户消息双副本
    expect(p.text).toBeUndefined();
    // attachments 保留原始输入（恢复时经 send 归一化一次，避免二次压缩）
    expect(p.attachments).toEqual(rawAtt);
    // 兼容旧形态：遗留 text 仍保留（迁移期可恢复）
    setCurrentPending({ conversationId: id, text: 'legacy' });
    expect(getCurrentPending()!.text).toBe('legacy');
  });
});

describe('conversationState · normalizeWorkflow 的 L1 限容', () => {
  const base = { id: 'wf1', status: 'running', nodeIds: [], startedAt: 1, updatedAt: 2 };

  it('steerQueue 超上限保最近 STEER_QUEUE_MAX 条', () => {
    const total = STEER_QUEUE_MAX + 5;
    const w = normalizeWorkflow({
      ...base,
      steerQueue: Array.from({ length: total }, (_, i) => ({ text: `t${i}` })),
    })!;
    expect(w.steerQueue.length).toBe(STEER_QUEUE_MAX);
    // 保最近：末位是最新的那条；最早的 5 条被挤掉
    expect(w.steerQueue[w.steerQueue.length - 1]).toEqual({ text: `t${total - 1}` });
    expect(w.steerQueue[0]).toEqual({ text: `t${total - STEER_QUEUE_MAX}` });
  });

  it('未超上限原样保留', () => {
    const q = [{ text: 'a' }, { text: 'b' }];
    const w = normalizeWorkflow({ ...base, steerQueue: q })!;
    expect(w.steerQueue).toEqual(q);
  });
});

describe('TD-11-12 防回潮：resetCurrentConversationToEmpty 真清空全部状态字段（非假重置）', () => {
  it('重置后 workflow / pendingGenerations / awaitingConfirm / messages 全部清空（修复旧「漏斗漏字段」假重置）', () => {
    setAgentKey('canvas-assistant');
    ensureActiveConversation();
    // 先注入脏状态：workflow（有值）、pendingGenerations、awaitingConfirm=true
    const st = getState();
    const conv = st.conversations[0];
    commit({
      ...st,
      conversations: st.conversations.map((c) =>
        c.id === conv.id
          ? {
              ...c,
              workflow: normalizeWorkflow({ status: 'planning' }),
              pendingGenerations: [{ step: 'gen', nodeId: 'n1' }],
              awaitingConfirm: true,
            }
          : c,
      ),
    });
    const dirty = getState().conversations[0];
    expect(dirty.workflow).not.toBeNull();
    expect(dirty.pendingGenerations).not.toBeNull();
    expect(dirty.awaitingConfirm).toBe(true);

    // 重置（TD-11-12 改为直接构造完整重置态，不再经会漏字段的 setCurrentSnapshot 漏斗）
    resetCurrentConversationToEmpty();

    const after = getState().conversations[0];
    expect(after.workflow).toBeNull();
    expect(after.pendingGenerations).toBeNull();
    expect(after.awaitingConfirm).toBe(false);
    expect(after.messages).toEqual([]);
    expect(after.pending).toBeNull();
    expect(after.memory).toEqual(emptyMemory()); // 记忆清空（JSDoc 声称的「清空记忆」非谎称）
  });
});

describe('TD-11-12 防回潮：setCurrentSnapshot 的 workflow 判空对称（null 真清空）', () => {
  it('传 workflow:null 经 setCurrentSnapshot 应真清空（修复旧真值判断「传 null 当不动」）', () => {
    setAgentKey('canvas-assistant');
    ensureActiveConversation();
    setCurrentSnapshot({ workflow: normalizeWorkflow({ status: 'planning' }) });
    expect(getCurrentSnapshot().workflow).not.toBeNull();
    setCurrentSnapshot({ workflow: null }); // 旧实现因 truthy 判断会把 null 当「不动」→ 残留；现应清空
    expect(getCurrentSnapshot().workflow).toBeNull();
  });
});
