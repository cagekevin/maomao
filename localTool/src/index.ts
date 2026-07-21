/**
 * 一毛AI画布 — 本地工具服务 (localTool Service)
 * 替代闭源 Go 二进制，监听 18080 端口
 *
 * 用法：node dist/index.js
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'node:net';
import { getDb, closeDb, getUploadDir } from './db/database.js';
import { json, sendError } from './utils/helpers.js';
import { handleKvGet, handleKvSet } from './routes/kv.js';
import { handleUpload, handleRead, handleThumbnail, handleMkdir, handleMove, handleOpen, handleOpenDir, handleList } from './routes/files.js';
import { handleTasksGet, handleTasksSave, handleTasksBatchSave, handleTasksDelete, handleTasksBatchDelete, handleTasksClear } from './routes/tasks.js';
import { handleResourcesGet, handleResourcesSave, handleResourcesBatchSave, handleResourcesDelete, handleResourcesClear, handleResourcesRescan } from './routes/resources.js';
import { handleStatus, handleProxy, handleJianyingSend } from './routes/system.js';

const PORT = Number(process.env.PORT) || 18080;
const VERSION = '2.0.0-yimao-clone';

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
  const relativePath = urlPath.replace(/^\/files\//, '');
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

  console.log(`[${method}] ${pathname}`);

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

    // ── 代理 ──
    if (pathname === '/api/proxy' && method === 'POST') {
      return await handleProxy(req, res);
    }

    // ── 剪映 ──
    if (pathname === '/api/jianying/send' && method === 'POST') {
      return await handleJianyingSend(req, res);
    }

    // ── 404 ──
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

  const server = http.createServer(handleRequest);

  server.listen(PORT, '127.0.0.1', () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════════╗');
    console.log('  ║   一毛AI画布 — 本地工具服务              ║');
    console.log('  ║   yimao-localtool v' + VERSION.padEnd(22) + '║');
    console.log('  ╚══════════════════════════════════════════╝');
    console.log('');
    console.log(`  地址: http://127.0.0.1:${PORT}`);
    console.log(`  数据: ${path.join(os.homedir(), '.yimao-localtool')}`);
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
    console.log('    剪映:   /api/jianying/send');
    console.log('');
    console.log('  按 Ctrl+C 停止');
    console.log('');
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
