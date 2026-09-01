// @vitest-environment node
// @ts-nocheck
/**
 * cloudSync 单测（批 1-3）。
 * 覆盖：CloudSyncEngine.callGateway（URL 校验/重入守卫/响应解析）、push/pull 成功与失败分支、
 * uploadConfig（无本地数据边界）、downloadConfig（云端无数据边界）。
 * 策略：node 环境；mock fetch 让 callGateway 走通；providerApi/projectsApi 用 stub。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { jsonResp, createKvMem } from './_testUtils.mjs'
import { contentClearCache } from '../../src/components/base/contentStore.ts'

// 复用 setup.mjs 强制 mock 的全局 fetch（Node 原生 fetch 不可配置，vi.stubGlobal 会静默失效）
const fetchMock = globalThis.fetch

// 账号 KV mock：走内存 Map，让 contentSetAsync('yimao_accounts') 先落 KV 再被 collectLocal 读回，
// 走真实 KV 读写路径；若缺 kvGet/kvSet，将退化为「写读都降级到本地副本」的误导链。
// 注意：工厂提升到模块顶部，须在工厂的异步函数体内引用顶层 kv（而不能直接读取 kv.kvGet 属性，
// 否则提升期静态改写会报 "Cannot access 'kv' before initialization"）。
const kv = createKvMem()
vi.mock('../../src/components/base/api/localToolApi.ts', () => ({
  providerApi: { getProviders: vi.fn(), saveProviders: vi.fn(), syncConfigBase: vi.fn() },
  fetchProjects: vi.fn(),
  saveProjects: vi.fn(),
  kvGet: vi.fn(async (key) => kv.memKV.get(key) ?? null),
  kvSet: vi.fn(async (key, value) => { kv.memKV.set(key, value); return { ok: true } }),
  kvDelete: vi.fn(async (key) => { kv.memKV.delete(key); return { ok: true } }),
}))

const { providerApi } = await import('@/components/base/api/localToolApi.ts')
const { CloudSyncEngine, uploadConfig, downloadConfig } = await import(
  '../../src/components/base/cloudSync.ts'
)

/**
 * 取 uploadConfig 的 push 请求体中的 ls 清单。
 * 注意：collectLocal 现会先走 KV 读账号（contentGetAsync('yimao_accounts') → fetch /api/kv/get），
 * fetch 的 call[0] 不再是 push，故按 GAS URL 定位 push 提交而非假定 calls[0]。
 */
function pushLs() {
  const call = fetchMock.mock.calls.find((c) => String(c[0]).startsWith('https://script.google.com'))
  expect(call, '应存在发往 GAS 的 push 请求').toBeTruthy()
  return JSON.parse(call[1].body).data.data
}

beforeEach(() => {
  globalThis.fetch = fetchMock
  fetchMock.mockClear()
  kv.memKV.clear()
  providerApi.getProviders.mockReset()
  providerApi.getProviders.mockResolvedValue({ data: null }) // 默认无 providers，与既有用例行为一致
  CloudSyncEngine.isSyncing = false
  localStorage.clear()
  contentClearCache()
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
    const { contentSet } = await import('../../src/components/base/contentStore.ts')
    contentSet('app_settings', { theme: 'dark' })
    fetchMock.mockResolvedValue(jsonResp({ msg: 'ok' }))
    const res = await uploadConfig(() => {})
    expect(res.ok).toBe(true)
    expect(res.count).toBeGreaterThan(0)
  })

  it('localTool 未连（getProviders 抛错）→ collectLocal 跳过 API 配置，仍成功且不含 providers', async () => {
    // 【R6 边角3】localTool 未连的降级路径：catch 静默跳过，不阻塞本地配置上传
    const { contentSet } = await import('../../src/components/base/contentStore.ts')
    contentSet('app_settings', { theme: 'dark' })
    providerApi.getProviders.mockRejectedValue(new Error('ECONNREFUSED'))
    fetchMock.mockResolvedValue(jsonResp({ msg: 'ok' }))
    const res = await uploadConfig(() => {})
    expect(res.ok).toBe(true)
    const ls = pushLs() // push 请求体里 cloud.data 才是 ls 清单
    expect(ls.app_settings).toEqual({ theme: 'dark' }) // 本地配置仍上传
    expect(ls.providers).toBeUndefined() // API 配置跳过
  })

  it('同步清单由 contracts.ts getLocalKeys() 生成：真实设置进云，排除本机/临时/本地引用键', async () => {
    const { contentSet } = await import('../../src/components/base/contentStore.ts')
    // 真实设置（此前未进手写清单，收口后应同步）
    contentSet('agent_panel_width', '320')
    contentSet('agent_input_mode', 'agent')
    // 不同步清单：本机偏好 / 本地 URL 素材 / 临时草稿 / 跨窗口剪贴板
    contentSet('lastOpenedProject', 'p1')
    contentSet('yimao_asset_library', [{ id: 'a' }])
    contentSet('agent_draft', '草稿')
    contentSet('mutiwindow-clipboard', 'clip')
    fetchMock.mockResolvedValue(jsonResp({ msg: 'ok' }))
    const res = await uploadConfig(() => {})
    expect(res.ok).toBe(true)
    const ls = pushLs() // push 请求体里 cloud.data 才是 ls 清单
    expect(ls.agent_panel_width).toBe('320')
    expect(ls.agent_input_mode).toBe('agent')
    expect(ls.lastOpenedProject).toBeUndefined()
    expect(ls.yimao_asset_library).toBeUndefined()
    expect(ls.agent_draft).toBeUndefined()
    expect(ls.mutiwindow_clipboard).toBeUndefined()
  })

  it('account 领域开：账号环境（KV 后端）随上传进入云端', async () => {
    const { contentSet, contentSetAsync } = await import('../../src/components/base/contentStore.ts')
    contentSet('app_settings', { theme: 'dark' })
    await contentSetAsync('yimao_accounts', [{ id: 'acc1', name: '环境1' }])
    // 按 URL 分流：KV 读账号 → 返回账号数组；其余（GAS push / kvSet 写）→ 返回成功
    fetchMock.mockImplementation((url, opt) => {
      if (String(url).includes('/api/kv/get')) {
        return Promise.resolve(jsonResp([{ id: 'acc1', name: '环境1' }]))
      }
      return Promise.resolve(jsonResp({ msg: 'ok' }))
    })
    const res = await uploadConfig(() => {})
    expect(res.ok).toBe(true)
    const ls = pushLs()
    expect(ls.accounts).toEqual([{ id: 'acc1', name: '环境1' }])
  })

  it('project 领域关：云端 projects 下载时不覆写本地（堵「云覆盖丢新项目」）', async () => {
    const cloud = { type: 'cloud_config', version: 5, updatedAt: 0, data: { projects: [{ id: 'cloud-p', name: '云项目' }] } }
    fetchMock.mockResolvedValueOnce(jsonResp(cloud)) // pull 返回
    const { saveProjects } = await import('@/components/base/api/localToolApi.ts')
    const res = await downloadConfig(() => {})
    expect(res.ok).toBe(false) // projects 领域关 → 无任何写回 → count 0
    expect(res.hasCloud).toBe(true)
    expect(saveProjects).not.toHaveBeenCalled()
  })
})
