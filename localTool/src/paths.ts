/**
 * 路径真源 — 统一管理所有运行时文件路径。
 *
 * 替代散落在 5 个文件里的 import.meta.url + __dirname 拼装。
 * 原因：esbuild --bundle 把多文件塌成单文件 dist/index.js 后，
 * 各文件 __dirname 层数变化导致 ../../ 指向错误（key 全丢）。
 *
 * 基于 process.cwd()（正常启动时为 localTool/ 目录），
 * 不依赖 __dirname（打包后位置不可预测）。
 * 支持 MAOMAO_ROOT 环境变量覆盖（测试隔离用）。
 */

import path from 'node:path';

/** localTool 根目录（process.cwd() 或 MAOMAO_ROOT 覆盖） */
function getRoot(): string {
  if (process.env.MAOMAO_ROOT) return process.env.MAOMAO_ROOT;
  return process.cwd();
}

/** localTool/.env（支持 MAOMAO_ENV_FILE 覆盖） */
export function getEnvFile(): string {
  return process.env.MAOMAO_ENV_FILE || path.join(getRoot(), '.env');
}

/**
 * localTool/providers.default.json —— 出厂默认 provider 清单（模板/种子）。
 *
 * 【定位】只读种子文件：仅在某平台尚无 config/providers/<id>.json 时用于首次播种，
 * 播种后即为运行时真源，本文件不再被读取、更不被写入。
 * 历史名 api.config.json 已退役（曾与运行态双源漂移）；保留 MAOMAO_CONFIG_FILE 覆盖以兼容脚本。
 */
export function getProviderSeedFile(): string {
  return process.env.MAOMAO_CONFIG_FILE || path.join(getRoot(), 'providers.default.json');
}

/** localTool/data/apiConfigs.baseline.json */
export function getBaselinePath(): string {
  return path.join(getRoot(), 'data', 'apiConfigs.baseline.json');
}

/** localTool/logs/ */
export function getLogsDir(): string {
  return path.join(getRoot(), 'logs');
}

/** 项目根 maomao/dist/（前端构建产物） */
export function getFrontendDistDir(): string {
  return path.join(getRoot(), '..', 'dist');
}

/**
 * 本机模型资产根 —— **「模型文件物理落点」的唯一真源**（`ADR-0057` 收口 · plan 147 §一）。
 *
 * 一个模型一个目录：`runtime-models/<modelId>/`（`MANIFEST.json` + `README.md` 入库，其余不进 git）。
 * 物理收进 `localTool/runtime-models/`（与 `data/`、`logs/` 这类运行时目录并列）⇒ **不随前端构建产物走**，
 * 几百 MB 权重绝不进 `dist/`、不进扩展包 —— 这正是它区别于 `public/` 的判据。
 *
 * 【URL ≠ 物理路径】浏览器按 `/models/<modelId>/*` 取件（`index.ts` 宿主分支做 URL→物理根映射）；
 * 深度视频保留历史前缀 `/depth-video/*` 作别名，由同一函数派生（见 `utils/localOnlyPaths.ts`）。
 *
 * 【跨语言边界（已知且登记）】`scripts/runtime-model.mjs` / `scripts/aliyun-models.py` 是 Node/Python，
 * **无法 import 本文件**，各自以脚本自身位置为锚（`../runtime-models`）—— 不是"落点判据的第二份"，
 * 而是"脚本自身位置"的派生；防漂移由 `runtime-model.mjs doctor` 实测该锚点、错则红。
 *
 * 【与 getFrontendDistDir()/getLogsDir() 同构】全部基于 getRoot() + MAOMAO_ROOT 覆盖（测试隔离用）。
 */
export function getRuntimeModelDir(modelId: string): string {
  return path.join(getRoot(), 'runtime-models', modelId);
}

/**
 * 深度视频模型目录名（`runtime-models/depth-video/`）。
 *
 * 单列出来是因为它**同时是历史 URL 前缀 `/depth-video/*` 的别名源** —— 该前缀按 §4 保留，
 * 由 `getRuntimeModelDir(DEPTH_VIDEO_MODEL_ID)` 派生同一物理根，故别名不引入第二份落点。
 */
export const DEPTH_VIDEO_MODEL_ID = 'depth-video';
