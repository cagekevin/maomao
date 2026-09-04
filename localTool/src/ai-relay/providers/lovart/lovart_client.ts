/**
 * lovart_client — 忠实 port agent_skill.py 的原语，全部走 httpTransport.stableRequest。
 *
 * 复用的点：HMAC 鉴权头由中央 buildHmacAuthHeaders 在 stableRequest 每次重试内重算；
 * 重试 / 64MB 上限 / 可取消 / 上游文案原样透传全部来自中央，adapter 不自写循环。
 *
 * 信封 {code, message, data} 在此剥离（忠实 port _request 的 result.get('data')）。
 */

import { stableRequest } from '../../httpTransport.js';
import type { AuthConfig } from '../../types.js';
import { LOVART_PATH_PREFIX, LOVART_PROJECT_TYPE } from './lovart_config.js';
import { LovartError, LOVART_ERR_TYPES } from './lovart_errors.js';
import {
  normalizeLovartSendBody,
  type LovartSendInput,
  type LovartTransport,
} from './lovart_contract.js';

export interface LovartClientDeps {
  baseUrl: string;
  auth: AuthConfig;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** 出站传输；缺省用中央 stableRequest。测试注入 fake transport。 */
  transport?: LovartTransport;
  /** 参考图下载用的 fetch；缺省全局 fetch。测试注入 fake 断言下载失败阻断（B8）。 */
  fetchImpl?: typeof fetch;
  /** 轮询间隔（ms）；缺省 lovart_config.POLL_INTERVAL_MS。测试注入小值提速。 */
  pollIntervalMs?: number;
  /** done 后复核等待（ms）；缺省 lovart_config.DONE_RECHECK_MS。测试注入小值提速。 */
  doneRecheckMs?: number;
  /** project 缓存文件路径；缺省 env LOVART_PROJECT_CACHE_FILE / cwd .lovart_project.json。测试注入临时路径。 */
  projectCacheFile?: string;
}

/** 剥 {code,data} 信封并做 code≠0 检。 */
async function parseEnvelope(json: any): Promise<any> {
  if (json && typeof json === 'object' && 'code' in json && json.code !== 0 && json.code !== undefined) {
    // 原样透传上游文案（B13：禁翻译/静默）
    throw new LovartError(String(json.message ?? 'Lovart request failed'), json.code, LOVART_ERR_TYPES.UPSTREAM);
  }
  return json && typeof json === 'object' && 'data' in json && json.data !== undefined ? json.data : json;
}

/** 经注入 transport 发请求并剥信封。 */
async function lovartRequest(
  deps: LovartClientDeps,
  method: 'GET' | 'POST',
  subpath: string,
  body?: unknown,
  query?: Record<string, string | number | boolean | undefined>,
): Promise<any> {
  const transport: LovartTransport = deps.transport ?? stableRequest;
  const { response } = await transport({
    method,
    path: LOVART_PATH_PREFIX + subpath,
    body,
    query,
    baseUrl: deps.baseUrl,
    auth: deps.auth,
    signal: deps.signal,
    timeoutMs: deps.timeoutMs,
  });
  const json = await response.json();
  return parseEnvelope(json);
}

// ── Project ─────────────────────────────────────────────────────────

export async function createLovartProject(deps: LovartClientDeps): Promise<string> {
  const data = await lovartRequest(deps, 'POST', '/project/save', {
    project_id: '',
    canvas: '',
    project_cover_list: [],
    pic_count: 0,
    project_type: LOVART_PROJECT_TYPE,
  });
  return String(data?.project_id ?? '');
}

// ── Mode ─────────────────────────────────────────────────────────────

/** unlimited=false 锁 fast 配额轴（每次 send 前必显式调用，B4）。 */
export async function setLovartMode(deps: LovartClientDeps, unlimited = false): Promise<void> {
  await lovartRequest(deps, 'POST', '/mode/set', { unlimited });
}

// ── Chat (submit) ────────────────────────────────────────────────────

export async function sendLovartChat(deps: LovartClientDeps, input: LovartSendInput): Promise<string> {
  const body = normalizeLovartSendBody(input); // 字段别名 projectId→project_id
  const data = await lovartRequest(deps, 'POST', '/chat', body);
  const threadId = String(data?.thread_id ?? '');
  console.info(`[lovart] chat 已提交，threadId=${threadId}`);
  return threadId;
}

// ── Status / Result / Confirm ───────────────────────────────────────

export async function getLovartStatus(deps: LovartClientDeps, threadId: string): Promise<any> {
  return lovartRequest(deps, 'GET', '/chat/status', undefined, { thread_id: threadId });
}

export async function getLovartResult(deps: LovartClientDeps, threadId: string): Promise<any> {
  return lovartRequest(deps, 'GET', '/chat/result', undefined, { thread_id: threadId });
}

export async function confirmLovartThread(deps: LovartClientDeps, threadId: string): Promise<void> {
  await lovartRequest(deps, 'POST', '/chat/confirm', { thread_id: threadId });
}

// ── Upload (multipart，走中央 stableRequest，BodyInit 透传) ──────────

/** 把字节上传到 Lovart CDN，返回 CDN URL。任一失败抛 LovartError（UPLOAD_FAILED）。 */
export async function uploadLovartFile(
  deps: LovartClientDeps,
  bytes: Uint8Array,
  filename: string,
): Promise<string> {
  const boundary = `----lovartform${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  const head = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  const payload = Buffer.concat([Buffer.from(head, 'utf8'), Buffer.from(bytes), Buffer.from(tail, 'utf8')]);
  const transport: LovartTransport = deps.transport ?? stableRequest;
  const data = await transport({
    method: 'POST',
    path: LOVART_PATH_PREFIX + '/file/upload',
    body: payload, // Uint8Array → 中央 isBodyInit 透传，不 JSON 化
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    baseUrl: deps.baseUrl,
    auth: deps.auth,
    signal: deps.signal,
    timeoutMs: deps.timeoutMs,
  }).then((r) => r.response.json());
  if (data && typeof data === 'object' && 'code' in data && data.code !== 0 && data.code !== undefined) {
    throw new LovartError(String(data.message ?? '上传失败'), data.code, LOVART_ERR_TYPES.UPLOAD_FAILED);
  }
  const out = (data && typeof data === 'object' && 'data' in data ? data.data : data) as any;
  const url = out?.url;
  if (!url) throw new LovartError('上传未返回 CDN URL', -1, LOVART_ERR_TYPES.UPLOAD_FAILED);
  return String(url);
}
