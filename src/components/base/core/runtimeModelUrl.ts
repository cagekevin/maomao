/**
 * 本机模型资产取件出口 —— 浏览器侧 URL 前缀的**唯一真源**（plan 147 §一 / §2.5）。
 *
 * 【为什么必须独立成模块】模型文件的物理落点是 `localTool/runtime-models/<modelId>/`
 * （真源 = `localTool/src/paths.ts::getRuntimeModelDir`，跨栈无法共享）⇒ 前端只持"URL 前缀"这半边事实。
 * 散在各消费点写 `/models/…` 字面量 = 同一条判据 N 份载体（一归闸）。
 *
 * 【同源铁律（有实证，非偏好）】一律返回**根相对**路径（不以 `http` 开头、不以 `./` 开头）：
 * 绝对 URL 会让 transformers.js 的处理器组装静默失败（`this.processor is not a function`，
 * 见 `video/depthVideo/depthUrls.ts` 头注）；MediaPipe / three 的取件同理必须与页面同源。
 * 生产：页面由 localTool 18080 托管 `dist/`（页面与模型同源，零配置）；
 * 开发：由 `vite.config.ts` 的 `server.proxy` 把 `/models` 转发到 18080（保持同源，不引入第二套 URL 口径）。
 *
 * 【与后端的关系】本文件的 `PREFIX_MODELS` 与 `localTool/src/utils/localOnlyPaths.ts` 的
 * `PREFIX_MODELS` 是**跨栈同一事实的两侧**（后端据此拒绝把本机路径转发外网）—— 由 `check:arch`
 * 的 `CROSS_STACK_CONSTS` 逐字对账，单边改动即红。
 *
 * 【不是 `RUNTIME_MODELS`】`video/depthVideo/depthUrls.ts` 的 `RUNTIME_MODELS` 是**深度视频专属**那套
 * 路径（含 transformers / onnxruntime 的 vendor 布局与 `/depth-video` 历史前缀别名），与本模块的通用
 * 取件出口是**两个判据**，勿合并。
 */

/** 本机模型资产 URL 前缀（与后端同值，见头注）。 */
export const PREFIX_MODELS = '/models/';

/**
 * 拼某模型下某文件的取件 URL（根相对）。
 *
 * @param modelId 模型目录名（= `localTool/runtime-models/<modelId>/`）
 * @param relPath 相对 `<modelId>/` 根的路径；开头的 `/` 会被规整掉
 */
export function runtimeModelUrl(modelId: string, relPath = ''): string {
  const rel = relPath.replace(/^\/+/, '');
  return rel ? `${PREFIX_MODELS}${modelId}/${rel}` : `${PREFIX_MODELS}${modelId}`;
}
