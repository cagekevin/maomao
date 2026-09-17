// @vitest-environment node
/**
 * 回归锁：剪辑**素材元数据**的载体 = KV 单键（TD-02-35 · 2026-09-16 载体收口）。
 *
 * 契约：
 *   ① `saveMediaAsset` 写入 `video_editor_media_meta_{projectId}`（**KV 侧**）——
 *      此前写的是浏览器 IndexedDB（per-project 库）⇒ 不进备份、不跨端、与工程本体不同生命周期；
 *   ② 同项目多素材**共用一个键**（整表语义）；不同项目**分键**；
 *   ③ `deleteMediaAsset` 只删该条目（同表其它素材保留）；
 *   ④ `deleteProjectMedia` 删**整键**（原 IndexedDB `clear()` 的等价语义）；
 *   ⑤ 源码级：IndexedDB/OPFS 适配器与迁移器**已不存在**（防回潮）。
 *
 * 【为什么断言"写在哪个键"】对外 API 签名与结果都没变（故意）——**唯一的行为差异就是载体**。
 * 所以必须断言"值落到了哪个键"，否则（如"某函数被调用过"）无法证明载体真的换成了 KV。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';

/** contentStore 替身：只关心"读了/写了哪个键、能否失败"。 */
const cs = vi.hoisted(() => ({
  data: new Map<string, unknown>(),
  failRead: false,
}));

vi.mock('../../src/components/base/core/contentStore.ts', () => ({
  contentGetAsync: vi.fn(async (key: string) => {
    if (cs.failRead) throw new Error('storage backend down');
    return cs.data.get(key) ?? null;
  }),
  contentSetAsync: vi.fn(async (key: string, value: unknown) => {
    cs.data.set(key, value);
    return { ok: true, landed: 'kv' } as const; // 桩跟契约走：写原语返回落盘结果
  }),
  contentDeleteAsync: vi.fn(async (key: string) => {
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

// 与 veSavedSoundsStorage.test.ts 同款：避开浏览器专属依赖，只留被测的存储契约
vi.mock('../../src/components/base/api/filesApi.ts', () => ({
  // 【2026-09-17】契约已改判别联合：失败＝`ok:false`（含生产者 message），不再是 null。
  uploadFileToLocal: vi.fn(async () => ({ ok: false, message: '本地服务未启动' })),
}));
vi.mock('../../src/components/base/api/localToolApi.ts', () => ({
  deleteResource: vi.fn(async () => undefined),
  fetchResources: vi.fn(async () => ({ data: { items: [] } })),
}));

const MEDIA_KEY = 'video_editor_media_meta_p1';

async function freshService() {
  vi.resetModules();
  const mod = await import('../../src/components/videoEditor/engine/services/storage/service');
  return mod.storageService;
}

/**
 * 临时（ephemeral）素材：`saveMediaAsset` 对它**不上传二进制**（合法状态，见 T5-B①），
 * 只写一条元数据 —— 正好用于单独验证"元数据表落在哪个键"。
 */
const ephemeralAsset = (id: string) =>
  ({
    id,
    name: `${id}.png`,
    type: 'image',
    file: { size: 10, lastModified: 1 },
    ephemeral: true,
  }) as never;

const tableOf = (key: string) => cs.data.get(key) as Record<string, { id: string }>;

describe('剪辑素材元数据：载体 = KV 单键（TD-02-35）', () => {
  beforeEach(() => {
    cs.data.clear();
    cs.failRead = false;
  });

  it('saveMediaAsset 写进 KV 键 video_editor_media_meta_{projectId}（不再写 IndexedDB）', async () => {
    const service = await freshService();
    await service.saveMediaAsset({ projectId: 'p1', mediaAsset: ephemeralAsset('a1') });

    const table = tableOf(MEDIA_KEY);
    expect(table, '元数据必须落在 KV 侧的表键上').toBeTruthy();
    expect(table.a1.id).toBe('a1');
  });

  it('同项目多素材共用一个键（整表语义）；不同项目分键', async () => {
    const service = await freshService();
    await service.saveMediaAsset({ projectId: 'p1', mediaAsset: ephemeralAsset('a1') });
    await service.saveMediaAsset({ projectId: 'p1', mediaAsset: ephemeralAsset('a2') });
    await service.saveMediaAsset({ projectId: 'p2', mediaAsset: ephemeralAsset('b1') });

    expect(Object.keys(tableOf(MEDIA_KEY)).sort()).toEqual(['a1', 'a2']);
    expect(Object.keys(tableOf('video_editor_media_meta_p2'))).toEqual(['b1']);
  });

  it('deleteMediaAsset 只删该条目（同表其它素材保留）', async () => {
    const service = await freshService();
    await service.saveMediaAsset({ projectId: 'p1', mediaAsset: ephemeralAsset('a1') });
    await service.saveMediaAsset({ projectId: 'p1', mediaAsset: ephemeralAsset('a2') });

    await service.deleteMediaAsset({ projectId: 'p1', id: 'a1' });

    expect(Object.keys(tableOf(MEDIA_KEY))).toEqual(['a2']);
  });

  it('deleteProjectMedia 删整键（原 IndexedDB clear() 的等价语义）', async () => {
    const service = await freshService();
    await service.saveMediaAsset({ projectId: 'p1', mediaAsset: ephemeralAsset('a1') });

    await service.deleteProjectMedia({ projectId: 'p1' });

    expect(cs.data.has(MEDIA_KEY)).toBe(false);
  });

  it('源码级：IndexedDB / OPFS 适配器与迁移器已不存在（防回潮）', () => {
    const dir = 'src/components/videoEditor/engine/services/storage';
    for (const f of [
      'indexeddb-adapter.ts',
      'opfs-adapter.ts',
      'migrations/index.ts',
      'migrations/runner.ts',
      'migrations/transformers/v1-to-v2.ts',
    ]) {
      expect(existsSync(`${dir}/${f}`), `${f} 不应存在（载体已收口，只留 contentStore）`).toBe(
        false,
      );
    }
  });
});
