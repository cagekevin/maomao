/**
 * externalizeInlineData 单测（内联资源外置纯函数）。
 * 策略：注入 mock save，验证遍历/替换/计数/失败保留，不依赖真实落盘。
 */
import { describe, it, expect, vi } from 'vitest';
import { externalizeInlineData } from '../../src/components/base/utils/net/externalizeInline.ts';

// 本地对齐 externalizeInline.ExternalizeDeps（未导出）。
// 【2026-09-17】save 契约已改为**判别联合**（含生产者 message），本测试同步为结构等价的最小形状。
type ExternalizeDeps = {
  save: (dataUrl: string) => Promise<{ ok: boolean; url?: string; message?: string }>;
};

describe('externalizeInlineData — 内联资源外置', () => {
  it('缺少 save 依赖抛错', async () => {
    await expect(
      externalizeInlineData(
        {} as unknown as Record<string, unknown>,
        {} as unknown as ExternalizeDeps,
      ),
    ).rejects.toThrow('save');
  });

  it('转换成功：data: 字段被 URL 替换，converted=1 failed=0', async () => {
    const save = vi
      .fn()
      .mockResolvedValue({ ok: true, url: 'http://localhost/files/canvas/abc.png' });
    const r = await externalizeInlineData({ assetUrl: 'data:image/png;base64,xxx' }, { save });
    expect(save).toHaveBeenCalledWith('data:image/png;base64,xxx');
    expect(r.data.assetUrl).toBe('http://localhost/files/canvas/abc.png');
    expect(r.converted).toBe(1);
    expect(r.failed).toBe(0);
  });

  it('落盘失败（save 返 ok:false）：字段保留原 base64，failed=1，且**原因进 failures**', async () => {
    const save = vi.fn().mockResolvedValue({ ok: false, message: '本地服务未启动' });
    const dataUrl = 'data:image/png;base64,keepme';
    const r = await externalizeInlineData({ url: dataUrl }, { save });
    expect(r.data.url).toBe(dataUrl); // 保留原图
    expect(r.converted).toBe(0);
    expect(r.failed).toBe(1);
    // 【2026-09-17 新增】失败原因**不再被吞**（原来只剩一个数字，用户与开发者都得不到原因）。
    expect(r.failures).toEqual([{ key: 'url', message: '本地服务未启动' }]);
  });

  it('落盘返回原值（save ok:true 但 url === 输入）：视为失败，保留原值 failed=1', async () => {
    const dataUrl = 'data:image/png;base64,xyz';
    const save = vi.fn().mockResolvedValue({ ok: true, url: dataUrl });
    const r = await externalizeInlineData({ url: dataUrl }, { save });
    expect(r.data.url).toBe(dataUrl);
    expect(r.failed).toBe(1);
  });

  it('递归数组（images[] 内为对象 {url:dataURL}）：逐个转换，计数累加', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true, url: 'http://x/1.png' });
    const r = await externalizeInlineData(
      { images: [{ url: 'data:image/png;base64,1' }, { url: 'data:image/png;base64,2' }] },
      { save },
    );
    expect(save).toHaveBeenCalledTimes(2);
    expect(r.data.images).toEqual([{ url: 'http://x/1.png' }, { url: 'http://x/1.png' }]);
    expect(r.converted).toBe(2);
  });

  it('非 data: 字段（http/数值/普通字符串）原样保留，不计数', async () => {
    const save = vi.fn();
    const r = await externalizeInlineData(
      { url: 'http://x/y.png', size: 100, label: 'hi', flag: true },
      { save },
    );
    expect(save).not.toHaveBeenCalled();
    expect(r.data).toEqual({ url: 'http://x/y.png', size: 100, label: 'hi', flag: true });
    expect(r.converted).toBe(0);
    expect(r.failed).toBe(0);
  });

  it('无内联资源：data 结构不变，converted=0 failed=0', async () => {
    const save = vi.fn();
    const src = { a: { b: 'plain' } };
    const r = await externalizeInlineData(src, { save });
    expect(r.data).toEqual(src);
    expect(r.converted).toBe(0);
    expect(r.failed).toBe(0);
    expect(save).not.toHaveBeenCalled();
  });

  it('嵌套对象深处也能替换', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true, url: 'http://x/deep.png' });
    const r = await externalizeInlineData(
      { level: { nested: { poster: 'data:image/jpeg;base64,deep' } } },
      { save },
    );
    expect(
      (r.data as unknown as { level: { nested: { poster: string } } }).level.nested.poster,
    ).toBe('http://x/deep.png');
    expect(r.converted).toBe(1);
  });
});
