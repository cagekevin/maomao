/**
 * relay-presets —— 平台协议声明总表（纯数据，不做业务逻辑）。
 *
 * 【为什么存在】9004 网关 + 魔搭等平台的"提交→轮询→取结果"三段差异收敛为纯数据声明。
 * kit 的 executeModelProtocol 吃声明驱动；加平台 = 加一份声明，后端零业务代码、前端零感知。
 *
 * 【字段来源】9004 字段路径/状态枚举直接复用现有跑通链路已沉淀的知识反填（对照网关 main.py
 *  / localTool system.ts / 前端 proxyGenerate+pollTask+resultUrlExtractor），非 curl 从零抓包。
 *
 * 【baseUrl/path 拼接铁律】kit 的 URL = `baseUrl + submit.path`（buildSameOriginUrl 直接拼，
 *  pathMode 默认 append）。故 submit.path/poll.path 必须含 9004 的 `/v1` 前缀
 *  （baseUrl 传 `http://127.0.0.1:9004`），否则打不到 `/v1/images/generations` 等真实端点。
 *
 * 【状态枚举铁律（网关 main.py 对外改写）】9004 对 外部 只返 4 种：
 *  completed / failed / processing / pending。Lovart running→processing、abort→failed。
 *  声明里 successValues=['completed']、failureValues=['failed']，绝不写 running/abort。
 */
import type { NormalizedModelExecutionProtocol } from './relay-engine/types/protocol';

/** 9004 image（/v1/images/generations 异步）：提交返回 {code,data:[{status:'submitted',task_id}]}（数组）
 *  图生图：9004 认 image_urls 字段(main.py _do_submit 读 body.image_urls)，kit 把它归一成 imageUrls
 *  变量并填入 {{imageUrls}}(见 relay-engine/protocol/variables.ts imageurls 归一)。无参考图时该变量为空，
 *  kit renderRequestBody 会去掉空数组(不污染请求体)，故可安全带上。 */
const LOVART_IMAGE: NormalizedModelExecutionProtocol = {
  version: 2,
  mode: 'async',
  submit: {
    method: 'POST',
    path: '/v1/images/generations',
    body: { model: '{{model}}', prompt: '{{prompt}}', size: '{{size}}', image_urls: '{{imageUrls}}' },
  },
  // 图片 data 是数组 [{status, task_id}] → 下标 0 取 task_id
  response: { type: 'json', taskIdPath: 'data.0.task_id' },
  poll: {
    method: 'GET',
    path: '/v1/tasks/{{submit.data.0.task_id}}',
    response: {
      statusPath: 'data.status',              // 走 {code,data} 信封的 data.status
      successValues: ['completed'],
      failureValues: ['failed'],
      result: { urlPath: 'data.result.images.0.url.0' },  // 图片结果
      errorPath: 'data.error.message',
      progressPath: 'data.progress',
    },
    intervalMs: 3000,
  },
};

/** 9004 video（/v1/videos/generations 异步）：提交返回 {code,data:{id,status,task_id}}（对象非数组） */
const LOVART_VIDEO: NormalizedModelExecutionProtocol = {
  version: 2,
  mode: 'async',
  submit: {
    method: 'POST',
    path: '/v1/videos/generations',
    body: { model: '{{model}}', prompt: '{{prompt}}', size: '{{size}}' },
  },
  // 视频 data 是对象 {id,status,task_id} → task_id 在 {code,data} 信封的 data.task_id
  response: { type: 'json', taskIdPath: 'data.task_id' },
  poll: {
    method: 'GET',
    path: '/v1/tasks/{{submit.task_id}}',
    response: {
      statusPath: 'data.status',
      successValues: ['completed'],
      failureValues: ['failed'],
      result: { urlPath: 'data.result.videos.0.url.0' },   // 视频结果
      errorPath: 'data.error.message',
      progressPath: 'data.progress',
    },
    intervalMs: 3000,
  },
};

/**
 * 协议声明总表：capability → { providerId: protocol, default: protocol }
 * 命中 provider.id 优先，否则 default（同类能力平台复用同份声明，差异由平台专属字段覆盖时再加）。
 */
export const presets: Record<string, Record<string, NormalizedModelExecutionProtocol>> = {
  image: { lovart: LOVART_IMAGE, default: LOVART_IMAGE },
  video: { lovart: LOVART_VIDEO, default: LOVART_VIDEO },
};
