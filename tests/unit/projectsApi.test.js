// @vitest-environment node
/**
 * projectsApi 单测（批 2，API 封装层）。
 * 覆盖：fetchProjects / saveProjects 成功路径与 HTTP 错误抛出。
 * 策略：node + vi.stubGlobal('fetch')。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { jsonResp } from './_testUtils.mjs'

const fetchMock = globalThis.fetch

const api = await import('../../src/components/base/localToolApi.js')

beforeEach(() => fetchMock.mockReset())
afterEach(() => vi.unstubAllGlobals())

describe('projectsApi — 成功路径', () => {
  it('fetchProjects 返回 {projects,lastOpened}', async () => {
    fetchMock.mockResolvedValue(jsonResp({ projects: [{ id: 'p1' }], lastOpened: 'p1' }))
    const res = await api.fetchProjects()
    expect(res.projects).toHaveLength(1)
    expect(res.lastOpened).toBe('p1')
    expect(fetchMock.mock.calls[0][0]).toContain('/api/projects')
  })

  it('saveProjects 发送 POST 全量覆盖', async () => {
    fetchMock.mockResolvedValue(jsonResp({ ok: true }))
    const projects = [{ id: 'p1', name: 'P1' }]
    await api.saveProjects(projects, 'p1')
    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ projects, lastOpened: 'p1' })
  })
})

describe('projectsApi — 错误路径', () => {
  it('非 2xx 抛 HttpError，status 单独暴露', async () => {
    fetchMock.mockResolvedValue(jsonResp({}, false, 404))
    await expect(api.fetchProjects()).rejects.toMatchObject({ name: 'HttpError', status: 404, message: '' })
  })
})
