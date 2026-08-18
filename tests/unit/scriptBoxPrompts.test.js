import { describe, it, expect } from 'vitest'
import {
  ZgPrompt, dialogueText, hlAt, matchAsset, collectAssets, buildShotPrompts,
  buildShots, buildAssets, IMAGE_GEN_TYPES, getImageGenSys, ASSET_TEMPLATES, patchShots,
} from '../../src/components/base/scriptBoxPrompts.js'

describe('剧本盒纯函数 §2.7/2.17', () => {
  it('ZgPrompt：描述 + 模板拼接，style 前置', () => {
    const r = ZgPrompt('character', '蓝发少女', '皮克斯')
    expect(r).toContain('[视觉风格：皮克斯]')
    expect(r).toContain('蓝发少女')
    expect(r).toContain(ASSET_TEMPLATES.character) // 默认模板
  })

  it('ZgPrompt：描述无句号自动补句号', () => {
    const r = ZgPrompt('scene', '森林空地')
    expect(r).toMatch(/森林空地。/) // 末尾补了句号再接模板
  })

  it('ZgPrompt：未知 category 回退 character', () => {
    const r = ZgPrompt('unknown', 'x', '')
    expect(r).toContain(ASSET_TEMPLATES.character)
  })

  it('dialogueText：台词/旁白格式化', () => {
    expect(dialogueText([{ kind: '台词', role: '小马', text: '你好' }])).toBe('小马: 你好')
    expect(dialogueText([{ kind: '旁白', text: '天黑了' }])).toBe('[旁白] 天黑了')
    expect(dialogueText([])).toBe('')
    expect(dialogueText([{ role: 'A', text: '1' }, { role: 'B', text: '2' }])).toBe('A: 1 / B: 2')
  })

  it('hlAt：只高亮真实资产名（传资产列表），非资产 @ 不高亮', () => {
    const r = hlAt('@小红帽 走进 @幽暗森林 还有 @路人', ['小红帽', '幽暗森林'])
    expect(r).toContain('<span class="at">@小红帽</span>')
    expect(r).toContain('<span class="at">@幽暗森林</span>')
    expect(r).not.toContain('<span class="at">@路人</span>') // 非资产名不高亮
    expect(r).toContain('走进')
  })

  it('hlAt：长名优先匹配，@小马妈妈 不被 @小马 吃掉', () => {
    const r = hlAt('@小马妈妈 和 @小马', ['小马', '小马妈妈'])
    expect(r).toContain('<span class="at">@小马妈妈</span>')
    expect(r).toContain('<span class="at">@小马</span>')
  })

  it('hlAt：未传资产列表/空列表 → 不高亮任何 @，仅做 XSS 转义', () => {
    expect(hlAt('@小红帽 你好')).not.toContain('class="at"')
    expect(hlAt('@小红帽', [])).not.toContain('class="at"')
    expect(hlAt('<script>@x')).toContain('&lt;script&gt;') // XSS 转义仍生效
  })

  it('matchAsset：@名 后一位非中英数才算合法（防误匹配）', () => {
    expect(matchAsset('@小马 吃草', '小马')).toBe(true)
    expect(matchAsset('@小马妈妈 来了', '小马')).toBe(false) // @小马妈妈 不应匹配 @小马
    expect(matchAsset('@小马', '小马')).toBe(true)
    expect(matchAsset('没有引用', '小马')).toBe(false)
  })

  it('collectAssets：镜头 @名 匹配到有图资产', () => {
    const shot = { description: '@小红帽 走进 @幽暗森林' }
    const assets = [
      { id: 'a1', name: '小红帽', imageUrl: '/files/r.png' },
      { id: 'a2', name: '幽暗森林', imageUrl: '' }, // 无图不算
      { id: 'a3', name: '大灰狼', imageUrl: '/files/w.png' },
    ]
    const out = collectAssets(shot, assets)
    expect(out).toHaveLength(1)
    expect(out[0].url).toBe('/files/r.png')
  })

  it('collectAssets：无资产或无图返回空', () => {
    expect(collectAssets({ description: '@x' }, [])).toEqual([])
    expect(collectAssets(null, [{ name: 'x', imageUrl: '/f' }])).toEqual([])
  })

  it('buildShotPrompts：生成 prompt/videoPrompt 并保留 @资产', () => {
    const shot = { description: '@小马 奔跑', shotType: '中景', lighting: '自然光', motion: '推', duration: '5s', dialogue: [{ role: '小马', text: '冲' }], sound: '风声' }
    const r = buildShotPrompts(shot)
    expect(r.prompt).toContain('@小马')
    expect(r.prompt).toContain('中景')
    expect(r.videoPrompt).toContain('镜头时长 5s')
    expect(r.videoPrompt).toContain('小马: 冲')
  })

  it('buildShots：生成 n 个分镜，id/index 连续，无副作用', () => {
    const shots = buildShots(3)
    expect(shots).toHaveLength(3)
    expect(shots.map((s) => s.id)).toEqual([1, 2, 3])
    expect(shots.map((s) => s.index)).toEqual([1, 2, 3])
    expect(shots.every((s) => s.prompt && s.videoPrompt)).toBe(true)
  })

  it('buildAssets：生成角色/场景/道具三类资产，prompt 走 ZgPrompt', () => {
    const assets = buildAssets('皮克斯')
    expect(assets.length).toBeGreaterThan(0)
    const cats = new Set(assets.map((a) => a.category))
    expect(cats.has('character')).toBe(true)
    expect(cats.has('scene')).toBe(true)
    expect(cats.has('prop')).toBe(true)
    expect(assets.every((a) => a.prompt.includes('[视觉风格：皮克斯]'))).toBe(true)
    expect(assets.every((a) => a.has === false)).toBe(true)
  })

  it('IMAGE_GEN_TYPES 含 4 种（keyframe/grid4/grid9/topdown）', () => {
    expect(Object.keys(IMAGE_GEN_TYPES).sort()).toEqual(['grid4', 'grid9', 'keyframe', 'topdown'])
  })

  it('getImageGenSys：自定义优先，否则内置', () => {
    expect(getImageGenSys('keyframe')).toBe(IMAGE_GEN_TYPES.keyframe.sys)
    expect(getImageGenSys('keyframe', { keyframe: '自定义系统提示词' })).toBe('自定义系统提示词')
    expect(getImageGenSys('unknown')).toBe(IMAGE_GEN_TYPES.keyframe.sys) // 回退默认
  })

  it('patchShots：字符串字段更新第 idx 个分镜（不可变）', () => {
    const shots = [{ id: 's1', duration: '3s' }, { id: 's2', duration: '5s' }]
    const next = patchShots(shots, 0, 'duration', '7s')
    expect(next[0]).toMatchObject({ id: 's1', duration: '7s' })
    expect(next[1]).toMatchObject({ id: 's2', duration: '5s' }) // 未改动
    expect(next).not.toBe(shots) // 新引用（不可变）
    expect(shots[0].duration).toBe('3s') // 原数组不受影响
  })

  it('patchShots：对象 patch 一次性合并多字段', () => {
    const shots = [{ id: 's1', prompt: '', videoPrompt: '' }]
    const next = patchShots(shots, 0, { prompt: 'p', videoPrompt: 'v' })
    expect(next[0]).toMatchObject({ id: 's1', prompt: 'p', videoPrompt: 'v' })
  })
})
