/**
 * lovart_contract — 直连 adapter 的共享类型与请求体契约。
 *
 * Lovart 原生 send 体的字段与 ai-relay 内部命名不一致（projectId ↔ project_id），
 * 这里统一做「字段别名 + 规范化」，避免散落在 client 各处。
 */

import type { AuthConfig, StableRequestOptions } from '../../types.js';

/**
 * 出站传输的窄接口（依赖注入点）。
 *
 * 生产实参 = ai-relay/httpTransport 的 stableRequest；测试注入 fake 即可不打真上游
 * 断言请求体（B 组）。adapter 只认这一个函数签名，不关心具体实现。
 */
export type LovartTransport = (opts: StableRequestOptions) => Promise<{
  response: Response;
  resolvedBaseUrl: string;
}>;

/** 直连入口配置（由 ai-relay/index.ts 的 createRelay 构造并下传）。 */
export interface LovartDirectProfile {
  baseUrl: string;
  /** 必为 hmac 鉴权（accessKey/secretKey）。 */
  auth: AuthConfig;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** 出站传输；缺省用中央 stableRequest。测试注入 fake transport 断言请求体。 */
  transport?: LovartTransport;
  /** 参考图下载用 fetch；缺省全局 fetch。测试注入 fake。 */
  fetchImpl?: typeof fetch;
  /** 轮询间隔（ms）；缺省 lovart_config.POLL_INTERVAL_MS。测试注入小值提速。 */
  pollIntervalMs?: number;
  /** done 后复核等待（ms）；缺省 lovart_config.DONE_RECHECK_MS。测试注入小值提速。 */
  doneRecheckMs?: number;
}

export interface LovartSendInput {
  prompt: string;
  projectId: string;
  /** 已上传到 Lovart CDN 的附件 URL 列表（由 lovart_attachments 解析产出）。 */
  attachments?: string[];
  /** 结构化路选模型：{ prefer_tool_categories: { IMAGE: [...] } }。 */
  toolConfig?: Record<string, unknown>;
}

/**
 * 规范化 send 请求体：内部 projectId → 上游 project_id（字段别名），
 * 并仅在非空时附 attachments / tool_config（metadata 提升）。
 */
export function normalizeLovartSendBody(input: LovartSendInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    prompt: input.prompt,
    project_id: input.projectId,
  };
  if (input.attachments && input.attachments.length > 0) {
    body.attachments = input.attachments;
  }
  if (input.toolConfig) {
    body.tool_config = input.toolConfig;
  }
  return body;
}
