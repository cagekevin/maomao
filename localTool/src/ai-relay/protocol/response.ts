/**
 * protocol/response — 声明式模型协议响应的读取与预览。
 * 按点号路径（支持 * 通配、数字下标）从响应 JSON 抽取 URL / 文本 / Base64 / 错误 / 进度，
 * 屏蔽 __proto__ / prototype / constructor 等危险段。
 * 对应 AI-Canvas-tauri 的 modelProtocolResponse.ts。
 */

import { BLOCKED_PATH_SEGMENTS, isRecord } from './shared.js';
import type { ModelProtocol } from '../types.js';

export class ModelProtocolResponsePreviewEntry {
  id: string;
  label: string;
  path: string;
  matchCount: number;
  values: string[];
  constructor(id: string, label: string, path: string, matchCount: number, values: string[]) {
    this.id = id;
    this.label = label;
    this.path = path;
    this.matchCount = matchCount;
    this.values = values;
  }
}

export function readModelProtocolPathValues(value: unknown, path: string | undefined): unknown[] {
  if (!path) return [];
  let current: unknown[] = [value];
  for (const segment of path.split('.')) {
    if (!segment || BLOCKED_PATH_SEGMENTS.has(segment)) return [];
    const next: unknown[] = [];
    for (const item of current) {
      if (segment === '*' && Array.isArray(item)) {
        next.push(...item);
      } else if (Array.isArray(item) && /^\d+$/.test(segment)) {
        const indexed = item[Number(segment)];
        if (indexed !== undefined) next.push(indexed);
      } else if (isRecord(item) && Object.hasOwn(item, segment)) {
        next.push(item[segment]);
      }
    }
    current = next;
  }
  return current;
}

export function readModelProtocolFirstScalar(value: unknown, path: string | undefined): unknown {
  const match = readModelProtocolPathValues(value, path).find(
    (item) => item === null || ['string', 'number', 'boolean'].includes(typeof item),
  );
  return match;
}

export function readModelProtocolUrls(value: unknown, path: string | undefined): string[] {
  return readModelProtocolPathValues(value, path)
    .flatMap((item) => (Array.isArray(item) ? item : [item]))
    .filter((item) => typeof item === 'string' && item.trim().length > 0);
}

function formatResponsePreviewValue(value: unknown, redactBase64: boolean): string {
  if (redactBase64 && typeof value === 'string') {
    const base64Value =
      value.includes(',') && /^data:/i.test(value) ? value.slice(value.indexOf(',') + 1) : value;
    return `[Base64 ${base64Value.replace(/\s/g, '').length} 字符]`;
  }
  const serialized =
    typeof value === 'string' ? value : value === undefined ? '' : JSON.stringify(value);
  return serialized.length > 240 ? `${serialized.slice(0, 240)}...` : serialized;
}

export function previewNormalizedModelProtocolResponse(
  protocol: ModelProtocol,
  payload: unknown,
): ModelProtocolResponsePreviewEntry[] {
  const entries: ModelProtocolResponsePreviewEntry[] = [];
  const addEntry = (id: string, label: string, path: string | undefined, redactBase64 = false) => {
    if (!path) return;
    const matches = readModelProtocolPathValues(payload, path).flatMap((value) =>
      Array.isArray(value) ? value : [value],
    );
    entries.push(
      new ModelProtocolResponsePreviewEntry(
        id,
        label,
        path,
        matches.length,
        matches.map((value) => formatResponsePreviewValue(value, redactBase64)),
      ),
    );
  };

  if (protocol.mode === 'sync') {
    if (protocol.response.type !== 'json') return entries;
    addEntry('result-url', 'URL 结果', protocol.response.result?.urlPath);
    addEntry('result-text', '文本结果', protocol.response.result?.textPath);
    addEntry('result-base64', 'Base64 结果', protocol.response.result?.base64Path, true);
    addEntry('submit-error', '错误信息', protocol.response.errorPath);
    return entries;
  }

  addEntry('task-id', '任务 ID（提交响应）', protocol.response.taskIdPath);
  addEntry('submit-error', '提交错误', protocol.response.errorPath);
  addEntry('status', '任务状态（轮询响应）', protocol.poll?.response.statusPath);
  addEntry('poll-result-url', 'URL 结果', protocol.poll?.response.result.urlPath);
  addEntry('poll-result-text', '文本结果', protocol.poll?.response.result.textPath);
  addEntry('poll-result-base64', 'Base64 结果', protocol.poll?.response.result.base64Path, true);
  addEntry('poll-error', '任务错误', protocol.poll?.response.errorPath);
  addEntry('progress', '任务进度', protocol.poll?.response.progressPath);
  return entries;
}
