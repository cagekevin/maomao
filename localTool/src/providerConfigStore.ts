/**
 * providerConfigStore — provider 配置型存储（一个平台一个 JSON 文件）+ 出站解析唯一实现。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么存在】relay 迁移删掉了旧 /api/providers 的动态多连接 CRUD（providers.json 单文件，历史残留）。
 * 按架构师理解改为「配置型」：每个平台一个 JSON 文件（localTool/config/providers/<id>.json），
 * 文件存「前端 Provider 契约字段 + 可选 relay 连接元数据」。本模块是 provider 配置的唯一读写入口
 * （禁散落 fs 读写）。
 *
 * 【职责扩展（2026-09-11 收口）】在「配置读写」基础上，本模块同时是「出站解析」的唯一实现：
 *  - resolveProviderBaseUrl / readConfiguredBaseUrl：出站地址解析（收口自 generateEngine/relay-poll/providers 双份+三份）；
 *  - resolveProviderApiKey：出站 key 解析（收口，命名规则委托 providerCredentials.envKeysFor）；
 *  - buildLovartDirectProfile：lovart 原生直连 HMAC profile 构造（收口自 generateEngine 内联 + relay-poll）。
 * 选择归此的原因：这些解析都从「provider 配置文件 + 内置目录 + .env」取数，与配置读写同域；
 * 且需要同时访问 ai-relay（目录）与 utils（netProxy/代理），放 src 根层本模块可满足而不破坏
 * ai-relay 的独立性（ai-relay 是可独立运行的 Node 模块，不宜反向依赖 localTool utils）。
 *
 * 【真源（唯二，职责不重叠）】
 *  - 运行态真源：<数据目录>/providers/<id>.json = 用户可见可改的 Provider（模型清单/协议/模式/base_url）。
 *  - 出厂模板：localTool/providers.default.json = 只读种子，仅在「该平台尚无文件」时播种（seedFromDefaultFile）。
 *    播种后模板不再参与运行时；用户保存永不回写模板 → 无「初始化 JSON vs 运行态 JSON」双源漂移。
 *    （历史名 api.config.json 曾扮演种子，但因「只迁移一次 + 不覆盖写」而沦为僵尸副本，已退役。）
 *  - ai-relay BUILT_IN_PROVIDER_DEFINITIONS = 出厂平台候选 + 测连/拉模型的默认连接元数据（只读，不落盘）。
 *  - 读时合并：文件字段优先；缺的 relay 元数据用内置定义补；只有内置定义无文件 → 生成最小 Provider（enabled=false）。
 *  - key 不入配置文件：只进 .env（统一命名 `API_PROVIDER_{ID}_KEY`；凭证名特殊的厂商
 *    如 lovart 按 ai-relay 目录的 `envKeys` 声明读取，见 providerCredentials.ts）。
 * ════════════════════════════════════════════════════════════════
 */

import fs from 'node:fs';
import path from 'node:path';
import { getDataDir } from './db/database.js';
import { getProviderDefinitions, getProviderDefinition } from './ai-relay/index.js';
import { readEnvValues } from './ai-relay/providerCredentials.js';
import { stableRequest } from './ai-relay/httpTransport.js';
import { LOVART_DIRECT_BASE_URL } from './ai-relay/providerEndpoints.js';
import { fetchWithProxy } from './utils/netProxy.js';
import type { ProviderDefinition } from './ai-relay/types.js';
import type { AuthConfig } from './ai-relay/types.js';
import type {
  LovartDirectProfile,
  LovartTransport,
} from './ai-relay/providers/lovart/lovart_contract.js';

/** config/providers/ 目录（建在数据目录下，与 uploads 平级，避免被清） */
function getProviderConfigDir(): string {
  return path.join(getDataDir(), 'providers');
}

/** 平台配置文件路径：config/providers/<id>.json */
function providerFilePath(id: string): string {
  return path.join(getProviderConfigDir(), `${id}.json`);
}

/** 平台「配置文件」里存的前端 Provider 契约字段白名单（能落盘/回读的字段） */
const PERSIST_FIELDS = new Set([
  'id',
  'name',
  'base_url',
  'protocol',
  'image_request_mode',
  'image_mode',
  'chat_request_mode',
  'enabled',
  'primary',
  'readonly',
  'image_models',
  'chat_models',
  'video_models',
  'model_names',
  'model_protocols',
]);

/** 读取某平台配置文件（不存在返回 null）。 */
export function readProviderConfigFile(id: string): Record<string, unknown> | null {
  try {
    const p = providerFilePath(id);
    if (!fs.existsSync(p)) return null;
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>;
    return raw && typeof raw === 'object' ? raw : null;
  } catch {
    return null;
  }
}

/** 列出已落盘的所有平台配置文件（按 id）。 */
export function listProviderConfigFiles(): string[] {
  try {
    const dir = getProviderConfigDir();
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''));
  } catch {
    return [];
  }
}

/**
 * 把某个 Provider（前端形状）合并进该平台配置并落盘。
 * 仅持久化 PERSIST_FIELDS 白名单 + 任意 `_relay` 元数据（key 一律不入盘）。
 * @returns 是否写入成功
 */
export function writeProviderConfigFile(id: string, provider: Record<string, unknown>): boolean {
  const existing = readProviderConfigFile(id) || {};
  const next: Record<string, unknown> = {};
  for (const k of Object.keys(existing)) {
    if (k === '_relay') continue; // 重新由入参给定，不累积旧 relay 元数据
    if (PERSIST_FIELDS.has(k)) next[k] = existing[k];
  }
  for (const k of Object.keys(provider)) {
    if (k === '_relay' || k === 'api_key' || k === '_apiKey' || k === '_clearKey') continue; // key 不入盘
    if (PERSIST_FIELDS.has(k) || k === '_relay') next[k] = provider[k];
  }
  if (provider._relay && typeof provider._relay === 'object') {
    next._relay = provider._relay;
  }
  try {
    const dir = getProviderConfigDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(providerFilePath(id), JSON.stringify(next, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

/** 删除某平台配置文件（移除自定义/禁用出厂之外的连接）。 */
export function deleteProviderConfigFile(id: string): boolean {
  try {
    const p = providerFilePath(id);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * 读某平台配置文件里的 base_url（无则返回 undefined）。
 * 共享片段（2026-09-11 收口）：出站 resolveProviderBaseUrl 与 providers 路由
 * （handleProviderTest 测连兜底）此前各内联一份「readProviderConfigFile(id).base_url 判 string+trim」，
 * 现统一经本函数读取，禁止再内联第三份。
 */
export function readConfiguredBaseUrl(providerId: string): string | undefined {
  const file = readProviderConfigFile(providerId);
  return typeof (file as { base_url?: unknown } | null)?.base_url === 'string' &&
    (file as { base_url: string }).base_url!.trim()
    ? (file as { base_url: string }).base_url
    : undefined;
}

/**
 * 解析某平台出站 baseUrl（唯一实现，2026-09-11 从 generateEngine.ts / relay-poll.ts 双份收口）。
 * 优先级：显式覆盖 → 用户配置文件 base_url（modelscope 等内置无 defaultBaseUrl 的厂商靠它）
 * → 内置目录 defaultBaseUrl。无则抛「未配置接口地址」（不静默空串出站）。
 */
export function resolveProviderBaseUrl(providerId: string, override?: string): string {
  if (override && override.trim()) return override.trim().replace(/\/+$/, '');
  const fileBase = readConfiguredBaseUrl(providerId);
  if (fileBase) return fileBase.replace(/\/+$/, '');
  const def = getProviderDefinition(providerId);
  const baseUrl = (def?.defaultBaseUrl || '').replace(/\/+$/, '');
  if (!baseUrl) throw new Error(`Provider ${providerId} 未配置接口地址`);
  return baseUrl;
}

/**
 * 解析某平台出站 apiKey（唯一实现，2026-09-11 收口）。
 * 规则唯一源 = providerCredentials.envKeysFor（厂商声明 envKeys 优先，未声明回落统一命名
 * `API_PROVIDER_{ID}_KEY`），process.env 只读（localTool 启动 loadDotEnv 注入）。
 * 显式覆盖优先（`??` 保留空串语义，对齐原 generateEngine）；relay-poll 不传 override 行为不变。
 * 注意：lovart 等声明式凭证厂商经 buildLovartDirectProfile 读 LOVART_*，不经本函数。
 */
export function resolveProviderApiKey(providerId: string, override?: string): string {
  if (override !== undefined && override !== null) return override;
  const def = getProviderDefinition(providerId);
  return readEnvValues(providerId, def)[0] || '';
}

/**
 * 构造 lovart 原生直连的 HMAC profile（唯一实现，2026-09-11 收口自 generateEngine 内联
 * 构造 + relay-poll 的 lovartDirectProfile，两处此前各自重复「读 LOVART_* 凭证 + hmac +
 * 代理 transport」）。凭证真源 = localTool/.env（index.ts loadDotEnv 注入）；仅驻内存不入库。
 * transport = stableRequest + fetchWithProxy（lovart.ai 域名必须经代理，见 netProxy.ts）。
 */
export function buildLovartDirectProfile(
  baseUrl: string,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): LovartDirectProfile {
  const accessKey = process.env.LOVART_ACCESS_KEY || '';
  const secretKey = process.env.LOVART_SECRET_KEY || '';
  if (!accessKey || !secretKey) {
    throw new Error(
      'lovart 需要 LOVART_ACCESS_KEY 与 LOVART_SECRET_KEY（请在 localTool/.env 配置）',
    );
  }
  const auth: AuthConfig = { type: 'hmac', accessKey, secretKey };
  const transport: LovartTransport = (o) =>
    stableRequest({ ...o, fetchImpl: fetchWithProxy as typeof fetch });
  return {
    baseUrl: baseUrl || LOVART_DIRECT_BASE_URL,
    auth,
    timeoutMs: opts.timeoutMs,
    signal: opts.signal,
    transport,
  };
}

/** 把内置 ProviderDefinition 转成「最小前端 Provider」兜底（无配置文件时的出厂默认）。 */
function definitionToProvider(def: ProviderDefinition): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: def.id,
    name: def.name,
    base_url: def.defaultBaseUrl || '',
    protocol: def.authType === 'oauth' ? 'oauth' : 'openai',
    image_request_mode: 'openai',
    image_mode: 'async', // relay 生成默认异步（生图）
    chat_request_mode: 'chat',
    enabled: false,
    primary: false,
    readonly: def.id === 'lovart' || !!def.kind, // 内置生成平台默认只读配置；web-search 视为 readonly
    image_models: [],
    chat_models: [],
    video_models: [],
  };
  // local-manifest 平台：把内置 models 归类到 image/chat/video
  const models = Array.isArray(def.models) ? def.models : [];
  const img: Array<Record<string, string>> = [];
  const chat: Array<Record<string, string>> = [];
  const vid: Array<Record<string, string>> = [];
  for (const m of models) {
    const cat = String(m.category || '');
    const entry = { id: m.id, label: m.name || m.id };
    if (cat === 'video') vid.push(entry);
    else if (cat === 'text' || cat === 'chat') chat.push(entry);
    else img.push(entry);
  }
  if (img.length) base.image_models = img;
  if (chat.length) base.chat_models = chat;
  if (vid.length) base.video_models = vid;
  return base;
}

/**
 * 读全量 providers（GET /api/providers 的数据源）：
 * 合并顺序 = 出厂内置目录 ∪ 已落盘配置文件；每平台取「文件字段优先 + 内置补 relay 元数据」。
 * 返回数组即为前端 providerStore.getProviders 期望的 providers。
 */
export function readAllProviders(): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  const builtins = getProviderDefinitions() || [];

  const merge = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const file = readProviderConfigFile(id);
    const def = getProviderDefinition(id);
    const base = file && typeof file === 'object' ? file : def ? definitionToProvider(def) : null;
    if (!base) return;
    // 用内置定义补 relay 连接元数据（仅当文件缺或为出厂兜底）
    if (def) {
      const relayMeta: Record<string, unknown> = {
        authType: def.authType,
        catalogAdapter: def.catalogAdapter,
        defaultBaseUrl: def.defaultBaseUrl || '',
        allowCustomBaseUrl: !!def.allowCustomBaseUrl,
      };
      if (def.modelsPath) relayMeta.modelsPath = def.modelsPath;
      if (def.connectionTestPath) relayMeta.connectionTestPath = def.connectionTestPath;
      const fileRelay = (file?._relay as Record<string, unknown> | undefined) || {};
      (base as Record<string, unknown>)._relay = { ...relayMeta, ...fileRelay };
    }
    out.push(base);
  };

  // 1) 先取所有内置平台（保证出厂候选齐全）
  for (const def of builtins) merge(def.id);
  // 2) 再取仅存在于配置文件的额外平台（自定义）
  for (const id of listProviderConfigFiles()) merge(id);
  return out;
}

/** 单平台读取（用于 PUT 单写 / fetch-models 定位）。 */
export function readProvider(id: string): Record<string, unknown> | null {
  const all = readAllProviders();
  return all.find((p) => p.id === id) || null;
}

/**
 * 首次播种：把出厂模板 providers.default.json 逐平台拆成 config/providers/<id>.json。
 *
 * 【语义（单一真源）】仅当「该平台尚无自己的配置文件」时播种，已存在的平台一律跳过——
 * 即用户配置永不被出厂模板覆盖。幂等：重复调用不产生副作用。
 * 【历史】原名 migrateFromApiConfigFile（迁移 api.config.json）；api.config.json 已退役为
 * providers.default.json，语义从「一次性整体迁移」收窄为「缺失才播种」，消除双源漂移。
 */
export function seedFromDefaultFile(defaultPath: string): number {
  let written = 0;
  try {
    if (!fs.existsSync(defaultPath)) return 0;
    const raw = JSON.parse(fs.readFileSync(defaultPath, 'utf-8')) as { providers?: unknown[] };
    const providers = Array.isArray(raw.providers) ? raw.providers : [];
    for (const p of providers) {
      if (!p || typeof p !== 'object') continue;
      const prov = p as Record<string, unknown>;
      const id = typeof prov.id === 'string' ? prov.id : '';
      if (!id) continue;
      // 已有用户配置 → 不覆盖（播种只补缺，不动运行态）
      if (readProviderConfigFile(id)) continue;
      if (writeProviderConfigFile(id, prov)) written++;
    }
  } catch {
    // 播种失败不阻塞服务（后续请求仍可按内置目录兜底）
  }
  return written;
}
