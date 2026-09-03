/**
 * 猫猫AI画布 — 本地工具服务 (localTool Service)
 * 替代闭源 Go 二进制，监听 18080 端口
 *
 * 用法：node dist/index.js
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createServer } from 'node:net';
import { getDb, closeDb, getUploadDir, getDataDir, backupDb, startBackupSchedule } from './db/database.js';
import { getEnvFile, getFrontendDistDir, getApimartGatewayEnv, getDepthVideoDir } from './paths.js';
import { VERSION } from './version.js';
import { sendError } from './utils/helpers.js';
// 声明式路由表：所有具名路由集中在 router.ts，新增端点只加一行（详见 docs/11）
import { routes, matchRoute } from './router.js';
// catch-all 兜底透传：未命中本地具名路由的请求原样转发官方（详见 routes/passthrough.ts 文件头）
// 这是「改 dist base 指向 18080」的硬前置——否则未接管的 /api/* 会直接 404。
import { handlePassthrough } from './routes/passthrough.js';
import { initLogWriter } from './utils/logWriter.js';
import { initRelayPoller } from './relay-poll.js';

// ── 轻量 .env 加载（无 dotenv 依赖，localTool 仅 sql.js 一个运行时依赖）──
// 读取 localTool/.env（路径真源 paths.ts），注入 process.env。
// 用途：LLM_CHAT_BASE_URL / LLM_CHAT_API_KEY / AI_CANVAS_ENHANCE 等 AI 操控画布配置。
function loadDotEnv(): void {
  const envPath = getEnvFile();
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
  } catch {
    // .env 不存在，跳过
  }
}

// 必须在 paths.ts 导入之后调用（getEnvFile 依赖 paths.ts）
loadDotEnv();
// 进程内接管 console → 按天轮转 + 自动删过期日志（替代 launch-all.ps1 的 stdout 重定向）。
// ⚠️ 须在 loadDotEnv() 之后、服务启动早期调用：晚调会漏掉前面的日志输出。
//    同时保持【只调用一次】（initLogWriter 内部幂等，勿重复接管 console）。
initLogWriter();

const PORT = Number(process.env.PORT) || 18080;

// 高频轮询端点（心跳/配置同步/资源缓存）不打印，避免日志刷屏
// 这些由画布前端每秒轮询，无业务价值；代理类已在 system.ts 单独打 [proxy] 日志
const SILENT_LOG_PATHS = new Set([
  '/api/status',
  '/api/kv/get',
  '/api/kv/set',
  '/api/resources',
  '/api/resources/rescan',
  '/api/tasks',
  '/api/providers',
]);
// 注：/api/proxy 不在静默集——生图/对话链路请求须有主分行可追（L1-2.3，缺口 M5-d）。
// system.ts handleProxy 内部另有 [proxy]:…ms 明细；此处主分行保留「有痕」基线。

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

// ── 本机推理资源服务（/depth-video/* 路径映射到 runtime-models/depth-video/，纯 GET）──
// 之所以单独一个处理器而非并入 handleStaticFile：磁盘根不同（upload vs runtime-models），
// 且要覆盖 .wasm/.mjs/.onnx 这类深度推理运行时专属 MIME。这部分是【纯本地模型宿主】，
// 不触碰 /api/* 与 catch-all；只是浏览器运行时 import(绝对 URL) 读取 vendor/models 的宿主目录。
function handleDepthResource(res: http.ServerResponse, urlPath: string): boolean {
  if (!urlPath.startsWith('/depth-video/')) return false;

  const depthDir = getDepthVideoDir();
  // percent-encoded 解码（中文模型子目录名也可能被编码）
  let relativePath = urlPath.replace(/^\/depth-video\//, '');
  try {
    relativePath = decodeURIComponent(relativePath);
  } catch {
    // 非法编码保留原样，交给下方 existsSync 判 404
  }
  const filePath = path.join(depthDir, relativePath);

  // 安全检查：防止路径遍历（与 handleStaticFile 同款）
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(path.resolve(depthDir))) {
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
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.wasm': 'application/wasm',       // onnxruntime wasm，跨源 import 需正确类型
    '.json': 'application/json',
    '.config': 'application/json',
    '.php': 'text/plain',
    '.txt': 'text/plain',
    '.onnx': 'application/octet-stream',
    '.bin': 'application/octet-stream',
    '.safetensors': 'application/octet-stream',
    '.npy': 'application/octet-stream',
  };
  const contentType = mimeMap[ext] || 'application/octet-stream';
  const stat = fs.statSync(resolvedPath);

  // 长缓存：vendor/models 是本地静态资源，首次拉取后走 HTTP 强缓存（D1：不做额外缓存层）
  // CORS：前端可能从不同 origin 访问（如 vite dev localhost:5180），缺 CORS 头会导致
  // transformers.js 跨源构造 depth-anything 的 processor（fetch 模型的 preprocessor json）被浏览器
  // 拦截后静默失败 → pipeline(); this.processor 恒为 null，推理时抛 "this.processor is not a function"。
  // 这些是公开静态资源，放开跨源读取安全无副作用。
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stat.size,
    'Cache-Control': 'public, max-age=31536000',
    'Access-Control-Allow-Origin': '*',
  });
  fs.createReadStream(resolvedPath).pipe(res);
  return true;
}

// ── 画布前端页面托管（dist/ 静态资源）──
const DIST_DIR = getFrontendDistDir();
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

  // 本机推理资源服务（纯 GET，未命中继续走下方具名路由/前端兜底/404）
  if (method === 'GET' && pathname.startsWith('/depth-video/')) {
    if (handleDepthResource(res, pathname)) return;
  }

  // 仅打印有意义的请求；高频轮询端点（见 SILENT_LOG_PATHS）静默处理
  if (!SILENT_LOG_PATHS.has(pathname)) {
    console.log(`[${method}] ${pathname}`);
  }

  try {
    // ── 阶段 2：具名路由 + 中间件（按路由表顺序；详见 router.ts）──
    const matched = matchRoute(routes, method, pathname);

    if (matched && !matched.route.catchAll) {
      // 该路由专属中间件（预留钩子：统一鉴权 / body 限制等，返回 false 则中断）
      for (const mw of matched.route.middleware ?? []) {
        const ok = await mw(req, res, url);
        if (ok === false) return;
      }
      await matched.route.handler(req, res, url);
      return;
    }

    // ── 阶段 3：画布前端页面托管（兜底 GET，须在 catch-all 之前）──
    if (method === 'GET' && !pathname.startsWith('/api/') && !pathname.startsWith('/plugin/') && !pathname.startsWith('/files/')) {
      if (handleFrontendPage(res, pathname)) return;
    }

    // ── 阶段 4：catch-all 兜底透传 ──
    // 【顺序铁律】阶段 2(具名) → 阶段 3(前端托管) → 阶段 4(catch-all) → 阶段 5(404)，
    // 不得把阶段 4 提前到阶段 3 之前，否则 /files/x、/plugin/y 未命中路径无法正确 404。
    // 【红线】handlePassthrough 对 /files/、/plugin/ 未命中路径返回 false，
    // 绝不可无脑 `return handler()`，否则 404 逻辑丢失。
    //
    // 【为什么加这一层】2026-08-01 确立原则：不再区分「哪些请求该直连官方」，
    // 全部走 localTool——即使目的地仍是官方，也经 localTool 转发。
    // localTool 由此从「白名单路由服务」升级为「唯一出口网关」。
    // 相关文档：docs/21 §六（执行前置）、docs/01 §〇（长期目标总纲）
    if (matched?.route.catchAll) {
      if (await handlePassthrough(req, res, url)) return;   // 成功透传才 return
      sendError(res, 'Not Found', 404);                     // 失败才 404（原 index.ts:456）
      return;
    }

    // ── 阶段 5：完全未命中 → 404 ──
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
    getApimartGatewayEnv(),                                          // localTool/ → 项目根/apimart-gateway/.env
    path.join(process.cwd(), 'apimart-gateway', '.env'),              // 从项目根启动
  ];
  let credsOk = false;
  for (const envPath of envPaths) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const accessKeyMatch = envContent.match(/LOVART_ACCESS_KEY\s*=\s*(\S+)/);
      const secretKeyMatch = envContent.match(/LOVART_SECRET_KEY\s*=\s*(\S+)/);
      const baseUrlMatch = envContent.match(/LOVART_BASE_URL\s*=\s*(\S+)/);
      if (accessKeyMatch && secretKeyMatch) {
        const ak = accessKeyMatch[1].replace(/['"]/g, '');
        const sk = secretKeyMatch[1].replace(/['"]/g, '');
        // 注入 process.env 供 relay 的 lovart-direct 直连（HMAC 鉴权）使用。
        // 9004 网关与 lovart-direct 共用同一对 LOVART 凭证；直连后由 relay 直接持有，不再经网关。
        process.env.LOVART_ACCESS_KEY = ak;
        process.env.LOVART_SECRET_KEY = sk;
        if (baseUrlMatch) process.env.LOVART_BASE_URL = baseUrlMatch[1].replace(/['"]/g, '');
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

    // ── 异步任务恢复：扫描 DB 在途行重建 relay-poll 句柄（localTool 重启不丢任务）──
    void initRelayPoller().catch((e) => {
      console.error(`  ⚠️  relay-poll 恢复扫描失败：${e instanceof Error ? e.message : String(e)}`);
    });

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
