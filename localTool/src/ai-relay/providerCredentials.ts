/**
 * providerCredentials — 厂商凭证解析与鉴权构造的唯一入口。
 *
 * 【为什么存在】旧实现有两处「猜」：
 *  1. 读 key 靠拼 `API_PROVIDER_{ID}_KEY`，而 lovart 的凭证实际叫
 *     `LOVART_ACCESS_KEY`/`LOVART_SECRET_KEY` → 永远读空 → 测试连接恒失败。
 *  2. 出站一律用 Bearer，而 lovart 走 HMAC → 即使读到 key 也会被上游拒绝。
 * 两者叠加造成「测试连失败但实际能用」。
 *
 * 【修复原则】凭证名与鉴权方式都由厂商目录（ProviderDefinition）声明，不靠猜：
 *  - `envKeys`：凭证在 .env 中的变量名，首项为主凭证，其余为附加凭证。
 *  - `auth`：出站鉴权方式；未声明时按 `authType` 推导（oauth / Bearer）。
 *
 * 本模块是「厂商定义 → 可发出请求的凭证」的纯函数层，不做 IO。
 */
import type { AuthConfig, ProviderDefinition } from './types.js';

/** 无人为约定时的兜底凭证变量名（与 providerConfigStore/env 命名保持一致）。 */
export function defaultEnvKey(providerId: string): string {
  return `API_PROVIDER_${providerId.toUpperCase()}_KEY`;
}

/** 某厂商声明的 .env 凭证变量名列表（未声明则回落统一命名），保持声明顺序。 */
export function envKeysFor(providerId: string, definition?: ProviderDefinition): string[] {
  const declared = definition?.envKeys?.filter((k) => typeof k === 'string' && k.trim());
  if (declared && declared.length > 0) return declared;
  return [defaultEnvKey(providerId)];
}

/** 从 process.env 按声明顺序取值（空串视为未配置）。返回顺序与 envKeysFor 一致。 */
export function readEnvValues(providerId: string, definition?: ProviderDefinition): string[] {
  return envKeysFor(providerId, definition).map((key) => (process.env[key] || '').trim());
}

/**
 * 解析某厂商的出站鉴权。返回 `undefined` 表示「无鉴权头」（调用方应保持原样）。
 *
 * - 声明了 `auth`：按声明构造。hmac 需要 accessKey/secretKey 两个凭证；
 *   凭证缺失返回 undefined 之外的空头（由调用方按 hasKey 判定报错）。
 * - 未声明：oauth → `{type:'oauth', token}`；其余 → Bearer（apiKey 非空才给头）。
 */
export function resolveAuth(
  providerId: string,
  definition?: ProviderDefinition,
): { auth?: AuthConfig; apiKey?: string; missing: boolean } {
  const values = readEnvValues(providerId, definition);
  const primary = values[0] || '';
  const declared = definition?.auth;

  // 1) 显式声明的鉴权方式优先
  if (declared) {
    if (declared.type === 'hmac') {
      const accessKey = declared.accessKey || values[0] || '';
      // 声明顺序约定：首项 = accessKey，次项 = secretKey
      const secretKey = declared.secretKey || values[1] || '';
      const missing = !accessKey || !secretKey;
      return {
        auth: { type: 'hmac', accessKey, secretKey },
        apiKey: accessKey,
        missing,
      };
    }
    if (declared.type === 'oauth') {
      const token = declared.token || primary;
      return { auth: { ...declared, token }, apiKey: token, missing: !token };
    }
    // header / query / none / bearer：用声明 + 主凭证
    const missing = declared.type !== 'none' && !primary;
    return { auth: { ...declared }, apiKey: primary, missing };
  }

  // 2) 未声明：按 authType 推导
  if (definition?.authType === 'oauth') {
    return { auth: { type: 'oauth', token: primary }, apiKey: primary, missing: !primary };
  }
  return { auth: undefined, apiKey: primary || undefined, missing: !primary };
}

/** 该厂商是否为 HMAC 鉴权（用于需要代理/特殊传输的分支判断）。 */
export function isHmacProvider(definition?: ProviderDefinition): boolean {
  return definition?.auth?.type === 'hmac';
}
