/**
 * LazyImage 关键交互锚点（P9 懒加载复用原语）。
 *
 * LazyImage 是全局懒加载图片复用组件（复刻官方 Lg.jsx）：
 * IntersectionObserver（rootMargin 120px）判定进入视口附近才挂载 <img>，
 * 避免大画布多图/素材网格一次性解码全部图片。
 *
 * 本文件锁定最易回归的 3 条语义：
 *  - 懒加载：未进入视口不挂载 <img>（只留占位 div）；进入视口才挂载
 *  - 降级：无 IntersectionObserver 环境直接显示（不依赖 IO）
 *  - 兜底：加载失败显示「破图占位」，不再保留裂图
 */
import { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

/**
 * 收口：LazyImage 显示出口统一走 useRenderAssetResolver（原生 render 出口）——
 * 本地 /files/ 走按需小图端点；外部 http / data: 回退原绝对地址；空串保持空。
 */

// 统一出口：resolveAssetUrl(render) — 本地 /files/ → 缩略图端点；http 原样/补绝对；空/非字符串原样
vi.mock('../../src/components/base/utils/assetUrl.ts', () => ({
  useRenderAssetResolver: () => (u: any) => {
    if (!u || typeof u !== 'string') return u;
    if (u.startsWith('/files/')) return `THUMB${u}`;
    if (u.startsWith('http://127.0.0.1:18080/files/'))
      return `THUMB${u.slice(u.indexOf('/files/'))}`;
    return u;
  },
}));

// appSettings（thumbnailOn）：useRenderAssetResolver 读取 —— mock 提供默认 true
vi.mock('../../src/components/base/store/appSettings.ts', () => ({
  useAppSettings: () => ({ thumbnailOn: true }),
}));

import LazyImage from '../../src/components/base/ui/LazyImage.tsx';
// 期望值取自**真实**归一原语（assetUrl.ts 在本文件被 mock，故从 core/utils 取同一实现的真源）
import { toAbsoluteFileUrl } from '../../src/components/base/core/utils.ts';

// 可操控的 IntersectionObserver 假实现：手动触发回调驱动「进入视口」
const h = vi.hoisted(() => {
  class FakeIO {
    cb: (entries: unknown, observer: unknown) => void;
    static instances: FakeIO[] = [];
    constructor(cb: any) {
      this.cb = cb;
      FakeIO.instances.push(this);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  return { FakeIO };
});

const triggerIntersect = (entries: any) => {
  act(() => {
    for (const io of h.FakeIO.instances) io.cb(entries, io);
  });
};

beforeEach(() => {
  h.FakeIO.instances = [];
  global.IntersectionObserver = h.FakeIO as unknown as typeof IntersectionObserver;
});

describe('LazyImage — 懒加载语义', () => {
  it('未进入视口 → 只留占位 div，不挂载 <img>（延迟解码）', () => {
    render(<LazyImage src="http://x/a.png" />);
    expect(document.querySelector('img')).toBeNull();
    expect(h.FakeIO.instances.length).toBe(1);
  });

  it('未相交 → 保持不挂载；进入视口（isIntersecting）才挂载 <img>', () => {
    render(<LazyImage src="http://x/b.png" />);
    triggerIntersect([{ isIntersecting: false }]);
    expect(document.querySelector('img')).toBeNull();

    triggerIntersect([{ isIntersecting: true }]);
    const img = document.querySelector('img')!;
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('http://x/b.png');
  });

  it('相对 /files/ 路径 → 经 render 出按需小图端点（本地图收口）', () => {
    render(<LazyImage src="/files/pic.png" />);
    triggerIntersect([{ isIntersecting: true }]);
    const img = document.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('THUMB/files/pic.png');
  });

  it('绝对本地 URL → 还原相对出按需小图（DB 存量形态）', () => {
    render(<LazyImage src="http://127.0.0.1:18080/files/tasks/x.png" />);
    triggerIntersect([{ isIntersecting: true }]);
    const img = document.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('THUMB/files/tasks/x.png');
  });
});

describe('LazyImage — 降级与兜底', () => {
  it('无 IntersectionObserver（旧环境）→ 直接挂载，不依赖 IO', () => {
    delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
    render(<LazyImage src="http://x/c.png" />);
    expect(document.querySelector('img')).toBeTruthy();
  });

  it('加载失败 → 显示「破图占位」，不再保留 <img>', () => {
    render(<LazyImage src="http://x/d.png" />);
    triggerIntersect([{ isIntersecting: true }]);
    const img = document.querySelector('img')!;
    expect(img).toBeTruthy();

    fireEvent.error(img);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('图片加载失败')).toBeTruthy();
  });

  it('本地图：小图失败 → 先回退原图；原图也失败才占位（两段回退·唯一实现）', () => {
    // 2026-09-17 收口：此前本组件「失败即占位」，缺回退原图 → 缩略图端点对不可缩源
    // （webp 等）返回 4xx/5xx 时，画布节点（有回退）能显示、助手气泡（本组件）只显示占位。
    render(<LazyImage src="/files/web/a.webp" />);
    triggerIntersect([{ isIntersecting: true }]);
    const img = () => document.querySelector('img');
    expect(img()?.getAttribute('src')).toBe('THUMB/files/web/a.webp');

    // ① 小图失败 → 回退原图，且**回退地址必须是归一后的可加载地址**
    //（回归教训：直接回退裸相对 `/files/…` 会让 <img> 在画布页 5180 上 404 → 缩略图变「加载失败」）
    fireEvent.error(img()!);
    expect(img()?.getAttribute('src')).toBe(toAbsoluteFileUrl('/files/web/a.webp'));

    // ② 原图也失败 → 才显式占位
    fireEvent.error(img()!);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('图片加载失败')).toBeTruthy();
  });

  it('eager → 不依赖 IntersectionObserver，挂载即出 <img>（小缩略图不被懒加载门槛卡住）', () => {
    // 回归教训：ResourceStrip 的 40×40 缩略图走 IO 懒加载，画布 transform 容器里可见性判定一旦不触发
    // 就渲染 null，叠在 bg-black 上＝永久黑块（且无失败提示）。懒加载是优化，不得成为"能否显示"的前提。
    render(<LazyImage src="http://x/e.png" eager />);
    expect(document.querySelector('img')).toBeTruthy();
    expect(document.querySelector('img')?.getAttribute('src')).toBe('http://x/e.png');
  });

  it('src 为空 → 永不挂载 <img>', () => {
    render(<LazyImage src="" />);
    triggerIntersect([{ isIntersecting: true }]);
    expect(document.querySelector('img')).toBeNull();
  });
});
