/**
 * 子模块 — catch-all 兜底透传（localTool 全量接管的基石）
 *
 * ============================================================================
 * 【为什么要有这个文件】—— 2026-08-01 确立的核心原则
 * ----------------------------------------------------------------------------
 * 原则：**不再区分「哪些请求该直连官方、哪些该走 localTool」——全部走 localTool。
 *       即使请求的最终目的地仍是官方 1mao，也必须经由 localTool 转发出去。**
 *
 * 即 localTool 的定位从「白名单路由服务」升级为「**唯一出口网关**」：
 *
 *     前端所有请求 ──→ localTool 18080
 *        ├─ 命中本地具名路由（权益/模型/文件/任务/资源/KV…）→ 本地处理
 *        └─ 未命中 ─────────────────────────────────────────→ 本文件 catch-all
 *                                                              → 原样转发官方
 *
 * ----------------------------------------------------------------------------
 * 【为什么这是「改 dist base」的硬前置】
 * ----------------------------------------------------------------------------
 * 长期目标（docs/01 §〇）是改 dist，把前端 base 从官方地址
 * （`g()` = `u()||l()` → `s()[0].url` = https://www.1mao.cc）
 * 改指到 http://127.0.0.1:18080，让请求统一经 localTool 转发。
 *
 * 但改之前有个致命问题：index.ts 的路由是**逐条 `pathname === '...'` 精确匹配**，
 * 末尾兜底只处理静态页，其余一律 404（原 index.ts:326-331）。
 * 所以若「先改 base、后补透传」，则所有**未注册的** `/api/` 路径
 * （登录、支付、上传凭证、埋点……）会当场 404，功能立刻损坏。
 *
 * ⇒ 因此必须**先有本文件（catch-all），再改 dist base**。
 *   有了它，改 base 变成零风险操作：未接管的请求行为不变，只是多绕一跳 localTool。
 *
 * ----------------------------------------------------------------------------
 * 【收益】
 * ----------------------------------------------------------------------------
 * 1. 改 base 零风险    —— 未接管请求原样透传，功能不变。
 * 2. 免除白名单核对    —— 不用再逐条排查 docs/20 §9.1「哪些接口必须直连官方」。
 * 3. 后续接管零前端成本 —— 想本地化任何接口，只在 index.ts 加一条具名路由即可，
 *                          它会自动优先于 catch-all 命中，**dist 一行都不用再动**。
 * 4. 全链路可观测      —— 所有出站流量集中一处，`[passthrough]` 日志可见
 *                          「到底还有哪些接口在连官方」，为后续本地化排优先级。
 *
 * ----------------------------------------------------------------------------
 * 【设计约束】（与 official.ts 转发层一致，避免两套语义）
 * ----------------------------------------------------------------------------
 * - 目标 base 复用 official.ts 的 readOfficialBase()：
 *     x-official-base 头 → KV active_api_endpoint（过滤自指值）→ 默认 https://www.1mao.cc。
 *   2026-08-05 修复登录回环：readOfficialBase 读 KV 时会过滤指向 localTool 自身
 *   （127.0.0.1/localhost:18080）的值，避免「把请求转发给自己」的无限回环（见 official.ts）。
 *   这样「转发给谁」只有一个决策点，改一处即可整体改道（官方/自建/第三方）。
 * - 原样透传：method / path / query / body / 请求头（**尤其 Authorization: Bearer**）。
 * - 原样回传：状态码 / 响应头 / body，**不改写、不包装、不缓存**。
 *   （缓存是 official.ts 对特定权益接口的**显式**行为；兜底层必须无副作用，
 *     否则会误缓存登录态、支付回调等敏感/一次性响应。）
 * - **流式透传**：用 body.pipeTo 而非 arrayBuffer，保证 SSE 可用
 *   （A1 画布助手 /agent/:id/chat 依赖流式，缓冲会导致「打字机效果」失效）。
 * - 不做鉴权判定、不解析业务语义：本层是「管道」，不是「网关策略层」。
 * - 日志脱敏：只记 token 前 4 位，绝不打印完整 Bearer、绝不落库。
 *
 * ----------------------------------------------------------------------------
 * 【不进入本层的请求】（在 index.ts 中已提前 return，见调用点注释）
 * ----------------------------------------------------------------------------
 * - `/files/` 前缀       → 本地磁盘文件服务（handleStaticFile）
 * - 前端静态页与资源     → dist/ 托管（handleFrontendPage）
 * - `/plugin/` 前缀      → 本地插件清单
 * 这些是纯本地资源，转发给官方没有意义且会 404。
 *
 * 相关文档：docs/21 §六（执行前置）、docs/01 §〇（长期目标总纲）、docs/20（转发层方案）
 * ==========================================================================
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { Writable } from 'node:stream';
import { sendError } from '../utils/helpers.js';
import { readOfficialBase } from './official.js';

/** 兜底透传超时（比 official.ts 略长，兼容慢接口/流式） */
const PASSTHROUGH_TIMEOUT_MS = Number(process.env.PASSTHROUGH_TIMEOUT) || 30000;

/**
 * 不应转发给官方的本地路径前缀。
 * 命中这些前缀说明是本地资源请求，转发出去没有意义（官方也没有这些路径）。
 */
const LOCAL_ONLY_PREFIXES = ['/files/', '/plugin/'];

/**
 * hop-by-hop 头：属于「本跳连接」的元信息，不能跨跳转发（RFC 7230 §6.1）。
 * 强行转发会导致解码错乱（如上游已 gzip，我们再声明一次 content-encoding）。
 */
const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade',
  'content-length',  // 由 fetch/undici 按实际 body 重算
  'host',            // 必须换成目标站的 host，否则部分网关会拒绝
]);

/** Bearer → 前 4 位（日志脱敏用，与 official.ts 保持一致） */
function tokenPrefix(auth: string | undefined): string {
  if (!auth) return 'none';
  const t = auth.replace(/^Bearer\s+/i, '');
  return t.length > 4 ? t.slice(0, 4) : t;
}

/** 时间戳（日志用，与 official.ts 保持一致格式） */
function ts(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

/** 判断是否为本地专属路径（不转发） */
export function isLocalOnlyPath(pathname: string): boolean {
  return LOCAL_ONLY_PREFIXES.some((p) => pathname.startsWith(p));
}

/** 构造转发给官方的请求头：剔除 hop-by-hop，保留业务头（含 Authorization） */
function buildForwardHeaders(req: IncomingMessage, targetUrl: URL): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    const key = k.toLowerCase();
    if (HOP_BY_HOP.has(key)) continue;
    if (v === undefined) continue;
    out[key] = Array.isArray(v) ? v.join(', ') : String(v);
  }
  // host 换成目标站，避免上游按 Host 路由时被拒
  out['host'] = targetUrl.host;
  // 去掉可能误导上游的本地来源头（我们是代理，不是浏览器同源请求）
  delete out['origin'];
  delete out['referer'];
  return out;
}

/** 构造回传给前端的响应头：剔除 hop-by-hop 与由 Node 自行管理的头 */
function buildBackHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  const skip = new Set([...HOP_BY_HOP, 'content-encoding']); // fetch 已自动解压，不能再声明
  headers.forEach((value, key) => {
    if (skip.has(key.toLowerCase())) return;
    out[key] = value;
  });
  return out;
}

/**
 * catch-all 兜底透传：把未被本地路由接管的请求原样转发到官方。
 *
 * 调用位置：index.ts 中【所有具名路由之后、404 之前】。
 * 顺序至关重要——具名路由必须优先，否则本地已实现的能力会被透传出去，
 * 等于「白实现」（例如 /public/platform/builtin 的本地静态清单会被官方响应覆盖）。
 *
 * @returns true 表示已处理（已写响应）；false 表示不该由本层处理（交回 404）
 */
export async function handlePassthrough(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<boolean> {
  const pathname = url.pathname;
  const method = (req.method || 'GET').toUpperCase();

  // 本地专属路径不转发（转出去官方也没有，徒增延迟与噪音日志）
  if (isLocalOnlyPath(pathname)) return false;

  const start = Date.now();
  const auth = (req.headers['authorization'] as string) || undefined;

  // 转发目标：复用 official.ts 的三级优先级，保证「转发给谁」只有一个决策点
  const base = await readOfficialBase(req);
  let targetUrl: URL;
  try {
    targetUrl = new URL(`${base}${pathname}${url.search}`);
  } catch {
    sendError(res, `Invalid passthrough target: ${base}${pathname}`, 500);
    return true;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PASSTHROUGH_TIMEOUT_MS);

  try {
    // GET/HEAD 无 body；其余方法把请求流直接接给 fetch（避免整体缓冲大文件上传）
    const hasBody = method !== 'GET' && method !== 'HEAD';

    const fetchRes = await fetch(targetUrl, {
      method,
      headers: buildForwardHeaders(req, targetUrl),
      body: hasBody ? (req as unknown as ReadableStream) : undefined,
      // Node 18+ 用请求流做 body 时必须显式声明半双工，否则报 duplex 错误
      ...(hasBody ? { duplex: 'half' } : {}),
      redirect: 'manual', // 重定向原样回传给前端，由前端决定跟不跟（保留 Set-Cookie 语义）
      signal: controller.signal,
    } as RequestInit);

    clearTimeout(timer);

    res.writeHead(fetchRes.status, buildBackHeaders(fetchRes.headers));

    // ── 流式回传（关键）──
    // 不用 arrayBuffer()：那会把整个响应缓冲进内存，导致
    //   ① SSE（A1 助手 /agent/*/chat）失去流式效果，前端要等全部结束才显示；
    //   ② 大文件下载占用大量内存。
    if (fetchRes.body) {
      await fetchRes.body.pipeTo(Writable.toWeb(res) as WritableStream<Uint8Array>);
    } else {
      res.end();
    }

    console.log(
      `[passthrough] ${ts()} | ${method} ${pathname} | -> ${targetUrl.host} | ${fetchRes.status} | ${Date.now() - start}ms | tk=${tokenPrefix(auth)}`,
    );
    return true;
  } catch (e) {
    clearTimeout(timer);
    const err = e as Error;
    const elapsed = Date.now() - start;
    console.error(
      `[passthrough] ${ts()} | ${method} ${pathname} | -> ${targetUrl.host} | ${err.name === 'AbortError' ? 'TIMEOUT' : 'ERR'} | ${elapsed}ms | ${err.message}`,
    );

    // 响应头已发出（流式中途失败）→ 只能断流，不能再写状态码
    if (res.headersSent) {
      res.destroy();
      return true;
    }
    if (err.name === 'AbortError') {
      sendError(res, `Passthrough timed out (${PASSTHROUGH_TIMEOUT_MS / 1000}s)`, 504);
    } else {
      // 本地/网络错才返 502；上游自身的 4xx/5xx 已在上面原样透传，不会走到这里
      sendError(res, `Passthrough failed: ${err.message}`, 502);
    }
    return true;
  }
}
