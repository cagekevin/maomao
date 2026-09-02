/**
 * ai/httpUtils — HTTP 请求与错误解析共享工具
 *
 * 提取自 generateImage / generateText 中重复的 `!response.ok → 解析 errorBody → throw` 样板。
 */

/**
 * 解析 fetch 响应的错误信息并抛出。
 *
 * 统一处理 `!response.ok` 场景：优先读取常见 JSON 错误字段，
 * 否则截取原始响应文本（最多 200 字符）追加到默认消息后。
 *
 * @param response  fetch 返回的 Response 对象
 * @param defaultMsg 默认错误消息（应包含状态码，如 `图片生成失败 (404)`）
 * @throws Error — 永远抛出，不会正常返回
 */
export async function parseResponseError(response: Response, defaultMsg: string): Promise<never> {
  const errorBody = await response.text().catch(() => '');
  let errorMsg = defaultMsg;
  try {
    const payload = JSON.parse(errorBody) as unknown;
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const record = payload as Record<string, unknown>;
      const error = record.error;
      if (typeof error === 'string' && error.trim()) {
        errorMsg = error.trim();
      } else if (error && typeof error === 'object' && !Array.isArray(error)) {
        const message = (error as Record<string, unknown>).message;
        if (typeof message === 'string' && message.trim()) errorMsg = message.trim();
      } else if (typeof record.message === 'string' && record.message.trim()) {
        errorMsg = record.message.trim();
      } else if (typeof record.msg === 'string' && record.msg.trim()) {
        errorMsg = record.msg.trim();
      }
    }
  } catch {
    if (errorBody) errorMsg += `: ${errorBody.slice(0, 200)}`;
  }
  if (/\bapi[\s_-]*key\b/i.test(errorMsg)) {
    errorMsg += '（请确认使用模型 API Key，而非账户令牌；若密钥正确，请检查账户权限和积分余额）';
  }
  throw new Error(errorMsg);
}

/**
 * 构建带 Bearer 认证的 JSON 请求头。
 * apiKey 为空时不添加 Authorization 字段（兼容无需鉴权的本地服务）。
 */
export function buildAuthHeaders(apiKey: string, contentType = 'application/json'): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': contentType };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  return headers;
}
