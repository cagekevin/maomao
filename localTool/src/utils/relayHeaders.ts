/**
 * 转发层共享头助手（唯一真相）。
 *
 * 2026-09-04 收口 relay-header-helpers-seam（见 Temp/deepening-relay-header-helpers-seam-20260904-2130.md）：
 * 原先 4 个路由文件各写各的——
 *  - tokenPrefix（official.ts / passthrough.ts 双定义，逐字重复）
 *  - 时间戳 new Date().toISOString().replace('T',' ').slice(0,19)（official/passthrough/files/localPatch 内联 ×10+）
 *  - hop-by-hop 头剥离（official.ts 窄集 5 项漏 proxy-authenticate/proxy-authorization/te/trailer/upgrade；
 *    passthrough.ts 宽集 9 项）——两处行为不一致，proxy-* 头可能泄漏上游代理凭据痕迹。
 * 收口后各 route 仅 import 本模块，头剥离统一走 canonical 宽集（含修复）。
 *
 * - maskToken:        Bearer 脱敏前 4 位（日志用，绝不打完整 Bearer）
 * - logTs:            时间戳 'YYYY-MM-DD HH:mm:ss'（日志前缀用）
 * - HOP_BY_HOP:       hop-by-hop 头集合（RFC 7230 §6.1，本跳连接不宜跨转发）
 * - stripHopByHop:    剥 hop-by-hop 响应头；dir='back' 额外剥 content-encoding（fetch 已自动解压）
 */

export const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade',
  'content-length',  // 由 fetch/undici 按实际 body 重算
  'host',            // 必须换成目标站的 host，否则部分网关会拒绝
]);

/** Bearer → 前 4 位（日志脱敏用） */
export function maskToken(auth: string | undefined): string {
  if (!auth) return 'none';
  const t = auth.replace(/^Bearer\s+/i, '');
  return t.length > 4 ? t.slice(0, 4) : t;
}

/** 时间戳（日志前缀用）：toISOString → 'YYYY-MM-DD HH:mm:ss' */
export function logTs(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * 剥 hop-by-hop 响应头（canonical 宽集）。
 * dir='back'（回传前端）：额外剥 content-encoding（fetch/undici 已自动解压，不能再声明）。
 * dir='forward'（发上游）：仅剥 HOP_BY_HOP（目前无调用方，保留方向语义）。
 */
export function stripHopByHop(headers: Headers, dir: 'forward' | 'back' = 'back'): Record<string, string> {
  const out: Record<string, string> = {};
  const skip = new Set(dir === 'back' ? [...HOP_BY_HOP, 'content-encoding'] : HOP_BY_HOP);
  headers.forEach((value, key) => {
    if (skip.has(key.toLowerCase())) return;
    out[key] = value;
  });
  return out;
}