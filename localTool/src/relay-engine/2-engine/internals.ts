/**
 * protocol/internals — 协议层的共享原语。
 *
 * 只放 schema（静态校验）与 executor（实际执行）都要用到的东西：
 * 模板变量正则、路径与请求头黑白名单、轮询默认值，以及几个无状态的校验小工具。
 * 属于模块内部实现，不通过包入口导出。
 */
import type { ModelProtocolAuthConfig } from '../4-types/protocol';
import { PROTOCOL_VARIABLE_NAMES } from './variables';

export const TEMPLATE_RE = /{{\s*([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_-]+)*)\s*}}/g;
export const FULL_TEMPLATE_RE = /^{{\s*([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_-]+)*)\s*}}$/;
/** 变量白名单由 modelProtocolVariables 总表派生，避免与字段映射表各自漂移。 */
export const ALLOWED_VARIABLE_ROOTS = PROTOCOL_VARIABLE_NAMES;
export const BLOCKED_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
export const BLOCKED_HEADER_NAMES = new Set([
  'authorization',
  'proxy-authorization',
  'host',
  'origin',
  'referer',
  'cookie',
  'set-cookie',
  'content-length',
  'connection',
  'transfer-encoding',
  'upgrade',
]);
export const HEADER_NAME_RE = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
export const OMIT_TEMPLATE_VALUE = Symbol('omit-template-value');
export const DEFAULT_RETRY_HTTP_STATUSES = [408, 429, 500, 502, 503, 504];
export const DEFAULT_MAX_QUERY_RETRIES = 3;
export const DEFAULT_MAX_RETRY_DELAY_MS = 60000;
export const MIME_TYPE_RE = /^[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*$/;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function validateRelativePath(path: unknown, label: string, errors: string[]): void {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    errors.push(`${label}必须是以 / 开头的同源相对路径`);
  }
}

export function validatePathExpression(path: unknown, label: string, errors: string[]): void {
  if (typeof path !== 'string' || !path.trim()) {
    errors.push(`${label}不能为空`);
    return;
  }
  if (path.split('.').some((segment) => BLOCKED_PATH_SEGMENTS.has(segment))) {
    errors.push(`${label}包含不允许的路径片段`);
  }
}

export function validateHeaderName(name: string, label: string, errors: string[]): void {
  if (!HEADER_NAME_RE.test(name)) {
    errors.push(`${label}“${name}”不是有效的 Header 名称`);
    return;
  }
  if (BLOCKED_HEADER_NAMES.has(name.toLowerCase())) {
    errors.push(`${label}不允许设置 ${name}`);
  }
}

export function validateAuthentication(value: unknown, errors: string[]): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    errors.push('鉴权配置无效');
    return;
  }
  if (!['bearer', 'header', 'query', 'none'].includes(String(value.type))) {
    errors.push('鉴权类型只支持 bearer、header、query 或 none');
    return;
  }
  if (value.prefix !== undefined && typeof value.prefix !== 'string') {
    errors.push('鉴权前缀必须是字符串');
  }
  if (value.type === 'header' || value.type === 'query') {
    if (typeof value.name !== 'string' || !value.name.trim()) {
      errors.push(`${value.type === 'header' ? 'Header' : 'Query'} 鉴权字段名不能为空`);
      return;
    }
    if (value.type === 'header') {
      validateHeaderName(value.name, '鉴权 ', errors);
    } else if (!HEADER_NAME_RE.test(value.name) || BLOCKED_PATH_SEGMENTS.has(value.name)) {
      errors.push(`Query 鉴权字段名“${value.name}”无效`);
    }
  }
}

export function validateRequestHeaders(value: unknown, label: string, errors: string[]): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    errors.push(`${label} headers 必须是 JSON 对象`);
    return;
  }
  for (const [name, headerValue] of Object.entries(value)) {
    validateHeaderName(name, `${label} `, errors);
    if (typeof headerValue !== 'string') {
      errors.push(`${label} Header ${name} 的值必须是字符串`);
    }
  }
}

export function visitTemplateStrings(value: unknown, visit: (value: string) => void): void {
  if (typeof value === 'string') {
    visit(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => visitTemplateStrings(item, visit));
    return;
  }
  if (isRecord(value)) {
    Object.values(value).forEach((item) => visitTemplateStrings(item, visit));
  }
}

export function validateTemplateVariables(
  request: Record<string, unknown>,
  allowSubmit: boolean,
  label: string,
  errors: string[],
): void {
  visitTemplateStrings(request, (template) => {
    for (const match of template.matchAll(TEMPLATE_RE)) {
      const variable = match[1];
      const root = variable.split('.')[0];
      if (!ALLOWED_VARIABLE_ROOTS.has(root) && !(allowSubmit && root === 'submit')) {
        errors.push(`${label}使用了不允许的变量 ${variable}`);
      }
    }
  });
}

export function resolveAuthentication(auth: ModelProtocolAuthConfig | undefined): ModelProtocolAuthConfig {
  return auth ?? { type: 'bearer' };
}
