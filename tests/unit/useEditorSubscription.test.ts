// @vitest-environment jsdom
/**
 * useEditor —— 订阅面收窄（TD-04-40）。
 *
 * 锁三件事：
 *  ① 传 store 名 ⇒ **只订阅那几个**（原实现无条件订阅全部 7 个 ⇒ 播放期 `playback` 每帧通知，
 *     只读 `timeline` 的组件被**每帧连坐重渲**）；
 *  ② 不传参 ⇒ 订阅全部 7 个（向后兼容，新调用点不确定时的安全默认）；
 *  ③ **行为面**：订阅面之外的 store 变更**不得**触发重渲（这才是"收窄"的真正效果）。
 *
 * 用**假 engine** 注入：被测的是本 hook 的**订阅面与重渲时机**，不是 engine 内部实现。
 * 假件只实现真实契约面（每个 manager 的 `subscribe`）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const h = vi.hoisted(() => {
  const mk = () => {
    const listeners = new Set<() => void>();
    return {
      listeners,
      subscribe(l: () => void) {
        listeners.add(l);
        return () => listeners.delete(l);
      },
      emit() {
        for (const l of [...listeners]) l();
      },
    };
  };
  return {
    managers: {
      playback: mk(),
      timeline: mk(),
      scenes: mk(),
      project: mk(),
      media: mk(),
      renderer: mk(),
      selection: mk(),
    },
  };
});

vi.mock('@/components/videoEditor/engine/core', () => ({
  EditorCore: { getInstance: () => h.managers },
}));

const { useEditor } = await import('@/components/videoEditor/hooks-cutia/use-editor');

beforeEach(() => {
  for (const m of Object.values(h.managers)) m.listeners.clear();
  vi.restoreAllMocks();
});

const ALL = [
  'playback',
  'timeline',
  'scenes',
  'project',
  'media',
  'renderer',
  'selection',
] as const;

describe('useEditor — 订阅面收窄（TD-04-40）', () => {
  it("useEditor('timeline') 只订阅 timeline，其余 6 个一个都不订", () => {
    const spies = Object.fromEntries(
      ALL.map((k) => [k, vi.spyOn(h.managers[k], 'subscribe')]),
    ) as Record<(typeof ALL)[number], ReturnType<typeof vi.fn>>;

    renderHook(() => useEditor('timeline'));

    expect(spies.timeline).toHaveBeenCalledTimes(1);
    for (const k of ALL.filter((x) => x !== 'timeline')) {
      expect(spies[k], `${k} 不该被订阅`).not.toHaveBeenCalled();
    }
  });

  it('不传参 ⇒ 订阅全部 7 个（向后兼容的安全默认）', () => {
    const spies = Object.fromEntries(
      ALL.map((k) => [k, vi.spyOn(h.managers[k], 'subscribe')]),
    ) as Record<(typeof ALL)[number], ReturnType<typeof vi.fn>>;

    renderHook(() => useEditor());

    for (const k of ALL) expect(spies[k], `${k} 应被订阅`).toHaveBeenCalledTimes(1);
  });

  it("订阅面之外的 store 变更不触发重渲；面内的才触发（useEditor('timeline')）", () => {
    // 反证：把 use-editor.ts 改回「无条件订阅 7 个」⇒ 第一次 emit(playback) 就会 +1 ⇒ 本断言红。
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useEditor('timeline');
    });
    const base = renders;

    act(() => h.managers.playback.emit());
    expect(renders, 'playback 不在订阅面内，不该重渲').toBe(base);

    act(() => h.managers.scenes.emit());
    expect(renders, 'scenes 不在订阅面内，不该重渲').toBe(base);

    act(() => h.managers.timeline.emit());
    expect(renders, 'timeline 在订阅面内，必须重渲').toBe(base + 1);
  });
});
