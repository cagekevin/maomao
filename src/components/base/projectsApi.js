/**
 * 项目系统后端 API 封装（对齐官方，localTool /api/projects）。
 *
 * localTool 已实现（routes/projects.ts，SQLite 落盘）：
 *  - GET  /api/projects          → { projects:[{id,name,createdAt}], lastOpened }
 *  - POST /api/projects/save     body { projects:[{id,name}], lastOpened }  → { ok:true }（全量覆盖）
 */
import { httpRequest } from './httpClient.js'
import { API_BASE } from './config.js'

/** 读项目列表 + 当前项目 */
export async function fetchProjects() {
  return httpRequest(`${API_BASE}/api/projects`, { label: 'fetchProjects' }) // { projects, lastOpened }
}

/** 全量保存项目列表 + 当前项目 */
export async function saveProjects(projects, lastOpened) {
  return httpRequest(`${API_BASE}/api/projects/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projects, lastOpened }),
    label: 'saveProjects',
  })
}
