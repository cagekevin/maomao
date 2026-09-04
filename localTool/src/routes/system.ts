/**
 * 子模块 0.5 — 系统路由
 * gateway-task / status / jianying/send
 *
 * 说明：旧生成透传链（POST /api/proxy 的 handleProxy / handleProxyJson /
 * handleProxyFormData 及 proxy 专用 helper）已按 relay 收口计划整段移除。
 * 生成改由 relay（src/relay.ts → ai-relay 引擎）承载；本文件不再包含任何转发代理逻辑。
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { json, parseJsonBody, sendError } from '../utils/helpers.js';
import { VERSION } from '../version.js';
import { fetchWithTimeout } from '../utils/fetchTimeout.js';

const PORT = Number(process.env.PORT) || 18080;
const APIMART_PORT = Number(process.env.APIMART_PORT) || 9004; // apimart-gateway 端口（见 CLAUDE.md 端口铁律）
const PROXY_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT) || 300000; // 默认 5min

/**
 * GET /api/v1/gateway/task/:taskId —— 特惠视频任务查询（App 全局 setInterval 直连）
 *
 * 背景（见变更 #6）：特惠视频节点内部轮询曾被 rewriteSelfGatewayUrl 转发 9004；
 * App 组件的全局 setInterval（App-BX6o9fW5_components/Vr.jsx 约 L1310）【直接 fetch】
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
  try {
    const fetchRes = await fetchWithTimeout(
      target,
      {
        method: 'GET',
        headers: auth ? { Authorization: auth, Accept: '*/*' } : { Accept: '*/*' },
      },
      PROXY_TIMEOUT_MS,
    );
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
    const err = e as Error;
    if (err.name === 'AbortError') {
      sendError(res, `Gateway task query timed out (${PROXY_TIMEOUT_MS / 1000}s)`, 504);
    } else {
      sendError(res, `Gateway task query failed: ${err.message}`, 502);
    }
  }
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
