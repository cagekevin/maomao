// @vitest-environment node
/**
 * cloudSync 单测（批 1-3）。
 * 覆盖：CloudSyncEngine.callGateway（URL 校验/重入守卫/响应解析）、push/pull 成功与失败分支、
 * uploadConfig（无本地数据边界）、downloadConfig（云端无数据边界）。
 * 策略：node 环境；mock fetch 让 callGateway 走通；providerApi/projectsApi 用 stub。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// 复用 setup.mjs 强制 mock 的全局 fetch（Node 原生 fetch 不可配置，vi.stubGlobal 会静默失效）
const fetchMock = globalThis.fetch

vi.mock('../../src/components/base/settings/settingsApi.js', () => ({
  providerApi: { saveProviders: vi.fn(), syncConfigBase: vi.fn() },
}))
vi.mock('../../src/components/base/projectsApi.js', () => ({
  fetchProjects: vi.fn(),
  saveProjects: vi.fn(),
}))

const { CloudSyncEngine, uploadConfig, downloadConfig } = await import(
  '../../src/components/base/cloudSync.js'
)

// callGateway 用 res.text() + JSON.parse 解析，故 mock 必须提供 text()
function jsonResp(obj) {
  return { ok: true, text: async () => JSON.stringify(obj) }
}

beforeEach(() => {
  globalThis.fetch = fetchMock
  fetchMock.mockClear()
  CloudSyncEngine.isSyncing = false
  localStorage.clear()
})
afterEach(() => {})

describe('cloudSync — CloudSyncEngine.callGateway 守卫', () => {
  it('重入时抛出「系统正在通信中」', async () => {
    CloudSyncEngine.isSyncing = true
    await expect(CloudSyncEngine.callGateway('push_data', {})).rejects.toThrow('通信中')
  })

  it('fetch 返回 html → 抛权限拦截错误', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => '<html>login</html>' })
    await expect(CloudSyncEngine.callGateway('push_data', {})).rejects.toThrow('权限拦截')
  })

  it('正常返回 JSON', async () => {
    fetchMock.mockResolvedValue(jsonResp({ msg: 'ok', data: { a: 1 } }))
    const res = await CloudSyncEngine.callGateway('push_data', {})
    expect(res.data).toEqual({ a: 1 })
  })
})

describe('cloudSync — push / pull', () => {
  it('push 成功返回 true，调用 onSuccess', async () => {
    fetchMock.mockResolvedValue(jsonResp({ msg: '同步成功' }))
    const onSuccess = vi.fn()
    const ok = await CloudSyncEngine.push({}, () => {}, onSuccess, () => {})
    expect(ok).toBe(true)
    expect(onSuccess).toHaveBeenCalled()
  })

  it('push 网关返回 error → 返回 false 并调用 onError', async () => {
    fetchMock.mockResolvedValue(jsonResp({ error: 'boom' }))
    const onError = vi.fn()
    const ok = await CloudSyncEngine.push({}, () => {}, () => {}, onError)
    expect(ok).toBe(false)
    expect(onError).toHaveBeenCalledWith('boom')
  })

  it('pull 成功返回 data', async () => {
    fetchMock.mockResolvedValue(jsonResp({ data: { projects: [] } }))
    const data = await CloudSyncEngine.pull(() => {}, () => {}, () => {})
    expect(data).toEqual({ projects: [] })
  })

  it('pull 网关报错 → 返回 null', async () => {
    fetchMock.mockResolvedValue(jsonResp({ error: 'noauth' }))
    const data = await CloudSyncEngine.pull(() => {}, () => {}, () => {})
    expect(data).toBeNull()
  })
})

describe('cloudSync — uploadConfig / downloadConfig 边界', () => {
  it('uploadConfig 无本地可同步数据 → 返回 ok:false', async () => {
    const res = await uploadConfig(() => {})
    expect(res.ok).toBe(false)
    expect(res.count).toBe(0)
  })

  it('downloadConfig 云端无数据 → 返回 hasCloud:false', async () => {
    fetchMock.mockResolvedValue(jsonResp({ error: 'empty' }))
    const res = await downloadConfig(() => {})
    expect(res.ok).toBe(false)
    expect(res.hasCloud).toBe(false)
  })

  it('uploadConfig 有数据且 push 成功 → ok:true + count', async () => {
    // 写入一些可同步的本地数据
    const { sSet } = await import('../../src/components/base/storageAdapter.js')
    sSet('app_settings', JSON.stringify({ theme: 'dark' }))
    fetchMock.mockResolvedValue(jsonResp({ msg: 'ok' }))
    const res = await uploadConfig(() => {})
    expect(res.ok).toBe(true)
    expect(res.count).toBeGreaterThan(0)
  })
})
