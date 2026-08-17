// @vitest-environment node
/**
 * backupStore 单测（批 1-1）。
 * 覆盖：LS_KEYS 清单读/写、conversationKeys 动态键、exportAll 打包、importAll 回写、
 * backupToBlob 序列化、当前项目回退、空输入防护。
 * 策略：storageAdapter 走真实内存 localStorage（setup.mjs 提供），projectStore 用内存 stub。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { sGet, sSet } from '../../src/components/base/storageAdapter.js'

// ── stub projectStore：内存画布快照 ──
const canvasStore = new Map()
vi.mock('../../src/components/base/projectStore.js', () => ({
  loadCanvasState: vi.fn(async (id) => canvasStore.get(id) || null),
  saveCanvasState: vi.fn(async (id, nodes, edges) => {
    canvasStore.set(id, { nodes, edges })
    return { ok: true }
  }),
}))

const { exportAll, importAll, backupToBlob } = await import('../../src/components/base/backupStore.js')

beforeEach(() => {
  localStorage.clear()
  canvasStore.clear()
})

describe('backupStore — 导出 exportAll', () => {
  it('收集 LS_KEYS 清单里存在的值并打包', async () => {
    sSet('projects', JSON.stringify([{ id: 'p1', name: 'P1' }]))
    sSet('app_settings', JSON.stringify({ theme: 'dark' }))
    sSet('yimao_node_prefs', JSON.stringify({ textNode: { model: 'x' } }))
    canvasStore.set('p1', { nodes: [{ id: 'n1' }], edges: [] })

    const backup = await exportAll()
    expect(backup.version).toBe(2)
    expect(backup.type).toBe('yimao-backup')
    expect(backup.ls.projects).toEqual([{ id: 'p1', name: 'P1' }])
    expect(backup.ls.app_settings).toEqual({ theme: 'dark' })
    expect(backup.ls.yimao_node_prefs).toEqual({ textNode: { model: 'x' } })
    expect(backup.canvas.p1).toEqual({ nodes: [{ id: 'n1' }], edges: [] })
    expect(typeof backup.exportedAt).toBe('string')
  })

  it('无项目的兜底：当前项目 id 回退为 default 且不抛错', async () => {
    const backup = await exportAll()
    expect(backup.ls).toBeDefined()
    // default 项目无快照 → canvas 为空对象
    expect(backup.canvas).toEqual({})
  })

  it('动态收集 AI 会话键（按项目隔离）', async () => {
    sSet('projects', JSON.stringify([{ id: 'p1' }, { id: 'p2' }]))
    sSet('agent_conversations_canvas-assistant-p1', JSON.stringify({ messages: [] }))
    sSet('agent_active_conversation_id_canvas-assistant-p1', 'c1')
    const backup = await exportAll()
    expect(backup.ls['agent_conversations_canvas-assistant-p1']).toEqual({ messages: [] })
    expect(backup.ls['agent_active_conversation_id_canvas-assistant-p1']).toBe('c1')
    // p2 没有会话键 → 不出现
    expect(backup.ls['agent_conversations_canvas-assistant-p2']).toBeUndefined()
  })
})

describe('backupStore — 导入 importAll', () => {
  it('写回 ls 全部键 + 画布快照，返回计数', async () => {
    const backup = {
      version: 2,
      type: 'yimao-backup',
      ls: { app_settings: { theme: 'light' }, projects: [{ id: 'pa' }] },
      canvas: { pa: { nodes: [{ id: 'x' }], edges: [{ id: 'e' }] } },
    }
    const res = await importAll(backup)
    expect(res.ok).toBe(true)
    expect(res.ls).toBe(2)
    expect(res.canvas).toBe(1)
    expect(JSON.parse(sGet('app_settings'))).toEqual({ theme: 'light' })
    expect(canvasStore.get('pa')).toEqual({ nodes: [{ id: 'x' }], edges: [{ id: 'e' }] })
  })

  it('空 ls/canvas 时计数归零但不报错', async () => {
    const res = await importAll({ ls: {}, canvas: {} })
    expect(res.ok).toBe(true)
    expect(res.ls).toBe(0)
    expect(res.canvas).toBe(0)
  })

  it('无效备份（非对象）直接失败', async () => {
    const res = await importAll(null)
    expect(res.ok).toBe(false)
    expect(res.error).toContain('无效')
    expect(res.ls).toBe(0)
  })

  it('canvas 快照 saveCanvasState 返回 skipped 时不计入 canvas 计数', async () => {
    const { saveCanvasState } = await import('../../src/components/base/projectStore.js')
    saveCanvasState.mockImplementationOnce(async () => ({ skipped: true }))
    const res = await importAll({ ls: {}, canvas: { skip1: { nodes: [], edges: [] } } })
    expect(res.canvas).toBe(0)
  })
})

describe('backupStore — backupToBlob', () => {
  it('产出 JSON 序列化的 Blob', () => {
    const backup = { version: 2, type: 'yimao-backup', ls: { a: 1 }, canvas: {} }
    const blob = backupToBlob(backup)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/json')
  })
})
