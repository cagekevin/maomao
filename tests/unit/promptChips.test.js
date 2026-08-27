// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import {
  PROMPT_CHIP_RE,
  serializeDOM,
  renderPromptToNodes,
  buildChipEl,
  resolvePromptChips,
  isChipEl,
} from '../../src/components/base/promptChips.js'

/** 把 renderPromptToNodes 的 Node[] append 到一个根 div */
function renderToDom(text, metaMap) {
  const root = document.createElement('div')
  for (const node of renderPromptToNodes(text, metaMap)) root.appendChild(node)
  return root
}

describe('promptChips 序列化往返', () => {
  it('纯文本往返不变', () => {
    const input = '你好，描述一个画面'
    expect(serializeDOM(renderToDom(input, null))).toBe(input)
  })

  it('带换行的纯文本往返不变（Shift+Enter 换行）', () => {
    const input = '第一行\n第二行\n第三行'
    expect(serializeDOM(renderToDom(input, null))).toBe(input)
  })

  it('@{id:label} 芯片往返不变（含缩略图 metaMap）', () => {
    const input = '参考 @{img-1:人物} 生成'
    const metaMap = new Map([['img-1', { kind: 'image', url: 'http://x/a.png' }]])
    const root = renderToDom(input, metaMap)
    // 反序列化应生成芯片元素
    const chip = root.querySelector('[data-ref-id="img-1"]')
    expect(chip).not.toBeNull()
    // 序列化回原字符串
    expect(serializeDOM(root)).toBe(input)
  })

  it('文本芯片（无缩略图）显示 @ 图标而非缩略图', () => {
    const metaMap = new Map([['t-1', { kind: 'text' }]])
    const root = renderToDom('@{t-1:参考文本}', metaMap)
    const chip = root.querySelector('[data-ref-id="t-1"]')
    expect(chip).not.toBeNull()
    expect(chip.querySelector('img')).toBeNull()
  })

  it('旧数据（无 @{} 的纯文本 @素材名）原样显示为文字、不生成芯片', () => {
    const root = renderToDom('引用 @人物 文字', null)
    expect(root.querySelector('[data-ref-id]')).toBeNull()
    expect(root.textContent).toContain('@人物')
  })
})

describe('buildChipEl', () => {
  it('图片素材且带缩略图 → span 内含 img 缩略图', () => {
    const chip = buildChipEl('img-1', '人物', 'image', 'http://x/p.png')
    expect(chip.className).toContain('prompt-chip')
    const img = chip.querySelector('.prompt-chip-thumb')
    expect(img).not.toBeNull()
    expect(img.src).toBe('http://x/p.png')
    expect(chip.getAttribute('data-ref-id')).toBe('img-1')
    expect(chip.contentEditable).toBe('false')
  })

  it('文本素材 → 无缩略图，带 @ 图标', () => {
    const chip = buildChipEl('t-1', '文本', 'text')
    expect(chip.querySelector('img')).toBeNull()
    expect(chip.textContent).toContain('文本')
  })
})

describe('isChipEl', () => {
  it('带 data-ref-id 的元素是芯片', () => {
    const chip = buildChipEl('a', 'b', 'text')
    expect(isChipEl(chip)).toBe(true)
  })
  it('普通文本节点不是芯片', () => {
    expect(isChipEl(document.createTextNode('x'))).toBe(false)
    expect(isChipEl(null)).toBe(false)
  })
})

describe('resolvePromptChips（生成端解析）', () => {
  const refImages = [
    { id: 'img-1', url: 'http://x/1.png' },
    { id: 'img-2', url: 'http://x/2.png' },
  ]
  const refTexts = [{ id: 't-1', label: '参考文本' }]

  it('图片芯片 → 提取为参考图，prompt 替换为 图片N', () => {
    const { text, refImages: out } = resolvePromptChips('用 @{img-1:人物} 生成', refImages, refTexts)
    expect(text).toBe('用 图片1 生成')
    expect(out).toEqual([{ id: 'img-1', url: 'http://x/1.png' }])
  })

  it('同一图多次引用只取一张参考图', () => {
    const { text, refImages: out } = resolvePromptChips('@{img-1:a} 与 @{img-1:b}', refImages, refTexts)
    expect(out).toHaveLength(1)
    expect(text).toContain('图片1')
  })

  it('文本芯片 → 替换为其 label', () => {
    const { text, refImages: out } = resolvePromptChips('根据 @{t-1:参考文本} 生成', refImages, refTexts)
    expect(text).toBe('根据 参考文本 生成')
    expect(out).toHaveLength(0)
  })

  it('找不到对应素材 → 芯片替换为空', () => {
    const { text } = resolvePromptChips('@{ghost:幽灵}', refImages, refTexts)
    expect(text).toBe('')
  })

  it('纯文本无芯片 → 原样返回，无参考图', () => {
    const { text, refImages: out } = resolvePromptChips('普通提示词', refImages, refTexts)
    expect(text).toBe('普通提示词')
    expect(out).toHaveLength(0)
  })
})
