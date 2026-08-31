/**
 * base/api · 网络/API 深模块薄入口。
 *
 * 【深模块化试点（feat/base-api-deepmodule，2026-08-31）】
 * 目标：把 base/ 的网络/API 层收敛成「内部实现 + 薄入口」的深模块——
 * 外部只从本入口 import，内部文件互引走同目录（如 proxyGenerate → ./httpClient），
 * 下次改 api 内部实现不影响外部契约。
 *
 * 【当前范围】试点仅收 httpClient/proxyGenerate/pollTask 3 件；
 * 其余 api（chatApi/imageApi/videoApi/localToolApi/filesApi）仍在 base/ 根，
 * 推广时再收进来补进本入口。
 *
 * 【契约注意】check-api-contract.cjs 按模块名（如 httpClient/proxyGenerate/pollTask）
 * 找导出，不依赖路径——本入口 re-export 保持同名导出即可（见该脚本模块映射）。
 */
export type {
  HttpRequestOptions,
  ErrorDetail,
} from './httpClient.ts'
export {
  NetworkError,
  HttpError,
  extractErrorDetail,
  httpRequest,
  httpPost,
  httpRequestLogged,
} from './httpClient.ts'
export { chatProxy, imageProxy, videoProxy } from './proxyGenerate.ts'
export { pollOneTask, initTaskRecovery } from './pollTask.ts'
