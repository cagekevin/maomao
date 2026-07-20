/**
 * 一毛AI画布 · 逆向还原版 · 运行时配置
 * ----------------------------------------------------------------
 * 本文件集中接管原版中所有硬编码的远程/本地地址，便于替换为
 * 你们自己的后端（API 网关）。
 *
 * 本地引擎已启用，KV 存储和文件操作走 localTool (:18080)。
 * AI 生成请求走用户配置的第三方 API（OpenAI 兼容协议）。
 */

// 本地引擎（KV 存储 + 文件操作）
export const LOCAL_ENGINE = {
  host: '127.0.0.1',
  port: 18080,
  get base() {
    return `http://${this.host}:${this.port}`;
  },
};

// 剪映素材库发送端口（已禁用，保留定义）
export const JIANYING_PORT = 18080;

// ====== 你的 API 网关配置 ======
// 接入点列表（替换为你的网关地址）
export const ENDPOINTS = [
  { label: 'API网关', url: 'http://127.0.0.1:9004' },
];

// 默认接入点
export const DEFAULT_ENDPOINT = 'http://127.0.0.1:9004';

// 鉴权 token 在 localStorage 中的 key（保持原版约定）
export const AUTH_TOKEN_KEY = 'auth_token';

// 是否启用原版本地引擎（true = 走本地 localTool :18080）
export const USE_LOCAL_ENGINE = true;

// 远程服务基址（USE_LOCAL_ENGINE=false 时使用）
export const REMOTE_BASE = 'http://127.0.0.1:9004';

// 便捷：根据开关解析最终的基址
export function localEngineBase() {
  return USE_LOCAL_ENGINE ? LOCAL_ENGINE.base : REMOTE_BASE;
}

// 兼容别名（service worker 侧使用）
export const getLocalEngineBase = localEngineBase;

// 头像图片（设置按钮左侧的圆形头像）
export const AVATAR_IMAGE = '/logo.png';

// ====== GAS 云端同步地址 ======
// 用户头像下的「推送到云端」/「从云端拉取」按钮使用的
// Google Apps Script 部署 URL（需部署为「所有人」可访问）。
export const GAS_CLOUD_SYNC_URL = "https://script.google.com/macros/s/AKfycbwI6PvC1v8Bv1E-0aKGx1PQ3AIH5SIUUKjTeDHtq5UxxF3qFFHj8DCr1QvflPDqFdI5/exec";