/**
 * assetsMove 单元测试（阶段三·算法与逻辑层）
 * 覆盖：moveFile 端点透传、canMoveAsset 边界、resolveMovePaths 相对路径推导。
 * fetch 全部 mock。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { API_BASE } from '../../src/components/base/core/config.ts';
import {
  moveFile,
  canMoveAsset,
  resolveMovePaths,
  relativePathFromUrl,
} from '@/components/base/api/filesApi.ts';

/**
 * 一次性 fetch mock。
 *
 * 【为什么必须显式声明参数元组】`vi.fn(async () => res)` 的泛型会被推断成空元组 `[]`，
 * 于是 `fetchMock.mock.calls[0]` 解构出的 `[url, init]` 双双报 TS2493 / TS18048。
 * 写成 `(..._args: unknown[])` 后 calls 元素类型为 unknown[]，断言处用 as unknown as 收窄即可正常访问。
 */
function mockFetchOnce(body: any, { ok = true, status = 200 } = {}) {
  const res = { ok, status, json: async () => body, text: async () => JSON.stringify(body) };
  const fetchMock = vi.fn(async (..._args: unknown[]) => res);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('moveFile', () => {
  it('POST /api/files/move，body 传相对 uploadDir 的 src/dst，且不重试', async () => {
    const fetchMock = mockFetchOnce({ code: 0, data: { ok: true } });
    const r = await moveFile('migrated/a.png', 'migrated/主题/a.png');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];
    expect(url).toBe(`${API_BASE}/api/files/move`);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ src: 'migrated/a.png', dst: 'migrated/主题/a.png' });
    expect(r).toEqual({ code: 0, data: { ok: true } });
  });

  it('非 2xx 抛 HttpError 且透传后端业务 message（不回退误报）', async () => {
    mockFetchOnce({ error: '目标文件已存在' }, { ok: false, status: 409 });
    await expect(moveFile('a.png', 'b/a.png')).rejects.toMatchObject({
      name: 'HttpError',
      status: 409,
      message: '目标文件已存在',
    });
  });
});

describe('canMoveAsset', () => {
  it('local-tool + 非文件夹 → 可移动', () => {
    expect(canMoveAsset({ source: 'local-tool', type: 'image' })).toBe(true);
  });

  it('文件夹 → 不可移动', () => {
    expect(canMoveAsset({ source: 'local-tool', type: 'folder' })).toBe(false);
  });

  it('远程/收藏（非 local-tool）→ 不可移动', () => {
    expect(canMoveAsset({ source: 'remote', type: 'image' })).toBe(false);
    expect(canMoveAsset({ source: undefined, type: 'image' })).toBe(false);
  });
});

describe('resolveMovePaths', () => {
  it('子目录资源 → src=源folder/name，dst=目标/name，非同一目录', () => {
    const { src, dst, sameDir } = resolveMovePaths(
      { folder: 'migrated/人物', name: 'a.png' },
      'migrated/人物/主题A',
    );
    expect(src).toBe('migrated/人物/a.png');
    expect(dst).toBe('migrated/人物/主题A/a.png');
    expect(sameDir).toBe(false);
  });

  it('目标与源同目录 → sameDir=true（dst 仍拼出，由调用方拦截）', () => {
    const { src, dst, sameDir } = resolveMovePaths({ folder: 'tasks', name: 'a.png' }, 'tasks');
    expect(sameDir).toBe(true);
    expect(src).toBe('tasks/a.png');
    expect(dst).toBe('tasks/a.png');
  });

  it('顶层（folder 为空）→ src=name，非同一目录', () => {
    const { src, sameDir } = resolveMovePaths({ folder: '', name: 'x.png' }, 'x');
    expect(src).toBe('x.png');
    expect(sameDir).toBe(false);
  });

  // ── TD-12-8：磁盘定位真源 = 不可变 url（优先于可变的 UI folder/name）──

  it('有 url → src/dst 由 url 派生（忽略与磁盘脱钩的 UI folder/name）', () => {
    // 场景：素材已归类到「人物」（UI folder=migrated/人物），但磁盘仍在 migrated/ 下（context-only 不动磁盘）
    const item = {
      folder: 'migrated/人物',
      name: '新名字.png',
      url: 'http://127.0.0.1:18080/files/migrated/a.png',
    };
    const { src, dst, sameDir } = resolveMovePaths(item, 'migrated/场景');
    expect(src).toBe('migrated/a.png'); // 磁盘真源，不是 UI 的 migrated/人物/新名字.png
    expect(dst).toBe('migrated/场景/a.png'); // 磁盘文件名 a.png，不是 UI 显示名 新名字.png
    expect(sameDir).toBe(false);
  });

  it('有 url 且 url 含中文/空格 → 解码正确（encodeURI 往返）', () => {
    const item = {
      folder: 'migrated',
      name: '角色.png',
      url: `http://127.0.0.1:18080/files/${encodeURI('migrated/角色 图.png')}`,
    };
    const { src } = resolveMovePaths(item, 'migrated/人物');
    expect(src).toBe('migrated/角色 图.png');
  });

  it('有 url 但非 /files/ 形态（远程图）→ 回退 UI folder/name 口径', () => {
    const { src } = resolveMovePaths(
      { folder: 'migrated', name: 'a.png', url: 'https://example.com/x.png' },
      'migrated/人物',
    );
    expect(src).toBe('migrated/a.png'); // 非本地磁盘 url → 退回旧口径
  });
});

describe('relativePathFromUrl', () => {
  it('去 /files/ 前缀 + 解码 + 保留子目录', () => {
    expect(relativePathFromUrl('http://127.0.0.1:18080/files/migrated/a.png')).toBe(
      'migrated/a.png',
    );
    expect(relativePathFromUrl(`http://127.0.0.1:18080/files/${encodeURI('人物/图 1.png')}`)).toBe(
      '人物/图 1.png',
    );
  });
  it('非 /files/ 或非法 → null', () => {
    expect(relativePathFromUrl('https://example.com/x.png')).toBeNull();
    expect(relativePathFromUrl('/files/')).toBeNull();
    expect(relativePathFromUrl('')).toBeNull();
  });
});
