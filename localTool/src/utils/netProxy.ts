/**
 * 跨平台出站代理工具（Win / Mac 通用，零第三方依赖）
 * ------------------------------------------------------------
 * 背景：localTool 是独立 Node 进程，其原生 fetch 不继承浏览器/系统代理配置。
 * 而部分外部 CDN（如 Lovart 的 a.lovart.ai）在本机必须经代理才能访问——
 * 浏览器配了代理能开，localTool 直连则超时（表现：POST /api/files/upload 400）。
 *
 * 方案（最优解，满足 CLAUDE.md §3 奥卡姆剃刀）：
 *  1. 优先直连（本地 127.0.0.1 / localhost、以及公网直连可达的域名）→ 性能最好、零影响；
 *  2. 直连失败且检测到可用代理时 → 用 node:https CONNECT 隧道经代理重试；
 *  3. 代理解析优先级：HTTPS_PROXY > HTTP_PROXY > ALL_PROXY（大小写兼容）→ 无则探测常见本机端口。
 *
 * 本模块只服务「下载/转发外部资源」的场景，localTool 内部 /api/proxy → 127.0.0.1:9004
 * 是本地链路，绝不走代理（避免误伤本地请求）。
 */

import * as https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { Readable } from 'node:stream';

/** 常见本机代理端口（Clash / ClashX / Clash Verge / V2Ray 等默认端口），按优先级探测 */
const COMMON_PROXY_PORTS = [7897, 7890, 1087, 1080, 8888, 8118];
const PROXY_PROBE_TIMEOUT_MS = 300;
const CONNECT_TIMEOUT_MS = 10000;

/** 本机/局域网地址（不经过代理，避免代理本地请求或代理劫持） */
function isLocalTarget(url: URL): boolean {
  const host = url.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
  return /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(host);
}

/** 从环境变量解析代理地址，返回形如 http://host:port 的 URL，无则返回 null */
function proxyFromEnv(): string | null {
  const candidates = [
    process.env.HTTPS_PROXY,
    process.env.https_proxy,
    process.env.HTTP_PROXY,
    process.env.http_proxy,
    process.env.ALL_PROXY,
    process.env.all_proxy,
  ];
  for (const c of candidates) {
    if (c && typeof c === 'string') {
      const v = c.trim();
      if (v) return v;
    }
  }
  return null;
}

/** 探测某代理端口是否可连，返回代理 URL 或 null */
async function probePort(host: string, port: number): Promise<string | null> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const onDone = (ok: boolean) => {
      socket.destroy();
      resolve(ok ? `http://${host}:${port}` : null);
    };
    socket.setTimeout(PROXY_PROBE_TIMEOUT_MS);
    socket.once('connect', () => onDone(true));
    socket.once('timeout', () => onDone(false));
    socket.once('error', () => onDone(false));
    socket.connect(port, host);
  });
}

/** 缓存解析结果，避免每次下载都重新探测端口 */
let _cachedProxy: string | null | undefined;
let _cacheTime = 0;
const CACHE_TTL_MS = 60_000;

/** 解析出可用代理地址；环境变量优先，无则探测常见本机端口。返回 null 表示无需/无代理 */
export async function resolveProxy(): Promise<string | null> {
  const now = Date.now();
  if (_cachedProxy !== undefined && now - _cacheTime < CACHE_TTL_MS) return _cachedProxy;

  const fromEnv = proxyFromEnv();
  if (fromEnv) {
    _cachedProxy = fromEnv;
    _cacheTime = now;
    return fromEnv;
  }

  // 无环境变量：探测常见本机代理端口（仅测 127.0.0.1）
  for (const port of COMMON_PROXY_PORTS) {
    const p = await probePort('127.0.0.1', port);
    if (p) {
      _cachedProxy = p;
      _cacheTime = now;
      return p;
    }
  }

  _cachedProxy = null;
  _cacheTime = now;
  return null;
}

/** 清除代理解析缓存（测试/配置变更时用） */
export function resetProxyCache(): void {
  _cachedProxy = undefined;
  _cacheTime = 0;
}

/**
 * 经 HTTP 代理用 CONNECT 隧道请求 https URL，返回一个兼容 fetch Response 的最小实现。
 * 仅支持 https 目标（CONNECT 隧道）；http 目标走普通代理 GET（较少见，暂用 http.request 转发）。
 * 失败抛 Error（由调用方按既有降级逻辑处理）。
 */
function proxyRequest(proxyUrl: string, targetUrl: string, init?: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    let pu: URL;
    try {
      pu = new URL(proxyUrl);
    } catch {
      reject(new Error(`Invalid proxy URL: ${proxyUrl}`));
      return;
    }
    let tu: URL;
    try {
      tu = new URL(targetUrl);
    } catch {
      reject(new Error(`Invalid target URL: ${targetUrl}`));
      return;
    }

    const method = (init?.method || 'GET').toUpperCase();
    const proxyHost = pu.hostname;
    const proxyPort = pu.port ? Number(pu.port) : (pu.protocol === 'https:' ? 443 : 80);

    // 先与代理建立 TCP 连接
    const socket = net.connect({ host: proxyHost, port: proxyPort });
    const timeoutTimer = setTimeout(() => {
      socket.destroy();
      reject(new Error('Proxy CONNECT timeout'));
    }, CONNECT_TIMEOUT_MS);

    socket.once('error', (err) => {
      clearTimeout(timeoutTimer);
      reject(new Error(`Proxy connect failed: ${err.message}`));
    });

    socket.once('connect', () => {
      // 发送 CONNECT 建立隧道
      const connectReq = `${method === 'CONNECT' ? method : 'CONNECT'} ${tu.host}:${(tu.port || (tu.protocol === 'https:' ? 443 : 80))} HTTP/1.1\r\n` +
        `Host: ${tu.host}:${(tu.port || (tu.protocol === 'https:' ? 443 : 80))}\r\n` +
        `Proxy-Connection: keep-alive\r\n\r\n`;
      socket.write(connectReq);
    });

    // 接收 CONNECT 响应头（直到 \r\n\r\n）
    let headBuf = Buffer.alloc(0);
    let connected = false;

    const onHeadData = (chunk: Buffer) => {
      headBuf = Buffer.concat([headBuf, chunk]);
      const idx = headBuf.indexOf('\r\n\r\n');
      if (idx === -1) return;
      socket.removeListener('data', onHeadData);
      const head = headBuf.slice(0, idx).toString('utf8');
      const firstLine = head.split('\r\n')[0];
      const status = parseInt(firstLine.split(' ')[1] || '0', 10);

      if (status !== 200) {
        clearTimeout(timeoutTimer);
        socket.destroy();
        reject(new Error(`Proxy CONNECT failed with ${firstLine}`));
        return;
      }

      // 隧道建立成功，剥离 CONNECT 响应头后的剩余数据作为首块
      connected = true;
      clearTimeout(timeoutTimer);
      const rest = headBuf.slice(idx + 4);

      // 用 https 模块在已 CONNECT 的隧道 socket 上做 TLS 握手后发起目标请求。
      // 注意：必须用 tls.connect({ socket }) 包一层 TLS，否则会"把明文 HTTP 发到 HTTPS 端口"(400)。
      const tlsSocket = https.request({
        host: tu.host,
        port: tu.port ? Number(tu.port) : 443,
        path: tu.pathname + tu.search,
        method,
        headers: init?.headers as Record<string, string> | undefined,
        createConnection: () =>
          tls.connect({
            socket,
            servername: tu.host,
          }),
      });

      tlsSocket.on('response', (response) => {
        // 组装兼容 fetch 的 Response
        const chunks: Buffer[] = [];
        response.on('data', (c: Buffer) => chunks.push(c));
        response.on('end', () => {
          const bodyBuf = Buffer.concat(chunks);
          const headers = new Headers();
          const rh = response.headers;
          for (const k in rh) {
            const v = rh[k];
            if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : String(v));
          }
          resolve(proxyResponse(response.statusCode || 502, headers, bodyBuf));
        });
        response.on('error', (err) => reject(err));
      });

      tlsSocket.on('error', (err) => reject(err));

      // 若 CONNECT 头后还有剩余数据（不可能，但安全处理）
      if (rest.length > 0) {
        tlsSocket.write(rest);
      }

      const body = init?.body;
      if (body && method !== 'GET' && method !== 'HEAD') {
        if (typeof body === 'string') tlsSocket.end(body);
        else if (Buffer.isBuffer(body)) tlsSocket.end(body);
        else if (body instanceof Uint8Array) tlsSocket.end(Buffer.from(body));
        else tlsSocket.end();
      } else {
        tlsSocket.end();
      }
    };

    socket.on('data', onHeadData);
  });
}

/**
 * fetch Response 兼容最小实现（仅供调用方读 status / ok / headers / arrayBuffer / body / text）。
 * 不做 `implements Response` 严格实现（TS 对 bytes() 返回泛型要求过严），以结构兼容 + 断言转换返回。
 */
function proxyResponse(status: number, headers: Headers, body: Buffer): Response {
  const self: Record<string, unknown> = {
    status,
    statusText: status === 200 ? 'OK' : `HTTP ${status}`,
    ok: status >= 200 && status < 300,
    url: '',
    redirected: false,
    type: 'basic',
    headers,
    body: Readable.from(body) as unknown as ReadableStream,
    bodyUsed: false,
    clone() { return self as unknown as Response; },
    arrayBuffer() { return Promise.resolve(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)); },
    blob() { return Promise.resolve(new Blob([new Uint8Array(body)])); },
    json() { return Promise.resolve(JSON.parse(body.toString('utf8'))); },
    text() { return Promise.resolve(body.toString('utf8')); },
    formData() { return Promise.reject(new Error('Not implemented')); },
    bytes() { return Promise.resolve(new Uint8Array(body)); },
  };
  return self as unknown as Response;
}

/**
 * 通用出站 fetch：优先直连，失败且检测到可用代理时经代理重试。
 * - 本地目标（127.0.0.1/localhost/内网）永不走代理；
 * - 调用方仍按 fetch 语义处理返回（status/ok/arrayBuffer 等）。
 */
export async function fetchWithProxy(input: string | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input));

  // 本地目标 / http 目标：直连（CONNECT 隧道仅适合 https）
  if (url.protocol !== 'https:' || isLocalTarget(url)) {
    return fetch(url.toString(), init);
  }

  // 先直连（公网直连可达的最优路径，性能最好）
  try {
    return await fetch(url.toString(), init);
  } catch {
    // 直连失败，尝试代理
  }

  const proxy = await resolveProxy();
  if (!proxy) {
    // 无可用代理：重新抛原始直连错误，由调用方按既有降级逻辑处理
    return fetch(url.toString(), init);
  }

  try {
    return await proxyRequest(proxy, url.toString(), init);
  } catch (proxyErr) {
    // 代理也失败：抛代理错误（调用方降级）
    throw proxyErr;
  }
}

/** 供调试：打印当前代理解析结果 */
export function logProxyInfo(): void {
  void resolveProxy().then((p) => console.log(`[netProxy] 解析到代理: ${p || '(无，将直连)'}`));
}
