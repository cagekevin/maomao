// @vitest-environment jsdom
/**
 * useMediaDegrade 单测（批 3）。
 * 覆盖 useMediaDegrade() 按 LOD 级别的媒体降级：
 *   - lodLevel<2  → hideMedia=''（不隐藏）
 *   - lodLevel==2 → hideMedia='image'（隐藏图片）
 *   - lodLevel>=3 → hideMedia='image video audio'（全部隐藏）
 *   - isHidden(type) 便捷判断
 * 通过 LodContext.Provider 注入不同 lodLevel 验证（默认 lodLevel=0 来自 LodContext 默认）。
 */
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createElement } from 'react'

const { useMediaDegrade } = await import('../../src/hooks/useMediaDegrade.ts')
const { LodContext } = await import('../../src/components/base/lod.tsx')

function renderWithLod(lodLevel) {
  return renderHook(() => useMediaDegrade(), {
    wrapper: ({ children }) =>
      createElement(LodContext.Provider, { value: { lodLevel, viewportMoving: false, nodeCount: 0, handleFollowLimit: 60, edgeFxLimit: 50, useThumbnail: false } }, children),
  })
}

describe('useMediaDegrade', () => {
  it('lodLevel=0 → 不隐藏任何媒体', () => {
    const { result } = renderWithLod(0)
    expect(result.current.hideMedia).toBe('')
    expect(result.current.isHidden('image')).toBe(false)
    expect(result.current.isHidden('video')).toBe(false)
  })

  it('lodLevel=2 → 仅隐藏图片', () => {
    const { result } = renderWithLod(2)
    expect(result.current.hideMedia).toBe('image')
    expect(result.current.isHidden('image')).toBe(true)
    expect(result.current.isHidden('video')).toBe(false)
  })

  it('lodLevel=3 → 图片/视频/音频全隐藏', () => {
    const { result } = renderWithLod(3)
    expect(result.current.hideMedia).toBe('image video audio')
    expect(result.current.isHidden('image')).toBe(true)
    expect(result.current.isHidden('video')).toBe(true)
    expect(result.current.isHidden('audio')).toBe(true)
  })
})
