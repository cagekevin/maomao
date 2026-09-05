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
 * ── per-provider 自定义异步协议（方案①）──────────────
 * 非 lovart 平台的异步 image/video 已无内置声明式 preset（旧 lovart-* 9004 双信封预设已随
 * lovart-old 旧轨退役删除，见 docs/105）。平台如需异步生成，须在 provider 配置文件
 * `model_protocols[capability]` 中自备 `ModelProtocol`（preset:'custom'），由 relay-poll 提交时
 * 读取解析；未配置 → 明确报错「该平台暂不支持异步生成」。
 * 本文件仅保留有跨厂商事实标准的同步预设（OpenAI chat/images）与支持自定义异步的视频兜底。
 */

function cloneProtocol(protocol: ModelProtocol): ModelProtocol {
  return structuredClone(protocol);
}

export function getModelProtocolPreset(preset: ModelProtocolPresetName): ModelProtocol {
  if (preset === 'openai-chat') return cloneProtocol(OPENAI_CHAT_PROTOCOL);
  if (preset === 'agnes-video') return cloneProtocol(AGNES_VIDEO_PROTOCOL);
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
