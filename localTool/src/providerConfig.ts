/**
 * providerConfig — provider 配置型存储（一个平台一个 JSON 文件）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么存在】relay 迁移删掉了旧 /api/providers 的动态多连接 CRUD（providers.json 单文件，历史残留）。
 * 按架构师理解改为「配置型」：每个平台一个 JSON 文件（localTool/config/providers/<id>.json），
 * 文件存「前端 Provider 契约字段 + 可选 relay 连接元数据」。本模块是 provider 配置的唯一读写入口
 * （禁散落 fs 读写）。
 *
 * 【真源】
 *  - config/providers/<id>.json = 用户可见可改的 Provider（模型清单/协议/模式/base_url）。
 *  - ai-relay BUILT_IN_PROVIDER_DEFINITIONS = 出厂平台候选 + 测连/拉模型的默认连接元数据（只读，不落盘）。
 *  - 读时合并：文件字段优先；缺的 relay 元数据用内置定义补；只有内置定义无文件 → 生成最小 Provider（enabled=false）。
 *  - key 不入配置文件：只进 .env `API_PROVIDER_{ID}_KEY`（对齐 ai-relay key 红线）。
 * ════════════════════════════════════════════════════════════════
 */

import fs from 'node:fs';
import path from 'node:path';
import { getDataDir } from './db/database.js';
import { getProviderDefinitions, getProviderDefinition } from './ai-relay/index.js';
import type { ProviderDefinition } from './ai-relay/types.js';

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
  'id', 'name', 'base_url', 'protocol', 'image_request_mode', 'image_mode',
  'chat_request_mode', 'enabled', 'primary', 'readonly',
  'image_models', 'chat_models', 'video_models', 'model_names', 'model_protocols',
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
    return fs.readdirSync(dir)
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
    const base = file && typeof file === 'object'
      ? file
      : def
        ? definitionToProvider(def)
        : null;
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

/** 一次迁移：若 config/providers/ 不存在且无任何文件，则从 api.config.json 拆分首拆。 */
export function migrateFromApiConfigFile(apiConfigPath: string): number {
  if (listProviderConfigFiles().length > 0) return 0;
  let written = 0;
  try {
    if (!fs.existsSync(apiConfigPath)) return 0;
    const raw = JSON.parse(fs.readFileSync(apiConfigPath, 'utf-8')) as { providers?: unknown[] };
    const providers = Array.isArray(raw.providers) ? raw.providers : [];
    for (const p of providers) {
      if (!p || typeof p !== 'object') continue;
      const prov = p as Record<string, unknown>;
      const id = typeof prov.id === 'string' ? prov.id : '';
      if (!id) continue;
      if (writeProviderConfigFile(id, prov)) written++;
    }
  } catch {
    // 迁移失败不阻塞服务
  }
  return written;
}
