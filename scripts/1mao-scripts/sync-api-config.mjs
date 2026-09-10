#!/usr/bin/env node
/**
 * API 供应商 config 同步脚本
 * ------------------------------------------------------------
 * 用途：把出厂模板 `localTool/providers.default.json`（人/AI 可编辑）同步到 localTool 后端
 *       `/api/providers`（逐平台落盘 <数据目录>/providers/<id>.json，默认 ~/.maomao-localtool）。
 *
 * 用法（项目根执行）：
 *   node scripts/1mao-scripts/sync-api-config.mjs           同步（读取 providers.default.json）
 *   node scripts/1mao-scripts/sync-api-config.mjs --print   只打印将要合并的结果，不写后端（dry-run）
 *
 * 【单一真源】运行态真源 = config/providers/<id>.json（后端自动播种只补缺）。
 * 本脚本用于「显式把模板推给后端」的场景（模板改动后需要主动下发），正常使用无需运行。
 *
 * 合并规则（关键）：
 *   - 按 provider.id 匹配后端已有 provider。
 *   - 模板里该 provider「出现的字段」会覆盖后端值（name/base_url/protocol/
 *     image_request_mode/image_mode/enabled/primary）。
 *   - 模型清单（image_models/chat_models/video_models）为可选：模板里写了才覆盖，
 *     不写则保留后端现有（避免 fetch-models 拉到的完整模型被丢）。
 *   - API key 不在此文件也不在此脚本处理；key 只存 localTool/.env
 *     （统一命名 API_PROVIDER_{ID}_KEY；lovart 等按厂商目录 envKeys 声明）。
 *   - 同步后保证「至少一个 primary=true」，多主时取模板里最后一个 primary=true 胜出。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 本文件在 scripts/1mao-scripts/ 下 → 上溯两级到项目根
const ROOT = path.resolve(__dirname, '..', '..');
const CONFIG_FILE = path.join(ROOT, 'localTool', 'providers.default.json');
const API_BASE = process.env.LOCALTOOL_BASE || 'http://127.0.0.1:18080';

const DRY_RUN = process.argv.includes('--print') || process.argv.includes('--dry-run');

// ── 读取 base config ──
function loadBaseConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error(`未找到 base config：${CONFIG_FILE}`);
    process.exit(1);
  }
  const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  if (!Array.isArray(cfg.providers)) {
    console.error('api.config.json 缺少 providers[] 数组');
    process.exit(1);
  }
  return cfg.providers;
}

// ── 请求封装 ──
async function api(pathname, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const msg = data?.detail || data?.error || data?.message || `HTTP ${res.status}`;
    throw new Error(`GET/PUT ${pathname} 失败: ${msg}`);
  }
  return data;
}

// ── 归一化模型数组（对齐后端 normalizeProvider 的 normModel）──
function normModels(arr) {
  if (!Array.isArray(arr)) return null;
  const out = [];
  for (const m of arr) {
    if (!m || typeof m.id !== 'string' || !m.id) continue;
    out.push({
      id: m.id,
      label: typeof m.label === 'string' ? m.label : m.id,
      streaming: !!m.streaming,
      promptOnly: !!m.promptOnly,
    });
  }
  return out;
}

// ── 合并：base config → 后端现有 ──
function mergeConfig(baseList, existingList) {
  const byId = new Map(existingList.map((p) => [p.id, { ...p }]));
  // primary 唯一化：取模板里最后一个 primary=true 胜出（字段名与后端契约一致）
  let primaryId;
  for (const bp of baseList) {
    if (bp.primary) primaryId = bp.id;
  }

  for (const bp of baseList) {
    if (!bp || typeof bp.id !== 'string' || !bp.id.trim()) continue;
    const id = bp.id.trim();
    const prev = byId.get(id);
    const merged = { ...(prev || {}) };

    // 覆盖核心字段（仅当 base config 里提供了该字段）
    const scalarFields = [
      'name',
      'base_url',
      'protocol',
      'image_request_mode',
      'image_mode',
      'enabled',
    ];
    for (const f of scalarFields) {
      if (bp[f] !== undefined) merged[f] = bp[f];
    }
    // primary：未指定主供应商时保留后端原有；否则按 primaryId 设置
    merged.primary = primaryId ? id === primaryId : prev ? !!prev.primary : false;

    // 模型：base config 里写了才覆盖
    const img = normModels(bp.image_models);
    const chat = normModels(bp.chat_models);
    const vid = normModels(bp.video_models);
    if (img) merged.image_models = img;
    if (chat) merged.chat_models = chat;
    if (vid) merged.video_models = vid;

    // 兜底默认
    merged.protocol = merged.protocol === 'apimart' ? 'apimart' : 'openai';
    merged.image_request_mode = merged.image_request_mode || 'openai';
    merged.image_mode = merged.image_mode === 'async' ? 'async' : 'sync';
    merged.enabled = merged.enabled !== false;
    merged.image_models = merged.image_models || [];
    merged.chat_models = merged.chat_models || [];
    merged.video_models = merged.video_models || [];
    merged.model_names = merged.model_names || {};

    // 新增 provider 需要默认模型数组
    if (!prev) {
      merged.image_models = img || [];
      merged.chat_models = chat || [];
      merged.video_models = vid || [];
    }

    byId.set(id, merged);
  }

  const mergedList = [...byId.values()];
  // 至少一个 primary
  if (!mergedList.some((p) => p.primary) && mergedList.length > 0) {
    mergedList[0].primary = true;
  }
  return mergedList;
}

// ── 主流程 ──
async function main() {
  const base = loadBaseConfig();
  const existing = (await api('/api/providers')).providers || [];
  const merged = mergeConfig(base, existing);

  // 只保留后端 /api/providers 认识的字段，剔除脱敏字段（has_key/key_preview/key_env）
  const clean = merged.map(({ has_key, key_preview, key_env, ...p }) => p);

  console.log(`API base: ${API_BASE}`);
  console.log(
    `base config providers: ${base.length} | 后端现有: ${existing.length} | 合并后: ${clean.length}`,
  );
  for (const p of clean) {
    console.log(
      `  - ${p.id} [${p.protocol}] enabled=${p.enabled} primary=${!!p.primary} img=${p.image_models?.length ?? 0} chat=${p.chat_models?.length ?? 0} vid=${p.video_models?.length ?? 0} url=${p.base_url}`,
    );
  }

  if (DRY_RUN) {
    console.log('\n[dry-run] 未写入后端。');
    return;
  }

  const res = await api('/api/providers', { method: 'PUT', body: { providers: clean } });
  console.log(`\n同步完成，后端返回 ${(res.providers || []).length} 个 provider。`);
}

main().catch((e) => {
  console.error('同步失败：', e.message);
  process.exit(1);
});
