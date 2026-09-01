// @vitest-environment jsdom
// @ts-nocheck
/**
 * clipboard 单测（批 1-2）。
 * 覆盖：sanitizePastedText 清洗规则（纯函数，重点）、copyText、copyImageToClipboard（含跨域 fallback）、
 * downloadUrl（含 fetch 失败分支）。
 * 策略：jsdom 环境 + vi.stubGlobal 拦截 navigator.clipboard / fetch / URL.createObjectURL / Image。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const { sanitizePastedText, copyText, copyImageToClipboard, downloadUrl, downloadBlob, buildNodesFromClipboard, resolveDownloadFilename } = await import(
  '../../src/components/base/clipboard.ts'
)

beforeEach(() => { vi.restoreAllMocks() })
afterEach(() => { vi.unstubAllGlobals() })

// 不可见字符常量（用 unicode 转义，避免源码中出现裸控制字符）
const ZWSP = '​'      // 零宽空格
const LRM = '‏'       // 左到右标记
const RLM = '‎'       // 右到左标记
const SOFT = '­'     // 软连字符
const BOM = '﻿'       // BOM
const NBSP = ' '     // 不间断空格（全角风格）

describe('clipboard — sanitizePastedText（纯函数）', () => {
  it('空值/假值返回空串', () => {
    expect(sanitizePastedText('')).toBe('')
    expect(sanitizePastedText(null)).toBe('')
    expect(sanitizePastedText(undefined)).toBe('')
  })

  it('去除零宽/不可见字符（BOM/零宽空格/LRM/RLM/软连字符）', () => {
    const raw = 'a' + BOM + ZWSP + 'b' + LRM + 'c' + RLM + 'd' + SOFT
    expect(sanitizePastedText(raw)).toBe('abcd')
  })

  it('统一换行符 → LF', () => {
    expect(sanitizePastedText('a\r\nb')).toBe('a\nb')
    expect(sanitizePastedText('a\rb')).toBe('a\nb')
  })

  it('表格 Tab 分隔 → 空格', () => {
    expect(sanitizePastedText('a\t\tb')).toBe('a b')
  })

  it('连续空格（含全角空格）→ 单个半角空格', () => {
    expect(sanitizePastedText('a   b')).toBe('a b')
    expect(sanitizePastedText('a\u3000\u3000b')).toBe('a b')
  })

  it('行首/行尾多余空格去除', () => {
    expect(sanitizePastedText('  a \n b ')).toBe('a\nb')
  })

  it('压缩 3+ 空行 → 2 个', () => {
    expect(sanitizePastedText('a\n\n\n\nb')).toBe('a\n\nb')
  })

  it('整体 trim', () => {
    expect(sanitizePastedText('  hello  ')).toBe('hello')
  })
})

describe('clipboard — copyText', () => {
  it('成功写剪贴板返回 ok', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const res = await copyText('hi')
    expect(res.ok).toBe(true)
    expect(writeText).toHaveBeenCalledWith('hi')
  })

  it('权限失败返回 ok=false 带提示', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const res = await copyText('hi')
    expect(res.ok).toBe(false)
    expect(res.msg).toContain('失败')
  })
})

describe('clipboard — copyImageToClipboard', () => {
  function mockImage(ok) {
    vi.stubGlobal('Image', class {
      set src(_v) {
        if (ok) queueMicrotask(() => this.onload && this.onload())
        else queueMicrotask(() => this.onerror && this.onerror(new Error('x')))
      }
      get width() { return 10 }
      get height() { return 10 }
    })
  }

  it('无 url 直接失败', async () => {
    const res = await copyImageToClipboard('')
    expect(res.ok).toBe(false)
    expect(res.msg).toContain('没有图片')
  })

  it('成功：canvas→toBlob→ClipboardItem 写入', async () => {
    mockImage(true)
    const write = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { write, writeText: vi.fn() } })
    HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {} })
    HTMLCanvasElement.prototype.toBlob = function (cb) {
      cb(new Blob(['x'], { type: 'image/png' }))
    }
    globalThis.ClipboardItem = class { constructor(d) { this.items = d } }
    const res = await copyImageToClipboard('http://x/y.png')
    expect(res.ok).toBe(true)
    expect(write).toHaveBeenCalled()
  })

  it('图片加载失败：退化为复制链接（writeText 成功则 ok:true）', async () => {
    mockImage(false)
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { write: vi.fn(), writeText } })
    const res = await copyImageToClipboard('http://x/y.png')
    expect(res.ok).toBe(true)
    expect(res.msg).toContain('图片链接已复制')
    expect(writeText).toHaveBeenCalledWith('http://x/y.png')
  })
})

describe('clipboard — downloadUrl', () => {
  it('fetch 成功：创建 blob 链接并触发下载', async () => {
    const blob = new Blob(['data'], { type: 'text/plain' })
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, blob: async () => blob })
    vi.stubGlobal('fetch', fetchSpy)
    const createEl = vi.spyOn(document, 'createElement')
    const revoke = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:u', revokeObjectURL: revoke })
    const res = await downloadUrl('http://x/f', 'file.txt')
    expect(fetchSpy.mock.calls[0][0]).toBe('http://x/f')
    expect(createEl).toHaveBeenCalledWith('a')
    expect(revoke).toHaveBeenCalledWith('blob:u')
    expect(res.ok).toBe(true)
  })

  it('fetch 失败：返回 ok:false 且不抛', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')))
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:u', revokeObjectURL: vi.fn() })
    const res = await downloadUrl('http://x/f')
    expect(res.ok).toBe(false)
    expect(res.msg).toContain('下载失败')
  })
})

describe('clipboard — downloadBlob（直接下载已有 Blob）', () => {
  it('有 Blob：创建 a 链接触发下载并释放 URL', async () => {
    const blob = new Blob(['data'], { type: 'text/plain' })
    const createEl = vi.spyOn(document, 'createElement')
    const revoke = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:u', revokeObjectURL: revoke })
    const res = await downloadBlob(blob, 'out.txt')
    expect(createEl).toHaveBeenCalledWith('a')
    expect(revoke).toHaveBeenCalledWith('blob:u')
    expect(res.ok).toBe(true)
  })

  it('无 Blob：返回 ok:false 不抛', async () => {
    const res = await downloadBlob(null, 'x.txt')
    expect(res.ok).toBe(false)
    expect(res.msg).toContain('没有可下载的内容')
  })

  it('默认文件名 download（未传 filename）', async () => {
    const createEl = vi.spyOn(document, 'createElement')
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:u', revokeObjectURL: vi.fn() })
    const res = await downloadBlob(new Blob(['x']))
    expect(res.ok).toBe(true)
    const anchor = createEl.mock.results[0]?.value
    expect(anchor?.download).toBe('download')
  })
})

describe('clipboard — buildNodesFromClipboard（粘贴节点组重建）', () => {
  const clipboardJson = JSON.stringify({
    type: 'mutiwindow-nodes',
    nodes: [
      { id: 'a', type: 'imageNode', data: { label: 'x' }, position: { x: 0, y: 0 }, measured: { width: 100, height: 100 } },
      { id: 'b', type: 'textNode', data: {}, position: { x: 200, y: 0 }, measured: { width: 100, height: 100 } },
    ],
    edges: [{ id: 'e1', source: 'a', target: 'b' }],
    originalIds: ['a', 'b'],
  })

  it('非 mutiwindow-nodes 格式 → null', () => {
    expect(buildNodesFromClipboard('{"type":"other"}', { x: 0, y: 0 })).toBeNull()
  })

  it('非法 JSON → null', () => {
    expect(buildNodesFromClipboard('not json', { x: 0, y: 0 })).toBeNull()
  })

  it('空 nodes → null', () => {
    expect(buildNodesFromClipboard('{"type":"mutiwindow-nodes","nodes":[]}', { x: 0, y: 0 })).toBeNull()
  })

  it('正常重建：id 重映射、新节点 selected:true、data 深拷贝', () => {
    const r = buildNodesFromClipboard(clipboardJson, { x: 500, y: 500 })
    expect(r).not.toBeNull()
    expect(r.nodes).toHaveLength(2)
    // id 已重映射（不保留原 id a/b）
    const newIds = r.nodes.map((n) => n.id)
    expect(newIds).not.toContain('a')
    expect(newIds).not.toContain('b')
    expect(newIds[0].startsWith('imageNode-')).toBe(true)
    // 新节点 selected:true
    expect(r.nodes.every((n) => n.selected)).toBe(true)
    // 边 id 用新 source/target 重映射
    expect(r.edges).toHaveLength(1)
    expect(r.edges[0].source).toBe(r.nodes[0].id)
    expect(r.edges[0].target).toBe(r.nodes[1].id)
    expect(r.edges[0].type).toBe('default')
    expect(r.edges[0].selected).toBe(true)
  })

  it('以粘贴点为中心：包围盒中心对齐 pos', () => {
    // 原包围盒 x: 0..200(0+100?) 实际 0..100 / y:0..100 → 中心 (50,50)
    // 节点 a 绝对 x:0..100、b x:200..300 → 整体 x 范围 0..300，中心 150
    const r = buildNodesFromClipboard(clipboardJson, { x: 1000, y: 800 })
    const nodeA = r.nodes.find((n) => n.type === 'imageNode')
    // a 原始 position.x=0，平移后 = pos.x + (0 - centerX) = 1000 + (0 - 150) = 850
    expect(nodeA.position.x).toBe(850)
  })

  it('data 字段深拷贝（修改结果不改原 JSON 对象）', () => {
    const src = { type: 'mutiwindow-nodes', nodes: [{ id: 'a', type: 'imageNode', data: { label: 'L' }, position: { x: 0, y: 0 } }] }
    const r = buildNodesFromClipboard(JSON.stringify(src), { x: 0, y: 0 })
    r.nodes[0].data.label = 'MUTATED'
    expect(src.nodes[0].data.label).toBe('L')
  })
})

describe('clipboard — resolveDownloadFilename（下载文件名推导）', () => {
  it('有 label（带扩展名）→ 原样使用', () => {
    expect(resolveDownloadFilename('成品.png', 'http://x/a.png')).toBe('成品.png')
  })

  it('有 label 但无扩展名 → 补默认 .png', () => {
    expect(resolveDownloadFilename('成品', 'http://x/a.png')).toBe('成品.png')
  })

  it('无 label → 用 URL 末尾文件名', () => {
    expect(resolveDownloadFilename('', 'http://127.0.0.1:18080/files/tasks/abc.png')).toBe('abc.png')
  })

  it('URL 文件名无扩展名 → 补默认扩展名', () => {
    expect(resolveDownloadFilename('', 'http://x/final')).toBe('final.png')
  })

  it('blob/data 不算来源 → label 空时兜底 fallback', () => {
    expect(resolveDownloadFilename('', 'blob:http://x/abc')).toBe('generated.png')
    expect(resolveDownloadFilename('', 'data:image/png;base64,xxx')).toBe('generated.png')
  })

  it('label 与 URL 名都空 → 兜底 fallback（不可为 fallback 传空）', () => {
    expect(resolveDownloadFilename('', 'http://x/')).toBe('generated.png')
  })

  it('视频语义：ext=mp4 / fallback=video.mp4', () => {
    expect(resolveDownloadFilename('片段', 'http://x/a.mp4', { ext: 'mp4', fallback: 'video.mp4' })).toBe('片段.mp4')
    expect(resolveDownloadFilename('', 'blob:http://x/abc', { ext: 'mp4', fallback: 'video.mp4' })).toBe('video.mp4')
  })
})
