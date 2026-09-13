import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/components/base/core/contentStore.ts', () => ({
  contentGetAsync: vi.fn(),
  contentKvGetVersion: vi.fn(),
  contentKvSetCas: vi.fn(),
}));

import { HttpError } from '../../../src/components/base/api/httpClient.ts';
import {
  contentGetAsync,
  contentKvGetVersion,
  contentKvSetCas,
} from '../../../src/components/base/core/contentStore.ts';
import { createEmptyProject } from '../../../src/components/videoEditor/core/normalize.ts';
import {
  loadProject,
  projectStorageKey,
  saveProject,
} from '../../../src/components/videoEditor/data/projectRepository.ts';

const getAsync = vi.mocked(contentGetAsync);
const getVersion = vi.mocked(contentKvGetVersion);
const setCas = vi.mocked(contentKvSetCas);

const record = () => ({ schemaVersion: 1, fps: 30, playhead: 0, tracks: [] });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('projectStorageKey', () => {
  it('键 = 登记表前缀 + projectId（与 contracts 同源，不手写字面量）', () => {
    expect(projectStorageKey('abc')).toBe('video-editor-project-abc');
  });
});

describe('loadProject', () => {
  it('键不存在 → none（合法状态，不是失败）', async () => {
    getVersion.mockResolvedValue(0);
    getAsync.mockResolvedValue(undefined);
    const r = await loadProject('p1');
    expect(r.status).toBe('none');
    if (r.status === 'none') expect(r.reason).toContain('从未落盘');
  });

  it('合法记录 → ok，并带上 CAS 基线版本', async () => {
    getVersion.mockResolvedValue(3);
    getAsync.mockResolvedValue(record());
    const r = await loadProject('p1');
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.version).toBe(3);
      expect(r.project.tracks).toEqual([]);
    }
    expect(getAsync).toHaveBeenCalledTimes(1);
  });

  it('结构损坏 → 按「无工程」处理（不按缺字段渲染），原因保留', async () => {
    getVersion.mockResolvedValue(1);
    getAsync.mockResolvedValue({ tracks: [] }); // 缺 schemaVersion
    const r = await loadProject('p1');
    expect(r.status).toBe('none');
    if (r.status === 'none') expect(r.reason).toContain('schemaVersion');
  });

  it('读取期间版本漂移 → 重读内容，保证「内容与版本配成一对」', async () => {
    getVersion.mockResolvedValueOnce(1).mockResolvedValueOnce(2).mockResolvedValue(2);
    getAsync.mockResolvedValueOnce({ ...record(), playhead: 1 }).mockResolvedValueOnce({
      ...record(),
      playhead: 2,
    });
    const r = await loadProject('p1');
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.version).toBe(2);
      expect(r.project.playhead).toBe(2);
    }
    expect(getAsync).toHaveBeenCalledTimes(2);
  });
});

describe('saveProject · 唯一写者 + CAS（不静默覆盖）', () => {
  it('正常写：把 ifVersion 交给服务端裁决，成功后返回新版本作为基线', async () => {
    setCas.mockResolvedValue({ landed: 'kv', version: 7 });
    const project = createEmptyProject();
    const r = await saveProject('p1', project, { ifVersion: 3 });
    expect(setCas).toHaveBeenCalledWith('video-editor-project-p1', project, { ifVersion: 3 });
    expect(r).toEqual({ status: 'ok', version: 7 });
  });

  it('409 → conflict（本次一个字节未写），调用方可据此提示冲突', async () => {
    setCas.mockRejectedValue(new HttpError(409, 'version conflict'));
    const r = await saveProject('p1', createEmptyProject(), { ifVersion: 3 });
    expect(r).toEqual({ status: 'conflict', expected: 3 });
  });

  it('force 显式覆盖：不带 ifVersion（服务端仍自增版本）', async () => {
    setCas.mockResolvedValue({ landed: 'kv', version: 9 });
    await saveProject('p1', createEmptyProject(), { force: true });
    expect(setCas).toHaveBeenCalledWith('video-editor-project-p1', expect.anything(), {});
  });

  it('非 409 错误原样上抛（不重分类、不静默吞）', async () => {
    setCas.mockRejectedValue(new HttpError(500, 'server boom'));
    await expect(saveProject('p1', createEmptyProject(), { force: true })).rejects.toThrow(
      'server boom',
    );
  });
});

describe('体积红线（docs/120 C2.5）：工程记录只存元数据与 URL', () => {
  it('序列化产物不含内联 base64 / data: URL', () => {
    const p = createEmptyProject();
    p.tracks[0].clips.push({
      id: 'c1',
      kind: 'video',
      sourceStart: 0,
      sourceEnd: 2,
      timelineStart: 0,
      sourceUrl: '/files/canvas/video-editor/a.mp4',
    });
    const text = JSON.stringify(p);
    expect(text).not.toContain('data:');
    expect(text).not.toContain('base64');
  });
});
