// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FOLDERS,
  detectAssetType,
  filterByFolder,
  addResources,
  buildResourceRecord,
  resourcesOfProject,
  removeResource,
  clearResources,
  __resetForTest,
  getResources,
  flushPersist,
  safeResourceBase,
  mergeResourcesFromBackend,
  sendToResourceLibrary,
} from '../../src/components/base/store/resourceStore.ts';
import { saveInlineToLocal } from '../../src/components/base/api/filesApi.ts';
import { rescanResources } from '../../src/components/base/api/localToolApi.ts';

// ── TD-12-2：落盘链隔离（sendToResourceLibrary 会异步调 filesApi + rescanResources）──
vi.mock('../../src/components/base/api/filesApi.ts', () => ({
  saveInlineToLocal: vi.fn(async () => 'http://127.0.0.1:18080/files/migrated/recon.png'),
  uploadFileToLocal: vi.fn(async () => 'http://127.0.0.1:18080/files/migrated/recon.png'),
  EXT_BY_TYPE: { image: 'png', video: 'mp4', audio: 'mp3', text: 'txt' },
}));
vi.mock('../../src/components/base/api/localToolApi.ts', () => ({
  rescanResources: vi.fn(async () => ({ ok: true })),
}));

const STORAGE_KEY = 'yimao:yimao_asset_library'; // storageAdapter 对键加 yimao: 前缀

beforeEach(() => {
  clearResources();
  localStorage.clear();
  __resetForTest(); // 重新 seed 默认素材（测试出口；生产侧 reloadFromStorage 由 onStorageReady 调用）
});

describe('素材库数据层 §2.18', () => {
  it('FOLDERS 配置含 6 个目录（all/generated/character/scene/prop/migrated）', () => {
    expect(FOLDERS).toHaveLength(6);
    expect(FOLDERS.map((f) => f.key)).toEqual([
      'all',
      'generated',
      'character',
      'scene',
      'prop',
      'migrated',
    ]);
  });

  it('detectAssetType 按 mime/扩展名分类', () => {
    expect(detectAssetType({ type: 'image/png', name: 'a.png' })).toBe('image');
    expect(detectAssetType({ type: 'video/mp4', name: 'a.mp4' })).toBe('video');
    expect(detectAssetType({ type: 'audio/mpeg', name: 'a.mp3' })).toBe('audio');
    expect(detectAssetType({ type: 'text/plain', name: 'a.txt' })).toBe('text');
    expect(detectAssetType({ name: 'a.webp' })).toBe('image');
    expect(detectAssetType({ name: 'a.unknown' })).toBe('image'); // 兜底 image
  });

  it('filterByFolder：全部返回全部；单目录按 folder 前缀匹配', () => {
    const list = getResources(); // 默认 seed
    expect(filterByFolder(list, null).length).toBe(list.length);
    const char = filterByFolder(list, 'migrated/人物');
    expect(char.every((a) => a.folder === 'migrated/人物')).toBe(true);
    const gen = filterByFolder(list, 'tasks');
    expect(gen.every((a) => a.folder === 'tasks')).toBe(true);
  });

  it('addResources 新增并置默认 folder=migrated', () => {
    const added = addResources([{ url: '/files/x.png', name: '新图', type: 'image' }]);
    expect(added).toHaveLength(1);
    expect(added[0].folder).toBe('migrated');
    expect(added[0].id).toBeTruthy();
    expect(getResources().find((a) => a.id === added[0].id)).toBeTruthy();
  });

  it('addResources 指定 folder 落对应目录', () => {
    const added = addResources([{ url: '/files/y.png', type: 'image' }], 'migrated/场景');
    expect(added[0].folder).toBe('migrated/场景');
  });

  it('removeResource 删除指定 id', () => {
    const added = addResources([{ url: '/files/z.png', type: 'image' }]);
    removeResource(added[0].id);
    expect(getResources().find((a) => a.id === added[0].id)).toBeFalsy();
  });

  it('clearResources 清空', () => {
    clearResources();
    expect(getResources()).toHaveLength(0);
  });

  it('buildResourceRecord 缺省字段补全（id/folder/type/name/size/ts）', () => {
    const rec = buildResourceRecord({ url: '/files/x.png' }, 'migrated', 123456);
    expect(rec).toMatchObject({
      id: expect.any(String),
      folder: 'migrated',
      type: 'image',
      name: '未命名',
      size: 0,
      ts: 123456,
    });
  });

  it('buildResourceRecord 保留显式字段、回填 folder/now', () => {
    const rec = buildResourceRecord(
      { url: '/files/y.png', name: '猫', type: 'video', size: 99 },
      'tasks',
      7,
    );
    expect(rec).toMatchObject({
      folder: 'tasks',
      type: 'video',
      name: '猫',
      size: 99,
      ts: 7,
    });
  });

  it('resourcesOfProject：legacy(无 projectId) 全项目可见，显式 projectId 仅其项目可见', () => {
    const list = [
      { id: 'a', url: '/a.png', legacy: true }, // 无 projectId
      { id: 'b', url: '/b.png', projectId: 'p1' },
      { id: 'c', url: '/c.png', projectId: 'p2' },
    ] as never;
    expect(resourcesOfProject(list, 'p1').map((r) => r.id)).toEqual(['a', 'b']);
    expect(resourcesOfProject(list, 'p2').map((r) => r.id)).toEqual(['a', 'c']);
    expect(resourcesOfProject(list, 'px').map((r) => r.id)).toEqual(['a']); // 未知项目只见 legacy
  });

  // ── TD-12-5：项目隔离写入链（buildResourceRecord 透传 projectId）──

  it('TD-12-5·buildResourceRecord 透传 projectId（此前静默丢弃 → 隔离失效）', () => {
    const rec = buildResourceRecord({ url: '/files/a.png', projectId: 'p1' }, 'migrated', 1);
    expect(rec.projectId).toBe('p1');
  });

  it('TD-12-5·buildResourceRecord 无 projectId 时为 undefined（legacy，全项目可见）', () => {
    const rec = buildResourceRecord({ url: '/files/a.png' }, 'migrated', 1);
    expect(rec.projectId).toBeUndefined();
  });

  it('TD-12-5·登记带 projectId → 经 contentId 同源过滤对本项目可见、对它项目不可见', () => {
    clearResources();
    const added = addResources(
      [{ url: '/files/a.png', projectId: 'p1', type: 'image' }],
      'migrated',
    );
    const list = getResources();
    expect(list.find((r) => r.id === added[0].id)?.projectId).toBe('p1');
    expect(resourcesOfProject(list, 'p1').some((r) => r.id === added[0].id)).toBe(true);
    expect(resourcesOfProject(list, 'p2').some((r) => r.id === added[0].id)).toBe(false);
  });
});

describe('resourceStore P4 落盘节流', () => {
  beforeEach(() => {
    // 排空文件级 beforeEach 用真实定时器排的待落盘（避免脏 timer 污染假定时器窗口，导致后续 schedule 不排程）
    flushPersist();
    vi.useFakeTimers();
    localStorage.removeItem(STORAGE_KEY);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('高频变更（addResources/removeResource）在防抖窗口内不触发落盘，窗口结束只落盘 1 次', () => {
    clearResources();
    addResources([{ url: '/a.png', type: 'image' }]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    addResources([{ url: '/b.png', type: 'image' }]);
    removeResource(getResources()[0].id);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    vi.advanceTimersByTime(300);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(Array.isArray(saved)).toBe(true);
    // 窗口内 3 次变更合并为最终态：加了 2 个、删了 1 个 → 只剩 1 个
    expect(saved).toHaveLength(1);
  });

  it('flushPersist 强制立即落盘（供页面卸载兜底）', () => {
    clearResources();
    addResources([{ url: '/c.png', type: 'image' }]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    flushPersist();
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved).toHaveLength(1);
  });

  it('flushPersist 后防抖窗口内不重复落盘', () => {
    const setSpy = vi.spyOn(Storage.prototype, 'setItem');
    clearResources();
    addResources([{ url: '/d.png', type: 'image' }]);
    flushPersist();
    const writesBefore = setSpy.mock.calls.filter(([k]) => k === STORAGE_KEY).length;
    vi.advanceTimersByTime(300); // 原定时器已清，不应再写
    const writesAfter = setSpy.mock.calls.filter(([k]) => k === STORAGE_KEY).length;
    expect(writesAfter).toBe(writesBefore);
  });
});

describe('safeResourceBase（发送到素材库落盘文件名安全化）', () => {
  it('中文名保留（无非法字符）', () => {
    expect(safeResourceBase('猫')).toBe('猫');
  });
  it('去非法字符 /\\:*?"<>| → 下划线', () => {
    expect(safeResourceBase('a/b\\c')).toBe('a_b_c');
  });
  it('空白 → 下划线', () => {
    expect(safeResourceBase('猫 狗')).toBe('猫_狗');
  });
  it('去掉尾部扩展名，避免「猫.png.png」', () => {
    expect(safeResourceBase('猫.png')).toBe('猫');
    expect(safeResourceBase('photo.123')).toBe('photo');
  });
  it('空/纯空白 → 回退 asset', () => {
    expect(safeResourceBase('')).toBe('asset');
    expect(safeResourceBase('   ')).toBe('asset');
    expect(safeResourceBase()).toBe('asset');
  });
});

// ── 【TD-12-2】双注册表残留收口：占位项与后端项按 url 归并（消除「同一素材并存两行」）──
describe('TD-12-2 占位项与后端项按 url 归并', () => {
  it('合并：同 url 的本地占位项（随机 id）被后端项替换，不再并存两行', () => {
    clearResources();
    const localUrl = 'http://127.0.0.1:18080/files/migrated/a.png';
    addResources([{ url: localUrl, name: '猫' }], 'migrated');
    expect(getResources()).toHaveLength(1); // 本地占位项（随机 id、无 contentId）

    mergeResourcesFromBackend([
      {
        id: 'local-migrated-a.png',
        url: localUrl,
        folder: 'migrated',
        name: 'a.png',
        type: 'image',
        contentId: 'sha1:abc',
      },
    ] as never);

    const list = getResources();
    expect(list).toHaveLength(1); // 改前 = 2 行（随机 id 与后端路径 id 永不相交）
    expect(list[0].id).toBe('local-migrated-a.png'); // 以后端身份为准
    expect(list[0].contentId).toBe('sha1:abc');
  });

  it('不误删：url 不同的本地项照常保留', () => {
    clearResources();
    addResources([{ url: '/files/keep.png', name: '保留' }], 'migrated');
    mergeResourcesFromBackend([
      {
        id: 'local-migrated-other.png',
        url: '/files/other.png',
        folder: 'migrated',
        name: 'other.png',
        type: 'image',
      },
    ] as never);
    expect(
      getResources()
        .map((r) => r.url)
        .sort(),
    ).toEqual(['/files/keep.png', '/files/other.png']);
  });

  it('sendToResourceLibrary 落盘成功后把占位项 url 校正为后端持久 url', async () => {
    clearResources();
    sendToResourceLibrary('data:image/png;base64,AAAA', { name: '猫', folder: 'migrated' });
    // 立即：占位项 url 仍是原始 data:（改前会一直如此 → 合并时与后端项 url 不同 → 永久两行）
    expect(String(getResources()[0].url).startsWith('data:')).toBe(true);
    // 落盘为异步：等微任务推进后应被校正为后端持久 url
    for (let i = 0; i < 12 && String(getResources()[0].url).startsWith('data:'); i++) {
      await Promise.resolve();
    }
    expect(getResources()[0].url).toBe('http://127.0.0.1:18080/files/migrated/recon.png');
  });

  // ── 判别联合契约（TD-12-2 · Step 4）：落盘失败 ≠ 重扫失败，各自语义独立 ──

  it('落盘接口返回空（失败）→ 占位项保留原 url，不校正（禁假成功）', async () => {
    clearResources();
    vi.mocked(saveInlineToLocal).mockResolvedValueOnce(null);
    sendToResourceLibrary('data:image/png;base64,BBBB', { name: '狗', folder: 'migrated' });
    for (let i = 0; i < 12; i++) await Promise.resolve();
    expect(String(getResources()[0].url).startsWith('data:')).toBe(true);
  });

  it('落盘抛异常 → 占位项保留原 url（reason=exception）', async () => {
    clearResources();
    vi.mocked(saveInlineToLocal).mockRejectedValueOnce(new Error('boom'));
    sendToResourceLibrary('data:image/png;base64,CCCC', { name: '鸟', folder: 'migrated' });
    for (let i = 0; i < 12; i++) await Promise.resolve();
    expect(String(getResources()[0].url).startsWith('data:')).toBe(true);
  });

  it('【先红锚点 · 禁重分类】rescan 失败不丢弃已落盘的持久 url（仍校正占位项）', async () => {
    clearResources();
    vi.mocked(rescanResources).mockRejectedValueOnce(new Error('rescan down'));
    sendToResourceLibrary('data:image/png;base64,DDDD', { name: '鱼', folder: 'migrated' });
    for (let i = 0; i < 12; i++) await Promise.resolve();
    // 图已落盘 → 持久 url 必须到手；rescan 失败只影响「面板何时看到」，不得改写落盘结论
    expect(getResources()[0].url).toBe('http://127.0.0.1:18080/files/migrated/recon.png');
  });
});
