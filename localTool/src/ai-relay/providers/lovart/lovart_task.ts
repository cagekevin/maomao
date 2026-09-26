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
      throw new LovartError(
        '任务需人工确认（pending_confirmation）',
        -1,
        LOVART_ERR_TYPES.PENDING_CONFIRMATION,
      );
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
          throw new LovartError(
            '任务需人工确认（pending_confirmation）',
            -1,
            LOVART_ERR_TYPES.PENDING_CONFIRMATION,
          );
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
    // 对齐 main.py:886——无产物时把 Lovart Agent 返回的原话透传出去，
    // 而不是用固定文案盖掉：「AI 发回什么，我们就显示什么」（Agent 常以此解释拒绝原因/给出修改建议）。
    // 【顺序 · 上游原话优先】① `data.failures[].message`（上游对"为什么没产出"的**明确原因**，
    //   如 `API_CONTENT_POLICY`）→ ② Agent 说明性文本（`items[].text`）→ ③ 兜底句。
    //   ③ 不再替上游断言"可能被内容审核拒绝"（那是猜，不是上游的话）。
    const upstreamReason = extractLovartFailureText(result);
    const agentText = extractLovartAssistantText(result);
    throw new LovartError(
      upstreamReason || agentText || '生成完成但未产出任何素材（上游未给出原因）',
      -1,
      LOVART_ERR_TYPES.NO_ARTIFACT,
    );
  }
  return urls;
}

/**
 * 抽取 Lovart Agent 的说明性文本，对齐 main.py DataFormatter.assistant_text（389-391行）：
 * 收集 items[].text 的非空项，用空行连接。
 * 用途：无产物/异常时把 Agent 原话透给用户，避免固定文案掩盖真实原因。
 */
export function extractLovartAssistantText(result: any): string {
  const items: any[] = result?.items ?? [];
  const texts: string[] = [];
  for (const it of items) {
    const t = String(it?.text ?? '').trim();
    if (t) texts.push(t);
  }
  return texts.join('\n\n');
}

/**
 * 抽取上游**工具失败原因**（`data.failures[].message`）——「上游为什么没产出」的原话就在这里。
 *
 * 【为什么必须有这一口】lovart 的 result 里，**产出在 `items[]`，失败原因在 `data.failures[]`**：
 *   `{"tool":"generate_media","tool_hint":"generate_image_gpt_image_2","code":"TOOL_FAILED",
 *     "message":"API Error (provider:API_CONTENT_POLICY): Content policy violation: …"}`
 * 此前本仓**没有任何一处读它**（`localTool` 内 `failures` 零命中），只有自编兜底句
 * （图片路「可能被内容审核拒绝…」、文本路「未返回文本内容」）⇒ **上游的原话被整包丢掉**，
 * 于是现象被误读成"上游没回复"。
 * 现按「生产者给全 · 上游原话优先」收口为**唯一读取口**：chat / image / video 三条路共用。
 */
export function extractLovartFailureText(result: any): string {
  const failures: any[] = result?.failures ?? [];
  const msgs: string[] = [];
  for (const f of failures) {
    const m = String(f?.message ?? '').trim();
    if (m && !msgs.includes(m)) msgs.push(m);
  }
  return msgs.join('\n');
}

/** 抽取对话文本（chat 用）。 */
export function extractLovartText(result: any): string {
  const items: any[] = result?.items ?? [];
  return items.map((it) => (it?.text ? String(it.text) : '')).join('');
}

/**
 * 上游 result 原文快照（**生产者给全**）：JSON 序列化 + 长度封顶。
 * 用途：失败时把「上游到底回了什么」随错误文案带出，禁止让消费端（前端 relayProxy）
 * 只能转发一句「上游未返回文本内容」而看不到上游真身。
 * 封顶是防超大 payload（items 内可能带 base64 素材）灌进日志与 toast。
 */
export function snapshotLovartResult(result: any, maxLen = 1200): string {
  let s: string;
  try {
    s = JSON.stringify(result) ?? String(result);
  } catch {
    s = String(result); // 循环引用等不可序列化形态：退回 String，不因留痕本身再抛错
  }
  return s.length > maxLen ? `${s.slice(0, maxLen)}…（原文共 ${s.length} 字符，已截断）` : s;
}

/**
 * 抽取对话文本（chat 用）+ **空文本 fail-loud**。
 *
 * 【为什么必须抛】上游状态 `done` 但 items 里没有任何 `text` ⇒ 抽取结果是空串。
 * 此前它被原样 return 成 `text:''` 上传出站，后端 generateEngine 判 `ok:true`，
 * 前端只能转发兜底句「上游未返回文本内容」——**上游真身（result 原文）就此丢失**，
 * 排障只能靠猜（线上 2026-09-26 生成剧本即此形态）。
 * 与 `extractLovartArtifacts` 无产物时的处理同构：**上游给的就原样透出，上游不给才用兜底文案**。
 * 【文案来源 · 上游原话优先】`data.failures[].message`（见 `extractLovartFailureText`）优先于兜底句。
 */
export function extractLovartChatText(result: any): string {
  const text = extractLovartText(result);
  if (text.trim()) return text;
  const raw = snapshotLovartResult(result);
  // 【原文由后端发出 · 唯一一处】本 adapter 是**唯一**能看到上游 `/chat/result` 真身的地方 ⇒
  // 上游原文在此打一次（生产者给全）。日志经 log relay 直达前端控制台，**不经 JSON 二次转义**，肉眼可读。
  // 【文案只给人话】原文**不塞进 message**：一是会随 `data.error` 被前端 logger 的 `JSON.stringify(detail)`
  // 转义成一堆 `\"`（这正是"看不到原文"的成因），二是与上面这条留痕构成同一证据两份。
  // 文案里留一句指针，让只拿到文案的人（toast／消费端日志）知道原文去哪找。
  console.error(`[lovart] chat 已完成但无文本，上游 result 原文：${raw}`);
  // 【文案 = 上游原话优先】上游把"为什么没给正文"写在 `data.failures[].message`（实测：
  // `API Error (provider:API_CONTENT_POLICY): Content policy violation: …`）——**那才是"AI 发回来的话"**；
  // 有它就用它（原样透传，不翻译不重写）；只有上游连原因都没给，才用兜底句 + 指针。
  const upstreamReason = extractLovartFailureText(result);
  throw new LovartError(
    upstreamReason || 'Lovart 未返回文本内容（上游 result 为空，原文见 [lovart] 日志）',
    -1,
    LOVART_ERR_TYPES.UPSTREAM,
  );
}
