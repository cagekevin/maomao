/**
 * 子模块 0.3 — 文件操作路由
 * upload / read / thumbnail / mkdir / move / open / open-dir / list
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getUploadDir } from '../db/database.js';
import { ensureDir, sanitizeFilename, resolveUploadTarget, writeUploadBuffer, writeUploadBufferAt, ensureThumbnailTarget, resizeImage } from '../utils/fileStore.js';
import { json, parseMultipart, parseJsonBody, readRawBody, sendError } from '../utils/helpers.js';
import { fetchWithProxy } from '../utils/netProxy.js';

const PORT = Number(process.env.PORT) || 18080;
const BASE_URL = `http://127.0.0.1:${PORT}`;

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

// upload 响应留痕：此前日志只记 [POST] /api/files/upload 请求、不记响应，失败（400）无法从日志看出。
const uploadLog = (status: number, msg: string) =>
  console.log(`[upload] ${new Date().toISOString().replace('T', ' ').slice(0, 19)} | ${status} | ${msg}`);

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
    uploadLog(200, `formdata ${saveName} -> ${fileUrlPath}`);
    return json(res, {
      url: `${BASE_URL}${fileUrlPath}`,
      path: savedPath,
      thumbnailUrl: thumbnailUrl ? `${BASE_URL}${thumbnailUrl}` : undefined,
    });
  }

  if (fileUrl) {
    // fileUrl 模式：下载远程文件保存（幂等：同一远程 URL → 同一本地文件名，已存在则跳过下载）
    try {
      const result = await saveRemoteUrl(subfolder, fileUrl, filename);
      uploadLog(200, `fileUrl ${fileUrl}`);
      return json(res, result);
    } catch (e) {
      uploadLog(400, `fileUrl ${fileUrl} | ${(e as Error).message}`);
      return sendError(res, `Failed to download fileUrl: ${(e as Error).message}`, 400);
    }
  }

  uploadLog(400, 'missing file/fileUrl');
  return sendError(res, 'Missing file or fileUrl field', 400);
}

async function handleUploadJson(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as { fileUrl?: string; subfolder?: string; filename?: string } | null;
  if (!body || !body.fileUrl) {
    uploadLog(400, 'missing fileUrl in JSON');
    return sendError(res, 'Missing fileUrl in JSON body', 400);
  }

  const subfolder = body.subfolder || 'canvas';
  const filename = body.filename || undefined;

  try {
    const result = await saveRemoteUrl(subfolder, body.fileUrl, filename);
    uploadLog(200, `fileUrl ${body.fileUrl}`);
    return json(res, result);
  } catch (e) {
    uploadLog(400, `fileUrl ${body.fileUrl} | ${(e as Error).message}`);
    return sendError(res, `Failed to download fileUrl: ${(e as Error).message}`, 400);
  }
}

async function saveFile(data: Buffer, subfolder: string, filename: string): Promise<string> {
  const { savedPath } = writeUploadBuffer(subfolder, filename, data);
  return savedPath;
}

/**
 * 远程 URL → 本地文件（【唯一下载归属点】+ 幂等，任何调用方都走这里保证去重）。
 * - 文件名 = sha1(fileUrl) 前 16 位 + 原 basename → 同一远程地址永远映射到同一文件名;
 * - 文件已存在则跳过下载 → 重复调用不重复落盘(幂等,所以"调两次 ii"也不会下两份原图);
 * - 单次成功调用产出【1 原图 + 1 缩略图】两个文件(缩略图在 .thumbnails/ 下),这是正常设计,不是"重复下载"。
 * 调用方(polling ii→Zr / gateway / 迁移)下载失败表现为 POST /api/files/upload 返回 400,由 Zr 打 WARN 暴露。
 */
async function saveRemoteUrl(subfolder: string, fileUrl: string, filename?: string): Promise<{ url: string; path: string; thumbnailUrl?: string }> {
  const urlHash = crypto.createHash('sha1').update(fileUrl).digest('hex').slice(0, 16);
  const base = filename || path.basename(new URL(fileUrl).pathname) || 'download';
  const stableName = sanitizeFilename(`${urlHash}_${base}`);

  const { savedPath, urlPath } = resolveUploadTarget(subfolder, stableName);
  ensureDir(path.dirname(savedPath));

  // 留痕：下载成败都打 [download] 日志（含 URL/落盘路径/原因），供"图丢了"排查溯源。
  // 此前失败仅表现为 upload 400 且日志不记响应，导致丢图无迹可循（见 daily/2026-08-14 §一）。
  const ts = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
  if (!fs.existsSync(savedPath)) {
    // 直连优先，失败走代理（跨平台：读环境变量或探测 127.0.0.1:7897 等常见本机代理端口）。
    // 解决了 localTool 进程 fetch 不继承浏览器代理、导致下载 Lovart CDN 图超时 400 的问题。
    try {
      const response = await fetchWithProxy(fileUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = Buffer.from(await response.arrayBuffer());
      writeUploadBufferAt(subfolder, stableName, data);
      console.log(`[download] ${ts()} | OK  | ${fileUrl} -> ${urlPath} | ${(data.length / 1024).toFixed(0)}KB`);
    } catch (e) {
      console.error(`[download] ${ts()} | FAIL | ${fileUrl} | ${(e as Error).message}`);
      throw new Error(`Failed to download fileUrl: ${(e as Error).message}`);
    }
  } else {
    console.log(`[download] ${ts()} | SKIP(已存在) | ${fileUrl} -> ${urlPath}`);
  }

  const thumbnailUrl = await tryGenerateThumbnail(savedPath, urlPath);
  return { url: `${BASE_URL}${urlPath}`, path: savedPath, thumbnailUrl: thumbnailUrl ? `${BASE_URL}${thumbnailUrl}` : undefined };
}

async function tryGenerateThumbnail(filePath: string, _urlPath: string): Promise<string | null> {
  const ext = path.extname(filePath).toLowerCase();
  const imageExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'];
  if (!imageExts.includes(ext)) return null;

  const { thumbPath, thumbUrl } = ensureThumbnailTarget(filePath);
  try {
    if (!fs.existsSync(thumbPath)) {
      // 真实缩放（最长边 ≤256）生成缩略图；jimp 不可用/异常时回退复制原图（兜底，docs/35 §6）
      const ok = await resizeImage(filePath, thumbPath, { maxDim: 256, quality: 80 });
      if (!ok) fs.copyFileSync(filePath, thumbPath);
    }
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
    // 代理读可能指向外部 CDN（如 Lovart），用 fetchWithProxy 支持跨平台代理
    const fetchRes = await fetchWithProxy(proxyUrl, {
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

  // 生成缩略图（与 tryGenerateThumbnail 共用 ensureThumbnailTarget）
  const { thumbPath, thumbUrl } = ensureThumbnailTarget(filePath, `${maxDim}x${quality}_`);

  // maxDim/quality 真正参与缩放与压缩（此前仅拼进文件名后缀，见 docs/35 §2.3）；
  // jimp 不可用/异常时回退复制原图（兜底，docs/19 约束 3「兜底保留」）
  if (!fs.existsSync(thumbPath)) {
    const ok = await resizeImage(filePath, thumbPath, { maxDim, quality });
    if (!ok) fs.copyFileSync(filePath, thumbPath);
  }

  // 返回 JSON {thumbnailUrl: string}，不是直接返回 JPEG 二进制
  return json(res, { thumbnailUrl: `${BASE_URL}${thumbUrl}` });
}

// ── mkdir ──
export async function handleMkdir(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as { folder?: string } | null;
  if (!body || !body.folder) {
    return sendError(res, 'Missing folder field', 400);
  }

  const uploadDir = getUploadDir();
  const dirPath = path.join(uploadDir, body.folder);
  ensureDir(dirPath);

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
  ensureDir(dstDir);

  fs.renameSync(body.src, body.dst);
  return json(res, { ok: true });
}

// ── open ──
export async function handleOpen(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const subfolder = url.searchParams.get('subfolder') || 'canvas';
  const uploadDir = getUploadDir();
  const dirPath = path.join(uploadDir, subfolder);

  ensureDir(dirPath);

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
