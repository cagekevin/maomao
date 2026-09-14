import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 素材解析 + 探测缓存（`docs/120` C3.2 / C13）。
 *
 * 这层是「入轨能不能拿到时长」「断链红标准不准」「导出会不会重复下载」的共同底座，
 * 且全部是**纯逻辑**（fetch + 一次探测），与环境无关 —— 故必须自动测。
 * 真实媒体解码（mediabunny）在此无关紧要，按契约打桩。
 */
vi.mock('../../../src/components/base/utils/videoEngine.ts', () => ({
  probeMediaTrack: vi.fn(),
}));

import { probeMediaTrack } from '../../../src/components/base/utils/videoEngine.ts';
import {
  loadEditorSource,
  readSourceBlob,
} from '../../../src/components/videoEditor/hooks/useEditorSources.ts';

const probeMock = vi.mocked(probeMediaTrack);

function okResponse(): Response {
  return {
    ok: true,
    status: 200,
    blob: async () => new Blob(['media']),
  } as unknown as Response;
}

beforeEach(() => {
  probeMock.mockReset();
  vi.unstubAllGlobals();
});

describe('loadEditorSource —— 探测缓存（docs/120 C3.2）', () => {
  it('同一 URL 只下载 / 探测一次（同源片段是常态，不该重复拉 4K 源）', async () => {
    const fetchMock = vi.fn(async () => okResponse());
    vi.stubGlobal('fetch', fetchMock);
    probeMock.mockResolvedValue({ status: 'ok', width: 1920, height: 1080, duration: 12.5 });

    const a = await loadEditorSource('/files/same.mp4', 'video');
    const b = await loadEditorSource('/files/same.mp4', 'video');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(probeMock).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);
    expect(a.source.duration).toBe(12.5);
    expect(a.source.profile?.width).toBe(1920);
    expect(a.source.profile?.height).toBe(1080);
    // 空 `Blob.type` 取 `undefined` 而不是 `''`：`''` 会被下游当成"测到了空编码"（假事实）
    expect(a.source.profile?.mimeType).toBeUndefined();
  });

  it('探测失败 → 断链（带原因），且**不留在缓存里**（一次网络抖动不该永久生效）', async () => {
    const fetchMock = vi.fn(async () => okResponse());
    vi.stubGlobal('fetch', fetchMock);
    probeMock.mockResolvedValue({ status: 'failed', reason: '无法识别媒体格式' });

    const first = await loadEditorSource('/files/retry.mp4', 'video');
    expect(first.source.resolved).toEqual({ status: 'broken', reason: '无法识别媒体格式' });

    // 缓存已清 → 第二次真的重试（`then` 里清缓存是异步的，等一下微任务）
    await Promise.resolve();
    await Promise.resolve();
    const second = await loadEditorSource('/files/retry.mp4', 'video');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(second.source.resolved.status).toBe('broken');
  });

  it('HTTP 不可读 → 断链（不吞错、不返回空 url）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404 }) as unknown as Response),
    );
    const out = await loadEditorSource('/files/missing.mp4', 'video');
    expect(out.source.resolved).toEqual({ status: 'broken', reason: 'HTTP 404' });
    // 没有字节可给导出用
    expect(out.blob).toBeNull();
  });

  it('图片没有「时长」概念 → 用默认图片时长落轨（C11.6）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => okResponse()),
    );
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 800, height: 600, close: () => undefined })),
    );

    const out = await loadEditorSource('/files/pic.png', 'image');
    expect(out.source.resolved).toEqual({ status: 'ok', url: '/files/pic.png' });
    expect(out.source.profile?.width).toBe(800);
    expect(out.source.profile?.height).toBe(600);
    expect(out.source.duration).toBe(3); // DEFAULT_IMAGE_CLIP_DURATION
    // 图片不该走 mediabunny 探测
    expect(probeMock).not.toHaveBeenCalled();
  });
});

describe('readSourceBlob —— 导出复用探测阶段读到的字节', () => {
  it('命中探测缓存 → 不再下载第二遍（一个 4K 源不该被拉两次）', async () => {
    const fetchMock = vi.fn(async () => okResponse());
    vi.stubGlobal('fetch', fetchMock);
    probeMock.mockResolvedValue({ status: 'ok', duration: 4 });

    const blob = await readSourceBlob('/files/once.mp4', 'video');
    expect(blob.size).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('探测已失败 → 明确报错（不返回空 Blob 让导出产出坏文件）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => okResponse()),
    );
    probeMock.mockResolvedValue({ status: 'failed', reason: '格式不支持' });
    await expect(readSourceBlob('/files/never.mp4', 'video')).rejects.toThrow(/探测阶段已失败/);
  });
});
