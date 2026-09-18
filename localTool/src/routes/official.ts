/**
 * 子模块 — 转发目标 base 解析（passthrough 的转发目标决策点）
 * ------------------------------------------------------------
 * 本模块只保留 readOfficialBase：它是 passthrough catch-all 透传层用来
 * 决定「请求转发到哪个接入点」的唯一决策点。
 *
 * 原「官方权益接口转发层」（/api/user/info、/api/user/model-entitlements、
 * /api/agent/:id/vip-check、/api/official/entitlements/invalidate）已移除，
 * 不再有接官方入口的端点。
 *
 * 转发目标来源（**唯一**）：
 *   KV `active_api_endpoint`（过滤自指值，避免把请求转发回 localTool 自身）。
 *   无硬编码默认 —— base 必须由它显式提供，否则返回 undefined
 *   （passthrough 据此跳过转发，交回 404）。
 *
 * 【2026-09-18 收口 · TD-08-42 / TD-08-35】
 *   · 删 `x-official-base` 请求头（原「优先级 1」）：`src/**` **零生产者**（只有后端测试注入）
 *     ⇒ 它是幽灵入口；且任何本地进程都能借此**未鉴权地改转发目标**（SSRF 面）。
 *     这条优先级**从未在生产被走过**，删掉后判据只剩一条。
 *   · 删 KV 值的「旧纯 URL 字符串」兼容分支：写入侧唯一生产者（`providerStore.ts:499`）只写 JSON 对象。
 */

import { getDb, queryOne } from '../db/database.js';

/**
 * 读取转发目标 base。
 *
 * ⚠️ 自指过滤：KV `active_api_endpoint` 在前端「后端接入点」面板可被选成
 * 「本地引擎 http://127.0.0.1:18080」，对 localTool 来说这是「把请求转发给自己」
 * → 无限回环。故读 KV 时必须过滤掉指向 localTool 自身（127.0.0.1/localhost + 18080）的值。
 */
export async function readOfficialBase(): Promise<string | undefined> {
  try {
    const db = await getDb();
    const row = queryOne(db, 'SELECT value FROM kv WHERE key = ?', ['active_api_endpoint']);
    if (row && row.value) {
      const base = extractBaseFromEndpointValue(row.value);
      if (base && !isSelfBase(base)) return base;
    }
  } catch {
    /* 读 KV 失败回退默认 */
  }

  // 无硬编码默认 —— base 必须由 KV active_api_endpoint 显式提供，否则跳过转发。
  return undefined;
}

/**
 * 从 KV active_api_endpoint 的值里提取「可用的 base URL 字符串」。
 *
 * 值的形态由**唯一生产者**决定：`providerStore.ts:499` 写入的是对象
 * `{ providerId, name, base_url, protocol, updatedAt }`（经 `contentSetAsync` 序列化为 JSON）。
 * 故这里只认 JSON 对象、取 `base_url` —— 原「旧纯 URL 字符串」分支是**死兼容层**（TD-08-35 已删）。
 * 返回规范化后（去尾斜杠）的 base；解析不出合法 URL 返回空串。
 */
function extractBaseFromEndpointValue(value: string): string {
  try {
    const obj = JSON.parse(value);
    if (
      obj &&
      typeof obj === 'object' &&
      typeof obj.base_url === 'string' &&
      /^https?:\/\//i.test(obj.base_url)
    ) {
      return obj.base_url.replace(/\/$/, '');
    }
  } catch {
    /* 非 JSON，忽略 */
  }

  return '';
}

/**
 * 判断 base 是否指向 localTool 自身（本机 18080）。
 * 命中则必须忽略，否则转发层会把自己当目标 → 无限回环。
 */
function isSelfBase(base: string): boolean {
  try {
    const u = new URL(base);
    const host = u.hostname.toLowerCase();
    return (
      (host === '127.0.0.1' || host === 'localhost' || host === '::1') && String(u.port) === '18080'
    );
  } catch {
    return false;
  }
}
