// @vitest-environment jsdom
/**
 * useCanvasSync 单测（多窗口画布同步检测 hook）。
 * 策略：stub 全局 BroadcastChannel 为可捕获 onmessage 的 fake，模拟收到 CANVAS_SAVED 消息，
 * 验证「同项目 + 异 tab → 冲突」以及「同 tab / 异项目 → 不冲突」，并确认清理时 close 被调用。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// fake BroadcastChannel：捕获最新实例，供测试注入消息
let latestChannel: FakeBroadcastChannel | null = null;
class FakeBroadcastChannel {
  name: string;
  onmessage: ((ev: MessageEvent) => void) | null;
  closed: boolean;
  constructor(name: string) {
    this.name = name;
    this.onmessage = null;
    this.closed = false;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    latestChannel = this;
  }
  close() {
    this.closed = true;
  }
}
const closeSpy = vi.fn();
FakeBroadcastChannel.prototype.close = function (this: FakeBroadcastChannel) {
  this.closed = true;
  closeSpy(this.name);
};

const { useCanvasSync } = await import('../../src/hooks/useCanvasSync.ts');

beforeEach(() => {
  latestChannel = null;
  closeSpy.mockClear();
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

/** 触发一次 onmessage（模拟跨窗口广播） */
function emit(data) {
  if (!latestChannel?.onmessage) throw new Error('无 onmessage 处理器');
  // 仅 hook 读取 ev.data，故只补该字段（踩坑记录 #11 的 DOM mock 收尾惯例）
  latestChannel.onmessage({ data } as MessageEvent);
}

describe('useCanvasSync — 多窗口画布同步检测', () => {
  it('收到同项目 + 异 tab 的 CANVAS_SAVED → canvasConflict=true', async () => {
    const { result } = renderHook(() => useCanvasSync(() => 'proj-1'));
    const myTabId = result.current.tabIdRef.current;
    await act(async () => {
      emit({ type: 'CANVAS_SAVED', projectId: 'proj-1', tabId: 'tab-other' });
    });
    expect(result.current.canvasConflict).toBe(true);
    expect(myTabId).not.toBe('tab-other');
  });

  it('收到同项目 + 同 tab（自己广播）→ 不置冲突', async () => {
    const { result } = renderHook(() => useCanvasSync(() => 'proj-1'));
    const myTabId = result.current.tabIdRef.current;
    await act(async () => {
      emit({ type: 'CANVAS_SAVED', projectId: 'proj-1', tabId: myTabId });
    });
    expect(result.current.canvasConflict).toBe(false);
  });

  it('收到不同项目的 CANVAS_SAVED → 不置冲突', async () => {
    const { result } = renderHook(() => useCanvasSync(() => 'proj-1'));
    await act(async () => {
      emit({ type: 'CANVAS_SAVED', projectId: 'proj-2', tabId: 'tab-other' });
    });
    expect(result.current.canvasConflict).toBe(false);
  });

  it('收到非 CANVAS_SAVED 消息 → 不置冲突', async () => {
    const { result } = renderHook(() => useCanvasSync(() => 'proj-1'));
    await act(async () => {
      emit({ type: 'OTHER_EVENT', projectId: 'proj-1', tabId: 'tab-other' });
    });
    expect(result.current.canvasConflict).toBe(false);
  });

  it('初始 canvasConflict=false，且 tabIdRef 是唯一 id', () => {
    const { result } = renderHook(() => useCanvasSync(() => 'proj-1'));
    expect(result.current.canvasConflict).toBe(false);
    expect(typeof result.current.tabIdRef.current).toBe('string');
    expect(result.current.tabIdRef.current.length).toBeGreaterThan(0);
  });

  it('卸载时关闭 BroadcastChannel', () => {
    const { unmount } = renderHook(() => useCanvasSync(() => 'proj-1'));
    unmount();
    expect(closeSpy).toHaveBeenCalledWith('yimao_canvas_sync');
  });

  it('切换项目（getProjectId 返回值变化）→ 冲突标记被重置为 false', async () => {
    let projectId = 'proj-1';
    const { result, rerender } = renderHook(() => useCanvasSync(() => projectId));
    // 触发冲突
    await act(async () => {
      emit({ type: 'CANVAS_SAVED', projectId: 'proj-1', tabId: 'tab-other' });
    });
    expect(result.current.canvasConflict).toBe(true);
    // 切换项目并重新渲染 → 冲突应被 hook 内部重置
    projectId = 'proj-2';
    await act(async () => {
      rerender();
    });
    expect(result.current.canvasConflict).toBe(false);
  });
});
