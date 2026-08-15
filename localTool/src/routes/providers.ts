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

// ── 类型 ──
// 协议：apimart（Lovart / 异步任务 task_id 轮询形态）| openai（直连 OpenAI 兼容端点）
// 扩展点：将来可加 gemini / volcengine / runninghub / CLI，前端协议下拉与 test 探测随之扩展。
export type ProviderProtocol = 'apimart' | 'openai';

export type ModelType = 'image' | 'chat' | 'video';

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
  image_mode?: 'sync' | 'async';  // 生图同步/异步模式：sync=URL带?wait=1走SSE；async=提交task_id后轮询
  enabled: boolean;
  isPrimary?: boolean;         // 唯一主供应商标记（契约 primary）
  readonly?: boolean;          // 系统内置不可删
  // 模型按类型分三类（对齐契约 snake_case）
  image_models: ProviderModel[];
  chat_models: ProviderModel[];
  video_models: ProviderModel[];
  model_names: Record<string, string>;   // 单模型显示名覆盖
  // key 只进 env，此三字段仅由 publicProvider() 在 GET 时生成（脱敏视图）
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
    isPrimary: true,
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
    isPrimary: false,
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

/** 读 provider 的 key：优先 process.env，兜底读 env 文件。
 *  modelscope（魔搭）特殊：若未单独配 API_PROVIDER_MODELSCOPE_KEY，
 *  兜底复用 LLM_CHAT_API_KEY（AI 助手在 .env 里已填的唯一一份魔搭 key），
 *  避免「前端 API 设置选魔搭走 /api/proxy」时因键名不同读到空 key 而上游 401。 */
export function readProviderKey(id: string): string {
  const envName = providerKeyEnv(id);
  const fromEnv = process.env[envName];
  if (fromEnv) return fromEnv;
  const fromFile = readEnvFileValue(envName);
  if (fromFile) return fromFile;
  // modelscope 兜底：复用 AI 助手 LLM 通道的 key
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
      // 旧版明文 key 迁移到 env（仅首次）
      if (typeof p.key === 'string' && p.key) {
        writeProviderKey(p.id, p.key);
      }
      delete p.key;
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
  // 协议白名单：apimart / openai，非法回退 openai
  const protocol: ProviderProtocol = input.protocol === 'apimart' ? 'apimart' : 'openai';
  const isPrimary = input.isPrimary === true;
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

  // key 处理：只在 PUT 时写 env（api_key 有值则写，clear_key 则清）
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
    image_mode: input.image_mode === 'async' ? 'async' : 'sync',
    enabled: input.enabled !== false,
    isPrimary,
    readonly,
    image_models,
    chat_models,
    video_models,
    model_names,
  };
}

// ── 查表 + primary 回退 ──
export function getProvider(id?: string | null): ApiProvider | undefined {
  const list = loadProviders();
  if (id) {
    const found = list.find((p) => p.id === id);
    if (found) return found;
  }
  return list.find((p) => p.isPrimary) || list[0];
}

// ── 脱敏（GET 列表时 key 打码，key 不回明文）──
function publicProvider(p: ApiProvider): ApiProvider {
  const envName = providerKeyEnv(p.id);
  const hasKey = !!readProviderKey(p.id);
  return { ...p, has_key: hasKey, key_preview: hasKey ? maskKey(readProviderKey(p.id)) : '', key_env: envName };
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

  // 唯一化 primary：最后设置的 isPrimary=true 胜出
  let primaryId: string | undefined;
  for (const item of incoming) {
    if (item.isPrimary) primaryId = item.id;
  }

  for (const item of incoming) {
    const prev = existing.find((e) => e.id === item.id);
    const norm = normalizeProvider(item, prev);
    if (!norm) continue;
    if (primaryId && norm.id !== primaryId) norm.isPrimary = false;
    else if (!primaryId && prev?.isPrimary) norm.isPrimary = true;
    merged.push(norm);
  }

  // 至少要有一个 primary
  if (!merged.some((p) => p.isPrimary) && merged.length > 0) {
    merged[0].isPrimary = true;
  }

  saveProviders(merged);
  return json(res, { providers: merged.map(publicProvider) });
}

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

  // 协议探测：auto 时先探 openai(/v1/models)，失败再探 apimart(/v1/gateway/health)
  const probe = async (path: string): Promise<{ ok: boolean; status: number }> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const r = await fetch(base + path, { method: 'GET', headers, signal: controller.signal });
      clearTimeout(timeout);
      return { ok: r.status >= 200 && r.status < 400, status: r.status };
    } catch {
      clearTimeout(timeout);
      return { ok: false, status: 0 };
    }
  };

  try {
    if (protocol === 'openai') {
      const r = await probe('/v1/models');
      return json(res, { ok: r.ok, status: r.status, protocol: 'openai', detectedProtocol: 'openai', url: base + '/v1/models' });
    }
    if (protocol === 'apimart') {
      const r = await probe('/health');
      return json(res, { ok: r.ok, status: r.status, protocol: 'apimart', detectedProtocol: 'apimart', url: base + '/health' });
    }
    // auto：依次探测
    const openai = await probe('/v1/models');
    if (openai.ok) {
      return json(res, { ok: true, status: openai.status, protocol: 'openai', detectedProtocol: 'openai', url: base + '/v1/models' });
    }
    const apimart = await probe('/health');
    if (apimart.ok) {
      return json(res, { ok: true, status: apimart.status, protocol: 'apimart', detectedProtocol: 'apimart', url: base + '/health' });
    }
    return json(res, {
      ok: false,
      status: openai.status || apimart.status,
      protocol: 'unknown',
      detectedProtocol: null,
      probes: { openai: openai.status, apimart: apimart.status },
      url: base,
    });
  } catch (e) {
    return json(res, { ok: false, error: (e as Error).message, protocol: 'unknown', detectedProtocol: null, url: base });
  }
}

export async function handleProviderFetchModels(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  const p = getProvider(id);
  if (!p) return sendError(res, `Provider not found: ${id}`, 404);

  const modelsUrl = p.base_url.replace(/\/$/, '') + '/v1/models';
  const headers: Record<string, string> = { Accept: 'application/json' };
  const key = readProviderKey(p.id);
  if (key) headers['Authorization'] = `Bearer ${key}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const fetchRes = await fetch(modelsUrl, { method: 'GET', headers, signal: controller.signal });
    clearTimeout(timeout);
    if (!fetchRes.ok) {
      return json(res, { ...emptyModels(), warning: `upstream ${fetchRes.status}, fell back to stored` });
    }
    const data = await fetchRes.json();
    const known = new Map<string, ProviderModel>();
    [...p.image_models, ...p.chat_models, ...p.video_models].forEach((m) => known.set(m.id, m));
    const rawModels: any[] = Array.isArray(data?.data) ? data.data : [];

    if (p.protocol === 'openai') {
      // OpenAI 兼容端点：/v1/models 无 category，按 id 关键字分类
      const ids = rawModels.map((m: any) => m.id).filter(Boolean);
      const classified = classifyOpenAIModels(ids, known);
      return json(res, {
        image_models: classified.image,
        chat_models: classified.chat,
        video_models: classified.video,
        modelCount: ids.length,
      });
    }

    // apimart（Lovart 网关）：/v1/models 返回 OpenAI 风格列表且每条带 category（image/video/chat）。
    // ⚠️ 忽略 category=chat：Lovart 的 chat 是「设计 Agent」纯中转，不是真正的文本聊天模型
    // （不支持 function calling，用户也不需要），若拉取会混进文本节点下拉。故 apimart 只收 image/video。
    const byCat: Record<string, ProviderModel[]> = { image: [], chat: [], video: [] };
    for (const m of rawModels) {
      if (typeof m?.id !== 'string' || !m.id) continue;
      const prev = known.get(m.id);
      const model: ProviderModel = prev || { id: m.id, label: m.id };
      const cat = String(m.category || '').toLowerCase();
      if (cat === 'image') byCat.image.push(model);
      else if (cat === 'video') byCat.video.push(model);
      // chat/text/未知分类：apimart 一律不收（见上注释）
    }
    return json(res, {
      image_models: byCat.image,
      chat_models: byCat.chat,
      video_models: byCat.video,
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
    if (p.image_request_mode) out.image_request_mode = p.image_request_mode;
    if (p.image_mode) out.image_mode = p.image_mode;
    if (typeof p.enabled === 'boolean') out.enabled = p.enabled;
    if (p.isPrimary) out.isPrimary = true;
    if (p.image_models?.length) out.image_models = p.image_models;
    if (p.chat_models?.length) out.chat_models = p.chat_models;
    if (p.video_models?.length) out.video_models = p.video_models;
    if (p.model_names && Object.keys(p.model_names).length) out.model_names = p.model_names;
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
 * 把 OpenAI /v1/models 返回的 id 列表按关键字分类（对齐契约 classify_upstream_model）。
 * video: video/seedance/kling/wan/minimax/veo/sora...
 * chat : chat/gpt/claude/gemini/llama/qwen/deepseek/o1/o3/o4/sonnet/opus/mini
 * image: 其余默认
 */
export function classifyOpenAIModels(ids: string[], known?: Map<string, ProviderModel>): {
  image: ProviderModel[];
  chat: ProviderModel[];
  video: ProviderModel[];
} {
  const VIDEO = /video|seedance|kling|wan[\d._-]|minimax|hunyuan-?video|veo|sora/i;
  const CHAT = /chat|^gpt|claude|gemini|llama|qwen|deepseek|\bo1|\bo3|\bo4|sonnet|opus|-mini|gpt-/i;
  const image: ProviderModel[] = [];
  const chat: ProviderModel[] = [];
  const video: ProviderModel[] = [];
  for (const id of ids) {
    const prev = known?.get(id);
    const model: ProviderModel = prev || { id, label: id };
    if (VIDEO.test(id)) video.push(model);
    else if (CHAT.test(id)) chat.push(model);
    else image.push(model);
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
 * 把前端传来的「原始 url」 + 可选 providerId 解析成真实转发目标。
 *
 * 约定（前端侧）：
 *   - 不传 providerId           → 行为不变（兼容现有调用，url 原样透传）
 *   - 传 providerId 且协议 apimart → url 原样透传（Lovart 走网关自身鉴权，不注入本地 key）
 *   - 传 providerId 且协议 openai → 前端 url 用相对形式 `openai://<path>`
 *                                   （如 openai://images/generations），此处拼成
 *                                   `${base_url}/v1/<path>`，并注入 Bearer key（从 env 读）
 */
export function resolveProviderTarget(rawUrl: string, providerId?: string | null): ResolvedTarget {
  if (!providerId) {
    return { url: rawUrl, protocol: 'apimart' };
  }
  const p = getProvider(providerId);
  if (!p) {
    return { url: rawUrl, protocol: 'apimart' };
  }
  if (p.protocol !== 'openai') {
    // apimart / 其它：原样透传，不注入本地 key
    return { url: rawUrl, protocol: p.protocol, providerId: p.id };
  }
  // openai 协议：把 openai://<path> 拼成 base/v1/<path>
  const m = rawUrl.match(/^openai:\/\/(.+)$/);
  const key = readProviderKey(p.id);
  if (!m) {
    // 已是完整 url，直接透传并注入 key
    return { url: rawUrl, authHeader: key ? `Bearer ${key}` : undefined, protocol: 'openai', providerId: p.id };
  }
  const sub = m[1].replace(/^\/+/, '');
  const full = p.base_url.replace(/\/$/, '') + '/v1/' + sub;
  return { url: full, authHeader: key ? `Bearer ${key}` : undefined, protocol: 'openai', providerId: p.id };
}
