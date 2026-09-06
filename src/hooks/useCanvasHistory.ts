import { useState, useRef, useCallback } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { HistoryStack } from '../components/base/canvas/historyStack.ts';

/** 一次画布快照：节点 + 连线 */
export interface CanvasSnapshot {
  nodes: Node[];
  edges: Edge[];
}

export interface CanvasHistoryApi {
  canUndo: boolean;
  canRedo: boolean;
  record: (snapshot?: CanvasSnapshot | null) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

/**
 * 画布撤销/重做历史栈 hook（复刻 H_.jsx:475-478,881-925 的 fn/hn/_n/vn 机制）。
 *
 * 核心逻辑已下沉到纯类 HistoryStack（historyStack.js），本 hook 只做两件事：
 *  - 用 ref 持有 HistoryStack 实例（不随渲染重建）
 *  - 把纯类的状态变化桥接到 React state（history/index → canUndo/canRedo 渲染）
 *
 * @param getSnapshot 返回当前 { nodes, edges } 快照的函数
 * @param apply       应用 { nodes, edges } 到画布
 * @returns { canUndo, canRedo, record, undo, redo, clear }
 */
export function useCanvasHistory(
  getSnapshot: () => CanvasSnapshot,
  apply: (snapshot: CanvasSnapshot) => void,
): CanvasHistoryApi {
  // React state 镜像（供渲染 canUndo/canRedo 与 record 闭包用）
  const [_version, setVersion] = useState(0);
  // 纯类实例：真实历史栈（不随渲染重建）
  const stackRef = useRef(new HistoryStack<CanvasSnapshot>());
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stack = stackRef.current;

  // 记录一次画布变化（复刻 H_.jsx:881-897）。
  // snapshot：可显式传入本次操作后的最新 { nodes, edges }。
  // 若不传，则回退用 getSnapshot() 取 ref 里的当前值。
  // 注意：React setState 是异步的，addNode 等「先 setNodes 再 record」的场景，
  // 必须显式传快照，否则 record 会拿到旧的 nodes 导致 undo 丢失新增节点。
  const record = useCallback(
    (snapshot?: CanvasSnapshot | null) => {
      stack.push(snapshot || getSnapshot());
      setVersion((v) => v + 1);
    },
    [stack, getSnapshot],
  );

  // undo/redo 结束后启动 600ms 抑制窗口（复刻源码 setTimeout）
  const scheduleRelease = useCallback(() => {
    if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
    suppressTimerRef.current = setTimeout(() => stack.releaseSuppress(), 600);
  }, [stack]);

  // 撤销（复刻 Gn）
  const undo = useCallback(() => {
    const snap = stack.undo();
    if (snap) {
      apply(snap);
      setVersion((v) => v + 1);
      scheduleRelease();
    }
  }, [stack, apply, scheduleRelease]);

  // 重做（复刻 Kn）
  const redo = useCallback(() => {
    const snap = stack.redo();
    if (snap) {
      apply(snap);
      setVersion((v) => v + 1);
      scheduleRelease();
    }
  }, [stack, apply, scheduleRelease]);

  // 清空历史（切换/新建项目时调用，避免跨项目残留撤销栈）
  const clear = useCallback(() => {
    if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
    stack.clear();
    setVersion((v) => v + 1);
  }, [stack]);

  return { canUndo: stack.canUndo, canRedo: stack.canRedo, record, undo, redo, clear };
}
