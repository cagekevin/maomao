// @vitest-environment node
/**
 * relayProxy 契约测试（2026-09-03 R6 收口后）。
 *
 * 覆盖（纯契约，不测 UI）：
 *  - relayAttachUntilDone：低频 attach → 终态信封映射（completed→{ok,url} / failed→{ok,error} / running→续）；
 *    abort 只停本地等待（**不发任何取消请求** —— 生成链路不提供中止入口，ADR-0061）。
 *  - relayGenerate = submit + attach 到终态。
 *
 * mock：httpRequest（httpClient）接 /api/generate 的 {code,data} 信封。
 * 时间：attach 循环内有 3s sleep，用 fake timers + advanceTimersByTimeAsync 推进，避免真等/挂。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  mockHttpRequest: vi.fn(),
}));
vi.mock('../../src/components/base/api/httpClient.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  httpRequest: (...a: any[]) => h.mockHttpRequest(...a),
}));

import {
  relayAttachUntilDone,
  relayGenerate,
  relayChat,
  relayChatStream,
} from '../../src/components/generate/lib/relayProxy.ts';
import { CHAT_TOTAL_TIMEOUT } from '../../src/components/base/core/config.ts';
import { logger } from '../../src/components/base/core/log/logger.ts';

function envResp(data: any) {
  // httpRequest parseJson:true 真实返回纯信封对象 { code, data }（无 .json）
  return { code: 0, data };
}

/** fake timers 下跑一个含 sleep 的异步任务：启动 promise → 推进 timers → 等结果 */
async function runWithTimers<T>(
  p: Promise<T>,
): Promise<{ ok: boolean; value?: T; error?: unknown }> {
  const result = p.then((v) => ({ ok: true, value: v })).catch((e) => ({ ok: false, error: e }));
  await vi.advanceTimersByTimeAsync(20000); // 覆盖最坏多轮 sleep 总时长
  return result;
}

describe('relayProxy §R6 — relayAttachUntilDone（统一 attach 契约）', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    h.mockHttpRequest.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('completed → {ok:true, url}（url=后端已落盘 /files/）', async () => {
    h.mockHttpRequest.mockResolvedValue(
      envResp({ status: 'completed', url: '/files/tasks/x.png' }),
    );
    const r = await runWithTimers(relayAttachUntilDone({ frontTaskId: 'task-1' }));
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ ok: true, url: '/files/tasks/x.png' });
    // 查询打到 /api/generate/:frontTaskId
    expect(h.mockHttpRequest).toHaveBeenCalledWith(
      expect.stringContaining('/api/generate/task-1'),
      expect.any(Object),
    );
  });

  it('failed → {ok:false, error}', async () => {
    h.mockHttpRequest.mockResolvedValue(envResp({ status: 'failed', error: '上游拒绝' }));
    const r = await runWithTimers(relayAttachUntilDone({ frontTaskId: 'task-1' }));
    expect(r.value).toEqual({ ok: false, error: '上游拒绝' });
  });

  it('running → 续查直到 completed（多轮）', async () => {
    h.mockHttpRequest
      .mockResolvedValueOnce(envResp({ status: 'running', progress: 50 }))
      .mockResolvedValueOnce(envResp({ status: 'completed', url: '/files/tasks/v.mp4' }));
    const onProgress = vi.fn();
    const r = await runWithTimers(relayAttachUntilDone({ frontTaskId: 'task-1', onProgress }));
    expect(r.value).toEqual({ ok: true, url: '/files/tasks/v.mp4' });
    expect(onProgress).toHaveBeenCalled(); // 中途 progress 触发回调
    expect(h.mockHttpRequest.mock.calls.length).toBeGreaterThanOrEqual(2); // 多轮查询
  });

  it('等待预算用尽 → {ok:false, pending:true}（停止等待 ≠ 失败：不替后端判死）', async () => {
    // 一直 running（永不到终态）→ 预算用尽退出
    h.mockHttpRequest.mockResolvedValue(envResp({ status: 'running', progress: 60 }));
    const r = await runWithTimers(relayAttachUntilDone({ frontTaskId: 'task-1', timeoutMs: 5000 }));
    expect(r.value!.ok).toBe(false);
    // 判别字段：消费方据此保持任务 running、交恢复轮询续 attach（而非当失败处理）
    expect(r.value!.pending).toBe(true);
    expect(r.value!.url).toBeUndefined();
    // error 降级为排障文案（走 timeoutMessage 唯一出口，含真实预算秒数），不再是失败结论
    expect(r.value!.error).toContain('5 秒');
  });

  it('【143 S4′】不传 timeoutMs ⇒ 从后端 budgetMs 学等待上限（生产者给全，前端不自持数值）', async () => {
    // 后端一直 running，但**每次响应都告知预算 5s** ⇒ 用尽后必须 pending（而不是空等到某个本地常量）
    h.mockHttpRequest.mockResolvedValue(
      envResp({ status: 'running', progress: 60, budgetMs: 5000 }),
    );
    const r = await runWithTimers(relayAttachUntilDone({ frontTaskId: 'task-1' }));
    expect(r.ok).toBe(true);
    expect(r.value!.ok).toBe(false);
    expect(r.value!.pending).toBe(true);
    // 文案里的秒数 = **后端给的那个数** ⇒ 证明预算确实是从响应学的，不是本地常量
    expect(r.value!.error).toContain('5 秒');
  });

  it('【143 S4′】显式 timeoutMs 优先于后端 budgetMs（调用方本次耐心 > 生产者默认）', async () => {
    // 后端报 60s，调用方只要 3s ⇒ 必须按 3s 掐（3s 秒数出现在文案里）
    h.mockHttpRequest.mockResolvedValue(
      envResp({ status: 'running', progress: 60, budgetMs: 60000 }),
    );
    const r = await runWithTimers(relayAttachUntilDone({ frontTaskId: 'task-1', timeoutMs: 3000 }));
    expect(r.value!.pending).toBe(true);
    expect(r.value!.error).toContain('3 秒');
  });

  it('【146 · ADR-0061】signal abort 只抛 AbortError，**不发任何取消请求**（前端无中止入口）', async () => {
    const ctl = new AbortController();
    h.mockHttpRequest.mockImplementation(async () => envResp({ status: 'running', progress: 10 }));
    const p = relayAttachUntilDone({ frontTaskId: 'task-1', signal: ctl.signal });
    ctl.abort();
    const r = await runWithTimers(p);
    expect(r.ok).toBe(false);
    expect(r.error).toMatchObject({ name: 'AbortError' });
    // 取消端点已随 D7/D10 删除：任何 `/cancel` 请求 = 中止链路回潮
    expect(h.mockHttpRequest.mock.calls.some(([u]) => String(u).includes('/cancel'))).toBe(false);
  });
});

describe('relayProxy §R6 — relayGenerate = submit + attach', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    h.mockHttpRequest.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('提交拿到 taskId → attach 到 completed → {ok:true, url}', async () => {
    h.mockHttpRequest.mockImplementation(async (url) => {
      // 【TD-08-52】submit 响应必须带 `budgetMs`（后端契约：成功/失败两条路径都带）
      if (url.endsWith('/api/generate')) return envResp({ taskId: 'task-1', budgetMs: 600000 }); // submit
      return envResp({ status: 'completed', url: '/files/tasks/x.png' }); // attach
    });
    const p = relayGenerate({
      intent: {
        frontTaskId: 'task-1',
        type: 'image',
        providerId: 'lovart',
        capability: 'image',
        model: 'm',
        prompt: 'x',
      },
    });
    const r = await runWithTimers(p);
    expect(r.value).toEqual({ ok: true, url: '/files/tasks/x.png' });
    const submitCall = h.mockHttpRequest.mock.calls.find(([u]) => u.endsWith('/api/generate'));
    expect(submitCall).toBeTruthy();
    expect(JSON.parse(submitCall![1].body)).toMatchObject({
      frontTaskId: 'task-1',
      providerId: 'lovart',
      capability: 'image',
      model: 'm',
    });
  });

  it('提交失败（code:-1）→ {ok:false, error}（不做 attach）', async () => {
    h.mockHttpRequest.mockResolvedValue({ code: -1, data: { error: '提交失败' } });
    const p = relayGenerate({
      intent: { frontTaskId: 't', type: 'image', providerId: 'p', capability: 'image', model: 'm' },
    });
    const r = await runWithTimers(p);
    expect(r.value).toEqual({ ok: false, error: '提交失败' });
    // 只 submit，无 attach
    expect(h.mockHttpRequest.mock.calls.every(([u]) => !u.includes('/api/generate/t'))).toBe(true);
  });

  it('[TD-08-52] POST 响应缺 budgetMs ⇒ fail-fast（拒收，不编默认值兜底）', async () => {
    h.mockHttpRequest.mockResolvedValue(envResp({ taskId: 'task-nobudget' }));
    const p = relayGenerate({
      intent: { frontTaskId: 't', type: 'image', providerId: 'p', capability: 'image', model: 'm' },
    });
    const r = await runWithTimers(p);
    expect(r.value).toEqual({ ok: false, error: '提交响应缺 budgetMs（后端契约违约）' });
    // 拒收后不得继续 attach（未出站 ⇒ 也不存在"任务在跑白等"）
    expect(h.mockHttpRequest.mock.calls.every(([u]) => !u.includes('/api/generate/t'))).toBe(true);
  });

  it('submit/attach 请求均禁用本层 HTTP 超时（timeoutMs:0，根治 15s 误报；真长等待由后端 budgetMs 兜底）', async () => {
    h.mockHttpRequest.mockImplementation(async (url) => {
      // 【TD-08-52】submit 响应必须带 `budgetMs`（后端契约：成功/失败两条路径都带）
      if (url.endsWith('/api/generate')) return envResp({ taskId: 'task-1', budgetMs: 600000 }); // submit
      return envResp({ status: 'completed', url: '/files/tasks/x.png' }); // attach
    });
    const p = relayGenerate({
      intent: {
        frontTaskId: 'task-1',
        type: 'image',
        providerId: 'lovart',
        capability: 'image',
        model: 'm',
        prompt: 'x',
      },
    });
    const r = await runWithTimers(p);
    expect(r.value).toEqual({ ok: true, url: '/files/tasks/x.png' });
    // 提交与 attach 请求的 httpRequest options.timeoutMs 都应为 0（不再用默认 15s）
    for (const [_url, opts] of h.mockHttpRequest.mock.calls) {
      expect(opts.timeoutMs).toBe(0);
    }
    // 且确实既发过 submit 也发过 attach
    expect(h.mockHttpRequest.mock.calls.some(([u]) => u.endsWith('/api/generate'))).toBe(true);
    expect(h.mockHttpRequest.mock.calls.some(([u]) => u.includes('/api/generate/task-1'))).toBe(
      true,
    );
  });
});

/**
 * 【TD-01-24】chat 预算贯通 —— 前端把**本次实际预算**写进 `body.timeoutMs`（生产者给全），
 * 后端读它并原样转发给上游。此前它只用来掐本层 fetch，后端**不知道** ⇒ 按自己默认跑上游 = 白跑。
 */
describe('relayProxy · chat 预算贯通（TD-01-24）', () => {
  beforeEach(() => {
    h.mockHttpRequest.mockReset();
  });

  const chatIntent = {
    frontTaskId: 't1',
    type: 'chat',
    providerId: 'lovart',
    capability: 'chat',
    model: 'm',
  } as const;

  it('relayChat：显式预算 → 同时写进 body.timeoutMs 与本层 fetch 超时', async () => {
    h.mockHttpRequest.mockResolvedValueOnce(envResp({ status: 'completed', text: 'hi' }));
    await relayChat(chatIntent, { timeoutMs: 9000 });
    const [, opts] = h.mockHttpRequest.mock.calls[0] as [
      string,
      { body: string; timeoutMs: number },
    ];
    expect(JSON.parse(opts.body).timeoutMs).toBe(9000);
    expect(opts.timeoutMs).toBe(9000);
  });

  it('relayChat：未显式传 → 用 CHAT_TOTAL_TIMEOUT（任务总预算，不是段值 · S5′）', async () => {
    h.mockHttpRequest.mockResolvedValueOnce(envResp({ status: 'completed', text: 'hi' }));
    await relayChat(chatIntent);
    const [, opts] = h.mockHttpRequest.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(opts.body).timeoutMs).toBe(CHAT_TOTAL_TIMEOUT);
  });

  it('relayChatStream：body 带总预算 CHAT_TOTAL_TIMEOUT（与调用方总闸同源）', async () => {
    h.mockHttpRequest.mockResolvedValueOnce(new Response(''));
    await relayChatStream({
      intent: { frontTaskId: 't1', providerId: 'lovart', model: 'm' },
      stream: true,
    });
    const [, opts] = h.mockHttpRequest.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(opts.body).timeoutMs).toBe(CHAT_TOTAL_TIMEOUT);
  });

  // ── 失败/空内容的原文留痕（唯一出口；消费端不得再各加一份）──
  // 断言的是**行为效果**：给定后端真返的信封 → 唯一出口的留痕必须带原文。
  // 把 relayChat 的两处 logger.warn 去掉 → 本组断言必红（先红后绿，见轮次日志探针）。

  it('relayChat：后端 200 但 text 为空 → 留痕带原文 code/data（信封原样）', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    // 空 text + 无 error：正是线上「上游未返回文本内容」的形态
    h.mockHttpRequest.mockResolvedValueOnce(
      envResp({ status: 'completed', kind: 'text', text: '' }),
    );
    const r = await relayChat(chatIntent);
    expect(r).toEqual({ ok: false, error: '上游未返回文本内容' });
    expect(warn).toHaveBeenCalledTimes(1);
    const [, , detail] = warn.mock.calls[0] as [string, string, { code?: number; data?: unknown }];
    expect(detail.code).toBe(0);
    expect(detail.data).toEqual({ status: 'completed', kind: 'text', text: '' });
    warn.mockRestore();
  });

  it('relayChat：后端给了业务错误 → 原样转发，**前端不另打留痕**（原文由后端发出）', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const msg = 'Lovart 未返回文本内容（上游 result 为空，原文见 [lovart] 日志）';
    h.mockHttpRequest.mockResolvedValueOnce({
      code: -1,
      data: { error: msg, providerId: 'lovart', capability: 'chat' },
    });
    const r = await relayChat(chatIntent);
    expect(r).toEqual({ ok: false, error: msg });
    // 消费者只转发：留痕已由生产者（后端 adapter）打一次，前端再打 = 同一证据 N 份
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('relayChat：信封形状不符（无 data）→ 留痕带整个 env（不静默）', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    h.mockHttpRequest.mockResolvedValueOnce({ code: 0 });
    const r = await relayChat(chatIntent);
    expect(r.ok).toBe(false);
    const [, , detail] = warn.mock.calls[0] as [string, string, { data?: unknown }];
    expect(detail.data).toEqual({ code: 0 });
    warn.mockRestore();
  });

  it('relayChat：非 2xx / 网络失败 → 留痕带 HTTP 状态与上游错误体', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const httpErr = Object.assign(new Error('上游 502'), {
      name: 'HttpError',
      status: 502,
      data: { message: 'bad gateway' },
    });
    h.mockHttpRequest.mockRejectedValueOnce(httpErr);
    const r = await relayChat(chatIntent);
    expect(r).toEqual({ ok: false, error: '上游 502' });
    const [, , detail] = warn.mock.calls[0] as [
      string,
      string,
      { status?: number; data?: unknown; error?: string },
    ];
    expect(detail.status).toBe(502);
    expect(detail.data).toEqual({ message: 'bad gateway' });
    warn.mockRestore();
  });
});
