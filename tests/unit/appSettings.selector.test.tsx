// @vitest-environment jsdom
/**
 * useAppSettingsSelector 订阅粒度（TD-04-38）。
 *
 * 契约：**只订阅 selector 选中的字段** —— 改无关设置不得连坐重渲。
 * 背景：`useRenderAssetResolver`（被 20+ 组件消费）此前用整包 `useAppSettings` 却只取
 * `thumbnailOn` 一个字段 ⇒ 改任一设置（调试模式/小地图/性能模式…）都让这些组件全部重渲。
 */
import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import {
  getSetting,
  setSetting,
  useAppSettingsSelector,
} from '@/components/base/store/appSettings.ts';

describe('useAppSettingsSelector — 订阅粒度（TD-04-38）', () => {
  it('改无关设置不重渲；改被订阅字段才重渲', () => {
    // 反证：把实现换成整包 useAppSettings ⇒ 第一次 setSetting 就重渲 ⇒ 本断言红。
    let renders = 0;
    function Probe() {
      renders += 1;
      useAppSettingsSelector((s) => s.thumbnailOn !== false);
      return null;
    }
    render(<Probe />);
    expect(renders).toBe(1);

    act(() => setSetting('debugOn', true)); // 无关字段（即使值没变，notify 也会发出）
    expect(renders).toBe(1);

    // 取反保证"值确实变了"（与初值无关，避免受模块级单例的残留状态影响）
    act(() => setSetting('thumbnailOn', getSetting('thumbnailOn') === false));
    expect(renders).toBe(2);
  });

  it('多字段组合：组合内字段变才重渲，组合外不变（默认浅比较）', () => {
    let renders = 0;
    function Probe() {
      renders += 1;
      useAppSettingsSelector((s) => ({ a: s.minimapOn, b: s.performanceMode }));
      return null;
    }
    render(<Probe />);
    expect(renders).toBe(1);

    act(() => setSetting('minimapOn', !getSetting('minimapOn')));
    expect(renders).toBe(2);

    act(() => setSetting('debugOn', false)); // 组合外
    expect(renders).toBe(2);
  });
});
