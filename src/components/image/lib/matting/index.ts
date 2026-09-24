/**
 * AI 抠图能力片 —— 子域门面（`image/lib/matting/` 的唯一对外出口）。
 *
 * 【门面 = 用例编排入口，不是导出清单】（`ADR-0044` §8：消费者说的是"我要做**这件事**"，
 * 不是"我要这几个符号"）。
 *
 *   ❌ 纯转发的门面（本文件 2026-09-24 首版就是这么写的，已推翻）
 *      —— 它把 `loadSessions / encode / predict` 三段时序摊给调用方，
 *      消费者被迫知道「先编码、再推理、sessions 要复用」，还得自己在 UI 里判三次失败。
 *      换成第二个消费者（批量抠图 / 换图重算）就得把这段编排**再抄一遍**。
 *
 *   ✅ 编排层（现在）—— 把「一次抠图」封成一个用例 `runMatting()`：
 *      内部自己走「装载 → 编码 → 推理 → 出图」，**消费者只关心"给我这张图的抠图结果"**。
 *
 * 【两个用例】
 *  1. `createMattingSession()` —— 会话（图片级的昂贵资源：模型装载 + encoder 编码各一次）
 *  2. `session.cutout(points)`   —— 抠图（每次点选重跑 decoder，复用已编码的 embedding）
 *
 * 为什么拆成「会话 + 抠图」而不是一个 `runMatting(image, points)`：
 * **encoder 编码要几秒**（1024×1024 推理），而用户会**反复点**微调 mask。
 * 若每次点选都完整跑一遍，交互不可用 ⇒ 会话负责"编码一次"，`cutout` 负责"常常跑"。
 * 这不是泄漏内部细节 —— 它正是用户可感知的交互契约（"点一下要立刻响应"）。
 *
 * 【收编了什么】（首版被迫外露、现已隐藏）
 *  - `MattingSessions` / `MattingEmbedding` —— 内部概念，消费者不需要知道有两段 ONNX；
 *  - `loadMattingSessions` / `encodeImage` / `predictMask` 三段时序 —— 编排进 `createMattingSession`；
 *  - `toPromptPoint` / `drawParamsFor` / `toImageCoords` 的**调用顺序** —— 收进 `cutout` 入参换算；
 *  - 模型空间坐标 —— 消费者只说**原图像素坐标**，换算由本层做。
 *
 * 【不露什么】`mattingModelUrl`（取件 URL 是能力片内部的事，外部拿到只会去拼路径 =
 * 第二处裸拼）· ORT 会话 · 张量形状 · 预处理常量（除展示用的输入边长）。
 *
 * 【消费者】`image/editors/MattingEditor.tsx`（在该目录**之外** ⇒ 满足
 * `ADR-0042` 深模块的「被边界之外消费」）。
 *
 * 【失败契约】两个用例都返回 `MattingResult`（判别联合，`code` + `message`）——
 * 消费者**不处理 `ok:false` 就取不到 data**（`tsc` 逼）。
 */

import {
  MATTING_DEBOUNCE_MS,
  MATTING_LABEL_BACKGROUND,
  MATTING_LABEL_FOREGROUND,
} from './mattingConfig.ts';
import { drawParamsFor, toImageCoords } from './mattingEngine.ts';
import { disposeMatting, encodeImage, loadMattingSessions, predictMask } from './mattingLoader.ts';
import type { MattingResult } from './mattingLoader.ts';

/* ── 对外展示用常量 ──
 * 【只露"用户可感知的事实"】判据：**编辑器要在 UI 上显示它吗？**
 *  - ✅ `MATTING_DEBOUNCE_MS` → 编辑器用它排防抖定时器（交互行为的一部分）
 *  - ❌ 不露 `MATTING_INPUT_SIZE` → 曾想显示「输入 1024px」，但那是**模型内部参数**，
 *    用户看不懂也用不上（2026-09-24 撤回：露了什么 ≠ 该露什么）
 *  - ❌ 不露 `MATTING_LABEL_*`：`'fg'/'bg' → 1/0` 是**内部编码**，消费者只说 `kind`
 *  - ❌ 不露 `MATTING_MEAN`/`STD`/`MASK_INPUT_SIZE`：用户永远看不到
 */
export { MATTING_DEBOUNCE_MS };
export type { MattingResult };

/** 一次点选（**原图像素坐标**；换算到模型空间由本层负责）。 */
export interface MattingPoint {
  /** 原图坐标 X（不是显示坐标、不是模型坐标） */
  readonly x: number;
  /** 原图坐标 Y */
  readonly y: number;
  /** `'fg'` = 正点（物体内部）· `'bg'` = 负点（背景） */
  readonly kind: 'fg' | 'bg';
}

/**
 * 一次抠图会话：持有已编码的图片 embedding。
 *
 * 生命周期由调用方掌握（编辑器打开时建、关闭时 `dispose()`）——
 * 对齐 `depthVideo` 的 G2（时机按需）/ G3（释放）两道闸门。
 */
export interface MattingSession {
  /** 原图尺寸（会话建立时确定，供 UI 展示） */
  readonly width: number;
  readonly height: number;
  /**
   * 抠图：给定点选（**原图像素坐标**）→ 原图尺寸的 alpha 通道（前景 255 / 背景 0）。
   *
   * 调用方拿到 alpha 后自行合成透明 PNG —— 本层不碰 canvas（那是渲染的职责）。
   */
  cutout(points: readonly MattingPoint[]): Promise<MattingResult<Uint8ClampedArray>>;
  /** 释放模型会话（G3）。幂等。 */
  dispose(): void;
}

/** 建立会话所需的原图（调用方从 canvas 取出像素后传入）。 */
export interface MattingSource {
  /** RGBA 像素（长度 = width*height*4） */
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

/**
 * 用例 1 · 建立抠图会话：**装载模型 + 编码图片**（各一次）。
 *
 * 这是本能力片唯一的重入口 —— 调用方（编辑器）在**打开时调用一次**，
 * 之后每次点选只走 `session.cutout()`。
 *
 * 内部编排（全部收在本层，消费者不可见）：
 *   ① 装载 ORT 运行时 + encoder/decoder 会话（懒加载单例，跨会话复用）
 *   ② 预处理（等比缩到 1024 / 归一化 / 左上对齐右下补零）
 *   ③ encoder 推理 → 两路 embedding（缓存进会话）
 */
export async function createMattingSession(
  source: MattingSource,
): Promise<MattingResult<MattingSession>> {
  const { data, width, height } = source;
  if (!(width > 0) || !(height > 0) || data.length !== width * height * 4) {
    return {
      ok: false,
      code: 'EncodeFailed',
      message: `抠图：源图像素尺寸不符（${width}×${height}，实得 ${data.length} 字节）`,
    };
  }

  // ① 装载（懒加载单例：多个会话复用同一份模型会话）
  const loaded = await loadMattingSessions();
  if (!loaded.ok) return loaded;

  // ② + ③ 预处理与编码（缩放参数在此推导，消费者传的是原图）
  const { drawW, drawH, scale } = drawParamsFor(width, height);
  const encoded = await encodeImage(loaded.data, { data, width, height, drawW, drawH, scale });
  if (!encoded.ok) return encoded;

  const sessions = loaded.data;
  const embedding = encoded.data;

  return {
    ok: true,
    data: {
      width,
      height,
      async cutout(points: readonly MattingPoint[]): Promise<MattingResult<Uint8ClampedArray>> {
        if (points.length === 0) {
          return { ok: false, code: 'PredictFailed', message: '抠图：没有提示点' };
        }
        // 原图坐标 → 模型空间坐标（含 label 映射）由本层做，消费者只说原图坐标
        const prompt = points.map((p) => ({
          x: p.x * scale,
          y: p.y * scale,
          label: p.kind === 'fg' ? MATTING_LABEL_FOREGROUND : MATTING_LABEL_BACKGROUND,
        }));
        const pred = await predictMask(sessions, embedding, prompt, width, height);
        if (!pred.ok) return pred;
        // logits → alpha（阈值 0）也收在本层：消费者拿到的就是可直接用的 alpha
        const { alphaFromLogits } = await import('./mattingEngine.ts');
        return { ok: true, data: alphaFromLogits(pred.data) };
      },
      dispose(): void {
        disposeMatting();
      },
    },
  };
}

/**
 * 用例 2 · 显示坐标 → 原图坐标（**纯函数**，供画布交互换算）。
 *
 * 为什么这个留在门面：编辑器在 canvas 上接 pointer 事件，拿到的是**显示坐标**；
 * 它必须先转成原图坐标才能调 `cutout`。这一步是「抠图交互」用例的一部分
 * （不是通用工具），故随用例一起出。
 */
export function displayToImageCoords(
  point: { readonly x: number; readonly y: number },
  displayScale: number,
): { x: number; y: number } {
  return toImageCoords(point, displayScale);
}
