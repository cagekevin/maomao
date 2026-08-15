/**
 * 平台路由 — /plugin/*、/api/workflow-apps/*、/public/platform/*
 * 本地模式返回静态兜底数据
 *
 * 重要定位：/public/platform/builtin 与 /public/platform/models 这两个路由
 * 是【自研替换官方 1mao 平台接口】的预备实现。
 * - 官方 1mao 是闭源外部服务（非自研），其平台接口由官方提供；
 * - 这两个路由由我们在 localTool 内自行实现，返回本地静态常量 BUILTIN_MODELS，
 *   目的是在自托管模式下替代官方 1mao 的对应能力，不依赖官方后端。
 * - 数据来源标注为 apimart-gateway Lovart 模型定义，仅作同步参考；
 *   实际返回不连任何远端（既不是 1mao，也不是 Lovart 实时拉取），纯本地兜底。
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { json, sendError } from '../utils/helpers.js';

// ── GET /plugin/manifest.json ──
export async function handlePluginManifest(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  // 本地模式返回当前版本，不触发更新提示
  return json(res, {
    version: '1.4.2',
    hasUpdate: false,
  });
}

// ── GET /api/workflow-apps/by-project/:projectId ──
export async function handleWorkflowAppsByProject(
  _req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  // 本地模式无工作流应用，返回 null
  return json(res, {
    success: true,
    data: null,
    _meta: { stub: true, message: '工作流应用市场功能后续补齐，当前仅支持本地项目工作流' },
  });
}

// ── 内置模型清单（来自 apimart-gateway Lovart 模型定义，main.py:65-101）──
// Lovart 新增模型时同步更新此处（改 model 时顺手改，保持两份一致）。
// 本地模式无远端中心服务，返回静态清单兜底，避免前端 404 后静默回退到空列表。

const BUILTIN_MODELS = {
  // 文生图模型（来自 main.py _IMAGE_RULES）
  image: [
    'gpt-image-2-low', 'gpt-image-2-medium',
    'gpt-image-2', 
    'nano-bn-pro', 'nano-bn-2',
  ],
  // 文生视频模型（来自 main.py _VIDEO_RULES，共 16 项）
  // 注：kling 与 kling-v3 在网关侧均映射到 generate_video_kling_v3，
  // 但两者都是官方别名，字段契约需保留，不能去重。
  video: [
    'seedance-2.0-fast', 'seedance-2', 
    'kling-v3-omni', 
  ],
  // 特惠视频与普通视频共享同一套 Lovart 模型
  discountVideo: [
    'seedance-2.0-fast', 'seedance-2', 
    'kling-v3-omni', 
  ],
  text: [],
  discountVideoSpecs: {} as Record<string, unknown>,
  power: {}, unit: {}, currency: {}, recommended: {}, descriptions: {},
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
// 【自研替换官方 1mao 平台接口】前端 fetchBuiltin（httpClient-BknZwXjG.js）拉取内置模型分类清单
// 期望格式: { success: true, data: { image:[], video:[], discountVideo:[], discountVideoSpecs:{}, ... } }
// 注意：返回本地静态常量，不连官方 1mao，也不实时连 Lovart/apimart-gateway。
export async function handleBuiltin(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  return json(res, { success: true, data: BUILTIN_MODELS });
}

// ── GET /public/platform/models ──
// 【自研替换官方 1mao 平台接口】前端 Xi()（httpClient-BknZwXjG.js）拉取模型系列映射
// 期望格式: { success: true, data: [{ name, seriesKey, seriesLabel }, ...] }
// 注意：返回本地静态常量，不连官方 1mao，也不实时连 Lovart/apimart-gateway。
export async function handleModels(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  return json(res, { success: true, data: BUILTIN_MODEL_SERIES });
}
