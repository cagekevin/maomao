/**
 * linkMediaRefsToProject（docs/136 §9.3 · 路线 A）单测。
 *
 * 覆盖：
 *  - normalizeFileUrl：去 API_BASE 前缀 / query / hash（去重判据的归一化）
 *  - 双轨去重：contentId 命中 或 归一化 url 命中 → skipped（不重复登记）
 *  - 成功登记：走 addMediaAsset，且**传入 persistentUrl**（⇒ saveMediaAsset 跳过上传）
 *  - 部分失败：失败如实进 failures，已成功的仍在 linked（不丢）
 *  - 大小上限：超限 → 进 failures（不 OOM）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizeFileUrl,
  linkMediaRefsToProject,
  LINK_MAX_BYTES,
} from '../../src/components/videoEditor/ui/editor/panels/assets/link-media-refs';
import type { MediaRef } from '../../src/components/base/media/mediaRefTypes';
import type { MediaAsset } from '../../src/components/videoEditor/types/mediaAssets';

const mkRef = (over: Partial<MediaRef> = {}): MediaRef => ({
  ref: 'canvas:n1',
  source: 'canvas',
  name: 'a.png',
  type: 'image',
  url: 'http://127.0.0.1:18080/files/a.png',
  ...over,
});

/** 最小的 media 桩（getAssets / addMediaAsset）。 */
function mkMedia(existing: MediaAsset[] = []) {
  const added: Array<Omit<MediaAsset, 'id'>> = [];
  return {
    added,
    getAssets: () => existing,
    addMediaAsset: vi.fn(
      async ({ asset }: { projectId: string; asset: Omit<MediaAsset, 'id'> }) => {
        added.push(asset);
        const full = { ...asset, id: `m${added.length}` } as MediaAsset;
        existing.push(full);
        return { ok: true as const, id: full.id, asset: full };
      },
    ),
  };
}

describe('normalizeFileUrl：去重判据归一化', () => {
  it('去协议+主机 / query / hash，统一为 path', () => {
    expect(normalizeFileUrl('http://127.0.0.1:18080/files/a.png')).toBe('/files/a.png');
    expect(normalizeFileUrl('/files/a.png')).toBe('/files/a.png');
    expect(normalizeFileUrl('/files/a.png?token=1')).toBe('/files/a.png');
    expect(normalizeFileUrl('/files/a.png#x')).toBe('/files/a.png');
    expect(normalizeFileUrl('')).toBe('');
    expect(normalizeFileUrl(null)).toBe('');
  });

  it('★画布侧（绝对）与素材库侧（相对）归一后相等 —— 这正是去重生效的前提', () => {
    expect(normalizeFileUrl('http://127.0.0.1:18080/files/a.png')).toBe(
      normalizeFileUrl('/files/a.png'),
    );
  });
});

describe('linkMediaRefsToProject：登记引用（不上传）', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn(async () => {
      const blob = new Blob(['x'], { type: 'image/png' });
      // 小体积：未超上限
      return { ok: true, status: 200, blob: async () => blob } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('成功登记：传入 persistentUrl（⇒ 上层 saveMediaAsset 走引用分支，跳过上传）', async () => {
    const media = mkMedia();
    const res = await linkMediaRefsToProject({
      items: [mkRef()],
      projectId: 'p1',
      media,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.linked).toHaveLength(1);
      expect(res.skipped).toHaveLength(0);
    }
    expect(media.added).toHaveLength(1);
    expect(media.added[0].persistentUrl).toBe('http://127.0.0.1:18080/files/a.png');
  });

  it('双轨去重 · 轨 2（归一化 url）：已存在同 url → skipped，不重复登记', async () => {
    const existing = [{ id: 'm0', persistentUrl: '/files/a.png' } as unknown as MediaAsset];
    const media = mkMedia(existing);
    const res = await linkMediaRefsToProject({
      items: [mkRef()], // 绝对 url，归一化后 == /files/a.png
      projectId: 'p1',
      media,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.linked).toHaveLength(0);
      expect(res.skipped).toHaveLength(1);
    }
    expect(media.addMediaAsset).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled(); // 去重命中 → 连 File 都不用取
  });

  it('双轨去重 · 轨 1（contentId）：contentId 命中即 skipped（url 不同也算同一份）', async () => {
    const existing = [
      {
        id: 'm0',
        contentId: 'sha1:abc',
        persistentUrl: '/files/other.png',
      } as unknown as MediaAsset,
    ];
    const media = mkMedia(existing);
    const res = await linkMediaRefsToProject({
      items: [mkRef({ contentId: 'sha1:abc', url: '/files/a.png' })],
      projectId: 'p1',
      media,
    });

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.skipped).toHaveLength(1);
    expect(media.addMediaAsset).not.toHaveBeenCalled();
  });

  it('部分失败：一个取不到（fetch 404），另一个照常登记（不丢）', async () => {
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes('bad')) return { ok: false, status: 404 } as unknown as Response;
      const blob = new Blob(['x'], { type: 'image/png' });
      return { ok: true, status: 200, blob: async () => blob } as unknown as Response;
    });

    const media = mkMedia();
    const res = await linkMediaRefsToProject({
      items: [mkRef(), mkRef({ ref: 'canvas:n2', url: '/files/bad.png', name: 'bad.png' })],
      projectId: 'p1',
      media,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.linked).toHaveLength(1);
      expect(res.failures).toHaveLength(1);
      expect(res.failures[0].ref).toBe('canvas:n2');
    }
  });

  it('大小上限：超 LINK_MAX_BYTES → failures（不把大 blob 塞进内存）', async () => {
    fetchSpy.mockImplementation(async () => {
      const big = new Blob([new Uint8Array(LINK_MAX_BYTES + 1)], { type: 'video/mp4' });
      return { ok: true, status: 200, blob: async () => big } as unknown as Response;
    });

    const media = mkMedia();
    const res = await linkMediaRefsToProject({
      items: [mkRef({ type: 'video', url: '/files/big.mp4' })],
      projectId: 'p1',
      media,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.failures).toHaveLength(1);
      expect(res.failures[0].message).toContain('上限');
    }
    expect(media.addMediaAsset).not.toHaveBeenCalled();
  });
});
