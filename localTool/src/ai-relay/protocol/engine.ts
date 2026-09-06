/**
 * protocol/engine — 声明式模型协议解析与执行（统一入口）。
 * sync：text / binary / json（抽取 url/text/base64，可选同源下载）
 * async：提交拿 taskId → 轮询直到完成 / 失败。
 * 对应 AI-Canvas-tauri 的 modelProtocol.ts。
 */

import { corsSafeFetch } from '../httpTransport.js';
import { readModelProtocolFirstScalar, readModelProtocolUrls } from './response.js';
import {
  encodeBytesBase64,
  ensureSuccessfulRawResponse,
  fetchSameOriginResultUrls,
  normalizeBase64Result,
  readJsonResponse,
} from './http.js';
import { getModelProtocolPreset } from './presets.js';
import { pollResolvedModelProtocol, resolvePoll } from './poll.js';
import { buildModelProtocolRequest } from './request.js';
import {
  FOR_EACH_KEY,
  FOR_EACH_VARIABLE_ROOTS,
  FULL_TEMPLATE_RE,
  MIME_TYPE_RE,
  TEMPLATE_RE,
  isRecord,
} from './shared.js';
import { parseModelExecutionProtocol } from './validation.js';
import type {
  ModelProtocol,
  ModelProtocolExecuteResult,
  ModelProtocolProfile,
  ModelProtocolSubmitResult,
  ProtocolVariables,
  SubmitModelProtocolOptions,
} from '../types.js';

export function modelProtocolUsesVariable(source: string, ...variables: string[]): boolean {
  const requested = variables.filter(Boolean);
  if (requested.length === 0) return false;
  return [...source.matchAll(TEMPLATE_RE)].some((match) => {
    const templatePath = match[1];
    return requested.some(
      (variable) => templatePath === variable || templatePath.startsWith(`${variable}.`),
    );
  });
}

export function collectModelProtocolTemplatePaths(source: string): string[] {
  return [...source.matchAll(TEMPLATE_RE)].map((match) => match[1]);
}

export function collectModelProtocolForEachVariables(value: unknown): string[] {
  const found = new Set<string>();
  const visit = (item: unknown) => {
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    if (!isRecord(item)) return;
    const source = item[FOR_EACH_KEY];
    if (typeof source === 'string') {
      const path = FULL_TEMPLATE_RE.exec(source)?.[1];
      if (path && FOR_EACH_VARIABLE_ROOTS.has(path)) found.add(path);
    }
    Object.values(item).forEach(visit);
  };
  visit(value);
  return [...found];
}

export function resolveModelExecutionProfile(
  profile: ModelProtocolProfile | null | undefined,
): ModelProtocol | null {
  if (!profile) return null;
  if (profile.preset === 'custom') {
    if (!profile.protocol) throw new Error('自定义调用协议不能为空');
    return parseModelExecutionProtocol(profile.protocol);
  }
  return getModelProtocolPreset(profile.preset);
}

export async function submitModelProtocol(
  options: SubmitModelProtocolOptions,
): Promise<ModelProtocolSubmitResult> {
  const built = buildModelProtocolRequest(options);
  const protocol = built.protocol;
  const context: ProtocolVariables = { ...options.variables };
  const response = await corsSafeFetch(built.url, built.init);
  const responseConfig = protocol.response;

  if (protocol.mode === 'sync') {
    if (responseConfig.type === 'text') {
      await ensureSuccessfulRawResponse(response, '模型请求失败', responseConfig.errorPath);
      const text = await response.text();
      if (!text) throw new Error('模型响应中未找到文本结果');
      return { text };
    }
    if (responseConfig.type === 'binary') {
      await ensureSuccessfulRawResponse(response, '模型请求失败', responseConfig.errorPath);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength === 0) throw new Error('模型响应中未找到二进制结果');
      const responseMimeType = response.headers.get('Content-Type')?.split(';')[0]?.trim();
      const mimeType =
        responseMimeType && MIME_TYPE_RE.test(responseMimeType)
          ? responseMimeType
          : (responseConfig.result?.mimeType ?? 'application/octet-stream');
      return { urls: [`data:${mimeType};base64,${encodeBytesBase64(bytes)}`] };
    }
    const payload = await readJsonResponse(response, '模型请求失败', responseConfig.errorPath);
    const resultConfig = responseConfig.result;
    let urls = resultConfig?.urlPath ? readModelProtocolUrls(payload, resultConfig.urlPath) : [];
    if (resultConfig?.fetchUrl) {
      urls = await fetchSameOriginResultUrls(
        urls,
        options.baseUrl,
        protocol.auth,
        options.apiKey,
        resultConfig.mimeType,
        options.signal,
      );
    }
    const base64Urls = resultConfig?.base64Path
      ? readModelProtocolUrls(payload, resultConfig.base64Path).map((value) =>
          normalizeBase64Result(value, resultConfig.mimeType, resultConfig.base64Transform),
        )
      : [];
    const textValue = resultConfig?.textPath
      ? readModelProtocolFirstScalar(payload, resultConfig.textPath)
      : undefined;
    const text = textValue === undefined || textValue === null ? undefined : String(textValue);
    const mediaUrls = [...urls, ...base64Urls];
    if (mediaUrls.length === 0 && !text) throw new Error('模型响应中未找到配置的结果');
    return {
      ...(mediaUrls.length > 0 ? { urls: mediaUrls } : {}),
      ...(text ? { text } : {}),
    };
  }

  const payload = await readJsonResponse(response, '模型请求失败', responseConfig.errorPath);
  const taskIdValue = readModelProtocolFirstScalar(payload, responseConfig.taskIdPath);
  if (taskIdValue === undefined || taskIdValue === null || taskIdValue === '') {
    throw new Error(`模型提交响应中未找到任务 ID：${responseConfig.taskIdPath}`);
  }
  if (!protocol.poll) throw new Error('异步调用协议缺少轮询配置');
  const pollContext: ProtocolVariables = { ...context, submit: payload };
  return {
    taskId: String(taskIdValue),
    poll: resolvePoll(options.baseUrl, protocol.poll, protocol.auth, pollContext),
  };
}

export async function executeModelProtocol(
  options: SubmitModelProtocolOptions,
): Promise<ModelProtocolExecuteResult> {
  const submitted = await submitModelProtocol(options);
  if (submitted.urls) return { urls: submitted.urls };
  if (submitted.text) return { text: submitted.text };
  if (!submitted.poll) throw new Error('异步调用协议未生成轮询配置');
  return {
    ...(await pollResolvedModelProtocol(
      submitted.poll,
      options.apiKey,
      options.signal,
      options.baseUrl,
    )),
    taskId: submitted.taskId,
  };
}
