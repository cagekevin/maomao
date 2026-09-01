// @vitest-environment node
// @ts-nocheck
/**
 * resultUrlExtractor 单测（P1-B φ2）—— 统一结果 URL 解析器。
 * 覆盖 C-B 验收的「5 处同一响应样例，单一解析器输出一致」：
 *  SSE、图片直返、图片轮询、视频轮询、网关 task_view；及其 type/数组包/顶层 video_url 边界。
 */
import { describe, it, expect } from 'vitest'
import { extractResultUrl, resolveMediaType, classifyUrl } from '../../src/components/base/resultUrlExtractor.ts'

describe('extractResultUrl — 图片', () => {
  it('SSE 事件形态：results[0].url 或 result.images[0].url', () => {
    expect(extractResultUrl({ data: { results: [{ url: 'http://x/a.png' }] }, type: 'image' })).toBe('http://x/a.png')
    expect(extractResultUrl({ data: { result: { images: [{ url: 'http://x/b.png' }] } }, type: 'image' })).toBe('http://x/b.png')
  })
  it('数据包成数组时取 [0]', () => {
    expect(extractResultUrl({ data: { result: { images: [{ url: ['http://x/arr.png'] }] } }, type: 'image' })).toBe('http://x/arr.png')
  })
  it('兜底 result.url', () => {
    expect(extractResultUrl({ data: { result: { url: 'http://x/r.png' } }, type: 'image' })).toBe('http://x/r.png')
  })
  it('优先 data，其次 json', () => {
    expect(extractResultUrl({ data: { results: [{ url: 'http://x/d.png' }] }, json: { results: [{ url: 'http://x/j.png' }] }, type: 'image' })).toBe('http://x/d.png')
    expect(extractResultUrl({ json: { results: [{ url: 'http://x/j.png' }] }, type: 'image' })).toBe('http://x/j.png')
  })
})

describe('extractResultUrl — 视频 / 音频 / 兜底', () => {
  it('视频：result.videos[0].url，可能数组包', () => {
    expect(extractResultUrl({ data: { result: { videos: [{ url: 'http://x/v.mp4' }] } }, type: 'video' })).toBe('http://x/v.mp4')
    expect(extractResultUrl({ data: { result: { videos: [{ url: ['http://x/v2.mp4'] }] } }, type: 'video' })).toBe('http://x/v2.mp4')
  })
  it('视频：网关 task_view 顶层 video_url 兜底', () => {
    expect(extractResultUrl({ data: { video_url: 'http://x/top.mp4' }, type: 'video' })).toBe('http://x/top.mp4')
  })
  it('音频：result.audios[0].url', () => {
    expect(extractResultUrl({ data: { result: { audios: [{ url: 'http://x/a.mp3' }] } }, type: 'audio' })).toBe('http://x/a.mp3')
  })
  it('无结果 → undefined', () => {
    expect(extractResultUrl({ data: { status: 'pending' }, type: 'image' })).toBeUndefined()
  })
  it('跨 type 不串：图片样例按 video 查不到', () => {
    expect(extractResultUrl({ data: { result: { images: [{ url: 'http://x/img.png' }] } }, type: 'video' })).toBeUndefined()
  })
})

describe('classifyUrl — 扩展名 / data URI 判型（resolveMediaType 的底层，防 video 当 image）', () => {
  it('data:video 前缀 → video', () => {
    expect(classifyUrl('data:video/mp4;base64,xxx')).toBe('video')
  })
  it('data:audio 前缀 → audio', () => {
    expect(classifyUrl('data:audio/mp3;base64,xxx')).toBe('audio')
  })
  it('视频扩展名 → video（webm/mov/mkv/avi 等不在 mp4 白名单里也要认）', () => {
    expect(classifyUrl('http://x/a.webm')).toBe('video')
    expect(classifyUrl('http://x/a.mov?token=1')).toBe('video')
  })
  it('音频扩展名 → audio', () => {
    expect(classifyUrl('http://x/a.mp3')).toBe('audio')
    expect(classifyUrl('http://x/a.flac')).toBe('audio')
  })
  it('无扩展名 / blob / 未知 → 默认 image（兜底）', () => {
    expect(classifyUrl('blob:http://x/0')).toBe('image')
    expect(classifyUrl('http://x/noext')).toBe('image')
    expect(classifyUrl('')).toBe('image')
  })
})

describe('resolveMediaType — 判型规则（与 useConnectedInputs 同源）', () => {
  it('mediaType 优先于扩展名', () => {
    expect(resolveMediaType('blob:http://x/0', 'audio')).toBe('audio')
    expect(resolveMediaType('blob:http://x/0', 'video')).toBe('video')
  })
  it('无 mediaType → 按扩展名', () => {
    expect(resolveMediaType('http://x/a.mp4', undefined)).toBe('video')
    expect(resolveMediaType('http://x/a.mp3', undefined)).toBe('audio')
    expect(resolveMediaType('http://x/a.png', undefined)).toBe('image')
    expect(resolveMediaType('', undefined)).toBe('image')
  })
})