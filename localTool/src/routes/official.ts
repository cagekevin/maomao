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
 * 转发目标来源优先级（与 passthrough 一致）：
 *   1. `x-official-base` 请求头（显式指定转发目标）；
 *   2. KV `active_api_endpoint`（过滤自指值，避免把请求转发回 localTool 自身）；
 *   3. 无硬编码默认 —— base 必须由上述二者之一显式提供，否则返回 undefined
 *      （passthrough 据此跳过转发，交回 404）。
 */

import type { IncomingMessage } from 'node:http';
import { getDb, queryOne } from '../db/database.js';

/**
 * 读取转发目标 base（优先级）：
 *   1. `x-official-base` 请求头（前端显式指定转发目标，最可控）；
 *   2. KV `active_api_endpoint`（保留「切换转发到备用接入点」能力，但过滤自指值）。
 *
 * ⚠️ 自指过滤：KV `active_api_endpoint` 在前端「后端接入点」面板可被选成
 * 「本地引擎 http://127.0.0.1:18080」，对 localTool 来说这是「把请求转发给自己」
 * → 无限回环。故读 KV 时必须过滤掉指向 localTool 自身（127.0.0.1/localhost + 18080）的值。
 */
export async function readOfficialBase(req: IncomingMessage): Promise<string | undefined> {
  // 优先级 1：请求头显式覆盖
  const headerBase = officialBaseHeader(req);
  if (headerBase && !isSelfBase(headerBase)) return headerBase;

  // 优先级 2：KV active_api_endpoint（过滤自指值，避免回环）
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

  // 优先级 3：无硬编码默认 —— base 必须由 x-official-base 头或 KV active_api_endpoint 显式提供。
  return undefined;
}

/**
 * 从 KV active_api_endpoint 的值里提取「可用的 base URL 字符串」。
 * 兼容两种写入格式：
 *  - 旧格式：纯 URL 字符串，如 `https://lgw.lovart.ai`。
 *  - 新格式：provider 配置 JSON，取其 `base_url` 字段。
 * 返回规范化后（去尾斜杠）的 base；解析不出合法 URL 返回空串。
 */
function extractBaseFromEndpointValue(value: string): string {
  let raw = value.trim();
  if (!raw) return '';
  raw = raw.replace(/^"|"$/g, '').trim();

  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/$/, '');

  try {
    const obj = JSON.parse(raw);
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

/** 解析 x-official-base 覆盖头（可选） */
function officialBaseHeader(req: IncomingMessage): string | undefined {
  const v = req.headers['x-official-base'];
  return typeof v === 'string' && v.trim() ? v.trim().replace(/\/$/, '') : undefined;
}
