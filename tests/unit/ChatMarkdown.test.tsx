// @ts-nocheck
/**
 * ChatMarkdown 渲染测试。
 *
 * 验证 AI 助手回复的 Markdown 是否被整理成正式格式（对齐猫猫二 ChatMarkdown）：
 *  - 块级：标题(h1/h2/h3)、有序/无序列表、表格、代码块+复制、引用、分隔线、段落
 *  - 行内：加粗 / 斜体 / 删除线 / 行内代码 / 安全链接 / @引用
 *  - 图片：markdown 图片 ![]() / 裸图片 URL（复用 markdownImages 判定）
 *  - 安全：javascript: 链接不放行（渲染为纯文本）
 */
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../src/components/base/LazyImage.tsx', () => ({
  default: ({ src }) => React.createElement('img', { src }),
}))

import ChatMarkdown from '../../src/components/panels/ChatMarkdown.tsx'

describe('ChatMarkdown — 块级 Markdown', () => {
  it('标题 → 渲染 h1/h2/h3', () => {
    render(<ChatMarkdown value={'# 一级\n\n## 二级\n\n### 三级'} />)
    expect(document.querySelector('h1')?.textContent).toBe('一级')
    expect(document.querySelector('h2')?.textContent).toBe('二级')
    expect(document.querySelector('h3')?.textContent).toBe('三级')
  })

  it('无序/有序列表 → 渲染 ul/ol + li', () => {
    render(<ChatMarkdown value={'- 苹果\n- 香蕉\n\n1. 第一\n2. 第二'} />)
    expect(document.querySelector('ul')).toBeTruthy()
    expect(document.querySelector('ol')).toBeTruthy()
    expect(document.querySelectorAll('li')).toHaveLength(4)
  })

  it('表格 → 渲染 table + 表头 + 行', () => {
    render(<ChatMarkdown value={'| 名称 | 数量 |\n| --- | ---: |\n| 苹果 | 3 |\n| 香蕉 | 2 |'} />)
    expect(document.querySelector('table')).toBeTruthy()
    const th = document.querySelectorAll('th')
    expect(th).toHaveLength(2)
    expect(th[0].textContent).toBe('名称')
    expect(document.querySelectorAll('tbody tr')).toHaveLength(2)
  })

  it('代码块 → 渲染 pre>code，语言标在头部', () => {
    render(<ChatMarkdown value={'```json\n{"a": 1}\n```'} />)
    expect(document.querySelector('pre')).toBeTruthy()
    expect(document.querySelector('code')?.textContent).toBe('{"a": 1}')
    expect(screen.getByText('json')).toBeTruthy() // 语言标头
  })

  it('引用 → 渲染 blockquote', () => {
    render(<ChatMarkdown value={'> 这是一段引用'} />)
    expect(document.querySelector('blockquote')?.textContent).toContain('这是一段引用')
  })

  it('分隔线 → 渲染 hr', () => {
    render(<ChatMarkdown value={'---'} />)
    expect(document.querySelector('hr')).toBeTruthy()
  })
})

describe('ChatMarkdown — 行内 Markdown', () => {
  it('加粗 **x** → strong', () => {
    render(<ChatMarkdown value={'**加粗文字**'} />)
    expect(document.querySelector('strong')?.textContent).toBe('加粗文字')
  })

  it('斜体 *x* → em', () => {
    render(<ChatMarkdown value={'*斜体*'} />)
    expect(document.querySelector('em')?.textContent).toBe('斜体')
  })

  it('删除线 ~~x~~ → del', () => {
    render(<ChatMarkdown value={'~~已删除~~'} />)
    expect(document.querySelector('del')?.textContent).toBe('已删除')
  })

  it('行内代码 `x` → code（非块级）', () => {
    render(<ChatMarkdown value={'用 `npm install` 安装'} />)
    const code = document.querySelector('code')
    expect(code?.textContent).toBe('npm install')
  })

  it('安全链接 [x](url) → a 标签', () => {
    render(<ChatMarkdown value={'[官网](https://example.com)'} />)
    const a = document.querySelector('a')
    expect(a).toBeTruthy()
    expect(a?.getAttribute('href')).toBe('https://example.com')
    expect(a?.textContent).toBe('官网')
  })

  it('javascript: 链接 → 不放行为 <a>，渲染纯文本（安全）', () => {
    render(<ChatMarkdown value={'[危险](javascript:alert(1))'} />)
    expect(document.querySelector('a')).toBeNull()
  })

  it('@节点引用 → 高亮胶囊样式', () => {
    render(<ChatMarkdown value={'引用 @{node-1:生图节点} 继续'} />)
    expect(screen.getByText('@{node-1:生图节点}')).toBeTruthy()
  })
})

describe('ChatMarkdown — 图片', () => {
  it('markdown 图片 ![](url) → 渲染 img', () => {
    render(<ChatMarkdown value={'看这张图：![alt](http://x/a.png)'} />)
    const img = document.querySelector('img')
    expect(img).toBeTruthy()
    expect(img.getAttribute('src')).toBe('http://x/a.png')
  })

  it('裸图片 URL → 渲染 img', () => {
    render(<ChatMarkdown value={'http://cdn.x/pic.webp'} />)
    expect(document.querySelector('img')).toBeTruthy()
  })

  it('blob:/ipfs: 不当图片 → 保留为文本', () => {
    render(<ChatMarkdown value={'blob:http://x/abc'} />)
    expect(document.querySelector('img')).toBeNull()
    expect(screen.getByText(/blob:http:\/\/x\/abc/)).toBeTruthy()
  })

  it('纯文本段落 → 原样渲染（非 markdown 不动）', () => {
    render(<ChatMarkdown value={'你好，这是纯文本，没有图片'} />)
    expect(screen.getByText('你好，这是纯文本，没有图片')).toBeTruthy()
    expect(document.querySelector('img')).toBeNull()
  })
})
