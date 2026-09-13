/**
 * lod 深模块单测（合并原 LodProvider/useLod/LodListener 后）。
 * 透过新 Interface（useLod() + LodContext）验证：
 *  - 默认 context 提供 lodLevel=0
 *  - 消费端经 LodContext.Provider 注入的 lodLevel 可被 useLod() 正确读取
 * 旧穿透测试（直接测 LodListener 内部 class / LodProvider 透传）已按 Replace don't layer 删除。
 * 【TD-04-22】原先断言的 handleFollowLimit/edgeFxLimit/useThumbnail/nodeCount/viewportMoving
 * 五个假字段（零消费端）已删，用例同步收窄。
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement } from 'react';

const { useLod, LodContext } = await import('../../src/components/base/canvas/lod.tsx');

describe('lod 深模块', () => {
  it('默认 context 提供 lodLevel=0', () => {
    const { result } = renderHook(() => useLod());
    expect(result.current.lodLevel).toBe(0);
  });

  it('消费端经 LodContext.Provider 注入的 lodLevel 可被 useLod() 读取', () => {
    const { result } = renderHook(() => useLod(), {
      wrapper: ({ children }) =>
        createElement(LodContext.Provider, { value: { lodLevel: 3 } }, children),
    });
    expect(result.current.lodLevel).toBe(3);
  });
});
