/**
 * 回归锁：剪辑器「收藏音效」持久化契约（2026-09-16 · TD-02-34/40）。
 *
 * 契约：
 *   ① 载体 = contentStore（键 `video-editor-saved-sounds`，登记 backend:'local'）⇒ 进备份清单；
 *   ② **读失败上抛**，不得归一成"没有收藏" —— 因为 `saveSoundEffect` 是**读-改-写**：
 *      读失败归一成空 ⇒ 用「空数组 + 1 条」写回 ⇒ **抹掉用户全部已收藏音效**（真数据丢失）；
 *   ③ 【2026-09-16 · TD-02-35 已删】原「旧 IndexedDB 库一次性迁移读」契约随载体收口删除 ——
 *      用户裁定不为老用户留兼容，剪辑器不再有任何 IndexedDB 依赖（连迁移路径一并去掉）。
 *
 * 【为什么必须行为断言】（Step 7.2）② 是正确性缺陷（数据丢失），不是结构重构 ——
 * 断言的是"存储故障时用户的收藏不会被写没"，而不是"某个函数被调用过"。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** contentStore 替身：只关心"读了哪个键 / 写了什么 / 能否失败"。 */
const cs = vi.hoisted(() => ({
  data: new Map<string, unknown>(),
  failRead: false,
  readKeys: [] as string[],
  writtenKeys: [] as string[],
}));

// 展开真模块再覆盖（TD-17-15：模块**新增导出**时桩不再脱钩 —— 判据见 tests/unit/mockPartialSpread.test.ts）
vi.mock('../../src/components/base/core/contentStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  contentGetAsync: vi.fn(async (key: string) => {
    cs.readKeys.push(key);
    if (cs.failRead) throw new Error('storage backend down');
    return cs.data.get(key) ?? null;
  }),
  contentSetAsync: vi.fn(async (key: string, value: unknown) => {
    cs.writtenKeys.push(key);
    cs.data.set(key, value);
    return { ok: true, landed: 'kv' } as const; // 桩跟契约走：写原语返回落盘结果
  }),
  contentDeleteAsync: vi.fn(async (key: string) => {
    cs.writtenKeys.push(`delete:${key}`);
    cs.data.delete(key);
  }),
  // 以下为 service.ts 其它路径（工程本体 CAS）所需，本用例不驱动它们
  contentKvGetVersion: vi.fn(async () => 0),
  contentKvReadWithVersion: vi.fn(async (key: string) => ({
    value: cs.data.get(key) ?? null,
    version: 0,
  })),
  contentKvSetCas: vi.fn(async (key: string, value: unknown) => {
    cs.data.set(key, value);
  }),
}));

// 【2026-09-16 · TD-02-35 已删】原 `indexeddb-adapter` 替身（迁移读用）—— 适配器与迁移器均已删除，
// 本测试不再需要任何 IndexedDB 桩。

// 与 veProjectWriteKey.test.ts 同款：避开浏览器专属依赖，只留被测的存储契约
vi.mock('../../src/components/base/api/filesApi.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  // 【2026-09-17】契约已改判别联合：失败＝`ok:false`（含生产者 message），不再是 null。
  uploadFileToLocal: vi.fn(async () => ({ ok: false, message: '本地服务未启动' })),
}));
vi.mock('../../src/components/base/api/localToolApi.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  deleteResource: vi.fn(async () => undefined),
  fetchResources: vi.fn(async () => ({ data: { items: [] } })),
}));

const SOUNDS_KEY = 'video-editor-saved-sounds';

async function freshService() {
  vi.resetModules();
  const mod = await import('../../src/components/videoEditor/engine/services/storage/service');
  return mod.storageService;
}

const sound = (id: number) => ({
  id,
  name: `音效 ${id}`,
  description: '',
  url: `/files/audio/${id}.mp3`,
  previewUrl: `/files/audio/${id}.mp3`,
  downloadUrl: `/files/audio/${id}.mp3`,
  duration: 1,
  filesize: 1024,
  type: 'audio/mpeg',
  channels: 2,
  bitrate: 128000,
  bitdepth: 16,
  samplerate: 44100,
  username: 'u',
  tags: [] as string[],
  license: '',
  created: '2026-09-16T00:00:00.000Z',
  downloads: 0,
  rating: 0,
  ratingCount: 0,
});

describe('收藏音效：载体已迁 contentStore（不进 IndexedDB）', () => {
  beforeEach(() => {
    cs.data.clear();
    cs.failRead = false;
    cs.readKeys = [];
    cs.writtenKeys = [];
  });

  it('真·空（新用户）→ 返回空集合（不是"未知"）', async () => {
    const service = await freshService();
    expect(await service.loadSavedSounds()).toEqual({
      sounds: [],
      lastModified: expect.any(String),
    });
  });

  it('读失败必须上抛，不得伪装成"没有收藏"', async () => {
    const service = await freshService();
    cs.failRead = true;
    await expect(service.loadSavedSounds()).rejects.toThrow(/backend down/);
  });

  it('【数据丢失回归锁】读失败时保存音效 → 报错且**不写任何值**（旧实现会用空数组+1条覆盖全部收藏）', async () => {
    const service = await freshService();
    cs.failRead = true;

    await expect(service.saveSoundEffect({ soundEffect: sound(1) })).rejects.toThrow(
      /backend down/,
    );
    expect(cs.writtenKeys.filter((k) => k === SOUNDS_KEY)).toEqual([]);
  });

  it('已有收藏时保存新音效 → 追加而非覆盖', async () => {
    const service = await freshService();
    cs.data.set(SOUNDS_KEY, { sounds: [sound(1)], lastModified: 't0' });

    await service.saveSoundEffect({ soundEffect: sound(2) });

    const written = cs.data.get(SOUNDS_KEY) as { sounds: { id: number }[] };
    expect(written.sounds.map((s) => s.id)).toEqual([1, 2]);
  });

  // 【2026-09-16 · TD-02-35 已删】原「一次性迁移：新键空 + 旧 IndexedDB 有值 → 回填新键并删旧库」
  // 与「迁移幂等：新键已有值 → 不读旧库」两例 —— 锁的是已被撤销的迁移契约，留着即假象。

  it('清空收藏走 contentDelete（不是"写一个空数组"）', async () => {
    cs.data.set(SOUNDS_KEY, { sounds: [sound(1)], lastModified: 't0' });
    const service = await freshService();

    await service.clearSavedSounds();

    expect(cs.writtenKeys).toContain(`delete:${SOUNDS_KEY}`);
    expect(cs.data.has(SOUNDS_KEY)).toBe(false);
  });
});
