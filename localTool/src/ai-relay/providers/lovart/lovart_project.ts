/**
 * lovart_project — 按 accessKey 缓存默认 project（单例）+ 失效自愈。
 *
 * 不每调用各建各的（§6.6）：同 accessKey 全局唯一键，仅建一次；
 * 缓存命中后做一次 validate，失效则清缓存并重建（B3 自愈断言）。
 */

import {
  createLovartProject,
  validateLovartProject,
  type LovartClientDeps,
} from './lovart_client.js';

const projectCache = new Map<string, string>();

export async function ensureLovartProject(deps: LovartClientDeps): Promise<string> {
  const key = deps.auth?.accessKey ?? '';
  const cached = projectCache.get(key);
  if (cached) {
    // 失效自愈：validate 失败则清缓存重建
    if (await validateLovartProject(deps, cached)) return cached;
    projectCache.delete(key);
  }
  const projectId = await createLovartProject(deps);
  if (!projectId) throw new Error('Lovart 创建 project 失败：未返回 project_id');
  projectCache.set(key, projectId);
  return projectId;
}
