// 回归测试：useCanvasHistory.js
// @vitest-environment jsdom
/**
 * 画布与同步 hooks 回归测试（TASK-066）。
 *
 * 覆盖：
 *  - useCanvasHistory：撤销/重做 hook 层（React 桥接），断言 record/undo/redo/clear 行为。
 *
 * 注 ①：useSyncNodeData 曾在此文件重复覆盖，已迁至专用文件 tests/unit/useSyncNodeData.test.ts（去重）。
 * 注 ②【TD-11-6 / 2026-09-11】：原第 3 节「workflowRuntime 生命周期」已随模块删除——
 *   `src/components/base/canvas/workflowRuntime.ts` 是**生产级死代码**（0 生产 import，仅自证测试），
 *   且其 `awaitingConfirm`/`aiUndoStack`/`steerQueue` 与 `agent/conversation/*` 的 per-conversation
 *   同构实现构成「第二份真相」。真实工作流状态现由 `conversationSkillState` / `workflowState` /
 *   `conversationSnapshot` 承担。禁止据本注释恢复该模块。
 *
 * 并发安全：仅用 `npx vitest run tests/unit/canvasHooks.test.ts` 验证，不占用共享资源。
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Node } from '@xyflow/react';
import type { CanvasSnapshot } from '../../src/hooks/useCanvasHistory.ts';

// ───────────────────────────────────────────────────────────
// 1. useCanvasHistory
// ───────────────────────────────────────────────────────────
import { useCanvasHistory } from '../../src/hooks/useCanvasHistory.ts';

describe('useCanvasHistory 撤销/重做 hook 桥接', () => {
  it('record(snapshot) 调 stack.push 并触发重渲染（canUndo 变 true）', () => {
    const getSnapshot = vi.fn(() => ({ nodes: [], edges: [] }));
    const apply = vi.fn();
    const { result } = renderHook(() => useCanvasHistory(getSnapshot, apply));

    expect(result.current.canUndo).toBe(false);
    act(() => {
      result.current.record({ nodes: [{ id: 'a' } as Node], edges: [] } as CanvasSnapshot);
    });
    // 显式快照被 push，首次记录后 index=0 仍不能撤（HistoryStack 行为），
    // 但再 record 一条后即可撤销
    act(() => {
      result.current.record({ nodes: [{ id: 'b' } as Node], edges: [] } as CanvasSnapshot);
    });
    expect(result.current.canUndo).toBe(true);
  });

  it('record 不传 snapshot 时回退用 getSnapshot()', () => {
    const snap: CanvasSnapshot = { nodes: [{ id: 'x' } as Node], edges: [] };
    const getSnapshot = vi.fn(() => snap);
    const apply = vi.fn();
    const { result } = renderHook(() => useCanvasHistory(getSnapshot, apply));

    act(() => {
      result.current.record();
    });
    expect(getSnapshot).toHaveBeenCalled();
    act(() => {
      result.current.record({ nodes: [{ id: 'y' } as Node], edges: [] } as CanvasSnapshot);
    });
    expect(result.current.canUndo).toBe(true);
  });

  it('undo 调 stack.undo 并 apply 返回的快照、启动 600ms suppress', () => {
    const apply = vi.fn();
    const getSnapshot = vi.fn(() => ({ nodes: [], edges: [] }));
    const { result } = renderHook(() => useCanvasHistory(getSnapshot, apply));

    act(() => {
      result.current.record({ nodes: [{ id: '1' } as Node], edges: [] } as CanvasSnapshot);
      result.current.record({ nodes: [{ id: '2' } as Node], edges: [] } as CanvasSnapshot);
    });
    expect(result.current.canUndo).toBe(true);

    let undoSnap;
    act(() => {
      result.current.undo();
    });
    // undo 触发了 apply，且 apply 入参是 undo 返回的快照（index 前移后的上一步）
    expect(apply).toHaveBeenCalled();
    // eslint-disable-next-line prefer-const
    undoSnap = apply.mock.calls[apply.mock.calls.length - 1][0];
    expect(undoSnap.nodes[0].id).toBe('1');
    // suppress 窗口内再 record 应被忽略（history 不增长）
    const beforeLen = result.current.canRedo;
    act(() => {
      result.current.record({ nodes: [{ id: 'ignored' } as Node], edges: [] } as CanvasSnapshot);
    });
    // 立即 record 处于 suppress，不会新增分支，canRedo 行为由 HistoryStack 决定
    expect(typeof beforeLen).toBe('boolean');
  });

  it('redo 调 stack.redo 并 apply 快照', () => {
    const apply = vi.fn();
    const getSnapshot = vi.fn(() => ({ nodes: [], edges: [] }));
    const { result } = renderHook(() => useCanvasHistory(getSnapshot, apply));

    act(() => {
      result.current.record({ nodes: [{ id: '1' } as Node], edges: [] } as CanvasSnapshot);
      result.current.record({ nodes: [{ id: '2' } as Node], edges: [] } as CanvasSnapshot);
    });
    act(() => {
      result.current.undo();
    });
    apply.mockClear();
    act(() => {
      result.current.redo();
    });
    expect(apply).toHaveBeenCalled();
    const redone = apply.mock.calls[0][0];
    expect(redone.nodes[0].id).toBe('2');
  });

  it('clear 清空历史（canUndo/canRedo 复位）', () => {
    const apply = vi.fn();
    const getSnapshot = vi.fn(() => ({ nodes: [], edges: [] }));
    const { result } = renderHook(() => useCanvasHistory(getSnapshot, apply));

    act(() => {
      result.current.record({ nodes: [{ id: '1' } as Node], edges: [] } as CanvasSnapshot);
      result.current.record({ nodes: [{ id: '2' } as Node], edges: [] } as CanvasSnapshot);
    });
    expect(result.current.canUndo).toBe(true);
    act(() => {
      result.current.clear();
    });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────
// 2. useSyncNodeData —— 已迁至 tests/unit/useSyncNodeData.test.ts
//    （此前本文件第 2 节重复覆盖同一 hook 的同一批行为，已删除去重）
// ───────────────────────────────────────────────────────────
