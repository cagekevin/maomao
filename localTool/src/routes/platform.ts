/**
 * 平台路由 — /plugin/*、/api/workflow-apps/*
 * 本地模式返回空数据或功能待开发提示
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { json, sendError } from '../utils/helpers.js';

// ── GET /plugin/manifest.json ──
export async function handlePluginManifest(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  // 本地模式返回当前版本，不触发更新提示
  return json(res, {
    version: '1.3.5',
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
  });
}
