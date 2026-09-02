/**
 * relay-route —— /api/relay 同步端点（直接接 kit 门面，不绕壳）
 *
 * 前端只发意图 {providerId, capability, model, prompt, size?, images?} → 本端点
 *  → resolveRelayContext(provider→key/baseUrl/协议 + 参考图归一，见 relay-common)
 *  → 直接调 kit 门面 relay.generate.image/video({connection, model, protocol, prompt, size, imageUrls})
 *  → persistResultUrl 落盘 /files/ → 返回 {code,data}。
 * 端点内无 fetch/轮询/字段抽取/协议拼装（那都是 kit 门面干的）。chat 流式走老 /api/proxy（红线）。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseJsonBody, json } from './utils/helpers.js';
import { resolveRelayContext, getRelay, persistResultUrl } from './relay-common.js';

const ts = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

/** POST /api/relay → { code:0, data:{url?, content?, taskId?} } | { code:-1, data:{error, stage,...} } */
export async function handleRelay(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as Record<string, unknown> | null;

  const ctx = await resolveRelayContext(body);
  if ('error' in ctx) {
    return json(res, { code: -1, data: { error: ctx.error, stage: 'submit', providerId: ctx.providerId, capability: ctx.capability } });
  }
  const { providerId, capability, model, baseUrl, apiKey, protocol, prompt, size, imageUrls } = ctx;

  if (capability === 'chat') {
    return json(res, { code: -1, data: { error: 'chat 流式经 /api/relay 尚未接入(暂走老 /api/proxy)，此调用请用 image/video', stage: 'submit', providerId, capability } });
  }

  try {
    console.log(`[relay] ${ts()} | providerId=${providerId} capability=${capability} model=${model} stage=submit`);

    const relay = getRelay();
    const connection = { apiKey, baseUrl };
    // 直接调 kit 门面，传门面要的语义字段（不是 variables 中转）
    const result = capability === 'video'
      ? await relay.generate.video({ connection, model, protocol, prompt, ...(size ? { size } : {}), ...(imageUrls?.length ? { imageUrls } : {}) })
      : await relay.generate.image({ connection, model, protocol, prompt, ...(size ? { size } : {}), ...(imageUrls?.length ? { imageUrls } : {}) });

    console.log(`[relay] ${ts()} | ${providerId}/${capability} stage=extract status=${result.urls?.length ? 'succeeded' : 'done'} urlCount=${result.urls?.length ?? 0}`);

    const url = await persistResultUrl(result.urls?.[0]);
    return json(res, { code: 0, data: { url, content: result.text, taskId: result.taskId } });
  } catch (e) {
    console.error(`[relay] ${ts()} | ${providerId}/${capability} 失败: ${(e as Error)?.message || String(e)}`);
    return json(res, {
      code: -1,
      data: { error: (e as Error)?.message || '生成失败', stage: 'submit', providerId, capability },
    });
  }
}
