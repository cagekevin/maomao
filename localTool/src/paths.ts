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

/** localTool/api.config.json（支持 MAOMAO_CONFIG_FILE 覆盖） */
export function getApiConfigFile(): string {
  return process.env.MAOMAO_CONFIG_FILE || path.join(getRoot(), 'api.config.json');
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
 * 本机推理资源根（vendor + models，供浏览器运行时按 URL 读）。
 * 物理收进 localTool/runtime-models/（与 data/、logs/ 这类运行时目录并列），
 * 当前工具再下一层 depth-video/；未来可并列 rembg/ 等工具子目录。
 * 说明：浏览器 URL 保持简短的 /depth-video/*（见 index.ts 静态分支做 URL→物理根映射），
 * 物理路径 ≠ URL 路径。models/（几十 MB 权重）已 .gitignore，不入库/CI。
 * 与 getFrontendDistDir()/getLogsDir() 同构 —— 全部基于 getRoot() + MAOMAO_ROOT 覆盖。
 */
export function getDepthVideoDir(): string {
  return path.join(getRoot(), 'runtime-models', 'depth-video');
}
