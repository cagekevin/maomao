/**
 * 子模块 — 转写模型代理（huggingface）—— 剪辑器「字幕/转写」的**统一出站口**。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么有它（TD-22-57）】转写引擎经 `@huggingface/transformers` **直连 huggingface.co**
 * 拉模型（120MB~1.6GB）——与 iconify 直连同母体：无唯一出站口、无法在「无外网 / 必须走代理」
 * 的环境下工作、失败只表现为"转写转不动"（用户与开发者都无从判断）。
 * 现统一经本端点转发：localTool 是唯一出站口（`fetchWithProxy` 自带「直连 → 代理隧道」兜底）。
 *
 * 【形态】`GET /api/hf/<huggingface 原路径>` —— **原样透传**（保留 query）。
 * 前端把 `@huggingface/transformers` 的 `env.remoteHost` 指向 `${API_BASE}/api/hf/`，
 * 于是它的请求 `<remoteHost><model>/resolve/<rev>/<file>` 经此转发到
 * `https://huggingface.co/<model>/resolve/<rev>/<file>`。
 * （默认 `remotePathTemplate = '{model}/resolve/{revision}/'`，见库源码。）
 *
 * 【另一个出站面】库还会从 `cdn.jsdelivr.net` 取 onnxruntime-web 的 wasm（`env.backends.onnx.wasm.wasmPaths`）。
 * 那一路**不在本代理内**（它是静态 CDN，非模型仓库，且可被 ORT 的 wasmPaths 覆盖）——
 * 当前保留其直连；如将来需要离线，再单独收口（勿把两者混为一谈）。
 *
 * 【失败要出声】上游不可达 → **502 + 具体原因**。旧行为的病灶正是"静默失败"。
 * ════════════════════════════════════════════════════════════════
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendError } from '../utils/helpers.js';
import { fetchWithProxy } from '../utils/netProxy.js';

const HF_PREFIX = '/api/hf';

/** 上游（唯一）：huggingface.co 模型仓库。 */
const HF_UPSTREAM = 'https://huggingface.co';

export async function handleHfProxy(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  // 用**原始** req.url 取路径段（`url.pathname` 已解码一次，直接拼上游会二次编码）。
  const rawPath = (req.url || '').split('?')[0];
  const rest = rawPath.startsWith(HF_PREFIX) ? rawPath.slice(HF_PREFIX.length) : '';
  if (!rest || rest === '/') {
    return sendError(res, 'hf 路径为空（正确形态：/api/hf/<model>/resolve/<rev>/<file>）', 400);
  }

  const query = url.search || '';
  try {
    const upstreamRes = await fetchWithProxy(`${HF_UPSTREAM}${rest}${query}`, {
      signal: AbortSignal.timeout(30_000), // 模型分片较大，超时放宽（对比 iconify 8s）
      redirect: 'follow', // HF 的 resolve/* 会 302 到 CDN（cas-bridge / cdn-lfs）
    });
    if (!upstreamRes.ok) {
      return sendError(res, `hf 上游 HTTP ${upstreamRes.status}：${rest}`, 502, 'network');
    }

    const buf = Buffer.from(await upstreamRes.arrayBuffer());
    res.writeHead(200, {
      'Content-Type': upstreamRes.headers.get('content-type') || 'application/octet-stream',
      'Content-Length': buf.length,
      // 模型文件是**不可变**资源（resolve/<revision> 内按内容寻址）：长缓存，省掉反复出站。
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(buf);
  } catch (error) {
    return sendError(
      res,
      `hf 上游不可达：${error instanceof Error ? error.message : String(error)}`,
      502,
      'network',
    );
  }
}
