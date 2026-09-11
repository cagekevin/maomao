/**
 * appSettings.reloadAppSettings 端到端验证（TD-13 真修复）。
 * 复现「云同步 restoreLocal 直写 contentStore，但内存态是缓存、不订阅变更」这一裂痕，
 * 证明：直写后内存态确实过期，调用 reloadAppSettings 后跟随时即生效（无需整页 reload）。
 */
import { describe, it, expect } from 'vitest';
import { contentSet, contentGet } from '@/components/base/core/contentStore.ts';
import { getSetting, setSetting, reloadAppSettings } from '@/components/base/store/appSettings.ts';

describe('appSettings.reloadAppSettings（TD-13 真修复）', () => {
  it('下载直写 contentStore 后缓存态过期，reload 后跟随新值', () => {
    // 1) 内存态写 true 并持久化
    setSetting('autoSyncEnabled', true);
    expect(getSetting('autoSyncEnabled')).toBe(true);

    // 2) 模拟云同步 restoreLocal 直写底层存储（绕过内存态），写回 false
    const current = (contentGet('app_settings') as Record<string, unknown>) || {};
    contentSet('app_settings', { ...current, autoSyncEnabled: false });

    // 3) 直写后内存态仍是旧的（裂痕表现）
    expect(getSetting('autoSyncEnabled')).toBe(true);

    // 4) 下载成功后调用的 reload 应让内存态跟随新值（当轮一致，不靠 reload 整页）
    reloadAppSettings();
    expect(getSetting('autoSyncEnabled')).toBe(false);
  });
});
