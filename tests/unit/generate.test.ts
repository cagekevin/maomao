// @vitest-environment node
/**
 * generate 门面单测（L3 收口后合并：由 imageApi/videoApi/chatApi 三测试并来）。
 *
 * 【收口要点】generateImage/generateVideo/chatCompletions 三别名 = 内部 generate() 的一行 wrapper，
 *   共用 relay 意图组装与 abort 语义。本套覆盖：
 *   - capability 分流（image/video→relayGenerate；chat→relayChat，绝不碰 relayChatStream）
 *   - 模态差异化（image 比例→像素查表；video 时长/清晰度/总超时）
 *   - abort 统一抛 AbortError（修正 1 选 A + §4.2.1 铁律：message 恒可被 /abort/i 匹配）
 *   - 参考图统一出口守卫（normalizeAssetUrlsForSend）/ 参考图 attach 消息块
 *   - resolveImagePixel 查表纯函数（迁自 imageApi → base/utils/imagePixel.ts）
 *   - barrel 契约（只导出具名门面，不导出 generate）
 *
 * 注：#5/#6/#9（chatStream 相关）随 L3b 并入本文件。
 */
import { describe, it, expect, beforeEach, vi, expectTypeOf } from 'vitest';
import type { GenerationResult } from '@/types/provider.ts';
import type { RelayGenerationResult } from '@/components/generate/lib/relayProxy';
import type { NodeGenerationResult } from '@/hooks/useNodeGeneration.ts';

vi.mock('../../src/components/base/utils/media/assetUrl.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  normalizeAssetUrlsForSend: vi.fn(async () => []),
  toImageContentBlocks: vi.fn((urls) =>
    (urls || []).map((url: any) => ({ type: 'image_url', image_url: { url } })),
  ),
  toAbsoluteFileUrl: vi.fn((u) => u),
  normalizeAssetUrl: vi.fn((u) => u),
  normalizeAssetUrlForSend: vi.fn(async (u) => u),
}));

const h = vi.hoisted(() => ({
  mockRelayGenerate: vi.fn(),
  mockRelayChat: vi.fn(),
  mockRelayChatStream: vi.fn(),
}));
vi.mock('../../src/components/generate/lib/relayProxy.ts', () => ({
  relayGenerate: (...a: any[]) => h.mockRelayGenerate(...a),
  relayChat: (...a: any[]) => h.mockRelayChat(...a),
  relayChatStream: (...a: any[]) => h.mockRelayChatStream(...a),
}));

const api = await import('@/components/generate/lib/generate');
const { resolveImagePixel } = await import('@/components/generate/lib/imagePixel');
const { normalizeAssetUrlsForSend } =
  await import('../../src/components/base/utils/media/assetUrl.ts');

beforeEach(() => {
  h.mockRelayGenerate.mockReset();
  h.mockRelayChat.mockReset();
  h.mockRelayChatStream.mockReset();
  vi.mocked(normalizeAssetUrlsForSend).mockReset();
  vi.mocked(normalizeAssetUrlsForSend).mockResolvedValue([]);
});

describe('generate — capability 分流与唯一入口（#1）', () => {
  it("capability:'image' → 调 relayGenerate，不调 relayChat", async () => {
    h.mockRelayGenerate.mockResolvedValue({ ok: true, url: 'http://x/a.png' });
    await api.generateImage({ provider: { id: 'p1' }, prompt: 'x', model: 'm' });
    expect(h.mockRelayGenerate).toHaveBeenCalledTimes(1);
    expect(h.mockRelayChat).not.toHaveBeenCalled();
    const { intent } = h.mockRelayGenerate.mock.calls[0][0];
    expect(intent.capability).toBe('image');
  });

  it("capability:'chat' → 调 relayChat，且绝不调 relayChatStream（§14.4②）", async () => {
    h.mockRelayChat.mockResolvedValue({ ok: true, content: '你好' });
    await api.chatCompletions({
      provider: { id: 'p1' },
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(h.mockRelayChat).toHaveBeenCalledTimes(1);
    expect(h.mockRelayChatStream).not.toHaveBeenCalled();
    expect(h.mockRelayGenerate).not.toHaveBeenCalled();
    const intent = h.mockRelayChat.mock.calls[0][0];
    expect(intent.capability).toBe('chat');
  });
});

describe('generate — 三模态差异与信封（#2/#3 + 迁移）', () => {
  it('image：relay 返 {ok:true,url} → 映射为 GenerationResult；比例+档位查表成像素', async () => {
    h.mockRelayGenerate.mockResolvedValue({
      ok: true,
      url: 'http://127.0.0.1:18080/files/tasks/x.png',
    });
    const res = await api.generateImage({
      provider: { id: 'lovart' },
      prompt: 'a cat',
      model: 'gpt-image-2-low',
      aspectRatio: '9:16',
      size: '1K',
      taskId: 'front-task-1',
    });
    expect(res).toEqual({ ok: true, url: 'http://127.0.0.1:18080/files/tasks/x.png' });
    const { intent, timeoutMs } = h.mockRelayGenerate.mock.calls[0][0];
    expect(intent.capability).toBe('image');
    expect(intent.providerId).toBe('lovart');
    expect(intent.model).toBe('gpt-image-2-low');
    expect(intent.prompt).toBe('a cat');
    expect(intent.size).toBe('880x1776'); // 9:16 + 1K → 精确像素
    expect(intent.frontTaskId).toBe('front-task-1');
    // 【143 · S4′】不再传 `timeoutMs` —— 等待上限由**后端**在 POST 响应里告知（`budgetMs`）。
    // 断言"该字段不存在"= 锁住「前端不自持上游预算」这个新契约：回退到本地常量即红。
    expect(timeoutMs).toBeUndefined();
  });

  it('video：relay 返 url → {ok:true,url}；size/resolution/duration 透传；不传总超时（#2 · S4′）', async () => {
    h.mockRelayGenerate.mockResolvedValue({
      ok: true,
      url: 'http://127.0.0.1:18080/files/tasks/v.mp4',
    });
    const res = await api.generateVideo({
      provider: { id: 'lovart' },
      prompt: 'a horse',
      model: 'video-model',
      size: '16:9',
      resolution: '1080p',
      seconds: 8,
      taskId: 'front-task-1',
    });
    expect(res).toEqual({ ok: true, url: 'http://127.0.0.1:18080/files/tasks/v.mp4' });
    const { intent, timeoutMs } = h.mockRelayGenerate.mock.calls[0][0];
    expect(intent.capability).toBe('video');
    expect(intent.size).toBe('16:9');
    expect(intent.resolution).toBe('1080p');
    expect(intent.duration).toBe('8');
    expect(intent.frontTaskId).toBe('front-task-1');
    // 【143 · S4′】同上：video 也不再有前端预算常量（原 `VIDEO_TIMEOUT` 已删）。
    expect(timeoutMs).toBeUndefined();
  });

  it('image 比例 Auto → size 不指定（undefined）', async () => {
    h.mockRelayGenerate.mockResolvedValue({ ok: true, url: 'http://x/y.png' });
    await api.generateImage({
      provider: { id: 'p1' },
      prompt: 'x',
      model: 'm',
      aspectRatio: 'Auto',
      size: '1K',
    });
    expect(h.mockRelayGenerate.mock.calls[0][0].intent.size).toBeUndefined();
  });

  it('video size=Auto → 不写 size；无 seconds → 不写 duration', async () => {
    h.mockRelayGenerate.mockResolvedValue({ ok: true, url: 'http://x/v.mp4' });
    await api.generateVideo({ provider: { id: 'p1' }, prompt: 'x', model: 'm', size: 'Auto' });
    const intent = h.mockRelayGenerate.mock.calls[0][0].intent;
    expect(intent.size).toBeUndefined();
    expect(intent.duration).toBeUndefined();
  });

  it('参考图（#3）：缩略图 URL 经 normalizeAssetUrlsForSend 还原后入 relayGenerate.images', async () => {
    vi.mocked(normalizeAssetUrlsForSend).mockResolvedValue(['http://ref/a.png']);
    h.mockRelayGenerate.mockResolvedValue({ ok: true, url: 'http://x/y.png' });
    await api.generateImage({
      provider: { id: 'p1' },
      prompt: 'x',
      model: 'm',
      images: ['blob:x'],
    });
    expect(normalizeAssetUrlsForSend).toHaveBeenCalledWith(['blob:x']);
    expect(h.mockRelayGenerate.mock.calls[0][0].intent.images).toEqual(['http://ref/a.png']);
  });

  it('image relay 返 error → {ok:false, error}', async () => {
    h.mockRelayGenerate.mockResolvedValue({ ok: false, error: '生成失败' });
    const res = await api.generateImage({ provider: { id: 'p1' }, prompt: 'x', model: 'm' });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('生成失败');
  });

  it('video relay 返 error → {ok:false, error}', async () => {
    h.mockRelayGenerate.mockResolvedValue({ ok: false, error: '生成失败' });
    const res = await api.generateVideo({ provider: { id: 'p1' }, prompt: 'x', model: 'm' });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('生成失败');
  });
});

describe('generate — abort 统一抛（修正 1 选 A + §4.2.1 铁律，#4）', () => {
  it('image 中止 → 抛 AbortError（L3c：判据是 name，不再依赖 message）', async () => {
    const err = new Error('Aborted');
    err.name = 'AbortError';
    h.mockRelayGenerate.mockRejectedValueOnce(err);
    await expect(
      api.generateImage({ provider: { id: 'p1' }, prompt: 'x', model: 'm' }),
    ).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('video 中止 → 抛 AbortError（原样上抛，不吞成信封）', async () => {
    const err = new Error('Aborted');
    err.name = 'AbortError';
    h.mockRelayGenerate.mockRejectedValue(err);
    await expect(
      api.generateVideo({ provider: { id: 'p1' }, prompt: 'x', model: 'm' }),
    ).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('chat 同步中止 → 仍返 {ok:false, aborted:true} 信封（不抛）', async () => {
    h.mockRelayChat.mockResolvedValue({ ok: false, aborted: true, error: '已停止' });
    const res = await api.chatCompletions({ provider: { id: 'p1' }, model: 'm', messages: [] });
    expect(res.ok).toBe(false);
    expect(res.aborted).toBe(true);
  });
});

describe('generate — chat 消息与透传（迁移自 chatApi）', () => {
  it('relay 返 content → {ok:true, content}', async () => {
    h.mockRelayChat.mockResolvedValue({ ok: true, content: '你好' });
    const res = await api.chatCompletions({
      provider: { id: 'lovart' },
      model: 'lovart-chat',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(res).toEqual({ ok: true, content: '你好' });
    const intent = h.mockRelayChat.mock.calls[0][0];
    expect(intent.providerId).toBe('lovart');
    expect(intent.model).toBe('lovart-chat');
    expect(intent.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('relay 返 error → {ok:false, error}', async () => {
    h.mockRelayChat.mockResolvedValue({ ok: false, error: '上游未返回文本内容' });
    const res = await api.chatCompletions({ provider: { id: 'p1' }, model: 'm', messages: [] });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('上游未返回文本内容');
  });

  it('temperature 与 responseFormat 透传 relayChat（json→json_object 归一）', async () => {
    h.mockRelayChat.mockResolvedValue({ ok: true, content: 'x' });
    await api.chatCompletions({
      provider: { id: 'p1' },
      model: 'm',
      messages: [],
      temperature: 0.7,
      responseFormat: 'json',
    });
    const opts = h.mockRelayChat.mock.calls[0][1];
    expect(opts.temperature).toBe(0.7);
    expect(opts.responseFormat).toBe('json_object');
  });

  it('无参考图 → 不调 normalizeAssetUrlsForSend，消息原样', async () => {
    h.mockRelayChat.mockResolvedValue({ ok: true, content: 'x' });
    await api.chatCompletions({
      provider: { id: 'p1' },
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(normalizeAssetUrlsForSend).not.toHaveBeenCalled();
    expect(h.mockRelayChat.mock.calls[0][0].messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('有参考图 → normalizeAssetUrlsForSend + 图片块追加到末条 user 消息', async () => {
    vi.mocked(normalizeAssetUrlsForSend).mockResolvedValue(['http://ref/x.png']);
    h.mockRelayChat.mockResolvedValue({ ok: true, content: 'x' });
    await api.chatCompletions({
      provider: { id: 'p1' },
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
      images: ['blob:q'],
    });
    expect(normalizeAssetUrlsForSend).toHaveBeenCalledWith(['blob:q']);
    const sent = h.mockRelayChat.mock.calls[0][0].messages;
    expect(sent).toHaveLength(1);
    expect(sent[0].content).toEqual([
      { type: 'text', text: 'hi' },
      { type: 'image_url', image_url: { url: 'http://ref/x.png' } },
    ]);
  });

  it('normalizeAssetUrlsForSend 返回空 → 不追加图片块，消息原样', async () => {
    h.mockRelayChat.mockResolvedValue({ ok: true, content: 'x' });
    await api.chatCompletions({
      provider: { id: 'p1' },
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
      images: ['http://x/a.png'],
    });
    const sent = h.mockRelayChat.mock.calls[0][0].messages;
    expect(sent[0].content).toBe('hi');
  });
});

describe('resolveImagePixel 查表（#7）', () => {
  it('Auto / 空 → 空串（不指定 size）', () => {
    expect(resolveImagePixel('Auto', '2K')).toBe('');
    expect(resolveImagePixel('auto', '1K')).toBe('');
    expect(resolveImagePixel('', '1K')).toBe('');
  });
  it('比例+档位 → 精确像素', () => {
    expect(resolveImagePixel('9:16', '2K')).toBe('1152x2048');
    expect(resolveImagePixel('16:9', '2K')).toBe('2048x1152');
    expect(resolveImagePixel('1:1', '4K')).toBe('2880x2880');
  });
  it('档位查不到 → 回退该比例 1K', () => {
    expect(resolveImagePixel('9:16', '8K')).toBe('880x1776');
  });
  it('比例未知 → 兜底 1024x1024', () => {
    expect(resolveImagePixel('99:1', '1K')).toBe('1024x1024');
  });
});

describe('barrel 契约（#8 · 2026-09-19 裁判裁定更新）', () => {
  it('base/api 桶不再导出生成门面（横切层禁指向业务域），门面改由 generate/lib/generate 提供', async () => {
    const barrel = await import('@/components/base/api/index.ts');
    // 内部 generate 实现仍不得从桶泄出
    expect((barrel as Record<string, unknown>).generate).toBeUndefined();
    // 生成链路 / AI 中继 4 件已整片迁 generate/lib（TASK-031 §四-A-11）：
    // 桶若 re-export 它们，横切层 base/api 就会反向依赖业务域 generate ⇒ 架构闸规则 2 报红。
    expect((barrel as Record<string, unknown>).generateImage).toBeUndefined();
    const gen = await import('@/components/generate/lib/generate.ts');
    expect(typeof gen.generateImage).toBe('function');
    expect(typeof gen.generateVideo).toBe('function');
    expect(typeof gen.chatCompletions).toBe('function');
  });
});

describe('别名函数共用 generate 实现（#10，防各自实现漂移）', () => {
  it('generateImage 的意图组装（比例→像素查表、参考图归一）只可能发生在 generate() 内', async () => {
    vi.mocked(normalizeAssetUrlsForSend).mockResolvedValue(['http://ref/a.png']);
    h.mockRelayGenerate.mockResolvedValue({ ok: true, url: 'http://x/y.png' });
    await api.generateImage({
      provider: { id: 'p1' },
      prompt: 'x',
      model: 'm',
      aspectRatio: '9:16',
      size: '2K',
      images: ['blob:x'],
    });
    const { intent } = h.mockRelayGenerate.mock.calls[0][0];
    expect(intent.size).toBe('1152x2048'); // 走 resolveImagePixel（仅 generate() 调用）
    expect(intent.images).toEqual(['http://ref/a.png']); // 走 normalizeAssetUrlsForSend（仅 generate() 调用）
  });
  it('generateVideo 时长转字符串只发生在 generate() 内；且**不再传 timeoutMs**（预算归后端 · S4′）', async () => {
    h.mockRelayGenerate.mockResolvedValue({ ok: true, url: 'http://x/v.mp4' });
    await api.generateVideo({ provider: { id: 'p1' }, prompt: 'x', model: 'm', seconds: 8 });
    const { intent, timeoutMs } = h.mockRelayGenerate.mock.calls[0][0];
    expect(intent.duration).toBe('8');
    expect(timeoutMs).toBeUndefined();
  });
  it('chatCompletions 走 relayChat 消息块组装只发生在 generate() 的 chat 分支', async () => {
    vi.mocked(normalizeAssetUrlsForSend).mockResolvedValue(['http://ref/x.png']);
    h.mockRelayChat.mockResolvedValue({ ok: true, content: 'x' });
    await api.chatCompletions({
      provider: { id: 'p1' },
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
      images: ['blob:q'],
    });
    const got = h.mockRelayChat.mock.calls[0][1];
    expect(got.timeoutMs).toBe(180000); // CHAT_TOTAL_TIMEOUT（任务总预算；S5′ 前误用段值 120s）
    const intent = h.mockRelayChat.mock.calls[0][0];
    expect(intent.capability).toBe('chat');
  });
});

describe('C1 结果信封单一真源（#L3c，弱锁，仅 type-check 生效）', () => {
  // 【T3】RelayGenerationResult / NodeGenerationResult 须与真源 GenerationResult 结构化相等（防字段漂移）。
  // ⚠️ 硬约束：assertVitest 默认不执行 expectTypeOf（project 无 test.typecheck）→ 此断言仅在
  //    `npm run type-check`（tsc -p tests/tsconfig.json）下报错。勿把「vitest 绿」当成类型断言通过。
  // ⚠️ 它挡不住「把别名改回逐字相同的独立 interface」（结构性 Equal 判定相等）——真锁靠 check-arch 规则 3（T4）。
  it('relay / node 信封与真源结构化相等', () => {
    expectTypeOf<RelayGenerationResult>().toEqualTypeOf<GenerationResult>();
    expectTypeOf<NodeGenerationResult>().toEqualTypeOf<GenerationResult>();
  });
});
