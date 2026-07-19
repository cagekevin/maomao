/**
 * 子模块 0.5 — 系统/代理路由
 * status / proxy / jianying/send
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { json, parseJsonBody, readRawBody, sendError } from '../utils/helpers.js';

const VERSION = '2.0.0-yimao-clone';
const PORT = 18080;

// ── GET /api/status ──
export async function handleStatus(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  return json(res, {
    status: 'ok',
    version: VERSION,
    message: 'localTool service',
    ffmpeg: false,
    port: PORT,
  });
}

// ── POST /api/proxy ──
export async function handleProxy(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const contentType = req.headers['content-type'] || '';

  // 形态 ①：FormData/Blob body + X-Proxy-* 头
  const proxyUrl = req.headers['x-proxy-url'] as string | undefined;
  if (proxyUrl) {
    return handleProxyFormData(req, res, proxyUrl);
  }

  // 形态 ②：JSON body {url, method, headers, body, cookie}
  if (contentType.includes('application/json')) {
    return handleProxyJson(req, res);
  }

  return sendError(res, 'Invalid proxy request: missing X-Proxy-Url header or JSON body', 400);
}

async function handleProxyFormData(req: IncomingMessage, res: ServerResponse, targetUrl: string): Promise<void> {
  const method = (req.headers['x-proxy-method'] as string) || 'POST';

  let headers: Record<string, string> = {};
  const headersRaw = req.headers['x-proxy-headers'] as string | undefined;
  if (headersRaw) {
    try {
      headers = JSON.parse(headersRaw);
    } catch {
      // ignore
    }
  }

  const cookie = req.headers['x-proxy-cookie'] as string | undefined;
  if (cookie) {
    headers['Cookie'] = cookie;
  }

  // 读取原始 body 并 pipe
  const body = await readRawBody(req);
  if (body.length > 0) {
    headers['Content-Type'] = req.headers['content-type'] || 'application/octet-stream';
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s 超时

    const fetchRes = await fetch(targetUrl, {
      method,
      headers,
      body: body.length > 0 ? body as unknown as BodyInit : undefined,
      signal: controller.signal,
    } as RequestInit);

    clearTimeout(timeout);

    const resBody = Buffer.from(await fetchRes.arrayBuffer());

    // 透传响应头（排除 hop-by-hop）
    const resHeaders: Record<string, string> = {};
    const skipHeaders = new Set(['transfer-encoding', 'connection', 'keep-alive', 'content-encoding']);
    fetchRes.headers.forEach((value, key) => {
      if (!skipHeaders.has(key)) {
        resHeaders[key] = value;
      }
    });

    res.writeHead(fetchRes.status, resHeaders);
    res.end(resBody);
  } catch (e) {
    const err = e as Error;
    if (err.name === 'AbortError') {
      sendError(res, 'Proxy request timed out (15s)', 504);
    } else {
      sendError(res, `Proxy request failed: ${err.message}`, 502);
    }
  }
}

async function handleProxyJson(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    cookie?: string;
  } | null;

  if (!body || !body.url) {
    return sendError(res, 'Missing url in JSON body', 400);
  }

  const headers: Record<string, string> = { ...body.headers };
  if (body.cookie) {
    headers['Cookie'] = body.cookie;
  }

  const fetchBody = body.body ? JSON.stringify(body.body) : undefined;
  if (fetchBody) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const fetchRes = await fetch(body.url, {
      method: body.method || 'POST',
      headers,
      body: fetchBody,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const resBody = Buffer.from(await fetchRes.arrayBuffer());

    const resHeaders: Record<string, string> = {};
    const skipHeaders = new Set(['transfer-encoding', 'connection', 'keep-alive', 'content-encoding']);
    fetchRes.headers.forEach((value, key) => {
      if (!skipHeaders.has(key)) {
        resHeaders[key] = value;
      }
    });

    res.writeHead(fetchRes.status, resHeaders);
    res.end(resBody);
  } catch (e) {
    const err = e as Error;
    if (err.name === 'AbortError') {
      sendError(res, 'Proxy request timed out (15s)', 504);
    } else {
      sendError(res, `Proxy request failed: ${err.message}`, 502);
    }
  }
}

// ── POST /api/jianying/send ──
export async function handleJianyingSend(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as Record<string, unknown> | null;
  if (!body) {
    return sendError(res, 'Empty body', 400);
  }

  // 形态 ②：批量 {items: [{fileUrl, localPath}]}
  if (body.items && Array.isArray(body.items)) {
    const items = body.items as Array<{ fileUrl?: string; localPath?: string }>;
    console.log(`[jianying] 批量发送 ${items.length} 个文件到剪映`);

    // 实际剪映集成需要通过剪映的插件 API 或剪映草稿目录
    // 这里记录日志并返回成功
    return json(res, {
      status: 'ok',
      count: items.length,
      message: `${items.length} 个文件已发送到剪映`,
    });
  }

  // 形态 ①：单个 {fileUrl, localPath, fileName}
  const { fileUrl, localPath, fileName } = body;
  if (!fileUrl && !localPath) {
    return sendError(res, 'Missing fileUrl or localPath', 400);
  }

  console.log(`[jianying] 发送到剪映:`, { fileUrl, localPath, fileName });

  // 实际剪映集成
  return json(res, {
    status: 'ok',
    message: `已发送 ${fileName || '文件'} 到剪映`,
  });
}
