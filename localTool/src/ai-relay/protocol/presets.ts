/**
 * protocol/presets — 内置调用协议预设。
 * 仅覆盖有跨厂商事实标准的端点（OpenAI 的 chat / images）；
 * 视频无统一端点，自定义视频协议的 path 留空，强制提供文档依据。
 * 对应 AI-Canvas-tauri 的 modelProtocolPresets.ts。
 */

import type {
  ModelCategory,
  ModelProtocol,
  ModelProtocolPresetName,
  ModelProtocolProfile,
} from '../types.js';

const OPENAI_CHAT_PROTOCOL: ModelProtocol = {
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

const OPENAI_IMAGE_PROTOCOL: ModelProtocol = {
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

const AGNES_VIDEO_PROTOCOL: ModelProtocol = {
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

const AGNES_VIDEO_CAPABILITY: Record<string, unknown> = {
  operations: ['text-to-video'],
  defaultResolution: '1152x768',
  defaultRatio: '3:2',
  defaultFrameRate: 24,
  defaultDuration: 5,
  maxImageReferences: 0,
  maxVideoReferences: 0,
  maxAudioReferences: 0,
};

/**
 * ── 第 13 个平台：lovart（apimart 系 / 9004 本地网关）──────────────────────
 * 字段路径与状态枚举对照本地三层「已跑通」代码反填（apimart-gateway/main.py +
 * localTool/routes/system.ts + 前端 proxyGenerate/resultUrlExtractor），非从零抓包猜：
 *  - 状态枚举铁律：9004 网关对外只返回 completed/failed/processing/pending，
 *    声明里绝不出现 abort/running（网关把 abort→failed、running→processing）。
 *  - image 提交返回数组 data:[{status,task_id}]（taskIdPath='data.0.task_id'）；
 *    video 提交返回对象 data:{id,status,task_id}（taskIdPath='task_id'）。
 */

const LOVART_IMAGE_PROTOCOL: ModelProtocol = {
  version: 2,
  mode: 'async',
  submit: {
    method: 'POST',
    path: '/v1/images/generations',
    body: { model: '{{model}}', prompt: '{{prompt}}', size: '{{size}}' },
  },
  response: { type: 'json', taskIdPath: 'data.0.task_id', errorPath: 'data.error.message' },
  poll: {
    method: 'GET',
    path: '/v1/tasks/{{submit.data.0.task_id}}',
    response: {
      statusPath: 'data.status',
      successValues: ['completed'],
      failureValues: ['failed'],
      result: { urlPath: 'data.result.images.0.url.0' },
      errorPath: 'data.error.message',
    },
    intervalMs: 3000,
  },
};

const LOVART_VIDEO_PROTOCOL: ModelProtocol = {
  version: 2,
  mode: 'async',
  submit: {
    method: 'POST',
    path: '/v1/videos/generations',
    body: { model: '{{model}}', prompt: '{{prompt}}', size: '{{size}}' },
    // 注：resolution/duration 非模板字段，由 relay-poll 提交时按 input 有值才动态补进 body（见 relay-poll.ts）
    // —— 引擎对顶层 body 缺变量的模板字符串会抛错，不能直接写成 {{resolution}}。
  },
  // video 提交返回经 9004 ok(...) 包成对象 {code, data:{id,status,task_id}}（非 image 的数组），
  // taskIdPath 必须带 data. 前缀（image 是 data.0，video 是 data）。
  response: { type: 'json', taskIdPath: 'data.task_id', errorPath: 'data.error.message' },
  poll: {
    method: 'GET',
    path: '/v1/tasks/{{submit.data.task_id}}',
    response: {
      statusPath: 'data.status',
      successValues: ['completed'],
      failureValues: ['failed'],
      result: { urlPath: 'data.result.videos.0.url.0' },
      errorPath: 'data.error.message',
    },
    intervalMs: 3000,
  },
};

const LOVART_CHAT_PROTOCOL: ModelProtocol = {
  version: 2,
  mode: 'sync',
  streamFormat: 'openai-sse',
  submit: {
    method: 'POST',
    path: '/v1/chat/completions',
    // stream 固定 false：relay 的 lovart-chat 走 executeModelProtocol 的 sync json 分支（非流式）。
    // 若把 stream 留给 {{stream}} 且未设值 → gateway 默认 stream=True 返回 SSE，readJsonResponse 解析失败。
    // temperature/response_format 用纯模板：调用方有传才进 body（renderTemplateString 缺值时整项剔除），
    // 前端 TextNode JSON（response_format）与温度控制依赖它们（2026-09-03 relay chat 透传）。
    body: {
      model: '{{model}}',
      messages: '{{messages}}',
      stream: false,
      temperature: '{{temperature}}',
      response_format: '{{response_format}}',
    },
  },
  response: {
    type: 'json',
    // 9004 网关 chat 返回双层信封 {code, data:{...choices...}}（非标准 OpenAI 裸体）：
    // textPath 必须带 data. 前缀，否则抽空（image/video preset 均已带 data.，此处对齐）。
    result: { textPath: 'data.choices.0.message.content' },
    errorPath: 'data.error.message',
  },
};

function cloneProtocol(protocol: ModelProtocol): ModelProtocol {
  return structuredClone(protocol);
}

export function getModelProtocolPreset(preset: ModelProtocolPresetName): ModelProtocol {
  if (preset === 'openai-chat') return cloneProtocol(OPENAI_CHAT_PROTOCOL);
  if (preset === 'agnes-video') return cloneProtocol(AGNES_VIDEO_PROTOCOL);
  if (preset === 'lovart-image') return cloneProtocol(LOVART_IMAGE_PROTOCOL);
  if (preset === 'lovart-video') return cloneProtocol(LOVART_VIDEO_PROTOCOL);
  if (preset === 'lovart-chat') return cloneProtocol(LOVART_CHAT_PROTOCOL);
  return cloneProtocol(OPENAI_IMAGE_PROTOCOL);
}

export function getModelProtocolPresetVideoCapability(profile: ModelProtocolProfile | undefined): Record<string, unknown> | undefined {
  return profile?.preset === 'agnes-video'
    ? structuredClone(AGNES_VIDEO_CAPABILITY)
    : undefined;
}

export function normalizeFrames8n1(value: number): number {
  const finiteValue = Number.isFinite(value) ? value : 121;
  const multiplier = Math.max(1, Math.round((Math.max(9, finiteValue) - 1) / 8));
  return multiplier * 8 + 1;
}

export function getDefaultCustomProtocol(category: ModelCategory | string): ModelProtocol {
  if (category === 'text') return getModelProtocolPreset('openai-chat');
  if (category === 'image') return getModelProtocolPreset('openai-image');
  const requiresDocumentedVideoEndpoint = category === 'video';
  return {
    version: 2,
    mode: 'async',
    submit: {
      method: 'POST',
      path: requiresDocumentedVideoEndpoint ? '' : '/audio/generations',
      body: { model: '{{model}}', prompt: '{{prompt}}' },
    },
    response: {
      type: 'json',
      taskIdPath: 'task_id',
    },
    poll: {
      method: 'GET',
      path: requiresDocumentedVideoEndpoint ? '' : '/tasks/{{submit.task_id}}',
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
