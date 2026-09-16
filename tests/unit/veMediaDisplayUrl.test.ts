/**
 * 回归锁：素材「缩略图 / 预览格子」显示地址的唯一入口（TD-22-52 · 2026-09-16）。
 *
 * 契约：
 *   ① 已落盘（有 `persistentUrl`）→ **必须**过统一 render 出口
 *      （服务端按需出小图 + 尊重 `thumbnailOn` 开关）；
 *   ② 未落盘（ephemeral / 上传中 / 后端离线）→ **回退 `url`（blob:）**，
 *      且**绝不把 blob: 交给 render 出口** —— `buildThumbnailUrl` 对非 `/files/` 输入原样返回，
 *      交过去等于"没接还写了接的代码"（假象）；
 *   ③ 两者皆无 → 空串（`<img src="">`，不破图也不 404）。
 *
 * 【为什么必须断言"传给 resolve 的是什么"】本债的原状正是「显示裸用 blob: 全分辨率」——
 * 只断言"返回了非空字符串"**测不出问题**（blob: 也是非空字符串）。必须锁死**输入源**。
 */
import { describe, expect, it, vi } from 'vitest';
import { mediaDisplayUrl } from '../../src/components/videoEditor/lib/mediaDisplayUrl';

/** 只造本用例需要的字段（其余用不到；`as never` 避开 MediaAsset 全形状）。 */
const asset = (over: Record<string, unknown> = {}) =>
  ({ id: 'a1', name: 'x.png', type: 'image', file: {}, ...over }) as never;

describe('mediaDisplayUrl · 素材显示地址唯一入口（TD-22-52）', () => {
  it('已落盘（有 persistentUrl）→ 过统一出口；输入必须是 /files/ 持久地址，而不是 blob:', () => {
    const resolve = vi.fn((u: string) => `THUMB(${u})`);
    const out = mediaDisplayUrl({
      asset: asset({ persistentUrl: '/files/videoEditor/x.png', url: 'blob:http://x/1' }),
      resolve,
    });

    expect(resolve).toHaveBeenCalledWith('/files/videoEditor/x.png', undefined);
    expect(out).toBe('THUMB(/files/videoEditor/x.png)');
  });

  it('maxDim 透传（网格走小图）', () => {
    const resolve = vi.fn((u: string) => u);
    mediaDisplayUrl({ asset: asset({ persistentUrl: '/files/a.png' }), resolve, maxDim: 320 });

    expect(resolve).toHaveBeenCalledWith('/files/a.png', { maxDim: 320 });
  });

  it('未落盘（ephemeral / 上传中 / 后端离线）→ 回退 blob:，且**不调** resolve', () => {
    const resolve = vi.fn((u: string) => u);
    const out = mediaDisplayUrl({ asset: asset({ url: 'blob:http://x/2' }), resolve });

    expect(resolve).not.toHaveBeenCalled();
    expect(out).toBe('blob:http://x/2');
  });

  it('两者皆无 → 空串（不破图、不 404）', () => {
    const resolve = vi.fn((u: string) => u);
    expect(mediaDisplayUrl({ asset: asset(), resolve })).toBe('');
    expect(resolve).not.toHaveBeenCalled();
  });
});
