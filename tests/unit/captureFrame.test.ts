// @vitest-environment jsdom
/**
 * captureFrame / drawVideoFrame 单测（`126` 卡 1：抽帧收口）。
 * 策略：mock document.createElement('video'|'canvas')，手动驱动
 *   (loadeddata) → currentTime setter → seeked → drawImage → toBlob/toDataURL 时序，
 * 断言真实分支（尺寸夹取 / 降采样 / readyState 分支 / 错误文案 / 各失败路径），不是自证式断言。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  captureFrame,
  drawVideoFrame,
  setCrossOriginForReadable,
} from '../../src/components/base/utils/captureFrame.ts';

const nativeCreate = document.createElement.bind(document);
let lastVideo: HTMLVideoElement | null = null;
let lastCanvas: { width: number; height: number; drawImageArgs: unknown[][] } | null = null;
let toBlobArgs: { mime?: string; quality?: number } | null = null;
let toBlobBehavior: 'ok' | 'null' = 'ok';
let ctxBehavior: 'ok' | 'null' = 'ok';
let ctxOptions: unknown = undefined;
let removeAttrArgs: string[] = [];
let loadCalls = 0;

type Handler = (e: unknown) => void;
const handlers = new Map<string, Set<Handler>>();
function fire(video: HTMLVideoElement, type: string) {
  void video;
  for (const fn of [...(handlers.get(type) ?? [])]) fn(new Event(type));
}

beforeEach(() => {
  lastVideo = null;
  lastCanvas = null;
  toBlobArgs = null;
  toBlobBehavior = 'ok';
  ctxBehavior = 'ok';
  ctxOptions = undefined;
  removeAttrArgs = [];
  loadCalls = 0;
  handlers.clear();
  document.createElement = function (tag: any) {
    if (tag === 'video') {
      const v = nativeCreate('video');
      let curTime = 0;
      Object.defineProperty(v, 'currentTime', {
        get: () => curTime,
        set: (t: number) => {
          curTime = t;
          queueMicrotask(() => fire(v, 'seeked'));
        },
        configurable: true,
      });
      Object.defineProperty(v, 'src', { set() {}, get: () => '', configurable: true });
      Object.defineProperty(v, 'videoWidth', { value: 640, writable: true, configurable: true });
      Object.defineProperty(v, 'videoHeight', { value: 360, writable: true, configurable: true });
      Object.defineProperty(v, 'duration', { value: 10, writable: true, configurable: true });
      Object.defineProperty(v, 'readyState', { value: 0, writable: true, configurable: true });
      v.addEventListener = ((type: string, fn: Handler) => {
        if (!handlers.has(type)) handlers.set(type, new Set());
        handlers.get(type)!.add(fn);
      }) as typeof v.addEventListener;
      v.removeEventListener = ((type: string, fn: Handler) => {
        handlers.get(type)?.delete(fn);
      }) as typeof v.removeEventListener;
      v.removeAttribute = ((name: string) => {
        removeAttrArgs.push(name);
      }) as typeof v.removeAttribute;
      (v as unknown as { load: () => void }).load = () => {
        loadCalls += 1;
      };
      lastVideo = v;
      return v;
    }
    if (tag === 'canvas') {
      const c = nativeCreate('canvas');
      const rec = { width: 0, height: 0, drawImageArgs: [] as unknown[][] };
      lastCanvas = rec;
      Object.defineProperty(c, 'width', {
        get: () => rec.width,
        set: (v: number) => {
          rec.width = v;
        },
        configurable: true,
      });
      Object.defineProperty(c, 'height', {
        get: () => rec.height,
        set: (v: number) => {
          rec.height = v;
        },
        configurable: true,
      });
      (c as unknown as { getContext: unknown }).getContext = (_type: string, opts?: unknown) => {
        ctxOptions = opts;
        return ctxBehavior === 'null'
          ? null
          : {
              drawImage: (...args: unknown[]) => {
                rec.drawImageArgs.push(args);
              },
            };
      };
      (c as unknown as { toBlob: unknown }).toBlob = (
        cb: (b: Blob | null) => void,
        mime?: string,
        quality?: number,
      ) => {
        toBlobArgs = { mime, quality };
        cb(toBlobBehavior === 'null' ? null : new Blob(['frame'], { type: mime || 'image/jpeg' }));
      };
      (c as unknown as { toDataURL: unknown }).toDataURL = (mime?: string) =>
        `data:${mime || 'image/jpeg'};base64,ZmFrZQ==`;
      return c;
    }
    return nativeCreate(tag);
  };
});

/** 驱动一次成功流程：loadeddata → (seek) → draw */
async function drive(url = 'http://x/v.mp4', atTime = 3, quality?: number) {
  const p = quality === undefined ? captureFrame(url, atTime) : captureFrame(url, atTime, quality);
  fire(lastVideo!, 'loadeddata');
  await new Promise((r) => setTimeout(r, 0));
  return p;
}

describe('captureFrame — 成功路径', () => {
  it('按视频原尺寸绘制，默认 jpeg 质量 0.55，resolve 出 Blob', async () => {
    const blob = await drive('http://x/v.mp4', 3);
    expect(lastCanvas!.width).toBe(640);
    expect(lastCanvas!.height).toBe(360);
    expect(lastCanvas!.drawImageArgs[0]).toEqual([lastVideo, 0, 0, 640, 360]);
    expect(toBlobArgs).toEqual({ mime: 'image/jpeg', quality: 0.55 });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/jpeg');
  });

  it('自定义质量透传到 toBlob', async () => {
    await drive('http://x/v.mp4', 3, 0.9);
    expect(toBlobArgs!.quality).toBe(0.9);
  });

  it('atTime 超过时长 → 夹取到 duration-0.01', async () => {
    const p = captureFrame('http://x/v.mp4', 20);
    const v = lastVideo!;
    fire(v, 'loadeddata');
    await new Promise((r) => setTimeout(r, 0));
    await p;
    // 原逻辑：Math.min(atTime, Math.max(0, (duration || atTime) - 0.01))
    expect(v.currentTime).toBeCloseTo(9.99, 5);
  });

  it('已在目标时间 → 不 seek，直接绘制', async () => {
    const p = captureFrame('http://x/v.mp4', 0);
    // 目标 = min(0, max(0, 9.99)) = 0，currentTime 初始 0 → 差值 < 0.001 → 立即 draw
    fire(lastVideo!, 'loadeddata');
    await p;
    expect(lastCanvas!.drawImageArgs).toHaveLength(1);
  });

  it('① 对外行为零变化：完成后释放 src（removeAttribute("src") + load()）', async () => {
    await drive();
    expect(removeAttrArgs).toEqual(['src']);
    expect(loadCalls).toBeGreaterThan(0);
  });

  it('① 失败路径同样释放 src（不等同不释放）', async () => {
    const p = captureFrame('http://x/bad.mp4', 1);
    const assertion = expect(p).rejects.toThrow('captureFrame: load error');
    fire(lastVideo!, 'error');
    await assertion;
    expect(removeAttrArgs).toEqual(['src']);
    expect(loadCalls).toBeGreaterThan(0);
  });
});

describe('captureFrame — 失败路径（失败即 reject，不产出假帧）', () => {
  it('视频尺寸为 0 → reject zero dimensions，不创建 canvas', async () => {
    const p = captureFrame('http://x/v.mp4', 1);
    const v = lastVideo!;
    Object.defineProperty(v, 'videoWidth', { value: 0, writable: true, configurable: true });
    fire(v, 'loadeddata');
    await expect(p).rejects.toThrow('captureFrame: zero dimensions');
    expect(lastCanvas).toBeNull();
  });

  it('加载失败 → reject load error', async () => {
    const p = captureFrame('http://x/bad.mp4', 1);
    fire(lastVideo!, 'error');
    await expect(p).rejects.toThrow('captureFrame: load error');
  });

  it('无 2d context → reject no 2d context', async () => {
    ctxBehavior = 'null';
    // 先同步挂上 rejection 断言，再驱动事件（否则 microtask 内 reject 会成 unhandled）
    const p = captureFrame('http://x/v.mp4', 3);
    const assertion = expect(p).rejects.toThrow('captureFrame: no 2d context');
    fire(lastVideo!, 'loadeddata');
    await assertion;
  });

  it('toBlob 返回 null → reject toBlob null', async () => {
    toBlobBehavior = 'null';
    const p = captureFrame('http://x/v.mp4', 3);
    const assertion = expect(p).rejects.toThrow('captureFrame: toBlob null');
    fire(lastVideo!, 'loadeddata');
    await assertion;
  });
});

describe('drawVideoFrame — 底层原语（宿主薄包装共用的"怎么读一帧"）', () => {
  /** 驱动的辅助：造一个宿主 video 元素（底层原语自己不建元素）并设定尺寸 */
  function makeVideo(opts: { vw: number; vh: number }): HTMLVideoElement {
    const v = document.createElement('video') as HTMLVideoElement;
    Object.defineProperty(v, 'videoWidth', { value: opts.vw, writable: true, configurable: true });
    Object.defineProperty(v, 'videoHeight', { value: opts.vh, writable: true, configurable: true });
    return v;
  }

  it('maxSize=480：横向超限按比例缩到 480×270（③ 的路径）', async () => {
    const v = makeVideo({ vw: 1920, vh: 1080 });
    const p = drawVideoFrame(v, { atTime: 2, maxSize: 480 });
    fire(v, 'loadeddata');
    await p;
    expect(lastCanvas!.width).toBe(480);
    expect(lastCanvas!.height).toBe(270);
    expect(lastCanvas!.drawImageArgs[0]).toEqual([v, 0, 0, 480, 270]);
  });

  it('maxSize=480：竖向超限按比例缩到 270×480', async () => {
    const v = makeVideo({ vw: 1080, vh: 1920 });
    const p = drawVideoFrame(v, { atTime: 2, maxSize: 480 });
    fire(v, 'loadeddata');
    await p;
    expect(lastCanvas!.width).toBe(270);
    expect(lastCanvas!.height).toBe(480);
  });

  it('maxSize=800：未超限 → 保持原尺寸（⑤ 的小尺寸素材）', async () => {
    const v = makeVideo({ vw: 640, vh: 360 });
    const p = drawVideoFrame(v, { atTime: 2, maxSize: 800 });
    fire(v, 'loadeddata');
    await p;
    expect(lastCanvas!.width).toBe(640);
    expect(lastCanvas!.height).toBe(360);
  });

  it('waitForLoad:false（宿主自备元素，⑤ 的路径）→ 不等 loadeddata 直接 seek+draw', async () => {
    const v = makeVideo({ vw: 800, vh: 600 });
    const p = drawVideoFrame(v, { atTime: 2, maxSize: 800, waitForLoad: false });
    // 不 fire loadeddata：靠 waitForLoad:false 启动；seeked 由 currentTime setter 的 microtask 触发
    await p;
    expect(lastCanvas!.width).toBe(800);
    expect(lastCanvas!.height).toBe(600);
  });

  it('getContext 不带选项（`willReadFrequently` 已删——无宿主读像素，见 JSDoc）', async () => {
    const v = makeVideo({ vw: 100, vh: 100 });
    const p = drawVideoFrame(v, { atTime: 2 });
    fire(v, 'loadeddata');
    await p;
    expect(ctxOptions).toBeUndefined();
  });

  it('错误文案可被宿主覆盖（各域保留自己的排障文案）', async () => {
    const v = makeVideo({ vw: 0, vh: 0 });
    const p = drawVideoFrame(v, { atTime: 2, errors: { dimensions: '视频尺寸不可用' } });
    const assertion = expect(p).rejects.toThrow('视频尺寸不可用');
    fire(v, 'loadeddata');
    await assertion;
  });

  it('currentTime 赋值抛异常 + 尺寸可用 → 直接绘制当前帧（catch → draw，不是静默失败）', async () => {
    const v = makeVideo({ vw: 640, vh: 360 });
    Object.defineProperty(v, 'currentTime', {
      get: () => 0,
      set: () => {
        throw new Error('seek not allowed');
      },
      configurable: true,
    });
    const p = drawVideoFrame(v, { atTime: 2 });
    fire(v, 'loadeddata');
    await p;
    expect(lastCanvas!.width).toBe(640);
    expect(lastCanvas!.height).toBe(360);
    expect(lastCanvas!.drawImageArgs).toHaveLength(1);
  });

  it('currentTime 抛异常 + 尺寸为 0 → 以 dimensions 拒绝（缺口证据：无"就绪但 0 尺寸"防御）', async () => {
    const v = makeVideo({ vw: 0, vh: 0 });
    Object.defineProperty(v, 'currentTime', {
      get: () => 0,
      set: () => {
        throw new Error('seek not allowed');
      },
      configurable: true,
    });
    const p = drawVideoFrame(v, { atTime: 2 });
    const assertion = expect(p).rejects.toThrow('captureFrame: zero dimensions');
    fire(v, 'loadeddata');
    await assertion;
    expect(lastCanvas).toBeNull();
  });

  it('load error 文案可覆盖（⑤ 的 "Video load failed"）', async () => {
    const v = makeVideo({ vw: 100, vh: 100 });
    const p = drawVideoFrame(v, { atTime: 1, errors: { load: 'Video load failed' } });
    const assertion = expect(p).rejects.toThrow('Video load failed');
    fire(v, 'error');
    await assertion;
  });
});

describe('setCrossOriginForReadable - crossOrigin 单点裁决（TD-22-1：同源不设 / 真跨源才设）', () => {
  it('同源（相对路径 / blob: / data:）→ 不设 crossOrigin（canvas 保持可读）', () => {
    for (const url of ['/files/a.mp4', 'blob:abc', 'data:video/mp4;base64,xx']) {
      const v = document.createElement('video');
      setCrossOriginForReadable(v, url);
      expect(v.crossOrigin).toBeFalsy(); // 旧实现（恒设 anonymous）在此先红：污染 canvas
    }
  });

  it('真跨源（绝对 http 外链）→ 设 anonymous（读像素需 CORS）', () => {
    const v = document.createElement('video');
    setCrossOriginForReadable(v, 'https://example.com/v.mp4');
    expect(v.crossOrigin).toBe('anonymous');
  });
});
