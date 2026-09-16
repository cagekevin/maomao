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

/**
 * 碰撞安全 UUID v4（`crypto.randomUUID`，老环境回退手写 v4 位运算）。
 *
 * 【为什么单列一个变体，而不并入 generateId（TD-18-6 · 2026-09-17）】
 *   `generateId` 是 `ts36 + Math.random().toString(36).slice(2,8)` —— 时间戳毫秒级、
 *   随机段仅 36^6 ≈ 2.2e9 且取自 `Math.random()`（非密码学随机）。**同一毫秒内并发调用**
 *   存在可观测碰撞概率：Agent 批量并发建组（`groupNodes`）、剪辑器批量插入片段（`split/duplicate/paste`）
 *   都会在同一 tick 内连发多次，故这些场景需要**无碰撞**来源。
 *   两个变体并存不是「第二份」：`generateId` 保人类可读领域语义（`node_xxx` / `asset_xxx`），
 *   `generateUUID` 保并发唯一 —— 是**同一入口下的两种策略**，都住在 idGen 唯一入口内。
 *
 * 收口（TD-18-6）：此前 `videoEditor/utils/id.ts` 与 `groupNodes.ts` 各手写一份同逻辑 UUID，
 * 现统一从本文件取；调用方自带前缀（如 `group-${generateUUID()}`）。
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0'));
  return (
    hex.slice(0, 4).join('') +
    '-' +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10, 16).join('')
  );
}
