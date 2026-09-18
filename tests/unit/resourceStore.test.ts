// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FOLDERS,
  libraryFoldersOf,
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
  mergeResourcesFromBackend,
  refreshFromBackend,
  sendToResourceLibrary,
  onResourceSent,
} from '../../src/components/base/store/resourceStore.ts';
import { persistUrlToUploads, moveFile } from '../../src/components/base/api/filesApi.ts';
import { rescanResources } from '../../src/components/base/api/localToolApi.ts';
import type { ResourceItem } from '../../src/components/base/api/localToolApi.ts';

// ── 落盘链隔离：sendToResourceLibrary 会调 filesApi（落盘 / 归位）+ rescanResources ──
// 只桩掉两个**有副作用的原语**；纯函数（resolveMovePaths / relativePathFromUrl）保留真实实现 ——
// 它们是「同目录短路 / 跨目录归位」的判据，桩掉会让断言失去意义。
vi.mock('../../src/components/base/api/filesApi.ts', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    persistUrlToUploads: vi.fn(),
    moveFile: vi.fn(),
  };
});
vi.mock('../../src/components/base/api/localToolApi.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  rescanResources: vi.fn(async () => ({ ok: true })),
}));
// ── TD-02-59：store 自刷镜像（`refreshFromBackend`）只桩「分页读取」这一处 IO ──
// 桩必须标出返回类型：`async () => []` 在 `--noImplicitAny` 下推成 `never[]` ⇒ 喂数据即 TS2322（strict 闸当场抓到）
const h = vi.hoisted(() => ({
  fetchAllResourcePages: vi.fn(async (): Promise<ResourceItem[]> => []),
}));
vi.mock('../../src/components/base/api/pagedList.ts', () => ({
  fetchAllResourcePages: (...a: unknown[]) => h.fetchAllResourcePages(...(a as [])),
}));

const STORAGE_KEY = 'yimao:yimao_asset_library'; // storageAdapter 对键加 yimao: 前缀
/** 桩的落盘结果：模拟「已落盘到 migrated」的持久 url */
const PERSISTED = 'http://127.0.0.1:18080/files/migrated/recon.png';

beforeEach(() => {
  clearResources();
  localStorage.clear();
  __resetForTest(); // 重新 seed 默认素材（测试出口；生产侧 reloadFromStorage 由 onStorageReady 调用）
  vi.mocked(persistUrlToUploads).mockReset();
  vi.mocked(persistUrlToUploads).mockImplementation(
    async () => ({ ok: true, url: PERSISTED, source: 'inline' }) as never,
  );
  vi.mocked(moveFile).mockReset();
  vi.mocked(moveFile).mockImplementation(async () => ({ code: 0 }) as never);
  vi.mocked(rescanResources).mockReset();
  vi.mocked(rescanResources).mockImplementation(async () => ({ ok: true }) as never);
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

// 注：原 `safeResourceBase` 及其用例已随「落盘判据收口」删除 —— 文件名安全化只剩一处实现
// （filesApi.persistUrlToUploads 内调 core/utils.safeFileName，行为由 utils.test.ts 钉住），
// store 侧不再保留零生产调用方的同源包装（死抽象，TD-02-8 同款）。

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
});

// ── 【TD-02-59】镜像填充归还其所有方：store 自己从后端刷（不再靠"某个界面被打开"顺便填）──
describe('refreshFromBackend（TD-02-59）', () => {
  it('拉后端全量 → 并入镜像（contentId → url 解析不再依赖打开过哪个界面）', async () => {
    clearResources();
    h.fetchAllResourcePages.mockResolvedValueOnce([
      {
        id: 'r-be-1',
        name: '后端图',
        url: 'http://127.0.0.1:18080/files/migrated/be.png',
        contentId: 'sha1:be',
        type: 'image',
        folder: 'migrated',
      },
    ]);
    await refreshFromBackend();
    const hit = getResources().find((r) => r.id === 'r-be-1');
    expect(h.fetchAllResourcePages).toHaveBeenCalledWith({}); // 全量，不带目录/类型过滤
    expect(hit?.contentId).toBe('sha1:be');
    expect(hit?.url).toBe('http://127.0.0.1:18080/files/migrated/be.png');
  });

  it('后端不可用 → 只留痕不抛（镜像刷新是后台动作，不炸调用方）', async () => {
    clearResources();
    h.fetchAllResourcePages.mockRejectedValueOnce(new Error('offline'));
    await expect(refreshFromBackend()).resolves.toBeUndefined();
    expect(getResources()).toHaveLength(0); // 失败不写入半成品
  });
});

// ── TD-12-10 收口轮：「发送到素材库」三段顺序（落盘 → 归位 → 广播） ──
// 旧用例钉的是「先登记占位行 → 成功后打补丁校正 → 失败则永久残留」这套兜底；
// 收口后：失败不登记；成功登记的就是后端权威 url（无占位行、无补丁、无归并特例）。
describe('sendToResourceLibrary：落盘 → 归位 → 广播', () => {
  it('落盘成功 → 登记后端权威 url 与名字（不再先占位后校正）', async () => {
    clearResources();
    const outcome = await sendToResourceLibrary('data:image/png;base64,AAAA', {
      name: '猫',
      folder: 'migrated',
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.ok ? outcome.url : '').toBe(PERSISTED);
    const list = getResources();
    expect(list).toHaveLength(1);
    expect(list[0].url).toBe(PERSISTED);
    expect(list[0].name).toBe('猫');
    expect(list[0].folder).toBe('migrated');
  });

  it('本机素材已在目标目录 → 幂等短路：不做归位（不产生多余的上下文写）', async () => {
    clearResources();
    vi.mocked(persistUrlToUploads).mockResolvedValueOnce({
      ok: true,
      url: PERSISTED,
      source: 'already-local',
    } as never);
    await sendToResourceLibrary(PERSISTED, { folder: 'migrated' });
    expect(vi.mocked(moveFile)).not.toHaveBeenCalled();
  });

  it('本机素材在别的目录（tasks）→ 归位到目标目录（磁盘路径由 url 派生）', async () => {
    clearResources();
    vi.mocked(persistUrlToUploads).mockResolvedValueOnce({
      ok: true,
      url: 'http://127.0.0.1:18080/files/tasks/gen.png',
      source: 'already-local',
    } as never);
    const outcome = await sendToResourceLibrary('http://127.0.0.1:18080/files/tasks/gen.png', {
      folder: 'migrated',
    });
    expect(outcome.ok).toBe(true);
    expect(vi.mocked(moveFile)).toHaveBeenCalledWith('tasks/gen.png', 'migrated/gen.png');
  });

  it('落盘失败 → 不登记、不归位、不广播（禁假素材 / 禁面板白刷）', async () => {
    clearResources();
    const seen: string[] = [];
    const off = onResourceSent((f) => seen.push(f));
    vi.mocked(persistUrlToUploads).mockResolvedValueOnce({
      ok: false,
      reason: 'upload-failed',
    } as never);
    const outcome = await sendToResourceLibrary('data:image/png;base64,BBBB', { name: '狗' });
    off();
    expect(outcome.ok).toBe(false);
    expect(outcome.ok ? '' : outcome.reason).toBe('upload-failed');
    expect(getResources()).toHaveLength(0);
    expect(vi.mocked(moveFile)).not.toHaveBeenCalled();
    expect(seen).toEqual([]);
  });

  it('归位失败 → relocate-failed（文件已落盘但未进目标目录：不得宣告成功，也不留本地假行）', async () => {
    clearResources();
    vi.mocked(persistUrlToUploads).mockResolvedValueOnce({
      ok: true,
      url: 'http://127.0.0.1:18080/files/tasks/gen.png',
      source: 'uploaded',
    } as never);
    vi.mocked(moveFile).mockRejectedValueOnce(new Error('资源未同步，请刷新后重试'));
    const outcome = await sendToResourceLibrary('data:image/png;base64,AAAA', { name: '猫' });
    expect(outcome.ok).toBe(false);
    expect(outcome.ok ? '' : outcome.reason).toBe('relocate-failed');
    expect(getResources()).toHaveLength(0);
  });

  it('【先红锚点】顺序 = 落盘 → rescan → 归位 → 广播（广播时后端三件齐备）', async () => {
    clearResources();
    const order: string[] = [];
    vi.mocked(persistUrlToUploads).mockImplementationOnce(async () => {
      order.push('persist');
      return {
        ok: true,
        url: 'http://127.0.0.1:18080/files/tasks/gen.png',
        source: 'uploaded',
      } as never;
    });
    vi.mocked(rescanResources).mockImplementationOnce(async () => {
      order.push('rescan');
      return { ok: true } as never;
    });
    vi.mocked(moveFile).mockImplementationOnce(async () => {
      order.push('relocate');
      return { code: 0 } as never;
    });
    const off = onResourceSent(() => order.push('emit'));
    await sendToResourceLibrary('data:image/png;base64,AAAA', { name: '猫', folder: 'migrated' });
    off();
    expect(order).toEqual(['persist', 'rescan', 'relocate', 'emit']);
  });

  it('【先红锚点 · 禁重分类】rescan 失败不改写落盘结论（仍归位并广播）', async () => {
    clearResources();
    const seen: string[] = [];
    const off = onResourceSent((f) => seen.push(f));
    vi.mocked(rescanResources).mockRejectedValueOnce(new Error('rescan down'));
    const outcome = await sendToResourceLibrary('data:image/png;base64,DDDD', { name: '鱼' });
    off();
    expect(outcome.ok).toBe(true);
    expect(seen).toEqual(['migrated']);
  });

  it('无 url → empty 失败，不登记不广播', async () => {
    clearResources();
    const seen: string[] = [];
    const off = onResourceSent((f) => seen.push(f));
    const outcome = await sendToResourceLibrary('');
    off();
    expect(outcome.ok).toBe(false);
    expect(outcome.ok ? '' : outcome.reason).toBe('empty');
    expect(getResources().filter((r) => r.folder === 'migrated')).toHaveLength(0);
    expect(seen).toEqual([]);
  });
});

describe('libraryFoldersOf：静态基底 ∪ 磁盘实有子目录（TD-03-15）', () => {
  // 【锁住的用户可见缺陷】原实现是**模块级静态常量**（只含 all/character/scene/prop）
  // ⇒ 用户在 migrated 下自建的目录在 UI 里**没有 pill、点不进去**（实测 颜色/HKH其他产品）。
  // 本套件锁「磁盘实有子目录自动获得 pill」+「静态项不重复」+「非 migrated 父目录不纳入」三条。

  it('无磁盘行时 = 静态基底（首屏/未连接也可用，结构稳定）', () => {
    const list = libraryFoldersOf([]);
    expect(list.map((f) => f.key)).toEqual(['all', 'character', 'scene', 'prop']);
    // 「全部」的 folder 必须是 null（面板据此回落 LIBRARY_ROOT，不在此写死路径）
    expect(list[0].folder).toBeNull();
  });

  it('磁盘实有子目录自动获得 pill（本轮修的用户可见缺陷）', () => {
    const list = libraryFoldersOf([
      { folder: 'migrated', name: '颜色' },
      { folder: 'migrated', name: 'HKH其他产品' },
    ]);
    expect(list.map((f) => f.label)).toEqual(['全部', '人物', '场景', '道具', '颜色', 'HKH其他产品']);
    // 路径由「父目录 + 目录名」派生（不自拼），folder 必须是素材库下的完整相对路径
    expect(list.find((f) => f.label === '颜色')?.folder).toBe('migrated/颜色');
  });

  it('已在静态基底里的目录不重复出现（人物/场景/道具）', () => {
    const list = libraryFoldersOf([
      { folder: 'migrated', name: '人物' },
      { folder: 'migrated', name: '场景' },
      { folder: 'migrated', name: '道具' },
    ]);
    expect(list.map((f) => f.key)).toEqual(['all', 'character', 'scene', 'prop']);
  });

  it('父目录不是素材库根的行**不纳入**（canvas/tasks 下的目录不是素材分类）', () => {
    const list = libraryFoldersOf([
      { folder: 'canvas', name: 'video-editor' },
      { folder: 'canvas', name: 'drop' },
      { folder: 'tasks', name: 'whatever' },
    ]);
    // 只剩静态基底 —— 一个都没混进来
    expect(list.map((f) => f.key)).toEqual(['all', 'character', 'scene', 'prop']);
  });

  it('空名 / 缺名的目录行被跳过（不产出无名 pill）', () => {
    const list = libraryFoldersOf([
      { folder: 'migrated', name: '' },
      { folder: 'migrated', name: '   ' },
      { folder: 'migrated' },
      { folder: 'migrated', name: '颜色' },
    ]);
    expect(list.map((f) => f.label)).toEqual(['全部', '人物', '场景', '道具', '颜色']);
  });

  it('尾部斜杠的父目录也能命中（防脏 folder 导致漏判）', () => {
    const list = libraryFoldersOf([{ folder: 'migrated/', name: '颜色' }]);
    expect(list.find((f) => f.label === '颜色')?.folder).toBe('migrated/颜色');
  });
});
