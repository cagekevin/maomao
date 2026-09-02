/**
 * protocol/schema — 协议「是什么」。
 *
 * 回答三个问题：一段 JSON 是不是合法的调用协议（validate）、
 * 老版本 v1 协议怎么升到 v2（upgrade）、内置预设长什么样（preset）。
 * 全部是纯函数，不产生任何网络请求。
 */
import type { GeneralModelCategory } from '../4-types/connection';
import type {
  ModelExecutionProfile,
  ModelProtocolPresetId,
  ModelProtocolRequestTemplate,
  NormalizedModelExecutionProtocol,
} from '../4-types/protocol';
import {
  MIME_TYPE_RE,
  isRecord,
  validateAuthentication,
  validatePathExpression,
  validateRelativePath,
  validateRequestHeaders,
  validateTemplateVariables,
} from './internals';

/** 判断序列化协议中是否引用了指定的受信模板变量。 */
export function modelProtocolUsesVariable(source: string, ...variables: string[]): boolean {
  return variables.some((variable) => new RegExp(`\\{\\{\\s*${variable}\\s*\\}\\}`).test(source));
}

const OPENAI_CHAT_PROTOCOL: NormalizedModelExecutionProtocol = {
  version: 2,
  mode: 'sync',
  streamFormat: 'openai-sse',
  submit: {
    method: 'POST',
    path: '/chat/completions',
    body: {
      model: '{{model}}',
      messages: '{{messages}}',
      stream: '{{stream}}',
      tools: '{{tools}}',
      tool_choice: '{{toolChoice}}',
    },
  },
  response: {
    type: 'json',
    result: { textPath: 'choices.0.message.content' },
    errorPath: 'error.message',
  },
};

const OPENAI_IMAGE_PROTOCOL: NormalizedModelExecutionProtocol = {
  version: 2,
  mode: 'sync',
  submit: {
    method: 'POST',
    path: '/images/generations',
    body: {
      model: '{{model}}',
      prompt: '{{prompt}}',
      size: '{{size}}',
      extra_body: { response_format: 'url' },
    },
  },
  response: {
    type: 'json',
    result: { urlPath: 'data.*.url' },
    errorPath: 'error.message',
  },
};

const AGNES_VIDEO_PROTOCOL: NormalizedModelExecutionProtocol = {
  version: 2,
  mode: 'async',
  submit: {
    method: 'POST',
    path: '/videos',
    body: {
      model: '{{model}}',
      prompt: '{{prompt}}',
      height: 768,
      width: 1152,
      num_frames: '{{frames8n1}}',
      frame_rate: '{{fps}}',
    },
  },
  response: {
    type: 'json',
    taskIdPath: 'video_id',
  },
  poll: {
    method: 'GET',
    path: '/agnesapi',
    pathMode: 'origin',
    query: { video_id: '{{submit.video_id}}' },
    response: {
      statusPath: 'status',
      successValues: ['completed'],
      failureValues: ['failed', 'error'],
      result: { urlPath: 'url', mimeType: 'video/mp4' },
      errorPath: 'error',
      progressPath: 'progress',
    },
    intervalMs: 10000,
  },
};

function cloneProtocol(protocol: NormalizedModelExecutionProtocol): NormalizedModelExecutionProtocol {
  return structuredClone(protocol);
}

export function getModelProtocolPreset(
  preset: Exclude<ModelProtocolPresetId, 'custom'>,
): NormalizedModelExecutionProtocol {
  if (preset === 'openai-chat') return cloneProtocol(OPENAI_CHAT_PROTOCOL);
  if (preset === 'agnes-video') return cloneProtocol(AGNES_VIDEO_PROTOCOL);
  return cloneProtocol(OPENAI_IMAGE_PROTOCOL);
}

/** 将帧数收敛到 Agnes 等模型要求的 8 * n + 1，尽量贴近用户原始选择。 */
export function normalizeFrames8n1(value: number): number {
  const finiteValue = Number.isFinite(value) ? value : 121;
  const multiplier = Math.max(1, Math.round((Math.max(9, finiteValue) - 1) / 8));
  return multiplier * 8 + 1;
}

export function resolveModelExecutionProfile(
  profile: ModelExecutionProfile | undefined,
): NormalizedModelExecutionProtocol | null {
  if (!profile) return null;
  if (profile.preset === 'custom') {
    if (!profile.protocol) throw new Error('自定义调用协议不能为空');
    return parseModelExecutionProtocol(profile.protocol);
  }
  return getModelProtocolPreset(profile.preset);
}

export function getDefaultCustomProtocol(category: GeneralModelCategory): NormalizedModelExecutionProtocol {
  if (category === 'text') return getModelProtocolPreset('openai-chat');
  if (category === 'image') return getModelProtocolPreset('openai-image');
  return {
    version: 2,
    mode: 'async',
    submit: {
      method: 'POST',
      path: category === 'video' ? '/videos/generations' : '/audio/generations',
      body: { model: '{{model}}', prompt: '{{prompt}}' },
    },
    response: {
      type: 'json',
      taskIdPath: 'task_id',
    },
    poll: {
      method: 'GET',
      path: '/tasks/{{submit.task_id}}',
      response: {
        statusPath: 'status',
        successValues: ['completed'],
        failureValues: ['failed', 'error'],
        result: { urlPath: 'url' },
        errorPath: 'error.message',
      },
      intervalMs: 3000,
    },
  };
}

function validateRequest(
  request: unknown,
  label: string,
  allowSubmit: boolean,
  errors: string[],
): request is ModelProtocolRequestTemplate {
  if (!isRecord(request)) {
    errors.push(`${label}配置无效`);
    return false;
  }
  if (request.method !== 'GET' && request.method !== 'POST') {
    errors.push(`${label} method 只支持 GET 或 POST`);
  }
  validateRelativePath(request.path, `${label} path`, errors);
  if (request.pathMode !== undefined && request.pathMode !== 'append' && request.pathMode !== 'origin') {
    errors.push(`${label} pathMode 只支持 append 或 origin`);
  }
  if (
    request.bodyEncoding !== undefined
    && !['json', 'form-urlencoded', 'multipart'].includes(String(request.bodyEncoding))
  ) {
    errors.push('请求体编码只支持 json、form-urlencoded 或 multipart');
  }
  if (
    (request.bodyEncoding === 'form-urlencoded' || request.bodyEncoding === 'multipart')
    && request.body !== undefined
    && !isRecord(request.body)
  ) {
    errors.push(`${label}使用 ${request.bodyEncoding} 时请求体必须是 JSON 对象`);
  }
  validateRequestHeaders(request.headers, label, errors);
  validateTemplateVariables(request, allowSubmit, label, errors);
  return true;
}

function validatePollRetryConfig(value: unknown, errors: string[]): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    errors.push('轮询重试配置无效');
    return;
  }
  if (
    value.httpStatuses !== undefined
    && (!Array.isArray(value.httpStatuses)
      || value.httpStatuses.some((status) => !Number.isInteger(status) || status < 100 || status > 599))
  ) {
    errors.push('重试 HTTP 状态码必须是 100 到 599 的整数');
  }
  if (
    value.maxRetries !== undefined
    && (!Number.isInteger(value.maxRetries) || Number(value.maxRetries) < 0 || Number(value.maxRetries) > 10)
  ) {
    errors.push('连续错误重试次数必须在 0 到 10 之间');
  }
  if (
    value.backoff !== undefined
    && !['fixed', 'linear', 'exponential'].includes(String(value.backoff))
  ) {
    errors.push('重试退避策略只支持 fixed、linear 或 exponential');
  }
  if (
    value.maxDelayMs !== undefined
    && (!Number.isInteger(value.maxDelayMs)
      || Number(value.maxDelayMs) < 1000
      || Number(value.maxDelayMs) > 300000)
  ) {
    errors.push('最大重试间隔必须在 1000 到 300000 毫秒之间');
  }
  if (value.honorRetryAfter !== undefined && typeof value.honorRetryAfter !== 'boolean') {
    errors.push('Retry-After 开关必须是布尔值');
  }
  if (value.retryNetworkErrors !== undefined && typeof value.retryNetworkErrors !== 'boolean') {
    errors.push('网络错误重试开关必须是布尔值');
  }
}

function withoutUndefined(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}

function upgradeLegacyProtocolValue(value: Record<string, unknown>): Record<string, unknown> {
  const upgraded = structuredClone(value);
  upgraded.version = 2;
  upgraded.response = withoutUndefined({
    type: value.responseType ?? 'json',
    taskIdPath: value.mode === 'async' ? value.taskIdPath : undefined,
    result: value.mode === 'sync'
      ? withoutUndefined({
          urlPath: value.resultUrlPath,
          textPath: value.resultTextPath,
          base64Path: value.resultBase64Path,
          mimeType: value.resultMimeType,
        })
      : undefined,
    errorPath: value.errorPath,
  });
  delete upgraded.responseType;
  delete upgraded.resultUrlPath;
  delete upgraded.resultTextPath;
  delete upgraded.resultBase64Path;
  delete upgraded.resultMimeType;
  delete upgraded.errorPath;
  delete upgraded.taskIdPath;

  if (isRecord(value.poll)) {
    const poll = structuredClone(value.poll);
    poll.response = withoutUndefined({
      statusPath: value.poll.statusPath,
      successValues: value.poll.successValues,
      failureValues: value.poll.failureValues,
      result: withoutUndefined({
        urlPath: value.poll.resultUrlPath,
        textPath: value.poll.resultTextPath,
        base64Path: value.poll.resultBase64Path,
        mimeType: value.poll.resultMimeType,
      }),
      errorPath: value.poll.errorPath,
      progressPath: value.poll.progressPath,
    });
    delete poll.statusPath;
    delete poll.successValues;
    delete poll.failureValues;
    delete poll.resultUrlPath;
    delete poll.resultTextPath;
    delete poll.resultBase64Path;
    delete poll.resultMimeType;
    delete poll.errorPath;
    delete poll.progressPath;
    upgraded.poll = poll;
  }
  return upgraded;
}

function validateResultConfig(
  value: unknown,
  label: string,
  requirePath: boolean,
  errors: string[],
): void {
  if (!isRecord(value)) {
    errors.push(`${label}配置无效`);
    return;
  }
  if (requirePath && value.urlPath === undefined && value.textPath === undefined && value.base64Path === undefined) {
    errors.push(`${label}必须配置 URL、文本或 Base64 结果路径`);
  }
  if (value.urlPath !== undefined) validatePathExpression(value.urlPath, `${label} URL 路径`, errors);
  if (value.textPath !== undefined) validatePathExpression(value.textPath, `${label}文本路径`, errors);
  if (value.base64Path !== undefined) {
    validatePathExpression(value.base64Path, `${label} Base64 路径`, errors);
    if (typeof value.mimeType !== 'string' || !MIME_TYPE_RE.test(value.mimeType)) {
      errors.push(label.startsWith('轮询')
        ? '轮询 Base64 结果必须配置 MIME 类型'
        : 'Base64 结果必须配置 MIME 类型');
    }
  }
  if (
    value.mimeType !== undefined
    && (typeof value.mimeType !== 'string' || !MIME_TYPE_RE.test(value.mimeType))
  ) {
    errors.push(label.startsWith('轮询') ? '轮询结果 MIME 类型无效' : '结果 MIME 类型无效');
  }
  if (value.fetchUrl !== undefined && typeof value.fetchUrl !== 'boolean') {
    errors.push(`${label}同源结果下载开关必须是布尔值`);
  }
  if (value.fetchUrl === true && value.urlPath === undefined) {
    errors.push(`${label}启用同源结果下载时必须配置 URL 路径`);
  }
  if (value.base64Transform !== undefined) {
    if (!isRecord(value.base64Transform) || value.base64Transform.type !== 'pcm-s16le-to-wav') {
      errors.push(`${label}Base64 转换只支持 pcm-s16le-to-wav`);
    } else {
      const sampleRate = value.base64Transform.sampleRate;
      const channels = value.base64Transform.channels ?? 1;
      if (!Number.isInteger(sampleRate) || Number(sampleRate) < 8000 || Number(sampleRate) > 384000) {
        errors.push(`${label}PCM 采样率必须是 8000 到 384000 的整数`);
      }
      if (!Number.isInteger(channels) || Number(channels) < 1 || Number(channels) > 8) {
        errors.push(`${label}PCM 声道数必须是 1 到 8 的整数`);
      }
      if (value.base64Path === undefined) {
        errors.push(`${label}配置 PCM 转换时必须提供 Base64 路径`);
      }
      if (value.mimeType !== 'audio/wav') {
        errors.push(`${label}PCM 转 WAV 的 MIME 类型必须是 audio/wav`);
      }
    }
  }
}

export function validateModelExecutionProtocol(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ['调用协议必须是 JSON 对象'];
  if (value.version !== 1 && value.version !== 2) {
    errors.push('调用协议 version 只支持 1 或 2');
    return errors;
  }
  if (
    value.version === 2
    && ['responseType', 'resultUrlPath', 'resultTextPath', 'resultBase64Path', 'resultMimeType', 'errorPath', 'taskIdPath']
      .some((key) => Object.hasOwn(value, key))
  ) {
    errors.push('version 2 响应字段必须配置在 response 中');
  }
  if (
    value.version === 2
    && isRecord(value.poll)
    && ['statusPath', 'successValues', 'failureValues', 'resultUrlPath', 'resultTextPath', 'resultBase64Path', 'resultMimeType', 'errorPath', 'progressPath']
      .some((key) => Object.hasOwn(value.poll as object, key))
  ) {
    errors.push('version 2 轮询响应字段必须配置在 poll.response 中');
  }
  const protocol = value.version === 1 ? upgradeLegacyProtocolValue(value) : value;
  if (protocol.mode !== 'sync' && protocol.mode !== 'async') {
    errors.push('调用协议 mode 只支持 sync 或 async');
  }
  validateAuthentication(protocol.auth, errors);
  if (protocol.streamFormat !== undefined && protocol.streamFormat !== 'openai-sse') {
    errors.push('流式响应格式只支持 openai-sse');
  }
  validateRequest(protocol.submit, '提交请求', false, errors);
  if (!isRecord(protocol.response)) {
    errors.push('响应配置无效');
    return [...new Set(errors)];
  }
  const response = protocol.response;
  if (!['json', 'text', 'binary'].includes(String(response.type))) {
    errors.push('响应类型只支持 json、text 或 binary');
  }
  if (response.errorPath !== undefined) {
    validatePathExpression(response.errorPath, '提交错误路径', errors);
  }

  if (protocol.mode === 'sync') {
    if (response.type === 'json' || response.result !== undefined) {
      validateResultConfig(response.result, '同步 JSON 协议', response.type === 'json', errors);
    }
  } else {
    if (response.type !== 'json') {
      errors.push('异步协议的提交与轮询响应必须使用 JSON');
    }
    validatePathExpression(response.taskIdPath, '任务 ID 路径', errors);
    if (validateRequest(protocol.poll, '轮询请求', true, errors) && isRecord(protocol.poll)) {
      if (protocol.poll.bodyEncoding === 'multipart') {
        errors.push('异步轮询请求不支持 multipart 请求体');
      }
      if (!isRecord(protocol.poll.response)) {
        errors.push('轮询响应配置无效');
        return [...new Set(errors)];
      }
      const pollResponse = protocol.poll.response;
      validatePathExpression(pollResponse.statusPath, '轮询状态路径', errors);
      validateResultConfig(pollResponse.result, '轮询协议', true, errors);
      if (!Array.isArray(pollResponse.successValues) || pollResponse.successValues.length === 0) {
        errors.push('轮询成功状态不能为空');
      }
      if (!Array.isArray(pollResponse.failureValues)) errors.push('轮询失败状态必须是数组');
      if (pollResponse.errorPath !== undefined) {
        validatePathExpression(pollResponse.errorPath, '轮询错误路径', errors);
      }
      if (pollResponse.progressPath !== undefined) {
        validatePathExpression(pollResponse.progressPath, '轮询进度路径', errors);
      }
      if (
        protocol.poll.intervalMs !== undefined
        && (typeof protocol.poll.intervalMs !== 'number'
          || protocol.poll.intervalMs < 1000
          || protocol.poll.intervalMs > 60000)
      ) {
        errors.push('轮询间隔必须在 1000 到 60000 毫秒之间');
      }
      if (
        protocol.poll.maxAttempts !== undefined
        && (!Number.isInteger(protocol.poll.maxAttempts)
          || Number(protocol.poll.maxAttempts) < 1
          || Number(protocol.poll.maxAttempts) > 10000)
      ) {
        errors.push('最大轮询次数必须在 1 到 10000 之间');
      }
      if (
        protocol.poll.maxDurationMs !== undefined
        && (!Number.isInteger(protocol.poll.maxDurationMs)
          || Number(protocol.poll.maxDurationMs) < 1000
          || Number(protocol.poll.maxDurationMs) > 86400000)
      ) {
        errors.push('最大轮询时长必须在 1000 到 86400000 毫秒之间');
      }
      validatePollRetryConfig(protocol.poll.retry, errors);
    }
  }
  return [...new Set(errors)];
}

export function parseModelExecutionProtocol(value: unknown): NormalizedModelExecutionProtocol {
  const errors = validateModelExecutionProtocol(value);
  if (errors.length > 0) throw new Error(errors[0]);
  const normalized = (value as { version: number }).version === 1
    ? upgradeLegacyProtocolValue(value as Record<string, unknown>)
    : structuredClone(value);
  return normalized as unknown as NormalizedModelExecutionProtocol;
}
