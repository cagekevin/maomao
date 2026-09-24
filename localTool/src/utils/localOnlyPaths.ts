/**
 * localOnlyPaths — 「只属于本机、绝不出站」的路径前缀**唯一真源**（TD-08-33 收口）。
 *
 * 【为什么必须独立成模块】这条判据此前以**字面量清单**散在两处：
 *  ① `index.ts` 的分派分支与前端托管排除条件（`/files/`、`/plugin/`）；
 *  ② `routes/passthrough.ts` 自持的 `LOCAL_ONLY_PREFIXES`（外加 `/.well-known/`）。
 * 两份清单靠人同步 ⇒ **每新增一条本地路由要改两处，漏一处就等于把该前缀的请求发出外网**。
 * 实证缺口：`/depth-video/`（本机推理资源）只在 ① 有、② 没有 —— 其 GET 未命中
 * `handleDepthResource` 时会落进 catch-all，被 `handlePassthrough` **转发外网**（本地资源外泄 + 白等超时）。
 *
 * 【为什么放在 utils/ 而不是 index.ts 或 passthrough.ts】两个消费方是「分派器」（`index.ts`）与
 * 「透传层」（`routes/passthrough.ts`）；后者不能 import 前者（`index.ts` 已 import 透传层，反过来会成环）。
 * 故真源落在**双方都能依赖的低层**，两边都从这里取，不再各写一份。
 *
 * 【反向判据（加前缀时怎么做）】新增一条本机接管的前缀 → **只在这里加一行**：
 *   - `index.ts` 的分派分支用本文件的具名常量（`PREFIX_*`）判断；
 *   - 前端托管的排除条件用 `isLocalOnlyPath()` 派生；
 *   - 透传层用 `isLocalOnlyPath()` 拒绝转发。
 * 三者同一份事实，**不存在"忘记同步另一处"这个失败模式**。
 */

/** 本机磁盘文件服务前缀（`handleStaticFile`）。 */
export const PREFIX_FILES = '/files/';
/**
 * 本机模型资产前缀（`/models/<modelId>/*` → `runtime-models/<modelId>/`；见 `paths.ts`）。
 *
 * 【与前端同值】`src/components/base/core/runtimeModelUrl.ts` 持有同一事实的另一侧（前端据此拼取件 URL）。
 * 跨栈无法共享模块 ⇒ 两侧必须同值，由 `check:arch` 的 `CROSS_STACK_CONSTS` 逐字对账（PREFIX_MODELS 项）。
 */
export const PREFIX_MODELS = '/models/';
/** 本机推理资源前缀（**历史别名**：`/depth-video/*` 与 `/models/depth-video/*` 指向同一物理根）。 */
export const PREFIX_DEPTH_VIDEO = '/depth-video/';
/** 本机插件清单前缀。 */
export const PREFIX_PLUGIN = '/plugin/';
/** 浏览器 / DevTools 自发探测前缀（`com.chrome.devtools.json` 等）：本地不接、不转发、不记日志。 */
export const PREFIX_WELL_KNOWN = '/.well-known/';

/**
 * 「本地专属、不转发」的路径前缀全集。
 *
 * 语义边界：命中 = 这条路径**由本机处理**（存在与否都轮不到上游），故 catch-all **不得**接管；
 * 未命中且无具名路由 = 才轮到透传（上游 API 路径如 `/v1/...`）。
 */
export const LOCAL_ONLY_PREFIXES: readonly string[] = [
  PREFIX_FILES,
  PREFIX_MODELS,
  PREFIX_DEPTH_VIDEO,
  PREFIX_PLUGIN,
  PREFIX_WELL_KNOWN,
];

/** 判断是否为本地专属路径（不转发给上游）。 */
export function isLocalOnlyPath(pathname: string): boolean {
  return LOCAL_ONLY_PREFIXES.some((p) => pathname.startsWith(p));
}
