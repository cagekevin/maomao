/**
 * localTool API 封装（供应商管理）。
 * 数据层唯一发请求的地方；store/组件不直接 fetch。
 */
import { httpRequest } from '../httpClient.js'
import { API_BASE } from '../config.js'

async function request(path, { method = 'GET', body, label } = {}) {
  return httpRequest(`${API_BASE}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    label,
  })
}

export const providerApi = {
  getProviders: () => request('/api/providers', { label: 'getProviders' }),
  saveProviders: (providers) => request('/api/providers', { method: 'PUT', body: { providers }, label: 'saveProviders' }),
  testConnection: (payload) => request('/api/providers/test-connection', { method: 'POST', body: payload, label: 'testConnection' }),
  fetchModels: (id) => request(`/api/providers/${encodeURIComponent(id)}/fetch-models`, { method: 'POST', label: 'fetchModels' }),
  // 方案A：保存后把合并结果回写项目根 api.config.json（保留 _meta/_comment），消除双源漂移
  syncConfigBase: (providers) => request('/api/config/base', { method: 'PUT', body: { providers }, label: 'syncConfigBase' }),
}
