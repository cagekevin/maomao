// @vitest-environment jsdom
/**
 * scriptBoxPromptResolver —— playbook 单一数据源读取自测（§4.1 解析层）。
 * 覆盖：内置默认 / 自定义覆盖 / 悬挂回退 / 约束+负面读取 / 生图类型取当前 playbook。
 * run: npm run test:unit -- tests/unit/scriptBoxPromptResolver.test.js
 */
import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { __resetCustomCache } from '../../src/components/scriptbox/scriptBoxPlaybookStore.ts'
import { resolveSystem, resolveImageGenSys, resolveConstraints, resolveNegatives, resolveAssetTemplates } from '../../src/components/base/scriptBoxPromptResolver.ts'
import { PLAYBOOKS_KEY } from '../../src/components/scriptbox/scriptBoxPlaybookStore.ts'

const LKEY = 'yimao:' + PLAYBOOKS_KEY

beforeEach(() => {
  __resetCustomCache()
  localStorage.clear()
})
afterEach(() => {
  __resetCustomCache()
  localStorage.clear()
})

/** 写自定义 playbook 到 localStorage（模拟另存为/编辑后落盘）。 */
function seedCustom(list) {
  localStorage.setItem(LKEY, JSON.stringify(list))
}

describe('resolveSystem（script/shot/audit/qg）', () => {
  it('内置 manga 各段非空', () => {
    expect(resolveSystem('manga', 'script')).toContain('编剧')
    expect(resolveSystem('manga', 'shot')).toContain('分镜设计师')
    expect(resolveSystem('manga', 'audit')).toContain('审查')
    expect(resolveSystem('manga', 'qg')).toContain('不可覆盖')
  })

  it('自定义 playbook 优先于内置', () => {
    seedCustom({ 'pb1': { id: 'pb1', label: '我的', script: '自定义剧本段', shot: '', audit: '', qg: '', assetTemplates: {}, imageGenTemplates: {}, constraints: {}, negative: {} } })
    expect(resolveSystem('pb1', 'script')).toBe('自定义剧本段')
  })
})

describe('resolveConstraints / resolveNegatives（约束+负面唯一来源）', () => {
  it('内置 manga 默认无约束无负面', () => {
    expect(resolveConstraints('manga')).toEqual({ image: '', video: '' })
    expect(resolveNegatives('manga')).toEqual({ common: '', image: '', video: '' })
  })

  it('自定义 playbook 的约束/负面被正确读出', () => {
    seedCustom({
      'pb2': {
        id: 'pb2', label: '种草', script: '', shot: '', audit: '', qg: '',
        assetTemplates: {}, imageGenTemplates: {},
        constraints: { image: '竖屏', video: '口播' },
        negative: { common: '禁止群演', image: '无字幕', video: '无水印' },
      }
    })
    expect(resolveConstraints('pb2')).toEqual({ image: '竖屏', video: '口播' })
    expect(resolveNegatives('pb2')).toEqual({ common: '禁止群演', image: '无字幕', video: '无水印' })
  })
})

describe('resolveImageGenSys / resolveAssetTemplates', () => {
  it('取当前 playbook 的生图类型与资产模板，而非恒为漫剧', () => {
    seedCustom({
      'pb3': {
        id: 'pb3', label: '定制', script: '', shot: '', audit: '', qg: '',
        assetTemplates: { character: '定制角色模板', scene: '', prop: '' },
        imageGenTemplates: { keyframe: { label: '关键帧', sys: '定制关键帧段' }, grid4: { label: '四宫格', sys: '' } },
        constraints: {}, negative: {},
      }
    })
    expect(resolveImageGenSys('pb3', 'keyframe').sys).toBe('定制关键帧段')
    expect(resolveAssetTemplates('pb3').character).toBe('定制角色模板')
    // 未配置的类型回退到该 playbook 的 keyframe，而非 manga
    expect(resolveImageGenSys('pb3', 'grid9').sys).toBe('定制关键帧段')
  })
})

describe('getPlaybook 悬挂与回退', () => {
  it('未知 id 回退内置漫剧（不抛错）', () => {
    expect(resolveSystem('ghost-id', 'script')).toContain('编剧')
  })
})