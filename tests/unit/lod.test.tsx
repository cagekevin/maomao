/**
 * lod 深模块单测（合并原 LodProvider/useLod/LodListener 后）。
 * 透过新 Interface（useLod() + LodContext）验证：
 *  - 默认 context 提供完整 LOD 字段（handleFollowLimit/edgeFxLimit 由 LOD_LIMITS 常量兜底，非裸数字）
 *  - 消费端经 LodContext.Provider 注入的 lodLevel 可被 useLod() 正确读取
 * 旧穿透测试（直接测 LodListener 内部 class / LodProvider 透传）已按 Replace don't layer 删除。
 */
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createElement } from 'react'

const { useLod, LodContext } = await import('../../src/components/base/canvas/lod.tsx')

describe('lod 深模块', () => {
  it('默认 context 含完整 LOD 字段且阈值由常量兜底', () => {
    const { result } = renderHook(() => useLod())
    expect(result.current.lodLevel).toBe(0)
    expect(result.current.handleFollowLimit).toBe(60) // LOD_LIMITS.handleFollow
    expect(result.current.edgeFxLimit).toBe(50) // LOD_LIMITS.edgeFx
    expect(result.current.useThumbnail).toBe(false)
  })

  it('消费端经 LodContext.Provider 注入的 lodLevel 可被 useLod() 读取', () => {
    const { result } = renderHook(() => useLod(), {
      wrapper: ({ children }) =>
        createElement(LodContext.Provider, { value: { lodLevel: 3, viewportMoving: false, nodeCount: 10, handleFollowLimit: 60, edgeFxLimit: 50, useThumbnail: true } }, children),
    })
    expect(result.current.lodLevel).toBe(3)
    expect(result.current.nodeCount).toBe(10)
    expect(result.current.useThumbnail).toBe(true)
  })
})
