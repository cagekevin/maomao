// @vitest-environment jsdom
/**
 * 回归锁：M7「裸写 localStorage」收口（2026-09-16 · TD-02-33/36/37/39）。
 *
 * 契约（改这条契约前先读 `src/components/base/storage/legacyRawKey.ts` 文件头）：
 *   ① 业务键一律经 contentStore 落 localStorage（物理键带 `yimao:` 前缀）；
 *   ② **不再产生裸键**（无前缀）—— 裸键 = 绕过唯一入口，备份/监控/失败上报对该数据流全部失效；
 *   ③ 存量旧裸键有**一次性迁移读**：读旧值 → 回填新键 → 删旧键；新键已有值则不动；
 *      旧值损坏则**既不迁移也不删**（保留现场，由调用方留痕）。
 *
 * 【为什么必须行为断言】（Step 7.2）本轮修的是**正确性问题**（换机丢用户数据），不是纯结构重构 ——
 * "改了哪个函数"证明不了数据不丢；断言的是"给定旧存档 → 用户仍能读到同一份姿势库"。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// 隔离被测单元：storage.ts 只用 d3dPersistence 的这两个符号，其余（KV 写盘、图片外置）与本契约无关。
vi.mock('../../src/components/director3d/d3dPersistence.ts', () => ({
  isProjectPersistenceKey: (k: unknown) =>
    typeof k === 'string' && k.startsWith('director3d-project'),
  writeProject: vi.fn(async () => 'kv'),
}));

const POSE_KEY = 'director3d-custom-poses';
const PREFIXED_KEY = `yimao:${POSE_KEY}`;

/** 每个用例都拿**全新模块实例**（contentStore 有模块级缓存，复用会串味）。 */
async function freshStorage() {
  vi.resetModules();
  return await import('../../src/components/director3d/storage.ts');
}

describe('director3d 姿势库：经 contentStore 落盘（不再裸写）', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('写入落到带 yimao: 前缀的键，且**不产生裸键**', async () => {
    const { writeJson } = await freshStorage();
    const poses = [{ id: 'p1', name: '姿势一' }];

    expect(writeJson(POSE_KEY, poses)).toBe(true);

    expect(localStorage.getItem(POSE_KEY)).toBeNull(); // 裸键：已不再写
    expect(JSON.parse(localStorage.getItem(PREFIXED_KEY) as string)).toEqual(poses);
  });

  it('读旧存档：迁移到新键后用户仍能读到同一份姿势库（数据不丢）', async () => {
    const poses = [{ id: 'old', name: '旧姿势' }];
    localStorage.setItem(POSE_KEY, JSON.stringify(poses)); // 升级前的存量裸键

    const { readJson } = await freshStorage();

    expect(readJson(POSE_KEY, [])).toEqual(poses);
    expect(JSON.parse(localStorage.getItem(PREFIXED_KEY) as string)).toEqual(poses);
    expect(localStorage.getItem(POSE_KEY)).toBeNull(); // 迁移成功才清旧键
  });

  it('迁移幂等：新键已有值 → 以新键为准，不覆盖、不读旧键', async () => {
    const legacy = [{ id: 'stale', name: '陈旧副本' }];
    const current = [{ id: 'new', name: '新值' }];
    localStorage.setItem(POSE_KEY, JSON.stringify(legacy));
    localStorage.setItem(PREFIXED_KEY, JSON.stringify(current));

    const { readJson } = await freshStorage();

    expect(readJson(POSE_KEY, [])).toEqual(current);
    expect(JSON.parse(localStorage.getItem(PREFIXED_KEY) as string)).toEqual(current);
    // 幂等 = 不碰旧键（不删不写）：它在迁移完成后只是陈旧副本，删除它属于"顺手改"，不是本契约
    expect(localStorage.getItem(POSE_KEY)).toBe(JSON.stringify(legacy));
  });

  it('旧键损坏：不迁移、不删（保留现场），读回 fallback 而非崩溃', async () => {
    localStorage.setItem(POSE_KEY, '{这不是合法 JSON');

    const { readJson } = await freshStorage();

    expect(readJson(POSE_KEY, [])).toEqual([]);
    expect(localStorage.getItem(POSE_KEY)).toBe('{这不是合法 JSON');
    expect(localStorage.getItem(PREFIXED_KEY)).toBeNull();
  });
});
