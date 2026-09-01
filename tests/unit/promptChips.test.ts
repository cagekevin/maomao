// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import {
  PROMPT_CHIP_RE,
  serializeDOM,
  renderPromptToNodes,
  buildChipEl,
  resolvePromptChips,
  isChipEl,
  autoLinkAssetsByName,
} from '../../src/components/base/promptChips.ts'

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

  it('@{id:label} 芯片序列化会带上缩略图 URL 段（根治刷新丢图）', () => {
    const input = '参考 @{img-1:人物} 生成'
    const metaMap = new Map([['img-1', { kind: 'image', url: 'http://x/a.png' }]])
    const root = renderToDom(input, metaMap)
    // 反序列化应生成芯片元素
    const chip = root.querySelector('[data-ref-id="img-1"]')
    expect(chip).not.toBeNull()
    // 序列化把缩略图 URL 编码进字符串（|url 段，经 encodeURIComponent）
    const out = serializeDOM(root)
    expect(out).toBe('参考 @{img-1:人物|http%3A%2F%2Fx%2Fa.png} 生成')
    expect(chip.getAttribute('data-ref-thumb')).toBe('http://x/a.png')
  })

  it('序列化后再次反序列化，缩略图从字符串本身恢复（不依赖 metaMap）', () => {
    const serialized = '参考 @{img-1:人物|http%3A%2F%2Fx%2Fa.png} 生成'
    // 关键：传入 null metaMap，验证缩略图靠字符串自带恢复（刷新/重建场景）
    const root = renderToDom(serialized, null)
    const chip = root.querySelector('[data-ref-id="img-1"]')
    expect(chip).not.toBeNull()
    const img = chip.querySelector('.prompt-chip-thumb')
    expect(img).not.toBeNull()
    expect(img.src).toBe('http://x/a.png')
    expect(serializeDOM(root)).toBe(serialized) // 二次序列化稳定
  })

  it('旧格式（无 url 段）仍正确解析，向后兼容', () => {
    const input = '参考 @{img-1:人物} 生成'
    const root = renderToDom(input, null)
    const chip = root.querySelector('[data-ref-id="img-1"]')
    expect(chip).not.toBeNull()
    expect(chip.getAttribute('data-ref-thumb')).toBeNull()
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

  it('上游改名：metaMap 里最新名覆盖字符串里的旧名（下游缩略图名字跟随上游）', () => {
    // 字符串仍是旧名「人物」，但上游已改名为「主角」，metaMap 带最新名 → 芯片显示新名
    const input = '参考 @{img-1:人物|http%3A%2F%2Fx%2Fa.png} 生成'
    const metaMap = new Map([['img-1', { kind: 'image', url: 'http://x/a.png', label: '主角' }]])
    const root = renderToDom(input, metaMap)
    const chip = root.querySelector('[data-ref-id="img-1"]')
    expect(chip).not.toBeNull()
    expect(chip.getAttribute('data-ref-label')).toBe('主角')
    // 序列化时以 chip 上最新 label 为准 → 字符串名也更新为「主角」
    expect(serializeDOM(root)).toBe('参考 @{img-1:主角|http%3A%2F%2Fx%2Fa.png} 生成')
  })

  it('metaMap 无 label 时回退字符串里的旧名（不破坏既有序列化）', () => {
    const input = '参考 @{img-1:人物|http%3A%2F%2Fx%2Fa.png} 生成'
    const metaMap = new Map([['img-1', { kind: 'image', url: 'http://x/a.png' }]])
    const root = renderToDom(input, metaMap)
    const chip = root.querySelector('[data-ref-id="img-1"]')
    expect(chip.getAttribute('data-ref-label')).toBe('人物')
    expect(serializeDOM(root)).toBe(input)
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

describe('autoLinkAssetsByName（@名 自动转芯片，唯一入口）', () => {
  const assets = [
    { id: 'img-1', label: '猫', url: 'http://x/cat.png', kind: 'image' },
    { id: 'img-2', label: '狗', url: 'http://x/dog.png', kind: 'image' },
  ]

  it('@名 精确命中 → 转成 @{id:label|thumb} 芯片字符串', () => {
    expect(autoLinkAssetsByName('一只@猫在跑', assets))
      .toBe('一只@{img-1:猫|http%3A%2F%2Fx%2Fcat.png}在跑')
  })

  it('多个 @名 同时命中', () => {
    expect(autoLinkAssetsByName('@猫和@狗打架', assets))
      .toBe('@{img-1:猫|http%3A%2F%2Fx%2Fcat.png}和@{img-2:狗|http%3A%2F%2Fx%2Fdog.png}打架')
  })

  it('无 @ 前缀的裸词 → 不转，原样', () => {
    expect(autoLinkAssetsByName('一只猫在跑', assets)).toBe('一只猫在跑')
  })

  it('@ 后非素材名 → 不转，原样', () => {
    expect(autoLinkAssetsByName('@鸟在飞', assets)).toBe('@鸟在飞')
  })

  it('素材无 url（文本素材）→ 只转 @{id:label}，不注入 thumb 段', () => {
    const textAssets = [{ id: 't-1', label: '参考文本', kind: 'text' }]
    expect(autoLinkAssetsByName('按@参考文本写', textAssets)).toBe('按@{t-1:参考文本}写')
  })

  it('多素材同名 → 取第一个命中项', () => {
    const dup = [
      { id: 'a', label: '猫', url: 'u1' },
      { id: 'b', label: '猫', url: 'u2' },
    ]
    expect(autoLinkAssetsByName('@猫', dup)).toBe('@{a:猫|u1}')
  })

  it('空 value / 空素材 → 原样', () => {
    expect(autoLinkAssetsByName('', assets)).toBe('')
    expect(autoLinkAssetsByName('@猫', [])).toBe('@猫')
  })

  it('无 label 的素材被跳过，不参与匹配', () => {
    const noLabel = [{ id: 'x', label: '', url: 'u' }]
    expect(autoLinkAssetsByName('@  ', noLabel)).toBe('@  ')
  })

  it('名字含正则特殊字符不误伤（转义）', () => {
    const special = [{ id: 's', label: '猫.狗', url: 'u' }]
    expect(autoLinkAssetsByName('@猫.狗', special)).toBe('@{s:猫.狗|u}')
  })
})
