/**
 * 连接测试 —— 验证某个中转是否「连得通」。
 * 从 AI-Canvas-tauri 的连接验证逻辑搬出：优先用厂商自带 connectionTestPath，
 * 否则对 openai-compatible 供应商探测 /models，本地清单供应商按凭据存在判定。
 */
import { baseUrlCandidates } from './providerBaseUrl.js';
import { getProviderDefinition } from './providerCatalog.js';
import { stableRequest, RelayHttpError } from './httpTransport.js';
import type { ConnectionTestResult, ProviderDefinition } from './types.js';

type ConnectionConfig = { apiKey?: string; baseUrl?: string; catalogId?: string };

function connectionError(err: unknown): { status: number; warning: string } {
  const status = err instanceof RelayHttpError ? err.status : 0;
  const warning = err instanceof Error ? err.message : String(err);
  return { status, warning };
}

export async function testConnection(providerId: string, config: ConnectionConfig, signal?: AbortSignal): Promise<ConnectionTestResult> {
  const definition: ProviderDefinition | undefined = getProviderDefinition(providerId, config);
  const baseUrl = config.baseUrl || definition?.defaultBaseUrl || '';
  // 纯配置文件厂商（无内置目录定义，如魔搭 modelscope）但有显式 base_url：
  // 按通用 openai-compatible 探测 /models，不再笼统报「未知厂商目录」。
  if (!definition) {
    if (!baseUrl) return { ok: false, status: 0, warning: '未知厂商目录（未配置接口地址）' };
    try {
      const { response, resolvedBaseUrl } = await stableRequest({
        method: 'GET', path: '/models', baseUrl,
        candidates: baseUrlCandidates(baseUrl), apiKey: config.apiKey, signal, maxRetries: 1,
      });
      return { ok: response.status < 400, status: response.status, resolvedBaseUrl };
    } catch (err) {
      const { status, warning } = connectionError(err);
      return { ok: false, status, warning };
    }
  }

  // 1. 厂商自带连通探测路径（如 Sora2U 的 /api/v1/credits）
  if (definition.connectionTestPath) {
    try {
      const { response, resolvedBaseUrl } = await stableRequest({
        method: 'GET',
        path: definition.connectionTestPath,
        baseUrl,
        candidates: baseUrlCandidates(baseUrl),
        apiKey: config.apiKey,
        signal,
        requestQuery: definition.requestQuery,
        maxRetries: 1,
      });
      return { ok: response.status < 400, status: response.status, resolvedBaseUrl };
    } catch (err) {
      const { status, warning } = connectionError(err);
      return { ok: false, status, warning };
    }
  }

  // 2. openai-compatible 供应商：探测 /models
  if (definition.catalogAdapter === 'openai-compatible') {
    try {
      const { response, resolvedBaseUrl } = await stableRequest({
        method: 'GET',
        path: definition.modelsPath || '/models',
        baseUrl,
        candidates: baseUrlCandidates(baseUrl),
        apiKey: config.apiKey,
        signal,
        requestQuery: definition.requestQuery,
        maxRetries: 1,
      });
      return { ok: response.status < 400, status: response.status, resolvedBaseUrl };
    } catch (err) {
      const { status, warning } = connectionError(err);
      return { ok: false, status, warning };
    }
  }

  // 3. 本地清单 / 联网搜索类：无标准探测端点，按凭据存在判定
  const hasKey = Boolean(config.apiKey && config.apiKey.trim());
  if (!hasKey && definition.authType === 'api-key') {
    return { ok: false, status: 0, warning: '缺少 API Key，无法建立连接' };
  }
  return { ok: true, status: 0, warning: '本地清单供应商无标准连通探测，已按凭据存在判定' };
}

/* ================================================================== */
/* 余额查询 —— 最小原型（MINIMAL PROTOTYPE）                          */
/*                                                                    */
/* 审计发现：从 AI-Canvas-tauri/testConnection.ts 搬连接测试时，原仓库 */
/* 的「余额查询」分支未一并搬入（ai-relay 的 testConnection 只验证    */
/* 「连得通」，ConnectionTestResult 原本不含余额）。本原型先把        */
/* RunningHUB 的真实余额端点接上，其余厂商留占位，后期再补全。        */
/*                                                                    */
/* 原仓库 testConnection.ts 映射：                                     */
/*   - testRunninghubModel()  → 下方 runninghub-model 分支            */
/*   - testReadOnlyEndpoint() → 下方「通用只读端点」骨架              */
/*        （sora2u /api/v1/credits 等，响应含 {balance, currency}）   */
/*   - testGRSAI()            → 返回 unsupported 占位                 */
/*   - testWebSearch()        → 依赖 Tauri invoke，Node 侧无意义，暂不实现 */
/*                                                                    */
/* 后期补全 TODO：                                                     */
/*   1. openai-compatible 厂商：用 connectionTestPath 探测，解析      */
/*      {balance, currency}（如 sora2u /api/v1/credits）。             */
/*   2. 把余额端点声明搬进 ProviderDefinition（catalog 驱动），       */
/*      去掉本文件对 runninghub 端点的硬编码。                        */
/*   3. GRSAI unsupported、web-search 探测（桌面环境）各自补齐。      */
/*   4. 在 testConnection 通过时合并 fetchBalance 结果到 result.balance */
/*      （目前本函数独立暴露，供调用方按需取用）。                    */
/* ================================================================== */

export interface BalanceResult {
  /** 余额文本，如 "1100 积分" 或 "58.20 USD"；查询不到时为 undefined */
  balance?: string;
  /** 该厂商原型阶段暂未实现余额查询 */
  unsupported?: boolean;
  /** 查询失败原因 */
  error?: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 从常见错误响应形态里抽 message（搬自原仓库 testConnection.readErrorMessage） */
function readErrorMessage(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  if (typeof payload.message === 'string') return payload.message;
  if (typeof payload.errorMessage === 'string') return payload.errorMessage;
  if (typeof payload.error === 'string') return payload.error;
  if (isRecord(payload.error) && typeof payload.error.message === 'string') return payload.error.message;
  return undefined;
}

/**
 * 查询某厂商余额 —— 最小原型。
 * 目前仅 runninghub-model 有真实实现，其余返回 unsupported 占位。
 */
export async function fetchBalance(
  providerId: string,
  config: ConnectionConfig,
  signal?: AbortSignal,
): Promise<BalanceResult> {
  // TODO(prototype): 后期改为遍历 catalog 里带 balanceQuery 声明的厂商，去掉此处的 id 硬编码。
  if (providerId === 'runninghub-model') {
    return fetchRunninghubBalance(config.apiKey, signal);
  }
  // 原型阶段其余厂商未实现；调用方可据 unsupported 决定不展示余额。
  return { unsupported: true, error: `原型阶段暂未实现 ${providerId} 的余额查询` };
}

/** RunningHUB 独立余额端点（原仓库 testRunninghubModel）。 */
async function fetchRunninghubBalance(apiKey: string | undefined, signal?: AbortSignal): Promise<BalanceResult> {
  if (!apiKey) return { error: '缺少 API Key，无法查询余额' };
  try {
    const res = await stableRequest({
      method: 'POST',
      // 注意：余额端点与 RUNNINGHUB_MODEL_BASE_URL(/openapi/v2) 不同，是独立地址。
      // TODO(prototype): 搬到 catalog 的 provider 声明（如 balancePath 字段）。
      baseUrl: 'https://www.runninghub.cn/uc/openapi/accountStatus',
      // 余额接口用 body 里的 apikey 鉴权，不走 Authorization 头。
      apiKey: undefined,
      body: { apikey: apiKey },
      headers: { 'Content-Type': 'application/json' },
      signal,
      maxRetries: 1,
    });
    const data: unknown = await res.response.json().catch(() => null);
    if (!res.response.ok) {
      const msg = readErrorMessage(data);
      return { error: msg ? `HTTP ${res.response.status}: ${msg}` : `HTTP ${res.response.status}` };
    }
    const record = isRecord(data) ? data : {};
    if (record.code !== 0) {
      return { error: typeof record.msg === 'string' ? record.msg : `code=${String(record.code)}` };
    }
    const d = isRecord(record.data) ? record.data : {};
    const parts: string[] = [];
    if (typeof d.remainCoins === 'number') parts.push(`${d.remainCoins} 积分`);
    if (typeof d.currentTaskCounts === 'number' && d.currentTaskCounts !== 0) {
      parts.push(`${d.currentTaskCounts} 任务运行中`);
    }
    return { balance: parts.join('，') || undefined };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
