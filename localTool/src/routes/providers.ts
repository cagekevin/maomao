/**
 * 子模块 0.6 — 多供应商路由（对齐 Infinite-Canvas 字段契约，见 docs/api-接入/02-provider字段契约.md）
 * /api/providers        GET / PUT   （列表 / 全量保存）
 * /api/providers/test-connection POST
 * /api/providers/:id/fetch-models POST
 *
 * 数据存于 getDataDir()/providers.json（~/.maomao-localtool），与 db 同目录。
 * 铁律（对齐契约）：
 *   - 协议统一 `apimart`（Lovart / 异步任务形态），区分站靠 provider_id；另支持 `openai` 直连兼容站
 *   - 模型分三类：image_models / chat_models / video_models（snake_case）
 *   - key 只进 env（localTool/.env 的 API_PROVIDER_{ID}_KEY），绝不落 json；列表脱敏 has_key/key_preview
 *
 * 本文件为纯新增，不改动任何现有路由（除 index.ts 注册 + system.ts 分派引用）。
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDataDir } from '../db/database.js';
import { json, parseJsonBody, sendError } from '../utils/helpers.js';
// 可插拔协议适配器：各协议一个 adapter，统一分派转发目标（协议类型单一真相在此）
import { resolveProviderTarget as resolveProviderTargetAdapter, PROVIDER_PROTOCOLS } from './protocolAdapters.js';
import type { ProviderProtocol } from './protocolAdapters.js';
// 走代理的出站 fetch：部分公网域（含 apimart/lovart 系）本机直连超时，必须经代理重试。
// 测试/拉取模型若不走代理，会得到「连接失败: Connect Timeout」，前端误报「连接失败：未知」。
import { fetchWithProxy } from '../utils/netProxy.js';

// ── 类型 ──
// ProviderProtocol 类型单一真相：见 protocolAdapters.ts（此处复用 import，禁止重复定义）。
export type ModelType = 'image' | 'chat' | 'video';

// ── 模块 3：单模型协议覆盖（C1/C2 契约 A.1#14，PER_MODEL_PROTOCOL_OPTIONS 钉死只 openai/gemini） ──
export const PER_MODEL_PROTOCOL_OPTIONS: ProviderProtocol[] = ['openai', 'gemini'];
export const FIXED_PROTOCOL_PROVIDER_IDS = ['modelscope', 'volcengine', 'jimeng', 'runninghub'];

/**
 * 单模型协议覆盖（M3-2，请求分派的单一真相）：
 *  - 锁死平台（modelscope/volcengine/jimeng/runninghub）→ 无视覆盖，返回全局 protocol（C1）；
 *  - 其余：model_protocols[model] 命中 openai/gemini → 返回覆盖；未命中/非法 → 回退全局 protocol。
 */
export function effectiveProtocol(provider: Pick<ApiProvider, 'id' | 'protocol'>, model = ''): ProviderProtocol {
  const base = provider.protocol;
  if (FIXED_PROTOCOL_PROVIDER_IDS.includes(provider.id)) return base;
  const overrides = (provider as any).model_protocols || {};
  const val = String(overrides[model] || '').toLowerCase();
  if (PER_MODEL_PROTOCOL_OPTIONS.includes(val as ProviderProtocol)) return val as ProviderProtocol;
  return base;
}

/** 规整 model_protocols：只保留 openai/gemini 合法值，非法丢弃（对齐 C1/C3）。 */
function normalizeModelProtocols(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const val = String(v ?? '').toLowerCase();
    if (k && PER_MODEL_PROTOCOL_OPTIONS.includes(val as ProviderProtocol)) out[k] = val;
  }
  return out;
}

/** 端点覆盖校验（M3-5）：http(s) 直接收尾斜杠；/开头按 base 相对路径；非法抛错。 */
function normalizeEndpointOverride(value: string | undefined, label: string): string {
  const e = (value || '').trim();
  if (!e) return '';
  if (e.length > 300 || /\s/.test(e)) throw new Error(`${label} 不合法`);
  if (/^https?:\/\//i.test(e)) return e.replace(/\/$/, '');
  if (!e.startsWith('/')) throw new Error(`${label} 需以 /v1/... 开头`);
  return e;
}

/** 端模型 ms_loras 逐项归一（M4-1，契约 A.1#15）：每项补默认字段 + strength 夹到 [0,2]；非法项剔除。 */
function normalizeMsLoras(raw: unknown): NonNullable<ApiProvider['ms_loras']> {
  if (!Array.isArray(raw)) return [];
  const out: NonNullable<ApiProvider['ms_loras']> = [];
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue;
    const s = Number((it as any).strength);
    out.push({
      id: typeof (it as any).id === 'string' ? (it as any).id : '',
      name: typeof (it as any).name === 'string' ? (it as any).name : '',
      target_model: typeof (it as any).target_model === 'string' ? (it as any).target_model : '',
      strength: Number.isFinite(s) ? Math.min(2, Math.max(0, s)) : 1,
      enabled: (it as any).enabled !== false,
      note: typeof (it as any).note === 'string' ? (it as any).note : '',
    });
  }
  return out;
}

export interface ProviderModel {
  id: string;
  label?: string;
  streaming?: boolean;
  promptOnly?: boolean;
}

export interface ApiProvider {
  id: string;
  name: string;
  base_url: string;            // API 基地址（对齐契约，旧版 url 兼容迁移）
  protocol: ProviderProtocol;
  image_request_mode: 'openai' | 'openai-json' | 'openai-video-proxy' | 'openai-responses';
  chat_request_mode?: 'chat' | 'responses';  // 聊天请求形态：chat/completions（默认）vs responses（gpt-5.6 工具调用）
  image_mode?: 'sync' | 'async';  // 生图同步/异步模式：sync=URL带?wait=1走SSE；async=提交task_id后轮询
  enabled: boolean;
  primary?: boolean;           // 唯一主供应商标记（契约 primary，铁律①照本表）
  readonly?: boolean;          // 系统内置不可删
  // 模型按类型分三类（对齐契约 snake_case）
  image_models: ProviderModel[];
  chat_models: ProviderModel[];
  video_models: ProviderModel[];
  model_names: Record<string, string>;   // 单模型显示名覆盖
  model_protocols?: Record<string, string>; // 单模型协议覆盖（仅 openai/gemini，契约 A.1#14）
  // 端点覆盖（契约 A.1#6/#7）：http(s) 直接用，否则拼到 base_url 的 scheme://netloc
  image_generation_endpoint?: string;
  image_edit_endpoint?: string;
  // 平台专属字段（契约 A.1#15-#20，当前协议未激活，按铁律①钉死不被删）
  ms_loras?: Array<{ id?: string; name?: string; target_model?: string; strength?: number; enabled?: boolean; note?: string }>;
  ms_defaults_version?: number;
  rh_apps?: Array<Record<string, unknown>>;
  rh_workflows?: Array<Record<string, unknown>>;
  volcengine_project_name?: string;
  volcengine_region?: string;
  // key 仅作 PUT 输入传输字段（M4-2 安全红线），真相源 = .env（API_PROVIDER_{ID}_KEY）；
  // API_PROVIDER 本地对象永不含明文 key，publicProvider() 用 readProviderKey 读 env 生成脱敏视图。
  api_key?: string;
  // 脱敏视图字段，仅由 publicProvider() 在 GET 时生成，不回明文
  has_key?: boolean;
  key_preview?: string;
  key_env?: string;
}

// ── env 文件路径（localTool/.env，与 index.ts loadDotEnv 一致）──
// 支持 MAOMAO_ENV_FILE 覆盖（测试隔离用），默认 localTool/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_FILE = process.env.MAOMAO_ENV_FILE || path.join(__dirname, '..', '..', '.env');

// 旧版单 models[] / url / key 字段向后兼容
function splitLegacyModels(models: any[] = []): { image: ProviderModel[]; chat: ProviderModel[]; video: ProviderModel[] } {
  const image: ProviderModel[] = [];
  const chat: ProviderModel[] = [];
  const video: ProviderModel[] = [];
  for (const m of models) {
    const t = m?.type;
    if (t === 'video') video.push({ id: m.id, label: m.label, streaming: m.streaming, promptOnly: m.promptOnly });
    else if (t === 'text') chat.push({ id: m.id, label: m.label, streaming: m.streaming, promptOnly: m.promptOnly });
    else image.push({ id: m.id, label: m.label, streaming: m.streaming, promptOnly: m.promptOnly });
  }
  return { image, chat, video };
}

const PROVIDERS_FILE = path.join(getDataDir(), 'providers.json');

const DEFAULT_PROVIDERS: ApiProvider[] = [
  {
    id: 'lovart',
    name: 'Lovart(自托管)',
    base_url: 'http://127.0.0.1:9004',
    protocol: 'apimart',
    image_request_mode: 'openai',
    image_mode: 'sync',
    enabled: true,
    primary: true,
    readonly: true,
    image_models: [
      { id: 'gpt-image-2-low', label: 'GPT Image 2 Low' },
      { id: 'gpt-image-2-medium', label: 'GPT Image 2 Medium' },
      { id: 'gpt-image-2', label: 'GPT Image 2' },
      { id: 'nano-bn-pro', label: 'Nano Banana Pro' },
      { id: 'nano-bn-2', label: 'Nano Banana 2' },
      { id: 'nano-bn-2-lite', label: 'Nano Banana 2 Lite', promptOnly: true },
    ],
    chat_models: [
      { id: 'lovart-chat', label: 'Lovart 设计 Agent', streaming: true },
    ],
    video_models: [
      { id: 'seedance-2.0-fast', label: 'Seedance 2.0 Fast' },
      { id: 'seedance-2', label: 'Seedance 2' },
      { id: 'seedance-2.0-mini', label: 'Seedance 2.0 Mini', promptOnly: true },
      { id: 'minimax-h3', label: 'MiniMax H3', promptOnly: true },
      { id: 'kling-v3-omni', label: 'Kling V3 Omni' },
    ],
    model_names: {},
  },
  {
    id: 'modelscope',
    name: '魔搭 ModelScope',
    base_url: 'https://api-inference.modelscope.cn',
    protocol: 'openai',
    image_request_mode: 'openai',
    image_mode: 'sync',
    enabled: true,
    primary: false,
    readonly: true,
    // 魔搭 OpenAI 兼容端点支持 function calling，供 AI 助手驱动画布工具。
    // 本机直连被拒，需走代理（fetchWithProxy 已由 localTool /api/proxy 统一处理）。
    // 模型名格式 {owner}/{model_name}，需支持 tools（已实测 Qwen3-14B 可用，见 daily/2026-08-03）。
    chat_models: [
      { id: 'Qwen/Qwen3-14B', label: 'Qwen3-14B', streaming: true },
      { id: 'Qwen/Qwen3-8B', label: 'Qwen3-8B', streaming: true },
      { id: 'Qwen/Qwen3-32B', label: 'Qwen3-32B', streaming: true },
      { id: 'MiniMax/MiniMax-M2.5', label: 'MiniMax-M2.5', streaming: true },
      { id: 'ZhipuAI/GLM-4.7-Flash', label: 'GLM-4.7-Flash', streaming: true },
    ],
    image_models: [],
    video_models: [],
    model_names: {},
  },
];

// ── key 隔离（只进 env，绝不落 json）──
/** id → env 名：lovart→API_PROVIDER_LOVART_KEY；my-comfy→API_PROVIDER_MY_COMFY_KEY */
export function providerKeyEnv(id: string): string {
  const safe = String(id || '').replace(/[^A-Za-z0-9_]/g, '_').toUpperCase();
  return `API_PROVIDER_${safe}_KEY`;
}

function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 4) return '••••••••';
  return '••••••••' + key.slice(-4);
}

/** 读 env 文件里指定键的值（带引号剥离）；读不到返回 null */
function readEnvFileValue(envName: string): string | null {
  try {
    const raw = fs.readFileSync(ENV_FILE, 'utf-8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m || m[1] !== envName) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      return val;
    }
  } catch { /* noop */ }
  return null;
}

/** 读 provider 的 key：真相源 = .env（API_PROVIDER_{ID}_KEY，M4-2 安全红线，providers.json 永不含明文）。
 *  - 先读 process.env（writeProviderKey 保存时热更新），再读 .env 文件（跨进程 / 重启兜底）
 *  - modelscope（魔搭）特殊：两者都无 key 时，兜底复用 LLM_CHAT_API_KEY
 *    （AI 助手在 .env 里已填的唯一一份魔搭 key），避免前端选魔搭走 /api/proxy 时读到空 key 而上游 401。 */
export function readProviderKey(id: string): string {
  const envName = providerKeyEnv(id);
  // 1) 真相源 process.env（PUT 保存时已热更新写入）
  const fromEnv = process.env[envName];
  if (fromEnv) return fromEnv;
  // 2) .env 文件（进程重启 / 外部注入兜底）
  const fromFile = readEnvFileValue(envName);
  if (fromFile) return fromFile;
  // 3) modelscope 兜底：复用 AI 助手 LLM 通道的 key
  if (id === 'modelscope') {
    if (process.env.LLM_CHAT_API_KEY) return process.env.LLM_CHAT_API_KEY;
    const fallback = readEnvFileValue('LLM_CHAT_API_KEY');
    if (fallback) return fallback;
  }
  return '';
}

function quoteEnv(value: string): string {
  if (/[\s"'#]/.test(value)) return `"${value.replace(/"/g, '\\"')}"`;
  return value;
}

/** 写 key 到 env 文件 + 同步 process.env（模拟 IC reload_env_globals 热更新，免重启） */
function writeProviderKey(id: string, value: string): void {
  const envName = providerKeyEnv(id);
  if (value) {
    process.env[envName] = value;
  } else {
    delete process.env[envName];
  }
  try {
    let lines: string[] = [];
    try {
      lines = fs.readFileSync(ENV_FILE, 'utf-8').split(/\r?\n/);
    } catch { /* 文件不存在则新建 */ }
    const out: string[] = [];
    let found = false;
    for (const line of lines) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
      if (m && m[1] === envName) {
        found = true;
        if (value) out.push(`${envName}=${quoteEnv(value)}`);
      } else {
        out.push(line);
      }
    }
    if (!found && value) out.push(`${envName}=${quoteEnv(value)}`);
    fs.writeFileSync(ENV_FILE, out.join('\n') + '\n', 'utf-8');
  } catch { /* env 写失败不阻断业务 */ }
}

// ── 持久化 ──
function ensureFile(): void {
  if (!fs.existsSync(PROVIDERS_FILE)) {
    fs.writeFileSync(PROVIDERS_FILE, JSON.stringify(DEFAULT_PROVIDERS, null, 2), 'utf-8');
  }
}

export function loadProviders(): ApiProvider[] {
  ensureFile();
  try {
    const raw = fs.readFileSync(PROVIDERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_PROVIDERS;
    // 向后兼容旧版字段：models[]→三类、url→base_url、key 明文→env
    return parsed.map((p: any) => {
      if (Array.isArray(p.models)) {
        const { image, chat, video } = splitLegacyModels(p.models);
        p.image_models = p.image_models ?? image;
        p.chat_models = p.chat_models ?? chat;
        p.video_models = p.video_models ?? video;
      }
      p.image_models = p.image_models ?? [];
      p.chat_models = p.chat_models ?? [];
      p.video_models = p.video_models ?? [];
      p.model_names = p.model_names ?? {};
      p.base_url = p.base_url ?? p.url ?? p.baseUrl ?? '';
      p.image_request_mode = p.image_request_mode ?? 'openai';
      p.image_mode = p.image_mode === 'async' ? 'async' : 'sync';
      p.enabled = p.enabled !== false;
      // 旧版明文 key 迁移到 env（仅首次）：旧字段 key 与方案A残留的 api_key 统一剥离开到 env
      if (typeof p.key === 'string' && p.key) {
        writeProviderKey(p.id, p.key);
      }
      if (typeof p.api_key === 'string' && p.api_key) {
        writeProviderKey(p.id, p.api_key);
      }
      delete p.key;
      delete p.api_key;
      delete p.url;
      delete p.models;
      return p as ApiProvider;
    });
  } catch {
    return DEFAULT_PROVIDERS;
  }
}

export function saveProviders(providers: ApiProvider[]): void {
  fs.writeFileSync(PROVIDERS_FILE, JSON.stringify(providers, null, 2), 'utf-8');
}

// ── 校验 + 锁协议 ──
function normalizeProvider(input: Partial<ApiProvider> & { api_key?: string }, prev?: ApiProvider): ApiProvider | null {
  if (!input || typeof input.id !== 'string' || !input.id.trim()) return null;
  const id = input.id.trim();
  // 平台 id 锁协议：id 与协议同名（volcengine/jimeng/runninghub）→ 锁死协议，不接受用户改
  const PROTOCOL_BY_FIXED_ID: Record<string, ProviderProtocol> = {
    volcengine: 'volcengine',
    jimeng: 'jimeng',
    runninghub: 'runninghub',
  };
  // 协议白名单：PROVIDER_PROTOCOLS 8 选 1，非法回退 openai；平台 id 锁协议优先
  const protocol: ProviderProtocol =
    PROTOCOL_BY_FIXED_ID[id]
    || (PROVIDER_PROTOCOLS.includes(input.protocol as ProviderProtocol) ? (input.protocol as ProviderProtocol) : 'openai');
  // 向后兼容：旧运行时数据用 isPrimary，契约铁律①用 primary，两者都认
  const primary = input.primary === true || (input as any).isPrimary === true;
  const readonly = prev ? !!prev.readonly : false;

  // readonly provider 只锁结构字段；base_url 是部署环境地址，允许用户覆盖（空则回退旧值）
  const base_url = typeof input.base_url === 'string' && input.base_url.trim() ? input.base_url.trim() : (prev?.base_url || '');

  const normModel = (m: any): ProviderModel | null => {
    if (!m || typeof m.id !== 'string') return null;
    return { id: m.id, label: typeof m.label === 'string' ? m.label : m.id, streaming: !!m.streaming, promptOnly: !!m.promptOnly };
  };
  const splitArr = (arr: any, fallback: ProviderModel[]): ProviderModel[] =>
    Array.isArray(arr) ? arr.map(normModel).filter(Boolean as any) : fallback;

  let image_models = splitArr((input as any).image_models, prev?.image_models ?? []);
  let chat_models = splitArr((input as any).chat_models, prev?.chat_models ?? []);
  let video_models = splitArr((input as any).video_models, prev?.video_models ?? []);
  // 旧版单 models[] 兜底
  if (Array.isArray((input as any).models)) {
    const { image, chat, video } = splitLegacyModels((input as any).models);
    if (!Array.isArray((input as any).image_models)) image_models = image;
    if (!Array.isArray((input as any).chat_models)) chat_models = chat;
    if (!Array.isArray((input as any).video_models)) video_models = video;
  }

  const model_names: Record<string, string> = (input.model_names && typeof input.model_names === 'object') ? input.model_names : (prev?.model_names || {});

  // key 处理（M4-2 安全红线：key 只进 env，绝不落 providers.json）：
  //  - api_key 有值 → 写 .env（唯一真相源），本地对象不存明文
  //  - clear_key   → 清 .env
  // 注意：绝不把明文 key 下发前端 / 落 JSON；publicProvider() 脱敏，前端只维护 env。
  if (typeof input.api_key === 'string' && input.api_key && input.api_key !== '***') {
    writeProviderKey(id, input.api_key);
  }
  if ((input as any).clear_key === true) {
    writeProviderKey(id, '');
  }

  return {
    id,
    name: typeof input.name === 'string' && input.name.trim() ? input.name.trim() : id,
    base_url,
    protocol,
    image_request_mode: input.image_request_mode ?? prev?.image_request_mode ?? 'openai',
    chat_request_mode: input.chat_request_mode === 'responses' ? 'responses' : (prev?.chat_request_mode === 'responses' ? 'responses' : 'chat'),
    image_mode: input.image_mode === 'async' ? 'async' : 'sync',
    enabled: input.enabled !== false,
    primary,
    readonly,
    image_models,
    chat_models,
    video_models,
    model_names,
    // 专属字段归一（契约 A.1#6/#7/#14-#20，默认空/默认 value，铁律①钉死）
    image_generation_endpoint: normalizeEndpointOverride(input.image_generation_endpoint ?? prev?.image_generation_endpoint, 'image_generation_endpoint'),
    image_edit_endpoint: normalizeEndpointOverride(input.image_edit_endpoint ?? prev?.image_edit_endpoint, 'image_edit_endpoint'),
    model_protocols: normalizeModelProtocols((input.model_protocols && typeof input.model_protocols === 'object') ? input.model_protocols : prev?.model_protocols),
    ms_loras: normalizeMsLoras(Array.isArray(input.ms_loras) ? input.ms_loras : (prev?.ms_loras || [])),
    ms_defaults_version: typeof input.ms_defaults_version === 'number' ? input.ms_defaults_version : (prev?.ms_defaults_version || 0),
    rh_apps: Array.isArray(input.rh_apps) ? input.rh_apps : (prev?.rh_apps || []),
    rh_workflows: Array.isArray(input.rh_workflows) ? input.rh_workflows : (prev?.rh_workflows || []),
    volcengine_project_name: typeof input.volcengine_project_name === 'string' ? input.volcengine_project_name : (prev?.volcengine_project_name || 'default'),
    volcengine_region: typeof input.volcengine_region === 'string' ? input.volcengine_region : (prev?.volcengine_region || 'cn-beijing'),
  };
}

// ── 查表 + primary 回退 ──
export function getProvider(id?: string | null): ApiProvider | undefined {
  const list = loadProviders();
  if (id) {
    const found = list.find((p) => p.id === id);
    if (found) return found;
  }
  return list.find((p) => p.primary) || list[0];
}

// ── 脱敏（GET 列表时 key 打码，key 不回明文）──
function publicProvider(p: ApiProvider): ApiProvider {
  const envName = providerKeyEnv(p.id);
  const key = readProviderKey(p.id);
  const hasKey = !!key;
  // 绝不回传明文 api_key：展开后显式剔除
  const { api_key: _omit, ...safe } = p as ApiProvider & { api_key?: string };
  return { ...safe, has_key: hasKey, key_preview: hasKey ? maskKey(key) : '', key_env: envName };
}

// ── 路由处理 ──
export async function handleProvidersGet(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const list = loadProviders().map(publicProvider);
  return json(res, { providers: list });
}

export async function handleProvidersPut(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as { providers?: unknown } | null;
  if (!body || !Array.isArray(body.providers)) {
    return sendError(res, 'Invalid body: providers[] required', 400);
  }

  const incoming = body.providers as (Partial<ApiProvider> & { api_key?: string })[];
  const existing = loadProviders();
  const merged: ApiProvider[] = [];

  // id 去重
  const idSet = new Set<string>();
  for (const item of incoming) {
    const id = typeof item?.id === 'string' ? item.id.trim() : '';
    if (id && idSet.has(id)) return sendError(res, `Duplicate provider id: ${id}`, 400);
    if (id) idSet.add(id);
  }

  // 唯一化 primary：最后设置的 primary=true 胜出
  let primaryId: string | undefined;
  for (const item of incoming) {
    if (item.primary) primaryId = item.id;
  }

  for (const item of incoming) {
    const prev = existing.find((e) => e.id === item.id);
    let norm: ApiProvider | null;
    try {
      norm = normalizeProvider(item, prev);
    } catch (e) {
      // 端点覆盖非法（M3-5）：给可操作 400，而非 500
      return sendError(res, e instanceof Error ? `配置非法：${e.message}` : '配置非法', 400);
    }
    if (!norm) continue;
    if (primaryId && norm.id !== primaryId) norm.primary = false;
    else if (!primaryId && prev?.primary) norm.primary = true;
    merged.push(norm);
  }

  // 至少要有一个 primary（避免 getProvider 退化为 list[0]）。
  // 兜底选择优先级（原 #5 卫生死角修复）：
  //   1) 原列表里 primary 且本次仍在 → 保留原主供应商（不悄悄换）
  //   2) 否则第一个 enabled 的
  //   3) 否则才退到 merged[0]
  // 同时返回 warning，让前端感知「本次未指定 primary，已自动选定」而非静默改。
  let primaryWarning: string | undefined;
  if (!merged.some((p) => p.primary) && merged.length > 0) {
    const prevPrimary = existing.find((e) => e.primary && merged.some((m) => m.id === e.id));
    const fallback = prevPrimary
      || merged.find((m) => m.enabled)
      || merged[0];
    fallback.primary = true;
    primaryWarning = `未指定主供应商，已自动选「${fallback.name || fallback.id}」`;
  }

  saveProviders(merged);
  const payload: Record<string, unknown> = { providers: merged.map(publicProvider) };
  if (primaryWarning) payload.warning = primaryWarning;
  return json(res, payload);
}

// 【打基础】连接测试的探测路径「按协议表驱动」（可插拔，不堆 if）。
// 将来加新协议（gemini → /v1beta、volcengine → /api/v3、runninghub → /openapi/v2）只需
// 在这里补一条映射 + 在 PROBE_ORDER 里加名字，主探测逻辑无需改。
// 探测路径（对齐实测）：
//   openai 兼容 → /v1/models（标准）
//   apimart     → /models（apimart 的 base_url 已含 /v1 前缀，其根路径即 /v1/models；
//                  实测 /health 不存在(404)、/v1/models 会拼成 /v1/v1/models(404)）
const PROBE_PATHS: Record<string, string> = {
  openai: '/v1/models',
  apimart: '/models',
};
// auto 时依次探测的顺序（先试通用的 openai，再试 apimart）
const PROBE_ORDER = ['openai', 'apimart'];

export async function handleProviderTest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as { id?: string; url?: string; key?: string; protocol?: string } | null;
  if (!body) return sendError(res, 'Empty body', 400);

  // 优先用传入的 url/key/protocol 现场测，其次按 id 查表（key 从 env 读）
  let url = body.url;
  let key = body.key;
  let protocol: ProviderProtocol | 'auto' = body.protocol === 'apimart' ? 'apimart' : body.protocol === 'openai' ? 'openai' : 'auto';
  if (body.id && (!url || !key)) {
    const p = getProvider(body.id);
    if (p) {
      url = url || p.base_url;
      key = key || readProviderKey(p.id);
      if (protocol === 'auto') protocol = p.protocol;
    }
  }
  if (!url) return sendError(res, 'Missing url (or id)', 400);

  const base = url.replace(/\/$/, '');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (key) headers['Authorization'] = `Bearer ${key}`;

  /**
   * 读取上游响应体（JSON 优先，非 JSON 截断为纯文本）。
   * 目的：把 apimart 等上游返回的原始错误信息透传回前端，而不是只给一个
   * 「status: 0」让前端显示「连接失败：未知」。
   */
  const readBody = async (r: Response): Promise<string> => {
    try {
      const text = await r.text();
      const t = text.trim();
      if (!t) return '';
      if (t.length <= 2000) return t;
      return t.slice(0, 2000) + '…(截断)';
    } catch {
      return '';
    }
  };

  // 协议探测：auto 时先探 openai(/v1/models)，失败再探 apimart(/health)
  // 返回体带 body（上游原始响应体）与 err（网络/超时错误信息），供前端展示透传原始信息。
  const probe = async (path: string): Promise<{ ok: boolean; status: number; body: string; err: string; url: string }> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    // 用 joinWithPrefixAbsorb 吸收 base 已含 /v1 与 path 同前缀造成的重复（如 /v1/v1/models），
    // 否则用户 base_url 填了 .../v1 又选 openai 协议时会拼出重复前缀 → 404。
    const fullUrl = joinWithPrefixAbsorb(base, path);
    try {
      // 用 fetchWithProxy 而非原生 fetch：apimart/lovart 系公网域本机直连常超时，
      // 必须「直连失败→走代理重试」，否则测试永远报「连接失败」。
      const r = await fetchWithProxy(fullUrl, { method: 'GET', headers, signal: controller.signal });
      clearTimeout(timeout);
      const body = await readBody(r);
      return { ok: r.status >= 200 && r.status < 400, status: r.status, body, err: '', url: fullUrl };
    } catch (e) {
      clearTimeout(timeout);
      const err = (e as Error).name === 'AbortError'
        ? `请求超时(8s): ${fullUrl}`
        : `连接失败: ${(e as Error).message}`;
      return { ok: false, status: 0, body: '', err, url: fullUrl };
    }
  };

  /** 把探测结果收敛成统一展示字段：优先原始 body，其次网络错误，兜底「HTTP n」 */
  const summarize = (r: { ok: boolean; status: number; body: string; err: string }): string => {
    if (r.body) return r.body;
    if (r.err) return r.err;
    return `HTTP ${r.status}`;
  };

  try {
    // 表驱动探测：显式协议只探它的路径；auto 按 PROBE_ORDER 依次试
    if (protocol !== 'auto' && PROBE_PATHS[protocol]) {
      const r = await probe(PROBE_PATHS[protocol]);
      // 失败时透传上游原始 body/错误（前端「连接失败：xxx」不再显示「未知」）
      const payload: Record<string, unknown> = {
        ok: r.ok, status: r.status, protocol, detectedProtocol: protocol, url: r.url,
      };
      if (!r.ok) payload.error = summarize(r);
      return json(res, payload);
    }
    const probes: Record<string, number> = {};
    let firstStatus = 0;
    let firstDetail = '';
    for (const proto of PROBE_ORDER) {
      const path = PROBE_PATHS[proto];
      if (!path) continue;
      const r = await probe(path);
      probes[proto] = r.status;
      firstStatus = firstStatus || r.status;
      firstDetail = firstDetail || summarize(r);
      if (r.ok) {
        return json(res, { ok: true, status: r.status, protocol: proto, detectedProtocol: proto, url: r.url, probes });
      }
    }
    const payload: Record<string, unknown> = {
      ok: false,
      status: firstStatus,
      protocol: 'unknown',
      detectedProtocol: null,
      probes,
      url: base,
    };
    if (firstDetail) payload.error = firstDetail;
    return json(res, payload);
  } catch (e) {
    return json(res, { ok: false, error: (e as Error).message, protocol: 'unknown', detectedProtocol: null, url: base });
  }
}

// ── probe-async：异步端点嗅探（对齐 docs/api-接入/04 §G.4，接 apimart 异步站的「命门」）──
// 用**假 task_id** 请求 `GET {base}/v1/tasks/healthcheck_probe_do_not_submit`：
//   - 400 + 错误含 invalid task id → 端点存在、Key 有效（apimart 异步协议确认）
//   - 401/403 → Key 无效（透传上游原始 body）
//   - 404     → 平台不支持 /v1/tasks/（非 apimart）
//   - 其它    → 透传原始状态 + body
export async function handleProviderProbeAsync(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as { id?: string; url?: string; key?: string } | null;
  if (!body) return sendError(res, 'Empty body', 400);

  let url = body.url;
  let key = body.key;
  if (body.id && (!url || !key)) {
    const p = getProvider(body.id);
    if (p) {
      url = url || p.base_url;
      key = key || readProviderKey(p.id);
    }
  }
  if (!url) return sendError(res, 'Missing url (or id)', 400);

  const base = url.replace(/\/$/, '');
  // 任务端点有两种拼法，依次探测避免 base 已含/未含 /v1 造成重复：
  //   用户 base 填 https://host/v1     → 探 {base}/tasks/{id}
  //   用户 base 填 https://host         → 探 {base}/v1/tasks/{id}
  const taskId = 'healthcheck_probe_do_not_submit';
  const candidates = [`${base}/tasks/${taskId}`, `${base}/v1/tasks/${taskId}`];
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (key) headers['Authorization'] = `Bearer ${key}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const probeUrl = `${candidates[0]}`;
  try {
    // 依次尝试候选 URL，取第一个「非连接级错误」的响应作为诊断依据
    let result: { status: number; text: string; url: string } | null = null;
    for (const cand of candidates) {
      try {
        // 同样走 fetchWithProxy：apimart 需经代理才能访问，直连会超时
        const r = await fetchWithProxy(cand, { method: 'GET', headers, signal: controller.signal });
        clearTimeout(timeout);
        const rawBody = await r.text();
        result = { status: r.status, text: (rawBody || '').trim(), url: cand };
        // 401/403（key 无效）或 404（确认端点路径）即为决定性结论，无需再试
        if (r.status === 401 || r.status === 403 || r.status === 404) break;
        break; // 其余状态也以首个为准（已拿到响应）
      } catch {
        // 单个候选连接失败则换下一个；全部失败走下方 catch
        continue;
      }
    }
    if (!result) {
      clearTimeout(timeout);
      throw new Error('all candidates failed');
    }
    const { status, text, url: hitUrl } = result;
    const detail = text && text.length <= 2000 ? text : (text ? text.slice(0, 2000) + '…(截断)' : '');
    const lower = text.toLowerCase();

    if (status === 401 || status === 403) {
      return json(res, {
        ok: false, status, protocol: 'apimart', detectedProtocol: 'apimart',
        stage: 'key_invalid', url: hitUrl,
        error: detail || `Key 无效（HTTP ${status}）`,
      });
    }
    if (status === 404) {
      return json(res, {
        ok: false, status: 404, protocol: 'apimart', detectedProtocol: null,
        stage: 'not_apimart', url: hitUrl,
        error: detail || '该地址不支持 /tasks/*，可能不是 apimart 异步协议',
      });
    }
    if ((status >= 400 && status < 500) && lower.includes('invalid task')) {
      return json(res, {
        ok: true, status, protocol: 'apimart', detectedProtocol: 'apimart',
        stage: 'async_endpoint_ok', url: hitUrl,
        detail: detail || '异步端点存在（返回 invalid task id，属预期）',
      });
    }
    if (status >= 200 && status < 400) {
      return json(res, {
        ok: true, status, protocol: 'apimart', detectedProtocol: 'apimart',
        stage: 'reachable', url: hitUrl, detail,
      });
    }
    return json(res, {
      ok: false, status, protocol: 'apimart', detectedProtocol: 'apimart',
      stage: 'unknown', url: hitUrl,
      error: detail || `HTTP ${status}`,
    });
  } catch (e) {
    clearTimeout(timeout);
    const err = (e as Error).name === 'AbortError'
      ? `请求超时(8s): ${probeUrl}`
      : `连接失败: ${(e as Error).message}`;
    return json(res, { ok: false, status: 0, protocol: 'apimart', detectedProtocol: null, stage: 'network_error', url: candidates.join(' | '), error: err });
  }
}

export async function handleProviderFetchModels(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  const p = getProvider(id);
  if (!p) return sendError(res, `Provider not found: ${id}`, 404);

  // 模型 URL 按协议拼：openai 兼容 → /v1/models；apimart → /models。
  // 关键：必须用 joinWithPrefixAbsorb 吸收 base 已含 /v1 时的重复前缀
  // （如 base=https://api.apimart.ai/v1 + openai 会拼成 /v1/v1/models → 404），
  // 与测试连接的 probe 保持一致，否则拉取会因重复前缀 404。
  const modelsPath = p.protocol === 'apimart' ? '/models' : '/v1/models';
  const modelsUrl = joinWithPrefixAbsorb(p.base_url.replace(/\/$/, ''), modelsPath);
  const headers: Record<string, string> = { Accept: 'application/json' };
  const key = readProviderKey(p.id);
  if (key) headers['Authorization'] = `Bearer ${key}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    // 走 fetchWithProxy：apimart/lovart 系公网域本机直连超时，必须经代理。
    const fetchRes = await fetchWithProxy(modelsUrl, { method: 'GET', headers, signal: controller.signal });
    clearTimeout(timeout);
    if (!fetchRes.ok) {
      return json(res, { ...emptyModels(), warning: `upstream ${fetchRes.status}, fell back to stored` });
    }
    const data = await fetchRes.json();
    const known = new Map<string, ProviderModel>();
    [...p.image_models, ...p.chat_models, ...p.video_models].forEach((m) => known.set(m.id, m));
    const rawModels: any[] = Array.isArray(data?.data) ? data.data : [];

    // 分类策略：先按 id 关键字分类（classifyOpenAIModels：video → image → 兜底 chat），
    // 再用官方返回的 category 字段（如网关 /v1/models 每项带 "category": "image"|"video"|"chat"）
    // 做校正覆盖：官方给了明确分类且与关键字结果不同时，以官方为准。
    // 无官方 category 的模型，直接沿用关键字分类（其内部已兜底到 chat）。
    const CAT_MAP: Record<string, 'image' | 'chat' | 'video'> = {
      image: 'image', img: 'image', images: 'image',
      chat: 'chat', text: 'chat', llm: 'chat', language: 'chat',
      video: 'video', vid: 'video',
      // music 我们系统无对应栏（网关也不支持音频生成），不收录
    };
    // 第 1 步：全部模型先走关键字分类（含兜底）
    const kw = classifyOpenAIModels(rawModels.map((m) => m.id), known);
    const byId = new Map<string, { list: ProviderModel[] }>();
    const classified = { image: kw.image, chat: kw.chat, video: kw.video };
    (['image', 'chat', 'video'] as const).forEach((cat) => {
      classified[cat].forEach((m) => byId.set(m.id, { list: classified[cat] }));
    });
    // 第 2 步：官方 category 校正覆盖关键字结果
    for (const m of rawModels) {
      if (!m || typeof m?.id !== 'string') continue;
      const id = m.id;
      const official = CAT_MAP[String(m.category || '').toLowerCase()];
      if (!official) continue; // 无官方 category → 维持关键字分类
      const bucket = byId.get(id);
      if (!bucket) continue;
      const current = bucket.list;
      // 若当前关键字分类与官方一致，跳过
      const officialList = classified[official];
      if (officialList === current) continue;
      // 从原列表移除，放入官方分类列表（保留已有 label）
      const idx = current.findIndex((x) => x.id === id);
      if (idx < 0) continue;
      const [model] = current.splice(idx, 1);
      officialList.push(model);
      byId.set(id, { list: officialList });
    }

    return json(res, {
      image_models: classified.image,
      chat_models: classified.chat,
      video_models: classified.video,
      modelCount: rawModels.length,
    });
  } catch (e) {
    return json(res, { ...emptyModels(), warning: (e as Error).message });
  }
}

function emptyModels() {
  return { image_models: [], chat_models: [], video_models: [] };
}

// ── 方案A：把保存后的 providers 回写项目根 api.config.json ──
// 解决「前端设置页改完 → providers.json 更新了、但 api.config.json 不变」的双源漂移：
// 前端 save() 成功后调 PUT /api/config/base，把脱敏视图合并回写 json。
// 保留顶层 _meta 和每个 provider 的 _comment（AI/人维护的注释骨架），只更新字段。
//
// 字段白名单（单一真相）：加新 provider 字段时，只需在此数组补一行 + normalizeProvider 补一行，
// 避免「两份手写字段列表漏改一边」导致的双源漂移（原 #3 卫生死角已收敛）。
// 注意：api_key / has_key / key_preview / key_env 等敏感/脱敏字段【绝不】进此白名单（config 可能进 git）。
const CONFIG_SYNC_FIELDS: Array<{
  key: keyof ApiProvider;
  /** 写出条件：非空/非空数组/非空对象/真值，默认 truthy */
  when?: (p: ApiProvider) => boolean;
}> = [
  { key: 'image_request_mode' },
  { key: 'image_mode' },
  { key: 'enabled' },
  { key: 'primary' },
  { key: 'image_models', when: (p) => Array.isArray(p.image_models) && p.image_models.length > 0 },
  { key: 'chat_models', when: (p) => Array.isArray(p.chat_models) && p.chat_models.length > 0 },
  { key: 'video_models', when: (p) => Array.isArray(p.video_models) && p.video_models.length > 0 },
  { key: 'model_names', when: (p) => !!p.model_names && Object.keys(p.model_names).length > 0 },
  { key: 'model_protocols', when: (p) => !!p.model_protocols && Object.keys(p.model_protocols).length > 0 },
  { key: 'image_generation_endpoint' },
  { key: 'image_edit_endpoint' },
  { key: 'ms_loras', when: (p) => Array.isArray(p.ms_loras) && p.ms_loras.length > 0 },
  { key: 'ms_defaults_version', when: (p) => typeof p.ms_defaults_version === 'number' && p.ms_defaults_version !== 0 },
  { key: 'rh_apps', when: (p) => Array.isArray(p.rh_apps) && p.rh_apps.length > 0 },
  { key: 'rh_workflows', when: (p) => Array.isArray(p.rh_workflows) && p.rh_workflows.length > 0 },
  { key: 'volcengine_project_name' },
  { key: 'volcengine_region' },
];

const CONFIG_FILE = process.env.MAOMAO_CONFIG_FILE || path.join(__dirname, '..', '..', 'api.config.json');

export function syncConfigJson(providers: ApiProvider[]): void {
  let cfg: any = {};
  try {
    cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    cfg = {};
  }
  const meta = cfg._meta;
  const oldById = new Map<string, any>((cfg.providers || []).map((p: any) => [p?.id, p]));

  const newProviders = providers.map((p) => {
    const old = oldById.get(p.id);
    const out: Record<string, unknown> = {
      id: p.id,
      name: p.name,
      base_url: p.base_url,
      protocol: p.protocol,
    };
    // 白名单驱动写出（单一字段列表，消除手写 if 重复）
    for (const f of CONFIG_SYNC_FIELDS) {
      const val = (p as any)[f.key];
      const ok = f.when ? f.when(p) : !!val;
      if (ok) out[f.key as string] = val;
    }
    // 保留原 json 里的注释，避免回写抹掉 AI/人写的说明
    if (old && typeof old._comment === 'string') out._comment = old._comment;
    return out;
  });

  const out: Record<string, unknown> = {};
  if (meta !== undefined) out._meta = meta;
  out.providers = newProviders;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(out, null, 2) + '\n', 'utf8');
}

export async function handleConfigBasePut(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as { providers?: unknown } | null;
  if (!body || !Array.isArray(body.providers)) {
    return sendError(res, 'Invalid body: providers[] required', 400);
  }
  try {
    syncConfigJson(body.providers as ApiProvider[]);
    return json(res, { ok: true });
  } catch (e) {
    return sendError(res, (e as Error).message || 'Failed to sync api.config.json', 500);
  }
}

/**
 * 把 OpenAI /v1/models 返回的 id 列表按关键字分类（对齐参考实现 classify_upstream_model）。
 * 判断顺序：video → image → 兜底 chat（与参考后端完全一致）。
 *  - video: veo/sora/wan2/wanx/doubao-seedance/doubao-1/kling/hailuo/video/t2v-/i2v-/s2v
 *           （在参考实现基础上补 seedance：其默认视频模型 seedance-2 等因缺 doubao- 前缀
 *             会被原实现误分到 chat，这里补上避免视频模型错分到聊天）
 *  - image: banana/image/dalle/imagen/flux/stable/sdxl/midjourney/nano-banana/ideogram/fal-ai/z-image/qwen-image/klein/seedream/doubao-seedream/text-to-image/image-to-image
 *  - 兜底: chat（未知模型默认视为聊天，而非生图）
 * 子串匹配（小写包含），不依赖前缀/锚点。
 */
export function classifyOpenAIModels(ids: string[], known?: Map<string, ProviderModel>): {
  image: ProviderModel[];
  chat: ProviderModel[];
  video: ProviderModel[];
} {
  const VIDEO_KEYS = ['veo', 'sora', 'wan2', 'wanx', 'doubao-seedance', 'seedance', 'doubao-1', 'kling', 'hailuo', 'video', 't2v-', 'i2v-', 's2v'];
  const IMAGE_KEYS = ['banana', 'image', 'dalle', 'dall-e', 'imagen', 'flux', 'stable', 'sdxl', 'midjourney', 'nano-banana', 'ideogram', 'fal-ai', 'z-image', 'qwen-image', 'klein', 'seedream', 'doubao-seedream', 'text-to-image', 'image-to-image'];
  const image: ProviderModel[] = [];
  const chat: ProviderModel[] = [];
  const video: ProviderModel[] = [];
  for (const id of ids) {
    const prev = known?.get(id);
    const model: ProviderModel = prev || { id, label: id };
    const lc = id.toLowerCase();
    if (VIDEO_KEYS.some((k) => lc.includes(k))) video.push(model);
    else if (IMAGE_KEYS.some((k) => lc.includes(k))) image.push(model);
    else chat.push(model);
  }
  return { image, chat, video };
}

// ── proxy 分派 helper（供 system.ts 的 handleProxy 调用）──
export interface ResolvedTarget {
  url: string;
  authHeader?: string;   // 注入的 Authorization（Bearer key），openai 协议下注入
  protocol: ProviderProtocol;
  providerId?: string;
}

/**
 * 是否 apimart 协议。
 * 判定唯一依据：provider.protocol === 'apimart'（单一真相，不做域名嗅探）。
 * 背景：远程 api.apimart.ai 站若协议标为 openai（OpenAI 兼容），应按 openai 处理——
 * 靠 base_url 含 'apimart.ai' 嗅探会把 openai 协议的站误判成 apimart，导致
 * 前端发 `openai://<path>` 伪 URL 被后端 apimart 分支错拼（Invalid URL）。
 * 真正的 apimart 协议站（如 Lovart，base=127.0.0.1:9004）protocol 本就标 apimart，靠字段即可识别。
 */
export function isApimartProvider(p: ApiProvider): boolean {
  return p.protocol === 'apimart';
}

/**
 * 端点拼接（对齐契约 provider_endpoint_url 的前缀吸收，03 §8 / 04 §H）：
 * base 已以 /v1 结尾且 path 也以 /v1 开头 → 去掉重复前缀，避免拼出 /v1/v1/... 404。
 * 例：base=https://api.apimart.ai/v1 + path=/v1/images/generations
 *     → https://api.apimart.ai/v1/images/generations（吸收一个 /v1）
 */
function joinWithPrefixAbsorb(base: string, path: string): string {
  const b = base.replace(/\/$/, '');
  let p = path.startsWith('/') ? path : '/' + path;
  // 前缀吸收：base 以 /v1|/v2|/v1beta|/api/v3 结尾 且 path 同前缀开头 → 去掉 path 的前缀
  const prefixMatch = b.match(/((\/v1|\/v2|\/v1beta|\/api\/v3))$/);
  if (prefixMatch) {
    const pre = prefixMatch[2];
    if (p.startsWith(pre + '/') || p === pre) {
      p = p.slice(pre.length) || '/';
    }
  }
  return b + p;
}

/**
 * 把前端传来的「原始 url」 + 可选 providerId 解析成真实转发目标。
 *
 * 委托给可插拔协议适配器（protocolAdapters.ts）：openai/apimart 各自一个 adapter，
 * 将来加新平台只需新增 adapter 并注册，本函数主体不动。
 */
export function resolveProviderTarget(rawUrl: string, providerId?: string | null, model?: string): ResolvedTarget {
  // M3-2：单模型协议覆盖（model_protocols）决定本次请求走哪个适配器；锁死平台/未命中的 middleware = 全局。
  const p = providerId ? getProvider(providerId) : undefined;
  const protocolHint = p ? effectiveProtocol(p, model) : undefined;
  return resolveProviderTargetAdapter(rawUrl, providerId, getProvider, readProviderKey, protocolHint);
}
