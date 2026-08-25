/**
 * d3dPersistence 单测（director3d 工程持久化收口协议，docs/45）。
 * 覆盖 T1~T6 断言：
 *   T1 写入时图片外置（base64→/files/ URL，data: 残留 0）
 *   T2 后端不可达时降级（saveInline 返回 null → 保留原 base64，不清图）
 *   T3 读还原放行本地图片地址（data: / /files/ 相对 / 绝对 http 都放行，垃圾拒绝）
 *   T4 启动读数据源选择（KV/LS/迁移幂等）
 *   T5 键映射（沿用原键、不造前缀）
 *   T6 姿势库不进 KV（isProjectPersistenceKey 判定）
 * 策略：纯函数直接断言；externalize 注入 mock save，不依赖真实落盘。
 */
import { describe, it, expect, vi } from 'vitest'
import {
  projectKvKey, isProjectImageUrl, isProjectPersistenceKey,
  externalizeProjectImages, pickProjectSource,
} from '../../src/components/base/d3dPersistence.js'

const png = 'data:image/png;base64,iVBORw0KGgo='
const FILES = (n) => `http://127.0.0.1:18080/files/director3d/${n}.png`

// ── T5 键映射 ──────────────────────────────────────────
describe('projectKvKey — 键映射', () => {
  it('沿用传入的工程键（不造新前缀）', () => {
    expect(projectKvKey('director3d-project-abc')).toBe('director3d-project-abc')
    expect(projectKvKey('director3d-project')).toBe('director3d-project')
  })
  it('缺省回退默认工程键', () => {
    expect(projectKvKey()).toBe('director3d-project')
  })
})

// ── T6 工程键判定（姿势库不进 KV）──────────────────────
describe('isProjectPersistenceKey — 工程键判定', () => {
  it('director3d-project 前缀为真', () => {
    expect(isProjectPersistenceKey('director3d-project')).toBe(true)
    expect(isProjectPersistenceKey('director3d-project-abc')).toBe(true)
  })
  it('姿势库等非工程键为假', () => {
    expect(isProjectPersistenceKey('director3d-custom-poses')).toBe(false)
    expect(isProjectPersistenceKey('other-key')).toBe(false)
    expect(isProjectPersistenceKey(undefined)).toBe(false)
  })
})

// ── T3 读还原图片地址判定 ──────────────────────────────
describe('isProjectImageUrl — 图片地址判定', () => {
  it('放行 data:image base64', () => {
    expect(isProjectImageUrl('data:image/png;base64,xxx')).toBe(true)
    expect(isProjectImageUrl('data:image/jpeg;base64,yyy')).toBe(true)
  })
  it('放行本地 /files/ 相对地址', () => {
    expect(isProjectImageUrl('/files/director3d/a.png')).toBe(true)
  })
  it('放行本地 /files/ 绝对 http 地址', () => {
    expect(isProjectImageUrl('http://127.0.0.1:18080/files/director3d/a.png')).toBe(true)
  })
  it('拒绝垃圾 / 空 / 外链', () => {
    expect(isProjectImageUrl('垃圾字符串')).toBe(false)
    expect(isProjectImageUrl('')).toBe(false)
    expect(isProjectImageUrl('https://cdn.example.com/a.png')).toBe(false)
    expect(isProjectImageUrl(undefined)).toBe(false)
    expect(isProjectImageUrl(null)).toBe(false)
  })
})

// ── T1 写入外置（成功路径）─────────────────────────────
describe('externalizeProjectImages — 写入外置', () => {
  const baseProject = () => ({
    reference: { image: png },
    shots: [
      { id: 's1', thumbnail: 'data:image/jpeg;base64,thumb1' },
      { id: 's2', thumbnail: 'data:image/png;base64,thumb2' },
    ],
  })

  it('成功替换 reference + 每镜头 thumbnail，data: 残留 0', async () => {
    const save = vi.fn()
      .mockResolvedValueOnce(FILES('a'))
      .mockResolvedValueOnce(FILES('b'))
      .mockResolvedValueOnce(FILES('c'))
    const r = await externalizeProjectImages(baseProject(), save)
    expect(save).toHaveBeenCalledTimes(3)
    expect(r.project.reference.image).toBe(FILES('a'))
    expect(r.project.shots[0].thumbnail).toBe(FILES('b'))
    expect(r.project.shots[1].thumbnail).toBe(FILES('c'))
    expect(r.droppedCount).toBe(3)
    // 无 data: 残留（R4）
    expect(JSON.stringify(r.project)).not.toContain('data:')
  })

  it('不 mutate 入参（返回新对象）', async () => {
    const save = vi.fn().mockResolvedValue(FILES('x'))
    const src = baseProject()
    await externalizeProjectImages(src, save)
    expect(src.reference.image).toBe(png) // 原对象未被改
  })

  it('已是文件URL的字段不动、不计入替换', async () => {
    const save = vi.fn()
    const proj = { reference: { image: FILES('already') }, shots: [{ id: 's1', thumbnail: '/files/director3d/thumb.png' }] }
    const r = await externalizeProjectImages(proj, save)
    expect(save).not.toHaveBeenCalled()
    expect(r.droppedCount).toBe(0)
    expect(r.project.reference.image).toBe(FILES('already'))
  })
})

// ── T2 降级：落盘失败保留 base64 ───────────────────────
describe('externalizeProjectImages — 后端不可达降级', () => {
  it('saveInline 全部返回 null → 保留原 base64，不清图', async () => {
    const save = vi.fn().mockResolvedValue(null)
    const proj = { reference: { image: png }, shots: [{ id: 's1', thumbnail: 'data:image/png;base64,t' }] }
    const r = await externalizeProjectImages(proj, save)
    expect(r.project.reference.image).toBe(png)
    expect(r.project.shots[0].thumbnail).toBe('data:image/png;base64,t')
    expect(r.droppedCount).toBe(0)
  })

  it('saveInline 返回原值视为失败 → 保留', async () => {
    const save = vi.fn().mockResolvedValue(png)
    const r = await externalizeProjectImages({ reference: { image: png }, shots: [] }, save)
    expect(r.project.reference.image).toBe(png)
    expect(r.droppedCount).toBe(0)
  })
})

// ── T4 读取源选择 ──────────────────────────────────────
describe('pickProjectSource — 源选择与迁移判定', () => {
  it('KV 有 → 用 KV，不回写', () => {
    const pick = pickProjectSource({ shots: [] }, { shots: [{ id: 'ls' }] })
    expect(pick.from).toBe('kv')
    expect(pick.migrateToKv).toBe(false)
  })
  it('KV 空 + LS 有 → 用 LS，需回写 KV（一次性迁移）', () => {
    const pick = pickProjectSource(null, { shots: [{ id: 'ls' }] })
    expect(pick.from).toBe('local')
    expect(pick.migrateToKv).toBe(true)
    expect(pick.project.shots[0].id).toBe('ls')
  })
  it('都空 → null，不回写', () => {
    const pick = pickProjectSource(null, null)
    expect(pick.project).toBeNull()
    expect(pick.migrateToKv).toBe(false)
  })
})