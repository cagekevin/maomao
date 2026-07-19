#!/usr/bin/env node
/**
 * 一毛AI画布 — 本地工具服务 (localTool Service)
 * 模拟原版桌面应用提供的本地 API，端口 18080
 *
 * 用法：node localTool.mjs
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 18080;

// ── 内存 KV 存储 ──
const kvStore = new Map();

// ── 上传文件存储目录 ──
const UPLOAD_DIR = path.join(__dirname, '.localTool-uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── 解析 JSON body ──
function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks);
      try {
        resolve(JSON.parse(raw.toString()));
      } catch {
        resolve(raw.toString());
      }
    });
  });
}

// ── 解析 multipart body（简易版，用于文件上传）──
function readMultipart(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks);
      const boundary = req.headers['content-type']?.match(/boundary=(.+)/)?.[1];
      if (!boundary) { resolve({ fields: {}, files: {} }); return; }

      const sep = Buffer.from(`--${boundary}`);
      const parts = [];
      let start = 0;
      while (true) {
        const idx = raw.indexOf(sep, start);
        if (idx === -1) break;
        if (start > 0) parts.push(raw.slice(start, idx));
        start = idx + sep.length + 2; // +2 for \r\n
      }

      const fields = {};
      const files = {};
      for (const part of parts) {
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;
        const header = part.slice(0, headerEnd).toString();
        const body = part.slice(headerEnd + 4, part.length - 2); // -2 for \r\n

        const nameMatch = header.match(/name="([^"]+)"/);
        const filenameMatch = header.match(/filename="([^"]+)"/);
        if (!nameMatch) continue;

        if (filenameMatch) {
          const filename = filenameMatch[1];
          const filepath = path.join(UPLOAD_DIR, `${Date.now()}-${filename}`);
          fs.writeFileSync(filepath, body);
          files[nameMatch[1]] = { filename, path: filepath, size: body.length };
        } else {
          fields[nameMatch[1]] = body.toString();
        }
      }
      resolve({ fields, files });
    });
  });
}

// ── 路由处理 ──
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const pathname = url.pathname;
  const method = req.method;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  console.log(`[${method}] ${pathname}`);

  try {
    // ── 状态检查 ──
    if (pathname === '/api/status' && method === 'GET') {
      return json(res, {
        status: 'ok',
        port: PORT,
        isConnected: true,
        ffmpeg: false,
        version: '1.0.0-local',
      });
    }

    // ── KV 读取 ──
    if (pathname === '/api/kv/get' && method === 'GET') {
      const key = url.searchParams.get('key');
      const value = kvStore.get(key) ?? null;
      return json(res, value);
    }

    // ── KV 写入 ──
    if (pathname === '/api/kv/set' && method === 'POST') {
      const body = await readBody(req);
      kvStore.set(body.key, body.value);
      return json(res, { success: true });
    }

    // ── 文件上传 ──
    if (pathname === '/api/files/upload' && method === 'POST') {
      const { fields, files } = await readMultipart(req);
      const file = Object.values(files)[0];
      if (!file) return json(res, { error: '没有文件' }, 400);
      const fileUrl = `file://${file.path}`;
      return json(res, { success: true, url: fileUrl, path: file.path, filename: file.filename, size: file.size });
    }

    // ── 缩略图 ──
    if (pathname === '/api/files/thumbnail' && method === 'GET') {
      const filePath = url.searchParams.get('path');
      if (!filePath || !fs.existsSync(filePath)) {
        return json(res, { error: '文件不存在' }, 404);
      }
      // 返回原图（简化处理）
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
      res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // ── 打开文件/目录 ──
    if ((pathname === '/api/files/open' || pathname === '/api/files/open-dir') && method === 'GET') {
      const filePath = url.searchParams.get('path') || url.searchParams.get('filepath') || url.searchParams.get('subfolder');
      console.log(`[open] ${filePath} (本地服务环境无法打开文件管理器)`);
      return json(res, { path: filePath, message: '本地服务环境，无法打开文件管理器' });
    }

    // ── 创建目录 ──
    if (pathname === '/api/files/mkdir' && method === 'POST') {
      const body = await readBody(req);
      const dirPath = body.path || body.filepath;
      if (dirPath) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      return json(res, { success: true });
    }

    // ── 移动文件 ──
    if (pathname === '/api/files/move' && method === 'POST') {
      const body = await readBody(req);
      if (body.src && body.dst) {
        fs.renameSync(body.src, body.dst);
      }
      return json(res, { success: true });
    }

    // ── API 代理 ──
    if (pathname === '/api/proxy' && method === 'POST') {
      const proxyUrl = req.headers['x-proxy-url'];
      if (!proxyUrl) return json(res, { error: '缺少 X-Proxy-Url' }, 400);
      try {
        const proxyMethod = req.headers['x-proxy-method'] || 'POST';
        const proxyHeaders = req.headers['x-proxy-headers'] ? JSON.parse(req.headers['x-proxy-headers']) : {};
        const proxyCookie = req.headers['x-proxy-cookie'] || '';
        const body = await readBody(req);

        const headers = { ...proxyHeaders };
        if (proxyCookie) headers['Cookie'] = proxyCookie;
        if (body && typeof body === 'object') headers['Content-Type'] = 'application/json';

        const fetchRes = await fetch(proxyUrl, {
          method: proxyMethod,
          headers,
          body: body && typeof body === 'object' ? JSON.stringify(body) : undefined,
        });

        const resBody = await fetchRes.text();
        res.writeHead(fetchRes.status, { 'Content-Type': fetchRes.headers.get('content-type') || 'application/json' });
        res.end(resBody);
      } catch (e) {
        json(res, { error: e.message }, 500);
      }
      return;
    }

    // ── 发送到剪映 ──
    if (pathname === '/api/jianying/send' && method === 'POST') {
      const body = await readBody(req);
      console.log(`[jianying] 发送到剪映:`, body);
      return json(res, { success: true, message: '本地服务环境，无法发送到剪映' });
    }

    // ── 404 ──
    json(res, { error: 'Not Found' }, 404);
  } catch (e) {
    console.error(`[error] ${pathname}:`, e);
    json(res, { error: e.message }, 500);
  }
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ── 启动 ──
const server = http.createServer(handleRequest);
server.listen(PORT, '127.0.0.1', () => {
  console.log(``);
  console.log(`  一毛AI画布 — 本地工具服务`);
  console.log(`  地址: http://127.0.0.1:${PORT}`);
  console.log(`  状态: 运行中`);
  console.log(``);
  console.log(`  提供: /api/status /api/kv/get /api/kv/set`);
  console.log(`        /api/files/upload /api/files/thumbnail`);
  console.log(`        /api/files/open /api/files/open-dir`);
  console.log(`        /api/files/mkdir /api/files/move`);
  console.log(`        /api/proxy /api/jianying/send`);
  console.log(``);
  console.log(`  按 Ctrl+C 停止`);
  console.log(``);
});

// 注入 window.localTool（通过在 HTML 中添加 script）
// Chrome 扩展环境下，localTool 由 Native Messaging 注入
// 这里仅提供 HTTP API，扩展会通过 fetch 调用