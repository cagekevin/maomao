/**
 * 子模块 0.3 — 文件操作路由
 * upload / read / thumbnail / mkdir / move / open / open-dir / list
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { getUploadDir } from '../db/database.js';
import { json, parseMultipart, parseJsonBody, readRawBody, sendError } from '../utils/helpers.js';

// ── upload ──
export async function handleUpload(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const contentType = req.headers['content-type'] || '';

  // 判断是 FormData 还是 JSON
  if (contentType.includes('multipart/form-data')) {
    return handleUploadFormData(req, res);
  } else {
    return handleUploadJson(req, res);
  }
}

async function handleUploadFormData(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { fields, files } = await parseMultipart(req);

  const subfolder = fields['subfolder'] || 'canvas';
  const filename = fields['filename'] || undefined;

  // file 优先于 fileUrl
  const fileData = files['file'];
  const fileUrl = fields['fileUrl'];

  if (fileData) {
    const saveName = filename || fileData.filename;
    const savedPath = await saveFile(fileData.data, subfolder, saveName);
    const fileUrlPath = `/files/${subfolder}/${path.basename(savedPath)}`;
    const thumbnailUrl = await tryGenerateThumbnail(savedPath, fileUrlPath);

    return json(res, {
      url: fileUrlPath,
      path: savedPath,
      thumbnailUrl: thumbnailUrl || undefined,
    });
  }

  if (fileUrl) {
    // fileUrl 模式：下载远程文件保存
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        return sendError(res, `Failed to download fileUrl: ${response.status}`, 400);
      }
      const data = Buffer.from(await response.arrayBuffer());
      const saveName = filename || path.basename(new URL(fileUrl).pathname) || 'download';
      const savedPath = await saveFile(data, subfolder, saveName);
      const urlPath = `/files/${subfolder}/${path.basename(savedPath)}`;
      const thumbnailUrl = await tryGenerateThumbnail(savedPath, urlPath);

      return json(res, {
        url: urlPath,
        path: savedPath,
        thumbnailUrl: thumbnailUrl || undefined,
      });
    } catch (e) {
      return sendError(res, `Failed to download fileUrl: ${(e as Error).message}`, 400);
    }
  }

  return sendError(res, 'Missing file or fileUrl field', 400);
}

async function handleUploadJson(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as { fileUrl?: string; subfolder?: string; filename?: string } | null;
  if (!body || !body.fileUrl) {
    return sendError(res, 'Missing fileUrl in JSON body', 400);
  }

  const subfolder = body.subfolder || 'canvas';
  const filename = body.filename || undefined;

  try {
    const response = await fetch(body.fileUrl);
    if (!response.ok) {
      return sendError(res, `Failed to download fileUrl: ${response.status}`, 400);
    }
    const data = Buffer.from(await response.arrayBuffer());
    const saveName = filename || path.basename(new URL(body.fileUrl).pathname) || 'download';
    const savedPath = await saveFile(data, subfolder, saveName);
    const urlPath = `/files/${subfolder}/${path.basename(savedPath)}`;
    const thumbnailUrl = await tryGenerateThumbnail(savedPath, urlPath);

    return json(res, {
      url: urlPath,
      path: savedPath,
      thumbnailUrl: thumbnailUrl || undefined,
    });
  } catch (e) {
    return sendError(res, `Failed to download fileUrl: ${(e as Error).message}`, 400);
  }
}

async function saveFile(data: Buffer, subfolder: string, filename: string): Promise<string> {
  const uploadDir = getUploadDir();
  const dir = path.join(uploadDir, subfolder);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const safeName = sanitizeFilename(filename);
  const savedPath = path.join(dir, `${Date.now()}-${safeName}`);
  fs.writeFileSync(savedPath, data);
  return savedPath;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, '_');
}

async function tryGenerateThumbnail(filePath: string, urlPath: string): Promise<string | null> {
  const ext = path.extname(filePath).toLowerCase();
  const imageExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'];
  if (!imageExts.includes(ext)) return null;

  // 缩略图路径
  const thumbDir = path.join(path.dirname(filePath), '.thumbnails');
  if (!fs.existsSync(thumbDir)) {
    fs.mkdirSync(thumbDir, { recursive: true });
  }
  const thumbPath = path.join(thumbDir, `thumb_${path.basename(filePath)}`);
  const thumbUrl = `/files/${path.relative(getUploadDir(), thumbDir).replace(/\\/g, '/')}/${path.basename(thumbPath)}`;

  // 简单复制原图作为缩略图（无 sharp 依赖时）
  // 后续可接入 sharp 做真正的缩放
  try {
    fs.copyFileSync(filePath, thumbPath);
    return thumbUrl;
  } catch {
    return null;
  }
}

// ── read ──
export async function handleRead(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const filePath = url.searchParams.get('path');
  if (!filePath) {
    return sendError(res, 'Missing path parameter', 400);
  }

  // 支持 X-Proxy-* 头做代理读
  const proxyUrl = req.headers['x-proxy-url'] as string | undefined;
  if (proxyUrl) {
    return handleReadProxy(req, res, proxyUrl);
  }

  if (!fs.existsSync(filePath)) {
    return sendError(res, 'File not found', 404);
  }

  const ext = path.extname(filePath).toLowerCase();
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
  const stat = fs.statSync(filePath);

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stat.size,
  });
  fs.createReadStream(filePath).pipe(res);
}

async function handleReadProxy(req: IncomingMessage, res: ServerResponse, proxyUrl: string): Promise<void> {
  const proxyMethod = (req.headers['x-proxy-method'] as string) || 'GET';
  const proxyHeadersRaw = req.headers['x-proxy-headers'] as string | undefined;
  const proxyCookie = req.headers['x-proxy-cookie'] as string | undefined;

  let proxyHeaders: Record<string, string> = {};
  if (proxyHeadersRaw) {
    try {
      proxyHeaders = JSON.parse(proxyHeadersRaw);
    } catch {
      // ignore
    }
  }
  if (proxyCookie) {
    proxyHeaders['Cookie'] = proxyCookie;
  }

  try {
    const fetchRes = await fetch(proxyUrl, {
      method: proxyMethod,
      headers: proxyHeaders,
    });

    const resBody = Buffer.from(await fetchRes.arrayBuffer());
    res.writeHead(fetchRes.status, {
      'Content-Type': fetchRes.headers.get('content-type') || 'application/octet-stream',
      'Content-Length': resBody.length,
    });
    res.end(resBody);
  } catch (e) {
    sendError(res, `Proxy read failed: ${(e as Error).message}`, 502);
  }
}

// ── thumbnail ──
export async function handleThumbnail(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const sourceUrl = url.searchParams.get('url');
  if (!sourceUrl) {
    return sendError(res, 'Missing url parameter', 400);
  }

  const maxDim = parseInt(url.searchParams.get('maxDim') || '200', 10);
  const quality = parseInt(url.searchParams.get('quality') || '80', 10);

  // url 是 /files/subfolder/filename 格式，映射到磁盘路径
  const uploadDir = getUploadDir();
  const relativePath = sourceUrl.replace(/^\/files\//, '');
  const filePath = path.join(uploadDir, relativePath);

  if (!fs.existsSync(filePath)) {
    return sendError(res, 'File not found', 404);
  }

  // 生成缩略图
  const thumbDir = path.join(path.dirname(filePath), '.thumbnails');
  if (!fs.existsSync(thumbDir)) {
    fs.mkdirSync(thumbDir, { recursive: true });
  }

  const thumbPath = path.join(thumbDir, `thumb_${maxDim}x${quality}_${path.basename(filePath)}`);
  const thumbUrl = `/files/${path.relative(uploadDir, thumbDir).replace(/\\/g, '/')}/${path.basename(thumbPath)}`;

  // 简单复制（无 sharp 时）
  if (!fs.existsSync(thumbPath)) {
    fs.copyFileSync(filePath, thumbPath);
  }

  // 返回 JSON {thumbnailUrl: string}，不是直接返回 JPEG 二进制
  return json(res, { thumbnailUrl: thumbUrl });
}

// ── mkdir ──
export async function handleMkdir(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as { folder?: string } | null;
  if (!body || !body.folder) {
    return sendError(res, 'Missing folder field', 400);
  }

  const uploadDir = getUploadDir();
  const dirPath = path.join(uploadDir, body.folder);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  return json(res, { ok: true });
}

// ── move ──
export async function handleMove(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as { src?: string; dst?: string } | null;
  if (!body || !body.src || !body.dst) {
    return sendError(res, 'Missing src or dst field', 400);
  }

  if (!fs.existsSync(body.src)) {
    return sendError(res, 'Source file not found', 404);
  }

  const dstDir = path.dirname(body.dst);
  if (!fs.existsSync(dstDir)) {
    fs.mkdirSync(dstDir, { recursive: true });
  }

  fs.renameSync(body.src, body.dst);
  return json(res, { ok: true });
}

// ── open ──
export async function handleOpen(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const subfolder = url.searchParams.get('subfolder') || 'canvas';
  const uploadDir = getUploadDir();
  const dirPath = path.join(uploadDir, subfolder);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const cmd = process.platform === 'win32' ? 'explorer' : 'open';
  try {
    execSync(`${cmd} "${dirPath}"`, { timeout: 5000 });
  } catch {
    // 忽略打开失败
  }

  return json(res, { path: dirPath });
}

// ── open-dir ──
export async function handleOpenDir(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const filepath = url.searchParams.get('filepath');
  if (!filepath) {
    return sendError(res, 'Missing filepath parameter', 400);
  }

  // filepath 是 URL pathname 去 /files/ 前缀
  const uploadDir = getUploadDir();
  const relativePath = filepath.replace(/^\/files\//, '');
  const fullPath = path.join(uploadDir, relativePath);

  if (!fs.existsSync(fullPath)) {
    return sendError(res, 'File/directory not found', 404);
  }

  const dirToOpen = fs.statSync(fullPath).isDirectory() ? fullPath : path.dirname(fullPath);
  const cmd = process.platform === 'win32' ? 'explorer' : 'open';

  try {
    execSync(`${cmd} "${dirToOpen}"`, { timeout: 5000 });
  } catch {
    // 忽略打开失败
  }

  return json(res, { path: dirToOpen });
}

// ── list ──
export async function handleList(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const subfolder = url.searchParams.get('subfolder') || '';
  const uploadDir = getUploadDir();
  const targetDir = subfolder ? path.join(uploadDir, subfolder) : uploadDir;

  if (!fs.existsSync(targetDir)) {
    return json(res, { files: [], folders: [] });
  }

  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  const files: string[] = [];
  const folders: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue; // 隐藏文件跳过
    if (entry.isDirectory()) {
      folders.push(entry.name);
    } else {
      files.push(entry.name);
    }
  }

  return json(res, { files, folders });
}
