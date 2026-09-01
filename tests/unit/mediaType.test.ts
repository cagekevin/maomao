// @ts-nocheck
import { describe, it, expect } from 'vitest'
import { detectMediaType, detectFileType, isAssetUrl, isAudio } from '../../src/components/base/mediaType.ts'

describe('mediaType §2.17', () => {
  it('detectMediaType 按 dataURL 前缀/扩展名分类', () => {
    expect(detectMediaType('')).toBe('empty')
    expect(detectMediaType('data:video/mp4;base64,xxx')).toBe('video')
    expect(detectMediaType('data:audio/mp3;base64,xxx')).toBe('audio')
    expect(detectMediaType('data:text/plain;base64,xxx')).toBe('text')
    expect(detectMediaType('/files/a.png')).toBe('image')
    expect(detectMediaType('http://x/a.mp4')).toBe('video')
    expect(detectMediaType('http://x/a.mp3')).toBe('audio')
    expect(detectMediaType('http://x/a.txt')).toBe('text')
    expect(detectMediaType('http://x/a.webp')).toBe('image')
  })

  it('detectFileType 按 File.type/name', () => {
    expect(detectFileType({ type: 'image/png', name: 'a.png' })).toBe('image')
    expect(detectFileType({ type: 'video/webm', name: 'a.webm' })).toBe('video')
    expect(detectFileType({ type: 'audio/wav', name: 'a.wav' })).toBe('audio')
    expect(detectFileType({ type: 'text/markdown', name: 'a.md' })).toBe('text')
    // 无 type 但 name 带扩展名也能识别
    expect(detectFileType({ name: 'a.svg' })).toBe('image')
    expect(detectFileType({ name: 'a.mp4' })).toBe('video')
  })

  it('isAssetUrl 识别 http/data/blob', () => {
    expect(isAssetUrl('http://x/y.png')).toBe(true)
    expect(isAssetUrl('https://x/y.png')).toBe(true)
    expect(isAssetUrl('data:image/png;base64,xxx')).toBe(true)
    expect(isAssetUrl('blob:http://x/abc')).toBe(true)
    expect(isAssetUrl('/files/y.png')).toBe(false)
    expect(isAssetUrl('hello')).toBe(false)
  })

  it('isAudio 按 type 或扩展名', () => {
    expect(isAudio('audio')).toBe(true)
    expect(isAudio('video', '/x.mp3?t=1')).toBe(true)
    expect(isAudio(undefined, '/x.wav')).toBe(true)
    expect(isAudio('image', '/x.png')).toBe(false)
  })
})
