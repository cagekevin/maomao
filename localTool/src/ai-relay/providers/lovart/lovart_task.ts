/**
 * lovart_task — 轮询状态机 + task_view 整形 + 总超时 + AUTO_CONFIRM。
 *
 * 状态机（§1.3）：done → 取 result；pending_confirmation → 自动 confirm 后继续；abort → 失败；超时 → 失败。
 * done 后做 5s 复核（防护 video 子任务误判 done）。
 */

import {
  getLovartStatus,
  getLovartResult,
  confirmLovartThread,
  type LovartClientDeps,
} from './lovart_client.js';
import {
  LOVART_POLL_INTERVAL_MS,
  LOVART_DONE_RECHECK_MS,
  LOVART_AUTO_CONFIRM,
  LOVART_DEFAULT_TIMEOUT_MS,
} from './lovart_config.js';
import { LovartError, LOVART_ERR_TYPES } from './lovart_errors.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 轮询直到终态；返回 result（已含 items）。AUTO_CONFIRM 默认开（B10）。 */
export async function pollLovartThread(deps: LovartClientDeps, threadId: string): Promise<any> {
  const deadline = Date.now() + (deps.timeoutMs ?? LOVART_DEFAULT_TIMEOUT_MS);
  while (Date.now() < deadline) {
    const status = await getLovartStatus(deps, threadId);
    const st = String(status?.status ?? 'running');

    if (st === 'abort') {
      throw new LovartError('Lovart 任务被中止', -1, LOVART_ERR_TYPES.ABORT);
    }
    if (st === 'pending_confirmation') {
      if (LOVART_AUTO_CONFIRM) {
        await confirmLovartThread(deps, threadId);
        continue;
      }
      throw new LovartError('任务需人工确认（pending_confirmation）', -1, LOVART_ERR_TYPES.PENDING_CONFIRMATION);
    }
    if (st === 'done') {
      // 复核，防子 agent 未起跑误判 done（延迟可注入，生产 5s / 测试 0）
      await sleep(deps.doneRecheckMs ?? LOVART_DONE_RECHECK_MS);
      const s2 = await getLovartStatus(deps, threadId);
      const s2st = String(s2?.status ?? 'running');
      if (s2st === 'done' || s2st === 'abort') {
        const result = await getLovartResult(deps, threadId);
        if (result?.pending_confirmation) {
          if (LOVART_AUTO_CONFIRM) {
            await confirmLovartThread(deps, threadId);
            continue;
          }
          throw new LovartError('任务需人工确认（pending_confirmation）', -1, LOVART_ERR_TYPES.PENDING_CONFIRMATION);
        }
        return result;
      }
      // 子 agent 仍在跑，继续轮询
    }
    await sleep(deps.pollIntervalMs ?? LOVART_POLL_INTERVAL_MS);
  }
  throw new LovartError('Lovart 任务轮询超时', -1, LOVART_ERR_TYPES.TIMEOUT);
}

/** 抽取产物 URL 列表（多 artifacts 归一并去重）；无产物抛 no_artifact（B11）。 */
export function extractLovartArtifacts(result: any): string[] {
  const items: any[] = result?.items ?? [];
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const arts: any[] = item?.artifacts ?? [];
    for (const a of arts) {
      const content = a?.content;
      if (content && !seen.has(content)) {
        seen.add(content);
        urls.push(String(content));
      }
    }
  }
  if (urls.length === 0) {
    throw new LovartError('任务完成但未生成任何产物（模型可能拒绝或超时）', -1, LOVART_ERR_TYPES.NO_ARTIFACT);
  }
  return urls;
}

/** 抽取对话文本（chat 用）。 */
export function extractLovartText(result: any): string {
  const items: any[] = result?.items ?? [];
  return items.map((it) => (it?.text ? String(it.text) : '')).join('');
}
