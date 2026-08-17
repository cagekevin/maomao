// 回归测试：clipboard.js、backupStore.js、cloudSync.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── 内存版 storageAdapter（参考 projectStore.test.js 的 mock 写法）──
const memLS = new Map()
vi.mock('../../src/components/base/storageAdapter.js', () => ({
  sGet: vi.fn((k) => (memLS.has(k) ? memLS.get(k) : null)),
  sSet: vi.fn((k, v) => { memLS.set(k, String(v)) }),
  sRemove: vi.fn((k) => { memLS.delete(k) }),
}))

// ── projectStore mock：提供 loadCanvasState / saveCanvasState ──
const memKV = new Map()
vi.mock('../../src/components/base/projectStore.js', () => ({
  loadCanvasState: vi.fn(async (id) => {
    const k = `canvas-state-v1-${id}`
    return memKV.has(k) ? memKV.get(k) : null
  }),
  saveCanvasState: vi.fn(async (id, nodes, edges) => {
    const k = `canvas-state-v1-${id}`
    if ((!nodes || nodes.length === 0) && (!edges || edges.length === 0)) {
      return { skipped: true }
    }
    memKV.set(k, { nodes: nodes || [], edges: edges || [] })
    return { success: true }
  }),
}))

// ── cloudSync 依赖：providerApi / projectsApi（隔离网络）──
vi.mock('../../src/components/base/settings/settingsApi.js', () => ({
  providerApi: {
    getProviders: vi.fn(async () => ({ providers: [] })),
    saveProviders: vi.fn(async () => ({ ok: true })),
    syncConfigBase: vi.fn(async () => ({ ok: true })),
  },
}))
vi.mock('../../src/components/base/projectsApi.js', () => ({
  fetchProjects: vi.fn(async () => ({ projects: [], lastOpened: '' })),
  saveProjects: vi.fn(async () => ({ ok: true })),
}))

let clipboard, backupStore, cloudSync

beforeEach(async () => {
  memLS.clear()
  memKV.clear()
  vi.resetModules()
  localStorage.clear()
  // 重置 fetch mock（默认成功返回 JSON）
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    text: async () => JSON.stringify({ ok: true, msg: 'sync ok' }),
  })))
  clipboard = await import('../../src/components/base/clipboard.js')
  backupStore = await import('../../src/components/base/backupStore.js')
  cloudSync = await import('../../src/components/base/cloudSync.js')
})

// ════════════════════════════════════════════════════════════════
// 1. clipboard.js —— sanitizePastedText 纯函数清洗
// ════════════════════════════════════════════════════════════════
describe('clipboard.js · sanitizePastedText', () => {
  it('空 / 非字符串输入返回空串', () => {
    expect(clipboard.sanitizePastedText('')).toBe('')
    expect(clipboard.sanitizePastedText(null)).toBe('')
    expect(clipboard.sanitizePastedText(undefined)).toBe('')
  })

  it('去除零宽 / BOM / 软连字符 / LRM / RLM / WJ 等不可见字符', () => {
    const raw = 'a\u200bb\uFEFFc\u00add\u200ee\u200ff\u2060g'
    expect(clipboard.sanitizePastedText(raw)).toBe('abcdefg')
  })

  it('去除 C0 控制字符但保留换行 \\n', () => {
    const raw = 'x\u0001y\u0007z\u001f\nw'
    expect(clipboard.sanitizePastedText(raw)).toBe('xyz\nw')
  })

  it('\\r\\n 与 \\r 统一为 \\n', () => {
    expect(clipboard.sanitizePastedText('a\r\nb\rc')).toBe('a\nb\nc')
  })

  it('Tab 分隔 → 单个空格；连续空格 → 单个空格', () => {
    expect(clipboard.sanitizePastedText('a\t\tb')).toBe('a b')
    expect(clipboard.sanitizePastedText('a   b    c')).toBe('a b c')
  })

  it('全角空格也压缩为单个半角空格', () => {
    expect(clipboard.sanitizePastedText('a\u3000\u3000b')).toBe('a b')
  })

  it('压缩 3+ 连续换行为 2 个', () => {
    const raw = 'line1\n\n\n\nline2'
    expect(clipboard.sanitizePastedText(raw)).toBe('line1\n\nline2')
  })

  it('去除行首/行尾多余空格并 trim 整体', () => {
    expect(clipboard.sanitizePastedText('  hello world  ')).toBe('hello world')
    expect(clipboard.sanitizePastedText('a \n b ')).toBe('a\nb')
  })

  it('综合脏文本：网页富文本粘贴清洗', () => {
    const raw = '\uFEFF标题\t\t内容\r\n\u200b第二行\u0007\r\n\r\n\r\n 多余空行  '
    expect(clipboard.sanitizePastedText(raw)).toBe('标题 内容\n第二行\n\n多余空行')
  })
})

// ════════════════════════════════════════════════════════════════
// 2. backupStore.js —— LS_KEYS / conversationKeys / exportAll / importAll
// ════════════════════════════════════════════════════════════════
describe('backupStore.js', () => {
  // 注：LS_KEYS / conversationKeys 为模块内部（未 export），通过 exportAll 的导出结构间接断言
  it('LS_KEYS 含 projects / lastOpenedProject / app_settings 等权威键（经 exportAll 导出 ls 断言）', async () => {
    memLS.set('projects', JSON.stringify([{ id: 'p1', name: 'P1' }]))
    memLS.set('lastOpenedProject', JSON.stringify('p1'))
    memLS.set('app_settings', JSON.stringify({ theme: 'dark' }))
    memLS.set('agent_skills', JSON.stringify({}))
    memLS.set('accounts', JSON.stringify({})) // 裸键（storageKeys 中央登记，原 yimao_accounts）
    const out = await backupStore.exportAll()
    for (const k of ['projects', 'lastOpenedProject', 'app_settings', 'agent_skills', 'accounts']) {
      expect(out.ls[k]).toBeDefined()
    }
  })

  it('conversationKeys：按项目 id 生成 agent_conversations_* 键（经 exportAll 收集断言）', async () => {
    memLS.set('projects', JSON.stringify([{ id: 'p1' }, { id: 'p2' }]))
    memLS.set('agent_conversations_canvas-assistant-p1', JSON.stringify([{ id: 'c1' }]))
    memLS.set('agent_active_conversation_id_canvas-assistant-p1', JSON.stringify('c1'))
    memLS.set('agent_conversations_canvas-assistant-p2', JSON.stringify([{ id: 'c2' }]))
    const out = await backupStore.exportAll()
    expect(out.ls['agent_conversations_canvas-assistant-p1']).toBeTypeOf('object')
    expect(out.ls['agent_active_conversation_id_canvas-assistant-p1']).toBeTypeOf('string')
    expect(out.ls['agent_conversations_canvas-assistant-p2']).toBeTypeOf('object')
  })

  it('exportAll 返回 {version:2, type:"yimao-backup", ls, canvas} 结构', async () => {
    memLS.set('projects', JSON.stringify([{ id: 'p1', name: 'P1' }]))
    memLS.set('app_settings', JSON.stringify({ theme: 'dark' }))
    memKV.set('canvas-state-v1-p1', { nodes: [{ id: 'n1' }], edges: [] })
    const out = await backupStore.exportAll()
    expect(out.version).toBe(2)
    expect(out.type).toBe('yimao-backup')
    expect(typeof out.exportedAt).toBe('string')
    expect(out.ls).toBeTypeOf('object')
    expect(out.ls.projects).toBeTypeOf('object')
    expect(out.ls.app_settings).toBeTypeOf('object')
    expect(out.canvas).toBeTypeOf('object')
    expect(out.canvas.p1).toEqual({ nodes: [{ id: 'n1' }], edges: [] })
  })

  it('exportAll 收集 AI 会话键（按项目动态）', async () => {
    memLS.set('projects', JSON.stringify([{ id: 'pX' }]))
    memLS.set('agent_conversations_canvas-assistant-pX', JSON.stringify([{ id: 'c1' }]))
    const out = await backupStore.exportAll()
    expect(out.ls['agent_conversations_canvas-assistant-pX']).toBeTypeOf('object')
  })

  it('importAll 把 ls 写回 localStorage（调用方负责 reload）', async () => {
    const backup = {
      version: 2,
      type: 'yimao-backup',
      ls: { projects: [{ id: 'p9', name: 'P9' }], app_settings: { lang: 'zh' } },
      canvas: { p9: { nodes: [{ id: 'n9' }], edges: [{ id: 'e9' }] } },
    }
    const res = await backupStore.importAll(backup)
    expect(res.ok).toBe(true)
    expect(res.ls).toBe(2)
    expect(res.canvas).toBe(1)
    expect(JSON.parse(memLS.get('projects'))).toEqual([{ id: 'p9', name: 'P9' }])
    expect(memKV.get('canvas-state-v1-p9')).toEqual({ nodes: [{ id: 'n9' }], edges: [{ id: 'e9' }] })
  })

  it('importAll 非空画布写回 KV，空画布被 skip 不计入', async () => {
    const backup = {
      version: 2,
      type: 'yimao-backup',
      ls: {},
      canvas: { empty: { nodes: [], edges: [] }, full: { nodes: [{ id: 'n' }], edges: [] } },
    }
    const res = await backupStore.importAll(backup)
    expect(res.canvas).toBe(1) // 仅 full 计入
    expect(memKV.has('canvas-state-v1-empty')).toBe(false)
    expect(memKV.has('canvas-state-v1-full')).toBe(true)
  })

  it('importAll 非法入参返回 ok:false', async () => {
    expect((await backupStore.importAll(null)).ok).toBe(false)
    expect((await backupStore.importAll('bad')).ok).toBe(false)
  })

  it('backupToBlob 产出 JSON Blob', () => {
    const blob = backupStore.backupToBlob({ version: 2, type: 'yimao-backup', ls: {}, canvas: {} })
    expect(blob).toBeInstanceOf(Blob)
  })
})

// ════════════════════════════════════════════════════════════════
// 3. cloudSync.js —— callGateway 锁 / upload 不同步过滤 / download 写回
// ════════════════════════════════════════════════════════════════
describe('cloudSync.js', () => {
  it('callGateway：未配置有效 GAS URL 抛错', async () => {
    const eng = cloudSync.CloudSyncEngine
    const saved = eng.config.gasUrl
    eng.config.gasUrl = 'https://script.google.com/macros/s/填入你的URL/exec'
    await expect(eng.callGateway('push_data', {})).rejects.toThrow('未配置有效的 GAS URL')
    eng.config.gasUrl = saved
  })

  it('callGateway：isSyncing 时抛"系统正在通信中"', async () => {
    const eng = cloudSync.CloudSyncEngine
    eng.isSyncing = true
    await expect(eng.callGateway('push_data', {})).rejects.toThrow('系统正在通信中')
    eng.isSyncing = false
  })

  it('callGateway：成功后重置 isSyncing 并解析 JSON', async () => {
    const eng = cloudSync.CloudSyncEngine
    const r = await eng.callGateway('push_data', { a: 1 })
    expect(r.ok).toBe(true)
    expect(eng.isSyncing).toBe(false)
  })

  it('uploadConfig：收集的键 = LS_KEYS 减去不同步键（不含 lastOpenedProject / asset_library / 会话键）', async () => {
    // 写入一组本地数据：包含同步键、不同步键、会话键
    memLS.set('projects', JSON.stringify([{ id: 'p1' }]))
    memLS.set('app_settings', JSON.stringify({ theme: 'dark' }))           // 应同步
    memLS.set('lastOpenedProject', JSON.stringify('p1'))                    // 不应同步
    memLS.set('asset_library', JSON.stringify([{ id: 'a1' }]))              // 不应同步（裸键，原 yimao_asset_library）
    memLS.set('agent_conversations_canvas-assistant-p1', JSON.stringify([])) // 不应同步

    let sent = null
    vi.stubGlobal('fetch', vi.fn(async (_url, opts) => {
      sent = JSON.parse(opts.body)
      return { ok: true, text: async () => JSON.stringify({ ok: true, msg: 'ok' }) }
    }))

    const res = await cloudSync.uploadConfig()
    expect(res.ok).toBe(true)
    // 网关 body 的 data 应为 cloud_config
    expect(sent.action).toBe('push_data')
    const data = sent.data
    expect(data.type).toBe('cloud_config')
    expect(data.version).toBe(4)
    // 同步键存在
    expect(data.data.projects).toBeTypeOf('object')
    expect(data.data.app_settings).toBeTypeOf('object')
    // 不同步键不应出现在同步数据中
    expect(data.data.lastOpenedProject).toBeUndefined()
    expect(data.data.asset_library).toBeUndefined()
    expect(data.data['agent_conversations_canvas-assistant-p1']).toBeUndefined()
  })

  it('downloadConfig：云端数据写回 localStorage', async () => {
    const cloud = {
      type: 'cloud_config',
      version: 4,
      data: { projects: [{ id: 'p2', name: 'P2' }], app_settings: { theme: 'light' } },
    }
    // pull 走 callGateway('pull_data') → 这里让 fetch 返回 pull 结果 data
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ ok: true, msg: 'ok', data: cloud }),
    })))
    const res = await cloudSync.downloadConfig()
    expect(res.ok).toBe(true)
    expect(res.count).toBeGreaterThan(0)
    // 写回校验
    expect(JSON.parse(memLS.get('projects'))).toEqual([{ id: 'p2', name: 'P2' }])
    expect(JSON.parse(memLS.get('app_settings'))).toEqual({ theme: 'light' })
  })

  it('downloadConfig：云端无数据返回 hasCloud:false', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ ok: true, msg: 'ok' }), // 无 data 字段
    })))
    const res = await cloudSync.downloadConfig()
    expect(res.ok).toBe(false)
    expect(res.hasCloud).toBe(false)
  })
})
