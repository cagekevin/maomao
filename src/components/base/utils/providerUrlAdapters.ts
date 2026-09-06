/**
 * 前端协议显示名表 —— 原「前端可插拔协议适配器」经 L3b 收口后的残留。
 * ------------------------------------------------------------
 * 【L3b 变更】原文件承载「前端目标 url 拼装整链」（openai:// 伪协议 / base_url+path 拼装 /
 * apimart / gemini / volcengine / runninghub / CLI 适配器注册表等，约 110 行）。
 * 该链的唯一消费方是 agentRuntime（旧直连出站），已随「出站统一走 chatStream → POST /api/generate」
 * 退役（旧 /api/proxy 2026-09-03 已退役）——平台地址/协议的唯一真源重新回到后端 ai-relay。
 *
 * 现仅保留 `PROVIDER_PROTOCOL_LABELS`（协议显示名，供 API 设置面板 UI 使用）。
 */
/** 协议显示名（M5-1，与后端 protocolAdapters.ts 的 PROVIDER_PROTOCOLS 一一对应）。 */
export const PROVIDER_PROTOCOL_LABELS: Record<string, string> = {
  openai: 'OpenAI 兼容',
  apimart: 'Lovart',
  gemini: 'Gemini',
  volcengine: '火山方舟（Volcengine）',
  runninghub: 'RunningHub',
  jimeng: '即梦（CLI）',
  codex: 'Codex（CLI）',
  'gemini-cli': 'Gemini CLI',
};
