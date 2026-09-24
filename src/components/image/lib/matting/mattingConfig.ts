/**
 * AI 抠图 —— 配置单源（模型 id / 预处理常量 / 取件 URL 派生）。
 *
 * 【对齐 depthVideo/depthUrls.ts 的角色】本文件是该能力片的**路径与常量单源**：
 * 模型文件、ORT 运行时、预处理参数全部只在这里出现一次，别处一律 import。
 *
 * 【资源归属：后端出，前端调】模型与运行时都由 localTool 托管（`runtime-models/matting/`），
 * 浏览器按 `/models/matting/*` 取件 —— 与 `depth-video/vendor/onnxruntime/` 同形态。
 * **本模块不依赖主项目 node_modules 里的 onnxruntime-web**（那是 transformers 的间接依赖，
 * 且违背"运行时由后端出"；详见 docs/plan/148 §4.1）。
 *
 * 【预处理常量为什么是这些值】照抄模型导出时训练口径（演示页 `index.html` 已验证可跑通），
 * **改一个数推理结果就是错的** ⇒ 单测钉死（tests/unit/matting.test.ts）。
 *
 * 【不变量下沉】按 `架构师写新业务代码.md` §0.5：
 *  - 常量与形状 → L1 类型层（写错 `tsc` 报）；
 *  - 取件 URL → L2 唯一入口（`mattingModelUrl`，外部拿不到拼接能力）。
 */

import { runtimeModelUrl } from '@/components/base/core/runtimeModelUrl.ts';

/** 本机模型目录名（= `localTool/runtime-models/matting/`）。 */
export const MATTING_MODEL_ID = 'matting';

/** 模型输入边长（等比缩放后左上对齐，右下补零）。训练口径，勿改。 */
export const MATTING_INPUT_SIZE = 1024;

/** 归一化均值（ImageNet 口径，训练时使用）。 */
export const MATTING_MEAN: readonly [number, number, number] = [123.675, 116.28, 103.53];

/** 归一化标准差（训练时使用）。 */
export const MATTING_STD: readonly [number, number, number] = [58.395, 57.12, 57.375];

/** decoder 输出的低分辨率 mask 边长（`mask_input` 的形状来源）。 */
export const MATTING_MASK_INPUT_SIZE = 256;

/** ORT 运行时所在子目录（`runtime-models/matting/static/ort/`）的相对路径。 */
export const MATTING_ORT_DIR = 'static/ort/';

/** 模型文件相对路径（相对 `<modelId>/` 根）。 */
export const MATTING_FILES = {
  encoder: 'static/models/sam_hq_vit_t_encoder.onnx',
  decoder: 'static/models/sam_hq_vit_t_decoder.onnx',
} as const;

/**
 * 取件 URL（根相对）—— **本能力片的外部**唯一出口**。
 *
 * 【同源铁律】一律返回根相对路径：绝对 URL 会让依赖同源的加载静默失败
 * （`runtimeModelUrl.ts` 头注有实证）。生产由 localTool 18080 托管 dist（天然同源），
 * dev 由 `vite.config.ts` 的 `/models` proxy 补齐。
 *
 * @param relPath 相对 `<modelId>/` 根的路径
 */
export function mattingModelUrl(relPath = ''): string {
  return runtimeModelUrl(MATTING_MODEL_ID, relPath);
}

/** 提示点标签：1 = 前景（正点），0 = 背景（负点）。与模型训练口径一致。 */
export const MATTING_LABEL_FOREGROUND = 1;
export const MATTING_LABEL_BACKGROUND = 0;

/** 点选后批量送推理的防抖间隔（ms）—— 照抄演示页既有行为。 */
export const MATTING_DEBOUNCE_MS = 200;

/** 模型加载超时（ms）：45 MB 首载 + 1024 encoder 推理，给足余量。 */
export const MATTING_LOAD_TIMEOUT_MS = 120_000;

/** 单次推理超时（ms）。 */
export const MATTING_PREDICT_TIMEOUT_MS = 60_000;
