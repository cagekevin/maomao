/**
 * relay-route —— /api/relay 薄端点（前端只发意图，localTool 独占平台协议知识）
 *
 * 【目标态】前端只发 {providerId, capability, model, prompt} → 本端点 → kit executeModelProtocol
 *  吃协议声明(presets)驱动提交/轮询/取结果 → 返回 {code,data} 信封。加平台=加声明，前端零感知。
 *
 * 【本文件职责】只做"薄"：入参解析 → provider/key 注入 → 参考图归一 → kit 驱动 → 信封回包。
 *  不拼 URL、不写请求体、不做协议逻辑（那是 kit + presets 声明）。
 *
 * 【当前范围】image/video 非流式（executeModelProtocol 读完整 JSON）。chat 流式(pipeSseToResponse)
 *  后续按 execution-plan §4.3 补（kit submitModelProtocol 拿流自行 SSE）。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readProviderKey, getProvider } from './routes/providers.js';
import { resolveLocalImages } from './utils/resolveLocalImages.js';
import { parseJsonBody, sendError, json } from './utils/helpers.js';
import { saveRemoteUrl } from './routes/files.js';
import { executeModelProtocol } from './relay-engine/protocol/executor.js';
import type { ModelProtocolVariables } from './relay-engine/protocol/contract.js';
import type { ProtocolJsonValue } from './relay-engine/types/protocol.js';
import { presets } from './relay-presets.js';

const ts = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
/** 文件名时间戳(对齐前端 formatTime mode:file → YYYYMMDD_HHMMSS)，用于生成结果命名 */
function fileStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * POST /api/relay
 * body: { providerId, capability, model, prompt, size?, images?, taskId?, stream? }
 * 返回非流式: { code:0, data:{ url?, content?, taskId? } } | { code:-1, data:{error, stage, providerId, capability} }
 */
export async function handleRelay(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as Record<string, unknown> | null;
  const providerId = typeof body?.providerId === 'string' ? body.providerId : '';
  const capability = typeof body?.capability === 'string' ? body.capability : '';
  const model = typeof body?.model === 'string' ? body.model : '';
  const prompt = typeof body?.prompt === 'string' ? body.prompt : '';

  const provider = getProvider(providerId);
  if (!provider) return sendError(res, `Provider not found: ${providerId}`, 404);

  // 协议声明：capability → { providerId: protocol, default }。拿不到 → 配置错
  const protocol = presets[capability]?.[providerId] || presets[capability]?.['default'];
  if (!protocol) return sendError(res, `No protocol for capability=${capability}`, 400);

  // 【C 步范围】image/video 非流式。chat 流式(stream:true)后续补(pipeSseToResponse)。
  if (capability === 'chat') {
    return sendError(res, 'chat 流式经 /api/relay 尚未接入(暂走老 /api/proxy)，此调用请用 image/video', 501);
  }

  try {
    // 参考图归一：resolveLocalImages 深度递归把 body 里所有本机 /files/ URL 内联成 data: base64
    // (data: 幂等透传)。复用现有后端实现(架构红线：唯一出站口)，禁止另写一套。见 execution-plan §3.5.4。
    const resolved = (await resolveLocalImages(body)) as Record<string, unknown> | null;

    const apiKey = readProviderKey(providerId);
    // 协议变量：从归一后的 body 平坦映射(providerId/capability/stream/taskId 等端点字段不喂 kit)。
    // body 来自 parseJsonBody(JSON 解析)，值本就 JSON 安全(可 JSON 序列化)，故收敛到 kit ProtocolJsonValue。
    // images(参考图, resolveLocalImages 已把 /files/ 内联成 base64) 归一成 kit 的 imageUrls 变量
    // (relay-engine variables.ts 用 imageurls 匹配 9004 的 image_urls 字段)。
    const variables: ModelProtocolVariables = {};
    for (const [k, v] of Object.entries(resolved ?? {})) {
      if (['providerId', 'capability', 'stream', 'taskId'].includes(k)) continue;
      if (v === undefined) continue;
      variables[k === 'images' ? 'imageUrls' : k] = v as ProtocolJsonValue;
    }

    console.log(`[relay] ${ts()} | providerId=${providerId} capability=${capability} model=${model} stage=submit`);

    const result = await executeModelProtocol({
      apiKey,
      baseUrl: provider.base_url,
      protocol,
      variables,
    });
    // result: { urls?, text?, taskId? }
    console.log(`[relay] ${ts()} | ${providerId}/${capability} stage=extract status=${result.urls?.length ? 'succeeded' : 'done'} urlCount=${result.urls?.length ?? 0}`);
    // 结果落盘：把上游返回的 url 落成 /files/ 持久 URL(localTool 独占下载归属 saveRemoteUrl，S1 已加并发锁)。
    // 对齐既有生成结果落盘规范(前端 saveResultToTasks 同款)：落 uploads/tasks 目录 + 文件名
    // `generated_<YYYYMMDD_HHMMSS>`(sha1 前缀由 saveRemoteUrl 加 → `<sha1>_generated_<stamp>.<ext>`)，
    // 与存量生成结果命名一致，能被 rescan/生成面板按 tasks 目录 + 扩展名识别。
    // 落盘失败回退原 url(宁显示外链不丢)；前端拿到的直接是 /files/ 持久地址，刷新不丢图。
    const rawUrl = result.urls?.[0];
    let url = rawUrl;
    if (typeof rawUrl === 'string' && rawUrl && !rawUrl.includes('/files/')) {
      try {
        const persisted = await saveRemoteUrl('tasks', rawUrl, `generated_${fileStamp()}`);
        if (persisted?.url) url = persisted.url;
      } catch (e) {
        console.error(`[relay] ${ts()} | 落盘失败回退: ${(e as Error)?.message}`);
      }
    }
    return json(res, {
      code: 0,
      data: {
        url,
        content: result.text,
        taskId: result.taskId,
      },
    });
  } catch (e) {
    // 失败可见：错误原样透传(带 stage 定位)，不压成"生成失败"。console.error 供后端日志排查。
    console.error(`[relay] ${ts()} | ${providerId}/${capability} 失败: ${(e as Error)?.message || String(e)}`);
    return json(res, {
      code: -1,
      data: { error: (e as Error)?.message || '生成失败', stage: 'submit', providerId, capability },
    });
  }
}
