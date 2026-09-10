/**
 * routes/providers — provider 配置型端点（每平台一个 JSON，读/写 config/providers/）。
 *
 * 重建（relay 迁移删掉的旧 CRUD 改为配置型）：
 *   GET  /api/providers                    读 config/providers/*.json × 内置目录合并 → {providers}
 *   PUT  /api/providers                    前端保存整组 → 逐平台 diff 写对应文件
 *   PUT  /api/config/base                  兼容：写「当前生效配置」标记（轻量，仅供基线同步对账）
 *   POST /api/providers/test-connection    委托 ai-relay connection.testConnection
 *   POST /api/providers/probe-async        lovart/apimart 异步嗅探（mock task_id 探异步端点）
 *   POST /api/providers/:id/fetch-models   委托 ai-relay fetchProviderModelCatalog → {image/chat/video_models}
 *
 * 前端 Provider 契约不变（relay 未接前端）；key 不入配置文件（只进 .env，见 providerConfigStore 头注释）。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import { json, parseJsonBody, sendError } from '../utils/helpers.js';
import {
  readAllProviders,
  readProvider,
  writeProviderConfigFile,
  deleteProviderConfigFile,
  seedFromDefaultFile,
  readProviderConfigFile,
} from '../providerConfigStore.js';
import { getEnvFile, getProviderSeedFile } from '../paths.js';
import { getProviderDefinition } from '../ai-relay/index.js';
import { testConnection as relayTestConnection } from '../ai-relay/connection.js';
import { fetchProviderModelCatalog } from '../ai-relay/providerCatalogFetch.js';
import { envKeysFor } from '../ai-relay/providerCredentials.js';

/** 把 ai-relay CatalogModel[] 归类成前端 Provider 的 image/chat/video_models（缺省归 image）。 */
function modelsByCategory(models: Array<{ id: string; name?: string; category?: string }>): {
  image_models: unknown[];
  chat_models: unknown[];
  video_models: unknown[];
} {
  const out = {
    image_models: [] as unknown[],
    chat_models: [] as unknown[],
    video_models: [] as unknown[],
  };
  for (const m of models) {
    const entry = { id: m.id, label: m.name || m.id, streaming: false, promptOnly: false };
    const cat = String(m.category || '');
    if (cat === 'video') out.video_models.push(entry);
    else if (cat === 'text' || cat === 'chat') out.chat_models.push(entry);
    else out.image_models.push(entry);
  }
  return out;
}

/** GET /api/providers —— 读配置型 provider 列表。 */
export async function handleProvidersGet(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  // 首次播种：出厂模板 providers.default.json → config/providers/<id>.json（仅补缺，不覆盖用户配置，幂等）。
  // config/providers/ 是唯一运行态真源；模板只读、播种后即与运行时解耦（无双源漂移）。
  seedFromDefaultFile(getProviderSeedFile());
  return json(res, { code: 0, data: { providers: readAllProviders() } });
}

/** PUT /api/providers —— 前端保存整组，逐平台 diff 写对应文件；删 enabled 且非内置的多余平台文件。 */
export async function handleProvidersPut(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as { providers?: unknown } | null;
  const providers = Array.isArray((body as { providers?: unknown } | null)?.providers)
    ? (body as { providers: unknown[] }).providers
    : Array.isArray(body)
      ? (body as unknown[])
      : null;
  if (!providers) return sendError(res, 'Missing providers array', 400);

  const savedIds = new Set<string>();
  for (const raw of providers) {
    if (!raw || typeof raw !== 'object') continue;
    const p = raw as Record<string, unknown>;
    const id = typeof p.id === 'string' ? p.id : '';
    if (!id) continue;
    savedIds.add(id);
    writeProviderConfigFile(id, p);
  }
  return json(res, { code: 0, data: { ok: true, saved: savedIds.size } });
}

/**
 * 从 .env 读某 provider 的凭证（不入库/不回读明文给前端）。
 *
 * 【修复】此前只猜 `API_PROVIDER_{ID}_KEY`，导致凭证名不同的厂商（lovart 用
 * LOVART_ACCESS_KEY/LOVART_SECRET_KEY）永远读空 → 测试连接恒报「缺少 API Key」。
 * 现在按厂商目录声明的 envKeys 顺序依次查找，首个命中即返回；
 * 未声明的厂商回落统一命名，保持既有行为。
 *
 * 注：process.env 优先（index.ts 启动时 loadDotEnv 注入），文件兜底，
 * 兼容运行期新增凭证未重启的场景。
 */
function readEnvKey(providerId: string): string {
  const def = getProviderDefinition(providerId);
  const names = envKeysFor(providerId, def);
  for (const name of names) {
    const fromProc = (process.env[name] || '').trim();
    if (fromProc) return fromProc;
  }
  try {
    const envPath = getEnvFile();
    if (!fs.existsSync(envPath)) return '';
    const raw = fs.readFileSync(envPath, 'utf-8');
    for (const name of names) {
      const m = raw.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+)$`, 'm'));
      if (m) {
        const value = m[1].replace(/['"]/g, '').trim();
        if (value) return value;
      }
    }
    return '';
  } catch {
    return '';
  }
}

/** POST /api/providers/test-connection —— 委托 ai-relay 连接测试。 */
export async function handleProviderTest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as Record<string, unknown> | null;
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) return sendError(res, 'Missing provider id', 400);
  const baseUrl =
    typeof body?.base_url === 'string' && body.base_url
      ? body.base_url
      : // 纯配置文件厂商（无内置目录定义）→ 用配置文件 base_url 兜底，否则 test-connection 报「未知厂商目录」
        (() => {
          const p = readProviderConfigFile(id);
          return typeof (p as { base_url?: unknown } | null)?.base_url === 'string' &&
            (p as { base_url: string }).base_url.trim()
            ? (p as { base_url: string }).base_url
            : undefined;
        })();
  const apiKey = typeof body?.key === 'string' && body.key ? body.key : readEnvKey(id);
  const r = await relayTestConnection(id, { apiKey: apiKey || undefined, baseUrl }, undefined);
  return json(res, {
    code: 0,
    data: { ok: r.ok, status: r.status, warning: r.warning, resolvedBaseUrl: r.resolvedBaseUrl },
  });
}

/** POST /api/providers/probe-async —— 异步端点嗅探（mock task_id 探 400/404/401 区分）。 */
export async function handleProviderProbeAsync(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = (await parseJsonBody(req)) as Record<string, unknown> | null;
  const id = typeof body?.id === 'string' ? body.id : '';
  const baseUrl = typeof body?.base_url === 'string' && body.base_url ? body.base_url : undefined;
  const apiKey = typeof body?.key === 'string' && body.key ? body.key : readEnvKey(id);
  const def = getProviderDefinition(id);
  const url = baseUrl || def?.defaultBaseUrl || '';
  // 探「提交异步任务」端点是否可用：用假 task_id 命中异步子路径（网关对不存在 task 返 4xx 但端点存在）
  // relay 层用 connection 探测 /models 判定连通；异步能力以 lovart/复现 apimart 为准（保守返回连通=testConnection 结果）。
  if (!url) return sendError(res, 'Provider no base url', 400);
  const r = await relayTestConnection(id, { apiKey: apiKey || undefined, baseUrl: url }, undefined);
  return json(res, { code: 0, data: { ok: r.ok, status: r.status, warning: r.warning } });
}

/** POST /api/providers/:id/fetch-models —— 委托 ai-relay 拉模型 → 前端 image/chat/video_models。 */
export async function handleProviderFetchModels(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const m = url.pathname.match(/^\/api\/providers\/([^/]+)\/fetch-models$/);
  const id = m ? m[1] : '';
  if (!id) return sendError(res, 'Missing provider id', 400);
  const prov = readProvider(id);
  const cfgBaseUrl =
    (prov?.base_url as string | undefined) ||
    ((prov?._relay as Record<string, unknown> | undefined)?.defaultBaseUrl as string | undefined);
  const def = getProviderDefinition(id);
  const fallbackModels = Array.isArray(def?.models) ? def.models : [];
  try {
    const cat = await fetchProviderModelCatalog({
      providerId: id,
      config: { apiKey: readEnvKey(id) || undefined, baseUrl: cfgBaseUrl || undefined },
      fallbackModels,
      signal: undefined,
    });
    const grouped = modelsByCategory(cat.models);
    return json(res, { code: 0, data: { ...grouped, source: cat.source, warning: cat.warning } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json(res, { code: -1, data: { error: msg } });
  }
}
