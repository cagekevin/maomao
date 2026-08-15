/**
 * 猫猫AI画布 — 本地工具服务 (localTool Service)
 * 替代闭源 Go 二进制，监听 18080 端口
 *
 * 用法：node dist/index.js
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createServer } from 'node:net';
import { getDb, closeDb, getUploadDir, getDataDir, backupDb, startBackupSchedule } from './db/database.js';
import { json, sendError } from './utils/helpers.js';
import { handleKvGet, handleKvSet, handleKvDelete } from './routes/kv.js';
import { handleUpload, handleRead, handleThumbnail, handleMkdir, handleMove, handleOpen, handleOpenDir, handleList } from './routes/files.js';
import { handleTasksGet, handleTasksSave, handleTasksBatchSave, handleTasksDelete, handleTasksBatchDelete, handleTasksClear } from './routes/tasks.js';
import { handleResourcesGet, handleResourcesSave, handleResourcesBatchSave, handleResourcesDelete, handleResourcesClear, handleResourcesRescan, handleResourcesRename } from './routes/resources.js';
import { handleStatus, handleProxy, handleJianyingSend, handleGatewayTask } from './routes/system.js';
import { handleProjectsGet, handleProjectsSave } from './routes/projects.js';
import { handlePluginManifest, handleWorkflowAppsByProject, handleBuiltin, handleModels } from './routes/platform.js';
import { handleAdminStats, handleAdminCleanup, handleAdminExport, handleAdminImport, handleAdminKvList, handleAdminClearCache } from './routes/admin.js';
import { handleOfficialUser, handleOfficialEntitlements, handleOfficialVipCheck, handleOfficialInvalidate } from './routes/official.js';
import { handleAgentChat } from './routes/agentChat.js';
import { handleProvidersGet, handleProvidersPut, handleProviderTest, handleProviderFetchModels, handleConfigBasePut } from './routes/providers.js';
// catch-all 兜底透传：未命中本地具名路由的请求原样转发官方（详见 routes/passthrough.ts 文件头）
// 这是「改 dist base 指向 18080」的硬前置——否则未接管的 /api/* 会直接 404。
import { handlePassthrough } from './routes/passthrough.js';

// ── 轻量 .env 加载（无 dotenv 依赖，localTool 仅 sql.js 一个运行时依赖）──
// 读取 <localTool 根>/<项目根>/localTool/.env，注入 process.env。
// 用途：LLM_CHAT_BASE_URL / LLM_CHAT_API_KEY / AI_CANVAS_ENHANCE 等 AI 操控画布配置。
function loadDotEnv(): void {
  const candidates = [
    path.join(__dirname, '..', '.env'),              // localTool/dist/ → localTool/.env
    path.join(__dirname, '.env'),                    // localTool/       → localTool/.env
    path.join(process.cwd(), '.env'),                // 从 localTool 根启动
  ];
  for (const envPath of candidates) {
    try {
      const raw = fs.readFileSync(envPath, 'utf-8');
      for (const line of raw.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        const key = m[1];
        let val = m[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = val;
      }
      return; // 找到并加载完成
    } catch {
      // 该路径不存在，尝试下一个
    }
  }
}

// ESM 兼容：Node.js ES 模块无 __dirname，手动构造
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 必须在 __dirname 定义之后调用（TDZ：const 声明前访问会抛 ReferenceError）
loadDotEnv();

const PORT = Number(process.env.PORT) || 18080;
const VERSION = '1.4.2';

// 高频轮询端点（心跳/配置同步/资源缓存）不打印，避免日志刷屏
// 这些由画布前端每秒轮询，无业务价值；代理类已在 system.ts 单独打 [proxy] 日志
const SILENT_LOG_PATHS = new Set([
  '/api/status',
  '/api/kv/get',
  '/api/kv/set',
  '/api/resources',
  '/api/resources/rescan',
  '/api/tasks',
  '/api/proxy',
  '/api/providers',
]);

// ── 端口冲突检测 ──
function checkPortAvailable(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`18080 端口被占用，请先退出原版引擎或其他服务`));
      } else {
        reject(err);
      }
    });
    server.once('listening', () => {
      server.close(() => resolve());
    });
    server.listen(port, '127.0.0.1');
  });
}

// ── 静态文件服务（/files/* 路径映射到磁盘）──
function handleStaticFile(req: http.IncomingMessage, res: http.ServerResponse, urlPath: string): boolean {
  if (!urlPath.startsWith('/files/')) return false;

  const uploadDir = getUploadDir();
  // url.pathname 是 percent-encoded 的（new URL().pathname 不自动解码）。
  // 中文 subfolder（如 migrated/人物）经浏览器编码成 %E4%BA%BA%E7%89%A9 后，此处必须解码才能命中磁盘真实目录。
  let relativePath = urlPath.replace(/^\/files\//, '');
  try {
    relativePath = decodeURIComponent(relativePath);
  } catch {
    // 非法编码保留原样，交给下方 existsSync 判 404
  }
  const filePath = path.join(uploadDir, relativePath);

  // 安全检查：防止路径遍历
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(path.resolve(uploadDir))) {
    sendError(res, 'Forbidden', 403);
    return true;
  }

  if (!fs.existsSync(resolvedPath)) {
    sendError(res, 'File not found', 404);
    return true;
  }

  if (fs.statSync(resolvedPath).isDirectory()) {
    sendError(res, 'Is a directory', 400);
    return true;
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
  };

  const contentType = mimeMap[ext] || 'application/octet-stream';
  const stat = fs.statSync(resolvedPath);

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stat.size,
    'Cache-Control': 'public, max-age=31536000', // 静态文件长期缓存
  });
  fs.createReadStream(resolvedPath).pipe(res);
  return true;
}

// ── 画布前端页面托管（dist/ 静态资源）──
const DIST_DIR = path.join(__dirname, '..', '..', 'dist');
const FRONTEND_MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};
function handleFrontendPage(res: http.ServerResponse, urlPath: string): boolean {
  const fileName = (urlPath === '/' || urlPath === '/index.html') ? 'index.html' : urlPath.replace(/^\//, '');
  const filePath = path.join(DIST_DIR, fileName);
  if (!fs.existsSync(filePath)) return false;
  const ext = path.extname(filePath).toLowerCase();
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    'Content-Type': FRONTEND_MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': 'public, max-age=3600',
  });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

// ── 主路由 ──
async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  const pathname = url.pathname;
  const method = (req.method || 'GET').toUpperCase();

  // CORS 预检
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 静态文件服务
  if (method === 'GET' && pathname.startsWith('/files/')) {
    if (handleStaticFile(req, res, pathname)) return;
  }

  // 仅打印有意义的请求；高频轮询端点（见 SILENT_LOG_PATHS）静默处理
  if (!SILENT_LOG_PATHS.has(pathname)) {
    console.log(`[${method}] ${pathname}`);
  }

  try {
    // ── 系统 ──
    if (pathname === '/api/status' && method === 'GET') {
      return await handleStatus(req, res);
    }

    // ── KV ──
    if (pathname === '/api/kv/get' && method === 'GET') {
      return await handleKvGet(req, res, url);
    }
    if (pathname === '/api/kv/set' && method === 'POST') {
      return await handleKvSet(req, res);
    }
    if (pathname === '/api/kv/delete' && method === 'POST') {
      return await handleKvDelete(req, res, url);
    }

    // ── 文件操作 ──
    if (pathname === '/api/files/upload' && method === 'POST') {
      return await handleUpload(req, res);
    }
    if (pathname === '/api/files/read' && method === 'GET') {
      return await handleRead(req, res, url);
    }
    if (pathname === '/api/files/thumbnail' && method === 'GET') {
      return await handleThumbnail(req, res, url);
    }
    if (pathname === '/api/files/mkdir' && method === 'POST') {
      return await handleMkdir(req, res);
    }
    if (pathname === '/api/files/move' && method === 'POST') {
      return await handleMove(req, res);
    }
    if (pathname === '/api/files/open' && method === 'GET') {
      return await handleOpen(req, res, url);
    }
    if (pathname === '/api/files/open-dir' && method === 'GET') {
      return await handleOpenDir(req, res, url);
    }
    if (pathname === '/api/files/list' && method === 'GET') {
      return await handleList(req, res, url);
    }

    // ── Tasks ──
    if (pathname === '/api/tasks' && method === 'GET') {
      return await handleTasksGet(req, res, url);
    }
    if (pathname === '/api/tasks/save' && method === 'POST') {
      return await handleTasksSave(req, res);
    }
    if (pathname === '/api/tasks/batch-save' && method === 'POST') {
      return await handleTasksBatchSave(req, res);
    }
    if (pathname === '/api/tasks/delete' && method === 'POST') {
      return await handleTasksDelete(req, res, url);
    }
    if (pathname === '/api/tasks/batch-delete' && method === 'POST') {
      return await handleTasksBatchDelete(req, res);
    }
    if (pathname === '/api/tasks/clear' && method === 'POST') {
      return await handleTasksClear(req, res);
    }

    // ── Projects ──
    if (pathname === '/api/projects' && method === 'GET') {
      return await handleProjectsGet(req, res);
    }
    if (pathname === '/api/projects/save' && method === 'POST') {
      return await handleProjectsSave(req, res);
    }

    // ── Resources ──
    if (pathname === '/api/resources' && method === 'GET') {
      return await handleResourcesGet(req, res, url);
    }
    if (pathname === '/api/resources/save' && method === 'POST') {
      return await handleResourcesSave(req, res);
    }
    if (pathname === '/api/resources/batch-save' && method === 'POST') {
      return await handleResourcesBatchSave(req, res);
    }
    if (pathname === '/api/resources/delete' && method === 'POST') {
      return await handleResourcesDelete(req, res, url);
    }
    if (pathname === '/api/resources/clear' && method === 'POST') {
      return await handleResourcesClear(req, res);
    }
    if (pathname === '/api/resources/rescan' && method === 'POST') {
      return await handleResourcesRescan(req, res);
    }
    if (pathname === '/api/resources/rename' && method === 'POST') {
      return await handleResourcesRename(req, res, url);
    }

    // ── 代理 ──
    if (pathname === '/api/proxy' && method === 'POST') {
      return await handleProxy(req, res);
    }

    // ── 特惠视频任务查询（App 全局 setInterval 直连，见 system.ts handleGatewayTask）──
    // 必须放在 catch-all 兜底之前，否则被透传官方 → 404「任务未找到或已被清理」
    if (/^\/api\/v1\/gateway\/task\/[^/]+$/.test(pathname) && method === 'GET') {
      return await handleGatewayTask(req, res, url);
    }

    // ── 剪映 ──
    if (pathname === '/api/jianying/send' && method === 'POST') {
      return await handleJianyingSend(req, res);
    }

    // ── 平台 ──
    if (pathname === '/plugin/manifest.json' && method === 'GET') {
      return await handlePluginManifest(req, res);
    }
    if (pathname.startsWith('/api/workflow-apps/by-project/') && method === 'GET') {
      return await handleWorkflowAppsByProject(req, res, url);
    }
    // 内置模型（本地静态兜底，数据来自 apimart-gateway Lovart 模型定义）
    // 这两个路由是【自研替换官方 1mao 平台接口】的预备实现：在自托管模式下
    // 替代官方 1mao 的对应能力，返回本地静态常量，不连官方 1mao 也不实时连 Lovart。
    // 注意：前端 fetchBuiltin/Xi 实际请求带 /api 前缀（/api/public/platform/*），
    // 故此处注册须带 /api 前缀，否则 404（docs/01 变更#1 复测发现的前后端前缀错位）
    if (pathname === '/api/public/platform/builtin' && method === 'GET') {
      return await handleBuiltin(req, res);
    }
    if (pathname === '/api/public/platform/models' && method === 'GET') {
      return await handleModels(req, res);
    }

    // ── 官方权益接口转发层（docs/20）──
    // 账号/权益/会员判定 100% 在官方远程；本层只做中转 + 短缓存，不取代官方判定。
    if (pathname === '/api/user/info' && method === 'GET') {
      return await handleOfficialUser(req, res);
    }
    if (pathname === '/api/user/model-entitlements' && method === 'GET') {
      return await handleOfficialEntitlements(req, res);
    }
    if (/^\/api\/agent\/[^/]+\/vip-check$/.test(pathname) && method === 'GET') {
      return await handleOfficialVipCheck(req, res, url);
    }
    // ── AI 操控画布：A1 本地 Agent chat（SSE 透传，docs/27）──
    // 必须在 catch-all passthrough 之前注册，否则 A1 助手 /agent/*/chat 被透传官方。
    if (/^\/api\/agent\/[^/]+\/chat$/.test(pathname) && method === 'POST') {
      const m = pathname.match(/^\/api\/agent\/([^/]+)\/chat$/);
      return await handleAgentChat(req, res, m ? m[1] : '');
    }
    if (pathname === '/api/official/entitlements/invalidate' && method === 'POST') {
      return await handleOfficialInvalidate(req, res);
    }

    // ── 多供应商（docs/providers）──
    if (pathname === '/api/providers' && method === 'GET') {
      return await handleProvidersGet(req, res);
    }
    if (pathname === '/api/providers' && method === 'PUT') {
      return await handleProvidersPut(req, res);
    }
    if (pathname === '/api/config/base' && method === 'PUT') {
      return await handleConfigBasePut(req, res);
    }
    if (pathname === '/api/providers/test-connection' && method === 'POST') {
      return await handleProviderTest(req, res);
    }
    if (/^\/api\/providers\/[^/]+\/fetch-models$/.test(pathname) && method === 'POST') {
      const m = pathname.match(/^\/api\/providers\/([^/]+)\/fetch-models$/);
      return await handleProviderFetchModels(req, res, m ? m[1] : '');
    }

    // ── 管理 ──
    if (pathname === '/api/admin/stats' && method === 'GET') {
      return await handleAdminStats(req, res);
    }
    if (pathname === '/api/admin/kv-list' && method === 'GET') {
      return await handleAdminKvList(req, res);
    }
    if (pathname === '/api/admin/clear-cache' && method === 'POST') {
      return await handleAdminClearCache(req, res);
    }
    if (pathname === '/api/admin/cleanup' && method === 'POST') {
      return await handleAdminCleanup(req, res);
    }
    if (pathname === '/api/admin/export' && method === 'GET') {
      return await handleAdminExport(req, res);
    }
    if (pathname === '/api/admin/import' && method === 'POST') {
      return await handleAdminImport(req, res);
    }

    // ── sync/default 本地兜底（A2）──
    if (pathname === '/api/sync/default' && method === 'GET') {
      try {
        const baselinePath = path.join(__dirname, '..', 'data', 'apiConfigs.baseline.json');
        const raw = fs.readFileSync(baselinePath, 'utf-8');
        const replaced = raw.replace(/\{VITE_API_BASE_URL\}/g, `http://127.0.0.1:${PORT}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(replaced);
        return;
      } catch {
        return json(res, { apiConfigs: [] }); // 降级：无基线文件时返空
      }
    }

    // ── assets/upload 别名（L5）──
    if ((pathname === '/api/assets/upload' || pathname === '/api/upload/app-asset') && method === 'POST') {
      return await handleUpload(req, res);
    }

    // ── 画布前端页面托管（兜底 GET）──
    if (method === 'GET' && !pathname.startsWith('/api/') && !pathname.startsWith('/plugin/') && !pathname.startsWith('/files/')) {
      if (handleFrontendPage(res, pathname)) return;
    }

    // ── catch-all 兜底透传（必须放在所有具名路由之后、404 之前）──
    //
    // 【为什么加这一层】2026-08-01 确立原则：不再区分「哪些请求该直连官方」，
    // 全部走 localTool——即使目的地仍是官方，也经 localTool 转发。
    // localTool 由此从「白名单路由服务」升级为「唯一出口网关」。
    //
    // 【为什么是硬前置】长期目标要改 dist，把前端 base 从官方地址改指 18080。
    // 但上面的路由是逐条 `pathname === '...'` 精确匹配，未注册的一律落到下面的 404。
    // 若先改 base 而没有本层，登录/支付/上传凭证等未接管接口会当场 404，功能损坏。
    // 有了本层，改 base 就是零风险操作：未接管请求原样透传，行为不变，只多绕一跳。
    //
    // 【顺序为何关键】具名路由必须优先于本层。否则本地已实现的能力
    //（如 /public/platform/builtin 的本地静态模型清单）会被透传到官方、被官方响应覆盖，
    // 等于白实现。反过来，后续想接管任何接口，只需在上面加一条具名路由，
    // 它自动优先命中，**dist 一行都不用再改**。
    //
    // 相关文档：docs/21 §六（执行前置）、docs/01 §〇（长期目标总纲）
    if (await handlePassthrough(req, res, url)) return;

    // ── 404 ──
    // 走到这里只剩「本地专属路径」（/files/、/plugin/）未命中的情况，
    // 这类请求转发给官方没有意义，故由 passthrough 返回 false 交回此处。
    sendError(res, 'Not Found', 404);
  } catch (e) {
    console.error(`[error] ${pathname}:`, e);
    sendError(res, (e as Error).message, 500);
  }
}

// ── 启动 ──
async function main(): Promise<void> {
  // 端口冲突检测
  try {
    await checkPortAvailable(PORT);
  } catch (e) {
    console.error(`\n  ❌ ${(e as Error).message}\n`);
    process.exit(1);
  }

  // 初始化数据库（async）
  await getDb();

  // ── 凭据检查：读取网关 .env，警告占位凭据 ──
  const envPaths = [
    path.join(__dirname, '..', '..', 'apimart-gateway', '.env'),      // localTool/dist/ → 项目根/apimart-gateway/.env
    path.join(__dirname, '..', 'apimart-gateway', '.env'),            // localTool/ → 项目根/apimart-gateway/.env
    path.join(process.cwd(), 'apimart-gateway', '.env'),              // 从项目根启动
  ];
  let credsOk = false;
  for (const envPath of envPaths) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const accessKeyMatch = envContent.match(/LOVART_ACCESS_KEY\s*=\s*(\S+)/);
      const secretKeyMatch = envContent.match(/LOVART_SECRET_KEY\s*=\s*(\S+)/);
      if (accessKeyMatch && secretKeyMatch) {
        const ak = accessKeyMatch[1].replace(/['"]/g, '');
        const sk = secretKeyMatch[1].replace(/['"]/g, '');
        if (ak.includes('xxxx') || ak.includes('REPLACE') || sk.includes('xxxx') || sk.includes('REPLACE')) {
          console.log('');
          console.log('  ⚠️  ═══════════════════════════════════════════');
          console.log('  ⚠️  LOVART 凭据为占位符！生图/对话将不会真正生效。');
          console.log('  ⚠️  请在 apimart-gateway/.env 中填入真实 AK/SK。');
          console.log('  ⚠️  ═══════════════════════════════════════════');
          console.log('');
        } else {
          credsOk = true;
        }
      }
      break; // found the file, stop trying
    } catch {
      // file not found at this path, try next
    }
  }
  if (!credsOk) {
    // 如果文件未找到也提示一下（可能未部署网关）
    const anyEnvFound = envPaths.some(p => { try { return fs.existsSync(p); } catch { return false; } });
    if (!anyEnvFound) {
      console.log('');
      console.log('  ℹ️  未检测到 apimart-gateway/.env，网关凭据检查跳过。');
      console.log('     如需生图/对话功能，请确保网关已部署并配置真实 LOVART 凭据。');
      console.log('');
    }
  }

  const server = http.createServer(handleRequest);

  server.listen(PORT, '127.0.0.1', () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════════╗');
    console.log('  ║   猫猫AI画布 — 本地工具服务              ║');
    console.log('  ║   maomao-localtool v' + VERSION.padEnd(22) + '║');
    console.log('  ╚══════════════════════════════════════════╝');
    console.log('');
    console.log(`  地址: http://127.0.0.1:${PORT}`);
    console.log(`  数据: ${getDataDir()}`);
    console.log('');
    console.log('  端点:');
    console.log('    系统:   /api/status');
    console.log('    KV:     /api/kv/get  /api/kv/set');
    console.log('    文件:   /api/files/upload  /api/files/read  /api/files/thumbnail');
    console.log('           /api/files/mkdir  /api/files/move  /api/files/open');
    console.log('           /api/files/open-dir  /api/files/list');
    console.log('    任务:   /api/tasks  /api/tasks/save  /api/tasks/batch-save');
    console.log('           /api/tasks/delete  /api/tasks/batch-delete  /api/tasks/clear');
    console.log('    资源:   /api/resources  /api/resources/save  /api/resources/batch-save');
    console.log('           /api/resources/delete  /api/resources/clear');
    console.log('    代理:   /api/proxy');
    console.log('    管理:   /api/admin/stats  /api/admin/cleanup');
    console.log('           /api/admin/export  /api/admin/import');
    console.log('    剪映:   /api/jianying/send');
    console.log('    平台:   /plugin/manifest.json  /api/workflow-apps/by-project/:id');
    console.log('    内置:   /public/platform/builtin  /public/platform/models');
    console.log('    供应:   /api/providers  /api/providers/test-connection  /api/providers/:id/fetch-models');
    console.log('    权益:   /api/user/info  /api/user/model-entitlements');
    console.log('           /api/agent/:id/vip-check  /api/official/entitlements/invalidate');
    console.log('    画布:   /  (dist/ 静态托管)');
    console.log('    兜底:   其余请求 → 透传官方（catch-all，日志前缀 [passthrough]）');
    console.log('');
    console.log('  按 Ctrl+C 停止');
    console.log('');

    // ── 数据安全（性能/安全平衡）：启动仅做轻量备份，导出交给每日定时 ──
    try {
      backupDb();
      startBackupSchedule();
    } catch (e) {
      console.error(`  ⚠️  备份初始化失败：${(e as Error).message}`);
    }

    // 自动打开浏览器
    const pageUrl = `http://127.0.0.1:${PORT}`;
    try {
      const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      execSync(`${openCmd} "${pageUrl}"`, { timeout: 3000 });
    } catch { /* 打开失败不阻塞服务 */ }
  });

  // 优雅退出
  const shutdown = () => {
    console.log('\n  正在关闭服务...');
    server.close(() => {
      closeDb();
      console.log('  服务已关闭。');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error('启动失败:', e);
  process.exit(1);
});
