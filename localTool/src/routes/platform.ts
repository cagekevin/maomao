/**
 * 平台路由 — /plugin/*、/api/workflow-apps/*、/public/platform/*
 * 本地模式返回静态兜底数据
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { json } from '../utils/helpers.js';
import { VERSION } from '../version.js';

// ── GET /plugin/manifest.json ──
export async function handlePluginManifest(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  // 本地模式返回当前版本，不触发更新提示
  return json(res, { code: 0, data: { version: VERSION, hasUpdate: false } });
}

// ── GET /api/workflow-apps/by-project/:projectId ──
export async function handleWorkflowAppsByProject(
  _req: IncomingMessage,
  res: ServerResponse,
  _url: URL,
): Promise<void> {
  // 本地模式无工作流应用，返回 null
  return json(res, {
    success: true,
    data: null,
    _meta: { stub: true, message: '工作流应用市场功能后续补齐，当前仅支持本地项目工作流' },
  });
}

// ── 内置模型清单（原同步自 apimart-gateway Lovart 模型定义，网关已退役，现本地维护）──
// Lovart 新增模型时在此追加（改 model 时顺手改）。
// 本地模式无远端中心服务，返回静态清单兜底，避免前端 404 后静默回退到空列表。

const BUILTIN_MODELS = {
  // 文生图模型（来自 main.py _IMAGE_RULES）
  image: ['gpt-image-2-low', 'gpt-image-2-medium', 'gpt-image-2', 'nano-bn-pro', 'nano-bn-2'],
  // 文生视频模型（来自 main.py _VIDEO_RULES，共 16 项）
  // 注：kling 与 kling-v3 在网关侧均映射到 generate_video_kling_v3，
  // 但两者都是官方别名，字段契约需保留，不能去重。
  video: ['seedance-2.0-fast', 'seedance-2', 'kling-v3-omni'],
  // 特惠视频与普通视频共享同一套 Lovart 模型
  discountVideo: ['seedance-2.0-fast', 'seedance-2', 'kling-v3-omni'],
  text: [],
  discountVideoSpecs: {} as Record<string, unknown>,
  power: {},
  unit: {},
  currency: {},
  recommended: {},
  descriptions: {},
};

const BUILTIN_MODEL_SERIES: Array<{ name: string; seriesKey: string; seriesLabel: string }> = [
  { name: 'seedance-2.0-fast', seriesKey: 'seedance', seriesLabel: 'Seedance 系列' },
  { name: 'seedance-2', seriesKey: 'seedance', seriesLabel: 'Seedance 系列' },
  { name: 'kling-v3-omni', seriesKey: 'kling', seriesLabel: 'Kling 系列' },
  { name: 'gpt-image-2-low', seriesKey: 'gpt-image', seriesLabel: 'GPT Image 系列' },
  { name: 'gpt-image-2-medium', seriesKey: 'gpt-image', seriesLabel: 'GPT Image 系列' },
  { name: 'gpt-image-2', seriesKey: 'gpt-image', seriesLabel: 'GPT Image 系列' },
  { name: 'nano-bn-pro', seriesKey: 'nano-bn', seriesLabel: 'Nano Banana 系列' },
  { name: 'nano-bn-2', seriesKey: 'nano-bn', seriesLabel: 'Nano Banana 系列' },
];

// ── GET /public/platform/builtin ──
// 期望格式: { success: true, data: { image:[], video:[], discountVideo:[], discountVideoSpecs:{}, ... } }
export async function handleBuiltin(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  return json(res, { success: true, data: BUILTIN_MODELS });
}

// ── GET /public/platform/models ──
// 期望格式: { success: true, data: [{ name, seriesKey, seriesLabel }, ...] }
export async function handleModels(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  return json(res, { success: true, data: BUILTIN_MODEL_SERIES });
}
