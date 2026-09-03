import { describe, it, expect, beforeEach, vi } from 'vitest'

// 这些 store 的快照读取通过 useSyncExternalStore 暴露，但纯逻辑测试不需要 React 渲染。
// mock react 的 useSyncExternalStore 直接返回 getSnapshot()，即可在 node 下读取模块级 state。
vi.mock('react', () => ({
  useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot(),
}))

// providerStore 依赖 settingsApi.providerApi（网络）与 kvStore.kvSet（落盘）。
// 【新时代配置型】已删除 add/update/remove CRUD，测试种子一律经 load()（走 /api/providers 读配置型列表）。
// 保留的核心契约断言：load 选主 / setPrimary 单 primary / test 连通 / fetchModels 拉取写入 / save 透传+KV。
const h = vi.hoisted(() => ({
  mockGetProviders: vi.fn(),
  mockTestConnection: vi.fn(),
  mockProbeAsync: vi.fn(),
  mockFetchModels: vi.fn(),
  mockSaveProviders: vi.fn(),
  mockSyncConfigBase: vi.fn(),
  mockKvSet: vi.fn(),
}))

vi.mock('../../src/components/base/api/localToolApi.ts', () => ({
  providerApi: {
    getProviders: (...a) => h.mockGetProviders(...a),
    testConnection: (...a) => h.mockTestConnection(...a),
    probeAsync: (...a) => h.mockProbeAsync(...a),
    fetchModels: (...a) => h.mockFetchModels(...a),
    saveProviders: (...a) => h.mockSaveProviders(...a),
    syncConfigBase: (...a) => h.mockSyncConfigBase(...a),
  },
}))
vi.mock('../../src/components/base/storage/kvStore.ts', () => ({
  storageGet: vi.fn(),
  storageSet: (...a) => h.mockKvSet(...a),
  storageDelete: vi.fn(),
  isKvKey: vi.fn(() => false),
  CANVAS_STATE_PREFIX: 'canvas-state-v1-',
  kvGet: vi.fn(),
  kvSet: vi.fn(),
  kvDelete: vi.fn(),
}))


describe('providerStore §4 供应商数据层（新时代配置型）', () => {
  let mod

  /** 用 mock 的 /api/providers 种种子（配置型厂商），返回拉取后的 state。 */
  async function seed(providers) {
    h.mockGetProviders.mockResolvedValue({ data: { providers } })
    await mod.load()
    return mod.useProviders()
  }

  beforeEach(async () => {
    vi.resetModules()
    h.mockGetProviders.mockReset()
    h.mockTestConnection.mockReset()
    h.mockProbeAsync.mockReset()
    h.mockFetchModels.mockReset()
    h.mockSaveProviders.mockReset()
    h.mockSyncConfigBase.mockReset()
    h.mockKvSet.mockReset()
    h.mockKvSet.mockReturnValue(Promise.resolve())
    h.mockSyncConfigBase.mockReturnValue(Promise.resolve())
    mod = await import('../../src/components/base/settings/providerStore.ts')
  })

  describe('load / select（配置型数据源）', () => {
    it('load 拉取列表并选中主供应商', async () => {
      const s = await seed([
        { id: 'a', name: 'A', primary: false },
        { id: 'b', name: 'B', primary: true },
      ])
      expect(s.providers).toHaveLength(2)
      expect(s.selectedId).toBe('b') // 主供应商优先
      expect(s.dirty).toBe(false)
      expect(s.loading).toBe(false)
    })

    it('load 无主供应商时选第一个', async () => {
      const s = await seed([{ id: 'a', name: 'A' }])
      expect(s.selectedId).toBe('a')
    })

    it('select 切换选中并清 testResult', async () => {
      const s = await seed([{ id: 'a', name: 'A' }, { id: 'b', name: 'B', primary: true }])
      mod.select('a')
      expect(mod.useProviders().selectedId).toBe('a')
    })
  })

  describe('setPrimary（切哪个用哪个）', () => {
    it('setPrimary 仅一个 primary=true', async () => {
      await seed([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }])
      mod.setPrimary('b')
      const s = mod.useProviders()
      expect(s.providers.filter((p) => p.primary)).toHaveLength(1)
      expect(s.providers.find((p) => p.id === 'b').primary).toBe(true)
      expect(s.dirty).toBe(true)
    })
  })

  describe('test（连通性探测）', () => {
    it('成功写入 testResult', async () => {
      await seed([{ id: 'a', name: 'A', protocol: 'openai' }])
      h.mockTestConnection.mockResolvedValue({ ok: true, latency: 12 })
      await mod.test('a')
      const s = mod.useProviders()
      expect(s.testResult).toEqual({ ok: true, latency: 12 })
      expect(s.testingId).toBeNull()
    })

    it('失败写入 error', async () => {
      await seed([{ id: 'a', name: 'A' }])
      h.mockTestConnection.mockRejectedValue(new Error('conn refused'))
      await mod.test('a')
      expect(mod.useProviders().testResult).toEqual({ ok: false, error: 'conn refused' })
    })

    it('apimart 通用探测失败时用 probe-async 补全诊断（透传原始错误）', async () => {
      await seed([{ id: 'a', name: 'A', protocol: 'apimart' }])
      h.mockTestConnection.mockResolvedValue({ ok: false, status: 0, error: '连接失败: Connect Timeout' })
      h.mockProbeAsync.mockResolvedValue({ ok: true, status: 400, stage: 'async_endpoint_ok', detail: 'Invalid task ID.' })
      await mod.test('a')
      expect(h.mockProbeAsync).toHaveBeenCalled()
      expect(mod.useProviders().testResult.ok).toBe(true)
      expect(mod.useProviders().testResult.stage).toBe('async_endpoint_ok')
    })

    it('apimart probe-async 本身抛错时保留 test-connection 原始信息（不覆盖）', async () => {
      await seed([{ id: 'a', name: 'A', protocol: 'apimart' }])
      h.mockTestConnection.mockResolvedValue({ ok: false, status: 0, error: '连接失败: Connect Timeout' })
      h.mockProbeAsync.mockRejectedValue(new Error('probe down'))
      await mod.test('a')
      expect(mod.useProviders().testResult).toEqual({ ok: false, status: 0, error: '连接失败: Connect Timeout' })
    })
  })

  describe('fetchModels / applyFetchedModels（拉模型写入）', () => {
    it('fetchModels 拉取结果暂存 fetchedModels（不直接写盘），applyFetchedModels 勾选后写入', async () => {
      await seed([{ id: 'a', name: 'A', image_models: [], chat_models: [], video_models: [] }])
      h.mockFetchModels.mockResolvedValue({
        data: {
          image_models: [{ id: 'i1' }], chat_models: [{ id: 'c1' }, { id: 'c2' }], video_models: [], warning: null,
        },
      })
      const res = await mod.fetchModels('a')
      expect(res.ok).toBe(true)
      expect(res.total).toBe(3)
      const st = mod.useProviders().fetchedModels
      expect(st).toMatchObject({ id: 'a', image_models: [{ id: 'i1' }], chat_models: [{ id: 'c1' }, { id: 'c2' }], video_models: [] })
      expect(mod.useProviders().providers.find((x) => x.id === 'a').image_models).toEqual([])
      mod.applyFetchedModels('a', { image_models: st.image_models, chat_models: st.chat_models, video_models: st.video_models })
      const p = mod.useProviders().providers.find((x) => x.id === 'a')
      expect(p.image_models).toEqual([{ id: 'i1' }])
      expect(p.chat_models).toEqual([{ id: 'c1' }, { id: 'c2' }])
      expect(p.video_models).toEqual([])
      expect(mod.useProviders().dirty).toBe(true)
      expect(mod.useProviders().fetchedModels).toBeNull()
    })

    it('fetchModels 返回结构缺字段返回 ok=false', async () => {
      await seed([{ id: 'a', name: 'A' }])
      h.mockFetchModels.mockResolvedValue({ data: { image_models: [{ id: 'i1' }] } }) // 缺 chat/video
      const res = await mod.fetchModels('a')
      expect(res.ok).toBe(false)
    })
  })

  describe('save（透传 + 回退默认 KV）', () => {
    it('save 透传整组 provider，剥离 key 通道字段，并把主供应商回写 active_api_endpoint', async () => {
      await seed([{ id: 'a', name: 'A', primary: true, image_models: [{ id: 'm1' }] }])
      h.mockSaveProviders.mockResolvedValue({ data: { providers: [{ id: 'a', name: 'A', primary: true }] } })
      const res = await mod.save()
      expect(res.ok).toBe(true)
      const sent = h.mockSaveProviders.mock.calls[0][0]
      expect(Array.isArray(sent)).toBe(true)
      const me = sent.find((p) => p.id === 'a')
      // 透传保留模型等字段，且不带任何 key 通道
      expect(me.image_models).toEqual([{ id: 'm1' }])
      expect(me.api_key).toBeUndefined()
      expect(me._apiKey).toBeUndefined()
      expect(me._clearKey).toBeUndefined()
      // 主供应商回写 KV
      expect(h.mockKvSet).toHaveBeenCalledWith('active_api_endpoint', expect.objectContaining({ providerId: 'a' }))
    })

    it('save 空 providers 时不写 active_api_endpoint（无主供应商）', async () => {
      await seed([])
      h.mockSaveProviders.mockResolvedValue({ data: { providers: [] } })
      const res = await mod.save()
      expect(res.ok).toBe(true)
      expect(h.mockKvSet).not.toHaveBeenCalled()
    })

    it('save 网络失败后返回 ok=false 带 error', async () => {
      await seed([{ id: 'a', name: 'A' }])
      h.mockSaveProviders.mockRejectedValue(new Error('500'))
      const res = await mod.save()
      expect(res.ok).toBe(false)
      expect(res.error).toBe('500')
    })
  })
})