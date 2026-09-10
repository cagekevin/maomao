// @vitest-environment jsdom
/**
 * modalLayer 单测 —— 全屏模态层的「登记 / 注销」与键名归一化。
 *
 * 【为什么专门给这个机制写测试】
 * 它管的是「画布全局快捷键要不要让位」，而这条链路上的两类故障都是**静默**的：
 *  - 漏登记 → 用户在编辑器里按 ⌘Z，撤掉的是画布上的节点（数据被改，界面上没提示）；
 *  - 误登记 → 画布上每挂一个该组件就永久登记一层，Q/W/E 全废（用户只看到"按键没反应"）。
 * 后者真实发生过：ImageZoomDialog 常驻挂载，曾把 enabled 绑成恒非空的 url，
 * 画布上每有一个 AssetNode 就多一层登记。当时的全量测试（2365 个用例）全绿 —— 因为
 * 没有任何用例在测"可见性变化时登记状态是否跟着变"。本文件补的就是这个缺口。
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, renderHook, cleanup } from '@testing-library/react';
import { createElement } from 'react';
import {
  hasModalLayer,
  describeKey,
  debugModalLayers,
  useFullscreenEditorKeys,
} from '../../src/components/base/core/modalLayer.ts';
import FullscreenShell from '../../src/components/base/panels/FullscreenShell.tsx';

/** 造一个只含必要字段的 KeyboardEvent（describeKey 只读这几个标志位与 key）。 */
function keyEvent(init: {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}): KeyboardEvent {
  return {
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...init,
  } as unknown as KeyboardEvent;
}

afterEach(() => {
  cleanup();
});

describe('modalLayer — describeKey 归一化', () => {
  it('ctrl 与 meta 统一成 mod（跨 Win/Mac 同一套业务分支）', () => {
    expect(describeKey(keyEvent({ key: 'z', metaKey: true }))).toBe('mod+z');
    expect(describeKey(keyEvent({ key: 'z', ctrlKey: true }))).toBe('mod+z');
  });

  it('修饰键顺序固定为 mod → shift → alt → 主键', () => {
    expect(describeKey(keyEvent({ key: 'z', metaKey: true, shiftKey: true }))).toBe('mod+shift+z');
    expect(describeKey(keyEvent({ key: 'z', metaKey: true, shiftKey: true, altKey: true }))).toBe(
      'mod+shift+alt+z',
    );
  });

  it('alt 参与键名 —— 否则 Alt+Z 与裸 Z 会生成同一个键名互相打架', () => {
    expect(describeKey(keyEvent({ key: 'z', altKey: true }))).toBe('alt+z');
    expect(describeKey(keyEvent({ key: 'z' }))).toBe('z');
    expect(describeKey(keyEvent({ key: 'z', altKey: true }))).not.toBe(
      describeKey(keyEvent({ key: 'z' })),
    );
  });

  it('主键一律小写；Escape 归一为 escape', () => {
    expect(describeKey(keyEvent({ key: 'P' }))).toBe('p');
    expect(describeKey(keyEvent({ key: 'Escape' }))).toBe('escape');
    expect(describeKey(keyEvent({ key: 'Escape', metaKey: true }))).toBe('mod+escape');
  });
});

describe('modalLayer — 登记与注销', () => {
  it('初始未登记', () => {
    expect(hasModalLayer()).toBe(false);
  });

  it('enabled 跟随时登记状态同步变化（误登记防护的核心语义）', () => {
    const { rerender, unmount } = renderHook(
      ({ enabled }: { enabled: boolean }) => useFullscreenEditorKeys({ enabled }),
      { initialProps: { enabled: false } },
    );

    expect(hasModalLayer()).toBe(false);
    rerender({ enabled: true });
    expect(hasModalLayer()).toBe(true);
    // 关回去必须注销 —— 常驻组件靠这一条才不会永久占位
    rerender({ enabled: false });
    expect(hasModalLayer()).toBe(false);

    unmount();
    expect(hasModalLayer()).toBe(false);
  });

  it('卸载即注销，不泄漏（StrictMode 双挂载同理）', () => {
    const { unmount } = renderHook(() => useFullscreenEditorKeys({ enabled: true }));
    expect(hasModalLayer()).toBe(true);
    unmount();
    expect(hasModalLayer()).toBe(false);
  });

  it('多层叠加：全部注销之后画布才恢复响应（Set 语义，不是计数器）', () => {
    const a = renderHook(() => useFullscreenEditorKeys({ enabled: true }));
    const b = renderHook(() => useFullscreenEditorKeys({ enabled: true }));

    expect(hasModalLayer()).toBe(true);
    a.unmount();
    // 还有一层开着 —— 此时若返回 false，画布快捷键就会穿透到被遮挡的画布
    expect(hasModalLayer()).toBe(true);
    b.unmount();
    expect(hasModalLayer()).toBe(false);
  });

  it('debugModalLayers 反映当前登记数与时长（排障入口）', () => {
    expect(debugModalLayers()).toHaveLength(0);
    const { unmount } = renderHook(() => useFullscreenEditorKeys({ enabled: true }));
    const list = debugModalLayers();
    expect(list).toHaveLength(1);
    expect(list[0].openSec).toBeGreaterThanOrEqual(0);
    expect(typeof list[0].stack).toBe('string');
    unmount();
    expect(debugModalLayers()).toHaveLength(0);
  });
});

describe('modalLayer — 「常驻误登记」告警只在层不可见时才喊', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('真的全屏盖着屏幕（可见）→ 长时间登记不告警（导演台/图片编辑开着调样式即此情形）', () => {
    // 造一个占满视口的元素冒充全屏层
    const el = document.createElement('div');
    el.getBoundingClientRect = () =>
      ({ width: window.innerWidth, height: window.innerHeight }) as DOMRect;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { unmount } = renderHook(() =>
      useFullscreenEditorKeys({ enabled: true, getElement: () => el }),
    );

    vi.advanceTimersByTime(61_000);
    expect(warn).not.toHaveBeenCalled();
    unmount();
  });

  it('登记着却没有任何东西盖在屏幕上（误登记）→ 到点告警', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { unmount } = renderHook(() =>
      useFullscreenEditorKeys({ enabled: true, getElement: () => null }),
    );

    vi.advanceTimersByTime(61_000);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('常驻误登记');
    unmount();
  });

  it('尺寸塌陷（0 面积）也算不可见 —— 只判「DOM 里有没有」会漏掉这类', () => {
    const el = document.createElement('div');
    el.getBoundingClientRect = () => ({ width: 0, height: 0 }) as DOMRect;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { unmount } = renderHook(() =>
      useFullscreenEditorKeys({ enabled: true, getElement: () => el }),
    );

    vi.advanceTimersByTime(61_000);
    expect(warn).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('到点前注销 → 不告警（正常开关一次）', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { unmount } = renderHook(() =>
      useFullscreenEditorKeys({ enabled: true, getElement: () => null }),
    );
    vi.advanceTimersByTime(30_000);
    unmount();
    vi.advanceTimersByTime(60_000);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('FullscreenShell — 成品外壳的开放/关闭语义', () => {
  it('open=false 不登记；转 true 才登记；卸载后注销', () => {
    const { rerender, unmount } = render(createElement(FullscreenShell, { open: false }, 'x'));
    expect(hasModalLayer()).toBe(false);

    rerender(createElement(FullscreenShell, { open: true }, 'x'));
    expect(hasModalLayer()).toBe(true);

    rerender(createElement(FullscreenShell, { open: false }, 'x'));
    expect(hasModalLayer()).toBe(false);

    unmount();
    expect(hasModalLayer()).toBe(false);
  });

  it('外壳确实把内容 portal 到 body（不留在画布 DOM 内）', () => {
    const { unmount } = render(
      createElement(FullscreenShell, { open: true, className: 'probe-shell' }, '正文'),
    );
    const el = document.body.querySelector('.probe-shell');
    expect(el).not.toBeNull();
    expect(el?.textContent).toBe('正文');
    unmount();
    expect(document.body.querySelector('.probe-shell')).toBeNull();
  });
});
