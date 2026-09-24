/**
 * AI 抠图 —— 模型运行时装载 / 推理 / 释放（对齐 `depthVideo/loader.ts` 的角色）。
 *
 * 【三道闸门（照抄 depthVideo 的 G1/G2/G3）】
 *  - **G1 代码按需**：ORT 运行时**不在首屏** —— 只在本文件内以「动态 import + @vite-ignore 注释」
 *    加载（45 MB 模型 + 11 MB wasm，静态 import 会污染所有环境的首屏 chunk）。
 *  - **G2 时机按需**：`loadSessions()` 只在用户打开抠图编辑器时调用；
 *    `encode()` 在图片就绪时**一次**；`predict()` 在点选防抖后。
 *  - **G3 释放**：`disposeMatting()` 清会话单例；组件层在卸载时调用。
 *
 * 【失败契约：判别联合，不是 throw】（`ADR-0002/0003` + `架构师写新业务代码.md` §1.2 🔴红线）
 * 「预期会失败」的每条路径都返回 `MattingResult`（带 `code` + `message`），
 * 让调用方**不处理就取不到 data**（`tsc` 逼）。
 * **`throw` 只留给"不该发生"**：张量形状与 `mattingConfig` 断言不符（= 模型换了、代码该改）。
 *
 * 【运行时来源：后端出，前端调】ORT bundle 取自本机模型目录（`/models/matting/static/ort/`），
 * 与 `depth-video/vendor/onnxruntime/` 同形态。**不 import 主项目 node_modules 的 onnxruntime-web**。
 *
 * 【单线程降级】全仓未开 COOP/COEP ⇒ `SharedArrayBuffer` 不可用 ⇒ threaded wasm 起不来。
 * 故显式 `numThreads = 1`（不要求 SAB）。**这是有意的 fail-soft，不是缺陷**（代价：推理变慢）。
 */

import {
  MATTING_FILES,
  MATTING_LOAD_TIMEOUT_MS,
  MATTING_ORT_DIR,
  MATTING_PREDICT_TIMEOUT_MS,
  mattingModelUrl,
} from './mattingConfig.ts';
import { normalizeInto } from './mattingEngine.ts';
import { withTimeout } from '@/components/base/utils/net/asyncGuard.ts';
import { logger } from '@/components/base/core/log/logger.ts';

/** 失败码（本能力片私有字面量联合；**不用 enum**）。 */
export type MattingErrorCode =
  'ModelMissing' | 'EngineLoadFailed' | 'EncodeFailed' | 'PredictFailed';

/** 统一返回契约：判别联合，失败带可展示文案。 */
export type MattingResult<T> =
  { ok: true; data: T } | { ok: false; code: MattingErrorCode; message: string };

/**
 * ORT 运行时模块的最小可用契约（只声明本文件用到的成员，避免把库类型拖进主包）。
 * 对应按裸路径动态 import 的 `ort.bundle.min.mjs`。
 */
interface OrtModule {
  env: { wasm: { wasmPaths?: string; numThreads?: number } };
  Tensor: new (type: string, data: Float32Array, dims: readonly number[]) => unknown;
  InferenceSession: {
    create(path: string, options?: Record<string, unknown>): Promise<OrtSession>;
  };
}

/** 一次推理会话（encoder / decoder 各一）。 */
interface OrtSession {
  inputNames: readonly string[];
  outputNames: readonly string[];
  run(feeds: Record<string, unknown>): Promise<Record<string, OrtTensor>>;
}

/** ORT 张量（只取本文件用到的形状与数据）。 */
interface OrtTensor {
  readonly dims: readonly number[];
  readonly data: Float32Array;
}

/** 装载完成后的会话对。 */
export interface MattingSessions {
  readonly ort: OrtModule;
  readonly encoder: OrtSession;
  readonly decoder: OrtSession;
}

/** encoder 输出的两路 embedding 缓存（换图或换模型才失效）。 */
export interface MattingEmbedding {
  readonly image: OrtTensor;
  readonly interm: OrtTensor;
}

/** 一次要点（已换算到模型空间坐标）。 */
export interface MattingPromptPoint {
  readonly x: number;
  readonly y: number;
  /** 1 = 前景，0 = 背景 */
  readonly label: number;
}

/** 预处理输入：原图 ImageData（组件层已从 canvas 取出）。 */
export interface MattingSourceImage {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
  /** 预处理后原图在 1024 画布上的绘制宽（= 缩放系数推导结果，`encodeImage` 用它定循环边界）*/
  readonly drawW: number;
  readonly drawH: number;
}

// 模块级会话单例：同一会话幂等复用；disposeMatting 统一清空。
let sessionsSingleton: Promise<MattingSessions> | null = null;

/** 把未知异常转成可展示文案（**不吞错，只归一话术**）。 */
function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * 装载 ORT 运行时 + encoder/decoder 会话（懒加载单例）。
 *
 * 幂等：同一页面多次调用复用同一 Promise；失败时**置空**（下次重试不是复用坏结果）。
 */
export function loadMattingSessions(): Promise<MattingResult<MattingSessions>> {
  sessionsSingleton ??= (async (): Promise<MattingSessions> => {
    let ort: OrtModule;
    try {
      // G1：运行时按需动态加载（非静态 import ⇒ 不进首屏 chunk）
      ort = (await withTimeout(
        import(/* @vite-ignore */ mattingModelUrl(`${MATTING_ORT_DIR}ort.bundle.min.mjs`)),
        MATTING_LOAD_TIMEOUT_MS,
        '抠图运行时加载超时',
      )) as OrtModule;
    } catch (e) {
      throw new MattingLoadError('EngineLoadFailed', `抠图运行时加载失败：${messageOf(e)}`);
    }

    // wasm 与模型同源（根相对）；单线程（无 COOP/COEP ⇒ 无 SharedArrayBuffer）
    ort.env.wasm.wasmPaths = mattingModelUrl(MATTING_ORT_DIR);
    ort.env.wasm.numThreads = 1;

    try {
      const [encoder, decoder] = await withTimeout(
        Promise.all([
          ort.InferenceSession.create(mattingModelUrl(MATTING_FILES.encoder), {
            graphOptimizationLevel: 'all',
          }),
          ort.InferenceSession.create(mattingModelUrl(MATTING_FILES.decoder), {
            graphOptimizationLevel: 'all',
          }),
        ]),
        MATTING_LOAD_TIMEOUT_MS,
        '抠图模型加载超时',
      );
      return { ort, encoder, decoder };
    } catch (e) {
      // 模型缺失是最常见的失败：库会明确报 404 / not found，原样透出
      throw new MattingLoadError('ModelMissing', `抠图模型加载失败：${messageOf(e)}`);
    }
  })().catch((e: unknown) => {
    sessionsSingleton = null; // 失败置空 ⇒ 下次重试
    throw e;
  });

  return sessionsSingleton.then(
    (sessions): MattingResult<MattingSessions> => ({ ok: true, data: sessions }),
    (e: unknown): MattingResult<MattingSessions> => ({
      ok: false,
      code: e instanceof MattingLoadError ? e.code : 'EngineLoadFailed',
      message: messageOf(e),
    }),
  );
}

/** 内部错误载体（携带 code，供上面统一转判别联合）。 */
class MattingLoadError extends Error {
  constructor(
    readonly code: MattingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'MattingLoadError';
  }
}

/**
 * 预处理 + encoder 推理 → 两路 embedding。
 *
 * 预处理口径（**照抄训练时做法**）：等比缩放到最长边 1024、**左上对齐、右下补零**、
 * 按 `MEAN`/`STD` 归一化、CHW 排布。
 *
 * 编码只做一次（换图才重跑）；后续点选只跑 decoder —— 这是交互流畅的关键。
 */
export async function encodeImage(
  sessions: MattingSessions,
  src: MattingSourceImage,
): Promise<MattingResult<MattingEmbedding>> {
  try {
    const { MATTING_INPUT_SIZE } = await import('./mattingConfig.ts');
    const plane = MATTING_INPUT_SIZE * MATTING_INPUT_SIZE;
    const arr = new Float32Array(3 * plane);

    // 原图像素 → 1024 空间（左上对齐；右下保持 0，因画布初值透明 ⇒ 归一化后为 -MEAN/STD）
    const { data, width, drawW, drawH } = src;
    for (let y = 0; y < drawH; y += 1) {
      for (let x = 0; x < drawW; x += 1) {
        const srcIdx = (y * width + x) * 4;
        const dstIdx = y * MATTING_INPUT_SIZE + x;
        // 归一化走 mattingEngine 唯一实现（MEAN/STD 只在 mattingConfig 定义一次）
        normalizeInto(arr, plane, dstIdx, data[srcIdx], data[srcIdx + 1], data[srcIdx + 2]);
      }
    }

    const input = new sessions.ort.Tensor('float32', arr, [
      1,
      3,
      MATTING_INPUT_SIZE,
      MATTING_INPUT_SIZE,
    ]);
    const out = await withTimeout(
      sessions.encoder.run({ input_image: input }),
      MATTING_PREDICT_TIMEOUT_MS,
      '抠图编码超时',
    );

    const [imageName, intermName] = sessions.encoder.outputNames;
    const image = out[imageName];
    const interm = out[intermName];
    if (!image || !interm) {
      // 模型换了但代码没改 ⇒ 编程错误，不是运行时失败 ⇒ 抛
      throw new Error(
        `抠图：encoder 输出与预期不符（期望两路 embedding，实得 ${sessions.encoder.outputNames.join(', ')}）`,
      );
    }
    return { ok: true, data: { image, interm } };
  } catch (e) {
    logger.debug('AI抠图', 'encode 失败', { message: messageOf(e) });
    return { ok: false, code: 'EncodeFailed', message: `抠图编码失败：${messageOf(e)}` };
  }
}

/**
 * decoder 推理 → 原图尺寸的 mask logits（`>0` 即前景）。
 *
 * @param points 提示点（**已换算到模型空间坐标**，label 1/0）
 * @param origW/origH 原图尺寸（模型据此把低分辨率 mask 上采样回来）
 */
export async function predictMask(
  sessions: MattingSessions,
  embedding: MattingEmbedding,
  points: readonly MattingPromptPoint[],
  origW: number,
  origH: number,
): Promise<MattingResult<Float32Array>> {
  if (points.length === 0) {
    return { ok: false, code: 'PredictFailed', message: '抠图：没有提示点' };
  }
  try {
    const { MATTING_MASK_INPUT_SIZE } = await import('./mattingConfig.ts');
    const n = points.length;
    const coords = new Float32Array(n * 2);
    const labels = new Float32Array(n);
    points.forEach((p, i) => {
      coords[i * 2] = p.x;
      coords[i * 2 + 1] = p.y;
      labels[i] = p.label;
    });

    const out = await withTimeout(
      sessions.decoder.run({
        image_embeddings: embedding.image,
        interm_embeddings: embedding.interm,
        point_coords: new sessions.ort.Tensor('float32', coords, [1, n, 2]),
        point_labels: new sessions.ort.Tensor('float32', labels, [1, n]),
        mask_input: new sessions.ort.Tensor(
          'float32',
          new Float32Array(MATTING_MASK_INPUT_SIZE * MATTING_MASK_INPUT_SIZE),
          [1, 1, MATTING_MASK_INPUT_SIZE, MATTING_MASK_INPUT_SIZE],
        ),
        has_mask_input: new sessions.ort.Tensor('float32', new Float32Array([0]), [1]),
        orig_im_size: new sessions.ort.Tensor('float32', new Float32Array([origH, origW]), [2]),
      }),
      MATTING_PREDICT_TIMEOUT_MS,
      '抠图推理超时',
    );

    const maskName = sessions.decoder.outputNames[0];
    const mask = out[maskName];
    if (!mask) {
      throw new Error(
        `抠图：decoder 输出与预期不符（实得 ${sessions.decoder.outputNames.join(', ')}）`,
      );
    }
    return { ok: true, data: mask.data };
  } catch (e) {
    logger.debug('AI抠图', 'predict 失败', { message: messageOf(e) });
    return { ok: false, code: 'PredictFailed', message: `抠图推理失败：${messageOf(e)}` };
  }
}

/** 释放会话单例（G3）：关编辑器 / 换模型时调用。 */
export function disposeMatting(): void {
  sessionsSingleton = null;
}
