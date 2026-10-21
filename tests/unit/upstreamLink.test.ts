// @vitest-environment jsdom
/**
 * upstreamLink.useUpstreamAutoTrigger 单测（§3.3 失败可见收口）。
 * 契约：上游完成广播触发直接下游，下游失败不得静默吞掉（.catch(() => {})），
 *      必须经 logger.warn 留痕（target + error），且不产生 unhandled rejection。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { must } from '../helpers/must';

/** 订阅回调的真实签名：`eventBus.ts` 的 `EventHandler`（`(payload) => void`）未导出，此处按同一形状登记。 */
type UpstreamHandler = (payload: unknown) => void;

const rfState = vi.hoisted(() => ({ edges: [{ source: 'n1', target: 'n2' }] }));
// 替身持有真实的回调类型（而非 null/any）：调用处无需 `as unknown as` 硬拗。
const busState = vi.hoisted(() => ({ handler: null as UpstreamHandler | null }));
const loggerState = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn() }));
const runNodeGenerationMock = vi.hoisted(() => vi.fn());

vi.mock('@xyflow/react', () => ({ useReactFlow: () => ({ getEdges: () => rfState.edges }) }));
vi.mock('../../src/components/base/core/event/eventBus.ts', () => ({
  subscribe: (_evt: string, cb: UpstreamHandler) => {
    busState.handler = cb;
    return () => {};
  },
}));
// config 桩必须**从真模块派生**：只覆盖本套件要控的开关。
// 【为什么】TD-17-15 展开 resourceStore/providerStore 后，真实链路（contracts → kvStore）会读
// `config.KV_TIMEOUT` 等其它导出；手写白名单式桩缺它们 ⇒ 「No "KV_TIMEOUT" export」整套件崩。
// 这正是本债的形态：桩是**静态手抄面**，模块/其依赖一长大就脱钩。
vi.mock('../../src/components/base/core/config.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  AUTO_TRIGGER_DOWNSTREAM: true,
}));
vi.mock('../../src/components/base/store/taskStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  runNodeGeneration: runNodeGenerationMock,
}));
vi.mock('../../src/components/base/core/log/logger.ts', () => ({ logger: loggerState }));

import { useUpstreamAutoTrigger } from '../../src/components/canvas/topology/upstreamLink.ts';

describe('useUpstreamAutoTrigger — 下游触发失败可见（§3.3）', () => {
  beforeEach(() => {
    runNodeGenerationMock.mockReset();
    loggerState.info.mockClear();
    loggerState.warn.mockClear();
  });

  it('下游触发失败 → logger.warn 留痕，且不往上抛 rejection', async () => {
    const { result: _result } = renderHook(() => useUpstreamAutoTrigger());
    expect(busState.handler).toEqual(expect.any(Function));
    const handler = must(busState.handler, 'upstream:updated 订阅回调');
    runNodeGenerationMock.mockRejectedValueOnce(new Error('网络中断'));
    // handler 同步触发；内部 runNodeGeneration 的 rejection 已被 catch 住，这里 await 不应抛。
    // 回调本身返回 void（见 upstreamLink.ts：箭头函数无 return），故 await 一个微任务刻度
    // 让内部 `.catch(...)` 链跑完 —— 与原先 await 回调返回值的效果一致。
    await act(async () => {
      handler({ sourceNodeId: 'n1' });
      await Promise.resolve();
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
    const handler = must(busState.handler, 'upstream:updated 订阅回调');
    runNodeGenerationMock.mockResolvedValueOnce({ ok: true });
    await act(async () => {
      handler({ sourceNodeId: 'n1' });
      await Promise.resolve();
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
