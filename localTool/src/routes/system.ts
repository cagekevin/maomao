/**
 * 子模块 0.5 — 系统/代理路由
 * status / proxy / jianying/send
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable, Transform } from 'node:stream';
import { createGunzip, createInflate, createBrotliDecompress } from 'node:zlib';
import { json, parseJsonBody, readRawBody, sendError } from '../utils/helpers.js';
import { resolveProviderTarget, type ResolvedTarget } from './providers.js';
import { fetchWithProxy } from '../utils/netProxy.js';

const VERSION = '1.4.2';
const PORT = Number(process.env.PORT) || 18080;
const APIMART_PORT = Number(process.env.APIMART_PORT) || 9004; // apimart-gateway 端口（见 CLAUDE.md 端口铁律）
const PROXY_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT) || 300000; // 默认 5min，原硬编码 15s

/**
 * 自指网关 URL 重写：把「打回 localTool 自身的特惠视频 /api/v1/gateway/* 请求」重写到 apimart-gateway。
 * 见 handleProxyJson 中 [fix:特惠视频] 注释。仅对「host 是 localTool 自身 18080」且
 * 「路径以 /api/v1/gateway/ 开头」的 URL 生效，其余 URL 原样返回，零副作用。
 */
function rewriteSelfGatewayUrl(url: string, selfPort: number): string {
  try {
    const u = new URL(url);
    const isSelfHost = u.hostname === '127.0.0.1' || u.hostname === 'localhost' || u.hostname === '::1';
    const selfPortMatch = u.port === String(selfPort);
    if (isSelfHost && selfPortMatch && u.pathname.startsWith('/api/v1/gateway/')) {
      // 去掉 /api 前缀（apimart-gateway 路由无 /api，见 main.py 的 /v1/gateway/*）
      const newPath = u.pathname.replace(/^\/api/, '');
      u.hostname = '127.0.0.1';
      u.port = String(APIMART_PORT);
      u.pathname = newPath;
      const rewritten = u.toString();
      console.log(`[proxy:rewrite] ${new Date().toISOString().replace('T',' ').slice(0,19)} | ${url} -> ${rewritten}`);
      return rewritten;
    }
  } catch { /* 无法解析则原样返回 */ }
  return url;
}

/**
 * GET /api/v1/gateway/task/:taskId —— 特惠视频任务查询（App 全局 setInterval 直连）
 *
 * 背景（见变更 #6）：特惠视频的 discountVideoApiUrl 被前端 Kn()/lt() 处理成
 * `http://127.0.0.1:18080/api`。特惠节点内部轮询走 /api/proxy（已被 rewriteSelfGatewayUrl 转发 9004），
 * 但 App 组件的全局 setInterval（App-BX6o9fW5_components/Vr.jsx 约 L1310）【直接 fetch】
 * `http://127.0.0.1:18080/api/v1/gateway/task/{taskId}`，不走 /api/proxy。
 * 该直连请求被 localTool catch-all 透传官方 → 404「任务未找到或已被清理」。
 * 故本路由把此直连查询转发到 apimart-gateway 9004，并把响应的 `code:200` 改成 `code:1`
 * （Vr.jsx 特惠全局轮询用 `c.code === 1 && c.data` 识别，见 L1355）。
 */
export async function handleGatewayTask(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const taskId = url.pathname.replace(/^\/api\/v1\/gateway\/task\//, '');
  if (!taskId) {
    return sendError(res, 'Missing task id', 400);
  }
  const target = `http://127.0.0.1:${APIMART_PORT}/v1/gateway/task/${encodeURIComponent(taskId)}`;
  const auth = req.headers['authorization'] as string | undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  try {
    const fetchRes = await fetch(target, {
      method: 'GET',
      headers: auth ? { Authorization: auth, Accept: '*/*' } : { Accept: '*/*' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const raw = Buffer.from(await fetchRes.arrayBuffer());
    // 转换 apimart `{code:200, data}` → 前端期望 `{code:1, data}`（仅改 code，其余透传）
    let out: Buffer = raw;
    try {
      const parsed = JSON.parse(raw.toString('utf-8'));
      if (parsed && typeof parsed === 'object' && 'data' in parsed && parsed.code === 200) {
        parsed.code = 1;
        out = Buffer.from(JSON.stringify(parsed));
      }
    } catch { /* 非 JSON 原样透传 */ }
    // 网关对「已结束/已清理任务」返回 400，而前端特惠轮询（Vr.jsx）只把 404 当「任务未找到」
    // 累加 notFoundCount 并在 3 次后停止；400 会被前端忽略 → 无限轮询 → 控制台刷 400。
    // 故把 400 归一为 404，让前端正确识别「任务未找到」并停止轮询（见 docs/01 变更 #6、daily/2026-08-05）。
    const status = fetchRes.status === 400 ? 404 : fetchRes.status;
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(out);
  } catch (e) {
    clearTimeout(timeout);
    const err = e as Error;
    if (err.name === 'AbortError') {
      sendError(res, `Gateway task query timed out (${PROXY_TIMEOUT_MS / 1000}s)`, 504);
    } else {
      sendError(res, `Gateway task query failed: ${err.message}`, 502);
    }
  }
}

// ── SSE 协议转换：透传 data: 行，去掉 : heartbeat 等 SSE 注释 ──
// 前端期望标准 SSE 格式: data: {...json...}\n\n
function createSSEParserTransform(): Transform {
  let buffer = '';
  return new Transform({
    writableObjectMode: false,
    readableObjectMode: false,
    transform(chunk: Buffer, _encoding, callback) {
      buffer += chunk.toString('utf-8');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trimEnd();
        // 前端跳过非 data: 开头的行，但需要 data: 前缀来识别
        // SSE 注释行 (: heartbeat) 直接跳过
        if (trimmed.startsWith('data: ')) {
          this.push(trimmed + '\n');
        } else if (!trimmed.startsWith(':')) {
          // 透传其他非注释行（如空行 ∈ SSE 协议分隔符）
          this.push(trimmed + '\n');
        }
        // :heartbeat 等注释行 → 丢弃
      }
      callback();
    },
    flush(callback) {
      if (buffer.startsWith('data: ')) {
        this.push(buffer + '\n');
      }
      callback();
    },
  });
}

// GET /api/status ──
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
  // 供应商分派：前端用 X-Proxy-Provider 头携带 providerId（不消费 body 流，安全）
  const proxyUrl = req.headers['x-proxy-url'] as string | undefined;
  if (proxyUrl) {
    const providerId = req.headers['x-proxy-provider'] as string | undefined;
    const resolved = resolveProviderTarget(proxyUrl, providerId);
    return handleProxyFormData(req, res, resolved.url, resolved.authHeader);
  }

  // 形态 ②：JSON body {url, method, headers, body, cookie, providerId}
  if (contentType.includes('application/json')) {
    return handleProxyJson(req, res);
  }

  return sendError(res, 'Invalid proxy request: missing X-Proxy-Url header or JSON body', 400);
}

async function handleProxyFormData(req: IncomingMessage, res: ServerResponse, targetUrl: string, authHeader?: string): Promise<void> {
  const _proxyStart = Date.now();
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

  // 供应商分派：openai 协议注入 Bearer key（apimart 协议 authHeader 为 undefined，保持原行为）
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  // 读取原始 body 并 pipe
  const body = await readRawBody(req);
  if (body.length > 0) {
    headers['Content-Type'] = req.headers['content-type'] || 'application/octet-stream';
  }

  try {
    // 同步/异步交给前端决定：前端在 URL 已带 ?wait=1 → 网关同步 SSE 返回；
    // 不带 → 网关异步提交返回 task_id，前端自行轮询。localTool 不再强制注入 wait（见 daily/15）。
    // 网关同步模式经下方通用 SSE 流式透传分支逐块 pipe，无需在此特判。
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

    const fetchRes = await fetch(targetUrl, {
      method,
      headers,
      body: body.length > 0 ? body as unknown as BodyInit : undefined,
      signal: controller.signal,
    } as RequestInit);

    clearTimeout(timeout);

    // ── 流式转发：SSE 响应不缓冲，解析 data: 行后逐 JSON 块 pipe ──
    const formResponseCt = fetchRes.headers.get('content-type') || '';
    if (formResponseCt.includes('text/event-stream')) {
      const streamHeaders: Record<string, string> = {};
      const streamSkip = new Set(['transfer-encoding', 'connection', 'keep-alive', 'content-encoding', 'content-length']);
      fetchRes.headers.forEach((value, key) => {
        if (!streamSkip.has(key)) streamHeaders[key] = value;
      });
      // 覆盖 Content-Type，前端收到的是逐行 JSON（非标准 SSE）
      streamHeaders['content-type'] = 'text/event-stream';
      res.writeHead(fetchRes.status, streamHeaders);

      let bodyStream = Readable.fromWeb(fetchRes.body as any);
      const ce = fetchRes.headers.get('content-encoding') || '';
      if (ce === 'gzip' || ce === 'x-gzip') bodyStream = bodyStream.pipe(createGunzip());
      else if (ce === 'deflate') bodyStream = bodyStream.pipe(createInflate());
      else if (ce === 'br') bodyStream = bodyStream.pipe(createBrotliDecompress());

      // SSE 解析：提取 data: 行，去掉 : heartbeat 等注释
      const sseParser = createSSEParserTransform();

      bodyStream.on('error', (err: Error) => {
        console.error(`[proxy:stream] ${new Date().toISOString().replace('T',' ').slice(0,19)} | stream error | ${err.message}`);
        if (!res.writableEnded) res.destroy();
      });

      bodyStream.pipe(sseParser).pipe(res);
      const streamStart = Date.now() - _proxyStart;
      console.log(`[proxy:stream] ${new Date().toISOString().replace('T',' ').slice(0,19)} | ${method} ${targetUrl} | ${fetchRes.status} | started in ${streamStart}ms`);
      return;
    }

    const elapsed = Date.now() - _proxyStart;
    const resBody = Buffer.from(await fetchRes.arrayBuffer());
    console.log(`[proxy] ${new Date().toISOString().replace('T',' ').slice(0,19)} | ${method} ${targetUrl} | ${fetchRes.status} | ${elapsed}ms`);

    // 透传响应头（排除 hop-by-hop）
    const resHeaders: Record<string, string> = {};
    // P0-3 会修改 body 长度，content-length 必须移除让 Node 自动计算
    const skipHeaders = new Set(['transfer-encoding', 'connection', 'keep-alive', 'content-encoding', 'content-length']);
    fetchRes.headers.forEach((value, key) => {
      if (!skipHeaders.has(key)) {
        resHeaders[key] = value;
      }
    });

    // 协议翻译：剥 {code, data} 信封，前端直接拿到 data
    let finalBody: Buffer = resBody;
    try {
      const parsed = JSON.parse(resBody.toString('utf-8'));
      if (parsed && typeof parsed === 'object' && 'code' in parsed && 'data' in parsed && !('error' in parsed)) {
        finalBody = Buffer.from(JSON.stringify(parsed.data));
      }
    } catch { /* 非 JSON，原样透传 */ }
    // writeHead 不带 content-length → Node 自动 Transfer-Encoding: chunked 或计算实际长度
    res.writeHead(fetchRes.status, resHeaders);
    res.end(finalBody);
  } catch (e) {
    const elapsed = Date.now() - _proxyStart;
    const err = e as Error;
    console.error(`[proxy] ${new Date().toISOString().replace('T',' ').slice(0,19)} | ${method} ${targetUrl} | ${err.name === 'AbortError' ? 'TIMEOUT' : 'ERR'} | ${elapsed}ms | ${err.message}`);
    if (err.name === 'AbortError') {
      sendError(res, `Proxy request timed out (${PROXY_TIMEOUT_MS / 1000}s)`, 504);
    } else {
      sendError(res, `Proxy request failed: ${err.message}`, 502);
    }
  }
}

async function handleProxyJson(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const _proxyStart = Date.now();
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

  // ── [fix:特惠视频] 自指重写 → apimart-gateway ──
  // 特惠视频节点 discountVideoApiUrl 经前端 Kn()/lt() 处理成 `http://127.0.0.1:18080/api`
  // （docs/01 变更#1 base→18080 后，`$e(Je)`=Kn(g())=base+/api），提交 `S=`${x}/v1/gateway/generate``
  // 即 body.url = `http://127.0.0.1:18080/api/v1/gateway/generate`。它又打回 localTool 自身，
  // 无 `/api/v1/gateway/*` 具名路由 → 被 catch-all 透传官方 1mao → 官方 400
  // "Unknown or disabled model / channel"（www.1mao.cc 不认识 seedance-2.0-fast）。
  // 修复：检测到目标 host 是 localTool 自身 18080 且路径以 /api/v1/gateway/ 开头时，
  // 重写到 apimart-gateway 9004 并去掉 /api 前缀（apimart 路由无 /api，见 main.py /v1/gateway/*）。
  body.url = rewriteSelfGatewayUrl(body.url!, PORT);

  // ── 供应商分派（docs/api-接入）──
  // 前端 JSON 形态用 body.providerId 携带供应商；resolveProviderTarget 负责：
  //   - 无 providerId → url 不变（兼容现有调用）
  //   - openai 协议 + `openai://<path>` → 拼成 `${base}/v1/<path>` 并注入 Bearer key
  //   - apimart 协议 → url 原样透传（Lovart 走网关自身鉴权）
  const resolved = resolveProviderTarget(body.url, (body as any).providerId);
  body.url = resolved.url;

  const headers: Record<string, string> = { ...body.headers };
  if (body.cookie) {
    headers['Cookie'] = body.cookie;
  }

  // 供应商分派：openai 协议注入 Bearer key（apimart 协议 authHeader 为 undefined，保持原行为）
  if (resolved.authHeader) {
    headers['Authorization'] = resolved.authHeader;
  }

  let fetchBody: string | undefined = (typeof body.body === 'string' && body.body) || undefined;
  if (fetchBody) {
    headers['Content-Type'] = 'application/json';
    // 网关 chat/completions 默认 stream=true，但前端非流式请求用 T.json() 解析
    if (body.url?.includes('/chat/completions') && !fetchBody.includes('"stream"')) {
      try {
        const p = JSON.parse(fetchBody);
        p.stream = false;
        fetchBody = JSON.stringify(p);
      } catch { /* 解析失败保持原样 */ }
    }

    // 同步/异步交给前端决定：前端请求体已带 wait / 或 URL 已带 ?wait=1 → 网关同步 SSE 返回；
    // 不带 → 网关异步提交返回 task_id，前端自行轮询。localTool 不再强制注入 wait（见 daily/15）。
    // 网关同步模式经通用 SSE 流式透传分支（下方）逐块 pipe，无需在此特判。
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

    // 用 fetchWithProxy：外部 https provider（如魔搭 api-inference.modelscope.cn 本机直连被拒）
    // 需走代理；本地目标（127.0.0.1:9004 Lovart）fetchWithProxy 自动直连，不影响现有链路。
    const fetchRes = await fetchWithProxy(body.url, {
      method: body.method || 'POST',
      headers,
      body: fetchBody,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // ── 流式转发：SSE 响应不缓冲，解析 data: 行后逐 JSON 块 pipe ──
    const jsonResponseCt = fetchRes.headers.get('content-type') || '';
    if (jsonResponseCt.includes('text/event-stream')) {
      const streamHeaders: Record<string, string> = {};
      const streamSkip = new Set(['transfer-encoding', 'connection', 'keep-alive', 'content-encoding', 'content-length']);
      fetchRes.headers.forEach((value, key) => {
        if (!streamSkip.has(key)) streamHeaders[key] = value;
      });
      streamHeaders['content-type'] = 'text/event-stream';
      res.writeHead(fetchRes.status, streamHeaders);

      let bodyStream = Readable.fromWeb(fetchRes.body as any);
      const ce = fetchRes.headers.get('content-encoding') || '';
      if (ce === 'gzip' || ce === 'x-gzip') bodyStream = bodyStream.pipe(createGunzip());
      else if (ce === 'deflate') bodyStream = bodyStream.pipe(createInflate());
      else if (ce === 'br') bodyStream = bodyStream.pipe(createBrotliDecompress());

      const sseParser = createSSEParserTransform();

      bodyStream.on('error', (err: Error) => {
        console.error(`[proxy:stream] ${new Date().toISOString().replace('T',' ').slice(0,19)} | stream error | ${err.message}`);
        if (!res.writableEnded) res.destroy();
      });

      bodyStream.pipe(sseParser).pipe(res);
      const streamStart = Date.now() - _proxyStart;
      console.log(`[proxy:stream] ${new Date().toISOString().replace('T',' ').slice(0,19)} | ${body.method || 'POST'} ${body.url} | ${fetchRes.status} | started in ${streamStart}ms`);
      return;
    }

    const elapsed = Date.now() - _proxyStart;
    const resBody = Buffer.from(await fetchRes.arrayBuffer());
    console.log(`[proxy] ${new Date().toISOString().replace('T',' ').slice(0,19)} | ${body.method || 'POST'} ${body.url} | ${fetchRes.status} | ${elapsed}ms`);

    const resHeaders: Record<string, string> = {};
    // P0-3 会修改 body 长度，content-length 必须移除让 Node 自动计算
    const skipHeaders = new Set(['transfer-encoding', 'connection', 'keep-alive', 'content-encoding', 'content-length']);
    fetchRes.headers.forEach((value, key) => {
      if (!skipHeaders.has(key)) {
        resHeaders[key] = value;
      }
    });

    // 协议翻译：剥 {code, data} 信封，前端直接拿到 data
    let finalBody: Buffer = resBody;
    try {
      const parsed = JSON.parse(resBody.toString('utf-8'));
      if (parsed && typeof parsed === 'object' && 'code' in parsed && 'data' in parsed && !('error' in parsed)) {
        finalBody = Buffer.from(JSON.stringify(parsed.data));
      }
    } catch { /* 非 JSON，原样透传 */ }
    // writeHead 不带 content-length → Node 自动 Transfer-Encoding: chunked 或计算实际长度
    res.writeHead(fetchRes.status, resHeaders);
    res.end(finalBody);
  } catch (e) {
    const elapsed = Date.now() - _proxyStart;
    const err = e as Error;
    console.error(`[proxy] ${new Date().toISOString().replace('T',' ').slice(0,19)} | ${body.method || 'POST'} ${body.url} | ${err.name === 'AbortError' ? 'TIMEOUT' : 'ERR'} | ${elapsed}ms | ${err.message}`);
    if (err.name === 'AbortError') {
      sendError(res, `Proxy request timed out (${PROXY_TIMEOUT_MS / 1000}s)`, 504);
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
      _meta: { stub: true, message: '剪映发送功能尚未实现，当前仅记录请求（后续补）' },
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
    _meta: { stub: true, message: '剪映发送功能尚未实现，当前仅记录请求（后续补）' },
  });
}
