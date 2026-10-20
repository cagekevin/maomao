/**
 * jsdom 缺口的 DOM 替身（canvas / createElement）。
 *
 * 【为什么这里允许"一次断言"】jsdom 不实现 canvas 2D、也没有视频解码，测试只能给替身；
 * 而替身**只实现被测真正读到的成员**（`fillStyle` / `drawImage` …），不是完整 DOM 对象，
 * 且 `getContext` / `createElement` 都是多重载签名（2d / webgl / 各 tag）。这是库与替身之间
 * 的真实形状差，无法用"补全所有成员"消除。
 *
 * 【与旧写法的区别】此前每个测试文件各写一次 `as unknown as CanvasRenderingContext2D`
 * 再接 `as unknown as typeof getContext`（**双重**断言，且把"我到底少实现了什么"藏起来）。
 * 现在收敛到本文件：**每个出口只有一次单层断言** + 一份统一说明（TD-18-49 / plan 150 §11.1 簇 D）。
 */
import { vi } from 'vitest';

/**
 * 只含被测成员的 2D 上下文替身。
 * 形参用 `Record<string, unknown>` 而不是 `Partial<CanvasRenderingContext2D>`：后者会强迫
 * 替身方法也满足完整签名（如 `getImageData(): ImageData` 要求 colorSpace/width/height），
 * 而那正是我们要表达"jsdom 没有真实现"的地方。
 */
export function fakeContext2d(partial: Record<string, unknown> = {}): CanvasRenderingContext2D {
  return {
    fillStyle: '',
    strokeStyle: '',
    fillRect() {},
    clearRect() {},
    drawImage() {},
    ...partial,
  } as unknown as CanvasRenderingContext2D;
}

/**
 * 把 2D 上下文替身装到 `HTMLCanvasElement.prototype.getContext`（只覆盖 2d 分支）。
 *
 * `getContext` 是**多重载**（2d / webgl / bitmaprenderer …），返回类型互不兼容 ⇒ 任何"只实现 2d"
 * 的替身都无法与它单步互转，只能 `as unknown as`。这是**本仓唯一允许的双重断言位置**，
 * 因为它代表的是「jsdom 不实现 canvas」这一真实能力缺口，而不是把类型谎报成能过。
 */
export function stubCanvas2d(
  partialOrFactory:
    Record<string, unknown> | ((canvas: HTMLCanvasElement) => Record<string, unknown>) = {},
): void {
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
    const partial =
      typeof partialOrFactory === 'function' ? partialOrFactory(this) : partialOrFactory;
    return fakeContext2d(partial);
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

/** 假 canvas 元素（jsdom 的 canvas 无 2D 上下文，故自带 getContext）。 */
export function fakeCanvas(
  opts: {
    width?: number;
    height?: number;
    /** 已建好的上下文替身（原样返回）或成员表（内部包装成替身）；null = 无上下文 */
    context?: unknown;
    toDataURL?: (type?: string) => string;
    toBlob?: (cb: (blob: Blob | null) => void) => void;
  } = {},
): HTMLCanvasElement {
  const raw = opts.context;
  const isContextLike = (v: unknown): v is CanvasRenderingContext2D =>
    typeof v === 'object' && v !== null && 'fillStyle' in v;
  // 同上：假元素缺 300+ 个 HTMLElement 成员，只能 `as unknown as`（同属 jsdom 能力缺口）
  return {
    width: opts.width ?? 0,
    height: opts.height ?? 0,
    getContext: () => {
      if (raw === undefined || raw === null) return null;
      return isContextLike(raw) ? raw : fakeContext2d(raw as Record<string, unknown>);
    },
    toDataURL: opts.toDataURL ?? (() => ''),
    toBlob: opts.toBlob ?? (() => {}),
  } as unknown as HTMLCanvasElement;
}

/**
 * 用受控实现替换 `document.createElement`（按 tag 分派）。
 * 形参是"单参函数"，而真实类型是重载 ⇒ 此处一次单层断言，调用点不再各自断言。
 */
export function stubCreateElement(impl: (tag: string) => unknown) {
  const spy = vi
    .spyOn(document, 'createElement')
    .mockImplementation(impl as unknown as typeof document.createElement);
  return spy;
}
