/**
 * 子模块 — 贴纸图标代理（iconify）—— 剪辑器贴纸面板的**统一出站口**。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么有它（TD-22-47）】贴纸图标原先有 **3 处各自拼 URL 直连公网**：
 *   · `engine/lib/iconify-api.ts`（搜索 / 集合 / 自建回落链）
 *   · `engine/services/renderer/nodes/sticker-node.ts`（导出渲染取图）
 *   · `ui/editor/panels/timeline/timeline-element.tsx`（时间轴缩略图）
 * 直连公网在「无外网 / 必须走代理」的环境下整体不可用，且**回落判据存在三份**。
 * 现统一经本端点转发：localTool 是唯一出站口（`fetchWithProxy` 自带「直连 → 代理隧道」兜底），
 * 上游回落链也只在这里一份。
 *
 * 【形态】`GET /api/iconify/<iconify 原路径>` —— **原样透传**（保留 query），
 * 上游依次尝试 api.iconify.design → api.simplesvg.com → api.unisvg.com（与前端原回落链同源）。
 *
 * 【失败要出声】三家都不可达 → **502 + 具体原因**。旧行为的病灶正是"静默空"：
 * 前端直连失败只表现为图标不显示，用户与开发者都无从判断。
 * ════════════════════════════════════════════════════════════════
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendError } from '../utils/helpers.js';
import { fetchWithProxy } from '../utils/netProxy.js';

const ICONIFY_PREFIX = '/api/iconify';

/** 上游回落链（唯一真源）：与前端原来的 ICONIFY_HOSTS 等序，搬到这里后前端不再自己回落。 */
const ICONIFY_UPSTREAMS = [
  'https://api.iconify.design',
  'https://api.simplesvg.com',
  'https://api.unisvg.com',
];

export async function handleIconifyProxy(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  // 用**原始** req.url 取路径段：`url.pathname` 已被解码一次，直接拼上游会对
  // 含 `%23`（`#` 的图标颜色参数）之类的路径二次编码。
  const rawPath = (req.url || '').split('?')[0];
  const rest = rawPath.startsWith(ICONIFY_PREFIX) ? rawPath.slice(ICONIFY_PREFIX.length) : '';
  if (!rest || rest === '/') {
    return sendError(res, 'iconify 路径为空（正确形态：/api/iconify/<prefix>/<name>.svg）', 400);
  }

  const query = url.search || '';
  let lastError = 'unknown';

  for (const upstream of ICONIFY_UPSTREAMS) {
    try {
      const upstreamRes = await fetchWithProxy(`${upstream}${rest}${query}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!upstreamRes.ok) {
        lastError = `${upstream} → HTTP ${upstreamRes.status}`;
        continue;
      }

      const buf = Buffer.from(await upstreamRes.arrayBuffer());
      res.writeHead(200, {
        'Content-Type': upstreamRes.headers.get('content-type') || 'application/octet-stream',
        'Content-Length': buf.length,
        // 图标是公开不可变资源：长缓存，省掉反复出站（浏览器侧缓存）。
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(buf);
      return;
    } catch (error) {
      lastError = `${upstream} → ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return sendError(res, `iconify 上游全部不可达：${lastError}`, 502, 'network');
}
