/**
 * videoEngine 单元测试（阶段一·算法与逻辑层）
 * 按 C1 可测性优先：WebCodecs/mediabunny 重环境不跑，只测纯逻辑剥离的：
 *  - ProgressController：取消状态、attach/attachOutput 的取消传播
 *  - ConversionCanceled：错误类型
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
// TD-22-2 探针：mock 落盘基座（uploadResult 的唯一 IO 依赖），驱动「成功 / 失败 / 异常」三分支。
// 契约（用户裁定·错误透传）：失败必须返 null 让消费方显式报错，禁止伪造临时 blob: URL 冒充成功。
vi.mock('../../src/components/base/api/filesApi.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  uploadFileToLocal: vi.fn(),
}));
import {
  ProgressController,
  ConversionCanceled,
  uploadResult,
} from '../../src/components/video/lib/videoEngine.ts';
import { uploadFileToLocal } from '../../src/components/base/api/filesApi.ts';

const mockUpload = vi.mocked(uploadFileToLocal);

describe('ConversionCanceled', () => {
  it('是 Error 子类且可携带信息', () => {
    const e = new ConversionCanceled('已取消');
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toBe('已取消');
  });
});

describe('ProgressController - 取消状态', () => {
  it('初始 isCanceled 为 false', () => {
    const c = new ProgressController();
    expect(c.isCanceled).toBe(false);
  });

  it('cancel() 后 isCanceled 为 true', async () => {
    const c = new ProgressController();
    await c.cancel();
    expect(c.isCanceled).toBe(true);
  });
});

describe('ProgressController - attach 取消传播', () => {
  it('attach 时若已取消则立即调用 conversion.cancel()', () => {
    const c = new ProgressController();
    const conv = { cancel: vi.fn() };
    c.canceled = true;
    c.attach(conv);
    expect(conv.cancel).toHaveBeenCalled();
  });

  it('attach 时未取消则不调用 cancel', () => {
    const c = new ProgressController();
    const conv = { cancel: vi.fn() };
    c.attach(conv);
    expect(conv.cancel).not.toHaveBeenCalled();
  });

  it('attachOutput 时若已取消则立即调用 output.cancel()', () => {
    const c = new ProgressController();
    const out = { cancel: vi.fn() };
    c.canceled = true;
    c.attachOutput(out);
    expect(out.cancel).toHaveBeenCalled();
  });

  it('cancel() 会 await conversion.cancel + output.cancel', async () => {
    const c = new ProgressController();
    const conv = { cancel: vi.fn(async () => 'c') };
    const out = { cancel: vi.fn(async () => 'o') };
    c.attach(conv);
    c.attachOutput(out);
    await c.cancel();
    expect(conv.cancel).toHaveBeenCalled();
    expect(out.cancel).toHaveBeenCalled();
    expect(c.isCanceled).toBe(true);
  });
});

describe('uploadResult - 落盘契约（TD-22-2 + 2026-09-17 判别联合：失败诚实报因，禁止伪造 blob: 冒充成功）', () => {
  beforeEach(() => {
    mockUpload.mockReset();
  });

  it('落盘成功 → 返回持久 /files/ URL', async () => {
    const persisted = 'http://127.0.0.1:18080/files/canvas/video-process/a.mp4';
    mockUpload.mockResolvedValue({ ok: true, url: persisted });
    const blob = new Blob(['x'], { type: 'video/mp4' });
    await expect(uploadResult(blob)).resolves.toEqual({ ok: true, url: persisted });
    expect(mockUpload).toHaveBeenCalledWith(blob, 'canvas/video-process', expect.any(String));
  });

  it('字符串输入（已是 URL）→ 原样返回，不触发上传', async () => {
    await expect(uploadResult('/files/already.mp4')).resolves.toEqual({
      ok: true,
      url: '/files/already.mp4',
    });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('落盘失败（基座返 ok:false）→ **转发生产者判词**（不再压成 null）', async () => {
    mockUpload.mockResolvedValue({ ok: false, message: '本地服务未启动' });
    await expect(uploadResult(new Blob(['x'], { type: 'video/mp4' }))).resolves.toEqual({
      ok: false,
      message: '本地服务未启动',
    });
  });

  it('基座抛异常 → 本层**不吞**（2026-09-17 取消自造 try/catch，异常向上抛给调用方）', async () => {
    mockUpload.mockRejectedValue(new Error('network down'));
    await expect(uploadResult(new Blob(['x'], { type: 'video/mp4' }))).rejects.toThrow(
      'network down',
    );
  });
});
