/**
 * contentPersistStorage 单测（152-V3 · zustand persist × contentStore 唯一适配）。
 *
 * 锁定行为：
 *  ① 旧裸键一次性迁移（裸值 → contentStore `yimao:` 物理键，写成功才删旧键）；
 *  ② 幂等：新键已有值时不再迁移，旧裸键残留被清除（防复活）；
 *  ③ 旧裸键损坏 → 跳过 + 旧键保留（失败可见，不静默丢）；
 *  ④ setItem/removeItem 物理落点 = `yimao:<键名>`（进备份清单的前提）。
 * 用真实 contentStore（不 mock）：登记/前缀/落盘都是本适配的契约，桩掉就锁不住了。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { contentPersistStorage } from '../../src/components/base/storage/contentPersistStorage.ts';
import { contentClearCache } from '../../src/components/base/core/contentStore.ts';
import { KEY_PREFIX } from '../../src/components/base/storage/storageAdapter.ts';

// 已登记键（contracts.STORAGE_KEYS[KEY_CUTIA_KEYBINDINGS]）——未登记键会被 checkRegistered 硬拦。
const KEY = 'cutia-keybindings';
const PHYS = `${KEY_PREFIX}${KEY}`;

beforeEach(() => {
  localStorage.clear();
  contentClearCache();
});

describe('contentPersistStorage — 旧裸键一次性迁移（152-V3）', () => {
  it('裸键有值、新键无值 → 迁移：返回 persist JSON 文本、新物理键落盘、旧裸键删除', async () => {
    const persistJson = JSON.stringify({
      state: { keybindings: { 'ctrl+k': 'toggle' }, isCustomized: true },
      version: 3,
    });
    localStorage.setItem(KEY, persistJson);

    const out = await contentPersistStorage().getItem(KEY);
    expect(out).not.toBeNull();
    expect(JSON.parse(String(out)).state.keybindings).toEqual({ 'ctrl+k': 'toggle' });
    // 新物理键 = yimao: 前缀（进 getLocalKeys 备份清单的前提），内容与迁移源等价
    expect(localStorage.getItem(PHYS)).not.toBeNull();
    expect(JSON.parse(String(localStorage.getItem(PHYS))).state.isCustomized).toBe(true);
    // 旧裸键已删（迁移后单路径，不留两个入口）
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('幂等：新键已有值 → 不迁移（新值赢），旧裸键残留被清除', async () => {
    const storage = contentPersistStorage();
    await storage.setItem(KEY, JSON.stringify({ state: { v: 'new' }, version: 3 }));
    // 迟到的旧裸键（比新值旧）：不得复活覆盖新值
    localStorage.setItem(KEY, JSON.stringify({ state: { v: 'old' }, version: 2 }));

    const out = await storage.getItem(KEY);
    expect(JSON.parse(String(out)).state).toEqual({ v: 'new' });
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('新用户（无旧键、无新值）→ 返回 null，不抛', async () => {
    expect(await contentPersistStorage().getItem(KEY)).toBeNull();
  });

  it('旧裸键损坏（非 JSON）→ 跳过迁移返回 null，旧键保留（人工介入，不静默删证）', async () => {
    localStorage.setItem(KEY, '不是JSON{{{');
    expect(await contentPersistStorage().getItem(KEY)).toBeNull();
    expect(localStorage.getItem(KEY)).toBe('不是JSON{{{');
  });
});

describe('contentPersistStorage — 读写物理落点', () => {
  it('setItem 落在 yimao: 物理键（值 = persist JSON 文本原样）；removeItem 删除', async () => {
    const storage = contentPersistStorage();
    await storage.setItem(KEY, JSON.stringify({ state: { k: 'v' }, version: 1 }));
    expect(JSON.parse(String(localStorage.getItem(PHYS)))).toEqual({
      state: { k: 'v' },
      version: 1,
    });
    await storage.removeItem(KEY);
    expect(localStorage.getItem(PHYS)).toBeNull();
  });

  it('写入后再读：getItem 返回等价 JSON 文本（persist rehydrate 可解析）', async () => {
    const storage = contentPersistStorage();
    const persistJson = JSON.stringify({ state: { a: 1 }, version: 2 });
    await storage.setItem(KEY, persistJson);
    const out = await storage.getItem(KEY);
    expect(JSON.parse(String(out))).toEqual({ state: { a: 1 }, version: 2 });
  });
});
