/**
 * 子模块 — 官方权益接口转发层
 * user/info / model-entitlements / agent/:id/vip-check
 *
 * 定位（见 docs/20-官方权益接口转发层方案.md）：
 * - 官方 1mao 是闭源外部服务（非自研），账号/权益/会员判定 100% 在官方远程服务器。
 * - 本层只做【中转 + 短缓存】，不取代官方判定，不伪造权限。
 * - 官方做权威源，localTool 转发；官方抖动时凭缓存降级不白屏。
 *
 * ⚠️ base 取值实测结论（2026-08-01，对 dist/assets 混淆源码逐字反查）：
 * - 前端三处权益接口的 base 并不是「默认即 18080/localTool」。
 *   实测证据链：httpClient `var Wn=Nn()`，`Nn`=endpointConfig 的 `g()`，
 *   `g() = u() || l()`，其中 `u()` 读 sessionStorage，`l()` 回退到候选列表
 *   `s()[0].url`（官方地址 https://www.1mao.cc）。
 * - 且 `g()`【只读 sessionStorage，不读 KV】——所以 docs/20 §3.3 原说的
 *   「POST /api/kv/set active_api_endpoint=127.0.0.1:18080 让 JSON 落 localTool」
 *   对这三处【无效】。要让请求真正打到本转发层，后续必须让前端把 base
 *   改为指向 18080（见文件尾部「后续补前端」说明）。
 * - 因此本层 OFFICIAL base 默认取官方候选地址（与前端 g() 回退一致），
 *   并支持 `x-official-base` 头 / KV `active_api_endpoint` 显式覆盖。
 *
 * 设计约束（对齐 docs/20 审计修正）：
 * - 独立 GET 端点，不复用 /api/proxy（其仅 POST，协议不兼容）。
 * - 透传 Authorization: Bearer，本地不解析会员语义。
 * - 错误透传官方原始状态码与 body（不包成 502）；仅本地网络错才返 502/504。
 * - 缓存用【进程内内存 Map】，不用 KV（避免 admin/import 清库，docs/20 §7.4）。
 * - 日志只记 method + path + status + 耗时 + token 前4位，绝不记完整 Bearer、绝不落库。
 * - 降级返回 stale 缓存时绝不伪造 allowed:true。
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { json, sendError } from '../utils/helpers.js';
import { getDb, queryOne } from '../db/database.js';

const OFFICIAL_TIMEOUT_MS = Number(process.env.OFFICIAL_TIMEOUT) || 15000; // 默认 15s

/** 主动失效路由的 key 前缀常量 */
export const OFFICIAL_KEY_USER_INFO = 'user:info';
export const OFFICIAL_KEY_ENTITLEMENTS = 'entitlements';

// ── 进程内内存缓存（按 token hash 隔离，避免串号）──
// key: `${bucket}:${tokenHash}`，value: { data: Buffer|string, status: number, headers, exp }
type CacheEntry = {
  data: Buffer;
  status: number;
  headers: Record<string, string>;
  exp: number; // 过期时间戳(ms)
};
const memCache = new Map<string, CacheEntry>();
// TTL：/user/info 60s，model-entitlements 300s（与前端内存缓存错开，避免 2×TTL 叠加）
const CACHE_TTL: Record<string, number> = {
  [OFFICIAL_KEY_USER_INFO]: 60_000,
  [OFFICIAL_KEY_ENTITLEMENTS]: 300_000,
};

/** Bearer → 前4位（日志脱敏用） */
function tokenPrefix(token: string | undefined): string {
  if (!token) return 'none';
  const t = token.replace(/^Bearer\s+/i, '');
  return t.length > 4 ? t.slice(0, 4) : t;
}

/** 摘取 Bearer 并做 hash（缓存键用，隔离账号） */
function tokenHash(auth: string | undefined): string {
  if (!auth) return 'anon';
  const t = auth.replace(/^Bearer\s+/i, '');
  return createHash('sha256').update(t).digest('hex').slice(0, 16);
}

/**
 * 官方接入点候选列表（对齐 endpointConfig `s()`/`g()`/`l()`）。
 * 前端权益 base 默认回退到 `s()[0].url` = 官方主接入点 https://www.1mao.cc。
 * localTool 转发层默认打这里（与前端 g() 回退一致），保证「前端直连官方」时
 * 本层若被改为接入（改前端 base 指向 18080）也能转发到同一官方地址。
 */
const OFFICIAL_DEFAULT_BASE = 'https://www.1mao.cc';

/**
 * 读取转发目标官方 base（优先级）：
 *   1. `x-official-base` 请求头（前端显式指定转发目标，最可控）；
 *   2. KV `active_api_endpoint`（保留「切换转发到备用接入点」能力，但过滤自指值）；
 *   3. 官方候选主接入点 OFFICIAL_DEFAULT_BASE。
 *
 * ⚠️ 自指过滤（2026-08-05 修复登录回环）：
 * KV `active_api_endpoint` 在前端「后端接入点」面板可被选成「本地引擎
 * http://127.0.0.1:18080」（endpointConfig 候选列表首个，docs/20 §1.1）。
 * 对 localTool 来说这是「把请求转发到自己」→ 无限回环 → `fetch failed`/
 * `Passthrough failed`（登录 `/api/auth/*` 即走 catch-all，实测踩中）。
 * 故读 KV 时必须过滤掉指向 localTool 自身（127.0.0.1/localhost + 18080）的值；
 * 其余有效接入点（官方主/备用/自建）仍保留，`x-official-base` 头仍最优先。
 */
export async function readOfficialBase(req: IncomingMessage): Promise<string> {
  // 优先级 1：请求头显式覆盖
  const headerBase = officialBaseHeader(req);
  if (headerBase && !isSelfBase(headerBase)) return headerBase;

  // 优先级 2：KV active_api_endpoint（过滤自指值，避免回环）
  try {
    const db = await getDb();
    const row = queryOne(db, 'SELECT value FROM kv WHERE key = ?', ['active_api_endpoint']);
    if (row && row.value) {
      const raw = row.value.trim().replace(/^"|"$/g, '').trim();
      const base = raw.replace(/\/$/, '');
      if (base && !isSelfBase(base)) return base;
    }
  } catch { /* 读 KV 失败回退默认 */ }

  // 优先级 3：官方候选主接入点
  return OFFICIAL_DEFAULT_BASE;
}

/**
 * 判断 base 是否指向 localTool 自身（本机 18080）。
 * 命中则必须忽略，否则转发层会把自己当目标 → 无限回环。
 */
function isSelfBase(base: string): boolean {
  try {
    const u = new URL(base);
    const host = u.hostname.toLowerCase();
    return (host === '127.0.0.1' || host === 'localhost' || host === '::1') && String(u.port) === '18080';
  } catch {
    return false;
  }
}

/** 解析 x-official-base 覆盖头（可选） */
function officialBaseHeader(req: IncomingMessage): string | undefined {
  const v = req.headers['x-official-base'];
  return typeof v === 'string' && v.trim() ? v.trim().replace(/\/$/, '') : undefined;
}

/** 解析 x-official-base 覆盖头（可选） */
function officialBase(req: IncomingMessage): string | undefined {
  const v = req.headers['x-official-base'];
  return typeof v === 'string' && v.trim() ? v.trim().replace(/\/$/, '') : undefined;
}

/** 透传响应头（排除 hop-by-hop） */
function buildResHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  const skip = new Set(['transfer-encoding', 'connection', 'keep-alive', 'content-encoding', 'content-length']);
  headers.forEach((value, key) => {
    if (!skip.has(key)) out[key] = value;
  });
  return out;
}

/**
 * 核心转发：GET 透传 + 可选内存缓存。
 * - 命中官方成功 → 写缓存（仅缓存性 bucket）。
 * - 官方 5xx/超时/网络错 → 若有 stale 缓存则返回 stale + x-cache: hit-stale；否则透传官方错误。
 * - 绝不伪造 allowed:true。
 */
async function forwardGet(
  res: ServerResponse,
  req: IncomingMessage,
  officialPath: string,
  opts: { cacheKey?: string; ttl?: number } = {},
): Promise<void> {
  const start = Date.now();
  const auth = (req.headers['authorization'] as string) || undefined;
  const cacheKey = opts.cacheKey ? `${opts.cacheKey}:${tokenHash(auth)}` : undefined;

  const url = new URL(req.url || '/', `http://127.0.0.1:18080`);
  const qs = url.search;
  const target = `${officialPath}${qs}`;

  // 读缓存
  if (cacheKey) {
    const hit = memCache.get(cacheKey);
    if (hit && hit.exp > Date.now()) {
      const elapsed = Date.now() - start;
      const hdrs: Record<string, string> = { ...hit.headers, 'x-cache': 'hit', 'x-official-cache-key': cacheKey };
      res.writeHead(hit.status, hdrs);
      res.end(hit.data);
      console.log(`[official] ${new Date().toISOString().replace('T',' ').slice(0,19)} | GET ${target} | ${hit.status} | HIT | ${elapsed}ms | tk=${tokenPrefix(auth)}`);
      return;
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OFFICIAL_TIMEOUT_MS);

  try {
    const fetchRes = await fetch(target, {
      method: 'GET',
      headers: { ...(auth ? { Authorization: auth } : {}) },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const elapsed = Date.now() - start;
    const body = Buffer.from(await fetchRes.arrayBuffer());
    const resHeaders = buildResHeaders(fetchRes.headers);

    // 官方 5xx → 返回 stale 缓存（若有），否则透传官方错误
    if (fetchRes.status >= 500) {
      if (cacheKey) {
        const stale = memCache.get(cacheKey);
        if (stale) {
          const hdrs: Record<string, string> = { ...stale.headers, 'x-cache': 'hit-stale', 'x-official-cache-key': cacheKey };
          res.writeHead(stale.status, hdrs);
          res.end(stale.data);
          console.log(`[official] ${new Date().toISOString().replace('T',' ').slice(0,19)} | GET ${target} | ${fetchRes.status} | STALE | ${elapsed}ms | tk=${tokenPrefix(auth)}`);
          return;
        }
      }
    }

    // 成功（2xx）→ 写缓存（若为缓存性 bucket）
    //
    // 【为什么还要判 JSON】2026-08-01 实测教训：
    // 官方同名路径存在「接口」与「前端页面」两套路由——
    //   /api/user/info → 401 JSON（真接口）； /user/info → 200 text/html（页面）。
    // 早期转发目标漏了 /api 前缀，官方返回 200 HTML 登录页，
    // 因 `fetchRes.ok` 为真而被当作合法权益数据缓存 60s，前端会读到一坨 HTML。
    // 路径已修正，此处再加一道类型防线：权益接口只接受 JSON，
    // 任何非 JSON 的 2xx 一律视为「打错路由/被网关拦截」，透传但不缓存。
    const ctype = (fetchRes.headers.get('content-type') || '').toLowerCase();
    const isJson = ctype.includes('json');
    if (fetchRes.ok && cacheKey && opts.ttl) {
      if (isJson) {
        memCache.set(cacheKey, { data: body, status: fetchRes.status, headers: resHeaders, exp: Date.now() + opts.ttl });
      } else {
        console.warn(`[official] 跳过缓存：期望 JSON 但收到 "${ctype || 'unknown'}" | GET ${target} —— 疑似打到官方页面路由或被网关拦截`);
      }
    }

    // 透传官方原始状态码与 body（含 4xx/401/403，不包成 502）
    const hdrs: Record<string, string> = { ...resHeaders };
    if (cacheKey) hdrs['x-official-cache-key'] = cacheKey;
    res.writeHead(fetchRes.status, hdrs);
    res.end(body);
    console.log(`[official] ${new Date().toISOString().replace('T',' ').slice(0,19)} | GET ${target} | ${fetchRes.status} | ${elapsed}ms | tk=${tokenPrefix(auth)}`);
  } catch (e: any) {
    clearTimeout(timeout);
    const elapsed = Date.now() - start;
    const err = e as Error;
    // 网络错/超时 → 若有 stale 缓存则返回；否则返回 502/504（本地错误）
    if (cacheKey) {
      const stale = memCache.get(cacheKey);
      if (stale) {
        const hdrs: Record<string, string> = { ...stale.headers, 'x-cache': 'hit-stale', 'x-official-cache-key': cacheKey };
        res.writeHead(stale.status, hdrs);
        res.end(stale.data);
        console.log(`[official] ${new Date().toISOString().replace('T',' ').slice(0,19)} | GET ${target} | ERR(${err.name}) | STALE | ${elapsed}ms | tk=${tokenPrefix(auth)}`);
        return;
      }
    }
    console.error(`[official] ${new Date().toISOString().replace('T',' ').slice(0,19)} | GET ${target} | ${err.name === 'AbortError' ? 'TIMEOUT' : 'ERR'} | ${elapsed}ms | ${err.message}`);
    if (err.name === 'AbortError') {
      sendError(res, `Official request timed out (${OFFICIAL_TIMEOUT_MS / 1000}s)`, 504);
    } else {
      sendError(res, `Official request failed: ${err.message}`, 502);
    }
  }
}

// ── GET /api/user/info ──
export async function handleOfficialUser(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const base = await readOfficialBase(req);
  // 注意：必须带 /api 前缀。实测（2026-08-01）官方两条路径行为不同：
  //   GET https://www.1mao.cc/api/user/info → 401 {"error":"无效或过期的认证令牌"}（真接口）
  //   GET https://www.1mao.cc/user/info     → 200 text/html（前端页面路由，非接口）
  // 早期写成 `${base}/user/info` 会拿回 HTML 登录页并被当作成功响应缓存，故修正。
  return forwardGet(res, req, `${base}/api/user/info`, {
    cacheKey: OFFICIAL_KEY_USER_INFO,
    ttl: CACHE_TTL[OFFICIAL_KEY_USER_INFO],
  });
}

// ── GET /api/user/model-entitlements ──
export async function handleOfficialEntitlements(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const base = await readOfficialBase(req);
  // 同 handleOfficialUser：必须带 /api 前缀，否则命中官方前端页面路由而非接口
  return forwardGet(res, req, `${base}/api/user/model-entitlements`, {
    cacheKey: OFFICIAL_KEY_ENTITLEMENTS,
    ttl: CACHE_TTL[OFFICIAL_KEY_ENTITLEMENTS],
  });
}

// ── GET /api/agent/:id/vip-check（实时透传，不缓存）──
export async function handleOfficialVipCheck(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const base = await readOfficialBase(req);
  const m = (url.pathname || '').match(/^\/api\/agent\/([^/]+)\/vip-check$/);
  const agentId = m ? m[1] : '';

  // 本地放行画布助手（docs/27 §3.4 方案二）：A1 画布助手应完全本地跑通，
  // 不依赖官方会员判定。开关：localTool/.env 的 AI_CANVAS_LOCAL !== '0'（默认开启）。
  // 注：docs/27 §10.1 实测——chat 入口只依赖登录态、并不读 vip-check 的 allowed，
  // 故此放行属「可选优化」，让 vip-check 也不外发官方，而非必需前置。
  if (agentId === 'canvas-assistant' && process.env.AI_CANVAS_LOCAL !== '0') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ allowed: true, reason: 'local canvas assistant' }));
    console.log(`[official] ${new Date().toISOString().replace('T',' ').slice(0,19)} | GET ${url.pathname} | 200 | LOCAL allow (canvas-assistant)`);
    return;
  }

  // 同上：带 /api 前缀。不传 cacheKey → 不缓存（会员判定必须实时）
  return forwardGet(res, req, `${base}/api/agent/${agentId}/vip-check`);
}

// ── POST /api/official/entitlements/invalidate（主动失效缓存）──
// 权益变更（升级/降级）后调用，不必等 TTL 自然过期
export async function handleOfficialInvalidate(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let removed = 0;
  const targetPrefix = req.headers['x-cache-key'];
  for (const [k, v] of memCache) {
    if (targetPrefix && !k.startsWith(String(targetPrefix))) continue;
    memCache.delete(k);
    removed++;
  }
  return json(res, { ok: true, removed });
}

/* ==========================================================================
 * ⚠️ 后续补前端（让转发层真正生效）
 * --------------------------------------------------------------------------
 * 现状：前端三处权益接口的 base 默认取自 endpointConfig 候选列表
 *   `g()`(u()||l()) → l() = s()[0].url = https://www.1mao.cc（官方直连），
 *   且 g() 只读 sessionStorage 不读 KV。故当前这些请求【不经过本转发层】，
 *   本层仅作为「官方 base 统一入口」就绪，等待前端改道后接管。
 *
 * 要让请求真正打到这里，后续需满足其一（按可控性排序）：
 *   A. 改前端 dist：把三处调用 base 指向 http://127.0.0.1:18080
 *      - `/user/info`：`ut("/user/info")` / `_t.get("/user/info")`，改 base 为 18080
 *      - `model-entitlements`：`Ui(e2,...)` 的 `e2` base 改 18080
 *      - `vip-check`：`fetch(`${Je}${st}/agent/...`)`，改 `Je` 为 18080
 *      最可控；dist 属授权手改，需按 CLAUDE.md 规程（备份/grep/单独 commit）。
 *   B. 用户在画布 UI 把接入点切到 localTool/18080（写 sessionStorage），
 *      则 g() 返回 18080，请求落本层——但依赖用户手动切换，非默认态。
 *   C. 运行时先实测确认（DevTools 看三请求真实 base）：
 *      若实际走的是候选地址而非 18080，说明必须走 A 或 B。
 * --------------------------------------------------------------------------
 * 校验命令（本层就绪后可手动验证转发）：
 *   curl -H "Authorization: Bearer <token>" \
 *        http://127.0.0.1:18080/api/user/model-entitlements
 *   应看到 localTool 以 [official] 前缀日志转发到官方并返回结果。
 * ========================================================================== */
