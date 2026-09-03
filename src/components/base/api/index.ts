/**
 * base/api · 网络/API 深模块薄入口。
 *
 * 【深模块化（feat/base-api-deepmodule，2026-08-31）】
 * 把 base/ 的网络/API 层收敛成「内部实现 + 薄入口」的深模块：
 * 外部只从本入口 import（禁绕深层路径），内部文件互引走同目录（如 chatApi → ./proxyGenerate）。
 * 下次改 api 内部实现不影响外部契约。
 *
 * 【范围】已收 7 件：httpClient/pollTask/chatApi/imageApi/videoApi/localToolApi/filesApi。
 * 2026-09-03：proxyGenerate（旧 /api/proxy 出站）已整文件退役——image/video/chat 门面直连 relay
 *（/api/generate + /api/relay），chatApi/imageApi/videoApi 各自接管原逻辑。
 * 外部统一 `import { xxx } from 'base/api/index.ts'`；base/ 内其他文件（assetStore/promptHubStore 等）
 * 作为 api 内部消费者，走 `./api/xxx` 相对路径（后续如收进本模块再统一到入口）。
 *
 * 【契约注意】check-api-contract.cjs 按模块名找导出（不依赖路径），本入口 re-export 保持同名导出。
 */
export * from './httpClient.ts'
export * from './pollTask.ts'
export * from './chatApi.ts'
export * from './imageApi.ts'
export * from './videoApi.ts'
export * from './localToolApi.ts'
export * from './filesApi.ts'
