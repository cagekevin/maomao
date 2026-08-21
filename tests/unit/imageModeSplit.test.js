import { describe, it, expect } from 'vitest'
import { imageModeLooksLikePerReferenceEdit, buildPerReferenceGenerations } from '../../src/components/agent/runtime/useAgentChat.js'

/**
 * TASK-008 图像模式多参考图一对一拆分
 * 验证语义判断（对齐大雄 agentLooksLikePerReferenceEdit）+ 拆分生成（agentExpandPerReferenceGenerations）。
 */
describe('TASK-008 图像模式「每参考图一对一」拆分', () => {
  describe('imageModeLooksLikePerReferenceEdit 语义判断', () => {
    const cases = [
      // 命中（应返回 true）
      ['分别把这两张图变成白色和黑色', 2, true],
      ['每张图各生成一张高清图', 3, true],
      ['把每张图各自改一下', 3, true],
      ['图1变白、图2变黑', 2, true],
      ['图1变成红色图2变成蓝色', 2, true],
      ['把每张都改成红色', 3, true],
      ['这两张图都变成卡通风格', 2, true],
      ['全部改成黑白', 2, true],
      ['逐一给每张图加上文字', 4, true],
      // 不应命中（融合/底图/单图/无关）
      ['把这两张图融合在一起', 2, false],
      ['以图1为底图加背景', 2, false],
      ['生成一张赛博朋克猫', 2, false],
      ['参考这张图的构图生成', 1, false], // 单图不拆
      ['把这两张合并成一张全景', 2, false],
      ['', 2, false], // 空文本
      ['分别', 1, false], // 单图即使有"分别"也不拆
    ]
    it.each(cases)('%s (n=%i) → %s', (text, n, expected) => {
      expect(imageModeLooksLikePerReferenceEdit(text, n)).toBe(expected)
    })
  })

  describe('buildPerReferenceGenerations 拆分生成', () => {
    const refs = ['http://r/ref1.png', 'http://r/ref2.png', 'http://r/ref3.png']
    const panel = { ratio: '9:16', resolution: '2K' }
    const gens = buildPerReferenceGenerations(refs, '把每张都改成红色', panel)

    it('每张参考图对应一个 generation，数量 = 图数', () => {
      expect(gens).toHaveLength(3)
    })

    it('每步 attachment_indices 只含自己那一张（0-based）', () => {
      gens.forEach((g, i) => {
        expect(g.attachment_indices).toEqual([i])
        expect(g.use_attachments).toBe(true)
      })
    })

    it('每步依赖模式为 none（独立批），不依赖前序', () => {
      gens.forEach((g) => {
        expect(g.depends_on_previous).toBe(false)
        expect(g.dependency_mode).toBe('none')
      })
    })

    it('id 唯一且带 ref 序号，title 标注参考图 N', () => {
      const ids = gens.map((g) => g.id)
      expect(new Set(ids).size).toBe(3)
      gens.forEach((g, i) => {
        expect(g.id).toContain(`_ref${i + 1}`)
        expect(g.title).toBe(`参考图${i + 1}`)
      })
    })

    it('继承面板比例/分辨率，prompt 复用用户提示词', () => {
      gens.forEach((g) => {
        expect(g.ratio).toBe('9:16')
        expect(g.resolution).toBe('2K')
        expect(g.prompt).toBe('把每张都改成红色')
      })
    })
  })
})
