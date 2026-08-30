import { describe, it, expect, beforeEach, vi } from 'vitest'

// 这些 store 的快照读取通过 useSyncExternalStore 暴露，但纯逻辑测试不需要 React 渲染。
// mock react 的 useSyncExternalStore 直接返回 getSnapshot()，即可在 node 下读取模块级 state。
vi.mock('react', () => ({
  useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot(),
}))

// providerStore 依赖 settingsApi.providerApi（网络）与 kvStore.kvSet（落盘）。
// 用 vi.mock 隔离两者；模块级 state 用 resetModules 重置。
// 注意：vi.mock 工厂会被 hoist 到 import 之前，mock 函数必须用 vi.hoisted 声明，
// 否则工厂闭包捕获的是 undefined。
const h = vi.hoisted(() => ({
  mockGetProviders: vi.fn(),
  mockTestConnection: vi.fn(),
  mockProbeAsync: vi.fn(),
  mockFetchModels: vi.fn(),
  mockSaveProviders: vi.fn(),
  mockSyncConfigBase: vi.fn(),
  mockKvSet: vi.fn(),
}))

vi.mock('../../src/components/base/localToolApi.ts', () => ({
  providerApi: {
    getProviders: (...a) => h.mockGetProviders(...a),
    testConnection: (...a) => h.mockTestConnection(...a),
    probeAsync: (...a) => h.mockProbeAsync(...a),
    fetchModels: (...a) => h.mockFetchModels(...a),
    saveProviders: (...a) => h.mockSaveProviders(...a),
    syncConfigBase: (...a) => h.mockSyncConfigBase(...a),
  },
}))
vi.mock('../../src/components/base/kvStore.ts', () => ({
  storageGet: vi.fn(),
  storageSet: (...a) => h.mockKvSet(...a),
  storageDelete: vi.fn(),
  isKvKey: vi.fn(() => false),
  CANVAS_STATE_PREFIX: 'canvas-state-v1-',
  kvGet: vi.fn(),
  kvSet: vi.fn(),
  kvDelete: vi.fn(),
}))


describe('providerStore §4 供应商数据层', () => {
  let mod
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
    mod = await import('../../src/components/base/settings/providerStore.js')
  })

  // ── 纯逻辑动作（不触网）──
  describe('本地动作', () => {
    it('add 追加空供应商并选中、标记 dirty', () => {
      const n0 = mod.useProviders().providers.length
      mod.add()
      const s = mod.useProviders()
      expect(s.providers).toHaveLength(n0 + 1)
      expect(s.selectedId).toBe(s.providers[n0].id)
      expect(s.dirty).toBe(true)
      expect(s.providers[n0].name).toBe('新供应商')
      expect(s.providers[n0].protocol).toBe('openai')
    })

    it('update 局部改字段并标 dirty', () => {
      mod.add()
      const id = mod.useProviders().selectedId
      mod.update(id, { name: '改名', enabled: false })
      const p = mod.useProviders().providers.find((x) => x.id === id)
      expect(p.name).toBe('改名')
      expect(p.enabled).toBe(false)
      expect(p.protocol).toBe('openai') // 未动字段保留
      expect(mod.useProviders().dirty).toBe(true)
    })

    it('select 切换选中并清 testResult', () => {
      mod.add()
      const id = mod.useProviders().selectedId
      mod.select(id)
      expect(mod.useProviders().selectedId).toBe(id)
    })

    it('setPrimary 仅一个 primary=true', () => {
      mod.add()
      mod.add()
      const ids = mod.useProviders().providers.map((p) => p.id)
      mod.setPrimary(ids[1])
      const s = mod.useProviders()
      expect(s.providers.filter((p) => p.primary)).toHaveLength(1)
      expect(s.providers.find((p) => p.id === ids[1]).primary).toBe(true)
    })

    it('remove 删除目标，删的是主供应商则下个升任主', () => {
      mod.add()
      mod.add()
      const ids = mod.useProviders().providers.map((p) => p.id)
      mod.setPrimary(ids[0])
      mod.remove(ids[0])
      const s = mod.useProviders()
      expect(s.providers.find((p) => p.id === ids[0])).toBeUndefined()
      // ids[1] 升任 primary
      expect(s.providers.find((p) => p.id === ids[1]).primary).toBe(true)
      // selectedId 跟随
      expect(s.selectedId).toBe(ids[1])
    })

    it('remove 不存在的 id 不崩', () => {
      const n0 = mod.useProviders().providers.length
      mod.remove('nope')
      expect(mod.useProviders().providers).toHaveLength(n0)
    })
  })

  // ── 异步动作（mock 网络/落盘）──
  describe('网络动作', () => {
    it('load 拉取列表并选中主供应商', async () => {
      h.mockGetProviders.mockResolvedValue({
        data: {
          providers: [
            { id: 'a', name: 'A', primary: false },
            { id: 'b', name: 'B', primary: true },
          ],
        },
      })
      await mod.load()
      const s = mod.useProviders()
      expect(s.providers).toHaveLength(2)
      expect(s.selectedId).toBe('b') // 主供应商优先
      expect(s.dirty).toBe(false)
      expect(s.loading).toBe(false)
    })

    it('load 无主供应商时选第一个', async () => {
      h.mockGetProviders.mockResolvedValue({ data: { providers: [{ id: 'a', name: 'A' }] } })
      await mod.load()
      expect(mod.useProviders().selectedId).toBe('a')
    })

    it('成功写入 testResult', async () => {
      mod.add()
      const id = mod.useProviders().selectedId
      h.mockTestConnection.mockResolvedValue({ ok: true, latency: 12 })
      await mod.test(id)
      const s = mod.useProviders()
      expect(s.testResult).toEqual({ ok: true, latency: 12 })
      expect(s.testingId).toBeNull()
    })

    it('失败写入 error', async () => {
      mod.add()
      const id = mod.useProviders().selectedId
      h.mockTestConnection.mockRejectedValue(new Error('conn refused'))
      await mod.test(id)
      const s = mod.useProviders()
      expect(s.testResult).toEqual({ ok: false, error: 'conn refused' })
    })

    it('apimart 通用探测失败时用 probe-async 补全诊断（透传原始错误）', async () => {
      mod.add()
      const id = mod.useProviders().selectedId
      // 设为 apimart 协议，且 test-connection 返回失败
      mod.update(id, { protocol: 'apimart' })
      h.mockTestConnection.mockResolvedValue({ ok: false, status: 0, error: '连接失败: Connect Timeout' })
      h.mockProbeAsync.mockResolvedValue({ ok: true, status: 400, stage: 'async_endpoint_ok', detail: 'Invalid task ID.' })
      await mod.test(id)
      const s = mod.useProviders()
      // probe-async 确认异步端点存在 → 整体判 ok
      expect(h.mockProbeAsync).toHaveBeenCalled()
      expect(s.testResult.ok).toBe(true)
      expect(s.testResult.stage).toBe('async_endpoint_ok')
    })

    it('apimart probe-async 本身抛错时保留 test-connection 原始信息（不覆盖）', async () => {
      // 【R6 边角1】probe-async 失败（catch 空体）→ 保留 test-connection 的原始诊断，不被抹掉
      mod.add()
      const id = mod.useProviders().selectedId
      mod.update(id, { protocol: 'apimart' })
      h.mockTestConnection.mockResolvedValue({ ok: false, status: 0, error: '连接失败: Connect Timeout' })
      h.mockProbeAsync.mockRejectedValue(new Error('probe down'))
      await mod.test(id)
      const s = mod.useProviders()
      expect(s.testResult).toEqual({ ok: false, status: 0, error: '连接失败: Connect Timeout' })
    })

    it('fetchModels 拉取结果暂存 fetchedModels（不直接写盘），applyFetchedModels 勾选后写入', async () => {
      mod.add()
      const id = mod.useProviders().selectedId
      h.mockFetchModels.mockResolvedValue({
        data: {
          image_models: ['i1'], chat_models: ['c1', 'c2'], video_models: [], warning: null,
        },
      })
      const res = await mod.fetchModels(id)
      expect(res.ok).toBe(true)
      expect(res.total).toBe(3)
      // 先暂存，provider 未被直接改写
      const st = mod.useProviders().fetchedModels
      expect(st).toMatchObject({ id, image_models: ['i1'], chat_models: ['c1', 'c2'], video_models: [] })
      expect(mod.useProviders().providers.find((x) => x.id === id).image_models).toEqual([])
      // 勾选后写入并清暂存、标 dirty
      mod.applyFetchedModels(id, { image_models: st.image_models, chat_models: st.chat_models, video_models: st.video_models })
      const p = mod.useProviders().providers.find((x) => x.id === id)
      expect(p.image_models).toEqual(['i1'])
      expect(p.chat_models).toEqual(['c1', 'c2'])
      expect(p.video_models).toEqual([])
      expect(mod.useProviders().dirty).toBe(true)
      expect(mod.useProviders().fetchedModels).toBeNull()
    })

    it('fetchModels 返回结构缺字段返回 ok=false', async () => {
      mod.add()
      const id = mod.useProviders().selectedId
      h.mockFetchModels.mockResolvedValue({ data: { image_models: ['i1'] } }) // 缺 chat/video
      const res = await mod.fetchModels(id)
      expect(res.ok).toBe(false)
    })

    it('save 提交清洗后的 payload（api_key 仅在 _apiKey 非空且无 •• 时带上）', async () => {
      mod.add()
      const id = mod.useProviders().selectedId
      // 模拟编辑：设置 _apiKey 与 _clearKey
      mod.update(id, { _apiKey: 'sk-secret', _clearKey: false, name: '已改' })
      h.mockSaveProviders.mockResolvedValue({ data: { providers: [{ id, name: '已改', primary: true }] } })
      const res = await mod.save()
      expect(res.ok).toBe(true)
      // 校验 paylaod 构造
      const sent = h.mockSaveProviders.mock.calls[0][0]
      expect(Array.isArray(sent)).toBe(true)
      const me = sent.find((p) => p.id === id)
      expect(me.api_key).toBe('sk-secret')
      expect(me.clear_key).toBeUndefined()
      expect(me.name).toBe('已改')
      // 主供应商回写 KV
      expect(h.mockKvSet).toHaveBeenCalledWith('active_api_endpoint', expect.objectContaining({ providerId: id }))
    })

    it('save 当 _clearKey=true 带 clear_key，_apiKey 含 •• 不带走明文', async () => {
      mod.add()
      const id = mod.useProviders().selectedId
      mod.update(id, { _apiKey: '••••••', _clearKey: true })
      h.mockSaveProviders.mockResolvedValue({ data: { providers: [{ id }] } })
      await mod.save()
      const me = h.mockSaveProviders.mock.calls[0][0].find((p) => p.id === id)
      expect(me.clear_key).toBe(true)
      expect(me.api_key).toBeUndefined() // 含 •• 视为未改，不传
    })

    it('save 网络失败后返回 ok=false 带 error', async () => {
      mod.add()
      h.mockSaveProviders.mockRejectedValue(new Error('500'))
      const res = await mod.save()
      expect(res.ok).toBe(false)
      expect(res.error).toBe('500')
    })

    it('save 空 providers 时不写 active_api_endpoint（无主供应商）', async () => {
      // 【R6 边角4】空 providers 时 primary 为 undefined，跳过 KV 回写
      h.mockSaveProviders.mockResolvedValue({ data: { providers: [] } })
      const res = await mod.save()
      expect(res.ok).toBe(true)
      expect(h.mockKvSet).not.toHaveBeenCalled()
    })
  })
})
