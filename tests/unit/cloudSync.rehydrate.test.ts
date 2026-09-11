/**
 * rehydrateStoresAfterCloudPull 回归测试（TD-13 修复落地；2026-09-11 由原独立模块 cloudRehydrate.ts 并入 cloudSync.ts）。
 * 验证：① 下载云端后精准触发 3 个有模块级缓存的 store 的 reload；
 *       ② 任一 reload 失败不阻断其余（Promise.allSettled 韧性）。
 * 三个 store 用 stub 替换，聚焦编排逻辑本身。downloadConfig 写回后会调用本函数（手动/自动两路复用），故本测试即锁定该行为。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const reloadAppSettings = vi.fn();
const reloadAccounts = vi.fn();
const reloadProviders = vi.fn();

vi.mock('@/components/base/store/appSettings.ts', () => ({
  reloadAppSettings: (...a: unknown[]) => reloadAppSettings(...a),
}));
vi.mock('@/components/base/store/accountsStore.ts', () => ({
  reloadAccounts: (...a: unknown[]) => reloadAccounts(...a),
}));
vi.mock('@/components/base/store/providerStore.ts', () => ({
  reloadProviders: (...a: unknown[]) => reloadProviders(...a),
}));

import { rehydrateStoresAfterCloudPull } from '@/components/base/store/cloudSync.ts';

describe('rehydrateStoresAfterCloudPull（TD-13，已并入 cloudSync.ts）', () => {
  beforeEach(() => {
    reloadAppSettings.mockReset();
    reloadAccounts.mockReset();
    reloadProviders.mockReset();
  });

  it('下载成功后精准触发三个 store 的 reload', async () => {
    reloadAppSettings.mockReturnValue(undefined);
    reloadAccounts.mockResolvedValue(undefined);
    reloadProviders.mockResolvedValue(undefined);
    await rehydrateStoresAfterCloudPull();
    expect(reloadAppSettings).toHaveBeenCalledTimes(1);
    expect(reloadAccounts).toHaveBeenCalledTimes(1);
    expect(reloadProviders).toHaveBeenCalledTimes(1);
  });

  it('某个 store reload 失败不阻断其余（Promise.allSettled 韧性）', async () => {
    reloadAppSettings.mockReturnValue(undefined);
    reloadAccounts.mockRejectedValue(new Error('KV 不可达'));
    reloadProviders.mockResolvedValue(undefined);
    // 不应抛，应静默完成（替换旧 window.location.reload 兜底，不允许单点失败拖垮整体）
    await expect(rehydrateStoresAfterCloudPull()).resolves.toBeUndefined();
    expect(reloadProviders).toHaveBeenCalledTimes(1);
    expect(reloadAppSettings).toHaveBeenCalledTimes(1);
  });
});
