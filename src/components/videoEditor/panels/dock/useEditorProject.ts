/**
 * 剪辑器工程状态绑定（`panels/dock` 层的 React 桥接）。
 *
 * 【它做什么】把「`data/projectRepository`（唯一写者）+ `core/timelineOps`（纯函数）」
 * 桥接成 React 可用的状态 + 动作。**它自己不含任何领域逻辑** ——
 * 一切改写都调 `core/timelineOps` 的纯函数，本层只负责「调用 → 落盘 → 让 UI 重渲染」。
 *
 * 【撤销栈】复用泛型 `base/canvas/historyStack.ts::HistoryStack<T>`
 * （前置收口卡 6 已把它从注释落实为可配契约；`docs/123` §二.2 明确「不新写第 6 套」）。
 * 快照粒度 = **轨道数组**（`docs/120` C6：只快照轨道，连续交互只落一张）。
 *
 * 【为什么不在本层做落盘节流】见 `data/projectRepository.ts` 文件头：节流会让 `saveProject`
 * 变成"发射后不管"，**CAS 的 409 冲突结果就没有返回路径**（`docs/120` C2.7 要禁的静默覆盖）。
 * 本 Gate 的编辑动作都是**离散点击**（分割/裁/定格/删除），逐次落盘即天然节流；
 * 真要做拖拽期节流，必须由「能拿到冲突结果」的调用方实现（留待后续 Gate）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { HistoryStack } from '../../../base/canvas/historyStack.ts';
import { logger } from '../../../base/core/logger.ts';
import { createEmptyProject } from '../../core/normalize.ts';
import type { Project, Track } from '../../core/types.ts';
import { loadProject, saveProject } from '../../data/projectRepository.ts';

type EditorLoadStatus = 'idle' | 'loading' | 'ready' | 'failed';

export interface EditorProjectStore {
  status: EditorLoadStatus;
  project: Project | null;
  /** `failed` 时的原因（给开发者看，UI 只给一行提示）。 */
  reason?: string;
  /** 最近一次改动因**版本冲突**未落盘（`docs/120` C2.7：不静默覆盖，必须让用户看见）。 */
  conflict: boolean;
  canUndo: boolean;
  canRedo: boolean;
  /** 按纯函数改写轨道；**未变（同引用）时不落盘**（`docs/123` §一.3 I4）。 */
  applyTracks: (fn: (tracks: Track[]) => Track[]) => void;
  /**
   * 改写工程级字段（播放头 / 帧率 / 工程参数 / 基座高度）。
   * **不进撤销栈** —— `docs/120` C6 的快照粒度是「只快照轨道数组」；播放头移动不是一次编辑。
   */
  applyProjectPatch: (
    patch: Partial<Pick<Project, 'playhead' | 'fps' | 'settings' | 'ui'>>,
  ) => void;
  undo: () => void;
  redo: () => void;
  /** 发生冲突后重新加载（丢弃本地未落盘的改动由用户决定，见 UI 的冲突条）。 */
  reload: () => void;
}

/**
 * @param projectId 当前项目 id（工程**随项目走**：`docs/120` C2.6）
 * @param enabled   是否已激活过（基座首次展开才加载；折叠不重载、也不丢状态）
 */
export function useEditorProject(projectId: string, enabled: boolean): EditorProjectStore {
  const [status, setStatus] = useState<EditorLoadStatus>('idle');
  const [project, setProject] = useState<Project | null>(null);
  const [reason, setReason] = useState<string | undefined>(undefined);
  const [conflict, setConflict] = useState(false);
  const [, forceRender] = useState(0);
  const bump = useCallback(() => forceRender((n) => n + 1), []);

  const projectRef = useRef<Project | null>(null);
  const versionRef = useRef(0);
  const historyRef = useRef(new HistoryStack<Track[]>({ max: 50 }));
  /** 已按 projectId 加载过（首次展开才加载；折叠不重载）。 */
  const loadedForRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setConflict(false);
    try {
      const res = await loadProject(projectId);
      const next = res.status === 'none' ? createEmptyProject() : res.project;
      projectRef.current = next;
      versionRef.current = res.status === 'none' ? 0 : res.version;
      historyRef.current.clear();
      historyRef.current.push(next.tracks);
      setProject(next);
      setStatus('ready');
      if (res.status === 'none') {
        // 首次打开 → 落一条空工程（记录极小；`force` 因为此时还没有基线版本可 CAS）
        const saved = await saveProject(projectId, next, { force: true });
        if (saved.status === 'ok') versionRef.current = saved.version ?? versionRef.current;
      }
      logger.debug('视频剪辑器', '[工程] 已加载', { projectId, fresh: res.status === 'none' });
    } catch (e) {
      setStatus('failed');
      setReason(e instanceof Error ? e.message : String(e));
      // catch-ok: 读取失败必须**可见**（status='failed' + 一行红字），不是静默吞。
    }
  }, [projectId]);

  useEffect(() => {
    if (!enabled) return;
    if (loadedForRef.current === projectId) return;
    loadedForRef.current = projectId;
    void load();
  }, [enabled, projectId, load]);

  const persist = useCallback(
    async (next: Project) => {
      const res = await saveProject(projectId, next, { ifVersion: versionRef.current });
      if (res.status === 'ok') {
        if (typeof res.version === 'number') versionRef.current = res.version;
        setConflict(false);
        return;
      }
      // 冲突：本地改动**保留**（不丢用户工作），只是没落盘，且必须让用户看见
      setConflict(true);
      logger.warn('视频剪辑器', '工程未落盘：版本冲突（别处已更新）', {
        projectId,
        expected: res.expected,
      });
    },
    [projectId],
  );

  const applyTracks = useCallback(
    (fn: (tracks: Track[]) => Track[]) => {
      const prev = projectRef.current;
      if (!prev) return;
      const tracks = fn(prev.tracks);
      if (tracks === prev.tracks) return; // I4：无变化不落盘、不入栈
      // 元素级同引用也算「没变」：调用方常用 `tracks.map(...)` 改写，
      // 未命中的轨返回原对象、但数组本身是新引用 —— 不识别这一层就会误落盘/误入栈。
      if (tracks.length === prev.tracks.length && tracks.every((t, i) => t === prev.tracks[i]))
        return;
      historyRef.current.push(tracks);
      const next: Project = { ...prev, tracks };
      projectRef.current = next;
      setProject(next);
      bump();
      void persist(next);
    },
    [persist, bump],
  );

  /** 撤销/重做：取出快照 → 应用 → **立即退出 suppress**（本层只在用户编辑时 push，故可同步释放）。 */
  const step = useCallback(
    (dir: 'undo' | 'redo') => {
      const prev = projectRef.current;
      if (!prev) return;
      const snap = dir === 'undo' ? historyRef.current.undo() : historyRef.current.redo();
      historyRef.current.releaseSuppress();
      if (!snap) return;
      const next: Project = { ...prev, tracks: snap };
      projectRef.current = next;
      setProject(next);
      bump();
      void persist(next);
    },
    [persist, bump],
  );

  const undo = useCallback(() => step('undo'), [step]);
  const redo = useCallback(() => step('redo'), [step]);
  const reload = useCallback(() => {
    loadedForRef.current = null;
    void load();
  }, [load]);

  const applyProjectPatch = useCallback(
    (patch: Partial<Pick<Project, 'playhead' | 'fps' | 'settings' | 'ui'>>) => {
      const prev = projectRef.current;
      if (!prev) return;
      const next: Project = { ...prev, ...patch };
      // 不改任何字段（同值）→ 不落盘（I4 的同精神：无变化不写）
      const changed = (Object.keys(patch) as (keyof typeof patch)[]).some(
        (k) => next[k] !== prev[k],
      );
      if (!changed) return;
      projectRef.current = next;
      setProject(next);
      bump();
      void persist(next);
    },
    [persist, bump],
  );

  return {
    status,
    project,
    reason,
    conflict,
    canUndo: historyRef.current.canUndo,
    canRedo: historyRef.current.canRedo,
    applyTracks,
    applyProjectPatch,
    undo,
    redo,
    reload,
  };
}
