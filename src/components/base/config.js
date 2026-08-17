/**
 * 集中配置（env 变量的单一来源）。
 *
 * 所有 import.meta.env 读取必须集中在此文件，禁止散落在业务代码中。
 * 业务代码 import { xxx } from './config.js' 即可。
 *
 * 命名规则：UPPER_SNAKE_CASE，与 env 变量名对齐。
 */

// ── LLM 聊天配置 ─────────────────────────────────────────────────
/** LLM 端点 base URL（空则走 localTool 18080 代理） */
export const LLM_CHAT_BASE_URL = import.meta.env?.VITE_LLM_CHAT_BASE_URL || ''

/** LLM API Key */
export const LLM_CHAT_API_KEY = import.meta.env?.VITE_LLM_CHAT_API_KEY || ''

/** LLM 默认模型 */
export const LLM_CHAT_MODEL = import.meta.env?.VITE_LLM_CHAT_MODEL || 'gpt-4o-mini'

// ── 演示模式 ─────────────────────────────────────────────────────
/** VITE_AGENT_DEMO='1' 时启用演示模式（不发真实 LLM 请求，用规则引擎模拟） */
export const AGENT_DEMO_MODE = import.meta.env?.VITE_AGENT_DEMO === '1'

// ── AI 助手模型列表 ──────────────────────────────────────────────
/** 默认模型列表，env 可覆盖 */
const DEFAULT_AGENT_MODELS = [
  'gpt-4o-mini',
  'gpt-4o',
  'gpt-4o-vision-preview',
  'deepseek-chat',
  'Qwen/Qwen3-14B',
]

/** AI 助手可选模型列表（env VITE_AGENT_MODELS 可覆盖，逗号分隔） */
export const AGENT_MODELS = (() => {
  const env = import.meta.env?.VITE_AGENT_MODELS || ''
  return env ? env.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_AGENT_MODELS
})()

// ── 异步超时（ms）───────────────────────────────────────────────
/** httpClient 默认超时 */
export const HTTP_DEFAULT_TIMEOUT = 15000
/** localTool 探活 / 拖拽文本读取（短超时，快失败） */
export const LOCAL_TOOL_PING_TIMEOUT = 5000
/** 图片 URL → blob 读取（imageUrl.js） */
export const IMAGE_FETCH_TIMEOUT = 10000
/** 图片压缩 / 图像加载（imageCompress.js、asyncGuard.js） */
export const IMAGE_LOAD_TIMEOUT = 20000
/** 通用下载 / 读视频元数据（clipboard.js、VideoProcessNode） */
export const DOWNLOAD_TIMEOUT = 30000
/** 大视频下载（VideoProcessNode） */
export const VIDEO_DOWNLOAD_TIMEOUT = 90000
/** 文件上传（filesApi.js） */
export const UPLOAD_TIMEOUT = 60000

// ── 生成轮询超时（ms）───────────────────────────────────────────
/** 生图 async 模式轮询总超时 */
export const GEN_TIMEOUT = 300000
/** 视频 async 模式轮询总超时 */
export const VIDEO_TIMEOUT = 600000

// ── 轮询间隔（ms）───────────────────────────────────────────────
export const GEN_POLL_INTERVAL = 3000
export const VIDEO_POLL_INTERVAL = 5000

// ── 并发上限 ────────────────────────────────────────────────────
/** 生图同时真正触发上限（超出跳过，见 taskStore） */
export const GEN_MAX_CONCURRENT = 6