// @vitest-environment jsdom
/**
 * useNodeGeneration 单测（P0-2-b 声明式写回；TD-01-21 已收口为**唯一写回路径 resultKey**）。
 * 四个关键行为：
 *  1. 非破坏——默认不传 resultKey 时，成功路径不自动写 node.data；
 *  2. resultKey 声明后，成功时自动 patchData({[resultKey]: url})，onSuccess 仍会调用；
 *  3. resultKey 声明后，收到 task-completed 广播自动回填；
 *  4. 未声明 resultKey（文本类节点）→ 广播**不**写回（写回判据只此一条，不再有第二个开关）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const patchDataMock = vi.hoisted(() => vi.fn());
const taskCtlMock = vi.hoisted(() => ({
  taskId: 't1',
  progress: vi.fn(),
  done: vi.fn(),
  fail: vi.fn(),
}));
const busState = vi.hoisted(() => ({
  handler: null,
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
// 【TD-01-17】saveResultToTasks 现返回判别联合 SaveTasksOutcome（不再 string|null）
const saveResultToTasksMock = vi.hoisted(() =>
  vi.fn(
    async (
      url: string,
    ): Promise<{
      ok: boolean;
      url?: string;
      skipped?: boolean;
      reason?: string;
      message?: string;
    }> => ({
      ok: true,
      url,
      skipped: true,
    }),
  ),
);
const reportDegradeMock = vi.hoisted(() => vi.fn());
const showToastMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/hooks/useNodeData.ts', () => ({
  useNodeData: () => ({ patchData: patchDataMock }),
}));
vi.mock('../../src/components/base/store/taskStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  reportGenerate: () => taskCtlMock,
  registerTaskRetry: vi.fn(),
  unregisterTaskRetry: vi.fn(),
  claimNodeRun: () => ({ ok: true }),
  releaseNodeRun: vi.fn(),
}));
vi.mock('../../src/components/base/api/filesApi.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  saveResultToTasks: saveResultToTasksMock,
}));
vi.mock('../../src/components/base/core/log/degrade.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  reportDegrade: reportDegradeMock,
}));
vi.mock('../../src/components/base/core/event/eventBus.ts', () => ({
  subscribe: (_evt: any, cb: any) => {
    busState.handler = cb;
    return () => {};
  },
}));
vi.mock('../../src/components/base/core/log/logger.ts', () => ({ logger: busState.logger }));
vi.mock('../../src/components/base/core/event/toastStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  showToast: showToastMock,
}));

import { useNodeGeneration } from '../../src/hooks/useNodeGeneration.ts';

const baseProps = {
  nodeId: 'n1',
  type: { type: 'image', prompt: 'p', modelName: 'm' },
  run: async () => ({ ok: true, url: 'http://x/y.png' }),
};

describe('useNodeGeneration — resultKey 声明式写回（唯一写回路径）', () => {
  beforeEach(() => {
    patchDataMock.mockClear();
    taskCtlMock.done.mockClear();
    taskCtlMock.fail.mockClear();
    busState.handler = null;
    busState.logger.error.mockClear();
    saveResultToTasksMock.mockClear();
    reportDegradeMock.mockClear();
    showToastMock.mockClear();
  });

  it('非破坏：默认不传时成功路径不自动写 node.data', async () => {
    const { result } = renderHook(() => useNodeGeneration(baseProps));
    let ok;
    await act(async () => {
      ok = await result.current.start();
    });
    expect(ok!.ok).toBe(true);
    expect(patchDataMock).not.toHaveBeenCalled();
  });

  it('传 resultKey 后成功自动 patchData({[resultKey]: url})，onSuccess 仍会调用', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useNodeGeneration({ ...baseProps, resultKey: 'assetUrl', onSuccess }),
    );
    await act(async () => {
      await result.current.start();
    });
    expect(patchDataMock).toHaveBeenCalledWith({ assetUrl: 'http://x/y.png' });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('resultKey：收到完成广播自动回填，且过滤非本节点/非完成', async () => {
    const { result: _result } = renderHook(() =>
      useNodeGeneration({ ...baseProps, resultKey: 'assetUrl' }),
    );
    // 先让 start 抛错无关：直接测广播路径
    await act(async () => {
      expect(busState.handler).toEqual(expect.any(Function));
      // 非本节点 → 忽略
      (busState.handler as unknown as (...a: any[]) => void)({
        nodeId: 'other',
        status: 'completed',
        resultUrl: 'http://x/ignored.png',
      });
      // 非 completed → 忽略
      (busState.handler as unknown as (...a: any[]) => void)({
        nodeId: 'n1',
        status: 'running',
        resultUrl: 'http://x/ignored2.png',
      });
      expect(patchDataMock).not.toHaveBeenCalled();
      // 本节点 + completed → 自动回填
      (busState.handler as unknown as (...a: any[]) => void)({
        nodeId: 'n1',
        status: 'completed',
        resultUrl: 'http://x/rec.png',
      });
    });
    expect(patchDataMock).toHaveBeenCalledTimes(1);
    expect(patchDataMock).toHaveBeenCalledWith({ assetUrl: 'http://x/rec.png' });
  });

  it('未声明 resultKey（文本类节点）→ 完成广播不写回（写回判据只此一条）', async () => {
    // 【TD-01-21】原先写回判据有两份（resultKey + recoverable 开关）；收口后只认 resultKey。
    // 本用例锁住「没有 resultKey 就不写回」，防未来再把第二个开关加回来。
    renderHook(() => useNodeGeneration(baseProps));
    await act(async () => {
      (busState.handler as unknown as (...a: any[]) => void)({
        nodeId: 'n1',
        status: 'completed',
        resultUrl: 'http://x/nope.png',
      });
    });
    expect(patchDataMock).not.toHaveBeenCalled();
  });

  it('run 抛网络异常 → logger.error 记录 classifyError 分类（network，可重试）', async () => {
    // 【R7 错误分类记录】异常对象必须经 classifyError 统一分类并进日志，网络错误 retryable:true
    const { result } = renderHook(() =>
      useNodeGeneration({
        ...baseProps,
        run: async () => {
          throw new TypeError('Failed to fetch');
        },
      }),
    );
    await act(async () => {
      await result.current.start();
    });
    expect(busState.logger.error).toHaveBeenCalledWith(
      '生成',
      'contract·error',
      expect.objectContaining({ errType: 'network', retryable: true, error: 'Failed to fetch' }),
    );
  });

  it('run 返回 { ok:false } → logger.error 记录分类 business（契约业务失败，不可重试）', async () => {
    // 【R7 错误分类记录】契约业务失败（message 字符串）归 business，不自动重试
    const { result } = renderHook(() =>
      useNodeGeneration({ ...baseProps, run: async () => ({ ok: false, error: '模型限流' }) }),
    );
    await act(async () => {
      await result.current.start();
    });
    expect(busState.logger.error).toHaveBeenCalledWith(
      '生成',
      'contract·fail',
      expect.objectContaining({ errType: 'business', retryable: false, error: '模型限流' }),
    );
  });

  it('落盘失败 → reportDegrade 留痕（**带用户可见 toast**），结果仍回退原始 URL（TD-01-17 三态）', async () => {
    // 【失败可见 + 回退】saveResultToTasks 返回 ok:false 时：必须经 reportDegrade **带 toast** 可见
    //   （不得静默吞），且保留回退语义 → 返回 ok:true + 原始 url。
    saveResultToTasksMock.mockResolvedValueOnce({
      ok: false,
      reason: 'exception',
      message: '磁盘写入失败',
    });
    const { result } = renderHook(() => useNodeGeneration(baseProps));
    let r;
    await act(async () => {
      r = await result.current.start();
    });
    expect(reportDegradeMock).toHaveBeenCalledWith({
      layer: 'useNodeGeneration',
      key: 'saveResultToTasks',
      e: expect.any(Error),
      toast: expect.stringContaining('未能保存'),
    });
    // 回退：落盘失败不得把整体生成判为失败
    expect(r).toEqual({ ok: true, resultUrl: 'http://x/y.png' });
  });

  it('T8 run 抛 AbortError → start 返回 {ok:false, error:"已停止", aborted:true}，不弹 toast（L3c C2b 回归）', async () => {
    // 【L3c C2b】catch 里中止判定统一走 classifyError（原 `e?.name === 'AbortError'`）。
    // 回归断言：AbortError 仍被正确判定为已中止，返回信封 + taskCtl.fail('已停止')，且不触发全局 toast。
    const abortErr = Object.assign(new Error('Aborted'), { name: 'AbortError' });
    const { result } = renderHook(() =>
      useNodeGeneration({
        ...baseProps,
        run: async () => {
          throw abortErr;
        },
      }),
    );
    let r;
    await act(async () => {
      r = await result.current.start();
    });
    expect(r).toEqual({ ok: false, error: '已停止', aborted: true });
    expect(showToastMock).not.toHaveBeenCalled();
    expect(taskCtlMock.fail).toHaveBeenCalledWith('已停止');
  });
});
