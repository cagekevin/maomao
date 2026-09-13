// @vitest-environment jsdom
/**
 * useVideoPoster 单测（批 3）。
 * 覆盖 useVideoPoster(url, enabled)：
 *   - enabled=false → 不创建 <video>，posterUrl 保持 ''
 *   - enabled=true → 加载视频并 seek 后通过 canvas.toDataURL 产出 poster dataURL
 * 更新(2026-09-13)：抽帧已收口到 `base/utils/captureFrame.ts` 的 `drawVideoFrame`，它用
 * `addEventListener`（API 不为测试让步）→ 本文件的白盒驱动由「调 `onxxx` 属性处理器」改为
 * 「**派发真实事件**」；**行为断言（`result.current` 匹配 `^data:`）一行不动**。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { useVideoPoster } = await import('../../src/hooks/useVideoPoster.ts');

// 仅取一次原生 createElement，避免 beforeEach 重复包装使 orig 指向 wrapper 造成递归
const nativeCreate = document.createElement.bind(document);
let lastVideo = null;
/** 让 `currentTime` 赋值抛异常（模拟"不可 seek"的媒体），用于锁定迁移声明的那处差异。 */
let throwOnSeek = false;

beforeEach(() => {
  lastVideo = null;
  throwOnSeek = false;
  // jsdom 未实现 media load/play，stub 避免 Not implemented 报错中断 effect
  HTMLMediaElement.prototype.load = function () {};
  HTMLMediaElement.prototype.play = function () {
    return Promise.resolve();
  };
  // 全局 canvas mock
  // getContext 是多重载签名（2d/webgl/...），替身只覆盖 2d 分支，故集中断言一次。
  // 内层断言到明确的 CanvasRenderingContext2D：原写法 ReturnType<typeof getContext> 会取到
  // 最后一个重载（非 2d），语义其实不准。
  HTMLCanvasElement.prototype.getContext = (() =>
    ({
      fillStyle: '',
      fillRect() {},
      drawImage() {},
    }) as unknown as CanvasRenderingContext2D) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toDataURL = function (type) {
    return `data:${type || 'image/jpeg'};base64,${btoa('posterframe')}`;
  };
  // video 工厂：元素创建后，在下一 tick **派发真实事件**（loadeddata → seeked）
  document.createElement = function (tag) {
    if (tag === 'video') {
      const v = nativeCreate('video');
      // 真实抽帧路径里 seeked 触发时尺寸必然 > 0（原语对 0 尺寸按 dimensions 错误拒绝 →
      // 一样拿不到封面，可观测行为等价）；不设则成功路径无法走通。
      Object.defineProperty(v, 'videoWidth', { value: 640, configurable: true });
      Object.defineProperty(v, 'videoHeight', { value: 360, configurable: true });
      Object.defineProperty(v, 'src', {
        set(_val) {
          queueMicrotask(() => {
            v.dispatchEvent(new Event('loadeddata'));
          });
        },
        get() {
          return '';
        },
        configurable: true,
      });
      Object.defineProperty(v, 'currentTime', {
        set(_t) {
          if (throwOnSeek) throw new Error('seek not allowed');
          queueMicrotask(() => {
            v.dispatchEvent(new Event('seeked'));
          });
        },
        get() {
          return 0;
        },
        configurable: true,
      });
      lastVideo = v;
      return v;
    }
    return nativeCreate(tag);
  };
});

describe('useVideoPoster', () => {
  it('enabled=false → 不创建 video，poster 为空串', () => {
    const { result } = renderHook(() => useVideoPoster('http://x/v.mp4', false));
    // hook 直接返回 posterUrl 字符串（非对象）
    expect(result.current).toBe('');
    expect(lastVideo).toBeNull();
  });

  it('enabled=true → seek 后产出 poster dataURL', async () => {
    const { result } = renderHook(() => useVideoPoster('http://x/v.mp4', true));
    // 等待 microtask 链：loadeddata → currentTime setter → seeked → draw → toDataURL
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    // hook 直接返回 posterUrl 字符串（非对象）
    expect(result.current).toMatch(/^data:image/);
  });

  it('【差异锁定】currentTime 赋值抛异常 + 尺寸可用 → 仍产出 poster（原实现此处静默回退空串）', async () => {
    // 迁移声明的那处边缘差异：原 hook `try{v.currentTime=0.05}catch{}` = 不绘制；
    // 抽帧原语 `catch { draw() }` = 直接绘制当前帧。本用例锁住新行为，防止悄悄漂回。
    throwOnSeek = true;
    const { result } = renderHook(() => useVideoPoster('http://x/v.mp4', true));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current).toMatch(/^data:image/);
  });
});
