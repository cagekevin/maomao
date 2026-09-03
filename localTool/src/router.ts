/**
 * 声明式路由表 + 匹配器 + 中间件骨架
 *
 * 目的：把 index.ts 里 ~190 行命令式 `if (pathname === ... && method === ...)` 链
 * 收敛为一张可读的路由表。新增端点 = 在 routes 表追加一行，不改分发逻辑。
 *
 * 设计约定：
 *  - 顺序即优先级：表中靠前的先匹配 → 精确路由放前、正则放中、
 *    catch-all 透传作为表中【最后一项】且标 `catchAll: true`，404 由 index.ts 兜底。
 *  - handler 第三参固定为 `url: URL`（router 命名路由总会传入）：
 *      * 不需要第三参的 handler 直接放（少参数函数可赋值给多参数签名，类型安全）；
 *      * 需要 `string id` 的 handler 一律用闭包从 `url.pathname` 提取，
 *        禁止把 `id: string` 签名直接塞进 `url: URL` 字段（否则 tsc 报错）。
 *  - 中间件为预留钩子：本表支持 `middleware` 数组，为后续统一鉴权 / 错误脱敏 /
 *    body 限制留好接入点（本次只搭骨架，不实现具体逻辑）。
 *
 * 相关方案：docs/11-路由表重构方案-2026-08-17.md
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import { json } from './utils/helpers.js';
import { getBaselinePath } from './paths.js';

import { handleKvGet, handleKvSet, handleKvDelete } from './routes/kv.js';
import {
  handleUpload, handleRead, handleThumbnail, handleMkdir, handleMove,
  handleOpen, handleOpenDir, handleList,
} from './routes/files.js';
import {
  handleTasksGet, handleTasksSave, handleTasksBatchSave, handleTasksDelete,
  handleTasksBatchDelete, handleTasksClear,
} from './routes/tasks.js';
import { handleLogsPost, handleLogsStream } from './routes/logs.js';
import {
  handleResourcesGet, handleResourcesSave, handleResourcesBatchSave,
  handleResourcesDelete, handleResourcesClear, handleResourcesRescan,
  handleResourcesRename,
} from './routes/resources.js';
import { handleStatus, handleJianyingSend, handleGatewayTask } from './routes/system.js';
import { handleProjectsGet, handleProjectsSave } from './routes/projects.js';
import { handlePluginManifest, handleWorkflowAppsByProject, handleBuiltin, handleModels } from './routes/platform.js';
import {
  handleAdminStats, handleAdminCleanup, handleAdminExport, handleAdminImport,
  handleAdminKvList, handleAdminClearCache,
} from './routes/admin.js';
import {
  handleOfficialUser, handleOfficialEntitlements, handleOfficialVipCheck, handleOfficialInvalidate,
} from './routes/official.js';
import { handleAgentChat } from './routes/agentChat.js';
import { handleGenerateSubmit, handleGenerateGet, handleGenerateCancel } from './routes/generate.js';
import { handleProvidersGet, handleProvidersPut, handleConfigBasePut, handleProviderTest, handleProviderProbeAsync, handleProviderFetchModels } from './routes/providers.js';
import { handlePassthrough } from './routes/passthrough.js';
import {
  handleLocalPatchCrop, handleLocalPatchMerge, handleLocalPatchFingerprint,
} from './routes/localPatch.js';

// handler 第三参统一为 url:URL。无需第三参者少参直接放；需 string id 者闭包提取。
// 返回值允许 boolean：catch-all 的 handlePassthrough 返回 Promise<boolean>（转发判定），
// 其余 handler 返回 void 即可（void 可赋值给 void|boolean 联合）。
export type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
) => void | Promise<void | boolean>;

export interface Route {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | '*';
  // 精确字符串（全等，如 '/api/status'）或 RegExp（如 /^\/api\/agent\/[^/]+\/chat$/）
  pattern: string | RegExp;
  handler: Handler;
  // 可选：该路由专属中间件（按顺序执行，返回 false 则中断）
  middleware?: RouteMiddleware[];
  // 可选：标记为 catch-all 透传（命中后须复刻 if(passthrough())return; else 404）
  catchAll?: boolean;
}

export type RouteMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
) => boolean | void | Promise<boolean | void>;

const PORT = Number(process.env.PORT) || 18080;

// ── /api/sync/default 本地兜底（A2）──
// 原为 index.ts 内联逻辑：读 data/apiConfigs.baseline.json 并替换占位 URL。
async function handleSyncDefault(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const baselinePath = getBaselinePath();
    const raw = fs.readFileSync(baselinePath, 'utf-8');
    const replaced = raw.replace(/\{VITE_API_BASE_URL\}/g, `http://127.0.0.1:${PORT}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(replaced);
    return;
  } catch {
    return json(res, { apiConfigs: [] }); // 降级：无基线文件时返空
  }
}

// ── 需 string id 第三参的闭包适配 ──
// router 命名路由只传 url，不保证字段顺序；带 id 的 handler 在此自行从 url.pathname 提取。
const agentChatHandler: Handler = (req, res, url) => {
  const m = url.pathname.match(/^\/api\/agent\/([^/]+)\/chat$/);
  return handleAgentChat(req, res, m ? m[1] : '');
};

// ── 路由表（顺序即优先级）──
export const routes: Route[] = [
  // ── 系统 ──
  { method: 'GET',  pattern: '/api/status', handler: handleStatus },
  { method: 'POST', pattern: '/api/logs',   handler: handleLogsPost },
  { method: 'GET',  pattern: '/api/logs/stream', handler: handleLogsStream },

  // ── Generate（统一生成入口：按 capability 分流聊天/图片/视频；submit 即返 taskId + GET attach，
  //   句柄由 relay-poll 常驻轮询。/api/relay 已于 2026-09-03 并入本端点，路由删除）──
  { method: 'POST', pattern: '/api/generate', handler: handleGenerateSubmit },
  { method: 'POST', pattern: /^\/api\/generate\/[^/]+\/cancel$/, handler: handleGenerateCancel },
  { method: 'GET',  pattern: /^\/api\/generate\/[^/]+$/, handler: handleGenerateGet },

  // ── Providers（配置型：一个平台一个 JSON，读 config/providers/；测连/拉模型委托 ai-relay）──
  { method: 'GET',  pattern: '/api/providers', handler: handleProvidersGet },
  { method: 'PUT',  pattern: '/api/providers', handler: handleProvidersPut },
  { method: 'PUT',  pattern: '/api/config/base', handler: handleConfigBasePut },
  { method: 'POST', pattern: '/api/providers/test-connection', handler: handleProviderTest },
  { method: 'POST', pattern: '/api/providers/probe-async', handler: handleProviderProbeAsync },
  { method: 'POST', pattern: /^\/api\/providers\/[^/]+\/fetch-models$/, handler: handleProviderFetchModels },

  // ── KV ──
  { method: 'GET',  pattern: '/api/kv/get',    handler: handleKvGet },
  { method: 'POST', pattern: '/api/kv/set',    handler: handleKvSet },
  { method: 'POST', pattern: '/api/kv/delete', handler: handleKvDelete },

  // ── 文件操作 ──
  { method: 'POST', pattern: '/api/files/upload',    handler: handleUpload },
  { method: 'GET',  pattern: '/api/files/read',      handler: handleRead },
  { method: 'GET',  pattern: '/api/files/thumbnail', handler: handleThumbnail },
  { method: 'POST', pattern: '/api/files/mkdir',     handler: handleMkdir },
  { method: 'POST', pattern: '/api/files/move',      handler: handleMove },
  { method: 'GET',  pattern: '/api/files/open',      handler: handleOpen },
  { method: 'GET',  pattern: '/api/files/open-dir',  handler: handleOpenDir },
  { method: 'GET',  pattern: '/api/files/list',      handler: handleList },

  // ── Tasks ──
  { method: 'GET',  pattern: '/api/tasks',           handler: handleTasksGet },
  { method: 'POST', pattern: '/api/tasks/save',      handler: handleTasksSave },
  { method: 'POST', pattern: '/api/tasks/batch-save', handler: handleTasksBatchSave },
  { method: 'POST', pattern: '/api/tasks/delete',    handler: handleTasksDelete },
  { method: 'POST', pattern: '/api/tasks/batch-delete', handler: handleTasksBatchDelete },
  { method: 'POST', pattern: '/api/tasks/clear',     handler: handleTasksClear },

  // ── Projects ──
  { method: 'GET',  pattern: '/api/projects',      handler: handleProjectsGet },
  { method: 'POST', pattern: '/api/projects/save', handler: handleProjectsSave },

  // ── Resources ──
  { method: 'GET',  pattern: '/api/resources',        handler: handleResourcesGet },
  { method: 'POST', pattern: '/api/resources/save',   handler: handleResourcesSave },
  { method: 'POST', pattern: '/api/resources/batch-save', handler: handleResourcesBatchSave },
  { method: 'POST', pattern: '/api/resources/delete', handler: handleResourcesDelete },
  { method: 'POST', pattern: '/api/resources/clear',  handler: handleResourcesClear },
  { method: 'POST', pattern: '/api/resources/rescan', handler: handleResourcesRescan },
  { method: 'POST', pattern: '/api/resources/rename', handler: handleResourcesRename },

  // ── 特惠视频任务查询 ──
  { method: 'GET', pattern: /^\/api\/v1\/gateway\/task\/[^/]+$/, handler: handleGatewayTask },

  // ── 剪映 ──
  { method: 'POST', pattern: '/api/jianying/send', handler: handleJianyingSend },

  // ── 平台 ──
  { method: 'GET', pattern: '/plugin/manifest.json', handler: handlePluginManifest },
  // startsWith 前缀路由：原 pathname.startsWith('/api/workflow-apps/by-project/')
  { method: 'GET', pattern: /^\/api\/workflow-apps\/by-project\//, handler: handleWorkflowAppsByProject },
  { method: 'GET', pattern: '/api/public/platform/builtin', handler: handleBuiltin },
  { method: 'GET', pattern: '/api/public/platform/models',  handler: handleModels },

  // ── 官方权益接口转发层 ──
  { method: 'GET',  pattern: '/api/user/info', handler: handleOfficialUser },
  { method: 'GET',  pattern: '/api/user/model-entitlements', handler: handleOfficialEntitlements },
  { method: 'GET',  pattern: /^\/api\/agent\/[^/]+\/vip-check$/, handler: handleOfficialVipCheck },
  // AI 操控画布：A1 本地 Agent chat（SSE 透传）
  { method: 'POST', pattern: /^\/api\/agent\/([^/]+)\/chat$/, handler: agentChatHandler },
  { method: 'POST', pattern: '/api/official/entitlements/invalidate', handler: handleOfficialInvalidate },

  // ── 管理 ──
  { method: 'GET',  pattern: '/api/admin/stats',      handler: handleAdminStats },
  { method: 'GET',  pattern: '/api/admin/kv-list',    handler: handleAdminKvList },
  { method: 'POST', pattern: '/api/admin/clear-cache', handler: handleAdminClearCache },
  { method: 'POST', pattern: '/api/admin/cleanup',    handler: handleAdminCleanup },
  { method: 'GET',  pattern: '/api/admin/export',     handler: handleAdminExport },
  { method: 'POST', pattern: '/api/admin/import',     handler: handleAdminImport },

  // ── sync/default 本地兜底（A2）──
  { method: 'GET', pattern: '/api/sync/default', handler: handleSyncDefault },

  // ── assets/upload 别名（L5）：双路径单 handler，拆两表项 ──
  { method: 'POST', pattern: '/api/assets/upload',    handler: handleUpload },
  { method: 'POST', pattern: '/api/upload/app-asset', handler: handleUpload },

  // ── 局部提取与图像融合（local-patch）──
  { method: 'POST', pattern: '/api/local-patch/crop',        handler: handleLocalPatchCrop },
  { method: 'POST', pattern: '/api/local-patch/merge',       handler: handleLocalPatchMerge },
  { method: 'POST', pattern: '/api/local-patch/fingerprint', handler: handleLocalPatchFingerprint },

  // ── catch-all 透传（必须最后，标 catchAll）──
  // pattern 用永远命中的正则；是否转发由 handlePassthrough 内部判定（isLocalOnlyPath）。
  // 404 由 index.ts 在阶段 4 复刻 `if (passthrough())return; else sendError 404` 兜底。
  { method: '*', pattern: /.*/, handler: handlePassthrough, catchAll: true },
];

/**
 * 匹配器：按表顺序返回第一个命中的路由（含 catch-all）。
 * @returns 命中表项；null 表示连 catch-all 都没命中（本表不会出现，索引恒返回 catch-all）
 */
export function matchRoute(
  routes: Route[],
  method: string,
  pathname: string,
): { route: Route; params?: RegExpMatchArray } | null {
  const m = method.toUpperCase();
  for (const route of routes) {
    if (route.method !== '*' && route.method !== m) continue;
    if (route.catchAll) return { route };           // catch-all 永远命中（必须放表末）
    if (typeof route.pattern === 'string') {
      if (route.pattern === pathname) return { route };   // 精确全等
    } else {
      const matched = pathname.match(route.pattern);
      if (matched) return { route, params: matched };
    }
  }
  return null;
}
