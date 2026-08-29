/**
 * scriptBoxPlaybookIO — 单个 playbook 导出/导入往返（给 AI 改的闭环）。
 * 覆盖：导出含 __meta + 文件名净化；导入解析/净化/归一化/强制 builtin:false；坏输入容错。
 * run: npm run test:unit -- tests/unit/scriptBoxPlaybookIO.test.js
 */
import { describe, it, expect } from 'vitest'
import { exportText, parseImport } from '../../src/components/scriptbox/scriptBoxPlaybookIO.js'

const MANGA = {
  id: 'manga',
  label: '漫剧',
  builtin: true,
  script: '你是顶级爆款短剧编剧…',
  shot: '你是资深分镜设计师…',
  audit: '你是一名提示词审查师…',
  qg: '不可覆盖最终规则…',
  assetTemplates: { character: '模板A', scene: '模板B', prop: '模板C' },
  imageGenTemplates: { keyframe: { label: '关键帧', sys: 'sys1' }, grid4: { label: '四宫格', sys: 'sys2' } },
  constraints: { image: '竖屏', video: '口播' },
  negative: { common: '禁群演', image: '无字幕', video: '无水印' },
}

describe('exportText', () => {
  it('导出含 __meta + 全字段 + 格式化 JSON', () => {
    const { text, filename } = exportText(MANGA)
    const obj = JSON.parse(text)
    expect(obj.__meta.type).toBe('scriptbox-playbook')
    expect(obj.__meta.exportedAt).toBeTypeOf('number')
    expect(obj.label).toBe('漫剧')
    expect(obj.script).toContain('爆款短剧')
    expect(obj.negative.common).toBe('禁群演')
  })

  it('文件名按 label 生成并净化非法字符', () => {
    expect(exportText(MANGA).filename).toBe('playbook-漫剧.json')
    expect(exportText({ label: 'A/B:C*d?' }).filename).toBe('playbook-A_B_C_d.json')
  })
})

describe('parseImport', () => {
  it('导出→导入往返：保留内容、builtin 强制 false（即使源是内置）', () => {
    const { text } = exportText(MANGA)
    const r = parseImport(text)
    expect(r.ok).toBe(true)
    expect(r.playbook.builtin).toBe(false) // 导入一律落为「我的」
    expect(r.playbook.label).toBe('漫剧')
    expect(r.playbook.script).toContain('爆款短剧')
    expect(r.playbook.constraints.video).toBe('口播')
    expect(r.playbook.negative.image).toBe('无字幕')
  })

  it('宽容归一化：缺字段补默认，未知键保留', () => {
    const r = parseImport('{"label":"空配置"}')
    expect(r.ok).toBe(true)
    expect(r.playbook.script).toBe('')
    expect(r.playbook.constraints).toEqual({ image: '', video: '' })
    expect(r.playbook.negative).toEqual({ common: '', image: '', video: '' })
    expect(r.playbook.builtin).toBe(false)
  })

  it('坏输入容错', () => {
    expect(parseImport('not json').ok).toBe(false)
    expect(parseImport('123').ok).toBe(false)
    expect(parseImport('[]').ok).toBe(false)
  })
})