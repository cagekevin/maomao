// @vitest-environment jsdom
/**
 * upstreamLink.useUpstreamAutoTrigger 单测（§3.3 失败可见收口）。
 * 契约：上游完成广播触发直接下游，下游失败不得静默吞掉（.catch(() => {})），
 *      必须经 logger.warn 留痕（target + error），且不产生 unhandled rejection。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const rfState = vi.hoisted(() => ({ edges: [{ source: 'n1', target: 'n2' }] }));
const busState = vi.hoisted(() => ({ handler: null }));
const loggerState = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn() }));
const runNodeGenerationMock = vi.hoisted(() => vi.fn());

vi.mock('@xyflow/react', () => ({ useReactFlow: () => ({ getEdges: () => rfState.edges }) }));
vi.mock('../../src/components/base/core/eventBus.ts', () => ({
  subscribe: (evt, cb) => {
    busState.handler = cb;
    return () => {};
  },
}));
vi.mock('../../src/components/base/core/config.ts', () => ({ AUTO_TRIGGER_DOWNSTREAM: true }));
vi.mock('../../src/components/base/store/taskStore.ts', () => ({
  runNodeGeneration: runNodeGenerationMock,
}));
vi.mock('../../src/components/base/core/logger.ts', () => ({ logger: loggerState }));

import { useUpstreamAutoTrigger } from '../../src/components/base/canvas/upstreamLink.ts';

describe('useUpstreamAutoTrigger — 下游触发失败可见（§3.3）', () => {
  beforeEach(() => {
    runNodeGenerationMock.mockReset();
    loggerState.info.mockClear();
    loggerState.warn.mockClear();
  });

  it('下游触发失败 → logger.warn 留痕，且不往上抛 rejection', async () => {
    const { result } = renderHook(() => useUpstreamAutoTrigger());
    expect(busState.handler).toEqual(expect.any(Function));
    runNodeGenerationMock.mockRejectedValueOnce(new Error('网络中断'));
    // handler 同步触发；内部 runNodeGeneration 的 rejection 已被 catch 住，这里 await 不应抛
    await act(async () => {
      await busState.handler({ sourceNodeId: 'n1' });
    });
    expect(runNodeGenerationMock).toHaveBeenCalledWith('n2');
    expect(loggerState.warn).toHaveBeenCalledWith(
      '拓扑',
      '[G1] 下游触发失败',
      expect.objectContaining({ target: 'n2', error: '网络中断' }),
    );
  });

  it('下游触发成功 → 仅 info 不 warn（失败才留痕）', async () => {
    renderHook(() => useUpstreamAutoTrigger());
    runNodeGenerationMock.mockResolvedValueOnce({ ok: true });
    await act(async () => {
      await busState.handler({ sourceNodeId: 'n1' });
    });
    expect(runNodeGenerationMock).toHaveBeenCalledWith('n2');
    expect(loggerState.info).toHaveBeenCalledWith(
      '拓扑',
      '[G1] 上游完成 → 触发直接下游',
      expect.anything(),
    );
    expect(loggerState.warn).not.toHaveBeenCalled();
  });
});
