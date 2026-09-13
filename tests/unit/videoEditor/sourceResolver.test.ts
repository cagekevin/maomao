import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/components/base/store/resourceStore.ts', () => ({
  getResources: vi.fn(() => []),
}));

import { getResources } from '../../../src/components/base/store/resourceStore.ts';
import { resolveClipSource } from '../../../src/components/videoEditor/data/sourceResolver.ts';

const resources = vi.mocked(getResources);

beforeEach(() => {
  resources.mockReturnValue([]);
});

describe('resolveClipSource · 三源归一（docs/120 C3）', () => {
  it('sourceUrl 优先，且补全为可访问的绝对地址', () => {
    resources.mockReturnValue([
      { id: 'a1', folder: 'f', type: 'video', name: 'r', url: '/files/other.mp4', size: 0, ts: 0 },
    ]);
    const r = resolveClipSource({ sourceUrl: '/files/canvas/video-editor/a.mp4', assetId: 'a1' });
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.url).toContain('/files/canvas/video-editor/a.mp4');
      expect(r.url).not.toContain('other.mp4');
    }
  });

  it('sourceUrl 空 → 经素材库记录解析 assetId（不是裸拼路径）', () => {
    resources.mockReturnValue([
      {
        id: 'lib-1',
        folder: 'f',
        type: 'video',
        name: 'r',
        url: '/files/lib/x.mp4',
        size: 0,
        ts: 0,
      },
    ]);
    const r = resolveClipSource({ assetId: 'lib-1' });
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(r.url).toContain('/files/lib/x.mp4');
  });

  it('两者皆不可用 → 断链，且原因可读（供 tooltip / 日志）', () => {
    const r = resolveClipSource({});
    expect(r.status).toBe('broken');
    if (r.status === 'broken') expect(r.reason).toContain('没有素材来源');
  });

  it('assetId 在素材库里查不到 → 断链（带 assetId，便于定位）', () => {
    const r = resolveClipSource({ assetId: 'ghost' });
    expect(r.status).toBe('broken');
    if (r.status === 'broken') expect(r.reason).toContain('ghost');
  });
});

describe('resolveClipSource · 断链的第二个触发点（探测失败）', () => {
  it('结构上能解析、但探测失败 → 仍判断链（同一个裁决点）', () => {
    const r = resolveClipSource(
      { sourceUrl: '/files/a.mp4' },
      { status: 'failed', reason: 'HTTP 404' },
    );
    expect(r.status).toBe('broken');
    if (r.status === 'broken') expect(r.reason).toContain('HTTP 404');
  });

  it('探测成功 / 未探测 → 按结构判定结果返回', () => {
    expect(resolveClipSource({ sourceUrl: '/files/a.mp4' }, { status: 'ok' }).status).toBe('ok');
    expect(resolveClipSource({ sourceUrl: '/files/a.mp4' }).status).toBe('ok');
  });
});

describe('resolveClipSource · nodeId 不参与寻址（docs/123 §一.2 R2 / §一.9 Q5）', () => {
  it('来源画布节点消失（只有 nodeId）不构成断链以外的额外判定：仍按 sourceUrl 可读', () => {
    const r = resolveClipSource({ sourceUrl: '/files/a.mp4', nodeId: '已删除的节点' });
    expect(r.status).toBe('ok');
  });

  it('只有 nodeId（无 sourceUrl/assetId）→ 断链，且原因不提"节点消失"（节点只是溯源）', () => {
    const r = resolveClipSource({ nodeId: 'n1' });
    expect(r.status).toBe('broken');
    if (r.status === 'broken') expect(r.reason).not.toContain('节点');
  });
});

describe('resolveClipSource · 不用 render 出图端点（原文件语义）', () => {
  it('本地文件返回原文件地址，而不是 /files/thumbnail?…（视频经出图端点会静默拿错结果）', () => {
    const r = resolveClipSource({ sourceUrl: '/files/canvas/video-editor/a.mp4' });
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(r.url).not.toContain('thumbnail');
  });
});
