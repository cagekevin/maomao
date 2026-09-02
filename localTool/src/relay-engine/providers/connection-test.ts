/**
 * providers/connection-test — 连接连通性验证。
 *
 * 原则：只打**无生成副作用**的端点（`GET /models`、厂商声明的只读账户端点），
 * 绝不为了「测一下通不通」而提交一次付费生成。
 * 地址按 baseUrlCandidates 依次探测，用户漏填 /v1 时自动补上并回报真实地址。
 */
import { relayFetch } from '../core/transport';
import { baseUrlCandidates } from '../core/base-url';
import type { ConnectionTestResult } from '../contract';
import { getProviderDefinition } from './catalog';

function readErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const record = payload as Record<string, unknown>;
  if (typeof record.message === 'string') return record.message;
  if (typeof record.errorMessage === 'string') return record.errorMessage;
  if (typeof record.error === 'string') return record.error;
  if (record.error && typeof record.error === 'object') {
    const error = record.error as Record<string, unknown>;
    if (typeof error.message === 'string') return error.message;
  }
  return undefined;
}

/** GET /models：只验证目录可达与凭据是否有效，不调用任何模型。 */
async function testModelCatalog(
  apiKey: string,
  baseUrl: string,
  query?: Readonly<Record<string, string>>,
): Promise<ConnectionTestResult> {
  const candidates = baseUrlCandidates(baseUrl);
  if (candidates.length === 0) return { success: false, error: '请先填写接口地址' };

  let failure: ConnectionTestResult = { success: false, error: '接口地址不可达' };
  for (const candidate of candidates) {
    const url = new URL(`${candidate}/models`);
    for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await relayFetch(url.toString(), {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    } catch (error) {
      return { success: false, error: `网络错误: ${error instanceof Error ? error.message : String(error)}` };
    }
    if (response.ok) return { success: true, baseUrl: candidate };

    const payload: unknown = await response.json().catch(() => null);
    const message = readErrorMessage(payload);
    failure = {
      success: false,
      error: message ? `HTTP ${response.status}: ${message}` : `HTTP ${response.status}`,
    };
    // 凭据本身不对时换地址也没用，直接把错误交回去
    if (response.status === 401 || response.status === 403) return failure;
  }
  return failure;
}

/** 厂商声明了只读账户端点时，用它验证并顺带读回余额。 */
async function testReadOnlyEndpoint(
  apiKey: string,
  baseUrl: string,
  path: string,
  query: Readonly<Record<string, string>> = {},
): Promise<ConnectionTestResult> {
  const candidate = baseUrlCandidates(baseUrl)[0];
  if (!candidate) return { success: false, error: '请先填写接口地址' };
  const url = new URL(path, `${candidate}/`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

  let response: Response;
  try {
    response = await relayFetch(url.toString(), {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch (error) {
    return { success: false, error: `网络错误: ${error instanceof Error ? error.message : String(error)}` };
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = readErrorMessage(payload);
    return {
      success: false,
      error: message ? `HTTP ${response.status}: ${message}` : `HTTP ${response.status}`,
    };
  }
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const balanceValue = record.balance;
  const currency = typeof record.currency === 'string' ? record.currency.trim() : '';
  const balance = (typeof balanceValue === 'number' || typeof balanceValue === 'string')
    ? `${balanceValue}${currency ? ` ${currency}` : ''}`
    : undefined;
  return { success: true, balance, baseUrl: candidate };
}

/**
 * 验证一条连接是否可用。
 * 未在厂商定义里登记特例的 api-key 厂商，统一按 OpenAI 兼容的 /models 端点验证；
 * 新增厂商不必回来登记一行。
 */
export async function testConnection(input: {
  providerId?: string;
  apiKey: string;
  baseUrl?: string;
}): Promise<ConnectionTestResult> {
  const { providerId, apiKey } = input;
  if (!apiKey) return { success: false, error: '请先填写 API 密钥' };

  const definition = providerId ? getProviderDefinition(providerId) : undefined;
  if (definition?.authType === 'oauth') {
    return { success: false, unsupported: true, error: `${definition.name} 使用 OAuth 登录，无需验证密钥` };
  }
  const target = input.baseUrl?.trim() || definition?.defaultBaseUrl;
  if (!target) {
    return { success: false, error: providerId ? `未知厂商: ${providerId}` : '请先填写接口地址' };
  }
  if (definition?.connectionTestPath) {
    return testReadOnlyEndpoint(
      apiKey,
      target,
      definition.connectionTestPath,
      definition.requestQuery,
    );
  }
  return testModelCatalog(apiKey, target, definition?.requestQuery);
}
