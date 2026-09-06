/**
 * 集中 ID 生成 —— 唯一入口，禁止散落 Math.random()。
 *
 * 所有需要生成 ID 的地方统一从这里取，格式：`{prefix}_{timestamp36}_{random36}`。
 * 足够短、可读、跨实例唯一；prefix 用于区分 ID 的领域语义（如 node/asset/preset）。
 *
 * 约定：
 *  - 业务代码一律 import { generateId } from './idGen.ts'
 *  - 禁止自己写 `Date.now() + Math.random()` 拼接
 */
export function generateId(prefix: string = 'id'): string {
  const safe = String(prefix ?? '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'id';
  return `${safe}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
