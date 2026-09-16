import { useState, useRef, useCallback } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { HistoryStack } from '../components/base/canvas/historyStack.ts';
import {
  applyStructuralSnapshot,
  extractStructuralSnapshot,
  isSameStructure,
  type StructuralSnapshot,
} from '../components/base/canvas/structuralSnapshot.ts';

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
 * 【TD-04-31 · 结构化撤销】栈内存的是**结构快照**（`StructuralSnapshot`，只含 id/type/parentId +
 * 边端点），**不是全量节点** —— 故：
 *  - 撤销**不会**回退位置/尺寸/普通内容（`applyStructuralSnapshot` 对现存节点保留当前值）；
 *  - 快照体积只与节点数相关，不再随 data 大小膨胀。
 * 恢复语义（以当前画布为底做结构增删）的完整说明见 `structuralSnapshot.ts`。
 *
 * @param getSnapshot 返回当前 { nodes, edges } 全量快照的函数（hook 内部提取结构）
 * @param apply       应用 { nodes, edges } 到画布
 * @returns { canUndo, canRedo, record, undo, redo, clear }
 */
export function useCanvasHistory(
  getSnapshot: () => CanvasSnapshot,
  apply: (snapshot: CanvasSnapshot) => void,
): CanvasHistoryApi {
  // React state 镜像（供渲染 canUndo/canRedo 与 record 闭包用）
  const [_version, setVersion] = useState(0);
  // 纯类实例：真实历史栈（不随渲染重建）—— 泛型 = **结构快照**（TD-04-31）
  const stackRef = useRef(new HistoryStack<StructuralSnapshot>());
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stack = stackRef.current;

  // snapshot：可显式传入本次操作后的最新 { nodes, edges }。
  // 若不传，则回退用 getSnapshot() 取 ref 里的当前值。
  // 注意：React setState 是异步的，addNode 等「先 setNodes 再 record」的场景，
  // 必须显式传快照，否则 record 会拿到旧的 nodes 导致 undo 丢失新增节点。
  const record = useCallback(
    (snapshot?: CanvasSnapshot | null) => {
      const { nodes, edges } = snapshot || getSnapshot();
      const structural = extractStructuralSnapshot(nodes, edges);
      // 结构未变则不重复入栈（如纯内容/位置改动误走了 record —— 防御性，正常路径不 record）
      const top = stack.history[stack.index];
      if (top && isSameStructure(top, structural)) return;
      stack.push(structural);
      setVersion((v) => v + 1);
    },
    [stack, getSnapshot],
  );

  const scheduleRelease = useCallback(() => {
    if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
    suppressTimerRef.current = setTimeout(() => stack.releaseSuppress(), 600);
  }, [stack]);

  // 撤销/重做：取目标**结构快照** → 以**当前画布**为底做结构增删（保留当前位置/尺寸/内容）。
  // 绝不能直接 `apply(snap.nodes)` —— 那会把位置/尺寸/内容一并带回旧值（TD-04-31 要消除的行为）。
  const applyStructural = useCallback(
    (target: StructuralSnapshot) => {
      const { nodes, edges } = getSnapshot();
      apply(applyStructuralSnapshot(nodes, edges, target));
    },
    [apply, getSnapshot],
  );

  const undo = useCallback(() => {
    const snap = stack.undo();
    if (snap) {
      applyStructural(snap);
      setVersion((v) => v + 1);
      scheduleRelease();
    }
  }, [stack, applyStructural, scheduleRelease]);

  const redo = useCallback(() => {
    const snap = stack.redo();
    if (snap) {
      applyStructural(snap);
      setVersion((v) => v + 1);
      scheduleRelease();
    }
  }, [stack, applyStructural, scheduleRelease]);

  // 清空历史（切换/新建项目时调用，避免跨项目残留撤销栈）
  const clear = useCallback(() => {
    if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
    stack.clear();
    setVersion((v) => v + 1);
  }, [stack]);

  return { canUndo: stack.canUndo, canRedo: stack.canRedo, record, undo, redo, clear };
}
